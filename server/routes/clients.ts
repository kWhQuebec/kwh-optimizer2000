import { Router, Response } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { authMiddleware, requireStaff, AuthRequest } from "../middleware/auth";
import { storage } from "../storage";
import { insertClientSchema } from "@shared/schema";
import { sendEmail, generatePortalInvitationEmail } from "../gmail";
import { sendHqProcurationEmail } from "../emailService";

const router = Router();

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

const grantPortalAccessSchema = z.object({
  email: z.string().email("Invalid email format").transform(e => e.toLowerCase().trim()),
  contactName: z.string().optional().default(""),
  language: z.enum(["fr", "en"]).default("fr"),
  customMessage: z.string().optional().default(""),
});

router.post("/api/clients/:clientId/grant-portal-access", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    
    const parseResult = grantPortalAccessSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: "Validation error", 
        details: parseResult.error.errors 
      });
    }
    
    const { email, contactName, language, customMessage } = parseResult.data;
    
    const client = await storage.getClient(clientId);
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }
    
    const existingUser = await storage.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: "A user with this email already exists" });
    }
    
    const tempPassword = generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    
    const user = await storage.createUser({
      email,
      passwordHash: hashedPassword,
      name: contactName || null,
      role: 'client',
      clientId: clientId,
    });
    
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const host = req.get('host') || 'localhost:5000';
    const portalUrl = `${protocol}://${host}/login`;
    
    const emailContent = generatePortalInvitationEmail({
      clientName: client.name,
      contactName: contactName || email.split('@')[0],
      email,
      tempPassword,
      portalUrl,
      language: language as 'fr' | 'en',
    });
    
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
    
    const emailResult = await sendEmail({
      to: email,
      subject: emailContent.subject,
      htmlBody: finalHtmlBody,
      textBody: finalTextBody,
    });
    
    if (!emailResult.success) {
      console.error(`[Portal Access] Email failed for user ${user.email} (client: ${client.name}): ${emailResult.error}`);
      console.warn(`[Portal Access] Temporary password was generated but email not delivered. Manual credential sharing required.`);
      
      return res.status(201).json({
        success: true,
        user: { id: user.id, email: user.email, name: user.name },
        emailSent: false,
        emailError: emailResult.error,
        tempPassword,
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

const sendHqProcurationSchema = z.object({
  language: z.enum(["fr", "en"]).default("fr"),
});

router.post("/api/clients/:clientId/send-hq-procuration", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    
    const parseResult = sendHqProcurationSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: "Validation error", 
        details: parseResult.error.errors 
      });
    }
    
    const { language } = parseResult.data;
    
    const client = await storage.getClient(clientId);
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }
    
    if (!client.email) {
      return res.status(400).json({ 
        error: language === 'fr' 
          ? "Ce client n'a pas d'adresse courriel" 
          : "This client has no email address" 
      });
    }
    
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const host = req.get('host') || 'localhost:5000';
    const baseUrl = `${protocol}://${host}`;
    
    const emailResult = await sendHqProcurationEmail(
      client.email,
      client.name,
      language,
      baseUrl
    );
    
    if (!emailResult.success) {
      console.error(`[HQ Procuration] Email failed for client ${client.name}: ${emailResult.error}`);
      return res.status(500).json({
        success: false,
        error: language === 'fr' 
          ? "L'envoi du courriel a échoué. Veuillez réessayer."
          : "Email delivery failed. Please try again.",
      });
    }
    
    console.log(`[HQ Procuration] Successfully sent procuration email to ${client.email} for client ${client.name}`);
    
    res.json({
      success: true,
    });
  } catch (error: any) {
    console.error("Send HQ procuration error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

router.get("/api/clients/list", authMiddleware, requireStaff, async (req, res) => {
  try {
    const { limit, offset, search } = req.query;
    
    const limitNum = limit ? parseInt(limit as string, 10) : 50;
    const offsetNum = offset ? parseInt(offset as string, 10) : 0;
    const searchStr = search && typeof search === "string" ? search : undefined;
    
    const result = await storage.getClientsPaginated({
      limit: limitNum,
      offset: offsetNum,
      search: searchStr,
    });
    
    res.json(result);
  } catch (error) {
    console.error("Error fetching clients list:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/clients", authMiddleware, requireStaff, async (req, res) => {
  try {
    const clients = await storage.getClients();
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/clients/:id", authMiddleware, requireStaff, async (req, res) => {
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

router.get("/api/clients/:id/sites", authMiddleware, requireStaff, async (req, res) => {
  try {
    const sites = await storage.getSitesByClient(req.params.id);
    res.json(sites);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/clients", authMiddleware, requireStaff, async (req, res) => {
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

router.patch("/api/clients/:id", authMiddleware, requireStaff, async (req, res) => {
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

router.delete("/api/clients/:id", authMiddleware, requireStaff, async (req, res) => {
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

export default router;
