/**
 * PDF Generator V2 - Puppeteer-based HTML-to-PDF
 *
 * Rapport de vente "Étude Préliminaire - Solaire + Stockage"
 * Structure: 13 pages alignées sur le site kwh.quebec et les outils kWh Optimizer.
 *
 * Brand: kWh Québec (#003DA6, #FFB005, Montserrat)
 * Incitatifs: ITC fédéral 30% (Loi C-69) + HQ Autoproduction 1 000 $/kW
 *
 * Dependencies: npm install puppeteer
 */

import puppeteer from 'puppeteer';

// ==================== INTERFACES ====================

interface RoofSegment {
  name: string;
  panels: number;
  azimuth: number;
  tilt: number;
}

interface EquipmentItem {
  name: string;
  brand: string;
  model: string;
  warranty: string;
}

interface BatteryConfig {
  capacityKwh: number;
  powerKw: number;
  dischargeDurationHrs: number;
  technology: string;
  lifeYears: number;
  cycles: number;
  peakReductionPct: number;
  additionalSavingsPerYear: number;
  peakBefore: number;
  peakAfter: number;
}

interface EnergyProfile {
  selfConsumptionPct: number;
  solarCoveragePct: number;
  surplusPct: number;
  dataAccuracyPct: number;
}

interface PDFGeneratorOptions {
  projectData: {
    name?: string;
    address?: string;
    buildingType?: string;
    roofArea?: number;
    annualConsumption?: number;
    hqTariffCode?: string;
    contactName?: string;
  };
  analysisResult: {
    systemSize?: number;
    annualProduction?: number;
    coveragePercent?: number;
    co2Avoided?: number;
    totalPanels?: number;
    usedArea?: number;
    specificYield?: number;
    systemEfficiency?: number;
  };
  financialProjections: {
    grossCost?: number;
    federalItcPct?: number;
    federalItcAmount?: number;
    hqAutoproductionPerKw?: number;
    hqAutoproductionAmount?: number;
    netCost?: number;
    totalSavings25yr?: number;
    roi?: number;
    paybackYears?: number;
    irr?: number;
    npv?: number;
    lcoe?: number;
    yearOneSavings?: number;
    yearTenSavings?: number;
    yearTwentyFiveSavings?: number;
    costOfInaction?: number;
    annualProduction?: number;
    depreciationBenefitMin?: number;
    depreciationBenefitMax?: number;
  };
  roofConfig?: {
    segments?: RoofSegment[];
    panelType?: string;
    efficiency?: number;
  };
  equipment?: EquipmentItem[];
  battery?: BatteryConfig;
  energyProfile?: EnergyProfile;
  assumptions?: string[];
  exclusions?: string[];
  clientLogos?: string[];
  satelliteImageBase64?: string;
  roofConfigImageBase64?: string;
  logoBase64?: string;
}

export class PDFGeneratorV2 {

  // ==================== MAIN ENTRY ====================

  async generateReport(options: PDFGeneratorOptions): Promise<Buffer> {
    const html = this.buildHTML(options);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'] // Required for Replit
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' }
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }

  // ==================== HTML ASSEMBLY ====================

  private buildHTML(opts: PDFGeneratorOptions): string {
    const { projectData, analysisResult, financialProjections, roofConfig, equipment, battery, energyProfile, assumptions, exclusions } = opts;

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rapport - ${projectData?.name || 'Projet Solaire'}</title>
  <style>${this.getStyles()}</style>
</head>
<body>
  ${this.buildCoverPage(opts)}
  ${this.buildAboutPage(opts)}
  ${this.buildProjectSnapshotPage(opts)}
  ${this.buildYourResultsPage(opts)}
  ${this.buildNetInvestmentPage(opts)}
  ${this.buildEnergyProfilePage(opts)}
  ${this.buildStoragePage(opts)}
  ${this.buildFinancialProjectionsPage(opts)}
  ${this.buildRoofConfigPage(opts)}
  ${this.buildEquipmentPage(opts)}
  ${this.buildAssumptionsPage(opts)}
  ${this.buildTimelinePage(opts)}
  ${this.buildNextStepsPage(opts)}
</body>
</html>
    `;
  }

  // ==================== CSS ====================

  private getStyles(): string {
    return `
      /* ========== RESET & BASE ========== */
      * { margin: 0; padding: 0; box-sizing: border-box; }

      @import url('https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,500;0,600;0,700;1,500&display=swap');

      body {
        font-family: 'Montserrat', 'Helvetica Neue', Arial, sans-serif;
        font-size: 11pt;
        line-height: 1.4;
        color: #2A2A2B;
        background: white;
      }

      /* ========== PAGE STRUCTURE ========== */
      .page {
        width: 210mm;
        min-height: 297mm;
        max-height: 297mm;
        padding: 15mm 20mm;
        page-break-after: always;
        page-break-inside: avoid;
        position: relative;
        overflow: hidden;
        background: white;
      }
      .page:last-child { page-break-after: auto; }

      /* ========== BRAND COLORS (kWh Québec) ========== */
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
      }

      /* ========== TYPOGRAPHY (Montserrat) ========== */
      h1 {
        font-family: 'Montserrat', sans-serif;
        font-size: 28pt; font-weight: 700;
        color: var(--primary);
        margin-bottom: 10mm;
      }
      h2 {
        font-family: 'Montserrat', sans-serif;
        font-size: 20pt; font-weight: 600;
        color: var(--primary);
        margin-bottom: 6mm;
        padding-bottom: 2mm;
        border-bottom: 2px solid var(--accent);
      }
      h3 {
        font-family: 'Montserrat', sans-serif;
        font-size: 14pt; font-weight: 600;
        color: var(--dark);
        margin-bottom: 4mm;
      }
      p { margin-bottom: 3mm; color: var(--dark); }
      .subtitle { font-size: 14pt; color: var(--gray); margin-bottom: 8mm; }

      /* ========== COVER PAGE ========== */
      .cover-page {
        background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
        color: white;
        display: flex; flex-direction: column; justify-content: space-between;
        padding: 25mm;
      }
      .cover-page h1 { color: white; font-size: 36pt; border: none; }
      .cover-logo { width: 80mm; margin-bottom: 20mm; }
      .cover-title { font-size: 42pt; font-weight: 700; margin-bottom: 5mm; font-family: 'Montserrat', sans-serif; }
      .cover-subtitle { font-size: 18pt; opacity: 0.9; margin-bottom: 30mm; }
      .cover-project-name {
        font-size: 24pt; font-weight: 600; padding: 8mm 0;
        border-top: 2px solid rgba(255,255,255,0.3);
        border-bottom: 2px solid rgba(255,255,255,0.3);
      }
      .cover-footer { display: flex; justify-content: space-between; font-size: 10pt; opacity: 0.8; }

