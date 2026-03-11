import { Resend } from 'resend';
import { createLogger } from './lib/logger';

const log = createLogger('Resend');

/**
 * Represents an email attachment in Resend format.
 */
interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  type?: string;
  cid?: string;
}

/**
 * Options for sending an email via Resend.
 */
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

/**
 * Response from sending an email.
 */
interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Initialize Resend client from environment variables.
 * Works on any platform (not Replit-dependent).
 *
 * @throws Error if RESEND_API_KEY is not set
 * @returns Resend client instance
 */
function initializeResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    const message =
      'RESEND_API_KEY environment variable is not set. Please configure it in your .env file or deployment platform.';
    log.error(message);
    throw new Error(message);
  }

  log.info('Resend client initialized successfully');
  return new Resend(apiKey);
}

/**
 * Get the sender email address from environment or use default.
 *
 * @returns Sender email address
 */
function getSenderEmail(): string {
  return process.env.EMAIL_FROM || 'noreply@kwh.quebec';
}

/**
 * Convert attachment content to Buffer if it's a base64 string.
 *
 * @param attachment - The attachment object
 * @returns Attachment with Buffer content
 */
function normalizeAttachment(
  attachment: EmailAttachment
): { filename: string; content: Buffer; contentId?: string } {
  const content =
    typeof attachment.content === 'string'
      ? Buffer.from(attachment.content, 'base64')
      : attachment.content;

  return {
    filename: attachment.filename,
    content,
    contentId: attachment.cid,
  };
}

/**
 * Send an email via Resend.
 *
 * This function:
 * - Validates that RESEND_API_KEY is configured
 * - Converts recipient list to string/array as needed
 * - Handles base64-encoded attachments
 * - Returns a standardized result object
 * - Logs all operations for debugging
 *
 * @param options - Email options (to, subject, htmlBody, etc.)
 * @returns Promise resolving to { success, messageId?, error? }
 *
 * @example
 * const result = await sendEmailViaResend({
 *   to: 'client@example.com',
 *   subject: 'Your Solar Analysis',
 *   htmlBody: '<h1>Analysis Results</h1>...',
 *   textBody: 'Analysis Results...',
 *   from: 'analysis@kwh.quebec',
 *   replyTo: 'support@kwh.quebec',
 * });
 */
export async function sendEmailViaResend(
  options: SendEmailOptions
): Promise<SendEmailResult> {
  log.info(`Attempting to send email to: ${options.to}`);
  log.info(`Subject: ${options.subject}`);

  try {
    log.info('Initializing Resend client...');
    const client = initializeResendClient();
    const senderEmail = getSenderEmail();
    const fromAddress = options.from || senderEmail;

    log.info(`Using from email: ${fromAddress}`);

    // Normalize attachments if provided
    let normalizedAttachments: Array<{
      filename: string;
      content: Buffer;
      contentId?: string;
    }> = [];
    if (options.attachments && options.attachments.length > 0) {
      log.info(
        `Processing ${options.attachments.length} attachment(s)...`
      );
      normalizedAttachments = options.attachments.map(normalizeAttachment);
    }

    log.info('Sending email via Resend API...');
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
      return {
        success: false,
        error: response.error.message || 'Unknown error from Resend',
      };
    }

    log.info('Email sent successfully!');
    log.info(`Message ID: ${response.data?.id}`);

    return {
      success: true,
      messageId: response.data?.id,
    };
  } catch (error: any) {
    log.error('Exception while sending email:', error.message);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}
