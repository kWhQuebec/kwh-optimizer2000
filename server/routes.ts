import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
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
import * as googleSolar from "./googleSolarService";
import { sendEmail, generatePortalInvitationEmail } from "./gmail";
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
  runSolarBatterySimulation,
  buildSimulationParams,
  buildSystemParams,
  getTieredSolarCostPerW,
  getSolarPricingTierLabel,
  QUEBEC_MONTHLY_TEMPS as UNIFIED_QUEBEC_TEMPS,
  BASELINE_YIELD,
  type MonteCarloConfig,
  type PeakShavingConfig,
  type YieldStrategy,
  type SimulationParams,
} from "./analysis";
import { registerAIAssistantRoutes } from "./aiAssistant";

const JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required");
}
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
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
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

// Helper function for async roof estimation (fire-and-forget)
async function triggerRoofEstimation(siteId: string): Promise<void> {
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
      });
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

      result = await googleSolar.estimateRoofFromAddress(fullAddress);
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

    // Success - update site with roof data
    // Include both raw details AND calculated googleProductionEstimate for analysis
    // Use JSON.parse/stringify to ensure clean JSON serialization for database storage
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
    
    // Also run roof color analysis for bifacial detection
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
      // Don't fail the whole operation if color analysis fails
    }
  } catch (error) {
    console.error(`Roof estimation error for site ${siteId}:`, error);
    await storage.updateSite(siteId, {
      roofEstimateStatus: "failed",
      roofEstimateError: error instanceof Error ? error.message : "Unknown error",
      roofEstimatePendingAt: null
    });
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // ==================== STATIC ASSETS (LOGOS) ====================
  
  // Serve logo images for emails - publicly accessible
  app.get("/assets/logo-fr.png", (req, res) => {
    const logoPath = path.resolve("attached_assets/kWh_Quebec_Logo-01_1764778562811.png");
    if (fs.existsSync(logoPath)) {
      res.sendFile(logoPath);
    } else {
      res.status(404).send("Logo not found");
    }
  });
  
  app.get("/assets/logo-en.png", (req, res) => {
    const logoPath = path.resolve("attached_assets/kWh_Quebec_Logo_Black_Eng-01_1764778562808.png");
    if (fs.existsSync(logoPath)) {
      res.sendFile(logoPath);
    } else {
      res.status(404).send("Logo not found");
    }
  });

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
      
      // Check if user is active
      if (user.status === "inactive") {
        return res.status(403).json({ error: "Account is deactivated. Please contact an administrator." });
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Update last login timestamp
      await storage.updateUser(user.id, { lastLoginAt: new Date() });

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
      
      // Include client info for client users
      let clientName = null;
      if (user.clientId) {
        const client = await storage.getClient(user.clientId);
        clientName = client?.name || null;
      }
      
      res.json({
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name || null,
        clientId: user.clientId || null,
        clientName,
      });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== USER MANAGEMENT ROUTES (ADMIN ONLY) ====================
  
  // List all users (admin only)
  app.get("/api/users", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      // Only admins can list all users
      if (req.userRole !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const users = await storage.getUsers();
      // Remove password hashes from response
      const safeUsers = users.map(({ passwordHash, ...user }) => user);
      res.json(safeUsers);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Create a client user account (admin only)
  app.post("/api/users", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      // Only admins can create users
      if (req.userRole !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const { email, password, name, role, clientId } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }
      
      // Only allow creating client or analyst roles
      if (role && !["client", "analyst"].includes(role)) {
        return res.status(400).json({ error: "Invalid role. Only 'client' or 'analyst' allowed." });
      }
      
      // Client users must have a clientId
      if (role === "client" && !clientId) {
        return res.status(400).json({ error: "Client users must be linked to a client" });
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const user = await storage.createUser({
        email,
        passwordHash: hashedPassword,
        name: name || null,
        role: role || "client",
        clientId: clientId || null,
      });
      
      // Return user without password hash
      const { passwordHash: _, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (error) {
      console.error("Create user error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Delete a user (admin only)
  app.delete("/api/users/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      // Only admins can delete users
      if (req.userRole !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      // Prevent deleting self
      if (req.params.id === req.userId) {
        return res.status(400).json({ error: "Cannot delete your own account" });
      }
      
      const deleted = await storage.deleteUser(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "User not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Update a user (admin only)
  app.patch("/api/users/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      // Only admins can update users
      if (req.userRole !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const { name, role, clientId, status } = req.body;
      
      // Validate role if provided
      if (role && !["client", "analyst", "admin"].includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }
      
      // Validate status if provided
      if (status && !["active", "inactive"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      
      // Prevent demoting yourself from admin
      if (req.params.id === req.userId && role && role !== "admin") {
        return res.status(400).json({ error: "Cannot change your own admin role" });
      }
      
      // Client users must have a clientId
      if (role === "client" && clientId === undefined) {
        // Keep existing clientId if not provided
      } else if (role === "client" && !clientId) {
        return res.status(400).json({ error: "Client users must be linked to a client" });
      }
      
      const updateData: Record<string, any> = {};
      if (name !== undefined) updateData.name = name;
      if (role !== undefined) updateData.role = role;
      if (clientId !== undefined) updateData.clientId = role === "client" ? clientId : null;
      if (status !== undefined) updateData.status = status;
      
      const updated = await storage.updateUser(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Return user without password hash
      const { passwordHash: _, ...safeUser } = updated;
      res.json(safeUser);
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Reset user password (admin only)
  app.post("/api/users/:id/reset-password", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      // Only admins can reset passwords
      if (req.userRole !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const { password } = req.body;
      
      if (!password || password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }
      
      // Hash new password
      const passwordHash = await bcrypt.hash(password, 10);
      
      const updated = await storage.updateUser(req.params.id, { passwordHash });
      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json({ success: true, message: "Password reset successfully" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Generate a random password
  function generateTempPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
  
  // Grant portal access validation schema
  const grantPortalAccessSchema = z.object({
    email: z.string().email("Invalid email format").transform(e => e.toLowerCase().trim()),
    contactName: z.string().optional().default(""),
    language: z.enum(["fr", "en"]).default("fr"),
    customMessage: z.string().optional().default(""),
  });

  // Grant portal access - creates client user and sends invitation email
  app.post("/api/clients/:clientId/grant-portal-access", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      
      // Validate request body
      const parseResult = grantPortalAccessSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Validation error", 
          details: parseResult.error.errors 
        });
      }
      
      const { email, contactName, language, customMessage } = parseResult.data;
      
      // Get client info
      const client = await storage.getClient(clientId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      // Check if user already exists with this email
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "A user with this email already exists" });
      }
      
      // Generate temporary password
      const tempPassword = generateTempPassword();
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      
      // Create the client user
      const user = await storage.createUser({
        email,
        passwordHash: hashedPassword,
        name: contactName || null,
        role: 'client',
        clientId: clientId,
      });
      
      // Generate the portal URL
      const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
      const host = req.get('host') || 'localhost:5000';
      const portalUrl = `${protocol}://${host}/login`;
      
      // Generate email content
      const emailContent = generatePortalInvitationEmail({
        clientName: client.name,
        contactName: contactName || email.split('@')[0],
        email,
        tempPassword,
        portalUrl,
        language: language as 'fr' | 'en',
      });
      
      // If custom message provided, append it to the email
      let finalHtmlBody = emailContent.htmlBody;
      let finalTextBody = emailContent.textBody;
      if (customMessage) {
        const customHtml = `<div style="background: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #856404;">
          <p style="margin: 0;"><strong>${language === 'fr' ? 'Message personnel :' : 'Personal message:'}</strong></p>
          <p style="margin: 10px 0 0 0;">${customMessage.replace(/\n/g, '<br>')}</p>
        </div>`;
        finalHtmlBody = finalHtmlBody.replace('</div>\n    <div class="footer">', customHtml + '</div>\n    <div class="footer">');
        finalTextBody = finalTextBody + `\n\n${language === 'fr' ? 'Message personnel' : 'Personal message'}:\n${customMessage}`;
      }
      
      // Send the invitation email
      const emailResult = await sendEmail({
        to: email,
        subject: emailContent.subject,
        htmlBody: finalHtmlBody,
        textBody: finalTextBody,
      });
      
      if (!emailResult.success) {
        // User was created but email failed - log the failure for audit trail
        console.error(`[Portal Access] Email failed for user ${user.email} (client: ${client.name}): ${emailResult.error}`);
        console.warn(`[Portal Access] Temporary password was generated but email not delivered. Manual credential sharing required.`);
        
        return res.status(201).json({
          success: true,
          user: { id: user.id, email: user.email, name: user.name },
          emailSent: false,
          emailError: emailResult.error,
          tempPassword, // Return password since email failed - staff must share manually
          warning: language === 'fr' 
            ? "L'envoi du courriel a échoué. Veuillez partager le mot de passe temporaire manuellement."
            : "Email delivery failed. Please share the temporary password manually.",
        });
      }
      
      console.log(`[Portal Access] Successfully created account and sent invitation to ${user.email} for client ${client.name}`);
      
      res.status(201).json({
        success: true,
        user: { id: user.id, email: user.email, name: user.name },
        emailSent: true,
        messageId: emailResult.messageId,
      });
    } catch (error: any) {
      console.error("Grant portal access error:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // ==================== LEAD ROUTES (PUBLIC) ====================
  
  // Quick estimate endpoint for landing page calculator (no auth required)
  app.post("/api/quick-estimate", async (req, res) => {
    try {
      const { address, monthlyBill, buildingType, tariffCode } = req.body;
      
      if (!address || !monthlyBill) {
        return res.status(400).json({ error: "Address and monthly bill are required" });
      }
      
      // HQ energy rates ($/kWh) - energy portion only
      const HQ_ENERGY_RATES: Record<string, number> = {
        G: 0.11933, // Small power (<65 kW)
        M: 0.06061, // Medium power (65kW-5MW)
        L: 0.03681, // Large power (>5MW)
      };
      
      // Energy portion factor (what % of bill is energy vs demand charges)
      const ENERGY_PORTION_FACTORS: Record<string, number> = {
        G: 0.85, // G tariff: mostly energy
        M: 0.60, // M tariff: significant demand charges
        L: 0.50, // L tariff: high demand charges
      };
      
      // Building type load factors (for seasonal adjustment)
      const BUILDING_FACTORS: Record<string, number> = {
        office: 1.0,
        warehouse: 0.85,
        retail: 1.1,
        industrial: 0.9,
        healthcare: 1.15,
        education: 0.95,
      };
      
      // Use provided tariff or default to G (small power <65 kW)
      // Note: Tariff is based on building's peak demand, not solar system size
      const tariff = tariffCode || "G";
      const energyRate = HQ_ENERGY_RATES[tariff] || 0.11933;
      const energyPortion = ENERGY_PORTION_FACTORS[tariff] || 0.60;
      const buildingFactor = BUILDING_FACTORS[buildingType] || 1.0;
      
      // Calculate annual consumption from monthly bill
      const monthlyEnergyBill = monthlyBill * energyPortion;
      const monthlyKWh = monthlyEnergyBill / energyRate;
      const annualKWh = monthlyKWh * 12 * buildingFactor;
      
      // Call Google Solar API to get roof potential
      let roofData: googleSolar.RoofEstimateResult | null = null;
      try {
        roofData = await googleSolar.estimateRoofFromAddress(address + ", Québec, Canada");
      } catch (err) {
        console.error("[Quick Estimate] Google Solar API error:", err);
      }
      
      // Quebec realistic average: ~1100 kWh/kW/year production (conservative)
      const QC_PRODUCTION_FACTOR = 1100;
      
      // Calculate system size based on consumption (target 70% self-consumption)
      const targetSelfConsumption = 0.70;
      const consumptionBasedKW = Math.round((annualKWh * targetSelfConsumption) / QC_PRODUCTION_FACTOR);
      
      // If we have roof data, limit by roof capacity
      let roofBasedKW = consumptionBasedKW;
      let roofAreaSqM = 0;
      let hasRoofData = false;
      
      if (roofData?.success && roofData.maxArrayAreaSqM > 0) {
        hasRoofData = true;
        roofAreaSqM = roofData.maxArrayAreaSqM;
        // ~185 W/m² panel density, 70% utilization
        roofBasedKW = Math.round((roofAreaSqM * 0.70 * 185) / 1000);
      }
      
      // Final system size: minimum of consumption-based and roof-based (min 10 kW for commercial)
      const systemSizeKW = Math.max(10, Math.min(consumptionBasedKW, roofBasedKW));
      
      // Annual production - use Quebec average (Google often overestimates for QC)
      // Quebec realistic range: 1000-1200 kWh/kW/year, use conservative 1100
      const annualProductionKWh = systemSizeKW * QC_PRODUCTION_FACTOR;
      
      // Log for validation
      console.log(`[Quick Estimate] System: ${systemSizeKW} kW, Production: ${annualProductionKWh} kWh/yr, Rate: ${energyRate} $/kWh`);
      
      // Avoided cost rate - use energy rate only (conservative, no demand savings assumed)
      const avoidedRate = energyRate;
      
      // Annual savings
      const annualSavings = Math.round(annualProductionKWh * avoidedRate);
      
      // CAPEX calculation
      const solarCostPerKW = 1800; // $/kW installed (commercial scale)
      const grossCAPEX = systemSizeKW * solarCostPerKW;
      
      // HQ incentive: $1000/kW capped at 40% of gross CAPEX
      // Note: At $1800/kW, 40% cap = $720/kW, which is less than $1000/kW
      // So incentive = min($1000/kW, 40% of CAPEX) = 40% of CAPEX at these prices
      const hqIncentive = Math.min(systemSizeKW * 1000, grossCAPEX * 0.40);
      
      // Net CAPEX after incentive
      const netCAPEX = grossCAPEX - hqIncentive;
      
      // Simple payback (years) with guard for zero/negative savings
      const paybackYears = annualSavings > 0 ? Math.max(0, Math.round((netCAPEX / annualSavings) * 10) / 10) : 99;
      
      // CO2 reduction (QC grid is ~1.2 g/kWh, so minimal, but still positive)
      const co2ReductionTons = Math.round(annualProductionKWh * 0.0012 * 10) / 10;
      
      // Calculate before/after HQ bill comparison - keep precision for consistency
      const annualBillBefore = monthlyBill * 12;
      const annualBillAfter = Math.max(0, annualBillBefore - annualSavings);
      const monthlyBillAfter = Math.round(annualBillAfter / 12);
      const monthlySavings = monthlyBill - monthlyBillAfter;
      
      res.json({
        success: true,
        hasRoofData,
        inputs: {
          address,
          monthlyBill,
          buildingType: buildingType || "office",
          tariffCode: tariff,
        },
        consumption: {
          annualKWh: Math.round(annualKWh),
          monthlyKWh: Math.round(monthlyKWh),
        },
        roof: hasRoofData ? {
          areaM2: Math.round(roofAreaSqM),
          maxCapacityKW: roofBasedKW,
          latitude: roofData?.latitude,
          longitude: roofData?.longitude,
          satelliteImageUrl: roofData?.latitude && roofData?.longitude 
            ? googleSolar.getSatelliteImageUrl({ latitude: roofData.latitude, longitude: roofData.longitude }, { width: 400, height: 300 })
            : null,
        } : null,
        system: {
          sizeKW: systemSizeKW,
          consumptionBasedKW, // What consumption suggests
          roofMaxCapacityKW: hasRoofData ? roofBasedKW : null, // What roof can support
          annualProductionKWh: Math.round(annualProductionKWh),
          selfConsumptionRate: targetSelfConsumption,
        },
        financial: {
          annualSavings,
          grossCAPEX: Math.round(grossCAPEX),
          hqIncentive: Math.round(hqIncentive),
          netCAPEX: Math.round(netCAPEX),
          paybackYears,
        },
        billing: {
          monthlyBillBefore: monthlyBill,
          monthlyBillAfter,
          monthlySavings,
          annualBillBefore,
          annualBillAfter: Math.round(annualBillAfter),
          annualSavings,
        },
        environmental: {
          co2ReductionTons,
        },
      });
    } catch (error) {
      console.error("Quick estimate error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Detailed analysis request with procuration and file uploads
  app.post("/api/detailed-analysis-request", upload.any(), async (req, res) => {
    try {
      const {
        companyName,
        firstName,
        lastName,
        email,
        phone,
        streetAddress,
        city,
        province,
        postalCode,
        estimatedMonthlyBill,
        buildingType,
        hqClientNumber,
        notes,
        procurationAccepted,
        procurationDate,
        language,
      } = req.body;

      // Combine first name and last name for contactName (used in leads)
      const contactName = `${firstName || ''} ${lastName || ''}`.trim();
      // Format for procuration: "Nom, Prénom" as required by HQ
      const formattedSignerName = `${lastName || ''}, ${firstName || ''}`.trim().replace(/^,\s*/, '').replace(/,\s*$/, '');

      // Validate required fields
      if (!companyName || !firstName || !lastName || !email || !streetAddress || !city) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      if (procurationAccepted !== 'true') {
        return res.status(400).json({ error: "Procuration must be accepted" });
      }

      // Get uploaded files
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "At least one HQ bill file is required" });
      }

      // Build notes with procuration info
      const procurationInfo = language === 'fr'
        ? `[PROCURATION SIGNÉE] Acceptée le ${new Date(procurationDate).toLocaleString('fr-CA')} par ${contactName}`
        : `[AUTHORIZATION SIGNED] Accepted on ${new Date(procurationDate).toLocaleString('en-CA')} by ${contactName}`;
      
      const fileInfo = files.map((f, i) => `Fichier ${i + 1}: ${f.originalname}`).join('\n');
      
      const combinedNotes = [
        '[Analyse Détaillée avec Procuration]',
        procurationInfo,
        '',
        `No de client HQ: ${hqClientNumber || 'Non fourni'}`,
        '',
        'Factures téléversées:',
        fileInfo,
        '',
        notes || ''
      ].join('\n').trim();

      // Create lead in database
      const leadData = {
        companyName,
        contactName,
        email,
        phone: phone || null,
        streetAddress,
        city,
        province: province || 'Québec',
        postalCode: postalCode || null,
        estimatedMonthlyBill: estimatedMonthlyBill ? parseFloat(estimatedMonthlyBill) : null,
        buildingType: buildingType || null,
        notes: combinedNotes,
        source: 'detailed-analysis-form',
        status: 'qualified', // Mark as qualified since they signed procuration
      };

      const parsed = insertLeadSchema.safeParse(leadData);
      if (!parsed.success) {
        console.error("[Detailed Analysis] Validation error:", parsed.error.errors);
        return res.status(400).json({ error: parsed.error.errors });
      }

      let lead = await storage.createLead(parsed.data);

      // Store file references (move files to permanent location)
      const uploadDir = path.join('uploads', 'bills', lead.id);
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      for (const file of files) {
        const destPath = path.join(uploadDir, file.originalname);
        fs.renameSync(file.path, destPath);
      }

      // Create procuration signature record with captured signature
      const signatureImage = req.body.signatureImage;
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';
      
      try {
        await storage.createProcurationSignature({
          signerName: contactName,
          signerEmail: email,
          companyName: companyName,
          hqAccountNumber: hqClientNumber || null,
          leadId: lead.id,
          status: 'signed',
          language: language === 'en' ? 'en' : 'fr',
          ipAddress: clientIp,
          userAgent: userAgent,
        });
        console.log(`[Detailed Analysis] Procuration signature recorded for lead: ${lead.id}`);
        
        // Validate and save signature image if provided
        if (signatureImage && typeof signatureImage === 'string') {
          // Validate it's a valid data URL with PNG format
          const validDataUrlPattern = /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/;
          const isValidFormat = signatureImage.startsWith('data:image/png;base64,');
          
          // Check size limit (500KB max for signature)
          const base64Data = signatureImage.replace(/^data:image\/\w+;base64,/, '');
          const sizeInBytes = Buffer.from(base64Data, 'base64').length;
          const maxSizeBytes = 500 * 1024; // 500KB
          
          if (isValidFormat && sizeInBytes <= maxSizeBytes) {
            const signatureDir = path.join('uploads', 'signatures');
            if (!fs.existsSync(signatureDir)) {
              fs.mkdirSync(signatureDir, { recursive: true });
            }
            const signaturePath = path.join(signatureDir, `${lead.id}_signature.png`);
            fs.writeFileSync(signaturePath, Buffer.from(base64Data, 'base64'));
            console.log(`[Detailed Analysis] Signature image saved: ${signaturePath} (${Math.round(sizeInBytes / 1024)}KB)`);
          } else {
            console.warn(`[Detailed Analysis] Invalid signature format or size: format=${isValidFormat}, size=${Math.round(sizeInBytes / 1024)}KB`);
          }
        }
      } catch (sigError) {
        console.error("[Detailed Analysis] Failed to create signature record:", sigError);
      }

      // Generate and send procuration PDF using official HQ template
      // TODO: BEFORE LAUNCH - Change email recipient from info@kwh.quebec to Hydro-Québec's official email
      try {
        const procurationData = createProcurationData(
          {
            companyName,
            contactName: formattedSignerName,
            signerTitle: req.body.signerTitle || '',
            hqAccountNumber: hqClientNumber || '',
            streetAddress,
            city,
            province: province || 'Québec',
            postalCode: postalCode || '',
            signatureCity: req.body.signatureCity || city || '',
            signatureImage,
            procurationDate,
          },
          clientIp,
          userAgent
        );

        // Generate PDF using official HQ template with pdf-lib
        const pdfBuffer = await generateProcurationPDF(procurationData);
        
        // Save PDF to disk
        const procurationDir = path.join('uploads', 'procurations');
        if (!fs.existsSync(procurationDir)) {
          fs.mkdirSync(procurationDir, { recursive: true });
        }
        const pdfFilename = `procuration_${lead.id}_${Date.now()}.pdf`;
        const pdfPath = path.join(procurationDir, pdfFilename);
        fs.writeFileSync(pdfPath, pdfBuffer);
        console.log(`[Detailed Analysis] Procuration PDF saved: ${pdfPath}`);
        
        // Send email with PDF attachment
        // TODO: BEFORE LAUNCH - Change to Hydro-Québec's official procuration email address
        const testRecipient = 'info@kwh.quebec'; // TESTING ONLY - Replace before production!
        
        const emailResult = await sendEmail({
          to: testRecipient,
          subject: `Procuration HQ - ${companyName} (${hqClientNumber || 'N/A'})`,
          htmlBody: `
            <p>Bonjour,</p>
            <p>Veuillez trouver ci-joint la procuration signée électroniquement par le client suivant :</p>
            <ul>
              <li><strong>Entreprise :</strong> ${companyName}</li>
              <li><strong>Contact :</strong> ${formattedSignerName}</li>
              <li><strong>Titre :</strong> ${req.body.signerTitle || 'Non spécifié'}</li>
              <li><strong>No de client HQ :</strong> ${hqClientNumber || 'Non fourni'}</li>
              <li><strong>Courriel :</strong> ${email}</li>
            </ul>
            <p>Cette procuration autorise kWh Québec à obtenir les données de consommation détaillées du client.</p>
            <p>Cordialement,<br>kWh Québec</p>
          `,
          textBody: `Procuration signée pour ${companyName} (${formattedSignerName}) - No client HQ: ${hqClientNumber || 'N/A'}`,
          attachments: [{
            filename: `procuration_${companyName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
            content: pdfBuffer.toString('base64'),
            type: 'application/pdf',
          }],
        });
        
        if (emailResult.success) {
          console.log(`[Detailed Analysis] Procuration email sent to ${testRecipient}`);
        } else {
          console.error(`[Detailed Analysis] Failed to send procuration email:`, emailResult.error);
        }
      } catch (pdfError) {
        console.error('[Detailed Analysis] Error generating/sending procuration PDF:', pdfError);
      }

      // Trigger roof estimation in background
      if (streetAddress && city) {
        triggerRoofEstimation(lead.id, leadData).catch((err) => {
          console.error(`[Detailed Analysis ${lead.id}] Roof estimation failed:`, err);
        });
      }

      console.log(`[Detailed Analysis] Lead created: ${lead.id}, Files: ${files.length}`);
      
      res.status(201).json({ 
        success: true, 
        leadId: lead.id,
        filesUploaded: files.length,
      });
    } catch (error) {
      console.error("[Detailed Analysis] Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  app.post("/api/leads", async (req, res) => {
    try {
      const parsed = insertLeadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      
      // Create lead in local database
      const lead = await storage.createLead(parsed.data);
      
      // Trigger automatic roof estimation in the background (non-blocking)
      if (parsed.data.streetAddress && parsed.data.city) {
        triggerRoofEstimation(lead.id, parsed.data).catch((err) => {
          console.error(`[Lead ${lead.id}] Roof estimation failed:`, err);
        });
      }
      
      res.status(201).json(lead);
    } catch (error) {
      console.error("Create lead error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Background function to estimate roof potential and send email
  async function triggerRoofEstimation(leadId: string, data: {
    streetAddress?: string | null;
    city?: string | null;
    province?: string | null;
    postalCode?: string | null;
    companyName: string;
    contactName: string;
    email: string;
  }) {
    try {
      // Build full address for Google Solar API
      const addressParts = [
        data.streetAddress,
        data.city,
        data.province || "Québec",
        data.postalCode,
        "Canada"
      ].filter(Boolean);
      const fullAddress = addressParts.join(", ");
      
      console.log(`[Lead ${leadId}] Starting roof estimation for: ${fullAddress}`);
      
      // Call Google Solar API
      const roofEstimate = await googleSolar.estimateRoofFromAddress(fullAddress);
      
      if (roofEstimate.success) {
        // Calculate roof potential: roofArea * 70% utilization * 185W/m² (typical panel density)
        const utilizationFactor = 0.70;
        const panelDensityWm2 = 185; // W per m²
        const usableRoofArea = roofEstimate.roofAreaSqM * utilizationFactor;
        const roofPotentialKw = Math.round((usableRoofArea * panelDensityWm2) / 1000 * 10) / 10;
        
        // Update lead with roof estimate
        const updatedLead = await storage.updateLead(leadId, {
          status: "roof_estimated",
          latitude: roofEstimate.latitude,
          longitude: roofEstimate.longitude,
          roofAreaSqM: roofEstimate.roofAreaSqM,
          roofPotentialKw: roofPotentialKw,
          estimateCompletedAt: new Date(),
        });
        
        console.log(`[Lead ${leadId}] Roof estimate complete: ${roofEstimate.roofAreaSqM.toFixed(0)} m², potential ${roofPotentialKw} kW`);
        
        // Send email with roof estimate
        await sendRoofEstimateEmail(data.email, data.contactName, data.companyName, {
          address: fullAddress,
          roofAreaSqM: roofEstimate.roofAreaSqM,
          roofPotentialKw: roofPotentialKw,
        });
        
      } else {
        // Update lead with error
        await storage.updateLead(leadId, {
          status: "estimate_failed",
          estimateError: roofEstimate.error || "Unknown error",
          estimateCompletedAt: new Date(),
        });
        
        console.warn(`[Lead ${leadId}] Roof estimation failed: ${roofEstimate.error}`);
      }
    } catch (error) {
      console.error(`[Lead ${leadId}] Error during roof estimation:`, error);
      await storage.updateLead(leadId, {
        status: "estimate_failed",
        estimateError: String(error),
        estimateCompletedAt: new Date(),
      });
    }
  }
  
  // Send bilingual roof estimate email
  async function sendRoofEstimateEmail(
    toEmail: string,
    contactName: string,
    companyName: string,
    estimate: { address: string; roofAreaSqM: number; roofPotentialKw: number }
  ) {
    const subject = "Votre potentiel solaire / Your Solar Potential - kWh Québec";
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f97316, #ea580c); padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">kWh Québec</h1>
        </div>
        
        <div style="padding: 32px; background: #f9fafb;">
          <p style="font-size: 16px; color: #374151;">Bonjour ${contactName},</p>
          
          <p style="font-size: 16px; color: #374151;">
            Merci pour votre intérêt envers le solaire! Voici une estimation préliminaire du potentiel solaire 
            de votre bâtiment situé au:
          </p>
          
          <div style="background: white; border-radius: 12px; padding: 24px; margin: 24px 0; border: 1px solid #e5e7eb;">
            <p style="color: #6b7280; margin: 0 0 8px 0; font-size: 14px;">📍 ${estimate.address}</p>
            
            <div style="display: flex; gap: 24px; margin-top: 16px;">
              <div style="flex: 1; text-align: center; padding: 16px; background: #fff7ed; border-radius: 8px;">
                <div style="font-size: 32px; font-weight: bold; color: #ea580c;">${Math.round(estimate.roofAreaSqM)}</div>
                <div style="font-size: 14px; color: #9a3412;">m² de toiture</div>
              </div>
              <div style="flex: 1; text-align: center; padding: 16px; background: #ecfdf5; border-radius: 8px;">
                <div style="font-size: 32px; font-weight: bold; color: #059669;">${estimate.roofPotentialKw}</div>
                <div style="font-size: 14px; color: #047857;">kW potentiel</div>
              </div>
            </div>
          </div>
          
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0;">
            <p style="margin: 0; font-size: 14px; color: #92400e;">
              <strong>Prochaine étape:</strong> Pour une analyse complète avec vos données de consommation réelles, 
              nous devons obtenir un accès à votre historique Hydro-Québec. Un conseiller vous contactera 
              sous peu pour vous accompagner dans cette démarche simple.
            </p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
          
          <p style="font-size: 16px; color: #374151;">Hello ${contactName},</p>
          
          <p style="font-size: 16px; color: #374151;">
            Thank you for your interest in solar! Here is a preliminary estimate of the solar potential 
            for your building located at:
          </p>
          
          <div style="background: white; border-radius: 12px; padding: 24px; margin: 24px 0; border: 1px solid #e5e7eb;">
            <p style="color: #6b7280; margin: 0 0 8px 0; font-size: 14px;">📍 ${estimate.address}</p>
            
            <div style="display: flex; gap: 24px; margin-top: 16px;">
              <div style="flex: 1; text-align: center; padding: 16px; background: #fff7ed; border-radius: 8px;">
                <div style="font-size: 32px; font-weight: bold; color: #ea580c;">${Math.round(estimate.roofAreaSqM)}</div>
                <div style="font-size: 14px; color: #9a3412;">m² roof area</div>
              </div>
              <div style="flex: 1; text-align: center; padding: 16px; background: #ecfdf5; border-radius: 8px;">
                <div style="font-size: 32px; font-weight: bold; color: #059669;">${estimate.roofPotentialKw}</div>
                <div style="font-size: 14px; color: #047857;">kW potential</div>
              </div>
            </div>
          </div>
          
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0;">
            <p style="margin: 0; font-size: 14px; color: #92400e;">
              <strong>Next step:</strong> For a complete analysis with your actual consumption data, 
              we need access to your Hydro-Québec history. An advisor will contact you shortly 
              to guide you through this simple process.
            </p>
          </div>
        </div>
        
        <div style="padding: 24px; background: #1f2937; text-align: center;">
          <p style="color: #9ca3af; margin: 0; font-size: 14px;">
            kWh Québec | Solaire + Stockage pour C&I | Solar + Storage for C&I
          </p>
        </div>
      </div>
    `;
    
    try {
      const result = await sendEmail({
        to: toEmail,
        subject,
        htmlBody: htmlContent,
      });
      
      if (result.success) {
        console.log(`[Email] Roof estimate sent to ${toEmail}`);
      } else {
        console.error(`[Email] Failed to send roof estimate to ${toEmail}:`, result.error);
      }
    } catch (error) {
      console.error(`[Email] Error sending roof estimate:`, error);
    }
  }

  // Staff-only leads access
  app.get("/api/leads", authMiddleware, requireStaff, async (req, res) => {
    try {
      const leads = await storage.getLeads();
      res.json(leads);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== DASHBOARD ROUTES ====================
  
  // Staff-only dashboard
  app.get("/api/dashboard/stats", authMiddleware, requireStaff, async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Pipeline stats for sales dashboard
  app.get("/api/dashboard/pipeline-stats", authMiddleware, requireStaff, async (req, res) => {
    try {
      const stats = await storage.getPipelineStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching pipeline stats:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== GLOBAL SEARCH ====================

  // Global search across clients, sites, and opportunities
  app.get("/api/search", authMiddleware, requireStaff, async (req, res) => {
    try {
      const query = (req.query.q as string || "").toLowerCase().trim();
      
      if (!query) {
        return res.json({ clients: [], sites: [], opportunities: [] });
      }

      // Get all data and filter
      const [allClients, allSites, allOpportunities] = await Promise.all([
        storage.getClients(),
        storage.getSites(),
        storage.getOpportunities(),
      ]);

      // Search clients by name, contact name, or email
      const clients = allClients
        .filter(client => 
          client.name.toLowerCase().includes(query) ||
          (client.mainContactName && client.mainContactName.toLowerCase().includes(query)) ||
          (client.email && client.email.toLowerCase().includes(query))
        )
        .slice(0, 5)
        .map(c => ({
          id: c.id,
          name: c.name,
          mainContactName: c.mainContactName,
          email: c.email,
        }));

      // Search sites by name, city, or address
      const sites = allSites
        .filter(site =>
          site.name.toLowerCase().includes(query) ||
          (site.city && site.city.toLowerCase().includes(query)) ||
          (site.address && site.address.toLowerCase().includes(query)) ||
          (site.client && site.client.name.toLowerCase().includes(query))
        )
        .slice(0, 5)
        .map(s => ({
          id: s.id,
          name: s.name,
          city: s.city,
          clientName: s.client?.name || null,
        }));

      // Search opportunities by name or description
      const opportunities = allOpportunities
        .filter(opp =>
          opp.name.toLowerCase().includes(query) ||
          (opp.description && opp.description.toLowerCase().includes(query))
        )
        .slice(0, 5)
        .map(o => ({
          id: o.id,
          name: o.name,
          stage: o.stage,
          estimatedValue: o.estimatedValue,
        }));

      res.json({ clients, sites, opportunities });
    } catch (error) {
      console.error("Error in global search:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== CLIENT ROUTES ====================
  
  // Staff-only client management
  app.get("/api/clients", authMiddleware, requireStaff, async (req, res) => {
    try {
      const clients = await storage.getClients();
      res.json(clients);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/clients/:id", authMiddleware, requireStaff, async (req, res) => {
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

  app.get("/api/clients/:id/sites", authMiddleware, requireStaff, async (req, res) => {
    try {
      const sites = await storage.getSitesByClient(req.params.id);
      res.json(sites);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/clients", authMiddleware, requireStaff, async (req, res) => {
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

  app.patch("/api/clients/:id", authMiddleware, requireStaff, async (req, res) => {
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

  app.delete("/api/clients/:id", authMiddleware, requireStaff, async (req, res) => {
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
  
  // Optimized paginated sites list endpoint - lightweight, fast loading
  app.get("/api/sites/list", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;
      const search = req.query.search as string | undefined;
      
      // Client users only see their own sites
      const clientId = req.userRole === "client" && req.userClientId 
        ? req.userClientId 
        : (req.query.clientId as string | undefined);
      
      const result = await storage.getSitesListPaginated({
        limit,
        offset,
        search,
        clientId,
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching sites list:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  app.get("/api/sites", authMiddleware, async (req: AuthRequest, res) => {
    try {
      let sites: Awaited<ReturnType<typeof storage.getSites>>;
      let clientsById: Map<string, { name: string }> = new Map();
      
      // Client users only see their own sites
      if (req.userRole === "client" && req.userClientId) {
        sites = await storage.getSitesByClient(req.userClientId);
        const client = await storage.getClient(req.userClientId);
        if (client) {
          clientsById.set(client.id, { name: client.name });
        }
      } else {
        // Admin/analyst see all sites
        sites = await storage.getSites();
        // Get all clients for enrichment
        const clients = await storage.getClients();
        clients.forEach(c => clientsById.set(c.id, { name: c.name }));
      }
      
      // Enrich sites with simulation runs and design agreements for portal
      const allRuns = await storage.getSimulationRuns();
      const allAgreements = await storage.getDesignAgreements();
      
      const runsBySiteId = new Map<string, typeof allRuns>();
      allRuns.forEach(run => {
        const existing = runsBySiteId.get(run.siteId) || [];
        existing.push(run);
        runsBySiteId.set(run.siteId, existing);
      });
      
      const agreementBySiteId = new Map<string, typeof allAgreements[0]>();
      allAgreements.forEach(a => {
        agreementBySiteId.set(a.siteId, a);
      });
      
      const enrichedSites = sites.map(site => ({
        ...site,
        client: site.clientId ? clientsById.get(site.clientId) || null : null,
        simulationRuns: runsBySiteId.get(site.id) || [],
        designAgreement: agreementBySiteId.get(site.id) || null
      }));
      
      res.json(enrichedSites);
    } catch (error) {
      console.error("Error fetching sites:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/sites/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const site = await storage.getSite(req.params.id);
      if (!site) {
        return res.status(404).json({ error: "Site not found" });
      }
      
      // Client users can only view their own sites
      if (req.userRole === "client" && req.userClientId && site.clientId !== req.userClientId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      res.json(site);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Staff-only routes for site management
  app.post("/api/sites", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const parsed = insertSiteSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      
      const site = await storage.createSite(parsed.data);
      
      // Trigger automatic roof estimation if address is provided and Google Solar is configured
      const hasAddress = site.address || site.city || site.postalCode;
      if (hasAddress && googleSolar.isGoogleSolarConfigured()) {
        // Mark as pending with timestamp and trigger async estimation
        await storage.updateSite(site.id, { 
          roofEstimateStatus: "pending",
          roofEstimatePendingAt: new Date()
        });
        
        // Fire-and-forget: don't await, let it run in background
        triggerRoofEstimation(site.id).catch(err => {
          console.error("Background roof estimation failed:", err);
        });
      }
      
      // Auto-create Prospect opportunity for new sites (unless site is part of a portfolio)
      const isInPortfolio = await storage.isSiteInAnyPortfolio(site.id);
      
      if (!isInPortfolio) {
        try {
          // Check if an opportunity already exists for this site (idempotency)
          const existingOpps = await storage.getOpportunitiesBySiteId(site.id);
          if (existingOpps.length === 0) {
            const client = await storage.getClient(site.clientId);
            const clientName = client?.name || "Unknown";
            
              await storage.createOpportunity({
              name: `${site.name} - Solar Project`,
              description: `Opportunity for ${clientName} - ${site.name}. Auto-created on site creation.`,
              clientId: site.clientId,
              siteId: site.id,
              stage: "prospect",
              probability: 5, // Prospect stage = 5%
              estimatedValue: null, // Will be updated after analysis
              estimatedCloseDate: null,
              ownerId: req.userId || null,
              source: "internal",
              sourceDetails: "Auto-created on site creation",
              priority: "medium",
            });
          }
        } catch (oppError) {
          console.error("Failed to auto-create opportunity:", oppError);
          // Don't fail the site creation if opportunity creation fails
        }
      }
      
      res.status(201).json(site);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/sites/:id", authMiddleware, requireStaff, async (req, res) => {
    try {
      // Whitelist of allowed fields for site PATCH updates
      const allowedFields = [
        'name', 'address', 'latitude', 'longitude', 'buildingType', 'buildingSqFt',
        'roofAreaSqFt', 'roofType', 'roofSlope', 'roofOrientation', 'notes',
        'structuralNotes', 'structuralConstraints',
        'roofEstimateStatus', 'roofEstimateError', 'roofEstimatePendingAt',
        'analysisAssumptions', 'googleSolarData'
      ];
      
      // Filter body to only include allowed fields
      const filteredBody: Record<string, unknown> = {};
      for (const key of allowedFields) {
        if (key in req.body) {
          filteredBody[key] = req.body[key];
        }
      }
      
      // Basic validation for structural fields
      if ('structuralNotes' in filteredBody && filteredBody.structuralNotes !== null) {
        if (typeof filteredBody.structuralNotes !== 'string') {
          return res.status(400).json({ error: "structuralNotes must be a string" });
        }
      }
      
      if ('structuralConstraints' in filteredBody && filteredBody.structuralConstraints !== null) {
        const sc = filteredBody.structuralConstraints as Record<string, unknown>;
        if (typeof sc !== 'object' || Array.isArray(sc)) {
          return res.status(400).json({ error: "structuralConstraints must be an object" });
        }
        // Validate known fields if present
        if ('maxPvLoadKpa' in sc && sc.maxPvLoadKpa !== undefined) {
          if (typeof sc.maxPvLoadKpa !== 'number' || isNaN(sc.maxPvLoadKpa)) {
            return res.status(400).json({ error: "maxPvLoadKpa must be a number" });
          }
        }
        if ('roofChangeRequired' in sc && sc.roofChangeRequired !== undefined) {
          if (typeof sc.roofChangeRequired !== 'boolean') {
            return res.status(400).json({ error: "roofChangeRequired must be a boolean" });
          }
        }
        if ('engineeringReportRef' in sc && sc.engineeringReportRef !== undefined) {
          if (typeof sc.engineeringReportRef !== 'string') {
            return res.status(400).json({ error: "engineeringReportRef must be a string" });
          }
        }
      }
      
      const site = await storage.updateSite(req.params.id, filteredBody);
      if (!site) {
        return res.status(404).json({ error: "Site not found" });
      }
      res.json(site);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/sites/:id", authMiddleware, requireStaff, async (req, res) => {
    try {
      const deleted = await storage.deleteSite(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Site not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting site:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== GOOGLE SOLAR API ROUTES ====================

  app.get("/api/google-solar/status", authMiddleware, async (req, res) => {
    res.json({ configured: googleSolar.isGoogleSolarConfigured() });
  });

  // Reset stale roof estimation status (staff only)
  app.post("/api/sites/:id/reset-roof-status", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const siteId = req.params.id;
      console.log(`[RoofEstimate] Resetting status for site ${siteId}`);
      
      const site = await storage.getSite(siteId);
      if (!site) {
        return res.status(404).json({ error: "Site not found" });
      }

      const updatedSite = await storage.updateSite(siteId, {
        roofEstimateStatus: null,
        roofEstimateError: null,
        roofEstimatePendingAt: null
      });

      res.json({ success: true, site: updatedSite });
    } catch (error) {
      console.error("Reset roof status error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/sites/:id/roof-estimate", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const siteId = req.params.id;
      console.log(`[RoofEstimate] Starting estimation for site ${siteId}`);
      
      const site = await storage.getSite(siteId);
      if (!site) {
        console.log(`[RoofEstimate] Site ${siteId} not found`);
        return res.status(404).json({ error: "Site not found" });
      }

      if (!googleSolar.isGoogleSolarConfigured()) {
        console.log(`[RoofEstimate] Google Solar API not configured`);
        return res.status(503).json({ error: "Google Solar API not configured" });
      }

      let result: googleSolar.RoofEstimateResult;

      if (site.latitude && site.longitude) {
        console.log(`[RoofEstimate] Using existing coordinates: lat=${site.latitude}, lng=${site.longitude}`);
        result = await googleSolar.estimateRoofFromLocation({
          latitude: site.latitude,
          longitude: site.longitude
        });
      } else {
        const fullAddress = [
          site.address,
          site.city,
          site.province,
          site.postalCode,
          "Canada"
        ].filter(Boolean).join(", ");

        if (!fullAddress || fullAddress === "Canada") {
          console.log(`[RoofEstimate] No address provided for site ${siteId}`);
          return res.status(400).json({ error: "Site address is required for roof estimation" });
        }

        console.log(`[RoofEstimate] Geocoding address: ${fullAddress}`);
        result = await googleSolar.estimateRoofFromAddress(fullAddress);
      }
      
      console.log(`[RoofEstimate] Result: success=${result.success}, roofArea=${result.roofAreaSqM}m², error=${result.error || 'none'}`);

      if (!result.success) {
        return res.status(422).json({ 
          error: result.error || "Could not estimate roof area for this location",
          latitude: result.latitude,
          longitude: result.longitude
        });
      }

      // Include both raw details AND calculated googleProductionEstimate for analysis
      // Use JSON.parse/stringify to ensure clean JSON serialization for database storage
      const enrichedDetails = JSON.parse(JSON.stringify({
        ...result.details,
        maxSunshineHoursPerYear: result.maxSunshineHoursPerYear,
        roofSegments: result.roofSegments,
        googleProductionEstimate: result.googleProductionEstimate,
        panelCapacityWatts: result.panelCapacityWatts,
        maxArrayAreaSqM: result.maxArrayAreaSqM,
      }));
      
      const updatedSite = await storage.updateSite(siteId, {
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

      res.json({
        success: true,
        site: updatedSite,
        roofEstimate: {
          roofAreaSqM: result.roofAreaSqM,
          roofAreaSqFt: result.roofAreaSqM * 10.764,
          maxArrayAreaSqM: result.maxArrayAreaSqM,
          maxArrayAreaSqFt: result.maxArrayAreaSqM * 10.764,
          maxSunshineHoursPerYear: result.maxSunshineHoursPerYear,
          imageryDate: result.imageryDate,
          imageryQuality: result.imageryQuality,
          roofSegmentsCount: result.roofSegmentsCount,
          roofSegments: result.roofSegments,
          googleProductionEstimate: result.googleProductionEstimate,
          panelCapacityWatts: result.panelCapacityWatts,
          carbonOffsetFactorKgPerMwh: result.carbonOffsetFactorKgPerMwh,
          latitude: result.latitude,
          longitude: result.longitude,
        }
      });
    } catch (error) {
      console.error("Roof estimate error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Endpoint to get roof imagery (dataLayers)
  app.get("/api/sites/:id/roof-imagery", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const siteId = req.params.id;
      
      const site = await storage.getSite(siteId);
      if (!site) {
        return res.status(404).json({ error: "Site not found" });
      }

      if (!googleSolar.isGoogleSolarConfigured()) {
        return res.status(503).json({ error: "Google Solar API not configured" });
      }

      let latitude = site.latitude;
      let longitude = site.longitude;

      // If no coordinates, try to geocode
      if (!latitude || !longitude) {
        const fullAddress = [
          site.address,
          site.city,
          site.province,
          site.postalCode,
          "Canada"
        ].filter(Boolean).join(", ");

        if (!fullAddress || fullAddress === "Canada") {
          return res.status(400).json({ error: "Site address is required for roof imagery" });
        }

        const location = await googleSolar.geocodeAddress(fullAddress);
        if (!location) {
          return res.status(422).json({ error: "Could not geocode address" });
        }
        latitude = location.latitude;
        longitude = location.longitude;
      }

      const result = await googleSolar.getDataLayers({ latitude, longitude }, 75);

      if (!result.success) {
        return res.status(422).json({ 
          error: result.error || "Could not get roof imagery for this location"
        });
      }

      res.json({
        success: true,
        latitude,
        longitude,
        rgbUrl: result.rgbUrl,
        maskUrl: result.maskUrl,
        dsmUrl: result.dsmUrl,
        annualFluxUrl: result.annualFluxUrl,
        imageryDate: result.imageryDate,
        imageryQuality: result.imageryQuality,
        imageryProcessedDate: result.imageryProcessedDate
      });
    } catch (error) {
      console.error("Roof imagery error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Endpoint to get solar mockup data (satellite image + panel positions)
  app.get("/api/sites/:id/solar-mockup", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const siteId = req.params.id;
      const panelCount = req.query.panelCount ? parseInt(req.query.panelCount as string) : undefined;
      
      const site = await storage.getSite(siteId);
      if (!site) {
        return res.status(404).json({ error: "Site not found" });
      }

      if (!googleSolar.isGoogleSolarConfigured()) {
        return res.status(503).json({ error: "Google Solar API not configured" });
      }

      let latitude = site.latitude;
      let longitude = site.longitude;

      // If no coordinates, try to geocode
      if (!latitude || !longitude) {
        const fullAddress = [
          site.address,
          site.city,
          site.province,
          site.postalCode,
          "Canada"
        ].filter(Boolean).join(", ");

        if (!fullAddress || fullAddress === "Canada") {
          return res.status(400).json({ error: "Site address is required for solar mockup" });
        }

        const location = await googleSolar.geocodeAddress(fullAddress);
        if (!location) {
          return res.status(422).json({ error: "Could not geocode address" });
        }
        latitude = location.latitude;
        longitude = location.longitude;
      }

      const result = await googleSolar.getSolarMockupData({ latitude, longitude }, panelCount);

      if (!result.success) {
        return res.status(422).json({ 
          error: result.error || "Could not generate solar mockup for this location"
        });
      }

      res.json({
        success: true,
        siteId,
        siteName: site.name,
        ...result
      });
    } catch (error) {
      console.error("Solar mockup error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Endpoint to respond to bifacial analysis prompt
  app.post("/api/sites/:id/bifacial-response", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const siteId = req.params.id;
      const { accepted } = req.body;
      
      const site = await storage.getSite(siteId);
      if (!site) {
        return res.status(404).json({ error: "Site not found" });
      }

      // Update site with bifacial response
      const updatedSite = await storage.updateSite(siteId, {
        bifacialAnalysisPrompted: true,
        bifacialAnalysisAccepted: accepted === true,
      });

      // If accepted, also update analysis assumptions to enable bifacial
      if (accepted === true) {
        const currentAssumptions = (site.analysisAssumptions || {}) as Record<string, any>;
        const updatedAssumptions = {
          ...currentAssumptions,
          bifacialEnabled: true,
          bifacialityFactor: 0.85,
          roofAlbedo: site.roofColorType === "white_membrane" ? 0.70 : 
                      site.roofColorType === "light" ? 0.50 : 0.25,
          bifacialCostPremium: 0.10,
        };
        
        await storage.updateSite(siteId, {
          analysisAssumptions: updatedAssumptions,
        });
      }

      res.json({
        success: true,
        bifacialEnabled: accepted === true,
        site: updatedSite
      });
    } catch (error) {
      console.error("Bifacial response error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== FILE UPLOAD ROUTES ====================
  
  // Staff-only file upload
  app.post("/api/sites/:siteId/upload-meters", authMiddleware, requireStaff, upload.array("files"), async (req: AuthRequest, res) => {
    try {
      const siteId = req.params.siteId;
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const meterFiles = [];
      
      for (const file of files) {
        // Determine granularity from filename
        // Hydro-Québec uses "15min" for 15-minute data and "heure" for hourly data
        const filename = file.originalname.toLowerCase();
        const granularity = filename.includes("15min") ? "FIFTEEN_MIN" : 
                           filename.includes("heure") ? "HOUR" : "HOUR";
        
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
  
  // Staff-only analysis (clients can only view results)
  app.post("/api/sites/:siteId/run-potential-analysis", authMiddleware, requireStaff, async (req, res) => {
    try {
      const siteId = req.params.siteId;
      
      // Get custom assumptions from request body (if provided)
      const customAssumptions = req.body?.assumptions as Partial<AnalysisAssumptions> | undefined;
      
      // Optional forced sizing parameters for variant creation
      // Validate and clamp to reasonable ranges
      let forcePvSize = req.body?.forcePvSize as number | undefined;
      let forceBatterySize = req.body?.forceBatterySize as number | undefined;
      let forceBatteryPower = req.body?.forceBatteryPower as number | undefined;
      const customLabel = req.body?.label as string | undefined;
      
      // Validate forced sizing values (clamp to reasonable ranges)
      if (forcePvSize !== undefined) {
        forcePvSize = Math.max(0, Math.min(10000, forcePvSize)); // 0-10 MW cap
      }
      if (forceBatterySize !== undefined) {
        forceBatterySize = Math.max(0, Math.min(10000, forceBatterySize)); // 0-10 MWh cap
      }
      if (forceBatteryPower !== undefined) {
        forceBatteryPower = Math.max(0, Math.min(5000, forceBatteryPower)); // 0-5 MW cap
      }
      
      // Get meter readings for the site
      const rawReadings = await storage.getMeterReadingsBySite(siteId);
      
      if (rawReadings.length === 0) {
        return res.status(400).json({ error: "No meter data available" });
      }
      
      // CRITICAL: Sort and deduplicate readings by hour
      // Multiple meter files can have overlapping periods (HOUR + FIFTEEN_MIN for same dates)
      // This prevents massive overcounting of consumption (e.g., 303M kWh instead of ~500k kWh)
      const dedupResult = deduplicateMeterReadingsByHour(rawReadings);
      const readings = dedupResult.readings;
      const preCalculatedDataSpanDays = dedupResult.dataSpanDays;
      console.log(`Meter readings: ${rawReadings.length} raw -> ${readings.length} deduplicated, dataSpan: ${preCalculatedDataSpanDays.toFixed(1)} days`)
      
      // Get site data to check for Google Solar data
      const site = await storage.getSite(siteId);
      
      // Start with site's saved assumptions (includes bifacial settings if user accepted)
      const siteAssumptions = (site?.analysisAssumptions || {}) as Partial<AnalysisAssumptions>;
      
      // Merge: site assumptions (bifacial, etc.) + custom assumptions (from request body)
      // Custom assumptions take precedence over site assumptions
      let mergedAssumptions = { ...siteAssumptions, ...customAssumptions };
      
      // CRITICAL: Delete any legacy _yieldStrategy from previous runs
      // This ensures we always recompute yield with current bifacialEnabled setting
      delete (mergedAssumptions as any)._yieldStrategy;
      
      // Use UNIFIED yield strategy resolver - single source of truth for yieldSource
      // Google Solar API stores data in different places depending on the response structure
      // We need to normalize to a consistent format for resolveYieldStrategy
      const rawDetails = site?.roofAreaAutoDetails as {
        // Top-level fields (may or may not be present)
        maxSunshineHoursPerYear?: number;
        roofSegments?: Array<{ azimuth?: number; pitch?: number }>;
        googleProductionEstimate?: {
          yearlyEnergyAcKwh: number;
          systemSizeKw: number;
        };
        // Nested in solarPotential (Google Solar API response format)
        solarPotential?: {
          maxSunshineHoursPerYear?: number;
          roofSegmentStats?: Array<{ azimuthDegrees?: number; pitchDegrees?: number }>;
          solarPanelConfigs?: Array<{
            panelsCount: number;
            yearlyEnergyDcKwh: number;
          }>;
          panelCapacityWatts?: number;
        };
      } | undefined;
      
      // Normalize to consistent format for resolveYieldStrategy
      // Priority: top-level fields (enriched) > solarPotential fields (raw API)
      const solarPotential = rawDetails?.solarPotential;
      
      // Calculate googleProductionEstimate from solarPanelConfigs
      let calculatedProductionEstimate: { yearlyEnergyAcKwh: number; systemSizeKw: number } | undefined;
      const configs = solarPotential?.solarPanelConfigs;
      const panelWatts = solarPotential?.panelCapacityWatts ?? 400;
      if (configs && configs.length > 0) {
        const maxConfig = configs.reduce((max, c) => c.panelsCount > max.panelsCount ? c : max, configs[0]);
        const systemSizeKw = (maxConfig.panelsCount * panelWatts) / 1000;
        const yearlyEnergyAcKwh = maxConfig.yearlyEnergyDcKwh * 0.85; // 85% DC-to-AC
        calculatedProductionEstimate = { yearlyEnergyAcKwh, systemSizeKw };
        console.log(`[GoogleData] Calculated from solarPanelConfigs: maxPanels=${maxConfig.panelsCount}, dcKwh=${maxConfig.yearlyEnergyDcKwh.toFixed(0)}, systemSizeKw=${systemSizeKw.toFixed(1)}, acKwh=${yearlyEnergyAcKwh.toFixed(0)}, yield=${(yearlyEnergyAcKwh / systemSizeKw).toFixed(0)} kWh/kWp`);
      }
      
      const googleData = {
        maxSunshineHoursPerYear: rawDetails?.maxSunshineHoursPerYear ?? solarPotential?.maxSunshineHoursPerYear,
        roofSegments: rawDetails?.roofSegments ?? solarPotential?.roofSegmentStats?.map(s => ({
          azimuth: s.azimuthDegrees,
          pitch: s.pitchDegrees,
        })),
        googleProductionEstimate: rawDetails?.googleProductionEstimate ?? calculatedProductionEstimate,
      };
      
      console.log(`[GoogleData] Final: hasMaxSunshineHours=${!!googleData.maxSunshineHoursPerYear}, hasProductionEstimate=${!!googleData.googleProductionEstimate}, hasRoofSegments=${!!googleData.roofSegments?.length}`);
      
      // Resolve yield strategy using unified module
      const yieldStrategy = resolveYieldStrategy(mergedAssumptions, googleData);
      
      // Apply resolved values to assumptions
      mergedAssumptions.solarYieldKWhPerKWp = yieldStrategy.baseYield;
      mergedAssumptions.yieldSource = yieldStrategy.yieldSource;
      mergedAssumptions.orientationFactor = yieldStrategy.orientationFactor;
      
      // CRITICAL: Store skip flag directly for downstream code paths
      (mergedAssumptions as any)._yieldStrategy = yieldStrategy;
      
      console.log(`[UNIFIED] Yield strategy resolved: source='${yieldStrategy.yieldSource}', baseYield=${yieldStrategy.baseYield}, bifacialBoost=${yieldStrategy.bifacialBoost.toFixed(2)}, skipTempCorrection=${yieldStrategy.skipTempCorrection}, effectiveYield=${yieldStrategy.effectiveYield.toFixed(0)}`);
      
      // Calculate orientation factor from roof segments if not already set
      if (googleData?.roofSegments && googleData.roofSegments.length > 0 && !customAssumptions?.orientationFactor) {
        let totalQuality = 0;
        let count = 0;
        for (const segment of googleData.roofSegments) {
          const azimuth = segment.azimuth || 180;
          const pitch = segment.pitch || 25;
          const azimuthNormalized = Math.abs(azimuth - 180) / 180;
          const azimuthFactor = 1.0 - (azimuthNormalized * 0.4);
          const pitchOptimal = 30;
          const pitchDeviation = Math.abs(pitch - pitchOptimal) / pitchOptimal;
          const pitchFactor = 1.0 - Math.min(0.15, pitchDeviation * 0.15);
          totalQuality += azimuthFactor * pitchFactor;
          count++;
        }
        const avgQuality = count > 0 ? totalQuality / count : 1.0;
        mergedAssumptions.orientationFactor = Math.max(0.6, Math.min(1.0, avgQuality));
      }
      
      // Run the analysis with merged assumptions (Google Solar + custom)
      // Pass forced sizing and pre-calculated dataSpanDays from deduplication
      const analysisResult = runPotentialAnalysis(readings, mergedAssumptions, {
        forcedSizing: {
          forcePvSize,
          forceBatterySize,
          forceBatteryPower,
        },
        preCalculatedDataSpanDays,
      });
      
      // Create label: use custom label or generate from date
      const label = customLabel || `Analyse ${new Date().toLocaleDateString("fr-CA")}`;
      
      // Create simulation run with assumptions stored
      const simulation = await storage.createSimulationRun({
        siteId,
        label,
        type: "SCENARIO",
        ...analysisResult,
      });

      // Update site to mark analysis as available and save MERGED assumptions (includes yieldSource!)
      // Clean up internal _yieldStrategy object before persisting
      const assumptionsToSave = { ...mergedAssumptions };
      delete (assumptionsToSave as any)._yieldStrategy;
      await storage.updateSite(siteId, { 
        analysisAvailable: true,
        analysisAssumptions: assumptionsToSave,
      });

      res.status(201).json(simulation);
    } catch (error) {
      console.error("Analysis error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== ADVANCED ANALYSIS MODULES ====================

  // Module A: Monte Carlo Probabilistic ROI Analysis
  app.post("/api/sites/:siteId/monte-carlo-analysis", authMiddleware, requireStaff, async (req, res) => {
    try {
      const siteId = req.params.siteId;
      const config = req.body?.config as Partial<MonteCarloConfig> | undefined;
      const customAssumptions = req.body?.assumptions as Partial<AnalysisAssumptions> | undefined;
      
      const rawReadings = await storage.getMeterReadingsBySite(siteId);
      if (rawReadings.length === 0) {
        return res.status(400).json({ error: "No meter data available for Monte Carlo analysis" });
      }
      
      const dedupResult = deduplicateMeterReadingsByHour(rawReadings);
      const readings = dedupResult.readings;
      const preCalculatedDataSpanDays = dedupResult.dataSpanDays;
      
      const site = await storage.getSite(siteId);
      const siteAssumptions = (site?.analysisAssumptions || {}) as Partial<AnalysisAssumptions>;
      const mergedAssumptions: AnalysisAssumptions = { 
        ...defaultAnalysisAssumptions, 
        ...siteAssumptions, 
        ...customAssumptions 
      };
      
      const monteCarloConfig: MonteCarloConfig = {
        ...defaultMonteCarloConfig,
        ...config,
      };
      
      const { hourlyData } = buildHourlyData(readings);
      const peakKW = Math.max(...hourlyData.map((h: { hour: number; month: number; consumption: number; peak: number }) => h.peak));
      const annualConsumptionKWh = hourlyData.reduce((sum: number, h: { hour: number; month: number; consumption: number; peak: number }) => sum + h.consumption, 0);
      
      const baseAnalysis = runPotentialAnalysis(readings, mergedAssumptions, { preCalculatedDataSpanDays });
      const pvSizeKW = baseAnalysis.pvSizeKW;
      const batteryKWh = baseAnalysis.battEnergyKWh;
      const batteryKW = baseAnalysis.battPowerKW;
      
      const monteCarloResult = runMonteCarloAnalysis(
        mergedAssumptions,
        (assumptions) => runScenarioWithSizing(
          hourlyData,
          pvSizeKW,
          batteryKWh,
          batteryKW,
          peakKW,
          annualConsumptionKWh,
          assumptions
        ),
        monteCarloConfig
      );
      
      res.json({
        success: true,
        siteId,
        systemSizing: { pvSizeKW, batteryKWh, batteryKW },
        monteCarlo: monteCarloResult,
        baseAssumptions: mergedAssumptions,
      });
    } catch (error) {
      console.error("Monte Carlo analysis error:", error);
      res.status(500).json({ error: "Monte Carlo analysis failed" });
    }
  });

  // Module B: 15-Minute Peak Shaving Analysis
  app.post("/api/sites/:siteId/peak-shaving-analysis", authMiddleware, requireStaff, async (req, res) => {
    try {
      const siteId = req.params.siteId;
      const config = req.body as Partial<PeakShavingConfig> | undefined;
      
      const rawReadings = await storage.getMeterReadingsBySite(siteId);
      if (rawReadings.length === 0) {
        return res.status(400).json({ error: "No meter data available for peak shaving analysis" });
      }
      
      const site = await storage.getSite(siteId);
      const siteAssumptions = (site?.analysisAssumptions || {}) as Partial<AnalysisAssumptions>;
      const tariffCode = (config?.tariffCode || siteAssumptions.tariffCode || 'M') as 'G' | 'M' | 'L';
      
      const simulations = await storage.getSimulationRunsBySite(siteId);
      const latestSimulation = simulations.length > 0 
        ? simulations.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
          })[0]
        : null;
      let solarProfile = config?.solarProductionProfile;
      
      if (!solarProfile && latestSimulation) {
        const systemSizeKW = latestSimulation.pvSizeKW || 0;
        const yieldKWhPerKWp = siteAssumptions.solarYieldKWhPerKWp || 1150;
        solarProfile = generateSolarProductionProfile(systemSizeKW, yieldKWhPerKWp);
      }
      
      const peakShavingConfig: PeakShavingConfig = {
        tariffCode,
        targetReductionPercent: config?.targetReductionPercent || 0.15,
        minBatteryCoverage: config?.minBatteryCoverage || 0.5,
        solarProductionProfile: solarProfile,
      };
      
      const meterReadings = rawReadings.map(r => ({
        timestamp: r.timestamp,
        kWh: r.kWh,
        kW: r.kW,
        granularity: r.granularity || undefined,
      }));
      
      const result = analyzePeakShaving(meterReadings, peakShavingConfig);
      
      const fifteenMinCount = rawReadings.filter(r => r.granularity === 'FIFTEEN_MIN').length;
      const hourlyCount = rawReadings.filter(r => r.granularity === 'HOUR').length;
      
      res.json({
        success: true,
        siteId,
        dataQuality: {
          fifteenMinReadings: fifteenMinCount,
          hourlyReadings: hourlyCount,
          granularityUsed: fifteenMinCount > 0 ? 'FIFTEEN_MIN' : 'HOUR',
        },
        peakShaving: result,
      });
    } catch (error) {
      console.error("Peak shaving analysis error:", error);
      res.status(500).json({ error: "Peak shaving analysis failed" });
    }
  });

  // Module C: Standard Kit Recommendation
  app.post("/api/sites/:siteId/kit-recommendation", authMiddleware, requireStaff, async (req, res) => {
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
      console.error("Kit recommendation error:", error);
      res.status(500).json({ error: "Kit recommendation failed" });
    }
  });

  // Get all available standard kits
  app.get("/api/standard-kits", authMiddleware, async (_req, res) => {
    try {
      res.json({
        success: true,
        kits: STANDARD_KITS,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to retrieve standard kits" });
    }
  });

  // Simulation runs - client filtering
  app.get("/api/simulation-runs", authMiddleware, async (req: AuthRequest, res) => {
    try {
      // Client users only see simulations for their sites
      if (req.userRole === "client" && req.userClientId) {
        const sites = await storage.getSitesByClient(req.userClientId);
        const siteIds = sites.map(s => s.id);
        const allRuns = await storage.getSimulationRuns();
        const filteredRuns = allRuns.filter(run => siteIds.includes(run.siteId));
        return res.json(filteredRuns);
      }
      
      const runs = await storage.getSimulationRuns();
      res.json(runs);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/simulation-runs/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const run = await storage.getSimulationRun(req.params.id);
      if (!run) {
        return res.status(404).json({ error: "Simulation not found" });
      }
      
      // Client users can only access simulations for their own sites
      if (req.userRole === "client" && req.userClientId) {
        const site = await storage.getSite(run.siteId);
        if (!site || site.clientId !== req.userClientId) {
          return res.status(403).json({ error: "Access denied" });
        }
      }
      
      res.json(run);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get full simulation run with heavy data (for analysis display)
  app.get("/api/simulation-runs/:id/full", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const run = await storage.getSimulationRunFull(req.params.id);
      if (!run) {
        return res.status(404).json({ error: "Simulation run not found" });
      }
      res.json(run);
    } catch (error) {
      console.error("Error fetching full simulation run:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // PDF Report Generation - Professional multi-page report
  app.get("/api/simulation-runs/:id/report-pdf", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const lang = (req.query.lang as string) === "en" ? "en" : "fr";
      const simulation = await storage.getSimulationRun(req.params.id);
      
      if (!simulation) {
        return res.status(404).json({ error: "Simulation not found" });
      }
      
      // Client users can only download reports for their own sites
      if (req.userRole === "client" && req.userClientId) {
        const site = await storage.getSite(simulation.siteId);
        if (!site || site.clientId !== req.userClientId) {
          return res.status(403).json({ error: "Access denied" });
        }
      }
      
      // Fetch all simulations for this site to include scenario comparison
      const allSimulations = await storage.getSimulationRuns();
      const siteSimulations = allSimulations.filter(s => s.siteId === simulation.siteId);

      const doc = new PDFDocument({ size: "LETTER", margin: 50 });
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="etude-solaire-stockage-${simulation.site.name.replace(/\s+/g, '-')}.pdf"`);
      
      doc.pipe(res);

      // Use the professional PDF generator with all site simulations for comparison
      const { generateProfessionalPDF } = await import("./pdfGenerator");
      generateProfessionalPDF(doc, simulation as any, lang, siteSimulations as any[]);

      doc.end();
    } catch (error) {
      console.error("PDF generation error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Methodology Documentation PDF
  app.get("/api/methodology/pdf", authMiddleware, async (req, res) => {
    try {
      const lang = req.headers["accept-language"]?.includes("en") ? "en" : "fr";
      
      const doc = new PDFDocument({ size: "LETTER", margin: 50 });
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="methodology-${lang}.pdf"`);
      
      doc.pipe(res);

      const { generateMethodologyPDF } = await import("./pdfGenerator");
      generateMethodologyPDF(doc, lang);

      doc.end();
    } catch (error) {
      console.error("Methodology PDF generation error:", error);
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

  // ==================== PRICING ENGINE ROUTES ====================
  
  app.get("/api/designs/:id/pricing", authMiddleware, async (req, res) => {
    try {
      const designId = req.params.id;
      const design = await storage.getDesign(designId);
      if (!design) {
        return res.status(404).json({ error: "Design not found" });
      }
      
      const simulation = await storage.getSimulationRun(design.simulationRunId);
      if (!simulation) {
        return res.status(404).json({ error: "Simulation not found" });
      }
      
      const visits = await storage.getSiteVisits(simulation.siteId);
      const completedVisit = visits.find(v => v.status === "completed") || visits[0] || null;
      
      const pricingBreakdown = calculatePricingFromSiteVisit({
        siteVisit: completedVisit,
        design,
        pvSizeKW: design.pvSizeKW || 0,
        batteryEnergyKWh: design.batteryEnergyKWh || 0,
      });
      
      const visitCompleteness = getSiteVisitCompleteness(completedVisit);
      
      res.json({
        designId,
        siteId: simulation.siteId,
        siteVisitId: completedVisit?.id || null,
        visitCompleteness,
        pricing: pricingBreakdown,
      });
    } catch (error) {
      console.error("Pricing calculation error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  app.get("/api/sites/:siteId/construction-estimate", authMiddleware, async (req, res) => {
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

  // ==================== SITE VISITS ROUTES ====================

  // Get all site visits
  app.get("/api/site-visits", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const visits = await storage.getSiteVisits();
      res.json(visits);
    } catch (error) {
      console.error("Error fetching site visits:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get site visits for a specific site
  app.get("/api/sites/:siteId/visits", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const visits = await storage.getSiteVisitsBySite(req.params.siteId);
      res.json(visits);
    } catch (error) {
      console.error("Error fetching site visits:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get a single site visit
  app.get("/api/site-visits/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const visit = await storage.getSiteVisit(req.params.id);
      if (!visit) {
        return res.status(404).json({ error: "Site visit not found" });
      }
      res.json(visit);
    } catch (error) {
      console.error("Error fetching site visit:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create a new site visit
  app.post("/api/site-visits", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      // Preprocess date fields from string to Date object
      const data = { ...req.body };
      if (data.visitDate && typeof data.visitDate === 'string') {
        data.visitDate = new Date(data.visitDate);
      }
      
      const parsed = insertSiteVisitSchema.safeParse(data);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      
      const visit = await storage.createSiteVisit(parsed.data);
      res.status(201).json(visit);
    } catch (error) {
      console.error("Error creating site visit:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update a site visit
  app.patch("/api/site-visits/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      // Preprocess date fields from string to Date object
      const data = { ...req.body };
      if (data.visitDate && typeof data.visitDate === 'string') {
        data.visitDate = new Date(data.visitDate);
      }
      
      const visit = await storage.updateSiteVisit(req.params.id, data);
      if (!visit) {
        return res.status(404).json({ error: "Site visit not found" });
      }
      res.json(visit);
    } catch (error) {
      console.error("Error updating site visit:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete a site visit
  app.delete("/api/site-visits/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const deleted = await storage.deleteSiteVisit(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Site visit not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting site visit:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Generate PDF report for a site visit
  app.get("/api/site-visits/:id/pdf", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const visit = await storage.getSiteVisit(req.params.id);
      if (!visit) {
        return res.status(404).json({ error: "Site visit not found" });
      }
      
      // Get site info for context
      const site = await storage.getSite(visit.siteId);
      const siteName = site?.name || "Unknown Site";
      const siteAddress = site ? [site.address, site.city, site.province, site.postalCode].filter(Boolean).join(", ") : "";
      
      // Language support: default to French
      const lang = (req.query.lang as string) === "en" ? "en" : "fr";
      
      // Bilingual labels
      const labels = {
        title: lang === "fr" ? "Rapport de visite technique" : "Technical Visit Report",
        siteInfo: lang === "fr" ? "Information du site" : "Site Information",
        siteName: lang === "fr" ? "Nom du site" : "Site Name",
        address: lang === "fr" ? "Adresse" : "Address",
        visitDate: lang === "fr" ? "Date de visite" : "Visit Date",
        visitedBy: lang === "fr" ? "Visité par" : "Visited By",
        status: lang === "fr" ? "Statut" : "Status",
        contact: lang === "fr" ? "Contact sur place" : "Site Contact",
        roofSection: lang === "fr" ? "Information toiture" : "Roof Information",
        roofType: lang === "fr" ? "Type de toit" : "Roof Type",
        roofMaterial: lang === "fr" ? "Matériau" : "Material",
        roofAge: lang === "fr" ? "Âge du toit (années)" : "Roof Age (years)",
        roofSurfaceArea: lang === "fr" ? "Surface (m²)" : "Surface Area (m²)",
        buildingHeight: lang === "fr" ? "Hauteur bâtiment (m)" : "Building Height (m)",
        parapetHeight: lang === "fr" ? "Hauteur parapet (m)" : "Parapet Height (m)",
        roofSlope: lang === "fr" ? "Pente (%)" : "Slope (%)",
        anchoringPossible: lang === "fr" ? "Ancrage possible" : "Anchoring Possible",
        lightningRod: lang === "fr" ? "Paratonnerre présent" : "Lightning Rod Present",
        electricalSection: lang === "fr" ? "Infrastructure électrique" : "Electrical Infrastructure",
        numberOfMeters: lang === "fr" ? "Nombre de compteurs" : "Number of Meters",
        meterNumber: lang === "fr" ? "Numéro de compteur HQ" : "HQ Meter Number",
        mainPanelPower: lang === "fr" ? "Puissance panneau principal" : "Main Panel Power",
        mainPanelVoltage: lang === "fr" ? "Voltage" : "Voltage",
        mainPanel: lang === "fr" ? "Panneau principal" : "Main Panel",
        mainBreaker: lang === "fr" ? "Disjoncteur principal" : "Main Breaker",
        circuitBreaker: lang === "fr" ? "Disjoncteur" : "Circuit Breaker",
        disconnectSwitch: lang === "fr" ? "Sectionneur" : "Disconnect Switch",
        sldMain: lang === "fr" ? "Schéma unifilaire disponible" : "Main SLD Available",
        sldMainNeedsUpdate: lang === "fr" ? "Schéma nécessite mise à jour" : "SLD Needs Update",
        secondaryEquipment: lang === "fr" ? "Équipement secondaire" : "Secondary Equipment",
        secondaryPanel: lang === "fr" ? "Panneau secondaire" : "Secondary Panel",
        secondaryBreaker: lang === "fr" ? "Disjoncteur secondaire" : "Secondary Breaker",
        secondaryDisconnect: lang === "fr" ? "Sectionneur secondaire" : "Secondary Disconnect",
        manufacturer: lang === "fr" ? "Fabricant" : "Manufacturer",
        model: lang === "fr" ? "Modèle" : "Model",
        obstaclesSection: lang === "fr" ? "Obstacles et ombrage" : "Obstacles & Shading",
        hasObstacles: lang === "fr" ? "Obstacles présents" : "Obstacles Present",
        treesPresent: lang === "fr" ? "Arbres présents" : "Trees Present",
        treeNotes: lang === "fr" ? "Notes arbres" : "Tree Notes",
        otherObstacles: lang === "fr" ? "Autres obstacles" : "Other Obstacles",
        adjacentRoofs: lang === "fr" ? "Toits adjacents même niveau" : "Adjacent Roofs Same Level",
        techRoomSection: lang === "fr" ? "Salle technique" : "Technical Room",
        techRoomCovered: lang === "fr" ? "Salle couverte" : "Room Covered",
        techRoomSpace: lang === "fr" ? "Espace disponible" : "Available Space",
        techRoomDistance: lang === "fr" ? "Distance (m)" : "Distance (m)",
        injectionPoint: lang === "fr" ? "Point d'injection" : "Injection Point",
        accessSection: lang === "fr" ? "Accès au toit" : "Roof Access",
        roofAccessible: lang === "fr" ? "Toit accessible" : "Roof Accessible",
        accessMethod: lang === "fr" ? "Méthode d'accès" : "Access Method",
        accessNotes: lang === "fr" ? "Notes d'accès" : "Access Notes",
        documentationSection: lang === "fr" ? "Documentation" : "Documentation",
        photosTaken: lang === "fr" ? "Photos prises" : "Photos Taken",
        documentsCollected: lang === "fr" ? "Documents collectés" : "Documents Collected",
        electricalDrawings: lang === "fr" ? "Dessins électriques" : "Electrical Drawings",
        meterDetails: lang === "fr" ? "Détails compteur" : "Meter Details",
        otherDocs: lang === "fr" ? "Autres" : "Other",
        inspectorSignature: lang === "fr" ? "Signature inspecteur" : "Inspector Signature",
        notes: lang === "fr" ? "Notes" : "Notes",
        generatedAt: lang === "fr" ? "Généré le" : "Generated on",
        yes: lang === "fr" ? "Oui" : "Yes",
        no: lang === "fr" ? "Non" : "No",
        notSpecified: lang === "fr" ? "Non spécifié" : "Not specified",
        statusScheduled: lang === "fr" ? "Planifiée" : "Scheduled",
        statusInProgress: lang === "fr" ? "En cours" : "In Progress",
        statusCompleted: lang === "fr" ? "Complétée" : "Completed",
        statusCancelled: lang === "fr" ? "Annulée" : "Cancelled",
        accessLadder: lang === "fr" ? "Échelle" : "Ladder",
        accessTrapdoor: lang === "fr" ? "Trappe" : "Trapdoor",
        accessStairs: lang === "fr" ? "Escalier" : "Stairs",
        accessLift: lang === "fr" ? "Nacelle / Lift" : "Lift / Cherry picker",
        accessOther: lang === "fr" ? "Autre" : "Other",
        roofFlat: lang === "fr" ? "Plat" : "Flat",
        roofSloped: lang === "fr" ? "Incliné" : "Sloped",
      };
      
      // Helper functions
      const formatBool = (val: boolean | null | undefined) => val ? labels.yes : labels.no;
      const formatVal = (val: any) => val ?? labels.notSpecified;
      const formatStatus = (status: string) => {
        switch (status) {
          case "scheduled": return labels.statusScheduled;
          case "in_progress": return labels.statusInProgress;
          case "completed": return labels.statusCompleted;
          case "cancelled": return labels.statusCancelled;
          default: return status;
        }
      };
      const formatAccessMethod = (method: string | null | undefined) => {
        if (!method) return labels.notSpecified;
        switch (method) {
          case "ladder": return labels.accessLadder;
          case "trapdoor": return labels.accessTrapdoor;
          case "stairs": return labels.accessStairs;
          case "lift": return labels.accessLift;
          case "other": return labels.accessOther;
          default: return method;
        }
      };
      const formatRoofType = (type: string | null | undefined) => {
        if (!type) return labels.notSpecified;
        switch (type) {
          case "flat": return labels.roofFlat;
          case "inclined": return labels.roofSloped;
          default: return type;
        }
      };
      
      // Create PDF document
      const doc = new PDFDocument({ margin: 50, size: "LETTER" });
      
      // Set response headers
      const filename = `site-visit-report-${visit.id.slice(0, 8)}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      
      // Pipe PDF to response
      doc.pipe(res);
      
      // PDF Content
      const primaryColor = "#006633"; // kWh Quebec green
      const headerColor = "#333333";
      const textColor = "#444444";
      
      // Title
      doc.fontSize(22).fillColor(primaryColor).text(labels.title, { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor(textColor).text(`${labels.generatedAt}: ${new Date().toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA")}`, { align: "center" });
      doc.moveDown(1.5);
      
      // Section helper
      const drawSection = (title: string) => {
        doc.moveDown(0.5);
        doc.fontSize(14).fillColor(primaryColor).text(title);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor(primaryColor).stroke();
        doc.moveDown(0.3);
        doc.fontSize(10).fillColor(textColor);
      };
      
      // Row helper
      const drawRow = (label: string, value: any) => {
        doc.font("Helvetica-Bold").text(`${label}: `, { continued: true });
        doc.font("Helvetica").text(String(value ?? labels.notSpecified));
      };
      
      // Site Information
      drawSection(labels.siteInfo);
      drawRow(labels.siteName, siteName);
      drawRow(labels.address, siteAddress || labels.notSpecified);
      if (visit.gpsLatitude != null && visit.gpsLongitude != null) {
        drawRow(lang === "fr" ? "Coordonnées GPS" : "GPS Coordinates", `${visit.gpsLatitude.toFixed(6)}, ${visit.gpsLongitude.toFixed(6)}`);
      }
      drawRow(labels.visitDate, visit.visitDate ? new Date(visit.visitDate).toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA") : labels.notSpecified);
      drawRow(labels.visitedBy, visit.visitedBy);
      drawRow(labels.status, formatStatus(visit.status || "scheduled"));
      if (visit.siteContactName) {
        drawRow(labels.contact, `${visit.siteContactName}${visit.siteContactPhone ? ` - ${visit.siteContactPhone}` : ""}${visit.siteContactEmail ? ` - ${visit.siteContactEmail}` : ""}`);
      }
      if (visit.meterNumbers) {
        drawRow(lang === "fr" ? "Numéros de compteurs" : "Meter Numbers", visit.meterNumbers);
      }
      
      // Roof Information
      drawSection(labels.roofSection);
      drawRow(labels.roofType, formatRoofType(visit.roofType));
      drawRow(labels.roofMaterial, formatVal(visit.roofMaterial));
      drawRow(labels.roofAge, visit.roofAge != null ? visit.roofAge : labels.notSpecified);
      drawRow(labels.roofSurfaceArea, visit.roofSurfaceAreaSqM != null ? visit.roofSurfaceAreaSqM : labels.notSpecified);
      drawRow(labels.buildingHeight, visit.buildingHeight != null ? visit.buildingHeight : labels.notSpecified);
      drawRow(labels.parapetHeight, visit.parapetHeight != null ? visit.parapetHeight : labels.notSpecified);
      drawRow(labels.roofSlope, visit.roofSlope != null ? visit.roofSlope : labels.notSpecified);
      drawRow(labels.anchoringPossible, formatBool(visit.anchoringPossible));
      if (visit.anchoringNotes) drawRow(labels.notes, visit.anchoringNotes);
      drawRow(labels.lightningRod, formatBool(visit.lightningRodPresent));
      
      // Electrical Infrastructure
      drawSection(labels.electricalSection);
      drawRow(labels.numberOfMeters, visit.numberOfMeters != null ? visit.numberOfMeters : labels.notSpecified);
      drawRow(labels.meterNumber, formatVal(visit.hqMeterNumber));
      drawRow(labels.mainPanelPower, formatVal(visit.mainPanelPower));
      drawRow(labels.mainPanelVoltage, formatVal(visit.mainPanelVoltage));
      drawRow(labels.sldMain, formatBool(visit.sldMainAvailable));
      drawRow(labels.sldMainNeedsUpdate, formatBool(visit.sldMainNeedsUpdate));
      
      // Main panel/breaker info
      if (visit.mainPanelManufacturer || visit.mainPanelModel) {
        doc.moveDown(0.3);
        doc.font("Helvetica-Bold").text(`${labels.mainPanel}:`);
        doc.font("Helvetica").text(`  ${labels.manufacturer}: ${formatVal(visit.mainPanelManufacturer)}`);
        doc.text(`  ${labels.model}: ${formatVal(visit.mainPanelModel)}`);
      }
      if (visit.mainBreakerManufacturer || visit.mainBreakerModel) {
        doc.font("Helvetica-Bold").text(`${labels.mainBreaker}:`);
        doc.font("Helvetica").text(`  ${labels.manufacturer}: ${formatVal(visit.mainBreakerManufacturer)}`);
        doc.text(`  ${labels.model}: ${formatVal(visit.mainBreakerModel)}`);
      }
      if (visit.circuitBreakerManufacturer || visit.circuitBreakerModel) {
        doc.font("Helvetica-Bold").text(`${labels.circuitBreaker}:`);
        doc.font("Helvetica").text(`  ${labels.manufacturer}: ${formatVal(visit.circuitBreakerManufacturer)}`);
        doc.text(`  ${labels.model}: ${formatVal(visit.circuitBreakerModel)}`);
      }
      if (visit.disconnectSwitchManufacturer || visit.disconnectSwitchModel) {
        doc.font("Helvetica-Bold").text(`${labels.disconnectSwitch}:`);
        doc.font("Helvetica").text(`  ${labels.manufacturer}: ${formatVal(visit.disconnectSwitchManufacturer)}`);
        doc.text(`  ${labels.model}: ${formatVal(visit.disconnectSwitchModel)}`);
      }
      
      // Secondary equipment
      const hasSecondary = visit.secondaryPanelManufacturer || visit.secondaryPanelModel || 
                          visit.secondaryBreakerManufacturer || visit.secondaryBreakerModel ||
                          visit.secondaryDisconnectManufacturer || visit.secondaryDisconnectModel;
      if (hasSecondary) {
        doc.moveDown(0.3);
        doc.font("Helvetica-Bold").text(labels.secondaryEquipment);
        if (visit.secondaryPanelManufacturer || visit.secondaryPanelModel) {
          doc.font("Helvetica").text(`  ${labels.secondaryPanel}: ${formatVal(visit.secondaryPanelManufacturer)} / ${formatVal(visit.secondaryPanelModel)}`);
        }
        if (visit.secondaryBreakerManufacturer || visit.secondaryBreakerModel) {
          doc.text(`  ${labels.secondaryBreaker}: ${formatVal(visit.secondaryBreakerManufacturer)} / ${formatVal(visit.secondaryBreakerModel)}`);
        }
        if (visit.secondaryDisconnectManufacturer || visit.secondaryDisconnectModel) {
          doc.text(`  ${labels.secondaryDisconnect}: ${formatVal(visit.secondaryDisconnectManufacturer)} / ${formatVal(visit.secondaryDisconnectModel)}`);
        }
      }
      if (visit.secondaryEquipmentNotes) {
        drawRow(labels.notes, visit.secondaryEquipmentNotes);
      }
      
      // Obstacles & Shading
      drawSection(labels.obstaclesSection);
      drawRow(labels.hasObstacles, formatBool(visit.hasObstacles));
      drawRow(labels.treesPresent, formatBool(visit.treesPresent));
      if (visit.treeNotes) drawRow(labels.treeNotes, visit.treeNotes);
      if (visit.otherObstacles) drawRow(labels.otherObstacles, visit.otherObstacles);
      drawRow(labels.adjacentRoofs, formatBool(visit.adjacentRoofsSameLevel));
      
      // Technical Room
      drawSection(labels.techRoomSection);
      drawRow(labels.techRoomCovered, formatBool(visit.technicalRoomCovered));
      drawRow(labels.techRoomSpace, formatVal(visit.technicalRoomSpace));
      drawRow(labels.techRoomDistance, visit.technicalRoomDistance != null ? visit.technicalRoomDistance : labels.notSpecified);
      drawRow(labels.injectionPoint, formatVal(visit.injectionPointPosition));
      
      // Roof Access
      drawSection(labels.accessSection);
      drawRow(labels.roofAccessible, formatBool(visit.roofAccessible));
      drawRow(labels.accessMethod, formatAccessMethod(visit.accessMethod));
      if (visit.accessNotes) drawRow(labels.accessNotes, visit.accessNotes);
      
      // Documentation
      drawSection(labels.documentationSection);
      drawRow(labels.photosTaken, formatBool(visit.photosTaken));
      
      const docs = visit.documentsCollected as { electricalDrawings?: boolean; meterDetails?: boolean; other?: string } | null;
      if (docs) {
        drawRow(labels.electricalDrawings, formatBool(docs.electricalDrawings));
        drawRow(labels.meterDetails, formatBool(docs.meterDetails));
        if (docs.other) drawRow(labels.otherDocs, docs.other);
      }
      
      if (visit.inspectorSignature) {
        doc.moveDown(0.5);
        drawRow(labels.inspectorSignature, visit.inspectorSignature);
      }
      
      // General Notes
      if (visit.notes) {
        drawSection(labels.notes);
        doc.font("Helvetica").text(visit.notes);
      }
      
      // Cost Breakdown
      const cost = visit.estimatedCost as { travel?: number; visit?: number; evaluation?: number; diagrams?: number; sldSupplement?: number; total?: number } | null;
      if (cost && cost.total) {
        drawSection(lang === "fr" ? "Estimation des coûts" : "Cost Estimate");
        const formatCurrency = (val: number) => new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(val);
        if (cost.travel) drawRow(lang === "fr" ? "Frais de déplacement" : "Travel Cost", formatCurrency(cost.travel));
        if (cost.visit) drawRow(lang === "fr" ? "Visite sur site" : "Site Visit", formatCurrency(cost.visit));
        if (cost.evaluation) drawRow(lang === "fr" ? "Évaluation technique" : "Technical Evaluation", formatCurrency(cost.evaluation));
        if (cost.diagrams) drawRow(lang === "fr" ? "Dessins techniques" : "Technical Drawings", formatCurrency(cost.diagrams));
        if (cost.sldSupplement) drawRow(lang === "fr" ? "Supplément schéma" : "SLD Supplement", formatCurrency(cost.sldSupplement));
        doc.moveDown(0.3);
        doc.font("Helvetica-Bold").text(`Total: ${formatCurrency(cost.total)}`);
      }
      
      // Footer
      doc.moveDown(2);
      doc.fontSize(8).fillColor("#888888").text("kWh Québec - Solar & Storage Solutions", { align: "center" });
      
      // Finalize PDF
      doc.end();
      
    } catch (error) {
      console.error("Error generating site visit PDF:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Calculate estimated cost for a site visit
  app.post("/api/site-visits/calculate-cost", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const { travelDays, buildingCount, includeSld } = req.body;
      
      // Rematek pricing structure
      const TRAVEL_COST_PER_DAY = 150;
      const VISIT_COST_PER_BUILDING = 600;
      const EVALUATION_COST_PER_BUILDING = 1000;
      const DIAGRAMS_COST_PER_BUILDING = 1900;
      const SLD_SUPPLEMENT = 100;
      
      const buildings = buildingCount || 1;
      const travel = travelDays || 0;
      
      const breakdown = {
        travel: travel * TRAVEL_COST_PER_DAY,
        visit: buildings * VISIT_COST_PER_BUILDING,
        evaluation: buildings * EVALUATION_COST_PER_BUILDING,
        diagrams: buildings * DIAGRAMS_COST_PER_BUILDING,
        sldSupplement: includeSld ? buildings * SLD_SUPPLEMENT : 0,
      };
      
      const total = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
      
      res.json({
        breakdown,
        total,
        currency: "CAD",
      });
    } catch (error) {
      console.error("Error calculating site visit cost:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Upload photos for site visit
  app.post("/api/site-visits/photos", authMiddleware, requireStaff, upload.single("photo"), async (req: AuthRequest, res) => {
    try {
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ error: "No photo file provided" });
      }
      
      // Validate allowed categories
      const allowedCategories = ["roof", "electrical", "meters", "obstacles", "general"];
      const category = allowedCategories.includes(req.body.category) ? req.body.category : "general";
      
      // Sanitize filename - remove path components and special characters
      const sanitizedFilename = file.originalname
        .replace(/[\/\\]/g, "_")
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .substring(0, 255);
      
      // Prepare and validate photo data using schema
      const photoData = {
        siteId: req.body.siteId,
        visitId: req.body.visitId || null,
        category,
        filename: sanitizedFilename,
        filepath: file.path,
        mimetype: file.mimetype || null,
        sizeBytes: file.size || null,
        caption: req.body.caption?.substring(0, 500) || null,
        latitude: req.body.latitude ? parseFloat(req.body.latitude) : null,
        longitude: req.body.longitude ? parseFloat(req.body.longitude) : null,
        uploadedBy: req.userId || null,
      };
      
      // Validate using Zod schema
      const validationResult = insertSiteVisitPhotoSchema.safeParse(photoData);
      if (!validationResult.success) {
        // Clean up uploaded file on validation failure
        fs.unlink(file.path, () => {});
        return res.status(400).json({ 
          error: "Invalid photo data", 
          details: validationResult.error.format() 
        });
      }
      
      // Save photo metadata to database
      const photo = await storage.createSiteVisitPhoto(validationResult.data);
      
      res.json({
        success: true,
        photo: {
          id: photo.id,
          category: photo.category,
          filename: photo.filename,
          filepath: photo.filepath,
          uploadedAt: photo.uploadedAt,
        },
      });
    } catch (error) {
      console.error("Error uploading photo:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Get photos for a site
  app.get("/api/sites/:siteId/photos", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const siteId = req.params.siteId;
      const photos = await storage.getSiteVisitPhotos(siteId);
      res.json(photos);
    } catch (error) {
      console.error("Error fetching photos:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Get photos for a specific site visit
  app.get("/api/site-visits/:visitId/photos", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const visitId = req.params.visitId;
      const photos = await storage.getSiteVisitPhotosByVisit(visitId);
      res.json(photos);
    } catch (error) {
      console.error("Error fetching visit photos:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Delete a photo
  app.delete("/api/site-visits/photos/:photoId", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const photoId = req.params.photoId;
      const deleted = await storage.deleteSiteVisitPhoto(photoId);
      if (!deleted) {
        return res.status(404).json({ error: "Photo not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting photo:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== DESIGN AGREEMENTS (Étape 3) ====================
  
  // Get all design agreements
  app.get("/api/design-agreements", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const agreements = await storage.getDesignAgreements();
      res.json(agreements);
    } catch (error) {
      console.error("Error fetching design agreements:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get design agreement by site
  app.get("/api/sites/:siteId/design-agreement", authMiddleware, async (req: AuthRequest, res) => {
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

  // Get single design agreement
  app.get("/api/design-agreements/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const agreement = await storage.getDesignAgreement(req.params.id);
      if (!agreement) {
        return res.status(404).json({ error: "Design agreement not found" });
      }
      res.json(agreement);
    } catch (error) {
      console.error("Error fetching design agreement:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create design agreement
  app.post("/api/design-agreements", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      // Preprocess date fields
      const data = { ...req.body };
      if (data.validUntil && typeof data.validUntil === 'string') {
        data.validUntil = new Date(data.validUntil);
      }
      if (data.quotedAt && typeof data.quotedAt === 'string') {
        data.quotedAt = new Date(data.quotedAt);
      }
      
      // Set quotedBy from current user
      data.quotedBy = req.userId;
      data.quotedAt = new Date();
      
      const parsed = insertDesignAgreementSchema.safeParse(data);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      
      const agreement = await storage.createDesignAgreement(parsed.data);
      res.status(201).json(agreement);
    } catch (error) {
      console.error("Error creating design agreement:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update design agreement
  app.patch("/api/design-agreements/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      // Preprocess date fields
      const data = { ...req.body };
      if (data.validUntil && typeof data.validUntil === 'string') {
        data.validUntil = new Date(data.validUntil);
      }
      if (data.sentAt && typeof data.sentAt === 'string') {
        data.sentAt = new Date(data.sentAt);
      }
      if (data.acceptedAt && typeof data.acceptedAt === 'string') {
        data.acceptedAt = new Date(data.acceptedAt);
      }
      if (data.declinedAt && typeof data.declinedAt === 'string') {
        data.declinedAt = new Date(data.declinedAt);
      }
      
      const agreement = await storage.updateDesignAgreement(req.params.id, data);
      if (!agreement) {
        return res.status(404).json({ error: "Design agreement not found" });
      }
      res.json(agreement);
    } catch (error) {
      console.error("Error updating design agreement:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete design agreement
  app.delete("/api/design-agreements/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const deleted = await storage.deleteDesignAgreement(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Design agreement not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting design agreement:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Generate design agreement from site visit
  app.post("/api/sites/:siteId/generate-design-agreement", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const { siteId } = req.params;
      const { siteVisitId, additionalFees = [], paymentTerms, pricingConfig } = req.body;
      
      // Get the site visit for cost data (legacy support)
      const visit = siteVisitId ? await storage.getSiteVisit(siteVisitId) : null;
      const siteVisitCost = visit?.estimatedCost || null;
      
      let subtotal: number;
      let gst: number;
      let qst: number;
      let total: number;
      let quotedCosts: any;
      
      if (pricingConfig) {
        // New pricing configuration system
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
        // Legacy: Calculate from site visit cost
        const additionalTotal = Array.isArray(additionalFees) 
          ? additionalFees.reduce((sum: number, fee: { amount: number }) => sum + (fee.amount || 0), 0) 
          : 0;
        const siteVisitTotal = (siteVisitCost as any)?.total || 0;
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
      
      // Set validity (30 days from now)
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

  // Generate Design Agreement PDF
  app.get("/api/design-agreements/:id/pdf", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const lang = (req.query.lang as string) === "en" ? "en" : "fr";
      const agreement = await storage.getDesignAgreement(req.params.id);
      
      if (!agreement) {
        return res.status(404).json({ error: "Design agreement not found" });
      }
      
      // Get site and client data for the PDF
      const site = await storage.getSite(agreement.siteId);
      if (!site) {
        return res.status(404).json({ error: "Site not found" });
      }
      
      const client = await storage.getClient(site.clientId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      const doc = new PDFDocument({ size: "LETTER", margin: 50 });
      
      const siteName = site.name.replace(/\s+/g, "-").toLowerCase();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="entente-design-${siteName}.pdf"`);
      
      doc.pipe(res);
      
      const { generateDesignAgreementPDF } = await import("./pdfGenerator");
      
      // Ensure quotedCosts has proper defaults for PDF generation
      const quotedCosts = (agreement.quotedCosts as any) || {
        siteVisit: { travel: 0, visit: 0, evaluation: 0, diagrams: 0, sldSupplement: 0, total: 0 },
        subtotal: 0,
        taxes: { gst: 0, qst: 0 },
        total: 0,
      };
      
      generateDesignAgreementPDF(doc, {
        id: agreement.id,
        site: {
          name: site.name,
          address: site.address || undefined,
          city: site.city || undefined,
          province: site.province || undefined,
          postalCode: site.postalCode || undefined,
          client: {
            name: client.name,
            email: client.email || undefined,
            phone: client.phone || undefined,
          },
        },
        quotedCosts,
        totalCad: agreement.totalCad || 0,
        paymentTerms: agreement.paymentTerms || undefined,
        validUntil: agreement.validUntil,
        createdAt: agreement.createdAt,
      }, lang);
      
      doc.end();
    } catch (error) {
      console.error("Design agreement PDF generation error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Send Design Agreement by Email
  app.post("/api/design-agreements/:id/send-email", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { recipientEmail, recipientName, subject, body, language = "fr" } = req.body;
      
      if (!recipientEmail || !subject) {
        return res.status(400).json({ error: "Recipient email and subject are required" });
      }
      
      const agreement = await storage.getDesignAgreement(id);
      if (!agreement) {
        return res.status(404).json({ error: "Design agreement not found" });
      }
      
      // Get site and client data for the PDF
      const site = await storage.getSite(agreement.siteId);
      if (!site) {
        return res.status(404).json({ error: "Site not found" });
      }
      
      const client = await storage.getClient(site.clientId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      // Generate PDF in memory
      const PDFDocumentForEmail = (await import("pdfkit")).default;
      const doc = new PDFDocumentForEmail({ size: "LETTER", margin: 50 });
      const pdfChunks: Buffer[] = [];
      
      doc.on('data', (chunk: Buffer) => pdfChunks.push(chunk));
      
      const pdfPromise = new Promise<Buffer>((resolve, reject) => {
        doc.on('end', () => resolve(Buffer.concat(pdfChunks)));
        doc.on('error', reject);
      });
      
      const { generateDesignAgreementPDF } = await import("./pdfGenerator");
      
      const quotedCosts = (agreement.quotedCosts as any) || {
        siteVisit: { travel: 0, visit: 0, evaluation: 0, diagrams: 0, sldSupplement: 0, total: 0 },
        subtotal: 0,
        taxes: { gst: 0, qst: 0 },
        total: 0,
      };
      
      generateDesignAgreementPDF(doc, {
        id: agreement.id,
        site: {
          name: site.name,
          address: site.address || undefined,
          city: site.city || undefined,
          province: site.province || undefined,
          postalCode: site.postalCode || undefined,
          client: {
            name: client.name,
            email: client.email || undefined,
            phone: client.phone || undefined,
          },
        },
        quotedCosts,
        totalCad: agreement.totalCad || 0,
        paymentTerms: agreement.paymentTerms || undefined,
        validUntil: agreement.validUntil,
        createdAt: agreement.createdAt,
      }, language);
      
      doc.end();
      
      const pdfBuffer = await pdfPromise;
      
      // Build signing link
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const signingLink = agreement.publicToken ? `${baseUrl}/sign/${agreement.publicToken}` : null;
      
      // Build email body with signing link if available
      let htmlBody = body;
      if (signingLink) {
        const linkText = language === "fr" 
          ? `<p><strong>Pour signer l'entente en ligne :</strong> <a href="${signingLink}">${signingLink}</a></p>`
          : `<p><strong>To sign the agreement online:</strong> <a href="${signingLink}">${signingLink}</a></p>`;
        htmlBody = `${body}${linkText}`;
      }
      
      // Send email with PDF attachment
      const emailResult = await sendEmail({
        to: recipientEmail,
        subject: subject,
        htmlBody: htmlBody,
        textBody: body.replace(/<[^>]*>/g, ''), // Strip HTML for text version
        attachments: [{
          filename: `entente-design-${site.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
          content: pdfBuffer.toString('base64'),
          type: 'application/pdf',
        }],
      });
      
      if (!emailResult.success) {
        // Log failed email attempt
        await storage.createEmailLog({
          siteId: agreement.siteId,
          designAgreementId: agreement.id,
          recipientEmail,
          recipientName: recipientName || null,
          subject,
          emailType: "design_agreement",
          sentByUserId: req.userId,
          customMessage: body,
        });
        await storage.updateEmailLog(
          (await storage.getEmailLogs({ designAgreementId: agreement.id }))[0]?.id || '',
          { status: "failed", errorMessage: emailResult.error }
        );
        
        return res.status(500).json({ error: "Failed to send email", details: emailResult.error });
      }
      
      // Log successful email
      const emailLog = await storage.createEmailLog({
        siteId: agreement.siteId,
        designAgreementId: agreement.id,
        recipientEmail,
        recipientName: recipientName || null,
        subject,
        emailType: "design_agreement",
        sentByUserId: req.userId,
        customMessage: body,
      });
      
      // Update agreement status to "sent" if it was draft
      if (agreement.status === "draft") {
        await storage.updateDesignAgreement(id, { 
          status: "sent", 
          sentAt: new Date() 
        });
      }
      
      console.log(`[Design Agreement] Email sent to ${recipientEmail} for agreement ${id}`);
      
      res.json({ 
        success: true, 
        emailLogId: emailLog.id,
        message: language === "fr" 
          ? "Courriel envoyé avec succès" 
          : "Email sent successfully"
      });
    } catch (error) {
      console.error("Error sending design agreement email:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get email logs for a design agreement
  app.get("/api/design-agreements/:id/email-logs", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const logs = await storage.getEmailLogs({ designAgreementId: id });
      res.json(logs);
    } catch (error) {
      console.error("Error fetching email logs:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== PUBLIC AGREEMENT ROUTES (no auth required) ====================

  // Get public agreement by token (for client signing page)
  app.get("/api/public/agreements/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      // Find agreement by public token
      const agreements = await storage.getDesignAgreements();
      const agreement = agreements.find(a => a.publicToken === token);
      
      if (!agreement) {
        return res.status(404).json({ error: "Agreement not found" });
      }
      
      // Get site and client data
      const site = await storage.getSite(agreement.siteId);
      if (!site) {
        return res.status(404).json({ error: "Site not found" });
      }
      
      const client = await storage.getClient(site.clientId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      // Return public-safe data (no internal notes, etc.)
      res.json({
        id: agreement.id,
        status: agreement.status,
        validUntil: agreement.validUntil,
        quotedCosts: agreement.quotedCosts,
        totalCad: agreement.totalCad,
        paymentTerms: agreement.paymentTerms,
        acceptedAt: agreement.acceptedAt,
        acceptedByName: agreement.acceptedByName,
        site: {
          name: site.name,
          address: site.address,
          city: site.city,
          province: site.province,
        },
        client: {
          name: client.name,
          email: client.email,
        },
      });
    } catch (error) {
      console.error("Error fetching public agreement:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Sign agreement (public endpoint)
  app.post("/api/public/agreements/:token/sign", async (req, res) => {
    try {
      const { token } = req.params;
      const { name, email, signatureData } = req.body;
      
      if (!name || !email || !signatureData) {
        return res.status(400).json({ error: "Name, email, and signature are required" });
      }
      
      // Find agreement by public token
      const agreements = await storage.getDesignAgreements();
      const agreement = agreements.find(a => a.publicToken === token);
      
      if (!agreement) {
        return res.status(404).json({ error: "Agreement not found" });
      }
      
      // Check if already signed
      if (agreement.status === "accepted") {
        return res.status(400).json({ error: "Agreement already signed" });
      }
      
      // Check if expired
      if (agreement.validUntil && new Date(agreement.validUntil) < new Date()) {
        return res.status(400).json({ error: "Agreement has expired" });
      }
      
      // Update agreement with signature
      const updated = await storage.updateDesignAgreement(agreement.id, {
        status: "accepted",
        acceptedAt: new Date(),
        acceptedByName: name,
        acceptedByEmail: email,
        signatureData: signatureData,
      });
      
      res.json({ success: true, agreement: updated });
    } catch (error) {
      console.error("Error signing agreement:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create Stripe checkout session for deposit payment (public endpoint)
  app.post("/api/public/agreements/:token/create-checkout", async (req, res) => {
    try {
      const { token } = req.params;
      const { name, email, signatureData, language = "fr" } = req.body;
      
      if (!name || !email || !signatureData) {
        return res.status(400).json({ error: "Name, email, and signature are required" });
      }
      
      // Find agreement by public token
      const agreements = await storage.getDesignAgreements();
      const agreement = agreements.find(a => a.publicToken === token);
      
      if (!agreement) {
        return res.status(404).json({ error: "Agreement not found" });
      }
      
      // Check if already signed
      if (agreement.status === "accepted") {
        return res.status(400).json({ error: "Agreement already signed" });
      }
      
      // Check if expired
      if (agreement.validUntil && new Date(agreement.validUntil) < new Date()) {
        return res.status(400).json({ error: "Agreement has expired" });
      }

      // Get site and client info for checkout
      const site = await storage.getSite(agreement.siteId);
      if (!site) {
        return res.status(404).json({ error: "Site not found" });
      }
      
      const client = await storage.getClient(site.clientId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      // Calculate deposit amount (50% of total)
      const totalAmount = agreement.totalCad || 0;
      const depositAmount = Math.round(totalAmount * 0.5 * 100); // Convert to cents
      
      if (depositAmount <= 0) {
        return res.status(400).json({ error: "Invalid deposit amount" });
      }

      // Create Stripe checkout session
      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();
      
      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
      
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'cad',
            unit_amount: depositAmount,
            product_data: {
              name: language === "fr" 
                ? `Dépôt - Entente de design: ${site.name}`
                : `Deposit - Design Agreement: ${site.name}`,
              description: language === "fr"
                ? `Dépôt 50% pour les services de conception technique - ${client.name}`
                : `50% deposit for technical design services - ${client.name}`,
            },
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${baseUrl}/sign/${token}?payment=success`,
        cancel_url: `${baseUrl}/sign/${token}?payment=cancelled`,
        customer_email: email,
        metadata: {
          agreementId: agreement.id,
          agreementToken: token,
          signerName: name,
          signerEmail: email,
          siteId: agreement.siteId,
          clientId: site.clientId,
        },
        locale: language === "fr" ? "fr-CA" : "en",
      });

      // Save signature data and mark as pending payment
      await storage.updateDesignAgreement(agreement.id, {
        acceptedByName: name,
        acceptedByEmail: email,
        signatureData: signatureData,
        stripeSessionId: session.id,
      });

      res.json({ 
        success: true, 
        checkoutUrl: session.url,
        sessionId: session.id,
      });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Handle successful payment (callback from Stripe webhook or success URL)
  app.post("/api/public/agreements/:token/confirm-payment", async (req, res) => {
    try {
      const { token } = req.params;
      const { sessionId } = req.body;
      
      // Find agreement by public token
      const agreements = await storage.getDesignAgreements();
      const agreement = agreements.find(a => a.publicToken === token);
      
      if (!agreement) {
        return res.status(404).json({ error: "Agreement not found" });
      }

      // Verify payment with Stripe
      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();
      
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      
      if (session.payment_status !== 'paid') {
        return res.status(400).json({ error: "Payment not completed" });
      }

      // Update agreement with payment confirmation
      const depositAmount = (session.amount_total || 0) / 100; // Convert from cents
      
      const updated = await storage.updateDesignAgreement(agreement.id, {
        status: "accepted",
        acceptedAt: new Date(),
        depositAmount: depositAmount,
        depositPaidAt: new Date(),
        stripePaymentIntentId: session.payment_intent as string,
      });

      res.json({ success: true, agreement: updated });
    } catch (error) {
      console.error("Error confirming payment:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get Stripe publishable key (public endpoint)
  app.get("/api/public/stripe-key", async (req, res) => {
    try {
      const { getStripePublishableKey } = await import("./stripeClient");
      const key = await getStripePublishableKey();
      res.json({ publishableKey: key });
    } catch (error) {
      console.error("Error getting Stripe key:", error);
      res.status(500).json({ error: "Stripe not configured" });
    }
  });

  // ==================== PORTFOLIO ROUTES ====================

  // Get all portfolios
  app.get("/api/portfolios", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const portfolios = await storage.getPortfolios();
      res.json(portfolios);
    } catch (error) {
      console.error("Error fetching portfolios:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get portfolios for a specific client
  app.get("/api/clients/:clientId/portfolios", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      
      // Check access for client users
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

  // Get single portfolio with sites
  app.get("/api/portfolios/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const portfolio = await storage.getPortfolio(req.params.id);
      
      if (!portfolio) {
        return res.status(404).json({ error: "Portfolio not found" });
      }
      
      // Check access for client users
      if (req.userRole === "client" && req.userClientId !== portfolio.clientId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      res.json(portfolio);
    } catch (error) {
      console.error("Error fetching portfolio:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get portfolio sites with details (including simulations)
  app.get("/api/portfolios/:id/sites", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const portfolio = await storage.getPortfolio(req.params.id);
      
      if (!portfolio) {
        return res.status(404).json({ error: "Portfolio not found" });
      }
      
      // Check access for client users
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

  // OPTIMIZED: Get portfolio with sites and pre-calculated KPIs in single request
  app.get("/api/portfolios/:id/full", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const portfolio = await storage.getPortfolio(req.params.id);
      
      if (!portfolio) {
        return res.status(404).json({ error: "Portfolio not found" });
      }
      
      // Check access for client users
      if (req.userRole === "client" && req.userClientId !== portfolio.clientId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Fetch sites in same request
      const portfolioSites = await storage.getPortfolioSites(req.params.id);
      
      // Pre-calculate aggregated KPIs server-side, using override values when present
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
        
        // Use override values if set, otherwise fall back to simulation values
        const pvSize = ps.overridePvSizeKW ?? results?.pvSizeKW ?? results?.optimalPvSizeKW ?? 0;
        const batterySize = ps.overrideBatteryKWh ?? results?.batteryCapacityKWh ?? results?.optimalBatteryKWh ?? 0;
        const netCapex = ps.overrideCapexNet ?? results?.netCapex ?? 0;
        const npv = ps.overrideNpv ?? results?.npv ?? 0;
        const irr = ps.overrideIrr ?? results?.irr ?? 0;
        const annualSavings = ps.overrideAnnualSavings ?? results?.annualSavings ?? results?.firstYearSavings ?? 0;
        const co2 = results?.co2AvoidedTonnes ?? results?.annualCo2Avoided ?? 0;
        
        // Track if site has data from either source
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

      // Volume pricing calculation
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

  // Create new portfolio
  app.post("/api/portfolios", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const parsed = insertPortfolioSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      
      const portfolio = await storage.createPortfolio({
        ...parsed.data,
        createdBy: req.userId,
      });
      
      // Auto-create Prospect opportunity for new portfolio (with idempotency check)
      try {
        // Check if an opportunity already exists for this client with portfolio tags
        // This prevents duplicates from retries/double-submits
        const existingClientOpps = await storage.getOpportunitiesByClientId(portfolio.clientId);
        const hasPortfolioOpp = existingClientOpps.some(opp => 
          opp.sourceDetails?.includes(`portfolio: ${portfolio.id}`)
        );
        
        if (!hasPortfolioOpp) {
          await storage.createOpportunity({
            name: `${portfolio.name} - Multi-Site Solar Project`,
            description: `Portfolio opportunity auto-created for: ${portfolio.name}`,
            clientId: portfolio.clientId,
            siteId: null, // No single site, it's a portfolio-level opportunity
            stage: "prospect",
            probability: 5, // Prospect stage = 5%
            estimatedValue: null, // Will be updated after analysis
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
        // Don't fail the portfolio creation if opportunity creation fails
      }
      
      res.status(201).json(portfolio);
    } catch (error) {
      console.error("Error creating portfolio:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update portfolio
  app.patch("/api/portfolios/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
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

  // Delete portfolio
  app.delete("/api/portfolios/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
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

  // Add site(s) to portfolio - supports single siteId or array of siteIds
  app.post("/api/portfolios/:id/sites", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const { siteId, siteIds, notes, displayOrder } = req.body;
      
      // Support both single siteId and array of siteIds
      const sitesToAdd: string[] = siteIds ? siteIds : (siteId ? [siteId] : []);
      
      if (sitesToAdd.length === 0) {
        return res.status(400).json({ error: "siteId or siteIds is required" });
      }
      
      // Verify portfolio exists
      const portfolio = await storage.getPortfolio(req.params.id);
      if (!portfolio) {
        return res.status(404).json({ error: "Portfolio not found" });
      }
      
      // Get existing sites in portfolio to prevent duplicates
      const existingPortfolioSites = await storage.getPortfolioSites(req.params.id);
      const existingSiteIds = existingPortfolioSites.map(ps => ps.siteId);
      
      const addedSites = [];
      const skippedDuplicates = [];
      
      for (const id of sitesToAdd) {
        // Check for duplicates
        if (existingSiteIds.includes(id)) {
          skippedDuplicates.push(id);
          continue;
        }
        
        // Verify site exists and belongs to same client
        const site = await storage.getSite(id);
        if (!site) {
          continue; // Skip non-existent sites
        }
        
        if (site.clientId !== portfolio.clientId) {
          continue; // Skip sites from different clients
        }
        
        const portfolioSite = await storage.addSiteToPortfolio({
          portfolioId: req.params.id,
          siteId: id,
          notes: notes || null,
          displayOrder: displayOrder || addedSites.length,
        });
        
        addedSites.push(portfolioSite);
        existingSiteIds.push(id); // Prevent duplicates within same request
      }
      
      // Update portfolio site count
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

  // Remove site from portfolio
  app.delete("/api/portfolios/:portfolioId/sites/:siteId", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const { portfolioId, siteId } = req.params;
      
      const removed = await storage.removeSiteFromPortfolio(portfolioId, siteId);
      
      if (!removed) {
        return res.status(404).json({ error: "Site not found in portfolio" });
      }
      
      // Update portfolio site count
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

  // Update portfolio site overrides (for externally analyzed sites)
  app.patch("/api/portfolio-sites/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
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

  // Generate Portfolio PDF Summary
  app.get("/api/portfolios/:id/pdf", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const lang = (req.query.lang as string) === "en" ? "en" : "fr";
      const portfolio = await storage.getPortfolio(req.params.id);
      
      if (!portfolio) {
        return res.status(404).json({ error: "Portfolio not found" });
      }
      
      // Check access for client users
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
      
      const { generatePortfolioSummaryPDF } = await import("./pdfGenerator");
      
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

  // Calculate and update portfolio summary KPIs
  app.post("/api/portfolios/:id/recalculate", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const portfolio = await storage.getPortfolio(req.params.id);
      if (!portfolio) {
        return res.status(404).json({ error: "Portfolio not found" });
      }
      
      const portfolioSites = await storage.getPortfolioSites(req.params.id);
      
      // Aggregate KPIs from all sites' latest simulations OR override values
      let totalPvSizeKW = 0;
      let totalBatteryKWh = 0;
      let totalCapexNet = 0;
      let totalNpv25 = 0;
      let totalAnnualSavings = 0;
      let totalCo2Avoided = 0;
      let totalCapexGross = 0; // For weighted IRR calculation
      let weightedIrrSum = 0;
      
      for (const ps of portfolioSites) {
        // Use override values if set, otherwise fall back to simulation values
        const pvSize = ps.overridePvSizeKW ?? ps.latestSimulation?.pvSizeKW ?? 0;
        const battKWh = ps.overrideBatteryKWh ?? ps.latestSimulation?.battEnergyKWh ?? 0;
        const capexNet = ps.overrideCapexNet ?? ps.latestSimulation?.capexNet ?? 0;
        const npv = ps.overrideNpv ?? ps.latestSimulation?.npv25 ?? 0;
        const irr = ps.overrideIrr ?? ps.latestSimulation?.irr25 ?? 0;
        const annualSavings = ps.overrideAnnualSavings ?? ps.latestSimulation?.annualSavings ?? 0;
        const co2 = ps.latestSimulation?.co2AvoidedTonnesPerYear ?? 0; // No override for CO2
        
        // Only aggregate if at least one value is present (from either override or simulation)
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
          
          // For weighted IRR: weight by capex (use capex net as proxy if no gross available)
          const capex = ps.latestSimulation?.capexGross || capexNet || 0;
          if (capex > 0 && irr !== 0) {
            totalCapexGross += capex;
            weightedIrrSum += irr * capex;
          }
        }
      }
      
      const weightedIrr25 = totalCapexGross > 0 ? weightedIrrSum / totalCapexGross : null;
      
      // Calculate volume discount based on number of buildings (Rematek pricing)
      let volumeDiscountPercent = 0;
      const numBuildings = portfolioSites.length;
      if (numBuildings >= 20) {
        volumeDiscountPercent = 0.15; // 15% discount for 20+ buildings
      } else if (numBuildings >= 10) {
        volumeDiscountPercent = 0.10; // 10% discount for 10-19 buildings
      } else if (numBuildings >= 5) {
        volumeDiscountPercent = 0.05; // 5% discount for 5-9 buildings
      }
      
      // Calculate portfolio quoted costs with volume pricing
      const TRAVEL_COST_PER_DAY = 150;
      const VISIT_COST_PER_BUILDING = 600;
      const EVALUATION_COST_PER_BUILDING = 1000;
      const DIAGRAMS_COST_PER_BUILDING = 1900;
      
      // Estimate travel days (3-4 buildings per day)
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

  // ==================== BLOG ARTICLES (PUBLIC) ====================
  
  // Get published articles (public)
  app.get("/api/blog", async (req: Request, res: Response) => {
    try {
      const articles = await storage.getBlogArticles("published");
      res.json(articles);
    } catch (error) {
      console.error("Error fetching blog articles:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get single article by slug (public)
  app.get("/api/blog/:slug", async (req: Request, res: Response) => {
    try {
      const article = await storage.getBlogArticleBySlug(req.params.slug);
      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }
      
      // Only return if published
      if (article.status !== "published") {
        return res.status(404).json({ error: "Article not found" });
      }
      
      // Increment view count
      await storage.incrementArticleViews(article.id);
      
      res.json(article);
    } catch (error) {
      console.error("Error fetching blog article:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== BLOG ARTICLES (ADMIN) ====================
  
  // Get all articles (admin)
  app.get("/api/admin/blog", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
    try {
      const articles = await storage.getBlogArticles();
      res.json(articles);
    } catch (error) {
      console.error("Error fetching blog articles:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create article (admin)
  app.post("/api/admin/blog", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
    try {
      const article = await storage.createBlogArticle(req.body);
      res.status(201).json(article);
    } catch (error) {
      console.error("Error creating blog article:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update article (admin)
  app.patch("/api/admin/blog/:id", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
    try {
      const article = await storage.updateBlogArticle(req.params.id, req.body);
      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }
      res.json(article);
    } catch (error) {
      console.error("Error updating blog article:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete article (admin)
  app.delete("/api/admin/blog/:id", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
    try {
      const deleted = await storage.deleteBlogArticle(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Article not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting blog article:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Seed blog articles (admin) - Creates 4 comprehensive bilingual articles
  app.post("/api/admin/seed-blog", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
    try {
      const seedArticles = [
        // Article 1: Quebec Solar Incentives 2025
        {
          slug: "incitatifs-solaires-quebec-2025",
          titleFr: "Guide complet des incitatifs solaires au Québec en 2025",
          titleEn: "Complete Guide to Solar Incentives in Quebec 2025",
          excerptFr: "Découvrez tous les programmes d'aide financière pour votre projet solaire commercial au Québec : subventions Hydro-Québec, crédits d'impôt fédéraux et plus encore.",
          excerptEn: "Discover all financial assistance programs for your commercial solar project in Quebec: Hydro-Québec subsidies, federal tax credits and more.",
          metaDescriptionFr: "Guide 2025 des incitatifs solaires au Québec : programme Autoproduction HQ, amortissement accéléré CCA 43.2, crédits d'impôt et mesurage net.",
          metaDescriptionEn: "2025 guide to Quebec solar incentives: HQ Autoproduction program, CCA Class 43.2 accelerated depreciation, tax credits and net metering.",
          keywords: ["incitatifs solaires québec", "subvention hydro-québec", "autoproduction", "CCA 43.2", "mesurage net", "crédit d'impôt solaire", "solar incentives quebec"],
          category: "program",
          status: "published",
          publishedAt: new Date(),
          authorName: "kWh Québec",
          contentFr: `<h2>Les incitatifs solaires au Québec : maximisez votre retour sur investissement</h2>

<p>L'année 2025 représente une opportunité exceptionnelle pour les propriétaires d'immeubles commerciaux et industriels au Québec. Avec la combinaison des programmes provinciaux et fédéraux, jusqu'à <strong>60% du coût</strong> de votre installation solaire peut être couvert par des incitatifs financiers.</p>

<h3>1. Programme Autoproduction d'Hydro-Québec</h3>

<p>Le programme phare d'Hydro-Québec offre une aide directe aux entreprises qui investissent dans l'énergie solaire :</p>

<ul>
<li><strong>1 000 $ par kW</strong> installé pour les systèmes photovoltaïques</li>
<li>Plafond de <strong>40% du coût total</strong> du projet</li>
<li>Applicable aux projets jusqu'à <strong>1 MW</strong> de puissance</li>
<li>Versement rapide après la mise en service</li>
</ul>

<p>Par exemple, pour une installation de 200 kW coûtant 400 000 $, vous pourriez recevoir jusqu'à 160 000 $ en subvention directe.</p>

<h3>2. Amortissement accéléré fédéral (CCA Classe 43.2)</h3>

<p>Le gouvernement fédéral permet un amortissement accéléré exceptionnel pour les équipements d'énergie renouvelable :</p>

<ul>
<li>Taux d'amortissement de <strong>50% dégressif</strong></li>
<li>Règle de la demi-année suspendue la première année (amortissement complet)</li>
<li>Réduction significative de l'impôt sur le revenu des sociétés</li>
<li>Applicable immédiatement à la mise en service</li>
</ul>

<p>Cette mesure permet de récupérer rapidement une partie importante de votre investissement via des économies d'impôt substantielles.</p>

<h3>3. Crédits d'impôt provinciaux</h3>

<p>Certaines entreprises peuvent bénéficier de crédits d'impôt additionnels :</p>

<ul>
<li>Crédit pour investissement en équipement de production d'énergie verte</li>
<li>Programmes sectoriels pour les manufacturiers</li>
<li>Incitatifs pour les zones économiques ciblées</li>
</ul>

<h3>4. Mesurage net : rentabilisez vos surplus</h3>

<p>Le programme de mesurage net d'Hydro-Québec vous permet de valoriser l'énergie que vous ne consommez pas :</p>

<ul>
<li>Les surplus sont crédités à votre compte pour une période de <strong>24 mois</strong></li>
<li>Applicable aux installations jusqu'à <strong>1 MW</strong></li>
<li>Possibilité de vendre les surplus accumulés après 24 mois</li>
<li>Tarif de rachat basé sur le coût évité d'Hydro-Québec</li>
</ul>

<h3>Étude de cas : calcul des incitatifs combinés</h3>

<p>Prenons l'exemple d'un entrepôt avec une installation de 300 kW :</p>

<ul>
<li>Coût brut du projet : <strong>600 000 $</strong></li>
<li>Subvention HQ (40%) : <strong>-240 000 $</strong></li>
<li>Bouclier fiscal CCA 43.2 (année 1) : <strong>-90 000 $</strong></li>
<li><strong>Coût net effectif : 270 000 $</strong></li>
</ul>

<p>Avec des économies annuelles de 45 000 $ sur la facture d'électricité, le retour sur investissement s'établit à environ <strong>6 ans</strong>.</p>

<h3>Comment maximiser vos incitatifs</h3>

<ul>
<li>Faites appel à un intégrateur certifié comme kWh Québec pour naviguer les programmes</li>
<li>Planifiez votre projet avant les dates limites des programmes</li>
<li>Obtenez une analyse détaillée de consommation pour dimensionner optimalement</li>
<li>Coordonnez avec votre comptable pour la stratégie fiscale CCA</li>
</ul>

<h3>Prochaines étapes</h3>

<p>Les programmes d'incitatifs évoluent régulièrement. Pour obtenir une analyse personnalisée de votre potentiel d'économies et des incitatifs applicables à votre situation, <strong>contactez nos experts dès aujourd'hui</strong>.</p>`,
          contentEn: `<h2>Solar Incentives in Quebec: Maximize Your Return on Investment</h2>

<p>2025 represents an exceptional opportunity for commercial and industrial building owners in Quebec. With the combination of provincial and federal programs, up to <strong>60% of the cost</strong> of your solar installation can be covered by financial incentives.</p>

<h3>1. Hydro-Québec Autoproduction Program</h3>

<p>Hydro-Québec's flagship program offers direct assistance to businesses investing in solar energy:</p>

<ul>
<li><strong>$1,000 per kW</strong> installed for photovoltaic systems</li>
<li>Cap of <strong>40% of total project cost</strong></li>
<li>Applicable to projects up to <strong>1 MW</strong> capacity</li>
<li>Rapid payment after commissioning</li>
</ul>

<p>For example, for a 200 kW installation costing $400,000, you could receive up to $160,000 in direct subsidy.</p>

<h3>2. Federal Accelerated Depreciation (CCA Class 43.2)</h3>

<p>The federal government allows exceptional accelerated depreciation for renewable energy equipment:</p>

<ul>
<li><strong>50% declining balance</strong> depreciation rate</li>
<li>Half-year rule suspended in the first year (full depreciation)</li>
<li>Significant reduction in corporate income tax</li>
<li>Applicable immediately upon commissioning</li>
</ul>

<p>This measure allows you to quickly recover a significant portion of your investment through substantial tax savings.</p>

<h3>3. Provincial Tax Credits</h3>

<p>Certain businesses may benefit from additional tax credits:</p>

<ul>
<li>Credit for investment in green energy production equipment</li>
<li>Sector-specific programs for manufacturers</li>
<li>Incentives for targeted economic zones</li>
</ul>

<h3>4. Net Metering: Monetize Your Surplus</h3>

<p>Hydro-Québec's net metering program allows you to monetize energy you don't consume:</p>

<ul>
<li>Surplus is credited to your account for a period of <strong>24 months</strong></li>
<li>Applicable to installations up to <strong>1 MW</strong></li>
<li>Possibility to sell accumulated surplus after 24 months</li>
<li>Buyback rate based on Hydro-Québec's avoided cost</li>
</ul>

<h3>Case Study: Combined Incentives Calculation</h3>

<p>Let's take the example of a warehouse with a 300 kW installation:</p>

<ul>
<li>Gross project cost: <strong>$600,000</strong></li>
<li>HQ Subsidy (40%): <strong>-$240,000</strong></li>
<li>CCA 43.2 Tax Shield (year 1): <strong>-$90,000</strong></li>
<li><strong>Effective Net Cost: $270,000</strong></li>
</ul>

<p>With annual savings of $45,000 on the electricity bill, the return on investment is approximately <strong>6 years</strong>.</p>

<h3>How to Maximize Your Incentives</h3>

<ul>
<li>Work with a certified integrator like kWh Québec to navigate the programs</li>
<li>Plan your project before program deadlines</li>
<li>Obtain a detailed consumption analysis for optimal sizing</li>
<li>Coordinate with your accountant for CCA tax strategy</li>
</ul>

<h3>Next Steps</h3>

<p>Incentive programs evolve regularly. To get a personalized analysis of your savings potential and applicable incentives, <strong>contact our experts today</strong>.</p>`
        },
        // Article 2: Commercial vs Residential Solar
        {
          slug: "solaire-commercial-vs-residentiel",
          titleFr: "Solaire commercial vs résidentiel : 7 différences clés à connaître",
          titleEn: "Commercial vs Residential Solar: 7 Key Differences You Need to Know",
          excerptFr: "Pourquoi un projet solaire commercial n'a rien à voir avec une installation résidentielle? Découvrez les différences cruciales en termes de rentabilité, réglementation et complexité.",
          excerptEn: "Why is a commercial solar project completely different from a residential installation? Discover the crucial differences in terms of ROI, regulations and complexity.",
          metaDescriptionFr: "Comparez le solaire commercial et résidentiel : tarifs G vs M, ROI, licence RBQ, complexité technique. Guide pour propriétaires d'entreprises au Québec.",
          metaDescriptionEn: "Compare commercial and residential solar: G vs M tariffs, ROI, RBQ license, technical complexity. Guide for Quebec business owners.",
          keywords: ["solaire commercial", "solaire résidentiel", "tarif G", "tarif M", "licence RBQ", "rentabilité solaire", "commercial solar quebec"],
          category: "guide",
          status: "published",
          publishedAt: new Date(),
          authorName: "kWh Québec",
          contentFr: `<h2>Solaire commercial vs résidentiel : un monde de différences</h2>

<p>Si vous êtes propriétaire d'un immeuble commercial ou industriel et que vous envisagez le solaire, vous avez probablement entendu parler des installations résidentielles. Mais attention : les deux univers sont fondamentalement différents. Voici les 7 distinctions essentielles.</p>

<h3>1. L'échelle du projet</h3>

<p>La première différence saute aux yeux : la taille.</p>

<ul>
<li><strong>Résidentiel</strong> : 5 à 15 kW typiquement (15 à 40 panneaux)</li>
<li><strong>Commercial</strong> : 50 à 1 000 kW (150 à 3 000 panneaux)</li>
<li><strong>Industriel</strong> : 500 kW à plusieurs MW</li>
</ul>

<p>Cette différence d'échelle affecte tout : la logistique, le financement, les permis requis et les compétences nécessaires.</p>

<h3>2. La structure tarifaire d'Hydro-Québec</h3>

<p>C'est ici que le commercial devient vraiment intéressant :</p>

<ul>
<li><strong>Tarif D (résidentiel)</strong> : environ 7,5 ¢/kWh - le plus bas au monde</li>
<li><strong>Tarif G (petite puissance)</strong> : 8 à 12 ¢/kWh selon la consommation</li>
<li><strong>Tarif M (moyenne puissance)</strong> : comprend une charge de puissance ($/kW) ET une charge d'énergie ($/kWh)</li>
</ul>

<p>Le tarif M, avec sa composante de puissance, offre des opportunités d'économies significatives grâce à l'écrêtage des pointes de demande.</p>

<h3>3. La rentabilité et le retour sur investissement</h3>

<p>Paradoxalement, malgré des coûts d'électricité plus bas au Québec, le commercial offre souvent un meilleur ROI :</p>

<ul>
<li><strong>Résidentiel</strong> : retour sur investissement de 15 à 25 ans</li>
<li><strong>Commercial</strong> : retour sur investissement de 6 à 12 ans</li>
</ul>

<p>Pourquoi? Les économies d'échelle, les incitatifs commerciaux plus généreux et l'impact sur les frais de puissance.</p>

<h3>4. Les exigences réglementaires</h3>

<p>Le commercial exige une rigueur accrue :</p>

<ul>
<li><strong>Licence RBQ</strong> : obligatoire pour l'entrepreneur (sous-catégorie 16)</li>
<li><strong>Ingénieur</strong> : plans signés par un ingénieur membre de l'OIQ</li>
<li><strong>Permis de construire</strong> : souvent requis pour les installations importantes</li>
<li><strong>Inspection ESA</strong> : certification électrique obligatoire</li>
</ul>

<h3>5. La complexité technique</h3>

<p>Une installation commerciale implique des défis uniques :</p>

<ul>
<li>Étude structurale du toit (charge des panneaux et du ballast)</li>
<li>Analyse du réseau électrique existant</li>
<li>Coordination avec les équipements CVAC</li>
<li>Gestion des zones d'ombrage multiples</li>
<li>Intégration possible de batteries pour l'écrêtage</li>
</ul>

<h3>6. Le financement et la fiscalité</h3>

<p>Les entreprises bénéficient d'avantages fiscaux exclusifs :</p>

<ul>
<li><strong>CCA Classe 43.2</strong> : amortissement accéléré à 50%</li>
<li><strong>Déductibilité</strong> : les coûts peuvent être déduits des revenus</li>
<li><strong>Options de financement</strong> : PPA, location, prêt commercial</li>
<li><strong>Crédit-bail</strong> : options hors bilan disponibles</li>
</ul>

<h3>7. L'impact sur la valeur immobilière</h3>

<p>Pour les propriétaires d'immeubles commerciaux, le solaire affecte directement la valeur :</p>

<ul>
<li>Réduction des charges d'exploitation = meilleur NOI (revenu net d'exploitation)</li>
<li>Certification LEED ou BOMA BEST facilitée</li>
<li>Attrait accru pour les locataires soucieux de l'environnement</li>
<li>Protection contre la volatilité des tarifs énergétiques</li>
</ul>

<h3>Pourquoi choisir un spécialiste du commercial</h3>

<p>Un installateur résidentiel n'a pas l'expertise requise pour le commercial. Vous avez besoin d'un partenaire qui comprend :</p>

<ul>
<li>Les structures tarifaires complexes d'Hydro-Québec</li>
<li>L'ingénierie structurale et électrique</li>
<li>Les programmes d'incitatifs commerciaux</li>
<li>La modélisation financière d'entreprise</li>
</ul>

<h3>Prochaine étape</h3>

<p>Avant de comparer des soumissions, assurez-vous de travailler avec un intégrateur spécialisé en C&I (commercial et industriel). Chez kWh Québec, nous analysons votre profil de consommation pour concevoir une solution optimale pour votre réalité d'affaires.</p>`,
          contentEn: `<h2>Commercial vs Residential Solar: A World of Differences</h2>

<p>If you own a commercial or industrial building and are considering solar, you've probably heard about residential installations. But be careful: the two worlds are fundamentally different. Here are the 7 essential distinctions.</p>

<h3>1. Project Scale</h3>

<p>The first difference is obvious: size.</p>

<ul>
<li><strong>Residential</strong>: 5 to 15 kW typically (15 to 40 panels)</li>
<li><strong>Commercial</strong>: 50 to 1,000 kW (150 to 3,000 panels)</li>
<li><strong>Industrial</strong>: 500 kW to several MW</li>
</ul>

<p>This difference in scale affects everything: logistics, financing, required permits and necessary expertise.</p>

<h3>2. Hydro-Québec Tariff Structure</h3>

<p>This is where commercial becomes really interesting:</p>

<ul>
<li><strong>Rate D (residential)</strong>: about 7.5 ¢/kWh - the lowest in the world</li>
<li><strong>Rate G (small power)</strong>: 8 to 12 ¢/kWh depending on consumption</li>
<li><strong>Rate M (medium power)</strong>: includes a power charge ($/kW) AND an energy charge ($/kWh)</li>
</ul>

<p>Rate M, with its power component, offers significant savings opportunities through demand peak shaving.</p>

<h3>3. Profitability and Return on Investment</h3>

<p>Paradoxically, despite lower electricity costs in Quebec, commercial often offers better ROI:</p>

<ul>
<li><strong>Residential</strong>: 15 to 25 year payback</li>
<li><strong>Commercial</strong>: 6 to 12 year payback</li>
</ul>

<p>Why? Economies of scale, more generous commercial incentives and impact on power charges.</p>

<h3>4. Regulatory Requirements</h3>

<p>Commercial requires increased rigor:</p>

<ul>
<li><strong>RBQ License</strong>: mandatory for the contractor (subcategory 16)</li>
<li><strong>Engineer</strong>: plans signed by a licensed OIQ engineer</li>
<li><strong>Building Permit</strong>: often required for significant installations</li>
<li><strong>ESA Inspection</strong>: electrical certification mandatory</li>
</ul>

<h3>5. Technical Complexity</h3>

<p>A commercial installation involves unique challenges:</p>

<ul>
<li>Structural roof study (panel and ballast load)</li>
<li>Existing electrical network analysis</li>
<li>Coordination with HVAC equipment</li>
<li>Management of multiple shading zones</li>
<li>Possible battery integration for peak shaving</li>
</ul>

<h3>6. Financing and Taxation</h3>

<p>Businesses benefit from exclusive tax advantages:</p>

<ul>
<li><strong>CCA Class 43.2</strong>: accelerated depreciation at 50%</li>
<li><strong>Deductibility</strong>: costs can be deducted from income</li>
<li><strong>Financing Options</strong>: PPA, lease, commercial loan</li>
<li><strong>Capital Lease</strong>: off-balance sheet options available</li>
</ul>

<h3>7. Impact on Property Value</h3>

<p>For commercial building owners, solar directly affects value:</p>

<ul>
<li>Reduced operating expenses = better NOI (Net Operating Income)</li>
<li>LEED or BOMA BEST certification facilitated</li>
<li>Increased appeal for environmentally conscious tenants</li>
<li>Protection against energy rate volatility</li>
</ul>

<h3>Why Choose a Commercial Specialist</h3>

<p>A residential installer doesn't have the expertise required for commercial. You need a partner who understands:</p>

<ul>
<li>Hydro-Québec's complex tariff structures</li>
<li>Structural and electrical engineering</li>
<li>Commercial incentive programs</li>
<li>Business financial modeling</li>
</ul>

<h3>Next Step</h3>

<p>Before comparing quotes, make sure you work with a C&I (commercial and industrial) specialized integrator. At kWh Québec, we analyze your consumption profile to design an optimal solution for your business reality.</p>`
        },
        // Article 3: Understanding Your Hydro-Québec Bill
        {
          slug: "comprendre-facture-hydro-quebec",
          titleFr: "Comment lire votre facture Hydro-Québec commerciale : guide complet",
          titleEn: "How to Read Your Commercial Hydro-Québec Bill: Complete Guide",
          excerptFr: "Frais de puissance, tarif G vs M, facteur de puissance... Apprenez à décoder chaque ligne de votre facture d'électricité commerciale et identifiez les économies potentielles.",
          excerptEn: "Power charges, G vs M rates, power factor... Learn to decode every line of your commercial electricity bill and identify potential savings.",
          metaDescriptionFr: "Guide pour comprendre votre facture Hydro-Québec commerciale : tarifs G et M, frais de puissance, facteur de puissance, périodes de pointe.",
          metaDescriptionEn: "Guide to understanding your commercial Hydro-Québec bill: G and M rates, power charges, power factor, peak periods.",
          keywords: ["facture hydro-québec", "tarif G", "tarif M", "frais de puissance", "facteur de puissance", "electricity bill quebec", "commercial rates"],
          category: "guide",
          status: "published",
          publishedAt: new Date(),
          authorName: "kWh Québec",
          contentFr: `<h2>Décoder votre facture Hydro-Québec : le guide du gestionnaire</h2>

<p>Votre facture d'électricité commerciale peut sembler complexe avec ses multiples lignes et abréviations. Pourtant, comprendre chaque composante est essentiel pour identifier les opportunités d'économies – notamment celles que le solaire peut apporter.</p>

<h3>Les deux types de tarifs commerciaux</h3>

<p>Hydro-Québec offre principalement deux tarifs pour les entreprises :</p>

<h4>Tarif G (Général)</h4>
<ul>
<li>Pour les clients avec une puissance appelée de <strong>moins de 65 kW</strong></li>
<li>Structure simple : frais fixe + prix par kWh</li>
<li>Environ 8 à 12 ¢/kWh selon le volume</li>
<li>Pas de frais de puissance séparé</li>
</ul>

<h4>Tarif M (Moyenne puissance)</h4>
<ul>
<li>Pour les clients avec une puissance appelée de <strong>65 kW et plus</strong></li>
<li>Structure en deux parties : énergie ($/kWh) + puissance ($/kW)</li>
<li>Prix de l'énergie plus bas (environ 4-5 ¢/kWh)</li>
<li>Frais de puissance significatifs (15 à 17 $/kW par mois)</li>
</ul>

<h3>Comprendre les frais de puissance (Tarif M)</h3>

<p>C'est la partie la plus importante pour les clients au tarif M. Les frais de puissance sont basés sur :</p>

<ul>
<li><strong>La puissance appelée</strong> : le pic de consommation en kW durant la période</li>
<li><strong>La puissance minimale facturée</strong> : 65% du maximum atteint dans les 12 derniers mois</li>
<li>Facturé mensuellement, peu importe la consommation réelle</li>
</ul>

<p><strong>Exemple :</strong> Si votre pic de puissance est de 200 kW en janvier, vous paierez au minimum 130 kW (65% de 200) même en août quand votre pic réel est de 100 kW.</p>

<h3>Les périodes tarifaires</h3>

<p>Hydro-Québec applique des tarifs différents selon les périodes :</p>

<ul>
<li><strong>Période de pointe</strong> : hiver (décembre à mars), jours de semaine, 6h à 9h et 16h à 20h</li>
<li><strong>Période hors pointe</strong> : reste du temps</li>
</ul>

<p>Les frais de puissance sont plus élevés durant les périodes de pointe hivernales.</p>

<h3>Le facteur de puissance</h3>

<p>Si votre facteur de puissance est inférieur à 90%, vous payez une pénalité :</p>

<ul>
<li>Le facteur de puissance mesure l'efficacité de votre utilisation électrique</li>
<li>Un facteur bas signifie des pertes dans votre réseau (moteurs, transformateurs)</li>
<li>La correction se fait par l'installation de condensateurs</li>
</ul>

<h3>Comment le solaire réduit chaque composante</h3>

<h4>Réduction des frais d'énergie</h4>
<p>Chaque kWh produit par vos panneaux est un kWh non acheté à Hydro-Québec. Les surplus sont crédités via le mesurage net.</p>

<h4>Réduction des frais de puissance</h4>
<p>Le solaire produit surtout en journée, pendant les heures d'activité commerciale. Avec une batterie, vous pouvez aussi écrêter les pointes de puissance pour réduire significativement ces frais.</p>

<h4>Stratégie d'écrêtage</h4>
<ul>
<li>Identifier les pics de puissance récurrents</li>
<li>Dimensionner une batterie pour absorber ces pics</li>
<li>Économies potentielles : 15 à 25% sur les frais de puissance</li>
</ul>

<h3>Lecture pratique de votre facture</h3>

<p>Voici ce qu'il faut repérer sur votre facture :</p>

<ul>
<li><strong>Consommation (kWh)</strong> : total d'énergie consommée</li>
<li><strong>Puissance appelée (kW)</strong> : pic de demande du mois</li>
<li><strong>Puissance facturée (kW)</strong> : puissance utilisée pour le calcul (peut différer)</li>
<li><strong>Facteur de puissance (%)</strong> : efficacité de votre installation</li>
<li><strong>Période</strong> : dates couvertes par la facture</li>
</ul>

<h3>Analyse gratuite de votre facture</h3>

<p>Chez kWh Québec, nous analysons vos 12 derniers mois de facturation pour :</p>

<ul>
<li>Identifier votre profil de consommation</li>
<li>Calculer le dimensionnement optimal d'un système solaire</li>
<li>Évaluer le potentiel d'économies avec ou sans batterie</li>
<li>Projeter le retour sur investissement précis</li>
</ul>

<p>Envoyez-nous vos factures et vos données de consommation horaire pour une analyse complète et personnalisée.</p>`,
          contentEn: `<h2>Decoding Your Hydro-Québec Bill: The Manager's Guide</h2>

<p>Your commercial electricity bill may seem complex with its multiple lines and abbreviations. However, understanding each component is essential to identify savings opportunities – particularly those that solar can provide.</p>

<h3>The Two Types of Commercial Rates</h3>

<p>Hydro-Québec mainly offers two rates for businesses:</p>

<h4>Rate G (General)</h4>
<ul>
<li>For customers with a power demand of <strong>less than 65 kW</strong></li>
<li>Simple structure: fixed charge + price per kWh</li>
<li>About 8 to 12 ¢/kWh depending on volume</li>
<li>No separate power charge</li>
</ul>

<h4>Rate M (Medium Power)</h4>
<ul>
<li>For customers with a power demand of <strong>65 kW and above</strong></li>
<li>Two-part structure: energy ($/kWh) + power ($/kW)</li>
<li>Lower energy price (about 4-5 ¢/kWh)</li>
<li>Significant power charges (15 to 17 $/kW per month)</li>
</ul>

<h3>Understanding Power Charges (Rate M)</h3>

<p>This is the most important part for Rate M customers. Power charges are based on:</p>

<ul>
<li><strong>Power demand</strong>: the peak consumption in kW during the period</li>
<li><strong>Minimum billed power</strong>: 65% of the maximum reached in the last 12 months</li>
<li>Billed monthly, regardless of actual consumption</li>
</ul>

<p><strong>Example:</strong> If your peak power is 200 kW in January, you will pay at least 130 kW (65% of 200) even in August when your actual peak is 100 kW.</p>

<h3>Rate Periods</h3>

<p>Hydro-Québec applies different rates depending on the periods:</p>

<ul>
<li><strong>Peak period</strong>: winter (December to March), weekdays, 6am to 9am and 4pm to 8pm</li>
<li><strong>Off-peak period</strong>: rest of the time</li>
</ul>

<p>Power charges are higher during winter peak periods.</p>

<h3>Power Factor</h3>

<p>If your power factor is below 90%, you pay a penalty:</p>

<ul>
<li>Power factor measures the efficiency of your electrical use</li>
<li>A low factor means losses in your network (motors, transformers)</li>
<li>Correction is done by installing capacitors</li>
</ul>

<h3>How Solar Reduces Each Component</h3>

<h4>Energy Charge Reduction</h4>
<p>Each kWh produced by your panels is one kWh not purchased from Hydro-Québec. Surplus is credited through net metering.</p>

<h4>Power Charge Reduction</h4>
<p>Solar produces mainly during the day, during business hours. With a battery, you can also shave power peaks to significantly reduce these charges.</p>

<h4>Peak Shaving Strategy</h4>
<ul>
<li>Identify recurring power peaks</li>
<li>Size a battery to absorb these peaks</li>
<li>Potential savings: 15 to 25% on power charges</li>
</ul>

<h3>Practical Bill Reading</h3>

<p>Here's what to look for on your bill:</p>

<ul>
<li><strong>Consumption (kWh)</strong>: total energy consumed</li>
<li><strong>Power Demand (kW)</strong>: peak demand for the month</li>
<li><strong>Billed Power (kW)</strong>: power used for calculation (may differ)</li>
<li><strong>Power Factor (%)</strong>: efficiency of your installation</li>
<li><strong>Period</strong>: dates covered by the bill</li>
</ul>

<h3>Free Bill Analysis</h3>

<p>At kWh Québec, we analyze your last 12 months of billing to:</p>

<ul>
<li>Identify your consumption profile</li>
<li>Calculate optimal solar system sizing</li>
<li>Evaluate savings potential with or without battery</li>
<li>Project precise return on investment</li>
</ul>

<p>Send us your bills and hourly consumption data for a complete and personalized analysis.</p>`
        },
        // Article 4: Case Study - Industrial Solar Project
        {
          slug: "etude-de-cas-projet-solaire-industriel",
          titleFr: "Étude de cas : Installation solaire de 500 kW dans un entrepôt industriel",
          titleEn: "Case Study: 500 kW Solar Installation in an Industrial Warehouse",
          excerptFr: "Analyse complète d'un projet solaire industriel au Québec : conception, financement, incitatifs, défis surmontés et résultats financiers après un an d'exploitation.",
          excerptEn: "Complete analysis of an industrial solar project in Quebec: design, financing, incentives, challenges overcome and financial results after one year of operation.",
          metaDescriptionFr: "Étude de cas d'un projet solaire 500 kW au Québec : NPV, TRI, retour sur investissement, incitatifs HQ et CCA 43.2. Résultats réels.",
          metaDescriptionEn: "Case study of a 500 kW solar project in Quebec: NPV, IRR, payback, HQ incentives and CCA 43.2. Real results.",
          keywords: ["étude de cas solaire", "projet industriel", "500 kW", "NPV", "IRR", "retour investissement", "solar case study quebec"],
          category: "case-study",
          status: "published",
          publishedAt: new Date(),
          authorName: "kWh Québec",
          contentFr: `<h2>Étude de cas : Entrepôt Logistique Plus, Montérégie</h2>

<p>Cette étude de cas présente un projet solaire de 500 kW installé sur un entrepôt de distribution de 8 000 m² en Montérégie. Les données financières et techniques sont basées sur une analyse réaliste des conditions québécoises.</p>

<h3>Profil du client</h3>

<ul>
<li><strong>Secteur</strong> : Distribution et logistique</li>
<li><strong>Surface de toiture</strong> : 8 000 m² (toit plat membrane TPO blanche)</li>
<li><strong>Consommation annuelle</strong> : 850 000 kWh</li>
<li><strong>Tarif Hydro-Québec</strong> : Tarif M (puissance appelée moyenne de 180 kW)</li>
<li><strong>Facture annuelle avant projet</strong> : 72 000 $</li>
</ul>

<h3>Conception du système</h3>

<p>Après analyse du profil de consommation horaire et de la structure du bâtiment :</p>

<ul>
<li><strong>Puissance installée</strong> : 500 kWc (kW crête)</li>
<li><strong>Nombre de panneaux</strong> : 1 000 modules bifaciaux de 500 Wc</li>
<li><strong>Orientation</strong> : Est-Ouest (15° d'inclinaison)</li>
<li><strong>Onduleurs</strong> : 3 onduleurs string de 175 kW</li>
<li><strong>Production annuelle estimée</strong> : 575 000 kWh</li>
<li><strong>Taux d'autoconsommation</strong> : 85%</li>
</ul>

<h3>Analyse financière</h3>

<h4>Investissement initial</h4>
<ul>
<li>Coût brut du système : <strong>1 000 000 $</strong></li>
<li>Subvention Hydro-Québec (40%) : <strong>-400 000 $</strong></li>
<li>Coût net avant impôts : <strong>600 000 $</strong></li>
</ul>

<h4>Économies annuelles</h4>
<ul>
<li>Économies sur l'énergie : <strong>35 000 $/an</strong></li>
<li>Économies sur la puissance : <strong>8 500 $/an</strong></li>
<li>Revenus des surplus (année 3+) : <strong>5 000 $/an</strong></li>
<li><strong>Total année 1 : 43 500 $</strong></li>
</ul>

<h4>Incitatifs fiscaux</h4>
<ul>
<li>Bouclier fiscal CCA 43.2 (année 1) : <strong>150 000 $</strong></li>
<li>Bouclier fiscal cumulatif (années 1-5) : <strong>225 000 $</strong></li>
</ul>

<h4>Métriques de rentabilité</h4>
<ul>
<li><strong>VAN (25 ans, taux 6%)</strong> : 485 000 $</li>
<li><strong>TRI (25 ans)</strong> : 14,2%</li>
<li><strong>Retour simple</strong> : 7,8 ans</li>
<li><strong>Retour ajusté (après incitatifs)</strong> : 5,2 ans</li>
<li><strong>LCOE</strong> : 4,8 ¢/kWh</li>
</ul>

<h3>Défis surmontés</h3>

<h4>1. Capacité structurale du toit</h4>
<p>L'étude initiale révélait une capacité limitée à 15 kg/m². Solution : utilisation d'un système de montage léger à ballast réduit et orientation Est-Ouest pour réduire les charges de vent.</p>

<h4>2. Puissance du transformateur</h4>
<p>Le transformateur existant de 500 kVA ne pouvait supporter l'injection complète. Solution : coordination avec Hydro-Québec pour le remplacement par un modèle de 750 kVA, coût partagé via le programme d'autoproduction.</p>

<h4>3. Coordination des travaux</h4>
<p>L'entrepôt opère 24h/24. Solution : installation en phases sur 8 semaines, travaux électriques durant les fins de semaine, aucune interruption des opérations.</p>

<h3>Résultats après un an d'exploitation</h3>

<ul>
<li>Production réelle : <strong>598 000 kWh</strong> (104% de l'estimation)</li>
<li>Économies réelles : <strong>46 200 $</strong> (106% du prévisionnel)</li>
<li>Disponibilité du système : <strong>99,4%</strong></li>
<li>Aucune maintenance majeure requise</li>
</ul>

<h3>Impact environnemental</h3>

<ul>
<li><strong>CO2 évité</strong> : 3,5 tonnes/an (équivalent Québec, réseau déjà propre)</li>
<li>Certification BOMA BEST obtenue grâce au projet</li>
<li>Image de marque améliorée auprès des clients corporatifs</li>
</ul>

<h3>Témoignage du propriétaire</h3>

<blockquote>
<p>« Le projet a dépassé nos attentes. En plus des économies substantielles, nos locataires apprécient notre engagement environnemental. Le processus avec kWh Québec a été transparent du début à la fin. »</p>
</blockquote>

<h3>Leçons apprises</h3>

<ul>
<li>L'analyse détaillée du profil de consommation est cruciale pour le dimensionnement</li>
<li>La coordination précoce avec Hydro-Québec évite les délais</li>
<li>Les toits blancs (TPO) permettent l'utilisation de panneaux bifaciaux pour 5-10% de production additionnelle</li>
<li>Un suivi mensuel permet d'optimiser la performance</li>
</ul>

<h3>Votre projet</h3>

<p>Chaque bâtiment est unique. Contactez kWh Québec pour une analyse personnalisée de votre potentiel solaire et un calcul précis de votre retour sur investissement.</p>`,
          contentEn: `<h2>Case Study: Logistique Plus Warehouse, Montérégie</h2>

<p>This case study presents a 500 kW solar project installed on an 8,000 m² distribution warehouse in Montérégie. The financial and technical data are based on a realistic analysis of Quebec conditions.</p>

<h3>Client Profile</h3>

<ul>
<li><strong>Sector</strong>: Distribution and logistics</li>
<li><strong>Roof Surface</strong>: 8,000 m² (white TPO membrane flat roof)</li>
<li><strong>Annual Consumption</strong>: 850,000 kWh</li>
<li><strong>Hydro-Québec Rate</strong>: Rate M (average power demand of 180 kW)</li>
<li><strong>Annual Bill Before Project</strong>: $72,000</li>
</ul>

<h3>System Design</h3>

<p>After analysis of the hourly consumption profile and building structure:</p>

<ul>
<li><strong>Installed Capacity</strong>: 500 kWp (peak kW)</li>
<li><strong>Number of Panels</strong>: 1,000 bifacial modules of 500 Wp</li>
<li><strong>Orientation</strong>: East-West (15° tilt)</li>
<li><strong>Inverters</strong>: 3 string inverters of 175 kW</li>
<li><strong>Estimated Annual Production</strong>: 575,000 kWh</li>
<li><strong>Self-Consumption Rate</strong>: 85%</li>
</ul>

<h3>Financial Analysis</h3>

<h4>Initial Investment</h4>
<ul>
<li>Gross system cost: <strong>$1,000,000</strong></li>
<li>Hydro-Québec Subsidy (40%): <strong>-$400,000</strong></li>
<li>Net cost before taxes: <strong>$600,000</strong></li>
</ul>

<h4>Annual Savings</h4>
<ul>
<li>Energy savings: <strong>$35,000/year</strong></li>
<li>Power charge savings: <strong>$8,500/year</strong></li>
<li>Surplus revenue (year 3+): <strong>$5,000/year</strong></li>
<li><strong>Total Year 1: $43,500</strong></li>
</ul>

<h4>Tax Incentives</h4>
<ul>
<li>CCA 43.2 Tax Shield (year 1): <strong>$150,000</strong></li>
<li>Cumulative Tax Shield (years 1-5): <strong>$225,000</strong></li>
</ul>

<h4>Profitability Metrics</h4>
<ul>
<li><strong>NPV (25 years, 6% rate)</strong>: $485,000</li>
<li><strong>IRR (25 years)</strong>: 14.2%</li>
<li><strong>Simple Payback</strong>: 7.8 years</li>
<li><strong>Adjusted Payback (after incentives)</strong>: 5.2 years</li>
<li><strong>LCOE</strong>: 4.8 ¢/kWh</li>
</ul>

<h3>Challenges Overcome</h3>

<h4>1. Roof Structural Capacity</h4>
<p>Initial study revealed limited capacity of 15 kg/m². Solution: use of lightweight mounting system with reduced ballast and East-West orientation to reduce wind loads.</p>

<h4>2. Transformer Capacity</h4>
<p>The existing 500 kVA transformer could not support full injection. Solution: coordination with Hydro-Québec for replacement with a 750 kVA model, cost shared through the self-production program.</p>

<h4>3. Work Coordination</h4>
<p>The warehouse operates 24/7. Solution: phased installation over 8 weeks, electrical work during weekends, no operational interruption.</p>

<h3>Results After One Year of Operation</h3>

<ul>
<li>Actual Production: <strong>598,000 kWh</strong> (104% of estimate)</li>
<li>Actual Savings: <strong>$46,200</strong> (106% of forecast)</li>
<li>System Availability: <strong>99.4%</strong></li>
<li>No major maintenance required</li>
</ul>

<h3>Environmental Impact</h3>

<ul>
<li><strong>CO2 Avoided</strong>: 3.5 tonnes/year (Quebec equivalent, already clean grid)</li>
<li>BOMA BEST certification obtained thanks to the project</li>
<li>Improved brand image with corporate clients</li>
</ul>

<h3>Owner Testimonial</h3>

<blockquote>
<p>"The project exceeded our expectations. In addition to the substantial savings, our tenants appreciate our environmental commitment. The process with kWh Québec was transparent from start to finish."</p>
</blockquote>

<h3>Lessons Learned</h3>

<ul>
<li>Detailed consumption profile analysis is crucial for sizing</li>
<li>Early coordination with Hydro-Québec avoids delays</li>
<li>White roofs (TPO) allow use of bifacial panels for 5-10% additional production</li>
<li>Monthly monitoring allows performance optimization</li>
</ul>

<h3>Your Project</h3>

<p>Every building is unique. Contact kWh Québec for a personalized analysis of your solar potential and accurate calculation of your return on investment.</p>`
        }
      ];

      const created = [];
      const skipped = [];

      for (const articleData of seedArticles) {
        const existing = await storage.getBlogArticleBySlug(articleData.slug);
        if (existing) {
          skipped.push(articleData.slug);
        } else {
          const article = await storage.createBlogArticle(articleData);
          created.push(article.slug);
        }
      }

      res.status(201).json({
        message: `Seeded ${created.length} articles, skipped ${skipped.length} existing`,
        created,
        skipped
      });
    } catch (error) {
      console.error("Error seeding blog articles:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== MARKET INTELLIGENCE (ADMIN) ====================

  // --- Competitors ---
  app.get("/api/admin/competitors", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
    try {
      const competitorsList = await storage.getCompetitors();
      res.json(competitorsList);
    } catch (error) {
      console.error("Error fetching competitors:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/admin/competitors/:id", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
    try {
      const competitor = await storage.getCompetitor(req.params.id);
      if (!competitor) {
        return res.status(404).json({ error: "Competitor not found" });
      }
      res.json(competitor);
    } catch (error) {
      console.error("Error fetching competitor:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/admin/competitors", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
    try {
      const competitor = await storage.createCompetitor(req.body);
      res.status(201).json(competitor);
    } catch (error) {
      console.error("Error creating competitor:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/admin/competitors/:id", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
    try {
      const competitor = await storage.updateCompetitor(req.params.id, req.body);
      if (!competitor) {
        return res.status(404).json({ error: "Competitor not found" });
      }
      res.json(competitor);
    } catch (error) {
      console.error("Error updating competitor:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/admin/competitors/:id", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
    try {
      const deleted = await storage.deleteCompetitor(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Competitor not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting competitor:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // --- Battle Cards ---
  app.get("/api/admin/battle-cards", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
    try {
      const competitorId = req.query.competitorId as string | undefined;
      const cards = await storage.getBattleCards(competitorId);
      res.json(cards);
    } catch (error) {
      console.error("Error fetching battle cards:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/admin/battle-cards/:id", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
    try {
      const card = await storage.getBattleCard(req.params.id);
      if (!card) {
        return res.status(404).json({ error: "Battle card not found" });
      }
      res.json(card);
    } catch (error) {
      console.error("Error fetching battle card:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/admin/battle-cards", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
    try {
      const card = await storage.createBattleCard(req.body);
      res.status(201).json(card);
    } catch (error) {
      console.error("Error creating battle card:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/admin/battle-cards/:id", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
    try {
      const card = await storage.updateBattleCard(req.params.id, req.body);
      if (!card) {
        return res.status(404).json({ error: "Battle card not found" });
      }
      res.json(card);
    } catch (error) {
      console.error("Error updating battle card:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/admin/battle-cards/:id", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
    try {
      const deleted = await storage.deleteBattleCard(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Battle card not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting battle card:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // --- Market Notes ---
  app.get("/api/admin/market-notes", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
    try {
      const category = req.query.category as string | undefined;
      const notes = await storage.getMarketNotes(category);
      res.json(notes);
    } catch (error) {
      console.error("Error fetching market notes:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/admin/market-notes/:id", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
    try {
      const note = await storage.getMarketNote(req.params.id);
      if (!note) {
        return res.status(404).json({ error: "Market note not found" });
      }
      res.json(note);
    } catch (error) {
      console.error("Error fetching market note:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/admin/market-notes", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
    try {
      const note = await storage.createMarketNote(req.body);
      res.status(201).json(note);
    } catch (error) {
      console.error("Error creating market note:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/admin/market-notes/:id", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
    try {
      const note = await storage.updateMarketNote(req.params.id, req.body);
      if (!note) {
        return res.status(404).json({ error: "Market note not found" });
      }
      res.json(note);
    } catch (error) {
      console.error("Error updating market note:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/admin/market-notes/:id", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
    try {
      const deleted = await storage.deleteMarketNote(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Market note not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting market note:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // --- Market Documents ---
  app.get("/api/admin/market-documents", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
    try {
      const entityType = req.query.entityType as string | undefined;
      const documents = await storage.getMarketDocuments(entityType);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching market documents:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/admin/market-documents/:id", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
    try {
      const document = await storage.getMarketDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Market document not found" });
      }
      res.json(document);
    } catch (error) {
      console.error("Error fetching market document:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/admin/market-documents", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
    try {
      const document = await storage.createMarketDocument(req.body);
      res.status(201).json(document);
    } catch (error) {
      console.error("Error creating market document:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/admin/market-documents/:id", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
    try {
      const document = await storage.updateMarketDocument(req.params.id, req.body);
      if (!document) {
        return res.status(404).json({ error: "Market document not found" });
      }
      res.json(document);
    } catch (error) {
      console.error("Error updating market document:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/admin/market-documents/:id", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
    try {
      const deleted = await storage.deleteMarketDocument(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Market document not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting market document:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== PROCURATION SIGNATURES ====================
  
  // Get all signatures (admin only)
  app.get("/api/admin/procurations", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
    try {
      const signatures = await storage.getProcurationSignatures();
      res.json(signatures);
    } catch (error) {
      console.error("Error fetching procuration signatures:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // List procuration PDFs from local storage (admin only)
  app.get("/api/admin/procuration-pdfs", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
    try {
      const procurationDir = path.join(process.cwd(), "uploads", "procurations");
      
      if (!fs.existsSync(procurationDir)) {
        return res.json([]);
      }
      
      const files = fs.readdirSync(procurationDir)
        .filter(f => f.endsWith('.pdf'))
        .map(filename => {
          const filePath = path.join(procurationDir, filename);
          const stats = fs.statSync(filePath);
          // Extract lead ID from filename: procuration_<leadId>_<timestamp>.pdf
          const match = filename.match(/^procuration_([a-f0-9-]+)_(\d+)\.pdf$/);
          return {
            filename,
            leadId: match ? match[1] : null,
            createdAt: stats.mtime.toISOString(),
            size: stats.size,
          };
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      res.json(files);
    } catch (error) {
      console.error("Error listing procuration PDFs:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Download procuration PDF by filename (admin only)
  app.get("/api/admin/procuration-pdfs/:filename", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
    try {
      const { filename } = req.params;
      
      // Sanitize filename to prevent path traversal
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ error: "Invalid filename" });
      }
      
      const filePath = path.join(process.cwd(), "uploads", "procurations", filename);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
      }
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
      res.sendFile(filePath);
    } catch (error) {
      console.error("Error downloading procuration PDF:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== CONSTRUCTION AGREEMENTS ROUTES ====================

  // List all construction agreements with site/client data
  app.get("/api/construction-agreements", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const agreements = await storage.getConstructionAgreements();
      
      // Enrich with site and client data
      const enrichedAgreements = await Promise.all(
        agreements.map(async (agreement) => {
          const site = await storage.getSite(agreement.siteId);
          let siteWithClient = null;
          if (site) {
            const client = await storage.getClient(site.clientId);
            siteWithClient = { ...site, client };
          }
          return { ...agreement, site: siteWithClient };
        })
      );
      
      res.json(enrichedAgreements);
    } catch (error) {
      console.error("Error fetching construction agreements:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get single construction agreement with site, design, milestones
  app.get("/api/construction-agreements/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const agreement = await storage.getConstructionAgreement(req.params.id);
      if (!agreement) {
        return res.status(404).json({ error: "Construction agreement not found" });
      }
      
      // Enrich with related data
      const site = await storage.getSite(agreement.siteId);
      const milestones = await storage.getConstructionMilestonesByAgreementId(agreement.id);
      let design = null;
      if (agreement.designId) {
        design = await storage.getDesign(agreement.designId);
      }
      
      res.json({
        ...agreement,
        site,
        design,
        milestones,
      });
    } catch (error) {
      console.error("Error fetching construction agreement:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get construction agreements by site
  app.get("/api/construction-agreements/site/:siteId", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const agreements = await storage.getConstructionAgreementsBySiteId(req.params.siteId);
      res.json(agreements);
    } catch (error) {
      console.error("Error fetching construction agreements by site:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create new construction agreement
  app.post("/api/construction-agreements", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const parsed = insertConstructionAgreementSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      
      const agreement = await storage.createConstructionAgreement({
        ...parsed.data,
        createdBy: req.userId,
      });
      res.status(201).json(agreement);
    } catch (error) {
      console.error("Error creating construction agreement:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update construction agreement
  app.patch("/api/construction-agreements/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const agreement = await storage.updateConstructionAgreement(req.params.id, req.body);
      if (!agreement) {
        return res.status(404).json({ error: "Construction agreement not found" });
      }
      res.json(agreement);
    } catch (error) {
      console.error("Error updating construction agreement:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete construction agreement
  app.delete("/api/construction-agreements/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const deleted = await storage.deleteConstructionAgreement(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Construction agreement not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting construction agreement:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Send construction agreement to client
  app.post("/api/construction-agreements/:id/send", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const agreement = await storage.getConstructionAgreement(req.params.id);
      if (!agreement) {
        return res.status(404).json({ error: "Construction agreement not found" });
      }
      
      const updated = await storage.updateConstructionAgreement(req.params.id, {
        status: "sent",
        sentAt: new Date(),
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error sending construction agreement:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Client accepts construction agreement
  app.post("/api/construction-agreements/:id/accept", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const agreement = await storage.getConstructionAgreement(req.params.id);
      if (!agreement) {
        return res.status(404).json({ error: "Construction agreement not found" });
      }
      
      const { acceptedByName, acceptedByEmail, acceptedByTitle, signatureData } = req.body;
      
      if (!acceptedByName || !acceptedByEmail || !signatureData) {
        return res.status(400).json({ error: "Name, email, and signature are required" });
      }
      
      const updated = await storage.updateConstructionAgreement(req.params.id, {
        status: "accepted",
        acceptedAt: new Date(),
        acceptedByName,
        acceptedByEmail,
        acceptedByTitle,
        signatureData,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error accepting construction agreement:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Generate construction proposal PDF
  app.get("/api/construction-agreements/:id/proposal-pdf", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const lang = (req.query.lang as string) === "en" ? "en" : "fr";
      
      const agreement = await storage.getConstructionAgreement(req.params.id);
      if (!agreement) {
        return res.status(404).json({ error: "Construction agreement not found" });
      }

      const site = await storage.getSite(agreement.siteId);
      if (!site) {
        return res.status(404).json({ error: "Site not found" });
      }

      const client = await storage.getClient(site.clientId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      let design = null;
      let bomItems: any[] = [];
      if (agreement.designId) {
        design = await storage.getDesign(agreement.designId);
        bomItems = await storage.getBomItems(agreement.designId);
      }

      const milestones = await storage.getConstructionMilestonesByAgreementId(agreement.id);

      const allProjects = await storage.getConstructionProjects();
      const project = allProjects.find(p => p.constructionAgreementId === agreement.id) || null;

      let preliminaryTasks: any[] = [];
      if (project) {
        const projectTasks = await storage.getConstructionTasksByProjectId(project.id);
        preliminaryTasks = projectTasks.filter(t => t.isPreliminary === true);
      }

      // Return 404 if no preliminary schedule exists
      if (preliminaryTasks.length === 0) {
        return res.status(404).json({ 
          error: lang === "fr" 
            ? "Aucun calendrier préliminaire disponible. Veuillez d'abord générer le calendrier depuis la page Design." 
            : "No preliminary schedule available. Please generate the schedule from the Design page first."
        });
      }

      const { generateConstructionProposalPDF } = await import("./constructionProposalPdf");

      const doc = new PDFDocument({
        size: "letter",
        margin: 50,
        bufferPages: true,
        info: {
          Title: lang === "fr" ? "Proposition de Construction" : "Construction Proposal",
          Author: "kWh Québec",
          Subject: `${site.name} - Construction Proposal`,
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => {
        const pdfBuffer = Buffer.concat(chunks);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="proposition-construction-${agreement.id.substring(0, 8)}.pdf"`
        );
        res.send(pdfBuffer);
      });

      generateConstructionProposalPDF(doc, {
        agreement,
        site,
        client,
        design,
        bomItems,
        milestones,
        project,
        preliminaryTasks,
      }, lang);

      doc.end();
    } catch (error) {
      console.error("Error generating construction proposal PDF:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== CONSTRUCTION MILESTONES ROUTES ====================

  // Get milestones for an agreement
  app.get("/api/construction-milestones/agreement/:agreementId", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const milestones = await storage.getConstructionMilestonesByAgreementId(req.params.agreementId);
      res.json(milestones);
    } catch (error) {
      console.error("Error fetching construction milestones:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create milestone
  app.post("/api/construction-milestones", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const parsed = insertConstructionMilestoneSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      
      const milestone = await storage.createConstructionMilestone(parsed.data);
      res.status(201).json(milestone);
    } catch (error) {
      console.error("Error creating construction milestone:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update milestone
  app.patch("/api/construction-milestones/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const milestone = await storage.updateConstructionMilestone(req.params.id, req.body);
      if (!milestone) {
        return res.status(404).json({ error: "Construction milestone not found" });
      }
      res.json(milestone);
    } catch (error) {
      console.error("Error updating construction milestone:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete milestone
  app.delete("/api/construction-milestones/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const deleted = await storage.deleteConstructionMilestone(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Construction milestone not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting construction milestone:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Mark milestone as completed
  app.post("/api/construction-milestones/:id/complete", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const milestone = await storage.getConstructionMilestone(req.params.id);
      if (!milestone) {
        return res.status(404).json({ error: "Construction milestone not found" });
      }
      
      const updated = await storage.updateConstructionMilestone(req.params.id, {
        status: "completed",
        completedAt: new Date(),
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error completing construction milestone:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== CONSTRUCTION PROJECTS ROUTES ====================

  // List all construction projects
  app.get("/api/construction-projects", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const projects = await storage.getConstructionProjects();
      
      // Enrich with related data
      const enrichedProjects = await Promise.all(
        projects.map(async (project) => {
          const site = await storage.getSite(project.siteId);
          const projectManager = project.projectManagerId 
            ? await storage.getUser(project.projectManagerId) 
            : null;
          return {
            ...project,
            site,
            client: site?.client,
            projectManager: projectManager ? { id: projectManager.id, name: projectManager.name, email: projectManager.email } : null,
          };
        })
      );
      
      res.json(enrichedProjects);
    } catch (error) {
      console.error("Error fetching construction projects:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get single construction project
  app.get("/api/construction-projects/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const project = await storage.getConstructionProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Construction project not found" });
      }
      
      const site = await storage.getSite(project.siteId);
      const projectManager = project.projectManagerId 
        ? await storage.getUser(project.projectManagerId) 
        : null;
      
      res.json({
        ...project,
        site,
        client: site?.client,
        projectManager: projectManager ? { id: projectManager.id, name: projectManager.name, email: projectManager.email } : null,
      });
    } catch (error) {
      console.error("Error fetching construction project:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get construction projects by site
  app.get("/api/construction-projects/site/:siteId", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const projects = await storage.getConstructionProjectsBySiteId(req.params.siteId);
      res.json(projects);
    } catch (error) {
      console.error("Error fetching construction projects by site:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create construction project
  app.post("/api/construction-projects", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const project = await storage.createConstructionProject(req.body);
      res.status(201).json(project);
    } catch (error) {
      console.error("Error creating construction project:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update construction project
  app.patch("/api/construction-projects/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const project = await storage.updateConstructionProject(req.params.id, req.body);
      if (!project) {
        return res.status(404).json({ error: "Construction project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Error updating construction project:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete construction project
  app.delete("/api/construction-projects/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const deleted = await storage.deleteConstructionProject(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Construction project not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting construction project:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== CONSTRUCTION TASKS ROUTES ====================

  // List all construction tasks (with optional project filter)
  app.get("/api/construction-tasks", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const projectId = req.query.projectId as string | undefined;
      let tasks;
      if (projectId) {
        tasks = await storage.getConstructionTasksByProjectId(projectId);
      } else {
        tasks = await storage.getConstructionTasks();
      }
      
      // Enrich with project data
      const enrichedTasks = await Promise.all(
        tasks.map(async (task) => {
          const project = await storage.getConstructionProject(task.projectId);
          return { ...task, project };
        })
      );
      
      res.json(enrichedTasks);
    } catch (error) {
      console.error("Error fetching construction tasks:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get single construction task
  app.get("/api/construction-tasks/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const task = await storage.getConstructionTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Construction task not found" });
      }
      const project = await storage.getConstructionProject(task.projectId);
      res.json({ ...task, project });
    } catch (error) {
      console.error("Error fetching construction task:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create construction task
  app.post("/api/construction-tasks", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const task = await storage.createConstructionTask(req.body);
      res.status(201).json(task);
    } catch (error) {
      console.error("Error creating construction task:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update construction task
  app.patch("/api/construction-tasks/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const task = await storage.updateConstructionTask(req.params.id, req.body);
      if (!task) {
        return res.status(404).json({ error: "Construction task not found" });
      }
      res.json(task);
    } catch (error) {
      console.error("Error updating construction task:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete construction task
  app.delete("/api/construction-tasks/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const deleted = await storage.deleteConstructionTask(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Construction task not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting construction task:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Generate preliminary schedule from design BOM
  app.post("/api/designs/:designId/generate-preliminary-schedule", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const { designId } = req.params;
      const { startDate } = req.body;

      if (!startDate) {
        return res.status(400).json({ error: "startDate is required" });
      }

      // Get design with BOM items
      const design = await storage.getDesign(designId);
      if (!design) {
        return res.status(404).json({ error: "Design not found" });
      }

      const bomItems = await storage.getBomItemsByDesignId(designId);
      const simulationRun = design.simulationRunId ? await storage.getSimulationRun(design.simulationRunId) : null;
      const site = simulationRun?.siteId ? await storage.getSite(simulationRun.siteId) : null;

      // Get or create a construction project
      let project;
      
      // Check if there's already a construction project linked to this design's agreement
      if (design.constructionAgreementId) {
        const existingProjects = await storage.getConstructionProjects();
        project = existingProjects.find(p => p.constructionAgreementId === design.constructionAgreementId);
      }

      // If no project exists, create a temporary one for the preliminary schedule
      if (!project) {
        // First check if there's a construction agreement for this design
        const agreements = await storage.getConstructionAgreements();
        let agreementId = design.constructionAgreementId;
        
        if (!agreementId && site) {
          // Create a preliminary construction agreement
          const agreement = await storage.createConstructionAgreement({
            siteId: site.id,
            designId: designId,
            status: "draft",
            pvSizeKW: design.pvSizeKW || 0,
            batteryEnergyKWh: design.batteryEnergyKWh || 0,
            totalContractValue: design.totalSellPrice || 0,
          });
          agreementId = agreement.id;
        }

        if (agreementId && site) {
          project = await storage.createConstructionProject({
            constructionAgreementId: agreementId,
            siteId: site.id,
            name: `${site.name || 'Site'} - Preliminary Schedule`,
            status: "planning",
            plannedStartDate: new Date(startDate),
          });
        } else {
          return res.status(400).json({ error: "Cannot create project: missing site or agreement data" });
        }
      }

      // Calculate system size metrics
      const pvSizeKW = design.pvSizeKW || 0;
      const batteryEnergyKWh = design.batteryEnergyKWh || 0;

      // Define task templates with duration formulas
      const taskTemplates = [
        {
          name: "Mobilisation",
          nameEn: "Mobilization",
          category: "general",
          durationDays: 2,
          dependencies: [] as string[],
        },
        {
          name: "Approvisionnement équipements",
          nameEn: "Equipment Procurement",
          category: "procurement",
          durationDays: pvSizeKW > 100 ? 21 : 14, // Larger systems need more lead time
          dependencies: ["Mobilisation"],
        },
        {
          name: "Installation structure",
          nameEn: "Structure Installation",
          category: "structural",
          durationDays: Math.max(2, Math.ceil(pvSizeKW * 0.05)),
          dependencies: ["Approvisionnement équipements"],
        },
        {
          name: "Installation panneaux",
          nameEn: "Panel Installation",
          category: "mechanical",
          durationDays: Math.max(3, Math.ceil(pvSizeKW * 0.1)),
          dependencies: ["Installation structure"],
        },
        ...(batteryEnergyKWh > 0 ? [{
          name: "Installation batteries",
          nameEn: "Battery Installation",
          category: "mechanical" as const,
          durationDays: Math.max(1, Math.ceil(batteryEnergyKWh * 0.02)),
          dependencies: ["Installation panneaux"],
        }] : []),
        {
          name: "Câblage électrique",
          nameEn: "Electrical Wiring",
          category: "electrical",
          durationDays: Math.max(2, Math.ceil(pvSizeKW * 0.08)),
          dependencies: batteryEnergyKWh > 0 ? ["Installation panneaux", "Installation batteries"] : ["Installation panneaux"],
        },
        {
          name: "Inspection électrique",
          nameEn: "Electrical Inspection",
          category: "inspection",
          durationDays: 1,
          dependencies: ["Câblage électrique"],
        },
        {
          name: "Mise en service",
          nameEn: "Commissioning",
          category: "commissioning",
          durationDays: 2,
          dependencies: ["Inspection électrique"],
        },
      ];

      // Delete any existing preliminary tasks for this design
      const existingTasks = await storage.getConstructionTasksByProjectId(project.id);
      for (const task of existingTasks) {
        if (task.isPreliminary && task.sourceDesignId === designId) {
          await storage.deleteConstructionTask(task.id);
        }
      }

      // Create tasks with calculated dates
      const createdTasks: any[] = [];
      const taskIdMap: Record<string, string> = {};
      let currentDate = new Date(startDate);

      for (let i = 0; i < taskTemplates.length; i++) {
        const template = taskTemplates[i];
        
        // Calculate start date based on dependencies
        let taskStartDate = new Date(startDate);
        if (template.dependencies.length > 0) {
          for (const depName of template.dependencies) {
            const depTask = createdTasks.find(t => t.name === depName);
            if (depTask && depTask.plannedEndDate) {
              const depEndDate = new Date(depTask.plannedEndDate);
              if (depEndDate > taskStartDate) {
                taskStartDate = new Date(depEndDate);
                taskStartDate.setDate(taskStartDate.getDate() + 1); // Start day after dependency ends
              }
            }
          }
        }

        // Calculate end date
        const taskEndDate = new Date(taskStartDate);
        taskEndDate.setDate(taskEndDate.getDate() + template.durationDays - 1);

        // Get dependency task IDs
        const dependsOnTaskIds = template.dependencies
          .map(depName => taskIdMap[depName])
          .filter(Boolean);

        const task = await storage.createConstructionTask({
          projectId: project.id,
          name: template.name,
          description: `${template.nameEn} - Auto-generated from design BOM`,
          category: template.category,
          status: "pending",
          priority: "medium",
          plannedStartDate: taskStartDate,
          plannedEndDate: taskEndDate,
          durationDays: template.durationDays,
          dependsOnTaskIds: dependsOnTaskIds.length > 0 ? dependsOnTaskIds : null,
          isPreliminary: true,
          sourceDesignId: designId,
          sortOrder: i,
        });

        createdTasks.push(task);
        taskIdMap[template.name] = task.id;
      }

      // Update project planned dates
      if (createdTasks.length > 0) {
        const firstTask = createdTasks[0];
        const lastTask = createdTasks[createdTasks.length - 1];
        await storage.updateConstructionProject(project.id, {
          plannedStartDate: firstTask.plannedStartDate,
          plannedEndDate: lastTask.plannedEndDate,
        });
      }

      res.status(201).json({
        project,
        tasks: createdTasks,
        message: `Generated ${createdTasks.length} preliminary tasks`,
      });
    } catch (error) {
      console.error("Error generating preliminary schedule:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== O&M CONTRACTS ROUTES ====================

  // List all O&M contracts
  app.get("/api/om-contracts", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const contracts = await storage.getOmContracts();
      res.json(contracts);
    } catch (error) {
      console.error("Error fetching O&M contracts:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get single O&M contract with details
  app.get("/api/om-contracts/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const contract = await storage.getOmContract(req.params.id);
      if (!contract) {
        return res.status(404).json({ error: "O&M contract not found" });
      }
      
      // Enrich with related data
      const site = await storage.getSite(contract.siteId);
      const client = await storage.getClient(contract.clientId);
      const visits = await storage.getOmVisitsByContractId(contract.id);
      
      res.json({
        ...contract,
        site,
        client,
        visits,
      });
    } catch (error) {
      console.error("Error fetching O&M contract:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get O&M contracts by client
  app.get("/api/om-contracts/client/:clientId", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const contracts = await storage.getOmContractsByClientId(req.params.clientId);
      res.json(contracts);
    } catch (error) {
      console.error("Error fetching O&M contracts by client:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get O&M contracts by site
  app.get("/api/om-contracts/site/:siteId", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const contracts = await storage.getOmContractsBySiteId(req.params.siteId);
      res.json(contracts);
    } catch (error) {
      console.error("Error fetching O&M contracts by site:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create new O&M contract
  app.post("/api/om-contracts", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const parsed = insertOmContractSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      
      const contract = await storage.createOmContract({
        ...parsed.data,
        createdBy: req.userId,
      });
      res.status(201).json(contract);
    } catch (error) {
      console.error("Error creating O&M contract:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update O&M contract
  app.patch("/api/om-contracts/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const contract = await storage.updateOmContract(req.params.id, req.body);
      if (!contract) {
        return res.status(404).json({ error: "O&M contract not found" });
      }
      res.json(contract);
    } catch (error) {
      console.error("Error updating O&M contract:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete O&M contract
  app.delete("/api/om-contracts/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const deleted = await storage.deleteOmContract(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "O&M contract not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting O&M contract:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Activate O&M contract
  app.post("/api/om-contracts/:id/activate", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const contract = await storage.getOmContract(req.params.id);
      if (!contract) {
        return res.status(404).json({ error: "O&M contract not found" });
      }
      
      const updated = await storage.updateOmContract(req.params.id, {
        status: "active",
        startDate: req.body.startDate || new Date(),
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error activating O&M contract:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== O&M VISITS ROUTES ====================

  // List all O&M visits
  app.get("/api/om-visits", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const visits = await storage.getOmVisits();
      res.json(visits);
    } catch (error) {
      console.error("Error fetching O&M visits:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get single O&M visit
  app.get("/api/om-visits/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const visit = await storage.getOmVisit(req.params.id);
      if (!visit) {
        return res.status(404).json({ error: "O&M visit not found" });
      }
      res.json(visit);
    } catch (error) {
      console.error("Error fetching O&M visit:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get O&M visits by contract
  app.get("/api/om-visits/contract/:contractId", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const visits = await storage.getOmVisitsByContractId(req.params.contractId);
      res.json(visits);
    } catch (error) {
      console.error("Error fetching O&M visits by contract:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create/schedule O&M visit
  app.post("/api/om-visits", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const parsed = insertOmVisitSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      
      const visit = await storage.createOmVisit(parsed.data);
      res.status(201).json(visit);
    } catch (error) {
      console.error("Error creating O&M visit:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update O&M visit
  app.patch("/api/om-visits/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const visit = await storage.updateOmVisit(req.params.id, req.body);
      if (!visit) {
        return res.status(404).json({ error: "O&M visit not found" });
      }
      res.json(visit);
    } catch (error) {
      console.error("Error updating O&M visit:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete O&M visit
  app.delete("/api/om-visits/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const deleted = await storage.deleteOmVisit(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "O&M visit not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting O&M visit:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Complete O&M visit with findings
  app.post("/api/om-visits/:id/complete", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const visit = await storage.getOmVisit(req.params.id);
      if (!visit) {
        return res.status(404).json({ error: "O&M visit not found" });
      }
      
      const { findings, actionsTaken, issuesFound, issuesResolved, systemReadings, partsUsed } = req.body;
      
      const updated = await storage.updateOmVisit(req.params.id, {
        status: "completed",
        actualDate: new Date(),
        findings,
        actionsTaken,
        issuesFound: issuesFound || 0,
        issuesResolved: issuesResolved || 0,
        systemReadings,
        partsUsed,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error completing O&M visit:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== O&M PERFORMANCE SNAPSHOTS ROUTES ====================

  // Get performance snapshots for a contract
  app.get("/api/om-performance/contract/:contractId", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const snapshots = await storage.getOmPerformanceSnapshotsByContractId(req.params.contractId);
      res.json(snapshots);
    } catch (error) {
      console.error("Error fetching O&M performance snapshots:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create performance snapshot
  app.post("/api/om-performance", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const parsed = insertOmPerformanceSnapshotSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      
      const snapshot = await storage.createOmPerformanceSnapshot(parsed.data);
      res.status(201).json(snapshot);
    } catch (error) {
      console.error("Error creating O&M performance snapshot:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get sites with O&M contracts (for performance dashboard site selector)
  app.get("/api/om-performance/sites", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      // Get all O&M contracts and extract unique site IDs
      const contracts = await storage.getOmContracts();
      const siteIds = [...new Set(contracts.map(c => c.siteId))];
      
      // Get site details for each
      const sites = await Promise.all(
        siteIds.map(async (siteId) => {
          const site = await storage.getSite(siteId);
          return site;
        })
      );
      
      // Filter out any null sites and return
      res.json(sites.filter(Boolean));
    } catch (error) {
      console.error("Error fetching O&M sites:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get performance dashboard data for a site
  app.get("/api/om-performance/dashboard/:siteId", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const siteId = req.params.siteId;
      
      // Get all O&M contracts for this site
      const contracts = await storage.getOmContractsBySiteId(siteId);
      
      if (contracts.length === 0) {
        return res.json({
          contracts: [],
          snapshots: [],
          visits: [],
          summary: null,
        });
      }
      
      // Get all snapshots and visits for all contracts
      const allSnapshots: Awaited<ReturnType<typeof storage.getOmPerformanceSnapshotsByContractId>>[] = [];
      const allVisits: Awaited<ReturnType<typeof storage.getOmVisitsByContractId>>[] = [];
      
      for (const contract of contracts) {
        const snapshots = await storage.getOmPerformanceSnapshotsByContractId(contract.id);
        const visits = await storage.getOmVisitsByContractId(contract.id);
        allSnapshots.push(snapshots);
        allVisits.push(visits);
      }
      
      // Flatten arrays
      const flatSnapshots = allSnapshots.flat();
      const flatVisits = allVisits.flat();
      
      // Calculate summary metrics
      const latestSnapshots = flatSnapshots.slice(-12); // Last 12 snapshots
      const avgPerformanceRatio = latestSnapshots.length > 0
        ? latestSnapshots.reduce((sum, s) => sum + (s.performanceRatio || 0), 0) / latestSnapshots.length
        : null;
      const totalProductionKWh = latestSnapshots.reduce((sum, s) => sum + (s.actualProductionKWh || 0), 0);
      const totalSavings = latestSnapshots.reduce((sum, s) => sum + (s.actualSavings || 0), 0);
      
      res.json({
        contracts,
        snapshots: flatSnapshots,
        visits: flatVisits,
        summary: {
          avgPerformanceRatio,
          totalProductionKWh,
          totalSavings,
          totalVisits: flatVisits.length,
          completedVisits: flatVisits.filter(v => v.status === "completed").length,
          openIssues: flatVisits.reduce((sum, v) => sum + ((v.issuesFound || 0) - (v.issuesResolved || 0)), 0),
        },
      });
    } catch (error) {
      console.error("Error fetching O&M performance dashboard:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== OPPORTUNITIES ROUTES (Sales Pipeline) ====================
  
  // List all opportunities (with optional stage filter)
  app.get("/api/opportunities", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const { stage } = req.query;
      let opportunities;
      if (stage && typeof stage === "string") {
        opportunities = await storage.getOpportunitiesByStage(stage);
      } else {
        opportunities = await storage.getOpportunities();
      }
      res.json(opportunities);
    } catch (error) {
      console.error("Error fetching opportunities:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Get single opportunity with related info
  app.get("/api/opportunities/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const opportunity = await storage.getOpportunity(req.params.id);
      if (!opportunity) {
        return res.status(404).json({ error: "Opportunity not found" });
      }
      
      // Enrich with related entities
      const [lead, client, site] = await Promise.all([
        opportunity.leadId ? storage.getLead(opportunity.leadId) : null,
        opportunity.clientId ? storage.getClient(opportunity.clientId) : null,
        opportunity.siteId ? storage.getSite(opportunity.siteId) : null,
      ]);
      
      res.json({
        ...opportunity,
        lead: lead || null,
        client: client || null,
        site: site || null,
      });
    } catch (error) {
      console.error("Error fetching opportunity:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Get opportunities by lead
  app.get("/api/opportunities/lead/:leadId", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const opportunities = await storage.getOpportunitiesByLeadId(req.params.leadId);
      res.json(opportunities);
    } catch (error) {
      console.error("Error fetching opportunities by lead:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Get opportunities by client
  app.get("/api/opportunities/client/:clientId", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const opportunities = await storage.getOpportunitiesByClientId(req.params.clientId);
      res.json(opportunities);
    } catch (error) {
      console.error("Error fetching opportunities by client:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Get opportunities by site
  app.get("/api/opportunities/site/:siteId", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const opportunities = await storage.getOpportunitiesBySiteId(req.params.siteId);
      res.json(opportunities);
    } catch (error) {
      console.error("Error fetching opportunities by site:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Create opportunity
  app.post("/api/opportunities", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const parseResult = insertOpportunitySchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Validation error", details: parseResult.error.errors });
      }
      
      const opportunity = await storage.createOpportunity(parseResult.data);
      res.status(201).json(opportunity);
    } catch (error) {
      console.error("Error creating opportunity:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Update opportunity
  app.patch("/api/opportunities/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const opportunity = await storage.updateOpportunity(req.params.id, req.body);
      if (!opportunity) {
        return res.status(404).json({ error: "Opportunity not found" });
      }
      res.json(opportunity);
    } catch (error) {
      console.error("Error updating opportunity:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Delete opportunity
  app.delete("/api/opportunities/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const deleted = await storage.deleteOpportunity(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Opportunity not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting opportunity:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Update opportunity stage only (with probability, lostReason/lostNotes if lost)
  app.post("/api/opportunities/:id/stage", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const { stage, probability, lostReason, lostNotes } = req.body;
      
      if (!stage) {
        return res.status(400).json({ error: "Stage is required" });
      }
      
      const opportunity = await storage.updateOpportunityStage(
        req.params.id, 
        stage, 
        probability,
        lostReason, 
        lostNotes
      );
      
      if (!opportunity) {
        return res.status(404).json({ error: "Opportunity not found" });
      }
      res.json(opportunity);
    } catch (error) {
      console.error("Error updating opportunity stage:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== ACTIVITIES ROUTES (CRM Activity Log) ====================
  
  // List all activities (with optional filters)
  app.get("/api/activities", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const { leadId, clientId, siteId, opportunityId, activityType } = req.query;
      
      let activities;
      if (leadId && typeof leadId === "string") {
        activities = await storage.getActivitiesByLeadId(leadId);
      } else if (clientId && typeof clientId === "string") {
        activities = await storage.getActivitiesByClientId(clientId);
      } else if (siteId && typeof siteId === "string") {
        activities = await storage.getActivitiesBySiteId(siteId);
      } else if (opportunityId && typeof opportunityId === "string") {
        activities = await storage.getActivitiesByOpportunityId(opportunityId);
      } else {
        activities = await storage.getActivities();
      }
      
      // Filter by activity type if provided
      if (activityType && typeof activityType === "string") {
        activities = activities.filter(a => a.activityType === activityType);
      }
      
      res.json(activities);
    } catch (error) {
      console.error("Error fetching activities:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Get single activity
  app.get("/api/activities/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const activity = await storage.getActivity(req.params.id);
      if (!activity) {
        return res.status(404).json({ error: "Activity not found" });
      }
      res.json(activity);
    } catch (error) {
      console.error("Error fetching activity:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Get activities by lead
  app.get("/api/activities/lead/:leadId", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const activities = await storage.getActivitiesByLeadId(req.params.leadId);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching activities by lead:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Get activities by client
  app.get("/api/activities/client/:clientId", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const activities = await storage.getActivitiesByClientId(req.params.clientId);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching activities by client:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Get activities by opportunity
  app.get("/api/activities/opportunity/:opportunityId", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const activities = await storage.getActivitiesByOpportunityId(req.params.opportunityId);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching activities by opportunity:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Create activity
  app.post("/api/activities", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const parseResult = insertActivitySchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Validation error", details: parseResult.error.errors });
      }
      
      // Add createdBy if not provided
      const activityData = {
        ...parseResult.data,
        createdBy: parseResult.data.createdBy || req.userId,
      };
      
      const activity = await storage.createActivity(activityData);
      res.status(201).json(activity);
    } catch (error) {
      console.error("Error creating activity:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Update activity
  app.patch("/api/activities/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const activity = await storage.updateActivity(req.params.id, req.body);
      if (!activity) {
        return res.status(404).json({ error: "Activity not found" });
      }
      res.json(activity);
    } catch (error) {
      console.error("Error updating activity:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Delete activity
  app.delete("/api/activities/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const deleted = await storage.deleteActivity(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Activity not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting activity:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== PARTNERSHIPS ====================

  // Get all partnerships
  app.get("/api/partnerships", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const partnerships = await storage.getPartnerships();
      res.json(partnerships);
    } catch (error) {
      console.error("Error fetching partnerships:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get single partnership
  app.get("/api/partnerships/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const partnership = await storage.getPartnership(req.params.id);
      if (!partnership) {
        return res.status(404).json({ error: "Partnership not found" });
      }
      res.json(partnership);
    } catch (error) {
      console.error("Error fetching partnership:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Helper to convert date strings to Date objects for partnership
  function preprocessPartnershipDates(body: any) {
    const dateFields = ['firstContactDate', 'lastContactDate', 'nextFollowUpDate', 'expectedDecisionDate', 'agreementStartDate', 'agreementEndDate'];
    const result = { ...body };
    for (const field of dateFields) {
      if (result[field] && typeof result[field] === 'string') {
        result[field] = new Date(result[field]);
      }
    }
    return result;
  }

  // Create partnership
  app.post("/api/partnerships", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const preprocessed = preprocessPartnershipDates(req.body);
      const data = insertPartnershipSchema.parse(preprocessed);
      const partnership = await storage.createPartnership(data);
      res.status(201).json(partnership);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating partnership:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update partnership
  app.patch("/api/partnerships/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const existing = await storage.getPartnership(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Partnership not found" });
      }
      const preprocessed = preprocessPartnershipDates(req.body);
      const data = insertPartnershipSchema.partial().parse(preprocessed);
      const partnership = await storage.updatePartnership(req.params.id, data);
      res.json(partnership);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error updating partnership:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete partnership
  app.delete("/api/partnerships/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const existing = await storage.getPartnership(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Partnership not found" });
      }
      await storage.deletePartnership(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting partnership:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== AI BATCH IMPORT ====================

  // AI-powered batch import of prospects from Excel/CSV
  app.post("/api/import/prospects/ai-parse", authMiddleware, requireStaff, uploadMemory.single("file"), async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Check file type - only accept CSV for now
      const fileName = req.file.originalname.toLowerCase();
      if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        return res.status(400).json({ 
          error: "Excel files not yet supported",
          details: "Please convert your Excel file to CSV format before uploading. In Excel, use File > Save As > CSV (Comma delimited)."
        });
      }

      // Read file content as text (CSV files only)
      const fileContent = req.file.buffer.toString("utf-8");
      
      // Initialize Gemini AI
      const ai = new GoogleGenAI({
        apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
        httpOptions: {
          apiVersion: "",
          baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
        },
      });

      // Ask Gemini to parse the file and extract prospect data
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
          role: "user",
          parts: [{ text: `You are a data extraction assistant. Parse this file content and extract prospect information.

For each row/entry, extract:
- companyName (required): Company or organization name
- contactName (required): Contact person name
- email (required): Email address
- phone: Phone number
- streetAddress: Street address
- city: City
- province: Province (default to "Québec" if not specified)
- postalCode: Postal code
- estimatedMonthlyBill: Estimated monthly electricity bill in $
- buildingType: Type of building (commercial, industrial, institutional, etc.)
- notes: Any additional notes

Return ONLY a valid JSON array of objects. Do not include any markdown formatting or explanation.
Example output format:
[{"companyName": "ABC Corp", "contactName": "John Doe", "email": "john@abc.com", ...}]

File content:
${fileContent}`
          }]
        }],
      });

      // Extract text from Gemini response
      const candidate = response.candidates?.[0];
      const textPart = candidate?.content?.parts?.find((part: any) => part.text);
      const responseText = textPart?.text || "";
      
      // Parse the JSON response
      let prospects: any[];
      try {
        // Try to extract JSON from the response
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          prospects = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("No JSON array found in response");
        }
      } catch (parseError) {
        console.error("Failed to parse AI response:", responseText);
        return res.status(422).json({ 
          error: "Failed to parse file content",
          details: "The AI could not extract structured data from the file. Please ensure the file contains prospect data in a recognizable format."
        });
      }

      // Validate parsed prospects have required fields
      const validProspects = prospects.filter((p: any) => 
        p.companyName && p.contactName && p.email
      );
      const invalidCount = prospects.length - validProspects.length;

      res.json({ 
        prospects: validProspects,
        count: validProspects.length,
        invalidCount,
        message: invalidCount > 0 
          ? `Successfully parsed ${validProspects.length} prospects (${invalidCount} entries skipped due to missing required fields)`
          : `Successfully parsed ${validProspects.length} prospects from the file`
      });
    } catch (error) {
      console.error("Error in AI batch import:", error);
      res.status(500).json({ error: "Failed to process file" });
    }
  });

  // Batch create prospects
  app.post("/api/import/prospects/batch", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const { prospects } = req.body;
      
      if (!Array.isArray(prospects) || prospects.length === 0) {
        return res.status(400).json({ error: "No prospects provided" });
      }

      const created: Lead[] = [];
      const errors: { index: number; error: string }[] = [];

      for (let i = 0; i < prospects.length; i++) {
        try {
          // Validate required fields
          const prospect = prospects[i];
          if (!prospect.companyName || !prospect.contactName || !prospect.email) {
            errors.push({ index: i, error: "Missing required fields (companyName, contactName, email)" });
            continue;
          }

          const lead = await storage.createLead({
            companyName: prospect.companyName,
            contactName: prospect.contactName,
            email: prospect.email,
            phone: prospect.phone || null,
            streetAddress: prospect.streetAddress || null,
            city: prospect.city || null,
            province: prospect.province || "Québec",
            postalCode: prospect.postalCode || null,
            estimatedMonthlyBill: prospect.estimatedMonthlyBill ? parseFloat(prospect.estimatedMonthlyBill) : null,
            buildingType: prospect.buildingType || null,
            notes: prospect.notes || `Imported via batch import`,
          });
          created.push(lead);
        } catch (err) {
          errors.push({ index: i, error: err instanceof Error ? err.message : "Unknown error" });
        }
      }

      res.json({
        created: created.length,
        errors: errors.length,
        errorDetails: errors,
        leads: created
      });
    } catch (error) {
      console.error("Error in batch prospect creation:", error);
      res.status(500).json({ error: "Failed to create prospects" });
    }
  });

  // Batch import clients
  app.post("/api/import/clients", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const { items } = req.body;
      
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "No items provided" });
      }

      let created = 0;
      let updated = 0;
      let skipped = 0;
      const errors: { index: number; error: string }[] = [];

      for (let i = 0; i < items.length; i++) {
        try {
          const item = items[i];
          
          // Validate required field
          if (!item.name || typeof item.name !== 'string' || item.name.trim() === '') {
            errors.push({ index: i, error: "Missing required field: name" });
            continue;
          }

          // Check for existing client by name (case-insensitive)
          const existingClients = await storage.getClients();
          const existingClient = existingClients.find(
            c => c.name.toLowerCase().trim() === item.name.toLowerCase().trim()
          );

          if (existingClient) {
            // Update existing client
            await storage.updateClient(existingClient.id, {
              mainContactName: item.mainContactName || existingClient.mainContactName,
              email: item.email || existingClient.email,
              phone: item.phone || existingClient.phone,
              address: item.address || existingClient.address,
              city: item.city || existingClient.city,
              province: item.province || existingClient.province,
              postalCode: item.postalCode || existingClient.postalCode,
            });
            updated++;
          } else {
            // Create new client
            await storage.createClient({
              name: item.name.trim(),
              mainContactName: item.mainContactName || null,
              email: item.email || null,
              phone: item.phone || null,
              address: item.address || null,
              city: item.city || null,
              province: item.province || null,
              postalCode: item.postalCode || null,
            });
            created++;
          }
        } catch (err) {
          errors.push({ index: i, error: err instanceof Error ? err.message : "Unknown error" });
        }
      }

      res.json({
        created,
        updated,
        skipped,
        errors: errors.length,
        errorDetails: errors,
      });
    } catch (error) {
      console.error("Error in batch client import:", error);
      res.status(500).json({ error: "Failed to import clients" });
    }
  });

  // Batch import component catalog
  app.post("/api/import/catalog", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const { items } = req.body;
      
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "No items provided" });
      }

      let created = 0;
      let updated = 0;
      let skipped = 0;
      const errors: { index: number; error: string }[] = [];

      for (let i = 0; i < items.length; i++) {
        try {
          const item = items[i];
          
          // Validate required fields
          if (!item.category || typeof item.category !== 'string' || item.category.trim() === '') {
            errors.push({ index: i, error: "Missing required field: category" });
            continue;
          }
          if (!item.manufacturer || typeof item.manufacturer !== 'string' || item.manufacturer.trim() === '') {
            errors.push({ index: i, error: "Missing required field: manufacturer" });
            continue;
          }
          if (!item.model || typeof item.model !== 'string' || item.model.trim() === '') {
            errors.push({ index: i, error: "Missing required field: model" });
            continue;
          }

          // Check for existing catalog item by manufacturer + model (case-insensitive)
          const catalog = await storage.getCatalog();
          const existingItem = catalog.find(
            c => c.manufacturer.toLowerCase().trim() === item.manufacturer.toLowerCase().trim() &&
                 c.model.toLowerCase().trim() === item.model.toLowerCase().trim()
          );

          // Parse specJson if it's a string
          let specJson = item.specJson;
          if (typeof specJson === 'string' && specJson.trim()) {
            try {
              specJson = JSON.parse(specJson);
            } catch {
              specJson = null;
            }
          }

          // Parse numeric values
          const unitCost = item.unitCost ? parseFloat(String(item.unitCost)) : null;
          const unitSellPrice = item.unitSellPrice ? parseFloat(String(item.unitSellPrice)) : null;
          const active = item.active !== undefined ? Boolean(item.active) : true;

          if (existingItem) {
            // Update existing catalog item
            await storage.updateCatalogItem(existingItem.id, {
              category: item.category.trim().toUpperCase(),
              specJson: specJson || existingItem.specJson,
              unitCost: unitCost !== null && !isNaN(unitCost) ? unitCost : existingItem.unitCost,
              unitSellPrice: unitSellPrice !== null && !isNaN(unitSellPrice) ? unitSellPrice : existingItem.unitSellPrice,
              active,
            });
            updated++;
          } else {
            // Create new catalog item
            await storage.createCatalogItem({
              category: item.category.trim().toUpperCase(),
              manufacturer: item.manufacturer.trim(),
              model: item.model.trim(),
              specJson: specJson || null,
              unitCost: unitCost !== null && !isNaN(unitCost) ? unitCost : null,
              unitSellPrice: unitSellPrice !== null && !isNaN(unitSellPrice) ? unitSellPrice : null,
              active,
            });
            created++;
          }
        } catch (err) {
          errors.push({ index: i, error: err instanceof Error ? err.message : "Unknown error" });
        }
      }

      res.json({
        created,
        updated,
        skipped,
        errors: errors.length,
        errorDetails: errors,
      });
    } catch (error) {
      console.error("Error in batch catalog import:", error);
      res.status(500).json({ error: "Failed to import catalog items" });
    }
  });

  // ==================== MARKET INTELLIGENCE - COMPETITOR PROPOSAL ANALYSES ====================

  // GET /api/market-intelligence/proposal-analyses - List all analyses
  app.get("/api/market-intelligence/proposal-analyses", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const analyses = await storage.getCompetitorProposalAnalyses();
      res.json(analyses);
    } catch (error) {
      console.error("Error fetching competitor proposal analyses:", error);
      res.status(500).json({ error: "Failed to fetch competitor proposal analyses" });
    }
  });

  // GET /api/market-intelligence/proposal-analyses/:id - Get single analysis
  app.get("/api/market-intelligence/proposal-analyses/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const analysis = await storage.getCompetitorProposalAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ error: "Competitor proposal analysis not found" });
      }
      res.json(analysis);
    } catch (error) {
      console.error("Error fetching competitor proposal analysis:", error);
      res.status(500).json({ error: "Failed to fetch competitor proposal analysis" });
    }
  });

  // POST /api/market-intelligence/proposal-analyses - Create new analysis
  app.post("/api/market-intelligence/proposal-analyses", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const parsed = insertCompetitorProposalAnalysisSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body", details: parsed.error.errors });
      }
      const analysis = await storage.createCompetitorProposalAnalysis(parsed.data);
      res.status(201).json(analysis);
    } catch (error) {
      console.error("Error creating competitor proposal analysis:", error);
      res.status(500).json({ error: "Failed to create competitor proposal analysis" });
    }
  });

  // PATCH /api/market-intelligence/proposal-analyses/:id - Update analysis
  app.patch("/api/market-intelligence/proposal-analyses/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
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
      console.error("Error updating competitor proposal analysis:", error);
      res.status(500).json({ error: "Failed to update competitor proposal analysis" });
    }
  });

  // DELETE /api/market-intelligence/proposal-analyses/:id - Delete analysis
  app.delete("/api/market-intelligence/proposal-analyses/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
    try {
      const existing = await storage.getCompetitorProposalAnalysis(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Competitor proposal analysis not found" });
      }
      await storage.deleteCompetitorProposalAnalysis(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting competitor proposal analysis:", error);
      res.status(500).json({ error: "Failed to delete competitor proposal analysis" });
    }
  });

  // ==================== ROOF POLYGONS ROUTES ====================
  
  // GET /api/sites/:siteId/roof-polygons - List all polygons for a site
  app.get("/api/sites/:siteId/roof-polygons", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { siteId } = req.params;
      const polygons = await storage.getRoofPolygons(siteId);
      res.json(polygons);
    } catch (error) {
      console.error("Error fetching roof polygons:", error);
      res.status(500).json({ error: "Failed to fetch roof polygons" });
    }
  });

  // POST /api/sites/:siteId/roof-polygons - Create a new polygon
  app.post("/api/sites/:siteId/roof-polygons", authMiddleware, async (req: AuthRequest, res) => {
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
      res.status(201).json(polygon);
    } catch (error) {
      console.error("Error creating roof polygon:", error);
      res.status(500).json({ error: "Failed to create roof polygon" });
    }
  });

  // PUT /api/roof-polygons/:id - Update a polygon
  // Only allow updating: label, coordinates, areaSqM, color
  const updateRoofPolygonSchema = z.object({
    label: z.string().nullable().optional(),
    coordinates: z.array(z.array(z.number())).optional(),
    areaSqM: z.number().positive().optional(),
    color: z.string().optional(),
  }).strict();

  app.put("/api/roof-polygons/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const existing = await storage.getRoofPolygon(id);
      if (!existing) {
        return res.status(404).json({ error: "Roof polygon not found" });
      }

      const validationResult = updateRoofPolygonSchema.safeParse(req.body);
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

  // DELETE /api/roof-polygons/:id - Delete a polygon
  app.delete("/api/roof-polygons/:id", authMiddleware, async (req: AuthRequest, res) => {
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

  // DELETE /api/sites/:siteId/roof-polygons - Delete all polygons for a site
  app.delete("/api/sites/:siteId/roof-polygons", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { siteId } = req.params;
      const deletedCount = await storage.deleteRoofPolygonsBySite(siteId);
      res.status(200).json({ success: true, deleted: deletedCount });
    } catch (error) {
      console.error("Error deleting roof polygons:", error);
      res.status(500).json({ error: "Failed to delete roof polygons" });
    }
  });

  // ==================== AI ASSISTANT ROUTES ====================
  registerAIAssistantRoutes(app, authMiddleware, requireStaff);

  return httpServer;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Deduplicate meter readings by hour
 * 
 * Problem: Sites can have multiple meter files with overlapping periods (e.g., HOUR + FIFTEEN_MIN
 * for the same dates). Without deduplication, the analysis engine sums ALL readings, causing
 * massive overcounting (e.g., 303 million kWh instead of ~500k kWh).
 * 
 * Solution: 
 * 1. Bucket readings by hour (YYYY-MM-DD-HH key)
 * 2. For each hour, prefer HOUR granularity readings (most accurate for energy)
 * 3. If no HOUR reading exists, aggregate ALL readings in that bucket (sum kWh, max kW)
 * 4. Readings without granularity are treated as candidates for aggregation
 * 5. Sort final readings by timestamp
 * 
 * Returns: { readings, dataSpanDays } where dataSpanDays is computed from ORIGINAL timestamps
 */
function deduplicateMeterReadingsByHour(
  rawReadings: Array<{ 
    kWh: number | null; 
    kW: number | null; 
    timestamp: Date;
    granularity?: string;
  }>
): { 
  readings: Array<{ kWh: number | null; kW: number | null; timestamp: Date }>;
  dataSpanDays: number;
} {
  if (rawReadings.length === 0) {
    return { readings: [], dataSpanDays: 365 };
  }
  
  // CRITICAL: Calculate dataSpanDays from ORIGINAL readings (before any filtering)
  // This ensures correct annualization factor
  let minTs = new Date(rawReadings[0].timestamp).getTime();
  let maxTs = minTs;
  for (const r of rawReadings) {
    const ts = new Date(r.timestamp).getTime();
    if (ts < minTs) minTs = ts;
    if (ts > maxTs) maxTs = ts;
  }
  const dataSpanDays = Math.max(1, (maxTs - minTs) / (1000 * 60 * 60 * 24));
  
  // Group readings by hour bucket
  const hourBuckets = new Map<string, Array<typeof rawReadings[0]>>();
  
  for (const reading of rawReadings) {
    const ts = new Date(reading.timestamp);
    // Create hour bucket key: YYYY-MM-DD-HH
    const bucketKey = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}-${String(ts.getDate()).padStart(2, '0')}-${String(ts.getHours()).padStart(2, '0')}`;
    
    const bucket = hourBuckets.get(bucketKey) || [];
    bucket.push(reading);
    hourBuckets.set(bucketKey, bucket);
  }
  
  // For each hour bucket, select or aggregate the best reading
  const deduplicatedReadings: Array<{ kWh: number | null; kW: number | null; timestamp: Date }> = [];
  
  for (const [bucketKey, readings] of hourBuckets) {
    // Separate by granularity - treat missing granularity as "OTHER"
    const hourlyReadings = readings.filter(r => r.granularity === 'HOUR');
    const nonHourlyReadings = readings.filter(r => r.granularity !== 'HOUR');
    
    // Parse bucket key for hour-aligned timestamp
    const parts = bucketKey.split('-');
    const hourTimestamp = new Date(
      parseInt(parts[0]), 
      parseInt(parts[1]) - 1, 
      parseInt(parts[2]), 
      parseInt(parts[3]), 
      0, 0, 0
    );
    
    if (hourlyReadings.length > 0) {
      // Use HOUR reading - take the one with valid kWh if possible
      const bestHourly = hourlyReadings.find(r => r.kWh !== null) || hourlyReadings[0];
      
      // Also check all other readings for max kW (15-min data is more accurate for peaks)
      let maxKW = bestHourly.kW || 0;
      for (const r of nonHourlyReadings) {
        if (r.kW !== null && r.kW > maxKW) {
          maxKW = r.kW;
        }
      }
      
      deduplicatedReadings.push({
        timestamp: hourTimestamp,
        kWh: bestHourly.kWh,
        kW: maxKW > 0 ? maxKW : bestHourly.kW,
      });
    } else {
      // No HOUR readings - aggregate ALL readings in this bucket
      // Sum all kWh values and take max kW
      let totalKWh = 0;
      let maxKW = 0;
      let hasKWh = false;
      
      for (const r of readings) {
        if (r.kWh !== null) {
          totalKWh += r.kWh;
          hasKWh = true;
        }
        if (r.kW !== null && r.kW > maxKW) {
          maxKW = r.kW;
        }
      }
      
      deduplicatedReadings.push({
        timestamp: hourTimestamp,
        kWh: hasKWh ? totalKWh : null,
        kW: maxKW > 0 ? maxKW : null,
      });
    }
  }
  
  // Sort by timestamp for consistent analysis
  deduplicatedReadings.sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  return { readings: deduplicatedReadings, dataSpanDays };
}

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
  
  // Financial metrics
  npv25: number;
  npv10: number;
  npv20: number;
  irr25: number;
  irr10: number;
  irr20: number;
  simplePaybackYears: number;
  lcoe: number;
  
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
  // DEBUG: Log incoming yieldSource BEFORE merge
  console.log(`[runPotentialAnalysis] ======================================`);
  console.log(`[runPotentialAnalysis] INCOMING customAssumptions.yieldSource = '${customAssumptions?.yieldSource}'`);
  console.log(`[runPotentialAnalysis] defaultAnalysisAssumptions.yieldSource = '${defaultAnalysisAssumptions.yieldSource}'`);
  
  // Merge custom assumptions with defaults
  const h: AnalysisAssumptions = { ...defaultAnalysisAssumptions, ...customAssumptions };
  
  // CRITICAL: Copy _yieldStrategy if present in customAssumptions
  const incomingStrategy = (customAssumptions as any)?._yieldStrategy;
  if (incomingStrategy) {
    (h as any)._yieldStrategy = incomingStrategy;
    console.log(`[runPotentialAnalysis] COPIED _yieldStrategy: skipTempCorrection=${incomingStrategy.skipTempCorrection}`);
  }
  
  // CRITICAL: If customAssumptions had yieldSource set, ensure it's preserved after merge
  if (customAssumptions?.yieldSource) {
    h.yieldSource = customAssumptions.yieldSource;
    console.log(`[runPotentialAnalysis] yieldSource from customAssumptions: '${h.yieldSource}'`);
  }
  
  // DEBUG: Verify yieldSource and strategy are correct
  console.log(`[runPotentialAnalysis] AFTER MERGE: yieldSource='${h.yieldSource}', hasStrategy=${!!(h as any)._yieldStrategy}`);
  
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
  
  console.log(`Analysis: totalKWh=${totalKWh.toFixed(0)}, dataSpanDays=${dataSpanDays.toFixed(1)}, annualizationFactor=${annualizationFactor.toFixed(3)}, annualConsumptionKWh=${annualConsumptionKWh.toFixed(0)}`);
  
  // ========== STEP 2: System sizing with roof constraint ==========
  const usableRoofSqFt = h.roofAreaSqFt * h.roofUtilizationRatio;
  const maxPVFromRoof = usableRoofSqFt / 100; // ~100 sq ft per kW
  
  // SIMPLIFIED YIELD CALCULATION (Jan 2026)
  // PRIORITY 1: Use pre-resolved yieldStrategy from caller (already includes bifacial if applicable)
  // PRIORITY 2: Manual calculation as fallback
  const storedYieldStrategy = (h as any)._yieldStrategy as YieldStrategy | undefined;
  let effectiveYield: number;
  
  if (storedYieldStrategy) {
    // Use pre-resolved yield strategy - this is the SINGLE source of truth
    // effectiveYield already includes bifacial boost if bifacialEnabled was true
    effectiveYield = storedYieldStrategy.effectiveYield;
    console.log(`[Stored Strategy] effectiveYield=${effectiveYield.toFixed(0)}, source=${storedYieldStrategy.yieldSource}, bifacialBoost=${storedYieldStrategy.bifacialBoost}`);
  } else if (h.yieldSource === 'google') {
    // Fallback for direct calls without strategy: Google yield with optional bifacial
    const googleBaseYield = h.solarYieldKWhPerKWp || 1079;
    const bifacialMultiplier = h.bifacialEnabled === true ? 1.15 : 1.0;
    effectiveYield = googleBaseYield * bifacialMultiplier;
    console.log(`[Google Fallback] Base=${googleBaseYield}, bifacial=${h.bifacialEnabled === true ? 'ON (+15%)' : 'OFF'}, effectiveYield=${effectiveYield.toFixed(0)}`);
  } else {
    // Fallback: Manual calculation for non-Google sources
    const baseYield = h.solarYieldKWhPerKWp || 1150;
    const orientationFactor = Math.max(0.6, Math.min(1.0, h.orientationFactor || 1.0));
    const bifacialMultiplier = h.bifacialEnabled === true ? 1.15 : 1.0;
    effectiveYield = baseYield * orientationFactor * bifacialMultiplier;
    console.log(`[Manual Fallback] Base=${baseYield}, orientation=${orientationFactor.toFixed(2)}, bifacial=${h.bifacialEnabled}, effectiveYield=${effectiveYield.toFixed(0)}`);
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
  const yieldFactor = effectiveYield / 1150;
  
  // UNIFIED: Use yield strategy from caller if available, otherwise resolve here
  const storedStrategy = (h as any)._yieldStrategy as YieldStrategy | undefined;
  const skipTempCorrection = storedStrategy 
    ? storedStrategy.skipTempCorrection 
    : (h.yieldSource === 'google' || h.yieldSource === 'manual');
  
  // Get yieldSource for bulletproof temperature correction check (passed directly to runHourlySimulation)
  const currentYieldSource: 'google' | 'manual' | 'default' = (h.yieldSource === 'google' || h.yieldSource === 'manual') ? h.yieldSource : 'default';
  console.log(`[runPotentialAnalysis] yieldSource='${currentYieldSource}', skipTempCorrection=${skipTempCorrection}, effectiveYield=${effectiveYield.toFixed(1)}`);
  const systemParams: SystemModelingParams = {
    inverterLoadRatio: h.inverterLoadRatio || 1.2,
    temperatureCoefficient: h.temperatureCoefficient || -0.004,
    wireLossPercent: h.wireLossPercent ?? 0.0, // 0% for free analysis (Jan 2026)
    skipTempCorrection,
  };
  
  const simResult = runHourlySimulation(hourlyData, pvSizeKW, battEnergyKWh, battPowerKW, demandShavingSetpointKW, yieldFactor, systemParams, currentYieldSource);
  
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
  // Battery: NO standalone $300/kW incentive (discontinued as of Dec 2024)
  // Battery can only receive HQ credit if paired with solar AND there's leftover room in the cap
  const potentialHQSolar = pvSizeKW * 1000;
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
  
  // ========== STEP 10: Build 25-year cashflows ==========
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
  
  // Years 1-25
  const degradationRate = h.degradationRatePercent || 0.005; // Default 0.5%/year
  for (let y = 1; y <= h.analysisYears; y++) {
    // Apply panel degradation (production decreases each year)
    // Year 1 = 100%, Year 2 = 99.5%, Year 25 = ~88.6% for 0.5% degradation
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
    
    // Second replacement at year 20 if analysis goes to 25 years
    if (y === 20 && h.analysisYears >= 25 && battEnergyKWh > 0) {
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
  
  // NPV calculations
  const npv25 = calculateNPV(cashflowValues, h.discountRate, 25);
  const npv20 = calculateNPV(cashflowValues, h.discountRate, 20);
  const npv10 = calculateNPV(cashflowValues, h.discountRate, 10);
  
  // IRR calculations
  const irr25 = calculateIRR(cashflowValues.slice(0, 26));
  const irr20 = calculateIRR(cashflowValues.slice(0, 21));
  const irr10 = calculateIRR(cashflowValues.slice(0, 11));
  
  // Simple payback
  let simplePaybackYears = h.analysisYears;
  for (let i = 1; i < cashflows.length; i++) {
    if (cashflows[i].cumulative >= 0) {
      simplePaybackYears = i;
      break;
    }
  }
  
  // LCOE (Levelized Cost of Energy) - with degradation
  // Sum production over lifetime: year 1 = 100%, year 2 = (1-deg), etc.
  let totalProduction = 0;
  for (let y = 1; y <= h.analysisYears; y++) {
    const degradationFactor = Math.pow(1 - degradationRate, y - 1);
    totalProduction += pvSizeKW * effectiveYield * degradationFactor;
  }
  const totalLifetimeCost = capexNet + (opexBase * h.analysisYears);
  const lcoe = totalProduction > 0 ? totalLifetimeCost / totalProduction : 0;
  
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
    const optSimResult = runHourlySimulation(hourlyData, optPvSizeKW, optBattEnergyKWh, optBattPowerKW, optDemandShavingSetpointKW, yieldFactor, systemParams, currentYieldSource);
    
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
    // Battery: NO standalone incentive (discontinued Dec 2024), only gets overflow from solar cap
    const optPotentialHQSolar = optPvSizeKW * 1000;
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
    const optDegradationRate = h.degradationRatePercent || 0.005; // Default 0.5%/year
    
    // Calculate surplus revenue for HQ Net Metering (Dec 2024 program)
    // Compensated at HQ cost of supply rate (NOT client tariff)
    // Source: HQ Tariff Proposal R-4270-2024 - 4.54¢/kWh
    const optHqSurplusRate = h.hqSurplusCompensationRate ?? 0.0454;
    const optAnnualSurplusRevenue = optSimResult.totalExportedKWh * optHqSurplusRate;
    
    for (let y = 1; y <= h.analysisYears; y++) {
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
      
      const replacementYear = h.batteryReplacementYear || 10;
      const replacementFactor = h.batteryReplacementCostFactor || 0.60;
      const priceDecline = h.batteryPriceDeclineRate || 0.05;
      
      if (y === replacementYear && optBattEnergyKWh > 0) {
        const netPriceChange = Math.pow(1 + h.inflationRate - priceDecline, y);
        investment = -optCapexBattery * replacementFactor * netPriceChange;
      }
      if (y === 20 && h.analysisYears >= 25 && optBattEnergyKWh > 0) {
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
    
    // Calculate NPV and IRR for optimal
    const optNpv25 = calculateNPV(optCashflowValues, h.discountRate, 25);
    const optNpv10 = calculateNPV(optCashflowValues, h.discountRate, 10);
    const optNpv20 = calculateNPV(optCashflowValues, h.discountRate, 20);
    const optIrr25 = calculateIRR(optCashflowValues.slice(0, 26));
    const optIrr10 = calculateIRR(optCashflowValues.slice(0, 11));
    const optIrr20 = calculateIRR(optCashflowValues.slice(0, 21));
    
    // Simple payback
    let optSimplePaybackYears = h.analysisYears;
    for (const cf of optCashflows) {
      if (cf.cumulative >= 0 && cf.year > 0) {
        optSimplePaybackYears = cf.year;
        break;
      }
    }
    
    // LCOE - with degradation
    // SIMPLIFIED: For Google yield, use pure Google data × bifacial only
    let optEffectiveYield: number;
    if (h.yieldSource === 'google') {
      const googleBaseYield = h.solarYieldKWhPerKWp || 1079;
      optEffectiveYield = googleBaseYield * (h.bifacialEnabled ? 1.15 : 1.0);
    } else {
      const baseYield = h.solarYieldKWhPerKWp || 1150;
      const orientationFactor = Math.max(0.6, Math.min(1.0, h.orientationFactor || 1.0));
      optEffectiveYield = baseYield * orientationFactor * (h.bifacialEnabled ? 1.15 : 1.0);
    }
    let optTotalProduction = 0;
    for (let y = 1; y <= h.analysisYears; y++) {
      const degradationFactor = Math.pow(1 - optDegradationRate, y - 1);
      optTotalProduction += optPvSizeKW * optEffectiveYield * degradationFactor;
    }
    const optTotalLifetimeCost = optCapexNet + (optOpexBase * h.analysisYears);
    const optLcoe = optTotalProduction > 0 ? optTotalLifetimeCost / optTotalProduction : 0;
    
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
      const finalSimResult = runHourlySimulation(hourlyData, finalPvSizeKW, finalBattEnergyKWh, finalBattPowerKW, optDemandShavingSetpointKW, yieldFactor, systemParams, currentYieldSource);
      
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
      const finalPotentialHQSolar = finalPvSizeKW * 1000;
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
    
    console.log(`[ANALYSIS] Returning RECALCULATED result: pvSizeKW=${optPvSizeKW}, optimalId=${optimalScenario.id}`);
    
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

// Helioscope-inspired system modeling parameters
interface SystemModelingParams {
  inverterLoadRatio: number;      // DC/AC ratio (ILR) - default 1.2
  temperatureCoefficient: number; // Power temp coefficient %/°C - default -0.004
  wireLossPercent: number;        // DC wiring losses - default 0% for free analysis
  skipTempCorrection: boolean;    // Skip temp correction when using Google yield (already weather-adjusted)
}

// Quebec typical monthly average temperatures (°C) for temperature correction
const QUEBEC_MONTHLY_TEMPS = [
  -10, -8, -2, 6, 13, 18, 21, 20, 15, 8, 2, -6
]; // Jan-Dec

// Run hourly solar + battery simulation with SMART peak shaving
// Uses look-ahead optimization to target the HIGHEST daily peak for maximum demand savings
// Now includes Helioscope-inspired modeling: ILR clipping, temperature correction, wire losses
function runHourlySimulation(
  hourlyData: Array<{ hour: number; month: number; consumption: number; peak: number }>,
  pvSizeKW: number,
  battEnergyKWh: number,
  battPowerKW: number,
  threshold: number,
  solarYieldFactor: number = 1.0, // Multiplier to adjust production (1.0 = default 1150 kWh/kWp)
  systemParams: SystemModelingParams = { inverterLoadRatio: 1.2, temperatureCoefficient: -0.004, wireLossPercent: 0.0, skipTempCorrection: false },
  yieldSource: 'google' | 'manual' | 'default' = 'default' // Direct yield source for bulletproof temp correction check
): {
  totalSelfConsumption: number;
  totalProductionKWh: number; // Total annual solar production
  totalExportedKWh: number;   // Surplus exported to grid (production - selfConsumption - battery charge)
  peakAfter: number;
  hourlyProfile: HourlyProfileEntry[];
  peakWeekData: PeakWeekEntry[];
  clippingLossKWh: number; // Total energy lost to inverter clipping
} {
  const hourlyProfile: HourlyProfileEntry[] = [];
  let soc = battEnergyKWh * 0.5; // Start at 50% SOC
  let totalSelfConsumption = 0;
  let totalProductionKWh = 0;
  let totalExportedKWh = 0;
  let peakAfter = 0;
  let maxPeakIndex = 0;
  let maxPeakValue = 0;
  let clippingLossKWh = 0;
  
  // Calculate AC inverter capacity from DC size and ILR
  const inverterACCapacityKW = pvSizeKW / systemParams.inverterLoadRatio;
  
  // Guard for empty data
  if (hourlyData.length === 0) {
    return {
      totalSelfConsumption: 0,
      totalProductionKWh: 0,
      totalExportedKWh: 0,
      peakAfter: 0,
      hourlyProfile: [],
      peakWeekData: [],
      clippingLossKWh: 0,
    };
  }
  
  // SMART PEAK SHAVING: Pre-calculate daily peak hours for look-ahead optimization
  // Instead of greedy approach, we identify the highest peak each day and prioritize it
  const dailyPeakHours = new Map<string, { index: number; peak: number; hour: number }>();
  
  // Group by day and find highest peak per day
  for (let i = 0; i < hourlyData.length; i++) {
    const { hour, month, peak } = hourlyData[i];
    // Create day key based on position in year (month + day approximation from index)
    const dayIndex = Math.floor(i / 24);
    const dayKey = `${month}-${dayIndex}`;
    
    const existing = dailyPeakHours.get(dayKey);
    if (!existing || peak > existing.peak) {
      dailyPeakHours.set(dayKey, { index: i, peak, hour });
    }
  }
  
  // Create a set of peak hours to prioritize (hours that are daily maximums)
  const priorityPeakIndices = new Set<number>();
  dailyPeakHours.forEach((dayPeak) => {
    if (dayPeak.peak > threshold) {
      priorityPeakIndices.add(dayPeak.index);
    }
  });
  
  for (let i = 0; i < hourlyData.length; i++) {
    const { hour, month, consumption, peak } = hourlyData[i];
    
    // Solar production: Gaussian curve centered at 1pm, with seasonal factor
    // Base capacity factor 0.63 produces ~1150 kWh/kWp/year (Quebec baseline), adjusted by solarYieldFactor
    // NOTE: Previously 0.75 which incorrectly produced ~1338 kWh/kWp - fixed Jan 2026
    const bell = Math.exp(-Math.pow(hour - 13, 2) / 8);
    const season = 1 - 0.4 * Math.cos((month - 6) * 2 * Math.PI / 12);
    const isDaytime = hour >= 5 && hour <= 20;
    
    // Apply solarYieldFactor to scale production (1.0 = baseline 1150 kWh/kWp/year)
    // BASELINE_CAPACITY_FACTOR calibrated so that solarYieldFactor=1.0 produces exactly 1150 kWh/kWp/year
    const BASELINE_CAPACITY_FACTOR = 0.645;
    let dcProduction = pvSizeKW * bell * season * BASELINE_CAPACITY_FACTOR * solarYieldFactor * (isDaytime ? 1 : 0);
    
    // Apply temperature correction ONLY when using default yield (not Google or manual)
    // BULLETPROOF CHECK: Use direct yieldSource parameter, ignore systemParams.skipTempCorrection legacy flag
    const shouldSkipTempCorrection = yieldSource === 'google' || yieldSource === 'manual';
    if (!shouldSkipTempCorrection) {
      const ambientTemp = QUEBEC_MONTHLY_TEMPS[month - 1] || 10;
      const cellTempRise = 25 * bell; // Max 25°C rise at peak production
      const cellTemp = ambientTemp + cellTempRise;
      const stcCellTemp = 25; // STC reference
      const tempCorrectionFactor = 1 + systemParams.temperatureCoefficient * (cellTemp - stcCellTemp);
      dcProduction *= tempCorrectionFactor;
    }
    
    // Apply wire losses (reduce DC output before inverter)
    dcProduction *= (1 - systemParams.wireLossPercent);
    
    // Apply ILR clipping: DC power is clipped to AC inverter capacity
    // This happens when DC production exceeds inverter's AC output rating
    let acProduction = dcProduction;
    if (dcProduction > inverterACCapacityKW) {
      clippingLossKWh += (dcProduction - inverterACCapacityKW);
      acProduction = inverterACCapacityKW;
    }
    
    const production = Math.max(0, acProduction);
    
    // Net load (consumption - production)
    const net = consumption - production;
    
    // SMART Battery algorithm with look-ahead peak shaving
    let battAction = 0;
    const peakBefore = peak;
    let peakFinal = peak;
    
    if (battPowerKW > 0 && battEnergyKWh > 0) {
      // Check if this is a priority peak hour (daily maximum)
      const isPriorityPeak = priorityPeakIndices.has(i);
      
      // Look ahead: check if there's a higher peak coming in the next few hours
      let higherPeakComing = false;
      if (!isPriorityPeak && peak > threshold) {
        // Look ahead up to 6 hours for a higher peak
        for (let lookahead = 1; lookahead <= 6 && i + lookahead < hourlyData.length; lookahead++) {
          if (hourlyData[i + lookahead].peak > peak) {
            higherPeakComing = true;
            break;
          }
        }
      }
      
      // Decision logic for discharge:
      // 1. Always discharge for priority peaks (daily maximums)
      // 2. Discharge for non-priority peaks only if no higher peak is coming soon
      // 3. Reserve more battery for priority peaks
      const shouldDischarge = peak > threshold && soc > 0 && (isPriorityPeak || !higherPeakComing);
      
      if (shouldDischarge) {
        // For priority peaks, use full available discharge
        // For secondary peaks, limit discharge to preserve capacity
        const maxDischarge = isPriorityPeak 
          ? Math.min(peak - threshold, battPowerKW, soc)
          : Math.min(peak - threshold, battPowerKW, soc * 0.5); // Use only 50% for non-priority
        battAction = -maxDischarge;
      } else if (net < 0 && soc < battEnergyKWh) {
        // Charge from excess solar
        battAction = Math.min(Math.abs(net), battPowerKW, battEnergyKWh - soc);
      } else if (hour >= 22 && soc < battEnergyKWh) {
        // Night charging - ensure battery is ready for next day's peak
        battAction = Math.min(battPowerKW, battEnergyKWh - soc);
      }
      
      soc += battAction;
      peakFinal = Math.max(0, peak + (battAction < 0 ? battAction : 0));
    }
    
    // Track peak
    if (peak > maxPeakValue) {
      maxPeakValue = peak;
      maxPeakIndex = i;
    }
    peakAfter = Math.max(peakAfter, peakFinal);
    
    // Self-consumption and surplus calculation
    const discharge = battAction < 0 ? -battAction : 0;
    const charge = battAction > 0 ? battAction : 0;
    const selfCons = Math.min(consumption, production + discharge);
    totalSelfConsumption += selfCons;
    totalProductionKWh += production;
    
    // Surplus = production that isn't self-consumed or stored in battery
    // (production - selfConsumption - batteryCharge)
    const exported = Math.max(0, production - selfCons - charge);
    totalExportedKWh += exported;
    
    hourlyProfile.push({
      hour,
      month,
      consumption,
      production,
      peakBefore,
      peakAfter: peakFinal,
      batterySOC: soc,
    });
  }
  
  // Extract peak week data (80 hours around max peak) with guards for short data
  const peakWeekData: PeakWeekEntry[] = [];
  
  // Only extract if we have enough data
  if (hourlyData.length > 0 && hourlyProfile.length > 0) {
    const startIdx = Math.max(0, maxPeakIndex - 40);
    const endIdx = Math.min(hourlyData.length, maxPeakIndex + 40);
    
    for (let i = startIdx; i < endIdx; i++) {
      if (hourlyData[i] && hourlyProfile[i]) {
        peakWeekData.push({
          timestamp: `Hour ${i}`,
          peakBefore: hourlyData[i].peak,
          peakAfter: hourlyProfile[i].peakAfter,
        });
      }
    }
  }
  
  return {
    totalSelfConsumption,
    totalProductionKWh,
    totalExportedKWh,
    peakAfter,
    hourlyProfile,
    peakWeekData,
    clippingLossKWh,
  };
}

// Calculate NPV
function calculateNPV(cashflows: number[], rate: number, years: number): number {
  let npv = 0;
  for (let y = 0; y <= Math.min(years, cashflows.length - 1); y++) {
    npv += cashflows[y] / Math.pow(1 + rate, y);
  }
  return npv;
}

// Calculate IRR using Newton-Raphson method with robust fallback
function calculateIRR(cashflows: number[]): number {
  if (cashflows.length < 2) return 0;
  
  // Check if there's at least one sign change (required for valid IRR)
  let hasNegative = false;
  let hasPositive = false;
  for (const cf of cashflows) {
    if (cf < 0) hasNegative = true;
    if (cf > 0) hasPositive = true;
  }
  
  // If no sign change, IRR doesn't exist
  if (!hasNegative || !hasPositive) {
    return hasPositive ? 1.0 : 0; // All positive = infinite return, all negative/zero = no return
  }
  
  let irr = 0.1; // Initial guess
  const maxIterations = 200;
  const tolerance = 0.0001;
  
  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let dnpv = 0;
    
    for (let t = 0; t < cashflows.length; t++) {
      const denominator = Math.pow(1 + irr, t);
      if (denominator === 0 || !isFinite(denominator)) continue;
      
      const pv = cashflows[t] / denominator;
      npv += pv;
      if (t > 0) {
        dnpv -= t * cashflows[t] / Math.pow(1 + irr, t + 1);
      }
    }
    
    // Guard against division by zero
    if (Math.abs(dnpv) < 1e-10) {
      // Try bisection method as fallback
      return bisectionIRR(cashflows);
    }
    
    const newIrr = irr - npv / dnpv;
    
    // Guard against NaN or Infinity
    if (!isFinite(newIrr)) {
      return bisectionIRR(cashflows);
    }
    
    // Clamp to reasonable bounds
    const clampedIrr = Math.max(-0.99, Math.min(5, newIrr));
    
    if (Math.abs(clampedIrr - irr) < tolerance) {
      return Math.max(0, Math.min(1, clampedIrr)); // Final clamp to 0-100%
    }
    
    irr = clampedIrr;
  }
  
  // Fallback to bisection method
  return bisectionIRR(cashflows);
}

// Bisection method for IRR as robust fallback
function bisectionIRR(cashflows: number[]): number {
  let low = -0.99;
  let high = 2.0;
  const maxIterations = 100;
  const tolerance = 0.0001;
  
  const npvAtRate = (rate: number): number => {
    let npv = 0;
    for (let t = 0; t < cashflows.length; t++) {
      npv += cashflows[t] / Math.pow(1 + rate, t);
    }
    return npv;
  };
  
  // Find bounds where NPV changes sign
  let npvLow = npvAtRate(low);
  let npvHigh = npvAtRate(high);
  
  // If same sign at both bounds, try to find a crossing
  if (npvLow * npvHigh > 0) {
    // Search for a crossing point
    for (let rate = low; rate <= high; rate += 0.1) {
      const npv = npvAtRate(rate);
      if (npvLow * npv < 0) {
        high = rate;
        npvHigh = npv;
        break;
      }
      if (npv * npvHigh < 0) {
        low = rate;
        npvLow = npv;
        break;
      }
    }
    
    // If still no crossing, return 0
    if (npvLow * npvHigh > 0) {
      return 0;
    }
  }
  
  for (let i = 0; i < maxIterations; i++) {
    const mid = (low + high) / 2;
    const npvMid = npvAtRate(mid);
    
    if (Math.abs(npvMid) < tolerance || (high - low) / 2 < tolerance) {
      return Math.max(0, Math.min(1, mid));
    }
    
    if (npvLow * npvMid < 0) {
      high = mid;
      npvHigh = npvMid;
    } else {
      low = mid;
      npvLow = npvMid;
    }
  }
  
  return Math.max(0, Math.min(1, (low + high) / 2));
}

// ==================== SENSITIVITY ANALYSIS ====================

// Run analysis with specified system sizing (instead of auto-sizing)
function runScenarioWithSizing(
  hourlyData: Array<{ hour: number; month: number; consumption: number; peak: number }>,
  pvSizeKW: number,
  battEnergyKWh: number,
  battPowerKW: number,
  peakKW: number,
  annualConsumptionKWh: number,
  assumptions: AnalysisAssumptions
): { 
  npv25: number; 
  npv10: number;
  npv20: number;
  capexNet: number; 
  irr25: number;
  irr10: number;
  irr20: number;
  incentivesHQ: number;
  incentivesHQSolar: number;
  incentivesHQBattery: number;
  incentivesFederal: number;
  taxShield: number;
  cashflows: Array<{ year: number; netCashflow: number }>;
  // Extended KPI fields for optimal scenario Dashboard
  annualSavings: number;
  simplePaybackYears: number;
  totalProductionKWh: number;
  selfSufficiencyPercent: number;
  co2AvoidedTonnesPerYear: number;
} {
  const h = assumptions;
  
  // Run simulation with specified sizes
  // SIMPLIFIED: For Google yield, use pure Google data × bifacial only
  let effectiveYield: number;
  if (h.yieldSource === 'google') {
    const googleBaseYield = h.solarYieldKWhPerKWp || 1079;
    effectiveYield = googleBaseYield * (h.bifacialEnabled ? 1.15 : 1.0);
  } else {
    const baseYield = h.solarYieldKWhPerKWp || 1150;
    const orientationFactor = Math.max(0.6, Math.min(1.0, h.orientationFactor || 1.0));
    effectiveYield = baseYield * orientationFactor * (h.bifacialEnabled ? 1.15 : 1.0);
  }
  
  const yieldFactor = effectiveYield / 1150;
  const demandShavingSetpointKW = battPowerKW > 0 ? Math.round(peakKW * 0.90) : peakKW;
  
  // UNIFIED: Skip temperature correction for Google or manual yield (both pre-adjusted)
  // Only apply temp correction for default (1150) yield
  const storedStrategy = (h as any)._yieldStrategy as YieldStrategy | undefined;
  const skipTempCorrection = storedStrategy 
    ? storedStrategy.skipTempCorrection 
    : (h.yieldSource === 'google' || h.yieldSource === 'manual');
  // Get yieldSource for bulletproof temperature correction check
  const scenarioYieldSource: 'google' | 'manual' | 'default' = (h.yieldSource === 'google' || h.yieldSource === 'manual') ? h.yieldSource : 'default';
  const systemParams: SystemModelingParams = {
    inverterLoadRatio: h.inverterLoadRatio || 1.2,
    temperatureCoefficient: h.temperatureCoefficient || -0.004,
    wireLossPercent: h.wireLossPercent ?? 0.0, // 0% for free analysis (Jan 2026)
    skipTempCorrection,
  };
  
  const simResult = runHourlySimulation(hourlyData, pvSizeKW, battEnergyKWh, battPowerKW, demandShavingSetpointKW, yieldFactor, systemParams, scenarioYieldSource);
  
  // Calculate savings
  const selfConsumptionKWh = simResult.totalSelfConsumption;
  const peakAfterKW = simResult.peakAfter;
  const annualDemandReductionKW = peakKW - peakAfterKW;
  const annualExportedKWh = simResult.totalExportedKWh; // Surplus exported to grid
  
  const annualCostBefore = annualConsumptionKWh * h.tariffEnergy + peakKW * h.tariffPower * 12;
  const energySavings = selfConsumptionKWh * h.tariffEnergy;
  const demandSavings = annualDemandReductionKW * h.tariffPower * 12;
  const annualSavings = energySavings + demandSavings;
  
  // HQ Net Metering surplus revenue (new Dec 2024 program)
  // After 24 months, HQ compensates surplus kWh at cost of supply rate (NOT client tariff)
  // Source: HQ Tariff Proposal R-4270-2024 - 4.54¢/kWh (coût moyen d'approvisionnement)
  const scenarioHqSurplusRate = h.hqSurplusCompensationRate ?? 0.0454;
  const annualSurplusRevenue = annualExportedKWh * scenarioHqSurplusRate;
  
  // CAPEX - use tiered pricing based on system size (automatic, or override from assumptions)
  const baseSolarCostPerW = h.solarCostPerW ?? getTieredSolarCostPerW(pvSizeKW);
  // Apply bifacial cost premium if enabled
  const effectiveSolarCostPerW = h.bifacialEnabled 
    ? baseSolarCostPerW + (h.bifacialCostPremium || 0.10)
    : baseSolarCostPerW;
  const capexPV = pvSizeKW * 1000 * effectiveSolarCostPerW;
  const capexBattery = battEnergyKWh * h.batteryCapacityCost + battPowerKW * h.batteryPowerCost;
  const capexGross = capexPV + capexBattery;
  
  if (capexGross === 0) {
    return { 
      npv25: 0, npv10: 0, npv20: 0, 
      capexNet: 0, 
      irr25: 0, irr10: 0, irr20: 0,
      incentivesHQ: 0, incentivesHQSolar: 0, incentivesHQBattery: 0, 
      incentivesFederal: 0, taxShield: 0, 
      cashflows: [],
      annualSavings: 0,
      simplePaybackYears: 0,
      totalProductionKWh: 0,
      selfSufficiencyPercent: 0,
      co2AvoidedTonnesPerYear: 0,
    };
  }
  
  // HQ incentives: $1000/kW for solar, capped at 40% of CAPEX
  // Battery: NO standalone incentive (discontinued Dec 2024), only gets overflow from solar cap when paired
  const potentialHQSolar = pvSizeKW * 1000;
  const potentialHQBattery = 0; // Discontinued - no standalone battery incentive
  const cap40Percent = capexGross * 0.40;
  
  // Solar gets up to $1000/kW, capped at 40% of CAPEX
  let incentivesHQSolar = Math.min(potentialHQSolar, cap40Percent);
  
  // Battery only gets HQ credit if paired with solar AND there's leftover cap room
  let incentivesHQBattery = 0;
  if (pvSizeKW > 0 && battEnergyKWh > 0) {
    const remainingCap = Math.max(0, cap40Percent - incentivesHQSolar);
    incentivesHQBattery = Math.min(remainingCap, capexBattery);
  }
  
  const incentivesHQ = incentivesHQSolar + incentivesHQBattery;
  
  // Federal ITC
  const itcBasis = capexGross - incentivesHQ;
  const incentivesFederal = itcBasis * 0.30;
  
  // Tax shield
  const capexNetAccounting = Math.max(0, capexGross - incentivesHQ - incentivesFederal);
  const taxShield = capexNetAccounting * h.taxRate * 0.90;
  
  // Net CAPEX
  const totalIncentives = incentivesHQ + incentivesFederal + taxShield;
  const capexNet = capexGross - totalIncentives;
  
  // Equity and cashflows
  const batterySubY0 = incentivesHQBattery * 0.5;
  const equityInitial = capexGross - incentivesHQSolar - batterySubY0;
  const opexBase = (capexPV * h.omSolarPercent) + (capexBattery * h.omBatteryPercent);
  
  const cashflowValues: number[] = [-equityInitial];
  const degradationRate = h.degradationRatePercent || 0.005; // Default 0.5%/year
  
  for (let y = 1; y <= h.analysisYears; y++) {
    // Apply panel degradation (production decreases each year)
    const degradationFactor = Math.pow(1 - degradationRate, y - 1);
    // Revenue = base savings * degradation * tariff inflation
    const savingsRevenue = annualSavings * degradationFactor * Math.pow(1 + h.inflationRate, y - 1);
    
    // HQ surplus revenue starts after 24 months (year 3+)
    // After first 24-month cycle, HQ pays for accumulated surplus in the bank
    // We model this as annual revenue starting year 3
    const surplusRevenue = y >= 3 
      ? annualSurplusRevenue * degradationFactor * Math.pow(1 + h.inflationRate, y - 1)
      : 0;
    
    const revenue = savingsRevenue + surplusRevenue;
    const opex = opexBase * Math.pow(1 + h.omEscalation, y - 1);
    const ebitda = revenue - opex;
    
    let investment = 0;
    let dpa = 0;
    let incentives = 0;
    
    if (y === 1) {
      dpa = taxShield;
      incentives = incentivesHQBattery * 0.5;
    }
    if (y === 2) {
      incentives = incentivesFederal;
    }
    
    // Battery replacement
    const replacementYear = h.batteryReplacementYear || 10;
    const replacementFactor = h.batteryReplacementCostFactor || 0.60;
    const priceDecline = h.batteryPriceDeclineRate || 0.05;
    
    if (y === replacementYear && battEnergyKWh > 0) {
      const netPriceChange = Math.pow(1 + h.inflationRate - priceDecline, y);
      investment = -capexBattery * replacementFactor * netPriceChange;
    }
    if (y === 20 && h.analysisYears >= 25 && battEnergyKWh > 0) {
      const netPriceChange = Math.pow(1 + h.inflationRate - priceDecline, y);
      investment = -capexBattery * replacementFactor * netPriceChange;
    }
    
    cashflowValues.push(ebitda + investment + dpa + incentives);
  }
  
  const npv25 = calculateNPV(cashflowValues, h.discountRate, 25);
  const npv20 = calculateNPV(cashflowValues, h.discountRate, 20);
  const npv10 = calculateNPV(cashflowValues, h.discountRate, 10);
  const irr25 = calculateIRR(cashflowValues.slice(0, 26));
  const irr20 = calculateIRR(cashflowValues.slice(0, 21));
  const irr10 = calculateIRR(cashflowValues.slice(0, 11));
  
  // Build cashflows array for return
  const cashflows = cashflowValues.map((netCashflow, index) => ({ year: index, netCashflow }));
  
  // Calculate additional KPI metrics for Dashboard
  const totalProductionKWh = pvSizeKW * effectiveYield;
  const simplePaybackYears = annualSavings > 0 ? capexNet / annualSavings : 0;
  const selfSufficiencyPercent = annualConsumptionKWh > 0 
    ? (selfConsumptionKWh / annualConsumptionKWh) * 100 
    : 0;
  // Quebec grid emission factor: ~0.5 g CO2/kWh (very low due to hydro)
  const co2AvoidedTonnesPerYear = (selfConsumptionKWh * 0.0005) / 1000;
  
  return { 
    npv25, npv10, npv20, 
    capexNet, 
    irr25, irr10, irr20,
    incentivesHQ, incentivesHQSolar, incentivesHQBattery, 
    incentivesFederal, taxShield, 
    cashflows,
    annualSavings,
    simplePaybackYears,
    totalProductionKWh,
    selfSufficiencyPercent,
    co2AvoidedTonnesPerYear,
  };
}

// Generate sensitivity analysis with multiple scenarios
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
  const frontier: FrontierPoint[] = [];
  const solarSweep: SolarSweepPoint[] = [];
  const batterySweep: BatterySweepPoint[] = [];
  
  // ALWAYS add the user's configured sizing as a frontier point first
  // This ensures the frontier includes what we're actually showing in the main KPIs
  if (configuredPvSizeKW > 0 || configuredBattEnergyKWh > 0) {
    const configResult = runScenarioWithSizing(
      hourlyData, configuredPvSizeKW, configuredBattEnergyKWh, configuredBattPowerKW,
      peakKW, annualConsumptionKWh, assumptions
    );
    
    const hasPV = configuredPvSizeKW > 0;
    const hasBatt = configuredBattEnergyKWh > 0;
    const configType = hasPV && hasBatt ? 'hybrid' : hasPV ? 'solar' : 'battery';
    const configLabel = hasPV && hasBatt 
      ? `${configuredPvSizeKW}kW PV + ${configuredBattEnergyKWh}kWh (Current)` 
      : hasPV 
        ? `${configuredPvSizeKW}kW solar (Current)` 
        : `${configuredBattEnergyKWh}kWh storage (Current)`;
    
    frontier.push({
      id: 'current-config',
      type: configType,
      label: configLabel,
      pvSizeKW: configuredPvSizeKW,
      battEnergyKWh: configuredBattEnergyKWh,
      battPowerKW: configuredBattPowerKW,
      capexNet: configResult.capexNet,
      npv25: configuredNpv25 !== undefined ? configuredNpv25 : configResult.npv25,
      isOptimal: false,
      irr25: configResult.irr25,
      simplePaybackYears: configResult.simplePaybackYears,
      selfSufficiencyPercent: configResult.selfSufficiencyPercent,
      annualSavings: configResult.annualSavings,
      totalProductionKWh: configResult.totalProductionKWh,
      co2AvoidedTonnesPerYear: configResult.co2AvoidedTonnesPerYear,
    });
  }
  
  // Calculate max roof capacity for solar sweep
  const usableRoofSqFt = assumptions.roofAreaSqFt * assumptions.roofUtilizationRatio;
  const maxPVFromRoof = Math.round(usableRoofSqFt / 100);
  
  // Solar sweep: 0 to max PV capacity in ~20 steps, with configured battery
  // Increased from 10 to 20 steps for smoother optimization curves
  const solarSteps = 20;
  const solarMax = Math.max(configuredPvSizeKW * 1.5, maxPVFromRoof);
  const solarStep = Math.max(5, Math.round(solarMax / solarSteps / 5) * 5);
  
  // Build set of solar sizes to sweep, ensuring configured size is always included
  const solarSizes = new Set<number>();
  for (let pvSize = 0; pvSize <= solarMax; pvSize += solarStep) {
    solarSizes.add(pvSize);
  }
  // Always include the exact configured size for KPI consistency
  if (configuredPvSizeKW > 0) {
    solarSizes.add(configuredPvSizeKW);
  }
  
  // Sort and iterate
  const sortedSolarSizes = Array.from(solarSizes).sort((a, b) => a - b);
  
  for (const pvSize of sortedSolarSizes) {
    // Calculate battery power based on energy capacity (2-hour duration) for consistency
    // This ensures hybrid scenarios use appropriate battery power regardless of baseline config
    const battPowerForScenario = Math.round(configuredBattEnergyKWh / 2);
    
    // Always recalculate with runScenarioWithSizing to ensure consistent NPV calculation
    // across all points in the sweep (eliminates potential discrepancies from different code paths)
    const result = runScenarioWithSizing(
      hourlyData, pvSize, configuredBattEnergyKWh, battPowerForScenario,
      peakKW, annualConsumptionKWh, assumptions
    );
    
    solarSweep.push({ pvSizeKW: pvSize, npv25: result.npv25 });
    
    // Add to frontier as hybrid if battery > 0 (skip if same as current config)
    if (pvSize > 0 && configuredBattEnergyKWh > 0 && pvSize !== configuredPvSizeKW) {
      frontier.push({
        id: `hybrid-pv${pvSize}`,
        type: 'hybrid',
        label: `${pvSize}kW PV + ${configuredBattEnergyKWh}kWh`,
        pvSizeKW: pvSize,
        battEnergyKWh: configuredBattEnergyKWh,
        battPowerKW: battPowerForScenario,
        capexNet: result.capexNet,
        npv25: result.npv25,
        isOptimal: false,
        sweepSource: 'pvSweep',
        irr25: result.irr25,
        simplePaybackYears: result.simplePaybackYears,
        selfSufficiencyPercent: result.selfSufficiencyPercent,
        annualSavings: result.annualSavings,
        totalProductionKWh: result.totalProductionKWh,
        co2AvoidedTonnesPerYear: result.co2AvoidedTonnesPerYear,
      });
    }
  }
  
  // Battery sweep: 0 to 200% of configured battery in ~20 steps
  // Keeps PV at configured size while varying battery (consistent with solar sweep approach)
  // Increased from 10 to 20 steps for smoother optimization curves
  const batterySteps = 20;
  const batteryMax = Math.max(configuredBattEnergyKWh * 2, 500);
  const batteryStep = Math.max(10, Math.round(batteryMax / batterySteps / 10) * 10);
  
  // Build set of battery sizes to sweep, ensuring configured size is always included
  const batterySizes = new Set<number>();
  for (let battSize = 0; battSize <= batteryMax; battSize += batteryStep) {
    batterySizes.add(battSize);
  }
  // Always include the exact configured size for KPI consistency
  if (configuredBattEnergyKWh > 0) {
    batterySizes.add(configuredBattEnergyKWh);
  }
  
  // Sort and iterate
  const sortedBatterySizes = Array.from(batterySizes).sort((a, b) => a - b);
  
  for (const battSize of sortedBatterySizes) {
    const battPower = Math.round(battSize / 2); // 2-hour duration
    
    // Always recalculate with runScenarioWithSizing to ensure consistent NPV calculation
    // across all points in the sweep (eliminates potential discrepancies from different code paths)
    const result = runScenarioWithSizing(
      hourlyData, configuredPvSizeKW, battSize, battPower,
      peakKW, annualConsumptionKWh, assumptions
    );
    batterySweep.push({ battEnergyKWh: battSize, npv25: result.npv25 });
  }
  
  // Add hybrid frontier points separately (varying battery at configured PV)
  for (let battSize = batteryStep; battSize <= batteryMax; battSize += batteryStep) {
    // Skip if same as current config (already added above)
    if (configuredPvSizeKW > 0 && battSize !== configuredBattEnergyKWh) {
      const battPower = Math.round(battSize / 2);
      const result = runScenarioWithSizing(
        hourlyData, configuredPvSizeKW, battSize, battPower,
        peakKW, annualConsumptionKWh, assumptions
      );
      frontier.push({
        id: `hybrid-batt${battSize}`,
        type: 'hybrid',
        label: `${configuredPvSizeKW}kW PV + ${battSize}kWh`,
        pvSizeKW: configuredPvSizeKW,
        battEnergyKWh: battSize,
        battPowerKW: battPower,
        capexNet: result.capexNet,
        npv25: result.npv25,
        isOptimal: false,
        sweepSource: 'battSweep',
        irr25: result.irr25,
        simplePaybackYears: result.simplePaybackYears,
        selfSufficiencyPercent: result.selfSufficiencyPercent,
        annualSavings: result.annualSavings,
        totalProductionKWh: result.totalProductionKWh,
        co2AvoidedTonnesPerYear: result.co2AvoidedTonnesPerYear,
      });
    }
  }
  
  // Solar-only scenarios (no battery) - skip if same as current config
  for (let pvSize = solarStep; pvSize <= solarMax; pvSize += solarStep) {
    if (configuredBattEnergyKWh > 0 || pvSize !== configuredPvSizeKW) {
      const result = runScenarioWithSizing(
        hourlyData, pvSize, 0, 0,
        peakKW, annualConsumptionKWh, assumptions
      );
      frontier.push({
        id: `solar-${pvSize}`,
        type: 'solar',
        label: `${pvSize}kW solar only`,
        pvSizeKW: pvSize,
        battEnergyKWh: 0,
        battPowerKW: 0,
        capexNet: result.capexNet,
        npv25: result.npv25,
        isOptimal: false,
        irr25: result.irr25,
        simplePaybackYears: result.simplePaybackYears,
        selfSufficiencyPercent: result.selfSufficiencyPercent,
        annualSavings: result.annualSavings,
        totalProductionKWh: result.totalProductionKWh,
        co2AvoidedTonnesPerYear: result.co2AvoidedTonnesPerYear,
      });
    }
  }
  
  // Battery-only scenarios (no PV) - typically negative NPV
  for (let battSize = batteryStep; battSize <= batteryMax; battSize += batteryStep * 2) {
    // Skip if same as current config (already added above)
    if (configuredPvSizeKW > 0 || battSize !== configuredBattEnergyKWh) {
      const battPower = Math.round(battSize / 2);
      const result = runScenarioWithSizing(
        hourlyData, 0, battSize, battPower,
        peakKW, annualConsumptionKWh, assumptions
      );
      frontier.push({
        id: `battery-${battSize}`,
        type: 'battery',
        label: `${battSize}kWh storage only`,
        pvSizeKW: 0,
        battEnergyKWh: battSize,
        battPowerKW: battPower,
        capexNet: result.capexNet,
        npv25: result.npv25,
        isOptimal: false,
        irr25: result.irr25,
        simplePaybackYears: result.simplePaybackYears,
        selfSufficiencyPercent: result.selfSufficiencyPercent,
        annualSavings: result.annualSavings,
        totalProductionKWh: result.totalProductionKWh,
        co2AvoidedTonnesPerYear: result.co2AvoidedTonnesPerYear,
      });
    }
  }
  
  // Validate and fix type classification based on actual sizing
  for (const point of frontier) {
    const hasPV = point.pvSizeKW > 0;
    const hasBatt = point.battEnergyKWh > 0;
    const correctType = hasPV && hasBatt ? 'hybrid' : hasPV ? 'solar' : 'battery';
    
    if (point.type !== correctType) {
      console.warn(`Frontier point ${point.id} type mismatch: was '${point.type}', corrected to '${correctType}'`);
      point.type = correctType;
      
      // Update label to match corrected type
      if (correctType === 'hybrid') {
        point.label = `${point.pvSizeKW}kW PV + ${point.battEnergyKWh}kWh`;
      } else if (correctType === 'solar') {
        point.label = `${point.pvSizeKW}kW solar only`;
      } else {
        point.label = `${point.battEnergyKWh}kWh storage only`;
      }
    }
  }
  
  // Find optimal scenario (best NPV)
  let optimalId: string | null = null;
  let maxNpv = -Infinity;
  for (const point of frontier) {
    if (point.npv25 > maxNpv) {
      maxNpv = point.npv25;
      optimalId = point.id;
    }
  }
  
  // Mark optimal point
  for (const point of frontier) {
    point.isOptimal = point.id === optimalId;
  }
  
  // Mark optimal point in solar sweep
  let maxSolarNpv = -Infinity;
  for (const point of solarSweep) {
    if (point.npv25 > maxSolarNpv) {
      maxSolarNpv = point.npv25;
    }
  }
  for (const point of solarSweep) {
    point.isOptimal = point.npv25 === maxSolarNpv;
  }
  
  // Mark optimal point in battery sweep
  let maxBattNpv = -Infinity;
  for (const point of batterySweep) {
    if (point.npv25 > maxBattNpv) {
      maxBattNpv = point.npv25;
    }
  }
  for (const point of batterySweep) {
    point.isOptimal = point.npv25 === maxBattNpv;
  }
  
  // ==================== MULTI-OBJECTIVE OPTIMIZATION ====================
  // Find optimal scenarios for different objectives from the frontier data
  
  // Helper to convert FrontierPoint to OptimalScenario
  const toOptimalScenario = (point: FrontierPoint): OptimalScenario => ({
    id: point.id,
    pvSizeKW: point.pvSizeKW,
    battEnergyKWh: point.battEnergyKWh,
    battPowerKW: point.battPowerKW,
    capexNet: point.capexNet,
    npv25: point.npv25,
    irr25: point.irr25 || 0,
    simplePaybackYears: point.simplePaybackYears || 0,
    selfSufficiencyPercent: point.selfSufficiencyPercent || 0,
    annualSavings: point.annualSavings || 0,
    totalProductionKWh: point.totalProductionKWh || 0,
    co2AvoidedTonnesPerYear: point.co2AvoidedTonnesPerYear || 0,
  });
  
  // Filter to only profitable scenarios (NPV > 0) for most objectives
  const profitablePoints = frontier.filter(p => p.npv25 > 0 && p.pvSizeKW > 0);
  const allValidPoints = frontier.filter(p => p.pvSizeKW > 0); // At least has PV
  
  // 1. Best NPV (already found above)
  const bestNPVPoint = frontier.find(p => p.id === optimalId);
  
  // 2. Best IRR (maximize IRR, must be profitable)
  let bestIRRPoint: FrontierPoint | null = null;
  let maxIRR = -Infinity;
  for (const point of profitablePoints) {
    const irr = point.irr25 || 0;
    if (irr > maxIRR && !isNaN(irr) && isFinite(irr)) {
      maxIRR = irr;
      bestIRRPoint = point;
    }
  }
  
  // 3. Max Self-Sufficiency (maximize %, from all valid points)
  let maxSelfSuffPoint: FrontierPoint | null = null;
  let maxSelfSuff = -Infinity;
  for (const point of allValidPoints) {
    const selfSuff = point.selfSufficiencyPercent || 0;
    if (selfSuff > maxSelfSuff) {
      maxSelfSuff = selfSuff;
      maxSelfSuffPoint = point;
    }
  }
  
  // 4. Fast Payback (minimize years, must be profitable and have valid payback)
  let fastPaybackPoint: FrontierPoint | null = null;
  let minPayback = Infinity;
  for (const point of profitablePoints) {
    const payback = point.simplePaybackYears || Infinity;
    if (payback > 0 && payback < minPayback && isFinite(payback)) {
      minPayback = payback;
      fastPaybackPoint = point;
    }
  }
  
  const optimalScenarios: OptimalScenarios = {
    bestNPV: bestNPVPoint ? toOptimalScenario(bestNPVPoint) : null,
    bestIRR: bestIRRPoint ? toOptimalScenario(bestIRRPoint) : null,
    maxSelfSufficiency: maxSelfSuffPoint ? toOptimalScenario(maxSelfSuffPoint) : null,
    fastPayback: fastPaybackPoint ? toOptimalScenario(fastPaybackPoint) : null,
  };
  
  return {
    frontier,
    solarSweep,
    batterySweep,
    optimalScenarioId: optimalId,
    optimalScenarios,
  };
}
