import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { authMiddleware, requireStaff } from "../middleware/auth";
import { asyncHandler, NotFoundError, BadRequestError, ConflictError, ValidationError } from "../middleware/errorHandler";
import { storage } from "../storage";
import { insertClientSchema } from "@shared/schema";
import { generatePortalInvitationEmail } from "../gmail";
import { sendEmail, sendHqProcurationEmail, sendProcurationNotificationToAccountManager } from "../emailService";
import { generateSecurePassword } from "../lib/secureRandom";
import { createLogger } from "../lib/logger";

const log = createLogger("Clients");
const router = Router();

const grantPortalAccessSchema = z.object({
  email: z.string().email("Invalid email format").transform(e => e.toLowerCase().trim()),
  contactName: z.string().optional().default(""),
  language: z.enum(["fr", "en"]).default("fr"),
  customMessage: z.string().optional().default(""),
});

router.post("/api/clients/:clientId/grant-portal-access", authMiddleware, requireStaff, asyncHandler(async (req, res) => {
  const { clientId } = req.params;
  
  const parseResult = grantPortalAccessSchema.safeParse(req.body);
  if (!parseResult.success) {
    throw new ValidationError("Validation error", parseResult.error.errors);
  }
  
  const { email, contactName, language, customMessage } = parseResult.data;
  
  const client = await storage.getClient(clientId);
  if (!client) {
    throw new NotFoundError("Client");
  }
  
  let user;
  let isResend = false;
  const existingUser = await storage.getUserByEmail(email);
  
  if (existingUser) {
    if (existingUser.role !== 'client') {
      throw new BadRequestError(
        language === 'fr' 
          ? "Ce courriel est utilise par un compte analyste ou administrateur."
          : "This email is used by an analyst or admin account."
      );
    }
    if (existingUser.clientId && existingUser.clientId !== clientId) {
      throw new BadRequestError(
        language === 'fr'
          ? "Ce courriel est deja associe a un autre client."
          : "This email is already associated with another client."
      );
    }
    isResend = true;
    user = existingUser;
  }
  
  const tempPassword = generateSecurePassword();
  const hashedPassword = await bcrypt.hash(tempPassword, 10);
  
  if (isResend && user) {
    await storage.updateUser(user.id, {
      passwordHash: hashedPassword,
      name: contactName || user.name,
      clientId: clientId,
      mustChangePassword: true,
    });
  } else {
    user = await storage.createUser({
      email,
      passwordHash: hashedPassword,
      name: contactName || null,
      role: 'client',
      clientId: clientId,
    });
  }
  
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
    replyTo: client.accountManagerEmail || undefined,
  });
  
  if (!emailResult.success) {
    log.error(`Email failed for user ${user.email} (client: ${client.name}): ${emailResult.error}`);
    log.warn(`Temporary password was generated but email not delivered. Manual credential sharing required.`);
    
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
  
  log.info(`Successfully ${isResend ? 'resent invitation' : 'created account and sent invitation'} to ${user!.email} for client ${client.name}`);
  
  res.status(isResend ? 200 : 201).json({
    success: true,
    user: { id: user!.id, email: user!.email, name: user!.name },
    emailSent: true,
    messageId: emailResult.messageId,
    isResend,
  });
}));

const sendHqProcurationSchema = z.object({
  language: z.enum(["fr", "en"]).default("fr"),
});

router.post("/api/clients/:clientId/send-hq-procuration", authMiddleware, requireStaff, asyncHandler(async (req, res) => {
  const { clientId } = req.params;
  
  const parseResult = sendHqProcurationSchema.safeParse(req.body);
  if (!parseResult.success) {
    throw new ValidationError("Validation error", parseResult.error.errors);
  }
  
  const { language } = parseResult.data;
  
  const client = await storage.getClient(clientId);
  if (!client) {
    throw new NotFoundError("Client");
  }
  
  if (!client.email) {
    throw new BadRequestError(
      language === 'fr' 
        ? "Ce client n'a pas d'adresse courriel" 
        : "This client has no email address"
    );
  }
  
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const host = req.get('host') || 'localhost:5000';
  const baseUrl = `${protocol}://${host}`;
  
  const emailResult = await sendHqProcurationEmail(
    client.email,
    client.name,
    language,
    baseUrl,
    clientId
  );
  
  if (!emailResult.success) {
    log.error(`Email failed for client ${client.name}: ${emailResult.error}`);
    throw new BadRequestError(
      language === 'fr' 
        ? "L'envoi du courriel a échoué. Veuillez réessayer."
        : "Email delivery failed. Please try again."
    );
  }
  
  log.info(`Successfully sent procuration email to ${client.email} for client ${client.name}`);
  
  // Note: Notification to account manager is sent when client COMPLETES the procuration, not when request is sent
  
  res.json({ success: true });
}));

