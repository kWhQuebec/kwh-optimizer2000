import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import { projectBudgets } from "@shared/schema";
import type { ProjectBudget, InsertProjectBudget } from "@shared/schema";

export async function getProjectBudgets(siteId: string): Promise<ProjectBudget[]> {
  return await db.select().from(projectBudgets).where(eq(projectBudgets.siteId, siteId)).orderBy(desc(projectBudgets.createdAt));
}

export async function createProjectBudget(data: InsertProjectBudget): Promise<ProjectBudget> {
  const results = await db.insert(projectBudgets).values(data).returning();
  return results[0];
}

export async function updateProjectBudget(id: string, data: Partial<ProjectBudget>): Promise<ProjectBudget | undefined> {
  const results = await db.update(projectBudgets).set({ ...data, updatedAt: new Date() }).where(eq(projectBudgets.id, id)).returning();
  return results[0];
}

export async function deleteProjectBudget(id: string): Promise<boolean> {
  const results = await db.delete(projectBudgets).where(eq(projectBudgets.id, id)).returning();
  return results.length > 0;
}
