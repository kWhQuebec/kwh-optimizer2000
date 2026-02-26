import { Router, Request } from "express";
import { z } from "zod";
import multer from "multer";
import fs from "fs";
import path from "path";
import { eq, ne, and, desc } from "drizzle-orm";
import { authMiddleware, requireStaff, AuthRequest } from "../middleware/auth";
import { storage } from "../storage";
import { db } from "../db";
import * as googleSolar from "../googleSolarService";
import { sanitizeFilename, validatePathWithinBase } from "../lib/pathValidation";
import {
  insertSiteSchema,
  insertMeterFileSchema,
  insertMeterReadingSchema,
  insertSimulationRunSchema,
  insertRoofPolygonSchema,
  insertProjectBudgetSchema,
  defaultAnalysisAssumptions,
  sites as sitesTable,
  roofPolygons as roofPolygonsTable,
  type AnalysisAssumptions,
  type Site,
} from "@shared/schema";
import { BUDGET_CATEGORIES } from "@shared/stageLabels";
import {
  runMonteCarloAnalysis,
  createSimplifiedScenarioRunner,
  type SiteScenarioParams,
  analyzePeakShaving,
  recommendStandardKit,
  STANDARD_KITS,
  type MonteCarloConfig,
  generateSyntheticProfile,
  estimateAnnualConsumption,
  type BuildingSubType,
  type OperatingSchedule,
} from "../analysis";
import { estimateConstructionCost, getSiteVisitCompleteness } from "../pricing-engine";
import { asyncHandler, NotFoundError, BadRequestError, ForbiddenError, ConflictError, ValidationError } from "../middleware/errorHandler";
import { sendHqProcurationEmail } from "../emailService";
import { autoAdvanceStage } from "../repositories/pipelineRepo";
import { propagateTariffToSite, getSitesForPortalDashboard } from "../repositories/siteRepo";
import { createLogger } from "../lib/logger";

const log = createLogger("Sites");

const router = Router();

const upload = multer({ dest: "/tmp/meter-uploads/" });

// FIX: In-memory lock to prevent concurrent roof estimations for the same site
// Note: For multi-instance deployments, use database-level locking (e.g., pg_advisory_lock)
const roofEstimationLocks = new Set<string>();

async function triggerRoofEstimation(siteId: string): Promise<void> {
  // Prevent concurrent estimations for the same site
  if (roofEstimationLocks.has(siteId)) {
    log.info(`Roof estimation already in progress for site ${siteId}, skipping`);
    return;
  }

  roofEstimationLocks.add(siteId);

  try {
    const site = await storage.getSite(siteId);
    if (!site) {
      log.error(`Roof estimation: Site ${siteId} not found`);
      return;
    }

    let result: googleSolar.RoofEstimateResult;

    if (site.latitude && site.longitude) {
      result = await googleSolar.estimateRoofFromLocation({
        latitude: site.latitude,
        longitude: site.longitude
      }, storage);
    } else {
      const fullAddress = [
        site.address,
        site.city,
        site.province,
        site.postalCode,
        "Canada"
      ].filter(Boolean).join(", ");

      if (!fullAddress || fullAddress === "Canada") {
        await storage.updateSite(siteId, {
          roofEstimateStatus: "skipped",
          roofEstimateError: "No address provided",
          roofEstimatePendingAt: null
        });
        return;
      }

      result = await googleSolar.estimateRoofFromAddress(fullAddress, storage);
    }

    if (!result.success) {
      await storage.updateSite(siteId, {
        roofEstimateStatus: "failed",
        roofEstimateError: result.error || "Could not estimate roof area",
        latitude: result.latitude || null,
        longitude: result.longitude || null,
        roofEstimatePendingAt: null
      });
      log.info(`Roof estimation failed for site ${siteId}: ${result.error}`);
      return;
    }

    const enrichedDetails = JSON.parse(JSON.stringify({
      ...result.details,
      maxSunshineHoursPerYear: result.maxSunshineHoursPerYear,
      roofSegments: result.roofSegments,
      googleProductionEstimate: result.googleProductionEstimate,
      panelCapacityWatts: result.panelCapacityWatts,
      maxArrayAreaSqM: result.maxArrayAreaSqM,
    }));

    await storage.updateSite(siteId, {
      latitude: result.latitude,
      longitude: result.longitude,
      roofAreaAutoSqM: result.roofAreaSqM,
      roofAreaAutoSource: "google_solar",
      roofAreaAutoTimestamp: new Date(),
      roofAreaAutoDetails: enrichedDetails,
      roofEstimateStatus: "success",
      roofEstimateError: null,
      roofEstimatePendingAt: null
    });

    log.info(`Roof estimation success for site ${siteId}: ${result.roofAreaSqM.toFixed(1)} m²`);

    try {
      const colorResult = await googleSolar.analyzeRoofColor({
        latitude: result.latitude,
        longitude: result.longitude
      });

      if (colorResult.success) {
        await storage.updateSite(siteId, {
          roofColorType: colorResult.colorType,
          roofColorConfidence: colorResult.confidence,
          roofColorDetectedAt: new Date(),
        });
        log.info(`Roof color analysis for site ${siteId}: ${colorResult.colorType} (confidence: ${(colorResult.confidence * 100).toFixed(0)}%, suggest bifacial: ${colorResult.suggestBifacial})`);
      }
    } catch (colorError) {
      log.error(`Roof color analysis failed for site ${siteId}:`, colorError);
    }
  } catch (error) {
    log.error(`Roof estimation error for site ${siteId}:`, error);
    await storage.updateSite(siteId, {
      roofEstimateStatus: "failed",
      roofEstimateError: error instanceof Error ? error.message : "Unknown error",
      roofEstimatePendingAt: null
    });
  } finally {
    // Always release the lock when done
    roofEstimationLocks.delete(siteId);
  }
}

router.get("/list", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const { limit, offset, search, clientId, includeArchived, sortBy } = req.query;
  const showArchived = includeArchived === "true";

  let sites = await storage.getSites();

  // Filter by role
  const filtered = req.userRole === "admin" || req.userRole === "analyst"
    ? sites
    : sites.filter(s => s.clientId && s.clientId === req.userClientId);

  // Filter by client if specified
  let result = clientId && typeof clientId === "string"
    ? filtered.filter(s => s.clientId === clientId)
    : filtered;

  // Filter out archived sites unless explicitly requested
  if (!showArchived) {
    result = result.filter(s => !s.isArchived);
  }

  // Filter by search query
  if (search && typeof search === "string") {
    const searchLower = search.toLowerCase();
    result = result.filter(s =>
      s.name?.toLowerCase().includes(searchLower) ||
      s.address?.toLowerCase().includes(searchLower) ||
      s.city?.toLowerCase().includes(searchLower)
    );
  }

  const sortField = typeof sortBy === "string" ? sortBy : "newest";
  result.sort((a, b) => {
    switch (sortField) {
      case "modified":
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      case "name_asc":
        return (a.name || "").localeCompare(b.name || "", "fr");
      case "name_desc":
        return (b.name || "").localeCompare(a.name || "", "fr");
      case "newest":
      default:
        return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
    }
  });

  const total = result.length;

  // Apply pagination
  const limitNum = limit ? parseInt(limit as string, 10) : 50;
  const offsetNum = offset ? parseInt(offset as string, 10) : 0;
  const paginated = result.slice(offsetNum, offsetNum + limitNum);

  res.json({
    sites: paginated.map(s => ({
      id: s.id,
      name: s.name,
      address: s.address,
      city: s.city,
      province: s.province,
      postalCode: s.postalCode,
      analysisAvailable: s.analysisAvailable,
      roofAreaValidated: s.roofAreaValidated,
      createdAt: s.createdAt,
      clientId: s.clientId,
      clientName: s.client?.name || "",
      hasSimulation: ((s as any).simulationRuns?.length || 0) > 0,
      hasDesignAgreement: false,
      isArchived: s.isArchived
    })),
    total
  });
}));

router.get("/", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const { clientId } = req.query;
  let sites;
  if (clientId && typeof clientId === "string") {
    sites = await storage.getSitesByClient(clientId);
  } else {
    sites = await storage.getSites();
  }
  if (req.userRole !== "admin" && req.userRole !== "analyst") {
    sites = sites.filter(s => s.clientId && s.clientId === req.userClientId);
  }
  res.json(sites);
}));

router.get("/minimal", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const sites = await storage.getSitesMinimal();
  if (req.userRole !== "admin" && req.userRole !== "analyst") {
    const filtered = sites.filter(s => s.clientId === req.userClientId);
    res.json(filtered);
  } else {
    res.json(sites);
  }
}));

router.get("/portal-dashboard", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const { clientId } = req.query;
  const isStaff = req.userRole === "admin" || req.userRole === "analyst";
  const filterClientId = isStaff
    ? (typeof clientId === "string" ? clientId : undefined)
    : (req.userClientId || undefined);

  const sites = await getSitesForPortalDashboard(filterClientId);
  res.json(sites.filter(s => !s.isArchived));
}));

router.get("/:id", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const site = await storage.getSite(req.params.id);
  if (!site) {
    throw new NotFoundError("Site");
  }
  if (req.userRole !== "admin" && req.userRole !== "analyst" && site.clientId !== req.userClientId) {
    throw new ForbiddenError("Access denied");
  }
  res.json(site);
}));

