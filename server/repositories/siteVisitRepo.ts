import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import { siteVisits, siteVisitPhotos, sites, clients } from "@shared/schema";
import type {
  SiteVisit, InsertSiteVisit, SiteVisitWithSite,
  SiteVisitPhoto, InsertSiteVisitPhoto,
} from "@shared/schema";

// ==================== SITE VISITS ====================

export async function getSiteVisits(): Promise<SiteVisitWithSite[]> {
  const allVisits = await db.select().from(siteVisits).orderBy(desc(siteVisits.createdAt));
  const allSites = await db.select().from(sites);
  const allClients = await db.select().from(clients);

  const siteMap = new Map(allSites.map(s => [s.id, s]));
  const clientMap = new Map(allClients.map(c => [c.id, c]));

  return allVisits.map(visit => {
    const site = siteMap.get(visit.siteId);
    const client = site ? clientMap.get(site.clientId) : undefined;
    return {
      ...visit,
      site: { ...site!, client: client! },
    };
  }).filter(v => v.site && v.site.client);
}

export async function getSiteVisit(id: string): Promise<SiteVisitWithSite | undefined> {
  const [visit] = await db.select().from(siteVisits).where(eq(siteVisits.id, id)).limit(1);
  if (!visit) return undefined;

  const [site] = await db.select().from(sites).where(eq(sites.id, visit.siteId)).limit(1);
  if (!site) return undefined;

  const [client] = await db.select().from(clients).where(eq(clients.id, site.clientId)).limit(1);
  if (!client) return undefined;

  return { ...visit, site: { ...site, client } };
}

export async function getSiteVisitsBySite(siteId: string): Promise<SiteVisit[]> {
  return db.select().from(siteVisits).where(eq(siteVisits.siteId, siteId)).orderBy(desc(siteVisits.createdAt));
}

export async function createSiteVisit(visit: InsertSiteVisit): Promise<SiteVisit> {
  const [result] = await db.insert(siteVisits).values(visit).returning();
  return result;
}

export async function updateSiteVisit(id: string, visit: Partial<SiteVisit>): Promise<SiteVisit | undefined> {
  const [result] = await db.update(siteVisits).set({ ...visit, updatedAt: new Date() }).where(eq(siteVisits.id, id)).returning();
  return result;
}

export async function deleteSiteVisit(id: string): Promise<boolean> {
  const result = await db.delete(siteVisits).where(eq(siteVisits.id, id)).returning();
  return result.length > 0;
}

// ==================== SITE VISIT PHOTOS ====================

export async function getSiteVisitPhotos(siteId: string): Promise<SiteVisitPhoto[]> {
  return db.select().from(siteVisitPhotos)
    .where(eq(siteVisitPhotos.siteId, siteId))
    .orderBy(desc(siteVisitPhotos.uploadedAt));
}

export async function getSiteVisitPhotosByVisit(visitId: string): Promise<SiteVisitPhoto[]> {
  return db.select().from(siteVisitPhotos)
    .where(eq(siteVisitPhotos.visitId, visitId))
    .orderBy(desc(siteVisitPhotos.uploadedAt));
}

export async function createSiteVisitPhoto(photo: InsertSiteVisitPhoto): Promise<SiteVisitPhoto> {
  const [result] = await db.insert(siteVisitPhotos).values(photo).returning();
  return result;
}

export async function deleteSiteVisitPhoto(id: string): Promise<boolean> {
  const result = await db.delete(siteVisitPhotos).where(eq(siteVisitPhotos.id, id)).returning();
  return result.length > 0;
}