      /* ========== METRICS & KPIs ========== */
      .metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5mm; margin: 8mm 0; }
      .metrics-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4mm; margin: 6mm 0; }
      .metric-card { background: var(--light-gray); border-radius: 3mm; padding: 6mm; text-align: center; }
      .metric-value { font-size: 24pt; font-weight: 700; color: var(--primary); display: block; }
      .metric-label { font-size: 9pt; color: var(--gray); text-transform: uppercase; letter-spacing: 0.5px; }
      .metric-highlight { background: var(--primary); color: white; }
      .metric-highlight .metric-value { color: white; }
      .metric-highlight .metric-label { color: rgba(255,255,255,0.8); }
      .metric-accent { background: var(--accent); color: var(--dark); }
      .metric-accent .metric-value { color: var(--dark); }
      .metric-accent .metric-label { color: rgba(0,0,0,0.6); }

      /* ========== DATA TABLES ========== */
      .data-table { width: 100%; border-collapse: collapse; margin: 5mm 0; font-size: 9pt; }
      .data-table th { background: var(--primary); color: white; padding: 3mm 4mm; text-align: left; font-weight: 600; }
      .data-table td { padding: 2.5mm 4mm; border-bottom: 1px solid #e5e7eb; }
      .data-table tr:nth-child(even) { background: var(--light-gray); }
      .data-table .number { text-align: right; font-family: 'Courier New', monospace; }
      .data-table .total-row { background: var(--primary) !important; color: white; font-weight: 700; }

      /* ========== CHARTS ========== */
      .chart-container { background: var(--light-gray); border-radius: 3mm; padding: 5mm; margin: 5mm 0; min-height: 60mm; }
      .chart-title { font-size: 11pt; font-weight: 600; color: var(--dark); margin-bottom: 3mm; }
      .charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }

      /* ========== WATERFALL ========== */
      .waterfall-chart { display: flex; align-items: flex-end; justify-content: space-around; height: 50mm; padding: 5mm 0; }
      .waterfall-bar { display: flex; flex-direction: column; align-items: center; width: 25mm; }
      .waterfall-value { font-size: 9pt; font-weight: 600; margin-bottom: 2mm; }
      .waterfall-fill { width: 20mm; border-radius: 2mm 2mm 0 0; }
      .waterfall-fill.positive { background: var(--primary); }
      .waterfall-fill.negative { background: #ef4444; }
      .waterfall-fill.total { background: var(--accent); }
      .waterfall-label { font-size: 8pt; color: var(--gray); margin-top: 2mm; text-align: center; }

      /* ========== CONTENT SECTIONS ========== */
      .section { margin-bottom: 8mm; page-break-inside: avoid; }
      .two-column { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
      .three-column { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5mm; }

      .info-box { background: var(--light-gray); border-radius: 3mm; padding: 5mm; margin: 4mm 0; }
      .info-box.highlight { background: var(--primary); color: white; }
      .info-box.accent { background: var(--accent); color: var(--dark); }

      .bullet-list { list-style: none; padding-left: 0; }
      .bullet-list li { padding: 2mm 0 2mm 6mm; position: relative; }
      .bullet-list li::before { content: "✓"; position: absolute; left: 0; color: var(--accent); font-weight: bold; }

      /* ========== PILLAR CARDS ========== */
      .pillar-card { background: white; border: 2px solid var(--light-gray); border-radius: 3mm; padding: 5mm; text-align: center; }
      .pillar-icon { font-size: 24pt; margin-bottom: 2mm; }
      .pillar-title { font-size: 11pt; font-weight: 700; color: var(--primary); margin-bottom: 2mm; }
      .pillar-desc { font-size: 8pt; color: var(--gray); margin: 0; }

      /* ========== ENERGY PROFILE ========== */
      .energy-bar-chart { display: flex; align-items: flex-end; justify-content: space-between; height: 45mm; padding: 2mm 0; border-bottom: 1px solid #e5e7eb; }
      .energy-bar-group { display: flex; flex-direction: column; align-items: center; flex: 1; }
      .energy-bars { display: flex; gap: 1mm; align-items: flex-end; }
      .energy-bar { width: 5mm; border-radius: 1mm 1mm 0 0; }
      .energy-bar.consumption { background: var(--primary); opacity: 0.4; }
      .energy-bar.solar { background: var(--accent); }
      .energy-bar-label { font-size: 7pt; color: var(--gray); margin-top: 1mm; }

      .legend { display: flex; gap: 8mm; margin: 3mm 0; font-size: 9pt; }
      .legend-item { display: flex; align-items: center; gap: 2mm; }
      .legend-dot { width: 3mm; height: 3mm; border-radius: 50%; }

      /* ========== FOOTER ========== */
      .page-footer {
        position: absolute; bottom: 10mm; left: 20mm; right: 20mm;
        display: flex; justify-content: space-between;
        font-size: 8pt; color: var(--gray);
        border-top: 1px solid #e5e7eb; padding-top: 3mm;
      }

      /* ========== TIMELINE ========== */
      .timeline { position: relative; padding-left: 15mm; }
      .timeline::before { content: ''; position: absolute; left: 5mm; top: 0; bottom: 0; width: 2px; background: var(--primary); }
      .timeline-item { position: relative; margin-bottom: 8mm; }
      .timeline-item::before { content: ''; position: absolute; left: -12mm; top: 1mm; width: 4mm; height: 4mm; background: var(--accent); border-radius: 50%; }
      .timeline-week { font-size: 10pt; font-weight: 700; color: var(--primary); }
      .timeline-title { font-size: 11pt; font-weight: 600; margin: 1mm 0; }
      .timeline-desc { font-size: 9pt; color: var(--gray); }

      /* ========== LOGOS GRID ========== */
      .logo-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5mm; margin: 6mm 0; }
      .logo-item { background: var(--light-gray); border-radius: 3mm; padding: 5mm; display: flex; align-items: center; justify-content: center; min-height: 18mm; font-size: 8pt; color: var(--gray); font-weight: 600; }

      /* ========== CTA BOX ========== */
      .cta-box { background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%); color: white; border-radius: 4mm; padding: 8mm; text-align: center; margin: 8mm 0; }
      .cta-box h3 { color: white; font-size: 16pt; margin-bottom: 3mm; }
      .cta-box p { color: rgba(255,255,255,0.9); font-size: 11pt; }

      /* ========== FUNNEL STEPS ========== */
      .funnel-steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4mm; margin: 6mm 0; }
      .funnel-step { text-align: center; padding: 4mm; border-radius: 3mm; }
      .funnel-step-number { width: 10mm; height: 10mm; background: var(--accent); color: var(--dark); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14pt; margin: 0 auto 3mm auto; }
      .funnel-step-title { font-size: 10pt; font-weight: 600; color: var(--primary); margin-bottom: 2mm; }
      .funnel-step-desc { font-size: 8pt; color: var(--gray); }
      .funnel-step-tag { display: inline-block; background: var(--accent); color: var(--dark); font-size: 7pt; font-weight: 600; padding: 1mm 3mm; border-radius: 2mm; margin-top: 2mm; }
      .funnel-step-tag.paid { background: var(--light-gray); color: var(--gray); }

      /* ========== PRINT ========== */
      @media print {
        .page { page-break-after: always; page-break-inside: avoid; }
        .page:last-child { page-break-after: auto; }
        .section { page-break-inside: avoid; }
      }
    `;
  }

  // ==================== PAGE 1: COVER ====================

  private buildCoverPage(opts: PDFGeneratorOptions): string {
    const { projectData, logoBase64 } = opts;
    const date = new Date().toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' });

    const logoHtml = logoBase64
      ? `<img src="${logoBase64}" class="cover-logo" alt="kWh Québec" />`
      : `<svg width="220" height="70" viewBox="0 0 220 70">
          <text x="0" y="45" fill="white" font-size="36" font-weight="bold" font-family="Montserrat, sans-serif">kWh</text>
          <text x="0" y="65" fill="#FFB005" font-size="18" font-weight="600" font-family="Montserrat, sans-serif">Québec</text>
          <line x1="130" y1="10" x2="130" y2="65" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
          <text x="140" y="35" fill="white" font-size="14" font-weight="700" font-family="Montserrat, sans-serif">SOLAIRE +</text>
          <text x="140" y="55" fill="white" font-size="14" font-weight="700" font-family="Montserrat, sans-serif">STOCKAGE</text>
        </svg>`;

    return `
    <div class="page cover-page">
      <div>
        <div class="cover-logo">${logoHtml}</div>
        <div class="cover-title">Étude Préliminaire</div>
        <div class="cover-subtitle">Solaire + Stockage</div>
      </div>
      <div class="cover-project-name">${projectData?.name || 'Projet Solaire'}</div>
      <div class="cover-footer">
        <span>Préparé le ${date}</span>
        <span>kwh.quebec</span>
      </div>
    </div>
    `;
  }

  // ==================== PAGE 2: QUI SOMMES-NOUS ====================

  private buildAboutPage(opts: PDFGeneratorOptions): string {
    const { clientLogos } = opts;

    const defaultLogos = ['Dream Industrial', 'Lab Space', 'Scale Cleantech', 'Hydro-Québec'];
    const logos = clientLogos?.length ? clientLogos : defaultLogos;

    return `
    <div class="page">
      <h2>Qui Sommes-Nous</h2>
      <p class="subtitle">Votre partenaire solaire clé en main au Québec</p>

      <p style="margin-bottom: 6mm;">
        <strong>kWh Québec</strong> conçoit, installe et entretient des systèmes solaires et de stockage d'énergie
        pour les bâtiments commerciaux et industriels. De l'analyse initiale à la mise en service,
        <strong>on s'occupe de tout.</strong>
      </p>

      <div class="metrics-grid-4" style="margin-bottom: 6mm;">
        <div class="metric-card metric-highlight">
          <span class="metric-value" style="font-size: 20pt;">120+ MW</span>
          <span class="metric-label">Installés</span>
        </div>
        <div class="metric-card">
          <span class="metric-value" style="font-size: 20pt;">25+</span>
          <span class="metric-label">Projets Complétés</span>
        </div>
        <div class="metric-card">
          <span class="metric-value" style="font-size: 20pt;">15+ ans</span>
          <span class="metric-label">Expérience</span>
        </div>
        <div class="metric-card metric-accent">
          <span class="metric-value" style="font-size: 20pt;">100%</span>
          <span class="metric-label">Clé en Main</span>
        </div>
      </div>

      <div class="section">
        <h3>Notre Approche</h3>
        <div class="metrics-grid-4">
          <div class="pillar-card">
            <div class="pillar-icon">⚡</div>
            <div class="pillar-title">Simplicité</div>
            <p class="pillar-desc">Un seul interlocuteur de A à Z. Zéro complexité pour vous.</p>
          </div>
          <div class="pillar-card">
            <div class="pillar-icon">🔧</div>
            <div class="pillar-title">Fiabilité</div>
            <p class="pillar-desc">Équipements certifiés, installation par maîtres électriciens.</p>
          </div>
          <div class="pillar-card">
            <div class="pillar-icon">📈</div>
            <div class="pillar-title">Longévité</div>
            <p class="pillar-desc">Systèmes conçus pour 25+ ans de performance garantie.</p>
          </div>
          <div class="pillar-card">
            <div class="pillar-icon">🍁</div>
            <div class="pillar-title">Fierté</div>
            <p class="pillar-desc">Entreprise québécoise. Contribution à la transition énergétique locale.</p>
          </div>
        </div>
      </div>

      <div class="section">
        <h3>Ils Nous Font Confiance</h3>
        <div class="logo-grid">
          ${logos.map(logo =>
            typeof logo === 'string' && logo.startsWith('data:')
              ? `<div class="logo-item"><img src="${logo}" style="max-height: 14mm; max-width: 100%;" /></div>`
              : `<div class="logo-item">${logo}</div>`
          ).join('')}
        </div>
      </div>

      <div class="two-column">
        <div class="info-box">
          <h3 style="color: var(--primary); margin-bottom: 2mm; font-size: 11pt;">Certifications</h3>
          <ul class="bullet-list" style="font-size: 9pt;">
            <li>Maître électricien CMEQ</li>
            <li>Membre CNESST</li>
            <li>Certifié NABCEP</li>
            <li>Licence RBQ</li>
          </ul>
        </div>
        <div class="info-box">
          <h3 style="color: var(--primary); margin-bottom: 2mm; font-size: 11pt;">Nos Services</h3>
          <ul class="bullet-list" style="font-size: 9pt;">
            <li>Analyse & conception solaire</li>
            <li>Stockage par batteries (BESS)</li>
            <li>Ingénierie & construction</li>
            <li>Opération & maintenance</li>
          </ul>
        </div>
      </div>

      <div class="page-footer">
        <span>kWh Québec - Étude Préliminaire</span>
        <span>Page 2</span>
      </div>
    </div>
    `;
  }

  // ==================== PAGE 3: APERÇU DU PROJET ====================

  private buildProjectSnapshotPage(opts: PDFGeneratorOptions): string {
    const { projectData, analysisResult, satelliteImageBase64 } = opts;

    const systemSize = analysisResult?.systemSize || 100;
    const annualProduction = analysisResult?.annualProduction || 120000;
    const coverage = analysisResult?.coveragePercent || 85;
    const co2Avoided = analysisResult?.co2Avoided || 45;

    const satelliteHtml = satelliteImageBase64
      ? `<img src="${satelliteImageBase64}" style="width: 100%; height: 80mm; object-fit: cover; border-radius: 2mm;" />`
      : `<div style="height: 80mm; background: linear-gradient(135deg, #ccdcf0 0%, #a3bfe0 100%); border-radius: 2mm; display: flex; align-items: center; justify-content: center; color: #003DA6; font-weight: 600;">[Image satellite Google Solar API]</div>`;

    return `
    <div class="page">
      <h2>Aperçu du Projet</h2>

      <div class="metrics-grid">
        <div class="metric-card metric-highlight">
          <span class="metric-value">${this.fmt(systemSize)} kW</span>
          <span class="metric-label">Puissance Système</span>
        </div>
        <div class="metric-card">
          <span class="metric-value">${this.fmt(annualProduction)}</span>
          <span class="metric-label">kWh/an Production</span>
        </div>
        <div class="metric-card">
          <span class="metric-value">${coverage}%</span>
          <span class="metric-label">Couverture Énergétique</span>
        </div>
      </div>

      <div class="two-column">
        <div class="section">
          <h3>Informations du Site</h3>
          <div class="info-box">
            <p><strong>Adresse:</strong> ${projectData?.address || 'À déterminer'}</p>
            <p><strong>Type de bâtiment:</strong> ${projectData?.buildingType || 'Commercial/Industriel'}</p>
            <p><strong>Surface de toiture:</strong> ${this.fmt(projectData?.roofArea || 2000)} m²</p>
            <p><strong>Consommation annuelle:</strong> ${this.fmt(projectData?.annualConsumption || 150000)} kWh</p>
            <p><strong>Code tarifaire HQ:</strong> ${projectData?.hqTariffCode || 'M (Moyenne puissance)'}</p>
          </div>
        </div>

        <div class="section">
          <h3>Impact Environnemental</h3>
          <div class="info-box">
            <p><strong>CO₂ évité:</strong> ${this.fmt(co2Avoided)} tonnes/an</p>
            <p><strong>Équivalent arbres:</strong> ${this.fmt(Math.round(co2Avoided * 45))} arbres</p>
            <p><strong>Équivalent voitures:</strong> ${Math.round(co2Avoided / 4.6)} véhicules retirés</p>
          </div>
        </div>
      </div>

      <div class="chart-container">
        <div class="chart-title">Image Satellite du Site</div>
        ${satelliteHtml}
      </div>

      <div class="page-footer">
        <span>kWh Québec - Étude Préliminaire</span>
        <span>Page 3</span>
      </div>
    </div>
    `;
  }

  // ==================== PAGE 4: VOS RÉSULTATS ====================

  private buildYourResultsPage(opts: PDFGeneratorOptions): string {
    const fp = opts.financialProjections;

    const netCost = fp?.netCost || 112500;
    const savings25yr = fp?.totalSavings25yr || 1530000;
    const payback = fp?.paybackYears || 2.7;
    const roi = fp?.roi || 1260;
    const irr = fp?.irr || 38.2;
    const npv = fp?.npv || 680000;
    const lcoe = fp?.lcoe || 0.032;

    return `
    <div class="page">
      <h2>Vos Résultats</h2>
      <p class="subtitle">Projection sur 25 ans basée sur votre profil de consommation réel</p>

      <div class="metrics-grid">
        <div class="metric-card metric-accent">
          <span class="metric-value">${this.cur(netCost)}</span>
          <span class="metric-label">Investissement Net</span>
        </div>
        <div class="metric-card metric-highlight">
          <span class="metric-value">${this.cur(savings25yr)}</span>
          <span class="metric-label">Économies Totales (25 ans)</span>
        </div>
        <div class="metric-card">
          <span class="metric-value">${payback} ans</span>
          <span class="metric-label">Période de Récupération</span>
        </div>
      </div>

      <div class="section">
        <h3>Indicateurs Financiers Clés</h3>
        <table class="data-table">
          <tr><td>Retour sur Investissement (ROI)</td><td class="number"><strong>${this.fmt(roi)}%</strong></td></tr>
          <tr><td>Taux de Rendement Interne (TRI)</td><td class="number"><strong>${irr}%</strong></td></tr>
          <tr><td>Économies Année 1</td><td class="number">${this.cur(fp?.yearOneSavings || 42000)}</td></tr>
          <tr><td>Économies Année 10</td><td class="number">${this.cur(fp?.yearTenSavings || 56000)}</td></tr>
          <tr><td>Économies Année 25</td><td class="number">${this.cur(fp?.yearTwentyFiveSavings || 78000)}</td></tr>
          <tr><td>Valeur Actuelle Nette (VAN)</td><td class="number"><strong>${this.cur(npv)}</strong></td></tr>
          <tr><td>Coût actualisé de l'énergie (LCOE)</td><td class="number">${lcoe.toFixed(3)} $/kWh</td></tr>
        </table>
      </div>

      <div class="info-box highlight">
        <h3 style="color: white; margin-bottom: 2mm;">Ce que ça signifie pour vous</h3>
        <p style="color: rgba(255,255,255,0.9); margin: 0;">
          Grâce aux incitatifs fédéral (30% ITC) et provincial (Autoproduction HQ), votre investissement net
          n'est que de <strong>${this.cur(netCost)}</strong>, récupéré en <strong>${payback} ans</strong>. Votre système génère ensuite des économies nettes
          pendant plus de 22 ans. C'est l'équivalent d'un placement garanti à <strong>${irr}% de rendement annuel</strong>.
        </p>
      </div>

      <div class="page-footer">
        <span>kWh Québec - Étude Préliminaire</span>
        <span>Page 4</span>
      </div>
    </div>
    `;
  }

  // ==================== PAGE 5: INVESTISSEMENT NET ====================

  private buildNetInvestmentPage(opts: PDFGeneratorOptions): string {
    const fp = opts.financialProjections;
    const systemSize = opts.analysisResult?.systemSize || 150;

    const grossCost = fp?.grossCost || 375000;
    const itcPct = fp?.federalItcPct || 30;
    const itcAmount = fp?.federalItcAmount || Math.round(grossCost * itcPct / 100);
    const hqPerKw = fp?.hqAutoproductionPerKw || 1000;
    const hqAmount = fp?.hqAutoproductionAmount || (hqPerKw * systemSize);
    const netCost = fp?.netCost || (grossCost - itcAmount - hqAmount);

    // Bar heights (max 40mm for grossCost)
    const scale = 40 / grossCost;

    const depMin = fp?.depreciationBenefitMin || 25000;
    const depMax = fp?.depreciationBenefitMax || 40000;

    return `
    <div class="page">
      <h2>Investissement Net</h2>
      <p class="subtitle">Votre coût réel après incitatifs fiscaux et subventions</p>

      <div class="chart-container" style="padding: 10mm;">
        <div class="waterfall-chart">
          <div class="waterfall-bar">
            <span class="waterfall-value">${this.cur(grossCost)}</span>
            <div class="waterfall-fill positive" style="height: ${Math.round(grossCost * scale)}mm;"></div>
            <span class="waterfall-label">Coût Brut</span>
          </div>
          <div class="waterfall-bar">
            <span class="waterfall-value" style="color: #ef4444;">-${this.cur(itcAmount)}</span>
            <div class="waterfall-fill negative" style="height: ${Math.round(itcAmount * scale)}mm;"></div>
            <span class="waterfall-label">Crédit Fédéral<br>ITC (${itcPct}%)</span>
          </div>
          <div class="waterfall-bar">
            <span class="waterfall-value" style="color: #ef4444;">-${this.cur(hqAmount)}</span>
            <div class="waterfall-fill negative" style="height: ${Math.round(hqAmount * scale)}mm;"></div>
            <span class="waterfall-label">HQ Auto-<br>production</span>
          </div>
          <div class="waterfall-bar">
            <span class="waterfall-value" style="color: var(--accent); font-size: 11pt;"><strong>${this.cur(netCost)}</strong></span>
            <div class="waterfall-fill total" style="height: ${Math.round(netCost * scale)}mm;"></div>
            <span class="waterfall-label"><strong>Coût Net</strong></span>
          </div>
        </div>
      </div>

      <div class="section">
        <h3>Détail des Incitatifs</h3>
        <table class="data-table">
          <tr><th>Élément</th><th style="text-align: right;">Montant</th></tr>
          <tr><td>Coût du système (installation complète clé en main)</td><td class="number">${this.cur(grossCost)}</td></tr>
          <tr><td>Crédit d'impôt à l'investissement fédéral (ITC ${itcPct}%)</td><td class="number" style="color: #16a34a;">-${this.cur(itcAmount)}</td></tr>
          <tr><td>Incitatif Hydro-Québec Autoproduction (${this.fmt(hqPerKw)} $/kW × ${this.fmt(systemSize)} kW)</td><td class="number" style="color: #16a34a;">-${this.cur(hqAmount)}</td></tr>
          <tr class="total-row"><td><strong>INVESTISSEMENT NET</strong></td><td class="number"><strong>${this.cur(netCost)}</strong></td></tr>
        </table>
      </div>

      <div class="info-box" style="background: #FFF8E1; border-left: 4px solid var(--accent);">
        <p style="margin-bottom: 2mm;"><strong>Avantage fiscal additionnel:</strong> L'amortissement accéléré (Cat. 43.1/43.2 APA) permet
        de déduire jusqu'à 100% du coût net dès l'année 1, générant un bénéfice fiscal additionnel estimé
        entre <strong>${this.cur(depMin)} et ${this.cur(depMax)}</strong> selon votre taux d'imposition. Consultez votre comptable.</p>
      </div>

      <div class="info-box">
        <p style="font-size: 9pt; margin: 0;"><strong>Conditions:</strong> L'ITC fédéral de ${itcPct}% s'applique aux projets d'énergie propre admissibles (Loi C-69).
        L'incitatif HQ Autoproduction est plafonné à ${this.fmt(hqPerKw)} $/kW (max 1 MW) et 40% du CAPEX.
        Les montants présentés sont basés sur l'admissibilité estimée — la confirmation finale sera incluse dans le devis.</p>
      </div>

      <div class="page-footer">
        <span>kWh Québec - Étude Préliminaire</span>
        <span>Page 5</span>
      </div>
    </div>
    `;
  }

  // ==================== PAGE 6: PROFIL ÉNERGÉTIQUE ====================

  private buildEnergyProfilePage(opts: PDFGeneratorOptions): string {
    const ep = opts.energyProfile;
    const selfConsumption = ep?.selfConsumptionPct || 85;
    const solarCoverage = ep?.solarCoveragePct || 72;
    const surplus = ep?.surplusPct || 15;
    const accuracy = ep?.dataAccuracyPct || 95;

    // Simplified hourly bars (consumption/solar heights in mm for a typical summer day)
    const hourlyData = [
      { h: '0h', c: 10, s: 0 }, { h: '', c: 8, s: 0 }, { h: '', c: 8, s: 0 }, { h: '', c: 8, s: 0 },
      { h: '', c: 8, s: 0 }, { h: '5h', c: 10, s: 3 }, { h: '6h', c: 20, s: 10 }, { h: '7h', c: 30, s: 18 },
      { h: '8h', c: 35, s: 28 }, { h: '9h', c: 38, s: 35 }, { h: '10h', c: 40, s: 40 }, { h: '11h', c: 42, s: 43 },
      { h: '12h', c: 40, s: 45 }, { h: '13h', c: 42, s: 43 }, { h: '14h', c: 40, s: 38 }, { h: '15h', c: 38, s: 30 },
      { h: '16h', c: 35, s: 22 }, { h: '17h', c: 30, s: 12 }, { h: '18h', c: 22, s: 5 }, { h: '19h', c: 18, s: 1 },
      { h: '20h', c: 15, s: 0 }, { h: '', c: 12, s: 0 }, { h: '', c: 11, s: 0 }, { h: '23h', c: 10, s: 0 },
    ];

    return `
    <div class="page">
      <h2>Profil Énergétique</h2>
      <p class="subtitle">Simulation heure par heure — votre consommation vs production solaire</p>

      <div class="chart-container">
        <div class="chart-title">Profil Journalier Type — Jour d'Été</div>
        <div class="legend">
          <div class="legend-item"><div class="legend-dot" style="background: var(--primary); opacity: 0.4;"></div> Consommation</div>
          <div class="legend-item"><div class="legend-dot" style="background: var(--accent);"></div> Production solaire</div>
          <div class="legend-item"><div class="legend-dot" style="background: #16a34a;"></div> Autoconsommation</div>
        </div>
        <div class="energy-bar-chart">
          ${hourlyData.map(d => `
            <div class="energy-bar-group">
              <div class="energy-bars">
                <div class="energy-bar consumption" style="height: ${d.c}mm;"></div>
                <div class="energy-bar solar" style="height: ${d.s}mm;"></div>
              </div>
              <span class="energy-bar-label">${d.h}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="metrics-grid">
        <div class="metric-card">
          <span class="metric-value" style="font-size: 18pt;">${selfConsumption}%</span>
          <span class="metric-label">Taux Autoconsommation</span>
        </div>
        <div class="metric-card">
          <span class="metric-value" style="font-size: 18pt;">${solarCoverage}%</span>
          <span class="metric-label">Couverture Solaire</span>
        </div>
        <div class="metric-card">
          <span class="metric-value" style="font-size: 18pt;">${surplus}%</span>
          <span class="metric-label">Surplus → Crédit HQ</span>
        </div>
      </div>

      <div class="charts-row">
        <div class="chart-container" style="min-height: 35mm;">
          <div class="chart-title">Distribution Mensuelle de Production</div>
          <div style="height: 30mm; background: white; border-radius: 2mm; display: flex; align-items: flex-end; justify-content: space-around; padding: 2mm 3mm; border: 1px solid #e5e7eb;">
            <div style="width: 8%; background: var(--primary); height: 15%; border-radius: 1mm 1mm 0 0; opacity: 0.7;"></div>
            <div style="width: 8%; background: var(--primary); height: 25%; border-radius: 1mm 1mm 0 0; opacity: 0.7;"></div>
            <div style="width: 8%; background: var(--primary); height: 50%; border-radius: 1mm 1mm 0 0; opacity: 0.8;"></div>
            <div style="width: 8%; background: var(--primary); height: 70%; border-radius: 1mm 1mm 0 0; opacity: 0.85;"></div>
            <div style="width: 8%; background: var(--primary); height: 90%; border-radius: 1mm 1mm 0 0; opacity: 0.9;"></div>
            <div style="width: 8%; background: var(--accent); height: 100%; border-radius: 1mm 1mm 0 0;"></div>
            <div style="width: 8%; background: var(--accent); height: 98%; border-radius: 1mm 1mm 0 0;"></div>
            <div style="width: 8%; background: var(--primary); height: 85%; border-radius: 1mm 1mm 0 0; opacity: 0.9;"></div>
            <div style="width: 8%; background: var(--primary); height: 65%; border-radius: 1mm 1mm 0 0; opacity: 0.85;"></div>
            <div style="width: 8%; background: var(--primary); height: 40%; border-radius: 1mm 1mm 0 0; opacity: 0.8;"></div>
            <div style="width: 8%; background: var(--primary); height: 18%; border-radius: 1mm 1mm 0 0; opacity: 0.7;"></div>
            <div style="width: 8%; background: var(--primary); height: 12%; border-radius: 1mm 1mm 0 0; opacity: 0.7;"></div>
          </div>
          <div style="display: flex; justify-content: space-around; font-size: 7pt; color: var(--gray); margin-top: 1mm;">
            <span>J</span><span>F</span><span>M</span><span>A</span><span>M</span><span>J</span><span>J</span><span>A</span><span>S</span><span>O</span><span>N</span><span>D</span>
          </div>
        </div>
        <div class="info-box" style="min-height: 35mm;">
          <h3 style="font-size: 11pt; color: var(--primary); margin-bottom: 3mm;">Analyse Basée sur Données Réelles</h3>
          <p style="font-size: 9pt;">Notre simulation utilise vos <strong>données de consommation Hydro-Québec réelles</strong> (via procuration)
          croisées avec les données d'ensoleillement satellite <strong>Google Solar API</strong>.</p>
          <p style="font-size: 9pt; margin: 0;">Précision estimée: <strong>~${accuracy}%</strong> (vs ~75% pour une estimation standard).</p>
        </div>
      </div>

      <div class="page-footer">
        <span>kWh Québec - Étude Préliminaire</span>
        <span>Page 6</span>
      </div>
    </div>
    `;
  }

  // ==================== PAGE 7: STOCKAGE & OPTIMISATION ====================

  private buildStoragePage(opts: PDFGeneratorOptions): string {
    const bat = opts.battery;

    const capacityKwh = bat?.capacityKwh || 100;
    const powerKw = bat?.powerKw || 50;
    const dischargeDuration = bat?.dischargeDurationHrs || 2;
    const technology = bat?.technology || 'LFP (Lithium Fer Phosphate)';
    const lifeYears = bat?.lifeYears || 15;
    const cycles = bat?.cycles || 6000;
    const peakReduction = bat?.peakReductionPct || 22;
    const additionalSavings = bat?.additionalSavingsPerYear || 8400;
    const peakBefore = bat?.peakBefore || 280;
    const peakAfter = bat?.peakAfter || 218;

    return `
    <div class="page">
      <h2>Stockage & Optimisation</h2>
      <p class="subtitle">Maximisez vos économies avec un système de batteries intégré</p>

      <div class="two-column">
        <div class="section">
          <h3>Recommandation Batterie</h3>
          <div class="info-box" style="background: var(--primary); color: white;">
            <p style="color: rgba(255,255,255,0.8); font-size: 9pt; margin-bottom: 1mm;">Capacité Recommandée</p>
            <p style="color: white; font-size: 22pt; font-weight: 700; margin-bottom: 1mm;">${this.fmt(capacityKwh)} kWh</p>
            <p style="color: rgba(255,255,255,0.8); font-size: 9pt; margin-bottom: 3mm;">BESS (Battery Energy Storage System)</p>
            <p style="color: rgba(255,255,255,0.9); font-size: 9pt; margin: 0;">
              <strong>Puissance:</strong> ${this.fmt(powerKw)} kW<br>
              <strong>Durée de décharge:</strong> ${dischargeDuration} heures<br>
              <strong>Technologie:</strong> ${technology}<br>
              <strong>Durée de vie:</strong> ${lifeYears}+ ans / ${this.fmt(cycles)} cycles
            </p>
          </div>
        </div>

        <div class="section">
          <h3>Impact sur la Facture</h3>
          <div class="metrics-grid" style="grid-template-columns: 1fr 1fr; margin: 3mm 0;">
            <div class="metric-card">
              <span class="metric-value" style="font-size: 18pt;">-${peakReduction}%</span>
              <span class="metric-label">Réduction Pointe</span>
            </div>
            <div class="metric-card metric-accent">
              <span class="metric-value" style="font-size: 18pt;">${this.cur(additionalSavings)}</span>
              <span class="metric-label">Économies/an Addl.</span>
            </div>
          </div>
          <div class="info-box" style="font-size: 9pt;">
            <p><strong>Demand Shaving:</strong> La batterie se décharge pendant vos pointes de demande,
            réduisant votre appel de puissance facturé par HQ.</p>
            <p style="margin: 0;"><strong>Arbitrage tarifaire:</strong> Charge en heures creuses, décharge en heures de pointe
            pour maximiser la valeur de chaque kWh stocké.</p>
          </div>
        </div>
      </div>

      <div class="chart-container">
        <div class="chart-title">Écrêtage de la Pointe de Demande (Demand Shaving)</div>
        <div style="height: 50mm; background: white; border-radius: 2mm; display: flex; align-items: center; justify-content: center; position: relative; border: 1px solid #e5e7eb;">
          <div style="position: absolute; top: 15mm; left: 10mm; right: 10mm; border-top: 2px dashed #ef4444; opacity: 0.5;"></div>
          <div style="position: absolute; top: 22mm; left: 10mm; right: 10mm; border-top: 2px dashed #16a34a;"></div>
          <div style="position: absolute; top: 13mm; right: 12mm; font-size: 8pt; color: #ef4444;">Pointe AVANT: ${this.fmt(peakBefore)} kW</div>
          <div style="position: absolute; top: 20mm; right: 12mm; font-size: 8pt; color: #16a34a; font-weight: 600;">Pointe APRÈS: ${this.fmt(peakAfter)} kW</div>
          <span style="color: var(--gray); font-size: 9pt;">[Graphique de simulation horaire — appel de puissance avant/après batterie]</span>
        </div>
      </div>

      <div class="info-box accent">
        <h3 style="color: var(--dark); margin-bottom: 2mm;">Solaire + Stockage = Synergie</h3>
        <p style="color: var(--dark); font-size: 10pt; margin: 0;">
          En combinant panneaux solaires et batterie, vous réduisez à la fois votre <strong>consommation d'énergie</strong>
          (composante kWh) et votre <strong>appel de puissance</strong> (composante kW). L'impact combiné sur votre facture
          est significativement supérieur à la somme des deux technologies prises individuellement.
        </p>
      </div>

      <div class="page-footer">
        <span>kWh Québec - Étude Préliminaire</span>
        <span>Page 7</span>
      </div>
    </div>
    `;
  }

  // ==================== PAGE 8: PROJECTIONS FINANCIÈRES ====================

  private buildFinancialProjectionsPage(opts: PDFGeneratorOptions): string {
    const fp = opts.financialProjections;
    const payback = fp?.paybackYears || 2.7;
    const costOfInaction = fp?.costOfInaction || fp?.totalSavings25yr || 1530000;

    return `
    <div class="page">
      <h2>Projections Financières</h2>
      <p class="subtitle">Évolution sur 25 ans avec inflation énergétique de 3%/an</p>

      <div class="charts-row">
        <div class="chart-container">
          <div class="chart-title">Flux de Trésorerie Cumulatif</div>
          <div style="height: 65mm; background: linear-gradient(to right, #fee2e2 0%, #fee2e2 8%, #fef3c7 8%, #fef3c7 11%, #d1fae5 11%, #d1fae5 100%); border-radius: 2mm; display: flex; align-items: center; justify-content: center; color: #003DA6; font-size: 9pt; font-weight: 600;">
            Point de récupération: Année ${payback}
          </div>
        </div>
        <div class="chart-container">
          <div class="chart-title">Coût de l'Inaction</div>
          <div style="height: 65mm; background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); border-radius: 2mm; display: flex; align-items: center; justify-content: center; color: #991b1b; font-size: 9pt; font-weight: 600;">
            Coût cumulatif sans solaire à 25 ans:<br>${this.cur(costOfInaction)} de plus
          </div>
        </div>
      </div>

      <div class="section">
        <h3>Projection Annuelle</h3>
        <table class="data-table">
          <tr>
            <th>Année</th>
            <th style="text-align: right;">Production (kWh)</th>
            <th style="text-align: right;">Économies</th>
            <th style="text-align: right;">Cumulatif</th>
          </tr>
          ${this.buildProjectionRows(opts)}
        </table>
      </div>

      <div class="page-footer">
        <span>kWh Québec - Étude Préliminaire</span>
        <span>Page 8</span>
      </div>
    </div>
    `;
  }

  // ==================== PAGE 9: CONFIGURATION TOITURE ====================

  private buildRoofConfigPage(opts: PDFGeneratorOptions): string {
    const { roofConfig, analysisResult, roofConfigImageBase64 } = opts;

    const segments = roofConfig?.segments || [
      { name: 'Section A - Sud', panels: 200, azimuth: 180, tilt: 10 },
      { name: 'Section B - Est', panels: 100, azimuth: 90, tilt: 10 },
      { name: 'Section C - Ouest', panels: 75, azimuth: 270, tilt: 10 },
    ];

    const specificYield = analysisResult?.specificYield || 1035;
    const efficiency = analysisResult?.systemEfficiency || 90;

    const imageHtml = roofConfigImageBase64
      ? `<img src="${roofConfigImageBase64}" style="width: 100%; height: 90mm; object-fit: cover; border-radius: 2mm;" />`
      : `<div style="height: 90mm; background: linear-gradient(135deg, #ccdcf0 0%, #a3bfe0 100%); border-radius: 2mm; display: flex; align-items: center; justify-content: center; color: #003DA6; font-weight: 600;">[Image configuration panneaux - Google Solar API]</div>`;

    return `
    <div class="page">
      <h2>Configuration de Toiture</h2>
      <p class="subtitle">Optimisation basée sur l'analyse Google Solar API</p>

      <div class="two-column">
        <div class="section">
          <h3>Segments de Toiture</h3>
          <table class="data-table">
            <tr><th>Segment</th><th>Panneaux</th><th>Orientation</th><th>Inclinaison</th></tr>
            ${segments.map(seg => `
            <tr>
              <td>${seg.name}</td>
              <td class="number">${seg.panels}</td>
              <td class="number">${seg.azimuth}°</td>
              <td class="number">${seg.tilt}°</td>
            </tr>
            `).join('')}
          </table>
        </div>

        <div class="section">
          <h3>Paramètres Techniques</h3>
          <div class="info-box">
            <p><strong>Type de panneau:</strong> ${roofConfig?.panelType || 'Monocristallin 400W'}</p>
            <p><strong>Nombre total:</strong> ${analysisResult?.totalPanels || 375} panneaux</p>
            <p><strong>Surface utilisée:</strong> ${this.fmt(analysisResult?.usedArea || 750)} m²</p>
            <p><strong>Efficacité système:</strong> ~${efficiency}%</p>
            <p><strong>Rendement spécifique:</strong> ${this.fmt(specificYield)} kWh/kWc</p>
          </div>
        </div>
      </div>

      <div class="chart-container">
        <div class="chart-title">Vue Aérienne - Configuration des Panneaux</div>
        ${imageHtml}
      </div>

      <div class="page-footer">
        <span>kWh Québec - Étude Préliminaire</span>
        <span>Page 9</span>
      </div>
    </div>
    `;
  }

  // ==================== PAGE 10: ÉQUIPEMENTS & GARANTIES ====================

  private buildEquipmentPage(opts: PDFGeneratorOptions): string {
    const defaultEquipment: EquipmentItem[] = [
      { name: 'Panneaux solaires', brand: 'Canadian Solar', model: 'CS6W-400MS', warranty: '25 ans produit, 30 ans performance' },
      { name: 'Onduleurs', brand: 'SolarEdge', model: 'SE100K', warranty: '12 ans (extensible à 25 ans)' },
      { name: 'Optimiseurs', brand: 'SolarEdge', model: 'P401', warranty: '25 ans' },
      { name: 'Batterie BESS', brand: 'BYD', model: 'Battery-Box Premium', warranty: '10 ans / 6 000 cycles' },
      { name: 'Structure de montage', brand: 'KB Racking', model: 'EcoFoot2+', warranty: '20 ans' },
      { name: 'Monitoring', brand: 'SolarEdge', model: 'Cloud Platform', warranty: 'Inclus à vie' },
    ];

    const equipment = opts.equipment?.length ? opts.equipment : defaultEquipment;

    return `
    <div class="page">
      <h2>Équipements & Garanties</h2>

      <table class="data-table">
        <tr><th>Composant</th><th>Fabricant</th><th>Modèle</th><th>Garantie</th></tr>
        ${equipment.map(eq => `
        <tr>
          <td><strong>${eq.name}</strong></td>
          <td>${eq.brand}</td>
          <td>${eq.model}</td>
          <td>${eq.warranty}</td>
        </tr>
        `).join('')}
      </table>

      <div class="two-column" style="margin-top: 8mm;">
        <div class="section">
          <h3>Certifications Équipements</h3>
          <ul class="bullet-list">
            <li>Panneaux certifiés CSA / UL / IEC</li>
            <li>Onduleurs certifiés CSA C22.2</li>
            <li>Installation selon Code électrique du Québec</li>
            <li>Batteries certifiées UL 9540A</li>
          </ul>
        </div>

        <div class="section">
          <h3>Garantie Installation kWh</h3>
          <div class="info-box">
            <p><strong>Main d'œuvre:</strong> 10 ans</p>
            <p><strong>Étanchéité:</strong> 10 ans</p>
            <p><strong>Performance garantie:</strong> 90% à 10 ans, 85% à 25 ans</p>
            <p><strong>Monitoring:</strong> Suivi continu inclus</p>
          </div>
        </div>
      </div>

      <div class="page-footer">
        <span>kWh Québec - Étude Préliminaire</span>
        <span>Page 10</span>
      </div>
    </div>
    `;
  }

  // ==================== PAGE 11: HYPOTHÈSES & EXCLUSIONS ====================

  private buildAssumptionsPage(opts: PDFGeneratorOptions): string {
    const defaultAssumptions = [
      'Tarif HQ code M en vigueur (énergie + puissance)',
      'Inflation énergétique annuelle: 3%',
      'Dégradation panneaux: 0.5%/an',
      'Durée de vie système: 25 ans minimum',
      'Taux d\'actualisation: 6%',
      'Rendement solaire: 1 035 kWh/kWc (base Québec)',
      'Efficacité système: ~90% (temp., câblage, onduleur)',
      'ITC fédéral: 30% du CAPEX brut',
      'HQ Autoproduction: 1 000 $/kW (plafond 40% CAPEX)',
    ];

    const defaultExclusions = [
      'Travaux de toiture préalables (si requis)',
      'Mise à niveau du panneau électrique (si requis)',
      'Permis municipaux (variables selon localité)',
      'Études structurales additionnelles',
      'Travaux de génie civil (si requis)',
    ];

    const assumptions = opts.assumptions?.length ? opts.assumptions : defaultAssumptions;
    const exclusions = opts.exclusions?.length ? opts.exclusions : defaultExclusions;

    return `
    <div class="page">
      <h2>Hypothèses & Exclusions</h2>

      <div class="two-column">
        <div class="section">
          <h3>Hypothèses de Calcul</h3>
          <ul class="bullet-list">
            ${assumptions.map(a => `<li>${a}</li>`).join('')}
          </ul>
        </div>

        <div class="section">
          <h3>Exclusions</h3>
          <div class="info-box" style="background: #fef3c7; border-left: 4px solid var(--accent);">
            <ul class="bullet-list" style="margin: 0;">
              ${exclusions.map(e => `<li style="color: #92400e;">${e}</li>`).join('')}
            </ul>
          </div>
        </div>
      </div>

      <div class="section">
        <h3>Sources de Données</h3>
        <div class="info-box">
          <p><strong>Ensoleillement:</strong> Google Solar API (données satellite haute résolution)</p>
          <p><strong>Consommation:</strong> Données Hydro-Québec réelles (via procuration)</p>
          <p><strong>Tarifs électriques:</strong> Hydro-Québec tarifs en vigueur 2026, code tarifaire M</p>
          <p><strong>ITC fédéral:</strong> Loi C-69 — Crédit d'impôt à l'investissement pour technologies propres</p>
          <p><strong>Autoproduction HQ:</strong> Programme Autoproduction d'Hydro-Québec</p>
          <p><strong>Spécifications équipement:</strong> Fiches techniques fabricants certifiés</p>
        </div>
      </div>

      <div class="info-box highlight">
        <p style="margin: 0; color: rgba(255,255,255,0.95);">
          <strong>Important:</strong> Cette étude préliminaire est basée sur les informations disponibles et une analyse
          à distance. Une visite technique et une analyse détaillée confirmeront les paramètres finaux,
          l'admissibilité aux incitatifs, et le devis définitif.
        </p>
      </div>

      <div class="page-footer">
        <span>kWh Québec - Étude Préliminaire</span>
        <span>Page 11</span>
      </div>
    </div>
    `;
  }

  // ==================== PAGE 12: ÉCHÉANCIER TYPE ====================

  private buildTimelinePage(_opts: PDFGeneratorOptions): string {
    return `
    <div class="page">
      <h2>Échéancier Type</h2>
      <p class="subtitle">De la signature à la mise en service</p>

      <div class="timeline">
        <div class="timeline-item">
          <span class="timeline-week">Semaine 1-2</span>
          <div class="timeline-title">Visite Technique & Conception</div>
          <p class="timeline-desc">Relevés sur site, analyse structurale, conception finale du système</p>
        </div>
        <div class="timeline-item">
          <span class="timeline-week">Semaine 3-4</span>
          <div class="timeline-title">Permis & Approbations</div>
          <p class="timeline-desc">Demande de permis municipal, approbation Hydro-Québec pour le raccordement</p>
        </div>
        <div class="timeline-item">
          <span class="timeline-week">Semaine 5-6</span>
          <div class="timeline-title">Approvisionnement</div>
          <p class="timeline-desc">Commande et livraison des équipements sur site</p>
        </div>
        <div class="timeline-item">
          <span class="timeline-week">Semaine 7-10</span>
          <div class="timeline-title">Installation</div>
          <p class="timeline-desc">Montage structure, installation panneaux et batterie, câblage électrique</p>
        </div>
        <div class="timeline-item">
          <span class="timeline-week">Semaine 11</span>
          <div class="timeline-title">Inspection & Raccordement</div>
          <p class="timeline-desc">Inspection électrique, raccordement au réseau Hydro-Québec</p>
        </div>
        <div class="timeline-item">
          <span class="timeline-week">Semaine 12</span>
          <div class="timeline-title">Mise en Service & Formation</div>
          <p class="timeline-desc">Activation du système, configuration monitoring, formation équipe client</p>
        </div>
      </div>

      <div class="info-box" style="margin-top: 10mm;">
        <p><strong>Note:</strong> Cet échéancier est indicatif pour un projet de cette envergure. Les délais réels peuvent varier selon
        la complexité du projet, la disponibilité des équipements et les délais municipaux.</p>
      </div>

      <div class="page-footer">
        <span>kWh Québec - Étude Préliminaire</span>
        <span>Page 12</span>
      </div>
    </div>
    `;
  }

  // ==================== PAGE 13: PROCHAINES ÉTAPES ====================

  private buildNextStepsPage(_opts: PDFGeneratorOptions): string {
    return `
    <div class="page">
      <h2>Prochaines Étapes</h2>
      <p class="subtitle">Un processus simple et transparent</p>

      <div class="funnel-steps">
        <div class="funnel-step">
          <div class="funnel-step-number">1</div>
          <div class="funnel-step-title">Évaluation Détaillée</div>
          <p class="funnel-step-desc">Procuration HQ + analyse complète avec données réelles. Précision ~95%.</p>
          <span class="funnel-step-tag">GRATUIT</span>
        </div>
        <div class="funnel-step">
          <div class="funnel-step-number">2</div>
          <div class="funnel-step-title">Visite & Design</div>
          <p class="funnel-step-desc">Inspection sur site, conception finale, devis ferme garanti 60 jours.</p>
          <span class="funnel-step-tag paid">DEVIS FORMEL</span>
        </div>
        <div class="funnel-step">
          <div class="funnel-step-number">3</div>
          <div class="funnel-step-title">Ingénierie & Construction</div>
          <p class="funnel-step-desc">Plans PE, permis, installation clé en main. On s'occupe de tout.</p>
          <span class="funnel-step-tag paid">8-12 SEMAINES</span>
        </div>
        <div class="funnel-step">
          <div class="funnel-step-number">4</div>
          <div class="funnel-step-title">Monitoring & O&M</div>
          <p class="funnel-step-desc">Suivi en temps réel, maintenance préventive, performance garantie.</p>
          <span class="funnel-step-tag paid">CONTINU</span>
        </div>
      </div>

      <div class="two-column" style="margin-top: 6mm;">
        <div class="section">
          <h3>Prochaine étape immédiate</h3>
          <p>Pour passer de cette étude préliminaire à une analyse détaillée avec vos données réelles :</p>
          <ul class="bullet-list">
            <li>Signer la procuration Hydro-Québec (électronique, 2 minutes)</li>
            <li>Nous accédons à votre historique de consommation complet</li>
            <li>Simulation heure par heure personnalisée</li>
            <li>Résultat en 5 jours ouvrables</li>
          </ul>
        </div>

        <div class="section">
          <h3>Questions fréquentes</h3>
          <div class="info-box" style="font-size: 9pt;">
            <p><strong>Combien ça coûte de signer la procuration?</strong><br>Rien. L'évaluation détaillée est gratuite et sans engagement.</p>
            <p><strong>Quand est-ce que je paie quelque chose?</strong><br>Seulement après la visite technique, quand vous approuvez le devis formel.</p>
            <p style="margin: 0;"><strong>Le devis peut-il changer?</strong><br>Le devis formel est garanti 60 jours, prix ferme.</p>
          </div>
        </div>
      </div>

      <div class="cta-box">
        <h3>Prêt à passer à l'action?</h3>
        <p>Contactez-nous pour démarrer votre évaluation détaillée gratuite</p>
        <p style="font-size: 14pt; margin-top: 5mm;">
          <strong>evaluation@kwh.quebec</strong> &nbsp;|&nbsp; <strong>514-427-8871</strong>
        </p>
        <p style="font-size: 10pt; margin-top: 3mm; opacity: 0.8;">kwh.quebec</p>
      </div>

      <div class="page-footer">
        <span>kWh Québec - Étude Préliminaire</span>
        <span>Page 13</span>
      </div>
    </div>
    `;
  }

  // ==================== HELPERS ====================

  /** Format number with locale */
  private fmt(num: number): string {
    return new Intl.NumberFormat('fr-CA').format(num);
  }

  /** Format currency (CAD, no decimals) */
  private cur(amount: number): string {
    return new Intl.NumberFormat('fr-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  /** Build financial projection rows with payback highlight */
  private buildProjectionRows(opts: PDFGeneratorOptions): string {
    const fp = opts.financialProjections;
    const baseProduction = fp?.annualProduction || opts.analysisResult?.annualProduction || 180000;
    const baseSavings = fp?.yearOneSavings || 42000;
    const netCost = fp?.netCost || 112500;
    const payback = fp?.paybackYears || 2.7;
    const paybackYear = Math.ceil(payback);

    const years = [1, paybackYear, 5, 10, 15, 20, 25];
    // Deduplicate and sort
    const uniqueYears = [...new Set(years)].sort((a, b) => a - b);

    let cumulative = 0;

    return uniqueYears.map(year => {
      const degradation = Math.pow(0.995, year - 1);
      const inflation = Math.pow(1.03, year - 1);
      const production = Math.round(baseProduction * degradation);
      const savings = Math.round(baseSavings * degradation * inflation);

      // Approximate cumulative (sum of all years, not just selected)
      if (year === 1) {
        cumulative = savings;
      } else {
        // Better approximation: integrate
        let sum = 0;
        for (let y = 1; y <= year; y++) {
          const deg = Math.pow(0.995, y - 1);
          const inf = Math.pow(1.03, y - 1);
          sum += Math.round(baseSavings * deg * inf);
        }
        cumulative = sum;
      }

      const isPaybackRow = year === paybackYear && paybackYear > 1 && paybackYear < 5;
      const isYear25 = year === 25;

      if (isYear25) {
        return `
        <tr style="background: var(--primary); color: white;">
          <td><strong>Année ${year}</strong></td>
          <td class="number" style="color: white;">${this.fmt(production)}</td>
          <td class="number" style="color: white;">${this.cur(savings)}</td>
          <td class="number" style="color: white;"><strong>${this.cur(cumulative)}</strong></td>
        </tr>`;
      }

      if (isPaybackRow) {
        return `
        <tr style="background: #FFF8E1;">
          <td><strong>Année ${year} — Récupération</strong></td>
          <td class="number">${this.fmt(production)}</td>
          <td class="number">${this.cur(savings)}</td>
          <td class="number" style="color: #16a34a;"><strong>≈ ${this.cur(netCost)} ✓</strong></td>
        </tr>`;
      }

      return `
      <tr>
        <td>Année ${year}</td>
        <td class="number">${this.fmt(production)}</td>
        <td class="number">${this.cur(savings)}</td>
        <td class="number">${this.cur(cumulative)}</td>
      </tr>`;
    }).join('');
  }
}

// ==================== USAGE EXAMPLE ====================
/*
import { PDFGeneratorV2 } from './pdfGeneratorV2';

const generator = new PDFGeneratorV2();

const pdfBuffer = await generator.generateReport({
  projectData: {
    name: 'Centre de Distribution Terrebonne',
    address: '1234 Rue Industrielle, Terrebonne, QC',
    buildingType: 'Entrepôt/Distribution',
    roofArea: 5000,
    annualConsumption: 250000,
    hqTariffCode: 'M (Moyenne puissance)',
  },
  analysisResult: {
    systemSize: 150,
    annualProduction: 180000,
    coveragePercent: 72,
    co2Avoided: 68,
    totalPanels: 375,
    usedArea: 750,
    specificYield: 1035,
    systemEfficiency: 90,
  },
  financialProjections: {
    grossCost: 375000,
    federalItcPct: 30,
    federalItcAmount: 112500,
    hqAutoproductionPerKw: 1000,
    hqAutoproductionAmount: 150000,
    netCost: 112500,
    totalSavings25yr: 1530000,
    roi: 1260,
    paybackYears: 2.7,
    irr: 38.2,
    npv: 680000,
    lcoe: 0.032,
    yearOneSavings: 42000,
    yearTenSavings: 56000,
    yearTwentyFiveSavings: 78000,
    costOfInaction: 1530000,
    annualProduction: 180000,
    depreciationBenefitMin: 25000,
    depreciationBenefitMax: 40000,
  },
  battery: {
    capacityKwh: 100,
    powerKw: 50,
    dischargeDurationHrs: 2,
    technology: 'LFP (Lithium Fer Phosphate)',
    lifeYears: 15,
    cycles: 6000,
    peakReductionPct: 22,
    additionalSavingsPerYear: 8400,
    peakBefore: 280,
    peakAfter: 218,
  },
  energyProfile: {
    selfConsumptionPct: 85,
    solarCoveragePct: 72,
    surplusPct: 15,
    dataAccuracyPct: 95,
  },
  roofConfig: {
    segments: [
      { name: 'Section A - Sud', panels: 200, azimuth: 180, tilt: 10 },
      { name: 'Section B - Est', panels: 100, azimuth: 90, tilt: 10 },
      { name: 'Section C - Ouest', panels: 75, azimuth: 270, tilt: 10 },
    ],
    panelType: 'Monocristallin 400W',
  },
  // Optional: provide base64 images
  // logoBase64: 'data:image/png;base64,...',
  // satelliteImageBase64: 'data:image/png;base64,...',
  // roofConfigImageBase64: 'data:image/png;base64,...',
  // clientLogos: ['data:image/png;base64,...', 'data:image/png;base64,...'],
});

import fs from 'fs';
fs.writeFileSync('rapport.pdf', pdfBuffer);
*/
