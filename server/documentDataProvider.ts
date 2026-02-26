import type { IStorage } from "./storage";
import type { SimulationRun, Site, Client, CashflowEntry, FinancialBreakdown, HourlyProfileEntry, PeakWeekEntry, SensitivityAnalysis, OptimalScenario } from "@shared/schema";
import { createLogger } from "./lib/logger";
import { BASELINE_YIELD } from "./analysis/potentialAnalysis";

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
  satelliteCenter?: { lat: number; lng: number; zoom: number };
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
  hiddenInsights?: HiddenInsights;
  productionP50KWh?: number;
  productionP90KWh?: number;
  isSynthetic?: boolean;
}

export interface HiddenInsights {
  dataConfidence: 'satellite' | 'manual' | 'hq_actual';
  dataConfidencePercent: number;
  peakDemandReductionKw: number;
  peakDemandSavingsAnnual: number;
  selfConsumptionPercent: number;
  gridExportPercent: number;
  clippingLossPercent: number;
  equivalentTreesPlanted: number;
  equivalentCarsRemoved: number;
  costOfInaction25yr: number;
}

/**
 * Compute hiddenInsights from stored simulation data.
 * This allows showing insights for existing analyses without re-running them.
 */
export function computeHiddenInsights(sim: DocumentSimulationData): HiddenInsights {
  // Data confidence based on whether we have hourly consumption data
  const hasHourlyData = sim.hourlyProfile && sim.hourlyProfile.length > 100;
  const isSynthetic = typeof sim.isSynthetic === 'boolean' ? sim.isSynthetic : !hasHourlyData;
  const dataConfidence = !isSynthetic && hasHourlyData ? 'hq_actual' as const : 'satellite' as const;
  const dataConfidencePercent = !isSynthetic && hasHourlyData ? 95 : 75;

  // Peak demand reduction
  const peakDemandReductionKw = sim.demandShavingSetpointKW > 0 && sim.peakDemandKW > 0
    ? Math.max(0, sim.peakDemandKW - sim.demandShavingSetpointKW)
    : 0;
  // ~$15/kW/month demand charge (Quebec C&I average)
  const peakDemandSavingsAnnual = peakDemandReductionKw * 15 * 12;

  // Self-consumption vs export
  const selfConsumptionPercent = sim.selfSufficiencyPercent || 0;
  const totalProductionApprox = sim.annualConsumptionKWh * (selfConsumptionPercent / 100);
  const gridExportPercent = sim.totalExportedKWh > 0 && totalProductionApprox > 0
    ? Math.min(100, (sim.totalExportedKWh / (totalProductionApprox + sim.totalExportedKWh)) * 100)
    : 0;

  // Clipping loss estimate (simplified: if PV > consumption ratio is high)
  const pvProductionEstimate = sim.pvSizeKW * BASELINE_YIELD; // Quebec baseline yield
  const actualProduction = totalProductionApprox + sim.totalExportedKWh;
  const clippingLossPercent = pvProductionEstimate > 0
    ? Math.max(0, ((pvProductionEstimate - actualProduction) / pvProductionEstimate) * 100)
    : 0;

  // Environmental equivalents
  const co2Total25yr = (sim.co2AvoidedTonnesPerYear || 0) * 25;
  const equivalentTreesPlanted = Math.round(co2Total25yr * 1000 / 21.77);
  const equivalentCarsRemoved = Math.round(co2Total25yr / 4.6);

  // Cost of inaction: 25-year utility cost without solar at 3.5%/yr escalation
  const annualCost = sim.annualCostBefore || 0;
  let costOfInaction25yr = 0;
  for (let y = 0; y < 25; y++) {
    costOfInaction25yr += annualCost * Math.pow(1.035, y);
  }

  return {
    dataConfidence,
    dataConfidencePercent,
    peakDemandReductionKw: Math.round(peakDemandReductionKw),
    peakDemandSavingsAnnual: Math.round(peakDemandSavingsAnnual),
    selfConsumptionPercent: Math.round(selfConsumptionPercent),
    gridExportPercent: Math.round(gridExportPercent),
    clippingLossPercent: Math.round(clippingLossPercent * 10) / 10,
    equivalentTreesPlanted,
    equivalentCarsRemoved,
    costOfInaction25yr: Math.round(costOfInaction25yr),
  };
}

export interface DocumentData {
  simulation: SimulationRun & { site: Site & { client: Client } };
  roofPolygons: RoofPolygonData[];
  roofVisualizationBuffer?: Buffer;
  satelliteCenter?: { lat: number; lng: number; zoom: number };
  siteSimulations: (SimulationRun & { site: Site & { client: Client } })[];
  isSynthetic: boolean;
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

  const [allSimulations, roofPolygonsRaw, meterFiles] = await Promise.all([
    storage.getSimulationRuns(),
    storage.getRoofPolygons(simulation.siteId),
    storage.getMeterFiles(simulation.siteId),
  ]);

  const isSynthetic = meterFiles.length === 0 || meterFiles.every(f => f.isSynthetic === true);

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
  let satelliteCenter: { lat: number; lng: number; zoom: number } | undefined;

  const MIN_VALID_IMAGE_SIZE = 10 * 1024;
  const IMG_WIDTH = 800;
  const IMG_HEIGHT = 500;

