/**
 * Module A: Monte Carlo Wrapper for Probabilistic ROI Analysis
 * 
 * Wraps the existing financial analysis in a simulation loop to generate
 * P10/P50/P90 confidence intervals for financial outcomes.
 * 
 * This allows clients to understand the range of possible outcomes based on
 * uncertainty in key variables.
 * 
 * Updated Jan 2026 per James (solar expert) - realistic 25-year assumptions:
 * 
 * Variable Mapping (Config → AnalysisAssumptions → Financial Engine):
 * - tariffEscalation (2.5-3.5%) → inflationRate → HQ tariff escalation on savings/revenue
 *   (Note: Historic Quebec rates averaged 2.6-3.1% CAGR over 20 years)
 * - discountRate (6-8%) → discountRate → WACC for NPV calculations
 * - solarYield (1075-1225) → solarYieldKWhPerKWp → absolute kWh/kWp/year
 * - bifacialBoost (10-20%) → multiplier on solar production (simplified, no albedo)
 * - omPerKwc ($10-20) → O&M cost per kWc/year (converted to % of CAPEX internally)
 * - solarCostPerW ($1.75-2.35) → solarCostPerW → CAPEX per watt (lower = optimistic)
 */

import type { AnalysisAssumptions } from "@shared/schema";

export interface MonteCarloConfig {
  iterations: number;
  variableRanges: {
    // HQ tariff escalation: 2.5% (pessimistic) to 3.5% (optimistic)
    tariffEscalation: [number, number];
    // Discount rate (WACC): 6% (optimistic) to 8% (pessimistic)
    discountRate: [number, number];
    // Solar yield: 1075 (pessimistic) to 1225 (optimistic) kWh/kWp/year
    solarYield: [number, number];
    // Bifacial production boost: 10% (pessimistic) to 20% (optimistic)
    bifacialBoost: [number, number];
    // O&M cost per kWc: $10 (optimistic) to $20 (pessimistic)
    omPerKwc: [number, number];
    // Solar cost per watt: $1.75 (optimistic) to $2.35 (pessimistic)
    solarCostPerW: [number, number];
  };
  seed?: number;
}

export const defaultMonteCarloConfig: MonteCarloConfig = {
  iterations: 500,
  variableRanges: {
    tariffEscalation: [0.025, 0.035], // 2.5-3.5% per James
    discountRate: [0.06, 0.08],       // 6-8% WACC
    solarYield: [1075, 1225],         // kWh/kWp/year direct
    bifacialBoost: [0.10, 0.20],      // 10-20% production boost
    omPerKwc: [10, 20],               // $10-20/kWc/year
    solarCostPerW: [1.75, 2.35],      // $1.75-2.35/W (lower = optimistic)
  },
};

export interface MonteCarloResult {
  p10: FinancialSummary;
  p50: FinancialSummary;
  p90: FinancialSummary;
  mean: FinancialSummary;
  iterations: number;
  distribution: {
    npv25: number[];
    irr25: number[];
    paybackYears: number[];
  };
  inputRanges: MonteCarloConfig['variableRanges'];
}

export interface FinancialSummary {
  npv25: number;
  npv10: number;
  npv20: number;
  irr25: number;
  irr10: number;
  irr20: number;
  paybackYears: number;
  capexNet: number;
  totalSavings25: number;
}

interface ScenarioResult {
  npv25: number;
  npv10: number;
  npv20: number;
  irr25: number;
  irr10: number;
  irr20: number;
  capexNet: number;
  cashflows: Array<{ year: number; netCashflow: number }>;
}

function randomInRange(range: [number, number], random: () => number = Math.random): number {
  const [min, max] = range;
  return min + random() * (max - min);
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function calculatePaybackYears(cashflows: Array<{ year: number; netCashflow: number }>): number {
  let cumulative = 0;
  for (const cf of cashflows) {
    cumulative += cf.netCashflow;
    if (cumulative >= 0) {
      const previousCumulative = cumulative - cf.netCashflow;
      const fractionOfYear = cf.netCashflow !== 0 
        ? Math.abs(previousCumulative) / Math.abs(cf.netCashflow)
        : 0;
      return cf.year - 1 + fractionOfYear;
    }
  }
  return 25;
}

function percentile<T>(arr: T[], p: number, accessor: (item: T) => number): number {
  const sorted = [...arr].sort((a, b) => accessor(a) - accessor(b));
  const index = Math.floor(sorted.length * p);
  return accessor(sorted[Math.min(index, sorted.length - 1)]);
}

function mean<T>(arr: T[], accessor: (item: T) => number): number {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, item) => sum + accessor(item), 0) / arr.length;
}

