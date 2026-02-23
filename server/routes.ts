import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { createLogger } from "./lib/logger";

const log = createLogger("Routes");
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import fs from "fs";
import PDFDocument from "pdfkit";
import { GoogleGenAI } from "@google/genai";
import {
  insertLeadSchema,
  insertClientSchema,
  insertSiteSchema,
  insertComponentCatalogSchema,
  insertPricingComponentSchema,
  insertSupplierSchema,
  insertPriceHistorySchema,
  insertSiteVisitSchema,
  insertDesignAgreementSchema,
  insertPortfolioSchema,
  insertPortfolioSiteSchema,
  insertConstructionAgreementSchema,
  insertConstructionMilestoneSchema,
  insertOmContractSchema,
  insertOmVisitSchema,
  insertOmPerformanceSnapshotSchema,
  insertOpportunitySchema,
  insertActivitySchema,
  insertSiteVisitPhotoSchema,
  insertPartnershipSchema,
  insertCompetitorProposalAnalysisSchema,
  insertRoofPolygonSchema,
  AnalysisAssumptions, 
  defaultAnalysisAssumptions, 
  CashflowEntry, 
  FinancialBreakdown,
  HourlyProfileEntry,
  PeakWeekEntry,
  SensitivityAnalysis,
  FrontierPoint,
  SolarSweepPoint,
  BatterySweepPoint,
  OptimalScenario,
  OptimalScenarios,
  Lead,
} from "@shared/schema";
import { z } from "zod";
import { env } from "./config";
import * as googleSolar from "./googleSolarService";
import { sendEmail, generatePortalInvitationEmail } from "./gmail";
import { sendQuickAnalysisEmail, sendWelcomeEmail, sendPasswordResetEmail } from "./emailService";
import { generateProcurationPDF, createProcurationData } from "./procurationPdfGenerator";
import { calculatePricingFromSiteVisit, getSiteVisitCompleteness, estimateConstructionCost } from "./pricing-engine";
import { 
  runMonteCarloAnalysis, 
  defaultMonteCarloConfig,
  analyzePeakShaving, 
  generateSolarProductionProfile,
  recommendStandardKit,
  STANDARD_KITS,
  resolveYieldStrategy,
  getTieredSolarCostPerW,
  getSolarPricingTierLabel,
  QUEBEC_MONTHLY_TEMPS as UNIFIED_QUEBEC_TEMPS,
  BASELINE_YIELD,
  type MonteCarloConfig,
  type PeakShavingConfig,
  type YieldStrategy,
  type SimulationParams,
} from "./analysis";
import {
  runHourlySimulation as centralRunHourlySimulation,
  runScenarioWithSizing as centralRunScenarioWithSizing,
  runSensitivityAnalysis as centralRunSensitivityAnalysis,
  calculateNPV as centralCalculateNPV,
  calculateIRR as centralCalculateIRR,
  SNOW_LOSS_FLAT_ROOF,
} from "./analysis/simulationEngine";
import { registerAIAssistantRoutes } from "./aiAssistant";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import clientRoutes from "./routes/clients";
import leadsRoutes from "./routes/leads";
import sitesRouter from "./routes/sites";
import designsRouter from "./routes/designs";
import catalogRouter from "./routes/catalog";
import siteVisitsRouter from "./routes/site-visits";
import constructionRouter from "./routes/construction";
import portfoliosRouter from "./routes/portfolios";
import omRouter from "./routes/om";
import opportunitiesRouter from "./routes/opportunities";
import marketIntelligenceRouter from "./routes/market-intelligence";
import publicRouter from "./routes/public";
import adminRouter from "./routes/admin";
import partnershipsRouter from "./routes/partnerships";
import importRouter from "./routes/import";
import kbRackingRouter from "./routes/kb-racking";
import workQueueRouter from "./routes/work-queue";
import rackingComparisonRouter from "./routes/racking-comparison";
import qualificationRouter from "./routes/qualification";
import benchmarkRouter from "./routes/benchmarks";
import hqDataRouter from "./routes/hq-data";
import gamificationRouter from "./routes/gamification";
import eosRouter from "./routes/eos";
import newsRouter from "./routes/news";

