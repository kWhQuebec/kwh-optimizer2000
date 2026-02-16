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
    {
      slug: "telecharger-donnees-espace-client-hydro-quebec",
      titleFr: "Comment télécharger vos données de consommation depuis l'Espace Client Hydro-Québec",
      titleEn: "How to Download Your Consumption Data from Hydro-Québec's Online Portal",
      excerptFr: "Vous préférez ne pas nous donner de procuration? Suivez notre guide étape par étape pour télécharger vous-même vos 12 à 24 fichiers CSV depuis votre Espace Client Hydro-Québec (~30 minutes).",
      excerptEn: "Prefer not to give us authorization? Follow our step-by-step guide to download your 12 to 24 CSV files from Hydro-Québec's Online Portal yourself (~30 minutes).",
      metaDescriptionFr: "Guide complet pour télécharger vos données de consommation depuis l'Espace Client Hydro-Québec. Alternative à la procuration pour votre analyse solaire.",
      metaDescriptionEn: "Complete guide to downloading your consumption data from Hydro-Québec's Online Portal. Alternative to authorization for your solar analysis.",
      keywords: ["espace client hydro-québec", "données de consommation", "fichiers CSV", "procuration", "téléchargement", "hydro quebec data download"],
      category: "guide",
      status: "published",
      publishedAt: new Date(),
      authorName: "kWh Québec",
      contentFr: `<h2>Deux options pour nous transmettre vos données</h2>
<p>Pour réaliser votre analyse détaillée gratuite, nous avons besoin de vos données de consommation détaillées (intervalles de 15 minutes). Vous avez deux options :</p>

<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 24px 0;">
<div style="padding: 20px; border: 2px solid #16A34A; border-radius: 8px;">
<h3 style="color: #16A34A;">Option A — Procuration (recommandée)</h3>
<ul>
<li><strong>Temps requis :</strong> 2 minutes (signature électronique)</li>
<li><strong>Délai d'analyse :</strong> 7 jours ouvrables</li>
<li>Nous nous occupons de tout</li>
<li>Accès direct aux données haute résolution</li>
</ul>
<p><a href="/analyse-detaillee">Signer ma procuration →</a></p>
</div>
<div style="padding: 20px; border: 2px solid #003DA6; border-radius: 8px;">
<h3 style="color: #003DA6;">Option B — Téléchargement autonome</h3>
<ul>
<li><strong>Temps requis :</strong> environ 30 minutes</li>
<li><strong>Délai d'analyse :</strong> 7 jours ouvrables (après réception)</li>
<li>12 à 24 fichiers CSV à télécharger individuellement</li>
<li>Idéal si vous préférez ne pas partager vos accès</li>
</ul>
</div>
</div>

<h2>Guide étape par étape — Téléchargement autonome</h2>
<p><strong>Important :</strong> Vous devrez télécharger un fichier CSV par période de facturation, soit 12 fichiers (facturation mensuelle) ou 24 fichiers (facturation aux 2 mois). Prévoyez environ 30 minutes.</p>

<h3>Étape 1 — Accéder à votre Espace Client</h3>
<ol>
<li>Rendez-vous sur <strong>espaceclient.hydroquebec.com</strong></li>
<li>Connectez-vous avec vos identifiants</li>
<li>Si vous n'avez pas de compte, vous devrez en créer un avec votre numéro de client Hydro-Québec (visible sur votre facture)</li>
</ol>

<h3>Étape 2 — Naviguer vers votre profil de consommation</h3>
<ol>
<li>Dans le menu principal, cliquez sur <strong>« Consommation »</strong></li>
<li>Sélectionnez <strong>« Portrait de ma consommation »</strong> ou <strong>« Profil de consommation »</strong></li>
<li>Si vous avez plusieurs compteurs, assurez-vous de sélectionner le bon</li>
</ol>

<h3>Étape 3 — Télécharger chaque période</h3>
<ol>
<li>Sélectionnez la période de facturation souhaitée (commencez par la plus ancienne disponible)</li>
<li>Choisissez l'affichage en <strong>intervalles de 15 minutes</strong> si disponible, sinon en intervalles horaires</li>
<li>Cliquez sur le bouton <strong>« Télécharger »</strong> ou <strong>« Exporter en CSV »</strong></li>
<li>Enregistrez le fichier sur votre ordinateur</li>
<li><strong>Répétez pour chaque période de facturation</strong> — idéalement les 12 à 24 derniers mois</li>
</ol>

<h3>Étape 4 — Nous transmettre vos fichiers</h3>
<ol>
<li>Regroupez tous vos fichiers CSV dans un seul dossier</li>
<li>Envoyez-les à <strong>info@kwh.quebec</strong> ou utilisez notre formulaire d'analyse détaillée</li>
<li>Indiquez le nom de votre entreprise et l'adresse du bâtiment</li>
</ol>

<h2>Pourquoi recommandons-nous la procuration?</h2>
<p>La procuration reste notre recommandation, car elle :</p>
<ul>
<li>Vous fait gagner environ 30 minutes de manipulations</li>
<li>Nous donne accès aux données les plus précises (intervalles de 15 minutes)</li>
<li>Élimine les risques d'erreur de téléchargement ou de fichiers manquants</li>
<li>Est valide pour une durée limitée (15 jours ouvrables) et peut être révoquée en tout temps</li>
</ul>
<p>Quelle que soit l'option choisie, votre analyse détaillée sera livrée sous <strong>7 jours ouvrables</strong> après réception des données.</p>`,
      contentEn: `<h2>Two Options to Share Your Data</h2>
<p>To complete your free detailed analysis, we need your detailed consumption data (15-minute intervals). You have two options:</p>

<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 24px 0;">
<div style="padding: 20px; border: 2px solid #16A34A; border-radius: 8px;">
<h3 style="color: #16A34A;">Option A — Authorization (recommended)</h3>
<ul>
<li><strong>Time required:</strong> 2 minutes (electronic signature)</li>
<li><strong>Analysis delivery:</strong> 7 business days</li>
<li>We take care of everything</li>
<li>Direct access to high-resolution data</li>
</ul>
<p><a href="/analyse-detaillee">Sign my authorization →</a></p>
</div>
<div style="padding: 20px; border: 2px solid #003DA6; border-radius: 8px;">
<h3 style="color: #003DA6;">Option B — Self-service download</h3>
<ul>
<li><strong>Time required:</strong> approximately 30 minutes</li>
<li><strong>Analysis delivery:</strong> 7 business days (after receipt)</li>
<li>12 to 24 CSV files to download individually</li>
<li>Ideal if you prefer not to share your access</li>
</ul>
</div>
</div>

<h2>Step-by-Step Guide — Self-Service Download</h2>
<p><strong>Important:</strong> You will need to download one CSV file per billing period, either 12 files (monthly billing) or 24 files (bi-monthly billing). Allow approximately 30 minutes.</p>

<h3>Step 1 — Access Your Online Portal</h3>
<ol>
<li>Go to <strong>espaceclient.hydroquebec.com</strong></li>
<li>Log in with your credentials</li>
<li>If you don't have an account, you'll need to create one using your Hydro-Québec customer number (found on your bill)</li>
</ol>

<h3>Step 2 — Navigate to Your Consumption Profile</h3>
<ol>
<li>In the main menu, click on <strong>"Consumption"</strong></li>
<li>Select <strong>"Consumption Portrait"</strong> or <strong>"Consumption Profile"</strong></li>
<li>If you have multiple meters, make sure to select the correct one</li>
</ol>

<h3>Step 3 — Download Each Period</h3>
<ol>
<li>Select the desired billing period (start with the oldest available)</li>
<li>Choose the <strong>15-minute interval</strong> display if available, otherwise hourly intervals</li>
<li>Click the <strong>"Download"</strong> or <strong>"Export to CSV"</strong> button</li>
<li>Save the file to your computer</li>
<li><strong>Repeat for each billing period</strong> — ideally the last 12 to 24 months</li>
</ol>

<h3>Step 4 — Send Us Your Files</h3>
<ol>
<li>Group all your CSV files in a single folder</li>
<li>Send them to <strong>info@kwh.quebec</strong> or use our detailed analysis form</li>
<li>Include your company name and building address</li>
</ol>

<h2>Why Do We Recommend Authorization?</h2>
<p>Authorization remains our recommendation because it:</p>
<ul>
<li>Saves you approximately 30 minutes of work</li>
<li>Gives us access to the most accurate data (15-minute intervals)</li>
<li>Eliminates the risk of download errors or missing files</li>
<li>Is valid for a limited time (15 business days) and can be revoked at any time</li>
</ul>
<p>Regardless of which option you choose, your detailed analysis will be delivered within <strong>7 business days</strong> after data receipt.</p>`,
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
