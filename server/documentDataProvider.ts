import type { IStorage } from "./storage";
import type { SimulationRun, Site, Client, CashflowEntry, FinancialBreakdown, HourlyProfileEntry, PeakWeekEntry, SensitivityAnalysis, OptimalScenario } from "@shared/schema";
import { createLogger } from "./lib/logger";

const log = createLogger("DocumentData");

export interface RoofPolygonData {
  coordinates: [number, number][];
  color: string;
  label?: string;
  areaSqM: number;
  orientation?: number;    // Azimuth degrees (0=N, 90=E, 180=S, 270=W)
  tiltDegrees?: number;    // Tilt degrees (0=flat, 90=vertical)
}

export interface DocumentSimulationData {
  id: string;
  site: {
    name: string;
    address?: string;
    city?: string;
    province?: string;
    latitude?: number;
    longitude?: number;
    client: {
      name: string;
    };
  };
  roofPolygons?: RoofPolygonData[];
  roofVisualizationBuffer?: Buffer;
  pvSizeKW: number;
  battEnergyKWh: number;
  battPowerKW: number;
  demandShavingSetpointKW: number;
  annualConsumptionKWh: number;
  peakDemandKW: number;
  annualSavings: number;
  savingsYear1: number;
  capexGross: number;
  capexNet: number;
  totalIncentives: number;
  incentivesHQ: number;
  incentivesHQSolar: number;
  incentivesHQBattery: number;
  incentivesFederal: number;
  taxShield: number;
  npv25: number;
  npv10: number;
  npv20: number;
  irr25: number;
  irr10: number;
  irr20: number;
  simplePaybackYears: number;
  lcoe: number;
  co2AvoidedTonnesPerYear: number;
  selfSufficiencyPercent: number;
  annualCostBefore: number;
  annualCostAfter: number;
  totalExportedKWh: number;
  annualSurplusRevenue: number;
  assumptions?: {
    roofAreaSqFt: number;
    roofUtilizationRatio: number;
  };
  cashflows?: CashflowEntry[];
  breakdown?: FinancialBreakdown;
  hourlyProfile?: HourlyProfileEntry[];
  peakWeekData?: PeakWeekEntry[];
  sensitivity?: SensitivityAnalysis;
  // Dynamic data for PDF sections 8 & 9
  catalogEquipment?: Array<{
    name: string;
    manufacturer: string;
    warranty: string;
    spec: string;
    category: string;
  }>;
  constructionTimeline?: Array<{
    step: string;
    duration: string;
    status?: string;
  }>;
}

export interface DocumentData {
  simulation: SimulationRun & { site: Site & { client: Client } };
  roofPolygons: RoofPolygonData[];
  roofVisualizationBuffer?: Buffer;
  siteSimulations: (SimulationRun & { site: Site & { client: Client } })[];
  catalogEquipment?: Array<{
    name: string;
    manufacturer: string;
    warranty: string;
    spec: string;
    category: string;
  }>;
  constructionTimeline?: Array<{
    step: string;
    duration: string;
    status?: string;
  }>;
}

export async function prepareDocumentData(simulationId: string, storage: IStorage): Promise<DocumentData> {
  const simulation = await storage.getSimulationRun(simulationId);

  if (!simulation) {
    throw new Error("Simulation not found");
  }

  const [allSimulations, roofPolygonsRaw] = await Promise.all([
    storage.getSimulationRuns(),
    storage.getRoofPolygons(simulation.siteId),
  ]);

  const siteSimulations = allSimulations.filter(s => s.siteId === simulation.siteId);

  const roofPolygons: RoofPolygonData[] = roofPolygonsRaw.map(p => ({
    coordinates: p.coordinates as [number, number][],
    color: p.color || "#3b82f6",
    label: p.label || undefined,
    areaSqM: p.areaSqM,
    orientation: p.orientation ?? undefined,
    tiltDegrees: p.tiltDegrees ?? undefined,
  }));

  let roofVisualizationBuffer: Buffer | undefined;
  if (roofPolygonsRaw.length > 0 && simulation.site.latitude && simulation.site.longitude) {
    try {
      const { getRoofVisualizationUrl } = await import("./googleSolarService");
      const roofImageUrl = getRoofVisualizationUrl(
        { latitude: simulation.site.latitude, longitude: simulation.site.longitude },
        roofPolygonsRaw.map(p => ({
          coordinates: p.coordinates as [number, number][],
          color: p.color || "#3b82f6",
          label: p.label || undefined,
        })),
        { width: 640, height: 400, zoom: 18 }
      );

      if (roofImageUrl) {
        const https = await import("https");
        roofVisualizationBuffer = await new Promise<Buffer>((resolve, reject) => {
          https.get(roofImageUrl, (response) => {
            const chunks: Buffer[] = [];
            response.on("data", (chunk: Buffer) => chunks.push(chunk));
            response.on("end", () => resolve(Buffer.concat(chunks)));
            response.on("error", reject);
          }).on("error", reject);
        });
      }
    } catch (imgError) {
      log.error("Failed to fetch roof visualization:", imgError);
    }
  }

  // Fetch dynamic equipment data from BOM + catalog (for PDF Section 8)
  let catalogEquipment: DocumentData["catalogEquipment"];
  try {
    const designs = await storage.getDesigns();
    const design = designs.find(d => d.simulationRun.id === simulationId);
    if (design) {
      const fullDesign = await storage.getDesign(design.id);
      if (fullDesign && fullDesign.bomItems.length > 0) {
        const equipmentItems: NonNullable<DocumentData["catalogEquipment"]> = [];
        for (const bom of fullDesign.bomItems) {
          const specs = bom.description || "";
          equipmentItems.push({
            name: bom.description,
            manufacturer: specs,
            warranty: "",
            spec: `${bom.quantity} ${bom.unit}`,
            category: bom.category,
          });
        }
        if (equipmentItems.length > 0) {
          catalogEquipment = equipmentItems;
        }
      }
    }
  } catch (e) {
    // Fallback: sections will use brandContent defaults
  }

  // Fetch dynamic construction timeline (for PDF Section 9)
  let constructionTimeline: DocumentData["constructionTimeline"];
  try {
    const projects = await storage.getConstructionProjectsBySiteId(simulation.siteId);
    if (projects.length > 0) {
      const tasks = await storage.getConstructionTasksByProjectId(projects[0].id);
      if (tasks.length > 0) {
        constructionTimeline = tasks.map(t => {
          let duration = "";
          if (t.plannedStartDate && t.plannedEndDate) {
            const days = Math.ceil((new Date(t.plannedEndDate).getTime() - new Date(t.plannedStartDate).getTime()) / (1000 * 60 * 60 * 24));
            duration = days <= 7 ? `${days} days` : `${Math.ceil(days / 7)} weeks`;
          }
          return {
            step: t.name,
            duration,
            status: t.status || undefined,
          };
        });
      }
    }
  } catch (e) {
    // Fallback: sections will use brandContent defaults
  }

  return {
    simulation,
    roofPolygons,
    roofVisualizationBuffer,
    siteSimulations,
    catalogEquipment,
    constructionTimeline,
  };
}

