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

// Nurture sequence definition - Aligned with Oleg sales funnel stages
// Day 0: Instant Indicative (estimator results)
// Day 1: Qualification Gate (10-min discovery call)
// Day 3: Risk flags or value reinforcement
// Day 7: Tripwire - Design mandate offer
// Day 14: Case study / social proof
// Day 21: Last chance / FOMO with incentive expiry
// Day 30: Re-engagement check
const NURTURE_SEQUENCE = [
  { templateKey: "nurtureWelcome", delayDays: 0 },          // Day 0: Welcome + quick results
  { templateKey: "nurtureCTA1", delayDays: 1 },              // Day 1: Discovery call CTA
  { templateKey: "nurtureRiskFlags", delayDays: 3 },         // Day 3: Risk flags or value
  { templateKey: "nurtureTripwire", delayDays: 7 },          // Day 7: Design mandate ($2,500)
  { templateKey: "nurturingCaseStudy", delayDays: 14 },      // Day 14: Case study/social proof
  { templateKey: "nurturingLastChance", delayDays: 21 },     // Day 21: Last chance/FOMO
  { templateKey: "nurtureReengagement", delayDays: 30 },     // Day 30: Re-engagement check
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
    const globalSetting = await deps.storage.getSystemSetting("email_nurturing_enabled");
    if (globalSetting && globalSetting.value === false) {
      log.info("Global email nurturing is disabled, skipping all scheduled emails");
      return;
    }
    if (globalSetting && typeof globalSetting.value !== "boolean") {
      log.warn(`email_nurturing_enabled has non-boolean value: ${JSON.stringify(globalSetting.value)}, treating as enabled`);
    }

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

        // CONVERSION DETECTION: Stop nurture if lead has converted
        // Stages that indicate conversion/advancement beyond nurture
        const CONVERSION_STAGES = [
          "design_mandate_signed",  // Lead signed design mandate (Stage 3)
          "epc_proposal_sent",      // EPC proposal sent (Stage 4)
          "negotiation",            // In negotiation
          "won",                    // Deal won
        ];

        if (CONVERSION_STAGES.includes(lead.stage)) {
          log.info(`Skipping email ${scheduled.id}: lead has converted to stage "${lead.stage}"`);
          await deps.storage.updateScheduledEmail(scheduled.id, {
            cancelled: true,
            lastError: `Lead converted to stage: ${lead.stage}`,
          });
          // Cancel ALL remaining emails in this sequence
          await deps.storage.cancelScheduledEmails(lead.id);
          continue;
        }

        // Check if lead has been disqualified
        if (lead.qualificationStatus === "disqualified") {
          log.warn(`Skipping email ${scheduled.id}: lead is disqualified`);
          await deps.storage.updateScheduledEmail(scheduled.id, {
            cancelled: true,
            lastError: "Lead disqualified",
          });
          // Cancel ALL remaining emails
          await deps.storage.cancelScheduledEmails(lead.id);
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

        // Check nurture status
        if (lead.nurtureStatus === "paused" || lead.nurtureStatus === "stopped") {
          log.info(`Skipping email ${scheduled.id}: lead nurture is ${lead.nurtureStatus}`);
          if (lead.nurtureStatus === "stopped") {
            await deps.storage.updateScheduledEmail(scheduled.id, {
              cancelled: true,
              lastError: "Lead nurture stopped",
            });
          }
          continue;
        }

        // Detect language from lead data (prefer explicitly set language, fall back to French)
        const lang = lead.language || "fr";

        // Build template data - Standard personalization variables
        const baseUrl = process.env.BASE_URL || "https://app.kwh.quebec";
        const calendlyUrl = process.env.VITE_CALENDLY_URL || "https://calendly.com/kwh-quebec/consultation";

        const data: Record<string, string> = {
          // Personalization variables (4.2 spec) - Dynamic data from lead
          companyName: lead.companyName || "",
          contactName: lead.contactName || lead.companyName || "there",
          monthlyBill: lead.estimatedMonthlyBill ? `$${Math.round(lead.estimatedMonthlyBill)}` : "",
          // Use quickAnalysis fields if available (from quick estimate)
          estimatedSavings: lead.quickAnalysisAnnualSavings
            ? `$${Math.round(lead.quickAnalysisAnnualSavings)}`
            : (lead.estimatedMonthlyBill
              ? `$${Math.round(lead.estimatedMonthlyBill * 12 * 0.15)}`  // Conservative 15% savings estimate
              : "TBD"),
          estimatedSystemSize: lead.pvSizeKW
            ? `${lead.pvSizeKW} kW`
            : "TBD",
          estimatedROI: lead.quickAnalysisPaybackYears
            ? `${Math.round(lead.quickAnalysisPaybackYears)} ans`
            : (lead.estimatedMonthlyBill
              ? `~4-6 ans`  // Conservative estimate
              : "TBD"),
          fitScore: lead.qualificationStatus || "pending",
          leadColor: lead.qualificationStatus || "pending",

          // URLs
          calendlyUrl,
          analysisUrl: `${baseUrl}/#detailed`,
          unsubscribeUrl: `${baseUrl}/api/leads/${lead.id}/unsubscribe`,

          // Basic info
          address: lead.streetAddress || "",
        };

        // Risk flags (if any blockers identified)
        if (scheduled.templateKey === "nurtureRiskFlags") {
          // Build risk flags list from lead data
          const riskItems: string[] = [];
          if (lead.roofCondition && lead.roofCondition.includes("poor")) {
            riskItems.push(lang === "fr" ? "• État de la toiture à évaluer" : "• Roof condition to assess");
          }
          if (lead.structuralPassStatus === "no") {
            riskItems.push(lang === "fr" ? "• Charges structurales insuffisantes" : "• Insufficient structural capacity");
          }
          if (lead.electricalCapacity && lead.electricalCapacity < 100) {
            riskItems.push(lang === "fr" ? "• Mise à niveau électrique possible" : "• Possible electrical upgrade needed");
          }
          // If no specific risks, provide positive message
          if (riskItems.length === 0) {
            data.riskFlags = lang === "fr"
              ? "Aucun blocage identifié — votre projet est très prometteur!"
              : "No blockers identified — your project is very promising!";
          } else {
            data.riskFlags = riskItems.join("\n");
          }
        }

        // Add estimated savings for last chance email
        if (scheduled.templateKey === "nurturingLastChance" && lead.estimatedMonthlyBill) {
          // Estimate monthly savings at roughly 15-20% of bill (conservative for solar)
          const monthlyValue = Math.round(lead.estimatedMonthlyBill * 0.15);
          data.estimatedSavings = `$${monthlyValue}`;
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
