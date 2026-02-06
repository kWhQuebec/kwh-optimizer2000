import path from "path";
import fs from "fs";
import type { PDFContext } from "../types";
import { COLORS } from "../types";

export function renderCover(ctx: PDFContext) {
  const { doc, simulation, t, margin, pageWidth, pageHeight, contentWidth } = ctx;

  // Try to load brand installation image as background
  const coverImagePath = path.join(process.cwd(), "attached_assets", "kWh__Quebec_Brand_Guideline_1764967501349.jpg");

  if (fs.existsSync(coverImagePath)) {
    try {
      doc.image(coverImagePath, 0, 0, { width: pageWidth, height: pageHeight });
    } catch (e) {
      doc.rect(0, 0, pageWidth, pageHeight).fillColor(COLORS.blue).fill();
    }
  } else {
    doc.rect(0, 0, pageWidth, pageHeight).fillColor(COLORS.blue).fill();
  }

  // Dark overlay for text readability
  doc.rect(0, 0, pageWidth, pageHeight).fillColor("black").fillOpacity(0.55).fill();
  doc.fillOpacity(1);

  // Logo
  try {
    const coverLogoPath = path.join(process.cwd(), "client", "public", "assets", ctx.lang === "fr" ? "logo-fr-white.png" : "logo-en-white.png");
    doc.image(coverLogoPath, margin, margin, { width: 160 });
  } catch (e) {
    doc.fontSize(28).fillColor(COLORS.white).font("Helvetica-Bold");
    doc.text("kWh", margin, margin, { continued: true });
    doc.fillColor(COLORS.gold).text(" Québec", { continued: false });
    doc.font("Helvetica");
    doc.fontSize(12).fillColor(COLORS.white);
    doc.text(t("SOLAIRE + STOCKAGE", "SOLAR + STORAGE"), margin, margin + 32);
  }

  // Main title
  const centerY = pageHeight / 2 - 80;
  doc.fontSize(36).fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text(t("ÉTUDE PRÉLIMINAIRE", "PRELIMINARY STUDY"), margin, centerY, { width: contentWidth, align: "center" });
  doc.font("Helvetica");

  doc.fontSize(28).fillColor(COLORS.gold);
  doc.text(t("SOLAIRE + STOCKAGE", "SOLAR + STORAGE"), margin, centerY + 48, { width: contentWidth, align: "center" });

  // Gold accent line
  doc.rect(pageWidth / 2 - 100, centerY + 95, 200, 4).fillColor(COLORS.gold).fill();

  // Site name
  doc.fontSize(22).fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text(simulation.site.name, margin, centerY + 120, { width: contentWidth, align: "center" });
  doc.font("Helvetica");

  // Location
  const locationText = [simulation.site.city, simulation.site.province || "QC"].filter(Boolean).join(", ");
  doc.fontSize(14).fillColor(COLORS.white).fillOpacity(0.9);
  doc.text(locationText || "Québec", margin, centerY + 150, { width: contentWidth, align: "center" });
  doc.fillOpacity(1);

  // Client info at bottom
  const bottomY = pageHeight - 150;
  if (simulation.site.client?.name) {
    doc.fontSize(12).fillColor(COLORS.white).fillOpacity(0.8);
    doc.text(t("Préparé pour:", "Prepared for:"), margin, bottomY, { width: contentWidth, align: "center" });
    doc.fillOpacity(1);

    doc.fontSize(18).fillColor(COLORS.white).font("Helvetica-Bold");
    doc.text(simulation.site.client.name, margin, bottomY + 18, { width: contentWidth, align: "center" });
    doc.font("Helvetica");
  }

  // Date
  const coverDateStr = new Date().toLocaleDateString(ctx.lang === "fr" ? "fr-CA" : "en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  doc.fontSize(12).fillColor(COLORS.white).fillOpacity(0.7);
  doc.text(coverDateStr, margin, pageHeight - 60, { width: contentWidth, align: "center" });
  doc.fillOpacity(1);
}
