/**
 * Gamification Engine — kWh Québec
 * Handles: mission creation, task tracking, points, badges, velocity bonuses
 * Triggered by stage transitions in the pipeline
 */

import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";
import {
  gamificationProfiles,
  gamificationMissions,
  gamificationTasks,
  gamificationBadges,
  gamificationEvents,
  virtualPowerPlant,
  stageTransitionLogs,
  opportunities,
  constructionProjects,
} from "../shared/schema";

// Badge definitions
export const BADGE_DEFINITIONS = {
  // Client badges
  energy_explorer: {
    name: "Explorateur Énergie",
    icon: "🔍",
    description: "A complété l'analyse de consommation",
  },
  solar_architect: {
    name: "Architecte Solaire",
    icon: "📐",
    description: "A approuvé le design VC0",
  },
  green_committed: {
    name: "Engagé Vert",
    icon: "✍️",
    description: "A signé le contrat",
  },
  producer: {
    name: "Producteur",
    icon: "⚡",
    description: "Système connecté au réseau",
  },
  ambassador: {
    name: "Ambassadeur",
    icon: "🌍",
    description: "A référé un nouveau client",
  },
  power_partner_gold: {
    name: "Power Partner Gold",
    icon: "🏆",
    description: "3+ projets ou références",
  },
  // AM badges
  expert_qualifier: {
    name: "Qualificateur Expert",
    icon: "🎯",
    description: "10 leads qualifiés green en 1 mois",
  },
  velocity: {
    name: "Vélocité",
    icon: "⚡",
    description: "Deal fermé en < 30 jours",
  },
  builder: {
    name: "Bâtisseur",
    icon: "🏗️",
    description: "5 projets livrés",
  },
  data_master: {
    name: "Data Master",
    icon: "📊",
    description: "Scorecard 100% vert 4 semaines",
  },
  closer: {
    name: "Closer",
    icon: "🤝",
    description: "Taux conversion > 40%",
  },
  mw_club: {
    name: "MW Club",
    icon: "☀️",
    description: "1 MW+ cumulatif",
  },
} as const;

