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
  systemParams: SystemModelingParams = { inverterLoadRatio: 1.45, temperatureCoefficient: -0.004, wireLossPercent: 0.03, skipTempCorrection: false, lidLossPercent: 0.01, mismatchLossPercent: 0.02, mismatchStringsLossPercent: 0.0015, moduleQualityGainPercent: 0.0075 },
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

  const dailyPeakHours = new Map<string, { index: number; peak: number; hour: number }>();

  for (let i = 0; i < hourlyData.length; i++) {
    const { hour, month, peak } = hourlyData[i];
    const dayIndex = Math.floor(i / 24);
    const dayKey = `${month}-${dayIndex}`;

    const existing = dailyPeakHours.get(dayKey);
    if (!existing || peak > existing.peak) {
      dailyPeakHours.set(dayKey, { index: i, peak, hour });
    }
  }

  const priorityPeakIndices = new Set<number>();
  dailyPeakHours.forEach((dayPeak) => {
    if (dayPeak.peak > threshold) {
      priorityPeakIndices.add(dayPeak.index);
    }
  });

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
      const isPriorityPeak = priorityPeakIndices.has(i);

      let higherPeakComing = false;
      if (!isPriorityPeak && peak > threshold) {
        for (let lookahead = 1; lookahead <= 6 && i + lookahead < hourlyData.length; lookahead++) {
          if (hourlyData[i + lookahead].peak > peak) {
            higherPeakComing = true;
            break;
          }
        }
      }

      const shouldDischarge = peak > threshold && soc > 0 && (isPriorityPeak || !higherPeakComing);

      if (shouldDischarge) {
        const maxDischarge = isPriorityPeak
          ? Math.min(peak - threshold, battPowerKW, soc)
          : Math.min(peak - threshold, battPowerKW, soc * 0.5);
        battAction = -maxDischarge;
      } else if (net < 0 && soc < battEnergyKWh) {
        battAction = Math.min(Math.abs(net), battPowerKW, battEnergyKWh - soc);
      } else if (hour >= 22 && soc < battEnergyKWh) {
        battAction = Math.min(battPowerKW, battEnergyKWh - soc);
        isGridCharging = true;
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

export function calculateIRR(cashflows: number[]): number {
  if (cashflows.length < 2) return 0;

  let hasNegative = false;
  let hasPositive = false;
  for (const cf of cashflows) {
    if (cf < 0) hasNegative = true;
    if (cf > 0) hasPositive = true;
  }

  if (!hasNegative || !hasPositive) {
    return hasPositive ? 1.0 : 0;
  }

  let irr = 0.1;
  const maxIterations = 200;
  const tolerance = 0.0001;

  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let dnpv = 0;

    for (let t = 0; t < cashflows.length; t++) {
      const denominator = Math.pow(1 + irr, t);
      if (denominator === 0 || !isFinite(denominator)) continue;

      const pv = cashflows[t] / denominator;
      npv += pv;
      if (t > 0) {
        dnpv -= t * cashflows[t] / Math.pow(1 + irr, t + 1);
      }
    }

    if (Math.abs(dnpv) < 1e-10) {
      return bisectionIRR(cashflows);
    }

    const newIrr = irr - npv / dnpv;

    if (!isFinite(newIrr)) {
      return bisectionIRR(cashflows);
    }

    const clampedIrr = Math.max(-0.99, Math.min(5, newIrr));

    if (Math.abs(clampedIrr - irr) < tolerance) {
      return Math.max(0, Math.min(1, clampedIrr));
    }

    irr = clampedIrr;
  }

  return bisectionIRR(cashflows);
}

