import type { PDFContext } from "../types";
import { COLORS } from "../types";
import { drawRoundedRect, drawPageHeader, drawPageFooter } from "../helpers";
import { formatSmartPower, formatSmartEnergy } from "../helpers";
import { getEquipment, getBatteryEquipment } from "@shared/brandContent";

/**
 * System Elements page — Shows the system architecture as a flow diagram
 * with component details and operating modes.
 * Addresses Oleg's "System Elements one-pager" suggestion.
 */
export function renderSystemElements(ctx: PDFContext) {
  const { doc, t, margin, contentWidth, simulation } = ctx;

  doc.addPage();
  drawPageHeader(ctx, t("ÉLÉMENTS DU SYSTÈME", "SYSTEM ELEMENTS"));
  doc.y = ctx.headerHeight + 25;

  // Section title
  doc.fontSize(16).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("ARCHITECTURE DU SYSTÈME", "SYSTEM ARCHITECTURE"), margin, doc.y);
  doc.font("Helvetica");
  doc.y += 5;
  doc.rect(margin, doc.y, 200, 2).fillColor(COLORS.gold).fill();
  doc.y += 20;

  // ---- FLOW DIAGRAM ----
  // Panneaux → Onduleur → [Batterie] → Charges → Réseau
  const hasBattery = simulation.battEnergyKWh > 0;
  const boxes = [
    {
      labelTop: t("Panneaux solaires", "Solar Panels"),
      labelBottom: formatSmartPower(simulation.pvSizeKW, ctx.lang),
      color: COLORS.gold,
      textColor: COLORS.darkGray,
    },
    {
      labelTop: t("Onduleur(s)", "Inverter(s)"),
      labelBottom: t("Conversion DC → AC", "DC → AC Conversion"),
      color: COLORS.blue,
      textColor: COLORS.white,
    },
  ];

  if (hasBattery) {
    boxes.push({
      labelTop: t("Batterie BESS", "BESS Battery"),
      labelBottom: `${formatSmartEnergy(simulation.battEnergyKWh, ctx.lang)} / ${formatSmartPower(simulation.battPowerKW, ctx.lang, "kW")}`,
      color: "#059669",
      textColor: COLORS.white,
    });
  }

  boxes.push({
    labelTop: t("Charges du bâtiment", "Building Loads"),
    labelBottom: `${formatSmartEnergy(simulation.annualConsumptionKWh, ctx.lang)}${t("/an", "/yr")}`,
    color: COLORS.darkGray,
    textColor: COLORS.white,
  });

  boxes.push({
    labelTop: t("Réseau HQ", "HQ Grid"),
    labelBottom: t("Surplus / Appoint", "Surplus / Backup"),
    color: COLORS.lightGray,
    textColor: COLORS.darkGray,
  });

  const boxCount = boxes.length;
  const arrowSpace = 20;
  const totalArrows = boxCount - 1;
  const availableWidth = contentWidth - totalArrows * arrowSpace;
  const boxW = Math.min(availableWidth / boxCount, 110);
  const boxH = 52;
  const startX = margin + (contentWidth - (boxCount * boxW + totalArrows * arrowSpace)) / 2;
  const flowY = doc.y;

  boxes.forEach((box, i) => {
    const bx = startX + i * (boxW + arrowSpace);
    drawRoundedRect(doc, bx, flowY, boxW, boxH, 6, box.color);

    doc.fontSize(8).fillColor(box.textColor).font("Helvetica-Bold");
    doc.text(box.labelTop, bx + 4, flowY + 10, { width: boxW - 8, align: "center" });
    doc.font("Helvetica").fontSize(7);
    doc.text(box.labelBottom, bx + 4, flowY + 28, { width: boxW - 8, align: "center" });

    // Arrow
    if (i < boxCount - 1) {
      const arrowX = bx + boxW + 2;
      const arrowY = flowY + boxH / 2;
      doc.fontSize(14).fillColor(COLORS.gold).font("Helvetica-Bold");
      doc.text("→", arrowX, arrowY - 7, { width: arrowSpace - 4, align: "center" });
      doc.font("Helvetica");
    }
  });

  doc.y = flowY + boxH + 20;

  // ---- COMPONENT DETAILS TABLE ----
  doc.fontSize(12).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("DÉTAIL DES COMPOSANTS", "COMPONENT DETAILS"), margin, doc.y);
  doc.font("Helvetica");
  doc.y += 3;
  doc.rect(margin, doc.y, 140, 2).fillColor(COLORS.gold).fill();
  doc.y += 10;

  // Use catalog if available, otherwise brandContent
  const equipData = ctx.catalogEquipment && ctx.catalogEquipment.length > 0
    ? ctx.catalogEquipment.map(eq => ({
        component: eq.name,
        manufacturer: eq.manufacturer,
        spec: eq.spec,
        warranty: eq.warranty,
      }))
    : getEquipment(ctx.lang).map(eq => ({
        component: eq.label,
        manufacturer: eq.manufacturer,
        spec: eq.specs || "—",
        warranty: eq.warranty,
      }));

  // Add battery row if applicable
  if (hasBattery && !(ctx.catalogEquipment && ctx.catalogEquipment.length > 0)) {
    const batt = getBatteryEquipment(ctx.lang);
    equipData.push({
      component: batt.label,
      manufacturer: batt.manufacturer,
      spec: batt.specs || "—",
      warranty: batt.warranty,
    });
  }

  const colWidths = [contentWidth * 0.28, contentWidth * 0.18, contentWidth * 0.34, contentWidth * 0.20];
  const headers = [
    t("Composant", "Component"),
    t("Fabricant", "Manufacturer"),
    t("Spécification", "Specification"),
    t("Garantie", "Warranty"),
  ];
  const rowH = 18;

  // Table header
  let tableY = doc.y;
  drawRoundedRect(doc, margin, tableY, contentWidth, rowH, 0, COLORS.blue);
  doc.fontSize(7).fillColor(COLORS.white).font("Helvetica-Bold");
  let colX = margin;
  headers.forEach((h, i) => {
    doc.text(h, colX + 6, tableY + 5, { width: colWidths[i] - 12 });
    colX += colWidths[i];
  });
  doc.font("Helvetica");
  tableY += rowH;

  // Table rows
  equipData.forEach((row, i) => {
    const bg = i % 2 === 0 ? COLORS.background : COLORS.white;
    drawRoundedRect(doc, margin, tableY, contentWidth, rowH, 0, bg);
    doc.fontSize(7).fillColor(COLORS.darkGray);

    const vals = [row.component, row.manufacturer, row.spec, row.warranty];
    colX = margin;
    vals.forEach((val, ci) => {
      if (ci === 3) {
        doc.font("Helvetica-Bold").fillColor(COLORS.blue);
      }
      doc.text(val, colX + 6, tableY + 5, { width: colWidths[ci] - 12 });
      if (ci === 3) {
        doc.font("Helvetica").fillColor(COLORS.darkGray);
      }
      colX += colWidths[ci];
    });
    tableY += rowH;
  });

  doc.y = tableY + 15;

  // ---- OPERATING MODES ----
  doc.fontSize(12).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("MODES D'OPÉRATION", "OPERATING MODES"), margin, doc.y);
  doc.font("Helvetica");
  doc.y += 3;
  doc.rect(margin, doc.y, 140, 2).fillColor(COLORS.gold).fill();
  doc.y += 10;

  const modes = [
    {
      icon: "☀️",
      title: t("Autoconsommation", "Self-consumption"),
      desc: t(
        "La production solaire alimente directement vos charges. Priorité #1.",
        "Solar production directly powers your loads. Priority #1."
      ),
    },
    {
      icon: "📤",
      title: t("Injection surplus", "Surplus export"),
      desc: t(
        "Le surplus est injecté au réseau HQ et crédité sur votre facture (mesurage net).",
        "Surplus is exported to HQ grid and credited to your bill (net metering)."
      ),
    },
  ];

  if (hasBattery) {
    modes.splice(1, 0, {
      icon: "🔋",
      title: t("Stockage / Écrêtage", "Storage / Peak Shaving"),
      desc: t(
        `La batterie réduit vos pointes de demande et optimise l'autoconsommation. Seuil: ${simulation.demandShavingSetpointKW > 0 ? `${simulation.demandShavingSetpointKW.toFixed(0)} kW` : "Auto"}`,
        `Battery reduces peak demand and optimizes self-consumption. Setpoint: ${simulation.demandShavingSetpointKW > 0 ? `${simulation.demandShavingSetpointKW.toFixed(0)} kW` : "Auto"}`
      ),
    });
    modes.push({
      icon: "🛡️",
      title: t("Secours", "Backup"),
      desc: t(
        "En cas de panne, la batterie alimente les charges critiques.",
        "During outages, the battery powers critical loads."
      ),
    });
  }

  const modeColW = (contentWidth - (modes.length - 1) * 8) / modes.length;
  const modeH = 70;
  const modeY = doc.y;

  modes.forEach((mode, i) => {
    const mx = margin + i * (modeColW + 8);
    drawRoundedRect(doc, mx, modeY, modeColW, modeH, 6, COLORS.background);
    doc.roundedRect(mx, modeY, modeColW, modeH, 6).strokeColor(COLORS.borderGray).lineWidth(0.5).stroke();

    doc.fontSize(9).fillColor(COLORS.blue).font("Helvetica-Bold");
    doc.text(`${mode.icon} ${mode.title}`, mx + 8, modeY + 8, { width: modeColW - 16 });
    doc.font("Helvetica").fontSize(7).fillColor(COLORS.mediumGray);
    doc.text(mode.desc, mx + 8, modeY + 26, { width: modeColW - 16 });
  });

  doc.y = modeY + modeH + 10;

  // Disclaimer
  doc.fontSize(7).fillColor(COLORS.mediumGray);
  doc.text(
    t(
      "Équipement et configuration indicatifs — confirmés dans la soumission forfaitaire après conception détaillée.",
      "Indicative equipment and configuration — confirmed in the firm quote after detailed design."
    ),
    margin,
    doc.y,
    { width: contentWidth, align: "center" }
  );

  drawPageFooter(
    ctx,
    t("Document confidentiel | Généré par kWh Québec | Éléments du système", "Confidential document | Generated by kWh Québec | System elements")
  );
}
