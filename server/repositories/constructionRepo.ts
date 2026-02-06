import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import {
  constructionAgreements, constructionMilestones, constructionProjects, constructionTasks,
  omContracts, omVisits, omPerformanceSnapshots,
} from "@shared/schema";
import type {
  ConstructionAgreement, InsertConstructionAgreement,
  ConstructionMilestone, InsertConstructionMilestone,
  ConstructionProject, InsertConstructionProject,
  ConstructionTask, InsertConstructionTask,
  OmContract, InsertOmContract,
  OmVisit, InsertOmVisit,
  OmPerformanceSnapshot, InsertOmPerformanceSnapshot,
} from "@shared/schema";

// ==================== CONSTRUCTION AGREEMENTS ====================

export async function getConstructionAgreements(): Promise<ConstructionAgreement[]> {
  return db.select().from(constructionAgreements).orderBy(desc(constructionAgreements.createdAt));
}

export async function getConstructionAgreement(id: string): Promise<ConstructionAgreement | undefined> {
  const result = await db.select().from(constructionAgreements).where(eq(constructionAgreements.id, id)).limit(1);
  return result[0];
}

export async function getConstructionAgreementsBySiteId(siteId: string): Promise<ConstructionAgreement[]> {
  return db.select().from(constructionAgreements)
    .where(eq(constructionAgreements.siteId, siteId))
    .orderBy(desc(constructionAgreements.createdAt));
}

export async function createConstructionAgreement(agreement: InsertConstructionAgreement): Promise<ConstructionAgreement> {
  const [result] = await db.insert(constructionAgreements).values(agreement).returning();
  return result;
}

export async function updateConstructionAgreement(id: string, agreement: Partial<ConstructionAgreement>): Promise<ConstructionAgreement | undefined> {
  const [result] = await db.update(constructionAgreements)
    .set({ ...agreement, updatedAt: new Date() })
    .where(eq(constructionAgreements.id, id))
    .returning();
  return result;
}

export async function deleteConstructionAgreement(id: string): Promise<boolean> {
  await db.delete(constructionMilestones).where(eq(constructionMilestones.constructionAgreementId, id));
  const result = await db.delete(constructionAgreements).where(eq(constructionAgreements.id, id)).returning();
  return result.length > 0;
}

// ==================== CONSTRUCTION MILESTONES ====================

export async function getConstructionMilestones(agreementId: string): Promise<ConstructionMilestone[]> {
  return db.select().from(constructionMilestones)
    .where(eq(constructionMilestones.constructionAgreementId, agreementId))
    .orderBy(constructionMilestones.orderIndex);
}

export async function getConstructionMilestone(id: string): Promise<ConstructionMilestone | undefined> {
  const result = await db.select().from(constructionMilestones).where(eq(constructionMilestones.id, id)).limit(1);
  return result[0];
}

export async function getConstructionMilestonesByAgreementId(agreementId: string): Promise<ConstructionMilestone[]> {
  return db.select().from(constructionMilestones)
    .where(eq(constructionMilestones.constructionAgreementId, agreementId))
    .orderBy(constructionMilestones.orderIndex);
}

export async function createConstructionMilestone(milestone: InsertConstructionMilestone): Promise<ConstructionMilestone> {
  const [result] = await db.insert(constructionMilestones).values(milestone).returning();
  return result;
}

export async function updateConstructionMilestone(id: string, milestone: Partial<ConstructionMilestone>): Promise<ConstructionMilestone | undefined> {
  const [result] = await db.update(constructionMilestones)
    .set(milestone)
    .where(eq(constructionMilestones.id, id))
    .returning();
  return result;
}

export async function deleteConstructionMilestone(id: string): Promise<boolean> {
  const result = await db.delete(constructionMilestones).where(eq(constructionMilestones.id, id)).returning();
  return result.length > 0;
}

// ==================== CONSTRUCTION PROJECTS ====================

export async function getConstructionProjects(): Promise<ConstructionProject[]> {
  return db.select().from(constructionProjects).orderBy(desc(constructionProjects.updatedAt));
}

export async function getConstructionProject(id: string): Promise<ConstructionProject | undefined> {
  const [result] = await db.select().from(constructionProjects).where(eq(constructionProjects.id, id)).limit(1);
  return result;
}

export async function getConstructionProjectsBySiteId(siteId: string): Promise<ConstructionProject[]> {
  return db.select().from(constructionProjects)
    .where(eq(constructionProjects.siteId, siteId))
    .orderBy(desc(constructionProjects.updatedAt));
}

export async function createConstructionProject(project: InsertConstructionProject): Promise<ConstructionProject> {
  const [result] = await db.insert(constructionProjects).values(project).returning();
  return result;
}

export async function updateConstructionProject(id: string, project: Partial<ConstructionProject>): Promise<ConstructionProject | undefined> {
  const [result] = await db.update(constructionProjects)
    .set({ ...project, updatedAt: new Date() })
    .where(eq(constructionProjects.id, id))
    .returning();
  return result;
}

export async function deleteConstructionProject(id: string): Promise<boolean> {
  const result = await db.delete(constructionProjects).where(eq(constructionProjects.id, id)).returning();
  return result.length > 0;
}

// ==================== CONSTRUCTION TASKS ====================

export async function getConstructionTasks(): Promise<ConstructionTask[]> {
  return db.select().from(constructionTasks).orderBy(desc(constructionTasks.updatedAt));
}

export async function getConstructionTask(id: string): Promise<ConstructionTask | undefined> {
  const [result] = await db.select().from(constructionTasks).where(eq(constructionTasks.id, id)).limit(1);
  return result;
}

