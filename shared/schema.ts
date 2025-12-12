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
  zohoLeadId: text("zoho_lead_id"),
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
  zohoAccountId: text("zoho_account_id"),
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
  zohoDealId: text("zoho_deal_id"),
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
  
  // Equipment Info
  mainPanelManufacturer: text("main_panel_manufacturer"),
  mainPanelModel: text("main_panel_model"),
  mainBreakerManufacturer: text("main_breaker_manufacturer"),
  mainBreakerModel: text("main_breaker_model"),
  secondaryEquipmentNotes: text("secondary_equipment_notes"),
  
  // Photos and Documents (JSON array of file paths/URLs)
  roofPhotos: jsonb("roof_photos"),
  equipmentPhotos: jsonb("equipment_photos"),
  roofSketch: text("roof_sketch"), // Path to sketch image/document
  
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
  
  // Zoho CRM sync
  zohoDealId: text("zoho_deal_id"),
  
  // Notes
  internalNotes: text("internal_notes"),
  clientNotes: text("client_notes"), // Visible to client
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  zohoLeadId: true,
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
  zohoAccountId: true,
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
  zohoDealId: true,
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

// Extended types for frontend
export type SiteWithClient = Site & { client: Client };
export type SimulationRunWithSite = SimulationRun & { site: SiteWithClient };
export type DesignWithBom = Design & { bomItems: BomItem[] };
export type SiteVisitWithSite = SiteVisit & { site: SiteWithClient };
export type PortfolioWithSites = Portfolio & { sites: Site[]; client: Client };
export type PortfolioSiteWithDetails = PortfolioSite & { site: Site; latestSimulation?: SimulationRun };

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
