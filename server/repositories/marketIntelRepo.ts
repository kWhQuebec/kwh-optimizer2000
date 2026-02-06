import { eq, desc, and } from "drizzle-orm";
import { db } from "../db";
import {
  competitors, battleCards, marketNotes, marketDocuments,
  competitorProposalAnalysis,
} from "@shared/schema";
import type {
  Competitor, InsertCompetitor,
  BattleCard, InsertBattleCard, BattleCardWithCompetitor,
  MarketNote, InsertMarketNote,
  MarketDocument, InsertMarketDocument,
  CompetitorProposalAnalysis, InsertCompetitorProposalAnalysis,
} from "@shared/schema";

// ==================== COMPETITORS ====================

export async function getCompetitors(): Promise<Competitor[]> {
  return db.select().from(competitors)
    .where(eq(competitors.isActive, true))
    .orderBy(competitors.name);
}

export async function getCompetitor(id: string): Promise<Competitor | undefined> {
  const result = await db.select().from(competitors).where(eq(competitors.id, id)).limit(1);
  return result[0];
}

export async function createCompetitor(competitor: InsertCompetitor): Promise<Competitor> {
  const [result] = await db.insert(competitors).values(competitor).returning();
  return result;
}

export async function updateCompetitor(id: string, competitor: Partial<Competitor>): Promise<Competitor | undefined> {
  const [result] = await db.update(competitors)
    .set({ ...competitor, updatedAt: new Date() })
    .where(eq(competitors.id, id))
    .returning();
  return result;
}

export async function deleteCompetitor(id: string): Promise<boolean> {
  const result = await db.update(competitors)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(competitors.id, id))
    .returning();
  return result.length > 0;
}

// ==================== BATTLE CARDS ====================

export async function getBattleCards(competitorId?: string): Promise<BattleCardWithCompetitor[]> {
  const allCards = await db.select().from(battleCards)
    .where(eq(battleCards.isActive, true))
    .orderBy(battleCards.priority);

  const filteredCards = competitorId
    ? allCards.filter(c => c.competitorId === competitorId)
    : allCards;

  const result: BattleCardWithCompetitor[] = [];
  for (const card of filteredCards) {
    const comp = await getCompetitor(card.competitorId);
    if (comp) {
      result.push({ ...card, competitor: comp });
    }
  }
  return result;
}

export async function getBattleCard(id: string): Promise<BattleCardWithCompetitor | undefined> {
  const result = await db.select().from(battleCards).where(eq(battleCards.id, id)).limit(1);
  const card = result[0];
  if (!card) return undefined;

  const comp = await getCompetitor(card.competitorId);
  if (!comp) return undefined;

  return { ...card, competitor: comp };
}

export async function createBattleCard(battleCard: InsertBattleCard): Promise<BattleCard> {
  const [result] = await db.insert(battleCards).values(battleCard).returning();
  return result;
}

export async function updateBattleCard(id: string, battleCard: Partial<BattleCard>): Promise<BattleCard | undefined> {
  const [result] = await db.update(battleCards)
    .set({ ...battleCard, updatedAt: new Date() })
    .where(eq(battleCards.id, id))
    .returning();
  return result;
}

export async function deleteBattleCard(id: string): Promise<boolean> {
  const result = await db.update(battleCards)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(battleCards.id, id))
    .returning();
  return result.length > 0;
}

// ==================== MARKET NOTES ====================

export async function getMarketNotes(category?: string): Promise<MarketNote[]> {
  if (category) {
    return db.select().from(marketNotes)
      .where(and(eq(marketNotes.status, "active"), eq(marketNotes.category, category)))
      .orderBy(desc(marketNotes.createdAt));
  }
  return db.select().from(marketNotes)
    .where(eq(marketNotes.status, "active"))
    .orderBy(desc(marketNotes.createdAt));
}

export async function getMarketNote(id: string): Promise<MarketNote | undefined> {
  const result = await db.select().from(marketNotes).where(eq(marketNotes.id, id)).limit(1);
  return result[0];
}

export async function createMarketNote(note: InsertMarketNote): Promise<MarketNote> {
  const [result] = await db.insert(marketNotes).values(note).returning();
  return result;
}

export async function updateMarketNote(id: string, note: Partial<MarketNote>): Promise<MarketNote | undefined> {
  const [result] = await db.update(marketNotes)
    .set({ ...note, updatedAt: new Date() })
    .where(eq(marketNotes.id, id))
    .returning();
  return result;
}

export async function deleteMarketNote(id: string): Promise<boolean> {
  const result = await db.update(marketNotes)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(marketNotes.id, id))
    .returning();
  return result.length > 0;
}

// ==================== MARKET DOCUMENTS ====================

export async function getMarketDocuments(entityType?: string): Promise<MarketDocument[]> {
  if (entityType) {
    return db.select().from(marketDocuments)
      .where(eq(marketDocuments.entityType, entityType))
      .orderBy(desc(marketDocuments.createdAt));
  }
  return db.select().from(marketDocuments)
    .orderBy(desc(marketDocuments.createdAt));
}

export async function getMarketDocument(id: string): Promise<MarketDocument | undefined> {
  const result = await db.select().from(marketDocuments).where(eq(marketDocuments.id, id)).limit(1);
  return result[0];
}

export async function createMarketDocument(doc: InsertMarketDocument): Promise<MarketDocument> {
  const [result] = await db.insert(marketDocuments).values(doc).returning();
  return result;
}

export async function updateMarketDocument(id: string, doc: Partial<MarketDocument>): Promise<MarketDocument | undefined> {
  const [result] = await db.update(marketDocuments)
    .set({ ...doc, updatedAt: new Date() })
    .where(eq(marketDocuments.id, id))
    .returning();
  return result;
}

export async function deleteMarketDocument(id: string): Promise<boolean> {
  const result = await db.delete(marketDocuments)
    .where(eq(marketDocuments.id, id))
    .returning();
  return result.length > 0;
}

// ==================== COMPETITOR PROPOSAL ANALYSES ====================

export async function getCompetitorProposalAnalyses(): Promise<CompetitorProposalAnalysis[]> {
  return db.select().from(competitorProposalAnalysis).orderBy(desc(competitorProposalAnalysis.createdAt));
}

export async function getCompetitorProposalAnalysis_(id: string): Promise<CompetitorProposalAnalysis | undefined> {
  const result = await db.select().from(competitorProposalAnalysis).where(eq(competitorProposalAnalysis.id, id)).limit(1);
  return result[0];
}

export async function createCompetitorProposalAnalysis_(data: InsertCompetitorProposalAnalysis): Promise<CompetitorProposalAnalysis> {
  const [result] = await db.insert(competitorProposalAnalysis).values(data).returning();
  return result;
}

export async function updateCompetitorProposalAnalysis_(id: string, data: Partial<InsertCompetitorProposalAnalysis>): Promise<CompetitorProposalAnalysis | undefined> {
  const [result] = await db.update(competitorProposalAnalysis)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(competitorProposalAnalysis.id, id))
    .returning();
  return result;
}

export async function deleteCompetitorProposalAnalysis_(id: string): Promise<boolean> {
  const result = await db.delete(competitorProposalAnalysis)
    .where(eq(competitorProposalAnalysis.id, id))
    .returning();
  return result.length > 0;
}
