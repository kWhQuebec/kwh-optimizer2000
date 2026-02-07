import PptxGenJSModule from "pptxgenjs";
const PptxGenJS = (PptxGenJSModule as any).default || PptxGenJSModule;
import fs from "fs";
import path from "path";
import { getAllStats, getFirstTestimonial, getTitle, getContactString, getKpiLabel, isKpiHighlighted, getAssumptions, getExclusions, getEquipment, getTimeline, getProjectSnapshotLabels, getDesignFeeCovers, getClientProvides, getClientReceives, getNarrativeAct, getNarrativeTransition } from "@shared/brandContent";
import type { DocumentSimulationData } from "./documentDataProvider";
import { createLogger } from "./lib/logger";

const log = createLogger("PPTXGenerator");

const COLORS = {
  blue: "003DA6",
  gold: "FFB005",
  darkGray: "333333",
  mediumGray: "666666",
  lightGray: "E0E0E0",
  green: "2D915F",
  white: "FFFFFF",
};

type SimulationData = DocumentSimulationData;

export interface PPTXOptions {
  catalogEquipment?: Array<{ name: string; manufacturer: string; warranty: string; spec: string; category: string }>;
  constructionTimeline?: Array<{ step: string; duration: string; status?: string }>;
  roofPolygons?: Array<{ label?: string; areaSqM: number; orientation?: number }>;
}

