/**
 * Portable Email Service — kWh Québec
 * 
 * Replaces the Replit-coupled email connector with a portable Resend implementation.
 * Works on any hosting platform (Replit, Docker, VPS, Vercel, etc.)
 * 
 * Required env vars:
 *   RESEND_API_KEY — API key from resend.com
 *   EMAIL_FROM — (optional) sender address, defaults to noreply@kwh.quebec
 * 
 * Fallback chain: Resend → SMTP (if configured) → log warning
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EmailOptions {
  to: string | string[];
  subject: string;
  htmlBody: string;
  textBody?: string;
  from?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: EmailAttachment[];
  /** Optional tags for tracking (e.g., 'proposal', 'design-agreement', 'welcome') */
  tags?: Array<{ name: string; value: string }>;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  provider: 'resend' | 'smtp' | 'none';
  error?: string;
}

// ─── Resend Implementation ──────────────────────────────────────────────────

async function sendViaResend(opts: EmailOptions): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { success: false, provider: 'resend', error: 'RESEND_API_KEY not set' };
  }

  const defaultFrom = process.env.EMAIL_FROM || 'kWh Québec <noreply@kwh.quebec>';

  const body: Record<string, unknown> = {
    from: opts.from || defaultFrom,
    to: Array.isArray(opts.to) ? opts.to : [opts.to],
    subject: opts.subject,
    html: opts.htmlBody,
  };

  if (opts.textBody) body.text = opts.textBody;
  if (opts.replyTo) body.reply_to = opts.replyTo;
  if (opts.cc) body.cc = Array.isArray(opts.cc) ? opts.cc : [opts.cc];
  if (opts.bcc) body.bcc = Array.isArray(opts.bcc) ? opts.bcc : [opts.bcc];
  if (opts.tags) body.tags = opts.tags;

  if (opts.attachments?.length) {
    body.attachments = opts.attachments.map((a) => ({
      filename: a.filename,
      content: typeof a.content === 'string' ? a.content : a.content.toString('base64'),
      content_type: a.contentType,
    }));
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        provider: 'resend',
        error: `Resend API error ${response.status}: ${JSON.stringify(errorData)}`,
      };
    }

    const data = await response.json() as { id: string };
    return {
      success: true,
      messageId: data.id,
      provider: 'resend',
    };
  } catch (err) {
    return {
      success: false,
      provider: 'resend',
      error: `Resend fetch error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── SMTP Fallback ──────────────────────────────────────────────────────────

async function sendViaSMTP(opts: EmailOptions): Promise<EmailResult> {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return { success: false, provider: 'smtp', error: 'SMTP not configured (SMTP_HOST/USER/PASS)' };
  }

  try {
    // Dynamic import to avoid requiring nodemailer when using Resend
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host,
      port: Number(port) || 587,
      secure: Number(port) === 465,
      auth: { user, pass },
    });

    const info = await transporter.sendMail({
      from: opts.from || process.env.EMAIL_FROM || 'kWh Québec <noreply@kwh.quebec>',
      to: Array.isArray(opts.to) ? opts.to.join(', ') : opts.to,
      subject: opts.subject,
      html: opts.htmlBody,
      text: opts.textBody,
      replyTo: opts.replyTo,
      cc: opts.cc,
      bcc: opts.bcc,
      attachments: opts.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });

    return {
      success: true,
      messageId: info.messageId,
      provider: 'smtp',
    };
  } catch (err) {
    return {
      success: false,
      provider: 'smtp',
      error: `SMTP error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── Main Export ────────────────────────────────────────────────────────────

/**
 * Send an email using the best available provider.
 * Priority: Resend (primary) → SMTP (fallback) → error
 * 
 * @example
 * const result = await sendEmail({
 *   to: 'client@example.com',
 *   subject: 'Your Solar Proposal — kWh Québec',
 *   htmlBody: '<h1>Your proposal is ready</h1>...',
 *   tags: [{ name: 'type', value: 'proposal' }],
 * });
 */
export async function sendEmail(opts: EmailOptions): Promise<EmailResult> {
  // Try Resend first
  const resendResult = await sendViaResend(opts);
  if (resendResult.success) return resendResult;

  // Fallback to SMTP if Resend fails
  console.warn(`[email] Resend failed (${resendResult.error}), trying SMTP fallback...`);
  const smtpResult = await sendViaSMTP(opts);
  if (smtpResult.success) return smtpResult;

  // Both failed
  console.error(`[email] All providers failed. Resend: ${resendResult.error} | SMTP: ${smtpResult.error}`);
  return {
    success: false,
    provider: 'none',
    error: `All email providers failed. Resend: ${resendResult.error} | SMTP: ${smtpResult.error}`,
  };
}

// ─── Convenience Functions ──────────────────────────────────────────────────

/** Send a proposal email with PDF attachment */
export async function sendProposalEmail(
  clientEmail: string,
  clientName: string,
  projectName: string,
  pdfBuffer: Buffer
): Promise<EmailResult> {
  return sendEmail({
    to: clientEmail,
    subject: `Votre proposition solaire — ${projectName} | kWh Québec`,
    htmlBody: `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2>Bonjour ${clientName},</h2>
        <p>Veuillez trouver ci-joint votre proposition solaire pour <strong>${projectName}</strong>.</p>
        <p>N'hésitez pas à nous contacter pour toute question.</p>
        <br/>
        <p>L'équipe kWh Québec</p>
        <hr style="border: none; border-top: 1px solid #eee;" />
        <p style="font-size: 12px; color: #999;">
          kWh Québec — Solutions solaires commerciales
        </p>
      </div>
    `,
    replyTo: 'info@kwh.quebec',
    attachments: [{
      filename: `Proposition-${projectName.replace(/\s+/g, '-')}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf',
    }],
    tags: [
      { name: 'type', value: 'proposal' },
      { name: 'project', value: projectName },
    ],
  });
}

/** Send a Design Agreement payment confirmation */
export async function sendDesignAgreementConfirmation(
  clientEmail: string,
  clientName: string,
  leadId: number
): Promise<EmailResult> {
  return sendEmail({
    to: clientEmail,
    subject: 'Confirmation Design Agreement — kWh Québec',
    htmlBody: `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2>Merci ${clientName}!</h2>
        <p>Nous confirmons la réception de votre paiement de <strong>2 500 $ CAD</strong> pour le Design Agreement.</p>
        <p>Ce montant sera <strong>crédité intégralement</strong> sur votre contrat EPC final.</p>
        <h3>Prochaines étapes:</h3>
        <ol>
          <li>Visite de site (dans les 5 jours ouvrables)</li>
          <li>Analyse structurale et électrique</li>
          <li>Design solaire détaillé</li>
          <li>Demande d'interconnexion Hydro-Québec</li>
          <li>Offre ferme</li>
        </ol>
        <p>Référence: <strong>Lead #${leadId}</strong></p>
        <br/>
        <p>L'équipe kWh Québec</p>
      </div>
    `,
    replyTo: 'info@kwh.quebec',
    tags: [
      { name: 'type', value: 'design-agreement-confirmation' },
      { name: 'leadId', value: String(leadId) },
    ],
  });
}
