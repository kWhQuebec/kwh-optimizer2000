// Resend integration for sending transactional emails via Replit connector
// Connection: conn_resend_01KFNMNXX9JSJYFQBTG1Q7CKGE
import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  console.log('[Resend] Fetching credentials from Replit connector...');
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  console.log(`[Resend] Connector hostname: ${hostname}`);
  
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

  console.log(`[Resend] Token source: ${tokenSource}`);

  if (!xReplitToken) {
    console.error('[Resend] No repl/depl identity token found');
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  const connectorUrl = 'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend';
  console.log(`[Resend] Fetching from: ${connectorUrl}`);

  try {
    const response = await fetch(connectorUrl, {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    });

    console.log(`[Resend] Connector response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Resend] Connector error response: ${errorText}`);
      throw new Error(`Connector returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log(`[Resend] Connector returned ${data.items?.length || 0} connection(s)`);

    if (!data.items || data.items.length === 0) {
      console.error('[Resend] No Resend connections found in connector response');
      throw new Error('Resend not connected - no connections returned');
    }

    connectionSettings = data.items[0];
    console.log(`[Resend] Connection ID: ${connectionSettings.id}`);

  } catch (fetchError: any) {
    console.error('[Resend] Failed to fetch from connector:', fetchError.message);
    throw fetchError;
  }

  if (!connectionSettings || !connectionSettings.settings?.api_key) {
    console.error('[Resend] No API key found in connection settings');
    throw new Error('Resend not connected - no API key');
  }

  console.log('[Resend] Credentials obtained successfully');
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
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  console.log(`[Resend] Attempting to send email to: ${options.to}`);
  console.log(`[Resend] Subject: ${options.subject}`);

  try {
    console.log('[Resend] Getting Resend client...');
    const { client, fromEmail } = await getResendClient();
    console.log(`[Resend] Using from email: ${fromEmail}`);

    console.log('[Resend] Sending email via Resend API...');
    const response = await client.emails.send({
      from: `kWh Québec <${fromEmail}>`,
      to: options.to,
      subject: options.subject,
      html: options.htmlBody,
      text: options.textBody,
    });

    if (response.error) {
      console.error('[Resend] Send failed:', response.error);
      return { 
        success: false, 
        error: response.error.message || 'Unknown error from Resend' 
      };
    }

    console.log('[Resend] Email sent successfully!');
    console.log(`[Resend] Message ID: ${response.data?.id}`);

    return { 
      success: true, 
      messageId: response.data?.id 
    };

  } catch (error: any) {
    console.error('[Resend] Exception while sending email:', error.message);
    return { 
      success: false, 
      error: error.message || 'Unknown error' 
    };
  }
}
