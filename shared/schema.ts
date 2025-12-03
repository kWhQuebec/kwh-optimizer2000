import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("admin"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  city: text("city"),
  province: text("province"),
  estimatedMonthlyBill: real("estimated_monthly_bill"),
  buildingType: text("building_type"),
  notes: text("notes"),
  source: text("source").default("web_form"),
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
  pvSizeKW: real("pv_size_kw"),
  battEnergyKWh: real("batt_energy_kwh"),
  battPowerKW: real("batt_power_kw"),
  demandShavingSetpointKW: real("demand_shaving_setpoint_kw"),
  annualConsumptionKWh: real("annual_consumption_kwh"),
  annualEnergySavingsKWh: real("annual_energy_savings_kwh"),
  annualDemandReductionKW: real("annual_demand_reduction_kw"),
  annualCostBefore: real("annual_cost_before"),
  annualCostAfter: real("annual_cost_after"),
  annualSavings: real("annual_savings"),
  npv20: real("npv_20"),
  irr20: real("irr_20"),
  npv10: real("npv_10"),
  irr10: real("irr_10"),
  simplePaybackYears: real("simple_payback_years"),
  capexNet: real("capex_net"),
  co2AvoidedTonnesPerYear: real("co2_avoided_tonnes_per_year"),
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

// Extended types for frontend
export type SiteWithClient = Site & { client: Client };
export type SimulationRunWithSite = SimulationRun & { site: SiteWithClient };
export type DesignWithBom = Design & { bomItems: BomItem[] };
