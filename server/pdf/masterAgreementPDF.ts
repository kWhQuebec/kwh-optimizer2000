import puppeteer from "puppeteer";
import * as path from "path";
import * as fs from "fs";
import type { SiteFinancialModel } from "@shared/schema";
import { createLogger } from "../lib/logger";

const log = createLogger("MasterAgreementPDF");

export interface MasterAgreementSiteData {
  siteName: string;
  address?: string;
  city?: string;
  financialModel?: SiteFinancialModel;
  pvSizeKW?: number | null;
  firstYearKwh?: number | null;
  totalProjectCost?: number | null;
}

export interface MasterAgreementData {
  name: string;
  clientName: string;
  description?: string;
  numBuildings: number;
  volumeDiscountPercent: number | null;
  totalPvSizeKW: number | null;
  totalBatteryKWh: number | null;
  totalCapexNet: number | null;
  totalNpv25: number | null;
  totalAnnualSavings: number | null;
  totalCo2Avoided: number | null;
  totalFirstYearKwh?: number | null;
  sites: MasterAgreementSiteData[];
}

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

function fmt(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) return "&mdash;";
  return new Intl.NumberFormat("fr-CA").format(Math.round(num));
}

function cur(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return "&mdash;";
  return `${Math.round(amount).toLocaleString("fr-CA")}&nbsp;$`;
}

function pct(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "&mdash;";
  if (value < 1) return `${(value * 100).toFixed(1)}&nbsp;%`;
  return `${value.toFixed(1)}&nbsp;%`;
}

function getStyles(): string {
  return `
* { margin: 0; padding: 0; box-sizing: border-box; }
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap');
body {
  font-family: 'Montserrat', 'Helvetica Neue', Arial, sans-serif;
  font-size: 10pt; line-height: 1.45; color: #2A2A2B; background: white;
}
:root {
  --primary: #003DA6; --primary-dark: #002B75;
  --accent: #FFB005; --accent-light: #FFD060;
  --dark: #2A2A2B; --gray: #6b7280; --light-gray: #f3f4f6; --white: #ffffff;
  --green: #16A34A; --red: #DC2626;
}
.page {
  width: 215.9mm; min-height: 279.4mm; max-height: 279.4mm;
  padding: 18mm 22mm; page-break-after: always; page-break-inside: avoid;
  position: relative; overflow: hidden; background: white;
}
.page-auto {
  width: 215.9mm; min-height: 279.4mm;
  padding: 18mm 22mm; page-break-after: always;
  position: relative; background: white;
}
.page:last-child, .page-auto:last-child { page-break-after: auto; }
h1 { font-size: 28pt; font-weight: 700; color: var(--primary); margin-bottom: 8mm; }
h2 { font-size: 18pt; font-weight: 600; color: var(--primary); margin-bottom: 5mm; padding-bottom: 2mm; border-bottom: 2px solid var(--accent); }
h3 { font-size: 12pt; font-weight: 600; color: var(--dark); margin-bottom: 3mm; }
h4 { font-size: 10pt; font-weight: 600; color: var(--primary); margin-bottom: 2mm; margin-top: 4mm; }
p { margin-bottom: 2mm; color: var(--dark); }
.section-num { font-size: 13pt; font-weight: 700; color: var(--primary); margin-bottom: 1mm; }

.cover-page {
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
  color: white; display: flex; flex-direction: column; align-items: center;
  justify-content: center; text-align: center; padding: 30mm 25mm;
}
.cover-title { font-size: 36pt; font-weight: 700; letter-spacing: 2px; margin-bottom: 6mm; }
.cover-subtitle { font-size: 16pt; opacity: 0.85; margin-bottom: 25mm; font-weight: 400; }
.cover-client { font-size: 22pt; font-weight: 600; margin-bottom: 4mm; }
.cover-stats { font-size: 14pt; opacity: 0.8; margin-bottom: 30mm; }
.cover-prepared { font-size: 11pt; opacity: 0.7; margin-bottom: 2mm; }
.cover-collab { font-size: 11pt; opacity: 0.7; margin-bottom: 15mm; }
.cover-date { font-size: 11pt; opacity: 0.7; margin-bottom: 20mm; }
.cover-confidential { font-size: 9pt; opacity: 0.5; font-style: italic; }
.cover-ref { font-size: 9pt; opacity: 0.5; margin-top: 5mm; }

.toc-item { display: flex; justify-content: space-between; padding: 3mm 0; border-bottom: 1px dotted #ddd; font-size: 11pt; }
.toc-num { font-weight: 700; color: var(--primary); min-width: 12mm; }
.toc-title { flex: 1; }

.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5mm; margin: 8mm 0; }
.kpi-card { background: var(--light-gray); border-radius: 3mm; padding: 6mm 4mm; text-align: center; border: 1px solid #e5e7eb; }
.kpi-value { font-size: 20pt; font-weight: 700; color: var(--primary); display: block; margin-bottom: 1mm; }
.kpi-label { font-size: 8pt; color: var(--gray); text-transform: uppercase; letter-spacing: 0.5px; }

.benefit-list { list-style: none; padding: 0; margin: 6mm 0; }
.benefit-list li { padding: 3mm 0 3mm 10mm; position: relative; font-size: 10pt; color: var(--dark); border-bottom: 1px solid var(--light-gray); }
.benefit-list li::before { content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 4mm; height: 4mm; background: var(--accent); border-radius: 1px; }

.role-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5mm; margin: 8mm 0; }
.role-card { border: 1px solid #e5e7eb; border-radius: 3mm; padding: 6mm; text-align: center; }
.role-type { font-size: 8pt; color: var(--gray); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3mm; }
.role-name { font-size: 13pt; font-weight: 700; color: var(--primary); margin-bottom: 2mm; }
.role-desc { font-size: 8.5pt; color: var(--gray); line-height: 1.4; }

.badge { display: inline-block; padding: 1mm 3mm; border-radius: 2mm; font-size: 7pt; font-weight: 600; letter-spacing: 0.3px; }
.badge-kwh { background: var(--primary); color: white; }
.badge-dream { background: var(--accent); color: var(--dark); }
.badge-computed { background: #e5e7eb; color: var(--gray); }
.badge-row { display: flex; gap: 3mm; justify-content: center; margin-top: 5mm; }

.terms-table { width: 100%; border-collapse: collapse; margin: 5mm 0; font-size: 9.5pt; }
.terms-table th { background: var(--primary); color: white; padding: 3mm 5mm; text-align: left; font-weight: 600; }
.terms-table td { padding: 3mm 5mm; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
.terms-table tr:nth-child(even) { background: var(--light-gray); }
.terms-table .clause { font-weight: 600; color: var(--primary); white-space: nowrap; min-width: 55mm; }

.site-table { width: 100%; border-collapse: collapse; margin: 5mm 0; font-size: 8pt; }
.site-table th { background: var(--primary); color: white; padding: 2.5mm 3mm; text-align: left; font-weight: 600; font-size: 7.5pt; }
.site-table td { padding: 2mm 3mm; border-bottom: 1px solid #e5e7eb; }
.site-table tr:nth-child(even) { background: var(--light-gray); }
.site-table .number { text-align: right; font-family: 'Courier New', monospace; }
.site-table .total-row { background: var(--primary) !important; color: white; font-weight: 700; }
.site-table .total-row td { border-bottom: none; }

.scope-table { width: 100%; border-collapse: collapse; margin: 4mm 0; font-size: 9pt; }
.scope-table th { background: var(--primary); color: white; padding: 2.5mm 5mm; text-align: left; font-weight: 600; font-size: 9pt; }
.scope-table td { padding: 3mm 5mm; border-bottom: 1px solid #e5e7eb; vertical-align: top; line-height: 1.4; }
.scope-table tr:nth-child(even) { background: var(--light-gray); }
.scope-table .scope-cat { font-weight: 600; color: var(--primary); white-space: nowrap; min-width: 40mm; }

.sov-table { width: 100%; border-collapse: collapse; margin: 5mm 0; font-size: 9.5pt; }
.sov-table th { background: var(--primary); color: white; padding: 3mm 5mm; text-align: left; font-weight: 600; }
.sov-table td { padding: 3mm 5mm; border-bottom: 1px solid #e5e7eb; }
.sov-table tr:nth-child(even) { background: var(--light-gray); }
.sov-table .sov-pct { text-align: right; font-weight: 600; color: var(--primary); font-family: 'Courier New', monospace; }
.sov-table .total-row { background: var(--primary) !important; color: white; font-weight: 700; }
.sov-table .total-row td { border-bottom: none; }

.assumptions-list { list-style: none; padding: 0; margin: 4mm 0; }
.assumptions-list li { padding: 1.5mm 0 1.5mm 8mm; position: relative; font-size: 8.5pt; color: var(--dark); line-height: 1.4; }
.assumptions-list li::before { content: '\\2022'; position: absolute; left: 0; color: var(--primary); font-weight: 700; }

.equip-table { width: 100%; border-collapse: collapse; margin: 3mm 0; font-size: 8.5pt; }
.equip-table th { background: var(--primary); color: white; padding: 2mm 4mm; text-align: left; font-weight: 600; font-size: 8pt; }
.equip-table td { padding: 2mm 4mm; border-bottom: 1px solid #e5e7eb; }
.equip-table tr:nth-child(even) { background: var(--light-gray); }

.annex-header { margin-bottom: 5mm; }
.annex-site-name { font-size: 14pt; font-weight: 700; color: var(--primary); margin-bottom: 1mm; }
.annex-address { font-size: 10pt; color: var(--gray); }

.annex-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; margin-top: 5mm; }
.annex-box { border: 1px solid #e5e7eb; border-radius: 3mm; overflow: hidden; }
.annex-box-header { background: var(--primary); color: white; padding: 3mm 5mm; font-weight: 600; font-size: 10pt; }
.annex-box-body { padding: 0; }
.annex-row { display: flex; justify-content: space-between; align-items: center; padding: 2.5mm 5mm; border-bottom: 1px solid #f0f0f0; font-size: 9pt; }
.annex-row:nth-child(even) { background: var(--light-gray); }
.annex-row:last-child { border-bottom: none; }
.annex-row-label { display: flex; align-items: center; gap: 2mm; flex: 1; }
.annex-row-value { font-weight: 600; text-align: right; white-space: nowrap; }

.sc-article { margin-bottom: 4mm; padding: 3mm 4mm; border-left: 3px solid var(--primary); background: var(--light-gray); border-radius: 0 3mm 3mm 0; }
.sc-ref { font-size: 9pt; font-weight: 700; color: var(--primary); margin-bottom: 1mm; }
.sc-title { font-size: 9pt; font-weight: 600; color: var(--dark); margin-bottom: 1.5mm; }
.sc-text { font-size: 8.5pt; color: var(--gray); line-height: 1.5; }

.conditions-list { counter-reset: condition; list-style: none; padding: 0; margin: 5mm 0; }
.condition-item { margin-bottom: 5mm; padding: 4mm 5mm; border: 1px solid #e5e7eb; border-radius: 3mm; }
.condition-num { font-size: 11pt; font-weight: 700; color: var(--primary); margin-bottom: 1mm; }
.condition-title { font-size: 10pt; font-weight: 600; color: var(--dark); margin-bottom: 2mm; }
.condition-text { font-size: 9pt; color: var(--gray); line-height: 1.5; }

.sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15mm; margin: 15mm 0; }
.sig-block { border-top: 2px solid var(--primary); padding-top: 5mm; }
.sig-org { font-size: 13pt; font-weight: 700; color: var(--primary); margin-bottom: 10mm; }
.sig-line { border-bottom: 1px solid #ccc; padding: 8mm 0 2mm 0; margin-bottom: 3mm; }
.sig-label { font-size: 8pt; color: var(--gray); }
.sig-disclaimer { margin-top: 12mm; padding: 5mm; background: var(--light-gray); border-radius: 3mm; font-size: 8.5pt; color: var(--gray); line-height: 1.5; font-style: italic; }

.page-footer {
  position: absolute; bottom: 8mm; left: 22mm; right: 22mm;
  display: flex; justify-content: space-between;
  font-size: 7.5pt; color: var(--gray);
  border-top: 1px solid #e5e7eb; padding-top: 2mm;
}
`;
}

