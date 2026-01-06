/**
 * Unified Solar Potential Analysis Module
 * 
 * This is the SINGLE source of truth for all solar + storage analysis logic.
 * All yield handling, temperature correction, and simulation code lives here.
 * 
 * Key Design Principles:
 * 1. yieldSource is determined ONCE and propagates through all calculations
 * 2. skipTempCorrection is derived directly from yieldSource (never calculated independently)
 * 3. All simulation calls go through runSolarBatterySimulation()
 * 4. Financial calculations use consistent assumptions throughout
 */

import type { AnalysisAssumptions } from "@shared/schema";

// ==================== TIERED PRICING ====================

/**
 * Calculate tiered solar cost per watt based on system size
 * Larger systems get better pricing due to economies of scale
 * 
 * Pricing tiers (Quebec market, 2025):
 * - < 100 kW:      $2.30/W (small commercial)
 * - 100-500 kW:    $2.15/W (medium commercial)
 * - 500 kW - 1 MW: $2.00/W (large commercial)
 * - 1-3 MW:        $1.85/W (industrial)
 * - 3 MW+:         $1.70/W (utility-scale)
 */
export function getTieredSolarCostPerW(pvSizeKW: number): number {
  if (pvSizeKW >= 3000) return 1.70;      // 3 MW+
  if (pvSizeKW >= 1000) return 1.85;      // 1-3 MW
  if (pvSizeKW >= 500)  return 2.00;      // 500 kW - 1 MW
  if (pvSizeKW >= 100)  return 2.15;      // 100-500 kW
  return 2.30;                             // < 100 kW
}

/**
 * Get tier label for display purposes
 */
export function getSolarPricingTierLabel(pvSizeKW: number, lang: 'fr' | 'en' = 'fr'): string {
  const price = getTieredSolarCostPerW(pvSizeKW);
  const tierLabels: Record<number, { fr: string; en: string }> = {
    1.70: { fr: 'Tier 1 (3 MW+)', en: 'Tier 1 (3 MW+)' },
    1.85: { fr: 'Tier 2 (1-3 MW)', en: 'Tier 2 (1-3 MW)' },
    2.00: { fr: 'Tier 3 (500 kW-1 MW)', en: 'Tier 3 (500 kW-1 MW)' },
    2.15: { fr: 'Tier 4 (100-500 kW)', en: 'Tier 4 (100-500 kW)' },
    2.30: { fr: 'Tier 5 (<100 kW)', en: 'Tier 5 (<100 kW)' },
  };
  return tierLabels[price]?.[lang] || `$${price.toFixed(2)}/W`;
}

// ==================== TYPES ====================

export interface AnalysisMeterReading {
  timestamp: Date;
  kWh: number | null;
  kW: number | null;
  granularity?: string;
}

export interface HourlyDataPoint {
  hour: number;
  month: number;
  consumption: number;
  peak: number;
}

export interface YieldStrategy {
  effectiveYield: number;        // Final yield in kWh/kWp (after bifacial, orientation)
  yieldSource: 'google' | 'manual' | 'default';
  skipTempCorrection: boolean;   // ALWAYS derived from yieldSource
  baseYield: number;             // Base yield before adjustments
  bifacialBoost: number;         // Multiplier (1.0 = no boost, 1.15 = 15% boost)
  orientationFactor: number;
  yieldFactor: number;           // Relative to baseline 1150 kWh/kWp
}

export interface SimulationParams {
  pvSizeKW: number;
  battEnergyKWh: number;
  battPowerKW: number;
  demandShavingSetpointKW: number;
  yieldFactor: number;
  systemParams: SystemModelingParams;
}

export interface SystemModelingParams {
  inverterLoadRatio: number;
  temperatureCoefficient: number;
  wireLossPercent: number;
  skipTempCorrection: boolean;
}

