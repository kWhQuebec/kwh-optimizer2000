import path from "path";
import type { PDFContext } from "./types";
import { COLORS } from "./types";

export function formatCurrency(value: number | null | undefined, compact = false): string {
  if (value === null || value === undefined || isNaN(value)) {
    return "0 $";
  }
  if (compact && Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(0)}k $`;
  }
  return `${value.toLocaleString("fr-CA", { maximumFractionDigits: 0 })} $`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return "0.0 %";
  }
  return `${(value * 100).toFixed(1)} %`;
}

export function drawRoundedRect(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill?: string,
  stroke?: string
) {
  doc.roundedRect(x, y, width, height, radius);
  if (fill) {
    doc.fillColor(fill).fill();
  }
  if (stroke) {
    doc.strokeColor(stroke).stroke();
  }
}

export function drawKPICard(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  value: string,
  subtitle?: string,
  highlight = false
) {
  drawRoundedRect(doc, x, y, width, height, 8, highlight ? COLORS.blue : COLORS.white);
  doc.roundedRect(x, y, width, height, 8).strokeColor(COLORS.borderGray).lineWidth(1).stroke();

  doc.fontSize(9).fillColor(highlight ? COLORS.white : COLORS.mediumGray);
  doc.text(label.toUpperCase(), x + 10, y + 12, { width: width - 20, align: "center", lineBreak: false });

  const valueFontSize = value.length > 15 ? 11 : value.length > 12 ? 13 : value.length > 9 ? 15 : value.length > 6 ? 17 : 20;
  doc.fontSize(valueFontSize).fillColor(highlight ? COLORS.gold : COLORS.blue).font("Helvetica-Bold");
  doc.text(value, x + 10, y + 32, { width: width - 20, align: "center", lineBreak: false });
  doc.font("Helvetica");

  if (subtitle) {
    doc.fontSize(8).fillColor(highlight ? COLORS.white : COLORS.lightGray);
    doc.text(subtitle, x + 10, y + 60, { width: width - 20, align: "center" });
  }
}

export function drawPageHeader(ctx: PDFContext, subtitle?: string) {
  const { doc, t, margin, contentWidth, dateStr, pageWidth, headerHeight } = ctx;

  doc.rect(0, 0, pageWidth, headerHeight).fillColor(COLORS.blue).fill();
  doc.rect(0, headerHeight - 4, pageWidth, 4).fillColor(COLORS.gold).fill();

  try {
    const logoPath = path.join(process.cwd(), "client", "public", "assets", ctx.lang === "fr" ? "logo-fr-white.png" : "logo-en-white.png");
    doc.image(logoPath, margin, 8, { width: 120 });
  } catch (e) {
    doc.fontSize(28).fillColor(COLORS.white).font("Helvetica-Bold");
    doc.text("kWh Québec", margin, 20);
    doc.font("Helvetica");
  }

  if (subtitle) {
    doc.fontSize(10).fillColor(COLORS.gold);
    doc.text(subtitle, margin, 52);
  }

  doc.fontSize(10).fillColor(COLORS.white);
  doc.text(dateStr, margin, 35, { align: "right", width: contentWidth });
}

export function drawSimpleHeader(ctx: PDFContext) {
  const { doc, t, margin, contentWidth, dateStr } = ctx;
  doc.fontSize(10).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("ÉTUDE PRÉLIMINAIRE : SOLAIRE + STOCKAGE", "PRELIMINARY STUDY: SOLAR + STORAGE"), margin, margin, { align: "center", width: contentWidth });
  doc.font("Helvetica");
  doc.fontSize(10).fillColor(COLORS.mediumGray);
  doc.text(dateStr, margin, margin, { align: "right", width: contentWidth });
}

export function drawPageFooter(ctx: PDFContext, label: string) {
  const { doc, margin, contentWidth, pageHeight } = ctx;
  doc.fontSize(8).fillColor(COLORS.lightGray);
  doc.text(label, margin, pageHeight - 30, { align: "center", width: contentWidth });
}
