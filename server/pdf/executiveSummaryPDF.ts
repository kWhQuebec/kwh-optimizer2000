import path from "path";
import type { SimulationData } from "./types";
import { COLORS } from "./types";
import { formatCurrency, formatPercent, formatSmartCurrency, formatSmartPower, formatSmartEnergy } from "./helpers";
import { createLogger } from "../lib/logger";

const log = createLogger("ExecutiveSummaryPDF");

export function generateExecutiveSummaryPDF(
  doc: PDFKit.PDFDocument,
  simulation: SimulationData,
  lang: "fr" | "en" = "fr"
): void {
  const t = (fr: string, en: string) => (lang === "fr" ? fr : en);
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 40;
  const contentWidth = pageWidth - 2 * margin;

  const drawKpiBox = (x: number, y: number, width: number, height: number, label: string, value: string, highlight?: boolean) => {
    const bgColor = highlight ? COLORS.gold : "#F0F4F8";
    doc.roundedRect(x, y, width, height, 4).fill(bgColor);

    doc.fontSize(8).fillColor(COLORS.mediumGray).font("Helvetica");
    doc.text(label, x + 8, y + 8, { width: width - 16, lineBreak: false });

    const kpiValueFontSize = value.length > 12 ? 11 : value.length > 9 ? 12 : 14;
    doc.fontSize(kpiValueFontSize).fillColor(highlight ? COLORS.blue : COLORS.darkGray).font("Helvetica-Bold");
    doc.text(value, x + 8, y + 24, { width: width - 16, lineBreak: false });
    doc.font("Helvetica");
  };

  const dateStr = new Date().toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA");

  // Header
  try {
    const execLogoPath = path.join(process.cwd(), "client", "public", "assets", lang === "fr" ? "logo-fr.png" : "logo-en.png");
    doc.image(execLogoPath, margin, margin - 5, { width: 100 });
  } catch (e) {
    doc.fontSize(10).fillColor(COLORS.blue).font("Helvetica-Bold");
    doc.text("kWh Québec", margin, margin - 5);
    doc.font("Helvetica");
  }
  doc.fontSize(8).fillColor(COLORS.mediumGray);
  doc.text(dateStr, margin, margin - 5, { align: "right", width: contentWidth });

  doc.rect(margin, margin + 12, contentWidth, 2).fill(COLORS.gold);

  // Title
  doc.y = margin + 25;
  doc.fontSize(22).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("RÉSUMÉ EXÉCUTIF", "EXECUTIVE SUMMARY"), margin, doc.y);
  doc.font("Helvetica");

  doc.moveDown(0.3);
  doc.fontSize(14).fillColor(COLORS.darkGray);
  doc.text(t("Étude Préliminaire Solaire + Stockage", "Preliminary Solar + Storage Study"), margin, doc.y);

  doc.moveDown(1);

  // Site info box
  doc.roundedRect(margin, doc.y, contentWidth, 50, 4).fill("#E8F0F8");
  const infoY = doc.y + 10;

  doc.fontSize(12).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(simulation.site.name, margin + 15, infoY);
  doc.font("Helvetica");

  doc.fontSize(9).fillColor(COLORS.mediumGray);
  const address = [simulation.site.address, simulation.site.city, simulation.site.province].filter(Boolean).join(", ");
  doc.text(address || t("Adresse non spécifiée", "Address not specified"), margin + 15, infoY + 18);

  doc.fontSize(9).fillColor(COLORS.darkGray);
  doc.text(simulation.site.client.name, margin + 15, infoY + 32);

  doc.y += 60;

  // Roof image
  if (simulation.roofVisualizationBuffer) {
    try {
      const imageWidth = 280;
      const imageHeight = 175;
      const imageX = margin + (contentWidth - imageWidth) / 2;

      doc.roundedRect(imageX - 3, doc.y - 3, imageWidth + 6, imageHeight + 6, 4).strokeColor(COLORS.borderGray).lineWidth(1).stroke();
      doc.image(simulation.roofVisualizationBuffer, imageX, doc.y, { width: imageWidth, height: imageHeight });
      doc.y += imageHeight + 15;

      doc.fontSize(7).fillColor(COLORS.lightGray);
      doc.text(t("Vue satellite avec zones solaires identifiées", "Satellite view with identified solar areas"), margin, doc.y, { align: "center", width: contentWidth });
      doc.y += 15;
    } catch (imgError) {
      log.error("Failed to embed roof image in executive summary:", imgError);
    }
  }

  // Key Metrics
  const kpiWidth = (contentWidth - 15) / 4;
  const kpiHeight = 48;
  const kpiY = doc.y;

  drawKpiBox(margin, kpiY, kpiWidth, kpiHeight, t("PUISSANCE PV", "PV POWER"), formatSmartPower(simulation.pvSizeKW, lang, "kWc"));
  drawKpiBox(margin + kpiWidth + 5, kpiY, kpiWidth, kpiHeight, t("BATTERIE", "BATTERY"), formatSmartEnergy(simulation.battEnergyKWh, lang));
  drawKpiBox(margin + (kpiWidth + 5) * 2, kpiY, kpiWidth, kpiHeight, t("ÉCON. ÉNERGIE AN 1", "ENERGY SAVINGS YR 1"), formatSmartCurrency(simulation.savingsYear1, lang), true);
  drawKpiBox(margin + (kpiWidth + 5) * 3, kpiY, kpiWidth, kpiHeight, t("VAN 25 ANS", "NPV 25 YRS"), formatSmartCurrency(simulation.npv25, lang), true);

  doc.y = kpiY + kpiHeight + 20;

  // Financial Highlights
  doc.fontSize(11).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("INDICATEURS FINANCIERS", "FINANCIAL HIGHLIGHTS"), margin, doc.y);
  doc.font("Helvetica");
  doc.y += 18;

  const colWidth = (contentWidth - 30) / 2;
  const leftCol = margin;
  const rightCol = margin + colWidth + 30;
  let finY = doc.y;

  const financialData = [
    { label: t("Investissement brut", "Gross investment"), value: formatCurrency(simulation.capexGross), col: "left" },
    { label: t("TRI (25 ans)", "IRR (25 years)"), value: formatPercent(simulation.irr25), col: "right" },
    { label: t("Subventions totales", "Total incentives"), value: formatSmartCurrency(simulation.totalIncentives, lang), col: "left" },
    { label: t("Retour simple", "Simple payback"), value: `${simulation.simplePaybackYears.toFixed(1)} ${t("ans", "years")}`, col: "right" },
    { label: t("Investissement net", "Net investment"), value: formatSmartCurrency(simulation.capexNet, lang), col: "left" },
    { label: t("CLÉÉ (indicatif)", "LCOE (indicative)"), value: `${simulation.lcoe.toFixed(2)} ¢/kWh`, col: "right" },
    { label: t("Bouclier fiscal", "Tax shield"), value: formatSmartCurrency(simulation.taxShield, lang), col: "left" },
    { label: t("Autosuffisance", "Self-sufficiency"), value: formatPercent(simulation.selfSufficiencyPercent / 100), col: "right" },
  ];

  for (let i = 0; i < financialData.length; i += 2) {
    const leftItem = financialData[i];
    const rightItem = financialData[i + 1];

    doc.fontSize(9).fillColor(COLORS.mediumGray).text(leftItem.label, leftCol, finY);
    doc.fontSize(10).fillColor(COLORS.darkGray).font("Helvetica-Bold").text(leftItem.value, leftCol + colWidth - 80, finY - 1, { width: 80, align: "right" });
    doc.font("Helvetica");

    if (rightItem) {
      doc.fontSize(9).fillColor(COLORS.mediumGray).text(rightItem.label, rightCol, finY);
      doc.fontSize(10).fillColor(COLORS.darkGray).font("Helvetica-Bold").text(rightItem.value, rightCol + colWidth - 80, finY - 1, { width: 80, align: "right" });
      doc.font("Helvetica");
    }

    finY += 16;
  }

  doc.y = finY + 15;

  // Incentives
  doc.fontSize(11).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("SUBVENTIONS ET INCITATIFS", "INCENTIVES & SUBSIDIES"), margin, doc.y);
  doc.font("Helvetica");
  doc.y += 15;

  const barWidth = contentWidth - 80;
  const barHeight = 18;
  const barX = margin;
  const barY = doc.y;

  const totalIncentive = simulation.totalIncentives + simulation.taxShield;
  const hqRatio = simulation.totalIncentives / (totalIncentive || 1);
  const taxRatio = simulation.taxShield / (totalIncentive || 1);

  doc.rect(barX, barY, barWidth, barHeight).fill("#E8F0F8");
  doc.rect(barX, barY, barWidth * hqRatio, barHeight).fill(COLORS.blue);
  doc.rect(barX + barWidth * hqRatio, barY, barWidth * taxRatio, barHeight).fill(COLORS.green);

  doc.fontSize(12).fillColor(COLORS.darkGray).font("Helvetica-Bold");
  doc.text(formatCurrency(totalIncentive), barX + barWidth + 10, barY + 2);
  doc.font("Helvetica");

  doc.y = barY + barHeight + 8;

  doc.fontSize(8).fillColor(COLORS.blue);
  doc.rect(margin, doc.y, 10, 10).fill(COLORS.blue);
  doc.text(t(`Hydro-Québec: ${formatCurrency(simulation.totalIncentives)}`, `Hydro-Québec: ${formatCurrency(simulation.totalIncentives)}`), margin + 15, doc.y + 1);

  doc.rect(margin + 180, doc.y, 10, 10).fill(COLORS.green);
  doc.fillColor(COLORS.green);
  doc.text(t(`Bouclier fiscal: ${formatCurrency(simulation.taxShield)}`, `Tax shield: ${formatCurrency(simulation.taxShield)}`), margin + 195, doc.y + 1);

  doc.y += 25;

  // Environmental Impact
  doc.fontSize(11).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("IMPACT ENVIRONNEMENTAL", "ENVIRONMENTAL IMPACT"), margin, doc.y);
  doc.font("Helvetica");
  doc.y += 15;

  const co2Tonnes = simulation.co2AvoidedTonnesPerYear;
  const co2Over25 = co2Tonnes * 25;

  doc.fontSize(9).fillColor(COLORS.mediumGray);
  doc.text(t("Réduction CO₂ annuelle:", "Annual CO₂ reduction:"), margin, doc.y);
  doc.fontSize(11).fillColor(COLORS.green).font("Helvetica-Bold");
  doc.text(`${co2Tonnes.toFixed(1)} ${t("tonnes/an", "tonnes/year")}`, margin + 150, doc.y - 1);
  doc.font("Helvetica");

  doc.y += 16;
  doc.fontSize(9).fillColor(COLORS.mediumGray);
  doc.text(t("Réduction CO₂ sur 25 ans:", "CO₂ reduction over 25 years:"), margin, doc.y);
  doc.fontSize(11).fillColor(COLORS.green).font("Helvetica-Bold");
  doc.text(`${co2Over25.toFixed(0)} ${t("tonnes", "tonnes")}`, margin + 150, doc.y - 1);
  doc.font("Helvetica");

  // CTA
  doc.y = pageHeight - 100;
  doc.roundedRect(margin, doc.y, contentWidth, 45, 4).fill(COLORS.blue);

  doc.fontSize(11).fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text(t("PROCHAINE ÉTAPE", "NEXT STEP"), margin + 15, doc.y + 10);
  doc.font("Helvetica");
  doc.fontSize(9).fillColor(COLORS.white);
  doc.text(t(
    "Contactez-nous pour planifier une visite de site et obtenir une analyse complète personnalisée.",
    "Contact us to schedule a site visit and receive a complete personalized analysis."
  ), margin + 15, doc.y + 25, { width: contentWidth - 30 });

  // Footer
  doc.fontSize(8).fillColor(COLORS.lightGray);
  doc.text(t("Document confidentiel | kWh Québec | info@kwh.quebec | www.kwh.quebec", "Confidential | kWh Québec | info@kwh.quebec | www.kwh.quebec"), margin, pageHeight - 25, { align: "center", width: contentWidth });
}
