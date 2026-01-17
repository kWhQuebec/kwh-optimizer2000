import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { format } from "date-fns";
import { fr, enCA } from "date-fns/locale";
import type { 
  ConstructionAgreement, 
  Site, 
  Client, 
  Design, 
  BomItem, 
  ConstructionMilestone,
  ConstructionProject,
  ConstructionTask
} from "@shared/schema";
import {
  BRAND_COLORS,
  PAGE_SIZES,
  DEFAULT_THEME,
  drawModernHeader,
  drawModernFooter,
  drawInfoCard,
  drawTable,
  drawSectionTitle,
  drawParagraph,
  drawStatBox,
} from "./pdfTemplates";

export interface ConstructionProposalData {
  agreement: ConstructionAgreement;
  site: Site;
  client: Client;
  design?: Design | null;
  bomItems: BomItem[];
  milestones: ConstructionMilestone[];
  project?: ConstructionProject | null;
  preliminaryTasks: ConstructionTask[];
}

export function generateConstructionProposalPDF(
  doc: PDFKit.PDFDocument,
  data: ConstructionProposalData,
  lang: "fr" | "en" = "fr"
): void {
  const t = (fr: string, en: string) => (lang === "fr" ? fr : en);
  const pageWidth = PAGE_SIZES.letter.width;
  const pageHeight = PAGE_SIZES.letter.height;
  const margin = DEFAULT_THEME.margin;
  const contentWidth = pageWidth - 2 * margin;

  const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) {
      return "0 $";
    }
    return `${value.toLocaleString("fr-CA", { maximumFractionDigits: 0 })} $`;
  };

  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return "—";
    const d = new Date(date);
    return format(d, "d MMM yyyy", { locale: lang === "fr" ? fr : enCA });
  };

  let logoBuffer: Buffer | null = null;
  const logoPath = path.join(process.cwd(), "attached_assets", "solaire_fr-removebg-preview_1767985380511.png");
  if (fs.existsSync(logoPath)) {
    try {
      logoBuffer = fs.readFileSync(logoPath);
    } catch (e) {
      logoBuffer = null;
    }
  }

  const drawPageHeader = (title: string, pageNum: number, totalPages: number) => {
    doc.rect(0, 0, pageWidth, 6).fillColor(BRAND_COLORS.accent).fill();
    
    doc.rect(0, 6, pageWidth, 54).fillColor(BRAND_COLORS.primary).fill();
    
    if (logoBuffer) {
      try {
        doc.image(logoBuffer, pageWidth - margin - 100, 15, { width: 90 });
      } catch (e) {}
    }
    
    doc.fontSize(20).fillColor(BRAND_COLORS.white).font("Helvetica-Bold");
    doc.text(title, margin, 25);
    doc.font("Helvetica");
    
    return 80;
  };

  const drawPageFooter = (pageNum: number, totalPages: number) => {
    drawModernFooter(doc, {
      leftText: "kWh Québec",
      centerText: data.site.name,
      rightText: `${pageNum} / ${totalPages}`,
      pageWidth,
      pageHeight,
    });
  };

  // ================= PAGE 1: COVER =================
  const coverImagePath = path.join(process.cwd(), "attached_assets", "kWh__Quebec_Brand_Guideline_1764967501349.jpg");

  if (fs.existsSync(coverImagePath)) {
    try {
      doc.image(coverImagePath, 0, 0, { width: pageWidth, height: pageHeight });
    } catch (e) {
      doc.rect(0, 0, pageWidth, pageHeight).fillColor(BRAND_COLORS.primary).fill();
    }
  } else {
    doc.rect(0, 0, pageWidth, pageHeight).fillColor(BRAND_COLORS.primary).fill();
  }

  doc.rect(0, 0, pageWidth, pageHeight).fillColor("black").fillOpacity(0.55).fill();
  doc.fillOpacity(1);

  if (logoBuffer) {
    try {
      doc.image(logoBuffer, margin, margin, { width: 180 });
    } catch (e) {
      doc.fontSize(32).fillColor(BRAND_COLORS.white).font("Helvetica-Bold");
      doc.text("kWh Québec", margin, margin);
      doc.font("Helvetica");
    }
  } else {
    doc.fontSize(32).fillColor(BRAND_COLORS.white).font("Helvetica-Bold");
    doc.text("kWh Québec", margin, margin);
    doc.font("Helvetica");
  }

  const centerY = pageHeight / 2 - 80;

  doc.fontSize(36).fillColor(BRAND_COLORS.white).font("Helvetica-Bold");
  doc.text(t("PROPOSITION DE", "CONSTRUCTION"), margin, centerY, { width: contentWidth, align: "center" });
  doc.font("Helvetica");

  doc.fontSize(36).fillColor(BRAND_COLORS.accent).font("Helvetica-Bold");
  doc.text(t("CONSTRUCTION", "PROPOSAL"), margin, centerY + 48, { width: contentWidth, align: "center" });
  doc.font("Helvetica");

  doc.rect(pageWidth / 2 - 100, centerY + 100, 200, 4).fillColor(BRAND_COLORS.accent).fill();

  doc.fontSize(22).fillColor(BRAND_COLORS.white).font("Helvetica-Bold");
  doc.text(data.site.name, margin, centerY + 130, { width: contentWidth, align: "center" });
  doc.font("Helvetica");

  const locationText = [data.site.city, data.site.province || "QC"].filter(Boolean).join(", ");
  doc.fontSize(14).fillColor(BRAND_COLORS.white).fillOpacity(0.9);
  doc.text(locationText || "Québec", margin, centerY + 160, { width: contentWidth, align: "center" });
  doc.fillOpacity(1);

  const bottomY = pageHeight - 150;
  doc.fontSize(12).fillColor(BRAND_COLORS.white).fillOpacity(0.8);
  doc.text(t("Préparé pour:", "Prepared for:"), margin, bottomY, { width: contentWidth, align: "center" });
  doc.fillOpacity(1);

  doc.fontSize(18).fillColor(BRAND_COLORS.white).font("Helvetica-Bold");
  doc.text(data.client.name, margin, bottomY + 18, { width: contentWidth, align: "center" });
  doc.font("Helvetica");

  const coverDateStr = formatDate(new Date());
  doc.fontSize(12).fillColor(BRAND_COLORS.white).fillOpacity(0.7);
  doc.text(coverDateStr, margin, pageHeight - 60, { width: contentWidth, align: "center" });
  doc.fillOpacity(1);

  // ================= PAGE 2: PROJECT SUMMARY =================
  doc.addPage();

  let yPos = drawPageHeader(t("Résumé du projet", "Project Summary"), 2, 5);

  const siteInfoCardHeight = 140;
  yPos = drawInfoCard(doc, {
    x: margin,
    y: yPos,
    width: contentWidth / 2 - 10,
    height: siteInfoCardHeight,
    title: t("Informations du site", "Site Information"),
    items: [
      { label: t("Site", "Site"), value: data.site.name },
      { label: t("Adresse", "Address"), value: data.site.address || "—" },
      { label: t("Ville", "City"), value: data.site.city || "—" },
    ],
  });

  drawInfoCard(doc, {
    x: margin + contentWidth / 2 + 10,
    y: yPos - siteInfoCardHeight,
    width: contentWidth / 2 - 10,
    height: siteInfoCardHeight,
    title: t("Client", "Client"),
    items: [
      { label: t("Nom", "Name"), value: data.client.name },
      { label: t("Contact", "Contact"), value: data.client.email || "—" },
    ],
  });

  yPos += 20;

  yPos = drawSectionTitle(doc, {
    x: margin,
    y: yPos,
    title: t("Spécifications du système", "System Specifications"),
    width: contentWidth,
  });

  const statBoxWidth = (contentWidth - 40) / 3;
  const statBoxHeight = 80;

  drawStatBox(doc, {
    x: margin,
    y: yPos,
    width: statBoxWidth,
    height: statBoxHeight,
    value: data.agreement.pvSizeKW ? `${data.agreement.pvSizeKW.toFixed(0)} kWc` : "—",
    label: t("Puissance PV", "PV Capacity"),
  });

  drawStatBox(doc, {
    x: margin + statBoxWidth + 20,
    y: yPos,
    width: statBoxWidth,
    height: statBoxHeight,
    value: data.agreement.batteryEnergyKWh ? `${data.agreement.batteryEnergyKWh.toFixed(0)} kWh` : "—",
    label: t("Stockage batterie", "Battery Storage"),
  });

  drawStatBox(doc, {
    x: margin + (statBoxWidth + 20) * 2,
    y: yPos,
    width: statBoxWidth,
    height: statBoxHeight,
    value: formatCurrency(data.agreement.totalContractValue),
    label: t("Valeur du contrat", "Contract Value"),
  });

  yPos += statBoxHeight + 30;

  yPos = drawSectionTitle(doc, {
    x: margin,
    y: yPos,
    title: t("Échéancier estimé", "Estimated Timeline"),
    width: contentWidth,
  });

  const timelineRows = [
    [t("Début estimé", "Estimated Start"), formatDate(data.agreement.estimatedStartDate)],
    [t("Fin estimée", "Estimated Completion"), formatDate(data.agreement.estimatedCompletionDate)],
  ];

  yPos = drawTable(doc, {
    x: margin,
    y: yPos,
    width: 350,
    headers: [t("Étape", "Milestone"), t("Date", "Date")],
    rows: timelineRows,
    columnWidths: [200, 150],
  });

  drawPageFooter(2, 5);

  // ================= PAGE 3: PRELIMINARY SCHEDULE =================
  doc.addPage();

  yPos = drawPageHeader(t("Calendrier préliminaire", "Preliminary Schedule"), 3, 5);

  doc.fontSize(9).fillColor(BRAND_COLORS.lightText).font("Helvetica-Oblique");
  doc.text(
    t("Calendrier préliminaire - sujet à modification", "Preliminary schedule - subject to change"),
    margin,
    yPos
  );
  doc.font("Helvetica");
  yPos += 25;

  const scheduleHeaders = [
    t("Tâche", "Task"),
    t("Durée (jours)", "Duration (days)"),
    t("Date début", "Start Date"),
    t("Date fin", "End Date"),
  ];

  const scheduleColWidths = [200, 80, 110, 110];
  const scheduleTableWidth = scheduleColWidths.reduce((a, b) => a + b, 0);

  if (data.preliminaryTasks.length === 0) {
    yPos = drawTable(doc, {
      x: margin,
      y: yPos,
      width: scheduleTableWidth,
      headers: scheduleHeaders,
      rows: [[t("Aucune tâche préliminaire définie", "No preliminary tasks defined"), "—", "—", "—"]],
      columnWidths: scheduleColWidths,
    });
  } else {
    const sortedTasks = [...data.preliminaryTasks].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    
    const taskRows = sortedTasks.map((task) => {
      let hasDeps = task.dependsOnTaskIds && task.dependsOnTaskIds.length > 0;
      let taskName = hasDeps ? "  → " + task.name : task.name;
      return [
        taskName,
        task.durationDays?.toString() || "—",
        formatDate(task.plannedStartDate),
        formatDate(task.plannedEndDate),
      ];
    });

    yPos = drawTable(doc, {
      x: margin,
      y: yPos,
      width: scheduleTableWidth,
      headers: scheduleHeaders,
      rows: taskRows,
      columnWidths: scheduleColWidths,
    });
  }

  drawPageFooter(3, 5);

  // ================= PAGE 4: COST SUMMARY =================
  doc.addPage();

  yPos = drawPageHeader(t("Sommaire des coûts", "Cost Summary"), 4, 5);

  yPos = drawSectionTitle(doc, {
    x: margin,
    y: yPos,
    title: t("Ventilation par catégorie", "Breakdown by Category"),
    width: contentWidth,
  });

  const bomByCategory: Record<string, { qty: number; total: number }> = {};
  data.bomItems.forEach((item) => {
    const cat = item.category || "OTHER";
    if (!bomByCategory[cat]) {
      bomByCategory[cat] = { qty: 0, total: 0 };
    }
    bomByCategory[cat].qty += item.quantity || 0;
    bomByCategory[cat].total += item.lineTotalSell || item.lineTotalCost || 0;
  });

  const categoryLabels: Record<string, { fr: string; en: string }> = {
    MODULE: { fr: "Modules PV", en: "PV Modules" },
    INVERTER: { fr: "Onduleurs", en: "Inverters" },
    BATTERY: { fr: "Batteries", en: "Batteries" },
    RACKING: { fr: "Structure", en: "Racking" },
    CABLE: { fr: "Câblage", en: "Cabling" },
    BOS: { fr: "BOS", en: "BOS" },
    OTHER: { fr: "Autre", en: "Other" },
  };

  const categories = Object.keys(bomByCategory);
  const categoryRows = categories.length === 0
    ? [[t("Aucun article BOM", "No BOM items"), "—"]]
    : categories.map((cat) => [
        categoryLabels[cat]?.[lang] || cat,
        formatCurrency(bomByCategory[cat].total),
      ]);

  yPos = drawTable(doc, {
    x: margin,
    y: yPos,
    width: 350,
    headers: [t("Catégorie", "Category"), t("Montant", "Amount")],
    rows: categoryRows,
    columnWidths: [200, 150],
  });

  yPos += 20;

  doc.roundedRect(margin, yPos, 350, 60, 8).fillColor(BRAND_COLORS.primary).fill();
  doc.fontSize(12).fillColor(BRAND_COLORS.white).font("Helvetica-Bold");
  doc.text(t("VALEUR TOTALE DU CONTRAT", "TOTAL CONTRACT VALUE"), margin + 18, yPos + 15);
  doc.fontSize(22).fillColor(BRAND_COLORS.accent);
  doc.text(formatCurrency(data.agreement.totalContractValue), margin + 18, yPos + 35);
  doc.font("Helvetica");

  yPos += 90;

  if (data.milestones.length > 0) {
    yPos = drawSectionTitle(doc, {
      x: margin,
      y: yPos,
      title: t("Échéancier de paiement", "Payment Schedule"),
      width: contentWidth,
    });

    const sortedMilestones = [...data.milestones].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

    const milestoneRows = sortedMilestones.map((ms) => [
      ms.name,
      ms.paymentPercent ? `${ms.paymentPercent.toFixed(0)}%` : "—",
      formatCurrency(ms.paymentAmount),
    ]);

    yPos = drawTable(doc, {
      x: margin,
      y: yPos,
      width: contentWidth,
      headers: [t("Jalon", "Milestone"), t("Pourcentage", "Percentage"), t("Montant", "Amount")],
      rows: milestoneRows,
      columnWidths: [260, 100, 150],
    });
  }

  drawPageFooter(4, 5);

  // ================= PAGE 5: TERMS & CONDITIONS =================
  doc.addPage();

  yPos = drawPageHeader(t("Termes et conditions", "Terms & Conditions"), 5, 5);

  const termsContent = lang === "fr"
    ? [
        { type: "heading", text: "1. OBJET DU CONTRAT" },
        { type: "paragraph", text: "Le présent contrat a pour objet l'installation d'un système photovoltaïque avec stockage d'énergie conformément aux spécifications techniques décrites dans ce document." },
        { type: "heading", text: "2. DURÉE DES TRAVAUX" },
        { type: "paragraph", text: "Les travaux débuteront à la date convenue et seront réalisés selon le calendrier préliminaire présenté, sous réserve des conditions météorologiques et de l'obtention des permis nécessaires." },
        { type: "heading", text: "3. CONDITIONS DE PAIEMENT" },
        { type: "paragraph", text: "Les paiements seront effectués selon l'échéancier de paiement présenté dans ce document. Un dépôt initial est requis avant le début des travaux." },
        { type: "heading", text: "4. GARANTIES" },
        { type: "paragraph", text: `Le système est garanti pour une période de ${data.agreement.warrantyYears || 10} ans. Cette garantie couvre les défauts de fabrication et d'installation.` },
        { type: "heading", text: "5. RESPONSABILITÉS" },
        { type: "paragraph", text: "L'installateur s'engage à réaliser les travaux selon les règles de l'art et en conformité avec les normes en vigueur au Québec." },
        { type: "heading", text: "6. MODIFICATIONS" },
        { type: "paragraph", text: "Toute modification au présent contrat devra faire l'objet d'un avenant écrit signé par les deux parties." },
        { type: "note", text: "Ce document constitue une proposition préliminaire. Le contrat final sera soumis pour signature une fois les détails finalisés." },
      ]
    : [
        { type: "heading", text: "1. PURPOSE OF CONTRACT" },
        { type: "paragraph", text: "This contract is for the installation of a photovoltaic system with energy storage according to the technical specifications described in this document." },
        { type: "heading", text: "2. WORK DURATION" },
        { type: "paragraph", text: "Work will begin on the agreed date and will be carried out according to the preliminary schedule presented, subject to weather conditions and obtaining necessary permits." },
        { type: "heading", text: "3. PAYMENT TERMS" },
        { type: "paragraph", text: "Payments will be made according to the payment schedule presented in this document. An initial deposit is required before work begins." },
        { type: "heading", text: "4. WARRANTIES" },
        { type: "paragraph", text: `The system is warranted for a period of ${data.agreement.warrantyYears || 10} years. This warranty covers manufacturing and installation defects.` },
        { type: "heading", text: "5. RESPONSIBILITIES" },
        { type: "paragraph", text: "The installer commits to carrying out the work according to industry standards and in compliance with regulations in force in Québec." },
        { type: "heading", text: "6. MODIFICATIONS" },
        { type: "paragraph", text: "Any modification to this contract must be the subject of a written amendment signed by both parties." },
        { type: "note", text: "This document constitutes a preliminary proposal. The final contract will be submitted for signature once details are finalized." },
      ];

  termsContent.forEach((item) => {
    if (item.type === "heading") {
      doc.fontSize(11).fillColor(BRAND_COLORS.primary).font("Helvetica-Bold");
      doc.text(item.text, margin, yPos, { width: contentWidth });
      doc.font("Helvetica");
      yPos += 18;
    } else if (item.type === "paragraph") {
      yPos = drawParagraph(doc, {
        x: margin,
        y: yPos,
        text: item.text,
        width: contentWidth,
        fontSize: 10,
        color: BRAND_COLORS.darkText,
      });
      yPos += 5;
    } else if (item.type === "note") {
      yPos += 10;
      doc.roundedRect(margin, yPos, contentWidth, 40, 6).fillColor(BRAND_COLORS.ultraLight).fill();
      doc.roundedRect(margin, yPos, contentWidth, 40, 6).strokeColor(BRAND_COLORS.border).lineWidth(1).stroke();
      doc.fontSize(10).fillColor(BRAND_COLORS.mediumText).font("Helvetica-Oblique");
      doc.text(item.text, margin + 15, yPos + 12, { width: contentWidth - 30 });
      doc.font("Helvetica");
      yPos += 55;
    }

    if (yPos > pageHeight - 150) {
      doc.addPage();
      yPos = margin;
    }
  });

  yPos = Math.max(yPos, pageHeight - 130);

  doc.fontSize(10).fillColor(BRAND_COLORS.mediumText);
  doc.text(t("Signature du client:", "Client signature:"), margin, yPos);
  doc.moveTo(margin, yPos + 35).lineTo(margin + 200, yPos + 35).strokeColor(BRAND_COLORS.border).lineWidth(1).stroke();
  doc.text(t("Date:", "Date:"), margin + 250, yPos);
  doc.moveTo(margin + 250, yPos + 35).lineTo(margin + 400, yPos + 35).strokeColor(BRAND_COLORS.border).lineWidth(1).stroke();

  drawPageFooter(5, 5);
}
