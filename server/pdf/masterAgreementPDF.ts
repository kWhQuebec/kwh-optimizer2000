import { COLORS } from "./types";
import {
  formatSmartPower,
  formatSmartEnergy,
  formatSmartCurrency,
  formatCurrency,
  formatPercent,
} from "./helpers";
import path from "path";
import type { SiteFinancialModel } from "@shared/schema";

export interface MasterAgreementSiteData {
  siteName: string;
  address?: string;
  city?: string;
  financialModel: SiteFinancialModel;
}

export interface MasterAgreementData {
  name: string;
  clientName: string;
  description?: string;
  numBuildings: number;
  volumeDiscountPercent: number | null;
  // Aggregate KPIs
  totalPvSizeKW: number | null;
  totalBatteryKWh: number | null;
  totalCapexNet: number | null;
  totalNpv25: number | null;
  totalAnnualSavings: number | null;
  totalCo2Avoided: number | null;
  // Sites with financial models
  sites: MasterAgreementSiteData[];
}

interface PDFContext {
  doc: PDFKit.PDFDocument;
  lang: "fr" | "en";
  t: (fr: string, en: string) => string;
  pageWidth: number;
  pageHeight: number;
  margin: number;
  contentWidth: number;
}

function createContext(doc: PDFKit.PDFDocument, lang: "fr" | "en"): PDFContext {
  const t = (fr: string, en: string) => (lang === "fr" ? fr : en);
  return {
    doc,
    lang,
    t,
    pageWidth: 612,
    pageHeight: 792,
    margin: 50,
    contentWidth: 512,
  };
}

/** Check if content fits on current page; if not, add a new page and return true */
function ensureContentFits(ctx: PDFContext, requiredHeight: number): boolean {
  const { doc, pageHeight, margin } = ctx;
  if (doc.y + requiredHeight > pageHeight - 50) {
    doc.addPage();
    doc.y = margin + 10;
    return true;
  }
  return false;
}

function drawMasterHeader(ctx: PDFContext, subtitle?: string) {
  const { doc, margin, pageWidth } = ctx;

  // Blue header background
  doc.rect(0, 0, pageWidth, 100).fill(COLORS.blue);
  doc.rect(0, 96, pageWidth, 4).fill(COLORS.gold);

  // Logo
  try {
    const logoPath = path.join(process.cwd(), "client", "public", "assets", ctx.lang === "fr" ? "logo-fr-white.png" : "logo-en-white.png");
    doc.image(logoPath, margin, 10, { width: 120 });
  } catch {
    doc.fontSize(20).fillColor(COLORS.white).font("Helvetica-Bold");
    doc.text("kWh Québec", margin, 20);
  }

  // Title
  doc.fontSize(16).fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text(subtitle || ctx.t("Entente Cadre", "Master Agreement"), margin, 55);

  doc.fontSize(10).fillColor(COLORS.gold).font("Helvetica");
  doc.text("Dream Industrial REIT — Hydro-Québec RFP", margin, 78);
}

