import { Router } from "express";
import fs from "fs";
import path from "path";
import { authMiddleware, requireStaff, AuthRequest } from "../middleware/auth";
import { storage } from "../storage";
import { asyncHandler, NotFoundError, BadRequestError } from "../middleware/errorHandler";
import { createLogger } from "../lib/logger";

const log = createLogger("Admin");

const router = Router();

router.get("/api/admin/blog", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const articles = await storage.getBlogArticles();
  res.json(articles);
}));

router.post("/api/admin/blog", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const article = await storage.createBlogArticle(req.body);
  res.status(201).json(article);
}));

router.patch("/api/admin/blog/:id", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const article = await storage.updateBlogArticle(req.params.id, req.body);
  if (!article) {
    throw new NotFoundError("Article");
  }
  res.json(article);
}));

router.delete("/api/admin/blog/:id", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const deleted = await storage.deleteBlogArticle(req.params.id);
  if (!deleted) {
    throw new NotFoundError("Article");
  }
  res.json({ success: true });
}));

router.get("/api/admin/competitors", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const competitorsList = await storage.getCompetitors();
  res.json(competitorsList);
}));

router.get("/api/admin/competitors/:id", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const competitor = await storage.getCompetitor(req.params.id);
  if (!competitor) {
    throw new NotFoundError("Competitor");
  }
  res.json(competitor);
}));

router.post("/api/admin/competitors", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const competitor = await storage.createCompetitor(req.body);
  res.status(201).json(competitor);
}));

router.patch("/api/admin/competitors/:id", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const competitor = await storage.updateCompetitor(req.params.id, req.body);
  if (!competitor) {
    throw new NotFoundError("Competitor");
  }
  res.json(competitor);
}));

router.delete("/api/admin/competitors/:id", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const deleted = await storage.deleteCompetitor(req.params.id);
  if (!deleted) {
    throw new NotFoundError("Competitor");
  }
  res.json({ success: true });
}));

router.get("/api/admin/battle-cards", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const competitorId = req.query.competitorId as string | undefined;
  const cards = await storage.getBattleCards(competitorId);
  res.json(cards);
}));

router.get("/api/admin/battle-cards/:id", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const card = await storage.getBattleCard(req.params.id);
  if (!card) {
    throw new NotFoundError("Battle card");
  }
  res.json(card);
}));

router.post("/api/admin/battle-cards", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const card = await storage.createBattleCard(req.body);
  res.status(201).json(card);
}));

router.patch("/api/admin/battle-cards/:id", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const card = await storage.updateBattleCard(req.params.id, req.body);
  if (!card) {
    throw new NotFoundError("Battle card");
  }
  res.json(card);
}));

router.delete("/api/admin/battle-cards/:id", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const deleted = await storage.deleteBattleCard(req.params.id);
  if (!deleted) {
    throw new NotFoundError("Battle card");
  }
  res.json({ success: true });
}));

router.get("/api/admin/market-notes", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const category = req.query.category as string | undefined;
  const notes = await storage.getMarketNotes(category);
  res.json(notes);
}));

router.get("/api/admin/market-notes/:id", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const note = await storage.getMarketNote(req.params.id);
  if (!note) {
    throw new NotFoundError("Market note");
  }
  res.json(note);
}));

router.post("/api/admin/market-notes", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const note = await storage.createMarketNote(req.body);
  res.status(201).json(note);
}));

router.patch("/api/admin/market-notes/:id", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const note = await storage.updateMarketNote(req.params.id, req.body);
  if (!note) {
    throw new NotFoundError("Market note");
  }
  res.json(note);
}));

router.delete("/api/admin/market-notes/:id", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const deleted = await storage.deleteMarketNote(req.params.id);
  if (!deleted) {
    throw new NotFoundError("Market note");
  }
  res.json({ success: true });
}));

router.get("/api/admin/market-documents", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const entityType = req.query.entityType as string | undefined;
  const documents = await storage.getMarketDocuments(entityType);
  res.json(documents);
}));

router.get("/api/admin/market-documents/:id", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const document = await storage.getMarketDocument(req.params.id);
  if (!document) {
    throw new NotFoundError("Market document");
  }
  res.json(document);
}));

router.post("/api/admin/market-documents", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const document = await storage.createMarketDocument(req.body);
  res.status(201).json(document);
}));

router.patch("/api/admin/market-documents/:id", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const document = await storage.updateMarketDocument(req.params.id, req.body);
  if (!document) {
    throw new NotFoundError("Market document");
  }
  res.json(document);
}));

