import { Router, Response } from "express";
import PDFDocument from "pdfkit";
import { authMiddleware, requireStaff, AuthRequest } from "../middleware/auth";
import { storage } from "../storage";
import { insertPortfolioSchema, insertPortfolioSiteSchema } from "@shared/schema";

const router = Router();

router.get("/api/portfolios", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const portfolios = await storage.getPortfolios();
    res.json(portfolios);
  } catch (error) {
    console.error("Error fetching portfolios:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/clients/:clientId/portfolios", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    
    if (req.userRole === "client" && req.userClientId !== clientId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const portfolios = await storage.getPortfoliosByClient(clientId);
    res.json(portfolios);
  } catch (error) {
    console.error("Error fetching client portfolios:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/portfolios/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const portfolio = await storage.getPortfolio(req.params.id);
    
    if (!portfolio) {
      return res.status(404).json({ error: "Portfolio not found" });
    }
    
    if (req.userRole === "client" && req.userClientId !== portfolio.clientId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    res.json(portfolio);
  } catch (error) {
    console.error("Error fetching portfolio:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/portfolios/:id/sites", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const portfolio = await storage.getPortfolio(req.params.id);
    
    if (!portfolio) {
      return res.status(404).json({ error: "Portfolio not found" });
    }
    
    if (req.userRole === "client" && req.userClientId !== portfolio.clientId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const sites = await storage.getPortfolioSites(req.params.id);
    res.json(sites);
  } catch (error) {
    console.error("Error fetching portfolio sites:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/portfolios/:id/full", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const portfolio = await storage.getPortfolio(req.params.id);
    
    if (!portfolio) {
      return res.status(404).json({ error: "Portfolio not found" });
    }
    
    if (req.userRole === "client" && req.userClientId !== portfolio.clientId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const portfolioSites = await storage.getPortfolioSites(req.params.id);
    
    let totalPvSizeKW = 0;
    let totalBatteryCapacityKWh = 0;
    let totalNetCapex = 0;
    let totalAnnualSavings = 0;
    let totalCo2Avoided = 0;
    let weightedIrrSum = 0;
    let totalNpv = 0;
    let sitesWithSimulations = 0;

    for (const ps of portfolioSites) {
      const sim = ps.latestSimulation;
      const results = sim?.results as any;
      
      const pvSize = ps.overridePvSizeKW ?? results?.pvSizeKW ?? results?.optimalPvSizeKW ?? 0;
      const batterySize = ps.overrideBatteryKWh ?? results?.batteryCapacityKWh ?? results?.optimalBatteryKWh ?? 0;
      const netCapex = ps.overrideCapexNet ?? results?.netCapex ?? 0;
      const npv = ps.overrideNpv ?? results?.npv ?? 0;
      const irr = ps.overrideIrr ?? results?.irr ?? 0;
      const annualSavings = ps.overrideAnnualSavings ?? results?.annualSavings ?? results?.firstYearSavings ?? 0;
      const co2 = results?.co2AvoidedTonnes ?? results?.annualCo2Avoided ?? 0;
      
      const hasData = pvSize > 0 || netCapex !== 0 || npv !== 0 || annualSavings !== 0 ||
                     ps.overridePvSizeKW != null || ps.overrideCapexNet != null ||
                     ps.overrideNpv != null || ps.overrideAnnualSavings != null;

      if (hasData || sim?.results) {
        totalPvSizeKW += pvSize;
        totalBatteryCapacityKWh += batterySize;
        totalNetCapex += netCapex;
        totalNpv += npv;
        totalAnnualSavings += annualSavings;
        totalCo2Avoided += co2;
        
        if (netCapex > 0 && irr !== 0) {
          weightedIrrSum += irr * netCapex;
        }
        if (netCapex !== 0 || pvSize > 0) {
          sitesWithSimulations++;
        }
      }
    }

    const weightedIrr = totalNetCapex > 0 ? weightedIrrSum / totalNetCapex : 0;

    const numBuildings = portfolioSites.length;
    let volumeDiscount = 0;
    if (numBuildings >= 20) volumeDiscount = 0.15;
    else if (numBuildings >= 10) volumeDiscount = 0.10;
    else if (numBuildings >= 5) volumeDiscount = 0.05;

    const aggregatedKpis = {
      totalPvSizeKW,
      totalBatteryCapacityKWh,
      totalNetCapex,
      totalNpv,
      weightedIrr,
      totalAnnualSavings,
      totalCo2Avoided,
      numBuildings,
      sitesWithSimulations,
      volumeDiscount,
      discountedCapex: totalNetCapex * (1 - volumeDiscount),
    };

    res.json({
      portfolio,
      sites: portfolioSites,
      kpis: aggregatedKpis,
    });
  } catch (error) {
    console.error("Error fetching full portfolio:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/portfolios", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const parsed = insertPortfolioSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors });
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
      console.error("Failed to auto-create portfolio opportunity:", oppError);
    }
    
    res.status(201).json(portfolio);
  } catch (error) {
    console.error("Error creating portfolio:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/api/portfolios/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const portfolio = await storage.updatePortfolio(req.params.id, req.body);
    
    if (!portfolio) {
      return res.status(404).json({ error: "Portfolio not found" });
    }
    
    res.json(portfolio);
  } catch (error) {
    console.error("Error updating portfolio:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/api/portfolios/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const deleted = await storage.deletePortfolio(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({ error: "Portfolio not found" });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting portfolio:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/portfolios/:id/sites", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const { siteId, siteIds, notes, displayOrder } = req.body;
    
    const sitesToAdd: string[] = siteIds ? siteIds : (siteId ? [siteId] : []);
    
    if (sitesToAdd.length === 0) {
      return res.status(400).json({ error: "siteId or siteIds is required" });
    }
    
    const portfolio = await storage.getPortfolio(req.params.id);
    if (!portfolio) {
      return res.status(404).json({ error: "Portfolio not found" });
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
  } catch (error) {
    console.error("Error adding site to portfolio:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/api/portfolios/:portfolioId/sites/:siteId", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const { portfolioId, siteId } = req.params;
    
    const removed = await storage.removeSiteFromPortfolio(portfolioId, siteId);
    
    if (!removed) {
      return res.status(404).json({ error: "Site not found in portfolio" });
    }
    
    const currentSites = await storage.getPortfolioSites(portfolioId);
    await storage.updatePortfolio(portfolioId, {
      numBuildings: currentSites.length,
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error removing site from portfolio:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/api/portfolio-sites/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { 
      overridePvSizeKW, 
      overrideBatteryKWh, 
      overrideCapexNet, 
      overrideNpv, 
      overrideIrr, 
      overrideAnnualSavings,
      notes 
    } = req.body;

    const updated = await storage.updatePortfolioSite(id, {
      overridePvSizeKW: overridePvSizeKW !== undefined ? overridePvSizeKW : undefined,
      overrideBatteryKWh: overrideBatteryKWh !== undefined ? overrideBatteryKWh : undefined,
      overrideCapexNet: overrideCapexNet !== undefined ? overrideCapexNet : undefined,
      overrideNpv: overrideNpv !== undefined ? overrideNpv : undefined,
      overrideIrr: overrideIrr !== undefined ? overrideIrr : undefined,
      overrideAnnualSavings: overrideAnnualSavings !== undefined ? overrideAnnualSavings : undefined,
      notes: notes !== undefined ? notes : undefined,
    });

    if (!updated) {
      return res.status(404).json({ error: "Portfolio site not found" });
    }

    res.json(updated);
  } catch (error) {
    console.error("Error updating portfolio site:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/portfolios/:id/pdf", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const lang = (req.query.lang as string) === "en" ? "en" : "fr";
    const portfolio = await storage.getPortfolio(req.params.id);
    
    if (!portfolio) {
      return res.status(404).json({ error: "Portfolio not found" });
    }
    
    if (req.userRole === "client" && req.userClientId !== portfolio.clientId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const client = await storage.getClient(portfolio.clientId);
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }
    
    const portfolioSites = await storage.getPortfolioSites(req.params.id);
    
    const doc = new PDFDocument({ size: "LETTER", margin: 40 });
    
    const portfolioName = portfolio.name.replace(/\s+/g, "-").toLowerCase();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="portfolio-${portfolioName}.pdf"`);
    
    doc.pipe(res);
    
    const { generatePortfolioSummaryPDF } = await import("../pdfGenerator");
    
    const quotedCosts = (portfolio.quotedCosts as any) || {};
    
    generatePortfolioSummaryPDF(doc, {
      id: portfolio.id,
      name: portfolio.name,
      clientName: client.name,
      description: portfolio.description || undefined,
      numBuildings: portfolio.numBuildings || portfolioSites.length,
      estimatedTravelDays: portfolio.estimatedTravelDays,
      volumeDiscountPercent: portfolio.volumeDiscountPercent,
      quotedCosts,
      totalPvSizeKW: portfolio.totalPvSizeKW,
      totalBatteryKWh: portfolio.totalBatteryKWh,
      totalCapexNet: portfolio.totalCapexNet,
      totalNpv25: portfolio.totalNpv25,
      weightedIrr25: portfolio.weightedIrr25,
      totalAnnualSavings: portfolio.totalAnnualSavings,
      totalCo2Avoided: portfolio.totalCo2Avoided,
      sites: portfolioSites.map(ps => ({
        siteName: ps.site?.name || "Unknown",
        city: ps.site?.city || undefined,
        pvSizeKW: ps.latestSimulation?.pvSizeKW || null,
        batteryKWh: ps.latestSimulation?.battEnergyKWh || null,
        capexNet: ps.latestSimulation?.capexNet || null,
        npv25: ps.latestSimulation?.npv25 || null,
        irr25: ps.latestSimulation?.irr25 || null,
        annualSavings: ps.latestSimulation?.annualSavings || null,
        co2Avoided: ps.latestSimulation?.co2AvoidedTonnesPerYear || null,
      })),
      createdAt: portfolio.createdAt || undefined,
    }, lang as "fr" | "en");
    
    doc.end();
  } catch (error) {
    console.error("Portfolio PDF generation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/portfolios/:id/recalculate", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const portfolio = await storage.getPortfolio(req.params.id);
    if (!portfolio) {
      return res.status(404).json({ error: "Portfolio not found" });
    }
    
    const portfolioSites = await storage.getPortfolioSites(req.params.id);
    
    let totalPvSizeKW = 0;
    let totalBatteryKWh = 0;
    let totalCapexNet = 0;
    let totalNpv25 = 0;
    let totalAnnualSavings = 0;
    let totalCo2Avoided = 0;
    let totalCapexGross = 0;
    let weightedIrrSum = 0;
    
    for (const ps of portfolioSites) {
      const pvSize = ps.overridePvSizeKW ?? ps.latestSimulation?.pvSizeKW ?? 0;
      const battKWh = ps.overrideBatteryKWh ?? ps.latestSimulation?.battEnergyKWh ?? 0;
      const capexNet = ps.overrideCapexNet ?? ps.latestSimulation?.capexNet ?? 0;
      const npv = ps.overrideNpv ?? ps.latestSimulation?.npv25 ?? 0;
      const irr = ps.overrideIrr ?? ps.latestSimulation?.irr25 ?? 0;
      const annualSavings = ps.overrideAnnualSavings ?? ps.latestSimulation?.annualSavings ?? 0;
      const co2 = ps.latestSimulation?.co2AvoidedTonnesPerYear ?? 0;
      
      const hasData = pvSize > 0 || capexNet !== 0 || npv !== 0 || annualSavings !== 0 || 
                     ps.overridePvSizeKW != null || ps.overrideCapexNet != null || 
                     ps.overrideNpv != null || ps.overrideAnnualSavings != null;
      
      if (hasData || ps.latestSimulation) {
        totalPvSizeKW += pvSize;
        totalBatteryKWh += battKWh;
        totalCapexNet += capexNet;
        totalNpv25 += npv;
        totalAnnualSavings += annualSavings;
        totalCo2Avoided += co2;
        
        const capex = ps.latestSimulation?.capexGross || capexNet || 0;
        if (capex > 0 && irr !== 0) {
          totalCapexGross += capex;
          weightedIrrSum += irr * capex;
        }
      }
    }
    
    const weightedIrr25 = totalCapexGross > 0 ? weightedIrrSum / totalCapexGross : null;
    
    let volumeDiscountPercent = 0;
    const numBuildings = portfolioSites.length;
    if (numBuildings >= 20) {
      volumeDiscountPercent = 0.15;
    } else if (numBuildings >= 10) {
      volumeDiscountPercent = 0.10;
    } else if (numBuildings >= 5) {
      volumeDiscountPercent = 0.05;
    }
    
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
      totalPvSizeKW,
      totalBatteryKWh,
      totalCapexNet,
      totalNpv25,
      weightedIrr25,
      totalAnnualSavings,
      totalCo2Avoided,
    });
    
    res.json(updated);
  } catch (error) {
    console.error("Error recalculating portfolio:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
