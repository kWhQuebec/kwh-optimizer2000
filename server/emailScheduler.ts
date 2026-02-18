import type { IStorage } from "./storage";

const NURTURE_SEQUENCE = [
  { templateKey: "nurtureCTA1", delayDays: 1 },
  { templateKey: "nurtureReengagement", delayDays: 30 },
];

export const scheduleEmail = async (lead: any) => {
  const emailData = {
    leadId: lead.id,
    contactName: lead.contactName,
    companyName: lead.companyName,
    estimatedSystemSize: lead.estimatedSystemSize ? `${Math.round(lead.estimatedSystemSize)} kW` : "",
    estimatedSavings: lead.estimatedSavings ? `$${Math.round(lead.estimatedSavings).toLocaleString()}` : "",
    estimatedROI: lead.estimatedROI ? `${lead.estimatedROI.toFixed(1)}%` : "",
    leadColor: lead.qualificationStatus || "pending",
    annualConsumptionKwh: lead.annualConsumptionKwh ? `${Math.round(lead.annualConsumptionKwh).toLocaleString()} kWh` : "",
  };
  return emailData;
};

export async function scheduleNurtureSequence(storage: IStorage, leadId: string): Promise<void> {
  const now = new Date();
  for (const step of NURTURE_SEQUENCE) {
    const scheduledFor = new Date(now.getTime() + step.delayDays * 24 * 60 * 60 * 1000);
    await storage.createScheduledEmail({
      leadId,
      templateKey: step.templateKey,
      scheduledFor,
    });
  }
}

interface EmailSchedulerConfig {
  storage: IStorage;
  sendTemplateEmail: (templateKey: string, to: string, data: Record<string, string>, lang: 'fr' | 'en') => Promise<{ success: boolean; error?: string }>;
  getLeadById: (id: string) => Promise<any>;
  intervalMs?: number;
}

export function startEmailScheduler(config: EmailSchedulerConfig): () => void {
  const { storage, sendTemplateEmail, getLeadById, intervalMs = 60000 } = config;

  const processScheduledEmails = async () => {
    try {
      const pendingEmails = await storage.getPendingScheduledEmails(new Date(), 50);
      for (const email of pendingEmails) {
        try {
          const lead = await getLeadById(email.leadId);
          if (!lead || !lead.email) continue;

          const data: Record<string, string> = {
            contactName: lead.contactName || lead.companyName || '',
            companyName: lead.companyName || '',
            estimatedSystemSize: lead.estimatedSystemSize ? `${Math.round(lead.estimatedSystemSize)} kW` : '',
            estimatedSavings: lead.estimatedSavings ? `$${Math.round(lead.estimatedSavings).toLocaleString()}` : '',
            monthlyBill: lead.monthlyBill ? `$${Math.round(lead.monthlyBill).toLocaleString()}` : '',
            calendlyUrl: 'https://calendly.com/kwhquebec/decouverte',
          };

          const result = await sendTemplateEmail(email.templateKey, lead.email, data, 'fr');

          if (result.success) {
            await storage.updateScheduledEmail(email.id, { sentAt: new Date(), attempts: (email.attempts || 0) + 1 });
          } else {
            await storage.updateScheduledEmail(email.id, { lastError: result.error, attempts: (email.attempts || 0) + 1 });
          }
        } catch (err: any) {
          await storage.updateScheduledEmail(email.id, { lastError: err.message, attempts: (email.attempts || 0) + 1 });
        }
      }
    } catch (err) {
    }
  };

  const timer = setInterval(processScheduledEmails, intervalMs);
  processScheduledEmails();

  return () => clearInterval(timer);
}
