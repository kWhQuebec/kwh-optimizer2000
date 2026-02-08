import { Router } from "express";
import { authMiddleware, requireStaff, AuthRequest } from "../middleware/auth";
import { storage } from "../storage";
import { insertPartnershipSchema } from "@shared/schema";
import { asyncHandler, NotFoundError } from "../middleware/errorHandler";
import { createLogger } from "../lib/logger";

const log = createLogger("Partnerships");
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

router.get("/api/partnerships", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const partnerships = await storage.getPartnerships();
  res.json(partnerships);
}));

router.get("/api/partnerships/:id", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const partnership = await storage.getPartnership(req.params.id);
  if (!partnership) {
    throw new NotFoundError("Partnership");
  }
  res.json(partnership);
}));

router.post("/api/partnerships", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const preprocessed = preprocessPartnershipDates(req.body);
  const data = insertPartnershipSchema.parse(preprocessed);
  const partnership = await storage.createPartnership(data);
  res.status(201).json(partnership);
}));

router.patch("/api/partnerships/:id", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const existing = await storage.getPartnership(req.params.id);
  if (!existing) {
    throw new NotFoundError("Partnership");
  }
  const preprocessed = preprocessPartnershipDates(req.body);
  const data = insertPartnershipSchema.partial().parse(preprocessed);
  const partnership = await storage.updatePartnership(req.params.id, data);
  res.json(partnership);
}));

router.delete("/api/partnerships/:id", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const existing = await storage.getPartnership(req.params.id);
  if (!existing) {
    throw new NotFoundError("Partnership");
  }
  await storage.deletePartnership(req.params.id);
  res.status(204).send();
}));

export default router;
