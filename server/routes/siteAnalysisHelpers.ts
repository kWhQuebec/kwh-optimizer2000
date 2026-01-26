import fs from "fs";
import {
  defaultAnalysisAssumptions,
  type AnalysisAssumptions,
} from "@shared/schema";
import {
  resolveYieldStrategy as resolveYieldStrategyFromAnalysis,
  getTieredSolarCostPerW,
  type YieldStrategy,
  type SystemModelingParams,
  QUEBEC_MONTHLY_TEMPS,
  BASELINE_YIELD,
} from "../analysis/potentialAnalysis";

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

interface HourlyProfileEntry {
  hour: number;
  month: number;
  consumption: number;
  production: number;
  peakBefore: number;
  peakAfter: number;
  batterySOC: number;
}

interface PeakWeekEntry {
  timestamp: string;
  peakBefore: number;
  peakAfter: number;
}

interface CashflowEntry {
  year: number;
  revenue: number;
  opex: number;
  ebitda: number;
  investment: number;
  dpa: number;
  incentives: number;
  netCashflow: number;
  cumulative: number;
}

interface FinancialBreakdown {
  capexSolar: number;
  capexBattery: number;
  capexGross: number;
  potentialHQSolar: number;
  potentialHQBattery: number;
  cap40Percent: number;
  actualHQSolar: number;
  actualHQBattery: number;
  totalHQ: number;
  itcBasis: number;
  itcAmount: number;
  depreciableBasis: number;
  taxShield: number;
  equityInitial: number;
  batterySubY0: number;
  batterySubY1: number;
  capexNet: number;
}

interface FrontierPoint {
  id: string;
  type: 'solar' | 'battery' | 'hybrid';
  label: string;
  pvSizeKW: number;
  battEnergyKWh: number;
  battPowerKW: number;
  capexNet: number;
  npv25: number;
  isOptimal: boolean;
  irr25: number;
  simplePaybackYears: number;
  selfSufficiencyPercent: number;
  annualSavings: number;
  totalProductionKWh: number;
}

interface SolarSweepPoint {
  pvSizeKW: number;
  npv25: number;
  selfSufficiency: number;
  annualSavings: number;
}

interface BatterySweepPoint {
  battEnergyKWh: number;
  npv25: number;
  peakReduction: number;
  annualSavings: number;
}

interface SensitivityAnalysis {
  frontier: FrontierPoint[];
  solarSweep: SolarSweepPoint[];
  batterySweep: BatterySweepPoint[];
  optimalScenarioId: string;
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

function buildHourlyData(readings: Array<{ kWh: number | null; kW: number | null; timestamp: Date }>): {
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

function runHourlySimulation(
  hourlyData: Array<{ hour: number; month: number; consumption: number; peak: number }>,
  pvSizeKW: number,
  battEnergyKWh: number,
  battPowerKW: number,
  threshold: number,
  solarYieldFactor: number = 1.0,
  systemParams: SystemModelingParams = { inverterLoadRatio: 1.2, temperatureCoefficient: -0.004, wireLossPercent: 0.0, skipTempCorrection: false },
  yieldSource: 'google' | 'manual' | 'default' = 'default'
): {
  totalSelfConsumption: number;
  totalProductionKWh: number;
  totalExportedKWh: number;
  peakAfter: number;
  hourlyProfile: HourlyProfileEntry[];
  peakWeekData: PeakWeekEntry[];
  clippingLossKWh: number;
} {
  const hourlyProfile: HourlyProfileEntry[] = [];
  let soc = battEnergyKWh * 0.5;
  let totalSelfConsumption = 0;
  let totalProductionKWh = 0;
  let totalExportedKWh = 0;
  let peakAfter = 0;
  let maxPeakIndex = 0;
  let maxPeakValue = 0;
  let clippingLossKWh = 0;
  
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
    const season = 1 - 0.4 * Math.cos((month - 6) * 2 * Math.PI / 12);
    const isDaytime = hour >= 5 && hour <= 20;
    
    const BASELINE_CAPACITY_FACTOR = 0.645;
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
      }
      
      soc += battAction;
      peakFinal = Math.max(0, peak + (battAction < 0 ? battAction : 0));
    }
    
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
  
  return {
    totalSelfConsumption,
    totalProductionKWh,
    totalExportedKWh,
    peakAfter,
    hourlyProfile,
    peakWeekData,
    clippingLossKWh,
  };
}

function calculateNPV(cashflows: number[], rate: number, years: number): number {
  let npv = 0;
  for (let y = 0; y <= Math.min(years, cashflows.length - 1); y++) {
    npv += cashflows[y] / Math.pow(1 + rate, y);
  }
  return npv;
}

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