router.post("/", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const parsed = insertSiteSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new BadRequestError("Validation failed");
  }

  const site = await storage.createSite(parsed.data);

  const autoEstimate = req.body.autoEstimateRoof !== false;
  if (autoEstimate && (site.address || (site.latitude && site.longitude))) {
    await storage.updateSite(site.id, {
      roofEstimateStatus: "pending",
      roofEstimatePendingAt: new Date()
    });
    triggerRoofEstimation(site.id);
  }

  const updatedSite = await storage.getSite(site.id);
  res.status(201).json(updatedSite);
}));

router.patch("/:id", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const existingSite = await storage.getSite(req.params.id);
  if (!existingSite) {
    throw new NotFoundError("Site");
  }

  const updateData = { ...req.body };
  delete updateData.id;
  delete updateData.createdAt;
  delete updateData.updatedAt;
  delete updateData.roofAreaAutoSqM;
  delete updateData.roofAreaAutoSource;
  delete updateData.roofAreaAutoTimestamp;
  delete updateData.roofAreaAutoDetails;

  if (updateData.ownerName !== undefined && updateData.ownerName !== existingSite.ownerName) {
    log.info(`Site ${req.params.id}: Owner changed from "${existingSite.ownerName}" to "${updateData.ownerName}"`);
  }

  const addressChanged =
    updateData.address !== undefined && updateData.address !== existingSite.address ||
    updateData.city !== undefined && updateData.city !== existingSite.city ||
    updateData.postalCode !== undefined && updateData.postalCode !== existingSite.postalCode;
  const coordsChanged =
    updateData.latitude !== undefined && updateData.latitude !== existingSite.latitude ||
    updateData.longitude !== undefined && updateData.longitude !== existingSite.longitude;

  if ((addressChanged || coordsChanged) && existingSite.roofEstimateStatus !== "pending") {
    updateData.roofEstimateStatus = "pending";
    updateData.roofEstimatePendingAt = new Date();
  }

  const site = await storage.updateSite(req.params.id, updateData);
  if (!site) {
    throw new NotFoundError("Site");
  }

  if ((addressChanged || coordsChanged) && site.roofEstimateStatus === "pending") {
    triggerRoofEstimation(site.id);
  }

  res.json(site);
}));

router.get("/:id/cascade-counts", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const site = await storage.getSite(req.params.id);
  if (!site) throw new NotFoundError("Site");
  const counts = await storage.getSiteCascadeCounts(req.params.id);
  res.json({ siteName: site.name, ...counts });
}));

router.delete("/:id/cascade", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const site = await storage.getSite(req.params.id);
  if (!site) throw new NotFoundError("Site");
  const deleted = await storage.cascadeDeleteSite(req.params.id);
  if (!deleted) throw new BadRequestError("Failed to delete site");
  res.status(204).send();
}));

router.delete("/:id", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const siteId = req.params.id;

  // Check if site exists
  const site = await storage.getSite(siteId);
  if (!site) {
    throw new NotFoundError("Site");
  }

  // Check for related records that would prevent deletion
  const simulations = await storage.getSimulationRunsBySite(siteId);
  if (simulations.length > 0) {
    throw new ConflictError(
      `Cannot delete site with ${simulations.length} analysis(es). Please delete them first.`,
      [{ simulations: simulations.length }]
    );
  }

  const siteVisits = await storage.getSiteVisitsBySite(siteId);
  if (siteVisits.length > 0) {
    throw new ConflictError(
      `Cannot delete site with ${siteVisits.length} site visit(s). Please delete them first.`,
      [{ siteVisits: siteVisits.length }]
    );
  }

  const deleted = await storage.deleteSite(siteId);
  if (!deleted) {
    throw new Error("Failed to delete site");
  }
  res.status(204).send();
}));

router.post("/:id/reset-roof-status", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const site = await storage.getSite(req.params.id);
  if (!site) {
    throw new NotFoundError("Site");
  }

  await storage.updateSite(req.params.id, {
    roofEstimateStatus: "pending",
    roofEstimatePendingAt: new Date(),
    roofEstimateError: null
  });

  triggerRoofEstimation(req.params.id);

  const updatedSite = await storage.getSite(req.params.id);
  res.json(updatedSite);
}));

router.post("/:id/geocode", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const site = await storage.getSite(req.params.id);
  if (!site) {
    throw new NotFoundError("Site");
  }

  const fullAddress = [
    site.address,
    site.city,
    site.province,
    site.postalCode,
    "Canada"
  ].filter(Boolean).join(", ");

  if (!fullAddress || fullAddress === "Canada") {
    throw new BadRequestError("No address provided for geocoding");
  }

  const result = await googleSolar.geocodeAddress(fullAddress);
  if (!result) {
    throw new BadRequestError("Geocoding failed");
  }

  await storage.updateSite(site.id, {
    latitude: result.latitude,
    longitude: result.longitude
  });

  const updatedSite = await storage.getSite(site.id);
  res.json(updatedSite);
}));

router.post("/:id/roof-estimate", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const site = await storage.getSite(req.params.id);
  if (!site) {
    throw new NotFoundError("Site");
  }

  let result: googleSolar.RoofEstimateResult;

  if (site.latitude && site.longitude) {
    result = await googleSolar.estimateRoofFromLocation({
      latitude: site.latitude,
      longitude: site.longitude
    }, storage);
  } else {
    const fullAddress = [
      site.address,
      site.city,
      site.province,
      site.postalCode,
      "Canada"
    ].filter(Boolean).join(", ");

    if (!fullAddress || fullAddress === "Canada") {
      throw new BadRequestError("No address or coordinates provided");
    }

    result = await googleSolar.estimateRoofFromAddress(fullAddress, storage);
  }

  if (!result.success) {
    await storage.updateSite(site.id, {
      roofEstimateStatus: "failed",
      roofEstimateError: result.error || "Could not estimate roof area",
      latitude: result.latitude || null,
      longitude: result.longitude || null
    });
    throw new BadRequestError(result.error || "Could not estimate roof area");
  }

  const enrichedDetails = JSON.parse(JSON.stringify({
    ...result.details,
    maxSunshineHoursPerYear: result.maxSunshineHoursPerYear,
    roofSegments: result.roofSegments,
    googleProductionEstimate: result.googleProductionEstimate,
    panelCapacityWatts: result.panelCapacityWatts,
    maxArrayAreaSqM: result.maxArrayAreaSqM,
  }));

  await storage.updateSite(site.id, {
    latitude: result.latitude,
    longitude: result.longitude,
    roofAreaAutoSqM: result.roofAreaSqM,
    roofAreaAutoSource: "google_solar",
    roofAreaAutoTimestamp: new Date(),
    roofAreaAutoDetails: enrichedDetails,
    roofEstimateStatus: "success",
    roofEstimateError: null
  });

  const updatedSite = await storage.getSite(site.id);
  res.json(updatedSite);
}));

router.get("/:id/roof-imagery", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const site = await storage.getSite(req.params.id);
  if (!site) {
    throw new NotFoundError("Site");
  }

  if (!site.latitude || !site.longitude) {
    throw new BadRequestError("Site has no coordinates");
  }

  const zoom = parseInt(req.query.zoom as string) || 20;
  const width = parseInt(req.query.width as string) || 600;
  const height = parseInt(req.query.height as string) || 400;

  const result = await googleSolar.getDataLayers({
    latitude: site.latitude,
    longitude: site.longitude,
  });

  if (!result.success) {
    throw new BadRequestError(result.error || "Could not get imagery");
  }

  res.json({
    imageUrl: result.rgbUrl,
    satelliteUrl: result.rgbUrl,
    latitude: site.latitude,
    longitude: site.longitude
  });
}));

router.get("/:id/solar-mockup", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const site = await storage.getSite(req.params.id);
  if (!site) {
    throw new NotFoundError("Site");
  }

  if (!site.latitude || !site.longitude) {
    throw new BadRequestError("Site has no coordinates");
  }

  const panelCount = parseInt(req.query.panelCount as string) || 0;

  const result = await googleSolar.getSolarMockupData(
    { latitude: site.latitude, longitude: site.longitude },
    panelCount
  );

  if (!result.success) {
    throw new BadRequestError(result.error || "Could not generate mockup");
  }

  res.json({
    ...result,
    siteId: site.id,
    siteName: site.name
  });
}));

router.post("/:id/bifacial-response", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const site = await storage.getSite(req.params.id);
  if (!site) {
    throw new NotFoundError("Site");
  }

  const { response } = req.body;
  if (response !== "yes" && response !== "no") {
    throw new BadRequestError("Invalid response. Must be 'yes' or 'no'");
  }

  const bifacialEnabled = response === "yes";
  await storage.updateSite(site.id, {
    bifacialAnalysisAccepted: bifacialEnabled,
  } as Partial<Site>);

  const updatedSite = await storage.getSite(site.id);
  res.json(updatedSite);
}));