function drawCoverPage(ctx: PDFContext, data: MasterAgreementData) {
  const { doc, margin, contentWidth, pageHeight, t } = ctx;

  drawMasterHeader(ctx);

  let y = 130;

  // Subtitle
  doc.fontSize(16).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Entente Cadre EPC", "Master EPC Agreement"), margin, y);
  y += 30;

  // Portfolio name
  doc.fontSize(14).fillColor(COLORS.darkGray).font("Helvetica");
  doc.text(data.name, margin, y);
  y += 25;

  // Parties
  doc.fontSize(11).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Parties", "Parties"), margin, y);
  y += 20;

  doc.fontSize(10).fillColor(COLORS.darkGray).font("Helvetica");
  doc.text(t("Propriétaire:", "Owner:"), margin, y);
  doc.text("Dream Industrial REIT", margin + 120, y);
  y += 18;

  doc.text(t("Ingénierie et Exploitation:", "EPC & Operations:"), margin, y);
  doc.text("kWh Québec", margin + 180, y);
  y += 18;

  doc.text(t("Consultant RFP:", "RFP Consultant:"), margin, y);
  doc.text("ScaleClean Tech", margin + 150, y);
  y += 40;

  // Portfolio summary
  doc.fontSize(11).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Résumé du Portfolio", "Portfolio Summary"), margin, y);
  y += 20;

  doc.fontSize(10).fillColor(COLORS.darkGray).font("Helvetica");
  const summaryItems = [
    { label: t("Nombre de bâtiments:", "Number of buildings:"), value: String(data.numBuildings) },
    { label: t("Taille PV totale:", "Total PV size:"), value: formatSmartPower(data.totalPvSizeKW, ctx.lang, "kW") },
    { label: t("Stockage total:", "Total storage:"), value: formatSmartEnergy(data.totalBatteryKWh, ctx.lang) },
    { label: t("CAPEX Net:", "Net CAPEX:"), value: formatSmartCurrency(data.totalCapexNet, ctx.lang) },
    { label: "NPV (25 ans):", value: formatSmartCurrency(data.totalNpv25, ctx.lang) },
    { label: t("Économies annuelles:", "Annual savings:"), value: formatSmartCurrency(data.totalAnnualSavings, ctx.lang) },
    { label: t("CO₂ évité par an:", "CO₂ avoided per year:"), value: `${(data.totalCo2Avoided ?? 0).toLocaleString("fr-CA", { maximumFractionDigits: 1 })} t` },
  ];

  summaryItems.forEach((item) => {
    doc.text(item.label, margin, y);
    doc.text(item.value, margin + 250, y);
    y += 18;
  });

  // Footer
  y = pageHeight - 50;
  doc.fontSize(8).fillColor(COLORS.lightGray);
  doc.text(t("Document confidentiel | kWh Québec", "Confidential document | kWh Québec"), margin, y, {
    align: "center",
    width: contentWidth,
  });
}

function drawTableOfContents(ctx: PDFContext) {
  const { doc, margin, contentWidth, pageHeight, t } = ctx;

  drawMasterHeader(ctx);

  let y = 130;

  doc.fontSize(16).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Table des matières", "Table of Contents"), margin, y);
  y += 30;

  const sections = [
    { num: "1", title: t("Introduction et Champ d'Application", "Introduction & Scope") },
    { num: "2", title: t("Spécifications du Projet", "Project Specifications") },
    { num: "3", title: t("Tarification et Coûts", "Pricing & Costs") },
    { num: "4", title: t("Cadre Financier", "Financial Framework") },
    { num: "5", title: t("Coûts d'Exploitation et Maintenance", "Operating Costs & Maintenance") },
    { num: "6", title: t("Crédit d'Impôt aux Investissements", "Investment Tax Credit (ITC)") },
    { num: "7", title: t("Termes et Conditions", "Terms & Conditions") },
    { num: "A", title: t("Annexe A - Détails par Site", "Annex A - Site Details") },
  ];

  doc.fontSize(11).fillColor(COLORS.darkGray).font("Helvetica");
  sections.forEach((section) => {
    doc.text(`${section.num}. ${section.title}`, margin + 20, y);
    y += 22;
  });

  // Footer
  y = pageHeight - 50;
  doc.fontSize(8).fillColor(COLORS.lightGray);
  doc.text(t("Document confidentiel | kWh Québec", "Confidential document | kWh Québec"), margin, y, {
    align: "center",
    width: contentWidth,
  });
}

function drawSection1(ctx: PDFContext, data: MasterAgreementData) {
  const { doc, margin, contentWidth, pageHeight, t } = ctx;

  drawMasterHeader(ctx);

  let y = 130;

  doc.fontSize(16).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Section 1 : Introduction et Champ d'Application", "Section 1: Introduction & Scope"), margin, y);
  y += 30;

  doc.fontSize(11).fillColor(COLORS.darkGray).font("Helvetica");
  const introText = t(
    "Cette entente cadre établit les conditions et modalités d'exécution des services d'ingénierie, d'approvisionnement et de construction (EPC) pour un portfolio de systèmes solaires photovoltaïques auprès de Dream Industrial REIT. Les services couvrent la conception complète, l'approvisionnement des équipements, la construction et la mise en service des installations solaires sur l'ensemble des bâtiments du portfolio.",
    "This Master Agreement establishes the conditions and terms for the execution of Engineering, Procurement and Construction (EPC) services for a portfolio of photovoltaic solar systems with Dream Industrial REIT. Services include complete design, equipment procurement, construction and commissioning of solar installations across all portfolio buildings."
  );

  doc.fontSize(10);
  doc.text(introText, margin, y, { width: contentWidth, align: "justify" });
  y += doc.heightOfString(introText, { width: contentWidth }) + 20;

  // Scope
  doc.fontSize(11).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Champ d'Application", "Scope"), margin, y);
  y += 18;

  doc.fontSize(10).fillColor(COLORS.darkGray).font("Helvetica");
  const scopeItems = [
    t("Analyse et optimisation du design solaire", "Solar design analysis and optimization"),
    t("Sélection et approvisionnement de l'équipement", "Equipment selection and procurement"),
    t("Services de construction et d'installation", "Construction and installation services"),
    t("Tests de système et mise en service", "System testing and commissioning"),
    t("Documentation technique et garanties", "Technical documentation and warranties"),
  ];

  scopeItems.forEach((item) => {
    doc.text(`• ${item}`, margin + 15, y);
    y += 16;
  });

  // Footer
  y = pageHeight - 50;
  doc.fontSize(8).fillColor(COLORS.lightGray);
  doc.text(t("Document confidentiel | kWh Québec", "Confidential document | kWh Québec"), margin, y, {
    align: "center",
    width: contentWidth,
  });
}

