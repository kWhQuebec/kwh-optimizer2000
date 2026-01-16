import PDFDocument from "pdfkit";
import { KBRackingEstimate, KB_RACKING_SPECS } from "./kbRackingEstimator";

interface SiteData {
  name: string;
  address: string;
  city: string;
  province?: string;
  postalCode?: string;
  buildingType?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
}

interface KBProposalOptions {
  quoteNumber?: string;
  quoteDate?: Date;
  quoteValidityDays?: number;
  companyName?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyAddress?: string;
}

type Language = "fr" | "en";

// Brand colors matching kWh Québec branding
const COLORS = {
  blue: "#003DA6",
  darkGray: "#333333",
  mediumGray: "#666666",
  lightGray: "#E8E8E8",
  lightBorder: "#CCCCCC",
  white: "#FFFFFF",
  background: "#F9F9F9",
};

const TEXTS: Record<Language, Record<string, string>> = {
  fr: {
    title: "Proposition de Système de Fixation Solaire",
    quoteNumber: "No de soumission",
    date: "Date",
    validUntil: "Valide jusqu'au",
    siteInformation: "Informations du site",
    systemSpecifications: "Spécifications du système",
    costBreakdown: "Détail des coûts",
    paymentTerms: "Conditions de paiement",
    location: "Lieu",
    buildingType: "Type de bâtiment",
    address: "Adresse",
    panelCount: "Nombre de panneaux",
    panelModel: "Modèle de panneau",
    panelPower: "Puissance par panneau",
    totalCapacity: "Capacité totale DC",
    rackingSystem: "Système de fixation",
    rackingCost: "Système de fixation",
    shippingHandling: "Expédition et manutention",
    engineering: "Rapport d'ingénierie (cachet PE)",
    subtotal: "Sous-total",
    deposit: "Dépôt requis (20%)",
    balanceBeforeDelivery: "Solde avant livraison (80%)",
    total: "Total",
    paymentDetails:
      "Un dépôt de 20% est requis pour confirmer la commande. Le solde de 80% est dû avant la livraison.",
    validity: "Cette soumission est valide pour 30 jours à partir de la date ci-dessus.",
    contactInfo: "Pour plus d'information, contactez-nous",
    kwhQuebec: "kWh Québec Inc.",
    phone: "Tél",
    email: "Courriel",
  },
  en: {
    title: "Solar Racking System Proposal",
    quoteNumber: "Quote Number",
    date: "Date",
    validUntil: "Valid Until",
    siteInformation: "Site Information",
    systemSpecifications: "System Specifications",
    location: "Location",
    buildingType: "Building Type",
    address: "Address",
    panelCount: "Number of Panels",
    panelModel: "Panel Model",
    panelPower: "Power per Panel",
    totalCapacity: "Total DC Capacity",
    rackingSystem: "Racking System",
    rackingCost: "Racking System",
    shippingHandling: "Shipping & Handling",
    engineering: "PE Stamped Engineering Report",
    subtotal: "Subtotal",
    deposit: "Deposit Required (20%)",
    balanceBeforeDelivery: "Balance Before Delivery (80%)",
    total: "Total",
    paymentDetails:
      "A deposit of 20% is required to confirm the order. The remaining 80% balance is due before delivery.",
    validity: "This quote is valid for 30 days from the date above.",
    contactInfo: "For more information, please contact us",
    kwhQuebec: "kWh Québec Inc.",
    phone: "Phone",
    email: "Email",
  },
};

