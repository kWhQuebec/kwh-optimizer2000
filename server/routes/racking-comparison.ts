import { Router } from "express";
import { authMiddleware, requireStaff, AuthRequest } from "../middleware/auth";
import { getAllRackingConfigs, RackingConfig, RoofColorType } from "@shared/schema";
import { z } from "zod";
import { asyncHandler, BadRequestError } from "../middleware/errorHandler";
import { createLogger } from "../lib/logger";

const log = createLogger("RackingComparison");
const router = Router();

const TOTAL_COST_PER_WATT = {
  'KB Racking': 1.10,
  'Opsun Systems': 1.30,
} as const;

function getTotalCostPerWatt(manufacturer: string): number {
  if (manufacturer.includes('KB')) return TOTAL_COST_PER_WATT['KB Racking'];
  if (manufacturer.includes('Opsun')) return TOTAL_COST_PER_WATT['Opsun Systems'];
  return 1.20;
}

const compareRequestSchema = z.object({
  roofAreaSqM: z.number().positive(),
  roofColorType: z.enum(['white_membrane', 'light', 'dark', 'gravel']).optional(),
});

export interface RackingComparisonResult {
  config: RackingConfig;
  maxSystemSizeKW: number;
  annualProductionKWh: number;
  totalRackingCost: number;
  estimatedTotalCost: number;
  costPerKWhYear1: number;
  isWinner: boolean;
}

router.get("/api/racking/configs", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const configs = getAllRackingConfigs();
  res.json(configs);
}));

router.post("/api/racking/compare", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const parseResult = compareRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    throw new BadRequestError("Invalid request body", parseResult.error.errors);
  }

  const { roofAreaSqM, roofColorType } = parseResult.data;
  const configs = getAllRackingConfigs();

  const results: RackingComparisonResult[] = configs.map((config) => {
    const maxSystemSizeKW = roofAreaSqM * 0.15 * config.densityFactor;
    const annualProductionKWh = maxSystemSizeKW * config.effectiveYieldKWhKWp;
    const totalRackingCost = maxSystemSizeKW * 1000 * (config.pricePerWatt + config.ballastPerWatt);
    const totalCostPerWatt = getTotalCostPerWatt(config.manufacturer);
    const estimatedTotalCost = maxSystemSizeKW * 1000 * totalCostPerWatt;
    const costPerKWhYear1 = estimatedTotalCost / annualProductionKWh;

    return {
      config,
      maxSystemSizeKW,
      annualProductionKWh,
      totalRackingCost,
      estimatedTotalCost,
      costPerKWhYear1,
      isWinner: false,
    };
  });

  results.sort((a, b) => a.costPerKWhYear1 - b.costPerKWhYear1);
  if (results.length > 0) {
    results[0].isWinner = true;
  }

  res.json({
    roofAreaSqM,
    roofColorType: roofColorType || null,
    results,
    winnerType: results.length > 0 ? results[0].config.type : null,
  });
}));

export default router;
