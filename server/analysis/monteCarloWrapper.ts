/**
 * Module A: Monte Carlo Wrapper for Probabilistic ROI Analysis
 * 
 * Wraps the existing financial analysis in a simulation loop to generate
 * P10/P50/P90 confidence intervals for financial outcomes.
 * 
 * This allows clients to understand the range of possible outcomes based on
 * uncertainty in key variables.
 * 
 * Variable Mapping (Config → AnalysisAssumptions → Financial Engine):
 * - tariffEscalation (2-7%) → inflationRate → HQ tariff escalation on savings/revenue
 *   (Note: The schema field is named "inflationRate" but is used for tariff escalation
 *   as confirmed by code comments: "Revenue = base savings * degradation * tariff inflation")
 * - omEscalation (3-6%) → omEscalation → O&M operating cost escalation
 * - productionVariance (±10%) → solarYieldKWhPerKWp → affects annual solar production
 */

import type { AnalysisAssumptions } from "@shared/schema";

export interface MonteCarloConfig {
  iterations: number;
  variableRanges: {
    tariffEscalation: [number, number];
    omEscalation: [number, number];
    productionVariance: [number, number];
  };
  seed?: number;
}

export const defaultMonteCarloConfig: MonteCarloConfig = {
  iterations: 1000,
  variableRanges: {
    tariffEscalation: [0.02, 0.07],
    omEscalation: [0.03, 0.06],
    productionVariance: [-0.10, 0.10],
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
    assumptions: Partial<AnalysisAssumptions>;
    result: ScenarioResult;
    paybackYears: number;
    totalSavings25: number;
  }> = [];

  for (let i = 0; i < config.iterations; i++) {
    const sampledTariffEscalation = randomInRange(config.variableRanges.tariffEscalation, random);
    const sampledOmEscalation = randomInRange(config.variableRanges.omEscalation, random);
    const productionVariance = randomInRange(config.variableRanges.productionVariance, random);

    const baseYield = baseAssumptions.solarYieldKWhPerKWp || 1150;
    const variedYield = Math.round(baseYield * (1 + productionVariance));

    const variedAssumptions: AnalysisAssumptions = {
      ...JSON.parse(JSON.stringify(baseAssumptions)),
      inflationRate: sampledTariffEscalation,
      omEscalation: sampledOmEscalation,
      solarYieldKWhPerKWp: variedYield,
    };

    try {
      const result = runScenario(variedAssumptions);
      const paybackYears = calculatePaybackYears(result.cashflows);
      const totalSavings25 = result.cashflows.reduce((sum, cf) => sum + cf.netCashflow, 0);

      results.push({
        assumptions: { 
          tariffEscalation: sampledTariffEscalation,
          omEscalation: sampledOmEscalation,
          solarYieldKWhPerKWp: variedYield 
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
