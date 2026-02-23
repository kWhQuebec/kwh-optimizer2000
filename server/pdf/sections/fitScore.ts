import type { PDFContext } from "../types";
import { COLORS } from "../types";
import { drawRoundedRect, drawPageHeader, drawPageFooter, formatCurrency, formatPercent } from "../helpers";
import { computeFitScore, type FitScoreResult } from "@shared/fitScore";

/**
 * Desktop Screening / Fit Score page — Shows the project feasibility score
 * with individual criteria breakdown and a visual gauge.
 * Addresses Oleg's "Desktop Screening Summary" suggestion.
 */
export function renderFitScore(ctx: PDFContext) {
  const { doc, t, margin, contentWidth, simulation } = ctx;

  // Compute the fit score
  const fitResult = computeFitScore({
    simplePaybackYears: simulation.simplePaybackYears,
    irr25: simulation.irr25,
    annualSavings: simulation.annualSavings,
    annualCostBefore: simulation.annualCostBefore,
    selfSufficiencyPercent: simulation.selfSufficiencyPercent,
    capexNet: simulation.capexNet,
  });

  doc.addPage();
  drawPageHeader(ctx, t("ÉVALUATION DE FAISABILITÉ", "FEASIBILITY ASSESSMENT"));
  doc.y = ctx.headerHeight + 25;

  // Section title
  doc.fontSize(16).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("ÉVALUATION DE FAISABILITÉ", "FEASIBILITY ASSESSMENT"), margin, doc.y);
  doc.font("Helvetica");
  doc.y += 5;
  doc.rect(margin, doc.y, 200, 2).fillColor(COLORS.gold).fill();
  doc.y += 20;

  // ---- SCORE GAUGE ----
  const gaugeY = doc.y;
  const gaugeWidth = 200;
  const gaugeHeight = 80;
  const gaugeCenterX = margin + contentWidth / 2;

  // Score circle
  const circleR = 38;
  const circleX = gaugeCenterX;
  const circleY = gaugeY + circleR + 2;

  // Background circle
  doc.circle(circleX, circleY, circleR).fillColor(COLORS.background).fill();
  doc.circle(circleX, circleY, circleR).strokeColor(fitResult.color).lineWidth(3).stroke();

  // Score number
  doc.fontSize(28).fillColor(fitResult.color).font("Helvetica-Bold");
  doc.text(`${fitResult.score}`, circleX - 30, circleY - 18, { width: 60, align: "center" });
  doc.fontSize(9).fillColor(COLORS.mediumGray).font("Helvetica");
  doc.text("/ 100", circleX - 20, circleY + 12, { width: 40, align: "center" });

  // Label below
  const labelText = ctx.lang === "fr" ? fitResult.labelFr : fitResult.labelEn;
  doc.fontSize(14).fillColor(fitResult.color).font("Helvetica-Bold");
  doc.text(labelText, margin, circleY + circleR + 8, { width: contentWidth, align: "center" });
  doc.font("Helvetica");

  doc.y = circleY + circleR + 30;

  // ---- CRITERIA BREAKDOWN ----
  doc.fontSize(12).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("CRITÈRES D'ÉVALUATION", "EVALUATION CRITERIA"), margin, doc.y);
  doc.font("Helvetica");
  doc.y += 3;
  doc.rect(margin, doc.y, 160, 2).fillColor(COLORS.gold).fill();
  doc.y += 10;

  // Individual factor scores — from computeFitScore (single source of truth)
  const factors = fitResult.factors.map(f => ({
    label: ctx.lang === "fr" ? f.labelFr : f.labelEn,
    displayValue: f.displayValue,
    score: f.score,
    maxScore: f.maxScore,
    barColor: f.barColor,
    assessment: ctx.lang === "fr" ? f.assessmentFr : f.assessmentEn,
  }));

  const fColWidths = [contentWidth * 0.30, contentWidth * 0.25, contentWidth * 0.20, contentWidth * 0.25];
  const fHeaders = [
    t("Critère", "Criterion"),
    t("Valeur", "Value"),
    t("Score", "Score"),
    t("Évaluation", "Assessment"),
  ];
  const fRowH = 20;

  // Table header
  let tableY = doc.y;
  drawRoundedRect(doc, margin, tableY, contentWidth, 16, 0, COLORS.blue);
  doc.fontSize(7).fillColor(COLORS.white).font("Helvetica-Bold");
  let colX = margin;
  fHeaders.forEach((h, i) => {
    doc.text(h, colX + 6, tableY + 4, { width: fColWidths[i] - 12 });
    colX += fColWidths[i];
  });
  doc.font("Helvetica");
  tableY += 16;

  factors.forEach((f, i) => {
    const bg = i % 2 === 0 ? COLORS.background : COLORS.white;
    drawRoundedRect(doc, margin, tableY, contentWidth, fRowH, 0, bg);

    colX = margin;

    // Criterion
    doc.fontSize(7).fillColor(COLORS.darkGray).font("Helvetica-Bold");
    doc.text(f.label, colX + 6, tableY + 6, { width: fColWidths[0] - 12 });
    colX += fColWidths[0];

    // Value
    doc.font("Helvetica").fillColor(COLORS.darkGray);
    doc.text(f.displayValue, colX + 6, tableY + 6, { width: fColWidths[1] - 12 });
    colX += fColWidths[1];

    // Score bar
    const barX = colX + 6;
    const barY = tableY + 7;
    const barW = fColWidths[2] - 20;
    const barH = 7;
    const fillRatio = f.score / f.maxScore;

    drawRoundedRect(doc, barX, barY, barW, barH, 3, "#E5E7EB");
    if (fillRatio > 0) {
      drawRoundedRect(doc, barX, barY, Math.max(barW * fillRatio, 4), barH, 3, f.barColor);
    }
    doc.fontSize(6).fillColor(COLORS.darkGray);
    doc.text(`${f.score}/${f.maxScore}`, barX + barW + 2, tableY + 6, { width: 25 });
    colX += fColWidths[2];

    // Assessment
    doc.fontSize(7).fillColor(f.barColor).font("Helvetica-Bold");
    doc.text(f.assessment, colX + 6, tableY + 6, { width: fColWidths[3] - 12 });
    doc.font("Helvetica");

    tableY += fRowH;
  });

  doc.y = tableY + 15;

  // ---- WHAT THIS MEANS ----
  const verdictBoxH = 50;
  drawRoundedRect(doc, margin, doc.y, contentWidth, verdictBoxH, 8, fitResult.color);

  doc.fontSize(11).fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text(
    t("VERDICT", "VERDICT"),
    margin + 12,
    doc.y + 8,
    { width: contentWidth - 24 }
  );
  doc.font("Helvetica").fontSize(9).fillColor(COLORS.white);

  const verdictText = getVerdictText(fitResult, simulation, ctx.lang);
  doc.text(verdictText, margin + 12, doc.y + 24, { width: contentWidth - 24 });

  doc.y += verdictBoxH + 12;

  // ---- NEXT STEPS based on score ----
  doc.fontSize(10).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("PROCHAINES ÉTAPES RECOMMANDÉES", "RECOMMENDED NEXT STEPS"), margin, doc.y);
  doc.font("Helvetica");
  doc.y += 3;
  doc.rect(margin, doc.y, 180, 1.5).fillColor(COLORS.gold).fill();
  doc.y += 8;

  const nextSteps = getNextStepsForScore(fitResult, ctx.lang);
  nextSteps.forEach((step, i) => {
    doc.fontSize(8).fillColor(COLORS.green).font("Helvetica-Bold");
    doc.text(`${i + 1}.`, margin + 4, doc.y);
    doc.font("Helvetica").fillColor(COLORS.darkGray);
    doc.text(step, margin + 20, doc.y, { width: contentWidth - 30 });
    doc.y += 14;
  });

  drawPageFooter(
    ctx,
    t("Document confidentiel | Généré par kWh Québec | Évaluation de faisabilité", "Confidential document | Generated by kWh Québec | Feasibility assessment")
  );
}

