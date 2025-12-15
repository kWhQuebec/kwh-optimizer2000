import axios from "axios";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

const ZOHO_SIGN_BASE_URL = "https://sign.zoho.com/api/v1";
const ZOHO_ACCOUNTS_URL = "https://accounts.zoho.com";

interface ZohoTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

let tokenCache: ZohoTokens | null = null;

async function getAccessToken(): Promise<string> {
  const clientId = process.env.ZOHO_SIGN_CLIENT_ID;
  const clientSecret = process.env.ZOHO_SIGN_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_SIGN_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Zoho Sign credentials not configured. Please set ZOHO_SIGN_CLIENT_ID, ZOHO_SIGN_CLIENT_SECRET, and ZOHO_SIGN_REFRESH_TOKEN environment variables.");
  }

  if (tokenCache && Date.now() < tokenCache.expiresAt - 60000) {
    return tokenCache.accessToken;
  }

  try {
    const response = await axios.post(
      `${ZOHO_ACCOUNTS_URL}/oauth/v2/token`,
      new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    if (response.data.access_token) {
      tokenCache = {
        accessToken: response.data.access_token,
        refreshToken: refreshToken,
        expiresAt: Date.now() + (response.data.expires_in || 3600) * 1000,
      };
      return tokenCache.accessToken;
    }

    throw new Error(`Failed to refresh token: ${JSON.stringify(response.data)}`);
  } catch (error: any) {
    console.error("Error refreshing Zoho Sign token:", error.response?.data || error.message);
    throw new Error("Failed to authenticate with Zoho Sign");
  }
}

interface ProcurationData {
  signerName: string;
  signerEmail: string;
  companyName: string;
  hqAccountNumber?: string;
  language: "fr" | "en";
}

export async function generateProcurationPDF(data: ProcurationData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 50 });

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const isFrench = data.language === "fr";

    doc.fontSize(18).font("Helvetica-Bold");
    doc.text(isFrench ? "PROCURATION" : "AUTHORIZATION", { align: "center" });
    doc.moveDown();
    doc.text(isFrench ? "Autorisation d'accès aux données Hydro-Québec" : "Hydro-Québec Data Access Authorization", { align: "center" });
    doc.moveDown(2);

    doc.fontSize(11).font("Helvetica");
    
    const intro = isFrench
      ? `Je soussigné(e), ${data.signerName}, représentant(e) autorisé(e) de ${data.companyName}, autorise par la présente kWh Québec inc. à agir en mon nom et pour mon compte auprès d'Hydro-Québec afin d'obtenir les informations relatives à ma consommation électrique.`
      : `I, the undersigned, ${data.signerName}, authorized representative of ${data.companyName}, hereby authorize kWh Québec inc. to act on my behalf with Hydro-Québec to obtain information regarding my electrical consumption.`;
    
    doc.text(intro);
    doc.moveDown();

    doc.font("Helvetica-Bold").text(isFrench ? "Cette autorisation inclut:" : "This authorization includes:");
    doc.moveDown(0.5);
    doc.font("Helvetica");

    const items = isFrench
      ? [
          "Les données de consommation horaires (intervalles de 15 minutes ou horaires)",
          "L'historique de facturation des 24 derniers mois",
          "Les informations sur le contrat et tarif actuel",
          "Les données de puissance appelée",
        ]
      : [
          "Hourly consumption data (15-minute or hourly intervals)",
          "Billing history for the past 24 months",
          "Information on current contract and rate",
          "Demand power data",
        ];

    items.forEach((item) => {
      doc.text(`• ${item}`);
    });

    doc.moveDown();

    if (data.hqAccountNumber) {
      doc.font("Helvetica-Bold").text(isFrench ? "Numéro de compte Hydro-Québec:" : "Hydro-Québec Account Number:");
      doc.font("Helvetica").text(data.hqAccountNumber);
      doc.moveDown();
    }

    const validity = isFrench
      ? "Cette procuration est valide pour une durée de 12 mois à compter de la date de signature et peut être révoquée en tout temps par écrit."
      : "This authorization is valid for a period of 12 months from the date of signature and may be revoked at any time in writing.";
    
    doc.text(validity);
    doc.moveDown();

    const purpose = isFrench
      ? "Les données obtenues seront utilisées exclusivement pour l'analyse du potentiel solaire et le dimensionnement d'un système photovoltaïque pour le bâtiment du mandant."
      : "The data obtained will be used exclusively for analyzing solar potential and sizing a photovoltaic system for the principal's building.";
    
    doc.text(purpose);
    doc.moveDown(2);

    doc.font("Helvetica-Bold").text(isFrench ? "Entreprise:" : "Company:");
    doc.font("Helvetica").text(data.companyName);
    doc.moveDown();

    doc.font("Helvetica-Bold").text(isFrench ? "Nom du signataire:" : "Signer Name:");
    doc.font("Helvetica").text(data.signerName);
    doc.moveDown();

    doc.font("Helvetica-Bold").text(isFrench ? "Courriel:" : "Email:");
    doc.font("Helvetica").text(data.signerEmail);
    doc.moveDown(2);

    doc.font("Helvetica-Bold").text(isFrench ? "Signature:" : "Signature:");
    doc.moveDown(2);
    doc.text("_________________________________");
    doc.moveDown();

    doc.font("Helvetica-Bold").text("Date:");
    doc.moveDown(2);
    doc.text("_________________________________");
    doc.moveDown(3);

    doc.fontSize(9).font("Helvetica");
    doc.text(
      isFrench
        ? "kWh Québec inc. | 123 rue Exemple, Montréal QC | info@kwh.quebec"
        : "kWh Québec inc. | 123 Example St, Montreal QC | info@kwh.quebec",
      { align: "center" }
    );

    doc.end();
  });
}

