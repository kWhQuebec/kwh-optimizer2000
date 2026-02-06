import type { PDFContext } from "../types";
import { COLORS } from "../types";
import { formatPercent, drawSimpleHeader, drawPageFooter } from "../helpers";
import { drawFrontierScatterChart, drawOptimizationLineChart } from "../charts";

export function renderOptimization(ctx: PDFContext) {
  const { doc, simulation, t, margin, contentWidth, pageWidth, pageHeight, dateStr } = ctx;

  const hasSensitivityData = simulation.sensitivity && (
    (simulation.sensitivity.frontier && simulation.sensitivity.frontier.length > 0) ||
    (simulation.sensitivity.solarSweep && simulation.sensitivity.solarSweep.length > 0) ||
    (simulation.sensitivity.batterySweep && simulation.sensitivity.batterySweep.length > 0)
  );

  doc.addPage();
  drawSimpleHeader(ctx);
  doc.moveDown(2);

  // Appendix label
  doc.fontSize(10).fillColor(COLORS.gold).font("Helvetica-Bold");
  doc.text(t("ANNEXE C", "APPENDIX C"), margin, doc.y);
  doc.font("Helvetica");
  doc.y += 5;

  if (hasSensitivityData) {
    doc.fontSize(14).fillColor(COLORS.blue).font("Helvetica-Bold");
    doc.text(t("ANALYSE D'OPTIMISATION", "OPTIMIZATION ANALYSIS"), margin, doc.y);
    doc.font("Helvetica");
    doc.moveDown(0.5);

    doc.fontSize(9).fillColor(COLORS.darkGray);
    doc.text(t(
      "Les graphiques ci-dessous montrent comment la VAN varie selon différentes configurations. Le point optimal est identifié.",
      "The charts below show how NPV varies with different system configurations. The optimal point is identified."
    ), margin, doc.y, { width: contentWidth });
    doc.moveDown(1);

    const chartHeight = 160;
    const halfWidth = (contentWidth - 10) / 2;

    // 1. Efficiency Frontier (full width)
    if (simulation.sensitivity!.frontier && simulation.sensitivity!.frontier.length > 0) {
      drawFrontierScatterChart(
        ctx,
        margin,
        doc.y,
        contentWidth,
        chartHeight,
        simulation.sensitivity!.frontier,
        t("Frontière d'efficacité (CAPEX vs VAN)", "Efficiency Frontier (CAPEX vs NPV)")
      );
      doc.y += chartHeight + 15;
    }

    // 2. Solar Sweep & Battery Sweep (side by side)
    const row2Y = doc.y;

    if (simulation.sensitivity!.solarSweep && simulation.sensitivity!.solarSweep.length > 0) {
      const solarData = simulation.sensitivity!.solarSweep.map(p => ({
        x: p.pvSizeKW,
        y: p.npv25,
        isOptimal: p.isOptimal
      }));
      drawOptimizationLineChart(
        ctx,
        margin,
        row2Y,
        halfWidth,
        chartHeight,
        solarData,
        t("Optimisation Solaire", "Solar Optimization"),
        t("Taille PV (kWc)", "PV Size (kWc)"),
        t("VAN 25 ans ($)", "NPV 25yr ($)"),
        COLORS.gold
      );
    }

    if (simulation.sensitivity!.batterySweep && simulation.sensitivity!.batterySweep.length > 0) {
      const batteryData = simulation.sensitivity!.batterySweep.map(p => ({
        x: p.battEnergyKWh,
        y: p.npv25,
        isOptimal: p.isOptimal
      }));
      drawOptimizationLineChart(
        ctx,
        margin + halfWidth + 10,
        row2Y,
        halfWidth,
        chartHeight,
        batteryData,
        t("Optimisation Batterie", "Battery Optimization"),
        t("Capacité (kWh)", "Capacity (kWh)"),
        t("VAN 25 ans ($)", "NPV 25yr ($)"),
        COLORS.blue
      );
    }

    doc.y = row2Y + chartHeight + 20;
  } else {
    // Basic page without charts
    doc.fontSize(14).fillColor(COLORS.blue).font("Helvetica-Bold");
    doc.text(t("PREUVES D'OPTIMISATION", "OPTIMIZATION PROOF"), margin, doc.y);
    doc.font("Helvetica");
    doc.moveDown(1.5);

    doc.fontSize(10).fillColor(COLORS.darkGray);
    doc.text(t(
      "Le système recommandé a été optimisé pour maximiser la Valeur Actuelle Nette (VAN) tout en respectant les contraintes de toiture et de budget.",
      "The recommended system was optimized to maximize Net Present Value (NPV) while respecting roof and budget constraints."
    ), margin, doc.y, { width: contentWidth });
    doc.moveDown(1);
  }

  // Key optimization metrics
  doc.fontSize(11).fillColor(COLORS.darkGray).font("Helvetica-Bold");
  doc.text(t("Configuration optimale recommandée", "Recommended optimal configuration"), margin, doc.y);
  doc.font("Helvetica");
  doc.moveDown(0.5);

  const optMetrics = [
    [t("Taille PV optimale", "Optimal PV size"), `${simulation.pvSizeKW.toFixed(0)} kWc`],
    [t("Capacité batterie optimale", "Optimal battery capacity"), `${simulation.battEnergyKWh.toFixed(0)} kWh / ${simulation.battPowerKW.toFixed(0)} kW`],
    [t("Autosuffisance atteinte", "Self-sufficiency achieved"), formatPercent(simulation.selfSufficiencyPercent / 100)],
    [t("Retour sur investissement", "Payback period"), `${simulation.simplePaybackYears.toFixed(1)} ${t("ans", "years")}`],
  ];

  let currentY = doc.y;
  optMetrics.forEach(([label, value]) => {
    doc.fontSize(9).fillColor(COLORS.mediumGray).text(label, margin + 20, currentY);
    doc.fillColor(COLORS.darkGray).font("Helvetica-Bold").text(value, margin + contentWidth - 150, currentY, { width: 130, align: "right" });
    doc.font("Helvetica");
    currentY += 18;
  });

  drawPageFooter(ctx, t("Document confidentiel | Généré par kWh Québec | Annexe C", "Confidential document | Generated by kWh Québec | Appendix C"));
}
