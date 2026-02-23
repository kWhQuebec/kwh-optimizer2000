/**
 * Prospect-facing Fit Score — computed from simulation/analysis results.
 * NOT the same as the internal qualification score (CRM/sales).
 *
 * SINGLE SOURCE OF TRUTH for all scoring thresholds.
 * HTML presentation, PDF, and PPTX all consume FitScoreResult.factors[]
 * instead of duplicating scoring logic.
 *
 * Thresholds calibrated for the QUEBEC commercial solar market:
 * - Electricity rates ~0.07-0.10 $/kWh (among lowest in North America)
 * - Payback 7-12 years is standard for a viable project
 * - IRR 8-15% over 25 years is a good commercial outcome
 * - Savings ratio 15-35% is typical with net metering
 * - Self-sufficiency 20-40% is normal for commercial rooftops
 *
 * These thresholds would need adjustment for markets with higher
 * electricity costs (Ontario, California, Europe) where payback < 5y
 * and IRR > 20% are achievable.
 */

export type FitLevel = "excellent" | "bon" | "a_evaluer" | "defis";

export interface FitFactor {
  key: string;
  labelFr: string;
  labelEn: string;
  displayValue: string;
  score: number;
  maxScore: number;
  assessmentFr: string;
  assessmentEn: string;
  barColor: string; // green / amber / red
}

export interface FitScoreResult {
  level: FitLevel;
  score: number; // 0-100
  labelFr: string;
  labelEn: string;
  color: string;
  icon: string; // emoji
  factors: FitFactor[];
}

export interface FitScoreInput {
  simplePaybackYears: number | null;
  irr25: number | null;
  annualSavings: number | null;
  annualCostBefore: number | null;
  selfSufficiencyPercent: number | null;
  capexNet: number | null;
}

// ---- Color constants (shared with brand) ----
const GREEN = "#16A34A";
const AMBER = "#F59E0B";
const RED = "#DC2626";

function barColor(score: number, goodThreshold: number, okThreshold: number): string {
  if (score >= goodThreshold) return GREEN;
  if (score >= okThreshold) return AMBER;
  return RED;
}

