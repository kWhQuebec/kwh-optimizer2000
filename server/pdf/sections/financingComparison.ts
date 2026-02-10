import type { PDFContext } from "../types";
import { COLORS } from "../types";
import { drawSimpleHeader, formatCurrency, drawRoundedRect } from "../helpers";

export function renderFinancingComparison(ctx: PDFContext) {
  const { doc, simulation, t, margin, contentWidth, pageWidth, pageHeight } = ctx;

  const capexNet = Number(simulation.capexNet || 0);
  const savingsYear1 = simulation.savingsYear1 || 0;
  const paybackYears = simulation.simplePaybackYears || 0;
  const npv25 = simulation.npv25 || 0;

  if (capexNet <= 0) return;

  doc.addPage();
  drawSimpleHeader(ctx);
  doc.moveDown(2);

  doc.fontSize(22).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("OPTIONS D'ACQUISITION", "ACQUISITION OPTIONS"), margin, doc.y);
  doc.font("Helvetica");
  doc.y += 8;
  doc.rect(margin, doc.y, 200, 3).fillColor(COLORS.gold).fill();
  doc.y += 25;

  const loanRate = 0.05;
  const loanTermMonths = 120;
  const loanMonthlyRate = loanRate / 12;
  const loanPayment = capexNet * loanMonthlyRate / (1 - Math.pow(1 + loanMonthlyRate, -loanTermMonths));
  const loanAnnual = loanPayment * 12;
  const loanNetYear1 = savingsYear1 - loanAnnual;

  const leaseRate = 0.07;
  const leaseTermMonths = 180;
  const leaseMonthlyRate = leaseRate / 12;
  const leasePayment = capexNet * leaseMonthlyRate / (1 - Math.pow(1 + leaseMonthlyRate, -leaseTermMonths));
  const leaseAnnual = leasePayment * 12;
  const leaseNetYear1 = savingsYear1 - leaseAnnual;

  const cardWidth = (contentWidth - 20) / 3;
  const cardHeight = 220;
  const cardY = doc.y;

  const options = [
    {
      title: t("COMPTANT", "CASH"),
      highlight: true,
      lines: [
        { label: t("Investissement", "Investment"), value: formatCurrency(capexNet), bold: true },
        { label: t("Économies An 1", "Year 1 Savings"), value: formatCurrency(savingsYear1), bold: false },
        { label: t("Retour", "Payback"), value: `${Number(paybackYears).toFixed(1)} ${t("ans", "yrs")}`, bold: false },
        { label: t("Profit 25 ans (VAN)", "25-yr Profit (NPV)"), value: formatCurrency(npv25), bold: true },
      ],
      badge: null,
    },
    {
      title: t("FINANCEMENT", "LOAN"),
      highlight: false,
      lines: [
        { label: t("Taux / Terme", "Rate / Term"), value: `5 % / 10 ${t("ans", "yrs")}`, bold: false },
        { label: t("Paiement mensuel", "Monthly Payment"), value: formatCurrency(loanPayment), bold: true },
        { label: t("Économies An 1", "Year 1 Savings"), value: formatCurrency(savingsYear1), bold: false },
        { label: t("Net An 1", "Net Year 1"), value: formatCurrency(loanNetYear1), bold: true },
      ],
      badge: null,
    },
    {
      title: t("LOCATION", "LEASE"),
      highlight: false,
      lines: [
        { label: t("Taux / Terme", "Rate / Term"), value: `7 % / 15 ${t("ans", "yrs")}`, bold: false },
        { label: t("Paiement mensuel", "Monthly Payment"), value: formatCurrency(leasePayment), bold: true },
        { label: t("Économies An 1", "Year 1 Savings"), value: formatCurrency(savingsYear1), bold: false },
        { label: t("Net An 1", "Net Year 1"), value: formatCurrency(leaseNetYear1), bold: true },
      ],
      badge: null,
    },
  ];

  options.forEach((opt, i) => {
    const x = margin + i * (cardWidth + 10);

    const bgColor = opt.highlight ? "#FFFBEB" : COLORS.white;
    const borderColor = opt.highlight ? COLORS.gold : "#E0E0E0";
    drawRoundedRect(doc, x, cardY, cardWidth, cardHeight, 8, bgColor);
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 8).strokeColor(borderColor).lineWidth(opt.highlight ? 2 : 1).stroke();

    const titleBg = opt.highlight ? COLORS.gold : COLORS.blue;
    drawRoundedRect(doc, x, cardY, cardWidth, 35, 8, titleBg);
    doc.rect(x, cardY + 20, cardWidth, 15).fillColor(titleBg).fill();

    doc.fontSize(12).fillColor(COLORS.white).font("Helvetica-Bold");
    doc.text(opt.title, x, cardY + 10, { width: cardWidth, align: "center" });
    doc.font("Helvetica");

    if (opt.badge) {
      const badgeWidth = 100;
      const badgeX = x + (cardWidth - badgeWidth) / 2;
      const badgeY = cardY + 36;
      drawRoundedRect(doc, badgeX, badgeY, badgeWidth, 16, 8, COLORS.gold);
      doc.fontSize(7).fillColor(COLORS.white).font("Helvetica-Bold");
      doc.text(opt.badge, badgeX, badgeY + 4, { width: badgeWidth, align: "center" });
      doc.font("Helvetica");
    }

    let lineY = cardY + (opt.badge ? 60 : 45);
    opt.lines.forEach((line) => {
      doc.fontSize(8).fillColor(COLORS.lightGray);
      doc.text(line.label, x + 10, lineY, { width: cardWidth - 20 });
      lineY += 12;
      doc.fontSize(line.bold ? 14 : 11).fillColor(line.bold ? COLORS.blue : COLORS.darkGray).font(line.bold ? "Helvetica-Bold" : "Helvetica");
      doc.text(line.value, x + 10, lineY, { width: cardWidth - 20 });
      doc.font("Helvetica");
      lineY += 22;
    });
  });

  doc.y = cardY + cardHeight + 15;

  doc.fontSize(8).fillColor(COLORS.lightGray);
  doc.text(t(
    "Les taux et termes sont indicatifs. Les options d'acquisition seront précisées dans la soumission ferme.",
    "Rates and terms are indicative. Acquisition options will be detailed in the firm quote."
  ), margin, doc.y, { width: contentWidth, align: "center" });
}
