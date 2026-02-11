/**
 * Email Scheduler for Nurture Sequences
 *
 * Schedules and processes automated email sequences.
 * Uses a simple polling approach (setInterval) since we don't have
 * a task queue like Bull/Redis in this stack.
 *
 * Nurture sequence:
 * - Day 3: Incentives reminder
 * - Day 7: Case study / social proof
 * - Day 10: Rising energy costs
 * - Day 14: Myth busting
 * - Day 21: Time-sensitive incentives
 * - Day 30: Last respectful follow-up
 */

import { eq, lte, and, isNull } from "drizzle-orm";
import { createLogger } from "./lib/logger";
import type { IStorage } from "./storage";

const log = createLogger("EmailScheduler");

// Nurture sequence definition
const NURTURE_SEQUENCE = [
  { templateKey: "nurturingIncentives", delayDays: 3 },
  { templateKey: "nurturingCaseStudy", delayDays: 7 },
  { templateKey: "nurturingRisingCosts", delayDays: 10 },
  { templateKey: "nurturingMythBusting", delayDays: 14 },
  { templateKey: "nurturingTimeSensitive", delayDays: 21 },
  { templateKey: "nurturingLastChance", delayDays: 30 },
];

export interface SchedulerDeps {
  storage: IStorage;
  sendTemplateEmail: (
    templateKey: string,
    to: string,
    data: Record<string, string>,
    lang: string
  ) => Promise<{ success: boolean; error?: string }>;
  getLeadById: (id: string) => Promise<any>;
}

/**
 * Schedule the full nurture sequence for a new lead
 */
export async function scheduleNurtureSequence(
  storage: IStorage,
  leadId: string,
  createdAt: Date = new Date()
) {
  try {
    for (const step of NURTURE_SEQUENCE) {
      const scheduledFor = new Date(
        createdAt.getTime() + step.delayDays * 24 * 60 * 60 * 1000
      );

      await storage.createScheduledEmail({
        leadId,
        templateKey: step.templateKey,
        scheduledFor,
      });
    }

    log.info(
      `Scheduled ${NURTURE_SEQUENCE.length} nurture emails for lead ${leadId}`
    );
  } catch (error) {
    log.error(`Failed to schedule nurture sequence for lead ${leadId}:`, error);
    throw error;
  }
}

/**
 * Cancel all pending emails for a lead (e.g., when they convert or unsubscribe)
 */
export async function cancelNurtureSequence(
  storage: IStorage,
  leadId: string
) {
  try {
    await storage.cancelScheduledEmails(leadId);
    log.info(`Cancelled pending nurture emails for lead ${leadId}`);
  } catch (error) {
    log.error(`Failed to cancel nurture sequence for lead ${leadId}:`, error);
    throw error;
  }
}

/**
 * Process all due scheduled emails
 */
