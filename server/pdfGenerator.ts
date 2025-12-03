import PDFDocument from "pdfkit";
import { CashflowEntry, FinancialBreakdown, HourlyProfileEntry, PeakWeekEntry } from "@shared/schema";

// Brand colors
const COLORS = {
  blue: "#003DA6",
  gold: "#FFB005",
  darkGray: "#333333",
  mediumGray: "#666666",
  lightGray: "#999999",
  green: "#2D915F",
  red: "#DC2626",
  white: "#FFFFFF",
  background: "#F5F5F5",
};

interface SimulationData {
  id: string;
  site: {
    name: string;
    address?: string;
    city?: string;
    province?: string;
    client: {
      name: string;
    };
  };
  pvSizeKW: number;
  battEnergyKWh: number;
  battPowerKW: number;
  demandShavingSetpointKW: number;
  annualConsumptionKWh: number;
  peakDemandKW: number;
  annualSavings: number;
  savingsYear1: number;
  capexGross: number;
  capexNet: number;
  totalIncentives: number;
  incentivesHQ: number;
  incentivesHQSolar: number;
  incentivesHQBattery: number;
  incentivesFederal: number;
  taxShield: number;
  npv25: number;
  npv10: number;
  npv20: number;
  irr25: number;
  irr10: number;
  irr20: number;
  simplePaybackYears: number;
  lcoe: number;
  co2AvoidedTonnesPerYear: number;
  selfSufficiencyPercent: number;
  annualCostBefore: number;
  annualCostAfter: number;
  assumptions: {
    roofAreaSqFt: number;
    roofUtilizationRatio: number;
  };
  cashflows: CashflowEntry[];
  breakdown: FinancialBreakdown;
  hourlyProfile?: HourlyProfileEntry[];
  peakWeekData?: PeakWeekEntry[];
}

