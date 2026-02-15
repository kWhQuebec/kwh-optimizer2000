import { eq, desc, and, inArray, count, sum, sql } from "drizzle-orm";
import { db } from "../db";
import {
  opportunities, activities, partnerships, clients, sites,
  simulationRuns, portfolioSites,
} from "@shared/schema";
import type {
  Opportunity, InsertOpportunity,
  Activity, InsertActivity,
  Partnership, InsertPartnership,
  Site, SimulationRun,
} from "@shared/schema";

// ==================== PORTFOLIO AUTO-SYNC (private helper) ====================

async function applyPortfolioAutoSync(opps: Opportunity[]): Promise<(Opportunity & { rfpBreakdown?: { eligibleSites: number; eligibleCapex: number; eligiblePvKW: number; nonEligibleSites: number; nonEligibleCapex: number; nonEligiblePvKW: number; totalSites: number } })[]> {
  if (opps.length === 0) return opps;

  const portfolioIds = Array.from(new Set(opps.filter(o => o.portfolioId).map(o => o.portfolioId!)));
  if (portfolioIds.length === 0) return opps;

  const allPortfolioSites = await db.select().from(portfolioSites).where(inArray(portfolioSites.portfolioId, portfolioIds));

  const portfolioSitesMap = new Map<string, typeof allPortfolioSites>();
  for (const ps of allPortfolioSites) {
    if (!portfolioSitesMap.has(ps.portfolioId)) {
      portfolioSitesMap.set(ps.portfolioId, []);
    }
    portfolioSitesMap.get(ps.portfolioId)!.push(ps);
  }

  const allSiteIds = Array.from(new Set(allPortfolioSites.map(ps => ps.siteId)));

  const [allSitesData, allSimsData] = await Promise.all([
    allSiteIds.length > 0 ? db.select().from(sites).where(inArray(sites.id, allSiteIds)) : Promise.resolve([]),
    allSiteIds.length > 0 ? db.select().from(simulationRuns).where(inArray(simulationRuns.siteId, allSiteIds)) : Promise.resolve([]),
  ]);

  const siteDetails = new Map<string, typeof sites.$inferSelect>();
  for (const site of allSitesData) {
    siteDetails.set(site.id, site);
  }

  const latestSims = new Map<string, typeof simulationRuns.$inferSelect>();
  for (const sim of allSimsData) {
    const existing = latestSims.get(sim.siteId);
    if (!existing || (sim.createdAt && existing.createdAt && new Date(sim.createdAt) > new Date(existing.createdAt))) {
      latestSims.set(sim.siteId, sim);
    }
  }

  const portfolioKPIs = new Map<string, {
    totalCapex: number;
    totalPvKW: number;
    rfpBreakdown: {
      eligibleSites: number;
      eligibleCapex: number;
      eligiblePvKW: number;
      nonEligibleSites: number;
      nonEligibleCapex: number;
      nonEligiblePvKW: number;
      totalSites: number;
    };
  }>();

  for (const portfolioId of portfolioIds) {
    const pSites = portfolioSitesMap.get(portfolioId) || [];

    let totalCapex = 0;
    let totalPvKW = 0;
    let eligibleSites = 0;
    let eligibleCapex = 0;
    let eligiblePvKW = 0;
    let nonEligibleSites = 0;
    let nonEligibleCapex = 0;
    let nonEligiblePvKW = 0;

    for (const ps of pSites) {
      const sim = latestSims.get(ps.siteId);
      const site = siteDetails.get(ps.siteId);
      const capex = ps.overrideCapexNet ?? sim?.capexNet ?? 0;
      const pvKW = ps.overridePvSizeKW ?? sim?.pvSizeKW ?? 0;
      totalCapex += capex;
      totalPvKW += pvKW;

      if (site?.hqRfpStatus === 'eligible') {
        eligibleSites++;
        eligibleCapex += capex;
        eligiblePvKW += pvKW;
      } else {
        nonEligibleSites++;
        nonEligibleCapex += capex;
        nonEligiblePvKW += pvKW;
      }
    }

    portfolioKPIs.set(portfolioId, {
      totalCapex,
      totalPvKW,
      rfpBreakdown: {
        eligibleSites,
        eligibleCapex,
        eligiblePvKW,
        nonEligibleSites,
        nonEligibleCapex,
        nonEligiblePvKW,
        totalSites: pSites.length,
      }
    });
  }

  return opps.map(o => {
    if (o.portfolioId && portfolioKPIs.has(o.portfolioId)) {
      const kpis = portfolioKPIs.get(o.portfolioId)!;
      return {
        ...o,
        estimatedValue: kpis.totalCapex,
        pvSizeKW: kpis.totalPvKW,
        rfpBreakdown: kpis.rfpBreakdown,
      };
    }
    return o;
  });
}

