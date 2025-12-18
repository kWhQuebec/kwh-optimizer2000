import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("admin"), // "admin" | "analyst" | "client"
  clientId: varchar("client_id"), // Links client users to their company (null for admin/analyst)
  name: text("name"), // Display name for the user
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  streetAddress: text("street_address"),
  city: text("city"),
  province: text("province").default("Québec"),
  postalCode: text("postal_code"),
  estimatedMonthlyBill: real("estimated_monthly_bill"),
  buildingType: text("building_type"),
  notes: text("notes"),
  source: text("source").default("web_form"),
  status: text("status").default("submitted"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  roofAreaSqM: real("roof_area_sq_m"),
  roofPotentialKw: real("roof_potential_kw"),
  estimateError: text("estimate_error"),
  estimateCompletedAt: timestamp("estimate_completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  mainContactName: text("main_contact_name"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  province: text("province"),
  postalCode: text("postal_code"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const sites = pgTable("sites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  name: text("name").notNull(),
  address: text("address"),
  city: text("city"),
  province: text("province"),
  postalCode: text("postal_code"),
  notes: text("notes"),
  roofAreaSqM: real("roof_area_sqm"),
  
  // Geolocation for Google Solar API
  latitude: real("latitude"),
  longitude: real("longitude"),
  
  // Auto-estimated roof data from Google Solar API
  roofAreaAutoSqM: real("roof_area_auto_sqm"),
  roofAreaAutoSource: text("roof_area_auto_source"), // "google_solar" or null
  roofAreaAutoTimestamp: timestamp("roof_area_auto_timestamp"),
  roofAreaAutoDetails: jsonb("roof_area_auto_details"), // Full Solar API response for reference
  roofEstimateStatus: text("roof_estimate_status").default("none"), // "none" | "pending" | "success" | "failed" | "skipped"
  roofEstimateError: text("roof_estimate_error"), // Error message if failed
  roofEstimatePendingAt: timestamp("roof_estimate_pending_at"), // When pending status started (for stale detection)
  
  // Roof color detection for bifacial PV analysis
  roofColorType: text("roof_color_type"), // "white_membrane" | "light" | "dark" | "gravel" | "unknown"
  roofColorConfidence: real("roof_color_confidence"), // 0-1 confidence score
  roofColorDetectedAt: timestamp("roof_color_detected_at"),
  bifacialAnalysisPrompted: boolean("bifacial_analysis_prompted").default(false), // Whether user has been prompted
  bifacialAnalysisAccepted: boolean("bifacial_analysis_accepted"), // Whether user accepted bifacial analysis
  
  analysisAssumptions: jsonb("analysis_assumptions"),
  analysisAvailable: boolean("analysis_available").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const meterFiles = pgTable("meter_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  siteId: varchar("site_id").notNull().references(() => sites.id),
  fileName: text("file_name").notNull(),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  granularity: text("granularity").notNull(), // "HOUR" or "FIFTEEN_MIN"
  originalStoragePath: text("original_storage_path"),
  status: text("status").notNull().default("UPLOADED"), // "UPLOADED" | "PARSED" | "FAILED"
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const meterReadings = pgTable("meter_readings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  meterFileId: varchar("meter_file_id").notNull().references(() => meterFiles.id),
  timestamp: timestamp("timestamp").notNull(),
  granularity: text("granularity").notNull(),
  kWh: real("kwh"),
  kW: real("kw"),
});

export const simulationRuns = pgTable("simulation_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  siteId: varchar("site_id").notNull().references(() => sites.id),
  label: text("label"),
  type: text("type").notNull(), // "BASELINE" or "SCENARIO"
  
  // System sizing
  pvSizeKW: real("pv_size_kw"),
  battEnergyKWh: real("batt_energy_kwh"),
  battPowerKW: real("batt_power_kw"),
  demandShavingSetpointKW: real("demand_shaving_setpoint_kw"),
  
  // Consumption metrics
  annualConsumptionKWh: real("annual_consumption_kwh"),
  peakDemandKW: real("peak_demand_kw"),
  annualEnergySavingsKWh: real("annual_energy_savings_kwh"),
  annualDemandReductionKW: real("annual_demand_reduction_kw"),
  selfConsumptionKWh: real("self_consumption_kwh"),
  selfSufficiencyPercent: real("self_sufficiency_percent"),
  
  // Production and surplus (HQ Net Metering - Dec 2024)
  totalProductionKWh: real("total_production_kwh"),        // Total annual solar production
  totalExportedKWh: real("total_exported_kwh"),            // Surplus exported to grid
  annualSurplusRevenue: real("annual_surplus_revenue"),    // Revenue from surplus (starts year 3)
  
  // Cost metrics
  annualCostBefore: real("annual_cost_before"),
  annualCostAfter: real("annual_cost_after"),
  annualSavings: real("annual_savings"),
  savingsYear1: real("savings_year_1"),
  
  // CAPEX breakdown
  capexGross: real("capex_gross"),
  capexPV: real("capex_pv"),
  capexBattery: real("capex_battery"),
  
  // Incentives
  incentivesHQ: real("incentives_hq"),
  incentivesHQSolar: real("incentives_hq_solar"),
  incentivesHQBattery: real("incentives_hq_battery"),
  incentivesFederal: real("incentives_federal"),
  taxShield: real("tax_shield"),
  totalIncentives: real("total_incentives"),
  capexNet: real("capex_net"),
  
  // Financial metrics
  npv25: real("npv_25"),
  npv10: real("npv_10"),
  npv20: real("npv_20"),
  irr25: real("irr_25"),
  irr10: real("irr_10"),
  irr20: real("irr_20"),
  simplePaybackYears: real("simple_payback_years"),
  lcoe: real("lcoe"),
  
  // Environmental
  co2AvoidedTonnesPerYear: real("co2_avoided_tonnes_per_year"),
  
  // Input assumptions (stored as JSON)
  assumptions: jsonb("assumptions"),
  
  // Detailed outputs (stored as JSON)
  cashflows: jsonb("cashflows"),
  breakdown: jsonb("breakdown"),
  hourlyProfile: jsonb("hourly_profile"),
  peakWeekData: jsonb("peak_week_data"),
  sensitivity: jsonb("sensitivity"),
  
  // Data quality indicators
  interpolatedMonths: jsonb("interpolated_months"), // Months that were estimated from neighbors
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const designs = pgTable("designs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  simulationRunId: varchar("simulation_run_id").notNull().references(() => simulationRuns.id),
  designName: text("design_name").notNull(),
  pvSizeKW: real("pv_size_kw"),
  moduleModel: text("module_model"),
  moduleWattage: integer("module_wattage"),
  modulesCount: integer("modules_count"),
  inverterModel: text("inverter_model"),
  invertersCount: integer("inverters_count"),
  batteryModel: text("battery_model"),
  batteryEnergyKWh: real("battery_energy_kwh"),
  batteryUnits: integer("battery_units"),
  rackingSystem: text("racking_system"),
  notes: text("notes"),
  totalCapex: real("total_capex"),
  totalCapexPV: real("total_capex_pv"),
  totalCapexBattery: real("total_capex_battery"),
  totalCapexBOS: real("total_capex_bos"),
  marginPercent: real("margin_percent"),
  totalSellPrice: real("total_sell_price"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bomItems = pgTable("bom_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  designId: varchar("design_id").notNull().references(() => designs.id),
  category: text("category").notNull(), // "MODULE", "INVERTER", "BATTERY", "RACKING", "CABLE", "BOS"
  description: text("description").notNull(),
  quantity: real("quantity").notNull(),
  unit: text("unit").notNull(),
  unitCost: real("unit_cost"),
  unitSellPrice: real("unit_sell_price"),
  lineTotalCost: real("line_total_cost"),
  lineTotalSell: real("line_total_sell"),
});

export const componentCatalog = pgTable("component_catalog", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: text("category").notNull(),
  manufacturer: text("manufacturer").notNull(),
  model: text("model").notNull(),
  specJson: jsonb("spec_json"),
  unitCost: real("unit_cost"),
  unitSellPrice: real("unit_sell_price"),
  active: boolean("active").default(true),
});

// Site Visit (Visite Technique) - Based on Rematek form template
export const siteVisits = pgTable("site_visits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  siteId: varchar("site_id").notNull().references(() => sites.id),
  
  // Visit metadata
  visitDate: timestamp("visit_date"),
  visitedBy: text("visited_by"), // Name of technician/engineer
  status: text("status").notNull().default("scheduled"), // "scheduled" | "in_progress" | "completed" | "cancelled"
  
  // Client Info Section
  gpsLatitude: real("gps_latitude"),
  gpsLongitude: real("gps_longitude"),
  siteContactName: text("site_contact_name"),
  siteContactPhone: text("site_contact_phone"),
  siteContactEmail: text("site_contact_email"),
  meterNumbers: text("meter_numbers"), // Can be multiple, comma-separated
  
  // Roof Section
  roofType: text("roof_type"), // "flat" | "inclined" | "other"
  roofTypeOther: text("roof_type_other"), // If "other"
  buildingHeight: real("building_height"), // meters
  parapetHeight: real("parapet_height"), // meters
  roofSlope: real("roof_slope"), // degrees or %
  roofMaterial: text("roof_material"), // "concrete" | "steel_deck" | "wood" | "other"
  roofMaterialOther: text("roof_material_other"),
  roofAge: integer("roof_age"), // years
  anchoringPossible: boolean("anchoring_possible"), // Can we anchor or ballast?
  anchoringNotes: text("anchoring_notes"),
  lightningRodPresent: boolean("lightning_rod_present"),
  pvReservedAreas: text("pv_reserved_areas"), // Areas designated for PV
  
  // Accessibility Section
  roofAccessible: boolean("roof_accessible"),
  accessMethod: text("access_method"), // "ladder" | "trapdoor" | "stairs" | "other"
  accessNotes: text("access_notes"),
  
  // Obstacles/Shading Section
  hasObstacles: boolean("has_obstacles"),
  hvacUnits: jsonb("hvac_units"), // Array of {height, width, length}
  treesPresent: boolean("trees_present"),
  treeNotes: text("tree_notes"),
  otherObstacles: text("other_obstacles"),
  adjacentRoofsSameLevel: boolean("adjacent_roofs_same_level"),
  
  // Technical Room for Inverters/Batteries
  technicalRoomCovered: boolean("technical_room_covered"),
  technicalRoomSpace: text("technical_room_space"), // Description of available space
  technicalRoomDistance: real("technical_room_distance"), // Distance from PV in meters
  
  // Grid Injection Point
  injectionPointPosition: text("injection_point_position"),
  mainPanelPower: text("main_panel_power"), // Power rating
  mainPanelVoltage: text("main_panel_voltage"), // Voltage
  hqMeterNumber: text("hq_meter_number"),
  
  // SLD (Single Line Diagram) Status
  sldMainAvailable: boolean("sld_main_available"),
  sldMainNeedsUpdate: boolean("sld_main_needs_update"),
  sldSecondaryAvailable: boolean("sld_secondary_available"),
  sldSecondaryNeedsUpdate: boolean("sld_secondary_needs_update"),
  
  // Meters Section
  numberOfMeters: integer("number_of_meters"),
  
  // Roof Surface Area
  roofSurfaceAreaSqM: real("roof_surface_area_sqm"), // Measured roof surface in m²
  
  // Main Electrical Equipment Info
  mainPanelManufacturer: text("main_panel_manufacturer"),
  mainPanelModel: text("main_panel_model"),
  mainBreakerManufacturer: text("main_breaker_manufacturer"),
  mainBreakerModel: text("main_breaker_model"),
  circuitBreakerManufacturer: text("circuit_breaker_manufacturer"),
  circuitBreakerModel: text("circuit_breaker_model"),
  disconnectSwitchManufacturer: text("disconnect_switch_manufacturer"),
  disconnectSwitchModel: text("disconnect_switch_model"),
  
  // Secondary Electrical Equipment
  secondaryPanelManufacturer: text("secondary_panel_manufacturer"),
  secondaryPanelModel: text("secondary_panel_model"),
  secondaryBreakerManufacturer: text("secondary_breaker_manufacturer"),
  secondaryBreakerModel: text("secondary_breaker_model"),
  secondaryDisconnectManufacturer: text("secondary_disconnect_manufacturer"),
  secondaryDisconnectModel: text("secondary_disconnect_model"),
  secondaryEquipmentNotes: text("secondary_equipment_notes"),
  
  // Photos and Documents (JSON array of file paths/URLs)
  roofPhotos: jsonb("roof_photos"),
  equipmentPhotos: jsonb("equipment_photos"),
  roofSketch: text("roof_sketch"), // Path to sketch image/document
  photosTaken: boolean("photos_taken"), // Confirmation that photos were taken
  documentsCollected: jsonb("documents_collected"), // { electricalDrawings: boolean, meterDetails: boolean, other: string }
  
  // Inspector Signature/Confirmation
  inspectorSignature: text("inspector_signature"), // Base64 signature or text confirmation
  
  // General notes
  notes: text("notes"),
  
  // Cost calculation (based on Rematek quote)
  estimatedCost: jsonb("estimated_cost"), // Breakdown of costs
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Portfolios - Group multiple sites into a project for consolidated analysis
export const portfolios = pgTable("portfolios", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("draft"), // "draft" | "active" | "quoted" | "accepted" | "completed"
  
  // Volume pricing for multi-building projects (Rematek pricing)
  numBuildings: integer("num_buildings").default(0),
  estimatedTravelDays: integer("estimated_travel_days").default(0),
  
  // Cost breakdown (calculated from number of sites)
  quotedCosts: jsonb("quoted_costs"), // { travel, visit, evaluation, diagrams, sldSupplement, subtotal, taxes, total }
  totalCad: real("total_cad"),
  
  // Volume discount tiers
  volumeDiscountPercent: real("volume_discount_percent").default(0), // Applied discount based on # buildings
  
  // Summary KPIs (aggregated from all sites)
  totalPvSizeKW: real("total_pv_size_kw"),
  totalBatteryKWh: real("total_battery_kwh"),
  totalCapexNet: real("total_capex_net"),
  totalNpv25: real("total_npv_25"),
  weightedIrr25: real("weighted_irr_25"),
  totalAnnualSavings: real("total_annual_savings"),
  totalCo2Avoided: real("total_co2_avoided"),
  
  // Tracking
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Portfolio Sites - Junction table linking sites to portfolios
export const portfolioSites = pgTable("portfolio_sites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portfolioId: varchar("portfolio_id").notNull().references(() => portfolios.id, { onDelete: "cascade" }),
  siteId: varchar("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  
  // Site-specific notes within the portfolio context
  notes: text("notes"),
  
  // Order for display purposes
  displayOrder: integer("display_order").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Blog Articles - SEO content marketing
export const blogArticles = pgTable("blog_articles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  
  // Bilingual content
  titleFr: text("title_fr").notNull(),
  titleEn: text("title_en").notNull(),
  excerptFr: text("excerpt_fr"),
  excerptEn: text("excerpt_en"),
  contentFr: text("content_fr").notNull(),
  contentEn: text("content_en").notNull(),
  
  // SEO
  metaDescriptionFr: text("meta_description_fr"),
  metaDescriptionEn: text("meta_description_en"),
  keywords: text("keywords").array(),
  
  // Media
  featuredImage: text("featured_image"),
  
  // Categorization
  category: text("category"), // "guide" | "news" | "case-study" | "program"
  
  // Publishing
  status: text("status").notNull().default("draft"), // "draft" | "published" | "archived"
  publishedAt: timestamp("published_at"),
  
  // Author
  authorName: text("author_name"),
  
  // Analytics
  viewCount: integer("view_count").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Procuration Signatures - HQ Authorization
export const procurationSignatures = pgTable("procuration_signatures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").references(() => leads.id), // Link to lead if from detailed analysis form
  
  // Signer info
  signerName: text("signer_name").notNull(),
  signerEmail: text("signer_email").notNull(),
  companyName: text("company_name"),
  hqAccountNumber: text("hq_account_number"),
  
  // Status tracking
  status: text("status").notNull().default("draft"), // "draft" | "sent" | "signed" | "failed"
  
  // Timestamps
  sentAt: timestamp("sent_at"),
  viewedAt: timestamp("viewed_at"),
  signedAt: timestamp("signed_at"),
  
  // Signed document
  signedDocumentUrl: text("signed_document_url"), // URL to download signed PDF
  
  // Language
  language: text("language").default("fr"), // "fr" | "en"
  
  // Metadata
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Design Agreements - Étape 3 paid commitment
export const designAgreements = pgTable("design_agreements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  siteId: varchar("site_id").notNull().references(() => sites.id),
  siteVisitId: varchar("site_visit_id").references(() => siteVisits.id), // Link to visit for cost source
  
  // Public access token for client signing page
  publicToken: varchar("public_token").default(sql`gen_random_uuid()`),
  
  // Status tracking
  status: text("status").notNull().default("draft"), // "draft" | "sent" | "accepted" | "declined" | "expired"
  
  // Quoted costs (snapshot at time of quote)
  quotedCosts: jsonb("quoted_costs"), // { siteVisit: {...}, additionalFees: [], subtotal, taxes, total }
  totalCad: real("total_cad"),
  currency: text("currency").default("CAD"),
  
  // Payment terms
  paymentTerms: text("payment_terms"), // "50% deposit, 50% on delivery" etc.
  validUntil: timestamp("valid_until"), // Quote expiration date
  
  // Tracking
  quotedBy: varchar("quoted_by").references(() => users.id),
  quotedAt: timestamp("quoted_at"),
  sentAt: timestamp("sent_at"),
  acceptedAt: timestamp("accepted_at"),
  declinedAt: timestamp("declined_at"),
  declineReason: text("decline_reason"),
  
  // Client signature/acceptance
  acceptedByName: text("accepted_by_name"),
  acceptedByEmail: text("accepted_by_email"),
  signatureData: text("signature_data"), // Base64 signature if captured
  
  // Stripe payment tracking
  stripeSessionId: text("stripe_session_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  depositAmount: real("deposit_amount"), // Amount paid as deposit
  depositPaidAt: timestamp("deposit_paid_at"),
  
  // Notes
  internalNotes: text("internal_notes"),
  clientNotes: text("client_notes"), // Visible to client
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Market Intelligence Module - Competitive analysis and sales positioning
export const competitors = pgTable("competitors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull().default("installer"), // "installer" | "epc" | "ppa_provider" | "utility"
  website: text("website"),
  headquartersCity: text("headquarters_city"),
  province: text("province"),
  
  // Business model
  businessModel: text("business_model"), // "ppa" | "lease" | "cash_sales" | "epc" | "mixed"
  targetMarket: text("target_market"), // "residential" | "commercial" | "industrial" | "all"
  
  // Pricing intelligence (if known)
  ppaYear1Rate: real("ppa_year1_rate"), // As % of HQ rate
  ppaYear2Rate: real("ppa_year2_rate"), // As % of HQ rate for years 2+
  ppaTerm: integer("ppa_term"), // Years
  cashPricePerWatt: real("cash_price_per_watt"), // $/W installed
  
  // Strengths and weaknesses
  strengths: text("strengths").array(),
  weaknesses: text("weaknesses").array(),
  
  // Legal/regulatory notes
  legalNotes: text("legal_notes"), // e.g., "Operates in regulatory gray area"
  
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Battle cards - sales arguments against specific competitors
export const battleCards = pgTable("battle_cards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  competitorId: varchar("competitor_id").notNull().references(() => competitors.id),
  
  // Sales positioning
  objectionScenario: text("objection_scenario").notNull(), // e.g., "Client says TRC offers $0 upfront"
  responseStrategy: text("response_strategy").notNull(), // Our sales response
  keyDifferentiators: text("key_differentiators").array(),
  financialComparison: text("financial_comparison"), // e.g., "Our model saves $50k over 25 years"
  
  // Language support
  language: text("language").notNull().default("fr"), // "fr" | "en"
  
  priority: integer("priority").default(1), // 1 = highest priority
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Market intelligence notes - regulations, market trends, legal updates
export const marketNotes = pgTable("market_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: text("category").notNull(), // "regulation" | "incentive" | "legal" | "market_trend" | "competitor_news"
  title: text("title").notNull(),
  content: text("content").notNull(),
  
  // Jurisdiction
  jurisdiction: text("jurisdiction").default("QC"), // "QC" | "CA" | "Federal"
  
  // Source and date
  sourceUrl: text("source_url"),
  sourceDate: timestamp("source_date"),
  
  // Importance and status
  importance: text("importance").default("medium"), // "low" | "medium" | "high" | "critical"
  status: text("status").default("active"), // "active" | "pending" | "expired" | "archived"
  expiresAt: timestamp("expires_at"), // For time-sensitive regulations
  
  // Tags for search
  tags: text("tags").array(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Market intelligence document repository - centralized document storage
export const marketDocuments = pgTable("market_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Document info
  title: text("title").notNull(),
  description: text("description"),
  
  // File details
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileType: text("file_type"), // "pdf" | "doc" | "xlsx" | "png" | "jpg" | etc.
  fileSize: integer("file_size"), // bytes
  
  // Entity categorization
  entityType: text("entity_type").notNull(), // "competitor" | "supplier" | "partner" | "hydro_quebec" | "government" | "internal"
  entityId: varchar("entity_id"), // Optional link to competitor ID or other entity
  entityName: text("entity_name"), // Fallback name when not linked to existing entity
  
  // Document categorization
  documentType: text("document_type").notNull(), // "proposal" | "technical_spec" | "analysis" | "contract" | "regulation" | "marketing" | "other"
  
  // Tags for search
  tags: text("tags").array(),
  
  // Metadata
  uploadedByUserId: varchar("uploaded_by_user_id").references(() => users.id),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Construction Agreements - Final contracts for installation
export const constructionAgreements = pgTable("construction_agreements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  siteId: varchar("site_id").notNull().references(() => sites.id),
  designId: varchar("design_id").references(() => designs.id), // Link to selected design
  designAgreementId: varchar("design_agreement_id").references(() => designAgreements.id),
  
  // Public access token for client signing page
  publicToken: varchar("public_token").default(sql`gen_random_uuid()`),
  
  // Contract details
  contractNumber: text("contract_number"), // Auto-generated contract number
  status: text("status").notNull().default("draft"), // "draft" | "sent" | "accepted" | "in_progress" | "completed" | "cancelled"
  
  // System specs (snapshot at contract time)
  pvSizeKW: real("pv_size_kw"),
  batteryEnergyKWh: real("battery_energy_kwh"),
  
  // Pricing
  totalContractValue: real("total_contract_value"),
  currency: text("currency").default("CAD"),
  
  // Payment schedule
  paymentSchedule: jsonb("payment_schedule"), // Array of { milestone, percent, amount, dueDate, paidAt }
  depositPercent: real("deposit_percent").default(30), // Default 30% deposit
  depositAmount: real("deposit_amount"),
  depositPaidAt: timestamp("deposit_paid_at"),
  
  // Timeline
  estimatedStartDate: timestamp("estimated_start_date"),
  estimatedCompletionDate: timestamp("estimated_completion_date"),
  actualStartDate: timestamp("actual_start_date"),
  actualCompletionDate: timestamp("actual_completion_date"),
  
  // Terms and conditions
  termsVersion: text("terms_version").default("v1.0"),
  warrantyYears: integer("warranty_years").default(10),
  
  // Client acceptance
  acceptedByName: text("accepted_by_name"),
  acceptedByEmail: text("accepted_by_email"),
  acceptedByTitle: text("accepted_by_title"),
  signatureData: text("signature_data"), // Base64 signature
  acceptedAt: timestamp("accepted_at"),
  
  // Stripe payment tracking
  stripeSessionId: text("stripe_session_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  
  // Notes
  internalNotes: text("internal_notes"),
  specialConditions: text("special_conditions"), // Visible to client
  
  // Tracking
  createdBy: varchar("created_by").references(() => users.id),
  sentAt: timestamp("sent_at"),
  validUntil: timestamp("valid_until"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Construction Milestones - Payment and progress tracking
export const constructionMilestones = pgTable("construction_milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  constructionAgreementId: varchar("construction_agreement_id").notNull().references(() => constructionAgreements.id, { onDelete: "cascade" }),
  
  // Milestone details
  name: text("name").notNull(), // "Deposit", "Materials Delivery", "Installation Complete", etc.
  description: text("description"),
  orderIndex: integer("order_index").notNull().default(0),
  
  // Payment
  paymentPercent: real("payment_percent"), // % of total contract
  paymentAmount: real("payment_amount"), // $ amount
  
  // Status
  status: text("status").notNull().default("pending"), // "pending" | "in_progress" | "completed" | "invoiced" | "paid"
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  invoicedAt: timestamp("invoiced_at"),
  paidAt: timestamp("paid_at"),
  
  // Stripe
  stripeInvoiceId: text("stripe_invoice_id"),
  
  // Notes
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// O&M Contracts - Recurring maintenance agreements
export const omContracts = pgTable("om_contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  siteId: varchar("site_id").notNull().references(() => sites.id),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  constructionAgreementId: varchar("construction_agreement_id").references(() => constructionAgreements.id),
  
  // Contract details
  contractNumber: text("contract_number"),
  status: text("status").notNull().default("draft"), // "draft" | "active" | "suspended" | "expired" | "cancelled"
  
  // Coverage
  coverageType: text("coverage_type").notNull().default("standard"), // "basic" | "standard" | "premium" | "custom"
  coverageDetails: jsonb("coverage_details"), // Detailed scope of services
  
  // System covered (snapshot)
  pvSizeKW: real("pv_size_kw"),
  batteryEnergyKWh: real("battery_energy_kwh"),
  
  // Contract period
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  termMonths: integer("term_months").default(12),
  autoRenew: boolean("auto_renew").default(true),
  
  // Pricing
  annualFee: real("annual_fee"),
  billingFrequency: text("billing_frequency").default("annual"), // "monthly" | "quarterly" | "annual"
  priceEscalationPercent: real("price_escalation_percent").default(2.5),
  
  // SLA targets
  responseTimeHours: integer("response_time_hours").default(48),
  scheduledVisitsPerYear: integer("scheduled_visits_per_year").default(2),
  performanceGuaranteePercent: real("performance_guarantee_percent"), // Min. production guarantee
  
  // Client contact
  siteContactName: text("site_contact_name"),
  siteContactPhone: text("site_contact_phone"),
  siteContactEmail: text("site_contact_email"),
  
  // Signature
  acceptedByName: text("accepted_by_name"),
  acceptedByEmail: text("accepted_by_email"),
  signatureData: text("signature_data"),
  acceptedAt: timestamp("accepted_at"),
  
  // Stripe subscription
  stripeSubscriptionId: text("stripe_subscription_id"),
  
  // Notes
  internalNotes: text("internal_notes"),
  specialConditions: text("special_conditions"),
  
  // Tracking
  createdBy: varchar("created_by").references(() => users.id),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// O&M Visits - Maintenance visit logs
export const omVisits = pgTable("om_visits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  omContractId: varchar("om_contract_id").notNull().references(() => omContracts.id),
  siteId: varchar("site_id").notNull().references(() => sites.id),
  
  // Visit details
  visitType: text("visit_type").notNull().default("scheduled"), // "scheduled" | "emergency" | "warranty" | "inspection"
  status: text("status").notNull().default("scheduled"), // "scheduled" | "in_progress" | "completed" | "cancelled"
  
  // Scheduling
  scheduledDate: timestamp("scheduled_date"),
  actualDate: timestamp("actual_date"),
  duration: integer("duration"), // Minutes
  
  // Technician
  technicianName: text("technician_name"),
  technicianId: varchar("technician_id").references(() => users.id),
  
  // Findings
  findings: jsonb("findings"), // Array of { category, description, severity, resolved }
  issuesFound: integer("issues_found").default(0),
  issuesResolved: integer("issues_resolved").default(0),
  
  // System readings
  systemReadings: jsonb("system_readings"), // { productionKWh, inverterStatus, batterySOH, etc. }
  
  // Actions taken
  actionsTaken: text("actions_taken"),
  partsUsed: jsonb("parts_used"), // Array of { partNumber, description, quantity, cost }
  
  // Follow-up
  followUpRequired: boolean("follow_up_required").default(false),
  followUpNotes: text("follow_up_notes"),
  followUpScheduledDate: timestamp("follow_up_scheduled_date"),
  
  // Photos
  photos: jsonb("photos"), // Array of { url, caption, category }
  
  // Client sign-off
  clientSignatureName: text("client_signature_name"),
  clientSignatureData: text("client_signature_data"),
  clientSignedAt: timestamp("client_signed_at"),
  
  // Costs (for tracking, not necessarily billed)
  laborCost: real("labor_cost"),
  partsCost: real("parts_cost"),
  travelCost: real("travel_cost"),
  totalCost: real("total_cost"),
  billable: boolean("billable").default(false),
  
  // Notes
  internalNotes: text("internal_notes"),
  clientVisibleNotes: text("client_visible_notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// O&M Performance Snapshots - Periodic KPI tracking
export const omPerformanceSnapshots = pgTable("om_performance_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  omContractId: varchar("om_contract_id").notNull().references(() => omContracts.id),
  siteId: varchar("site_id").notNull().references(() => sites.id),
  
  // Period
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  periodType: text("period_type").notNull().default("monthly"), // "daily" | "weekly" | "monthly" | "annual"
  
  // Production KPIs
  expectedProductionKWh: real("expected_production_kwh"),
  actualProductionKWh: real("actual_production_kwh"),
  performanceRatio: real("performance_ratio"), // Actual/Expected as %
  
  // Availability
  systemUptimePercent: real("system_uptime_percent"),
  inverterUptimePercent: real("inverter_uptime_percent"),
  
  // Financial
  expectedSavings: real("expected_savings"),
  actualSavings: real("actual_savings"),
  
  // Issues
  alertsCount: integer("alerts_count").default(0),
  ticketsOpened: integer("tickets_opened").default(0),
  ticketsResolved: integer("tickets_resolved").default(0),
  
  // Weather (for context)
  avgIrradianceKWhM2: real("avg_irradiance_kwh_m2"),
  avgTemperatureC: real("avg_temperature_c"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// ==================== SALES CRM TABLES ====================

// Opportunities - Sales pipeline tracking
export const opportunities = pgTable("opportunities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Links
  leadId: varchar("lead_id").references(() => leads.id),
  clientId: varchar("client_id").references(() => clients.id),
  siteId: varchar("site_id").references(() => sites.id),
  
  // Basic info
  name: text("name").notNull(), // "123 Rue Commerce - 500kW Solar"
  description: text("description"),
  
  // Pipeline stage
  stage: text("stage").notNull().default("prospect"), // "prospect" | "qualified" | "proposal" | "negotiation" | "won" | "lost"
  probability: integer("probability").default(10), // % likelihood to close
  
  // Value
  estimatedValue: real("estimated_value"), // $ potential deal value
  pvSizeKW: real("pv_size_kw"), // Estimated system size
  
  // Expected close
  expectedCloseDate: timestamp("expected_close_date"),
  actualCloseDate: timestamp("actual_close_date"),
  
  // Lost reason (if stage = "lost")
  lostReason: text("lost_reason"), // "price" | "competition" | "timing" | "no_budget" | "other"
  lostNotes: text("lost_notes"),
  
  // Assignment
  ownerId: varchar("owner_id").references(() => users.id),
  
  // Source tracking
  source: text("source"), // "web_form" | "referral" | "cold_call" | "event" | "other"
  sourceDetails: text("source_details"),
  
  // Priority
  priority: text("priority").default("medium"), // "low" | "medium" | "high" | "urgent"
  
  // Tags for filtering
  tags: text("tags").array(),
  
  // Next action
  nextActionDate: timestamp("next_action_date"),
  nextActionDescription: text("next_action_description"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Activities - Log of calls, emails, meetings on leads/clients/opportunities
export const activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Links (at least one should be set)
  leadId: varchar("lead_id").references(() => leads.id),
  clientId: varchar("client_id").references(() => clients.id),
  siteId: varchar("site_id").references(() => sites.id),
  opportunityId: varchar("opportunity_id").references(() => opportunities.id),
  
  // Activity type
  activityType: text("activity_type").notNull(), // "call" | "email" | "meeting" | "note" | "site_visit" | "proposal_sent" | "follow_up"
  
  // Direction (for calls/emails)
  direction: text("direction"), // "inbound" | "outbound"
  
  // Content
  subject: text("subject"),
  description: text("description"),
  
  // Timing
  activityDate: timestamp("activity_date").defaultNow(),
  duration: integer("duration"), // Minutes (for calls/meetings)
  
  // Outcome
  outcome: text("outcome"), // "connected" | "voicemail" | "no_answer" | "scheduled_meeting" | "sent" | "received" | "completed"
  
  // Follow-up
  followUpDate: timestamp("follow_up_date"),
  followUpNotes: text("follow_up_notes"),
  
  // User who logged the activity
  createdBy: varchar("created_by").references(() => users.id),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Email logs for tracking sent emails and enabling follow-up
export const emailLogs = pgTable("email_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  siteId: varchar("site_id").references(() => sites.id),
  designAgreementId: varchar("design_agreement_id").references(() => designAgreements.id),
  leadId: varchar("lead_id").references(() => leads.id),
  
  // Email details
  recipientEmail: text("recipient_email").notNull(),
  recipientName: text("recipient_name"),
  subject: text("subject").notNull(),
  emailType: text("email_type").notNull(), // "design_agreement" | "analysis_report" | "procuration" | "portal_access" | "other"
  
  // Sender info
  sentByUserId: varchar("sent_by_user_id").references(() => users.id),
  
  // Status tracking
  status: text("status").notNull().default("sent"), // "sent" | "delivered" | "opened" | "failed"
  errorMessage: text("error_message"),
  
  // Custom message tracking
  customMessage: text("custom_message"), // Custom body if user modified default
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  source: true,
  status: true,
  latitude: true,
  longitude: true,
  roofAreaSqM: true,
  roofPotentialKw: true,
  estimateError: true,
  estimateCompletedAt: true,
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSiteSchema = createInsertSchema(sites).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  analysisAvailable: true,
});

export const insertMeterFileSchema = createInsertSchema(meterFiles).omit({
  id: true,
  createdAt: true,
  status: true,
  errorMessage: true,
});

export const insertMeterReadingSchema = createInsertSchema(meterReadings).omit({
  id: true,
});

export const insertSimulationRunSchema = createInsertSchema(simulationRuns).omit({
  id: true,
  createdAt: true,
});

export const insertDesignSchema = createInsertSchema(designs).omit({
  id: true,
  createdAt: true,
});

export const insertBomItemSchema = createInsertSchema(bomItems).omit({
  id: true,
});

export const insertComponentCatalogSchema = createInsertSchema(componentCatalog).omit({
  id: true,
});

export const insertSiteVisitSchema = createInsertSchema(siteVisits).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDesignAgreementSchema = createInsertSchema(designAgreements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPortfolioSchema = createInsertSchema(portfolios).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPortfolioSiteSchema = createInsertSchema(portfolioSites).omit({
  id: true,
  createdAt: true,
});

export const insertBlogArticleSchema = createInsertSchema(blogArticles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  viewCount: true,
});

export const insertProcurationSignatureSchema = createInsertSchema(procurationSignatures).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  sentAt: true,
  viewedAt: true,
  signedAt: true,
  signedDocumentUrl: true,
});

export const insertEmailLogSchema = createInsertSchema(emailLogs).omit({
  id: true,
  createdAt: true,
  status: true,
  errorMessage: true,
});

// Market Intelligence insert schemas
export const insertCompetitorSchema = createInsertSchema(competitors).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBattleCardSchema = createInsertSchema(battleCards).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMarketNoteSchema = createInsertSchema(marketNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMarketDocumentSchema = createInsertSchema(marketDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Construction and O&M insert schemas
export const insertConstructionAgreementSchema = createInsertSchema(constructionAgreements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  publicToken: true,
  sentAt: true,
  acceptedAt: true,
  depositPaidAt: true,
  actualStartDate: true,
  actualCompletionDate: true,
});

export const insertConstructionMilestoneSchema = createInsertSchema(constructionMilestones).omit({
  id: true,
  createdAt: true,
  completedAt: true,
  invoicedAt: true,
  paidAt: true,
});

export const insertOmContractSchema = createInsertSchema(omContracts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  acceptedAt: true,
});

export const insertOmVisitSchema = createInsertSchema(omVisits).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  clientSignedAt: true,
});

export const insertOmPerformanceSnapshotSchema = createInsertSchema(omPerformanceSnapshots).omit({
  id: true,
  createdAt: true,
});

// Sales CRM schemas
export const insertOpportunitySchema = createInsertSchema(opportunities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

export type InsertSite = z.infer<typeof insertSiteSchema>;
export type Site = typeof sites.$inferSelect;

export type InsertMeterFile = z.infer<typeof insertMeterFileSchema>;
export type MeterFile = typeof meterFiles.$inferSelect;

export type InsertMeterReading = z.infer<typeof insertMeterReadingSchema>;
export type MeterReading = typeof meterReadings.$inferSelect;

export type InsertSimulationRun = z.infer<typeof insertSimulationRunSchema>;
export type SimulationRun = typeof simulationRuns.$inferSelect;

export type InsertDesign = z.infer<typeof insertDesignSchema>;
export type Design = typeof designs.$inferSelect;

export type InsertBomItem = z.infer<typeof insertBomItemSchema>;
export type BomItem = typeof bomItems.$inferSelect;

export type InsertComponentCatalog = z.infer<typeof insertComponentCatalogSchema>;
export type ComponentCatalog = typeof componentCatalog.$inferSelect;

export type InsertSiteVisit = z.infer<typeof insertSiteVisitSchema>;
export type SiteVisit = typeof siteVisits.$inferSelect;

export type InsertDesignAgreement = z.infer<typeof insertDesignAgreementSchema>;
export type DesignAgreement = typeof designAgreements.$inferSelect;

export type InsertPortfolio = z.infer<typeof insertPortfolioSchema>;
export type Portfolio = typeof portfolios.$inferSelect;

export type InsertPortfolioSite = z.infer<typeof insertPortfolioSiteSchema>;
export type PortfolioSite = typeof portfolioSites.$inferSelect;

export type InsertBlogArticle = z.infer<typeof insertBlogArticleSchema>;
export type BlogArticle = typeof blogArticles.$inferSelect;

export type InsertProcurationSignature = z.infer<typeof insertProcurationSignatureSchema>;
export type ProcurationSignature = typeof procurationSignatures.$inferSelect;

export type InsertEmailLog = z.infer<typeof insertEmailLogSchema>;
export type EmailLog = typeof emailLogs.$inferSelect;

// Market Intelligence types
export type InsertCompetitor = z.infer<typeof insertCompetitorSchema>;
export type Competitor = typeof competitors.$inferSelect;

export type InsertBattleCard = z.infer<typeof insertBattleCardSchema>;
export type BattleCard = typeof battleCards.$inferSelect;

export type InsertMarketNote = z.infer<typeof insertMarketNoteSchema>;
export type MarketNote = typeof marketNotes.$inferSelect;

export type InsertMarketDocument = z.infer<typeof insertMarketDocumentSchema>;
export type MarketDocument = typeof marketDocuments.$inferSelect;

// Construction and O&M types
export type InsertConstructionAgreement = z.infer<typeof insertConstructionAgreementSchema>;
export type ConstructionAgreement = typeof constructionAgreements.$inferSelect;

export type InsertConstructionMilestone = z.infer<typeof insertConstructionMilestoneSchema>;
export type ConstructionMilestone = typeof constructionMilestones.$inferSelect;

export type InsertOmContract = z.infer<typeof insertOmContractSchema>;
export type OmContract = typeof omContracts.$inferSelect;

export type InsertOmVisit = z.infer<typeof insertOmVisitSchema>;
export type OmVisit = typeof omVisits.$inferSelect;

export type InsertOmPerformanceSnapshot = z.infer<typeof insertOmPerformanceSnapshotSchema>;
export type OmPerformanceSnapshot = typeof omPerformanceSnapshots.$inferSelect;

// Sales CRM types
export type InsertOpportunity = z.infer<typeof insertOpportunitySchema>;
export type Opportunity = typeof opportunities.$inferSelect;

export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;

// Extended Market Intelligence types
export type BattleCardWithCompetitor = BattleCard & { competitor: Competitor };

// Extended types for frontend
export type SiteWithClient = Site & { client: Client };
export type SimulationRunWithSite = SimulationRun & { site: SiteWithClient };
export type DesignWithBom = Design & { bomItems: BomItem[] };
export type SiteVisitWithSite = SiteVisit & { site: SiteWithClient };
export type PortfolioWithSites = Portfolio & { sites: Site[]; client: Client };
export type PortfolioSiteWithDetails = PortfolioSite & { site: Site; latestSimulation?: SimulationRun };

// Construction and O&M extended types
export type ConstructionAgreementWithDetails = ConstructionAgreement & { 
  site: SiteWithClient; 
  design?: Design;
  milestones: ConstructionMilestone[];
};
export type OmContractWithDetails = OmContract & { 
  site: SiteWithClient; 
  client: Client;
  visits?: OmVisit[];
};
export type OmVisitWithDetails = OmVisit & { 
  site: Site; 
  contract: OmContract;
};

// Rematek cost structure (based on quote #12885)
export interface RematekCostBreakdown {
  dailyTravel: number;        // $150/day
  dataCollection: number;     // $600/building
  potentialEvaluation: number; // $1,000/building
  schemas: number;            // $1,900/building
  sldSupplement: number;      // $100/site if SLD missing
  subtotal: number;
  taxGST: number;             // 5% or HST varies by province
  taxQST: number;             // 9.975% Quebec
  total: number;
}

// Analysis input parameters (matching Streamlit script)
export interface AnalysisAssumptions {
  // Tariff selection
  tariffCode?: string;       // HQ tariff code: D, G, M, L, etc. - auto-detected if not set
  
  // Tariffs (can be overridden or auto-populated from tariffCode)
  tariffEnergy: number;      // $/kWh - default 0.057 (M tariff tier 1)
  tariffPower: number;       // $/kW/month - default 17.57 (M tariff)
  
  // Solar production parameters
  solarYieldKWhPerKWp: number; // kWh/kWp/year - default 1150, can be overridden with Google Solar data
  orientationFactor: number;   // 0-1 multiplier for roof orientation (1.0 = optimal south-facing)
  
  // Helioscope-inspired system modeling
  inverterLoadRatio: number;     // DC/AC ratio (ILR) - default 1.2, typical range 1.1-1.5
  temperatureCoefficient: number; // Power temp coefficient %/°C - default -0.004 (-0.4%/°C)
  wireLossPercent: number;       // DC wiring losses - default 0.02 (2%)
  degradationRatePercent: number; // Annual module degradation - default 0.005 (0.5%/year)
  
  // Financial
  inflationRate: number;     // % as decimal - default 0.048
  discountRate: number;      // WACC % as decimal - default 0.08
  taxRate: number;           // Corporate tax % as decimal - default 0.265
  
  // CAPEX costs
  solarCostPerW: number;     // $/W - default 2.25
  batteryCapacityCost: number; // $/kWh - default 550
  batteryPowerCost: number;   // $/kW - default 800
  
  // O&M
  omSolarPercent: number;    // % of CAPEX - default 0.01
  omBatteryPercent: number;  // % of CAPEX - default 0.005
  omEscalation: number;      // % per year - default 0.025
  
  // Roof constraints
  roofAreaSqFt: number;      // Total roof area in sq ft
  roofUtilizationRatio: number; // % usable - default 0.80
  
  // Battery replacement (NEW)
  batteryReplacementYear: number;   // Year to replace battery - default 10
  batteryReplacementCostFactor: number; // % of original cost - default 0.60 (60%)
  batteryPriceDeclineRate: number;  // Annual price decline % - default 0.05 (5%/year)
  
  // Analysis period
  analysisYears: number;     // default 25
  
  // Bifacial PV parameters (for white membrane roofs)
  bifacialEnabled?: boolean;      // Whether to use bifacial panels
  bifacialityFactor?: number;     // Rear-side efficiency ratio (0.7-0.9) - default 0.85
  roofAlbedo?: number;            // Ground/roof reflectivity (0-1) - default 0.7 for white membrane
  bifacialCostPremium?: number;   // Additional cost per W for bifacial - default 0.10 (10 cents)
  
  // Manual yield override flag
  useManualYield?: boolean;       // If true, use solarYieldKWhPerKWp instead of Google data
  
  // HQ Net Metering surplus compensation rate (new Dec 2024)
  // Source: HQ Tariff Proposal R-4270-2024 - Compensation at average cost of supply
  // NOT client's energy tariff rate - HQ compensates at cost of supply after 24-month bank reset
  hqSurplusCompensationRate?: number;  // $/kWh - default 0.0454 (4.54¢/kWh)
}

// Default analysis assumptions
export const defaultAnalysisAssumptions: AnalysisAssumptions = {
  tariffCode: "M", // Default to Medium Power tariff
  tariffEnergy: 0.06061, // Tarif M 2025: 6.061¢/kWh (tier 1)
  tariffPower: 17.573, // Tarif M 2025: $17.573/kW
  solarYieldKWhPerKWp: 1150, // Quebec average: 1100-1200 kWh/kWp/year
  orientationFactor: 1.0, // 1.0 = optimal south-facing, reduced for E/W orientations
  
  // Helioscope-inspired system modeling defaults
  inverterLoadRatio: 1.2, // DC/AC ratio - typical 1.1-1.5, default 1.2
  temperatureCoefficient: -0.004, // -0.4%/°C typical for crystalline Si
  wireLossPercent: 0.02, // 2% DC wiring losses
  degradationRatePercent: 0.005, // 0.5% annual degradation
  
  inflationRate: 0.048, // 4.8% HQ tariff inflation
  discountRate: 0.08, // 8% WACC
  taxRate: 0.265, // 26.5% corporate tax
  solarCostPerW: 2.25, // $2.25/Wc
  batteryCapacityCost: 550, // $550/kWh
  batteryPowerCost: 800, // $800/kW
  omSolarPercent: 0.01, // 1% of solar CAPEX
  omBatteryPercent: 0.005, // 0.5% of battery CAPEX
  omEscalation: 0.025, // 2.5% annual O&M escalation
  roofAreaSqFt: 100000, // Default roof area (100,000 sq ft for large C&I buildings)
  roofUtilizationRatio: 0.80, // 80% usable
  batteryReplacementYear: 10, // Replace battery at year 10
  batteryReplacementCostFactor: 0.60, // 60% of original cost
  batteryPriceDeclineRate: 0.05, // 5% annual price decline
  analysisYears: 25, // 25-year analysis
  
  // Bifacial PV defaults (optional - only used when bifacialEnabled is true)
  bifacialEnabled: false,
  bifacialityFactor: 0.85, // 85% rear-side efficiency
  roofAlbedo: 0.70, // White membrane ~70% reflectivity
  bifacialCostPremium: 0.10, // $0.10/W additional cost
  
  // HQ Net Metering surplus compensation (Dec 2024+)
  // Source: HQ Tariff Proposal R-4270-2024 - Average cost of supply rate
  // After 24-month bank reset, surplus kWh compensated at this rate (NOT client tariff)
  hqSurplusCompensationRate: 0.0454, // 4.54¢/kWh (HQ cost of supply 2025)
};

// Cashflow entry for detailed analysis
export interface CashflowEntry {
  year: number;
  revenue: number;
  opex: number;
  ebitda: number;
  investment: number;
  dpa: number;         // Tax depreciation
  incentives: number;
  netCashflow: number;
  cumulative: number;
}

// Financial breakdown
export interface FinancialBreakdown {
  // CAPEX
  capexSolar: number;
  capexBattery: number;
  capexGross: number;
  
  // Incentives
  potentialHQSolar: number;     // $1000/kW
  potentialHQBattery: number;   // Discontinued Dec 2024 - now $0 (legacy field)
  cap40Percent: number;         // 40% cap
  actualHQSolar: number;
  actualHQBattery: number;
  totalHQ: number;
  
  // Federal ITC
  itcBasis: number;
  itcAmount: number;           // 30% of basis
  
  // Tax shield
  depreciableBasis: number;
  taxShield: number;           // 90% * basis * tax_rate
  
  // Timing
  equityInitial: number;
  batterySubY0: number;
  batterySubY1: number;
  
  // Net
  capexNet: number;
}

// Hourly profile data for charts
export interface HourlyProfileEntry {
  hour: number;
  month: number;
  consumption: number;
  production: number;
  peakBefore: number;
  peakAfter: number;
  batterySOC: number;
}

// Peak week data for charts
export interface PeakWeekEntry {
  timestamp: string;
  peakBefore: number;
  peakAfter: number;
}

// Sensitivity analysis types for optimization charts

// Single scenario point for efficiency frontier
export interface FrontierPoint {
  id: string;
  type: 'solar' | 'battery' | 'hybrid';
  label: string;
  pvSizeKW: number;
  battEnergyKWh: number;
  battPowerKW: number;
  capexNet: number;      // X-axis: Investment net ($)
  npv25: number;         // Y-axis: Profit net (VAN $)
  isOptimal: boolean;
}

// Solar size sweep point
export interface SolarSweepPoint {
  pvSizeKW: number;      // X-axis: Solar capacity (kWc)
  npv25: number;         // Y-axis: VAN ($)
  isOptimal?: boolean;   // Mark optimal point
}

// Battery size sweep point
export interface BatterySweepPoint {
  battEnergyKWh: number; // X-axis: Battery capacity (kWh)
  npv25: number;         // Y-axis: VAN ($)
  isOptimal?: boolean;   // Mark optimal point
}

// Complete sensitivity analysis result
export interface SensitivityAnalysis {
  frontier: FrontierPoint[];        // Efficiency frontier scatter points
  solarSweep: SolarSweepPoint[];    // Solar optimization curve
  batterySweep: BatterySweepPoint[]; // Battery optimization curve
  optimalScenarioId: string | null;  // ID of the optimal scenario
}
