import { eq, desc, and, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { portfolios, portfolioSites, sites, clients, simulationRuns } from "@shared/schema";
import type {
  Portfolio, InsertPortfolio, PortfolioWithSites,
  PortfolioSite, InsertPortfolioSite, PortfolioSiteWithDetails,
  Site,
} from "@shared/schema";

const lightSiteColumns = {
  id: sites.id,
  clientId: sites.clientId,
  name: sites.name,
  address: sites.address,
  city: sites.city,
  province: sites.province,
  postalCode: sites.postalCode,
  notes: sites.notes,
  ownerName: sites.ownerName,
  buildingType: sites.buildingType,
  roofType: sites.roofType,
  roofAreaSqM: sites.roofAreaSqM,
  latitude: sites.latitude,
  longitude: sites.longitude,
  roofAreaAutoSqM: sites.roofAreaAutoSqM,
  roofAreaAutoSource: sites.roofAreaAutoSource,
  roofAreaAutoTimestamp: sites.roofAreaAutoTimestamp,
  roofEstimateStatus: sites.roofEstimateStatus,
  roofEstimateError: sites.roofEstimateError,
  roofEstimatePendingAt: sites.roofEstimatePendingAt,
  roofColorType: sites.roofColorType,
  roofColorConfidence: sites.roofColorConfidence,
  roofColorDetectedAt: sites.roofColorDetectedAt,
  bifacialAnalysisPrompted: sites.bifacialAnalysisPrompted,
  bifacialAnalysisAccepted: sites.bifacialAnalysisAccepted,
  analysisAvailable: sites.analysisAvailable,
  structuralNotes: sites.structuralNotes,
  structuralConstraints: sites.structuralConstraints,
  hqRfpStatus: sites.hqRfpStatus,
  hqSubstation: sites.hqSubstation,
  hqLineId: sites.hqLineId,
  hqTransformer: sites.hqTransformer,
  hqLineVoltage: sites.hqLineVoltage,
  hqDistributionUpgradeCost: sites.hqDistributionUpgradeCost,
  hqSubstationUpgradeCost: sites.hqSubstationUpgradeCost,
  hqProtectionsCost: sites.hqProtectionsCost,
  hqCommunicationsCost: sites.hqCommunicationsCost,
  hqTotalUpgradeCost: sites.hqTotalUpgradeCost,
  hqLeadTimeMonths: sites.hqLeadTimeMonths,
  hqCompletionDate: sites.hqCompletionDate,
  hqContractTargetDate: sites.hqContractTargetDate,
  dotCapacityStatus: sites.dotCapacityStatus,
  structuralPassStatus: sites.structuralPassStatus,
  structuralCapacity: sites.structuralCapacity,
  structuralBallastRemoval: sites.structuralBallastRemoval,
  externalBuildingId: sites.externalBuildingId,
  buildingSqFt: sites.buildingSqFt,
  yearBuilt: sites.yearBuilt,
  roofAreaValidated: sites.roofAreaValidated,
  roofAreaValidatedAt: sites.roofAreaValidatedAt,
  roofAreaValidatedBy: sites.roofAreaValidatedBy,
  kbDesignStatus: sites.kbDesignStatus,
  kbPanelCount: sites.kbPanelCount,
  kbKwDc: sites.kbKwDc,
  kbPricePerPanel: sites.kbPricePerPanel,
  kbRackingSubtotal: sites.kbRackingSubtotal,
  kbShippingCost: sites.kbShippingCost,
  kbEngineeringCost: sites.kbEngineeringCost,
  kbQuoteDate: sites.kbQuoteDate,
  kbQuoteExpiry: sites.kbQuoteExpiry,
  kbQuoteNumber: sites.kbQuoteNumber,
  kbDesignPdfUrl: sites.kbDesignPdfUrl,
  kbWindPressureKpa: sites.kbWindPressureKpa,
  kbExposureFactor: sites.kbExposureFactor,
  kbTerrainType: sites.kbTerrainType,
  quickAnalysisSystemSizeKw: sites.quickAnalysisSystemSizeKw,
  quickAnalysisAnnualProductionKwh: sites.quickAnalysisAnnualProductionKwh,
  quickAnalysisAnnualSavings: sites.quickAnalysisAnnualSavings,
  quickAnalysisPaybackYears: sites.quickAnalysisPaybackYears,
  quickAnalysisGrossCapex: sites.quickAnalysisGrossCapex,
  quickAnalysisNetCapex: sites.quickAnalysisNetCapex,
  quickAnalysisHqIncentive: sites.quickAnalysisHqIncentive,
  quickAnalysisMonthlyBill: sites.quickAnalysisMonthlyBill,
  quickAnalysisConstraintFactor: sites.quickAnalysisConstraintFactor,
  quickAnalysisCompletedAt: sites.quickAnalysisCompletedAt,
  workQueueAssignedToId: sites.workQueueAssignedToId,
  workQueueAssignedAt: sites.workQueueAssignedAt,
  workQueuePriority: sites.workQueuePriority,
  workQueueDelegatedToEmail: sites.workQueueDelegatedToEmail,
  workQueueDelegatedToName: sites.workQueueDelegatedToName,
  workQueueDelegatedAt: sites.workQueueDelegatedAt,
  hqBillPath: sites.hqBillPath,
  hqBillUploadedAt: sites.hqBillUploadedAt,
  hqLegalClientName: sites.hqLegalClientName,
  hqClientNumber: sites.hqClientNumber,
  hqBillNumber: sites.hqBillNumber,
  hqAccountNumber: sites.hqAccountNumber,
  hqContractNumber: sites.hqContractNumber,
  hqTariffDetail: sites.hqTariffDetail,
  hqMeterNumber: sites.hqMeterNumber,
  subscribedPowerKw: sites.subscribedPowerKw,
  maxDemandKw: sites.maxDemandKw,
  serviceAddress: sites.serviceAddress,
  readyForAnalysis: sites.readyForAnalysis,
  roofAgeYears: sites.roofAgeYears,
  ownershipType: sites.ownershipType,
  numFloors: sites.numFloors,
  buildingHeightFt: sites.buildingHeightFt,
  estimatedMonthlyBill: sites.estimatedMonthlyBill,
  estimatedAnnualConsumptionKwh: sites.estimatedAnnualConsumptionKwh,
  quickInfoCompletedAt: sites.quickInfoCompletedAt,
  baselineSnapshotDate: sites.baselineSnapshotDate,
  baselineAnnualConsumptionKwh: sites.baselineAnnualConsumptionKwh,
  baselineAnnualCostCad: sites.baselineAnnualCostCad,
  baselinePeakDemandKw: sites.baselinePeakDemandKw,
  operationsStartDate: sites.operationsStartDate,
  hqRaccordementSubmittedAt: sites.hqRaccordementSubmittedAt,
  hqConditionalAcceptanceAt: sites.hqConditionalAcceptanceAt,
  hqOfficialAuthorizationAt: sites.hqOfficialAuthorizationAt,
  hqMiseEnServiceAt: sites.hqMiseEnServiceAt,
  hqOse6RequestSubmittedAt: sites.hqOse6RequestSubmittedAt,
  hqOse6PaymentReceivedAt: sites.hqOse6PaymentReceivedAt,
  isArchived: sites.isArchived,
  archivedAt: sites.archivedAt,
  createdAt: sites.createdAt,
  updatedAt: sites.updatedAt,
};

// ==================== PORTFOLIOS ====================

export async function getPortfolios(): Promise<PortfolioWithSites[]> {
  const allPortfolios = await db.select().from(portfolios).orderBy(desc(portfolios.createdAt));

  const clientIds = Array.from(new Set(allPortfolios.map(p => p.clientId)));
  const relevantClients = clientIds.length > 0
    ? await db.select().from(clients).where(inArray(clients.id, clientIds))
    : [];
  const clientMap = new Map(relevantClients.map(c => [c.id, c]));

  const allPortfolioSites = await db.select().from(portfolioSites);
  const allSiteIds = Array.from(new Set(allPortfolioSites.map(ps => ps.siteId)));
  const allSitesList = allSiteIds.length > 0
    ? await db.select(lightSiteColumns).from(sites).where(inArray(sites.id, allSiteIds))
    : [];
  const siteMap = new Map(allSitesList.map(s => [s.id, s]));

  return allPortfolios.map(portfolio => {
    const linkedSiteIds = allPortfolioSites
      .filter(ps => ps.portfolioId === portfolio.id)
      .map(ps => ps.siteId);
    const portfolioSiteList = linkedSiteIds
      .map(id => siteMap.get(id))
      .filter((s): s is typeof allSitesList[number] => s !== undefined);
    return {
      ...portfolio,
      client: clientMap.get(portfolio.clientId)!,
      sites: portfolioSiteList as any as Site[],
    };
  });
}

export async function getPortfolio(id: string): Promise<PortfolioWithSites | undefined> {
  const [portfolio] = await db.select().from(portfolios).where(eq(portfolios.id, id)).limit(1);
  if (!portfolio) return undefined;

  const [client] = await db.select().from(clients).where(eq(clients.id, portfolio.clientId)).limit(1);
  const psEntries = await db.select().from(portfolioSites).where(eq(portfolioSites.portfolioId, id));
  const siteIds = psEntries.map(ps => ps.siteId);
  const portfolioSiteList = siteIds.length > 0
    ? await db.select(lightSiteColumns).from(sites).where(inArray(sites.id, siteIds))
    : [];

  return {
    ...portfolio,
    client: client!,
    sites: portfolioSiteList as any as Site[],
  };
}

export async function getPortfoliosByClient(clientId: string): Promise<PortfolioWithSites[]> {
  const clientPortfolios = await db.select().from(portfolios)
    .where(eq(portfolios.clientId, clientId))
    .orderBy(desc(portfolios.createdAt));

  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  const portfolioIds = clientPortfolios.map(p => p.id);
  const relevantPortfolioSites = portfolioIds.length > 0
    ? await db.select().from(portfolioSites).where(inArray(portfolioSites.portfolioId, portfolioIds))
    : [];
  const allSiteIds = Array.from(new Set(relevantPortfolioSites.map(ps => ps.siteId)));
  const allSites = allSiteIds.length > 0
    ? await db.select(lightSiteColumns).from(sites).where(inArray(sites.id, allSiteIds))
    : [];

  return clientPortfolios.map(portfolio => {
    const psEntries = relevantPortfolioSites.filter(ps => ps.portfolioId === portfolio.id);
    const portfolioSiteList = psEntries
      .map(ps => allSites.find(s => s.id === ps.siteId))
      .filter((s): s is typeof allSites[number] => s !== undefined);
    return {
      ...portfolio,
      client: client!,
      sites: portfolioSiteList as any as Site[],
    };
  });
}

export async function createPortfolio(portfolio: InsertPortfolio): Promise<Portfolio> {
  const [result] = await db.insert(portfolios).values(portfolio).returning();
  return result;
}

export async function updatePortfolio(id: string, portfolio: Partial<Portfolio>): Promise<Portfolio | undefined> {
  const [result] = await db.update(portfolios)
    .set({ ...portfolio, updatedAt: new Date() })
    .where(eq(portfolios.id, id))
    .returning();
  return result;
}

export async function deletePortfolio(id: string): Promise<boolean> {
  await db.delete(portfolioSites).where(eq(portfolioSites.portfolioId, id));
  const result = await db.delete(portfolios).where(eq(portfolios.id, id)).returning();
  return result.length > 0;
}

// ==================== PORTFOLIO SITES ====================

export async function getPortfolioSites(portfolioId: string): Promise<PortfolioSiteWithDetails[]> {
  const entries = await db.select().from(portfolioSites)
    .where(eq(portfolioSites.portfolioId, portfolioId))
    .orderBy(portfolioSites.displayOrder);

  if (entries.length === 0) return [];

  const siteIds = entries.map(ps => ps.siteId);

  const portfolioSitesList = await db.select(lightSiteColumns).from(sites)
    .where(inArray(sites.id, siteIds));

  const simColumns = {
    id: simulationRuns.id,
    siteId: simulationRuns.siteId,
    meterId: simulationRuns.meterId,
    label: simulationRuns.label,
    type: simulationRuns.type,
    pvSizeKW: simulationRuns.pvSizeKW,
    battEnergyKWh: simulationRuns.battEnergyKWh,
    battPowerKW: simulationRuns.battPowerKW,
    annualConsumptionKWh: simulationRuns.annualConsumptionKWh,
    peakDemandKW: simulationRuns.peakDemandKW,
    totalProductionKWh: simulationRuns.totalProductionKWh,
    totalExportedKWh: simulationRuns.totalExportedKWh,
    annualSurplusRevenue: simulationRuns.annualSurplusRevenue,
    annualCostBefore: simulationRuns.annualCostBefore,
    annualCostAfter: simulationRuns.annualCostAfter,
    annualSavings: simulationRuns.annualSavings,
    capexGross: simulationRuns.capexGross,
    capexPV: simulationRuns.capexPV,
    capexBattery: simulationRuns.capexBattery,
    incentivesHQ: simulationRuns.incentivesHQ,
    incentivesFederal: simulationRuns.incentivesFederal,
    taxShield: simulationRuns.taxShield,
    totalIncentives: simulationRuns.totalIncentives,
    capexNet: simulationRuns.capexNet,
    npv25: simulationRuns.npv25,
    irr25: simulationRuns.irr25,
    simplePaybackYears: simulationRuns.simplePaybackYears,
    lcoe: simulationRuns.lcoe,
    co2AvoidedTonnesPerYear: simulationRuns.co2AvoidedTonnesPerYear,
    selfSufficiencyPercent: simulationRuns.selfSufficiencyPercent,
    createdAt: simulationRuns.createdAt,
  };

  const scenarioSims = await db.select(simColumns).from(simulationRuns)
    .where(and(
      inArray(simulationRuns.siteId, siteIds),
      eq(simulationRuns.type, "SCENARIO"),
    ))
    .orderBy(desc(simulationRuns.createdAt));

  const scenarioMap = new Map<string, typeof scenarioSims[number]>();
  for (const sim of scenarioSims) {
    if (!scenarioMap.has(sim.siteId)) {
      scenarioMap.set(sim.siteId, sim);
    }
  }

  const sitesMissingScenario = siteIds.filter(id => !scenarioMap.has(id));
  if (sitesMissingScenario.length > 0) {
    const fallbackSims = await db.select(simColumns).from(simulationRuns)
      .where(inArray(simulationRuns.siteId, sitesMissingScenario))
      .orderBy(desc(simulationRuns.createdAt));
    for (const sim of fallbackSims) {
      if (!scenarioMap.has(sim.siteId)) {
        scenarioMap.set(sim.siteId, sim);
      }
    }
  }

  return entries.map(ps => {
    const site = portfolioSitesList.find(s => s.id === ps.siteId)!;
    return {
      ...ps,
      site: site as any as Site,
      latestSimulation: scenarioMap.get(ps.siteId),
    };
  });
}

export async function isSiteInAnyPortfolio(siteId: string): Promise<boolean> {
  const result = await db.select().from(portfolioSites)
    .where(eq(portfolioSites.siteId, siteId))
    .limit(1);
  return result.length > 0;
}

export async function addSiteToPortfolio(portfolioSite: InsertPortfolioSite): Promise<PortfolioSite> {
  const [result] = await db.insert(portfolioSites).values(portfolioSite).returning();
  return result;
}

export async function removeSiteFromPortfolio(portfolioId: string, siteId: string): Promise<boolean> {
  const result = await db.delete(portfolioSites)
    .where(and(eq(portfolioSites.portfolioId, portfolioId), eq(portfolioSites.siteId, siteId)))
    .returning();
  return result.length > 0;
}

export async function updatePortfolioSite(id: string, data: Partial<PortfolioSite>): Promise<PortfolioSite | undefined> {
  const [result] = await db.update(portfolioSites)
    .set(data)
    .where(eq(portfolioSites.id, id))
    .returning();
  return result;
}
