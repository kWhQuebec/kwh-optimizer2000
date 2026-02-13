import { Router } from "express";
import { storage } from "../storage";
import { createLogger } from "../lib/logger";
import { asyncHandler, BadRequestError, NotFoundError } from "../middleware/errorHandler";
import { publicApiLimiter } from "../middleware/rateLimiter";

const log = createLogger("Public");
const router = Router();

router.use(publicApiLimiter);

router.get("/api/public/agreements/:token", asyncHandler(async (req, res) => {
  const { token } = req.params;

  const agreements = await storage.getDesignAgreements();
  const agreement = agreements.find(a => a.publicToken === token);

  if (!agreement) {
    throw new NotFoundError("Agreement");
  }

  const site = await storage.getSite(agreement.siteId);
  if (!site) {
    throw new NotFoundError("Site");
  }

  const client = await storage.getClient(site.clientId);
  if (!client) {
    throw new NotFoundError("Client");
  }

  res.json({
    id: agreement.id,
    status: agreement.status,
    validUntil: agreement.validUntil,
    quotedCosts: agreement.quotedCosts,
    totalCad: agreement.totalCad,
    paymentTerms: agreement.paymentTerms,
    acceptedAt: agreement.acceptedAt,
    acceptedByName: agreement.acceptedByName,
    site: {
      name: site.name,
      address: site.address,
      city: site.city,
      province: site.province,
    },
    client: {
      name: client.name,
      email: client.email,
    },
  });
}));

router.post("/api/public/agreements/:token/sign", asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { name, email, signatureData } = req.body;

  if (!name || !email || !signatureData) {
    throw new BadRequestError("Name, email, and signature are required");
  }

  const agreements = await storage.getDesignAgreements();
  const agreement = agreements.find(a => a.publicToken === token);

  if (!agreement) {
    throw new NotFoundError("Agreement");
  }

  if (agreement.status === "accepted") {
    throw new BadRequestError("Agreement already signed");
  }

  if (agreement.validUntil && new Date(agreement.validUntil) < new Date()) {
    throw new BadRequestError("Agreement has expired");
  }

  const updated = await storage.updateDesignAgreement(agreement.id, {
    status: "accepted",
    acceptedAt: new Date(),
    acceptedByName: name,
    acceptedByEmail: email,
    signatureData: signatureData,
  });

  res.json({ success: true, agreement: updated });
}));

router.post("/api/public/agreements/:token/create-checkout", asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { name, email, signatureData, language = "fr" } = req.body;

  if (!name || !email || !signatureData) {
    throw new BadRequestError("Name, email, and signature are required");
  }

  const agreements = await storage.getDesignAgreements();
  const agreement = agreements.find(a => a.publicToken === token);

  if (!agreement) {
    throw new NotFoundError("Agreement");
  }

  if (agreement.status === "accepted") {
    throw new BadRequestError("Agreement already signed");
  }

  if (agreement.validUntil && new Date(agreement.validUntil) < new Date()) {
    throw new BadRequestError("Agreement has expired");
  }

  const site = await storage.getSite(agreement.siteId);
  if (!site) {
    throw new NotFoundError("Site");
  }

  const client = await storage.getClient(site.clientId);
  if (!client) {
    throw new NotFoundError("Client");
  }

  const totalAmount = agreement.totalCad || 0;
  const depositAmount = Math.round(totalAmount * 0.5 * 100);

  if (depositAmount <= 0) {
    throw new BadRequestError("Invalid deposit amount");
  }

  const { getUncachableStripeClient } = await import("../stripeClient");
  const stripe = await getUncachableStripeClient();

  const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'cad',
        unit_amount: depositAmount,
        product_data: {
          name: language === "fr"
            ? `Dépôt - Mandat de conception: ${site.name}`
            : `Deposit - Design Mandate: ${site.name}`,
          description: language === "fr"
            ? `Dépôt 50% pour les services de conception technique - ${client.name}`
            : `50% deposit for technical design services - ${client.name}`,
        },
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: `${baseUrl}/sign/${token}?payment=success`,
    cancel_url: `${baseUrl}/sign/${token}?payment=cancelled`,
    customer_email: email,
    metadata: {
      agreementId: agreement.id,
      agreementToken: token,
      signerName: name,
      signerEmail: email,
      siteId: agreement.siteId,
      clientId: site.clientId,
    },
    locale: language === "fr" ? "fr-CA" : "en",
  });

  await storage.updateDesignAgreement(agreement.id, {
    acceptedByName: name,
    acceptedByEmail: email,
    signatureData: signatureData,
    stripeSessionId: session.id,
  });

  res.json({
    success: true,
    checkoutUrl: session.url,
    sessionId: session.id,
  });
}));

router.post("/api/public/agreements/:token/confirm-payment", asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { sessionId } = req.body;

  const agreements = await storage.getDesignAgreements();
  const agreement = agreements.find(a => a.publicToken === token);

  if (!agreement) {
    throw new NotFoundError("Agreement");
  }

  const { getUncachableStripeClient } = await import("../stripeClient");
  const stripe = await getUncachableStripeClient();

  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== 'paid') {
    throw new BadRequestError("Payment not completed");
  }

  const depositAmount = (session.amount_total || 0) / 100;

  const updated = await storage.updateDesignAgreement(agreement.id, {
    status: "accepted",
    acceptedAt: new Date(),
    depositAmount: depositAmount,
    depositPaidAt: new Date(),
    stripePaymentIntentId: session.payment_intent as string,
  });

  res.json({ success: true, agreement: updated });
}));

router.get("/api/public/stripe-key", asyncHandler(async (req, res) => {
  const { getStripePublishableKey } = await import("../stripeClient");
  const key = await getStripePublishableKey();
  res.json({ publishableKey: key });
}));