router.get("/api/clients/list", authMiddleware, requireStaff, asyncHandler(async (req, res) => {
  const { limit, offset, search, includeArchived, sortBy } = req.query;
  
  const limitNum = limit ? parseInt(limit as string, 10) : 50;
  const offsetNum = offset ? parseInt(offset as string, 10) : 0;
  const searchStr = search && typeof search === "string" ? search : undefined;
  const showArchived = includeArchived === "true";
  
  const result = await storage.getClientsPaginated({
    limit: limitNum,
    offset: offsetNum,
    search: searchStr,
    includeArchived: showArchived,
    sortBy: typeof sortBy === "string" ? sortBy : undefined,
  });
  
  res.json(result);
}));

router.get("/api/clients", authMiddleware, requireStaff, asyncHandler(async (req, res) => {
  const { limit, offset, search, includeArchived } = req.query;
  
  // Use paginated method for better performance
  const result = await storage.getClientsPaginated({
    limit: limit ? parseInt(limit as string, 10) : 50,
    offset: offset ? parseInt(offset as string, 10) : 0,
    search: search as string | undefined,
    includeArchived: includeArchived === 'true',
  });
  
  res.json(result);
}));

router.get("/api/clients/:id", authMiddleware, requireStaff, asyncHandler(async (req, res) => {
  const client = await storage.getClient(req.params.id);
  if (!client) {
    throw new NotFoundError("Client");
  }
  res.json(client);
}));

router.get("/api/clients/:id/sites", authMiddleware, requireStaff, asyncHandler(async (req, res) => {
  const sites = await storage.getSitesByClient(req.params.id);
  res.json(sites);
}));

router.get("/api/clients/:id/procurations", authMiddleware, requireStaff, asyncHandler(async (req, res) => {
  const procurations = await storage.getProcurationSignaturesByClient(req.params.id);
  res.json(procurations);
}));

router.get("/api/clients/:id/hq-bills", authMiddleware, requireStaff, asyncHandler(async (req, res) => {
  const bills = await storage.getHQBillsByClient(req.params.id);
  res.json(bills);
}));

// Get all documents for a client (HQ bills from filesystem + procurations)
router.get("/api/clients/:id/documents", authMiddleware, requireStaff, asyncHandler(async (req, res) => {
  const clientId = req.params.id;
  
  interface DocumentItem {
    id: string;
    type: 'hq_bill' | 'procuration';
    name: string;
    downloadPath: string;
    uploadedAt: string | null;
    metadata?: Record<string, string>;
  }
  
  const documents: DocumentItem[] = [];
  
  // 1. Scan uploads/bills/{clientId} folder for HQ bills
  const billsDir = path.join(process.cwd(), 'uploads', 'bills', clientId);
  if (fs.existsSync(billsDir)) {
    const files = fs.readdirSync(billsDir);
    for (const file of files) {
      if (file.endsWith('.pdf') || file.endsWith('.PDF')) {
        const filePath = path.join(billsDir, file);
        const stats = fs.statSync(filePath);
        documents.push({
          id: `bill-${Buffer.from(file).toString('base64').replace(/[/+=]/g, '_')}`,
          type: 'hq_bill',
          name: file,
          downloadPath: `uploads/bills/${clientId}/${file}`,
          uploadedAt: stats.mtime.toISOString(),
        });
      }
    }
  }
  
  // 2. Get procurations from database
  const procurations = await storage.getProcurationSignatures();
  const clientProcurations = procurations.filter(p => p.clientId === clientId && p.status === 'signed');
  
  for (const proc of clientProcurations) {
    documents.push({
      id: `proc-${proc.id}`,
      type: 'procuration',
      name: `Procuration - ${proc.companyName || proc.signerName}`,
      downloadPath: `/api/procurations/${clientId}/download`,
      uploadedAt: proc.signedAt?.toISOString() || proc.createdAt?.toISOString() || null,
      metadata: {
        signerName: proc.signerName,
        hqAccountNumber: proc.hqAccountNumber || '',
      },
    });
  }
  
  // Sort by date (newest first)
  documents.sort((a, b) => {
    const dateA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
    const dateB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
    return dateB - dateA;
  });
  
  res.json(documents);
}));

