import type {
  SimulationRun,
  SensitivityAnalysis,
  OptimalScenario,
  InsertSimulationRun,
} from "@shared/schema";

export interface ResolvedMetrics {
  pvSizeKW: number;
  battEnergyKWh: number;
  battPowerKW: number;
  capexGross: number;
  capexPV: number;
  capexBattery: number;
  capexNet: number;
  incentivesHQ: number;
  incentivesHQSolar: number;
  incentivesHQBattery: number;
  incentivesFederal: number;
  taxShield: number;
  totalIncentives: number;
  npv25: number;
  npv10: number;
  npv20: number;
  npv30: number;
  irr25: number;
  irr10: number;
  irr20: number;
  irr30: number;
  simplePaybackYears: number;
  lcoe: number;
  lcoe30: number;
  annualSavings: number;
  savingsYear1: number;
  annualCostBefore: number;
  annualCostAfter: number;
  selfSufficiencyPercent: number;
  totalProductionKWh: number;
  co2AvoidedTonnesPerYear: number;
  annualConsumptionKWh: number;
  peakDemandKW: number;
  totalExportedKWh: number;
  annualSurplusRevenue: number;
  annualEnergySavingsKWh: number;
  annualDemandReductionKW: number;
  selfConsumptionKWh: number;
}

export type OptimizationTarget = 'npv' | 'irr' | 'selfSufficiency' | 'payback';

function num(v: number | null | undefined): number {
  return v ?? 0;
}