const JWT_SECRET = env.SESSION_SECRET;
const upload = multer({ 
  dest: "uploads/",
  limits: {
    files: 200, // Support up to 200 files (24+ months of hourly + 15-min data)
    fileSize: 50 * 1024 * 1024 // 50MB per file
  },
  fileFilter: (req, file, cb) => {
    // Allow PDFs, images, and CSVs
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'text/csv',
      'application/vnd.ms-excel',
    ];
    if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

// Memory storage multer for AI batch import (needs buffer access)
const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max for AI parsing
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
  userClientId?: string | null;
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as unknown as { userId: string };
    req.userId = decoded.userId;
    
    // Fetch user to get role and clientId
    const user = await storage.getUser(decoded.userId);
    if (user) {
      req.userRole = user.role;
      req.userClientId = user.clientId || null;
    }
    
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// Middleware to require admin or analyst role (internal staff only)
export function requireStaff(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.userRole !== "admin" && req.userRole !== "analyst") {
    return res.status(403).json({ error: "Access denied" });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // ==================== STATIC ASSETS (LOGOS) ====================
  
  // Serve logo images for emails - publicly accessible (blue background for light emails)
  app.get("/assets/logo-fr.png", (req, res) => {
    const logoPath = path.resolve("attached_assets/kWh_Quebec_Logo-01_1764778562811.png");
    if (fs.existsSync(logoPath)) {
      res.sendFile(logoPath);
    } else {
      res.status(404).send("Logo not found");
    }
  });
  
  app.get("/assets/logo-en.png", (req, res) => {
    const logoPath = path.resolve("attached_assets/kwh_logo_color_en.png");
    if (fs.existsSync(logoPath)) {
      res.sendFile(logoPath);
    } else {
      res.status(404).send("Logo not found");
    }
  });

  // ==================== SEO: 301 redirects for old site URLs ====================
  const oldRedirects: Record<string, string> = {
    "/apropos": "/",
    "/contact": "/#analyse",
    "/services": "/",
    "/comment-ca-marche": "/",
  };
  for (const [oldPath, newPath] of Object.entries(oldRedirects)) {
    app.get(oldPath, (_req, res) => res.redirect(301, newPath));
  }

  // ==================== SEO: robots.txt & sitemap ====================
  app.get("/robots.txt", (_req, res) => {
    res.type("text/plain").send(
`User-agent: *
Allow: /

Sitemap: https://www.kwh.quebec/sitemap.xml`
    );
  });

  app.get("/sitemap.xml", async (_req, res) => {
    const baseUrl = "https://www.kwh.quebec";
    const now = new Date().toISOString().split("T")[0];

    const staticPages = [
      { path: "/", priority: "1.0", changefreq: "weekly" },
      { path: "/ressources", priority: "0.8", changefreq: "weekly" },
      { path: "/ressources/calculateur-roi-solaire", priority: "0.8", changefreq: "monthly" },
      { path: "/blog", priority: "0.7", changefreq: "daily" },
      { path: "/analyse-detaillee", priority: "0.7", changefreq: "monthly" },
      { path: "/autorisation-hq", priority: "0.5", changefreq: "monthly" },
      { path: "/portfolio", priority: "0.6", changefreq: "monthly" },
      { path: "/privacy", priority: "0.3", changefreq: "yearly" },
      { path: "/conditions", priority: "0.3", changefreq: "yearly" },
    ];

    const hreflangBlock = (url: string) => `
      <xhtml:link rel="alternate" hreflang="fr-CA" href="${url}" />
      <xhtml:link rel="alternate" hreflang="en-CA" href="${url}" />`;

    const staticEntries = staticPages.map(p => `
    <url>
      <loc>${baseUrl}${p.path}</loc>
      <lastmod>${now}</lastmod>
      <changefreq>${p.changefreq}</changefreq>
      <priority>${p.priority}</priority>${hreflangBlock(`${baseUrl}${p.path}`)}
    </url>`).join("");

    let blogEntries = "";
    try {
      const articles = await storage.getBlogArticles("published");
      blogEntries = articles.map(a => {
        const url = `${baseUrl}/blog/${a.slug}`;
        return `
    <url>
      <loc>${url}</loc>
      <lastmod>${new Date(String(a.updatedAt || a.createdAt || new Date())).toISOString().split("T")[0]}</lastmod>
      <changefreq>monthly</changefreq>
      <priority>0.6</priority>${hreflangBlock(url)}
    </url>`;
      }).join("");
    } catch (e) {
      // Blog articles optional
    }

    res.type("application/xml").send(
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">${staticEntries}${blogEntries}
</urlset>`
    );
  });

  // ==================== AUTH ROUTES ====================
  app.use(authRoutes);

  // ==================== USER MANAGEMENT ROUTES (ADMIN ONLY) ====================
  app.use(userRoutes);

  // ==================== CLIENT ROUTES ====================
  app.use(clientRoutes);

  // ==================== LEADS, DASHBOARD & SEARCH ROUTES ====================
  app.use(leadsRoutes);

  // Site management routes
  app.use("/api/sites", sitesRouter);

  // ==================== DESIGNS & SIMULATION ROUTES ====================
  app.use(designsRouter);

  // ==================== CATALOG & PRICING ROUTES ====================
  app.use(catalogRouter);

  // ==================== SITE VISITS ROUTES ====================
  app.use(siteVisitsRouter);

  // ==================== CONSTRUCTION & DESIGN AGREEMENTS ROUTES ====================
  app.use(constructionRouter);

  // ==================== PORTFOLIO ROUTES ====================
  app.use(portfoliosRouter);

  // ==================== O&M (OPERATIONS & MAINTENANCE) ROUTES ====================
  app.use(omRouter);

  // ==================== OPPORTUNITIES & ACTIVITIES ROUTES ====================
  app.use(opportunitiesRouter);

  // ==================== MARKET INTELLIGENCE ROUTES ====================
  app.use(marketIntelligenceRouter);

  // ==================== PUBLIC ROUTES (NO AUTH) ====================
  app.use(publicRouter);

  // ==================== ADMIN ROUTES ====================
  app.use(adminRouter);

  // ==================== NEWS ROUTES ====================
  app.use(newsRouter);

  // ==================== PARTNERSHIPS ROUTES ====================
  app.use(partnershipsRouter);

  // ==================== IMPORT ROUTES ====================
  app.use(importRouter);

  // ==================== KB RACKING ROUTES ====================
  app.use(kbRackingRouter);

  // ==================== RACKING COMPARISON ROUTES ====================
  app.use(rackingComparisonRouter);

  // ==================== WORK QUEUE ROUTES ====================
  app.use(workQueueRouter);

  // ==================== BENCHMARK ROUTES ====================
  app.use(benchmarkRouter);

  // ==================== QUALIFICATION ROUTES ====================
  app.use(qualificationRouter);

  // ==================== HQ DATA ROUTES ====================
  app.use(hqDataRouter);
  // Gamification API
  app.use(gamificationRouter);
  app.use(eosRouter);

  // ==================== ROOF POLYGON STANDALONE ROUTES ====================
  // PUT /api/roof-polygons/:id and DELETE /api/roof-polygons/:id are handled via sitesRouter

  // NOTE: Routes extracted to server/routes/leads.ts:
  // - POST /api/quick-estimate (public, sends email)
  // - POST /api/detailed-analysis-request (public, file uploads)
  // - POST /api/leads (public, creates lead)
  // - GET /api/leads (staff only)
  // - GET /api/dashboard/stats (staff only)
  // - GET /api/dashboard/pipeline-stats (staff only)
  // - GET /api/search (staff only)

  // NOTE: Market intelligence routes extracted to server/routes/market-intelligence.ts

  // NOTE: Site visit routes extracted to server/routes/site-visits.ts


  // NOTE: Public routes extracted to server/routes/public.ts
  // - GET /api/public/agreements/:token
  // - POST /api/public/agreements/:token/sign
  // - POST /api/public/agreements/:token/create-checkout
  // - POST /api/public/agreements/:token/confirm-payment
  // - GET /api/public/stripe-key
  // - GET /api/public/portfolio
  // - GET /api/public/portfolio/:id
  // - GET /api/blog
  // - GET /api/blog/:slug

  // NOTE: Admin blog routes extracted to server/routes/admin.ts
  // - GET/POST/PATCH/DELETE /api/admin/blog/*
  // - POST /api/admin/seed-blog

  // NOTE: Admin market intelligence routes extracted to server/routes/admin.ts
  // - All /api/admin/competitors/* routes
  // - All /api/admin/battle-cards/* routes
  // - All /api/admin/market-notes/* routes
  // - All /api/admin/market-documents/* routes

  // NOTE: Procuration routes extracted to server/routes/admin.ts
  // - GET /api/admin/procurations
  // - GET /api/admin/procuration-pdfs
  // - GET /api/admin/procuration-pdfs/:filename

  // NOTE: Construction and design agreement routes extracted to:
  // - server/routes/construction.ts (design-agreements, construction-agreements, construction-milestones)
  // - server/routes/site-visits.ts (site-visits)

  // NOTE: O&M, Opportunities and Activities routes extracted to:
  // - server/routes/om.ts (om-contracts, om-visits, om-performance)
  // - server/routes/opportunities.ts (opportunities, activities)

  // NOTE: Partnerships routes extracted to server/routes/partnerships.ts

  // NOTE: Import routes extracted to server/routes/import.ts
  // - POST /api/import/prospects/ai-parse
  // - POST /api/import/prospects/batch
  // - POST /api/import/clients
  // - POST /api/import/catalog

  // NOTE: Roof polygon standalone routes (PUT/DELETE /api/roof-polygons/:id) extracted to server/routes/sites.ts

  // NOTE: KB Racking routes extracted to server/routes/kb-racking.ts
  // - GET /api/kb-racking/estimate
  // - GET /api/kb-racking/estimate-from-area
  // - GET /api/kb-racking/bom/:panelCount
  // - GET /api/kb-racking/specs
  // - GET /api/kb-racking/portfolio-stats
  // - POST /api/kb-racking/proposal-pdf/:siteId
  // - GET /api/kb-racking/google-solar-comparison
  // - GET /api/kb-racking/expiring-quotes

  // NOTE: Work queue routes extracted to server/routes/work-queue.ts
  // - GET /api/work-queue/sites
  // - POST /api/work-queue/delegate

  // ==================== AI ASSISTANT ROUTES ====================
  registerAIAssistantRoutes(app, authMiddleware, requireStaff);

  return httpServer;
}

// ==================== HELPER FUNCTIONS ====================
// NOTE: The following helper functions remain here as they are used by analysis routes
// and other parts of the codebase that have not yet been extracted.

async function parseHydroQuebecCSV(
  filePath: string, 
  meterFileId: string, 
  granularity: string
): Promise<Array<{
  meterFileId: string;
  timestamp: Date;
  granularity: string;
  kWh: number | null;
  kW: number | null;
}>> {
  // Read file with Latin-1 encoding (common for Hydro-Québec exports)
  const buffer = fs.readFileSync(filePath);
  let content: string;
  
  // Try to decode as Latin-1 first, fall back to UTF-8
  try {
    content = buffer.toString("latin1");
  } catch {
    content = buffer.toString("utf-8");
  }
  
  // Split lines and filter empty ones
  const lines = content.split(/\r?\n/).filter(line => {
    const trimmed = line.trim();
    return trimmed.length > 0 && trimmed !== ";";
  });
  
  const readings: Array<{
    meterFileId: string;
    timestamp: Date;
    granularity: string;
    kWh: number | null;
    kW: number | null;
  }> = [];

  if (lines.length < 2) return readings; // Need at least header + 1 data row

  // Detect delimiter (semicolon for Hydro-Québec, comma for generic CSV)
  const headerLine = lines[0];
  const delimiter = headerLine.includes(";") ? ";" : ",";
  
  // Normalize header for accent-insensitive matching
  const normalizeForMatch = (str: string): string => {
    return str.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/\s+/g, " ")
      .trim();
  };
  
  // Parse header to find column indices
  const headers = headerLine.split(delimiter).map(h => normalizeForMatch(h));
  
  // Detect if this is a Hydro-Québec format by checking headers
  const isHydroQuebecFormat = headers.some(h => 
    h.includes("contrat") || h.includes("date et heure")
  );
  
  // Find relevant column indices
  let dateColIndex = -1;
  let valueColIndex = -1;
  let detectedDataType: "kWh" | "kW" = granularity === "HOUR" ? "kWh" : "kW";
  
  if (isHydroQuebecFormat) {
    // Find date column (usually "Date et heure")
    dateColIndex = headers.findIndex(h => h.includes("date"));
    
    // Try to find kWh column (hourly energy files)
    const kwhIndex = headers.findIndex(h => /kwh/i.test(h));
    
    // Try to find kW column (15-min power files) - look for "puissance" or "(kw)"
    const kwIndex = headers.findIndex(h => 
      h.includes("puissance") || /\(kw\)/i.test(h) || /kw\)/i.test(h)
    );
    
    // Select value column based on what's available
    if (kwhIndex !== -1) {
      valueColIndex = kwhIndex;
      detectedDataType = "kWh";
    } else if (kwIndex !== -1) {
      valueColIndex = kwIndex;
      detectedDataType = "kW";
    }
    
    // Fallback to standard Hydro-Québec positions: date=1, value=2
    if (dateColIndex === -1) dateColIndex = 1;
    if (valueColIndex === -1) valueColIndex = 2;
  } else {
    // Generic CSV format: assume first column is date, second is value
    dateColIndex = 0;
    valueColIndex = 1;
  }

  // Parse data lines
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line === delimiter) continue;
    
    const parts = line.split(delimiter);
    
    if (parts.length <= Math.max(dateColIndex, valueColIndex)) continue;
    
    try {
      // Parse date
      const dateStr = parts[dateColIndex]?.trim().replace(/"/g, "");
      if (!dateStr) continue;
      
      const timestamp = new Date(dateStr);
      if (isNaN(timestamp.getTime())) continue;
      
      // Parse value - handle French decimal format (comma as decimal separator)
      let valueStr = parts[valueColIndex]?.trim().replace(/"/g, "") || "";
      if (!valueStr) continue;
      
      // Remove spaces and convert French decimal to standard
      valueStr = valueStr.replace(/\s/g, "").replace(",", ".");
      
      const value = parseFloat(valueStr);
      if (isNaN(value)) continue;
      
      readings.push({
        meterFileId,
        timestamp,
        granularity,
        kWh: detectedDataType === "kWh" ? value : null,
        kW: detectedDataType === "kW" ? value : null,
      });
    } catch (e) {
      continue;
    }
  }

  // Sort readings by timestamp (oldest first)
  readings.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return readings;
}

interface AnalysisResult {
  // System sizing
  pvSizeKW: number;
  battEnergyKWh: number;
  battPowerKW: number;
  demandShavingSetpointKW: number;
  
  // Consumption metrics
  annualConsumptionKWh: number;
  peakDemandKW: number;
  annualEnergySavingsKWh: number;
  annualDemandReductionKW: number;
  selfConsumptionKWh: number;
  selfSufficiencyPercent: number;
  
  // Cost metrics
  annualCostBefore: number;
  annualCostAfter: number;
  annualSavings: number;
  savingsYear1: number;
  
  // CAPEX breakdown
  capexGross: number;
  capexPV: number;
  capexBattery: number;
  
  // Incentives
  incentivesHQ: number;
  incentivesHQSolar: number;
  incentivesHQBattery: number;
  incentivesFederal: number;
  taxShield: number;
  totalIncentives: number;
  capexNet: number;
  
  // Financial metrics (25-year standard horizon)
  npv25: number;
  npv10: number;
  npv20: number;
  irr25: number;
  irr10: number;
  irr20: number;
  simplePaybackYears: number;
  lcoe: number;
  
  // Extended 30-year horizon metrics (panel lifetime value)
  npv30: number;
  irr30: number;
  lcoe30: number;
  
  // Environmental
  co2AvoidedTonnesPerYear: number;
  
  // Detailed data
  assumptions: AnalysisAssumptions;
  cashflows: CashflowEntry[];
  breakdown: FinancialBreakdown;
  hourlyProfile: HourlyProfileEntry[];
  peakWeekData: PeakWeekEntry[];
  
  // Sensitivity analysis (optimization charts)
  sensitivity: SensitivityAnalysis;
  
  // Data quality indicators
  interpolatedMonths: number[]; // Months with no data that were estimated from neighbors

  // Hidden insights for downstream consumers (PDF, PPTX, email)
  hiddenInsights: {
    dataConfidence: 'satellite' | 'manual' | 'hq_actual';
    dataConfidencePercent: number;
    peakDemandReductionKw: number;
    peakDemandSavingsAnnual: number;
    selfConsumptionPercent: number;
    gridExportPercent: number;
    clippingLossPercent: number;
    equivalentTreesPlanted: number;
    equivalentCarsRemoved: number;
    costOfInaction25yr: number;
  };
}

interface ForcedSizing {
  forcePvSize?: number;
  forceBatterySize?: number;
  forceBatteryPower?: number;
}

interface AnalysisOptions {
  forcedSizing?: ForcedSizing;
  preCalculatedDataSpanDays?: number; // Use pre-calculated value from deduplication
}

function runPotentialAnalysis(
  readings: Array<{ kWh: number | null; kW: number | null; timestamp: Date }>,
  customAssumptions?: Partial<AnalysisAssumptions>,
  options?: AnalysisOptions
): AnalysisResult {
  // Merge custom assumptions with defaults
  const h: AnalysisAssumptions = { ...defaultAnalysisAssumptions, ...customAssumptions };

  // Copy _yieldStrategy if present in customAssumptions
  const incomingStrategy = (customAssumptions as any)?._yieldStrategy;
  if (incomingStrategy) {
    (h as any)._yieldStrategy = incomingStrategy;
  }

  // If customAssumptions had yieldSource set, ensure it's preserved after merge
  if (customAssumptions?.yieldSource) {
    h.yieldSource = customAssumptions.yieldSource;
  }
  
  // ========== STEP 1: Build 8760-hour simulation data ==========
  // Aggregate readings into hourly consumption and peak power (with interpolation for missing months)
  const { hourlyData, interpolatedMonths } = buildHourlyData(readings);
  
  // Extract options
  const forcedSizing = options?.forcedSizing;
  
  // Calculate annual metrics from readings
  let totalKWh = 0;
  let peakKW = 0;
  
  for (const r of readings) {
    totalKWh += r.kWh || 0;
    const kw = r.kW || 0;
    if (kw > peakKW) peakKW = kw;
  }
  
  // CRITICAL: Use pre-calculated dataSpanDays from deduplication (computed from ORIGINAL readings)
  // This prevents incorrect annualization when readings are deduplicated/filtered
  const dataSpanDays = options?.preCalculatedDataSpanDays ?? (
    readings.length > 0 
      ? Math.max(1, (new Date(readings[readings.length - 1].timestamp).getTime() - new Date(readings[0].timestamp).getTime()) / (1000 * 60 * 60 * 24))
      : 365
  );
  const annualizationFactor = 365 / Math.max(dataSpanDays, 1);
  const annualConsumptionKWh = totalKWh * annualizationFactor;
  
  log.info(`Analysis: totalKWh=${totalKWh.toFixed(0)}, dataSpanDays=${dataSpanDays.toFixed(1)}, annualizationFactor=${annualizationFactor.toFixed(3)}, annualConsumptionKWh=${annualConsumptionKWh.toFixed(0)}`);
  
  // ========== STEP 2: System sizing with roof constraint ==========
  // Use KB Racking-calculated maxPV if provided (from traced polygons), otherwise calculate locally
  // KB Racking formula: (usable_area_m² / 3.71) × 0.660 kW
  const maxPVFromRoof = (h as any).maxPVFromRoofKw !== undefined
    ? (h as any).maxPVFromRoofKw
    : ((h.roofAreaSqFt / 10.764) * h.roofUtilizationRatio / 3.71) * 0.660;
  
  // SIMPLIFIED YIELD CALCULATION (Jan 2026)
  // PRIORITY 1: Use pre-resolved yieldStrategy from caller (already includes bifacial if applicable)
  // PRIORITY 2: Manual calculation as fallback
  const storedYieldStrategy = (h as any)._yieldStrategy as YieldStrategy | undefined;
  let effectiveYield: number;
  
  if (storedYieldStrategy) {
    // Use pre-resolved yield strategy - this is the SINGLE source of truth
    // effectiveYield already includes bifacial boost if bifacialEnabled was true
    effectiveYield = storedYieldStrategy.effectiveYield;
    log.info(`Stored Strategy: effectiveYield=${effectiveYield.toFixed(0)}, source=${storedYieldStrategy.yieldSource}, bifacialBoost=${storedYieldStrategy.bifacialBoost}`);
  } else if (h.yieldSource === 'google') {
    // Fallback for direct calls without strategy: Google yield with optional bifacial
    const googleBaseYield = h.solarYieldKWhPerKWp || 1079;
    const bifacialMultiplier = h.bifacialEnabled === true ? 1.15 : 1.0;
    effectiveYield = googleBaseYield * bifacialMultiplier;
    log.info(`Google Fallback: Base=${googleBaseYield}, bifacial=${h.bifacialEnabled === true ? 'ON (+15%)' : 'OFF'}, effectiveYield=${effectiveYield.toFixed(0)}`);
  } else {
    // Fallback: Manual calculation for non-Google sources
    const baseYield = h.solarYieldKWhPerKWp || BASELINE_YIELD;
    const orientationFactor = Math.max(0.6, Math.min(1.0, h.orientationFactor || 1.0));
    const bifacialMultiplier = h.bifacialEnabled === true ? 1.15 : 1.0;
    effectiveYield = baseYield * orientationFactor * bifacialMultiplier;
    log.info(`Manual Fallback: Base=${baseYield}, orientation=${orientationFactor.toFixed(2)}, bifacial=${h.bifacialEnabled}, effectiveYield=${effectiveYield.toFixed(0)}`);
  }
  const targetPVSize = (annualConsumptionKWh / effectiveYield) * 1.2;
  
  // Use forced sizing if provided, otherwise calculate optimal
  const pvSizeKW = forcedSizing?.forcePvSize !== undefined 
    ? Math.round(forcedSizing.forcePvSize)
    : Math.min(Math.round(targetPVSize), Math.round(maxPVFromRoof));
  
  // Battery sizing - use forced values if provided
  const battPowerKW = forcedSizing?.forceBatteryPower !== undefined
    ? Math.round(forcedSizing.forceBatteryPower)
    : Math.round(peakKW * 0.3); // 30% of peak for shaving
  const battEnergyKWh = forcedSizing?.forceBatterySize !== undefined
    ? Math.round(forcedSizing.forceBatterySize)
    : Math.round(battPowerKW * 2); // 2-hour duration
  const demandShavingSetpointKW = Math.round(peakKW * 0.90); // Target 10% peak reduction
  
  // ========== STEP 3: Run hourly simulation ==========
  // Calculate yield factor relative to baseline (1150 kWh/kWp = 1.0)
  const yieldFactor = effectiveYield / BASELINE_YIELD;
  
  // UNIFIED: Use yield strategy from caller if available, otherwise resolve here
  const storedStrategy = (h as any)._yieldStrategy as YieldStrategy | undefined;
  const skipTempCorrection = storedStrategy 
    ? storedStrategy.skipTempCorrection 
    : (h.yieldSource === 'google' || h.yieldSource === 'manual');
  
  // Get yieldSource for bulletproof temperature correction check (passed directly to runHourlySimulation)
  const currentYieldSource: 'google' | 'manual' | 'default' = (h.yieldSource === 'google' || h.yieldSource === 'manual') ? h.yieldSource : 'default';
  log.info(`yieldSource='${currentYieldSource}', skipTempCorrection=${skipTempCorrection}, effectiveYield=${effectiveYield.toFixed(1)}`);
  const systemParams: SystemModelingParams = {
    inverterLoadRatio: h.inverterLoadRatio || 1.45,
    temperatureCoefficient: h.temperatureCoefficient || -0.004,
    wireLossPercent: h.wireLossPercent ?? 0.03,
    skipTempCorrection,
    lidLossPercent: h.lidLossPercent ?? 0.01,
    mismatchLossPercent: h.mismatchLossPercent ?? 0.02,
    mismatchStringsLossPercent: h.mismatchStringsLossPercent ?? 0.0015,
    moduleQualityGainPercent: h.moduleQualityGainPercent ?? 0.0075,
  };
  
  let effectiveSnowProfile = h.snowLossProfile;
  if (currentYieldSource === 'google' && (!effectiveSnowProfile || effectiveSnowProfile === 'none')) {
    effectiveSnowProfile = 'flat_roof';
  }

  const simResult = runHourlySimulation(hourlyData, pvSizeKW, battEnergyKWh, battPowerKW, demandShavingSetpointKW, yieldFactor, systemParams, currentYieldSource, effectiveSnowProfile);
  
  // Extract metrics from simulation
  const selfConsumptionKWh = simResult.totalSelfConsumption;
  const totalProductionKWh = simResult.totalProductionKWh;
  const totalExportedKWh = simResult.totalExportedKWh;
  const peakDemandKW = peakKW;
  const peakAfterKW = simResult.peakAfter;
  const annualDemandReductionKW = peakKW - peakAfterKW;
  const selfSufficiencyPercent = annualConsumptionKWh > 0 ? (selfConsumptionKWh / annualConsumptionKWh) * 100 : 0;
  
  // ========== STEP 4: Calculate annual costs and savings ==========
  const annualCostBefore = annualConsumptionKWh * h.tariffEnergy + peakKW * h.tariffPower * 12;
  const energySavings = selfConsumptionKWh * h.tariffEnergy;
  const demandSavings = annualDemandReductionKW * h.tariffPower * 12;
  const annualSavings = energySavings + demandSavings;
  const annualCostAfter = annualCostBefore - annualSavings;
  const savingsYear1 = annualSavings; // First year savings (before inflation)
  
  // HQ Net Metering surplus revenue (new Dec 2024 program)
  // After 24 months, HQ compensates surplus kWh at cost of supply rate (NOT client tariff)
  // Source: HQ Tariff Proposal R-4270-2024 - 4.54¢/kWh (coût moyen d'approvisionnement)
  const hqSurplusRate = h.hqSurplusCompensationRate ?? 0.0454; // Default 4.54¢/kWh
  const annualSurplusRevenue = totalExportedKWh * hqSurplusRate;
  
  // ========== STEP 5: Calculate CAPEX ==========
  // Use tiered pricing based on system size (automatic, or override from assumptions)
  const baseSolarCostPerW = h.solarCostPerW ?? getTieredSolarCostPerW(pvSizeKW);
  // Apply bifacial cost premium if enabled (typically 5-10 cents/W more)
  const effectiveSolarCostPerW = h.bifacialEnabled 
    ? baseSolarCostPerW + (h.bifacialCostPremium || 0.10)
    : baseSolarCostPerW;
  const capexPV = pvSizeKW * 1000 * effectiveSolarCostPerW;
  const capexBattery = battEnergyKWh * h.batteryCapacityCost + battPowerKW * h.batteryPowerCost;
  const capexGross = capexPV + capexBattery;
  
  // ========== STEP 6: Calculate Quebec (HQ) incentives ==========
  // Hydro-Québec: $1000/kW for solar, capped at 40% of total CAPEX
  // Note: HQ Autoproduction program is limited to 1 MW - only first 1000 kW eligible for $1000/kW
  // Battery: NO standalone $300/kW incentive (discontinued as of Dec 2024)
  // Battery can only receive HQ credit if paired with solar AND there's leftover room in the cap
  const eligibleSolarKW = Math.min(pvSizeKW, 1000); // Pro-rata: only first 1 MW
  const potentialHQSolar = eligibleSolarKW * 1000;
  const potentialHQBattery = 0; // Discontinued - no standalone battery incentive
  const cap40Percent = capexGross * 0.40;
  
  // Solar gets up to $1000/kW, capped at 40% of CAPEX
  let incentivesHQSolar = Math.min(potentialHQSolar, cap40Percent);
  
  // Battery only gets HQ credit if paired with solar AND there's leftover cap room
  let incentivesHQBattery = 0;
  if (pvSizeKW > 0 && battEnergyKWh > 0) {
    // Remaining cap space after solar incentive (clamped to prevent negative values)
    const remainingCap = Math.max(0, cap40Percent - incentivesHQSolar);
    // Battery can receive the lesser of: remaining cap OR actual battery cost
    incentivesHQBattery = Math.min(remainingCap, capexBattery);
  }
  // Note: Battery-only projects (no solar) receive $0 HQ incentive
  
  const incentivesHQ = incentivesHQSolar + incentivesHQBattery;
  
  // Battery HQ incentive: 50% year 0, 50% year 1
  const batterySubY0 = incentivesHQBattery * 0.5;
  const batterySubY1 = incentivesHQBattery * 0.5;
  
  // ========== STEP 7: Federal ITC (30% of remaining cost) ==========
  const itcBasis = capexGross - incentivesHQ;
  const incentivesFederal = itcBasis * 0.30;
  
  // ========== STEP 8: Tax shield (DPA/CCA) ==========
  const capexNetAccounting = Math.max(0, capexGross - incentivesHQ - incentivesFederal);
  const taxShield = capexNetAccounting * h.taxRate * 0.90; // 90% of net CAPEX * tax rate
  
  // ========== STEP 9: Calculate net CAPEX and equity ==========
  const totalIncentives = incentivesHQ + incentivesFederal + taxShield;
  const capexNet = capexGross - totalIncentives;
  const equityInitial = capexGross - incentivesHQSolar - batterySubY0;
  
  // ========== STEP 10: Build 30-year cashflows (extended horizon) ==========
  // Generate 30 years of cashflows for extended analysis
  // Years 26-30: continue revenue with degradation, OPEX with escalation, no new incentives
  const MAX_ANALYSIS_YEARS = 30;
  const cashflows: CashflowEntry[] = [];
  const opexBase = (capexPV * h.omSolarPercent) + (capexBattery * h.omBatteryPercent);
  let cumulative = -equityInitial;
  
  // Year 0
  cashflows.push({
    year: 0,
    revenue: 0,
    opex: 0,
    ebitda: 0,
    investment: -equityInitial,
    dpa: 0,
    incentives: 0,
    netCashflow: -equityInitial,
    cumulative: cumulative,
  });
  
  // Years 1-30 (extended from 25 to capture full panel lifetime value)
  const degradationRate = h.degradationRatePercent || 0.004; // Default 0.4%/year
  for (let y = 1; y <= MAX_ANALYSIS_YEARS; y++) {
    // Apply panel degradation (production decreases each year)
    // Year 1 = 100%, Year 2 = 99.6%, Year 30 = ~88.6% for 0.4% degradation
    const degradationFactor = Math.pow(1 - degradationRate, y - 1);
    // Revenue = base savings * degradation * tariff inflation
    const savingsRevenue = annualSavings * degradationFactor * Math.pow(1 + h.inflationRate, y - 1);
    
    // HQ surplus revenue starts after 24 months (year 3+)
    // After first 24-month cycle, HQ pays for accumulated surplus in the bank
    const surplusRevenue = y >= 3 
      ? annualSurplusRevenue * degradationFactor * Math.pow(1 + h.inflationRate, y - 1)
      : 0;
    
    const revenue = savingsRevenue + surplusRevenue;
    const opex = opexBase * Math.pow(1 + h.omEscalation, y - 1);
    const ebitda = revenue - opex;
    
    let investment = 0;
    let dpa = 0;
    let incentives = 0;
    
    // Year 1: Tax shield and remaining battery HQ incentive
    if (y === 1) {
      dpa = taxShield;
      incentives = batterySubY1;
    }
    
    // Year 2: Federal ITC
    if (y === 2) {
      incentives = incentivesFederal;
    }
    
    // Note: Years 26-30 have no new incentives (depreciation exhausted, all credits received)
    
    // Battery replacement at configured year (adjusted for inflation and price decline)
    const replacementYear = h.batteryReplacementYear || 10;
    const replacementFactor = h.batteryReplacementCostFactor || 0.60;
    const priceDecline = h.batteryPriceDeclineRate || 0.05;
    
    if (y === replacementYear && battEnergyKWh > 0) {
      // Battery cost adjusted: inflation increases cost, but battery prices decline
      // Net effect: original_cost * replacement_factor * (1 + inflation - price_decline)^years
      const netPriceChange = Math.pow(1 + h.inflationRate - priceDecline, y);
      investment = -capexBattery * replacementFactor * netPriceChange;
    }
    
    // Second replacement at year 20
    if (y === 20 && battEnergyKWh > 0) {
      const netPriceChange = Math.pow(1 + h.inflationRate - priceDecline, y);
      investment = -capexBattery * replacementFactor * netPriceChange;
    }
    
    // Third replacement at year 30 for extended 30-year analysis
    if (y === 30 && battEnergyKWh > 0) {
      const netPriceChange = Math.pow(1 + h.inflationRate - priceDecline, y);
      investment = -capexBattery * replacementFactor * netPriceChange;
    }
    
    const netCashflow = ebitda + investment + dpa + incentives;
    cumulative += netCashflow;
    
    cashflows.push({
      year: y,
      revenue,
      opex: -opex,
      ebitda,
      investment,
      dpa,
      incentives,
      netCashflow,
      cumulative,
    });
  }
  
  // ========== STEP 11: Calculate financial metrics ==========
  const cashflowValues = cashflows.map(c => c.netCashflow);
  
  // NPV calculations (25-year standard horizon)
  const npv25 = calculateNPV(cashflowValues, h.discountRate, 25);
  const npv20 = calculateNPV(cashflowValues, h.discountRate, 20);
  const npv10 = calculateNPV(cashflowValues, h.discountRate, 10);
  
  // NPV 30-year extended horizon (captures full panel lifetime value)
  const npv30 = calculateNPV(cashflowValues, h.discountRate, 30);
  
  // IRR calculations (25-year standard horizon)
  const irr25 = calculateIRR(cashflowValues.slice(0, 26));
  const irr20 = calculateIRR(cashflowValues.slice(0, 21));
  const irr10 = calculateIRR(cashflowValues.slice(0, 11));
  
  // IRR 30-year extended horizon
  const irr30 = calculateIRR(cashflowValues.slice(0, 31));
  
  // Simple payback (unchanged - based on 25-year standard)
  let simplePaybackYears = h.analysisYears;
  for (let i = 1; i < Math.min(cashflows.length, 26); i++) {
    if (cashflows[i].cumulative >= 0) {
      simplePaybackYears = i;
      break;
    }
  }
  
  // LCOE (Levelized Cost of Energy) - 25-year standard
  // Sum production over lifetime: year 1 = 100%, year 2 = (1-deg), etc.
  let totalProduction25 = 0;
  for (let y = 1; y <= 25; y++) {
    const degradationFactor = Math.pow(1 - degradationRate, y - 1);
    totalProduction25 += pvSizeKW * effectiveYield * degradationFactor;
  }
  const totalLifetimeCost25 = capexNet + (opexBase * 25);
  const lcoe = totalProduction25 > 0 ? totalLifetimeCost25 / totalProduction25 : 0;
  
  // LCOE 30-year extended horizon (panel lifetime value)
  let totalProduction30 = 0;
  for (let y = 1; y <= 30; y++) {
    const degradationFactor = Math.pow(1 - degradationRate, y - 1);
    totalProduction30 += pvSizeKW * effectiveYield * degradationFactor;
  }
  const totalLifetimeCost30 = capexNet + (opexBase * 30);
  const lcoe30 = totalProduction30 > 0 ? totalLifetimeCost30 / totalProduction30 : 0;
  
  // ========== STEP 12: Environmental impact ==========
  const co2Factor = 0.002; // kg CO2/kWh for Quebec grid
  const co2AvoidedTonnesPerYear = (selfConsumptionKWh * co2Factor) / 1000;
  
  // ========== STEP 13: Build breakdown ==========
  const breakdown: FinancialBreakdown = {
    capexSolar: capexPV,
    capexBattery: capexBattery,
    capexGross: capexGross,
    potentialHQSolar: potentialHQSolar,
    potentialHQBattery: potentialHQBattery,
    cap40Percent: cap40Percent,
    actualHQSolar: incentivesHQSolar,
    actualHQBattery: incentivesHQBattery,
    totalHQ: incentivesHQ,
    itcBasis: itcBasis,
    itcAmount: incentivesFederal,
    depreciableBasis: capexNetAccounting,
    taxShield: taxShield,
    equityInitial: equityInitial,
    batterySubY0: batterySubY0,
    batterySubY1: batterySubY1,
    capexNet: capexNet,
  };
  
  // ========== STEP 14: Run sensitivity analysis ==========
  // Pass the configured sizing AND the calculated NPV to ensure the frontier
  // includes the current configuration as a data point
  const sensitivity = runSensitivityAnalysis(
    hourlyData,
    pvSizeKW,
    battEnergyKWh,
    battPowerKW,
    peakKW,
    annualConsumptionKWh,
    h,
    npv25  // Pass the actual NPV so frontier matches main KPIs
  );
  
  // ========== STEP 15: Find optimal scenario and recalculate if better ==========
  // The sensitivity analysis explores many scenarios - use the best one
  // Use optimalScenarioId (highest NPV) rather than isOptimal (Pareto-efficient)
  const optimalScenario = sensitivity.frontier.find(p => p.id === sensitivity.optimalScenarioId);
  
  // If forced sizing was provided, skip recalculation - respect user's explicit choice
  const hasForcedSizing = forcedSizing?.forcePvSize !== undefined || 
                          forcedSizing?.forceBatterySize !== undefined || 
                          forcedSizing?.forceBatteryPower !== undefined;
  
  // If the optimal scenario has a better NPV than our initial calculation, use its sizing
  // Skip this optimization when user explicitly specified sizing (variant creation)
  const optimalNpv = optimalScenario?.npv25 || 0;
  const shouldUseOptimal = optimalScenario && 
                           !hasForcedSizing && 
                           optimalNpv > npv25;
  
  // Use the optimal scenario if it has the best NPV and no forced sizing
  if (optimalScenario && !hasForcedSizing && optimalScenario.id !== 'current-config') {
    // Recalculate with optimal sizing
    const optPvSizeKW = optimalScenario.pvSizeKW;
    const optBattEnergyKWh = optimalScenario.battEnergyKWh;
    const optBattPowerKW = optimalScenario.battPowerKW;
    const optDemandShavingSetpointKW = Math.round(peakKW * 0.90);
    
    // Run simulation with optimal sizing
    const optSimResult = runHourlySimulation(hourlyData, optPvSizeKW, optBattEnergyKWh, optBattPowerKW, optDemandShavingSetpointKW, yieldFactor, systemParams, currentYieldSource, effectiveSnowProfile);
    
    // Recalculate all financials with optimal sizing
    const optSelfConsumptionKWh = optSimResult.totalSelfConsumption;
    const optPeakAfterKW = optSimResult.peakAfter;
    const optAnnualDemandReductionKW = peakKW - optPeakAfterKW;
    const optSelfSufficiencyPercent = annualConsumptionKWh > 0 ? (optSelfConsumptionKWh / annualConsumptionKWh) * 100 : 0;
    
    const optEnergySavings = optSelfConsumptionKWh * h.tariffEnergy;
    const optDemandSavings = optAnnualDemandReductionKW * h.tariffPower * 12;
    const optAnnualSavings = optEnergySavings + optDemandSavings;
    const optAnnualCostAfter = annualCostBefore - optAnnualSavings;
    const optSavingsYear1 = optAnnualSavings;
    
    // Use tiered pricing based on optimal system size (automatic, or override from assumptions)
    const optBaseSolarCostPerW = h.solarCostPerW ?? getTieredSolarCostPerW(optPvSizeKW);
    // Apply bifacial cost premium if enabled (same as initial calculation)
    const optEffectiveSolarCostPerW = h.bifacialEnabled 
      ? optBaseSolarCostPerW + (h.bifacialCostPremium || 0.10)
      : optBaseSolarCostPerW;
    const optCapexPV = optPvSizeKW * 1000 * optEffectiveSolarCostPerW;
    const optCapexBattery = optBattEnergyKWh * h.batteryCapacityCost + optBattPowerKW * h.batteryPowerCost;
    const optCapexGross = optCapexPV + optCapexBattery;
    
    // HQ incentives for optimal sizing
    // $1000/kW for solar, capped at 40% of CAPEX
    // Note: HQ Autoproduction program is limited to 1 MW - only first 1000 kW eligible
    // Battery: NO standalone incentive (discontinued Dec 2024), only gets overflow from solar cap
    const optEligibleSolarKW = Math.min(optPvSizeKW, 1000); // Pro-rata: only first 1 MW
    const optPotentialHQSolar = optEligibleSolarKW * 1000;
    const optPotentialHQBattery = 0; // Discontinued - no standalone battery incentive
    const optCap40Percent = optCapexGross * 0.40;
    
    // Solar gets up to $1000/kW, capped at 40% of CAPEX
    let optIncentivesHQSolar = Math.min(optPotentialHQSolar, optCap40Percent);
    
    // Battery only gets HQ credit if paired with solar AND there's leftover cap room
    let optIncentivesHQBattery = 0;
    if (optPvSizeKW > 0 && optBattEnergyKWh > 0) {
      const remainingCap = Math.max(0, optCap40Percent - optIncentivesHQSolar);
      optIncentivesHQBattery = Math.min(remainingCap, optCapexBattery);
    }
    
    const optIncentivesHQ = optIncentivesHQSolar + optIncentivesHQBattery;
    const optBatterySubY0 = optIncentivesHQBattery * 0.5;
    const optBatterySubY1 = optIncentivesHQBattery * 0.5;
    
    // Federal ITC
    const optItcBasis = optCapexGross - optIncentivesHQ;
    const optIncentivesFederal = optItcBasis * 0.30;
    
    // Tax shield
    const optCapexNetAccounting = Math.max(0, optCapexGross - optIncentivesHQ - optIncentivesFederal);
    const optTaxShield = optCapexNetAccounting * h.taxRate * 0.90;
    
    const optTotalIncentives = optIncentivesHQ + optIncentivesFederal + optTaxShield;
    const optCapexNet = optCapexGross - optTotalIncentives;
    const optEquityInitial = optCapexGross - optIncentivesHQSolar - optBatterySubY0;
    
    // Build cashflows for optimal scenario
    const optCashflows: CashflowEntry[] = [];
    const optOpexBase = optCapexPV * h.omSolarPercent + optCapexBattery * h.omBatteryPercent;
    let optCumulative = -optEquityInitial;
    optCashflows.push({
      year: 0,
      revenue: 0,
      opex: 0,
      ebitda: 0,
      investment: -optEquityInitial,
      dpa: 0,
      incentives: 0,
      netCashflow: -optEquityInitial,
      cumulative: optCumulative,
    });
    
    const optCashflowValues = [-optEquityInitial];
    const optDegradationRate = h.degradationRatePercent || 0.004; // Default 0.4%/year
    
    // Calculate surplus revenue for HQ Net Metering (Dec 2024 program)
    // Compensated at HQ cost of supply rate (NOT client tariff)
    // Source: HQ Tariff Proposal R-4270-2024 - 4.54¢/kWh
    const optHqSurplusRate = h.hqSurplusCompensationRate ?? 0.0454;
    const optAnnualSurplusRevenue = optSimResult.totalExportedKWh * optHqSurplusRate;
    
    // Build 30 years of cashflows for extended analysis
    const OPT_MAX_ANALYSIS_YEARS = 30;
    for (let y = 1; y <= OPT_MAX_ANALYSIS_YEARS; y++) {
      // Apply panel degradation (production decreases each year)
      const degradationFactor = Math.pow(1 - optDegradationRate, y - 1);
      
      // Revenue from self-consumption savings
      const savingsRevenue = optAnnualSavings * degradationFactor * Math.pow(1 + h.inflationRate, y - 1);
      
      // HQ surplus revenue starts after 24 months (year 3+)
      // Surplus kWh compensated at HQ cost of supply rate (4.54¢/kWh per R-4270-2024)
      const surplusRevenue = y >= 3 
        ? optAnnualSurplusRevenue * degradationFactor * Math.pow(1 + h.inflationRate, y - 1)
        : 0;
      
      const revenue = savingsRevenue + surplusRevenue;
      const opex = optOpexBase * Math.pow(1 + h.omEscalation, y - 1);
      const ebitda = revenue - opex;
      
      let investment = 0;
      let dpa = 0;
      let incentives = 0;
      
      // Year 1: Tax shield (CCA) and remaining 50% of HQ Battery incentive
      // This matches the original calculation and runScenarioWithSizing
      if (y === 1) {
        dpa = optTaxShield;
        incentives = optBatterySubY1;
      }
      
      // Year 2: Federal ITC arrives as tax credit
      if (y === 2) {
        incentives = optIncentivesFederal;
      }
      
      // Note: Years 26-30 have no new incentives (depreciation exhausted, all credits received)
      
      const replacementYear = h.batteryReplacementYear || 10;
      const replacementFactor = h.batteryReplacementCostFactor || 0.60;
      const priceDecline = h.batteryPriceDeclineRate || 0.05;
      
      if (y === replacementYear && optBattEnergyKWh > 0) {
        const netPriceChange = Math.pow(1 + h.inflationRate - priceDecline, y);
        investment = -optCapexBattery * replacementFactor * netPriceChange;
      }
      // Second replacement at year 20
      if (y === 20 && optBattEnergyKWh > 0) {
        const netPriceChange = Math.pow(1 + h.inflationRate - priceDecline, y);
        investment = -optCapexBattery * replacementFactor * netPriceChange;
      }
      // Third replacement at year 30 for extended 30-year analysis
      if (y === 30 && optBattEnergyKWh > 0) {
        const netPriceChange = Math.pow(1 + h.inflationRate - priceDecline, y);
        investment = -optCapexBattery * replacementFactor * netPriceChange;
      }
      
      const netCashflow = ebitda + investment + dpa + incentives;
      optCumulative += netCashflow;
      
      optCashflows.push({
        year: y,
        revenue,
        opex,
        ebitda,
        investment,
        dpa,
        incentives,
        netCashflow,
        cumulative: optCumulative,
      });
      optCashflowValues.push(ebitda + investment + dpa + incentives);
    }
    
    // Calculate NPV and IRR for optimal (25-year standard horizon)
    const optNpv25 = calculateNPV(optCashflowValues, h.discountRate, 25);
    const optNpv10 = calculateNPV(optCashflowValues, h.discountRate, 10);
    const optNpv20 = calculateNPV(optCashflowValues, h.discountRate, 20);
    const optIrr25 = calculateIRR(optCashflowValues.slice(0, 26));
    const optIrr10 = calculateIRR(optCashflowValues.slice(0, 11));
    const optIrr20 = calculateIRR(optCashflowValues.slice(0, 21));
    
    // 30-year extended horizon metrics
    const optNpv30 = calculateNPV(optCashflowValues, h.discountRate, 30);
    const optIrr30 = calculateIRR(optCashflowValues.slice(0, 31));
    
    // Simple payback (25-year standard)
    let optSimplePaybackYears = h.analysisYears;
    for (const cf of optCashflows) {
      if (cf.cumulative >= 0 && cf.year > 0 && cf.year <= 25) {
        optSimplePaybackYears = cf.year;
        break;
      }
    }
    
    // LCOE - with degradation (25-year standard)
    // SIMPLIFIED: For Google yield, use pure Google data × bifacial only
    let optEffectiveYield: number;
    if (h.yieldSource === 'google') {
      const googleBaseYield = h.solarYieldKWhPerKWp || 1079;
      optEffectiveYield = googleBaseYield * (h.bifacialEnabled ? 1.15 : 1.0);
    } else {
      const baseYield = h.solarYieldKWhPerKWp || BASELINE_YIELD;
      const orientationFactor = Math.max(0.6, Math.min(1.0, h.orientationFactor || 1.0));
      optEffectiveYield = baseYield * orientationFactor * (h.bifacialEnabled ? 1.15 : 1.0);
    }
    let optTotalProduction25 = 0;
    for (let y = 1; y <= 25; y++) {
      const degradationFactor = Math.pow(1 - optDegradationRate, y - 1);
      optTotalProduction25 += optPvSizeKW * optEffectiveYield * degradationFactor;
    }
    const optTotalLifetimeCost25 = optCapexNet + (optOpexBase * 25);
    const optLcoe = optTotalProduction25 > 0 ? optTotalLifetimeCost25 / optTotalProduction25 : 0;
    
    // LCOE 30-year extended horizon
    let optTotalProduction30 = 0;
    for (let y = 1; y <= 30; y++) {
      const degradationFactor = Math.pow(1 - optDegradationRate, y - 1);
      optTotalProduction30 += optPvSizeKW * optEffectiveYield * degradationFactor;
    }
    const optTotalLifetimeCost30 = optCapexNet + (optOpexBase * 30);
    const optLcoe30 = optTotalProduction30 > 0 ? optTotalLifetimeCost30 / optTotalProduction30 : 0;
    
    // CO2
    const optCo2AvoidedTonnesPerYear = (optSelfConsumptionKWh * 0.002) / 1000;
    
    // Build breakdown
    const optBreakdown: FinancialBreakdown = {
      capexSolar: optCapexPV,
      capexBattery: optCapexBattery,
      capexGross: optCapexGross,
      potentialHQSolar: optPotentialHQSolar,
      potentialHQBattery: optPotentialHQBattery,
      cap40Percent: optCap40Percent,
      actualHQSolar: optIncentivesHQSolar,
      actualHQBattery: optIncentivesHQBattery,
      totalHQ: optIncentivesHQ,
      itcBasis: optItcBasis,
      itcAmount: optIncentivesFederal,
      depreciableBasis: optCapexNetAccounting,
      taxShield: optTaxShield,
      equityInitial: optEquityInitial,
      batterySubY0: optBatterySubY0,
      batterySubY1: optBatterySubY1,
      capexNet: optCapexNet,
    };
    
    // REGENERATE sensitivity with the FINAL sizing and NPV so charts match KPIs
    // This ensures the "current-config" point shows the actual NPV being displayed
    let finalSensitivity = runSensitivityAnalysis(
      hourlyData,
      optPvSizeKW,
      optBattEnergyKWh,
      optBattPowerKW,
      peakKW,
      annualConsumptionKWh,
      h,
      optNpv25  // Pass the FINAL NPV from the recalculation
    );
    
    // Check if regenerated sensitivity found a BETTER optimal (recursive improvement)
    // This handles cases where initial auto-sizing was far from optimal
    const regenOptimal = finalSensitivity.frontier.find(p => p.id === finalSensitivity.optimalScenarioId);
    if (regenOptimal && regenOptimal.id !== 'current-config' && regenOptimal.npv25 > optNpv25) {
      // Found a better optimal! Use its sizing instead
      
      const finalPvSizeKW = regenOptimal.pvSizeKW;
      const finalBattEnergyKWh = regenOptimal.battEnergyKWh;
      const finalBattPowerKW = regenOptimal.battPowerKW;
      
      // Run full simulation with the truly optimal sizing
      const finalSimResult = runHourlySimulation(hourlyData, finalPvSizeKW, finalBattEnergyKWh, finalBattPowerKW, optDemandShavingSetpointKW, yieldFactor, systemParams, currentYieldSource, effectiveSnowProfile);
      
      // Quick recalculate NPV for the truly optimal sizing
      const finalResult = runScenarioWithSizing(
        hourlyData, finalPvSizeKW, finalBattEnergyKWh, finalBattPowerKW,
        peakKW, annualConsumptionKWh, h
      );
      
      // Update the variables for return
      const trueOptNpv25 = finalResult.npv25;
      const trueOptCapexNet = finalResult.capexNet;
      
      // Regenerate sensitivity one more time with the truly optimal sizing
      finalSensitivity = runSensitivityAnalysis(
        hourlyData,
        finalPvSizeKW,
        finalBattEnergyKWh,
        finalBattPowerKW,
        peakKW,
        annualConsumptionKWh,
        h,
        trueOptNpv25
      );
      
      // Calculate LCOE for final sizing
      const finalEffectiveYield = effectiveYield; // Use same yield factor
      let finalTotalProduction = 0;
      for (let y = 1; y <= h.analysisYears; y++) {
        const degradationFactor = Math.pow(1 - degradationRate, y - 1);
        finalTotalProduction += finalPvSizeKW * finalEffectiveYield * degradationFactor;
      }
      // Use tiered pricing based on final system size
      const finalBaseCostPerW = h.solarCostPerW ?? getTieredSolarCostPerW(finalPvSizeKW);
      const finalOpexBase = (finalPvSizeKW * 1000 * finalBaseCostPerW) * 0.01; // 1% of solar CAPEX
      const finalTotalLifetimeCost = trueOptCapexNet + (finalOpexBase * h.analysisYears);
      const finalLcoe = finalTotalProduction > 0 ? finalTotalLifetimeCost / finalTotalProduction : 0;
      
      // Calculate CO2 avoided
      const co2Factor = 0.002; // kg CO2/kWh for Quebec grid
      const finalCo2AvoidedTonnesPerYear = (finalSimResult.totalSelfConsumption * co2Factor) / 1000;
      
      // Calculate annual savings
      const finalAnnualSavings = finalSimResult.totalSelfConsumption * h.tariffEnergy + (peakKW - finalSimResult.peakAfter) * h.tariffPower * 12;
      
      // Build correct breakdown for final sizing (not the stale optBreakdown)
      const finalCapexPV = finalPvSizeKW * 1000 * finalBaseCostPerW;
      const finalCapexBattery = finalBattEnergyKWh * h.batteryCapacityCost + finalBattPowerKW * h.batteryPowerCost;
      const finalCapexGross = finalCapexPV + finalCapexBattery;
      // HQ Autoproduction program limited to 1 MW - only first 1000 kW eligible
      const finalEligibleSolarKW = Math.min(finalPvSizeKW, 1000);
      const finalPotentialHQSolar = finalEligibleSolarKW * 1000;
      const finalPotentialHQBattery = finalBattEnergyKWh * 150;
      const finalCap40Percent = finalCapexGross * 0.40;
      const finalIncentivesHQSolar = finalResult.incentivesHQSolar || 0;
      const finalIncentivesHQBattery = finalResult.incentivesHQBattery || 0;
      const finalIncentivesHQ = finalResult.incentivesHQ || 0;
      const finalBatterySubY0 = finalIncentivesHQBattery * 0.5;
      const finalBatterySubY1 = finalIncentivesHQBattery * 0.5;
      const finalItcBasis = finalCapexGross - finalIncentivesHQ;
      const finalIncentivesFederal = finalResult.incentivesFederal || 0;
      const finalCapexNetAccounting = finalCapexGross - finalIncentivesHQ - finalIncentivesFederal;
      const finalTaxShield = finalResult.taxShield || 0;
      const finalEquityInitial = finalCapexGross - finalIncentivesHQSolar - finalBatterySubY0;
      
      const finalBreakdown: FinancialBreakdown = {
        capexSolar: finalCapexPV,
        capexBattery: finalCapexBattery,
        capexGross: finalCapexGross,
        potentialHQSolar: finalPotentialHQSolar,
        potentialHQBattery: finalPotentialHQBattery,
        cap40Percent: finalCap40Percent,
        actualHQSolar: finalIncentivesHQSolar,
        actualHQBattery: finalIncentivesHQBattery,
        totalHQ: finalIncentivesHQ,
        itcBasis: finalItcBasis,
        itcAmount: finalIncentivesFederal,
        depreciableBasis: finalCapexNetAccounting,
        taxShield: finalTaxShield,
        equityInitial: finalEquityInitial,
        batterySubY0: finalBatterySubY0,
        batterySubY1: finalBatterySubY1,
        capexNet: trueOptCapexNet,
      };
      
      // Return the truly optimal result
      return {
        pvSizeKW: finalPvSizeKW,
        battEnergyKWh: finalBattEnergyKWh,
        battPowerKW: finalBattPowerKW,
        demandShavingSetpointKW: optDemandShavingSetpointKW,
        annualConsumptionKWh,
        peakDemandKW,
        annualEnergySavingsKWh: finalSimResult.totalSelfConsumption,
        annualDemandReductionKW: peakKW - finalSimResult.peakAfter,
        selfConsumptionKWh: finalSimResult.totalSelfConsumption,
        selfSufficiencyPercent: annualConsumptionKWh > 0 ? (finalSimResult.totalSelfConsumption / annualConsumptionKWh) * 100 : 0,
        totalProductionKWh: finalSimResult.totalProductionKWh,
        totalExportedKWh: finalSimResult.totalExportedKWh,
        annualSurplusRevenue: finalSimResult.totalExportedKWh * (h.hqSurplusCompensationRate ?? 0.0454),
        annualCostBefore,
        annualCostAfter: annualCostBefore - finalAnnualSavings,
        annualSavings: finalAnnualSavings,
        savingsYear1: finalAnnualSavings,
        capexGross: (finalPvSizeKW * 1000 * finalBaseCostPerW) + (finalBattEnergyKWh * h.batteryCapacityCost + finalBattPowerKW * h.batteryPowerCost),
        capexPV: finalPvSizeKW * 1000 * finalBaseCostPerW,
        capexBattery: finalBattEnergyKWh * h.batteryCapacityCost + finalBattPowerKW * h.batteryPowerCost,
        incentivesHQ: finalResult.incentivesHQ || 0,
        incentivesHQSolar: finalResult.incentivesHQSolar || 0,
        incentivesHQBattery: finalResult.incentivesHQBattery || 0,
        incentivesFederal: finalResult.incentivesFederal || 0,
        taxShield: finalResult.taxShield || 0,
        totalIncentives: (finalResult.incentivesHQ || 0) + (finalResult.incentivesFederal || 0) + (finalResult.taxShield || 0),
        capexNet: trueOptCapexNet,
        npv25: trueOptNpv25,
        npv10: finalResult.npv10 || 0,
        npv20: finalResult.npv20 || 0,
        irr25: finalResult.irr25,
        irr10: finalResult.irr10 || 0,
        irr20: finalResult.irr20 || 0,
        simplePaybackYears: finalAnnualSavings > 0 ? Math.ceil(trueOptCapexNet / finalAnnualSavings) : h.analysisYears,
        lcoe: finalLcoe,
        npv30: optNpv30,
        irr30: optIrr30,
        lcoe30: optLcoe30,
        co2AvoidedTonnesPerYear: finalCo2AvoidedTonnesPerYear,
        assumptions: h,
        cashflows: finalResult.cashflows || [],
        breakdown: finalBreakdown,
        hourlyProfile: finalSimResult.hourlyProfile,
        peakWeekData: finalSimResult.peakWeekData,
        sensitivity: finalSensitivity,
        interpolatedMonths,
      };
    }
    
    log.info(`Returning RECALCULATED result: pvSizeKW=${optPvSizeKW}, optimalId=${optimalScenario.id}`);
    
    return {
      pvSizeKW: optPvSizeKW,
      battEnergyKWh: optBattEnergyKWh,
      battPowerKW: optBattPowerKW,
      demandShavingSetpointKW: optDemandShavingSetpointKW,
      annualConsumptionKWh,
      peakDemandKW,
      annualEnergySavingsKWh: optSelfConsumptionKWh,
      annualDemandReductionKW: optAnnualDemandReductionKW,
      selfConsumptionKWh: optSelfConsumptionKWh,
      selfSufficiencyPercent: optSelfSufficiencyPercent,
      totalProductionKWh: optSimResult.totalProductionKWh,
      totalExportedKWh: optSimResult.totalExportedKWh,
      annualSurplusRevenue: optSimResult.totalExportedKWh * (h.hqSurplusCompensationRate ?? 0.0454),
      annualCostBefore,
      annualCostAfter: optAnnualCostAfter,
      annualSavings: optAnnualSavings,
      savingsYear1: optSavingsYear1,
      capexGross: optCapexGross,
      capexPV: optCapexPV,
      capexBattery: optCapexBattery,
      incentivesHQ: optIncentivesHQ,
      incentivesHQSolar: optIncentivesHQSolar,
      incentivesHQBattery: optIncentivesHQBattery,
      incentivesFederal: optIncentivesFederal,
      taxShield: optTaxShield,
      totalIncentives: optTotalIncentives,
      capexNet: optCapexNet,
      npv25: optNpv25,
      npv10: optNpv10,
      npv20: optNpv20,
      irr25: optIrr25,
      irr10: optIrr10,
      irr20: optIrr20,
      simplePaybackYears: optSimplePaybackYears,
      lcoe: optLcoe,
      npv30: optNpv30,
      irr30: optIrr30,
      lcoe30: optLcoe30,
      co2AvoidedTonnesPerYear: optCo2AvoidedTonnesPerYear,
      assumptions: h,
      cashflows: optCashflows,
      breakdown: optBreakdown,
      hourlyProfile: optSimResult.hourlyProfile,
      peakWeekData: optSimResult.peakWeekData,
      sensitivity: finalSensitivity,  // Use regenerated sensitivity
      interpolatedMonths,
    };
  }
  
  // Return initial calculation if it's already optimal
  return {
    pvSizeKW,
    battEnergyKWh,
    battPowerKW,
    demandShavingSetpointKW,
    annualConsumptionKWh,
    peakDemandKW,
    annualEnergySavingsKWh: selfConsumptionKWh,
    annualDemandReductionKW,
    selfConsumptionKWh,
    selfSufficiencyPercent,
    totalProductionKWh,
    totalExportedKWh,
    annualSurplusRevenue,
    annualCostBefore,
    annualCostAfter,
    annualSavings,
    savingsYear1,
    capexGross,
    capexPV,
    capexBattery,
    incentivesHQ,
    incentivesHQSolar,
    incentivesHQBattery,
    incentivesFederal,
    taxShield,
    totalIncentives,
    capexNet,
    npv25,
    npv10,
    npv20,
    irr25,
    irr10,
    irr20,
    simplePaybackYears,
    lcoe,
    npv30,
    irr30,
    lcoe30,
    co2AvoidedTonnesPerYear,
    assumptions: h,
    cashflows,
    breakdown,
    hourlyProfile: simResult.hourlyProfile,
    peakWeekData: simResult.peakWeekData,
    sensitivity,
    interpolatedMonths,
  };
}

// Build hourly data from readings (8760 hours) with interpolation for missing months
function buildHourlyData(readings: Array<{ kWh: number | null; kW: number | null; timestamp: Date }>): {
  hourlyData: Array<{ hour: number; month: number; consumption: number; peak: number }>;
  interpolatedMonths: number[];
} {
  // Group readings by hour of day and month to create average profile
  const hourlyByHourMonth: Map<string, { totalKWh: number; maxKW: number; count: number }> = new Map();
  
  for (const r of readings) {
    const hour = r.timestamp.getHours();
    const month = r.timestamp.getMonth() + 1;
    const key = `${month}-${hour}`;
    
    const existing = hourlyByHourMonth.get(key) || { totalKWh: 0, maxKW: 0, count: 0 };
    existing.totalKWh += r.kWh || 0;
    existing.maxKW = Math.max(existing.maxKW, r.kW || 0);
    existing.count++;
    hourlyByHourMonth.set(key, existing);
  }
  
  // Detect which months have NO data at all (missing entirely)
  const monthsWithData: Set<number> = new Set();
  for (let month = 1; month <= 12; month++) {
    let hasAnyData = false;
    for (let hour = 0; hour < 24; hour++) {
      const key = `${month}-${hour}`;
      const data = hourlyByHourMonth.get(key);
      if (data && data.count > 0) {
        hasAnyData = true;
        break;
      }
    }
    if (hasAnyData) {
      monthsWithData.add(month);
    }
  }
  
  // Track which months were interpolated
  const interpolatedMonths: number[] = [];
  
  // For missing months, interpolate from adjacent months
  for (let month = 1; month <= 12; month++) {
    if (!monthsWithData.has(month)) {
      interpolatedMonths.push(month);
      
      // Find closest previous month with data
      let prevMonth: number | null = null;
      for (let p = month - 1; p >= 1; p--) {
        if (monthsWithData.has(p)) {
          prevMonth = p;
          break;
        }
      }
      // Wrap around to December if needed
      if (prevMonth === null) {
        for (let p = 12; p > month; p--) {
          if (monthsWithData.has(p)) {
            prevMonth = p;
            break;
          }
        }
      }
      
      // Find closest next month with data
      let nextMonth: number | null = null;
      for (let n = month + 1; n <= 12; n++) {
        if (monthsWithData.has(n)) {
          nextMonth = n;
          break;
        }
      }
      // Wrap around to January if needed
      if (nextMonth === null) {
        for (let n = 1; n < month; n++) {
          if (monthsWithData.has(n)) {
            nextMonth = n;
            break;
          }
        }
      }
      
      // Interpolate each hour for the missing month
      for (let hour = 0; hour < 24; hour++) {
        let avgConsumption = 0;
        let avgPeak = 0;
        let sourceCount = 0;
        
        if (prevMonth !== null) {
          const prevKey = `${prevMonth}-${hour}`;
          const prevData = hourlyByHourMonth.get(prevKey);
          if (prevData && prevData.count > 0) {
            avgConsumption += prevData.totalKWh / prevData.count;
            avgPeak += prevData.maxKW;
            sourceCount++;
          }
        }
        
        if (nextMonth !== null && nextMonth !== prevMonth) {
          const nextKey = `${nextMonth}-${hour}`;
          const nextData = hourlyByHourMonth.get(nextKey);
          if (nextData && nextData.count > 0) {
            avgConsumption += nextData.totalKWh / nextData.count;
            avgPeak += nextData.maxKW;
            sourceCount++;
          }
        }
        
        // Store interpolated values (default to 0 if no source data to avoid NaN)
        const key = `${month}-${hour}`;
        hourlyByHourMonth.set(key, {
          totalKWh: sourceCount > 0 ? avgConsumption / sourceCount : 0,
          maxKW: sourceCount > 0 ? avgPeak / sourceCount : 0,
          count: 1, // Mark as having 1 "virtual" data point
        });
      }
    }
  }
  
  // Build 8760-hour profile
  const hourlyData: Array<{ hour: number; month: number; consumption: number; peak: number }> = [];
  
  for (let month = 1; month <= 12; month++) {
    const daysInMonth = new Date(2025, month, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const key = `${month}-${hour}`;
        const data = hourlyByHourMonth.get(key);
        
        if (data && data.count > 0) {
          hourlyData.push({
            hour,
            month,
            consumption: data.totalKWh / data.count,
            peak: data.maxKW,
          });
        } else {
          // Use default values if no data (shouldn't happen after interpolation unless ALL months missing)
          hourlyData.push({
            hour,
            month,
            consumption: 0,
            peak: 0,
          });
        }
      }
    }
  }
  
  return { hourlyData, interpolatedMonths };
}

// PVSyst-calibrated system modeling parameters (Source: Rematek PVSyst Feb 2026)
interface SystemModelingParams {
  inverterLoadRatio: number;            // DC/AC ratio (ILR) - default 1.45 (PVSyst range 1.44-1.47)
  temperatureCoefficient: number;       // Power temp coefficient %/°C - default -0.004
  wireLossPercent: number;              // DC wiring losses - default 3% (PVSyst validated)
  skipTempCorrection: boolean;          // Skip temp correction when using Google yield (already weather-adjusted)
  lidLossPercent: number;               // Light Induced Degradation - default 1% (PVSyst validated)
  mismatchLossPercent: number;          // Module mismatch at MPP - default 2% (PVSyst validated)
  mismatchStringsLossPercent: number;   // String mismatch - default 0.15% (PVSyst validated)
  moduleQualityGainPercent: number;     // Module quality gain (negative loss) - default 0.75% (PVSyst validated)
}

function runHourlySimulation(
  hourlyData: Array<{ hour: number; month: number; consumption: number; peak: number }>,
  pvSizeKW: number,
  battEnergyKWh: number,
  battPowerKW: number,
  threshold: number,
  solarYieldFactor: number = 1.0,
  systemParams: SystemModelingParams = { inverterLoadRatio: 1.45, temperatureCoefficient: -0.004, wireLossPercent: 0.03, skipTempCorrection: false, lidLossPercent: 0.01, mismatchLossPercent: 0.02, mismatchStringsLossPercent: 0.0015, moduleQualityGainPercent: 0.0075 },
  yieldSource: 'google' | 'manual' | 'default' = 'default',
  snowLossProfile?: 'none' | 'flat_roof' | 'tilted'
) {
  return centralRunHourlySimulation(hourlyData, pvSizeKW, battEnergyKWh, battPowerKW, threshold, solarYieldFactor, systemParams, yieldSource, snowLossProfile);
}

function calculateNPV(cashflows: number[], rate: number, years: number): number {
  return centralCalculateNPV(cashflows, rate, years);
}

function calculateIRR(cashflows: number[]): number {
  return centralCalculateIRR(cashflows);
}

function runScenarioWithSizing(
  hourlyData: Array<{ hour: number; month: number; consumption: number; peak: number }>,
  pvSizeKW: number,
  battEnergyKWh: number,
  battPowerKW: number,
  peakKW: number,
  annualConsumptionKWh: number,
  assumptions: AnalysisAssumptions
) {
  return centralRunScenarioWithSizing(hourlyData, pvSizeKW, battEnergyKWh, battPowerKW, peakKW, annualConsumptionKWh, assumptions);
}

function runSensitivityAnalysis(
  hourlyData: Array<{ hour: number; month: number; consumption: number; peak: number }>,
  configuredPvSizeKW: number,
  configuredBattEnergyKWh: number,
  configuredBattPowerKW: number,
  peakKW: number,
  annualConsumptionKWh: number,
  assumptions: AnalysisAssumptions,
  configuredNpv25?: number
): SensitivityAnalysis {
  return centralRunSensitivityAnalysis(hourlyData, configuredPvSizeKW, configuredBattEnergyKWh, configuredBattPowerKW, peakKW, annualConsumptionKWh, assumptions, configuredNpv25);
}
