import type { Express, Response } from "express";
import { GoogleGenAI } from "@google/genai";
import { storage } from "./storage";
import type { AuthRequest } from "./routes";
import type { Site, Client, Opportunity } from "@shared/schema";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

interface ConversationMessage {
  role: "user" | "model";
  parts: { text: string }[];
}

interface DataContext {
  sites?: any[];
  clients?: any[];
  opportunities?: any[];
  siteDetails?: any;
  analysisResults?: any;
}

const SYSTEM_PROMPT_FR = `Tu es l'assistant IA de kWh Québec, une plateforme B2B de conception et d'analyse solaire pour les bâtiments commerciaux, industriels et institutionnels au Québec.

Ton rôle:
- Répondre aux questions sur la plateforme, les sites, les clients et les analyses
- Aider le personnel à comprendre les données solaires, financières et techniques
- Expliquer les calculs (NPV, TRI, période de retour, tarifs Hydro-Québec)
- Aider à naviguer les fonctionnalités de la plateforme
- Pour le personnel, tu peux suggérer des modifications aux données

Contexte technique:
- Tarif M d'Hydro-Québec: 6.061¢/kWh énergie + 17.573$/kW demande
- Tarif G: 8.654¢/kWh (premiers 15,236 kWh) puis 6.061¢/kWh
- Programme Autoproduction: max 1 MW, compensation surplus à 4.60¢/kWh après 24 mois
- Incitatif solaire HQ: 1000$/kW (max 40% CAPEX)
- Rendement solaire typique Québec: 1,150-1,300 kWh/kWp/an

Réponds toujours en français si l'utilisateur parle français, en anglais sinon.
Sois concis, professionnel et précis avec les données.`;

const SYSTEM_PROMPT_EN = `You are the AI assistant for kWh Québec, a B2B solar design and analysis platform for commercial, industrial and institutional buildings in Quebec.

Your role:
- Answer questions about the platform, sites, clients and analyses
- Help staff understand solar, financial and technical data
- Explain calculations (NPV, IRR, payback period, Hydro-Québec rates)
- Help navigate platform features
- For staff users, you can suggest data modifications

Technical context:
- Hydro-Québec Rate M: 6.061¢/kWh energy + $17.573/kW demand
- Rate G: 8.654¢/kWh (first 15,236 kWh) then 6.061¢/kWh
- Autoproduction program: max 1 MW, surplus compensation at 4.60¢/kWh after 24 months
- HQ Solar incentive: $1,000/kW (max 40% CAPEX)
- Typical Quebec solar yield: 1,150-1,300 kWh/kWp/year

Always respond in French if the user speaks French, English otherwise.
Be concise, professional and precise with data.`;

async function getDataContext(userId: string, userRole: string, query: string): Promise<DataContext> {
  const context: DataContext = {};
  const lowerQuery = query.toLowerCase();
  
  try {
    if (lowerQuery.includes("site") || lowerQuery.includes("bâtiment") || lowerQuery.includes("building")) {
      const sites = await storage.getSites();
      context.sites = sites.slice(0, 20).map((s: Site & { client: Client }) => ({
        id: s.id,
        name: s.name,
        address: s.address,
        buildingType: s.buildingType,
        roofAreaSqM: s.roofAreaSqM,
        clientId: s.clientId,
      }));
    }
    
    if (lowerQuery.includes("client") || lowerQuery.includes("entreprise") || lowerQuery.includes("company")) {
      const clients = await storage.getClients();
      context.clients = clients.slice(0, 20).map((c: Client & { sites: Site[] }) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        city: c.city,
      }));
    }
    
    if (lowerQuery.includes("opportunit") || lowerQuery.includes("pipeline") || lowerQuery.includes("vente") || lowerQuery.includes("sales")) {
      const opportunities = await storage.getOpportunities();
      context.opportunities = opportunities.slice(0, 15).map((o: Opportunity) => ({
        id: o.id,
        name: o.name,
        stage: o.stage,
        probability: o.probability,
        estimatedValue: o.estimatedValue,
        clientId: o.clientId,
      }));
    }
  } catch (error) {
    console.error("Error fetching context data:", error);
  }
  
  return context;
}