export function resolveSimulationMetrics(
  simulation: SimulationRun,
  target: OptimizationTarget = 'npv'
): ResolvedMetrics {
  const base: ResolvedMetrics = {
    pvSizeKW: num(simulation.pvSizeKW),
    battEnergyKWh: num(simulation.battEnergyKWh),
    battPowerKW: num(simulation.battPowerKW),
    capexGross: num(simulation.capexGross),
    capexPV: num(simulation.capexPV),
    capexBattery: num(simulation.capexBattery),
    capexNet: num(simulation.capexNet),
    incentivesHQ: num(simulation.incentivesHQ),
    incentivesHQSolar: num(simulation.incentivesHQSolar),
    incentivesHQBattery: num(simulation.incentivesHQBattery),
    incentivesFederal: num(simulation.incentivesFederal),
    taxShield: num(simulation.taxShield),
    totalIncentives: num(simulation.totalIncentives),
    npv25: num(simulation.npv25),
    npv10: num(simulation.npv10),
    npv20: num(simulation.npv20),
    npv30: num(simulation.npv30),
    irr25: num(simulation.irr25),
    irr10: num(simulation.irr10),
    irr20: num(simulation.irr20),
    irr30: num(simulation.irr30),
    simplePaybackYears: num(simulation.simplePaybackYears),
    lcoe: num(simulation.lcoe),
    lcoe30: num(simulation.lcoe30),
    annualSavings: num(simulation.annualSavings),
    savingsYear1: num(simulation.savingsYear1),
    annualCostBefore: num(simulation.annualCostBefore),
    annualCostAfter: num(simulation.annualCostAfter),
    selfSufficiencyPercent: num(simulation.selfSufficiencyPercent),
    totalProductionKWh: num(simulation.totalProductionKWh),
    co2AvoidedTonnesPerYear: num(simulation.co2AvoidedTonnesPerYear),
    annualConsumptionKWh: num(simulation.annualConsumptionKWh),
    peakDemandKW: num(simulation.peakDemandKW),
    totalExportedKWh: num(simulation.totalExportedKWh),
    annualSurplusRevenue: num(simulation.annualSurplusRevenue),
    annualEnergySavingsKWh: num(simulation.annualEnergySavingsKWh),
    annualDemandReductionKW: num(simulation.annualDemandReductionKW),
    selfConsumptionKWh: num(simulation.selfConsumptionKWh),
  };

  const sensitivity = simulation.sensitivity as SensitivityAnalysis | null | undefined;
  if (!sensitivity?.optimalScenarios) {
    return base;
  }

  const targetMap: Record<string, OptimalScenario | null | undefined> = {
    npv: sensitivity.optimalScenarios.bestNPV,
    irr: sensitivity.optimalScenarios.bestIRR,
    selfSufficiency: sensitivity.optimalScenarios.maxSelfSufficiency,
    payback: sensitivity.optimalScenarios.bestPayback,
  };
  const optimal: OptimalScenario | null = targetMap[target] ?? sensitivity.optimalScenarios.bestNPV ?? null;
  if (!optimal) {
    return base;
  }

  const resolved: ResolvedMetrics = {
    ...base,
    pvSizeKW: optimal.pvSizeKW,
    battEnergyKWh: optimal.battEnergyKWh,
    battPowerKW: optimal.battPowerKW,
    capexNet: optimal.capexNet,
    npv25: optimal.npv25,
    irr25: optimal.irr25,
    simplePaybackYears: optimal.simplePaybackYears,
    selfSufficiencyPercent: optimal.selfSufficiencyPercent,
    annualSavings: optimal.annualSavings,
    savingsYear1: optimal.annualSavings,
    totalProductionKWh: optimal.totalProductionKWh,
    co2AvoidedTonnesPerYear: optimal.co2AvoidedTonnesPerYear,
  };

  const bd = optimal.scenarioBreakdown;
  if (bd) {
    resolved.capexGross = bd.capexGross ?? base.capexGross;
    resolved.capexPV = bd.capexSolar ?? base.capexPV;
    resolved.capexBattery = bd.capexBattery ?? base.capexBattery;
    resolved.incentivesHQSolar = bd.actualHQSolar ?? base.incentivesHQSolar;
    resolved.incentivesHQBattery = bd.actualHQBattery ?? base.incentivesHQBattery;
    resolved.incentivesHQ = (resolved.incentivesHQSolar) + (resolved.incentivesHQBattery);
    resolved.incentivesFederal = bd.itcAmount ?? base.incentivesFederal;
    resolved.taxShield = bd.taxShield ?? base.taxShield;
    resolved.totalIncentives = resolved.incentivesHQ + resolved.incentivesFederal + resolved.taxShield;
    resolved.lcoe = bd.lcoe ?? base.lcoe;
    resolved.annualCostAfter = Math.max(0, base.annualCostBefore - (optimal.annualSavings ?? 0));
    resolved.annualEnergySavingsKWh = bd.annualEnergySavingsKWh ?? base.annualEnergySavingsKWh;
    resolved.totalExportedKWh = bd.totalExportedKWh ?? base.totalExportedKWh;
    resolved.annualSurplusRevenue = bd.annualSurplusRevenue ?? base.annualSurplusRevenue;
  }

  return resolved;
}

export interface AnalysisResultForInsert {
  pvSizeKW: number;
  battEnergyKWh: number;
  battPowerKW: number;
  demandShavingSetpointKW?: number;
  annualConsumptionKWh: number;
  peakDemandKW: number;
  annualEnergySavingsKWh: number;
  annualDemandReductionKW: number;
  selfConsumptionKWh: number;
  selfSufficiencyPercent: number;
  totalProductionKWh: number;
  totalExportedKWh?: number;
  annualSurplusRevenue?: number;
  annualCostBefore?: number;
  annualCostAfter?: number;
  annualSavings: number;
  savingsYear1?: number;
  capexGross?: number;
  capexPV?: number;
  capexBattery?: number;
  incentivesHQ?: number;
  incentivesHQSolar?: number;
  incentivesHQBattery?: number;
  incentivesFederal?: number;
  taxShield?: number;
  totalIncentives?: number;
  capexNet: number;
  npv25: number;
  npv10?: number;
  npv20?: number;
  npv30?: number;
  irr25: number;
  irr10?: number;
  irr20?: number;
  irr30?: number;
  simplePaybackYears: number;
  lcoe: number;
  lcoe30?: number;
  co2AvoidedTonnesPerYear: number;
  assumptions: unknown;
  cashflows: unknown;
  breakdown: unknown;
  hourlyProfile: unknown;
  peakWeekData: unknown;
  sensitivity: unknown;
  interpolatedMonths?: unknown;
}

