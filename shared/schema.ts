import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

// Re-export chat schema for AI integrations
export * from "./models/chat";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("admin"), // "admin" | "analyst" | "client"
  clientId: varchar("client_id"), // Links client users to their company (null for admin/analyst)
  name: text("name"), // Display name for the user
  status: text("status").notNull().default("active"), // "active" | "inactive"
  forcePasswordChange: boolean("force_password_change").notNull().default(false), // Require password change on next login
  lastLoginAt: timestamp("last_login_at"), // Last successful login timestamp
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
  
  // Lead Qualification System - 4 Gates
  // Gate 1: Economic Potential
  economicStatus: text("economic_status"), // "high" | "medium" | "low" | "insufficient"
  
  // Gate 2: Right to Install
  propertyRelationship: text("property_relationship"), // "owner" | "tenant_authorized" | "tenant_pending" | "tenant_no_auth" | "unknown"
  landlordName: text("landlord_name"),
  landlordContact: text("landlord_contact"),
  authorizationStatus: text("authorization_status"),
  
  // Gate 3: Roof Condition
  roofCondition: text("roof_condition"), // "excellent" | "good" | "needs_repair" | "needs_replacement" | "unknown"
  roofAge: text("roof_age"), // "new" | "recent" | "mature" | "old" | "unknown"
  roofAgeYears: integer("roof_age_years"),
  lastRoofInspection: timestamp("last_roof_inspection"),
  plannedRoofWork: text("planned_roof_work"),
  
  // Gate 4: Decision Capacity
  decisionAuthority: text("decision_authority"), // "decision_maker" | "influencer" | "researcher" | "unknown"
  decisionMakerName: text("decision_maker_name"),
  decisionMakerTitle: text("decision_maker_title"),
  budgetReadiness: text("budget_readiness"), // "budget_allocated" | "budget_possible" | "budget_needed" | "no_budget" | "unknown"
  timelineUrgency: text("timeline_urgency"), // "immediate" | "this_year" | "next_year" | "exploring" | "unknown"
  targetDecisionDate: timestamp("target_decision_date"),
  
  // Qualification Results
  qualificationScore: integer("qualification_score"), // 0-100
  qualificationStatus: text("qualification_status"), // "hot" | "warm" | "nurture" | "cold" | "disqualified" | "pending"
  qualificationBlockers: jsonb("qualification_blockers"), // Array of Blocker objects
  qualificationNextSteps: jsonb("qualification_next_steps"), // Array of strings
  qualificationNotes: text("qualification_notes"),
  qualifiedAt: timestamp("qualified_at"),
  qualifiedBy: varchar("qualified_by"),
  
  // Hydro-Québec bill storage (transferred to site when lead converts)
  hqBillPath: text("hq_bill_path"),
  
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
  notes: text("notes"),
  accountManagerEmail: text("account_manager_email").default("malabarre@kwh.quebec"),
  isArchived: boolean("is_archived").notNull().default(false),
  archivedAt: timestamp("archived_at"),
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
  ownerName: text("owner_name"), // Building owner/sponsor name for PDF reports
  
  // Building characteristics
  buildingType: text("building_type"), // "industrial" | "commercial" | "institutional" | "other"
  roofType: text("roof_type"), // "flat" | "inclined" | "other"
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
  
  // Structural engineering constraints from feasibility studies
  structuralNotes: text("structural_notes"),
  structuralConstraints: jsonb("structural_constraints"), // { maxPvLoadKpa, roofChangeRequired, engineeringReportRef, zones: [...] }
  
  // Hydro-Québec RFP eligibility and network data
  hqRfpStatus: text("hq_rfp_status"), // "eligible" | "not_eligible" | "pending"
  hqSubstation: text("hq_substation"), // Name of HQ substation
  hqLineId: text("hq_line_id"), // HQ line identification (e.g. "L23402")
  hqTransformer: text("hq_transformer"), // HQ transformer ID
  hqLineVoltage: text("hq_line_voltage"), // Line voltage (e.g. "347/600", "25KV")
  hqDistributionUpgradeCost: real("hq_distribution_upgrade_cost"),
  hqSubstationUpgradeCost: real("hq_substation_upgrade_cost"),
  hqProtectionsCost: real("hq_protections_cost"),
  hqCommunicationsCost: real("hq_communications_cost"),
  hqTotalUpgradeCost: real("hq_total_upgrade_cost"),
  hqLeadTimeMonths: integer("hq_lead_time_months"),
  hqCompletionDate: timestamp("hq_completion_date"),
  hqContractTargetDate: timestamp("hq_contract_target_date"),
  
  // DOT (Distribution Operator Technical) capacity status
  dotCapacityStatus: text("dot_capacity_status"), // "yes" | "no" | "pending"
  
  // Structural feasibility status
  structuralPassStatus: text("structural_pass_status"), // "yes" | "no" | "partial"
  structuralCapacity: text("structural_capacity"), // e.g. "0.36", "0.25-0.36"
  structuralBallastRemoval: text("structural_ballast_removal"), // "yes" | "no"
  
  // Building external ID (for client reference)
  externalBuildingId: text("external_building_id"), // e.g. "MON7003", "21025"
  buildingSqFt: real("building_sqft"),
  yearBuilt: integer("year_built"),
  
  // Roof area validation - requires manual drawing before analysis
  roofAreaValidated: boolean("roof_area_validated").default(false), // Must be true before running simulation
  roofAreaValidatedAt: timestamp("roof_area_validated_at"), // When manual drawing was completed
  roofAreaValidatedBy: varchar("roof_area_validated_by"), // User ID who validated
  
  // KB Racking Design Data - Validated from real project quotes
  // Product: AeroGrid 10° Landscape with Jinko 625W panels
  kbDesignStatus: text("kb_design_status").default("none"), // "none" | "pending" | "complete"
  kbPanelCount: integer("kb_panel_count"), // Number of panels from KB design
  kbKwDc: real("kb_kw_dc"), // Total DC capacity in kW (panel count × 0.625)
  kbPricePerPanel: real("kb_price_per_panel"), // $/panel from KB quote
  kbRackingSubtotal: real("kb_racking_subtotal"), // Total racking cost (panels × price)
  kbShippingCost: real("kb_shipping_cost"), // Shipping/handling estimate
  kbEngineeringCost: real("kb_engineering_cost"), // PE stamped report cost
  kbQuoteDate: timestamp("kb_quote_date"), // Date quote was issued
  kbQuoteExpiry: timestamp("kb_quote_expiry"), // Quote expiration date (typically +30 days)
  kbQuoteNumber: text("kb_quote_number"), // Reference quote number
  kbDesignPdfUrl: text("kb_design_pdf_url"), // URL to engineering PDF
  kbWindPressureKpa: real("kb_wind_pressure_kpa"), // q50 wind pressure from design
  kbExposureFactor: real("kb_exposure_factor"), // Ce exposure factor
  kbTerrainType: text("kb_terrain_type"), // "Rough" | "Open" etc.
  
  // Quick Analysis cached results
  quickAnalysisSystemSizeKw: real("quick_analysis_system_size_kw"),
  quickAnalysisAnnualProductionKwh: real("quick_analysis_annual_production_kwh"),
  quickAnalysisAnnualSavings: real("quick_analysis_annual_savings"),
  quickAnalysisPaybackYears: real("quick_analysis_payback_years"),
  quickAnalysisGrossCapex: real("quick_analysis_gross_capex"),
  quickAnalysisNetCapex: real("quick_analysis_net_capex"),
  quickAnalysisHqIncentive: real("quick_analysis_hq_incentive"),
  quickAnalysisMonthlyBill: real("quick_analysis_monthly_bill"),
  quickAnalysisConstraintFactor: real("quick_analysis_constraint_factor"), // 0.05-0.25 (5-25%)
  quickAnalysisCompletedAt: timestamp("quick_analysis_completed_at"),
  
  // Work Queue assignment for task delegation
  workQueueAssignedToId: varchar("work_queue_assigned_to_id"), // Internal user ID
  workQueueAssignedAt: timestamp("work_queue_assigned_at"),
  workQueuePriority: text("work_queue_priority").default("normal"), // "high" | "normal" | "low"
  // External delegation (for people not in the system)
  workQueueDelegatedToEmail: text("work_queue_delegated_to_email"),
  workQueueDelegatedToName: text("work_queue_delegated_to_name"),
  workQueueDelegatedAt: timestamp("work_queue_delegated_at"),
  
  // Roof visualization image with solar panel overlay
  roofVisualizationImageUrl: text("roof_visualization_image_url"),
  
  // Hydro-Québec bill storage for Espace Client access
  hqBillPath: text("hq_bill_path"),
  hqBillUploadedAt: timestamp("hq_bill_uploaded_at"),
  
  // Lead Qualification Fields (transferred from landing page form)
  roofAgeYears: integer("roof_age_years"), // Approximate roof age in years
  ownershipType: text("ownership_type"), // "owner" | "tenant"
  
  // Archive status
  isArchived: boolean("is_archived").notNull().default(false),
  archivedAt: timestamp("archived_at"),
  
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
  
  // Financial metrics (25-year standard horizon)
  npv25: real("npv_25"),
  npv10: real("npv_10"),
  npv20: real("npv_20"),
  irr25: real("irr_25"),
  irr10: real("irr_10"),
  irr20: real("irr_20"),
  simplePaybackYears: real("simple_payback_years"),
  lcoe: real("lcoe"),
  
  // Extended 30-year horizon metrics (panel lifetime value)
  npv30: real("npv_30"),
  irr30: real("irr_30"),
  lcoe30: real("lcoe_30"),
  
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
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Pricing Components for Market Intelligence - component-level pricing for $/W calculation
export const pricingComponents = pgTable("pricing_components", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: text("category").notNull(), // "panels" | "racking" | "inverters" | "bos_electrical" | "labor" | "soft_costs"
  name: text("name").notNull(), // e.g., "Jinko 625W Bifacial", "KB Racking AeroGrid"
  description: text("description"), // Additional context
  pricePerUnit: real("price_per_unit").notNull(), // Price in CAD
  unit: text("unit").notNull(), // "W" | "panel" | "kW" | "project" | "hour" | "percent"
  minQuantity: real("min_quantity"), // For tiered pricing - minimum quantity for this price
  maxQuantity: real("max_quantity"), // For tiered pricing - maximum quantity for this price
  supplierId: varchar("supplier_id"), // Reference to supplier
  source: text("source"), // "KB Racking", "Distributor XYZ", "Industry benchmark"
  sourceDate: timestamp("source_date"), // When this price was obtained
  validUntil: timestamp("valid_until"), // Quote expiration date
  notes: text("notes"), // Any relevant notes about the pricing
  active: boolean("active").default(true), // Whether this pricing is currently used
  isReference: boolean("is_reference").default(false), // Whether this is the reference price used in Catalog
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Suppliers for Market Intelligence - track vendors and their offerings
export const suppliers = pgTable("suppliers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // e.g., "KB Racking", "Voltxon", "Guillevin"
  category: text("category").notNull(), // "racking" | "panels" | "inverters" | "electrical" | "labor" | "full_service"
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  website: text("website"),
  address: text("address"),
  city: text("city"),
  province: text("province"),
  notes: text("notes"),
  rating: integer("rating"), // 1-5 rating
  leadTimeWeeks: integer("lead_time_weeks"), // Typical lead time
  paymentTerms: text("payment_terms"), // e.g., "Net 30", "50% deposit"
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Price History for Market Intelligence - track price changes over time
export const priceHistory = pgTable("price_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  supplierId: varchar("supplier_id").references(() => suppliers.id),
  category: text("category").notNull(), // "panels" | "racking" | "inverters" | "bos_electrical" | "labor"
  itemName: text("item_name").notNull(), // e.g., "Jinko 625W Bifacial", "AeroGrid 10°"
  pricePerUnit: real("price_per_unit").notNull(),
  unit: text("unit").notNull(), // "W" | "panel" | "kW" | "project" | "hour"
  quantity: real("quantity"), // Quantity for tiered pricing
  quoteNumber: text("quote_number"), // Reference quote number
  quoteDate: timestamp("quote_date").notNull(), // When this quote was received
  validUntil: timestamp("valid_until"), // Quote expiration
  notes: text("notes"),
  documentUrl: text("document_url"), // Link to stored quote PDF
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
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
  anchoringMethod: text("anchoring_method"), // "ballast" | "anchored" | "carport" | "ground_mount"
  anchoringNotes: text("anchoring_notes"),
  lightningRodPresent: boolean("lightning_rod_present"),
  pvReservedAreas: text("pv_reserved_areas"), // Areas designated for PV
  
  // Solar Carport Section (from Electrical Site Visit Checklist)
  solarCarportCandidate: boolean("solar_carport_candidate"), // Good candidate for Solar Carport?
  solarCarportArea: real("solar_carport_area"), // Approximative eligible area for Solar Carport (m²)
  
  // Accessibility Section
  roofAccessible: boolean("roof_accessible"),
  accessMethod: text("access_method"), // "ladder" | "trapdoor" | "stairs" | "other"
  accessNotes: text("access_notes"),
  storageLocations: text("storage_locations"), // Potential material storage/staging locations
  
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
  distributionPanelManufacturer: text("distribution_panel_manufacturer"), // Switchboard manufacturer
  distributionPanelModel: text("distribution_panel_model"), // Switchboard model
  transformerInfo: text("transformer_info"), // Transformer manufacturer/model/serial #
  nearestTransmissionLine: text("nearest_transmission_line"), // Nearest street transmission/distribution line location and distance
  electricalRoomSpace: boolean("electrical_room_space"), // Space available for disconnect (Yes/No)
  
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

// Site Visit Photos - Individual photo metadata storage
export const siteVisitPhotos = pgTable("site_visit_photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  siteId: varchar("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  visitId: varchar("visit_id").references(() => siteVisits.id, { onDelete: "set null" }),
  
  // Photo metadata
  category: text("category").notNull(), // "roof" | "electrical" | "meters" | "obstacles" | "general"
  filename: text("filename").notNull(),
  filepath: text("filepath").notNull(),
  mimetype: text("mimetype"),
  sizeBytes: integer("size_bytes"),
  
  // Optional description/notes
  caption: text("caption"),
  
  // GPS location if captured
  latitude: real("latitude"),
  longitude: real("longitude"),
  
  // Tracking
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const insertSiteVisitPhotoSchema = createInsertSchema(siteVisitPhotos).omit({ id: true, uploadedAt: true });
export type InsertSiteVisitPhoto = z.infer<typeof insertSiteVisitPhotoSchema>;
export type SiteVisitPhoto = typeof siteVisitPhotos.$inferSelect;

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
  
  // Manual override values for sites analyzed externally (e.g., Dream RFP)
  // When set, these values take precedence over simulation results
  overridePvSizeKW: real("override_pv_size_kw"),
  overrideBatteryKWh: real("override_battery_kwh"),
  overrideCapexNet: real("override_capex_net"),
  overrideNpv: real("override_npv"),
  overrideIrr: real("override_irr"), // Stored as decimal (e.g., 0.15 for 15%)
  overrideAnnualSavings: real("override_annual_savings"),
  
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
  clientId: varchar("client_id").references(() => clients.id), // Link to client if from CRM email
  
  // Signer info
  signerName: text("signer_name").notNull(),
  signerEmail: text("signer_email").notNull(),
  signerTitle: text("signer_title"), // Function/title of the signer
  signatureCity: text("signature_city"), // City where signed
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

// Competitor Proposal Analysis - Detailed comparison of competitor proposals
export const competitorProposalAnalysis = pgTable("competitor_proposal_analysis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Links
  competitorId: varchar("competitor_id").references(() => competitors.id),
  siteId: varchar("site_id").references(() => sites.id), // Optional link to our site if we're competing
  
  // Project identification
  projectName: text("project_name").notNull(), // e.g., "Brasswater 3235 Guenette"
  clientName: text("client_name").notNull(), // e.g., "Brasswater"
  projectAddress: text("project_address"),
  tenantName: text("tenant_name"), // e.g., "Hagen"
  proposalDate: timestamp("proposal_date"),
  proposalNumber: text("proposal_number"), // e.g., "#112525a"
  
  // System specifications from competitor
  systemSizeKW: real("system_size_kw"),
  roofAreaSqM: real("roof_area_sq_m"),
  annualProductionKWh: real("annual_production_kwh"),
  projectCostTotal: real("project_cost_total"),
  costPerWatt: real("cost_per_watt"),
  
  // Deal structure
  dealType: text("deal_type"), // "ppa" | "cash" | "lease" | "loan"
  ppaTerm: integer("ppa_term"), // Years
  ppaDiscountPercent: real("ppa_discount_percent"), // e.g., 40 for 40% off
  
  // Competitor assumptions (what they used)
  compInflationRate: real("comp_inflation_rate"), // e.g., 0.03 for 3%
  compDegradationRate: real("comp_degradation_rate"), // e.g., 0.0002 for 0.02%
  compOmCostPercent: real("comp_om_cost_percent"), // e.g., 0.07 for 7%
  compOmStartYear: integer("comp_om_start_year"), // e.g., 17
  compSunshineHours: real("comp_sunshine_hours"), // e.g., 1176
  compElecRate: real("comp_elec_rate"), // $/kWh
  
  // Our assumptions (kWh standard)
  kwhInflationRate: real("kwh_inflation_rate"), // e.g., 0.048 for 4.8%
  kwhDegradationRate: real("kwh_degradation_rate"), // e.g., 0.005 for 0.5%
  kwhOmCostPercent: real("kwh_om_cost_percent"), // e.g., 0.01 for 1%
  kwhCostPerWatt: real("kwh_cost_per_watt"), // Our price for comparison
  
  // Google Solar data (verified)
  googleSolarSunshineHours: real("google_solar_sunshine_hours"),
  googleSolarRoofArea: real("google_solar_roof_area"),
  googleSolarMaxSystemKW: real("google_solar_max_system_kw"),
  googleSolarYield: real("google_solar_yield"), // kWh/kWp
  
  // Calculated differences (impact analysis)
  inflationDiff25Years: real("inflation_diff_25_years"), // $ difference over 25 years
  degradationDiffProduction: real("degradation_diff_production"), // kWh difference
  degradationDiffValue: real("degradation_diff_value"), // $ difference
  omDiff: real("om_diff"), // $ difference in O&M costs
  constructionCostDiff: real("construction_cost_diff"), // $ difference if our price is lower
  
  // Summary
  totalAdvantageKwh: real("total_advantage_kwh"), // Total $ advantage of choosing kWh
  keyFindings: text("key_findings").array(), // Array of key points
  salesTalkingPoints: text("sales_talking_points").array(), // Array of sales arguments
  
  // Billing model risk analysis
  billingModel: text("billing_model"), // "production" | "consumption" | "unknown"
  billingModelNotes: text("billing_model_notes"), // Details from contract analysis
  selfConsumptionRate: real("self_consumption_rate"), // e.g., 0.70 for 70% self-consumption
  overproductionRiskValue: real("overproduction_risk_value"), // $ at risk if billed on production
  
  // Questions to clarify with competitor
  questionsToAsk: text("questions_to_ask").array(), // Sales team questions to clarify
  
  // Attachments (references to marketDocuments)
  attachedDocumentIds: text("attached_document_ids").array(),
  
  // Status
  status: text("status").default("active"), // "active" | "won" | "lost" | "archived"
  outcome: text("outcome"), // Notes on what happened
  
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
  
  // O&M Annexe (integrated O&M terms)
  includeOmAnnexe: boolean("include_om_annexe").default(false),
  omCoverageType: text("om_coverage_type"), // "basic" | "standard" | "premium"
  omAnnualFee: real("om_annual_fee"),
  omTermMonths: integer("om_term_months").default(12),
  omResponseTimeHours: integer("om_response_time_hours").default(48),
  omScheduledVisitsPerYear: integer("om_scheduled_visits_per_year").default(2),
  omPerformanceGuaranteePercent: real("om_performance_guarantee_percent"),
  omAutoRenew: boolean("om_auto_renew").default(true),
  omBillingFrequency: text("om_billing_frequency").default("annual"), // "monthly" | "quarterly" | "annual"
  omSpecialConditions: text("om_special_conditions"),
  
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

// ==================== CONSTRUCTION PROJECT MANAGEMENT ====================

// Construction Projects - Active construction project management
export const constructionProjects = pgTable("construction_projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  constructionAgreementId: varchar("construction_agreement_id").notNull().references(() => constructionAgreements.id),
  siteId: varchar("site_id").notNull().references(() => sites.id),
  
  // Project basics
  projectNumber: text("project_number"), // Auto-generated: PROJ-2024-001
  name: text("name").notNull(),
  description: text("description"),
  
  // Status: planning → mobilization → in_progress → commissioning → punch_list → completed
  status: text("status").notNull().default("planning"),
  statusNote: text("status_note"),
  
  // Progress
  progressPercent: real("progress_percent").default(0), // 0-100
  
  // Timeline
  plannedStartDate: timestamp("planned_start_date"),
  plannedEndDate: timestamp("planned_end_date"),
  actualStartDate: timestamp("actual_start_date"),
  actualEndDate: timestamp("actual_end_date"),
  
  // Team assignment
  projectManagerId: varchar("project_manager_id").references(() => users.id),
  siteForeman: text("site_foreman"),
  siteContact: text("site_contact"),
  siteContactPhone: text("site_contact_phone"),
  
  // Subcontractors
  subcontractors: jsonb("subcontractors"), // Array of { name, trade, contact, phone, status }
  
  // Location & logistics
  siteAccessNotes: text("site_access_notes"),
  parkingInstructions: text("parking_instructions"),
  safetyRequirements: text("safety_requirements"),
  
  // Budget tracking
  budgetTotal: real("budget_total"),
  budgetSpent: real("budget_spent").default(0),
  changeOrdersTotal: real("change_orders_total").default(0),
  
  // Risk & issues
  riskLevel: text("risk_level").default("low"), // "low" | "medium" | "high"
  activeIssues: integer("active_issues").default(0),
  
  // Weather delay tracking
  weatherDelayDays: integer("weather_delay_days").default(0),
  
  // Photos & documents
  photosUrl: text("photos_url"), // Link to photo gallery
  documentsUrl: text("documents_url"), // Link to documents folder
  
  // Notes
  internalNotes: text("internal_notes"),
  dailyLogEnabled: boolean("daily_log_enabled").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Construction Tasks - Individual work items with dependencies (for GANTT)
export const constructionTasks = pgTable("construction_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => constructionProjects.id, { onDelete: "cascade" }),
  
  // Task basics
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("general"), // "permitting" | "procurement" | "electrical" | "mechanical" | "structural" | "inspection" | "general"
  
  // Status
  status: text("status").notNull().default("pending"), // "pending" | "in_progress" | "blocked" | "completed" | "cancelled"
  priority: text("priority").default("medium"), // "low" | "medium" | "high" | "critical"
  
  // GANTT timeline
  plannedStartDate: timestamp("planned_start_date"),
  plannedEndDate: timestamp("planned_end_date"),
  actualStartDate: timestamp("actual_start_date"),
  actualEndDate: timestamp("actual_end_date"),
  durationDays: integer("duration_days"),
  
  // Progress
  progressPercent: real("progress_percent").default(0),
  
  // Dependencies (for GANTT arrows)
  dependsOnTaskIds: text("depends_on_task_ids").array(), // Array of task IDs this task depends on
  
  // Assignment
  assignedToId: varchar("assigned_to_id").references(() => users.id),
  assignedToName: text("assigned_to_name"), // For external subcontractors
  
  // Resources
  estimatedHours: real("estimated_hours"),
  actualHours: real("actual_hours"),
  laborCost: real("labor_cost"),
  materialCost: real("material_cost"),
  
  // Checklist (for sub-items)
  checklist: jsonb("checklist"), // Array of { item, completed, completedAt, completedBy }
  
  // Attachments & photos
  attachments: jsonb("attachments"), // Array of { name, url, type }
  
  // Blocking reason
  blockedReason: text("blocked_reason"),
  blockedAt: timestamp("blocked_at"),
  
  // Notes
  notes: text("notes"),
  
  // Sorting order within project
  sortOrder: integer("sort_order").default(0),
  
  // Preliminary schedule (auto-generated from Design BOM)
  isPreliminary: boolean("is_preliminary").default(false), // Indicates auto-generated tasks from design
  sourceDesignId: varchar("source_design_id").references(() => designs.id), // Links to originating design
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Construction Daily Logs - Daily site reports
export const constructionDailyLogs = pgTable("construction_daily_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => constructionProjects.id, { onDelete: "cascade" }),
  
  // Log date
  logDate: timestamp("log_date").notNull(),
  
  // Weather
  weatherCondition: text("weather_condition"), // "sunny" | "cloudy" | "rain" | "snow" | "extreme"
  temperatureHigh: real("temperature_high"),
  temperatureLow: real("temperature_low"),
  weatherNotes: text("weather_notes"),
  weatherDelay: boolean("weather_delay").default(false),
  
  // Workforce
  crewCount: integer("crew_count"),
  crewDetails: jsonb("crew_details"), // Array of { name, role, hours }
  subcontractorsOnSite: jsonb("subcontractors_on_site"), // Array of { company, workers, task }
  
  // Work performed
  workPerformed: text("work_performed"),
  tasksCompleted: text("tasks_completed").array(),
  
  // Materials
  materialsReceived: jsonb("materials_received"), // Array of { description, quantity, vendor }
  materialsUsed: jsonb("materials_used"), // Array of { description, quantity }
  
  // Equipment
  equipmentOnSite: text("equipment_on_site").array(),
  equipmentIssues: text("equipment_issues"),
  
  // Safety
  safetyIncidents: integer("safety_incidents").default(0),
  safetyNotes: text("safety_notes"),
  
  // Visitors
  visitors: jsonb("visitors"), // Array of { name, company, purpose, timeIn, timeOut }
  
  // Issues & delays
  issuesEncountered: text("issues_encountered"),
  delaysExperienced: text("delays_experienced"),
  
  // Photos
  photos: jsonb("photos"), // Array of { url, caption, timestamp }
  
  // Approval
  preparedBy: varchar("prepared_by").references(() => users.id),
  preparedByName: text("prepared_by_name"),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  
  // Notes
  generalNotes: text("general_notes"),
  tomorrowPlan: text("tomorrow_plan"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ==================== SALES CRM TABLES ====================

// Opportunities - Sales pipeline tracking
export const opportunities = pgTable("opportunities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Links
  leadId: varchar("lead_id").references(() => leads.id),
  clientId: varchar("client_id").references(() => clients.id),
  siteId: varchar("site_id").references(() => sites.id),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id), // Link to portfolio for auto-sync of values
  
  // Basic info
  name: text("name").notNull(), // "123 Rue Commerce - 500kW Solar"
  description: text("description"),
  
  // Pipeline stage with probability mapping:
  // "prospect" (5%) - Nouveau site, analyse rapide en ligne
  // "qualified" (15%) - Procuration HQ signée, analyse détaillée en cours  
  // "proposal" (25%) - Analyse détaillée envoyée avec proposition design
  // "design_signed" (50%) - Entente design signée, dépôt reçu
  // "negotiation" (75%) - Proposition construction présentée, en négociation
  // "won" (100%) - Contrat construction signé
  // "lost" (0%) - Projet abandonné
  stage: text("stage").notNull().default("prospect"),
  probability: integer("probability").default(5), // % likelihood to close - auto-set by stage
  
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

// ==================== PARTNERSHIPS / BUSINESS DEVELOPMENT ====================

// Partnerships - Strategic business relationships (financing, technical, distribution partners)
export const partnerships = pgTable("partnerships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Partner info
  partnerName: text("partner_name").notNull(), // "RBC", "Rematek", "Sunbird", etc.
  partnerType: text("partner_type").notNull(), // "financing" | "technical" | "distribution" | "supplier" | "installer" | "other"
  
  // Opportunity details
  title: text("title").notNull(), // "Financement commercial RBC" or "Partenariat technique Rematek"
  description: text("description"),
  
  // Status tracking
  // "initial_contact" - Premier contact établi
  // "discussion" - Discussions en cours
  // "negotiation" - Négociation des termes
  // "pending_signature" - En attente de signature
  // "active" - Partenariat actif
  // "on_hold" - En pause
  // "closed" - Partenariat terminé
  status: text("status").notNull().default("initial_contact"),
  
  // Potential value/impact
  estimatedAnnualValue: real("estimated_annual_value"), // $ potential annual revenue/savings
  strategicPriority: text("strategic_priority").default("medium"), // "low" | "medium" | "high" | "critical"
  
  // Contacts at the partner organization
  primaryContactName: text("primary_contact_name"),
  primaryContactEmail: text("primary_contact_email"),
  primaryContactPhone: text("primary_contact_phone"),
  primaryContactRole: text("primary_contact_role"), // "VP Sales", "Business Development Manager", etc.
  
  // Key dates
  firstContactDate: timestamp("first_contact_date"),
  lastContactDate: timestamp("last_contact_date"),
  nextFollowUpDate: timestamp("next_follow_up_date"),
  expectedDecisionDate: timestamp("expected_decision_date"),
  
  // Agreement details (if active)
  agreementStartDate: timestamp("agreement_start_date"),
  agreementEndDate: timestamp("agreement_end_date"),
  agreementTerms: text("agreement_terms"), // Summary of key terms
  
  // Notes and documentation
  notes: text("notes"),
  documentLinks: text("document_links").array(), // Links to contracts, proposals, etc.
  
  // Tags for categorization
  tags: text("tags").array(),
  
  // Assignment
  ownerId: varchar("owner_id").references(() => users.id),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User-drawn roof polygons for manual roof area estimation
export const roofPolygons = pgTable("roof_polygons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  siteId: varchar("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  
  // Polygon name/label (e.g., "Main Building", "Warehouse Section A")
  label: text("label"),
  
  // GeoJSON coordinates array: [[lng, lat], [lng, lat], ...] forming a closed polygon
  coordinates: jsonb("coordinates").notNull(), // Array of [longitude, latitude] pairs
  
  // Calculated area in square meters
  areaSqM: real("area_sq_m").notNull(),
  
  // Visual styling
  color: text("color").default("#0d9488"), // Teal by default
  
  // Metadata
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Google Solar API response cache - reduces API calls and speeds up lookups
export const googleSolarCache = pgTable("google_solar_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Location key - rounded to 5 decimal places (~1m precision)
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  
  // Raw Google Solar API response (BuildingInsights JSON)
  buildingInsights: jsonb("building_insights").notNull(),
  
  // Extracted summary data for quick queries
  roofAreaSqM: real("roof_area_sq_m"),
  maxArrayAreaSqM: real("max_array_area_sq_m"),
  maxPanelCount: integer("max_panel_count"),
  maxSystemSizeKw: real("max_system_size_kw"),
  yearlyEnergyDcKwh: real("yearly_energy_dc_kwh"),
  imageryQuality: text("imagery_quality"), // "HIGH" | "MEDIUM" | "LOW"
  imageryDate: text("imagery_date"),
  
  // Cache metadata
  fetchedAt: timestamp("fetched_at").defaultNow(),
  expiresAt: timestamp("expires_at"), // Optional TTL
  hitCount: integer("hit_count").default(0), // Track cache usage
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
  // Qualification results (computed by system)
  qualificationScore: true,
  qualificationStatus: true,
  qualificationBlockers: true,
  qualificationNextSteps: true,
  qualifiedAt: true,
  qualifiedBy: true,
});

// Schema for qualification form data
export const qualificationFormSchema = z.object({
  estimatedMonthlyBill: z.number().nullable(),
  propertyRelationship: z.enum(["owner", "tenant_authorized", "tenant_pending", "tenant_no_auth", "unknown"]),
  landlordName: z.string().optional(),
  landlordEmail: z.string().email().optional().or(z.literal("")),
  landlordPhone: z.string().optional(),
  hasAuthorizationLetter: z.boolean().default(false),
  roofAge: z.enum(["new", "recent", "mature", "old", "unknown"]),
  roofAgeYearsApprox: z.number().optional(),
  roofCondition: z.enum(["excellent", "good", "needs_repair", "needs_replacement", "unknown"]),
  plannedRoofWorkNext5Years: z.boolean().default(false),
  plannedRoofWorkDescription: z.string().optional(),
  contactIsDecisionMaker: z.boolean().default(false),
  decisionMakerName: z.string().optional(),
  decisionMakerTitle: z.string().optional(),
  decisionMakerEmail: z.string().email().optional().or(z.literal("")),
  budgetReadiness: z.enum(["budget_allocated", "budget_possible", "budget_needed", "no_budget", "unknown"]),
  timelineUrgency: z.enum(["immediate", "this_year", "next_year", "exploring", "unknown"]),
  targetDecisionQuarter: z.string().optional(),
});

export type QualificationFormData = z.infer<typeof qualificationFormSchema>;

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
  createdAt: true,
  updatedAt: true,
});

export const insertPricingComponentSchema = createInsertSchema(pricingComponents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSupplierSchema = createInsertSchema(suppliers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPriceHistorySchema = createInsertSchema(priceHistory).omit({
  id: true,
  createdAt: true,
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

export const insertCompetitorProposalAnalysisSchema = createInsertSchema(competitorProposalAnalysis).omit({
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

// Construction Project Management schemas
export const insertConstructionProjectSchema = createInsertSchema(constructionProjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  actualStartDate: true,
  actualEndDate: true,
});

export const insertConstructionTaskSchema = createInsertSchema(constructionTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  actualStartDate: true,
  actualEndDate: true,
  blockedAt: true,
});

export const insertConstructionDailyLogSchema = createInsertSchema(constructionDailyLogs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  approvedAt: true,
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

// Partnerships schema
export const insertPartnershipSchema = createInsertSchema(partnerships).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRoofPolygonSchema = createInsertSchema(roofPolygons).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGoogleSolarCacheSchema = createInsertSchema(googleSolarCache).omit({
  id: true,
  fetchedAt: true,
  hitCount: true,
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

// Lightweight simulation run summary (excludes heavy JSON columns for faster loading)
export type SimulationRunSummary = Omit<SimulationRun, 'cashflows' | 'breakdown' | 'hourlyProfile' | 'peakWeekData' | 'sensitivity'>;

export type InsertDesign = z.infer<typeof insertDesignSchema>;
export type Design = typeof designs.$inferSelect;

export type InsertBomItem = z.infer<typeof insertBomItemSchema>;
export type BomItem = typeof bomItems.$inferSelect;

export type InsertComponentCatalog = z.infer<typeof insertComponentCatalogSchema>;
export type ComponentCatalog = typeof componentCatalog.$inferSelect;

export type InsertPricingComponent = z.infer<typeof insertPricingComponentSchema>;
export type PricingComponent = typeof pricingComponents.$inferSelect;

export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliers.$inferSelect;

export type InsertPriceHistory = z.infer<typeof insertPriceHistorySchema>;
export type PriceHistory = typeof priceHistory.$inferSelect;

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

export type InsertCompetitorProposalAnalysis = z.infer<typeof insertCompetitorProposalAnalysisSchema>;
export type CompetitorProposalAnalysis = typeof competitorProposalAnalysis.$inferSelect;

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

// Construction Project Management types
export type InsertConstructionProject = z.infer<typeof insertConstructionProjectSchema>;
export type ConstructionProject = typeof constructionProjects.$inferSelect;

export type InsertConstructionTask = z.infer<typeof insertConstructionTaskSchema>;
export type ConstructionTask = typeof constructionTasks.$inferSelect;

export type InsertConstructionDailyLog = z.infer<typeof insertConstructionDailyLogSchema>;
export type ConstructionDailyLog = typeof constructionDailyLogs.$inferSelect;

// Sales CRM types
export type InsertOpportunity = z.infer<typeof insertOpportunitySchema>;
export type Opportunity = typeof opportunities.$inferSelect;

export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;

export type InsertPartnership = z.infer<typeof insertPartnershipSchema>;
export type Partnership = typeof partnerships.$inferSelect;

export type InsertRoofPolygon = z.infer<typeof insertRoofPolygonSchema>;
export type RoofPolygon = typeof roofPolygons.$inferSelect;

export type InsertGoogleSolarCache = z.infer<typeof insertGoogleSolarCacheSchema>;
export type GoogleSolarCache = typeof googleSolarCache.$inferSelect;

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

// Construction Project Management extended types
export type ConstructionProjectWithDetails = ConstructionProject & {
  site: SiteWithClient;
  agreement: ConstructionAgreement;
  tasks?: ConstructionTask[];
  projectManager?: User;
};

export type ConstructionTaskWithProject = ConstructionTask & {
  project: ConstructionProject;
  assignedTo?: User;
};

export type ConstructionDailyLogWithProject = ConstructionDailyLog & {
  project: ConstructionProject;
  preparer?: User;
  approver?: User;
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
  solarYieldKWhPerKWp: number; // kWh/kWp/year - default 1100, based on racking config
  orientationFactor: number;   // 0-1 multiplier for roof orientation (1.0 = optimal south-facing)
  
  // Racking configuration (Jan 2026 - KB vs Opsun analysis)
  rackingSystemType?: RackingSystemType; // Racking system type - affects yield, bifacial gain, DC/AC ratio
  
  // Helioscope-inspired system modeling
  inverterLoadRatio: number;     // DC/AC ratio (ILR) - default 1.4, adjusted by racking config (1.2-1.6)
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
  
  // Yield source tracking for temperature correction
  // 'google' = from Google Solar API (weather-adjusted, skip temp correction)
  // 'manual' = analyst-entered value (apply temp correction)
  // 'default' = using baseline 1150 (apply temp correction)
  yieldSource?: 'google' | 'manual' | 'default';
  
  // HQ Net Metering surplus compensation rate (April 2025)
  // Source: HQ Grille tarifaire avril 2025 - Compensation at average cost of supply
  // NOT client's energy tariff rate - HQ compensates at cost of supply after 24-month bank reset
  hqSurplusCompensationRate?: number;  // $/kWh - default 0.0460 (4.60¢/kWh)
}

// Default analysis assumptions
export const defaultAnalysisAssumptions: AnalysisAssumptions = {
  tariffCode: "M", // Default to Medium Power tariff
  tariffEnergy: 0.06061, // Tarif M 2025: 6.061¢/kWh (tier 1)
  tariffPower: 17.573, // Tarif M 2025: $17.573/kW
  solarYieldKWhKWp: 1100, // Quebec field data: 1000-1150 kWh/kWp depending on racking (see RackingConfig)
  solarYieldKWhPerKWp: 1100, // Alias for backward compatibility
  orientationFactor: 1.0, // 1.0 = optimal south-facing, reduced for E/W orientations
  
  // Racking system configuration (new - Jan 2026)
  rackingSystemType: 'kb_10_low' as RackingSystemType, // Default to KB Racking 10° low profile
  
  // Helioscope-inspired system modeling defaults
  inverterLoadRatio: 1.4, // DC/AC ratio - adjusted based on bifacial gain (1.2-1.6)
  temperatureCoefficient: -0.004, // -0.4%/°C typical for crystalline Si
  wireLossPercent: 0.0, // 0% for free analysis stage (re-enable for detailed design)
  degradationRatePercent: 0.005, // 0.5% annual degradation
  
  // Updated Feb 2026 - realistic 25-year assumptions
  // Historic Quebec rates: 2.6-3.5% CAGR over 20 years
  inflationRate: 0.035, // 3.5% HQ tariff inflation (realistic long-term)
  discountRate: 0.07, // 7% WACC (midpoint of 6-8% range)
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
  
  // Yield source tracking - controls temperature correction logic
  // 'google' = skip temp correction (already weather-adjusted)
  // 'manual' or 'default' = apply temp correction
  yieldSource: 'default' as const,
  
  // HQ Net Metering surplus compensation (April 2025+)
  // Source: HQ Grille tarifaire avril 2025 - Coût moyen d'approvisionnement
  // After 24-month bank reset, surplus kWh compensated at this rate (NOT client tariff)
  hqSurplusCompensationRate: 0.0460, // 4.60¢/kWh (HQ cost of supply April 2025)
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
  
  // Sweep source for hybrid points (for visual distinction)
  // 'pvSweep' = varies PV at fixed battery, 'battSweep' = varies battery at fixed PV
  sweepSource?: 'pvSweep' | 'battSweep';
  
  // Extended KPI fields (populated only for optimal scenario)
  annualSavings?: number;
  irr25?: number;
  simplePaybackYears?: number;
  totalProductionKWh?: number;
  selfSufficiencyPercent?: number;
  co2AvoidedTonnesPerYear?: number;
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

export interface ScenarioBreakdown {
  capexSolar: number;
  capexBattery: number;
  capexGross: number;
  actualHQSolar: number;
  actualHQBattery: number;
  itcAmount: number;
  taxShield: number;
  totalExportedKWh: number;
  annualSurplusRevenue: number;
  estimatedAnnualBillBefore: number;
  estimatedAnnualBillAfter: number;
  lcoe: number;
  peakDemandAfterKW: number;
  annualEnergySavingsKWh: number;
  cashflows: Array<{ year: number; netCashflow: number }>;
}

// Optimal scenario for a specific objective
export interface OptimalScenario {
  id: string;
  pvSizeKW: number;
  battEnergyKWh: number;
  battPowerKW: number;
  capexNet: number;
  npv25: number;
  irr25: number;
  simplePaybackYears: number;
  selfSufficiencyPercent: number;
  annualSavings: number;
  totalProductionKWh: number;
  co2AvoidedTonnesPerYear: number;
  scenarioBreakdown?: ScenarioBreakdown;
}

// Multi-objective optimization results
export interface OptimalScenarios {
  bestNPV: OptimalScenario | null;      // Maximum NPV25
  bestIRR: OptimalScenario | null;       // Maximum IRR (with NPV > 0 constraint)
  maxSelfSufficiency: OptimalScenario | null;  // Maximum self-consumption %
}

// Complete sensitivity analysis result
export interface SensitivityAnalysis {
  frontier: FrontierPoint[];        // Efficiency frontier scatter points
  solarSweep: SolarSweepPoint[];    // Solar optimization curve
  batterySweep: BatterySweepPoint[]; // Battery optimization curve
  optimalScenarioId: string | null;  // ID of the optimal scenario
  optimalScenarios?: OptimalScenarios; // Multi-objective optimization results
}

// ==================== RACKING CONFIGURATION ====================

/**
 * Racking system types with production and bifacial characteristics
 * Based on analysis by James Pagonis (Scale) and Mike Perrault (Rematek) - Jan 2026
 */
export type RackingSystemType = 
  | 'kb_10_low'      // KB Racking 10° landscape, low profile (standard)
  | 'opsun_10'       // Opsun 10° standard profile
  | 'opsun_15_high'  // Opsun 15° high profile (12")
  | 'opsun_20_high'  // Opsun 20° high profile (18") - recommended for bifacial
  | 'opsun_25_high'  // Opsun 25° high profile
  | 'custom';        // Custom configuration

export interface RackingConfig {
  type: RackingSystemType;
  angle: number;                    // Tilt angle in degrees
  profile: 'low' | 'standard' | 'high';  // Height above roof
  profileHeightInches: number;      // Approximate height above roof
  manufacturer: string;
  pricePerWatt: number;             // $/W for racking only
  ballastPerWatt: number;           // $/W for ballast
  densityFactor: number;            // 1.0 = baseline, <1 = fewer panels fit
  bifacialGainPercent: number;      // 0-20% additional production from bifacial
  baseYieldKWhKWp: number;          // Base production without bifacial (Quebec)
  effectiveYieldKWhKWp: number;     // With bifacial gain applied
  recommendedDcAcRatio: number;     // Recommended DC/AC ratio
  description: { fr: string; en: string };
}

/**
 * Get racking configuration by system type
 * Production values based on Quebec field data (6 installations - Mike Perrault)
 */
export function getRackingConfig(type: RackingSystemType): RackingConfig {
  switch (type) {
    case 'kb_10_low':
      return {
        type: 'kb_10_low',
        angle: 10,
        profile: 'low',
        profileHeightInches: 4,
        manufacturer: 'KB Racking',
        pricePerWatt: 0.19,
        ballastPerWatt: 0.03,
        densityFactor: 1.0,           // Baseline - highest density
        bifacialGainPercent: 0,       // Low profile = minimal bifacial benefit
        baseYieldKWhKWp: 1000,        // Quebec field data for 10° low profile
        effectiveYieldKWhKWp: 1000,   // No bifacial gain
        recommendedDcAcRatio: 1.6,
        description: {
          fr: 'KB Racking 10° paysage, profil bas - Densité maximale, coût minimal',
          en: 'KB Racking 10° landscape, low profile - Maximum density, lowest cost'
        }
      };
    case 'opsun_10':
      return {
        type: 'opsun_10',
        angle: 10,
        profile: 'standard',
        profileHeightInches: 8,
        manufacturer: 'Opsun Systems',
        pricePerWatt: 0.34,
        ballastPerWatt: 0.02,
        densityFactor: 0.99,
        bifacialGainPercent: 5,
        baseYieldKWhKWp: 1000,
        effectiveYieldKWhKWp: 1050,
        recommendedDcAcRatio: 1.5,
        description: {
          fr: 'Opsun 10° standard - Compromis densité/production',
          en: 'Opsun 10° standard - Density/production compromise'
        }
      };
    case 'opsun_15_high':
      return {
        type: 'opsun_15_high',
        angle: 15,
        profile: 'high',
        profileHeightInches: 12,
        manufacturer: 'Opsun Systems',
        pricePerWatt: 0.37,
        ballastPerWatt: 0.02,
        densityFactor: 0.87,          // ~13% fewer panels
        bifacialGainPercent: 12,
        baseYieldKWhKWp: 1100,
        effectiveYieldKWhKWp: 1232,   // 1100 * 1.12
        recommendedDcAcRatio: 1.35,
        description: {
          fr: 'Opsun 15° haut profil (12") - Bon gain bifacial',
          en: 'Opsun 15° high profile (12") - Good bifacial gain'
        }
      };
    case 'opsun_20_high':
      return {
        type: 'opsun_20_high',
        angle: 20,
        profile: 'high',
        profileHeightInches: 18,
        manufacturer: 'Opsun Systems',
        pricePerWatt: 0.39,
        ballastPerWatt: 0.03,
        densityFactor: 0.79,          // ~21% fewer panels
        bifacialGainPercent: 17.5,
        baseYieldKWhKWp: 1140,
        effectiveYieldKWhKWp: 1340,   // 1140 * 1.175
        recommendedDcAcRatio: 1.2,
        description: {
          fr: 'Opsun 20° haut profil (18") - Recommandé pour bifacial (meilleur ROI)',
          en: 'Opsun 20° high profile (18") - Recommended for bifacial (best ROI)'
        }
      };
    case 'opsun_25_high':
      return {
        type: 'opsun_25_high',
        angle: 25,
        profile: 'high',
        profileHeightInches: 20,
        manufacturer: 'Opsun Systems',
        pricePerWatt: 0.47,
        ballastPerWatt: 0.03,
        densityFactor: 0.75,          // ~25% fewer panels
        bifacialGainPercent: 20,
        baseYieldKWhKWp: 1150,
        effectiveYieldKWhKWp: 1380,   // 1150 * 1.20
        recommendedDcAcRatio: 1.15,
        description: {
          fr: 'Opsun 25° haut profil - Gain bifacial maximum, densité réduite',
          en: 'Opsun 25° high profile - Maximum bifacial gain, reduced density'
        }
      };
    case 'custom':
    default:
      return {
        type: 'custom',
        angle: 10,
        profile: 'low',
        profileHeightInches: 4,
        manufacturer: 'Custom',
        pricePerWatt: 0.25,
        ballastPerWatt: 0.03,
        densityFactor: 1.0,
        bifacialGainPercent: 0,
        baseYieldKWhKWp: 1100,
        effectiveYieldKWhKWp: 1100,
        recommendedDcAcRatio: 1.6,
        description: {
          fr: 'Configuration personnalisée',
          en: 'Custom configuration'
        }
      };
  }
}

/**
 * Get all available racking configurations for comparison
 */
export function getAllRackingConfigs(): RackingConfig[] {
  return [
    getRackingConfig('kb_10_low'),
    getRackingConfig('opsun_10'),
    getRackingConfig('opsun_15_high'),
    getRackingConfig('opsun_20_high'),
    getRackingConfig('opsun_25_high'),
  ];
}

// ==================== BIFACIAL CONFIGURATION BY ROOF COLOR ====================

/**
 * Roof color types for bifacial panel recommendations
 * White/light roofs reflect more sunlight = higher boost from bifacial panels
 */
export type RoofColorType = 'white_membrane' | 'light' | 'dark' | 'gravel' | 'unknown';

export interface BifacialConfig {
  boost: number;           // Multiplier (1.0 = no boost, 1.15 = 15% boost)
  albedo: number;          // Roof reflectivity (0-1)
  recommended: boolean;    // Whether bifacial panels are recommended
  boostPercent: number;    // Human-readable boost percentage (0, 5, 10, 15)
  reason: { fr: string; en: string };
}

/**
 * Get bifacial configuration based on roof color type
 * Only recommends bifacial for light-colored roofs with high albedo
 * 
 * This is a shared utility used by both frontend and backend
 */
export function getBifacialConfigFromRoofColor(roofColorType: RoofColorType | string | null | undefined): BifacialConfig {
  switch (roofColorType) {
    case 'white_membrane':
      return {
        boost: 1.15,
        boostPercent: 15,
        albedo: 0.70,
        recommended: true,
        reason: {
          fr: 'Membrane blanche détectée (albédo ~70%) - Bifacial recommandé (+15%)',
          en: 'White membrane detected (albedo ~70%) - Bifacial recommended (+15%)'
        }
      };
    case 'light':
      return {
        boost: 1.10,
        boostPercent: 10,
        albedo: 0.50,
        recommended: true,
        reason: {
          fr: 'Toiture claire détectée (albédo ~50%) - Bifacial recommandé (+10%)',
          en: 'Light roof detected (albedo ~50%) - Bifacial recommended (+10%)'
        }
      };
    case 'gravel':
      return {
        boost: 1.05,
        boostPercent: 5,
        albedo: 0.30,
        recommended: false,
        reason: {
          fr: 'Gravier détecté (albédo ~30%) - Bifacial optionnel (+5%)',
          en: 'Gravel detected (albedo ~30%) - Bifacial optional (+5%)'
        }
      };
    case 'dark':
      return {
        boost: 1.00,
        boostPercent: 0,
        albedo: 0.15,
        recommended: false,
        reason: {
          fr: 'Toiture foncée détectée (albédo ~15%) - Panneaux standards recommandés',
          en: 'Dark roof detected (albedo ~15%) - Standard panels recommended'
        }
      };
    case 'unknown':
    default:
      return {
        boost: 1.00,
        boostPercent: 0,
        albedo: 0.20,
        recommended: false,
        reason: {
          fr: 'Couleur de toiture non analysée - Inspecter le site pour recommandation',
          en: 'Roof color not analyzed - Site inspection needed for recommendation'
        }
      };
  }
}
