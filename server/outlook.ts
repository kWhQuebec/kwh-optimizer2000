// Outlook integration for sending emails via Replit connector (Microsoft Graph API)
// Connected via: connection:conn_outlook_01KFM1HT2NJNCJ2CP50KXW5VZ8
import { Client } from '@microsoft/microsoft-graph-client';

let connectionSettings: any;

async function getAccessToken() {
  console.log('[Outlook] Checking for cached access token...');
  if (connectionSettings && connectionSettings.settings?.expires_at) {
    const expiresAt = new Date(connectionSettings.settings.expires_at).getTime();
    const remainingMs = expiresAt - Date.now();
    if (remainingMs > 0) {
      console.log(`[Outlook] Using cached access token (expires in ${Math.round(remainingMs / 1000)}s)`);
      return connectionSettings.settings.access_token;
    }
    console.log('[Outlook] Cached token expired, fetching new one...');
  } else {
    console.log('[Outlook] No cached token available');
  }
  
  console.log('[Outlook] Fetching new access token from Replit connector...');
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  console.log(`[Outlook] Connector hostname: ${hostname}`);
  
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
  
  console.log(`[Outlook] Token source: ${tokenSource}`);

  if (!xReplitToken) {
    console.error('[Outlook] No repl/depl identity token found');
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  const connectorUrl = 'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=outlook';
  console.log(`[Outlook] Fetching from: ${connectorUrl}`);
  
  try {
    const response = await fetch(connectorUrl, {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    });
    
    console.log(`[Outlook] Connector response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Outlook] Connector error response: ${errorText}`);
      throw new Error(`Connector returned ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    console.log(`[Outlook] Connector returned ${data.items?.length || 0} connection(s)`);
    
    if (!data.items || data.items.length === 0) {
      console.error('[Outlook] No Outlook connections found in connector response');
      throw new Error('Outlook not connected - no connections returned');
    }
    
    connectionSettings = data.items[0];
    console.log(`[Outlook] Connection ID: ${connectionSettings.id}`);
    
    if (connectionSettings.settings?.expires_at) {
      const expiresAt = new Date(connectionSettings.settings.expires_at);
      console.log(`[Outlook] Token expires at: ${expiresAt.toISOString()}`);
    }
    
  } catch (fetchError: any) {
    console.error('[Outlook] Failed to fetch from connector:', fetchError.message);
    throw fetchError;
  }

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    console.error('[Outlook] No access token found in connection settings');
    console.error('[Outlook] Connection settings keys:', Object.keys(connectionSettings?.settings || {}));
    throw new Error('Outlook not connected - no access token');
  }
  
  console.log('[Outlook] Access token obtained successfully');
  return accessToken;
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
async function getOutlookClient() {
  const accessToken = await getAccessToken();

  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => accessToken
    }
  });
}

interface EmailAttachment {
  filename: string;
  content: string; // Base64 encoded content
  type: string; // MIME type
}

interface EmailOptions {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  attachments?: EmailAttachment[];
}

export async function sendEmailViaOutlook(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  console.log(`[Outlook] Attempting to send email to: ${options.to}`);
  console.log(`[Outlook] Subject: ${options.subject}`);
  
  try {
    console.log('[Outlook] Getting Outlook client...');
    const client = await getOutlookClient();
    console.log('[Outlook] Outlook client obtained successfully');
    
    // Build the message payload for Microsoft Graph API
    const message: any = {
      subject: options.subject,
      body: {
        contentType: 'HTML',
        content: options.htmlBody
      },
      toRecipients: [
        {
          emailAddress: {
            address: options.to
          }
        }
      ]
    };
    
    // Add attachments if present
    if (options.attachments && options.attachments.length > 0) {
      message.attachments = options.attachments.map(att => ({
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: att.filename,
        contentType: att.type,
        contentBytes: att.content
      }));
    }
    
    console.log('[Outlook] Sending email via Microsoft Graph API...');
    console.log(`[Outlook] Message payload size: ${JSON.stringify(message).length} bytes`);
    
    // Send email using Microsoft Graph API
    const result = await client.api('/me/sendMail').post({
      message: message,
      saveToSentItems: true
    });
    
    console.log('[Outlook] Email sent successfully!');
    
    return {
      success: true,
      messageId: result?.id || 'sent'
    };
    
  } catch (error: any) {
    console.error('[Outlook] Error sending email:', error);
    console.error('[Outlook] Error details:', error.message);
    
    if (error.statusCode) {
      console.error(`[Outlook] Status code: ${error.statusCode}`);
    }
    if (error.code) {
      console.error(`[Outlook] Error code: ${error.code}`);
    }
    if (error.body) {
      console.error(`[Outlook] Error body:`, error.body);
    }
    
    return {
      success: false,
      error: error.message || 'Failed to send email via Outlook'
    };
  }
}
