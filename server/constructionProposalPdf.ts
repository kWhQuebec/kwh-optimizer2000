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

const COLORS = {
  blue: "#003DA6",
  gold: "#FFB005",
  darkGray: "#333333",
  mediumGray: "#666666",
  lightGray: "#999999",
  green: "#2D915F",
  red: "#DC2626",
  white: "#FFFFFF",
  background: "#F5F5F5",
};

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
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 50;
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

  const drawRoundedRect = (
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    fill?: string,
    stroke?: string
  ) => {
    doc.roundedRect(x, y, width, height, radius);
    if (fill) {
      doc.fillColor(fill).fill();
    }
    if (stroke) {
      doc.strokeColor(stroke).stroke();
    }
  };

  // ================= PAGE 1: COVER =================
  const coverImagePath = path.join(process.cwd(), "attached_assets", "kWh__Quebec_Brand_Guideline_1764967501349.jpg");
  const logoPath = path.join(process.cwd(), "attached_assets", "kWh_Quebec_Logo-01_1764778562811.png");

  if (fs.existsSync(coverImagePath)) {
    try {
      doc.image(coverImagePath, 0, 0, { width: pageWidth, height: pageHeight });
    } catch (e) {
      doc.rect(0, 0, pageWidth, pageHeight).fillColor(COLORS.blue).fill();
    }
  } else {
    doc.rect(0, 0, pageWidth, pageHeight).fillColor(COLORS.blue).fill();
  }

  doc.rect(0, 0, pageWidth, pageHeight).fillColor("black").fillOpacity(0.55).fill();
  doc.fillOpacity(1);

  if (fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, margin, margin, { width: 180 });
    } catch (e) {
      doc.fontSize(32).fillColor(COLORS.white).font("Helvetica-Bold");
      doc.text("kWh Québec", margin, margin);
      doc.font("Helvetica");
    }
  } else {
    doc.fontSize(32).fillColor(COLORS.white).font("Helvetica-Bold");
    doc.text("kWh Québec", margin, margin);
    doc.font("Helvetica");
  }

  const centerY = pageHeight / 2 - 80;

  doc.fontSize(36).fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text(t("PROPOSITION DE", "CONSTRUCTION"), margin, centerY, { width: contentWidth, align: "center" });
  doc.font("Helvetica");

  doc.fontSize(36).fillColor(COLORS.gold).font("Helvetica-Bold");
  doc.text(t("CONSTRUCTION", "PROPOSAL"), margin, centerY + 48, { width: contentWidth, align: "center" });
  doc.font("Helvetica");

  doc.rect(pageWidth / 2 - 100, centerY + 100, 200, 4).fillColor(COLORS.gold).fill();

  doc.fontSize(22).fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text(data.site.name, margin, centerY + 130, { width: contentWidth, align: "center" });
  doc.font("Helvetica");

  const locationText = [data.site.city, data.site.province || "QC"].filter(Boolean).join(", ");
  doc.fontSize(14).fillColor(COLORS.white).fillOpacity(0.9);
  doc.text(locationText || "Québec", margin, centerY + 160, { width: contentWidth, align: "center" });
  doc.fillOpacity(1);

  const bottomY = pageHeight - 150;
  doc.fontSize(12).fillColor(COLORS.white).fillOpacity(0.8);
  doc.text(t("Préparé pour:", "Prepared for:"), margin, bottomY, { width: contentWidth, align: "center" });
  doc.fillOpacity(1);

  doc.fontSize(18).fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text(data.client.name, margin, bottomY + 18, { width: contentWidth, align: "center" });
  doc.font("Helvetica");

  const coverDateStr = formatDate(new Date());
  doc.fontSize(12).fillColor(COLORS.white).fillOpacity(0.7);
  doc.text(coverDateStr, margin, pageHeight - 60, { width: contentWidth, align: "center" });
  doc.fillOpacity(1);

  // ================= PAGE 2: PROJECT SUMMARY =================
  doc.addPage();

  const headerHeight = 60;
  doc.rect(0, 0, pageWidth, headerHeight).fillColor(COLORS.blue).fill();
  doc.rect(0, headerHeight - 3, pageWidth, 3).fillColor(COLORS.gold).fill();

  doc.fontSize(20).fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text(t("Résumé du projet", "Project Summary"), margin, 20);
  doc.font("Helvetica");

  let yPos = headerHeight + 30;

  doc.fontSize(14).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Informations du site", "Site Information"), margin, yPos);
  doc.font("Helvetica");
  yPos += 25;

  drawRoundedRect(margin, yPos, contentWidth, 100, 6, COLORS.white);
  doc.roundedRect(margin, yPos, contentWidth, 100, 6).strokeColor(COLORS.lightGray).lineWidth(1).stroke();

  const infoItems = [
    [t("Site:", "Site:"), data.site.name],
    [t("Adresse:", "Address:"), data.site.address || "—"],
    [t("Ville:", "City:"), data.site.city || "—"],
    [t("Client:", "Client:"), data.client.name],
  ];

  let infoY = yPos + 12;
  infoItems.forEach(([label, value]) => {
    doc.fontSize(10).fillColor(COLORS.mediumGray);
    doc.text(label, margin + 15, infoY);
    doc.fontSize(10).fillColor(COLORS.darkGray).font("Helvetica-Bold");
    doc.text(value || "—", margin + 100, infoY);
    doc.font("Helvetica");
    infoY += 20;
  });

  yPos += 120;

  doc.fontSize(14).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Spécifications du système", "System Specifications"), margin, yPos);
  doc.font("Helvetica");
  yPos += 25;

  drawRoundedRect(margin, yPos, contentWidth, 80, 6, COLORS.white);
  doc.roundedRect(margin, yPos, contentWidth, 80, 6).strokeColor(COLORS.lightGray).lineWidth(1).stroke();

  const specItems = [
    [t("Puissance PV:", "PV Capacity:"), data.agreement.pvSizeKW ? `${data.agreement.pvSizeKW.toFixed(0)} kWc` : "—"],
    [t("Stockage batterie:", "Battery Storage:"), data.agreement.batteryEnergyKWh ? `${data.agreement.batteryEnergyKWh.toFixed(0)} kWh` : "—"],
    [t("Valeur du contrat:", "Contract Value:"), formatCurrency(data.agreement.totalContractValue)],
  ];

  let specY = yPos + 12;
  specItems.forEach(([label, value]) => {
    doc.fontSize(10).fillColor(COLORS.mediumGray);
    doc.text(label, margin + 15, specY);
    doc.fontSize(12).fillColor(COLORS.blue).font("Helvetica-Bold");
    doc.text(value, margin + 150, specY);
    doc.font("Helvetica");
    specY += 22;
  });

  yPos += 100;

  doc.fontSize(14).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Échéancier estimé", "Estimated Timeline"), margin, yPos);
  doc.font("Helvetica");
  yPos += 25;

  drawRoundedRect(margin, yPos, contentWidth, 60, 6, COLORS.white);
  doc.roundedRect(margin, yPos, contentWidth, 60, 6).strokeColor(COLORS.lightGray).lineWidth(1).stroke();

  const timelineItems = [
    [t("Début estimé:", "Estimated Start:"), formatDate(data.agreement.estimatedStartDate)],
    [t("Fin estimée:", "Estimated Completion:"), formatDate(data.agreement.estimatedCompletionDate)],
  ];

  let timelineY = yPos + 12;
  timelineItems.forEach(([label, value]) => {
    doc.fontSize(10).fillColor(COLORS.mediumGray);
    doc.text(label, margin + 15, timelineY);
    doc.fontSize(10).fillColor(COLORS.darkGray).font("Helvetica-Bold");
    doc.text(value, margin + 150, timelineY);
    doc.font("Helvetica");
    timelineY += 22;
  });

  // ================= PAGE 3: PRELIMINARY SCHEDULE (GANTT) =================
  doc.addPage();

  doc.rect(0, 0, pageWidth, headerHeight).fillColor(COLORS.blue).fill();
  doc.rect(0, headerHeight - 3, pageWidth, 3).fillColor(COLORS.gold).fill();

  doc.fontSize(20).fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text(t("Calendrier préliminaire", "Preliminary Schedule"), margin, 20);
  doc.font("Helvetica");

  yPos = headerHeight + 30;

  doc.fontSize(9).fillColor(COLORS.mediumGray).font("Helvetica-Oblique");
  doc.text(
    t("Calendrier préliminaire - sujet à modification", "Preliminary schedule - subject to change"),
    margin,
    yPos
  );
  doc.font("Helvetica");
  yPos += 25;

  const tableStartY = yPos;
  const colWidths = [200, 80, 110, 110];
  const rowHeight = 25;
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);

  doc.rect(margin, tableStartY, tableWidth, rowHeight).fillColor(COLORS.blue).fill();
  
  const headers = [
    t("Tâche", "Task"),
    t("Durée (jours)", "Duration (days)"),
    t("Date début", "Start Date"),
    t("Date fin", "End Date"),
  ];

  let colX = margin;
  headers.forEach((header, i) => {
    doc.fontSize(9).fillColor(COLORS.white).font("Helvetica-Bold");
    doc.text(header, colX + 8, tableStartY + 7, { width: colWidths[i] - 16 });
    colX += colWidths[i];
  });
  doc.font("Helvetica");

  yPos = tableStartY + rowHeight;

  if (data.preliminaryTasks.length === 0) {
    doc.rect(margin, yPos, tableWidth, rowHeight).fillColor(COLORS.background).fill();
    doc.fontSize(10).fillColor(COLORS.mediumGray);
    doc.text(
      t("Aucune tâche préliminaire définie", "No preliminary tasks defined"),
      margin + 8,
      yPos + 7
    );
    yPos += rowHeight;
  } else {
    const sortedTasks = [...data.preliminaryTasks].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    
    sortedTasks.forEach((task, index) => {
      const isEven = index % 2 === 0;
      doc.rect(margin, yPos, tableWidth, rowHeight).fillColor(isEven ? COLORS.white : COLORS.background).fill();

      let hasDeps = task.dependsOnTaskIds && task.dependsOnTaskIds.length > 0;
      let taskName = task.name;
      if (hasDeps) {
        taskName = "  → " + taskName;
      }

      colX = margin;

      doc.fontSize(9).fillColor(COLORS.darkGray);
      doc.text(taskName, colX + 8, yPos + 7, { width: colWidths[0] - 16, lineBreak: false });
      colX += colWidths[0];

      doc.text(task.durationDays?.toString() || "—", colX + 8, yPos + 7, { width: colWidths[1] - 16, align: "center" });
      colX += colWidths[1];

      doc.text(formatDate(task.plannedStartDate), colX + 8, yPos + 7, { width: colWidths[2] - 16 });
      colX += colWidths[2];

      doc.text(formatDate(task.plannedEndDate), colX + 8, yPos + 7, { width: colWidths[3] - 16 });

      yPos += rowHeight;

      if (yPos > pageHeight - 100) {
        doc.addPage();
        yPos = margin;
      }
    });
  }

  doc.rect(margin, tableStartY, tableWidth, yPos - tableStartY)
    .strokeColor(COLORS.lightGray)
    .lineWidth(1)
    .stroke();

  // ================= PAGE 4: COST SUMMARY =================
  doc.addPage();

  doc.rect(0, 0, pageWidth, headerHeight).fillColor(COLORS.blue).fill();
  doc.rect(0, headerHeight - 3, pageWidth, 3).fillColor(COLORS.gold).fill();

  doc.fontSize(20).fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text(t("Sommaire des coûts", "Cost Summary"), margin, 20);
  doc.font("Helvetica");

  yPos = headerHeight + 30;

  doc.fontSize(14).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Ventilation par catégorie", "Breakdown by Category"), margin, yPos);
  doc.font("Helvetica");
  yPos += 25;

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

  const catTableWidth = 350;
  const catColWidths = [200, 150];

  doc.rect(margin, yPos, catTableWidth, rowHeight).fillColor(COLORS.blue).fill();
  doc.fontSize(9).fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text(t("Catégorie", "Category"), margin + 8, yPos + 7);
  doc.text(t("Montant", "Amount"), margin + catColWidths[0] + 8, yPos + 7);
  doc.font("Helvetica");
  yPos += rowHeight;

  const categories = Object.keys(bomByCategory);
  if (categories.length === 0) {
    doc.rect(margin, yPos, catTableWidth, rowHeight).fillColor(COLORS.background).fill();
    doc.fontSize(10).fillColor(COLORS.mediumGray);
    doc.text(t("Aucun article BOM", "No BOM items"), margin + 8, yPos + 7);
    yPos += rowHeight;
  } else {
    categories.forEach((cat, index) => {
      const isEven = index % 2 === 0;
      doc.rect(margin, yPos, catTableWidth, rowHeight).fillColor(isEven ? COLORS.white : COLORS.background).fill();

      const catLabel = categoryLabels[cat]?.[lang] || cat;
      doc.fontSize(9).fillColor(COLORS.darkGray);
      doc.text(catLabel, margin + 8, yPos + 7);
      doc.fontSize(9).fillColor(COLORS.blue).font("Helvetica-Bold");
      doc.text(formatCurrency(bomByCategory[cat].total), margin + catColWidths[0] + 8, yPos + 7);
      doc.font("Helvetica");

      yPos += rowHeight;
    });
  }

  doc.rect(margin, yPos - (categories.length || 1) * rowHeight - rowHeight, catTableWidth, (categories.length || 1) * rowHeight + rowHeight)
    .strokeColor(COLORS.lightGray)
    .lineWidth(1)
    .stroke();

  yPos += 20;

  drawRoundedRect(margin, yPos, 350, 50, 6, COLORS.blue);
  doc.fontSize(12).fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text(t("VALEUR TOTALE DU CONTRAT", "TOTAL CONTRACT VALUE"), margin + 15, yPos + 10);
  doc.fontSize(18).fillColor(COLORS.gold);
  doc.text(formatCurrency(data.agreement.totalContractValue), margin + 15, yPos + 28);
  doc.font("Helvetica");

  yPos += 80;

  if (data.milestones.length > 0) {
    doc.fontSize(14).fillColor(COLORS.blue).font("Helvetica-Bold");
    doc.text(t("Échéancier de paiement", "Payment Schedule"), margin, yPos);
    doc.font("Helvetica");
    yPos += 25;

    const msTableWidth = contentWidth;
    const msColWidths = [250, 100, 150];

    doc.rect(margin, yPos, msTableWidth, rowHeight).fillColor(COLORS.blue).fill();
    doc.fontSize(9).fillColor(COLORS.white).font("Helvetica-Bold");
    doc.text(t("Jalon", "Milestone"), margin + 8, yPos + 7);
    doc.text(t("Pourcentage", "Percentage"), margin + msColWidths[0] + 8, yPos + 7);
    doc.text(t("Montant", "Amount"), margin + msColWidths[0] + msColWidths[1] + 8, yPos + 7);
    doc.font("Helvetica");
    yPos += rowHeight;

    const sortedMilestones = [...data.milestones].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

    sortedMilestones.forEach((ms, index) => {
      const isEven = index % 2 === 0;
      doc.rect(margin, yPos, msTableWidth, rowHeight).fillColor(isEven ? COLORS.white : COLORS.background).fill();

      doc.fontSize(9).fillColor(COLORS.darkGray);
      doc.text(ms.name, margin + 8, yPos + 7, { width: msColWidths[0] - 16 });
      doc.text(ms.paymentPercent ? `${ms.paymentPercent.toFixed(0)}%` : "—", margin + msColWidths[0] + 8, yPos + 7);
      doc.fontSize(9).fillColor(COLORS.blue).font("Helvetica-Bold");
      doc.text(formatCurrency(ms.paymentAmount), margin + msColWidths[0] + msColWidths[1] + 8, yPos + 7);
      doc.font("Helvetica");

      yPos += rowHeight;
    });

    doc.rect(margin, yPos - sortedMilestones.length * rowHeight - rowHeight, msTableWidth, sortedMilestones.length * rowHeight + rowHeight)
      .strokeColor(COLORS.lightGray)
      .lineWidth(1)
      .stroke();
  }

  // ================= PAGE 5: TERMS & CONDITIONS =================
  doc.addPage();

  doc.rect(0, 0, pageWidth, headerHeight).fillColor(COLORS.blue).fill();
  doc.rect(0, headerHeight - 3, pageWidth, 3).fillColor(COLORS.gold).fill();

  doc.fontSize(20).fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text(t("Termes et conditions", "Terms & Conditions"), margin, 20);
  doc.font("Helvetica");

  yPos = headerHeight + 30;

  const termsContent = lang === "fr"
    ? [
        "1. OBJET DU CONTRAT",
        "Le présent contrat a pour objet l'installation d'un système photovoltaïque avec stockage d'énergie conformément aux spécifications techniques décrites dans ce document.",
        "",
        "2. DURÉE DES TRAVAUX",
        "Les travaux débuteront à la date convenue et seront réalisés selon le calendrier préliminaire présenté, sous réserve des conditions météorologiques et de l'obtention des permis nécessaires.",
        "",
        "3. CONDITIONS DE PAIEMENT",
        "Les paiements seront effectués selon l'échéancier de paiement présenté dans ce document. Un dépôt initial est requis avant le début des travaux.",
        "",
        "4. GARANTIES",
        `Le système est garanti pour une période de ${data.agreement.warrantyYears || 10} ans. Cette garantie couvre les défauts de fabrication et d'installation.`,
        "",
        "5. RESPONSABILITÉS",
        "L'installateur s'engage à réaliser les travaux selon les règles de l'art et en conformité avec les normes en vigueur au Québec.",
        "",
        "6. MODIFICATIONS",
        "Toute modification au présent contrat devra faire l'objet d'un avenant écrit signé par les deux parties.",
        "",
        "Ce document constitue une proposition préliminaire. Le contrat final sera soumis pour signature une fois les détails finalisés.",
      ]
    : [
        "1. PURPOSE OF CONTRACT",
        "This contract is for the installation of a photovoltaic system with energy storage according to the technical specifications described in this document.",
        "",
        "2. WORK DURATION",
        "Work will begin on the agreed date and will be carried out according to the preliminary schedule presented, subject to weather conditions and obtaining necessary permits.",
        "",
        "3. PAYMENT TERMS",
        "Payments will be made according to the payment schedule presented in this document. An initial deposit is required before work begins.",
        "",
        "4. WARRANTIES",
        `The system is warranted for a period of ${data.agreement.warrantyYears || 10} years. This warranty covers manufacturing and installation defects.`,
        "",
        "5. RESPONSIBILITIES",
        "The installer commits to carrying out the work according to industry standards and in compliance with regulations in force in Québec.",
        "",
        "6. MODIFICATIONS",
        "Any modification to this contract must be the subject of a written amendment signed by both parties.",
        "",
        "This document constitutes a preliminary proposal. The final contract will be submitted for signature once details are finalized.",
      ];

  termsContent.forEach((line) => {
    if (line === "") {
      yPos += 10;
    } else if (line.match(/^\d+\./)) {
      doc.fontSize(11).fillColor(COLORS.blue).font("Helvetica-Bold");
      doc.text(line, margin, yPos, { width: contentWidth });
      doc.font("Helvetica");
      yPos += 18;
    } else {
      doc.fontSize(10).fillColor(COLORS.darkGray);
      doc.text(line, margin, yPos, { width: contentWidth });
      yPos += doc.heightOfString(line, { width: contentWidth }) + 5;
    }

    if (yPos > pageHeight - 80) {
      doc.addPage();
      yPos = margin;
    }
  });

  yPos = pageHeight - 120;

  doc.fontSize(10).fillColor(COLORS.mediumGray);
  doc.text(t("Signature du client:", "Client signature:"), margin, yPos);
  doc.moveTo(margin, yPos + 35).lineTo(margin + 200, yPos + 35).strokeColor(COLORS.lightGray).stroke();
  doc.text(t("Date:", "Date:"), margin + 250, yPos);
  doc.moveTo(margin + 250, yPos + 35).lineTo(margin + 400, yPos + 35).strokeColor(COLORS.lightGray).stroke();

  doc.fontSize(9).fillColor(COLORS.lightGray);
  doc.text("kWh Québec", margin, pageHeight - 40, { width: contentWidth, align: "center" });
}
