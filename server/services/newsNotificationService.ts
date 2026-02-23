import { sendEmail } from "../emailService";
import { createLogger } from "../lib/logger";

const log = createLogger("NewsNotification");

const NEWS_ADMIN_EMAIL = "malabarre@kwh.quebec";

interface NewsJobResult {
  fetched: number;
  newArticles: number;
  analyzed: number;
}

export async function sendNewsCollectionNotification(result: NewsJobResult): Promise<void> {
  if (result.newArticles === 0) {
    log.info("No new articles found, skipping notification email");
    return;
  }

  const host = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(",")[0] || "localhost:5000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const adminUrl = `${protocol}://${host}/app/admin/news`;

  const subject = `Nouvelles de l'industrie — ${result.newArticles} article${result.newArticles > 1 ? "s" : ""} à approuver`;

  const htmlBody = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="background: #003DA6; padding: 20px; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 20px;">kWh Québec — Nouvelles de l'industrie</h1>
  </div>
  <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
    <p>Bonjour,</p>
    <p>La collecte automatique des nouvelles vient de se terminer. Voici le résumé :</p>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <tr>
        <td style="padding: 8px 12px; background: #f9fafb; border: 1px solid #e5e7eb; font-weight: 600;">Articles trouvés</td>
        <td style="padding: 8px 12px; background: #f9fafb; border: 1px solid #e5e7eb; text-align: center;">${result.fetched}</td>
      </tr>
      <tr>
        <td style="padding: 8px 12px; border: 1px solid #e5e7eb; font-weight: 600;">Nouveaux articles</td>
        <td style="padding: 8px 12px; border: 1px solid #e5e7eb; text-align: center; color: #003DA6; font-weight: 700;">${result.newArticles}</td>
      </tr>
      <tr>
        <td style="padding: 8px 12px; background: #f9fafb; border: 1px solid #e5e7eb; font-weight: 600;">Analysés par IA</td>
        <td style="padding: 8px 12px; background: #f9fafb; border: 1px solid #e5e7eb; text-align: center;">${result.analyzed}</td>
      </tr>
    </table>
    <p>${result.newArticles} article${result.newArticles > 1 ? "s sont en attente" : " est en attente"} de votre approbation.</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${adminUrl}" style="display: inline-block; background: #003DA6; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600;">
        Consulter et approuver
      </a>
    </div>
    <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
      Cette notification est envoyée automatiquement après chaque collecte quotidienne (16h).
      <br>kWh Québec — 514.427.8871 — info@kwh.quebec
    </p>
  </div>
</body>
</html>`;

  const textBody = `kWh Québec — Nouvelles de l'industrie

Bonjour,

La collecte automatique des nouvelles vient de se terminer.

- Articles trouvés : ${result.fetched}
- Nouveaux articles : ${result.newArticles}
- Analysés par IA : ${result.analyzed}

${result.newArticles} article${result.newArticles > 1 ? "s sont en attente" : " est en attente"} de votre approbation.

Consultez-les ici : ${adminUrl}

kWh Québec — 514.427.8871 — info@kwh.quebec`;

  try {
    const emailResult = await sendEmail({
      to: NEWS_ADMIN_EMAIL,
      subject,
      htmlBody,
      textBody,
    });

    if (emailResult.success) {
      log.info(`News notification email sent to ${NEWS_ADMIN_EMAIL} (messageId: ${emailResult.messageId})`);
    } else {
      log.error(`Failed to send news notification email: ${emailResult.error}`);
    }
  } catch (error) {
    log.error("Exception sending news notification email:", error);
  }
}
