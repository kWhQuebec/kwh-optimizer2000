import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { CashflowEntry, FinancialBreakdown, HourlyProfileEntry, PeakWeekEntry, SensitivityAnalysis, FrontierPoint, SolarSweepPoint, BatterySweepPoint } from "@shared/schema";

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
  sensitivity?: SensitivityAnalysis;
}

export function generateProfessionalPDF(
  doc: PDFKit.PDFDocument,
  simulation: SimulationData,
  lang: "fr" | "en" = "fr",
  allSiteSimulations: SimulationData[] = []
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

  const drawFrontierScatterChart = (
    x: number,
    y: number,
    width: number,
    height: number,
    frontier: FrontierPoint[],
    title: string
  ) => {
    doc.fontSize(10).fillColor(COLORS.darkGray).font("Helvetica-Bold");
    doc.text(title, x, y, { width });
    doc.font("Helvetica");

    if (!frontier || frontier.length === 0) {
      doc.fontSize(8).fillColor(COLORS.lightGray);
      doc.text(t("Données non disponibles", "Data not available"), x + 20, y + 30);
      return;
    }

    const chartHeight = height - 40;
    const chartWidth = width - 60;
    const chartX = x + 50;
    const chartY = y + 25;

    const capexValues = frontier.map(p => p.capexNet || 0);
    const npvValues = frontier.map(p => p.npv25 || 0);
    const maxCapex = Math.max(...capexValues) * 1.1 || 1;
    const minCapex = Math.min(...capexValues, 0) * 0.9;
    const maxNpv = Math.max(...npvValues) * 1.1;
    const minNpv = Math.min(...npvValues, 0) * 1.1;
    const npvRange = maxNpv - minNpv || 1;
    const capexRange = maxCapex - minCapex || 1;

    // Draw axes
    doc.strokeColor(COLORS.lightGray).lineWidth(0.5);
    doc.moveTo(chartX, chartY).lineTo(chartX, chartY + chartHeight).stroke();
    doc.moveTo(chartX, chartY + chartHeight).lineTo(chartX + chartWidth, chartY + chartHeight).stroke();

    // Axis labels
    doc.fontSize(7).fillColor(COLORS.mediumGray);
    doc.text(t("CAPEX ($)", "CAPEX ($)"), chartX + chartWidth / 2 - 20, chartY + chartHeight + 8);
    doc.save();
    doc.translate(x + 8, chartY + chartHeight / 2);
    doc.rotate(-90);
    doc.text(t("VAN 25 ans ($)", "NPV 25yr ($)"), -30, 0);
    doc.restore();

    // Draw points by type with different colors
    frontier.forEach((point) => {
      const px = chartX + ((point.capexNet - minCapex) / capexRange) * chartWidth;
      const py = chartY + chartHeight - ((point.npv25 - minNpv) / npvRange) * chartHeight;
      
      let color = COLORS.lightGray;
      if (point.type === "solar") color = COLORS.gold;
      else if (point.type === "battery") color = COLORS.blue;
      else if (point.type === "hybrid") color = COLORS.green;
      
      doc.circle(px, py, point.isOptimal ? 5 : 3).fillColor(color).fill();
      if (point.isOptimal) {
        doc.circle(px, py, 6).strokeColor(COLORS.darkGray).lineWidth(1.5).stroke();
      }
    });

    // Legend
    const legendY = y + height - 8;
    doc.fontSize(6).fillColor(COLORS.mediumGray);
    doc.circle(x + 15, legendY, 3).fillColor(COLORS.gold).fill();
    doc.text(t("Solaire", "Solar"), x + 22, legendY - 3);
    doc.circle(x + 60, legendY, 3).fillColor(COLORS.blue).fill();
    doc.text(t("Batterie", "Battery"), x + 67, legendY - 3);
    doc.circle(x + 115, legendY, 3).fillColor(COLORS.green).fill();
    doc.text(t("Hybride", "Hybrid"), x + 122, legendY - 3);
    doc.circle(x + 170, legendY, 5).strokeColor(COLORS.darkGray).lineWidth(1).stroke();
    doc.text(t("Optimal", "Optimal"), x + 180, legendY - 3);
  };

  const drawOptimizationLineChart = (
    x: number,
    y: number,
    width: number,
    height: number,
    data: Array<{ x: number; y: number; isOptimal?: boolean }>,
    title: string,
    xLabel: string,
    yLabel: string,
    lineColor: string = COLORS.blue
  ) => {
    doc.fontSize(10).fillColor(COLORS.darkGray).font("Helvetica-Bold");
    doc.text(title, x, y, { width });
    doc.font("Helvetica");

    if (!data || data.length === 0) {
      doc.fontSize(8).fillColor(COLORS.lightGray);
      doc.text(t("Données non disponibles", "Data not available"), x + 20, y + 30);
      return;
    }

    const chartHeight = height - 40;
    const chartWidth = width - 60;
    const chartX = x + 50;
    const chartY = y + 25;

    const xValues = data.map(p => p.x);
    const yValues = data.map(p => p.y);
    const maxX = Math.max(...xValues) * 1.05 || 1;
    const minX = Math.min(...xValues) * 0.95;
    const maxY = Math.max(...yValues) * 1.1;
    const minY = Math.min(...yValues, 0) * 1.1;
    const xRange = maxX - minX || 1;
    const yRange = maxY - minY || 1;

    // Draw axes
    doc.strokeColor(COLORS.lightGray).lineWidth(0.5);
    doc.moveTo(chartX, chartY).lineTo(chartX, chartY + chartHeight).stroke();
    doc.moveTo(chartX, chartY + chartHeight).lineTo(chartX + chartWidth, chartY + chartHeight).stroke();

    // Axis labels
    doc.fontSize(7).fillColor(COLORS.mediumGray);
    doc.text(xLabel, chartX + chartWidth / 2 - 20, chartY + chartHeight + 8);
    doc.save();
    doc.translate(x + 8, chartY + chartHeight / 2);
    doc.rotate(-90);
    doc.text(yLabel, -30, 0);
    doc.restore();

    // Draw line
    doc.strokeColor(lineColor).lineWidth(1.5);
    const sortedData = [...data].sort((a, b) => a.x - b.x);
    sortedData.forEach((point, i) => {
      const px = chartX + ((point.x - minX) / xRange) * chartWidth;
      const py = chartY + chartHeight - ((point.y - minY) / yRange) * chartHeight;
      if (i === 0) doc.moveTo(px, py);
      else doc.lineTo(px, py);
    });
    doc.stroke();

    // Draw points
    sortedData.forEach((point) => {
      const px = chartX + ((point.x - minX) / xRange) * chartWidth;
      const py = chartY + chartHeight - ((point.y - minY) / yRange) * chartHeight;
      doc.circle(px, py, 2).fillColor(lineColor).fill();
      if (point.isOptimal) {
        doc.circle(px, py, 5).strokeColor(COLORS.darkGray).lineWidth(1.5).stroke();
      }
    });

    // Mark optimal point with star
    const optimalPoint = sortedData.find(p => p.isOptimal);
    if (optimalPoint) {
      const px = chartX + ((optimalPoint.x - minX) / xRange) * chartWidth;
      const py = chartY + chartHeight - ((optimalPoint.y - minY) / yRange) * chartHeight;
      doc.fontSize(7).fillColor(COLORS.green).font("Helvetica-Bold");
      doc.text(t("Optimal", "Optimal"), px + 8, py - 10);
      doc.font("Helvetica");
    }
  };

  // ================= COVER PAGE =================
  
  // Try to load brand installation image as background
  const coverImagePath = path.join(process.cwd(), "attached_assets", "kWh__Quebec_Brand_Guideline_1764967501349.jpg");
  const logoPath = path.join(process.cwd(), "attached_assets", "kWh_Quebec_Logo-01_1764778562811.png");
  
  // Full page background image with dark overlay
  if (fs.existsSync(coverImagePath)) {
    try {
      doc.image(coverImagePath, 0, 0, { 
        width: pageWidth, 
        height: pageHeight 
      });
    } catch (e) {
      // Fallback to gradient background if image fails
      doc.rect(0, 0, pageWidth, pageHeight).fillColor(COLORS.blue).fill();
    }
  } else {
    // Gradient background fallback
    doc.rect(0, 0, pageWidth, pageHeight).fillColor(COLORS.blue).fill();
  }
  
  // Dark overlay for text readability
  doc.rect(0, 0, pageWidth, pageHeight).fillColor("black").fillOpacity(0.55).fill();
  doc.fillOpacity(1);
  
  // Logo at top
  if (fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, margin, margin, { width: 180 });
    } catch (e) {
      doc.fontSize(32).fillColor(COLORS.white).font("Helvetica-Bold");
      doc.text("kWh Québec", margin, margin);
      doc.font("Helvetica");
    }
  } else {
    doc.fontSize(32).fillColor(COLORS.white).font("Helvetica-Bold");
    doc.text("kWh Québec", margin, margin);
    doc.font("Helvetica");
  }
  
  // Main title - centered in middle of page
  const centerY = pageHeight / 2 - 80;
  
  doc.fontSize(36).fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text(t("ÉTUDE PRÉLIMINAIRE", "PRELIMINARY STUDY"), margin, centerY, { 
    width: contentWidth, 
    align: "center" 
  });
  doc.font("Helvetica");
  
  doc.fontSize(28).fillColor(COLORS.gold);
  doc.text(t("SOLAIRE + STOCKAGE", "SOLAR + STORAGE"), margin, centerY + 48, { 
    width: contentWidth, 
    align: "center" 
  });
  
  // Gold accent line
  doc.rect(pageWidth / 2 - 100, centerY + 95, 200, 4).fillColor(COLORS.gold).fill();
  
  // Site name
  doc.fontSize(22).fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text(simulation.site.name, margin, centerY + 120, { 
    width: contentWidth, 
    align: "center" 
  });
  doc.font("Helvetica");
  
  // Location
  const locationText = [simulation.site.city, simulation.site.province || "QC"].filter(Boolean).join(", ");
  doc.fontSize(14).fillColor(COLORS.white).fillOpacity(0.9);
  doc.text(locationText || "Québec", margin, centerY + 150, { 
    width: contentWidth, 
    align: "center" 
  });
  doc.fillOpacity(1);
  
  // Client info at bottom
  const bottomY = pageHeight - 150;
  
  if (simulation.site.client?.name) {
    doc.fontSize(12).fillColor(COLORS.white).fillOpacity(0.8);
    doc.text(t("Préparé pour:", "Prepared for:"), margin, bottomY, { 
      width: contentWidth, 
      align: "center" 
    });
    doc.fillOpacity(1);
    
    doc.fontSize(18).fillColor(COLORS.white).font("Helvetica-Bold");
    doc.text(simulation.site.client.name, margin, bottomY + 18, { 
      width: contentWidth, 
      align: "center" 
    });
    doc.font("Helvetica");
  }
  
  // Date at very bottom
  const coverDateStr = new Date().toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  doc.fontSize(12).fillColor(COLORS.white).fillOpacity(0.7);
  doc.text(coverDateStr, margin, pageHeight - 60, { 
    width: contentWidth, 
    align: "center" 
  });
  doc.fillOpacity(1);
  
  // Add new page for content
  doc.addPage();

  // ================= PAGE 1: TITLE & MAIN KPIs =================
  
  // Professional branded header bar
  const headerHeight = 80;
  doc.rect(0, 0, pageWidth, headerHeight).fillColor(COLORS.blue).fill();
  
  // Gold accent line at bottom of header
  doc.rect(0, headerHeight - 4, pageWidth, 4).fillColor(COLORS.gold).fill();
  
  // Company name in header
  doc.fontSize(28).fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text("kWh Québec", margin, 20);
  doc.font("Helvetica");
  
  // Document type label
  doc.fontSize(10).fillColor(COLORS.gold);
  doc.text(t("ÉTUDE PRÉLIMINAIRE : SOLAIRE + STOCKAGE", "PRELIMINARY STUDY: SOLAR + STORAGE"), margin, 52);
  
  // Date in header (right side)
  doc.fontSize(10).fillColor(COLORS.white);
  const dateStr = new Date().toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA");
  doc.text(dateStr, margin, 35, { align: "right", width: contentWidth });

  doc.y = headerHeight + 25;

  // Project Name & Location (larger, more prominent)
  doc.fontSize(28).fillColor(COLORS.darkGray).font("Helvetica-Bold");
  doc.text(simulation.site.name, margin, doc.y, { align: "left" });
  doc.font("Helvetica");
  
  // Gold underline for project name
  doc.y += 8;
  doc.rect(margin, doc.y, Math.min(contentWidth * 0.6, 300), 3).fillColor(COLORS.gold).fill();
  doc.y += 10;
  
  doc.fontSize(14).fillColor(COLORS.mediumGray);
  const location = [simulation.site.city, simulation.site.province || "QC"].filter(Boolean).join(", ");
  doc.text(location || "Québec", margin, doc.y);
  
  // Client name if available
  if (simulation.site.client?.name) {
    doc.y += 5;
    doc.fontSize(11).fillColor(COLORS.lightGray);
    doc.text(simulation.site.client.name, margin, doc.y);
  }

  doc.moveDown(1.5);

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

  // Total row - separated into subsidies and tax benefits
  doc.y = incentiveY + incentiveCardHeight + 15;
  
  // Subsidies total (HQ Solar + HQ Battery + Federal ITC)
  doc.fontSize(10).fillColor(COLORS.mediumGray);
  doc.text(t("Subventions directes (HQ + ITC):", "Direct subsidies (HQ + ITC):"), margin, doc.y);
  doc.fontSize(12).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(formatCurrency(simulation.totalIncentives), margin + 220, doc.y - 1);
  doc.font("Helvetica");
  
  doc.y += 18;
  
  // Tax shield row
  doc.fontSize(10).fillColor(COLORS.mediumGray);
  doc.text(t("Avantage fiscal (DPA):", "Tax benefit (CCA):"), margin, doc.y);
  doc.fontSize(12).fillColor(COLORS.gold).font("Helvetica-Bold");
  doc.text(formatCurrency(simulation.taxShield), margin + 220, doc.y - 1);
  doc.font("Helvetica");
  
  doc.y += 18;
  
  // Grand total
  doc.fontSize(11).fillColor(COLORS.darkGray).font("Helvetica-Bold");
  doc.text(t("TOTAL (SUBVENTIONS + AVANTAGE FISCAL):", "TOTAL (SUBSIDIES + TAX BENEFIT):"), margin, doc.y);
  doc.fontSize(14).fillColor(COLORS.blue);
  doc.text(formatCurrency(simulation.totalIncentives + simulation.taxShield), margin + 280, doc.y - 2);
  doc.font("Helvetica");

  // Footer
  doc.fontSize(8).fillColor(COLORS.lightGray);
  doc.text(t("Document confidentiel | Généré par kWh Québec | Page 1", "Confidential document | Generated by kWh Québec | Page 1"), margin, pageHeight - 30, { align: "center", width: contentWidth });

  // ================= MULTI-SCENARIO COMPARISON (if variants exist) =================
  const otherSimulations = allSiteSimulations.filter(s => s.id !== simulation.id);
  if (otherSimulations.length > 0) {
    doc.addPage();
    let pageNum = 2;
    
    // Header
    doc.fontSize(10).fillColor(COLORS.blue).font("Helvetica-Bold");
    doc.text(t("ÉTUDE PRÉLIMINAIRE : SOLAIRE + STOCKAGE", "PRELIMINARY STUDY: SOLAR + STORAGE"), margin, margin, { align: "center", width: contentWidth });
    doc.font("Helvetica");
    doc.fontSize(10).fillColor(COLORS.mediumGray);
    doc.text(dateStr, margin, margin, { align: "right", width: contentWidth });
    
    doc.moveDown(2);
    
    // Section title
    doc.fontSize(14).fillColor(COLORS.blue).font("Helvetica-Bold");
    doc.text(t("COMPARAISON DES SCÉNARIOS", "SCENARIO COMPARISON"), margin, doc.y);
    doc.font("Helvetica");
    doc.moveDown(0.5);
    
    doc.fontSize(9).fillColor(COLORS.mediumGray);
    doc.text(t("Cette analyse compare plusieurs configurations simulées pour ce site.", 
               "This analysis compares multiple simulated configurations for this site."), margin, doc.y);
    doc.moveDown(1.5);
    
    // All simulations including current one - limit to top 4 by NPV for readability
    const allScenarios = [simulation, ...otherSimulations]
      .sort((a, b) => (b.npv25 || 0) - (a.npv25 || 0))
      .slice(0, 4);
    
    // Table header
    const tableY = doc.y;
    const colWidths = [140, 70, 70, 75, 60, 75];
    const rowHeight = 24;
    
    // Draw header row
    drawRoundedRect(margin, tableY, contentWidth, rowHeight, 0, COLORS.blue);
    
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
    
    // Data rows
    let currentY = tableY + rowHeight;
    allScenarios.forEach((sim, idx) => {
      const isCurrentSim = sim.id === simulation.id;
      const rowBg = isCurrentSim ? "#E8F0FE" : (idx % 2 === 0 ? COLORS.white : COLORS.background);
      
      doc.rect(margin, currentY, contentWidth, rowHeight).fillColor(rowBg).fill();
      
      if (isCurrentSim) {
        doc.rect(margin, currentY, contentWidth, rowHeight).strokeColor(COLORS.blue).lineWidth(1).stroke();
      }
      
      doc.fontSize(8).fillColor(COLORS.darkGray);
      colX = margin + 5;
      
      // Scenario name (truncated if needed)
      const scenarioName = isCurrentSim 
        ? t("(Rapport actuel)", "(Current report)")
        : `${t("Variante", "Variant")} ${idx}`;
      doc.text(scenarioName, colX, currentY + 7, { width: colWidths[0] - 10 });
      colX += colWidths[0];
      
      // PV size
      doc.text(`${(sim.pvSizeKW || 0).toFixed(0)}`, colX, currentY + 7);
      colX += colWidths[1];
      
      // Battery (kWh / kW)
      doc.text(`${(sim.battEnergyKWh || 0).toFixed(0)} / ${(sim.battPowerKW || 0).toFixed(0)}`, colX, currentY + 7);
      colX += colWidths[2];
      
      // NPV 25yr
      doc.fillColor((sim.npv25 || 0) > 0 ? COLORS.green : COLORS.red);
      doc.text(formatCurrency(sim.npv25), colX, currentY + 7);
      colX += colWidths[3];
      
      // IRR
      doc.fillColor((sim.irr25 || 0) > 0.05 ? COLORS.green : COLORS.mediumGray);
      doc.text(formatPercent(sim.irr25), colX, currentY + 7);
      colX += colWidths[4];
      
      // Payback
      doc.fillColor(COLORS.darkGray);
      const payback = sim.simplePaybackYears || 0;
      doc.text(payback > 0 ? `${payback.toFixed(1)} ${t("ans", "yr")}` : "-", colX, currentY + 7);
      
      currentY += rowHeight;
    });
    
    // Draw table border
    doc.rect(margin, tableY, contentWidth, (allScenarios.length + 1) * rowHeight).strokeColor(COLORS.lightGray).lineWidth(0.5).stroke();
    
    doc.y = currentY + 15;
    
    // Best scenario summary
    const bestScenario = allScenarios[0];
    if (bestScenario.id === simulation.id) {
      doc.fontSize(9).fillColor(COLORS.green).font("Helvetica-Bold");
      doc.text(t("Le scénario présenté dans ce rapport est optimal.", 
                 "The scenario presented in this report is optimal."), margin, doc.y);
    } else {
      doc.fontSize(9).fillColor(COLORS.gold).font("Helvetica-Bold");
      doc.text(t("Note: Un autre scénario présente une VAN supérieure.", 
                 "Note: Another scenario shows a higher NPV."), margin, doc.y);
    }
    doc.font("Helvetica");
    
    // Footer
    doc.fontSize(8).fillColor(COLORS.lightGray);
    doc.text(t(`Document confidentiel | Généré par kWh Québec | Page ${pageNum}`, 
               `Confidential document | Generated by kWh Québec | Page ${pageNum}`), 
             margin, pageHeight - 30, { align: "center", width: contentWidth });
  }

  // ================= PAGE 2: CHARTS =================
  doc.addPage();

  // Header
  doc.fontSize(10).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("ÉTUDE PRÉLIMINAIRE : SOLAIRE + STOCKAGE", "PRELIMINARY STUDY: SOLAR + STORAGE"), margin, margin, { align: "center", width: contentWidth });
  doc.font("Helvetica");
  doc.fontSize(10).fillColor(COLORS.mediumGray);
  doc.text(dateStr, margin, margin, { align: "right", width: contentWidth });

  doc.moveDown(2);

  // Scenario Comparison Chart - VAN sur 25 ans par scénario
  // Show only calculated scenarios: Status quo vs PV+Battery recommendation
  // Note: PV-only would require a separate simulation; we show only the analyzed scenario
  
  drawBarChart(
    margin,
    doc.y,
    contentWidth,
    150,
    [
      { label: t("Statu quo\n(aucun investissement)", "Status quo\n(no investment)"), value: 0, color: COLORS.lightGray },
      { label: t("PV + Batterie\n(scénario analysé)", "PV + Battery\n(analyzed scenario)"), value: simulation.npv25, color: COLORS.green },
    ],
    t("COMPARAISON: VAN 25 ans (Valeur Actuelle Nette)", "COMPARISON: 25yr NPV (Net Present Value)")
  );
  
  // Add note about the comparison
  doc.y += 155;
  doc.fontSize(8).fillColor(COLORS.lightGray);
  doc.text(
    t("Note: Le scénario analysé inclut PV + stockage. D'autres configurations peuvent être analysées sur demande.",
      "Note: The analyzed scenario includes PV + storage. Other configurations can be analyzed upon request."),
    margin, doc.y, { width: contentWidth, align: "center" }
  );

  doc.y += 30;

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
  doc.text(t("ÉTUDE PRÉLIMINAIRE : SOLAIRE + STOCKAGE", "PRELIMINARY STUDY: SOLAR + STORAGE"), margin, margin, { align: "center", width: contentWidth });
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
  doc.text(t("ÉTUDE PRÉLIMINAIRE : SOLAIRE + STOCKAGE", "PRELIMINARY STUDY: SOLAR + STORAGE"), margin, margin, { align: "center", width: contentWidth });
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
  doc.text(t("ÉTUDE PRÉLIMINAIRE : SOLAIRE + STOCKAGE", "PRELIMINARY STUDY: SOLAR + STORAGE"), margin, margin, { align: "center", width: contentWidth });
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
      doc.text(t("ÉTUDE PRÉLIMINAIRE : SOLAIRE + STOCKAGE", "PRELIMINARY STUDY: SOLAR + STORAGE"), margin, margin, { align: "center", width: contentWidth });
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

  // ================= PAGE 5B: FINANCING OPTIONS COMPARISON =================
  doc.addPage();

  // Header
  doc.fontSize(10).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("ÉTUDE PRÉLIMINAIRE : SOLAIRE + STOCKAGE", "PRELIMINARY STUDY: SOLAR + STORAGE"), margin, margin, { align: "center", width: contentWidth });
  doc.font("Helvetica");
  doc.fontSize(10).fillColor(COLORS.mediumGray);
  doc.text(dateStr, margin, margin, { align: "right", width: contentWidth });

  doc.moveDown(2);

  // Financing Options Title
  doc.fontSize(14).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("OPTIONS DE FINANCEMENT", "FINANCING OPTIONS"), margin, doc.y);
  doc.font("Helvetica");
  doc.moveDown(0.5);
  
  doc.fontSize(9).fillColor(COLORS.mediumGray);
  doc.text(t("Comparaison des différentes options de financement disponibles sur 25 ans.", 
             "Comparison of different financing options available over 25 years."), margin, doc.y);
  doc.moveDown(1.5);

  // Calculate financing values
  // Note: totalIncentives from backend already includes HQ + Federal + taxShield
  const capexGross = simulation.capexGross || simulation.capexNet;
  const annualSavings = simulation.annualSavings || 0;
  const totalIncentives = simulation.totalIncentives || 0;
  const hqSolar = simulation.incentivesHQSolar || 0;
  const hqBattery = simulation.incentivesHQBattery || 0;
  const upfrontCashNeeded = capexGross - hqSolar - (hqBattery * 0.5);
  
  // Loan calculations (10-year, 7% interest, 30% down)
  const loanDownPayment = capexGross * 0.30;
  const loanAmount = capexGross - loanDownPayment;
  const monthlyRate = 0.07 / 12;
  const numPayments = 10 * 12;
  const monthlyPayment = (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
  const totalLoanPayments = monthlyPayment * numPayments + loanDownPayment;
  // Note: totalIncentives already includes taxShield (HQ + Federal + taxShield)
  const effectiveLoanCost = totalLoanPayments - totalIncentives;
  
  // Capital Lease (Crédit-bail) calculations (20-year, 8.5% implicit rate)
  // In capital lease, client is treated as owner for tax purposes and receives all incentives
  const leaseMonthlyPayment = (capexGross / (20 * 12)) + (capexGross * 0.085 / 12);
  const leaseTotalPayments = leaseMonthlyPayment * 12 * 20;
  // totalIncentives already includes taxShield
  const effectiveLeaseCost = leaseTotalPayments - totalIncentives;
  const leaseNetSavings = annualSavings * 25 - effectiveLeaseCost;
  
  // Define financing options colors
  const FINANCING_COLORS = {
    cash: { bg: "#E8F5E9", border: "#22C55E", text: "#16A34A" },
    loan: { bg: "#E3F2FD", border: "#3B82F6", text: "#2563EB" },
    lease: { bg: "#FFF8E1", border: "#F59E0B", text: "#D97706" },
  };

  // Draw 3 financing option cards
  const finCardY = doc.y;
  const finCardWidth = (contentWidth - 20) / 3;
  const finCardHeight = 180;

  // Cash Purchase Card
  drawRoundedRect(margin, finCardY, finCardWidth, finCardHeight, 6, FINANCING_COLORS.cash.bg);
  doc.roundedRect(margin, finCardY, finCardWidth, finCardHeight, 6).strokeColor(FINANCING_COLORS.cash.border).lineWidth(2).stroke();
  
  doc.fontSize(10).fillColor(FINANCING_COLORS.cash.text).font("Helvetica-Bold");
  doc.text(t("COMPTANT", "CASH"), margin + 5, finCardY + 10, { width: finCardWidth - 10, align: "center" });
  doc.font("Helvetica");
  
  doc.fontSize(8).fillColor(COLORS.darkGray);
  doc.text(t("Mise de fonds:", "Upfront:"), margin + 5, finCardY + 35, { width: finCardWidth - 10, align: "center" });
  doc.fontSize(14).fillColor(FINANCING_COLORS.cash.text).font("Helvetica-Bold");
  doc.text(formatCurrency(upfrontCashNeeded), margin + 5, finCardY + 48, { width: finCardWidth - 10, align: "center" });
  doc.font("Helvetica");
  
  doc.fontSize(8).fillColor(COLORS.darkGray);
  doc.text(t("Coût net:", "Net cost:"), margin + 5, finCardY + 75, { width: finCardWidth - 10, align: "center" });
  doc.fontSize(12).fillColor(FINANCING_COLORS.cash.text).font("Helvetica-Bold");
  doc.text(formatCurrency(simulation.capexNet), margin + 5, finCardY + 88, { width: finCardWidth - 10, align: "center" });
  doc.font("Helvetica");
  
  doc.fontSize(8).fillColor(COLORS.darkGray);
  doc.text(t("VAN 25 ans:", "NPV 25yr:"), margin + 5, finCardY + 115, { width: finCardWidth - 10, align: "center" });
  doc.fontSize(14).fillColor(COLORS.green).font("Helvetica-Bold");
  doc.text(formatCurrency(simulation.npv25), margin + 5, finCardY + 128, { width: finCardWidth - 10, align: "center" });
  doc.font("Helvetica");
  
  doc.fontSize(7).fillColor(COLORS.lightGray);
  doc.text(t("Retour: ", "Payback: ") + `${simulation.simplePaybackYears.toFixed(1)} ${t("ans", "yr")}`, margin + 5, finCardY + 155, { width: finCardWidth - 10, align: "center" });

  // Loan Card
  const loanX = margin + finCardWidth + 10;
  drawRoundedRect(loanX, finCardY, finCardWidth, finCardHeight, 6, FINANCING_COLORS.loan.bg);
  doc.roundedRect(loanX, finCardY, finCardWidth, finCardHeight, 6).strokeColor(FINANCING_COLORS.loan.border).lineWidth(2).stroke();
  
  doc.fontSize(10).fillColor(FINANCING_COLORS.loan.text).font("Helvetica-Bold");
  doc.text(t("PRÊT", "LOAN"), loanX + 5, finCardY + 10, { width: finCardWidth - 10, align: "center" });
  doc.font("Helvetica");
  
  doc.fontSize(7).fillColor(COLORS.mediumGray);
  doc.text(t("10 ans, 7%, 30% acompte", "10yr, 7%, 30% down"), loanX + 5, finCardY + 25, { width: finCardWidth - 10, align: "center" });
  
  doc.fontSize(8).fillColor(COLORS.darkGray);
  doc.text(t("Paiement/mois:", "Monthly:"), loanX + 5, finCardY + 45, { width: finCardWidth - 10, align: "center" });
  doc.fontSize(14).fillColor(FINANCING_COLORS.loan.text).font("Helvetica-Bold");
  doc.text(formatCurrency(monthlyPayment), loanX + 5, finCardY + 58, { width: finCardWidth - 10, align: "center" });
  doc.font("Helvetica");
  
  doc.fontSize(8).fillColor(COLORS.darkGray);
  doc.text(t("Coût net:", "Net cost:"), loanX + 5, finCardY + 85, { width: finCardWidth - 10, align: "center" });
  doc.fontSize(12).fillColor(FINANCING_COLORS.loan.text).font("Helvetica-Bold");
  doc.text(formatCurrency(effectiveLoanCost), loanX + 5, finCardY + 98, { width: finCardWidth - 10, align: "center" });
  doc.font("Helvetica");
  
  doc.fontSize(8).fillColor(COLORS.darkGray);
  doc.text(t("Profit 25 ans:", "25yr profit:"), loanX + 5, finCardY + 125, { width: finCardWidth - 10, align: "center" });
  const loanNetSavings = annualSavings * 25 - effectiveLoanCost;
  doc.fontSize(14).fillColor(loanNetSavings > 0 ? COLORS.green : COLORS.red).font("Helvetica-Bold");
  doc.text(formatCurrency(loanNetSavings), loanX + 5, finCardY + 138, { width: finCardWidth - 10, align: "center" });
  doc.font("Helvetica");

  // Capital Lease (Crédit-bail) Card
  const leaseX = margin + 2 * (finCardWidth + 10);
  drawRoundedRect(leaseX, finCardY, finCardWidth, finCardHeight, 6, FINANCING_COLORS.lease.bg);
  doc.roundedRect(leaseX, finCardY, finCardWidth, finCardHeight, 6).strokeColor(FINANCING_COLORS.lease.border).lineWidth(2).stroke();
  
  doc.fontSize(9).fillColor(FINANCING_COLORS.lease.text).font("Helvetica-Bold");
  doc.text(t("CRÉDIT-BAIL", "CAPITAL LEASE"), leaseX + 5, finCardY + 10, { width: finCardWidth - 10, align: "center" });
  doc.font("Helvetica");
  
  doc.fontSize(7).fillColor(COLORS.mediumGray);
  doc.text(t("20 ans, 8.5%", "20yr, 8.5%"), leaseX + 5, finCardY + 25, { width: finCardWidth - 10, align: "center" });
  
  doc.fontSize(8).fillColor(COLORS.darkGray);
  doc.text(t("Paiement/mois:", "Monthly:"), leaseX + 5, finCardY + 45, { width: finCardWidth - 10, align: "center" });
  doc.fontSize(14).fillColor(FINANCING_COLORS.lease.text).font("Helvetica-Bold");
  doc.text(formatCurrency(leaseMonthlyPayment), leaseX + 5, finCardY + 58, { width: finCardWidth - 10, align: "center" });
  doc.font("Helvetica");
  
  doc.fontSize(8).fillColor(COLORS.darkGray);
  doc.text(t("Coût net:", "Net cost:"), leaseX + 5, finCardY + 85, { width: finCardWidth - 10, align: "center" });
  doc.fontSize(12).fillColor(FINANCING_COLORS.lease.text).font("Helvetica-Bold");
  doc.text(formatCurrency(effectiveLeaseCost), leaseX + 5, finCardY + 98, { width: finCardWidth - 10, align: "center" });
  doc.font("Helvetica");
  
  doc.fontSize(8).fillColor(COLORS.darkGray);
  doc.text(t("Profit 25 ans:", "25yr profit:"), leaseX + 5, finCardY + 125, { width: finCardWidth - 10, align: "center" });
  doc.fontSize(14).fillColor(leaseNetSavings > 0 ? COLORS.green : COLORS.red).font("Helvetica-Bold");
  doc.text(formatCurrency(leaseNetSavings), leaseX + 5, finCardY + 138, { width: finCardWidth - 10, align: "center" });
  doc.font("Helvetica");
  
  doc.fontSize(7).fillColor(COLORS.lightGray);
  doc.text(t("*Incitatifs inclus", "*Incentives included"), leaseX + 5, finCardY + 160, { width: finCardWidth - 10, align: "center" });

  doc.y = finCardY + finCardHeight + 20;

  // Recommendation note
  doc.fontSize(9).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("RECOMMANDATION:", "RECOMMENDATION:"), margin, doc.y);
  doc.font("Helvetica");
  doc.fontSize(9).fillColor(COLORS.mediumGray);
  doc.text(t(" L'achat comptant maximise la VAN. Le crédit-bail est idéal pour préserver la trésorerie tout en recevant les incitatifs.",
             " Cash purchase maximizes NPV. Capital lease is ideal to preserve cash flow while still receiving incentives."), margin + 100, doc.y);

  // Footer
  doc.fontSize(8).fillColor(COLORS.lightGray);
  doc.text(t("Document confidentiel | Généré par kWh Québec | Options de financement", "Confidential document | Generated by kWh Québec | Financing options"), margin, pageHeight - 30, { align: "center", width: contentWidth });

  // ================= PAGE 6: INCENTIVES DETAIL =================
  doc.addPage();

  // Header
  doc.fontSize(10).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("ÉTUDE PRÉLIMINAIRE : SOLAIRE + STOCKAGE", "PRELIMINARY STUDY: SOLAR + STORAGE"), margin, margin, { align: "center", width: contentWidth });
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

  // ================= PAGE 7: APPENDIX - OPTIMIZATION (Conditional) =================
  const hasSensitivityData = simulation.sensitivity && (
    (simulation.sensitivity.frontier && simulation.sensitivity.frontier.length > 0) ||
    (simulation.sensitivity.solarSweep && simulation.sensitivity.solarSweep.length > 0) ||
    (simulation.sensitivity.batterySweep && simulation.sensitivity.batterySweep.length > 0)
  );

  if (hasSensitivityData) {
    doc.addPage();

    // Header
    doc.fontSize(10).fillColor(COLORS.blue).font("Helvetica-Bold");
    doc.text(t("ÉTUDE PRÉLIMINAIRE : SOLAIRE + STOCKAGE", "PRELIMINARY STUDY: SOLAR + STORAGE"), margin, margin, { align: "center", width: contentWidth });
    doc.font("Helvetica");
    doc.fontSize(10).fillColor(COLORS.mediumGray);
    doc.text(dateStr, margin, margin, { align: "right", width: contentWidth });

    doc.moveDown(2);

    // Appendix Title
    doc.fontSize(14).fillColor(COLORS.blue).font("Helvetica-Bold");
    doc.text(t("ANNEXE : ANALYSE D'OPTIMISATION", "APPENDIX: OPTIMIZATION ANALYSIS"), margin, doc.y);
    doc.font("Helvetica");
    doc.moveDown(0.5);

    // Optimization summary
    doc.fontSize(9).fillColor(COLORS.darkGray);
    doc.text(t(
      "Les graphiques ci-dessous montrent comment la VAN varie selon différentes configurations. Le point optimal est identifié.",
      "The charts below show how NPV varies with different system configurations. The optimal point is identified."
    ), margin, doc.y, { width: contentWidth });
    doc.moveDown(1);

    const chartHeight = 160;
    const halfWidth = (contentWidth - 10) / 2;

    // 1. Efficiency Frontier (full width)
    if (simulation.sensitivity.frontier && simulation.sensitivity.frontier.length > 0) {
      drawFrontierScatterChart(
        margin,
        doc.y,
        contentWidth,
        chartHeight,
        simulation.sensitivity.frontier,
        t("Frontière d'efficacité (CAPEX vs VAN)", "Efficiency Frontier (CAPEX vs NPV)")
      );
      doc.y += chartHeight + 15;
    }

    // 2. Solar Sweep & Battery Sweep (side by side)
    const row2Y = doc.y;
    
    // Solar optimization chart
    if (simulation.sensitivity.solarSweep && simulation.sensitivity.solarSweep.length > 0) {
      const solarData = simulation.sensitivity.solarSweep.map(p => ({
        x: p.pvSizeKW,
        y: p.npv25,
        isOptimal: p.isOptimal
      }));
      drawOptimizationLineChart(
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

    // Battery optimization chart
    if (simulation.sensitivity.batterySweep && simulation.sensitivity.batterySweep.length > 0) {
      const batteryData = simulation.sensitivity.batterySweep.map(p => ({
        x: p.battEnergyKWh,
        y: p.npv25,
        isOptimal: p.isOptimal
      }));
      drawOptimizationLineChart(
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

    currentY = doc.y;
    optMetrics.forEach(([label, value]) => {
      doc.fontSize(9).fillColor(COLORS.mediumGray).text(label, margin + 20, currentY);
      doc.fillColor(COLORS.darkGray).font("Helvetica-Bold").text(value, margin + contentWidth - 150, currentY, { width: 130, align: "right" });
      doc.font("Helvetica");
      currentY += 18;
    });

    // Footer
    doc.fontSize(8).fillColor(COLORS.lightGray);
    doc.text(t("Document confidentiel | Généré par kWh Québec | Page 7", "Confidential document | Generated by kWh Québec | Page 7"), margin, pageHeight - 30, { align: "center", width: contentWidth });
  } else {
    // Basic Page 7 without charts when no sensitivity data
    doc.addPage();

    // Header
    doc.fontSize(10).fillColor(COLORS.blue).font("Helvetica-Bold");
    doc.text(t("ÉTUDE PRÉLIMINAIRE : SOLAIRE + STOCKAGE", "PRELIMINARY STUDY: SOLAR + STORAGE"), margin, margin, { align: "center", width: contentWidth });
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
}

// ==================== METHODOLOGY PDF GENERATOR ====================

export function generateMethodologyPDF(
  doc: PDFKit.PDFDocument,
  lang: "fr" | "en" = "fr"
): void {
  const t = (fr: string, en: string) => (lang === "fr" ? fr : en);
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 50;
  const contentWidth = pageWidth - 2 * margin;
  const dateStr = new Date().toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA", { year: "numeric", month: "long", day: "numeric" });

  // Helper for section headers
  const drawSectionHeader = (title: string, pageNum: number) => {
    doc.fontSize(10).fillColor(COLORS.blue).font("Helvetica-Bold");
    doc.text("MÉTHODOLOGIE D'ANALYSE", margin, margin, { continued: false });
    doc.font("Helvetica");
    doc.fontSize(10).fillColor(COLORS.mediumGray);
    doc.text(dateStr, pageWidth - margin - 100, margin, { width: 100, align: "right" });
    doc.moveDown(1);
    
    doc.fontSize(16).fillColor(COLORS.blue).font("Helvetica-Bold");
    doc.text(title, margin, doc.y);
    doc.font("Helvetica");
    doc.moveDown(1);
  };

  const drawFooter = (pageNum: number) => {
    doc.fontSize(8).fillColor(COLORS.lightGray);
    doc.text(t(`Document technique | kWh Québec | Page ${pageNum}`, `Technical document | kWh Québec | Page ${pageNum}`), margin, pageHeight - 30, { align: "center", width: contentWidth });
  };

  // ==================== PAGE 1: COVER PAGE ====================
  
  // Blue header bar
  doc.rect(0, 0, pageWidth, 160).fill(COLORS.blue);
  
  // Title
  doc.fontSize(28).fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text(t("DOCUMENTATION", "METHODOLOGY"), margin, 50, { width: contentWidth, align: "center" });
  doc.fontSize(24).fillColor(COLORS.gold);
  doc.text(t("MÉTHODOLOGIQUE", "DOCUMENTATION"), margin, 85, { width: contentWidth, align: "center" });
  doc.font("Helvetica");

  // Subtitle
  doc.fontSize(12).fillColor(COLORS.white);
  doc.text(t("Analyse Solaire + Stockage", "Solar + Storage Analysis"), margin, 125, { width: contentWidth, align: "center" });

  // Main content section
  doc.fontSize(12).fillColor(COLORS.darkGray);
  doc.text(t(
    "Ce document présente la méthodologie complète utilisée par kWh Québec pour les analyses de potentiel solaire et stockage. Il détaille les hypothèses, formules et calculs utilisés dans nos simulations énergétiques et financières sur 25 ans.",
    "This document presents the complete methodology used by kWh Québec for solar and storage potential analyses. It details the assumptions, formulas and calculations used in our 25-year energy and financial simulations."
  ), margin, 200, { width: contentWidth, align: "justify" });

  // Table of contents
  doc.moveDown(3);
  doc.fontSize(14).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("TABLE DES MATIÈRES", "TABLE OF CONTENTS"), margin, doc.y);
  doc.font("Helvetica");
  doc.moveDown(1);

  const tocItems = [
    [t("1. Aperçu et objectifs", "1. Overview and objectives"), "2"],
    [t("2. Données d'entrée et hypothèses", "2. Input data and assumptions"), "2"],
    [t("3. Simulation de production solaire", "3. Solar production simulation"), "3"],
    [t("4. Stockage et écrêtage de pointe", "4. Storage and peak shaving"), "4"],
    [t("5. Modélisation financière", "5. Financial modeling"), "5"],
    [t("6. Incitatifs et subventions", "6. Incentives and subsidies"), "6"],
    [t("7. Optimisation et sensibilité", "7. Optimization and sensitivity"), "7"],
    [t("8. Références et normes", "8. References and standards"), "8"],
  ];

  tocItems.forEach(([title, page]) => {
    doc.fontSize(11).fillColor(COLORS.darkGray);
    doc.text(title, margin + 20, doc.y, { continued: true });
    doc.text(page, { align: "right", width: contentWidth - 20 });
    doc.moveDown(0.5);
  });

  // Version info
  doc.moveDown(3);
  doc.fontSize(10).fillColor(COLORS.mediumGray);
  doc.text(t(`Version 1.0 | ${dateStr}`, `Version 1.0 | ${dateStr}`), margin, doc.y);
  doc.text(t("kWh Québec | info@kwh.quebec", "kWh Québec | info@kwh.quebec"));

  drawFooter(1);

  // ==================== PAGE 2: OVERVIEW ====================
  doc.addPage();
  drawSectionHeader(t("1. APERÇU ET OBJECTIFS", "1. OVERVIEW AND OBJECTIVES"), 2);

  doc.fontSize(11).fillColor(COLORS.darkGray);
  doc.text(t(
    "L'outil d'analyse kWh Québec effectue une simulation énergétique et financière complète sur 25 ans pour des systèmes solaires photovoltaïques avec ou sans stockage par batterie.",
    "The kWh Québec analysis tool performs a comprehensive 25-year energy and financial simulation for photovoltaic solar systems with or without battery storage."
  ), margin, doc.y, { width: contentWidth });
  doc.moveDown(1);

  doc.font("Helvetica-Bold").text(t("Objectifs de l'analyse:", "Analysis objectives:"));
  doc.font("Helvetica");
  doc.moveDown(0.5);
  
  const objectives = lang === "fr" ? [
    "• Simulation horaire 8760 heures de la production solaire et consommation",
    "• Modélisation du comportement de la batterie avec suivi de l'état de charge",
    "• Calcul des économies d'énergie et de puissance selon les tarifs Hydro-Québec",
    "• Projection financière incluant tous les incitatifs gouvernementaux",
    "• Analyse de sensibilité multi-scénarios pour optimiser le dimensionnement",
  ] : [
    "• 8760-hour simulation of solar production and consumption",
    "• Battery behavior modeling with state of charge tracking",
    "• Energy and power savings calculation based on Hydro-Québec rates",
    "• Financial projection including all government incentives",
    "• Multi-scenario sensitivity analysis for sizing optimization",
  ];
  
  objectives.forEach(obj => {
    doc.text(obj, margin + 10, doc.y, { width: contentWidth - 20 });
    doc.moveDown(0.3);
  });

  doc.moveDown(1);
  doc.fontSize(14).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("2. DONNÉES D'ENTRÉE", "2. INPUT DATA"), margin, doc.y);
  doc.font("Helvetica");
  doc.moveDown(1);

  doc.fontSize(11).fillColor(COLORS.darkGray).font("Helvetica-Bold");
  doc.text(t("Données de consommation:", "Consumption data:"));
  doc.font("Helvetica");
  doc.moveDown(0.5);
  
  const consumptionData = lang === "fr" ? [
    "• Fichiers CSV exportés d'Hydro-Québec",
    "• Données horaires en kWh (énergie)",
    "• Données 15-minutes en kW (puissance)",
    "• Format Latin-1, délimiteurs point-virgule",
    "• Jusqu'à 200 fichiers (24+ mois de données)",
  ] : [
    "• CSV files exported from Hydro-Québec",
    "• Hourly data in kWh (energy)",
    "• 15-minute data in kW (power)",
    "• Latin-1 format, semicolon delimiters",
    "• Up to 200 files (24+ months of data)",
  ];
  
  consumptionData.forEach(item => {
    doc.text(item, margin + 10, doc.y, { width: contentWidth - 20 });
    doc.moveDown(0.3);
  });

  doc.moveDown(1);
  doc.font("Helvetica-Bold");
  doc.text(t("Hypothèses par défaut:", "Default assumptions:"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  // Create a simple table for assumptions
  const assumptions = [
    [t("Rendement système solaire", "Solar system efficiency"), "85%"],
    [t("Dégradation annuelle PV", "Annual PV degradation"), "0.5%/an"],
    [t("Efficacité batterie aller-retour", "Battery round-trip efficiency"), "90%"],
    [t("Profondeur de décharge", "Depth of discharge"), "90%"],
    [t("Taux d'actualisation (WACC)", "Discount rate (WACC)"), "8%"],
    [t("Inflation tarif HQ", "HQ rate inflation"), "4.8%/an"],
    [t("Taux d'imposition corporatif", "Corporate tax rate"), "26.5%"],
  ];

  assumptions.forEach(([label, value]) => {
    doc.fontSize(10).fillColor(COLORS.darkGray);
    doc.text(label, margin + 10, doc.y, { continued: true, width: 300 });
    doc.fillColor(COLORS.blue).text(value, { align: "right", width: contentWidth - 320 });
    doc.moveDown(0.3);
  });

  drawFooter(2);

  // ==================== PAGE 3: SOLAR PRODUCTION ====================
  doc.addPage();
  drawSectionHeader(t("3. SIMULATION DE PRODUCTION SOLAIRE", "3. SOLAR PRODUCTION SIMULATION"), 3);

  doc.fontSize(11).fillColor(COLORS.darkGray);
  doc.text(t(
    "La production solaire est simulée pour chaque heure de l'année (8760 heures) en utilisant un modèle gaussien ajusté selon la latitude du Québec et les variations saisonnières.",
    "Solar production is simulated for each hour of the year (8760 hours) using a Gaussian model adjusted for Quebec's latitude and seasonal variations."
  ), margin, doc.y, { width: contentWidth });
  doc.moveDown(1.5);

  doc.font("Helvetica-Bold");
  doc.text(t("Formule de production horaire:", "Hourly production formula:"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  // Formula box
  doc.rect(margin, doc.y, contentWidth, 40).fillAndStroke("#F0F4F8", COLORS.blue);
  doc.fontSize(12).fillColor(COLORS.darkGray).font("Courier");
  doc.text("P(h) = Pnom × Geff(h) / Gstc × ηsys × (1 - δ)^année", margin + 20, doc.y - 35);
  doc.font("Helvetica");
  doc.moveDown(2);

  doc.fontSize(10).fillColor(COLORS.mediumGray).font("Helvetica-Bold");
  doc.text(t("Où:", "Where:"));
  doc.font("Helvetica");
  doc.moveDown(0.3);

  const variables = lang === "fr" ? [
    ["P(h)", "Production à l'heure h (kWh)"],
    ["Pnom", "Puissance nominale du système (kWc)"],
    ["Geff(h)", "Irradiation effective à l'heure h (W/m²)"],
    ["Gstc", "Irradiation aux conditions standard (1000 W/m²)"],
    ["ηsys", "Rendement système global (85%)"],
    ["δ", "Taux de dégradation annuel (0.5%)"],
  ] : [
    ["P(h)", "Production at hour h (kWh)"],
    ["Pnom", "System nominal power (kWp)"],
    ["Geff(h)", "Effective irradiation at hour h (W/m²)"],
    ["Gstc", "Standard test conditions irradiation (1000 W/m²)"],
    ["ηsys", "Overall system efficiency (85%)"],
    ["δ", "Annual degradation rate (0.5%)"],
  ];

  variables.forEach(([symbol, desc]) => {
    doc.fontSize(10).fillColor(COLORS.blue).font("Courier").text(symbol, margin + 20, doc.y, { continued: true, width: 80 });
    doc.font("Helvetica").fillColor(COLORS.darkGray).text(`: ${desc}`, { width: contentWidth - 120 });
    doc.moveDown(0.2);
  });

  doc.moveDown(1);
  doc.fontSize(11).fillColor(COLORS.darkGray).font("Helvetica-Bold");
  doc.text(t("Ajustement saisonnier:", "Seasonal adjustment:"));
  doc.font("Helvetica");
  doc.moveDown(0.5);
  
  doc.text(t(
    "Le modèle intègre les variations saisonnières typiques du Québec avec un pic de production en juin et une production minimale en décembre. L'amplitude de production varie d'un facteur 3-4x entre l'été et l'hiver.",
    "The model incorporates typical Quebec seasonal variations with peak production in June and minimum production in December. Production amplitude varies by a factor of 3-4x between summer and winter."
  ), margin, doc.y, { width: contentWidth });

  doc.moveDown(1.5);
  doc.font("Helvetica-Bold");
  doc.text(t("Dimensionnement du système:", "System sizing:"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  doc.rect(margin, doc.y, contentWidth, 35).fillAndStroke("#F0F4F8", COLORS.blue);
  doc.fontSize(11).fillColor(COLORS.darkGray).font("Courier");
  doc.text("PV_max (kWc) = (Superficie × Ratio_utilisation) / 10", margin + 20, doc.y - 30);
  doc.font("Helvetica");
  doc.moveDown(2);

  doc.fontSize(10).fillColor(COLORS.darkGray);
  doc.text(t(
    "La densité de puissance standard est de 10 pi²/kWc. Le ratio d'utilisation typique varie de 60% à 80% selon les obstacles et contraintes de la toiture.",
    "Standard power density is 10 sq ft/kWp. Typical utilization ratio ranges from 60% to 80% depending on roof obstacles and constraints."
  ), margin, doc.y, { width: contentWidth });

  drawFooter(3);

  // ==================== PAGE 4: BATTERY STORAGE ====================
  doc.addPage();
  drawSectionHeader(t("4. STOCKAGE ET ÉCRÊTAGE DE POINTE", "4. STORAGE AND PEAK SHAVING"), 4);

  doc.fontSize(11).fillColor(COLORS.darkGray);
  doc.text(t(
    "L'algorithme de gestion de la batterie vise à réduire les pointes de puissance appelées du réseau, générant des économies sur les frais de puissance.",
    "The battery management algorithm aims to reduce power peaks drawn from the grid, generating savings on demand charges."
  ), margin, doc.y, { width: contentWidth });
  doc.moveDown(1.5);

  doc.font("Helvetica-Bold");
  doc.text(t("Algorithme de dispatch:", "Dispatch algorithm:"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  const algorithm = lang === "fr" ? [
    "1. Calculer la charge nette: Load_net = Consommation - Production_solaire",
    "2. Si Load_net > Seuil_écrêtage ET SOC > SOC_min: Décharger la batterie",
    "3. Si Load_net < 0 ET SOC < SOC_max: Charger avec surplus solaire",
    "4. Respecter les limites de puissance C-rate de la batterie",
    "5. Mise à jour de l'état de charge (SOC) après chaque intervalle",
  ] : [
    "1. Calculate net load: Load_net = Consumption - Solar_production",
    "2. If Load_net > Shaving_threshold AND SOC > SOC_min: Discharge battery",
    "3. If Load_net < 0 AND SOC < SOC_max: Charge with solar surplus",
    "4. Respect battery C-rate power limits",
    "5. Update state of charge (SOC) after each interval",
  ];

  algorithm.forEach(step => {
    doc.fontSize(10).text(step, margin + 10, doc.y, { width: contentWidth - 20 });
    doc.moveDown(0.4);
  });

  doc.moveDown(1);
  doc.font("Helvetica-Bold");
  doc.text(t("Suivi de l'état de charge:", "State of charge tracking:"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  doc.rect(margin, doc.y, contentWidth, 35).fillAndStroke("#F0F4F8", COLORS.blue);
  doc.fontSize(11).fillColor(COLORS.darkGray).font("Courier");
  doc.text("SOC(t+1) = SOC(t) ± (P_batt × Δt × η) / E_batt", margin + 20, doc.y - 30);
  doc.font("Helvetica");
  doc.moveDown(2);

  doc.fontSize(11).font("Helvetica-Bold");
  doc.text(t("Dimensionnement de la batterie:", "Battery sizing:"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  const batteryParams = [
    [t("Capacité énergétique (kWh)", "Energy capacity (kWh)"), t("E_batt = Énergie_écrêtage × Facteur_sécurité / DoD", "E_batt = Shaving_energy × Safety_factor / DoD")],
    [t("Puissance (kW)", "Power (kW)"), t("P_batt = Réduction_pointe_cible × Facteur_sécurité", "P_batt = Target_peak_reduction × Safety_factor")],
  ];

  batteryParams.forEach(([param, formula]) => {
    doc.fontSize(10).fillColor(COLORS.darkGray).font("Helvetica-Bold").text(param, margin + 10, doc.y);
    doc.font("Courier").fontSize(9).fillColor(COLORS.mediumGray).text(formula, margin + 20, doc.y);
    doc.font("Helvetica");
    doc.moveDown(0.6);
  });

  doc.moveDown(1);
  doc.fontSize(11).font("Helvetica-Bold");
  doc.text(t("Dégradation et remplacement:", "Degradation and replacement:"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  const degradation = lang === "fr" ? [
    "• Durée de vie typique: 10-15 ans selon l'utilisation",
    "• Coût de remplacement: % du coût initial avec déclin annuel",
    "• Inflation appliquée au coût de remplacement",
    "• Année de remplacement configurable dans les paramètres",
  ] : [
    "• Typical lifespan: 10-15 years depending on usage",
    "• Replacement cost: % of initial cost with annual decline",
    "• Inflation applied to replacement cost",
    "• Replacement year configurable in parameters",
  ];

  degradation.forEach(item => {
    doc.fontSize(10).text(item, margin + 10, doc.y, { width: contentWidth - 20 });
    doc.moveDown(0.3);
  });

  drawFooter(4);

  // ==================== PAGE 5: FINANCIAL MODELING ====================
  doc.addPage();
  drawSectionHeader(t("5. MODÉLISATION FINANCIÈRE", "5. FINANCIAL MODELING"), 5);

  doc.fontSize(11).fillColor(COLORS.darkGray);
  doc.text(t(
    "Le modèle génère un flux de trésorerie annuel sur 25 ans en considérant tous les revenus (économies) et coûts (O&M, remplacement batterie).",
    "The model generates annual cash flow over 25 years considering all revenues (savings) and costs (O&M, battery replacement)."
  ), margin, doc.y, { width: contentWidth });
  doc.moveDown(1.5);

  doc.font("Helvetica-Bold");
  doc.text(t("Calcul du CAPEX:", "CAPEX calculation:"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  doc.rect(margin, doc.y, contentWidth, 50).fillAndStroke("#F0F4F8", COLORS.blue);
  doc.fontSize(10).fillColor(COLORS.darkGray).font("Courier");
  doc.text("CAPEX_total = (PV_kWc × Coût_PV) +", margin + 15, doc.y - 45);
  doc.text("              (Batt_kWh × Coût_kWh) +", margin + 15, doc.y - 30);
  doc.text("              (Batt_kW × Coût_kW)", margin + 15, doc.y - 15);
  doc.font("Helvetica");
  doc.moveDown(3);

  doc.font("Helvetica-Bold");
  doc.text(t("Revenus (économies annuelles):", "Revenue (annual savings):"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  doc.rect(margin, doc.y, contentWidth, 35).fillAndStroke("#F0F4F8", COLORS.green);
  doc.fontSize(10).fillColor(COLORS.darkGray).font("Courier");
  doc.text(t(
    "Économies = Énergie_éco × Tarif_énergie + Puissance_réduite × Tarif_puissance × 12",
    "Savings = Energy_saved × Energy_rate + Power_reduced × Power_rate × 12"
  ), margin + 10, doc.y - 30);
  doc.font("Helvetica");
  doc.moveDown(2.5);

  doc.font("Helvetica-Bold");
  doc.text(t("Coûts d'exploitation (O&M):", "Operating costs (O&M):"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  doc.rect(margin, doc.y, contentWidth, 35).fillAndStroke("#F0F4F8", "#DC2626");
  doc.fontSize(10).fillColor(COLORS.darkGray).font("Courier");
  doc.text(t(
    "O&M = CAPEX_PV × %O&M_PV + CAPEX_Batt × %O&M_Batt × (1 + inflation)^an",
    "O&M = CAPEX_PV × %O&M_PV + CAPEX_Batt × %O&M_Batt × (1 + inflation)^year"
  ), margin + 10, doc.y - 30);
  doc.font("Helvetica");
  doc.moveDown(2.5);

  doc.fontSize(11).font("Helvetica-Bold");
  doc.text(t("Métriques financières:", "Financial metrics:"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  const metrics = [
    [t("VAN (Valeur Actuelle Nette)", "NPV (Net Present Value)"), t("VAN = -CAPEX_net + Σ(CF / (1+r)^an)", "NPV = -Net_CAPEX + Σ(CF / (1+r)^year)")],
    [t("TRI (Taux de Rendement Interne)", "IRR (Internal Rate of Return)"), t("VAN(TRI) = 0 → résoudre pour TRI", "NPV(IRR) = 0 → solve for IRR")],
    [t("Temps de Retour Simple", "Simple Payback"), t("Payback = CAPEX_net / Économies_moy", "Payback = Net_CAPEX / Avg_savings")],
    [t("LCOE (Coût Actualisé Énergie)", "LCOE (Levelized Cost of Energy)"), t("LCOE = Coûts_act / Prod_actualisée", "LCOE = Disc_costs / Disc_production")],
  ];

  metrics.forEach(([name, formula]) => {
    doc.fontSize(10).fillColor(COLORS.blue).font("Helvetica-Bold").text(name, margin + 10, doc.y);
    doc.font("Courier").fontSize(9).fillColor(COLORS.mediumGray).text(formula, margin + 20, doc.y);
    doc.font("Helvetica");
    doc.moveDown(0.6);
  });

  drawFooter(5);

  // ==================== PAGE 6: INCENTIVES ====================
  doc.addPage();
  drawSectionHeader(t("6. INCITATIFS ET SUBVENTIONS", "6. INCENTIVES AND SUBSIDIES"), 6);

  doc.fontSize(11).fillColor(COLORS.darkGray).font("Helvetica-Bold");
  doc.text(t("Incitatifs Hydro-Québec (Programme Autoproduction):", "Hydro-Québec Incentives (Self-Generation Program):"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  const hqIncentives = lang === "fr" ? [
    "• Solaire: 1 000 $/kWc installé",
    "• Stockage: 300 $/kW de capacité",
    "• Plafond: 40% du CAPEX brut",
  ] : [
    "• Solar: $1,000/kWp installed",
    "• Storage: $300/kW capacity",
    "• Cap: 40% of gross CAPEX",
  ];

  hqIncentives.forEach(item => {
    doc.fontSize(10).text(item, margin + 10, doc.y, { width: contentWidth - 20 });
    doc.moveDown(0.3);
  });

  doc.moveDown(0.5);
  doc.rect(margin, doc.y, contentWidth, 35).fillAndStroke("#F0F4F8", COLORS.blue);
  doc.fontSize(10).fillColor(COLORS.darkGray).font("Courier");
  doc.text(t(
    "Incitatif_HQ = min(PV_kWc × 1000 + Batt_kW × 300, CAPEX × 0.40)",
    "HQ_incentive = min(PV_kWp × 1000 + Batt_kW × 300, CAPEX × 0.40)"
  ), margin + 10, doc.y - 30);
  doc.font("Helvetica");
  doc.moveDown(2.5);

  doc.fontSize(11).font("Helvetica-Bold");
  doc.text(t("Crédit d'impôt fédéral (CII):", "Federal Investment Tax Credit (ITC):"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  doc.fontSize(10).text(t(
    "Crédit d'impôt à l'investissement de 30% sur le CAPEX net (après incitatifs HQ).",
    "30% investment tax credit on net CAPEX (after HQ incentives)."
  ), margin + 10, doc.y, { width: contentWidth - 20 });
  doc.moveDown(0.5);

  doc.rect(margin, doc.y, contentWidth, 35).fillAndStroke("#F0F4F8", COLORS.green);
  doc.fontSize(10).fillColor(COLORS.darkGray).font("Courier");
  doc.text(t(
    "CII = (CAPEX_brut - Incitatif_HQ) × 0.30",
    "ITC = (Gross_CAPEX - HQ_incentive) × 0.30"
  ), margin + 10, doc.y - 30);
  doc.font("Helvetica");
  doc.moveDown(2.5);

  doc.fontSize(11).font("Helvetica-Bold");
  doc.text(t("Bouclier fiscal (DPA/CCA):", "Tax Shield (CCA):"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  doc.fontSize(10).text(t(
    "Déductions pour amortissement accéléré sur les équipements solaires (Classe 43.2). Le bouclier fiscal réduit l'impôt à payer grâce aux déductions de capital.",
    "Accelerated capital cost allowance deductions on solar equipment (Class 43.2). The tax shield reduces taxes payable through capital deductions."
  ), margin + 10, doc.y, { width: contentWidth - 20 });
  doc.moveDown(0.5);

  doc.rect(margin, doc.y, contentWidth, 35).fillAndStroke("#F0F4F8", COLORS.gold);
  doc.fontSize(10).fillColor(COLORS.darkGray).font("Courier");
  doc.text(t(
    "Bouclier_fiscal = CAPEX_net × Taux_CCA × Taux_imposition",
    "Tax_shield = Net_CAPEX × CCA_rate × Tax_rate"
  ), margin + 10, doc.y - 30);
  doc.font("Helvetica");
  doc.moveDown(2.5);

  doc.fontSize(11).font("Helvetica-Bold");
  doc.text(t("CAPEX net final:", "Final net CAPEX:"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  doc.rect(margin, doc.y, contentWidth, 35).fillAndStroke("#F0F4F8", COLORS.blue);
  doc.fontSize(10).fillColor(COLORS.darkGray).font("Courier");
  doc.text(t(
    "CAPEX_net = CAPEX_brut - Incitatif_HQ - CII - Bouclier_fiscal",
    "Net_CAPEX = Gross_CAPEX - HQ_incentive - ITC - Tax_shield"
  ), margin + 10, doc.y - 30);
  doc.font("Helvetica");

  drawFooter(6);

  // ==================== PAGE 7: OPTIMIZATION ====================
  doc.addPage();
  drawSectionHeader(t("7. OPTIMISATION ET SENSIBILITÉ", "7. OPTIMIZATION AND SENSITIVITY"), 7);

  doc.fontSize(11).fillColor(COLORS.darkGray);
  doc.text(t(
    "L'analyse de sensibilité explore différentes combinaisons de tailles de système pour identifier la configuration optimale maximisant la VAN.",
    "Sensitivity analysis explores different system size combinations to identify the optimal configuration maximizing NPV."
  ), margin, doc.y, { width: contentWidth });
  doc.moveDown(1.5);

  doc.font("Helvetica-Bold");
  doc.text(t("Types de scénarios analysés:", "Scenario types analyzed:"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  const scenarios = lang === "fr" ? [
    ["Solaire seul", "Variation de la taille PV de 10% à 100% de la capacité maximale de toiture"],
    ["Batterie seule", "Variation de la capacité batterie de 0 à la capacité optimale pour écrêtage"],
    ["Hybride", "Combinaisons de PV et batterie à différentes échelles pour optimiser VAN"],
  ] : [
    ["Solar only", "PV size variation from 10% to 100% of maximum roof capacity"],
    ["Battery only", "Battery capacity variation from 0 to optimal capacity for shaving"],
    ["Hybrid", "PV and battery combinations at different scales to optimize NPV"],
  ];

  scenarios.forEach(([type, desc]) => {
    doc.fontSize(10).fillColor(COLORS.blue).font("Helvetica-Bold").text(`• ${type}`, margin + 10, doc.y);
    doc.font("Helvetica").fillColor(COLORS.darkGray).text(`  ${desc}`, margin + 20, doc.y, { width: contentWidth - 40 });
    doc.moveDown(0.5);
  });

  doc.moveDown(1);
  doc.fontSize(11).font("Helvetica-Bold");
  doc.text(t("Frontière d'efficience:", "Efficiency frontier:"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  doc.fontSize(10).text(t(
    "Le graphique de frontière d'efficience visualise le compromis entre l'investissement (CAPEX) et le rendement (VAN). Chaque point représente une configuration système différente.",
    "The efficiency frontier chart visualizes the trade-off between investment (CAPEX) and return (NPV). Each point represents a different system configuration."
  ), margin, doc.y, { width: contentWidth });
  doc.moveDown(1);

  doc.font("Helvetica-Bold");
  doc.text(t("Axes du graphique:", "Chart axes:"));
  doc.font("Helvetica");
  doc.moveDown(0.3);
  doc.fontSize(10).text(t("• X: CAPEX net après incitatifs ($)", "• X: Net CAPEX after incentives ($)"), margin + 10, doc.y);
  doc.text(t("• Y: VAN sur 25 ans ($)", "• Y: 25-year NPV ($)"), margin + 10, doc.y);
  doc.moveDown(1);

  doc.fontSize(11).font("Helvetica-Bold");
  doc.text(t("Sélection du système optimal:", "Optimal system selection:"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  doc.fontSize(10).text(t(
    "Le système recommandé est automatiquement sélectionné selon les critères suivants:",
    "The recommended system is automatically selected based on the following criteria:"
  ), margin, doc.y, { width: contentWidth });
  doc.moveDown(0.5);

  const criteria = lang === "fr" ? [
    "1. Maximisation de la VAN sur 25 ans",
    "2. Respect des contraintes de toiture et structurelles",
    "3. Équilibre entre taille du système et rendement marginal",
    "4. Considération du TRI minimum acceptable (si spécifié)",
  ] : [
    "1. Maximization of 25-year NPV",
    "2. Compliance with roof and structural constraints",
    "3. Balance between system size and marginal return",
    "4. Consideration of minimum acceptable IRR (if specified)",
  ];

  criteria.forEach(item => {
    doc.text(item, margin + 10, doc.y, { width: contentWidth - 20 });
    doc.moveDown(0.3);
  });

  drawFooter(7);

  // ==================== PAGE 8: REFERENCES ====================
  doc.addPage();
  drawSectionHeader(t("8. RÉFÉRENCES ET NORMES", "8. REFERENCES AND STANDARDS"), 8);

  doc.fontSize(11).fillColor(COLORS.darkGray).font("Helvetica-Bold");
  doc.text(t("Tarifs Hydro-Québec:", "Hydro-Québec Rates:"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  const tariffs = [
    [t("Tarif D (Domestique)", "Rate D (Domestic)"), t("< 40 kW", "< 40 kW")],
    [t("Tarif G (Petite puissance)", "Rate G (Small Power)"), t("< 65 kW", "< 65 kW")],
    [t("Tarif M (Moyenne puissance)", "Rate M (Medium Power)"), t("65 kW - 5 MW", "65 kW - 5 MW")],
    [t("Tarif L (Grande puissance)", "Rate L (Large Power)"), t("> 5 MW", "> 5 MW")],
  ];

  tariffs.forEach(([name, range]) => {
    doc.fontSize(10).text(`• ${name}: ${range}`, margin + 10, doc.y, { width: contentWidth - 20 });
    doc.moveDown(0.3);
  });

  doc.moveDown(1);
  doc.font("Helvetica-Bold");
  doc.text(t("Sources des données:", "Data sources:"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  const sources = lang === "fr" ? [
    "• Tarifs Hydro-Québec en vigueur (avril 2025)",
    "• Données d'irradiation: Ressources naturelles Canada (RNCan)",
    "• Programme Autoproduction HQ: conditions et montants officiels",
    "• Crédit d'impôt fédéral: Agence du revenu du Canada",
    "• Classes CCA: Agence du revenu du Canada (Classe 43.2)",
  ] : [
    "• Hydro-Québec rates in effect (April 2025)",
    "• Irradiation data: Natural Resources Canada (NRCan)",
    "• HQ Self-Generation Program: official conditions and amounts",
    "• Federal tax credit: Canada Revenue Agency",
    "• CCA Classes: Canada Revenue Agency (Class 43.2)",
  ];

  sources.forEach(source => {
    doc.fontSize(10).text(source, margin + 10, doc.y, { width: contentWidth - 20 });
    doc.moveDown(0.3);
  });

  doc.moveDown(2);
  doc.fontSize(11).font("Helvetica-Bold");
  doc.text(t("Normes et certifications:", "Standards and certifications:"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  const standards = lang === "fr" ? [
    "• CSA C22.1 - Code canadien de l'électricité",
    "• UL 1741 - Onduleurs solaires",
    "• IEC 61215 - Modules photovoltaïques",
    "• UL 9540A - Sécurité des systèmes de stockage d'énergie",
  ] : [
    "• CSA C22.1 - Canadian Electrical Code",
    "• UL 1741 - Solar inverters",
    "• IEC 61215 - Photovoltaic modules",
    "• UL 9540A - Energy storage system safety",
  ];

  standards.forEach(std => {
    doc.fontSize(10).text(std, margin + 10, doc.y, { width: contentWidth - 20 });
    doc.moveDown(0.3);
  });

  doc.moveDown(3);

  // Contact info box
  doc.rect(margin, doc.y, contentWidth, 80).fillAndStroke("#F0F4F8", COLORS.blue);
  doc.fontSize(12).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Pour plus d'informations:", "For more information:"), margin + 20, doc.y - 70);
  doc.font("Helvetica").fontSize(10).fillColor(COLORS.darkGray);
  doc.text("kWh Québec", margin + 20, doc.y - 50);
  doc.text("info@kwh.quebec", margin + 20, doc.y - 35);
  doc.text("www.kwh.quebec", margin + 20, doc.y - 20);

  drawFooter(8);
}

interface DesignAgreementData {
  id: string;
  site: {
    name: string;
    address?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    client: {
      name: string;
      email?: string;
      phone?: string;
    };
  };
  quotedCosts: {
    siteVisit?: {
      numBuildings?: number;
      travelDays?: number;
      travel?: number;
      visit?: number;
      evaluation?: number;
      diagrams?: number;
      sldSupplement?: number;
      total?: number;
    } | null;
    additionalFees?: Array<{ description: string; amount: number }>;
    subtotal?: number;
    taxes?: { gst?: number; qst?: number };
    total?: number;
  };
  totalCad: number;
  paymentTerms?: string;
  validUntil?: Date | string | null;
  createdAt?: Date | string | null;
}

export function generateDesignAgreementPDF(
  doc: PDFKit.PDFDocument,
  agreement: DesignAgreementData,
  lang: "fr" | "en" = "fr"
): void {
  const t = (fr: string, en: string) => (lang === "fr" ? fr : en);
  const pageWidth = 612;
  const margin = 50;
  const contentWidth = pageWidth - 2 * margin;

  const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) {
      return "0,00 $";
    }
    return `${value.toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
  };

  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return "-";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  let y = margin;

  doc.rect(0, 0, pageWidth, 120).fill(COLORS.blue);
  doc.fontSize(24).fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text("kWh Québec", margin, 35, { width: contentWidth });
  doc.fontSize(16).font("Helvetica");
  doc.text(t("Entente de design - Étape 3", "Design Agreement - Step 3"), margin, 65, { width: contentWidth });
  doc.fontSize(10);
  doc.text(t("Votre première étape vers un projet solaire", "Your first step toward a solar project"), margin, 90, { width: contentWidth });

  y = 140;

  doc.fontSize(12).fillColor(COLORS.darkGray).font("Helvetica-Bold");
  doc.text(t("Client:", "Client:"), margin, y);
  doc.font("Helvetica");
  doc.text(agreement.site.client.name, margin + 60, y);
  y += 18;

  doc.font("Helvetica-Bold");
  doc.text(t("Site:", "Site:"), margin, y);
  doc.font("Helvetica");
  const siteAddress = [
    agreement.site.name,
    agreement.site.address,
    [agreement.site.city, agreement.site.province, agreement.site.postalCode].filter(Boolean).join(", "),
  ].filter(Boolean).join("\n");
  doc.text(siteAddress, margin + 60, y, { width: contentWidth - 60 });
  y += 50;

  doc.font("Helvetica-Bold");
  doc.text(t("Date:", "Date:"), margin, y);
  doc.font("Helvetica");
  doc.text(formatDate(agreement.createdAt), margin + 60, y);
  y += 18;

  doc.font("Helvetica-Bold");
  doc.text(t("Valide jusqu'au:", "Valid until:"), margin, y);
  doc.font("Helvetica");
  doc.text(formatDate(agreement.validUntil), margin + 100, y);
  y += 35;

  doc.rect(margin, y, contentWidth, 2).fill(COLORS.gold);
  y += 20;

  doc.fontSize(14).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Détail des coûts", "Cost Breakdown"), margin, y);
  y += 25;

  doc.fontSize(11).fillColor(COLORS.darkGray).font("Helvetica-Bold");
  doc.text(t("Visite technique et évaluation:", "Technical Visit & Evaluation:"), margin, y);
  y += 20;

  const siteVisit = agreement.quotedCosts?.siteVisit;
  doc.font("Helvetica").fontSize(10);

  const costLines: Array<{ label: string; value: number | undefined }> = [];
  
  if (siteVisit?.travel && siteVisit.travel > 0) {
    costLines.push({ label: t("Frais de déplacement", "Travel costs"), value: siteVisit.travel });
  }
  costLines.push({ label: t("Visite sur site", "Site visit"), value: siteVisit?.visit });
  costLines.push({ label: t("Évaluation technique", "Technical evaluation"), value: siteVisit?.evaluation });
  costLines.push({ label: t("Dessins techniques", "Technical drawings"), value: siteVisit?.diagrams });
  if (siteVisit?.sldSupplement && siteVisit.sldSupplement > 0) {
    costLines.push({ label: t("Supplément schéma unifilaire", "SLD supplement"), value: siteVisit.sldSupplement });
  }

  costLines.forEach(line => {
    doc.text(line.label, margin + 20, y);
    doc.text(formatCurrency(line.value), margin + contentWidth - 120, y, { width: 100, align: "right" });
    y += 18;
  });

  y += 10;
  doc.rect(margin + 20, y, contentWidth - 40, 1).fill(COLORS.lightGray);
  y += 15;

  doc.font("Helvetica-Bold");
  doc.text(t("Sous-total", "Subtotal"), margin + 20, y);
  doc.text(formatCurrency(agreement.quotedCosts?.subtotal), margin + contentWidth - 120, y, { width: 100, align: "right" });
  y += 18;

  doc.font("Helvetica").fillColor(COLORS.mediumGray);
  doc.text(t("TPS (5%)", "GST (5%)"), margin + 20, y);
  doc.text(formatCurrency(agreement.quotedCosts?.taxes?.gst), margin + contentWidth - 120, y, { width: 100, align: "right" });
  y += 18;

  doc.text(t("TVQ (9.975%)", "QST (9.975%)"), margin + 20, y);
  doc.text(formatCurrency(agreement.quotedCosts?.taxes?.qst), margin + contentWidth - 120, y, { width: 100, align: "right" });
  y += 18;

  y += 5;
  doc.rect(margin + 20, y, contentWidth - 40, 2).fill(COLORS.blue);
  y += 12;

  doc.fontSize(13).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("TOTAL", "TOTAL"), margin + 20, y);
  doc.text(formatCurrency(agreement.totalCad), margin + contentWidth - 120, y, { width: 100, align: "right" });
  y += 40;

  doc.fontSize(14).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Livrables inclus", "Included Deliverables"), margin, y);
  y += 22;

  doc.fontSize(10).fillColor(COLORS.darkGray).font("Helvetica");
  const deliverables = [
    t("Visite technique complète du site", "Complete technical site visit"),
    t("Rapport d'évaluation technique", "Technical evaluation report"),
    t("Dessins d'implantation PV", "PV layout drawings"),
    t("Schéma unifilaire (si requis)", "Single line diagram (if required)"),
    t("Soumission détaillée à prix fixe", "Detailed fixed-price quote"),
  ];

  deliverables.forEach(item => {
    doc.text("✓  " + item, margin + 20, y);
    y += 18;
  });

  y += 20;

  doc.fontSize(12).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Modalités de paiement", "Payment Terms"), margin, y);
  y += 18;

  doc.fontSize(10).fillColor(COLORS.darkGray).font("Helvetica");
  doc.text(
    agreement.paymentTerms || t("50% à la signature, 50% à la livraison des dessins", "50% at signing, 50% at drawing delivery"),
    margin + 20, y, { width: contentWidth - 40 }
  );
  y += 40;

  doc.rect(margin, y, contentWidth, 70).fillAndStroke("#F0F4F8", COLORS.blue);
  doc.fontSize(10).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Pour accepter cette entente:", "To accept this agreement:"), margin + 20, y + 15);
  doc.font("Helvetica").fillColor(COLORS.darkGray);
  doc.text(t("Contactez-nous à info@kwh.quebec ou appelez-nous.", "Contact us at info@kwh.quebec or call us."), margin + 20, y + 32);
  doc.text("www.kwh.quebec", margin + 20, y + 48);

  doc.fontSize(8).fillColor(COLORS.lightGray);
  doc.text(
    t("Document confidentiel | kWh Québec", "Confidential document | kWh Québec"),
    margin, 760, { align: "center", width: contentWidth }
  );
}
