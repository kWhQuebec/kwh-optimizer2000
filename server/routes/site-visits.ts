import { Router } from "express";
import { authMiddleware, requireStaff, AuthRequest } from "../middleware/auth";
import { storage } from "../storage";
import multer from "multer";
import fs from "fs";
import PDFDocument from "pdfkit";
import { insertSiteVisitSchema, insertSiteVisitPhotoSchema } from "@shared/schema";
import { createLogger } from "../lib/logger";
import { asyncHandler, BadRequestError, NotFoundError } from "../middleware/errorHandler";

const log = createLogger("SiteVisits");
const router = Router();

const upload = multer({
  dest: "uploads/",
  limits: {
    files: 200,
    fileSize: 50 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'text/csv',
      'application/vnd.ms-excel',
    ];
    if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

router.get("/api/site-visits", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const visits = await storage.getSiteVisits();
  res.json(visits);
}));

router.get("/api/sites/:siteId/visits", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const visits = await storage.getSiteVisitsBySite(req.params.siteId);
  res.json(visits);
}));

router.get("/api/site-visits/:id", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const visit = await storage.getSiteVisit(req.params.id);
  if (!visit) {
    throw new NotFoundError("Site visit");
  }
  res.json(visit);
}));

router.post("/api/site-visits", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const data = { ...req.body };
  if (data.visitDate && typeof data.visitDate === 'string') {
    data.visitDate = new Date(data.visitDate);
  }

  const parsed = insertSiteVisitSchema.safeParse(data);
  if (!parsed.success) {
    throw new BadRequestError("Validation failed", parsed.error.errors as unknown[]);
  }

  const visit = await storage.createSiteVisit(parsed.data);
  res.status(201).json(visit);
}));

router.patch("/api/site-visits/:id", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const data = { ...req.body };
  if (data.visitDate && typeof data.visitDate === 'string') {
    data.visitDate = new Date(data.visitDate);
  }

  const visit = await storage.updateSiteVisit(req.params.id, data);
  if (!visit) {
    throw new NotFoundError("Site visit");
  }
  res.json(visit);
}));

router.delete("/api/site-visits/:id", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const deleted = await storage.deleteSiteVisit(req.params.id);
  if (!deleted) {
    throw new NotFoundError("Site visit");
  }
  res.status(204).send();
}));

