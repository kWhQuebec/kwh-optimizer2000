import { Router } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { storage } from "../storage";
import { insertBenchmarkSchema } from "@shared/schema";
import { asyncHandler, NotFoundError } from "../middleware/errorHandler";

const router = Router();

router.get("/sites/:siteId/benchmarks", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const benchmarks = await storage.getBenchmarksBySite(req.params.siteId);
  res.json(benchmarks);
}));

router.post("/sites/:siteId/benchmarks", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const body = { ...req.body, siteId: req.params.siteId };
  if (body.reportDate && typeof body.reportDate === 'string') {
    body.reportDate = new Date(body.reportDate);
  }
  const data = insertBenchmarkSchema.parse(body);
  const benchmark = await storage.createBenchmark(data);
  res.status(201).json(benchmark);
}));

router.patch("/benchmarks/:id", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const existing = await storage.getBenchmark(req.params.id);
  if (!existing) throw new NotFoundError("Benchmark");
  const body = { ...req.body };
  if (body.reportDate && typeof body.reportDate === 'string') {
    body.reportDate = new Date(body.reportDate);
  }
  const updated = await storage.updateBenchmark(req.params.id, body);
  res.json(updated);
}));

router.delete("/benchmarks/:id", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const deleted = await storage.deleteBenchmark(req.params.id);
  if (!deleted) throw new NotFoundError("Benchmark");
  res.json({ success: true });
}));

export default router;