function drawSection2(ctx: PDFContext, data: MasterAgreementData) {
  const { doc, margin, contentWidth, pageHeight, t } = ctx;

  drawMasterHeader(ctx);

  let y = 130;

  doc.fontSize(16).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Section 2 : Spécifications du Projet", "Section 2: Project Specifications"), margin, y);
  y += 30;

  doc.fontSize(11).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Résumé du Portfolio", "Portfolio Summary"), margin, y);
  y += 20;

  // Summary table
  const tableData = [
    [t("Paramètre", "Parameter"), t("Valeur", "Value")],
    [t("Nombre de bâtiments", "Number of buildings"), String(data.numBuildings)],
    [t("Taille PV totale (kW)", "Total PV size (kW)"), formatSmartPower(data.totalPvSizeKW, ctx.lang, "kW")],
    [t("Stockage total (kWh)", "Total storage (kWh)"), formatSmartEnergy(data.totalBatteryKWh, ctx.lang)],
    [t("Production annuelle estimée (kWh)", "Estimated annual production (kWh)"), "—"],
  ];

  doc.fontSize(9).fillColor(COLORS.darkGray).font("Helvetica");

  const colWidth = [280, 200];
  let cellY = y;

  // Header row
  doc.rect(margin, cellY, colWidth[0], 18).fill(COLORS.blue);
  doc.rect(margin + colWidth[0], cellY, colWidth[1], 18).fill(COLORS.blue);

  doc.fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text(tableData[0][0], margin + 8, cellY + 5, { width: colWidth[0] - 16 });
  doc.text(tableData[0][1], margin + colWidth[0] + 8, cellY + 5, { width: colWidth[1] - 16, align: "right" });

  cellY += 18;

  // Data rows
  doc.fillColor(COLORS.darkGray).font("Helvetica");
  for (let i = 1; i < tableData.length; i++) {
    const bgColor = i % 2 === 0 ? "#FFFFFF" : "#F9F9F9";
    doc.rect(margin, cellY, colWidth[0], 16).fill(bgColor);
    doc.rect(margin + colWidth[0], cellY, colWidth[1], 16).fill(bgColor);

    doc.text(tableData[i][0], margin + 8, cellY + 3, { width: colWidth[0] - 16 });
    doc.text(tableData[i][1], margin + colWidth[0] + 8, cellY + 3, { width: colWidth[1] - 16, align: "right" });

    cellY += 16;
  }

  // Footer
  y = pageHeight - 50;
  doc.fontSize(8).fillColor(COLORS.lightGray);
  doc.text(t("Document confidentiel | kWh Québec", "Confidential document | kWh Québec"), margin, y, {
    align: "center",
    width: contentWidth,
  });
}

