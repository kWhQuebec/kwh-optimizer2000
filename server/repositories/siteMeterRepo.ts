import { eq } from "drizzle-orm";
import { db } from "../db";
import { siteMeters } from "@shared/schema";
import type { SiteMeter, InsertSiteMeter } from "@shared/schema";

export async function getSiteMeters(siteId: string): Promise<SiteMeter[]> {
  return db.select().from(siteMeters).where(eq(siteMeters.siteId, siteId));
}

export async function getSiteMeter(id: string): Promise<SiteMeter | undefined> {
  const rows = await db.select().from(siteMeters).where(eq(siteMeters.id, id)).limit(1);
  return rows[0];
}

export async function createSiteMeter(data: InsertSiteMeter): Promise<SiteMeter> {
  const [meter] = await db.insert(siteMeters).values(data).returning();
  return meter;
}

export async function updateSiteMeter(id: string, data: Partial<SiteMeter>): Promise<SiteMeter | undefined> {
  const [updated] = await db.update(siteMeters).set({ ...data, updatedAt: new Date() }).where(eq(siteMeters.id, id)).returning();
  return updated;
}

export async function deleteSiteMeter(id: string): Promise<void> {
  await db.delete(siteMeters).where(eq(siteMeters.id, id));
}