// ==================== OPPORTUNITIES ====================

export async function getOpportunities(): Promise<Opportunity[]> {
  const opps = await db.select().from(opportunities).orderBy(desc(opportunities.createdAt));
  return applyPortfolioAutoSync(opps);
}

export async function getOpportunity(id: string): Promise<Opportunity | undefined> {
  const result = await db.select().from(opportunities).where(eq(opportunities.id, id)).limit(1);
  if (result.length === 0) return undefined;
  const synced = await applyPortfolioAutoSync(result);
  return synced[0];
}

export async function getOpportunitiesByStage(stage: string): Promise<Opportunity[]> {
  const opps = await db.select().from(opportunities)
    .where(eq(opportunities.stage, stage))
    .orderBy(desc(opportunities.createdAt));
  return applyPortfolioAutoSync(opps);
}

export async function getOpportunitiesByLeadId(leadId: string): Promise<Opportunity[]> {
  const opps = await db.select().from(opportunities)
    .where(eq(opportunities.leadId, leadId))
    .orderBy(desc(opportunities.createdAt));
  return applyPortfolioAutoSync(opps);
}

export async function getOpportunitiesByClientId(clientId: string): Promise<Opportunity[]> {
  const opps = await db.select().from(opportunities)
    .where(eq(opportunities.clientId, clientId))
    .orderBy(desc(opportunities.createdAt));
  return applyPortfolioAutoSync(opps);
}

export async function getOpportunitiesBySiteId(siteId: string): Promise<Opportunity[]> {
  const opps = await db.select().from(opportunities)
    .where(eq(opportunities.siteId, siteId))
    .orderBy(desc(opportunities.createdAt));
  return applyPortfolioAutoSync(opps);
}

export async function getOpportunitiesByOwnerId(ownerId: string): Promise<Opportunity[]> {
  const opps = await db.select().from(opportunities)
    .where(eq(opportunities.ownerId, ownerId))
    .orderBy(desc(opportunities.createdAt));
  return applyPortfolioAutoSync(opps);
}

export async function createOpportunity(opportunity: InsertOpportunity): Promise<Opportunity> {
  const [result] = await db.insert(opportunities).values(opportunity).returning();
  return result;
}

export async function updateOpportunity(id: string, opportunity: Partial<Opportunity>): Promise<Opportunity | undefined> {
  const [result] = await db.update(opportunities)
    .set({ ...opportunity, updatedAt: new Date() })
    .where(eq(opportunities.id, id))
    .returning();
  return result;
}

export async function deleteOpportunity(id: string): Promise<boolean> {
  const result = await db.delete(opportunities).where(eq(opportunities.id, id)).returning();
  return result.length > 0;
}

export async function updateOpportunityStage(id: string, stage: string, probability?: number, lostReason?: string, lostNotes?: string): Promise<Opportunity | undefined> {
  const updateData: Partial<Opportunity> = {
    stage,
    updatedAt: new Date(),
  };
  if (probability !== undefined) updateData.probability = probability;
  if (lostReason !== undefined) updateData.lostReason = lostReason;
  if (lostNotes !== undefined) updateData.lostNotes = lostNotes;
  const wonStages = ['won_to_be_delivered', 'won_in_construction', 'won_delivered'];
  if (wonStages.includes(stage) || stage === "lost") updateData.actualCloseDate = new Date();

  const [result] = await db.update(opportunities)
    .set(updateData)
    .where(eq(opportunities.id, id))
    .returning();
  return result;
}

// ==================== GLOBAL SEARCH ====================

