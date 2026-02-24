import { eq, desc, and, inArray, sql, count } from "drizzle-orm";
import { db } from "../db";
import {
  sites, clients, meterFiles, meterReadings, simulationRuns, designs, bomItems,
  designAgreements, siteVisits, constructionAgreements, constructionProjects,
  activities, emailLogs, competitorProposalAnalysis, opportunities,
  omContracts, omVisits, omPerformanceSnapshots, roofPolygons, siteMeters,
  defaultAnalysisAssumptions,
} from "@shared/schema";
import type {
  Site, InsertSite, Client, MeterFile, InsertMeterFile,
  MeterReading, InsertMeterReading, SimulationRunSummary,
  SimulationRun,
  RoofPolygon, InsertRoofPolygon,
  AnalysisAssumptions,
} from "@shared/schema";
import { getSimplifiedRates } from "../hqTariffs";

// ==================== SITES ====================

export async function getSites(): Promise<(Site & { client: Client })[]> {
  const allSites = await db.select().from(sites).orderBy(desc(sites.createdAt));
  const allClients = await db.select().from(clients);
  const clientMap = new Map(allClients.map(c => [c.id, c]));

  return allSites.map(site => ({
    ...site,
    client: clientMap.get(site.clientId)!,
  })).filter(s => s.client);
}

export async function getSitesByIds(ids: string[]): Promise<Site[]> {
  if (ids.length === 0) return [];
  return db.select().from(sites).where(inArray(sites.id, ids));
}

export async function getSitesMinimalByIds(ids: string[]): Promise<Array<{ id: string; name: string; address: string | null; city: string | null; province: string | null; clientId: string; isArchived: boolean }>> {
  if (ids.length === 0) return [];
  return db.select({
    id: sites.id,
    name: sites.name,
    address: sites.address,
    city: sites.city,
    province: sites.province,
    clientId: sites.clientId,
    isArchived: sites.isArchived,
  }).from(sites).where(inArray(sites.id, ids));
}

export async function getSitesMinimal(): Promise<Array<{ id: string; name: string; address: string | null; city: string | null; province: string | null; clientId: string; isArchived: boolean }>> {
  return db.select({
    id: sites.id,
    name: sites.name,
    address: sites.address,
    city: sites.city,
    province: sites.province,
    clientId: sites.clientId,
    isArchived: sites.isArchived,
  }).from(sites);
}

export async function getSitesForPortalDashboard(clientId?: string) {
  const siteColumns = {
    id: sites.id,
    name: sites.name,
    address: sites.address,
    city: sites.city,
    province: sites.province,
    clientId: sites.clientId,
    analysisAvailable: sites.analysisAvailable,
    roofAreaSqM: sites.roofAreaSqM,
    roofAreaAutoSqM: sites.roofAreaAutoSqM,
    isArchived: sites.isArchived,
  };

  const siteRows = clientId
    ? await db.select(siteColumns).from(sites).where(eq(sites.clientId, clientId))
    : await db.select(siteColumns).from(sites);

  if (siteRows.length === 0) return [];

  const siteIds = siteRows.map(s => s.id);

  const clientIds = Array.from(new Set(siteRows.map(s => s.clientId)));
  const clientRows = await db.select({ id: clients.id, name: clients.name }).from(clients).where(inArray(clients.id, clientIds));
  const clientMap = new Map(clientRows.map(c => [c.id, c]));

  const simRows = await db.select({
    id: simulationRuns.id,
    siteId: simulationRuns.siteId,
    pvSizeKW: simulationRuns.pvSizeKW,
    savingsYear1: simulationRuns.savingsYear1,
    simplePaybackYears: simulationRuns.simplePaybackYears,
    npv25: simulationRuns.npv25,
    irr25: simulationRuns.irr25,
    co2AvoidedTonnesPerYear: simulationRuns.co2AvoidedTonnesPerYear,
    createdAt: simulationRuns.createdAt,
  }).from(simulationRuns).where(inArray(simulationRuns.siteId, siteIds)).orderBy(simulationRuns.createdAt);

  const simMap = new Map<string, typeof simRows>();
  for (const sim of simRows) {
    if (!simMap.has(sim.siteId)) simMap.set(sim.siteId, []);
    simMap.get(sim.siteId)!.push(sim);
  }

  const daRows = await db.select({
    id: designAgreements.id,
    siteId: designAgreements.siteId,
    status: designAgreements.status,
    publicToken: designAgreements.publicToken,
    depositPaidAt: designAgreements.depositPaidAt,
  }).from(designAgreements).where(inArray(designAgreements.siteId, siteIds));

  const daMap = new Map(daRows.map(da => [da.siteId, da]));

  return siteRows.map(site => ({
    ...site,
    client: clientMap.get(site.clientId) || null,
    simulationRuns: simMap.get(site.id) || [],
    designAgreement: daMap.get(site.id) || null,
  }));
}