export function generateKBProposalPDF(
  siteData: SiteData,
  estimate: KBRackingEstimate,
  language: Language = "en",
  options: KBProposalOptions = {}
): Promise<Buffer> {
  const t = (key: keyof (typeof TEXTS)["en"]) => TEXTS[language][key];

  const quoteDate = options.quoteDate || new Date();
  const validityDays = options.quoteValidityDays || 30;
  const validUntilDate = new Date(quoteDate);
  validUntilDate.setDate(validUntilDate.getDate() + validityDays);

  const doc = new PDFDocument({
    size: "letter",
    margin: 50,
    bufferPages: true,
  });

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 50;
  const contentWidth = pageWidth - 2 * margin;

  // ═══════════════════════════════════════════════════════════════════════════════
  // HELPER FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  const formatCurrency = (value: number): string => {
    return `$${value.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (date: Date): string => {
    const options_: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: language === "fr" ? "long" : "short",
      day: "numeric",
    };
    return date.toLocaleDateString(language === "fr" ? "fr-CA" : "en-CA", options_);
  };

  const drawHeader = (y: number) => {
    // Blue background header
    doc.rect(0, y - 50, pageWidth, 120).fillColor(COLORS.blue).fill();

    // Company name and logo placeholder
    doc.fillColor(COLORS.white).fontSize(24).font("Helvetica-Bold");
    doc.text(t("kwhQuebec"), margin, y - 35, { width: contentWidth });

    // Title
    doc.fontSize(16).font("Helvetica-Bold").text(t("title"), margin, y + 5, {
      width: contentWidth,
    });

    // Quote details (right side of header)
    doc.fontSize(10).font("Helvetica");
    const headerRightX = pageWidth - margin - 180;

    doc.fillColor(COLORS.white);
    doc.text(t("quoteNumber") + ":", headerRightX, y - 35);
    doc.text(options.quoteNumber || "KB-2025-001", headerRightX, y - 20);

    doc.text(t("date") + ":", headerRightX, y - 5);
    doc.text(formatDate(quoteDate), headerRightX, y + 10);

    doc.text(t("validUntil") + ":", headerRightX, y + 25);
    doc.text(formatDate(validUntilDate), headerRightX, y + 40);

    return y + 80;
  };

  const drawSection = (y: number, title: string): number => {
    doc.fillColor(COLORS.darkGray).fontSize(13).font("Helvetica-Bold");
    doc.text(title, margin, y);

    // Underline
    doc
      .moveTo(margin, y + 18)
      .lineTo(pageWidth - margin, y + 18)
      .strokeColor(COLORS.blue)
      .lineWidth(2)
      .stroke();

    doc.fillColor(COLORS.darkGray);
    return y + 35;
  };

  const drawLabelValue = (
    y: number,
    label: string,
    value: string,
    labelWidth: number = 150
  ): number => {
    doc.fillColor(COLORS.mediumGray).fontSize(10).font("Helvetica");
    doc.text(label + ":", margin, y, { width: labelWidth });

    doc.fillColor(COLORS.darkGray).font("Helvetica");
    doc.text(value, margin + labelWidth + 10, y);

    return y + 18;
  };

  const drawCostTable = (startY: number): number => {
    const tableY = startY;
    const col1X = margin;
    const col2X = pageWidth - margin - 150;
    const col3X = pageWidth - margin - 80;
    const rowHeight = 22;
    const tableWidth = pageWidth - 2 * margin;

    // Header row background
    doc
      .rect(col1X, tableY, tableWidth, rowHeight)
      .fillColor(COLORS.blue)
      .fill();

    // Header text
    doc.fillColor(COLORS.white).fontSize(10).font("Helvetica-Bold");
    doc.text("Description", col1X + 8, tableY + 5, { width: 250 });
    doc.text("Quantity", col2X - 50, tableY + 5, { width: 50, align: "right" });
    doc.text("Amount", col3X, tableY + 5, { width: 70, align: "right" });

    let currentY = tableY + rowHeight;

    // Data rows
    const rows = [
      {
        description: t("rackingCost"),
        quantity: `${estimate.panelCount} × $${estimate.pricePerPanel.toFixed(2)}/panel`,
        amount: formatCurrency(estimate.rackingSubtotal),
      },
      {
        description: t("shippingHandling"),
        quantity: "1",
        amount: formatCurrency(estimate.shippingEstimate),
      },
      {
        description: t("engineering"),
        quantity: "1",
        amount: formatCurrency(estimate.engineeringCost),
      },
    ];

    // Draw data rows
    rows.forEach((row, index) => {
      // Alternating background
      if (index % 2 === 0) {
        doc.rect(col1X, currentY, tableWidth, rowHeight).fillColor(COLORS.lightGray).fill();
      }

      doc.fillColor(COLORS.darkGray).fontSize(10).font("Helvetica");
      doc.text(row.description, col1X + 8, currentY + 4, { width: 250 });

      doc.fontSize(9).fillColor(COLORS.mediumGray);
      doc.text(row.quantity, col2X - 50, currentY + 4, { width: 50, align: "right" });

      doc.fontSize(10).fillColor(COLORS.darkGray).font("Helvetica-Bold");
      doc.text(row.amount, col3X, currentY + 4, { width: 70, align: "right" });

      currentY += rowHeight;
    });

    // Subtotal row
    doc
      .rect(col1X, currentY, tableWidth, rowHeight)
      .fillColor(COLORS.blue)
      .fill();

    doc.fillColor(COLORS.white).fontSize(11).font("Helvetica-Bold");
    doc.text(t("subtotal"), col1X + 8, currentY + 3, { width: 300 });
    doc.text(
      formatCurrency(
        estimate.rackingSubtotal + estimate.shippingEstimate + estimate.engineeringCost
      ),
      col3X,
      currentY + 3,
      { width: 70, align: "right" }
    );

    currentY += rowHeight;

    return currentY + 10;
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // PAGE 1 - PROPOSAL DETAILS
  // ═══════════════════════════════════════════════════════════════════════════════

  let y = 0;

  // Header
  y = drawHeader(y);

  // Site Information Section
  y = drawSection(y, t("siteInformation"));

  y = drawLabelValue(y, t("location"), siteData.city || "", 140);
  y = drawLabelValue(
    y,
    t("address"),
    `${siteData.address || ""}${siteData.postalCode ? " " + siteData.postalCode : ""}`,
    140
  );
  if (siteData.buildingType) {
    y = drawLabelValue(y, t("buildingType"), siteData.buildingType, 140);
  }

  y += 10;

  // System Specifications Section
  y = drawSection(y, t("systemSpecifications"));

  y = drawLabelValue(y, t("panelCount"), estimate.panelCount.toString(), 140);
  y = drawLabelValue(
    y,
    t("panelModel"),
    `Jinko Solar Tiger Neo 625W ${language === "fr" ? "Bifacial" : "Bifacial"}`,
    140
  );
  y = drawLabelValue(y, t("panelPower"), "625 W", 140);
  y = drawLabelValue(y, t("totalCapacity"), `${estimate.kwDc.toFixed(2)} kW`, 140);
  y = drawLabelValue(y, t("rackingSystem"), KB_RACKING_SPECS.systemName, 140);

  y += 15;

  // Cost Breakdown Section
  y = drawSection(y, t("costBreakdown"));

  // Check if we need a new page for the table
  if (y + 120 > pageHeight - margin) {
    doc.addPage();
    y = margin;
  }

  y = drawCostTable(y);

  // Payment Summary
  y += 5;
  doc.fillColor(COLORS.darkGray).fontSize(12).font("Helvetica-Bold");
  doc.text(t("total"), margin, y);

  const depositAmount = (estimate.rackingSubtotal + estimate.shippingEstimate + estimate.engineeringCost) * 0.2;
  const balanceAmount = (estimate.rackingSubtotal + estimate.shippingEstimate + estimate.engineeringCost) * 0.8;

  doc
    .fontSize(16)
    .font("Helvetica-Bold")
    .fillColor(COLORS.blue);
  doc.text(
    formatCurrency(
      estimate.rackingSubtotal + estimate.shippingEstimate + estimate.engineeringCost
    ),
    pageWidth - margin - 100,
    y,
    { align: "right", width: 100 }
  );

  y += 30;

  // Payment Terms Section
  y = drawSection(y, t("paymentTerms"));

  doc.fillColor(COLORS.darkGray).fontSize(10).font("Helvetica");

  // Deposit row
  doc.fontSize(10).font("Helvetica-Bold").fillColor(COLORS.darkGray);
  doc.text(t("deposit"), margin, y);
  doc.fontSize(10).font("Helvetica").fillColor(COLORS.blue);
  doc.text(formatCurrency(depositAmount), pageWidth - margin - 100, y, {
    align: "right",
    width: 100,
  });

  y += 25;

  // Balance row
  doc.fontSize(10).font("Helvetica-Bold").fillColor(COLORS.darkGray);
  doc.text(t("balanceBeforeDelivery"), margin, y);
  doc.fontSize(10).font("Helvetica").fillColor(COLORS.blue);
  doc.text(formatCurrency(balanceAmount), pageWidth - margin - 100, y, {
    align: "right",
    width: 100,
  });

  y += 25;

  // Payment details
  doc.fontSize(9).fillColor(COLORS.mediumGray).font("Helvetica");
  doc.text(t("paymentDetails"), margin, y, { width: contentWidth, align: "left" });

  // ═══════════════════════════════════════════════════════════════════════════════
  // PAGE 2 - TERMS & CONDITIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  doc.addPage();
  y = margin;

  // Validity Section
  y = drawSection(y, language === "fr" ? "Validité de la soumission" : "Quote Validity");

  doc.fontSize(10).fillColor(COLORS.darkGray).font("Helvetica");
  doc.text(t("validity"), margin, y, { width: contentWidth });

  y += 40;

  // Footer section
  y = drawSection(y, t("contactInfo"));

  doc.fontSize(10).fillColor(COLORS.darkGray).font("Helvetica");

  const footerLines = [
    `${t("kwhQuebec")}`,
    `${t("phone")}: ${options.companyPhone || "514-427-8871"}`,
    `${t("email")}: ${options.companyEmail || "info@kwhquebec.com"}`,
  ];

  if (options.companyAddress) {
    footerLines.push(options.companyAddress);
  }

  footerLines.forEach((line, index) => {
    doc.text(line, margin, y + index * 18);
  });

  // Add page numbers to all pages
  const pages = doc.bufferedPageRange().count;
  for (let i = 0; i < pages; i++) {
    doc.switchToPage(i);

    // Page number footer
    doc.fontSize(8).fillColor(COLORS.lightGray).font("Helvetica");
    doc.text(
      `Page ${i + 1} of ${pages}`,
      margin,
      pageHeight - 30,
      { align: "center", width: contentWidth }
    );
  }

  // Collect PDF output to buffer
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    doc.on("error", (error: Error) => {
      reject(error);
    });

    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    doc.end();
  });
}

