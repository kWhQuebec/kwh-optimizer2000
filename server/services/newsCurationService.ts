import { GoogleGenAI } from "@google/genai";
import { createLogger } from "../lib/logger";
import type { RawNewsItem } from "./newsRssService";

const log = createLogger("NewsCuration");

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

export interface ArticleAnalysis {
  relevanceScore: number;
  titleFr: string;
  summaryFr: string;
  commentFr: string;
  socialPostFr: string;
  socialPostEn: string;
  tags: string[];
  category: string;
}

export const AUTO_REJECT_THRESHOLD = 65;

export async function analyzeArticleRelevance(article: RawNewsItem): Promise<ArticleAnalysis> {
  const prompt = `Tu es un expert en énergie solaire commerciale et industrielle au Québec, travaillant pour kWh Québec, une entreprise spécialisée dans l'installation de panneaux solaires pour les entreprises C&I (commercial, industriel, institutionnel).

Analyse cet article de presse et évalue sa pertinence STRICTEMENT pour notre audience cible: propriétaires d'entreprises, gestionnaires immobiliers commerciaux et directeurs d'usines au QUÉBEC qui envisagent le solaire ou le stockage d'énergie.

ARTICLE:
Titre: ${article.title}
Source: ${article.sourceName}
Description: ${article.description}
Langue: ${article.language}
Date: ${article.pubDate?.toISOString() || "inconnue"}

CRITÈRES DE PERTINENCE (score 0-100) — sois STRICT:
- 80-100: Directement pertinent — solaire C&I au Québec, programmes Hydro-Québec (Solutions efficaces, autoproduction, mesurage net), stockage par batterie pour écrêtement de pointe, tarifs M/G, réglementation énergétique québécoise
- 65-79: Pertinent — politiques énergétiques canadiennes affectant le C&I québécois, coûts énergétiques industriels, efficacité énergétique des bâtiments commerciaux au Canada, ITC fédéral, technologies solaires/stockage C&I
- 0-64: PEU PERTINENT — à rejeter automatiquement. Ceci inclut:
  * Solaire résidentiel ou "plug & play" pour particuliers
  * Marchés européens, américains ou asiatiques sans impact direct au Québec
  * Nouvelles climatiques générales sans lien avec l'énergie C&I
  * Véhicules électriques (sauf bornes de recharge en contexte C&I)
  * Articles sur des entreprises hors Québec/Canada sans pertinence locale
  * Batteries/stockage pour usage domestique
  * Actualités politiques générales sans lien direct avec l'énergie

Réponds UNIQUEMENT en JSON valide avec cette structure exacte (pas de markdown, pas de backticks):
{
  "relevanceScore": <number 0-100>,
  "titleFr": "<titre traduit en français, court et accrocheur, max 100 caractères>",
  "summaryFr": "<résumé en français, 2-3 phrases, focalisé sur l'impact pour les entreprises québécoises>",
  "commentFr": "<commentaire expert kWh Québec, 2-3 phrases, perspective d'affaires concrète pour le C&I québécois>",
  "socialPostFr": "<post LinkedIn en français, max 200 caractères, avec hashtags #SolaireQuébec #ÉnergieCI>",
  "socialPostEn": "<LinkedIn post in English, max 200 chars, with hashtags #SolarQuebec #CISolar>",
  "tags": ["<tag1>", "<tag2>", "<tag3>"],
  "category": "<une seule catégorie parmi: politique, technologie, financement, marché, réglementation>"
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const text = response.text || "";
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const result = JSON.parse(cleaned);

    return {
      relevanceScore: Math.max(0, Math.min(100, Number(result.relevanceScore) || 0)),
      titleFr: String(result.titleFr || ""),
      summaryFr: String(result.summaryFr || ""),
      commentFr: String(result.commentFr || ""),
      socialPostFr: String(result.socialPostFr || "").substring(0, 300),
      socialPostEn: String(result.socialPostEn || "").substring(0, 300),
      tags: Array.isArray(result.tags) ? result.tags.map(String).slice(0, 10) : [],
      category: String(result.category || "marché"),
    };
  } catch (error) {
    log.error(`Failed to analyze article "${article.title}":`, error);
    throw error;
  }
}