function footerHtml(t: (fr: string, en: string) => string, dateStr: string, pageNum: number): string {
  return `<div class="page-footer">
    <span>${t("Confidentiel", "Confidential")} &mdash; kWh Qu&eacute;bec &amp; Dream Industrial REIT</span>
    <span>${dateStr} &mdash; Page ${pageNum}</span>
  </div>`;
}

function buildCoverPage(data: MasterAgreementData, t: (fr: string, en: string) => string, dateStr: string, logoBase64: string | null): string {
  const logoHtml = logoBase64 ? `<img src="${logoBase64}" style="max-width: 150px; height: auto; margin-bottom: 10mm; opacity: 0.9;" />` : "";
  const totalKw = data.totalPvSizeKW ? fmt(data.totalPvSizeKW) : "&mdash;";
  return `
  <div class="page cover-page">
    ${logoHtml}
    <div class="cover-title">${t("ENTENTE CADRE", "MASTER AGREEMENT")}</div>
    <div class="cover-subtitle">${t("Contrat &agrave; forfait de conception-construction", "Design-Build Stipulated Price Contract")}</div>
    <div class="cover-client">${data.clientName}</div>
    <div class="cover-stats">${data.numBuildings} sites &bull; ${totalKw} kW DC</div>
    <div class="cover-prepared">${t("Conception-Construction par", "Design-Build by")} kWh Qu&eacute;bec</div>
    <div class="cover-collab">${t("En collaboration avec", "In collaboration with")} ScaleClean Tech</div>
    <div class="cover-date">${dateStr}</div>
    <div class="cover-ref">${t("R&eacute;f&eacute;rence", "Reference")}: CCDC 14 &mdash; 2013</div>
    <div class="cover-confidential">${t("Document confidentiel &mdash; Ne pas distribuer", "Confidential document &mdash; Do not distribute")}</div>
  </div>`;
}

function buildTocPage(t: (fr: string, en: string) => string, dateStr: string): string {
  const sections = [
    { num: "1", title: t("Sommaire Ex&eacute;cutif", "Executive Summary") },
    { num: "2", title: t("Parties et R&ocirc;les", "Parties &amp; Roles") },
    { num: "3", title: t("Termes Commerciaux", "Commercial Terms") },
    { num: "4", title: t("Cadre Financier", "Financial Framework") },
    { num: "5", title: t("&Eacute;tendue des Travaux", "Scope of Work") },
    { num: "6", title: t("&Eacute;ch&eacute;ancier de Paiement", "Schedule of Values") },
    { num: "7", title: t("Annexe A &mdash; Fiches par Site", "Annex A &mdash; Per-Site Schedules") },
    { num: "8", title: t("Conditions Suppl&eacute;mentaires au CCDC&nbsp;14", "Supplementary Conditions to CCDC&nbsp;14") },
    { num: "9", title: t("Signatures", "Signatures") },
  ];
  const tocItems = sections.map(s => `
    <div class="toc-item">
      <span class="toc-num">${s.num}</span>
      <span class="toc-title">${s.title}</span>
    </div>`).join("");

  return `
  <div class="page">
    <h2>${t("Table des Mati&egrave;res", "Table of Contents")}</h2>
    <div style="margin-top: 8mm;">${tocItems}</div>
    ${footerHtml(t, dateStr, 1)}
  </div>`;
}

