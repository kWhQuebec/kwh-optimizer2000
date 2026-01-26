import { Router, Response } from "express";
import { authMiddleware, requireStaff, AuthRequest } from "../middleware/auth";
import { storage } from "../storage";
import PDFDocument from "pdfkit";
import { sendEmail } from "../gmail";
import {
  insertDesignAgreementSchema,
  insertConstructionAgreementSchema,
  insertConstructionMilestoneSchema,
} from "@shared/schema";

interface DesignQuotedCosts {
  designFees?: {
    numBuildings: number;
    baseFee: number;
    pvSizeKW: number;
    pvFee: number;
    battEnergyKWh: number;
    batteryFee: number;
    travelDays: number;
    travelFee: number;
  };
  engineeringStamps?: {
    structural: number;
    electrical: number;
  };
  siteVisit: unknown;
  additionalFees: Array<{ description?: string; amount: number }>;
  subtotal: number;
  taxes: { gst: number; qst: number };
  total: number;
}

interface QuotedCostsForPDF {
  siteVisit?: { travel?: number; visit?: number; evaluation?: number; diagrams?: number; sldSupplement?: number; total?: number };
  designFees?: Record<string, unknown>;
  engineeringStamps?: Record<string, unknown>;
  additionalFees?: Array<{ description?: string; amount: number }>;
  subtotal?: number;
  taxes?: { gst?: number; qst?: number };
  total?: number;
}

const router = Router();

