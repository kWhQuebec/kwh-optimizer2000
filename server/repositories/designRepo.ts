import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import { designs, bomItems, simulationRuns, sites, clients, designAgreements } from "@shared/schema";
import type {
  Design, InsertDesign, BomItem, InsertBomItem,
  SimulationRun, Site, Client,
  DesignAgreement, InsertDesignAgreement,
} from "@shared/schema";

// ==================== DESIGNS ====================

export async function getDesigns(): Promise<(Design & { simulationRun: SimulationRun & { site: Site & { client: Client } } })[]> {
  const allDesigns = await db.select().from(designs).orderBy(desc(designs.createdAt));
  const allRuns = await db.select().from(simulationRuns);
  const allSites = await db.select().from(sites);
  const allClients = await db.select().from(clients);

  const runMap = new Map(allRuns.map(r => [r.id, r]));
  const siteMap = new Map(allSites.map(s => [s.id, s]));
  const clientMap = new Map(allClients.map(c => [c.id, c]));

  return allDesigns.map(design => {
    const simRun = runMap.get(design.simulationRunId);
    const site = simRun ? siteMap.get(simRun.siteId) : undefined;
    const client = site ? clientMap.get(site.clientId) : undefined;
    return {
      ...design,
      simulationRun: { ...simRun!, site: { ...site!, client: client! } },
    };
  }).filter(d => d.simulationRun && d.simulationRun.site && d.simulationRun.site.client);
}

export async function getDesign(id: string): Promise<(Design & { bomItems: BomItem[] }) | undefined> {
  const [design] = await db.select().from(designs).where(eq(designs.id, id)).limit(1);
  if (!design) return undefined;

  const items = await db.select().from(bomItems).where(eq(bomItems.designId, id));
  return { ...design, bomItems: items };
}

export async function createDesign(design: InsertDesign): Promise<Design> {
  const [result] = await db.insert(designs).values(design).returning();
  return result;
}

export async function updateDesign(id: string, design: Partial<Design>): Promise<Design | undefined> {
  const [result] = await db.update(designs).set(design).where(eq(designs.id, id)).returning();
  return result;
}

// ==================== BOM ITEMS ====================

export async function getBomItems(designId: string): Promise<BomItem[]> {
  return db.select().from(bomItems).where(eq(bomItems.designId, designId));
}

export async function createBomItems(items: InsertBomItem[]): Promise<BomItem[]> {
  if (items.length === 0) return [];
  const results = await db.insert(bomItems).values(items).returning();
  return results;
}

// ==================== DESIGN AGREEMENTS ====================

export async function getDesignAgreements(): Promise<DesignAgreement[]> {
  return db.select().from(designAgreements).orderBy(desc(designAgreements.createdAt));
}

export async function getDesignAgreement(id: string): Promise<DesignAgreement | undefined> {
  const result = await db.select().from(designAgreements).where(eq(designAgreements.id, id)).limit(1);
  return result[0];
}

export async function getDesignAgreementBySite(siteId: string): Promise<DesignAgreement | undefined> {
  const result = await db.select().from(designAgreements).where(eq(designAgreements.siteId, siteId)).limit(1);
  return result[0];
}

export async function createDesignAgreement(agreement: InsertDesignAgreement): Promise<DesignAgreement> {
  const result = await db.insert(designAgreements).values(agreement).returning();
  return result[0];
}

export async function updateDesignAgreement(id: string, agreement: Partial<DesignAgreement>): Promise<DesignAgreement | undefined> {
  const result = await db.update(designAgreements)
    .set({ ...agreement, updatedAt: new Date() })
    .where(eq(designAgreements.id, id))
    .returning();
  return result[0];
}

export async function deleteDesignAgreement(id: string): Promise<boolean> {
  const result = await db.delete(designAgreements).where(eq(designAgreements.id, id)).returning();
  return result.length > 0;
}
