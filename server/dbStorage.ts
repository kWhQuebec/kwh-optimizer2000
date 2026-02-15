import { db } from "./db";
import { users, componentCatalog, pricingComponents } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { IStorage } from "./storage";
import bcrypt from "bcrypt";

import * as userRepo from "./repositories/userRepo";
import * as leadRepo from "./repositories/leadRepo";
import * as clientRepo from "./repositories/clientRepo";
import * as siteRepo from "./repositories/siteRepo";
import * as simulationRepo from "./repositories/simulationRepo";
import * as designRepo from "./repositories/designRepo";
import * as catalogRepo from "./repositories/catalogRepo";
import * as siteVisitRepo from "./repositories/siteVisitRepo";
import * as portfolioRepo from "./repositories/portfolioRepo";
import * as contentRepo from "./repositories/contentRepo";
import * as marketIntelRepo from "./repositories/marketIntelRepo";
import * as constructionRepo from "./repositories/constructionRepo";
import * as pipelineRepo from "./repositories/pipelineRepo";
import * as supplierRepo from "./repositories/supplierRepo";
import * as cacheRepo from "./repositories/cacheRepo";

export class DatabaseStorage implements IStorage {
  async initializeDefaultData(): Promise<void> {
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
        { category: "MODULE", manufacturer: "Jinko Solar", model: "JKM660N-66QL6-BDV", unitCost: 180, unitSellPrice: 250, active: true },
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

    const existingPricing = await db.select().from(pricingComponents).limit(1);
    if (existingPricing.length === 0) {
      const defaultPricing = [
        { category: "panels", name: "Jinko 660W Bifacial", pricePerUnit: 0.35, unit: "W", source: "Industry benchmark", notes: "High-efficiency N-type TOPCon bifacial modules" },
        { category: "racking", name: "KB AeroGrid 10° (< 1,500 panels)", pricePerUnit: 115.50, unit: "panel", minQuantity: 0, maxQuantity: 1499, source: "KB Racking", notes: "Ballast-mount, 10° tilt landscape" },
        { category: "racking", name: "KB AeroGrid 10° (1,500-3,000 panels)", pricePerUnit: 113.00, unit: "panel", minQuantity: 1500, maxQuantity: 3000, source: "KB Racking", notes: "Ballast-mount, 10° tilt landscape" },
        { category: "racking", name: "KB AeroGrid 10° (3,000-5,000 panels)", pricePerUnit: 111.50, unit: "panel", minQuantity: 3001, maxQuantity: 5000, source: "KB Racking", notes: "Ballast-mount, 10° tilt landscape" },
        { category: "racking", name: "KB AeroGrid 10° (5,000-8,000 panels)", pricePerUnit: 111.00, unit: "panel", minQuantity: 5001, maxQuantity: 8000, source: "KB Racking", notes: "Ballast-mount, 10° tilt landscape" },
        { category: "racking", name: "KB AeroGrid 10° (8,000+ panels)", pricePerUnit: 110.00, unit: "panel", minQuantity: 8001, maxQuantity: 999999, source: "KB Racking", notes: "Ballast-mount, 10° tilt landscape" },
        { category: "inverters", name: "String Inverter (Huawei/SMA)", pricePerUnit: 0.12, unit: "W", source: "Industry benchmark", notes: "Commercial string inverters" },
        { category: "bos_electrical", name: "Electrical BOS (cables, combiner boxes, etc.)", pricePerUnit: 0.15, unit: "W", source: "Industry benchmark", notes: "Cables, combiner boxes, disconnects, grounding" },
        { category: "labor", name: "Installation Labor", pricePerUnit: 0.35, unit: "W", source: "Industry benchmark", notes: "Electrical + mechanical installation" },
        { category: "soft_costs", name: "Engineering & Permitting", pricePerUnit: 5, unit: "percent", source: "Industry benchmark", notes: "PE stamps, permits, inspections" },
        { category: "soft_costs", name: "Project Management", pricePerUnit: 3, unit: "percent", source: "Industry benchmark", notes: "Procurement, scheduling, coordination" },
      ];
      await db.insert(pricingComponents).values(defaultPricing);
    }
  }

  // Users
  getUser = userRepo.getUser;
  getUserByEmail = userRepo.getUserByEmail;
  createUser = userRepo.createUser;
  updateUser = userRepo.updateUser;
  getUsers = userRepo.getUsers;
  getUsersByIds = userRepo.getUsersByIds;
  deleteUser = userRepo.deleteUser;