router.get("/api/site-visits/:id/pdf", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const visit = await storage.getSiteVisit(req.params.id);
  if (!visit) {
    throw new NotFoundError("Site visit");
  }

  const site = await storage.getSite(visit.siteId);
  const siteName = site?.name || "Unknown Site";
  const siteAddress = site ? [site.address, site.city, site.province, site.postalCode].filter(Boolean).join(", ") : "";

  const lang = (req.query.lang as string) === "en" ? "en" : "fr";

  const labels = {
    title: lang === "fr" ? "Rapport de visite technique" : "Technical Visit Report",
    siteInfo: lang === "fr" ? "Information du site" : "Site Information",
    siteName: lang === "fr" ? "Nom du site" : "Site Name",
    address: lang === "fr" ? "Adresse" : "Address",
    visitDate: lang === "fr" ? "Date de visite" : "Visit Date",
    visitedBy: lang === "fr" ? "Visité par" : "Visited By",
    status: lang === "fr" ? "Statut" : "Status",
    contact: lang === "fr" ? "Contact sur place" : "Site Contact",
    roofSection: lang === "fr" ? "Information toiture" : "Roof Information",
    roofType: lang === "fr" ? "Type de toit" : "Roof Type",
    roofMaterial: lang === "fr" ? "Matériau" : "Material",
    roofAge: lang === "fr" ? "Âge du toit (années)" : "Roof Age (years)",
    roofSurfaceArea: lang === "fr" ? "Surface (m²)" : "Surface Area (m²)",
    buildingHeight: lang === "fr" ? "Hauteur bâtiment (m)" : "Building Height (m)",
    parapetHeight: lang === "fr" ? "Hauteur parapet (m)" : "Parapet Height (m)",
    roofSlope: lang === "fr" ? "Pente (%)" : "Slope (%)",
    anchoringPossible: lang === "fr" ? "Ancrage possible" : "Anchoring Possible",
    lightningRod: lang === "fr" ? "Paratonnerre présent" : "Lightning Rod Present",
    electricalSection: lang === "fr" ? "Infrastructure électrique" : "Electrical Infrastructure",
    numberOfMeters: lang === "fr" ? "Nombre de compteurs" : "Number of Meters",
    meterNumber: lang === "fr" ? "Numéro de compteur Hydro-Québec" : "Hydro-Québec Meter Number",
    mainPanelPower: lang === "fr" ? "Puissance panneau principal" : "Main Panel Power",
    mainPanelVoltage: lang === "fr" ? "Voltage" : "Voltage",
    mainPanel: lang === "fr" ? "Panneau principal" : "Main Panel",
    mainBreaker: lang === "fr" ? "Disjoncteur principal" : "Main Breaker",
    circuitBreaker: lang === "fr" ? "Disjoncteur" : "Circuit Breaker",
    disconnectSwitch: lang === "fr" ? "Sectionneur" : "Disconnect Switch",
    sldMain: lang === "fr" ? "Schéma unifilaire disponible" : "Main SLD Available",
    sldMainNeedsUpdate: lang === "fr" ? "Schéma nécessite mise à jour" : "SLD Needs Update",
    secondaryEquipment: lang === "fr" ? "Équipement secondaire" : "Secondary Equipment",
    secondaryPanel: lang === "fr" ? "Panneau secondaire" : "Secondary Panel",
    secondaryBreaker: lang === "fr" ? "Disjoncteur secondaire" : "Secondary Breaker",
    secondaryDisconnect: lang === "fr" ? "Sectionneur secondaire" : "Secondary Disconnect",
    manufacturer: lang === "fr" ? "Fabricant" : "Manufacturer",
    model: lang === "fr" ? "Modèle" : "Model",
    obstaclesSection: lang === "fr" ? "Obstacles et ombrage" : "Obstacles & Shading",
    hasObstacles: lang === "fr" ? "Obstacles présents" : "Obstacles Present",
    treesPresent: lang === "fr" ? "Arbres présents" : "Trees Present",
    treeNotes: lang === "fr" ? "Notes arbres" : "Tree Notes",
    otherObstacles: lang === "fr" ? "Autres obstacles" : "Other Obstacles",
    adjacentRoofs: lang === "fr" ? "Toits adjacents même niveau" : "Adjacent Roofs Same Level",
    techRoomSection: lang === "fr" ? "Salle technique" : "Technical Room",
    techRoomCovered: lang === "fr" ? "Salle couverte" : "Room Covered",
    techRoomSpace: lang === "fr" ? "Espace disponible" : "Available Space",
    techRoomDistance: lang === "fr" ? "Distance (m)" : "Distance (m)",
    injectionPoint: lang === "fr" ? "Point d'injection" : "Injection Point",
    accessSection: lang === "fr" ? "Accès au toit" : "Roof Access",
    roofAccessible: lang === "fr" ? "Toit accessible" : "Roof Accessible",
    accessMethod: lang === "fr" ? "Méthode d'accès" : "Access Method",
    accessNotes: lang === "fr" ? "Notes d'accès" : "Access Notes",
    documentationSection: lang === "fr" ? "Documentation" : "Documentation",
    photosTaken: lang === "fr" ? "Photos prises" : "Photos Taken",
    documentsCollected: lang === "fr" ? "Documents collectés" : "Documents Collected",
    electricalDrawings: lang === "fr" ? "Dessins électriques" : "Electrical Drawings",
    meterDetails: lang === "fr" ? "Détails compteur" : "Meter Details",
    otherDocs: lang === "fr" ? "Autres" : "Other",
    inspectorSignature: lang === "fr" ? "Signature inspecteur" : "Inspector Signature",
    notes: lang === "fr" ? "Notes" : "Notes",
    generatedAt: lang === "fr" ? "Généré le" : "Generated on",
    yes: lang === "fr" ? "Oui" : "Yes",
    no: lang === "fr" ? "Non" : "No",
    notSpecified: lang === "fr" ? "Non spécifié" : "Not specified",
    statusScheduled: lang === "fr" ? "Planifiée" : "Scheduled",
    statusInProgress: lang === "fr" ? "En cours" : "In Progress",
    statusCompleted: lang === "fr" ? "Complétée" : "Completed",
    statusCancelled: lang === "fr" ? "Annulée" : "Cancelled",
    accessLadder: lang === "fr" ? "Échelle" : "Ladder",
    accessTrapdoor: lang === "fr" ? "Trappe" : "Trapdoor",
    accessStairs: lang === "fr" ? "Escalier" : "Stairs",
    accessLift: lang === "fr" ? "Nacelle / Lift" : "Lift / Cherry picker",
    accessOther: lang === "fr" ? "Autre" : "Other",
    roofFlat: lang === "fr" ? "Plat" : "Flat",
    roofSloped: lang === "fr" ? "Incliné" : "Sloped",
  };

  const formatBool = (val: boolean | null | undefined) => val ? labels.yes : labels.no;
  const formatVal = (val: unknown) => val ?? labels.notSpecified;
  const formatStatus = (status: string) => {
    switch (status) {
      case "scheduled": return labels.statusScheduled;
      case "in_progress": return labels.statusInProgress;
      case "completed": return labels.statusCompleted;
      case "cancelled": return labels.statusCancelled;
      default: return status;
    }
  };
  const formatAccessMethod = (method: string | null | undefined) => {
    if (!method) return labels.notSpecified;
    switch (method) {
      case "ladder": return labels.accessLadder;
      case "trapdoor": return labels.accessTrapdoor;
      case "stairs": return labels.accessStairs;
      case "lift": return labels.accessLift;
      case "other": return labels.accessOther;
      default: return method;
    }
  };
  const formatRoofType = (type: string | null | undefined) => {
    if (!type) return labels.notSpecified;
    switch (type) {
      case "flat": return labels.roofFlat;
      case "inclined": return labels.roofSloped;
      default: return type;
    }
  };

  const doc = new PDFDocument({ margin: 50, size: "LETTER" });

  const filename = `site-visit-report-${visit.id.slice(0, 8)}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  doc.pipe(res);

  const primaryColor = "#006633";
  const headerColor = "#333333";
  const textColor = "#444444";

  doc.fontSize(22).fillColor(primaryColor).text(labels.title, { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor(textColor).text(`${labels.generatedAt}: ${new Date().toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA")}`, { align: "center" });
  doc.moveDown(1.5);

  const drawSection = (title: string) => {
    doc.moveDown(0.5);
    doc.fontSize(14).fillColor(primaryColor).text(title);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor(primaryColor).stroke();
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor(textColor);
  };

  const drawRow = (label: string, value: unknown) => {
    doc.font("Helvetica-Bold").text(`${label}: `, { continued: true });
    doc.font("Helvetica").text(String(value ?? labels.notSpecified));
  };

  drawSection(labels.siteInfo);
  drawRow(labels.siteName, siteName);
  drawRow(labels.address, siteAddress || labels.notSpecified);
  if (visit.gpsLatitude != null && visit.gpsLongitude != null) {
    drawRow(lang === "fr" ? "Coordonnées GPS" : "GPS Coordinates", `${visit.gpsLatitude.toFixed(6)}, ${visit.gpsLongitude.toFixed(6)}`);
  }
  drawRow(labels.visitDate, visit.visitDate ? new Date(visit.visitDate).toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA") : labels.notSpecified);
  drawRow(labels.visitedBy, visit.visitedBy);
  drawRow(labels.status, formatStatus(visit.status || "scheduled"));
  if (visit.siteContactName) {
    drawRow(labels.contact, `${visit.siteContactName}${visit.siteContactPhone ? ` - ${visit.siteContactPhone}` : ""}${visit.siteContactEmail ? ` - ${visit.siteContactEmail}` : ""}`);
  }
  if (visit.meterNumbers) {
    drawRow(lang === "fr" ? "Numéros de compteurs" : "Meter Numbers", visit.meterNumbers);
  }

  drawSection(labels.roofSection);
  drawRow(labels.roofType, formatRoofType(visit.roofType));
  drawRow(labels.roofMaterial, formatVal(visit.roofMaterial));
  drawRow(labels.roofAge, visit.roofAge != null ? visit.roofAge : labels.notSpecified);
  drawRow(labels.roofSurfaceArea, visit.roofSurfaceAreaSqM != null ? visit.roofSurfaceAreaSqM : labels.notSpecified);
  drawRow(labels.buildingHeight, visit.buildingHeight != null ? visit.buildingHeight : labels.notSpecified);
  drawRow(labels.parapetHeight, visit.parapetHeight != null ? visit.parapetHeight : labels.notSpecified);
  drawRow(labels.roofSlope, visit.roofSlope != null ? visit.roofSlope : labels.notSpecified);
  drawRow(labels.anchoringPossible, formatBool(visit.anchoringPossible));
  if (visit.anchoringNotes) drawRow(labels.notes, visit.anchoringNotes);
  drawRow(labels.lightningRod, formatBool(visit.lightningRodPresent));

  drawSection(labels.electricalSection);
  drawRow(labels.numberOfMeters, visit.numberOfMeters != null ? visit.numberOfMeters : labels.notSpecified);
  drawRow(labels.meterNumber, formatVal(visit.hqMeterNumber));
  drawRow(labels.mainPanelPower, formatVal(visit.mainPanelPower));
  drawRow(labels.mainPanelVoltage, formatVal(visit.mainPanelVoltage));
  drawRow(labels.sldMain, formatBool(visit.sldMainAvailable));
  drawRow(labels.sldMainNeedsUpdate, formatBool(visit.sldMainNeedsUpdate));

  if (visit.mainPanelManufacturer || visit.mainPanelModel) {
    doc.moveDown(0.3);
    doc.font("Helvetica-Bold").text(`${labels.mainPanel}:`);
    doc.font("Helvetica").text(`  ${labels.manufacturer}: ${formatVal(visit.mainPanelManufacturer)}`);
    doc.text(`  ${labels.model}: ${formatVal(visit.mainPanelModel)}`);
  }
  if (visit.mainBreakerManufacturer || visit.mainBreakerModel) {
    doc.font("Helvetica-Bold").text(`${labels.mainBreaker}:`);
    doc.font("Helvetica").text(`  ${labels.manufacturer}: ${formatVal(visit.mainBreakerManufacturer)}`);
    doc.text(`  ${labels.model}: ${formatVal(visit.mainBreakerModel)}`);
  }
  if (visit.circuitBreakerManufacturer || visit.circuitBreakerModel) {
    doc.font("Helvetica-Bold").text(`${labels.circuitBreaker}:`);
    doc.font("Helvetica").text(`  ${labels.manufacturer}: ${formatVal(visit.circuitBreakerManufacturer)}`);
    doc.text(`  ${labels.model}: ${formatVal(visit.circuitBreakerModel)}`);
  }
  if (visit.disconnectSwitchManufacturer || visit.disconnectSwitchModel) {
    doc.font("Helvetica-Bold").text(`${labels.disconnectSwitch}:`);
    doc.font("Helvetica").text(`  ${labels.manufacturer}: ${formatVal(visit.disconnectSwitchManufacturer)}`);
    doc.text(`  ${labels.model}: ${formatVal(visit.disconnectSwitchModel)}`);
  }

  const hasSecondary = visit.secondaryPanelManufacturer || visit.secondaryPanelModel ||
                      visit.secondaryBreakerManufacturer || visit.secondaryBreakerModel ||
                      visit.secondaryDisconnectManufacturer || visit.secondaryDisconnectModel;
  if (hasSecondary) {
    doc.moveDown(0.3);
    doc.font("Helvetica-Bold").text(labels.secondaryEquipment);
    if (visit.secondaryPanelManufacturer || visit.secondaryPanelModel) {
      doc.font("Helvetica").text(`  ${labels.secondaryPanel}: ${formatVal(visit.secondaryPanelManufacturer)} / ${formatVal(visit.secondaryPanelModel)}`);
    }
    if (visit.secondaryBreakerManufacturer || visit.secondaryBreakerModel) {
      doc.text(`  ${labels.secondaryBreaker}: ${formatVal(visit.secondaryBreakerManufacturer)} / ${formatVal(visit.secondaryBreakerModel)}`);
    }
    if (visit.secondaryDisconnectManufacturer || visit.secondaryDisconnectModel) {
      doc.text(`  ${labels.secondaryDisconnect}: ${formatVal(visit.secondaryDisconnectManufacturer)} / ${formatVal(visit.secondaryDisconnectModel)}`);
    }
  }
  if (visit.secondaryEquipmentNotes) {
    drawRow(labels.notes, visit.secondaryEquipmentNotes);
  }

  drawSection(labels.obstaclesSection);
  drawRow(labels.hasObstacles, formatBool(visit.hasObstacles));
  drawRow(labels.treesPresent, formatBool(visit.treesPresent));
  if (visit.treeNotes) drawRow(labels.treeNotes, visit.treeNotes);
  if (visit.otherObstacles) drawRow(labels.otherObstacles, visit.otherObstacles);
  drawRow(labels.adjacentRoofs, formatBool(visit.adjacentRoofsSameLevel));

  drawSection(labels.techRoomSection);
  drawRow(labels.techRoomCovered, formatBool(visit.technicalRoomCovered));
  drawRow(labels.techRoomSpace, formatVal(visit.technicalRoomSpace));
  drawRow(labels.techRoomDistance, visit.technicalRoomDistance != null ? visit.technicalRoomDistance : labels.notSpecified);
  drawRow(labels.injectionPoint, formatVal(visit.injectionPointPosition));

  drawSection(labels.accessSection);
  drawRow(labels.roofAccessible, formatBool(visit.roofAccessible));
  drawRow(labels.accessMethod, formatAccessMethod(visit.accessMethod));
  if (visit.accessNotes) drawRow(labels.accessNotes, visit.accessNotes);

  drawSection(labels.documentationSection);
  drawRow(labels.photosTaken, formatBool(visit.photosTaken));

  const docs = visit.documentsCollected as { electricalDrawings?: boolean; meterDetails?: boolean; other?: string } | null;
  if (docs) {
    drawRow(labels.electricalDrawings, formatBool(docs.electricalDrawings));
    drawRow(labels.meterDetails, formatBool(docs.meterDetails));
    if (docs.other) drawRow(labels.otherDocs, docs.other);
  }

  if (visit.inspectorSignature) {
    doc.moveDown(0.5);
    drawRow(labels.inspectorSignature, visit.inspectorSignature);
  }

  if (visit.notes) {
    drawSection(labels.notes);
    doc.font("Helvetica").text(visit.notes);
  }

  const cost = visit.estimatedCost as { travel?: number; visit?: number; evaluation?: number; diagrams?: number; sldSupplement?: number; total?: number } | null;
  if (cost && cost.total) {
    drawSection(lang === "fr" ? "Estimation des coûts" : "Cost Estimate");
    const formatCurrency = (val: number) => new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(val);
    if (cost.travel) drawRow(lang === "fr" ? "Frais de déplacement" : "Travel Cost", formatCurrency(cost.travel));
    if (cost.visit) drawRow(lang === "fr" ? "Visite sur site" : "Site Visit", formatCurrency(cost.visit));
    if (cost.evaluation) drawRow(lang === "fr" ? "Évaluation technique" : "Technical Evaluation", formatCurrency(cost.evaluation));
    if (cost.diagrams) drawRow(lang === "fr" ? "Dessins techniques" : "Technical Drawings", formatCurrency(cost.diagrams));
    if (cost.sldSupplement) drawRow(lang === "fr" ? "Supplément schéma" : "SLD Supplement", formatCurrency(cost.sldSupplement));
    doc.moveDown(0.3);
    doc.font("Helvetica-Bold").text(`Total: ${formatCurrency(cost.total)}`);
  }

  doc.moveDown(2);
  doc.fontSize(8).fillColor("#888888").text("kWh Québec - Solar & Storage Solutions", { align: "center" });

  doc.end();
}));