// Mission templates per stage
export const MISSION_TEMPLATES = [
  {
    missionNumber: 1,
    title: "Analyse rapide",
    stage: "qualified",
    pointsReward: 325,
    clientTasks: [
      { title: "Sélectionner le type de bâtiment", points: 25 },
      { title: "Estimer la superficie de toiture", points: 25 },
      { title: "Uploader sa facture Hydro-Québec", points: 50 },
      { title: "Fournir consommation annuelle estimée", points: 25 },
      { title: "Booker un appel découverte", points: 50 },
    ],
    amTasks: [
      { title: "Valider le parsing AI de la facture", points: 25 },
      { title: "Qualifier le lead (4 portes)", points: 50 },
      { title: "Préparer l'analyse préliminaire", points: 25 },
      { title: "Compléter l'appel dans les 48h", points: 50 },
    ],
  },
  {
    missionNumber: 2,
    title: "Validation économique",
    stage: "design_mandate_signed",
    pointsReward: 750,
    clientTasks: [
      { title: "Lire la proposition préliminaire", points: 50 },
      { title: "Poser au moins 1 question", points: 50 },
      { title: "Signer la procuration Hydro-Québec", points: 100 },
      { title: "Signer le mandat + verser le dépôt", points: 200 },
    ],
    amTasks: [
      { title: "Envoyer la proposition < 3 jours", points: 100 },
      { title: "Répondre aux questions < 24h", points: 50 },
      { title: "Soumettre procuration à HQ", points: 50 },
      { title: "Confirmer réception + créer fiche CRM", points: 50 },
    ],
  },
  {
    missionNumber: 3,
    title: "Validation technique",
    stage: "epc_proposal_sent",
    pointsReward: 500,
    clientTasks: [
      { title: "Donner accès au site", points: 50 },
      { title: "Fournir plans de toiture", points: 50 },
      { title: "Consulter le rapport VC0", points: 50 },
      { title: "Valider les hypothèses de production", points: 50 },
    ],
    amTasks: [
      { title: "Coordonner visite avec Rematek", points: 50 },
      { title: "Suivre la progression du VC0", points: 50 },
      { title: "Importer VC0 dans la plateforme", points: 50 },
      { title: "Calibrer CashflowEngine avec VC0", points: 50 },
    ],
  },
  {
    missionNumber: 4,
    title: "Ingénierie & design final",
    stage: "won_to_be_delivered",
    pointsReward: 1000,
    clientTasks: [
      { title: "Recevoir la proposition EPC complète", points: 50 },
      { title: "Comparer les scénarios financiers", points: 100 },
      { title: "Reviewer le rapport d'ingénierie", points: 100 },
      { title: "Approuver le design final ou avenant", points: 250 },
    ],
    amTasks: [
      { title: "Générer proposition 3 scénarios", points: 100 },
      { title: "Coordonner rapport d'ingénieur", points: 100 },
      { title: "Préparer avenant si requis", points: 100 },
      { title: "Obtenir GO final + permis confirmés", points: 250 },
    ],
  },
  {
    missionNumber: 5,
    title: "Construction",
    stage: "won_in_construction",
    pointsReward: 2000,
    clientTasks: [
      { title: "Confirmer dates d'accès au site", points: 100 },
      { title: "Valider checklist pré-installation", points: 100 },
      { title: "Consulter photos quotidiennes", points: 100 },
      { title: "Être présent à l'inspection finale", points: 100 },
      { title: "Activer son compte monitoring", points: 100 },
    ],
    amTasks: [
      { title: "Commander matériel (Jinko + Kaco)", points: 100 },
      { title: "Valider réception matériel", points: 100 },
      { title: "Upload photos + daily log", points: 100 },
      { title: "Compléter inspection", points: 100 },
      { title: "Configurer monitoring API", points: 100 },
    ],
  },
  {
    missionNumber: 6,
    title: "Opération",
    stage: "won_delivered",
    pointsReward: 2000,
    clientTasks: [
      { title: "Consulter dashboard production (hebdo)", points: 100 },
      { title: "Partager résultats sur LinkedIn", points: 200 },
      { title: "Référer 1 contact intéressé", points: 500 },
      { title: "Évaluer l'expérience kWh (NPS)", points: 100 },
    ],
    amTasks: [
      { title: "Envoyer rapport 90 jours", points: 200 },
      { title: "Demander le témoignage", points: 100 },
      { title: "Qualifier la référence < 48h", points: 200 },
      { title: "Documenter le cas portfolio", points: 200 },
    ],
  },
];

// Point thresholds for levels
const LEVEL_THRESHOLDS = {
  bronze: 0,
  silver: 5000,
  gold: 15000,
  platinum: 50000,
};

/**
 * Log a stage transition (audit trail)
 */
export async function logStageTransition(
  entityType: string,
  entityId: string,
  fromStage: string | null,
  toStage: string,
  changedBy?: string,
  notes?: string
): Promise<void> {
  await db.insert(stageTransitionLogs).values({
    entityType,
    entityId,
    fromStage,
    toStage,
    changedBy,
    notes,
  });
}

/**
 * Create missions for a new opportunity
 */
export async function createMissionsForOpportunity(
  opportunityId: string
): Promise<void> {
  for (const template of MISSION_TEMPLATES) {
    const [mission] = await db
      .insert(gamificationMissions)
      .values({
        opportunityId,
        missionNumber: template.missionNumber,
        title: template.title,
        stage: template.stage,
        status: template.missionNumber === 1 ? "active" : "locked",
        pointsReward: template.pointsReward,
      })
      .returning();

    // Create tasks
    const allTasks = [
      ...template.clientTasks.map((t, i) => ({
        ...t,
        assignedTo: "client" as const,
        sortOrder: i,
      })),
      ...template.amTasks.map((t, i) => ({
        ...t,
        assignedTo: "account_manager" as const,
        sortOrder: i,
      })),
    ];

    for (const task of allTasks) {
      await db.insert(gamificationTasks).values({
        missionId: mission.id,
        assignedTo: task.assignedTo,
        title: task.title,
        pointsReward: task.points,
        sortOrder: task.sortOrder,
      });
    }
  }
}