interface SignatureRequest {
  signerName: string;
  signerEmail: string;
  companyName: string;
  hqAccountNumber?: string;
  language: "fr" | "en";
  callbackUrl?: string;
}

interface ZohoSignResponse {
  requestId: string;
  documentId: string;
  status: string;
}

export async function sendProcurationForSignature(data: SignatureRequest): Promise<ZohoSignResponse> {
  const accessToken = await getAccessToken();
  
  const pdfBuffer = await generateProcurationPDF({
    signerName: data.signerName,
    signerEmail: data.signerEmail,
    companyName: data.companyName,
    hqAccountNumber: data.hqAccountNumber,
    language: data.language,
  });

  const isFrench = data.language === "fr";
  
  const requestData = {
    requests: {
      request_name: isFrench
        ? `Procuration HQ - ${data.companyName}`
        : `HQ Authorization - ${data.companyName}`,
      actions: [
        {
          action_type: "SIGN",
          recipient_email: data.signerEmail,
          recipient_name: data.signerName,
          signing_order: 1,
          verify_recipient: false,
          language: isFrench ? "fr" : "en",
        },
      ],
      expiration_days: 30,
      email_reminders: true,
      reminder_period: 7,
      notes: isFrench
        ? "Veuillez signer cette procuration pour autoriser kWh Québec à accéder à vos données de consommation Hydro-Québec."
        : "Please sign this authorization to allow kWh Québec to access your Hydro-Québec consumption data.",
    },
  };

  const FormData = (await import("form-data")).default;
  const form = new FormData();
  form.append("data", JSON.stringify(requestData));
  form.append("file", pdfBuffer, {
    filename: `procuration_hq_${Date.now()}.pdf`,
    contentType: "application/pdf",
  });

  try {
    const response = await axios.post(`${ZOHO_SIGN_BASE_URL}/requests`, form, {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        ...form.getHeaders(),
      },
    });

    if (response.data.code !== 0) {
      throw new Error(`Zoho Sign error: ${response.data.message || "Unknown error"}`);
    }

    const request = response.data.requests;
    
    return {
      requestId: request.request_id,
      documentId: request.document_ids?.[0]?.document_id || "",
      status: request.request_status || "pending",
    };
  } catch (error: any) {
    console.error("Error sending document for signature:", error.response?.data || error.message);
    throw new Error(`Failed to send document for signature: ${error.message}`);
  }
}

export async function getSignatureStatus(requestId: string): Promise<{
  status: string;
  signedAt?: Date;
  viewedAt?: Date;
}> {
  const accessToken = await getAccessToken();

  try {
    const response = await axios.get(`${ZOHO_SIGN_BASE_URL}/requests/${requestId}`, {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
      },
    });

    if (response.data.code !== 0) {
      throw new Error(`Zoho Sign error: ${response.data.message}`);
    }

    const request = response.data.requests;
    const action = request.actions?.[0];

    return {
      status: request.request_status,
      signedAt: action?.signed_time ? new Date(action.signed_time) : undefined,
      viewedAt: action?.viewed_time ? new Date(action.viewed_time) : undefined,
    };
  } catch (error: any) {
    console.error("Error getting signature status:", error.response?.data || error.message);
    throw new Error(`Failed to get signature status: ${error.message}`);
  }
}

export async function downloadSignedDocument(requestId: string): Promise<Buffer> {
  const accessToken = await getAccessToken();

  try {
    const response = await axios.get(
      `${ZOHO_SIGN_BASE_URL}/requests/${requestId}/pdf`,
      {
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
        },
        responseType: "arraybuffer",
      }
    );

    return Buffer.from(response.data);
  } catch (error: any) {
    console.error("Error downloading signed document:", error.response?.data || error.message);
    throw new Error(`Failed to download signed document: ${error.message}`);
  }
}

export function isZohoSignConfigured(): boolean {
  return !!(
    process.env.ZOHO_SIGN_CLIENT_ID &&
    process.env.ZOHO_SIGN_CLIENT_SECRET &&
    process.env.ZOHO_SIGN_REFRESH_TOKEN
  );
}
