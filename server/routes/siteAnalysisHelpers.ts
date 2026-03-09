import fs from "fs";
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
  type CashflowEntry,
  type FinancialBreakdown,
} from "@shared/schema";
import {
  resolveYieldStrategy as resolveYieldStrategyFromAnalysis,
  getTieredSolarCostPerW,
  type YieldStrategy,
  type SystemModelingParams,
  QUEBEC_MONTHLY_TEMPS,
  BASELINE_YIELD,
} from "../analysis/potentialAnalysis";
import {
  runHourlySimulation,
  runScenarioWithSizing,
  runSensitivityAnalysis,
  calculateNPV,
  calculateIRR,
  SNOW_LOSS_FLAT_ROOF,
} from "../analysis/simulationEngine";
import { calculateCashflowMetrics } from "../analysis/cashflowCalculations";

export { resolveYieldStrategyFromAnalysis as resolveYieldStrategy };
export { getTieredSolarCostPerW };
export type { YieldStrategy, SystemModelingParams };

export function getDefaultAnalysisAssumptions(): AnalysisAssumptions {
  return { ...defaultAnalysisAssumptions };
}

export function deduplicateMeterReadingsByHour(
  rawReadings: Array<{ 
    kWh: number | null; 
    kW: number | null; 
    timestamp: Date;
    granularity?: string;
  }>
): { 
  readings: Array<{ kWh: number | null; kW: number | null; timestamp: Date }>;
  dataSpanDays: number;
} {
  if (rawReadings.length === 0) {
    return { readings: [], dataSpanDays: 365 };
  }
  
  let minTs = new Date(rawReadings[0].timestamp).getTime();
  let maxTs = minTs;
  for (const r of rawReadings) {
    const ts = new Date(r.timestamp).getTime();
    if (ts < minTs) minTs = ts;
    if (ts > maxTs) maxTs = ts;
  }
  const dataSpanDays = Math.max(1, (maxTs - minTs) / (1000 * 60 * 60 * 24));
  
  const hourBuckets = new Map<string, Array<typeof rawReadings[0]>>();
  
  for (const reading of rawReadings) {
    const ts = new Date(reading.timestamp);
    const bucketKey = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}-${String(ts.getDate()).padStart(2, '0')}-${String(ts.getHours()).padStart(2, '0')}`;
    
    const bucket = hourBuckets.get(bucketKey) || [];
    bucket.push(reading);
    hourBuckets.set(bucketKey, bucket);
  }
  
  const deduplicatedReadings: Array<{ kWh: number | null; kW: number | null; timestamp: Date }> = [];
  
  for (const [bucketKey, readings] of hourBuckets) {
    const hourlyReadings = readings.filter(r => r.granularity === 'HOUR');
    const nonHourlyReadings = readings.filter(r => r.granularity !== 'HOUR');
    
    const parts = bucketKey.split('-');
    const hourTimestamp = new Date(
      parseInt(parts[0]), 
      parseInt(parts[1]) - 1, 
      parseInt(parts[2]), 
      parseInt(parts[3]), 
      0, 0, 0
    );
    
    if (hourlyReadings.length > 0) {
      const bestHourly = hourlyReadings.find(r => r.kWh !== null) || hourlyReadings[0];
      
      let maxKW = bestHourly.kW || 0;
      for (const r of nonHourlyReadings) {
        if (r.kW !== null && r.kW > maxKW) {
          maxKW = r.kW;
        }
      }
      
      deduplicatedReadings.push({
        timestamp: hourTimestamp,
        kWh: bestHourly.kWh,
        kW: maxKW > 0 ? maxKW : bestHourly.kW,
      });
    } else {
      let totalKWh = 0;
      let maxKW = 0;
      let hasKWh = false;
      
      for (const r of readings) {
        if (r.kWh !== null) {
          totalKWh += r.kWh;
          hasKWh = true;
        }
        if (r.kW !== null && r.kW > maxKW) {
          maxKW = r.kW;
        }
      }
      
      deduplicatedReadings.push({
        timestamp: hourTimestamp,
        kWh: hasKWh ? totalKWh : null,
        kW: maxKW > 0 ? maxKW : null,
      });
    }
  }
  
  deduplicatedReadings.sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  return { readings: deduplicatedReadings, dataSpanDays };
}

export async function parseHydroQuebecCSV(
  filePath: string, 
  meterFileId: string, 
  granularity: string
): Promise<Array<{
  meterFileId: string;
  timestamp: Date;
  granularity: string;
  kWh: number | null;
  kW: number | null;
}>> {
  const buffer = fs.readFileSync(filePath);
  let content: string;
  
  try {
    content = buffer.toString("latin1");
  } catch {
    content = buffer.toString("utf-8");
  }
  
  const lines = content.split(/\r?\n/).filter(line => {
    const trimmed = line.trim();
    return trimmed.length > 0 && trimmed !== ";";
  });
  
  const readings: Array<{
    meterFileId: string;
    timestamp: Date;
    granularity: string;
    kWh: number | null;
    kW: number | null;
  }> = [];

  if (lines.length < 2) return readings;

  const headerLine = lines[0];
  const delimiter = headerLine.includes(";") ? ";" : ",";
  
  const normalizeForMatch = (str: string): string => {
    return str.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };
  
  const headers = headerLine.split(delimiter).map(h => normalizeForMatch(h));
  
  const isHydroQuebecFormat = headers.some(h => 
    h.includes("contrat") || h.includes("date et heure")
  );
  
  let dateColIndex = -1;
  let valueColIndex = -1;
  let detectedDataType: "kWh" | "kW" = granularity === "HOUR" ? "kWh" : "kW";
  
  if (isHydroQuebecFormat) {
    dateColIndex = headers.findIndex(h => h.includes("date"));
    
    const kwhIndex = headers.findIndex(h => /kwh/i.test(h));
    
    const kwIndex = headers.findIndex(h => 
      h.includes("puissance") || /\(kw\)/i.test(h) || /kw\)/i.test(h)
    );
    
    if (kwhIndex !== -1) {
      valueColIndex = kwhIndex;
      detectedDataType = "kWh";
    } else if (kwIndex !== -1) {
      valueColIndex = kwIndex;
      detectedDataType = "kW";
    }
    
    if (dateColIndex === -1) dateColIndex = 1;
    if (valueColIndex === -1) valueColIndex = 2;
  } else {
    dateColIndex = 0;
    valueColIndex = 1;
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line === delimiter) continue;
    
    const parts = line.split(delimiter);
    
    if (parts.length <= Math.max(dateColIndex, valueColIndex)) continue;
    
    try {
      const dateStr = parts[dateColIndex]?.trim().replace(/"/g, "");
      if (!dateStr) continue;
      
      const timestamp = new Date(dateStr);
      if (isNaN(timestamp.getTime())) continue;
      
      let valueStr = parts[valueColIndex]?.trim().replace(/"/g, "") || "";
      if (!valueStr) continue;
      
      valueStr = valueStr.replace(/\s/g, "").replace(",", ".");
      
      const value = parseFloat(valueStr);
      if (isNaN(value)) continue;
      
      readings.push({
        meterFileId,
        timestamp,
        granularity,
        kWh: detectedDataType === "kWh" ? value : null,
        kW: detectedDataType === "kW" ? value : null,
      });
    } catch (e) {
      continue;
    }
  }

  readings.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return readings;
}

// CashflowEntry and FinancialBreakdown now imported from @shared/schema
// via cashflowCalculations module (single source of truth)

interface HiddenInsights {
  dataConfidence: 'satellite' | 'manual' | 'hq_actual';
  dataConfidencePercent: number;
  peakDemandReductionKw: number;
  peakDemandSavingsAnnual: number;
  selfConsumptionPercent: number;
  gridExportPercent: number;
  clippingLossPercent: number;
  equivalentTreesPlanted: number;
  equivalentCarsRemoved: number;
  costOfInaction25yr: number;
}

interface AnalysisResult {
  pvSizeKW: number;
  battEnergyKWh: number;
  battPowerKW: number;
  demandShavingSetpointKW: number;
  annualConsumptionKWh: number;
  peakDemandKW: number;
  annualEnergySavingsKWh: number;
  annualDemandReductionKW: number;
  selfConsumptionKWh: number;
  selfSufficiencyPercent: number;
  totalProductionKWh: number;
  annualCostBefore: number;
  annualCostAfter: number;
  annualSavings: number;
  savingsYear1: number;
  capexGross: number;
  capexPV: number;
  capexBattery: number;
  incentivesHQ: number;
  incentivesHQSolar: number;
  incentivesHQBattery: number;
  incentivesFederal: number;
  taxShield: number;
  totalIncentives: number;
  capexNet: number;
  npv25: number;
  npv10: number;
  npv20: number;
  irr25: number;
  irr10: number;
  irr20: number;
  simplePaybackYears: number;
  lcoe: number;
  npv30: number;
  irr30: number;
  lcoe30: number;
  co2AvoidedTonnesPerYear: number;
  assumptions: AnalysisAssumptions;
  cashflows: CashflowEntry[];
  breakdown: FinancialBreakdown;
  hourlyProfile: HourlyProfileEntry[];
  peakWeekData: PeakWeekEntry[];
  sensitivity: SensitivityAnalysis;
  interpolatedMonths: number[];
  hiddenInsights: HiddenInsights;
}

interface ForcedSizing {
  forcePvSize?: number;
  forceBatterySize?: number;
  forceBatteryPower?: number;
}

interface AnalysisOptions {
  forcedSizing?: ForcedSizing;
  preCalculatedDataSpanDays?: number;
}

export function buildHourlyData(readings: Array<{ kWh: number | null; kW: number | null; timestamp: Date }>): {
  hourlyData: Array<{ hour: number; month: number; consumption: number; peak: number }>;
  interpolatedMonths: number[];
} {
  const hourlyByHourMonth: Map<string, { totalKWh: number; maxKW: number; count: number }> = new Map();
  
  for (const r of readings) {
    const hour = r.timestamp.getHours();
    const month = r.timestamp.getMonth() + 1;
    const key = `${month}-${hour}`;
    
    const existing = hourlyByHourMonth.get(key) || { totalKWh: 0, maxKW: 0, count: 0 };
    existing.totalKWh += r.kWh || 0;
    existing.maxKW = Math.max(existing.maxKW, r.kW || 0);
    existing.count++;
    hourlyByHourMonth.set(key, existing);
  }
  
  const monthsWithData: Set<number> = new Set();
  for (let month = 1; month <= 12; month++) {
    let hasAnyData = false;
    for (let hour = 0; hour < 24; hour++) {
      const key = `${month}-${hour}`;
      const data = hourlyByHourMonth.get(key);
      if (data && data.count > 0) {
        hasAnyData = true;
        break;
      }
    }
    if (hasAnyData) {
      monthsWithData.add(month);
    }
  }
  
  const interpolatedMonths: number[] = [];
  
  for (let month = 1; month <= 12; month++) {
    if (!monthsWithData.has(month)) {
      interpolatedMonths.push(month);
      
      let prevMonth: number | null = null;
      for (let p = month - 1; p >= 1; p--) {
        if (monthsWithData.has(p)) {
          prevMonth = p;
          break;
        }
      }
      if (prevMonth === null) {
        for (let p = 12; p > month; p--) {
          if (monthsWithData.has(p)) {
            prevMonth = p;
            break;
          }
        }
      }
      
      let nextMonth: number | null = null;
      for (let n = month + 1; n <= 12; n++) {
        if (monthsWithData.has(n)) {
          nextMonth = n;
          break;
        }
      }
      if (nextMonth === null) {
        for (let n = 1; n < month; n++) {
          if (monthsWithData.has(n)) {
            nextMonth = n;
            break;
          }
        }
      }
      
      for (let hour = 0; hour < 24; hour++) {
        let avgConsumption = 0;
        let avgPeak = 0;
        let sourceCount = 0;
        
        if (prevMonth !== null) {
          const prevKey = `${prevMonth}-${hour}`;
          const prevData = hourlyByHourMonth.get(prevKey);
          if (prevData && prevData.count > 0) {
            avgConsumption += prevData.totalKWh / prevData.count;
            avgPeak += prevData.maxKW;
            sourceCount++;
          }
        }
        
        if (nextMonth !== null && nextMonth !== prevMonth) {
          const nextKey = `${nextMonth}-${hour}`;
          const nextData = hourlyByHourMonth.get(nextKey);
          if (nextData && nextData.count > 0) {
            avgConsumption += nextData.totalKWh / nextData.count;
            avgPeak += nextData.maxKW;
            sourceCount++;
          }
        }
        
        const key = `${month}-${hour}`;
        hourlyByHourMonth.set(key, {
          totalKWh: sourceCount > 0 ? avgConsumption / sourceCount : 0,
          maxKW: sourceCount > 0 ? avgPeak / sourceCount : 0,
          count: 1,
        });
      }
    }
  }
  
  const hourlyData: Array<{ hour: number; month: number; consumption: number; peak: number }> = [];
  
  for (let month = 1; month <= 12; month++) {
    const daysInMonth = new Date(2025, month, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const key = `${month}-${hour}`;
        const data = hourlyByHourMonth.get(key);
        
        if (data && data.count > 0) {
          hourlyData.push({
            hour,
            month,
            consumption: data.totalKWh / data.count,
            peak: data.maxKW,
          });
        } else {
          hourlyData.push({
            hour,
            month,
            consumption: 0,
            peak: 0,
          });
        }
      }
    }
  }
  
  return { hourlyData, interpolatedMonths };
}

export function runPotentialAnalysis(
  readings: Array<{ kWh: number | null; kW: number | null; timestamp: Date }>,
  customAssumptions?: Partial<AnalysisAssumptions>,
  options?: AnalysisOptions
): AnalysisResult {
  const h: AnalysisAssumptions = { ...defaultAnalysisAssumptions, ...customAssumptions };
  
  type AssumptionsWithYieldStrategy = AnalysisAssumptions & { _yieldStrategy?: YieldStrategy };
  const incomingStrategy = (customAssumptions as Partial<AssumptionsWithYieldStrategy>)?._yieldStrategy;
  if (incomingStrategy) {
    (h as AssumptionsWithYieldStrategy)._yieldStrategy = incomingStrategy;
  }
  
  if (customAssumptions?.yieldSource) {
    h.yieldSource = customAssumptions.yieldSource;
  }
  
  const { hourlyData, interpolatedMonths } = buildHourlyData(readings);
  
  const forcedSizing = options?.forcedSizing;
  
  let totalKWh = 0;
  let peakKW = 0;
  
  for (const r of readings) {
    totalKWh += r.kWh || 0;
    const kw = r.kW || 0;
    if (kw > peakKW) peakKW = kw;
  }
  
  const dataSpanDays = options?.preCalculatedDataSpanDays ?? (
    readings.length > 0 
      ? Math.max(1, (new Date(readings[readings.length - 1].timestamp).getTime() - new Date(readings[0].timestamp).getTime()) / (1000 * 60 * 60 * 24))
      : 365
  );
  const annualizationFactor = 365 / Math.max(dataSpanDays, 1);
  const annualConsumptionKWh = totalKWh * annualizationFactor;
  
  // Use pre-calculated maxPVFromRoofKw from traced polygons (KB Racking formula)
  // Fallback: calculate locally using KB Racking formula: (usable_area_m² / 3.71) × 0.660
  const maxPVFromRoof = (h as AnalysisAssumptions & { maxPVFromRoofKw?: number }).maxPVFromRoofKw !== undefined
    ? (h as AnalysisAssumptions & { maxPVFromRoofKw?: number }).maxPVFromRoofKw!
    : ((h.roofAreaSqFt / 10.764) * h.roofUtilizationRatio / 3.71) * 0.660;
  
  // Use _yieldStrategy (set by resolveYieldStrategy) as SINGLE source of truth for yield
  // This ensures bifacial boost matches roof color analysis (5%/10%/15%) and avoids hard-coded 1.15
  const storedYieldStrategy = (h as AnalysisAssumptions & { _yieldStrategy?: YieldStrategy })._yieldStrategy;
  const effectiveYield = storedYieldStrategy
    ? storedYieldStrategy.effectiveYield
    : h.solarYieldKWhPerKWp || BASELINE_YIELD;
  const targetPVSize = (annualConsumptionKWh / effectiveYield) * 1.2;
  
  // HQ OSE 6.0: PV ≤ puissance max appelée des 12 derniers mois (mesurage net requirement)
  // peakKW is already derived from the meter readings (max kW observed over the billing period)
  const pvSizeKW = forcedSizing?.forcePvSize !== undefined
    ? Math.round(forcedSizing.forcePvSize)
    : Math.min(Math.round(targetPVSize), Math.round(maxPVFromRoof), Math.round(peakKW));
  
  const battPowerKW = forcedSizing?.forceBatteryPower !== undefined
    ? Math.round(forcedSizing.forceBatteryPower)
    : Math.round(peakKW * 0.3);
  const battEnergyKWh = forcedSizing?.forceBatterySize !== undefined
    ? Math.round(forcedSizing.forceBatterySize)
    : Math.round(battPowerKW * 2);
  const demandShavingSetpointKW = Math.round(peakKW * 0.90);
  
  const yieldFactor = effectiveYield / 1150;
  
  const storedStrategyForSim = (h as AnalysisAssumptions & { _yieldStrategy?: YieldStrategy })._yieldStrategy;
  const skipTempCorrection = storedStrategyForSim 
    ? storedStrategyForSim.skipTempCorrection 
    : (h.yieldSource === 'google' || h.yieldSource === 'manual');
  
  const currentYieldSource: 'google' | 'manual' | 'default' = (h.yieldSource === 'google' || h.yieldSource === 'manual') ? h.yieldSource : 'default';
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
  if (currentYieldSource === 'google' && (!effectiveSnowProfile || effectiveSnowProfile === 'none')) {
    effectiveSnowProfile = 'ballasted_10deg';
  }

  const simResult = runHourlySimulation(hourlyData, pvSizeKW, battEnergyKWh, battPowerKW, demandShavingSetpointKW, yieldFactor, systemParams, currentYieldSource, effectiveSnowProfile);
  
  const selfConsumptionKWh = simResult.totalSelfConsumption;
  const totalProductionKWh = simResult.totalProductionKWh;
  const totalExportedKWh = simResult.totalExportedKWh;
  const peakDemandKW = peakKW;
  const peakAfterKW = simResult.peakAfter;
  const annualDemandReductionKW = peakKW - peakAfterKW;
  // ── Financial calculations via shared module ──────────────────────────
  const financials = calculateCashflowMetrics({
    pvSizeKW,
    battEnergyKWh,
    battPowerKW,
    selfConsumptionKWh,
    totalExportedKWh,
    totalProductionKWh,
    gridChargingKWh: simResult.totalGridChargingKWh,
    annualConsumptionKWh,
    peakBeforeKW: peakKW,
    peakAfterKW: simResult.peakAfter,
    monthlyPeaksBefore: simResult.monthlyPeaksBefore,
    monthlyPeaksAfter: simResult.monthlyPeaksAfter,
    effectiveYield,
    assumptions: h,
  });

  // Extract commonly used values for downstream code
  const { annualSavings, annualCostBefore, annualCostAfter, annualSurplusRevenue,
          capexGross, capexNet, incentivesHQ, incentivesHQSolar, incentivesHQBattery,
          incentivesFederal, taxShield, co2AvoidedTonnesPerYear,
          npv25, npv20, npv10, npv30, irr25, irr20, irr10, irr30,
          lcoe, lcoe30, simplePaybackYears, selfSufficiencyPercent,
          cashflows, breakdown } = financials;
  const capexPV = financials.capexSolar;
  const capexBattery = financials.capexBattery;
  const totalIncentives = incentivesHQ + incentivesFederal + taxShield;
  const savingsYear1 = annualSavings;
  const demandSavings = annualSavings - (selfConsumptionKWh * h.tariffEnergy - simResult.totalGridChargingKWh * h.tariffEnergy);

  // Calculate hidden insights for downstream consumers (PDF, PPTX, emails)
  const dataConfidenceMap: Record<string, 'satellite' | 'manual' | 'hq_actual'> = {
    google: 'satellite',
    manual: 'manual',
    default: 'satellite',
  };
  const dataConfidence = dataConfidenceMap[currentYieldSource] || 'satellite';
  const dataConfidencePercentMap: Record<string, number> = {
    satellite: 75,
    manual: 85,
    hq_actual: 95,
  };
  const dataConfidencePercent = dataConfidencePercentMap[dataConfidence] || 75;

  const peakDemandReductionKw = battPowerKW > 0 ? annualDemandReductionKW : 0;
  const peakDemandSavingsAnnual = demandSavings;
  const selfConsumptionPercent = totalProductionKWh > 0 ? (selfConsumptionKWh / totalProductionKWh) * 100 : 0;
  const gridExportPercent = totalProductionKWh > 0 ? (totalExportedKWh / totalProductionKWh) * 100 : 0;
  const clippingLossPercent = totalProductionKWh > 0 ? (simResult.clippingLossKWh / (totalProductionKWh + simResult.clippingLossKWh)) * 100 : 0;

  // CO2 to trees: 21.77 kg CO2 per tree per year
  const equivalentTreesPlanted = Math.round((co2AvoidedTonnesPerYear * 1000) / 21.77);

  // CO2 to cars: 4,600 kg CO2 per car per year
  const equivalentCarsRemoved = Math.round((co2AvoidedTonnesPerYear * 1000) / 4600);

  // Cost of inaction: 25-year utility costs without solar (3.5% annual escalation)
  let costOfInaction25yr = 0;
  for (let y = 0; y < 25; y++) {
    const escalatedCost = annualCostBefore * Math.pow(1 + 0.035, y);
    costOfInaction25yr += escalatedCost;
  }

  const hiddenInsights: HiddenInsights = {
    dataConfidence,
    dataConfidencePercent,
    peakDemandReductionKw,
    peakDemandSavingsAnnual,
    selfConsumptionPercent,
    gridExportPercent,
    clippingLossPercent,
    equivalentTreesPlanted,
    equivalentCarsRemoved,
    costOfInaction25yr,
  };

  const sensitivity = forcedSizing
    ? null
    : runSensitivityAnalysis(
        hourlyData,
        pvSizeKW,
        battEnergyKWh,
        battPowerKW,
        peakKW,
        annualConsumptionKWh,
        h,
        npv25
      );
  
  return {
    pvSizeKW,
    battEnergyKWh,
    battPowerKW,
    demandShavingSetpointKW,
    annualConsumptionKWh,
    peakDemandKW,
    annualEnergySavingsKWh: selfConsumptionKWh,
    annualDemandReductionKW,
    selfConsumptionKWh,
    selfSufficiencyPercent,
    totalProductionKWh,
    annualCostBefore,
    annualCostAfter,
    annualSavings,
    savingsYear1,
    capexGross,
    capexPV,
    capexBattery,
    incentivesHQ,
    incentivesHQSolar,
    incentivesHQBattery,
    incentivesFederal,
    taxShield,
    totalIncentives,
    capexNet,
    npv25,
    npv10,
    npv20,
    irr25,
    irr10,
    irr20,
    simplePaybackYears,
    lcoe,
    npv30,
    irr30,
    lcoe30,
    co2AvoidedTonnesPerYear,
    assumptions: h,
    cashflows,
    breakdown,
    hourlyProfile: simResult.hourlyProfile,
    peakWeekData: simResult.peakWeekData,
    sensitivity,
    interpolatedMonths,
    hiddenInsights,
  };
}

export async function runAutoAnalysisForSite(siteId: string): Promise<void> {
  const { storage } = await import("../storage");
  const { createLogger } = await import("../lib/logger");
  const log = createLogger("AutoAnalysis");

  const site = await storage.getSite(siteId);
  if (!site) throw new Error(`Site ${siteId} not found`);

  const readings = await storage.getMeterReadingsBySite(siteId);
  if (readings.length === 0) {
    log.warn(`No meter readings for site ${siteId}, skipping auto-analysis`);
    return;
  }

  const dedupResult = deduplicateMeterReadingsByHour(readings.map(r => ({
    kWh: r.kWh,
    kW: r.kW,
    timestamp: new Date(r.timestamp),
    granularity: r.granularity || undefined
  })));

  const roofDetailsScenario = site.roofAreaAutoDetails as { yearlyEnergyDcKwh?: number; maxSunshineHoursPerYear?: number } | null;
  const googleData: { googleProductionEstimate?: { yearlyEnergyAcKwh: number; systemSizeKw: number }; maxSunshineHoursPerYear?: number } | undefined =
    (roofDetailsScenario?.yearlyEnergyDcKwh && (site as any).kbKwDc) || roofDetailsScenario?.maxSunshineHoursPerYear
    ? {
        ...(roofDetailsScenario?.yearlyEnergyDcKwh && (site as any).kbKwDc ? {
          googleProductionEstimate: {
            yearlyEnergyAcKwh: roofDetailsScenario.yearlyEnergyDcKwh,
            systemSizeKw: (site as any).kbKwDc
          }
        } : {}),
        ...(roofDetailsScenario?.maxSunshineHoursPerYear ? {
          maxSunshineHoursPerYear: roofDetailsScenario.maxSunshineHoursPerYear
        } : {})
      }
    : undefined;

  const baseAssumptions = {
    ...getDefaultAnalysisAssumptions(),
    bifacialEnabled: (site as any).bifacialEnabled ?? true
  };

  const yieldStrategy = resolveYieldStrategyFromAnalysis(
    baseAssumptions as AnalysisAssumptions,
    googleData,
    (site as any).roofColorType
  );

  const analysisAssumptions: Partial<AnalysisAssumptions> & { maxPVFromRoofKw?: number; _yieldStrategy?: YieldStrategy } = {
    ...baseAssumptions,
    solarYieldKWhPerKWp: yieldStrategy.effectiveYield,
    yieldSource: yieldStrategy.yieldSource,
    _yieldStrategy: yieldStrategy
  };

  const polygons = await storage.getRoofPolygons(siteId);
  const solarPolygons = polygons.filter(p => {
    if (p.color === "#f97316") return false;
    const label = (p.label || "").toLowerCase();
    return !label.includes("constraint") && !label.includes("contrainte") &&
           !label.includes("hvac") && !label.includes("obstacle");
  });

  const tracedSolarAreaSqM = solarPolygons.reduce((sum, p) => sum + (p.areaSqM || 0), 0);
  const effectiveRoofAreaSqM = tracedSolarAreaSqM > 0
    ? tracedSolarAreaSqM
    : (site.roofAreaSqM || site.roofAreaAutoSqM || 0);

  if (effectiveRoofAreaSqM <= 0) {
    log.warn(`No roof area for site ${siteId}, skipping auto-analysis`);
    return;
  }

  analysisAssumptions.roofAreaSqFt = effectiveRoofAreaSqM * 10.764;

  const roofUtilizationRatio = baseAssumptions.roofUtilizationRatio ?? 0.85;
  const usableAreaSqM = effectiveRoofAreaSqM * roofUtilizationRatio;
  const kbMaxPvKw = (usableAreaSqM / 3.71) * 0.660;
  analysisAssumptions.maxPVFromRoofKw = kbMaxPvKw;

  log.info(`Auto-analysis: site=${siteId}, roofArea=${effectiveRoofAreaSqM.toFixed(0)}m², maxPV=${kbMaxPvKw.toFixed(1)}kW`);

  const result = runPotentialAnalysis(
    dedupResult.readings,
    analysisAssumptions,
    { preCalculatedDataSpanDays: dedupResult.dataSpanDays }
  );

  await storage.createSimulationRun({
    siteId,
    meterId: null,
    type: "SCENARIO",
    status: "completed",
    pvSizeKW: result.pvSizeKW,
    battEnergyKWh: result.battEnergyKWh,
    battPowerKW: result.battPowerKW,
    demandShavingSetpointKW: result.demandShavingSetpointKW,
    annualConsumptionKWh: result.annualConsumptionKWh,
    peakDemandKW: result.peakDemandKW,
    annualEnergySavingsKWh: result.annualEnergySavingsKWh,
    annualDemandReductionKW: result.annualDemandReductionKW,
    selfConsumptionKWh: result.selfConsumptionKWh,
    selfSufficiencyPercent: result.selfSufficiencyPercent,
    totalProductionKWh: result.totalProductionKWh,
    totalExportedKWh: result.totalExportedKWh,
    annualSurplusRevenue: result.annualSurplusRevenue,
    annualEnergyCostSavings: result.annualEnergyCostSavings,
    annualDemandCostSavings: result.annualDemandCostSavings,
    totalAnnualSavings: result.totalAnnualSavings,
    systemCost: result.systemCost,
    npv: result.npv,
    irr: result.irr,
    simplePaybackYears: result.simplePaybackYears,
    lcoe: result.lcoe,
    co2AvoidedTonnesPerYear: result.co2AvoidedTonnesPerYear,
    assumptions: result.assumptions,
    cashflows: result.cashflows,
    breakdown: result.breakdown,
    hourlyProfile: result.hourlyProfile,
    peakWeekData: result.peakWeekData,
    sensitivity: result.sensitivity,
    interpolatedMonths: result.interpolatedMonths,
    label: "Auto-analyse (import HQ)",
  } as any);

  await storage.updateSite(siteId, { readyForAnalysis: false });
  log.info(`Auto-analysis saved for site ${siteId}`);
}