router.post("/:id/suggest-constraints", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const site = await storage.getSite(req.params.id);
  if (!site) {
    throw new NotFoundError("Site");
  }

  if (!site.latitude || !site.longitude) {
    throw new BadRequestError("Site has no coordinates for constraint detection");
  }

  const clientSolarPolygons = req.body.solarPolygons as [number, number][][] | undefined;

  let polygonsForAnalysis: Array<{ coordinates: [number, number][]; label?: string; color?: string }>;

  if (Array.isArray(clientSolarPolygons) && clientSolarPolygons.length > 0) {
    polygonsForAnalysis = clientSolarPolygons.map(coords => ({
      coordinates: coords,
    }));
  } else {
    const existingPolygons = await storage.getRoofPolygons(site.id);
    const solarOnly = existingPolygons.filter(p => p.color !== '#f97316');
    polygonsForAnalysis = solarOnly.map(p => ({
      coordinates: p.coordinates as [number, number][],
      label: p.label || undefined,
      color: p.color || undefined,
    }));
  }

  if (polygonsForAnalysis.length === 0) {
    throw new BadRequestError("No solar polygons found to analyze");
  }

  const source = Array.isArray(clientSolarPolygons) && clientSolarPolygons.length > 0 ? 'client' : 'database';
  log.info(`suggest-constraints: site=${site.id}, lat=${site.latitude}, lng=${site.longitude}, polygons=${polygonsForAnalysis.length} (from ${source})`);

  const result = await googleSolar.suggestConstraints({
    latitude: site.latitude,
    longitude: site.longitude,
    existingPolygons: polygonsForAnalysis,
  });

  if (!result.success) {
    throw new BadRequestError(result.error || "Could not analyze constraints");
  }

  res.json({
    constraints: result.suggestedConstraints,
    analysisNotes: result.analysisNotes
  });
}));

router.post("/:siteId/upload-meters", authMiddleware, requireStaff, upload.array("files"), asyncHandler(async (req: AuthRequest, res) => {
  const { siteId } = req.params;
  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    throw new BadRequestError("No files uploaded");
  }

  const site = await storage.getSite(siteId);
  if (!site) {
    throw new NotFoundError("Site");
  }

  const results = [];
  for (const file of files) {
    // Sanitize the uploaded filename to prevent path traversal in database storage
    const sanitizedFilename = sanitizeFilename(file.originalname);

    // Validate that the temporary file path is within /tmp/meter-uploads/
    const tmpBaseDir = path.resolve("/tmp/meter-uploads/");
    try {
      validatePathWithinBase(file.path, tmpBaseDir);
    } catch (err) {
      log.error(`Path traversal attempt in uploaded file: ${file.path}`);
      throw new BadRequestError("Invalid file path");
    }

    const meterFile = await storage.createMeterFile({
      siteId,
      fileName: sanitizedFilename,
      granularity: sanitizedFilename.toLowerCase().includes("15min") ? "15MIN" : "HOUR",
      originalStoragePath: file.path,
    });

    const granularity = sanitizedFilename.toLowerCase().includes("15min") ? "15MIN" : "HOUR";

    const { parseHydroQuebecCSV } = await import("./siteAnalysisHelpers");
    const readings = await parseHydroQuebecCSV(file.path, meterFile.id, granularity);

    if (readings.length > 0) {
      await storage.createMeterReadings(readings);
      await storage.updateMeterFile(meterFile.id, {
        status: "PARSED",
        periodStart: readings[0].timestamp,
        periodEnd: readings[readings.length - 1].timestamp
      });
    } else {
      await storage.updateMeterFile(meterFile.id, {
        status: "FAILED",
        errorMessage: "No valid readings found in file"
      });
    }

    const updatedFile = await storage.getMeterFile(meterFile.id);
    results.push(updatedFile);

    try {
      fs.unlinkSync(file.path);
    } catch (e) {
      log.error("Could not delete temp file:", file.path);
    }
  }

  autoAdvanceStage(siteId).catch(err => log.error(`Auto-advance failed for site ${siteId}:`, err));
  propagateTariffToSite(siteId).catch(err => log.error(`Tariff propagation failed for site ${siteId}:`, err));

  res.json({ files: results });
}));

router.patch("/:siteId/meter-files/:fileId/synthetic", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const { fileId } = req.params;
  const { isSynthetic } = req.body;

  if (typeof isSynthetic !== "boolean") {
    throw new BadRequestError("isSynthetic must be a boolean");
  }

  const updatedFile = await storage.updateMeterFile(fileId, { isSynthetic });
  if (!updatedFile) {
    throw new NotFoundError("Meter file");
  }

  res.json(updatedFile);
}));

router.post("/:siteId/quick-potential", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const { siteId } = req.params;
  const { constraintFactor = 0.10, assumptions } = req.body;

  const site = await storage.getSite(siteId);
  if (!site) {
    throw new NotFoundError("Site");
  }

  // Get roof polygons to calculate total area
  const polygons = await storage.getRoofPolygons(siteId);

  // Filter solar polygons (exclude constraints marked by orange color or constraint labels)
  const solarPolygons = polygons.filter(p => {
    if (p.color === "#f97316") return false; // Orange = constraint
    const label = (p.label || "").toLowerCase();
    return !label.includes("constraint") && !label.includes("contrainte") &&
           !label.includes("hvac") && !label.includes("obstacle");
  });

  // Calculate total roof area from polygons or fallback to site values
  const polygonAreaSqM = solarPolygons.reduce((sum, p) => sum + (p.areaSqM || 0), 0);
  let totalRoofAreaSqM = polygonAreaSqM > 0
    ? polygonAreaSqM
    : (site.roofAreaSqM || site.roofAreaAutoSqM || 0);

  if (totalRoofAreaSqM <= 0 && site.buildingSqFt && site.buildingSqFt > 0) {
    totalRoofAreaSqM = site.buildingSqFt * 0.0929;
  }

  if (totalRoofAreaSqM <= 0) {
    throw new BadRequestError("No roof area available. Please draw roof areas in Step 1 (Roof Drawing Tool) or set a building area for this site.");
  }

  // Import pricing and yield functions
  const { getTieredSolarCostPerW, getSolarPricingTierLabel, resolveYieldStrategy, getBifacialConfigFromRoofColor } = await import("../analysis/potentialAnalysis");

  // Panel specifications (standard 400W panels, ~2 m² per panel)
  const panelPowerW = 400;
  const panelAreaSqM = 2.0;

  // Calculate effective utilization ratio
  // Base utilization of 85%, reduced by constraint factor (e.g., 10% = 0.90 multiplier)
  const baseUtilizationRatio = 0.85;
  const effectiveUtilizationRatio = baseUtilizationRatio * (1 - constraintFactor);
  const usableRoofAreaSqM = totalRoofAreaSqM * effectiveUtilizationRatio;

  // Calculate system sizing
  const numPanels = Math.floor(usableRoofAreaSqM / panelAreaSqM);
  const maxCapacityKW = (numPanels * panelPowerW) / 1000;

  // Use resolveYieldStrategy() as SINGLE source of truth for yield
  // This ensures consistency with detailed analysis (same bifacial boost, Google data, etc.)
  const bifacialEnabled = assumptions?.bifacialEnabled ?? site.bifacialAnalysisAccepted ?? true;
  const roofDetails = site.roofAreaAutoDetails as { yearlyEnergyDcKwh?: number; maxSunshineHoursPerYear?: number } | null;
  const googleData: { googleProductionEstimate?: { yearlyEnergyAcKwh: number; systemSizeKw: number }; maxSunshineHoursPerYear?: number } | undefined =
    (roofDetails?.yearlyEnergyDcKwh && site.kbKwDc) || roofDetails?.maxSunshineHoursPerYear
    ? {
        ...(roofDetails?.yearlyEnergyDcKwh && site.kbKwDc ? {
          googleProductionEstimate: {
            yearlyEnergyAcKwh: roofDetails.yearlyEnergyDcKwh,
            systemSizeKw: site.kbKwDc
          }
        } : {}),
        ...(roofDetails?.maxSunshineHoursPerYear ? {
          maxSunshineHoursPerYear: roofDetails.maxSunshineHoursPerYear
        } : {})
      }
    : undefined;

  const yieldStrategyResult = resolveYieldStrategy(
    {
      solarYieldKWhPerKWp: assumptions?.manualYield && assumptions.manualYield > 0
        ? assumptions.manualYield
        : undefined,
      bifacialEnabled,
      orientationFactor: assumptions?.orientationFactor,
      useManualYield: assumptions?.manualYield && assumptions.manualYield > 0 ? true : undefined,
    } as any,
    googleData,
    site.roofColorType as any
  );

  // Quick Analysis simplified system derate — matches runHourlySimulation() loss factors:
  // wire 3%, LID 1%, mismatch 2%, mismatch strings 0.15%, module quality gain +0.75%
  // Net derate = 0.97 × 0.99 × 0.98 × 0.9985 × 1.0075 ≈ 0.9466
  // Temperature correction is only for 'default' yieldSource (~4% average annual loss)
  const systemDerate = 0.97 * 0.99 * 0.98 * 0.9985 * 1.0075; // ~0.9466
  const tempDerate = yieldStrategyResult.skipTempCorrection ? 1.0 : 0.96; // ~4% annual avg for Quebec
  const effectiveYield = Math.round(yieldStrategyResult.effectiveYield * systemDerate * tempDerate);

  const yieldStrategy = {
    baseYield: yieldStrategyResult.baseYield,
    effectiveYield,
    bifacialGain: yieldStrategyResult.bifacialBoost - 1.0,
    yieldSource: yieldStrategyResult.yieldSource,
    skipTempCorrection: yieldStrategyResult.skipTempCorrection,
  };

  const annualProductionKWh = maxCapacityKW * effectiveYield;
  const annualProductionMWh = annualProductionKWh / 1000;

  // Financial calculations using tiered pricing
  const costPerW = getTieredSolarCostPerW(maxCapacityKW);
  const pricingTier = getSolarPricingTierLabel(maxCapacityKW, 'fr');
  const grossCapex = maxCapacityKW * 1000 * costPerW;

  // HQ Incentive: $1000/kW, max 40% of CAPEX, max 1 MW eligible
  const eligibleKW = Math.min(maxCapacityKW, 1000);
  const potentialHqIncentive = eligibleKW * 1000;
  const maxHqIncentive = grossCapex * 0.40;
  const hqIncentive = Math.min(potentialHqIncentive, maxHqIncentive);

  // Federal ITC: 30% of (CAPEX - HQ incentive)
  const itcBasis = grossCapex - hqIncentive;
  const federalItc = itcBasis * 0.30;

  const netCapex = grossCapex - hqIncentive - federalItc;

  // Estimate annual savings (using typical HQ M tariff rate of ~$0.06/kWh)
  const hqEnergyRate = 0.06;
  const estimatedAnnualSavings = annualProductionKWh * hqEnergyRate;

  // Simple payback calculation
  const simplePaybackYears = estimatedAnnualSavings > 0
    ? netCapex / estimatedAnnualSavings
    : 999;

  // Save quick analysis results to site record
  await storage.updateSite(siteId, {
    quickAnalysisSystemSizeKw: maxCapacityKW,
    quickAnalysisAnnualProductionKwh: annualProductionKWh,
    quickAnalysisAnnualSavings: estimatedAnnualSavings,
    quickAnalysisPaybackYears: simplePaybackYears,
    quickAnalysisGrossCapex: grossCapex,
    quickAnalysisNetCapex: netCapex,
    quickAnalysisHqIncentive: hqIncentive,
    quickAnalysisConstraintFactor: constraintFactor,
    quickAnalysisCompletedAt: new Date(),
  });

  autoAdvanceStage(siteId).catch(err => log.error(`Auto-advance failed for site ${siteId}:`, err));

  res.json({
    success: true,
    roofAnalysis: {
      totalRoofAreaSqM: Math.round(totalRoofAreaSqM),
      usableRoofAreaSqM: Math.round(usableRoofAreaSqM),
      utilizationRatio: effectiveUtilizationRatio,
      constraintFactor,
      polygonCount: solarPolygons.length > 0 ? solarPolygons.length : 1,
    },
    systemSizing: {
      maxCapacityKW: Math.round(maxCapacityKW * 10) / 10,
      numPanels,
      panelPowerW,
    },
    production: {
      annualProductionKWh: Math.round(annualProductionKWh),
      annualProductionMWh: Math.round(annualProductionMWh * 10) / 10,
      yieldKWhPerKWp: effectiveYield,
    },
    financial: {
      costPerW,
      pricingTier,
      estimatedCapex: Math.round(grossCapex),
      netCapex: Math.round(netCapex),
      hqIncentive: Math.round(hqIncentive),
      federalItc: Math.round(federalItc),
      estimatedAnnualSavings: Math.round(estimatedAnnualSavings),
      simplePaybackYears: Math.round(simplePaybackYears * 10) / 10,
    },
    yieldStrategy,
  });
}));

