import { getAllBuildingTypes, getBuildingTypeByKey, type BuildingTypeKey } from './buildingTypes';

function buildBenchmarkMap<T>(extractor: (def: ReturnType<typeof getBuildingTypeByKey>) => T): Record<string, T> {
  const result: Record<string, T> = {};
  for (const def of getAllBuildingTypes()) {
    result[def.key] = extractor(def);
  }
  return result;
}

export const INDUSTRY_BENCHMARKS = {
  energyIntensity: buildBenchmarkMap(d => d.benchmark.energyIntensity),
  solarAdoption: buildBenchmarkMap(d => d.benchmark.solarAdoption),
  avgPayback: buildBenchmarkMap(d => d.benchmark.avgPayback),
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
  const def = getBuildingTypeByKey(buildingType);
  const benchmark = def.benchmark.energyIntensity;
  const adoption = def.benchmark.solarAdoption;
  const payback = def.benchmark.avgPayback;

  let percentile: 'top25' | 'average' | 'bottom25' = 'average';
  if (roofAreaSqM && roofAreaSqM > 0) {
    const intensity = annualKwh / roofAreaSqM;
    if (intensity <= benchmark.top25) percentile = 'top25';
    else if (intensity >= benchmark.bottom25) percentile = 'bottom25';
  }

  return { benchmark, adoption, payback, percentile };
}