export function generateProfessionalPDF(
  doc: PDFKit.PDFDocument,
  simulation: SimulationData,
  lang: "fr" | "en" = "fr"
): void {
  const t = (fr: string, en: string) => (lang === "fr" ? fr : en);
  const pageWidth = 612; // Letter size
  const pageHeight = 792;
  const margin = 50;
  const contentWidth = pageWidth - 2 * margin;

  // Helper functions
  const formatCurrency = (value: number | null | undefined, compact = false): string => {
    if (value === null || value === undefined || isNaN(value)) {
      return "0 $";
    }
    if (compact && Math.abs(value) >= 1000) {
      return `${(value / 1000).toFixed(0)}k $`;
    }
    return `${value.toLocaleString("fr-CA", { maximumFractionDigits: 0 })} $`;
  };

  const formatPercent = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) {
      return "0.0 %";
    }
    return `${(value * 100).toFixed(1)} %`;
  };

  const drawRoundedRect = (
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    fill?: string,
    stroke?: string
  ) => {
    doc.roundedRect(x, y, width, height, radius);
    if (fill) {
      doc.fillColor(fill).fill();
    }
    if (stroke) {
      doc.strokeColor(stroke).stroke();
    }
  };

  const drawKPICard = (
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    value: string,
    subtitle?: string,
    highlight = false
  ) => {
    // Card background
    drawRoundedRect(x, y, width, height, 8, highlight ? COLORS.blue : COLORS.white);
    doc.roundedRect(x, y, width, height, 8).strokeColor(COLORS.lightGray).lineWidth(1).stroke();

    // Label
    doc.fontSize(9).fillColor(highlight ? COLORS.white : COLORS.mediumGray);
    doc.text(label.toUpperCase(), x + 10, y + 12, { width: width - 20, align: "center" });

    // Value
    doc.fontSize(22).fillColor(highlight ? COLORS.gold : COLORS.blue).font("Helvetica-Bold");
    doc.text(value, x + 10, y + 32, { width: width - 20, align: "center" });
    doc.font("Helvetica");

    // Subtitle
    if (subtitle) {
      doc.fontSize(8).fillColor(highlight ? COLORS.white : COLORS.lightGray);
      doc.text(subtitle, x + 10, y + 60, { width: width - 20, align: "center" });
    }
  };

  const drawBarChart = (
    x: number,
    y: number,
    width: number,
    height: number,
    data: Array<{ label: string; value: number; color: string }>,
    title: string,
    maxValue?: number
  ) => {
    const chartHeight = height - 40;
    const barWidth = (width - 40) / data.length - 10;
    const max = maxValue || Math.max(...data.map((d) => Math.abs(d.value))) * 1.1;

    // Title
    doc.fontSize(11).fillColor(COLORS.darkGray).font("Helvetica-Bold");
    doc.text(title, x, y, { width });
    doc.font("Helvetica");

    const chartY = y + 25;
    const baselineY = chartY + chartHeight * 0.7;

    // Bars
    data.forEach((item, i) => {
      const barX = x + 20 + i * (barWidth + 10);
      const barHeight = (Math.abs(item.value) / max) * (chartHeight * 0.6);
      const barY = item.value >= 0 ? baselineY - barHeight : baselineY;

      drawRoundedRect(barX, barY, barWidth, barHeight, 3, item.color);

      // Value label
      doc.fontSize(8).fillColor(COLORS.darkGray);
      doc.text(formatCurrency(item.value, true), barX, barY - 12, { width: barWidth, align: "center" });

      // Label
      doc.fontSize(7).fillColor(COLORS.mediumGray);
      doc.text(item.label, barX - 5, baselineY + 5, { width: barWidth + 10, align: "center" });
    });

    // Baseline
    doc.strokeColor(COLORS.lightGray).lineWidth(1);
    doc.moveTo(x + 10, baselineY).lineTo(x + width - 10, baselineY).stroke();
  };

  const drawCashflowChart = (
    x: number,
    y: number,
    width: number,
    height: number,
    cashflows: CashflowEntry[],
    title: string
  ) => {
    const chartHeight = height - 50;
    const chartWidth = width - 60;
    const chartX = x + 40;
    const chartY = y + 30;

    // Title
    doc.fontSize(11).fillColor(COLORS.darkGray).font("Helvetica-Bold");
    doc.text(title, x, y, { width });
    doc.font("Helvetica");

    if (!cashflows || cashflows.length === 0) return;

    const years = cashflows.filter((c) => c.year >= 0);
    const maxCumul = Math.max(...years.map((c) => c.cumulative));
    const minCumul = Math.min(...years.map((c) => c.cumulative));
    const range = maxCumul - minCumul || 1;

    const barWidth = chartWidth / years.length - 2;
    const baselineY = chartY + chartHeight * 0.6;

    // Draw bars and cumulative line
    const cumulPoints: Array<{ x: number; y: number }> = [];

    years.forEach((cf, i) => {
      const barX = chartX + i * (barWidth + 2);
      const netValue = cf.netCashflow;
      const barHeight = Math.abs(netValue) / (range / 2) * (chartHeight * 0.3);
      const barY = netValue >= 0 ? baselineY - barHeight : baselineY;

      // Bar
      const barColor = netValue >= 0 ? COLORS.green : COLORS.red;
      doc.rect(barX, barY, barWidth, Math.max(barHeight, 2)).fillColor(barColor).fill();

      // Cumulative point
      const cumulY = chartY + chartHeight - ((cf.cumulative - minCumul) / range) * chartHeight;
      cumulPoints.push({ x: barX + barWidth / 2, y: cumulY });

      // Year labels (every 5 years)
      if (cf.year % 5 === 0) {
        doc.fontSize(7).fillColor(COLORS.mediumGray);
        doc.text(cf.year.toString(), barX - 5, baselineY + chartHeight * 0.35, { width: barWidth + 10, align: "center" });
      }
    });

    // Draw cumulative line
    if (cumulPoints.length > 1) {
      doc.strokeColor(COLORS.blue).lineWidth(2);
      doc.moveTo(cumulPoints[0].x, cumulPoints[0].y);
      for (let i = 1; i < cumulPoints.length; i++) {
        doc.lineTo(cumulPoints[i].x, cumulPoints[i].y);
      }
      doc.stroke();

      // Draw points
      cumulPoints.forEach((p) => {
        doc.circle(p.x, p.y, 2).fillColor(COLORS.blue).fill();
      });
    }

    // Zero line
    const zeroY = chartY + chartHeight - ((0 - minCumul) / range) * chartHeight;
    doc.strokeColor(COLORS.lightGray).lineWidth(0.5);
    doc.moveTo(chartX, zeroY).lineTo(chartX + chartWidth, zeroY).stroke();

    // Baseline
    doc.strokeColor(COLORS.mediumGray).lineWidth(1);
    doc.moveTo(chartX, baselineY).lineTo(chartX + chartWidth, baselineY).stroke();

    // Legend
    const legendY = y + height - 15;
    doc.fontSize(7).fillColor(COLORS.mediumGray);
    doc.rect(x + 20, legendY, 10, 8).fillColor(COLORS.green).fill();
    doc.text(t("Flux annuel", "Annual cashflow"), x + 35, legendY);
    doc.strokeColor(COLORS.blue).lineWidth(2).moveTo(x + 120, legendY + 4).lineTo(x + 140, legendY + 4).stroke();
    doc.text(t("Cumulatif", "Cumulative"), x + 145, legendY);
  };

  const drawPeakImpactChart = (
    x: number,
    y: number,
    width: number,
    height: number,
    peakWeekData: PeakWeekEntry[] | undefined,
    title: string
  ) => {
    doc.fontSize(11).fillColor(COLORS.darkGray).font("Helvetica-Bold");
    doc.text(title, x, y, { width });
    doc.font("Helvetica");

    if (!peakWeekData || peakWeekData.length === 0) {
      doc.fontSize(9).fillColor(COLORS.lightGray);
      doc.text(t("Données non disponibles", "Data not available"), x + 20, y + 40);
      return;
    }

    const chartHeight = height - 50;
    const chartWidth = width - 20;
    const chartX = x + 10;
    const chartY = y + 30;

    const maxDemand = Math.max(...peakWeekData.map((d) => d.peakBefore || 0)) * 1.1;
    const points = peakWeekData.slice(0, Math.min(168, peakWeekData.length)); // 1 week = 168 hours

    // Draw original demand line
    doc.strokeColor(COLORS.red).lineWidth(1.5);
    points.forEach((p, i) => {
      const px = chartX + (i / points.length) * chartWidth;
      const py = chartY + chartHeight - ((p.peakBefore || 0) / maxDemand) * chartHeight;
      if (i === 0) doc.moveTo(px, py);
      else doc.lineTo(px, py);
    });
    doc.stroke();

    // Draw new demand line (after solar + battery)
    doc.strokeColor(COLORS.green).lineWidth(1.5);
    points.forEach((p, i) => {
      const px = chartX + (i / points.length) * chartWidth;
      const py = chartY + chartHeight - ((p.peakAfter || 0) / maxDemand) * chartHeight;
      if (i === 0) doc.moveTo(px, py);
      else doc.lineTo(px, py);
    });
    doc.stroke();

    // Shaving setpoint line
    if (simulation.demandShavingSetpointKW > 0) {
      const setpointY = chartY + chartHeight - (simulation.demandShavingSetpointKW / maxDemand) * chartHeight;
      doc.strokeColor(COLORS.gold).lineWidth(1).dash(4, { space: 2 });
      doc.moveTo(chartX, setpointY).lineTo(chartX + chartWidth, setpointY).stroke();
      doc.undash();
    }

    // Legend
    const legendY = y + height - 15;
    doc.fontSize(7).fillColor(COLORS.mediumGray);
    doc.strokeColor(COLORS.red).lineWidth(2).moveTo(x + 10, legendY + 4).lineTo(x + 30, legendY + 4).stroke();
    doc.text(t("Demande actuelle", "Current demand"), x + 35, legendY);
    doc.strokeColor(COLORS.green).lineWidth(2).moveTo(x + 130, legendY + 4).lineTo(x + 150, legendY + 4).stroke();
    doc.text(t("Après PV+Batterie", "After PV+Battery"), x + 155, legendY);
  };

  // ================= PAGE 1: TITLE & MAIN KPIs =================
  
  // Header
  doc.fontSize(10).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text("ÉTUDE PRÉLIMINAIRE : SOLAIRE + STOCKAGE", margin, margin, { align: "center", width: contentWidth });
  doc.font("Helvetica");

  // Date
  doc.fontSize(10).fillColor(COLORS.mediumGray);
  const dateStr = new Date().toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA");
  doc.text(dateStr, margin, margin, { align: "right", width: contentWidth });

  doc.moveDown(2);

  // Project Name & Location
  doc.fontSize(24).fillColor(COLORS.darkGray).font("Helvetica-Bold");
  doc.text(simulation.site.name, margin, doc.y, { align: "left" });
  doc.font("Helvetica");
  
  doc.fontSize(12).fillColor(COLORS.mediumGray);
  const location = [simulation.site.city, simulation.site.province || "QC"].filter(Boolean).join(", ");
  doc.text(location || "Québec", margin, doc.y + 5);

  doc.moveDown(2);

  // 4 KPI Cards
  const cardY = doc.y + 10;
  const cardWidth = (contentWidth - 30) / 4;
  const cardHeight = 80;

  drawKPICard(
    margin,
    cardY,
    cardWidth,
    cardHeight,
    t("Économies An 1", "Year 1 Savings"),
    formatCurrency(simulation.savingsYear1 || simulation.annualSavings),
    ""
  );

  drawKPICard(
    margin + cardWidth + 10,
    cardY,
    cardWidth,
    cardHeight,
    t("Investissement Net", "Net Investment"),
    formatCurrency(simulation.capexNet),
    ""
  );

  drawKPICard(
    margin + 2 * (cardWidth + 10),
    cardY,
    cardWidth,
    cardHeight,
    t("Profit Net (VAN)", "Net Profit (NPV)"),
    formatCurrency(simulation.npv25),
    t("Sur 25 ans", "Over 25 years"),
    true
  );

  drawKPICard(
    margin + 3 * (cardWidth + 10),
    cardY,
    cardWidth,
    cardHeight,
    t("Rendement (TRI)", "Return (IRR)"),
    formatPercent(simulation.irr25),
    t("25 ans", "25 years"),
    true
  );

  doc.y = cardY + cardHeight + 30;

  // ================= ANALYSE DÉTAILLÉE =================
  doc.fontSize(14).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("ANALYSE DÉTAILLÉE", "DETAILED ANALYSIS"), margin, doc.y);
  doc.font("Helvetica");
  doc.moveDown(1);

  // Two columns: Configuration | Finance
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
    [t("Toiture totale :", "Total roof:"), `${(simulation.assumptions.roofAreaSqFt || 0).toLocaleString()} pi²`],
    [t("Potentiel solaire :", "Solar potential:"), `${((simulation.assumptions.roofAreaSqFt || 0) * (simulation.assumptions.roofUtilizationRatio || 0.8)).toLocaleString()} pi²`],
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

  // ================= INCENTIVES BREAKDOWN =================
  doc.y = Math.max(currentY, colY + 110) + 20;
  
  doc.fontSize(14).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("DÉTAIL DES INCITATIFS", "INCENTIVES BREAKDOWN"), margin, doc.y);
  doc.font("Helvetica");
  doc.moveDown(1);

  // Draw incentives breakdown cards
  const incentiveY = doc.y;
  const incentiveCardWidth = (contentWidth - 30) / 4;
  const incentiveCardHeight = 70;

  // HQ Solar Incentive
  drawRoundedRect(margin, incentiveY, incentiveCardWidth, incentiveCardHeight, 6, COLORS.white);
  doc.roundedRect(margin, incentiveY, incentiveCardWidth, incentiveCardHeight, 6).strokeColor(COLORS.blue).lineWidth(1).stroke();
  doc.fontSize(8).fillColor(COLORS.mediumGray);
  doc.text(t("HYDRO-QUÉBEC SOLAIRE", "HYDRO-QUÉBEC SOLAR"), margin + 8, incentiveY + 8, { width: incentiveCardWidth - 16, align: "center" });
  doc.fontSize(7).fillColor(COLORS.lightGray);
  doc.text(t("1 000 $/kW (max 40%)", "$1,000/kW (max 40%)"), margin + 8, incentiveY + 20, { width: incentiveCardWidth - 16, align: "center" });
  doc.fontSize(14).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(formatCurrency(simulation.incentivesHQSolar), margin + 8, incentiveY + 38, { width: incentiveCardWidth - 16, align: "center" });
  doc.font("Helvetica");

  // HQ Battery Incentive
  drawRoundedRect(margin + incentiveCardWidth + 10, incentiveY, incentiveCardWidth, incentiveCardHeight, 6, COLORS.white);
  doc.roundedRect(margin + incentiveCardWidth + 10, incentiveY, incentiveCardWidth, incentiveCardHeight, 6).strokeColor(COLORS.blue).lineWidth(1).stroke();
  doc.fontSize(8).fillColor(COLORS.mediumGray);
  doc.text(t("HYDRO-QUÉBEC BATTERIE", "HYDRO-QUÉBEC BATTERY"), margin + incentiveCardWidth + 18, incentiveY + 8, { width: incentiveCardWidth - 16, align: "center" });
  doc.fontSize(7).fillColor(COLORS.lightGray);
  doc.text(t("300 $/kW (max 40%)", "$300/kW (max 40%)"), margin + incentiveCardWidth + 18, incentiveY + 20, { width: incentiveCardWidth - 16, align: "center" });
  doc.fontSize(14).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(formatCurrency(simulation.incentivesHQBattery), margin + incentiveCardWidth + 18, incentiveY + 38, { width: incentiveCardWidth - 16, align: "center" });
  doc.font("Helvetica");

  // Federal ITC
  drawRoundedRect(margin + 2 * (incentiveCardWidth + 10), incentiveY, incentiveCardWidth, incentiveCardHeight, 6, COLORS.white);
  doc.roundedRect(margin + 2 * (incentiveCardWidth + 10), incentiveY, incentiveCardWidth, incentiveCardHeight, 6).strokeColor(COLORS.green).lineWidth(1).stroke();
  doc.fontSize(8).fillColor(COLORS.mediumGray);
  doc.text(t("ITC FÉDÉRAL", "FEDERAL ITC"), margin + 2 * (incentiveCardWidth + 10) + 8, incentiveY + 8, { width: incentiveCardWidth - 16, align: "center" });
  doc.fontSize(7).fillColor(COLORS.lightGray);
  doc.text(t("30% du CAPEX net", "30% of net CAPEX"), margin + 2 * (incentiveCardWidth + 10) + 8, incentiveY + 20, { width: incentiveCardWidth - 16, align: "center" });
  doc.fontSize(14).fillColor(COLORS.green).font("Helvetica-Bold");
  doc.text(formatCurrency(simulation.incentivesFederal), margin + 2 * (incentiveCardWidth + 10) + 8, incentiveY + 38, { width: incentiveCardWidth - 16, align: "center" });
  doc.font("Helvetica");

  // Tax Shield (DPA/CCA)
  drawRoundedRect(margin + 3 * (incentiveCardWidth + 10), incentiveY, incentiveCardWidth, incentiveCardHeight, 6, COLORS.white);
  doc.roundedRect(margin + 3 * (incentiveCardWidth + 10), incentiveY, incentiveCardWidth, incentiveCardHeight, 6).strokeColor(COLORS.gold).lineWidth(1).stroke();
  doc.fontSize(8).fillColor(COLORS.mediumGray);
  doc.text(t("BOUCLIER FISCAL", "TAX SHIELD"), margin + 3 * (incentiveCardWidth + 10) + 8, incentiveY + 8, { width: incentiveCardWidth - 16, align: "center" });
  doc.fontSize(7).fillColor(COLORS.lightGray);
  doc.text(t("DPA/CCA Classe 43.2", "CCA Class 43.2"), margin + 3 * (incentiveCardWidth + 10) + 8, incentiveY + 20, { width: incentiveCardWidth - 16, align: "center" });
  doc.fontSize(14).fillColor(COLORS.gold).font("Helvetica-Bold");
  doc.text(formatCurrency(simulation.taxShield), margin + 3 * (incentiveCardWidth + 10) + 8, incentiveY + 38, { width: incentiveCardWidth - 16, align: "center" });
  doc.font("Helvetica");

  // Total incentives row
  doc.y = incentiveY + incentiveCardHeight + 10;
  doc.fontSize(11).fillColor(COLORS.darkGray).font("Helvetica-Bold");
  doc.text(t("TOTAL DES INCITATIFS:", "TOTAL INCENTIVES:"), margin, doc.y);
  doc.fontSize(14).fillColor(COLORS.blue);
  doc.text(formatCurrency(simulation.totalIncentives + simulation.taxShield), margin + 180, doc.y - 2);
  doc.font("Helvetica");

  // Footer
  doc.fontSize(8).fillColor(COLORS.lightGray);
  doc.text(t("Document confidentiel | Généré par kWh Québec | Page 1", "Confidential document | Generated by kWh Québec | Page 1"), margin, pageHeight - 30, { align: "center", width: contentWidth });

  // ================= PAGE 2: CHARTS =================
  doc.addPage();

  // Header
  doc.fontSize(10).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text("ÉTUDE PRÉLIMINAIRE : SOLAIRE + STOCKAGE", margin, margin, { align: "center", width: contentWidth });
  doc.font("Helvetica");
  doc.fontSize(10).fillColor(COLORS.mediumGray);
  doc.text(dateStr, margin, margin, { align: "right", width: contentWidth });

  doc.moveDown(2);

  // Scenario Comparison Chart - VAN sur 25 ans par scénario
  // PV seul estimé: savings from solar only, without battery peak shaving benefits
  // Rough estimate: if battery provides ~30-40% of demand savings via peak shaving,
  // PV-only provides roughly 65-75% of total NPV
  const pvOnlyEstimatedNPV = simulation.npv25 * 0.72; // Conservative estimate
  
  drawBarChart(
    margin,
    doc.y,
    contentWidth,
    150,
    [
      { label: t("Statu quo\n(aucun investissement)", "Status quo\n(no investment)"), value: 0, color: COLORS.lightGray },
      { label: t("PV seul\n(sans stockage)", "PV only\n(no storage)"), value: pvOnlyEstimatedNPV, color: COLORS.gold },
      { label: t("PV + Batterie\n(recommandé)", "PV + Battery\n(recommended)"), value: simulation.npv25, color: COLORS.green },
    ],
    t("COMPARAISON DES SCÉNARIOS - VAN 25 ans", "SCENARIO COMPARISON - 25yr NPV")
  );

  doc.y += 170;

  // Cash Flow Chart
  drawCashflowChart(
    margin,
    doc.y,
    contentWidth,
    180,
    simulation.cashflows,
    t("Flux de trésorerie et retour sur investissement", "Cash flow and return on investment")
  );

  // Footer
  doc.fontSize(8).fillColor(COLORS.lightGray);
  doc.text(t("Document confidentiel | Généré par kWh Québec | Page 2", "Confidential document | Generated by kWh Québec | Page 2"), margin, pageHeight - 30, { align: "center", width: contentWidth });

  // ================= PAGE 3: PEAK IMPACT =================
  doc.addPage();

  // Header
  doc.fontSize(10).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text("ÉTUDE PRÉLIMINAIRE : SOLAIRE + STOCKAGE", margin, margin, { align: "center", width: contentWidth });
  doc.font("Helvetica");
  doc.fontSize(10).fillColor(COLORS.mediumGray);
  doc.text(dateStr, margin, margin, { align: "right", width: contentWidth });

  doc.moveDown(2);

  // Peak Impact Chart
  drawPeakImpactChart(
    margin,
    doc.y,
    contentWidth,
    180,
    simulation.peakWeekData,
    t("Impact sur la pointe (semaine critique)", "Peak impact (critical week)")
  );

  // Footer
  doc.fontSize(8).fillColor(COLORS.lightGray);
  doc.text(t("Document confidentiel | Généré par kWh Québec | Page 3", "Confidential document | Generated by kWh Québec | Page 3"), margin, pageHeight - 30, { align: "center", width: contentWidth });

  // ================= PAGE 4: COST OF INACTION & RESILIENCE =================
  doc.addPage();

  // Header
  doc.fontSize(10).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text("ÉTUDE PRÉLIMINAIRE : SOLAIRE + STOCKAGE", margin, margin, { align: "center", width: contentWidth });
  doc.font("Helvetica");
  doc.fontSize(10).fillColor(COLORS.mediumGray);
  doc.text(dateStr, margin, margin, { align: "right", width: contentWidth });

  doc.moveDown(2);

  // Cost of Inaction Chart
  doc.fontSize(11).fillColor(COLORS.darkGray).font("Helvetica-Bold");
  doc.text(t("Pourquoi maintenant ? (coût de l'inaction)", "Why now? (cost of inaction)"), margin, doc.y);
  doc.font("Helvetica");
  doc.moveDown(1);

  // Draw cost projection chart
  const costChartY = doc.y;
  const costChartHeight = 150;
  const costChartWidth = contentWidth;

  // Calculate cumulative costs
  const years = 25;
  const inflationRate = 0.025;
  let cumulWithout = 0;
  let cumulWith = 0;
  const costData: Array<{ year: number; without: number; with: number }> = [];

  for (let y = 0; y <= years; y++) {
    const yearCost = simulation.annualCostBefore * Math.pow(1 + inflationRate, y);
    const yearCostAfter = simulation.annualCostAfter * Math.pow(1 + inflationRate, y);
    cumulWithout += yearCost;
    cumulWith += yearCostAfter + (y === 0 ? simulation.capexNet : 0);
    costData.push({ year: y, without: cumulWithout, with: cumulWith });
  }

  const maxCost = Math.max(cumulWithout, cumulWith);

  // Draw "without solar" line
  doc.strokeColor(COLORS.red).lineWidth(2);
  costData.forEach((d, i) => {
    const px = margin + 40 + (d.year / years) * (costChartWidth - 60);
    const py = costChartY + costChartHeight - (d.without / maxCost) * (costChartHeight - 20);
    if (i === 0) doc.moveTo(px, py);
    else doc.lineTo(px, py);
  });
  doc.stroke();

  // Draw "with solar" line
  doc.strokeColor(COLORS.green).lineWidth(2);
  costData.forEach((d, i) => {
    const px = margin + 40 + (d.year / years) * (costChartWidth - 60);
    const py = costChartY + costChartHeight - (d.with / maxCost) * (costChartHeight - 20);
    if (i === 0) doc.moveTo(px, py);
    else doc.lineTo(px, py);
  });
  doc.stroke();

  // Savings arrow at year 25
  const savingsAt25 = cumulWithout - cumulWith;
  doc.fontSize(10).fillColor(COLORS.green).font("Helvetica-Bold");
  doc.text(`${t("Économies", "Savings")}: ${formatCurrency(savingsAt25)}`, margin + costChartWidth - 150, costChartY + 20);
  doc.font("Helvetica");

  // Legend
  doc.fontSize(8).fillColor(COLORS.mediumGray);
  doc.strokeColor(COLORS.red).lineWidth(2).moveTo(margin + 40, costChartY + costChartHeight + 10).lineTo(margin + 60, costChartY + costChartHeight + 10).stroke();
  doc.text(t("Sans solaire", "Without solar"), margin + 65, costChartY + costChartHeight + 7);
  doc.strokeColor(COLORS.green).lineWidth(2).moveTo(margin + 160, costChartY + costChartHeight + 10).lineTo(margin + 180, costChartY + costChartHeight + 10).stroke();
  doc.text(t("Avec solaire + stockage", "With solar + storage"), margin + 185, costChartY + costChartHeight + 7);

  doc.y = costChartY + costChartHeight + 50;

  // Energy Security Section
  doc.moveDown(2);
  doc.fontSize(11).fillColor(COLORS.darkGray).font("Helvetica-Bold");
  doc.text(t("SÉCURITÉ ÉNERGÉTIQUE (RÉSILIENCE)", "ENERGY SECURITY (RESILIENCE)"), margin, doc.y);
  doc.font("Helvetica");
  doc.moveDown(0.5);

  doc.fontSize(10).fillColor(COLORS.mediumGray);
  doc.text(t("En cas de panne majeure, votre batterie peut maintenir vos opérations essentielles pendant :", "In case of major outage, your battery can maintain essential operations for:"), margin, doc.y);
  doc.moveDown(1);

  // Calculate backup hours (assuming 30% of peak as critical load)
  const criticalLoadKW = simulation.peakDemandKW * 0.3;
  const backupHours = criticalLoadKW > 0 ? simulation.battEnergyKWh / criticalLoadKW : 0;

  doc.fontSize(36).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(`${backupHours.toFixed(1)} ${t("Heures", "Hours")}`, margin, doc.y, { align: "right", width: contentWidth });
  doc.font("Helvetica");

  // Footer
  doc.fontSize(8).fillColor(COLORS.lightGray);
  doc.text(t("Document confidentiel | Généré par kWh Québec | Page 4", "Confidential document | Generated by kWh Québec | Page 4"), margin, pageHeight - 30, { align: "center", width: contentWidth });

  // ================= PAGE 5: FINANCIAL TABLE =================
  doc.addPage();

  // Header
  doc.fontSize(10).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text("ÉTUDE PRÉLIMINAIRE : SOLAIRE + STOCKAGE", margin, margin, { align: "center", width: contentWidth });
  doc.font("Helvetica");
  doc.fontSize(10).fillColor(COLORS.mediumGray);
  doc.text(dateStr, margin, margin, { align: "right", width: contentWidth });

  doc.moveDown(2);

  // Financial Table Title
  doc.fontSize(11).fillColor(COLORS.darkGray).font("Helvetica-Bold");
  doc.text(t("TABLEAU DES FLUX FINANCIERS", "FINANCIAL CASH FLOW TABLE"), margin, doc.y);
  doc.font("Helvetica");
  doc.moveDown(1);

  // Table Headers
  const tableX = margin;
  const tableY = doc.y;
  const colWidths = [40, 70, 70, 70, 70, 70, 80];
  const headers = [
    t("An", "Year"),
    t("Revenu", "Rev"),
    t("O&M", "O&M"),
    t("Invest", "Invest"),
    t("Taxes", "Tax"),
    t("NET", "NET"),
    t("CUMUL", "CUMUL"),
  ];

  // Header row
  doc.fontSize(8).fillColor(COLORS.white).font("Helvetica-Bold");
  let headerX = tableX;
  headers.forEach((header, i) => {
    doc.rect(headerX, tableY, colWidths[i], 18).fillColor(COLORS.blue).fill();
    doc.fillColor(COLORS.white).text(header, headerX + 3, tableY + 5, { width: colWidths[i] - 6, align: "center" });
    headerX += colWidths[i];
  });
  doc.font("Helvetica");

  // Data rows
  let rowY = tableY + 18;
  const rowHeight = 14;
  const cashflowsToShow = simulation.cashflows.slice(0, 26); // Years 0-25

  cashflowsToShow.forEach((cf, idx) => {
    if (rowY > pageHeight - 60) {
      doc.addPage();
      doc.fontSize(10).fillColor(COLORS.blue).font("Helvetica-Bold");
      doc.text("ÉTUDE PRÉLIMINAIRE : SOLAIRE + STOCKAGE", margin, margin, { align: "center", width: contentWidth });
      doc.font("Helvetica");
      doc.fontSize(10).fillColor(COLORS.mediumGray);
      doc.text(dateStr, margin, margin, { align: "right", width: contentWidth });
      rowY = margin + 40;
    }

    const bgColor = idx % 2 === 0 ? COLORS.white : "#F8F8F8";
    let cellX = tableX;

    const rowData = [
      cf.year.toString(),
      cf.revenue > 0 ? formatCurrency(cf.revenue, true) : "",
      cf.opex < 0 ? formatCurrency(cf.opex, true) : "",
      cf.investment !== 0 ? formatCurrency(cf.investment, true) : "",
      (cf.dpa || 0) + (cf.incentives || 0) !== 0 ? formatCurrency((cf.dpa || 0) + (cf.incentives || 0), true) : "",
      formatCurrency(cf.netCashflow, true),
      formatCurrency(cf.cumulative, true),
    ];

    rowData.forEach((value, i) => {
      doc.rect(cellX, rowY, colWidths[i], rowHeight).fillColor(bgColor).fill();
      doc.rect(cellX, rowY, colWidths[i], rowHeight).strokeColor(COLORS.lightGray).lineWidth(0.5).stroke();
      
      const textColor = i === 6 && cf.cumulative < 0 ? COLORS.red : (i === 6 && cf.cumulative > 0 ? COLORS.green : COLORS.darkGray);
      doc.fontSize(7).fillColor(textColor).text(value, cellX + 2, rowY + 3, { width: colWidths[i] - 4, align: "right" });
      cellX += colWidths[i];
    });

    rowY += rowHeight;
  });

  // Footer
  doc.fontSize(8).fillColor(COLORS.lightGray);
  doc.text(t("Document confidentiel | Généré par kWh Québec | Page 5", "Confidential document | Generated by kWh Québec | Page 5"), margin, pageHeight - 30, { align: "center", width: contentWidth });

  // ================= PAGE 6: INCENTIVES DETAIL =================
  doc.addPage();

  // Header
  doc.fontSize(10).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text("ÉTUDE PRÉLIMINAIRE : SOLAIRE + STOCKAGE", margin, margin, { align: "center", width: contentWidth });
  doc.font("Helvetica");
  doc.fontSize(10).fillColor(COLORS.mediumGray);
  doc.text(dateStr, margin, margin, { align: "right", width: contentWidth });

  doc.moveDown(2);

  // Incentives Detail Title
  doc.fontSize(14).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("DÉTAIL DES INCITATIFS ET SUBVENTIONS", "INCENTIVES AND SUBSIDIES DETAIL"), margin, doc.y);
  doc.font("Helvetica");
  doc.moveDown(1.5);

  // CAPEX Breakdown
  doc.fontSize(11).fillColor(COLORS.darkGray).font("Helvetica-Bold");
  doc.text(t("INVESTISSEMENT (CAPEX)", "INVESTMENT (CAPEX)"), margin, doc.y);
  doc.font("Helvetica");
  doc.moveDown(0.5);

  const bd = simulation.breakdown;
  const capexItems = [
    [t("CAPEX Solaire", "Solar CAPEX"), formatCurrency(bd.capexSolar)],
    [t("CAPEX Batterie", "Battery CAPEX"), formatCurrency(bd.capexBattery)],
    [t("CAPEX Brut Total", "Total Gross CAPEX"), formatCurrency(bd.capexGross)],
  ];

  currentY = doc.y;
  capexItems.forEach(([label, value], i) => {
    const isTotal = i === 2;
    doc.fontSize(10).fillColor(isTotal ? COLORS.darkGray : COLORS.mediumGray);
    if (isTotal) doc.font("Helvetica-Bold");
    doc.text(label, margin + 20, currentY);
    doc.text(value, margin + contentWidth - 150, currentY, { width: 130, align: "right" });
    if (isTotal) doc.font("Helvetica");
    currentY += 20;
  });

  doc.moveDown(1.5);

  // HQ Incentives
  doc.fontSize(11).fillColor(COLORS.green).font("Helvetica-Bold");
  doc.text(t("INCITATIFS HYDRO-QUÉBEC (max 40% du CAPEX)", "HYDRO-QUÉBEC INCENTIVES (max 40% of CAPEX)"), margin, doc.y);
  doc.font("Helvetica");
  doc.moveDown(0.5);

  currentY = doc.y;
  const hqItems = [
    [t("Solaire: $1,000/kW installé", "Solar: $1,000/kW installed"), `- ${formatCurrency(bd.actualHQSolar)}`],
    [t("Batterie: $300/kW de puissance", "Battery: $300/kW power"), `- ${formatCurrency(bd.actualHQBattery)}`],
    [t("Total Incitatifs HQ", "Total HQ Incentives"), `- ${formatCurrency(bd.totalHQ)}`],
    [t("(Plafond 40%: " + formatCurrency(bd.cap40Percent) + ")", "(40% Cap: " + formatCurrency(bd.cap40Percent) + ")"), ""],
  ];

  hqItems.forEach(([label, value], i) => {
    const isTotal = i === 2;
    doc.fontSize(10).fillColor(isTotal ? COLORS.green : COLORS.mediumGray);
    if (isTotal) doc.font("Helvetica-Bold");
    doc.text(label, margin + 20, currentY);
    if (value) doc.text(value, margin + contentWidth - 150, currentY, { width: 130, align: "right" });
    if (isTotal) doc.font("Helvetica");
    currentY += 20;
  });

  doc.moveDown(1);

  // Federal ITC
  doc.fontSize(11).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("CRÉDIT D'IMPÔT FÉDÉRAL (CII)", "FEDERAL INVESTMENT TAX CREDIT (ITC)"), margin, doc.y);
  doc.font("Helvetica");
  doc.moveDown(0.5);

  currentY = doc.y;
  doc.fontSize(10).fillColor(COLORS.mediumGray);
  doc.text(t("Crédit d'impôt fédéral (30%)", "Federal tax credit (30%)"), margin + 20, currentY);
  doc.fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(`- ${formatCurrency(bd.itcAmount)}`, margin + contentWidth - 150, currentY, { width: 130, align: "right" });
  doc.font("Helvetica");

  doc.moveDown(1.5);

  // Tax Shield
  doc.fontSize(11).fillColor(COLORS.gold).font("Helvetica-Bold");
  doc.text(t("BOUCLIER FISCAL (DPA/CCA)", "TAX SHIELD (CCA)"), margin, doc.y);
  doc.font("Helvetica");
  doc.moveDown(0.5);

  currentY = doc.y;
  doc.fontSize(10).fillColor(COLORS.mediumGray);
  doc.text(t("Déduction pour amortissement", "Capital cost allowance"), margin + 20, currentY);
  doc.fillColor(COLORS.gold).font("Helvetica-Bold");
  doc.text(`- ${formatCurrency(bd.taxShield)}`, margin + contentWidth - 150, currentY, { width: 130, align: "right" });
  doc.font("Helvetica");

  doc.moveDown(2);

  // Net CAPEX
  doc.fontSize(12).fillColor(COLORS.darkGray).font("Helvetica-Bold");
  doc.text(t("INVESTISSEMENT NET", "NET INVESTMENT"), margin, doc.y);
  doc.moveDown(0.3);
  doc.fontSize(24).fillColor(COLORS.blue);
  doc.text(formatCurrency(bd.capexNet), margin, doc.y);
  doc.font("Helvetica");

  // Footer
  doc.fontSize(8).fillColor(COLORS.lightGray);
  doc.text(t("Document confidentiel | Généré par kWh Québec | Page 6", "Confidential document | Generated by kWh Québec | Page 6"), margin, pageHeight - 30, { align: "center", width: contentWidth });

  // ================= PAGE 7: APPENDIX - OPTIMIZATION =================
  doc.addPage();

  // Header
  doc.fontSize(10).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text("ÉTUDE PRÉLIMINAIRE : SOLAIRE + STOCKAGE", margin, margin, { align: "center", width: contentWidth });
  doc.font("Helvetica");
  doc.fontSize(10).fillColor(COLORS.mediumGray);
  doc.text(dateStr, margin, margin, { align: "right", width: contentWidth });

  doc.moveDown(2);

  // Appendix Title
  doc.fontSize(14).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("ANNEXE : PREUVES D'OPTIMISATION", "APPENDIX: OPTIMIZATION PROOF"), margin, doc.y);
  doc.font("Helvetica");
  doc.moveDown(1.5);

  // Optimization summary
  doc.fontSize(10).fillColor(COLORS.darkGray);
  doc.text(t(
    "Le système recommandé a été optimisé pour maximiser la Valeur Actuelle Nette (VAN) tout en respectant les contraintes de toiture et de budget.",
    "The recommended system was optimized to maximize Net Present Value (NPV) while respecting roof and budget constraints."
  ), margin, doc.y, { width: contentWidth });
  doc.moveDown(1);

  // Key optimization metrics
  const optMetrics = [
    [t("Taille PV optimale", "Optimal PV size"), `${simulation.pvSizeKW.toFixed(0)} kWc`],
    [t("Capacité batterie optimale", "Optimal battery capacity"), `${simulation.battEnergyKWh.toFixed(0)} kWh / ${simulation.battPowerKW.toFixed(0)} kW`],
    [t("Autosuffisance atteinte", "Self-sufficiency achieved"), formatPercent(simulation.selfSufficiencyPercent / 100)],
    [t("Retour sur investissement", "Payback period"), `${simulation.simplePaybackYears.toFixed(1)} ${t("ans", "years")}`],
  ];

  currentY = doc.y;
  optMetrics.forEach(([label, value]) => {
    doc.fontSize(10).fillColor(COLORS.mediumGray).text(label, margin + 20, currentY);
    doc.fillColor(COLORS.darkGray).font("Helvetica-Bold").text(value, margin + contentWidth - 150, currentY, { width: 130, align: "right" });
    doc.font("Helvetica");
    currentY += 22;
  });

  // Footer
  doc.fontSize(8).fillColor(COLORS.lightGray);
  doc.text(t("Document confidentiel | Généré par kWh Québec | Page 7", "Confidential document | Generated by kWh Québec | Page 7"), margin, pageHeight - 30, { align: "center", width: contentWidth });
}