// ---- Helper functions ----

function getVerdictText(fit: FitScoreResult, sim: any, lang: "fr" | "en"): string {
  const t = (fr: string, en: string) => (lang === "fr" ? fr : en);

  if (fit.level === "excellent") {
    return t(
      `Ce bâtiment présente un excellent potentiel solaire avec un retour sur investissement de ${sim.simplePaybackYears?.toFixed(1) || "?"} ans et un TRI de ${sim.irr25 ? (sim.irr25 * 100).toFixed(1) : "?"}%. Nous recommandons de procéder rapidement pour profiter des incitatifs actuels.`,
      `This building shows excellent solar potential with a ${sim.simplePaybackYears?.toFixed(1) || "?"}-year payback and ${sim.irr25 ? (sim.irr25 * 100).toFixed(1) : "?"}% IRR. We recommend moving forward quickly to take advantage of current incentives.`
    );
  } else if (fit.level === "bon") {
    return t(
      `Ce bâtiment présente un bon potentiel solaire. Les résultats financiers sont positifs et le projet est économiquement justifiable. La prochaine étape est la validation technique sur site.`,
      `This building shows good solar potential. Financial results are positive and the project is economically justifiable. Next step is on-site technical validation.`
    );
  } else if (fit.level === "a_evaluer") {
    return t(
      `Le potentiel solaire de ce bâtiment nécessite une validation technique approfondie. Les résultats préliminaires indiquent un potentiel, mais des facteurs spécifiques au site doivent être confirmés.`,
      `This building's solar potential requires deeper technical validation. Preliminary results indicate potential, but site-specific factors need confirmation.`
    );
  } else {
    return t(
      `Des défis ont été identifiés pour ce bâtiment. Le projet peut rester pertinent pour des raisons non financières (autonomie, ESG, image de marque). Une analyse approfondie est recommandée.`,
      `Challenges have been identified for this building. The project may still be relevant for non-financial reasons (autonomy, ESG, branding). A deeper analysis is recommended.`
    );
  }
}

function getNextStepsForScore(fit: FitScoreResult, lang: "fr" | "en"): string[] {
  const t = (fr: string, en: string) => (lang === "fr" ? fr : en);

  if (fit.level === "excellent" || fit.level === "bon") {
    return [
      t("Planifier la visite technique du site (inspection toiture + salle électrique)", "Schedule technical site visit (roof + electrical room inspection)"),
      t("Confirmer la faisabilité structurelle avec un ingénieur agréé", "Confirm structural feasibility with a licensed engineer"),
      t("Soumettre la demande d'interconnexion Hydro-Québec", "Submit Hydro-Québec interconnection application"),
      t("Finaliser le design détaillé et la soumission forfaitaire", "Finalize detailed design and firm quote"),
    ];
  } else {
    return [
      t("Obtenir les données de consommation réelles (procuration HQ ou CSV)", "Obtain real consumption data (HQ authorization or CSV)"),
      t("Évaluer les motivations non financières du projet (ESG, autonomie, image)", "Evaluate non-financial project motivations (ESG, autonomy, branding)"),
      t("Explorer les options de financement pour améliorer le flux de trésorerie", "Explore financing options to improve cash flow"),
      t("Planifier une rencontre pour discuter des alternatives de conception", "Schedule a meeting to discuss design alternatives"),
    ];
  }
}
