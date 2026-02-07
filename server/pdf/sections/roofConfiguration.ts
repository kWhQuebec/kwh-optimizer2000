import type { PDFContext } from "../types";
import { COLORS } from "../types";
import { drawRoundedRect, drawSimpleHeader, drawPageFooter } from "../helpers";
import { createLogger } from "../../lib/logger";

const log = createLogger("RoofConfiguration");

function orientationLabel(degrees: number | undefined | null, t: (fr: string, en: string) => string): string {
  if (degrees === undefined || degrees === null) return "N/A";
  const dirs = [
    { min: 337.5, max: 360, label: "N" },
    { min: 0, max: 22.5, label: "N" },
    { min: 22.5, max: 67.5, label: "NE" },
    { min: 67.5, max: 112.5, label: "E" },
    { min: 112.5, max: 157.5, label: "SE" },
    { min: 157.5, max: 202.5, label: "S" },
    { min: 202.5, max: 247.5, label: "SO/SW" },
    { min: 247.5, max: 292.5, label: "O/W" },
    { min: 292.5, max: 337.5, label: "NO/NW" },
  ];
  const d = degrees % 360;
  const dir = dirs.find(r => d >= r.min && d < r.max) || dirs[0];
  return `${dir.label} (${Math.round(d)}°)`;
}