export async function getSitesForWorkQueue(): Promise<Array<{
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  province: string | null;
  clientId: string;
  isArchived: boolean;
  roofAreaValidated: boolean | null;
  quickAnalysisCompletedAt: Date | null;
  workQueueAssignedToId: string | null;
  workQueueAssignedAt: Date | null;
  workQueuePriority: string | null;
  workQueueDelegatedToEmail: string | null;
  workQueueDelegatedToName: string | null;
  workQueueDelegatedAt: Date | null;
}>> {
  return db.select({
    id: sites.id,
    name: sites.name,
    address: sites.address,
    city: sites.city,
    province: sites.province,
    clientId: sites.clientId,
    isArchived: sites.isArchived,
    roofAreaValidated: sites.roofAreaValidated,
    quickAnalysisCompletedAt: sites.quickAnalysisCompletedAt,
    workQueueAssignedToId: sites.workQueueAssignedToId,
    workQueueAssignedAt: sites.workQueueAssignedAt,
    workQueuePriority: sites.workQueuePriority,
    workQueueDelegatedToEmail: sites.workQueueDelegatedToEmail,
    workQueueDelegatedToName: sites.workQueueDelegatedToName,
    workQueueDelegatedAt: sites.workQueueDelegatedAt,
  }).from(sites).where(eq(sites.isArchived, false));
}