router.post("/api/site-visits/calculate-cost", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const { travelDays, buildingCount, includeSld } = req.body;

  const TRAVEL_COST_PER_DAY = 150;
  const VISIT_COST_PER_BUILDING = 600;
  const EVALUATION_COST_PER_BUILDING = 1000;
  const DIAGRAMS_COST_PER_BUILDING = 1900;
  const SLD_SUPPLEMENT = 100;

  const buildings = buildingCount || 1;
  const travel = travelDays || 0;

  const breakdown = {
    travel: travel * TRAVEL_COST_PER_DAY,
    visit: buildings * VISIT_COST_PER_BUILDING,
    evaluation: buildings * EVALUATION_COST_PER_BUILDING,
    diagrams: buildings * DIAGRAMS_COST_PER_BUILDING,
    sldSupplement: includeSld ? buildings * SLD_SUPPLEMENT : 0,
  };

  const total = Object.values(breakdown).reduce((sum, val) => sum + val, 0);

  res.json({
    breakdown,
    total,
    currency: "CAD",
  });
}));

router.post("/api/site-visits/photos", authMiddleware, requireStaff, upload.single("photo"), asyncHandler(async (req: AuthRequest, res) => {
  const file = req.file;

  if (!file) {
    throw new BadRequestError("No photo file provided");
  }

  const allowedCategories = ["roof", "electrical", "meters", "obstacles", "general"];
  const category = allowedCategories.includes(req.body.category) ? req.body.category : "general";

  const sanitizedFilename = file.originalname
    .replace(/[\/\\]/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .substring(0, 255);

  const photoData = {
    siteId: req.body.siteId,
    visitId: req.body.visitId || null,
    category,
    filename: sanitizedFilename,
    filepath: file.path,
    mimetype: file.mimetype || null,
    sizeBytes: file.size || null,
    caption: req.body.caption?.substring(0, 500) || null,
    latitude: req.body.latitude ? parseFloat(req.body.latitude) : null,
    longitude: req.body.longitude ? parseFloat(req.body.longitude) : null,
    uploadedBy: req.userId || null,
  };

  const validationResult = insertSiteVisitPhotoSchema.safeParse(photoData);
  if (!validationResult.success) {
    fs.unlink(file.path, () => {});
    throw new BadRequestError("Invalid photo data", validationResult.error.format() as unknown as unknown[]);
  }

  const photo = await storage.createSiteVisitPhoto(validationResult.data);

  res.json({
    success: true,
    photo: {
      id: photo.id,
      category: photo.category,
      filename: photo.filename,
      filepath: photo.filepath,
      uploadedAt: photo.uploadedAt,
    },
  });
}));

router.get("/api/sites/:siteId/photos", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const siteId = req.params.siteId;
  const photos = await storage.getSiteVisitPhotos(siteId);
  res.json(photos);
}));

router.get("/api/site-visits/:visitId/photos", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const visitId = req.params.visitId;
  const photos = await storage.getSiteVisitPhotosByVisit(visitId);
  res.json(photos);
}));

router.delete("/api/site-visits/photos/:photoId", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const photoId = req.params.photoId;
  const deleted = await storage.deleteSiteVisitPhoto(photoId);
  if (!deleted) {
    throw new NotFoundError("Photo");
  }
  res.json({ success: true });
}));

export default router;
