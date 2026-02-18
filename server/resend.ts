// Resend integration for sending transactional emails via Replit connector
// Connection: conn_resend_01KFNMNXX9JSJYFQBTG1Q7CKGE
import { Resend } from 'resend';
import { createLogger } from "./lib/logger";

const log = createLogger("Resend");

let connectionSettings: any;

async function getCredentials() {
  log.info('Fetching credentials from Replit connector...');
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  log.info(`Connector hostname: ${hostname}`);
  
  const tokenSource = process.env.REPL_IDENTITY 
    ? 'repl' 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl' 
    : null;
  
  const xReplitToken = tokenSource === 'repl'
    ? 'repl ' + process.env.REPL_IDENTITY
    : tokenSource === 'depl'
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  log.info(`Token source: ${tokenSource}`);

  if (!xReplitToken) {
    log.error('No repl/depl identity token found');
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  const connectorUrl = 'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend';
  log.info(`Fetching from: ${connectorUrl}`);

  try {
    const response = await fetch(connectorUrl, {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    });

    log.info(`Connector response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      log.error(`Connector error response: ${errorText}`);
      throw new Error(`Connector returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    log.info(`Connector returned ${data.items?.length || 0} connection(s)`);

    if (!data.items || data.items.length === 0) {
      log.error('No Resend connections found in connector response');
      throw new Error('Resend not connected - no connections returned');
    }

    connectionSettings = data.items[0];
    log.info(`Connection ID: ${connectionSettings.id}`);

  } catch (fetchError: any) {
    log.error('Failed to fetch from connector:', fetchError.message);
    throw fetchError;
  }

  if (!connectionSettings || !connectionSettings.settings?.api_key) {
    log.error('No API key found in connection settings');
    throw new Error('Resend not connected - no API key');
  }

  log.info('Credentials obtained successfully');
  return {
    apiKey: connectionSettings.settings.api_key,
    fromEmail: connectionSettings.settings.from_email || 'noreply@kwh.quebec'
  };
}

// WARNING: Never cache this client. Always call this function to get a fresh client.
export async function getResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}

export async function sendEmailViaResend(options: {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  replyTo?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  log.info(`Attempting to send email to: ${options.to}`);
  log.info(`Subject: ${options.subject}`);

  try {
    log.info('Getting Resend client...');
    const { client, fromEmail } = await getResendClient();
    log.info(`Using from email: ${fromEmail}`);

    log.info('Sending email via Resend API...');
    const response = await client.emails.send({
      from: `kWh Québec <${fromEmail}>`,
      to: options.to,
      subject: options.subject,
      html: options.htmlBody,
      text: options.textBody,
      replyTo: options.replyTo,
    });

    if (response.error) {
      log.error('Send failed:', response.error);
      return { 
        success: false, 
        error: response.error.message || 'Unknown error from Resend' 
      };
    }

    log.info('Email sent successfully!');
    log.info(`Message ID: ${response.data?.id}`);

    return { 
      success: true, 
      messageId: response.data?.id 
    };

  } catch (error: any) {
    log.error('Exception while sending email:', error.message);
    return { 
      success: false, 
      error: error.message || 'Unknown error' 
    };
  }
}
