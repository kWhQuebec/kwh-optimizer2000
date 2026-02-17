import type { PDFContext } from "../types";
import { COLORS } from "../types";
import { drawRoundedRect, drawPageHeader, drawPageFooter } from "../helpers";
import { getDesignFeeCovers, getClientProvides, getClientReceives, getContactString } from "@shared/brandContent";

export function renderNextSteps(ctx: PDFContext) {
  const { doc, t, margin, contentWidth } = ctx;
  const isSyntheticData = typeof (ctx.simulation as any).isSynthetic === 'boolean'
    ? (ctx.simulation as any).isSynthetic
    : !(ctx.simulation.hourlyProfile && ctx.simulation.hourlyProfile.length > 0);

  doc.addPage();
  drawPageHeader(ctx, t("PASSONS À L'ACTION", "LET'S TAKE ACTION"));
  doc.y = ctx.headerHeight + 25;

  doc.fontSize(18).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("PASSONS À L'ACTION", "LET'S TAKE ACTION"), margin, doc.y);
  doc.font("Helvetica");
  doc.y += 5;
  doc.rect(margin, doc.y, 160, 3).fillColor(COLORS.gold).fill();
  doc.y += 20;

  const nsColWidth = (contentWidth - 20) / 3;
  const nsY = doc.y;
  const nsBlockH = 200;

  drawRoundedRect(doc, margin, nsY, nsColWidth, nsBlockH, 6, COLORS.background);
  doc.roundedRect(margin, nsY, nsColWidth, nsBlockH, 6).strokeColor(COLORS.blue).lineWidth(1).stroke();

  doc.fontSize(9).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Ce que couvre le", "What the design"), margin + 10, nsY + 10, { width: nsColWidth - 20 });
  doc.text(t("Mandat de conception préliminaire (2 500$ + taxes)", "Preliminary design fee ($2,500 + taxes)"), margin + 10, nsY + 22, { width: nsColWidth - 20 });
  doc.font("Helvetica");

  const designCovers = getDesignFeeCovers(ctx.lang);
  let nsItemY = nsY + 45;
  designCovers.forEach((item: string) => {
    doc.fontSize(8).fillColor(COLORS.green).font("Helvetica-Bold");
    doc.text("✓", margin + 12, nsItemY);
    doc.font("Helvetica").fillColor(COLORS.darkGray);
    doc.text(item, margin + 24, nsItemY, { width: nsColWidth - 36 });
    nsItemY += 18;
  });

  const nsCol2X = margin + nsColWidth + 10;
  drawRoundedRect(doc, nsCol2X, nsY, nsColWidth, nsBlockH, 6, COLORS.background);
  doc.roundedRect(nsCol2X, nsY, nsColWidth, nsBlockH, 6).strokeColor(COLORS.gold).lineWidth(1).stroke();

  doc.fontSize(9).fillColor(COLORS.gold).font("Helvetica-Bold");
  doc.text(t("Ce que vous", "What you"), nsCol2X + 10, nsY + 10, { width: nsColWidth - 20 });
  doc.text(t("devez fournir", "need to provide"), nsCol2X + 10, nsY + 22, { width: nsColWidth - 20 });
  doc.font("Helvetica");

  const clientProvides = getClientProvides(ctx.lang);
  nsItemY = nsY + 45;
  clientProvides.forEach((item: string) => {
    doc.fontSize(8).fillColor(COLORS.gold).font("Helvetica-Bold");
    doc.text("□", nsCol2X + 12, nsItemY);
    doc.font("Helvetica").fillColor(COLORS.darkGray);
    doc.text(item, nsCol2X + 24, nsItemY, { width: nsColWidth - 36 });
    nsItemY += 18;
  });

  const nsCol3X = margin + 2 * (nsColWidth + 10);
  drawRoundedRect(doc, nsCol3X, nsY, nsColWidth, nsBlockH, 6, COLORS.background);
  doc.roundedRect(nsCol3X, nsY, nsColWidth, nsBlockH, 6).strokeColor(COLORS.green).lineWidth(1).stroke();

  doc.fontSize(9).fillColor(COLORS.green).font("Helvetica-Bold");
  doc.text(t("Ce que vous", "What you"), nsCol3X + 10, nsY + 10, { width: nsColWidth - 20 });
  doc.text(t("recevez", "receive"), nsCol3X + 10, nsY + 22, { width: nsColWidth - 20 });
  doc.font("Helvetica");

  const clientReceives = getClientReceives(ctx.lang);
  nsItemY = nsY + 45;
  clientReceives.forEach((item: string) => {
    doc.fontSize(8).fillColor(COLORS.green).font("Helvetica-Bold");
    doc.text("→", nsCol3X + 12, nsItemY);
    doc.font("Helvetica").fillColor(COLORS.darkGray);
    doc.text(item, nsCol3X + 24, nsItemY, { width: nsColWidth - 36 });
    nsItemY += 18;
  });

  const ctaY = nsY + nsBlockH + 15;

  if (isSyntheticData) {
    const optColW = (contentWidth - 10) / 2;

    drawRoundedRect(doc, margin, ctaY, optColW, 70, 6, "#F0FDF4");
    doc.roundedRect(margin, ctaY, optColW, 70, 6).strokeColor("#BBF7D0").lineWidth(0.5).stroke();
    doc.fontSize(9).fillColor(COLORS.green).font("Helvetica-Bold");
    doc.text(t("Option A — Procuration (2 min)", "Option A — Authorization (2 min)"), margin + 8, ctaY + 8, { width: optColW - 16 });
    doc.font("Helvetica").fontSize(8).fillColor(COLORS.darkGray);
    doc.text(t("Signez en ligne et nous nous occupons de tout.", "Sign online and we handle everything."), margin + 8, ctaY + 22, { width: optColW - 16 });
    doc.fillColor(COLORS.blue);
    doc.text("kwh.quebec/analyse-detaillee", margin + 8, ctaY + 38, { width: optColW - 16, underline: true, link: "https://kwh.quebec/analyse-detaillee" });

    const opt2X = margin + optColW + 10;
    drawRoundedRect(doc, opt2X, ctaY, optColW, 70, 6, "#EFF6FF");
    doc.roundedRect(opt2X, ctaY, optColW, 70, 6).strokeColor("#BFDBFE").lineWidth(0.5).stroke();
    doc.fontSize(9).fillColor(COLORS.blue).font("Helvetica-Bold");
    doc.text(t("Option B — Téléchargement CSV (~30 min)", "Option B — CSV Download (~30 min)"), opt2X + 8, ctaY + 8, { width: optColW - 16 });
    doc.font("Helvetica").fontSize(8).fillColor(COLORS.darkGray);
    doc.text(t("Téléchargez vos fichiers depuis l'Espace Client Hydro-Québec.", "Download your files from Hydro-Québec's Online Portal."), opt2X + 8, ctaY + 22, { width: optColW - 16 });
    doc.fillColor(COLORS.blue);
    doc.text(t("Voir le guide étape par étape", "See the step-by-step guide"), opt2X + 8, ctaY + 38, { width: optColW - 16, underline: true, link: "https://kwh.quebec/blog/telecharger-donnees-espace-client-hydro-quebec" });

    doc.fontSize(8).fillColor(COLORS.mediumGray);
    doc.text(t("Gratuit et sans engagement — Résultat en 7 jours ouvrables après réception des données.", "Free and without commitment — Results within 7 business days after data reception."), margin, ctaY + 78, { width: contentWidth, align: "center" });

    const ctaBoxY = ctaY + 95;
    drawRoundedRect(doc, margin, ctaBoxY, contentWidth, 45, 8, COLORS.blue);
    doc.fontSize(12).fillColor(COLORS.white).font("Helvetica-Bold");
    doc.text(t("Prêt à passer à l'action?", "Ready to take action?"), margin, ctaBoxY + 8, { width: contentWidth, align: "center" });
    doc.font("Helvetica").fontSize(11).fillColor(COLORS.gold);
    doc.text(getContactString(), margin, ctaBoxY + 26, { width: contentWidth, align: "center" });
  } else {
    doc.fontSize(10).fillColor(COLORS.darkGray);
    doc.text(t(
      "Les incitatifs actuels sont les plus généreux de l'histoire du Québec. Chaque mois d'attente représente des économies perdues.",
      "Current incentives are the most generous in Quebec's history. Every month of delay means lost savings."
    ), margin, ctaY, { width: contentWidth, align: "center" });

    doc.moveDown(1.2);
    const ctaBoxY = doc.y;
    drawRoundedRect(doc, margin, ctaBoxY, contentWidth, 55, 8, COLORS.blue);

    doc.fontSize(14).fillColor(COLORS.white).font("Helvetica-Bold");
    doc.text(t("Prêt à passer à l'action? Réservez votre mandat de conception.", "Ready to take action? Book your design mandate."), margin, ctaBoxY + 10, { width: contentWidth, align: "center" });
    doc.font("Helvetica");

    doc.fontSize(11).fillColor(COLORS.gold);
    doc.text(getContactString(), margin, ctaBoxY + 32, { width: contentWidth, align: "center" });
  }

  drawPageFooter(ctx, t("Document confidentiel | Généré par kWh Québec | Prochaines étapes", "Confidential document | Generated by kWh Québec | Next steps"));
}