router.post("/:siteId/save-visualization", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const { siteId } = req.params;
  const { imageDataUrl } = req.body;

  if (!imageDataUrl || !imageDataUrl.startsWith("data:image/")) {
    throw new BadRequestError("Invalid image data");
  }

  const site = await storage.getSite(siteId);
  if (!site) {
    throw new NotFoundError("Site");
  }

  await storage.updateSite(siteId, {
    roofVisualizationImageUrl: imageDataUrl
  });

  res.json({ success: true });
}));

router.post("/:siteId/run-potential-analysis", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const { siteId } = req.params;
  const { assumptions, forcedSizing } = req.body;

  const site = await storage.getSite(siteId);
  if (!site) {
    throw new NotFoundError("Site");
  }

  const readings = await storage.getMeterReadingsBySite(siteId);
  if (readings.length === 0) {
    throw new BadRequestError("No meter data available for analysis");
  }

  const { deduplicateMeterReadingsByHour, runPotentialAnalysis, resolveYieldStrategy, getDefaultAnalysisAssumptions } = await import("./siteAnalysisHelpers");

  const dedupResult = deduplicateMeterReadingsByHour(readings.map(r => ({
    kWh: r.kWh,
    kW: r.kW,
    timestamp: new Date(r.timestamp),
    granularity: r.granularity || undefined
  })));

  const roofDetailsScenario = site.roofAreaAutoDetails as { yearlyEnergyDcKwh?: number; maxSunshineHoursPerYear?: number } | null;

  // Build googleData object for resolveYieldStrategy
  // Include both production estimate (PRIORITY 1) and sunshine hours fallback (PRIORITY 2)
  const googleData: { googleProductionEstimate?: { yearlyEnergyAcKwh: number; systemSizeKw: number }; maxSunshineHoursPerYear?: number } | undefined =
    (roofDetailsScenario?.yearlyEnergyDcKwh && site.kbKwDc) || roofDetailsScenario?.maxSunshineHoursPerYear
    ? {
        ...(roofDetailsScenario?.yearlyEnergyDcKwh && site.kbKwDc ? {
          googleProductionEstimate: {
            yearlyEnergyAcKwh: roofDetailsScenario.yearlyEnergyDcKwh,
            systemSizeKw: site.kbKwDc
          }
        } : {}),
        ...(roofDetailsScenario?.maxSunshineHoursPerYear ? {
          maxSunshineHoursPerYear: roofDetailsScenario.maxSunshineHoursPerYear
        } : {})
      }
    : undefined;

  // Build base assumptions for yield strategy
  const baseAssumptions = {
    ...getDefaultAnalysisAssumptions(),
    ...assumptions,
    bifacialEnabled: assumptions?.bifacialEnabled ?? site.bifacialAnalysisAccepted ?? true
  };

  const yieldStrategy = resolveYieldStrategy(
    baseAssumptions,
    googleData,
    site.roofColorType as any
  );

  const analysisAssumptions: Partial<AnalysisAssumptions> = {
    ...baseAssumptions,
    solarYieldKWhPerKWp: yieldStrategy.effectiveYield,
    yieldSource: yieldStrategy.yieldSource,
    _yieldStrategy: yieldStrategy
  };

  // CRITICAL: Use manually traced roof polygons as source of truth (not site.roofAreaSqM)
  // Per methodology: "Manual roof tracing: Source of truth for roof surfaces (Google not reliable for C&I)"
  const polygons = await storage.getRoofPolygons(siteId);
  const solarPolygons = polygons.filter(p => {
    if (p.color === "#f97316") return false; // Orange = constraint
    const label = (p.label || "").toLowerCase();
    return !label.includes("constraint") && !label.includes("contrainte") &&
           !label.includes("hvac") && !label.includes("obstacle");
  });

  // Calculate total traced solar area
  const tracedSolarAreaSqM = solarPolygons.reduce((sum, p) => sum + (p.areaSqM || 0), 0);

  // Use traced area if available, otherwise fallback to site values
  let effectiveRoofAreaSqM = tracedSolarAreaSqM > 0
    ? tracedSolarAreaSqM
    : (site.roofAreaSqM || site.roofAreaAutoSqM || 0);

  if (effectiveRoofAreaSqM <= 0 && site.buildingSqFt && site.buildingSqFt > 0) {
    effectiveRoofAreaSqM = site.buildingSqFt * 0.0929;
  }

  // Guard: require roof area to prevent NaN in calculations
  if (effectiveRoofAreaSqM <= 0) {
    throw new BadRequestError("No roof area available. Please draw roof areas in Step 1 (Roof Drawing Tool) or set a building area for this site.");
  }

  analysisAssumptions.roofAreaSqFt = effectiveRoofAreaSqM * 10.764;

  // Calculate max PV capacity using KB Racking formula:
  // maxPV = (usable_area / 3.71 m²) × 0.660 kW per panel
  const roofUtilizationRatio = baseAssumptions.roofUtilizationRatio ?? 0.85;
  const usableAreaSqM = effectiveRoofAreaSqM * roofUtilizationRatio;
  const formulaMaxPvKw = (usableAreaSqM / 3.71) * 0.660;
  const kbMaxPvKw = site.kbKwDc && site.kbKwDc > 0 ? site.kbKwDc : formulaMaxPvKw;
  (analysisAssumptions as any).maxPVFromRoofKw = kbMaxPvKw;

  log.info(`Roof area source: ${tracedSolarAreaSqM > 0 ? 'polygons' : 'site'}, ` +
    `tracedArea=${tracedSolarAreaSqM.toFixed(0)}m², effectiveArea=${effectiveRoofAreaSqM.toFixed(0)}m², ` +
    `maxPV=${kbMaxPvKw.toFixed(1)}kW (${site.kbKwDc && site.kbKwDc > 0 ? 'RoofVisualization' : 'KB Racking formula'})`);

  const result = runPotentialAnalysis(
    dedupResult.readings,
    analysisAssumptions,
    {
      forcedSizing,
      preCalculatedDataSpanDays: dedupResult.dataSpanDays
    }
  );

  const simulation = await storage.createSimulationRun({
    siteId,
    meterId: null,
    type: "SCENARIO",
    pvSizeKW: result.pvSizeKW,
    battEnergyKWh: result.battEnergyKWh,
    battPowerKW: result.battPowerKW,
    demandShavingSetpointKW: result.demandShavingSetpointKW,
    annualConsumptionKWh: result.annualConsumptionKWh,
    peakDemandKW: result.peakDemandKW,
    annualEnergySavingsKWh: result.annualEnergySavingsKWh,
    annualDemandReductionKW: result.annualDemandReductionKW,
    selfConsumptionKWh: result.selfConsumptionKWh,
    selfSufficiencyPercent: result.selfSufficiencyPercent,
    totalProductionKWh: result.totalProductionKWh,
    annualCostBefore: result.annualCostBefore,
    annualCostAfter: result.annualCostAfter,
    annualSavings: result.annualSavings,
    savingsYear1: result.savingsYear1,
    capexGross: result.capexGross,
    capexPV: result.capexPV,
    capexBattery: result.capexBattery,
    incentivesHQ: result.incentivesHQ,
    incentivesHQSolar: result.incentivesHQSolar,
    incentivesHQBattery: result.incentivesHQBattery,
    incentivesFederal: result.incentivesFederal,
    taxShield: result.taxShield,
    totalIncentives: result.totalIncentives,
    capexNet: result.capexNet,
    npv25: result.npv25,
    npv10: result.npv10,
    npv20: result.npv20,
    irr25: result.irr25,
    irr10: result.irr10,
    irr20: result.irr20,
    simplePaybackYears: result.simplePaybackYears,
    lcoe: result.lcoe,
    co2AvoidedTonnesPerYear: result.co2AvoidedTonnesPerYear,
    assumptions: result.assumptions,
    cashflows: result.cashflows,
    breakdown: result.breakdown,
    hourlyProfile: result.hourlyProfile,
    peakWeekData: result.peakWeekData,
    sensitivity: result.sensitivity,
    interpolatedMonths: result.interpolatedMonths,
  });

  res.json({
    simulationId: simulation.id,
    ...result,
    yieldStrategy
  });
}));

