import { Resend } from 'resend';
import { createLogger } from './lib/logger';

const log = createLogger('Resend');

interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  type?: string;
  cid?: string;
}

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  htmlBody: string;
  textBody?: string;
  from?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
  cc?: string[];
  bcc?: string[];
}

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

function initializeResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    const message = 'RESEND_API_KEY environment variable is not set.';
    log.error(message);
    throw new Error(message);
  }
  log.info('Resend client initialized successfully');
  return new Resend(apiKey);
}

function getSenderEmail(): string {
  return process.env.EMAIL_FROM || 'noreply@kwh.quebec';
}

function normalizeAttachment(attachment: EmailAttachment): { filename: string; content: Buffer; contentId?: string } {
  const content = typeof attachment.content === 'string' ? Buffer.from(attachment.content, 'base64') : attachment.content;
  return { filename: attachment.filename, content, contentId: attachment.cid };
}

export async function sendEmailViaResend(options: SendEmailOptions): Promise<SendEmailResult> {
  log.info(`Attempting to send email to: ${options.to}`);
  log.info(`Subject: ${options.subject}`);
  try {
    const client = initializeResendClient();
    const senderEmail = getSenderEmail();
    const fromAddress = options.from || senderEmail;
    log.info(`Using from email: ${fromAddress}`);
    let normalizedAttachments: Array<{ filename: string; content: Buffer; contentId?: string }> = [];
    if (options.attachments && options.attachments.length > 0) {
      normalizedAttachments = options.attachments.map(normalizeAttachment);
    }
    const response = await client.emails.send({
      from: `kWh Québec <${fromAddress}>`,
      to: options.to,
      subject: options.subject,
      html: options.htmlBody,
      text: options.textBody,
      replyTo: options.replyTo,
      cc: options.cc,
      bcc: options.bcc,
      attachments: normalizedAttachments,
    });
    if (response.error) {
      log.error('Send failed:', response.error);
      return { success: false, error: response.error.message || 'Unknown error from Resend' };
    }
    log.info('Email sent successfully!');
    log.info(`Message ID: ${response.data?.id}`);
    return { success: true, messageId: response.data?.id };
  } catch (error: any) {
    log.error('Exception while sending email:', error.message);
    return { success: false, error: error.message || 'Unknown error' };
  }
}
