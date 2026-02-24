/**
 * Workflow Sync Logic — kWh Québec
 * Handles synchronization between leads, opportunities, and construction projects
 * Called from pipelineRepo when opportunities change stage
 *
 * INTEGRATION NOTES:
 * In pipelineRepo.ts, after updating opportunity stage, call:
 *   await syncOpportunityChanges(opportunityId, oldStage, newStage, userId);
 *
 * This will handle:
 * - Lead ↔ Opportunity sync
 * - Auto-create construction project at won_to_be_delivered
 * - Velocity tracking (days between stages)
 * - Gamification mission updates
 */

import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";
import {
  opportunities,
  constructionProjects,
  leads,
  gamificationMissions,
  gamificationProfiles,
} from "../shared/schema";
import {
  onOpportunityStageChange,
  getOrCreateProfile,
  awardPoints,
} from "./gamificationEngine";

// Stage transitions that mark velocity milestones
const VELOCITY_MILESTONES = {
  qualified_to_design: { days: 7, points: 100, badge: "expert_qualifier" },
  design_to_proposal: { days: 14, points: 150 },
  proposal_to_won: { days: 30, points: 500, badge: "velocity" },
};

// Map opportunity stages to construction project statuses
const STAGE_TO_PROJECT_STATUS = {
  won_to_be_delivered: "pending",
  won_in_construction: "in_progress",
  won_delivered: "completed",
} as const;

/**
 * Sync opportunity changes: update leads, create projects, track velocity
 * Call this from pipelineRepo after changing opportunity stage
 */
export async function syncOpportunityChanges(
  opportunityId: string,
  oldStage: string | null,
  newStage: string,
  userId?: string
): Promise<void> {
  // 1. Get the opportunity
  const opp = await db
    .select()
    .from(opportunities)
    .where(eq(opportunities.id, opportunityId));

  if (opp.length === 0) {
    console.error(`Opportunity ${opportunityId} not found`);
    return;
  }

  const opportunity = opp[0];

  // 2. Sync lead status based on opportunity stage
  if (opportunity.leadId) {
    await syncLeadFromOpportunity(opportunity.leadId, newStage);
  }

  // 3. Auto-create construction project if reaching won_to_be_delivered
  if (
    newStage === "won_to_be_delivered" &&
    oldStage !== "won_to_be_delivered"
  ) {
    await autoCreateConstructionProject(opportunityId, opportunity);
  }

  // 4. Update construction project status if it exists
  if (opportunity.constructionProjectId) {
    const projectStatus =
      STAGE_TO_PROJECT_STATUS[
        newStage as keyof typeof STAGE_TO_PROJECT_STATUS
      ];
    if (projectStatus) {
      await db
        .update(constructionProjects)
        .set({
          status: projectStatus,
          updatedAt: new Date(),
        })
        .where(eq(constructionProjects.id, opportunity.constructionProjectId));
    }
  }

  // 5. Track velocity and award bonus points
  if (oldStage) {
    await trackVelocity(opportunityId, opportunity, oldStage, newStage, userId);
  }

  // 6. Update gamification missions and award points
  if (oldStage) {
    await onOpportunityStageChange(opportunityId, oldStage, newStage, userId);
  }
}

/**
 * Sync lead status from opportunity stage
 * Opportunity stage changes drive lead status updates
 */
async function syncLeadFromOpportunity(
  leadId: string,
  oppStage: string
): Promise<void> {
  const leadStageMap: Record<string, string> = {
    new: "new",
    qualified: "qualified",
    design_mandate_signed: "qualified",
    epc_proposal_sent: "proposal_sent",
    won_to_be_delivered: "won",
    won_in_construction: "won",
    won_delivered: "won",
    lost: "lost",
  };

  const newLeadStatus = leadStageMap[oppStage] || "new";

  await db
    .update(leads)
    .set({
      status: newLeadStatus,
      updatedAt: new Date(),
    })
    .where(eq(leads.id, leadId));
}

/**
 * Auto-create construction project when opportunity reaches won_to_be_delivered
 */
async function autoCreateConstructionProject(
  opportunityId: string,
  opportunity: any
): Promise<void> {
  // Check if project already exists
  const existing = await db
    .select()
    .from(constructionProjects)
    .where(
      eq(constructionProjects.opportunityId, opportunityId)
    );

  if (existing.length > 0) {
    return; // Project already exists
  }

  // Create new construction project
  const [project] = await db
    .insert(constructionProjects)
    .values({
      opportunityId,
      clientId: opportunity.clientId,
      accountManagerId: opportunity.ownerId,
      projectName: opportunity.title || "Solar Project",
      description: opportunity.description,
      pvSizeKw: opportunity.pvSizeKw,
      estimatedAnnualProduction: opportunity.estimatedAnnualProduction,
      status: "pending",
    })
    .returning();

  // Link project back to opportunity
  await db
    .update(opportunities)
    .set({
      constructionProjectId: project.id,
      updatedAt: new Date(),
    })
    .where(eq(opportunities.id, opportunityId));
}

/**
 * Track velocity milestones and award bonus points
 * Velocity = how quickly deals move through pipeline
 */