export async function getSitesListPaginated(options: {
  limit?: number;
  offset?: number;
  search?: string;
  clientId?: string;
  includeArchived?: boolean;
} = {}): Promise<{
  sites: Array<{
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    province: string | null;
    postalCode: string | null;
    analysisAvailable: boolean | null;
    roofAreaValidated: boolean | null;
    createdAt: Date | null;
    clientId: string;
    clientName: string;
    hasSimulation: boolean;
    hasDesignAgreement: boolean;
    isArchived: boolean;
  }>;
  total: number;
}> {
  const { limit = 50, offset = 0, search, clientId, includeArchived = false } = options;

  let query = db.select({
    id: sites.id,
    name: sites.name,
    address: sites.address,
    city: sites.city,
    province: sites.province,
    postalCode: sites.postalCode,
    analysisAvailable: sites.analysisAvailable,
    roofAreaValidated: sites.roofAreaValidated,
    createdAt: sites.createdAt,
    clientId: sites.clientId,
    clientName: clients.name,
    isArchived: sites.isArchived,
  })
  .from(sites)
  .innerJoin(clients, eq(sites.clientId, clients.id))
  .orderBy(desc(sites.createdAt));

  const conditions = [];

  if (!includeArchived) {
    conditions.push(eq(sites.isArchived, false));
  }

  if (clientId) {
    conditions.push(eq(sites.clientId, clientId));
  }
  if (search) {
    const searchLower = `%${search.toLowerCase()}%`;
    conditions.push(
      sql`(LOWER(${sites.name}) LIKE ${searchLower} OR LOWER(${clients.name}) LIKE ${searchLower} OR LOWER(${sites.city}) LIKE ${searchLower})`
    );
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const countQuery = db.select({ count: sql<number>`count(*)` })
    .from(sites)
    .innerJoin(clients, eq(sites.clientId, clients.id));

  if (conditions.length > 0) {
    (countQuery as any).where(and(...conditions));
  }

  const [{ count: total }] = await countQuery;

  const paginatedSites = await query.limit(limit).offset(offset);

  const siteIds = paginatedSites.map(s => s.id);

  const [simulations, agreements] = await Promise.all([
    siteIds.length > 0
      ? db.select({ siteId: simulationRuns.siteId })
          .from(simulationRuns)
          .where(inArray(simulationRuns.siteId, siteIds))
          .groupBy(simulationRuns.siteId)
      : [],
    siteIds.length > 0
      ? db.select({ siteId: designAgreements.siteId })
          .from(designAgreements)
          .where(inArray(designAgreements.siteId, siteIds))
          .groupBy(designAgreements.siteId)
      : []
  ]);

  const sitesWithSim = new Set(simulations.map(s => s.siteId));
  const sitesWithAgreement = new Set(agreements.map(a => a.siteId));

  return {
    sites: paginatedSites.map(site => ({
      ...site,
      hasSimulation: sitesWithSim.has(site.id),
      hasDesignAgreement: sitesWithAgreement.has(site.id),
    })),
    total: Number(total),
  };
}

export async function getSite(id: string): Promise<(Site & { client: Client; meterFiles: MeterFile[]; simulationRuns: SimulationRunSummary[] }) | undefined> {
  const [site] = await db.select().from(sites).where(eq(sites.id, id)).limit(1);
  if (!site) return undefined;

  const [clientResult, siteFiles, simRuns] = await Promise.all([
    db.select().from(clients).where(eq(clients.id, site.clientId)).limit(1),
    db.select().from(meterFiles).where(eq(meterFiles.siteId, id)),
    db.select({
      id: simulationRuns.id,
      siteId: simulationRuns.siteId,
      label: simulationRuns.label,
      type: simulationRuns.type,
      pvSizeKW: simulationRuns.pvSizeKW,
      battEnergyKWh: simulationRuns.battEnergyKWh,
      battPowerKW: simulationRuns.battPowerKW,
      demandShavingSetpointKW: simulationRuns.demandShavingSetpointKW,
      annualConsumptionKWh: simulationRuns.annualConsumptionKWh,
      peakDemandKW: simulationRuns.peakDemandKW,
      annualEnergySavingsKWh: simulationRuns.annualEnergySavingsKWh,
      annualDemandReductionKW: simulationRuns.annualDemandReductionKW,
      selfConsumptionKWh: simulationRuns.selfConsumptionKWh,
      selfSufficiencyPercent: simulationRuns.selfSufficiencyPercent,
      totalProductionKWh: simulationRuns.totalProductionKWh,
      totalExportedKWh: simulationRuns.totalExportedKWh,
      annualSurplusRevenue: simulationRuns.annualSurplusRevenue,
      annualCostBefore: simulationRuns.annualCostBefore,
      annualCostAfter: simulationRuns.annualCostAfter,
      annualSavings: simulationRuns.annualSavings,
      savingsYear1: simulationRuns.savingsYear1,
      capexGross: simulationRuns.capexGross,
      capexPV: simulationRuns.capexPV,
      capexBattery: simulationRuns.capexBattery,
      incentivesHQ: simulationRuns.incentivesHQ,
      incentivesHQSolar: simulationRuns.incentivesHQSolar,
      incentivesHQBattery: simulationRuns.incentivesHQBattery,
      incentivesFederal: simulationRuns.incentivesFederal,
      taxShield: simulationRuns.taxShield,
      totalIncentives: simulationRuns.totalIncentives,
      capexNet: simulationRuns.capexNet,
      npv25: simulationRuns.npv25,
      npv10: simulationRuns.npv10,
      npv20: simulationRuns.npv20,
      irr25: simulationRuns.irr25,
      irr10: simulationRuns.irr10,
      irr20: simulationRuns.irr20,
      simplePaybackYears: simulationRuns.simplePaybackYears,
      lcoe: simulationRuns.lcoe,
      npv30: simulationRuns.npv30,
      irr30: simulationRuns.irr30,
      lcoe30: simulationRuns.lcoe30,
      co2AvoidedTonnesPerYear: simulationRuns.co2AvoidedTonnesPerYear,
      assumptions: simulationRuns.assumptions,
      interpolatedMonths: simulationRuns.interpolatedMonths,
      createdAt: simulationRuns.createdAt,
    }).from(simulationRuns).where(eq(simulationRuns.siteId, id)).orderBy(desc(simulationRuns.createdAt)),
  ]);

  const [client] = clientResult;
  if (!client) return undefined;

  return { ...site, client, meterFiles: siteFiles, simulationRuns: simRuns };
}

export async function getSitesByClient(clientId: string): Promise<Site[]> {
  return db.select().from(sites).where(eq(sites.clientId, clientId));
}

export async function createSite(site: InsertSite): Promise<Site> {
  const [result] = await db.insert(sites).values({
    ...site,
    analysisAvailable: false,
  }).returning();
  return result;
}

export async function updateSite(id: string, site: Partial<Site>): Promise<Site | undefined> {
  const [result] = await db.update(sites).set({ ...site, updatedAt: new Date() }).where(eq(sites.id, id)).returning();
  return result;
}

export async function deleteSite(id: string): Promise<boolean> {
  await db.delete(activities).where(eq(activities.siteId, id));
  await db.delete(competitorProposalAnalysis).where(eq(competitorProposalAnalysis.siteId, id));
  await db.delete(emailLogs).where(eq(emailLogs.siteId, id));
  await db.update(opportunities).set({ siteId: null }).where(eq(opportunities.siteId, id));
  await db.delete(omPerformanceSnapshots).where(eq(omPerformanceSnapshots.siteId, id));
  await db.delete(omVisits).where(eq(omVisits.siteId, id));
  await db.delete(omContracts).where(eq(omContracts.siteId, id));
  await db.delete(constructionProjects).where(eq(constructionProjects.siteId, id));
  await db.delete(constructionAgreements).where(eq(constructionAgreements.siteId, id));
  await db.delete(designAgreements).where(eq(designAgreements.siteId, id));
  await db.delete(siteVisits).where(eq(siteVisits.siteId, id));

  const simRuns = await db.select().from(simulationRuns).where(eq(simulationRuns.siteId, id));
  for (const run of simRuns) {
    const designsForRun = await db.select().from(designs).where(eq(designs.simulationRunId, run.id));
    for (const design of designsForRun) {
      await db.delete(bomItems).where(eq(bomItems.designId, design.id));
    }
    await db.delete(designs).where(eq(designs.simulationRunId, run.id));
  }
  await db.delete(simulationRuns).where(eq(simulationRuns.siteId, id));

  const files = await db.select().from(meterFiles).where(eq(meterFiles.siteId, id));
  for (const file of files) {
    await db.delete(meterReadings).where(eq(meterReadings.meterFileId, file.id));
  }
  await db.delete(meterFiles).where(eq(meterFiles.siteId, id));
  await db.delete(roofPolygons).where(eq(roofPolygons.siteId, id));

  const result = await db.delete(sites).where(eq(sites.id, id)).returning();
  return result.length > 0;
}

// ==================== METER FILES ====================

export async function getMeterFiles(siteId: string): Promise<MeterFile[]> {
  return db.select().from(meterFiles).where(eq(meterFiles.siteId, siteId));
}

export async function getMeterFile(id: string): Promise<MeterFile | undefined> {
  const result = await db.select().from(meterFiles).where(eq(meterFiles.id, id)).limit(1);
  return result[0];
}

export async function createMeterFile(file: InsertMeterFile): Promise<MeterFile> {
  const [result] = await db.insert(meterFiles).values({
    ...file,
    status: "UPLOADED",
  }).returning();
  return result;
}

export async function updateMeterFile(id: string, file: Partial<MeterFile>): Promise<MeterFile | undefined> {
  const [result] = await db.update(meterFiles).set(file).where(eq(meterFiles.id, id)).returning();
  return result;
}

// ==================== METER READINGS ====================

export async function getMeterReadings(meterFileId: string): Promise<MeterReading[]> {
  return db.select().from(meterReadings).where(eq(meterReadings.meterFileId, meterFileId));
}

export async function getMeterReadingsBySite(siteId: string): Promise<MeterReading[]> {
  const files = await getMeterFiles(siteId);
  const fileIds = files.map(f => f.id);
  if (fileIds.length === 0) return [];

  const results: MeterReading[] = [];
  for (const fileId of fileIds) {
    const readings = await db.select().from(meterReadings).where(eq(meterReadings.meterFileId, fileId));
    results.push(...readings);
  }
  return results;
}

export async function getMeterReadingsByMeter(meterId: string): Promise<MeterReading[]> {
  const files = await db.select().from(meterFiles).where(eq(meterFiles.meterId, meterId));
  const fileIds = files.map(f => f.id);
  if (fileIds.length === 0) return [];

  const results: MeterReading[] = [];
  for (const fileId of fileIds) {
    const readings = await db.select().from(meterReadings).where(eq(meterReadings.meterFileId, fileId));
    results.push(...readings);
  }
  return results;
}

export async function getSimulationRunsByMeter(meterId: string): Promise<SimulationRun[]> {
  return db.select().from(simulationRuns)
    .where(eq(simulationRuns.meterId, meterId))
    .orderBy(desc(simulationRuns.createdAt));
}

export async function createMeterReadings(readings: InsertMeterReading[]): Promise<MeterReading[]> {
  if (readings.length === 0) return [];
  const results = await db.insert(meterReadings).values(readings).returning();
  return results;
}

// ==================== ROOF POLYGONS ====================

export async function getRoofPolygons(siteId: string): Promise<RoofPolygon[]> {
  return db.select().from(roofPolygons)
    .where(eq(roofPolygons.siteId, siteId))
    .orderBy(desc(roofPolygons.createdAt));
}

export async function getRoofPolygon(id: string): Promise<RoofPolygon | undefined> {
  const [result] = await db.select().from(roofPolygons).where(eq(roofPolygons.id, id)).limit(1);
  return result;
}

export async function createRoofPolygon(polygon: InsertRoofPolygon): Promise<RoofPolygon> {
  const [result] = await db.insert(roofPolygons).values(polygon).returning();
  return result;
}

export async function updateRoofPolygon(id: string, polygon: Partial<RoofPolygon>): Promise<RoofPolygon | undefined> {
  const { id: _id, siteId, createdBy, createdAt, ...allowedFields } = polygon;

  const [result] = await db.update(roofPolygons)
    .set({ ...allowedFields, updatedAt: new Date() })
    .where(eq(roofPolygons.id, id))
    .returning();
  return result;
}

export async function deleteRoofPolygon(id: string): Promise<boolean> {
  const result = await db.delete(roofPolygons).where(eq(roofPolygons.id, id)).returning();
  return result.length > 0;
}

export async function deleteRoofPolygonsBySite(siteId: string): Promise<number> {
  const result = await db.delete(roofPolygons).where(eq(roofPolygons.siteId, siteId)).returning();
  return result.length;
}

export async function getSiteCascadeCounts(siteId: string): Promise<{ simulations: number; meterFiles: number; designAgreements: number; siteVisits: number }> {
  const [simCount] = await db.select({ count: count() }).from(simulationRuns).where(eq(simulationRuns.siteId, siteId));
  const [mfCount] = await db.select({ count: count() }).from(meterFiles).where(eq(meterFiles.siteId, siteId));
  const [daCount] = await db.select({ count: count() }).from(designAgreements).where(eq(designAgreements.siteId, siteId));
  const [svCount] = await db.select({ count: count() }).from(siteVisits).where(eq(siteVisits.siteId, siteId));
  return {
    simulations: Number(simCount.count),
    meterFiles: Number(mfCount.count),
    designAgreements: Number(daCount.count),
    siteVisits: Number(svCount.count),
  };
}

export async function cascadeDeleteSite(siteId: string): Promise<boolean> {
  return deleteSite(siteId);
}

// ==================== TARIFF PROPAGATION ====================

export async function propagateTariffToSite(siteId: string): Promise<void> {
  const meters = await db.select().from(siteMeters).where(eq(siteMeters.siteId, siteId));
  const meterWithTariff = meters.find(m => m.tariffCode);
  if (!meterWithTariff || !meterWithTariff.tariffCode) return;

  await applyTariffToSite(siteId, meterWithTariff.tariffCode);
}

export async function applyTariffToSite(siteId: string, tariffCode: string): Promise<void> {
  const normalizedCode = tariffCode.toUpperCase().trim().charAt(0);
  if (!normalizedCode) return;

  let energyRate: number;
  let demandRate: number;
  try {
    const rates = getSimplifiedRates(normalizedCode);
    energyRate = rates.energyRate;
    demandRate = normalizedCode === "G" || normalizedCode === "D" ? 0 : rates.demandRate;
  } catch {
    return;
  }

  const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
  if (!site) return;

  const existing = (site.analysisAssumptions as AnalysisAssumptions | null) || defaultAnalysisAssumptions;
  const updated: AnalysisAssumptions = {
    ...existing,
    tariffCode: normalizedCode,
    tariffEnergy: energyRate,
    tariffPower: demandRate,
  };

  await db.update(sites).set({
    analysisAssumptions: updated,
    hqTariffDetail: tariffCode,
    updatedAt: new Date(),
  }).where(eq(sites.id, siteId));
}