function buildPromptWithContext(userMessage: string, context: DataContext, language: string): string {
  let contextInfo = "";
  
  if (context.sites && context.sites.length > 0) {
    contextInfo += `\n\nSites disponibles (${context.sites.length}):\n`;
    context.sites.forEach((s: any) => {
      contextInfo += `- ${s.name} (${s.address || 'adresse non spécifiée'}), type: ${s.buildingType || 'N/A'}, toit: ${s.roofAreaSqM ? `${s.roofAreaSqM} m²` : 'N/A'}\n`;
    });
  }
  
  if (context.clients && context.clients.length > 0) {
    contextInfo += `\n\nClients (${context.clients.length}):\n`;
    context.clients.forEach(c => {
      contextInfo += `- ${c.name} (${c.email || 'email N/A'}, ${c.city || 'ville N/A'})\n`;
    });
  }
  
  if (context.opportunities && context.opportunities.length > 0) {
    contextInfo += `\n\nOpportunités (${context.opportunities.length}):\n`;
    context.opportunities.forEach(o => {
      contextInfo += `- ${o.name}: étape ${o.stage}, probabilité ${o.probability}%, valeur ${o.estimatedValue ? `$${o.estimatedValue.toLocaleString()}` : 'N/A'}\n`;
    });
  }
  
  const systemPrompt = language === 'fr' ? SYSTEM_PROMPT_FR : SYSTEM_PROMPT_EN;
  
  if (contextInfo) {
    return `${systemPrompt}\n\nDonnées de la plateforme:${contextInfo}\n\nQuestion de l'utilisateur: ${userMessage}`;
  }
  
  return `${systemPrompt}\n\nQuestion de l'utilisateur: ${userMessage}`;
}

export function registerAIAssistantRoutes(app: Express, authMiddleware: any, requireStaff: any): void {
  
  app.post("/api/ai-assistant/chat", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { message, conversationHistory = [], language = 'fr' } = req.body;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: "Message is required" });
      }
      
      const userId = req.userId!;
      const userRole = req.userRole || 'client';
      
      const context = await getDataContext(userId, userRole, message);
      
      const systemPrompt = buildPromptWithContext(message, context, language);
      
      const chatHistory: ConversationMessage[] = conversationHistory.map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      }));
      
      chatHistory.push({
        role: 'user',
        parts: [{ text: message }],
      });
      
      const fullHistory: ConversationMessage[] = [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: language === 'fr' ? 
          "Compris. Je suis prêt à vous aider avec la plateforme kWh Québec." : 
          "Understood. I'm ready to help you with the kWh Québec platform." 
        }] },
        ...chatHistory,
      ];
      
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      
      const stream = await ai.models.generateContentStream({
        model: "gemini-2.5-flash",
        contents: fullHistory,
      });
      
      let fullResponse = "";
      
      for await (const chunk of stream) {
        const content = chunk.text || "";
        if (content) {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }
      
      res.write(`data: ${JSON.stringify({ done: true, fullResponse })}\n\n`);
      res.end();
      
    } catch (error) {
      console.error("AI Assistant error:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "An error occurred" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to process request" });
      }
    }
  });
  
  app.post("/api/ai-assistant/update-field", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
    try {
      const { entityType, entityId, fieldName, newValue, confirmation } = req.body;
      
      if (!confirmation) {
        return res.status(400).json({ 
          requiresConfirmation: true,
          message: `Please confirm: Update ${fieldName} to "${newValue}" for ${entityType} ${entityId}?`
        });
      }
      
      const allowedUpdates: Record<string, string[]> = {
        site: ['name', 'address', 'notes', 'buildingType', 'roofAreaSqFt', 'structuralNotes'],
        client: ['name', 'email', 'phone', 'notes', 'address', 'city'],
        opportunity: ['name', 'stage', 'probability', 'estimatedValue', 'notes'],
      };
      
      if (!allowedUpdates[entityType]) {
        return res.status(400).json({ error: `Invalid entity type: ${entityType}` });
      }
      
      if (!allowedUpdates[entityType].includes(fieldName)) {
        return res.status(400).json({ error: `Field ${fieldName} cannot be updated for ${entityType}` });
      }
      
      let result;
      switch (entityType) {
        case 'site':
          result = await storage.updateSite(entityId, { [fieldName]: newValue });
          break;
        case 'client':
          result = await storage.updateClient(entityId, { [fieldName]: newValue });
          break;
        case 'opportunity':
          result = await storage.updateOpportunity(entityId, { [fieldName]: newValue });
          break;
        default:
          return res.status(400).json({ error: "Invalid entity type" });
      }
      
      if (!result) {
        return res.status(404).json({ error: `${entityType} not found` });
      }
      
      res.json({ 
        success: true, 
        message: `Updated ${fieldName} successfully`,
        entity: result 
      });
      
    } catch (error) {
      console.error("Update field error:", error);
      res.status(500).json({ error: "Failed to update field" });
    }
  });
  
  app.get("/api/ai-assistant/quick-stats", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const [sites, clients, opportunities] = await Promise.all([
        storage.getSites(),
        storage.getClients(),
        storage.getOpportunities(),
      ]);
      
      const activeOpportunities = opportunities.filter((o: Opportunity) => 
        !['closed_won', 'closed_lost', 'cancelled'].includes(o.stage || '')
      );
      
      const totalPipelineValue = activeOpportunities.reduce((sum: number, o: Opportunity) => 
        sum + (o.estimatedValue || 0), 0
      );
      
      res.json({
        totalSites: sites.length,
        totalClients: clients.length,
        activeOpportunities: activeOpportunities.length,
        totalPipelineValue,
      });
      
    } catch (error) {
      console.error("Quick stats error:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });
}
