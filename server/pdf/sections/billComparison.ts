import type { PDFContext } from "../types";
import { COLORS } from "../types";
import { drawSimpleHeader, formatCurrency, drawRoundedRect } from "../helpers";

export function renderBillComparison(ctx: PDFContext) {
  const { doc, simulation, t, margin, contentWidth, pageWidth, pageHeight } = ctx;

  const annualCostBefore = simulation.annualCostBefore || 0;
  const annualCostAfter = simulation.annualCostAfter || 0;
  const annualSavings = simulation.annualSavings || 0;
  const savingsPercent = annualCostBefore > 0 ? (annualSavings / annualCostBefore) * 100 : 0;

  if (annualCostBefore <= 0 || savingsPercent < 10) return;

  doc.addPage();
  drawSimpleHeader(ctx);
  doc.moveDown(2);

  doc.fontSize(22).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("VOTRE FACTURE AVANT / APRÈS", "YOUR BILL BEFORE / AFTER"), margin, doc.y);
  doc.font("Helvetica");
  doc.y += 8;
  doc.rect(margin, doc.y, 200, 3).fillColor(COLORS.gold).fill();
  doc.y += 15;

  const savingsPct = annualCostBefore > 0 ? ((annualSavings / annualCostBefore) * 100).toFixed(0) : "0";
  doc.fontSize(14).fillColor(COLORS.gold).font("Helvetica-Bold");
  doc.text(t(`Réduction de ${savingsPct} % sur votre facture annuelle`, `${savingsPct}% reduction on your annual bill`), margin, doc.y, { align: "center", width: contentWidth });
  doc.font("Helvetica");
  doc.y += 30;

  const cardWidth = (contentWidth - 30) / 2;
  const cardHeight = 140;
  const leftX = margin;
  const rightX = margin + cardWidth + 30;
  const cardY = doc.y;

  drawRoundedRect(doc, leftX, cardY, cardWidth, cardHeight, 8, "#FEF2F2");
  doc.roundedRect(leftX, cardY, cardWidth, cardHeight, 8).strokeColor("#FECACA").lineWidth(1).stroke();

  doc.fontSize(12).fillColor(COLORS.mediumGray).font("Helvetica-Bold");
  doc.text(t("AUJOURD'HUI", "TODAY"), leftX + 15, cardY + 15, { width: cardWidth - 30 });
  doc.font("Helvetica");

  doc.fontSize(11).fillColor(COLORS.lightGray);
  doc.text(t("Facture annuelle actuelle", "Current annual bill"), leftX + 15, cardY + 35, { width: cardWidth - 30 });

  doc.fontSize(28).fillColor("#DC2626").font("Helvetica-Bold");
  doc.text(formatCurrency(annualCostBefore), leftX + 15, cardY + 65, { width: cardWidth - 30 });
  doc.font("Helvetica");

  doc.fontSize(9).fillColor(COLORS.lightGray);
  doc.text(t("/ année", "/ year"), leftX + 15, cardY + 100, { width: cardWidth - 30 });

  drawRoundedRect(doc, rightX, cardY, cardWidth, cardHeight, 8, "#F0FDF4");
  doc.roundedRect(rightX, cardY, cardWidth, cardHeight, 8).strokeColor("#BBF7D0").lineWidth(1).stroke();

  doc.fontSize(12).fillColor(COLORS.mediumGray).font("Helvetica-Bold");
  doc.text(t("AVEC SOLAIRE", "WITH SOLAR"), rightX + 15, cardY + 15, { width: cardWidth - 30 });
  doc.font("Helvetica");

  doc.fontSize(11).fillColor(COLORS.lightGray);
  doc.text(t("Facture annuelle estimée", "Estimated annual bill"), rightX + 15, cardY + 35, { width: cardWidth - 30 });

  doc.fontSize(28).fillColor("#16A34A").font("Helvetica-Bold");
  doc.text(formatCurrency(annualCostAfter), rightX + 15, cardY + 65, { width: cardWidth - 30 });
  doc.font("Helvetica");

  doc.fontSize(9).fillColor(COLORS.lightGray);
  doc.text(t("/ année", "/ year"), rightX + 15, cardY + 100, { width: cardWidth - 30 });

  doc.y = cardY + cardHeight + 20;

  const bannerH = 50;
  drawRoundedRect(doc, margin, doc.y, contentWidth, bannerH, 8, COLORS.gold);
  doc.fontSize(18).fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text(formatCurrency(annualSavings), margin, doc.y + 8, { width: contentWidth, align: "center" });
  doc.font("Helvetica");
  doc.fontSize(11).fillColor(COLORS.white);
  doc.text(t("d'économies par année", "savings per year"), margin, doc.y + 32, { width: contentWidth, align: "center" });

  doc.y += bannerH + 30;

  const total25yr = annualSavings * 25;
  doc.fontSize(11).fillColor(COLORS.mediumGray);
  doc.text(t(
    `Sur 25 ans, cela représente des économies cumulées estimées de ${formatCurrency(total25yr)}.`,
    `Over 25 years, this represents estimated cumulative savings of ${formatCurrency(total25yr)}.`
  ), margin, doc.y, { width: contentWidth, align: "center" });

  doc.moveDown(1.5);
  doc.fontSize(9).fillColor(COLORS.lightGray);
  doc.text(t(
    "Ces économies sont nettes — elles tiennent compte de tous les coûts d'opération et maintenance du système solaire.",
    "These savings are net — they account for all solar system operating and maintenance costs."
  ), margin, doc.y, { width: contentWidth, align: "center" });
}
