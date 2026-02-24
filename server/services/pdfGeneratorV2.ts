import puppeteer from "puppeteer";
import * as path from "path";
import * as fs from "fs";
import type { DocumentSimulationData } from "../documentDataProvider";
import { createLogger } from "../lib/logger";
import { getWhySolarNow, getEquipmentTechnicalSummary, getExclusions, getEquipment, getBatteryEquipment, getTimeline, getCredibilityDescription, getDeliveryAssurance, getDeliveryPartners, getWarrantyRoadmap } from "@shared/brandContent";
import { computeAcquisitionCashflows, type CumulativePoint } from "./acquisitionCashflows";
import { computeFitScore, type FitScoreInput } from "@shared/fitScore";

const log = createLogger("PDFv2");

function loadImageAsBase64(filePath: string): string | null {
  try {
    if (fs.existsSync(filePath)) {
      const buf = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mime = ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".webp" ? "image/webp" : "image/png";
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

function cur(amount: number | null | undefined, locale = "fr-CA"): string {
  if (amount === null || amount === undefined || isNaN(amount)) return "0 $";
  return `${Math.round(amount).toLocaleString(locale)} $`;
}

function smartCur(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "0 $";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M $`;
  if (abs >= 10_000) return `${sign}${Math.round(abs / 1000)}k $`;
  return `${sign}${Math.round(abs).toLocaleString("fr-CA")} $`;
}

function orientationLabel(azimuth: number | undefined, lang: "fr" | "en"): string {
  if (azimuth === undefined) return lang === "fr" ? "N/D" : "N/A";
  const dirs = lang === "fr"
    ? ["N", "NE", "E", "SE", "S", "SO", "O", "NO"]
    : ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const idx = Math.round(((azimuth % 360) + 360) % 360 / 45) % 8;
  return `${dirs[idx]} (${Math.round(azimuth)})`;
}

const MONTHLY_DISTRIBUTION = [0.04, 0.055, 0.085, 0.10, 0.115, 0.125, 0.13, 0.115, 0.095, 0.07, 0.04, 0.03];

export async function generateProfessionalPDFv2(
  simulation: DocumentSimulationData,
  lang: "fr" | "en",
  _siteSimulations?: DocumentSimulationData[]
): Promise<Buffer> {
  const t = (fr: string, en: string) => (lang === "fr" ? fr : en);

  const logoPath = path.join(process.cwd(), "client", "public", "assets", lang === "fr" ? "logo-fr-white.png" : "logo-en-white.png");
  const logoBase64 = loadImageAsBase64(logoPath);

  const coverImagePath = path.join(process.cwd(), "attached_assets", "kWh__Quebec_Brand_Guideline_1764967501349.jpg");
  const coverImageBase64 = loadImageAsBase64(coverImagePath);

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

  let roofImageBase64: string | null = null;
  if (simulation.roofVisualizationBuffer) {
    roofImageBase64 = `data:image/png;base64,${simulation.roofVisualizationBuffer.toString("base64")}`;
  }

  const totalProductionKWh = (simulation as any).totalProductionKWh || Math.round(simulation.annualConsumptionKWh * simulation.selfSufficiencyPercent / 100);

  const hasHourlyProfile = !!(simulation.hourlyProfile && simulation.hourlyProfile.length > 0);
  const isSyntheticData = typeof simulation.isSynthetic === 'boolean' ? simulation.isSynthetic : !hasHourlyProfile;
  const hasBattery = simulation.battEnergyKWh > 0;
  const hasRoofPolygons = !!(simulation.roofPolygons && simulation.roofPolygons.length > 0);

  let pageNum = 1;
  function nextPage(): number { return pageNum++; }

  const pages: string[] = [];

  pages.push(buildCoverPage(simulation, t, logoBase64, coverImageBase64, lang, isSyntheticData));
  nextPage();

  pages.push(buildWhySolarNowPage(t, lang, nextPage()));
  pages.push(buildProjectSnapshotPage(simulation, t, totalProductionKWh, roofImageBase64, nextPage(), isSyntheticData));
  pages.push(buildResultsPage(simulation, t, totalProductionKWh, nextPage()));
  pages.push(buildNetInvestmentPage(simulation, t, nextPage()));

  if (hasHourlyProfile) {
    pages.push(buildEnergyProfilePage(simulation, t, totalProductionKWh, nextPage(), isSyntheticData));
  }

  if (hasBattery) {
    pages.push(buildStoragePage(simulation, t, nextPage()));
  }

  pages.push(buildFinancialProjectionsPage(simulation, t, totalProductionKWh, nextPage()));

  pages.push(buildEquipmentPage(simulation, t, lang, nextPage()));
  pages.push(buildDeliveryAssurancePage(t, lang, nextPage()));
  pages.push(buildFitScorePage(simulation, t, lang, nextPage()));
  pages.push(buildAssumptionsPage(simulation, t, lang, isSyntheticData, nextPage()));
  pages.push(buildNextStepsPage(simulation, t, isSyntheticData, nextPage()));
  pages.push(buildCredibilityPage(t, lang, nextPage()));

  const watermarkLabel = t("\u00c9TUDE PR\u00c9LIMINAIRE", "PRELIMINARY STUDY");
  const bodyClass = isSyntheticData ? ' class="synthetic"' : '';

  const pagesHtml = isSyntheticData
    ? pages.map(p => {
        if (p.includes('cover-page')) return p;
        return p.replace('<div class="page"', `<div class="page" data-watermark="${watermarkLabel}"`);
      }).join("\n")
    : pages.join("\n");

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${t("Rapport", "Report")} - ${simulation.site.name}</title>
<style>${getStyles()}</style>
</head>
<body${bodyClass}>
${pagesHtml}
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
    console.error("[PDFv2] Failed to launch Puppeteer browser:", err);
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
    console.error("[PDFv2] Failed to generate PDF:", err);
    throw err;
  } finally {
    await browser.close();
  }
}

function getStyles(): string {
  return `
* { margin: 0; padding: 0; box-sizing: border-box; }
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap');
body {
  font-family: 'Montserrat', 'Helvetica Neue', Arial, sans-serif;
  font-size: 11pt; line-height: 1.4; color: #2A2A2B; background: white;
}
:root {
  --primary: #003DA6; --primary-light: #1a5fc7; --secondary: #002D7A;
  --accent: #FFB005; --accent-light: #FFD060;
  --dark: #2A2A2B; --gray: #6b7280; --light-gray: #f3f4f6; --white: #ffffff;
}
.page {
  width: 210mm; min-height: 297mm; max-height: 297mm;
  padding: 15mm 20mm; page-break-after: always; page-break-inside: avoid;
  position: relative; overflow: hidden; background: white;
}
.page:last-child { page-break-after: auto; }
h1 { font-family: 'Montserrat', sans-serif; font-size: 28pt; font-weight: 700; color: var(--primary); margin-bottom: 10mm; }
h2 { font-family: 'Montserrat', sans-serif; font-size: 20pt; font-weight: 600; color: var(--primary); margin-bottom: 6mm; padding-bottom: 2mm; border-bottom: 2px solid var(--accent); }
h3 { font-family: 'Montserrat', sans-serif; font-size: 14pt; font-weight: 600; color: var(--dark); margin-bottom: 4mm; }
p { margin-bottom: 3mm; color: var(--dark); }
.subtitle { font-size: 14pt; color: var(--gray); margin-bottom: 8mm; }
.cover-page {
  background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
  color: white; display: flex; flex-direction: column; justify-content: space-between; padding: 25mm;
  background-size: cover; background-position: center;
}
.cover-page h1 { color: white; font-size: 36pt; border: none; }
.cover-logo { width: 80mm; margin-bottom: 20mm; }
.cover-logo img { max-width: 200px; height: auto; }
.cover-title { font-size: 42pt; font-weight: 700; margin-bottom: 5mm; font-family: 'Montserrat', sans-serif; }
.cover-subtitle { font-size: 18pt; opacity: 0.9; margin-bottom: 30mm; }
.cover-project-name {
  font-size: 24pt; font-weight: 600; padding: 8mm 0;
  border-top: 2px solid rgba(255,255,255,0.3); border-bottom: 2px solid rgba(255,255,255,0.3);
}
.cover-footer { display: flex; justify-content: space-between; font-size: 10pt; opacity: 0.8; }
.cover-overlay {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,20,60,0.65); z-index: 0;
}
.cover-content { position: relative; z-index: 1; display: flex; flex-direction: column; justify-content: space-between; height: 100%; }
.metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5mm; margin: 8mm 0; }
.metrics-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4mm; margin: 6mm 0; }
.metric-card { background: var(--light-gray); border-radius: 3mm; padding: 6mm; text-align: center; }
.metric-value { font-size: 24pt; font-weight: 700; color: var(--primary); display: block; }
.metric-label { font-size: 9pt; color: var(--gray); letter-spacing: 0.5px; }
.metric-highlight { background: var(--primary); color: white; }
.metric-highlight .metric-value { color: white; }
.metric-highlight .metric-label { color: rgba(255,255,255,0.8); }
.metric-accent { background: var(--accent); color: var(--dark); }
.metric-accent .metric-value { color: var(--dark); }
.metric-accent .metric-label { color: rgba(0,0,0,0.6); }
.data-table { width: 100%; border-collapse: collapse; margin: 5mm 0; font-size: 9pt; }
.data-table th { background: var(--primary); color: white; padding: 3mm 4mm; text-align: left; font-weight: 600; }
.data-table td { padding: 2.5mm 4mm; border-bottom: 1px solid #e5e7eb; }
.data-table tr:nth-child(even) { background: var(--light-gray); }
.data-table .number { text-align: right; font-family: 'Courier New', monospace; }
.data-table .total-row { background: var(--primary) !important; color: white; font-weight: 700; }
.chart-container { background: var(--light-gray); border-radius: 3mm; padding: 5mm; margin: 5mm 0; min-height: 40mm; }
.chart-title { font-size: 11pt; font-weight: 600; color: var(--dark); margin-bottom: 3mm; }
.charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }
.section { margin-bottom: 8mm; page-break-inside: avoid; }
.two-column { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
.three-column { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5mm; }
.info-box { background: var(--light-gray); border-radius: 3mm; padding: 5mm; margin: 4mm 0; }
.info-box.highlight { background: var(--primary); color: white; }
.info-box.accent { background: var(--accent); color: var(--dark); }
.bullet-list { list-style: none; padding-left: 0; margin-left: 0; }
.bullet-list li { padding: 2mm 0 2mm 9mm; position: relative; }
.bullet-list li::before { content: ''; position: absolute; left: 1mm; top: 50%; transform: translateY(-50%); width: 3mm; height: 3mm; background: var(--accent); border-radius: 1px; }
.pillar-card { background: white; border: 2px solid var(--light-gray); border-radius: 3mm; padding: 5mm; text-align: center; }
.pillar-icon { width: 28px; height: 28px; margin: 0 auto 2mm auto; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.pillar-title { font-size: 11pt; font-weight: 700; color: var(--primary); margin-bottom: 2mm; }
.pillar-desc { font-size: 8pt; color: var(--gray); margin: 0; }
.legend { display: flex; gap: 8mm; margin: 3mm 0; font-size: 9pt; }
.legend-item { display: flex; align-items: center; gap: 2mm; }
.legend-dot { width: 3mm; height: 3mm; border-radius: 50%; }
.page-footer {
  position: absolute; bottom: 10mm; left: 20mm; right: 20mm;
  display: flex; justify-content: space-between;
  font-size: 8pt; color: var(--gray);
  border-top: 1px solid #e5e7eb; padding-top: 3mm;
}
.timeline { position: relative; padding-left: 15mm; }
.timeline::before { content: ''; position: absolute; left: 5mm; top: 0; bottom: 0; width: 2px; background: var(--primary); }
.timeline-item { position: relative; margin-bottom: 8mm; }
.timeline-item::before { content: ''; position: absolute; left: -12mm; top: 1mm; width: 4mm; height: 4mm; background: var(--accent); border-radius: 50%; }
.timeline-week { font-size: 10pt; font-weight: 700; color: var(--primary); }
.timeline-title { font-size: 11pt; font-weight: 600; margin: 1mm 0; }
.timeline-desc { font-size: 9pt; color: var(--gray); }
.logo-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5mm; margin: 3mm 0; }
.logo-item { background: #ffffff; border: 0.5px solid #e5e7eb; border-radius: 3mm; padding: 4mm; display: flex; align-items: center; justify-content: center; min-height: 16mm; font-size: 8pt; color: var(--gray); font-weight: 600; }
.cta-box { background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%); color: white; border-radius: 4mm; padding: 8mm; text-align: center; margin: 8mm 0; }
.cta-box h3 { color: white; font-size: 16pt; margin-bottom: 3mm; }
.cta-box p { color: rgba(255,255,255,0.9); font-size: 11pt; }
.funnel-steps { display: grid; grid-template-columns: repeat(5, 1fr); gap: 3mm; margin: 5mm 0; }
.funnel-step { text-align: center; padding: 3mm 2mm; border-radius: 3mm; }
.funnel-step-number { width: 8mm; height: 8mm; background: var(--accent); color: var(--dark); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 11pt; margin: 0 auto 2mm auto; }
.funnel-step-title { font-size: 8.5pt; font-weight: 600; color: var(--primary); margin-bottom: 1.5mm; }
.funnel-step-desc { font-size: 7pt; color: var(--gray); }
.funnel-step-tag { display: inline-block; background: var(--accent); color: var(--dark); font-size: 6.5pt; font-weight: 600; padding: 0.8mm 2mm; border-radius: 2mm; margin-top: 1.5mm; }
.funnel-step-tag.paid { background: var(--light-gray); color: var(--gray); }
.svg-chart { width: 100%; }
body.synthetic .page:not(.cover-page)::after {
  content: attr(data-watermark);
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%) rotate(-35deg);
  font-size: 52pt; font-weight: 700; font-family: 'Montserrat', sans-serif;
  color: rgba(0,61,166,0.06); white-space: nowrap;
  pointer-events: none; z-index: 999; letter-spacing: 2px;
}
.synthetic-banner {
  background: #FEF3C7; border: 2px solid #F59E0B; border-radius: 3mm;
  padding: 4mm 6mm; margin-top: 6mm;
  font-size: 9pt; color: #92400E; line-height: 1.5;
}
.synthetic-banner strong { color: #B45309; }
.partner-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 3mm; margin-bottom: 4mm; }
.partner-card { background: #f3f4f6; border: 1px solid #E5E7EB; border-radius: 2mm; padding: 3mm; text-align: center; }
.warranty-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin-bottom: 4mm; }
.warranty-card { background: #f3f4f6; border: 1px solid #E5E7EB; border-radius: 2mm; padding: 3mm; text-align: center; }
.warranty-card.final { background: #003DA6; border: none; color: white; }
.score-circle { width: 40mm; height: 40mm; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 0 auto; }
.factor-row { display: flex; align-items: center; gap: 3mm; margin-bottom: 2mm; }
.factor-label { width: 35mm; font-size: 9pt; font-weight: 500; color: #4a5568; }
.factor-bar { flex: 1; height: 5mm; background: #e5e7eb; border-radius: 2mm; overflow: hidden; }
.factor-bar-fill { height: 100%; border-radius: 2mm; }
.factor-value { width: 15mm; text-align: right; font-size: 8pt; color: #6b7280; }
.factor-score { width: 12mm; text-align: right; font-size: 9pt; font-weight: 700; color: #003DA6; }
.cert-badge { display: inline-block; background: rgba(0,61,166,0.08); color: #003DA6; font-size: 7pt; padding: 1px 4px; border-radius: 8px; margin: 1px; }
@media print {
  .page { page-break-after: always; page-break-inside: avoid; }
  .page:last-child { page-break-after: auto; }
  .section { page-break-inside: avoid; }
}`;
}

function footerHtml(t: (fr: string, en: string) => string, pageNum: number): string {
  return `<div class="page-footer">
    <span>kWh Qu&eacute;bec &mdash; ${t("&Eacute;tude Pr&eacute;liminaire", "Preliminary Study")}</span>
    <span>Page ${pageNum}</span>
  </div>`;
}

function buildCoverPage(
  sim: DocumentSimulationData,
  t: (fr: string, en: string) => string,
  logoBase64: string | null,
  coverImageBase64: string | null,
  lang: string,
  isSyntheticData: boolean = false
): string {
  const date = new Date().toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA", { year: "numeric", month: "long", day: "numeric" });
  const locationText = [sim.site.city, sim.site.province || "QC"].filter(Boolean).join(", ");

  const logoHtml = logoBase64
    ? `<img src="${logoBase64}" style="max-width: 200px; height: auto;" />`
    : `<svg width="220" height="70" viewBox="0 0 220 70">
        <text x="0" y="45" fill="white" font-size="36" font-weight="bold" font-family="Montserrat, sans-serif">kWh</text>
        <text x="0" y="65" fill="#FFB005" font-size="18" font-weight="600" font-family="Montserrat, sans-serif">Qu&eacute;bec</text>
      </svg>`;

  const bgStyle = coverImageBase64
    ? `background-image: url('${coverImageBase64}'); background-size: cover; background-position: center;`
    : `background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);`;

  return `
  <div class="page cover-page" style="${bgStyle} padding: 0;">
    <div class="cover-overlay"></div>
    <div class="cover-content" style="padding: 25mm;">
      <div>
        <div class="cover-logo">${logoHtml}</div>
        <div class="cover-title">${t("&Eacute;tude Pr&eacute;liminaire", "Preliminary Study")}</div>
        <div class="cover-subtitle">${t("Solaire + Stockage", "Solar + Storage")}</div>
      </div>
      <div>
        <div class="cover-project-name">${sim.site.name}</div>
        <p style="color: rgba(255,255,255,0.8); font-size: 12pt; margin-top: 4mm;">${locationText || "Qu&eacute;bec"}</p>
        ${sim.site.client?.name ? `<p style="color: rgba(255,255,255,0.7); font-size: 11pt; margin-top: 8mm;">${t("Pr&eacute;par&eacute; pour:", "Prepared for:")} <strong style="color: white;">${sim.site.client.name}</strong></p>` : ""}
      </div>
      <div>
        <div class="cover-footer">
          <span>${t("Pr&eacute;par&eacute; le", "Prepared on")} ${date}</span>
          <span>kwh.quebec</span>
        </div>
        ${isSyntheticData ? `<div class="synthetic-banner" style="background: rgba(254,243,199,0.95); border-color: rgba(245,158,11,0.8); margin-top: 48mm;">
          <strong>&#9888; ${t("Donn&eacute;es synth&eacute;tiques", "Synthetic data")}</strong> &mdash; ${t(
            "Cette analyse est bas&eacute;e sur des donn&eacute;es synth&eacute;tiques g&eacute;n&eacute;r&eacute;es &agrave; partir du type et de la taille du b&acirc;timent s&eacute;lectionn&eacute;s. Une procuration ou un t&eacute;l&eacute;chargement CSV est requis pour obtenir vos donn&eacute;es de consommation r&eacute;elles et fournir une analyse r&eacute;aliste.",
            "This analysis is based on synthetic data generated from the selected building type and size. A power of attorney or CSV download is required to obtain your actual consumption data and provide a realistic analysis."
          )}
        </div>` : ""}
      </div>
    </div>
  </div>`;
}


function buildWhySolarNowPage(
  t: (fr: string, en: string) => string,
  lang: "fr" | "en",
  pageNum: number
): string {
  const content = getWhySolarNow(lang);

  const beforeItems = content.beforeReasons.map(r =>
    `<li style="padding: 1.5mm 0 1.5mm 6mm; position: relative; font-size: 8.5pt;">
      <span style="position: absolute; left: 0; top: 50%; transform: translateY(-50%); color: #DC2626; font-weight: 700;">&#x2717;</span>
      ${r}
    </li>`
  ).join("");

  const nowItems = content.nowReasons.map(r =>
    `<li style="padding: 1.5mm 0 1.5mm 6mm; position: relative; font-size: 8.5pt;">
      <span style="position: absolute; left: 0; top: 50%; transform: translateY(-50%); color: #16A34A; font-weight: 700;">&#x2713;</span>
      ${r}
    </li>`
  ).join("");

  const mythsHtml = content.winterMyths.map(m =>
    `<div style="margin-bottom: 3mm;">
      <p style="margin: 0; font-size: 8.5pt; color: #DC2626; text-decoration: line-through;">
        <span style="font-weight: 700;">&#x2717;</span> ${m.myth}
      </p>
      <p style="margin: 0.5mm 0 0 0; font-size: 8pt; color: #2A2A2B;">
        <span style="color: #16A34A; font-weight: 700;">&#x2713;</span> ${m.reality}
      </p>
    </div>`
  ).join("");

  return `
  <div class="page">
    <h2>${content.sectionTitle}</h2>
    <div class="two-column" style="margin-bottom: 5mm;">
      <div class="info-box">
        <h3 style="color: #DC2626; margin-bottom: 2mm; font-size: 11pt;">${content.beforeTitle}</h3>
        <ul class="bullet-list" style="list-style: none; padding-left: 0;">
          ${beforeItems}
        </ul>
      </div>
      <div class="info-box">
        <h3 style="color: #16A34A; margin-bottom: 2mm; font-size: 11pt;">${content.nowTitle}</h3>
        <ul class="bullet-list" style="list-style: none; padding-left: 0;">
          ${nowItems}
        </ul>
      </div>
    </div>
    <div class="section">
      <h3 style="color: #003DA6; margin-bottom: 1mm;">${content.winterTitle}</h3>
      <p class="subtitle" style="font-size: 9pt; color: #6b7280; margin-bottom: 4mm;">${content.winterSubtitle}</p>
      ${mythsHtml}
    </div>
    ${footerHtml(t, pageNum)}
  </div>`;
}

function buildProjectSnapshotPage(
  sim: DocumentSimulationData,
  t: (fr: string, en: string) => string,
  totalProductionKWh: number,
  roofImageBase64: string | null,
  pageNum: number,
  isSyntheticData: boolean = false
): string {
  const co2Total25yr = sim.co2AvoidedTonnesPerYear * 25;
  const co2Trees = Math.round((co2Total25yr * 1000) / 21.77);
  const co2Cars = Math.round((co2Total25yr / 4.6));

  const roofPolygons = sim.roofPolygons || [];
  const totalRoofAreaSqM = roofPolygons.reduce((s, p) => s + (p.areaSqM || 0), 0);
  const zoneCount = roofPolygons.filter(p => !p.label || !p.label.toLowerCase().includes("contrainte")).length;
  const constraintPolygons = roofPolygons.filter(p => p.label && p.label.toLowerCase().includes("contrainte"));
  const constraintAreaSqM = constraintPolygons.reduce((s, p) => s + (p.areaSqM || 0), 0);
  const capacityKW = sim.pvSizeKW || 0;
  const siteName = sim.site.name || "";
  const siteAddress = sim.site.address || "";

  const hasOverlayData = totalRoofAreaSqM > 0 || capacityKW > 0;

  const legendHtml = hasOverlayData ? `
    <div style="position: absolute; top: 8px; left: 8px; display: flex; flex-direction: column; gap: 4px; z-index: 2;">
      <div style="display: flex; align-items: center; gap: 4px; background: rgba(0,0,0,0.55); border-radius: 3px; padding: 2px 6px;">
        <div style="width: 8px; height: 8px; background: #3b82f6; border-radius: 1px;"></div>
        <span style="color: white; font-size: 7pt;">${t("Panneaux solaires", "Solar panels")}</span>
      </div>
      ${zoneCount > 0 ? `<div style="display: flex; align-items: center; gap: 4px; background: rgba(0,0,0,0.55); border-radius: 3px; padding: 2px 6px;">
        <div style="width: 8px; height: 8px; border: 1.5px solid #22c55e; border-radius: 1px;"></div>
        <span style="color: white; font-size: 7pt;">${zoneCount} ${t("zones unifi&eacute;es", "unified zones")}</span>
      </div>` : ""}
      ${constraintPolygons.length > 0 ? `<div style="display: flex; align-items: center; gap: 4px; background: rgba(0,0,0,0.55); border-radius: 3px; padding: 2px 6px;">
        <div style="width: 8px; height: 8px; background: #f97316; border-radius: 1px;"></div>
        <span style="color: white; font-size: 7pt;">${t("Contraintes", "Constraints")}</span>
      </div>` : ""}
    </div>
  ` : "";

  const badgesHtml = hasOverlayData ? `
    <div style="position: absolute; bottom: 40px; right: 8px; display: flex; gap: 6px; z-index: 2;">
      ${totalRoofAreaSqM > 0 ? `<div style="background: #16a34a; color: white; border-radius: 3px; padding: 3px 8px; font-size: 7pt; font-weight: 600; display: flex; align-items: center; gap: 3px;">
        &#9651; ${fmt(Math.round(totalRoofAreaSqM))} m&sup2; ${t("net utilisable", "net usable")}
      </div>` : ""}
      ${constraintAreaSqM > 0 ? `<div style="background: #dc2626; color: white; border-radius: 3px; padding: 3px 8px; font-size: 7pt; font-weight: 600; display: flex; align-items: center; gap: 3px;">
        &#9650; -${fmt(Math.round(constraintAreaSqM))} m&sup2; ${t("contraintes", "constraints")}
      </div>` : ""}
      ${capacityKW > 0 ? `<div style="background: #003DA6; color: white; border-radius: 3px; padding: 3px 8px; font-size: 7pt; font-weight: 600; display: flex; align-items: center; gap: 3px;">
        &#9889; ${fmt(capacityKW)} kWc
      </div>` : ""}
    </div>
  ` : "";

  const siteInfoOverlay = (siteName || siteAddress) ? `
    <div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 60%, transparent 100%); padding: 16px 12px 8px; z-index: 1; border-radius: 0 0 2mm 2mm;">
      ${siteName ? `<div style="color: white; font-size: 12pt; font-weight: 700; line-height: 1.2;">${siteName}</div>` : ""}
      ${siteAddress ? `<div style="color: rgba(255,255,255,0.85); font-size: 8pt; margin-top: 2px;">${siteAddress}</div>` : ""}
    </div>
  ` : "";

  const satelliteHtml = roofImageBase64
    ? `<div style="position: relative; width: 100%; height: 75mm; border-radius: 2mm; overflow: hidden;">
        <img src="${roofImageBase64}" style="width: 100%; height: 100%; object-fit: cover;" />
        ${legendHtml}
        ${badgesHtml}
        ${siteInfoOverlay}
      </div>`
    : `<div style="position: relative; height: 75mm; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); border-radius: 2mm; display: flex; align-items: center; justify-content: center; overflow: hidden;">
        <div style="text-align: center; color: rgba(255,255,255,0.6); font-size: 9pt;">${t("Image satellite non disponible", "Satellite image unavailable")}</div>
        ${legendHtml}
        ${badgesHtml}
        ${siteInfoOverlay}
      </div>`;

  return `
  <div class="page">
    <h2>${t("Aper&ccedil;u du projet", "Project Snapshot")}</h2>
    <div class="metrics-grid">
      <div class="metric-card metric-highlight">
        <span class="metric-label">${t("Puissance syst&egrave;me", "System Power")}</span>
        <span class="metric-value">${fmt(sim.pvSizeKW)} kW</span>
      </div>
      <div class="metric-card">
        <span class="metric-label">${t("Production", "Production")}</span>
        <span class="metric-value">${fmt(totalProductionKWh)} kWh/${t("an", "yr")}</span>
      </div>
      <div class="metric-card">
        <span class="metric-label">${t("Couverture &eacute;nerg&eacute;tique", "Energy Coverage")}</span>
        <span class="metric-value">${Math.round(sim.selfSufficiencyPercent)}%</span>
      </div>
    </div>
    <div class="two-column">
      <div class="section">
        <h3>${t("Informations du site", "Site Information")}</h3>
        <div class="info-box">
          <p><strong>${t("Adresse:", "Address:")}</strong> ${sim.site.address || t("&Agrave; d&eacute;terminer", "To be determined")}</p>
          <p><strong>${t("Consommation annuelle:", "Annual consumption:")}</strong> ${fmt(sim.annualConsumptionKWh)} kWh</p>
          <p><strong>${t("Pointe de demande:", "Peak demand:")}</strong> ${fmt(sim.peakDemandKW)} kW</p>
          ${sim.assumptions ? `<p><strong>${t("Surface toiture:", "Roof area:")}</strong> ${fmt(sim.assumptions.roofAreaSqFt)} pi&sup2;</p>` : ""}
        </div>
      </div>
      <div class="section">
        <h3>${t("Impact environnemental", "Environmental Impact")}</h3>
        <div class="info-box">
          <p><strong>${t("CO2 &eacute;vit&eacute; (25 ans):", "CO2 avoided (25 yr):")}</strong> ${fmt(Math.round(co2Total25yr))} ${t("tonnes", "tonnes")}</p>
          <p><strong>${t("&Eacute;quivalent arbres:", "Equivalent trees:")}</strong> ${fmt(co2Trees)} ${t("arbres", "trees")}</p>
          <p><strong>${t("&Eacute;quivalent voitures:", "Equivalent cars:")}</strong> ${co2Cars} ${t("v&eacute;hicules retir&eacute;s", "vehicles removed")}</p>
        </div>
      </div>
    </div>
    <div class="chart-container">
      <div class="chart-title">${t("Image satellite du site", "Site Satellite Image")}</div>
      ${satelliteHtml}
    </div>
    ${footerHtml(t, pageNum)}
  </div>`;
}

function buildResultsPage(
  sim: DocumentSimulationData,
  t: (fr: string, en: string) => string,
  _totalProductionKWh: number,
  pageNum: number
): string {
  const paybackStr = sim.simplePaybackYears > 0 ? sim.simplePaybackYears.toFixed(1) : "N/A";
  const irr = sim.irr25 > 1 ? sim.irr25.toFixed(1) : (sim.irr25 * 100).toFixed(1);

  return `
  <div class="page">
    <h2>${t("Vos r&eacute;sultats", "Your Results")}</h2>
    <p class="subtitle">${t("Projection sur 25 ans bas&eacute;e sur votre profil de consommation r&eacute;el", "25-year projection based on your actual consumption profile")}</p>
    <div class="metrics-grid">
      <div class="metric-card metric-accent">
        <span class="metric-value">${smartCur(sim.capexNet)}</span>
        <span class="metric-label">${t("Investissement net", "Net Investment")}</span>
      </div>
      <div class="metric-card metric-highlight">
        <span class="metric-value">${smartCur(sim.annualSavings * 25)}</span>
        <span class="metric-label">${t("&Eacute;conomies totales (25 ans)", "Total Savings (25 yrs)")}</span>
      </div>
      <div class="metric-card">
        <span class="metric-value">${paybackStr} ${t("ans", "yrs")}</span>
        <span class="metric-label">${t("P&eacute;riode de r&eacute;cup&eacute;ration", "Payback Period")}</span>
      </div>
    </div>
    <div class="section">
      <h3>${t("Indicateurs financiers cl&eacute;s", "Key Financial Indicators")}</h3>
      <table class="data-table">
        <tr><td>${t("Taux de rendement interne (TRI)", "Internal Rate of Return (IRR)")}</td><td class="number"><strong>${irr}%</strong></td></tr>
        <tr><td>${t("&Eacute;conomies ann&eacute;e 1", "Year 1 Savings")}</td><td class="number">${cur(sim.savingsYear1)}</td></tr>
        <tr><td>${t("&Eacute;conomies annuelles moy.", "Avg. Annual Savings")}</td><td class="number">${cur(sim.annualSavings)}</td></tr>
        <tr><td>${t("Valeur actuelle nette (VAN 25 ans)", "Net Present Value (NPV 25 yrs)")}</td><td class="number"><strong>${cur(sim.npv25)}</strong></td></tr>
        <tr><td>${t("Co&ucirc;t actualis&eacute; de l'&eacute;nergie (LCOE)", "Levelized Cost of Energy (LCOE)")}</td><td class="number">${sim.lcoe > 0 ? sim.lcoe.toFixed(3) : "N/A"} $/kWh</td></tr>
        <tr><td>${t("Co&ucirc;t annuel AVANT solaire", "Annual cost BEFORE solar")}</td><td class="number">${cur(sim.annualCostBefore)}</td></tr>
        <tr><td>${t("Co&ucirc;t annuel APR&Egrave;S solaire", "Annual cost AFTER solar")}</td><td class="number" style="color: #16a34a;">${cur(sim.annualCostAfter)}</td></tr>
      </table>
    </div>
    <div class="info-box highlight">
      <h3 style="color: white; margin-bottom: 2mm;">${t("Ce que &ccedil;a signifie pour vous", "What this means for you")}</h3>
      <p style="color: rgba(255,255,255,0.9); margin: 0;">
        ${t(
          `Gr&acirc;ce aux incitatifs f&eacute;d&eacute;ral (ITC) et provincial (Autoproduction Hydro-Qu&eacute;bec), votre investissement net n'est que de <strong>${smartCur(sim.capexNet)}</strong>, r&eacute;cup&eacute;r&eacute; en <strong>${paybackStr} ans</strong>. Votre syst&egrave;me g&eacute;n&egrave;re ensuite des &eacute;conomies nettes pendant plus de 22 ans.`,
          `Thanks to federal (ITC) and provincial (Hydro-Qu&eacute;bec Self-Production) incentives, your net investment is only <strong>${smartCur(sim.capexNet)}</strong>, recovered in <strong>${paybackStr} years</strong>. Your system then generates net savings for over 22 years.`
        )}
      </p>
    </div>
    ${footerHtml(t, pageNum)}
  </div>`;
}

function generateWaterfallSVG(
  sim: DocumentSimulationData,
  t: (fr: string, en: string) => string
): string {
  const gross = sim.capexGross;
  const itc = sim.incentivesFederal;
  const hq = sim.incentivesHQ;
  const taxShieldVal = sim.taxShield || 0;
  const net = sim.capexNet;
  const maxVal = gross;
  const svgW = 600;
  const svgH = 220;
  const barW = 80;
  const gap = 30;
  const topPad = 30;
  const botPad = 50;
  const chartH = svgH - topPad - botPad;
  const scale = chartH / maxVal;

  const items = [
    { label: t("Co&ucirc;t brut", "Gross Cost"), value: gross, color: "#6B7280", isNeg: false },
    { label: t("Incitatif Hydro-Qu&eacute;bec", "Hydro-Qu&eacute;bec Incentive"), value: hq, color: "#FFB005", isNeg: true },
    { label: t("ITC f&eacute;d&eacute;ral", "Federal ITC"), value: itc, color: "#3B82F6", isNeg: true },
  ];
  if (taxShieldVal > 0) {
    items.push({ label: t("Bouclier fiscal", "Tax Shield"), value: taxShieldVal, color: "#3B82F6", isNeg: true });
  }
  items.push({ label: t("Co&ucirc;t net", "Net Cost"), value: net, color: "#003DA6", isNeg: false });

  const totalW = items.length * barW + (items.length - 1) * gap;
  const startX = (svgW - totalW) / 2;

  let bars = "";
  let runningTop = gross;
  items.forEach((item, i) => {
    const x = startX + i * (barW + gap);
    let barH: number, barY: number;

    if (i === 0) {
      barH = item.value * scale;
      barY = topPad + chartH - barH;
    } else if (i === items.length - 1) {
      barH = item.value * scale;
      barY = topPad + chartH - barH;
    } else {
      barH = item.value * scale;
      barY = topPad + chartH - runningTop * scale;
      runningTop -= item.value;
    }

    bars += `<rect x="${x}" y="${barY}" width="${barW}" height="${Math.max(barH, 2)}" fill="${item.color}" rx="3"/>`;
    const valStr = item.isNeg ? `-${cur(item.value)}` : cur(item.value);
    bars += `<text x="${x + barW / 2}" y="${barY - 5}" text-anchor="middle" font-size="10" font-weight="600" fill="#1F2937">${valStr}</text>`;
    bars += `<text x="${x + barW / 2}" y="${topPad + chartH + 18}" text-anchor="middle" font-size="9" fill="#6b7280">${item.label}</text>`;

    if (item.isNeg && i > 0 && i < items.length - 1) {
      const connY = barY;
      const prevX = startX + (i - 1) * (barW + gap) + barW;
      bars += `<line x1="${prevX}" y1="${connY}" x2="${x}" y2="${connY}" stroke="#d1d5db" stroke-width="1" stroke-dasharray="4,3"/>`;
    }
  });

  return `<svg viewBox="0 0 ${svgW} ${svgH}" class="svg-chart" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
}

function buildNetInvestmentPage(
  sim: DocumentSimulationData,
  t: (fr: string, en: string) => string,
  pageNum: number
): string {
  const waterfallSVG = generateWaterfallSVG(sim, t);

  return `
  <div class="page">
    <h2>${t("Investissement net", "Net Investment")}</h2>
    <p class="subtitle">${t("Votre co&ucirc;t r&eacute;el apr&egrave;s incitatifs fiscaux et subventions", "Your real cost after tax incentives and subsidies")}</p>
    <div class="chart-container" style="padding: 8mm;">
      ${waterfallSVG}
    </div>
    <div class="section">
      <h3>${t("D&eacute;tail des incitatifs", "Incentives Breakdown")}</h3>
      <table class="data-table">
        <tr><th>${t("&Eacute;l&eacute;ment", "Item")}</th><th style="text-align: right;">${t("Montant", "Amount")}</th></tr>
        <tr><td><span style="color: #6B7280; margin-right: 4px;">&#9679;</span>${t("Co&ucirc;t du syst&egrave;me (installation compl&egrave;te cl&eacute; en main)", "System cost (complete turnkey installation)")}</td><td class="number">${cur(sim.capexGross)}</td></tr>
        <tr><td><span style="color: #3B82F6; margin-right: 4px;">&#9679;</span>${t("Cr&eacute;dit d'imp&ocirc;t &agrave; l'investissement f&eacute;d&eacute;ral (ITC)", "Federal Investment Tax Credit (ITC)")}</td><td class="number" style="color: #3B82F6;">-${cur(sim.incentivesFederal)}</td></tr>
        <tr><td><span style="color: #FFB005; margin-right: 4px;">&#9679;</span>${t("Incitatif Hydro-Qu&eacute;bec autoproduction", "Hydro-Qu&eacute;bec Self-Production Incentive")}${sim.incentivesHQSolar > 0 && sim.incentivesHQBattery > 0 ? ` (${t("Solaire", "Solar")}: ${cur(sim.incentivesHQSolar)}, ${t("Batterie", "Battery")}: ${cur(sim.incentivesHQBattery)})` : ""}</td><td class="number" style="color: #FFB005;">-${cur(sim.incentivesHQ)}</td></tr>
        ${sim.taxShield > 0 ? `<tr><td><span style="color: #3B82F6; margin-right: 4px;">&#9679;</span>${t("Bouclier fiscal (amortissement acc&eacute;l&eacute;r&eacute;)", "Tax shield (accelerated depreciation)")}</td><td class="number" style="color: #3B82F6;">-${cur(sim.taxShield)}</td></tr>` : ""}
        <tr class="total-row"><td><span style="color: #003DA6; margin-right: 4px;">&#9679;</span><strong>${t("INVESTISSEMENT NET", "NET INVESTMENT")}</strong></td><td class="number" style="color: #003DA6;"><strong>${cur(sim.capexNet)}</strong></td></tr>
      </table>
    </div>
    <div class="info-box" style="background: #FFF8E1; border-left: 4px solid var(--accent); border-radius: 0;">
      <p style="font-size: 9pt; margin: 0;"><strong>${t("Conditions:", "Conditions:")}</strong> ${t(
        "L'ITC f&eacute;d&eacute;ral s'applique aux projets d'&eacute;nergie propre admissibles (Loi C-69). L'incitatif Hydro-Qu&eacute;bec Autoproduction est plafonn&eacute; &agrave; 1 000 $/kW (max 1 MW) et 40% du CAPEX.",
        "The federal ITC applies to eligible clean energy projects (Bill C-69). The Hydro-Qu&eacute;bec Self-Production incentive is capped at $1,000/kW (max 1 MW) and 40% of CAPEX."
      )}</p>
    </div>
    ${footerHtml(t, pageNum)}
  </div>`;
}

function aggregateHourlyProfile(profile: DocumentSimulationData["hourlyProfile"]) {
  if (!profile || profile.length === 0) return [];
  const byHour: Map<number, { cSum: number; pSum: number; pbSum: number; paSum: number; n: number }> = new Map();
  for (const e of profile) {
    const d = byHour.get(e.hour) || { cSum: 0, pSum: 0, pbSum: 0, paSum: 0, n: 0 };
    d.cSum += e.consumption;
    d.pSum += e.production;
    d.pbSum += e.peakBefore;
    d.paSum += e.peakAfter;
    d.n++;
    byHour.set(e.hour, d);
  }
  const result = [];
  for (let h = 0; h < 24; h++) {
    const d = byHour.get(h);
    if (d && d.n > 0) {
      const consumptionAfter = Math.max(0, (d.cSum - d.pSum) / d.n);
      result.push({
        hour: h,
        kwhBefore: d.cSum / d.n,
        kwhAfter: consumptionAfter,
        kwBefore: d.pbSum / d.n,
        kwAfter: Math.max(0, (d.pbSum / d.n) - (d.pSum / d.n)),
      });
    } else {
      result.push({ hour: h, kwhBefore: 0, kwhAfter: 0, kwBefore: 0, kwAfter: 0 });
    }
  }
  return result;
}

function generateBeforeAfterProfileSVG(
  profile: DocumentSimulationData["hourlyProfile"],
  t: (fr: string, en: string) => string
): string {
  const data = aggregateHourlyProfile(profile);
  if (data.length === 0) return "";

  const maxKwh = Math.max(...data.map(d => Math.max(d.kwhBefore, d.kwhAfter)), 1);
  const maxKw = Math.max(...data.map(d => Math.max(d.kwBefore, d.kwAfter)), 1);
  const svgW = 600;
  const svgH = 220;
  const pad = { top: 20, bottom: 35, left: 50, right: 50 };
  const chartW = svgW - pad.left - pad.right;
  const chartH = svgH - pad.top - pad.bottom;
  const barGroupW = chartW / 24;
  const barW = barGroupW * 0.32;

  let svg = "";

  const niceSteps = (max: number, count: number) => {
    const raw = max / count;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const nice = [1, 2, 5, 10].map(m => m * mag);
    const step = nice.find(s => s >= raw) || raw;
    const steps = [];
    for (let v = 0; v <= max + step * 0.1; v += step) steps.push(Math.round(v));
    return steps;
  };

  const yStepsKwh = niceSteps(maxKwh, 4);
  const yStepsKw = niceSteps(maxKw, 4);
  const topKwh = yStepsKwh[yStepsKwh.length - 1] || maxKwh;
  const topKw = yStepsKw[yStepsKw.length - 1] || maxKw;

  for (const v of yStepsKwh) {
    const y = pad.top + chartH - (v / topKwh) * chartH;
    svg += `<line x1="${pad.left}" y1="${y}" x2="${pad.left + chartW}" y2="${y}" stroke="#e5e7eb" stroke-width="0.5"/>`;
    svg += `<text x="${pad.left - 4}" y="${y + 3}" text-anchor="end" font-size="7" fill="#6b7280">${fmt(v)}</text>`;
  }

  for (const v of yStepsKw) {
    const y = pad.top + chartH - (v / topKw) * chartH;
    svg += `<text x="${pad.left + chartW + 4}" y="${y + 3}" text-anchor="start" font-size="7" fill="#FFB005">${fmt(v)}</text>`;
  }

  svg += `<text x="${pad.left - 8}" y="${pad.top - 6}" text-anchor="end" font-size="8" fill="#6b7280">kWh</text>`;
  svg += `<text x="${pad.left + chartW + 8}" y="${pad.top - 6}" text-anchor="start" font-size="8" fill="#FFB005">kW</text>`;

  data.forEach((d, i) => {
    const x = pad.left + i * barGroupW + (barGroupW - barW * 2 - 2) / 2;
    const bH = (d.kwhBefore / topKwh) * chartH;
    const aH = (d.kwhAfter / topKwh) * chartH;
    svg += `<rect x="${x}" y="${pad.top + chartH - bH}" width="${barW}" height="${bH}" fill="#6B7280" opacity="0.5" rx="1"/>`;
    svg += `<rect x="${x + barW + 2}" y="${pad.top + chartH - aH}" width="${barW}" height="${aH}" fill="#003DA6" rx="1"/>`;
    svg += `<text x="${pad.left + i * barGroupW + barGroupW / 2}" y="${svgH - 8}" text-anchor="middle" font-size="7" fill="#6b7280">${d.hour}h</text>`;
  });

  svg += `<text x="${pad.left + chartW / 2}" y="${svgH}" text-anchor="middle" font-size="8" fill="#6b7280">${t("Heure", "Hour")}</text>`;

  let kwBeforePath = "";
  let kwAfterPath = "";
  data.forEach((d, i) => {
    const cx = pad.left + i * barGroupW + barGroupW / 2;
    const yBefore = pad.top + chartH - (d.kwBefore / topKw) * chartH;
    const yAfter = pad.top + chartH - (d.kwAfter / topKw) * chartH;
    kwBeforePath += `${i === 0 ? "M" : "L"} ${cx} ${yBefore}`;
    kwAfterPath += `${i === 0 ? "M" : "L"} ${cx} ${yAfter}`;
    svg += `<circle cx="${cx}" cy="${yBefore}" r="2.5" fill="none" stroke="#6B7280" stroke-width="1.5"/>`;
    svg += `<circle cx="${cx}" cy="${yAfter}" r="2.5" fill="#FFB005" stroke="#FFB005" stroke-width="1.5"/>`;
  });
  svg += `<path d="${kwBeforePath}" fill="none" stroke="#6B7280" stroke-width="1.5" stroke-dasharray="4 2"/>`;
  svg += `<path d="${kwAfterPath}" fill="none" stroke="#FFB005" stroke-width="1.5"/>`;

  svg += `<line x1="${pad.left}" y1="${pad.top + chartH}" x2="${pad.left + chartW}" y2="${pad.top + chartH}" stroke="#d1d5db" stroke-width="1"/>`;
  svg += `<line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + chartH}" stroke="#d1d5db" stroke-width="0.5"/>`;
  svg += `<line x1="${pad.left + chartW}" y1="${pad.top}" x2="${pad.left + chartW}" y2="${pad.top + chartH}" stroke="#d1d5db" stroke-width="0.5"/>`;

  return `<svg viewBox="0 0 ${svgW} ${svgH}" class="svg-chart" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
}

function buildEnergyProfilePage(
  sim: DocumentSimulationData,
  t: (fr: string, en: string) => string,
  totalProductionKWh: number,
  pageNum: number,
  isSyntheticData: boolean = false
): string {
  const beforeAfterSVG = generateBeforeAfterProfileSVG(sim.hourlyProfile, t);

  const monthlyBarsSVG = generateMonthlyProductionSVG(totalProductionKWh, t);

  return `
  <div class="page">
    <h2>${t("Profil &eacute;nerg&eacute;tique", "Energy Profile")}</h2>
    <p class="subtitle">${t("Simulation heure par heure - votre consommation vs production solaire", "Hour-by-hour simulation - your consumption vs solar production")}</p>
    <div class="chart-container">
      <div class="chart-title">${t("Profil moyen (Avant vs Apr&egrave;s)", "Average Profile (Before vs After)")}</div>
      <div class="legend" style="display: flex; gap: 12px; flex-wrap: wrap;">
        <div class="legend-item"><div class="legend-dot" style="background: #6B7280; opacity: 0.5;"></div> ${t("kWh Avant", "kWh Before")}</div>
        <div class="legend-item"><div class="legend-dot" style="background: #003DA6;"></div> ${t("kWh Apr&egrave;s", "kWh After")}</div>
        <div class="legend-item"><div style="width: 16px; height: 2px; border-top: 2px dashed #6B7280; margin-right: 4px; margin-top: 4px; display: inline-block;"></div> ${t("kW Avant", "kW Before")}</div>
        <div class="legend-item"><div style="width: 16px; height: 2px; border-top: 2px solid #FFB005; margin-right: 4px; margin-top: 4px; display: inline-block;"></div> ${t("kW Apr&egrave;s", "kW After")}</div>
      </div>
      ${beforeAfterSVG}
    </div>
    <div class="metrics-grid">
      <div class="metric-card">
        <span class="metric-value" style="font-size: 18pt;">${Math.round(sim.selfSufficiencyPercent)}%</span>
        <span class="metric-label">${t("Couverture &eacute;nerg&eacute;tique", "Energy Coverage")}</span>
      </div>
      <div class="metric-card">
        <span class="metric-value" style="font-size: 18pt;">${fmt(totalProductionKWh)}</span>
        <span class="metric-label">kWh/${t("an", "yr")}</span>
      </div>
      <div class="metric-card">
        <span class="metric-value" style="font-size: 18pt;">${sim.totalExportedKWh > 0 ? fmt(sim.totalExportedKWh) : "0"}</span>
        <span class="metric-label">${t("kWh surplus export&eacute;", "kWh Surplus Exported")}</span>
      </div>
    </div>
    <div class="charts-row">
      <div class="chart-container" style="min-height: 35mm;">
        <div class="chart-title">${t("Distribution mensuelle de production", "Monthly Production Distribution")}</div>
        ${monthlyBarsSVG}
      </div>
      <div class="info-box" style="min-height: 35mm;">
        ${isSyntheticData ? `
        <h3 style="font-size: 11pt; color: #b45309; margin-bottom: 3mm;">${t("&Eacute;tude pr&eacute;liminaire", "Preliminary Study")}</h3>
        <p style="font-size: 9pt;">${t(
          "Cette analyse est bas&eacute;e sur des <strong>donn&eacute;es synth&eacute;tiques</strong> g&eacute;n&eacute;r&eacute;es &agrave; partir du type et de la taille du b&acirc;timent s&eacute;lectionn&eacute;s. Une procuration ou un t&eacute;l&eacute;chargement CSV est requis pour obtenir vos donn&eacute;es de consommation r&eacute;elles et fournir une analyse d&eacute;finitive.",
          "This analysis is based on <strong>synthetic data</strong> generated from the selected building type and size. A power of attorney or CSV download is required to obtain your actual consumption data and provide a definitive analysis."
        )}</p>
        ` : `
        <h3 style="font-size: 11pt; color: var(--primary); margin-bottom: 3mm;">${t("Analyse bas&eacute;e sur donn&eacute;es r&eacute;elles", "Analysis Based on Real Data")}</h3>
        <p style="font-size: 9pt;">${t(
          "Notre simulation utilise vos <strong>donn&eacute;es de consommation Hydro-Qu&eacute;bec r&eacute;elles</strong> (via procuration) crois&eacute;es avec les donn&eacute;es d'ensoleillement satellite <strong>Google Solar API</strong>.",
          "Our simulation uses your <strong>real Hydro-Qu&eacute;bec consumption data</strong> (via power of attorney) cross-referenced with <strong>Google Solar API</strong> satellite irradiance data."
        )}</p>
        `}
      </div>
    </div>
    ${footerHtml(t, pageNum)}
  </div>`;
}

function generateMonthlyProductionSVG(
  totalProductionKWh: number,
  t: (fr: string, en: string) => string
): string {
  const months = t("J,F,M,A,M,J,J,A,S,O,N,D", "J,F,M,A,M,J,J,A,S,O,N,D").split(",");
  const monthlyKWh = MONTHLY_DISTRIBUTION.map(pct => Math.round(totalProductionKWh * pct));
  const maxKWh = Math.max(...monthlyKWh, 1);
  const svgW = 280;
  const svgH = 120;
  const pad = { top: 10, bottom: 20, left: 5, right: 5 };
  const chartW = svgW - pad.left - pad.right;
  const chartH = svgH - pad.top - pad.bottom;
  const barW = chartW / 12 * 0.7;
  const gap = chartW / 12 * 0.3;

  let bars = "";
  monthlyKWh.forEach((val, i) => {
    const x = pad.left + i * (chartW / 12) + gap / 2;
    const h = (val / maxKWh) * chartH;
    const summer = i >= 4 && i <= 7;
    bars += `<rect x="${x}" y="${pad.top + chartH - h}" width="${barW}" height="${h}" fill="${summer ? "#FFB005" : "#003DA6"}" opacity="${summer ? 1 : 0.7}" rx="1.5"/>`;
    bars += `<text x="${x + barW / 2}" y="${svgH - 5}" text-anchor="middle" font-size="8" fill="#6b7280">${months[i]}</text>`;
  });

  return `<svg viewBox="0 0 ${svgW} ${svgH}" class="svg-chart" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
}

function buildStoragePage(
  sim: DocumentSimulationData,
  t: (fr: string, en: string) => string,
  pageNum: number
): string {
  const peakReduction = sim.peakDemandKW > 0 && sim.demandShavingSetpointKW > 0
    ? Math.round(((sim.peakDemandKW - sim.demandShavingSetpointKW) / sim.peakDemandKW) * 100)
    : 0;
  const peakAfter = sim.demandShavingSetpointKW > 0 ? sim.demandShavingSetpointKW : sim.peakDemandKW;
  const battSavings = sim.battEnergyKWh > 0 ? Math.round(sim.annualSavings * 0.15) : 0;

  return `
  <div class="page">
    <h2>${t("Stockage & optimisation", "Storage & Optimization")}</h2>
    <p class="subtitle">${t("Maximisez vos &eacute;conomies avec un syst&egrave;me de batteries int&eacute;gr&eacute;", "Maximize your savings with an integrated battery system")}</p>
    <div class="two-column">
      <div class="section">
        <h3>${t("Recommandation batterie", "Battery Recommendation")}</h3>
        <div class="info-box" style="background: var(--primary); color: white;">
          <p style="color: rgba(255,255,255,0.8); font-size: 9pt; margin-bottom: 1mm;">${t("Capacit&eacute; recommand&eacute;e", "Recommended Capacity")}</p>
          <p style="color: white; font-size: 22pt; font-weight: 700; margin-bottom: 1mm;">${fmt(sim.battEnergyKWh)} kWh</p>
          <p style="color: rgba(255,255,255,0.8); font-size: 9pt; margin-bottom: 3mm;">BESS (Battery Energy Storage System)</p>
          <p style="color: rgba(255,255,255,0.9); font-size: 9pt; margin: 0;">
            <strong>${t("Puissance:", "Power:")}</strong> ${fmt(sim.battPowerKW)} kW<br>
            <strong>${t("Dur&eacute;e de d&eacute;charge:", "Discharge duration:")}</strong> ${sim.battPowerKW > 0 ? (sim.battEnergyKWh / sim.battPowerKW).toFixed(1) : "N/A"} ${t("heures", "hours")}<br>
            <strong>${t("Technologie:", "Technology:")}</strong> LFP (Lithium Fer Phosphate)
          </p>
        </div>
      </div>
      <div class="section">
        <h3>${t("Impact sur la facture", "Bill Impact")}</h3>
        <div class="metrics-grid" style="grid-template-columns: 1fr 1fr; margin: 3mm 0;">
          <div class="metric-card">
            <span class="metric-value" style="font-size: 18pt;">${peakReduction > 0 ? `-${peakReduction}%` : "N/A"}</span>
            <span class="metric-label">${t("R&eacute;duction pointe", "Peak Reduction")}</span>
          </div>
          <div class="metric-card metric-accent">
            <span class="metric-value" style="font-size: 18pt;">${smartCur(battSavings)}</span>
            <span class="metric-label">${t("&Eacute;conomies/an", "Savings/yr")}</span>
          </div>
        </div>
        <div class="info-box" style="font-size: 9pt;">
          <p><strong>${t("&Eacute;cr&ecirc;tage de la demande:", "Demand Shaving:")}</strong> ${t(
            "La batterie se d&eacute;charge pendant vos pointes de demande, r&eacute;duisant votre appel de puissance factur&eacute; par Hydro-Qu&eacute;bec.",
            "The battery discharges during your peak demand, reducing your billed power draw from Hydro-Qu&eacute;bec."
          )}</p>
        </div>
      </div>
    </div>
    <div class="chart-container">
      <div class="chart-title">${t("&Eacute;cr&ecirc;tage de la pointe de demande (Demand Shaving)", "Peak Demand Shaving")}</div>
      <div style="height: 50mm; background: white; border-radius: 2mm; display: flex; align-items: center; justify-content: center; position: relative; border: 1px solid #e5e7eb;">
        <div style="position: absolute; top: 15mm; left: 10mm; right: 10mm; border-top: 2px dashed #DC2626; opacity: 0.5;"></div>
        <div style="position: absolute; top: 25mm; left: 10mm; right: 10mm; border-top: 2px dashed #16a34a;"></div>
        <div style="position: absolute; top: 13mm; right: 12mm; font-size: 8pt; color: #DC2626;">${t("Pointe AVANT:", "Peak BEFORE:")} ${fmt(sim.peakDemandKW)} kW</div>
        <div style="position: absolute; top: 23mm; right: 12mm; font-size: 8pt; color: #16a34a; font-weight: 600;">${t("Pointe APR&Egrave;S:", "Peak AFTER:")} ${fmt(peakAfter)} kW</div>
      </div>
    </div>
    <div class="info-box accent">
      <h3 style="color: var(--dark); margin-bottom: 2mm;">${t("Solaire + Stockage = Synergie", "Solar + Storage = Synergy")}</h3>
      <p style="color: var(--dark); font-size: 10pt; margin: 0;">
        ${t(
          "En combinant panneaux solaires et batterie, vous r&eacute;duisez &agrave; la fois votre <strong>consommation d'&eacute;nergie</strong> (composante kWh) et votre <strong>appel de puissance</strong> (composante kW).",
          "By combining solar panels and battery, you reduce both your <strong>energy consumption</strong> (kWh component) and your <strong>power demand</strong> (kW component)."
        )}
      </p>
    </div>
    ${footerHtml(t, pageNum)}
  </div>`;
}

function generateCashflowSVG(
  sim: DocumentSimulationData,
  t: (fr: string, en: string) => string,
  totalProductionKWh: number
): string {
  const acq = computeAcquisitionCashflows({
    capexGross: sim.capexGross,
    capexNet: sim.capexNet,
    annualSavings: sim.savingsYear1 || sim.annualSavings,
    incentivesHQSolar: sim.incentivesHQSolar || 0,
    incentivesHQBattery: sim.incentivesHQBattery || 0,
    incentivesFederal: sim.incentivesFederal || 0,
    taxShield: sim.taxShield || 0,
    cashflows: sim.cashflows?.map(cf => ({ year: cf.year, cumulative: cf.cumulative, netCashflow: cf.netCashflow })),
  });

  const series = acq.series.filter(s => s.year >= 1);
  if (series.length === 0) return "";

  const allVals = series.flatMap(s => [s.cash, s.loan, s.lease]);
  const minVal = Math.min(...allVals, 0);
  const maxVal = Math.max(...allVals, 1);
  const range = maxVal - minVal || 1;

  const svgW = 580;
  const svgH = 200;
  const pad = { top: 20, bottom: 40, left: 55, right: 15 };
  const chartW = svgW - pad.left - pad.right;
  const chartH = svgH - pad.top - pad.bottom;

  const toY = (val: number) => pad.top + ((maxVal - val) / range) * chartH;
  const toX = (idx: number) => pad.left + (idx / (series.length - 1)) * chartW;

  const zeroY = toY(0);
  let svg = "";

  svg += `<line x1="${pad.left}" y1="${zeroY}" x2="${svgW - pad.right}" y2="${zeroY}" stroke="#9ca3af" stroke-width="1" stroke-dasharray="4,3"/>`;
  svg += `<text x="${pad.left - 5}" y="${zeroY + 3}" text-anchor="end" font-size="8" fill="#6b7280">0 $</text>`;

  const yTicks = 4;
  for (let i = 0; i <= yTicks; i++) {
    const val = minVal + (range * i / yTicks);
    if (Math.abs(val) < range * 0.05) continue;
    const y = toY(val);
    const label = Math.abs(val) >= 1000000
      ? `${(val / 1000000).toFixed(1)}M$`
      : `${Math.round(val / 1000)}k$`;
    svg += `<line x1="${pad.left}" y1="${y}" x2="${svgW - pad.right}" y2="${y}" stroke="#e5e7eb" stroke-width="0.5"/>`;
    svg += `<text x="${pad.left - 5}" y="${y + 3}" text-anchor="end" font-size="7" fill="#9ca3af">${label}</text>`;
  }

  const xLabels = [1, 5, 10, 15, 20, 25];
  series.forEach((s, i) => {
    if (xLabels.includes(s.year)) {
      const x = toX(i);
      svg += `<text x="${x}" y="${svgH - pad.bottom + 14}" text-anchor="middle" font-size="7" fill="#6b7280">${t("An", "Yr")} ${s.year}</text>`;
    }
  });

  const cashBars = series.filter(s => sim.cashflows?.find(cf => cf.year === s.year));
  if (cashBars.length > 0 && sim.cashflows) {
    const barW = chartW / series.length * 0.5;
    sim.cashflows.filter(cf => cf.year >= 1 && cf.year <= 25).forEach(cf => {
      const idx = cf.year - 1;
      if (idx >= series.length) return;
      const x = toX(idx) - barW / 2;
      const valH = Math.abs(cf.netCashflow) / range * chartH;
      const isPositive = cf.netCashflow >= 0;
      const y = isPositive ? zeroY - valH : zeroY;
      const color = isPositive ? "#16A34A" : "#DC2626";
      svg += `<rect x="${x}" y="${y}" width="${barW}" height="${Math.max(valH, 1)}" fill="${color}" opacity="0.25" rx="1"/>`;
    });
  }

  function drawLine(points: { x: number; y: number }[], color: string, dashArray?: string, width = 2.5): string {
    if (points.length < 2) return "";
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }
    const dashAttr = dashArray ? ` stroke-dasharray="${dashArray}"` : "";
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}"${dashAttr} stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  const cashPts = series.map((s, i) => ({ x: toX(i), y: toY(s.cash) }));
  const loanPts = series.map((s, i) => ({ x: toX(i), y: toY(s.loan) }));
  const leasePts = series.map((s, i) => ({ x: toX(i), y: toY(s.lease) }));

  svg += drawLine(leasePts, "#FFB005", "6,3", 2);
  svg += drawLine(loanPts, "#003DA6", "4,2", 2);
  svg += drawLine(cashPts, "#16A34A", undefined, 2.5);

  if (acq.cashPaybackYear && acq.cashPaybackYear > 0 && acq.cashPaybackYear <= 25) {
    const pbIdx = acq.cashPaybackYear - 1;
    const pbX = toX(pbIdx);
    svg += `<line x1="${pbX}" y1="${pad.top}" x2="${pbX}" y2="${pad.top + chartH}" stroke="#16A34A" stroke-width="1.5" stroke-dasharray="5,3" opacity="0.6"/>`;
    svg += `<circle cx="${pbX}" cy="${toY(series[pbIdx].cash)}" r="4" fill="#16A34A" stroke="white" stroke-width="1.5"/>`;
  }

  const legendY = svgH - 10;
  const legendItems = [
    { color: "#16A34A", label: t("Comptant", "Cash"), dash: false },
    { color: "#003DA6", label: t("Pr&ecirc;t", "Loan"), dash: true },
    { color: "#FFB005", label: t("Cr&eacute;dit-bail 15 ans", "15-yr Lease"), dash: true },
  ];
  let legendX = pad.left;
  legendItems.forEach(item => {
    if (item.dash) {
      svg += `<line x1="${legendX}" y1="${legendY}" x2="${legendX + 18}" y2="${legendY}" stroke="${item.color}" stroke-width="2.5" stroke-dasharray="4,2"/>`;
    } else {
      svg += `<line x1="${legendX}" y1="${legendY}" x2="${legendX + 18}" y2="${legendY}" stroke="${item.color}" stroke-width="2.5"/>`;
    }
    svg += `<text x="${legendX + 22}" y="${legendY + 3}" font-size="8" fill="#4b5563">${item.label}</text>`;
    legendX += 130;
  });

  return `<svg viewBox="0 0 ${svgW} ${svgH}" class="svg-chart" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
}

function buildProjectionRows(
  sim: DocumentSimulationData,
  t: (fr: string, en: string) => string,
  totalProductionKWh: number
): string {
  if (sim.cashflows && sim.cashflows.length > 0) {
    const selectedYears = [1, Math.ceil(sim.simplePaybackYears), 5, 10, 15, 20, 25];
    const unique = Array.from(new Set(selectedYears)).filter(y => y > 0 && y <= 25).sort((a, b) => a - b);
    const paybackYear = Math.ceil(sim.simplePaybackYears);

    return unique.map(year => {
      const cf = sim.cashflows!.find(c => c.year === year);
      if (!cf) return "";
      const production = Math.round(totalProductionKWh * Math.pow(0.995, year - 1));
      const isPayback = year === paybackYear && paybackYear > 1 && paybackYear < 25;
      const isYear25 = year === 25;

      if (isYear25) {
        return `<tr style="background: var(--primary); color: white;">
          <td><strong>${t("Ann&eacute;e", "Year")} ${year}</strong></td>
          <td class="number" style="color: white;">${fmt(production)}</td>
          <td class="number" style="color: white;">${cur(cf.netCashflow)}</td>
          <td class="number" style="color: white;"><strong>${cur(cf.cumulative)}</strong></td>
        </tr>`;
      }
      if (isPayback) {
        return `<tr style="background: #FFF8E1;">
          <td><strong>${t("Ann&eacute;e", "Year")} ${year} - ${t("R&eacute;cup&eacute;ration", "Payback")}</strong></td>
          <td class="number">${fmt(production)}</td>
          <td class="number">${cur(cf.netCashflow)}</td>
          <td class="number" style="color: #16a34a;"><strong>${cur(cf.cumulative)}</strong></td>
        </tr>`;
      }
      return `<tr>
        <td>${t("Ann&eacute;e", "Year")} ${year}</td>
        <td class="number">${fmt(production)}</td>
        <td class="number">${cur(cf.netCashflow)}</td>
        <td class="number">${cur(cf.cumulative)}</td>
      </tr>`;
    }).join("");
  }

  const baseSavings = sim.savingsYear1 || sim.annualSavings;
  const paybackYear = Math.ceil(sim.simplePaybackYears);
  const selectedYears = [1, paybackYear, 5, 10, 15, 20, 25];
  const unique = Array.from(new Set(selectedYears)).filter(y => y > 0 && y <= 25).sort((a, b) => a - b);

  return unique.map(year => {
    const deg = Math.pow(0.995, year - 1);
    const inf = Math.pow(1.035, year - 1);
    const production = Math.round(totalProductionKWh * deg);
    const savings = Math.round(baseSavings * deg * inf);
    let cum = 0;
    for (let y = 1; y <= year; y++) {
      cum += Math.round(baseSavings * Math.pow(0.995, y - 1) * Math.pow(1.035, y - 1));
    }
    cum -= sim.capexNet;

    const isPayback = year === paybackYear && paybackYear > 1 && paybackYear < 25;
    const isYear25 = year === 25;

    if (isYear25) {
      return `<tr style="background: var(--primary); color: white;">
        <td><strong>${t("Ann&eacute;e", "Year")} ${year}</strong></td>
        <td class="number" style="color: white;">${fmt(production)}</td>
        <td class="number" style="color: white;">${cur(savings)}</td>
        <td class="number" style="color: white;"><strong>${cur(cum)}</strong></td>
      </tr>`;
    }
    if (isPayback) {
      return `<tr style="background: #FFF8E1;">
        <td><strong>${t("Ann&eacute;e", "Year")} ${year} - ${t("R&eacute;cup&eacute;ration", "Payback")}</strong></td>
        <td class="number">${fmt(production)}</td>
        <td class="number">${cur(savings)}</td>
        <td class="number" style="color: #16a34a;"><strong>${cur(cum)}</strong></td>
      </tr>`;
    }
    return `<tr>
      <td>${t("Ann&eacute;e", "Year")} ${year}</td>
      <td class="number">${fmt(production)}</td>
      <td class="number">${cur(savings)}</td>
      <td class="number">${cur(cum)}</td>
    </tr>`;
  }).join("");
}

function buildFinancialProjectionsPage(
  sim: DocumentSimulationData,
  t: (fr: string, en: string) => string,
  totalProductionKWh: number,
  pageNum: number
): string {
  const cashflowSVG = generateCashflowSVG(sim, t, totalProductionKWh);
  const rows = buildProjectionRows(sim, t, totalProductionKWh);

  const surplusSection = sim.totalExportedKWh > 0 ? `
    <div class="info-box" style="background: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 0; margin-top: 4mm;">
      <h3 style="font-size: 10pt; color: #16a34a; margin-bottom: 2mm;">${t("Cr&eacute;dits surplus - mesurage net Hydro-Qu&eacute;bec", "Surplus Credits - Hydro-Qu&eacute;bec Net Metering")}</h3>
      <p style="font-size: 9pt; margin: 0;">
        ${t(
          `<strong>${fmt(sim.totalExportedKWh)} kWh</strong> export&eacute;s annuellement vers le r&eacute;seau Hydro-Qu&eacute;bec. Banque de cr&eacute;dits sur 24 mois au taux de r&eacute;f&eacute;rence (~4,54&cent;/kWh). Revenu surplus estim&eacute;: <strong>${cur(sim.annualSurplusRevenue)}/an</strong>.`,
          `<strong>${fmt(sim.totalExportedKWh)} kWh</strong> exported annually to Hydro-Qu&eacute;bec grid. 24-month credit bank at reference rate (~4.54&cent;/kWh). Estimated surplus revenue: <strong>${cur(sim.annualSurplusRevenue)}/yr</strong>.`
        )}
      </p>
    </div>` : "";

  return `
  <div class="page">
    <h2>${t("Projections financi&egrave;res", "Financial Projections")}</h2>
    <p class="subtitle">${t("&Eacute;volution sur 25 ans avec inflation &eacute;nerg&eacute;tique de 3,5%/an", "25-year evolution with 3.5%/yr energy inflation")}</p>
    ${cashflowSVG ? `<div class="chart-container">
      <div class="chart-title">${t("Flux de tr&eacute;sorerie cumulatif &mdash; Options d'acquisition", "Cumulative Cash Flow &mdash; Acquisition Options")}</div>
      ${cashflowSVG}
    </div>` : ""}
    <div class="section">
      <h3>${t("Projection annuelle", "Annual Projection")}</h3>
      <table class="data-table">
        <tr>
          <th>${t("Ann&eacute;e", "Year")}</th>
          <th style="text-align: right;">${t("Production (kWh)", "Production (kWh)")}</th>
          <th style="text-align: right;">${t("&Eacute;conomies", "Savings")}</th>
          <th style="text-align: right;">${t("Cumulatif", "Cumulative")}</th>
        </tr>
        ${rows}
      </table>
    </div>
    ${surplusSection}
    ${footerHtml(t, pageNum)}
  </div>`;
}

function buildRoofConfigPage(
  sim: DocumentSimulationData,
  t: (fr: string, en: string) => string,
  roofImageBase64: string | null,
  pageNum: number
): string {
  const polygons = sim.roofPolygons || [];

  const imageHtml = roofImageBase64
    ? `<img src="${roofImageBase64}" style="width: 100%; height: 80mm; object-fit: cover; border-radius: 2mm;" />`
    : `<div style="height: 80mm; background: linear-gradient(135deg, #ccdcf0 0%, #a3bfe0 100%); border-radius: 2mm; display: flex; align-items: center; justify-content: center; color: #003DA6; font-weight: 600;">${t("[Image configuration panneaux]", "[Panel configuration image]")}</div>`;

  return `
  <div class="page">
    <h2>${t("Configuration de toiture", "Roof Configuration")}</h2>
    <p class="subtitle">${t("Optimisation bas&eacute;e sur l'analyse Google Solar API", "Optimization based on Google Solar API analysis")}</p>
    <div class="two-column">
      <div class="section">
        <h3>${t("Segments de toiture", "Roof Segments")}</h3>
        <table class="data-table">
          <tr><th>${t("Segment", "Segment")}</th><th>${t("Surface", "Area")}</th><th>${t("Orientation", "Orientation")}</th><th>${t("Inclinaison", "Tilt")}</th></tr>
          ${polygons.map((p, i) => `
          <tr>
            <td>${p.label || `${t("Zone", "Zone")} ${i + 1}`}</td>
            <td class="number">${fmt(p.areaSqM)} m&sup2;</td>
            <td class="number">${orientationLabel(p.orientation, "fr")}</td>
            <td class="number">${p.tiltDegrees !== undefined ? `${Math.round(p.tiltDegrees)}` : "N/A"}&deg;</td>
          </tr>`).join("")}
        </table>
        <p style="font-size: 9pt; color: var(--gray); margin-top: 2mm;">${t("Surface totale:", "Total area:")} ${fmt(polygons.reduce((s, p) => s + p.areaSqM, 0))} m&sup2;</p>
      </div>
      <div class="section">
        <h3>${t("Param&egrave;tres techniques", "Technical Parameters")}</h3>
        <div class="info-box">
          <p><strong>${t("Puissance syst&egrave;me:", "System power:")}</strong> ${fmt(sim.pvSizeKW)} kWc</p>
          ${sim.assumptions ? `<p><strong>${t("Surface toiture totale:", "Total roof area:")}</strong> ${fmt(sim.assumptions.roofAreaSqFt)} pi&sup2;</p>
          <p><strong>${t("Ratio d'utilisation:", "Utilization ratio:")}</strong> ${Math.round((sim.assumptions.roofUtilizationRatio || 0) * 100)}%</p>` : ""}
        </div>
      </div>
    </div>
    <div class="chart-container">
      <div class="chart-title">${t("Vue a&eacute;rienne - configuration des panneaux", "Aerial View - Panel Configuration")}</div>
      ${imageHtml}
    </div>
    ${footerHtml(t, pageNum)}
  </div>`;
}

function buildEquipmentPage(
  sim: DocumentSimulationData,
  t: (fr: string, en: string) => string,
  lang: "fr" | "en",
  pageNum: number
): string {
  const iconCodeToCategory: Record<string, string> = { panel: "panels", inverter: "inverters", mounting: "racking", workmanship: "workmanship", battery: "battery" };
  const brandEquipment = getEquipment(lang);
  const defaultEquipment = brandEquipment.map(eq => ({
    name: eq.label,
    manufacturer: eq.manufacturer,
    warranty: eq.warranty,
    spec: eq.specs || "",
    certifications: eq.certifications || [],
    category: iconCodeToCategory[eq.iconCode] || eq.iconCode,
  }));

  if (sim.battEnergyKWh > 0) {
    const battEq = getBatteryEquipment(lang);
    defaultEquipment.splice(3, 0, {
      name: battEq.label,
      manufacturer: battEq.manufacturer,
      warranty: battEq.warranty,
      spec: battEq.specs || "",
      certifications: battEq.certifications || [],
      category: iconCodeToCategory[battEq.iconCode] || battEq.iconCode,
    });
  }

  const equipment = sim.catalogEquipment && sim.catalogEquipment.length > 0
    ? sim.catalogEquipment
    : defaultEquipment;

  const techSummary = getEquipmentTechnicalSummary(lang);

  return `
  <div class="page">
    <h2>${t("&Eacute;quipements & garanties", "Equipment & Warranties")}</h2>
    <table class="data-table">
      <tr>
        <th>${t("Composant", "Component")}</th>
        <th>${t("Fabricant", "Manufacturer")}</th>
        <th>${t("Sp&eacute;cification", "Specification")}</th>
        <th>Certifications</th>
        <th>${t("Garantie", "Warranty")}</th>
      </tr>
      ${equipment.map(eq => {
        const certs = (eq as any).certifications;
        const certHtml = certs && certs.length > 0
          ? certs.map((c: string) => `<span class="cert-badge">${c}</span>`).join("")
          : "&mdash;";
        return `
      <tr>
        <td><strong>${eq.name}</strong></td>
        <td>${eq.manufacturer}</td>
        <td>${eq.spec}</td>
        <td>${certHtml}</td>
        <td>${eq.warranty}</td>
      </tr>`;
      }).join("")}
    </table>
    <div class="two-column" style="margin-top: 4mm;">
      <div class="section">
        <h3>${t("Certifications &eacute;quipements", "Equipment Certifications")}</h3>
        <ul class="bullet-list">
          <li>${t("Panneaux certifi&eacute;s CSA / UL / IEC", "Panels certified CSA / UL / IEC")}</li>
          <li>${t("Onduleurs certifi&eacute;s CSA C22.2", "Inverters certified CSA C22.2")}</li>
          <li>${t("Installation selon Code &eacute;lectrique du Qu&eacute;bec", "Installation per Quebec Electrical Code")}</li>
          ${sim.battEnergyKWh > 0 ? `<li>${t("Batteries certifi&eacute;es UL 9540A", "Batteries certified UL 9540A")}</li>` : ""}
        </ul>
      </div>
      <div class="section">
        <h3>${t("Garantie installation kWh", "kWh Installation Warranty")}</h3>
        <div class="info-box">
          <p><strong>${t("Main d'oeuvre:", "Labor:")}</strong> ${t("10 ans", "10 years")}</p>
          <p><strong>${t("&Eacute;tanch&eacute;it&eacute;:", "Waterproofing:")}</strong> ${t("10 ans", "10 years")}</p>
          <p><strong>${t("Performance garantie:", "Guaranteed performance:")}</strong> ${t("96% &agrave; 10 ans, 90% &agrave; 25 ans", "96% at 10 yrs, 90% at 25 yrs")}</p>
          <p><strong>${t("Monitoring:", "Monitoring:")}</strong> ${t("Suivi continu inclus", "Continuous monitoring included")}</p>
        </div>
      </div>
    </div>
    <div class="section" style="margin-top: 3mm; padding: 3mm 5mm; background: #f0f4f8; border-radius: 2mm;">
      <h3 style="margin-bottom: 2mm;">${t("Donn&eacute;es structurelles pour &eacute;valuation de toiture", "Structural Data for Roof Evaluation")}</h3>
      <table class="data-table" style="margin-bottom: 0;">
        <tr>
          <th>${t("Param&egrave;tre", "Parameter")}</th>
          <th>${t("Valeur", "Value")}</th>
        </tr>
        <tr class="total-row"><td>${t("Charge totale du syst&egrave;me", "Total System Load")}</td><td><strong style="font-size:14px;color:#FFB005;">${techSummary.totalSystemWeightKgPerM2.value} ${techSummary.totalSystemWeightKgPerM2.unit}&nbsp;&nbsp;/&nbsp;&nbsp;${techSummary.totalSystemWeightPsfPerSf.value} ${t(techSummary.totalSystemWeightPsfPerSf.unitFr, techSummary.totalSystemWeightPsfPerSf.unitEn)}</strong></td></tr>
        <tr><td style="font-size:9px;color:#6B7280;">${t("D&eacute;tail", "Breakdown")}</td><td style="font-size:9px;color:#6B7280;">${t(`Panneaux ${techSummary.panelWeightKgPerM2.value} kg/m&sup2; + Structure ${techSummary.rackingWeightKgPerM2.value} kg/m&sup2;`, `Panels ${techSummary.panelWeightKgPerM2.value} kg/m&sup2; + Racking ${techSummary.rackingWeightKgPerM2.value} kg/m&sup2;`)}</td></tr>
        <tr><td>${techSummary.windLoadDesign}</td><td>&#x2713;</td></tr>
        <tr><td>${techSummary.snowLoadNote}</td><td>&#x2713;</td></tr>
      </table>
    </div>
    ${footerHtml(t, pageNum)}
  </div>`;
}

function buildAssumptionsPage(
  sim: DocumentSimulationData,
  t: (fr: string, en: string) => string,
  lang: "fr" | "en",
  isSyntheticData: boolean = false,
  pageNum: number
): string {
  const assumptions = [
    t("Tarif Hydro-Qu&eacute;bec en vigueur (&eacute;nergie + puissance)", "Current Hydro-Qu&eacute;bec rate (energy + demand)"),
    t("Inflation &eacute;nerg&eacute;tique annuelle: 3,5%", "Annual energy inflation: 3.5%"),
    t("D&eacute;gradation panneaux: 0,4%/an", "Panel degradation: 0.4%/yr"),
    t("Dur&eacute;e de vie syst&egrave;me: 25 ans minimum", "System life: 25 years minimum"),
    t("Taux d'actualisation: 7%", "Discount rate: 7%"),
    t("Rendement solaire: ~1 035 kWh/kWc (base Qu&eacute;bec)", "Solar yield: ~1,035 kWh/kWp (Quebec baseline)"),
    t("Efficacit&eacute; syst&egrave;me: ~90%", "System efficiency: ~90%"),
    t("ITC f&eacute;d&eacute;ral: 30% du CAPEX brut", "Federal ITC: 30% of gross CAPEX"),
    t("Hydro-Qu&eacute;bec — 40% du projet (jusqu'&agrave; 1 000 $/kW)", "Hydro-Qu&eacute;bec — 40% of project (up to $1,000/kW)"),
  ];

  const exclusions = getExclusions(lang);

  return `
  <div class="page">
    <h2>${t("Hypoth&egrave;ses & exclusions", "Assumptions & Exclusions")}</h2>
    <div class="two-column">
      <div class="section">
        <h3>${t("Hypoth&egrave;ses de calcul", "Calculation Assumptions")}</h3>
        <ul class="bullet-list">
          ${assumptions.map(a => `<li>${a}</li>`).join("")}
        </ul>
      </div>
      <div class="section">
        <h3>${t("Exclusions", "Exclusions")}</h3>
        <div class="info-box" style="background: #fef3c7; border-left: 4px solid var(--accent); border-radius: 0;">
          <ul class="bullet-list" style="margin: 0;">
            ${exclusions.map(e => `<li style="color: #92400e;">${e}</li>`).join("")}
          </ul>
        </div>
      </div>
    </div>
    <div class="section">
      <h3>${t("Sources de donn&eacute;es", "Data Sources")}</h3>
      <div class="info-box">
        <p><strong>${t("Ensoleillement:", "Irradiance:")}</strong> Google Solar API (${t("donn&eacute;es satellite haute r&eacute;solution", "high-resolution satellite data")})</p>
        <p><strong>${t("Consommation:", "Consumption:")}</strong> ${isSyntheticData
          ? t("&#9888; Donn&eacute;es synth&eacute;tiques g&eacute;n&eacute;r&eacute;es &agrave; partir du type et de la taille du b&acirc;timent s&eacute;lectionn&eacute;s. Une procuration ou un t&eacute;l&eacute;chargement CSV est requis pour obtenir vos donn&eacute;es de consommation r&eacute;elles.",
               "&#9888; Synthetic data generated from the selected building type and size. A power of attorney or CSV download is required to obtain your actual consumption data.")
          : t("Donn&eacute;es Hydro-Qu&eacute;bec r&eacute;elles (via procuration)", "Real Hydro-Qu&eacute;bec data (via power of attorney)")}</p>
        <p><strong>${t("Tarifs &eacute;lectriques:", "Electricity rates:")}</strong> Hydro-Qu&eacute;bec ${t("tarifs en vigueur 2026", "rates in effect 2026")}</p>
        <p><strong>${t("ITC f&eacute;d&eacute;ral:", "Federal ITC:")}</strong> ${t("Loi C-69 - Cr&eacute;dit d'imp&ocirc;t &agrave; l'investissement pour technologies propres", "Bill C-69 - Clean technology investment tax credit")}</p>
        <p><strong>${t("Autoproduction Hydro-Qu&eacute;bec:", "Hydro-Qu&eacute;bec Self-Production:")}</strong> ${t("Programme Autoproduction d'Hydro-Qu&eacute;bec", "Hydro-Qu&eacute;bec Self-Production Program")}</p>
      </div>
    </div>
    <div class="info-box highlight">
      <p style="margin: 0; color: rgba(255,255,255,0.95);">
        <strong>Important:</strong> ${t(
          "Cette &eacute;tude pr&eacute;liminaire est bas&eacute;e sur les informations disponibles et une analyse &agrave; distance. Une visite technique et une analyse d&eacute;taill&eacute;e confirmeront les param&egrave;tres finaux, l'admissibilit&eacute; aux incitatifs, et la soumission forfaitaire d&eacute;finitive.",
          "This preliminary study is based on available information and remote analysis. A technical visit and detailed analysis will confirm final parameters, incentive eligibility, and the final quote."
        )}
      </p>
    </div>
    ${footerHtml(t, pageNum)}
  </div>`;
}

function buildTimelinePage(
  sim: DocumentSimulationData,
  t: (fr: string, en: string) => string,
  lang: "fr" | "en",
  pageNum: number
): string {
  const brandTimeline = getTimeline(lang);
  const defaultTimeline = brandTimeline.map(item => ({
    step: item.step,
    duration: item.duration,
    desc: item.bullets.join(", "),
  }));

  const useCustom = sim.constructionTimeline && sim.constructionTimeline.length > 0;
  const timelineItems = useCustom
    ? sim.constructionTimeline!.map(item => ({
        step: item.step,
        duration: item.duration,
        desc: item.status || "",
      }))
    : defaultTimeline;

  return `
  <div class="page">
    <h2>${t("&Eacute;ch&eacute;ancier type", "Typical Timeline")}</h2>
    <p class="subtitle">${t("De la signature &agrave; la mise en service", "From signing to commissioning")}</p>
    <div class="timeline">
      ${timelineItems.map(item => `
      <div class="timeline-item">
        <span class="timeline-week">${item.duration}</span>
        <div class="timeline-title">${item.step}</div>
        ${item.desc ? `<p class="timeline-desc">${item.desc}</p>` : ""}
      </div>`).join("")}
    </div>
    <div style="margin-top: 6mm; text-align: center;">
      <div style="display: flex; align-items: flex-end; max-width: 80%; margin: 0 auto;">
        <div style="width: 2px; height: 8px; background: var(--primary);"></div>
        <div style="flex: 1; height: 2px; background: var(--primary);"></div>
        <div style="width: 2px; height: 8px; background: var(--primary);"></div>
      </div>
      <p style="font-size: 10pt; font-weight: 600; color: var(--accent); margin-top: 3mm;">
        ${t("D&eacute;lai total approximatif : 4 &agrave; 8 mois", "Approximate total timeline: 4 to 8 months")}
      </p>
    </div>
    <div class="info-box" style="margin-top: 10mm;">
      <p><strong>Note:</strong> ${t(
        "Cet &eacute;ch&eacute;ancier est indicatif pour un projet de cette envergure. Les d&eacute;lais r&eacute;els peuvent varier selon la complexit&eacute; du projet, la disponibilit&eacute; des &eacute;quipements et les d&eacute;lais municipaux.",
        "This timeline is indicative for a project of this scope. Actual timelines may vary based on project complexity, equipment availability, and municipal delays."
      )}</p>
    </div>
    ${footerHtml(t, pageNum)}
  </div>`;
}

function buildNextStepsPage(
  _sim: DocumentSimulationData,
  t: (fr: string, en: string) => string,
  isSyntheticData: boolean,
  pageNum: number
): string {
  const lang = t("fr", "en") === "fr" ? "fr" as const : "en" as const;
  const timeline = getTimeline(lang);

  const phaseTag = (phase: string, index: number): string => {
    if (phase === "discovery") return `<span class="funnel-step-tag">${t("GRATUIT", "FREE")}</span>`;
    if (phase === "design") return `<span class="funnel-step-tag paid">2 500$ + tx</span>`;
    return `<span class="funnel-step-tag paid">${timeline[index]?.duration || ""}</span>`;
  };

  const currentStepIndex = isSyntheticData ? 1 : 2;

  const funnelStepsHtml = `<div class="funnel-steps">
      ${timeline.map((tl, i) => {
        const isCompleted = i < currentStepIndex;
        const isCurrent = i === currentStepIndex;
        const stepStyle = isCompleted
          ? ' style="background: rgba(22,163,74,0.06); border: 2px solid rgba(22,163,74,0.2); border-radius: 3mm;"'
          : isCurrent
            ? ' style="border: 2px solid var(--accent); border-radius: 3mm;"'
            : '';
        const numberStyle = isCompleted
          ? ' style="background: #16A34A; color: white;"'
          : '';
        const titleStyle = isCompleted
          ? ' style="color: #16A34A;"'
          : '';
        const numberContent = isCompleted ? '&#10003;' : `${i + 1}`;
        const tagHtml = isCompleted
          ? `<span class="funnel-step-tag" style="background: #16A34A; color: white;">${t("COMPL&Eacute;T&Eacute;", "COMPLETED")}</span>`
          : isCurrent
            ? `<span class="funnel-step-tag">${t("PROCHAINE &Eacute;TAPE", "NEXT STEP")}</span>`
            : phaseTag(tl.phase, i);
        const bulletHtml = tl.bullets && tl.bullets.length > 0
          ? `<p class="funnel-step-desc">${tl.bullets[0]}</p>`
          : `<p class="funnel-step-desc">${tl.duration}</p>`;
        return `
      <div class="funnel-step"${stepStyle}>
        <div class="funnel-step-number"${numberStyle}>${numberContent}</div>
        <div class="funnel-step-title"${titleStyle}>${tl.step}</div>
        ${bulletHtml}
        ${tagHtml}
      </div>`;
      }).join('')}
    </div>
    <div style="margin-top: 4mm; text-align: center;">
      <div style="display: flex; align-items: flex-end; max-width: 90%; margin: 0 auto;">
        <div style="width: 2px; height: 6px; background: var(--primary);"></div>
        <div style="flex: 1; height: 2px; background: var(--primary);"></div>
        <div style="width: 2px; height: 6px; background: var(--primary);"></div>
      </div>
      <p style="font-size: 9pt; font-weight: 600; color: var(--accent); margin-top: 2mm;">
        ${t("D&eacute;lai total approximatif : 4 &agrave; 8 mois", "Approximate total timeline: 4 to 8 months")}
      </p>
    </div>`;

  const immediateStepHtml = isSyntheticData
    ? `<div class="section">
        <h3>${t("Obtenez votre analyse d&eacute;taill&eacute;e", "Get your detailed analysis")}</h3>
        <p style="margin-bottom: 3mm;">${t("Deux options pour nous transmettre vos donn&eacute;es de consommation r&eacute;elles :", "Two options to send us your real consumption data:")}</p>
        <div style="display: flex; gap: 4mm; margin-bottom: 3mm;">
          <div style="flex: 1; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 2mm; padding: 3mm;">
            <p style="font-size: 9pt; font-weight: 700; color: #16a34a; margin: 0 0 2mm 0;">${t("Option A &mdash; Procuration (2 min)", "Option A &mdash; Authorization (2 min)")}</p>
            <p style="font-size: 8pt; margin: 0 0 2mm 0;">${t("Signez en ligne et nous nous occupons de tout.", "Sign online and we handle everything.")}</p>
            <p style="font-size: 8pt; margin: 0;"><a href="https://kwh.quebec/analyse-detaillee" style="color: #003DA6; text-decoration: underline;">kwh.quebec/analyse-detaillee</a></p>
          </div>
          <div style="flex: 1; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 2mm; padding: 3mm;">
            <p style="font-size: 9pt; font-weight: 700; color: #003DA6; margin: 0 0 2mm 0;">${t("Option B &mdash; T&eacute;l&eacute;chargement CSV (~30 min)", "Option B &mdash; CSV Download (~30 min)")}</p>
            <p style="font-size: 8pt; margin: 0 0 2mm 0;">${t("T&eacute;l&eacute;chargez vos fichiers depuis l'Espace Client Hydro-Qu&eacute;bec.", "Download your files from Hydro-Qu&eacute;bec's Online Portal.")}</p>
            <p style="font-size: 8pt; margin: 0;"><a href="https://kwh.quebec/blog/telecharger-donnees-espace-client-hydro-quebec" style="color: #003DA6; text-decoration: underline;">${t("Voir le guide &eacute;tape par &eacute;tape", "See the step-by-step guide")}</a></p>
          </div>
        </div>
        <p style="font-size: 8pt; color: #6b7280; margin: 0;">${t("R&eacute;sultat en 7 jours ouvrables apr&egrave;s r&eacute;ception des donn&eacute;es. Gratuit et sans engagement.", "Results within 7 business days after data reception. Free and without commitment.")}</p>
      </div>`
    : `<div class="section">
        <h3>${t("Prochaine &eacute;tape imm&eacute;diate", "Immediate next step")}</h3>
        <p>${t("Pour passer &agrave; l'&eacute;tape de conception d&eacute;taill&eacute;e :", "To proceed to the detailed design phase:")}</p>
        <ul class="bullet-list">
          <li>${t("Signer le mandat de conception en ligne", "Sign the design mandate online")}</li>
          <li>${t("Visite technique de votre b&acirc;timent sous 2 semaines", "Technical visit of your building within 2 weeks")}</li>
          <li>${t("Conception finale et soumission forfaitaire garantie 60 jours", "Final design and firm quote guaranteed 60 days")}</li>
          <li>${t("D&eacute;but des travaux sous 8-12 semaines", "Construction start within 8-12 weeks")}</li>
        </ul>
      </div>`;

  const faqHtml = `<div class="section">
        <h3>${t("Questions fr&eacute;quentes", "Frequently asked questions")}</h3>
        <div class="info-box" style="font-size: 9pt;">
          <p><strong>${t("Combien co&ucirc;te l'analyse d&eacute;taill&eacute;e et la validation &eacute;conomique de mon projet?", "How much does the detailed analysis and economic validation of my project cost?")}</strong><br>${t("Rien. L'&eacute;valuation d&eacute;taill&eacute;e est gratuite et sans engagement.", "Nothing. The detailed evaluation is free and without commitment.")}</p>
          <p style="margin: 0;"><strong>${t("Quand est-ce que je paie quelque chose?", "When do I pay anything?")}</strong><br>${t("&Agrave; la signature du Mandat de conception pr&eacute;liminaire (2 500$ + taxes), qui inclut la visite technique sur site, la confirmation du raccordement au r&eacute;seau, les plans pr&eacute;liminaires et une soumission forfaitaire pour l'ensemble du projet.", "At the signing of the Preliminary Design Mandate ($2,500 + taxes), which includes the on-site technical visit, grid connection confirmation, preliminary plans, and a firm quote for the entire project.")}</p>
        </div>
      </div>`;

  const ctaHtml = isSyntheticData
    ? `<div class="cta-box">
      <h3>${t("Pr&ecirc;t &agrave; passer &agrave; l'action?", "Ready to take action?")}</h3>
      <p>${t("Signez la procuration ou t&eacute;l&eacute;chargez vos donn&eacute;es pour d&eacute;marrer votre analyse d&eacute;taill&eacute;e gratuite", "Sign the authorization or download your data to start your free detailed analysis")}</p>
      <p style="font-size: 10pt; margin-top: 3mm;">
        <a href="https://kwh.quebec/analyse-detaillee" style="color: white; text-decoration: underline;">${t("Signer la procuration", "Sign authorization")}</a>
        &nbsp;&nbsp;|&nbsp;&nbsp;
        <a href="https://kwh.quebec/blog/telecharger-donnees-espace-client-hydro-quebec" style="color: white; text-decoration: underline;">${t("Guide CSV", "CSV Guide")}</a>
      </p>
      <p style="font-size: 14pt; margin-top: 3mm;">
        <strong>info@kwh.quebec</strong> &nbsp;|&nbsp; <strong>514-427-8871</strong>
      </p>
    </div>`
    : `<div class="cta-box">
      <h3>${t("Signez votre mandat de conception en ligne", "Sign your design mandate online")}</h3>
      <p>${t("Un lien s&eacute;curis&eacute; vous sera envoy&eacute; par courriel pour signer et compl&eacute;ter le paiement en ligne.", "A secure link will be sent to you by email to sign and complete the payment online.")}</p>
      <p style="font-size: 14pt; margin-top: 5mm;">
        <strong>info@kwh.quebec</strong> &nbsp;|&nbsp; <strong>514-427-8871</strong>
      </p>
      <p style="font-size: 10pt; margin-top: 3mm; opacity: 0.8;">kwh.quebec</p>
    </div>`;

  return `
  <div class="page">
    <h2>${t("Prochaines &eacute;tapes", "Next Steps")}</h2>
    <p class="subtitle">${t("Un processus simple et transparent", "A simple and transparent process")}</p>
    ${funnelStepsHtml}
    <div class="two-column" style="margin-top: 6mm;">
      ${immediateStepHtml}
      ${faqHtml}
    </div>
    ${ctaHtml}
    ${footerHtml(t, pageNum)}
  </div>`;
}

function buildDeliveryAssurancePage(
  t: (fr: string, en: string) => string,
  lang: "fr" | "en",
  pageNum: number
): string {
  const milestones = getDeliveryAssurance(lang);
  const partners = getDeliveryPartners(lang);
  const warranty = getWarrantyRoadmap(lang);

  const milestonesRows = milestones.map(m =>
    `<tr>
      <td><strong>${m.phase}</strong></td>
      <td>${m.duration}</td>
      <td>${m.deliverables}</td>
      <td>${m.qaCheckpoint}</td>
    </tr>`
  ).join("");

  const partnerCards = partners.map(p =>
    `<div class="partner-card">
      <p style="font-size: 8pt; font-weight: 700; color: #003DA6; margin: 0 0 1mm 0;">${p.role}</p>
      <p style="font-size: 9pt; font-weight: 600; margin: 0 0 1mm 0;">${p.name}</p>
      <p style="font-size: 7pt; color: #6b7280; margin: 0;">${p.qualification}</p>
    </div>`
  ).join("");

  const warrantyCards = warranty.map((w, i) => {
    const isFinal = i === warranty.length - 1;
    const cls = isFinal ? "warranty-card final" : "warranty-card";
    const periodStyle = isFinal ? "font-size: 10pt; font-weight: 700; color: #FFB005; margin: 0 0 2mm 0;" : "font-size: 10pt; font-weight: 700; color: #003DA6; margin: 0 0 2mm 0;";
    const itemStyle = isFinal ? "font-size: 8pt; color: rgba(255,255,255,0.9); margin: 0;" : "font-size: 8pt; color: #4a5568; margin: 0;";
    return `<div class="${cls}">
      <p style="${periodStyle}">${w.period}</p>
      <p style="${itemStyle}">${w.items}</p>
    </div>`;
  }).join("");

  return `
  <div class="page">
    <h2>${t("Assurance de livraison", "Project Delivery Assurance")}</h2>
    <table class="data-table">
      <tr>
        <th>Phase</th>
        <th>${t("Dur&eacute;e", "Duration")}</th>
        <th>${t("Livrables", "Deliverables")}</th>
        <th>${t("Point de contr&ocirc;le QA", "QA Checkpoint")}</th>
      </tr>
      ${milestonesRows}
    </table>
    <div class="section">
      <h3>${t("&Eacute;QUIPE DE LIVRAISON", "DELIVERY TEAM")}</h3>
      <div class="partner-grid">
        ${partnerCards}
      </div>
    </div>
    <div class="section">
      <h3>${t("PLAN DE SUPPORT ET GARANTIES", "WARRANTY &amp; SUPPORT ROADMAP")}</h3>
      <div class="warranty-grid">
        ${warrantyCards}
      </div>
    </div>
    <div class="info-box" style="background: #FFF8E1; border-left: 4px solid var(--accent); border-radius: 0;">
      <p style="font-size: 9pt; margin: 0;">
        <strong>${t("INTERCONNEXION Hydro-Qu&eacute;bec", "INTERCONNECTION Hydro-Qu&eacute;bec")}</strong> &mdash;
        ${t(
          "kWh g&egrave;re le processus complet. D&eacute;lai typique: 8-16 semaines. Risque faible pour syst&egrave;mes &lt; 1 MW.",
          "kWh manages the complete process. Typical delay: 8-16 weeks. Low risk for systems &lt; 1 MW."
        )}
      </p>
    </div>
    ${footerHtml(t, pageNum)}
  </div>`;
}

function buildFitScorePage(
  sim: DocumentSimulationData,
  t: (fr: string, en: string) => string,
  lang: "fr" | "en",
  pageNum: number
): string {
  const fitResult = computeFitScore({
    simplePaybackYears: sim.simplePaybackYears || null,
    irr25: (sim as any).irr25 || null,
    annualSavings: sim.annualSavings || null,
    annualCostBefore: sim.annualCostBefore || null,
    selfSufficiencyPercent: sim.selfSufficiencyPercent || null,
    capexNet: sim.capexNet || null,
  });

  const verdictLabel = lang === "fr" ? fitResult.labelFr : fitResult.labelEn;
  const pct = Math.round(fitResult.score);

  const factorRows = fitResult.factors.map(f => {
    const label = lang === "fr" ? f.labelFr : f.labelEn;
    const barPct = f.maxScore > 0 ? Math.round((f.score / f.maxScore) * 100) : 0;
    return `
    <div class="factor-row">
      <div class="factor-label">${label}</div>
      <div class="factor-bar">
        <div class="factor-bar-fill" style="width: ${barPct}%; background: ${f.barColor};"></div>
      </div>
      <div class="factor-value">${f.displayValue}</div>
      <div class="factor-score">${f.score}/${f.maxScore}</div>
    </div>`;
  }).join("");

  const assessmentItems = fitResult.factors.map(f => {
    const assessment = lang === "fr" ? f.assessmentFr : f.assessmentEn;
    return `<li style="font-size: 8.5pt; padding: 1mm 0;">${assessment}</li>`;
  }).join("");

  return `
  <div class="page">
    <h2>${t("&Eacute;valuation de faisabilit&eacute;", "Feasibility Assessment")}</h2>
    <p class="subtitle">${t("Score de compatibilit&eacute; solaire de votre projet", "Solar compatibility score for your project")}</p>
    <div style="text-align: center; margin: 8mm 0;">
      <div class="score-circle" style="border: 4px solid ${fitResult.color};">
        <span style="font-size: 28pt; font-weight: 700; color: ${fitResult.color};">${pct}</span>
        <span style="font-size: 10pt; color: #6b7280;">/100</span>
      </div>
      <p style="font-size: 14pt; font-weight: 600; color: ${fitResult.color}; margin-top: 4mm;">${verdictLabel}</p>
    </div>
    <div class="section">
      <h3>${t("Facteurs d'&eacute;valuation", "Evaluation Factors")}</h3>
      ${factorRows}
    </div>
    <div class="info-box" style="background: ${fitResult.color}; border-radius: 3mm; padding: 6mm;">
      <p style="margin: 0; color: white; font-size: 11pt; font-weight: 600; text-align: center;">
        ${verdictLabel} &mdash; ${pct}/100
      </p>
    </div>
    ${footerHtml(t, pageNum)}
  </div>`;
}

function buildCredibilityPage(
  t: (fr: string, en: string) => string,
  lang: "fr" | "en",
  pageNum: number
): string {
  const description = getCredibilityDescription(lang);

  const iconSvgs: Record<string, string> = {
    simplicite: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#003DA6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    fiabilite: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#003DA6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    longevite: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#003DA6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`,
    fierte: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#003DA6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>`,
  };

  const valueItems = [
    { id: "simplicite", label: t("Simplicit&eacute;", "Simplicity"), desc: t("Un seul interlocuteur de A &agrave; Z. Z&eacute;ro complexit&eacute; pour vous.", "One point of contact from A to Z. Zero complexity for you.") },
    { id: "fiabilite", label: t("Fiabilit&eacute;", "Reliability"), desc: t("&Eacute;quipements certifi&eacute;s, entrepreneur licenci&eacute; RBQ.", "Certified equipment, RBQ licensed contractor.") },
    { id: "longevite", label: t("Long&eacute;vit&eacute;", "Longevity"), desc: t("Syst&egrave;mes con&ccedil;us pour 25+ ans de performance garantie.", "Systems designed for 25+ years of guaranteed performance.") },
    { id: "fierte", label: t("Fiert&eacute;", "Pride"), desc: t("Entreprise qu&eacute;b&eacute;coise. Contribution &agrave; la transition &eacute;nerg&eacute;tique locale.", "Quebec company. Contributing to the local energy transition.") },
  ];

  const valuesHtml = valueItems.map(v =>
    `<div style="text-align: center; padding: 4mm; border: 1px solid #e5e7eb; border-radius: 3mm; flex: 1;">
      <div style="width: 36px; height: 36px; border-radius: 50%; background: rgba(0, 61, 166, 0.1); display: flex; align-items: center; justify-content: center; margin: 0 auto 3mm auto;">
        ${iconSvgs[v.id]}
      </div>
      <div style="font-weight: 600; font-size: 10pt; margin-bottom: 2mm;">${v.label}</div>
      <p style="font-size: 8pt; color: #6b7280; margin: 0;">${v.desc}</p>
    </div>`
  ).join("");

  const statItems = [
    { value: "15+", line1: t("ans", "years"), line2: t("d'exp&eacute;rience", "experience") },
    { value: "120", line1: "MW", line2: t("install&eacute;s", "installed") },
    { value: "25+", line1: t("projets", "projects"), line2: "C&amp;I" },
  ];

  const statsHtml = statItems.map(s =>
    `<div style="text-align: center; padding: 5mm 4mm; border: 1px solid #e5e7eb; border-radius: 3mm; flex: 1;">
      <div style="font-size: 24pt; font-weight: 700; color: #003DA6;">${s.value}</div>
      <div style="font-size: 10pt; font-weight: 600;">${s.line1}</div>
      <div style="font-size: 8pt; color: #6b7280;">${s.line2}</div>
    </div>`
  ).join("");

  return `
  <div class="page">
    <h2>${t("Pourquoi kWh Qu&eacute;bec?", "Why kWh Qu&eacute;bec?")}</h2>
    <p class="subtitle" style="font-size: 9pt; line-height: 1.5; max-width: 90%;">${description.replace(/'/g, "&rsquo;").replace(/é/g, "&eacute;").replace(/è/g, "&egrave;").replace(/ê/g, "&ecirc;").replace(/à/g, "&agrave;").replace(/ç/g, "&ccedil;")}</p>
    <div style="display: flex; gap: 4mm; margin: 6mm 0;">
      ${valuesHtml}
    </div>
    <div style="display: flex; gap: 4mm; margin: 6mm 0;">
      ${statsHtml}
    </div>
    <div class="cta-box">
      <h3>${t("Pr&ecirc;t &agrave; passer &agrave; l'&eacute;nergie solaire?", "Ready to switch to solar energy?")}</h3>
      <p>${t("Contactez-nous pour d&eacute;marrer votre projet", "Contact us to start your project")}</p>
      <p style="font-size: 14pt; margin-top: 5mm;">
        <strong>info@kwh.quebec</strong> &nbsp;|&nbsp; <strong>514-427-8871</strong>
      </p>
      <p style="font-size: 10pt; margin-top: 3mm; opacity: 0.8;">kwh.quebec</p>
    </div>
    ${footerHtml(t, pageNum)}
  </div>`;
}
