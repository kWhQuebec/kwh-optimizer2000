import { Router, Response } from "express";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import { authMiddleware, requireStaff, AuthRequest } from "../middleware/auth";
import { storage } from "../storage";
import { Lead } from "@shared/schema";

const router = Router();

const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

router.post("/api/import/prospects/ai-parse", authMiddleware, requireStaff, uploadMemory.single("file"), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileName = req.file.originalname.toLowerCase();
    if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      return res.status(400).json({ 
        error: "Excel files not yet supported",
        details: "Please convert your Excel file to CSV format before uploading. In Excel, use File > Save As > CSV (Comma delimited)."
      });
    }

    const fileContent = req.file.buffer.toString("utf-8");
    
    const ai = new GoogleGenAI({
      apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
      httpOptions: {
        apiVersion: "",
        baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
      },
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [{ text: `You are a data extraction assistant. Parse this file content and extract prospect information.

For each row/entry, extract:
- companyName (required): Company or organization name
- contactName (required): Contact person name
- email (required): Email address
- phone: Phone number
- streetAddress: Street address
- city: City
- province: Province (default to "Québec" if not specified)
- postalCode: Postal code
- estimatedMonthlyBill: Estimated monthly electricity bill in $
- buildingType: Type of building (commercial, industrial, institutional, etc.)
- notes: Any additional notes

Return ONLY a valid JSON array of objects. Do not include any markdown formatting or explanation.
Example output format:
[{"companyName": "ABC Corp", "contactName": "John Doe", "email": "john@abc.com", ...}]

File content:
${fileContent}`
        }]
      }],
    });

    interface GeminiPart {
      text?: string;
      [key: string]: unknown;
    }
    
    interface ParsedProspect {
      companyName?: string;
      contactName?: string;
      email?: string;
      phone?: string;
      address?: string;
      city?: string;
      province?: string;
      postalCode?: string;
      buildingType?: string;
      notes?: string;
    }
    
    const candidate = response.candidates?.[0];
    const textPart = candidate?.content?.parts?.find((part: GeminiPart) => part.text);
    const responseText = textPart?.text || "";
    
    let prospects: ParsedProspect[];
    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        prospects = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON array found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", responseText);
      return res.status(422).json({ 
        error: "Failed to parse file content",
        details: "The AI could not extract structured data from the file. Please ensure the file contains prospect data in a recognizable format."
      });
    }

    const validProspects = prospects.filter((p) => 
      p.companyName && p.contactName && p.email
    );
    const invalidCount = prospects.length - validProspects.length;

    res.json({ 
      prospects: validProspects,
      count: validProspects.length,
      invalidCount,
      message: invalidCount > 0 
        ? `Successfully parsed ${validProspects.length} prospects (${invalidCount} entries skipped due to missing required fields)`
        : `Successfully parsed ${validProspects.length} prospects from the file`
    });
  } catch (error) {
    console.error("Error in AI batch import:", error);
    res.status(500).json({ error: "Failed to process file" });
  }
});

router.post("/api/import/prospects/batch", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const { prospects } = req.body;
    
    if (!Array.isArray(prospects) || prospects.length === 0) {
      return res.status(400).json({ error: "No prospects provided" });
    }

    const created: Lead[] = [];
    const errors: { index: number; error: string }[] = [];

    for (let i = 0; i < prospects.length; i++) {
      try {
        const prospect = prospects[i];
        if (!prospect.companyName || !prospect.contactName || !prospect.email) {
          errors.push({ index: i, error: "Missing required fields (companyName, contactName, email)" });
          continue;
        }

        const lead = await storage.createLead({
          companyName: prospect.companyName,
          contactName: prospect.contactName,
          email: prospect.email,
          phone: prospect.phone || null,
          streetAddress: prospect.streetAddress || null,
          city: prospect.city || null,
          province: prospect.province || "Québec",
          postalCode: prospect.postalCode || null,
          estimatedMonthlyBill: prospect.estimatedMonthlyBill ? parseFloat(prospect.estimatedMonthlyBill) : null,
          buildingType: prospect.buildingType || null,
          notes: prospect.notes || `Imported via batch import`,
        });
        created.push(lead);
      } catch (err) {
        errors.push({ index: i, error: err instanceof Error ? err.message : "Unknown error" });
      }
    }

    res.json({
      created: created.length,
      errors: errors.length,
      errorDetails: errors,
      leads: created
    });
  } catch (error) {
    console.error("Error in batch prospect creation:", error);
    res.status(500).json({ error: "Failed to create prospects" });
  }
});

