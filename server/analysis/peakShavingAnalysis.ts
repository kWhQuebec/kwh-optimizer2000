/**
 * Module B: 15-Minute Peak Shaving Calculator for Quebec Tariffs
 * 
 * Analyzes 15-minute interval consumption data to identify demand peaks
 * that can be eliminated with battery storage, specifically targeting
 * Hydro-Quebec Rate M/G demand charges ("Puissance Appelée").
 * 
 * HQ bills commercial customers based on their highest 15-minute demand
 * reading each month. This module identifies those peaks and calculates
 * optimal battery sizing for demand charge reduction.
 */

export interface MeterReading {
  timestamp: Date;
  kWh: number | null;
  kW: number | null;
  granularity?: string;
}

export interface HourlySolarProduction {
  hour: number;
  month: number;
  productionKW: number;
}

export interface Peak {
  timestamp: Date;
  grossKW: number;
  solarKW: number;
  netKW: number;
  month: number;
  isMonthlyPeak: boolean;
}

export interface PeakShavingResult {
  top10Peaks: Peak[];
  monthlyPeaks: Peak[];
  currentAnnualDemandCharge: number;
  potentialDemandReduction: number;
  demandChargeSavings: number;
  recommendedBatteryPower: number;
  recommendedBatteryEnergy: number;
  peakDistribution: {
    month: number;
    peakKW: number;
    averagePeakKW: number;
    peakCount: number;
  }[];
  tariffDetails: {
    code: string;
    demandRate: number;
    energyRate: number;
  };
}

export interface PeakShavingConfig {
  tariffCode: 'G' | 'M' | 'L';
  targetReductionPercent?: number;
  minBatteryCoverage?: number;
  solarProductionProfile?: HourlySolarProduction[];
}

const HQ_DEMAND_RATES: Record<string, number> = {
  G: 0,
  M: 17.573,
  L: 14.521,
};

const HQ_ENERGY_RATES: Record<string, number> = {
  G: 0.11933,
  M: 0.06061,
  L: 0.03681,
};

function getMonthFromDate(date: Date): number {
  return date.getMonth() + 1;
}

function interpolateSolarProduction(
  profile: HourlySolarProduction[] | undefined,
  timestamp: Date
): number {
  if (!profile || profile.length === 0) return 0;
  
  const hour = timestamp.getHours();
  const month = getMonthFromDate(timestamp);
  
  const match = profile.find(p => p.hour === hour && p.month === month);
  if (match) return match.productionKW;
  
  const sameMonth = profile.filter(p => p.month === month);
  if (sameMonth.length === 0) return 0;
  
  const closest = sameMonth.reduce((prev, curr) => 
    Math.abs(curr.hour - hour) < Math.abs(prev.hour - hour) ? curr : prev
  );
  
  return closest.productionKW;
}

function groupByMonth<T extends { month: number }>(items: T[]): Map<number, T[]> {
  const groups = new Map<number, T[]>();
  for (const item of items) {
    const existing = groups.get(item.month) || [];
    existing.push(item);
    groups.set(item.month, existing);
  }
  return groups;
}