function drawSection3(ctx: PDFContext, data: MasterAgreementData) {
  const { doc, margin, contentWidth, pageHeight, t } = ctx;

  drawMasterHeader(ctx);

  let y = 130;

  doc.fontSize(16).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Section 3 : Tarification et Coûts", "Section 3: Pricing & Costs"), margin, y);
  y += 30;

  doc.fontSize(11).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Coûts Agrégés du Portfolio", "Portfolio Aggregate Costs"), margin, y);
  y += 20;

  doc.fontSize(10).fillColor(COLORS.darkGray).font("Helvetica");
  doc.text(t("CAPEX Net Total:", "Total Net CAPEX:"), margin, y);
  doc.text(formatSmartCurrency(data.totalCapexNet, ctx.lang), margin + 350, y, { align: "right", width: 150 });
  y += 18;

  const pvSize = data.totalPvSizeKW ?? 0;
  const costPerW = pvSize > 0 && data.totalCapexNet ? data.totalCapexNet / pvSize / 1000 : 0;
  doc.text(t("Coût par Watt:", "Cost per Watt:"), margin, y);
  doc.text(`${costPerW.toFixed(2)} $/W`, margin + 350, y, { align: "right", width: 150 });
  y += 18;

  if (data.volumeDiscountPercent && data.volumeDiscountPercent > 0) {
    doc.text(t("Rabais Volume:", "Volume Discount:"), margin, y);
    doc.text(formatPercent(data.volumeDiscountPercent), margin + 350, y, { align: "right", width: 150 });
    y += 20;
  }

  // Footer
  y = pageHeight - 50;
  doc.fontSize(8).fillColor(COLORS.lightGray);
  doc.text(t("Document confidentiel | kWh Québec", "Confidential document | kWh Québec"), margin, y, {
    align: "center",
    width: contentWidth,
  });
}

function drawSection4(ctx: PDFContext, data: MasterAgreementData) {
  const { doc, margin, contentWidth, pageHeight, t } = ctx;

  drawMasterHeader(ctx);

  let y = 130;

  doc.fontSize(16).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Section 4 : Cadre Financier", "Section 4: Financial Framework"), margin, y);
  y += 30;

  doc.fontSize(11).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Métriques Financières du Portfolio", "Portfolio Financial Metrics"), margin, y);
  y += 20;

  doc.fontSize(10).fillColor(COLORS.darkGray).font("Helvetica");
  doc.text(t("NPV (25 ans):", "NPV (25 years):"), margin, y);
  doc.text(formatSmartCurrency(data.totalNpv25, ctx.lang), margin + 350, y, { align: "right", width: 150 });
  y += 18;

  doc.text(t("Économies Annuelles:", "Annual Savings:"), margin, y);
  doc.text(formatSmartCurrency(data.totalAnnualSavings, ctx.lang), margin + 350, y, { align: "right", width: 150 });
  y += 18;

  const paybackYears = data.totalCapexNet && data.totalAnnualSavings ? data.totalCapexNet / data.totalAnnualSavings : 0;
  doc.text(t("Période de Récupération (ans):", "Payback Period (years):"), margin, y);
  doc.text(paybackYears.toFixed(1), margin + 350, y, { align: "right", width: 150 });
  y += 20;

  // Footer
  y = pageHeight - 50;
  doc.fontSize(8).fillColor(COLORS.lightGray);
  doc.text(t("Document confidentiel | kWh Québec", "Confidential document | kWh Québec"), margin, y, {
    align: "center",
    width: contentWidth,
  });
}

function drawSection5(ctx: PDFContext, data: MasterAgreementData) {
  const { doc, margin, contentWidth, pageHeight, t } = ctx;

  drawMasterHeader(ctx);

  let y = 130;

  doc.fontSize(16).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Section 5 : Coûts d'Exploitation et Maintenance", "Section 5: Operating Costs & Maintenance"), margin, y);
  y += 30;

  doc.fontSize(11).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Structure des Coûts d'Exploitation", "Operating Cost Structure"), margin, y);
  y += 20;

  doc.fontSize(10).fillColor(COLORS.darkGray).font("Helvetica");

  const ocItems = [
    {
      label: t("Taux de Maintenance et Exploitation (O&M):", "Operations & Maintenance (O&M) Rate:"),
      value: "0.50 %–0.75 % / an",
    },
    {
      label: t("Coûts Opérationnels Variables:", "Variable Operating Costs:"),
      value: t("$50–$100/kW/an", "$50–$100/kW/year"),
    },
    {
      label: t("Taux d'Inflation:", "Inflation Rate:"),
      value: "2.0 % / an",
    },
  ];

  ocItems.forEach((item) => {
    doc.text(item.label, margin, y);
    doc.text(item.value, margin + 350, y, { align: "right", width: 150 });
    y += 18;
  });

  y += 10;

  doc.fontSize(11).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Détails par Site", "Site-Specific Details"), margin, y);
  y += 18;

  doc.fontSize(9).fillColor(COLORS.darkGray).font("Helvetica");
  doc.text(
    t(
      "Les coûts d'exploitation détaillés pour chaque site sont présentés dans l'Annexe A.",
      "Detailed operating costs for each site are presented in Annex A."
    ),
    margin,
    y
  );

  // Footer
  y = pageHeight - 50;
  doc.fontSize(8).fillColor(COLORS.lightGray);
  doc.text(t("Document confidentiel | kWh Québec", "Confidential document | kWh Québec"), margin, y, {
    align: "center",
    width: contentWidth,
  });
}