export function runMonteCarloAnalysis(
  baseAssumptions: AnalysisAssumptions,
  runScenario: (assumptions: AnalysisAssumptions) => ScenarioResult,
  config: MonteCarloConfig = defaultMonteCarloConfig
): MonteCarloResult {
  const random = config.seed !== undefined 
    ? seededRandom(config.seed) 
    : Math.random;

  const results: Array<{
    sampledInputs: {
      tariffEscalation: number;
      discountRate: number;
      solarYield: number;
      bifacialBoost: number;
      omPerKwc: number;
      solarCostPerW: number;
      effectiveYield: number;
    };
    result: ScenarioResult;
    paybackYears: number;
    totalSavings25: number;
  }> = [];

  for (let i = 0; i < config.iterations; i++) {
    // Sample all variables per James's expert recommendations
    const sampledTariffEscalation = randomInRange(config.variableRanges.tariffEscalation, random);
    const sampledDiscountRate = randomInRange(config.variableRanges.discountRate, random);
    const sampledSolarYield = Math.round(randomInRange(config.variableRanges.solarYield, random));
    const sampledBifacialBoost = randomInRange(config.variableRanges.bifacialBoost, random);
    const sampledOmPerKwc = randomInRange(config.variableRanges.omPerKwc, random);
    const sampledSolarCostPerW = randomInRange(config.variableRanges.solarCostPerW, random);
    
    // Apply bifacial boost to solar yield
    const effectiveYield = Math.round(sampledSolarYield * (1 + sampledBifacialBoost));
    
    // Convert O&M per kWc to % of CAPEX for compatibility with existing engine
    // Using sampled solar cost per W for accurate O&M percentage
    const solarCostPerKw = sampledSolarCostPerW * 1000;
    const omSolarPercent = sampledOmPerKwc / solarCostPerKw;

    const variedAssumptions: AnalysisAssumptions = {
      ...JSON.parse(JSON.stringify(baseAssumptions)),
      inflationRate: sampledTariffEscalation,
      discountRate: sampledDiscountRate,
      solarYieldKWhPerKWp: effectiveYield, // Already includes bifacial boost
      omSolarPercent: omSolarPercent,
      solarCostPerW: sampledSolarCostPerW,
      bifacialEnabled: false, // Disable to prevent double-counting (bifacial already in effectiveYield)
      yieldSource: 'manual' as const, // Monte Carlo samples its own yield, apply temp correction
    };

    try {
      const result = runScenario(variedAssumptions);
      const paybackYears = calculatePaybackYears(result.cashflows);
      const totalSavings25 = result.cashflows.reduce((sum, cf) => sum + cf.netCashflow, 0);

      results.push({
        sampledInputs: { 
          tariffEscalation: sampledTariffEscalation,
          discountRate: sampledDiscountRate,
          solarYield: sampledSolarYield,
          bifacialBoost: sampledBifacialBoost,
          omPerKwc: sampledOmPerKwc,
          solarCostPerW: sampledSolarCostPerW,
          effectiveYield: effectiveYield,
        },
        result,
        paybackYears,
        totalSavings25,
      });
    } catch (err) {
      console.warn(`Monte Carlo iteration ${i} failed:`, err);
    }
  }

  if (results.length === 0) {
    throw new Error("All Monte Carlo iterations failed");
  }

  const createSummary = (items: typeof results, pctAccessor: (arr: typeof results, accessor: (item: typeof results[0]) => number) => number): FinancialSummary => ({
    npv25: pctAccessor(items, r => r.result.npv25),
    npv10: pctAccessor(items, r => r.result.npv10),
    npv20: pctAccessor(items, r => r.result.npv20),
    irr25: pctAccessor(items, r => r.result.irr25),
    irr10: pctAccessor(items, r => r.result.irr10),
    irr20: pctAccessor(items, r => r.result.irr20),
    paybackYears: pctAccessor(items, r => r.paybackYears),
    capexNet: pctAccessor(items, r => r.result.capexNet),
    totalSavings25: pctAccessor(items, r => r.totalSavings25),
  });

  return {
    p10: createSummary(results, (arr, acc) => percentile(arr, 0.10, acc)),
    p50: createSummary(results, (arr, acc) => percentile(arr, 0.50, acc)),
    p90: createSummary(results, (arr, acc) => percentile(arr, 0.90, acc)),
    mean: createSummary(results, (arr, acc) => mean(arr, acc)),
    iterations: results.length,
    distribution: {
      npv25: results.map(r => r.result.npv25).sort((a, b) => a - b),
      irr25: results.map(r => r.result.irr25).sort((a, b) => a - b),
      paybackYears: results.map(r => r.paybackYears).sort((a, b) => a - b),
    },
    inputRanges: config.variableRanges,
  };
}
