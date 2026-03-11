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
import { calculateCashflowMetrics } from "./analysis/cashflowCalculations";
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
      { path: "/stockage-energie", priority: "0.7", changefreq: "monthly" },
      { path: "/portfolio", priority: "0.6", changefreq: "monthly" },
      { path: "/nouvelles", priority: "0.7", changefreq: "daily" },
      { path: "/mandat-de-conception-preliminaire", priority: "0.6", changefreq: "monthly" },
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
  app.use("/api/eos", eosRouter);

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
  
  let effectiveSnowProfile: 'none' | 'flat_roof' | 'tilted' | 'ballasted_10deg' | undefined = h.snowLossProfile;
  if (currentYieldSource === 'google' && (!effectiveSnowProfile || effectiveSnowProfile === 'none')) {
    effectiveSnowProfile = 'ballasted_10deg';
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
  
  // ========== STEPS 4-13: Financial calculations via shared module ==========
  const financials = calculateCashflowMetrics({
    pvSizeKW,
    battEnergyKWh,
    battPowerKW,
    selfConsumptionKWh,
    totalExportedKWh,
    totalProductionKWh,
    gridChargingKWh: simResult.totalGridChargingKWh,
    annualConsumptionKWh,
    peakBeforeKW: peakKW,
    peakAfterKW: simResult.peakAfter,
    effectiveYield,
    assumptions: h,
  });

  // Extract for downstream code
  const { annualSavings, annualCostBefore, annualCostAfter, annualSurplusRevenue,
          capexGross, capexNet, incentivesHQ, incentivesHQSolar, incentivesHQBattery,
          incentivesFederal, taxShield, co2AvoidedTonnesPerYear,
          npv25, npv20, npv10, npv30, irr25, irr20, irr10, irr30,
          lcoe, lcoe30, simplePaybackYears,
          cashflows, breakdown } = financials;
  const capexPV = financials.capexSolar;
  const capexBattery = financials.capexBattery;
  const totalIncentives = incentivesHQ + incentivesFederal + taxShield;
  const savingsYear1 = annualSavings;
  const demandSavings = annualSavings - (selfConsumptionKWh * h.tariffEnergy - simResult.totalGridChargingKWh * h.tariffEnergy);

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
    
    // Recalculate all financials with optimal sizing via shared module
    const optFinancials = calculateCashflowMetrics({
      pvSizeKW: optPvSizeKW,
      battEnergyKWh: optBattEnergyKWh,
      battPowerKW: optBattPowerKW,
      selfConsumptionKWh: optSimResult.totalSelfConsumption,
      totalExportedKWh: optSimResult.totalExportedKWh,
      totalProductionKWh: optSimResult.totalProductionKWh,
      gridChargingKWh: optSimResult.totalGridChargingKWh,
      annualConsumptionKWh,
      peakBeforeKW: peakKW,
      peakAfterKW: optSimResult.peakAfter,
      effectiveYield,
      assumptions: h,
    });

    const optSelfConsumptionKWh = optSimResult.totalSelfConsumption;
    const optAnnualDemandReductionKW = peakKW - optSimResult.peakAfter;
    const optSelfSufficiencyPercent = optFinancials.selfSufficiencyPercent;

    // REGENERATE sensitivity with the FINAL sizing and NPV so charts match KPIs
    let finalSensitivity = runSensitivityAnalysis(
      hourlyData, optPvSizeKW, optBattEnergyKWh, optBattPowerKW,
      peakKW, annualConsumptionKWh, h,
      optFinancials.npv25  // Pass the FINAL NPV from the recalculation
    );

    // Check if regenerated sensitivity found a BETTER optimal (recursive improvement)
    const regenOptimal = finalSensitivity.frontier.find(p => p.id === finalSensitivity.optimalScenarioId);
    if (regenOptimal && regenOptimal.id !== 'current-config' && regenOptimal.npv25 > optFinancials.npv25) {
      // Found a better optimal! Recalculate everything via shared module
      const finalPvSizeKW = regenOptimal.pvSizeKW;
      const finalBattEnergyKWh = regenOptimal.battEnergyKWh;
      const finalBattPowerKW = regenOptimal.battPowerKW;

      const finalSimResult = runHourlySimulation(hourlyData, finalPvSizeKW, finalBattEnergyKWh, finalBattPowerKW, optDemandShavingSetpointKW, yieldFactor, systemParams, currentYieldSource, effectiveSnowProfile);

      const finalFinancials = calculateCashflowMetrics({
        pvSizeKW: finalPvSizeKW,
        battEnergyKWh: finalBattEnergyKWh,
        battPowerKW: finalBattPowerKW,
        selfConsumptionKWh: finalSimResult.totalSelfConsumption,
        totalExportedKWh: finalSimResult.totalExportedKWh,
        totalProductionKWh: finalSimResult.totalProductionKWh,
        gridChargingKWh: finalSimResult.totalGridChargingKWh,
        annualConsumptionKWh,
        peakBeforeKW: peakKW,
        peakAfterKW: finalSimResult.peakAfter,
        effectiveYield,
        assumptions: h,
      });

      // Regenerate sensitivity one more time with the truly optimal sizing
      finalSensitivity = runSensitivityAnalysis(
        hourlyData, finalPvSizeKW, finalBattEnergyKWh, finalBattPowerKW,
        peakKW, annualConsumptionKWh, h, finalFinancials.npv25
      );

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
        selfSufficiencyPercent: finalFinancials.selfSufficiencyPercent,
        totalProductionKWh: finalSimResult.totalProductionKWh,
        totalExportedKWh: finalSimResult.totalExportedKWh,
        annualSurplusRevenue: finalFinancials.annualSurplusRevenue,
        annualCostBefore,
        annualCostAfter: finalFinancials.annualCostAfter,
        annualSavings: finalFinancials.annualSavings,
        savingsYear1: finalFinancials.annualSavings,
        capexGross: finalFinancials.capexGross,
        capexPV: finalFinancials.capexSolar,
        capexBattery: finalFinancials.capexBattery,
        incentivesHQ: finalFinancials.incentivesHQ,
        incentivesHQSolar: finalFinancials.incentivesHQSolar,
        incentivesHQBattery: finalFinancials.incentivesHQBattery,
        incentivesFederal: finalFinancials.incentivesFederal,
        taxShield: finalFinancials.taxShield,
        totalIncentives: finalFinancials.incentivesHQ + finalFinancials.incentivesFederal + finalFinancials.taxShield,
        capexNet: finalFinancials.capexNet,
        npv25: finalFinancials.npv25,
        npv10: finalFinancials.npv10,
        npv20: finalFinancials.npv20,
        irr25: finalFinancials.irr25,
        irr10: finalFinancials.irr10,
        irr20: finalFinancials.irr20,
        simplePaybackYears: finalFinancials.simplePaybackYears,
        lcoe: finalFinancials.lcoe,
        npv30: finalFinancials.npv30,
        irr30: finalFinancials.irr30,
        lcoe30: finalFinancials.lcoe30,
        co2AvoidedTonnesPerYear: finalFinancials.co2AvoidedTonnesPerYear,
        assumptions: h,
        cashflows: finalFinancials.cashflows,
        breakdown: finalFinancials.breakdown,
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
      annualSurplusRevenue: optFinancials.annualSurplusRevenue,
      annualCostBefore,
      annualCostAfter: optFinancials.annualCostAfter,
      annualSavings: optFinancials.annualSavings,
      savingsYear1: optFinancials.annualSavings,
      capexGross: optFinancials.capexGross,
      capexPV: optFinancials.capexSolar,
      capexBattery: optFinancials.capexBattery,
      incentivesHQ: optFinancials.incentivesHQ,
      incentivesHQSolar: optFinancials.incentivesHQSolar,
      incentivesHQBattery: optFinancials.incentivesHQBattery,
      incentivesFederal: optFinancials.incentivesFederal,
      taxShield: optFinancials.taxShield,
      totalIncentives: optFinancials.incentivesHQ + optFinancials.incentivesFederal + optFinancials.taxShield,
      capexNet: optFinancials.capexNet,
      npv25: optFinancials.npv25,
      npv10: optFinancials.npv10,
      npv20: optFinancials.npv20,
      irr25: optFinancials.irr25,
      irr10: optFinancials.irr10,
      irr20: optFinancials.irr20,
      simplePaybackYears: optFinancials.simplePaybackYears,
      lcoe: optFinancials.lcoe,
      npv30: optFinancials.npv30,
      irr30: optFinancials.irr30,
      lcoe30: optFinancials.lcoe30,
      co2AvoidedTonnesPerYear: optFinancials.co2AvoidedTonnesPerYear,
      assumptions: h,
      cashflows: optFinancials.cashflows,
      breakdown: optFinancials.breakdown,
      hourlyProfile: optSimResult.hourlyProfile,
      peakWeekData: optSimResult.peakWeekData,
      sensitivity: finalSensitivity,
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
  snowLossProfile?: 'none' | 'flat_roof' | 'tilted' | 'ballasted_10deg'
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
