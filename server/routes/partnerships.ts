import { Router, Response } from "express";
import { z } from "zod";
import { authMiddleware, requireStaff, AuthRequest } from "../middleware/auth";
import { storage } from "../storage";
import { insertPartnershipSchema } from "@shared/schema";

const router = Router();

function preprocessPartnershipDates(body: Record<string, unknown>) {
  const dateFields = ['firstContactDate', 'lastContactDate', 'nextFollowUpDate', 'expectedDecisionDate', 'agreementStartDate', 'agreementEndDate'];
  const result = { ...body };
  for (const field of dateFields) {
    if (result[field] && typeof result[field] === 'string') {
      result[field] = new Date(result[field] as string);
    }
  }
  return result;
}

router.get("/api/partnerships", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const partnerships = await storage.getPartnerships();
    res.json(partnerships);
  } catch (error) {
    console.error("Error fetching partnerships:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/partnerships/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const partnership = await storage.getPartnership(req.params.id);
    if (!partnership) {
      return res.status(404).json({ error: "Partnership not found" });
    }
    res.json(partnership);
  } catch (error) {
    console.error("Error fetching partnership:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/partnerships", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const preprocessed = preprocessPartnershipDates(req.body);
    const data = insertPartnershipSchema.parse(preprocessed);
    const partnership = await storage.createPartnership(data);
    res.status(201).json(partnership);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error("Error creating partnership:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/api/partnerships/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const existing = await storage.getPartnership(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Partnership not found" });
    }
    const preprocessed = preprocessPartnershipDates(req.body);
    const data = insertPartnershipSchema.partial().parse(preprocessed);
    const partnership = await storage.updatePartnership(req.params.id, data);
    res.json(partnership);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error("Error updating partnership:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/api/partnerships/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const existing = await storage.getPartnership(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Partnership not found" });
    }
    await storage.deletePartnership(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting partnership:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
