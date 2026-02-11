import { eq, desc, and, inArray, isNotNull, isNull, sql, lte } from "drizzle-orm";
import { db } from "../db";
import { blogArticles, procurationSignatures, emailLogs, scheduledEmails, opportunities } from "@shared/schema";
import type {
  BlogArticle, InsertBlogArticle,
  ProcurationSignature, InsertProcurationSignature,
  EmailLog, InsertEmailLog,
  ScheduledEmail, InsertScheduledEmail,
} from "@shared/schema";

// ==================== BLOG ARTICLES ====================

export async function getBlogArticles(status?: string): Promise<BlogArticle[]> {
  if (status) {
    return db.select().from(blogArticles)
      .where(eq(blogArticles.status, status))
      .orderBy(desc(blogArticles.publishedAt));
  }
  return db.select().from(blogArticles).orderBy(desc(blogArticles.publishedAt));
}

export async function getBlogArticle(id: string): Promise<BlogArticle | undefined> {
  const result = await db.select().from(blogArticles).where(eq(blogArticles.id, id)).limit(1);
  return result[0];
}

export async function getBlogArticleBySlug(slug: string): Promise<BlogArticle | undefined> {
  const result = await db.select().from(blogArticles).where(eq(blogArticles.slug, slug)).limit(1);
  return result[0];
}

export async function createBlogArticle(article: InsertBlogArticle): Promise<BlogArticle> {
  const [result] = await db.insert(blogArticles).values(article).returning();
  return result;
}

export async function updateBlogArticle(id: string, article: Partial<BlogArticle>): Promise<BlogArticle | undefined> {
  const [result] = await db.update(blogArticles)
    .set({ ...article, updatedAt: new Date() })
    .where(eq(blogArticles.id, id))
    .returning();
  return result;
}

export async function deleteBlogArticle(id: string): Promise<boolean> {
  const result = await db.delete(blogArticles).where(eq(blogArticles.id, id)).returning();
  return result.length > 0;
}

export async function incrementArticleViews(id: string): Promise<void> {
  await db.update(blogArticles)
    .set({ viewCount: sql`COALESCE(${blogArticles.viewCount}, 0) + 1` })
    .where(eq(blogArticles.id, id));
}

// ==================== PROCURATION SIGNATURES ====================

export async function getProcurationSignatures(): Promise<ProcurationSignature[]> {
  return db.select().from(procurationSignatures).orderBy(desc(procurationSignatures.createdAt));
}

export async function getProcurationSignature(id: string): Promise<ProcurationSignature | undefined> {
  const result = await db.select().from(procurationSignatures).where(eq(procurationSignatures.id, id)).limit(1);
  return result[0];
}

export async function getProcurationSignatureByLead(leadId: string): Promise<ProcurationSignature | undefined> {
  const result = await db.select().from(procurationSignatures)
    .where(eq(procurationSignatures.leadId, leadId))
    .limit(1);
  return result[0];
}

export async function getProcurationSignaturesByClient(clientId: string): Promise<ProcurationSignature[]> {
  const directProcurations = await db.select().from(procurationSignatures)
    .where(eq(procurationSignatures.clientId, clientId));

  const clientOpportunities = await db.select().from(opportunities)
    .where(and(
      eq(opportunities.clientId, clientId),
      isNotNull(opportunities.leadId)
    ));

  const leadIds = clientOpportunities.map(o => o.leadId).filter(Boolean) as string[];
  let leadProcurations: ProcurationSignature[] = [];
  if (leadIds.length > 0) {
    leadProcurations = await db.select().from(procurationSignatures)
      .where(inArray(procurationSignatures.leadId, leadIds));
  }

  const allProcurations = [...directProcurations, ...leadProcurations];
  const uniqueProcurations = allProcurations.filter((proc, index, self) =>
    index === self.findIndex(p => p.id === proc.id)
  );

  return uniqueProcurations.sort((a, b) =>
    new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
}

export async function createProcurationSignature(signature: InsertProcurationSignature): Promise<ProcurationSignature> {
  const [result] = await db.insert(procurationSignatures).values(signature).returning();
  return result;
}

export async function updateProcurationSignature(id: string, signature: Partial<ProcurationSignature>): Promise<ProcurationSignature | undefined> {
  const [result] = await db.update(procurationSignatures)
    .set({ ...signature, updatedAt: new Date() })
    .where(eq(procurationSignatures.id, id))
    .returning();
  return result;
}

// ==================== EMAIL LOGS ====================

export async function getEmailLogs(filters?: { siteId?: string; designAgreementId?: string; emailType?: string }): Promise<EmailLog[]> {
  const conditions = [];
  if (filters?.siteId) {
    conditions.push(eq(emailLogs.siteId, filters.siteId));
  }
  if (filters?.designAgreementId) {
    conditions.push(eq(emailLogs.designAgreementId, filters.designAgreementId));
  }
  if (filters?.emailType) {
    conditions.push(eq(emailLogs.emailType, filters.emailType));
  }

  if (conditions.length > 0) {
    return db.select().from(emailLogs).where(and(...conditions)).orderBy(desc(emailLogs.createdAt));
  }
  return db.select().from(emailLogs).orderBy(desc(emailLogs.createdAt));
}

export async function getEmailLog(id: string): Promise<EmailLog | undefined> {
  const result = await db.select().from(emailLogs).where(eq(emailLogs.id, id)).limit(1);
  return result[0];
}

export async function createEmailLog(log: InsertEmailLog): Promise<EmailLog> {
  const [result] = await db.insert(emailLogs).values(log).returning();
  return result;
}

export async function updateEmailLog(id: string, log: Partial<EmailLog>): Promise<EmailLog | undefined> {
  const [result] = await db.update(emailLogs)
    .set(log)
    .where(eq(emailLogs.id, id))
    .returning();
  return result;
}

// ==================== SCHEDULED EMAILS ====================

export async function getPendingScheduledEmails(beforeDate: Date, limit: number): Promise<ScheduledEmail[]> {
  return db.select()
    .from(scheduledEmails)
    .where(
      and(
        isNull(scheduledEmails.sentAt),
        lte(scheduledEmails.scheduledFor, beforeDate),
        eq(scheduledEmails.cancelled, false)
      )
    )
    .orderBy(scheduledEmails.scheduledFor)
    .limit(limit);
}

export async function getScheduledEmailsByLead(leadId: string): Promise<ScheduledEmail[]> {
  return db.select()
    .from(scheduledEmails)
    .where(eq(scheduledEmails.leadId, leadId))
    .orderBy(scheduledEmails.scheduledFor);
}

export async function createScheduledEmail(email: InsertScheduledEmail): Promise<ScheduledEmail> {
  const [result] = await db.insert(scheduledEmails).values(email).returning();
  return result;
}

export async function updateScheduledEmail(id: string, email: Partial<ScheduledEmail>): Promise<ScheduledEmail | undefined> {
  const [result] = await db.update(scheduledEmails)
    .set(email)
    .where(eq(scheduledEmails.id, id))
    .returning();
  return result;
}

export async function cancelScheduledEmails(leadId: string): Promise<void> {
  await db.update(scheduledEmails)
    .set({ cancelled: true })
    .where(and(
      eq(scheduledEmails.leadId, leadId),
      isNull(scheduledEmails.sentAt)
    ));
}
