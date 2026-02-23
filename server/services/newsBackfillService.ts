import { analyzeArticleRelevance } from "./newsCurationService";
import { createLogger } from "../lib/logger";
import type { IStorage } from "../storage";
import type { RawNewsItem } from "./newsRssService";

const log = createLogger("NewsBackfill");

export async function runNewsBackfillJob(storage: IStorage, autoRejectThreshold: number = 40): Promise<{
  total: number;
  analyzed: number;
  autoRejected: number;
}> {
  log.info("Starting news AI backfill job...");

  const allPending = await storage.getNewsArticles("pending");
  const unanalyzed = allPending.filter(a => a.aiRelevanceScore === null || a.aiRelevanceScore === undefined);

  log.info(`Found ${unanalyzed.length} unanalyzed articles out of ${allPending.length} pending`);

  if (unanalyzed.length === 0) {
    log.info("No articles to backfill");
    return { total: 0, analyzed: 0, autoRejected: 0 };
  }

  let analyzed = 0;
  let autoRejected = 0;
  let errors = 0;

  for (let i = 0; i < unanalyzed.length; i++) {
    const article = unanalyzed[i];
    const raw: RawNewsItem = {
      title: article.originalTitle || "",
      url: article.sourceUrl,
      description: article.originalExcerpt || "",
      pubDate: article.publishedAt ? new Date(article.publishedAt) : null,
      sourceName: article.sourceName || "Unknown",
      language: (article.language === "en" ? "en" : "fr") as "fr" | "en",
    };

    try {
      const analysis = await analyzeArticleRelevance(raw);
      const shouldReject = analysis.relevanceScore < autoRejectThreshold;

      await storage.updateNewsArticle(article.id, {
        aiRelevanceScore: analysis.relevanceScore,
        aiSummaryFr: analysis.summaryFr,
        aiCommentFr: analysis.commentFr,
        aiSocialPostFr: analysis.socialPostFr,
        aiSocialPostEn: analysis.socialPostEn,
        aiTags: analysis.tags,
        aiProcessedAt: new Date(),
        category: analysis.category,
        ...(shouldReject ? { status: "rejected" } : {}),
      });

      analyzed++;
      if (shouldReject) autoRejected++;

      if ((analyzed + errors) % 10 === 0 || i === unanalyzed.length - 1) {
        log.info(`Backfill progress: ${analyzed} analyzed, ${errors} errors, ${autoRejected} auto-rejected out of ${i + 1}/${unanalyzed.length}`);
      }
    } catch (error) {
      errors++;
      log.error(`Failed to analyze article ${article.id} "${article.originalTitle?.substring(0, 50)}":`, error);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  log.info(`Backfill complete: ${analyzed} analyzed, ${autoRejected} auto-rejected (score < ${autoRejectThreshold}), ${errors} errors`);
  return { total: unanalyzed.length, analyzed, autoRejected };
}
