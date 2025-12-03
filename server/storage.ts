import { randomUUID } from "crypto";
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

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Leads
  getLeads(): Promise<Lead[]>;
  getLead(id: string): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: string, lead: Partial<Lead>): Promise<Lead | undefined>;

  // Clients
  getClients(): Promise<(Client & { sites: Site[] })[]>;
  getClient(id: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<Client>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<boolean>;

  // Sites
  getSites(): Promise<(Site & { client: Client })[]>;
  getSite(id: string): Promise<(Site & { client: Client; meterFiles: MeterFile[]; simulationRuns: SimulationRun[] }) | undefined>;
  getSitesByClient(clientId: string): Promise<Site[]>;
  createSite(site: InsertSite): Promise<Site>;
  updateSite(id: string, site: Partial<Site>): Promise<Site | undefined>;
  deleteSite(id: string): Promise<boolean>;

  // Meter Files
  getMeterFiles(siteId: string): Promise<MeterFile[]>;
  getMeterFile(id: string): Promise<MeterFile | undefined>;
  createMeterFile(file: InsertMeterFile): Promise<MeterFile>;
  updateMeterFile(id: string, file: Partial<MeterFile>): Promise<MeterFile | undefined>;

  // Meter Readings
  getMeterReadings(meterFileId: string): Promise<MeterReading[]>;
  getMeterReadingsBySite(siteId: string): Promise<MeterReading[]>;
  createMeterReadings(readings: InsertMeterReading[]): Promise<MeterReading[]>;

  // Simulation Runs
  getSimulationRuns(): Promise<(SimulationRun & { site: Site & { client: Client } })[]>;
  getSimulationRun(id: string): Promise<(SimulationRun & { site: Site & { client: Client } }) | undefined>;
  getSimulationRunsBySite(siteId: string): Promise<SimulationRun[]>;
  createSimulationRun(run: InsertSimulationRun): Promise<SimulationRun>;

  // Designs
  getDesigns(): Promise<(Design & { simulationRun: SimulationRun & { site: Site & { client: Client } } })[]>;
  getDesign(id: string): Promise<(Design & { bomItems: BomItem[] }) | undefined>;
  createDesign(design: InsertDesign): Promise<Design>;
  updateDesign(id: string, design: Partial<Design>): Promise<Design | undefined>;

  // BOM Items
  getBomItems(designId: string): Promise<BomItem[]>;
  createBomItems(items: InsertBomItem[]): Promise<BomItem[]>;

  // Component Catalog
  getCatalog(): Promise<ComponentCatalog[]>;
  getCatalogItem(id: string): Promise<ComponentCatalog | undefined>;
  getCatalogByCategory(category: string): Promise<ComponentCatalog[]>;
  createCatalogItem(item: InsertComponentCatalog): Promise<ComponentCatalog>;
  updateCatalogItem(id: string, item: Partial<ComponentCatalog>): Promise<ComponentCatalog | undefined>;
  deleteCatalogItem(id: string): Promise<boolean>;

  // Dashboard Stats
  getDashboardStats(): Promise<{
    totalSites: number;
    activeAnalyses: number;
    totalSavings: number;
    co2Avoided: number;
    recentSites: Site[];
    recentAnalyses: SimulationRun[];
  }>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private leads: Map<string, Lead> = new Map();
  private clients: Map<string, Client> = new Map();
  private sites: Map<string, Site> = new Map();
  private meterFiles: Map<string, MeterFile> = new Map();
  private meterReadings: Map<string, MeterReading> = new Map();
  private simulationRuns: Map<string, SimulationRun> = new Map();
  private designs: Map<string, Design> = new Map();
  private bomItems: Map<string, BomItem> = new Map();
  private catalogItems: Map<string, ComponentCatalog> = new Map();

  constructor() {
    this.seedDefaultData();
  }

  private seedDefaultData() {
    // Create default admin user
    const adminUser: User = {
      id: randomUUID(),
      email: "info@kwh.quebec",
      passwordHash: "$2b$10$s9n26vylL.JbqEVDwx9EXerv4ElQq0GO9EpyW7KiWl/EDTSO8ZL5K", // KiloWattHeureQc1$
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(adminUser.id, adminUser);

    // Seed some default catalog items
    const defaultModules: InsertComponentCatalog[] = [
      { category: "MODULE", manufacturer: "Canadian Solar", model: "CS6R-410MS", unitCost: 180, unitSellPrice: 250, active: true },
      { category: "MODULE", manufacturer: "JA Solar", model: "JAM72S20-455", unitCost: 195, unitSellPrice: 270, active: true },
      { category: "MODULE", manufacturer: "Longi", model: "LR5-72HBD-545M", unitCost: 210, unitSellPrice: 290, active: true },
    ];

    const defaultInverters: InsertComponentCatalog[] = [
      { category: "INVERTER", manufacturer: "SMA", model: "Sunny Tripower 25000TL", unitCost: 3500, unitSellPrice: 4500, active: true },
      { category: "INVERTER", manufacturer: "Fronius", model: "Symo 24.0-3-M", unitCost: 3200, unitSellPrice: 4200, active: true },
      { category: "INVERTER", manufacturer: "Huawei", model: "SUN2000-100KTL-M1", unitCost: 8500, unitSellPrice: 11000, active: true },
    ];

    const defaultBatteries: InsertComponentCatalog[] = [
      { category: "BATTERY", manufacturer: "Tesla", model: "Megapack 2", unitCost: 450000, unitSellPrice: 580000, active: true },
      { category: "BATTERY", manufacturer: "BYD", model: "Battery-Box Premium HVS", unitCost: 8500, unitSellPrice: 11000, active: true },
      { category: "BATTERY", manufacturer: "LG Chem", model: "RESU16H Prime", unitCost: 9000, unitSellPrice: 12000, active: true },
    ];

    [...defaultModules, ...defaultInverters, ...defaultBatteries].forEach(item => {
      const catalogItem: ComponentCatalog = {
        id: randomUUID(),
        ...item,
        specJson: null,
      };
      this.catalogItems.set(catalogItem.id, catalogItem);
    });
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.email === email);
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = randomUUID();
    const newUser: User = {
      id,
      ...user,
      role: user.role || "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(id, newUser);
    return newUser;
  }

  // Leads
  async getLeads(): Promise<Lead[]> {
    return Array.from(this.leads.values()).sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getLead(id: string): Promise<Lead | undefined> {
    return this.leads.get(id);
  }

  async createLead(lead: InsertLead): Promise<Lead> {
    const id = randomUUID();
    const newLead: Lead = {
      id,
      ...lead,
      source: "web_form",
      zohoLeadId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.leads.set(id, newLead);
    return newLead;
  }

  async updateLead(id: string, lead: Partial<Lead>): Promise<Lead | undefined> {
    const existing = this.leads.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...lead, updatedAt: new Date() };
    this.leads.set(id, updated);
    return updated;
  }

  // Clients
  async getClients(): Promise<(Client & { sites: Site[] })[]> {
    const clients = Array.from(this.clients.values());
    return clients.map(client => ({
      ...client,
      sites: Array.from(this.sites.values()).filter(s => s.clientId === client.id),
    })).sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async getClient(id: string): Promise<Client | undefined> {
    return this.clients.get(id);
  }

  async createClient(client: InsertClient): Promise<Client> {
    const id = randomUUID();
    const newClient: Client = {
      id,
      ...client,
      zohoAccountId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.clients.set(id, newClient);
    return newClient;
  }

  async updateClient(id: string, client: Partial<Client>): Promise<Client | undefined> {
    const existing = this.clients.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...client, updatedAt: new Date() };
    this.clients.set(id, updated);
    return updated;
  }

  async deleteClient(id: string): Promise<boolean> {
    return this.clients.delete(id);
  }

  // Sites
  async getSites(): Promise<(Site & { client: Client })[]> {
    const sites = Array.from(this.sites.values());
    return sites.map(site => ({
      ...site,
      client: this.clients.get(site.clientId)!,
    })).filter(s => s.client).sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getSite(id: string): Promise<(Site & { client: Client; meterFiles: MeterFile[]; simulationRuns: SimulationRun[] }) | undefined> {
    const site = this.sites.get(id);
    if (!site) return undefined;
    const client = this.clients.get(site.clientId);
    if (!client) return undefined;
    
    // Sort simulation runs by createdAt descending so the latest is first
    const simRuns = Array.from(this.simulationRuns.values())
      .filter(r => r.siteId === id)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
    
    return {
      ...site,
      client,
      meterFiles: Array.from(this.meterFiles.values()).filter(f => f.siteId === id),
      simulationRuns: simRuns,
    };
  }

  async getSitesByClient(clientId: string): Promise<Site[]> {
    return Array.from(this.sites.values()).filter(s => s.clientId === clientId);
  }

  async createSite(site: InsertSite): Promise<Site> {
    const id = randomUUID();
    const newSite: Site = {
      id,
      ...site,
      analysisAvailable: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.sites.set(id, newSite);
    return newSite;
  }

  async updateSite(id: string, site: Partial<Site>): Promise<Site | undefined> {
    const existing = this.sites.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...site, updatedAt: new Date() };
    this.sites.set(id, updated);
    return updated;
  }

  async deleteSite(id: string): Promise<boolean> {
    return this.sites.delete(id);
  }

  // Meter Files
  async getMeterFiles(siteId: string): Promise<MeterFile[]> {
    return Array.from(this.meterFiles.values()).filter(f => f.siteId === siteId);
  }

  async getMeterFile(id: string): Promise<MeterFile | undefined> {
    return this.meterFiles.get(id);
  }

  async createMeterFile(file: InsertMeterFile): Promise<MeterFile> {
    const id = randomUUID();
    const newFile: MeterFile = {
      id,
      ...file,
      status: "UPLOADED",
      errorMessage: null,
      createdAt: new Date(),
    };
    this.meterFiles.set(id, newFile);
    return newFile;
  }

  async updateMeterFile(id: string, file: Partial<MeterFile>): Promise<MeterFile | undefined> {
    const existing = this.meterFiles.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...file };
    this.meterFiles.set(id, updated);
    return updated;
  }

  // Meter Readings
  async getMeterReadings(meterFileId: string): Promise<MeterReading[]> {
    return Array.from(this.meterReadings.values()).filter(r => r.meterFileId === meterFileId);
  }

  async getMeterReadingsBySite(siteId: string): Promise<MeterReading[]> {
    const files = await this.getMeterFiles(siteId);
    const fileIds = new Set(files.map(f => f.id));
    return Array.from(this.meterReadings.values()).filter(r => fileIds.has(r.meterFileId));
  }

  async createMeterReadings(readings: InsertMeterReading[]): Promise<MeterReading[]> {
    return readings.map(reading => {
      const id = randomUUID();
      const newReading: MeterReading = { id, ...reading };
      this.meterReadings.set(id, newReading);
      return newReading;
    });
  }

  // Simulation Runs
  async getSimulationRuns(): Promise<(SimulationRun & { site: Site & { client: Client } })[]> {
    const runs = Array.from(this.simulationRuns.values());
    return runs.map(run => {
      const site = this.sites.get(run.siteId);
      const client = site ? this.clients.get(site.clientId) : undefined;
      return {
        ...run,
        site: { ...site!, client: client! },
      };
    }).filter(r => r.site && r.site.client).sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getSimulationRun(id: string): Promise<(SimulationRun & { site: Site & { client: Client } }) | undefined> {
    const run = this.simulationRuns.get(id);
    if (!run) return undefined;
    const site = this.sites.get(run.siteId);
    if (!site) return undefined;
    const client = this.clients.get(site.clientId);
    if (!client) return undefined;
    return { ...run, site: { ...site, client } };
  }

  async getSimulationRunsBySite(siteId: string): Promise<SimulationRun[]> {
    return Array.from(this.simulationRuns.values()).filter(r => r.siteId === siteId);
  }

  async createSimulationRun(run: InsertSimulationRun): Promise<SimulationRun> {
    const id = randomUUID();
    const newRun: SimulationRun = {
      id,
      ...run,
      createdAt: new Date(),
    };
    this.simulationRuns.set(id, newRun);
    return newRun;
  }

  // Designs
  async getDesigns(): Promise<(Design & { simulationRun: SimulationRun & { site: Site & { client: Client } } })[]> {
    const designs = Array.from(this.designs.values());
    return designs.map(design => {
      const simRun = this.simulationRuns.get(design.simulationRunId);
      const site = simRun ? this.sites.get(simRun.siteId) : undefined;
      const client = site ? this.clients.get(site.clientId) : undefined;
      return {
        ...design,
        simulationRun: { ...simRun!, site: { ...site!, client: client! } },
      };
    }).filter(d => d.simulationRun && d.simulationRun.site && d.simulationRun.site.client).sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getDesign(id: string): Promise<(Design & { bomItems: BomItem[] }) | undefined> {
    const design = this.designs.get(id);
    if (!design) return undefined;
    return {
      ...design,
      bomItems: Array.from(this.bomItems.values()).filter(b => b.designId === id),
    };
  }

  async createDesign(design: InsertDesign): Promise<Design> {
    const id = randomUUID();
    const newDesign: Design = {
      id,
      ...design,
      zohoDealId: null,
      createdAt: new Date(),
    };
    this.designs.set(id, newDesign);
    return newDesign;
  }

  async updateDesign(id: string, design: Partial<Design>): Promise<Design | undefined> {
    const existing = this.designs.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...design };
    this.designs.set(id, updated);
    return updated;
  }

  // BOM Items
  async getBomItems(designId: string): Promise<BomItem[]> {
    return Array.from(this.bomItems.values()).filter(b => b.designId === designId);
  }

  async createBomItems(items: InsertBomItem[]): Promise<BomItem[]> {
    return items.map(item => {
      const id = randomUUID();
      const newItem: BomItem = { id, ...item };
      this.bomItems.set(id, newItem);
      return newItem;
    });
  }

  // Component Catalog
  async getCatalog(): Promise<ComponentCatalog[]> {
    return Array.from(this.catalogItems.values());
  }

  async getCatalogItem(id: string): Promise<ComponentCatalog | undefined> {
    return this.catalogItems.get(id);
  }

  async getCatalogByCategory(category: string): Promise<ComponentCatalog[]> {
    return Array.from(this.catalogItems.values()).filter(c => c.category === category && c.active);
  }

  async createCatalogItem(item: InsertComponentCatalog): Promise<ComponentCatalog> {
    const id = randomUUID();
    const newItem: ComponentCatalog = {
      id,
      ...item,
      active: item.active ?? true,
      specJson: null,
    };
    this.catalogItems.set(id, newItem);
    return newItem;
  }

  async updateCatalogItem(id: string, item: Partial<ComponentCatalog>): Promise<ComponentCatalog | undefined> {
    const existing = this.catalogItems.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...item };
    this.catalogItems.set(id, updated);
    return updated;
  }

  async deleteCatalogItem(id: string): Promise<boolean> {
    return this.catalogItems.delete(id);
  }

  // Dashboard Stats
  async getDashboardStats(): Promise<{
    totalSites: number;
    activeAnalyses: number;
    totalSavings: number;
    co2Avoided: number;
    recentSites: Site[];
    recentAnalyses: SimulationRun[];
  }> {
    const sites = Array.from(this.sites.values());
    const analyses = Array.from(this.simulationRuns.values());
    
    const totalSavings = analyses.reduce((sum, a) => sum + (a.annualSavings || 0), 0);
    const co2Avoided = analyses.reduce((sum, a) => sum + (a.co2AvoidedTonnesPerYear || 0), 0);
    
    return {
      totalSites: sites.length,
      activeAnalyses: analyses.length,
      totalSavings,
      co2Avoided,
      recentSites: sites.slice(0, 5),
      recentAnalyses: analyses.slice(0, 5),
    };
  }
}

import { DatabaseStorage } from "./dbStorage";

export const storage = new DatabaseStorage();

// Initialize default data
storage.initializeDefaultData().catch(console.error);
