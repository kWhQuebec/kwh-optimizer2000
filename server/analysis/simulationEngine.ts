import {
  defaultAnalysisAssumptions,
  type AnalysisAssumptions,
  type OptimalScenario,
  type OptimalScenarios,
  type HourlyProfileEntry,
  type PeakWeekEntry,
  type SensitivityAnalysis,
  type FrontierPoint,
  type SolarSweepPoint,
  type BatterySweepPoint,
} from "@shared/schema";
import {
  getTieredSolarCostPerW,
  type YieldStrategy,
  type SystemModelingParams,
  QUEBEC_MONTHLY_TEMPS,
  BASELINE_YIELD,
} from "../analysis/potentialAnalysis";
import { calculateCashflowMetrics, calculateIRR, bisectionIRR } from "../analysis/cashflowCalculations";
import { TEMPERATURE_COEFFICIENT } from '@shared/constants';

export const SNOW_LOSS_FLAT_ROOF: number[] = [
  0.55, // Jan - 55% loss (PVGIS-calibrated, panels partially self-clear via heating)
  0.45, // Feb - 45% loss (persistent snow, some melting mid-month)
  0.30, // Mar - 30% loss (spring thaw begins, intermittent coverage)
  0.05, // Apr - 5% loss (rapid melt, last traces)
  0.00, // May
  0.00, // Jun
  0.00, // Jul
  0.00, // Aug
  0.00, // Sep
  0.00, // Oct
  0.10, // Nov - 10% loss (first snowfalls)
  0.40, // Dec - 40% loss (snow accumulation, short days)
];

export const SNOW_LOSS_TILTED: number[] = [
  0.30, // Jan - snow slides off tilted panels (>15°)
  0.25, // Feb
  0.15, // Mar
  0.02, // Apr
  0.00, // May
  0.00, // Jun
  0.00, // Jul
  0.00, // Aug
  0.00, // Sep
  0.00, // Oct
  0.05, // Nov
  0.20, // Dec
];

/**
 * Snow loss profile for 10° ballasted racks (KB, Opsun 10°).
 * Source: NAIT Reference Array Report, Edmonton, March 31, 2017.
 * 5-year study, same equipment (Conergy P-230PA, Enphase M215) at all angles.
 * 14° (closest to 10°) = 4.81% annual snow loss vs cleared reference.
 * Monthly distribution scaled from flat_roof shape to ~5% annual total.
 * Note: 14° is a proxy for 10° — actual 10° loss may be slightly higher.
 * Edmonton snow is drier than Montreal; ~5% is a conservative interpretation.
 */
export const SNOW_LOSS_BALLASTED_10DEG: number[] = [
  0.18, // Jan
  0.14, // Feb
  0.10, // Mar
  0.02, // Apr
  0.00, // May
  0.00, // Jun
  0.00, // Jul
  0.00, // Aug
  0.00, // Sep
  0.00, // Oct
  0.03, // Nov
  0.13, // Dec
];

const BASELINE_CAPACITY_FACTOR = 0.645;

export interface HourlySimulationResult {
  totalSelfConsumption: number;
  totalProductionKWh: number;
  totalExportedKWh: number;
  peakAfter: number;
  hourlyProfile: HourlyProfileEntry[];
  peakWeekData: PeakWeekEntry[];
  clippingLossKWh: number;
  monthlyPeaksBefore: number[];
  monthlyPeaksAfter: number[];
  totalGridChargingKWh: number;
}

export interface RunScenarioResult {
  npv25: number;
  npv10: number;
  npv20: number;
  npv30: number;
  capexNet: number;
  irr25: number;
  irr10: number;
  irr20: number;
  irr30: number;
  lcoe: number;
  lcoe30: number;
  incentivesHQ: number;
  incentivesHQSolar: number;
  incentivesHQBattery: number;
  incentivesFederal: number;
  taxShield: number;
  cashflows: Array<{ year: number; netCashflow: number }>;
  annualSavings: number;
  simplePaybackYears: number;
  totalProductionKWh: number;
  selfSufficiencyPercent: number;
  co2AvoidedTonnesPerYear: number;
  capexSolar: number;
  capexBattery: number;
  capexGross: number;
  totalExportedKWh: number;
  annualSurplusRevenue: number;
  annualCostBefore: number;
  annualCostAfter: number;
  peakAfterKW: number;
  selfConsumptionKWh: number;
  hourlyProfileSummary: Array<{ hour: string; consumptionBefore: number; consumptionAfter: number; peakBefore: number; peakAfter: number }>;
  [key: string]: any;
}