router.post("/:siteId/monte-carlo-analysis", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const { siteId } = req.params;
  const { config } = req.body as { config?: MonteCarloConfig };

  const site = await storage.getSite(siteId);
  if (!site) {
    throw new NotFoundError("Site");
  }

  const readings = await storage.getMeterReadingsBySite(siteId);
  if (readings.length === 0) {
    throw new BadRequestError("No meter data available for Monte Carlo analysis. Run a detailed analysis first.");
  }

  const { deduplicateMeterReadingsByHour, buildHourlyData } = await import("./siteAnalysisHelpers");

  const dedupResult = deduplicateMeterReadingsByHour(readings.map(r => ({
    kWh: r.kWh,
    kW: r.kW,
    timestamp: new Date(r.timestamp),
    granularity: r.granularity || undefined
  })));
  const { hourlyData } = buildHourlyData(dedupResult.readings);

  // Get site's analysis assumptions or use defaults
  const baseAssumptions: AnalysisAssumptions = (site.analysisAssumptions as AnalysisAssumptions) || { ...defaultAnalysisAssumptions };

  // Get sizing from latest analysis
  const analyses = await storage.getSimulationRunsBySite(siteId);
  const latestAnalysis = analyses.length > 0 ? analyses[analyses.length - 1] : null;

  const pvSizeKW = latestAnalysis?.pvSizeKW || site.quickAnalysisSystemSizeKw || 100;
  const peakKW = latestAnalysis?.peakDemandKW || 50;
  const battEnergyKWh = latestAnalysis?.battEnergyKWh || 0;
  const battPowerKW = latestAnalysis?.battPowerKW || 0;

  // Annualize consumption
  let totalKWh = 0;
  for (const r of dedupResult.readings) { totalKWh += r.kWh || 0; }
  const annualizationFactor = 365 / Math.max(dedupResult.dataSpanDays, 1);
  const annualConsumptionKWh = latestAnalysis?.annualConsumptionKWh || totalKWh * annualizationFactor;

  const siteScenarioParams: SiteScenarioParams = {
    pvSizeKW,
    annualConsumptionKWh,
    tariffEnergy: baseAssumptions.tariffEnergy || 0.06061,
    tariffPower: baseAssumptions.tariffPower || 17.573,
    peakKW,
  };
  const runScenario = createSimplifiedScenarioRunner(siteScenarioParams);

  // Use provided config or default
  const monteCarloConfig: MonteCarloConfig = config || {
    iterations: 500,
    variableRanges: {
      tariffEscalation: [0.025, 0.035],
      discountRate: [0.06, 0.08],
      solarYield: [1075, 1225],
      bifacialBoost: [0.10, 0.20],
      omPerKwc: [10, 20],
      solarCostPerW: [1.75, 2.35],
    },
  };

  const monteCarloResult = runMonteCarloAnalysis(baseAssumptions, runScenario, monteCarloConfig);

  // Return result with monteCarlo wrapper for frontend compatibility
  res.json({
    monteCarlo: monteCarloResult,
    baseAssumptions,
  });
}));

router.post("/:siteId/peak-shaving-analysis", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const { siteId } = req.params;
  const { peakDemandKW, batteryPowerKW, batteryEnergyKWh, tariffPower } = req.body;

  const site = await storage.getSite(siteId);
  if (!site) {
    throw new NotFoundError("Site");
  }

  const readings = await storage.getMeterReadingsBySite(siteId);
  if (readings.length === 0) {
    throw new BadRequestError("No meter data available for analysis");
  }

  const result = analyzePeakShaving(
    readings.map(r => ({ kW: r.kW || 0, kWh: r.kWh || 0, timestamp: new Date(r.timestamp) })) as any,
    {
      peakDemandKW,
      batteryPowerKW,
      batteryEnergyKWh,
      tariffPower: tariffPower || 14.48
    }
  );

  res.json(result);
}));

router.post("/:siteId/kit-recommendation", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const siteId = req.params.siteId;
  const options = req.body || {};

  const simulations = await storage.getSimulationRunsBySite(siteId);
  const latestSimulation = simulations.length > 0
    ? simulations.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      })[0]
    : null;
  if (!latestSimulation) {
    throw new BadRequestError("No analysis available. Run a potential analysis first to get optimal sizing.");
  }

  const optimalPvKW = latestSimulation.pvSizeKW || 0;
  const optimalBatteryKWh = latestSimulation.battEnergyKWh || 0;
  const optimalBatteryKW = latestSimulation.battPowerKW || 0;

  if (optimalPvKW === 0) {
    throw new BadRequestError("Invalid system size in analysis. Please re-run the potential analysis.");
  }

  const recommendation = recommendStandardKit(
    optimalPvKW,
    optimalBatteryKWh,
    optimalBatteryKW,
    {
      preferOversizing: options.preferOversizing !== false,
      maxOversizePercent: options.maxOversizePercent || 30,
      includeAlternative: options.includeAlternative !== false,
      customPricePerWatt: options.customPricePerWatt,
      customBatteryCapacityCost: options.customBatteryCapacityCost,
      customBatteryPowerCost: options.customBatteryPowerCost,
    }
  );

  res.json({
    success: true,
    siteId,
    simulationId: latestSimulation.id,
    recommendation,
  });
}));

router.get("/:siteId/construction-estimate", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const siteId = req.params.siteId;
  const site = await storage.getSite(siteId);
  if (!site) {
    throw new NotFoundError("Site");
  }

  const simulations = await storage.getSimulationRunsBySite(siteId);
  const latestSim = simulations.find(s => s.type === "SCENARIO") || simulations[0];

  const visits = await storage.getSiteVisitsBySite(siteId);
  const completedVisit = visits.find(v => v.status === "completed") || visits[0] || null;

  const pvSizeKW = latestSim?.pvSizeKW || 100;
  const batteryEnergyKWh = latestSim?.battEnergyKWh || 0;

  const estimate = estimateConstructionCost(pvSizeKW, batteryEnergyKWh, completedVisit);
  const visitCompleteness = getSiteVisitCompleteness(completedVisit);

  res.json({
    siteId,
    siteName: site.name,
    pvSizeKW,
    batteryEnergyKWh,
    siteVisitId: completedVisit?.id || null,
    siteVisitStatus: completedVisit?.status || "none",
    visitCompleteness,
    estimate,
  });
}));

router.get("/:siteId/price-breakdown", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const site = await storage.getSite(req.params.siteId);
  if (!site) {
    throw new NotFoundError("Site");
  }

  const simulations = await storage.getSimulationRunsBySite(site.id);
  const latestSim = simulations.length > 0
    ? simulations.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())[0]
    : null;

  let capacityKW = site.kbKwDc || 100;

  if (latestSim?.sensitivity) {
    const sens = latestSim.sensitivity as any;
    const bestNPV = sens.optimalScenarios?.bestNPV;
    if (bestNPV?.pvSizeKW) {
      capacityKW = bestNPV.pvSizeKW;
    }
  } else if (latestSim?.pvSizeKW) {
    capacityKW = latestSim.pvSizeKW;
  }

  const panelCount = site.kbPanelCount || Math.ceil(capacityKW * 1000 / 625);
  const capacityW = capacityKW * 1000;

  const { getTieredSolarCostPerW: getCostPerW, getSolarPricingTierLabel: getTierLabel } = await import("../analysis/potentialAnalysis");
  const costPerW = getCostPerW(capacityKW);
  const totalCost = Math.round(costPerW * capacityW);
  const totalPerW = costPerW;

  const categoryRatios: Record<string, number> = {
    racking: 0.18,
    panels: 0.28,
    inverters: 0.12,
    bos_electrical: 0.10,
    labor: 0.20,
    soft_costs: 0.07,
    permits: 0.05,
  };

  const breakdown: Record<string, { cost: number; perW: number }> = {};
  const categories = Object.entries(categoryRatios);
  let allocatedSum = 0;

  for (const [cat, ratio] of categories) {
    const catCost = Math.round(totalCost * ratio);
    breakdown[cat] = {
      cost: catCost,
      perW: Math.round((catCost / capacityW) * 100) / 100,
    };
    allocatedSum += catCost;
  }

  const roundingDelta = totalCost - allocatedSum;
  if (roundingDelta !== 0) {
    const largestCat = categories.reduce((a, b) => categoryRatios[a[0]] > categoryRatios[b[0]] ? a : b)[0];
    breakdown[largestCat].cost += roundingDelta;
    breakdown[largestCat].perW = Math.round((breakdown[largestCat].cost / capacityW) * 100) / 100;
  }

  res.json({
    siteId: site.id,
    siteName: site.name,
    capacityKW,
    panelCount,
    breakdown,
    totalCost,
    totalPerW,
    tierLabel: getTierLabel(capacityKW, 'fr'),
  });
}));