function calculateIRR(cashflows: number[]): number {
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

function runScenarioWithSizing(
  hourlyData: Array<{ hour: number; month: number; consumption: number; peak: number }>,
  pvSizeKW: number,
  battEnergyKWh: number,
  battPowerKW: number,
  peakKW: number,
  annualConsumptionKWh: number,
  assumptions: AnalysisAssumptions
): { 
  npv25: number; 
  npv10: number;
  npv20: number;
  capexNet: number; 
  irr25: number;
  irr10: number;
  irr20: number;
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
} {
  const h = assumptions;
  
  let effectiveYield: number;
  if (h.yieldSource === 'google') {
    const googleBaseYield = h.solarYieldKWhPerKWp || 1079;
    effectiveYield = googleBaseYield * (h.bifacialEnabled ? 1.15 : 1.0);
  } else {
    const baseYield = h.solarYieldKWhPerKWp || 1150;
    const orientationFactor = Math.max(0.6, Math.min(1.0, h.orientationFactor || 1.0));
    effectiveYield = baseYield * orientationFactor * (h.bifacialEnabled ? 1.15 : 1.0);
  }
  
  const yieldFactor = effectiveYield / 1150;
  const demandShavingSetpointKW = battPowerKW > 0 ? Math.round(peakKW * 0.90) : peakKW;
  
  const storedStrategy = (h as AnalysisAssumptions & { _yieldStrategy?: YieldStrategy })._yieldStrategy;
  const skipTempCorrection = storedStrategy 
    ? storedStrategy.skipTempCorrection 
    : (h.yieldSource === 'google' || h.yieldSource === 'manual');
  const scenarioYieldSource: 'google' | 'manual' | 'default' = (h.yieldSource === 'google' || h.yieldSource === 'manual') ? h.yieldSource : 'default';
  const systemParams: SystemModelingParams = {
    inverterLoadRatio: h.inverterLoadRatio || 1.2,
    temperatureCoefficient: h.temperatureCoefficient || -0.004,
    wireLossPercent: h.wireLossPercent ?? 0.0,
    skipTempCorrection,
  };
  
  const simResult = runHourlySimulation(hourlyData, pvSizeKW, battEnergyKWh, battPowerKW, demandShavingSetpointKW, yieldFactor, systemParams, scenarioYieldSource);
  
  const selfConsumptionKWh = simResult.totalSelfConsumption;
  const peakAfterKW = simResult.peakAfter;
  const annualDemandReductionKW = peakKW - peakAfterKW;
  const annualExportedKWh = simResult.totalExportedKWh;
  
  const annualCostBefore = annualConsumptionKWh * h.tariffEnergy + peakKW * h.tariffPower * 12;
  const energySavings = selfConsumptionKWh * h.tariffEnergy;
  const demandSavings = annualDemandReductionKW * h.tariffPower * 12;
  const annualSavings = energySavings + demandSavings;
  
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
      npv25: 0, npv10: 0, npv20: 0,
      capexNet: 0, 
      irr25: 0, irr10: 0, irr20: 0,
      incentivesHQ: 0, incentivesHQSolar: 0, incentivesHQBattery: 0, 
      incentivesFederal: 0, taxShield: 0, 
      cashflows: [],
      annualSavings: 0,
      simplePaybackYears: 0,
      totalProductionKWh: 0,
      selfSufficiencyPercent: 0,
      co2AvoidedTonnesPerYear: 0,
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
  const degradationRate = h.degradationRatePercent || 0.005;
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
  const irr25 = calculateIRR(cashflowValues.slice(0, 26));
  const irr20 = calculateIRR(cashflowValues.slice(0, 21));
  const irr10 = calculateIRR(cashflowValues.slice(0, 11));
  
  const cashflows = cashflowValues.map((netCashflow, index) => ({ year: index, netCashflow }));
  
  const totalProductionKWh = pvSizeKW * effectiveYield;
  const simplePaybackYears = annualSavings > 0 ? capexNet / annualSavings : 0;
  const selfSufficiencyPercent = annualConsumptionKWh > 0 
    ? (selfConsumptionKWh / annualConsumptionKWh) * 100 
    : 0;
  const co2AvoidedTonnesPerYear = (selfConsumptionKWh * 0.0005) / 1000;
  
  return { 
    npv25, npv10, npv20,
    capexNet, 
    irr25, irr10, irr20,
    incentivesHQ, incentivesHQSolar, incentivesHQBattery, 
    incentivesFederal, taxShield, 
    cashflows,
    annualSavings,
    simplePaybackYears,
    totalProductionKWh,
    selfSufficiencyPercent,
    co2AvoidedTonnesPerYear,
  };
}

function runSensitivityAnalysis(
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
    });
  }
  
  const solarSizes = [25, 50, 100, 150, 200, 300, 500, 750, 1000];
  for (const pvSize of solarSizes) {
    const result = runScenarioWithSizing(
      hourlyData, pvSize, 0, 0,
      peakKW, annualConsumptionKWh, assumptions
    );
    
    solarSweep.push({
      pvSizeKW: pvSize,
      npv25: result.npv25,
      selfSufficiency: result.selfSufficiencyPercent,
      annualSavings: result.annualSavings,
    });
    
    frontier.push({
      id: `solar-${pvSize}`,
      type: 'solar',
      label: `${pvSize}kW solar`,
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
    });
  }
  
  const batterySizes = [50, 100, 200, 300, 500];
  for (const battSize of batterySizes) {
    const battPower = Math.round(battSize / 2);
    const result = runScenarioWithSizing(
      hourlyData, 0, battSize, battPower,
      peakKW, annualConsumptionKWh, assumptions
    );
    
    const peakReduction = result.npv25 > 0 ? 10 : 5;
    
    batterySweep.push({
      battEnergyKWh: battSize,
      npv25: result.npv25,
      peakReduction,
      annualSavings: result.annualSavings,
    });
    
    frontier.push({
      id: `battery-${battSize}`,
      type: 'battery',
      label: `${battSize}kWh storage`,
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
    });
  }
  
  let bestNpv = -Infinity;
  let optimalScenarioId = 'current-config';
  for (const point of frontier) {
    if (point.npv25 > bestNpv) {
      bestNpv = point.npv25;
      optimalScenarioId = point.id;
    }
  }
  
  for (const point of frontier) {
    point.isOptimal = point.id === optimalScenarioId;
  }
  
  return {
    frontier,
    solarSweep,
    batterySweep,
    optimalScenarioId,
  };
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
  
  const usableRoofSqFt = h.roofAreaSqFt * h.roofUtilizationRatio;
  const maxPVFromRoof = usableRoofSqFt / 100;
  
  const storedYieldStrategy = (h as AnalysisAssumptions & { _yieldStrategy?: YieldStrategy })._yieldStrategy;
  let effectiveYield: number;
  
  if (storedYieldStrategy) {
    effectiveYield = storedYieldStrategy.effectiveYield;
  } else if (h.yieldSource === 'google') {
    const googleBaseYield = h.solarYieldKWhPerKWp || 1079;
    const bifacialMultiplier = h.bifacialEnabled === true ? 1.15 : 1.0;
    effectiveYield = googleBaseYield * bifacialMultiplier;
  } else {
    const baseYield = h.solarYieldKWhPerKWp || 1150;
    const orientationFactor = Math.max(0.6, Math.min(1.0, h.orientationFactor || 1.0));
    const bifacialMultiplier = h.bifacialEnabled === true ? 1.15 : 1.0;
    effectiveYield = baseYield * orientationFactor * bifacialMultiplier;
  }
  const targetPVSize = (annualConsumptionKWh / effectiveYield) * 1.2;
  
  const pvSizeKW = forcedSizing?.forcePvSize !== undefined 
    ? Math.round(forcedSizing.forcePvSize)
    : Math.min(Math.round(targetPVSize), Math.round(maxPVFromRoof));
  
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
    inverterLoadRatio: h.inverterLoadRatio || 1.2,
    temperatureCoefficient: h.temperatureCoefficient || -0.004,
    wireLossPercent: h.wireLossPercent ?? 0.0,
    skipTempCorrection,
  };
  
  const simResult = runHourlySimulation(hourlyData, pvSizeKW, battEnergyKWh, battPowerKW, demandShavingSetpointKW, yieldFactor, systemParams, currentYieldSource);
  
  const selfConsumptionKWh = simResult.totalSelfConsumption;
  const totalProductionKWh = simResult.totalProductionKWh;
  const totalExportedKWh = simResult.totalExportedKWh;
  const peakDemandKW = peakKW;
  const peakAfterKW = simResult.peakAfter;
  const annualDemandReductionKW = peakKW - peakAfterKW;
  const selfSufficiencyPercent = annualConsumptionKWh > 0 ? (selfConsumptionKWh / annualConsumptionKWh) * 100 : 0;
  
  const annualCostBefore = annualConsumptionKWh * h.tariffEnergy + peakKW * h.tariffPower * 12;
  const energySavings = selfConsumptionKWh * h.tariffEnergy;
  const demandSavings = annualDemandReductionKW * h.tariffPower * 12;
  const annualSavings = energySavings + demandSavings;
  const annualCostAfter = annualCostBefore - annualSavings;
  const savingsYear1 = annualSavings;
  
  const hqSurplusRate = h.hqSurplusCompensationRate ?? 0.0454;
  const annualSurplusRevenue = totalExportedKWh * hqSurplusRate;
  
  const baseSolarCostPerW = h.solarCostPerW ?? getTieredSolarCostPerW(pvSizeKW);
  const effectiveSolarCostPerW = h.bifacialEnabled 
    ? baseSolarCostPerW + (h.bifacialCostPremium || 0.10)
    : baseSolarCostPerW;
  const capexPV = pvSizeKW * 1000 * effectiveSolarCostPerW;
  const capexBattery = battEnergyKWh * h.batteryCapacityCost + battPowerKW * h.batteryPowerCost;
  const capexGross = capexPV + capexBattery;
  
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
  
  const batterySubY0 = incentivesHQBattery * 0.5;
  const batterySubY1 = incentivesHQBattery * 0.5;
  
  const itcBasis = capexGross - incentivesHQ;
  const incentivesFederal = itcBasis * 0.30;
  
  const capexNetAccounting = Math.max(0, capexGross - incentivesHQ - incentivesFederal);
  const taxShield = capexNetAccounting * h.taxRate * 0.90;
  
  const totalIncentives = incentivesHQ + incentivesFederal + taxShield;
  const capexNet = capexGross - totalIncentives;
  const equityInitial = capexGross - incentivesHQSolar - batterySubY0;
  
  const MAX_ANALYSIS_YEARS = 30;
  const cashflows: CashflowEntry[] = [];
  const opexBase = (capexPV * h.omSolarPercent) + (capexBattery * h.omBatteryPercent);
  let cumulative = -equityInitial;
  
  cashflows.push({
    year: 0,
    revenue: 0,
    opex: 0,
    ebitda: 0,
    investment: -equityInitial,
    dpa: 0,
    incentives: 0,
    netCashflow: -equityInitial,
    cumulative: cumulative,
  });
  
  const degradationRate = h.degradationRatePercent || 0.005;
  for (let y = 1; y <= MAX_ANALYSIS_YEARS; y++) {
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
      incentives = batterySubY1;
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
    
    const netCashflow = ebitda + investment + dpa + incentives;
    cumulative += netCashflow;
    
    cashflows.push({
      year: y,
      revenue,
      opex: -opex,
      ebitda,
      investment,
      dpa,
      incentives,
      netCashflow,
      cumulative,
    });
  }
  
  const cashflowValues = cashflows.map(c => c.netCashflow);
  
  const npv25 = calculateNPV(cashflowValues, h.discountRate, 25);
  const npv20 = calculateNPV(cashflowValues, h.discountRate, 20);
  const npv10 = calculateNPV(cashflowValues, h.discountRate, 10);
  const npv30 = calculateNPV(cashflowValues, h.discountRate, 30);
  
  const irr25 = calculateIRR(cashflowValues.slice(0, 26));
  const irr20 = calculateIRR(cashflowValues.slice(0, 21));
  const irr10 = calculateIRR(cashflowValues.slice(0, 11));
  const irr30 = calculateIRR(cashflowValues.slice(0, 31));
  
  let simplePaybackYears = h.analysisYears;
  for (let i = 1; i < Math.min(cashflows.length, 26); i++) {
    if (cashflows[i].cumulative >= 0) {
      simplePaybackYears = i;
      break;
    }
  }
  
  let totalProduction25 = 0;
  for (let y = 1; y <= 25; y++) {
    const degradationFactor = Math.pow(1 - degradationRate, y - 1);
    totalProduction25 += pvSizeKW * effectiveYield * degradationFactor;
  }
  const totalLifetimeCost25 = capexNet + (opexBase * 25);
  const lcoe = totalProduction25 > 0 ? totalLifetimeCost25 / totalProduction25 : 0;
  
  let totalProduction30 = 0;
  for (let y = 1; y <= 30; y++) {
    const degradationFactor = Math.pow(1 - degradationRate, y - 1);
    totalProduction30 += pvSizeKW * effectiveYield * degradationFactor;
  }
  const totalLifetimeCost30 = capexNet + (opexBase * 30);
  const lcoe30 = totalProduction30 > 0 ? totalLifetimeCost30 / totalProduction30 : 0;
  
  const co2Factor = 0.002;
  const co2AvoidedTonnesPerYear = (selfConsumptionKWh * co2Factor) / 1000;
  
  const breakdown: FinancialBreakdown = {
    capexSolar: capexPV,
    capexBattery: capexBattery,
    capexGross: capexGross,
    potentialHQSolar: potentialHQSolar,
    potentialHQBattery: potentialHQBattery,
    cap40Percent: cap40Percent,
    actualHQSolar: incentivesHQSolar,
    actualHQBattery: incentivesHQBattery,
    totalHQ: incentivesHQ,
    itcBasis: itcBasis,
    itcAmount: incentivesFederal,
    depreciableBasis: capexNetAccounting,
    taxShield: taxShield,
    equityInitial: equityInitial,
    batterySubY0: batterySubY0,
    batterySubY1: batterySubY1,
    capexNet: capexNet,
  };
  
  const sensitivity = runSensitivityAnalysis(
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
  };
}