export function runHourlySimulation(
  hourlyData: Array<{ hour: number; month: number; consumption: number; peak: number }>,
  pvSizeKW: number,
  battEnergyKWh: number,
  battPowerKW: number,
  threshold: number,
  solarYieldFactor: number = 1.0,
  systemParams: SystemModelingParams = { inverterLoadRatio: 1.45, temperatureCoefficient: TEMPERATURE_COEFFICIENT, wireLossPercent: 0.03, skipTempCorrection: false, lidLossPercent: 0.01, mismatchLossPercent: 0.02, mismatchStringsLossPercent: 0.0015, moduleQualityGainPercent: 0.0075 },
  yieldSource: 'google' | 'manual' | 'default' = 'default',
  snowLossProfile?: 'none' | 'flat_roof' | 'tilted' | 'ballasted_10deg'
): HourlySimulationResult {
  const hourlyProfile: HourlyProfileEntry[] = [];
  let soc = battEnergyKWh * 0.5;
  let totalSelfConsumption = 0;
  let totalProductionKWh = 0;
  let totalExportedKWh = 0;
  let peakAfter = 0;
  let maxPeakIndex = 0;
  let maxPeakValue = 0;
  let clippingLossKWh = 0;
  const monthlyPeaksBefore: number[] = new Array(12).fill(0);
  const monthlyPeaksAfter: number[] = new Array(12).fill(0);
  let totalGridChargingKWh = 0;

  const inverterACCapacityKW = pvSizeKW / systemParams.inverterLoadRatio;

  if (hourlyData.length === 0) {
    return {
      totalSelfConsumption: 0,
      totalProductionKWh: 0,
      totalExportedKWh: 0,
      peakAfter: 0,
      hourlyProfile: [],
      peakWeekData: [],
      clippingLossKWh: 0,
      monthlyPeaksBefore: new Array(12).fill(0),
      monthlyPeaksAfter: new Array(12).fill(0),
      totalGridChargingKWh: 0,
    };
  }

  // ── Pre-pass: calculate optimal daily target levels ──
  // For each day, find the target level T such that the total energy needed
  // to shave all peaks above T equals the available battery SOC.
  // This distributes battery energy optimally across all high peaks in a day,
  // instead of greedily dumping energy into chronologically-first hours.
  //
  // Algorithm: binary search on T between threshold and dayMaxPeak.
  // At T, energy needed = sum(max(0, min(peak_h - T, battPowerKW))) for hours where peak_h > T
  // Find T where energy needed = available SOC (estimated as 90% of battEnergyKWh)

  const dailyTargetLevels = new Map<string, number>();

  if (battPowerKW > 0 && battEnergyKWh > 0) {
    // Group hours by day
    const dailyHours = new Map<string, Array<{ index: number; peak: number; hour: number }>>();
    for (let i = 0; i < hourlyData.length; i++) {
      const { hour, month, peak } = hourlyData[i];
      const dayIndex = Math.floor(i / 24);
      const dayKey = `${month}-${dayIndex}`;
      const arr = dailyHours.get(dayKey) || [];
      arr.push({ index: i, peak, hour });
      dailyHours.set(dayKey, arr);
    }

    for (const [dayKey, hours] of dailyHours) {
      const peaksAbove = hours.filter(h => h.peak > threshold).sort((a, b) => b.peak - a.peak);
      if (peaksAbove.length === 0) {
        dailyTargetLevels.set(dayKey, threshold);
        continue;
      }

      const dayMaxPeak = peaksAbove[0].peak;
      // Available SOC for this day — assume 90% charged from overnight + any solar
      const availableSOC = battEnergyKWh * 0.9;

      // Binary search for optimal target level
      let lo = threshold;
      let hi = dayMaxPeak;

      // Check if we have enough energy to bring everything to threshold
      const energyForThreshold = peaksAbove.reduce(
        (sum, h) => sum + Math.min(h.peak - threshold, battPowerKW), 0
      );

      if (energyForThreshold <= availableSOC) {
        // Enough energy to shave everything to threshold
        dailyTargetLevels.set(dayKey, threshold);
      } else {
        // Binary search for the target level
        for (let iter = 0; iter < 30; iter++) {
          const mid = (lo + hi) / 2;
          const energyNeeded = peaksAbove.reduce(
            (sum, h) => sum + Math.max(0, Math.min(h.peak - mid, battPowerKW)), 0
          );
          if (energyNeeded > availableSOC) {
            lo = mid; // Need to raise target (less shaving)
          } else {
            hi = mid; // Can lower target (more shaving)
          }
        }
        dailyTargetLevels.set(dayKey, Math.ceil(lo)); // Round up to be conservative
      }
    }
  }

  for (let i = 0; i < hourlyData.length; i++) {
    const { hour, month, consumption, peak } = hourlyData[i];

    const bell = Math.exp(-Math.pow(hour - 13, 2) / 8);
    const season = 1 + 0.4 * Math.cos((month - 6) * 2 * Math.PI / 12);
    const isDaytime = hour >= 5 && hour <= 20;

    let dcProduction = pvSizeKW * bell * season * BASELINE_CAPACITY_FACTOR * solarYieldFactor * (isDaytime ? 1 : 0);

    const shouldSkipTempCorrection = yieldSource === 'google' || yieldSource === 'manual';
    if (!shouldSkipTempCorrection) {
      const ambientTemp = QUEBEC_MONTHLY_TEMPS[month - 1] || 10;
      const cellTempRise = 25 * bell;
      const cellTemp = ambientTemp + cellTempRise;
      const stcCellTemp = 25;
      const tempCorrectionFactor = 1 + systemParams.temperatureCoefficient * (cellTemp - stcCellTemp);
      dcProduction *= tempCorrectionFactor;
    }

    dcProduction *= (1 - systemParams.wireLossPercent);
    dcProduction *= (1 - systemParams.lidLossPercent);
    dcProduction *= (1 - systemParams.mismatchLossPercent);
    dcProduction *= (1 - systemParams.mismatchStringsLossPercent);
    dcProduction *= (1 + systemParams.moduleQualityGainPercent);

    if (snowLossProfile === 'flat_roof') {
      dcProduction *= (1 - SNOW_LOSS_FLAT_ROOF[month - 1]);
    } else if (snowLossProfile === 'tilted') {
      dcProduction *= (1 - SNOW_LOSS_TILTED[month - 1]);
    } else if (snowLossProfile === 'ballasted_10deg') {
      dcProduction *= (1 - SNOW_LOSS_BALLASTED_10DEG[month - 1]);
    }

    let acProduction = dcProduction;
    if (dcProduction > inverterACCapacityKW) {
      clippingLossKWh += (dcProduction - inverterACCapacityKW);
      acProduction = inverterACCapacityKW;
    }

    const production = Math.max(0, acProduction);

    const net = consumption - production;

    let battAction = 0;
    const peakBefore = peak;
    let peakFinal = peak;
    let isGridCharging = false;

    if (battPowerKW > 0 && battEnergyKWh > 0) {
      const dayIndex = Math.floor(i / 24);
      const dayKey = `${month}-${dayIndex}`;
      const targetLevel = dailyTargetLevels.get(dayKey) ?? threshold;

      if (peak > targetLevel && soc > 0) {
        // Discharge to bring peak down to daily target level
        // The target level is pre-calculated to optimally distribute battery energy
        // across ALL high-peak hours in the day, not just the chronologically first ones.
        const maxDischarge = Math.min(peak - targetLevel, battPowerKW, soc);
        battAction = -maxDischarge;
      } else if (net < 0 && soc < battEnergyKWh) {
        battAction = Math.min(Math.abs(net), battPowerKW, battEnergyKWh - soc);
      } else if ((hour >= 22 || hour < 6) && soc < battEnergyKWh * 0.9) {
        // Grid charging overnight (22h-5h): charge to 90% SOC for next day's peak shaving.
        // CRITICAL: Cap charging rate so peak + charge <= threshold.
        // Without this cap, a 100kW battery charging during 80kW nighttime consumption
        // creates a 180kW billing peak — HIGHER than the peaks we're trying to shave.
        // HQ Tariff M bills on the highest 15-min interval INCLUDING nighttime.
        // Extended window (22h-5h) compensates for the lower charge rate: at avg nighttime
        // ~60kW with threshold 129kW, we charge at ~69kW × 8 hours = 552kWh capacity.
        const targetSoc = battEnergyKWh * 0.9;
        const maxChargeWithoutNewPeak = Math.max(0, threshold - peak);
        battAction = Math.min(battPowerKW, targetSoc - soc, maxChargeWithoutNewPeak);
        if (battAction > 0) {
          isGridCharging = true;
        }
      }

      soc += battAction;
      if (battAction < 0) {
        peakFinal = Math.max(0, peak + battAction);
      } else if (isGridCharging) {
        peakFinal = peak + battAction;
      } else {
        peakFinal = peak;
      }

      if (isGridCharging && battAction > 0) {
        totalGridChargingKWh += battAction;
      }
    }

    monthlyPeaksBefore[month - 1] = Math.max(monthlyPeaksBefore[month - 1], peak);
    monthlyPeaksAfter[month - 1] = Math.max(monthlyPeaksAfter[month - 1], peakFinal);

    if (peak > maxPeakValue) {
      maxPeakValue = peak;
      maxPeakIndex = i;
    }
    peakAfter = Math.max(peakAfter, peakFinal);

    const discharge = battAction < 0 ? -battAction : 0;
    const charge = battAction > 0 ? battAction : 0;
    const selfCons = Math.min(consumption, production + discharge);
    totalSelfConsumption += selfCons;
    totalProductionKWh += production;

    const exported = Math.max(0, production - selfCons - charge);
    totalExportedKWh += exported;

    hourlyProfile.push({
      hour,
      month,
      consumption,
      production,
      peakBefore,
      peakAfter: peakFinal,
      batterySOC: soc,
    });
  }

  const peakWeekData: PeakWeekEntry[] = [];

  if (hourlyData.length > 0 && hourlyProfile.length > 0) {
    const startIdx = Math.max(0, maxPeakIndex - 40);
    const endIdx = Math.min(hourlyData.length, maxPeakIndex + 40);

    for (let i = startIdx; i < endIdx; i++) {
      if (hourlyData[i] && hourlyProfile[i]) {
        peakWeekData.push({
          timestamp: `Hour ${i}`,
          peakBefore: hourlyData[i].peak,
          peakAfter: hourlyProfile[i].peakAfter,
        });
      }
    }
  }

  const cappedSelfConsumption = Math.min(totalSelfConsumption, totalProductionKWh);

  return {
    totalSelfConsumption: cappedSelfConsumption,
    totalProductionKWh,
    totalExportedKWh,
    peakAfter,
    hourlyProfile,
    peakWeekData,
    clippingLossKWh,
    monthlyPeaksBefore,
    monthlyPeaksAfter,
    totalGridChargingKWh,
  };
}

