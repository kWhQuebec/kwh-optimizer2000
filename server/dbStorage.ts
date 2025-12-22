import { eq, desc, and, inArray, count, sum, sql } from "drizzle-orm";
import { db } from "./db";
import {
  users, leads, clients, sites, meterFiles, meterReadings,
  simulationRuns, designs, bomItems, componentCatalog, siteVisits, siteVisitPhotos, designAgreements,
  portfolios, portfolioSites, blogArticles, procurationSignatures, emailLogs,
  competitors, battleCards, marketNotes, marketDocuments,
  constructionAgreements, constructionMilestones, constructionProjects, constructionTasks, omContracts, omVisits, omPerformanceSnapshots,
  opportunities, activities, partnerships,
} from "@shared/schema";
import type {
  User, InsertUser,
  Lead, InsertLead,
  Client, InsertClient,
  Site, InsertSite,
  MeterFile, InsertMeterFile,
  MeterReading, InsertMeterReading,
  SimulationRun, InsertSimulationRun, SimulationRunSummary,
  Design, InsertDesign,
  BomItem, InsertBomItem,
  ComponentCatalog, InsertComponentCatalog,
  SiteVisit, InsertSiteVisit,
  SiteVisitWithSite,
  SiteVisitPhoto, InsertSiteVisitPhoto,
  DesignAgreement, InsertDesignAgreement,
  Portfolio, InsertPortfolio,
  PortfolioSite, InsertPortfolioSite,
  PortfolioWithSites,
  PortfolioSiteWithDetails,
  BlogArticle, InsertBlogArticle,
  ProcurationSignature, InsertProcurationSignature,
  EmailLog, InsertEmailLog,
  Competitor, InsertCompetitor,
  BattleCard, InsertBattleCard,
  BattleCardWithCompetitor,
  MarketNote, InsertMarketNote,
  MarketDocument, InsertMarketDocument,
  ConstructionAgreement, InsertConstructionAgreement,
  ConstructionMilestone, InsertConstructionMilestone,
  ConstructionProject, InsertConstructionProject,
  ConstructionTask, InsertConstructionTask,
  OmContract, InsertOmContract,
  OmVisit, InsertOmVisit,
  OmPerformanceSnapshot, InsertOmPerformanceSnapshot,
  Opportunity, InsertOpportunity,
  Activity, InsertActivity,
  Partnership, InsertPartnership,
} from "@shared/schema";
import type { IStorage } from "./storage";
import bcrypt from "bcrypt";

