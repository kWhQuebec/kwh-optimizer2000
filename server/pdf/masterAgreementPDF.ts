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
.scope-table tr { page-break-inside: avoid; break-inside: avoid; }
.scope-table tr:nth-child(even) { background: var(--light-gray); }
.scope-table .scope-cat { font-weight: 600; color: var(--primary); white-space: nowrap; min-width: 40mm; }

.sov-table { width: 100%; border-collapse: collapse; margin: 5mm 0; font-size: 9.5pt; }
.sov-table th { background: var(--primary); color: white; padding: 3mm 5mm; text-align: left; font-weight: 600; }
.sov-table td { padding: 3mm 5mm; border-bottom: 1px solid #e5e7eb; }
.sov-table tr { page-break-inside: avoid; break-inside: avoid; }
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

.sc-article { margin-bottom: 4mm; padding: 3mm 4mm; border-left: 3px solid var(--primary); background: var(--light-gray); border-radius: 0 3mm 3mm 0; page-break-inside: avoid; break-inside: avoid; }
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
    {
      cat: t("Traitement fiscal / DPA", "Tax Treatment / CCA"),
      desc: t(
        "Pr&eacute;parer et maintenir toute la documentation requise pour la d&eacute;duction pour amortissement (DPA) de cat&eacute;gorie&nbsp;43.1/43.2 et le cr&eacute;dit d'imp&ocirc;t &agrave; l'investissement (CII). Fournir au Concepteur-Constructeur les renseignements fiscaux n&eacute;cessaires dans les d&eacute;lais prescrits.",
        "Prepare and maintain all documentation required for Capital Cost Allowance (CCA) Class&nbsp;43.1/43.2 and the Investment Tax Credit (ITC). Provide the Design-Builder with required tax information within prescribed timelines."
      ),
    },
    {
      cat: t("Assurance du Propri&eacute;taire", "Owner's Insurance"),
      desc: t(
        "Maintenir une assurance de biens couvrant le b&acirc;timent et son contenu pendant les travaux. Fournir la preuve d'assurance responsabilit&eacute; civile g&eacute;n&eacute;rale d'un minimum de 5&nbsp;000&nbsp;000&nbsp;$ nommant le Concepteur-Constructeur comme assur&eacute; additionnel pour la dur&eacute;e des travaux.",
        "Maintain property insurance covering the building and its contents during construction. Provide proof of commercial general liability insurance of at least $5,000,000 naming the Design-Builder as additional insured for the duration of the Work."
      ),
    },
    {
      cat: t("Rem&eacute;diation structurelle", "Structural Remediation"),
      desc: t(
        "Assumer tous les co&ucirc;ts de renforcement structurel, remplacement de pontage ou r&eacute;paration de membrane identifi&eacute;s dans le rapport de l'ing&eacute;nieur en structure comme conditions pr&eacute;alables &agrave; l'installation solaire. Compl&eacute;ter ces travaux avant la mobilisation du Concepteur-Constructeur.",
        "Assume all costs for structural reinforcement, deck replacement or membrane repair identified in the structural engineer's report as prerequisites for the solar installation. Complete such work prior to the Design-Builder's mobilization."
      ),
    },
    {
      cat: t("D&eacute;neigement et entretien du toit", "Snow Removal &amp; Rooftop Maintenance"),
      desc: t(
        "Assurer le d&eacute;neigement r&eacute;gulier du toit et l'entretien g&eacute;n&eacute;ral de la toiture conform&eacute;ment aux recommandations du fabricant de la membrane. Toute accumulation excessive de neige endommageant le syst&egrave;me solaire en raison d'un d&eacute;faut de d&eacute;neigement sera sous la responsabilit&eacute; du Propri&eacute;taire.",
        "Provide regular rooftop snow removal and general roof maintenance in accordance with the membrane manufacturer's recommendations. Any excessive snow accumulation damaging the solar system due to failure to clear snow shall be the Owner's responsibility."
      ),
    },
    {
      cat: t("Acc&egrave;s et stationnement", "Site Access &amp; Parking"),
      desc: t(
        "Fournir un acc&egrave;s ad&eacute;quat au site pour les v&eacute;hicules de construction, les grues et les livraisons de mat&eacute;riaux. D&eacute;signer des zones de stationnement et d'entreposage temporaire. Assurer l'acc&egrave;s au toit par un moyen s&eacute;curitaire (trappe, &eacute;chelle permanente ou monte-charge).",
        "Provide adequate site access for construction vehicles, cranes and material deliveries. Designate temporary parking and staging areas. Ensure roof access via a safe means (hatch, permanent ladder or freight elevator)."
      ),
    },
    {
      cat: t("Communication locataires", "Tenant Communication"),
      desc: t(
        "Informer tous les locataires des perturbations potentielles li&eacute;es aux travaux (bruit, vibrations, coupures temporaires d'&eacute;lectricit&eacute;) au moins dix (10) jours ouvrables avant la mobilisation. Coordonner avec le Concepteur-Constructeur pour minimiser l'impact sur les op&eacute;rations des locataires.",
        "Notify all tenants of potential construction-related disruptions (noise, vibrations, temporary power outages) at least ten (10) business days prior to mobilization. Coordinate with the Design-Builder to minimize impact on tenant operations."
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
    {
      cat: t("Conformit&eacute; environnementale", "Environmental Compliance"),
      desc: t(
        "Fournir un plan de gestion environnementale couvrant le confinement des d&eacute;versements, la protection des sols et la gestion des eaux de ruissellement durant la construction. Fournir des bacs de r&eacute;tention pour tous les &eacute;quipements hydrauliques sur le toit. Se conformer &agrave; toutes les r&eacute;glementations environnementales provinciales et municipales applicables.",
        "Provide an environmental management plan covering spill containment, soil protection and stormwater runoff management during construction. Provide drip trays for all hydraulic equipment on the roof. Comply with all applicable provincial and municipal environmental regulations."
      ),
    },
    {
      cat: t("Plans de grue et gréage", "Crane &amp; Rigging Plans"),
      desc: t(
        "Pr&eacute;parer et soumettre les plans de levage et de gr&eacute;age pour approbation par le Propri&eacute;taire avant toute op&eacute;ration de grue. Les plans incluront : capacit&eacute; de la grue, rayon d'op&eacute;ration, conditions de sol, zones d'exclusion, protections contre le renversement et certificats d'inspection valides.",
        "Prepare and submit crane lift and rigging plans for Owner approval prior to any crane operations. Plans shall include: crane capacity, operating radius, ground conditions, exclusion zones, tip-over protections and valid inspection certificates."
      ),
    },
    {
      cat: t("Installations temporaires", "Temporary Facilities"),
      desc: t(
        "Fournir toutes les installations temporaires requises : roulottes de chantier, toilettes chimiques, bennes &agrave; d&eacute;chets, cl&ocirc;tures de s&eacute;curit&eacute;, &eacute;clairage temporaire et alimentation &eacute;lectrique temporaire. Retirer toutes les installations temporaires &agrave; la fin des travaux.",
        "Provide all required temporary facilities: site trailers, portable toilets, waste bins, security fencing, temporary lighting and temporary power. Remove all temporary facilities upon completion of the Work."
      ),
    },
    {
      cat: t("Station m&eacute;t&eacute;orologique", "Weather Station"),
      desc: t(
        "Installer une station m&eacute;t&eacute;orologique sur chaque site comprenant : capteur d'irradiance dans le plan des modules (POA), capteur d'irradiance horizontale (GHI), capteur de temp&eacute;rature ambiante et capteur de temp&eacute;rature de module. Les donn&eacute;es seront int&eacute;gr&eacute;es au syst&egrave;me de surveillance.",
        "Install a weather station at each site comprising: plane-of-array (POA) irradiance sensor, global horizontal irradiance (GHI) sensor, ambient temperature sensor and module temperature sensor. Data shall be integrated into the monitoring system."
      ),
    },
    {
      cat: t("Surveillance par cha&icirc;ne", "String-Level Monitoring"),
      desc: t(
        "Fournir et installer un syst&egrave;me de surveillance au niveau de la cha&icirc;ne (string-level) permettant la d&eacute;tection rapide des d&eacute;faillances de modules individuels, des probl&egrave;mes de c&acirc;blage et des ombrages partiels. Les donn&eacute;es seront accessibles via le portail de surveillance en ligne.",
        "Supply and install a string-level monitoring system enabling rapid detection of individual module failures, wiring issues and partial shading. Data shall be accessible via the online monitoring portal."
      ),
    },
    {
      cat: t("Pare-neige et dissuasifs aviaires", "Snow Guards &amp; Bird Deterrents"),
      desc: t(
        "Installer des pare-neige sur les rang&eacute;es de modules situ&eacute;es au-dessus des entr&eacute;es de b&acirc;timent, des zones de circulation pi&eacute;tonni&egrave;re et des quais de chargement. Installer des filets ou grillages de protection aviaire sous les modules pour pr&eacute;venir la nidification.",
        "Install snow guards on module rows located above building entrances, pedestrian walkways and loading docks. Install bird netting or wire mesh under modules to prevent nesting."
      ),
    },
    {
      cat: t("D&eacute;tection d'arc &eacute;lectrique", "Arc Fault Detection"),
      desc: t(
        "Fournir et installer des dispositifs de d&eacute;tection d'arc &eacute;lectrique (AFCI) conform&eacute;ment au Code de construction du Qu&eacute;bec et &agrave; la norme CSA&nbsp;C22.10. Les dispositifs seront int&eacute;gr&eacute;s au syst&egrave;me de surveillance pour notification en temps r&eacute;el.",
        "Supply and install arc fault circuit interrupter (AFCI) devices in accordance with the Code de construction du Qu&eacute;bec and CSA&nbsp;C22.10. Devices shall be integrated into the monitoring system for real-time notification."
      ),
    },
    {
      cat: t("Arr&ecirc;t rapide", "Rapid Shutdown"),
      desc: t(
        "Concevoir et installer un syst&egrave;me d'arr&ecirc;t rapide (rapid shutdown) conforme aux exigences du Code de construction du Qu&eacute;bec, Chapitre V &mdash; &Eacute;lectricit&eacute;, et &agrave; la norme NEC&nbsp;2020 Section&nbsp;690.12. Le syst&egrave;me r&eacute;duira la tension DC &agrave; 80&nbsp;V ou moins dans les 30&nbsp;secondes suivant l'activation.",
        "Design and install a rapid shutdown system compliant with the Code de construction du Qu&eacute;bec, Chapter V &mdash; Electricity, and NEC&nbsp;2020 Section&nbsp;690.12. The system shall reduce DC voltage to 80&nbsp;V or less within 30&nbsp;seconds of activation."
      ),
    },
    {
      cat: t("Essais de courbe I-V", "IV Curve Testing"),
      desc: t(
        "&Agrave; la mise en service, effectuer des essais de courbe I-V sur 100&nbsp;% des cha&icirc;nes de modules pour v&eacute;rifier la performance &eacute;lectrique et d&eacute;tecter les modules d&eacute;fectueux, les connexions d&eacute;ficientes et les probl&egrave;mes de mismatch. Les r&eacute;sultats seront inclus dans le dossier de mise en service.",
        "At commissioning, perform IV curve testing on 100% of module strings to verify electrical performance and detect defective modules, poor connections and mismatch issues. Results shall be included in the commissioning package."
      ),
    },
    {
      cat: t("Thermographie par drone", "Drone Thermography"),
      desc: t(
        "&Agrave; l'ach&egrave;vement substantiel, r&eacute;aliser une inspection thermographique a&eacute;rienne par drone (infrarouge) de l'ensemble de l'installation pour d&eacute;tecter les cellules chaudes, les connexions d&eacute;ficientes et les d&eacute;fauts de diode bypass. Fournir un rapport avec images annot&eacute;es et recommandations correctives.",
        "At substantial completion, perform an aerial drone thermographic (infrared) inspection of the entire installation to detect hot cells, poor connections and bypass diode failures. Provide a report with annotated images and corrective recommendations."
      ),
    },
    {
      cat: t("Manuel O&amp;M et entretien pr&eacute;ventif", "O&amp;M Manual &amp; Preventive Maintenance"),
      desc: t(
        "Fournir un manuel complet d'exploitation et maintenance (O&amp;M) incluant : calendrier de maintenance pr&eacute;ventive, proc&eacute;dures de remplacement des composants, protocoles de s&eacute;curit&eacute; pour le travail sur les syst&egrave;mes DC, instructions de nettoyage des modules, sch&eacute;mas unifilaires et contacts d'urgence.",
        "Provide a comprehensive Operations &amp; Maintenance (O&amp;M) manual including: preventive maintenance schedule, component replacement procedures, safety protocols for working on DC systems, module cleaning instructions, single-line diagrams and emergency contacts."
      ),
    },
  ];

  const generalProvisions = [
    {
      cat: t("Plan de gestion de la qualit&eacute;", "Quality Management Plan"),
      desc: t(
        "Le Concepteur-Constructeur soumettra un plan de gestion de la qualit&eacute; (PGQ) dans les quinze (15) jours ouvrables suivant l'ex&eacute;cution du contrat. Le PGQ d&eacute;crira les proc&eacute;dures d'inspection, les points d'arr&ecirc;t, les crit&egrave;res d'acceptation et le processus de gestion des non-conformit&eacute;s.",
        "The Design-Builder shall submit a Quality Management Plan (QMP) within fifteen (15) business days of contract execution. The QMP shall describe inspection procedures, hold points, acceptance criteria and the non-conformance management process."
      ),
    },
    {
      cat: t("Gestion des d&eacute;chets", "Waste Management"),
      desc: t(
        "Tous les d&eacute;chets de construction seront collect&eacute;s, tri&eacute;s et &eacute;limin&eacute;s conform&eacute;ment &agrave; la r&eacute;glementation municipale et provinciale. Un taux de d&eacute;tournement des sites d'enfouissement d'au moins 75&nbsp;% sera vis&eacute;. Les emballages de modules et de racking seront recycl&eacute;s. Un rapport de gestion des d&eacute;chets sera fourni &agrave; la cl&ocirc;ture du projet.",
        "All construction waste shall be collected, sorted and disposed of in accordance with municipal and provincial regulations. A landfill diversion rate of at least 75% shall be targeted. Module and racking packaging shall be recycled. A waste management report shall be provided at project close-out."
      ),
    },
    {
      cat: t("Processus d'ordres de changement", "Change Order Process"),
      desc: t(
        "Tout changement &agrave; l'&eacute;tendue, au calendrier ou au prix du contrat doit &ecirc;tre document&eacute; par un ordre de changement &eacute;crit, sign&eacute; par les deux parties avant l'ex&eacute;cution des travaux modifi&eacute;s. L'ordre de changement inclura : description d&eacute;taill&eacute;e, impact sur le co&ucirc;t (ventil&eacute; par main-d'&oelig;uvre, mat&eacute;riaux et &eacute;quipements), impact sur le calendrier et justification.",
        "Any change to the scope, schedule or contract price must be documented via a written change order, signed by both parties before the modified work is performed. The change order shall include: detailed description, cost impact (broken down by labour, materials and equipment), schedule impact and justification."
      ),
    },
    {
      cat: t("Journal quotidien de chantier", "Daily Construction Log"),
      desc: t(
        "Le Concepteur-Constructeur maintiendra un journal quotidien de chantier documentant : conditions m&eacute;t&eacute;orologiques, effectifs et sous-traitants pr&eacute;sents, activit&eacute;s r&eacute;alis&eacute;es, livraisons re&ccedil;ues, probl&egrave;mes rencontr&eacute;s, inspections r&eacute;alis&eacute;es et incidents de s&eacute;curit&eacute;. Le journal sera disponible pour consultation par le Propri&eacute;taire sur demande.",
        "The Design-Builder shall maintain a daily construction log documenting: weather conditions, workforce and subcontractors on site, activities performed, deliveries received, issues encountered, inspections conducted and safety incidents. The log shall be available for Owner review upon request."
      ),
    },
    {
      cat: t("Documentation des retards m&eacute;t&eacute;orologiques", "Weather Delay Documentation"),
      desc: t(
        "Les retards caus&eacute;s par des conditions m&eacute;t&eacute;orologiques exceptionnelles (temp&ecirc;tes de verglas, vents sup&eacute;rieurs &agrave; 60&nbsp;km/h, temp&eacute;ratures inf&eacute;rieures &agrave; &minus;25&nbsp;&deg;C) seront document&eacute;s dans le journal de chantier et signal&eacute;s au Propri&eacute;taire dans les 48&nbsp;heures. Les demandes d'extension de d&eacute;lai devront &ecirc;tre appuy&eacute;es par les donn&eacute;es m&eacute;t&eacute;orologiques d'Environnement Canada.",
        "Delays caused by exceptional weather conditions (ice storms, winds exceeding 60&nbsp;km/h, temperatures below &minus;25&nbsp;&deg;C) shall be documented in the construction log and reported to the Owner within 48&nbsp;hours. Schedule extension requests must be supported by Environment Canada weather data."
      ),
    },
  ];

  pages.push(`
  <div class="page-auto">
    <div class="section-num">5</div>
    <h2>${t("&Eacute;tendue des Travaux", "Scope of Work")}</h2>
    <p style="font-size: 9pt; color: var(--gray); margin-bottom: 4mm;">
      ${t(
        "L'&eacute;tendue des travaux du Concepteur-Constructeur sera livr&eacute;e conform&eacute;ment aux recommandations des fabricants d'&eacute;quipement, aux autorisations gouvernementales, aux lois applicables, aux bonnes pratiques d'ing&eacute;nierie et aux dispositions de l'Entente.",
        "The Design-Builder's Scope of Work shall be delivered in accordance with equipment manufacturer recommendations, governmental authorizations, applicable laws, good engineering practices and the provisions of the Agreement."
      )}
    </p>
    <h3>${t("5.1 &mdash; &Eacute;tendue du Propri&eacute;taire", "5.1 &mdash; Owner's Scope of Work")}</h3>
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

  const dbScopePage1 = dbScope.slice(0, 10);
  const dbScopePage2 = dbScope.slice(10);

  pages.push(`
  <div class="page-auto">
    <h3>${t("5.2 &mdash; &Eacute;tendue du Concepteur-Constructeur", "5.2 &mdash; Design-Builder's Scope of Work")}</h3>
    <table class="scope-table">
      <thead><tr><th>${t("Cat&eacute;gorie", "Category")}</th><th>${t("Description", "Description")}</th></tr></thead>
      <tbody>
        ${dbScopePage1.map(s => `<tr><td class="scope-cat">${s.cat}</td><td>${s.desc}</td></tr>`).join("")}
      </tbody>
    </table>
    ${footerHtml(t, dateStr, startPage + 1)}
  </div>`);

  pages.push(`
  <div class="page-auto">
    <h3>${t("5.2 &mdash; &Eacute;tendue du Concepteur-Constructeur (suite)", "5.2 &mdash; Design-Builder's Scope of Work (cont'd)")}</h3>
    <table class="scope-table">
      <thead><tr><th>${t("Cat&eacute;gorie", "Category")}</th><th>${t("Description", "Description")}</th></tr></thead>
      <tbody>
        ${dbScopePage2.map(s => `<tr><td class="scope-cat">${s.cat}</td><td>${s.desc}</td></tr>`).join("")}
      </tbody>
    </table>
    <p style="font-size: 8.5pt; color: var(--gray); text-align: center; margin-top: 3mm; font-style: italic;">
      *${t("FIN DE L'&Eacute;TENDUE DU CONCEPTEUR-CONSTRUCTEUR", "END OF DESIGN-BUILDER'S SCOPE OF WORK")}*
    </p>
    ${footerHtml(t, dateStr, startPage + 2)}
  </div>`);

  pages.push(`
  <div class="page-auto">
    <h3>${t("5.3 &mdash; Dispositions G&eacute;n&eacute;rales", "5.3 &mdash; General Provisions")}</h3>
    <p style="font-size: 9pt; color: var(--gray); margin-bottom: 4mm;">
      ${t(
        "Les dispositions suivantes s'appliquent &agrave; l'ensemble des travaux et lient les deux parties pour la dur&eacute;e du contrat.",
        "The following provisions apply to the entirety of the Work and are binding on both parties for the duration of the contract."
      )}
    </p>
    <table class="scope-table">
      <thead><tr><th>${t("Cat&eacute;gorie", "Category")}</th><th>${t("Description", "Description")}</th></tr></thead>
      <tbody>
        ${generalProvisions.map(s => `<tr><td class="scope-cat">${s.cat}</td><td>${s.desc}</td></tr>`).join("")}
      </tbody>
    </table>
    <p style="font-size: 8.5pt; color: var(--gray); text-align: center; margin-top: 3mm; font-style: italic;">
      *${t("FIN DES DISPOSITIONS G&Eacute;N&Eacute;RALES", "END OF GENERAL PROVISIONS")}*
    </p>
    ${footerHtml(t, dateStr, startPage + 3)}
  </div>`);

  return pages;
}

function buildScheduleOfValuesPages(t: (fr: string, en: string) => string, dateStr: string, startPage: number): string[] {
  const pages: string[] = [];

  const milestones = [
    {
      num: "1",
      desc: t("Ex&eacute;cution du contrat", "Contract Execution"),
      pct: "10,0&nbsp;%",
      deliverables: t(
        "Signature de l'entente cadre; d&eacute;p&ocirc;t du cautionnement d'ex&eacute;cution et du cautionnement de main-d'&oelig;uvre et mat&eacute;riaux; preuve d'assurance conforme.",
        "Signed master agreement; submission of performance bond and labour &amp; material bond; proof of compliant insurance coverage."
      ),
    },
    {
      num: "2",
      desc: t("Dossier de conception approuv&eacute;", "Approved Design Package"),
      pct: "10,0&nbsp;%",
      deliverables: t(
        "Plans d'ing&eacute;nierie &eacute;lectrique (sceau OIQ) approuv&eacute;s; rapport structurel; soumission Hydro-Qu&eacute;bec; demande de permis de construire d&eacute;pos&eacute;e.",
        "Approved electrical engineering drawings (OIQ stamped); structural report; Hydro-Qu&eacute;bec submission; building permit application filed."
      ),
    },
    {
      num: "3",
      desc: t("Bons de commande &eacute;mis", "Purchase Orders Issued"),
      pct: "15,0&nbsp;%",
      deliverables: t(
        "Bons de commande confirm&eacute;s pour modules, onduleurs, racking et transformateurs; confirmations de livraison des fournisseurs; permis de construire obtenu.",
        "Confirmed purchase orders for modules, inverters, racking and transformers; supplier delivery confirmations; building permit obtained."
      ),
    },
    {
      num: "4",
      desc: t("Mobilisation et livraison", "Mobilization &amp; Delivery"),
      pct: "10,0&nbsp;%",
      deliverables: t(
        "Plan de mobilisation approuv&eacute;; mat&eacute;riaux livr&eacute;s et v&eacute;rifi&eacute;s sur site; plan de sant&eacute; et s&eacute;curit&eacute; accept&eacute;; r&eacute;union de pr&eacute;-construction compl&eacute;t&eacute;e.",
        "Approved mobilization plan; materials delivered and verified on site; health &amp; safety plan accepted; pre-construction meeting completed."
      ),
    },
    {
      num: "5",
      desc: t("25&nbsp;% de l'installation compl&eacute;t&eacute;e", "25% Installation Complete"),
      pct: "10,0&nbsp;%",
      deliverables: t(
        "Racking install&eacute; et ancr&eacute; conform&eacute;ment aux plans; 25&nbsp;% des modules pos&eacute;s; rapports d'avancement hebdomadaires fournis; photos de progression.",
        "Racking installed and anchored per drawings; 25% of modules placed; weekly progress reports provided; progress photographs."
      ),
    },
    {
      num: "6",
      desc: t("50&nbsp;% de l'installation compl&eacute;t&eacute;e", "50% Installation Complete"),
      pct: "15,0&nbsp;%",
      deliverables: t(
        "50&nbsp;% des modules pos&eacute;s et c&acirc;bl&eacute;s; onduleurs install&eacute;s; c&acirc;blage DC en cours; inspection interne de qualit&eacute; compl&eacute;t&eacute;e.",
        "50% of modules placed and wired; inverters installed; DC wiring underway; internal quality inspection completed."
      ),
    },
    {
      num: "7",
      desc: t("75&nbsp;% de l'installation compl&eacute;t&eacute;e", "75% Installation Complete"),
      pct: "10,0&nbsp;%",
      deliverables: t(
        "75&nbsp;% des modules pos&eacute;s; c&acirc;blage AC et DC substantiellement compl&eacute;t&eacute;; mise &agrave; la terre install&eacute;e; syst&egrave;me de surveillance configur&eacute;.",
        "75% of modules placed; AC and DC wiring substantially complete; grounding installed; monitoring system configured."
      ),
    },
    {
      num: "8",
      desc: t("M&eacute;caniquement complet", "Mechanically Complete"),
      pct: "10,0&nbsp;%",
      deliverables: t(
        "Installation physique 100&nbsp;% compl&eacute;t&eacute;e; tests de mise en service r&eacute;ussis; inspection RBQ r&eacute;ussie; coordination Hydro-Qu&eacute;bec pour date de mise en service.",
        "Physical installation 100% complete; commissioning tests passed; RBQ inspection passed; Hydro-Qu&eacute;bec coordination for in-service date."
      ),
    },
    {
      num: "9",
      desc: t("Mise en service et acceptation provisoire", "Commissioning &amp; Provisional Acceptance"),
      pct: "5,0&nbsp;%",
      deliverables: t(
        "Syst&egrave;me &eacute;nergis&eacute; et connect&eacute; au r&eacute;seau; tests de performance IV-curve compl&eacute;t&eacute;s; thermographie par drone r&eacute;alis&eacute;e; certificat d'acceptation provisoire sign&eacute;.",
        "System energized and grid-connected; IV-curve performance testing completed; drone thermography performed; provisional acceptance certificate signed."
      ),
    },
    {
      num: "10",
      desc: t("Documentation de cl&ocirc;ture et paiement final*", "Close-Out Documentation &amp; Final Payment*"),
      pct: "5,0&nbsp;%",
      deliverables: t(
        "Plans tel que construit (sceau OIQ); manuel O&amp;M; donn&eacute;es de mise en service; liste de d&eacute;ficiences compl&eacute;t&eacute;e; renonciation d'hypoth&egrave;que l&eacute;gale fournie.",
        "As-built drawings (OIQ stamped); O&amp;M manual; commissioning data; punch list completed; legal hypothec waiver provided."
      ),
    },
  ];

  const assumptions = [
    t("Isolation standard en caoutchouc recycl&eacute; pour le racking incluse", "Standard recycled rubber racking isolation included with loose-laid slipsheets"),
    t("Frais d'&eacute;tude d'impact et de raccordement Hydro-Qu&eacute;bec inclus (sujets &agrave; modification par Hydro-Qu&eacute;bec)", "Hydro-Qu&eacute;bec connection impact study and interconnection fees included (fees subject to change by Hydro-Qu&eacute;bec)"),
    t("Frais de permis de construire inclus", "Building permit fees included"),
    t("Garanties standard des fabricants incluses (sauf indication contraire)", "Standard manufacturer warranties included (unless otherwise noted)"),
    t("&Eacute;quipement majeur sujet &agrave; changement selon disponibilit&eacute; au moment de l'approvisionnement", "Major equipment subject to change based on commercial availability at time of procurement"),
    t("Salaires courants (requis pour le CII 30&nbsp;%) inclus (sujet &agrave; la l&eacute;gislation finale)", "Prevailing wages (required for 30% ITC) included (subject to final legislation)"),
    t("Primes hivernales, heures suppl&eacute;mentaires incluses", "Winter premiums, overtime and premium time included"),
    t("Cautionnement d'ex&eacute;cution 50&nbsp;% et cautionnement de main-d'&oelig;uvre et mat&eacute;riaux 50&nbsp;% inclus", "50% Performance and 50% Labour &amp; Material Bonds included"),
    t("2&nbsp;% de modules de rechange inclus", "2% spare modules included"),
    t("Droits de douane et surcharges inclus dans le prix", "Tariffs and surcharges are included in price"),
    t("Mobilisation de grue et &eacute;quipement de levage inclus", "Crane mobilization and rigging equipment included"),
    t("Alimentation &eacute;lectrique temporaire de chantier incluse", "Temporary construction power supply included"),
    t("S&eacute;curit&eacute; de chantier durant la construction incluse", "Site security during construction included"),
    t("Protection de la membrane de toiture existante durant l'installation incluse", "Protection of existing roofing membrane during installation included"),
    t("Coordination avec les op&eacute;rations du b&acirc;timent (acc&egrave;s, bruit, stationnement) incluse", "Coordination with building operations (access, noise, parking) included"),
    t("Relev&eacute; tel que construit et arpentage final inclus", "As-built survey and final survey included"),
    t("Agent de mise en service inclus", "Commissioning agent included"),
    t("Prix des garanties prolonge&eacute;es (onduleurs 25 ans) inclus", "Extended warranty pricing (inverters 25 years) included"),
    t("Cautionnement de d&eacute;mant&egrave;lement / retrait en fin de vie exclu (n&eacute;goci&eacute; s&eacute;par&eacute;ment)", "Decommissioning / end-of-life removal bond excluded (negotiated separately)"),
    t("Taxes de vente applicables (TPS/TVQ) en sus du Prix du Contrat", "Applicable sales taxes (GST/QST) in addition to the Contract Price"),
  ];

  const exclusions = [
    t("Am&eacute;liorations du service &eacute;lectrique principal ou remplacement du panneau &eacute;lectrique existant", "Main electrical service upgrades or replacement of existing electrical panel"),
    t("Renforcement structurel du toit ou r&eacute;paration de la membrane de toiture (sauf protection durant l'installation)", "Structural roof reinforcement or roofing membrane repair (except protection during installation)"),
    t("Enl&egrave;vement de l'amiante, BPC ou autres mati&egrave;res dangereuses", "Asbestos removal, PCB or other hazardous materials abatement"),
    t("G&eacute;n&eacute;rateurs de secours ou batteries de stockage (sauf si sp&eacute;cifi&eacute; dans l'Annexe&nbsp;A)", "Back-up generators or battery storage (unless specified in Annex&nbsp;A)"),
    t("Travaux d'am&eacute;nagement paysager ou de terrassement", "Landscaping or grading work"),
    t("Syst&egrave;me de protection contre la foudre (paratonnerre) sauf mise &agrave; la terre standard", "Lightning protection system (lightning rod) except standard grounding"),
    t("Frais de conformit&eacute; environnementale li&eacute;s &agrave; la contamination du sol existante", "Environmental compliance costs related to existing soil contamination"),
    t("Co&ucirc;ts d'obtention de servitudes ou droits de passage", "Costs of obtaining easements or rights-of-way"),
    t("Am&eacute;lioration de la capacit&eacute; du r&eacute;seau de distribution d'Hydro-Qu&eacute;bec au-del&agrave; du point de raccordement", "Hydro-Qu&eacute;bec distribution network capacity upgrades beyond point of interconnection"),
  ];

  pages.push(`
  <div class="page-auto">
    <div class="section-num">6</div>
    <h2>${t("&Eacute;ch&eacute;ancier de Paiement", "Schedule of Values")}</h2>
    <p style="font-size: 9pt; color: var(--gray); margin-bottom: 4mm;">
      ${t(
        "Le Propri&eacute;taire sera factur&eacute; par le Concepteur-Constructeur selon l'&eacute;ch&eacute;ancier de valeurs pr&eacute;sent&eacute; ci-dessous en pourcentage du Prix du Contrat. Chaque jalon est assujetti &agrave; la validation des livrables d&eacute;crits avant la facturation.",
        "The Owner will be invoiced by the Design-Builder against the Schedule of Values presented below as a percentage of the Contract Price. Each milestone is subject to validation of the described deliverables prior to invoicing."
      )}
    </p>
    <table class="sov-table">
      <thead><tr>
        <th>#</th>
        <th>${t("Jalon", "Milestone")}</th>
        <th>${t("Livrables / Conditions", "Deliverables / Conditions")}</th>
        <th style="text-align:right">%</th>
      </tr></thead>
      <tbody>
        ${milestones.map(m => `<tr>
          <td style="font-weight:600; color: var(--primary); white-space: nowrap;">${m.num}</td>
          <td style="font-weight:600;">${m.desc}</td>
          <td style="font-size: 8.5pt; color: var(--gray);">${m.deliverables}</td>
          <td class="sov-pct">${m.pct}</td>
        </tr>`).join("")}
        <tr class="total-row">
          <td></td>
          <td>Total</td>
          <td></td>
          <td class="sov-pct">100,0&nbsp;%</td>
        </tr>
      </tbody>
    </table>
    <p style="font-size: 8pt; color: var(--gray); margin-top: 2mm; line-height: 1.5;">
      *${t(
        "Requis pour le paiement final : (a) D&eacute;claration confirmant qu'aucun avis d'hypoth&egrave;que l&eacute;gale n'a &eacute;t&eacute; re&ccedil;u; (b) D&eacute;claration confirmant que tous les comptes ont &eacute;t&eacute; pay&eacute;s, sauf les retenues l&eacute;gitimes; (c) Renonciation finale d'hypoth&egrave;que sign&eacute;e par le Concepteur-Constructeur et tous les sous-traitants.",
        "Required for Final Payment: (a) Declaration confirming no written notices of legal hypothec have been received; (b) Declaration confirming all accounts for labour, subcontracts, products and services have been paid in full, except for lawfully retained holdbacks; (c) Final hypothec waiver signed by the Design-Builder and all subcontractors."
      )}
    </p>
    ${footerHtml(t, dateStr, startPage)}
  </div>`);

  pages.push(`
  <div class="page-auto">
    <h3>${t("Conditions de Paiement", "Payment Terms")}</h3>
    <table class="terms-table">
      <thead><tr><th>${t("Condition", "Condition")}</th><th>${t("D&eacute;tails", "Details")}</th></tr></thead>
      <tbody>
        <tr>
          <td class="clause">${t("D&eacute;lai de paiement", "Payment Terms")}</td>
          <td>${t(
            "Net trente (30) jours suivant la r&eacute;ception d'une facture conforme par le Propri&eacute;taire.",
            "Net thirty (30) days following Owner's receipt of a proper invoice."
          )}</td>
        </tr>
        <tr>
          <td class="clause">${t("Int&eacute;r&ecirc;ts de retard", "Late Payment Interest")}</td>
          <td>${t(
            "Les montants impay&eacute;s apr&egrave;s l'&eacute;ch&eacute;ance porteront int&eacute;r&ecirc;t au taux pr&eacute;f&eacute;rentiel de la Banque du Canada major&eacute; de deux pour cent (2&nbsp;%) par ann&eacute;e, calcul&eacute; mensuellement et non compos&eacute;.",
            "Amounts unpaid after the due date shall bear interest at the Bank of Canada prime rate plus two percent (2%) per annum, calculated monthly and not compounded."
          )}</td>
        </tr>
        <tr>
          <td class="clause">${t("Retenue statutaire", "Statutory Holdback")}</td>
          <td>${t(
            "Conform&eacute;ment aux articles 2726&ndash;2728 du Code civil du Qu&eacute;bec, une retenue de dix pour cent (10&nbsp;%) sera appliqu&eacute;e sur chaque paiement progressif. La retenue sera lib&eacute;r&eacute;e trente (30) jours apr&egrave;s l'expiration du d&eacute;lai de publication des hypoth&egrave;ques l&eacute;gales, sous r&eacute;serve qu'aucune hypoth&egrave;que n'ait &eacute;t&eacute; inscrite.",
            "In accordance with Articles 2726&ndash;2728 of the Civil Code of Qu&eacute;bec, a holdback of ten percent (10%) shall be applied on each progress payment. The holdback shall be released thirty (30) days after the expiry of the legal hypothec registration period, provided no legal hypothec has been registered."
          )}</td>
        </tr>
        <tr>
          <td class="clause">${t("Renonciation d'hypoth&egrave;que", "Lien Waiver Requirements")}</td>
          <td>${t(
            "Chaque demande de paiement progressif doit &ecirc;tre accompagn&eacute;e d'une renonciation d'hypoth&egrave;que l&eacute;gale conditionnelle du Concepteur-Constructeur et de chaque sous-traitant pour la p&eacute;riode factur&eacute;e. Le paiement final n&eacute;cessite des renonciations inconditionnelles de toutes les parties.",
            "Each application for progress payment must be accompanied by a conditional legal hypothec waiver from the Design-Builder and each subcontractor for the invoiced period. Final payment requires unconditional waivers from all parties."
          )}</td>
        </tr>
        <tr>
          <td class="clause">${t("Format de facturation", "Invoice Format")}</td>
          <td>${t(
            "Les factures doivent inclure : (a) num&eacute;ro de r&eacute;f&eacute;rence du projet et du contrat; (b) ventilation par jalon selon l'&Eacute;ch&eacute;ancier de Valeurs; (c) pourcentage d'avancement avec documentation justificative; (d) photos de progression; (e) attestation CNESST &agrave; jour; (f) liste des sous-traitants et montants pay&eacute;s.",
            "Invoices must include: (a) project and contract reference number; (b) breakdown by milestone per the Schedule of Values; (c) percentage of completion with supporting documentation; (d) progress photographs; (e) current CNESST clearance certificate; (f) list of subcontractors and amounts paid."
          )}</td>
        </tr>
        <tr>
          <td class="clause">${t("Droit de contestation", "Right to Dispute")}</td>
          <td>${t(
            "Le Propri&eacute;taire peut contester tout ou partie d'une facture dans les quinze (15) jours suivant sa r&eacute;ception. Les montants non contest&eacute;s doivent &ecirc;tre pay&eacute;s &agrave; l'&eacute;ch&eacute;ance. Les montants contest&eacute;s seront r&eacute;solus conform&eacute;ment &agrave; la proc&eacute;dure de r&egrave;glement des diff&eacute;rends (Section&nbsp;8).",
            "The Owner may dispute all or part of an invoice within fifteen (15) days of receipt. Undisputed amounts must be paid when due. Disputed amounts shall be resolved in accordance with the dispute resolution procedure (Section&nbsp;8)."
          )}</td>
        </tr>
      </tbody>
    </table>

    <h3 style="margin-top: 6mm;">${t("Hypoth&egrave;ses de Prix", "Pricing Assumptions")}</h3>
    <ul class="assumptions-list">
      ${assumptions.slice(0, 10).map(a => `<li>${a}</li>`).join("")}
    </ul>
    ${footerHtml(t, dateStr, startPage + 1)}
  </div>`);

  pages.push(`
  <div class="page-auto">
    <h3>${t("Hypoth&egrave;ses de Prix (suite)", "Pricing Assumptions (continued)")}</h3>
    <ul class="assumptions-list">
      ${assumptions.slice(10).map(a => `<li>${a}</li>`).join("")}
    </ul>

    <h3 style="margin-top: 6mm;">${t("Exclusions", "Exclusions")}</h3>
    <p style="font-size: 9pt; color: var(--gray); margin-bottom: 3mm;">
      ${t(
        "Les &eacute;l&eacute;ments suivants ne sont PAS inclus dans le Prix du Contrat et demeurent &agrave; la charge du Propri&eacute;taire ou feront l'objet d'un avenant s&eacute;par&eacute; si requis&nbsp;:",
        "The following items are NOT included in the Contract Price and remain the Owner's responsibility or will be subject to a separate change order if required:"
      )}
    </p>
    <ul class="assumptions-list">
      ${exclusions.map(e => `<li>${e}</li>`).join("")}
    </ul>

    <p style="font-size: 8pt; color: var(--gray); margin-top: 5mm; line-height: 1.5; font-style: italic;">
      ${t(
        "Note&nbsp;: Tout travail suppl&eacute;mentaire non couvert par le Prix du Contrat sera soumis &agrave; la proc&eacute;dure d'avenant (Change Order) d&eacute;crite &agrave; la Section&nbsp;8, incluant un estimat&eacute; d&eacute;taill&eacute; et l'approbation &eacute;crite du Propri&eacute;taire avant ex&eacute;cution.",
        "Note: Any additional work not covered by the Contract Price shall be subject to the Change Order procedure described in Section&nbsp;8, including a detailed estimate and the Owner's written approval prior to execution."
      )}
    </p>
    ${footerHtml(t, dateStr, startPage + 2)}
  </div>`);

  return pages;
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

  const allArticles = [
    {
      ref: "SC-1 &mdash; CCDC 14, Art. A-3",
      title: t("Documents contractuels &mdash; Ordre de priorit&eacute;", "Contract Documents &mdash; Order of Priority"),
      text: t(
        "En cas de conflit ou d'incompatibilit&eacute; entre les documents contractuels, ils seront interpr&eacute;t&eacute;s dans l'ordre suivant de priorit&eacute; d&eacute;croissante : (1) les pr&eacute;sentes Conditions suppl&eacute;mentaires; (2) l'Entente entre le Propri&eacute;taire et le Concepteur-Constructeur; (3) les Conditions g&eacute;n&eacute;rales CCDC&nbsp;14; (4) les Annexes par site; (5) les plans et devis; (6) tout autre document incorpor&eacute; par r&eacute;f&eacute;rence. Les Conditions suppl&eacute;mentaires ont priorit&eacute; sur tous les autres documents.",
        "In the event of any conflict or inconsistency between the Contract Documents, they shall be interpreted in the following order of decreasing priority: (1) these Supplementary Conditions; (2) the Agreement between the Owner and the Design-Builder; (3) the General Conditions CCDC&nbsp;14; (4) the Per-Site Annexes; (5) drawings and specifications; (6) any other document incorporated by reference. The Supplementary Conditions shall have priority over all other documents."
      ),
    },
    {
      ref: "SC-2 &mdash; CCDC 14, Art. A-4",
      title: t("Prix du contrat &mdash; Exhaustivit&eacute;", "Contract Price &mdash; Completeness"),
      text: t(
        "Le Prix du Contrat constitue le prix complet pour les Travaux et inclut toutes les provisions que le Concepteur-Constructeur estime n&eacute;cessaires pour compl&eacute;ter les Services de conception et les Travaux, incluant conception, construction, main-d'&oelig;uvre, produits et &eacute;quipements. Le Prix du Contrat inclut &eacute;galement tous les co&ucirc;ts indirects, frais g&eacute;n&eacute;raux, b&eacute;n&eacute;fice, assurances, cautionnement et taxes applicables, &agrave; l'exception de la TPS/TVQ qui sera factur&eacute;e s&eacute;par&eacute;ment.",
        "The Contract Price shall be the complete price for the Work and includes all contingency and other amounts that the Design-Builder believes are necessary to complete the Design Services and the Work, including design, construction, labour, products and equipment. The Contract Price also includes all indirect costs, overhead, profit, insurance, bonding and applicable taxes, with the exception of GST/QST which shall be invoiced separately."
      ),
    },
    {
      ref: "SC-3 &mdash; CG 1.5",
      title: t("Confidentialit&eacute;", "Confidentiality"),
      text: t(
        "Le Concepteur-Constructeur ne divulguera aucune information confidentielle sauf pour l'ex&eacute;cution de ses obligations. L'information confidentielle ne sera utilis&eacute;e pour aucun autre projet sans l'approbation &eacute;crite pr&eacute;alable du Propri&eacute;taire. Cet engagement de confidentialit&eacute; survivra &agrave; la r&eacute;siliation du Contrat pour une p&eacute;riode de cinq (5) ans. Les donn&eacute;es de production, rendement et performance &eacute;nerg&eacute;tique du syst&egrave;me sont &eacute;galement consid&eacute;r&eacute;es confidentielles.",
        "The Design-Builder shall not divulge any confidential information except as required to carry out its obligations. No confidential information shall be used on any other project without the prior written approval of the Owner. This confidentiality covenant shall survive the termination of the Contract for a period of five (5) years. System production data, yield and energy performance data shall also be considered confidential."
      ),
    },
    {
      ref: "SC-4 &mdash; CG 1.6",
      title: t("Examen des lieux de travail", "Examination of Place of the Work"),
      text: t(
        "Le Concepteur-Constructeur d&eacute;clare avoir examin&eacute; les Lieux de Travail et s'&ecirc;tre satisfait de la port&eacute;e et de la nature des Travaux. En cons&eacute;quence, le Concepteur-Constructeur assume tous les risques de conditions existantes ou survenant durant les Travaux qu'un professionnel diligent aurait raisonnablement d&eacute;couverts lors de l'inspection. Le Concepteur-Constructeur confirme avoir r&eacute;alis&eacute; les visites de site requises, incluant l'inspection des toitures, des &eacute;quipements m&eacute;caniques en toiture et de l'infrastructure &eacute;lectrique existante.",
        "The Design-Builder represents and warrants that it has examined the Place of the Work and has satisfied itself as to the scope and character of the Work. As a result, the Design-Builder assumes all risk of conditions now existing or arising in the course of the Work that a prudent professional would have reasonably discovered during the site inspection. The Design-Builder confirms having completed the required site visits, including inspection of rooftops, rooftop mechanical equipment and existing electrical infrastructure."
      ),
    },
    {
      ref: "SC-5 &mdash; CG 3.7.3",
      title: t("Personnel cl&eacute;", "Key Personnel"),
      text: t(
        "Le Concepteur-Constructeur s'engage &agrave; affecter du personnel exp&eacute;riment&eacute; et qualifi&eacute; au Projet. Le Personnel cl&eacute; ne peut &ecirc;tre remplac&eacute; sans l'acceptation &eacute;crite pr&eacute;alable du Propri&eacute;taire. En cas d'indisponibilit&eacute; sans remplacement acceptable dans les dix (10) jours ouvrables, le Propri&eacute;taire peut r&eacute;silier le Contrat. Le Personnel cl&eacute; inclut minimalement : le charg&eacute; de projet, l'ing&eacute;nieur &eacute;lectricien (OIQ), le superviseur de chantier et le responsable sant&eacute;-s&eacute;curit&eacute;.",
        "The Design-Builder agrees to commit experienced and qualified personnel to the Project. Key Personnel may not be changed without the Owner's prior written acceptance. If Key Personnel is unavailable and a replacement has not been provided within ten (10) Working Days, the Owner may terminate the Contract. Key Personnel shall include at minimum: the project manager, the electrical engineer (OIQ), the site supervisor and the health &amp; safety officer."
      ),
    },
    {
      ref: "SC-6 &mdash; CG 5.2",
      title: t("Demandes de paiement progressif", "Applications for Progress Payment"),
      text: t(
        "Les factures conformes seront soumises mensuellement selon l'&Eacute;ch&eacute;ancier de Valeurs (Section 6). Chaque facture inclura : ventilation des travaux, d&eacute;clarations de paiement des sous-traitants, certificats CNESST, pourcentage d'avancement, pi&egrave;ces justificatives et photos d'avancement. Les factures seront accompagn&eacute;es d'une quittance conditionnelle et d'un rapport d'avancement sign&eacute; par le charg&eacute; de projet.",
        "Proper Invoices shall be submitted monthly based on the Schedule of Values (Section 6). Each invoice shall include: breakdown of work performed, subcontractor payment declarations, CNESST clearance certificates, percentage of completion, supporting documentation and progress photos. Invoices shall be accompanied by a conditional lien waiver and a progress report signed by the project manager."
      ),
    },
    {
      ref: "SC-7 &mdash; Art. 2726-2728 CCQ",
      title: t("Retenue &mdash; Hypoth&egrave;ques l&eacute;gales", "Holdback &mdash; Legal Hypothecs"),
      text: t(
        "Conform&eacute;ment aux articles 2726 &agrave; 2728 du Code civil du Qu&eacute;bec, une retenue de dix pour cent (10&nbsp;%) sera appliqu&eacute;e sur chaque paiement progressif. La retenue sera lib&eacute;r&eacute;e trente (30) jours apr&egrave;s l'expiration du d&eacute;lai de publication des hypoth&egrave;ques l&eacute;gales, sous r&eacute;serve qu'aucune hypoth&egrave;que n'ait &eacute;t&eacute; inscrite. Le Concepteur-Constructeur fournira un certificat du Registre foncier confirmant l'absence d'hypoth&egrave;ques l&eacute;gales avant la lib&eacute;ration de la retenue.",
        "In accordance with Articles 2726 to 2728 of the Civil Code of Qu&eacute;bec, a holdback of ten percent (10%) shall be applied on each progress payment. The holdback shall be released thirty (30) days after the expiry of the legal hypothec registration period, provided no legal hypothec has been registered. The Design-Builder shall provide a certificate from the Land Registry confirming the absence of legal hypothecs prior to release of the holdback."
      ),
    },
    {
      ref: "SC-8 &mdash; CG 12.5",
      title: t("Garanties", "Warranties"),
      text: t(
        "Panneaux : garantie de performance lin&eacute;aire de 25 ans (minimum 80,7&nbsp;% de la puissance nominale &agrave; l'an 25). Onduleurs : 15 ans (extensible &agrave; 25). Racking et structure de montage : 25 ans. Main-d'&oelig;uvre et installation : 10 ans. Le paiement final sera assujetti &agrave; une retenue de cinquante mille dollars (50&nbsp;000&nbsp;$) jusqu'&agrave; la remise des plans tel que construit (sceau OIQ) et du manuel O&amp;M. Le Concepteur-Constructeur garantit que le syst&egrave;me sera exempt de tout d&eacute;faut de mat&eacute;riaux et de main-d'&oelig;uvre.",
        "Panels: 25-year linear performance warranty (minimum 80.7% of nominal power at year 25). Inverters: 15 years (extendable to 25). Racking and mounting structure: 25 years. Workmanship and installation: 10 years. The final payment shall be subject to a holdback of fifty thousand dollars ($50,000) until as-built drawings (OIQ sealed) and O&amp;M manual have been provided. The Design-Builder warrants that the system shall be free from defects in materials and workmanship."
      ),
    },
    {
      ref: "SC-9 &mdash; CG 11.1",
      title: t("Assurance", "Insurance"),
      text: t(
        "Le Concepteur-Constructeur maintiendra : (a) assurance tous risques construction (incluant transit et entreposage) pour la valeur compl&egrave;te des Travaux; (b) responsabilit&eacute; civile g&eacute;n&eacute;rale minimum de 5&nbsp;000&nbsp;000&nbsp;$; (c) assurance responsabilit&eacute; professionnelle minimum de 2&nbsp;000&nbsp;000&nbsp;$; (d) assurance automobile pour tous les v&eacute;hicules utilis&eacute;s; (e) couverture pollution/environnement minimum de 2&nbsp;000&nbsp;000&nbsp;$. Les polices nommeront le Propri&eacute;taire comme assur&eacute; additionnel et contiendront une clause de renonciation &agrave; la subrogation. Les certificats d'assurance seront fournis avant le d&eacute;but des Travaux.",
        "The Design-Builder shall maintain: (a) all-risk construction insurance (including transit and storage) for the full value of the Work; (b) commercial general liability insurance minimum $5,000,000; (c) professional liability insurance minimum $2,000,000; (d) automobile insurance for all vehicles used; (e) pollution/environmental liability coverage minimum $2,000,000. Policies shall name the Owner as additional insured and include a waiver of subrogation clause. Insurance certificates shall be provided prior to commencement of the Work."
      ),
    },
    {
      ref: "SC-10 &mdash; CG 6.5",
      title: t("D&eacute;lais et force majeure", "Delays and Force Majeure"),
      text: t(
        "Le temps est de l'essence. Le Concepteur-Constructeur renonce &agrave; toute r&eacute;clamation pour d&eacute;lais caus&eacute;s par ses propres actes ou omissions. En cas de retard imputable au Concepteur-Constructeur, celui-ci prendra les mesures correctives n&eacute;cessaires &agrave; ses frais. Aucune des parties ne sera tenue responsable des retards r&eacute;sultant de circonstances hors de son contr&ocirc;le raisonnable (force majeure), incluant sans s'y limiter : catastrophes naturelles, pand&eacute;mies, guerres, embargos ou arr&ecirc;t&eacute;s gouvernementaux. La partie affect&eacute;e devra notifier l'autre par &eacute;crit dans les cinq (5) jours ouvrables de la survenance de l'&eacute;v&eacute;nement.",
        "Time is of the essence. The Design-Builder waives any claim for delays caused by its own actions or omissions. In case of Design-Builder caused delay, the Design-Builder shall take corrective actions at its own cost. Neither party shall be held liable for delays resulting from circumstances beyond its reasonable control (force majeure), including without limitation: natural disasters, pandemics, wars, embargoes or governmental orders. The affected party shall notify the other in writing within five (5) Working Days of the occurrence of the event."
      ),
    },
    {
      ref: "SC-11 &mdash; CG 7.2",
      title: t("R&eacute;siliation", "Termination"),
      text: t(
        "Le Propri&eacute;taire peut r&eacute;silier le Contrat pour cause (manquement mat&eacute;riel non rem&eacute;di&eacute; dans les soixante (60) jours suivant un avis &eacute;crit) ou pour convenance moyennant un pr&eacute;avis &eacute;crit de quatre-vingt-dix (90) jours. En cas de r&eacute;siliation pour convenance, le Concepteur-Constructeur sera indemnis&eacute; pour les Travaux ex&eacute;cut&eacute;s, les co&ucirc;ts de d&eacute;mobilisation raisonnables et les engagements fermes non annulables. En cas de r&eacute;siliation pour cause, le Concepteur-Constructeur n'aura droit qu'au paiement des Travaux d&ucirc;ment ex&eacute;cut&eacute;s et accept&eacute;s.",
        "The Owner may terminate the Contract for cause (material breach not remedied within sixty (60) days of written notice) or for convenience with ninety (90) days' written notice. In case of termination for convenience, the Design-Builder shall be compensated for Work performed, reasonable demobilization costs and non-cancellable firm commitments. In case of termination for cause, the Design-Builder shall only be entitled to payment for Work duly performed and accepted."
      ),
    },
    {
      ref: "SC-12 &mdash; CG 1.4",
      title: t("Cession", "Assignment"),
      text: t(
        "Le Propri&eacute;taire peut c&eacute;der le Contrat sans le consentement du Concepteur-Constructeur &agrave; toute filiale, soci&eacute;t&eacute; affili&eacute;e ou Pr&ecirc;teur en garantie de financement. Aucune autre cession ne sera permise sans le consentement &eacute;crit de l'autre partie, lequel ne sera pas refus&eacute; sans motif raisonnable.",
        "The Owner shall have the right, without the consent of the Design-Builder, to assign the Contract to any affiliate, subsidiary or Lender as collateral security for loans. No other assignment shall be permitted without the written consent of the other party, which shall not be unreasonably withheld."
      ),
    },
    {
      ref: "SC-13 &mdash; LSST / CNESST",
      title: t("Sant&eacute; et s&eacute;curit&eacute;", "Health &amp; Safety"),
      text: t(
        "Le Concepteur-Constructeur agira &agrave; titre de ma&icirc;tre d'&oelig;uvre au sens de la LSST (Loi sur la sant&eacute; et la s&eacute;curit&eacute; du travail, RLRQ c. S-2.1). Il sera responsable de la conformit&eacute; aux exigences de la CNESST, incluant le programme de pr&eacute;vention, la d&eacute;claration d'ouverture de chantier, la formation obligatoire des travailleurs (ASP Construction) et les &eacute;quipements de protection contre les chutes conform&eacute;ment au R&egrave;glement sur la sant&eacute; et la s&eacute;curit&eacute; du travail (RLRQ c. S-2.1, r. 13).",
        "The Design-Builder shall act as ma&icirc;tre d'&oelig;uvre (constructor) as defined by the LSST (Act respecting occupational health and safety, RLRQ c. S-2.1). The Design-Builder shall be responsible for compliance with CNESST requirements, including the prevention program, worksite opening declaration, mandatory worker training (ASP Construction) and fall protection equipment in accordance with the Regulation respecting occupational health and safety (RLRQ c. S-2.1, r. 13)."
      ),
    },
    {
      ref: "SC-14",
      title: t("Indemnisation", "Indemnification"),
      text: t(
        "(a) Indemnisation mutuelle : Chaque partie indemnisera et d&eacute;gagera l'autre de toute r&eacute;clamation, perte, dommage ou d&eacute;pense (incluant les honoraires juridiques raisonnables) r&eacute;sultant de la n&eacute;gligence, de la faute intentionnelle ou du manquement contractuel de la partie indemnisante. (b) Indemnisation en mati&egrave;re de propri&eacute;t&eacute; intellectuelle : Le Concepteur-Constructeur indemnisera le Propri&eacute;taire contre toute r&eacute;clamation all&eacute;guant que les Travaux ou les Services de conception portent atteinte &agrave; des droits de propri&eacute;t&eacute; intellectuelle de tiers, incluant les brevets, droits d'auteur et secrets commerciaux.",
        "(a) Mutual Indemnity: Each party shall indemnify and hold harmless the other from any claims, losses, damages or expenses (including reasonable legal fees) resulting from the indemnifying party's negligence, willful misconduct or breach of contract. (b) Intellectual Property Indemnity: The Design-Builder shall indemnify the Owner against any claim alleging that the Work or Design Services infringe upon any third-party intellectual property rights, including patents, copyrights and trade secrets."
      ),
    },
    {
      ref: "SC-15 &mdash; Art. 2724-2728 CCQ",
      title: t("Hypoth&egrave;ques l&eacute;gales et r&eacute;clamations", "Liens and Claims"),
      text: t(
        "Le Concepteur-Constructeur s'engage &agrave; maintenir les Lieux de Travail libres de toute hypoth&egrave;que l&eacute;gale de construction (art.&nbsp;2724(2) CCQ). En cas d'inscription d'une hypoth&egrave;que l&eacute;gale par un sous-traitant ou fournisseur, le Concepteur-Constructeur devra, dans les quinze (15) jours suivant l'avis du Propri&eacute;taire : (a) obtenir la mainlev&eacute;e de l'hypoth&egrave;que; (b) d&eacute;poser un cautionnement de radiation (art.&nbsp;2731 CCQ) &eacute;quivalent &agrave; 150&nbsp;% du montant r&eacute;clam&eacute;; ou (c) fournir au Propri&eacute;taire une garantie &eacute;quivalente jug&eacute;e acceptable. Le d&eacute;lai de publication est de trente (30) jours apr&egrave;s la fin des travaux (art.&nbsp;2727 CCQ).",
        "The Design-Builder shall keep the Place of the Work free of all legal construction hypothecs (art.&nbsp;2724(2) CCQ). If a legal hypothec is registered by a subcontractor or supplier, the Design-Builder shall, within fifteen (15) days of notice from the Owner: (a) obtain discharge of the hypothec; (b) post a discharge bond (art.&nbsp;2731 CCQ) equal to 150% of the amount claimed; or (c) provide the Owner with equivalent security deemed acceptable. The registration period is thirty (30) days after completion of the work (art.&nbsp;2727 CCQ)."
      ),
    },
    {
      ref: "SC-16",
      title: t("Sous-traitants", "Subcontractors"),
      text: t(
        "(a) Approbation : Le Concepteur-Constructeur soumettra au Propri&eacute;taire la liste de tous les sous-traitants propos&eacute;s pour approbation pr&eacute;alable. Le Propri&eacute;taire peut refuser tout sous-traitant pour motif raisonnable. (b) Clauses miroirs : Tous les contrats de sous-traitance contiendront des dispositions substantiellement identiques aux obligations du Concepteur-Constructeur en vertu du pr&eacute;sent Contrat, incluant les exigences en mati&egrave;re d'assurance, de sant&eacute;-s&eacute;curit&eacute;, de confidentialit&eacute; et de garantie. (c) Paiement direct : Le Propri&eacute;taire se r&eacute;serve le droit, apr&egrave;s avis &eacute;crit de sept (7) jours au Concepteur-Constructeur, de payer directement tout sous-traitant impay&eacute; et de d&eacute;duire ces montants du Prix du Contrat.",
        "(a) Approval: The Design-Builder shall submit to the Owner the list of all proposed subcontractors for prior approval. The Owner may reject any subcontractor for reasonable cause. (b) Flow-down Provisions: All subcontracts shall contain provisions substantially identical to the Design-Builder's obligations under this Contract, including insurance, health &amp; safety, confidentiality and warranty requirements. (c) Direct Payment: The Owner reserves the right, upon seven (7) days' written notice to the Design-Builder, to pay directly any unpaid subcontractor and deduct such amounts from the Contract Price."
      ),
    },
    {
      ref: "SC-17 &mdash; CG 6.2",
      title: t("Ordres de modification", "Change Orders"),
      text: t(
        "(a) Processus : Aucune modification aux Travaux ne sera effectu&eacute;e sans un ordre de modification &eacute;crit sign&eacute; par les deux parties. (b) &Eacute;valuation : Le prix des travaux suppl&eacute;mentaires sera &eacute;tabli selon : (i) les prix unitaires convenus &agrave; l'Annexe des prix unitaires, le cas &eacute;ch&eacute;ant; (ii) les co&ucirc;ts r&eacute;els major&eacute;s de quinze pour cent (15&nbsp;%) pour frais g&eacute;n&eacute;raux et b&eacute;n&eacute;fice; ou (iii) un prix forfaitaire n&eacute;goci&eacute;. (c) Analyse d'impact : Tout ordre de modification affectant le calendrier inclura une analyse d'impact sur le d&eacute;lai (Time Impact Analysis &mdash; TIA) et sera accompagn&eacute; d'un &eacute;ch&eacute;ancier r&eacute;vis&eacute;.",
        "(a) Process: No modification to the Work shall be made without a written change order signed by both parties. (b) Pricing: The price of extra work shall be established based on: (i) agreed unit rates in the Unit Price Schedule, if applicable; (ii) actual costs plus fifteen percent (15%) for overhead and profit; or (iii) a negotiated lump sum. (c) Impact Analysis: Any change order affecting the schedule shall include a Time Impact Analysis (TIA) and shall be accompanied by a revised schedule."
      ),
    },
    {
      ref: "SC-18 &mdash; Art. 2110 CCQ",
      title: t("Ach&egrave;vement substantiel", "Substantial Performance"),
      text: t(
        "L'Ach&egrave;vement substantiel des Travaux sera d&eacute;fini conform&eacute;ment &agrave; l'article 2110 du Code civil du Qu&eacute;bec : les Travaux seront consid&eacute;r&eacute;s substantiellement achev&eacute;s lorsque le syst&egrave;me sera op&eacute;rationnel, connect&eacute; au r&eacute;seau d'Hydro-Qu&eacute;bec et produisant de l'&eacute;nergie, et que le co&ucirc;t d'ach&egrave;vement ou de correction des d&eacute;ficiences r&eacute;siduelles n'exc&egrave;de pas trois pour cent (3&nbsp;%) du Prix du Contrat. Une liste de d&eacute;ficiences (punch list) sera dress&eacute;e conjointement et le Concepteur-Constructeur disposera de trente (30) jours pour compl&eacute;ter les corrections. Le certificat d'occupation municipal devra avoir &eacute;t&eacute; obtenu avant la d&eacute;claration d'ach&egrave;vement substantiel.",
        "Substantial Performance of the Work shall be defined in accordance with Article 2110 of the Civil Code of Qu&eacute;bec: the Work shall be considered substantially performed when the system is operational, connected to the Hydro-Qu&eacute;bec grid and producing energy, and the cost of completion or correction of remaining deficiencies does not exceed three percent (3%) of the Contract Price. A deficiency list (punch list) shall be jointly prepared and the Design-Builder shall have thirty (30) days to complete corrections. The municipal occupancy certificate must have been obtained prior to the declaration of Substantial Performance."
      ),
    },
    {
      ref: "SC-19",
      title: t("Mise en service et essais d'acceptation", "Commissioning and Acceptance Testing"),
      text: t(
        "(a) Protocole d'essai : Le Concepteur-Constructeur soumettra un protocole d'essai de performance au Propri&eacute;taire pour approbation au moins trente (30) jours avant la mise en service pr&eacute;vue. (b) Essai de performance : Le syst&egrave;me devra d&eacute;montrer un ratio de performance (PR) minimum de quatre-vingts pour cent (80&nbsp;%) pendant une p&eacute;riode d'essai continue de sept (7) jours. (c) Ajustement saisonnier : Si la mise en service survient durant les mois d'hiver (novembre &agrave; mars), le ratio de performance sera ajust&eacute; selon les facteurs saisonniers reconnus (effet de temp&eacute;rature, neige, irradiation r&eacute;duite) et un essai de confirmation sera r&eacute;alis&eacute; entre mai et septembre. (d) Test de courbes I-V : Des mesures de courbes I-V seront r&eacute;alis&eacute;es sur un &eacute;chantillon repr&eacute;sentatif (minimum 10&nbsp;%) des cha&icirc;nes de modules. (e) Thermographie par drone : Une inspection par thermographie infrarouge a&eacute;rienne sera r&eacute;alis&eacute;e &agrave; l'ach&egrave;vement substantiel pour d&eacute;tecter les cellules d&eacute;fectueuses.",
        "(a) Test Protocol: The Design-Builder shall submit a performance test protocol to the Owner for approval at least thirty (30) days prior to planned commissioning. (b) Performance Test: The system shall demonstrate a minimum performance ratio (PR) of eighty percent (80%) during a continuous test period of seven (7) days. (c) Seasonal Adjustment: If commissioning occurs during winter months (November to March), the performance ratio shall be adjusted using recognized seasonal factors (temperature effect, snow, reduced irradiation) and a confirmation test shall be conducted between May and September. (d) IV Curve Testing: IV curve measurements shall be performed on a representative sample (minimum 10%) of module strings. (e) Drone Thermography: An aerial infrared thermography inspection shall be performed at Substantial Completion to detect defective cells."
      ),
    },
    {
      ref: "SC-20",
      title: t("Environnement et mati&egrave;res dangereuses", "Environmental and Hazardous Materials"),
      text: t(
        "(a) Protocole de d&eacute;couverte : Si des mati&egrave;res dangereuses sont d&eacute;couvertes durant les Travaux (incluant mais sans s'y limiter : amiante, BPC, plomb, hydrocarbures), le Concepteur-Constructeur suspendra imm&eacute;diatement les Travaux dans la zone affect&eacute;e, s&eacute;curisera les lieux et en avisera le Propri&eacute;taire par &eacute;crit dans les vingt-quatre (24) heures. (b) Amiante et BPC : La pr&eacute;sence d'amiante ou de BPC dans la membrane de toiture ou l'infrastructure &eacute;lectrique existante sera trait&eacute;e conform&eacute;ment au R&egrave;glement sur la sant&eacute; et la s&eacute;curit&eacute; du travail et aux frais du Propri&eacute;taire, sauf si le Concepteur-Constructeur avait &eacute;t&eacute; inform&eacute; de leur absence. (c) Remise en &eacute;tat : Le Concepteur-Constructeur sera responsable de la gestion et de l'&eacute;limination de tout d&eacute;versement de ses propres produits (huiles, fluides hydrauliques, etc.) conform&eacute;ment aux r&eacute;glementations environnementales applicables.",
        "(a) Discovery Protocol: If hazardous materials are discovered during the Work (including but not limited to: asbestos, PCBs, lead, hydrocarbons), the Design-Builder shall immediately suspend Work in the affected area, secure the premises and notify the Owner in writing within twenty-four (24) hours. (b) Asbestos and PCBs: The presence of asbestos or PCBs in the roofing membrane or existing electrical infrastructure shall be addressed in accordance with the Regulation respecting occupational health and safety and at the Owner's expense, unless the Design-Builder had been informed of their absence. (c) Remediation: The Design-Builder shall be responsible for the management and disposal of any spills of its own products (oils, hydraulic fluids, etc.) in accordance with applicable environmental regulations."
      ),
    },
    {
      ref: "SC-21",
      title: t("Propri&eacute;t&eacute; intellectuelle", "Intellectual Property"),
      text: t(
        "(a) Propri&eacute;t&eacute; de la conception : Tous les documents de conception, plans, calculs et sp&eacute;cifications pr&eacute;par&eacute;s sp&eacute;cifiquement pour le Projet demeureront la propri&eacute;t&eacute; du Propri&eacute;taire. (b) Licence : Le Concepteur-Constructeur accorde au Propri&eacute;taire une licence perp&eacute;tuelle, irr&eacute;vocable, non exclusive et libre de redevances pour utiliser, reproduire et modifier tous les documents de conception aux fins d'exploitation, d'entretien, de r&eacute;paration, de remplacement et d'extension du syst&egrave;me. (c) Mod&egrave;le BIM : Le Concepteur-Constructeur remettra le mod&egrave;le BIM complet (format IFC) dans les trente (30) jours suivant l'ach&egrave;vement substantiel. (d) Donn&eacute;es de surveillance : Toutes les donn&eacute;es de production et de surveillance recueillies par le syst&egrave;me de monitoring sont la propri&eacute;t&eacute; exclusive du Propri&eacute;taire.",
        "(a) Design Ownership: All design documents, drawings, calculations and specifications prepared specifically for the Project shall remain the property of the Owner. (b) License: The Design-Builder grants the Owner a perpetual, irrevocable, non-exclusive, royalty-free license to use, reproduce and modify all design documents for the purposes of operating, maintaining, repairing, replacing and extending the system. (c) BIM Model: The Design-Builder shall deliver the complete BIM model (IFC format) within thirty (30) days of Substantial Completion. (d) Monitoring Data: All production and monitoring data collected by the monitoring system shall be the exclusive property of the Owner."
      ),
    },
    {
      ref: "SC-22",
      title: t("Limitation de responsabilit&eacute;", "Limitation of Liability"),
      text: t(
        "(a) Plafond : La responsabilit&eacute; totale cumul&eacute;e du Concepteur-Constructeur en vertu du pr&eacute;sent Contrat ne d&eacute;passera pas le Prix du Contrat, &agrave; l'exclusion des exceptions pr&eacute;vues ci-dessous. (b) Dommages indirects : Aucune des parties ne sera responsable envers l'autre pour les dommages indirects, cons&eacute;cutifs, sp&eacute;ciaux ou punitifs, incluant les pertes de profits ou de revenus. (c) Exceptions : Les limitations ci-dessus ne s'appliquent pas : (i) aux r&eacute;clamations d'indemnisation pour atteinte &agrave; la propri&eacute;t&eacute; intellectuelle; (ii) aux obligations de confidentialit&eacute;; (iii) aux blessures corporelles ou d&eacute;c&egrave;s r&eacute;sultant de la n&eacute;gligence; (iv) &agrave; la fraude ou la faute intentionnelle.",
        "(a) Cap: The total cumulative liability of the Design-Builder under this Contract shall not exceed the Contract Price, excluding the exceptions set out below. (b) Consequential Damages: Neither party shall be liable to the other for indirect, consequential, special or punitive damages, including loss of profits or revenue. (c) Carve-outs: The above limitations shall not apply to: (i) indemnification claims for intellectual property infringement; (ii) confidentiality obligations; (iii) bodily injury or death resulting from negligence; (iv) fraud or willful misconduct."
      ),
    },
    {
      ref: "SC-23",
      title: t("Devise, taxes et droits", "Currency, Taxes and Duties"),
      text: t(
        "(a) Devise : Tous les montants du pr&eacute;sent Contrat sont en dollars canadiens (CAD). (b) Taxes : Le Prix du Contrat est exclusif de la TPS (5&nbsp;%) et de la TVQ (9,975&nbsp;%), lesquelles seront factur&eacute;es s&eacute;par&eacute;ment. Le Concepteur-Constructeur est responsable de toutes les autres taxes, droits, cotisations et contributions applicables &agrave; l'ex&eacute;cution des Travaux. (c) Traitement fiscal / DPA : Le Propri&eacute;taire est responsable de d&eacute;terminer et de documenter le traitement fiscal applicable aux actifs solaires, incluant la d&eacute;duction pour amortissement (DPA &mdash; cat&eacute;gorie 43.1/43.2) et le CII f&eacute;d&eacute;ral pour l'&eacute;nergie propre.",
        "(a) Currency: All amounts in this Contract are in Canadian dollars (CAD). (b) Taxes: The Contract Price is exclusive of GST (5%) and QST (9.975%), which shall be invoiced separately. The Design-Builder is responsible for all other taxes, duties, assessments and contributions applicable to the performance of the Work. (c) Tax Treatment / CCA: The Owner is responsible for determining and documenting the applicable tax treatment of the solar assets, including Capital Cost Allowance (CCA &mdash; Class 43.1/43.2) and the federal Clean Energy Investment Tax Credit."
      ),
    },
    {
      ref: "SC-24",
      title: t("Avis", "Notices"),
      text: t(
        "(a) Forme : Tous les avis requis ou permis en vertu du pr&eacute;sent Contrat seront donn&eacute;s par &eacute;crit et transmis par courrier recommand&eacute;, messagerie avec accus&eacute; de r&eacute;ception ou courriel avec confirmation de r&eacute;ception. (b) Adresses : Les avis seront envoy&eacute;s aux adresses indiqu&eacute;es &agrave; la page de signatures ou &agrave; toute autre adresse communiqu&eacute;e par avis conforme. (c) R&eacute;ception pr&eacute;sum&eacute;e : Les avis seront r&eacute;put&eacute;s re&ccedil;us : (i) le jour de la livraison s'ils sont remis en personne ou par messagerie; (ii) le troisi&egrave;me (3e) jour ouvrable suivant la mise &agrave; la poste par courrier recommand&eacute;; (iii) le jour ouvrable suivant l'envoi par courriel si la r&eacute;ception est confirm&eacute;e.",
        "(a) Form: All notices required or permitted under this Contract shall be in writing and delivered by registered mail, courier with acknowledgment of receipt, or email with confirmation of receipt. (b) Addresses: Notices shall be sent to the addresses set out on the signature page or to such other address as communicated by proper notice. (c) Deemed Receipt: Notices shall be deemed received: (i) on the date of delivery if delivered in person or by courier; (ii) on the third (3rd) Business Day following mailing by registered mail; (iii) on the Business Day following sending by email if receipt is confirmed."
      ),
    },
    {
      ref: "SC-25 &mdash; CG 8.1",
      title: t("R&egrave;glement des diff&eacute;rends", "Dispute Resolution"),
      text: t(
        "Tout diff&eacute;rend sera d'abord soumis &agrave; la n&eacute;gociation de bonne foi entre les repr&eacute;sentants autoris&eacute;s des parties pendant une p&eacute;riode de quinze (15) jours ouvrables. &Agrave; d&eacute;faut de r&eacute;solution, le diff&eacute;rend sera soumis &agrave; la m&eacute;diation administr&eacute;e par l'Institut de m&eacute;diation et d'arbitrage du Qu&eacute;bec (IMAQ). Si la m&eacute;diation &eacute;choue dans les trente (30) jours, le diff&eacute;rend sera soumis &agrave; l'arbitrage conform&eacute;ment au Code de proc&eacute;dure civile du Qu&eacute;bec (art.&nbsp;620 et suivants). Le si&egrave;ge de l'arbitrage sera Montr&eacute;al. La d&eacute;cision arbitrale sera finale et sans appel.",
        "Any dispute shall first be submitted to good faith negotiation between the authorized representatives of the parties for a period of fifteen (15) Working Days. Failing resolution, the dispute shall be submitted to mediation administered by the Institut de m&eacute;diation et d'arbitrage du Qu&eacute;bec (IMAQ). If mediation fails within thirty (30) days, the dispute shall be submitted to arbitration in accordance with the Code of Civil Procedure of Qu&eacute;bec (art.&nbsp;620 et seq.). The seat of arbitration shall be Montr&eacute;al. The arbitral award shall be final and binding."
      ),
    },
    {
      ref: "SC-26",
      title: t("Droit applicable", "Governing Law"),
      text: t(
        "Cette entente est r&eacute;gie par les lois de la Province de Qu&eacute;bec et du Canada, incluant le Code civil du Qu&eacute;bec. Les parties conviennent irr&eacute;vocablement que les tribunaux de Montr&eacute;al auront juridiction exclusive pour toute proc&eacute;dure judiciaire non soumise &agrave; l'arbitrage. La langue officielle du Contrat est le fran&ccedil;ais; en cas de divergence entre les versions fran&ccedil;aise et anglaise, la version fran&ccedil;aise pr&eacute;vaudra.",
        "This agreement is governed by the laws of the Province of Qu&eacute;bec and Canada, including the Civil Code of Qu&eacute;bec. The parties irrevocably agree that the courts of Montr&eacute;al shall have exclusive jurisdiction for any judicial proceedings not submitted to arbitration. The official language of the Contract is French; in case of discrepancy between the French and English versions, the French version shall prevail."
      ),
    },
    {
      ref: "SC-27",
      title: t("Validit&eacute; de l'offre et conditions pr&eacute;alables", "Offer Validity and Conditions Precedent"),
      text: t(
        "(a) Validit&eacute; : Cette offre est valide pour une p&eacute;riode de quatre-vingt-dix (90) jours &agrave; compter de la date du document. (b) Conditions pr&eacute;alables : L'ex&eacute;cution des travaux est assujettie &agrave; : (i) l'obtention des permis municipaux et de la RBQ; (ii) l'approbation de raccordement d'Hydro-Qu&eacute;bec au programme Autoproduction; (iii) la confirmation de l'int&eacute;grit&eacute; structurelle du toit par un ing&eacute;nieur (OIQ); (iv) la signature de la convention de raccordement avec Hydro-Qu&eacute;bec; (v) l'obtention du certificat d'autorisation environnemental, le cas &eacute;ch&eacute;ant.",
        "(a) Validity: This offer is valid for a period of ninety (90) days from the document date. (b) Conditions Precedent: Execution of work is subject to: (i) obtaining municipal permits and RBQ approvals; (ii) Hydro-Qu&eacute;bec interconnection approval under the Self-Generation program; (iii) confirmation of roof structural integrity by a licensed engineer (OIQ); (iv) execution of the interconnection agreement with Hydro-Qu&eacute;bec; (v) obtaining the environmental authorization certificate, if applicable."
      ),
    },
    {
      ref: "SC-28",
      title: t("Survie des clauses", "Survival"),
      text: t(
        "Les clauses suivantes survivront &agrave; l'expiration ou &agrave; la r&eacute;siliation du pr&eacute;sent Contrat, quelle qu'en soit la cause : SC-3 (Confidentialit&eacute;), SC-8 (Garanties), SC-14 (Indemnisation), SC-15 (Hypoth&egrave;ques l&eacute;gales), SC-21 (Propri&eacute;t&eacute; intellectuelle), SC-22 (Limitation de responsabilit&eacute;), SC-25 (R&egrave;glement des diff&eacute;rends), SC-26 (Droit applicable) et la pr&eacute;sente clause SC-28. La survie des clauses ne sera pas affect&eacute;e par l'ach&egrave;vement substantiel ni par le paiement final.",
        "The following clauses shall survive the expiry or termination of this Contract, regardless of the cause: SC-3 (Confidentiality), SC-8 (Warranties), SC-14 (Indemnification), SC-15 (Liens and Claims), SC-21 (Intellectual Property), SC-22 (Limitation of Liability), SC-25 (Dispute Resolution), SC-26 (Governing Law) and the present clause SC-28. Survival of clauses shall not be affected by Substantial Performance or final payment."
      ),
    },
  ];

  const articlesPerPage = 3;
  const totalPages = Math.ceil(allArticles.length / articlesPerPage);

  for (let p = 0; p < totalPages; p++) {
    const batch = allArticles.slice(p * articlesPerPage, (p + 1) * articlesPerPage);
    const isFirstPage = p === 0;

    const headerHtml = isFirstPage ? `
    <div class="section-num">8</div>
    <h2>${t("Conditions Suppl&eacute;mentaires au CCDC&nbsp;14 (2013)", "Supplementary Conditions to CCDC&nbsp;14 (2013)")}</h2>
    <p style="font-size: 9pt; color: var(--gray); margin-bottom: 4mm;">
      ${t(
        "Les pr&eacute;sentes Conditions suppl&eacute;mentaires (SC-1 &agrave; SC-28) modifient, suppl&eacute;mentent ou remplacent les dispositions de l'Entente entre le Propri&eacute;taire et le Concepteur-Constructeur, ainsi que les Conditions g&eacute;n&eacute;rales du Contrat &agrave; forfait de conception-construction CCDC&nbsp;14 &mdash; 2013. Les dispositions non modifi&eacute;es demeurent en vigueur.",
        "These Supplementary Conditions (SC-1 through SC-28) shall modify, supplement or replace provisions of the Agreement between the Owner and the Design-Builder, and the General Conditions of the Design-Build Stipulated Price Contract, CCDC&nbsp;14 &mdash; 2013. Provisions not modified shall remain in effect."
      )}
    </p>` : `<h3 style="color: var(--primary); margin-bottom: 4mm;">${t("Conditions Suppl&eacute;mentaires (suite)", "Supplementary Conditions (continued)")}</h3>`;

    pages.push(`
  <div class="page-auto">
    ${headerHtml}
    ${batch.map(c => `
      <div class="sc-article">
        <div class="sc-ref">${c.ref}</div>
        <div class="sc-title">${c.title}</div>
        <div class="sc-text">${c.text}</div>
      </div>
    `).join("")}
    ${footerHtml(t, dateStr, startPage + p)}
  </div>`);
  }

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

  const sovPages = buildScheduleOfValuesPages(t, dateStr, pageNum);
  pages.push(...sovPages);
  pageNum += sovPages.length;

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
