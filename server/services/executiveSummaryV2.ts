import puppeteer from "puppeteer";
import * as path from "path";
import * as fs from "fs";
import type { DocumentSimulationData } from "../documentDataProvider";
import { createLogger } from "../lib/logger";
import { computeFitScore } from "@shared/fitScore";

const log = createLogger("ExecSummaryV2");

function loadImageAsBase64(filePath: string): string | null {
  try {
    if (fs.existsSync(filePath)) {
      const buf = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mime = ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
      return `data:${mime};base64,${buf.toString("base64")}`;
    }
  } catch (e) {
    log.error(`Failed to load image: ${filePath}`, e);
  }
  return null;
}

function fmt(num: number | null | undefined, locale = "fr-CA"): string {
  if (num === null || num === undefined || isNaN(num)) return "0";
  return new Intl.NumberFormat(locale).format(Math.round(num));
}

function smartCur(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "0 $";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M $`;
  if (abs >= 10_000) return `${sign}${Math.round(abs / 1000)}k $`;
  return `${sign}${Math.round(abs).toLocaleString("fr-CA")} $`;
}

export async function generateExecutiveSummaryV2(
  simulation: DocumentSimulationData,
  lang: "fr" | "en"
): Promise<Buffer> {
  const t = (fr: string, en: string) => (lang === "fr" ? fr : en);

  const logoPath = path.join(process.cwd(), "client", "public", "assets", lang === "fr" ? "logo-fr.png" : "logo-en.png");
  const logoBase64 = loadImageAsBase64(logoPath);

  simulation.annualCostBefore = simulation.annualCostBefore || 0;
  simulation.annualCostAfter = simulation.annualCostAfter || 0;
  simulation.incentivesHQSolar = simulation.incentivesHQSolar || 0;
  simulation.incentivesHQBattery = simulation.incentivesHQBattery || 0;
  simulation.taxShield = simulation.taxShield || 0;
  simulation.totalExportedKWh = simulation.totalExportedKWh || 0;
  simulation.annualSurplusRevenue = simulation.annualSurplusRevenue || 0;
  simulation.savingsYear1 = simulation.savingsYear1 || simulation.annualSavings || 0;
  simulation.simplePaybackYears = simulation.simplePaybackYears || 0;
  simulation.selfSufficiencyPercent = simulation.selfSufficiencyPercent || 0;
  simulation.peakDemandKW = simulation.peakDemandKW || 0;
  simulation.demandShavingSetpointKW = simulation.demandShavingSetpointKW || 0;
  simulation.battEnergyKWh = simulation.battEnergyKWh || 0;
  simulation.battPowerKW = simulation.battPowerKW || 0;
  simulation.capexGross = simulation.capexGross || 0;
  simulation.capexNet = simulation.capexNet || 0;
  simulation.incentivesFederal = simulation.incentivesFederal || 0;
  simulation.incentivesHQ = simulation.incentivesHQ || 0;
  simulation.annualSavings = simulation.annualSavings || 0;
  simulation.pvSizeKW = simulation.pvSizeKW || 0;
  simulation.annualConsumptionKWh = simulation.annualConsumptionKWh || 0;
  simulation.totalIncentives = simulation.totalIncentives || 0;
  simulation.npv25 = simulation.npv25 || 0;
  simulation.irr25 = simulation.irr25 || 0;
  simulation.lcoe = simulation.lcoe || 0;
  simulation.co2AvoidedTonnesPerYear = simulation.co2AvoidedTonnesPerYear || 0;

  const fitResult = computeFitScore({
    simplePaybackYears: simulation.simplePaybackYears || null,
    irr25: simulation.irr25 || null,
    annualSavings: simulation.annualSavings || null,
    annualCostBefore: simulation.annualCostBefore || null,
    selfSufficiencyPercent: simulation.selfSufficiencyPercent || null,
    capexNet: simulation.capexNet || null,
  });
  const fitLabel = lang === "fr" ? fitResult.labelFr : fitResult.labelEn;

  const hasHourlyProfile = !!(simulation.hourlyProfile && simulation.hourlyProfile.length > 0);
  const isSyntheticData = typeof simulation.isSynthetic === "boolean" ? simulation.isSynthetic : !hasHourlyProfile;

  const date = new Date().toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA", { year: "numeric", month: "long", day: "numeric" });
  const address = [simulation.site.address, simulation.site.city, simulation.site.province].filter(Boolean).join(", ");
  const co2Annual = simulation.co2AvoidedTonnesPerYear;
  const co2Over25 = co2Annual * 25;

  const totalIncentive = simulation.totalIncentives + simulation.taxShield;
  const hqPct = totalIncentive > 0 ? Math.round((simulation.totalIncentives / totalIncentive) * 100) : 50;
  const taxPct = 100 - hqPct;

  const watermarkLabel = t("&Eacute;TUDE PR&Eacute;LIMINAIRE", "PRELIMINARY STUDY");
  const bodyClass = isSyntheticData ? ' class="synthetic"' : "";
  const watermarkAttr = isSyntheticData ? ` data-watermark="${watermarkLabel}"` : "";

  const logoHtml = logoBase64
    ? `<img src="${logoBase64}" style="max-width: 130px; height: auto;" />`
    : `<span style="font-size: 16pt; font-weight: 700; color: var(--primary);">kWh Qu&eacute;bec</span>`;

  const syntheticBanner = isSyntheticData
    ? `<div class="synthetic-banner">
        <strong>&#9888; ${t("Donn&eacute;es synth&eacute;tiques", "Synthetic data")}</strong> &mdash; ${t(
          "Analyse bas&eacute;e sur des donn&eacute;es synth&eacute;tiques (type et taille du b&acirc;timent). Procuration ou CSV requis pour une analyse r&eacute;aliste.",
          "Analysis based on synthetic data (building type and size). Power of attorney or CSV download required for a realistic analysis."
        )}
      </div>`
    : "";

  const ctaContent = isSyntheticData
    ? `<div class="cta-box">
        <h3 style="font-size: 11pt; margin-bottom: 2mm;">${t("Prochaines &eacute;tapes", "Next Steps")}</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; text-align: left; margin-bottom: 3mm;">
          <div style="background: rgba(255,255,255,0.12); border-radius: 2mm; padding: 3mm;">
            <strong style="font-size: 9pt;">Option A &mdash; ${t("Procuration", "Power of Attorney")}</strong>
            <p style="font-size: 7.5pt; margin: 1mm 0 0 0; opacity: 0.85;">${t(
              "Autorisez-nous &agrave; obtenir vos donn&eacute;es 15 min d'Hydro-Qu&eacute;bec.",
              "Authorize us to obtain your 15-min data from Hydro-Qu&eacute;bec."
            )}</p>
            <p style="font-size: 7pt; margin-top: 1mm; opacity: 0.7;">kwh.quebec/analyse-detaillee</p>
          </div>
          <div style="background: rgba(255,255,255,0.12); border-radius: 2mm; padding: 3mm;">
            <strong style="font-size: 9pt;">Option B &mdash; ${t("T&eacute;l&eacute;charger CSV", "Download CSV")}</strong>
            <p style="font-size: 7.5pt; margin: 1mm 0 0 0; opacity: 0.85;">${t(
              "T&eacute;l&eacute;chargez vos donn&eacute;es depuis votre Espace client HQ.",
              "Download your data from your HQ Customer Portal."
            )}</p>
            <p style="font-size: 7pt; margin-top: 1mm; opacity: 0.7;">kwh.quebec/blog/telecharger-donnees-espace-client-hydro-quebec</p>
          </div>
        </div>
        <p style="font-size: 8pt; margin: 0;">info@kwh.quebec &nbsp;|&nbsp; 514.427.8871 &nbsp;|&nbsp; www.kwh.quebec</p>
      </div>`
    : `<div class="cta-box">
        <h3 style="font-size: 11pt; margin-bottom: 2mm;">${t("Prochaine &eacute;tape", "Next Step")}</h3>
        <p style="font-size: 9pt; margin-bottom: 2mm;">${t(
          "Signez votre mandat de conception en ligne pour d&eacute;marrer votre projet solaire.",
          "Sign your design mandate online to start your solar project."
        )}</p>
        <p style="font-size: 8pt; margin: 0;">info@kwh.quebec &nbsp;|&nbsp; 514.427.8871 &nbsp;|&nbsp; www.kwh.quebec</p>
      </div>`;

  const pvLabel = simulation.pvSizeKW >= 1000
    ? `${(simulation.pvSizeKW / 1000).toFixed(1)} MWc`
    : `${Math.round(simulation.pvSizeKW)} kWc`;

  const battLabel = simulation.battEnergyKWh > 0
    ? (simulation.battEnergyKWh >= 1000
      ? `${(simulation.battEnergyKWh / 1000).toFixed(1)} MWh`
      : `${Math.round(simulation.battEnergyKWh)} kWh`)
    : t("Aucune", "None");

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<style>
${getStyles()}
</style>
</head>
<body${bodyClass}>
<div class="page"${watermarkAttr}>

  <!-- HEADER -->
  <div class="header">
    <div class="header-logo">${logoHtml}</div>
    <div class="header-date">${date}</div>
  </div>
  <div class="accent-line"></div>

  <!-- TITLE -->
  <h1>${t("R&Eacute;SUM&Eacute; EX&Eacute;CUTIF", "EXECUTIVE SUMMARY")}</h1>
  <p class="subtitle">${t("&Eacute;tude Pr&eacute;liminaire Solaire + Stockage", "Preliminary Solar + Storage Study")}</p>

  <!-- SYNTHETIC BANNER -->
  ${syntheticBanner}

  <!-- SITE INFO -->
  <div class="site-info-box">
    <div class="site-name">${simulation.site.name}</div>
    <div class="site-address">${address || t("Adresse non sp&eacute;cifi&eacute;e", "Address not specified")}</div>
    ${simulation.site.client?.name ? `<div class="site-client">${simulation.site.client.name}</div>` : ""}
  </div>

  <!-- KPI CARDS -->
  <div class="metrics-grid-4">
    <div class="metric-card metric-highlight">
      <span class="metric-value">${pvLabel}</span>
      <span class="metric-label">${t("PUISSANCE PV", "PV POWER")}</span>
    </div>
    <div class="metric-card">
      <span class="metric-value">${battLabel}</span>
      <span class="metric-label">${t("BATTERIE", "BATTERY")}</span>
    </div>
    <div class="metric-card metric-accent">
      <span class="metric-value">${smartCur(simulation.savingsYear1)}</span>
      <span class="metric-label">${t("&Eacute;CONOMIES AN 1", "SAVINGS YR 1")}</span>
    </div>
    <div class="metric-card metric-accent">
      <span class="metric-value">${smartCur(simulation.npv25)}</span>
      <span class="metric-label">${t("VAN 25 ANS", "NPV 25 YRS")}</span>
    </div>
  </div>

  <!-- FINANCIAL HIGHLIGHTS -->
  <h3>${t("INDICATEURS FINANCIERS", "FINANCIAL HIGHLIGHTS")}</h3>
  <table class="data-table">
    <tbody>
      <tr>
        <td>${t("Investissement brut", "Gross investment")}</td>
        <td class="number">${smartCur(simulation.capexGross)}</td>
        <td>${t("TRI (25 ans)", "IRR (25 years)")}</td>
        <td class="number">${(simulation.irr25 * 100).toFixed(1)} %</td>
      </tr>
      <tr>
        <td>${t("Subventions totales", "Total incentives")}</td>
        <td class="number">${smartCur(simulation.totalIncentives)}</td>
        <td>${t("Retour simple", "Simple payback")}</td>
        <td class="number">${simulation.simplePaybackYears.toFixed(1)} ${t("ans", "yrs")}</td>
      </tr>
      <tr>
        <td>${t("Investissement net", "Net investment")}</td>
        <td class="number">${smartCur(simulation.capexNet)}</td>
        <td>LCOE</td>
        <td class="number">${simulation.lcoe.toFixed(2)} &cent;/kWh</td>
      </tr>
      <tr>
        <td>${t("Bouclier fiscal", "Tax shield")}</td>
        <td class="number">${smartCur(simulation.taxShield)}</td>
        <td>${t("Autosuffisance", "Self-sufficiency")}</td>
        <td class="number">${Math.round(simulation.selfSufficiencyPercent)} %</td>
      </tr>
    </tbody>
  </table>

  <!-- INCENTIVES BAR -->
  <h3>${t("SUBVENTIONS ET INCITATIFS", "INCENTIVES & SUBSIDIES")}</h3>
  <div class="incentives-section">
    <div class="incentive-bar-wrapper">
      <div class="incentive-bar">
        <div class="incentive-bar-hq" style="width: ${hqPct}%;"></div>
        <div class="incentive-bar-tax" style="width: ${taxPct}%;"></div>
      </div>
      <span class="incentive-total">${smartCur(totalIncentive)}</span>
    </div>
    <div class="legend">
      <div class="legend-item">
        <div class="legend-dot" style="background: var(--primary);"></div>
        <span>Hydro-Qu&eacute;bec: ${smartCur(simulation.totalIncentives)}</span>
      </div>
      <div class="legend-item">
        <div class="legend-dot" style="background: #16a34a;"></div>
        <span>${t("Bouclier fiscal", "Tax shield")}: ${smartCur(simulation.taxShield)}</span>
      </div>
    </div>
  </div>

  <!-- ENVIRONMENTAL IMPACT -->
  <h3>${t("IMPACT ENVIRONNEMENTAL", "ENVIRONMENTAL IMPACT")}</h3>
  <div class="env-grid">
    <div class="metric-card env-card">
      <span class="metric-value" style="color: #16a34a;">${co2Annual.toFixed(1)}</span>
      <span class="metric-label">${t("tonnes CO&#8322;/an", "tonnes CO&#8322;/yr")}</span>
    </div>
    <div class="metric-card env-card">
      <span class="metric-value" style="color: #16a34a;">${fmt(co2Over25)}</span>
      <span class="metric-label">${t("tonnes CO&#8322; sur 25 ans", "tonnes CO&#8322; over 25 yrs")}</span>
    </div>
  </div>

  <!-- FIT SCORE -->
  <h3>${t("POTENTIEL SOLAIRE", "SOLAR POTENTIAL")}</h3>
  <div style="display: flex; align-items: center; gap: 5mm; padding: 3mm 4mm; border-radius: 2mm; border: 0.5pt solid ${fitResult.color}22; background: ${fitResult.color}08;">
    <div style="width: 14mm; height: 14mm; border-radius: 50%; border: 2pt solid ${fitResult.color}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
      <span style="font-size: 12pt; font-weight: 700; color: ${fitResult.color};">${fitResult.score}</span>
    </div>
    <div style="flex: 1;">
      <div style="font-weight: 600; font-size: 9pt; color: ${fitResult.color}; margin-bottom: 1mm;">${fitLabel} &mdash; ${fitResult.score}/100</div>
      <div style="display: flex; gap: 3mm; flex-wrap: wrap;">
        ${fitResult.factors.map(f => {
          const label = lang === "fr" ? f.labelFr : f.labelEn;
          return '<span style="font-size: 7pt; color: #666;"><span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:' + f.barColor + '; margin-right:1mm;"></span>' + label + ': ' + f.displayValue + '</span>';
        }).join('')}
      </div>
    </div>
  </div>

  <!-- CTA -->
  ${ctaContent}

  <!-- FOOTER -->
  <div class="page-footer">
    <span>kWh Qu&eacute;bec &mdash; ${t("&Eacute;tude Pr&eacute;liminaire", "Preliminary Study")}</span>
    <span>Page 1</span>
  </div>

</div>
</body>
</html>`;

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
  } catch (err) {
    log.error("Failed to launch Puppeteer browser:", err);
    throw new Error("PDF generation failed: Could not launch browser");
  }

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 60000 });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return Buffer.from(pdfBuffer);
  } catch (err) {
    log.error("Failed to generate executive summary PDF:", err);
    throw err;
  } finally {
    await browser.close();
  }
}