  // Leads
  getLeads = leadRepo.getLeads;
  getLead = leadRepo.getLead;
  createLead = leadRepo.createLead;
  updateLead = leadRepo.updateLead;

  // Clients
  getClients = clientRepo.getClients;
  getClientsByIds = clientRepo.getClientsByIds;
  getClientsPaginated = clientRepo.getClientsPaginated;
  getClient = clientRepo.getClient;
  createClient = clientRepo.createClient;
  updateClient = clientRepo.updateClient;
  deleteClient = clientRepo.deleteClient;
  getHQBillsByClient = clientRepo.getHQBillsByClient;

  // Sites, Meter Files, Meter Readings, Roof Polygons
  getSites = siteRepo.getSites;
  getSitesByIds = siteRepo.getSitesByIds;
  getSitesMinimal = siteRepo.getSitesMinimal;
  getSitesMinimalByIds = siteRepo.getSitesMinimalByIds;
  getSitesForWorkQueue = siteRepo.getSitesForWorkQueue;
  getSitesListPaginated = siteRepo.getSitesListPaginated;
  getSite = siteRepo.getSite;
  getSitesByClient = siteRepo.getSitesByClient;
  createSite = siteRepo.createSite;
  updateSite = siteRepo.updateSite;
  deleteSite = siteRepo.deleteSite;
  getMeterFiles = siteRepo.getMeterFiles;
  getMeterFile = siteRepo.getMeterFile;
  createMeterFile = siteRepo.createMeterFile;
  updateMeterFile = siteRepo.updateMeterFile;
  getMeterReadings = siteRepo.getMeterReadings;
  getMeterReadingsBySite = siteRepo.getMeterReadingsBySite;
  createMeterReadings = siteRepo.createMeterReadings;
  getRoofPolygons = siteRepo.getRoofPolygons;
  getRoofPolygon = siteRepo.getRoofPolygon;
  createRoofPolygon = siteRepo.createRoofPolygon;
  updateRoofPolygon = siteRepo.updateRoofPolygon;
  deleteRoofPolygon = siteRepo.deleteRoofPolygon;
  deleteRoofPolygonsBySite = siteRepo.deleteRoofPolygonsBySite;

  // Simulation Runs
  getSimulationRuns = simulationRepo.getSimulationRuns;
  getSimulationRun = simulationRepo.getSimulationRun;
  getSimulationRunsBySite = simulationRepo.getSimulationRunsBySite;
  getSimulationRunsByClientId = simulationRepo.getSimulationRunsByClientId;
  getSimulationRunFull = simulationRepo.getSimulationRunFull;
  createSimulationRun = simulationRepo.createSimulationRun;

  // Designs, BOM Items, Design Agreements
  getDesigns = designRepo.getDesigns;
  getDesign = designRepo.getDesign;
  createDesign = designRepo.createDesign;
  updateDesign = designRepo.updateDesign;
  getBomItems = designRepo.getBomItems;
  createBomItems = designRepo.createBomItems;
  getDesignAgreements = designRepo.getDesignAgreements;
  getDesignAgreement = designRepo.getDesignAgreement;
  getDesignAgreementBySite = designRepo.getDesignAgreementBySite;
  createDesignAgreement = designRepo.createDesignAgreement;
  updateDesignAgreement = designRepo.updateDesignAgreement;
  deleteDesignAgreement = designRepo.deleteDesignAgreement;

  // Component Catalog, Pricing Components
  getCatalog = catalogRepo.getCatalog;
  getCatalogItem = catalogRepo.getCatalogItem;
  getCatalogByCategory = catalogRepo.getCatalogByCategory;
  getCatalogItemByManufacturerModel = catalogRepo.getCatalogItemByManufacturerModel;
  createCatalogItem = catalogRepo.createCatalogItem;
  updateCatalogItem = catalogRepo.updateCatalogItem;
  deleteCatalogItem = catalogRepo.deleteCatalogItem;
  getPricingComponents = catalogRepo.getPricingComponents;
  getPricingComponent = catalogRepo.getPricingComponent;
  getPricingComponentsByCategory = catalogRepo.getPricingComponentsByCategory;
  getActivePricingComponents = catalogRepo.getActivePricingComponents;
  createPricingComponent = catalogRepo.createPricingComponent;
  updatePricingComponent = catalogRepo.updatePricingComponent;
  deletePricingComponent = catalogRepo.deletePricingComponent;

