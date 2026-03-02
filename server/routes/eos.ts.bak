import { Router } from "express";
import { db } from "../db";
import { scorecardMetrics, rocks, eosIssues, eosTodos, eosVto } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";

const router = Router();

// ─── SCORECARD ───────────────────────────────────────────
router.get("/api/eos/scorecard", async (_req, res) => {
  try {
    const metrics = await db.select().from(scorecardMetrics)
      .where(eq(scorecardMetrics.isActive, true))
      .orderBy(scorecardMetrics.id);
    res.json(metrics);
  } catch (error) {
    console.error("[EOS] Scorecard error:", error);
    res.json([]);
  }
});

router.post("/api/eos/scorecard", async (req, res) => {
  try {
    const { name, target, unit, owner, category } = req.body;
    const currentWeek = Math.ceil((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
    const [metric] = await db.insert(scorecardMetrics).values({
      name,
      target: Number(target),
      unit: unit || "",
      owner: owner || "",
      category: category || "general",
      weekNumber: currentWeek,
      year: new Date().getFullYear(),
    }).returning();
    res.json(metric);
  } catch (error) {
    console.error("[EOS] Add scorecard metric error:", error);
    res.status(500).json({ error: "Failed to add metric" });
  }
});

router.patch("/api/eos/scorecard/:id", async (req, res) => {
  try {
    const { actual, target, trend } = req.body;
    const updates: any = { updatedAt: new Date() };
    if (actual !== undefined) updates.actual = Number(actual);
    if (target !== undefined) updates.target = Number(target);
    if (trend !== undefined) updates.trend = trend;
    const [metric] = await db.update(scorecardMetrics)
      .set(updates)
      .where(eq(scorecardMetrics.id, Number(req.params.id)))
      .returning();
    res.json(metric);
  } catch (error) {
    console.error("[EOS] Update scorecard error:", error);
    res.status(500).json({ error: "Failed to update metric" });
  }
});

// ─── ROCKS ───────────────────────────────────────────────
router.get("/api/eos/rocks", async (_req, res) => {
  try {
    const allRocks = await db.select().from(rocks).orderBy(desc(rocks.createdAt));
    res.json(allRocks);
  } catch (error) {
    console.error("[EOS] Rocks error:", error);
    res.json([]);
  }
});

router.post("/api/eos/rocks", async (req, res) => {
  try {
    const { title, owner, quarter, priority, description } = req.body;
    const [rock] = await db.insert(rocks).values({
      title,
      owner,
      quarter: quarter || `Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}`,
      year: new Date().getFullYear(),
      priority: priority || "department",
      description: description || "",
    }).returning();
    res.json(rock);
  } catch (error) {
    console.error("[EOS] Add rock error:", error);
    res.status(500).json({ error: "Failed to add rock" });
  }
});

router.patch("/api/eos/rocks/:id", async (req, res) => {
  try {
    const { status, progress, title } = req.body;
    const updates: any = { updatedAt: new Date() };
    if (status !== undefined) updates.status = status;
    if (progress !== undefined) updates.progress = Number(progress);
    if (title !== undefined) updates.title = title;
    if (status === "done") updates.completedAt = new Date();
    const [rock] = await db.update(rocks)
      .set(updates)
      .where(eq(rocks.id, Number(req.params.id)))
      .returning();
    res.json(rock);
  } catch (error) {
    console.error("[EOS] Update rock error:", error);
    res.status(500).json({ error: "Failed to update rock" });
  }
});

// ─── ISSUES ──────────────────────────────────────────────
router.get("/api/eos/issues", async (_req, res) => {
  try {
    const issues = await db.select().from(eosIssues).orderBy(desc(eosIssues.votes));
    res.json(issues);
  } catch (error) {
    console.error("[EOS] Issues error:", error);
    res.json([]);
  }
});

router.post("/api/eos/issues", async (req, res) => {
  try {
    const { title, priority, description } = req.body;
    const [issue] = await db.insert(eosIssues).values({
      title,
      priority: priority || "medium",
      description: description || "",
    }).returning();
    res.json(issue);
  } catch (error) {
    console.error("[EOS] Add issue error:", error);
    res.status(500).json({ error: "Failed to add issue" });
  }
});

router.patch("/api/eos/issues/:id", async (req, res) => {
  try {
    const { status, votes, resolution, priority } = req.body;
    const updates: any = { updatedAt: new Date() };
    if (status !== undefined) updates.status = status;
    if (votes !== undefined) updates.votes = Number(votes);
    if (resolution !== undefined) updates.resolution = resolution;
    if (priority !== undefined) updates.priority = priority;
    if (status === "solved") updates.resolvedAt = new Date();
    const [issue] = await db.update(eosIssues)
      .set(updates)
      .where(eq(eosIssues.id, Number(req.params.id)))
      .returning();
    res.json(issue);
  } catch (error) {
    console.error("[EOS] Update issue error:", error);
    res.status(500).json({ error: "Failed to update issue" });
  }
});

router.post("/api/eos/issues/:id/vote", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [current] = await db.select().from(eosIssues).where(eq(eosIssues.id, id));
    if (!current) return res.status(404).json({ error: "Issue not found" });
    const [issue] = await db.update(eosIssues)
      .set({ votes: (current.votes || 0) + 1 })
      .where(eq(eosIssues.id, id))
      .returning();
    res.json(issue);
  } catch (error) {
    console.error("[EOS] Vote issue error:", error);
    res.status(500).json({ error: "Failed to vote" });
  }
});