export function applyOptimalScenario(
  simulation: SimulationRun & { site: Site & { client: Client } },
  target: 'npv' | 'irr' | 'selfSufficiency' = 'npv'
): SimulationRun & { site: Site & { client: Client } } {
  const sensitivity = simulation.sensitivity as SensitivityAnalysis | null | undefined;
  if (!sensitivity?.optimalScenarios) {
    return simulation;
  }

  const targetMap: Record<string, OptimalScenario | null | undefined> = {
    npv: sensitivity.optimalScenarios.bestNPV,
    irr: sensitivity.optimalScenarios.bestIRR,
    selfSufficiency: sensitivity.optimalScenarios.maxSelfSufficiency,
  };
  const optimal: OptimalScenario | null = targetMap[target] ?? sensitivity.optimalScenarios.bestNPV ?? null;
  if (!optimal) {
    return simulation;
  }

  const scenarioBreakdown = optimal.scenarioBreakdown;

  const merged = {
    ...simulation,
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

  if (scenarioBreakdown) {
    merged.capexGross = scenarioBreakdown.capexGross ?? simulation.capexGross;
    merged.capexPV = scenarioBreakdown.capexSolar ?? simulation.capexPV;
    merged.capexBattery = scenarioBreakdown.capexBattery ?? simulation.capexBattery;
    merged.incentivesHQSolar = scenarioBreakdown.actualHQSolar ?? simulation.incentivesHQSolar;
    merged.incentivesHQBattery = scenarioBreakdown.actualHQBattery ?? simulation.incentivesHQBattery;
    merged.incentivesHQ = (merged.incentivesHQSolar ?? 0) + (merged.incentivesHQBattery ?? 0);
    merged.incentivesFederal = scenarioBreakdown.itcAmount ?? simulation.incentivesFederal;
    merged.taxShield = scenarioBreakdown.taxShield ?? simulation.taxShield;
    merged.totalIncentives = (merged.incentivesHQ ?? 0) + (merged.incentivesFederal ?? 0) + (merged.taxShield ?? 0);
    merged.lcoe = scenarioBreakdown.lcoe ?? simulation.lcoe;
    merged.annualCostAfter = Math.max(0, (simulation.annualCostBefore ?? 0) - (optimal.annualSavings ?? 0));
    merged.annualEnergySavingsKWh = scenarioBreakdown.annualEnergySavingsKWh ?? simulation.annualEnergySavingsKWh;

    if (scenarioBreakdown.cashflows && scenarioBreakdown.cashflows.length > 0) {
      let cumulative = -(merged.capexNet ?? merged.capexGross ?? 0);
      merged.cashflows = scenarioBreakdown.cashflows.map((cf, i) => {
        if (i === 0) {
          cumulative = cf.netCashflow;
        } else {
          cumulative += cf.netCashflow;
        }
        return {
          year: cf.year,
          revenue: 0,
          opex: 0,
          ebitda: 0,
          investment: i === 0 ? -(merged.capexNet ?? 0) : 0,
          dpa: 0,
          incentives: 0,
          netCashflow: cf.netCashflow,
          cumulative,
        };
      });
    }
  }

  log.info(`Applied ${target} optimal scenario: PV=${optimal.pvSizeKW}kW, Batt=${optimal.battEnergyKWh}kWh, NPV25=${optimal.npv25}, IRR=${optimal.irr25}`);

  return merged;
}
