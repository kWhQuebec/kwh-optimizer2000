/**
 * Prospect-facing Fit Score — computed from simulation/analysis results.
 * NOT the same as the internal qualification score (CRM/sales).
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

export interface FitScoreResult {
  level: FitLevel;
  score: number; // 0-100
  labelFr: string;
  labelEn: string;
  color: string;
  icon: string; // emoji
}

interface FitScoreInput {
  simplePaybackYears: number | null;
  irr25: number | null;
  annualSavings: number | null;
  annualCostBefore: number | null;
  selfSufficiencyPercent: number | null;
  capexNet: number | null;
}

export function computeFitScore(input: FitScoreInput): FitScoreResult {
  let score = 0;
  let count = 0;

  // Factor 1: Payback period (max 35 pts) — shorter is better
  // Quebec benchmark: 7-12y is standard, <7y is excellent
  if (input.simplePaybackYears != null && input.simplePaybackYears > 0) {
    count++;
    if (input.simplePaybackYears <= 7) score += 35;
    else if (input.simplePaybackYears <= 9) score += 30;
    else if (input.simplePaybackYears <= 12) score += 22;
    else if (input.simplePaybackYears <= 15) score += 14;
    else if (input.simplePaybackYears <= 20) score += 7;
    else score += 3;
  }

  // Factor 2: IRR 25yr (max 25 pts) — higher is better
  // Quebec benchmark: 8-15% is good, >12% is excellent
  if (input.irr25 != null) {
    count++;
    const irrPct = input.irr25 * 100; // convert decimal to %
    if (irrPct >= 12) score += 25;
    else if (irrPct >= 9) score += 22;
    else if (irrPct >= 7) score += 18;
    else if (irrPct >= 5) score += 12;
    else if (irrPct >= 3) score += 6;
    else score += 2;
  }

  // Factor 3: Savings ratio (max 20 pts)
  // Quebec benchmark: 15-35% is typical, >30% is excellent
  if (input.annualSavings != null && input.annualCostBefore != null && input.annualCostBefore > 0) {
    count++;
    const savingsRatio = input.annualSavings / input.annualCostBefore;
    if (savingsRatio >= 0.30) score += 20;
    else if (savingsRatio >= 0.20) score += 16;
    else if (savingsRatio >= 0.12) score += 12;
    else if (savingsRatio >= 0.06) score += 7;
    else score += 3;
  }

  // Factor 4: Self-sufficiency (max 20 pts)
  // Quebec benchmark: 20-40% for commercial, >45% is excellent
  if (input.selfSufficiencyPercent != null) {
    count++;
    if (input.selfSufficiencyPercent >= 45) score += 20;
    else if (input.selfSufficiencyPercent >= 30) score += 16;
    else if (input.selfSufficiencyPercent >= 20) score += 12;
    else if (input.selfSufficiencyPercent >= 10) score += 7;
    else score += 3;
  }

  // If no data available, return "à évaluer"
  if (count === 0) {
    return {
      level: "a_evaluer",
      score: 0,
      labelFr: "À évaluer",
      labelEn: "To be assessed",
      color: "#F59E0B",
      icon: "⏳",
    };
  }

  // Classify
  if (score >= 75) {
    return { level: "excellent", score, labelFr: "Excellent potentiel solaire", labelEn: "Excellent solar potential", color: "#16A34A", icon: "☀️" };
  } else if (score >= 55) {
    return { level: "bon", score, labelFr: "Bon potentiel solaire", labelEn: "Good solar potential", color: "#65A30D", icon: "👍" };
  } else if (score >= 35) {
    return { level: "a_evaluer", score, labelFr: "Potentiel à valider", labelEn: "Potential to validate", color: "#F59E0B", icon: "🔍" };
  } else {
    return { level: "defis", score, labelFr: "Défis identifiés", labelEn: "Challenges identified", color: "#DC2626", icon: "⚠️" };
  }
}