export function calculateNPV(cashflows: number[], rate: number, years: number): number {
  let npv = 0;
  for (let y = 0; y <= Math.min(years, cashflows.length - 1); y++) {
    npv += cashflows[y] / Math.pow(1 + rate, y);
  }
  return npv;
}

// calculateIRR is now imported from cashflowCalculations.ts (single source of truth)
// Re-export for any external consumers:
export { calculateIRR, bisectionIRR };


export function runScenarioWithSizing(
  hourlyData: Array<{ hour: number; month: number; consumption: number; peak: number }>,
  pvSizeKW: number,
  battEnergyKWh: number,
  battPowerKW: number,
  peakKW: number,
  annualConsumptionKWh: number,
  assumptions: AnalysisAssumptions
): RunScenarioResult {
  const h = assumptions;

  // Use _yieldStrategy (set by resolveYieldStrategy) as SINGLE source of truth for yield
  // This eliminates redundant recalculation and ensures bifacial boost matches roof color analysis
  const storedStrategy = (h as any)._yieldStrategy as YieldStrategy | undefined;
  const effectiveYield = storedStrategy
    ? storedStrategy.effectiveYield
    : h.solarYieldKWhPerKWp || BASELINE_YIELD;

  const yieldFactor = effectiveYield / BASELINE_YIELD;
  // Intelligent demand shaving setpoint:
  // - Can't shave below PFM (puissance à facturer minimale) — HQ won't reduce billing below that
  // - Can't shave more than battery power rating allows
  // - Target: lowest achievable peak = max(peakKW - battPowerKW, PFM or 65% of peak as proxy)
  // The 0.90 hardcode was losing 73% of potential shaving value
  const pfmProxy = h.pfmKW || peakKW * 0.65; // Use actual PFM from DB, else 65% proxy
  const demandShavingSetpointKW = battPowerKW > 0
    ? Math.round(Math.max(peakKW - battPowerKW, pfmProxy))
    : peakKW;

  const skipTempCorrection = storedStrategy
    ? storedStrategy.skipTempCorrection
    : (h.yieldSource === 'google' || h.yieldSource === 'manual');
  const scenarioYieldSource: 'google' | 'manual' | 'default' = storedStrategy
    ? storedStrategy.yieldSource
    : ((h.yieldSource === 'google' || h.yieldSource === 'manual') ? h.yieldSource : 'default');
  const systemParams: SystemModelingParams = {
    inverterLoadRatio: h.inverterLoadRatio || 1.45,
    temperatureCoefficient: h.temperatureCoefficient || TEMPERATURE_COEFFICIENT,
    wireLossPercent: h.wireLossPercent ?? 0.03,
    skipTempCorrection,
    lidLossPercent: h.lidLossPercent ?? 0.01,
    mismatchLossPercent: h.mismatchLossPercent ?? 0.02,
    mismatchStringsLossPercent: h.mismatchStringsLossPercent ?? 0.0015,
    moduleQualityGainPercent: h.moduleQualityGainPercent ?? 0.0075,
  };

  let effectiveSnowProfile = h.snowLossProfile;
  if (scenarioYieldSource === 'google' && (!effectiveSnowProfile || effectiveSnowProfile === 'none')) {
    effectiveSnowProfile = 'ballasted_10deg';
  }

  const simResult = runHourlySimulation(hourlyData, pvSizeKW, battEnergyKWh, battPowerKW, demandShavingSetpointKW, yieldFactor, systemParams, scenarioYieldSource, effectiveSnowProfile);

  const byHourAgg = new Map<number, { consumptionSum: number; productionSum: number; peakBeforeSum: number; peakAfterSum: number; count: number }>();
  for (const entry of simResult.hourlyProfile) {
    const existing = byHourAgg.get(entry.hour) || { consumptionSum: 0, productionSum: 0, peakBeforeSum: 0, peakAfterSum: 0, count: 0 };
    existing.consumptionSum += entry.consumption;
    existing.productionSum += entry.production;
    existing.peakBeforeSum += entry.peakBefore;
    existing.peakAfterSum += entry.peakAfter;
    existing.count++;
    byHourAgg.set(entry.hour, existing);
  }
  const hourlyProfileSummary: Array<{ hour: string; consumptionBefore: number; consumptionAfter: number; peakBefore: number; peakAfter: number }> = [];
  for (let hIdx = 0; hIdx < 24; hIdx++) {
    const data = byHourAgg.get(hIdx);
    if (data && data.count > 0) {
      const avgConsumption = data.consumptionSum / data.count;
      const avgProduction = data.productionSum / data.count;
      const avgPeakBefore = data.peakBeforeSum / data.count;
      const consumptionAfter = avgConsumption - avgProduction;
      const peakAfterNet = Math.max(0, avgPeakBefore - avgProduction);
      hourlyProfileSummary.push({
        hour: `${hIdx}h`,
        consumptionBefore: Math.round(avgConsumption),
        consumptionAfter: Math.max(0, Math.round(consumptionAfter)),
        peakBefore: Math.round(avgPeakBefore),
        peakAfter: Math.round(peakAfterNet),
      });
    }
  }

  const selfConsumptionKWh = simResult.totalSelfConsumption;
  const peakAfterKW = simResult.peakAfter;
  const annualDemandReductionKW = peakKW - peakAfterKW;
  const annualExportedKWh = simResult.totalExportedKWh;

  // ── Financial calculations via shared module ──────────────────────────
  // All cashflow/incentive/NPV logic is in cashflowCalculations.ts (single source of truth)
  const financials = calculateCashflowMetrics({
    pvSizeKW,
    battEnergyKWh,
    battPowerKW,
    selfConsumptionKWh,
    totalExportedKWh: annualExportedKWh,
    totalProductionKWh: simResult.totalProductionKWh,
    gridChargingKWh: simResult.totalGridChargingKWh,
    annualConsumptionKWh,
    peakBeforeKW: peakKW,
    peakAfterKW,
    monthlyPeaksBefore: simResult.monthlyPeaksBefore,
    monthlyPeaksAfter: simResult.monthlyPeaksAfter,
    // Use totalProductionKWh for LCOE (simulationEngine mode — no effectiveYield override)
    assumptions: h,
  });

  // Map CashflowEntry[] → simplified {year, netCashflow}[] for RunScenarioResult
  const cashflows = financials.cashflows.map(c => ({ year: c.year, netCashflow: c.netCashflow }));

  return {
    ...financials,
    cashflows,
    totalProductionKWh: simResult.totalProductionKWh,
    totalExportedKWh: annualExportedKWh,
    peakAfterKW,
    selfConsumptionKWh,
    hourlyProfileSummary,
  };
}

