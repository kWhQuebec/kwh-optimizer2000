import type { PDFContext } from "../types";
import { COLORS } from "../types";
import { drawRoundedRect } from "../helpers";
import { getTimeline } from "../../brandContent";

export function renderTimeline(ctx: PDFContext) {
  const { doc, t, margin, contentWidth } = ctx;

  // Timeline Section
  doc.fontSize(14).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("ÉCHÉANCIER TYPE", "TYPICAL TIMELINE"), margin, doc.y);
  doc.font("Helvetica");
  doc.y += 5;
  doc.rect(margin, doc.y, 160, 2).fillColor(COLORS.gold).fill();
  doc.y += 20;

  // Use dynamic construction data if available, otherwise fall back to brandContent
  const timelineData = ctx.constructionTimeline && ctx.constructionTimeline.length > 0
    ? ctx.constructionTimeline.map(item => ({ step: item.step, duration: item.duration }))
    : getTimeline(ctx.lang);

  const tlStepWidth = (contentWidth - (timelineData.length - 1) * 5) / timelineData.length;
  const tlY = doc.y;
  const tlStepH = 55;

  timelineData.forEach((tl: any, idx: number) => {
    const tx = margin + idx * (tlStepWidth + 5);

    const stepColor = idx === 0 ? COLORS.blue : (idx === timelineData.length - 1 ? COLORS.green : COLORS.background);
    const textColor = (idx === 0 || idx === timelineData.length - 1) ? COLORS.white : COLORS.darkGray;
    drawRoundedRect(doc, tx, tlY, tlStepWidth, tlStepH, 6, stepColor);

    doc.fontSize(9).fillColor(textColor).font("Helvetica-Bold");
    doc.text(tl.step, tx + 4, tlY + 10, { width: tlStepWidth - 8, align: "center" });
    doc.font("Helvetica");

    if (tl.duration) {
      doc.fontSize(8).fillColor(idx === 0 || idx === timelineData.length - 1 ? COLORS.white : COLORS.mediumGray);
      doc.text(tl.duration, tx + 4, tlY + 30, { width: tlStepWidth - 8, align: "center" });
    }

    if (idx < timelineData.length - 1) {
      const arrowX = tx + tlStepWidth + 1;
      doc.fontSize(12).fillColor(COLORS.gold).font("Helvetica-Bold");
      doc.text(">", arrowX, tlY + 18, { width: 5 });
      doc.font("Helvetica");
    }
  });

  doc.y = tlY + tlStepH + 10;
  doc.fontSize(8).fillColor(COLORS.mediumGray);
  doc.text(t("Délais sujets à approbation Hydro-Québec et conditions structurelles", "Timelines subject to Hydro-Québec approval and structural conditions"), margin, doc.y, { width: contentWidth, align: "center" });

  doc.y += 30;
}