// Download HQ bill - the path is stored in the lead or site record
router.get("/api/hq-bills/download", authMiddleware, requireStaff, asyncHandler(async (req, res) => {
  const { path: billPath } = req.query;
  
  if (!billPath || typeof billPath !== 'string') {
    throw new BadRequestError("Bill path is required");
  }
  
  // Normalize the path - handle both full paths (uploads/hq-bills/file.pdf) and relative paths
  const uploadsDir = path.resolve(process.cwd(), "uploads");
  let normalizedPath = billPath;
  
  // Strip leading 'uploads/' if present to get the relative path
  if (normalizedPath.startsWith('uploads/')) {
    normalizedPath = normalizedPath.substring('uploads/'.length);
  }
  if (normalizedPath.startsWith('/uploads/')) {
    normalizedPath = normalizedPath.substring('/uploads/'.length);
  }
  
  // Resolve the full path within uploads directory
  const fullPath = path.resolve(uploadsDir, normalizedPath);
  
  // Validate the resolved path is within uploads directory (prevent path traversal)
  const relativePath = path.relative(uploadsDir, fullPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new BadRequestError("Invalid bill path");
  }
  
  if (!fs.existsSync(fullPath)) {
    throw new NotFoundError("HQ Bill file");
  }
  
  const filename = path.basename(fullPath);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.sendFile(fullPath);
}));

