import { eq, and, lt, sql } from "drizzle-orm";
import { db } from "../db";
import { googleSolarCache } from "@shared/schema";
import type { GoogleSolarCache, InsertGoogleSolarCache } from "@shared/schema";

export async function getGoogleSolarCacheByLocation(lat: number, lng: number): Promise<GoogleSolarCache | null> {
  const roundedLat = Math.round(lat * 100000) / 100000;
  const roundedLng = Math.round(lng * 100000) / 100000;

  const result = await db.select().from(googleSolarCache)
    .where(and(
      eq(googleSolarCache.latitude, roundedLat),
      eq(googleSolarCache.longitude, roundedLng)
    ))
    .limit(1);

  return result[0] || null;
}

export async function setGoogleSolarCache(entry: InsertGoogleSolarCache): Promise<GoogleSolarCache> {
  const [result] = await db.insert(googleSolarCache).values(entry).returning();
  return result;
}

export async function incrementCacheHitCount(id: string): Promise<void> {
  await db.update(googleSolarCache)
    .set({ hitCount: sql`${googleSolarCache.hitCount} + 1` })
    .where(eq(googleSolarCache.id, id));
}

export async function cleanupExpiredCache(): Promise<number> {
  const now = new Date();
  const deletedRows = await db.delete(googleSolarCache)
    .where(lt(googleSolarCache.expiresAt, now))
    .returning();

  return deletedRows.length;
}
