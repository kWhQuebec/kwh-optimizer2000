import { eq, desc } from "drizzle-orm";
import { db } from "./db";
import {
  users, leads, clients, sites, meterFiles, meterReadings,
  simulationRuns, designs, bomItems, componentCatalog,
} from "@shared/schema";
import type {
  User, InsertUser,
  Lead, InsertLead,
  Client, InsertClient,
  Site, InsertSite,
  MeterFile, InsertMeterFile,
  MeterReading, InsertMeterReading,
  SimulationRun, InsertSimulationRun,
  Design, InsertDesign,
  BomItem, InsertBomItem,
  ComponentCatalog, InsertComponentCatalog,
} from "@shared/schema";
import type { IStorage } from "./storage";
import bcrypt from "bcrypt";

export class DatabaseStorage implements IStorage {
  async initializeDefaultData(): Promise<void> {
    // Check for new admin email first
    const existingAdmin = await db.select().from(users).where(eq(users.email, "info@kwh.quebec")).limit(1);
    if (existingAdmin.length === 0) {
      const passwordHash = await bcrypt.hash("KiloWattHeureQc1$", 10);
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

  async getSite(id: string): Promise<(Site & { client: Client; meterFiles: MeterFile[]; simulationRuns: SimulationRun[] }) | undefined> {
    const [site] = await db.select().from(sites).where(eq(sites.id, id)).limit(1);
    if (!site) return undefined;
    
    const [client] = await db.select().from(clients).where(eq(clients.id, site.clientId)).limit(1);
    if (!client) return undefined;
    
    const siteFiles = await db.select().from(meterFiles).where(eq(meterFiles.siteId, id));
    const simRuns = await db.select().from(simulationRuns).where(eq(simulationRuns.siteId, id)).orderBy(desc(simulationRuns.createdAt));
    
    return { ...site, client, meterFiles: siteFiles, simulationRuns: simRuns };
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
    const allSites = await db.select().from(sites).orderBy(desc(sites.createdAt)).limit(5);
    const allAnalyses = await db.select().from(simulationRuns).orderBy(desc(simulationRuns.createdAt)).limit(5);
    const siteCount = await db.select().from(sites);
    const analysisCount = await db.select().from(simulationRuns);
    
    const totalSavings = analysisCount.reduce((sum, a) => sum + (a.annualSavings || 0), 0);
    const co2Avoided = analysisCount.reduce((sum, a) => sum + (a.co2AvoidedTonnesPerYear || 0), 0);
    
    return {
      totalSites: siteCount.length,
      activeAnalyses: analysisCount.length,
      totalSavings,
      co2Avoided,
      recentSites: allSites,
      recentAnalyses: allAnalyses,
    };
  }
}