export class DatabaseStorage implements IStorage {
  async initializeDefaultData(): Promise<void> {
    // Check for new admin email first
    const existingAdmin = await db.select().from(users).where(eq(users.email, "info@kwh.quebec")).limit(1);
    if (existingAdmin.length === 0) {
      const adminPassword = process.env.ADMIN_PASSWORD;
      if (!adminPassword) {
        throw new Error("ADMIN_PASSWORD environment variable is required");
      }
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      await db.insert(users).values({
        email: "info@kwh.quebec",
        passwordHash,
        role: "admin",
      });
    }

    const existingCatalog = await db.select().from(componentCatalog).limit(1);
    if (existingCatalog.length === 0) {
      const defaultItems = [
        { category: "MODULE", manufacturer: "Canadian Solar", model: "CS6R-410MS", unitCost: 180, unitSellPrice: 250, active: true },
        { category: "MODULE", manufacturer: "JA Solar", model: "JAM72S20-455", unitCost: 195, unitSellPrice: 270, active: true },
        { category: "MODULE", manufacturer: "Longi", model: "LR5-72HBD-545M", unitCost: 210, unitSellPrice: 290, active: true },
        { category: "INVERTER", manufacturer: "SMA", model: "Sunny Tripower 25000TL", unitCost: 3500, unitSellPrice: 4500, active: true },
        { category: "INVERTER", manufacturer: "Fronius", model: "Symo 24.0-3-M", unitCost: 3200, unitSellPrice: 4200, active: true },
        { category: "INVERTER", manufacturer: "Huawei", model: "SUN2000-100KTL-M1", unitCost: 8500, unitSellPrice: 11000, active: true },
        { category: "BATTERY", manufacturer: "Tesla", model: "Megapack 2", unitCost: 450000, unitSellPrice: 580000, active: true },
        { category: "BATTERY", manufacturer: "BYD", model: "Battery-Box Premium HVS", unitCost: 8500, unitSellPrice: 11000, active: true },
        { category: "BATTERY", manufacturer: "LG Chem", model: "RESU16H Prime", unitCost: 9000, unitSellPrice: 12000, active: true },
      ];
      await db.insert(componentCatalog).values(defaultItems);
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const [result] = await db.insert(users).values(user).returning();
    return result;
  }

  async getUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  async getLeads(): Promise<Lead[]> {
    return db.select().from(leads).orderBy(desc(leads.createdAt));
  }

  async getLead(id: string): Promise<Lead | undefined> {
    const result = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
    return result[0];
  }

  async createLead(lead: InsertLead): Promise<Lead> {
    const [result] = await db.insert(leads).values({
      ...lead,
      source: "web_form",
    }).returning();
    return result;
  }

  async updateLead(id: string, lead: Partial<Lead>): Promise<Lead | undefined> {
    const [result] = await db.update(leads).set({ ...lead, updatedAt: new Date() }).where(eq(leads.id, id)).returning();
    return result;
  }

  async getClients(): Promise<(Client & { sites: Site[] })[]> {
    const allClients = await db.select().from(clients).orderBy(desc(clients.createdAt));
    const allSites = await db.select().from(sites);
    
    return allClients.map(client => ({
      ...client,
      sites: allSites.filter(s => s.clientId === client.id),
    }));
  }

  async getClient(id: string): Promise<Client | undefined> {
    const result = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
    return result[0];
  }

  async createClient(client: InsertClient): Promise<Client> {
    const [result] = await db.insert(clients).values(client).returning();
    return result;
  }

  async updateClient(id: string, client: Partial<Client>): Promise<Client | undefined> {
    const [result] = await db.update(clients).set({ ...client, updatedAt: new Date() }).where(eq(clients.id, id)).returning();
    return result;
  }

  async deleteClient(id: string): Promise<boolean> {
    const result = await db.delete(clients).where(eq(clients.id, id)).returning();
    return result.length > 0;
  }

  async getSites(): Promise<(Site & { client: Client })[]> {
    const allSites = await db.select().from(sites).orderBy(desc(sites.createdAt));
    const allClients = await db.select().from(clients);
    const clientMap = new Map(allClients.map(c => [c.id, c]));
    
    return allSites.map(site => ({
      ...site,
      client: clientMap.get(site.clientId)!,
    })).filter(s => s.client);
  }

  // Optimized lightweight query for sites list - excludes heavy JSON columns
  async getSitesListPaginated(options: {
    limit?: number;
    offset?: number;
    search?: string;
    clientId?: string;
  } = {}): Promise<{
    sites: Array<{
      id: string;
      name: string;
      address: string | null;
      city: string | null;
      province: string | null;
      postalCode: string | null;
      analysisAvailable: boolean | null;
      createdAt: Date | null;
      clientId: string;
      clientName: string;
      hasSimulation: boolean;
      hasDesignAgreement: boolean;
    }>;
    total: number;
  }> {
    const { limit = 50, offset = 0, search, clientId } = options;
    
    // Build lightweight query - only essential columns, no heavy JSON
    let query = db.select({
      id: sites.id,
      name: sites.name,
      address: sites.address,
      city: sites.city,
      province: sites.province,
      postalCode: sites.postalCode,
      analysisAvailable: sites.analysisAvailable,
      createdAt: sites.createdAt,
      clientId: sites.clientId,
      clientName: clients.name,
    })
    .from(sites)
    .innerJoin(clients, eq(sites.clientId, clients.id))
    .orderBy(desc(sites.createdAt));
    
    // Apply filters
    const conditions = [];
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
    
    // Get total count (without limit/offset)
    const countQuery = db.select({ count: sql<number>`count(*)` })
      .from(sites)
      .innerJoin(clients, eq(sites.clientId, clients.id));
    
    if (conditions.length > 0) {
      (countQuery as any).where(and(...conditions));
    }
    
    const [{ count: total }] = await countQuery;
    
    // Apply pagination
    const paginatedSites = await query.limit(limit).offset(offset);
    
    // Get simulation and design agreement status in bulk (much faster than per-site)
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

  async getSite(id: string): Promise<(Site & { client: Client; meterFiles: MeterFile[]; simulationRuns: SimulationRunSummary[] }) | undefined> {
    // First get the site to get the clientId
    const [site] = await db.select().from(sites).where(eq(sites.id, id)).limit(1);
    if (!site) return undefined;
    
    // Parallel fetch: client, meter files, and simulation runs (lightweight - excludes heavy JSON columns)
    const [clientResult, siteFiles, simRuns] = await Promise.all([
      db.select().from(clients).where(eq(clients.id, site.clientId)).limit(1),
      db.select().from(meterFiles).where(eq(meterFiles.siteId, id)),
      // Lightweight query: exclude heavy JSON columns (cashflows, breakdown, hourlyProfile, peakWeekData, sensitivity)
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

  async getSimulationRunFull(id: string): Promise<SimulationRun | undefined> {
    const [run] = await db.select().from(simulationRuns).where(eq(simulationRuns.id, id)).limit(1);
    return run;
  }

  async getSitesByClient(clientId: string): Promise<Site[]> {
    return db.select().from(sites).where(eq(sites.clientId, clientId));
  }

  async createSite(site: InsertSite): Promise<Site> {
    const [result] = await db.insert(sites).values({
      ...site,
      analysisAvailable: false,
    }).returning();
    return result;
  }

  async updateSite(id: string, site: Partial<Site>): Promise<Site | undefined> {
    const [result] = await db.update(sites).set({ ...site, updatedAt: new Date() }).where(eq(sites.id, id)).returning();
    return result;
  }

  async deleteSite(id: string): Promise<boolean> {
    // Cascade delete: delete all related data first
    
    // 1. Delete design agreements for this site
    await db.delete(designAgreements).where(eq(designAgreements.siteId, id));
    
    // 2. Delete site visits for this site
    await db.delete(siteVisits).where(eq(siteVisits.siteId, id));
    
    // 3. Get all simulation runs for this site
    const simRuns = await db.select().from(simulationRuns).where(eq(simulationRuns.siteId, id));
    
    // 4. Get all designs linked to those simulation runs and delete their BOM items first
    for (const run of simRuns) {
      const designsForRun = await db.select().from(designs).where(eq(designs.simulationRunId, run.id));
      for (const design of designsForRun) {
        await db.delete(bomItems).where(eq(bomItems.designId, design.id));
      }
      // 5. Now delete the designs
      await db.delete(designs).where(eq(designs.simulationRunId, run.id));
    }
    
    // 6. Delete all simulation runs for this site
    await db.delete(simulationRuns).where(eq(simulationRuns.siteId, id));
    
    // 6. Get all meter files for this site
    const files = await db.select().from(meterFiles).where(eq(meterFiles.siteId, id));
    
    // 7. Delete meter readings linked to those files
    for (const file of files) {
      await db.delete(meterReadings).where(eq(meterReadings.meterFileId, file.id));
    }
    
    // 8. Delete all meter files for this site
    await db.delete(meterFiles).where(eq(meterFiles.siteId, id));
    
    // 9. Finally delete the site
    const result = await db.delete(sites).where(eq(sites.id, id)).returning();
    return result.length > 0;
  }

  async getMeterFiles(siteId: string): Promise<MeterFile[]> {
    return db.select().from(meterFiles).where(eq(meterFiles.siteId, siteId));
  }

  async getMeterFile(id: string): Promise<MeterFile | undefined> {
    const result = await db.select().from(meterFiles).where(eq(meterFiles.id, id)).limit(1);
    return result[0];
  }

  async createMeterFile(file: InsertMeterFile): Promise<MeterFile> {
    const [result] = await db.insert(meterFiles).values({
      ...file,
      status: "UPLOADED",
    }).returning();
    return result;
  }

  async updateMeterFile(id: string, file: Partial<MeterFile>): Promise<MeterFile | undefined> {
    const [result] = await db.update(meterFiles).set(file).where(eq(meterFiles.id, id)).returning();
    return result;
  }

  async getMeterReadings(meterFileId: string): Promise<MeterReading[]> {
    return db.select().from(meterReadings).where(eq(meterReadings.meterFileId, meterFileId));
  }

  async getMeterReadingsBySite(siteId: string): Promise<MeterReading[]> {
    const files = await this.getMeterFiles(siteId);
    const fileIds = files.map(f => f.id);
    if (fileIds.length === 0) return [];
    
    const results: MeterReading[] = [];
    for (const fileId of fileIds) {
      const readings = await db.select().from(meterReadings).where(eq(meterReadings.meterFileId, fileId));
      results.push(...readings);
    }
    return results;
  }

  async createMeterReadings(readings: InsertMeterReading[]): Promise<MeterReading[]> {
    if (readings.length === 0) return [];
    const results = await db.insert(meterReadings).values(readings).returning();
    return results;
  }

  async getSimulationRuns(): Promise<(SimulationRun & { site: Site & { client: Client } })[]> {
    const allRuns = await db.select().from(simulationRuns).orderBy(desc(simulationRuns.createdAt));
    const allSites = await db.select().from(sites);
    const allClients = await db.select().from(clients);
    
    const siteMap = new Map(allSites.map(s => [s.id, s]));
    const clientMap = new Map(allClients.map(c => [c.id, c]));
    
    return allRuns.map(run => {
      const site = siteMap.get(run.siteId);
      const client = site ? clientMap.get(site.clientId) : undefined;
      return {
        ...run,
        site: { ...site!, client: client! },
      };
    }).filter(r => r.site && r.site.client);
  }

  async getSimulationRun(id: string): Promise<(SimulationRun & { site: Site & { client: Client } }) | undefined> {
    const [run] = await db.select().from(simulationRuns).where(eq(simulationRuns.id, id)).limit(1);
    if (!run) return undefined;
    
    const [site] = await db.select().from(sites).where(eq(sites.id, run.siteId)).limit(1);
    if (!site) return undefined;
    
    const [client] = await db.select().from(clients).where(eq(clients.id, site.clientId)).limit(1);
    if (!client) return undefined;
    
    return { ...run, site: { ...site, client } };
  }

  async getSimulationRunsBySite(siteId: string): Promise<SimulationRun[]> {
    return db.select().from(simulationRuns).where(eq(simulationRuns.siteId, siteId));
  }

  async createSimulationRun(run: InsertSimulationRun): Promise<SimulationRun> {
    const [result] = await db.insert(simulationRuns).values(run).returning();
    return result;
  }

  async getDesigns(): Promise<(Design & { simulationRun: SimulationRun & { site: Site & { client: Client } } })[]> {
    const allDesigns = await db.select().from(designs).orderBy(desc(designs.createdAt));
    const allRuns = await db.select().from(simulationRuns);
    const allSites = await db.select().from(sites);
    const allClients = await db.select().from(clients);
    
    const runMap = new Map(allRuns.map(r => [r.id, r]));
    const siteMap = new Map(allSites.map(s => [s.id, s]));
    const clientMap = new Map(allClients.map(c => [c.id, c]));
    
    return allDesigns.map(design => {
      const simRun = runMap.get(design.simulationRunId);
      const site = simRun ? siteMap.get(simRun.siteId) : undefined;
      const client = site ? clientMap.get(site.clientId) : undefined;
      return {
        ...design,
        simulationRun: { ...simRun!, site: { ...site!, client: client! } },
      };
    }).filter(d => d.simulationRun && d.simulationRun.site && d.simulationRun.site.client);
  }

  async getDesign(id: string): Promise<(Design & { bomItems: BomItem[] }) | undefined> {
    const [design] = await db.select().from(designs).where(eq(designs.id, id)).limit(1);
    if (!design) return undefined;
    
    const items = await db.select().from(bomItems).where(eq(bomItems.designId, id));
    return { ...design, bomItems: items };
  }

  async createDesign(design: InsertDesign): Promise<Design> {
    const [result] = await db.insert(designs).values(design).returning();
    return result;
  }

  async updateDesign(id: string, design: Partial<Design>): Promise<Design | undefined> {
    const [result] = await db.update(designs).set(design).where(eq(designs.id, id)).returning();
    return result;
  }

  async getBomItems(designId: string): Promise<BomItem[]> {
    return db.select().from(bomItems).where(eq(bomItems.designId, designId));
  }

  async createBomItems(items: InsertBomItem[]): Promise<BomItem[]> {
    if (items.length === 0) return [];
    const results = await db.insert(bomItems).values(items).returning();
    return results;
  }

  async getCatalog(): Promise<ComponentCatalog[]> {
    return db.select().from(componentCatalog);
  }

  async getCatalogItem(id: string): Promise<ComponentCatalog | undefined> {
    const result = await db.select().from(componentCatalog).where(eq(componentCatalog.id, id)).limit(1);
    return result[0];
  }

  async getCatalogByCategory(category: string): Promise<ComponentCatalog[]> {
    return db.select().from(componentCatalog).where(eq(componentCatalog.category, category));
  }

  async createCatalogItem(item: InsertComponentCatalog): Promise<ComponentCatalog> {
    const [result] = await db.insert(componentCatalog).values({
      ...item,
      active: item.active ?? true,
    }).returning();
    return result;
  }

  async updateCatalogItem(id: string, item: Partial<ComponentCatalog>): Promise<ComponentCatalog | undefined> {
    const [result] = await db.update(componentCatalog).set(item).where(eq(componentCatalog.id, id)).returning();
    return result;
  }

  async deleteCatalogItem(id: string): Promise<boolean> {
    const result = await db.delete(componentCatalog).where(eq(componentCatalog.id, id)).returning();
    return result.length > 0;
  }

  async getDashboardStats(): Promise<{
    totalSites: number;
    activeAnalyses: number;
    totalSavings: number;
    co2Avoided: number;
    recentSites: Site[];
    recentAnalyses: SimulationRun[];
  }> {
    // Use SQL aggregations instead of loading entire tables
    const [siteCountResult] = await db.select({ count: count() }).from(sites);
    const [analysisAggResult] = await db.select({
      count: count(),
      totalSavings: sum(simulationRuns.annualSavings),
      co2Avoided: sum(simulationRuns.co2AvoidedTonnesPerYear),
    }).from(simulationRuns);
    
    // Only load recent records (limited to 5)
    const recentSites = await db.select().from(sites).orderBy(desc(sites.createdAt)).limit(5);
    const recentAnalyses = await db.select().from(simulationRuns).orderBy(desc(simulationRuns.createdAt)).limit(5);
    
    return {
      totalSites: Number(siteCountResult?.count) || 0,
      activeAnalyses: Number(analysisAggResult?.count) || 0,
      totalSavings: Number(analysisAggResult?.totalSavings) || 0,
      co2Avoided: Number(analysisAggResult?.co2Avoided) || 0,
      recentSites,
      recentAnalyses,
    };
  }

  async getPipelineStats(): Promise<{
    totalPipelineValue: number;
    weightedPipelineValue: number;
    wonValue: number;
    lostValue: number;
    deliveryBacklogValue: number;
    deliveryBacklogCount: number;
    deliveredValue: number;
    deliveredCount: number;
    activeOpportunityCount: number;
    stageBreakdown: Array<{
      stage: string;
      count: number;
      totalValue: number;
      weightedValue: number;
    }>;
    topOpportunities: Array<{
      id: string;
      name: string;
      clientName: string | null;
      stage: string;
      probability: number;
      estimatedValue: number | null;
      updatedAt: Date | null;
    }>;
    atRiskOpportunities: Array<{
      id: string;
      name: string;
      clientName: string | null;
      stage: string;
      estimatedValue: number | null;
      daysSinceUpdate: number;
    }>;
    recentWins: Array<{
      id: string;
      name: string;
      clientName: string | null;
      estimatedValue: number | null;
      updatedAt: Date | null;
    }>;
  }> {
    const STAGE_PROBABILITIES: Record<string, number> = {
      prospect: 5,
      qualified: 15,
      proposal: 25,
      design_signed: 50,
      negotiation: 75,
      won_to_be_delivered: 100,
      won_in_construction: 100,
      won_delivered: 100,
      won: 100,
      lost: 0,
    };

    // Get all opportunities with client info (including portfolioId for auto-sync)
    const allOppsRaw = await db
      .select({
        id: opportunities.id,
        name: opportunities.name,
        stage: opportunities.stage,
        probability: opportunities.probability,
        estimatedValue: opportunities.estimatedValue,
        pvSizeKW: opportunities.pvSizeKW,
        createdAt: opportunities.createdAt,
        updatedAt: opportunities.updatedAt,
        clientId: opportunities.clientId,
        portfolioId: opportunities.portfolioId,
      })
      .from(opportunities);

    // Get portfolio KPIs for opportunities linked to portfolios (auto-sync feature)
    const portfolioIds = Array.from(new Set(allOppsRaw.filter(o => o.portfolioId).map(o => o.portfolioId!)));
    const portfolioKPIs = new Map<string, { totalCapex: number; totalPvKW: number }>();
    
    if (portfolioIds.length > 0) {
      // Get aggregated KPIs from portfolio_sites for each portfolio
      for (const portfolioId of portfolioIds) {
        const pSites = await db.select().from(portfolioSites).where(eq(portfolioSites.portfolioId, portfolioId));
        const siteIds = pSites.map(ps => ps.siteId);
        
        // Get latest simulations for each site
        const latestSims = new Map<string, typeof simulationRuns.$inferSelect>();
        if (siteIds.length > 0) {
          const sims = await db.select().from(simulationRuns).where(inArray(simulationRuns.siteId, siteIds));
          for (const sim of sims) {
            const existing = latestSims.get(sim.siteId);
            if (!existing || (sim.createdAt && existing.createdAt && new Date(sim.createdAt) > new Date(existing.createdAt))) {
              latestSims.set(sim.siteId, sim);
            }
          }
        }
        
        // Aggregate using override values when present (same logic as /api/portfolios/:id/full)
        let totalCapex = 0;
        let totalPvKW = 0;
        for (const ps of pSites) {
          const sim = latestSims.get(ps.siteId);
          // Prioritize override values over simulation values
          const capex = ps.overrideCapexNet ?? sim?.capexNet ?? 0;
          const pvKW = ps.overridePvSizeKW ?? sim?.pvSizeKW ?? 0;
          totalCapex += capex;
          totalPvKW += pvKW;
        }
        portfolioKPIs.set(portfolioId, { totalCapex, totalPvKW });
      }
    }

    // Map opportunities with portfolio KPIs auto-synced
    const allOpps = allOppsRaw.map(o => {
      if (o.portfolioId && portfolioKPIs.has(o.portfolioId)) {
        const kpis = portfolioKPIs.get(o.portfolioId)!;
        return {
          ...o,
          estimatedValue: kpis.totalCapex, // Auto-sync from portfolio
          pvSizeKW: kpis.totalPvKW,
        };
      }
      return o;
    });

    // Get client names
    const clientIds = Array.from(new Set(allOpps.filter(o => o.clientId).map(o => o.clientId!)));
    const clientsList = clientIds.length > 0
      ? await db.select({ id: clients.id, name: clients.name }).from(clients).where(inArray(clients.id, clientIds))
      : [];
    const clientMap = new Map(clientsList.map(c => [c.id, c.name]));

    // Helper to check if a stage is a "won" stage
    const WON_STAGES = ['won_to_be_delivered', 'won_in_construction', 'won_delivered'];
    const isWonStage = (stage: string) => WON_STAGES.includes(stage);

    // Filter active opportunities (not won or lost)
    const activeOpps = allOpps.filter(o => !isWonStage(o.stage) && o.stage !== 'lost');
    const wonOpps = allOpps.filter(o => isWonStage(o.stage));
    const lostOpps = allOpps.filter(o => o.stage === 'lost');

    // Calculate totals
    const totalPipelineValue = activeOpps.reduce((sum, o) => sum + (o.estimatedValue || 0), 0);
    const weightedPipelineValue = activeOpps.reduce((sum, o) => {
      const prob = o.probability ?? STAGE_PROBABILITIES[o.stage] ?? 0;
      return sum + ((o.estimatedValue || 0) * prob / 100);
    }, 0);
    const wonValue = wonOpps.reduce((sum, o) => sum + (o.estimatedValue || 0), 0);
    const lostValue = lostOpps.reduce((sum, o) => sum + (o.estimatedValue || 0), 0);
    
    // Delivery phase breakdown
    const deliveryBacklogValue = allOpps
      .filter(o => o.stage === 'won_to_be_delivered' || o.stage === 'won_in_construction')
      .reduce((sum, o) => sum + (o.estimatedValue || 0), 0);
    const deliveredValue = allOpps
      .filter(o => o.stage === 'won_delivered')
      .reduce((sum, o) => sum + (o.estimatedValue || 0), 0);
    const deliveryBacklogCount = allOpps.filter(o => o.stage === 'won_to_be_delivered' || o.stage === 'won_in_construction').length;
    const deliveredCount = allOpps.filter(o => o.stage === 'won_delivered').length;

    // Stage breakdown - use per-opportunity probability for weighted value
    const stages = ['prospect', 'qualified', 'proposal', 'design_signed', 'negotiation', 'won_to_be_delivered', 'won_in_construction', 'won_delivered', 'lost'];
    const stageBreakdown = stages.map(stage => {
      const stageOpps = allOpps.filter(o => o.stage === stage);
      const totalValue = stageOpps.reduce((sum, o) => sum + (o.estimatedValue || 0), 0);
      // Sum weighted values using each opportunity's actual probability
      const weightedValue = stageOpps.reduce((sum, o) => {
        const prob = o.probability ?? STAGE_PROBABILITIES[o.stage] ?? 0;
        return sum + ((o.estimatedValue || 0) * prob / 100);
      }, 0);
      return {
        stage,
        count: stageOpps.length,
        totalValue,
        weightedValue,
      };
    });

    // Top opportunities by value (top 5 active)
    const topOpportunities = activeOpps
      .filter(o => o.estimatedValue && o.estimatedValue > 0)
      .sort((a, b) => (b.estimatedValue || 0) - (a.estimatedValue || 0))
      .slice(0, 5)
      .map(o => ({
        id: o.id,
        name: o.name,
        clientName: o.clientId ? clientMap.get(o.clientId) || null : null,
        stage: o.stage,
        probability: o.probability ?? STAGE_PROBABILITIES[o.stage] ?? 0,
        estimatedValue: o.estimatedValue,
        updatedAt: o.updatedAt,
      }));

    // At-risk opportunities (inactive > 30 days, excluding won/lost)
    // Use updatedAt, falling back to createdAt for newly created opportunities
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const atRiskOpportunities = activeOpps
      .filter(o => {
        const lastActivity = o.updatedAt || o.createdAt;
        if (!lastActivity) return false; // No date at all = skip (shouldn't happen)
        return new Date(lastActivity) < thirtyDaysAgo;
      })
      .map(o => {
        const lastActivity = o.updatedAt || o.createdAt;
        const daysSinceUpdate = lastActivity 
          ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        return {
          id: o.id,
          name: o.name,
          clientName: o.clientId ? clientMap.get(o.clientId) || null : null,
          stage: o.stage,
          estimatedValue: o.estimatedValue,
          daysSinceUpdate,
        };
      })
      .sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate)
      .slice(0, 5);

    // Recent wins (last 5)
    const recentWins = wonOpps
      .sort((a, b) => {
        const aDate = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bDate = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bDate - aDate;
      })
      .slice(0, 5)
      .map(o => ({
        id: o.id,
        name: o.name,
        clientName: o.clientId ? clientMap.get(o.clientId) || null : null,
        estimatedValue: o.estimatedValue,
        updatedAt: o.updatedAt,
      }));

    return {
      totalPipelineValue,
      weightedPipelineValue,
      wonValue,
      lostValue,
      deliveryBacklogValue,
      deliveryBacklogCount,
      deliveredValue,
      deliveredCount,
      activeOpportunityCount: activeOpps.length,
      stageBreakdown,
      topOpportunities,
      atRiskOpportunities,
      recentWins,
    };
  }

  // Site Visits
  async getSiteVisits(): Promise<SiteVisitWithSite[]> {
    const allVisits = await db.select().from(siteVisits).orderBy(desc(siteVisits.createdAt));
    const allSites = await db.select().from(sites);
    const allClients = await db.select().from(clients);
    
    const siteMap = new Map(allSites.map(s => [s.id, s]));
    const clientMap = new Map(allClients.map(c => [c.id, c]));
    
    return allVisits.map(visit => {
      const site = siteMap.get(visit.siteId);
      const client = site ? clientMap.get(site.clientId) : undefined;
      return {
        ...visit,
        site: { ...site!, client: client! },
      };
    }).filter(v => v.site && v.site.client);
  }

  async getSiteVisit(id: string): Promise<SiteVisitWithSite | undefined> {
    const [visit] = await db.select().from(siteVisits).where(eq(siteVisits.id, id)).limit(1);
    if (!visit) return undefined;
    
    const [site] = await db.select().from(sites).where(eq(sites.id, visit.siteId)).limit(1);
    if (!site) return undefined;
    
    const [client] = await db.select().from(clients).where(eq(clients.id, site.clientId)).limit(1);
    if (!client) return undefined;
    
    return { ...visit, site: { ...site, client } };
  }

  async getSiteVisitsBySite(siteId: string): Promise<SiteVisit[]> {
    return db.select().from(siteVisits).where(eq(siteVisits.siteId, siteId)).orderBy(desc(siteVisits.createdAt));
  }

  async createSiteVisit(visit: InsertSiteVisit): Promise<SiteVisit> {
    const [result] = await db.insert(siteVisits).values(visit).returning();
    return result;
  }

  async updateSiteVisit(id: string, visit: Partial<SiteVisit>): Promise<SiteVisit | undefined> {
    const [result] = await db.update(siteVisits).set({ ...visit, updatedAt: new Date() }).where(eq(siteVisits.id, id)).returning();
    return result;
  }

  async deleteSiteVisit(id: string): Promise<boolean> {
    const result = await db.delete(siteVisits).where(eq(siteVisits.id, id)).returning();
    return result.length > 0;
  }

  // Site Visit Photos
  async getSiteVisitPhotos(siteId: string): Promise<SiteVisitPhoto[]> {
    return db.select().from(siteVisitPhotos)
      .where(eq(siteVisitPhotos.siteId, siteId))
      .orderBy(desc(siteVisitPhotos.uploadedAt));
  }

  async getSiteVisitPhotosByVisit(visitId: string): Promise<SiteVisitPhoto[]> {
    return db.select().from(siteVisitPhotos)
      .where(eq(siteVisitPhotos.visitId, visitId))
      .orderBy(desc(siteVisitPhotos.uploadedAt));
  }

  async createSiteVisitPhoto(photo: InsertSiteVisitPhoto): Promise<SiteVisitPhoto> {
    const [result] = await db.insert(siteVisitPhotos).values(photo).returning();
    return result;
  }

  async deleteSiteVisitPhoto(id: string): Promise<boolean> {
    const result = await db.delete(siteVisitPhotos).where(eq(siteVisitPhotos.id, id)).returning();
    return result.length > 0;
  }

  // Design Agreements
  async getDesignAgreements(): Promise<DesignAgreement[]> {
    return db.select().from(designAgreements).orderBy(desc(designAgreements.createdAt));
  }

  async getDesignAgreement(id: string): Promise<DesignAgreement | undefined> {
    const result = await db.select().from(designAgreements).where(eq(designAgreements.id, id)).limit(1);
    return result[0];
  }

  async getDesignAgreementBySite(siteId: string): Promise<DesignAgreement | undefined> {
    const result = await db.select().from(designAgreements).where(eq(designAgreements.siteId, siteId)).limit(1);
    return result[0];
  }

  async createDesignAgreement(agreement: InsertDesignAgreement): Promise<DesignAgreement> {
    const result = await db.insert(designAgreements).values(agreement).returning();
    return result[0];
  }

  async updateDesignAgreement(id: string, agreement: Partial<DesignAgreement>): Promise<DesignAgreement | undefined> {
    const result = await db.update(designAgreements)
      .set({ ...agreement, updatedAt: new Date() })
      .where(eq(designAgreements.id, id))
      .returning();
    return result[0];
  }

  async deleteDesignAgreement(id: string): Promise<boolean> {
    const result = await db.delete(designAgreements).where(eq(designAgreements.id, id)).returning();
    return result.length > 0;
  }

  // Portfolios - optimized: only load portfolio + client, use pre-computed numBuildings
  async getPortfolios(): Promise<PortfolioWithSites[]> {
    const allPortfolios = await db.select().from(portfolios).orderBy(desc(portfolios.createdAt));
    
    // Only load clients that are referenced by portfolios
    const clientIds = Array.from(new Set(allPortfolios.map(p => p.clientId)));
    const relevantClients = clientIds.length > 0 
      ? await db.select().from(clients).where(inArray(clients.id, clientIds))
      : [];
    const clientMap = new Map(relevantClients.map(c => [c.id, c]));

    // Return portfolios with client info but empty sites array (frontend uses numBuildings from portfolio record)
    return allPortfolios.map(portfolio => ({
      ...portfolio,
      client: clientMap.get(portfolio.clientId)!,
      sites: [], // Not needed for list view - numBuildings is pre-computed in portfolio record
    }));
  }

  async getPortfolio(id: string): Promise<PortfolioWithSites | undefined> {
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

  async getPortfoliosByClient(clientId: string): Promise<PortfolioWithSites[]> {
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

  async createPortfolio(portfolio: InsertPortfolio): Promise<Portfolio> {
    const [result] = await db.insert(portfolios).values(portfolio).returning();
    return result;
  }

  async updatePortfolio(id: string, portfolio: Partial<Portfolio>): Promise<Portfolio | undefined> {
    const [result] = await db.update(portfolios)
      .set({ ...portfolio, updatedAt: new Date() })
      .where(eq(portfolios.id, id))
      .returning();
    return result;
  }

  async deletePortfolio(id: string): Promise<boolean> {
    // Delete associated portfolio sites first
    await db.delete(portfolioSites).where(eq(portfolioSites.portfolioId, id));
    const result = await db.delete(portfolios).where(eq(portfolios.id, id)).returning();
    return result.length > 0;
  }

  // Portfolio Sites - optimized with SQL IN clause
  async getPortfolioSites(portfolioId: string): Promise<PortfolioSiteWithDetails[]> {
    const entries = await db.select().from(portfolioSites)
      .where(eq(portfolioSites.portfolioId, portfolioId))
      .orderBy(portfolioSites.displayOrder);
    
    if (entries.length === 0) return [];
    
    const siteIds = entries.map(ps => ps.siteId);
    
    // Single optimized query for sites using IN clause
    const portfolioSitesList = await db.select().from(sites)
      .where(inArray(sites.id, siteIds));
    
    // Single optimized query for simulations using IN clause
    const relevantSimulations = await db.select().from(simulationRuns)
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

  async isSiteInAnyPortfolio(siteId: string): Promise<boolean> {
    const result = await db.select().from(portfolioSites)
      .where(eq(portfolioSites.siteId, siteId))
      .limit(1);
    return result.length > 0;
  }

  async addSiteToPortfolio(portfolioSite: InsertPortfolioSite): Promise<PortfolioSite> {
    const [result] = await db.insert(portfolioSites).values(portfolioSite).returning();
    return result;
  }

  async removeSiteFromPortfolio(portfolioId: string, siteId: string): Promise<boolean> {
    const result = await db.delete(portfolioSites)
      .where(and(eq(portfolioSites.portfolioId, portfolioId), eq(portfolioSites.siteId, siteId)))
      .returning();
    return result.length > 0;
  }

  async updatePortfolioSite(id: string, data: Partial<PortfolioSite>): Promise<PortfolioSite | undefined> {
    const [result] = await db.update(portfolioSites)
      .set(data)
      .where(eq(portfolioSites.id, id))
      .returning();
    return result;
  }

  // Blog Articles
  async getBlogArticles(status?: string): Promise<BlogArticle[]> {
    if (status) {
      return db.select().from(blogArticles)
        .where(eq(blogArticles.status, status))
        .orderBy(desc(blogArticles.publishedAt));
    }
    return db.select().from(blogArticles).orderBy(desc(blogArticles.publishedAt));
  }

  async getBlogArticle(id: string): Promise<BlogArticle | undefined> {
    const result = await db.select().from(blogArticles).where(eq(blogArticles.id, id)).limit(1);
    return result[0];
  }

  async getBlogArticleBySlug(slug: string): Promise<BlogArticle | undefined> {
    const result = await db.select().from(blogArticles).where(eq(blogArticles.slug, slug)).limit(1);
    return result[0];
  }

  async createBlogArticle(article: InsertBlogArticle): Promise<BlogArticle> {
    const [result] = await db.insert(blogArticles).values(article).returning();
    return result;
  }

  async updateBlogArticle(id: string, article: Partial<BlogArticle>): Promise<BlogArticle | undefined> {
    const [result] = await db.update(blogArticles)
      .set({ ...article, updatedAt: new Date() })
      .where(eq(blogArticles.id, id))
      .returning();
    return result;
  }

  async deleteBlogArticle(id: string): Promise<boolean> {
    const result = await db.delete(blogArticles).where(eq(blogArticles.id, id)).returning();
    return result.length > 0;
  }

  async incrementArticleViews(id: string): Promise<void> {
    await db.update(blogArticles)
      .set({ viewCount: sql`COALESCE(${blogArticles.viewCount}, 0) + 1` })
      .where(eq(blogArticles.id, id));
  }

  // Procuration Signatures
  async getProcurationSignatures(): Promise<ProcurationSignature[]> {
    return db.select().from(procurationSignatures).orderBy(desc(procurationSignatures.createdAt));
  }

  async getProcurationSignature(id: string): Promise<ProcurationSignature | undefined> {
    const result = await db.select().from(procurationSignatures).where(eq(procurationSignatures.id, id)).limit(1);
    return result[0];
  }

  async getProcurationSignatureByLead(leadId: string): Promise<ProcurationSignature | undefined> {
    const result = await db.select().from(procurationSignatures)
      .where(eq(procurationSignatures.leadId, leadId))
      .limit(1);
    return result[0];
  }

  async createProcurationSignature(signature: InsertProcurationSignature): Promise<ProcurationSignature> {
    const [result] = await db.insert(procurationSignatures).values(signature).returning();
    return result;
  }

  async updateProcurationSignature(id: string, signature: Partial<ProcurationSignature>): Promise<ProcurationSignature | undefined> {
    const [result] = await db.update(procurationSignatures)
      .set({ ...signature, updatedAt: new Date() })
      .where(eq(procurationSignatures.id, id))
      .returning();
    return result;
  }

  // Email Logs
  async getEmailLogs(filters?: { siteId?: string; designAgreementId?: string; emailType?: string }): Promise<EmailLog[]> {
    const conditions = [];
    if (filters?.siteId) {
      conditions.push(eq(emailLogs.siteId, filters.siteId));
    }
    if (filters?.designAgreementId) {
      conditions.push(eq(emailLogs.designAgreementId, filters.designAgreementId));
    }
    if (filters?.emailType) {
      conditions.push(eq(emailLogs.emailType, filters.emailType));
    }
    
    if (conditions.length > 0) {
      return db.select().from(emailLogs).where(and(...conditions)).orderBy(desc(emailLogs.createdAt));
    }
    return db.select().from(emailLogs).orderBy(desc(emailLogs.createdAt));
  }

  async getEmailLog(id: string): Promise<EmailLog | undefined> {
    const result = await db.select().from(emailLogs).where(eq(emailLogs.id, id)).limit(1);
    return result[0];
  }

  async createEmailLog(log: InsertEmailLog): Promise<EmailLog> {
    const [result] = await db.insert(emailLogs).values(log).returning();
    return result;
  }

  async updateEmailLog(id: string, log: Partial<EmailLog>): Promise<EmailLog | undefined> {
    const [result] = await db.update(emailLogs)
      .set(log)
      .where(eq(emailLogs.id, id))
      .returning();
    return result;
  }

  // Market Intelligence - Competitors
  async getCompetitors(): Promise<Competitor[]> {
    return db.select().from(competitors)
      .where(eq(competitors.isActive, true))
      .orderBy(competitors.name);
  }

  async getCompetitor(id: string): Promise<Competitor | undefined> {
    const result = await db.select().from(competitors).where(eq(competitors.id, id)).limit(1);
    return result[0];
  }

  async createCompetitor(competitor: InsertCompetitor): Promise<Competitor> {
    const [result] = await db.insert(competitors).values(competitor).returning();
    return result;
  }

  async updateCompetitor(id: string, competitor: Partial<Competitor>): Promise<Competitor | undefined> {
    const [result] = await db.update(competitors)
      .set({ ...competitor, updatedAt: new Date() })
      .where(eq(competitors.id, id))
      .returning();
    return result;
  }

  async deleteCompetitor(id: string): Promise<boolean> {
    const result = await db.update(competitors)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(competitors.id, id))
      .returning();
    return result.length > 0;
  }

  // Market Intelligence - Battle Cards
  async getBattleCards(competitorId?: string): Promise<BattleCardWithCompetitor[]> {
    const allCards = await db.select().from(battleCards)
      .where(eq(battleCards.isActive, true))
      .orderBy(battleCards.priority);
    
    const filteredCards = competitorId 
      ? allCards.filter(c => c.competitorId === competitorId)
      : allCards;
    
    const result: BattleCardWithCompetitor[] = [];
    for (const card of filteredCards) {
      const comp = await this.getCompetitor(card.competitorId);
      if (comp) {
        result.push({ ...card, competitor: comp });
      }
    }
    return result;
  }

  async getBattleCard(id: string): Promise<BattleCardWithCompetitor | undefined> {
    const result = await db.select().from(battleCards).where(eq(battleCards.id, id)).limit(1);
    const card = result[0];
    if (!card) return undefined;
    
    const comp = await this.getCompetitor(card.competitorId);
    if (!comp) return undefined;
    
    return { ...card, competitor: comp };
  }

  async createBattleCard(battleCard: InsertBattleCard): Promise<BattleCard> {
    const [result] = await db.insert(battleCards).values(battleCard).returning();
    return result;
  }

  async updateBattleCard(id: string, battleCard: Partial<BattleCard>): Promise<BattleCard | undefined> {
    const [result] = await db.update(battleCards)
      .set({ ...battleCard, updatedAt: new Date() })
      .where(eq(battleCards.id, id))
      .returning();
    return result;
  }

  async deleteBattleCard(id: string): Promise<boolean> {
    const result = await db.update(battleCards)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(battleCards.id, id))
      .returning();
    return result.length > 0;
  }

  // Market Intelligence - Market Notes
  async getMarketNotes(category?: string): Promise<MarketNote[]> {
    if (category) {
      return db.select().from(marketNotes)
        .where(and(eq(marketNotes.status, "active"), eq(marketNotes.category, category)))
        .orderBy(desc(marketNotes.createdAt));
    }
    return db.select().from(marketNotes)
      .where(eq(marketNotes.status, "active"))
      .orderBy(desc(marketNotes.createdAt));
  }

  async getMarketNote(id: string): Promise<MarketNote | undefined> {
    const result = await db.select().from(marketNotes).where(eq(marketNotes.id, id)).limit(1);
    return result[0];
  }

  async createMarketNote(note: InsertMarketNote): Promise<MarketNote> {
    const [result] = await db.insert(marketNotes).values(note).returning();
    return result;
  }

  async updateMarketNote(id: string, note: Partial<MarketNote>): Promise<MarketNote | undefined> {
    const [result] = await db.update(marketNotes)
      .set({ ...note, updatedAt: new Date() })
      .where(eq(marketNotes.id, id))
      .returning();
    return result;
  }

  async deleteMarketNote(id: string): Promise<boolean> {
    const result = await db.update(marketNotes)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(marketNotes.id, id))
      .returning();
    return result.length > 0;
  }

  // Market Intelligence - Documents
  async getMarketDocuments(entityType?: string): Promise<MarketDocument[]> {
    if (entityType) {
      return db.select().from(marketDocuments)
        .where(eq(marketDocuments.entityType, entityType))
        .orderBy(desc(marketDocuments.createdAt));
    }
    return db.select().from(marketDocuments)
      .orderBy(desc(marketDocuments.createdAt));
  }

  async getMarketDocument(id: string): Promise<MarketDocument | undefined> {
    const result = await db.select().from(marketDocuments).where(eq(marketDocuments.id, id)).limit(1);
    return result[0];
  }

  async createMarketDocument(doc: InsertMarketDocument): Promise<MarketDocument> {
    const [result] = await db.insert(marketDocuments).values(doc).returning();
    return result;
  }

  async updateMarketDocument(id: string, doc: Partial<MarketDocument>): Promise<MarketDocument | undefined> {
    const [result] = await db.update(marketDocuments)
      .set({ ...doc, updatedAt: new Date() })
      .where(eq(marketDocuments.id, id))
      .returning();
    return result;
  }

  async deleteMarketDocument(id: string): Promise<boolean> {
    const result = await db.delete(marketDocuments)
      .where(eq(marketDocuments.id, id))
      .returning();
    return result.length > 0;
  }

  // Construction Agreements
  async getConstructionAgreements(): Promise<ConstructionAgreement[]> {
    return db.select().from(constructionAgreements).orderBy(desc(constructionAgreements.createdAt));
  }

  async getConstructionAgreement(id: string): Promise<ConstructionAgreement | undefined> {
    const result = await db.select().from(constructionAgreements).where(eq(constructionAgreements.id, id)).limit(1);
    return result[0];
  }

  async getConstructionAgreementsBySiteId(siteId: string): Promise<ConstructionAgreement[]> {
    return db.select().from(constructionAgreements)
      .where(eq(constructionAgreements.siteId, siteId))
      .orderBy(desc(constructionAgreements.createdAt));
  }

  async createConstructionAgreement(agreement: InsertConstructionAgreement): Promise<ConstructionAgreement> {
    const [result] = await db.insert(constructionAgreements).values(agreement).returning();
    return result;
  }

  async updateConstructionAgreement(id: string, agreement: Partial<ConstructionAgreement>): Promise<ConstructionAgreement | undefined> {
    const [result] = await db.update(constructionAgreements)
      .set({ ...agreement, updatedAt: new Date() })
      .where(eq(constructionAgreements.id, id))
      .returning();
    return result;
  }

  async deleteConstructionAgreement(id: string): Promise<boolean> {
    // Delete associated milestones first
    await db.delete(constructionMilestones).where(eq(constructionMilestones.constructionAgreementId, id));
    const result = await db.delete(constructionAgreements).where(eq(constructionAgreements.id, id)).returning();
    return result.length > 0;
  }

  // Construction Milestones
  async getConstructionMilestones(agreementId: string): Promise<ConstructionMilestone[]> {
    return db.select().from(constructionMilestones)
      .where(eq(constructionMilestones.constructionAgreementId, agreementId))
      .orderBy(constructionMilestones.orderIndex);
  }

  async getConstructionMilestone(id: string): Promise<ConstructionMilestone | undefined> {
    const result = await db.select().from(constructionMilestones).where(eq(constructionMilestones.id, id)).limit(1);
    return result[0];
  }

  async getConstructionMilestonesByAgreementId(agreementId: string): Promise<ConstructionMilestone[]> {
    return db.select().from(constructionMilestones)
      .where(eq(constructionMilestones.constructionAgreementId, agreementId))
      .orderBy(constructionMilestones.orderIndex);
  }

  async createConstructionMilestone(milestone: InsertConstructionMilestone): Promise<ConstructionMilestone> {
    const [result] = await db.insert(constructionMilestones).values(milestone).returning();
    return result;
  }

  async updateConstructionMilestone(id: string, milestone: Partial<ConstructionMilestone>): Promise<ConstructionMilestone | undefined> {
    const [result] = await db.update(constructionMilestones)
      .set(milestone)
      .where(eq(constructionMilestones.id, id))
      .returning();
    return result;
  }

  async deleteConstructionMilestone(id: string): Promise<boolean> {
    const result = await db.delete(constructionMilestones).where(eq(constructionMilestones.id, id)).returning();
    return result.length > 0;
  }

  // O&M Contracts
  async getOmContracts(): Promise<OmContract[]> {
    return db.select().from(omContracts).orderBy(desc(omContracts.createdAt));
  }

  async getOmContract(id: string): Promise<OmContract | undefined> {
    const result = await db.select().from(omContracts).where(eq(omContracts.id, id)).limit(1);
    return result[0];
  }

  async getOmContractsByClientId(clientId: string): Promise<OmContract[]> {
    return db.select().from(omContracts)
      .where(eq(omContracts.clientId, clientId))
      .orderBy(desc(omContracts.createdAt));
  }

  async getOmContractsBySiteId(siteId: string): Promise<OmContract[]> {
    return db.select().from(omContracts)
      .where(eq(omContracts.siteId, siteId))
      .orderBy(desc(omContracts.createdAt));
  }

  async createOmContract(contract: InsertOmContract): Promise<OmContract> {
    const [result] = await db.insert(omContracts).values(contract).returning();
    return result;
  }

  async updateOmContract(id: string, contract: Partial<OmContract>): Promise<OmContract | undefined> {
    const [result] = await db.update(omContracts)
      .set({ ...contract, updatedAt: new Date() })
      .where(eq(omContracts.id, id))
      .returning();
    return result;
  }

  async deleteOmContract(id: string): Promise<boolean> {
    // Delete associated visits and performance snapshots first
    await db.delete(omVisits).where(eq(omVisits.omContractId, id));
    await db.delete(omPerformanceSnapshots).where(eq(omPerformanceSnapshots.omContractId, id));
    const result = await db.delete(omContracts).where(eq(omContracts.id, id)).returning();
    return result.length > 0;
  }

  // O&M Visits
  async getOmVisits(): Promise<OmVisit[]> {
    return db.select().from(omVisits).orderBy(desc(omVisits.createdAt));
  }

  async getOmVisit(id: string): Promise<OmVisit | undefined> {
    const result = await db.select().from(omVisits).where(eq(omVisits.id, id)).limit(1);
    return result[0];
  }

  async getOmVisitsByContractId(contractId: string): Promise<OmVisit[]> {
    return db.select().from(omVisits)
      .where(eq(omVisits.omContractId, contractId))
      .orderBy(desc(omVisits.scheduledDate));
  }

  async createOmVisit(visit: InsertOmVisit): Promise<OmVisit> {
    const [result] = await db.insert(omVisits).values(visit).returning();
    return result;
  }

  async updateOmVisit(id: string, visit: Partial<OmVisit>): Promise<OmVisit | undefined> {
    const [result] = await db.update(omVisits)
      .set({ ...visit, updatedAt: new Date() })
      .where(eq(omVisits.id, id))
      .returning();
    return result;
  }

  async deleteOmVisit(id: string): Promise<boolean> {
    const result = await db.delete(omVisits).where(eq(omVisits.id, id)).returning();
    return result.length > 0;
  }

  // O&M Performance Snapshots
  async getOmPerformanceSnapshots(): Promise<OmPerformanceSnapshot[]> {
    return db.select().from(omPerformanceSnapshots).orderBy(desc(omPerformanceSnapshots.createdAt));
  }

  async getOmPerformanceSnapshot(id: string): Promise<OmPerformanceSnapshot | undefined> {
    const result = await db.select().from(omPerformanceSnapshots).where(eq(omPerformanceSnapshots.id, id)).limit(1);
    return result[0];
  }

  async getOmPerformanceSnapshotsByContractId(contractId: string): Promise<OmPerformanceSnapshot[]> {
    return db.select().from(omPerformanceSnapshots)
      .where(eq(omPerformanceSnapshots.omContractId, contractId))
      .orderBy(desc(omPerformanceSnapshots.periodStart));
  }

  async createOmPerformanceSnapshot(snapshot: InsertOmPerformanceSnapshot): Promise<OmPerformanceSnapshot> {
    const [result] = await db.insert(omPerformanceSnapshots).values(snapshot).returning();
    return result;
  }

  async updateOmPerformanceSnapshot(id: string, snapshot: Partial<OmPerformanceSnapshot>): Promise<OmPerformanceSnapshot | undefined> {
    const [result] = await db.update(omPerformanceSnapshots)
      .set(snapshot)
      .where(eq(omPerformanceSnapshots.id, id))
      .returning();
    return result;
  }

  async deleteOmPerformanceSnapshot(id: string): Promise<boolean> {
    const result = await db.delete(omPerformanceSnapshots).where(eq(omPerformanceSnapshots.id, id)).returning();
    return result.length > 0;
  }

  // Portfolio auto-sync helper - applies portfolio KPIs to linked opportunities
  private async applyPortfolioAutoSync(opps: Opportunity[]): Promise<Opportunity[]> {
    if (opps.length === 0) return opps;
    
    const portfolioIds = Array.from(new Set(opps.filter(o => o.portfolioId).map(o => o.portfolioId!)));
    if (portfolioIds.length === 0) return opps;
    
    const portfolioKPIs = new Map<string, { totalCapex: number; totalPvKW: number }>();
    
    for (const portfolioId of portfolioIds) {
      const pSites = await db.select().from(portfolioSites).where(eq(portfolioSites.portfolioId, portfolioId));
      const siteIds = pSites.map(ps => ps.siteId);
      
      const latestSims = new Map<string, typeof simulationRuns.$inferSelect>();
      if (siteIds.length > 0) {
        const sims = await db.select().from(simulationRuns).where(inArray(simulationRuns.siteId, siteIds));
        for (const sim of sims) {
          const existing = latestSims.get(sim.siteId);
          if (!existing || (sim.createdAt && existing.createdAt && new Date(sim.createdAt) > new Date(existing.createdAt))) {
            latestSims.set(sim.siteId, sim);
          }
        }
      }
      
      let totalCapex = 0;
      let totalPvKW = 0;
      for (const ps of pSites) {
        const sim = latestSims.get(ps.siteId);
        const capex = ps.overrideCapexNet ?? sim?.capexNet ?? 0;
        const pvKW = ps.overridePvSizeKW ?? sim?.pvSizeKW ?? 0;
        totalCapex += capex;
        totalPvKW += pvKW;
      }
      portfolioKPIs.set(portfolioId, { totalCapex, totalPvKW });
    }

    return opps.map(o => {
      if (o.portfolioId && portfolioKPIs.has(o.portfolioId)) {
        const kpis = portfolioKPIs.get(o.portfolioId)!;
        return {
          ...o,
          estimatedValue: kpis.totalCapex,
          pvSizeKW: kpis.totalPvKW,
        };
      }
      return o;
    });
  }

  // Opportunities (Sales Pipeline)
  async getOpportunities(): Promise<Opportunity[]> {
    const opps = await db.select().from(opportunities).orderBy(desc(opportunities.createdAt));
    return this.applyPortfolioAutoSync(opps);
  }

  async getOpportunity(id: string): Promise<Opportunity | undefined> {
    const result = await db.select().from(opportunities).where(eq(opportunities.id, id)).limit(1);
    if (result.length === 0) return undefined;
    const synced = await this.applyPortfolioAutoSync(result);
    return synced[0];
  }

  async getOpportunitiesByStage(stage: string): Promise<Opportunity[]> {
    const opps = await db.select().from(opportunities)
      .where(eq(opportunities.stage, stage))
      .orderBy(desc(opportunities.createdAt));
    return this.applyPortfolioAutoSync(opps);
  }

  async getOpportunitiesByLeadId(leadId: string): Promise<Opportunity[]> {
    const opps = await db.select().from(opportunities)
      .where(eq(opportunities.leadId, leadId))
      .orderBy(desc(opportunities.createdAt));
    return this.applyPortfolioAutoSync(opps);
  }

  async getOpportunitiesByClientId(clientId: string): Promise<Opportunity[]> {
    const opps = await db.select().from(opportunities)
      .where(eq(opportunities.clientId, clientId))
      .orderBy(desc(opportunities.createdAt));
    return this.applyPortfolioAutoSync(opps);
  }

  async getOpportunitiesBySiteId(siteId: string): Promise<Opportunity[]> {
    const opps = await db.select().from(opportunities)
      .where(eq(opportunities.siteId, siteId))
      .orderBy(desc(opportunities.createdAt));
    return this.applyPortfolioAutoSync(opps);
  }

  async getOpportunitiesByOwnerId(ownerId: string): Promise<Opportunity[]> {
    const opps = await db.select().from(opportunities)
      .where(eq(opportunities.ownerId, ownerId))
      .orderBy(desc(opportunities.createdAt));
    return this.applyPortfolioAutoSync(opps);
  }

  async createOpportunity(opportunity: InsertOpportunity): Promise<Opportunity> {
    const [result] = await db.insert(opportunities).values(opportunity).returning();
    return result;
  }

  async updateOpportunity(id: string, opportunity: Partial<Opportunity>): Promise<Opportunity | undefined> {
    const [result] = await db.update(opportunities)
      .set({ ...opportunity, updatedAt: new Date() })
      .where(eq(opportunities.id, id))
      .returning();
    return result;
  }

  async deleteOpportunity(id: string): Promise<boolean> {
    const result = await db.delete(opportunities).where(eq(opportunities.id, id)).returning();
    return result.length > 0;
  }

  async updateOpportunityStage(id: string, stage: string, probability?: number, lostReason?: string, lostNotes?: string): Promise<Opportunity | undefined> {
    const updateData: Partial<Opportunity> = {
      stage,
      updatedAt: new Date(),
    };
    if (probability !== undefined) updateData.probability = probability;
    if (lostReason !== undefined) updateData.lostReason = lostReason;
    if (lostNotes !== undefined) updateData.lostNotes = lostNotes;
    // Set actualCloseDate for won stages or lost
    const wonStages = ['won_to_be_delivered', 'won_in_construction', 'won_delivered'];
    if (wonStages.includes(stage) || stage === "lost") updateData.actualCloseDate = new Date();
    
    const [result] = await db.update(opportunities)
      .set(updateData)
      .where(eq(opportunities.id, id))
      .returning();
    return result;
  }

  // Activities (Calls, Emails, Meetings Log)
  async getActivities(): Promise<Activity[]> {
    return db.select().from(activities).orderBy(desc(activities.createdAt));
  }

  async getActivity(id: string): Promise<Activity | undefined> {
    const result = await db.select().from(activities).where(eq(activities.id, id)).limit(1);
    return result[0];
  }

  async getActivitiesByLeadId(leadId: string): Promise<Activity[]> {
    return db.select().from(activities)
      .where(eq(activities.leadId, leadId))
      .orderBy(desc(activities.activityDate));
  }

  async getActivitiesByClientId(clientId: string): Promise<Activity[]> {
    return db.select().from(activities)
      .where(eq(activities.clientId, clientId))
      .orderBy(desc(activities.activityDate));
  }

  async getActivitiesBySiteId(siteId: string): Promise<Activity[]> {
    return db.select().from(activities)
      .where(eq(activities.siteId, siteId))
      .orderBy(desc(activities.activityDate));
  }

  async getActivitiesByOpportunityId(opportunityId: string): Promise<Activity[]> {
    return db.select().from(activities)
      .where(eq(activities.opportunityId, opportunityId))
      .orderBy(desc(activities.activityDate));
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const [result] = await db.insert(activities).values(activity).returning();
    return result;
  }

  async updateActivity(id: string, activity: Partial<Activity>): Promise<Activity | undefined> {
    const [result] = await db.update(activities)
      .set(activity)
      .where(eq(activities.id, id))
      .returning();
    return result;
  }

  async deleteActivity(id: string): Promise<boolean> {
    const result = await db.delete(activities).where(eq(activities.id, id)).returning();
    return result.length > 0;
  }

  // Partnerships
  async getPartnerships(): Promise<Partnership[]> {
    return db.select().from(partnerships).orderBy(desc(partnerships.updatedAt));
  }

  async getPartnership(id: string): Promise<Partnership | undefined> {
    const [partnership] = await db.select().from(partnerships).where(eq(partnerships.id, id)).limit(1);
    return partnership;
  }

  async createPartnership(data: InsertPartnership): Promise<Partnership> {
    const [partnership] = await db.insert(partnerships).values(data).returning();
    return partnership;
  }

  async updatePartnership(id: string, data: Partial<InsertPartnership>): Promise<Partnership> {
    const [partnership] = await db.update(partnerships)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(partnerships.id, id))
      .returning();
    return partnership;
  }

  async deletePartnership(id: string): Promise<void> {
    await db.delete(partnerships).where(eq(partnerships.id, id));
  }

  // Construction Projects
  async getConstructionProjects(): Promise<ConstructionProject[]> {
    return db.select().from(constructionProjects).orderBy(desc(constructionProjects.updatedAt));
  }

  async getConstructionProject(id: string): Promise<ConstructionProject | undefined> {
    const [result] = await db.select().from(constructionProjects).where(eq(constructionProjects.id, id)).limit(1);
    return result;
  }

  async getConstructionProjectsBySiteId(siteId: string): Promise<ConstructionProject[]> {
    return db.select().from(constructionProjects)
      .where(eq(constructionProjects.siteId, siteId))
      .orderBy(desc(constructionProjects.updatedAt));
  }

  async createConstructionProject(project: InsertConstructionProject): Promise<ConstructionProject> {
    const [result] = await db.insert(constructionProjects).values(project).returning();
    return result;
  }

  async updateConstructionProject(id: string, project: Partial<ConstructionProject>): Promise<ConstructionProject | undefined> {
    const [result] = await db.update(constructionProjects)
      .set({ ...project, updatedAt: new Date() })
      .where(eq(constructionProjects.id, id))
      .returning();
    return result;
  }

  async deleteConstructionProject(id: string): Promise<boolean> {
    const result = await db.delete(constructionProjects).where(eq(constructionProjects.id, id)).returning();
    return result.length > 0;
  }

  // Construction Tasks
  async getConstructionTasks(): Promise<ConstructionTask[]> {
    return db.select().from(constructionTasks).orderBy(desc(constructionTasks.updatedAt));
  }

  async getConstructionTask(id: string): Promise<ConstructionTask | undefined> {
    const [result] = await db.select().from(constructionTasks).where(eq(constructionTasks.id, id)).limit(1);
    return result;
  }

  async getConstructionTasksByProjectId(projectId: string): Promise<ConstructionTask[]> {
    return db.select().from(constructionTasks)
      .where(eq(constructionTasks.projectId, projectId))
      .orderBy(constructionTasks.sortOrder);
  }

  async createConstructionTask(task: InsertConstructionTask): Promise<ConstructionTask> {
    const [result] = await db.insert(constructionTasks).values(task).returning();
    return result;
  }

  async updateConstructionTask(id: string, task: Partial<ConstructionTask>): Promise<ConstructionTask | undefined> {
    const [result] = await db.update(constructionTasks)
      .set({ ...task, updatedAt: new Date() })
      .where(eq(constructionTasks.id, id))
      .returning();
    return result;
  }

  async deleteConstructionTask(id: string): Promise<boolean> {
    const result = await db.delete(constructionTasks).where(eq(constructionTasks.id, id)).returning();
    return result.length > 0;
  }
}