  async function fetchImageWithRedirects(url: string): Promise<Buffer> {
    const mod = url.startsWith("https") ? await import("https") : await import("http");
    return new Promise<Buffer>((resolve, reject) => {
      const doGet = (fetchUrl: string, redirectsLeft: number) => {
        mod.get(fetchUrl, (response: any) => {
          if ((response.statusCode === 301 || response.statusCode === 302) && response.headers.location && redirectsLeft > 0) {
            log.info(`Following redirect to: ${response.headers.location}`);
            doGet(response.headers.location, redirectsLeft - 1);
            return;
          }
          const chunks: Buffer[] = [];
          response.on("data", (chunk: Buffer) => chunks.push(chunk));
          response.on("end", () => resolve(Buffer.concat(chunks)));
          response.on("error", reject);
        }).on("error", reject);
      };
      doGet(url, 5);
    });
  }

  // Compute centroid and auto-zoom matching getRoofVisualizationUrl logic exactly
  function computeSatelliteCenter(polygons: typeof roofPolygonsRaw, fallbackLat: number, fallbackLng: number): { lat: number; lng: number; zoom: number } {
    const allCoords: { lat: number; lng: number }[] = [];
    polygons.forEach(p => {
      const coords = p.coordinates as [number, number][];
      if (coords && coords.length >= 3) {
        coords.forEach(([lng, lat]) => allCoords.push({ lat, lng }));
      }
    });
    if (allCoords.length === 0) return { lat: fallbackLat, lng: fallbackLng, zoom: 18 };

    const sumLat = allCoords.reduce((s, c) => s + c.lat, 0);
    const sumLng = allCoords.reduce((s, c) => s + c.lng, 0);
    const centerLat = sumLat / allCoords.length;
    const centerLng = sumLng / allCoords.length;

    const minLat = Math.min(...allCoords.map(c => c.lat));
    const maxLat = Math.max(...allCoords.map(c => c.lat));
    const minLng = Math.min(...allCoords.map(c => c.lng));
    const maxLng = Math.max(...allCoords.map(c => c.lng));
    const paddedLatSpan = (maxLat - minLat) * 1.15;
    const paddedLngSpan = (maxLng - minLng) * 1.15;

    let zoom = 18;
    if (paddedLatSpan > 0 || paddedLngSpan > 0) {
      const WORLD_DIM = 256 * 2;
      const latZoom = paddedLatSpan > 0 ? Math.floor(Math.log2((180 * IMG_HEIGHT) / (paddedLatSpan * WORLD_DIM))) : 20;
      const lngZoom = paddedLngSpan > 0 ? Math.floor(Math.log2((360 * IMG_WIDTH) / (paddedLngSpan * WORLD_DIM))) : 20;
      zoom = Math.max(Math.min(latZoom, lngZoom, 20), 15);
    }
    return { lat: centerLat, lng: centerLng, zoom };
  }

  // Fetch satellite image with polygon outlines baked in via Google Static Maps API.
  // This matches the approach used by projectInfoSheetPdf.ts — polygon zones are drawn
  // directly by Google's API so they always appear reliably (no CORS issues like html2canvas).
  if (simulation.site.latitude && simulation.site.longitude) {
    const center = computeSatelliteCenter(roofPolygonsRaw, simulation.site.latitude, simulation.site.longitude);
    satelliteCenter = center;
    log.info(`Fetching satellite image with polygons: center=${center.lat.toFixed(6)},${center.lng.toFixed(6)} zoom=${center.zoom}, polygons=${roofPolygons.length}`);
    try {
      const { getRoofVisualizationUrl } = await import("./googleSolarService");
      const roofImageUrl = getRoofVisualizationUrl(
        { latitude: center.lat, longitude: center.lng },
        roofPolygons,
        { width: IMG_WIDTH, height: IMG_HEIGHT, zoom: center.zoom }
      );

      if (roofImageUrl) {
        const buf = await fetchImageWithRedirects(roofImageUrl);
        if (buf.length >= MIN_VALID_IMAGE_SIZE) {
          roofVisualizationBuffer = buf;
          log.info(`Google Static Maps satellite image fetched: ${buf.length} bytes`);
        } else {
          log.warn(`Google Static Maps image too small (${buf.length} bytes) — skipping`);
        }
      } else {
        log.warn("getRoofVisualizationUrl returned null — Google API key may not be configured");
      }
    } catch (imgError) {
      log.error("Failed to fetch Google Static Maps satellite image:", imgError);
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
    satelliteCenter,
    siteSimulations,
    isSynthetic,
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

    if (scenarioBreakdown.hourlyProfileSummary && scenarioBreakdown.hourlyProfileSummary.length > 0) {
      const summaryAsHourly: HourlyProfileEntry[] = scenarioBreakdown.hourlyProfileSummary.map((s: any) => ({
        hour: parseInt(s.hour),
        month: 0,
        consumption: s.consumptionBefore,
        production: s.consumptionBefore - s.consumptionAfter,
        peakBefore: s.peakBefore,
        peakAfter: s.peakAfter,
        batterySOC: 0,
      }));
      merged.hourlyProfile = summaryAsHourly;
    }

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
