import { Router } from "express";
import { authMiddleware, requireStaff, AuthRequest } from "../middleware/auth";
import { asyncHandler, BadRequestError, NotFoundError } from "../middleware/errorHandler";
import { storage } from "../storage";
import { insertOpportunitySchema, insertActivitySchema } from "@shared/schema";
import { createLogger } from "../lib/logger";

const log = createLogger("Opportunities");

const router = Router();

router.get("/api/opportunities", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const { stage } = req.query;
  let opportunities;
  if (stage && typeof stage === "string") {
    opportunities = await storage.getOpportunitiesByStage(stage);
  } else {
    opportunities = await storage.getOpportunities();
  }

  // Collect only the IDs needed for enrichment
  const ownerIds = [...new Set(opportunities.filter(o => o.ownerId).map(o => o.ownerId!))];
  const clientIds = [...new Set(opportunities.filter(o => o.clientId).map(o => o.clientId!))];
  const siteIds = [...new Set(opportunities.filter(o => o.siteId).map(o => o.siteId!))];

  // Load only the necessary data in parallel (batch queries instead of loading all)
  // Use minimal site data to avoid heavy googleSolarData blobs
  const [users, clients, sites] = await Promise.all([
    ownerIds.length > 0 ? storage.getUsersByIds(ownerIds) : Promise.resolve([]),
    clientIds.length > 0 ? storage.getClientsByIds(clientIds) : Promise.resolve([]),
    siteIds.length > 0 ? storage.getSitesMinimalByIds(siteIds) : Promise.resolve([]),
  ]);

  // Create maps for fast lookup
  const userMap = new Map(users.map(u => [u.id, u]));
  const clientMap = new Map(clients.map(c => [c.id, c]));
  const siteMap = new Map(sites.map(s => [s.id, s]));

  const enrichedOpportunities = opportunities.map(opp => ({
    ...opp,
    owner: opp.ownerId ? userMap.get(opp.ownerId) || null : null,
    client: opp.clientId ? clientMap.get(opp.clientId) || null : null,
    site: opp.siteId ? siteMap.get(opp.siteId) || null : null,
  }));

  res.json(enrichedOpportunities);
}));

router.get("/api/opportunities/:id", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const opportunity = await storage.getOpportunity(req.params.id);
  if (!opportunity) {
    throw new NotFoundError("Opportunity");
  }

  const [lead, client, site] = await Promise.all([
    opportunity.leadId ? storage.getLead(opportunity.leadId) : null,
    opportunity.clientId ? storage.getClient(opportunity.clientId) : null,
    opportunity.siteId ? storage.getSite(opportunity.siteId) : null,
  ]);

  res.json({
    ...opportunity,
    lead: lead || null,
    client: client || null,
    site: site || null,
  });
}));

router.get("/api/opportunities/lead/:leadId", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const opportunities = await storage.getOpportunitiesByLeadId(req.params.leadId);
  res.json(opportunities);
}));

router.get("/api/opportunities/client/:clientId", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const opportunities = await storage.getOpportunitiesByClientId(req.params.clientId);
  res.json(opportunities);
}));

router.get("/api/opportunities/site/:siteId", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const opportunities = await storage.getOpportunitiesBySiteId(req.params.siteId);
  res.json(opportunities);
}));

router.post("/api/opportunities", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  log.info("Creating opportunity with body:", JSON.stringify(req.body, null, 2));
  const parseResult = insertOpportunitySchema.safeParse(req.body);
  if (!parseResult.success) {
    log.error("Opportunity validation errors:", parseResult.error.errors);
    throw new BadRequestError("Validation error", parseResult.error.errors);
  }

  log.info("Parsed opportunity data:", JSON.stringify(parseResult.data, null, 2));
  const opportunity = await storage.createOpportunity(parseResult.data);
  res.status(201).json(opportunity);
}));

router.patch("/api/opportunities/:id", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const opportunity = await storage.updateOpportunity(req.params.id, req.body);
  if (!opportunity) {
    throw new NotFoundError("Opportunity");
  }
  res.json(opportunity);
}));

router.delete("/api/opportunities/:id", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const deleted = await storage.deleteOpportunity(req.params.id);
  if (!deleted) {
    throw new NotFoundError("Opportunity");
  }
  res.status(204).send();
}));

router.post("/api/opportunities/:id/stage", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const { stage, probability, lostReason, lostNotes } = req.body;

  if (!stage) {
    throw new BadRequestError("Stage is required");
  }

  const opportunity = await storage.updateOpportunityStage(
    req.params.id,
    stage,
    probability,
    lostReason,
    lostNotes
  );

  if (!opportunity) {
    throw new NotFoundError("Opportunity");
  }
  res.json(opportunity);
}));

router.get("/api/activities", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const { leadId, clientId, siteId, opportunityId, activityType } = req.query;

  let activities;
  if (leadId && typeof leadId === "string") {
    activities = await storage.getActivitiesByLeadId(leadId);
  } else if (clientId && typeof clientId === "string") {
    activities = await storage.getActivitiesByClientId(clientId);
  } else if (siteId && typeof siteId === "string") {
    activities = await storage.getActivitiesBySiteId(siteId);
  } else if (opportunityId && typeof opportunityId === "string") {
    activities = await storage.getActivitiesByOpportunityId(opportunityId);
  } else {
    activities = await storage.getActivities();
  }

  if (activityType && typeof activityType === "string") {
    activities = activities.filter(a => a.activityType === activityType);
  }

  res.json(activities);
}));

router.get("/api/activities/:id", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const activity = await storage.getActivity(req.params.id);
  if (!activity) {
    throw new NotFoundError("Activity");
  }
  res.json(activity);
}));

router.get("/api/activities/lead/:leadId", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const activities = await storage.getActivitiesByLeadId(req.params.leadId);
  res.json(activities);
}));

router.get("/api/activities/client/:clientId", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const activities = await storage.getActivitiesByClientId(req.params.clientId);
  res.json(activities);
}));

router.get("/api/activities/opportunity/:opportunityId", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const activities = await storage.getActivitiesByOpportunityId(req.params.opportunityId);
  res.json(activities);
}));

router.post("/api/activities", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const parseResult = insertActivitySchema.safeParse(req.body);
  if (!parseResult.success) {
    throw new BadRequestError("Validation error", parseResult.error.errors);
  }

  const activityData = {
    ...parseResult.data,
    createdBy: parseResult.data.createdBy || req.userId,
  };

  const activity = await storage.createActivity(activityData);
  res.status(201).json(activity);
}));

router.patch("/api/activities/:id", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const activity = await storage.updateActivity(req.params.id, req.body);
  if (!activity) {
    throw new NotFoundError("Activity");
  }
  res.json(activity);
}));

router.delete("/api/activities/:id", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const deleted = await storage.deleteActivity(req.params.id);
  if (!deleted) {
    throw new NotFoundError("Activity");
  }
  res.status(204).send();
}));

export default router;