export function computeFitScore(input: FitScoreInput): FitScoreResult {
  const factors: FitFactor[] = [];

  // ---- Factor 1: Payback (max 35 pts) ----
  {
    const payback = input.simplePaybackYears;
    let score = 0;
    let assessFr = "—";
    let assessEn = "—";
    if (payback != null && payback > 0) {
      if (payback <= 7)       { score = 35; assessFr = "Excellent"; assessEn = "Excellent"; }
      else if (payback <= 9)  { score = 30; assessFr = "Très bon"; assessEn = "Very good"; }
      else if (payback <= 12) { score = 22; assessFr = "Bon"; assessEn = "Good"; }
      else if (payback <= 15) { score = 14; assessFr = "Acceptable"; assessEn = "Acceptable"; }
      else if (payback <= 20) { score = 7;  assessFr = "Long"; assessEn = "Long"; }
      else                    { score = 3;  assessFr = "Très long"; assessEn = "Very long"; }
    }
    factors.push({
      key: "payback",
      labelFr: "Période de retour simple",
      labelEn: "Simple payback period",
      displayValue: payback != null && payback > 0 ? `${payback.toFixed(1)} ans` : "—",
      score,
      maxScore: 35,
      assessmentFr: assessFr,
      assessmentEn: assessEn,
      barColor: barColor(score, 22, 14),
    });
  }

  // ---- Factor 2: IRR 25yr (max 25 pts) ----
  {
    const irr = input.irr25;
    let score = 0;
    let assessFr = "—";
    let assessEn = "—";
    if (irr != null) {
      const irrPct = irr * 100;
      if (irrPct >= 12)      { score = 25; assessFr = "Excellent"; assessEn = "Excellent"; }
      else if (irrPct >= 9)  { score = 22; assessFr = "Très bon"; assessEn = "Very good"; }
      else if (irrPct >= 7)  { score = 18; assessFr = "Bon"; assessEn = "Good"; }
      else if (irrPct >= 5)  { score = 12; assessFr = "Acceptable"; assessEn = "Acceptable"; }
      else if (irrPct >= 3)  { score = 6;  assessFr = "Faible"; assessEn = "Low"; }
      else                   { score = 2;  assessFr = "Très faible"; assessEn = "Very low"; }
    }
    factors.push({
      key: "irr",
      labelFr: "TRI sur 25 ans",
      labelEn: "25-year IRR",
      displayValue: irr != null ? `${(irr * 100).toFixed(1)}%` : "—",
      score,
      maxScore: 25,
      assessmentFr: assessFr,
      assessmentEn: assessEn,
      barColor: barColor(score, 18, 12),
    });
  }

  // ---- Factor 3: Savings ratio (max 20 pts) ----
  {
    const savings = input.annualSavings;
    const costBefore = input.annualCostBefore;
    let score = 0;
    let assessFr = "—";
    let assessEn = "—";
    let savingsRatio = 0;
    if (savings != null && costBefore != null && costBefore > 0) {
      savingsRatio = savings / costBefore;
      if (savingsRatio >= 0.30)      { score = 20; assessFr = "Impact majeur"; assessEn = "Major impact"; }
      else if (savingsRatio >= 0.20) { score = 16; assessFr = "Impact significatif"; assessEn = "Significant"; }
      else if (savingsRatio >= 0.12) { score = 12; assessFr = "Bon impact"; assessEn = "Good impact"; }
      else if (savingsRatio >= 0.06) { score = 7;  assessFr = "Impact modéré"; assessEn = "Moderate"; }
      else                           { score = 3;  assessFr = "Impact limité"; assessEn = "Limited"; }
    }
    factors.push({
      key: "savings",
      labelFr: "Ratio d'économies",
      labelEn: "Savings ratio",
      displayValue: costBefore != null && costBefore > 0 ? `${(savingsRatio * 100).toFixed(0)}%` : "—",
      score,
      maxScore: 20,
      assessmentFr: assessFr,
      assessmentEn: assessEn,
      barColor: barColor(score, 12, 7),
    });
  }

  // ---- Factor 4: Self-sufficiency (max 20 pts) ----
  {
    const selfSuff = input.selfSufficiencyPercent;
    let score = 0;
    let assessFr = "—";
    let assessEn = "—";
    if (selfSuff != null) {
      if (selfSuff >= 45)      { score = 20; assessFr = "Haute autonomie"; assessEn = "High autonomy"; }
      else if (selfSuff >= 30) { score = 16; assessFr = "Bonne autonomie"; assessEn = "Good autonomy"; }
      else if (selfSuff >= 20) { score = 12; assessFr = "Autonomie modérée"; assessEn = "Moderate"; }
      else if (selfSuff >= 10) { score = 7;  assessFr = "Autonomie limitée"; assessEn = "Limited"; }
      else                     { score = 3;  assessFr = "Faible autonomie"; assessEn = "Low autonomy"; }
    }
    factors.push({
      key: "selfSufficiency",
      labelFr: "Autosuffisance solaire",
      labelEn: "Solar self-sufficiency",
      displayValue: selfSuff != null ? `${selfSuff.toFixed(0)}%` : "—",
      score,
      maxScore: 20,
      assessmentFr: assessFr,
      assessmentEn: assessEn,
      barColor: barColor(score, 12, 7),
    });
  }

  // ---- Aggregate ----
  const totalScore = factors.reduce((sum, f) => sum + f.score, 0);
  const hasData = factors.some(f => f.score > 0);

  if (!hasData) {
    return {
      level: "a_evaluer",
      score: 0,
      labelFr: "À évaluer",
      labelEn: "To be assessed",
      color: AMBER,
      icon: "⏳",
      factors,
    };
  }

  // Classify
  if (totalScore >= 75) {
    return { level: "excellent", score: totalScore, labelFr: "Excellent potentiel solaire", labelEn: "Excellent solar potential", color: GREEN, icon: "☀️", factors };
  } else if (totalScore >= 55) {
    return { level: "bon", score: totalScore, labelFr: "Bon potentiel solaire", labelEn: "Good solar potential", color: "#65A30D", icon: "👍", factors };
  } else if (totalScore >= 35) {
    return { level: "a_evaluer", score: totalScore, labelFr: "Potentiel à valider", labelEn: "Potential to validate", color: AMBER, icon: "🔍", factors };
  } else {
    return { level: "defis", score: totalScore, labelFr: "Défis identifiés", labelEn: "Challenges identified", color: RED, icon: "⚠️", factors };
  }
}
