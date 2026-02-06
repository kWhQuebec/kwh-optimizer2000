import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import { simulationRuns, sites, clients } from "@shared/schema";
import type { SimulationRun, InsertSimulationRun, Site, Client } from "@shared/schema";

export async function getSimulationRuns(): Promise<(SimulationRun & { site: Site & { client: Client } })[]> {
  const allRuns = await db.select().from(simulationRuns).orderBy(desc(simulationRuns.createdAt));
  const allSites = await db.select().from(sites);
  const allClients = await db.select().from(clients);

  const siteMap = new Map(allSites.map(s => [s.id, s]));
  const clientMap = new Map(allClients.map(c => [c.id, c]));

  return allRuns.map(run => {
    const site = siteMap.get(run.siteId);
    const client = site ? clientMap.get(site.clientId) : undefined;
    return {
      ...run,
      site: { ...site!, client: client! },
    };
  }).filter(r => r.site && r.site.client);
}

export async function getSimulationRun(id: string): Promise<(SimulationRun & { site: Site & { client: Client } }) | undefined> {
  const [run] = await db.select().from(simulationRuns).where(eq(simulationRuns.id, id)).limit(1);
  if (!run) return undefined;

  const [site] = await db.select().from(sites).where(eq(sites.id, run.siteId)).limit(1);
  if (!site) return undefined;

  const [client] = await db.select().from(clients).where(eq(clients.id, site.clientId)).limit(1);
  if (!client) return undefined;

  return { ...run, site: { ...site, client } };
}

export async function getSimulationRunsBySite(siteId: string): Promise<SimulationRun[]> {
  return db.select().from(simulationRuns).where(eq(simulationRuns.siteId, siteId));
}

export async function getSimulationRunFull(id: string): Promise<SimulationRun | undefined> {
  const [run] = await db.select().from(simulationRuns).where(eq(simulationRuns.id, id)).limit(1);
  return run;
}

export async function createSimulationRun(run: InsertSimulationRun): Promise<SimulationRun> {
  const [result] = await db.insert(simulationRuns).values(run).returning();
  return result;
}
