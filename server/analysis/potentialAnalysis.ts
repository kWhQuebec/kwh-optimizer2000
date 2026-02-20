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

import type { AnalysisAssumptions, BifacialConfig } from "@shared/schema";
import { getBifacialConfigFromRoofColor, type RoofColorType } from "@shared/schema";
import { createLogger } from "../lib/logger";

const log = createLogger("PotentialAnalysis");

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
  bifacialConfig: BifacialConfig; // Full bifacial configuration with reason
  orientationFactor: number;
  yieldFactor: number;           // Relative to baseline 1150 kWp
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
  lidLossPercent: number;
  mismatchLossPercent: number;
  mismatchStringsLossPercent: number;
  moduleQualityGainPercent: number;
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

// Legacy constant for backward compatibility
export const BIFACIAL_BOOST = 1.15;

// Re-export from shared for backward compatibility
export { getBifacialConfigFromRoofColor, type RoofColorType, type BifacialConfig } from "@shared/schema";

// ==================== YIELD STRATEGY RESOLVER ====================

/**
 * Resolves the yield strategy based on assumptions and Google data
 * This is the SINGLE source of truth for yieldSource and skipTempCorrection
 * 
 * @param assumptions - Analysis assumptions including bifacialEnabled override
 * @param googleData - Optional Google Solar API data
 * @param roofColorType - Optional roof color type for automatic bifacial recommendation
 */
export function resolveYieldStrategy(
  assumptions: Partial<AnalysisAssumptions>,
  googleData?: {
    googleProductionEstimate?: {
      yearlyEnergyAcKwh: number;
      systemSizeKw: number;
    };
    maxSunshineHoursPerYear?: number;
  },
  roofColorType?: RoofColorType | null
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
  // Use 1.0 factor — maxSunshineHoursPerYear already represents peak sun hours (kWh/m²/year ÷ 1kW/m²)
  // which directly equals kWh/kWp before system losses. All derate losses (wire, LID, mismatch,
  // temperature, clipping) are applied later in runHourlySimulation(), not here.
  else if (googleData?.maxSunshineHoursPerYear && !useManualYield) {
    baseYield = Math.round(googleData.maxSunshineHoursPerYear);
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
  
  // Bifacial boost - based on roof color analysis
  // Priority 1: Manual override via bifacialEnabled
  // Priority 2: Automatic recommendation based on roof color
  let bifacialConfig: BifacialConfig;
  
  if (assumptions.bifacialEnabled === true) {
    // User explicitly enabled bifacial - use maximum boost
    bifacialConfig = {
      boost: BIFACIAL_BOOST,
      boostPercent: 15,
      albedo: 0.70,
      recommended: true,
      reason: {
        fr: 'Bifacial activé manuellement (+15%)',
        en: 'Bifacial manually enabled (+15%)'
      }
    };
  } else if (assumptions.bifacialEnabled === false) {
    // User explicitly disabled bifacial
    bifacialConfig = {
      boost: 1.0,
      boostPercent: 0,
      albedo: 0.20,
      recommended: false,
      reason: {
        fr: 'Bifacial désactivé manuellement',
        en: 'Bifacial manually disabled'
      }
    };
  } else {
    // Automatic: determine based on roof color
    bifacialConfig = getBifacialConfigFromRoofColor(roofColorType);
  }
  
  const bifacialBoost = bifacialConfig.boost;
  log.info(`roofColorType=${roofColorType}, bifacialBoost=${bifacialBoost}, reason=${bifacialConfig.reason.en}`);
  
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
    bifacialConfig,
    orientationFactor,
    yieldFactor,
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
    inverterLoadRatio: assumptions.inverterLoadRatio || 1.45,
    temperatureCoefficient: assumptions.temperatureCoefficient || -0.004,
    wireLossPercent: assumptions.wireLossPercent ?? 0.03,
    skipTempCorrection: yieldStrategy.skipTempCorrection,
    lidLossPercent: assumptions.lidLossPercent ?? 0.01,
    mismatchLossPercent: assumptions.mismatchLossPercent ?? 0.02,
    mismatchStringsLossPercent: assumptions.mismatchStringsLossPercent ?? 0.0015,
    moduleQualityGainPercent: assumptions.moduleQualityGainPercent ?? 0.0075,
  };
}

