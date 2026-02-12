import puppeteer from "puppeteer";
import * as path from "path";
import * as fs from "fs";
import type { DocumentSimulationData } from "../documentDataProvider";
import { createLogger } from "../lib/logger";
import { getWhySolarNow, getEquipmentTechnicalSummary } from "@shared/brandContent";

const log = createLogger("PDFv2");

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
  const hasBattery = simulation.battEnergyKWh > 0;
  const hasRoofPolygons = !!(simulation.roofPolygons && simulation.roofPolygons.length > 0);

  let pageNum = 1;
  function nextPage(): number { return pageNum++; }

  const pages: string[] = [];

  pages.push(buildCoverPage(simulation, t, logoBase64, coverImageBase64, lang));
  nextPage();

  pages.push(buildAboutPage(simulation, t, nextPage()));
  pages.push(buildWhySolarNowPage(t, lang, nextPage()));
  pages.push(buildProjectSnapshotPage(simulation, t, totalProductionKWh, roofImageBase64, nextPage()));
  pages.push(buildResultsPage(simulation, t, totalProductionKWh, nextPage()));
  pages.push(buildNetInvestmentPage(simulation, t, nextPage()));

  if (hasHourlyProfile) {
    pages.push(buildEnergyProfilePage(simulation, t, totalProductionKWh, nextPage()));
  }

  if (hasBattery) {
    pages.push(buildStoragePage(simulation, t, nextPage()));
  }

  pages.push(buildFinancialProjectionsPage(simulation, t, totalProductionKWh, nextPage()));

  if (hasRoofPolygons) {
    pages.push(buildRoofConfigPage(simulation, t, roofImageBase64, nextPage()));
  }

  pages.push(buildEquipmentPage(simulation, t, lang, nextPage()));
  pages.push(buildAssumptionsPage(simulation, t, nextPage()));
  pages.push(buildTimelinePage(simulation, t, nextPage()));
  pages.push(buildNextStepsPage(simulation, t, nextPage()));

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${t("Rapport", "Report")} - ${simulation.site.name}</title>
<style>${getStyles()}</style>
</head>
<body>
${pages.join("\n")}
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
.bullet-list { list-style: none; padding-left: 0; }
.bullet-list li { padding: 2mm 0 2mm 6mm; position: relative; }
.bullet-list li::before { content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 3mm; height: 3mm; background: var(--accent); border-radius: 1px; }
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
.logo-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5mm; margin: 6mm 0; }
.logo-item { background: var(--light-gray); border-radius: 3mm; padding: 5mm; display: flex; align-items: center; justify-content: center; min-height: 18mm; font-size: 8pt; color: var(--gray); font-weight: 600; }
.cta-box { background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%); color: white; border-radius: 4mm; padding: 8mm; text-align: center; margin: 8mm 0; }
.cta-box h3 { color: white; font-size: 16pt; margin-bottom: 3mm; }
.cta-box p { color: rgba(255,255,255,0.9); font-size: 11pt; }
.funnel-steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4mm; margin: 6mm 0; }
.funnel-step { text-align: center; padding: 4mm; border-radius: 3mm; }
.funnel-step-number { width: 10mm; height: 10mm; background: var(--accent); color: var(--dark); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14pt; margin: 0 auto 3mm auto; }
.funnel-step-title { font-size: 10pt; font-weight: 600; color: var(--primary); margin-bottom: 2mm; }
.funnel-step-desc { font-size: 8pt; color: var(--gray); }
.funnel-step-tag { display: inline-block; background: var(--accent); color: var(--dark); font-size: 7pt; font-weight: 600; padding: 1mm 3mm; border-radius: 2mm; margin-top: 2mm; }
.funnel-step-tag.paid { background: var(--light-gray); color: var(--gray); }
.svg-chart { width: 100%; }
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
  lang: string
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
      <div class="cover-footer">
        <span>${t("Pr&eacute;par&eacute; le", "Prepared on")} ${date}</span>
        <span>kwh.quebec</span>
      </div>
    </div>
  </div>`;
}

function buildAboutPage(
  _sim: DocumentSimulationData,
  t: (fr: string, en: string) => string,
  pageNum: number
): string {
  const svgIcon = (svg: string, color: string) =>
    `<div class="pillar-icon" style="background: ${color}15; display: flex; align-items: center; justify-content: center;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svg}</svg>
    </div>`;

  const iconSimplicity = `<path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/>`;
  const iconReliability = `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>`;
  const iconLongevity = `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`;
  const iconPride = `<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>`;

  return `
  <div class="page">
    <h2>${t("Qui sommes-nous", "About Us")}</h2>
    <p class="subtitle">${t("Votre partenaire solaire cl&eacute; en main au Qu&eacute;bec", "Your turnkey solar partner in Qu&eacute;bec")}</p>
    <p style="margin-bottom: 6mm;">
      <strong>kWh Qu&eacute;bec</strong> ${t(
        "con&ccedil;oit, installe et entretient des syst&egrave;mes solaires et de stockage d'&eacute;nergie pour les b&acirc;timents commerciaux et industriels. De l'analyse initiale &agrave; la mise en service,",
        "designs, installs and maintains solar and energy storage systems for commercial and industrial buildings. From initial analysis to commissioning,"
      )}
      <strong>${t("on s'occupe de tout.", "we take care of everything.")}</strong>
    </p>
    <div class="metrics-grid-4" style="margin-bottom: 6mm;">
      <div class="metric-card metric-highlight">
        <span class="metric-value" style="font-size: 20pt;">120+ MW</span>
        <span class="metric-label">${t("Install&eacute;s", "Installed")}</span>
      </div>
      <div class="metric-card">
        <span class="metric-value" style="font-size: 20pt;">25+</span>
        <span class="metric-label">${t("Projets compl&eacute;t&eacute;s", "Completed Projects")}</span>
      </div>
      <div class="metric-card">
        <span class="metric-value" style="font-size: 20pt;">15+ ${t("ans", "yrs")}</span>
        <span class="metric-label">${t("Exp&eacute;rience", "Experience")}</span>
      </div>
      <div class="metric-card metric-accent">
        <span class="metric-value" style="font-size: 20pt;">100%</span>
        <span class="metric-label">${t("Cl&eacute; en main", "Turnkey")}</span>
      </div>
    </div>
    <div class="section">
      <h3>${t("Notre approche", "Our Approach")}</h3>
      <div class="metrics-grid-4">
        <div class="pillar-card">
          ${svgIcon(iconSimplicity, "#FFB005")}
          <div class="pillar-title">${t("Simplicit&eacute;", "Simplicity")}</div>
          <p class="pillar-desc">${t("Un seul interlocuteur de A &agrave; Z. Z&eacute;ro complexit&eacute; pour vous.", "One point of contact from A to Z. Zero complexity for you.")}</p>
        </div>
        <div class="pillar-card">
          ${svgIcon(iconReliability, "#003DA6")}
          <div class="pillar-title">${t("Fiabilit&eacute;", "Reliability")}</div>
          <p class="pillar-desc">${t("&Eacute;quipements certifi&eacute;s, entrepreneur licenci&eacute; RBQ.", "Certified equipment, RBQ licensed contractor.")}</p>
        </div>
        <div class="pillar-card">
          ${svgIcon(iconLongevity, "#16a34a")}
          <div class="pillar-title">${t("Long&eacute;vit&eacute;", "Longevity")}</div>
          <p class="pillar-desc">${t("Syst&egrave;mes con&ccedil;us pour 25+ ans de performance garantie.", "Systems designed for 25+ years of guaranteed performance.")}</p>
        </div>
        <div class="pillar-card">
          ${svgIcon(iconPride, "#DC2626")}
          <div class="pillar-title">${t("Fiert&eacute;", "Pride")}</div>
          <p class="pillar-desc">${t("Entreprise qu&eacute;b&eacute;coise. Contribution &agrave; la transition &eacute;nerg&eacute;tique locale.", "Quebec company. Contributing to the local energy transition.")}</p>
        </div>
      </div>
    </div>
    <div class="section">
      <h3>${t("Ils nous font confiance", "They Trust Us")}</h3>
      <div class="logo-grid">
        <div class="logo-item" style="font-size: 10pt; font-weight: 800; color: #1a365d; letter-spacing: -0.3px;">dream<span style="font-weight: 400;"> Industrial REIT</span></div>
        <div class="logo-item" style="font-size: 10pt; font-weight: 700; color: #2563eb; letter-spacing: 0.5px;">LAB<span style="font-weight: 400; color: #64748b;"> Space</span></div>
        <div class="logo-item" style="font-size: 10pt; font-weight: 700; color: #16a34a; letter-spacing: -0.2px;">Scale <span style="font-weight: 400;">Cleantech</span></div>
        <div class="logo-item" style="font-size: 10pt; font-weight: 700; color: #003DA6;">Hydro-Qu&eacute;bec</div>
      </div>
    </div>
    <div class="two-column">
      <div class="info-box">
        <h3 style="color: var(--primary); margin-bottom: 2mm; font-size: 11pt;">${t("Certifications", "Certifications")}</h3>
        <ul class="bullet-list" style="font-size: 9pt;">
          <li>${t("Licence RBQ 1.3 &mdash; Entrepreneur g&eacute;n&eacute;ral", "RBQ License 1.3 &mdash; General Contractor")}</li>
          <li>${t("Membre CNESST", "CNESST Member")}</li>
          <li>${t("Membre CCQ", "CCQ Member")}</li>
          <li>${t("Assurances 5 M$", "$5M Insurance Coverage")}</li>
        </ul>
      </div>
      <div class="info-box">
        <h3 style="color: var(--primary); margin-bottom: 2mm; font-size: 11pt;">${t("Nos services", "Our Services")}</h3>
        <ul class="bullet-list" style="font-size: 9pt;">
          <li>${t("Analyse & conception solaire", "Solar analysis & design")}</li>
          <li>${t("Stockage par batteries (BESS)", "Battery storage (BESS)")}</li>
          <li>${t("Ing&eacute;nierie & construction", "Engineering & construction")}</li>
          <li>${t("Op&eacute;ration & maintenance", "Operations & maintenance")}</li>
        </ul>
      </div>
    </div>
    ${footerHtml(t, pageNum)}
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
  pageNum: number
): string {
  const co2Trees = Math.round(sim.co2AvoidedTonnesPerYear * 45);
  const co2Cars = Math.round(sim.co2AvoidedTonnesPerYear / 4.6);

  const satelliteHtml = roofImageBase64
    ? `<img src="${roofImageBase64}" style="width: 100%; height: 70mm; object-fit: cover; border-radius: 2mm;" />`
    : `<div style="height: 70mm; background: linear-gradient(135deg, #ccdcf0 0%, #a3bfe0 100%); border-radius: 2mm; display: flex; align-items: center; justify-content: center; color: #003DA6; font-weight: 600;">${t("[Image satellite Google Solar API]", "[Google Solar API Satellite Image]")}</div>`;

  return `
  <div class="page">
    <h2>${t("Aper&ccedil;u du projet", "Project Snapshot")}</h2>
    <div class="metrics-grid">
      <div class="metric-card metric-highlight">
        <span class="metric-value">${fmt(sim.pvSizeKW)} kW</span>
        <span class="metric-label">${t("Puissance syst&egrave;me", "System Power")}</span>
      </div>
      <div class="metric-card">
        <span class="metric-value">${fmt(totalProductionKWh)}</span>
        <span class="metric-label">kWh/${t("an", "yr")} ${t("Production", "Production")}</span>
      </div>
      <div class="metric-card">
        <span class="metric-value">${Math.round(sim.selfSufficiencyPercent)}%</span>
        <span class="metric-label">${t("Couverture &eacute;nerg&eacute;tique", "Energy Coverage")}</span>
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
          <p><strong>${t("CO2 &eacute;vit&eacute;:", "CO2 avoided:")}</strong> ${fmt(sim.co2AvoidedTonnesPerYear)} ${t("tonnes/an", "tonnes/yr")}</p>
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
          `Gr&acirc;ce aux incitatifs f&eacute;d&eacute;ral (ITC) et provincial (Autoproduction HQ), votre investissement net n'est que de <strong>${smartCur(sim.capexNet)}</strong>, r&eacute;cup&eacute;r&eacute; en <strong>${paybackStr} ans</strong>. Votre syst&egrave;me g&eacute;n&egrave;re ensuite des &eacute;conomies nettes pendant plus de 22 ans.`,
          `Thanks to federal (ITC) and provincial (HQ Self-Production) incentives, your net investment is only <strong>${smartCur(sim.capexNet)}</strong>, recovered in <strong>${paybackStr} years</strong>. Your system then generates net savings for over 22 years.`
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
    { label: t("Incitatif HQ", "HQ Incentive"), value: hq, color: "#FFB005", isNeg: true },
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
        <tr><td>${t("Co&ucirc;t du syst&egrave;me (installation compl&egrave;te cl&eacute; en main)", "System cost (complete turnkey installation)")}</td><td class="number">${cur(sim.capexGross)}</td></tr>
        <tr><td>${t("Cr&eacute;dit d'imp&ocirc;t &agrave; l'investissement f&eacute;d&eacute;ral (ITC)", "Federal Investment Tax Credit (ITC)")}</td><td class="number" style="color: #16a34a;">-${cur(sim.incentivesFederal)}</td></tr>
        <tr><td>${t("Incitatif Hydro-Qu&eacute;bec autoproduction", "Hydro-Qu&eacute;bec Self-Production Incentive")}${sim.incentivesHQSolar > 0 && sim.incentivesHQBattery > 0 ? ` (${t("Solaire", "Solar")}: ${cur(sim.incentivesHQSolar)}, ${t("Batterie", "Battery")}: ${cur(sim.incentivesHQBattery)})` : ""}</td><td class="number" style="color: #FFB005;">-${cur(sim.incentivesHQ)}</td></tr>
        ${sim.taxShield > 0 ? `<tr><td>${t("Bouclier fiscal (amortissement acc&eacute;l&eacute;r&eacute;)", "Tax shield (accelerated depreciation)")}</td><td class="number" style="color: #16a34a;">-${cur(sim.taxShield)}</td></tr>` : ""}
        <tr class="total-row"><td><strong>${t("INVESTISSEMENT NET", "NET INVESTMENT")}</strong></td><td class="number"><strong>${cur(sim.capexNet)}</strong></td></tr>
      </table>
    </div>
    <div class="info-box" style="background: #FFF8E1; border-left: 4px solid var(--accent); border-radius: 0;">
      <p style="font-size: 9pt; margin: 0;"><strong>${t("Conditions:", "Conditions:")}</strong> ${t(
        "L'ITC f&eacute;d&eacute;ral s'applique aux projets d'&eacute;nergie propre admissibles (Loi C-69). L'incitatif HQ Autoproduction est plafonn&eacute; &agrave; 1 000 $/kW (max 1 MW) et 40% du CAPEX.",
        "The federal ITC applies to eligible clean energy projects (Bill C-69). The HQ Self-Production incentive is capped at $1,000/kW (max 1 MW) and 40% of CAPEX."
      )}</p>
    </div>
    ${footerHtml(t, pageNum)}
  </div>`;
}

function buildEnergyProfilePage(
  sim: DocumentSimulationData,
  t: (fr: string, en: string) => string,
  totalProductionKWh: number,
  pageNum: number
): string {
  const profile = sim.hourlyProfile!;

  const avgByHour: { hour: number; consumption: number; production: number }[] = [];
  for (let h = 0; h < 24; h++) {
    const entries = profile.filter(e => e.hour === h);
    if (entries.length > 0) {
      avgByHour.push({
        hour: h,
        consumption: entries.reduce((s, e) => s + e.consumption, 0) / entries.length,
        production: entries.reduce((s, e) => s + e.production, 0) / entries.length,
      });
    } else {
      avgByHour.push({ hour: h, consumption: 0, production: 0 });
    }
  }

  const maxVal = Math.max(...avgByHour.map(d => Math.max(d.consumption, d.production)), 1);
  const svgW = 600;
  const svgH = 180;
  const pad = { top: 20, bottom: 30, left: 40, right: 10 };
  const chartW = svgW - pad.left - pad.right;
  const chartH = svgH - pad.top - pad.bottom;
  const barGroupW = chartW / 24;
  const barW = barGroupW * 0.35;

  let bars = "";
  avgByHour.forEach((d, i) => {
    const x = pad.left + i * barGroupW;
    const cH = (d.consumption / maxVal) * chartH;
    const sH = (d.production / maxVal) * chartH;
    bars += `<rect x="${x}" y="${pad.top + chartH - cH}" width="${barW}" height="${cH}" fill="#003DA6" opacity="0.4" rx="1"/>`;
    bars += `<rect x="${x + barW + 1}" y="${pad.top + chartH - sH}" width="${barW}" height="${sH}" fill="#FFB005" rx="1"/>`;
    if (i % 3 === 0) {
      bars += `<text x="${x + barGroupW / 2}" y="${svgH - 5}" text-anchor="middle" font-size="8" fill="#6b7280">${d.hour}h</text>`;
    }
  });
  bars += `<line x1="${pad.left}" y1="${pad.top + chartH}" x2="${svgW - pad.right}" y2="${pad.top + chartH}" stroke="#e5e7eb" stroke-width="1"/>`;

  const hourlyChartSVG = `<svg viewBox="0 0 ${svgW} ${svgH}" class="svg-chart" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;

  const monthlyBarsSVG = generateMonthlyProductionSVG(totalProductionKWh, t);

  return `
  <div class="page">
    <h2>${t("Profil &eacute;nerg&eacute;tique", "Energy Profile")}</h2>
    <p class="subtitle">${t("Simulation heure par heure - votre consommation vs production solaire", "Hour-by-hour simulation - your consumption vs solar production")}</p>
    <div class="chart-container">
      <div class="chart-title">${t("Profil journalier type", "Typical Daily Profile")}</div>
      <div class="legend">
        <div class="legend-item"><div class="legend-dot" style="background: var(--primary); opacity: 0.4;"></div> ${t("Consommation", "Consumption")}</div>
        <div class="legend-item"><div class="legend-dot" style="background: var(--accent);"></div> ${t("Production solaire", "Solar production")}</div>
      </div>
      ${hourlyChartSVG}
    </div>
    <div class="metrics-grid">
      <div class="metric-card">
        <span class="metric-value" style="font-size: 18pt;">${Math.round(sim.selfSufficiencyPercent)}%</span>
        <span class="metric-label">${t("Taux autoconsommation", "Self-Consumption Rate")}</span>
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
        <h3 style="font-size: 11pt; color: var(--primary); margin-bottom: 3mm;">${t("Analyse bas&eacute;e sur donn&eacute;es r&eacute;elles", "Analysis Based on Real Data")}</h3>
        <p style="font-size: 9pt;">${t(
          "Notre simulation utilise vos <strong>donn&eacute;es de consommation Hydro-Qu&eacute;bec r&eacute;elles</strong> (via procuration) crois&eacute;es avec les donn&eacute;es d'ensoleillement satellite <strong>Google Solar API</strong>.",
          "Our simulation uses your <strong>real Hydro-Qu&eacute;bec consumption data</strong> (via power of attorney) cross-referenced with <strong>Google Solar API</strong> satellite irradiance data."
        )}</p>
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
            "La batterie se d&eacute;charge pendant vos pointes de demande, r&eacute;duisant votre appel de puissance factur&eacute; par HQ.",
            "The battery discharges during your peak demand, reducing your billed power draw from HQ."
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
  interface CFPoint { year: number; cumulative: number; }
  let points: CFPoint[] = [];

  if (sim.cashflows && sim.cashflows.length > 0) {
    points = sim.cashflows.map(cf => ({ year: cf.year, cumulative: cf.cumulative }));
  } else {
    const baseSavings = sim.savingsYear1 || sim.annualSavings;
    let cum = -(sim.capexNet || 0);
    for (let y = 1; y <= 25; y++) {
      const deg = Math.pow(0.995, y - 1);
      const inf = Math.pow(1.035, y - 1);
      const yearSavings = baseSavings * deg * inf;
      cum += yearSavings;
      points.push({ year: y, cumulative: Math.round(cum) });
    }
  }

  if (points.length === 0) return "";

  const minVal = Math.min(...points.map(p => p.cumulative), 0);
  const maxVal = Math.max(...points.map(p => p.cumulative), 1);
  const range = maxVal - minVal || 1;

  const svgW = 580;
  const svgH = 180;
  const pad = { top: 20, bottom: 30, left: 50, right: 15 };
  const chartW = svgW - pad.left - pad.right;
  const chartH = svgH - pad.top - pad.bottom;

  const zeroY = pad.top + (maxVal / range) * chartH;
  const barW = chartW / points.length * 0.7;

  let bars = "";
  bars += `<line x1="${pad.left}" y1="${zeroY}" x2="${svgW - pad.right}" y2="${zeroY}" stroke="#9ca3af" stroke-width="1" stroke-dasharray="4,3"/>`;
  bars += `<text x="${pad.left - 5}" y="${zeroY + 3}" text-anchor="end" font-size="8" fill="#6b7280">0</text>`;

  let paybackYear = -1;
  points.forEach((p, i) => {
    const x = pad.left + i * (chartW / points.length) + (chartW / points.length - barW) / 2;
    const valH = Math.abs(p.cumulative) / range * chartH;
    const isPositive = p.cumulative >= 0;
    const y = isPositive ? zeroY - valH : zeroY;

    if (isPositive && paybackYear < 0) paybackYear = p.year;

    const color = isPositive ? "#003DA6" : "#DC2626";
    bars += `<rect x="${x}" y="${y}" width="${barW}" height="${Math.max(valH, 1)}" fill="${color}" opacity="0.7" rx="1"/>`;

    if (p.year === 1 || p.year === 5 || p.year === 10 || p.year === 15 || p.year === 20 || p.year === 25 || p.year === paybackYear) {
      bars += `<text x="${x + barW / 2}" y="${svgH - 8}" text-anchor="middle" font-size="7" fill="#6b7280">${t("An", "Yr")} ${p.year}</text>`;
    }
  });

  if (paybackYear > 0) {
    const pbIdx = points.findIndex(p => p.year === paybackYear);
    if (pbIdx >= 0) {
      const pbX = pad.left + pbIdx * (chartW / points.length) + (chartW / points.length) / 2;
      bars += `<line x1="${pbX}" y1="${pad.top}" x2="${pbX}" y2="${pad.top + chartH}" stroke="#FFB005" stroke-width="2" stroke-dasharray="5,3"/>`;
      bars += `<text x="${pbX}" y="${pad.top - 5}" text-anchor="middle" font-size="9" font-weight="600" fill="#FFB005">${t("R&eacute;cup&eacute;ration", "Payback")}</text>`;
    }
  }

  return `<svg viewBox="0 0 ${svgW} ${svgH}" class="svg-chart" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
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
      <h3 style="font-size: 10pt; color: #16a34a; margin-bottom: 2mm;">${t("Cr&eacute;dits surplus - mesurage net HQ", "Surplus Credits - HQ Net Metering")}</h3>
      <p style="font-size: 9pt; margin: 0;">
        ${t(
          `<strong>${fmt(sim.totalExportedKWh)} kWh</strong> export&eacute;s annuellement vers le r&eacute;seau HQ. Banque de cr&eacute;dits sur 24 mois au taux de r&eacute;f&eacute;rence (~4,54&cent;/kWh). Revenu surplus estim&eacute;: <strong>${cur(sim.annualSurplusRevenue)}/an</strong>.`,
          `<strong>${fmt(sim.totalExportedKWh)} kWh</strong> exported annually to HQ grid. 24-month credit bank at reference rate (~4.54&cent;/kWh). Estimated surplus revenue: <strong>${cur(sim.annualSurplusRevenue)}/yr</strong>.`
        )}
      </p>
    </div>` : "";

  return `
  <div class="page">
    <h2>${t("Projections financi&egrave;res", "Financial Projections")}</h2>
    <p class="subtitle">${t("&Eacute;volution sur 25 ans avec inflation &eacute;nerg&eacute;tique de 3,5%/an", "25-year evolution with 3.5%/yr energy inflation")}</p>
    ${cashflowSVG ? `<div class="chart-container">
      <div class="chart-title">${t("Flux de tr&eacute;sorerie cumulatif", "Cumulative Cash Flow")}</div>
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
  const defaultEquipment = [
    { name: t("Panneaux solaires", "Solar panels"), manufacturer: "Canadian Solar", warranty: t("25 ans produit, 30 ans performance", "25 yr product, 30 yr performance"), spec: "≥ 580 Wc mono PERC", weight: "32.2 kg", dimensions: "2278 × 1134 × 35 mm", category: "panels" },
    { name: t("Onduleurs", "Inverters"), manufacturer: "SolarEdge / Huawei", warranty: t("12 ans (extensible 25 ans)", "12 yr (ext. to 25 yr)"), spec: t("String triphasé ≥ 100 kW", "Three-phase string ≥ 100 kW"), weight: "88 kg", dimensions: "1035 × 700 × 363 mm", category: "inverters" },
    { name: t("Optimiseurs", "Optimizers"), manufacturer: "SolarEdge", warranty: t("25 ans", "25 yr"), spec: "P401", weight: "—", dimensions: "—", category: "optimizers" },
    { name: t("Structure de montage", "Racking"), manufacturer: "KB Racking", warranty: t("20 ans", "20 yr"), spec: "EcoFoot2+", weight: t("~4.5 kg/m²", "~4.5 kg/m²"), dimensions: "—", category: "racking" },
    { name: t("Monitoring", "Monitoring"), manufacturer: "SolarEdge", warranty: t("Inclus &agrave; vie", "Included for life"), spec: "Cloud Platform", weight: "—", dimensions: "—", category: "monitoring" },
  ];

  if (sim.battEnergyKWh > 0) {
    defaultEquipment.splice(3, 0, {
      name: t("Batterie BESS", "BESS Battery"),
      manufacturer: "BYD",
      warranty: t("10 ans / 6 000 cycles", "10 yr / 6,000 cycles"),
      spec: "Battery-Box Premium",
      weight: "—",
      dimensions: "—",
      category: "battery",
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
        <th>${t("Poids", "Weight")}</th>
        <th>${t("Dimensions", "Dimensions")}</th>
        <th>${t("Garantie", "Warranty")}</th>
      </tr>
      ${equipment.map(eq => `
      <tr>
        <td><strong>${eq.name}</strong></td>
        <td>${eq.manufacturer}</td>
        <td>${eq.spec}</td>
        <td>${(eq as any).weight || "—"}</td>
        <td>${(eq as any).dimensions || "—"}</td>
        <td>${eq.warranty}</td>
      </tr>`).join("")}
    </table>
    <div class="two-column" style="margin-top: 8mm;">
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
          <p><strong>${t("Performance garantie:", "Guaranteed performance:")}</strong> ${t("90% &agrave; 10 ans, 85% &agrave; 25 ans", "90% at 10 yrs, 85% at 25 yrs")}</p>
          <p><strong>${t("Monitoring:", "Monitoring:")}</strong> ${t("Suivi continu inclus", "Continuous monitoring included")}</p>
        </div>
      </div>
    </div>
    <div class="section" style="margin-top: 6mm; padding: 4mm 5mm; background: #f0f4f8; border-radius: 2mm;">
      <h3 style="margin-bottom: 3mm;">${t("Donn&eacute;es structurelles pour &eacute;valuation de toiture", "Structural Data for Roof Evaluation")}</h3>
      <table class="data-table" style="margin-bottom: 0;">
        <tr>
          <th>${t("Param&egrave;tre", "Parameter")}</th>
          <th>${t("Valeur", "Value")}</th>
        </tr>
        <tr><td>${techSummary.panelWeightKgPerM2.label}</td><td><strong>${techSummary.panelWeightKgPerM2.value} ${techSummary.panelWeightKgPerM2.unit}</strong></td></tr>
        <tr><td>${techSummary.rackingWeightKgPerM2.label}</td><td><strong>${techSummary.rackingWeightKgPerM2.value} ${techSummary.rackingWeightKgPerM2.unit}</strong></td></tr>
        <tr class="total-row"><td>${techSummary.totalSystemWeightKgPerM2.label}</td><td><strong>${techSummary.totalSystemWeightKgPerM2.value} ${techSummary.totalSystemWeightKgPerM2.unit} (${techSummary.totalSystemWeightPsfPerSf.value} ${techSummary.totalSystemWeightPsfPerSf.unit})</strong></td></tr>
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
  pageNum: number
): string {
  const assumptions = [
    t("Tarif HQ en vigueur (&eacute;nergie + puissance)", "Current HQ rate (energy + demand)"),
    t("Inflation &eacute;nerg&eacute;tique annuelle: 3,5%", "Annual energy inflation: 3.5%"),
    t("D&eacute;gradation panneaux: 0,5%/an", "Panel degradation: 0.5%/yr"),
    t("Dur&eacute;e de vie syst&egrave;me: 25 ans minimum", "System life: 25 years minimum"),
    t("Taux d'actualisation: 6%", "Discount rate: 6%"),
    t("Rendement solaire: ~1 035 kWh/kWc (base Qu&eacute;bec)", "Solar yield: ~1,035 kWh/kWp (Quebec baseline)"),
    t("Efficacit&eacute; syst&egrave;me: ~90%", "System efficiency: ~90%"),
    t("ITC f&eacute;d&eacute;ral: 30% du CAPEX brut", "Federal ITC: 30% of gross CAPEX"),
    t("HQ Autoproduction: 1 000 $/kW (plafond 40% CAPEX)", "HQ Self-Production: $1,000/kW (40% CAPEX cap)"),
  ];

  const exclusions = [
    t("Travaux de toiture pr&eacute;alables (si requis)", "Prior roofing work (if required)"),
    t("Mise &agrave; niveau du panneau &eacute;lectrique (si requis)", "Electrical panel upgrade (if required)"),
    t("Permis municipaux (variables selon localit&eacute;)", "Municipal permits (varies by location)"),
    t("&Eacute;tudes structurales additionnelles", "Additional structural studies"),
    t("Travaux de g&eacute;nie civil (si requis)", "Civil engineering work (if required)"),
  ];

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
        <p><strong>${t("Consommation:", "Consumption:")}</strong> ${t("Donn&eacute;es Hydro-Qu&eacute;bec r&eacute;elles (via procuration)", "Real Hydro-Qu&eacute;bec data (via power of attorney)")}</p>
        <p><strong>${t("Tarifs &eacute;lectriques:", "Electricity rates:")}</strong> Hydro-Qu&eacute;bec ${t("tarifs en vigueur 2026", "rates in effect 2026")}</p>
        <p><strong>${t("ITC f&eacute;d&eacute;ral:", "Federal ITC:")}</strong> ${t("Loi C-69 - Cr&eacute;dit d'imp&ocirc;t &agrave; l'investissement pour technologies propres", "Bill C-69 - Clean technology investment tax credit")}</p>
        <p><strong>${t("Autoproduction HQ:", "HQ Self-Production:")}</strong> ${t("Programme Autoproduction d'Hydro-Qu&eacute;bec", "Hydro-Qu&eacute;bec Self-Production Program")}</p>
      </div>
    </div>
    <div class="info-box highlight">
      <p style="margin: 0; color: rgba(255,255,255,0.95);">
        <strong>Important:</strong> ${t(
          "Cette &eacute;tude pr&eacute;liminaire est bas&eacute;e sur les informations disponibles et une analyse &agrave; distance. Une visite technique et une analyse d&eacute;taill&eacute;e confirmeront les param&egrave;tres finaux, l'admissibilit&eacute; aux incitatifs, et le devis d&eacute;finitif.",
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
  pageNum: number
): string {
  const defaultTimeline = [
    { step: t("Visite technique & conception", "Technical Visit & Design"), duration: t("Semaine 1-2", "Week 1-2"), desc: t("Relev&eacute;s sur site, analyse structurale, conception finale du syst&egrave;me", "On-site measurements, structural analysis, final system design") },
    { step: t("Permis & approbations", "Permits & Approvals"), duration: t("Semaine 3-4", "Week 3-4"), desc: t("Demande de permis municipal, approbation Hydro-Qu&eacute;bec pour le raccordement", "Municipal permit application, Hydro-Qu&eacute;bec connection approval") },
    { step: t("Approvisionnement", "Procurement"), duration: t("Semaine 5-6", "Week 5-6"), desc: t("Commande et livraison des &eacute;quipements sur site", "Equipment ordering and on-site delivery") },
    { step: t("Installation", "Installation"), duration: t("Semaine 7-10", "Week 7-10"), desc: t("Montage structure, installation panneaux et batterie, c&acirc;blage &eacute;lectrique", "Racking assembly, panel and battery installation, electrical wiring") },
    { step: t("Inspection & raccordement", "Inspection & Connection"), duration: t("Semaine 11", "Week 11"), desc: t("Inspection &eacute;lectrique, raccordement au r&eacute;seau Hydro-Qu&eacute;bec", "Electrical inspection, Hydro-Qu&eacute;bec grid connection") },
    { step: t("Mise en service & formation", "Commissioning & Training"), duration: t("Semaine 12", "Week 12"), desc: t("Activation du syst&egrave;me, configuration monitoring, formation &eacute;quipe client", "System activation, monitoring setup, client team training") },
  ];

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
  pageNum: number
): string {
  return `
  <div class="page">
    <h2>${t("Prochaines &eacute;tapes", "Next Steps")}</h2>
    <p class="subtitle">${t("Un processus simple et transparent", "A simple and transparent process")}</p>
    <div class="funnel-steps">
      <div class="funnel-step">
        <div class="funnel-step-number">1</div>
        <div class="funnel-step-title">${t("&Eacute;valuation d&eacute;taill&eacute;e", "Detailed Evaluation")}</div>
        <p class="funnel-step-desc">${t("Procuration HQ + analyse compl&egrave;te avec donn&eacute;es r&eacute;elles. Pr&eacute;cision ~95%.", "HQ power of attorney + complete analysis with real data. ~95% accuracy.")}</p>
        <span class="funnel-step-tag">${t("GRATUIT", "FREE")}</span>
      </div>
      <div class="funnel-step">
        <div class="funnel-step-number">2</div>
        <div class="funnel-step-title">${t("Visite & design", "Visit & Design")}</div>
        <p class="funnel-step-desc">${t("Inspection sur site, conception finale, devis ferme garanti 60 jours.", "On-site inspection, final design, firm quote guaranteed 60 days.")}</p>
        <span class="funnel-step-tag paid">${t("DEVIS FORMEL", "FORMAL QUOTE")}</span>
      </div>
      <div class="funnel-step">
        <div class="funnel-step-number">3</div>
        <div class="funnel-step-title">${t("Ing&eacute;nierie & construction", "Engineering & Construction")}</div>
        <p class="funnel-step-desc">${t("Plans PE, permis, installation cl&eacute; en main. On s'occupe de tout.", "PE drawings, permits, turnkey installation. We handle everything.")}</p>
        <span class="funnel-step-tag paid">8-12 ${t("SEMAINES", "WEEKS")}</span>
      </div>
      <div class="funnel-step">
        <div class="funnel-step-number">4</div>
        <div class="funnel-step-title">${t("Monitoring & O&M", "Monitoring & O&M")}</div>
        <p class="funnel-step-desc">${t("Suivi en temps r&eacute;el, maintenance pr&eacute;ventive, performance garantie.", "Real-time monitoring, preventive maintenance, guaranteed performance.")}</p>
        <span class="funnel-step-tag paid">${t("CONTINU", "ONGOING")}</span>
      </div>
    </div>
    <div class="two-column" style="margin-top: 6mm;">
      <div class="section">
        <h3>${t("Prochaine &eacute;tape imm&eacute;diate", "Immediate next step")}</h3>
        <p>${t("Pour passer de cette &eacute;tude pr&eacute;liminaire &agrave; une analyse d&eacute;taill&eacute;e avec vos donn&eacute;es r&eacute;elles :", "To move from this preliminary study to a detailed analysis with your real data:")}</p>
        <ul class="bullet-list">
          <li>${t("Signer la procuration Hydro-Qu&eacute;bec (&eacute;lectronique, 2 minutes)", "Sign the Hydro-Qu&eacute;bec power of attorney (electronic, 2 minutes)")}</li>
          <li>${t("Nous acc&eacute;dons &agrave; votre historique de consommation complet", "We access your complete consumption history")}</li>
          <li>${t("Simulation heure par heure personnalis&eacute;e", "Personalized hour-by-hour simulation")}</li>
          <li>${t("R&eacute;sultat en 5 jours ouvrables", "Results within 5 business days")}</li>
        </ul>
      </div>
      <div class="section">
        <h3>${t("Questions fr&eacute;quentes", "Frequently asked questions")}</h3>
        <div class="info-box" style="font-size: 9pt;">
          <p><strong>${t("Combien &ccedil;a co&ucirc;te de signer la procuration?", "How much does signing the power of attorney cost?")}</strong><br>${t("Rien. L'&eacute;valuation d&eacute;taill&eacute;e est gratuite et sans engagement.", "Nothing. The detailed evaluation is free and without commitment.")}</p>
          <p><strong>${t("Quand est-ce que je paie quelque chose?", "When do I pay anything?")}</strong><br>${t("Seulement apr&egrave;s la visite technique, quand vous approuvez le devis formel.", "Only after the technical visit, when you approve the formal quote.")}</p>
          <p style="margin: 0;"><strong>${t("Le devis peut-il changer?", "Can the quote change?")}</strong><br>${t("Le devis formel est garanti 60 jours, prix ferme.", "The formal quote is guaranteed 60 days, firm price.")}</p>
        </div>
      </div>
    </div>
    <div class="cta-box">
      <h3>${t("Pr&ecirc;t &agrave; passer &agrave; l'action?", "Ready to take action?")}</h3>
      <p>${t("Contactez-nous pour d&eacute;marrer votre &eacute;valuation d&eacute;taill&eacute;e gratuite", "Contact us to start your free detailed evaluation")}</p>
      <p style="font-size: 14pt; margin-top: 5mm;">
        <strong>evaluation@kwh.quebec</strong> &nbsp;|&nbsp; <strong>514-427-8871</strong>
      </p>
      <p style="font-size: 10pt; margin-top: 3mm; opacity: 0.8;">kwh.quebec</p>
    </div>
    ${footerHtml(t, pageNum)}
  </div>`;
}