function getStyles(): string {
  return `
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap');
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Montserrat', 'Helvetica Neue', Arial, sans-serif;
  font-size: 8.5pt; line-height: 1.35; color: #2A2A2B; background: white;
}
:root {
  --primary: #003DA6; --primary-light: #1a5fc7; --secondary: #002D7A;
  --accent: #FFB005; --accent-light: #FFD060;
  --dark: #2A2A2B; --gray: #6b7280; --light-gray: #f3f4f6; --white: #ffffff;
}
.page {
  width: 210mm; height: 297mm;
  padding: 12mm 15mm 14mm 15mm;
  position: relative; overflow: hidden; background: white;
}
.header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 2mm;
}
.header-logo img { max-width: 130px; height: auto; }
.header-date { font-size: 8pt; color: var(--gray); }
.accent-line {
  height: 2px; background: var(--accent); margin-bottom: 4mm;
}
h1 {
  font-family: 'Montserrat', sans-serif; font-size: 20pt; font-weight: 700;
  color: var(--primary); margin-bottom: 1mm; line-height: 1.1;
}
h3 {
  font-family: 'Montserrat', sans-serif; font-size: 9pt; font-weight: 700;
  color: var(--primary); margin-bottom: 2mm; margin-top: 3mm;
  text-transform: uppercase; letter-spacing: 0.3px;
}
.subtitle {
  font-size: 10pt; color: var(--gray); margin-bottom: 3mm;
}
.synthetic-banner {
  background: #FEF3C7; border: 1.5px solid #F59E0B; border-radius: 2mm;
  padding: 2.5mm 4mm; margin-bottom: 3mm;
  font-size: 7.5pt; color: #92400E; line-height: 1.4;
}
.synthetic-banner strong { color: #B45309; }
.site-info-box {
  background: #E8F0F8; border-radius: 2.5mm; padding: 3mm 5mm; margin-bottom: 3mm;
}
.site-name {
  font-size: 11pt; font-weight: 700; color: var(--primary); margin-bottom: 1mm;
}
.site-address { font-size: 8pt; color: var(--gray); }
.site-client { font-size: 8pt; color: var(--dark); margin-top: 0.5mm; }
.metrics-grid-4 {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin: 3mm 0;
}
.metric-card {
  background: var(--light-gray); border-radius: 2.5mm; padding: 4mm 3mm;
  text-align: center;
}
.metric-value {
  font-size: 16pt; font-weight: 700; color: var(--primary);
  display: block; line-height: 1.1; margin-bottom: 1mm;
}
.metric-label {
  font-size: 7pt; color: var(--gray); letter-spacing: 0.4px;
  text-transform: uppercase;
}
.metric-highlight { background: var(--primary); color: white; }
.metric-highlight .metric-value { color: white; }
.metric-highlight .metric-label { color: rgba(255,255,255,0.8); }
.metric-accent { background: var(--accent); color: var(--dark); }
.metric-accent .metric-value { color: var(--dark); }
.metric-accent .metric-label { color: rgba(0,0,0,0.6); }
.data-table {
  width: 100%; border-collapse: collapse; margin: 2mm 0; font-size: 8pt;
}
.data-table td {
  padding: 1.8mm 3mm; border-bottom: 1px solid #e5e7eb;
}
.data-table tr:nth-child(even) { background: var(--light-gray); }
.data-table .number {
  text-align: right; font-weight: 600; font-family: 'Montserrat', monospace;
  white-space: nowrap;
}
.data-table td:nth-child(1),
.data-table td:nth-child(3) { color: var(--gray); }
.data-table td:nth-child(2),
.data-table td:nth-child(4) { color: var(--dark); font-weight: 600; }
.data-table td:nth-child(3) { padding-left: 8mm; }
.incentives-section { margin: 2mm 0 3mm 0; }
.incentive-bar-wrapper {
  display: flex; align-items: center; gap: 3mm;
}
.incentive-bar {
  flex: 1; height: 5mm; border-radius: 1.5mm; overflow: hidden;
  display: flex; background: #e5e7eb;
}
.incentive-bar-hq { background: var(--primary); }
.incentive-bar-tax { background: #16a34a; }
.incentive-total {
  font-size: 10pt; font-weight: 700; color: var(--dark); white-space: nowrap;
}
.legend {
  display: flex; gap: 6mm; margin-top: 1.5mm; font-size: 7.5pt; color: var(--gray);
}
.legend-item { display: flex; align-items: center; gap: 1.5mm; }
.legend-dot { width: 2.5mm; height: 2.5mm; border-radius: 50%; }
.env-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin: 2mm 0;
}
.env-card {
  background: #f0fdf4; border: 1px solid #bbf7d0;
}
.cta-box {
  background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
  color: white; border-radius: 3mm; padding: 4mm 5mm; text-align: center;
  margin-top: 3mm;
}
.cta-box h3 { color: white; margin: 0 0 2mm 0; text-transform: none; letter-spacing: 0; }
.cta-box p { color: rgba(255,255,255,0.9); font-size: 8pt; }
.page-footer {
  position: absolute; bottom: 8mm; left: 15mm; right: 15mm;
  display: flex; justify-content: space-between;
  font-size: 7pt; color: var(--gray);
  border-top: 1px solid #e5e7eb; padding-top: 2mm;
}
body.synthetic .page::after {
  content: attr(data-watermark);
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%) rotate(-35deg);
  font-size: 52pt; font-weight: 700; font-family: 'Montserrat', sans-serif;
  color: rgba(0,61,166,0.06); white-space: nowrap;
  pointer-events: none; z-index: 999; letter-spacing: 2px;
}
@media print {
  .page { page-break-after: auto; page-break-inside: avoid; }
}`;
}
