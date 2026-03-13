import { Router } from "express";
import PDFDocument from "pdfkit";
import archiver from "archiver";
import { authMiddleware, requireStaff, AuthRequest } from "../middleware/auth";
import { storage } from "../storage";
import { insertPortfolioSchema, insertPortfolioSiteSchema } from "@shared/schema";
import { createLogger } from "../lib/logger";
import { asyncHandler, BadRequestError, NotFoundError, ForbiddenError, ValidationError } from "../middleware/errorHandler";
import { sendHqProcurationEmail } from "../emailService";
import { z } from "zod";
import {
  aggregatePortfolioKPIs,
  resolvePortfolioSiteMetrics,
} from "../analysis/resolveSimulationMetrics";

const log = createLogger("Portfolios");

const router = Router();

router.get("/api/portfolios", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const portfolios = await storage.getPortfolios();
  res.json(portfolios);
}));

router.get("/api/clients/:clientId/portfolios", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const { clientId } = req.params;

  if (req.userRole === "client" && req.userClientId !== clientId) {
    throw new ForbiddenError("Access denied");
  }

  const portfolios = await storage.getPortfoliosByClient(clientId);
  res.json(portfolios);
}));

router.get("/api/portfolios/:id", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const portfolio = await storage.getPortfolio(req.params.id);

  if (!portfolio) {
    throw new NotFoundError("Portfolio");
  }

  if (req.userRole === "client" && req.userClientId !== portfolio.clientId) {
    throw new ForbiddenError("Access denied");
  }

  res.json(portfolio);
}));

router.get("/api/portfolios/:id/sites", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const portfolio = await storage.getPortfolio(req.params.id);

  if (!portfolio) {
    throw new NotFoundError("Portfolio");
  }

  if (req.userRole === "client" && req.userClientId !== portfolio.clientId) {
    throw new ForbiddenError("Access denied");
  }

  const sites = await storage.getPortfolioSites(req.params.id);
  res.json(sites);
}));

router.get("/api/portfolios/:id/full", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const portfolio = await storage.getPortfolio(req.params.id);

  if (!portfolio) {
    throw new NotFoundError("Portfolio");
  }

  if (req.userRole === "client" && req.userClientId !== portfolio.clientId) {
    throw new ForbiddenError("Access denied");
  }

  const portfolioSites = await storage.getPortfolioSites(req.params.id);
  const kpis = aggregatePortfolioKPIs(portfolioSites);

  const sitesWithResolved = portfolioSites.map(ps => ({
    ...ps,
    resolvedMetrics: resolvePortfolioSiteMetrics(ps),
  }));

  res.json({
    portfolio,
    sites: sitesWithResolved,
    kpis,
  });
}));

router.post("/api/portfolios", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const parsed = insertPortfolioSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new BadRequestError("Validation failed", parsed.error.errors as unknown[]);
  }

  const portfolio = await storage.createPortfolio({
    ...parsed.data,
    createdBy: req.userId,
  });

  try {
    const existingClientOpps = await storage.getOpportunitiesByClientId(portfolio.clientId);
    const hasPortfolioOpp = existingClientOpps.some(opp =>
      opp.sourceDetails?.includes(`portfolio: ${portfolio.id}`)
    );

    if (!hasPortfolioOpp) {
      await storage.createOpportunity({
        name: `${portfolio.name} - Multi-Site Solar Project`,
        description: `Portfolio opportunity auto-created for: ${portfolio.name}`,
        clientId: portfolio.clientId,
        siteId: null,
        stage: "prospect",
        probability: 5,
        estimatedValue: null,
        estimatedCloseDate: null,
        ownerId: req.userId || null,
        source: "internal",
        sourceDetails: `Auto-created for portfolio: ${portfolio.id}`,
        priority: "medium",
        tags: ["portfolio"],
      });
    }
  } catch (oppError) {
    log.error("Failed to auto-create portfolio opportunity:", oppError);
  }

  res.status(201).json(portfolio);
}));

router.patch("/api/portfolios/:id", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const portfolio = await storage.updatePortfolio(req.params.id, req.body);

  if (!portfolio) {
    throw new NotFoundError("Portfolio");
  }

  res.json(portfolio);
}));

router.delete("/api/portfolios/:id", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const deleted = await storage.deletePortfolio(req.params.id);

  if (!deleted) {
    throw new NotFoundError("Portfolio");
  }

  res.json({ success: true });
}));

