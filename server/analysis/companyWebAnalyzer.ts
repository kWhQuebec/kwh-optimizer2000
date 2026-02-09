/**
 * Company Website Analyzer
 *
 * Fetches a company's website and uses Gemini AI to infer building characteristics
 * for pre-filling the synthetic profile questionnaire.
 */

import { ai } from "../replit_integrations/image/client";
import { createLogger } from "../lib/logger";

const log = createLogger("WebAnalyzer");

export interface WebAnalysisResult {
  buildingSubType: 'office' | 'warehouse' | 'retail' | 'industrial' | 'institutional';
  operatingSchedule: 'standard' | 'extended' | '24/7';
  sector: string;
  specialLoads: string[];
  confidence: number;
  reasoning: string;
}

/**
 * Strip HTML tags and extract visible text content, limited to maxChars.
 */
function extractVisibleText(html: string, maxChars: number = 5000): string {
  // Remove script and style blocks entirely
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  // Remove all remaining tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim();
  return text.slice(0, maxChars);
}

/**
 * Analyze a company website to infer building characteristics.
 * Returns suggestions for the synthetic profile questionnaire.
 */
export async function analyzeCompanyWebsite(url: string): Promise<WebAnalysisResult> {
  log.info(`Analyzing company website: ${url}`);

  // Fetch the page
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; KWhQuebec-Analyzer/1.0)',
      'Accept': 'text/html',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch website: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const visibleText = extractVisibleText(html);

  if (visibleText.length < 50) {
    throw new Error("Website content too short to analyze");
  }

  // Ask Gemini to analyze the content
  const geminiResponse = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{
      role: "user",
      parts: [{
        text: `Tu es un expert en efficacité énergétique au Québec. Analyse ce texte extrait du site web d'une entreprise et déduis les caractéristiques du bâtiment :

Texte du site web :
---
${visibleText}
---

Réponds UNIQUEMENT en JSON valide avec cette structure exacte :
{
  "buildingSubType": "office" | "warehouse" | "retail" | "industrial" | "institutional",
  "operatingSchedule": "standard" | "extended" | "24/7",
  "sector": "description courte du secteur d'activité",
  "specialLoads": ["charge spéciale 1", "charge spéciale 2"],
  "confidence": 0.0 à 1.0,
  "reasoning": "explication courte de ton raisonnement"
}

Types de bâtiment :
- office : bureaux, services professionnels, sièges sociaux
- warehouse : entreposage, logistique, distribution
- retail : commerce de détail, restauration, hôtellerie
- industrial : fabrication, usine, transformation
- institutional : école, hôpital, gouvernement, organisme

Charges spéciales possibles : réfrigération, chauffage électrique, climatisation lourde, compresseurs, fours, éclairage intensif, serveurs informatiques`,
      }],
    }],
  });

  const responseText = geminiResponse.text || '';

  // Extract JSON from response (may be wrapped in markdown code blocks)
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse AI response as JSON");
  }

  const parsed = JSON.parse(jsonMatch[0]) as WebAnalysisResult;

  // Validate the response has required fields
  const validTypes = ['office', 'warehouse', 'retail', 'industrial', 'institutional'];
  if (!validTypes.includes(parsed.buildingSubType)) {
    parsed.buildingSubType = 'office';
  }

  const validSchedules = ['standard', 'extended', '24/7'];
  if (!validSchedules.includes(parsed.operatingSchedule)) {
    parsed.operatingSchedule = 'standard';
  }

  parsed.confidence = Math.max(0, Math.min(1, parsed.confidence || 0.5));

  log.info(`Web analysis complete: ${parsed.buildingSubType} (${parsed.confidence * 100}% confidence)`);

  return parsed;
}