export function renderRoofConfiguration(ctx: PDFContext) {
  const { doc, simulation, t, margin, contentWidth, pageWidth, pageHeight, dateStr } = ctx;

  if (!simulation.roofPolygons || simulation.roofPolygons.length === 0 || !simulation.site.latitude || !simulation.site.longitude) {
    return; // Skip if no roof data
  }

  doc.addPage();
  drawSimpleHeader(ctx);
  doc.moveDown(2);

  // Section title
  doc.fontSize(18).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("CONFIGURATION TOITURE", "ROOF CONFIGURATION"), margin, doc.y);
  doc.font("Helvetica");
  doc.y += 5;
  doc.rect(margin, doc.y, 180, 3).fillColor(COLORS.gold).fill();
  doc.moveDown(1.5);

  // Roof visualization image
  if (simulation.roofVisualizationBuffer) {
    try {
      const imageWidth = Math.min(460, contentWidth);
      const imageHeight = 290;
      const imageX = margin + (contentWidth - imageWidth) / 2;

      drawRoundedRect(doc, imageX - 4, doc.y - 4, imageWidth + 8, imageHeight + 8, 8, COLORS.white);
      doc.roundedRect(imageX - 4, doc.y - 4, imageWidth + 8, imageHeight + 8, 8).strokeColor(COLORS.borderGray).lineWidth(1).stroke();

      doc.image(simulation.roofVisualizationBuffer, imageX, doc.y, { width: imageWidth, height: imageHeight });
      doc.y += imageHeight + 20;
    } catch (imgError) {
      log.error("Failed to embed roof visualization:", imgError);
      doc.fontSize(10).fillColor(COLORS.lightGray);
      doc.text(t("Image de la toiture non disponible", "Roof image not available"), margin, doc.y, { align: "center", width: contentWidth });
      doc.moveDown(2);
    }
  } else {
    doc.fontSize(10).fillColor(COLORS.lightGray);
    doc.text(t("Image de la toiture en cours de chargement...", "Loading roof image..."), margin, doc.y, { align: "center", width: contentWidth });
    doc.moveDown(2);
  }

  // Legend
  const solarPolygons = simulation.roofPolygons.filter(p =>
    p.color !== "#f97316" &&
    !p.label?.toLowerCase().includes("constraint") &&
    !p.label?.toLowerCase().includes("contrainte")
  );
  const constraintPolygons = simulation.roofPolygons.filter(p =>
    p.color === "#f97316" ||
    p.label?.toLowerCase().includes("constraint") ||
    p.label?.toLowerCase().includes("contrainte")
  );

  const totalSolarArea = solarPolygons.reduce((sum, p) => sum + p.areaSqM, 0);
  const totalConstraintArea = constraintPolygons.reduce((sum, p) => sum + p.areaSqM, 0);
  const netArea = Math.max(0, totalSolarArea - totalConstraintArea);

  doc.fontSize(11).fillColor(COLORS.darkGray).font("Helvetica-Bold");
  doc.text(t("LÉGENDE", "LEGEND"), margin, doc.y);
  doc.font("Helvetica");
  doc.moveDown(0.5);

  doc.rect(margin, doc.y, 20, 12).fillColor("#3b82f6").fillOpacity(0.6).fill();
  doc.rect(margin, doc.y, 20, 12).strokeColor("#1e40af").lineWidth(1).stroke();
  doc.fillOpacity(1);
  doc.fontSize(10).fillColor(COLORS.darkGray);
  doc.text(t(`Zones solaires utilisables: ${Math.round(totalSolarArea).toLocaleString()} m²`,
    `Usable solar areas: ${Math.round(totalSolarArea).toLocaleString()} m²`), margin + 30, doc.y + 1);
  doc.y += 18;

  if (constraintPolygons.length > 0) {
    doc.rect(margin, doc.y, 20, 12).fillColor("#f97316").fillOpacity(0.6).fill();
    doc.rect(margin, doc.y, 20, 12).strokeColor("#f97316").lineWidth(1).stroke();
    doc.fillOpacity(1);
    doc.fontSize(10).fillColor(COLORS.darkGray);
    doc.text(t(`Zones de contraintes (CVC, obstacles): ${Math.round(totalConstraintArea).toLocaleString()} m²`,
      `Constraint areas (HVAC, obstacles): ${Math.round(totalConstraintArea).toLocaleString()} m²`), margin + 30, doc.y + 1);
    doc.y += 18;
  }

  doc.y += 10;
  doc.fontSize(12).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t(`Superficie nette utilisable: ${Math.round(netArea).toLocaleString()} m² (${Math.round(netArea * 10.764).toLocaleString()} pi²)`,
    `Net usable area: ${Math.round(netArea).toLocaleString()} m² (${Math.round(netArea * 10.764).toLocaleString()} sq ft)`), margin, doc.y);
  doc.font("Helvetica");
  doc.y += 25;

  // Per-zone sizing table
  if (solarPolygons.length > 0) {
    doc.fontSize(11).fillColor(COLORS.darkGray).font("Helvetica-Bold");
    doc.text(t("DIMENSIONNEMENT PAR ZONE", "SIZING BY ZONE"), margin, doc.y);
    doc.font("Helvetica");
    doc.y += 15;

    // Table header
    const colWidths = [160, 80, 100, 80, 70];
    const rowH = 22;
    const tableX = margin;
    let ty = doc.y;

    doc.rect(tableX, ty, contentWidth, rowH).fillColor(COLORS.blue).fill();
    doc.fontSize(8).fillColor(COLORS.white).font("Helvetica-Bold");
    let cx = tableX + 5;
    const headers = [
      t("Zone", "Zone"),
      t("Aire (m²)", "Area (m²)"),
      t("Orientation", "Orientation"),
      t("Panneaux", "Panels"),
      t("kWc", "kWp"),
    ];
    headers.forEach((h, i) => {
      doc.text(h, cx, ty + 6, { width: colWidths[i] - 10, align: i === 0 ? "left" : "center" });
      cx += colWidths[i];
    });
    doc.font("Helvetica");
    ty += rowH;

    let totalPanels = 0;
    let totalKWc = 0;

    solarPolygons.forEach((poly, idx) => {
      const bgColor = idx % 2 === 0 ? COLORS.white : COLORS.background;
      doc.rect(tableX, ty, contentWidth, rowH).fillColor(bgColor).fill();

      const area = poly.areaSqM;
      // KB Racking formula: (area_m² × utilization / 3.71) × 0.625 kW, assuming 500W panels
      const panels = Math.floor(area / 3.71 * 0.625 / 0.5);
      const kwc = panels * 0.5;
      totalPanels += panels;
      totalKWc += kwc;

      const orient = orientationLabel((poly as any).orientation, t);

      cx = tableX + 5;
      doc.fontSize(8).fillColor(COLORS.darkGray);
      doc.text(poly.label || `Zone ${idx + 1}`, cx, ty + 6, { width: colWidths[0] - 10 });
      cx += colWidths[0];
      doc.text(Math.round(area).toLocaleString(), cx, ty + 6, { width: colWidths[1] - 10, align: "center" });
      cx += colWidths[1];
      doc.text(orient, cx, ty + 6, { width: colWidths[2] - 10, align: "center" });
      cx += colWidths[2];
      doc.text(panels.toLocaleString(), cx, ty + 6, { width: colWidths[3] - 10, align: "center" });
      cx += colWidths[3];
      doc.text(kwc.toFixed(1), cx, ty + 6, { width: colWidths[4] - 10, align: "center" });
      ty += rowH;
    });

    // Total row
    doc.rect(tableX, ty, contentWidth, rowH).fillColor("#E8F0FE").fill();
    doc.fontSize(8).fillColor(COLORS.blue).font("Helvetica-Bold");
    cx = tableX + 5;
    doc.text(t("Total", "Total"), cx, ty + 6, { width: colWidths[0] - 10 });
    cx += colWidths[0];
    doc.text(Math.round(totalSolarArea).toLocaleString(), cx, ty + 6, { width: colWidths[1] - 10, align: "center" });
    cx += colWidths[1] + colWidths[2]; // skip orientation column
    doc.text(totalPanels.toLocaleString(), cx, ty + 6, { width: colWidths[3] - 10, align: "center" });
    cx += colWidths[3];
    doc.text(totalKWc.toFixed(1), cx, ty + 6, { width: colWidths[4] - 10, align: "center" });
    doc.font("Helvetica");

    // Table border
    doc.rect(tableX, doc.y, contentWidth, (solarPolygons.length + 2) * rowH).strokeColor(COLORS.borderGray).lineWidth(0.5).stroke();
  }

  drawPageFooter(ctx, t("Document confidentiel | Généré par kWh Québec | Configuration toiture", "Confidential document | Generated by kWh Québec | Roof configuration"));
}
