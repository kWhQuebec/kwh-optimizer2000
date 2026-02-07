import type { PDFContext } from "../types";
import { COLORS } from "../types";
import { drawRoundedRect } from "../helpers";
import { getDesignFeeCovers, getClientProvides, getClientReceives } from "@shared/brandContent";

export function renderNextSteps(ctx: PDFContext) {
  const { doc, t, margin, contentWidth } = ctx;

  // Next Steps Section
  doc.fontSize(14).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("PROCHAINES ÉTAPES", "NEXT STEPS"), margin, doc.y);
  doc.font("Helvetica");
  doc.y += 5;
  doc.rect(margin, doc.y, 160, 2).fillColor(COLORS.gold).fill();
  doc.y += 15;

  // 3 blocks side by side
  const nsColWidth = (contentWidth - 20) / 3;
  const nsY = doc.y;
  const nsBlockH = 175;

  // Block A: Design fee covers
  drawRoundedRect(doc, margin, nsY, nsColWidth, nsBlockH, 6, COLORS.background);
  doc.roundedRect(margin, nsY, nsColWidth, nsBlockH, 6).strokeColor(COLORS.blue).lineWidth(1).stroke();

  doc.fontSize(9).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Ce que couvre le", "What the design"), margin + 10, nsY + 10, { width: nsColWidth - 20 });
  doc.text(t("Design Fee (2 500$ + taxes)", "fee covers ($2,500 + taxes)"), margin + 10, nsY + 22, { width: nsColWidth - 20 });
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

  // Block B: Client provides
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

  // Block C: Client receives
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
}