router.get("/api/design-agreements", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const agreements = await storage.getDesignAgreements();
    res.json(agreements);
  } catch (error) {
    console.error("Error fetching design agreements:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/sites/:siteId/design-agreement", authMiddleware, async (req: AuthRequest, res) => {
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

router.get("/api/design-agreements/:id", authMiddleware, async (req: AuthRequest, res) => {
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

router.post("/api/design-agreements", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const data = { ...req.body };
    if (data.validUntil && typeof data.validUntil === 'string') {
      data.validUntil = new Date(data.validUntil);
    }
    if (data.quotedAt && typeof data.quotedAt === 'string') {
      data.quotedAt = new Date(data.quotedAt);
    }
    
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

router.patch("/api/design-agreements/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
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

router.delete("/api/design-agreements/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
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

router.post("/api/sites/:siteId/generate-design-agreement", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const { siteId } = req.params;
    const { siteVisitId, additionalFees = [], paymentTerms, pricingConfig } = req.body;
    
    const visit = siteVisitId ? await storage.getSiteVisit(siteVisitId) : null;
    const siteVisitCost = visit?.estimatedCost || null;
    
    let subtotal: number;
    let gst: number;
    let qst: number;
    let total: number;
    let quotedCosts: DesignQuotedCosts;
    
    if (pricingConfig) {
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
      const additionalTotal = Array.isArray(additionalFees) 
        ? additionalFees.reduce((sum: number, fee: { amount: number }) => sum + (fee.amount || 0), 0) 
        : 0;
      const siteVisitTotal = (siteVisitCost as { total?: number } | null)?.total || 0;
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

router.get("/api/design-agreements/:id/pdf", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const lang = (req.query.lang as string) === "en" ? "en" : "fr";
    const agreement = await storage.getDesignAgreement(req.params.id);
    
    if (!agreement) {
      return res.status(404).json({ error: "Design agreement not found" });
    }
    
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
    
    const { generateDesignAgreementPDF } = await import("../pdfGenerator");
    
    const quotedCosts: QuotedCostsForPDF = (agreement.quotedCosts as QuotedCostsForPDF) || {
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

router.post("/api/design-agreements/:id/send-email", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
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
    
    const site = await storage.getSite(agreement.siteId);
    if (!site) {
      return res.status(404).json({ error: "Site not found" });
    }
    
    const client = await storage.getClient(site.clientId);
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }
    
    const PDFDocumentForEmail = (await import("pdfkit")).default;
    const doc = new PDFDocumentForEmail({ size: "LETTER", margin: 50 });
    const pdfChunks: Buffer[] = [];
    
    doc.on('data', (chunk: Buffer) => pdfChunks.push(chunk));
    
    const pdfPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(pdfChunks)));
      doc.on('error', reject);
    });
    
    const { generateDesignAgreementPDF } = await import("../pdfGenerator");
    
    const quotedCostsForEmail: QuotedCostsForPDF = (agreement.quotedCosts as QuotedCostsForPDF) || {
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
      quotedCosts: quotedCostsForEmail,
      totalCad: agreement.totalCad || 0,
      paymentTerms: agreement.paymentTerms || undefined,
      validUntil: agreement.validUntil,
      createdAt: agreement.createdAt,
    }, language);
    
    doc.end();
    
    const pdfBuffer = await pdfPromise;
    
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const signingLink = agreement.publicToken ? `${baseUrl}/sign/${agreement.publicToken}` : null;
    
    let htmlBody = body;
    if (signingLink) {
      const linkText = language === "fr" 
        ? `<p><strong>Pour signer l'entente en ligne :</strong> <a href="${signingLink}">${signingLink}</a></p>`
        : `<p><strong>To sign the agreement online:</strong> <a href="${signingLink}">${signingLink}</a></p>`;
      htmlBody = `${body}${linkText}`;
    }
    
    const emailResult = await sendEmail({
      to: recipientEmail,
      subject: subject,
      htmlBody: htmlBody,
      textBody: body.replace(/<[^>]*>/g, ''),
      attachments: [{
        filename: `entente-design-${site.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
        content: pdfBuffer.toString('base64'),
        type: 'application/pdf',
      }],
    });
    
    if (!emailResult.success) {
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

router.get("/api/design-agreements/:id/email-logs", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const logs = await storage.getEmailLogs({ designAgreementId: id });
    res.json(logs);
  } catch (error) {
    console.error("Error fetching email logs:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/construction-agreements", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const agreements = await storage.getConstructionAgreements();
    
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

router.get("/api/construction-agreements/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const agreement = await storage.getConstructionAgreement(req.params.id);
    if (!agreement) {
      return res.status(404).json({ error: "Construction agreement not found" });
    }
    
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

router.get("/api/construction-agreements/site/:siteId", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const agreements = await storage.getConstructionAgreementsBySiteId(req.params.siteId);
    res.json(agreements);
  } catch (error) {
    console.error("Error fetching construction agreements by site:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/construction-agreements", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
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

router.patch("/api/construction-agreements/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
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

router.delete("/api/construction-agreements/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
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

router.post("/api/construction-agreements/:id/send", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
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

router.post("/api/construction-agreements/:id/accept", authMiddleware, async (req: AuthRequest, res) => {
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

router.get("/api/construction-agreements/:id/proposal-pdf", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
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
    let bomItems: Array<{ id: string; name: string; quantity: number; unitPrice?: number; total?: number; [key: string]: unknown }> = [];
    if (agreement.designId) {
      design = await storage.getDesign(agreement.designId);
      bomItems = await storage.getBomItems(agreement.designId);
    }

    const milestones = await storage.getConstructionMilestonesByAgreementId(agreement.id);

    const allProjects = await storage.getConstructionProjects();
    const project = allProjects.find(p => p.constructionAgreementId === agreement.id) || null;

    let preliminaryTasks: Array<{ id: string; name: string; isPreliminary?: boolean | null; plannedStartDate?: Date | null; plannedEndDate?: Date | null; [key: string]: unknown }> = [];
    if (project) {
      const projectTasks = await storage.getConstructionTasksByProjectId(project.id);
      preliminaryTasks = projectTasks.filter(t => t.isPreliminary === true);
    }

    if (preliminaryTasks.length === 0) {
      return res.status(404).json({ 
        error: lang === "fr" 
          ? "Aucun calendrier préliminaire disponible. Veuillez d'abord générer le calendrier depuis la page Design." 
          : "No preliminary schedule available. Please generate the schedule from the Design page first."
      });
    }

    const { generateConstructionProposalPDF } = await import("../constructionProposalPdf");

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

router.get("/api/construction-milestones/agreement/:agreementId", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const milestones = await storage.getConstructionMilestonesByAgreementId(req.params.agreementId);
    res.json(milestones);
  } catch (error) {
    console.error("Error fetching construction milestones:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/construction-milestones", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
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

router.patch("/api/construction-milestones/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
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

router.delete("/api/construction-milestones/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
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

router.post("/api/construction-milestones/:id/complete", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
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

export default router;
