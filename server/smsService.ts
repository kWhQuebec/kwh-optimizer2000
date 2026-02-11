import { createLogger } from "./lib/logger";

const log = createLogger("SMSService");

// Twilio types
interface TwilioClient {
  messages: {
    create: (params: {
      body: string;
      from: string;
      to: string;
    }) => Promise<{ sid: string; status: string }>;
  };
}

let twilioClient: TwilioClient | null = null;

/**
 * Initialize Twilio client if credentials are available
 */
function initializeTwilio(): TwilioClient | null {
  if (twilioClient) return twilioClient;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    log.debug("Twilio credentials not configured - SMS notifications will be logged only");
    return null;
  }

  try {
    // Dynamically import Twilio only if credentials are available
    const twilio = require("twilio");
    twilioClient = twilio(accountSid, authToken);
    log.info("Twilio client initialized successfully");
    return twilioClient;
  } catch (error) {
    log.error("Failed to initialize Twilio client:", error);
    return null;
  }
}

/**
 * Send SMS notification for hot leads
 * @param message The message to send
 * @returns true if sent successfully or logged, false if error
 */
export async function sendSMSNotification(message: string): Promise<boolean> {
  try {
    const toNumber = process.env.SMS_NOTIFY_TO;

    if (!toNumber) {
      log.info("SMS_NOTIFY_TO not configured - logging message instead:", message);
      return true;
    }

    const client = initializeTwilio();

    if (!client) {
      // Graceful degradation: log the message instead of sending
      log.info("SMS notification (would be sent if Twilio configured):", message);
      return true;
    }

    const fromNumber = process.env.TWILIO_FROM_NUMBER;
    if (!fromNumber) {
      log.warn("TWILIO_FROM_NUMBER not configured");
      return false;
    }

    const response = await client.messages.create({
      body: message,
      from: fromNumber,
      to: toNumber,
    });

    log.info("SMS sent successfully", {
      messageSid: response.sid,
      status: response.status,
    });

    return true;
  } catch (error) {
    log.error("Failed to send SMS notification:", error);
    // Return true to indicate graceful degradation - SMS failure shouldn't block lead processing
    return true;
  }
}

/**
 * Format hot lead notification message
 */
export function formatHotLeadMessage(
  companyName: string,
  address: string,
  monthlyBill: number,
  email: string
): string {
  return `🔥 Hot lead: ${companyName} - ${address} - $${monthlyBill}/month - ${email}`;
}
