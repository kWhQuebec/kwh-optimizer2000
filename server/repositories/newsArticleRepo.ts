import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import { newsArticles } from "@shared/schema";
import type { NewsArticle, InsertNewsArticle } from "@shared/schema";

export async function getNewsArticles(status?: string): Promise<NewsArticle[]> {
  if (status) {
    return db.select().from(newsArticles)
      .where(eq(newsArticles.status, status))
      .orderBy(desc(newsArticles.publishedAt));
  }
  return db.select().from(newsArticles).orderBy(desc(newsArticles.publishedAt));
}

export async function getNewsArticle(id: string): Promise<NewsArticle | undefined> {
  const result = await db.select().from(newsArticles).where(eq(newsArticles.id, id)).limit(1);
  return result[0];
}

export async function getNewsArticleByUrl(url: string): Promise<NewsArticle | undefined> {
  const result = await db.select().from(newsArticles).where(eq(newsArticles.sourceUrl, url)).limit(1);
  return result[0];
}

export async function createNewsArticle(article: InsertNewsArticle): Promise<NewsArticle> {
  const [result] = await db.insert(newsArticles).values(article).returning();
  return result;
}

export async function updateNewsArticle(id: string, updates: Partial<NewsArticle>): Promise<NewsArticle | undefined> {
  const [result] = await db.update(newsArticles)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(newsArticles.id, id))
    .returning();
  return result;
}

export async function deleteNewsArticle(id: string): Promise<boolean> {
  const result = await db.delete(newsArticles).where(eq(newsArticles.id, id)).returning();
  return result.length > 0;
}