router.delete("/api/admin/market-documents/:id", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const deleted = await storage.deleteMarketDocument(req.params.id);
  if (!deleted) {
    throw new NotFoundError("Market document");
  }
  res.json({ success: true });
}));

router.get("/api/admin/procurations", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const signatures = await storage.getProcurationSignatures();
  res.json(signatures);
}));

router.get("/api/admin/procuration-pdfs", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const procurationDir = path.join(process.cwd(), "uploads", "procurations");

  if (!fs.existsSync(procurationDir)) {
    res.json([]);
    return;
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
}));

router.get("/api/admin/procuration-pdfs/:filename", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const { filename } = req.params;

  // FIX: Path traversal protection using allowlist pattern + path normalization
  const safeFilename = path.basename(filename);

  // Only allow procuration PDFs matching our expected pattern
  if (!/^procuration_[a-f0-9-]+_\d+\.pdf$/.test(safeFilename)) {
    throw new BadRequestError("Invalid filename format");
  }

  const baseDir = path.resolve(process.cwd(), "uploads", "procurations");
  const filePath = path.resolve(baseDir, safeFilename);

  // Double-check the resolved path is within the allowed directory
  if (!filePath.startsWith(baseDir + path.sep)) {
    throw new BadRequestError("Invalid file path");
  }

  if (!fs.existsSync(filePath)) {
    throw new NotFoundError("File");
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=${safeFilename}`);
  res.sendFile(filePath);
}));

router.post("/api/admin/seed-blog", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const seedArticles = [
    {
      slug: "incitatifs-solaires-quebec-2026",
      titleFr: "Guide complet des incitatifs solaires au Québec en 2026",
      titleEn: "Complete Guide to Solar Incentives in Quebec 2026",
      excerptFr: "Découvrez tous les programmes d'aide financière pour votre projet solaire commercial au Québec : subventions Hydro-Québec, crédits d'impôt fédéraux et plus encore.",
      excerptEn: "Discover all financial assistance programs for your commercial solar project in Quebec: Hydro-Québec subsidies, federal tax credits and more.",
      metaDescriptionFr: "Guide 2026 des incitatifs solaires au Québec : programme Autoproduction Hydro-Québec, amortissement accéléré CCA 43.2, crédits d'impôt et mesurage net.",
      metaDescriptionEn: "2026 guide to Quebec solar incentives: Hydro-Québec Autoproduction program, CCA Class 43.2 accelerated depreciation, tax credits and net metering.",
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
}));

// ==================== PUBLIC SITE CONTENT ====================
// These routes are public (no auth) for the landing page to fetch dynamic content

router.get("/api/site-content/:key", asyncHandler(async (req, res) => {
  const content = await storage.getSiteContentByKey(req.params.key);
  if (!content || !content.isActive) {
    return res.status(404).json({ error: "Content not found" });
  }
  res.json(content);
}));

router.get("/api/site-content", asyncHandler(async (req, res) => {
  const category = req.query.category as string | undefined;
  const content = category
    ? await storage.getSiteContentByCategory(category)
    : await storage.getSiteContentAll();
  // Only return active content
  res.json(content.filter(c => c.isActive));
}));

// ==================== SITE CONTENT (CMS) ====================

router.get("/api/admin/site-content", authMiddleware, requireStaff, asyncHandler(async (req, res) => {
  const category = req.query.category as string | undefined;
  const content = category
    ? await storage.getSiteContentByCategory(category)
    : await storage.getSiteContentAll();
  res.json(content);
}));

router.get("/api/admin/site-content/:id", authMiddleware, requireStaff, asyncHandler(async (req, res) => {
  const content = await storage.getSiteContent(req.params.id);
  if (!content) throw new NotFoundError("Content not found");
  res.json(content);
}));

router.post("/api/admin/site-content", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const content = await storage.createSiteContent({
    ...req.body,
    updatedBy: req.userId,
  });
  res.status(201).json(content);
}));

router.patch("/api/admin/site-content/:id", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const content = await storage.updateSiteContent(req.params.id, {
    ...req.body,
    updatedBy: req.userId,
    updatedAt: new Date(),
  });
  if (!content) throw new NotFoundError("Content not found");
  res.json(content);
}));

router.delete("/api/admin/site-content/:id", authMiddleware, requireStaff, asyncHandler(async (req, res) => {
  const result = await storage.deleteSiteContent(req.params.id);
  if (!result) throw new NotFoundError("Content not found");
  res.json({ success: true });
}));

export default router;
