import { Router } from "express";
import { db } from "../db";

const router = Router();

// Scorecard endpoints
router.get("/api/eos/scorecard", async (_req, res) => {
  try {
    // TODO: Connect to actual scorecard table when created
    res.json([]);
  } catch (error) {
    console.error("[EOS] Scorecard error:", error);
    res.status(500).json({ error: "Failed to fetch scorecard" });
  }
});

router.post("/api/eos/scorecard", async (req, res) => {
  try {
    const { name, target, unit, owner } = req.body;
    // TODO: Insert into scorecard table
    res.json({ id: Date.now(), name, target: Number(target), unit, owner, actual: 0, trend: "flat" });
  } catch (error) {
    console.error("[EOS] Add scorecard metric error:", error);
    res.status(500).json({ error: "Failed to add metric" });
  }
});

// Rocks endpoints
router.get("/api/eos/rocks", async (_req, res) => {
  try {
    res.json([]);
  } catch (error) {
    console.error("[EOS] Rocks error:", error);
    res.status(500).json({ error: "Failed to fetch rocks" });
  }
});

router.post("/api/eos/rocks", async (req, res) => {
  try {
    const { title, owner, quarter, priority } = req.body;
    res.json({ id: Date.now(), title, owner, quarter, priority, status: "on-track", progress: 0 });
  } catch (error) {
    console.error("[EOS] Add rock error:", error);
    res.status(500).json({ error: "Failed to add rock" });
  }
});

// Issues endpoints
router.get("/api/eos/issues", async (_req, res) => {
  try {
    res.json([]);
  } catch (error) {
    console.error("[EOS] Issues error:", error);
    res.status(500).json({ error: "Failed to fetch issues" });
  }
});

router.post("/api/eos/issues", async (req, res) => {
  try {
    const { title, priority } = req.body;
    res.json({ id: Date.now(), title, priority: priority || "medium", status: "open", votes: 0 });
  } catch (error) {
    console.error("[EOS] Add issue error:", error);
    res.status(500).json({ error: "Failed to add issue" });
  }
});

// L10 To-Do endpoints
router.get("/api/eos/todos", async (_req, res) => {
  try {
    res.json([]);
  } catch (error) {
    console.error("[EOS] Todos error:", error);
    res.status(500).json({ error: "Failed to fetch todos" });
  }
});

router.post("/api/eos/todos", async (req, res) => {
  try {
    const { text, owner, dueDate } = req.body;
    res.json({ id: Date.now(), text, owner, dueDate, done: false });
  } catch (error) {
    console.error("[EOS] Add todo error:", error);
    res.status(500).json({ error: "Failed to add todo" });
  }
});

export default router;
