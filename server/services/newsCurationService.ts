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
  summaryFr: string;
  commentFr: string;
  socialPostFr: string;
  socialPostEn: string;
  tags: string[];
  category: string;
}

export async function analyzeArticleRelevance(article: RawNewsItem): Promise<ArticleAnalysis> {
  const prompt = `Tu es un expert en énergie solaire commerciale et industrielle au Québec, travaillant pour kWh Québec, une entreprise spécialisée dans l'installation de panneaux solaires pour les entreprises.

Analyse cet article de presse et évalue sa pertinence pour notre audience (propriétaires d'entreprises, gestionnaires immobiliers, directeurs d'usines au Québec).

ARTICLE:
Titre: ${article.title}
Source: ${article.sourceName}
Description: ${article.description}
Langue: ${article.language}
Date: ${article.pubDate?.toISOString() || "inconnue"}

CRITÈRES DE PERTINENCE (score 0-100):
- 80-100: Très pertinent — solaire commercial/industriel au Québec, programmes Hydro-Québec, stockage par batterie, tarifs d'électricité
- 50-79: Moyennement pertinent — énergie renouvelable au Canada, réglementations environnementales, coûts énergétiques
- 0-49: Peu pertinent — sujets généraux, résidentiel seulement, hors Québec/Canada

Réponds UNIQUEMENT en JSON valide avec cette structure exacte (pas de markdown, pas de backticks):
{
  "relevanceScore": <number 0-100>,
  "summaryFr": "<résumé en français, 2-3 phrases>",
  "commentFr": "<commentaire expert kWh Québec, 2-3 phrases, perspective d'affaires pour les entreprises québécoises>",
  "socialPostFr": "<post LinkedIn en français, max 200 caractères, avec hashtags>",
  "socialPostEn": "<LinkedIn post in English, max 200 chars, with hashtags>",
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
      summaryFr: String(result.summaryFr || ""),
      commentFr: String(result.commentFr || ""),
      socialPostFr: String(result.socialPostFr || "").substring(0, 300),
      socialPostEn: String(result.socialPostEn || "").substring(0, 300),
      tags: Array.isArray(result.tags) ? result.tags.map(String).slice(0, 10) : [],
      category: String(result.category || "marché"),
    };
  } catch (error) {
    log.error(`Failed to analyze article "${article.title}":`, error);
    return {
      relevanceScore: 50,
      summaryFr: article.description.substring(0, 200),
      commentFr: "",
      socialPostFr: "",
      socialPostEn: "",
      tags: [],
      category: "marché",
    };
  }
}
