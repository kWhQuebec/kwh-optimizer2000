import { ai } from "./replit_integrations/image/client";
import { createLogger } from "./lib/logger";

const log = createLogger("HQBillParser");

export interface HQConsumptionEntry {
  period: string;
  kWh: number | null;
  kW: number | null;
  amount: number | null;
  days: number | null;
}

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
  billNumber: string | null;
  hqAccountNumber: string | null;
  contractNumber: string | null;
  tariffDetail: string | null;
  consumptionHistory: HQConsumptionEntry[] | null;
}

const HQ_BILL_EXTRACTION_PROMPT = `Tu es un expert en extraction de données de factures Hydro-Québec. Analyse cette image de facture et extrait les informations suivantes en format JSON.

INSTRUCTIONS IMPORTANTES:

1. NUMÉRO DE CLIENT (clientNumber): Cherche "Numéro de client" ou "Client number" - c'est un numéro à 9 chiffres (format: XXX XXX XXX). NE PAS confondre avec le "Numéro de compte" (12 chiffres). Exemple: "108 304 154".

2. NOM LÉGAL DU CLIENT (clientName): Le nom du titulaire du compte tel qu'inscrit sur la facture, près de "Nom", "Titulaire", ou en haut.

3. ADRESSE DE SERVICE (serviceAddress): Cherche "Adresse de service" ou "Service address" (pas l'adresse de correspondance).

4. NUMÉRO DE FACTURE (billNumber): Cherche "Numéro de facture", "Facture no", "Invoice number" - c'est un long numéro (12+ chiffres).

5. NUMÉRO DE COMPTE (hqAccountNumber): Cherche "Numéro de compte" ou "Account number" - format typique: XXX XXX XXX XXX (12 chiffres). C'est DIFFÉRENT du numéro de client.

6. NUMÉRO DE CONTRAT (contractNumber): Cherche "Numéro de contrat", "Contrat", "Contract number".

7. CONSOMMATION ANNUELLE (annualConsumptionKwh):
   - Cherche "Consommation annuelle", "Annual consumption", ou le total kWh sur 12 mois
   - Si un graphique de 12 mois est visible, additionne les valeurs mensuelles
   - Si seulement une période est visible, extrait le kWh de cette période

8. PUISSANCE APPELÉE (peakDemandKw):
   - Cherche "Puissance appelée", "Demande de puissance", "Peak demand", ou valeurs en kW

9. TARIF DÉTAILLÉ (tariffDetail): Classification tarifaire COMPLÈTE:
   - Cherche "Tarif", "Rate" et note la classification exacte
   - "G" = Tarif général petit débit (< 65 kW)
   - "M" = Tarif moyen débit (65 kW - 5 MW)
   - Si un GDP (Garantie de puissance) est mentionné, indique "M avec GDP"
   - Autres: "G-9", "L", "LG", "BT", etc.
   - Retourne la classification exacte telle que sur la facture

10. TARIF CODE SIMPLE (tariffCode): Le code tarifaire simplifié (juste la lettre: D, G, M, L, etc.)

11. PÉRIODE DE FACTURATION (billingPeriod): Dates de début et fin.

12. MONTANT DE LA FACTURE (estimatedMonthlyBill): "Montant à payer", "Total", "Amount due" en dollars.

13. HISTORIQUE DE CONSOMMATION (consumptionHistory): Cherche le tableau "Historique de la consommation d'électricité" qui se trouve souvent à la dernière page de la facture. C'est un tableau avec les colonnes: période, kWh, kW (puissance), montant ($), nombre de jours. Extrait TOUTES les lignes du tableau, même les anciennes.

Réponds UNIQUEMENT avec un objet JSON valide (pas de texte avant ou après):
{
  "clientNumber": "Numéro de client 9 chiffres (ex: 108 304 154), string ou null",
  "clientName": "Nom légal du titulaire, string ou null",
  "serviceAddress": "Adresse de service, string ou null",
  "billNumber": "Numéro de facture, string ou null",
  "hqAccountNumber": "Numéro de compte 12 chiffres (ex: 299 095 411 722), string ou null",
  "contractNumber": "Numéro de contrat, string ou null",
  "annualConsumptionKwh": "number ou null",
  "peakDemandKw": "number ou null",
  "tariffCode": "Code simple (G, M, L, etc.), string ou null",
  "tariffDetail": "Classification complète (ex: M, M avec GDP, G-9, etc.), string ou null",
  "billingPeriod": "string ou null",
  "estimatedMonthlyBill": "number ou null",
  "consumptionHistory": [
    {"period": "2024-01 au 2024-02", "kWh": 12345, "kW": 67.8, "amount": 890.12, "days": 31}
  ],
  "confidence": "number entre 0 et 1"
}

Si tu ne peux pas lire la facture ou si l'image n'est pas une facture Hydro-Québec, retourne tous les champs à null avec confidence: 0.`;

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
    billNumber: null,
    hqAccountNumber: null,
    contractNumber: null,
    tariffDetail: null,
    consumptionHistory: null,
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

    const consumptionHistory: HQConsumptionEntry[] | null = Array.isArray(parsed.consumptionHistory)
      ? parsed.consumptionHistory.map((entry: Record<string, unknown>) => ({
          period: typeof entry.period === "string" ? entry.period : "",
          kWh: typeof entry.kWh === "number" ? entry.kWh : null,
          kW: typeof entry.kW === "number" ? entry.kW : null,
          amount: typeof entry.amount === "number" ? entry.amount : null,
          days: typeof entry.days === "number" ? entry.days : null,
        }))
      : null;

    const result: HQBillData = {
      accountNumber: typeof parsed.clientNumber === "string" ? parsed.clientNumber : (typeof parsed.accountNumber === "string" ? parsed.accountNumber : null),
      clientName: typeof parsed.clientName === "string" ? parsed.clientName : null,
      serviceAddress: typeof parsed.serviceAddress === "string" ? parsed.serviceAddress : null,
      annualConsumptionKwh: typeof parsed.annualConsumptionKwh === "number" ? parsed.annualConsumptionKwh : null,
      peakDemandKw: typeof parsed.peakDemandKw === "number" ? parsed.peakDemandKw : null,
      tariffCode: typeof parsed.tariffCode === "string" ? parsed.tariffCode : null,
      billingPeriod: typeof parsed.billingPeriod === "string" ? parsed.billingPeriod : null,
      estimatedMonthlyBill: typeof parsed.estimatedMonthlyBill === "number" ? parsed.estimatedMonthlyBill : null,
      confidence: typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5,
      rawExtraction: rawText,
      billNumber: typeof parsed.billNumber === "string" ? parsed.billNumber : null,
      hqAccountNumber: typeof parsed.hqAccountNumber === "string" ? parsed.hqAccountNumber : null,
      contractNumber: typeof parsed.contractNumber === "string" ? parsed.contractNumber : null,
      tariffDetail: typeof parsed.tariffDetail === "string" ? parsed.tariffDetail : null,
      consumptionHistory,
    };

    const fieldsFound = [
      result.accountNumber,
      result.clientName,
      result.serviceAddress,
      result.annualConsumptionKwh,
      result.tariffCode,
      result.estimatedMonthlyBill,
      result.billNumber,
      result.hqAccountNumber,
    ].filter(Boolean).length;

    if (fieldsFound < 2) {
      result.confidence = Math.min(result.confidence, 0.3);
    }

    log.info(`Extracted ${fieldsFound}/8 key fields, confidence: ${result.confidence}`);
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
