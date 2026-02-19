import { eq, desc, asc, and, inArray, isNotNull, count, sql } from "drizzle-orm";
import { db } from "../db";
import { clients, sites, leads, opportunities, simulationRuns, designAgreements, siteVisits, users, portfolios, portfolioSites } from "@shared/schema";
import type { Client, InsertClient, Site } from "@shared/schema";
import { deleteSite as cascadeDeleteSiteRepo } from "./siteRepo";

export async function getClients(): Promise<(Client & { sites: Site[] })[]> {
  const allClients = await db.select().from(clients).orderBy(desc(clients.createdAt));
  const allSites = await db.select().from(sites);

  return allClients.map(client => ({
    ...client,
    sites: allSites.filter(s => s.clientId === client.id),
  }));
}

export async function getClientsByIds(ids: string[]): Promise<Client[]> {
  if (ids.length === 0) return [];
  return db.select().from(clients).where(inArray(clients.id, ids));
}

export async function getClientsPaginated(options: { limit?: number; offset?: number; search?: string; includeArchived?: boolean; sortBy?: string } = {}): Promise<{
  clients: (Client & { sites: Site[] })[];
  total: number;
}> {
  const { limit = 50, offset = 0, search, includeArchived = false, sortBy } = options;

  let whereConditions: any[] = [];

  if (!includeArchived) {
    whereConditions.push(eq(clients.isArchived, false));
  }

  if (search) {
    const searchPattern = `%${search.toLowerCase()}%`;
    whereConditions.push(
      sql`(
        LOWER(${clients.name}) LIKE ${searchPattern} OR
        LOWER(${clients.mainContactName}) LIKE ${searchPattern} OR
        LOWER(${clients.email}) LIKE ${searchPattern} OR
        LOWER(${clients.city}) LIKE ${searchPattern}
      )`
    );
  }

  const countQuery = whereConditions.length > 0
    ? db.select({ count: count() }).from(clients).where(and(...whereConditions))
    : db.select({ count: count() }).from(clients);
  const [{ count: totalCount }] = await countQuery;

  let orderClause;
  switch (sortBy) {
    case "modified":
      orderClause = desc(clients.createdAt);
      break;
    case "name_asc":
      orderClause = asc(clients.name);
      break;
    case "name_desc":
      orderClause = desc(clients.name);
      break;
    case "newest":
    default:
      orderClause = desc(clients.updatedAt);
      break;
  }

  const clientsQuery = whereConditions.length > 0
    ? db.select().from(clients).where(and(...whereConditions)).orderBy(orderClause).limit(limit).offset(offset)
    : db.select().from(clients).orderBy(orderClause).limit(limit).offset(offset);
  const paginatedClients = await clientsQuery;

  const clientIds = paginatedClients.map(c => c.id);
  const siteCounts = clientIds.length > 0
    ? await db
        .select({
          clientId: sites.clientId,
          siteCount: count()
        })
        .from(sites)
        .where(inArray(sites.clientId, clientIds))
        .groupBy(sites.clientId)
    : [];

  const siteCountMap = new Map(siteCounts.map(sc => [sc.clientId, Number(sc.siteCount)]));

  const clientsWithSites = paginatedClients.map(client => ({
    ...client,
    sites: [] as Site[],
    siteCount: siteCountMap.get(client.id) || 0,
  }));

  return { clients: clientsWithSites, total: Number(totalCount) };
}

export async function getClient(id: string): Promise<Client | undefined> {
  const result = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return result[0];
}

export async function createClient(client: InsertClient): Promise<Client> {
  const [result] = await db.insert(clients).values(client).returning();
  return result;
}

export async function updateClient(id: string, client: Partial<Client>): Promise<Client | undefined> {
  const [result] = await db.update(clients).set({ ...client, updatedAt: new Date() }).where(eq(clients.id, id)).returning();
  return result;
}

export async function deleteClient(id: string): Promise<boolean> {
  const result = await db.delete(clients).where(eq(clients.id, id)).returning();
  return result.length > 0;
}

