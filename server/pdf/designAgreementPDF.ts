import { COLORS } from "./types";

interface DesignAgreementData {
  id: string;
  site: {
    name: string;
    address?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    client: {
      name: string;
      email?: string;
      phone?: string;
    };
  };
  quotedCosts: {
    siteVisit?: {
      numBuildings?: number;
      travelDays?: number;
      travel?: number;
      visit?: number;
      evaluation?: number;
      diagrams?: number;
      sldSupplement?: number;
      total?: number;
    } | null;
    additionalFees?: Array<{ description: string; amount: number }>;
    subtotal?: number;
    taxes?: { gst?: number; qst?: number };
    total?: number;
  };
  totalCad: number;
  paymentTerms?: string;
  validUntil?: Date | string | null;
  createdAt?: Date | string | null;
}

export function generateDesignAgreementPDF(
  doc: PDFKit.PDFDocument,
  agreement: DesignAgreementData,
  lang: "fr" | "en" = "fr"
): void {
  const t = (fr: string, en: string) => (lang === "fr" ? fr : en);
  const pageWidth = 612;
  const margin = 50;
  const contentWidth = pageWidth - 2 * margin;

  const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) {
      return "0,00 $";
    }
    return `${value.toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
  };

  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return "-";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  let y = margin;

  doc.rect(0, 0, pageWidth, 120).fill(COLORS.blue);
  doc.fontSize(24).fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text("kWh Québec", margin, 35, { width: contentWidth });
  doc.fontSize(16).font("Helvetica");
  doc.text(t("Mandat de conception - Étape 3", "Design Mandate - Step 3"), margin, 65, { width: contentWidth });
  doc.fontSize(10);
  doc.text(t("Votre première étape vers un projet solaire", "Your first step toward a solar project"), margin, 90, { width: contentWidth });

  y = 140;

  doc.fontSize(12).fillColor(COLORS.darkGray).font("Helvetica-Bold");
  doc.text(t("Client:", "Client:"), margin, y);
  doc.font("Helvetica");
  doc.text(agreement.site.client.name, margin + 60, y);
  y += 18;

  doc.font("Helvetica-Bold");
  doc.text(t("Site:", "Site:"), margin, y);
  doc.font("Helvetica");
  const siteAddress = [
    agreement.site.name,
    agreement.site.address,
    [agreement.site.city, agreement.site.province, agreement.site.postalCode].filter(Boolean).join(", "),
  ].filter(Boolean).join("\n");
  doc.text(siteAddress, margin + 60, y, { width: contentWidth - 60 });
  y += 50;

  doc.font("Helvetica-Bold");
  doc.text(t("Date:", "Date:"), margin, y);
  doc.font("Helvetica");
  doc.text(formatDate(agreement.createdAt), margin + 60, y);
  y += 18;

  doc.font("Helvetica-Bold");
  doc.text(t("Valide jusqu'au:", "Valid until:"), margin, y);
  doc.font("Helvetica");
  doc.text(formatDate(agreement.validUntil), margin + 100, y);
  y += 35;

  doc.rect(margin, y, contentWidth, 2).fill(COLORS.gold);
  y += 20;

  doc.fontSize(14).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Détail des coûts", "Cost Breakdown"), margin, y);
  y += 25;

  doc.fontSize(11).fillColor(COLORS.darkGray).font("Helvetica-Bold");
  doc.text(t("Visite technique et évaluation:", "Technical Visit & Evaluation:"), margin, y);
  y += 20;

  const siteVisit = agreement.quotedCosts?.siteVisit;
  doc.font("Helvetica").fontSize(10);

  const costLines: Array<{ label: string; value: number | undefined }> = [];

  if (siteVisit?.travel && siteVisit.travel > 0) {
    costLines.push({ label: t("Frais de déplacement", "Travel costs"), value: siteVisit.travel });
  }
  costLines.push({ label: t("Visite sur site", "Site visit"), value: siteVisit?.visit });
  costLines.push({ label: t("Évaluation technique", "Technical evaluation"), value: siteVisit?.evaluation });
  costLines.push({ label: t("Dessins techniques", "Technical drawings"), value: siteVisit?.diagrams });
  if (siteVisit?.sldSupplement && siteVisit.sldSupplement > 0) {
    costLines.push({ label: t("Supplément schéma unifilaire", "SLD supplement"), value: siteVisit.sldSupplement });
  }

  costLines.forEach(line => {
    doc.text(line.label, margin + 20, y);
    doc.text(formatCurrency(line.value), margin + contentWidth - 120, y, { width: 100, align: "right" });
    y += 18;
  });

  y += 10;
  doc.rect(margin + 20, y, contentWidth - 40, 1).fill(COLORS.lightGray);
  y += 15;

  doc.font("Helvetica-Bold");
  doc.text(t("Sous-total", "Subtotal"), margin + 20, y);
  doc.text(formatCurrency(agreement.quotedCosts?.subtotal), margin + contentWidth - 120, y, { width: 100, align: "right" });
  y += 18;

  doc.font("Helvetica").fillColor(COLORS.mediumGray);
  doc.text(t("TPS (5%)", "GST (5%)"), margin + 20, y);
  doc.text(formatCurrency(agreement.quotedCosts?.taxes?.gst), margin + contentWidth - 120, y, { width: 100, align: "right" });
  y += 18;

  doc.text(t("TVQ (9.975%)", "QST (9.975%)"), margin + 20, y);
  doc.text(formatCurrency(agreement.quotedCosts?.taxes?.qst), margin + contentWidth - 120, y, { width: 100, align: "right" });
  y += 18;

  y += 5;
  doc.rect(margin + 20, y, contentWidth - 40, 2).fill(COLORS.blue);
  y += 12;

  doc.fontSize(13).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("TOTAL", "TOTAL"), margin + 20, y);
  doc.text(formatCurrency(agreement.totalCad), margin + contentWidth - 120, y, { width: 100, align: "right" });
  y += 40;

  doc.fontSize(14).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Livrables inclus", "Included Deliverables"), margin, y);
  y += 22;

  doc.fontSize(10).fillColor(COLORS.darkGray).font("Helvetica");
  const deliverables = [
    t("Visite technique complète du site", "Complete technical site visit"),
    t("Rapport d'évaluation technique", "Technical evaluation report"),
    t("Dessins d'implantation PV", "PV layout drawings"),
    t("Schéma unifilaire (si requis)", "Single line diagram (if required)"),
    t("Soumission détaillée à prix fixe", "Detailed fixed-price quote"),
  ];

  deliverables.forEach(item => {
    doc.text("✓  " + item, margin + 20, y);
    y += 18;
  });

  y += 20;

  doc.fontSize(12).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Modalités de paiement", "Payment Terms"), margin, y);
  y += 18;

  doc.fontSize(10).fillColor(COLORS.darkGray).font("Helvetica");
  doc.text(
    agreement.paymentTerms || t("50% à la signature, 50% à la livraison des dessins", "50% at signing, 50% at drawing delivery"),
    margin + 20, y, { width: contentWidth - 40 }
  );
  y += 40;

  doc.rect(margin, y, contentWidth, 70).fillAndStroke("#F0F4F8", COLORS.blue);
  doc.fontSize(10).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Pour accepter cette entente:", "To accept this agreement:"), margin + 20, y + 15);
  doc.font("Helvetica").fillColor(COLORS.darkGray);
  doc.text(t("Contactez-nous à info@kwh.quebec ou appelez-nous.", "Contact us at info@kwh.quebec or call us."), margin + 20, y + 32);
  doc.text("www.kwh.quebec", margin + 20, y + 48);

  doc.fontSize(8).fillColor(COLORS.lightGray);
  doc.text(
    t("Document confidentiel | kWh Québec", "Confidential document | kWh Québec"),
    margin, 760, { align: "center", width: contentWidth }
  );
}
