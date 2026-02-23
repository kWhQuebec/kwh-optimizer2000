import type { PDFContext } from "../types";
import { COLORS } from "../types";
import { drawRoundedRect, drawPageHeader, drawPageFooter } from "../helpers";
import { getDeliveryAssurance, getDeliveryPartners, getWarrantyRoadmap } from "@shared/brandContent";

/**
 * Project Delivery Assurance page — Shows the project delivery framework
 * with milestones, QA checkpoints, partners, and warranty roadmap.
 * Addresses Oleg's "Project Delivery Assurance one-pager" suggestion.
 */
export function renderDeliveryAssurance(ctx: PDFContext) {
  const { doc, t, margin, contentWidth } = ctx;

  doc.addPage();
  drawPageHeader(ctx, t("ASSURANCE DE LIVRAISON", "PROJECT DELIVERY ASSURANCE"));
  doc.y = ctx.headerHeight + 25;

  // Section title
  doc.fontSize(16).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("ASSURANCE DE LIVRAISON", "PROJECT DELIVERY ASSURANCE"), margin, doc.y);
  doc.font("Helvetica");
  doc.y += 5;
  doc.rect(margin, doc.y, 200, 2).fillColor(COLORS.gold).fill();
  doc.y += 18;

  // ---- DELIVERY MILESTONES ----
  const milestones = getDeliveryAssurance(ctx.lang);

  doc.fontSize(10).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("JALONS ET POINTS DE CONTRÔLE QUALITÉ", "MILESTONES & QUALITY CHECKPOINTS"), margin, doc.y);
  doc.font("Helvetica");
  doc.y += 3;
  doc.rect(margin, doc.y, 200, 1.5).fillColor(COLORS.gold).fill();
  doc.y += 8;

  const mColWidths = [contentWidth * 0.22, contentWidth * 0.22, contentWidth * 0.34, contentWidth * 0.22];
  const mHeaders = [
    t("Phase", "Phase"),
    t("Durée", "Duration"),
    t("Livrables", "Deliverables"),
    t("Contrôle qualité", "QA Checkpoint"),
  ];
  const mRowH = 28;

  // Table header
  let tableY = doc.y;
  drawRoundedRect(doc, margin, tableY, contentWidth, 16, 0, COLORS.blue);
  doc.fontSize(7).fillColor(COLORS.white).font("Helvetica-Bold");
  let colX = margin;
  mHeaders.forEach((h, i) => {
    doc.text(h, colX + 4, tableY + 4, { width: mColWidths[i] - 8 });
    colX += mColWidths[i];
  });
  doc.font("Helvetica");
  tableY += 16;

  milestones.forEach((m, i) => {
    const bg = i % 2 === 0 ? COLORS.background : COLORS.white;
    drawRoundedRect(doc, margin, tableY, contentWidth, mRowH, 0, bg);
    doc.fontSize(7).fillColor(COLORS.darkGray);

    colX = margin;
    // Phase
    doc.font("Helvetica-Bold").fillColor(COLORS.blue);
    doc.text(m.phase, colX + 4, tableY + 4, { width: mColWidths[0] - 8 });
    colX += mColWidths[0];

    // Duration
    doc.font("Helvetica").fillColor(COLORS.darkGray);
    doc.text(m.duration, colX + 4, tableY + 4, { width: mColWidths[1] - 8 });
    colX += mColWidths[1];

    // Deliverables
    doc.fontSize(6.5);
    doc.text(m.deliverables.join(", "), colX + 4, tableY + 3, { width: mColWidths[2] - 8 });
    colX += mColWidths[2];

    // QA
    doc.fontSize(6.5).fillColor(COLORS.green).font("Helvetica-Bold");
    doc.text(`✓ ${m.qaCheckpoint}`, colX + 4, tableY + 4, { width: mColWidths[3] - 8 });
    doc.font("Helvetica");

    tableY += mRowH;
  });

  doc.y = tableY + 12;

  // ---- PARTNERS ----
  doc.fontSize(10).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("ÉQUIPE DE LIVRAISON", "DELIVERY TEAM"), margin, doc.y);
  doc.font("Helvetica");
  doc.y += 3;
  doc.rect(margin, doc.y, 140, 1.5).fillColor(COLORS.gold).fill();
  doc.y += 8;

  const partners = getDeliveryPartners(ctx.lang);
  const partnerColW = (contentWidth - (partners.length - 1) * 8) / partners.length;
  const partnerH = 55;
  const partnerY = doc.y;

  partners.forEach((p, i) => {
    const px = margin + i * (partnerColW + 8);
    drawRoundedRect(doc, px, partnerY, partnerColW, partnerH, 6, COLORS.background);
    doc.roundedRect(px, partnerY, partnerColW, partnerH, 6).strokeColor(COLORS.borderGray).lineWidth(0.5).stroke();

    doc.fontSize(8).fillColor(COLORS.blue).font("Helvetica-Bold");
    doc.text(p.role, px + 6, partnerY + 6, { width: partnerColW - 12, align: "center" });
    doc.font("Helvetica").fontSize(7).fillColor(COLORS.darkGray);
    doc.text(p.name, px + 6, partnerY + 20, { width: partnerColW - 12, align: "center" });
    doc.fontSize(6).fillColor(COLORS.mediumGray);
    doc.text(p.qualification, px + 6, partnerY + 34, { width: partnerColW - 12, align: "center" });
  });

  doc.y = partnerY + partnerH + 12;

  // ---- WARRANTY ROADMAP ----
  doc.fontSize(10).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("PLAN DE SUPPORT ET GARANTIES", "WARRANTY & SUPPORT ROADMAP"), margin, doc.y);
  doc.font("Helvetica");
  doc.y += 3;
  doc.rect(margin, doc.y, 180, 1.5).fillColor(COLORS.gold).fill();
  doc.y += 8;

  const roadmap = getWarrantyRoadmap(ctx.lang);
  const rmColW = (contentWidth - (roadmap.length - 1) * 4) / roadmap.length;
  const rmH = 55;
  const rmY = doc.y;

  roadmap.forEach((rm, i) => {
    const rx = margin + i * (rmColW + 4);
    const isLast = i === roadmap.length - 1;
    const bgColor = isLast ? COLORS.blue : COLORS.background;
    const txtColor = isLast ? COLORS.white : COLORS.darkGray;

    drawRoundedRect(doc, rx, rmY, rmColW, rmH, 6, bgColor);
    if (!isLast) {
      doc.roundedRect(rx, rmY, rmColW, rmH, 6).strokeColor(COLORS.borderGray).lineWidth(0.5).stroke();
    }

    doc.fontSize(9).fillColor(isLast ? COLORS.gold : COLORS.blue).font("Helvetica-Bold");
    doc.text(rm.period, rx + 4, rmY + 6, { width: rmColW - 8, align: "center" });
    doc.font("Helvetica").fontSize(6.5).fillColor(txtColor);
    doc.text(rm.items.join("\n"), rx + 4, rmY + 22, { width: rmColW - 8, align: "center" });
  });

  doc.y = rmY + rmH + 10;

  // HQ Interconnection risk note
  drawRoundedRect(doc, margin, doc.y, contentWidth, 30, 6, "#FFF3CD");
  doc.fontSize(7).fillColor("#856404").font("Helvetica-Bold");
  doc.text(
    t("RISQUE INTERCONNEXION HQ", "HQ INTERCONNECTION RISK"),
    margin + 8,
    doc.y + 4,
    { width: contentWidth - 16 }
  );
  doc.font("Helvetica").fontSize(6.5).fillColor("#856404");
  doc.text(
    t(
      "kWh gère le processus complet d'interconnexion Hydro-Québec : demande, plans, inspection. Délai typique: 8-16 semaines. Risque: faible pour systèmes < 1 MW.",
      "kWh manages the complete Hydro-Québec interconnection process: application, plans, inspection. Typical delay: 8-16 weeks. Risk: low for systems < 1 MW."
    ),
    margin + 8,
    doc.y + 14,
    { width: contentWidth - 16 }
  );

  drawPageFooter(
    ctx,
    t("Document confidentiel | Généré par kWh Québec | Assurance de livraison", "Confidential document | Generated by kWh Québec | Delivery assurance")
  );
}
