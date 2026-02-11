// Industry benchmarks for Quebec commercial buildings
// Data based on Quebec commercial building energy consumption patterns

export const INDUSTRY_BENCHMARKS = {
  // Average energy intensity (kWh/m²/year) by building type
  energyIntensity: {
    office: { average: 285, top25: 210, bottom25: 380 },
    warehouse: { average: 145, top25: 95, bottom25: 210 },
    retail: { average: 340, top25: 250, bottom25: 450 },
    industrial: { average: 230, top25: 160, bottom25: 320 },
    healthcare: { average: 420, top25: 310, bottom25: 550 },
    education: { average: 195, top25: 140, bottom25: 270 },
    hotel: { average: 380, top25: 280, bottom25: 490 },
    restaurant: { average: 510, top25: 380, bottom25: 680 },
  },
  // Average solar adoption rate by building type in Quebec (%)
  solarAdoption: {
    office: 12,
    warehouse: 28,
    retail: 8,
    industrial: 22,
    healthcare: 5,
    education: 15,
    hotel: 6,
    restaurant: 3,
  },
  // Average payback years by building type (with current incentives)
  avgPayback: {
    office: 5.2,
    warehouse: 3.8,
    retail: 5.8,
    industrial: 4.1,
    healthcare: 6.2,
    education: 4.8,
    hotel: 5.5,
    restaurant: 6.8,
  },
};

export interface BenchmarkComparison {
  benchmark: {
    average: number;
    top25: number;
    bottom25: number;
  };
  adoption: number;
  payback: number;
  percentile: 'top25' | 'average' | 'bottom25';
}

export function getBenchmarkComparison(
  buildingType: string,
  annualKwh: number,
  roofAreaSqM?: number
): BenchmarkComparison {
  const type = buildingType as keyof typeof INDUSTRY_BENCHMARKS.energyIntensity;
  const benchmark = INDUSTRY_BENCHMARKS.energyIntensity[type] || INDUSTRY_BENCHMARKS.energyIntensity.office;
  const adoption = INDUSTRY_BENCHMARKS.solarAdoption[type] || 10;
  const payback = INDUSTRY_BENCHMARKS.avgPayback[type] || 5;

  let percentile: 'top25' | 'average' | 'bottom25' = 'average';
  if (roofAreaSqM && roofAreaSqM > 0) {
    const intensity = annualKwh / roofAreaSqM;
    if (intensity <= benchmark.top25) percentile = 'top25';
    else if (intensity >= benchmark.bottom25) percentile = 'bottom25';
  }

  return { benchmark, adoption, payback, percentile };
}
