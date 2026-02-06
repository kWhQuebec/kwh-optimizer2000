import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import { suppliers, priceHistory } from "@shared/schema";
import type {
  Supplier, InsertSupplier,
  PriceHistory, InsertPriceHistory,
} from "@shared/schema";

// ==================== SUPPLIERS ====================

export async function getSuppliers(): Promise<Supplier[]> {
  return db.select().from(suppliers).orderBy(suppliers.name);
}

export async function getSupplier(id: string): Promise<Supplier | undefined> {
  const result = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
  return result[0];
}

export async function createSupplier(supplier: InsertSupplier): Promise<Supplier> {
  const [result] = await db.insert(suppliers).values({
    ...supplier,
    active: supplier.active ?? true,
  }).returning();
  return result;
}

export async function updateSupplier(id: string, supplier: Partial<Supplier>): Promise<Supplier | undefined> {
  const [result] = await db.update(suppliers).set({
    ...supplier,
    updatedAt: new Date(),
  }).where(eq(suppliers.id, id)).returning();
  return result;
}

export async function deleteSupplier(id: string): Promise<boolean> {
  const result = await db.delete(suppliers).where(eq(suppliers.id, id)).returning();
  return result.length > 0;
}

export async function getSuppliersByCategory(category: string): Promise<Supplier[]> {
  return db.select().from(suppliers).where(eq(suppliers.category, category)).orderBy(suppliers.name);
}

// ==================== PRICE HISTORY ====================

export async function getPriceHistory(): Promise<PriceHistory[]> {
  return db.select().from(priceHistory).orderBy(desc(priceHistory.quoteDate));
}

export async function getPriceHistoryById(id: string): Promise<PriceHistory | undefined> {
  const [result] = await db.select().from(priceHistory).where(eq(priceHistory.id, id)).limit(1);
  return result;
}

export async function getPriceHistoryBySupplier(supplierId: string): Promise<PriceHistory[]> {
  return db.select().from(priceHistory).where(eq(priceHistory.supplierId, supplierId)).orderBy(desc(priceHistory.quoteDate));
}

export async function getPriceHistoryByCategory(category: string): Promise<PriceHistory[]> {
  return db.select().from(priceHistory).where(eq(priceHistory.category, category)).orderBy(desc(priceHistory.quoteDate));
}

export async function getPriceHistoryByItem(itemName: string): Promise<PriceHistory[]> {
  return db.select().from(priceHistory).where(eq(priceHistory.itemName, itemName)).orderBy(desc(priceHistory.quoteDate));
}

export async function createPriceHistory(entry: InsertPriceHistory): Promise<PriceHistory> {
  const [result] = await db.insert(priceHistory).values(entry).returning();
  return result;
}

export async function deletePriceHistory(id: string): Promise<boolean> {
  const result = await db.delete(priceHistory).where(eq(priceHistory.id, id)).returning();
  return result.length > 0;
}
