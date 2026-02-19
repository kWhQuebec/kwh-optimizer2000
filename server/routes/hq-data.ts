import { Router } from "express";
import fs from "fs";
import path from "path";
import { authMiddleware, requireAdmin, AuthRequest } from "../middleware/auth";
import { asyncHandler, BadRequestError } from "../middleware/errorHandler";
import { createLogger } from "../lib/logger";
import { HQDataFetcher, HQProgress, HQDownloadResult } from "../services/hqDataFetcher";
import { storage } from "../storage";
import { parseHydroQuebecCSV } from "../routes/siteAnalysisHelpers";

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

// POST /api/sites/:siteId/import-hq-data
// Bulk-import HQ download results into a site
router.post("/api/sites/:siteId/import-hq-data", authMiddleware, requireAdmin, asyncHandler(async (req: AuthRequest, res) => {
  const { siteId } = req.params;
  const { results } = req.body as { results: HQDownloadResult[]; siteId: string };

  if (!siteId) {
    throw new BadRequestError("siteId is required");
  }
  if (!results || !Array.isArray(results) || results.length === 0) {
    throw new BadRequestError("results array is required and must not be empty");
  }

  const tmpDir = "/tmp/meter-uploads";
  fs.mkdirSync(tmpDir, { recursive: true });

  let imported = 0;
  const errors: string[] = [];

  const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9_\-]/g, "_").substring(0, 50);

  for (const contractResult of results) {
    for (const csvFile of contractResult.csvFiles) {
      if (!csvFile.csvContent || csvFile.csvContent.trim().length === 0) {
        errors.push(`Empty CSV content for ${contractResult.contractId} ${csvFile.option}`);
        continue;
      }

      const safeContract = sanitize(contractResult.contractId);
      const safeOption = sanitize(csvFile.option);
      const safePeriodStart = sanitize(csvFile.periodStart || "unknown");
      const safePeriodEnd = sanitize(csvFile.periodEnd || "unknown");
      const fileLabel = `${safeContract}_${safeOption}_${safePeriodStart}_${safePeriodEnd}`;
      let tmpPath: string | null = null;

      try {
        const granularity = csvFile.option === "energie-heure" ? "HOUR" : "FIFTEEN_MIN";
        const fileName = `${fileLabel}.csv`;
        tmpPath = path.join(tmpDir, `${Date.now()}_${fileName}`);

        fs.writeFileSync(tmpPath, csvFile.csvContent, "utf-8");

        const meterFile = await storage.createMeterFile({
          siteId,
          fileName,
          granularity,
          hqContractNumber: contractResult.contractId,
          hqMeterNumber: contractResult.meterId,
          periodStart: csvFile.periodStart ? new Date(csvFile.periodStart) : undefined,
          periodEnd: csvFile.periodEnd ? new Date(csvFile.periodEnd) : undefined,
        });

        const readings = await parseHydroQuebecCSV(tmpPath, meterFile.id, granularity);

        if (readings.length > 0) {
          const BATCH_SIZE = 500;
          for (let i = 0; i < readings.length; i += BATCH_SIZE) {
            await storage.createMeterReadings(readings.slice(i, i + BATCH_SIZE));
          }

          const timestamps = readings.map(r => r.timestamp.getTime());
          const minDate = new Date(Math.min(...timestamps));
          const maxDate = new Date(Math.max(...timestamps));

          await storage.updateMeterFile(meterFile.id, {
            status: "PARSED",
            periodStart: minDate,
            periodEnd: maxDate,
          });
        } else {
          await storage.updateMeterFile(meterFile.id, {
            status: "PARSED",
          });
        }

        imported++;
        log.info(`Imported file: ${fileName} with ${readings.length} readings`);
      } catch (err: any) {
        const msg = `Failed to import ${fileLabel}: ${err.message || "Unknown error"}`;
        log.error(msg);
        errors.push(msg);
      } finally {
        if (tmpPath && fs.existsSync(tmpPath)) {
          try { fs.unlinkSync(tmpPath); } catch {}
        }
      }
    }
  }

  res.json({ imported, errors });
}));

export default router;
