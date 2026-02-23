import PptxGenJSModule from "pptxgenjs";
const PptxGenJS = (PptxGenJSModule as any).default || PptxGenJSModule;
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { getAllStats, getTitle, getContactString, getKpiLabel, isKpiHighlighted, getAssumptions, getExclusions, getEquipment, getBatteryEquipment, getEquipmentTechnicalSummary, getTimeline, getProjectSnapshotLabels, getDesignFeeCovers, getClientProvides, getClientReceives, getNarrativeAct, getNarrativeTransition, getWhySolarNow, getDesignMandatePrice, getDesignMandateIncludes, getDeliveryAssurance, getDeliveryPartners, getWarrantyRoadmap } from "@shared/brandContent";
import { computeFitScore } from "@shared/fitScore";
import { formatSmartPower, formatSmartEnergy, formatSmartCurrency, formatSmartCurrencyFull } from "@shared/formatters";
import { TIMELINE_GRADIENT_PPTX } from "@shared/colors";
import type { DocumentSimulationData } from "./documentDataProvider";
import { createLogger } from "./lib/logger";
import { computeAcquisitionCashflows } from "./services/acquisitionCashflows";
import { computeHiddenInsights } from "./documentDataProvider";

const log = createLogger("PPTXGeneratorV2");

type SimulationData = DocumentSimulationData;

export interface PPTXOptions {
  catalogEquipment?: Array<{ name: string; manufacturer: string; warranty: string; spec: string; category: string }>;
  constructionTimeline?: Array<{ step: string; duration: string; status?: string }>;
  roofPolygons?: Array<{ label?: string; areaSqM: number; orientation?: number }>;
}

