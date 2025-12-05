// Gmail integration for sending emails via Replit connector
import { google } from 'googleapis';

let connectionSettings: any;

async function getAccessToken() {
  console.log('[Gmail] Checking for cached access token...');
  if (connectionSettings && connectionSettings.settings?.expires_at) {
    const expiresAt = new Date(connectionSettings.settings.expires_at).getTime();
    const remainingMs = expiresAt - Date.now();
    if (remainingMs > 0) {
      console.log(`[Gmail] Using cached access token (expires in ${Math.round(remainingMs / 1000)}s)`);
      return connectionSettings.settings.access_token;
    }
    console.log('[Gmail] Cached token expired, fetching new one...');
  } else {
    console.log('[Gmail] No cached token available');
  }
  
  console.log('[Gmail] Fetching new access token from Replit connector...');
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  console.log(`[Gmail] Connector hostname: ${hostname}`);
  
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
  
  console.log(`[Gmail] Token source: ${tokenSource}`);

  if (!xReplitToken) {
    console.error('[Gmail] No repl/depl identity token found');
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  const connectorUrl = 'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-mail';
  console.log(`[Gmail] Fetching from: ${connectorUrl}`);
  
  try {
    const response = await fetch(connectorUrl, {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    });
    
    console.log(`[Gmail] Connector response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Gmail] Connector error response: ${errorText}`);
      throw new Error(`Connector returned ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    console.log(`[Gmail] Connector returned ${data.items?.length || 0} connection(s)`);
    
    if (!data.items || data.items.length === 0) {
      console.error('[Gmail] No Gmail connections found in connector response');
      throw new Error('Gmail not connected - no connections returned');
    }
    
    connectionSettings = data.items[0];
    console.log(`[Gmail] Connection ID: ${connectionSettings.id}`);
    console.log(`[Gmail] Connection name: ${connectionSettings.name}`);
    
    if (connectionSettings.settings?.expires_at) {
      const expiresAt = new Date(connectionSettings.settings.expires_at);
      console.log(`[Gmail] Token expires at: ${expiresAt.toISOString()}`);
    }
    
  } catch (fetchError: any) {
    console.error('[Gmail] Failed to fetch from connector:', fetchError.message);
    throw fetchError;
  }

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    console.error('[Gmail] No access token found in connection settings');
    console.error('[Gmail] Connection settings keys:', Object.keys(connectionSettings?.settings || {}));
    throw new Error('Gmail not connected - no access token');
  }
  
  console.log('[Gmail] Access token obtained successfully');
  return accessToken;
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
async function getGmailClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

interface EmailOptions {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
}

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  console.log(`[Gmail] Attempting to send email to: ${options.to}`);
  console.log(`[Gmail] Subject: ${options.subject}`);
  
  try {
    console.log('[Gmail] Getting Gmail client...');
    const gmail = await getGmailClient();
    console.log('[Gmail] Gmail client obtained successfully');
    
    // Build the email message in RFC 2822 format
    const boundary = '----=_Part_' + Date.now();
    const emailLines = [
      `To: ${options.to}`,
      `Subject: =?UTF-8?B?${Buffer.from(options.subject).toString('base64')}?=`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(options.textBody || options.htmlBody.replace(/<[^>]*>/g, '')).toString('base64'),
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(options.htmlBody).toString('base64'),
      '',
      `--${boundary}--`
    ];
    
    const rawMessage = emailLines.join('\r\n');
    const encodedMessage = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    console.log('[Gmail] Sending email via Gmail API...');
    console.log(`[Gmail] Message payload size: ${encodedMessage.length} bytes`);
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });

    console.log('[Gmail] Email sent successfully!');
    console.log(`[Gmail] Response status: ${response.status}`);
    console.log(`[Gmail] Message ID: ${response.data.id}`);
    console.log(`[Gmail] Thread ID: ${response.data.threadId}`);
    console.log(`[Gmail] Labels: ${JSON.stringify(response.data.labelIds)}`);

    return {
      success: true,
      messageId: response.data.id || undefined
    };
  } catch (error: any) {
    console.error('[Gmail] ERROR sending email:', error);
    console.error('[Gmail] Error name:', error.name);
    console.error('[Gmail] Error message:', error.message);
    console.error('[Gmail] Error code:', error.code);
    if (error.response) {
      console.error('[Gmail] API Response status:', error.response.status);
      console.error('[Gmail] API Response data:', JSON.stringify(error.response.data));
    }
    return {
      success: false,
      error: error.message || 'Failed to send email'
    };
  }
}

// Generate portal invitation email content
export function generatePortalInvitationEmail(params: {
  clientName: string;
  contactName: string;
  email: string;
  tempPassword: string;
  portalUrl: string;
  language: 'fr' | 'en';
}): { subject: string; htmlBody: string; textBody: string } {
  const { clientName, contactName, email, tempPassword, portalUrl, language } = params;
  
  if (language === 'fr') {
    return {
      subject: `Accès au portail client kWh Québec - ${clientName}`,
      htmlBody: `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e3a5f 0%, #2d5a8f 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9f9f9; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
    .credentials { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f5a623; }
    .credentials p { margin: 8px 0; }
    .credentials strong { color: #1e3a5f; }
    .button { display: inline-block; background: #f5a623; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    .logo { font-size: 28px; font-weight: bold; }
    .logo span { color: #f5a623; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">kWh<span>Québec</span></div>
      <h1>Bienvenue sur le portail client</h1>
    </div>
    <div class="content">
      <p>Bonjour ${contactName},</p>
      
      <p>Vous avez maintenant accès au <strong>Portail Client kWh Québec</strong> pour <strong>${clientName}</strong>.</p>
      
      <p>Ce portail vous permet de consulter en tout temps les analyses solaires et les rapports de vos projets.</p>
      
      <div class="credentials">
        <p><strong>Vos identifiants de connexion :</strong></p>
        <p>Courriel : <strong>${email}</strong></p>
        <p>Mot de passe temporaire : <strong>${tempPassword}</strong></p>
      </div>
      
      <p style="text-align: center;">
        <a href="${portalUrl}" class="button">Accéder au portail</a>
      </p>
      
      <p><em>Pour des raisons de sécurité, nous vous recommandons de changer votre mot de passe lors de votre première connexion.</em></p>
      
      <p>Si vous avez des questions, n'hésitez pas à nous contacter.</p>
      
      <p>Cordialement,<br>
      L'équipe kWh Québec</p>
    </div>
    <div class="footer">
      <p>kWh Québec - Solaire + Stockage</p>
      <p>Ce courriel a été envoyé automatiquement. Veuillez ne pas y répondre directement.</p>
    </div>
  </div>
</body>
</html>`,
      textBody: `Bonjour ${contactName},

Vous avez maintenant accès au Portail Client kWh Québec pour ${clientName}.

Ce portail vous permet de consulter en tout temps les analyses solaires et les rapports de vos projets.

Vos identifiants de connexion :
- Courriel : ${email}
- Mot de passe temporaire : ${tempPassword}

Accédez au portail : ${portalUrl}

Pour des raisons de sécurité, nous vous recommandons de changer votre mot de passe lors de votre première connexion.

Si vous avez des questions, n'hésitez pas à nous contacter.

Cordialement,
L'équipe kWh Québec`
    };
  } else {
    return {
      subject: `kWh Québec Client Portal Access - ${clientName}`,
      htmlBody: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e3a5f 0%, #2d5a8f 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9f9f9; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
    .credentials { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f5a623; }
    .credentials p { margin: 8px 0; }
    .credentials strong { color: #1e3a5f; }
    .button { display: inline-block; background: #f5a623; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    .logo { font-size: 28px; font-weight: bold; }
    .logo span { color: #f5a623; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">kWh<span>Québec</span></div>
      <h1>Welcome to the Client Portal</h1>
    </div>
    <div class="content">
      <p>Hello ${contactName},</p>
      
      <p>You now have access to the <strong>kWh Québec Client Portal</strong> for <strong>${clientName}</strong>.</p>
      
      <p>This portal allows you to view your solar analyses and project reports at any time.</p>
      
      <div class="credentials">
        <p><strong>Your login credentials:</strong></p>
        <p>Email: <strong>${email}</strong></p>
        <p>Temporary Password: <strong>${tempPassword}</strong></p>
      </div>
      
      <p style="text-align: center;">
        <a href="${portalUrl}" class="button">Access the Portal</a>
      </p>
      
      <p><em>For security reasons, we recommend changing your password upon first login.</em></p>
      
      <p>If you have any questions, please don't hesitate to contact us.</p>
      
      <p>Best regards,<br>
      The kWh Québec Team</p>
    </div>
    <div class="footer">
      <p>kWh Québec - Solar + Storage</p>
      <p>This email was sent automatically. Please do not reply directly.</p>
    </div>
  </div>
</body>
</html>`,
      textBody: `Hello ${contactName},

You now have access to the kWh Québec Client Portal for ${clientName}.

This portal allows you to view your solar analyses and project reports at any time.

Your login credentials:
- Email: ${email}
- Temporary Password: ${tempPassword}

Access the portal: ${portalUrl}

For security reasons, we recommend changing your password upon first login.

If you have any questions, please don't hesitate to contact us.

Best regards,
The kWh Québec Team`
    };
  }
}