router.get("/:siteId/visits", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const visits = await storage.getSiteVisitsBySite(req.params.siteId);
  res.json(visits);
}));

router.get("/:siteId/photos", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const siteId = req.params.siteId;
  const photos = await storage.getSiteVisitPhotos(siteId);
  res.json(photos);
}));

router.get("/:siteId/design-agreement", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const agreement = await storage.getDesignAgreementBySite(req.params.siteId);
  if (!agreement) {
    throw new NotFoundError("Design agreement");
  }
  res.json(agreement);
}));

router.post("/:siteId/generate-design-agreement", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const { siteId } = req.params;

  const subtotal = 2500;
  const gst = 125;
  const qst = 249.375;
  const total = 2874.375;

  const quotedCosts = {
    subtotal,
    taxes: { gst, qst },
    total,
  };

  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 30);

  const agreement = await storage.createDesignAgreement({
    siteId,
    siteVisitId: null,
    status: "draft",
    quotedCosts,
    totalCad: total,
    currency: "CAD",
    paymentTerms: "100% payable à la signature — créditable intégralement sur votre contrat EPC",
    validUntil,
    quotedBy: req.userId,
    quotedAt: new Date(),
  });

  res.status(201).json(agreement);
}));

router.get("/:siteId/roof-polygons", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const { siteId } = req.params;
  const polygons = await storage.getRoofPolygons(siteId);
  res.json(polygons);
}));

const updateRoofPolygonSchema = z.object({
  label: z.string().nullable().optional(),
  coordinates: z.array(z.array(z.number())).optional(),
  areaSqM: z.number().positive().optional(),
  color: z.string().optional(),
}).strict();

router.post("/:siteId/roof-polygons", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const { siteId } = req.params;
  const validationResult = insertRoofPolygonSchema.safeParse({
    ...req.body,
    siteId,
    createdBy: req.userId,
  });

  if (!validationResult.success) {
    throw new BadRequestError("Invalid polygon data");
  }

  const polygon = await storage.createRoofPolygon(validationResult.data);

  if (!req.body.label || !req.body.label.toLowerCase().includes('constraint')) {
    await storage.updateSite(siteId, {
      roofAreaValidated: true,
      roofAreaValidatedAt: new Date(),
      roofAreaValidatedBy: req.userId,
    });

    const updatedSite = await storage.getSite(siteId);
    if (updatedSite?.readyForAnalysis) {
      try {
        const { runAutoAnalysisForSite } = await import("./siteAnalysisHelpers");
        await runAutoAnalysisForSite(siteId);
      } catch (err: any) {
        console.warn(`Auto-analysis after roof validation failed for site ${siteId}: ${err.message}`);
      }
    }
  }

  autoAdvanceStage(siteId).catch(err => log.error(`Auto-advance failed for site ${siteId}:`, err));

  res.status(201).json(polygon);
}));

router.delete("/:siteId/roof-polygons", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const { siteId } = req.params;
  const deletedCount = await storage.deleteRoofPolygonsBySite(siteId);
  res.status(200).json({ success: true, deleted: deletedCount });
}));

const standaloneRoofPolygonUpdateSchema = z.object({
  label: z.string().nullable().optional(),
  coordinates: z.array(z.array(z.number())).optional(),
  areaSqM: z.number().positive().optional(),
  color: z.string().optional(),
}).strict();

router.put("/roof-polygons/:id", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const existing = await storage.getRoofPolygon(id);
  if (!existing) {
    throw new NotFoundError("Roof polygon");
  }

  const validationResult = standaloneRoofPolygonUpdateSchema.safeParse(req.body);
  if (!validationResult.success) {
    throw new BadRequestError("Invalid update data");
  }

  const polygon = await storage.updateRoofPolygon(id, validationResult.data);
  res.json(polygon);
}));

router.delete("/roof-polygons/:id", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const existing = await storage.getRoofPolygon(id);
  if (!existing) {
    throw new NotFoundError("Roof polygon");
  }

  await storage.deleteRoofPolygon(id);
  res.status(204).send();
}));

router.get("/:siteId/project-info-sheet", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const { siteId } = req.params;
  const lang = (req.query.lang as string) === "en" ? "en" : "fr";

  const site = await storage.getSite(siteId);
  if (!site) {
    throw new NotFoundError("Site");
  }

  const roofPolygons = await storage.getRoofPolygons(siteId);

  const { generateProjectInfoSheetPDF, fetchRoofImageBuffer } = await import("../projectInfoSheetPdf");

  let roofImageBuffer: Buffer | null = null;
  if (site.latitude && site.longitude) {
    const polygonData = roofPolygons.map((p) => ({
      coordinates: p.coordinates as [number, number][],
      color: p.color || "#3b82f6",
      label: p.label || undefined,
    }));
    roofImageBuffer = await fetchRoofImageBuffer(
      site.latitude,
      site.longitude,
      polygonData.length > 0 ? polygonData : undefined,
      site.roofVisualizationImageUrl || null
    );
  }

  const solarPolygons = roofPolygons.filter(p => {
    const isConstraint = p.label?.toLowerCase().includes("contrainte") ||
                        p.label?.toLowerCase().includes("constraint") ||
                        p.color === "#f97316";
    return !isConstraint;
  });
  const calculatedRoofAreaSqM = solarPolygons.reduce((sum, p) => sum + (p.areaSqM || 0), 0);

  const pdfBuffer = await generateProjectInfoSheetPDF(
    {
      site: {
        name: site.name,
        address: site.address,
        city: site.city,
        province: site.province,
        postalCode: site.postalCode,
        latitude: site.latitude,
        longitude: site.longitude,
        kbKwDc: site.kbKwDc,
        buildingType: site.buildingType,
        roofType: site.roofType,
        roofAreaSqM: site.roofAreaSqM,
        notes: site.notes,
        ownerName: site.ownerName,
      },
      roofPolygons: roofPolygons.map((p) => ({
        coordinates: p.coordinates as [number, number][],
        color: p.color || "#3b82f6",
        label: p.label || undefined,
      })),
      roofImageBuffer: roofImageBuffer || undefined,
      calculatedRoofAreaSqM: calculatedRoofAreaSqM > 0 ? calculatedRoofAreaSqM : undefined,
    },
    lang
  );

  const safeName = site.name.replace(/[^a-zA-Z0-9-_]/g, "_");
  const filename = `Project_Info_Sheet_${safeName}_${lang.toUpperCase()}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", pdfBuffer.length);
  res.send(pdfBuffer);
}));

// Archive a site
router.post("/:id/archive", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const siteId = req.params.id;

  const site = await storage.getSite(siteId);
  if (!site) {
    throw new NotFoundError("Site");
  }

  // Archive the site
  const updatedSite = await storage.updateSite(siteId, {
    isArchived: true,
    archivedAt: new Date(),
  });

  res.json(updatedSite);
}));

// Unarchive a site
router.post("/:id/unarchive", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const siteId = req.params.id;

  const site = await storage.getSite(siteId);
  if (!site) {
    throw new NotFoundError("Site");
  }

  const updatedSite = await storage.updateSite(siteId, {
    isArchived: false,
    archivedAt: null,
  });

  res.json(updatedSite);
}));

// ==================== SYNTHETIC PROFILE ====================

const BUILDING_TYPE_LABELS: Record<string, string> = {
  office: "Bureau",
  warehouse: "Entrepôt",
  cold_warehouse: "Entrepôt réfrigéré",
  retail: "Commerce",
  industrial: "Industriel",
  institutional: "Institutionnel",
};

const syntheticProfileSchema = z.object({
  buildingSubType: z.enum(["office", "warehouse", "cold_warehouse", "retail", "industrial", "institutional"]),
  annualConsumptionKWh: z.number().positive().optional(),
  monthlyBill: z.number().positive().optional(),
  tariffCode: z.enum(["G", "M", "L"]).optional(),
  buildingSqFt: z.number().positive().optional(),
  operatingSchedule: z.enum(["standard", "extended", "24/7"]).optional(),
});

router.post("/:siteId/generate-synthetic-profile", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const { siteId } = req.params;

  const site = await storage.getSite(siteId);
  if (!site) {
    throw new NotFoundError("Site");
  }

  const parsed = syntheticProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new BadRequestError("Invalid parameters: " + parsed.error.message);
  }

  const { buildingSubType, operatingSchedule, monthlyBill, tariffCode, buildingSqFt } = parsed.data;

  // Determine annual consumption: direct value > bill estimate > area estimate > fallback
  const annualConsumptionKWh = parsed.data.annualConsumptionKWh || estimateAnnualConsumption({
    monthlyBill,
    tariffCode: tariffCode as 'G' | 'M' | 'L' | undefined,
    buildingSqFt: buildingSqFt || site.buildingSqFt || undefined,
    buildingSubType,
  });

  log.info(`Generating synthetic profile for site ${siteId}: ${buildingSubType}, ${annualConsumptionKWh} kWh/yr`);

  const result = generateSyntheticProfile({
    buildingSubType: buildingSubType as BuildingSubType,
    annualConsumptionKWh,
    operatingSchedule: (operatingSchedule as OperatingSchedule) || 'standard',
  });

  const label = BUILDING_TYPE_LABELS[buildingSubType] || buildingSubType;

  // Create the meter file entry
  const meterFile = await storage.createMeterFile({
    siteId,
    fileName: `Profil synthétique - ${label}`,
    granularity: "HOUR",
    periodStart: result.readings[0].timestamp,
    periodEnd: result.readings[result.readings.length - 1].timestamp,
    isSynthetic: true,
    syntheticParams: {
      buildingSubType,
      annualConsumptionKWh,
      operatingSchedule: operatingSchedule || 'standard',
      generatedAt: new Date().toISOString(),
    },
  });

  // Update status to PARSED since we're creating readings directly
  await storage.updateMeterFile(meterFile.id, { status: "PARSED" });

  // Create meter readings (8760 entries)
  const readings = result.readings.map(r => ({
    meterFileId: meterFile.id,
    timestamp: r.timestamp,
    granularity: "HOUR" as const,
    kWh: r.kWh,
    kW: r.kW,
  }));

  await storage.createMeterReadings(readings);

  log.info(`Synthetic profile created: ${readings.length} readings, peak ${result.metadata.estimatedPeakKW} kW`);

  autoAdvanceStage(siteId).catch(err => log.error(`Auto-advance failed for site ${siteId}:`, err));

  res.json({
    meterFile: { ...meterFile, status: "PARSED" },
    metadata: result.metadata,
    readingsCount: readings.length,
  });
}));

// ==================== COMPANY WEBSITE ANALYSIS ====================

router.post("/:siteId/analyze-company-website", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const { siteId } = req.params;

  const site = await storage.getSite(siteId);
  if (!site) {
    throw new NotFoundError("Site");
  }

  const { url } = req.body;
  const websiteUrl = url || (site as any).client?.website;

  if (!websiteUrl || typeof websiteUrl !== 'string') {
    throw new BadRequestError("No website URL provided");
  }

  // Validate URL format
  try {
    new URL(websiteUrl);
  } catch {
    throw new BadRequestError("Invalid URL format");
  }

  const { analyzeCompanyWebsite } = await import("../analysis/companyWebAnalyzer");
  const result = await analyzeCompanyWebsite(websiteUrl);

  res.json(result);
}));

router.get("/:siteId/opportunities", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  await autoAdvanceStage(req.params.siteId).catch(err => log.error(`Auto-advance check failed:`, err));
  const opportunities = await storage.getOpportunitiesBySiteId(req.params.siteId);
  res.json(opportunities);
}));

// ==================== HQ PROCURATION ====================

const sendHqProcurationSchema = z.object({
  language: z.enum(["fr", "en"]).default("fr"),
});

router.post("/:siteId/send-hq-procuration", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const { siteId } = req.params;
  const parseResult = sendHqProcurationSchema.safeParse(req.body);
  if (!parseResult.success) {
    throw new ValidationError("Validation error", parseResult.error.errors);
  }
  const { language } = parseResult.data;

  const site = await storage.getSite(siteId);
  if (!site) throw new NotFoundError("Site");

  const client = await storage.getClient(site.clientId);
  if (!client) throw new NotFoundError("Client");

  if (!client.email) {
    throw new BadRequestError(
      language === 'fr' ? "Le client de ce site n'a pas d'adresse courriel" : "This site's client has no email address"
    );
  }

  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const host = req.get('host') || 'localhost:5000';
  const baseUrl = `${protocol}://${host}`;

  const emailResult = await sendHqProcurationEmail(
    client.email,
    client.name,
    language,
    baseUrl,
    client.id
  );

  if (!emailResult.success) {
    throw new BadRequestError(
      language === 'fr' ? "L'envoi du courriel a échoué." : "Email delivery failed."
    );
  }

  res.json({ success: true });
}));

