import type { PDFContext } from "../types";
import { COLORS } from "../types";
import { drawRoundedRect, drawPageHeader, drawPageFooter, formatSmartPower, formatSmartEnergy } from "../helpers";
import { getProjectSnapshotLabels } from "@shared/brandContent";

export function renderProjectSnapshot(ctx: PDFContext) {
  const { doc, simulation, t, margin, contentWidth, pageWidth, pageHeight, headerHeight } = ctx;

  doc.addPage();

  // Header
  drawPageHeader(ctx, t("APERÇU DU PROJET", "PROJECT SNAPSHOT"));

  doc.y = headerHeight + 25;

  // Section title
  doc.fontSize(22).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("APERÇU DU PROJET", "PROJECT SNAPSHOT"), margin, doc.y);
  doc.font("Helvetica");
  doc.y += 8;
  doc.rect(margin, doc.y, 180, 3).fillColor(COLORS.gold).fill();
  doc.y += 15;

  doc.fontSize(14).fillColor(COLORS.gold).font("Helvetica-Bold");
  doc.text(t(`Système de ${formatSmartPower(simulation.pvSizeKW, ctx.lang, "kWc")} proposé`, `Proposed ${formatSmartPower(simulation.pvSizeKW, ctx.lang, "kWc")} system`), margin, doc.y, { width: contentWidth });
  doc.font("Helvetica");
  doc.y += 25;

  // Site info
  doc.fontSize(14).fillColor(COLORS.darkGray).font("Helvetica-Bold");
  doc.text(simulation.site.name, margin, doc.y);
  doc.font("Helvetica");
  doc.fontSize(11).fillColor(COLORS.mediumGray);
  const snapLocation = [simulation.site.address, simulation.site.city, simulation.site.province || "QC"].filter(Boolean).join(", ");
  doc.text(snapLocation || "Québec", margin, doc.y + 20);
  doc.y += 50;

  // Snapshot data grid - 4 main metrics in 2x2
  const snapLabels = getProjectSnapshotLabels(ctx.lang);
  const mainMetrics: [string, string][] = [
    [snapLabels.annualConsumption.label, formatSmartEnergy(simulation.annualConsumptionKWh, ctx.lang)],
    [snapLabels.peakDemand.label, formatSmartPower(simulation.peakDemandKW, ctx.lang, "kW")],
    [snapLabels.solarCapacity.label, formatSmartPower(simulation.pvSizeKW, ctx.lang, "kWc")],
    [snapLabels.batteryCapacity.label, (simulation.battEnergyKWh || 0) > 0 ? `${formatSmartEnergy(simulation.battEnergyKWh, ctx.lang)} / ${formatSmartPower(simulation.battPowerKW, ctx.lang, "kW")}` : "0 kWh"],
  ];

  const snapColWidth = (contentWidth - 20) / 2;
  const snapRowHeight = 65;
  mainMetrics.forEach(([label, value], idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const sx = margin + col * (snapColWidth + 20);
    const sy = doc.y + row * (snapRowHeight + 10);

    drawRoundedRect(doc, sx, sy, snapColWidth, snapRowHeight, 6, COLORS.background);
    doc.roundedRect(sx, sy, snapColWidth, snapRowHeight, 6).strokeColor(COLORS.lightGray).lineWidth(0.5).stroke();

    doc.fontSize(9).fillColor(COLORS.mediumGray);
    doc.text(label, sx + 12, sy + 10, { width: snapColWidth - 24 });
    doc.fontSize(18).fillColor(COLORS.blue).font("Helvetica-Bold");
    doc.text(value, sx + 12, sy + 28, { width: snapColWidth - 24 });
    doc.font("Helvetica");
  });

  doc.y += 2 * (snapRowHeight + 10) + 15;

  // Bottom row: 4 compact metrics (LCOE, CO2, Year-1 production, Solar self-sufficiency)
  const lcoe = simulation.lcoe || 0;
  const co2 = simulation.co2AvoidedTonnesPerYear || 0;
  const yearOneProduction = Math.round(((simulation.pvSizeKW || 0) * 1035) || 0);
  const selfSufficiency = (simulation.selfSufficiencyPercent || 0).toFixed(0);

  const compactCardWidth = (contentWidth - 30) / 4;
  const compactCardHeight = 40;
  const compactCards = [
    { label: t("COÛT ACTUALISÉ DE L'ÉNERGIE (LCOE)", "LEVELIZED COST OF ENERGY (LCOE)"), value: `${lcoe.toFixed(3)} $/kWh`, isBlue: true },
    { label: t("CO₂ ÉVITÉ PAR ANNÉE", "CO₂ AVOIDED PER YEAR"), value: `${co2.toFixed(1)} ${t("tonnes", "tonnes")}`, isBlue: true },
    { label: snapLabels.estimatedProduction.label, value: formatSmartEnergy(yearOneProduction, ctx.lang), isBlue: false },
    { label: t("Autosuffisance solaire", "Solar self-sufficiency"), value: `${selfSufficiency}%`, isBlue: false },
  ];

  compactCards.forEach((card, idx) => {
    const cx = margin + idx * (compactCardWidth + 10);
    const cy = doc.y;

    if (card.isBlue) {
      drawRoundedRect(doc, cx, cy, compactCardWidth, compactCardHeight, 6, COLORS.blue);
      doc.fontSize(9).fillColor(COLORS.white);
      doc.text(card.label, cx + 8, cy + 4, { width: compactCardWidth - 16 });
      doc.fontSize(13).fillColor(COLORS.gold).font("Helvetica-Bold");
      doc.text(card.value, cx + 8, cy + 20, { width: compactCardWidth - 16 });
      doc.font("Helvetica");
    } else {
      drawRoundedRect(doc, cx, cy, compactCardWidth, compactCardHeight, 6, COLORS.background);
      doc.roundedRect(cx, cy, compactCardWidth, compactCardHeight, 6).strokeColor(COLORS.lightGray).lineWidth(0.5).stroke();
      doc.fontSize(9).fillColor(COLORS.mediumGray);
      doc.text(card.label, cx + 8, cy + 4, { width: compactCardWidth - 16 });
      doc.fontSize(13).fillColor(COLORS.blue).font("Helvetica-Bold");
      doc.text(card.value, cx + 8, cy + 20, { width: compactCardWidth - 16 });
      doc.font("Helvetica");
    }
  });

  // Footer
  drawPageFooter(ctx, t("Document confidentiel | Généré par kWh Québec | Aperçu du projet", "Confidential document | Generated by kWh Québec | Project snapshot"));
}
