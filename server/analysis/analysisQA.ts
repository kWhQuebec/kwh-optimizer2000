/**
 * Analysis QA Validation Module
 *
 * Automatically checks each analysis for data quality issues, inconsistencies,
 * and potential bugs. Returns structured warnings that can be displayed to users
 * and logged for monitoring.
 *
 * MISSION CRITICAL: Every analysis must pass QA before being presented to clients.
 * If real data exists but isn't being used properly, this module MUST flag it.
 */

export interface QACheck {
  id: string;
  severity: 'error' | 'warning' | 'info';
  category: 'data_quality' | 'financial' | 'sizing' | 'battery' | 'consistency';
  message_fr: string;
  message_en: string;
  details?: Record<string, any>;
}

export interface QAResult {
  passed: boolean;
  score: number; // 0-100, where 100 = perfect
  checks: QACheck[];
  timestamp: string;
}

interface QAInput {
  // Data quality
  totalReadings: number;
  hasRealMeterData: boolean;
  usedRealDailyProfiles: boolean;
  interpolatedMonthCount: number;
  dataSpanDays: number;
  hasSyntheticFiles: boolean;

  // Sizing
  pvSizeKW: number;
  battEnergyKWh: number;
  battPowerKW: number;
  peakDemandKW: number;
  annualConsumptionKWh: number;

  // Results
  annualDemandReductionKW: number;
  annualSavings: number;
  capexNet: number;
  npv25: number;
  irr25: number;
  simplePaybackYears: number;
  selfSufficiencyPercent: number;
  totalProductionKWh: number;

  // Battery specifics
  monthlyPeaksBefore?: number[];
  monthlyPeaksAfter?: number[];
}