  // Site Visits, Site Visit Photos
  getSiteVisits = siteVisitRepo.getSiteVisits;
  getSiteVisit = siteVisitRepo.getSiteVisit;
  getSiteVisitsBySite = siteVisitRepo.getSiteVisitsBySite;
  createSiteVisit = siteVisitRepo.createSiteVisit;
  updateSiteVisit = siteVisitRepo.updateSiteVisit;
  deleteSiteVisit = siteVisitRepo.deleteSiteVisit;
  getSiteVisitPhotos = siteVisitRepo.getSiteVisitPhotos;
  getSiteVisitPhotosByVisit = siteVisitRepo.getSiteVisitPhotosByVisit;
  createSiteVisitPhoto = siteVisitRepo.createSiteVisitPhoto;
  deleteSiteVisitPhoto = siteVisitRepo.deleteSiteVisitPhoto;

  // Portfolios, Portfolio Sites
  getPortfolios = portfolioRepo.getPortfolios;
  getPortfolio = portfolioRepo.getPortfolio;
  getPortfoliosByClient = portfolioRepo.getPortfoliosByClient;
  createPortfolio = portfolioRepo.createPortfolio;
  updatePortfolio = portfolioRepo.updatePortfolio;
  deletePortfolio = portfolioRepo.deletePortfolio;
  getPortfolioSites = portfolioRepo.getPortfolioSites;
  isSiteInAnyPortfolio = portfolioRepo.isSiteInAnyPortfolio;
  addSiteToPortfolio = portfolioRepo.addSiteToPortfolio;
  removeSiteFromPortfolio = portfolioRepo.removeSiteFromPortfolio;
  updatePortfolioSite = portfolioRepo.updatePortfolioSite;

  // Blog Articles, Procuration Signatures, Email Logs
  getBlogArticles = contentRepo.getBlogArticles;
  getBlogArticle = contentRepo.getBlogArticle;
  getBlogArticleBySlug = contentRepo.getBlogArticleBySlug;
  createBlogArticle = contentRepo.createBlogArticle;
  updateBlogArticle = contentRepo.updateBlogArticle;
  deleteBlogArticle = contentRepo.deleteBlogArticle;
  incrementArticleViews = contentRepo.incrementArticleViews;
  getProcurationSignatures = contentRepo.getProcurationSignatures;
  getProcurationSignature = contentRepo.getProcurationSignature;
  getProcurationSignatureByLead = contentRepo.getProcurationSignatureByLead;
  getProcurationSignaturesByClient = contentRepo.getProcurationSignaturesByClient;
  createProcurationSignature = contentRepo.createProcurationSignature;
  updateProcurationSignature = contentRepo.updateProcurationSignature;
  getEmailLogs = contentRepo.getEmailLogs;
  getEmailLog = contentRepo.getEmailLog;
  createEmailLog = contentRepo.createEmailLog;
  updateEmailLog = contentRepo.updateEmailLog;

  // Scheduled Emails
  getPendingScheduledEmails = contentRepo.getPendingScheduledEmails;
  getScheduledEmailsByLead = contentRepo.getScheduledEmailsByLead;
  createScheduledEmail = contentRepo.createScheduledEmail;
  updateScheduledEmail = contentRepo.updateScheduledEmail;
  cancelScheduledEmails = contentRepo.cancelScheduledEmails;

  // System Settings
  getSystemSetting = contentRepo.getSystemSetting;
  upsertSystemSetting = contentRepo.upsertSystemSetting;

  // Site Content (CMS)
  getSiteContentAll = contentRepo.getSiteContentAll;
  getSiteContent = contentRepo.getSiteContent;
  getSiteContentByKey = contentRepo.getSiteContentByKey;
  getSiteContentByCategory = contentRepo.getSiteContentByCategory;
  createSiteContent = contentRepo.createSiteContent;
  updateSiteContent = contentRepo.updateSiteContent;
  deleteSiteContent = contentRepo.deleteSiteContent;

