import { Router, Response } from "express";
import { authMiddleware, requireStaff, AuthRequest } from "../middleware/auth";
import { storage } from "../storage";
import { insertCompetitorProposalAnalysisSchema } from "@shared/schema";
import { createLogger } from "../lib/logger";

const log = createLogger("MarketIntel");
const router = Router();

router.get("/api/market-intelligence/price-trends", authMiddleware, requireStaff, async (req, res) => {
  try {
    const { category } = req.query;
    
    let history;
    if (category && typeof category === 'string') {
      history = await storage.getPriceHistoryByCategory(category);
    } else {
      history = await storage.getPriceHistory();
    }

    const now = new Date();
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const twelveMonthsAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    const itemGroups: Record<string, typeof history> = {};
    for (const entry of history) {
      if (!itemGroups[entry.itemName]) {
        itemGroups[entry.itemName] = [];
      }
      itemGroups[entry.itemName].push(entry);
    }

    const trends = Object.entries(itemGroups).map(([itemName, entries]) => {
      const sorted = entries.sort((a, b) => new Date(b.quoteDate).getTime() - new Date(a.quoteDate).getTime());
      
      const currentPrice = sorted[0]?.unitPrice || 0;
      
      const threeMonthPrice = sorted.find(e => new Date(e.quoteDate) <= threeMonthsAgo)?.unitPrice;
      const sixMonthPrice = sorted.find(e => new Date(e.quoteDate) <= sixMonthsAgo)?.unitPrice;
      const twelveMonthPrice = sorted.find(e => new Date(e.quoteDate) <= twelveMonthsAgo)?.unitPrice;

      const calcChange = (oldPrice: number | undefined) => {
        if (!oldPrice || oldPrice === 0) return null;
        return ((currentPrice - oldPrice) / oldPrice) * 100;
      };

      return {
        itemName,
        category: sorted[0]?.category,
        currentPrice,
        threeMonthChange: calcChange(threeMonthPrice),
        sixMonthChange: calcChange(sixMonthPrice),
        twelveMonthChange: calcChange(twelveMonthPrice),
        dataPoints: sorted.length,
      };
    });

    res.json(trends);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/market-intelligence/supplier-comparison", authMiddleware, requireStaff, async (req, res) => {
  try {
    const { category } = req.query;
    
    let supplierList;
    if (category && typeof category === 'string') {
      supplierList = await storage.getSuppliersByCategory(category);
    } else {
      supplierList = await storage.getSuppliers();
    }

    let history;
    if (category && typeof category === 'string') {
      history = await storage.getPriceHistoryByCategory(category);
    } else {
      history = await storage.getPriceHistory();
    }

    const supplierPrices: Record<string, typeof history> = {};
    for (const entry of history) {
      if (entry.supplierId) {
        if (!supplierPrices[entry.supplierId]) {
          supplierPrices[entry.supplierId] = [];
        }
        supplierPrices[entry.supplierId].push(entry);
      }
    }

    const comparison = supplierList.map(supplier => {
      const prices = supplierPrices[supplier.id] || [];
      const sortedPrices = prices.sort((a, b) => new Date(b.quoteDate).getTime() - new Date(a.quoteDate).getTime());
      
      const itemAverages: Record<string, number[]> = {};
      for (const price of sortedPrices) {
        if (!itemAverages[price.itemName]) {
          itemAverages[price.itemName] = [];
        }
        itemAverages[price.itemName].push(price.unitPrice);
      }

      const avgPrices = Object.entries(itemAverages).map(([itemName, prices]) => ({
        itemName,
        avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
        latestPrice: prices[0],
        priceCount: prices.length,
      }));

      return {
        supplier: {
          id: supplier.id,
          name: supplier.name,
          category: supplier.category,
          rating: supplier.rating,
          leadTimeDays: supplier.leadTimeDays,
        },
        priceData: avgPrices,
        totalQuotes: sortedPrices.length,
        lastQuoteDate: sortedPrices[0]?.quoteDate || null,
      };
    });

    res.json(comparison);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/market-intelligence/proposal-analyses", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const analyses = await storage.getCompetitorProposalAnalyses();
    res.json(analyses);
  } catch (error) {
    log.error("Error fetching competitor proposal analyses:", error);
    res.status(500).json({ error: "Failed to fetch competitor proposal analyses" });
  }
});

router.get("/api/market-intelligence/proposal-analyses/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const analysis = await storage.getCompetitorProposalAnalysis(req.params.id);
    if (!analysis) {
      return res.status(404).json({ error: "Competitor proposal analysis not found" });
    }
    res.json(analysis);
  } catch (error) {
    log.error("Error fetching competitor proposal analysis:", error);
    res.status(500).json({ error: "Failed to fetch competitor proposal analysis" });
  }
});

router.post("/api/market-intelligence/proposal-analyses", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const parsed = insertCompetitorProposalAnalysisSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body", details: parsed.error.errors });
    }
    const analysis = await storage.createCompetitorProposalAnalysis(parsed.data);
    res.status(201).json(analysis);
  } catch (error) {
    log.error("Error creating competitor proposal analysis:", error);
    res.status(500).json({ error: "Failed to create competitor proposal analysis" });
  }
});

router.patch("/api/market-intelligence/proposal-analyses/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const existing = await storage.getCompetitorProposalAnalysis(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Competitor proposal analysis not found" });
    }
    const parsed = insertCompetitorProposalAnalysisSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body", details: parsed.error.errors });
    }
    const updated = await storage.updateCompetitorProposalAnalysis(req.params.id, parsed.data);
    res.json(updated);
  } catch (error) {
    log.error("Error updating competitor proposal analysis:", error);
    res.status(500).json({ error: "Failed to update competitor proposal analysis" });
  }
});

router.delete("/api/market-intelligence/proposal-analyses/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const existing = await storage.getCompetitorProposalAnalysis(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Competitor proposal analysis not found" });
    }
    await storage.deleteCompetitorProposalAnalysis(req.params.id);
    res.status(204).send();
  } catch (error) {
    log.error("Error deleting competitor proposal analysis:", error);
    res.status(500).json({ error: "Failed to delete competitor proposal analysis" });
  }
});

export default router;