router.post("/api/portfolios/:id/sites", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const { siteId, siteIds, notes, displayOrder } = req.body;

  const sitesToAdd: string[] = siteIds ? siteIds : (siteId ? [siteId] : []);

  if (sitesToAdd.length === 0) {
    throw new BadRequestError("siteId or siteIds is required");
  }

  const portfolio = await storage.getPortfolio(req.params.id);
  if (!portfolio) {
    throw new NotFoundError("Portfolio");
  }

  const existingPortfolioSites = await storage.getPortfolioSites(req.params.id);
  const existingSiteIds = existingPortfolioSites.map(ps => ps.siteId);

  const addedSites = [];
  const skippedDuplicates = [];

  for (const id of sitesToAdd) {
    if (existingSiteIds.includes(id)) {
      skippedDuplicates.push(id);
      continue;
    }

    const site = await storage.getSite(id);
    if (!site) {
      continue;
    }

    if (site.clientId !== portfolio.clientId) {
      continue;
    }

    const portfolioSite = await storage.addSiteToPortfolio({
      portfolioId: req.params.id,
      siteId: id,
      notes: notes || null,
      displayOrder: displayOrder || addedSites.length,
    });

    addedSites.push(portfolioSite);
    existingSiteIds.push(id);
  }

  const currentSites = await storage.getPortfolioSites(req.params.id);
  await storage.updatePortfolio(req.params.id, {
    numBuildings: currentSites.length,
  });

  res.status(201).json({
    added: addedSites,
    skippedDuplicates,
    totalInPortfolio: currentSites.length
  });
}));

router.delete("/api/portfolios/:portfolioId/sites/:siteId", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const { portfolioId, siteId } = req.params;

  const removed = await storage.removeSiteFromPortfolio(portfolioId, siteId);

  if (!removed) {
    throw new NotFoundError("Site not found in portfolio");
  }

  const currentSites = await storage.getPortfolioSites(portfolioId);
  await storage.updatePortfolio(portfolioId, {
    numBuildings: currentSites.length,
  });

  res.json({ success: true });
}));

router.patch("/api/portfolio-sites/:id", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const {
    overridePvSizeKW,
    overrideBatteryKWh,
    overrideCapexNet,
    overrideNpv,
    overrideIrr,
    overrideAnnualSavings,
    notes,
    financialModel
  } = req.body;

  const updated = await storage.updatePortfolioSite(id, {
    overridePvSizeKW: overridePvSizeKW !== undefined ? overridePvSizeKW : undefined,
    overrideBatteryKWh: overrideBatteryKWh !== undefined ? overrideBatteryKWh : undefined,
    overrideCapexNet: overrideCapexNet !== undefined ? overrideCapexNet : undefined,
    overrideNpv: overrideNpv !== undefined ? overrideNpv : undefined,
    overrideIrr: overrideIrr !== undefined ? overrideIrr : undefined,
    overrideAnnualSavings: overrideAnnualSavings !== undefined ? overrideAnnualSavings : undefined,
    notes: notes !== undefined ? notes : undefined,
    financialModel: financialModel !== undefined ? financialModel : undefined,
  });

  if (!updated) {
    throw new NotFoundError("Portfolio site");
  }

  res.json(updated);
}));