  // Market Intelligence
  getCompetitors = marketIntelRepo.getCompetitors;
  getCompetitor = marketIntelRepo.getCompetitor;
  createCompetitor = marketIntelRepo.createCompetitor;
  updateCompetitor = marketIntelRepo.updateCompetitor;
  deleteCompetitor = marketIntelRepo.deleteCompetitor;
  getBattleCards = marketIntelRepo.getBattleCards;
  getBattleCard = marketIntelRepo.getBattleCard;
  createBattleCard = marketIntelRepo.createBattleCard;
  updateBattleCard = marketIntelRepo.updateBattleCard;
  deleteBattleCard = marketIntelRepo.deleteBattleCard;
  getMarketNotes = marketIntelRepo.getMarketNotes;
  getMarketNote = marketIntelRepo.getMarketNote;
  createMarketNote = marketIntelRepo.createMarketNote;
  updateMarketNote = marketIntelRepo.updateMarketNote;
  deleteMarketNote = marketIntelRepo.deleteMarketNote;
  getMarketDocuments = marketIntelRepo.getMarketDocuments;
  getMarketDocument = marketIntelRepo.getMarketDocument;
  createMarketDocument = marketIntelRepo.createMarketDocument;
  updateMarketDocument = marketIntelRepo.updateMarketDocument;
  deleteMarketDocument = marketIntelRepo.deleteMarketDocument;
  getCompetitorProposalAnalyses = marketIntelRepo.getCompetitorProposalAnalyses;
  getCompetitorProposalAnalysis = marketIntelRepo.getCompetitorProposalAnalysis_;
  createCompetitorProposalAnalysis = marketIntelRepo.createCompetitorProposalAnalysis_;
  updateCompetitorProposalAnalysis = marketIntelRepo.updateCompetitorProposalAnalysis_;
  deleteCompetitorProposalAnalysis = marketIntelRepo.deleteCompetitorProposalAnalysis_;

  // Construction Agreements, Milestones, Projects, Tasks, O&M
  getConstructionAgreements = constructionRepo.getConstructionAgreements;
  getConstructionAgreement = constructionRepo.getConstructionAgreement;
  getConstructionAgreementsBySiteId = constructionRepo.getConstructionAgreementsBySiteId;
  createConstructionAgreement = constructionRepo.createConstructionAgreement;
  updateConstructionAgreement = constructionRepo.updateConstructionAgreement;
  deleteConstructionAgreement = constructionRepo.deleteConstructionAgreement;
  getConstructionMilestones = constructionRepo.getConstructionMilestones;
  getConstructionMilestone = constructionRepo.getConstructionMilestone;
  getConstructionMilestonesByAgreementId = constructionRepo.getConstructionMilestonesByAgreementId;
  createConstructionMilestone = constructionRepo.createConstructionMilestone;
  updateConstructionMilestone = constructionRepo.updateConstructionMilestone;
  deleteConstructionMilestone = constructionRepo.deleteConstructionMilestone;
  getConstructionProjects = constructionRepo.getConstructionProjects;
  getConstructionProject = constructionRepo.getConstructionProject;
  getConstructionProjectsBySiteId = constructionRepo.getConstructionProjectsBySiteId;
  createConstructionProject = constructionRepo.createConstructionProject;
  updateConstructionProject = constructionRepo.updateConstructionProject;
  deleteConstructionProject = constructionRepo.deleteConstructionProject;
  getConstructionTasks = constructionRepo.getConstructionTasks;
  getConstructionTask = constructionRepo.getConstructionTask;
  getConstructionTasksByProjectId = constructionRepo.getConstructionTasksByProjectId;
  createConstructionTask = constructionRepo.createConstructionTask;
  updateConstructionTask = constructionRepo.updateConstructionTask;
  deleteConstructionTask = constructionRepo.deleteConstructionTask;
  getOmContracts = constructionRepo.getOmContracts;
  getOmContract = constructionRepo.getOmContract;
  getOmContractsByClientId = constructionRepo.getOmContractsByClientId;
  getOmContractsBySiteId = constructionRepo.getOmContractsBySiteId;
  createOmContract = constructionRepo.createOmContract;
  updateOmContract = constructionRepo.updateOmContract;
  deleteOmContract = constructionRepo.deleteOmContract;
  getOmVisits = constructionRepo.getOmVisits;
  getOmVisit = constructionRepo.getOmVisit;
  getOmVisitsByContractId = constructionRepo.getOmVisitsByContractId;
  createOmVisit = constructionRepo.createOmVisit;
  updateOmVisit = constructionRepo.updateOmVisit;
  deleteOmVisit = constructionRepo.deleteOmVisit;
  getOmPerformanceSnapshots = constructionRepo.getOmPerformanceSnapshots;
  getOmPerformanceSnapshot = constructionRepo.getOmPerformanceSnapshot;
  getOmPerformanceSnapshotsByContractId = constructionRepo.getOmPerformanceSnapshotsByContractId;
  createOmPerformanceSnapshot = constructionRepo.createOmPerformanceSnapshot;
  updateOmPerformanceSnapshot = constructionRepo.updateOmPerformanceSnapshot;
  deleteOmPerformanceSnapshot = constructionRepo.deleteOmPerformanceSnapshot;