/**
 * Called when an opportunity changes stage
 */
export async function onOpportunityStageChange(
  opportunityId: string,
  fromStage: string,
  toStage: string,
  changedBy?: string
): Promise<void> {
  // 1. Log the transition
  await logStageTransition("opportunity", opportunityId, fromStage, toStage, changedBy);

  // 2. Complete the mission for the previous stage and unlock next
  const missions = await db
    .select()
    .from(gamificationMissions)
    .where(eq(gamificationMissions.opportunityId, opportunityId));

  for (const mission of missions) {
    if (mission.stage === fromStage && mission.status === "active") {
      // Complete this mission
      await db
        .update(gamificationMissions)
        .set({
          status: "completed",
          completedAt: new Date(),
        })
        .where(eq(gamificationMissions.id, mission.id));
    }
    if (mission.stage === toStage && mission.status === "locked") {
      // Unlock this mission
      await db
        .update(gamificationMissions)
        .set({
          status: "active",
          startedAt: new Date(),
        })
        .where(eq(gamificationMissions.id, mission.id));
    }
  }

  // 3. Award points and check badges based on new stage
  await checkAndAwardBadges(opportunityId, toStage);
}

/**
 * Award points to a profile
 */
export async function awardPoints(
  profileId: string,
  points: number,
  action: string,
  description: string,
  opportunityId?: string,
  missionId?: string
): Promise<void> {
  // Log the event
  await db.insert(gamificationEvents).values({
    profileId,
    action,
    points,
    description,
    opportunityId,
    missionId,
  });

  // Update total points
  await db
    .update(gamificationProfiles)
    .set({
      totalPoints: sql`${gamificationProfiles.totalPoints} + ${points}`,
      updatedAt: new Date(),
    })
    .where(eq(gamificationProfiles.id, profileId));

  // Check level up
  const profile = await db
    .select()
    .from(gamificationProfiles)
    .where(eq(gamificationProfiles.id, profileId));

  if (profile && profile.length > 0) {
    const p = profile[0];
    const newTotal = p.totalPoints + points;
    let newLevel = "bronze";
    if (newTotal >= LEVEL_THRESHOLDS.platinum) newLevel = "platinum";
    else if (newTotal >= LEVEL_THRESHOLDS.gold) newLevel = "gold";
    else if (newTotal >= LEVEL_THRESHOLDS.silver) newLevel = "silver";

    if (newLevel !== p.level) {
      await db
        .update(gamificationProfiles)
        .set({ level: newLevel })
        .where(eq(gamificationProfiles.id, profileId));
    }
  }
}

/**
 * Check and award badges based on stage
 */
async function checkAndAwardBadges(
  opportunityId: string,
  stage: string
): Promise<void> {
  // Stage-based badge mapping
  const stageBadges: Record<
    string,
    { badge: keyof typeof BADGE_DEFINITIONS; for: "client" | "account_manager" }
  > = {
    qualified: { badge: "energy_explorer", for: "client" },
    design_mandate_signed: { badge: "solar_architect", for: "client" },
    won_to_be_delivered: { badge: "green_committed", for: "client" },
    won_delivered: { badge: "producer", for: "client" },
  };

  const badgeInfo = stageBadges[stage];
  if (!badgeInfo) return;

  // Find the relevant profile and award badge
  const opp = await db
    .select()
    .from(opportunities)
    .where(eq(opportunities.id, opportunityId));

  if (!opp || opp.length === 0) return;

  const opportunity = opp[0];
  const profileValue =
    badgeInfo.for === "client" ? opportunity.clientId : opportunity.ownerId;
  if (!profileValue) return;

  const profiles = await db
    .select()
    .from(gamificationProfiles)
    .where(
      badgeInfo.for === "client"
        ? eq(gamificationProfiles.clientId, profileValue)
        : eq(gamificationProfiles.userId, profileValue)
    );

  if (profiles.length === 0) return;
  const profile = profiles[0];

  // Check if badge already exists
  const existingBadges = await db
    .select()
    .from(gamificationBadges)
    .where(
      and(
        eq(gamificationBadges.profileId, profile.id),
        eq(gamificationBadges.badgeType, badgeInfo.badge)
      )
    );

  if (existingBadges.length === 0) {
    const def = BADGE_DEFINITIONS[badgeInfo.badge];
    await db.insert(gamificationBadges).values({
      profileId: profile.id,
      badgeType: badgeInfo.badge,
      badgeName: def.name,
      badgeIcon: def.icon,
      badgeDescription: def.description,
      projectId: opportunityId,
    });
  }
}