router.get("/api/portfolios/:id/pdf", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const lang = (req.query.lang as string) === "en" ? "en" : "fr";
  const portfolio = await storage.getPortfolio(req.params.id);

  if (!portfolio) {
    throw new NotFoundError("Portfolio");
  }

  if (req.userRole === "client" && req.userClientId !== portfolio.clientId) {
    throw new ForbiddenError("Access denied");
  }

  const client = await storage.getClient(portfolio.clientId);
  if (!client) {
    throw new NotFoundError("Client");
  }

  const portfolioSites = await storage.getPortfolioSites(req.params.id);

  const doc = new PDFDocument({ size: "LETTER", margin: 40 });

  const portfolioName = portfolio.name.replace(/\s+/g, "-").toLowerCase();
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="portfolio-${portfolioName}.pdf"`);

  doc.pipe(res);

  const { generatePortfolioSummaryPDF } = await import("../pdf");

  const kpis = aggregatePortfolioKPIs(portfolioSites);
  const quotedCosts = (portfolio.quotedCosts as Record<string, unknown>) || {};

  generatePortfolioSummaryPDF(doc, {
    id: portfolio.id,
    name: portfolio.name,
    clientName: client.name,
    description: portfolio.description || undefined,
    numBuildings: kpis.numBuildings,
    estimatedTravelDays: portfolio.estimatedTravelDays,
    volumeDiscountPercent: kpis.volumeDiscount,
    quotedCosts,
    totalPvSizeKW: kpis.totalPvSizeKW,
    totalBatteryKWh: kpis.totalBatteryCapacityKWh,
    totalCapexNet: kpis.totalNetCapex,
    totalNpv25: kpis.totalNpv,
    weightedIrr25: kpis.weightedIrr,
    totalAnnualSavings: kpis.totalAnnualSavings,
    totalCo2Avoided: kpis.totalCo2Avoided,
    sites: portfolioSites.map(ps => {
      const m = resolvePortfolioSiteMetrics(ps);
      return {
        siteName: ps.site?.name || "Unknown",
        city: ps.site?.city || undefined,
        pvSizeKW: m.pvSizeKW || null,
        batteryKWh: m.batteryKWh || null,
        capexNet: m.capexNet || null,
        npv25: m.npv25 || null,
        irr25: m.irr25 || null,
        annualSavings: m.annualSavings || null,
        co2Avoided: m.co2Avoided || null,
      };
    }),
    createdAt: portfolio.createdAt || undefined,
  }, lang as "fr" | "en");

  doc.end();
}));

// Master Agreement PDF (Dream RFP — full document with Annex A per site)
router.get("/api/portfolios/:id/master-agreement-pdf", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const lang = (req.query.lang as string) === "en" ? "en" : "fr";
  const portfolio = await storage.getPortfolio(req.params.id);

  if (!portfolio) {
    throw new NotFoundError("Portfolio");
  }

  if (req.userRole === "client" && req.userClientId !== portfolio.clientId) {
    throw new ForbiddenError("Access denied");
  }

  const client = await storage.getClient(portfolio.clientId);
  if (!client) {
    throw new NotFoundError("Client");
  }

  const portfolioSites = await storage.getPortfolioSites(req.params.id);

  const { generateMasterAgreementPDFBuffer } = await import("../pdf/masterAgreementPDF");

  const kpis = aggregatePortfolioKPIs(portfolioSites);
  let totalFirstYearKwh = 0;
  const allSites = portfolioSites.map(ps => {
    const fm = (ps as any).financialModel;
    const resolved = resolvePortfolioSiteMetrics(ps);
    const yr1Kwh = resolved.totalProductionKWh > 0 ? resolved.totalProductionKWh : (fm?.projectSpecs?.firstYearKwh ?? null);
    const cost = resolved.capexNet > 0 ? resolved.capexNet : (fm?.projectCosts?.totalProjectCost ?? null);
    if (yr1Kwh) totalFirstYearKwh += yr1Kwh;
    return {
      siteName: ps.site?.name || "Unknown",
      address: ps.site?.address || undefined,
      city: ps.site?.city || undefined,
      financialModel: fm || undefined,
      pvSizeKW: resolved.pvSizeKW || null,
      firstYearKwh: yr1Kwh,
      totalProjectCost: cost,
    };
  });

  const pdfBuffer = await generateMasterAgreementPDFBuffer({
    name: portfolio.name,
    clientName: client.name,
    description: portfolio.description || undefined,
    numBuildings: kpis.numBuildings,
    volumeDiscountPercent: kpis.volumeDiscount,
    totalPvSizeKW: kpis.totalPvSizeKW,
    totalBatteryKWh: kpis.totalBatteryCapacityKWh,
    totalCapexNet: kpis.totalNetCapex,
    totalNpv25: kpis.totalNpv,
    totalAnnualSavings: kpis.totalAnnualSavings,
    totalCo2Avoided: kpis.totalCo2Avoided,
    totalFirstYearKwh: totalFirstYearKwh || null,
    sites: allSites,
  }, lang as "fr" | "en");

  const portfolioName = portfolio.name.replace(/\s+/g, "-").toLowerCase();
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="master-agreement-${portfolioName}.pdf"`);
  res.send(pdfBuffer);
}));

