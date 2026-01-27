import { Router, Response } from "express";
import fs from "fs";
import path from "path";
import { authMiddleware, requireStaff, AuthRequest } from "../middleware/auth";
import { storage } from "../storage";

const router = Router();

router.get("/api/admin/blog", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
  try {
    const articles = await storage.getBlogArticles();
    res.json(articles);
  } catch (error) {
    console.error("Error fetching blog articles:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/admin/blog", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
  try {
    const article = await storage.createBlogArticle(req.body);
    res.status(201).json(article);
  } catch (error) {
    console.error("Error creating blog article:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/api/admin/blog/:id", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
  try {
    const article = await storage.updateBlogArticle(req.params.id, req.body);
    if (!article) {
      return res.status(404).json({ error: "Article not found" });
    }
    res.json(article);
  } catch (error) {
    console.error("Error updating blog article:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/api/admin/blog/:id", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
  try {
    const deleted = await storage.deleteBlogArticle(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Article not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting blog article:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/admin/competitors", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
  try {
    const competitorsList = await storage.getCompetitors();
    res.json(competitorsList);
  } catch (error) {
    console.error("Error fetching competitors:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/admin/competitors/:id", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
  try {
    const competitor = await storage.getCompetitor(req.params.id);
    if (!competitor) {
      return res.status(404).json({ error: "Competitor not found" });
    }
    res.json(competitor);
  } catch (error) {
    console.error("Error fetching competitor:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/admin/competitors", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
  try {
    const competitor = await storage.createCompetitor(req.body);
    res.status(201).json(competitor);
  } catch (error) {
    console.error("Error creating competitor:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/api/admin/competitors/:id", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
  try {
    const competitor = await storage.updateCompetitor(req.params.id, req.body);
    if (!competitor) {
      return res.status(404).json({ error: "Competitor not found" });
    }
    res.json(competitor);
  } catch (error) {
    console.error("Error updating competitor:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/api/admin/competitors/:id", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
  try {
    const deleted = await storage.deleteCompetitor(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Competitor not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting competitor:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/admin/battle-cards", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
  try {
    const competitorId = req.query.competitorId as string | undefined;
    const cards = await storage.getBattleCards(competitorId);
    res.json(cards);
  } catch (error) {
    console.error("Error fetching battle cards:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/admin/battle-cards/:id", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
  try {
    const card = await storage.getBattleCard(req.params.id);
    if (!card) {
      return res.status(404).json({ error: "Battle card not found" });
    }
    res.json(card);
  } catch (error) {
    console.error("Error fetching battle card:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/admin/battle-cards", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
  try {
    const card = await storage.createBattleCard(req.body);
    res.status(201).json(card);
  } catch (error) {
    console.error("Error creating battle card:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/api/admin/battle-cards/:id", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
  try {
    const card = await storage.updateBattleCard(req.params.id, req.body);
    if (!card) {
      return res.status(404).json({ error: "Battle card not found" });
    }
    res.json(card);
  } catch (error) {
    console.error("Error updating battle card:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/api/admin/battle-cards/:id", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
  try {
    const deleted = await storage.deleteBattleCard(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Battle card not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting battle card:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/admin/market-notes", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
  try {
    const category = req.query.category as string | undefined;
    const notes = await storage.getMarketNotes(category);
    res.json(notes);
  } catch (error) {
    console.error("Error fetching market notes:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/admin/market-notes/:id", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
  try {
    const note = await storage.getMarketNote(req.params.id);
    if (!note) {
      return res.status(404).json({ error: "Market note not found" });
    }
    res.json(note);
  } catch (error) {
    console.error("Error fetching market note:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/admin/market-notes", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
  try {
    const note = await storage.createMarketNote(req.body);
    res.status(201).json(note);
  } catch (error) {
    console.error("Error creating market note:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/api/admin/market-notes/:id", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
  try {
    const note = await storage.updateMarketNote(req.params.id, req.body);
    if (!note) {
      return res.status(404).json({ error: "Market note not found" });
    }
    res.json(note);
  } catch (error) {
    console.error("Error updating market note:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/api/admin/market-notes/:id", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
  try {
    const deleted = await storage.deleteMarketNote(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Market note not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting market note:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/admin/market-documents", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
  try {
    const entityType = req.query.entityType as string | undefined;
    const documents = await storage.getMarketDocuments(entityType);
    res.json(documents);
  } catch (error) {
    console.error("Error fetching market documents:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/admin/market-documents/:id", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
  try {
    const document = await storage.getMarketDocument(req.params.id);
    if (!document) {
      return res.status(404).json({ error: "Market document not found" });
    }
    res.json(document);
  } catch (error) {
    console.error("Error fetching market document:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/admin/market-documents", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
  try {
    const document = await storage.createMarketDocument(req.body);
    res.status(201).json(document);
  } catch (error) {
    console.error("Error creating market document:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/api/admin/market-documents/:id", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
  try {
    const document = await storage.updateMarketDocument(req.params.id, req.body);
    if (!document) {
      return res.status(404).json({ error: "Market document not found" });
    }
    res.json(document);
  } catch (error) {
    console.error("Error updating market document:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/api/admin/market-documents/:id", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
  try {
    const deleted = await storage.deleteMarketDocument(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Market document not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting market document:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/admin/procurations", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
  try {
    const signatures = await storage.getProcurationSignatures();
    res.json(signatures);
  } catch (error) {
    console.error("Error fetching procuration signatures:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/admin/procuration-pdfs", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
  try {
    const procurationDir = path.join(process.cwd(), "uploads", "procurations");
    
    if (!fs.existsSync(procurationDir)) {
      return res.json([]);
    }
    
    const files = fs.readdirSync(procurationDir)
      .filter(f => f.endsWith('.pdf'))
      .map(filename => {
        const filePath = path.join(procurationDir, filename);
        const stats = fs.statSync(filePath);
        const match = filename.match(/^procuration_([a-f0-9-]+)_(\d+)\.pdf$/);
        return {
          filename,
          leadId: match ? match[1] : null,
          createdAt: stats.mtime.toISOString(),
          size: stats.size,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    res.json(files);
  } catch (error) {
    console.error("Error listing procuration PDFs:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/admin/procuration-pdfs/:filename", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
  try {
    const { filename } = req.params;
    
    // FIX: Path traversal protection using allowlist pattern + path normalization
    const safeFilename = path.basename(filename);
    
    // Only allow procuration PDFs matching our expected pattern
    if (!/^procuration_[a-f0-9-]+_\d+\.pdf$/.test(safeFilename)) {
      return res.status(400).json({ error: "Invalid filename format" });
    }
    
    const baseDir = path.resolve(process.cwd(), "uploads", "procurations");
    const filePath = path.resolve(baseDir, safeFilename);
    
    // Double-check the resolved path is within the allowed directory
    if (!filePath.startsWith(baseDir + path.sep)) {
      return res.status(400).json({ error: "Invalid file path" });
    }
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }
    
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${safeFilename}`);
    res.sendFile(filePath);
  } catch (error) {
    console.error("Error downloading procuration PDF:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/admin/seed-blog", authMiddleware, requireStaff, async (req: AuthRequest, res: Response) => {
  try {
    const seedArticles = [
      {
        slug: "incitatifs-solaires-quebec-2025",
        titleFr: "Guide complet des incitatifs solaires au Québec en 2025",
        titleEn: "Complete Guide to Solar Incentives in Quebec 2025",
        excerptFr: "Découvrez tous les programmes d'aide financière pour votre projet solaire commercial au Québec : subventions Hydro-Québec, crédits d'impôt fédéraux et plus encore.",
        excerptEn: "Discover all financial assistance programs for your commercial solar project in Quebec: Hydro-Québec subsidies, federal tax credits and more.",
        metaDescriptionFr: "Guide 2025 des incitatifs solaires au Québec : programme Autoproduction Hydro-Québec, amortissement accéléré CCA 43.2, crédits d'impôt et mesurage net.",
        metaDescriptionEn: "2025 guide to Quebec solar incentives: Hydro-Québec Autoproduction program, CCA Class 43.2 accelerated depreciation, tax credits and net metering.",
        keywords: ["incitatifs solaires québec", "subvention hydro-québec", "autoproduction", "CCA 43.2", "mesurage net", "crédit d'impôt solaire", "solar incentives quebec"],
        category: "program",
        status: "published",
        publishedAt: new Date(),
        authorName: "kWh Québec",
        contentFr: "<h2>Les incitatifs solaires au Québec</h2><p>Guide des programmes disponibles pour les entreprises québécoises.</p>",
        contentEn: "<h2>Solar Incentives in Quebec</h2><p>Guide to available programs for Quebec businesses.</p>",
      },
      {
        slug: "solaire-commercial-vs-residentiel",
        titleFr: "Solaire commercial vs résidentiel : 7 différences clés à connaître",
        titleEn: "Commercial vs Residential Solar: 7 Key Differences You Need to Know",
        excerptFr: "Pourquoi un projet solaire commercial n'a rien à voir avec une installation résidentielle? Découvrez les différences cruciales.",
        excerptEn: "Why is a commercial solar project completely different from a residential installation? Discover the crucial differences.",
        metaDescriptionFr: "Comparez le solaire commercial et résidentiel : tarifs G vs M, ROI, licence RBQ, complexité technique.",
        metaDescriptionEn: "Compare commercial and residential solar: G vs M tariffs, ROI, RBQ license, technical complexity.",
        keywords: ["solaire commercial", "solaire résidentiel", "tarif G", "tarif M", "licence RBQ", "rentabilité solaire", "commercial solar quebec"],
        category: "guide",
        status: "published",
        publishedAt: new Date(),
        authorName: "kWh Québec",
        contentFr: "<h2>Solaire commercial vs résidentiel</h2><p>Les différences essentielles à connaître.</p>",
        contentEn: "<h2>Commercial vs Residential Solar</h2><p>Essential differences to know.</p>",
      },
      {
        slug: "comprendre-facture-hydro-quebec",
        titleFr: "Comment lire votre facture Hydro-Québec commerciale : guide complet",
        titleEn: "How to Read Your Commercial Hydro-Québec Bill: Complete Guide",
        excerptFr: "Frais de puissance, tarif G vs M, facteur de puissance... Apprenez à décoder chaque ligne de votre facture d'électricité commerciale.",
        excerptEn: "Power charges, G vs M rates, power factor... Learn to decode every line of your commercial electricity bill.",
        metaDescriptionFr: "Guide pour comprendre votre facture Hydro-Québec commerciale : tarifs G et M, frais de puissance, facteur de puissance.",
        metaDescriptionEn: "Guide to understanding your commercial Hydro-Québec bill: G and M rates, power charges, power factor.",
        keywords: ["facture hydro-québec", "tarif G", "tarif M", "frais de puissance", "facteur de puissance", "electricity bill quebec"],
        category: "guide",
        status: "published",
        publishedAt: new Date(),
        authorName: "kWh Québec",
        contentFr: "<h2>Décoder votre facture Hydro-Québec</h2><p>Le guide du gestionnaire.</p>",
        contentEn: "<h2>Decoding Your Hydro-Québec Bill</h2><p>The manager's guide.</p>",
      },
      {
        slug: "etude-de-cas-projet-solaire-industriel",
        titleFr: "Étude de cas : Installation solaire de 500 kW dans un entrepôt industriel",
        titleEn: "Case Study: 500 kW Solar Installation in an Industrial Warehouse",
        excerptFr: "Analyse complète d'un projet solaire industriel au Québec : conception, financement, incitatifs et résultats financiers.",
        excerptEn: "Complete analysis of an industrial solar project in Quebec: design, financing, incentives and financial results.",
        metaDescriptionFr: "Étude de cas d'un projet solaire 500 kW au Québec : NPV, TRI, retour sur investissement.",
        metaDescriptionEn: "Case study of a 500 kW solar project in Quebec: NPV, IRR, payback.",
        keywords: ["étude de cas solaire", "projet industriel", "500 kW", "NPV", "IRR", "solar case study quebec"],
        category: "case-study",
        status: "published",
        publishedAt: new Date(),
        authorName: "kWh Québec",
        contentFr: "<h2>Étude de cas : Entrepôt industriel</h2><p>Résultats d'un projet de 500 kW.</p>",
        contentEn: "<h2>Case Study: Industrial Warehouse</h2><p>Results from a 500 kW project.</p>",
      },
    ];

    const createdArticles = [];
    for (const article of seedArticles) {
      const existing = await storage.getBlogArticleBySlug(article.slug);
      if (!existing) {
        const created = await storage.createBlogArticle(article);
        createdArticles.push(created);
      }
    }

    res.json({ 
      success: true, 
      created: createdArticles.length,
      skipped: seedArticles.length - createdArticles.length,
      articles: createdArticles 
    });
  } catch (error) {
    console.error("Error seeding blog articles:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
