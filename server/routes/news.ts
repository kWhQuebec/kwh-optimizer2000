import { Router } from "express";
import { z } from "zod";
import { authMiddleware, requireStaff, AuthRequest } from "../middleware/auth";
import { publicApiLimiter } from "../middleware/rateLimiter";
import { storage } from "../storage";
import { asyncHandler, NotFoundError, BadRequestError } from "../middleware/errorHandler";
import { runNewsFetchJob } from "../services/newsJobRunner";
import { sendNewsCollectionNotification } from "../services/newsNotificationService";
import { createLogger } from "../lib/logger";

const log = createLogger("News");
const router = Router();

const VALID_STATUSES = ["pending", "approved", "rejected", "published"] as const;

const newsUpdateSchema = z.object({
  status: z.enum(VALID_STATUSES).optional(),
  editedCommentFr: z.string().optional(),
  editedSocialPostFr: z.string().optional(),
  category: z.string().optional(),
}).strict();

router.get("/api/admin/news", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const status = req.query.status as string | undefined;
  if (status && !VALID_STATUSES.includes(status as any)) {
    throw new BadRequestError("Invalid status filter");
  }
  const articles = await storage.getNewsArticles(status);
  res.json(articles);
}));

router.post("/api/admin/news/fetch", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  log.info(`News fetch triggered by user ${req.userId}`);
  const result = await runNewsFetchJob(storage);
  sendNewsCollectionNotification(result).catch(err => log.error("Notification email failed:", err));
  res.json(result);
}));

router.patch("/api/admin/news/:id", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const parsed = newsUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new BadRequestError(`Invalid update: ${parsed.error.errors.map(e => e.message).join(", ")}`);
  }

  const updates: Record<string, any> = { ...parsed.data };
  if (updates.status === "approved" || updates.status === "rejected" || updates.status === "published") {
    updates.reviewedBy = req.userId;
    updates.reviewedAt = new Date();
  }
  if (updates.status === "published") {
    updates.publishedToSiteAt = new Date();
  }
  const article = await storage.updateNewsArticle(req.params.id, updates);
  if (!article) {
    throw new NotFoundError("News article");
  }
  res.json(article);
}));

router.delete("/api/admin/news/:id", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const deleted = await storage.deleteNewsArticle(req.params.id);
  if (!deleted) {
    throw new NotFoundError("News article");
  }
  res.json({ success: true });
}));

router.get("/api/public/news/:slug", publicApiLimiter, asyncHandler(async (req: AuthRequest, res) => {
  const article = await storage.getNewsArticleBySlug(req.params.slug);
  if (!article || article.status !== "published") {
    throw new NotFoundError("News article");
  }
  storage.incrementNewsViewCount(article.id).catch(() => {});
  res.json(article);
}));

router.get("/api/public/news", publicApiLimiter, asyncHandler(async (req: AuthRequest, res) => {
  const articles = await storage.getNewsArticles("published");
  res.json(articles.slice(0, 20));
}));

export default router;
