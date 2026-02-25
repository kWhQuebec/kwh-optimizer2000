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
.page:last-child { page-break-after: auto; }
h1 { font-size: 28pt; font-weight: 700; color: var(--primary); margin-bottom: 8mm; }
h2 { font-size: 18pt; font-weight: 600; color: var(--primary); margin-bottom: 5mm; padding-bottom: 2mm; border-bottom: 2px solid var(--accent); }
h3 { font-size: 12pt; font-weight: 600; color: var(--dark); margin-bottom: 3mm; }
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
    <div class="cover-subtitle">${t("Proposition Globale &mdash; Installation Solaire Commerciale", "Global Proposal &mdash; Commercial Solar Installation")}</div>
    <div class="cover-client">${data.clientName}</div>
    <div class="cover-stats">${data.numBuildings} sites &bull; ${totalKw} kW DC</div>
    <div class="cover-prepared">${t("Pr&eacute;par&eacute; par", "Prepared by")} kWh Qu&eacute;bec</div>
    <div class="cover-collab">${t("En collaboration avec", "In collaboration with")} ScaleClean Tech</div>
    <div class="cover-date">${dateStr}</div>
    <div class="cover-confidential">${t("Document confidentiel &mdash; Ne pas distribuer", "Confidential document &mdash; Do not distribute")}</div>
  </div>`;
}

function buildTocPage(t: (fr: string, en: string) => string, dateStr: string): string {
  const sections = [
    { num: "1", title: t("Sommaire Ex&eacute;cutif", "Executive Summary") },
    { num: "2", title: t("Parties et R&ocirc;les", "Parties &amp; Roles") },
    { num: "3", title: t("Termes Commerciaux", "Commercial Terms") },
    { num: "4", title: t("Cadre Financier", "Financial Framework") },
    { num: "5", title: t("Annexe A &mdash; Fiches Financi&egrave;res par Site", "Annex A &mdash; Per-Site Financial Schedules") },
    { num: "6", title: t("Conditions G&eacute;n&eacute;rales", "General Conditions") },
    { num: "7", title: t("Signatures", "Signatures") },
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
        <div class="role-type">EPC &amp; O&amp;M</div>
        <div class="role-name">kWh Qu&eacute;bec</div>
        <div class="role-desc">${t(
          "Entrepreneur g&eacute;n&eacute;ral (EPC) responsable de l'ing&eacute;nierie, de l'approvisionnement et de la construction. &Eacute;galement responsable de l'exploitation et la maintenance (O&amp;M) post-construction.",
          "General contractor (EPC) responsible for engineering, procurement and construction. Also responsible for post-construction operations &amp; maintenance (O&amp;M)."
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
    { clause: t("Structure du Contrat", "Contract Structure"), details: t("Entente cadre avec annexes par site", "Master agreement with per-site annexes") },
    { clause: t("Mod&egrave;le Commercial", "Commercial Model"), details: t("PPA (Power Purchase Agreement) &mdash; vente d'&eacute;nergie", "PPA (Power Purchase Agreement) &mdash; energy sale") },
    { clause: t("Dur&eacute;e du PPA", "PPA Duration"), details: t("25 ans, avec option de prolongation", "25 years, with extension option") },
    { clause: t("Indexation Annuelle", "Annual Escalation"), details: t("Selon l'indice d&eacute;fini par site", "Per site-defined escalation index") },
    { clause: t("Garantie de Performance", "Performance Guarantee"), details: t("Ratio de performance minimum de 80&nbsp;% garanti", "Minimum 80% performance ratio guaranteed") },
    { clause: t("P&eacute;nalit&eacute; de Sous-Performance", "Underperformance Penalty"), details: t("Cr&eacute;dit &eacute;nerg&eacute;tique pour production sous 80&nbsp;% du P50", "Energy credit for production below 80% of P50") },
    { clause: t("Assurance", "Insurance"), details: t("Couverture tous risques construction + responsabilit&eacute; professionnelle", "All-risk construction coverage + professional liability") },
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
    </div>
    ${footerHtml(t, dateStr, pageNum)}
  </div>`;
}

