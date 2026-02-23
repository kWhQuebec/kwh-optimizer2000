import { fetchNewsFromRss } from "./newsRssService";
import { analyzeArticleRelevance } from "./newsCurationService";
import { batchProcess } from "../replit_integrations/batch";
import { createLogger } from "../lib/logger";
import type { IStorage } from "../storage";

const log = createLogger("NewsJob");

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
      });
      savedArticles.push({ article, raw: item });
    } catch (error) {
      log.error(`Failed to save article "${item.title}":`, error);
    }
  }
  log.info(`Saved ${savedArticles.length} new articles to database`);

  let analyzed = 0;
  if (savedArticles.length > 0) {
    try {
      const results = await batchProcess(
        savedArticles,
        async (item) => {
          const analysis = await analyzeArticleRelevance(item.raw);
          return { articleId: item.article.id, analysis };
        },
        {
          concurrency: 2,
          retries: 3,
          onProgress: (completed: number, total: number, _item: unknown) => {
            log.info(`AI analysis progress: ${completed}/${total}`);
          },
        }
      );

      for (const result of results) {
        if (result) {
          try {
            await storage.updateNewsArticle(result.articleId, {
              aiRelevanceScore: result.analysis.relevanceScore,
              aiSummaryFr: result.analysis.summaryFr,
              aiCommentFr: result.analysis.commentFr,
              aiSocialPostFr: result.analysis.socialPostFr,
              aiSocialPostEn: result.analysis.socialPostEn,
              aiTags: result.analysis.tags,
              aiProcessedAt: new Date(),
            });
            analyzed++;
          } catch (error) {
            log.error(`Failed to update article ${result.articleId} with AI results:`, error);
          }
        }
      }
    } catch (error) {
      log.error("Batch AI analysis failed:", error);
    }
  }

  log.info(`News fetch job complete: fetched=${rawItems.length}, new=${savedArticles.length}, analyzed=${analyzed}`);
  return {
    fetched: rawItems.length,
    newArticles: savedArticles.length,
    analyzed,
  };
}
