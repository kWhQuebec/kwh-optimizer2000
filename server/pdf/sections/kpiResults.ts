import path from "path";
import type { PDFContext } from "../types";
import { COLORS } from "../types";
import { drawRoundedRect, drawPageFooter, formatCurrency, formatSmartCurrency, formatPercent } from "../helpers";

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
  doc.y += 15;

  doc.fontSize(14).fillColor(COLORS.gold).font("Helvetica-Bold");
  doc.text(t(`Profit net de ${formatSmartCurrency(simulation.npv25)} sur 25 ans`, `Net profit of ${formatSmartCurrency(simulation.npv25)} over 25 years`), margin, doc.y, { width: contentWidth });
  doc.font("Helvetica");
  doc.y += 25;

  // 4 KPI Cards with distinct colors
  const cardY = doc.y;
  const cardWidth = (contentWidth - 30) / 4;
  const cardHeight = 80;

  // Card 1: Year 1 Savings - Light gold background, gold border, gold value text
  const card1X = margin;
  const card1Label = t("Économies An 1", "Year 1 Savings");
  const card1Value = formatSmartCurrency(simulation.savingsYear1 || simulation.annualSavings);
  
  doc.roundedRect(card1X, cardY, cardWidth, cardHeight, 8).fillColor("#FFFBEB").fill();
  doc.roundedRect(card1X, cardY, cardWidth, cardHeight, 8).strokeColor("#FFB005").lineWidth(1).stroke();
  
  doc.fontSize(9).fillColor(COLORS.mediumGray).font("Helvetica-Bold");
  doc.text(card1Label.toUpperCase(), card1X + 10, cardY + 12, { width: cardWidth - 20, align: "center", lineBreak: false });
  
  const card1FontSize = card1Value.length > 15 ? 11 : card1Value.length > 12 ? 13 : card1Value.length > 9 ? 15 : card1Value.length > 6 ? 17 : 20;
  doc.fontSize(card1FontSize).fillColor("#FFB005").font("Helvetica-Bold");
  doc.text(card1Value, card1X + 10, cardY + 32, { width: cardWidth - 20, align: "center", lineBreak: false });
  doc.font("Helvetica");

  // Card 2: Net Investment - Light gray background, gray border, dark gray value text
  const card2X = margin + cardWidth + 10;
  const card2Label = t("Investissement Net", "Net Investment");
  const card2Value = formatSmartCurrency(simulation.capexNet);
  
  doc.roundedRect(card2X, cardY, cardWidth, cardHeight, 8).fillColor("#F7FAFC").fill();
  doc.roundedRect(card2X, cardY, cardWidth, cardHeight, 8).strokeColor("#E0E0E0").lineWidth(1).stroke();
  
  doc.fontSize(9).fillColor(COLORS.mediumGray).font("Helvetica-Bold");
  doc.text(card2Label.toUpperCase(), card2X + 10, cardY + 12, { width: cardWidth - 20, align: "center", lineBreak: false });
  
  const card2FontSize = card2Value.length > 15 ? 11 : card2Value.length > 12 ? 13 : card2Value.length > 9 ? 15 : card2Value.length > 6 ? 17 : 20;
  doc.fontSize(card2FontSize).fillColor(COLORS.darkGray).font("Helvetica-Bold");
  doc.text(card2Value, card2X + 10, cardY + 32, { width: cardWidth - 20, align: "center", lineBreak: false });
  doc.font("Helvetica");

  // Card 3: NPV (25yr) - Blue background, gold accent bar at top, white label text, gold value text
  const card3X = margin + 2 * (cardWidth + 10);
  const card3Label = t("Profit Net (VAN)", "Net Profit (NPV)");
  const card3Value = formatSmartCurrency(simulation.npv25);
  const card3Subtitle = t("Sur 25 ans", "Over 25 years");
  
  doc.roundedRect(card3X, cardY, cardWidth, cardHeight, 8).fillColor("#003DA6").fill();
  doc.roundedRect(card3X, cardY, cardWidth, cardHeight, 8).strokeColor("#003DA6").lineWidth(1).stroke();
  
  // Gold accent bar at top
  doc.rect(card3X, cardY, cardWidth, 3).fillColor("#FFB005").fill();
  
  doc.fontSize(9).fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text(card3Label.toUpperCase(), card3X + 10, cardY + 12, { width: cardWidth - 20, align: "center", lineBreak: false });
  
  const card3FontSize = card3Value.length > 15 ? 11 : card3Value.length > 12 ? 13 : card3Value.length > 9 ? 15 : card3Value.length > 6 ? 17 : 20;
  doc.fontSize(card3FontSize).fillColor("#FFB005").font("Helvetica-Bold");
  doc.text(card3Value, card3X + 10, cardY + 32, { width: cardWidth - 20, align: "center", lineBreak: false });
  doc.font("Helvetica");
  
  if (card3Subtitle) {
    doc.fontSize(8).fillColor(COLORS.white);
    doc.text(card3Subtitle, card3X + 10, cardY + 60, { width: cardWidth - 20, align: "center" });
  }

  // Card 4: IRR (25yr) - Green background, white label text, white value text, white accent bar at top
  const card4X = margin + 3 * (cardWidth + 10);
  const card4Label = t("Rendement (TRI)", "Return (IRR)");
  const card4Value = formatPercent(simulation.irr25);
  const card4Subtitle = t("25 ans", "25 years");
  
  doc.roundedRect(card4X, cardY, cardWidth, cardHeight, 8).fillColor("#059669").fill();
  doc.roundedRect(card4X, cardY, cardWidth, cardHeight, 8).strokeColor("#059669").lineWidth(1).stroke();
  
  // White accent bar at top
  doc.rect(card4X, cardY, cardWidth, 3).fillColor(COLORS.white).fill();
  
  doc.fontSize(9).fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text(card4Label.toUpperCase(), card4X + 10, cardY + 12, { width: cardWidth - 20, align: "center", lineBreak: false });
  
  const card4FontSize = card4Value.length > 15 ? 11 : card4Value.length > 12 ? 13 : card4Value.length > 9 ? 15 : card4Value.length > 6 ? 17 : 20;
  doc.fontSize(card4FontSize).fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text(card4Value, card4X + 10, cardY + 32, { width: cardWidth - 20, align: "center", lineBreak: false });
  doc.font("Helvetica");
  
  if (card4Subtitle) {
    doc.fontSize(8).fillColor(COLORS.white);
    doc.text(card4Subtitle, card4X + 10, cardY + 60, { width: cardWidth - 20, align: "center" });
  }

  doc.y = cardY + cardHeight + 25;

  // Configuration + Finance 2-column summary
  doc.fontSize(14).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("ANALYSE DÉTAILLÉE", "DETAILED ANALYSIS"), margin, doc.y);
  doc.font("Helvetica");
  doc.moveDown(0.8);

  const colWidth = (contentWidth - 20) / 2;
  const colY = doc.y;

  // Configuration column
  doc.fontSize(11).fillColor(COLORS.darkGray).font("Helvetica-Bold");
  doc.text("CONFIGURATION", margin, colY);
  doc.font("Helvetica");
  doc.moveDown(0.5);

  const configData = [
    [t("Puissance solaire :", "Solar power:"), `${(simulation.pvSizeKW || 0).toFixed(0)} kWc`],
    [t("Capacité Batterie :", "Battery Capacity:"), `${(simulation.battEnergyKWh || 0).toFixed(0)} kWh`],
    [t("Puissance Batterie :", "Battery Power:"), `${(simulation.battPowerKW || 0).toFixed(1)} kW`],
    [t("Toiture totale :", "Total roof:"), `${Math.round(simulation.assumptions?.roofAreaSqFt || 0).toLocaleString()} pi²`],
    [t("Potentiel solaire :", "Solar potential:"), `${Math.round((simulation.assumptions?.roofAreaSqFt || 0) * (simulation.assumptions?.roofUtilizationRatio || 0.8)).toLocaleString()} pi²`],
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
    [(simulation.npv10 || 0) >= 0 
      ? [t("VAN (10 ans) :", "NPV (10yr):"), formatCurrency(simulation.npv10)]
      : [t("VAN (25 ans) :", "NPV (25yr):"), formatCurrency(simulation.npv25)]
    ][0],
    [t("LCOE (Coût Énergie) :", "LCOE (Energy Cost):"), `${(simulation.lcoe || 0).toFixed(3)} $/kWh`],
  ];

  currentY = colY + 18;
  financeData.forEach(([label, value]) => {
    doc.fontSize(10).fillColor(COLORS.mediumGray).text(label, margin + colWidth + 20, currentY, { continued: false });
    doc.fontSize(10).fillColor(COLORS.darkGray).font("Helvetica-Bold").text(value, margin + contentWidth - 100, currentY, { width: 100, align: "right" });
    doc.font("Helvetica");
    currentY += 18;
  });

  // Summary payback row
  const summaryY = Math.max(currentY + 10, colY + 110);
  doc.rect(margin, summaryY, contentWidth, 1).fillColor(COLORS.gold).fill();
  doc.fontSize(10).fillColor(COLORS.blue).font("Helvetica-Bold");
  const paybackYears = simulation.simplePaybackYears || (simulation.capexNet && simulation.annualSavings ? (simulation.capexNet / simulation.annualSavings) : 0);
  const lcoeVal = simulation.lcoe || 0;
  doc.text(
    t(`Retour sur investissement: ${paybackYears.toFixed(1)} ans  |  LCOE: ${lcoeVal.toFixed(3)} $/kWh`,
      `Payback: ${paybackYears.toFixed(1)} years  |  LCOE: ${lcoeVal.toFixed(3)} $/kWh`),
    margin, summaryY + 8, { width: contentWidth, align: "center" }
  );
  doc.font("Helvetica");

  // CO2 Equivalent Metrics
  doc.y = summaryY + 30;
  const co2Tonnes = simulation.co2AvoidedTonnesPerYear || 0;
  const totalProductionKWh = simulation.pvSizeKW * 1035;
  const co2TonnesDisplay = totalProductionKWh > 0 ? (totalProductionKWh * 0.002) / 1000 : co2Tonnes;
  const treesPlanted = Math.max(1, Math.round(co2TonnesDisplay * 45));
  const carsRemoved = co2TonnesDisplay / 4.6;

  const eqColWidth = (contentWidth - 20) / 3;
  const eqY = doc.y;
  const eqH = 55;

  const co2Metrics = [
    { label: t("Arbres plantés (équiv.)", "Trees planted (equiv.)"), value: `${treesPlanted.toLocaleString()}`, icon: "" },
    { label: t("Voitures retirées (équiv.)", "Cars removed (equiv.)"), value: carsRemoved > 0.05 ? carsRemoved.toFixed(1) : "< 0.1", icon: "" },
    { label: t("Couverture énergétique", "Energy coverage"), value: `${(simulation.selfSufficiencyPercent || 0).toFixed(0)}%`, icon: "" },
  ];

  co2Metrics.forEach((metric, idx) => {
    const mx = margin + idx * (eqColWidth + 10);
    drawRoundedRect(doc, mx, eqY, eqColWidth, eqH, 6, COLORS.background);
    doc.roundedRect(mx, eqY, eqColWidth, eqH, 6).strokeColor(COLORS.lightGray).lineWidth(0.5).stroke();

    doc.fontSize(9).fillColor(COLORS.mediumGray);
    doc.text(metric.label, mx + 10, eqY + 8, { width: eqColWidth - 20, align: "center" });
    doc.fontSize(18).fillColor(COLORS.green).font("Helvetica-Bold");
    doc.text(metric.value, mx + 10, eqY + 28, { width: eqColWidth - 20, align: "center" });
    doc.font("Helvetica");
  });

  // Footer
  drawPageFooter(ctx, t("Document confidentiel | Généré par kWh Québec | Vos résultats", "Confidential document | Generated by kWh Québec | Your results"));
}