export interface SimulationResult {
  totalSelfConsumption: number;
  totalProduction: number;
  totalExportedKWh: number;
  peakAfter: number;
  peakBefore: number;
  clippingLossKWh: number;
  hourlyProfile: Array<{
    hour: number;
    month: number;
    consumption: number;
    production: number;
    peak: number;
    batterySOC: number;
    peakBefore: number;
    peakAfter: number;
  }>;
  peakWeekData: Array<{
    timestamp: string;
    peakBefore: number;
    peakAfter: number;
  }>;
}

// ==================== CONSTANTS ====================

// Quebec monthly average temperatures (°C) for temperature correction
export const QUEBEC_MONTHLY_TEMPS = [
  -10.5, -9.2, -2.8, 5.7, 13.1, 18.2, 21.0, 19.8, 14.8, 8.2, 1.4, -7.0
];

// Baseline yield for normalization (kWh/kWp/year)
export const BASELINE_YIELD = 1150;

// Fixed bifacial boost (15%)
export const BIFACIAL_BOOST = 1.15;

// ==================== YIELD STRATEGY RESOLVER ====================

/**
 * Resolves the yield strategy based on assumptions and Google data
 * This is the SINGLE source of truth for yieldSource and skipTempCorrection
 */
export function resolveYieldStrategy(
  assumptions: Partial<AnalysisAssumptions>,
  googleData?: {
    googleProductionEstimate?: {
      yearlyEnergyAcKwh: number;
      systemSizeKw: number;
    };
    maxSunshineHoursPerYear?: number;
  }
): YieldStrategy {
  let baseYield = assumptions.solarYieldKWhPerKWp || BASELINE_YIELD;
  let yieldSource: 'google' | 'manual' | 'default' = 'default';
  
  // Check if user explicitly wants manual override
  const useManualYield = (assumptions as any).useManualYield === true;
  
  // PRIORITY 0: If stored yieldSource is already 'google', respect it
  // This prevents losing Google source when data isn't re-passed
  if (assumptions.yieldSource === 'google' && !useManualYield) {
    yieldSource = 'google';
    // Use stored yield if available, otherwise keep default
    if (assumptions.solarYieldKWhPerKWp) {
      baseYield = assumptions.solarYieldKWhPerKWp;
    }
  }
  // PRIORITY 1: Fresh Google Solar production estimate (most accurate)
  else if (googleData?.googleProductionEstimate && 
      googleData.googleProductionEstimate.yearlyEnergyAcKwh > 0 && 
      googleData.googleProductionEstimate.systemSizeKw > 0 &&
      !useManualYield) {
    baseYield = Math.round(
      googleData.googleProductionEstimate.yearlyEnergyAcKwh / 
      googleData.googleProductionEstimate.systemSizeKw
    );
    yieldSource = 'google';
  }
  // PRIORITY 2: Google sunshine hours fallback
  else if (googleData?.maxSunshineHoursPerYear && !useManualYield) {
    baseYield = Math.round(googleData.maxSunshineHoursPerYear * 0.85);
    yieldSource = 'google';
  }
  // PRIORITY 3: Manual yield override (explicit flag OR custom yield value)
  else if (useManualYield) {
    yieldSource = 'manual';
  }
  // PRIORITY 4: Stored manual yieldSource
  else if (assumptions.yieldSource === 'manual') {
    yieldSource = 'manual';
  }
  // PRIORITY 5: Non-default yield value implies manual
  else if (assumptions.solarYieldKWhPerKWp && assumptions.solarYieldKWhPerKWp !== BASELINE_YIELD) {
    yieldSource = 'manual';
  }
  // Default: use baseline
  else {
    yieldSource = 'default';
  }
  
  // Bifacial boost (fixed 15%)
  // DEBUG: Log raw value and type to diagnose incorrect bifacial boost
  console.log(`[resolveYieldStrategy] assumptions.bifacialEnabled = ${assumptions.bifacialEnabled} (type: ${typeof assumptions.bifacialEnabled})`);
  const bifacialBoost = assumptions.bifacialEnabled === true ? BIFACIAL_BOOST : 1.0;
  
  // Orientation factor - ONLY apply for default yield
  // Google yield already accounts for roof orientation and shading
  // Manual yield is assumed to be pre-adjusted by analyst
  // Clamp to [0.6, 1.0] - it's a derating factor, never a boost
  const rawOrientationFactor = assumptions.orientationFactor || 1.0;
  const clampedOrientationFactor = Math.max(0.6, Math.min(1.0, rawOrientationFactor));
  const orientationFactor = yieldSource === 'google' ? 1.0 : clampedOrientationFactor;
  
  // Calculate effective yield
  const effectiveYield = baseYield * bifacialBoost * orientationFactor;
  
  // CRITICAL: skipTempCorrection is ALWAYS derived from yieldSource
  // Google yield already includes weather/temperature effects
  // Manual yield is assumed to be pre-adjusted by the analyst
  // Only default (1150) needs temperature correction
  const skipTempCorrection = yieldSource === 'google' || yieldSource === 'manual';
  
  // Calculate yield factor relative to baseline
  const yieldFactor = effectiveYield / BASELINE_YIELD;
  
  return {
    effectiveYield,
    yieldSource,
    skipTempCorrection,
    baseYield,
    bifacialBoost,
    orientationFactor,
    yieldFactor,
  };
}

