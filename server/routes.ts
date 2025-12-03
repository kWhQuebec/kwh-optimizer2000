import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import fs from "fs";
import PDFDocument from "pdfkit";
import {
  insertLeadSchema,
  insertClientSchema,
  insertSiteSchema,
  insertComponentCatalogSchema,
} from "@shared/schema";
import { z } from "zod";

const JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required");
}
const upload = multer({ dest: "uploads/" });

interface AuthRequest extends Request {
  userId?: string;
}

function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // ==================== AUTH ROUTES ====================
  
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
      
      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/auth/me", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({
        id: user.id,
        email: user.email,
        role: user.role,
      });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== LEAD ROUTES (PUBLIC) ====================
  
  app.post("/api/leads", async (req, res) => {
    try {
      const parsed = insertLeadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      
      const lead = await storage.createLead(parsed.data);
      res.status(201).json(lead);
    } catch (error) {
      console.error("Create lead error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/leads", authMiddleware, async (req, res) => {
    try {
      const leads = await storage.getLeads();
      res.json(leads);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== DASHBOARD ROUTES ====================
  
  app.get("/api/dashboard/stats", authMiddleware, async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== CLIENT ROUTES ====================
  
  app.get("/api/clients", authMiddleware, async (req, res) => {
    try {
      const clients = await storage.getClients();
      res.json(clients);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/clients/:id", authMiddleware, async (req, res) => {
    try {
      const client = await storage.getClient(req.params.id);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/clients", authMiddleware, async (req, res) => {
    try {
      const parsed = insertClientSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      
      const client = await storage.createClient(parsed.data);
      res.status(201).json(client);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/clients/:id", authMiddleware, async (req, res) => {
    try {
      const client = await storage.updateClient(req.params.id, req.body);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/clients/:id", authMiddleware, async (req, res) => {
    try {
      const deleted = await storage.deleteClient(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== SITE ROUTES ====================
  
  app.get("/api/sites", authMiddleware, async (req, res) => {
    try {
      const sites = await storage.getSites();
      res.json(sites);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/sites/:id", authMiddleware, async (req, res) => {
    try {
      const site = await storage.getSite(req.params.id);
      if (!site) {
        return res.status(404).json({ error: "Site not found" });
      }
      res.json(site);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/sites", authMiddleware, async (req, res) => {
    try {
      const parsed = insertSiteSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      
      const site = await storage.createSite(parsed.data);
      res.status(201).json(site);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/sites/:id", authMiddleware, async (req, res) => {
    try {
      const site = await storage.updateSite(req.params.id, req.body);
      if (!site) {
        return res.status(404).json({ error: "Site not found" });
      }
      res.json(site);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/sites/:id", authMiddleware, async (req, res) => {
    try {
      const deleted = await storage.deleteSite(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Site not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== FILE UPLOAD ROUTES ====================
  
  app.post("/api/sites/:siteId/upload-meters", authMiddleware, upload.array("files"), async (req: AuthRequest, res) => {
    try {
      const siteId = req.params.siteId;
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const meterFiles = [];
      
      for (const file of files) {
        // Determine granularity from filename or default
        const granularity = file.originalname.toLowerCase().includes("15min") ? "FIFTEEN_MIN" : "HOUR";
        
        const meterFile = await storage.createMeterFile({
          siteId,
          fileName: file.originalname,
          granularity,
          originalStoragePath: file.path,
          periodStart: null,
          periodEnd: null,
        });

        // Parse the CSV file
        try {
          const readings = await parseHydroQuebecCSV(file.path, meterFile.id, granularity);
          await storage.createMeterReadings(readings);
          
          // Update file status
          await storage.updateMeterFile(meterFile.id, {
            status: "PARSED",
            periodStart: readings.length > 0 ? readings[0].timestamp : null,
            periodEnd: readings.length > 0 ? readings[readings.length - 1].timestamp : null,
          });
          
          meterFiles.push({ ...meterFile, status: "PARSED" });
        } catch (parseError) {
          await storage.updateMeterFile(meterFile.id, {
            status: "FAILED",
            errorMessage: parseError instanceof Error ? parseError.message : "Parse error",
          });
          meterFiles.push({ ...meterFile, status: "FAILED" });
        }
      }

      res.status(201).json(meterFiles);
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== ANALYSIS ROUTES ====================
  
  app.post("/api/sites/:siteId/run-potential-analysis", authMiddleware, async (req, res) => {
    try {
      const siteId = req.params.siteId;
      
      // Get meter readings for the site
      const readings = await storage.getMeterReadingsBySite(siteId);
      
      if (readings.length === 0) {
        return res.status(400).json({ error: "No meter data available" });
      }

      // Run the analysis
      const analysisResult = runPotentialAnalysis(readings);
      
      // Create simulation run
      const simulation = await storage.createSimulationRun({
        siteId,
        label: `Analyse ${new Date().toLocaleDateString("fr-CA")}`,
        type: "SCENARIO",
        ...analysisResult,
      });

      // Update site to mark analysis as available
      await storage.updateSite(siteId, { analysisAvailable: true });

      res.status(201).json(simulation);
    } catch (error) {
      console.error("Analysis error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/simulation-runs", authMiddleware, async (req, res) => {
    try {
      const runs = await storage.getSimulationRuns();
      res.json(runs);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/simulation-runs/:id", authMiddleware, async (req, res) => {
    try {
      const run = await storage.getSimulationRun(req.params.id);
      if (!run) {
        return res.status(404).json({ error: "Simulation not found" });
      }
      res.json(run);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // PDF Report Generation
  app.get("/api/simulation-runs/:id/report-pdf", authMiddleware, async (req, res) => {
    try {
      const lang = (req.query.lang as string) || "fr";
      const simulation = await storage.getSimulationRun(req.params.id);
      
      if (!simulation) {
        return res.status(404).json({ error: "Simulation not found" });
      }

      const doc = new PDFDocument({ size: "LETTER", margin: 50 });
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="rapport-potentiel-${simulation.id.slice(0, 8)}.pdf"`);
      
      doc.pipe(res);

      // Header
      doc.fontSize(24).fillColor("#2D915F").text("kWh Québec", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(18).fillColor("#333333").text(
        lang === "fr" ? "Rapport d'Analyse de Potentiel Solaire + Stockage" : "Solar + Storage Potential Analysis Report",
        { align: "center" }
      );
      doc.moveDown(0.3);
      doc.fontSize(12).fillColor("#666666").text(
        `${simulation.site.name} - ${simulation.site.client.name}`,
        { align: "center" }
      );
      doc.moveDown(0.2);
      doc.fontSize(10).text(
        new Date().toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA", { year: "numeric", month: "long", day: "numeric" }),
        { align: "center" }
      );
      doc.moveDown(1.5);

      // Separator line
      doc.strokeColor("#2D915F").lineWidth(2).moveTo(50, doc.y).lineTo(562, doc.y).stroke();
      doc.moveDown(1);

      // Section: Summary
      doc.fontSize(16).fillColor("#2D915F").text(lang === "fr" ? "Sommaire de l'Analyse" : "Analysis Summary");
      doc.moveDown(0.5);
      doc.fontSize(11).fillColor("#333333");

      const summaryData = [
        [lang === "fr" ? "Consommation annuelle" : "Annual consumption", `${((simulation.annualConsumptionKWh || 0) / 1000).toFixed(0)} MWh`],
        [lang === "fr" ? "Coût annuel actuel" : "Current annual cost", `${(simulation.annualCostBefore || 0).toLocaleString()} $`],
      ];

      summaryData.forEach(([label, value]) => {
        doc.text(`${label}: `, { continued: true }).font("Helvetica-Bold").text(value).font("Helvetica");
      });
      doc.moveDown(1);

      // Section: Recommended System
      doc.fontSize(16).fillColor("#2D915F").text(lang === "fr" ? "Système Recommandé" : "Recommended System");
      doc.moveDown(0.5);
      doc.fontSize(11).fillColor("#333333");

      const systemData = [
        [lang === "fr" ? "Capacité PV recommandée" : "Recommended PV capacity", `${(simulation.pvSizeKW || 0).toFixed(0)} kWc`],
        [lang === "fr" ? "Capacité batterie" : "Battery capacity", `${(simulation.battEnergyKWh || 0).toFixed(0)} kWh / ${(simulation.battPowerKW || 0).toFixed(0)} kW`],
        [lang === "fr" ? "Seuil d'écrêtage" : "Shaving setpoint", `${(simulation.demandShavingSetpointKW || 0).toFixed(0)} kW`],
      ];

      systemData.forEach(([label, value]) => {
        doc.text(`${label}: `, { continued: true }).font("Helvetica-Bold").text(value).font("Helvetica");
      });
      doc.moveDown(1);

      // Section: Financial Analysis
      doc.fontSize(16).fillColor("#2D915F").text(lang === "fr" ? "Analyse Financière" : "Financial Analysis");
      doc.moveDown(0.5);
      doc.fontSize(11).fillColor("#333333");

      const financialData = [
        [lang === "fr" ? "Investissement estimé (CAPEX)" : "Estimated investment (CAPEX)", `${(simulation.capexNet || 0).toLocaleString()} $`],
        [lang === "fr" ? "Économies annuelles estimées" : "Estimated annual savings", `${(simulation.annualSavings || 0).toLocaleString()} $/an`],
        [lang === "fr" ? "Retour simple sur investissement" : "Simple payback period", `${(simulation.simplePaybackYears || 0).toFixed(1)} ${lang === "fr" ? "ans" : "years"}`],
        [lang === "fr" ? "VAN sur 20 ans (6%)" : "NPV over 20 years (6%)", `${(simulation.npv20 || 0).toLocaleString()} $`],
        [lang === "fr" ? "TRI estimé sur 20 ans" : "Estimated IRR over 20 years", `${((simulation.irr20 || 0) * 100).toFixed(1)} %`],
      ];

      financialData.forEach(([label, value]) => {
        doc.text(`${label}: `, { continued: true }).font("Helvetica-Bold").text(value).font("Helvetica");
      });
      doc.moveDown(1);

      // Section: Environmental Impact
      doc.fontSize(16).fillColor("#2D915F").text(lang === "fr" ? "Impact Environnemental" : "Environmental Impact");
      doc.moveDown(0.5);
      doc.fontSize(11).fillColor("#333333");

      doc.text(
        `${lang === "fr" ? "CO₂ évité annuellement" : "CO₂ avoided annually"}: `,
        { continued: true }
      ).font("Helvetica-Bold").text(`${(simulation.co2AvoidedTonnesPerYear || 0).toFixed(1)} ${lang === "fr" ? "tonnes/an" : "tonnes/year"}`).font("Helvetica");
      doc.moveDown(1.5);

      // Footer
      doc.fontSize(9).fillColor("#999999").text(
        lang === "fr" 
          ? "Ce rapport est fourni à titre indicatif. Les valeurs réelles peuvent varier en fonction des conditions d'installation."
          : "This report is provided for informational purposes. Actual values may vary based on installation conditions.",
        { align: "center" }
      );
      doc.moveDown(0.3);
      doc.text("© kWh Québec - www.kwhquebec.com", { align: "center" });

      doc.end();
    } catch (error) {
      console.error("PDF generation error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== DESIGN ROUTES ====================
  
  app.get("/api/designs", authMiddleware, async (req, res) => {
    try {
      const designs = await storage.getDesigns();
      res.json(designs);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/designs/:id", authMiddleware, async (req, res) => {
    try {
      const design = await storage.getDesign(req.params.id);
      if (!design) {
        return res.status(404).json({ error: "Design not found" });
      }
      res.json(design);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/designs", authMiddleware, async (req, res) => {
    try {
      const { designName, simulationRunId, moduleModelId, inverterModelId, batteryModelId, pvSizeKW, batteryEnergyKWh, batteryPowerKW, marginPercent } = req.body;
      
      // Get component details from catalog
      const moduleItem = moduleModelId ? await storage.getCatalogItem(moduleModelId) : null;
      const inverterItem = inverterModelId ? await storage.getCatalogItem(inverterModelId) : null;
      const batteryItem = batteryModelId ? await storage.getCatalogItem(batteryModelId) : null;

      // Calculate BOM
      const moduleWattage = 410; // Default wattage
      const modulesCount = Math.ceil((pvSizeKW * 1000) / moduleWattage);
      const invertersCount = Math.ceil(pvSizeKW / 25); // 25kW per inverter
      const batteryUnits = Math.ceil(batteryEnergyKWh / 16); // 16kWh per battery unit

      // Calculate costs
      const moduleCost = modulesCount * (moduleItem?.unitCost || 180);
      const inverterCost = invertersCount * (inverterItem?.unitCost || 3500);
      const batteryCost = batteryUnits * (batteryItem?.unitCost || 9000);
      const bosCost = (moduleCost + inverterCost) * 0.15; // 15% for BOS
      
      const totalCapexPV = moduleCost + inverterCost + bosCost * 0.7;
      const totalCapexBattery = batteryCost + bosCost * 0.3;
      const totalCapexBOS = bosCost;
      const totalCapex = moduleCost + inverterCost + batteryCost + bosCost;
      const margin = marginPercent / 100;
      const totalSellPrice = totalCapex * (1 + margin);

      // Create design
      const design = await storage.createDesign({
        simulationRunId,
        designName,
        pvSizeKW,
        moduleModel: moduleItem ? `${moduleItem.manufacturer} ${moduleItem.model}` : null,
        moduleWattage,
        modulesCount,
        inverterModel: inverterItem ? `${inverterItem.manufacturer} ${inverterItem.model}` : null,
        invertersCount,
        batteryModel: batteryItem ? `${batteryItem.manufacturer} ${batteryItem.model}` : null,
        batteryEnergyKWh,
        batteryUnits,
        rackingSystem: "Ground mount",
        notes: null,
        totalCapex,
        totalCapexPV,
        totalCapexBattery,
        totalCapexBOS,
        marginPercent,
        totalSellPrice,
      });

      // Create BOM items
      const bomItemsData = [
        {
          designId: design.id,
          category: "MODULE",
          description: moduleItem ? `${moduleItem.manufacturer} ${moduleItem.model}` : "Module PV 410W",
          quantity: modulesCount,
          unit: "pc",
          unitCost: moduleItem?.unitCost || 180,
          unitSellPrice: moduleItem?.unitSellPrice || 250,
          lineTotalCost: moduleCost,
          lineTotalSell: modulesCount * (moduleItem?.unitSellPrice || 250),
        },
        {
          designId: design.id,
          category: "INVERTER",
          description: inverterItem ? `${inverterItem.manufacturer} ${inverterItem.model}` : "Onduleur 25kW",
          quantity: invertersCount,
          unit: "pc",
          unitCost: inverterItem?.unitCost || 3500,
          unitSellPrice: inverterItem?.unitSellPrice || 4500,
          lineTotalCost: inverterCost,
          lineTotalSell: invertersCount * (inverterItem?.unitSellPrice || 4500),
        },
        {
          designId: design.id,
          category: "BATTERY",
          description: batteryItem ? `${batteryItem.manufacturer} ${batteryItem.model}` : "Batterie 16kWh",
          quantity: batteryUnits,
          unit: "pc",
          unitCost: batteryItem?.unitCost || 9000,
          unitSellPrice: batteryItem?.unitSellPrice || 12000,
          lineTotalCost: batteryCost,
          lineTotalSell: batteryUnits * (batteryItem?.unitSellPrice || 12000),
        },
        {
          designId: design.id,
          category: "RACKING",
          description: "Structure de montage au sol",
          quantity: modulesCount * 0.3,
          unit: "m²",
          unitCost: 45,
          unitSellPrice: 65,
          lineTotalCost: modulesCount * 0.3 * 45,
          lineTotalSell: modulesCount * 0.3 * 65,
        },
        {
          designId: design.id,
          category: "BOS",
          description: "Balance of System (câblage, connecteurs, etc.)",
          quantity: 1,
          unit: "lot",
          unitCost: bosCost * 0.5,
          unitSellPrice: bosCost * 0.5 * 1.3,
          lineTotalCost: bosCost * 0.5,
          lineTotalSell: bosCost * 0.5 * 1.3,
        },
      ];

      const bomItems = await storage.createBomItems(bomItemsData);

      res.status(201).json({ ...design, bomItems });
    } catch (error) {
      console.error("Design creation error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/designs/:id/sync-zoho", authMiddleware, async (req, res) => {
    try {
      // Zoho integration would go here
      // For now, just mark as synced
      const design = await storage.updateDesign(req.params.id, {
        zohoDealId: `ZOHO-${Date.now()}`,
      });
      
      if (!design) {
        return res.status(404).json({ error: "Design not found" });
      }
      
      res.json(design);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== CATALOG ROUTES ====================
  
  app.get("/api/catalog", authMiddleware, async (req, res) => {
    try {
      const catalog = await storage.getCatalog();
      res.json(catalog);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/catalog", authMiddleware, async (req, res) => {
    try {
      const parsed = insertComponentCatalogSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      
      const item = await storage.createCatalogItem(parsed.data);
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/catalog/:id", authMiddleware, async (req, res) => {
    try {
      const item = await storage.updateCatalogItem(req.params.id, req.body);
      if (!item) {
        return res.status(404).json({ error: "Item not found" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/catalog/:id", authMiddleware, async (req, res) => {
    try {
      const deleted = await storage.deleteCatalogItem(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Item not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return httpServer;
}

// ==================== HELPER FUNCTIONS ====================

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
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter(line => line.trim());
  
  const readings: Array<{
    meterFileId: string;
    timestamp: Date;
    granularity: string;
    kWh: number | null;
    kW: number | null;
  }> = [];

  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(",");
    
    if (parts.length >= 2) {
      try {
        // Parse date and value
        const dateStr = parts[0].trim().replace(/"/g, "");
        const valueStr = parts[1].trim().replace(/"/g, "");
        
        // Try to parse the date
        const timestamp = new Date(dateStr);
        if (isNaN(timestamp.getTime())) continue;
        
        const value = parseFloat(valueStr);
        if (isNaN(value)) continue;
        
        readings.push({
          meterFileId,
          timestamp,
          granularity,
          kWh: granularity === "HOUR" ? value : value / 4, // Convert 15-min to hourly equivalent
          kW: value,
        });
      } catch (e) {
        continue;
      }
    }
  }

  return readings;
}

function runPotentialAnalysis(readings: Array<{ kWh: number | null; kW: number | null; timestamp: Date }>): {
  pvSizeKW: number;
  battEnergyKWh: number;
  battPowerKW: number;
  demandShavingSetpointKW: number;
  annualConsumptionKWh: number;
  annualEnergySavingsKWh: number;
  annualDemandReductionKW: number;
  annualCostBefore: number;
  annualCostAfter: number;
  annualSavings: number;
  npv20: number;
  irr20: number;
  npv10: number;
  irr10: number;
  simplePaybackYears: number;
  capexNet: number;
  co2AvoidedTonnesPerYear: number;
} {
  // Calculate key metrics from readings
  const totalKWh = readings.reduce((sum, r) => sum + (r.kWh || 0), 0);
  const peakKW = Math.max(...readings.map(r => r.kW || 0));
  
  // Estimate annual values (if we have partial data)
  const dataSpanDays = readings.length > 0 
    ? (new Date(readings[readings.length - 1].timestamp).getTime() - new Date(readings[0].timestamp).getTime()) / (1000 * 60 * 60 * 24)
    : 365;
  const annualizationFactor = 365 / Math.max(dataSpanDays, 1);
  
  const annualConsumptionKWh = totalKWh * annualizationFactor;
  
  // Sizing recommendations based on consumption
  const pvSizeKW = Math.round(annualConsumptionKWh / 1200); // ~1200 kWh/kWp in Quebec
  const battEnergyKWh = Math.round(peakKW * 2); // 2 hours of peak capacity
  const battPowerKW = Math.round(peakKW * 0.3); // 30% of peak for shaving
  const demandShavingSetpointKW = Math.round(peakKW * 0.85); // Target 15% peak reduction

  // Financial calculations
  const electricityRate = 0.073; // $/kWh (Hydro-Quebec industrial rate)
  const demandRate = 15.5; // $/kW/month
  
  const annualCostBefore = annualConsumptionKWh * electricityRate + peakKW * demandRate * 12;
  
  // Estimate savings
  const pvProduction = pvSizeKW * 1200;
  const selfConsumption = Math.min(pvProduction * 0.7, annualConsumptionKWh * 0.3);
  const peakReduction = peakKW * 0.15;
  
  const energySavings = selfConsumption * electricityRate;
  const demandSavings = peakReduction * demandRate * 12;
  const annualSavings = energySavings + demandSavings;
  const annualCostAfter = annualCostBefore - annualSavings;

  // CAPEX estimation
  const pvCost = pvSizeKW * 1.2 * 1000; // $1.2/W
  const batteryCost = battEnergyKWh * 350; // $350/kWh
  const capexNet = pvCost + batteryCost;

  // Financial metrics
  const discountRate = 0.06;
  const years = 20;
  
  // NPV calculation
  let npv20 = -capexNet;
  for (let y = 1; y <= years; y++) {
    npv20 += annualSavings / Math.pow(1 + discountRate, y);
  }
  
  let npv10 = -capexNet;
  for (let y = 1; y <= 10; y++) {
    npv10 += annualSavings / Math.pow(1 + discountRate, y);
  }

  // Simple payback
  const simplePaybackYears = capexNet / annualSavings;

  // IRR estimation (simplified)
  const irr20 = annualSavings / capexNet * (1 - 1 / Math.pow(1.06, 20)) / (1 - 1 / 1.06);
  const irr10 = annualSavings / capexNet * (1 - 1 / Math.pow(1.06, 10)) / (1 - 1 / 1.06);

  // CO2 avoided (Quebec grid is very clean, ~0.002 kg CO2/kWh)
  const co2Factor = 0.002; // kg CO2/kWh
  const co2AvoidedTonnesPerYear = (selfConsumption * co2Factor) / 1000;

  return {
    pvSizeKW,
    battEnergyKWh,
    battPowerKW,
    demandShavingSetpointKW,
    annualConsumptionKWh,
    annualEnergySavingsKWh: selfConsumption,
    annualDemandReductionKW: peakReduction,
    annualCostBefore,
    annualCostAfter,
    annualSavings,
    npv20,
    irr20,
    npv10,
    irr10,
    simplePaybackYears,
    capexNet,
    co2AvoidedTonnesPerYear,
  };
}