router.post("/api/portfolios/:id/recalculate", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const portfolio = await storage.getPortfolio(req.params.id);
  if (!portfolio) {
    throw new NotFoundError("Portfolio");
  }

  const portfolioSites = await storage.getPortfolioSites(req.params.id);

  for (const ps of portfolioSites) {
    await storage.updatePortfolioSite(ps.id, {
      overridePvSizeKW: null,
      overrideBatteryKWh: null,
      overrideCapexNet: null,
      overrideNpv: null,
      overrideIrr: null,
      overrideAnnualSavings: null,
    });
    ps.overridePvSizeKW = null;
    ps.overrideBatteryKWh = null;
    ps.overrideCapexNet = null;
    ps.overrideNpv = null;
    ps.overrideIrr = null;
    ps.overrideAnnualSavings = null;
  }

  const kpis = aggregatePortfolioKPIs(portfolioSites);
  const volumeDiscountPercent = kpis.volumeDiscount;
  const numBuildings = kpis.numBuildings;

  const TRAVEL_COST_PER_DAY = 150;
  const VISIT_COST_PER_BUILDING = 600;
  const EVALUATION_COST_PER_BUILDING = 1000;
  const DIAGRAMS_COST_PER_BUILDING = 1900;

  const estimatedTravelDays = Math.ceil(numBuildings / 3);

  const travel = estimatedTravelDays * TRAVEL_COST_PER_DAY;
  const visit = numBuildings * VISIT_COST_PER_BUILDING;
  const evaluation = numBuildings * EVALUATION_COST_PER_BUILDING;
  const diagrams = numBuildings * DIAGRAMS_COST_PER_BUILDING;

  const subtotalBeforeDiscount = travel + visit + evaluation + diagrams;
  const discount = subtotalBeforeDiscount * volumeDiscountPercent;
  const subtotal = subtotalBeforeDiscount - discount;
  const gst = subtotal * 0.05;
  const qst = subtotal * 0.09975;
  const total = subtotal + gst + qst;

  const quotedCosts = {
    travel,
    visit,
    evaluation,
    diagrams,
    discount,
    subtotal,
    taxes: { gst, qst },
    total,
  };

  const updated = await storage.updatePortfolio(req.params.id, {
    numBuildings,
    estimatedTravelDays,
    volumeDiscountPercent,
    quotedCosts,
    totalCad: total,
    totalPvSizeKW: kpis.totalPvSizeKW,
    totalBatteryKWh: kpis.totalBatteryCapacityKWh,
    totalCapexNet: kpis.totalNetCapex,
    totalNpv25: kpis.totalNpv,
    weightedIrr25: kpis.weightedIrr,
    totalAnnualSavings: kpis.totalAnnualSavings,
    totalCo2Avoided: kpis.totalCo2Avoided,
  });

  res.json(updated);
}));

router.get("/api/portfolios/:id/community-flyer/:sessionIndex", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const sessionIndex = parseInt(req.params.sessionIndex);
  const { COMMUNITY_SESSIONS, generateCommunityFlyerPDF } = await import("../communityFlyerPdf");

  if (isNaN(sessionIndex) || sessionIndex < 0 || sessionIndex >= COMMUNITY_SESSIONS.length) {
    throw new BadRequestError(`Invalid session index. Must be 0-${COMMUNITY_SESSIONS.length - 1}`);
  }

  const session = COMMUNITY_SESSIONS[sessionIndex];
  const pdfBuffer = await generateCommunityFlyerPDF(sessionIndex);
  const filename = `Community_Flyer_${sessionIndex + 1}_${session.regionEn.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Content-Length": pdfBuffer.length.toString(),
  });
  res.send(pdfBuffer);
}));

const batchSendHqProcurationSchema = z.object({
  language: z.enum(["fr", "en"]).default("fr"),
});

router.post("/api/portfolios/:id/batch-send-hq-procuration", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const parseResult = batchSendHqProcurationSchema.safeParse(req.body);
  if (!parseResult.success) {
    throw new ValidationError("Validation error", parseResult.error.errors);
  }
  const { language } = parseResult.data;

  const portfolio = await storage.getPortfolio(id);
  if (!portfolio) throw new NotFoundError("Portfolio");

  const portfolioSites = await storage.getPortfolioSites(id);

  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const host = req.get('host') || 'localhost:5000';
  const baseUrl = `${protocol}://${host}`;

  const clientMap = new Map<string, { email: string; name: string; id: string }>();
  for (const ps of portfolioSites) {
    if (ps.site?.clientId) {
      const client = await storage.getClient(ps.site.clientId);
      if (client && client.email && !clientMap.has(client.id)) {
        clientMap.set(client.id, { email: client.email, name: client.name, id: client.id });
      }
    }
  }

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  if (clientMap.size === 0) {
    skipped = portfolioSites.length;
  } else {
    for (const [, clientInfo] of clientMap) {
      try {
        const result = await sendHqProcurationEmail(
          clientInfo.email,
          clientInfo.name,
          language,
          baseUrl,
          clientInfo.id
        );
        if (result.success) {
          sent++;
        } else {
          errors.push(`${clientInfo.name}: ${result.error || 'Unknown error'}`);
        }
      } catch (err: any) {
        errors.push(`${clientInfo.name}: ${err.message || 'Unknown error'}`);
      }
    }
    skipped = portfolioSites.length - clientMap.size;
  }

  res.json({ sent, skipped, errors });
}));

