import type { PDFContext } from "../types";
import { COLORS } from "../types";
import { drawRoundedRect, drawPageHeader } from "../helpers";
import { getEquipment } from "@shared/brandContent";

export function renderEquipment(ctx: PDFContext) {
  const { doc, t, margin, contentWidth, headerHeight } = ctx;

  // NOTE: This section is rendered on the same page as timeline + next steps.
  // The page is created by the orchestrator before calling this function.

  // Equipment Section
  doc.fontSize(14).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("ÉQUIPEMENT ET GARANTIES", "EQUIPMENT & WARRANTIES"), margin, doc.y);
  doc.font("Helvetica");
  doc.y += 5;
  doc.rect(margin, doc.y, 180, 2).fillColor(COLORS.gold).fill();
  doc.y += 15;

  // Use dynamic catalog data if available, otherwise fall back to brandContent
  if (ctx.catalogEquipment && ctx.catalogEquipment.length > 0) {
    // Dynamic: render from catalog/BOM
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
    // Fallback: static brandContent
    const equipment = getEquipment(ctx.lang);
    const eqCardWidth = (contentWidth - 30) / 4;
    const eqCardHeight = 65;

    equipment.forEach((eq: any, idx: number) => {
      const ex = margin + idx * (eqCardWidth + 10);
      drawRoundedRect(doc, ex, doc.y, eqCardWidth, eqCardHeight, 6, COLORS.background);
      doc.roundedRect(ex, doc.y, eqCardWidth, eqCardHeight, 6).strokeColor(COLORS.lightGray).lineWidth(0.5).stroke();

      doc.fontSize(8).fillColor(COLORS.darkGray).font("Helvetica-Bold");
      doc.text(eq.label, ex + 8, doc.y + 10, { width: eqCardWidth - 16, align: "center" });
      doc.font("Helvetica");
      doc.fontSize(11).fillColor(COLORS.blue).font("Helvetica-Bold");
      doc.text(eq.warranty, ex + 8, doc.y + 35, { width: eqCardWidth - 16, align: "center" });
      doc.font("Helvetica");
      doc.fontSize(7).fillColor(COLORS.mediumGray);
      doc.text(t("garantie", "warranty"), ex + 8, doc.y + 50, { width: eqCardWidth - 16, align: "center" });
    });

    doc.y += eqCardHeight + 10;
  }

  doc.fontSize(8).fillColor(COLORS.mediumGray);
  doc.text(t("Équipement indicatif — sélection finale après conception détaillée", "Indicative equipment — final selection after detailed design"), margin, doc.y, { width: contentWidth, align: "center" });

  doc.y += 25;
}