export function buildSimulationInsert(
  siteId: string,
  result: AnalysisResultForInsert,
  options?: {
    meterId?: string | null;
    type?: string;
    label?: string;
  }
): InsertSimulationRun {
  return {
    siteId,
    meterId: options?.meterId ?? null,
    type: options?.type ?? "SCENARIO",
    label: options?.label,

    pvSizeKW: result.pvSizeKW,
    battEnergyKWh: result.battEnergyKWh,
    battPowerKW: result.battPowerKW,
    demandShavingSetpointKW: result.demandShavingSetpointKW ?? null,

    annualConsumptionKWh: result.annualConsumptionKWh,
    peakDemandKW: result.peakDemandKW,
    annualEnergySavingsKWh: result.annualEnergySavingsKWh,
    annualDemandReductionKW: result.annualDemandReductionKW,
    selfConsumptionKWh: result.selfConsumptionKWh,
    selfSufficiencyPercent: result.selfSufficiencyPercent,

    totalProductionKWh: result.totalProductionKWh,
    totalExportedKWh: result.totalExportedKWh ?? null,
    annualSurplusRevenue: result.annualSurplusRevenue ?? null,

    annualCostBefore: result.annualCostBefore ?? null,
    annualCostAfter: result.annualCostAfter ?? null,
    annualSavings: result.annualSavings,
    savingsYear1: result.savingsYear1 ?? null,

    capexGross: result.capexGross ?? null,
    capexPV: result.capexPV ?? null,
    capexBattery: result.capexBattery ?? null,

    incentivesHQ: result.incentivesHQ ?? null,
    incentivesHQSolar: result.incentivesHQSolar ?? null,
    incentivesHQBattery: result.incentivesHQBattery ?? null,
    incentivesFederal: result.incentivesFederal ?? null,
    taxShield: result.taxShield ?? null,
    totalIncentives: result.totalIncentives ?? null,
    capexNet: result.capexNet,

    npv25: result.npv25,
    npv10: result.npv10 ?? null,
    npv20: result.npv20 ?? null,
    irr25: result.irr25,
    irr10: result.irr10 ?? null,
    irr20: result.irr20 ?? null,
    simplePaybackYears: result.simplePaybackYears,
    lcoe: result.lcoe,

    npv30: result.npv30 ?? null,
    irr30: result.irr30 ?? null,
    lcoe30: result.lcoe30 ?? null,

    co2AvoidedTonnesPerYear: result.co2AvoidedTonnesPerYear,

    assumptions: result.assumptions,
    cashflows: result.cashflows,
    breakdown: result.breakdown,
    hourlyProfile: result.hourlyProfile,
    peakWeekData: result.peakWeekData,
    sensitivity: result.sensitivity,
    interpolatedMonths: result.interpolatedMonths ?? null,
  };
}

export interface PortfolioSiteForAggregation {
  overridePvSizeKW?: number | null;
  overrideBatteryKWh?: number | null;
  overrideCapexNet?: number | null;
  overrideNpv?: number | null;
  overrideIrr?: number | null;
  overrideAnnualSavings?: number | null;
  latestSimulation?: SimulationRun | null;
  site?: { name?: string } | null;
}

export interface PortfolioAggregatedKPIs {
  totalPvSizeKW: number;
  totalBatteryCapacityKWh: number;
  totalNetCapex: number;
  totalNpv: number;
  weightedIrr: number;
  totalAnnualSavings: number;
  totalCo2Avoided: number;
  numBuildings: number;
  sitesWithSimulations: number;
  volumeDiscount: number;
  discountedCapex: number;
}

