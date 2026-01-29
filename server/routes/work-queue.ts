import { Router, Response } from "express";
import { authMiddleware, requireStaff, AuthRequest } from "../middleware/auth";
import { storage } from "../storage";
import { sendEmail } from "../gmail";

const router = Router();

router.get("/api/work-queue/sites", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    // Use lightweight query that excludes heavy googleSolarData blobs
    const sites = await storage.getSitesForWorkQueue();
    const clients = await storage.getClients();
    const clientsById = new Map(clients.map(c => [c.id, { name: c.name }]));
    
    const sitesWithClient = sites.map(site => ({
      ...site,
      clientName: site.clientId ? clientsById.get(site.clientId)?.name : null,
    }));
    
    res.json(sitesWithClient);
  } catch (error) {
    console.error("Error fetching work queue sites:", error);
    res.status(500).json({ error: "Failed to fetch work queue sites" });
  }
});

router.post("/api/work-queue/delegate", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const { siteIds, recipientEmail, recipientName, instructions, language } = req.body;

    if (!siteIds || !Array.isArray(siteIds) || siteIds.length === 0) {
      return res.status(400).json({ error: "siteIds array is required" });
    }
    if (!recipientEmail || typeof recipientEmail !== "string") {
      return res.status(400).json({ error: "recipientEmail is required" });
    }
    const lang = language === "en" ? "en" : "fr";

    const sites = await Promise.all(siteIds.map((id: string) => storage.getSite(id)));
    const validSites = sites.filter((s): s is NonNullable<typeof s> => s !== null);

    if (validSites.length === 0) {
      return res.status(404).json({ error: "No valid sites found" });
    }

    const getTaskType = (site: typeof validSites[0]) => {
      if (!site.roofAreaValidated) return lang === "fr" ? "Dessin du toit" : "Roof Drawing";
      if (!site.quickAnalysisCompletedAt) return lang === "fr" ? "Lancer l'analyse" : "Run Analysis";
      return lang === "fr" ? "Générer le rapport" : "Generate Report";
    };

    const appUrl = process.env.REPLIT_DEPLOYMENT_URL || process.env.REPLIT_DEV_DOMAIN || "https://app.kwhquebec.com";
    const baseUrl = appUrl.startsWith("http") ? appUrl : `https://${appUrl}`;

    const subject = lang === "fr"
      ? `[kWh Québec] Tâches assignées - ${validSites.length} sites`
      : `[kWh Québec] Assigned Tasks - ${validSites.length} sites`;

    const greeting = recipientName
      ? (lang === "fr" ? `Bonjour ${recipientName},` : `Hello ${recipientName},`)
      : (lang === "fr" ? "Bonjour," : "Hello,");

    const introText = lang === "fr"
      ? `Les tâches suivantes vous ont été assignées. Veuillez les compléter dès que possible.`
      : `The following tasks have been assigned to you. Please complete them as soon as possible.`;

    const sitesListHtml = validSites.map((site) => {
      const address = [site.address, site.city, site.province].filter(Boolean).join(", ");
      const taskType = getTaskType(site);
      const siteUrl = `${baseUrl}/app/sites/${site.id}`;
      return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            <a href="${siteUrl}" style="color: #003DA6; font-weight: 600; text-decoration: none;">${site.name}</a>
            ${address ? `<br><span style="color: #666; font-size: 13px;">${address}</span>` : ""}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
            <span style="background: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${taskType}</span>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
            <a href="${siteUrl}" style="color: #003DA6; text-decoration: none; font-size: 13px;">${lang === "fr" ? "Voir le site →" : "View site →"}</a>
          </td>
        </tr>
      `;
    }).join("");

    const instructionsHtml = instructions
      ? `
        <div style="margin: 20px 0; padding: 15px; background: #fff8e1; border-left: 4px solid #FFB005; border-radius: 4px;">
          <strong style="color: #333;">${lang === "fr" ? "Instructions:" : "Instructions:"}</strong>
          <p style="margin: 8px 0 0; color: #555;">${instructions}</p>
        </div>
      `
      : "";

    const htmlBody = `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: white;">
    <div style="background: linear-gradient(135deg, #003DA6 0%, #1e5a9f 100%); color: white; padding: 30px; text-align: center;">
      <h1 style="margin: 0; font-size: 22px; font-weight: 600;">${lang === "fr" ? "Tâches Assignées" : "Assigned Tasks"}</h1>
    </div>
    <div style="padding: 30px;">
      <p style="font-size: 15px; color: #333;">${greeting}</p>
      <p style="font-size: 15px; color: #555;">${introText}</p>
      
      ${instructionsHtml}
      
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background: #f8f9fa;">
            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #003DA6; color: #003DA6;">${lang === "fr" ? "Site" : "Site"}</th>
            <th style="padding: 12px; text-align: center; border-bottom: 2px solid #003DA6; color: #003DA6;">${lang === "fr" ? "Tâche" : "Task"}</th>
            <th style="padding: 12px; text-align: center; border-bottom: 2px solid #003DA6; color: #003DA6;">${lang === "fr" ? "Lien" : "Link"}</th>
          </tr>
        </thead>
        <tbody>
          ${sitesListHtml}
        </tbody>
      </table>
      
      <p style="font-size: 13px; color: #888; margin-top: 30px; text-align: center;">
        ${lang === "fr" 
          ? "Ce courriel a été envoyé automatiquement par le système kWh Québec."
          : "This email was sent automatically by the kWh Québec system."}
      </p>
    </div>
    <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; font-size: 14px; color: #003DA6; font-weight: 600;">kWh Québec</p>
      <p style="margin: 5px 0 0; font-size: 13px; color: #666;">${lang === "fr" ? "Solaire + Stockage" : "Solar + Storage"}</p>
      <p style="margin: 10px 0 0; font-size: 12px; color: #888;">
        <a href="mailto:info@kwhquebec.com" style="color: #003DA6; text-decoration: none;">info@kwhquebec.com</a>
      </p>
    </div>
  </div>
</body>
</html>
    `;

    const result = await sendEmail({
      to: recipientEmail,
      subject,
      htmlBody,
    });

    if (!result.success) {
      console.error("Failed to send delegation email:", result.error);
      return res.status(500).json({ error: result.error || "Failed to send email" });
    }

    await Promise.all(validSites.map((site) =>
      storage.updateSite(site.id, {
        workQueueDelegatedToEmail: recipientEmail,
        workQueueDelegatedToName: recipientName || null,
        workQueueDelegatedAt: new Date(),
      })
    ));

    console.log(`Work queue delegation: ${validSites.length} sites delegated to ${recipientEmail}`);
    res.json({ success: true, messageId: result.messageId });
  } catch (error) {
    console.error("Work queue delegation error:", error);
    res.status(500).json({ error: "Failed to delegate tasks" });
  }
});

export default router;
