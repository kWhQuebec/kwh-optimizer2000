import { Router, Response } from "express";
import { authMiddleware, requireStaff, AuthRequest } from "../middleware/auth";
import { storage } from "../storage";
import type { Site } from "@shared/schema";
import { createLogger } from "../lib/logger";

const log = createLogger("KBRacking");
const router = Router();

interface KBRackingEstimate {
  panelCount: number;
  subtotal: number;
  pricePerPanel: number;
  items?: Array<{ name: string; quantity: number; unitPrice: number; total: number }>;
}

interface KBRackingSpecs {
  railLengthM: number;
  panelsPerRail: number;
  clampsPerPanel: number;
  [key: string]: unknown;
}

interface KBProposalPDFOptions {
  companyName?: string;
  companyPhone?: string;
  companyEmail?: string;
  quoteDate?: Date;
  quoteValidityDays?: number;
  quoteNumber?: string;
}

interface SiteWithKBData extends Site {
  kbDesignStatus?: string;
  kbPanelCount?: number;
  kbKwDc?: number;
  kbRackingSubtotal?: number;
  kbPricePerPanel?: number;
  kbQuoteExpiry?: Date | string | null;
  kbQuoteDate?: Date | string | null;
  kbQuoteNumber?: string | null;
}

interface ExpiringQuoteSite {
  id: string;
  name: string;
  address: string | null;
  kbPanelCount: number | null;
  kbKwDc: number | null;
  kbRackingSubtotal: number | null;
  kbQuoteDate: Date | string | null;
  kbQuoteExpiry: Date | string | null;
  daysUntilExpiry: number;
}

let kbRackingModule: {
  estimateKBRackingCost: (panelCount: number) => KBRackingEstimate;
  generateBOM: (panelCount: number) => Array<{ name: string; quantity: number; unitPrice: number; total: number }>;
  estimatePanelCountFromArea: (areaSqM: number) => number;
  KB_RACKING_SPECS: KBRackingSpecs;
  isQuoteExpiringSoon: (expiry: Date | null) => boolean;
  isQuoteExpired: (expiry: Date | null) => boolean;
} | null = null;

async function getKBRackingModule() {
  if (!kbRackingModule) {
    kbRackingModule = await import("../kbRackingEstimator");
  }
  return kbRackingModule;
}

router.get("/api/kb-racking/estimate", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const { estimateKBRackingCost } = await getKBRackingModule();
    const panelCount = parseInt(req.query.panels as string) || 0;
    if (panelCount <= 0) {
      return res.status(400).json({ error: "Panel count must be greater than 0" });
    }
    
    const estimate = estimateKBRackingCost(panelCount);
    res.json(estimate);
  } catch (error) {
    log.error("Error estimating KB Racking cost:", error);
    res.status(500).json({ error: "Failed to estimate racking cost" });
  }
});

router.get("/api/kb-racking/estimate-from-area", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const { estimateKBRackingCost, estimatePanelCountFromArea } = await getKBRackingModule();
    const areaSqM = parseFloat(req.query.area as string) || 0;
    if (areaSqM <= 0) {
      return res.status(400).json({ error: "Area must be greater than 0" });
    }
    
    const panelCount = estimatePanelCountFromArea(areaSqM);
    const estimate = estimateKBRackingCost(panelCount);
    res.json({
      roofAreaSqM: areaSqM,
      ...estimate,
    });
  } catch (error) {
    log.error("Error estimating from area:", error);
    res.status(500).json({ error: "Failed to estimate from area" });
  }
});

router.get("/api/kb-racking/bom/:panelCount", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const { estimateKBRackingCost, generateBOM, KB_RACKING_SPECS } = await getKBRackingModule();
    const panelCount = parseInt(req.params.panelCount) || 0;
    if (panelCount <= 0) {
      return res.status(400).json({ error: "Panel count must be greater than 0" });
    }
    
    const bom = generateBOM(panelCount);
    const estimate = estimateKBRackingCost(panelCount);
    
    res.json({
      summary: estimate,
      items: bom,
      specs: KB_RACKING_SPECS,
    });
  } catch (error) {
    log.error("Error generating BOM:", error);
    res.status(500).json({ error: "Failed to generate BOM" });
  }
});

router.get("/api/kb-racking/specs", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { KB_RACKING_SPECS } = await getKBRackingModule();
    res.json(KB_RACKING_SPECS);
  } catch (error) {
    log.error("Error fetching specs:", error);
    res.status(500).json({ error: "Failed to fetch specs" });
  }
});

