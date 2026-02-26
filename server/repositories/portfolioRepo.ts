import { eq, desc, and, inArray } from "drizzle-orm";
import { db } from "../db";
import { portfolios, portfolioSites, sites, clients, simulationRuns } from "@shared/schema";
import type {
  Portfolio, InsertPortfolio, PortfolioWithSites,
  PortfolioSite, InsertPortfolioSite, PortfolioSiteWithDetails,
  Site,
} from "@shared/schema";

// ==================== PORTFOLIOS ====================

export async function getPortfolios(): Promise<PortfolioWithSites[]> {
  const allPortfolios = await db.select().from(portfolios).orderBy(desc(portfolios.createdAt));

  const clientIds = Array.from(new Set(allPortfolios.map(p => p.clientId)));
  const relevantClients = clientIds.length > 0
    ? await db.select().from(clients).where(inArray(clients.id, clientIds))
    : [];
  const clientMap = new Map(relevantClients.map(c => [c.id, c]));

  const allPortfolioSites = await db.select().from(portfolioSites);
  const allSitesList = await db.select().from(sites);
  const siteMap = new Map(allSitesList.map(s => [s.id, s]));

  return allPortfolios.map(portfolio => {
    const linkedSiteIds = allPortfolioSites
      .filter(ps => ps.portfolioId === portfolio.id)
      .map(ps => ps.siteId);
    const portfolioSiteList = linkedSiteIds
      .map(id => siteMap.get(id))
      .filter((s): s is Site => s !== undefined);
    return {
      ...portfolio,
      client: clientMap.get(portfolio.clientId)!,
      sites: portfolioSiteList,
    };
  });
}

export async function getPortfolio(id: string): Promise<PortfolioWithSites | undefined> {
  const [portfolio] = await db.select().from(portfolios).where(eq(portfolios.id, id)).limit(1);
  if (!portfolio) return undefined;

  const [client] = await db.select().from(clients).where(eq(clients.id, portfolio.clientId)).limit(1);
  const psEntries = await db.select().from(portfolioSites).where(eq(portfolioSites.portfolioId, id));
  const siteIds = psEntries.map(ps => ps.siteId);
  const allSites = await db.select().from(sites);
  const portfolioSiteList = allSites.filter(s => siteIds.includes(s.id));

  return {
    ...portfolio,
    client: client!,
    sites: portfolioSiteList,
  };
}

export async function getPortfoliosByClient(clientId: string): Promise<PortfolioWithSites[]> {
  const clientPortfolios = await db.select().from(portfolios)
    .where(eq(portfolios.clientId, clientId))
    .orderBy(desc(portfolios.createdAt));

  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  const allPortfolioSites = await db.select().from(portfolioSites);
  const allSites = await db.select().from(sites);

  return clientPortfolios.map(portfolio => {
    const psEntries = allPortfolioSites.filter(ps => ps.portfolioId === portfolio.id);
    const portfolioSiteList = psEntries
      .map(ps => allSites.find(s => s.id === ps.siteId))
      .filter((s): s is Site => s !== undefined);
    return {
      ...portfolio,
      client: client!,
      sites: portfolioSiteList,
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

  const portfolioSitesList = await db.select().from(sites)
    .where(inArray(sites.id, siteIds));

  const relevantSimulations = await db.select({
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
  }).from(simulationRuns)
    .where(inArray(simulationRuns.siteId, siteIds))
    .orderBy(desc(simulationRuns.createdAt));

  return entries.map(ps => {
    const site = portfolioSitesList.find(s => s.id === ps.siteId)!;
    const siteSimulations = relevantSimulations
      .filter(s => s.siteId === ps.siteId);
    const latestSimulation = siteSimulations.find(s => s.type === "SCENARIO") || siteSimulations[0];
    return {
      ...ps,
      site,
      latestSimulation,
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
