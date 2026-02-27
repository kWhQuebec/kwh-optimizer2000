/**
 * Synthetic Profile Generator
 *
 * Generates 8760 hourly data points (kWh + kW) from building archetype parameters.
 * Used when a site has no real Hydro-Québec CSV data, enabling the full analysis pipeline
 * to run on estimated consumption profiles.
 */

import {
  type BuildingTypeKey,
  getArchetypeParams,
  getMonthlyFactors,
  getBuildingTypeByKey,
} from '@shared/buildingTypes';

const SCHEDULE_OVERRIDES: Record<string, { operatingStart: number; operatingEnd: number }> = {
  extended: { operatingStart: 5, operatingEnd: 23 },
  '24/7':  { operatingStart: 0, operatingEnd: 24 },
};

export type BuildingSubType = BuildingTypeKey;
export type OperatingSchedule = 'standard' | 'extended' | '24/7';

export interface SyntheticProfileParams {
  buildingSubType: BuildingSubType;
  annualConsumptionKWh: number;
  operatingSchedule?: OperatingSchedule;
}

export interface SyntheticReading {
  timestamp: Date;
  kWh: number;
  kW: number;
}

export interface SyntheticProfileResult {
  readings: SyntheticReading[];
  metadata: {
    buildingSubType: string;
    annualConsumptionKWh: number;
    estimatedPeakKW: number;
    loadFactor: number;
  };
}

/**
 * Compute a Gaussian-like hourly weight for a given hour of day.
 * Center is the midpoint of operating hours, sigma controls spread.
 */
function hourlyWeight(hour: number, opStart: number, opEnd: number, baseNight: number): number {
  // For 24/7 operations, return 1.0 (flat) blended with baseNight
  if (opStart === 0 && opEnd === 24) {
    return baseNight + (1 - baseNight) * 0.8; // Slight variation but mostly flat
  }

  const center = (opStart + opEnd) / 2;
  const halfWidth = (opEnd - opStart) / 2;
  // Sigma = halfWidth / 2 gives a nice bell curve within operating hours
  const sigma = halfWidth / 2;

  if (hour >= opStart && hour < opEnd) {
    // Operating hours: Gaussian curve
    const x = hour - center;
    const gauss = Math.exp(-(x * x) / (2 * sigma * sigma));
    // Scale between baseNight and 1.0
    return baseNight + (1 - baseNight) * gauss;
  }
  // Off-hours: base nighttime load
  return baseNight;
}

/**
 * Generate a synthetic 8760-point hourly consumption profile.
 *
 * Algorithm:
 * 1. For each hour of the year (8760 total for a non-leap year):
 *    - Apply monthly shape factor from MONTHLY_FACTORS
 *    - Apply hourly Gaussian weight based on operating schedule
 *    - Apply weekend reduction factor for Sat/Sun
 * 2. Normalize so the sum equals annualConsumptionKWh
 * 3. Derive peak kW from load factor
 */
export function generateSyntheticProfile(params: SyntheticProfileParams): SyntheticProfileResult {
  const { buildingSubType, annualConsumptionKWh, operatingSchedule = 'standard' } = params;

  const archetype = getArchetypeParams(buildingSubType);
  const monthly = getMonthlyFactors(buildingSubType);

  // Apply schedule override if not standard
  let opStart = archetype.operatingStart;
  let opEnd = archetype.operatingEnd;
  if (operatingSchedule !== 'standard' && SCHEDULE_OVERRIDES[operatingSchedule]) {
    opStart = SCHEDULE_OVERRIDES[operatingSchedule].operatingStart;
    opEnd = SCHEDULE_OVERRIDES[operatingSchedule].operatingEnd;
  }

  // Use a reference non-leap year (2024 is leap, use 2023)
  const year = 2023;
  const rawReadings: Array<{ timestamp: Date; rawWeight: number }> = [];
  let totalRawWeight = 0;

  for (let month = 0; month < 12; month++) {
    const monthFactor = monthly[month];
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const weekendMult = isWeekend ? archetype.weekendFactor : 1.0;

      for (let hour = 0; hour < 24; hour++) {
        const timestamp = new Date(year, month, day, hour);
        const hWeight = hourlyWeight(hour, opStart, opEnd, archetype.baseNight);
        const rawWeight = monthFactor * hWeight * weekendMult;

        rawReadings.push({ timestamp, rawWeight });
        totalRawWeight += rawWeight;
      }
    }
  }

  // Normalize: scale so sum(kWh) = annualConsumptionKWh
  const scaleFactor = annualConsumptionKWh / totalRawWeight;

  // Peak kW from load factor: avgKW = annual / 8760, peakKW = avgKW / loadFactor
  const avgKW = annualConsumptionKWh / 8760;
  const peakKW = avgKW / archetype.loadFactor;

  const readings: SyntheticReading[] = rawReadings.map(r => {
    const kWh = r.rawWeight * scaleFactor;
    // kW = kWh for 1-hour intervals, but cap at peak and add realistic variation
    const kW = Math.min(kWh, peakKW);
    return {
      timestamp: r.timestamp,
      kWh: Math.round(kWh * 100) / 100,
      kW: Math.round(kW * 100) / 100,
    };
  });

  return {
    readings,
    metadata: {
      buildingSubType,
      annualConsumptionKWh,
      estimatedPeakKW: Math.round(peakKW * 10) / 10,
      loadFactor: archetype.loadFactor,
    },
  };
}

// Hydro-Québec energy rates ($/kWh) — energy portion only
const HQ_ENERGY_RATES: Record<string, number> = {
  G: 0.11933,
  M: 0.06061,
  L: 0.03681,
};

/**
 * Estimate annual consumption in kWh from limited information.
 * Priority: monthly bill > building area > fallback default.
 */
export function estimateAnnualConsumption(params: {
  monthlyBill?: number;
  tariffCode?: 'G' | 'M' | 'L';
  buildingSqFt?: number;
  buildingSubType: string;
}): number {
  const { monthlyBill, tariffCode, buildingSqFt, buildingSubType } = params;

  // Priority 1: From monthly bill
  if (monthlyBill && monthlyBill > 0) {
    const rate = HQ_ENERGY_RATES[tariffCode || 'M'] || 0.06061;
    // ~70% of bill is energy charges, rest is demand + fixed
    const monthlyKWh = (monthlyBill * 0.7) / rate;
    return Math.round(monthlyKWh * 12);
  }

  // Priority 2: From building area
  if (buildingSqFt && buildingSqFt > 0) {
    const def = getBuildingTypeByKey(buildingSubType);
    const intensity = def.intensityKwhPerSqFt;
    return Math.round(buildingSqFt * intensity);
  }

  // Fallback: reasonable default for C&I
  return 200_000;
}
