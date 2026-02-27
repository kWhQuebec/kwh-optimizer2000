/**
 * Hydro-Québec Rate Service — Official tariffs for solar savings calculations
 * 
 * Contains the 2025 HQ rate schedules for D, M, G, and DP tariffs.
 * Updated annually when Régie de l'énergie publishes new rates (typically April 1).
 * 
 * Source: Hydro-Québec — Tarifs et conditions de service
 * Last verified: 2025-04-01
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type HQRateCode = 'D' | 'M' | 'G' | 'DP';

interface RateBlock {
  /** kWh threshold for this block (null = unlimited) */
  upToKWh: number | null;
  /** Energy rate in ¢/kWh */
  energyRate: number;
}

interface DemandCharge {
  /** $/kW/month for demand above minimum */
  ratePerKW: number;
  /** Minimum billable demand in kW */
  minimumKW: number;
}

export interface HQRate {
  code: HQRateCode;
  name: string;
  nameFr: string;
  description: string;
  descriptionFr: string;
  /** Monthly fixed charge in $/month */
  fixedCharge: number;
  /** Energy blocks (ascending thresholds) */
  energyBlocks: RateBlock[];
  /** Demand charge (null for residential) */
  demandCharge: DemandCharge | null;
  /** Typical customer profile */
  typicalLoadKW: { min: number; max: number };
  /** Annual escalation assumption (historical avg) */
  annualEscalation: number;
  /** Effective date of these rates */
  effectiveDate: string;
}

// ─── 2025 Rate Schedules ─────────────────────────────────────────────────────
// Source: Hydro-Québec tarifs en vigueur au 1er avril 2025
// NOTE: Update these annually when new rates are published

export const HQ_RATES: Record<HQRateCode, HQRate> = {
  D: {
    code: 'D',
    name: 'Domestic',
    nameFr: 'Domestique',
    description: 'Residential rate — two-block declining structure',
    descriptionFr: 'Tarif résidentiel — structure à deux paliers décroissants',
    fixedCharge: 14.48,
    energyBlocks: [
      { upToKWh: 40 * 30, energyRate: 7.59 },  // First 40 kWh/day (~1200/month)
      { upToKWh: null, energyRate: 11.40 },      // Excess
    ],
    demandCharge: null,
    typicalLoadKW: { min: 0, max: 50 },
    annualEscalation: 0.03,
    effectiveDate: '2025-04-01',
  },

  M: {
    code: 'M',
    name: 'General — Small Power',
    nameFr: 'Général — Petite puissance',
    description: 'Commercial/institutional <100 kW demand',
    descriptionFr: 'Commercial/institutionnel <100 kW de puissance',
    fixedCharge: 14.48,
    energyBlocks: [
      { upToKWh: 15060, energyRate: 7.59 },     // First block
      { upToKWh: null, energyRate: 5.91 },        // Excess
    ],
    demandCharge: {
      ratePerKW: 18.89,
      minimumKW: 0,
    },
    typicalLoadKW: { min: 0, max: 100 },
    annualEscalation: 0.03,
    effectiveDate: '2025-04-01',
  },

  G: {
    code: 'G',
    name: 'General — Medium Power',
    nameFr: 'Général — Moyenne puissance',
    description: 'Commercial/industrial 100–5000 kW demand',
    descriptionFr: 'Commercial/industriel 100–5000 kW de puissance',
    fixedCharge: 14.48,
    energyBlocks: [
      { upToKWh: 210000, energyRate: 5.36 },    // First block
      { upToKWh: null, energyRate: 4.43 },        // Excess
    ],
    demandCharge: {
      ratePerKW: 17.39,
      minimumKW: 100,
    },
    typicalLoadKW: { min: 100, max: 5000 },
    annualEscalation: 0.03,
    effectiveDate: '2025-04-01',
  },

  DP: {
    code: 'DP',
    name: 'Large Power',
    nameFr: 'Grande puissance',
    description: 'Industrial >5000 kW demand — negotiated contract',
    descriptionFr: 'Industriel >5000 kW — contrat négocié',
    fixedCharge: 0,
    energyBlocks: [
      { upToKWh: null, energyRate: 3.68 },       // Flat rate (simplified)
    ],
    demandCharge: {
      ratePerKW: 14.77,
      minimumKW: 5000,
    },
    typicalLoadKW: { min: 5000, max: 500000 },
    annualEscalation: 0.025,
    effectiveDate: '2025-04-01',
  },
};

// ─── Calculation Functions ───────────────────────────────────────────────────

/**
 * Calculate monthly electricity cost for a given consumption and rate
 */