function drawSection6(ctx: PDFContext) {
  const { doc, margin, contentWidth, pageHeight, t } = ctx;

  drawMasterHeader(ctx);

  let y = 130;

  doc.fontSize(16).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(
    t("Section 6 : Crédit d'Impôt aux Investissements (CII)", "Section 6: Investment Tax Credit (ITC)"),
    margin,
    y
  );
  y += 30;

  doc.fontSize(11).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Éligibilité et Calcul du CII", "ITC Eligibility and Calculation"), margin, y);
  y += 20;

  doc.fontSize(10).fillColor(COLORS.darkGray).font("Helvetica");

  const itcItems = [
    { label: t("Systèmes Admissibles:", "Eligible Systems:"), value: t("Modules et onduleurs", "Modules and inverters") },
    { label: t("Taux du CII:", "ITC Rate:"), value: "30 %" },
    { label: t("Restriction de Clawback HQ:", "HQ Clawback Restriction:"), value: t("S/O", "N/A") },
  ];

  itcItems.forEach((item) => {
    doc.text(item.label, margin, y);
    doc.text(item.value, margin + 300, y, { align: "right", width: 200 });
    y += 18;
  });

  y += 10;

  doc.fontSize(11).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Détails par Site", "Site-Specific Details"), margin, y);
  y += 18;

  doc.fontSize(9).fillColor(COLORS.darkGray).font("Helvetica");
  doc.text(
    t(
      "Le calcul détaillé du CII pour chaque site est présenté dans l'Annexe A.",
      "Detailed ITC calculation for each site is presented in Annex A."
    ),
    margin,
    y
  );

  // Footer
  y = pageHeight - 50;
  doc.fontSize(8).fillColor(COLORS.lightGray);
  doc.text(t("Document confidentiel | kWh Québec", "Confidential document | kWh Québec"), margin, y, {
    align: "center",
    width: contentWidth,
  });
}

function drawSection7(ctx: PDFContext) {
  const { doc, margin, contentWidth, pageHeight, t } = ctx;

  drawMasterHeader(ctx);

  let y = 130;

  doc.fontSize(16).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Section 7 : Termes et Conditions", "Section 7: Terms & Conditions"), margin, y);
  y += 30;

  doc.fontSize(11).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Calendrier Général", "General Timeline"), margin, y);
  y += 20;

  doc.fontSize(10).fillColor(COLORS.darkGray).font("Helvetica");

  const timelineItems = [
    { step: t("Approbation et Signature", "Approval & Signature"), duration: t("Semaine 1", "Week 1") },
    { step: t("Design Détaillé", "Detailed Design"), duration: t("Semaines 2–4", "Weeks 2–4") },
    { step: t("Approvisionnement", "Procurement"), duration: t("Semaines 3–6", "Weeks 3–6") },
    { step: t("Construction", "Construction"), duration: t("Semaines 5–12", "Weeks 5–12") },
    { step: t("Mise en Service", "Commissioning"), duration: t("Semaines 11–13", "Weeks 11–13") },
  ];

  timelineItems.forEach((item) => {
    doc.text(item.step, margin, y);
    doc.text(item.duration, margin + 350, y, { align: "right", width: 150 });
    y += 18;
  });

  y += 10;

  doc.fontSize(11).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Garanties", "Warranties"), margin, y);
  y += 18;

  doc.fontSize(10).fillColor(COLORS.darkGray).font("Helvetica");
  const warrantyItems = [
    t("Modules photovoltaïques : 25 ans", "Photovoltaic modules: 25 years"),
    t("Onduleurs : 10 ans", "Inverters: 10 years"),
    t("Travaux de construction : 1 an", "Construction workmanship: 1 year"),
  ];

  warrantyItems.forEach((item) => {
    doc.text(`• ${item}`, margin + 15, y);
    y += 16;
  });

  // Footer
  y = pageHeight - 50;
  doc.fontSize(8).fillColor(COLORS.lightGray);
  doc.text(t("Document confidentiel | kWh Québec", "Confidential document | kWh Québec"), margin, y, {
    align: "center",
    width: contentWidth,
  });
}