export interface ResolvedPortfolioSite {
  pvSizeKW: number;
  batteryKWh: number;
  capexNet: number;
  npv25: number;
  irr25: number;
  annualSavings: number;
  co2Avoided: number;
  totalProductionKWh: number;
}

export function resolvePortfolioSiteMetrics(
  ps: PortfolioSiteForAggregation,
  target: OptimizationTarget = 'npv'
): ResolvedPortfolioSite {
  const sim = ps.latestSimulation;
  const resolved = sim ? resolveSimulationMetrics(sim, target) : null;

  return {
    pvSizeKW: ps.overridePvSizeKW ?? resolved?.pvSizeKW ?? 0,
    batteryKWh: ps.overrideBatteryKWh ?? resolved?.battEnergyKWh ?? 0,
    capexNet: ps.overrideCapexNet ?? resolved?.capexNet ?? 0,
    npv25: ps.overrideNpv ?? resolved?.npv25 ?? 0,
    irr25: ps.overrideIrr ?? resolved?.irr25 ?? 0,
    annualSavings: ps.overrideAnnualSavings ?? resolved?.annualSavings ?? 0,
    co2Avoided: resolved?.co2AvoidedTonnesPerYear ?? 0,
    totalProductionKWh: resolved?.totalProductionKWh ?? 0,
  };
}

export function calculateVolumeDiscount(numBuildings: number): number {
  if (numBuildings >= 20) return 0.15;
  if (numBuildings >= 10) return 0.10;
  if (numBuildings >= 5) return 0.05;
  return 0;
}

export function aggregatePortfolioKPIs(
  portfolioSites: PortfolioSiteForAggregation[],
  target: OptimizationTarget = 'npv'
): PortfolioAggregatedKPIs {
  let totalPvSizeKW = 0;
  let totalBatteryCapacityKWh = 0;
  let totalNetCapex = 0;
  let totalAnnualSavings = 0;
  let totalCo2Avoided = 0;
  let weightedIrrSum = 0;
  let totalNpv = 0;
  let sitesWithSimulations = 0;

  for (const ps of portfolioSites) {
    const metrics = resolvePortfolioSiteMetrics(ps, target);

    const hasData = metrics.pvSizeKW > 0 || metrics.capexNet !== 0 ||
      metrics.npv25 !== 0 || metrics.annualSavings !== 0 ||
      ps.overridePvSizeKW != null || ps.overrideCapexNet != null ||
      ps.overrideNpv != null || ps.overrideAnnualSavings != null;

    if (hasData || ps.latestSimulation) {
      totalPvSizeKW += metrics.pvSizeKW;
      totalBatteryCapacityKWh += metrics.batteryKWh;
      totalNetCapex += metrics.capexNet;
      totalNpv += metrics.npv25;
      totalAnnualSavings += metrics.annualSavings;
      totalCo2Avoided += metrics.co2Avoided;

      if (metrics.capexNet > 0 && metrics.irr25 !== 0) {
        weightedIrrSum += metrics.irr25 * metrics.capexNet;
      }
      if (metrics.capexNet !== 0 || metrics.pvSizeKW > 0) {
        sitesWithSimulations++;
      }
    }
  }

  const weightedIrr = totalNetCapex > 0 ? weightedIrrSum / totalNetCapex : 0;
  const numBuildings = portfolioSites.length;
  const volumeDiscount = calculateVolumeDiscount(numBuildings);

  return {
    totalPvSizeKW,
    totalBatteryCapacityKWh,
    totalNetCapex,
    totalNpv,
    weightedIrr,
    totalAnnualSavings,
    totalCo2Avoided,
    numBuildings,
    sitesWithSimulations,
    volumeDiscount,
    discountedCapex: totalNetCapex * (1 - volumeDiscount),
  };
}