// ==================== HOURLY SIMULATION ====================

/**
 * Run hourly solar + battery simulation
 * This is the SINGLE entry point for all hourly simulations
 */
export function runSolarBatterySimulation(
  hourlyData: HourlyDataPoint[],
  params: SimulationParams
): SimulationResult {
  const { pvSizeKW, battEnergyKWh, battPowerKW, demandShavingSetpointKW, yieldFactor, systemParams } = params;
  
  // Calculate inverter AC capacity for clipping
  const inverterACCapacityKW = pvSizeKW / systemParams.inverterLoadRatio;
  
  // Battery state
  let soc = battEnergyKWh; // Start full
  const threshold = demandShavingSetpointKW;
  
  // Track totals
  let totalSelfConsumption = 0;
  let totalProduction = 0;
  let totalExported = 0;
  let peakBefore = 0;
  let peakAfter = 0;
  let clippingLossKWh = 0;
  
  const hourlyProfile: SimulationResult['hourlyProfile'] = [];
  const peakWeekData: SimulationResult['peakWeekData'] = [];
  
  // Pre-calculate daily peak hours for smart battery dispatch
  const dailyPeakHours = new Map<string, { index: number; peak: number }>();
  for (let i = 0; i < hourlyData.length; i++) {
    const { month, peak } = hourlyData[i];
    const dayIndex = Math.floor(i / 24);
    const dayKey = `${month}-${dayIndex}`;
    const existing = dailyPeakHours.get(dayKey);
    if (!existing || peak > existing.peak) {
      dailyPeakHours.set(dayKey, { index: i, peak });
    }
  }
  
  // Priority peak indices
  const priorityPeakIndices = new Set<number>();
  dailyPeakHours.forEach((dayPeak) => {
    if (dayPeak.peak > threshold) {
      priorityPeakIndices.add(dayPeak.index);
    }
  });
  
  for (let i = 0; i < hourlyData.length; i++) {
    const { hour, month, consumption, peak } = hourlyData[i];
    
    // Solar production: Gaussian curve centered at 1pm, with seasonal factor
    const bell = Math.exp(-Math.pow(hour - 13, 2) / 8);
    const season = 1 - 0.4 * Math.cos((month - 6) * 2 * Math.PI / 12);
    const isDaytime = hour >= 5 && hour <= 20;
    
    // Base DC production
    let dcProduction = pvSizeKW * bell * season * 0.75 * yieldFactor * (isDaytime ? 1 : 0);
    
    // Apply temperature correction ONLY when NOT using Google/manual yield
    // CRITICAL: This is the key fix - skipTempCorrection comes from yieldSource
    if (!systemParams.skipTempCorrection) {
      const ambientTemp = QUEBEC_MONTHLY_TEMPS[month - 1] || 10;
      const cellTempRise = 25 * bell; // Max 25°C rise at peak production
      const cellTemp = ambientTemp + cellTempRise;
      const stcCellTemp = 25; // STC reference
      const tempCorrectionFactor = 1 + systemParams.temperatureCoefficient * (cellTemp - stcCellTemp);
      dcProduction *= tempCorrectionFactor;
    }
    
    // Apply wire losses
    dcProduction *= (1 - systemParams.wireLossPercent);
    
    // Apply ILR clipping
    let acProduction = dcProduction;
    if (dcProduction > inverterACCapacityKW) {
      clippingLossKWh += (dcProduction - inverterACCapacityKW);
      acProduction = inverterACCapacityKW;
    }
    
    const production = Math.max(0, acProduction);
    totalProduction += production;
    
    // Net load
    const net = consumption - production;
    
    // Battery logic
    let battAction = 0;
    const peakBeforeHour = peak;
    let peakFinalHour = peak;
    
    if (battPowerKW > 0 && battEnergyKWh > 0) {
      const isPriorityPeak = priorityPeakIndices.has(i);
      
      // Look-ahead logic
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
      }
      
      soc = Math.max(0, Math.min(battEnergyKWh, soc + battAction));
      peakFinalHour = battAction < 0 ? Math.max(0, peak + battAction) : peak;
    }
    
    // Self-consumption
    const selfConsumed = Math.min(production, consumption);
    totalSelfConsumption += selfConsumed;
    
    // Exported
    const exported = Math.max(0, production - consumption);
    totalExported += exported;
    
    // Track peaks
    peakBefore = Math.max(peakBefore, peakBeforeHour);
    peakAfter = Math.max(peakAfter, peakFinalHour);
    
    hourlyProfile.push({
      hour,
      month,
      consumption,
      production,
      peak: peakFinalHour,
      batterySOC: soc,
      peakBefore: peakBeforeHour,
      peakAfter: peakFinalHour,
    });
    
    // Track peak week (October - typically high demand)
    const octStartHour = 24 * 273; // Approx Oct 1
    if (i >= octStartHour && i < octStartHour + 24 * 7) {
      peakWeekData.push({
        timestamp: `Hour ${i}`,
        peakBefore: peakBeforeHour,
        peakAfter: peakFinalHour,
      });
    }
  }
  
  return {
    totalSelfConsumption,
    totalProduction,
    totalExportedKWh: totalExported,
    peakAfter,
    peakBefore,
    clippingLossKWh,
    hourlyProfile,
    peakWeekData,
  };
}

