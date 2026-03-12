/**
 * cashflowCalculations.ts — Single source of truth for ALL cashflow/financial calculations.
 *
 * This module consolidates ~2,400 LOC of duplicated logic that was previously
 * copy-pasted across simulationEngine.ts, siteAnalysisHelpers.ts, and routes.ts.
 *
 * Every financial calculation (incentives, cashflows, NPV, IRR, LCOE, payback)
 * MUST go through this module. No inline copies allowed.
 *
 * Key regulatory references:
 * - HQ OSE 6.0: $1000/kW solar (max 1 MW), 40% cap on admissible CAPEX (solar only)
 * - Federal ITC: 30% of (CAPEX - HQ incentives)
 * - Tax shield (DPA/CCA): 90% × taxRate × (CAPEX - HQ - ITC)
 * - Battery: No HQ incentive (discontinued Dec 2024, no leftover cap room accepted by HQ)
 *
 * @module cashflowCalculations
 */

import type {
  AnalysisAssumptions,
  CashflowEntry,
  FinancialBreakdown,
} from "@shared/schema";
import { getTieredSolarCostPerW, getDefaultSupplierCostPerW } from "./potentialAnalysis";

// ─── Types ──────────────────────────────────────────────────────────────────

/** Input parameters for cashflow calculations */
export interface CashflowInputs {
  /** PV system size in kW */
  pvSizeKW: number;
  /** Battery energy capacity in kWh */
  battEnergyKWh: number;
  /** Battery power capacity in kW */
  battPowerKW: number;

  /** Annual self-consumption in kWh (solar used directly on-site) */
  selfConsumptionKWh: number;
  /** Annual exported kWh (surplus sent to grid) */
  totalExportedKWh: number;
  /** Annual total production in kWh */
  totalProductionKWh: number;
  /** Annual grid charging kWh (battery charged from grid) */
  gridChargingKWh: number;

  /** Annual consumption before solar in kWh */
  annualConsumptionKWh: number;

  /** Peak demand before solar in kW */
  peakBeforeKW: number;
  /** Peak demand after solar+storage in kW */
  peakAfterKW: number;

  /** Monthly peak demands before solar (12 months) — used for precise demand savings */
  monthlyPeaksBefore?: number[];
  /** Monthly peak demands after solar (12 months) */
  monthlyPeaksAfter?: number[];

  /** Effective annual yield in kWh/kW (for LCOE calculation).
   *  If not provided, falls back to totalProductionKWh / pvSizeKW */
  effectiveYield?: number;

  /** Analysis assumptions (tariffs, rates, costs, etc.) */
  assumptions: AnalysisAssumptions;
}

/** Complete output of cashflow calculations */
export interface CashflowResults {
  // CAPEX
  capexSolar: number;
  capexBattery: number;
  capexGross: number;
  capexNet: number;

  // Incentives
  incentivesHQ: number;
  incentivesHQSolar: number;
  incentivesHQBattery: number;
  incentivesFederal: number;
  taxShield: number;

  // Annual metrics (Year 1)
  annualSavings: number;
  annualSurplusRevenue: number;
  annualCostBefore: number;
  annualCostAfter: number;

  // Financial metrics
  npv10: number;
  npv20: number;
  npv25: number;
  npv30: number;
  irr10: number;
  irr20: number;
  irr25: number;
  irr30: number;
  lcoe: number;
  lcoe30: number;
  simplePaybackYears: number;

  // Cashflows
  cashflows: CashflowEntry[];

  // Environmental
  co2AvoidedTonnesPerYear: number;

  // System performance
  selfSufficiencyPercent: number;

  // Financial breakdown (detailed, for reports)
  breakdown: FinancialBreakdown;