export async function generatePresentationPPTX(
  simulation: SimulationData,
  roofImageBuffer: Buffer | undefined,
  lang: "fr" | "en" = "fr",
  options?: PPTXOptions
): Promise<Buffer> {
  const t = (fr: string, en: string) => (lang === "fr" ? fr : en);
  
  const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) {
      return "0 $";
    }
    return `${value.toLocaleString("fr-CA", { maximumFractionDigits: 0 })} $`;
  };

  const formatPercent = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) {
      return "0.0%";
    }
    return `${(value * 100).toFixed(1)}%`;
  };

  const pptx = new PptxGenJS();
  
  pptx.author = "kWh Québec";
  pptx.company = "kWh Québec";
  pptx.title = `${t("Étude Solaire", "Solar Study")} - ${simulation.site.name}`;
  pptx.subject = t("Proposition commerciale solaire + stockage", "Solar + Storage Commercial Proposal");
  
  let masterLogoBase64: string | null = null;
  try {
    const masterLogoPath = path.join(process.cwd(), "client", "public", "assets", lang === "fr" ? "logo-fr-white.png" : "logo-en-white.png");
    const masterLogoBuffer = fs.readFileSync(masterLogoPath);
    masterLogoBase64 = `data:image/png;base64,${masterLogoBuffer.toString("base64")}`;
  } catch (e) {
    // Fallback to text if logo file not found
  }

  const masterObjects: any[] = [
    { rect: { x: 0, y: 0, w: "100%", h: 0.6, fill: { color: COLORS.blue } } },
    { rect: { x: 0, y: 0.55, w: 1.5, h: 0.05, fill: { color: COLORS.gold } } },
    { 
      text: { 
        text: new Date().toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA"), 
        options: { x: 8, y: 0.15, w: 1.5, h: 0.3, fontSize: 10, color: COLORS.white, align: "right" }
      }
    },
    {
      text: {
        text: t("Document confidentiel | kWh Québec", "Confidential | kWh Québec"),
        options: { x: 0.3, y: 5.3, w: 9.4, h: 0.2, fontSize: 8, color: COLORS.mediumGray, align: "center" }
      }
    }
  ];

  if (masterLogoBase64) {
    masterObjects.push({ image: { data: masterLogoBase64, x: 0.15, y: 0.05, w: 1.8, h: 0.5 } });
  } else {
    masterObjects.push({ 
      text: { 
        text: "kWh Québec", 
        options: { x: 0.3, y: 0.15, w: 2, h: 0.3, fontSize: 14, color: COLORS.white, bold: true }
      }
    });
  }

  pptx.defineSlideMaster({
    title: "KWHMAIN",
    background: { color: COLORS.white },
    objects: masterObjects,
    margin: [0.8, 0.5, 0.5, 0.5]
  });

  const slide1 = pptx.addSlide({ masterName: "KWHMAIN" });
  
  slide1.addText(t("PROPOSITION SOLAIRE + STOCKAGE", "SOLAR + STORAGE PROPOSAL"), {
    x: 0.5, y: 1, w: 9, h: 0.6,
    fontSize: 28, bold: true, color: COLORS.blue
  });
  
  slide1.addShape("rect", {
    x: 0.5, y: 1.55, w: 3, h: 0.08, fill: { color: COLORS.gold }
  });
  
  slide1.addText(simulation.site.name, {
    x: 0.5, y: 1.8, w: 9, h: 0.5,
    fontSize: 22, bold: true, color: COLORS.darkGray
  });
  
  const address = [simulation.site.address, simulation.site.city, simulation.site.province].filter(Boolean).join(", ");
  slide1.addText(address || t("Adresse à confirmer", "Address to confirm"), {
    x: 0.5, y: 2.3, w: 9, h: 0.4,
    fontSize: 14, color: COLORS.mediumGray
  });
  
  slide1.addText(simulation.site.client.name, {
    x: 0.5, y: 2.7, w: 9, h: 0.4,
    fontSize: 16, bold: true, color: COLORS.darkGray
  });

  const act2 = getNarrativeAct("act2_solution", lang);
  slide1.addText(act2.subtitle, {
    x: 0.5, y: 3.1, w: 4, h: 0.3,
    fontSize: 10, italic: true, color: COLORS.mediumGray
  });

  if (roofImageBuffer) {
    try {
      const base64Image = roofImageBuffer.toString("base64");
      slide1.addImage({
        data: `data:image/png;base64,${base64Image}`,
        x: 5, y: 1.8, w: 4.5, h: 2.8
      });
    } catch (imgError) {
      log.error("Failed to add roof image to PPTX:", imgError);
    }
  }

  // ================= SLIDE 2: BILL COMPARISON (Before/After) =================
  const annualCostBefore = simulation.annualCostBefore || 0;
  const annualCostAfter = simulation.annualCostAfter || 0;
  const annualSavingsBill = simulation.annualSavings || 0;

  const billSavingsPercent = annualCostBefore > 0 ? (annualSavingsBill / annualCostBefore) * 100 : 0;
  if (annualCostBefore > 0 && billSavingsPercent >= 10) {
    const slideBill = pptx.addSlide({ masterName: "KWHMAIN" });

    slideBill.addText(t("VOTRE FACTURE AVANT / APRES", "YOUR BILL BEFORE / AFTER"), {
      x: 0.5, y: 0.8, w: 9, h: 0.5,
      fontSize: 22, bold: true, color: COLORS.blue
    });

    slideBill.addShape("rect", {
      x: 0.5, y: 1.35, w: 2.5, h: 0.06, fill: { color: COLORS.gold }
    });

    slideBill.addShape("rect", {
      x: 0.5, y: 1.7, w: 4.2, h: 2.2,
      fill: { color: "FEF2F2" }
    });
    slideBill.addText(t("AVANT", "BEFORE"), {
      x: 0.5, y: 1.8, w: 4.2, h: 0.4,
      fontSize: 14, bold: true, color: "DC2626", align: "center"
    });
    slideBill.addText(formatCurrency(annualCostBefore), {
      x: 0.5, y: 2.3, w: 4.2, h: 0.8,
      fontSize: 36, bold: true, color: "DC2626", align: "center", valign: "middle"
    });
    slideBill.addText(t("/ an", "/ year"), {
      x: 0.5, y: 3.1, w: 4.2, h: 0.4,
      fontSize: 12, color: "DC2626", align: "center"
    });

    slideBill.addShape("rect", {
      x: 5.3, y: 1.7, w: 4.2, h: 2.2,
      fill: { color: "F0FDF4" }
    });
    slideBill.addText(t("APRES", "AFTER"), {
      x: 5.3, y: 1.8, w: 4.2, h: 0.4,
      fontSize: 14, bold: true, color: "16A34A", align: "center"
    });
    slideBill.addText(formatCurrency(annualCostAfter), {
      x: 5.3, y: 2.3, w: 4.2, h: 0.8,
      fontSize: 36, bold: true, color: "16A34A", align: "center", valign: "middle"
    });
    slideBill.addText(t("/ an", "/ year"), {
      x: 5.3, y: 3.1, w: 4.2, h: 0.4,
      fontSize: 12, color: "16A34A", align: "center"
    });

    const savingsPct = annualCostBefore > 0 ? ((annualSavingsBill / annualCostBefore) * 100).toFixed(0) : "0";
    slideBill.addShape("rect", {
      x: 1.5, y: 4.2, w: 7, h: 0.7,
      fill: { color: COLORS.gold }
    });
    slideBill.addText(
      t(`Economie annuelle: ${formatCurrency(annualSavingsBill)} (${savingsPct}%)`,
        `Annual savings: ${formatCurrency(annualSavingsBill)} (${savingsPct}%)`), {
      x: 1.5, y: 4.25, w: 7, h: 0.6,
      fontSize: 18, bold: true, color: COLORS.blue, align: "center", valign: "middle"
    });
  }

  // ================= SLIDE 3: PROJECT SNAPSHOT =================
  const slideSnap = pptx.addSlide({ masterName: "KWHMAIN" });

  slideSnap.addText(t("APERÇU DU PROJET", "PROJECT SNAPSHOT"), {
    x: 0.5, y: 0.8, w: 9, h: 0.5,
    fontSize: 22, bold: true, color: COLORS.blue
  });

  const act1 = getNarrativeAct("act1_challenge", lang);
  slideSnap.addText(act1.subtitle, {
    x: 0.5, y: 1.2, w: 9, h: 0.3,
    fontSize: 10, italic: true, color: COLORS.mediumGray
  });

  slideSnap.addShape("rect", {
    x: 0.5, y: 1.55, w: 2.5, h: 0.06, fill: { color: COLORS.gold }
  });

  slideSnap.addText(
    t(`Systeme de ${simulation.pvSizeKW.toFixed(0)} kWc propose`, `Proposed ${simulation.pvSizeKW.toFixed(0)} kWc system`), {
    x: 0.5, y: 1.65, w: 9, h: 0.3,
    fontSize: 14, italic: true, color: COLORS.gold
  });

  const snapLabels = getProjectSnapshotLabels(lang);
  const snapItems = [
    { label: snapLabels.annualConsumption.label, value: `${Math.round(simulation.annualConsumptionKWh || 0).toLocaleString()} kWh` },
    { label: snapLabels.peakDemand.label, value: `${(simulation.peakDemandKW || 0).toFixed(0)} kW` },
    { label: snapLabels.solarCapacity.label, value: `${simulation.pvSizeKW.toFixed(0)} kWc` },
    { label: snapLabels.batteryCapacity.label, value: simulation.battEnergyKWh > 0 ? `${simulation.battEnergyKWh.toFixed(0)} kWh / ${simulation.battPowerKW.toFixed(0)} kW` : "0 kWh" },
    { label: snapLabels.estimatedProduction.label, value: `${Math.round((simulation.pvSizeKW * 1035) || 0).toLocaleString()} kWh` },
    { label: t("Autosuffisance solaire", "Solar self-sufficiency"), value: `${(simulation.selfSufficiencyPercent || 0).toFixed(0)}%` },
  ];

  snapItems.forEach((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.5 + col * 4.8;
    const y = 1.8 + row * 0.85;

    slideSnap.addShape("rect", {
      x, y, w: 4.5, h: 0.7,
      fill: { color: COLORS.lightGray }
    });
    slideSnap.addText(item.label, {
      x: x + 0.15, y, w: 4.2, h: 0.3,
      fontSize: 9, color: COLORS.mediumGray, shrinkText: true
    });
    const snapValueFontSize = item.value.length > 12 ? 11 : item.value.length > 9 ? 12 : 14;
    slideSnap.addText(item.value, {
      x: x + 0.15, y: y + 0.3, w: 4.2, h: 0.35,
      fontSize: snapValueFontSize, bold: true, color: COLORS.blue, shrinkText: true
    });
  });

  // ================= SLIDE 4: YOUR RESULTS (4 KPIs) =================
  const slideKPI = pptx.addSlide({ masterName: "KWHMAIN" });

  const act3 = getNarrativeAct("act3_results", lang);
  slideKPI.addText(t("VOS RÉSULTATS", "YOUR RESULTS"), {
    x: 0.5, y: 0.8, w: 9, h: 0.5,
    fontSize: 22, bold: true, color: COLORS.blue
  });
  slideKPI.addText(act3.subtitle, {
    x: 0.5, y: 1.2, w: 9, h: 0.3,
    fontSize: 10, italic: true, color: COLORS.mediumGray
  });

  slideKPI.addShape("rect", {
    x: 0.5, y: 1.55, w: 2.5, h: 0.06, fill: { color: COLORS.gold }
  });

  slideKPI.addText(
    t(`Profit net de ${formatCurrency(simulation.npv25)} sur 25 ans`, `Net profit of ${formatCurrency(simulation.npv25)} over 25 years`), {
    x: 0.5, y: 1.65, w: 9, h: 0.3,
    fontSize: 14, italic: true, color: COLORS.gold
  });

  const kpiCardConfigs = [
    { label: getKpiLabel("savings", lang), value: formatCurrency(simulation.savingsYear1), bg: "FFFBEB", border: "FFB005", valueColor: COLORS.gold, labelColor: COLORS.mediumGray },
    { label: getKpiLabel("capexNet", lang), value: formatCurrency(simulation.capexNet), bg: COLORS.lightGray, border: "CCCCCC", valueColor: COLORS.darkGray, labelColor: COLORS.mediumGray },
    { label: getKpiLabel("npv", lang), value: formatCurrency(simulation.npv25), bg: COLORS.blue, border: COLORS.blue, valueColor: COLORS.gold, labelColor: COLORS.white },
    { label: getKpiLabel("irr", lang), value: formatPercent(simulation.irr25), bg: "059669", border: "059669", valueColor: COLORS.white, labelColor: COLORS.white },
  ];

  kpiCardConfigs.forEach((kpi, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.5 + col * 4.8;
    const y = 1.7 + row * 1.6;

    slideKPI.addShape("rect", {
      x, y, w: 4.5, h: 1.4,
      fill: { color: kpi.bg },
      line: { color: kpi.border, width: 1 }
    });
    slideKPI.addText(kpi.label, {
      x: x + 0.2, y: y + 0.1, w: 4.1, h: 0.4,
      fontSize: 12, color: kpi.labelColor, valign: "middle"
    });
    slideKPI.addText(kpi.value, {
      x: x + 0.2, y: y + 0.5, w: 4.1, h: 0.7,
      fontSize: 28, bold: true, color: kpi.valueColor, valign: "middle"
    });
  });

  // Supplementary metrics line below KPIs
  const lcoeValue = simulation.lcoe || 0;
  const co2Value = simulation.co2AvoidedTonnesPerYear || 0;
  const backupHours = (simulation.battEnergyKWh > 0 && simulation.peakDemandKW > 0)
    ? (simulation.battEnergyKWh / (simulation.peakDemandKW * 0.3)).toFixed(1)
    : "0";
  const metricsLine = `LCOE: ${lcoeValue.toFixed(2)} ¢/kWh  |  CO₂: ${co2Value.toFixed(1)} t/${t("an", "yr")}  |  ${t("Autonomie batterie", "Battery backup")}: ${backupHours}h`;
  slideKPI.addText(metricsLine, {
    x: 0.5, y: 4.3, w: 9, h: 0.3,
    fontSize: 11, color: COLORS.mediumGray, align: "center"
  });

  const co2ForEquiv = simulation.co2AvoidedTonnesPerYear || 0;
  const totalProductionKWh = (simulation.pvSizeKW * 1035) || 0;
  const co2TonnesDisplay = totalProductionKWh > 0 ? (totalProductionKWh * 0.002) / 1000 : co2ForEquiv;
  const treesPlanted = Math.max(1, Math.round(co2TonnesDisplay * 45));
  const carsRemoved = co2TonnesDisplay / 4.6;

  const co2Equivalents = [
    { label: t("Arbres plantes", "Trees planted"), value: `${treesPlanted}`, suffix: t("/ an", "/ yr") },
    { label: t("Voitures retirees", "Cars removed"), value: carsRemoved > 0.05 ? carsRemoved.toFixed(1) : "< 0.1", suffix: t("/ an", "/ yr") },
    { label: t("Couverture energetique", "Energy coverage"), value: `${(simulation.selfSufficiencyPercent || 0).toFixed(0)}%`, suffix: "" },
  ];

  co2Equivalents.forEach((eq, i) => {
    const x = 0.5 + i * 3.2;
    slideKPI.addText(eq.value, {
      x, y: 4.65, w: 3, h: 0.3,
      fontSize: 14, bold: true, color: COLORS.green, align: "center"
    });
    slideKPI.addText(`${eq.label} ${eq.suffix}`, {
      x, y: 4.9, w: 3, h: 0.25,
      fontSize: 9, color: COLORS.mediumGray, align: "center"
    });
  });

  // ================= SLIDE 5: NET INVESTMENT BREAKDOWN (Waterfall) =================
  const slideWaterfall = pptx.addSlide({ masterName: "KWHMAIN" });

  slideWaterfall.addText(t("VENTILATION DE L'INVESTISSEMENT NET", "NET INVESTMENT BREAKDOWN"), {
    x: 0.5, y: 0.8, w: 9, h: 0.5,
    fontSize: 22, bold: true, color: COLORS.blue
  });

  slideWaterfall.addShape("rect", {
    x: 0.5, y: 1.35, w: 2.5, h: 0.06, fill: { color: COLORS.gold }
  });

  const totalIncentivesVal = simulation.totalIncentives || 0;
  const capexGrossVal = simulation.capexGross || 1;
  const incentiveReductionPct = ((totalIncentivesVal / capexGrossVal) * 100).toFixed(0);
  slideWaterfall.addText(
    t(`Reduction de ${incentiveReductionPct} % grace aux incitatifs`, `${incentiveReductionPct}% reduction thanks to incentives`), {
    x: 0.5, y: 1.45, w: 9, h: 0.3,
    fontSize: 14, italic: true, color: COLORS.gold
  });

  // Waterfall chart: CAPEX Brut → -HQ Solaire → -HQ Batterie → -ITC Fédéral → = Net
  const capexGross = simulation.capexGross || 0;
  const hqSolar = simulation.incentivesHQSolar || 0;
  const hqBattery = simulation.incentivesHQBattery || 0;
  const itcFederal = simulation.incentivesFederal || 0;
  const capexNet = simulation.capexNet || 0;

  const taxShield = simulation.taxShield || 0;

  const waterfallBars = [
    { label: t("CAPEX Brut", "Gross CAPEX"), value: capexGross, type: "start" as const },
    { label: t("-HQ Solaire", "-HQ Solar"), value: hqSolar, type: "deduction" as const },
    { label: t("-HQ Batterie", "-HQ Battery"), value: hqBattery, type: "deduction" as const },
    { label: t("-ITC Fédéral", "-Federal ITC"), value: itcFederal, type: "deduction" as const },
    { label: t("-Bouclier Fiscal", "-Tax Shield"), value: taxShield, type: "deduction" as const },
    { label: t("= Net", "= Net"), value: capexNet, type: "total" as const },
  ];

  const wfChartX = 0.5;
  const wfChartY = 1.6;
  const wfChartHeight = 3.2;
  const maxWfValue = Math.max(capexGross, 1);
  const wfScale = wfChartHeight / maxWfValue;
  const wfBarWidth = 1.1;
  const wfGap = 0.2;

  let runningTotal = capexGross;

  waterfallBars.forEach((bar, i) => {
    const x = wfChartX + i * (wfBarWidth + wfGap);

    if (bar.type === "start") {
      // Full bar from bottom
      const barH = Math.max(0.05, bar.value * wfScale);
      const barY = wfChartY + wfChartHeight - barH;
      slideWaterfall.addShape("rect", {
        x, y: barY, w: wfBarWidth, h: barH,
        fill: { color: COLORS.blue }
      });
      // Value label
      slideWaterfall.addText(formatCurrency(bar.value), {
        x, y: barY - 0.3, w: wfBarWidth, h: 0.25,
        fontSize: 10, bold: true, color: COLORS.blue, align: "center"
      });
    } else if (bar.type === "deduction") {
      // Floating deduction bar
      const prevTop = wfChartY + wfChartHeight - runningTotal * wfScale;
      const barH = Math.max(0.05, bar.value * wfScale);
      slideWaterfall.addShape("rect", {
        x, y: prevTop, w: wfBarWidth, h: barH,
        fill: { color: "DC2626" }
      });
      // Value label
      if (bar.value > 0) {
        slideWaterfall.addText(`-${formatCurrency(bar.value)}`, {
          x, y: prevTop + barH / 2 - 0.12, w: wfBarWidth, h: 0.25,
          fontSize: 9, bold: true, color: COLORS.white, align: "center"
        });
      }
      runningTotal -= bar.value;
    } else {
      // Total (net) bar from bottom
      const barH = Math.max(0.05, bar.value * wfScale);
      const barY = wfChartY + wfChartHeight - barH;
      slideWaterfall.addShape("rect", {
        x, y: barY, w: wfBarWidth, h: barH,
        fill: { color: COLORS.green }
      });
      // Value label
      slideWaterfall.addText(formatCurrency(bar.value), {
        x, y: barY - 0.3, w: wfBarWidth, h: 0.25,
        fontSize: 10, bold: true, color: COLORS.green, align: "center"
      });
    }

    // Bar label below
    slideWaterfall.addText(bar.label, {
      x, y: wfChartY + wfChartHeight + 0.1, w: wfBarWidth, h: 0.3,
      fontSize: 9, color: COLORS.darkGray, align: "center"
    });
  });

  // ================= SLIDE 6: ROOF CONFIGURATION =================
  const slideRoof = pptx.addSlide({ masterName: "KWHMAIN" });

  slideRoof.addText(t("CONFIGURATION TOITURE", "ROOF CONFIGURATION"), {
    x: 0.5, y: 0.8, w: 9, h: 0.5,
    fontSize: 22, bold: true, color: COLORS.blue
  });

  slideRoof.addShape("rect", {
    x: 0.5, y: 1.35, w: 2.5, h: 0.06, fill: { color: COLORS.gold }
  });

  if (roofImageBuffer) {
    try {
      const base64Image = roofImageBuffer.toString("base64");
      slideRoof.addImage({
        data: `data:image/png;base64,${base64Image}`,
        x: 0.5, y: 1.5, w: 5.5, h: 3.5
      });
    } catch (imgError) {
      log.error("Failed to add roof image to roof slide:", imgError);
    }
  } else {
    slideRoof.addText(t("Image satellite non disponible", "Satellite image not available"), {
      x: 0.5, y: 2.5, w: 5.5, h: 0.5,
      fontSize: 12, color: COLORS.mediumGray, align: "center"
    });
  }

  // Sizing summary on the right
  slideRoof.addShape("rect", {
    x: 6.3, y: 1.5, w: 3.5, h: 3.5,
    fill: { color: COLORS.lightGray }
  });

  slideRoof.addText(t("DIMENSIONNEMENT", "SIZING SUMMARY"), {
    x: 6.5, y: 1.6, w: 3.1, h: 0.35,
    fontSize: 14, bold: true, color: COLORS.blue
  });

  const roofSummary = [
    { label: t("Puissance solaire", "Solar capacity"), value: `${simulation.pvSizeKW.toFixed(0)} kWc` },
    { label: t("Stockage", "Storage"), value: simulation.battEnergyKWh > 0 ? `${simulation.battEnergyKWh.toFixed(0)} kWh` : t("Non inclus", "N/A") },
    { label: t("Production An 1", "Year-1 production"), value: `${((simulation.pvSizeKW * 1035) || 0).toLocaleString()} kWh` },
    { label: t("Autosuffisance solaire", "Solar self-sufficiency"), value: `${(simulation.selfSufficiencyPercent || 0).toFixed(0)}%` },
  ];

  roofSummary.forEach((item, i) => {
    const y = 2.1 + i * 0.65;
    slideRoof.addText(item.label, {
      x: 6.5, y, w: 3.1, h: 0.25,
      fontSize: 9, color: COLORS.mediumGray
    });
    slideRoof.addText(item.value, {
      x: 6.5, y: y + 0.22, w: 3.1, h: 0.3,
      fontSize: 14, bold: true, color: COLORS.blue
    });
  });

  // Per-zone roof polygon table (if available)
  if (options?.roofPolygons && options.roofPolygons.length > 0) {
    const orientLabel = (deg: number | undefined) => {
      if (deg === undefined) return "—";
      if (deg >= 337.5 || deg < 22.5) return "N";
      if (deg < 67.5) return "NE";
      if (deg < 112.5) return "E";
      if (deg < 157.5) return "SE";
      if (deg < 202.5) return "S";
      if (deg < 247.5) return "SW";
      if (deg < 292.5) return "W";
      return "NW";
    };
    const polyTableData: Array<Array<{ text: string; options?: { bold?: boolean; color?: string } }>> = [
      [
        { text: "Zone", options: { bold: true, color: COLORS.white } },
        { text: "m²", options: { bold: true, color: COLORS.white } },
        { text: t("Orient.", "Orient."), options: { bold: true, color: COLORS.white } },
      ],
      ...options.roofPolygons.map((p, i) => [
        { text: p.label || `Zone ${i + 1}` },
        { text: `${Math.round(p.areaSqM)}` },
        { text: orientLabel(p.orientation) },
      ])
    ];
    slideRoof.addTable(polyTableData, {
      x: 6.3, y: 3.7, w: 3.5,
      fill: { color: COLORS.white },
      border: { pt: 0.5, color: COLORS.lightGray },
      fontFace: "Arial",
      fontSize: 8,
      color: COLORS.darkGray,
      colW: [1.2, 0.8, 0.8],
      rowH: 0.22
    });
  }

  // ================= SLIDE 7: FINANCIAL PROJECTIONS (Cashflow + Cost of Inaction) =================
  if (simulation.cashflows && simulation.cashflows.length > 0) {
    const slideCashflow = pptx.addSlide({ masterName: "KWHMAIN" });

    slideCashflow.addText(t("PROJECTIONS FINANCIÈRES", "FINANCIAL PROJECTIONS"), {
      x: 0.5, y: 0.8, w: 9, h: 0.5,
      fontSize: 22, bold: true, color: COLORS.blue
    });

    slideCashflow.addShape("rect", {
      x: 0.5, y: 1.35, w: 2.5, h: 0.06, fill: { color: COLORS.gold }
    });

    const paybackVal = simulation.simplePaybackYears || 0;
    if (paybackVal > 0) {
      slideCashflow.addShape("rect", {
        x: 2, y: 1.45, w: 6, h: 0.6,
        fill: { color: COLORS.gold }
      });
      slideCashflow.addText(
        t(`${paybackVal.toFixed(1)} ans`, `${paybackVal.toFixed(1)} years`), {
        x: 2, y: 1.45, w: 6, h: 0.35,
        fontSize: 20, bold: true, color: COLORS.white, align: "center"
      });
      slideCashflow.addText(
        t("Retour sur investissement", "Payback period"), {
        x: 2, y: 1.78, w: 6, h: 0.25,
        fontSize: 10, color: COLORS.white, align: "center"
      });
    }

    const chartData = simulation.cashflows.slice(0, 26).map(cf => ({
      year: cf.year,
      value: Math.round(((cf as any).cumulative || (cf as any).cumulativeCashflow || 0) / 1000)
    }));

    const maxVal = Math.max(...chartData.map(d => Math.abs(d.value)), 1);
    const scale = 3.0 / maxVal;
    const chartX = 0.5;
    const chartY = 1.5;
    const chartWidth = 9;
    const chartHeight = 3.0;
    const barWidth = (chartWidth / chartData.length) * 0.7;
    const zeroLine = chartY + chartHeight / 2;

    slideCashflow.addShape("line", {
      x: chartX, y: zeroLine, w: chartWidth, h: 0,
      line: { color: COLORS.mediumGray, width: 1 }
    });

    // Y-axis labels
    const yTicks = [0.25, 0.5, 0.75, 1.0];
    yTicks.forEach(pct => {
      const tickVal = Math.round(maxVal * pct);
      const tickY = zeroLine - (chartHeight / 2) * pct;
      slideCashflow.addText(`${tickVal}k$`, {
        x: chartX - 0.6, y: tickY - 0.1, w: 0.55, h: 0.2,
        fontSize: 7, color: COLORS.mediumGray, align: "right"
      });
      // Negative mirror
      const negY = zeroLine + (chartHeight / 2) * pct;
      slideCashflow.addText(`-${tickVal}k$`, {
        x: chartX - 0.6, y: negY - 0.1, w: 0.55, h: 0.2,
        fontSize: 7, color: COLORS.mediumGray, align: "right"
      });
    });
    // Zero label
    slideCashflow.addText("0", {
      x: chartX - 0.35, y: zeroLine - 0.1, w: 0.3, h: 0.2,
      fontSize: 7, color: COLORS.mediumGray, align: "right"
    });

    chartData.forEach((d, i) => {
      const x = chartX + (i / chartData.length) * chartWidth + (chartWidth / chartData.length) * 0.15;
      const height = Math.max(0.02, Math.abs(d.value * scale));
      const isNegative = d.value < 0;
      const y = isNegative ? zeroLine : zeroLine - height;

      slideCashflow.addShape("rect", {
        x, y, w: barWidth, h: height,
        fill: { color: isNegative ? "DC2626" : COLORS.green }
      });

      if (i % 5 === 0 || i === chartData.length - 1) {
        slideCashflow.addText(d.year.toString(), {
          x: x - 0.1, y: zeroLine + chartHeight / 2 + 0.1, w: 0.5, h: 0.2,
          fontSize: 8, color: COLORS.mediumGray, align: "center"
        });
      }
    });

    slideCashflow.addText(t("Positif (vert) = profit cumulé | Négatif (rouge) = période de récupération",
                     "Positive (green) = cumulative profit | Negative (red) = payback period"), {
      x: 0.5, y: 4.6, w: 9, h: 0.25,
      fontSize: 9, color: COLORS.mediumGray, align: "center"
    });

    // Cost of inaction callout
    const annualSavings = simulation.savingsYear1 || simulation.annualSavings || 0;
    const costOfInaction = annualSavings * 25;
    slideCashflow.addShape("rect", {
      x: 1.5, y: 4.9, w: 7, h: 0.5,
      fill: { color: "FFF3CD" }
    });
    slideCashflow.addText(
      t(`Coût de l'inaction sur 25 ans: ${formatCurrency(costOfInaction)}`, `Cost of inaction over 25 years: ${formatCurrency(costOfInaction)}`), {
      x: 1.5, y: 4.95, w: 7, h: 0.4,
      fontSize: 12, bold: true, color: "856404", align: "center"
    });
  }

  // ================= SLIDE 8: FINANCING COMPARISON =================
  {
    const finCapexNet = simulation.capexNet || 0;
    const finSavingsYear1 = simulation.savingsYear1 || 0;
    const finPayback = simulation.simplePaybackYears || 0;
    const finNpv25 = simulation.npv25 || 0;

    const loanRate = 0.05;
    const loanTermMonths = 120;
    const loanMonthlyRate = loanRate / 12;
    const loanMonthly = finCapexNet > 0 ? finCapexNet * loanMonthlyRate / (1 - Math.pow(1 + loanMonthlyRate, -loanTermMonths)) : 0;

    const leaseRate = 0.07;
    const leaseTermMonths = 180;
    const leaseMonthlyRate = leaseRate / 12;
    const leaseMonthly = finCapexNet > 0 ? finCapexNet * leaseMonthlyRate / (1 - Math.pow(1 + leaseMonthlyRate, -leaseTermMonths)) : 0;

    const slideFinancing = pptx.addSlide({ masterName: "KWHMAIN" });

    slideFinancing.addText(t("OPTIONS DE FINANCEMENT", "FINANCING OPTIONS"), {
      x: 0.5, y: 0.8, w: 9, h: 0.5,
      fontSize: 22, bold: true, color: COLORS.blue
    });

    slideFinancing.addShape("rect", {
      x: 0.5, y: 1.35, w: 2.5, h: 0.06, fill: { color: COLORS.gold }
    });

    const finColumns = [
      {
        title: t("Comptant", "Cash"),
        badge: t("Recommande", "Recommended"),
        highlighted: true,
        rows: [
          { label: t("Investissement", "Investment"), value: formatCurrency(finCapexNet) },
          { label: t("Economies An 1", "Year 1 Savings"), value: formatCurrency(finSavingsYear1) },
          { label: t("Retour simple", "Simple Payback"), value: `${finPayback.toFixed(1)} ${t("ans", "yrs")}` },
          { label: t("VAN 25 ans", "25yr NPV"), value: formatCurrency(finNpv25) },
        ]
      },
      {
        title: t("Financement", "Loan"),
        badge: null,
        highlighted: false,
        rows: [
          { label: t("Taux", "Rate"), value: "5.0%" },
          { label: t("Terme", "Term"), value: t("10 ans", "10 yrs") },
          { label: t("Mensualite", "Monthly"), value: formatCurrency(Math.round(loanMonthly)) },
          { label: t("Total", "Total"), value: formatCurrency(Math.round(loanMonthly * loanTermMonths)) },
        ]
      },
      {
        title: t("Location", "Lease"),
        badge: null,
        highlighted: false,
        rows: [
          { label: t("Taux", "Rate"), value: "7.0%" },
          { label: t("Terme", "Term"), value: t("15 ans", "15 yrs") },
          { label: t("Mensualite", "Monthly"), value: formatCurrency(Math.round(leaseMonthly)) },
          { label: t("Total", "Total"), value: formatCurrency(Math.round(leaseMonthly * leaseTermMonths)) },
        ]
      },
    ];

    finColumns.forEach((col, ci) => {
      const x = 0.5 + ci * 3.2;
      const colW = 2.9;

      if (col.highlighted) {
        slideFinancing.addShape("rect", {
          x: x - 0.05, y: 1.55, w: colW + 0.1, h: 3.5,
          line: { color: COLORS.gold, width: 2 },
          fill: { color: COLORS.white }
        });
      }

      slideFinancing.addShape("rect", {
        x, y: 1.6, w: colW, h: 3.4,
        fill: { color: col.highlighted ? "FFFDF5" : COLORS.lightGray }
      });

      slideFinancing.addText(col.title, {
        x, y: 1.65, w: colW, h: 0.45,
        fontSize: 16, bold: true, color: COLORS.blue, align: "center", valign: "middle"
      });

      if (col.badge) {
        slideFinancing.addShape("rect", {
          x: x + 0.3, y: 2.1, w: colW - 0.6, h: 0.3,
          fill: { color: COLORS.gold }
        });
        slideFinancing.addText(`* ${col.badge}`, {
          x: x + 0.3, y: 2.1, w: colW - 0.6, h: 0.3,
          fontSize: 10, bold: true, color: COLORS.blue, align: "center", valign: "middle"
        });
      }

      const rowStartY = col.badge ? 2.55 : 2.2;
      col.rows.forEach((row, ri) => {
        const ry = rowStartY + ri * 0.65;
        slideFinancing.addText(row.label, {
          x: x + 0.15, y: ry, w: colW - 0.3, h: 0.25,
          fontSize: 9, color: COLORS.mediumGray, align: "center"
        });
        slideFinancing.addText(row.value, {
          x: x + 0.15, y: ry + 0.22, w: colW - 0.3, h: 0.35,
          fontSize: 16, bold: true, color: COLORS.darkGray, align: "center"
        });
      });
    });

    slideFinancing.addText(
      t("Les taux presentes sont indicatifs et sujets a approbation de credit. Consultez votre institution financiere.",
        "Rates shown are indicative and subject to credit approval. Consult your financial institution."), {
      x: 0.5, y: 5.1, w: 9, h: 0.3,
      fontSize: 8, color: COLORS.mediumGray, align: "center"
    });
  }

  // ================= SLIDE 9: EQUIPMENT & WARRANTIES =================
  const slideEquip = pptx.addSlide({ masterName: "KWHMAIN" });

  slideEquip.addText(t("ÉQUIPEMENT ET GARANTIES", "EQUIPMENT & WARRANTIES"), {
    x: 0.5, y: 0.8, w: 9, h: 0.5,
    fontSize: 22, bold: true, color: COLORS.blue
  });

  slideEquip.addShape("rect", {
    x: 0.5, y: 1.35, w: 2.5, h: 0.06, fill: { color: COLORS.gold }
  });

  const dynamicEquip = options?.catalogEquipment;
  if (dynamicEquip && dynamicEquip.length > 0) {
    // Use dynamic equipment from DB
    const eqTableData: Array<Array<{ text: string; options?: { bold?: boolean; color?: string } }>> = [
      [
        { text: t("Équipement", "Equipment"), options: { bold: true, color: COLORS.white } },
        { text: t("Fabricant", "Manufacturer"), options: { bold: true, color: COLORS.white } },
        { text: t("Garantie", "Warranty"), options: { bold: true, color: COLORS.white } },
      ],
      ...dynamicEquip.map(eq => [
        { text: eq.name },
        { text: eq.manufacturer },
        { text: eq.warranty, options: { bold: true, color: COLORS.blue } },
      ])
    ];
    slideEquip.addTable(eqTableData, {
      x: 0.5, y: 1.7, w: 9,
      fill: { color: COLORS.white },
      border: { pt: 0.5, color: COLORS.lightGray },
      fontFace: "Arial",
      fontSize: 10,
      color: COLORS.darkGray,
      colW: [4, 2.5, 2.5],
      rowH: 0.35
    });
  } else {
    // Fallback to brandContent defaults
    const equipment = getEquipment(lang);
    equipment.forEach((eq, i) => {
      const x = 0.5 + i * 2.4;
      slideEquip.addShape("rect", {
        x, y: 1.7, w: 2.2, h: 1.8,
        fill: { color: COLORS.lightGray }
      });
      slideEquip.addText(eq.label, {
        x, y: 1.8, w: 2.2, h: 0.7,
        fontSize: 12, color: COLORS.darkGray, align: "center", valign: "middle"
      });
      slideEquip.addText(eq.warranty, {
        x, y: 2.5, w: 2.2, h: 0.5,
        fontSize: 18, bold: true, color: COLORS.blue, align: "center"
      });
      slideEquip.addText(t("garantie", "warranty"), {
        x, y: 3.0, w: 2.2, h: 0.3,
        fontSize: 10, color: COLORS.mediumGray, align: "center"
      });
    });
  }

  slideEquip.addText(t("Équipement indicatif — marques et modèles finaux confirmés dans la soumission ferme",
                        "Indicative equipment — final brands and models confirmed in the firm quote"), {
    x: 0.5, y: 3.8, w: 9, h: 0.3,
    fontSize: 8, color: COLORS.mediumGray, align: "center"
  });

  // ================= SLIDE 10: TIMELINE =================
  const slideTimeline = pptx.addSlide({ masterName: "KWHMAIN" });

  slideTimeline.addText(t("ÉCHÉANCIER TYPE", "TYPICAL TIMELINE"), {
    x: 0.5, y: 0.8, w: 9, h: 0.5,
    fontSize: 22, bold: true, color: COLORS.blue
  });

  slideTimeline.addShape("rect", {
    x: 0.5, y: 1.35, w: 2.5, h: 0.06, fill: { color: COLORS.gold }
  });

  const dynamicTimeline = options?.constructionTimeline;
  if (dynamicTimeline && dynamicTimeline.length > 0) {
    // Use dynamic timeline from DB
    dynamicTimeline.forEach((tl, i) => {
      const x = 0.5 + i * (9 / dynamicTimeline.length);
      const stepW = Math.min(1.7, (9 / dynamicTimeline.length) - 0.2);
      const bgColor = i === 0 ? COLORS.blue : (i === dynamicTimeline.length - 1 ? COLORS.green : COLORS.lightGray);
      const txtColor = (i === 0 || i === dynamicTimeline.length - 1) ? COLORS.white : COLORS.darkGray;

      slideTimeline.addShape("rect", {
        x, y: 2.0, w: stepW, h: 1.3,
        fill: { color: bgColor }
      });
      slideTimeline.addText(tl.step, {
        x, y: 2.1, w: stepW, h: 0.6,
        fontSize: 11, bold: true, color: txtColor, align: "center", valign: "middle"
      });
      if (tl.duration) {
        slideTimeline.addText(tl.duration, {
          x, y: 2.7, w: stepW, h: 0.4,
          fontSize: 10, color: (i === 0 || i === dynamicTimeline.length - 1) ? COLORS.white : COLORS.mediumGray, align: "center"
        });
      }
      if (i < dynamicTimeline.length - 1) {
        slideTimeline.addText("▶", {
          x: x + stepW, y: 2.4, w: 0.2, h: 0.4,
          fontSize: 14, color: COLORS.gold
        });
      }
    });
  } else {
    // Fallback to brandContent defaults
    const timeline = getTimeline(lang);
    timeline.forEach((tl, i) => {
      const x = 0.5 + i * 1.9;
      const bgColor = i === 0 ? COLORS.blue : (i === timeline.length - 1 ? COLORS.green : COLORS.lightGray);
      const txtColor = (i === 0 || i === timeline.length - 1) ? COLORS.white : COLORS.darkGray;

      slideTimeline.addShape("rect", {
        x, y: 2.0, w: 1.7, h: 1.3,
        fill: { color: bgColor }
      });
      slideTimeline.addText(tl.step, {
        x, y: 2.1, w: 1.7, h: 0.6,
        fontSize: 12, bold: true, color: txtColor, align: "center", valign: "middle"
      });
      if (tl.duration) {
        slideTimeline.addText(tl.duration, {
          x, y: 2.7, w: 1.7, h: 0.4,
          fontSize: 11, color: (i === 0 || i === timeline.length - 1) ? COLORS.white : COLORS.mediumGray, align: "center"
        });
      }

      if (i < timeline.length - 1) {
        slideTimeline.addText("▶", {
          x: x + 1.7, y: 2.4, w: 0.2, h: 0.4,
          fontSize: 14, color: COLORS.gold
        });
      }
    });
  }

  slideTimeline.addText(t("Délais sujets à approbation Hydro-Québec et conditions météorologiques",
                           "Timelines subject to Hydro-Québec approval and weather conditions"), {
    x: 0.5, y: 3.6, w: 9, h: 0.3,
    fontSize: 9, color: COLORS.mediumGray, align: "center"
  });

  // ================= SLIDE 11: ASSUMPTIONS & EXCLUSIONS =================
  const slideAssump = pptx.addSlide({ masterName: "KWHMAIN" });

  slideAssump.addText(t("HYPOTHESES ET EXCLUSIONS", "ASSUMPTIONS & EXCLUSIONS"), {
    x: 0.5, y: 0.8, w: 9, h: 0.5,
    fontSize: 22, bold: true, color: COLORS.blue
  });

  slideAssump.addShape("rect", {
    x: 0.5, y: 1.35, w: 2.5, h: 0.06, fill: { color: COLORS.gold }
  });

  const assumptions = getAssumptions(lang);
  const assTableData: Array<Array<{ text: string; options?: { bold?: boolean; color?: string } }>> = [
    [
      { text: t("Hypothese", "Assumption"), options: { bold: true, color: COLORS.white } },
      { text: t("Valeur", "Value"), options: { bold: true, color: COLORS.white } }
    ],
    ...assumptions.map(a => [
      { text: a.label },
      { text: a.value, options: { bold: true, color: COLORS.blue } }
    ])
  ];

  slideAssump.addTable(assTableData, {
    x: 0.5, y: 1.4, w: 5.5,
    fill: { color: COLORS.white },
    border: { pt: 0.5, color: COLORS.lightGray },
    fontFace: "Arial",
    fontSize: 10,
    color: COLORS.darkGray,
    valign: "middle",
    colW: [3.5, 2],
    rowH: 0.3
  });

  slideAssump.addText(t("EXCLUSIONS", "EXCLUSIONS"), {
    x: 6.5, y: 1.4, w: 3, h: 0.35,
    fontSize: 14, bold: true, color: "DC2626"
  });

  const exclusions = getExclusions(lang);
  exclusions.forEach((excl, i) => {
    slideAssump.addText(`x  ${excl}`, {
      x: 6.5, y: 1.85 + i * 0.35, w: 3.2, h: 0.3,
      fontSize: 9, color: COLORS.darkGray
    });
  });

  // ================= SLIDE 12: NEXT STEPS =================
  const slide5 = pptx.addSlide({ masterName: "KWHMAIN" });

  slide5.addText(t("PROCHAINES ÉTAPES", "NEXT STEPS"), {
    x: 0.5, y: 0.8, w: 9, h: 0.5,
    fontSize: 22, bold: true, color: COLORS.blue
  });

  slide5.addShape("rect", {
    x: 0.5, y: 1.35, w: 2.5, h: 0.06, fill: { color: COLORS.gold }
  });

  const act4 = getNarrativeAct("act4_action", lang);
  const transition3 = getNarrativeTransition("resultsToAction", lang);
  slide5.addText(transition3, {
    x: 0.5, y: 1.15, w: 9, h: 0.3,
    fontSize: 9, italic: true, color: COLORS.mediumGray
  });

  slide5.addShape("rect", {
    x: 0.3, y: 1.4, w: 3.1, h: 0.45, fill: { color: COLORS.blue }
  });
  slide5.addText(t("Le Design Fee couvre", "The design fee covers"), {
    x: 0.3, y: 1.45, w: 3.1, h: 0.35,
    fontSize: 11, bold: true, color: COLORS.white, align: "center"
  });

  const designCovers = getDesignFeeCovers(lang);
  designCovers.forEach((item, i) => {
    slide5.addText(`✓  ${item}`, {
      x: 0.4, y: 1.95 + i * 0.35, w: 2.9, h: 0.3,
      fontSize: 9, color: COLORS.darkGray
    });
  });

  slide5.addShape("rect", {
    x: 3.5, y: 1.4, w: 3.1, h: 0.45, fill: { color: COLORS.gold }
  });
  slide5.addText(t("Le client fournit", "The client provides"), {
    x: 3.5, y: 1.45, w: 3.1, h: 0.35,
    fontSize: 11, bold: true, color: COLORS.darkGray, align: "center"
  });

  const clientProvides = getClientProvides(lang);
  clientProvides.forEach((item, i) => {
    slide5.addText(`□  ${item}`, {
      x: 3.6, y: 1.95 + i * 0.35, w: 2.9, h: 0.3,
      fontSize: 9, color: COLORS.darkGray
    });
  });

  slide5.addShape("rect", {
    x: 6.7, y: 1.4, w: 3.1, h: 0.45, fill: { color: COLORS.green }
  });
  slide5.addText(t("Le client reçoit", "The client receives"), {
    x: 6.7, y: 1.45, w: 3.1, h: 0.35,
    fontSize: 11, bold: true, color: COLORS.white, align: "center"
  });

  const clientReceives = getClientReceives(lang);
  clientReceives.forEach((item, i) => {
    slide5.addText(`→  ${item}`, {
      x: 6.8, y: 1.95 + i * 0.35, w: 2.9, h: 0.3,
      fontSize: 9, color: COLORS.darkGray
    });
  });

  slide5.addShape("rect", {
    x: 0.5, y: 4.5, w: 9, h: 0.8, fill: { color: COLORS.blue }
  });
  slide5.addText(t("Contactez-nous pour planifier votre visite de site", "Contact us to schedule your site visit"), {
    x: 0.5, y: 4.65, w: 9, h: 0.25,
    fontSize: 14, bold: true, color: COLORS.white, align: "center"
  });
  slide5.addText("info@kwh.quebec | 514.427.8871 | www.kwh.quebec", {
    x: 0.5, y: 4.95, w: 9, h: 0.2,
    fontSize: 11, color: COLORS.gold, align: "center"
  });

  // ================= SLIDE 13: THEY TRUST US =================
  const slideRef = pptx.addSlide({ masterName: "KWHMAIN" });

  // Titre - utilise brandContent
  slideRef.addText(getTitle("trustUs", lang), {
    x: 0.5, y: 0.9, w: 9, h: 0.5,
    fontSize: 26, bold: true, color: COLORS.blue
  });

  // Ligne décorative
  slideRef.addShape("rect", {
    x: 0.5, y: 1.4, w: 2, h: 0.06, fill: { color: COLORS.gold }
  });

  // Stats de crédibilité - utilise brandContent
  const credStats = getAllStats(lang);
  if (credStats.length === 0) {
    slideRef.addText(lang === "fr" ? "Statistiques non disponibles" : "Statistics not available", {
      x: 1.2, y: 1.8, w: 7, h: 0.5,
      fontSize: 14, color: COLORS.mediumGray, align: "center"
    });
  }
  credStats.forEach((stat, i) => {
    const xPos = 1.2 + i * 2.6;
    slideRef.addText(stat.value, {
      x: xPos, y: 1.8, w: 2.2, h: 0.7,
      fontSize: 36, bold: true, color: COLORS.blue, align: "center"
    });
    slideRef.addText(stat.label, {
      x: xPos, y: 2.5, w: 2.2, h: 0.4,
      fontSize: 12, color: COLORS.mediumGray, align: "center"
    });
  });

  // Témoignage - utilise brandContent (styled card)
  const testimonialPptx = getFirstTestimonial(lang);
  const quoteLines = Math.ceil(testimonialPptx.quote.length / 70);
  const quoteH = Math.max(0.6, quoteLines * 0.3);

  slideRef.addShape("roundRect", {
    x: 1, y: 3.15, w: 8, h: quoteH + 0.55,
    fill: { color: "F7F9FC" },
    rectRadius: 0.1
  });
  slideRef.addShape("rect", {
    x: 1, y: 3.2, w: 0.06, h: quoteH + 0.4,
    fill: { color: COLORS.blue }
  });

  slideRef.addText(`« ${testimonialPptx.quote} »`, {
    x: 1.2, y: 3.25, w: 7.6, h: quoteH,
    fontSize: 16, italic: true, color: COLORS.darkGray, align: "center", valign: "middle"
  });

  slideRef.addText(`— ${testimonialPptx.author}`, {
    x: 1.2, y: 3.25 + quoteH, w: 7.6, h: 0.35,
    fontSize: 11, color: COLORS.mediumGray, align: "center"
  });

  // CTA Box
  slideRef.addShape("rect", {
    x: 2.5, y: 4.6, w: 5, h: 0.65,
    fill: { color: COLORS.blue }
  });

  slideRef.addText(getContactString(), {
    x: 2.5, y: 4.72, w: 5, h: 0.4,
    fontSize: 14, bold: true, color: COLORS.gold, align: "center"
  });

  const pptxData = await pptx.write({ outputType: "nodebuffer" });
  return pptxData as Buffer;
}
