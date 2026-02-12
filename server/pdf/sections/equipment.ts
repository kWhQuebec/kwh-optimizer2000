import type { PDFContext } from "../types";
import { COLORS } from "../types";
import { drawRoundedRect, drawPageHeader, drawPageFooter } from "../helpers";
import { getEquipment, getEquipmentTechnicalSummary } from "@shared/brandContent";

export function renderEquipment(ctx: PDFContext) {
  const { doc, t, margin, contentWidth } = ctx;

  // Equipment + Timeline share this page
  doc.addPage();
  drawPageHeader(ctx, t("ÉQUIPEMENT ET ÉCHÉANCIER", "EQUIPMENT & TIMELINE"));
  doc.y = ctx.headerHeight + 25;

  // Equipment Section Title
  doc.fontSize(16).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("ÉQUIPEMENT ET GARANTIES", "EQUIPMENT & WARRANTIES"), margin, doc.y);
  doc.font("Helvetica");
  doc.y += 5;
  doc.rect(margin, doc.y, 180, 2).fillColor(COLORS.gold).fill();
  doc.y += 15;

  // Use dynamic catalog data if available, otherwise fall back to brandContent
  if (ctx.catalogEquipment && ctx.catalogEquipment.length > 0) {
    const eqCardWidth = (contentWidth - 30) / Math.min(ctx.catalogEquipment.length, 4);
    const eqCardHeight = 80;

    ctx.catalogEquipment.slice(0, 4).forEach((eq, idx) => {
      const ex = margin + idx * (eqCardWidth + 10);
      drawRoundedRect(doc, ex, doc.y, eqCardWidth, eqCardHeight, 6, COLORS.background);
      doc.roundedRect(ex, doc.y, eqCardWidth, eqCardHeight, 6).strokeColor(COLORS.lightGray).lineWidth(0.5).stroke();

      doc.fontSize(8).fillColor(COLORS.darkGray).font("Helvetica-Bold");
      doc.text(eq.name, ex + 8, doc.y + 8, { width: eqCardWidth - 16, align: "center" });
      doc.font("Helvetica");
      doc.fontSize(7).fillColor(COLORS.mediumGray);
      doc.text(eq.manufacturer, ex + 8, doc.y + 22, { width: eqCardWidth - 16, align: "center" });
      doc.fontSize(11).fillColor(COLORS.blue).font("Helvetica-Bold");
      doc.text(eq.warranty, ex + 8, doc.y + 40, { width: eqCardWidth - 16, align: "center" });
      doc.font("Helvetica");
      doc.fontSize(7).fillColor(COLORS.mediumGray);
      doc.text(eq.spec, ex + 8, doc.y + 58, { width: eqCardWidth - 16, align: "center" });
    });

    doc.y += eqCardHeight + 10;
  } else {
    const equipment = getEquipment(ctx.lang);
    const eqCardWidth = (contentWidth - 30) / 4;
    const eqCardHeight = 85;

    equipment.forEach((eq: any, idx: number) => {
      const ex = margin + idx * (eqCardWidth + 10);
      drawRoundedRect(doc, ex, doc.y, eqCardWidth, eqCardHeight, 6, COLORS.background);
      doc.roundedRect(ex, doc.y, eqCardWidth, eqCardHeight, 6).strokeColor(COLORS.lightGray).lineWidth(0.5).stroke();

      doc.fontSize(8).fillColor(COLORS.darkGray).font("Helvetica-Bold");
      doc.text(eq.label, ex + 8, doc.y + 8, { width: eqCardWidth - 16, align: "center" });
      doc.font("Helvetica");
      
      // Specs line
      if (eq.specs) {
        doc.fontSize(6).fillColor(COLORS.mediumGray);
        doc.text(eq.specs, ex + 8, doc.y + 22, { width: eqCardWidth - 16, align: "center" });
      }
      
      // Weight line
      if (eq.weightKg) {
        doc.fontSize(6).fillColor(COLORS.mediumGray);
        doc.text(`${eq.weightKg} kg`, ex + 8, doc.y + 32, { width: eqCardWidth - 16, align: "center" });
      }
      
      doc.fontSize(11).fillColor(COLORS.blue).font("Helvetica-Bold");
      doc.text(eq.warranty, ex + 8, doc.y + 48, { width: eqCardWidth - 16, align: "center" });
      doc.font("Helvetica");
      doc.fontSize(7).fillColor(COLORS.mediumGray);
      doc.text(t("garantie", "warranty"), ex + 8, doc.y + 63, { width: eqCardWidth - 16, align: "center" });
    });

    doc.y += eqCardHeight + 10;
  }

  doc.fontSize(8).fillColor(COLORS.mediumGray);
  doc.text(t("Équipement indicatif — sélection finale après conception détaillée", "Indicative equipment — final selection after detailed design"), margin, doc.y, { width: contentWidth, align: "center" });

  // Structural Load Summary
  const techSummary = getEquipmentTechnicalSummary(ctx.lang);
  doc.y += 5;

  doc.fontSize(10).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("DONNÉES STRUCTURELLES", "STRUCTURAL DATA"), margin, doc.y);
  doc.font("Helvetica");
  doc.y += 3;
  doc.rect(margin, doc.y, 120, 2).fillColor(COLORS.gold).fill();
  doc.y += 8;

  const structRows = [
    { label: techSummary.panelWeightKgPerM2.label, value: `${techSummary.panelWeightKgPerM2.value} ${techSummary.panelWeightKgPerM2.unit}` },
    { label: techSummary.rackingWeightKgPerM2.label, value: `${techSummary.rackingWeightKgPerM2.value} ${techSummary.rackingWeightKgPerM2.unit}` },
    { label: techSummary.totalSystemWeightKgPerM2.label, value: `${techSummary.totalSystemWeightKgPerM2.value} ${techSummary.totalSystemWeightKgPerM2.unit} (${techSummary.totalSystemWeightPsfPerSf.value} ${techSummary.totalSystemWeightPsfPerSf.unit})`, bold: true },
  ];

  const rowH = 16;
  const labelColW = contentWidth * 0.65;
  const valueColW = contentWidth * 0.35;

  // Header
  drawRoundedRect(doc, margin, doc.y, contentWidth, rowH, 0, COLORS.blue);
  doc.fontSize(7).fillColor("#FFFFFF").font("Helvetica-Bold");
  doc.text(t("Paramètre", "Parameter"), margin + 6, doc.y + 4, { width: labelColW - 12 });
  doc.text(t("Valeur", "Value"), margin + labelColW + 6, doc.y + 4, { width: valueColW - 12 });
  doc.font("Helvetica");
  doc.y += rowH;

  structRows.forEach((row, i) => {
    const bg = i % 2 === 0 ? COLORS.background : "#FFFFFF";
    drawRoundedRect(doc, margin, doc.y, contentWidth, rowH, 0, bg);
    doc.fontSize(7).fillColor(COLORS.darkGray);
    doc.text(row.label, margin + 6, doc.y + 4, { width: labelColW - 12 });
    if ((row as any).bold) {
      doc.font("Helvetica-Bold").fillColor(COLORS.blue);
    }
    doc.text(row.value, margin + labelColW + 6, doc.y + 4, { width: valueColW - 12 });
    doc.font("Helvetica");
    doc.y += rowH;
  });

  // Wind/snow note
  doc.fontSize(6).fillColor(COLORS.mediumGray);
  doc.text(`${techSummary.windLoadDesign} | ${techSummary.snowLoadNote}`, margin, doc.y + 2, { width: contentWidth, align: "center" });
  doc.y += 15;
}