export async function getClientCascadeCounts(clientId: string): Promise<{ sites: number; simulations: number; portalUsers: number; portfolios: number; opportunities: number; designAgreements: number; siteVisits: number }> {
  const clientSites = await db.select({ id: sites.id }).from(sites).where(eq(sites.clientId, clientId));
  const siteIds = clientSites.map(s => s.id);
  const [siteCount] = await db.select({ count: count() }).from(sites).where(eq(sites.clientId, clientId));
  const [simCount] = siteIds.length > 0
    ? await db.select({ count: count() }).from(simulationRuns).where(inArray(simulationRuns.siteId, siteIds))
    : [{ count: 0 }];
  const [portalCount] = await db.select({ count: count() }).from(users).where(and(eq(users.clientId, clientId), eq(users.role, 'client')));
  const [portfolioCount] = await db.select({ count: count() }).from(portfolios).where(eq(portfolios.clientId, clientId));
  const [oppCount] = await db.select({ count: count() }).from(opportunities).where(eq(opportunities.clientId, clientId));
  const [daCount] = siteIds.length > 0
    ? await db.select({ count: count() }).from(designAgreements).where(inArray(designAgreements.siteId, siteIds))
    : [{ count: 0 }];
  const [svCount] = siteIds.length > 0
    ? await db.select({ count: count() }).from(siteVisits).where(inArray(siteVisits.siteId, siteIds))
    : [{ count: 0 }];
  return {
    sites: Number(siteCount.count),
    simulations: Number(simCount.count),
    portalUsers: Number(portalCount.count),
    portfolios: Number(portfolioCount.count),
    opportunities: Number(oppCount.count),
    designAgreements: Number(daCount.count),
    siteVisits: Number(svCount.count),
  };
}

export async function cascadeDeleteClient(clientId: string): Promise<boolean> {
  const clientSites = await db.select({ id: sites.id }).from(sites).where(eq(sites.clientId, clientId));
  for (const site of clientSites) {
    await cascadeDeleteSiteRepo(site.id);
  }
  await db.delete(users).where(and(eq(users.clientId, clientId), eq(users.role, 'client')));
  const clientPortfolios = await db.select({ id: portfolios.id }).from(portfolios).where(eq(portfolios.clientId, clientId));
  const portfolioIds = clientPortfolios.map(p => p.id);
  if (portfolioIds.length > 0) {
    await db.delete(portfolioSites).where(inArray(portfolioSites.portfolioId, portfolioIds));
  }
  await db.delete(portfolios).where(eq(portfolios.clientId, clientId));
  await db.delete(opportunities).where(eq(opportunities.clientId, clientId));
  const result = await db.delete(clients).where(eq(clients.id, clientId)).returning();
  return result.length > 0;
}

export async function getHQBillsByClient(clientId: string): Promise<Array<{
  id: string;
  source: 'lead' | 'site';
  sourceId: string;
  sourceName: string;
  hqBillPath: string;
  uploadedAt?: Date | null;
}>> {
  const bills: Array<{
    id: string;
    source: 'lead' | 'site';
    sourceId: string;
    sourceName: string;
    hqBillPath: string;
    uploadedAt?: Date | null;
  }> = [];

  const clientSites = await db.select().from(sites)
    .where(eq(sites.clientId, clientId));

  for (const site of clientSites) {
    if (site.hqBillPath) {
      bills.push({
        id: `site-${site.id}`,
        source: 'site',
        sourceId: site.id,
        sourceName: site.name,
        hqBillPath: site.hqBillPath,
        uploadedAt: site.hqBillUploadedAt,
      });
    }
  }

  const clientOpportunities = await db.select().from(opportunities)
    .where(and(
      eq(opportunities.clientId, clientId),
      isNotNull(opportunities.leadId)
    ));

  const leadIds = Array.from(new Set(clientOpportunities.map(o => o.leadId).filter(Boolean) as string[]));
  if (leadIds.length > 0) {
    const clientLeads = await db.select().from(leads)
      .where(inArray(leads.id, leadIds));

    for (const lead of clientLeads) {
      if (lead.hqBillPath) {
        bills.push({
          id: `lead-${lead.id}`,
          source: 'lead',
          sourceId: lead.id,
          sourceName: lead.companyName || lead.contactName,
          hqBillPath: lead.hqBillPath,
          uploadedAt: lead.createdAt,
        });
      }
    }
  }

  return bills;
}