export async function getConstructionTasksByProjectId(projectId: string): Promise<ConstructionTask[]> {
  return db.select().from(constructionTasks)
    .where(eq(constructionTasks.projectId, projectId))
    .orderBy(constructionTasks.sortOrder);
}

export async function createConstructionTask(task: InsertConstructionTask): Promise<ConstructionTask> {
  const [result] = await db.insert(constructionTasks).values(task).returning();
  return result;
}

export async function updateConstructionTask(id: string, task: Partial<ConstructionTask>): Promise<ConstructionTask | undefined> {
  const [result] = await db.update(constructionTasks)
    .set({ ...task, updatedAt: new Date() })
    .where(eq(constructionTasks.id, id))
    .returning();
  return result;
}

export async function deleteConstructionTask(id: string): Promise<boolean> {
  const result = await db.delete(constructionTasks).where(eq(constructionTasks.id, id)).returning();
  return result.length > 0;
}

// ==================== O&M CONTRACTS ====================

export async function getOmContracts(): Promise<OmContract[]> {
  return db.select().from(omContracts).orderBy(desc(omContracts.createdAt));
}

export async function getOmContract(id: string): Promise<OmContract | undefined> {
  const result = await db.select().from(omContracts).where(eq(omContracts.id, id)).limit(1);
  return result[0];
}

export async function getOmContractsByClientId(clientId: string): Promise<OmContract[]> {
  return db.select().from(omContracts)
    .where(eq(omContracts.clientId, clientId))
    .orderBy(desc(omContracts.createdAt));
}

export async function getOmContractsBySiteId(siteId: string): Promise<OmContract[]> {
  return db.select().from(omContracts)
    .where(eq(omContracts.siteId, siteId))
    .orderBy(desc(omContracts.createdAt));
}

export async function createOmContract(contract: InsertOmContract): Promise<OmContract> {
  const [result] = await db.insert(omContracts).values(contract).returning();
  return result;
}

export async function updateOmContract(id: string, contract: Partial<OmContract>): Promise<OmContract | undefined> {
  const [result] = await db.update(omContracts)
    .set({ ...contract, updatedAt: new Date() })
    .where(eq(omContracts.id, id))
    .returning();
  return result;
}

export async function deleteOmContract(id: string): Promise<boolean> {
  await db.delete(omVisits).where(eq(omVisits.omContractId, id));
  await db.delete(omPerformanceSnapshots).where(eq(omPerformanceSnapshots.omContractId, id));
  const result = await db.delete(omContracts).where(eq(omContracts.id, id)).returning();
  return result.length > 0;
}

// ==================== O&M VISITS ====================

export async function getOmVisits(): Promise<OmVisit[]> {
  return db.select().from(omVisits).orderBy(desc(omVisits.createdAt));
}

export async function getOmVisit(id: string): Promise<OmVisit | undefined> {
  const result = await db.select().from(omVisits).where(eq(omVisits.id, id)).limit(1);
  return result[0];
}

export async function getOmVisitsByContractId(contractId: string): Promise<OmVisit[]> {
  return db.select().from(omVisits)
    .where(eq(omVisits.omContractId, contractId))
    .orderBy(desc(omVisits.scheduledDate));
}

export async function createOmVisit(visit: InsertOmVisit): Promise<OmVisit> {
  const [result] = await db.insert(omVisits).values(visit).returning();
  return result;
}

export async function updateOmVisit(id: string, visit: Partial<OmVisit>): Promise<OmVisit | undefined> {
  const [result] = await db.update(omVisits)
    .set({ ...visit, updatedAt: new Date() })
    .where(eq(omVisits.id, id))
    .returning();
  return result;
}

export async function deleteOmVisit(id: string): Promise<boolean> {
  const result = await db.delete(omVisits).where(eq(omVisits.id, id)).returning();
  return result.length > 0;
}

// ==================== O&M PERFORMANCE SNAPSHOTS ====================

export async function getOmPerformanceSnapshots(): Promise<OmPerformanceSnapshot[]> {
  return db.select().from(omPerformanceSnapshots).orderBy(desc(omPerformanceSnapshots.createdAt));
}

export async function getOmPerformanceSnapshot(id: string): Promise<OmPerformanceSnapshot | undefined> {
  const result = await db.select().from(omPerformanceSnapshots).where(eq(omPerformanceSnapshots.id, id)).limit(1);
  return result[0];
}

export async function getOmPerformanceSnapshotsByContractId(contractId: string): Promise<OmPerformanceSnapshot[]> {
  return db.select().from(omPerformanceSnapshots)
    .where(eq(omPerformanceSnapshots.omContractId, contractId))
    .orderBy(desc(omPerformanceSnapshots.periodStart));
}

export async function createOmPerformanceSnapshot(snapshot: InsertOmPerformanceSnapshot): Promise<OmPerformanceSnapshot> {
  const [result] = await db.insert(omPerformanceSnapshots).values(snapshot).returning();
  return result;
}

export async function updateOmPerformanceSnapshot(id: string, snapshot: Partial<OmPerformanceSnapshot>): Promise<OmPerformanceSnapshot | undefined> {
  const [result] = await db.update(omPerformanceSnapshots)
    .set(snapshot)
    .where(eq(omPerformanceSnapshots.id, id))
    .returning();
  return result;
}

export async function deleteOmPerformanceSnapshot(id: string): Promise<boolean> {
  const result = await db.delete(omPerformanceSnapshots).where(eq(omPerformanceSnapshots.id, id)).returning();
  return result.length > 0;
}