function buildExecutiveSummaryPage(data: MasterAgreementData, t: (fr: string, en: string) => string, dateStr: string): string {
  const totalKw = data.totalPvSizeKW ? fmt(data.totalPvSizeKW) : "&mdash;";
  const totalKwh = data.totalFirstYearKwh ? fmt(data.totalFirstYearKwh) : "&mdash;";
  const totalInvest = data.totalCapexNet ? cur(data.totalCapexNet) : "&mdash;";

  const benefits = [
    t("Rabais volume sur l'approvisionnement en &eacute;quipement et la main-d'&oelig;uvre", "Volume discount on equipment procurement and labour"),
    t("Gestion de projet unifi&eacute;e avec un seul point de contact", "Unified project management with a single point of contact"),
    t("&Eacute;conomies d'&eacute;chelle sur les frais de d&eacute;veloppement", "Economies of scale on development fees"),
    t("Contrat global d'exploitation et maintenance (O&amp;M)", "Global operations &amp; maintenance (O&amp;M) contract"),
    t("Rapport consolid&eacute; et suivi centralis&eacute; de la performance", "Consolidated reporting and centralized performance monitoring"),
  ];

  return `
  <div class="page">
    <div class="section-num">1</div>
    <h2>${t("Sommaire Ex&eacute;cutif", "Executive Summary")}</h2>
    <p style="font-size: 10pt; color: var(--gray); margin-bottom: 6mm;">
      ${t(
        `kWh Qu&eacute;bec a le plaisir de soumettre &agrave; ${data.clientName} cette entente cadre couvrant l'installation de syst&egrave;mes solaires photovolta&iuml;ques sur ${data.numBuildings} sites industriels au Qu&eacute;bec. Cette proposition refl&egrave;te un rabais volume significatif rendu possible par le regroupement de tous les sites sous un seul accord-cadre.`,
        `kWh Qu&eacute;bec is pleased to submit to ${data.clientName} this master agreement covering the installation of photovoltaic solar systems on ${data.numBuildings} industrial sites in Quebec. This proposal reflects a significant volume discount made possible by grouping all sites under a single framework agreement.`
      )}
    </p>
    <div class="kpi-grid">
      <div class="kpi-card"><span class="kpi-value">${data.numBuildings}</span><span class="kpi-label">Sites</span></div>
      <div class="kpi-card"><span class="kpi-value">${totalKw}</span><span class="kpi-label">Total kW DC</span></div>
      <div class="kpi-card"><span class="kpi-value">${totalKwh}</span><span class="kpi-label">${t("kWh An 1", "Year 1 kWh")}</span></div>
      <div class="kpi-card"><span class="kpi-value">${totalInvest}</span><span class="kpi-label">${t("Investissement Total", "Total Investment")}</span></div>
    </div>
    <h3>${t("Avantages du Portfolio", "Portfolio Benefits")}</h3>
    <ul class="benefit-list">
      ${benefits.map(b => `<li>${b}</li>`).join("")}
    </ul>
    ${footerHtml(t, dateStr, 2)}
  </div>`;
}

function buildPartiesPage(t: (fr: string, en: string) => string, dateStr: string): string {
  return `
  <div class="page">
    <div class="section-num">2</div>
    <h2>${t("Parties et R&ocirc;les", "Parties &amp; Roles")}</h2>
    <div class="role-grid">
      <div class="role-card">
        <div class="role-type">${t("Propri&eacute;taire", "Owner")}</div>
        <div class="role-name">Dream Industrial REIT</div>
        <div class="role-desc">${t(
          "Propri&eacute;taire des b&acirc;timents et b&eacute;n&eacute;ficiaire de l'&eacute;nergie produite. Responsable des frais d'interconnexion (Hydro-Qu&eacute;bec), permis municipaux et acc&egrave;s au toit.",
          "Property owner and beneficiary of produced energy. Responsible for interconnection fees (Hydro-Qu&eacute;bec), municipal permits and roof access."
        )}</div>
      </div>
      <div class="role-card">
        <div class="role-type">${t("Concepteur-Constructeur", "Design-Builder")}</div>
        <div class="role-name">kWh Qu&eacute;bec</div>
        <div class="role-desc">${t(
          "Concepteur-Constructeur (EPC) responsable de l'ing&eacute;nierie, de l'approvisionnement et de la construction. &Eacute;galement responsable de l'exploitation et la maintenance (O&amp;M) post-construction.",
          "Design-Builder (EPC) responsible for engineering, procurement and construction. Also responsible for post-construction operations &amp; maintenance (O&amp;M)."
        )}</div>
      </div>
      <div class="role-card">
        <div class="role-type">${t("Consultant RFP", "RFP Consultant")}</div>
        <div class="role-name">ScaleClean Tech</div>
        <div class="role-desc">${t(
          "Consultant ind&eacute;pendant mandat&eacute; par Dream Industrial REIT pour la gestion du RFP, l'&eacute;valuation technique et la recommandation de fournisseurs.",
          "Independent consultant mandated by Dream Industrial REIT for RFP management, technical evaluation and vendor recommendation."
        )}</div>
      </div>
    </div>
    <div class="badge-row">
      <span class="badge badge-kwh">${t("Responsabilit&eacute; kWh", "kWh Responsibility")}</span>
      <span class="badge badge-dream">${t("Responsabilit&eacute; Dream", "Dream Responsibility")}</span>
      <span class="badge badge-computed">${t("Valeur Calcul&eacute;e", "Computed Value")}</span>
    </div>
    ${footerHtml(t, dateStr, 3)}
  </div>`;
}

function buildCommercialTermsPage(t: (fr: string, en: string) => string, dateStr: string): string {
  const terms = [
    { clause: t("Structure du Contrat", "Contract Structure"), details: t("Entente cadre CCDC&nbsp;14 avec conditions suppl&eacute;mentaires et annexes par site", "CCDC&nbsp;14 master agreement with supplementary conditions and per-site annexes") },
    { clause: t("Mod&egrave;le Commercial", "Commercial Model"), details: t("PPA (Power Purchase Agreement) &mdash; vente d'&eacute;nergie", "PPA (Power Purchase Agreement) &mdash; energy sale") },
    { clause: t("Dur&eacute;e du PPA", "PPA Duration"), details: t("25 ans, avec option de prolongation", "25 years, with extension option") },
    { clause: t("Indexation Annuelle", "Annual Escalation"), details: t("Selon l'indice d&eacute;fini par site", "Per site-defined escalation index") },
    { clause: t("Garantie de Performance", "Performance Guarantee"), details: t("Ratio de performance minimum de 80&nbsp;% garanti", "Minimum 80% performance ratio guaranteed") },
    { clause: t("P&eacute;nalit&eacute; de Sous-Performance", "Underperformance Penalty"), details: t("Cr&eacute;dit &eacute;nerg&eacute;tique pour production sous 80&nbsp;% du P50", "Energy credit for production below 80% of P50") },
    { clause: t("Assurance", "Insurance"), details: t("Couverture tous risques construction + responsabilit&eacute; professionnelle (min. 5&nbsp;M$)", "All-risk construction coverage + professional liability (min. $5M)") },
    { clause: t("Cr&eacute;dit d'Imp&ocirc;t (CII)", "Investment Tax Credit (ITC)"), details: t("&Eacute;ligibilit&eacute; au CII f&eacute;d&eacute;ral &mdash; montant par site", "Federal ITC eligibility &mdash; amount per site") },
    { clause: t("Transfert de Propri&eacute;t&eacute;", "Ownership Transfer"), details: t("L'&eacute;quipement devient propri&eacute;t&eacute; de Dream &agrave; la fin du PPA", "Equipment becomes Dream's property at end of PPA") },
    { clause: t("Calendrier de Construction", "Construction Schedule"), details: t("D&eacute;ploiement progressif &mdash; phases d&eacute;finies par site", "Progressive deployment &mdash; site-defined phases") },
  ];

  return `
  <div class="page">
    <div class="section-num">3</div>
    <h2>${t("Termes Commerciaux", "Commercial Terms")}</h2>
    <table class="terms-table">
      <thead><tr><th>${t("Clause", "Clause")}</th><th>${t("D&eacute;tails", "Details")}</th></tr></thead>
      <tbody>
        ${terms.map(term => `<tr><td class="clause">${term.clause}</td><td>${term.details}</td></tr>`).join("")}
      </tbody>
    </table>
    ${footerHtml(t, dateStr, 4)}
  </div>`;
}

function buildFinancialFrameworkPage(data: MasterAgreementData, t: (fr: string, en: string) => string, dateStr: string): string {
  const siteRows = data.sites.map(site => {
    const fm = site.financialModel;
    const pvKw = fm?.projectSpecs?.projectSizeDcKw ?? site.pvSizeKW;
    const yr1 = fm?.projectSpecs?.firstYearKwh ?? site.firstYearKwh;
    const cost = fm?.projectCosts?.totalProjectCost ?? site.totalProjectCost;

    return `<tr>
      <td>${site.siteName}</td>
      <td class="number">${pvKw ? fmt(pvKw) : "&mdash;"}</td>
      <td class="number">${yr1 ? fmt(yr1) : "&mdash;"}</td>
      <td class="number">${cost ? cur(cost) : "&mdash;"}</td>
    </tr>`;
  }).join("");

  const totalPv = data.totalPvSizeKW ? fmt(data.totalPvSizeKW) : "&mdash;";
  const totalKwh = data.totalFirstYearKwh ? fmt(data.totalFirstYearKwh) : "&mdash;";
  const totalCost = data.totalCapexNet ? cur(data.totalCapexNet) : "&mdash;";

  return `
  <div class="page">
    <div class="section-num">4</div>
    <h2>${t("Cadre Financier", "Financial Framework")}</h2>
    <p style="font-size: 9pt; color: var(--gray); margin-bottom: 4mm;">
      ${t(
        "Le tableau suivant pr&eacute;sente un sommaire financier consolid&eacute; du portfolio. Les d&eacute;tails par site sont pr&eacute;sent&eacute;s &agrave; l'Annexe&nbsp;A.",
        "The following table presents a consolidated financial summary of the entire portfolio. Site-specific details are presented in Annex&nbsp;A."
      )}
    </p>
    <table class="site-table">
      <thead><tr>
        <th>${t("Site", "Site")}</th>
        <th style="text-align:right">${t("Taille DC (kW)", "DC Size (kW)")}</th>
        <th style="text-align:right">${t("Prod. An 1 (kWh)", "Year 1 Prod. (kWh)")}</th>
        <th style="text-align:right">${t("Co&ucirc;t Total", "Total Cost")}</th>
      </tr></thead>
      <tbody>
        ${siteRows}
        <tr class="total-row">
          <td>TOTAL / AVG.</td>
          <td class="number">${totalPv}</td>
          <td class="number">${totalKwh}</td>
          <td class="number">${totalCost}</td>
        </tr>
      </tbody>
    </table>
    ${footerHtml(t, dateStr, 5)}
  </div>`;
}

function buildScopeOfWorkPages(t: (fr: string, en: string) => string, dateStr: string, startPage: number): string[] {
  const pages: string[] = [];

  const ownerScope = [
    {
      cat: t("Frais de service public", "Utility Fees"),
      desc: t(
        "Payer tous les frais relatifs &agrave; Hydro-Qu&eacute;bec, tels que requis pour le Projet. Le Concepteur-Constructeur facilitera ce paiement.",
        "Pay all fees related to Hydro-Qu&eacute;bec, as required for the Project. The Design-Builder will facilitate this payment."
      ),
    },
    {
      cat: t("Inspection du toit", "Roof Inspection"),
      desc: t(
        "Le Propri&eacute;taire organise et assume tous les co&ucirc;ts pour l'inspection du toit avant le d&eacute;but de la construction. Le Propri&eacute;taire peut choisir de renoncer &agrave; l'inspection &agrave; sa discr&eacute;tion.",
        "Owner to arrange and assume all costs for roof inspection prior to construction start. Owner may choose to forego roof inspections prior to construction at its discretion."
      ),
    },
    {
      cat: t("Conception et ing&eacute;nierie", "Design &amp; Engineering"),
      desc: t(
        "Fournir les exigences du Propri&eacute;taire au Concepteur-Constructeur. Examiner et approuver les plans d'ing&eacute;nierie.",
        "Provide Owner's statement of requirements to Design-Builder for design and engineering. Review all design and engineering packages and approve for general arrangement."
      ),
    },
    {
      cat: t("Interconnexion", "Interconnection"),
      desc: t(
        "Payer les montants dus pour les ententes de raccordement avec Hydro-Qu&eacute;bec. Co&ucirc;ts continus de la liaison de communication si requis.",
        "Pay amounts due for connection agreements with Hydro-Qu&eacute;bec, where applicable. Ongoing costs of communication link for utility if required."
      ),
    },
    {
      cat: t("Suivi / Monitoring", "Monitoring"),
      desc: t(
        "Payer les co&ucirc;ts continus de la liaison de communication pour l'acquisition de donn&eacute;es et l'abonnement au syst&egrave;me de surveillance. Fournir les lignes t&eacute;l&eacute;phoniques et de donn&eacute;es &agrave; proximit&eacute; des &eacute;quipements de mesure.",
        "Pay ongoing costs for data acquisition communications link and monitoring system subscription. Provide phone and data lines to the general vicinity of metering and monitoring equipment."
      ),
    },
  ];

  const dbScope = [
    {
      cat: t("Ing&eacute;nierie structurelle", "Structural Engineering"),
      desc: t(
        "Engager un ing&eacute;nieur en structure (membre de l'OIQ) pour r&eacute;aliser une &eacute;tude de faisabilit&eacute; structurelle et fournir le rapport. Si des ancrages sismiques sont n&eacute;cessaires, les co&ucirc;ts seront &agrave; la charge du Propri&eacute;taire.",
        "Engage a structural engineer (OIQ member) to perform a structural feasibility study and provide the report. If seismic anchors are deemed required, costs to be borne by Owner."
      ),
    },
    {
      cat: t("Avis &agrave; Hydro-Qu&eacute;bec", "Utility Notice"),
      desc: t(
        "Soumettre la demande de raccordement &agrave; Hydro-Qu&eacute;bec. Effectuer l'&eacute;tude d'impact sur le r&eacute;seau. Examiner les rapports et fournir les r&eacute;troactions pertinentes.",
        "Submit connection request to Hydro-Qu&eacute;bec. Complete the grid impact study. Review reports and provide related feedback."
      ),
    },
    {
      cat: t("Conception &eacute;lectrique", "Electrical Design"),
      desc: t(
        "Pr&eacute;parer les plans d'ing&eacute;nierie &eacute;lectrique conform&eacute;ment au Code de construction du Qu&eacute;bec, Chapitre V &mdash; &Eacute;lectricit&eacute; (CSA&nbsp;C22.10) et aux normes applicables. Soumettre les plans aux autorit&eacute;s comp&eacute;tentes (RBQ). Fournir les plans &laquo;&nbsp;tel que construit&nbsp;&raquo; (sceau OIQ).",
        "Prepare electrical engineering drawings in accordance with the Code de construction du Qu&eacute;bec, Chapter V &mdash; Electricity (CSA&nbsp;C22.10) and applicable standards. Submit plans to authorities having jurisdiction (RBQ). Provide as-built drawings (OIQ stamped)."
      ),
    },
    {
      cat: t("Approvisionnement", "Procurement"),
      desc: t(
        "Approvisionner les modules, le racking, les onduleurs et les transformateurs selon les sp&eacute;cifications approuv&eacute;es (Annexe&nbsp;A). Fournir les c&acirc;bles, conduits, sectionneurs et le Balance of System (BOS) requis. Fournir et installer le syst&egrave;me de surveillance.",
        "Procure modules, racking, inverters and transformers per approved specifications (Annex&nbsp;A). Supply cables, conduits, disconnects and Balance of System (BOS) required. Supply and install monitoring system."
      ),
    },
    {
      cat: t("Construction", "Construction"),
      desc: t(
        "Fournir toutes les installations, main-d'&oelig;uvre, mat&eacute;riaux et &eacute;quipements n&eacute;cessaires &agrave; la conception, fabrication, installation, mise en service et d&eacute;marrage du Projet.",
        "Provide all necessary facilities, labour, materials, and construction equipment required for the design, fabrication, installation, commissioning and start-up of the Project."
      ),
    },
    {
      cat: t("Sant&eacute; et s&eacute;curit&eacute;", "Health &amp; Safety"),
      desc: t(
        "Ex&eacute;cuter tous les travaux conform&eacute;ment &agrave; la LSST (Loi sur la sant&eacute; et la s&eacute;curit&eacute; du travail) et aux exigences de la CNESST. Fournir un plan de sant&eacute; et s&eacute;curit&eacute;. Organiser une r&eacute;union de lancement s&eacute;curit&eacute; et des causeries hebdomadaires.",
        "Perform all work according to LSST (Act respecting occupational health and safety) and all CNESST requirements. Supply a Health and Safety Plan. Organize safety kickoff meeting and hold weekly safety talks."
      ),
    },
    {
      cat: t("Gestion de projet", "Project Management"),
      desc: t(
        "Fournir la gestion de projet incluant : r&eacute;union de pr&eacute;-construction, rapports d'avancement, r&eacute;unions planifi&eacute;es, supervision sur site. Coordonner les inspections avec les autorit&eacute;s comp&eacute;tentes (RBQ, municipalit&eacute;, Hydro-Qu&eacute;bec).",
        "Provide Project Management including: pre-construction meeting, progress reports, scheduled meetings, on-site supervision. Coordinate inspections with authorities having jurisdiction (RBQ, municipality, Hydro-Qu&eacute;bec)."
      ),
    },
    {
      cat: t("Permis", "Permits"),
      desc: t(
        "Obtenir, maintenir et fermer les permis de construction et les permis &eacute;lectriques (RBQ).",
        "Obtain, maintain and close out building permit and electrical permit (RBQ)."
      ),
    },
    {
      cat: t("C&acirc;blage et mise en service", "Wiring &amp; Commissioning"),
      desc: t(
        "Installation compl&egrave;te du c&acirc;blage AC et DC, mise &agrave; la terre, essais et mise en service. Coordination avec Hydro-Qu&eacute;bec pour la date de mise en service. C&acirc;bles en aluminium pour les alimentations AC.",
        "Complete AC and DC wiring installation, grounding, testing and commissioning. Coordinate with Hydro-Qu&eacute;bec for in-service date. Aluminum wiring for AC feeders."
      ),
    },
    {
      cat: t("Documentation de cl&ocirc;ture", "Close-Out Documentation"),
      desc: t(
        "Fournir : plans de construction et tel que construit, fiches techniques, donn&eacute;es de mise en service, tests d'acceptation en usine, manuel d'exploitation et maintenance.",
        "Provide: issued-for-construction and as-built drawings, specification sheets, commissioning data and results, factory acceptance tests, Operations and Maintenance Manual."
      ),
    },
  ];

  pages.push(`
  <div class="page">
    <div class="section-num">5</div>
    <h2>${t("&Eacute;tendue des Travaux", "Scope of Work")}</h2>
    <p style="font-size: 9pt; color: var(--gray); margin-bottom: 4mm;">
      ${t(
        "L'&eacute;tendue des travaux du Concepteur-Constructeur sera livr&eacute;e conform&eacute;ment aux recommandations des fabricants d'&eacute;quipement, aux autorisations gouvernementales, aux lois applicables, aux bonnes pratiques d'ing&eacute;nierie et aux dispositions de l'Entente.",
        "The Design-Builder's Scope of Work shall be delivered in accordance with equipment manufacturer recommendations, governmental authorizations, applicable laws, good engineering practices and the provisions of the Agreement."
      )}
    </p>
    <h3>${t("&Eacute;tendue du Propri&eacute;taire", "Owner's Scope of Work")}</h3>
    <table class="scope-table">
      <thead><tr><th>${t("Cat&eacute;gorie", "Category")}</th><th>${t("Description", "Description")}</th></tr></thead>
      <tbody>
        ${ownerScope.map(s => `<tr><td class="scope-cat">${s.cat}</td><td>${s.desc}</td></tr>`).join("")}
      </tbody>
    </table>
    <p style="font-size: 8.5pt; color: var(--gray); text-align: center; margin-top: 3mm; font-style: italic;">
      *${t("FIN DE L'&Eacute;TENDUE DU PROPRI&Eacute;TAIRE", "END OF OWNER'S SCOPE OF WORK")}*
    </p>
    ${footerHtml(t, dateStr, startPage)}
  </div>`);

  pages.push(`
  <div class="page">
    <h3>${t("&Eacute;tendue du Concepteur-Constructeur", "Design-Builder's Scope of Work")}</h3>
    <table class="scope-table">
      <thead><tr><th>${t("Cat&eacute;gorie", "Category")}</th><th>${t("Description", "Description")}</th></tr></thead>
      <tbody>
        ${dbScope.map(s => `<tr><td class="scope-cat">${s.cat}</td><td>${s.desc}</td></tr>`).join("")}
      </tbody>
    </table>
    <p style="font-size: 8.5pt; color: var(--gray); text-align: center; margin-top: 3mm; font-style: italic;">
      *${t("FIN DE L'&Eacute;TENDUE DU CONCEPTEUR-CONSTRUCTEUR", "END OF DESIGN-BUILDER'S SCOPE OF WORK")}*
    </p>
    ${footerHtml(t, dateStr, startPage + 1)}
  </div>`);

  return pages;
}

function buildScheduleOfValuesPage(t: (fr: string, en: string) => string, dateStr: string, pageNum: number): string {
  const milestones = [
    { desc: t("Ex&eacute;cution du contrat", "Contract Execution"), pct: "15,0&nbsp;%" },
    { desc: t("Bons de commande pour mat&eacute;riaux majeurs", "Purchase Order Submissions for Major Materials"), pct: "15,0&nbsp;%" },
    { desc: t("Dossier de conception, permis de construire et soumission Hydro-Qu&eacute;bec", "Design Package, Building Permit &amp; Hydro-Qu&eacute;bec Submission"), pct: "10,0&nbsp;%" },
    { desc: t("Mobilisation et livraison des mat&eacute;riaux sur site", "Mobilization &amp; Material Deliveries to Site"), pct: "10,0&nbsp;%" },
    { desc: t("50&nbsp;% de l'installation compl&eacute;t&eacute;e", "50% Installation Complete"), pct: "25,0&nbsp;%" },
    { desc: t("M&eacute;caniquement complet et pr&ecirc;t pour inspection RBQ (paiement final*)", "Mechanically Complete &amp; RBQ Inspection Ready (Final Payment*)"), pct: "25,0&nbsp;%" },
  ];

  const assumptions = [
    t("Isolation standard en caoutchouc recycl&eacute; pour le racking incluse", "Standard recycled rubber racking isolation included with loose-laid slipsheets"),
    t("Frais d'&eacute;tude d'impact et de raccordement Hydro-Qu&eacute;bec inclus (sujets &agrave; modification par Hydro-Qu&eacute;bec)", "Hydro-Qu&eacute;bec connection impact study and interconnection fees included (fees subject to change by Hydro-Qu&eacute;bec)"),
    t("Frais de permis de construire inclus", "Building permit fees included"),
    t("Garanties standard des fabricants incluses (sauf indication contraire)", "Standard manufacturer warranties included (unless otherwise noted)"),
    t("&Eacute;quipement majeur sujet &agrave; changement selon disponibilit&eacute; au moment de l'approvisionnement", "Major equipment subject to change based on commercial availability at time of procurement"),
    t("Salaires courants (requis pour le CII 30&nbsp;%) inclus (sujet &agrave; la l&eacute;gislation finale)", "Prevailing wages (required for 30% ITC) included (subject to final legislation)"),
    t("Am&eacute;liorations du service &eacute;lectrique, renforcement structurel exclus (sauf indication contraire)", "Electrical service upgrades, structural upgrades and/or reinforcement excluded (unless otherwise noted)"),
    t("Primes hivernales, heures suppl&eacute;mentaires incluses", "Winter premiums, overtime and premium time included"),
    t("Cautionnement d'ex&eacute;cution 50&nbsp;% et cautionnement de main-d'&oelig;uvre et mat&eacute;riaux 50&nbsp;% inclus", "50% Performance and 50% Labour &amp; Material Bonds included"),
    t("2&nbsp;% de modules de rechange inclus", "2% spare modules included"),
    t("Droits de douane et surcharges inclus dans le prix", "Tariffs and surcharges are included in price"),
    t("G&eacute;n&eacute;rateurs de secours exclus", "Back-up/temporary generators excluded"),
  ];

  return `
  <div class="page">
    <div class="section-num">6</div>
    <h2>${t("&Eacute;ch&eacute;ancier de Paiement", "Schedule of Values")}</h2>
    <p style="font-size: 9pt; color: var(--gray); margin-bottom: 4mm;">
      ${t(
        "Le Propri&eacute;taire sera factur&eacute; par le Concepteur-Constructeur selon l'&eacute;ch&eacute;ancier de valeurs pr&eacute;sent&eacute; ci-dessous en pourcentage du Prix du Contrat. Les paiements sont exigibles dans les 30 jours suivant la facturation.",
        "The Owner will be invoiced by the Design-Builder against the Schedule of Values presented below as a percentage of the Contract Price. Payments will become due within 30 days of invoice."
      )}
    </p>
    <table class="sov-table">
      <thead><tr><th>${t("Jalon", "Milestone")}</th><th style="text-align:right">%</th></tr></thead>
      <tbody>
        ${milestones.map(m => `<tr><td>${m.desc}</td><td class="sov-pct">${m.pct}</td></tr>`).join("")}
        <tr class="total-row"><td>Total</td><td class="sov-pct">100,0&nbsp;%</td></tr>
      </tbody>
    </table>
    <p style="font-size: 8pt; color: var(--gray); margin-top: 2mm; line-height: 1.5;">
      *${t(
        "Requis pour le paiement final : (a) D&eacute;claration confirmant qu'aucun avis d'hypoth&egrave;que l&eacute;gale n'a &eacute;t&eacute; re&ccedil;u; (b) D&eacute;claration confirmant que tous les comptes ont &eacute;t&eacute; pay&eacute;s, sauf les retenues l&eacute;gitimes.",
        "Required for Final Payment: (a) Declaration confirming no written notices of legal hypothec have been received; (b) Declaration confirming all accounts for labour, subcontracts, products and services have been paid in full, except for lawfully retained holdbacks."
      )}
    </p>
    <h3 style="margin-top: 6mm;">${t("Hypoth&egrave;ses de Prix", "Pricing Assumptions")}</h3>
    <ul class="assumptions-list">
      ${assumptions.map(a => `<li>${a}</li>`).join("")}
    </ul>
    ${footerHtml(t, dateStr, pageNum)}
  </div>`;
}

function buildAnnexPage(site: MasterAgreementSiteData, siteIndex: number, totalSitesWithFm: number, t: (fr: string, en: string) => string, dateStr: string, pageNum: number): string {
  const fm = site.financialModel!;

  function badge(type: "kwh" | "dream" | "computed"): string {
    const labels = { kwh: "kWh", dream: "Dream", computed: "Result" };
    return `<span class="badge badge-${type}">${labels[type]}</span>`;
  }

  function row(label: string, value: string, resp: "kwh" | "dream" | "computed"): string {
    return `<div class="annex-row">
      <div class="annex-row-label">${label}</div>
      <div class="annex-row-value">${value}</div>
      <div style="margin-left: 3mm;">${badge(resp)}</div>
    </div>`;
  }

  const specsHtml = `
    <div class="annex-box">
      <div class="annex-box-header">${t("Sp&eacute;cifications", "Specifications")}</div>
      <div class="annex-box-body">
        ${row(t("Taille DC (kW)", "DC Size (kW)"), `${fmt(fm.projectSpecs.projectSizeDcKw)}&nbsp;kW`, "kwh")}
        ${row(t("Taille AC (kW)", "AC Size (kW)"), `${fmt(fm.projectSpecs.projectSizeAcKw)}&nbsp;kW`, "kwh")}
        ${row(t("Rendement (kWh/kWp)", "Yield (kWh/kWp)"), `${fmt(fm.projectSpecs.yieldKwhPerKwp)}`, "kwh")}
        ${row(t("Prod. an 1", "1st Year Production"), `${fmt(fm.projectSpecs.firstYearKwh)}&nbsp;kWh`, "kwh")}
        ${row(t("D&eacute;gradation annuelle", "Annual Degradation"), pct(fm.projectSpecs.degradationPct), "kwh")}
        ${row(t("Hypoth&egrave;se de disponibilit&eacute;", "Availability Assumption"), pct(fm.projectSpecs.availabilityPct), "kwh")}
        ${row(t("Dur&eacute;e de vie utile", "Useful Life"), `${fm.projectSpecs.usefulLifeYears || "&mdash;"}&nbsp;${t("ans", "yrs")}`, "kwh")}
      </div>
    </div>`;

  const costsHtml = `
    <div class="annex-box">
      <div class="annex-box-header">${t("Co&ucirc;ts", "Costs")}</div>
      <div class="annex-box-body">
        ${row(t("Co&ucirc;t install. ($/W)", "Install Cost ($/W)"), `${fm.projectCosts.installCostPerW?.toFixed(2) || "&mdash;"}&nbsp;$/W`, "kwh")}
        ${row(t("Co&ucirc;ts de construction", "Construction Costs"), cur(fm.projectCosts.constructionCosts), "kwh")}
        ${row(t("Frais municipaux", "Municipal Fees"), cur(fm.projectCosts.municipalFees), "dream")}
        ${row(t("Interconnexion (HQ)", "Interconnection (HQ)"), cur(fm.projectCosts.interconnectionCost), "dream")}
        ${row(t("Co&ucirc;t total du projet", "Total Project Cost"), cur(fm.projectCosts.totalProjectCost), "computed")}
      </div>
    </div>`;

  const opsHtml = `
    <div class="annex-box">
      <div class="annex-box-header">${t("Exploitation", "Operations")}</div>
      <div class="annex-box-body">
        ${row(t("O&amp;M ($/kW)", "O&amp;M ($/kW)"), `${fm.operatingCosts.omRatePerKw?.toFixed(2) || "&mdash;"}&nbsp;$/W`, "kwh")}
        ${row(t("Co&ucirc;t O&amp;M", "O&amp;M Cost"), cur(fm.operatingCosts.omCost), "kwh")}
        ${row(t("Total op&eacute;rations an 1", "Total Operations Yr 1"), cur(fm.operatingCosts.totalOperationsCostYr1), "computed")}
        ${row(t("Inflation", "Inflation"), pct(fm.operatingCosts.inflationRate), "kwh")}
      </div>
    </div>`;

  const itcHtml = `
    <div class="annex-box">
      <div class="annex-box-header">${t("CII", "ITC")}</div>
      <div class="annex-box-body">
        ${row(t("&Eacute;ligibilit&eacute; CII", "ITC Eligible"), fm.itc.itcEligible ? t("Oui", "Yes") : t("Non", "No"), "kwh")}
        ${row(t("Taux CII", "ITC Rate"), pct(fm.itc.itcRate), "kwh")}
        ${row(t("Rabais CII effectif", "Effective ITC Rebate"), cur(fm.itc.effectiveItcRebate), "computed")}
      </div>
    </div>`;

  const equipData = fm.equipment;
  let equipHtml = "";
  if (equipData && (equipData.modules || equipData.racking || equipData.inverters || equipData.monitoring)) {
    const eqRows: string[] = [];
    if (equipData.racking) {
      eqRows.push(`<tr><td style="font-weight:600">${t("Racking", "Racking")}</td><td>${equipData.racking.manufacturer}</td><td>${equipData.racking.model}</td><td style="text-align:right">${equipData.racking.units}</td></tr>`);
    }
    if (equipData.modules) {
      eqRows.push(`<tr><td style="font-weight:600">${t("Modules", "Modules")}</td><td>${equipData.modules.manufacturer}</td><td>${equipData.modules.model}</td><td style="text-align:right">${equipData.modules.units}</td></tr>`);
    }
    if (equipData.inverters) {
      eqRows.push(`<tr><td style="font-weight:600">${t("Onduleur(s)", "Inverter(s)")}</td><td>${equipData.inverters.manufacturer}</td><td>${equipData.inverters.model}</td><td style="text-align:right">${equipData.inverters.units}</td></tr>`);
    }
    if (equipData.monitoring) {
      eqRows.push(`<tr><td style="font-weight:600">${t("Surveillance", "Monitoring")}</td><td>${equipData.monitoring.manufacturer}</td><td>${equipData.monitoring.model}</td><td style="text-align:right">&mdash;</td></tr>`);
    }
    equipHtml = `
    <div style="grid-column: 1 / -1; margin-top: 3mm;">
      <table class="equip-table">
        <thead><tr>
          <th>${t("&Eacute;quipement", "Equipment")}</th>
          <th>${t("Fabricant", "Manufacturer")}</th>
          <th>${t("Mod&egrave;le", "Model")}</th>
          <th style="text-align:right">${t("Qt&eacute;", "Qty")}</th>
        </tr></thead>
        <tbody>${eqRows.join("")}</tbody>
      </table>
      <p style="font-size: 7.5pt; color: var(--gray); margin-top: 1mm; font-style: italic;">
        ${t("&Eacute;quipement majeur sujet &agrave; changement selon disponibilit&eacute; au moment de l'approvisionnement.", "Major equipment subject to change based on commercial availability at time of procurement.")}
      </p>
    </div>`;
  }

  const addr = site.address ? `${site.address}${site.city ? `, ${site.city}` : ""}` : "";

  return `
  <div class="page">
    <div class="annex-header">
      <div style="font-size: 9pt; color: var(--gray); margin-bottom: 2mm;">
        ${t(`Annexe A &mdash; Fiche ${siteIndex + 1}/${totalSitesWithFm}`, `Annex A &mdash; Schedule ${siteIndex + 1}/${totalSitesWithFm}`)}
      </div>
      <div class="annex-site-name">${site.siteName}</div>
      ${addr ? `<div class="annex-address">${addr}</div>` : ""}
    </div>
    <div class="annex-grid">
      ${specsHtml}
      ${costsHtml}
      ${opsHtml}
      ${itcHtml}
      ${equipHtml}
    </div>
    ${footerHtml(t, dateStr, pageNum)}
  </div>`;
}

function buildSupplementaryConditionsPages(t: (fr: string, en: string) => string, dateStr: string, startPage: number): string[] {
  const pages: string[] = [];

  const conditions1 = [
    {
      ref: "CCDC 14, Art. A-3",
      title: t("Documents contractuels &mdash; Ordre de priorit&eacute;", "Contract Documents &mdash; Order of Priority"),
      text: t(
        "En cas de conflit ou d'incompatibilit&eacute; entre les documents contractuels, ils seront interpr&eacute;t&eacute;s dans l'ordre indiqu&eacute;, du plus prioritaire au moins prioritaire, les Conditions suppl&eacute;mentaires ayant priorit&eacute; sur tous les autres documents.",
        "In the event of any conflict or inconsistency between the Contract Documents, they shall be interpreted in the order listed, from highest priority to lowest, subject to the Supplementary Conditions having priority over all other documents."
      ),
    },
    {
      ref: "CCDC 14, Art. A-4",
      title: t("Prix du contrat &mdash; Exhaustivit&eacute;", "Contract Price &mdash; Completeness"),
      text: t(
        "Le Prix du Contrat constitue le prix complet pour les Travaux et inclut toutes les provisions que le Concepteur-Constructeur estime n&eacute;cessaires pour compl&eacute;ter les Services de conception et les Travaux, incluant conception, construction, main-d'&oelig;uvre, produits et &eacute;quipements.",
        "The Contract Price shall be the complete price for the Work and includes all contingency and other amounts that the Design-Builder believes are necessary to complete the Design Services and the Work, including design, construction, labour, products and equipment."
      ),
    },
    {
      ref: "CG 1.5",
      title: t("Confidentialit&eacute;", "Confidentiality"),
      text: t(
        "Le Concepteur-Constructeur ne divulguera aucune information confidentielle sauf pour l'ex&eacute;cution de ses obligations. L'information confidentielle ne sera utilis&eacute;e pour aucun autre projet sans l'approbation &eacute;crite pr&eacute;alable du Propri&eacute;taire. Cet engagement de confidentialit&eacute; survivra &agrave; la r&eacute;siliation du Contrat pour une p&eacute;riode de cinq (5) ans.",
        "The Design-Builder shall not divulge any confidential information except as required to carry out its obligations. No confidential information shall be used on any other project without the prior written approval of the Owner. This confidentiality covenant shall survive the termination of the Contract for a period of five (5) years."
      ),
    },
    {
      ref: "CG 1.6",
      title: t("Examen des lieux de travail", "Examination of Place of the Work"),
      text: t(
        "Le Concepteur-Constructeur d&eacute;clare avoir examin&eacute; les Lieux de Travail et s'&ecirc;tre satisfait de la port&eacute;e et de la nature des Travaux. En cons&eacute;quence, le Concepteur-Constructeur assume tous les risques de conditions existantes ou survenant durant les Travaux qu'un professionnel diligent aurait raisonnablement d&eacute;couverts lors de l'inspection.",
        "The Design-Builder represents and warrants that it has examined the Place of the Work and has satisfied itself as to the scope and character of the Work. As a result, the Design-Builder assumes all risk of conditions now existing or arising in the course of the Work that a prudent professional would have reasonably discovered during the site inspection."
      ),
    },
    {
      ref: "CG 3.7.3",
      title: t("Personnel cl&eacute;", "Key Personnel"),
      text: t(
        "Le Concepteur-Constructeur s'engage &agrave; affecter du personnel exp&eacute;riment&eacute; et qualifi&eacute; au Projet. Le Personnel cl&eacute; ne peut &ecirc;tre remplac&eacute; sans l'acceptation &eacute;crite pr&eacute;alable du Propri&eacute;taire. En cas d'indisponibilit&eacute; sans remplacement acceptable dans les dix (10) jours ouvrables, le Propri&eacute;taire peut r&eacute;silier le Contrat.",
        "The Design-Builder agrees to commit experienced and qualified personnel to the Project. Key Personnel may not be changed without the Owner's prior written acceptance. If Key Personnel is unavailable and a replacement has not been provided within ten (10) Working Days, the Owner may terminate the Contract."
      ),
    },
    {
      ref: "CG 5.2",
      title: t("Demandes de paiement progressif", "Applications for Progress Payment"),
      text: t(
        "Les factures conformes seront soumises mensuellement selon l'&Eacute;ch&eacute;ancier de Valeurs (Section 6). Chaque facture inclura : ventilation des travaux, d&eacute;clarations de paiement des sous-traitants, certificats CNESST, pourcentage d'avancement et pi&egrave;ces justificatives.",
        "Proper Invoices shall be submitted monthly based on the Schedule of Values (Section 6). Each invoice shall include: breakdown of work performed, subcontractor payment declarations, CNESST clearance certificates, percentage of completion, and supporting documentation."
      ),
    },
    {
      ref: "Art. 2726-2728 CCQ",
      title: t("Retenue &mdash; Hypoth&egrave;ques l&eacute;gales", "Holdback &mdash; Legal Hypothecs"),
      text: t(
        "Conform&eacute;ment aux articles 2726 &agrave; 2728 du Code civil du Qu&eacute;bec, une retenue de dix pour cent (10&nbsp;%) sera appliqu&eacute;e sur chaque paiement progressif. La retenue sera lib&eacute;r&eacute;e trente (30) jours apr&egrave;s l'expiration du d&eacute;lai de publication des hypoth&egrave;ques l&eacute;gales, sous r&eacute;serve qu'aucune hypoth&egrave;que n'ait &eacute;t&eacute; inscrite.",
        "In accordance with Articles 2726 to 2728 of the Civil Code of Qu&eacute;bec, a holdback of ten percent (10%) shall be applied on each progress payment. The holdback shall be released thirty (30) days after the expiry of the legal hypothec registration period, provided no legal hypothec has been registered."
      ),
    },
  ];

  const conditions2 = [
    {
      ref: "CG 12.5",
      title: t("Garanties", "Warranties"),
      text: t(
        "Panneaux : garantie de performance lin&eacute;aire de 25 ans. Onduleurs : 15 ans (extensible &agrave; 25). Main-d'&oelig;uvre : 10 ans. Le paiement final sera assujetti &agrave; une retenue de cinquante mille dollars (50&nbsp;000&nbsp;$) jusqu'&agrave; la remise des plans tel que construit et du manuel O&amp;M.",
        "Panels: 25-year linear performance warranty. Inverters: 15 years (extendable to 25). Workmanship: 10 years. The final payment shall be subject to a holdback of fifty thousand dollars ($50,000) until as-built drawings and O&amp;M manual have been provided."
      ),
    },
    {
      ref: "CG 11.1",
      title: t("Assurance", "Insurance"),
      text: t(
        "Le Concepteur-Constructeur maintiendra : (a) assurance tous risques construction pour la valeur compl&egrave;te des Travaux; (b) responsabilit&eacute; civile g&eacute;n&eacute;rale minimum de 5&nbsp;000&nbsp;000&nbsp;$; (c) assurance responsabilit&eacute; professionnelle. Les polices nommeront le Propri&eacute;taire comme assur&eacute; additionnel.",
        "The Design-Builder shall maintain: (a) all-risk construction insurance for the full value of the Work; (b) commercial general liability insurance minimum $5,000,000; (c) professional liability insurance. Policies shall name the Owner as additional insured."
      ),
    },
    {
      ref: "CG 6.5",
      title: t("D&eacute;lais et force majeure", "Delays and Force Majeure"),
      text: t(
        "Le temps est de l'essence. Le Concepteur-Constructeur renonce &agrave; toute r&eacute;clamation pour d&eacute;lais caus&eacute;s par ses propres actes ou omissions. En cas de retard imputable au Concepteur-Constructeur, celui-ci prendra les mesures correctives n&eacute;cessaires &agrave; ses frais. Aucune des parties ne sera tenue responsable des retards r&eacute;sultant de circonstances hors de son contr&ocirc;le raisonnable (force majeure).",
        "Time is of the essence. The Design-Builder waives any claim for delays caused by its own actions or omissions. In case of Design-Builder caused delay, the Design-Builder shall take corrective actions at its own cost. Neither party shall be held liable for delays resulting from circumstances beyond its reasonable control (force majeure)."
      ),
    },
    {
      ref: "CG 7.2",
      title: t("R&eacute;siliation", "Termination"),
      text: t(
        "Le Propri&eacute;taire peut r&eacute;silier le Contrat pour cause (manquement mat&eacute;riel non rem&eacute;di&eacute; dans les 60 jours) ou pour convenance moyennant un pr&eacute;avis &eacute;crit de 90 jours. En cas de r&eacute;siliation pour convenance, le Concepteur-Constructeur sera indemnis&eacute; pour les Travaux ex&eacute;cut&eacute;s et les co&ucirc;ts de d&eacute;mobilisation raisonnables.",
        "The Owner may terminate the Contract for cause (material breach not remedied within 60 days) or for convenience with 90 days' written notice. In case of termination for convenience, the Design-Builder shall be compensated for Work performed and reasonable demobilization costs."
      ),
    },
    {
      ref: "CG 1.4",
      title: t("Cession", "Assignment"),
      text: t(
        "Le Propri&eacute;taire peut c&eacute;der le Contrat sans le consentement du Concepteur-Constructeur &agrave; toute filiale, soci&eacute;t&eacute; affili&eacute;e ou Pr&ecirc;teur en garantie de financement. Aucune autre cession ne sera permise sans le consentement &eacute;crit de l'autre partie.",
        "The Owner shall have the right, without the consent of the Design-Builder, to assign the Contract to any affiliate, subsidiary or Lender as collateral security for loans. No other assignment shall be permitted without the written consent of the other party."
      ),
    },
    {
      ref: "LSST / CNESST",
      title: t("Sant&eacute; et s&eacute;curit&eacute;", "Health &amp; Safety"),
      text: t(
        "Le Concepteur-Constructeur agira &agrave; titre de ma&icirc;tre d'&oelig;uvre au sens de la LSST (Loi sur la sant&eacute; et la s&eacute;curit&eacute; du travail, RLRQ c. S-2.1). Il sera responsable de la conformit&eacute; aux exigences de la CNESST, incluant le programme de pr&eacute;vention et la d&eacute;claration d'ouverture de chantier.",
        "The Design-Builder shall act as ma&icirc;tre d'&oelig;uvre (constructor) as defined by the LSST (Act respecting occupational health and safety, RLRQ c. S-2.1). The Design-Builder shall be responsible for compliance with CNESST requirements, including the prevention program and worksite opening declaration."
      ),
    },
    {
      ref: "CG 8.1",
      title: t("R&egrave;glement des diff&eacute;rends", "Dispute Resolution"),
      text: t(
        "Tout diff&eacute;rend sera d'abord soumis &agrave; la m&eacute;diation. Si la m&eacute;diation &eacute;choue dans les 30 jours, le diff&eacute;rend sera soumis &agrave; l'arbitrage conform&eacute;ment au Code de proc&eacute;dure civile du Qu&eacute;bec. Le si&egrave;ge de l'arbitrage sera Montr&eacute;al.",
        "Any dispute shall first be submitted to mediation. If mediation fails within 30 days, the dispute shall be submitted to arbitration in accordance with the Code of Civil Procedure of Qu&eacute;bec. The seat of arbitration shall be Montr&eacute;al."
      ),
    },
    {
      ref: "Art. A-9",
      title: t("Validit&eacute; de l'offre", "Offer Validity"),
      text: t(
        "Cette offre est valide pour une p&eacute;riode de quatre-vingt-dix (90) jours &agrave; compter de la date du document. Tous les montants sont en dollars canadiens.",
        "This offer is valid for a period of ninety (90) days from the document date. All dollar amounts are in Canadian currency."
      ),
    },
    {
      ref: "Art. A-9",
      title: t("Conditions pr&eacute;alables", "Conditions Precedent"),
      text: t(
        "L'ex&eacute;cution des travaux est assujettie &agrave; : (a) l'obtention des permis municipaux et de la RBQ; (b) l'approbation de raccordement d'Hydro-Qu&eacute;bec; (c) la confirmation de l'int&eacute;grit&eacute; structurelle du toit par un ing&eacute;nieur (OIQ).",
        "Execution of work is subject to: (a) obtaining municipal permits and RBQ approvals; (b) Hydro-Qu&eacute;bec interconnection approval; (c) confirmation of roof structural integrity by a licensed engineer (OIQ)."
      ),
    },
    {
      ref: "Art. A-9",
      title: t("Droit applicable", "Governing Law"),
      text: t(
        "Cette entente est r&eacute;gie par les lois de la Province de Qu&eacute;bec et du Canada, incluant le Code civil du Qu&eacute;bec. Tout diff&eacute;rend non r&eacute;solu par m&eacute;diation ou arbitrage sera soumis aux tribunaux de Montr&eacute;al.",
        "This agreement is governed by the laws of the Province of Qu&eacute;bec and Canada, including the Civil Code of Qu&eacute;bec. Any dispute not resolved by mediation or arbitration shall be submitted to the courts of Montr&eacute;al."
      ),
    },
  ];

  pages.push(`
  <div class="page">
    <div class="section-num">8</div>
    <h2>${t("Conditions Suppl&eacute;mentaires au CCDC&nbsp;14 (2013)", "Supplementary Conditions to CCDC&nbsp;14 (2013)")}</h2>
    <p style="font-size: 9pt; color: var(--gray); margin-bottom: 4mm;">
      ${t(
        "Les pr&eacute;sentes Conditions suppl&eacute;mentaires modifient, suppl&eacute;mentent ou remplacent les dispositions de l'Entente entre le Propri&eacute;taire et le Concepteur-Constructeur, ainsi que les Conditions g&eacute;n&eacute;rales du Contrat &agrave; forfait de conception-construction CCDC&nbsp;14 &mdash; 2013. Les dispositions non modifi&eacute;es demeurent en vigueur.",
        "These Supplementary Conditions shall modify, supplement or replace provisions of the Agreement between the Owner and the Design-Builder, and the General Conditions of the Design-Build Stipulated Price Contract, CCDC&nbsp;14 &mdash; 2013. Provisions not modified shall remain in effect."
      )}
    </p>
    ${conditions1.map(c => `
      <div class="sc-article">
        <div class="sc-ref">${c.ref}</div>
        <div class="sc-title">${c.title}</div>
        <div class="sc-text">${c.text}</div>
      </div>
    `).join("")}
    ${footerHtml(t, dateStr, startPage)}
  </div>`);

  pages.push(`
  <div class="page">
    ${conditions2.map(c => `
      <div class="sc-article">
        <div class="sc-ref">${c.ref}</div>
        <div class="sc-title">${c.title}</div>
        <div class="sc-text">${c.text}</div>
      </div>
    `).join("")}
    ${footerHtml(t, dateStr, startPage + 1)}
  </div>`);

  return pages;
}

function buildSignaturesPage(t: (fr: string, en: string) => string, dateStr: string, pageNum: number): string {
  return `
  <div class="page">
    <div class="section-num">9</div>
    <h2>${t("Signatures", "Signatures")}</h2>
    <p style="font-size: 10pt; color: var(--gray); margin-bottom: 8mm;">
      ${t(
        "EN FOI DE QUOI, les parties ont sign&eacute; cette entente cadre &agrave; la date indiqu&eacute;e ci-dessous, conform&eacute;ment au contrat &agrave; forfait de conception-construction CCDC&nbsp;14 (2013).",
        "IN WITNESS WHEREOF, the parties have signed this master agreement on the date indicated below, in accordance with the Design-Build Stipulated Price Contract CCDC&nbsp;14 (2013)."
      )}
    </p>
    <div class="sig-grid">
      <div class="sig-block">
        <div class="sig-org">Dream Industrial REIT</div>
        <div class="sig-line"></div><div class="sig-label">${t("Nom", "Name")}</div>
        <div class="sig-line"></div><div class="sig-label">${t("Titre", "Title")}</div>
        <div class="sig-line"></div><div class="sig-label">Date</div>
      </div>
      <div class="sig-block">
        <div class="sig-org">kWh Qu&eacute;bec</div>
        <div class="sig-line"></div><div class="sig-label">${t("Nom", "Name")}</div>
        <div class="sig-line"></div><div class="sig-label">${t("Titre", "Title")}</div>
        <div class="sig-line"></div><div class="sig-label">Date</div>
      </div>
    </div>
    <div class="sig-disclaimer">
      ${t(
        "Ce document constitue une offre formelle et non un contrat contraignant. L'entente d&eacute;finitive sera formalis&eacute;e par la signature des deux parties du contrat d&eacute;finitif incluant toutes les annexes par site, conform&eacute;ment au CCDC&nbsp;14.",
        "This document constitutes a formal offer and not a binding contract. The final agreement will be formalized by both parties signing the definitive contract including all per-site annexes, in accordance with CCDC&nbsp;14."
      )}
    </div>
    ${footerHtml(t, dateStr, pageNum)}
  </div>`;
}

export async function generateMasterAgreementPDFBuffer(
  data: MasterAgreementData,
  lang: "fr" | "en" = "fr"
): Promise<Buffer> {
  const t = (fr: string, en: string) => (lang === "fr" ? fr : en);
  const dateStr = new Date().toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA", {
    year: "numeric", month: "long", day: "numeric",
  });

  const logoPath = path.join(process.cwd(), "client", "public", "assets", lang === "fr" ? "logo-fr-white.png" : "logo-en-white.png");
  const logoBase64 = loadImageAsBase64(logoPath);

  let pageNum = 0;
  const pages: string[] = [];

  pages.push(buildCoverPage(data, t, dateStr, logoBase64));

  pageNum = 1;
  pages.push(buildTocPage(t, dateStr));

  pageNum = 2;
  pages.push(buildExecutiveSummaryPage(data, t, dateStr));

  pageNum = 3;
  pages.push(buildPartiesPage(t, dateStr));

  pageNum = 4;
  pages.push(buildCommercialTermsPage(t, dateStr));

  pageNum = 5;
  pages.push(buildFinancialFrameworkPage(data, t, dateStr));

  pageNum = 6;
  const scopePages = buildScopeOfWorkPages(t, dateStr, pageNum);
  pages.push(...scopePages);
  pageNum += scopePages.length;

  pages.push(buildScheduleOfValuesPage(t, dateStr, pageNum));
  pageNum++;

  const sitesWithFm = data.sites.filter(s => !!s.financialModel);
  sitesWithFm.forEach((site, idx) => {
    pages.push(buildAnnexPage(site, idx, sitesWithFm.length, t, dateStr, pageNum));
    pageNum++;
  });

  const scPages = buildSupplementaryConditionsPages(t, dateStr, pageNum);
  pages.push(...scPages);
  pageNum += scPages.length;

  pages.push(buildSignaturesPage(t, dateStr, pageNum));

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${t("Entente Cadre", "Master Agreement")} - ${data.clientName}</title>
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
    log.error("Failed to launch browser for PDF generation", err);
    throw new Error("PDF generation failed: Could not launch browser");
  }

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 60000 });
    const pdfBuffer = await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

export { generateMasterAgreementPDFBuffer as generateMasterAgreementPDF };
