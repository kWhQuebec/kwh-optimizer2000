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
  insertSiteVisitSchema,
  insertDesignAgreementSchema,
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
} from "@shared/schema";
import { z } from "zod";
import * as zoho from "./zohoClient";
import * as googleSolar from "./googleSolarService";
import { sendEmail, generatePortalInvitationEmail } from "./gmail";

const JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required");
}
const upload = multer({ 
  dest: "uploads/",
  limits: {
    files: 200, // Support up to 200 files (24+ months of hourly + 15-min data)
    fileSize: 50 * 1024 * 1024 // 50MB per file
  }
});

interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
  userClientId?: string | null;
}

async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
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
function requireStaff(req: AuthRequest, res: Response, next: NextFunction) {
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
    await storage.updateSite(siteId, {
      latitude: result.latitude,
      longitude: result.longitude,
      roofAreaAutoSqM: result.roofAreaSqM,
      roofAreaAutoSource: "google_solar",
      roofAreaAutoTimestamp: new Date(),
      roofAreaAutoDetails: result.details as any,
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
      
      const tariff = tariffCode || "M";
      const energyRate = HQ_ENERGY_RATES[tariff] || 0.06;
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
      
      // Quebec average: ~1200 kWh/kW/year production
      const QC_PRODUCTION_FACTOR = 1200;
      
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
      
      // Annual production - use Google's estimate if available, otherwise Quebec average
      let annualProductionKWh: number;
      if (roofData?.success && roofData.googleProductionEstimate?.yearlyEnergyAcKwh) {
        // Scale Google's estimate to our system size
        const googleKW = roofData.googleProductionEstimate.systemSizeKw || 1;
        annualProductionKWh = Math.round((roofData.googleProductionEstimate.yearlyEnergyAcKwh / googleKW) * systemSizeKW);
      } else {
        annualProductionKWh = systemSizeKW * QC_PRODUCTION_FACTOR;
      }
      
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
        } : null,
        system: {
          sizeKW: systemSizeKW,
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
        environmental: {
          co2ReductionTons,
        },
      });
    } catch (error) {
      console.error("Quick estimate error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  app.post("/api/leads", async (req, res) => {
    try {
      const parsed = insertLeadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      
      // Create lead in local database first
      let lead = await storage.createLead(parsed.data);
      let zohoSyncStatus: { synced: boolean; error?: string; isMock?: boolean } = { synced: false };
      
      // Attempt to sync to Zoho CRM
      try {
        const nameParts = (parsed.data.contactName || "").split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "-";
        
        const zohoResult = await zoho.createLead({
          firstName,
          lastName,
          email: parsed.data.email,
          phone: parsed.data.phone || undefined,
          company: parsed.data.companyName || undefined,
          description: parsed.data.notes || undefined,
          source: "Website - kWh Québec",
          streetAddress: parsed.data.streetAddress || undefined,
          city: parsed.data.city || undefined,
          province: parsed.data.province || "Québec",
          postalCode: parsed.data.postalCode || undefined,
        });
        
        if (zohoResult.success && zohoResult.data) {
          lead = await storage.updateLead(lead.id, { zohoLeadId: zohoResult.data }) || lead;
          zohoSyncStatus = { synced: true, isMock: zohoResult.isMock };
          console.log(`[Lead] Created and synced to Zoho: ${lead.id} -> ${zohoResult.data}`);
        } else {
          zohoSyncStatus = { synced: false, error: zohoResult.error };
          console.warn(`[Lead] Zoho sync failed: ${zohoResult.error}`);
        }
      } catch (zohoError) {
        console.error("[Zoho] Failed to sync lead:", zohoError);
        zohoSyncStatus = { synced: false, error: String(zohoError) };
      }
      
      // Trigger automatic roof estimation in the background (non-blocking)
      if (parsed.data.streetAddress && parsed.data.city) {
        triggerRoofEstimation(lead.id, parsed.data).catch((err) => {
          console.error(`[Lead ${lead.id}] Roof estimation failed:`, err);
        });
      }
      
      res.status(201).json({ ...lead, zohoSyncStatus });
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
        
        // Sync to Zoho: Update lead status and roof data, create follow-up task
        if (updatedLead?.zohoLeadId) {
          try {
            // Update Zoho lead with roof estimate status and description
            const updateResult = await zoho.updateLead(updatedLead.zohoLeadId, {
              stage: "Contacted", // Standard Zoho status - lead has been engaged with estimate
              description: `[Roof Estimate Completed]\nArea: ${roofEstimate.roofAreaSqM.toFixed(0)} m²\nSolar Potential: ${roofPotentialKw} kW\nAddress: ${fullAddress}`,
            });
            
            if (!updateResult.success && !updateResult.isMock) {
              console.warn(`[Lead ${leadId}] Zoho lead update failed: ${updateResult.error}`);
            }
            
            // Add note to Zoho lead
            await zoho.addNote("Leads", updatedLead.zohoLeadId, 
              `Roof estimate completed via Google Solar API.\n` +
              `Address: ${fullAddress}\n` +
              `Roof Area: ${roofEstimate.roofAreaSqM.toFixed(0)} m²\n` +
              `Solar Potential: ${roofPotentialKw} kW\n` +
              `Next step: Contact lead to sign HQ proxy.`
            );
            
            // Create follow-up task for sales team
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 1); // Due tomorrow
            
            const taskResult = await zoho.createTask({
              subject: `Follow-up: ${data.companyName} - Roof estimate sent (${roofPotentialKw} kW)`,
              dueDate: dueDate.toISOString().split("T")[0],
              priority: roofPotentialKw >= 100 ? "High" : "Normal", // High priority for large projects
              status: "Not Started",
              description: `Lead received roof estimate email.\n` +
                `Company: ${data.companyName}\n` +
                `Contact: ${data.contactName}\n` +
                `Solar Potential: ${roofPotentialKw} kW\n\n` +
                `Action: Call to schedule HQ proxy signature meeting.`,
              relatedTo: { module: "Leads", id: updatedLead.zohoLeadId },
            });
            
            if (taskResult.success) {
              console.log(`[Lead ${leadId}] Zoho CRM updated with roof estimate and follow-up task created`);
            } else if (!taskResult.isMock) {
              console.warn(`[Lead ${leadId}] Zoho task creation failed: ${taskResult.error}`);
            }
          } catch (zohoError) {
            console.error(`[Lead ${leadId}] Zoho sync failed:`, zohoError);
          }
        }
        
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
  
  app.get("/api/sites", authMiddleware, async (req: AuthRequest, res) => {
    try {
      // Client users only see their own sites
      if (req.userRole === "client" && req.userClientId) {
        const sites = await storage.getSitesByClient(req.userClientId);
        // Enrich with client data for consistency
        const client = await storage.getClient(req.userClientId);
        const enrichedSites = sites.map(site => ({ ...site, client: client || { name: "Unknown" } }));
        return res.json(enrichedSites);
      }
      
      // Admin/analyst see all sites
      const sites = await storage.getSites();
      res.json(sites);
    } catch (error) {
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
  app.post("/api/sites", authMiddleware, requireStaff, async (req, res) => {
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
      
      res.status(201).json(site);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/sites/:id", authMiddleware, requireStaff, async (req, res) => {
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

  app.delete("/api/sites/:id", authMiddleware, requireStaff, async (req, res) => {
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

      const updatedSite = await storage.updateSite(siteId, {
        latitude: result.latitude,
        longitude: result.longitude,
        roofAreaAutoSqM: result.roofAreaSqM,
        roofAreaAutoSource: "google_solar",
        roofAreaAutoTimestamp: new Date(),
        roofAreaAutoDetails: result.details as any,
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
      const readings = await storage.getMeterReadingsBySite(siteId);
      
      if (readings.length === 0) {
        return res.status(400).json({ error: "No meter data available" });
      }
      
      // Get site data to check for Google Solar data
      const site = await storage.getSite(siteId);
      
      // Merge Google Solar data into assumptions if available
      let mergedAssumptions = { ...customAssumptions };
      
      if (site?.roofAreaAutoDetails) {
        const googleData = site.roofAreaAutoDetails as {
          maxSunshineHoursPerYear?: number;
          bestOrientation?: { azimuth?: number; pitch?: number };
          roofSegments?: Array<{ azimuth?: number; pitch?: number }>;
        };
        
        // Use Google Solar's maxSunshineHoursPerYear if not manually overridden
        if (googleData.maxSunshineHoursPerYear && !customAssumptions?.solarYieldKWhPerKWp) {
          // Convert sunshine hours to kWh/kWp (roughly 1:1 ratio for well-oriented panels)
          // Google's maxSunshineHoursPerYear is the max possible, apply ~0.85 derating for realistic yield
          mergedAssumptions.solarYieldKWhPerKWp = Math.round(googleData.maxSunshineHoursPerYear * 0.85);
        }
        
        // Calculate orientation factor from roof segments if not manually overridden
        if (googleData.roofSegments && googleData.roofSegments.length > 0 && !customAssumptions?.orientationFactor) {
          // Best orientation for Quebec: South (180°) at ~30° pitch
          // Calculate average orientation quality across segments
          let totalQuality = 0;
          let count = 0;
          
          for (const segment of googleData.roofSegments) {
            const azimuth = segment.azimuth || 180; // Default south
            const pitch = segment.pitch || 25; // Default 25°
            
            // Azimuth factor: South (180°) = 1.0, East/West (90°/270°) = 0.85, North (0°/360°) = 0.6
            const azimuthNormalized = Math.abs(azimuth - 180) / 180; // 0 = south, 1 = north
            const azimuthFactor = 1.0 - (azimuthNormalized * 0.4);
            
            // Pitch factor: 30° = 1.0, 0° = 0.85, 60° = 0.90
            const pitchOptimal = 30;
            const pitchDeviation = Math.abs(pitch - pitchOptimal) / pitchOptimal;
            const pitchFactor = 1.0 - Math.min(0.15, pitchDeviation * 0.15);
            
            totalQuality += azimuthFactor * pitchFactor;
            count++;
          }
          
          // Clamp orientation factor to 0.6-1.0 range
          const avgQuality = count > 0 ? totalQuality / count : 1.0;
          mergedAssumptions.orientationFactor = Math.max(0.6, Math.min(1.0, avgQuality));
        }
      }

      // Run the analysis with merged assumptions (Google Solar + custom)
      // If forced sizing is provided, pass it to the analysis function
      const analysisResult = runPotentialAnalysis(readings, mergedAssumptions, {
        forcePvSize,
        forceBatterySize,
        forceBatteryPower,
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

      // Update site to mark analysis as available and save assumptions
      await storage.updateSite(siteId, { 
        analysisAvailable: true,
        analysisAssumptions: customAssumptions || null,
      });

      res.status(201).json(simulation);
    } catch (error) {
      console.error("Analysis error:", error);
      res.status(500).json({ error: "Internal server error" });
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

  app.post("/api/designs/:id/sync-zoho", authMiddleware, async (req, res) => {
    try {
      const designId = req.params.id;
      const design = await storage.getDesign(designId);
      
      if (!design) {
        return res.status(404).json({ error: "Design not found" });
      }

      // Get site and client info for the deal
      const simulation = await storage.getSimulationRun(design.simulationRunId);
      const site = simulation?.site;
      const client = site?.client;

      // Validate we have minimum required data
      const siteName = site?.name || "Site";
      const clientName = client?.name || "Client";

      // Prepare deal data
      const dealName = `${siteName} - Solar + Storage System`;
      const dealDescription = `
kWh Québec Solar + Storage Design

Site: ${siteName}
Client: ${clientName}
Location: ${site?.city || "N/A"}, ${site?.province || "QC"}

System Specifications:
- PV Capacity: ${design.pvSizeKW?.toFixed(1) || 0} kWc
- Battery: ${design.battEnergyKWh?.toFixed(0) || 0} kWh / ${design.battPowerKW?.toFixed(0) || 0} kW
- Module: ${design.moduleSku || "N/A"}
- Inverter: ${design.inverterSku || "N/A"}
- Battery Model: ${design.batterySku || "N/A"}

Pricing:
- Subtotal: ${design.subtotalDollars?.toLocaleString() || 0} $
- Margin: ${design.marginPercent?.toFixed(1) || 0}%
- Final Price: ${design.totalPriceDollars?.toLocaleString() || 0} $
      `.trim();

      let zohoDealId = design.zohoDealId;
      let zohoSyncResult: { success: boolean; error?: string; isMock?: boolean };

      if (zohoDealId) {
        // Update existing deal
        const updateResult = await zoho.updateDeal(zohoDealId, {
          dealName,
          amount: design.totalPriceDollars || 0,
          description: dealDescription,
          stage: "Proposal/Price Quote",
        });
        zohoSyncResult = { success: updateResult.success, error: updateResult.error, isMock: updateResult.isMock };
        
        if (updateResult.success) {
          console.log(`[Zoho] Updated deal: ${zohoDealId}`);
        }
      } else {
        // Create new deal
        const accountId = client?.zohoAccountId;
        const createResult = await zoho.createDeal({
          dealName,
          amount: design.totalPriceDollars || 0,
          description: dealDescription,
          stage: "Qualification",
          closingDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 60 days from now
        }, accountId && !accountId.startsWith("MOCK_") ? accountId : undefined);

        zohoSyncResult = { success: createResult.success, error: createResult.error, isMock: createResult.isMock };

        if (createResult.success && createResult.data) {
          zohoDealId = createResult.data;
          await storage.updateDesign(designId, { zohoDealId });
          console.log(`[Zoho] Created deal: ${zohoDealId}`);
        }
      }

      // Add a note to the deal with latest update (only for real Zoho IDs)
      if (zohoDealId && !zohoDealId.startsWith("MOCK_") && zohoSyncResult.success) {
        await zoho.addNote("Deals", zohoDealId, `Design updated via kWh Québec platform at ${new Date().toISOString()}`);
      }

      const updatedDesign = await storage.getDesign(designId);
      
      // Return design with sync status
      res.json({ 
        ...updatedDesign, 
        zohoSyncStatus: {
          synced: zohoSyncResult.success,
          error: zohoSyncResult.error,
          isMock: zohoSyncResult.isMock,
        }
      });
    } catch (error) {
      console.error("Zoho sync error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== ZOHO STATUS ROUTE ====================
  
  app.get("/api/zoho/status", authMiddleware, async (req, res) => {
    try {
      res.json({
        configured: zoho.isZohoConfigured(),
        message: zoho.isZohoConfigured() 
          ? "Zoho CRM integration is configured and active"
          : "Zoho CRM integration is running in mock mode (no credentials configured)",
      });
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
      const { siteVisitId, additionalFees = [], paymentTerms } = req.body;
      
      // Get the site visit for cost data
      const visit = siteVisitId ? await storage.getSiteVisit(siteVisitId) : null;
      const siteVisitCost = visit?.estimatedCost || null;
      
      // Calculate totals
      const additionalTotal = Array.isArray(additionalFees) 
        ? additionalFees.reduce((sum: number, fee: { amount: number }) => sum + (fee.amount || 0), 0) 
        : 0;
      const siteVisitTotal = (siteVisitCost as any)?.total || 0;
      const subtotal = siteVisitTotal + additionalTotal;
      
      // Calculate taxes (Quebec: 5% GST + 9.975% QST)
      const gst = subtotal * 0.05;
      const qst = subtotal * 0.09975;
      const total = subtotal + gst + qst;
      
      // Set validity (30 days from now)
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + 30);
      
      const quotedCosts = {
        siteVisit: siteVisitCost,
        additionalFees,
        subtotal,
        taxes: { gst, qst },
        total,
      };
      
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

function runPotentialAnalysis(
  readings: Array<{ kWh: number | null; kW: number | null; timestamp: Date }>,
  customAssumptions?: Partial<AnalysisAssumptions>,
  forcedSizing?: ForcedSizing
): AnalysisResult {
  // Merge custom assumptions with defaults
  const h: AnalysisAssumptions = { ...defaultAnalysisAssumptions, ...customAssumptions };
  
  // ========== STEP 1: Build 8760-hour simulation data ==========
  // Aggregate readings into hourly consumption and peak power (with interpolation for missing months)
  const { hourlyData, interpolatedMonths } = buildHourlyData(readings);
  
  // Calculate annual metrics from readings
  let totalKWh = 0;
  let peakKW = 0;
  
  for (const r of readings) {
    totalKWh += r.kWh || 0;
    const kw = r.kW || 0;
    if (kw > peakKW) peakKW = kw;
  }
  
  // Estimate annual values (if we have partial data)
  const dataSpanDays = readings.length > 0 
    ? (new Date(readings[readings.length - 1].timestamp).getTime() - new Date(readings[0].timestamp).getTime()) / (1000 * 60 * 60 * 24)
    : 365;
  const annualizationFactor = 365 / Math.max(dataSpanDays, 1);
  const annualConsumptionKWh = totalKWh * annualizationFactor;
  
  // ========== STEP 2: System sizing with roof constraint ==========
  const usableRoofSqFt = h.roofAreaSqFt * h.roofUtilizationRatio;
  const maxPVFromRoof = usableRoofSqFt / 100; // ~100 sq ft per kW
  
  // Target PV size based on consumption (120% of load coverage target)
  // Use configurable solar yield (default 1150 kWh/kWp, can be set from Google Solar data)
  let effectiveYield = (h.solarYieldKWhPerKWp || 1150) * (h.orientationFactor || 1.0);
  
  // Apply bifacial gain if enabled
  // Formula: rear gain = bifaciality × albedo × view_factor (0.35 for flat commercial roofs)
  // Typical boost: 8-15% for white membrane roofs
  if (h.bifacialEnabled) {
    const bifacialityFactor = h.bifacialityFactor || 0.85;
    const roofAlbedo = h.roofAlbedo || 0.70;
    const viewFactor = 0.35; // Conservative for flat commercial installations
    const bifacialBoost = 1 + (bifacialityFactor * roofAlbedo * viewFactor);
    effectiveYield = effectiveYield * bifacialBoost;
    console.log(`Bifacial enabled: ${(bifacialBoost - 1) * 100}% yield boost applied`);
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
  
  // Build Helioscope-inspired system modeling parameters
  const systemParams: SystemModelingParams = {
    inverterLoadRatio: h.inverterLoadRatio || 1.2,
    temperatureCoefficient: h.temperatureCoefficient || -0.004,
    wireLossPercent: h.wireLossPercent || 0.02,
  };
  
  const simResult = runHourlySimulation(hourlyData, pvSizeKW, battEnergyKWh, battPowerKW, demandShavingSetpointKW, yieldFactor, systemParams);
  
  // Extract metrics from simulation
  const selfConsumptionKWh = simResult.totalSelfConsumption;
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
  
  // ========== STEP 5: Calculate CAPEX ==========
  // Apply bifacial cost premium if enabled (typically 5-10 cents/W more)
  const effectiveSolarCostPerW = h.bifacialEnabled 
    ? h.solarCostPerW + (h.bifacialCostPremium || 0.10)
    : h.solarCostPerW;
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
    const revenue = annualSavings * degradationFactor * Math.pow(1 + h.inflationRate, y - 1);
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
    const optSimResult = runHourlySimulation(hourlyData, optPvSizeKW, optBattEnergyKWh, optBattPowerKW, optDemandShavingSetpointKW, yieldFactor, systemParams);
    
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
    
    // Apply bifacial cost premium if enabled (same as initial calculation)
    const optEffectiveSolarCostPerW = h.bifacialEnabled 
      ? h.solarCostPerW + (h.bifacialCostPremium || 0.10)
      : h.solarCostPerW;
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
    for (let y = 1; y <= h.analysisYears; y++) {
      // Apply panel degradation (production decreases each year)
      const degradationFactor = Math.pow(1 - optDegradationRate, y - 1);
      // Revenue = base savings * degradation * tariff inflation
      const revenue = optAnnualSavings * degradationFactor * Math.pow(1 + h.inflationRate, y - 1);
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
    let optEffectiveYield = (h.solarYieldKWhPerKWp || 1150) * (h.orientationFactor || 1.0);
    // Apply bifacial gain if enabled
    if (h.bifacialEnabled) {
      const bifacialityFactor = h.bifacialityFactor || 0.85;
      const roofAlbedo = h.roofAlbedo || 0.70;
      const viewFactor = 0.35;
      const bifacialBoost = 1 + (bifacialityFactor * roofAlbedo * viewFactor);
      optEffectiveYield = optEffectiveYield * bifacialBoost;
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
      const finalSimResult = runHourlySimulation(hourlyData, finalPvSizeKW, finalBattEnergyKWh, finalBattPowerKW, optDemandShavingSetpointKW, yieldFactor, systemParams);
      
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
      const finalOpexBase = (finalPvSizeKW * 1000 * h.solarCostPerW) * 0.01; // 1% of solar CAPEX
      const finalTotalLifetimeCost = trueOptCapexNet + (finalOpexBase * h.analysisYears);
      const finalLcoe = finalTotalProduction > 0 ? finalTotalLifetimeCost / finalTotalProduction : 0;
      
      // Calculate CO2 avoided
      const co2Factor = 0.002; // kg CO2/kWh for Quebec grid
      const finalCo2AvoidedTonnesPerYear = (finalSimResult.totalSelfConsumption * co2Factor) / 1000;
      
      // Calculate annual savings
      const finalAnnualSavings = finalSimResult.totalSelfConsumption * h.tariffEnergy + (peakKW - finalSimResult.peakAfter) * h.tariffPower * 12;
      
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
        annualCostBefore,
        annualCostAfter: annualCostBefore - finalAnnualSavings,
        annualSavings: finalAnnualSavings,
        savingsYear1: finalAnnualSavings,
        capexGross: (finalPvSizeKW * 1000 * h.solarCostPerW) + (finalBattEnergyKWh * h.batteryCapacityCost + finalBattPowerKW * h.batteryPowerCost),
        capexPV: finalPvSizeKW * 1000 * h.solarCostPerW,
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
        breakdown: optBreakdown,
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
  wireLossPercent: number;        // DC wiring losses - default 0.02
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
  systemParams: SystemModelingParams = { inverterLoadRatio: 1.2, temperatureCoefficient: -0.004, wireLossPercent: 0.02 }
): {
  totalSelfConsumption: number;
  peakAfter: number;
  hourlyProfile: HourlyProfileEntry[];
  peakWeekData: PeakWeekEntry[];
  clippingLossKWh: number; // Total energy lost to inverter clipping
} {
  const hourlyProfile: HourlyProfileEntry[] = [];
  let soc = battEnergyKWh * 0.5; // Start at 50% SOC
  let totalSelfConsumption = 0;
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
    // Base capacity factor 0.75 produces ~1150 kWh/kWp/year, adjusted by solarYieldFactor
    const bell = Math.exp(-Math.pow(hour - 13, 2) / 8);
    const season = 1 - 0.4 * Math.cos((month - 6) * 2 * Math.PI / 12);
    const isDaytime = hour >= 5 && hour <= 20;
    
    // Helioscope-inspired temperature correction
    // Cell temp is ~25-30°C above ambient; compare to STC (25°C cell temp)
    // Temperature effect: colder = higher output, hotter = lower output
    const ambientTemp = QUEBEC_MONTHLY_TEMPS[month - 1] || 10;
    // Estimate cell temperature: ambient + 25°C during peak production, less at night/low production
    const cellTempRise = 25 * bell; // Max 25°C rise at peak production
    const cellTemp = ambientTemp + cellTempRise;
    const stcCellTemp = 25; // STC reference
    // Temperature correction: negative coefficient means higher output when cold
    const tempCorrectionFactor = 1 + systemParams.temperatureCoefficient * (cellTemp - stcCellTemp);
    
    // Apply solarYieldFactor to scale production (1.0 = baseline 1150 kWh/kWp/year)
    let dcProduction = pvSizeKW * bell * season * 0.75 * solarYieldFactor * (isDaytime ? 1 : 0);
    
    // Apply temperature correction
    dcProduction *= tempCorrectionFactor;
    
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
    
    // Self-consumption
    const discharge = battAction < 0 ? -battAction : 0;
    const selfCons = Math.min(consumption, production + discharge);
    totalSelfConsumption += selfCons;
    
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
} {
  const h = assumptions;
  
  // Run simulation with specified sizes
  // Calculate yield factor relative to baseline (1150 kWh/kWp = 1.0)
  let effectiveYield = (h.solarYieldKWhPerKWp || 1150) * (h.orientationFactor || 1.0);
  
  // Apply bifacial gain if enabled
  if (h.bifacialEnabled) {
    const bifacialityFactor = h.bifacialityFactor || 0.85;
    const roofAlbedo = h.roofAlbedo || 0.70;
    const viewFactor = 0.35;
    const bifacialBoost = 1 + (bifacialityFactor * roofAlbedo * viewFactor);
    effectiveYield = effectiveYield * bifacialBoost;
  }
  
  const yieldFactor = effectiveYield / 1150;
  const demandShavingSetpointKW = battPowerKW > 0 ? Math.round(peakKW * 0.90) : peakKW;
  
  // Build Helioscope-inspired system modeling parameters
  const systemParams: SystemModelingParams = {
    inverterLoadRatio: h.inverterLoadRatio || 1.2,
    temperatureCoefficient: h.temperatureCoefficient || -0.004,
    wireLossPercent: h.wireLossPercent || 0.02,
  };
  
  const simResult = runHourlySimulation(hourlyData, pvSizeKW, battEnergyKWh, battPowerKW, demandShavingSetpointKW, yieldFactor, systemParams);
  
  // Calculate savings
  const selfConsumptionKWh = simResult.totalSelfConsumption;
  const peakAfterKW = simResult.peakAfter;
  const annualDemandReductionKW = peakKW - peakAfterKW;
  
  const annualCostBefore = annualConsumptionKWh * h.tariffEnergy + peakKW * h.tariffPower * 12;
  const energySavings = selfConsumptionKWh * h.tariffEnergy;
  const demandSavings = annualDemandReductionKW * h.tariffPower * 12;
  const annualSavings = energySavings + demandSavings;
  
  // CAPEX - apply bifacial cost premium if enabled
  const effectiveSolarCostPerW = h.bifacialEnabled 
    ? h.solarCostPerW + (h.bifacialCostPremium || 0.10)
    : h.solarCostPerW;
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
      cashflows: [] 
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
    const revenue = annualSavings * degradationFactor * Math.pow(1 + h.inflationRate, y - 1);
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
  
  return { 
    npv25, npv10, npv20, 
    capexNet, 
    irr25, irr10, irr20,
    incentivesHQ, incentivesHQSolar, incentivesHQBattery, 
    incentivesFederal, taxShield, 
    cashflows 
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
      isOptimal: false, // Will be determined later
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
  
  // Find optimal scenario
  let optimalId: string | null = null;
  let maxNpv = -Infinity;
  for (const point of frontier) {
    if (point.npv25 > maxNpv) {
      maxNpv = point.npv25;
      optimalId = point.id;
    }
  }
  
  // Mark optimal
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
  
  return {
    frontier,
    solarSweep,
    batterySweep,
    optimalScenarioId: optimalId,
  };
}
