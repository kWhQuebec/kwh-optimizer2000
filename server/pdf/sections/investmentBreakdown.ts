import type { PDFContext } from "../types";
import { COLORS } from "../types";
import { formatCurrency, drawSimpleHeader, drawPageFooter } from "../helpers";
import { drawWaterfallChart } from "../charts";

export function renderInvestmentBreakdown(ctx: PDFContext) {
  const { doc, simulation, t, margin, contentWidth, pageWidth, pageHeight } = ctx;

  doc.addPage();
  drawSimpleHeader(ctx);
  doc.moveDown(2);

  // Section title
  doc.fontSize(18).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("INVESTISSEMENT NET", "NET INVESTMENT"), margin, doc.y);
  doc.font("Helvetica");
  doc.y += 8;
  doc.rect(margin, doc.y, 180, 3).fillColor(COLORS.gold).fill();
  doc.y += 15;

  const savingsPct = simulation.capexGross > 0 ? (((simulation.capexGross - simulation.capexNet) / simulation.capexGross) * 100).toFixed(0) : "0";
  doc.fontSize(14).fillColor(COLORS.gold).font("Helvetica-Bold");
  doc.text(t(`${savingsPct} % de réduction grâce aux incitatifs`, `${savingsPct}% reduction through incentives`), margin, doc.y, { width: contentWidth });
  doc.font("Helvetica");
  doc.y += 25;

  // Visual waterfall chart
  const waterfallItems = [
    { label: t("CAPEX Brut", "Gross CAPEX"), value: simulation.capexGross, isDeduction: false },
    { label: t("HQ Solaire", "HQ Solar"), value: simulation.incentivesHQSolar, isDeduction: true },
    { label: t("HQ Batterie", "HQ Battery"), value: simulation.incentivesHQBattery, isDeduction: true },
    { label: t("ITC Fédéral", "Federal ITC"), value: simulation.incentivesFederal, isDeduction: true },
    { label: t("Bouclier Fiscal", "Tax Shield"), value: simulation.taxShield, isDeduction: true },
  ];

  drawWaterfallChart(
    ctx,
    margin,
    doc.y,
    contentWidth,
    200,
    waterfallItems,
    t("Net", "Net"),
    simulation.capexNet
  );

  doc.y += 230;

  // Detailed incentive breakdown cards
  doc.fontSize(12).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("DÉTAIL DES INCITATIFS", "INCENTIVES BREAKDOWN"), margin, doc.y);
  doc.font("Helvetica");
  doc.y += 20;

  const incentiveCardWidth = (contentWidth - 30) / 4;
  const incentiveCardHeight = 70;
  const incentiveY = doc.y;

  // HQ Solar Incentive
  doc.roundedRect(margin, incentiveY, incentiveCardWidth, incentiveCardHeight, 6).fillColor(COLORS.white).fill();
  doc.roundedRect(margin, incentiveY, incentiveCardWidth, incentiveCardHeight, 6).strokeColor(COLORS.blue).lineWidth(1).stroke();
  doc.fontSize(8).fillColor(COLORS.mediumGray);
  doc.text(t("HYDRO-QUÉBEC SOLAIRE", "HYDRO-QUÉBEC SOLAR"), margin + 8, incentiveY + 8, { width: incentiveCardWidth - 16, align: "center" });
  doc.fontSize(7).fillColor(COLORS.lightGray);
  doc.text(t("1 000 $/kW (max 40%)", "$1,000/kW (max 40%)"), margin + 8, incentiveY + 20, { width: incentiveCardWidth - 16, align: "center" });
  doc.fontSize(14).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(formatCurrency(simulation.incentivesHQSolar), margin + 8, incentiveY + 38, { width: incentiveCardWidth - 16, align: "center" });
  doc.font("Helvetica");

  // HQ Battery Incentive
  const bx = margin + incentiveCardWidth + 10;
  doc.roundedRect(bx, incentiveY, incentiveCardWidth, incentiveCardHeight, 6).fillColor(COLORS.white).fill();
  doc.roundedRect(bx, incentiveY, incentiveCardWidth, incentiveCardHeight, 6).strokeColor(COLORS.blue).lineWidth(1).stroke();
  doc.fontSize(8).fillColor(COLORS.mediumGray);
  doc.text(t("HYDRO-QUÉBEC BATTERIE", "HYDRO-QUÉBEC BATTERY"), bx + 8, incentiveY + 8, { width: incentiveCardWidth - 16, align: "center" });
  doc.fontSize(7).fillColor(COLORS.lightGray);
  doc.text(t("300 $/kW (max 40%)", "$300/kW (max 40%)"), bx + 8, incentiveY + 20, { width: incentiveCardWidth - 16, align: "center" });
  doc.fontSize(14).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(formatCurrency(simulation.incentivesHQBattery), bx + 8, incentiveY + 38, { width: incentiveCardWidth - 16, align: "center" });
  doc.font("Helvetica");

  // Federal ITC
  const fx = margin + 2 * (incentiveCardWidth + 10);
  doc.roundedRect(fx, incentiveY, incentiveCardWidth, incentiveCardHeight, 6).fillColor(COLORS.white).fill();
  doc.roundedRect(fx, incentiveY, incentiveCardWidth, incentiveCardHeight, 6).strokeColor(COLORS.green).lineWidth(1).stroke();
  doc.fontSize(8).fillColor(COLORS.mediumGray);
  doc.text(t("ITC FÉDÉRAL", "FEDERAL ITC"), fx + 8, incentiveY + 8, { width: incentiveCardWidth - 16, align: "center" });
  doc.fontSize(7).fillColor(COLORS.lightGray);
  doc.text(t("30% du CAPEX net", "30% of net CAPEX"), fx + 8, incentiveY + 20, { width: incentiveCardWidth - 16, align: "center" });
  doc.fontSize(14).fillColor(COLORS.green).font("Helvetica-Bold");
  doc.text(formatCurrency(simulation.incentivesFederal), fx + 8, incentiveY + 38, { width: incentiveCardWidth - 16, align: "center" });
  doc.font("Helvetica");

  // Tax Shield
  const tx = margin + 3 * (incentiveCardWidth + 10);
  doc.roundedRect(tx, incentiveY, incentiveCardWidth, incentiveCardHeight, 6).fillColor(COLORS.white).fill();
  doc.roundedRect(tx, incentiveY, incentiveCardWidth, incentiveCardHeight, 6).strokeColor(COLORS.gold).lineWidth(1).stroke();
  doc.fontSize(8).fillColor(COLORS.mediumGray);
  doc.text(t("BOUCLIER FISCAL", "TAX SHIELD"), tx + 8, incentiveY + 8, { width: incentiveCardWidth - 16, align: "center" });
  doc.fontSize(7).fillColor(COLORS.lightGray);
  doc.text(t("DPA/CCA Classe 43.2", "CCA Class 43.2"), tx + 8, incentiveY + 20, { width: incentiveCardWidth - 16, align: "center" });
  doc.fontSize(14).fillColor(COLORS.gold).font("Helvetica-Bold");
  doc.text(formatCurrency(simulation.taxShield), tx + 8, incentiveY + 38, { width: incentiveCardWidth - 16, align: "center" });
  doc.font("Helvetica");

  // Total rows
  doc.y = incentiveY + incentiveCardHeight + 15;

  doc.fontSize(10).fillColor(COLORS.mediumGray);
  doc.text(t("Subventions directes (Hydro-Québec + ITC):", "Direct subsidies (Hydro-Québec + ITC):"), margin, doc.y);
  doc.fontSize(12).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(formatCurrency(simulation.totalIncentives), margin + 220, doc.y - 1);
  doc.font("Helvetica");
  doc.y += 18;

  doc.fontSize(10).fillColor(COLORS.mediumGray);
  doc.text(t("Avantage fiscal (DPA):", "Tax benefit (CCA):"), margin, doc.y);
  doc.fontSize(12).fillColor(COLORS.gold).font("Helvetica-Bold");
  doc.text(formatCurrency(simulation.taxShield), margin + 220, doc.y - 1);
  doc.font("Helvetica");
  doc.y += 18;

  doc.fontSize(11).fillColor(COLORS.darkGray).font("Helvetica-Bold");
  doc.text(t("TOTAL (SUBVENTIONS + AVANTAGE FISCAL):", "TOTAL (SUBSIDIES + TAX BENEFIT):"), margin, doc.y);
  doc.fontSize(14).fillColor(COLORS.blue);
  doc.text(formatCurrency(simulation.totalIncentives + simulation.taxShield), margin + 280, doc.y - 2);
  doc.font("Helvetica");

  drawPageFooter(ctx, t("Document confidentiel | Généré par kWh Québec | Investissement net", "Confidential document | Generated by kWh Québec | Net investment"));
}