router.get("/:id/copy-roof-from-address", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const currentSite = await storage.getSite(req.params.id);
  if (!currentSite) {
    throw new NotFoundError("Site");
  }

  if (!currentSite.address) {
    res.json({ copied: false });
    return;
  }

  const existingPolygons = await storage.getRoofPolygons(req.params.id);
  if (existingPolygons.length > 0) {
    res.json({ copied: false });
    return;
  }

  const siblingPolygons = await db.select({
    polygonId: roofPolygonsTable.id,
    siteId: roofPolygonsTable.siteId,
    label: roofPolygonsTable.label,
    coordinates: roofPolygonsTable.coordinates,
    areaSqM: roofPolygonsTable.areaSqM,
    color: roofPolygonsTable.color,
    orientation: roofPolygonsTable.orientation,
    tiltDegrees: roofPolygonsTable.tiltDegrees,
  })
    .from(roofPolygonsTable)
    .innerJoin(sitesTable, eq(roofPolygonsTable.siteId, sitesTable.id))
    .where(
      and(
        eq(sitesTable.address, currentSite.address),
        ne(sitesTable.id, req.params.id)
      )
    )
    .orderBy(desc(sitesTable.updatedAt));

  if (siblingPolygons.length === 0) {
    if (req.query.preview === "true") {
      res.json({ available: false });
    } else {
      res.json({ copied: false });
    }
    return;
  }

  const sourceSiteId = siblingPolygons[0].siteId;

  const sourcePolygons = siblingPolygons.filter(p => p.siteId === sourceSiteId);

  // Preview mode: return info without creating polygons
  if (req.query.preview === "true") {
    const sourceSite = await storage.getSite(sourceSiteId);
    const totalAreaSqM = sourcePolygons.reduce((sum, p) => sum + (p.areaSqM || 0), 0);
    res.json({
      available: true,
      sourceId: sourceSiteId,
      sourceName: sourceSite?.name || sourceSiteId,
      polygonCount: sourcePolygons.length,
      totalAreaSqM: Math.round(totalAreaSqM),
    });
    return;
  }

  for (const polygon of sourcePolygons) {
    await storage.createRoofPolygon({
      siteId: req.params.id,
      label: polygon.label,
      coordinates: polygon.coordinates,
      areaSqM: polygon.areaSqM,
      color: polygon.color || undefined,
      orientation: polygon.orientation || undefined,
      tiltDegrees: polygon.tiltDegrees || undefined,
    });
  }

  // kbKwDc and kbPanelCount are NOT copied — RoofVisualization recalculates them
  // automatically via onGeometryCalculated when the user opens the page.

  log.info(`Copied ${sourcePolygons.length} roof polygons from site ${sourceSiteId} to site ${req.params.id} (same address: "${currentSite.address}")`);

  res.json({
    copied: true,
    sourceId: sourceSiteId,
    polygonCount: sourcePolygons.length,
  });
}));

// ========================================
// PHASE 1 — Close the Loop: Budget, Baseline, Reconciliation
// ========================================

// --- BUDGET CRUD ---

router.get("/:siteId/budgets", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const site = await storage.getSite(req.params.siteId);
  if (!site) throw new NotFoundError("Site");

  const budgets = await storage.getProjectBudgets(req.params.siteId);

  // Summary calculations
  const summary = {
    totalOriginal: 0,
    totalRevised: 0,
    totalCommitted: 0,
    totalActual: 0,
    variance: 0,
    percentOfRevised: 0,
  };

  for (const b of budgets) {
    summary.totalOriginal += b.originalAmount || 0;
    summary.totalRevised += b.revisedAmount || 0;
    summary.totalCommitted += b.committedAmount || 0;
    summary.totalActual += b.actualAmount || 0;
  }
  summary.variance = summary.totalActual - summary.totalRevised;
  summary.percentOfRevised = summary.totalRevised > 0
    ? Math.round((summary.totalActual / summary.totalRevised) * 100)
    : 0;

  // Map field names for frontend compatibility
  const mappedBudgets = budgets.map(b => ({
    id: b.id,
    siteId: b.siteId,
    category: b.category,
    description: b.description,
    original: b.originalAmount || 0,
    revised: b.revisedAmount || 0,
    committed: b.committedAmount || 0,
    actual: b.actualAmount || 0,
    notes: b.notes,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  }));

  res.json({ siteId: req.params.siteId, budgets: mappedBudgets, summary });
}));

router.post("/:siteId/budgets", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const site = await storage.getSite(req.params.siteId);
  if (!site) throw new NotFoundError("Site");

  const data = insertProjectBudgetSchema.parse({
    ...req.body,
    siteId: req.params.siteId,
  });

  const budget = await storage.createProjectBudget(data);
  res.status(201).json(budget);
}));

