import {
  pgTable,
  text,
  varchar,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// These imports are assumed to exist in the main schema.ts
// import { users, clients, opportunities, constructionProjects } from "./schema";

// ============================================
// GAMIFICATION SYSTEM
// ============================================

// Activity log for stage transitions (audit trail)
export const stageTransitionLogs = pgTable("stage_transition_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: text("entity_type").notNull(), // "opportunity" | "construction_project" | "lead"
  entityId: varchar("entity_id").notNull(),
  fromStage: text("from_stage"),
  toStage: text("to_stage").notNull(),
  changedBy: varchar("changed_by"), // references users.id (soft reference)
  notes: text("notes"),
  metadata: jsonb("metadata"), // any extra context
  createdAt: timestamp("created_at").defaultNow(),
});

// Gamification profiles
export const gamificationProfiles = pgTable("gamification_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"), // references users.id (soft reference)
  clientId: varchar("client_id"), // references clients.id (soft reference)
  profileType: text("profile_type").notNull(), // "account_manager" | "client"
  displayName: text("display_name").notNull(),
  totalPoints: integer("total_points").default(0),
  level: text("level").default("bronze"), // "bronze" | "silver" | "gold" | "platinum"
  currentStreak: integer("current_streak").default(0), // consecutive weeks with activity
  longestStreak: integer("longest_streak").default(0),
  totalProjectsCompleted: integer("total_projects_completed").default(0),
  totalMWInstalled: real("total_mw_installed").default(0),
  totalCO2Avoided: real("total_co2_avoided").default(0),
  badges: jsonb("badges").default(sql`'[]'::jsonb`), // Array of badge IDs
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Missions linked to project stages
export const gamificationMissions = pgTable("gamification_missions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  opportunityId: varchar("opportunity_id"), // references opportunities.id (soft reference)
  constructionProjectId: varchar("construction_project_id"), // references constructionProjects.id (soft reference)
  missionNumber: integer("mission_number").notNull(), // 1-6
  title: text("title").notNull(),
  description: text("description"),
  stage: text("stage").notNull(), // linked pipeline stage
  status: text("status").default("locked"), // "locked" | "active" | "completed"
  pointsReward: integer("points_reward").default(0),
  bonusPointsEarned: integer("bonus_points_earned").default(0), // velocity bonus etc
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Individual tasks within missions
export const gamificationTasks = pgTable("gamification_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  missionId: varchar("mission_id")
    .notNull()
    .references(() => gamificationMissions.id, { onDelete: "cascade" }),
  assignedTo: text("assigned_to").notNull(), // "client" | "account_manager"
  title: text("title").notNull(),
  description: text("description"),
  pointsReward: integer("points_reward").default(0),
  completed: boolean("completed").default(false),
  completedAt: timestamp("completed_at"),
  completedBy: varchar("completed_by"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Badge unlocks
export const gamificationBadges = pgTable("gamification_badges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id")
    .notNull()
    .references(() => gamificationProfiles.id, { onDelete: "cascade" }),
  badgeType: text("badge_type").notNull(), // e.g. "energy_explorer", "solar_architect", etc.
  badgeName: text("badge_name").notNull(),
  badgeIcon: text("badge_icon").notNull(), // emoji
  badgeDescription: text("badge_description"),
  projectId: varchar("project_id"), // which project triggered it
  unlockedAt: timestamp("unlocked_at").defaultNow(),
});

// Points event log
export const gamificationEvents = pgTable("gamification_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id")
    .notNull()
    .references(() => gamificationProfiles.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // "mission_completed" | "task_completed" | "badge_unlocked" | "referral" | "velocity_bonus"
  points: integer("points").notNull(),
  description: text("description"),
  opportunityId: varchar("opportunity_id"),
  missionId: varchar("mission_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Virtual power plant aggregate stats
export const virtualPowerPlant = pgTable("virtual_power_plant", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  totalInstalledMW: real("total_installed_mw").default(0),
  totalProjectsCompleted: integer("total_projects_completed").default(0),
  totalProjectsInProgress: integer("total_projects_in_progress").default(0),
  totalPanelCount: integer("total_panel_count").default(0),
  totalKWhProduced: real("total_kwh_produced").default(0),
  totalCO2AvoidedTonnes: real("total_co2_avoided_tonnes").default(0),
  totalSavingsDollars: real("total_savings_dollars").default(0),
  equivalentHomesP: integer("equivalent_homes_powered").default(0),
  equivalentCarsRemoved: integer("equivalent_cars_removed").default(0),
  lastUpdatedAt: timestamp("last_updated_at").defaultNow(),
});

// Payment milestones per project
export const paymentMilestones = pgTable("payment_milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  opportunityId: varchar("opportunity_id"), // references opportunities.id (soft reference)
  constructionProjectId: varchar("construction_project_id"), // references constructionProjects.id (soft reference)
  milestoneName: text("milestone_name").notNull(), // "Mandat conception" | "Design" | "Approvisionnement" | "Installation" | "Commissioning"
  amount: real("amount").notNull(),
  percentage: real("percentage"), // % of total contract
  status: text("status").default("pending"), // "pending" | "invoiced" | "paid" | "overdue"
  dueDate: timestamp("due_date"),
  paidDate: timestamp("paid_date"),
  invoiceNumber: text("invoice_number"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  notes: text("notes"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================
// INSERT SCHEMAS & TYPES
// ============================================

export const insertStageTransitionLogSchema = createInsertSchema(
  stageTransitionLogs
).omit({ id: true, createdAt: true });
export type StageTransitionLog = typeof stageTransitionLogs.$inferSelect;

export const insertGamificationProfileSchema = createInsertSchema(
  gamificationProfiles
).omit({ id: true, createdAt: true, updatedAt: true });
export type GamificationProfile = typeof gamificationProfiles.$inferSelect;

export const insertGamificationMissionSchema = createInsertSchema(
  gamificationMissions
).omit({ id: true, createdAt: true });
export type GamificationMission = typeof gamificationMissions.$inferSelect;

export const insertGamificationTaskSchema = createInsertSchema(
  gamificationTasks
).omit({ id: true, createdAt: true });
export type GamificationTask = typeof gamificationTasks.$inferSelect;

export const insertGamificationBadgeSchema = createInsertSchema(
  gamificationBadges
).omit({ id: true, unlockedAt: true });
export type GamificationBadge = typeof gamificationBadges.$inferSelect;

export const insertGamificationEventSchema = createInsertSchema(
  gamificationEvents
).omit({ id: true, createdAt: true });
export type GamificationEvent = typeof gamificationEvents.$inferSelect;

export const insertPaymentMilestoneSchema = createInsertSchema(
  paymentMilestones
).omit({ id: true, createdAt: true, updatedAt: true });
export type PaymentMilestone = typeof paymentMilestones.$inferSelect;

export type VirtualPowerPlant = typeof virtualPowerPlant.$inferSelect;
