/**
 * Module A: Monte Carlo Wrapper for Probabilistic ROI Analysis
 * 
 * Wraps the existing financial analysis in a simulation loop to generate
 * P10/P50/P90 confidence intervals for financial outcomes.
 * 
 * This allows clients to understand the range of possible outcomes based on
 * uncertainty in key variables.
 * 
 * NOTE: This uses a simplified financial model (not hourly simulation) because
 * Monte Carlo requires 500+ iterations for statistical significance. The full
 * hourly simulation is too compute-intensive for this purpose. Key financial
 * formulas (incentives, tax shield, payback) are aligned with the main engine.
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
import { createLogger } from "../lib/logger";

const log = createLogger("MonteCarlo");

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

// Site parameters for simplified scenario runner
export interface SiteScenarioParams {
  pvSizeKW: number;
  annualConsumptionKWh: number;
  tariffEnergy: number;
  tariffPower: number;
  peakKW: number;
}

// Creates a simplified scenario runner for Monte Carlo analysis
// Uses simplified cashflow model when hourly data is not available
// Note: This is a simplified model - for full accuracy, use the detailed analysis with hourly data
export function createSimplifiedScenarioRunner(
  siteParams: SiteScenarioParams
): (assumptions: AnalysisAssumptions) => ScenarioResult {
  return (assumptions: AnalysisAssumptions): ScenarioResult => {
    const h = assumptions;
    const { pvSizeKW, annualConsumptionKWh, tariffEnergy, tariffPower, peakKW } = siteParams;
    
    // Calculate effective yield with temperature correction
    const baseYield = h.solarYieldKWhPerKWp || 1150;
    const tempCoeff = h.temperatureCoefficient || -0.004;
    const avgTempDelta = 15; // Average operating temp above STC (25°C)
    const tempLoss = Math.abs(tempCoeff) * avgTempDelta;
    const wireLoss = h.wireLossPercent || 0.03; // Canonical wire loss value (3%)
    const inverterEff = 0.96;
    const effectiveYield = baseYield * (1 - tempLoss) * (1 - wireLoss) * inverterEff;
    
    // Annual production
    const annualProductionKWh = pvSizeKW * effectiveYield;
    const selfConsumptionRatio = Math.min(0.95, annualConsumptionKWh / (annualProductionKWh * 1.1));
    const selfConsumedKWh = annualProductionKWh * selfConsumptionRatio;
    const exportedKWh = annualProductionKWh - selfConsumedKWh;
    
    // CAPEX calculation
    const solarCostPerW = h.solarCostPerW || 2.00;
    const capexGross = pvSizeKW * 1000 * solarCostPerW;
    
    // Incentives (aligned with main financial engine)
    // HQ: $1000/kW capped at 40% of gross CAPEX, max 1MW
    const hqIncentive = Math.min(
      pvSizeKW * 1000, 
      capexGross * 0.40,
      1000 * 1000 // 1MW cap
    );
    const afterHQ = capexGross - hqIncentive;
    // Federal ITC: 30% of remaining CAPEX
    const federalITC = afterHQ * 0.30;
    const capexNet = afterHQ - federalITC;
    
    // Tax rate for CCA tax shield calculation
    const taxRate = h.taxRate || 0.265;
    
    // Tax shield: CCA Class 43.2 allows 100% year-1 expensing for clean energy
    // Factor 0.90 is conservative (assumes 10% not recovered)
    const taxShield = capexNet * taxRate * 0.90;
    
    // Energy savings year 1 (surplus revenue separated - delayed to year 3 per HQ 24-month cycle)
    const energyRate = tariffEnergy || h.tariffEnergy || 0.06;
    const energySavingsY1 = selfConsumedKWh * energyRate;
    const surplusRevenueY1 = exportedKWh * (h.hqSurplusCompensationRate || 0.046);
    
    // Demand charge savings (simplified model)
    // Estimate solar covers ~10-15% of peak during peak hours (conservative)
    const solarPeakContribution = Math.min(pvSizeKW * 0.15, peakKW * 0.10);
    const effectiveTariffPower = tariffPower || h.tariffPower || 17.573;
    const demandSavingsY1 = solarPeakContribution * effectiveTariffPower * 12;
    
    // O&M costs ($/kWc/year)
    const omPerKW = h.omPerKwc !== undefined ? h.omPerKwc : 15;
    const omCostY1 = pvSizeKW * omPerKW;
    
    // Generate 26-year cashflows (year 0 to 25)
    const cashflows: Array<{ year: number; netCashflow: number }> = [];
    const cashflowValues: number[] = [];
    
    // Year 0: CAPEX investment + tax shield
    const effectiveYear0 = -capexNet + taxShield;
    cashflows.push({ year: 0, netCashflow: effectiveYear0 });
    cashflowValues.push(effectiveYear0);
    
    const degradationRate = h.degradationRatePercent || 0.004;
    const escalationRate = h.inflationRate || 0.035;
    const omEscalation = h.omEscalation || 0.025;
    
    for (let year = 1; year <= 25; year++) {
      const degradationFactor = Math.pow(1 - degradationRate, year);
      const escalationFactor = Math.pow(1 + escalationRate, year);
      const yearEnergySavings = energySavingsY1 * degradationFactor * escalationFactor;
      const yearSurplus = year >= 3 ? surplusRevenueY1 * degradationFactor * escalationFactor : 0;
      const yearDemandSavings = demandSavingsY1 * escalationFactor;
      const yearOm = omCostY1 * Math.pow(1 + omEscalation, year);
      const netCashflow = yearEnergySavings + yearSurplus + yearDemandSavings - yearOm;
      
      cashflows.push({ year, netCashflow });
      cashflowValues.push(netCashflow);
    }
    
    // Calculate NPV at different horizons
    const discountRate = h.discountRate || 0.06;
    const calculateNPV = (years: number): number => {
      let npv = 0;
      for (let y = 0; y <= Math.min(years, cashflowValues.length - 1); y++) {
        npv += cashflowValues[y] / Math.pow(1 + discountRate, y);
      }
      return npv;
    };
    
    // Calculate IRR using bisection with relative tolerance
    const calculateIRR = (years: number): number => {
      const cf = cashflowValues.slice(0, years + 1);
      let low = -0.5;
      let high = 1.0;
      
      const npvAtRate = (rate: number): number => {
        let npv = 0;
        for (let t = 0; t < cf.length; t++) {
          npv += cf[t] / Math.pow(1 + rate, t);
        }
        return npv;
      };
      
      // Cache NPV at low for efficiency
      let npvLow = npvAtRate(low);
      
      for (let iter = 0; iter < 100; iter++) {
        const mid = (low + high) / 2;
        const npvMid = npvAtRate(mid);
        
        // Use relative tolerance based on CAPEX size
        const tolerance = Math.abs(capexNet) * 1e-6;
        if (Math.abs(npvMid) < tolerance || (high - low) < 1e-6) {
          return Math.max(0, Math.min(1, mid));
        }
        
        if (npvLow * npvMid < 0) {
          high = mid;
        } else {
          low = mid;
          npvLow = npvMid;
        }
      }
      return (low + high) / 2;
    };
    
    return {
      npv25: calculateNPV(25),
      npv10: calculateNPV(10),
      npv20: calculateNPV(20),
      irr25: calculateIRR(25),
      irr10: calculateIRR(10),
      irr20: calculateIRR(20),
      capexNet,
      cashflows,
    };
  };
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
      log.warn(`Monte Carlo iteration ${i} failed:`, err);
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