router.get("/api/portfolios/:id/export-info-sheets", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const portfolio = await storage.getPortfolio(req.params.id);
  if (!portfolio) {
    throw new NotFoundError("Portfolio");
  }

  if (req.userRole === "client" && req.userClientId !== portfolio.clientId) {
    throw new ForbiddenError("Access denied");
  }

  const portfolioSites = await storage.getPortfolioSites(req.params.id);
  if (portfolioSites.length === 0) {
    throw new BadRequestError("Portfolio has no sites");
  }

  const { generateProjectInfoSheetPDF, fetchRoofImageBuffer } = await import("../projectInfoSheetPdf");

  const safePorfolioName = portfolio.name.replace(/[^a-zA-Z0-9-_]/g, "_");
  const zipFilename = `Info_Sheets_${safePorfolioName}.zip`;

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${zipFilename}"`);

  const archive = archiver("zip", { zlib: { level: 5 } });

  archive.on("error", (err) => {
    log.error(`Archive error for portfolio ${portfolio.name}: ${err}`);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to create ZIP archive" });
    }
  });

  res.on("close", () => {
    archive.abort();
  });

  archive.pipe(res);

  let pdfCount = 0;

  for (const ps of portfolioSites) {
    const site = ps.site;
    if (!site) continue;

    const roofPolygons = await storage.getRoofPolygons(site.id);

    let roofImageBuffer: Buffer | null = null;
    if (site.latitude && site.longitude) {
      try {
        const polygonData = roofPolygons.map((p: any) => ({
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
      } catch (e) {
        log.warn(`Failed to fetch roof image for site ${site.name}: ${e}`);
      }
    }

    const solarPolygons = roofPolygons.filter((p: any) => {
      const isConstraint = p.label?.toLowerCase().includes("contrainte") ||
                          p.label?.toLowerCase().includes("constraint") ||
                          p.color === "#f97316";
      return !isConstraint;
    });
    const calculatedRoofAreaSqM = solarPolygons.reduce((sum: number, p: any) => sum + (p.areaSqM || 0), 0);

    const siteData = {
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
      roofPolygons: roofPolygons.map((p: any) => ({
        coordinates: p.coordinates as [number, number][],
        color: p.color || "#3b82f6",
        label: p.label || undefined,
      })),
      roofImageBuffer: roofImageBuffer || undefined,
      calculatedRoofAreaSqM: calculatedRoofAreaSqM > 0 ? calculatedRoofAreaSqM : undefined,
    };

    const safeName = site.name.replace(/[^a-zA-Z0-9-_]/g, "_");

    for (const lang of ["fr", "en"] as const) {
      try {
        const pdfBuffer = await generateProjectInfoSheetPDF(siteData, lang);
        archive.append(pdfBuffer, { name: `${safeName}_${lang.toUpperCase()}.pdf` });
        pdfCount++;
      } catch (e) {
        log.error(`Failed to generate PDF for site ${site.name} (${lang}): ${e}`);
      }
    }
  }

  if (pdfCount === 0) {
    if (!res.headersSent) {
      res.status(500).json({ error: "No PDFs could be generated" });
      return;
    }
  }

  await archive.finalize();
}));

export default router;
