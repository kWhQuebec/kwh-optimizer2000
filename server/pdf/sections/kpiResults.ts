import path from "path";
import type { PDFContext } from "../types";
import { COLORS } from "../types";
import { drawKPICard, drawPageFooter, formatCurrency, formatPercent } from "../helpers";

export function renderKPIResults(ctx: PDFContext) {
  const { doc, simulation, t, margin, contentWidth, pageWidth, pageHeight, headerHeight, dateStr } = ctx;

  doc.addPage();

  // Professional branded header
  doc.rect(0, 0, pageWidth, headerHeight).fillColor(COLORS.blue).fill();
  doc.rect(0, headerHeight - 4, pageWidth, 4).fillColor(COLORS.gold).fill();

  try {
    const headerLogoPath = path.join(process.cwd(), "client", "public", "assets", ctx.lang === "fr" ? "logo-fr-white.png" : "logo-en-white.png");
    doc.image(headerLogoPath, margin, 8, { width: 120 });
  } catch (e) {
    doc.fontSize(28).fillColor(COLORS.white).font("Helvetica-Bold");
    doc.text("kWh Québec", margin, 20);
    doc.font("Helvetica");
  }

  doc.fontSize(10).fillColor(COLORS.gold);
  doc.text(t("ÉTUDE PRÉLIMINAIRE : SOLAIRE + STOCKAGE", "PRELIMINARY STUDY: SOLAR + STORAGE"), margin, 52);
  doc.fontSize(10).fillColor(COLORS.white);
  doc.text(dateStr, margin, 35, { align: "right", width: contentWidth });

  doc.y = headerHeight + 25;

  // Project Name & Location
  doc.fontSize(28).fillColor(COLORS.darkGray).font("Helvetica-Bold");
  doc.text(simulation.site.name, margin, doc.y, { align: "left" });
  doc.font("Helvetica");

  doc.y += 8;
  doc.rect(margin, doc.y, Math.min(contentWidth * 0.6, 300), 3).fillColor(COLORS.gold).fill();
  doc.y += 10;

  doc.fontSize(14).fillColor(COLORS.mediumGray);
  const location = [simulation.site.city, simulation.site.province || "QC"].filter(Boolean).join(", ");
  doc.text(location || "Québec", margin, doc.y);

  if (simulation.site.client?.name) {
    doc.y += 5;
    doc.fontSize(11).fillColor(COLORS.lightGray);
    doc.text(simulation.site.client.name, margin, doc.y);
  }

  // Section title
  doc.y += 30;
  doc.fontSize(18).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("VOS RÉSULTATS", "YOUR RESULTS"), margin, doc.y);
  doc.font("Helvetica");
  doc.y += 8;
  doc.rect(margin, doc.y, 140, 3).fillColor(COLORS.gold).fill();
  doc.y += 25;

  // 4 KPI Cards
  const cardY = doc.y;
  const cardWidth = (contentWidth - 30) / 4;
  const cardHeight = 80;

  drawKPICard(doc, margin, cardY, cardWidth, cardHeight,
    t("Économies An 1", "Year 1 Savings"),
    formatCurrency(simulation.savingsYear1 || simulation.annualSavings),
    ""
  );

  drawKPICard(doc, margin + cardWidth + 10, cardY, cardWidth, cardHeight,
    t("Investissement Net", "Net Investment"),
    formatCurrency(simulation.capexNet),
    ""
  );

  drawKPICard(doc, margin + 2 * (cardWidth + 10), cardY, cardWidth, cardHeight,
    t("Profit Net (VAN)", "Net Profit (NPV)"),
    formatCurrency(simulation.npv25),
    t("Sur 25 ans", "Over 25 years"),
    true
  );

  drawKPICard(doc, margin + 3 * (cardWidth + 10), cardY, cardWidth, cardHeight,
    t("Rendement (TRI)", "Return (IRR)"),
    formatPercent(simulation.irr25),
    t("25 ans", "25 years"),
    true
  );

  doc.y = cardY + cardHeight + 40;

  // Configuration + Finance 2-column summary
  doc.fontSize(14).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("ANALYSE DÉTAILLÉE", "DETAILED ANALYSIS"), margin, doc.y);
  doc.font("Helvetica");
  doc.moveDown(1);

  const colWidth = (contentWidth - 20) / 2;
  const colY = doc.y;

  // Configuration column
  doc.fontSize(11).fillColor(COLORS.darkGray).font("Helvetica-Bold");
  doc.text("CONFIGURATION", margin, colY);
  doc.font("Helvetica");
  doc.moveDown(0.5);

  const configData = [
    [t("Puissance solaire :", "Solar power:"), `${simulation.pvSizeKW.toFixed(0)} kWc`],
    [t("Capacité Batterie :", "Battery Capacity:"), `${simulation.battEnergyKWh.toFixed(0)} kWh`],
    [t("Puissance Batterie :", "Battery Power:"), `${simulation.battPowerKW.toFixed(1)} kW`],
    [t("Toiture totale :", "Total roof:"), `${(simulation.assumptions?.roofAreaSqFt || 0).toLocaleString()} pi²`],
    [t("Potentiel solaire :", "Solar potential:"), `${((simulation.assumptions?.roofAreaSqFt || 0) * (simulation.assumptions?.roofUtilizationRatio || 0.8)).toLocaleString()} pi²`],
  ];

  let currentY = doc.y;
  configData.forEach(([label, value]) => {
    doc.fontSize(10).fillColor(COLORS.mediumGray).text(label, margin, currentY, { continued: false });
    doc.fontSize(10).fillColor(COLORS.darkGray).font("Helvetica-Bold").text(value, margin + colWidth - 100, currentY, { width: 100, align: "right" });
    doc.font("Helvetica");
    currentY += 18;
  });

  // Finance column
  doc.fontSize(11).fillColor(COLORS.darkGray).font("Helvetica-Bold");
  doc.text("FINANCE", margin + colWidth + 20, colY);
  doc.font("Helvetica");

  const financeData = [
    [t("CAPEX brut :", "Gross CAPEX:"), formatCurrency(simulation.capexGross)],
    [t("Subventions totales :", "Total subsidies:"), `- ${formatCurrency(simulation.totalIncentives)}`],
    [t("VAN (10) :", "NPV (10):"), formatCurrency(simulation.npv10)],
    [t("LCOE (Coût Énergie) :", "LCOE (Energy Cost):"), `${simulation.lcoe.toFixed(3)} $/kWh`],
  ];

  currentY = colY + 18;
  financeData.forEach(([label, value]) => {
    doc.fontSize(10).fillColor(COLORS.mediumGray).text(label, margin + colWidth + 20, currentY, { continued: false });
    doc.fontSize(10).fillColor(COLORS.darkGray).font("Helvetica-Bold").text(value, margin + contentWidth - 100, currentY, { width: 100, align: "right" });
    doc.font("Helvetica");
    currentY += 18;
  });

  // Footer
  drawPageFooter(ctx, t("Document confidentiel | Généré par kWh Québec | Vos résultats", "Confidential document | Generated by kWh Québec | Your results"));
}