// ─── TODOS (L10) ─────────────────────────────────────────
router.get("/api/eos/todos", async (_req, res) => {
  try {
    const todos = await db.select().from(eosTodos).orderBy(desc(eosTodos.createdAt));
    res.json(todos);
  } catch (error) {
    console.error("[EOS] Todos error:", error);
    res.json([]);
  }
});

router.post("/api/eos/todos", async (req, res) => {
  try {
    const { text, owner, dueDate } = req.body;
    const [todo] = await db.insert(eosTodos).values({
      text,
      owner: owner || "",
      dueDate: dueDate || "",
    }).returning();
    res.json(todo);
  } catch (error) {
    console.error("[EOS] Add todo error:", error);
    res.status(500).json({ error: "Failed to add todo" });
  }
});

router.patch("/api/eos/todos/:id", async (req, res) => {
  try {
    const { done, text } = req.body;
    const updates: any = {};
    if (done !== undefined) {
      updates.done = done;
      updates.completedAt = done ? new Date() : null;
    }
    if (text !== undefined) updates.text = text;
    const [todo] = await db.update(eosTodos)
      .set(updates)
      .where(eq(eosTodos.id, Number(req.params.id)))
      .returning();
    res.json(todo);
  } catch (error) {
    console.error("[EOS] Update todo error:", error);
    res.status(500).json({ error: "Failed to update todo" });
  }
});

router.delete("/api/eos/todos/:id", async (req, res) => {
  try {
    await db.delete(eosTodos).where(eq(eosTodos.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (error) {
    console.error("[EOS] Delete todo error:", error);
    res.status(500).json({ error: "Failed to delete todo" });
  }
});

// ─── V/TO ────────────────────────────────────────────────
router.get("/api/eos/vto", async (_req, res) => {
  try {
    const sections = await db.select().from(eosVto).orderBy(eosVto.section);
    res.json(sections);
  } catch (error) {
    console.error("[EOS] VTO error:", error);
    res.json([]);
  }
});

router.put("/api/eos/vto/:section", async (req, res) => {
  try {
    const { content, updatedBy } = req.body;
    const section = req.params.section;
    // Upsert
    const [existing] = await db.select().from(eosVto).where(eq(eosVto.section, section));
    let result;
    if (existing) {
      [result] = await db.update(eosVto)
        .set({ content, updatedBy, updatedAt: new Date() })
        .where(eq(eosVto.section, section))
        .returning();
    } else {
      [result] = await db.insert(eosVto).values({ section, content, updatedBy }).returning();
    }
    res.json(result);
  } catch (error) {
    console.error("[EOS] Update VTO error:", error);
    res.status(500).json({ error: "Failed to update VTO" });
  }
});

export default router;
