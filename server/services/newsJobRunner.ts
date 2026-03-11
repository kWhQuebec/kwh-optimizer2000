import { fetchNewsFromRss } from "./newsRssService";
import { analyzeArticleRelevance, AUTO_REJECT_THRESHOLD } from "./newsCurationService";
import { batchProcess } from "../replit_integrations/batch";
import { createLogger } from "../lib/logger";
import type { IStorage } from "../storage";

const log = createLogger("NewsJob");

function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 80);
  const suffix = Math.random().toString(36).substring(2, 8);
  return `${base}-${suffix}`;
}

export async function runNewsFetchJob(storage: IStorage): Promise<{
  fetched: number;
  newArticles: number;
  analyzed: number;
}> {
  log.info("Starting news fetch job...");

  const rawItems = await fetchNewsFromRss();
  log.info(`Fetched ${rawItems.length} articles from RSS feeds`);

  const newItems = [];
  for (const item of rawItems) {
    const existing = await storage.getNewsArticleByUrl(item.url);
    if (!existing) {
      newItems.push(item);
    }
  }
  log.info(`${newItems.length} new articles to process (${rawItems.length - newItems.length} duplicates skipped)`);

  const savedArticles = [];
  for (const item of newItems) {
    try {
      const article = await storage.createNewsArticle({
        sourceUrl: item.url,
        sourceName: item.sourceName,
        originalTitle: item.title,
        originalExcerpt: item.description || null,
        publishedAt: item.pubDate,
        imageUrl: item.imageUrl || null,
        language: item.language,
        status: "pending",
        slug: generateSlug(item.title),
      });
      savedArticles.push({ article, raw: item });
    } catch (error) {
      log.error(`Failed to save article "${item.title}":`, error);
    }
  }
  log.info(`Saved ${savedArticles.length} new articles to database`);

  let analyzed = 0;
  let failed = 0;
  if (savedArticles.length > 0) {
    const results = await batchProcess(
      savedArticles,
      async (item) => {
        try {
          const analysis = await analyzeArticleRelevance(item.raw);
          return { articleId: item.article.id, analysis, success: true as const };
        } catch (error) {
          log.error(`AI analysis failed for article "${item.raw.title}":`, error);
          return { articleId: item.article.id, success: false as const };
        }
      },
      {
        concurrency: 2,
        retries: 3,
        onProgress: (completed: number, total: number, _item: unknown) => {
          log.info(`AI analysis progress: ${completed}/${total}`);
        },
      }
    );

    let autoRejected = 0;
    for (const result of results) {
      if (result && result.success && 'analysis' in result) {
        try {
          const shouldReject = result.analysis.relevanceScore < AUTO_REJECT_THRESHOLD;
          await storage.updateNewsArticle(result.articleId, {
            aiRelevanceScore: result.analysis.relevanceScore,
            aiTitleFr: result.analysis.titleFr,
          aiSummaryFr: result.analysis.summaryFr,
            aiCommentFr: result.analysis.commentFr,
            aiSocialPostFr: result.analysis.socialPostFr,
            aiSocialPostEn: result.analysis.socialPostEn,
            aiTags: result.analysis.tags,
            aiProcessedAt: new Date(),
            category: result.analysis.category,
            ...(shouldReject ? { status: "rejected" } : {}),
          });
          analyzed++;
          if (shouldReject) autoRejected++;
        } catch (error) {
          log.error(`Failed to update article ${result.articleId} with AI results:`, error);
        }
      } else if (result && !result.success) {
        failed++;
      }
    }
    if (autoRejected > 0) {
      log.info(`Auto-rejected ${autoRejected} articles with relevance score < ${AUTO_REJECT_THRESHOLD}`);
    }
    if (failed > 0) {
      log.warn(`${failed} articles failed AI analysis and remain without AI content`);
    }
  }

  log.info(`News fetch job complete: fetched=${rawItems.length}, new=${savedArticles.length}, analyzed=${analyzed}, failed=${failed}`);
  return {
    fetched: rawItems.length,
    newArticles: savedArticles.length,
    analyzed,
  };
}