export function analyzePeakShaving(
  readings: MeterReading[],
  config: PeakShavingConfig
): PeakShavingResult {
  const { tariffCode, targetReductionPercent = 0.15, minBatteryCoverage = 0.5 } = config;
  
  const fifteenMinReadings = readings.filter(r => 
    r.granularity === 'FIFTEEN_MIN' && r.kW !== null && r.kW > 0
  );
  
  const allReadings = fifteenMinReadings.length > 0 
    ? fifteenMinReadings 
    : readings.filter(r => r.kW !== null && r.kW > 0);
  
  if (allReadings.length === 0) {
    return {
      top10Peaks: [],
      monthlyPeaks: [],
      currentAnnualDemandCharge: 0,
      potentialDemandReduction: 0,
      demandChargeSavings: 0,
      recommendedBatteryPower: 0,
      recommendedBatteryEnergy: 0,
      peakDistribution: [],
      tariffDetails: {
        code: tariffCode,
        demandRate: HQ_DEMAND_RATES[tariffCode] || 0,
        energyRate: HQ_ENERGY_RATES[tariffCode] || 0,
      },
    };
  }
  
  const netDemandData: Peak[] = allReadings.map(reading => {
    const solarKW = interpolateSolarProduction(
      config.solarProductionProfile, 
      reading.timestamp
    );
    const grossKW = reading.kW || 0;
    
    return {
      timestamp: reading.timestamp,
      grossKW,
      solarKW,
      netKW: Math.max(0, grossKW - solarKW),
      month: getMonthFromDate(reading.timestamp),
      isMonthlyPeak: false,
    };
  });
  
  const monthlyGroups = groupByMonth(netDemandData);
  const monthlyPeaks: Peak[] = [];
  
  Array.from(monthlyGroups.entries()).forEach(([_month, peaks]) => {
    if (peaks.length === 0) return;
    
    const maxPeak = peaks.reduce((max: Peak, p: Peak) => p.netKW > max.netKW ? p : max);
    maxPeak.isMonthlyPeak = true;
    monthlyPeaks.push(maxPeak);
  });
  
  const demandRate = HQ_DEMAND_RATES[tariffCode] || 0;
  const currentAnnualDemandCharge = monthlyPeaks.reduce(
    (sum, p) => sum + (p.netKW * demandRate), 
    0
  );
  
  const sortedPeaks = [...monthlyPeaks].sort((a, b) => b.netKW - a.netKW);
  const medianPeak = sortedPeaks[Math.floor(sortedPeaks.length / 2)]?.netKW || 0;
  const maxPeak = sortedPeaks[0]?.netKW || 0;
  
  const targetPeak = maxPeak * (1 - targetReductionPercent);
  const potentialDemandReduction = Math.max(0, maxPeak - targetPeak);
  
  const peaksAboveTarget = monthlyPeaks.filter(p => p.netKW > targetPeak);
  const demandChargeSavings = peaksAboveTarget.reduce(
    (sum, p) => sum + ((p.netKW - targetPeak) * demandRate),
    0
  );
  
  const recommendedBatteryPower = Math.ceil(potentialDemandReduction * 1.1);
  const recommendedBatteryEnergy = Math.ceil(recommendedBatteryPower * minBatteryCoverage);
  
  const peakDistribution = Array.from(monthlyGroups.entries()).map(([month, peaks]) => {
    const monthlyMax = Math.max(...peaks.map(p => p.netKW));
    const avgPeak = peaks.reduce((sum, p) => sum + p.netKW, 0) / peaks.length;
    const highPeaks = peaks.filter(p => p.netKW > avgPeak * 1.2).length;
    
    return {
      month,
      peakKW: monthlyMax,
      averagePeakKW: avgPeak,
      peakCount: highPeaks,
    };
  }).sort((a, b) => a.month - b.month);
  
  const top10Peaks = [...netDemandData]
    .sort((a, b) => b.netKW - a.netKW)
    .slice(0, 10);
  
  return {
    top10Peaks,
    monthlyPeaks: monthlyPeaks.sort((a, b) => b.netKW - a.netKW),
    currentAnnualDemandCharge,
    potentialDemandReduction,
    demandChargeSavings,
    recommendedBatteryPower,
    recommendedBatteryEnergy,
    peakDistribution,
    tariffDetails: {
      code: tariffCode,
      demandRate,
      energyRate: HQ_ENERGY_RATES[tariffCode] || 0,
    },
  };
}

export function generateSolarProductionProfile(
  systemSizeKW: number,
  yieldKWhPerKWp: number = 1150
): HourlySolarProduction[] {
  const profile: HourlySolarProduction[] = [];
  
  const monthlyFactors = [0.4, 0.5, 0.7, 0.9, 1.0, 1.1, 1.1, 1.0, 0.85, 0.65, 0.45, 0.35];
  
  const hourlyFactors = [
    0, 0, 0, 0, 0, 0.05, 0.15, 0.35, 0.55, 0.75, 0.90, 0.98,
    1.0, 0.98, 0.90, 0.75, 0.55, 0.35, 0.15, 0.05, 0, 0, 0, 0
  ];
  
  const annualProduction = systemSizeKW * yieldKWhPerKWp;
  const peakProductionKW = systemSizeKW * 0.85;
  
  for (let month = 1; month <= 12; month++) {
    for (let hour = 0; hour < 24; hour++) {
      const productionKW = peakProductionKW * monthlyFactors[month - 1] * hourlyFactors[hour];
      profile.push({ month, hour, productionKW });
    }
  }
  
  return profile;
}