// Auto-initialize budget from price breakdown + construction agreement
router.post("/:siteId/budgets/initialize", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const site = await storage.getSite(req.params.siteId);
  if (!site) throw new NotFoundError("Site");

  // Check if already initialized
  const existing = await storage.getProjectBudgets(req.params.siteId);
  if (existing.length > 0) {
    throw new ConflictError("Budget already initialized. Delete existing items first.");
  }

  // Get price breakdown for "original" amounts
  const simulations = await storage.getSimulationRunsBySite(site.id);
  const latestSim = simulations.length > 0
    ? simulations.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())[0]
    : null;

  let capacityKW = site.kbKwDc || 100;
  if (latestSim?.pvSizeKW) capacityKW = latestSim.pvSizeKW;

  const { getTieredSolarCostPerW } = await import("../analysis/potentialAnalysis");
  const costPerW = getTieredSolarCostPerW(capacityKW);
  const totalCost = Math.round(costPerW * capacityKW * 1000);

  const categoryRatios: Record<string, number> = {
    racking: 0.18, panels: 0.28, inverters: 0.12, bos_electrical: 0.10,
    labor: 0.20, soft_costs: 0.07, permits: 0.05,
  };

  const createdBudgets = [];
  for (const cat of BUDGET_CATEGORIES) {
    const ratio = categoryRatios[cat.key] || 0;
    const originalAmount = Math.round(totalCost * ratio);

    const budget = await storage.createProjectBudget({
      siteId: req.params.siteId,
      category: cat.key,
      description: cat.labelFr,
      originalAmount,
      revisedAmount: originalAmount,
      committedAmount: 0,
      actualAmount: 0,
    });
    createdBudgets.push(budget);
  }

  log.info(`Initialized ${createdBudgets.length} budget items for site ${req.params.siteId} (total: $${totalCost})`);
  res.status(201).json({ budgets: createdBudgets, totalEstimate: totalCost });
}));

router.put("/:siteId/budgets/:budgetId", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  // Map short field names from frontend to DB column names
  const fieldMap: Record<string, string> = {
    original: "originalAmount",
    revised: "revisedAmount",
    committed: "committedAmount",
    actual: "actualAmount",
  };
  const mapped: Record<string, any> = {};
  for (const [key, value] of Object.entries(req.body)) {
    mapped[fieldMap[key] || key] = value;
  }
  const updated = await storage.updateProjectBudget(req.params.budgetId, mapped);
  if (!updated) throw new NotFoundError("Budget item");
  res.json(updated);
}));

router.delete("/:siteId/budgets/:budgetId", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const deleted = await storage.deleteProjectBudget(req.params.budgetId);
  if (!deleted) throw new NotFoundError("Budget item");
  res.json({ success: true });
}));

// --- BASELINE ---

router.post("/:siteId/baseline/snapshot", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const site = await storage.getSite(req.params.siteId);
  if (!site) throw new NotFoundError("Site");

  // Extract baseline from HQ consumption history
  const history = (site.hqConsumptionHistory as any[]) || [];
  if (history.length === 0) {
    throw new BadRequestError("No HQ consumption history available to create baseline. Upload a bill first.");
  }

  // Take the most recent 12 entries as baseline
  const sorted = [...history].sort((a: any, b: any) => {
    const dateA = a.period || a.date || "";
    const dateB = b.period || b.date || "";
    return dateB.localeCompare(dateA);
  });

  const last12 = sorted.slice(0, 12);
  const monthlyProfile = last12.map((entry: any, idx: number) => ({
    month: idx + 1,
    kWh: entry.kWh || entry.kwh || 0,
    cost: entry.amount || entry.cost || 0,
    period: entry.period || entry.date || "",
  }));

  const annualKwh = monthlyProfile.reduce((sum: number, m: any) => sum + (m.kWh || 0), 0);
  const annualCost = monthlyProfile.reduce((sum: number, m: any) => sum + (m.cost || 0), 0);
  const peakDemand = Math.max(...history.map((e: any) => e.kW || e.kw || 0), 0);

  await storage.updateSite(req.params.siteId, {
    baselineSnapshotDate: new Date(),
    baselineAnnualConsumptionKwh: annualKwh,
    baselineAnnualCostCad: annualCost,
    baselinePeakDemandKw: peakDemand || null,
    baselineMonthlyProfile: monthlyProfile,
  });

  log.info(`Baseline snapshot captured for site ${req.params.siteId}: ${annualKwh} kWh/yr, $${annualCost}/yr`);

  res.json({
    baselineSnapshotDate: new Date(),
    baselineAnnualConsumptionKwh: annualKwh,
    baselineAnnualCostCad: annualCost,
    baselinePeakDemandKw: peakDemand || null,
    baselineMonthlyProfile: monthlyProfile,
  });
}));

router.get("/:siteId/baseline", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const site = await storage.getSite(req.params.siteId);
  if (!site) throw new NotFoundError("Site");

  if (!site.baselineSnapshotDate) {
    return res.json({ hasBaseline: false });
  }

  res.json({
    hasBaseline: true,
    baselineSnapshotDate: site.baselineSnapshotDate,
    baselineAnnualConsumptionKwh: site.baselineAnnualConsumptionKwh,
    baselineAnnualCostCad: site.baselineAnnualCostCad,
    baselinePeakDemandKw: site.baselinePeakDemandKw,
    baselineMonthlyProfile: site.baselineMonthlyProfile,
    operationsStartDate: site.operationsStartDate,
  });
}));

router.put("/:siteId/baseline", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const site = await storage.getSite(req.params.siteId);
  if (!site) throw new NotFoundError("Site");

  const { baselineAnnualConsumptionKwh, baselineAnnualCostCad, baselinePeakDemandKw, baselineMonthlyProfile, operationsStartDate } = req.body;

  await storage.updateSite(req.params.siteId, {
    ...(baselineAnnualConsumptionKwh !== undefined && { baselineAnnualConsumptionKwh }),
    ...(baselineAnnualCostCad !== undefined && { baselineAnnualCostCad }),
    ...(baselinePeakDemandKw !== undefined && { baselinePeakDemandKw }),
    ...(baselineMonthlyProfile !== undefined && { baselineMonthlyProfile }),
    ...(operationsStartDate !== undefined && { operationsStartDate: new Date(operationsStartDate) }),
  });

  res.json({ success: true });
}));

// --- RECONCILIATION ---

router.get("/:siteId/reconciliation", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const site = await storage.getSite(req.params.siteId);
  if (!site) throw new NotFoundError("Site");

  if (!site.baselineMonthlyProfile || !site.operationsStartDate) {
    return res.json({
      hasData: false,
      message: "Baseline or operations start date not set.",
      months: [],
      summary: { totalHistoricalKwh: 0, totalPredictedSavingsKwh: 0, totalActualKwh: 0, totalSavingsKwh: 0, achievementPercent: 0, costSavings: 0 },
    });
  }

  // Get latest simulation for predicted production
  const simulations = await storage.getSimulationRunsBySite(site.id);
  const latestSim = simulations.length > 0
    ? simulations.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())[0]
    : null;

  const annualProductionKwh = latestSim?.totalProductionKWh || latestSim?.annualEnergySavingsKWh || 0;
  const monthlyPredictedSavings = annualProductionKwh / 12;

  // Get meter readings for post-installation period
  const meterReadings = await storage.getMeterReadingsBySite(site.id);

  const baselineProfile = (site.baselineMonthlyProfile as any[]) || [];
  const opsStart = new Date(site.operationsStartDate);
  const now = new Date();

  const months: any[] = [];
  let totalHistoricalKwh = 0;
  let totalPredictedSavingsKwh = 0;
  let totalActualKwh = 0;

  // Iterate month by month from operations start to now
  const cursor = new Date(opsStart.getFullYear(), opsStart.getMonth(), 1);
  while (cursor <= now) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth(); // 0-indexed

    // Historical: from baseline monthly profile (use month index to map)
    const baselineEntry = baselineProfile[month % baselineProfile.length] || { kWh: 0, cost: 0 };
    const historical = baselineEntry.kWh || baselineEntry.kwh || 0;

    // Predicted savings: from simulation (monthly average)
    const predicted = monthlyPredictedSavings;

    // Actual consumption: aggregate meter readings for this month
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 1);
    const monthReadings = meterReadings.filter(r => {
      const ts = new Date(r.timestamp!);
      return ts >= monthStart && ts < monthEnd;
    });
    const actualConsumption = monthReadings.reduce((sum, r) => sum + (r.kWh || 0), 0);

    // Savings = historical - actual (positive = saving energy)
    const savings = historical - actualConsumption;
    const achievementPercent = predicted > 0 ? Math.round((savings / predicted) * 100) : 0;

    const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

    months.push({
      year,
      month: month + 1, // 1-indexed for display
      label: `${monthNames[month]} ${year}`,
      historicalKwh: Math.round(historical),
      predictedSavingsKwh: Math.round(predicted),
      actualConsumptionKwh: Math.round(actualConsumption),
      savingsKwh: Math.round(savings),
      achievementPercent,
    });

    totalHistoricalKwh += historical;
    totalPredictedSavingsKwh += predicted;
    totalActualKwh += actualConsumption;

    cursor.setMonth(cursor.getMonth() + 1);
  }

  const totalSavingsKwh = totalHistoricalKwh - totalActualKwh;
  const overallAchievement = totalPredictedSavingsKwh > 0
    ? Math.round((totalSavingsKwh / totalPredictedSavingsKwh) * 100)
    : 0;

  // Estimate cost savings using average energy rate
  const energyRate = 0.06061; // Default M tariff
  const costSavings = Math.round(totalSavingsKwh * energyRate);

  res.json({
    hasData: true,
    months,
    summary: {
      totalHistoricalKwh: Math.round(totalHistoricalKwh),
      totalPredictedSavingsKwh: Math.round(totalPredictedSavingsKwh),
      totalActualKwh: Math.round(totalActualKwh),
      totalSavingsKwh: Math.round(totalSavingsKwh),
      achievementPercent: overallAchievement,
      costSavings,
    },
  });
}));

export default router;
