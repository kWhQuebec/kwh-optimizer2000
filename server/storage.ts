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
  SiteVisit, InsertSiteVisit,
  SiteVisitWithSite,
  DesignAgreement, InsertDesignAgreement,
  Portfolio, InsertPortfolio,
  PortfolioSite, InsertPortfolioSite,
  PortfolioWithSites,
  PortfolioSiteWithDetails,
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsers(): Promise<User[]>;
  deleteUser(id: string): Promise<boolean>;

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

  // Site Visits
  getSiteVisits(): Promise<SiteVisitWithSite[]>;
  getSiteVisit(id: string): Promise<SiteVisitWithSite | undefined>;
  getSiteVisitsBySite(siteId: string): Promise<SiteVisit[]>;
  createSiteVisit(visit: InsertSiteVisit): Promise<SiteVisit>;
  updateSiteVisit(id: string, visit: Partial<SiteVisit>): Promise<SiteVisit | undefined>;
  deleteSiteVisit(id: string): Promise<boolean>;

  // Design Agreements (Étape 3)
  getDesignAgreements(): Promise<DesignAgreement[]>;
  getDesignAgreement(id: string): Promise<DesignAgreement | undefined>;
  getDesignAgreementBySite(siteId: string): Promise<DesignAgreement | undefined>;
  createDesignAgreement(agreement: InsertDesignAgreement): Promise<DesignAgreement>;
  updateDesignAgreement(id: string, agreement: Partial<DesignAgreement>): Promise<DesignAgreement | undefined>;
  deleteDesignAgreement(id: string): Promise<boolean>;

  // Portfolios (Multi-site projects)
  getPortfolios(): Promise<PortfolioWithSites[]>;
  getPortfolio(id: string): Promise<PortfolioWithSites | undefined>;
  getPortfoliosByClient(clientId: string): Promise<PortfolioWithSites[]>;
  createPortfolio(portfolio: InsertPortfolio): Promise<Portfolio>;
  updatePortfolio(id: string, portfolio: Partial<Portfolio>): Promise<Portfolio | undefined>;
  deletePortfolio(id: string): Promise<boolean>;

  // Portfolio Sites (Junction)
  getPortfolioSites(portfolioId: string): Promise<PortfolioSiteWithDetails[]>;
  addSiteToPortfolio(portfolioSite: InsertPortfolioSite): Promise<PortfolioSite>;
  removeSiteFromPortfolio(portfolioId: string, siteId: string): Promise<boolean>;
  updatePortfolioSite(id: string, data: Partial<PortfolioSite>): Promise<PortfolioSite | undefined>;
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
  private siteVisits: Map<string, SiteVisit> = new Map();
  private designAgreements: Map<string, DesignAgreement> = new Map();
  private portfolios: Map<string, Portfolio> = new Map();
  private portfolioSites: Map<string, PortfolioSite> = new Map();

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
  
  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values()).sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }
  
  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
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
      companyName: lead.companyName,
      contactName: lead.contactName,
      email: lead.email,
      phone: lead.phone || null,
      streetAddress: lead.streetAddress || null,
      city: lead.city || null,
      province: lead.province || "Québec",
      postalCode: lead.postalCode || null,
      estimatedMonthlyBill: lead.estimatedMonthlyBill || null,
      buildingType: lead.buildingType || null,
      notes: lead.notes || null,
      source: "web_form",
      status: "submitted",
      latitude: null,
      longitude: null,
      roofAreaSqM: null,
      roofPotentialKw: null,
      estimateError: null,
      estimateCompletedAt: null,
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

  // Site Visits
  async getSiteVisits(): Promise<SiteVisitWithSite[]> {
    const visits = Array.from(this.siteVisits.values());
    return visits.map(visit => {
      const site = this.sites.get(visit.siteId);
      const client = site ? this.clients.get(site.clientId) : undefined;
      return {
        ...visit,
        site: { ...site!, client: client! },
      };
    }).filter(v => v.site && v.site.client).sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getSiteVisit(id: string): Promise<SiteVisitWithSite | undefined> {
    const visit = this.siteVisits.get(id);
    if (!visit) return undefined;
    const site = this.sites.get(visit.siteId);
    if (!site) return undefined;
    const client = this.clients.get(site.clientId);
    if (!client) return undefined;
    return { ...visit, site: { ...site, client } };
  }

  async getSiteVisitsBySite(siteId: string): Promise<SiteVisit[]> {
    return Array.from(this.siteVisits.values()).filter(v => v.siteId === siteId);
  }

  async createSiteVisit(visit: InsertSiteVisit): Promise<SiteVisit> {
    const id = randomUUID();
    const newVisit: SiteVisit = {
      id,
      ...visit,
      status: visit.status || "scheduled",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.siteVisits.set(id, newVisit);
    return newVisit;
  }

  async updateSiteVisit(id: string, visit: Partial<SiteVisit>): Promise<SiteVisit | undefined> {
    const existing = this.siteVisits.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...visit, updatedAt: new Date() };
    this.siteVisits.set(id, updated);
    return updated;
  }

  async deleteSiteVisit(id: string): Promise<boolean> {
    return this.siteVisits.delete(id);
  }

  // Design Agreements
  async getDesignAgreements(): Promise<DesignAgreement[]> {
    return Array.from(this.designAgreements.values());
  }

  async getDesignAgreement(id: string): Promise<DesignAgreement | undefined> {
    return this.designAgreements.get(id);
  }

  async getDesignAgreementBySite(siteId: string): Promise<DesignAgreement | undefined> {
    return Array.from(this.designAgreements.values()).find(a => a.siteId === siteId);
  }

  async createDesignAgreement(agreement: InsertDesignAgreement): Promise<DesignAgreement> {
    const id = randomUUID();
    const newAgreement: DesignAgreement = {
      id,
      ...agreement,
      status: agreement.status || "draft",
      currency: agreement.currency || "CAD",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.designAgreements.set(id, newAgreement);
    return newAgreement;
  }

  async updateDesignAgreement(id: string, agreement: Partial<DesignAgreement>): Promise<DesignAgreement | undefined> {
    const existing = this.designAgreements.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...agreement, updatedAt: new Date() };
    this.designAgreements.set(id, updated);
    return updated;
  }

  async deleteDesignAgreement(id: string): Promise<boolean> {
    return this.designAgreements.delete(id);
  }

  // Portfolios
  async getPortfolios(): Promise<PortfolioWithSites[]> {
    return Array.from(this.portfolios.values()).map(portfolio => {
      const client = this.clients.get(portfolio.clientId);
      const portfolioSiteEntries = Array.from(this.portfolioSites.values())
        .filter(ps => ps.portfolioId === portfolio.id);
      const sites = portfolioSiteEntries
        .map(ps => this.sites.get(ps.siteId))
        .filter((s): s is Site => s !== undefined);
      return {
        ...portfolio,
        client: client!,
        sites,
      };
    });
  }

  async getPortfolio(id: string): Promise<PortfolioWithSites | undefined> {
    const portfolio = this.portfolios.get(id);
    if (!portfolio) return undefined;
    const client = this.clients.get(portfolio.clientId);
    const portfolioSiteEntries = Array.from(this.portfolioSites.values())
      .filter(ps => ps.portfolioId === portfolio.id);
    const sites = portfolioSiteEntries
      .map(ps => this.sites.get(ps.siteId))
      .filter((s): s is Site => s !== undefined);
    return {
      ...portfolio,
      client: client!,
      sites,
    };
  }

  async getPortfoliosByClient(clientId: string): Promise<PortfolioWithSites[]> {
    const portfolios = Array.from(this.portfolios.values())
      .filter(p => p.clientId === clientId);
    const client = this.clients.get(clientId);
    return portfolios.map(portfolio => {
      const portfolioSiteEntries = Array.from(this.portfolioSites.values())
        .filter(ps => ps.portfolioId === portfolio.id);
      const sites = portfolioSiteEntries
        .map(ps => this.sites.get(ps.siteId))
        .filter((s): s is Site => s !== undefined);
      return {
        ...portfolio,
        client: client!,
        sites,
      };
    });
  }

  async createPortfolio(portfolio: InsertPortfolio): Promise<Portfolio> {
    const id = randomUUID();
    const newPortfolio: Portfolio = {
      id,
      ...portfolio,
      status: portfolio.status || "draft",
      numBuildings: portfolio.numBuildings ?? 0,
      estimatedTravelDays: portfolio.estimatedTravelDays ?? 0,
      volumeDiscountPercent: portfolio.volumeDiscountPercent ?? 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.portfolios.set(id, newPortfolio);
    return newPortfolio;
  }

  async updatePortfolio(id: string, portfolio: Partial<Portfolio>): Promise<Portfolio | undefined> {
    const existing = this.portfolios.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...portfolio, updatedAt: new Date() };
    this.portfolios.set(id, updated);
    return updated;
  }

  async deletePortfolio(id: string): Promise<boolean> {
    // Also delete associated portfolio sites
    Array.from(this.portfolioSites.values())
      .filter(ps => ps.portfolioId === id)
      .forEach(ps => this.portfolioSites.delete(ps.id));
    return this.portfolios.delete(id);
  }

  // Portfolio Sites
  async getPortfolioSites(portfolioId: string): Promise<PortfolioSiteWithDetails[]> {
    const entries = Array.from(this.portfolioSites.values())
      .filter(ps => ps.portfolioId === portfolioId)
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
    
    return entries.map(ps => {
      const site = this.sites.get(ps.siteId)!;
      const simulations = Array.from(this.simulationRuns.values())
        .filter(s => s.siteId === ps.siteId)
        .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
      const latestSimulation = simulations.find(s => s.type === "SCENARIO") || simulations[0];
      return {
        ...ps,
        site,
        latestSimulation,
      };
    });
  }

  async addSiteToPortfolio(portfolioSite: InsertPortfolioSite): Promise<PortfolioSite> {
    const id = randomUUID();
    const newEntry: PortfolioSite = {
      id,
      ...portfolioSite,
      displayOrder: portfolioSite.displayOrder ?? 0,
      createdAt: new Date(),
    };
    this.portfolioSites.set(id, newEntry);
    return newEntry;
  }

  async removeSiteFromPortfolio(portfolioId: string, siteId: string): Promise<boolean> {
    const entry = Array.from(this.portfolioSites.values())
      .find(ps => ps.portfolioId === portfolioId && ps.siteId === siteId);
    if (!entry) return false;
    return this.portfolioSites.delete(entry.id);
  }

  async updatePortfolioSite(id: string, data: Partial<PortfolioSite>): Promise<PortfolioSite | undefined> {
    const existing = this.portfolioSites.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data };
    this.portfolioSites.set(id, updated);
    return updated;
  }
}

import { DatabaseStorage } from "./dbStorage";

export const storage = new DatabaseStorage();

// Initialize default data
storage.initializeDefaultData().catch(console.error);
