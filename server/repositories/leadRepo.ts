import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import { leads } from "@shared/schema";
import type { Lead, InsertLead } from "@shared/schema";

export async function getLeads(): Promise<Lead[]> {
  return db.select().from(leads).orderBy(desc(leads.createdAt));
}

export async function getLead(id: string): Promise<Lead | undefined> {
  const result = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  return result[0];
}

export async function createLead(lead: InsertLead): Promise<Lead> {
  const [result] = await db.insert(leads).values({
    ...lead,
    source: "web_form",
  }).returning();
  return result;
}

export async function updateLead(id: string, lead: Partial<Lead>): Promise<Lead | undefined> {
  const [result] = await db.update(leads).set({ ...lead, updatedAt: new Date() }).where(eq(leads.id, id)).returning();
  return result;
}
