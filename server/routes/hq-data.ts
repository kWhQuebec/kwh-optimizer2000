import { Router } from "express";
import { authMiddleware, requireAdmin, AuthRequest } from "../middleware/auth";
import { asyncHandler, BadRequestError } from "../middleware/errorHandler";
import { createLogger } from "../lib/logger";
import { HQDataFetcher, HQProgress, HQDownloadResult } from "../services/hqDataFetcher";

const log = createLogger("HQ-Data");
const router = Router();

// POST /api/admin/hq-data/fetch
// SSE endpoint - streams progress events, then final results
// Body: { username, password, filterAccountNumbers?, filterContractNumbers? }
router.post("/api/admin/hq-data/fetch", authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
  const { username, password, filterAccountNumbers, filterContractNumbers } = req.body;
  
  if (!username || !password) {
    res.status(400).json({ error: "Username and password required" });
    return;
  }

  const accountFilters = Array.isArray(filterAccountNumbers)
    ? filterAccountNumbers.filter((v: any) => typeof v === "string" && v.trim())
    : undefined;
  const contractFilters = Array.isArray(filterContractNumbers)
    ? filterContractNumbers.filter((v: any) => typeof v === "string" && v.trim())
    : undefined;

  if (accountFilters?.length) {
    log.info(`Filtering fetch by account numbers: ${accountFilters.join(", ")}`);
  }
  if (contractFilters?.length) {
    log.info(`Filtering fetch by contract numbers: ${contractFilters.join(", ")}`);
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const fetcher = new HQDataFetcher((progress: HQProgress) => {
    res.write(`data: ${JSON.stringify({ type: "progress", ...progress })}\n\n`);
  });

  try {
    const results = await fetcher.downloadAllData(
      username,
      password,
      accountFilters,
      contractFilters,
    );
    
    res.write(`data: ${JSON.stringify({ type: "complete", results })}\n\n`);
    res.end();
  } catch (error: any) {
    log.error("HQ data fetch failed:", error);
    res.write(`data: ${JSON.stringify({ type: "error", message: error.message || "Unknown error" })}\n\n`);
    res.end();
  }
});

export default router;