export function runSensitivityAnalysis(
  hourlyData: Array<{ hour: number; month: number; consumption: number; peak: number }>,
  configuredPvSizeKW: number,
  configuredBattEnergyKWh: number,
  configuredBattPowerKW: number,
  peakKW: number,
  annualConsumptionKWh: number,
  assumptions: AnalysisAssumptions,
  configuredNpv25?: number
): SensitivityAnalysis {
  const frontier: FrontierPoint[] = [];
  const solarSweep: SolarSweepPoint[] = [];
  const batterySweep: BatterySweepPoint[] = [];

  if (configuredPvSizeKW > 0 || configuredBattEnergyKWh > 0) {
    const configResult = runScenarioWithSizing(
      hourlyData, configuredPvSizeKW, configuredBattEnergyKWh, configuredBattPowerKW,
      peakKW, annualConsumptionKWh, assumptions
    );

    const hasPV = configuredPvSizeKW > 0;
    const hasBatt = configuredBattEnergyKWh > 0;
    const configType = hasPV && hasBatt ? 'hybrid' : hasPV ? 'solar' : 'battery';
    const configLabel = hasPV && hasBatt
      ? `${configuredPvSizeKW}kW PV + ${configuredBattEnergyKWh}kWh (Current)`
      : hasPV
        ? `${configuredPvSizeKW}kW solar (Current)`
        : `${configuredBattEnergyKWh}kWh storage (Current)`;

    frontier.push({
      id: 'current-config',
      type: configType,
      label: configLabel,
      pvSizeKW: configuredPvSizeKW,
      battEnergyKWh: configuredBattEnergyKWh,
      battPowerKW: configuredBattPowerKW,
      capexNet: configResult.capexNet,
      npv25: configuredNpv25 !== undefined ? configuredNpv25 : configResult.npv25,
      isOptimal: false,
      irr25: configResult.irr25,
      simplePaybackYears: configResult.simplePaybackYears,
      selfSufficiencyPercent: configResult.selfSufficiencyPercent,
      annualSavings: configResult.annualSavings,
      totalProductionKWh: configResult.totalProductionKWh,
      co2AvoidedTonnesPerYear: configResult.co2AvoidedTonnesPerYear,
    });
  }

  const maxPVFromRoof = (assumptions as any).maxPVFromRoofKw !== undefined
    ? (assumptions as any).maxPVFromRoofKw
    : ((assumptions.roofAreaSqFt / 10.764) * assumptions.roofUtilizationRatio / 3.71) * 0.660;

  const solarSteps = 20;
  // HQ OSE 6.0: PV ≤ peak demand (puissance max appelée) AND ≤ roof capacity
  const effectivePvCap = Math.min(maxPVFromRoof, peakKW);
  const solarMax = Math.min(
    Math.max(configuredPvSizeKW * 1.5, effectivePvCap * 0.5),
    effectivePvCap
  );
  const solarStep = Math.max(5, Math.round(solarMax / solarSteps / 5) * 5);

  const solarSizes = new Set<number>();
  for (let pvSize = 0; pvSize <= solarMax; pvSize += solarStep) {
    solarSizes.add(pvSize);
  }
  if (configuredPvSizeKW > 0) {
    solarSizes.add(configuredPvSizeKW);
  }

  const sortedSolarSizes = Array.from(solarSizes).sort((a, b) => a - b);

  for (const pvSize of sortedSolarSizes) {
    const battPowerForScenario = Math.round(configuredBattEnergyKWh / 2);

    const result = runScenarioWithSizing(
      hourlyData, pvSize, configuredBattEnergyKWh, battPowerForScenario,
      peakKW, annualConsumptionKWh, assumptions
    );

    solarSweep.push({ pvSizeKW: pvSize, npv25: result.npv25 });

    if (pvSize > 0 && configuredBattEnergyKWh > 0 && pvSize !== configuredPvSizeKW) {
      frontier.push({
        id: `hybrid-pv${pvSize}`,
        type: 'hybrid',
        label: `${pvSize}kW PV + ${configuredBattEnergyKWh}kWh`,
        pvSizeKW: pvSize,
        battEnergyKWh: configuredBattEnergyKWh,
        battPowerKW: battPowerForScenario,
        capexNet: result.capexNet,
        npv25: result.npv25,
        isOptimal: false,
        sweepSource: 'pvSweep',
        irr25: result.irr25,
        simplePaybackYears: result.simplePaybackYears,
        selfSufficiencyPercent: result.selfSufficiencyPercent,
        annualSavings: result.annualSavings,
        totalProductionKWh: result.totalProductionKWh,
        co2AvoidedTonnesPerYear: result.co2AvoidedTonnesPerYear,
      });
    }
  }

  const batterySteps = 20;
  const batteryMax = Math.max(configuredBattEnergyKWh * 2, 500);
  const batteryStep = Math.max(10, Math.round(batteryMax / batterySteps / 10) * 10);

  const batterySizes = new Set<number>();
  for (let battSize = 0; battSize <= batteryMax; battSize += batteryStep) {
    batterySizes.add(battSize);
  }
  if (configuredBattEnergyKWh > 0) {
    batterySizes.add(configuredBattEnergyKWh);
  }

  const sortedBatterySizes = Array.from(batterySizes).sort((a, b) => a - b);

  for (const battSize of sortedBatterySizes) {
    const battPower = Math.round(battSize / 2);

    const result = runScenarioWithSizing(
      hourlyData, configuredPvSizeKW, battSize, battPower,
      peakKW, annualConsumptionKWh, assumptions
    );
    batterySweep.push({ battEnergyKWh: battSize, npv25: result.npv25 });
  }

  for (let battSize = batteryStep; battSize <= batteryMax; battSize += batteryStep) {
    if (configuredPvSizeKW > 0 && battSize !== configuredBattEnergyKWh) {
      const battPower = Math.round(battSize / 2);
      const result = runScenarioWithSizing(
        hourlyData, configuredPvSizeKW, battSize, battPower,
        peakKW, annualConsumptionKWh, assumptions
      );
      frontier.push({
        id: `hybrid-batt${battSize}`,
        type: 'hybrid',
        label: `${configuredPvSizeKW}kW PV + ${battSize}kWh`,
        pvSizeKW: configuredPvSizeKW,
        battEnergyKWh: battSize,
        battPowerKW: battPower,
        capexNet: result.capexNet,
        npv25: result.npv25,
        isOptimal: false,
        sweepSource: 'battSweep',
        irr25: result.irr25,
        simplePaybackYears: result.simplePaybackYears,
        selfSufficiencyPercent: result.selfSufficiencyPercent,
        annualSavings: result.annualSavings,
        totalProductionKWh: result.totalProductionKWh,
        co2AvoidedTonnesPerYear: result.co2AvoidedTonnesPerYear,
      });
    }
  }

  for (let pvSize = solarStep; pvSize <= solarMax; pvSize += solarStep) {
    if (configuredBattEnergyKWh > 0 || pvSize !== configuredPvSizeKW) {
      const result = runScenarioWithSizing(
        hourlyData, pvSize, 0, 0,
        peakKW, annualConsumptionKWh, assumptions
      );
      frontier.push({
        id: `solar-${pvSize}`,
        type: 'solar',
        label: `${pvSize}kW solar only`,
        pvSizeKW: pvSize,
        battEnergyKWh: 0,
        battPowerKW: 0,
        capexNet: result.capexNet,
        npv25: result.npv25,
        isOptimal: false,
        irr25: result.irr25,
        simplePaybackYears: result.simplePaybackYears,
        selfSufficiencyPercent: result.selfSufficiencyPercent,
        annualSavings: result.annualSavings,
        totalProductionKWh: result.totalProductionKWh,
        co2AvoidedTonnesPerYear: result.co2AvoidedTonnesPerYear,
      });
    }
  }

  for (let battSize = batteryStep; battSize <= batteryMax; battSize += batteryStep * 2) {
    if (configuredPvSizeKW > 0 || battSize !== configuredBattEnergyKWh) {
      const battPower = Math.round(battSize / 2);
      const result = runScenarioWithSizing(
        hourlyData, 0, battSize, battPower,
        peakKW, annualConsumptionKWh, assumptions
      );
      frontier.push({
        id: `battery-${battSize}`,
        type: 'battery',
        label: `${battSize}kWh storage only`,
        pvSizeKW: 0,
        battEnergyKWh: battSize,
        battPowerKW: battPower,
        capexNet: result.capexNet,
        npv25: result.npv25,
        isOptimal: false,
        irr25: result.irr25,
        simplePaybackYears: result.simplePaybackYears,
        selfSufficiencyPercent: result.selfSufficiencyPercent,
        annualSavings: result.annualSavings,
        totalProductionKWh: result.totalProductionKWh,
        co2AvoidedTonnesPerYear: result.co2AvoidedTonnesPerYear,
      });
    }
  }

  const hybridPvSteps = 5;
  const hybridBattSteps = 5;
  const hybridPvStep = Math.max(10, Math.round(solarMax / hybridPvSteps / 10) * 10);
  const hybridBattMax = Math.max(peakKW * 2, configuredBattEnergyKWh * 2, 200);
  const hybridBattStep = Math.max(20, Math.round(hybridBattMax / hybridBattSteps / 20) * 20);
  const existingFrontierKeys = new Set(frontier.map(p => `${p.pvSizeKW}-${p.battEnergyKWh}`));

  for (let pv = hybridPvStep; pv <= solarMax; pv += hybridPvStep) {
    for (let batt = hybridBattStep; batt <= hybridBattMax; batt += hybridBattStep) {
      const key = `${pv}-${batt}`;
      if (existingFrontierKeys.has(key)) continue;
      existingFrontierKeys.add(key);

      const battPower = Math.round(batt / 2);
      const result = runScenarioWithSizing(
        hourlyData, pv, batt, battPower,
        peakKW, annualConsumptionKWh, assumptions
      );

      if (result.npv25 > 0) {
        frontier.push({
          id: `hybrid-grid-pv${pv}-batt${batt}`,
          type: 'hybrid',
          label: `${pv}kW PV + ${batt}kWh`,
          pvSizeKW: pv,
          battEnergyKWh: batt,
          battPowerKW: battPower,
          capexNet: result.capexNet,
          npv25: result.npv25,
          isOptimal: false,
          sweepSource: 'hybridGrid',
          irr25: result.irr25,
          simplePaybackYears: result.simplePaybackYears,
          selfSufficiencyPercent: result.selfSufficiencyPercent,
          annualSavings: result.annualSavings,
          totalProductionKWh: result.totalProductionKWh,
          co2AvoidedTonnesPerYear: result.co2AvoidedTonnesPerYear,
        });
      }
    }
  }

  if (maxPVFromRoof > effectivePvCap * 1.1) {
    console.log(`[SimEngine] Independence sweep: maxPVFromRoof=${maxPVFromRoof.toFixed(0)}kW, effectivePvCap=${effectivePvCap.toFixed(0)}kW, peakKW=${peakKW.toFixed(0)}kW`);
    const indepSteps = 6;
    const indepStart = effectivePvCap;
    const indepEnd = maxPVFromRoof;
    const indepStep = Math.max(10, Math.round((indepEnd - indepStart) / indepSteps / 10) * 10);

    for (let pv = Math.round(indepStart); pv <= indepEnd; pv += indepStep) {
      const pvRounded = Math.round(pv);
      const configs: Array<{ batt: number; battPower: number }> = [
        { batt: 0, battPower: 0 },
      ];
      if (configuredBattEnergyKWh > 0) {
        configs.push({ batt: configuredBattEnergyKWh, battPower: Math.round(configuredBattEnergyKWh / 2) });
      }

      for (const cfg of configs) {
        const key = `${pvRounded}-${cfg.batt}`;
        if (existingFrontierKeys.has(key)) continue;
        existingFrontierKeys.add(key);

        const result = runScenarioWithSizing(
          hourlyData, pvRounded, cfg.batt, cfg.battPower,
          peakKW, annualConsumptionKWh, assumptions
        );

        const hasBatt = cfg.batt > 0;
        frontier.push({
          id: hasBatt ? `indep-hybrid-pv${pvRounded}-batt${cfg.batt}` : `indep-solar-${pvRounded}`,
          type: hasBatt ? 'hybrid' : 'solar',
          label: hasBatt ? `${pvRounded}kW PV + ${cfg.batt}kWh` : `${pvRounded}kW solar only`,
          pvSizeKW: pvRounded,
          battEnergyKWh: cfg.batt,
          battPowerKW: cfg.battPower,
          capexNet: result.capexNet,
          npv25: result.npv25,
          isOptimal: false,
          sweepSource: 'independenceSweep' as any,
          irr25: result.irr25,
          simplePaybackYears: result.simplePaybackYears,
          selfSufficiencyPercent: result.selfSufficiencyPercent,
          annualSavings: result.annualSavings,
          totalProductionKWh: result.totalProductionKWh,
          co2AvoidedTonnesPerYear: result.co2AvoidedTonnesPerYear,
        });
      }
    }

    const roofCapKey = `${Math.round(maxPVFromRoof)}-${configuredBattEnergyKWh}`;
    if (!existingFrontierKeys.has(roofCapKey)) {
      const battPower = Math.round(configuredBattEnergyKWh / 2);
      const result = runScenarioWithSizing(
        hourlyData, Math.round(maxPVFromRoof), configuredBattEnergyKWh, battPower,
        peakKW, annualConsumptionKWh, assumptions
      );
      frontier.push({
        id: `indep-max-roof`,
        type: configuredBattEnergyKWh > 0 ? 'hybrid' : 'solar',
        label: configuredBattEnergyKWh > 0
          ? `${Math.round(maxPVFromRoof)}kW PV + ${configuredBattEnergyKWh}kWh`
          : `${Math.round(maxPVFromRoof)}kW solar only`,
        pvSizeKW: Math.round(maxPVFromRoof),
        battEnergyKWh: configuredBattEnergyKWh,
        battPowerKW: battPower,
        capexNet: result.capexNet,
        npv25: result.npv25,
        isOptimal: false,
        sweepSource: 'independenceSweep' as any,
        irr25: result.irr25,
        simplePaybackYears: result.simplePaybackYears,
        selfSufficiencyPercent: result.selfSufficiencyPercent,
        annualSavings: result.annualSavings,
        totalProductionKWh: result.totalProductionKWh,
        co2AvoidedTonnesPerYear: result.co2AvoidedTonnesPerYear,
      });
    }
  }

  for (const point of frontier) {
    const hasPV = point.pvSizeKW > 0;
    const hasBatt = point.battEnergyKWh > 0;
    const correctType = hasPV && hasBatt ? 'hybrid' : hasPV ? 'solar' : 'battery';

    if (point.type !== correctType) {
      console.log(`[SimEngine] Frontier point ${point.id} type mismatch: was '${point.type}', corrected to '${correctType}'`);
      point.type = correctType;

      if (correctType === 'hybrid') {
        point.label = `${point.pvSizeKW}kW PV + ${point.battEnergyKWh}kWh`;
      } else if (correctType === 'solar') {
        point.label = `${point.pvSizeKW}kW solar only`;
      } else {
        point.label = `${point.battEnergyKWh}kWh storage only`;
      }
    }
  }

  let optimalId: string | null = null;
  let maxNpv = -Infinity;
  for (const point of frontier) {
    if (point.npv25 > maxNpv) {
      maxNpv = point.npv25;
      optimalId = point.id;
    }
  }

  for (const point of frontier) {
    point.isOptimal = point.id === optimalId;
  }

  let maxSolarNpv = -Infinity;
  for (const point of solarSweep) {
    if (point.npv25 > maxSolarNpv) {
      maxSolarNpv = point.npv25;
    }
  }
  for (const point of solarSweep) {
    point.isOptimal = point.npv25 === maxSolarNpv;
  }

  let maxBattNpv = -Infinity;
  for (const point of batterySweep) {
    if (point.npv25 > maxBattNpv) {
      maxBattNpv = point.npv25;
    }
  }
  for (const point of batterySweep) {
    point.isOptimal = point.npv25 === maxBattNpv;
  }

  const toOptimalScenarioWithBreakdown = (point: FrontierPoint): OptimalScenario => {
    const result = runScenarioWithSizing(
      hourlyData, point.pvSizeKW, point.battEnergyKWh, point.battPowerKW,
      peakKW, annualConsumptionKWh, assumptions
    );

    return {
      id: point.id,
      pvSizeKW: point.pvSizeKW,
      battEnergyKWh: point.battEnergyKWh,
      battPowerKW: point.battPowerKW,
      capexNet: result.capexNet,
      npv25: result.npv25,
      irr25: result.irr25 || 0,
      simplePaybackYears: result.simplePaybackYears || 0,
      selfSufficiencyPercent: result.selfSufficiencyPercent || 0,
      annualSavings: result.annualSavings || 0,
      totalProductionKWh: result.totalProductionKWh || 0,
      co2AvoidedTonnesPerYear: result.co2AvoidedTonnesPerYear || 0,
      scenarioBreakdown: {
        capexSolar: result.capexSolar,
        capexBattery: result.capexBattery,
        capexGross: result.capexGross,
        actualHQSolar: result.incentivesHQSolar,
        actualHQBattery: result.incentivesHQBattery,
        itcAmount: result.incentivesFederal,
        taxShield: result.taxShield,
        totalExportedKWh: result.totalExportedKWh,
        annualSurplusRevenue: result.annualSurplusRevenue,
        estimatedAnnualBillBefore: result.annualCostBefore,
        estimatedAnnualBillAfter: result.annualCostAfter,
        lcoe: result.lcoe,
        peakDemandAfterKW: result.peakAfterKW,
        annualEnergySavingsKWh: result.selfConsumptionKWh,
        cashflows: result.cashflows,
        hourlyProfileSummary: result.hourlyProfileSummary,
      },
    };
  };

  const profitablePoints = frontier.filter(p => p.npv25 > 0);
  const allValidPoints = frontier.filter(p => p.pvSizeKW > 0 || p.battEnergyKWh > 0);

  const bestNPVPoint = frontier.find(p => p.id === optimalId);

  let bestIRRPoint: FrontierPoint | null = null;
  let maxIRR = -Infinity;
  for (const point of profitablePoints) {
    const irr = point.irr25 || 0;
    if (irr > maxIRR && !isNaN(irr) && isFinite(irr)) {
      maxIRR = irr;
      bestIRRPoint = point;
    }
  }

  let maxSelfSuffPoint: FrontierPoint | null = null;
  let maxSelfSuff = -Infinity;
  for (const point of allValidPoints) {
    const selfSuff = point.selfSufficiencyPercent || 0;
    if (selfSuff > maxSelfSuff) {
      maxSelfSuff = selfSuff;
      maxSelfSuffPoint = point;
    }
  }

  // Best Payback - minimum payback years among profitable scenarios
  let bestPaybackPoint: FrontierPoint | null = null;
  let minPayback = Infinity;
  for (const point of profitablePoints) {
    const payback = point.simplePaybackYears || 0;
    if (payback > 0 && payback < minPayback && !isNaN(payback) && isFinite(payback)) {
      minPayback = payback;
      bestPaybackPoint = point;
    }
  }

  const optimalScenarios: OptimalScenarios = {
    bestNPV: bestNPVPoint ? toOptimalScenarioWithBreakdown(bestNPVPoint) : null,
    bestIRR: bestIRRPoint ? toOptimalScenarioWithBreakdown(bestIRRPoint) : null,
    maxSelfSufficiency: maxSelfSuffPoint ? toOptimalScenarioWithBreakdown(maxSelfSuffPoint) : null,
    bestPayback: bestPaybackPoint ? toOptimalScenarioWithBreakdown(bestPaybackPoint) : null,
  };

  return {
    frontier,
    solarSweep,
    batterySweep,
    optimalScenarioId: optimalId,
    optimalScenarios,
  };
}
