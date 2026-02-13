import { KBRackingEstimate, KB_RACKING_SPECS } from "./kbRackingEstimator";
import {
  BRAND_COLORS,
  PAGE_SIZES,
  DEFAULT_THEME,
  drawModernHeader,
  drawModernFooter,
  drawSectionTitle,
  drawTable,
  drawStatBox,
  createDocument,
  collectBuffer,
} from "./pdfTemplates";

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

const TEXTS: Record<Language, Record<string, string>> = {
  fr: {
    title: "Proposition de Système de Fixation Solaire",
    subtitle: "SOUMISSION",
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
    description: "Description",
    quantity: "Quantité",
    amount: "Montant",
    paymentDetails:
      "Un dépôt de 20% est requis pour confirmer la commande. Le solde de 80% est dû avant la livraison.",
    validity: "Cette soumission est valide pour 30 jours à partir de la date ci-dessus.",
    validityTitle: "Validité de la soumission",
    contactInfo: "Pour plus d'information, contactez-nous",
    kwhQuebec: "kWh Québec Inc.",
    phone: "Tél",
    email: "Courriel",
    footerLeft: "kWh Québec Inc.",
    footerCenter: "Confidentiel",
  },
  en: {
    title: "Solar Racking System Proposal",
    subtitle: "QUOTE",
    quoteNumber: "Quote Number",
    date: "Date",
    validUntil: "Valid Until",
    siteInformation: "Site Information",
    systemSpecifications: "System Specifications",
    costBreakdown: "Cost Breakdown",
    paymentTerms: "Payment Terms",
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
    description: "Description",
    quantity: "Quantity",
    amount: "Amount",
    paymentDetails:
      "A deposit of 20% is required to confirm the order. The remaining 80% balance is due before delivery.",
    validity: "This quote is valid for 30 days from the date above.",
    validityTitle: "Quote Validity",
    contactInfo: "For more information, please contact us",
    kwhQuebec: "kWh Québec Inc.",
    phone: "Phone",
    email: "Email",
    footerLeft: "kWh Québec Inc.",
    footerCenter: "Confidential",
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

  const doc = createDocument("letter");
  const bufferPromise = collectBuffer(doc);

  const { width: pageWidth, height: pageHeight } = PAGE_SIZES.letter;
  const margin = DEFAULT_THEME.margin;
  const contentWidth = pageWidth - 2 * margin;

  const formatCurrency = (value: number): string => {
    return `$${value.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (date: Date): string => {
    const dateOptions: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: language === "fr" ? "long" : "short",
      day: "numeric",
    };
    return date.toLocaleDateString(language === "fr" ? "fr-CA" : "en-CA", dateOptions);
  };

  let y = drawModernHeader(doc, {
    title: t("title"),
    subtitle: t("subtitle"),
    pageWidth,
    theme: DEFAULT_THEME,
  });

  doc.fontSize(10).fillColor(BRAND_COLORS.mediumText).font("Helvetica");
  doc.text(`${t("quoteNumber")}: ${options.quoteNumber || "KB-2025-001"}`, margin, y);
  y += 16;
  doc.text(`${t("date")}: ${formatDate(quoteDate)}`, margin, y);
  y += 16;
  doc.text(`${t("validUntil")}: ${formatDate(validUntilDate)}`, margin, y);
  y += 25;

  y = drawSectionTitle(doc, {
    x: margin,
    y,
    title: t("siteInformation"),
    width: contentWidth,
    theme: DEFAULT_THEME,
  });

  const drawLabelValue = (yPos: number, label: string, value: string): number => {
    doc.fontSize(10).fillColor(BRAND_COLORS.lightText).font("Helvetica");
    doc.text(label + ":", margin, yPos, { continued: true, width: 150 });
    doc.fillColor(BRAND_COLORS.darkText).font("Helvetica");
    doc.text(" " + value, { continued: false });
    return yPos + 18;
  };

  y = drawLabelValue(y, t("location"), siteData.city || "");
  y = drawLabelValue(
    y,
    t("address"),
    `${siteData.address || ""}${siteData.postalCode ? " " + siteData.postalCode : ""}`
  );
  if (siteData.buildingType) {
    y = drawLabelValue(y, t("buildingType"), siteData.buildingType);
  }

  y += 15;

  y = drawSectionTitle(doc, {
    x: margin,
    y,
    title: t("systemSpecifications"),
    width: contentWidth,
    theme: DEFAULT_THEME,
  });

  y = drawLabelValue(y, t("panelCount"), estimate.panelCount.toString());
  y = drawLabelValue(
    y,
    t("panelModel"),
    `Jinko Solar Tiger Neo 625W ${language === "fr" ? "Bifacial" : "Bifacial"}`
  );
  y = drawLabelValue(y, t("panelPower"), "625 W");
  y = drawLabelValue(y, t("totalCapacity"), `${estimate.kwDc.toFixed(2)} kW`);
  y = drawLabelValue(y, t("rackingSystem"), KB_RACKING_SPECS.systemName);

  y += 20;

  y = drawSectionTitle(doc, {
    x: margin,
    y,
    title: t("costBreakdown"),
    width: contentWidth,
    theme: DEFAULT_THEME,
  });

  if (y + 140 > pageHeight - margin - DEFAULT_THEME.footerHeight) {
    doc.addPage();
    y = margin;
  }

  const tableHeaders = [t("description"), t("quantity"), t("amount")];
  const tableRows = [
    [
      t("rackingCost"),
      `${estimate.panelCount} × $${estimate.pricePerPanel.toFixed(2)}/panel`,
      formatCurrency(estimate.rackingSubtotal),
    ],
    [t("shippingHandling"), "1", formatCurrency(estimate.shippingEstimate)],
    [t("engineering"), "1", formatCurrency(estimate.engineeringCost)],
  ];

  y = drawTable(doc, {
    x: margin,
    y,
    width: contentWidth,
    headers: tableHeaders,
    rows: tableRows,
    columnWidths: [contentWidth * 0.5, contentWidth * 0.25, contentWidth * 0.25],
    theme: DEFAULT_THEME,
  });

  y += 15;

  const totalCost = estimate.rackingSubtotal + estimate.shippingEstimate + estimate.engineeringCost;
  const depositAmount = totalCost * 0.2;
  const balanceAmount = totalCost * 0.8;

  const statBoxWidth = (contentWidth - 20) / 3;
  const statBoxHeight = 70;

  drawStatBox(doc, {
    x: margin,
    y,
    width: statBoxWidth,
    height: statBoxHeight,
    value: formatCurrency(totalCost),
    label: t("total"),
    theme: DEFAULT_THEME,
  });

  drawStatBox(doc, {
    x: margin + statBoxWidth + 10,
    y,
    width: statBoxWidth,
    height: statBoxHeight,
    value: formatCurrency(depositAmount),
    label: t("deposit"),
    theme: DEFAULT_THEME,
  });

  drawStatBox(doc, {
    x: margin + (statBoxWidth + 10) * 2,
    y,
    width: statBoxWidth,
    height: statBoxHeight,
    value: formatCurrency(balanceAmount),
    label: t("balanceBeforeDelivery"),
    theme: DEFAULT_THEME,
  });

  y += statBoxHeight + 25;

  y = drawSectionTitle(doc, {
    x: margin,
    y,
    title: t("paymentTerms"),
    width: contentWidth,
    theme: DEFAULT_THEME,
  });

  doc.fontSize(10).fillColor(BRAND_COLORS.mediumText).font("Helvetica");
  doc.text(t("paymentDetails"), margin, y, { width: contentWidth, align: "left" });
  y = doc.y + 20;

  doc.addPage();
  y = margin + 20;

  y = drawSectionTitle(doc, {
    x: margin,
    y,
    title: t("validityTitle"),
    width: contentWidth,
    theme: DEFAULT_THEME,
  });

  doc.fontSize(10).fillColor(BRAND_COLORS.mediumText).font("Helvetica");
  doc.text(t("validity"), margin, y, { width: contentWidth });
  y = doc.y + 30;

  y = drawSectionTitle(doc, {
    x: margin,
    y,
    title: t("contactInfo"),
    width: contentWidth,
    theme: DEFAULT_THEME,
  });

  doc.fontSize(10).fillColor(BRAND_COLORS.darkText).font("Helvetica");
  doc.text(t("kwhQuebec"), margin, y);
  y += 16;
  doc.text(`${t("phone")}: ${options.companyPhone || "514-427-8871"}`, margin, y);
  y += 16;
  doc.text(`${t("email")}: ${options.companyEmail || "info@kwh.quebec"}`, margin, y);
  y += 16;

  if (options.companyAddress) {
    doc.text(options.companyAddress, margin, y);
  }

  const pages = doc.bufferedPageRange().count;
  for (let i = 0; i < pages; i++) {
    doc.switchToPage(i);
    drawModernFooter(doc, {
      leftText: t("footerLeft"),
      centerText: t("footerCenter"),
      rightText: `Page ${i + 1} / ${pages}`,
      pageWidth,
      pageHeight,
      theme: DEFAULT_THEME,
    });
  }

  doc.end();
  return bufferPromise;
}