export async function searchClients(query: string, limit: number = 5): Promise<Array<{ id: string; name: string; mainContactName: string | null; email: string | null }>> {
  if (!query.trim()) return [];
  const searchPattern = `%${query.toLowerCase()}%`;
  return db.select({
    id: clients.id,
    name: clients.name,
    mainContactName: clients.mainContactName,
    email: clients.email,
  })
  .from(clients)
  .where(
    sql`(
      LOWER(${clients.name}) LIKE ${searchPattern} OR
      LOWER(${clients.mainContactName}) LIKE ${searchPattern} OR
      LOWER(${clients.email}) LIKE ${searchPattern}
    )`
  )
  .limit(limit);
}

export async function searchSites(query: string, limit: number = 5): Promise<Array<{ id: string; name: string; city: string | null; clientName: string | null }>> {
  if (!query.trim()) return [];
  const searchPattern = `%${query.toLowerCase()}%`;

  const results = await db.execute(sql`
    SELECT s.id, s.name, s.city, c.name as client_name
    FROM sites s
    LEFT JOIN clients c ON s.client_id = c.id
    WHERE LOWER(s.name) LIKE ${searchPattern}
       OR LOWER(s.city) LIKE ${searchPattern}
       OR LOWER(s.address) LIKE ${searchPattern}
       OR LOWER(c.name) LIKE ${searchPattern}
    LIMIT ${limit}
  `);

  return (results.rows as any[]).map(r => ({
    id: r.id,
    name: r.name,
    city: r.city,
    clientName: r.client_name,
  }));
}

export async function searchOpportunities(query: string, limit: number = 5): Promise<Array<{ id: string; name: string; stage: string; estimatedValue: number | null }>> {
  if (!query.trim()) return [];
  const searchPattern = `%${query.toLowerCase()}%`;
  return db.select({
    id: opportunities.id,
    name: opportunities.name,
    stage: opportunities.stage,
    estimatedValue: opportunities.estimatedValue,
  })
  .from(opportunities)
  .where(
    sql`(
      LOWER(${opportunities.name}) LIKE ${searchPattern} OR
      LOWER(${opportunities.description}) LIKE ${searchPattern}
    )`
  )
  .limit(limit);
}

// ==================== DASHBOARD STATS ====================

export async function getDashboardStats(): Promise<{
  totalSites: number;
  activeAnalyses: number;
  totalSavings: number;
  co2Avoided: number;
  recentSites: Site[];
  recentAnalyses: SimulationRun[];
}> {
  const [siteCountResult] = await db.select({ count: count() }).from(sites);
  const [analysisAggResult] = await db.select({
    count: count(),
    totalSavings: sum(simulationRuns.annualSavings),
    co2Avoided: sum(simulationRuns.co2AvoidedTonnesPerYear),
  }).from(simulationRuns);

  const recentSites = await db.select().from(sites).orderBy(desc(sites.createdAt)).limit(5);
  const recentAnalyses = await db.select().from(simulationRuns).orderBy(desc(simulationRuns.createdAt)).limit(5);

  return {
    totalSites: Number(siteCountResult?.count) || 0,
    activeAnalyses: Number(analysisAggResult?.count) || 0,
    totalSavings: Number(analysisAggResult?.totalSavings) || 0,
    co2Avoided: Number(analysisAggResult?.co2Avoided) || 0,
    recentSites,
    recentAnalyses,
  };
}

// ==================== PIPELINE STATS ====================

