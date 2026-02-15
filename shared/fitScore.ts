/**
 * Prospect-facing Fit Score — computed from simulation/analysis results.
 * NOT the same as the internal qualification score (CRM/sales).
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
  if (input.simplePaybackYears != null && input.simplePaybackYears > 0) {
    count++;
    if (input.simplePaybackYears <= 4) score += 35;
    else if (input.simplePaybackYears <= 6) score += 30;
    else if (input.simplePaybackYears <= 8) score += 22;
    else if (input.simplePaybackYears <= 10) score += 15;
    else if (input.simplePaybackYears <= 14) score += 8;
    else score += 3;
  }

  // Factor 2: IRR 25yr (max 25 pts) — higher is better
  if (input.irr25 != null) {
    count++;
    const irrPct = input.irr25 * 100; // convert decimal to %
    if (irrPct >= 20) score += 25;
    else if (irrPct >= 15) score += 22;
    else if (irrPct >= 10) score += 18;
    else if (irrPct >= 7) score += 12;
    else if (irrPct >= 4) score += 6;
    else score += 2;
  }

  // Factor 3: Savings ratio (max 20 pts)
  if (input.annualSavings != null && input.annualCostBefore != null && input.annualCostBefore > 0) {
    count++;
    const savingsRatio = input.annualSavings / input.annualCostBefore;
    if (savingsRatio >= 0.5) score += 20;
    else if (savingsRatio >= 0.35) score += 16;
    else if (savingsRatio >= 0.2) score += 12;
    else if (savingsRatio >= 0.1) score += 7;
    else score += 3;
  }

  // Factor 4: Self-sufficiency (max 20 pts)
  if (input.selfSufficiencyPercent != null) {
    count++;
    if (input.selfSufficiencyPercent >= 60) score += 20;
    else if (input.selfSufficiencyPercent >= 40) score += 15;
    else if (input.selfSufficiencyPercent >= 25) score += 10;
    else if (input.selfSufficiencyPercent >= 15) score += 6;
    else score += 2;
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
  if (score >= 80) {
    return { level: "excellent", score, labelFr: "Excellent potentiel solaire", labelEn: "Excellent solar potential", color: "#16A34A", icon: "☀️" };
  } else if (score >= 60) {
    return { level: "bon", score, labelFr: "Bon potentiel solaire", labelEn: "Good solar potential", color: "#65A30D", icon: "👍" };
  } else if (score >= 40) {
    return { level: "a_evaluer", score, labelFr: "Potentiel à valider", labelEn: "Potential to validate", color: "#F59E0B", icon: "🔍" };
  } else {
    return { level: "defis", score, labelFr: "Défis identifiés", labelEn: "Challenges identified", color: "#DC2626", icon: "⚠️" };
  }
}
