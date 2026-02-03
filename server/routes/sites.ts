import { Router, Request, Response } from "express";
import { z } from "zod";
import multer from "multer";
import fs from "fs";
import path from "path";
import { authMiddleware, requireStaff, AuthRequest } from "../middleware/auth";
import { storage } from "../storage";
import * as googleSolar from "../googleSolarService";
import {
  insertSiteSchema,
  insertMeterFileSchema,
  insertMeterReadingSchema,
  insertSimulationRunSchema,
  insertRoofPolygonSchema,
  defaultAnalysisAssumptions,
  type AnalysisAssumptions,
} from "@shared/schema";
import {
  runMonteCarloAnalysis,
  createSimplifiedScenarioRunner,
  analyzePeakShaving,
  recommendStandardKit,
  STANDARD_KITS,
  type MonteCarloConfig,
  type SiteScenarioParams,
} from "../analysis";
import { estimateConstructionCost, getSiteVisitCompleteness } from "../pricing-engine";

const router = Router();

const upload = multer({ dest: "/tmp/meter-uploads/" });

// FIX: In-memory lock to prevent concurrent roof estimations for the same site
// Note: For multi-instance deployments, use database-level locking (e.g., pg_advisory_lock)
const roofEstimationLocks = new Set<string>();

async function triggerRoofEstimation(siteId: string): Promise<void> {
  // Prevent concurrent estimations for the same site
  if (roofEstimationLocks.has(siteId)) {
    console.log(`Roof estimation already in progress for site ${siteId}, skipping`);
    return;
  }
  
  roofEstimationLocks.add(siteId);
  
  try {
    const site = await storage.getSite(siteId);
    if (!site) {
      console.error(`Roof estimation: Site ${siteId} not found`);
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
      console.log(`Roof estimation failed for site ${siteId}: ${result.error}`);
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

    console.log(`Roof estimation success for site ${siteId}: ${result.roofAreaSqM.toFixed(1)} m²`);
    
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
        console.log(`Roof color analysis for site ${siteId}: ${colorResult.colorType} (confidence: ${(colorResult.confidence * 100).toFixed(0)}%, suggest bifacial: ${colorResult.suggestBifacial})`);
      }
    } catch (colorError) {
      console.error(`Roof color analysis failed for site ${siteId}:`, colorError);
    }
  } catch (error) {
    console.error(`Roof estimation error for site ${siteId}:`, error);
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

router.get("/list", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { limit, offset, search, clientId, includeArchived } = req.query;
    const showArchived = includeArchived === "true";
    
    let sites = await storage.getSites();
    
    // Filter by role
    const filtered = req.userRole === "admin" || req.userRole === "analyst"
      ? sites
      : sites.filter(s => s.clientId && s.clientId === req.userId);
    
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
        hasSimulation: (s.simulationRuns?.length || 0) > 0,
        hasDesignAgreement: false,
        isArchived: s.isArchived
      })),
      total
    });
  } catch (error) {
    console.error("Error fetching sites list:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.query;
    let sites;
    if (clientId && typeof clientId === "string") {
      sites = await storage.getSitesByClient(clientId);
    } else {
      sites = await storage.getSites();
    }
    if (req.userRole !== "admin" && req.userRole !== "analyst") {
      sites = sites.filter(s => s.clientId && s.clientId === req.userId);
    }
    res.json(sites);
  } catch (error) {
    console.error("Error fetching sites:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/minimal", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const sites = await storage.getSitesMinimal();
    if (req.userRole !== "admin" && req.userRole !== "analyst") {
      const filtered = sites.filter(s => s.clientId === req.userId);
      res.json(filtered);
    } else {
      res.json(sites);
    }
  } catch (error) {
    console.error("Error fetching minimal sites:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const site = await storage.getSite(req.params.id);
    if (!site) {
      return res.status(404).json({ error: "Site not found" });
    }
    if (req.userRole !== "admin" && req.userRole !== "analyst" && site.clientId !== req.userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(site);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const parsed = insertSiteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors });
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
  } catch (error) {
    console.error("Error creating site:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", authMiddleware, requireStaff, async (req, res) => {
  try {
    const existingSite = await storage.getSite(req.params.id);
    if (!existingSite) {
      return res.status(404).json({ error: "Site not found" });
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
      console.log(`Site ${req.params.id}: Owner changed from "${existingSite.ownerName}" to "${updateData.ownerName}"`);
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
      return res.status(404).json({ error: "Site not found" });
    }

    if ((addressChanged || coordsChanged) && site.roofEstimateStatus === "pending") {
      triggerRoofEstimation(site.id);
    }

    res.json(site);
  } catch (error) {
    console.error("Error updating site:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", authMiddleware, requireStaff, async (req, res) => {
  try {
    const siteId = req.params.id;
    
    // Check if site exists
    const site = await storage.getSite(siteId);
    if (!site) {
      return res.status(404).json({ error: "Site not found" });
    }
    
    // Check for related records that would prevent deletion
    const simulations = await storage.getSimulationRunsBySite(siteId);
    if (simulations.length > 0) {
      return res.status(409).json({ 
        error: `Cannot delete site with ${simulations.length} analysis(es). Please delete them first.`,
        relatedRecords: { simulations: simulations.length }
      });
    }
    
    const siteVisits = await storage.getSiteVisitsBySite(siteId);
    if (siteVisits.length > 0) {
      return res.status(409).json({ 
        error: `Cannot delete site with ${siteVisits.length} site visit(s). Please delete them first.`,
        relatedRecords: { siteVisits: siteVisits.length }
      });
    }
    
    const deleted = await storage.deleteSite(siteId);
    if (!deleted) {
      return res.status(500).json({ error: "Failed to delete site" });
    }
    res.status(204).send();
  } catch (error) {
    console.error("[Site Delete] Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/reset-roof-status", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const site = await storage.getSite(req.params.id);
    if (!site) {
      return res.status(404).json({ error: "Site not found" });
    }

    await storage.updateSite(req.params.id, {
      roofEstimateStatus: "pending",
      roofEstimatePendingAt: new Date(),
      roofEstimateError: null
    });

    triggerRoofEstimation(req.params.id);

    const updatedSite = await storage.getSite(req.params.id);
    res.json(updatedSite);
  } catch (error) {
    console.error("Error resetting roof status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/geocode", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const site = await storage.getSite(req.params.id);
    if (!site) {
      return res.status(404).json({ error: "Site not found" });
    }

    const fullAddress = [
      site.address,
      site.city,
      site.province,
      site.postalCode,
      "Canada"
    ].filter(Boolean).join(", ");

    if (!fullAddress || fullAddress === "Canada") {
      return res.status(400).json({ error: "No address provided for geocoding" });
    }

    const result = await googleSolar.geocodeAddress(fullAddress);
    if (!result.success) {
      return res.status(400).json({ error: result.error || "Geocoding failed" });
    }

    await storage.updateSite(site.id, {
      latitude: result.latitude,
      longitude: result.longitude
    });

    const updatedSite = await storage.getSite(site.id);
    res.json(updatedSite);
  } catch (error) {
    console.error("Error geocoding:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/roof-estimate", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const site = await storage.getSite(req.params.id);
    if (!site) {
      return res.status(404).json({ error: "Site not found" });
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
        return res.status(400).json({ error: "No address or coordinates provided" });
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
      return res.status(400).json({ 
        error: result.error || "Could not estimate roof area",
        latitude: result.latitude,
        longitude: result.longitude
      });
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
  } catch (error) {
    console.error("Error estimating roof:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id/roof-imagery", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const site = await storage.getSite(req.params.id);
    if (!site) {
      return res.status(404).json({ error: "Site not found" });
    }

    if (!site.latitude || !site.longitude) {
      return res.status(400).json({ error: "Site has no coordinates" });
    }

    const zoom = parseInt(req.query.zoom as string) || 20;
    const width = parseInt(req.query.width as string) || 600;
    const height = parseInt(req.query.height as string) || 400;

    const result = await googleSolar.getRoofImagery({
      latitude: site.latitude,
      longitude: site.longitude,
      zoom,
      width,
      height
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error || "Could not get imagery" });
    }

    res.json({
      imageUrl: result.imageUrl,
      satelliteUrl: result.satelliteUrl,
      latitude: site.latitude,
      longitude: site.longitude
    });
  } catch (error) {
    console.error("Error getting roof imagery:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id/solar-mockup", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const site = await storage.getSite(req.params.id);
    if (!site) {
      return res.status(404).json({ error: "Site not found" });
    }

    if (!site.latitude || !site.longitude) {
      return res.status(400).json({ error: "Site has no coordinates" });
    }

    const panelCount = parseInt(req.query.panelCount as string) || 0;

    const result = await googleSolar.getSolarMockup({
      latitude: site.latitude,
      longitude: site.longitude,
      panelCount
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error || "Could not generate mockup" });
    }

    res.json({
      mockupUrl: result.mockupUrl,
      baseImageUrl: result.baseImageUrl,
      panelCount: result.panelCount,
      estimatedKW: result.estimatedKW
    });
  } catch (error) {
    console.error("Error generating mockup:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/bifacial-response", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const site = await storage.getSite(req.params.id);
    if (!site) {
      return res.status(404).json({ error: "Site not found" });
    }

    const { response } = req.body;
    if (response !== "yes" && response !== "no") {
      return res.status(400).json({ error: "Invalid response. Must be 'yes' or 'no'" });
    }

    const bifacialEnabled = response === "yes";
    await storage.updateSite(site.id, {
      bifacialEnabled,
      bifacialConfirmedAt: new Date(),
      bifacialConfirmedBy: req.userId
    });

    const updatedSite = await storage.getSite(site.id);
    res.json(updatedSite);
  } catch (error) {
    console.error("Error saving bifacial response:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/suggest-constraints", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const site = await storage.getSite(req.params.id);
    if (!site) {
      return res.status(404).json({ error: "Site not found" });
    }

    if (!site.latitude || !site.longitude) {
      return res.status(400).json({ error: "Site has no coordinates for constraint detection" });
    }

    const existingPolygons = await storage.getRoofPolygons(site.id);

    const result = await googleSolar.suggestConstraints({
      latitude: site.latitude,
      longitude: site.longitude,
      existingPolygons: existingPolygons.map(p => ({
        coordinates: p.coordinates as [number, number][],
        label: p.label || undefined,
        color: p.color || undefined
      }))
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error || "Could not analyze constraints" });
    }

    res.json({
      suggestedConstraints: result.suggestedConstraints,
      analysisNotes: result.analysisNotes
    });
  } catch (error) {
    console.error("Error suggesting constraints:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:siteId/upload-meters", authMiddleware, requireStaff, upload.array("files"), async (req: AuthRequest, res) => {
  try {
    const { siteId } = req.params;
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const site = await storage.getSite(siteId);
    if (!site) {
      return res.status(404).json({ error: "Site not found" });
    }

    const results = [];
    for (const file of files) {
      const meterFile = await storage.createMeterFile({
        siteId,
        filename: file.originalname,
        mimeType: file.mimetype,
        filePath: file.path,
        uploadedBy: req.userId!,
        status: "processing"
      });

      const granularity = file.originalname.toLowerCase().includes("15min") ? "15MIN" : "HOUR";
      
      const { parseHydroQuebecCSV } = await import("./siteAnalysisHelpers");
      const readings = await parseHydroQuebecCSV(file.path, meterFile.id, granularity);
      
      if (readings.length > 0) {
        await storage.createMeterReadings(readings);
        await storage.updateMeterFile(meterFile.id, {
          status: "processed",
          recordCount: readings.length,
          dateRangeStart: readings[0].timestamp,
          dateRangeEnd: readings[readings.length - 1].timestamp
        });
      } else {
        await storage.updateMeterFile(meterFile.id, {
          status: "failed",
          errorMessage: "No valid readings found in file"
        });
      }

      const updatedFile = await storage.getMeterFile(meterFile.id);
      results.push(updatedFile);
      
      try {
        fs.unlinkSync(file.path);
      } catch (e) {
        console.error("Could not delete temp file:", file.path);
      }
    }

    res.json({ files: results });
  } catch (error) {
    console.error("Error uploading meters:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:siteId/quick-potential", authMiddleware, requireStaff, async (req, res) => {
  try {
    const { siteId } = req.params;
    const { constraintFactor = 0.10, assumptions } = req.body;

    const site = await storage.getSite(siteId);
    if (!site) {
      return res.status(404).json({ error: "Site not found" });
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
    const totalRoofAreaSqM = polygonAreaSqM > 0 
      ? polygonAreaSqM 
      : (site.roofAreaSqM || site.roofAreaAutoSqM || 0);
    
    if (totalRoofAreaSqM <= 0) {
      return res.status(400).json({ error: "No roof area available. Please draw roof areas first." });
    }

    // Import pricing functions
    const { getTieredSolarCostPerW, getSolarPricingTierLabel } = await import("../analysis/potentialAnalysis");
    
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
    
    // Resolve yield strategy respecting manual yield and bifacial settings
    // Use unified methodology: BASELINE_YIELD=1150 with loss factors = ~1035 kWh/kWp effective
    const BASELINE_YIELD = 1150;
    const tempCoeff = -0.004;
    const avgSummerTempDelta = 10; // Average summer temp above 25°C
    const tempLoss = 1 + (tempCoeff * avgSummerTempDelta); // ~0.96
    const wireLoss = 0.98; // 2% wire losses
    const inverterEff = 0.96; // 96% inverter efficiency
    
    // Check for manual yield override or bifacial bonus
    let baseYield = BASELINE_YIELD;
    let yieldSource: 'google' | 'manual' | 'default' = 'default';
    
    if (assumptions?.manualYield && assumptions.manualYield > 0) {
      baseYield = assumptions.manualYield;
      yieldSource = 'manual';
    }
    
    // Apply bifacial gain if enabled
    const bifacialEnabled = assumptions?.bifacialEnabled ?? site.bifacialAnalysisAccepted ?? false;
    const bifacialGain = bifacialEnabled ? 1.08 : 1.0; // 8% gain for bifacial
    
    const effectiveYield = Math.round(baseYield * tempLoss * wireLoss * inverterEff * bifacialGain);
    
    const yieldStrategy = {
      baseYield,
      effectiveYield,
      bifacialGain: bifacialEnabled ? 0.08 : 0,
      yieldSource,
      skipTempCorrection: false,
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
  } catch (error) {
    console.error("Error running quick potential analysis:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:siteId/save-visualization", authMiddleware, requireStaff, async (req, res) => {
  try {
    const { siteId } = req.params;
    const { imageDataUrl } = req.body;

    if (!imageDataUrl || !imageDataUrl.startsWith("data:image/")) {
      return res.status(400).json({ error: "Invalid image data" });
    }

    const site = await storage.getSite(siteId);
    if (!site) {
      return res.status(404).json({ error: "Site not found" });
    }

    await storage.updateSite(siteId, {
      roofVisualizationImageUrl: imageDataUrl
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error saving visualization:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:siteId/run-potential-analysis", authMiddleware, requireStaff, async (req, res) => {
  try {
    const { siteId } = req.params;
    const { assumptions, forcedSizing } = req.body;

    const site = await storage.getSite(siteId);
    if (!site) {
      return res.status(404).json({ error: "Site not found" });
    }

    const readings = await storage.getMeterReadingsBySite(siteId);
    if (readings.length === 0) {
      return res.status(400).json({ error: "No meter data available for analysis" });
    }

    const { deduplicateMeterReadingsByHour, runPotentialAnalysis, resolveYieldStrategy, getDefaultAnalysisAssumptions } = await import("./siteAnalysisHelpers");
    
    const dedupResult = deduplicateMeterReadingsByHour(readings.map(r => ({
      kWh: r.kWh,
      kW: r.kW,
      timestamp: new Date(r.timestamp),
      granularity: r.granularity || undefined
    })));

    const roofDetailsScenario = site.roofAreaAutoDetails as RoofAreaAutoDetails | null;
    
    // Build googleData object for resolveYieldStrategy
    const googleData = roofDetailsScenario?.yearlyEnergyDcKwh && site.kbKwDc
      ? {
          googleProductionEstimate: {
            yearlyEnergyAcKwh: roofDetailsScenario.yearlyEnergyDcKwh,
            systemSizeKw: site.kbKwDc
          }
        }
      : undefined;

    // Build base assumptions for yield strategy
    const baseAssumptions = {
      ...getDefaultAnalysisAssumptions(),
      ...assumptions,
      bifacialEnabled: assumptions?.bifacialEnabled ?? site.bifacialEnabled ?? false
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

    if (site.roofAreaSqM) {
      analysisAssumptions.roofAreaSqFt = site.roofAreaSqM * 10.764;
    }

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
      type: "SCENARIO",
      status: "completed",
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
      totalProductionKWh: result.pvSizeKW * (result.assumptions?.solarYieldKWhPerKWp || 1150),
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
      result: result,
      createdBy: (req as AuthRequest).userId || null
    });

    res.json({
      simulationId: simulation.id,
      ...result,
      yieldStrategy
    });
  } catch (error) {
    console.error("Error running potential analysis:", error);
    // Provide more specific error message to frontend
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: errorMessage });
  }
});

router.post("/:siteId/monte-carlo-analysis", authMiddleware, requireStaff, async (req, res) => {
  try {
    const { siteId } = req.params;
    const { config } = req.body as { config?: MonteCarloConfig };

    const site = await storage.getSite(siteId);
    if (!site) {
      return res.status(404).json({ error: "Site not found" });
    }

    // Get site's analysis assumptions or use defaults
    const baseAssumptions: AnalysisAssumptions = site.analysisAssumptions || defaultAnalysisAssumptions();
    
    // Get site parameters for the scenario runner
    // Try to extract from site's analysis data or use reasonable defaults
    const analyses = await storage.getAnalysesBySite(siteId);
    const latestAnalysis = analyses.length > 0 ? analyses[analyses.length - 1] : null;
    
    const siteParams: SiteScenarioParams = {
      pvSizeKW: latestAnalysis?.pvSizeKW || site.quickAnalysisSystemSizeKw || 100,
      annualConsumptionKWh: latestAnalysis?.annualConsumptionKWh || 200000,
      tariffEnergy: baseAssumptions.tariffEnergy || 0.06,
      tariffPower: baseAssumptions.tariffPower || 17.573,
      peakKW: latestAnalysis?.peakDemandKW || 50,
    };
    
    // Create scenario runner with site-specific parameters
    const runScenario = createSimplifiedScenarioRunner(siteParams);
    
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
      siteParams,
      baseAssumptions,
    });
  } catch (error) {
    console.error("Error running Monte Carlo analysis:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: errorMessage });
  }
});

router.post("/:siteId/peak-shaving-analysis", authMiddleware, requireStaff, async (req, res) => {
  try {
    const { siteId } = req.params;
    const { peakDemandKW, batteryPowerKW, batteryEnergyKWh, tariffPower } = req.body;

    const site = await storage.getSite(siteId);
    if (!site) {
      return res.status(404).json({ error: "Site not found" });
    }

    const readings = await storage.getMeterReadingsBySite(siteId);
    if (readings.length === 0) {
      return res.status(400).json({ error: "No meter data available for analysis" });
    }

    const result = analyzePeakShaving(
      readings.map(r => ({ kW: r.kW || 0, timestamp: new Date(r.timestamp) })),
      {
        peakDemandKW,
        batteryPowerKW,
        batteryEnergyKWh,
        tariffPower: tariffPower || 14.48
      }
    );

    res.json(result);
  } catch (error) {
    console.error("Error running peak shaving analysis:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:siteId/kit-recommendation", authMiddleware, requireStaff, async (req, res) => {
  try {
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
      return res.status(400).json({ 
        error: "No analysis available. Run a potential analysis first to get optimal sizing." 
      });
    }
    
    const optimalPvKW = latestSimulation.pvSizeKW || 0;
    const optimalBatteryKWh = latestSimulation.battEnergyKWh || 0;
    const optimalBatteryKW = latestSimulation.battPowerKW || 0;
    
    if (optimalPvKW === 0) {
      return res.status(400).json({ 
        error: "Invalid system size in analysis. Please re-run the potential analysis." 
      });
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
  } catch (error) {
    console.error("Error generating kit recommendations:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:siteId/construction-estimate", authMiddleware, async (req, res) => {
  try {
    const siteId = req.params.siteId;
    const site = await storage.getSite(siteId);
    if (!site) {
      return res.status(404).json({ error: "Site not found" });
    }
    
    const simulations = await storage.getSimulationRuns(siteId);
    const latestSim = simulations.find(s => s.type === "SCENARIO") || simulations[0];
    
    const visits = await storage.getSiteVisits(siteId);
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
  } catch (error) {
    console.error("Construction estimate error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:siteId/price-breakdown", authMiddleware, async (req, res) => {
  try {
    const site = await storage.getSite(req.params.siteId);
    if (!site) {
      return res.status(404).json({ error: "Site not found" });
    }

    const capacityKW = site.kbKwDc || 100;
    const panelCount = site.kbPanelCount || Math.ceil(capacityKW * 1000 / 625);
    const capacityW = capacityKW * 1000;

    const components = await storage.getActivePricingComponents();

    const breakdown: Record<string, { cost: number; perW: number; source: string | null }> = {};
    let totalCost = 0;

    // Use fixed $0.35/W for racking in analysis phase (specific racking selection is for design/quotation phase)
    const RACKING_RATE_PER_W = 0.35;
    const rackingCost = RACKING_RATE_PER_W * capacityW;
    breakdown['racking'] = { cost: rackingCost, perW: RACKING_RATE_PER_W, source: 'Estimation analyse' };
    totalCost += rackingCost;

    for (const comp of components) {
      // Skip racking components - we use a fixed rate for analysis
      if (comp.category === 'racking') {
        continue;
      }

      let componentCost = 0;

      switch (comp.unit) {
        case 'W':
          componentCost = comp.pricePerUnit * capacityKW * 1000;
          break;
        case 'kW':
          componentCost = comp.pricePerUnit * capacityKW;
          break;
        case 'panel':
          componentCost = comp.pricePerUnit * panelCount;
          break;
        case 'project':
          componentCost = comp.pricePerUnit;
          break;
        case 'percent':
          break;
        default:
          componentCost = comp.pricePerUnit * capacityKW * 1000;
      }

      if (comp.minQuantity !== null && comp.maxQuantity !== null) {
        const qty = comp.unit === 'panel' ? panelCount : capacityKW;
        if (qty < comp.minQuantity || qty > comp.maxQuantity) {
          continue;
        }
      }

      if (!breakdown[comp.category]) {
        breakdown[comp.category] = { cost: 0, perW: 0, source: null };
      }
      breakdown[comp.category].cost += componentCost;
      breakdown[comp.category].source = comp.source;
      totalCost += componentCost;
    }

    for (const comp of components.filter(c => c.unit === 'percent' && c.category !== 'racking')) {
      const percentageCost = totalCost * (comp.pricePerUnit / 100);
      if (!breakdown[comp.category]) {
        breakdown[comp.category] = { cost: 0, perW: 0, source: null };
      }
      breakdown[comp.category].cost += percentageCost;
      breakdown[comp.category].source = comp.source;
      totalCost += percentageCost;
    }

    for (const cat of Object.keys(breakdown)) {
      breakdown[cat].perW = Math.round((breakdown[cat].cost / capacityW) * 100) / 100;
    }

    const totalPerW = Math.round((totalCost / capacityW) * 100) / 100;

    res.json({
      siteId: site.id,
      siteName: site.name,
      capacityKW,
      panelCount,
      breakdown,
      totalCost: Math.round(totalCost),
      totalPerW,
      componentCount: components.length,
    });
  } catch (error) {
    console.error("Error calculating price breakdown:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:siteId/visits", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const visits = await storage.getSiteVisitsBySite(req.params.siteId);
    res.json(visits);
  } catch (error) {
    console.error("Error fetching site visits:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:siteId/photos", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const siteId = req.params.siteId;
    const photos = await storage.getSiteVisitPhotos(siteId);
    res.json(photos);
  } catch (error) {
    console.error("Error fetching photos:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:siteId/design-agreement", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const agreement = await storage.getDesignAgreementBySite(req.params.siteId);
    if (!agreement) {
      return res.status(404).json({ error: "Design agreement not found for this site" });
    }
    res.json(agreement);
  } catch (error) {
    console.error("Error fetching design agreement:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:siteId/generate-design-agreement", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const { siteId } = req.params;
    const { siteVisitId, additionalFees = [], paymentTerms, pricingConfig } = req.body;
    
    const visit = siteVisitId ? await storage.getSiteVisit(siteVisitId) : null;
    const siteVisitCost = visit?.estimatedCost || null;
    
    let subtotal: number;
    let gst: number;
    let qst: number;
    let total: number;
    interface SiteQuotedCosts {
      designFees?: {
        numBuildings: number;
        baseFee: number;
        pvSizeKW: number;
        pvFee: number;
        battEnergyKWh: number;
        batteryFee: number;
        travelDays: number;
        travelFee: number;
      };
      engineeringStamps?: {
        structural: number;
        electrical: number;
      };
      siteVisit: unknown;
      additionalFees: Array<{ description?: string; amount: number }>;
      subtotal: number;
      taxes: { gst: number; qst: number };
      total: number;
    }
    
    let quotedCosts: SiteQuotedCosts;
    
    if (pricingConfig) {
      subtotal = pricingConfig.subtotal || 0;
      gst = pricingConfig.gst || subtotal * 0.05;
      qst = pricingConfig.qst || subtotal * 0.09975;
      total = pricingConfig.total || (subtotal + gst + qst);
      
      quotedCosts = {
        designFees: {
          numBuildings: pricingConfig.numBuildings || 1,
          baseFee: pricingConfig.baseFee || 0,
          pvSizeKW: pricingConfig.pvSizeKW || 0,
          pvFee: pricingConfig.pvFee || 0,
          battEnergyKWh: pricingConfig.battEnergyKWh || 0,
          batteryFee: pricingConfig.batteryFee || 0,
          travelDays: pricingConfig.travelDays || 0,
          travelFee: pricingConfig.travelFee || 0,
        },
        engineeringStamps: {
          structural: pricingConfig.includeStructuralStamp ? pricingConfig.structuralFee : 0,
          electrical: pricingConfig.includeElectricalStamp ? pricingConfig.electricalFee : 0,
        },
        siteVisit: siteVisitCost,
        additionalFees,
        subtotal,
        taxes: { gst, qst },
        total,
      };
    } else {
      const additionalTotal = Array.isArray(additionalFees) 
        ? additionalFees.reduce((sum: number, fee: { amount: number }) => sum + (fee.amount || 0), 0) 
        : 0;
      const siteVisitTotal = (siteVisitCost as { total?: number } | null)?.total || 0;
      subtotal = siteVisitTotal + additionalTotal;
      
      gst = subtotal * 0.05;
      qst = subtotal * 0.09975;
      total = subtotal + gst + qst;
      
      quotedCosts = {
        siteVisit: siteVisitCost,
        additionalFees,
        subtotal,
        taxes: { gst, qst },
        total,
      };
    }
    
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);
    
    const agreement = await storage.createDesignAgreement({
      siteId,
      siteVisitId: siteVisitId || null,
      status: "draft",
      quotedCosts,
      totalCad: total,
      currency: "CAD",
      paymentTerms: paymentTerms || "50% à la signature, 50% à la livraison des dessins",
      validUntil,
      quotedBy: req.userId,
      quotedAt: new Date(),
    });
    
    res.status(201).json(agreement);
  } catch (error) {
    console.error("Error generating design agreement:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:siteId/roof-polygons", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { siteId } = req.params;
    const polygons = await storage.getRoofPolygons(siteId);
    res.json(polygons);
  } catch (error) {
    console.error("Error fetching roof polygons:", error);
    res.status(500).json({ error: "Failed to fetch roof polygons" });
  }
});

const updateRoofPolygonSchema = z.object({
  label: z.string().nullable().optional(),
  coordinates: z.array(z.array(z.number())).optional(),
  areaSqM: z.number().positive().optional(),
  color: z.string().optional(),
}).strict();

router.post("/:siteId/roof-polygons", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { siteId } = req.params;
    const validationResult = insertRoofPolygonSchema.safeParse({
      ...req.body,
      siteId,
      createdBy: req.userId,
    });

    if (!validationResult.success) {
      return res.status(400).json({ error: "Invalid polygon data", details: validationResult.error.errors });
    }

    const polygon = await storage.createRoofPolygon(validationResult.data);
    
    if (!req.body.label || !req.body.label.toLowerCase().includes('constraint')) {
      await storage.updateSite(siteId, {
        roofAreaValidated: true,
        roofAreaValidatedAt: new Date(),
        roofAreaValidatedBy: req.userId,
      });
    }
    
    res.status(201).json(polygon);
  } catch (error) {
    console.error("Error creating roof polygon:", error);
    res.status(500).json({ error: "Failed to create roof polygon" });
  }
});

router.delete("/:siteId/roof-polygons", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { siteId } = req.params;
    const deletedCount = await storage.deleteRoofPolygonsBySite(siteId);
    res.status(200).json({ success: true, deleted: deletedCount });
  } catch (error) {
    console.error("Error deleting roof polygons:", error);
    res.status(500).json({ error: "Failed to delete roof polygons" });
  }
});

const standaloneRoofPolygonUpdateSchema = z.object({
  label: z.string().nullable().optional(),
  coordinates: z.array(z.array(z.number())).optional(),
  areaSqM: z.number().positive().optional(),
  color: z.string().optional(),
}).strict();

router.put("/roof-polygons/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const existing = await storage.getRoofPolygon(id);
    if (!existing) {
      return res.status(404).json({ error: "Roof polygon not found" });
    }

    const validationResult = standaloneRoofPolygonUpdateSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ error: "Invalid update data", details: validationResult.error.errors });
    }

    const polygon = await storage.updateRoofPolygon(id, validationResult.data);
    res.json(polygon);
  } catch (error) {
    console.error("Error updating roof polygon:", error);
    res.status(500).json({ error: "Failed to update roof polygon" });
  }
});

router.delete("/roof-polygons/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const existing = await storage.getRoofPolygon(id);
    if (!existing) {
      return res.status(404).json({ error: "Roof polygon not found" });
    }

    await storage.deleteRoofPolygon(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting roof polygon:", error);
    res.status(500).json({ error: "Failed to delete roof polygon" });
  }
});

router.get("/:siteId/project-info-sheet", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { siteId } = req.params;
    const lang = (req.query.lang as string) === "en" ? "en" : "fr";

    const site = await storage.getSite(siteId);
    if (!site) {
      return res.status(404).json({ error: "Site not found" });
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
  } catch (error) {
    console.error("Error generating project info sheet:", error);
    res.status(500).json({ error: "Failed to generate project info sheet PDF" });
  }
});

// Archive a site
router.post("/:id/archive", authMiddleware, requireStaff, async (req, res) => {
  try {
    const siteId = req.params.id;
    
    const site = await storage.getSite(siteId);
    if (!site) {
      return res.status(404).json({ error: "Site not found" });
    }
    
    // Archive the site
    const updatedSite = await storage.updateSite(siteId, {
      isArchived: true,
      archivedAt: new Date(),
    });
    
    res.json(updatedSite);
  } catch (error) {
    console.error("[Site Archive] Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Unarchive a site
router.post("/:id/unarchive", authMiddleware, requireStaff, async (req, res) => {
  try {
    const siteId = req.params.id;
    
    const site = await storage.getSite(siteId);
    if (!site) {
      return res.status(404).json({ error: "Site not found" });
    }
    
    const updatedSite = await storage.updateSite(siteId, {
      isArchived: false,
      archivedAt: null,
    });
    
    res.json(updatedSite);
  } catch (error) {
    console.error("[Site Unarchive] Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
