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
          roofEstimateError: "No address provided"
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
    });

    console.log(`Roof estimation success for site ${siteId}: ${result.roofAreaSqM.toFixed(1)} m²`);
  } catch (error) {
    console.error(`Roof estimation error for site ${siteId}:`, error);
    await storage.updateSite(siteId, {
      roofEstimateStatus: "failed",
      roofEstimateError: error instanceof Error ? error.message : "Unknown error"
    });
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
        const nameParts = (parsed.data.name || "").split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "-";
        
        const zohoResult = await zoho.createLead({
          firstName,
          lastName,
          email: parsed.data.email,
          phone: parsed.data.phone || undefined,
          company: parsed.data.company || undefined,
          description: parsed.data.message || undefined,
          source: "Website - kWh Québec",
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
      
      res.status(201).json({ ...lead, zohoSyncStatus });
    } catch (error) {
      console.error("Create lead error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

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
        // Mark as pending and trigger async estimation
        await storage.updateSite(site.id, { roofEstimateStatus: "pending" });
        
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

  app.post("/api/sites/:id/roof-estimate", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const siteId = req.params.id;
      
      const site = await storage.getSite(siteId);
      if (!site) {
        return res.status(404).json({ error: "Site not found" });
      }

      if (!googleSolar.isGoogleSolarConfigured()) {
        return res.status(503).json({ error: "Google Solar API not configured" });
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
          return res.status(400).json({ error: "Site address is required for roof estimation" });
        }

        result = await googleSolar.estimateRoofFromAddress(fullAddress);
      }

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
      const analysisResult = runPotentialAnalysis(readings, mergedAssumptions);
      
      // Create simulation run with assumptions stored
      const simulation = await storage.createSimulationRun({
        siteId,
        label: `Analyse ${new Date().toLocaleDateString("fr-CA")}`,
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

      const doc = new PDFDocument({ size: "LETTER", margin: 50 });
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="etude-solaire-stockage-${simulation.site.name.replace(/\s+/g, '-')}.pdf"`);
      
      doc.pipe(res);

      // Use the professional PDF generator
      const { generateProfessionalPDF } = await import("./pdfGenerator");
      generateProfessionalPDF(doc, simulation as any, lang);

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

function runPotentialAnalysis(
  readings: Array<{ kWh: number | null; kW: number | null; timestamp: Date }>,
  customAssumptions?: Partial<AnalysisAssumptions>
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
  const effectiveYield = (h.solarYieldKWhPerKWp || 1150) * (h.orientationFactor || 1.0);
  const targetPVSize = (annualConsumptionKWh / effectiveYield) * 1.2;
  const pvSizeKW = Math.min(Math.round(targetPVSize), Math.round(maxPVFromRoof));
  
  // Battery sizing
  const battPowerKW = Math.round(peakKW * 0.3); // 30% of peak for shaving
  const battEnergyKWh = Math.round(battPowerKW * 2); // 2-hour duration
  const demandShavingSetpointKW = Math.round(peakKW * 0.90); // Target 10% peak reduction
  
  // ========== STEP 3: Run hourly simulation ==========
  // Calculate yield factor relative to baseline (1150 kWh/kWp = 1.0)
  const yieldFactor = effectiveYield / 1150;
  const simResult = runHourlySimulation(hourlyData, pvSizeKW, battEnergyKWh, battPowerKW, demandShavingSetpointKW, yieldFactor);
  
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
  const capexPV = pvSizeKW * 1000 * h.solarCostPerW;
  const capexBattery = battEnergyKWh * h.batteryCapacityCost + battPowerKW * h.batteryPowerCost;
  const capexGross = capexPV + capexBattery;
  
  // ========== STEP 6: Calculate Quebec (HQ) incentives ==========
  // Hydro-Québec: $1000/kW for solar, $300/kW for battery, capped at 40% of total CAPEX
  const potentialHQSolar = pvSizeKW * 1000;
  const potentialHQBattery = battPowerKW * 300;
  const totalPotentialHQ = potentialHQSolar + potentialHQBattery;
  const cap40Percent = capexGross * 0.40;
  const totalHQ = Math.min(totalPotentialHQ, cap40Percent);
  
  // Distribute HQ incentive proportionally
  let incentivesHQSolar = 0;
  let incentivesHQBattery = 0;
  if (totalPotentialHQ > 0) {
    const solarRatio = potentialHQSolar / totalPotentialHQ;
    incentivesHQSolar = totalHQ * solarRatio;
    incentivesHQBattery = totalHQ * (1 - solarRatio);
  }
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
  for (let y = 1; y <= h.analysisYears; y++) {
    const revenue = annualSavings * Math.pow(1 + h.inflationRate, y - 1);
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
  
  // LCOE (Levelized Cost of Energy)
  const totalProduction = pvSizeKW * effectiveYield * h.analysisYears; // kWh over lifetime
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
  const sensitivity = runSensitivityAnalysis(
    hourlyData,
    pvSizeKW,
    battEnergyKWh,
    battPowerKW,
    peakKW,
    annualConsumptionKWh,
    h
  );
  
  // ========== STEP 15: Find optimal scenario and recalculate if better ==========
  // The sensitivity analysis explores many scenarios - use the best one
  const optimalScenario = sensitivity.frontier.find(p => p.isOptimal);
  
  // If the optimal scenario has better NPV than our initial calculation, use its sizing
  if (optimalScenario && optimalScenario.npv25 > npv25) {
    // Recalculate with optimal sizing
    const optPvSizeKW = optimalScenario.pvSizeKW;
    const optBattEnergyKWh = optimalScenario.battEnergyKWh;
    const optBattPowerKW = optimalScenario.battPowerKW;
    const optDemandShavingSetpointKW = Math.round(peakKW * 0.90);
    
    // Run simulation with optimal sizing
    const optSimResult = runHourlySimulation(hourlyData, optPvSizeKW, optBattEnergyKWh, optBattPowerKW, optDemandShavingSetpointKW, yieldFactor);
    
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
    
    const optCapexPV = optPvSizeKW * 1000 * h.solarCostPerW;
    const optCapexBattery = optBattEnergyKWh * h.batteryCapacityCost + optBattPowerKW * h.batteryPowerCost;
    const optCapexGross = optCapexPV + optCapexBattery;
    
    // HQ incentives for optimal sizing
    const optPotentialHQSolar = optPvSizeKW * 1000;
    const optPotentialHQBattery = optBattPowerKW * 300;
    const optTotalPotentialHQ = optPotentialHQSolar + optPotentialHQBattery;
    const optCap40Percent = optCapexGross * 0.40;
    const optTotalHQ = Math.min(optTotalPotentialHQ, optCap40Percent);
    
    let optIncentivesHQSolar = 0;
    let optIncentivesHQBattery = 0;
    if (optTotalPotentialHQ > 0) {
      const solarRatio = optPotentialHQSolar / optTotalPotentialHQ;
      optIncentivesHQSolar = optTotalHQ * solarRatio;
      optIncentivesHQBattery = optTotalHQ * (1 - solarRatio);
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
    for (let y = 1; y <= h.analysisYears; y++) {
      const revenue = optAnnualSavings * Math.pow(1 + h.inflationRate, y - 1);
      const opex = optOpexBase * Math.pow(1 + h.omEscalation, y - 1);
      const ebitda = revenue - opex;
      
      const dpaRate = y <= 5 ? 0.30 : (y <= 10 ? 0.15 : 0.05);
      const dpa = optCapexNetAccounting * dpaRate * h.taxRate;
      
      let investment = 0;
      let incentives = 0;
      if (y === 1) {
        incentives = optBatterySubY1 + optIncentivesFederal;
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
    
    // LCOE
    const optEffectiveYield = (h.solarYieldKWhPerKWp || 1150) * (h.orientationFactor || 1.0);
    const optTotalProduction = optPvSizeKW * optEffectiveYield * h.analysisYears;
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
      sensitivity,
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

// Run hourly solar + battery simulation
function runHourlySimulation(
  hourlyData: Array<{ hour: number; month: number; consumption: number; peak: number }>,
  pvSizeKW: number,
  battEnergyKWh: number,
  battPowerKW: number,
  threshold: number,
  solarYieldFactor: number = 1.0 // Multiplier to adjust production (1.0 = default 1150 kWh/kWp)
): {
  totalSelfConsumption: number;
  peakAfter: number;
  hourlyProfile: HourlyProfileEntry[];
  peakWeekData: PeakWeekEntry[];
} {
  const hourlyProfile: HourlyProfileEntry[] = [];
  let soc = battEnergyKWh * 0.5; // Start at 50% SOC
  let totalSelfConsumption = 0;
  let peakAfter = 0;
  let maxPeakIndex = 0;
  let maxPeakValue = 0;
  
  // Guard for empty data
  if (hourlyData.length === 0) {
    return {
      totalSelfConsumption: 0,
      peakAfter: 0,
      hourlyProfile: [],
      peakWeekData: [],
    };
  }
  
  for (let i = 0; i < hourlyData.length; i++) {
    const { hour, month, consumption, peak } = hourlyData[i];
    
    // Solar production: Gaussian curve centered at 1pm, with seasonal factor
    // Base capacity factor 0.75 produces ~1150 kWh/kWp/year, adjusted by solarYieldFactor
    const bell = Math.exp(-Math.pow(hour - 13, 2) / 8);
    const season = 1 - 0.4 * Math.cos((month - 6) * 2 * Math.PI / 12);
    const isDaytime = hour >= 5 && hour <= 20;
    // Apply solarYieldFactor to scale production (1.0 = baseline 1150 kWh/kWp/year)
    const rawProduction = pvSizeKW * bell * season * 0.75 * solarYieldFactor * (isDaytime ? 1 : 0);
    const production = Math.max(0, rawProduction);
    
    // Net load (consumption - production)
    const net = consumption - production;
    
    // Battery algorithm (peak shaving)
    let battAction = 0;
    const peakBefore = peak;
    let peakFinal = peak;
    
    if (battPowerKW > 0 && battEnergyKWh > 0) {
      if (peak > threshold && soc > 0) {
        // Discharge to shave peak
        battAction = -Math.min(peak - threshold, battPowerKW, soc);
      } else if (net < 0 && soc < battEnergyKWh) {
        // Charge from excess solar
        battAction = Math.min(Math.abs(net), battPowerKW, battEnergyKWh - soc);
      } else if (hour >= 22 && soc < battEnergyKWh) {
        // Night charging
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
): { npv25: number; capexNet: number; irr25: number } {
  const h = assumptions;
  
  // Run simulation with specified sizes
  // Calculate yield factor relative to baseline (1150 kWh/kWp = 1.0)
  const effectiveYield = (h.solarYieldKWhPerKWp || 1150) * (h.orientationFactor || 1.0);
  const yieldFactor = effectiveYield / 1150;
  const demandShavingSetpointKW = battPowerKW > 0 ? Math.round(peakKW * 0.90) : peakKW;
  const simResult = runHourlySimulation(hourlyData, pvSizeKW, battEnergyKWh, battPowerKW, demandShavingSetpointKW, yieldFactor);
  
  // Calculate savings
  const selfConsumptionKWh = simResult.totalSelfConsumption;
  const peakAfterKW = simResult.peakAfter;
  const annualDemandReductionKW = peakKW - peakAfterKW;
  
  const annualCostBefore = annualConsumptionKWh * h.tariffEnergy + peakKW * h.tariffPower * 12;
  const energySavings = selfConsumptionKWh * h.tariffEnergy;
  const demandSavings = annualDemandReductionKW * h.tariffPower * 12;
  const annualSavings = energySavings + demandSavings;
  
  // CAPEX
  const capexPV = pvSizeKW * 1000 * h.solarCostPerW;
  const capexBattery = battEnergyKWh * h.batteryCapacityCost + battPowerKW * h.batteryPowerCost;
  const capexGross = capexPV + capexBattery;
  
  if (capexGross === 0) {
    return { npv25: 0, capexNet: 0, irr25: 0 };
  }
  
  // HQ incentives
  const potentialHQSolar = pvSizeKW * 1000;
  const potentialHQBattery = battPowerKW * 300;
  const totalPotentialHQ = potentialHQSolar + potentialHQBattery;
  const cap40Percent = capexGross * 0.40;
  const totalHQ = Math.min(totalPotentialHQ, cap40Percent);
  
  let incentivesHQSolar = 0;
  let incentivesHQBattery = 0;
  if (totalPotentialHQ > 0) {
    const solarRatio = potentialHQSolar / totalPotentialHQ;
    incentivesHQSolar = totalHQ * solarRatio;
    incentivesHQBattery = totalHQ * (1 - solarRatio);
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
  
  for (let y = 1; y <= h.analysisYears; y++) {
    const revenue = annualSavings * Math.pow(1 + h.inflationRate, y - 1);
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
  const irr25 = calculateIRR(cashflowValues.slice(0, 26));
  
  return { npv25, capexNet, irr25 };
}

// Generate sensitivity analysis with multiple scenarios
function runSensitivityAnalysis(
  hourlyData: Array<{ hour: number; month: number; consumption: number; peak: number }>,
  optimalPvSizeKW: number,
  optimalBattEnergyKWh: number,
  optimalBattPowerKW: number,
  peakKW: number,
  annualConsumptionKWh: number,
  assumptions: AnalysisAssumptions
): SensitivityAnalysis {
  const frontier: FrontierPoint[] = [];
  const solarSweep: SolarSweepPoint[] = [];
  const batterySweep: BatterySweepPoint[] = [];
  
  // Calculate max roof capacity for solar sweep
  const usableRoofSqFt = assumptions.roofAreaSqFt * assumptions.roofUtilizationRatio;
  const maxPVFromRoof = Math.round(usableRoofSqFt / 100);
  
  // Solar sweep: 0 to max PV capacity in ~10 steps, with optimal battery
  const solarSteps = 10;
  const solarMax = Math.max(optimalPvSizeKW * 1.5, maxPVFromRoof);
  const solarStep = Math.max(10, Math.round(solarMax / solarSteps / 10) * 10);
  
  for (let pvSize = 0; pvSize <= solarMax; pvSize += solarStep) {
    const result = runScenarioWithSizing(
      hourlyData, pvSize, optimalBattEnergyKWh, optimalBattPowerKW,
      peakKW, annualConsumptionKWh, assumptions
    );
    solarSweep.push({ pvSizeKW: pvSize, npv25: result.npv25 });
    
    // Add to frontier as hybrid if battery > 0
    if (pvSize > 0 && optimalBattEnergyKWh > 0) {
      frontier.push({
        id: `hybrid-pv${pvSize}`,
        type: 'hybrid',
        label: `${pvSize}kW PV + ${optimalBattEnergyKWh}kWh`,
        pvSizeKW: pvSize,
        battEnergyKWh: optimalBattEnergyKWh,
        battPowerKW: optimalBattPowerKW,
        capexNet: result.capexNet,
        npv25: result.npv25,
        isOptimal: pvSize === optimalPvSizeKW,
      });
    }
  }
  
  // Battery sweep: 0 to 200% of optimal battery in ~10 steps, with optimal PV
  // Shows how battery sizing affects the hybrid (PV+battery) system economics
  const batterySteps = 10;
  const batteryMax = Math.max(optimalBattEnergyKWh * 2, 500);
  const batteryStep = Math.max(20, Math.round(batteryMax / batterySteps / 10) * 10);
  
  for (let battSize = 0; battSize <= batteryMax; battSize += batteryStep) {
    const battPower = Math.round(battSize / 2); // 2-hour duration
    const result = runScenarioWithSizing(
      hourlyData, optimalPvSizeKW, battSize, battPower,
      peakKW, annualConsumptionKWh, assumptions
    );
    batterySweep.push({ battEnergyKWh: battSize, npv25: result.npv25 });
    
    // Add to frontier as hybrid
    if (battSize > 0 && optimalPvSizeKW > 0) {
      frontier.push({
        id: `hybrid-batt${battSize}`,
        type: 'hybrid',
        label: `${optimalPvSizeKW}kW PV + ${battSize}kWh`,
        pvSizeKW: optimalPvSizeKW,
        battEnergyKWh: battSize,
        battPowerKW: battPower,
        capexNet: result.capexNet,
        npv25: result.npv25,
        isOptimal: battSize === optimalBattEnergyKWh,
      });
    }
  }
  
  // Solar-only scenarios (no battery)
  for (let pvSize = solarStep; pvSize <= solarMax; pvSize += solarStep) {
    const result = runScenarioWithSizing(
      hourlyData, pvSize, 0, 0,
      peakKW, annualConsumptionKWh, assumptions
    );
    frontier.push({
      id: `solar-${pvSize}`,
      type: 'solar',
      label: `${pvSize}kW PV seul`,
      pvSizeKW: pvSize,
      battEnergyKWh: 0,
      battPowerKW: 0,
      capexNet: result.capexNet,
      npv25: result.npv25,
      isOptimal: false,
    });
  }
  
  // Battery-only scenarios (no PV) - typically negative NPV
  for (let battSize = batteryStep; battSize <= batteryMax; battSize += batteryStep * 2) {
    const battPower = Math.round(battSize / 2);
    const result = runScenarioWithSizing(
      hourlyData, 0, battSize, battPower,
      peakKW, annualConsumptionKWh, assumptions
    );
    frontier.push({
      id: `battery-${battSize}`,
      type: 'battery',
      label: `${battSize}kWh batterie seule`,
      pvSizeKW: 0,
      battEnergyKWh: battSize,
      battPowerKW: battPower,
      capexNet: result.capexNet,
      npv25: result.npv25,
      isOptimal: false,
    });
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