  // Pipeline: Opportunities, Activities, Search, Dashboard, Partnerships
  getOpportunities = pipelineRepo.getOpportunities;
  getOpportunity = pipelineRepo.getOpportunity;
  getOpportunitiesByStage = pipelineRepo.getOpportunitiesByStage;
  getOpportunitiesByLeadId = pipelineRepo.getOpportunitiesByLeadId;
  getOpportunitiesByClientId = pipelineRepo.getOpportunitiesByClientId;
  getOpportunitiesBySiteId = pipelineRepo.getOpportunitiesBySiteId;
  getOpportunitiesByOwnerId = pipelineRepo.getOpportunitiesByOwnerId;
  createOpportunity = pipelineRepo.createOpportunity;
  updateOpportunity = pipelineRepo.updateOpportunity;
  deleteOpportunity = pipelineRepo.deleteOpportunity;
  updateOpportunityStage = pipelineRepo.updateOpportunityStage;
  searchClients = pipelineRepo.searchClients;
  searchSites = pipelineRepo.searchSites;
  searchOpportunities = pipelineRepo.searchOpportunities;
  getDashboardStats = pipelineRepo.getDashboardStats;
  getPipelineStats = pipelineRepo.getPipelineStats;
  getConversionFunnelMetrics = pipelineRepo.getConversionFunnelMetrics;
  getActivities = pipelineRepo.getActivities;
  getActivity = pipelineRepo.getActivity;
  getActivitiesByLeadId = pipelineRepo.getActivitiesByLeadId;
  getActivitiesByClientId = pipelineRepo.getActivitiesByClientId;
  getActivitiesBySiteId = pipelineRepo.getActivitiesBySiteId;
  getActivitiesByOpportunityId = pipelineRepo.getActivitiesByOpportunityId;
  createActivity = pipelineRepo.createActivity;
  updateActivity = pipelineRepo.updateActivity;
  deleteActivity = pipelineRepo.deleteActivity;
  getPartnerships = pipelineRepo.getPartnerships;
  getPartnership = pipelineRepo.getPartnership;
  createPartnership = pipelineRepo.createPartnership;
  updatePartnership = pipelineRepo.updatePartnership;
  deletePartnership = pipelineRepo.deletePartnership;

  // Suppliers, Price History
  getSuppliers = supplierRepo.getSuppliers;
  getSupplier = supplierRepo.getSupplier;
  createSupplier = supplierRepo.createSupplier;
  updateSupplier = supplierRepo.updateSupplier;
  deleteSupplier = supplierRepo.deleteSupplier;
  getSuppliersByCategory = supplierRepo.getSuppliersByCategory;
  getPriceHistory = supplierRepo.getPriceHistory;
  getPriceHistoryById = supplierRepo.getPriceHistoryById;
  getPriceHistoryBySupplier = supplierRepo.getPriceHistoryBySupplier;
  getPriceHistoryByCategory = supplierRepo.getPriceHistoryByCategory;
  getPriceHistoryByItem = supplierRepo.getPriceHistoryByItem;
  createPriceHistory = supplierRepo.createPriceHistory;
  deletePriceHistory = supplierRepo.deletePriceHistory;

  // Google Solar Cache
  getGoogleSolarCacheByLocation = cacheRepo.getGoogleSolarCacheByLocation;
  setGoogleSolarCache = cacheRepo.setGoogleSolarCache;
  incrementCacheHitCount = cacheRepo.incrementCacheHitCount;
  cleanupExpiredCache = cacheRepo.cleanupExpiredCache;
}