function buildGeneralConditionsPage(t: (fr: string, en: string) => string, dateStr: string, pageNum: number): string {
  const conditions = [
    {
      num: "6.1",
      title: t("Validit&eacute; de l'Offre", "Offer Validity"),
      text: t(
        "Cette offre est valide pour une p&eacute;riode de 90 jours &agrave; compter de la date du document.",
        "This offer is valid for a period of 90 days from the document date."
      ),
    },
    {
      num: "6.2",
      title: t("Conditions Pr&eacute;alables", "Conditions Precedent"),
      text: t(
        "L'ex&eacute;cution des travaux est assujettie &agrave; l'obtention des permis municipaux, &agrave; l'approbation d'interconnexion d'Hydro-Qu&eacute;bec et &agrave; la confirmation de l'int&eacute;grit&eacute; structurelle du toit.",
        "Execution of work is subject to obtaining municipal permits, Hydro-Qu&eacute;bec interconnection approval and confirmation of roof structural integrity."
      ),
    },
    {
      num: "6.3",
      title: t("Garanties", "Warranties"),
      text: t(
        "Panneaux : 25 ans de performance lin&eacute;aire. Onduleurs : 15 ans (extensible &agrave; 25). Main-d'&oelig;uvre : 10 ans.",
        "Panels: 25-year linear performance. Inverters: 15 years (extendable to 25). Workmanship: 10 years."
      ),
    },
    {
      num: "6.4",
      title: t("R&eacute;siliation", "Termination"),
      text: t(
        "L'une ou l'autre des parties peut r&eacute;silier avec un pr&eacute;avis &eacute;crit de 90 jours en cas de manquement mat&eacute;riel non rem&eacute;di&eacute; dans les 60 jours suivant la notification.",
        "Either party may terminate with 90 days' written notice in case of material breach not remedied within 60 days of notification."
      ),
    },
    {
      num: "6.5",
      title: t("Droit Applicable", "Governing Law"),
      text: t(
        "Cette entente est r&eacute;gie par les lois de la Province de Qu&eacute;bec et du Canada. Tout diff&eacute;rend sera soumis aux tribunaux de Montr&eacute;al.",
        "This agreement is governed by the laws of the Province of Quebec and Canada. Any dispute shall be submitted to the courts of Montreal."
      ),
    },
    {
      num: "6.6",
      title: t("Force Majeure", "Force Majeure"),
      text: t(
        "Aucune des parties ne sera tenue responsable des retards ou de l'incapacit&eacute; d'ex&eacute;cuter r&eacute;sultant de circonstances hors de son contr&ocirc;le raisonnable.",
        "Neither party shall be held liable for delays or inability to perform resulting from circumstances beyond its reasonable control."
      ),
    },
  ];

  return `
  <div class="page">
    <div class="section-num">6</div>
    <h2>${t("Conditions G&eacute;n&eacute;rales", "General Conditions")}</h2>
    <div class="conditions-list">
      ${conditions.map(c => `
        <div class="condition-item">
          <div class="condition-num">${c.num}</div>
          <div class="condition-title">${c.title}</div>
          <div class="condition-text">${c.text}</div>
        </div>
      `).join("")}
    </div>
    ${footerHtml(t, dateStr, pageNum)}
  </div>`;
}

function buildSignaturesPage(t: (fr: string, en: string) => string, dateStr: string, pageNum: number): string {
  return `
  <div class="page">
    <div class="section-num">7</div>
    <h2>${t("Signatures", "Signatures")}</h2>
    <p style="font-size: 10pt; color: var(--gray); margin-bottom: 8mm;">
      ${t(
        "EN FOI DE QUOI, les parties ont sign&eacute; cette entente cadre &agrave; la date indiqu&eacute;e ci-dessous.",
        "IN WITNESS WHEREOF, the parties have signed this master agreement on the date indicated below."
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
        "Ce document constitue une offre formelle et non un contrat contraignant. L'entente d&eacute;finitive sera formalis&eacute;e par la signature des deux parties du contrat d&eacute;finitif incluant toutes les annexes par site.",
        "This document constitutes a formal offer and not a binding contract. The final agreement will be formalized by both parties signing the definitive contract including all per-site annexes."
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

  let pageNum = 1;
  const pages: string[] = [];

  pages.push(buildCoverPage(data, t, dateStr, logoBase64));

  pages.push(buildTocPage(t, dateStr));
  pageNum++;

  pages.push(buildExecutiveSummaryPage(data, t, dateStr));
  pageNum++;

  pages.push(buildPartiesPage(t, dateStr));
  pageNum++;

  pages.push(buildCommercialTermsPage(t, dateStr));
  pageNum++;

  pages.push(buildFinancialFrameworkPage(data, t, dateStr));
  pageNum++;

  const sitesWithFm = data.sites.filter(s => !!s.financialModel);
  sitesWithFm.forEach((site, idx) => {
    pageNum++;
    pages.push(buildAnnexPage(site, idx, sitesWithFm.length, t, dateStr, pageNum));
  });

  pageNum++;
  pages.push(buildGeneralConditionsPage(t, dateStr, pageNum));

  pageNum++;
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
