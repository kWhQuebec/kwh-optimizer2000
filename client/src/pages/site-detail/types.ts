import type { Site, Client, MeterFile, SimulationRun, ScenarioBreakdown } from "@shared/schema";

export interface SiteWithDetails extends Site {
  client: Client;
  meterFiles: MeterFile[];
  simulationRuns: SimulationRun[];
}

export interface StructuralConstraints {
  maxPvLoadKpa?: number;
  roofChangeRequired?: boolean;
  engineeringReportRef?: string;
  zones?: Array<{
    name: string;
    maxLoadKpa: number;
    areaM2?: number;
    notes?: string;
  }>;
}

export interface PriceBreakdownResponse {
  siteId: string;
  siteName: string;
  capacityKW: number;
  panelCount: number;
  breakdown: Record<string, { cost: number; perW: number; source: string | null }>;
  totalCost: number;
  totalPerW: number;
  componentCount: number;
}

export interface VariantPreset {
  pvSize: number;
  batterySize: number;
  batteryPower: number;
  label?: string;
}

export interface DisplayedScenarioType {
  pvSizeKW: number;
  battEnergyKWh: number;
  battPowerKW: number;
  npv25: number;
  irr25: number;
  selfSufficiencyPercent: number;
  simplePaybackYears: number;
  capexNet: number;
  annualSavings: number;
  totalProductionKWh?: number;
  co2AvoidedTonnesPerYear?: number;
  scenarioBreakdown?: ScenarioBreakdown;
}

export interface QuickPotentialResult {
  roofAnalysis: {
    totalRoofAreaSqM: number;
    usableRoofAreaSqM: number;
    utilizationRatio: number;
    perimeterSetbackRatio?: number;
    constraintFactor?: number;
    polygonCount: number;
  };
  systemSizing: {
    maxCapacityKW: number;
    numPanels: number;
    panelPowerW: number;
  };
  production: {
    annualProductionKWh: number;
    annualProductionMWh: number;
    yieldKWhPerKWp: number;
  };
  financial: {
    costPerW: number;
    pricingTier: string;
    estimatedCapex: number;
    estimatedAnnualSavings: number;
    simplePaybackYears: number;
    [key: string]: unknown;
  };
}

export type DeliverablePhase = 'idle' | 'pdf' | 'pptx' | 'complete' | 'error';