router.post("/api/import/clients", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const { items } = req.body;
    
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "No items provided" });
    }

    // FIX: Fetch clients ONCE before the loop (N+1 query fix)
    const existingClients = await storage.getClients();
    const clientsByName = new Map<string, typeof existingClients[0] | null>(
      existingClients.map(c => [c.name.toLowerCase().trim(), c])
    );
    // Track names we've created in this batch to handle duplicates
    const createdNames = new Set<string>();

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: { index: number; error: string }[] = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const item = items[i];
        
        if (!item.name || typeof item.name !== 'string' || item.name.trim() === '') {
          errors.push({ index: i, error: "Missing required field: name" });
          continue;
        }

        const normalizedName = item.name.toLowerCase().trim();
        
        // Skip if we already created this name in this batch
        if (createdNames.has(normalizedName)) {
          skipped++;
          continue;
        }
        
        const existingClient = clientsByName.get(normalizedName);

        if (existingClient) {
          await storage.updateClient(existingClient.id, {
            mainContactName: item.contactName?.trim() || existingClient.mainContactName,
            email: item.email?.trim() || existingClient.email,
            phone: item.phone?.trim() || existingClient.phone,
            address: item.address?.trim() || existingClient.address,
            city: item.city?.trim() || existingClient.city,
            province: item.province?.trim() || existingClient.province,
            postalCode: item.postalCode?.trim() || existingClient.postalCode,
            notes: item.notes?.trim() || existingClient.notes,
          });
          updated++;
        } else {
          await storage.createClient({
            name: item.name.trim(),
            mainContactName: item.contactName?.trim() || null,
            email: item.email?.trim() || null,
            phone: item.phone?.trim() || null,
            address: item.address?.trim() || null,
            city: item.city?.trim() || null,
            province: item.province?.trim() || "Québec",
            postalCode: item.postalCode?.trim() || null,
            notes: item.notes?.trim() || null,
          });
          // Track that we've created this name in this batch
          createdNames.add(normalizedName);
          created++;
        }
      } catch (err) {
        errors.push({ index: i, error: err instanceof Error ? err.message : "Unknown error" });
      }
    }

    res.json({
      created,
      updated,
      skipped,
      errors: errors.length,
      errorDetails: errors,
    });
  } catch (error) {
    console.error("Error in batch client import:", error);
    res.status(500).json({ error: "Failed to import clients" });
  }
});

router.post("/api/import/catalog", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const { items } = req.body;
    
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "No items provided" });
    }

    // FIX: Fetch catalog ONCE before the loop (N+1 query fix)
    const existingCatalog = await storage.getCatalog();
    const catalogByKey = new Map(
      existingCatalog.map(c => [
        `${c.manufacturer.toLowerCase().trim()}|${c.model.toLowerCase().trim()}`,
        c
      ])
    );

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: { index: number; error: string }[] = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const item = items[i];
        
        if (!item.category || typeof item.category !== 'string' || item.category.trim() === '') {
          errors.push({ index: i, error: "Missing required field: category" });
          continue;
        }
        if (!item.manufacturer || typeof item.manufacturer !== 'string' || item.manufacturer.trim() === '') {
          errors.push({ index: i, error: "Missing required field: manufacturer" });
          continue;
        }
        if (!item.model || typeof item.model !== 'string' || item.model.trim() === '') {
          errors.push({ index: i, error: "Missing required field: model" });
          continue;
        }

        const key = `${item.manufacturer.toLowerCase().trim()}|${item.model.toLowerCase().trim()}`;
        const existingItem = catalogByKey.get(key);

        let specJson = item.specJson;
        if (typeof specJson === 'string' && specJson.trim()) {
          try {
            specJson = JSON.parse(specJson);
          } catch {
            specJson = null;
          }
        }

        const unitCost = item.unitCost ? parseFloat(String(item.unitCost)) : null;
        const active = item.active !== undefined ? Boolean(item.active) : true;

        if (existingItem) {
          await storage.updateCatalogItem(existingItem.id, {
            category: item.category.trim().toUpperCase(),
            specJson: specJson || existingItem.specJson,
            unitCost: unitCost !== null && !isNaN(unitCost) ? unitCost : existingItem.unitCost,
            active,
          });
          updated++;
        } else {
          const newItem = await storage.createCatalogItem({
            category: item.category.trim().toUpperCase(),
            manufacturer: item.manufacturer.trim(),
            model: item.model.trim(),
            specJson: specJson || null,
            unitCost: unitCost !== null && !isNaN(unitCost) ? unitCost : null,
            active,
          });
          // Add to map for subsequent iterations
          catalogByKey.set(key, newItem);
          created++;
        }
      } catch (err) {
        errors.push({ index: i, error: err instanceof Error ? err.message : "Unknown error" });
      }
    }

    res.json({
      created,
      updated,
      skipped,
      errors: errors.length,
      errorDetails: errors,
    });
  } catch (error) {
    console.error("Error in batch catalog import:", error);
    res.status(500).json({ error: "Failed to import catalog items" });
  }
});

export default router;