  // ── Internal margin (NOT client-facing) ──────────────────────────────
  // Always populated. Uses real supplier costs if provided, else default tier estimates.
  internalMargin?: {
    costSolar: number;          // kWh cost for solar equipment + labor
    costBattery: number;        // kWh cost for battery equipment
    costTotal: number;          // Total kWh cost
    sellSolar: number;          // Client price for solar
    sellBattery: number;        // Client price for battery
    sellTotal: number;          // Total client price
    marginDollarsSolar: number; // $ margin on solar
    marginDollarsBattery: number; // $ margin on battery
    marginDollarsTotal: number; // $ total margin
    marginPercentSolar: number; // Gross margin % on solar
    marginPercentBattery: number; // Gross margin % on battery
    marginPercentTotal: number; // Gross margin % overall
    isEstimated?: boolean;      // true = default supplier costs, false = real project-specific
  };
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_ANALYSIS_YEARS = 30;
const HQ_MAX_ELIGIBLE_KW = 1000; // HQ OSE 6.0: max 1 MW
const HQ_INCENTIVE_PER_KW = 1000; // $1000/kW
const HQ_CAP_PERCENT = 0.40; // 40% of admissible CAPEX
const FEDERAL_ITC_RATE = 0.30; // 30% ITC
const TAX_SHIELD_FACTOR = 0.90; // 90% of depreciable basis × tax rate
const CO2_FACTOR_QC = 0.002; // kg CO2/kWh for Quebec grid
const BATTERY_REPLACEMENT_YEARS = [10, 20, 30]; // Default replacement schedule

// ─── Core Calculation Functions ─────────────────────────────────────────────

/**
 * Calculate CAPEX (solar + battery).
 */
export function calculateCapex(
  pvSizeKW: number,
  battEnergyKWh: number,
  battPowerKW: number,
  h: AnalysisAssumptions,
): { capexPV: number; capexBattery: number; capexGross: number; effectiveSolarCostPerW: number } {
  const baseSolarCostPerW = h.solarCostPerW ?? getTieredSolarCostPerW(pvSizeKW);
  const effectiveSolarCostPerW = h.bifacialEnabled
    ? baseSolarCostPerW + (h.bifacialCostPremium || 0.10)
    : baseSolarCostPerW;
  const capexPV = pvSizeKW * 1000 * effectiveSolarCostPerW;
  const capexBattery = battEnergyKWh * h.batteryCapacityCost + battPowerKW * h.batteryPowerCost;
  const capexGross = capexPV + capexBattery;
  return { capexPV, capexBattery, capexGross, effectiveSolarCostPerW };
}

/**
 * Calculate annual savings and costs.
 * Supports both precise (monthly peaks) and simplified (flat peak reduction) modes.
 */
export function calculateAnnualSavings(
  inputs: CashflowInputs,
): {
  annualCostBefore: number;
  annualSavings: number;
  annualSurplusRevenue: number;
  annualCostAfter: number;
  energySavings: number;
  demandSavings: number;
  gridChargingCost: number;
} {
  const h = inputs.assumptions;
  const { selfConsumptionKWh, totalExportedKWh, annualConsumptionKWh, gridChargingKWh } = inputs;

  // Demand savings: use monthly peaks if available (precise), else flat reduction
  let annualDemandCostBefore: number;
  let demandSavings: number;

  if (inputs.monthlyPeaksBefore && inputs.monthlyPeaksAfter) {
    annualDemandCostBefore = 0;
    demandSavings = 0;
    for (let m = 0; m < 12; m++) {
      annualDemandCostBefore += inputs.monthlyPeaksBefore[m] * h.tariffPower;
      demandSavings += Math.max(0, inputs.monthlyPeaksBefore[m] - inputs.monthlyPeaksAfter[m]) * h.tariffPower;
    }
  } else {
    annualDemandCostBefore = inputs.peakBeforeKW * h.tariffPower * 12;
    const annualDemandReductionKW = inputs.peakBeforeKW - inputs.peakAfterKW;
    demandSavings = annualDemandReductionKW * h.tariffPower * 12;
  }

  const annualCostBefore = annualConsumptionKWh * h.tariffEnergy + annualDemandCostBefore;
  const energySavings = selfConsumptionKWh * h.tariffEnergy;
  const gridChargingCost = gridChargingKWh * h.tariffEnergy;
  const annualSavings = (energySavings - gridChargingCost) + demandSavings;

  // HQ OSE 6.0: net metering and GDP are mutually exclusive
  const netMeteringActive = h.netMeteringEnabled !== false;
  const hqSurplusRate = h.hqSurplusCompensationRate ?? 0.0454;
  const annualSurplusRevenue = netMeteringActive ? (totalExportedKWh * hqSurplusRate) : 0;

  const annualCostAfter = annualCostBefore - annualSavings;

  return {
    annualCostBefore,
    annualSavings,
    annualSurplusRevenue,
    annualCostAfter,
    energySavings,
    demandSavings,
    gridChargingCost,
  };
}

/**
 * Calculate all incentives (HQ + Federal ITC + Tax Shield).
 *
 * HQ OSE 6.0 rules:
 * - Solar: $1000/kW, max 1 MW, capped at 40% of admissible CAPEX (solar only)
 * - Battery: gets leftover cap room ONLY if paired with solar. No standalone.
 * - Admissible CAPEX excludes: battery, interconnection, financing
 *
 * Federal ITC: 30% of (CAPEX gross - HQ incentives)
 * Tax shield: 90% × taxRate × (CAPEX - HQ - ITC)
 */
export function calculateIncentives(
  capexPV: number,
  capexBattery: number,
  capexGross: number,
  pvSizeKW: number,
  battEnergyKWh: number,
  h: AnalysisAssumptions,
): {
  incentivesHQSolar: number;
  incentivesHQBattery: number;
  incentivesHQ: number;
  incentivesFederal: number;
  taxShield: number;
  capexNet: number;
  capexNetAccounting: number;
  totalIncentives: number;
  equityInitial: number;
  batterySubY0: number;
  batterySubY1: number;
  potentialHQSolar: number;
  potentialHQBattery: number;
  cap40Percent: number;
  itcBasis: number;
  capexAdmissible: number;
} {
  // HQ incentive calculation
  const eligibleSolarKW = Math.min(pvSizeKW, HQ_MAX_ELIGIBLE_KW);
  const potentialHQSolar = eligibleSolarKW * HQ_INCENTIVE_PER_KW;
  const potentialHQBattery = 0; // No HQ battery incentive
  const capexAdmissible = capexPV; // Only solar is admissible for 40% cap
  const cap40Percent = capexAdmissible * HQ_CAP_PERCENT;

  let incentivesHQSolar = Math.min(potentialHQSolar, cap40Percent);

  // No HQ incentive on batteries (HQ does not accept leftover cap room for storage)
  const incentivesHQBattery = 0;

  const incentivesHQ = incentivesHQSolar; // Solar only

  const batterySubY0 = 0;
  const batterySubY1 = 0;

  // Federal ITC: 30% of remaining after HQ
  const itcBasis = capexGross - incentivesHQ;
  const incentivesFederal = itcBasis * FEDERAL_ITC_RATE;

  // Tax shield (DPA/CCA)
  const capexNetAccounting = Math.max(0, capexGross - incentivesHQ - incentivesFederal);
  const taxShield = capexNetAccounting * h.taxRate * TAX_SHIELD_FACTOR;

  const totalIncentives = incentivesHQ + incentivesFederal + taxShield;
  const capexNet = capexGross - totalIncentives;
  const equityInitial = capexGross - incentivesHQSolar - batterySubY0;

  return {
    incentivesHQSolar,
    incentivesHQBattery,
    incentivesHQ,
    incentivesFederal,
    taxShield,
    capexNet,
    capexNetAccounting,
    totalIncentives,
    equityInitial,
    batterySubY0,
    batterySubY1,
    potentialHQSolar,
    potentialHQBattery,
    cap40Percent,
    itcBasis,
    capexAdmissible,
  };
}

/**
 * Generate 30-year cashflow array.
 *
 * Year 0: equity investment (CAPEX - upfront HQ incentives)
 * Year 1: tax shield + remaining battery HQ incentive
 * Year 2: federal ITC
 * Years 1-30: revenue (degradation + inflation), OPEX (escalation), battery replacements
 */
export function generateCashflowArray(
  annualSavings: number,
  annualSurplusRevenue: number,
  capexBattery: number,
  battEnergyKWh: number,
  pvSizeKW: number,
  capexPV: number,
  equityInitial: number,
  taxShield: number,
  incentivesFederal: number,
  batterySubY1: number,
  h: AnalysisAssumptions,
): CashflowEntry[] {
  // O&M base: use $/kW/yr if available, else % of CAPEX
  const omSolarBase = h.omPerKwc
    ? h.omPerKwc * pvSizeKW
    : capexPV * h.omSolarPercent;
  const opexBase = omSolarBase + (capexBattery * h.omBatteryPercent);

  const degradationRate = h.degradationRatePercent || 0.004;
  const replacementYear = h.batteryReplacementYear || 10;
  const replacementFactor = h.batteryReplacementCostFactor || 0.60;
  const priceDecline = h.batteryPriceDeclineRate || 0.05;

  const cashflows: CashflowEntry[] = [];
  let cumulative = -equityInitial;

  // Year 0
  cashflows.push({
    year: 0,
    revenue: 0,
    opex: 0,
    ebitda: 0,
    investment: -equityInitial,
    dpa: 0,
    incentives: 0,
    netCashflow: -equityInitial,
    cumulative,
  });

  for (let y = 1; y <= MAX_ANALYSIS_YEARS; y++) {
    const degradationFactor = Math.pow(1 - degradationRate, y - 1);
    const inflationFactor = Math.pow(1 + h.inflationRate, y - 1);

    // Revenue = savings + surplus, both degraded and inflated
    const savingsRevenue = annualSavings * degradationFactor * inflationFactor;
    const surplusRevenue = annualSurplusRevenue * degradationFactor * inflationFactor;
    const revenue = savingsRevenue + surplusRevenue;

    // OPEX escalates with inflation + escalation rate
    const opex = opexBase * Math.pow(1 + h.omEscalation, y - 1);
    const ebitda = revenue - opex;

    // Incentives
    let dpa = 0;
    let incentives = 0;
    if (y === 1) {
      dpa = taxShield;
      incentives = batterySubY1;
    }
    if (y === 2) {
      incentives = incentivesFederal;
    }

    // Battery replacements at configured intervals
    let investment = 0;
    if (battEnergyKWh > 0) {
      const isReplacementYear =
        y === replacementYear || y === 20 || y === 30;
      if (isReplacementYear) {
        // Net price = original cost × replacement factor × (1 + inflation - price decline)^year
        const netPriceChange = Math.pow(1 + h.inflationRate - priceDecline, y);
        investment = -capexBattery * replacementFactor * netPriceChange;
      }
    }

    const netCashflow = ebitda + investment + dpa + incentives;
    cumulative += netCashflow;

    cashflows.push({
      year: y,
      revenue,
      opex: -opex, // Convention: negative in entry
      ebitda,
      investment,
      dpa,
      incentives,
      netCashflow,
      cumulative,
    });
  }

  return cashflows;
}

/**
 * Calculate NPV for a given set of cashflows at a given discount rate and horizon.
 * Re-exported from simulationEngine for backward compatibility.
 * Inline implementation to avoid circular dependency.
 */
export function calculateNPV(
  cashflows: number[],
  discountRate: number,
  years: number,
): number {
  let npv = 0;
  for (let t = 0; t <= years && t < cashflows.length; t++) {
    npv += cashflows[t] / Math.pow(1 + discountRate, t);
  }
  return npv;
}

/**
 * Bisection fallback for IRR when Newton-Raphson fails to converge.
 */
function bisectionIRR(cashflows: number[]): number {
  let low = -0.99;
  let high = 2.0;
  const maxIterations = 100;
  const tolerance = 0.0001;

  const npvAtRate = (rate: number): number => {
    let npv = 0;
    for (let t = 0; t < cashflows.length; t++) {
      npv += cashflows[t] / Math.pow(1 + rate, t);
    }
    return npv;
  };

  let npvLow = npvAtRate(low);
  let npvHigh = npvAtRate(high);

  if (npvLow * npvHigh > 0) {
    for (let rate = low; rate <= high; rate += 0.1) {
      const npv = npvAtRate(rate);
      if (npvLow * npv < 0) {
        high = rate;
        npvHigh = npv;
        break;
      }
      if (npv * npvHigh < 0) {
        low = rate;
        npvLow = npv;
        break;
      }
    }
    if (npvLow * npvHigh > 0) {
      return 0;
    }
  }

  for (let i = 0; i < maxIterations; i++) {
    const mid = (low + high) / 2;
    const npvMid = npvAtRate(mid);
    if (Math.abs(npvMid) < tolerance || (high - low) / 2 < tolerance) {
      return Math.max(0, mid);
    }
    if (npvLow * npvMid < 0) {
      high = mid;
      npvHigh = npvMid;
    } else {
      low = mid;
      npvLow = npvMid;
    }
  }
  return Math.max(0, (low + high) / 2);
}

/**
 * Calculate IRR using Newton-Raphson method with safeguards.
 * Includes sign checks, clamping, convergence caps, and bisection fallback.
 */
export function calculateIRR(cashflows: number[], guess: number = 0.1, maxIter: number = 200, tolerance: number = 0.0001): number {
  if (cashflows.length < 2) return 0;

  // Sign check: need both negative and positive cashflows for meaningful IRR
  let hasNegative = false;
  let hasPositive = false;
  for (const cf of cashflows) {
    if (cf < 0) hasNegative = true;
    if (cf > 0) hasPositive = true;
  }
  if (!hasNegative || !hasPositive) {
    return hasPositive ? 1.0 : 0;
  }

  let rate = guess;
  for (let i = 0; i < maxIter; i++) {
    let npv = 0;
    let dnpv = 0;
    for (let t = 0; t < cashflows.length; t++) {
      const denom = Math.pow(1 + rate, t);
      if (denom === 0 || !isFinite(denom)) continue;
      npv += cashflows[t] / denom;
      if (t > 0) {
        dnpv -= (t * cashflows[t]) / Math.pow(1 + rate, t + 1);
      }
    }
    if (Math.abs(dnpv) < 1e-10) {
      return bisectionIRR(cashflows);
    }
    const newRate = rate - npv / dnpv;
    if (!isFinite(newRate)) {
      return bisectionIRR(cashflows);
    }
    // Clamp to prevent divergence
    const clampedRate = Math.max(-0.99, Math.min(5, newRate));
    if (Math.abs(clampedRate - rate) < tolerance) {
      // Cap final result to reasonable range [0, 1] (0% to 100%)
      return Math.max(0, Math.min(1, clampedRate));
    }
    rate = clampedRate;
  }
  // Newton-Raphson didn't converge — fall back to bisection
  return bisectionIRR(cashflows);
}

/**
 * Calculate all financial metrics from cashflow array.
 */
export function calculateFinancialMetrics(
  cashflows: CashflowEntry[],
  discountRate: number,
  analysisYears: number,
): {
  npv10: number;
  npv20: number;
  npv25: number;
  npv30: number;
  irr10: number;
  irr20: number;
  irr25: number;
  irr30: number;
  simplePaybackYears: number;
} {
  const cashflowValues = cashflows.map(c => c.netCashflow);

  const npv25 = calculateNPV(cashflowValues, discountRate, 25);
  const npv20 = calculateNPV(cashflowValues, discountRate, 20);
  const npv10 = calculateNPV(cashflowValues, discountRate, 10);
  const npv30 = calculateNPV(cashflowValues, discountRate, 30);

  const irr25 = calculateIRR(cashflowValues.slice(0, 26));
  const irr20 = calculateIRR(cashflowValues.slice(0, 21));
  const irr10 = calculateIRR(cashflowValues.slice(0, 11));
  const irr30 = calculateIRR(cashflowValues.slice(0, 31));

  // Simple payback: first year where cumulative ≥ 0
  let simplePaybackYears = analysisYears;
  for (let i = 1; i < Math.min(cashflows.length, 26); i++) {
    if (cashflows[i].cumulative >= 0) {
      simplePaybackYears = i;
      break;
    }
  }

  return { npv10, npv20, npv25, npv30, irr10, irr20, irr25, irr30, simplePaybackYears };
}

/**
 * Calculate LCOE (Levelized Cost of Energy) for 25 and 30 year horizons.
 *
 * Two modes:
 * - effectiveYield provided: uses pvSizeKW × effectiveYield × degradation (more accurate)
 * - effectiveYield not provided: uses totalProductionKWh × degradation (simulationEngine mode)
 */
export function calculateLCOE(
  pvSizeKW: number,
  capexNet: number,
  opexBase: number,
  degradationRate: number,
  annualProductionBase: number,
): { lcoe: number; lcoe30: number } {
  // 25-year LCOE
  let totalProduction25 = 0;
  for (let y = 1; y <= 25; y++) {
    totalProduction25 += annualProductionBase * Math.pow(1 - degradationRate, y - 1);
  }
  const totalLifetimeCost25 = capexNet + (opexBase * 25);
  const lcoe = totalProduction25 > 0 ? totalLifetimeCost25 / totalProduction25 : 0;

  // 30-year LCOE
  let totalProduction30 = 0;
  for (let y = 1; y <= 30; y++) {
    totalProduction30 += annualProductionBase * Math.pow(1 - degradationRate, y - 1);
  }
  const totalLifetimeCost30 = capexNet + (opexBase * 30);
  const lcoe30 = totalProduction30 > 0 ? totalLifetimeCost30 / totalProduction30 : 0;

  return { lcoe, lcoe30 };
}

// ─── Master Function ────────────────────────────────────────────────────────

/**
 * Master function: runs the complete financial analysis pipeline.
 *
 * This replaces the ~200 lines of duplicated code in each of the 3 source files.
 * Call this ONE function instead of copy-pasting incentive/cashflow/NPV logic.
 *
 * @param inputs - All required inputs for cashflow calculation
 * @returns Complete financial results including cashflows, metrics, breakdown
 */
export function calculateCashflowMetrics(inputs: CashflowInputs): CashflowResults {
  const h = inputs.assumptions;
  const { pvSizeKW, battEnergyKWh, battPowerKW, totalProductionKWh, annualConsumptionKWh } = inputs;

  // Step 1: CAPEX
  const { capexPV, capexBattery, capexGross, effectiveSolarCostPerW } = calculateCapex(
    pvSizeKW, battEnergyKWh, battPowerKW, h,
  );

  // Short-circuit for zero CAPEX
  if (capexGross === 0) {
    return getZeroResult();
  }

  // Step 2: Annual savings
  const savings = calculateAnnualSavings(inputs);

  // Step 3: Incentives
  const inc = calculateIncentives(
    capexPV, capexBattery, capexGross, pvSizeKW, battEnergyKWh, h,
  );

  // Step 4: Cashflow array (30 years)
  const cashflows = generateCashflowArray(
    savings.annualSavings,
    savings.annualSurplusRevenue,
    capexBattery,
    battEnergyKWh,
    pvSizeKW,
    capexPV,
    inc.equityInitial,
    inc.taxShield,
    inc.incentivesFederal,
    inc.batterySubY1,
    h,
  );

  // Step 5: Financial metrics (NPV, IRR, payback)
  const metrics = calculateFinancialMetrics(cashflows, h.discountRate, h.analysisYears);

  // Step 6: LCOE
  const degradationRate = h.degradationRatePercent || 0.004;
  const omSolarBase = h.omPerKwc ? h.omPerKwc * pvSizeKW : capexPV * h.omSolarPercent;
  const opexBase = omSolarBase + (capexBattery * h.omBatteryPercent);

  // Use effectiveYield if provided, else totalProductionKWh
  const annualProductionBase = inputs.effectiveYield
    ? pvSizeKW * inputs.effectiveYield
    : totalProductionKWh;

  const { lcoe, lcoe30 } = calculateLCOE(
    pvSizeKW, inc.capexNet, opexBase, degradationRate, annualProductionBase,
  );

  // Step 7: Environmental
  const co2AvoidedTonnesPerYear = (inputs.selfConsumptionKWh * CO2_FACTOR_QC) / 1000;

  // Step 8: Self-sufficiency
  const selfSufficiencyPercent = annualConsumptionKWh > 0
    ? (inputs.selfConsumptionKWh / annualConsumptionKWh) * 100
    : 0;

  // Step 9: Build breakdown
  const breakdown: FinancialBreakdown = {
    capexSolar: capexPV,
    capexBattery,
    capexGross,
    capexAdmissible: inc.capexAdmissible,
    potentialHQSolar: inc.potentialHQSolar,
    potentialHQBattery: inc.potentialHQBattery,
    cap40Percent: inc.cap40Percent,
    actualHQSolar: inc.incentivesHQSolar,
    actualHQBattery: inc.incentivesHQBattery,
    totalHQ: inc.incentivesHQ,
    itcBasis: inc.itcBasis,
    itcAmount: inc.incentivesFederal,
    depreciableBasis: inc.capexNetAccounting,
    taxShield: inc.taxShield,
    equityInitial: inc.equityInitial,
    batterySubY0: inc.batterySubY0,
    batterySubY1: inc.batterySubY1,
    capexNet: inc.capexNet,
    internalMargin: undefined as any, // Populated below if supplier costs available
  };

  // Step 10: Internal margin calculation
  // ALWAYS calculated — uses explicit supplier costs if provided, otherwise default tier costs.
  // Default supplier costs are estimated from QC market equipment pricing by system size.
  let internalMargin: CashflowResults['internalMargin'];
  {
    const laborPerW = h.laborCostPerW ?? 0.40;
    // Solar: use explicit supplier cost → else default tier cost
    const supplierSolarPerW = h.supplierSolarCostPerW ?? getDefaultSupplierCostPerW(pvSizeKW);
    const costSolar = pvSizeKW > 0
      ? pvSizeKW * 1000 * (supplierSolarPerW + laborPerW)
      : 0;
    // Battery: use explicit supplier costs → else defaults from assumptions
    // Battery sell price uses h.batteryCapacityCost/PowerCost (which may include margin)
    // Battery supplier cost uses explicit supplier values or falls back to 85% of sell price
    const supplierBattCapPerKWh = h.supplierBatteryCostPerKWh ?? (h.batteryCapacityCost * 0.85);
    const supplierBattPowPerKW = h.supplierBatteryPowerCostPerKW ?? (h.batteryPowerCost * 0.85);
    const costBattery =
      battEnergyKWh * supplierBattCapPerKWh +
      battPowerKW * supplierBattPowPerKW;
    const costTotal = costSolar + costBattery;

    const sellSolar = capexPV;
    const sellBattery = capexBattery;
    const sellTotal = capexGross;

    const marginDollarsSolar = sellSolar - costSolar;
    const marginDollarsBattery = sellBattery - costBattery;
    const marginDollarsTotal = sellTotal - costTotal;

    const marginPercentSolar = sellSolar > 0 ? (marginDollarsSolar / sellSolar) * 100 : 0;
    const marginPercentBattery = sellBattery > 0 ? (marginDollarsBattery / sellBattery) * 100 : 0;
    const marginPercentTotal = sellTotal > 0 ? (marginDollarsTotal / sellTotal) * 100 : 0;

    // Flag whether these are real supplier costs or defaults
    const isEstimated = h.supplierSolarCostPerW === undefined && h.supplierBatteryCostPerKWh === undefined;

    internalMargin = {
      costSolar, costBattery, costTotal,
      sellSolar, sellBattery, sellTotal,
      marginDollarsSolar, marginDollarsBattery, marginDollarsTotal,
      marginPercentSolar, marginPercentBattery, marginPercentTotal,
      isEstimated, // true = default supplier costs, false = real project-specific costs
    };
    // Also store in breakdown for DB persistence
    breakdown.internalMargin = internalMargin;
  }

  return {
    capexSolar: capexPV,
    capexBattery,
    capexGross,
    capexNet: inc.capexNet,
    incentivesHQ: inc.incentivesHQ,
    incentivesHQSolar: inc.incentivesHQSolar,
    incentivesHQBattery: inc.incentivesHQBattery,
    incentivesFederal: inc.incentivesFederal,
    taxShield: inc.taxShield,
    annualSavings: savings.annualSavings,
    annualSurplusRevenue: savings.annualSurplusRevenue,
    annualCostBefore: savings.annualCostBefore,
    annualCostAfter: savings.annualCostAfter,
    ...metrics,
    internalMargin,
    lcoe,
    lcoe30,
    cashflows,
    co2AvoidedTonnesPerYear,
    selfSufficiencyPercent,
    breakdown,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getZeroResult(): CashflowResults {
  const zeroBreakdown: FinancialBreakdown = {
    capexSolar: 0, capexBattery: 0, capexGross: 0, capexAdmissible: 0,
    potentialHQSolar: 0, potentialHQBattery: 0, cap40Percent: 0,
    actualHQSolar: 0, actualHQBattery: 0, totalHQ: 0,
    itcBasis: 0, itcAmount: 0, depreciableBasis: 0, taxShield: 0,
    equityInitial: 0, batterySubY0: 0, batterySubY1: 0, capexNet: 0,
  };

  return {
    capexSolar: 0, capexBattery: 0, capexGross: 0, capexNet: 0,
    incentivesHQ: 0, incentivesHQSolar: 0, incentivesHQBattery: 0,
    incentivesFederal: 0, taxShield: 0,
    annualSavings: 0, annualSurplusRevenue: 0, annualCostBefore: 0, annualCostAfter: 0,
    npv10: 0, npv20: 0, npv25: 0, npv30: 0,
    irr10: 0, irr20: 0, irr25: 0, irr30: 0,
    lcoe: 0, lcoe30: 0, simplePaybackYears: 0,
    cashflows: [], co2AvoidedTonnesPerYear: 0, selfSufficiencyPercent: 0,
    breakdown: zeroBreakdown,
  };
}