function drawAnnexASite(ctx: PDFContext, site: MasterAgreementSiteData, siteIndex: number, totalSites: number) {
  const { doc, margin, contentWidth, pageHeight, t } = ctx;

  drawMasterHeader(ctx);

  let y = 130;

  // Site title
  doc.fontSize(14).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(
    t(`Annexe A - Site ${siteIndex + 1}/${totalSites}: ${site.siteName}`, `Annex A - Site ${siteIndex + 1}/${totalSites}: ${site.siteName}`),
    margin,
    y
  );
  y += 22;

  // Site address
  doc.fontSize(10).fillColor(COLORS.darkGray).font("Helvetica");
  if (site.address) {
    doc.text(`${site.address}, ${site.city || ""}`, margin, y);
    y += 18;
  }

  y += 10;

  const fm = site.financialModel;

  // ===== PROJECT SPECIFICATIONS =====
  doc.fontSize(11).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Spécifications du Projet", "Project Specifications"), margin, y);
  y += 18;

  doc.fontSize(9).fillColor(COLORS.darkGray).font("Helvetica");

  const specs = [
    [t("Paramètre", "Parameter"), t("Valeur", "Value")],
    [t("Taille DC (kW)", "DC Size (kW)"), formatSmartPower(fm.projectSpecs.projectSizeDcKw, ctx.lang, "kW")],
    [t("Taille AC (kW)", "AC Size (kW)"), formatSmartPower(fm.projectSpecs.projectSizeAcKw, ctx.lang, "kW")],
    [t("Rendement (kWh/kWp)", "Yield (kWh/kWp)"), formatSmartEnergy(fm.projectSpecs.yieldKwhPerKwp, ctx.lang, "Wh")],
    [t("Prod. an 1 (kWh)", "Year 1 Production (kWh)"), formatSmartEnergy(fm.projectSpecs.firstYearKwh, ctx.lang)],
    [t("Dégradation (%/an)", "Degradation (%/yr)"), formatPercent(fm.projectSpecs.degradationPct)],
    [t("Hypothèse de disponibilité (%)", "Availability Assumption (%)"), formatPercent(fm.projectSpecs.availabilityPct)],
    [t("Durée de vie utile (ans)", "Useful Life (years)"), String(fm.projectSpecs.usefulLifeYears || "—")],
  ];

  const colWidths = [250, 240];
  let cellY = y;

  // Header
  doc.rect(margin, cellY, colWidths[0], 16).fill(COLORS.blue);
  doc.rect(margin + colWidths[0], cellY, colWidths[1], 16).fill(COLORS.blue);

  doc.fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text(specs[0][0], margin + 6, cellY + 3, { width: colWidths[0] - 12 });
  doc.text(specs[0][1], margin + colWidths[0] + 6, cellY + 3, { width: colWidths[1] - 12, align: "right" });

  cellY += 16;

  // Data rows
  doc.fillColor(COLORS.darkGray).font("Helvetica");
  for (let i = 1; i < specs.length; i++) {
    const bgColor = i % 2 === 0 ? "#FFFFFF" : "#F9F9F9";
    doc.rect(margin, cellY, colWidths[0], 14).fill(bgColor);
    doc.rect(margin + colWidths[0], cellY, colWidths[1], 14).fill(bgColor);

    doc.text(specs[i][0], margin + 6, cellY + 2, { width: colWidths[0] - 12 });
    doc.text(specs[i][1], margin + colWidths[0] + 6, cellY + 2, { width: colWidths[1] - 12, align: "right" });

    cellY += 14;
  }

  y = cellY + 18;

  // ===== PROJECT COSTS =====
  if (ensureContentFits(ctx, 200)) {
    y = margin + 20;
  }

  doc.fontSize(11).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Coûts du Projet", "Project Costs"), margin, y);
  y += 18;

  doc.fontSize(9).fillColor(COLORS.darkGray).font("Helvetica");

  const costs = [
    [t("Paramètre", "Parameter"), t("Valeur", "Value")],
    [t("Coût install./W ($)", "Install cost/W ($)"), formatCurrency(fm.projectCosts.installCostPerW)],
    [t("Coûts de construction ($)", "Construction costs ($)"), formatCurrency(fm.projectCosts.constructionCosts)],
    [t("Frais municipaux ($)", "Municipal fees ($)"), formatCurrency(fm.projectCosts.municipalFees)],
    [t("Coûts d'interconnexion ($)", "Interconnection cost ($)"), formatCurrency(fm.projectCosts.interconnectionCost)],
    [t("Coûts totaux du projet ($)", "Total project cost ($)"), formatCurrency(fm.projectCosts.totalProjectCost)],
    [t("Coûts tout compris ($)", "All-in costs ($)"), formatCurrency(fm.projectCosts.allInCosts)],
    [t("Coûts du projet/W ($)", "Project cost/W ($)"), formatCurrency(fm.projectCosts.projectCostPerW)],
  ];

  cellY = y;

  // Header
  doc.rect(margin, cellY, colWidths[0], 16).fill(COLORS.blue);
  doc.rect(margin + colWidths[0], cellY, colWidths[1], 16).fill(COLORS.blue);

  doc.fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text(costs[0][0], margin + 6, cellY + 3, { width: colWidths[0] - 12 });
  doc.text(costs[0][1], margin + colWidths[0] + 6, cellY + 3, { width: colWidths[1] - 12, align: "right" });

  cellY += 16;

  // Data rows
  doc.fillColor(COLORS.darkGray).font("Helvetica");
  for (let i = 1; i < costs.length; i++) {
    const bgColor = i % 2 === 0 ? "#FFFFFF" : "#F9F9F9";
    doc.rect(margin, cellY, colWidths[0], 14).fill(bgColor);
    doc.rect(margin + colWidths[0], cellY, colWidths[1], 14).fill(bgColor);

    doc.text(costs[i][0], margin + 6, cellY + 2, { width: colWidths[0] - 12 });
    doc.text(costs[i][1], margin + colWidths[0] + 6, cellY + 2, { width: colWidths[1] - 12, align: "right" });

    cellY += 14;
  }

  y = cellY + 18;

  // ===== OPERATING COSTS =====
  if (ensureContentFits(ctx, 180)) {
    y = margin + 20;
  }

  doc.fontSize(11).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Coûts d'Exploitation", "Operating Costs"), margin, y);
  y += 18;

  doc.fontSize(9).fillColor(COLORS.darkGray).font("Helvetica");

  const opCosts = [
    [t("Paramètre", "Parameter"), t("Valeur", "Value")],
    [t("Taux O&M ($/kW/an)", "O&M rate ($/kW/yr)"), formatCurrency(fm.operatingCosts.omRatePerKw)],
    [t("Coûts O&M ($)", "O&M cost ($)"), formatCurrency(fm.operatingCosts.omCost)],
    [t("Coûts opér. var. ($/kW)", "Variable op. costs ($/kW)"), formatCurrency(fm.operatingCosts.variableOpCostPerKw)],
    [t("Coûts opér. var. ($)", "Variable op. cost ($)"), formatCurrency(fm.operatingCosts.variableOpCost)],
    [t("Coûts totaux an 1 ($)", "Total operations yr 1 ($)"), formatCurrency(fm.operatingCosts.totalOperationsCostYr1)],
    [t("Taux d'inflation (% / an)", "Inflation rate (% / yr)"), formatPercent(fm.operatingCosts.inflationRate)],
  ];

  cellY = y;

  // Header
  doc.rect(margin, cellY, colWidths[0], 16).fill(COLORS.blue);
  doc.rect(margin + colWidths[0], cellY, colWidths[1], 16).fill(COLORS.blue);

  doc.fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text(opCosts[0][0], margin + 6, cellY + 3, { width: colWidths[0] - 12 });
  doc.text(opCosts[0][1], margin + colWidths[0] + 6, cellY + 3, { width: colWidths[1] - 12, align: "right" });

  cellY += 16;

  // Data rows
  doc.fillColor(COLORS.darkGray).font("Helvetica");
  for (let i = 1; i < opCosts.length; i++) {
    const bgColor = i % 2 === 0 ? "#FFFFFF" : "#F9F9F9";
    doc.rect(margin, cellY, colWidths[0], 14).fill(bgColor);
    doc.rect(margin + colWidths[0], cellY, colWidths[1], 14).fill(bgColor);

    doc.text(opCosts[i][0], margin + 6, cellY + 2, { width: colWidths[0] - 12 });
    doc.text(opCosts[i][1], margin + colWidths[0] + 6, cellY + 2, { width: colWidths[1] - 12, align: "right" });

    cellY += 14;
  }

  y = cellY + 18;

  // ===== ITC =====
  if (ensureContentFits(ctx, 160)) {
    y = margin + 20;
  }

  doc.fontSize(11).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Crédit d'Impôt aux Investissements (CII)", "Investment Tax Credit (ITC)"), margin, y);
  y += 18;

  doc.fontSize(9).fillColor(COLORS.darkGray).font("Helvetica");

  const itcRows = [
    [t("Paramètre", "Parameter"), t("Valeur", "Value")],
    [t("Éligibilité", "Eligibility"), fm.itc.itcEligible ? t("Oui", "Yes") : t("Non", "No")],
    [t("Taux CII (%)", "ITC rate (%)"), formatPercent(fm.itc.itcRate)],
    [t("Hypothèse coûts elig. (%)", "Eligible costs assumption (%)"), formatPercent(fm.itc.eligibleCostsAssumption)],
    [t("Coûts admissibles ($)", "Eligible costs ($)"), formatCurrency(fm.itc.eligibleCosts)],
    [t("Coûts non-admissibles ($)", "Non-eligible costs ($)"), formatCurrency(fm.itc.nonEligibleCosts)],
    [t("Rabais potentiel CII ($)", "Potential ITC rebate ($)"), formatCurrency(fm.itc.potentialItcRebate)],
    [t("Rabais CII effectif ($)", "Effective ITC rebate ($)"), formatCurrency(fm.itc.effectiveItcRebate)],
  ];

  cellY = y;

  // Header
  doc.rect(margin, cellY, colWidths[0], 16).fill(COLORS.blue);
  doc.rect(margin + colWidths[0], cellY, colWidths[1], 16).fill(COLORS.blue);

  doc.fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text(itcRows[0][0], margin + 6, cellY + 3, { width: colWidths[0] - 12 });
  doc.text(itcRows[0][1], margin + colWidths[0] + 6, cellY + 3, { width: colWidths[1] - 12, align: "right" });

  cellY += 16;

  // Data rows
  doc.fillColor(COLORS.darkGray).font("Helvetica");
  for (let i = 1; i < itcRows.length; i++) {
    const bgColor = i % 2 === 0 ? "#FFFFFF" : "#F9F9F9";
    doc.rect(margin, cellY, colWidths[0], 14).fill(bgColor);
    doc.rect(margin + colWidths[0], cellY, colWidths[1], 14).fill(bgColor);

    doc.text(itcRows[i][0], margin + 6, cellY + 2, { width: colWidths[0] - 12 });
    doc.text(itcRows[i][1], margin + colWidths[0] + 6, cellY + 2, { width: colWidths[1] - 12, align: "right" });

    cellY += 14;
  }

  // Footer
  y = pageHeight - 50;
  doc.fontSize(8).fillColor(COLORS.lightGray);
  doc.text(t("Document confidentiel | kWh Québec", "Confidential document | kWh Québec"), margin, y, {
    align: "center",
    width: contentWidth,
  });
}

export function generateMasterAgreementPDF(
  doc: PDFKit.PDFDocument,
  data: MasterAgreementData,
  lang: "fr" | "en" = "fr"
): void {
  const ctx = createContext(doc, lang);

  // Page 1: Cover Page
  drawCoverPage(ctx, data);

  // Page 2: Table of Contents
  doc.addPage();
  drawTableOfContents(ctx);

  // Page 3: Section 1
  doc.addPage();
  drawSection1(ctx, data);

  // Page 4: Section 2
  doc.addPage();
  drawSection2(ctx, data);

  // Page 5: Section 3
  doc.addPage();
  drawSection3(ctx, data);

  // Page 6: Section 4
  doc.addPage();
  drawSection4(ctx, data);

  // Page 7: Section 5
  doc.addPage();
  drawSection5(ctx, data);

  // Page 8: Section 6
  doc.addPage();
  drawSection6(ctx);

  // Page 9: Section 7
  doc.addPage();
  drawSection7(ctx);

  // Annex A: One page per site
  data.sites.forEach((site, index) => {
    doc.addPage();
    drawAnnexASite(ctx, site, index, data.sites.length);
  });
}
