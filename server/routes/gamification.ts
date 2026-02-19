/**
 * Gamification API Routes — kWh Québec
 * Express Router for gamification endpoints
 * Mount at: app.use("/api/gamification", gamificationRouter)
 */

import { Router, Request, Response } from "express";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import {
  gamificationProfiles,
  gamificationMissions,
  gamificationTasks,
  gamificationBadges,
  gamificationEvents,
  virtualPowerPlant,
} from "../shared/schema";
import {
  getOrCreateProfile,
  awardPoints,
  updateVirtualPowerPlant,
  createMissionsForOpportunity,
} from "./gamificationEngine";

const router = Router();

/**
 * GET /profile/:id
 * Get a gamification profile with badges and stats
 */
router.get("/profile/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const profiles = await db
      .select()
      .from(gamificationProfiles)
      .where(eq(gamificationProfiles.id, id));

    if (profiles.length === 0) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const profile = profiles[0];

    const badges = await db
      .select()
      .from(gamificationBadges)
      .where(eq(gamificationBadges.profileId, id));

    const recentEvents = await db
      .select()
      .from(gamificationEvents)
      .where(eq(gamificationEvents.profileId, id))
      .orderBy((t) => ({ createdAt: t.createdAt }))
      .limit(10);

    return res.json({
      ...profile,
      badges,
      recentEvents,
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /missions/:opportunityId
 * Get missions and tasks for an opportunity
 */
router.get("/missions/:opportunityId", async (req: Request, res: Response) => {
  try {
    const { opportunityId } = req.params;

    const missions = await db
      .select()
      .from(gamificationMissions)
      .where(eq(gamificationMissions.opportunityId, opportunityId));

    if (missions.length === 0) {
      return res.json({ missions: [] });
    }

    const missionsWithTasks = await Promise.all(
      missions.map(async (mission) => {
        const tasks = await db
          .select()
          .from(gamificationTasks)
          .where(eq(gamificationTasks.missionId, mission.id));

        return {
          ...mission,
          tasks,
        };
      })
    );

    return res.json({ missions: missionsWithTasks });
  } catch (error) {
    console.error("Error fetching missions:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /tasks/:taskId/complete
 * Mark a task as complete and award points
 */
router.post("/tasks/:taskId/complete", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { profileId, completedBy } = req.body;

    if (!profileId) {
      return res.status(400).json({ error: "profileId is required" });
    }

    // Get the task
    const tasks = await db
      .select()
      .from(gamificationTasks)
      .where(eq(gamificationTasks.id, taskId));

    if (tasks.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    const task = tasks[0];

    // Mark task as complete
    await db
      .update(gamificationTasks)
      .set({
        completed: true,
        completedAt: new Date(),
        completedBy: completedBy,
      })
      .where(eq(gamificationTasks.id, taskId));

    // Award points
    if (task.pointsReward > 0) {
      await awardPoints(
        profileId,
        task.pointsReward,
        "task_completed",
        `Complété: ${task.title}`,
        undefined,
        task.missionId
      );
    }

    return res.json({
      success: true,
      pointsAwarded: task.pointsReward,
    });
  } catch (error) {
    console.error("Error completing task:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /leaderboard
 * Get AM leaderboard by points (top 50)
 */
router.get("/leaderboard", async (req: Request, res: Response) => {
  try {
    const leaderboard = await db
      .select()
      .from(gamificationProfiles)
      .where(eq(gamificationProfiles.profileType, "account_manager"))
      .orderBy((p) => [{ totalPoints: "DESC" }])
      .limit(50);

    return res.json({ leaderboard });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /virtual-powerplant
 * Get virtual power plant aggregate stats
 */
router.get("/virtual-powerplant", async (req: Request, res: Response) => {
  try {
    const stats = await db.select().from(virtualPowerPlant).limit(1);

    if (stats.length === 0) {
      return res.json({
        totalInstalledMW: 0,
        totalProjectsCompleted: 0,
        totalProjectsInProgress: 0,
        totalKWhProduced: 0,
        totalCO2AvoidedTonnes: 0,
        equivalentHomesP: 0,
        equivalentCarsRemoved: 0,
        lastUpdatedAt: new Date(),
      });
    }

    return res.json(stats[0]);
  } catch (error) {
    console.error("Error fetching virtual power plant:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /badges/:profileId
 * Get all badges for a profile
 */
router.get("/badges/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;

    const badges = await db
      .select()
      .from(gamificationBadges)
      .where(eq(gamificationBadges.profileId, profileId));

    return res.json({ badges });
  } catch (error) {
    console.error("Error fetching badges:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /missions/:opportunityId/init
 * Create missions for an opportunity
 */
router.post(
  "/missions/:opportunityId/init",
  async (req: Request, res: Response) => {
    try {
      const { opportunityId } = req.params;

      // Check if missions already exist
      const existing = await db
        .select()
        .from(gamificationMissions)
        .where(eq(gamificationMissions.opportunityId, opportunityId));

      if (existing.length > 0) {
        return res.status(400).json({
          error: "Missions already exist for this opportunity",
        });
      }

      // Create missions
      await createMissionsForOpportunity(opportunityId);

      const missions = await db
        .select()
        .from(gamificationMissions)
        .where(eq(gamificationMissions.opportunityId, opportunityId));

      return res.json({
        success: true,
        missionsCreated: missions.length,
        missions,
      });
    } catch (error) {
      console.error("Error initializing missions:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * POST /virtual-powerplant/update
 * Recalculate virtual power plant stats (call after project completion)
 */
router.post(
  "/virtual-powerplant/update",
  async (req: Request, res: Response) => {
    try {
      await updateVirtualPowerPlant();

      const stats = await db.select().from(virtualPowerPlant).limit(1);
      return res.json({
        success: true,
        updated: stats[0],
      });
    } catch (error) {
      console.error("Error updating virtual power plant:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * GET /profile/by-user/:userId
 * Get profile by user ID (create if not exists)
 */
router.get("/profile/by-user/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const profile = await getOrCreateProfile(
      "account_manager",
      userId,
      undefined,
      "Account Manager"
    );

    return res.json(profile);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /profile/by-client/:clientId
 * Get profile by client ID (create if not exists)
 */
router.get(
  "/profile/by-client/:clientId",
  async (req: Request, res: Response) => {
    try {
      const { clientId } = req.params;

      const profile = await getOrCreateProfile(
        "client",
        undefined,
        clientId,
        "Client"
      );

      return res.json(profile);
    } catch (error) {
      console.error("Error fetching client profile:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
