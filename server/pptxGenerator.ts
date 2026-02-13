import PptxGenJSModule from "pptxgenjs";
const PptxGenJS = (PptxGenJSModule as any).default || PptxGenJSModule;
import fs from "fs";
import path from "path";
import { getAllStats, getFirstTestimonial, getTitle, getContactString, getKpiLabel, isKpiHighlighted, getAssumptions, getExclusions, getEquipment, getEquipmentTechnicalSummary, getTimeline, getProjectSnapshotLabels, getDesignFeeCovers, getClientProvides, getClientReceives, getNarrativeAct, getNarrativeTransition, getWhySolarNow } from "@shared/brandContent";
import { formatSmartPower, formatSmartEnergy, formatSmartCurrency, formatSmartCurrencyFull } from "@shared/formatters";
import { TIMELINE_GRADIENT_PPTX } from "@shared/colors";
import type { DocumentSimulationData } from "./documentDataProvider";
import { createLogger } from "./lib/logger";
import { computeAcquisitionCashflows } from "./services/acquisitionCashflows";

const log = createLogger("PPTXGenerator");

const COLORS = {
  blue: "003DA6",
  gold: "FFB005",
  darkGray: "333333",
  mediumGray: "666666",
  lightGray: "E0E0E0",
  green: "16A34A",
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

  // Compute hidden insights for enhanced storytelling
  const { computeHiddenInsights } = await import("./documentDataProvider");
  const simData: any = simulation;
  const hiddenInsights = computeHiddenInsights(simData as any);

  const isSyntheticData = !(simulation.hourlyProfile && (simulation.hourlyProfile as any[]).length > 0);

  const fmtCurrency = (value: number | null | undefined): string => formatSmartCurrencyFull(value, lang);
  const fmtSmartCurrency = (value: number | null | undefined): string => formatSmartCurrency(value, lang);

  const formatPercent = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) {
      return "0.0%";
    }
    return `${(value * 100).toFixed(1)}%`;
  };

  const pptx = new PptxGenJS();
  
  pptx.author = "kWh Québec";
  pptx.company = "kWh Québec";
  pptx.title = `${t("Étude solaire", "Solar Study")} - ${simulation.site.name}`;
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
  slide1.addText(
    t(`Votre bâtiment pourrait vous faire économiser ${fmtCurrency(simulation.annualSavings)} par année`,
      `Your building could save you ${fmtCurrency(simulation.annualSavings)} per year`), {
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

  // ================= SLIDE: WHY SOLAR NOW =================
  const whySolarContent = getWhySolarNow(lang);
  const slideWhy = pptx.addSlide({ masterName: "KWHMAIN" });

  slideWhy.addText(whySolarContent.sectionTitle, {
    x: 0.5, y: 0.3, w: 9, h: 0.5,
    fontSize: 22, bold: true, color: COLORS.blue
  });

  slideWhy.addShape("rect", {
    x: 0.5, y: 0.75, w: 2.5, h: 0.06, fill: { color: COLORS.gold }
  });

  slideWhy.addText(whySolarContent.beforeTitle, {
    x: 0.5, y: 1.0, w: 4.2, h: 0.35,
    fontSize: 13, bold: true, color: "DC2626"
  });

  whySolarContent.beforeReasons.forEach((reason, i) => {
    slideWhy.addText([
      { text: "\u2717 ", options: { bold: true, color: "DC2626", fontSize: 9 } },
      { text: reason, options: { color: COLORS.darkGray, fontSize: 9 } }
    ], { x: 0.5, y: 1.4 + i * 0.28, w: 4.2, h: 0.26, valign: "top" });
  });

  slideWhy.addShape("rect", {
    x: 5.1, y: 1.0, w: 0.04, h: 2.5, fill: { color: COLORS.gold }
  });

  slideWhy.addText(whySolarContent.nowTitle, {
    x: 5.2, y: 1.0, w: 4.3, h: 0.35,
    fontSize: 13, bold: true, color: COLORS.green
  });

  whySolarContent.nowReasons.forEach((reason, i) => {
    slideWhy.addText([
      { text: "\u2713 ", options: { bold: true, color: COLORS.green, fontSize: 9 } },
      { text: reason, options: { color: COLORS.darkGray, fontSize: 9 } }
    ], { x: 5.2, y: 1.4 + i * 0.28, w: 4.3, h: 0.26, valign: "top" });
  });

  slideWhy.addText(whySolarContent.winterTitle, {
    x: 0.5, y: 4.0, w: 9, h: 0.4,
    fontSize: 14, bold: true, color: COLORS.blue
  });

  const mythsToShow = whySolarContent.winterMyths.slice(0, 3);
  const mythColWidth = 2.9;
  const mythGap = 0.2;
  mythsToShow.forEach((m, i) => {
    const mx = 0.5 + i * (mythColWidth + mythGap);
    slideWhy.addText([
      { text: t("Mythe: ", "Myth: "), options: { bold: true, color: "DC2626", fontSize: 8 } },
      { text: m.myth, options: { strike: true, color: "999999", fontSize: 8 } }
    ], { x: mx, y: 4.4, w: mythColWidth, h: 0.5, valign: "top" });

    slideWhy.addText([
      { text: t("Réalité: ", "Reality: "), options: { bold: true, color: COLORS.green, fontSize: 8 } },
      { text: m.reality, options: { color: COLORS.darkGray, fontSize: 8 } }
    ], { x: mx, y: 4.9, w: mythColWidth, h: 0.8, valign: "top" });
  });

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
    slideBill.addText(fmtSmartCurrency(annualCostBefore), {
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
      fontSize: 14, bold: true, color: "FFB005", align: "center"
    });
    slideBill.addText(fmtSmartCurrency(annualCostAfter), {
      x: 5.3, y: 2.3, w: 4.2, h: 0.8,
      fontSize: 36, bold: true, color: "FFB005", align: "center", valign: "middle"
    });
    slideBill.addText(t("/ an", "/ year"), {
      x: 5.3, y: 3.1, w: 4.2, h: 0.4,
      fontSize: 12, color: "FFB005", align: "center"
    });

    const savingsPct = annualCostBefore > 0 ? ((annualSavingsBill / annualCostBefore) * 100).toFixed(0) : "0";
    slideBill.addShape("rect", {
      x: 1.5, y: 4.2, w: 7, h: 0.7,
      fill: { color: COLORS.gold }
    });
    slideBill.addText(
      t(`Economie annuelle: ${fmtCurrency(annualSavingsBill)} (${savingsPct}%)`,
        `Annual savings: ${fmtCurrency(annualSavingsBill)} (${savingsPct}%)`), {
      x: 1.5, y: 4.25, w: 7, h: 0.6,
      fontSize: 18, bold: true, color: COLORS.blue, align: "center", valign: "middle"
    });
  }

  // ================= SLIDE: ENERGY PROFILE (BEFORE VS AFTER) =================
  if (simulation.hourlyProfile && (simulation.hourlyProfile as any[]).length > 0) {
    const hourlyData = simulation.hourlyProfile as any[];
    const hourlyAgg: { kwhBefore: number; kwhAfterRaw: number; prodSum: number; kwBefore: number; count: number }[] = [];
    for (let h = 0; h < 24; h++) {
      hourlyAgg.push({ kwhBefore: 0, kwhAfterRaw: 0, prodSum: 0, kwBefore: 0, count: 0 });
    }
    for (const entry of hourlyData) {
      const h = entry.hour;
      if (h >= 0 && h < 24) {
        hourlyAgg[h].kwhBefore += (entry.consumption || 0);
        hourlyAgg[h].kwhAfterRaw += ((entry.consumption || 0) - (entry.production || 0));
        hourlyAgg[h].prodSum += (entry.production || 0);
        hourlyAgg[h].kwBefore += (entry.peakBefore || 0);
        hourlyAgg[h].count += 1;
      }
    }
    const profileLabels = Array.from({ length: 24 }, (_, i) => `${i}h`);
    const kwhBeforeVals = hourlyAgg.map(a => a.count > 0 ? a.kwhBefore / a.count : 0);
    const kwhAfterVals = hourlyAgg.map(a => a.count > 0 ? Math.max(0, a.kwhAfterRaw / a.count) : 0);
    const kwBeforeVals = hourlyAgg.map(a => a.count > 0 ? a.kwBefore / a.count : 0);
    const kwAfterVals = kwBeforeVals.map((kwB, i) => {
      const prodAvg = hourlyAgg[i].count > 0 ? hourlyAgg[i].prodSum / hourlyAgg[i].count : 0;
      return Math.max(0, kwB - prodAvg);
    });

    const slideProfile = pptx.addSlide({ masterName: "KWHMAIN" });

    slideProfile.addText(
      t("PROFIL MOYEN (AVANT VS APRÈS)", "AVERAGE PROFILE (BEFORE VS AFTER)"), {
      x: 0.5, y: 0.8, w: 9, h: 0.5,
      fontSize: 22, bold: true, color: COLORS.blue
    });

    slideProfile.addShape("rect", {
      x: 0.5, y: 1.35, w: 2.5, h: 0.06, fill: { color: COLORS.gold }
    });

    const barData = [
      { name: t("kWh Avant", "kWh Before"), labels: profileLabels, values: kwhBeforeVals },
      { name: t("kWh Après", "kWh After"), labels: profileLabels, values: kwhAfterVals },
    ];
    const lineData = [
      { name: t("kW Avant", "kW Before"), labels: profileLabels, values: kwBeforeVals },
      { name: t("kW Après", "kW After"), labels: profileLabels, values: kwAfterVals },
    ];

    slideProfile.addChart(
      [
        { type: pptx.charts.BAR, data: barData, options: { barGapWidthPct: 50 } },
        { type: pptx.charts.LINE, data: lineData, options: { secondaryValAxis: true, lineSmooth: false, lineSize: 2 } },
      ] as any,
      {
        x: 0.5, y: 1.5, w: 9, h: 3.8,
        showLegend: true,
        legendPos: "b",
        legendFontSize: 8,
        valAxisTitle: "kWh",
        secondaryValAxis: true,
        secondaryValAxisTitle: "kW",
        catAxisOrientation: "minMax",
        valAxisOrientation: "minMax",
        chartColors: ["6B7280", COLORS.blue, "6B7280", COLORS.gold],
        catAxisLabelFontSize: 7,
        valAxisLabelFontSize: 8,
        showValue: false,
      } as any
    );
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
    t(`Systeme de ${formatSmartPower(simulation.pvSizeKW, lang)} propose`, `Proposed ${formatSmartPower(simulation.pvSizeKW, lang)} system`), {
    x: 0.5, y: 1.65, w: 9, h: 0.3,
    fontSize: 14, italic: true, color: COLORS.gold
  });

  const snapLabels = getProjectSnapshotLabels(lang);
  const snapItems = [
    { label: snapLabels.annualConsumption.label, value: formatSmartEnergy(simulation.annualConsumptionKWh || 0, lang) },
    { label: snapLabels.peakDemand.label, value: formatSmartPower(simulation.peakDemandKW || 0, lang, 'kW') },
    { label: snapLabels.solarCapacity.label, value: formatSmartPower(simulation.pvSizeKW, lang) },
    { label: snapLabels.batteryCapacity.label, value: simulation.battEnergyKWh > 0 ? `${formatSmartEnergy(simulation.battEnergyKWh, lang)} / ${formatSmartPower(simulation.battPowerKW, lang, 'kW')}` : "0 kWh" },
    { label: snapLabels.estimatedProduction.label, value: formatSmartEnergy((simulation.pvSizeKW * 1035) || 0, lang) },
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

  // Add data confidence badge
  slideSnap.addText(
    t(`Confiance de l'analyse: ${hiddenInsights.dataConfidencePercent}%`, `Analysis confidence: ${hiddenInsights.dataConfidencePercent}%`), {
    x: 0.5, y: 4.45, w: 9, h: 0.25,
    fontSize: 10, color: COLORS.mediumGray, align: "center"
  });

  // ================= SLIDE 4: YOUR RESULTS (4 KPIs) =================
  const slideKPI = pptx.addSlide({ masterName: "KWHMAIN" });

  const act3 = getNarrativeAct("act3_results", lang);
  slideKPI.addText(t("VOS RÉSULTATS", "YOUR RESULTS"), {
    x: 0.5, y: 0.8, w: 9, h: 0.5,
    fontSize: 22, bold: true, color: COLORS.blue
  });
  slideKPI.addText(
    t(`Votre bâtiment génère un profit net de ${fmtCurrency(simulation.npv25)} sur 25 ans`,
      `Your building generates a net profit of ${fmtCurrency(simulation.npv25)} over 25 years`), {
    x: 0.5, y: 1.2, w: 9, h: 0.3,
    fontSize: 10, italic: true, color: COLORS.mediumGray
  });

  slideKPI.addShape("rect", {
    x: 0.5, y: 1.55, w: 2.5, h: 0.06, fill: { color: COLORS.gold }
  });

  slideKPI.addText(
    t(`Profit net de ${fmtSmartCurrency(simulation.npv25)} sur 25 ans`, `Net profit of ${fmtSmartCurrency(simulation.npv25)} over 25 years`), {
    x: 0.5, y: 1.65, w: 9, h: 0.3,
    fontSize: 14, italic: true, color: COLORS.gold
  });

  const kpiCardConfigs = [
    { label: getKpiLabel("savings", lang), value: fmtSmartCurrency(simulation.savingsYear1), bg: "FFFBEB", border: "FFB005", valueColor: COLORS.gold, labelColor: COLORS.mediumGray },
    { label: getKpiLabel("capexNet", lang), value: fmtSmartCurrency(simulation.capexNet), bg: COLORS.lightGray, border: "CCCCCC", valueColor: COLORS.darkGray, labelColor: COLORS.mediumGray },
    { label: getKpiLabel("npv", lang), value: fmtSmartCurrency(simulation.npv25), bg: COLORS.blue, border: COLORS.blue, valueColor: COLORS.gold, labelColor: COLORS.white },
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

  const co2Tonnes = simulation.co2AvoidedTonnesPerYear || 0;
  const pptxTreesPlanted = Math.round((co2Tonnes * 25 * 1000) / 21.77);
  const pptxCarsRemoved = Math.round((co2Tonnes / 4.6) * 25);

  const co2Equivalents = [
    { label: t("Arbres plantes", "Trees planted"), value: `${pptxTreesPlanted}`, suffix: t("/ 25 ans", "/ 25 yrs") },
    { label: t("Voitures retirees", "Cars removed"), value: pptxCarsRemoved > 0 ? pptxCarsRemoved.toString() : "< 1", suffix: t("/ 25 ans", "/ 25 yrs") },
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
    { label: t("CAPEX brut", "Gross CAPEX"), value: capexGross, type: "start" as const },
    { label: t("-Hydro-Québec solaire", "-Hydro-Québec Solar"), value: hqSolar, type: "deduction" as const },
    { label: t("-Hydro-Québec batterie", "-Hydro-Québec Battery"), value: hqBattery, type: "deduction" as const },
    { label: t("-ITC fédéral", "-Federal ITC"), value: itcFederal, type: "deduction" as const },
    { label: t("-Bouclier fiscal", "-Tax Shield"), value: taxShield, type: "deduction" as const },
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
      const barH = Math.max(0.05, bar.value * wfScale);
      const barY = wfChartY + wfChartHeight - barH;
      slideWaterfall.addShape("rect", {
        x, y: barY, w: wfBarWidth, h: barH,
        fill: { color: COLORS.mediumGray }
      });
      slideWaterfall.addText(fmtSmartCurrency(bar.value), {
        x, y: barY - 0.3, w: wfBarWidth, h: 0.25,
        fontSize: 10, bold: true, color: COLORS.darkGray, align: "center"
      });
    } else if (bar.type === "deduction") {
      const prevTop = wfChartY + wfChartHeight - runningTotal * wfScale;
      const barH = Math.max(0.05, bar.value * wfScale);
      const isHQ = bar.label.includes("Hydro");
      const barColor = isHQ ? "FFB005" : "3B82F6";
      slideWaterfall.addShape("rect", {
        x, y: prevTop, w: wfBarWidth, h: barH,
        fill: { color: barColor }
      });
      if (bar.value > 0) {
        slideWaterfall.addText(`-${fmtCurrency(bar.value)}`, {
          x, y: prevTop + barH / 2 - 0.12, w: wfBarWidth, h: 0.25,
          fontSize: 9, bold: true, color: COLORS.white, align: "center"
        });
      }
      runningTotal -= bar.value;
    } else {
      const barH = Math.max(0.05, bar.value * wfScale);
      const barY = wfChartY + wfChartHeight - barH;
      slideWaterfall.addShape("rect", {
        x, y: barY, w: wfBarWidth, h: barH,
        fill: { color: COLORS.blue }
      });
      slideWaterfall.addText(fmtSmartCurrency(bar.value), {
        x, y: barY - 0.3, w: wfBarWidth, h: 0.25,
        fontSize: 10, bold: true, color: COLORS.blue, align: "center"
      });
    }

    // Bar label below
    slideWaterfall.addText(bar.label, {
      x, y: wfChartY + wfChartHeight + 0.1, w: wfBarWidth, h: 0.3,
      fontSize: 9, color: COLORS.darkGray, align: "center"
    });
  });

  // ================= SLIDE 6: FINANCIAL PROJECTIONS (Cashflow + Cost of Inaction) =================
  {
    const slideCashflow = pptx.addSlide({ masterName: "KWHMAIN" });

    slideCashflow.addText(t("PROJECTIONS FINANCIÈRES — OPTIONS D'ACQUISITION", "FINANCIAL PROJECTIONS — ACQUISITION OPTIONS"), {
      x: 0.5, y: 0.8, w: 9, h: 0.5,
      fontSize: 20, bold: true, color: COLORS.blue
    });

    slideCashflow.addShape("rect", {
      x: 0.5, y: 1.35, w: 2.5, h: 0.06, fill: { color: COLORS.gold }
    });

    const acq = computeAcquisitionCashflows({
      capexGross: simulation.capexGross,
      capexNet: simulation.capexNet,
      annualSavings: simulation.savingsYear1 || simulation.annualSavings,
      incentivesHQSolar: simulation.incentivesHQSolar || 0,
      incentivesHQBattery: simulation.incentivesHQBattery || 0,
      incentivesFederal: simulation.incentivesFederal || 0,
      taxShield: simulation.taxShield || 0,
      cashflows: simulation.cashflows?.map(cf => ({ year: cf.year, cumulative: cf.cumulative, netCashflow: cf.netCashflow })),
    });

    const series = acq.series.filter(s => s.year >= 1);
    const allVals = series.flatMap(s => [s.cash, s.loan, s.lease]);
    const minVal = Math.min(...allVals, 0);
    const maxVal = Math.max(...allVals, 1);
    const range = maxVal - minVal || 1;

    const chartX = 0.8;
    const chartY = 1.6;
    const chartWidth = 8.6;
    const chartHeight = 2.8;

    const toChartY = (val: number) => chartY + ((maxVal - val) / range) * chartHeight;
    const toChartX = (idx: number) => chartX + (idx / (series.length - 1)) * chartWidth;
    const zeroLine = toChartY(0);

    slideCashflow.addShape("line", {
      x: chartX, y: zeroLine, w: chartWidth, h: 0,
      line: { color: COLORS.mediumGray, width: 1, dashType: "dash" }
    });

    slideCashflow.addText("0 $", {
      x: chartX - 0.65, y: zeroLine - 0.1, w: 0.6, h: 0.2,
      fontSize: 7, color: COLORS.mediumGray, align: "right"
    });

    const yTicks = 4;
    for (let i = 0; i <= yTicks; i++) {
      const val = minVal + (range * i / yTicks);
      if (Math.abs(val) < range * 0.05) continue;
      const y = toChartY(val);
      const label = Math.abs(val) >= 1000000
        ? `${(val / 1000000).toFixed(1)}M$`
        : `${Math.round(val / 1000)}k$`;
      slideCashflow.addShape("line", {
        x: chartX, y, w: chartWidth, h: 0,
        line: { color: COLORS.lightGray, width: 0.5 }
      });
      slideCashflow.addText(label, {
        x: chartX - 0.65, y: y - 0.1, w: 0.6, h: 0.2,
        fontSize: 7, color: COLORS.mediumGray, align: "right"
      });
    }

    const xLabels = [1, 5, 10, 15, 20, 25];
    series.forEach((s, i) => {
      if (xLabels.includes(s.year)) {
        const x = toChartX(i);
        slideCashflow.addText(`${t("An", "Yr")} ${s.year}`, {
          x: x - 0.2, y: chartY + chartHeight + 0.05, w: 0.4, h: 0.2,
          fontSize: 7, color: COLORS.mediumGray, align: "center"
        });
      }
    });

    const drawPolyline = (points: { x: number; y: number }[], color: string, dashType?: string, width = 2) => {
      for (let i = 0; i < points.length - 1; i++) {
        const lineOpts: any = {
          x: points[i].x,
          y: points[i].y,
          w: points[i + 1].x - points[i].x,
          h: points[i + 1].y - points[i].y,
          line: { color, width }
        };
        if (dashType) lineOpts.line.dashType = dashType;
        slideCashflow.addShape("line", lineOpts);
      }
    };

    const cashPts = series.map((s, i) => ({ x: toChartX(i), y: toChartY(s.cash) }));
    const loanPts = series.map((s, i) => ({ x: toChartX(i), y: toChartY(s.loan) }));
    const leasePts = series.map((s, i) => ({ x: toChartX(i), y: toChartY(s.lease) }));

    drawPolyline(leasePts, COLORS.gold, "dash", 2);
    drawPolyline(loanPts, COLORS.blue, "lgDash", 2);
    drawPolyline(cashPts, COLORS.green, undefined, 2.5);

    const legendY = 4.55;
    const legendItems = [
      { color: COLORS.green, label: t("Comptant", "Cash") },
      { color: COLORS.blue, label: t("Prêt (10 ans, 7%)", "Loan (10 yr, 7%)") },
      { color: COLORS.gold, label: t("Crédit-bail 15 ans", "15-yr Lease") },
    ];
    legendItems.forEach((item, i) => {
      const lx = 1.5 + i * 3;
      slideCashflow.addShape("rect", {
        x: lx, y: legendY + 0.05, w: 0.3, h: 0.08,
        fill: { color: item.color }
      });
      slideCashflow.addText(item.label, {
        x: lx + 0.35, y: legendY - 0.02, w: 2.2, h: 0.2,
        fontSize: 9, color: COLORS.darkGray
      });
    });

    slideCashflow.addShape("rect", {
      x: 1.5, y: 4.9, w: 7, h: 0.5,
      fill: { color: "FFF3CD" }
    });
    slideCashflow.addText(
      t(`Ne rien faire vous coûtera ${fmtCurrency(hiddenInsights.costOfInaction25yr)} sur 25 ans`,
        `Doing nothing will cost you ${fmtCurrency(hiddenInsights.costOfInaction25yr)} over 25 years`), {
      x: 1.5, y: 4.95, w: 7, h: 0.4,
      fontSize: 12, bold: true, color: "856404", align: "center"
    });
  }

  // ================= SURPLUS CREDITS SLIDE (conditional) =================
  const surplusExportedKWh = simulation.totalExportedKWh || 0;
  const surplusRevenue = simulation.annualSurplusRevenue || 0;
  if (surplusExportedKWh > 0 && surplusRevenue > 0) {
    const slideSurplus = pptx.addSlide({ masterName: "KWHMAIN" });

    slideSurplus.addText(t("CRÉDITS DE SURPLUS (MESURAGE NET)", "SURPLUS CREDITS (NET METERING)"), {
      x: 0.5, y: 0.8, w: 9, h: 0.5,
      fontSize: 22, bold: true, color: COLORS.blue
    });

    slideSurplus.addShape("rect", {
      x: 0.5, y: 1.35, w: 2.5, h: 0.06, fill: { color: COLORS.gold }
    });

    slideSurplus.addShape("rect", {
      x: 0.5, y: 1.7, w: 4.2, h: 1.8,
      fill: { color: "FFFBEB" },
      line: { color: COLORS.gold, width: 1 }
    });
    slideSurplus.addText(t("Surplus exporté au réseau", "Surplus exported to grid"), {
      x: 0.7, y: 1.8, w: 3.8, h: 0.4,
      fontSize: 12, color: COLORS.mediumGray, align: "center"
    });
    slideSurplus.addText(formatSmartEnergy(surplusExportedKWh, lang), {
      x: 0.7, y: 2.3, w: 3.8, h: 0.8,
      fontSize: 28, bold: true, color: COLORS.gold, align: "center", valign: "middle"
    });
    slideSurplus.addText(t("/ an", "/ year"), {
      x: 0.7, y: 3.0, w: 3.8, h: 0.3,
      fontSize: 11, color: COLORS.mediumGray, align: "center"
    });

    slideSurplus.addShape("rect", {
      x: 5.3, y: 1.7, w: 4.2, h: 1.8,
      fill: { color: COLORS.blue },
      line: { color: COLORS.blue, width: 1 }
    });
    slideSurplus.addText(t("Valeur annuelle des crédits", "Annual credit value"), {
      x: 5.5, y: 1.8, w: 3.8, h: 0.4,
      fontSize: 12, color: COLORS.white, align: "center"
    });
    slideSurplus.addText(fmtSmartCurrency(surplusRevenue), {
      x: 5.5, y: 2.3, w: 3.8, h: 0.8,
      fontSize: 28, bold: true, color: COLORS.gold, align: "center", valign: "middle"
    });
    slideSurplus.addText(t("/ an", "/ year"), {
      x: 5.5, y: 3.0, w: 3.8, h: 0.3,
      fontSize: 11, color: COLORS.white, align: "center"
    });

    slideSurplus.addText(
      t("Les crédits kWh compensent votre facture pendant 24 mois. Le surplus non utilisé est compensé au tarif de référence (~4,54¢/kWh).",
        "kWh credits offset your bill for up to 24 months. Unused surplus is compensated at the reference rate (~4.54¢/kWh)."), {
      x: 0.5, y: 4.0, w: 9, h: 0.5,
      fontSize: 9, color: COLORS.mediumGray, align: "center"
    });
  }

  // ================= SLIDE 7: FINANCING COMPARISON =================
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

    slideFinancing.addText(t("OPTIONS D'ACQUISITION", "ACQUISITION OPTIONS"), {
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
          { label: t("Investissement", "Investment"), value: fmtCurrency(finCapexNet) },
          { label: t("Économies an 1", "Year 1 Savings"), value: fmtCurrency(finSavingsYear1) },
          { label: t("Retour simple", "Simple Payback"), value: `${finPayback.toFixed(1)} ${t("ans", "yrs")}` },
          { label: t("VAN 25 ans", "25yr NPV"), value: fmtCurrency(finNpv25) },
        ]
      },
      {
        title: t("Financement", "Loan"),
        badge: null,
        highlighted: false,
        rows: [
          { label: t("Taux", "Rate"), value: "5.0%" },
          { label: t("Terme", "Term"), value: t("10 ans", "10 yrs") },
          { label: t("Mensualite", "Monthly"), value: fmtCurrency(Math.round(loanMonthly)) },
          { label: t("Total", "Total"), value: fmtCurrency(Math.round(loanMonthly * loanTermMonths)) },
        ]
      },
      {
        title: t("Location", "Lease"),
        badge: null,
        highlighted: false,
        rows: [
          { label: t("Taux", "Rate"), value: "7.0%" },
          { label: t("Terme", "Term"), value: t("15 ans", "15 yrs") },
          { label: t("Mensualite", "Monthly"), value: fmtCurrency(Math.round(leaseMonthly)) },
          { label: t("Total", "Total"), value: fmtCurrency(Math.round(leaseMonthly * leaseTermMonths)) },
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

  // ================= SLIDE 8: ASSUMPTIONS & EXCLUSIONS =================
  const slideAssump = pptx.addSlide({ masterName: "KWHMAIN" });

  slideAssump.addText(t("HYPOTHESES ET EXCLUSIONS", "ASSUMPTIONS & EXCLUSIONS"), {
    x: 0.5, y: 0.8, w: 9, h: 0.5,
    fontSize: 22, bold: true, color: COLORS.blue
  });

  slideAssump.addShape("rect", {
    x: 0.5, y: 1.35, w: 2.5, h: 0.06, fill: { color: COLORS.gold }
  });

  const assumptions = getAssumptions(lang, isSyntheticData);
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
        { text: t("Poids", "Weight"), options: { bold: true, color: COLORS.white } },
        { text: t("Dimensions", "Dimensions"), options: { bold: true, color: COLORS.white } },
        { text: t("Garantie", "Warranty"), options: { bold: true, color: COLORS.white } },
      ],
      ...dynamicEquip.map(eq => [
        { text: eq.name },
        { text: eq.manufacturer },
        { text: (eq as any).weight || "—" },
        { text: (eq as any).dimensions || "—" },
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
      colW: [2.5, 2.0, 1.2, 2.0, 1.3],
      rowH: 0.35
    });
  } else {
    // Fallback to brandContent defaults
    const equipment = getEquipment(lang);
    const eqTableData: Array<Array<{ text: string; options?: any }>> = [
      [
        { text: t("Composant", "Component"), options: { bold: true, color: COLORS.white, fill: { color: COLORS.blue } } },
        { text: t("Spécification", "Specification"), options: { bold: true, color: COLORS.white, fill: { color: COLORS.blue } } },
        { text: t("Poids", "Weight"), options: { bold: true, color: COLORS.white, fill: { color: COLORS.blue } } },
        { text: t("Garantie", "Warranty"), options: { bold: true, color: COLORS.white, fill: { color: COLORS.blue } } },
      ],
      ...equipment.map(eq => [
        { text: eq.label },
        { text: eq.specs || "—" },
        { text: eq.weightKg ? `${eq.weightKg} kg` : "—" },
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
      colW: [2.5, 3.0, 1.5, 2.0],
      rowH: 0.35
    });
  }

  slideEquip.addText(t("Équipement indicatif — marques et modèles finaux confirmés dans la soumission ferme",
                        "Indicative equipment — final brands and models confirmed in the firm quote"), {
    x: 0.5, y: 3.8, w: 9, h: 0.3,
    fontSize: 8, color: COLORS.mediumGray, align: "center"
  });

  // ================= STRUCTURAL DATA SUMMARY =================
  const techSummary = getEquipmentTechnicalSummary(lang);

  slideEquip.addShape("rect", {
    x: 0.5, y: 4.2, w: 9, h: 1.5,
    fill: { color: COLORS.lightGray },
    rectRadius: 0.1
  });

  slideEquip.addText(t("DONNÉES STRUCTURELLES POUR ÉVALUATION DE TOITURE", "STRUCTURAL DATA FOR ROOF EVALUATION"), {
    x: 0.7, y: 4.3, w: 8.6, h: 0.35,
    fontSize: 11, bold: true, color: COLORS.blue
  });

  const structData: Array<Array<{ text: string; options?: any }>> = [
    [
      { text: techSummary.panelWeightKgPerM2.label, options: { fontSize: 9 } },
      { text: `${techSummary.panelWeightKgPerM2.value} ${techSummary.panelWeightKgPerM2.unit}`, options: { bold: true, fontSize: 9 } },
      { text: techSummary.rackingWeightKgPerM2.label, options: { fontSize: 9 } },
      { text: `${techSummary.rackingWeightKgPerM2.value} ${techSummary.rackingWeightKgPerM2.unit}`, options: { bold: true, fontSize: 9 } },
    ],
    [
      { text: techSummary.totalSystemWeightKgPerM2.label, options: { fontSize: 9, bold: true } },
      { text: `${techSummary.totalSystemWeightKgPerM2.value} ${techSummary.totalSystemWeightKgPerM2.unit}`, options: { bold: true, fontSize: 9, color: COLORS.blue } },
      { text: techSummary.totalSystemWeightPsfPerSf.label, options: { fontSize: 9, bold: true } },
      { text: `${techSummary.totalSystemWeightPsfPerSf.value} ${techSummary.totalSystemWeightPsfPerSf.unit}`, options: { bold: true, fontSize: 9, color: COLORS.blue } },
    ],
  ];

  slideEquip.addTable(structData, {
    x: 0.7, y: 4.7, w: 8.6,
    border: { pt: 0.5, color: COLORS.lightGray },
    fontFace: "Arial",
    fontSize: 9,
    color: COLORS.darkGray,
    colW: [3.0, 1.3, 3.0, 1.3],
    rowH: 0.3
  });

  slideEquip.addText(`${techSummary.windLoadDesign} | ${techSummary.snowLoadNote}`, {
    x: 0.7, y: 5.35, w: 8.6, h: 0.25,
    fontSize: 7, color: COLORS.mediumGray, align: "center"
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
      const gradC = TIMELINE_GRADIENT_PPTX.getStepColor(i, dynamicTimeline.length);
      const bgColor = gradC.bg;
      const txtColor = gradC.text;

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
          fontSize: 10, color: gradC.text, align: "center"
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
    const stepW = Math.min(1.5, (9 / timeline.length) - 0.2);
    const stepSpacing = 9 / timeline.length;
    timeline.forEach((tl, i) => {
      const x = 0.5 + i * stepSpacing;
      const gradC = TIMELINE_GRADIENT_PPTX.getStepColor(i, timeline.length);
      const bgColor = gradC.bg;
      const txtColor = gradC.text;

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
          fontSize: 10, color: gradC.text, align: "center"
        });
      }

      if (i < timeline.length - 1) {
        slideTimeline.addText("▶", {
          x: x + stepW, y: 2.4, w: 0.2, h: 0.4,
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

  // ================= SLIDE 11: NEXT STEPS =================
  const slide5 = pptx.addSlide({ masterName: "KWHMAIN" });

  slide5.addText(t("PASSONS À L'ACTION", "LET'S TAKE ACTION"), {
    x: 0.5, y: 0.8, w: 9, h: 0.5,
    fontSize: 22, bold: true, color: COLORS.blue
  });

  slide5.addShape("rect", {
    x: 0.5, y: 1.35, w: 2.5, h: 0.06, fill: { color: COLORS.gold }
  });

  const act4 = getNarrativeAct("act4_action", lang);
  const transition3 = getNarrativeTransition("resultsToAction", lang);
  slide5.addText(
    isSyntheticData
      ? t("Les incitatifs actuels couvrent jusqu'à 60% de votre projet — ces programmes peuvent changer à tout moment.",
          "Current incentives cover up to 60% of your project — these programs can change at any time.")
      : t("Votre analyse est complétée. La prochaine étape: signer l'entente de design pour démarrer la conception.",
          "Your analysis is complete. Next step: sign the design agreement to begin engineering."), {
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
  slide5.addText(
    isSyntheticData
      ? t("Contactez-nous pour planifier votre évaluation détaillée", "Contact us to schedule your detailed evaluation")
      : t("Signez votre entente de design en ligne", "Sign your design agreement online"), {
    x: 0.5, y: 4.65, w: 9, h: 0.25,
    fontSize: 14, bold: true, color: COLORS.white, align: "center"
  });
  slide5.addText("info@kwh.quebec | 514.427.8871 | www.kwh.quebec", {
    x: 0.5, y: 4.95, w: 9, h: 0.2,
    fontSize: 11, color: COLORS.gold, align: "center"
  });

  // ================= SLIDE 12: THEY TRUST US =================
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

  // ================= APPENDIX: ROOF CONFIGURATION =================
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

  slideRoof.addShape("rect", {
    x: 6.3, y: 1.5, w: 3.5, h: 3.5,
    fill: { color: COLORS.lightGray }
  });

  slideRoof.addText(t("DIMENSIONNEMENT", "SIZING SUMMARY"), {
    x: 6.5, y: 1.6, w: 3.1, h: 0.35,
    fontSize: 14, bold: true, color: COLORS.blue
  });

  const roofSummary = [
    { label: t("Puissance solaire", "Solar capacity"), value: formatSmartPower(simulation.pvSizeKW, lang) },
    { label: t("Stockage", "Storage"), value: simulation.battEnergyKWh > 0 ? formatSmartEnergy(simulation.battEnergyKWh, lang) : t("Non inclus", "N/A") },
    { label: t("Production An 1", "Year-1 production"), value: formatSmartEnergy((simulation.pvSizeKW * 1035) || 0, lang) },
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

  const pptxData = await pptx.write({ outputType: "nodebuffer" });
  return pptxData as Buffer;
}