async function trackVelocity(
  opportunityId: string,
  opportunity: any,
  fromStage: string,
  toStage: string,
  changedBy?: string
): Promise<void> {
  // Calculate days in previous stage
  const stageLog = await db
    .select()
    .from(sql`
      SELECT created_at FROM stage_transition_logs
      WHERE entity_id = ${opportunityId} AND entity_type = 'opportunity'
      ORDER BY created_at DESC LIMIT 1
    `);

  if (stageLog.length === 0) return;

  const lastTransitionDate = new Date(
    stageLog[0]?.created_at || new Date()
  );
  const daysInStage = Math.floor(
    (Date.now() - lastTransitionDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Check velocity milestones
  const velocityKey = `${fromStage}_to_${toStage}`;
  const milestone = VELOCITY_MILESTONES[
    velocityKey as keyof typeof VELOCITY_MILESTONES
  ];

  if (!milestone) return;

  // Award velocity bonus if within threshold
  if (daysInStage <= milestone.days && opportunity.ownerId) {
    const profile = await getOrCreateProfile(
      "account_manager",
      opportunity.ownerId
    );

    if (profile) {
      await awardPoints(
        profile.id,
        milestone.points,
        "velocity_bonus",
        `Velocity bonus: ${fromStage} → ${toStage} in ${daysInStage} days`,
        opportunityId
      );
    }
  }
}

/**
 * Called by a scheduled job or webhook to sync all open opportunities
 * Ensures construction projects are created/updated for all won deals
 */
export async function syncAllOpenOpportunities(): Promise<void> {
  const opps = await db
    .select()
    .from(opportunities)
    .where(
      and(
        sql`stage != 'lost'`,
        sql`stage != 'archived'`
      )
    );

  for (const opp of opps) {
    // Ensure construction project exists for won deals
    if (
      opp.stage === "won_to_be_delivered" &&
      !opp.constructionProjectId
    ) {
      await autoCreateConstructionProject(opp.id, opp);
    }

    // Update project status if it exists
    if (opp.constructionProjectId) {
      const projectStatus =
        STAGE_TO_PROJECT_STATUS[
          opp.stage as keyof typeof STAGE_TO_PROJECT_STATUS
        ];
      if (projectStatus) {
        await db
          .update(constructionProjects)
          .set({ status: projectStatus })
          .where(eq(constructionProjects.id, opp.constructionProjectId));
      }
    }
  }
}

/**
 * Get velocity metrics for an account manager
 * Used to determine velocity badge eligibility
 */
export async function getVelocityMetrics(userId: string) {
  // Get last 90 days of opportunity stage transitions for this user
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const fastDeals = await db
    .select()
    .from(sql`
      SELECT
        opportunity_id,
        EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) / 86400 as days_to_close
      FROM stage_transition_logs
      WHERE entity_type = 'opportunity'
        AND changed_by = ${userId}
        AND to_stage = 'won_to_be_delivered'
        AND created_at > ${ninetyDaysAgo}
      GROUP BY opportunity_id
      HAVING EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) / 86400 <= 30
    `);

  return {
    fastDealsCount: fastDeals.length,
    qualifiesForVelocityBadge: fastDeals.length >= 3,
  };
}

/**
 * Calculate savings realized per completed project
 * Used in impact calculations and credibility metrics
 */
export async function calculateProjectSavings(opportunityId: string) {
  const opp = await db
    .select()
    .from(opportunities)
    .where(eq(opportunities.id, opportunityId));

  if (opp.length === 0) return { savings: 0, co2Avoided: 0 };

  const opportunity = opp[0];

  // Quebec context: ~$0.12/kWh vs solar system generation
  // System: ~1030 kWh/kWc/year in Quebec
  const pvSizeKwc = (opportunity.pvSizeKw || 0) / 1000;
  const estimatedKwhPerYear = pvSizeKwc * 1030;
  const estimatedSavingsPerYear = estimatedKwhPerYear * 0.12;

  // CO2: ~400g CO2/kWh displaced (grid average marginal)
  const co2AvoidedPerYear = (estimatedKwhPerYear * 400) / 1_000_000; // tonnes

  // Over 25-year system life
  const totalSavings25Year = estimatedSavingsPerYear * 25;
  const totalCO2Avoided25Year = co2AvoidedPerYear * 25;

  return {
    annualSavings: Math.round(estimatedSavingsPerYear),
    annualCO2Avoided: Math.round(co2AvoidedPerYear * 1000) / 1000,
    totalSavings25Year: Math.round(totalSavings25Year),
    totalCO2Avoided25Year: Math.round(totalCO2Avoided25Year * 1000) / 1000,
  };
}

/**
 * Export velocity and impact metrics for dashboard
 */
export async function getTeamMetrics(accountManagerIds: string[]) {
  // Get team opportunities
  const teamOpps = await db
    .select()
    .from(opportunities)
    .where(sql`owner_id = ANY(${accountManagerIds})`);

  const wonDeals = teamOpps.filter((o) => o.stage === "won_delivered");
  const inProgressDeals = teamOpps.filter(
    (o) => o.stage === "won_in_construction"
  );

  // Calculate aggregate metrics
  const totalMWInstalled = (
    wonDeals.reduce((sum, o) => sum + (o.pvSizeKw || 0), 0) / 1000
  );

  const totalDealsClosed = wonDeals.length;
  const conversionRate = teamOpps.length > 0
    ? Math.round((totalDealsClosed / teamOpps.length) * 100)
    : 0;

  return {
    teamSize: accountManagerIds.length,
    totalOpportunities: teamOpps.length,
    dealsWon: totalDealsClosed,
    dealsInConstruction: inProgressDeals.length,
    totalMWInstalled,
    conversionRate,
  };
}
