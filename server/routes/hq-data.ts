import { Router } from "express";
import fs from "fs";
import path from "path";
import { authMiddleware, requireAdmin, AuthRequest } from "../middleware/auth";
import { asyncHandler, BadRequestError } from "../middleware/errorHandler";
import { createLogger } from "../lib/logger";
import { HQDownloadResult } from "../services/hqDataFetcher";
import { startBackgroundFetch, getRunningJobId } from "../services/hqBackgroundJobRunner";
import { storage } from "../storage";
import { parseHydroQuebecCSV } from "../routes/siteAnalysisHelpers";

const log = createLogger("HQ-Data");
const router = Router();

// POST /api/admin/hq-data/start-job
// Starts a background HQ data fetch job and returns immediately
router.post("/api/admin/hq-data/start-job", authMiddleware, requireAdmin, asyncHandler(async (req: AuthRequest, res) => {
  const { username, password, siteId, filterAccountNumbers, filterContractNumbers, notifyEmail } = req.body;

  if (!username || !password) {
    throw new BadRequestError("Username and password required");
  }

  const runningJobId = getRunningJobId();
  if (runningJobId) {
    const runningJob = await storage.getHqFetchJob(runningJobId);
    if (runningJob && ["pending", "authenticating", "fetching", "importing"].includes(runningJob.status)) {
      res.json({
        error: "already_running",
        jobId: runningJobId,
        message: "Un processus de récupération est déjà en cours.",
        job: runningJob,
      });
      return;
    }
  }

  const accountFilters = Array.isArray(filterAccountNumbers)
    ? filterAccountNumbers.filter((v: any) => typeof v === "string" && v.trim())
    : undefined;
  const contractFilters = Array.isArray(filterContractNumbers)
    ? filterContractNumbers.filter((v: any) => typeof v === "string" && v.trim())
    : undefined;

  const job = await storage.createHqFetchJob({
    siteId: siteId || null,
    status: "pending",
    startedById: req.user?.id,
    startedAt: new Date(),
  });

  startBackgroundFetch({
    jobId: job.id,
    siteId: siteId || undefined,
    username,
    password,
    filterAccountNumbers: accountFilters,
    filterContractNumbers: contractFilters,
    notifyEmail,
    startedById: req.user?.id,
  });

  log.info(`Started background HQ fetch job ${job.id} for site ${siteId || "all"}`);

  res.json({ jobId: job.id, status: "started" });
}));

// GET /api/admin/hq-data/jobs/:jobId
// Poll job status
router.get("/api/admin/hq-data/jobs/:jobId", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const { jobId } = req.params;
  const job = await storage.getHqFetchJob(jobId);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(job);
}));

// GET /api/admin/hq-data/active-job
// Check if there's an active job running
router.get("/api/admin/hq-data/active-job", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const job = await storage.getActiveHqFetchJob();
  res.json({ job: job || null });
}));

// GET /api/sites/:siteId/hq-jobs
// Get all HQ fetch jobs for a site
router.get("/api/sites/:siteId/hq-jobs", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const { siteId } = req.params;
  const jobs = await storage.getHqFetchJobsBySite(siteId);
  res.json(jobs);
}));

// POST /api/sites/:siteId/import-hq-data
// Legacy bulk-import endpoint (kept for fallback)
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
