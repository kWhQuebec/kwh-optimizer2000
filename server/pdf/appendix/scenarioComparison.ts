import type { PDFContext, SimulationData } from "../types";
import { COLORS } from "../types";
import { formatCurrency, formatPercent, drawRoundedRect, drawSimpleHeader, drawPageFooter } from "../helpers";

export function renderScenarioComparison(ctx: PDFContext, allSiteSimulations: SimulationData[]) {
  const { doc, simulation, t, margin, contentWidth, pageWidth, pageHeight, dateStr } = ctx;

  const otherSimulations = allSiteSimulations.filter(s => s.id !== simulation.id);
  if (otherSimulations.length === 0) return;

  doc.addPage();
  drawSimpleHeader(ctx);
  doc.moveDown(2);

  // Appendix label
  doc.fontSize(10).fillColor(COLORS.gold).font("Helvetica-Bold");
  doc.text(t("ANNEXE A", "APPENDIX A"), margin, doc.y);
  doc.font("Helvetica");
  doc.y += 5;

  // Section title
  doc.fontSize(14).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("COMPARAISON DES SCÉNARIOS", "SCENARIO COMPARISON"), margin, doc.y);
  doc.font("Helvetica");
  doc.moveDown(0.5);

  doc.fontSize(9).fillColor(COLORS.mediumGray);
  doc.text(t("Cette analyse compare plusieurs configurations simulées pour ce site.",
    "This analysis compares multiple simulated configurations for this site."), margin, doc.y);
  doc.moveDown(1.5);

  const allScenarios = [simulation, ...otherSimulations]
    .sort((a, b) => (b.npv25 || 0) - (a.npv25 || 0));

  const seen = new Set<string>();
  const dedupedScenarios = allScenarios.filter(sim => {
    const key = `${(sim.pvSizeKW || 0).toFixed(0)}-${(sim.battEnergyKWh || 0).toFixed(0)}-${(sim.battPowerKW || 0).toFixed(0)}-${Math.round(sim.npv25 || 0)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 4);

  // Table header
  const tableY = doc.y;
  const colWidths = [140, 70, 70, 75, 60, 75];
  const rowHeight = 24;

  drawRoundedRect(doc, margin, tableY, contentWidth, rowHeight, 0, COLORS.blue);

  doc.fontSize(8).fillColor(COLORS.white).font("Helvetica-Bold");
  let colX = margin + 5;
  doc.text(t("Scénario", "Scenario"), colX, tableY + 7);
  colX += colWidths[0];
  doc.text(t("PV (kW)", "PV (kW)"), colX, tableY + 7);
  colX += colWidths[1];
  doc.text(t("Batterie", "Battery"), colX, tableY + 7);
  colX += colWidths[2];
  doc.text(t("VAN 25 ans", "NPV 25yr"), colX, tableY + 7);
  colX += colWidths[3];
  doc.text(t("TRI", "IRR"), colX, tableY + 7);
  colX += colWidths[4];
  doc.text(t("Retour", "Payback"), colX, tableY + 7);
  doc.font("Helvetica");

  let currentY = tableY + rowHeight;
  dedupedScenarios.forEach((sim, idx) => {
    const isCurrentSim = sim.id === simulation.id;
    const rowBg = isCurrentSim ? "#E8F0FE" : (idx % 2 === 0 ? COLORS.white : COLORS.background);

    doc.rect(margin, currentY, contentWidth, rowHeight).fillColor(rowBg).fill();

    if (isCurrentSim) {
      doc.rect(margin, currentY, contentWidth, rowHeight).strokeColor(COLORS.blue).lineWidth(1).stroke();
    }

    doc.fontSize(8).fillColor(COLORS.darkGray);
    colX = margin + 5;

    const scenarioName = isCurrentSim
      ? `${(sim.pvSizeKW || 0).toFixed(0)} kWc ${t("(Proposé)", "(Proposed)")}`
      : `${(sim.pvSizeKW || 0).toFixed(0)} kWc ${sim.battEnergyKWh > 0 ? `+ ${sim.battEnergyKWh.toFixed(0)} kWh` : t("(solaire)", "(solar)")}`;
    doc.text(scenarioName, colX, currentY + 7, { width: colWidths[0] - 10 });
    colX += colWidths[0];

    doc.text(`${(sim.pvSizeKW || 0).toFixed(0)}`, colX, currentY + 7);
    colX += colWidths[1];

    doc.text(`${(sim.battEnergyKWh || 0).toFixed(0)} / ${(sim.battPowerKW || 0).toFixed(0)}`, colX, currentY + 7);
    colX += colWidths[2];

    doc.fillColor((sim.npv25 || 0) > 0 ? COLORS.green : COLORS.red);
    doc.text(formatCurrency(sim.npv25), colX, currentY + 7);
    colX += colWidths[3];

    doc.fillColor((sim.irr25 || 0) > 0.05 ? COLORS.green : COLORS.mediumGray);
    doc.text(formatPercent(sim.irr25), colX, currentY + 7);
    colX += colWidths[4];

    doc.fillColor(COLORS.darkGray);
    const payback = sim.simplePaybackYears || 0;
    doc.text(payback > 0 ? `${payback.toFixed(1)} ${t("ans", "yr")}` : "-", colX, currentY + 7);

    currentY += rowHeight;
  });

  doc.rect(margin, tableY, contentWidth, (dedupedScenarios.length + 1) * rowHeight).strokeColor(COLORS.borderGray).lineWidth(0.5).stroke();

  doc.y = currentY + 15;

  const bestScenario = dedupedScenarios[0];
  if (bestScenario.id === simulation.id) {
    doc.fontSize(9).fillColor(COLORS.green).font("Helvetica-Bold");
    doc.text(t("Le scénario présenté dans ce rapport offre le meilleur rendement.",
      "The scenario presented in this report offers the best return."), margin, doc.y);
  } else {
    doc.fontSize(9).fillColor(COLORS.blue).font("Helvetica-Bold");
    doc.text(t("Contactez-nous pour discuter du scénario optimal pour vos besoins.",
      "Contact us to discuss the optimal scenario for your needs."), margin, doc.y);
  }
  doc.font("Helvetica");

  drawPageFooter(ctx, t("Document confidentiel | Généré par kWh Québec | Annexe A", "Confidential document | Generated by kWh Québec | Appendix A"));
}