export function calculateMonthlyCost(
  consumptionKWh: number,
  rateCode: HQRateCode,
  peakDemandKW?: number
): {
  fixedCost: number;
  energyCost: number;
  demandCost: number;
  totalCost: number;
  effectiveRate: number;
} {
  const rate = HQ_RATES[rateCode];
  if (!rate) throw new Error(`Unknown rate code: ${rateCode}`);

  // Fixed charge
  const fixedCost = rate.fixedCharge;

  // Energy charge (block calculation)
  let energyCost = 0;
  let remainingKWh = consumptionKWh;

  for (const block of rate.energyBlocks) {
    if (remainingKWh <= 0) break;

    const blockKWh = block.upToKWh
      ? Math.min(remainingKWh, block.upToKWh)
      : remainingKWh;

    energyCost += blockKWh * (block.energyRate / 100); // Convert ¢ to $
    remainingKWh -= blockKWh;
  }

  // Demand charge
  let demandCost = 0;
  if (rate.demandCharge && peakDemandKW) {
    const billableDemand = Math.max(peakDemandKW - rate.demandCharge.minimumKW, 0);
    demandCost = billableDemand * rate.demandCharge.ratePerKW;
  }

  const totalCost = fixedCost + energyCost + demandCost;
  const effectiveRate = consumptionKWh > 0 ? totalCost / consumptionKWh : 0;

  return { fixedCost, energyCost, demandCost, totalCost, effectiveRate };
}

/**
 * Estimate annual savings from solar production at a given rate
 */
export function estimateAnnualSavings(
  annualSolarProductionKWh: number,
  rateCode: HQRateCode,
  annualConsumptionKWh: number,
  peakDemandKW?: number
): {
  annualSavings: number;
  monthlySavingsAvg: number;
  savingsPercent: number;
  effectiveValuePerKWh: number;
} {
  // Monthly averages
  const monthlyConsumption = annualConsumptionKWh / 12;
  const monthlySolar = annualSolarProductionKWh / 12;

  // Cost without solar
  const costWithout = calculateMonthlyCost(monthlyConsumption, rateCode, peakDemandKW);

  // Cost with solar (net metering — solar offsets consumption)
  const netConsumption = Math.max(monthlyConsumption - monthlySolar, 0);
  const costWith = calculateMonthlyCost(netConsumption, rateCode, peakDemandKW);

  const monthlySavingsAvg = costWithout.totalCost - costWith.totalCost;
  const annualSavings = monthlySavingsAvg * 12;
  const savingsPercent = costWithout.totalCost > 0
    ? (monthlySavingsAvg / costWithout.totalCost) * 100
    : 0;
  const effectiveValuePerKWh = annualSolarProductionKWh > 0
    ? annualSavings / annualSolarProductionKWh
    : 0;

  return { annualSavings, monthlySavingsAvg, savingsPercent, effectiveValuePerKWh };
}

/**
 * Auto-detect the most likely rate code based on monthly consumption
 */
export function detectRateCode(monthlyConsumptionKWh: number, peakDemandKW?: number): HQRateCode {
  if (peakDemandKW) {
    if (peakDemandKW >= 5000) return 'DP';
    if (peakDemandKW >= 100) return 'G';
    if (peakDemandKW > 50) return 'M';
    return 'D';
  }

  // Estimate based on consumption alone
  if (monthlyConsumptionKWh > 500000) return 'DP';
  if (monthlyConsumptionKWh > 50000) return 'G';
  if (monthlyConsumptionKWh > 3000) return 'M';
  return 'D';
}

/**
 * Get all available rates (for UI dropdowns)
 */
export function getAllRates(): Array<{
  code: HQRateCode;
  name: string;
  nameFr: string;
  description: string;
  descriptionFr: string;
  typicalLoadKW: { min: number; max: number };
}> {
  return Object.values(HQ_RATES).map((rate) => ({
    code: rate.code,
    name: rate.name,
    nameFr: rate.nameFr,
    description: rate.description,
    descriptionFr: rate.descriptionFr,
    typicalLoadKW: rate.typicalLoadKW,
  }));
}

/**
 * Project future rates based on escalation
 */
export function projectFutureRate(
  rateCode: HQRateCode,
  yearsAhead: number
): { projectedEnergyRate: number; projectedMonthlyCost: number; escalation: number } {
  const rate = HQ_RATES[rateCode];
  if (!rate) throw new Error(`Unknown rate code: ${rateCode}`);

  const baseRate = rate.energyBlocks[0].energyRate;
  const escalation = rate.annualEscalation;
  const projectedEnergyRate = baseRate * Math.pow(1 + escalation, yearsAhead);

  // Estimate a typical monthly cost at 10,000 kWh (commercial baseline)
  const typicalKWh = 10000;
  const currentCost = calculateMonthlyCost(typicalKWh, rateCode);
  const projectedMonthlyCost = currentCost.totalCost * Math.pow(1 + escalation, yearsAhead);

  return { projectedEnergyRate, projectedMonthlyCost, escalation };
}