function generateRoofVisualizationParams(
  latitude: number,
  longitude: number,
  roofPolygons: Array<{ coordinates: unknown; color?: string | null; label?: string | null }>
): string {
  let pathParams = "";

  const solarPolygons = roofPolygons.filter((p) => {
    if (p.color === "#f97316") return false;
    const label = (p.label || "").toLowerCase();
    return !label.includes("constraint") && !label.includes("contrainte") &&
           !label.includes("hvac") && !label.includes("obstacle");
  });

  solarPolygons.forEach((polygon) => {
    const coords = polygon.coordinates as [number, number][];
    if (coords && coords.length >= 3) {
      const pathCoords = coords.map(([pLng, pLat]) => `${pLat},${pLng}`).join("|");
      pathParams += `&path=fillcolor:0x3b82f680|color:0x1e40af|weight:2|${pathCoords}`;
    }
  });

  const constraintPolygons = roofPolygons.filter((p) => {
    if (p.color === "#f97316") return true;
    const label = (p.label || "").toLowerCase();
    return label.includes("constraint") || label.includes("contrainte") ||
           label.includes("hvac") || label.includes("obstacle");
  });

  constraintPolygons.forEach((polygon) => {
    const coords = polygon.coordinates as [number, number][];
    if (coords && coords.length >= 3) {
      const pathCoords = coords.map(([pLng, pLat]) => `${pLat},${pLng}`).join("|");
      pathParams += `&path=fillcolor:0xf9731680|color:0xf97316|weight:2|${pathCoords}`;
    }
  });

  return `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=17&size=400x300&maptype=satellite${pathParams}`;
}

router.get("/api/public/portfolio", asyncHandler(async (req, res) => {
  const DREAM_CLIENT_ID = "6ba7837d-84a0-4526-bfbf-f802bc68c25e";

  const allSites = await storage.getSitesByClient(DREAM_CLIENT_ID);

  const portfolioSites = await Promise.all(
    allSites
      .filter(site => site.latitude != null && site.longitude != null)
      .map(async (site) => {
        const roofPolygons = await storage.getRoofPolygons(site.id);

        let visualizationUrl = null;
        if (roofPolygons.length > 0 && site.latitude && site.longitude) {
          visualizationUrl = generateRoofVisualizationParams(
            site.latitude,
            site.longitude,
            roofPolygons
          );
        }

        const systemSizeKw = site.kbKwDc || site.quickAnalysisSystemSizeKw || null;

        let roofAreaSqM = site.roofAreaSqM || null;
        if (!roofAreaSqM && site.buildingSqFt) {
          roofAreaSqM = Math.round(site.buildingSqFt / 10.764);
        }

        return {
          id: site.id,
          city: site.city || "Unknown",
          address: site.address || null,
          kb_kw_dc: systemSizeKw,
          latitude: site.latitude,
          longitude: site.longitude,
          roof_area_sqm: roofAreaSqM,
          visualization_url: visualizationUrl,
        };
      })
  );

  res.json(portfolioSites);
}));

router.get("/api/public/portfolio/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const DREAM_CLIENT_ID = "6ba7837d-84a0-4526-bfbf-f802bc68c25e";

  const site = await storage.getSite(id);

  if (!site) {
    throw new NotFoundError("Project");
  }

  if (site.clientId !== DREAM_CLIENT_ID) {
    throw new NotFoundError("Project");
  }

  const roofPolygons = await storage.getRoofPolygons(id);

  let visualizationUrl = null;
  if (roofPolygons.length > 0 && site.latitude && site.longitude) {
    visualizationUrl = generateRoofVisualizationParams(
      site.latitude,
      site.longitude,
      roofPolygons
    );
  }

  let calculatedRoofArea = null;
  if (roofPolygons.length > 0) {
    calculatedRoofArea = roofPolygons.reduce((sum, p) => sum + (p.areaSqM || 0), 0);
  }

  const systemSizeKw = site.kbKwDc || site.quickAnalysisSystemSizeKw || null;

  let roofAreaSqM = site.roofAreaSqM || calculatedRoofArea || null;
  if (!roofAreaSqM && site.buildingSqFt) {
    roofAreaSqM = Math.round(site.buildingSqFt / 10.764);
  }

  const roundedSystemSize = systemSizeKw ? Math.round(systemSizeKw / 100) * 100 : null;

  res.json({
    id: site.id,
    city: site.city || null,
    address: site.address || null,
    province: site.province || "Québec",
    postalCode: site.postalCode || null,
    latitude: site.latitude,
    longitude: site.longitude,
    systemSizeKwDc: roundedSystemSize,
    roofAreaSqM: roofAreaSqM ? Math.round(roofAreaSqM) : null,
    buildingType: site.buildingType || null,
    roofType: site.roofType || null,
    visualizationUrl: visualizationUrl,
    constructionStart: { fr: "Printemps/Été 2028", en: "Spring/Summer 2028" },
    developer: { fr: "Scale Cleantech et kWh Québec", en: "Scale Cleantech and kWh Québec" },
    buildingSponsor: { fr: "Dream Industrial Solar", en: "Dream Industrial Solar" },
    electricityOfftake: { fr: "Hydro-Québec", en: "Hydro-Québec" },
  });
}));

router.get("/api/blog", asyncHandler(async (req, res) => {
  const articles = await storage.getBlogArticles("published");
  res.json(articles);
}));

router.get("/api/blog/:slug", asyncHandler(async (req, res) => {
  const article = await storage.getBlogArticleBySlug(req.params.slug);
  if (!article) {
    throw new NotFoundError("Article");
  }
  await storage.incrementArticleViews(article.id);
  res.json(article);
}));

export default router;
