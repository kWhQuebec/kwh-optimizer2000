import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { componentCatalog, pricingComponents } from "@shared/schema";
import type {
  ComponentCatalog, InsertComponentCatalog,
  PricingComponent, InsertPricingComponent,
} from "@shared/schema";

// ==================== COMPONENT CATALOG ====================

export async function getCatalog(): Promise<ComponentCatalog[]> {
  return db.select().from(componentCatalog);
}

export async function getCatalogItem(id: string): Promise<ComponentCatalog | undefined> {
  const result = await db.select().from(componentCatalog).where(eq(componentCatalog.id, id)).limit(1);
  return result[0];
}

export async function getCatalogByCategory(category: string): Promise<ComponentCatalog[]> {
  return db.select().from(componentCatalog).where(eq(componentCatalog.category, category));
}

export async function getCatalogItemByManufacturerModel(manufacturer: string, model: string): Promise<ComponentCatalog | undefined> {
  const [result] = await db.select().from(componentCatalog)
    .where(and(eq(componentCatalog.manufacturer, manufacturer), eq(componentCatalog.model, model)))
    .limit(1);
  return result;
}

export async function createCatalogItem(item: InsertComponentCatalog): Promise<ComponentCatalog> {
  const [result] = await db.insert(componentCatalog).values({
    ...item,
    active: item.active ?? true,
  }).returning();
  return result;
}

export async function updateCatalogItem(id: string, item: Partial<ComponentCatalog>): Promise<ComponentCatalog | undefined> {
  const [result] = await db.update(componentCatalog).set({ ...item, updatedAt: new Date() }).where(eq(componentCatalog.id, id)).returning();
  return result;
}

export async function deleteCatalogItem(id: string): Promise<boolean> {
  const result = await db.delete(componentCatalog).where(eq(componentCatalog.id, id)).returning();
  return result.length > 0;
}

// ==================== PRICING COMPONENTS ====================

export async function getPricingComponents(): Promise<PricingComponent[]> {
  return db.select().from(pricingComponents).orderBy(pricingComponents.category, pricingComponents.name);
}

export async function getPricingComponent(id: string): Promise<PricingComponent | undefined> {
  const result = await db.select().from(pricingComponents).where(eq(pricingComponents.id, id)).limit(1);
  return result[0];
}

export async function getPricingComponentsByCategory(category: string): Promise<PricingComponent[]> {
  return db.select().from(pricingComponents).where(eq(pricingComponents.category, category));
}

export async function getActivePricingComponents(): Promise<PricingComponent[]> {
  return db.select().from(pricingComponents).where(eq(pricingComponents.active, true));
}

export async function createPricingComponent(component: InsertPricingComponent): Promise<PricingComponent> {
  const [result] = await db.insert(pricingComponents).values({
    ...component,
    active: component.active ?? true,
  }).returning();
  return result;
}

export async function updatePricingComponent(id: string, component: Partial<PricingComponent>): Promise<PricingComponent | undefined> {
  const [result] = await db.update(pricingComponents).set({
    ...component,
    updatedAt: new Date(),
  }).where(eq(pricingComponents.id, id)).returning();
  return result;
}

export async function deletePricingComponent(id: string): Promise<boolean> {
  const result = await db.delete(pricingComponents).where(eq(pricingComponents.id, id)).returning();
  return result.length > 0;
}
