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

export async function generatePresentationPPTX(
  simulation: SimulationData,
  roofImageBuffer: Buffer | undefined,
  lang: "fr" | "en" = "fr"
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

  // ================= SLIDE 2: PROJECT SNAPSHOT =================
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

  const snapLabels = getProjectSnapshotLabels(lang);
  const snapItems = [
    { label: snapLabels.annualConsumption.label, value: `${(simulation.annualConsumptionKWh || 0).toLocaleString()} kWh` },
    { label: snapLabels.peakDemand.label, value: `${(simulation.peakDemandKW || 0).toFixed(0)} kW` },
    { label: snapLabels.solarCapacity.label, value: `${simulation.pvSizeKW.toFixed(0)} kWc` },
    { label: snapLabels.batteryCapacity.label, value: simulation.battEnergyKWh > 0 ? `${simulation.battEnergyKWh.toFixed(0)} kWh / ${simulation.battPowerKW.toFixed(0)} kW` : t("Non inclus", "Not included") },
    { label: snapLabels.estimatedProduction.label, value: `${((simulation.pvSizeKW * 1035) || 0).toLocaleString()} kWh` },
    { label: snapLabels.selfConsumptionRate.label, value: `${(simulation.selfSufficiencyPercent || 0).toFixed(0)}%` },
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

  // ================= SLIDE 3: YOUR RESULTS (4 KPIs) =================
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

  const kpiCards = [
    { label: getKpiLabel("savings", lang), value: formatCurrency(simulation.savingsYear1), highlight: false },
    { label: getKpiLabel("capexNet", lang), value: formatCurrency(simulation.capexNet), highlight: false },
    { label: getKpiLabel("npv", lang), value: formatCurrency(simulation.npv25), highlight: true },
    { label: getKpiLabel("irr", lang), value: formatPercent(simulation.irr25), highlight: true },
  ];

  kpiCards.forEach((kpi, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.5 + col * 4.8;
    const y = 1.7 + row * 1.6;

    slideKPI.addShape("rect", {
      x, y, w: 4.5, h: 1.4,
      fill: { color: kpi.highlight ? COLORS.gold : COLORS.lightGray }
    });
    slideKPI.addText(kpi.label, {
      x: x + 0.2, y: y + 0.1, w: 4.1, h: 0.4,
      fontSize: 12, color: COLORS.mediumGray, valign: "middle"
    });
    slideKPI.addText(kpi.value, {
      x: x + 0.2, y: y + 0.5, w: 4.1, h: 0.7,
      fontSize: 28, bold: true, color: kpi.highlight ? COLORS.blue : COLORS.darkGray, valign: "middle"
    });
  });

  // ================= SLIDE 4: NET INVESTMENT BREAKDOWN (Waterfall) =================
  const slideWaterfall = pptx.addSlide({ masterName: "KWHMAIN" });

  slideWaterfall.addText(t("VENTILATION DE L'INVESTISSEMENT NET", "NET INVESTMENT BREAKDOWN"), {
    x: 0.5, y: 0.8, w: 9, h: 0.5,
    fontSize: 22, bold: true, color: COLORS.blue
  });

  // Waterfall chart: CAPEX Brut → -HQ Solaire → -HQ Batterie → -ITC Fédéral → = Net
  const capexGross = simulation.capexGross || 0;
  const hqSolar = simulation.incentivesHQSolar || 0;
  const hqBattery = simulation.incentivesHQBattery || 0;
  const itcFederal = simulation.incentivesFederal || 0;
  const capexNet = simulation.capexNet || 0;

  const waterfallBars = [
    { label: t("CAPEX Brut", "Gross CAPEX"), value: capexGross, type: "start" as const },
    { label: t("-HQ Solaire", "-HQ Solar"), value: hqSolar, type: "deduction" as const },
    { label: t("-HQ Batterie", "-HQ Battery"), value: hqBattery, type: "deduction" as const },
    { label: t("-ITC Fédéral", "-Federal ITC"), value: itcFederal, type: "deduction" as const },
    { label: t("= Net", "= Net"), value: capexNet, type: "total" as const },
  ];

  const wfChartX = 0.5;
  const wfChartY = 1.6;
  const wfChartHeight = 3.2;
  const maxWfValue = Math.max(capexGross, 1);
  const wfScale = wfChartHeight / maxWfValue;
  const wfBarWidth = 1.5;
  const wfGap = 0.35;

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

  // ================= SLIDE 5: ROOF CONFIGURATION =================
  const slideRoof = pptx.addSlide({ masterName: "KWHMAIN" });

  slideRoof.addText(t("CONFIGURATION TOITURE", "ROOF CONFIGURATION"), {
    x: 0.5, y: 0.8, w: 9, h: 0.5,
    fontSize: 22, bold: true, color: COLORS.blue
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
    { label: t("Autoconsommation", "Self-consumption"), value: `${(simulation.selfSufficiencyPercent || 0).toFixed(0)}%` },
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

  // ================= SLIDE 6: FINANCIAL PROJECTIONS (Cashflow + Cost of Inaction) =================
  if (simulation.cashflows && simulation.cashflows.length > 0) {
    const slideCashflow = pptx.addSlide({ masterName: "KWHMAIN" });

    slideCashflow.addText(t("PROJECTIONS FINANCIÈRES", "FINANCIAL PROJECTIONS"), {
      x: 0.5, y: 0.8, w: 9, h: 0.5,
      fontSize: 22, bold: true, color: COLORS.blue
    });

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

  // ================= SLIDE 7: ASSUMPTIONS & EXCLUSIONS =================
  const slideAssump = pptx.addSlide({ masterName: "KWHMAIN" });

  slideAssump.addText(t("HYPOTHÈSES ET EXCLUSIONS", "ASSUMPTIONS & EXCLUSIONS"), {
    x: 0.5, y: 0.8, w: 9, h: 0.5,
    fontSize: 22, bold: true, color: COLORS.blue
  });

  const assumptions = getAssumptions(lang);
  const assTableData: Array<Array<{ text: string; options?: { bold?: boolean; color?: string } }>> = [
    [
      { text: t("Hypothèse", "Assumption"), options: { bold: true, color: COLORS.white } },
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
    slideAssump.addText(`✕  ${excl}`, {
      x: 6.5, y: 1.85 + i * 0.35, w: 3.2, h: 0.3,
      fontSize: 9, color: COLORS.darkGray
    });
  });

  // ================= SLIDE 8: EQUIPMENT & WARRANTIES =================
  const slideEquip = pptx.addSlide({ masterName: "KWHMAIN" });

  slideEquip.addText(t("ÉQUIPEMENT ET GARANTIES", "EQUIPMENT & WARRANTIES"), {
    x: 0.5, y: 0.8, w: 9, h: 0.5,
    fontSize: 22, bold: true, color: COLORS.blue
  });

  slideEquip.addShape("rect", {
    x: 0.5, y: 1.35, w: 2.5, h: 0.06, fill: { color: COLORS.gold }
  });

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

  slideEquip.addText(t("Équipement indicatif — marques et modèles finaux confirmés dans la soumission ferme",
                        "Indicative equipment — final brands and models confirmed in the firm quote"), {
    x: 0.5, y: 3.8, w: 9, h: 0.3,
    fontSize: 8, color: COLORS.mediumGray, align: "center"
  });

  // ================= SLIDE 9: TIMELINE =================
  const slideTimeline = pptx.addSlide({ masterName: "KWHMAIN" });

  slideTimeline.addText(t("ÉCHÉANCIER TYPE", "TYPICAL TIMELINE"), {
    x: 0.5, y: 0.8, w: 9, h: 0.5,
    fontSize: 22, bold: true, color: COLORS.blue
  });

  slideTimeline.addShape("rect", {
    x: 0.5, y: 1.35, w: 2.5, h: 0.06, fill: { color: COLORS.gold }
  });

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

  slideTimeline.addText(t("Délais sujets à approbation Hydro-Québec et conditions météorologiques",
                           "Timelines subject to Hydro-Québec approval and weather conditions"), {
    x: 0.5, y: 3.6, w: 9, h: 0.3,
    fontSize: 9, color: COLORS.mediumGray, align: "center"
  });

  // ================= SLIDE 10: NEXT STEPS =================
  const slide5 = pptx.addSlide({ masterName: "KWHMAIN" });

  slide5.addText(t("PROCHAINES ÉTAPES", "NEXT STEPS"), {
    x: 0.5, y: 0.8, w: 9, h: 0.5,
    fontSize: 22, bold: true, color: COLORS.blue
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

  // ================= SLIDE 11: THEY TRUST US =================
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

  // Témoignage - utilise brandContent
  const testimonialPptx = getFirstTestimonial(lang);
  slideRef.addText(`« ${testimonialPptx.quote} »`, {
    x: 1, y: 3.3, w: 8, h: 0.7,
    fontSize: 18, italic: true, color: COLORS.darkGray, align: "center"
  });

  slideRef.addText(`— ${testimonialPptx.author}`, {
    x: 1, y: 4, w: 8, h: 0.35,
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
