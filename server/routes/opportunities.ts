import { Router } from "express";
import { authMiddleware, requireStaff, AuthRequest } from "../middleware/auth";
import { storage } from "../storage";
import { insertOpportunitySchema, insertActivitySchema } from "@shared/schema";

const router = Router();

router.get("/api/opportunities", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
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
    const [users, clients, sites] = await Promise.all([
      ownerIds.length > 0 ? storage.getUsersByIds(ownerIds) : Promise.resolve([]),
      clientIds.length > 0 ? storage.getClientsByIds(clientIds) : Promise.resolve([]),
      siteIds.length > 0 ? storage.getSitesByIds(siteIds) : Promise.resolve([]),
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
  } catch (error) {
    console.error("Error fetching opportunities:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/opportunities/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const opportunity = await storage.getOpportunity(req.params.id);
    if (!opportunity) {
      return res.status(404).json({ error: "Opportunity not found" });
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
  } catch (error) {
    console.error("Error fetching opportunity:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/opportunities/lead/:leadId", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const opportunities = await storage.getOpportunitiesByLeadId(req.params.leadId);
    res.json(opportunities);
  } catch (error) {
    console.error("Error fetching opportunities by lead:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/opportunities/client/:clientId", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const opportunities = await storage.getOpportunitiesByClientId(req.params.clientId);
    res.json(opportunities);
  } catch (error) {
    console.error("Error fetching opportunities by client:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/opportunities/site/:siteId", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const opportunities = await storage.getOpportunitiesBySiteId(req.params.siteId);
    res.json(opportunities);
  } catch (error) {
    console.error("Error fetching opportunities by site:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/opportunities", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    console.log("Creating opportunity with body:", JSON.stringify(req.body, null, 2));
    const parseResult = insertOpportunitySchema.safeParse(req.body);
    if (!parseResult.success) {
      console.error("Opportunity validation errors:", parseResult.error.errors);
      return res.status(400).json({ error: "Validation error", details: parseResult.error.errors });
    }
    
    console.log("Parsed opportunity data:", JSON.stringify(parseResult.data, null, 2));
    const opportunity = await storage.createOpportunity(parseResult.data);
    res.status(201).json(opportunity);
  } catch (error) {
    console.error("Error creating opportunity:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/api/opportunities/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const opportunity = await storage.updateOpportunity(req.params.id, req.body);
    if (!opportunity) {
      return res.status(404).json({ error: "Opportunity not found" });
    }
    res.json(opportunity);
  } catch (error) {
    console.error("Error updating opportunity:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/api/opportunities/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const deleted = await storage.deleteOpportunity(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Opportunity not found" });
    }
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting opportunity:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/opportunities/:id/stage", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const { stage, probability, lostReason, lostNotes } = req.body;
    
    if (!stage) {
      return res.status(400).json({ error: "Stage is required" });
    }
    
    const opportunity = await storage.updateOpportunityStage(
      req.params.id, 
      stage, 
      probability,
      lostReason, 
      lostNotes
    );
    
    if (!opportunity) {
      return res.status(404).json({ error: "Opportunity not found" });
    }
    res.json(opportunity);
  } catch (error) {
    console.error("Error updating opportunity stage:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/activities", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
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
  } catch (error) {
    console.error("Error fetching activities:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/activities/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const activity = await storage.getActivity(req.params.id);
    if (!activity) {
      return res.status(404).json({ error: "Activity not found" });
    }
    res.json(activity);
  } catch (error) {
    console.error("Error fetching activity:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/activities/lead/:leadId", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const activities = await storage.getActivitiesByLeadId(req.params.leadId);
    res.json(activities);
  } catch (error) {
    console.error("Error fetching activities by lead:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/activities/client/:clientId", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const activities = await storage.getActivitiesByClientId(req.params.clientId);
    res.json(activities);
  } catch (error) {
    console.error("Error fetching activities by client:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/activities/opportunity/:opportunityId", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const activities = await storage.getActivitiesByOpportunityId(req.params.opportunityId);
    res.json(activities);
  } catch (error) {
    console.error("Error fetching activities by opportunity:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/activities", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const parseResult = insertActivitySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Validation error", details: parseResult.error.errors });
    }
    
    const activityData = {
      ...parseResult.data,
      createdBy: parseResult.data.createdBy || req.userId,
    };
    
    const activity = await storage.createActivity(activityData);
    res.status(201).json(activity);
  } catch (error) {
    console.error("Error creating activity:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/api/activities/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const activity = await storage.updateActivity(req.params.id, req.body);
    if (!activity) {
      return res.status(404).json({ error: "Activity not found" });
    }
    res.json(activity);
  } catch (error) {
    console.error("Error updating activity:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/api/activities/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const deleted = await storage.deleteActivity(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Activity not found" });
    }
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting activity:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
