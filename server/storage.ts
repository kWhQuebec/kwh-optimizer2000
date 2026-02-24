import { createLogger } from "./lib/logger";

const log = createLogger("Storage");
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
  ScheduledEmail, InsertScheduledEmail,
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
  SiteMeter, InsertSiteMeter,
  HqFetchJob, InsertHqFetchJob,
  Benchmark, InsertBenchmark,
  PricingComponent, InsertPricingComponent,
  Supplier, InsertSupplier,
  PriceHistory, InsertPriceHistory,
  GoogleSolarCache, InsertGoogleSolarCache,
  SiteContent, InsertSiteContent,
  SystemSettings,
  NewsArticle, InsertNewsArticle,
  ProjectBudget, InsertProjectBudget,
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
  getClientsPaginated(options: { limit?: number; offset?: number; search?: string; includeArchived?: boolean; sortBy?: string }): Promise<{
    clients: (Client & { sites: Site[] })[];
    total: number;
  }>;
  getClient(id: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<Client>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<boolean>;
  getClientCascadeCounts(clientId: string): Promise<{ sites: number; simulations: number; portalUsers: number; portfolios: number; opportunities: number; designAgreements: number; siteVisits: number }>;
  cascadeDeleteClient(clientId: string): Promise<boolean>;

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
  getSiteCascadeCounts(siteId: string): Promise<{ simulations: number; meterFiles: number; designAgreements: number; siteVisits: number }>;
  cascadeDeleteSite(siteId: string): Promise<boolean>;

  // Site Meters (HQ accounts)
  getSiteMeters(siteId: string): Promise<SiteMeter[]>;
  getSiteMeter(id: string): Promise<SiteMeter | undefined>;
  createSiteMeter(data: InsertSiteMeter): Promise<SiteMeter>;
  updateSiteMeter(id: string, data: Partial<SiteMeter>): Promise<SiteMeter | undefined>;
  deleteSiteMeter(id: string): Promise<void>;

  // Meter Files
  getMeterFiles(siteId: string): Promise<MeterFile[]>;
  getMeterFile(id: string): Promise<MeterFile | undefined>;
  createMeterFile(file: InsertMeterFile): Promise<MeterFile>;
  updateMeterFile(id: string, file: Partial<MeterFile>): Promise<MeterFile | undefined>;

  // Meter Readings
  getMeterReadings(meterFileId: string): Promise<MeterReading[]>;
  getMeterReadingsBySite(siteId: string): Promise<MeterReading[]>;
  getMeterReadingsByMeter(meterId: string): Promise<MeterReading[]>;
  createMeterReadings(readings: InsertMeterReading[]): Promise<MeterReading[]>;

  // HQ Fetch Jobs
  getHqFetchJob(id: string): Promise<HqFetchJob | undefined>;
  getHqFetchJobsBySite(siteId: string): Promise<HqFetchJob[]>;
  getActiveHqFetchJob(): Promise<HqFetchJob | undefined>;
  createHqFetchJob(job: InsertHqFetchJob): Promise<HqFetchJob>;
  updateHqFetchJob(id: string, updates: Partial<HqFetchJob>): Promise<HqFetchJob | undefined>;

  // Simulation Runs
  getSimulationRuns(): Promise<(SimulationRun & { site: Site & { client: Client } })[]>;
  getSimulationRun(id: string): Promise<(SimulationRun & { site: Site & { client: Client } }) | undefined>;
  getSimulationRunsBySite(siteId: string): Promise<SimulationRun[]>;
  getSimulationRunsByMeter(meterId: string): Promise<SimulationRun[]>;
  getSimulationRunsByClientId(clientId: string): Promise<(SimulationRun & { site: Site & { client: Client } })[]>;
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

  // Conversion Funnel Metrics for Analytics
  getConversionFunnelMetrics(periodDays?: number): Promise<{
    funnel: Array<{
      stage: string;
      count: number;
      conversionToNext: number;
      avgDaysInStage: number;
    }>;
    winRate: number;
    avgDealCycle: number;
    lostReasons: Record<string, number>;
    totalOpportunities: number;
    periodDays: number;
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
  
  // HQ Bills - get all HQ bills for a client (from leads via opportunities and from sites)
  getHQBillsByClient(clientId: string): Promise<Array<{
    id: string;
    source: 'lead' | 'site';
    sourceId: string;
    sourceName: string;
    hqBillPath: string;
    uploadedAt?: Date | null;
  }>>;

  // Email Logs (for tracking sent emails and follow-ups)
  getEmailLogs(filters?: { siteId?: string; designAgreementId?: string; emailType?: string }): Promise<EmailLog[]>;
  getEmailLog(id: string): Promise<EmailLog | undefined>;
  createEmailLog(log: InsertEmailLog): Promise<EmailLog>;
  updateEmailLog(id: string, log: Partial<EmailLog>): Promise<EmailLog | undefined>;

  // Scheduled Emails (for nurture sequences)
  getPendingScheduledEmails(beforeDate: Date, limit: number): Promise<ScheduledEmail[]>;
  getScheduledEmailsByLead(leadId: string): Promise<ScheduledEmail[]>;
  createScheduledEmail(email: InsertScheduledEmail): Promise<ScheduledEmail>;
  updateScheduledEmail(id: string, email: Partial<ScheduledEmail>): Promise<ScheduledEmail | undefined>;
  cancelScheduledEmails(leadId: string): Promise<void>;

  // System Settings
  getSystemSetting(key: string): Promise<SystemSettings | undefined>;
  upsertSystemSetting(key: string, value: any, updatedBy?: string): Promise<SystemSettings>;

  // Site Content (CMS)
  getSiteContentAll(): Promise<SiteContent[]>;
  getSiteContent(id: string): Promise<SiteContent | undefined>;
  getSiteContentByKey(contentKey: string): Promise<SiteContent | undefined>;
  getSiteContentByCategory(category: string): Promise<SiteContent[]>;
  createSiteContent(content: InsertSiteContent): Promise<SiteContent>;
  updateSiteContent(id: string, content: Partial<SiteContent>): Promise<SiteContent | undefined>;
  deleteSiteContent(id: string): Promise<boolean>;

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

  // Global Search (optimized SQL queries)
  searchClients(query: string, limit?: number): Promise<Array<{ id: string; name: string; mainContactName: string | null; email: string | null }>>;
  searchSites(query: string, limit?: number): Promise<Array<{ id: string; name: string; city: string | null; clientName: string | null }>>;
  searchOpportunities(query: string, limit?: number): Promise<Array<{ id: string; name: string; stage: string; estimatedValue: number | null }>>;

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

  // Benchmarks
  getBenchmarksBySite(siteId: string): Promise<Benchmark[]>;
  getBenchmark(id: string): Promise<Benchmark | undefined>;
  createBenchmark(benchmark: InsertBenchmark): Promise<Benchmark>;
  updateBenchmark(id: string, data: Partial<InsertBenchmark>): Promise<Benchmark | undefined>;
  deleteBenchmark(id: string): Promise<boolean>;

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

  // News Articles
  getNewsArticles(status?: string): Promise<NewsArticle[]>;
  getNewsArticle(id: string): Promise<NewsArticle | undefined>;
  getNewsArticleByUrl(url: string): Promise<NewsArticle | undefined>;
  getNewsArticleBySlug(slug: string): Promise<NewsArticle | undefined>;
  createNewsArticle(article: InsertNewsArticle): Promise<NewsArticle>;
  updateNewsArticle(id: string, updates: Partial<NewsArticle>): Promise<NewsArticle | undefined>;
  deleteNewsArticle(id: string): Promise<boolean>;
  incrementNewsViewCount(id: string): Promise<void>;

  // Project Budgets (Phase 1 — Close the Loop)
  getProjectBudgets(siteId: string): Promise<ProjectBudget[]>;
  createProjectBudget(budget: InsertProjectBudget): Promise<ProjectBudget>;
  updateProjectBudget(id: string, data: Partial<ProjectBudget>): Promise<ProjectBudget | undefined>;
  deleteProjectBudget(id: string): Promise<boolean>;
}


import { DatabaseStorage } from "./dbStorage";

export const storage = new DatabaseStorage();

// Initialize default data
storage.initializeDefaultData().catch((err) => log.error("Failed to initialize default data:", err));