router.get("/api/kb-racking/portfolio-stats", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const { isQuoteExpiringSoon, isQuoteExpired } = await getKBRackingModule();
    const portfolioId = req.query.portfolioId as string | undefined;
    
    const allSites = await storage.getSites() as SiteWithKBData[];
    let sitesWithKB = allSites.filter((s) => s.kbDesignStatus === "complete");
    
    if (portfolioId) {
      const portfolioSites = await storage.getPortfolioSites(portfolioId);
      const portfolioSiteIds = new Set(portfolioSites.map((ps) => ps.siteId));
      sitesWithKB = sitesWithKB.filter((s) => portfolioSiteIds.has(s.id));
    }
    
    let totalPanels = 0;
    let totalKwDc = 0;
    let totalRackingValue = 0;
    let minPrice = Infinity;
    let maxPrice = 0;
    let quotesExpiringSoon = 0;
    let quotesExpired = 0;
    
    for (const site of sitesWithKB) {
      totalPanels += site.kbPanelCount || 0;
      totalKwDc += site.kbKwDc || 0;
      totalRackingValue += site.kbRackingSubtotal || 0;
      
      const price = site.kbPricePerPanel || 0;
      if (price > 0) {
        if (price < minPrice) minPrice = price;
        if (price > maxPrice) maxPrice = price;
      }
      
      const expiry = site.kbQuoteExpiry ? new Date(site.kbQuoteExpiry) : null;
      if (isQuoteExpiringSoon(expiry)) quotesExpiringSoon++;
      if (isQuoteExpired(expiry)) quotesExpired++;
    }
    
    const avgPrice = sitesWithKB.length > 0 
      ? totalRackingValue / totalPanels 
      : 0;
    
    res.json({
      totalSites: allSites.length,
      sitesWithDesign: sitesWithKB.length,
      totalPanels,
      totalKwDc: Math.round(totalKwDc * 100) / 100,
      totalMwDc: Math.round(totalKwDc / 10) / 100,
      totalRackingValue: Math.round(totalRackingValue * 100) / 100,
      averagePricePerPanel: Math.round(avgPrice * 100) / 100,
      minPricePerPanel: minPrice === Infinity ? 0 : minPrice,
      maxPricePerPanel: maxPrice,
      quotesExpiringSoon,
      quotesExpired,
    });
  } catch (error) {
    log.error("Error fetching portfolio KB stats:", error);
    res.status(500).json({ error: "Failed to fetch portfolio statistics" });
  }
});

router.post("/api/kb-racking/proposal-pdf/:siteId", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const { estimateKBRackingCost } = await getKBRackingModule();
    const { siteId } = req.params;
    const language = (req.body.language || 'fr') as 'fr' | 'en';
    
    const site = await storage.getSite(siteId);
    if (!site) {
      return res.status(404).json({ error: "Site not found" });
    }
    
    const client = await storage.getClient(site.clientId);
    
    const siteData = site as SiteWithKBData;
    if (siteData.kbDesignStatus !== 'complete' || !siteData.kbPanelCount) {
      return res.status(400).json({ error: "Site does not have KB Racking design data" });
    }
    
    const { generateKBProposalPDF } = await import("../kbProposalPdfGenerator");
    
    const estimate = estimateKBRackingCost(siteData.kbPanelCount);
    
    const pdfSiteData = {
      name: site.name,
      address: site.address || '',
      city: site.city || '',
      province: site.province || 'Québec',
      postalCode: site.postalCode || '',
      buildingType: site.buildingType || 'commercial',
      clientName: client?.name || '',
    };
    
    const pdfOptions: KBProposalPDFOptions = {
      companyName: 'kWh Québec Inc.',
      companyPhone: '514-427-8871',
      companyEmail: 'info@kwhquebec.com',
    };
    
    if (siteData.kbQuoteDate) {
      pdfOptions.quoteDate = new Date(siteData.kbQuoteDate);
    }
    if (siteData.kbQuoteExpiry) {
      const expiryDate = new Date(siteData.kbQuoteExpiry);
      const quoteDate = pdfOptions.quoteDate || new Date();
      pdfOptions.quoteValidityDays = Math.ceil((expiryDate.getTime() - quoteDate.getTime()) / (24 * 60 * 60 * 1000));
    }
    if (siteData.kbQuoteNumber) {
      pdfOptions.quoteNumber = siteData.kbQuoteNumber;
    }
    
    const pdfBuffer = await generateKBProposalPDF(pdfSiteData, estimate, language, pdfOptions);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="KB_Proposal_${site.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    log.error("Error generating KB Racking proposal PDF:", error);
    res.status(500).json({ error: "Failed to generate proposal PDF" });
  }
});

router.get("/api/kb-racking/google-solar-comparison", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const { runKBGoogleSolarComparison, generateComparisonReport } = await import("../kbGoogleSolarComparison");
    
    log.info("Starting KB vs Google Solar comparison...");
    const comparison = await runKBGoogleSolarComparison();
    
    const format = req.query.format as string;
    if (format === 'markdown') {
      const report = generateComparisonReport(comparison);
      res.setHeader('Content-Type', 'text/markdown');
      res.send(report);
    } else {
      res.json(comparison);
    }
  } catch (error) {
    log.error("Error running KB/Google Solar comparison:", error);
    res.status(500).json({ error: "Failed to run comparison", details: String(error) });
  }
});

router.get("/api/kb-racking/expiring-quotes", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const daysAhead = parseInt(req.query.days as string) || 7;
    const allSites = await storage.getSites();
    
    const now = new Date();
    const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    
    const sitesWithKBData = allSites as SiteWithKBData[];
    const expiringSites: ExpiringQuoteSite[] = sitesWithKBData.filter((s) => {
      if (!s.kbQuoteExpiry || s.kbDesignStatus !== "complete") return false;
      const expiry = new Date(s.kbQuoteExpiry);
      return expiry > now && expiry <= futureDate;
    }).map((s) => ({
      id: s.id,
      name: s.name,
      address: s.address,
      kbPanelCount: s.kbPanelCount ?? null,
      kbKwDc: s.kbKwDc ?? null,
      kbRackingSubtotal: s.kbRackingSubtotal ?? null,
      kbQuoteDate: s.kbQuoteDate ?? null,
      kbQuoteExpiry: s.kbQuoteExpiry ?? null,
      daysUntilExpiry: Math.ceil((new Date(s.kbQuoteExpiry!).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
    }));
    
    res.json({
      count: expiringSites.length,
      daysAhead,
      sites: expiringSites.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry),
    });
  } catch (error) {
    log.error("Error fetching expiring quotes:", error);
    res.status(500).json({ error: "Failed to fetch expiring quotes" });
  }
});

export default router;
