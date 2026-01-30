import { randomUUID } from "crypto";
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
  CompetitorProposalAnalysis, InsertCompetitorProposalAnalysis,
  RoofPolygon, InsertRoofPolygon,
  PricingComponent, InsertPricingComponent,
  Supplier, InsertSupplier,
  PriceHistory, InsertPriceHistory,
  GoogleSolarCache, InsertGoogleSolarCache,
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<User>): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  getUsersByIds(ids: string[]): Promise<User[]>;
  deleteUser(id: string): Promise<boolean>;

  // Leads
  getLeads(): Promise<Lead[]>;
  getLead(id: string): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: string, lead: Partial<Lead>): Promise<Lead | undefined>;

  // Clients
  getClients(): Promise<(Client & { sites: Site[] })[]>;
  getClientsByIds(ids: string[]): Promise<Client[]>;
  getClientsPaginated(options: { limit?: number; offset?: number; search?: string; includeArchived?: boolean }): Promise<{
    clients: (Client & { sites: Site[] })[];
    total: number;
  }>;
  getClient(id: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<Client>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<boolean>;

  // Sites
  getSites(): Promise<(Site & { client: Client })[]>;
  getSitesByIds(ids: string[]): Promise<Site[]>;
  getSitesMinimal(): Promise<Array<{ id: string; name: string; address: string | null; city: string | null; province: string | null; clientId: string; isArchived: boolean }>>;
  getSitesMinimalByIds(ids: string[]): Promise<Array<{ id: string; name: string; address: string | null; city: string | null; province: string | null; clientId: string; isArchived: boolean }>>;
  getSitesForWorkQueue(): Promise<Array<{
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
  }>>;
  getSite(id: string): Promise<(Site & { client: Client; meterFiles: MeterFile[]; simulationRuns: SimulationRunSummary[] }) | undefined>;
  getSimulationRunFull(id: string): Promise<SimulationRun | undefined>;
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
  getCatalogItemByManufacturerModel(manufacturer: string, model: string): Promise<ComponentCatalog | undefined>;
  createCatalogItem(item: InsertComponentCatalog): Promise<ComponentCatalog>;
  updateCatalogItem(id: string, item: Partial<ComponentCatalog>): Promise<ComponentCatalog | undefined>;
  deleteCatalogItem(id: string): Promise<boolean>;

  // Pricing Components (Market Intelligence)
  getPricingComponents(): Promise<PricingComponent[]>;
  getPricingComponent(id: string): Promise<PricingComponent | undefined>;
  getPricingComponentsByCategory(category: string): Promise<PricingComponent[]>;
  getActivePricingComponents(): Promise<PricingComponent[]>;
  createPricingComponent(component: InsertPricingComponent): Promise<PricingComponent>;
  updatePricingComponent(id: string, component: Partial<PricingComponent>): Promise<PricingComponent | undefined>;
  deletePricingComponent(id: string): Promise<boolean>;

  // Dashboard Stats
  getDashboardStats(): Promise<{
    totalSites: number;
    activeAnalyses: number;
    totalSavings: number;
    co2Avoided: number;
    recentSites: Site[];
    recentAnalyses: SimulationRun[];
  }>;

  // Pipeline Stats for Sales Dashboard
  getPipelineStats(): Promise<{
    // Overall metrics
    totalPipelineValue: number;
    weightedPipelineValue: number;
    wonValue: number;
    lostValue: number;
    // Delivery phase metrics
    deliveryBacklogValue: number;
    deliveryBacklogCount: number;
    deliveredValue: number;
    deliveredCount: number;
    activeOpportunityCount: number;
    // Stage breakdown
    stageBreakdown: Array<{
      stage: string;
      count: number;
      totalValue: number;
      weightedValue: number;
    }>;
    // Top opportunities by value
    topOpportunities: Array<{
      id: string;
      name: string;
      clientName: string | null;
      stage: string;
      probability: number;
      estimatedValue: number | null;
      updatedAt: Date | null;
    }>;
    // At-risk opportunities (inactive > 30 days)
    atRiskOpportunities: Array<{
      id: string;
      name: string;
      clientName: string | null;
      stage: string;
      estimatedValue: number | null;
      daysSinceUpdate: number;
    }>;
    // Recent wins
    recentWins: Array<{
      id: string;
      name: string;
      clientName: string | null;
      estimatedValue: number | null;
      updatedAt: Date | null;
    }>;
    // Pending tasks from work queue
    pendingTasks: Array<{
      id: string;
      siteId: string;
      siteName: string;
      clientName: string | null;
      taskType: 'roof_drawing' | 'run_analysis';
      priority: 'urgent' | 'normal';
    }>;
    pendingTasksCount: {
      roofDrawing: number;
      runAnalysis: number;
      total: number;
    };
  }>;

  // Site Visits
  getSiteVisits(): Promise<SiteVisitWithSite[]>;
  getSiteVisit(id: string): Promise<SiteVisitWithSite | undefined>;
  getSiteVisitsBySite(siteId: string): Promise<SiteVisit[]>;
  createSiteVisit(visit: InsertSiteVisit): Promise<SiteVisit>;
  updateSiteVisit(id: string, visit: Partial<SiteVisit>): Promise<SiteVisit | undefined>;
  deleteSiteVisit(id: string): Promise<boolean>;

  // Site Visit Photos
  getSiteVisitPhotos(siteId: string): Promise<SiteVisitPhoto[]>;
  getSiteVisitPhotosByVisit(visitId: string): Promise<SiteVisitPhoto[]>;
  createSiteVisitPhoto(photo: InsertSiteVisitPhoto): Promise<SiteVisitPhoto>;
  deleteSiteVisitPhoto(id: string): Promise<boolean>;

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
  isSiteInAnyPortfolio(siteId: string): Promise<boolean>;
  addSiteToPortfolio(portfolioSite: InsertPortfolioSite): Promise<PortfolioSite>;
  removeSiteFromPortfolio(portfolioId: string, siteId: string): Promise<boolean>;
  updatePortfolioSite(id: string, data: Partial<PortfolioSite>): Promise<PortfolioSite | undefined>;

  // Blog Articles
  getBlogArticles(status?: string): Promise<BlogArticle[]>;
  getBlogArticle(id: string): Promise<BlogArticle | undefined>;
  getBlogArticleBySlug(slug: string): Promise<BlogArticle | undefined>;
  createBlogArticle(article: InsertBlogArticle): Promise<BlogArticle>;
  updateBlogArticle(id: string, article: Partial<BlogArticle>): Promise<BlogArticle | undefined>;
  deleteBlogArticle(id: string): Promise<boolean>;
  incrementArticleViews(id: string): Promise<void>;

  // Procuration Signatures
  getProcurationSignatures(): Promise<ProcurationSignature[]>;
  getProcurationSignature(id: string): Promise<ProcurationSignature | undefined>;
  getProcurationSignatureByLead(leadId: string): Promise<ProcurationSignature | undefined>;
  getProcurationSignaturesByClient(clientId: string): Promise<ProcurationSignature[]>;
  createProcurationSignature(signature: InsertProcurationSignature): Promise<ProcurationSignature>;
  updateProcurationSignature(id: string, signature: Partial<ProcurationSignature>): Promise<ProcurationSignature | undefined>;

  // Email Logs (for tracking sent emails and follow-ups)
  getEmailLogs(filters?: { siteId?: string; designAgreementId?: string; emailType?: string }): Promise<EmailLog[]>;
  getEmailLog(id: string): Promise<EmailLog | undefined>;
  createEmailLog(log: InsertEmailLog): Promise<EmailLog>;
  updateEmailLog(id: string, log: Partial<EmailLog>): Promise<EmailLog | undefined>;

  // Market Intelligence - Competitors
  getCompetitors(): Promise<Competitor[]>;
  getCompetitor(id: string): Promise<Competitor | undefined>;
  createCompetitor(competitor: InsertCompetitor): Promise<Competitor>;
  updateCompetitor(id: string, competitor: Partial<Competitor>): Promise<Competitor | undefined>;
  deleteCompetitor(id: string): Promise<boolean>;

  // Market Intelligence - Battle Cards
  getBattleCards(competitorId?: string): Promise<BattleCardWithCompetitor[]>;
  getBattleCard(id: string): Promise<BattleCardWithCompetitor | undefined>;
  createBattleCard(battleCard: InsertBattleCard): Promise<BattleCard>;
  updateBattleCard(id: string, battleCard: Partial<BattleCard>): Promise<BattleCard | undefined>;
  deleteBattleCard(id: string): Promise<boolean>;

  // Market Intelligence - Market Notes
  getMarketNotes(category?: string): Promise<MarketNote[]>;
  getMarketNote(id: string): Promise<MarketNote | undefined>;
  createMarketNote(note: InsertMarketNote): Promise<MarketNote>;
  updateMarketNote(id: string, note: Partial<MarketNote>): Promise<MarketNote | undefined>;
  deleteMarketNote(id: string): Promise<boolean>;

  // Market Intelligence - Documents
  getMarketDocuments(entityType?: string): Promise<MarketDocument[]>;
  getMarketDocument(id: string): Promise<MarketDocument | undefined>;
  createMarketDocument(doc: InsertMarketDocument): Promise<MarketDocument>;
  updateMarketDocument(id: string, doc: Partial<MarketDocument>): Promise<MarketDocument | undefined>;
  deleteMarketDocument(id: string): Promise<boolean>;

  // Market Intelligence - Competitor Proposal Analyses
  getCompetitorProposalAnalyses(): Promise<CompetitorProposalAnalysis[]>;
  getCompetitorProposalAnalysis(id: string): Promise<CompetitorProposalAnalysis | undefined>;
  createCompetitorProposalAnalysis(data: InsertCompetitorProposalAnalysis): Promise<CompetitorProposalAnalysis>;
  updateCompetitorProposalAnalysis(id: string, data: Partial<InsertCompetitorProposalAnalysis>): Promise<CompetitorProposalAnalysis | undefined>;
  deleteCompetitorProposalAnalysis(id: string): Promise<boolean>;

  // Construction Agreements
  getConstructionAgreements(): Promise<ConstructionAgreement[]>;
  getConstructionAgreement(id: string): Promise<ConstructionAgreement | undefined>;
  getConstructionAgreementsBySiteId(siteId: string): Promise<ConstructionAgreement[]>;
  createConstructionAgreement(agreement: InsertConstructionAgreement): Promise<ConstructionAgreement>;
  updateConstructionAgreement(id: string, agreement: Partial<ConstructionAgreement>): Promise<ConstructionAgreement | undefined>;
  deleteConstructionAgreement(id: string): Promise<boolean>;

  // Construction Milestones
  getConstructionMilestones(agreementId: string): Promise<ConstructionMilestone[]>;
  getConstructionMilestone(id: string): Promise<ConstructionMilestone | undefined>;
  getConstructionMilestonesByAgreementId(agreementId: string): Promise<ConstructionMilestone[]>;
  createConstructionMilestone(milestone: InsertConstructionMilestone): Promise<ConstructionMilestone>;
  updateConstructionMilestone(id: string, milestone: Partial<ConstructionMilestone>): Promise<ConstructionMilestone | undefined>;
  deleteConstructionMilestone(id: string): Promise<boolean>;

  // O&M Contracts
  getOmContracts(): Promise<OmContract[]>;
  getOmContract(id: string): Promise<OmContract | undefined>;
  getOmContractsByClientId(clientId: string): Promise<OmContract[]>;
  getOmContractsBySiteId(siteId: string): Promise<OmContract[]>;
  createOmContract(contract: InsertOmContract): Promise<OmContract>;
  updateOmContract(id: string, contract: Partial<OmContract>): Promise<OmContract | undefined>;
  deleteOmContract(id: string): Promise<boolean>;

  // O&M Visits
  getOmVisits(): Promise<OmVisit[]>;
  getOmVisit(id: string): Promise<OmVisit | undefined>;
  getOmVisitsByContractId(contractId: string): Promise<OmVisit[]>;
  createOmVisit(visit: InsertOmVisit): Promise<OmVisit>;
  updateOmVisit(id: string, visit: Partial<OmVisit>): Promise<OmVisit | undefined>;
  deleteOmVisit(id: string): Promise<boolean>;

  // O&M Performance Snapshots
  getOmPerformanceSnapshots(): Promise<OmPerformanceSnapshot[]>;
  getOmPerformanceSnapshot(id: string): Promise<OmPerformanceSnapshot | undefined>;
  getOmPerformanceSnapshotsByContractId(contractId: string): Promise<OmPerformanceSnapshot[]>;
  createOmPerformanceSnapshot(snapshot: InsertOmPerformanceSnapshot): Promise<OmPerformanceSnapshot>;
  updateOmPerformanceSnapshot(id: string, snapshot: Partial<OmPerformanceSnapshot>): Promise<OmPerformanceSnapshot | undefined>;
  deleteOmPerformanceSnapshot(id: string): Promise<boolean>;

  // Opportunities (Sales Pipeline)
  getOpportunities(): Promise<Opportunity[]>;
  getOpportunity(id: string): Promise<Opportunity | undefined>;
  getOpportunitiesByStage(stage: string): Promise<Opportunity[]>;
  getOpportunitiesByLeadId(leadId: string): Promise<Opportunity[]>;
  getOpportunitiesByClientId(clientId: string): Promise<Opportunity[]>;
  getOpportunitiesBySiteId(siteId: string): Promise<Opportunity[]>;
  getOpportunitiesByOwnerId(ownerId: string): Promise<Opportunity[]>;
  createOpportunity(opportunity: InsertOpportunity): Promise<Opportunity>;
  updateOpportunity(id: string, opportunity: Partial<Opportunity>): Promise<Opportunity | undefined>;
  deleteOpportunity(id: string): Promise<boolean>;
  updateOpportunityStage(id: string, stage: string, probability?: number, lostReason?: string, lostNotes?: string): Promise<Opportunity | undefined>;

  // Activities (Calls, Emails, Meetings Log)
  getActivities(): Promise<Activity[]>;
  getActivity(id: string): Promise<Activity | undefined>;
  getActivitiesByLeadId(leadId: string): Promise<Activity[]>;
  getActivitiesByClientId(clientId: string): Promise<Activity[]>;
  getActivitiesBySiteId(siteId: string): Promise<Activity[]>;
  getActivitiesByOpportunityId(opportunityId: string): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  updateActivity(id: string, activity: Partial<Activity>): Promise<Activity | undefined>;
  deleteActivity(id: string): Promise<boolean>;

  // Partnerships
  getPartnerships(): Promise<Partnership[]>;
  getPartnership(id: string): Promise<Partnership | undefined>;
  createPartnership(data: InsertPartnership): Promise<Partnership>;
  updatePartnership(id: string, data: Partial<InsertPartnership>): Promise<Partnership>;
  deletePartnership(id: string): Promise<void>;

  // Construction Projects
  getConstructionProjects(): Promise<ConstructionProject[]>;
  getConstructionProject(id: string): Promise<ConstructionProject | undefined>;
  getConstructionProjectsBySiteId(siteId: string): Promise<ConstructionProject[]>;
  createConstructionProject(project: InsertConstructionProject): Promise<ConstructionProject>;
  updateConstructionProject(id: string, project: Partial<ConstructionProject>): Promise<ConstructionProject | undefined>;
  deleteConstructionProject(id: string): Promise<boolean>;

  // Construction Tasks
  getConstructionTasks(): Promise<ConstructionTask[]>;
  getConstructionTask(id: string): Promise<ConstructionTask | undefined>;
  getConstructionTasksByProjectId(projectId: string): Promise<ConstructionTask[]>;
  createConstructionTask(task: InsertConstructionTask): Promise<ConstructionTask>;
  updateConstructionTask(id: string, task: Partial<ConstructionTask>): Promise<ConstructionTask | undefined>;
  deleteConstructionTask(id: string): Promise<boolean>;

  // Roof Polygons (user-drawn roof areas)
  getRoofPolygons(siteId: string): Promise<RoofPolygon[]>;
  getRoofPolygon(id: string): Promise<RoofPolygon | undefined>;
  createRoofPolygon(polygon: InsertRoofPolygon): Promise<RoofPolygon>;
  updateRoofPolygon(id: string, polygon: Partial<RoofPolygon>): Promise<RoofPolygon | undefined>;
  deleteRoofPolygon(id: string): Promise<boolean>;
  deleteRoofPolygonsBySite(siteId: string): Promise<number>;

  // Suppliers (Market Intelligence)
  getSuppliers(): Promise<Supplier[]>;
  getSupplier(id: string): Promise<Supplier | undefined>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: string, supplier: Partial<Supplier>): Promise<Supplier | undefined>;
  deleteSupplier(id: string): Promise<boolean>;
  getSuppliersByCategory(category: string): Promise<Supplier[]>;

  // Price History (Market Intelligence)
  getPriceHistory(): Promise<PriceHistory[]>;
  getPriceHistoryById(id: string): Promise<PriceHistory | undefined>;
  getPriceHistoryBySupplier(supplierId: string): Promise<PriceHistory[]>;
  getPriceHistoryByCategory(category: string): Promise<PriceHistory[]>;
  getPriceHistoryByItem(itemName: string): Promise<PriceHistory[]>;
  createPriceHistory(entry: InsertPriceHistory): Promise<PriceHistory>;
  deletePriceHistory(id: string): Promise<boolean>;

  // Google Solar Cache operations
  getGoogleSolarCacheByLocation(lat: number, lng: number): Promise<GoogleSolarCache | null>;
  setGoogleSolarCache(entry: InsertGoogleSolarCache): Promise<GoogleSolarCache>;
  incrementCacheHitCount(id: string): Promise<void>;
  cleanupExpiredCache(): Promise<number>; // Returns count of deleted entries
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
  private siteVisitPhotos: Map<string, SiteVisitPhoto> = new Map();
  private designAgreements: Map<string, DesignAgreement> = new Map();
  private portfolios: Map<string, Portfolio> = new Map();
  private portfolioSites: Map<string, PortfolioSite> = new Map();
  private blogArticles: Map<string, BlogArticle> = new Map();
  private procurationSignatures: Map<string, ProcurationSignature> = new Map();
  private emailLogs: Map<string, EmailLog> = new Map();
  private competitorsMap: Map<string, Competitor> = new Map();
  private battleCardsMap: Map<string, BattleCard> = new Map();
  private marketNotesMap: Map<string, MarketNote> = new Map();

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
  
  async updateUser(id: string, userData: Partial<User>): Promise<User | undefined> {
    const existing = this.users.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...userData, updatedAt: new Date() };
    this.users.set(id, updated);
    return updated;
  }
  
  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values()).sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getUsersByIds(ids: string[]): Promise<User[]> {
    return Array.from(this.users.values()).filter(u => ids.includes(u.id));
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

  async getClientsByIds(ids: string[]): Promise<Client[]> {
    return Array.from(this.clients.values()).filter(c => ids.includes(c.id));
  }

  async getClientsPaginated(options: { limit?: number; offset?: number; search?: string; includeArchived?: boolean } = {}): Promise<{
    clients: (Client & { sites: Site[] })[];
    total: number;
  }> {
    const { limit = 50, offset = 0, search, includeArchived = false } = options;
    let clients = Array.from(this.clients.values());
    
    // Filter out archived clients unless requested
    if (!includeArchived) {
      clients = clients.filter(c => !c.isArchived);
    }
    
    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      clients = clients.filter(c => 
        c.name?.toLowerCase().includes(searchLower) ||
        c.mainContactName?.toLowerCase().includes(searchLower) ||
        c.email?.toLowerCase().includes(searchLower) ||
        c.city?.toLowerCase().includes(searchLower)
      );
    }
    
    // Sort by createdAt descending
    clients.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
    
    const total = clients.length;
    const paginated = clients.slice(offset, offset + limit);
    
    // Add site counts to each client (optimized - only count, not full sites)
    const allSites = Array.from(this.sites.values());
    const clientsWithSites = paginated.map(client => {
      const clientSites = allSites.filter(s => s.clientId === client.id);
      return {
        ...client,
        sites: [] as Site[],
        siteCount: clientSites.length,
      };
    });
    
    return { clients: clientsWithSites, total };
  }

  async getClient(id: string): Promise<Client | undefined> {
    return this.clients.get(id);
  }

  async createClient(client: InsertClient): Promise<Client> {
    const id = randomUUID();
    const newClient: Client = {
      id,
      ...client,
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

  async getSitesByIds(ids: string[]): Promise<Site[]> {
    return Array.from(this.sites.values()).filter(s => ids.includes(s.id));
  }

  async getSitesMinimalByIds(ids: string[]): Promise<Array<{ id: string; name: string; address: string | null; city: string | null; province: string | null; clientId: string; isArchived: boolean }>> {
    return Array.from(this.sites.values())
      .filter(s => ids.includes(s.id))
      .map(site => ({
        id: site.id,
        name: site.name,
        address: site.address,
        city: site.city,
        province: site.province,
        clientId: site.clientId,
        isArchived: site.isArchived ?? false,
      }));
  }

  async getSitesMinimal(): Promise<Array<{ id: string; name: string; address: string | null; city: string | null; province: string | null; clientId: string; isArchived: boolean }>> {
    const sites = Array.from(this.sites.values());
    return sites.map(site => ({
      id: site.id,
      name: site.name,
      address: site.address,
      city: site.city,
      province: site.province,
      clientId: site.clientId,
      isArchived: site.isArchived ?? false,
    }));
  }

  async getSitesForWorkQueue(): Promise<Array<{
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
    const sites = Array.from(this.sites.values()).filter(s => !s.isArchived);
    return sites.map(site => ({
      id: site.id,
      name: site.name,
      address: site.address,
      city: site.city,
      province: site.province,
      clientId: site.clientId,
      isArchived: site.isArchived ?? false,
      roofAreaValidated: site.roofAreaValidated ?? null,
      quickAnalysisCompletedAt: site.quickAnalysisCompletedAt ?? null,
      workQueueAssignedToId: site.workQueueAssignedToId ?? null,
      workQueueAssignedAt: site.workQueueAssignedAt ?? null,
      workQueuePriority: site.workQueuePriority ?? null,
      workQueueDelegatedToEmail: site.workQueueDelegatedToEmail ?? null,
      workQueueDelegatedToName: site.workQueueDelegatedToName ?? null,
      workQueueDelegatedAt: site.workQueueDelegatedAt ?? null,
    }));
  }

  async getSite(id: string): Promise<(Site & { client: Client; meterFiles: MeterFile[]; simulationRuns: SimulationRunSummary[] }) | undefined> {
    const site = this.sites.get(id);
    if (!site) return undefined;
    const client = this.clients.get(site.clientId);
    if (!client) return undefined;
    
    // Sort simulation runs by createdAt descending so the latest is first
    // Return lightweight summaries (exclude heavy JSON columns)
    const simRuns = Array.from(this.simulationRuns.values())
      .filter(r => r.siteId === id)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
      .map(({ cashflows, breakdown, hourlyProfile, peakWeekData, sensitivity, ...rest }) => rest);
    
    return {
      ...site,
      client,
      meterFiles: Array.from(this.meterFiles.values()).filter(f => f.siteId === id),
      simulationRuns: simRuns,
    };
  }

  async getSimulationRunFull(id: string): Promise<SimulationRun | undefined> {
    return this.simulationRuns.get(id);
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
  
  async getCatalogItemByManufacturerModel(manufacturer: string, model: string): Promise<ComponentCatalog | undefined> {
    return Array.from(this.catalogItems.values()).find(c => c.manufacturer === manufacturer && c.model === model);
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

  // Pricing Components (Market Intelligence)
  private pricingComponents = new Map<string, PricingComponent>();

  async getPricingComponents(): Promise<PricingComponent[]> {
    return Array.from(this.pricingComponents.values());
  }

  async getPricingComponent(id: string): Promise<PricingComponent | undefined> {
    return this.pricingComponents.get(id);
  }

  async getPricingComponentsByCategory(category: string): Promise<PricingComponent[]> {
    return Array.from(this.pricingComponents.values()).filter(c => c.category === category);
  }

  async getActivePricingComponents(): Promise<PricingComponent[]> {
    return Array.from(this.pricingComponents.values()).filter(c => c.active);
  }

  async createPricingComponent(component: InsertPricingComponent): Promise<PricingComponent> {
    const id = crypto.randomUUID();
    const now = new Date();
    const newComponent: PricingComponent = { 
      ...component, 
      id, 
      createdAt: now, 
      updatedAt: now,
      description: component.description ?? null,
      minQuantity: component.minQuantity ?? null,
      maxQuantity: component.maxQuantity ?? null,
      source: component.source ?? null,
      sourceDate: component.sourceDate ?? null,
      validUntil: component.validUntil ?? null,
      notes: component.notes ?? null,
      active: component.active ?? true,
    };
    this.pricingComponents.set(id, newComponent);
    return newComponent;
  }

  async updatePricingComponent(id: string, component: Partial<PricingComponent>): Promise<PricingComponent | undefined> {
    const existing = this.pricingComponents.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...component, updatedAt: new Date() };
    this.pricingComponents.set(id, updated);
    return updated;
  }

  async deletePricingComponent(id: string): Promise<boolean> {
    return this.pricingComponents.delete(id);
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
    stageBreakdown: Array<{ stage: string; count: number; totalValue: number; weightedValue: number }>;
    topOpportunities: Array<{ id: string; name: string; clientName: string | null; stage: string; probability: number; estimatedValue: number | null; updatedAt: Date | null }>;
    atRiskOpportunities: Array<{ id: string; name: string; clientName: string | null; stage: string; estimatedValue: number | null; daysSinceUpdate: number }>;
    recentWins: Array<{ id: string; name: string; clientName: string | null; estimatedValue: number | null; updatedAt: Date | null }>;
    pendingTasks: Array<{ id: string; siteId: string; siteName: string; clientName: string | null; taskType: 'roof_drawing' | 'run_analysis'; priority: 'urgent' | 'normal' }>;
    pendingTasksCount: { roofDrawing: number; runAnalysis: number; total: number };
  }> {
    // Simple implementation for MemStorage - returns empty data
    return {
      totalPipelineValue: 0,
      weightedPipelineValue: 0,
      wonValue: 0,
      lostValue: 0,
      deliveryBacklogValue: 0,
      deliveryBacklogCount: 0,
      deliveredValue: 0,
      deliveredCount: 0,
      activeOpportunityCount: 0,
      stageBreakdown: [],
      topOpportunities: [],
      atRiskOpportunities: [],
      recentWins: [],
      pendingTasks: [],
      pendingTasksCount: { roofDrawing: 0, runAnalysis: 0, total: 0 },
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

  // Site Visit Photos
  async getSiteVisitPhotos(siteId: string): Promise<SiteVisitPhoto[]> {
    return Array.from(this.siteVisitPhotos.values())
      .filter(p => p.siteId === siteId)
      .sort((a, b) => new Date(b.uploadedAt!).getTime() - new Date(a.uploadedAt!).getTime());
  }

  async getSiteVisitPhotosByVisit(visitId: string): Promise<SiteVisitPhoto[]> {
    return Array.from(this.siteVisitPhotos.values())
      .filter(p => p.visitId === visitId)
      .sort((a, b) => new Date(b.uploadedAt!).getTime() - new Date(a.uploadedAt!).getTime());
  }

  async createSiteVisitPhoto(photo: InsertSiteVisitPhoto): Promise<SiteVisitPhoto> {
    const id = randomUUID();
    const newPhoto: SiteVisitPhoto = {
      ...photo,
      id,
      uploadedAt: new Date(),
    };
    this.siteVisitPhotos.set(id, newPhoto);
    return newPhoto;
  }

  async deleteSiteVisitPhoto(id: string): Promise<boolean> {
    return this.siteVisitPhotos.delete(id);
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

  async isSiteInAnyPortfolio(siteId: string): Promise<boolean> {
    return Array.from(this.portfolioSites.values()).some(ps => ps.siteId === siteId);
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

  // Blog Articles
  async getBlogArticles(status?: string): Promise<BlogArticle[]> {
    let articles = Array.from(this.blogArticles.values());
    if (status) {
      articles = articles.filter(a => a.status === status);
    }
    return articles.sort((a, b) => 
      (b.publishedAt?.getTime() || b.createdAt?.getTime() || 0) - 
      (a.publishedAt?.getTime() || a.createdAt?.getTime() || 0)
    );
  }

  async getBlogArticle(id: string): Promise<BlogArticle | undefined> {
    return this.blogArticles.get(id);
  }

  async getBlogArticleBySlug(slug: string): Promise<BlogArticle | undefined> {
    return Array.from(this.blogArticles.values()).find(a => a.slug === slug);
  }

  async createBlogArticle(article: InsertBlogArticle): Promise<BlogArticle> {
    const id = randomUUID();
    const newArticle: BlogArticle = {
      id,
      ...article,
      status: article.status || "draft",
      viewCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.blogArticles.set(id, newArticle);
    return newArticle;
  }

  async updateBlogArticle(id: string, article: Partial<BlogArticle>): Promise<BlogArticle | undefined> {
    const existing = this.blogArticles.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...article, updatedAt: new Date() };
    this.blogArticles.set(id, updated);
    return updated;
  }

  async deleteBlogArticle(id: string): Promise<boolean> {
    return this.blogArticles.delete(id);
  }

  async incrementArticleViews(id: string): Promise<void> {
    const existing = this.blogArticles.get(id);
    if (existing) {
      existing.viewCount = (existing.viewCount || 0) + 1;
      this.blogArticles.set(id, existing);
    }
  }

  // Procuration Signatures
  async getProcurationSignatures(): Promise<ProcurationSignature[]> {
    return Array.from(this.procurationSignatures.values());
  }

  async getProcurationSignature(id: string): Promise<ProcurationSignature | undefined> {
    return this.procurationSignatures.get(id);
  }

  async getProcurationSignatureByLead(leadId: string): Promise<ProcurationSignature | undefined> {
    return Array.from(this.procurationSignatures.values()).find(s => s.leadId === leadId);
  }

  async getProcurationSignaturesByClient(clientId: string): Promise<ProcurationSignature[]> {
    return Array.from(this.procurationSignatures.values())
      .filter(s => s.clientId === clientId)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }

  async createProcurationSignature(signature: InsertProcurationSignature): Promise<ProcurationSignature> {
    const id = randomUUID();
    const newSignature: ProcurationSignature = {
      id,
      ...signature,
      companyName: signature.companyName ?? null,
      hqAccountNumber: signature.hqAccountNumber ?? null,
      leadId: signature.leadId ?? null,
      status: signature.status || "draft",
      sentAt: null,
      viewedAt: null,
      signedAt: null,
      signedDocumentUrl: null,
      language: signature.language ?? "fr",
      ipAddress: signature.ipAddress ?? null,
      userAgent: signature.userAgent ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.procurationSignatures.set(id, newSignature);
    return newSignature;
  }

  async updateProcurationSignature(id: string, signature: Partial<ProcurationSignature>): Promise<ProcurationSignature | undefined> {
    const existing = this.procurationSignatures.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...signature, updatedAt: new Date() };
    this.procurationSignatures.set(id, updated);
    return updated;
  }

  // Email Logs
  async getEmailLogs(filters?: { siteId?: string; designAgreementId?: string; emailType?: string }): Promise<EmailLog[]> {
    let logs = Array.from(this.emailLogs.values());
    if (filters?.siteId) {
      logs = logs.filter(l => l.siteId === filters.siteId);
    }
    if (filters?.designAgreementId) {
      logs = logs.filter(l => l.designAgreementId === filters.designAgreementId);
    }
    if (filters?.emailType) {
      logs = logs.filter(l => l.emailType === filters.emailType);
    }
    return logs.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getEmailLog(id: string): Promise<EmailLog | undefined> {
    return this.emailLogs.get(id);
  }

  async createEmailLog(log: InsertEmailLog): Promise<EmailLog> {
    const id = randomUUID();
    const newLog: EmailLog = {
      id,
      ...log,
      siteId: log.siteId ?? null,
      designAgreementId: log.designAgreementId ?? null,
      leadId: log.leadId ?? null,
      recipientName: log.recipientName ?? null,
      sentByUserId: log.sentByUserId ?? null,
      customMessage: log.customMessage ?? null,
      status: "sent",
      errorMessage: null,
      createdAt: new Date(),
    };
    this.emailLogs.set(id, newLog);
    return newLog;
  }

  async updateEmailLog(id: string, log: Partial<EmailLog>): Promise<EmailLog | undefined> {
    const existing = this.emailLogs.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...log };
    this.emailLogs.set(id, updated);
    return updated;
  }

  // Market Intelligence - Competitors
  async getCompetitors(): Promise<Competitor[]> {
    return Array.from(this.competitorsMap.values())
      .filter(c => c.isActive)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getCompetitor(id: string): Promise<Competitor | undefined> {
    return this.competitorsMap.get(id);
  }

  async createCompetitor(competitor: InsertCompetitor): Promise<Competitor> {
    const id = randomUUID();
    const newCompetitor: Competitor = {
      id,
      name: competitor.name,
      type: competitor.type ?? "installer",
      website: competitor.website ?? null,
      headquartersCity: competitor.headquartersCity ?? null,
      province: competitor.province ?? null,
      businessModel: competitor.businessModel ?? null,
      targetMarket: competitor.targetMarket ?? null,
      ppaYear1Rate: competitor.ppaYear1Rate ?? null,
      ppaYear2Rate: competitor.ppaYear2Rate ?? null,
      ppaTerm: competitor.ppaTerm ?? null,
      cashPricePerWatt: competitor.cashPricePerWatt ?? null,
      strengths: competitor.strengths ?? null,
      weaknesses: competitor.weaknesses ?? null,
      legalNotes: competitor.legalNotes ?? null,
      isActive: competitor.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.competitorsMap.set(id, newCompetitor);
    return newCompetitor;
  }

  async updateCompetitor(id: string, competitor: Partial<Competitor>): Promise<Competitor | undefined> {
    const existing = this.competitorsMap.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...competitor, updatedAt: new Date() };
    this.competitorsMap.set(id, updated);
    return updated;
  }

  async deleteCompetitor(id: string): Promise<boolean> {
    return this.competitorsMap.delete(id);
  }

  // Market Intelligence - Battle Cards
  async getBattleCards(competitorId?: string): Promise<BattleCardWithCompetitor[]> {
    let cards = Array.from(this.battleCardsMap.values()).filter(c => c.isActive);
    if (competitorId) {
      cards = cards.filter(c => c.competitorId === competitorId);
    }
    return cards.map(card => {
      const competitor = this.competitorsMap.get(card.competitorId);
      return { ...card, competitor: competitor! };
    }).filter(c => c.competitor).sort((a, b) => (a.priority || 1) - (b.priority || 1));
  }

  async getBattleCard(id: string): Promise<BattleCardWithCompetitor | undefined> {
    const card = this.battleCardsMap.get(id);
    if (!card) return undefined;
    const competitor = this.competitorsMap.get(card.competitorId);
    if (!competitor) return undefined;
    return { ...card, competitor };
  }

  async createBattleCard(battleCard: InsertBattleCard): Promise<BattleCard> {
    const id = randomUUID();
    const newCard: BattleCard = {
      id,
      competitorId: battleCard.competitorId,
      objectionScenario: battleCard.objectionScenario,
      responseStrategy: battleCard.responseStrategy,
      keyDifferentiators: battleCard.keyDifferentiators ?? null,
      financialComparison: battleCard.financialComparison ?? null,
      language: battleCard.language ?? "fr",
      priority: battleCard.priority ?? 1,
      isActive: battleCard.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.battleCardsMap.set(id, newCard);
    return newCard;
  }

  async updateBattleCard(id: string, battleCard: Partial<BattleCard>): Promise<BattleCard | undefined> {
    const existing = this.battleCardsMap.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...battleCard, updatedAt: new Date() };
    this.battleCardsMap.set(id, updated);
    return updated;
  }

  async deleteBattleCard(id: string): Promise<boolean> {
    return this.battleCardsMap.delete(id);
  }

  // Market Intelligence - Market Notes
  async getMarketNotes(category?: string): Promise<MarketNote[]> {
    let notes = Array.from(this.marketNotesMap.values()).filter(n => n.status === "active");
    if (category) {
      notes = notes.filter(n => n.category === category);
    }
    return notes.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getMarketNote(id: string): Promise<MarketNote | undefined> {
    return this.marketNotesMap.get(id);
  }

  async createMarketNote(note: InsertMarketNote): Promise<MarketNote> {
    const id = randomUUID();
    const newNote: MarketNote = {
      id,
      category: note.category,
      title: note.title,
      content: note.content,
      jurisdiction: note.jurisdiction ?? "QC",
      sourceUrl: note.sourceUrl ?? null,
      sourceDate: note.sourceDate ?? null,
      importance: note.importance ?? "medium",
      status: note.status ?? "active",
      expiresAt: note.expiresAt ?? null,
      tags: note.tags ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.marketNotesMap.set(id, newNote);
    return newNote;
  }

  async updateMarketNote(id: string, note: Partial<MarketNote>): Promise<MarketNote | undefined> {
    const existing = this.marketNotesMap.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...note, updatedAt: new Date() };
    this.marketNotesMap.set(id, updated);
    return updated;
  }

  async deleteMarketNote(id: string): Promise<boolean> {
    return this.marketNotesMap.delete(id);
  }

  // Market Intelligence - Documents
  private marketDocumentsMap: Map<string, MarketDocument> = new Map();

  async getMarketDocuments(entityType?: string): Promise<MarketDocument[]> {
    let docs = Array.from(this.marketDocumentsMap.values());
    if (entityType) {
      docs = docs.filter(d => d.entityType === entityType);
    }
    return docs.sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getMarketDocument(id: string): Promise<MarketDocument | undefined> {
    return this.marketDocumentsMap.get(id);
  }

  async createMarketDocument(doc: InsertMarketDocument): Promise<MarketDocument> {
    const id = randomUUID();
    const newDoc: MarketDocument = {
      ...doc,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.marketDocumentsMap.set(id, newDoc);
    return newDoc;
  }

  async updateMarketDocument(id: string, doc: Partial<MarketDocument>): Promise<MarketDocument | undefined> {
    const existing = this.marketDocumentsMap.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...doc, updatedAt: new Date() };
    this.marketDocumentsMap.set(id, updated);
    return updated;
  }

  async deleteMarketDocument(id: string): Promise<boolean> {
    return this.marketDocumentsMap.delete(id);
  }

  // Competitor Proposal Analyses - stub implementations
  async getCompetitorProposalAnalyses(): Promise<CompetitorProposalAnalysis[]> { return []; }
  async getCompetitorProposalAnalysis(id: string): Promise<CompetitorProposalAnalysis | undefined> { return undefined; }
  async createCompetitorProposalAnalysis(data: InsertCompetitorProposalAnalysis): Promise<CompetitorProposalAnalysis> { throw new Error("Not implemented"); }
  async updateCompetitorProposalAnalysis(id: string, data: Partial<InsertCompetitorProposalAnalysis>): Promise<CompetitorProposalAnalysis | undefined> { return undefined; }
  async deleteCompetitorProposalAnalysis(id: string): Promise<boolean> { return false; }

  // Construction Agreements - stub implementations (MemStorage not used in production)
  private constructionAgreementsMap: Map<string, ConstructionAgreement> = new Map();

  async getConstructionAgreements(): Promise<ConstructionAgreement[]> {
    return Array.from(this.constructionAgreementsMap.values())
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async getConstructionAgreement(id: string): Promise<ConstructionAgreement | undefined> {
    return this.constructionAgreementsMap.get(id);
  }

  async getConstructionAgreementsBySiteId(siteId: string): Promise<ConstructionAgreement[]> {
    return Array.from(this.constructionAgreementsMap.values())
      .filter(a => a.siteId === siteId)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async createConstructionAgreement(agreement: InsertConstructionAgreement): Promise<ConstructionAgreement> {
    const id = randomUUID();
    const newAgreement: ConstructionAgreement = {
      ...agreement,
      id,
      publicToken: randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as ConstructionAgreement;
    this.constructionAgreementsMap.set(id, newAgreement);
    return newAgreement;
  }

  async updateConstructionAgreement(id: string, agreement: Partial<ConstructionAgreement>): Promise<ConstructionAgreement | undefined> {
    const existing = this.constructionAgreementsMap.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...agreement, updatedAt: new Date() };
    this.constructionAgreementsMap.set(id, updated);
    return updated;
  }

  async deleteConstructionAgreement(id: string): Promise<boolean> {
    return this.constructionAgreementsMap.delete(id);
  }

  // Construction Milestones
  private constructionMilestonesMap: Map<string, ConstructionMilestone> = new Map();

  async getConstructionMilestones(agreementId: string): Promise<ConstructionMilestone[]> {
    return Array.from(this.constructionMilestonesMap.values())
      .filter(m => m.constructionAgreementId === agreementId)
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }

  async getConstructionMilestone(id: string): Promise<ConstructionMilestone | undefined> {
    return this.constructionMilestonesMap.get(id);
  }

  async getConstructionMilestonesByAgreementId(agreementId: string): Promise<ConstructionMilestone[]> {
    return this.getConstructionMilestones(agreementId);
  }

  async createConstructionMilestone(milestone: InsertConstructionMilestone): Promise<ConstructionMilestone> {
    const id = randomUUID();
    const newMilestone: ConstructionMilestone = {
      ...milestone,
      id,
      createdAt: new Date(),
    } as ConstructionMilestone;
    this.constructionMilestonesMap.set(id, newMilestone);
    return newMilestone;
  }

  async updateConstructionMilestone(id: string, milestone: Partial<ConstructionMilestone>): Promise<ConstructionMilestone | undefined> {
    const existing = this.constructionMilestonesMap.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...milestone };
    this.constructionMilestonesMap.set(id, updated);
    return updated;
  }

  async deleteConstructionMilestone(id: string): Promise<boolean> {
    return this.constructionMilestonesMap.delete(id);
  }

  // O&M Contracts
  private omContractsMap: Map<string, OmContract> = new Map();

  async getOmContracts(): Promise<OmContract[]> {
    return Array.from(this.omContractsMap.values())
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async getOmContract(id: string): Promise<OmContract | undefined> {
    return this.omContractsMap.get(id);
  }

  async getOmContractsByClientId(clientId: string): Promise<OmContract[]> {
    return Array.from(this.omContractsMap.values())
      .filter(c => c.clientId === clientId)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async getOmContractsBySiteId(siteId: string): Promise<OmContract[]> {
    return Array.from(this.omContractsMap.values())
      .filter(c => c.siteId === siteId)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async createOmContract(contract: InsertOmContract): Promise<OmContract> {
    const id = randomUUID();
    const newContract: OmContract = {
      ...contract,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as OmContract;
    this.omContractsMap.set(id, newContract);
    return newContract;
  }

  async updateOmContract(id: string, contract: Partial<OmContract>): Promise<OmContract | undefined> {
    const existing = this.omContractsMap.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...contract, updatedAt: new Date() };
    this.omContractsMap.set(id, updated);
    return updated;
  }

  async deleteOmContract(id: string): Promise<boolean> {
    return this.omContractsMap.delete(id);
  }

  // O&M Visits
  private omVisitsMap: Map<string, OmVisit> = new Map();

  async getOmVisits(): Promise<OmVisit[]> {
    return Array.from(this.omVisitsMap.values())
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async getOmVisit(id: string): Promise<OmVisit | undefined> {
    return this.omVisitsMap.get(id);
  }

  async getOmVisitsByContractId(contractId: string): Promise<OmVisit[]> {
    return Array.from(this.omVisitsMap.values())
      .filter(v => v.omContractId === contractId)
      .sort((a, b) => new Date(b.scheduledDate!).getTime() - new Date(a.scheduledDate!).getTime());
  }

  async createOmVisit(visit: InsertOmVisit): Promise<OmVisit> {
    const id = randomUUID();
    const newVisit: OmVisit = {
      ...visit,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as OmVisit;
    this.omVisitsMap.set(id, newVisit);
    return newVisit;
  }

  async updateOmVisit(id: string, visit: Partial<OmVisit>): Promise<OmVisit | undefined> {
    const existing = this.omVisitsMap.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...visit, updatedAt: new Date() };
    this.omVisitsMap.set(id, updated);
    return updated;
  }

  async deleteOmVisit(id: string): Promise<boolean> {
    return this.omVisitsMap.delete(id);
  }

  // O&M Performance Snapshots
  private omPerformanceSnapshotsMap: Map<string, OmPerformanceSnapshot> = new Map();

  async getOmPerformanceSnapshots(): Promise<OmPerformanceSnapshot[]> {
    return Array.from(this.omPerformanceSnapshotsMap.values())
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async getOmPerformanceSnapshot(id: string): Promise<OmPerformanceSnapshot | undefined> {
    return this.omPerformanceSnapshotsMap.get(id);
  }

  async getOmPerformanceSnapshotsByContractId(contractId: string): Promise<OmPerformanceSnapshot[]> {
    return Array.from(this.omPerformanceSnapshotsMap.values())
      .filter(s => s.omContractId === contractId)
      .sort((a, b) => new Date(b.periodStart!).getTime() - new Date(a.periodStart!).getTime());
  }

  async createOmPerformanceSnapshot(snapshot: InsertOmPerformanceSnapshot): Promise<OmPerformanceSnapshot> {
    const id = randomUUID();
    const newSnapshot: OmPerformanceSnapshot = {
      ...snapshot,
      id,
      createdAt: new Date(),
    } as OmPerformanceSnapshot;
    this.omPerformanceSnapshotsMap.set(id, newSnapshot);
    return newSnapshot;
  }

  async updateOmPerformanceSnapshot(id: string, snapshot: Partial<OmPerformanceSnapshot>): Promise<OmPerformanceSnapshot | undefined> {
    const existing = this.omPerformanceSnapshotsMap.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...snapshot };
    this.omPerformanceSnapshotsMap.set(id, updated);
    return updated;
  }

  async deleteOmPerformanceSnapshot(id: string): Promise<boolean> {
    return this.omPerformanceSnapshotsMap.delete(id);
  }

  // Opportunities (Sales Pipeline)
  private opportunitiesMap: Map<string, Opportunity> = new Map();

  async getOpportunities(): Promise<Opportunity[]> {
    return Array.from(this.opportunitiesMap.values())
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async getOpportunity(id: string): Promise<Opportunity | undefined> {
    return this.opportunitiesMap.get(id);
  }

  async getOpportunitiesByStage(stage: string): Promise<Opportunity[]> {
    return Array.from(this.opportunitiesMap.values())
      .filter(o => o.stage === stage)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async getOpportunitiesByLeadId(leadId: string): Promise<Opportunity[]> {
    return Array.from(this.opportunitiesMap.values())
      .filter(o => o.leadId === leadId)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async getOpportunitiesByClientId(clientId: string): Promise<Opportunity[]> {
    return Array.from(this.opportunitiesMap.values())
      .filter(o => o.clientId === clientId)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async getOpportunitiesBySiteId(siteId: string): Promise<Opportunity[]> {
    return Array.from(this.opportunitiesMap.values())
      .filter(o => o.siteId === siteId)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async getOpportunitiesByOwnerId(ownerId: string): Promise<Opportunity[]> {
    return Array.from(this.opportunitiesMap.values())
      .filter(o => o.ownerId === ownerId)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async createOpportunity(opportunity: InsertOpportunity): Promise<Opportunity> {
    const id = randomUUID();
    const newOpportunity: Opportunity = {
      ...opportunity,
      id,
      leadId: opportunity.leadId ?? null,
      clientId: opportunity.clientId ?? null,
      siteId: opportunity.siteId ?? null,
      description: opportunity.description ?? null,
      stage: opportunity.stage ?? "prospect",
      probability: opportunity.probability ?? 10,
      estimatedValue: opportunity.estimatedValue ?? null,
      pvSizeKW: opportunity.pvSizeKW ?? null,
      expectedCloseDate: opportunity.expectedCloseDate ?? null,
      actualCloseDate: opportunity.actualCloseDate ?? null,
      lostReason: opportunity.lostReason ?? null,
      lostNotes: opportunity.lostNotes ?? null,
      ownerId: opportunity.ownerId ?? null,
      source: opportunity.source ?? null,
      sourceDetails: opportunity.sourceDetails ?? null,
      priority: opportunity.priority ?? "medium",
      tags: opportunity.tags ?? null,
      nextActionDate: opportunity.nextActionDate ?? null,
      nextActionDescription: opportunity.nextActionDescription ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.opportunitiesMap.set(id, newOpportunity);
    return newOpportunity;
  }

  async updateOpportunity(id: string, opportunity: Partial<Opportunity>): Promise<Opportunity | undefined> {
    const existing = this.opportunitiesMap.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...opportunity, updatedAt: new Date() };
    this.opportunitiesMap.set(id, updated);
    return updated;
  }

  async deleteOpportunity(id: string): Promise<boolean> {
    return this.opportunitiesMap.delete(id);
  }

  async updateOpportunityStage(id: string, stage: string, probability?: number, lostReason?: string, lostNotes?: string): Promise<Opportunity | undefined> {
    const existing = this.opportunitiesMap.get(id);
    if (!existing) return undefined;
    const updated: Opportunity = {
      ...existing,
      stage,
      probability: probability ?? existing.probability,
      lostReason: lostReason ?? existing.lostReason,
      lostNotes: lostNotes ?? existing.lostNotes,
      actualCloseDate: (stage === "won" || stage === "lost") ? new Date() : existing.actualCloseDate,
      updatedAt: new Date(),
    };
    this.opportunitiesMap.set(id, updated);
    return updated;
  }

  // Activities (Calls, Emails, Meetings Log)
  private activitiesMap: Map<string, Activity> = new Map();

  async getActivities(): Promise<Activity[]> {
    return Array.from(this.activitiesMap.values())
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async getActivity(id: string): Promise<Activity | undefined> {
    return this.activitiesMap.get(id);
  }

  async getActivitiesByLeadId(leadId: string): Promise<Activity[]> {
    return Array.from(this.activitiesMap.values())
      .filter(a => a.leadId === leadId)
      .sort((a, b) => new Date(b.activityDate!).getTime() - new Date(a.activityDate!).getTime());
  }

  async getActivitiesByClientId(clientId: string): Promise<Activity[]> {
    return Array.from(this.activitiesMap.values())
      .filter(a => a.clientId === clientId)
      .sort((a, b) => new Date(b.activityDate!).getTime() - new Date(a.activityDate!).getTime());
  }

  async getActivitiesBySiteId(siteId: string): Promise<Activity[]> {
    return Array.from(this.activitiesMap.values())
      .filter(a => a.siteId === siteId)
      .sort((a, b) => new Date(b.activityDate!).getTime() - new Date(a.activityDate!).getTime());
  }

  async getActivitiesByOpportunityId(opportunityId: string): Promise<Activity[]> {
    return Array.from(this.activitiesMap.values())
      .filter(a => a.opportunityId === opportunityId)
      .sort((a, b) => new Date(b.activityDate!).getTime() - new Date(a.activityDate!).getTime());
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const id = randomUUID();
    const newActivity: Activity = {
      ...activity,
      id,
      leadId: activity.leadId ?? null,
      clientId: activity.clientId ?? null,
      siteId: activity.siteId ?? null,
      opportunityId: activity.opportunityId ?? null,
      direction: activity.direction ?? null,
      subject: activity.subject ?? null,
      description: activity.description ?? null,
      activityDate: activity.activityDate ?? new Date(),
      duration: activity.duration ?? null,
      outcome: activity.outcome ?? null,
      followUpDate: activity.followUpDate ?? null,
      followUpNotes: activity.followUpNotes ?? null,
      createdBy: activity.createdBy ?? null,
      createdAt: new Date(),
    };
    this.activitiesMap.set(id, newActivity);
    return newActivity;
  }

  async updateActivity(id: string, activity: Partial<Activity>): Promise<Activity | undefined> {
    const existing = this.activitiesMap.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...activity };
    this.activitiesMap.set(id, updated);
    return updated;
  }

  async deleteActivity(id: string): Promise<boolean> {
    return this.activitiesMap.delete(id);
  }

  // Partnerships
  async getPartnerships(): Promise<Partnership[]> { return []; }
  async getPartnership(id: string): Promise<Partnership | undefined> { return undefined; }
  async createPartnership(data: InsertPartnership): Promise<Partnership> { throw new Error("Not implemented"); }
  async updatePartnership(id: string, data: Partial<InsertPartnership>): Promise<Partnership> { throw new Error("Not implemented"); }
  async deletePartnership(id: string): Promise<void> {}

  // Construction Projects
  async getConstructionProjects(): Promise<ConstructionProject[]> { return []; }
  async getConstructionProject(id: string): Promise<ConstructionProject | undefined> { return undefined; }
  async getConstructionProjectsBySiteId(siteId: string): Promise<ConstructionProject[]> { return []; }
  async createConstructionProject(project: InsertConstructionProject): Promise<ConstructionProject> { throw new Error("Not implemented"); }
  async updateConstructionProject(id: string, project: Partial<ConstructionProject>): Promise<ConstructionProject | undefined> { return undefined; }
  async deleteConstructionProject(id: string): Promise<boolean> { return false; }

  // Construction Tasks
  async getConstructionTasks(): Promise<ConstructionTask[]> { return []; }
  async getConstructionTask(id: string): Promise<ConstructionTask | undefined> { return undefined; }
  async getConstructionTasksByProjectId(projectId: string): Promise<ConstructionTask[]> { return []; }
  async createConstructionTask(task: InsertConstructionTask): Promise<ConstructionTask> { throw new Error("Not implemented"); }
  async updateConstructionTask(id: string, task: Partial<ConstructionTask>): Promise<ConstructionTask | undefined> { return undefined; }
  async deleteConstructionTask(id: string): Promise<boolean> { return false; }

  // Roof Polygons (user-drawn roof areas)
  async getRoofPolygons(siteId: string): Promise<RoofPolygon[]> { return []; }
  async getRoofPolygon(id: string): Promise<RoofPolygon | undefined> { return undefined; }
  async createRoofPolygon(polygon: InsertRoofPolygon): Promise<RoofPolygon> { throw new Error("Not implemented"); }
  async updateRoofPolygon(id: string, polygon: Partial<RoofPolygon>): Promise<RoofPolygon | undefined> { return undefined; }
  async deleteRoofPolygon(id: string): Promise<boolean> { return false; }
  async deleteRoofPolygonsBySite(siteId: string): Promise<number> { return 0; }
}

import { DatabaseStorage } from "./dbStorage";

export const storage = new DatabaseStorage();

// Initialize default data
storage.initializeDefaultData().catch(console.error);