const BASE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap');
:root {
  --primary: #003DA6;
  --primary-light: #1a5fc7;
  --secondary: #002D7A;
  --accent: #FFB005;
  --accent-light: #FFD060;
  --dark: #2A2A2B;
  --gray: #6b7280;
  --light-gray: #f3f4f6;
  --white: #ffffff;
  --red: #DC2626;
  --green: #16A34A;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Montserrat', 'Helvetica Neue', Arial, sans-serif;
  width: 1920px;
  height: 1080px;
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
}
.slide {
  width: 1920px;
  height: 1080px;
  position: relative;
  background: var(--white);
  overflow: hidden;
}
.slide-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: var(--primary);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 40px;
  z-index: 10;
}
.slide-header::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 0;
  width: 200px;
  height: 4px;
  background: var(--accent);
}
.slide-header .logo { height: 40px; }
.slide-header .date { color: var(--white); font-size: 16px; font-weight: 500; }
.slide-content {
  position: absolute;
  top: 80px;
  left: 60px;
  right: 60px;
  bottom: 50px;
  overflow: hidden;
}
.slide-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: var(--gray);
}
h2 {
  font-size: 36px;
  font-weight: 700;
  color: var(--primary);
  margin-bottom: 8px;
}
h2::after {
  content: '';
  display: block;
  width: 200px;
  height: 3px;
  background: var(--accent);
  margin-top: 8px;
}
.subtitle {
  font-size: 18px;
  color: var(--gray);
  font-style: italic;
  margin-bottom: 20px;
}
.metric-card {
  background: var(--light-gray);
  border-radius: 12px;
  padding: 24px;
  text-align: center;
}
.metric-card .label { font-size: 16px; color: var(--gray); margin-bottom: 8px; }
.metric-card .value { font-size: 28px; font-weight: 700; color: var(--primary); }
.metric-highlight {
  background: var(--primary);
  color: var(--white);
}
.metric-highlight .label { color: rgba(255,255,255,0.8); }
.metric-highlight .value { color: var(--accent); }
.metric-accent {
  background: #FFFBEB;
  border: 2px solid var(--accent);
}
.metric-accent .value { color: var(--accent); }
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 16px;
}
.data-table th {
  background: var(--primary);
  color: var(--white);
  padding: 12px 16px;
  text-align: left;
  font-weight: 600;
}
.data-table td {
  padding: 10px 16px;
  border-bottom: 1px solid #e5e7eb;
  color: var(--dark);
}
.data-table tr:nth-child(even) td { background: var(--light-gray); }
.slide.synthetic::after {
  content: 'ÉTUDE PRÉLIMINAIRE';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-35deg);
  font-size: 72pt;
  font-weight: 700;
  color: rgba(0,61,166,0.06);
  pointer-events: none;
  z-index: 999;
}
`;

function wrapSlide(content: string, opts: { isCover?: boolean; isSynthetic?: boolean; logoBase64?: string; dateStr: string; lang: string }): string {
  const syntheticClass = (!opts.isCover && opts.isSynthetic) ? ' synthetic' : '';
  const headerHtml = opts.isCover ? '' : `
    <div class="slide-header">
      ${opts.logoBase64 ? `<img class="logo" src="${opts.logoBase64}" alt="kWh Québec" />` : `<span style="color:white;font-weight:700;font-size:20px;">kWh Québec</span>`}
      <span class="date">${opts.dateStr}</span>
    </div>`;
  const footerText = opts.lang === 'fr' ? 'Document confidentiel | kWh Québec' : 'Confidential | kWh Québec';
  const footerHtml = opts.isCover ? '' : `<div class="slide-footer">${footerText}</div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE_CSS}
    ${opts.isCover ? `.slide { background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%); }` : ''}
  </style></head><body><div class="slide${syntheticClass}">
    ${headerHtml}
    <div class="slide-content" ${opts.isCover ? 'style="top:0;left:0;right:0;bottom:0;padding:60px;"' : ''}>
      ${content}
    </div>
    ${footerHtml}
  </div></body></html>`;
}

export async function generatePresentationPPTX(
  simulation: SimulationData,
  roofImageBuffer: Buffer | undefined,
  lang: "fr" | "en" = "fr",
  options?: PPTXOptions
): Promise<Buffer> {
  const t = (fr: string, en: string) => (lang === "fr" ? fr : en);
  const fmtCurrency = (value: number | null | undefined): string => formatSmartCurrencyFull(value, lang);
  const fmtSmartCur = (value: number | null | undefined): string => formatSmartCurrency(value, lang);
  const formatPercent = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) return "0.0%";
    return `${(value * 100).toFixed(1)}%`;
  };

  const hiddenInsights = computeHiddenInsights(simulation as any);
  const isSyntheticData = typeof (simulation as any).isSynthetic === 'boolean'
    ? (simulation as any).isSynthetic
    : !(simulation.hourlyProfile && (simulation.hourlyProfile as any[]).length > 0);

  let logoBase64: string | null = null;
  try {
    const logoPath = path.join(process.cwd(), "client", "public", "assets", lang === "fr" ? "logo-fr-white.png" : "logo-en-white.png");
    const logoBuffer = fs.readFileSync(logoPath);
    logoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`;
  } catch (e) {
    log.warn("Logo file not found, using text fallback");
  }

  const roofBase64 = roofImageBuffer ? `data:image/png;base64,${roofImageBuffer.toString("base64")}` : null;
  const dateStr = new Date().toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA");

  const slideOpts = { isSynthetic: isSyntheticData, logoBase64: logoBase64 || undefined, dateStr, lang };

  const slideHtmls: string[] = [];

  // ========== SLIDE 1: COVER ==========
  {
    const address = [simulation.site.address, simulation.site.city, simulation.site.province].filter(Boolean).join(", ");
    const syntheticBanner = isSyntheticData ? `
      <div style="position:absolute;bottom:40px;left:60px;right:60px;background:#FFB005;padding:16px 24px;border-radius:8px;font-size:14px;color:#2A2A2B;line-height:1.4;">
        ${t(
          "Cette analyse est basée sur des données synthétiques générées à partir du type et de la taille du bâtiment sélectionnés. Une procuration ou un téléchargement CSV est requis pour obtenir vos données de consommation réelles et fournir une analyse définitive.",
          "This analysis is based on synthetic data generated from the selected building type and size. A power of attorney or CSV download is required to obtain your actual consumption data and provide a definitive analysis."
        )}
      </div>` : '';

    slideHtmls.push(wrapSlide(`
      <div style="display:flex;height:100%;align-items:stretch;">
        <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding-right:40px;">
          ${logoBase64 ? `<img src="${logoBase64}" style="height:60px;margin-bottom:40px;align-self:flex-start;" />` : `<div style="font-size:28px;font-weight:700;color:white;margin-bottom:40px;">kWh Québec</div>`}
          <h1 style="font-size:48px;font-weight:700;color:white;line-height:1.2;margin-bottom:12px;">
            ${t("PROPOSITION SOLAIRE + STOCKAGE", "SOLAR + STORAGE PROPOSAL")}
          </h1>
          <div style="width:200px;height:5px;background:var(--accent);margin-bottom:30px;"></div>
          <div style="font-size:28px;font-weight:700;color:white;margin-bottom:8px;">${simulation.site.name}</div>
          <div style="font-size:18px;color:rgba(255,255,255,0.8);margin-bottom:8px;">${address || t("Adresse à confirmer", "Address to confirm")}</div>
          <div style="font-size:20px;font-weight:600;color:white;margin-bottom:24px;">${simulation.site.client.name}</div>
          <div style="font-size:16px;color:rgba(255,255,255,0.7);font-style:italic;">
            ${t(
              `Votre bâtiment pourrait vous faire économiser ${fmtCurrency(simulation.annualSavings)} par année`,
              `Your building could save you ${fmtCurrency(simulation.annualSavings)} per year`
            )}
          </div>
        </div>
        ${roofBase64 ? `<div style="flex:0 0 45%;display:flex;align-items:center;justify-content:center;">
          <img src="${roofBase64}" style="max-width:100%;max-height:600px;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.3);" />
        </div>` : ''}
      </div>
      ${syntheticBanner}
    `, { ...slideOpts, isCover: true }));
  }

  // ========== SLIDE 2: WHY SOLAR NOW ==========
  {
    const w = getWhySolarNow(lang);
    const mythsToShow = w.winterMyths.slice(0, 3);
    slideHtmls.push(wrapSlide(`
      <h2>${w.sectionTitle}</h2>
      <div style="display:flex;gap:0;margin-top:16px;">
        <div style="flex:1;padding-right:30px;">
          <div style="font-size:22px;font-weight:700;color:var(--red);margin-bottom:16px;">${w.beforeTitle}</div>
          ${w.beforeReasons.map(r => `
            <div style="display:flex;align-items:flex-start;margin-bottom:10px;">
              <span style="color:var(--red);font-weight:700;margin-right:8px;font-size:18px;">&#x2717;</span>
              <span style="font-size:16px;color:var(--dark);">${r}</span>
            </div>`).join('')}
        </div>
        <div style="width:4px;background:var(--accent);margin:0 20px;flex-shrink:0;"></div>
        <div style="flex:1;padding-left:10px;">
          <div style="font-size:22px;font-weight:700;color:var(--green);margin-bottom:16px;">${w.nowTitle}</div>
          ${w.nowReasons.map(r => `
            <div style="display:flex;align-items:flex-start;margin-bottom:10px;">
              <span style="color:var(--green);font-weight:700;margin-right:8px;font-size:18px;">&#x2713;</span>
              <span style="font-size:16px;color:var(--dark);">${r}</span>
            </div>`).join('')}
        </div>
      </div>
      <div style="margin-top:30px;">
        <div style="font-size:24px;font-weight:700;color:var(--primary);margin-bottom:16px;">${w.winterTitle}</div>
        <div style="display:flex;gap:24px;">
          ${mythsToShow.map(m => `
            <div style="flex:1;background:var(--light-gray);border-radius:8px;padding:16px;">
              <div style="margin-bottom:8px;">
                <span style="font-weight:700;color:var(--red);font-size:14px;">${t("Mythe: ", "Myth: ")}</span>
                <span style="text-decoration:line-through;color:#999;font-size:14px;">${m.myth}</span>
              </div>
              <div>
                <span style="font-weight:700;color:var(--green);font-size:14px;">${t("Réalité: ", "Reality: ")}</span>
                <span style="color:var(--dark);font-size:14px;">${m.reality}</span>
              </div>
            </div>`).join('')}
        </div>
      </div>
    `, slideOpts));
  }

  // ========== SLIDE 3: BILL COMPARISON (conditional) ==========
  {
    const annualCostBefore = simulation.annualCostBefore || 0;
    const annualCostAfter = simulation.annualCostAfter || 0;
    const annualSavingsBill = simulation.annualSavings || 0;
    const billSavingsPercent = annualCostBefore > 0 ? (annualSavingsBill / annualCostBefore) * 100 : 0;

    if (annualCostBefore > 0 && billSavingsPercent >= 10) {
      const savingsPct = annualCostBefore > 0 ? ((annualSavingsBill / annualCostBefore) * 100).toFixed(0) : "0";
      slideHtmls.push(wrapSlide(`
        <h2>${t("VOTRE FACTURE AVANT / APRÈS", "YOUR BILL BEFORE / AFTER")}</h2>
        <div style="display:flex;gap:40px;margin-top:30px;">
          <div style="flex:1;background:#FEF2F2;border-radius:16px;padding:40px;text-align:center;">
            <div style="font-size:24px;font-weight:700;color:var(--red);margin-bottom:20px;">${t("AVANT", "BEFORE")}</div>
            <div style="font-size:56px;font-weight:700;color:var(--red);">${fmtSmartCur(annualCostBefore)}</div>
            <div style="font-size:18px;color:var(--red);margin-top:12px;">${t("/ an", "/ year")}</div>
          </div>
          <div style="flex:1;background:#F0FDF4;border-radius:16px;padding:40px;text-align:center;">
            <div style="font-size:24px;font-weight:700;color:var(--accent);margin-bottom:20px;">${t("APRÈS", "AFTER")}</div>
            <div style="font-size:56px;font-weight:700;color:var(--accent);">${fmtSmartCur(annualCostAfter)}</div>
            <div style="font-size:18px;color:var(--accent);margin-top:12px;">${t("/ an", "/ year")}</div>
          </div>
        </div>
        <div style="margin-top:40px;background:var(--accent);border-radius:12px;padding:24px;text-align:center;">
          <span style="font-size:28px;font-weight:700;color:var(--primary);">
            ${t(`Économie annuelle: ${fmtCurrency(annualSavingsBill)} (${savingsPct}%)`, `Annual savings: ${fmtCurrency(annualSavingsBill)} (${savingsPct}%)`)}
          </span>
        </div>
      `, slideOpts));
    }
  }

  // ========== SLIDE 4: ENERGY PROFILE (conditional) ==========
  if (simulation.hourlyProfile && (simulation.hourlyProfile as any[]).length > 0) {
    const hourlyData = simulation.hourlyProfile as any[];
    const hourlyAgg: { kwhBefore: number; kwhAfter: number; kwBefore: number; kwAfter: number; count: number }[] = [];
    for (let h = 0; h < 24; h++) hourlyAgg.push({ kwhBefore: 0, kwhAfter: 0, kwBefore: 0, kwAfter: 0, count: 0 });
    for (const entry of hourlyData) {
      const h = entry.hour;
      if (h >= 0 && h < 24) {
        hourlyAgg[h].kwhBefore += (entry.consumption || 0);
        hourlyAgg[h].kwhAfter += Math.max(0, (entry.consumption || 0) - (entry.production || 0));
        hourlyAgg[h].kwBefore += (entry.peakBefore || 0);
        hourlyAgg[h].kwAfter += Math.max(0, (entry.peakBefore || 0) - (entry.production || 0));
        hourlyAgg[h].count += 1;
      }
    }
    const kwhBefore = hourlyAgg.map(a => a.count > 0 ? a.kwhBefore / a.count : 0);
    const kwhAfter = hourlyAgg.map(a => a.count > 0 ? a.kwhAfter / a.count : 0);
    const kwBefore = hourlyAgg.map(a => a.count > 0 ? a.kwBefore / a.count : 0);
    const kwAfter = hourlyAgg.map(a => a.count > 0 ? a.kwAfter / a.count : 0);
    const maxKwh = Math.max(...kwhBefore, ...kwhAfter, 1);
    const maxKw = Math.max(...kwBefore, ...kwAfter, 1);

    const chartW = 1700;
    const chartH = 500;
    const chartX = 80;
    const chartY = 40;
    const barW = (chartW / 24) * 0.35;
    const barGap = 4;

    const svgBars = Array.from({ length: 24 }, (_, i) => {
      const cx = chartX + (i / 24) * chartW + (chartW / 48);
      const h1 = (kwhBefore[i] / maxKwh) * chartH;
      const h2 = (kwhAfter[i] / maxKwh) * chartH;
      return `<rect x="${cx - barW - barGap / 2}" y="${chartY + chartH - h1}" width="${barW}" height="${h1}" fill="#6B7280" opacity="0.5" />
              <rect x="${cx + barGap / 2}" y="${chartY + chartH - h2}" width="${barW}" height="${h2}" fill="#003DA6" opacity="0.7" />`;
    }).join('');

    const kwBeforeLine = kwBefore.map((v, i) => {
      const x = chartX + (i / 24) * chartW + (chartW / 48);
      const y = chartY + chartH - (v / maxKw) * chartH;
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ');
    const kwAfterLine = kwAfter.map((v, i) => {
      const x = chartX + (i / 24) * chartW + (chartW / 48);
      const y = chartY + chartH - (v / maxKw) * chartH;
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ');

    const xLabels = Array.from({ length: 24 }, (_, i) => {
      const x = chartX + (i / 24) * chartW + (chartW / 48);
      return `<text x="${x}" y="${chartY + chartH + 28}" text-anchor="middle" font-size="14" fill="#6b7280">${i}h</text>`;
    }).join('');

    slideHtmls.push(wrapSlide(`
      <h2>${t("PROFIL MOYEN (AVANT VS APRÈS)", "AVERAGE PROFILE (BEFORE VS AFTER)")}</h2>
      <svg width="1800" height="650" viewBox="0 0 1800 650" style="margin-top:16px;">
        <line x1="${chartX}" y1="${chartY + chartH}" x2="${chartX + chartW}" y2="${chartY + chartH}" stroke="#e5e7eb" stroke-width="1" />
        ${svgBars}
        <path d="${kwBeforeLine}" fill="none" stroke="#6B7280" stroke-width="3" stroke-dasharray="8,4" />
        <path d="${kwAfterLine}" fill="none" stroke="#FFB005" stroke-width="3" />
        ${xLabels}
        <text x="${chartX - 10}" y="${chartY + 10}" text-anchor="end" font-size="14" fill="#6b7280">kWh</text>
        <text x="${chartX + chartW + 10}" y="${chartY + 10}" text-anchor="start" font-size="14" fill="#6b7280">kW</text>
        <rect x="${chartX}" y="${chartH + 80}" width="20" height="14" fill="#6B7280" opacity="0.5" />
        <text x="${chartX + 28}" y="${chartH + 93}" font-size="14" fill="#6b7280">${t("kWh Avant", "kWh Before")}</text>
        <rect x="${chartX + 200}" y="${chartH + 80}" width="20" height="14" fill="#003DA6" opacity="0.7" />
        <text x="${chartX + 228}" y="${chartH + 93}" font-size="14" fill="#6b7280">${t("kWh Après", "kWh After")}</text>
        <line x1="${chartX + 420}" y1="${chartH + 87}" x2="${chartX + 460}" y2="${chartH + 87}" stroke="#6B7280" stroke-width="3" stroke-dasharray="8,4" />
        <text x="${chartX + 468}" y="${chartH + 93}" font-size="14" fill="#6b7280">${t("kW Avant", "kW Before")}</text>
        <line x1="${chartX + 640}" y1="${chartH + 87}" x2="${chartX + 680}" y2="${chartH + 87}" stroke="#FFB005" stroke-width="3" />
        <text x="${chartX + 688}" y="${chartH + 93}" font-size="14" fill="#6b7280">${t("kW Après", "kW After")}</text>
      </svg>
    `, slideOpts));
  }

  // ========== SLIDE 5: PROJECT SNAPSHOT ==========
  {
    const act1 = getNarrativeAct("act1_challenge", lang);
    const snapLabels = getProjectSnapshotLabels(lang);
    const totalProductionKWhSnapshot = (simulation as any).totalProductionKWh || Math.round(simulation.annualConsumptionKWh * simulation.selfSufficiencyPercent / 100);
    const snapItems = [
      { label: snapLabels.annualConsumption.label, value: formatSmartEnergy(simulation.annualConsumptionKWh || 0, lang) },
      { label: snapLabels.peakDemand.label, value: formatSmartPower(simulation.peakDemandKW || 0, lang, 'kW') },
      { label: snapLabels.solarCapacity.label, value: formatSmartPower(simulation.pvSizeKW, lang) },
      { label: snapLabels.batteryCapacity.label, value: simulation.battEnergyKWh > 0 ? `${formatSmartEnergy(simulation.battEnergyKWh, lang)} / ${formatSmartPower(simulation.battPowerKW, lang, 'kW')}` : "0 kWh" },
      { label: snapLabels.estimatedProduction.label, value: formatSmartEnergy(totalProductionKWhSnapshot || 0, lang) },
      { label: t("Autosuffisance solaire", "Solar self-sufficiency"), value: `${(simulation.selfSufficiencyPercent || 0).toFixed(0)}%` },
    ];

    slideHtmls.push(wrapSlide(`
      <h2>${t("APERÇU DU PROJET", "PROJECT SNAPSHOT")}</h2>
      <div class="subtitle">${act1.subtitle}</div>
      <div style="font-size:20px;font-style:italic;color:var(--accent);margin-bottom:24px;">
        ${t(`Système de ${formatSmartPower(simulation.pvSizeKW, lang)} proposé`, `Proposed ${formatSmartPower(simulation.pvSizeKW, lang)} system`)}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        ${snapItems.map(item => `
          <div class="metric-card">
            <div class="label">${item.label}</div>
            <div class="value">${item.value}</div>
          </div>`).join('')}
      </div>
      <div style="text-align:center;margin-top:20px;font-size:16px;color:var(--gray);">
        ${t(`Confiance de l'analyse: ${hiddenInsights.dataConfidencePercent}%`, `Analysis confidence: ${hiddenInsights.dataConfidencePercent}%`)}
      </div>
    `, slideOpts));
  }

  // ========== SLIDE 6: YOUR RESULTS (KPIs) ==========
  {
    const co2Tonnes = simulation.co2AvoidedTonnesPerYear || 0;
    const treesPlanted = Math.round((co2Tonnes * 25 * 1000) / 21.77);
    const carsRemoved = Math.round((co2Tonnes / 4.6) * 25);
    const lcoeValue = simulation.lcoe || 0;
    const backupHours = (simulation.battEnergyKWh > 0 && simulation.peakDemandKW > 0)
      ? (simulation.battEnergyKWh / (simulation.peakDemandKW * 0.3)).toFixed(1)
      : "0";

    const kpis = [
      { label: getKpiLabel("savings", lang), value: fmtSmartCur(simulation.savingsYear1), style: 'background:#FFFBEB;border:2px solid var(--accent);', valueColor: 'var(--accent)', labelColor: 'var(--gray)' },
      { label: getKpiLabel("capexNet", lang), value: fmtSmartCur(simulation.capexNet), style: 'background:var(--light-gray);', valueColor: 'var(--dark)', labelColor: 'var(--gray)' },
      { label: getKpiLabel("npv", lang), value: fmtSmartCur(simulation.npv25), style: 'background:var(--primary);', valueColor: 'var(--accent)', labelColor: 'rgba(255,255,255,0.8)' },
      { label: getKpiLabel("irr", lang), value: formatPercent(simulation.irr25), style: 'background:#059669;', valueColor: 'white', labelColor: 'rgba(255,255,255,0.8)' },
    ];

    slideHtmls.push(wrapSlide(`
      <h2>${t("VOS RÉSULTATS", "YOUR RESULTS")}</h2>
      <div class="subtitle">${t(`Votre bâtiment génère un profit net de ${fmtCurrency(simulation.npv25)} sur 25 ans`, `Your building generates a net profit of ${fmtCurrency(simulation.npv25)} over 25 years`)}</div>
      <div style="font-size:20px;font-style:italic;color:var(--accent);margin-bottom:20px;">
        ${t(`Profit net de ${fmtSmartCur(simulation.npv25)} sur 25 ans`, `Net profit of ${fmtSmartCur(simulation.npv25)} over 25 years`)}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        ${kpis.map(k => `
          <div style="${k.style};border-radius:12px;padding:28px;">
            <div style="font-size:18px;color:${k.labelColor};margin-bottom:8px;">${k.label}</div>
            <div style="font-size:42px;font-weight:700;color:${k.valueColor};">${k.value}</div>
          </div>`).join('')}
      </div>
      <div style="text-align:center;margin-top:16px;font-size:16px;color:var(--gray);">
        LCOE: ${lcoeValue.toFixed(2)} ¢/kWh &nbsp;|&nbsp; CO₂: ${co2Tonnes.toFixed(1)} t/${t("an", "yr")} &nbsp;|&nbsp; ${t("Autonomie batterie", "Battery backup")}: ${backupHours}h
      </div>
      <div style="display:flex;justify-content:center;gap:60px;margin-top:12px;">
        <div style="text-align:center;">
          <div style="font-size:22px;font-weight:700;color:var(--green);">${treesPlanted}</div>
          <div style="font-size:13px;color:var(--gray);">${t("Arbres plantés", "Trees planted")} ${t("/ 25 ans", "/ 25 yrs")}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:22px;font-weight:700;color:var(--green);">${carsRemoved > 0 ? carsRemoved : "< 1"}</div>
          <div style="font-size:13px;color:var(--gray);">${t("Voitures retirées", "Cars removed")} ${t("/ 25 ans", "/ 25 yrs")}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:22px;font-weight:700;color:var(--green);">${(simulation.selfSufficiencyPercent || 0).toFixed(0)}%</div>
          <div style="font-size:13px;color:var(--gray);">${t("Couverture énergétique", "Energy coverage")}</div>
        </div>
      </div>
    `, slideOpts));
  }

  // ========== SLIDE 7: NET INVESTMENT BREAKDOWN (Waterfall) ==========
  {
    const capexGross = simulation.capexGross || 0;
    const hqSolar = simulation.incentivesHQSolar || 0;
    const hqBattery = simulation.incentivesHQBattery || 0;
    const itcFederal = simulation.incentivesFederal || 0;
    const taxShield = simulation.taxShield || 0;
    const capexNet = simulation.capexNet || 0;
    const totalIncentivesVal = simulation.totalIncentives || 0;
    const capexGrossVal = simulation.capexGross || 1;
    const incentiveReductionPct = ((totalIncentivesVal / capexGrossVal) * 100).toFixed(0);

    const bars = [
      { label: t("CAPEX brut", "Gross CAPEX"), value: capexGross, type: "start" },
      { label: t("-HQ Solaire", "-HQ Solar"), value: hqSolar, type: "deduction" },
      { label: t("-HQ Batterie", "-HQ Battery"), value: hqBattery, type: "deduction" },
      { label: t("-ITC fédéral", "-Federal ITC"), value: itcFederal, type: "deduction" },
      { label: t("-Bouclier fiscal", "-Tax Shield"), value: taxShield, type: "deduction" },
      { label: t("= Net", "= Net"), value: capexNet, type: "total" },
    ];

    const maxVal = capexGross || 1;
    const chartW = 1600;
    const chartH = 480;
    const chartX = 100;
    const chartY = 30;
    const barWidth = chartW / bars.length * 0.6;
    const barSpacing = chartW / bars.length;

    let running = capexGross;
    const svgBars = bars.map((bar, i) => {
      const cx = chartX + i * barSpacing + barSpacing / 2;
      const x = cx - barWidth / 2;
      let fill = '#6B7280';
      let barH: number, barY: number;

      if (bar.type === 'start') {
        barH = (bar.value / maxVal) * chartH;
        barY = chartY + chartH - barH;
        fill = '#6B7280';
      } else if (bar.type === 'deduction') {
        const prevTop = chartY + chartH - (running / maxVal) * chartH;
        barH = (bar.value / maxVal) * chartH;
        barY = prevTop;
        fill = bar.label.includes("HQ") || bar.label.includes("Hydro") ? '#FFB005' : '#3B82F6';
        running -= bar.value;
      } else {
        barH = (bar.value / maxVal) * chartH;
        barY = chartY + chartH - barH;
        fill = '#003DA6';
      }

      const valueLabel = bar.type === 'deduction' ? `-${fmtCurrency(bar.value)}` : fmtSmartCur(bar.value);
      return `
        <rect x="${x}" y="${barY}" width="${barWidth}" height="${Math.max(barH, 2)}" fill="${fill}" rx="4" />
        <text x="${cx}" y="${barY - 10}" text-anchor="middle" font-size="15" font-weight="700" fill="${fill === '#FFB005' ? '#B07A00' : fill}">${valueLabel}</text>
        <text x="${cx}" y="${chartY + chartH + 28}" text-anchor="middle" font-size="14" fill="#6b7280">${bar.label}</text>
      `;
    }).join('');

    slideHtmls.push(wrapSlide(`
      <h2>${t("VENTILATION DE L'INVESTISSEMENT NET", "NET INVESTMENT BREAKDOWN")}</h2>
      <div style="font-size:20px;font-style:italic;color:var(--accent);margin-bottom:16px;">
        ${t(`Réduction de ${incentiveReductionPct}% grâce aux incitatifs`, `${incentiveReductionPct}% reduction thanks to incentives`)}
      </div>
      <svg width="1800" height="600" viewBox="0 0 1800 600">
        <line x1="${chartX}" y1="${chartY + chartH}" x2="${chartX + chartW}" y2="${chartY + chartH}" stroke="#e5e7eb" stroke-width="1" />
        ${svgBars}
      </svg>
    `, slideOpts));
  }

  // ========== SLIDE 8: FINANCIAL PROJECTIONS (Cashflow) ==========
  {
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

    const chartW = 1600;
    const chartH = 420;
    const chartX = 120;
    const chartY = 30;

    const toX = (idx: number) => chartX + (idx / (series.length - 1)) * chartW;
    const toY = (val: number) => chartY + ((maxVal - val) / range) * chartH;
    const zeroY = toY(0);

    const cashLine = series.map((s, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(s.cash)}`).join(' ');
    const loanLine = series.map((s, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(s.loan)}`).join(' ');
    const leaseLine = series.map((s, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(s.lease)}`).join(' ');

    const yTicks = 4;
    const yTickLines = Array.from({ length: yTicks + 1 }, (_, i) => {
      const val = minVal + (range * i / yTicks);
      if (Math.abs(val) < range * 0.05) return '';
      const y = toY(val);
      const label = Math.abs(val) >= 1000000 ? `${(val / 1000000).toFixed(1)}M$` : `${Math.round(val / 1000)}k$`;
      return `<line x1="${chartX}" y1="${y}" x2="${chartX + chartW}" y2="${y}" stroke="#e5e7eb" stroke-width="1" />
              <text x="${chartX - 10}" y="${y + 5}" text-anchor="end" font-size="13" fill="#6b7280">${label}</text>`;
    }).join('');

    const xLabels = [1, 5, 10, 15, 20, 25];
    const xLabelSvg = series.map((s, i) => {
      if (!xLabels.includes(s.year)) return '';
      return `<text x="${toX(i)}" y="${chartY + chartH + 28}" text-anchor="middle" font-size="13" fill="#6b7280">${t("An", "Yr")} ${s.year}</text>`;
    }).join('');

    slideHtmls.push(wrapSlide(`
      <h2>${t("PROJECTIONS FINANCIÈRES — OPTIONS D'ACQUISITION", "FINANCIAL PROJECTIONS — ACQUISITION OPTIONS")}</h2>
      <svg width="1800" height="580" viewBox="0 0 1800 580">
        ${yTickLines}
        <line x1="${chartX}" y1="${zeroY}" x2="${chartX + chartW}" y2="${zeroY}" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,4" />
        <text x="${chartX - 10}" y="${zeroY + 5}" text-anchor="end" font-size="13" fill="#9ca3af">0 $</text>
        <path d="${leaseLine}" fill="none" stroke="#FFB005" stroke-width="3" stroke-dasharray="8,4" />
        <path d="${loanLine}" fill="none" stroke="#003DA6" stroke-width="3" stroke-dasharray="12,6" />
        <path d="${cashLine}" fill="none" stroke="#16A34A" stroke-width="3.5" />
        ${xLabelSvg}
        <rect x="${chartX}" y="${chartH + 60}" width="24" height="4" fill="#16A34A" />
        <text x="${chartX + 32}" y="${chartH + 66}" font-size="14" fill="#6b7280">${t("Comptant", "Cash")}</text>
        <rect x="${chartX + 220}" y="${chartH + 60}" width="24" height="4" fill="#003DA6" />
        <text x="${chartX + 252}" y="${chartH + 66}" font-size="14" fill="#6b7280">${t("Prêt (10 ans, 7%)", "Loan (10 yr, 7%)")}</text>
        <rect x="${chartX + 520}" y="${chartH + 60}" width="24" height="4" fill="#FFB005" />
        <text x="${chartX + 552}" y="${chartH + 66}" font-size="14" fill="#6b7280">${t("Crédit-bail 15 ans", "15-yr Lease")}</text>
      </svg>
      <div style="background:#FFF3CD;border-radius:8px;padding:16px;text-align:center;margin-top:8px;">
        <span style="font-size:20px;font-weight:700;color:#856404;">
          ${t(`Ne rien faire vous coûtera ${fmtCurrency(hiddenInsights.costOfInaction25yr)} sur 25 ans`,
            `Doing nothing will cost you ${fmtCurrency(hiddenInsights.costOfInaction25yr)} over 25 years`)}
        </span>
      </div>
    `, slideOpts));
  }

  // ========== SLIDE 9: SURPLUS CREDITS (conditional) ==========
  {
    const surplusExportedKWh = simulation.totalExportedKWh || 0;
    const surplusRevenue = simulation.annualSurplusRevenue || 0;
    if (surplusExportedKWh > 0 && surplusRevenue > 0) {
      slideHtmls.push(wrapSlide(`
        <h2>${t("CRÉDITS DE SURPLUS (MESURAGE NET)", "SURPLUS CREDITS (NET METERING)")}</h2>
        <div style="display:flex;gap:40px;margin-top:40px;">
          <div style="flex:1;background:#FFFBEB;border:2px solid var(--accent);border-radius:16px;padding:40px;text-align:center;">
            <div style="font-size:18px;color:var(--gray);margin-bottom:16px;">${t("Surplus exporté au réseau", "Surplus exported to grid")}</div>
            <div style="font-size:48px;font-weight:700;color:var(--accent);">${formatSmartEnergy(surplusExportedKWh, lang)}</div>
            <div style="font-size:16px;color:var(--gray);margin-top:8px;">${t("/ an", "/ year")}</div>
          </div>
          <div style="flex:1;background:var(--primary);border-radius:16px;padding:40px;text-align:center;">
            <div style="font-size:18px;color:rgba(255,255,255,0.8);margin-bottom:16px;">${t("Valeur annuelle des crédits", "Annual credit value")}</div>
            <div style="font-size:48px;font-weight:700;color:var(--accent);">${fmtSmartCur(surplusRevenue)}</div>
            <div style="font-size:16px;color:rgba(255,255,255,0.8);margin-top:8px;">${t("/ an", "/ year")}</div>
          </div>
        </div>
        <div style="text-align:center;margin-top:40px;font-size:15px;color:var(--gray);max-width:1200px;margin-left:auto;margin-right:auto;">
          ${t(
            "Les crédits kWh compensent votre facture pendant 24 mois. Le surplus non utilisé est compensé au tarif de référence (~4,54¢/kWh).",
            "kWh credits offset your bill for up to 24 months. Unused surplus is compensated at the reference rate (~4.54¢/kWh)."
          )}
        </div>
      `, slideOpts));
    }
  }

  // ========== SLIDE 10: ACQUISITION OPTIONS (Financing) ==========
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
    const leaseCapex = (simulation.capexGross || 0) - (simulation.incentivesFederal || 0);
    const leaseMonthly = leaseCapex > 0 ? leaseCapex * leaseMonthlyRate / (1 - Math.pow(1 + leaseMonthlyRate, -leaseTermMonths)) : 0;

    const columns = [
      {
        title: t("Comptant", "Cash"), highlighted: true, badge: t("Recommandé", "Recommended"),
        rows: [
          { label: t("Investissement", "Investment"), value: fmtCurrency(finCapexNet) },
          { label: t("Économies an 1", "Year 1 Savings"), value: fmtCurrency(finSavingsYear1) },
          { label: t("Retour simple", "Simple Payback"), value: `${finPayback.toFixed(1)} ${t("ans", "yrs")}` },
          { label: t("VAN 25 ans", "25yr NPV"), value: fmtCurrency(finNpv25) },
        ]
      },
      {
        title: t("Financement", "Loan"), highlighted: false, badge: null,
        rows: [
          { label: t("Taux", "Rate"), value: "5.0%" },
          { label: t("Terme", "Term"), value: t("10 ans", "10 yrs") },
          { label: t("Mensualité", "Monthly"), value: fmtCurrency(Math.round(loanMonthly)) },
          { label: t("Total", "Total"), value: fmtCurrency(Math.round(loanMonthly * loanTermMonths)) },
        ]
      },
      {
        title: t("Location", "Lease"), highlighted: false, badge: null,
        rows: [
          { label: t("Taux", "Rate"), value: "7.0%" },
          { label: t("Terme", "Term"), value: t("15 ans", "15 yrs") },
          { label: t("Mensualité", "Monthly"), value: fmtCurrency(Math.round(leaseMonthly)) },
          { label: t("Total", "Total"), value: fmtCurrency(Math.round(leaseMonthly * leaseTermMonths)) },
        ]
      },
    ];

    slideHtmls.push(wrapSlide(`
      <h2>${t("OPTIONS D'ACQUISITION", "ACQUISITION OPTIONS")}</h2>
      <div style="display:flex;gap:24px;margin-top:24px;">
        ${columns.map(col => `
          <div style="flex:1;border-radius:12px;padding:28px;${col.highlighted ? 'border:3px solid var(--accent);background:#FFFDF5;' : 'background:var(--light-gray);'}">
            <div style="font-size:24px;font-weight:700;color:var(--primary);text-align:center;margin-bottom:12px;">${col.title}</div>
            ${col.badge ? `<div style="background:var(--accent);border-radius:6px;padding:6px 16px;text-align:center;font-size:14px;font-weight:700;color:var(--primary);margin-bottom:16px;">★ ${col.badge}</div>` : ''}
            ${col.rows.map(r => `
              <div style="margin-bottom:16px;">
                <div style="font-size:14px;color:var(--gray);text-align:center;">${r.label}</div>
                <div style="font-size:24px;font-weight:700;color:var(--dark);text-align:center;">${r.value}</div>
              </div>`).join('')}
          </div>`).join('')}
      </div>
      <div style="text-align:center;margin-top:20px;font-size:13px;color:var(--gray);">
        ${t("Les taux présentés sont indicatifs et sujets à approbation de crédit. Consultez votre institution financière.",
          "Rates shown are indicative and subject to credit approval. Consult your financial institution.")}
      </div>
    `, slideOpts));
  }

  // ========== SLIDE 11: ASSUMPTIONS & EXCLUSIONS ==========
  {
    const assumptions = getAssumptions(lang, isSyntheticData);
    const exclusions = getExclusions(lang);

    slideHtmls.push(wrapSlide(`
      <h2>${t("HYPOTHÈSES ET EXCLUSIONS", "ASSUMPTIONS & EXCLUSIONS")}</h2>
      <div style="display:flex;gap:40px;margin-top:24px;">
        <div style="flex:1.2;">
          <table class="data-table">
            <thead><tr>
              <th>${t("Hypothèse", "Assumption")}</th>
              <th>${t("Valeur", "Value")}</th>
            </tr></thead>
            <tbody>
              ${assumptions.map(a => `<tr><td>${a.label}</td><td style="font-weight:600;color:var(--primary);">${a.value}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div style="flex:0.8;">
          <div style="font-size:22px;font-weight:700;color:var(--red);margin-bottom:16px;">${t("EXCLUSIONS", "EXCLUSIONS")}</div>
          ${exclusions.map(excl => `
            <div style="display:flex;align-items:flex-start;margin-bottom:12px;">
              <span style="color:var(--red);font-weight:700;margin-right:10px;font-size:18px;">&#x2717;</span>
              <span style="font-size:15px;color:var(--dark);">${excl}</span>
            </div>`).join('')}
        </div>
      </div>
    `, slideOpts));
  }

  // ========== SLIDE 12: TIMELINE ==========
  {
    const dynamicTimeline = options?.constructionTimeline;
    const timelineItems = (dynamicTimeline && dynamicTimeline.length > 0)
      ? dynamicTimeline.map(tl => ({ step: tl.step, duration: tl.duration }))
      : getTimeline(lang).map(tl => ({ step: tl.step, duration: tl.duration }));
    const total = timelineItems.length;

    slideHtmls.push(wrapSlide(`
      <h2>${t("ÉCHÉANCIER TYPE", "TYPICAL TIMELINE")}</h2>
      <div style="display:flex;align-items:center;gap:0;margin-top:60px;justify-content:center;">
        ${timelineItems.map((tl, i) => {
          const gradC = TIMELINE_GRADIENT_PPTX.getStepColor(i, total);
          const bg = `#${gradC.bg}`;
          const txt = `#${gradC.text}`;
          const arrow = i < total - 1 ? `<div style="font-size:36px;color:var(--accent);margin:0 4px;">&#9654;</div>` : '';
          return `
            <div style="background:${bg};border-radius:10px;padding:20px 16px;min-width:160px;max-width:220px;text-align:center;">
              <div style="font-size:16px;font-weight:700;color:${txt};margin-bottom:8px;">${tl.step}</div>
              ${tl.duration ? `<div style="font-size:14px;color:${txt};opacity:0.8;">${tl.duration}</div>` : ''}
            </div>
            ${arrow}`;
        }).join('')}
      </div>
      <div style="text-align:center;margin-top:40px;font-size:14px;color:var(--gray);">
        ${t("Délais sujets à approbation Hydro-Québec et conditions météorologiques",
          "Timelines subject to Hydro-Québec approval and weather conditions")}
      </div>
    `, slideOpts));
  }

  // ========== SLIDE 14: SYSTEM & EQUIPMENT (merged) ==========
  {
    const hasBattery = simulation.battEnergyKWh > 0;
    const eqList = getEquipment(lang);
    const techSummary2 = getEquipmentTechnicalSummary(lang);
    const battEq = hasBattery ? getBatteryEquipment(lang) : null;

    // Flow diagram boxes
    const flowBoxes = [
      { label: t("Panneaux solaires", "Solar Panels"), detail: formatSmartPower(simulation.pvSizeKW, lang), color: "var(--accent)", textColor: "var(--dark)" },
      { label: t("Onduleur(s)", "Inverter(s)"), detail: "DC → AC", color: "var(--primary)", textColor: "white" },
    ];
    if (hasBattery) {
      flowBoxes.push({ label: t("Batterie BESS", "BESS Battery"), detail: `${formatSmartEnergy(simulation.battEnergyKWh, lang)}`, color: "#059669", textColor: "white" });
    }
    flowBoxes.push(
      { label: t("Charges", "Building Loads"), detail: formatSmartEnergy(simulation.annualConsumptionKWh, lang) + t("/an", "/yr"), color: "var(--dark)", textColor: "white" },
      { label: t("Réseau HQ", "HQ Grid"), detail: t("Surplus / Appoint", "Surplus / Backup"), color: "#d1d5db", textColor: "var(--dark)" },
    );

    const flowHtml = flowBoxes.map((b, i) => {
      const arrow = i < flowBoxes.length - 1 ? `<div style="font-size:28px;color:var(--accent);margin:0 6px;">&#9654;</div>` : '';
      return `<div style="background:${b.color};border-radius:10px;padding:12px 16px;text-align:center;min-width:120px;">
        <div style="font-size:14px;font-weight:700;color:${b.textColor};">${b.label}</div>
        <div style="font-size:11px;color:${b.textColor};opacity:0.85;margin-top:2px;">${b.detail}</div>
      </div>${arrow}`;
    }).join('');

    // Component table with certifications
    const allEquip = [...eqList.map(e => ({ name: e.label, mfg: e.manufacturer, spec: e.specs || "—", warranty: e.warranty, certs: e.certifications || [] }))];
    if (battEq) {
      allEquip.push({ name: battEq.label, mfg: battEq.manufacturer, spec: battEq.specs || "—", warranty: battEq.warranty, certs: [] });
    }

    const eqRows = allEquip.map(e => `<tr>
      <td>${e.name}</td><td>${e.mfg}</td><td>${e.spec}</td>
      <td style="font-weight:700;color:var(--primary);">${e.warranty}</td>
      <td>${e.certs.length > 0 ? e.certs.map(c => `<span style="background:rgba(0,61,166,0.08);color:var(--primary);font-size:10px;padding:2px 6px;border-radius:10px;margin-right:4px;">${c}</span>`).join('') : '—'}</td>
    </tr>`).join('');

    // Operating modes
    const modes = [
      { icon: "&#9728;", title: t("Autoconsommation", "Self-consumption"), desc: t("Production → charges", "Production → loads") },
    ];
    if (hasBattery) {
      modes.push({ icon: "&#128267;", title: t("Écrêtage", "Peak Shaving"), desc: t("Batterie réduit la pointe", "Battery reduces peak") });
    }
    modes.push({ icon: "&#128228;", title: t("Injection", "Export"), desc: t("Surplus → HQ", "Surplus → HQ grid") });

    slideHtmls.push(wrapSlide(`
      <h2>${t("SYSTÈME ET ÉQUIPEMENT", "SYSTEM & EQUIPMENT")}</h2>
      <div style="display:flex;align-items:center;justify-content:center;margin-top:12px;gap:0;">
        ${flowHtml}
      </div>
      <table class="data-table" style="margin-top:16px;font-size:13px;">
        <thead><tr>
          <th>${t("Composant", "Component")}</th>
          <th>${t("Fabricant", "Manufacturer")}</th>
          <th>${t("Spécification", "Specification")}</th>
          <th>${t("Garantie", "Warranty")}</th>
          <th>${t("Certifications", "Certifications")}</th>
        </tr></thead>
        <tbody>${eqRows}</tbody>
      </table>
      <div style="display:flex;gap:16px;margin-top:14px;">
        <div style="flex:1;">
          <div style="display:flex;gap:12px;">
            ${modes.map(m => `
              <div style="flex:1;background:var(--light-gray);border-radius:8px;padding:12px;">
                <div style="font-size:13px;font-weight:700;color:var(--primary);margin-bottom:2px;">${m.icon} ${m.title}</div>
                <div style="font-size:11px;color:var(--gray);">${m.desc}</div>
              </div>`).join('')}
          </div>
        </div>
        <div style="flex:1;background:rgba(0,61,166,0.04);border:1px solid rgba(0,61,166,0.12);border-radius:8px;padding:14px;">
          <div style="font-size:13px;font-weight:700;color:var(--primary);margin-bottom:8px;">
            ${t("Données structurelles", "Structural Data")}
          </div>
          <div style="font-size:14px;">
            <span style="font-weight:600;">${t("Charge totale", "Total Load")}:</span>
            <span style="font-weight:700;color:var(--accent);margin-left:6px;">${techSummary2.totalSystemWeightKgPerM2.value} kg/m² / ${techSummary2.totalSystemWeightPsfPerSf.value} ${t('lb/p²', 'lb/sf')}</span>
          </div>
          <div style="font-size:11px;color:var(--gray);margin-top:4px;">
            ${t(`Panneaux ${techSummary2.panelWeightKgPerM2.value} kg/m² + Structure ${techSummary2.rackingWeightKgPerM2.value} kg/m²`,
              `Panels ${techSummary2.panelWeightKgPerM2.value} kg/m² + Racking ${techSummary2.rackingWeightKgPerM2.value} kg/m²`)}
          </div>
          <div style="font-size:11px;color:var(--gray);margin-top:4px;">
            ${techSummary2.windLoadDesign} | ${techSummary2.snowLoadNote}
          </div>
        </div>
      </div>
      <div style="text-align:center;margin-top:8px;font-size:11px;color:var(--gray);">
        ${t("Équipement indicatif — confirmé dans la soumission forfaitaire", "Indicative equipment — confirmed in the firm quote")}
      </div>
    `, slideOpts));
  }

  // ========== SLIDE 15: DELIVERY ASSURANCE ==========
  {
    const milestones = getDeliveryAssurance(lang);
    const partners = getDeliveryPartners(lang);
    const roadmap = getWarrantyRoadmap(lang);

    const milestoneRows = milestones.map(m => `<tr>
      <td style="font-weight:600;color:var(--primary);">${m.phase}</td>
      <td>${m.duration}</td>
      <td style="font-size:13px;">${m.deliverables.join(", ")}</td>
      <td style="color:var(--green);font-weight:600;">&#10003; ${m.qaCheckpoint}</td>
    </tr>`).join('');

    const partnerCards = partners.map(p => `
      <div style="flex:1;background:var(--light-gray);border-radius:8px;padding:14px;text-align:center;">
        <div style="font-size:14px;font-weight:700;color:var(--primary);">${p.role}</div>
        <div style="font-size:13px;color:var(--dark);margin-top:4px;">${p.name}</div>
        <div style="font-size:11px;color:var(--gray);margin-top:2px;">${p.qualification}</div>
      </div>`).join('');

    const roadmapCards = roadmap.map((r, i) => {
      const isLast = i === roadmap.length - 1;
      return `<div style="flex:1;background:${isLast ? 'var(--primary)' : 'var(--light-gray)'};border-radius:8px;padding:14px;text-align:center;">
        <div style="font-size:16px;font-weight:700;color:${isLast ? 'var(--accent)' : 'var(--primary)'};">${r.period}</div>
        <div style="font-size:11px;color:${isLast ? 'rgba(255,255,255,0.9)' : 'var(--gray)'};margin-top:6px;line-height:1.5;">${r.items.join('<br/>')}</div>
      </div>`;
    }).join('');

    slideHtmls.push(wrapSlide(`
      <h2>${t("ASSURANCE DE LIVRAISON", "PROJECT DELIVERY ASSURANCE")}</h2>
      <table class="data-table" style="font-size:13px;margin-top:12px;">
        <thead><tr>
          <th>${t("Phase", "Phase")}</th>
          <th>${t("Durée", "Duration")}</th>
          <th>${t("Livrables", "Deliverables")}</th>
          <th>${t("Contrôle qualité", "QA Checkpoint")}</th>
        </tr></thead>
        <tbody>${milestoneRows}</tbody>
      </table>
      <div style="margin-top:16px;">
        <div style="font-size:18px;font-weight:700;color:var(--primary);margin-bottom:8px;">${t("ÉQUIPE DE LIVRAISON", "DELIVERY TEAM")}</div>
        <div style="display:flex;gap:12px;">${partnerCards}</div>
      </div>
      <div style="margin-top:16px;">
        <div style="font-size:18px;font-weight:700;color:var(--primary);margin-bottom:8px;">${t("PLAN DE SUPPORT ET GARANTIES", "WARRANTY & SUPPORT ROADMAP")}</div>
        <div style="display:flex;gap:12px;">${roadmapCards}</div>
      </div>
      <div style="background:#FFF3CD;border-radius:8px;padding:12px;margin-top:12px;">
        <span style="font-weight:700;color:#856404;">${t("INTERCONNEXION HQ", "HQ INTERCONNECTION")}:</span>
        <span style="color:#856404;font-size:13px;"> ${t("kWh gère le processus complet. Délai typique: 8-16 semaines. Risque faible pour systèmes < 1 MW.", "kWh manages the complete process. Typical delay: 8-16 weeks. Low risk for systems < 1 MW.")}</span>
      </div>
    `, slideOpts));
  }

  // ========== SLIDE 16: FIT SCORE / FEASIBILITY ==========
  {
    const fitResult = computeFitScore({
      simplePaybackYears: simulation.simplePaybackYears,
      irr25: simulation.irr25,
      annualSavings: simulation.annualSavings,
      annualCostBefore: simulation.annualCostBefore,
      selfSufficiencyPercent: simulation.selfSufficiencyPercent,
      capexNet: simulation.capexNet,
    });

    // Individual factor bars — from computeFitScore (single source of truth)
    const factorBars = fitResult.factors.map(f => {
      const pct = f.maxScore > 0 ? (f.score / f.maxScore) * 100 : 0;
      const label = lang === "fr" ? f.labelFr : f.labelEn;
      return `<div style="display:flex;align-items:center;gap:16px;margin-bottom:12px;">
        <div style="width:180px;font-size:15px;color:var(--dark);font-weight:500;">${label}</div>
        <div style="flex:1;height:24px;background:#e5e7eb;border-radius:12px;overflow:hidden;position:relative;">
          <div style="height:100%;width:${pct}%;background:${f.barColor};border-radius:12px;transition:width 0.5s;"></div>
        </div>
        <div style="width:100px;font-size:14px;color:var(--gray);text-align:right;">${f.displayValue}</div>
        <div style="width:60px;font-size:14px;font-weight:700;color:var(--primary);text-align:right;">${f.score}/${f.maxScore}</div>
      </div>`;
    }).join('');

    const fitLabel = lang === "fr" ? fitResult.labelFr : fitResult.labelEn;

    const verdictText = fitResult.level === "excellent" || fitResult.level === "bon"
      ? t(
          "Ce bâtiment présente un potentiel solaire favorable. Nous recommandons de procéder à la validation technique sur site.",
          "This building shows favorable solar potential. We recommend proceeding with on-site technical validation."
        )
      : t(
          "Le potentiel nécessite une validation approfondie. Le projet peut rester pertinent pour des raisons non financières.",
          "The potential requires deeper validation. The project may still be relevant for non-financial reasons."
        );

    slideHtmls.push(wrapSlide(`
      <h2>${t("ÉVALUATION DE FAISABILITÉ", "FEASIBILITY ASSESSMENT")}</h2>
      <div style="display:flex;gap:40px;margin-top:16px;">
        <div style="flex:0 0 260px;text-align:center;">
          <div style="width:200px;height:200px;border-radius:50%;border:8px solid ${fitResult.color};display:flex;flex-direction:column;align-items:center;justify-content:center;margin:0 auto;">
            <div style="font-size:64px;font-weight:700;color:${fitResult.color};">${fitResult.score}</div>
            <div style="font-size:18px;color:var(--gray);">/ 100</div>
          </div>
          <div style="font-size:22px;font-weight:700;color:${fitResult.color};margin-top:12px;">${fitLabel}</div>
        </div>
        <div style="flex:1;">
          <div style="font-size:20px;font-weight:700;color:var(--primary);margin-bottom:16px;">${t("CRITÈRES D'ÉVALUATION", "EVALUATION CRITERIA")}</div>
          ${factorBars}
        </div>
      </div>
      <div style="background:${fitResult.color};border-radius:12px;padding:20px;margin-top:20px;">
        <div style="font-size:16px;font-weight:700;color:white;margin-bottom:4px;">${t("VERDICT", "VERDICT")}</div>
        <div style="font-size:14px;color:white;">${verdictText}</div>
      </div>
    `, slideOpts));
  }

  // ========== SLIDE 17: ROOF CONFIGURATION ==========
  {
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

    const totalProductionKWhRoof = (simulation as any).totalProductionKWh || Math.round(simulation.annualConsumptionKWh * simulation.selfSufficiencyPercent / 100);
    const roofSummary = [
      { label: t("Puissance solaire", "Solar capacity"), value: formatSmartPower(simulation.pvSizeKW, lang) },
      { label: t("Stockage", "Storage"), value: simulation.battEnergyKWh > 0 ? formatSmartEnergy(simulation.battEnergyKWh, lang) : t("Non inclus", "N/A") },
      { label: t("Production An 1", "Year-1 production"), value: formatSmartEnergy(totalProductionKWhRoof || 0, lang) },
      { label: t("Autosuffisance solaire", "Solar self-sufficiency"), value: `${(simulation.selfSufficiencyPercent || 0).toFixed(0)}%` },
    ];

    const polyTable = (options?.roofPolygons && options.roofPolygons.length > 0)
      ? `<table class="data-table" style="margin-top:20px;font-size:14px;">
          <thead><tr><th>Zone</th><th>m²</th><th>${t("Orient.", "Orient.")}</th></tr></thead>
          <tbody>${options.roofPolygons.map((p, i) => `
            <tr><td>${p.label || `Zone ${i + 1}`}</td><td>${Math.round(p.areaSqM)}</td><td>${orientLabel(p.orientation)}</td></tr>`).join('')}
          </tbody>
        </table>` : '';

    slideHtmls.push(wrapSlide(`
      <h2>${t("CONFIGURATION TOITURE", "ROOF CONFIGURATION")}</h2>
      <div style="display:flex;gap:40px;margin-top:20px;">
        <div style="flex:1.4;display:flex;align-items:center;justify-content:center;">
          ${roofBase64
            ? `<img src="${roofBase64}" style="max-width:100%;max-height:580px;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.1);" />`
            : `<div style="display:flex;align-items:center;justify-content:center;height:400px;color:var(--gray);font-size:18px;">${t("Image satellite non disponible", "Satellite image not available")}</div>`
          }
        </div>
        <div style="flex:0.8;">
          <div style="background:var(--light-gray);border-radius:12px;padding:24px;">
            <div style="font-size:20px;font-weight:700;color:var(--primary);margin-bottom:16px;">${t("DIMENSIONNEMENT", "SIZING SUMMARY")}</div>
            ${roofSummary.map(item => `
              <div style="margin-bottom:16px;">
                <div style="font-size:14px;color:var(--gray);">${item.label}</div>
                <div style="font-size:22px;font-weight:700;color:var(--primary);">${item.value}</div>
              </div>`).join('')}
          </div>
          ${polyTable}
        </div>
      </div>
    `, slideOpts));
  }

  // ========== SLIDE 15: NEXT STEPS ==========
  {
    const designCovers = getDesignFeeCovers(lang);
    const clientProvides = getClientProvides(lang);
    const clientReceives = getClientReceives(lang);

    const dataOptionsHtml = isSyntheticData ? `
      <div style="display:flex;gap:24px;margin-top:20px;">
        <div style="flex:1;background:#F0FDF4;border:2px solid #BBF7D0;border-radius:12px;padding:20px;">
          <div style="font-size:18px;font-weight:700;color:var(--green);margin-bottom:8px;">${t("Option A — Procuration (2 min)", "Option A — Authorization (2 min)")}</div>
          <div style="font-size:14px;color:var(--dark);margin-bottom:8px;">${t("Signez en ligne et nous nous occupons de tout.", "Sign online and we handle everything.")}</div>
          <div style="font-size:14px;color:var(--primary);text-decoration:underline;">kwh.quebec/analyse-detaillee</div>
        </div>
        <div style="flex:1;background:#EFF6FF;border:2px solid #BFDBFE;border-radius:12px;padding:20px;">
          <div style="font-size:18px;font-weight:700;color:var(--primary);margin-bottom:8px;">${t("Option B — Téléchargement CSV (~30 min)", "Option B — CSV Download (~30 min)")}</div>
          <div style="font-size:14px;color:var(--dark);margin-bottom:8px;">${t("Téléchargez vos fichiers depuis l'Espace Client Hydro-Québec.", "Download your files from Hydro-Québec's Online Portal.")}</div>
          <div style="font-size:14px;color:var(--primary);text-decoration:underline;">${t("Voir le guide étape par étape", "See the step-by-step guide")}</div>
        </div>
      </div>` : `
      <div style="background:var(--accent);border-radius:8px;padding:16px;text-align:center;margin-top:20px;">
        <div style="font-size:20px;font-weight:700;color:var(--primary);">${getDesignMandatePrice(lang)}</div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;">
        ${getDesignMandateIncludes(lang).slice(0, 4).map(item => `<div style="font-size:13px;color:var(--dark);">✓ ${item}</div>`).join('')}
      </div>`;

    const ctaText = isSyntheticData
      ? t("Gratuit et sans engagement — Résultat en 7 jours ouvrables", "Free and without commitment — Results within 7 business days")
      : t("Signez votre mandat de conception en ligne", "Sign your design mandate online");

    slideHtmls.push(wrapSlide(`
      <h2>${t("PASSONS À L'ACTION", "LET'S TAKE ACTION")}</h2>
      <div class="subtitle">
        ${isSyntheticData
          ? t("Les incitatifs actuels couvrent jusqu'à 60% de votre projet — ces programmes peuvent changer à tout moment.",
              "Current incentives cover up to 60% of your project — these programs can change at any time.")
          : t("Votre analyse est complétée. La prochaine étape: signer le mandat de conception.",
              "Your analysis is complete. Next step: sign the design mandate.")}
      </div>
      <div style="display:flex;gap:16px;margin-top:12px;">
        <div style="flex:1;background:var(--primary);border-radius:8px;padding:12px 16px;">
          <div style="font-size:16px;font-weight:700;color:white;margin-bottom:8px;">${t("Le Design Fee couvre", "The design fee covers")}</div>
          ${designCovers.map(item => `<div style="font-size:13px;color:rgba(255,255,255,0.9);margin-bottom:4px;">✓ ${item}</div>`).join('')}
        </div>
        <div style="flex:1;background:var(--accent);border-radius:8px;padding:12px 16px;">
          <div style="font-size:16px;font-weight:700;color:var(--dark);margin-bottom:8px;">${t("Le client fournit", "The client provides")}</div>
          ${clientProvides.map(item => `<div style="font-size:13px;color:var(--dark);margin-bottom:4px;">□ ${item}</div>`).join('')}
        </div>
        <div style="flex:1;background:var(--green);border-radius:8px;padding:12px 16px;">
          <div style="font-size:16px;font-weight:700;color:white;margin-bottom:8px;">${t("Le client reçoit", "The client receives")}</div>
          ${clientReceives.map(item => `<div style="font-size:13px;color:rgba(255,255,255,0.9);margin-bottom:4px;">→ ${item}</div>`).join('')}
        </div>
      </div>
      ${dataOptionsHtml}
      <div style="background:var(--primary);border-radius:8px;padding:16px;text-align:center;margin-top:16px;">
        <div style="font-size:18px;font-weight:700;color:white;">${ctaText}</div>
        <div style="font-size:14px;color:var(--accent);margin-top:4px;">info@kwh.quebec | 514.427.8871 | www.kwh.quebec</div>
      </div>
    `, slideOpts));
  }

  // ========== SLIDE 16: WHY kWh QUÉBEC ==========
  {
    const credStats = getAllStats(lang);
    const contact = getContactString();
    const credDesc = lang === "fr"
      ? "Notre &eacute;quipe accompagne les entreprises partout au Canada dans leurs projets d'&eacute;nergie renouvelable depuis 2011."
      : "Our team has been supporting businesses across Canada in renewable energy projects since 2011.";
    const valuesData = [
      { fr: "Simplicit&eacute;", en: "Simplicity" },
      { fr: "Fiabilit&eacute;", en: "Reliability" },
      { fr: "Long&eacute;vit&eacute;", en: "Longevity" },
      { fr: "Fiert&eacute;", en: "Pride" },
    ];
    const benefitsData = lang === "fr"
      ? ["Licence RBQ", "Financement flexible", "Garantie 25 ans", "Partout au Qu&eacute;bec"]
      : ["RBQ Licensed", "Flexible Financing", "25-Year Warranty", "Across Quebec"];

    slideHtmls.push(wrapSlide(`
      <h2>${getTitle("trustUs", lang)}</h2>
      <div style="display:flex;justify-content:center;gap:80px;margin-top:24px;">
        ${credStats.map(stat => `
          <div style="text-align:center;">
            <div style="font-size:52px;font-weight:700;color:var(--primary);">${stat.value}</div>
            <div style="font-size:16px;color:var(--gray);">${stat.label}</div>
          </div>`).join('')}
      </div>
      <div style="font-size:18px;color:var(--dark);text-align:center;margin-top:24px;line-height:1.5;">
        ${credDesc}
      </div>
      <div style="display:flex;justify-content:center;gap:48px;margin-top:28px;">
        ${valuesData.map(v => `
          <div style="text-align:center;padding:16px 24px;background:#F7F9FC;border-radius:10px;min-width:160px;">
            <div style="font-size:20px;font-weight:700;color:var(--primary);">${lang === "fr" ? v.fr : v.en}</div>
          </div>`).join('')}
      </div>
      <div style="display:flex;justify-content:center;gap:24px;margin-top:24px;flex-wrap:wrap;">
        ${benefitsData.map(b => `<div style="font-size:14px;color:var(--gray);padding:8px 16px;border:1px solid #E5E7EB;border-radius:6px;">${b}</div>`).join('')}
      </div>
      <div style="background:var(--primary);border-radius:8px;padding:20px;text-align:center;margin-top:32px;">
        <div style="font-size:20px;font-weight:700;color:var(--accent);">${contact}</div>
      </div>
    `, slideOpts));
  }

  // ========== RENDER SLIDES WITH PUPPETEER ==========
  log.info(`Rendering ${slideHtmls.length} slides with Puppeteer...`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    const slideImages: Buffer[] = [];

    for (let i = 0; i < slideHtmls.length; i++) {
      log.info(`Rendering slide ${i + 1}/${slideHtmls.length}...`);
      await page.setContent(slideHtmls[i], { waitUntil: "networkidle0", timeout: 30000 });
      await page.waitForFunction(() => document.fonts.ready, { timeout: 10000 }).catch(() => {});
      const screenshot = await page.screenshot({ type: "png", fullPage: false });
      slideImages.push(screenshot as Buffer);
    }

    await browser.close();
    browser = null;

    // ========== ASSEMBLE PPTX ==========
    log.info("Assembling PPTX from slide images...");
    const pptx = new PptxGenJS();
    pptx.author = "kWh Québec";
    pptx.company = "kWh Québec";
    pptx.title = `${t("Étude solaire", "Solar Study")} - ${simulation.site.name}`;
    pptx.subject = t("Proposition commerciale solaire + stockage", "Solar + Storage Commercial Proposal");
    pptx.defineLayout({ name: "WIDE", width: 13.33, height: 7.5 });
    pptx.layout = "WIDE";

    for (const imgBuffer of slideImages) {
      const slide = pptx.addSlide();
      slide.addImage({
        data: `data:image/png;base64,${imgBuffer.toString("base64")}`,
        x: 0, y: 0, w: "100%", h: "100%",
      });
    }

    const pptxData = await pptx.write({ outputType: "nodebuffer" });
    log.info("PPTX generation complete.");
    return pptxData as Buffer;
  } catch (error) {
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }
    log.error("PPTX generation failed:", error);
    throw error;
  }
}
