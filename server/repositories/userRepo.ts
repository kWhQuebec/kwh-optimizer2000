import { eq, desc, inArray } from "drizzle-orm";
import { db } from "../db";
import { users } from "@shared/schema";
import type { User, InsertUser } from "@shared/schema";

export async function getUser(id: string): Promise<User | undefined> {
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
}

export async function createUser(user: InsertUser): Promise<User> {
  const [result] = await db.insert(users).values(user).returning();
  return result;
}

export async function updateUser(id: string, userData: Partial<User>): Promise<User | undefined> {
  const [result] = await db.update(users).set({ ...userData, updatedAt: new Date() }).where(eq(users.id, id)).returning();
  return result;
}

export async function getUsers(): Promise<User[]> {
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function getUsersByIds(ids: string[]): Promise<User[]> {
  if (ids.length === 0) return [];
  return db.select().from(users).where(inArray(users.id, ids));
}

export async function deleteUser(id: string): Promise<boolean> {
  const result = await db.delete(users).where(eq(users.id, id)).returning();
  return result.length > 0;
}