/**
 * Build system modeling parameters from assumptions and yield strategy
 */
export function buildSystemParams(
  assumptions: Partial<AnalysisAssumptions>,
  yieldStrategy: YieldStrategy
): SystemModelingParams {
  return {
    inverterLoadRatio: assumptions.inverterLoadRatio || 1.2,
    temperatureCoefficient: assumptions.temperatureCoefficient || -0.004,
    wireLossPercent: assumptions.wireLossPercent ?? 0.0,
    skipTempCorrection: yieldStrategy.skipTempCorrection,
  };
}

/**
 * Calculate simulation params from assumptions and sizing
 */
export function buildSimulationParams(
  assumptions: Partial<AnalysisAssumptions>,
  yieldStrategy: YieldStrategy,
  sizing: { pvSizeKW: number; battEnergyKWh: number; battPowerKW: number },
  peakKW: number
): SimulationParams {
  return {
    pvSizeKW: sizing.pvSizeKW,
    battEnergyKWh: sizing.battEnergyKWh,
    battPowerKW: sizing.battPowerKW,
    demandShavingSetpointKW: sizing.battPowerKW > 0 ? Math.round(peakKW * 0.90) : peakKW,
    yieldFactor: yieldStrategy.yieldFactor,
    systemParams: buildSystemParams(assumptions, yieldStrategy),
  };
}
