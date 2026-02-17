import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import { benchmarks } from "@shared/schema";
import type { Benchmark, InsertBenchmark } from "@shared/schema";

export async function getBenchmarksBySite(siteId: string): Promise<Benchmark[]> {
  return await db.select().from(benchmarks).where(eq(benchmarks.siteId, siteId)).orderBy(desc(benchmarks.createdAt));
}

export async function getBenchmark(id: string): Promise<Benchmark | undefined> {
  const results = await db.select().from(benchmarks).where(eq(benchmarks.id, id)).limit(1);
  return results[0];
}

export async function createBenchmark(data: InsertBenchmark): Promise<Benchmark> {
  const results = await db.insert(benchmarks).values(data).returning();
  return results[0];
}

export async function updateBenchmark(id: string, data: Partial<InsertBenchmark>): Promise<Benchmark | undefined> {
  const results = await db.update(benchmarks).set({ ...data, updatedAt: new Date() }).where(eq(benchmarks.id, id)).returning();
  return results[0];
}

export async function deleteBenchmark(id: string): Promise<boolean> {
  const results = await db.delete(benchmarks).where(eq(benchmarks.id, id)).returning();
  return results.length > 0;
}