router.get("/api/procurations/:referenceId/download", authMiddleware, requireStaff, asyncHandler(async (req, res) => {
  const { referenceId } = req.params;
  
  // Get the procuration signature data from storage
  const procurations = await storage.getProcurationSignatures();
  const procuration = procurations.find(p => 
    p.clientId === referenceId || p.leadId === referenceId
  );
  
  if (!procuration) {
    throw new NotFoundError("Procuration signature");
  }
  
  // Use values from the procuration record first, then fallback to leads/sites
  let signerTitle = procuration.signerTitle || '';
  let streetAddress: string | undefined;
  let city: string | undefined;
  let signatureCity = procuration.signatureCity || '';
  
  // Try to get address from lead first, then by HQ account number, then from client's first site
  if (procuration.leadId) {
    const lead = await storage.getLead(procuration.leadId);
    if (lead) {
      if (!signerTitle && lead.decisionMakerTitle) signerTitle = lead.decisionMakerTitle;
      if (lead.streetAddress) streetAddress = lead.streetAddress;
      if (lead.city) {
        city = lead.city;
        if (!signatureCity) signatureCity = lead.city;
      }
    }
  } 
  
  // If no address yet, try to find lead by HQ account number
  if (!streetAddress && procuration.hqAccountNumber) {
    const allLeads = await storage.getLeads();
    // Find a lead matching by company name or HQ account number that has an address
    const matchingLead = allLeads.find(l => 
      l.streetAddress && 
      (l.companyName === procuration.companyName)
    );
    if (matchingLead) {
      if (matchingLead.streetAddress) streetAddress = matchingLead.streetAddress;
      if (matchingLead.city) {
        city = matchingLead.city;
        if (!signatureCity) signatureCity = matchingLead.city;
      }
      if (!signerTitle && matchingLead.decisionMakerTitle) {
        signerTitle = matchingLead.decisionMakerTitle;
      }
    }
  }
  
  // Finally, try from client's first site
  if (!streetAddress && procuration.clientId) {
    const sites = await storage.getSitesByClient(procuration.clientId);
    if (sites && sites.length > 0) {
      const site = sites[0];
      if (site.address) streetAddress = site.address;
      if (site.city) {
        city = site.city;
        if (!signatureCity) signatureCity = site.city;
      }
    }
  }
  
  // Check for signature image
  const signatureDir = path.join(process.cwd(), "uploads", "signatures");
  let signatureImage: string | undefined;
  const signatureFilePath = path.join(signatureDir, `${referenceId}_signature.png`);
  if (fs.existsSync(signatureFilePath)) {
    const imageBuffer = fs.readFileSync(signatureFilePath);
    signatureImage = `data:image/png;base64,${imageBuffer.toString('base64')}`;
  }
  
  // Calculate dates - procuration valid for 30 days from signature
  const signedDate = procuration.signedAt ? new Date(procuration.signedAt) : new Date();
  const endDate = new Date(signedDate);
  endDate.setDate(endDate.getDate() + 30);
  
  // Import and generate fresh PDF with current template
  const { generateProcurationPDF } = await import("../procurationPdfGenerator");
  const pdfBuffer = await generateProcurationPDF({
    hqAccountNumber: procuration.hqAccountNumber || '',
    contactName: procuration.signerName,
    signerTitle,
    signatureCity,
    signatureImage,
    procurationDate: signedDate,
    procurationEndDate: endDate,
    ipAddress: procuration.ipAddress || undefined,
    userAgent: procuration.userAgent || undefined,
    companyName: procuration.companyName || undefined,
    streetAddress,
    city,
  });
  
  const filename = `procuration_${procuration.companyName || 'document'}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  res.send(pdfBuffer);
}));

router.post("/api/clients", authMiddleware, requireStaff, asyncHandler(async (req, res) => {
  const parsed = insertClientSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError("Validation error", parsed.error.errors);
  }
  
  const client = await storage.createClient(parsed.data);
  res.status(201).json(client);
}));

router.patch("/api/clients/:id", authMiddleware, requireStaff, asyncHandler(async (req, res) => {
  const client = await storage.updateClient(req.params.id, req.body);
  if (!client) {
    throw new NotFoundError("Client");
  }
  res.json(client);
}));

router.get("/api/clients/:id/cascade-counts", authMiddleware, requireStaff, asyncHandler(async (req, res) => {
  const client = await storage.getClient(req.params.id);
  if (!client) throw new NotFoundError("Client");
  const counts = await storage.getClientCascadeCounts(req.params.id);
  res.json({ clientName: client.name, ...counts });
}));

router.delete("/api/clients/:id/cascade", authMiddleware, requireStaff, asyncHandler(async (req, res) => {
  const client = await storage.getClient(req.params.id);
  if (!client) throw new NotFoundError("Client");
  const deleted = await storage.cascadeDeleteClient(req.params.id);
  if (!deleted) throw new BadRequestError("Failed to delete client");
  res.status(204).send();
}));

router.delete("/api/clients/:id", authMiddleware, requireStaff, asyncHandler(async (req, res) => {
  const clientId = req.params.id;
  
  const client = await storage.getClient(clientId);
  if (!client) {
    throw new NotFoundError("Client");
  }
  
  const sites = await storage.getSitesByClient(clientId);
  if (sites.length > 0) {
    throw new ConflictError(`Cannot delete client with ${sites.length} site(s). Please delete or reassign the sites first.`);
  }
  
  const portfolios = await storage.getPortfoliosByClient(clientId);
  if (portfolios.length > 0) {
    throw new ConflictError(`Cannot delete client with ${portfolios.length} portfolio(s). Please delete the portfolios first.`);
  }
  
  const opportunities = await storage.getOpportunitiesByClientId(clientId);
  if (opportunities.length > 0) {
    throw new ConflictError(`Cannot delete client with ${opportunities.length} opportunity(ies) in the pipeline. Please close or reassign them first.`);
  }
  
  const deleted = await storage.deleteClient(clientId);
  if (!deleted) {
    throw new BadRequestError("Failed to delete client");
  }
  res.status(204).send();
}));

router.post("/api/clients/:id/archive", authMiddleware, requireStaff, asyncHandler(async (req, res) => {
  const clientId = req.params.id;
  const { archiveSites } = req.body;
  
  const client = await storage.getClient(clientId);
  if (!client) {
    throw new NotFoundError("Client");
  }
  
  const updatedClient = await storage.updateClient(clientId, {
    isArchived: true,
    archivedAt: new Date(),
  });
  
  if (archiveSites) {
    const sites = await storage.getSitesByClient(clientId);
    for (const site of sites) {
      await storage.updateSite(site.id, {
        isArchived: true,
        archivedAt: new Date(),
      });
    }
  }
  
  res.json(updatedClient);
}));

router.post("/api/clients/:id/unarchive", authMiddleware, requireStaff, asyncHandler(async (req, res) => {
  const clientId = req.params.id;
  
  const client = await storage.getClient(clientId);
  if (!client) {
    throw new NotFoundError("Client");
  }
  
  const updatedClient = await storage.updateClient(clientId, {
    isArchived: false,
    archivedAt: null,
  });
  
  res.json(updatedClient);
}));

export default router;
