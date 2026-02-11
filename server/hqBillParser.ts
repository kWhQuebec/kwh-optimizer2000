import { ai } from "./replit_integrations/image/client";
import { createLogger } from "./lib/logger";

const log = createLogger("HQBillParser");

export interface HQBillData {
  accountNumber: string | null;
  clientName: string | null;
  serviceAddress: string | null;
  annualConsumptionKwh: number | null;
  peakDemandKw: number | null;
  tariffCode: string | null;
  billingPeriod: string | null;
  estimatedMonthlyBill: number | null;
  confidence: number;
  rawExtraction: string;
}

const HQ_BILL_EXTRACTION_PROMPT = `Tu es un expert en extraction de données de factures Hydro-Québec. Analyse cette image de facture et extrait les informations suivantes en format JSON.

INSTRUCTIONS IMPORTANTES:
1. Cherche "Numéro de client" ou "Client number" - c'est un numéro à 9 chiffres (format: XXX XXX XXX), PAS le "Numéro de compte" qui a 12 chiffres. Le numéro de client est distinct du numéro de compte. Exemple: si tu vois "Numéro de client: 108 304 154", retourne "108 304 154".
2. Cherche le nom du titulaire du compte près de "Nom", "Titulaire", ou en haut de la facture
3. Cherche l'adresse de service (pas l'adresse de correspondance) - souvent sous "Adresse de service" ou "Service address"
4. Pour la consommation annuelle en kWh:
   - Cherche "Consommation annuelle", "Annual consumption", ou le total kWh sur 12 mois
   - Si un graphique de 12 mois est visible, additionne les valeurs mensuelles
   - Si seulement une période est visible, extrait le kWh de cette période
5. Pour la puissance appelée (kW):
   - Cherche "Puissance appelée", "Demande de puissance", "Peak demand", ou valeurs en kW
   - C'est le maximum de puissance instantanée utilisée
6. Pour le code tarifaire:
   - Cherche "Tarif", "Rate" - exemples: D, G, G-9, M, L, LG
   - G = Tarif général petit (< 65 kW)
   - M = Tarif moyen (65 kW - 5 MW)
   - L = Grand tarif (> 5 MW)
7. Pour la période de facturation:
   - Cherche les dates de début et fin de la période
   - Format attendu: "Du YYYY-MM-DD au YYYY-MM-DD" ou similaire
8. Pour le montant de la facture:
   - Cherche "Montant à payer", "Total", "Amount due"
   - C'est le montant total en dollars

Réponds UNIQUEMENT avec un objet JSON valide (pas de texte avant ou après):
{
  "accountNumber": "le Numéro de client (9 chiffres, ex: 108 304 154), PAS le Numéro de compte (12 chiffres). String ou null si non trouvé",
  "clientName": "string ou null si non trouvé",
  "serviceAddress": "string ou null si non trouvé",
  "annualConsumptionKwh": number ou null si non trouvé,
  "peakDemandKw": number ou null si non trouvé,
  "tariffCode": "string ou null si non trouvé",
  "billingPeriod": "string ou null si non trouvé",
  "estimatedMonthlyBill": number ou null si non trouvé,
  "confidence": number entre 0 et 1 indiquant ta confiance dans l'extraction
}

Si tu ne peux pas lire la facture ou si l'image n'est pas une facture HQ, retourne:
{
  "accountNumber": null,
  "clientName": null,
  "serviceAddress": null,
  "annualConsumptionKwh": null,
  "peakDemandKw": null,
  "tariffCode": null,
  "billingPeriod": null,
  "estimatedMonthlyBill": null,
  "confidence": 0
}`;

export async function parseHQBill(
  imageBase64: string,
  mimeType: string = "image/jpeg"
): Promise<HQBillData> {
  const defaultResult: HQBillData = {
    accountNumber: null,
    clientName: null,
    serviceAddress: null,
    annualConsumptionKwh: null,
    peakDemandKw: null,
    tariffCode: null,
    billingPeriod: null,
    estimatedMonthlyBill: null,
    confidence: 0,
    rawExtraction: "",
  };

  try {
    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "");

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: cleanBase64,
              },
            },
            {
              text: HQ_BILL_EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    });

    const candidate = response.candidates?.[0];
    const textPart = candidate?.content?.parts?.find(
      (part: { text?: string }) => part.text
    );

    if (!textPart?.text) {
      log.error("No text response from Gemini");
      return { ...defaultResult, rawExtraction: "No response from AI model" };
    }

    const rawText = textPart.text;
    log.info("Raw Gemini response:", rawText.substring(0, 500));

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      log.error("No JSON found in response");
      return { ...defaultResult, rawExtraction: rawText };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const result: HQBillData = {
      accountNumber: typeof parsed.accountNumber === "string" ? parsed.accountNumber : null,
      clientName: typeof parsed.clientName === "string" ? parsed.clientName : null,
      serviceAddress: typeof parsed.serviceAddress === "string" ? parsed.serviceAddress : null,
      annualConsumptionKwh: typeof parsed.annualConsumptionKwh === "number" ? parsed.annualConsumptionKwh : null,
      peakDemandKw: typeof parsed.peakDemandKw === "number" ? parsed.peakDemandKw : null,
      tariffCode: typeof parsed.tariffCode === "string" ? parsed.tariffCode : null,
      billingPeriod: typeof parsed.billingPeriod === "string" ? parsed.billingPeriod : null,
      estimatedMonthlyBill: typeof parsed.estimatedMonthlyBill === "number" ? parsed.estimatedMonthlyBill : null,
      confidence: typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5,
      rawExtraction: rawText,
    };

    const fieldsFound = [
      result.accountNumber,
      result.clientName,
      result.serviceAddress,
      result.annualConsumptionKwh,
      result.tariffCode,
      result.estimatedMonthlyBill,
    ].filter(Boolean).length;

    if (fieldsFound < 2) {
      result.confidence = Math.min(result.confidence, 0.3);
    }

    log.info(`Extracted ${fieldsFound}/6 key fields, confidence: ${result.confidence}`);
    return result;

  } catch (error) {
    log.error("Error parsing bill:", error);
    return {
      ...defaultResult,
      rawExtraction: `Error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function parseHQBillFromBuffer(
  buffer: Buffer,
  mimeType: string = "image/jpeg"
): Promise<HQBillData> {
  const base64 = buffer.toString("base64");
  return parseHQBill(base64, mimeType);
}