export async function processScheduledEmails(deps: SchedulerDeps) {
  const now = new Date();

  try {
    const pendingEmails = await deps.storage.getPendingScheduledEmails(now, 10);

    if (pendingEmails.length === 0) {
      return; // No pending emails
    }

    log.info(`Processing ${pendingEmails.length} scheduled emails`);

    for (const scheduled of pendingEmails) {
      try {
        const lead = await deps.getLeadById(scheduled.leadId);
        if (!lead || !lead.email) {
          log.warn(
            `Skipping email ${scheduled.id}: lead not found or no email`
          );
          await deps.storage.updateScheduledEmail(scheduled.id, {
            cancelled: true,
            lastError: "Lead not found or no email",
          });
          continue;
        }

        // Check if lead has unsubscribed
        if (lead.unsubscribed) {
          log.warn(`Skipping email ${scheduled.id}: lead is unsubscribed`);
          await deps.storage.updateScheduledEmail(scheduled.id, {
            cancelled: true,
            lastError: "Lead unsubscribed",
          });
          continue;
        }

        // Detect language from lead data (prefer explicitly set language, fall back to French)
        const lang = lead.language || "fr";

        // Build template data
        const baseUrl = process.env.BASE_URL || "https://app.kwh.quebec";
        const data: Record<string, string> = {
          contactName: lead.contactName || lead.companyName || "there",
          analysisUrl: `${baseUrl}/#detailed`,
          unsubscribeUrl: `${baseUrl}/api/leads/${lead.id}/unsubscribe`,
          companyName: lead.companyName || "",
          address: lead.streetAddress || "",
        };

        // Add financial data for specific templates
        if (
          scheduled.templateKey === "nurturingRisingCosts" &&
          lead.estimatedMonthlyBill
        ) {
          const monthlyBill = lead.estimatedMonthlyBill;
          const annualBill = monthlyBill * 12;
          const escalationRate = 0.035; // 3.5% annually

          data.currentAnnualBill = Math.round(annualBill).toString();
          data.bill5Years = Math.round(
            annualBill * Math.pow(1 + escalationRate, 5)
          ).toString();
          data.increase5Years = Math.round(
            annualBill * (Math.pow(1 + escalationRate, 5) - 1)
          ).toString();
          data.bill10Years = Math.round(
            annualBill * Math.pow(1 + escalationRate, 10)
          ).toString();
          data.increase10Years = Math.round(
            annualBill * (Math.pow(1 + escalationRate, 10) - 1)
          ).toString();
          data.bill25Years = Math.round(
            annualBill * Math.pow(1 + escalationRate, 25)
          ).toString();
          data.increase25Years = Math.round(
            annualBill * (Math.pow(1 + escalationRate, 25) - 1)
          ).toString();
        }

        // Add monthly value for last chance email
        if (
          scheduled.templateKey === "nurturingLastChance" &&
          lead.estimatedMonthlyBill
        ) {
          // Estimate monthly savings at roughly 15-20% of bill (conservative for solar)
          const monthlyValue = Math.round(lead.estimatedMonthlyBill * 0.15);
          data.monthlyValue = monthlyValue.toString();
        }

        // Send the email
        const result = await deps.sendTemplateEmail(
          scheduled.templateKey,
          lead.email,
          data,
          lang
        );

        if (result.success) {
          await deps.storage.updateScheduledEmail(scheduled.id, {
            sentAt: new Date(),
            attempts: (scheduled.attempts || 0) + 1,
          });
          log.info(
            `Sent ${scheduled.templateKey} to ${lead.email} (lead: ${lead.id})`
          );
        } else {
          // Failed to send, increment attempts and log error
          const newAttempts = (scheduled.attempts || 0) + 1;
          const shouldRetry = newAttempts < 3; // Retry up to 3 times

          if (shouldRetry) {
            await deps.storage.updateScheduledEmail(scheduled.id, {
              attempts: newAttempts,
              lastError: result.error || "Unknown error",
            });
            log.warn(
              `Failed to send ${scheduled.templateKey} (attempt ${newAttempts}/3): ${result.error}`
            );
          } else {
            // Too many failures, mark as cancelled
            await deps.storage.updateScheduledEmail(scheduled.id, {
              cancelled: true,
              attempts: newAttempts,
              lastError: `Failed after 3 attempts: ${result.error}`,
            });
            log.error(
              `Cancelled ${scheduled.templateKey} after 3 failed attempts: ${result.error}`
            );
          }
        }
      } catch (error: any) {
        // Log error but continue processing other emails
        const newAttempts = (scheduled.attempts || 0) + 1;
        const shouldRetry = newAttempts < 3;

        if (shouldRetry) {
          await deps.storage.updateScheduledEmail(scheduled.id, {
            attempts: newAttempts,
            lastError: error.message || "Unknown error",
          });
        } else {
          await deps.storage.updateScheduledEmail(scheduled.id, {
            cancelled: true,
            attempts: newAttempts,
            lastError: error.message || "Unknown error",
          });
        }

        log.error(
          `Error processing scheduled email ${scheduled.id}:`,
          error.message
        );
      }
    }

    log.info(`Finished processing ${pendingEmails.length} scheduled emails`);
  } catch (error) {
    log.error("Error processing scheduled emails:", error);
  }
}

/**
 * Start the email scheduler polling loop
 * Call this once at server startup
 */
export function startEmailScheduler(
  deps: SchedulerDeps,
  intervalMs: number = 15 * 60 * 1000
) {
  log.info(
    `Email scheduler started (polling every ${intervalMs / 1000 / 60} minutes)`
  );

  // Process immediately on startup
  processScheduledEmails(deps).catch((err) => {
    log.error("Initial email processing failed:", err);
  });

  // Then poll at interval
  const timer = setInterval(() => {
    processScheduledEmails(deps).catch((err) => {
      log.error("Scheduled email processing failed:", err);
    });
  }, intervalMs);

  return () => {
    clearInterval(timer);
    log.info("Email scheduler stopped");
  };
}
