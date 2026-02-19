import { eq, desc, inArray } from "drizzle-orm";
import { db } from "../db";
import { hqFetchJobs, InsertHqFetchJob, HqFetchJob } from "@shared/schema";

export async function getHqFetchJob(id: string): Promise<HqFetchJob | undefined> {
  const [job] = await db.select().from(hqFetchJobs).where(eq(hqFetchJobs.id, id));
  return job;
}

export async function getHqFetchJobsBySite(siteId: string): Promise<HqFetchJob[]> {
  return db.select().from(hqFetchJobs).where(eq(hqFetchJobs.siteId, siteId)).orderBy(desc(hqFetchJobs.createdAt));
}

export async function getActiveHqFetchJob(): Promise<HqFetchJob | undefined> {
  const [job] = await db.select().from(hqFetchJobs)
    .where(inArray(hqFetchJobs.status, ["pending", "authenticating", "fetching", "importing"]))
    .orderBy(desc(hqFetchJobs.createdAt))
    .limit(1);
  return job;
}

export async function createHqFetchJob(job: InsertHqFetchJob): Promise<HqFetchJob> {
  const [created] = await db.insert(hqFetchJobs).values(job).returning();
  return created;
}

export async function updateHqFetchJob(id: string, updates: Partial<HqFetchJob>): Promise<HqFetchJob | undefined> {
  const [updated] = await db.update(hqFetchJobs).set(updates).where(eq(hqFetchJobs.id, id)).returning();
  return updated;
}