export async function getPipelineStats(): Promise<{
  totalPipelineValue: number;
  weightedPipelineValue: number;
  wonValue: number;
  lostValue: number;
  deliveryBacklogValue: number;
  deliveryBacklogCount: number;
  deliveredValue: number;
  deliveredCount: number;
  activeOpportunityCount: number;
  stageBreakdown: Array<{
    stage: string;
    count: number;
    totalValue: number;
    weightedValue: number;
  }>;
  topOpportunities: Array<{
    id: string;
    name: string;
    clientName: string | null;
    stage: string;
    probability: number;
    estimatedValue: number | null;
    updatedAt: Date | null;
  }>;
  atRiskOpportunities: Array<{
    id: string;
    name: string;
    clientName: string | null;
    stage: string;
    estimatedValue: number | null;
    daysSinceUpdate: number;
  }>;
  recentWins: Array<{
    id: string;
    name: string;
    clientName: string | null;
    estimatedValue: number | null;
    updatedAt: Date | null;
  }>;
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
}> {
  const STAGE_PROBABILITIES: Record<string, number> = {
    prospect: 5,
    contacted: 10,
    qualified: 20,
    analysis_done: 25,
    design_mandate_signed: 50,
    epc_proposal_sent: 75,
    negotiation: 90,
    won_to_be_delivered: 100,
    won_in_construction: 100,
    won_delivered: 100,
    won: 100,
    lost: 0,
    disqualified: 0,
  };

  const allOppsRaw = await db
    .select({
      id: opportunities.id,
      name: opportunities.name,
      stage: opportunities.stage,
      probability: opportunities.probability,
      estimatedValue: opportunities.estimatedValue,
      pvSizeKW: opportunities.pvSizeKW,
      createdAt: opportunities.createdAt,
      updatedAt: opportunities.updatedAt,
      clientId: opportunities.clientId,
      portfolioId: opportunities.portfolioId,
    })
    .from(opportunities);

  const portfolioIds = Array.from(new Set(allOppsRaw.filter(o => o.portfolioId).map(o => o.portfolioId!)));
  const portfolioKPIs = new Map<string, { totalCapex: number; totalPvKW: number }>();

  if (portfolioIds.length > 0) {
    for (const portfolioId of portfolioIds) {
      const pSites = await db.select().from(portfolioSites).where(eq(portfolioSites.portfolioId, portfolioId));
      const siteIds = pSites.map(ps => ps.siteId);

      const latestSims = new Map<string, typeof simulationRuns.$inferSelect>();
      if (siteIds.length > 0) {
        const sims = await db.select().from(simulationRuns).where(inArray(simulationRuns.siteId, siteIds));
        for (const sim of sims) {
          const existing = latestSims.get(sim.siteId);
          if (!existing || (sim.createdAt && existing.createdAt && new Date(sim.createdAt) > new Date(existing.createdAt))) {
            latestSims.set(sim.siteId, sim);
          }
        }
      }

      let totalCapex = 0;
      let totalPvKW = 0;
      for (const ps of pSites) {
        const sim = latestSims.get(ps.siteId);
        const capex = ps.overrideCapexNet ?? sim?.capexNet ?? 0;
        const pvKW = ps.overridePvSizeKW ?? sim?.pvSizeKW ?? 0;
        totalCapex += capex;
        totalPvKW += pvKW;
      }
      portfolioKPIs.set(portfolioId, { totalCapex, totalPvKW });
    }
  }

  const allOpps = allOppsRaw.map(o => {
    if (o.portfolioId && portfolioKPIs.has(o.portfolioId)) {
      const kpis = portfolioKPIs.get(o.portfolioId)!;
      return {
        ...o,
        estimatedValue: kpis.totalCapex,
        pvSizeKW: kpis.totalPvKW,
      };
    }
    return o;
  });

  const clientIds = Array.from(new Set(allOpps.filter(o => o.clientId).map(o => o.clientId!)));
  const clientsList = clientIds.length > 0
    ? await db.select({ id: clients.id, name: clients.name }).from(clients).where(inArray(clients.id, clientIds))
    : [];
  const clientMap = new Map(clientsList.map(c => [c.id, c.name]));

  const WON_STAGES = ['won_to_be_delivered', 'won_in_construction', 'won_delivered'];
  const isWonStage = (stage: string) => WON_STAGES.includes(stage);

  const activeOpps = allOpps.filter(o => !isWonStage(o.stage) && o.stage !== 'lost');
  const wonOpps = allOpps.filter(o => isWonStage(o.stage));
  const lostOpps = allOpps.filter(o => o.stage === 'lost');

  const totalPipelineValue = activeOpps.reduce((sum, o) => sum + (o.estimatedValue || 0), 0);
  const weightedPipelineValue = activeOpps.reduce((sum, o) => {
    const prob = o.probability ?? STAGE_PROBABILITIES[o.stage] ?? 0;
    return sum + ((o.estimatedValue || 0) * prob / 100);
  }, 0);
  const wonValue = wonOpps.reduce((sum, o) => sum + (o.estimatedValue || 0), 0);
  const lostValue = lostOpps.reduce((sum, o) => sum + (o.estimatedValue || 0), 0);

  const deliveryBacklogValue = allOpps
    .filter(o => o.stage === 'won_to_be_delivered' || o.stage === 'won_in_construction')
    .reduce((sum, o) => sum + (o.estimatedValue || 0), 0);
  const deliveredValue = allOpps
    .filter(o => o.stage === 'won_delivered')
    .reduce((sum, o) => sum + (o.estimatedValue || 0), 0);
  const deliveryBacklogCount = allOpps.filter(o => o.stage === 'won_to_be_delivered' || o.stage === 'won_in_construction').length;
  const deliveredCount = allOpps.filter(o => o.stage === 'won_delivered').length;

  const stages = ['prospect', 'contacted', 'qualified', 'analysis_done', 'design_mandate_signed', 'epc_proposal_sent', 'negotiation', 'won_to_be_delivered', 'won_in_construction', 'won_delivered', 'lost', 'disqualified'];
  const stageBreakdown = stages.map(stage => {
    const stageOpps = allOpps.filter(o => o.stage === stage);
    const totalValue = stageOpps.reduce((sum, o) => sum + (o.estimatedValue || 0), 0);
    const weightedValue = stageOpps.reduce((sum, o) => {
      const prob = o.probability ?? STAGE_PROBABILITIES[o.stage] ?? 0;
      return sum + ((o.estimatedValue || 0) * prob / 100);
    }, 0);
    return {
      stage,
      count: stageOpps.length,
      totalValue,
      weightedValue,
    };
  });

  const topOpportunities = activeOpps
    .filter(o => o.estimatedValue && o.estimatedValue > 0)
    .sort((a, b) => (b.estimatedValue || 0) - (a.estimatedValue || 0))
    .slice(0, 5)
    .map(o => ({
      id: o.id,
      name: o.name,
      clientName: o.clientId ? clientMap.get(o.clientId) || null : null,
      stage: o.stage,
      probability: o.probability ?? STAGE_PROBABILITIES[o.stage] ?? 0,
      estimatedValue: o.estimatedValue,
      updatedAt: o.updatedAt,
    }));

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const atRiskOpportunities = activeOpps
    .filter(o => {
      const lastActivity = o.updatedAt || o.createdAt;
      if (!lastActivity) return false;
      return new Date(lastActivity) < thirtyDaysAgo;
    })
    .map(o => {
      const lastActivity = o.updatedAt || o.createdAt;
      const daysSinceUpdate = lastActivity
        ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      return {
        id: o.id,
        name: o.name,
        clientName: o.clientId ? clientMap.get(o.clientId) || null : null,
        stage: o.stage,
        estimatedValue: o.estimatedValue,
        daysSinceUpdate,
      };
    })
    .sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate)
    .slice(0, 5);

  const recentWins = wonOpps
    .sort((a, b) => {
      const aDate = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bDate = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bDate - aDate;
    })
    .slice(0, 5)
    .map(o => ({
      id: o.id,
      name: o.name,
      clientName: o.clientId ? clientMap.get(o.clientId) || null : null,
      estimatedValue: o.estimatedValue,
      updatedAt: o.updatedAt,
    }));

  const allSites = await db.select({
    id: sites.id,
    name: sites.name,
    clientId: sites.clientId,
    roofAreaValidated: sites.roofAreaValidated,
    quickAnalysisCompletedAt: sites.quickAnalysisCompletedAt,
    workQueuePriority: sites.workQueuePriority,
  }).from(sites);

  const pendingTasks: Array<{
    id: string;
    siteId: string;
    siteName: string;
    clientName: string | null;
    taskType: 'roof_drawing' | 'run_analysis';
    priority: 'urgent' | 'normal';
  }> = [];

  let roofDrawingCount = 0;
  let runAnalysisCount = 0;

  for (const site of allSites) {
    if (!site.roofAreaValidated) {
      roofDrawingCount++;
      pendingTasks.push({
        id: `roof-${site.id}`,
        siteId: site.id,
        siteName: site.name,
        clientName: site.clientId ? clientMap.get(site.clientId) || null : null,
        taskType: 'roof_drawing',
        priority: site.workQueuePriority === 'urgent' ? 'urgent' : 'normal',
      });
    } else if (!site.quickAnalysisCompletedAt) {
      runAnalysisCount++;
      pendingTasks.push({
        id: `analysis-${site.id}`,
        siteId: site.id,
        siteName: site.name,
        clientName: site.clientId ? clientMap.get(site.clientId) || null : null,
        taskType: 'run_analysis',
        priority: site.workQueuePriority === 'urgent' ? 'urgent' : 'normal',
      });
    }
  }

  const sortedTasks = pendingTasks
    .sort((a, b) => {
      if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
      if (a.priority !== 'urgent' && b.priority === 'urgent') return 1;
      return 0;
    })
    .slice(0, 5);

  return {
    totalPipelineValue,
    weightedPipelineValue,
    wonValue,
    lostValue,
    deliveryBacklogValue,
    deliveryBacklogCount,
    deliveredValue,
    deliveredCount,
    activeOpportunityCount: activeOpps.length,
    stageBreakdown,
    topOpportunities,
    atRiskOpportunities,
    recentWins,
    pendingTasks: sortedTasks,
    pendingTasksCount: {
      roofDrawing: roofDrawingCount,
      runAnalysis: runAnalysisCount,
      total: roofDrawingCount + runAnalysisCount,
    },
  };
}