export function bisectionIRR(cashflows: number[]): number {
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
      return Math.max(0, Math.min(1, mid));
    }

    if (npvLow * npvMid < 0) {
      high = mid;
      npvHigh = npvMid;
    } else {
      low = mid;
      npvLow = npvMid;
    }
  }

  return Math.max(0, Math.min(1, (low + high) / 2));
}

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
  const demandShavingSetpointKW = battPowerKW > 0 ? Math.round(peakKW * 0.90) : peakKW;

  const skipTempCorrection = storedStrategy
    ? storedStrategy.skipTempCorrection
    : (h.yieldSource === 'google' || h.yieldSource === 'manual');
  const scenarioYieldSource: 'google' | 'manual' | 'default' = storedStrategy
    ? storedStrategy.yieldSource
    : ((h.yieldSource === 'google' || h.yieldSource === 'manual') ? h.yieldSource : 'default');
  const systemParams: SystemModelingParams = {
    inverterLoadRatio: h.inverterLoadRatio || 1.45,
    temperatureCoefficient: h.temperatureCoefficient || -0.004,
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

  let annualDemandCostBefore = 0;
  let demandSavings = 0;
  for (let m = 0; m < 12; m++) {
    annualDemandCostBefore += simResult.monthlyPeaksBefore[m] * h.tariffPower;
    demandSavings += Math.max(0, simResult.monthlyPeaksBefore[m] - simResult.monthlyPeaksAfter[m]) * h.tariffPower;
  }
  const annualCostBefore = annualConsumptionKWh * h.tariffEnergy + annualDemandCostBefore;
  const energySavings = selfConsumptionKWh * h.tariffEnergy;
  const gridChargingCost = simResult.totalGridChargingKWh * h.tariffEnergy;
  const annualSavings = (energySavings - gridChargingCost) + demandSavings;

  const scenarioHqSurplusRate = h.hqSurplusCompensationRate ?? 0.0454;
  const annualSurplusRevenue = annualExportedKWh * scenarioHqSurplusRate;

  const baseSolarCostPerW = h.solarCostPerW ?? getTieredSolarCostPerW(pvSizeKW);
  const effectiveSolarCostPerW = h.bifacialEnabled
    ? baseSolarCostPerW + (h.bifacialCostPremium || 0.10)
    : baseSolarCostPerW;
  const capexPV = pvSizeKW * 1000 * effectiveSolarCostPerW;
  const capexBattery = battEnergyKWh * h.batteryCapacityCost + battPowerKW * h.batteryPowerCost;
  const capexGross = capexPV + capexBattery;

  if (capexGross === 0) {
    return {
      npv25: 0, npv10: 0, npv20: 0, npv30: 0,
      capexNet: 0,
      irr25: 0, irr10: 0, irr20: 0, irr30: 0,
      lcoe: 0, lcoe30: 0,
      incentivesHQ: 0, incentivesHQSolar: 0, incentivesHQBattery: 0,
      incentivesFederal: 0, taxShield: 0,
      cashflows: [],
      annualSavings: 0,
      simplePaybackYears: 0,
      totalProductionKWh: 0,
      selfSufficiencyPercent: 0,
      co2AvoidedTonnesPerYear: 0,
      capexSolar: 0,
      capexBattery: 0,
      capexGross: 0,
      totalExportedKWh: 0,
      annualSurplusRevenue: 0,
      annualCostBefore: 0,
      annualCostAfter: 0,
      peakAfterKW: 0,
      selfConsumptionKWh: 0,
      hourlyProfileSummary: [],
    };
  }

  const eligibleSolarKW = Math.min(pvSizeKW, 1000);
  const potentialHQSolar = eligibleSolarKW * 1000;
  const potentialHQBattery = 0;
  const cap40Percent = capexGross * 0.40;

  let incentivesHQSolar = Math.min(potentialHQSolar, cap40Percent);

  let incentivesHQBattery = 0;
  if (pvSizeKW > 0 && battEnergyKWh > 0) {
    const remainingCap = Math.max(0, cap40Percent - incentivesHQSolar);
    incentivesHQBattery = Math.min(remainingCap, capexBattery);
  }

  const incentivesHQ = incentivesHQSolar + incentivesHQBattery;

  const itcBasis = capexGross - incentivesHQ;
  const incentivesFederal = itcBasis * 0.30;

  const capexNetAccounting = Math.max(0, capexGross - incentivesHQ - incentivesFederal);
  const taxShield = capexNetAccounting * h.taxRate * 0.90;

  const totalIncentives = incentivesHQ + incentivesFederal + taxShield;
  const capexNet = capexGross - totalIncentives;

  const batterySubY0 = incentivesHQBattery * 0.5;
  const equityInitial = capexGross - incentivesHQSolar - batterySubY0;
  const opexBase = (capexPV * h.omSolarPercent) + (capexBattery * h.omBatteryPercent);

  const cashflowValues: number[] = [-equityInitial];
  const degradationRate = h.degradationRatePercent || 0.004;
  const MAX_SCENARIO_YEARS = 30;

  for (let y = 1; y <= MAX_SCENARIO_YEARS; y++) {
    const degradationFactor = Math.pow(1 - degradationRate, y - 1);
    const savingsRevenue = annualSavings * degradationFactor * Math.pow(1 + h.inflationRate, y - 1);

    const surplusRevenue = y >= 3
      ? annualSurplusRevenue * degradationFactor * Math.pow(1 + h.inflationRate, y - 1)
      : 0;

    const revenue = savingsRevenue + surplusRevenue;
    const opex = opexBase * Math.pow(1 + h.omEscalation, y - 1);
    const ebitda = revenue - opex;

    let investment = 0;
    let dpa = 0;
    let incentives = 0;

    if (y === 1) {
      dpa = taxShield;
      incentives = incentivesHQBattery * 0.5;
    }
    if (y === 2) {
      incentives = incentivesFederal;
    }

    const replacementYear = h.batteryReplacementYear || 10;
    const replacementFactor = h.batteryReplacementCostFactor || 0.60;
    const priceDecline = h.batteryPriceDeclineRate || 0.05;

    if (y === replacementYear && battEnergyKWh > 0) {
      const netPriceChange = Math.pow(1 + h.inflationRate - priceDecline, y);
      investment = -capexBattery * replacementFactor * netPriceChange;
    }
    if (y === 20 && battEnergyKWh > 0) {
      const netPriceChange = Math.pow(1 + h.inflationRate - priceDecline, y);
      investment = -capexBattery * replacementFactor * netPriceChange;
    }
    if (y === 30 && battEnergyKWh > 0) {
      const netPriceChange = Math.pow(1 + h.inflationRate - priceDecline, y);
      investment = -capexBattery * replacementFactor * netPriceChange;
    }

    cashflowValues.push(ebitda + investment + dpa + incentives);
  }

  const npv25 = calculateNPV(cashflowValues, h.discountRate, 25);
  const npv20 = calculateNPV(cashflowValues, h.discountRate, 20);
  const npv10 = calculateNPV(cashflowValues, h.discountRate, 10);
  const npv30 = calculateNPV(cashflowValues, h.discountRate, 30);
  const irr25 = calculateIRR(cashflowValues.slice(0, 26));
  const irr20 = calculateIRR(cashflowValues.slice(0, 21));
  const irr10 = calculateIRR(cashflowValues.slice(0, 11));
  const irr30 = calculateIRR(cashflowValues.slice(0, 31));

  const baseYearProduction = simResult.totalProductionKWh;
  let totalProduction25Scenario = 0;
  let totalProduction30Scenario = 0;
  for (let y = 1; y <= 30; y++) {
    const degFactor = Math.pow(1 - degradationRate, y - 1);
    const yearProd = baseYearProduction * degFactor;
    if (y <= 25) totalProduction25Scenario += yearProd;
    totalProduction30Scenario += yearProd;
  }
  const totalLifetimeCost25 = capexNet + (opexBase * 25);
  const totalLifetimeCost30 = capexNet + (opexBase * 30);
  const lcoe = totalProduction25Scenario > 0 ? totalLifetimeCost25 / totalProduction25Scenario : 0;
  const lcoe30 = totalProduction30Scenario > 0 ? totalLifetimeCost30 / totalProduction30Scenario : 0;

  const cashflows = cashflowValues.map((netCashflow, index) => ({ year: index, netCashflow }));

  const totalProductionKWh = simResult.totalProductionKWh;
  const selfSufficiencyPercent = annualConsumptionKWh > 0
    ? (selfConsumptionKWh / annualConsumptionKWh) * 100
    : 0;

  let simplePaybackYears = MAX_SCENARIO_YEARS;
  let cumCheck = cashflowValues[0];
  for (let i = 1; i < Math.min(cashflowValues.length, 26); i++) {
    cumCheck += cashflowValues[i];
    if (cumCheck >= 0) {
      simplePaybackYears = i;
      break;
    }
  }

  const co2AvoidedTonnesPerYear = (selfConsumptionKWh * 0.002) / 1000;

  const annualCostAfter = annualCostBefore - annualSavings;

  return {
    npv25, npv10, npv20, npv30,
    capexNet,
    irr25, irr10, irr20, irr30,
    lcoe, lcoe30,
    incentivesHQ, incentivesHQSolar, incentivesHQBattery,
    incentivesFederal, taxShield,
    cashflows,
    annualSavings,
    simplePaybackYears,
    totalProductionKWh,
    selfSufficiencyPercent,
    co2AvoidedTonnesPerYear,
    capexSolar: capexPV,
    capexBattery,
    capexGross,
    totalExportedKWh: annualExportedKWh,
    annualSurplusRevenue,
    annualCostBefore,
    annualCostAfter,
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
  const solarMax = Math.min(
    Math.max(configuredPvSizeKW * 1.5, maxPVFromRoof * 0.5),
    maxPVFromRoof
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

  const optimalScenarios: OptimalScenarios = {
    bestNPV: bestNPVPoint ? toOptimalScenarioWithBreakdown(bestNPVPoint) : null,
    bestIRR: bestIRRPoint ? toOptimalScenarioWithBreakdown(bestIRRPoint) : null,
    maxSelfSufficiency: maxSelfSuffPoint ? toOptimalScenarioWithBreakdown(maxSelfSuffPoint) : null,
  };

  return {
    frontier,
    solarSweep,
    batterySweep,
    optimalScenarioId: optimalId,
    optimalScenarios,
  };
}
