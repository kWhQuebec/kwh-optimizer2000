import { COLORS } from "./types";

interface PortfolioSiteData {
  siteName: string;
  city?: string;
  pvSizeKW: number | null;
  batteryKWh: number | null;
  capexNet: number | null;
  npv25: number | null;
  irr25: number | null;
  annualSavings: number | null;
  co2Avoided: number | null;
}

interface PortfolioPDFData {
  id: string;
  name: string;
  clientName: string;
  description?: string;
  numBuildings: number;
  estimatedTravelDays: number | null;
  volumeDiscountPercent: number | null;
  quotedCosts: {
    travel?: number;
    visit?: number;
    evaluation?: number;
    diagrams?: number;
    discount?: number;
    subtotal?: number;
    taxes?: { gst: number; qst: number };
    total?: number;
  };
  totalPvSizeKW: number | null;
  totalBatteryKWh: number | null;
  totalCapexNet: number | null;
  totalNpv25: number | null;
  weightedIrr25: number | null;
  totalAnnualSavings: number | null;
  totalCo2Avoided: number | null;
  sites: PortfolioSiteData[];
  createdAt?: Date;
}

export function generatePortfolioSummaryPDF(
  doc: PDFKit.PDFDocument,
  portfolio: PortfolioPDFData,
  lang: "fr" | "en" = "fr"
): void {
  const t = (fr: string, en: string) => (lang === "fr" ? fr : en);
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 40;
  const contentWidth = pageWidth - 2 * margin;

  const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) return "—";
    return `${value.toLocaleString("fr-CA", { maximumFractionDigits: 0 })} $`;
  };

  const formatNumber = (value: number | null | undefined, decimals = 0): string => {
    if (value === null || value === undefined || isNaN(value)) return "—";
    return value.toLocaleString("fr-CA", { maximumFractionDigits: decimals });
  };

  const formatPercent = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) return "—";
    return `${(value * 100).toFixed(1)}%`;
  };

  let y = margin;

  doc.rect(0, 0, pageWidth, 100).fill(COLORS.blue);

  doc.fontSize(24).fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text(t("Sommaire Exécutif", "Executive Summary"), margin, 30);

  doc.fontSize(14).font("Helvetica");
  doc.text(portfolio.name, margin, 58);

  doc.fontSize(10).fillColor(COLORS.gold);
  doc.text(portfolio.clientName, margin, 78);

  y = 115;

  doc.fontSize(12).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Vue d'ensemble du portfolio", "Portfolio Overview"), margin, y);
  y += 25;

  const kpiBoxWidth = (contentWidth - 30) / 4;
  const kpiHeight = 60;

  const kpis = [
    { label: t("Bâtiments", "Buildings"), value: String(portfolio.numBuildings) },
    { label: t("PV Total", "Total PV"), value: `${formatNumber(portfolio.totalPvSizeKW)} kW` },
    { label: "NPV (25 ans)", value: formatCurrency(portfolio.totalNpv25) },
    { label: t("TRI Pondéré", "Weighted IRR"), value: formatPercent(portfolio.weightedIrr25) },
  ];

  kpis.forEach((kpi, i) => {
    const x = margin + i * (kpiBoxWidth + 10);
    doc.roundedRect(x, y, kpiBoxWidth, kpiHeight, 5).fillAndStroke("#F0F4F8", COLORS.blue);

    doc.fontSize(9).fillColor(COLORS.mediumGray).font("Helvetica");
    doc.text(kpi.label, x + 8, y + 10, { width: kpiBoxWidth - 16 });

    doc.fontSize(14).fillColor(COLORS.blue).font("Helvetica-Bold");
    doc.text(kpi.value, x + 8, y + 30, { width: kpiBoxWidth - 16 });
  });

  y += kpiHeight + 20;

  const kpis2 = [
    { label: t("Stockage Total", "Total Storage"), value: `${formatNumber(portfolio.totalBatteryKWh)} kWh` },
    { label: t("CAPEX Net", "Net CAPEX"), value: formatCurrency(portfolio.totalCapexNet) },
    { label: t("Économies/an", "Savings/yr"), value: formatCurrency(portfolio.totalAnnualSavings) },
    { label: t("CO₂ Évité/an", "CO₂ Avoided/yr"), value: `${formatNumber(portfolio.totalCo2Avoided, 1)} t` },
  ];

  kpis2.forEach((kpi, i) => {
    const x = margin + i * (kpiBoxWidth + 10);
    doc.roundedRect(x, y, kpiBoxWidth, kpiHeight, 5).fillAndStroke("#F0F4F8", "#E0E0E0");

    doc.fontSize(9).fillColor(COLORS.mediumGray).font("Helvetica");
    doc.text(kpi.label, x + 8, y + 10, { width: kpiBoxWidth - 16 });

    doc.fontSize(12).fillColor(COLORS.darkGray).font("Helvetica-Bold");
    doc.text(kpi.value, x + 8, y + 30, { width: kpiBoxWidth - 16 });
  });

  y += kpiHeight + 30;

  doc.fontSize(12).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Détail par site", "Site Details"), margin, y);
  y += 20;

  const colWidths = [140, 55, 50, 75, 75, 55, 70];
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);
  const headers = [
    t("Site", "Site"),
    "PV (kW)",
    t("Batt.", "Batt."),
    t("CAPEX Net", "Net CAPEX"),
    "NPV",
    "TRI",
    t("Écon./an", "Savings/yr"),
  ];

  doc.rect(margin, y, tableWidth, 22).fill(COLORS.blue);
  doc.fontSize(8).fillColor(COLORS.white).font("Helvetica-Bold");

  let headerX = margin + 4;
  headers.forEach((header, i) => {
    doc.text(header, headerX, y + 7, { width: colWidths[i] - 8, align: i === 0 ? "left" : "right" });
    headerX += colWidths[i];
  });

  y += 22;

  doc.font("Helvetica").fontSize(8);
  portfolio.sites.forEach((site, idx) => {
    const bgColor = idx % 2 === 0 ? "#FFFFFF" : "#F9F9F9";
    doc.rect(margin, y, tableWidth, 18).fill(bgColor);

    let cellX = margin + 4;
    doc.fillColor(COLORS.darkGray);

    doc.text(site.siteName + (site.city ? ` (${site.city})` : ""), cellX, y + 5, { width: colWidths[0] - 8 });
    cellX += colWidths[0];

    doc.text(formatNumber(site.pvSizeKW), cellX, y + 5, { width: colWidths[1] - 8, align: "right" });
    cellX += colWidths[1];

    doc.text(formatNumber(site.batteryKWh), cellX, y + 5, { width: colWidths[2] - 8, align: "right" });
    cellX += colWidths[2];

    doc.text(formatCurrency(site.capexNet), cellX, y + 5, { width: colWidths[3] - 8, align: "right" });
    cellX += colWidths[3];

    doc.fillColor(COLORS.green);
    doc.text(formatCurrency(site.npv25), cellX, y + 5, { width: colWidths[4] - 8, align: "right" });
    cellX += colWidths[4];

    doc.fillColor(COLORS.darkGray);
    doc.text(formatPercent(site.irr25), cellX, y + 5, { width: colWidths[5] - 8, align: "right" });
    cellX += colWidths[5];

    doc.text(formatCurrency(site.annualSavings), cellX, y + 5, { width: colWidths[6] - 8, align: "right" });

    y += 18;
  });

  doc.rect(margin, y, tableWidth, 20).fill("#E8F0F8");
  doc.fontSize(8).fillColor(COLORS.blue).font("Helvetica-Bold");

  let totalX = margin + 4;
  doc.text("TOTAL", totalX, y + 6, { width: colWidths[0] - 8 });
  totalX += colWidths[0];

  doc.text(formatNumber(portfolio.totalPvSizeKW), totalX, y + 6, { width: colWidths[1] - 8, align: "right" });
  totalX += colWidths[1];

  doc.text(formatNumber(portfolio.totalBatteryKWh), totalX, y + 6, { width: colWidths[2] - 8, align: "right" });
  totalX += colWidths[2];

  doc.text(formatCurrency(portfolio.totalCapexNet), totalX, y + 6, { width: colWidths[3] - 8, align: "right" });
  totalX += colWidths[3];

  doc.fillColor(COLORS.green);
  doc.text(formatCurrency(portfolio.totalNpv25), totalX, y + 6, { width: colWidths[4] - 8, align: "right" });
  totalX += colWidths[4];

  doc.fillColor(COLORS.blue);
  doc.text(formatPercent(portfolio.weightedIrr25), totalX, y + 6, { width: colWidths[5] - 8, align: "right" });
  totalX += colWidths[5];

  doc.text(formatCurrency(portfolio.totalAnnualSavings), totalX, y + 6, { width: colWidths[6] - 8, align: "right" });

  y += 35;

  if (portfolio.volumeDiscountPercent && portfolio.volumeDiscountPercent > 0) {
    doc.fontSize(12).fillColor(COLORS.blue).font("Helvetica-Bold");
    doc.text(t("Tarification Services d'Évaluation", "Assessment Services Pricing"), margin, y);
    y += 20;

    const costs = portfolio.quotedCosts;
    doc.fontSize(9).font("Helvetica").fillColor(COLORS.darkGray);

    const pricingItems = [
      { label: t(`Déplacement (${portfolio.estimatedTravelDays || 0} jours × 150$)`, `Travel (${portfolio.estimatedTravelDays || 0} days × $150)`), value: formatCurrency(costs.travel) },
      { label: t(`Visites de site (${portfolio.numBuildings} × 600$)`, `Site visits (${portfolio.numBuildings} × $600)`), value: formatCurrency(costs.visit) },
      { label: t(`Évaluation technique (${portfolio.numBuildings} × 1 000$)`, `Technical evaluation (${portfolio.numBuildings} × $1,000)`), value: formatCurrency(costs.evaluation) },
      { label: t(`Schémas unifilaires (${portfolio.numBuildings} × 1 900$)`, `Single-line diagrams (${portfolio.numBuildings} × $1,900)`), value: formatCurrency(costs.diagrams) },
    ];

    pricingItems.forEach(item => {
      doc.text(item.label, margin, y);
      doc.text(item.value, margin + 350, y, { width: 100, align: "right" });
      y += 16;
    });

    doc.fillColor(COLORS.green);
    doc.text(t(`Rabais volume (-${formatPercent(portfolio.volumeDiscountPercent)})`, `Volume discount (-${formatPercent(portfolio.volumeDiscountPercent)})`), margin, y);
    doc.text(`-${formatCurrency(costs.discount)}`, margin + 350, y, { width: 100, align: "right" });
    y += 20;

    doc.fillColor(COLORS.darkGray).font("Helvetica-Bold");
    doc.text(t("Sous-total", "Subtotal"), margin, y);
    doc.text(formatCurrency(costs.subtotal), margin + 350, y, { width: 100, align: "right" });
    y += 16;

    doc.font("Helvetica").fontSize(8).fillColor(COLORS.mediumGray);
    doc.text("TPS (5%)", margin, y);
    doc.text(formatCurrency(costs.taxes?.gst), margin + 350, y, { width: 100, align: "right" });
    y += 14;
    doc.text("TVQ (9.975%)", margin, y);
    doc.text(formatCurrency(costs.taxes?.qst), margin + 350, y, { width: 100, align: "right" });
    y += 18;

    doc.fontSize(11).font("Helvetica-Bold").fillColor(COLORS.blue);
    doc.text("TOTAL", margin, y);
    doc.text(formatCurrency(costs.total), margin + 350, y, { width: 100, align: "right" });
  }

  doc.fontSize(8).fillColor(COLORS.lightGray).font("Helvetica");
  doc.text(
    t("Document confidentiel | kWh Québec | www.kwh.quebec", "Confidential document | kWh Québec | www.kwh.quebec"),
    margin, pageHeight - 30, { align: "center", width: contentWidth }
  );

  const dateStr = new Date().toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA");
  doc.text(dateStr, margin, pageHeight - 30, { align: "right", width: contentWidth });
}
