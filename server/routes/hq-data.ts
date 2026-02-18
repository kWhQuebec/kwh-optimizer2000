import { Router } from "express";
import { authMiddleware, requireAdmin, AuthRequest } from "../middleware/auth";
import { asyncHandler, BadRequestError } from "../middleware/errorHandler";
import { createLogger } from "../lib/logger";
import { HQDataFetcher, HQProgress, HQDownloadResult } from "../services/hqDataFetcher";

const log = createLogger("HQ-Data");
const router = Router();

// POST /api/admin/hq-data/fetch
// SSE endpoint - streams progress events, then final results
// Body: { username: string, password: string }
router.post("/api/admin/hq-data/fetch", authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    res.status(400).json({ error: "Username and password required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const fetcher = new HQDataFetcher((progress: HQProgress) => {
    // Send progress event
    res.write(`data: ${JSON.stringify({ type: "progress", ...progress })}\n\n`);
  });

  try {
    const results = await fetcher.downloadAllData(username, password);
    
    // Send final results
    res.write(`data: ${JSON.stringify({ type: "complete", results })}\n\n`);
    res.end();
  } catch (error: any) {
    log.error("HQ data fetch failed:", error);
    res.write(`data: ${JSON.stringify({ type: "error", message: error.message || "Unknown error" })}\n\n`);
    res.end();
  }
});

export default router;