/**
 * Get or create gamification profile
 */
export async function getOrCreateProfile(
  type: "account_manager" | "client",
  userId?: string,
  clientId?: string,
  displayName?: string
) {
  const condition =
    type === "account_manager"
      ? eq(gamificationProfiles.userId, userId!)
      : eq(gamificationProfiles.clientId, clientId!);

  const existing = await db
    .select()
    .from(gamificationProfiles)
    .where(condition);

  if (existing.length > 0) return existing[0];

  const profile = await db
    .insert(gamificationProfiles)
    .values({
      userId: type === "account_manager" ? userId : null,
      clientId: type === "client" ? clientId : null,
      profileType: type,
      displayName: displayName || "Unknown",
    })
    .returning();

  return profile[0];
}

/**
 * Update virtual power plant stats
 */
export async function updateVirtualPowerPlant(): Promise<void> {
  // Count completed projects
  const completedProjects = await db
    .select({ count: sql<number>`count(*)::integer` })
    .from(constructionProjects)
    .where(eq(constructionProjects.status, "completed"));

  const inProgressProjects = await db
    .select({ count: sql<number>`count(*)::integer` })
    .from(constructionProjects)
    .where(eq(constructionProjects.status, "in_progress"));

  // Sum installed MW from won_delivered opportunities
  const installedMW = await db
    .select({
      total: sql<number>`coalesce(sum(pv_size_kw), 0) / 1000`,
    })
    .from(opportunities)
    .where(eq(opportunities.stage, "won_delivered"));

  const totalMW = Number(installedMW[0]?.total) || 0;
  const totalCompleted = Number(completedProjects[0]?.count) || 0;
  const totalInProgress = Number(inProgressProjects[0]?.count) || 0;

  // Calculate environmental impact
  // Quebec: ~1030 kWh/kWc/year, grid factor ~1.2g CO2/kWh (very clean)
  // But displaces marginal generation: ~400g CO2/kWh
  const totalKWhPerYear = totalMW * 1000 * 1030; // kW * kWh/kWc
  const co2AvoidedTonnes = totalKWhPerYear * 0.0004; // 400g/kWh in tonnes
  const equivalentHomes = Math.round(totalKWhPerYear / 20000); // avg QC home ~20,000 kWh
  const equivalentCars = Math.round(co2AvoidedTonnes / 4.6); // avg car ~4.6 tonnes/year

  // Upsert the singleton row
  const existing = await db.select().from(virtualPowerPlant);
  if (existing.length === 0) {
    await db.insert(virtualPowerPlant).values({
      totalInstalledMW: totalMW,
      totalProjectsCompleted: totalCompleted,
      totalProjectsInProgress: totalInProgress,
      totalKWhProduced: totalKWhPerYear,
      totalCO2AvoidedTonnes: co2AvoidedTonnes,
      equivalentHomesP: equivalentHomes,
      equivalentCarsRemoved: equivalentCars,
      lastUpdatedAt: new Date(),
    });
  } else {
    await db
      .update(virtualPowerPlant)
      .set({
        totalInstalledMW: totalMW,
        totalProjectsCompleted: totalCompleted,
        totalProjectsInProgress: totalInProgress,
        totalKWhProduced: totalKWhPerYear,
        totalCO2AvoidedTonnes: co2AvoidedTonnes,
        equivalentHomesP: equivalentHomes,
        equivalentCarsRemoved: equivalentCars,
        lastUpdatedAt: new Date(),
      })
      .where(eq(virtualPowerPlant.id, existing[0].id));
  }
}
