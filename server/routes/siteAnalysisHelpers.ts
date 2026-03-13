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
import { buildSimulationInsert } from "../analysis/resolveSimulationMetrics";
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
import { runAnalysisQA, type QAResult } from "../analysis/analysisQA";
import { HQ_TARIFF_ESCALATION_RATE, HQ_TARIFF_ESCALATION_INITIAL, HQ_TARIFF_ESCALATION_TRANSITION_YEAR, TEMPERATURE_COEFFICIENT } from '@shared/constants';

function isNorthFacingPolygon(p){const t=(p.tiltDegrees??p.tilt_degrees??0);if(t<=0)return false;const a=p.orientation;if(a==null||a===undefined)return false;const n=((a%360)+360)%360;return n>=315||n<=45;}

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

  // ── Filter out monthly summary readings when sub-hourly data exists ──
  // HQ "période" files have gran=HOUR, kWh=36-65k (monthly totals), kW=null.
  // When mixed with 15-min interval data, these corrupt hourly profiles by
  // putting all consumption at midnight → selfConsumption = 0.
  const hasSubHourlyData = rawReadings.some(r => r.granularity && r.granularity !== 'HOUR' && r.granularity !== 'MONTH' && r.granularity !== 'DAY');
  let filteredReadings = rawReadings;
  if (hasSubHourlyData) {
    const before = rawReadings.length;
    filteredReadings = rawReadings.filter(r => {
      // A monthly summary reading: gran=HOUR but kWh is huge (>500 kWh in one "hour" = obviously monthly)
      // and kW is null (no demand data). These are HQ période file entries.
      if (r.granularity === 'HOUR' && r.kWh !== null && r.kWh > 500 && r.kW === null) {
        return false; // exclude monthly summary
      }
      // Also exclude explicit MONTH/DAY granularity when we have better data
      if (r.granularity === 'MONTH' || r.granularity === 'DAY') {
        return false;
      }
      return true;
    });
    if (filteredReadings.length < before) {
      console.log(`[dedup] Excluded ${before - filteredReadings.length} monthly summary readings (have ${filteredReadings.length} sub-hourly readings)`);
    }
  }

  let minTs = new Date(filteredReadings[0]?.timestamp || rawReadings[0].timestamp).getTime();
  let maxTs = minTs;
  for (const r of filteredReadings.length > 0 ? filteredReadings : rawReadings) {
    const ts = new Date(r.timestamp).getTime();
    if (ts < minTs) minTs = ts;
    if (ts > maxTs) maxTs = ts;
  }
  const dataSpanDays = Math.max(1, (maxTs - minTs) / (1000 * 60 * 60 * 24));

  const hourBuckets = new Map<string, Array<typeof rawReadings[0]>>();
  
  for (const reading of filteredReadings) {
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
      
      const fallbackKW = (bestHourly.kW != null && bestHourly.kW > 0) ? bestHourly.kW : (maxKW > 0 ? maxKW : null);
      const refKW = fallbackKW || maxKW || 0;
      const kWhLooksLikeDailyTotal = bestHourly.kWh != null && bestHourly.kWh > 0 && refKW > 0 && bestHourly.kWh > refKW * 10;
      const kWhMissing = bestHourly.kWh == null || (bestHourly.kWh === 0 && fallbackKW != null && fallbackKW > 0) || kWhLooksLikeDailyTotal;
      const resolvedKWh = kWhMissing
        ? (fallbackKW != null && fallbackKW > 0 ? fallbackKW : (kWhLooksLikeDailyTotal ? null : bestHourly.kWh))
        : bestHourly.kWh;
      deduplicatedReadings.push({
        timestamp: hourTimestamp,
        kWh: resolvedKWh,
        kW: maxKW > 0 ? maxKW : bestHourly.kW,
      });
    } else {
      let totalKWh = 0;
      let maxKW = 0;
      let sumKW = 0;
      let countKW = 0;
      let hasKWh = false;

      for (const r of readings) {
        if (r.kWh !== null) {
          totalKWh += r.kWh;
          hasKWh = true;
        }
        if (r.kW !== null) {
          if (r.kW > maxKW) maxKW = r.kW;
          sumKW += r.kW;
          countKW++;
        }
      }

      const kWhEffectivelyMissing = !hasKWh || (totalKWh === 0 && maxKW > 0);
      // When kWh is missing, use average kW as hourly energy estimate:
      // avg(kW) over the hour = total energy in kWh (since interval sums to 1 hour)
      // This is more accurate than maxKW which overestimates by ~15%
      const avgKW = countKW > 0 ? sumKW / countKW : 0;
      const resolvedKWh = kWhEffectivelyMissing ? (avgKW > 0 ? avgKW : (maxKW > 0 ? maxKW : null)) : totalKWh;
      deduplicatedReadings.push({
        timestamp: hourTimestamp,
        kWh: resolvedKWh,
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
  totalExportedKWh: number;
  annualSurplusRevenue: number;
  assumptions: AnalysisAssumptions;
  cashflows: CashflowEntry[];
  breakdown: FinancialBreakdown;
  hourlyProfile: HourlyProfileEntry[];
  peakWeekData: PeakWeekEntry[];
  sensitivity: SensitivityAnalysis;
  interpolatedMonths: number[];
  hiddenInsights: HiddenInsights;
  dataQuality: {
    usedRealDailyProfiles: boolean;
    interpolatedMonthCount: number;
    hasSyntheticPeaks: boolean;
    warning?: string;
  };
  qaResult?: QAResult;
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
  usedRealDailyProfiles: boolean;
} {
  // Detect interval from data to properly convert kW → kWh
  // HQ 15-min data provides kW (puissance) but not kWh (énergie)
  let intervalHours = 1;
  if (readings.length >= 2) {
    const sorted = [...readings].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const gaps: number[] = [];
    for (let i = 1; i < Math.min(sorted.length, 20); i++) {
      const gapMs = sorted[i].timestamp.getTime() - sorted[i - 1].timestamp.getTime();
      if (gapMs > 0 && gapMs <= 3600000) gaps.push(gapMs);
    }
    if (gaps.length > 0) {
      const medianGap = gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
      intervalHours = medianGap / 3600000; // 0.25 for 15-min
    }
  }

  // ── Phase 1: Build real daily profiles from actual readings ──
  // Key: "YYYY-MM-DD-HH" → { totalKWh, maxKW, count }
  const realDayHour: Map<string, { totalKWh: number; maxKW: number; count: number }> = new Map();

  for (const r of readings) {
    const ts = new Date(r.timestamp);
    const year = ts.getFullYear();
    const month = ts.getMonth() + 1;
    const day = ts.getDate();
    const hour = ts.getHours();
    const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}-${String(hour).padStart(2, '0')}`;

    const existing = realDayHour.get(key) || { totalKWh: 0, maxKW: 0, count: 0 };
    const kWhMissing = r.kWh == null || (r.kWh === 0 && r.kW != null && r.kW > 0);
    const effectiveKWh = kWhMissing ? ((r.kW || 0) * intervalHours) : (r.kWh || 0);
    existing.totalKWh += effectiveKWh;
    existing.maxKW = Math.max(existing.maxKW, r.kW || 0);
    existing.count++;
    realDayHour.set(key, existing);
  }

  // ── Phase 2: Determine which months have real daily data ──
  // Track unique days per month to decide if we have enough real data
  const daysPerMonth: Map<number, Set<string>> = new Map();
  for (const key of realDayHour.keys()) {
    const parts = key.split('-');
    const month = parseInt(parts[1]);
    const dayKey = `${parts[0]}-${parts[1]}-${parts[2]}`;
    if (!daysPerMonth.has(month)) daysPerMonth.set(month, new Set());
    daysPerMonth.get(month)!.add(dayKey);
  }

  const monthsWithRealData: Set<number> = new Set();
  for (let month = 1; month <= 12; month++) {
    const days = daysPerMonth.get(month);
    // Need at least 15 days of data to use real profiles for this month
    if (days && days.size >= 15) {
      monthsWithRealData.add(month);
    }
  }

  // ── Phase 3: Also build month-hour aggregates for fallback/interpolation ──
  const hourlyByHourMonth: Map<string, { totalKWh: number; maxKW: number; avgKW: number; count: number }> = new Map();
  for (const r of readings) {
    const hour = r.timestamp.getHours();
    const month = r.timestamp.getMonth() + 1;
    const key = `${month}-${hour}`;

    const existing = hourlyByHourMonth.get(key) || { totalKWh: 0, maxKW: 0, avgKW: 0, count: 0 };
    const kWhMissing = r.kWh == null || (r.kWh === 0 && r.kW != null && r.kW > 0);
    const effectiveKWh = kWhMissing ? ((r.kW || 0) * intervalHours) : (r.kWh || 0);
    existing.totalKWh += effectiveKWh;
    existing.maxKW = Math.max(existing.maxKW, r.kW || 0);
    existing.count++;
    // Running sum for average (finalized below)
    existing.avgKW += (r.kW || 0);
    hourlyByHourMonth.set(key, existing);
  }
  // Finalize avgKW
  for (const [, data] of hourlyByHourMonth) {
    data.avgKW = data.count > 0 ? data.avgKW / data.count : 0;
  }

  // ── Phase 4: Identify interpolated months and build fallback profiles ──
  const interpolatedMonths: number[] = [];
  // For months without enough real data, build average-day profiles using month-hour aggregates
  // BUT use avgKW for peak instead of maxKW — this gives a typical day, not worst-case
  const fallbackProfiles: Map<string, { consumption: number; peak: number }> = new Map();

  for (let month = 1; month <= 12; month++) {
    if (!monthsWithRealData.has(month)) {
      interpolatedMonths.push(month);

      // Find nearest months with data for interpolation
      let prevMonth: number | null = null;
      for (let p = month - 1; p >= 1; p--) {
        if (monthsWithRealData.has(p) || hourlyByHourMonth.has(`${p}-12`)) {
          prevMonth = p;
          break;
        }
      }
      if (prevMonth === null) {
        for (let p = 12; p > month; p--) {
          if (monthsWithRealData.has(p) || hourlyByHourMonth.has(`${p}-12`)) {
            prevMonth = p;
            break;
          }
        }
      }

      let nextMonth: number | null = null;
      for (let n = month + 1; n <= 12; n++) {
        if (monthsWithRealData.has(n) || hourlyByHourMonth.has(`${n}-12`)) {
          nextMonth = n;
          break;
        }
      }
      if (nextMonth === null) {
        for (let n = 1; n < month; n++) {
          if (monthsWithRealData.has(n) || hourlyByHourMonth.has(`${n}-12`)) {
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
            // Use average kW, not max — gives typical day profile for interpolation
            avgPeak += prevData.avgKW;
            sourceCount++;
          }
        }

        if (nextMonth !== null && nextMonth !== prevMonth) {
          const nextKey = `${nextMonth}-${hour}`;
          const nextData = hourlyByHourMonth.get(nextKey);
          if (nextData && nextData.count > 0) {
            avgConsumption += nextData.totalKWh / nextData.count;
            avgPeak += nextData.avgKW;
            sourceCount++;
          }
        }

        fallbackProfiles.set(`${month}-${hour}`, {
          consumption: sourceCount > 0 ? avgConsumption / sourceCount : 0,
          peak: sourceCount > 0 ? avgPeak / sourceCount : 0,
        });
      }
    }
  }

  // ── Phase 5: Build 8760-hour profile using real daily data where available ──
  const hourlyData: Array<{ hour: number; month: number; consumption: number; peak: number }> = [];
  const usedRealDailyProfiles = monthsWithRealData.size >= 6; // Flag for QA

  for (let month = 1; month <= 12; month++) {
    const daysInMonth = new Date(2025, month, 0).getDate();

    if (monthsWithRealData.has(month)) {
      // ── Real data path: use actual daily profiles ──
      // Collect all real days for this month sorted by date
      const realDays: Array<{ dayKey: string; year: number; day: number }> = [];
      const monthDays = daysPerMonth.get(month);
      if (monthDays) {
        for (const dayKey of monthDays) {
          const parts = dayKey.split('-');
          realDays.push({ dayKey, year: parseInt(parts[0]), day: parseInt(parts[2]) });
        }
        realDays.sort((a, b) => a.day - b.day);
      }

      for (let day = 1; day <= daysInMonth; day++) {
        // Find the closest real day for this calendar day
        // If we have data for this exact day (in any year), use it
        // Otherwise use the nearest day in the same month
        let bestDayKey: string | null = null;
        let bestDistance = Infinity;
        for (const rd of realDays) {
          const dist = Math.abs(rd.day - day);
          if (dist < bestDistance) {
            bestDistance = dist;
            bestDayKey = rd.dayKey;
          }
        }

        for (let hour = 0; hour < 24; hour++) {
          if (bestDayKey) {
            const hourKey = `${bestDayKey}-${String(hour).padStart(2, '0')}`;
            const data = realDayHour.get(hourKey);
            if (data && data.count > 0) {
              hourlyData.push({
                hour,
                month,
                consumption: data.totalKWh / data.count,
                // Use ACTUAL kW for this specific day-hour — NOT max of entire month
                peak: data.maxKW,
              });
              continue;
            }
          }
          // Fallback: use month-hour average if specific day-hour missing
          const mhKey = `${month}-${hour}`;
          const mhData = hourlyByHourMonth.get(mhKey);
          hourlyData.push({
            hour,
            month,
            consumption: mhData ? mhData.totalKWh / mhData.count : 0,
            peak: mhData ? mhData.avgKW : 0,
          });
        }
      }
    } else {
      // ── Interpolated month: use fallback average-day profile ──
      for (let day = 1; day <= daysInMonth; day++) {
        for (let hour = 0; hour < 24; hour++) {
          const fb = fallbackProfiles.get(`${month}-${hour}`);
          hourlyData.push({
            hour,
            month,
            consumption: fb ? fb.consumption : 0,
            peak: fb ? fb.peak : 0,
          });
        }
      }
    }
  }

  return { hourlyData, interpolatedMonths, usedRealDailyProfiles };
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
  
  const { hourlyData, interpolatedMonths, usedRealDailyProfiles } = buildHourlyData(readings);

  const forcedSizing = options?.forcedSizing;
  
  let totalKWh = 0;
  let peakKW = 0;

  // Detect interval from data: if readings are sub-hourly (15-min), derive kWh = kW × intervalHours
  // This handles HQ 15-min data where only kW (puissance) is provided, not kWh (énergie)
  let intervalHours = 1; // default: hourly
  if (readings.length >= 2) {
    // Sort a small sample to detect interval
    const sorted = [...readings].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const gaps: number[] = [];
    for (let i = 1; i < Math.min(sorted.length, 20); i++) {
      const gapMs = sorted[i].timestamp.getTime() - sorted[i - 1].timestamp.getTime();
      if (gapMs > 0 && gapMs <= 3600000) gaps.push(gapMs);
    }
    if (gaps.length > 0) {
      const medianGap = gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
      intervalHours = medianGap / 3600000; // e.g. 0.25 for 15-min data
    }
  }

  for (const r of readings) {
    // Derive kWh from kW when kWh is missing (common with HQ 15-min demand data)
    const kWhMissing = r.kWh == null || (r.kWh === 0 && r.kW != null && r.kW > 0);
    const effectiveKWh = kWhMissing ? ((r.kW || 0) * intervalHours) : (r.kWh || 0);
    totalKWh += effectiveKWh;
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
  // Intelligent demand shaving setpoint — see simulationEngine.ts for full rationale
  const pfmProxy = h.pfmKW || peakKW * 0.65;
  const demandShavingSetpointKW = battPowerKW > 0
    ? Math.round(Math.max(peakKW - battPowerKW, pfmProxy))
    : Math.round(peakKW * 0.90);
  
  const yieldFactor = effectiveYield / 1150;
  
  const storedStrategyForSim = (h as AnalysisAssumptions & { _yieldStrategy?: YieldStrategy })._yieldStrategy;
  const skipTempCorrection = storedStrategyForSim 
    ? storedStrategyForSim.skipTempCorrection 
    : (h.yieldSource === 'google' || h.yieldSource === 'manual');
  
  const currentYieldSource: 'google' | 'manual' | 'default' = (h.yieldSource === 'google' || h.yieldSource === 'manual') ? h.yieldSource : 'default';
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
  if (currentYieldSource === 'google' && (!effectiveSnowProfile || effectiveSnowProfile === 'none')) {
    effectiveSnowProfile = 'ballasted_10deg';
  }

  const simResult = runHourlySimulation(hourlyData, pvSizeKW, battEnergyKWh, battPowerKW, demandShavingSetpointKW, yieldFactor, systemParams, currentYieldSource, effectiveSnowProfile);
  
  const selfConsumptionKWh = simResult.totalSelfConsumption;
  const totalProductionKWh = simResult.totalProductionKWh;
  const totalExportedKWh = simResult.totalExportedKWh;
  const peakDemandKW = peakKW;
  const peakAfterKW = simResult.peakAfter;
  const annualDemandReductionKW = Math.max(0, peakKW - peakAfterKW);
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
          lcoe, lcoe30, simplePaybackYears,
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
  const selfSufficiencyPercent = annualConsumptionKWh > 0 ? (selfConsumptionKWh / annualConsumptionKWh) * 100 : 0;
  const gridExportPercent = totalProductionKWh > 0 ? (totalExportedKWh / totalProductionKWh) * 100 : 0;
  const clippingLossPercent = totalProductionKWh > 0 ? (simResult.clippingLossKWh / (totalProductionKWh + simResult.clippingLossKWh)) * 100 : 0;

  // CO2 to trees: 21.77 kg CO2 per tree per year
  const equivalentTreesPlanted = Math.round((co2AvoidedTonnesPerYear * 1000) / 21.77);

  // CO2 to cars: 4,600 kg CO2 per car per year
  const equivalentCarsRemoved = Math.round((co2AvoidedTonnesPerYear * 1000) / 4600);

  // Cost of inaction: 25-year utility costs without solar
  // Stepped escalation: 4.8%/yr years 1-3 (HQ 2024 announcement), then 3.5%/yr long-term
  let costOfInaction25yr = 0;
  let costEscFactor = 1;
  for (let y = 0; y < 25; y++) {
    if (y > 0) { costEscFactor *= (1 + (y <= HQ_TARIFF_ESCALATION_TRANSITION_YEAR ? HQ_TARIFF_ESCALATION_INITIAL : HQ_TARIFF_ESCALATION_RATE)); }
    costOfInaction25yr += annualCostBefore * costEscFactor;
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
  
  // ── QA Validation ──
  const qaResult = runAnalysisQA({
    totalReadings: readings.length,
    hasRealMeterData: readings.length > 1000,
    usedRealDailyProfiles,
    interpolatedMonthCount: interpolatedMonths.length,
    dataSpanDays: readings.length > 1
      ? (readings[readings.length - 1].timestamp.getTime() - readings[0].timestamp.getTime()) / 86400000
      : 0,
    hasSyntheticFiles: readings.length === 0,
    pvSizeKW,
    battEnergyKWh,
    battPowerKW,
    peakDemandKW,
    annualConsumptionKWh,
    annualDemandReductionKW,
    annualSavings,
    capexNet,
    npv25,
    irr25,
    simplePaybackYears,
    selfSufficiencyPercent,
    totalProductionKWh,
    monthlyPeaksBefore: simResult.monthlyPeaksBefore,
    monthlyPeaksAfter: simResult.monthlyPeaksAfter,
  });

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
    totalExportedKWh,
    annualSurplusRevenue,
    assumptions: h,
    cashflows,
    breakdown,
    hourlyProfile: simResult.hourlyProfile,
    peakWeekData: simResult.peakWeekData,
    sensitivity,
    interpolatedMonths,
    hiddenInsights,
    dataQuality: {
      usedRealDailyProfiles,
      interpolatedMonthCount: interpolatedMonths.length,
      hasSyntheticPeaks: !usedRealDailyProfiles,
      warning: !usedRealDailyProfiles
        ? 'Peak demand values use month-hour MAX aggregation (synthetic worst-case profile). Battery peak shaving results may be conservative. Upload 12+ months of 15-min HQ data for accurate daily dispatch modeling.'
        : interpolatedMonths.length > 3
          ? `${interpolatedMonths.length} months interpolated from adjacent data. Battery results for those months are approximations.`
          : undefined,
    },
    qaResult,
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

  // ── Auto-detect HQ tariff (same logic as sites.ts run-potential-analysis) ──
  if (!analysisAssumptions.tariffEnergy || analysisAssumptions.tariffEnergy === 0) {
    const annualKWh = dedupResult.readings.reduce((sum, r) => sum + (r.kWh || 0), 0);
    const dataSpanFactor = 365 / Math.max(dedupResult.dataSpanDays, 1);
    const annualizedKWh = annualKWh * dataSpanFactor;
    const hasRealPowerData = dedupResult.readings.some(r => r.kW !== null && r.kW !== undefined && r.kW > 0);
    let peakKW: number;
    if (hasRealPowerData) {
      peakKW = dedupResult.readings.reduce((max, r) => Math.max(max, r.kW || 0), 0);
    } else {
      const meterFiles = await storage.getMeterFiles(siteId);
      const syntheticFile = meterFiles.find((f: any) => f.isSynthetic);
      const syntheticParams = syntheticFile ? (syntheticFile as any).syntheticParams : null;
      const schedule = syntheticParams?.operatingSchedule || "standard";
      const loadFactor = schedule === "24/7" ? 0.55 : schedule === "extended" ? 0.45 : 0.35;
      peakKW = annualizedKWh / (8760 * loadFactor);
    }

    try {
      const { detectTariff: _dt } = await import("../hqTariffs");
      const detected = _dt(peakKW, annualizedKWh, hasRealPowerData);
      let tariffCode = detected.detectedTariff;
      if (tariffCode === "D" || tariffCode === "Flex D") {
        tariffCode = peakKW >= 65 ? "M" : "G";
      }
      const rateMap: Record<string, { energy: number; power: number }> = {
        "G": { energy: 0.11933, power: 21.261 },
        "M": { energy: 0.06061, power: 17.573 },
        "L": { energy: 0.03681, power: 14.476 },
      };
      const rates = rateMap[tariffCode] || rateMap["M"];
      analysisAssumptions.tariffEnergy = rates.energy;
      analysisAssumptions.tariffPower = rates.power;
      (analysisAssumptions as any).tariffCode = tariffCode;
      log.info(`Auto-detected tariff ${tariffCode} (peak=${peakKW.toFixed(1)}kW, annual=${annualizedKWh.toFixed(0)}kWh): energy=${rates.energy}$/kWh, power=${rates.power}$/kW`);
    } catch (e) {
      // Fallback to M tariff if hqTariffs module fails
      analysisAssumptions.tariffEnergy = 0.06061;
      analysisAssumptions.tariffPower = 17.573;
      log.warn(`Tariff detection failed, using M tariff fallback: ${e}`);
    }
  }

  // ── Auto-detect GDP (no net metering) ──
  const tariffDetail = ((site as any).hqTariffDetail || '').toUpperCase();
  const isGDP = tariffDetail.includes('GDP') || tariffDetail.includes('DEMANDE DE PUISSANCE');
  if (isGDP) {
    analysisAssumptions.netMeteringEnabled = false;
    log.info(`GDP tariff detected — net metering auto-disabled for site ${siteId}`);
  }

  const polygons = await storage.getRoofPolygons(siteId);
  const solarPolygons = polygons.filter(p => {
    if (p.color === "#f97316") return false;
    const label = (p.label || "").toLowerCase();
    if(isNorthFacingPolygon(p))return false;
        return !label.includes("constraint")&&!label.includes("contrainte")&&!label.includes("hvac")&&!label.includes("obstacle");
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

  // Inject PFM from DB into assumptions
  if ((site as any).pfmKw && !analysisAssumptions.pfmKW) {
    analysisAssumptions.pfmKW = (site as any).pfmKw;
  }

  const roofUtilizationRatio = baseAssumptions.roofUtilizationRatio ?? 0.85;
  const usableAreaSqM = effectiveRoofAreaSqM * roofUtilizationRatio;
  const formulaMaxPvKw=(usableAreaSqM/3.71)*0.660;const sKb=(site).kbKwDc;const kbMaxPvKw=(sKb&&sKb>0)?Math.min(formulaMaxPvKw,sKb):formulaMaxPvKw;
  analysisAssumptions.maxPVFromRoofKw = kbMaxPvKw;

  log.info(`Auto-analysis: site=${siteId}, roofArea=${effectiveRoofAreaSqM.toFixed(0)}m², maxPV=${kbMaxPvKw.toFixed(1)}kW`);

  const result = runPotentialAnalysis(
    dedupResult.readings,
    analysisAssumptions,
    { preCalculatedDataSpanDays: dedupResult.dataSpanDays }
  );

  await storage.createSimulationRun(buildSimulationInsert(siteId, result, {
    label: "Auto-analyse (import HQ)",
  }));

  await storage.updateSite(siteId, { readyForAnalysis: false });
  log.info(`Auto-analysis saved for site ${siteId}`);
}