export function runAnalysisQA(input: QAInput): QAResult {
  const checks: QACheck[] = [];

  // ── DATA QUALITY CHECKS ──

  // Check 1: Real data exists but profiles are synthetic
  if (input.hasRealMeterData && !input.usedRealDailyProfiles) {
    checks.push({
      id: 'DQ-001',
      severity: 'warning',
      category: 'data_quality',
      message_fr: 'Données réelles disponibles mais profils de pointe agrégés. Les résultats de batterie peuvent être sous-estimés.',
      message_en: 'Real meter data available but peak profiles are aggregated. Battery results may be underestimated.',
      details: {
        totalReadings: input.totalReadings,
        usedRealDailyProfiles: false,
        fix: 'Ensure buildHourlyData uses real daily profiles when 12+ months of 15-min data available',
      },
    });
  }

  // Check 2: Synthetic data without warning
  if (input.hasSyntheticFiles && input.totalReadings < 100) {
    checks.push({
      id: 'DQ-002',
      severity: 'warning',
      category: 'data_quality',
      message_fr: 'Analyse basée sur des données synthétiques. Les résultats sont indicatifs seulement.',
      message_en: 'Analysis based on synthetic data. Results are indicative only.',
    });
  }

  // Check 3: Too many interpolated months
  if (input.interpolatedMonthCount > 6) {
    checks.push({
      id: 'DQ-003',
      severity: 'warning',
      category: 'data_quality',
      message_fr: `${input.interpolatedMonthCount} mois sur 12 sont interpolés. Les résultats sont approximatifs.`,
      message_en: `${input.interpolatedMonthCount} out of 12 months are interpolated. Results are approximate.`,
    });
  }

  // Check 4: Data span too short
  if (input.dataSpanDays < 180 && input.totalReadings > 0) {
    checks.push({
      id: 'DQ-004',
      severity: 'info',
      category: 'data_quality',
      message_fr: `Seulement ${Math.round(input.dataSpanDays)} jours de données. Recommandé: 12+ mois pour une analyse fiable.`,
      message_en: `Only ${Math.round(input.dataSpanDays)} days of data. Recommended: 12+ months for reliable analysis.`,
    });
  }

  // ── BATTERY CHECKS ──

  // Check 5: Battery added but negligible demand reduction
  if (input.battEnergyKWh > 0 && input.battPowerKW > 0) {
    const expectedMinReduction = input.battPowerKW * 0.15; // At least 15% of rated power
    if (input.annualDemandReductionKW < expectedMinReduction) {
      checks.push({
        id: 'BAT-001',
        severity: 'warning',
        category: 'battery',
        message_fr: `Batterie ${input.battEnergyKWh}kWh/${input.battPowerKW}kW ne réduit la pointe que de ${input.annualDemandReductionKW.toFixed(1)}kW (attendu: ≥${expectedMinReduction.toFixed(0)}kW). Vérifier le dispatch.`,
        message_en: `Battery ${input.battEnergyKWh}kWh/${input.battPowerKW}kW only reduces peak by ${input.annualDemandReductionKW.toFixed(1)}kW (expected: ≥${expectedMinReduction.toFixed(0)}kW). Check dispatch algorithm.`,
        details: {
          batteryPowerKW: input.battPowerKW,
          batteryEnergyKWh: input.battEnergyKWh,
          actualReductionKW: input.annualDemandReductionKW,
          expectedMinReductionKW: expectedMinReduction,
        },
      });
    }

    // Check 6: Monthly peaks unchanged (battery doing nothing)
    if (input.monthlyPeaksBefore && input.monthlyPeaksAfter) {
      let unchangedMonths = 0;
      for (let m = 0; m < 12; m++) {
        if (input.monthlyPeaksBefore[m] > 0 &&
            Math.abs(input.monthlyPeaksBefore[m] - input.monthlyPeaksAfter[m]) < 0.5) {
          unchangedMonths++;
        }
      }
      if (unchangedMonths >= 8) {
        checks.push({
          id: 'BAT-002',
          severity: 'error',
          category: 'battery',
          message_fr: `La batterie n'a aucun effet sur la pointe mensuelle dans ${unchangedMonths}/12 mois. Bug probable dans le dispatch.`,
          message_en: `Battery has no effect on monthly peak in ${unchangedMonths}/12 months. Likely dispatch bug.`,
          details: { unchangedMonths },
        });
      }
    }
  }

  // ── FINANCIAL CHECKS ──

  // Check 7: Negative NPV with battery but positive without
  if (input.battEnergyKWh > 0 && input.npv25 < 0 && input.pvSizeKW > 0) {
    checks.push({
      id: 'FIN-001',
      severity: 'info',
      category: 'financial',
      message_fr: 'Le NPV est négatif avec batterie. Considérer une configuration solaire seule.',
      message_en: 'NPV is negative with battery. Consider solar-only configuration.',
    });
  }

  // Check 8: Unrealistic IRR
  if (input.irr25 > 0.5) {
    checks.push({
      id: 'FIN-002',
      severity: 'warning',
      category: 'financial',
      message_fr: `IRR de ${(input.irr25 * 100).toFixed(1)}% semble irréaliste. Vérifier les hypothèses.`,
      message_en: `IRR of ${(input.irr25 * 100).toFixed(1)}% seems unrealistic. Check assumptions.`,
    });
  }

  // Check 9: Payback > 20 years
  if (input.simplePaybackYears > 20 && input.capexNet > 0) {
    checks.push({
      id: 'FIN-003',
      severity: 'warning',
      category: 'financial',
      message_fr: `Retour sur investissement de ${input.simplePaybackYears.toFixed(1)} ans dépasse la durée de vie utile.`,
      message_en: `Payback of ${input.simplePaybackYears.toFixed(1)} years exceeds useful life.`,
    });
  }

  // ── SIZING CHECKS ──

  // Check 10: PV oversized vs consumption
  if (input.pvSizeKW > 0 && input.totalProductionKWh > input.annualConsumptionKWh * 2) {
    checks.push({
      id: 'SIZ-001',
      severity: 'warning',
      category: 'sizing',
      message_fr: `Production solaire (${Math.round(input.totalProductionKWh)} kWh) dépasse 2× la consommation (${Math.round(input.annualConsumptionKWh)} kWh). Surdimensionnement possible.`,
      message_en: `Solar production (${Math.round(input.totalProductionKWh)} kWh) exceeds 2× consumption (${Math.round(input.annualConsumptionKWh)} kWh). Possible oversizing.`,
    });
  }

  // Check 11: Self-sufficiency impossibly high
  if (input.selfSufficiencyPercent > 100) {
    checks.push({
      id: 'SIZ-002',
      severity: 'error',
      category: 'consistency',
      message_fr: `Auto-suffisance de ${input.selfSufficiencyPercent.toFixed(1)}% dépasse 100%. Bug de calcul.`,
      message_en: `Self-sufficiency of ${input.selfSufficiencyPercent.toFixed(1)}% exceeds 100%. Calculation bug.`,
    });
  }

  // ── SCORE ──
  const errorCount = checks.filter(c => c.severity === 'error').length;
  const warningCount = checks.filter(c => c.severity === 'warning').length;
  const score = Math.max(0, 100 - errorCount * 25 - warningCount * 10);

  return {
    passed: errorCount === 0,
    score,
    checks,
    timestamp: new Date().toISOString(),
  };
}