// ==================== CONVERSION FUNNEL METRICS ====================

export async function getConversionFunnelMetrics(periodDays: number = 90): Promise<{
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
}> {
  const stages = ['prospect', 'contacted', 'qualified', 'analysis_done', 'design_mandate_signed', 'epc_proposal_sent', 'negotiation', 'won_to_be_delivered', 'won_in_construction', 'won_delivered'];
  const periodStartDate = new Date();
  periodStartDate.setDate(periodStartDate.getDate() - periodDays);

  // Get all opportunities created in the period
  const periodOpps = await db
    .select({
      id: opportunities.id,
      stage: opportunities.stage,
      createdAt: opportunities.createdAt,
      updatedAt: opportunities.updatedAt,
      lostReason: opportunities.lostReason,
    })
    .from(opportunities)
    .where(
      sql`${opportunities.createdAt} >= ${periodStartDate}`
    );

  // Also get some historical data to calculate conversion rates
  const allOpps = await db
    .select({
      id: opportunities.id,
      stage: opportunities.stage,
      createdAt: opportunities.createdAt,
      updatedAt: opportunities.updatedAt,
      lostReason: opportunities.lostReason,
    })
    .from(opportunities);

  const WON_STAGES = ['won_to_be_delivered', 'won_in_construction', 'won_delivered'];
  const LOST_STAGES = ['lost', 'disqualified'];

  // Count opportunities at each stage (all time for conversion rates)
  const stageCounts = new Map<string, number>();
  const stageTimings = new Map<string, { totalDays: number; count: number }>();

  for (const opp of allOpps) {
    const stage = opp.stage;
    stageCounts.set(stage, (stageCounts.get(stage) || 0) + 1);

    // Calculate days in stage (from created to last update)
    if (opp.createdAt && opp.updatedAt) {
      const daysInStage = (new Date(opp.updatedAt).getTime() - new Date(opp.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      const existing = stageTimings.get(stage) || { totalDays: 0, count: 0 };
      stageTimings.set(stage, {
        totalDays: existing.totalDays + daysInStage,
        count: existing.count + 1,
      });
    }
  }

  // Build funnel with conversion rates
  const funnel = [];
  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    const count = stageCounts.get(stage) || 0;

    // Conversion to next stage
    let conversionToNext = 0;
    if (i < stages.length - 1) {
      const nextStage = stages[i + 1];
      const nextCount = stageCounts.get(nextStage) || 0;
      conversionToNext = count > 0 ? nextCount / count : 0;
    }

    // Average days in stage
    const stageData = stageTimings.get(stage);
    const avgDaysInStage = stageData ? stageData.totalDays / stageData.count : 0;

    funnel.push({
      stage,
      count,
      conversionToNext: Math.round(conversionToNext * 10000) / 10000,
      avgDaysInStage: Math.round(avgDaysInStage * 10) / 10,
    });
  }

  // Calculate win rate (opportunities that reached won stages / total created)
  const totalOpportunities = allOpps.length;
  const wonCount = allOpps.filter(o => WON_STAGES.includes(o.stage)).length;
  const winRate = totalOpportunities > 0 ? wonCount / totalOpportunities : 0;

  // Calculate average deal cycle (for won opportunities only)
  let totalDealCycle = 0;
  let wonWithDates = 0;
  for (const opp of allOpps) {
    if (WON_STAGES.includes(opp.stage) && opp.createdAt && opp.updatedAt) {
      const daysToWin = (new Date(opp.updatedAt).getTime() - new Date(opp.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      totalDealCycle += daysToWin;
      wonWithDates++;
    }
  }
  const avgDealCycle = wonWithDates > 0 ? Math.round(totalDealCycle / wonWithDates * 10) / 10 : 0;

  // Lost reasons breakdown
  const lostReasons: Record<string, number> = {};
  for (const opp of allOpps) {
    if (opp.stage === 'lost' && opp.lostReason) {
      lostReasons[opp.lostReason] = (lostReasons[opp.lostReason] || 0) + 1;
    }
  }

  return {
    funnel,
    winRate: Math.round(winRate * 10000) / 10000,
    avgDealCycle,
    lostReasons,
    totalOpportunities,
    periodDays,
  };
}

// ==================== ACTIVITIES ====================

export async function getActivities(): Promise<Activity[]> {
  return db.select().from(activities).orderBy(desc(activities.createdAt));
}

export async function getActivity(id: string): Promise<Activity | undefined> {
  const result = await db.select().from(activities).where(eq(activities.id, id)).limit(1);
  return result[0];
}

export async function getActivitiesByLeadId(leadId: string): Promise<Activity[]> {
  return db.select().from(activities)
    .where(eq(activities.leadId, leadId))
    .orderBy(desc(activities.activityDate));
}

export async function getActivitiesByClientId(clientId: string): Promise<Activity[]> {
  return db.select().from(activities)
    .where(eq(activities.clientId, clientId))
    .orderBy(desc(activities.activityDate));
}

export async function getActivitiesBySiteId(siteId: string): Promise<Activity[]> {
  return db.select().from(activities)
    .where(eq(activities.siteId, siteId))
    .orderBy(desc(activities.activityDate));
}

export async function getActivitiesByOpportunityId(opportunityId: string): Promise<Activity[]> {
  return db.select().from(activities)
    .where(eq(activities.opportunityId, opportunityId))
    .orderBy(desc(activities.activityDate));
}

export async function createActivity(activity: InsertActivity): Promise<Activity> {
  const [result] = await db.insert(activities).values(activity).returning();
  return result;
}

export async function updateActivity(id: string, activity: Partial<Activity>): Promise<Activity | undefined> {
  const [result] = await db.update(activities)
    .set(activity)
    .where(eq(activities.id, id))
    .returning();
  return result;
}

export async function deleteActivity(id: string): Promise<boolean> {
  const result = await db.delete(activities).where(eq(activities.id, id)).returning();
  return result.length > 0;
}

// ==================== PARTNERSHIPS ====================

export async function getPartnerships(): Promise<Partnership[]> {
  return db.select().from(partnerships).orderBy(desc(partnerships.updatedAt));
}

export async function getPartnership(id: string): Promise<Partnership | undefined> {
  const [partnership] = await db.select().from(partnerships).where(eq(partnerships.id, id)).limit(1);
  return partnership;
}

export async function createPartnership(data: InsertPartnership): Promise<Partnership> {
  const [partnership] = await db.insert(partnerships).values(data).returning();
  return partnership;
}

export async function updatePartnership(id: string, data: Partial<InsertPartnership>): Promise<Partnership> {
  const [partnership] = await db.update(partnerships)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(partnerships.id, id))
    .returning();
  return partnership;
}

export async function deletePartnership(id: string): Promise<void> {
  await db.delete(partnerships).where(eq(partnerships.id, id));
}
