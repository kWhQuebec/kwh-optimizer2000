import { Router } from "express";
import PDFDocument from "pdfkit";
import { authMiddleware, requireStaff, AuthRequest } from "../middleware/auth";
import { storage } from "../storage";
import { STANDARD_KITS } from "../analysis";
import { calculatePricingFromSiteVisit, getSiteVisitCompleteness, estimateConstructionCost } from "../pricing-engine";
import { prepareDocumentData, applyOptimalScenario } from "../documentDataProvider";
import { createLogger } from "../lib/logger";
import { asyncHandler, BadRequestError, NotFoundError, ForbiddenError } from "../middleware/errorHandler";

const log = createLogger("Designs");
const router = Router();

router.get("/api/standard-kits", authMiddleware, asyncHandler(async (_req, res) => {
  res.json({
    success: true,
    kits: STANDARD_KITS,
  });
}));

router.get("/api/simulation-runs", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  if (req.userRole === "client" && req.userClientId) {
    const runs = await storage.getSimulationRunsByClientId(req.userClientId);
    return res.json(runs);
  }

  const runs = await storage.getSimulationRuns();
  res.json(runs);
}));

router.get("/api/simulation-runs/:id", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const run = await storage.getSimulationRun(req.params.id);
  if (!run) {
    throw new NotFoundError("Simulation");
  }

  if (req.userRole === "client" && req.userClientId) {
    const site = await storage.getSite(run.siteId);
    if (!site || site.clientId !== req.userClientId) {
      throw new ForbiddenError("Access denied");
    }
  }

  res.json(run);
}));

router.get("/api/simulation-runs/:id/full", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const run = await storage.getSimulationRunFull(req.params.id);
  if (!run) {
    throw new NotFoundError("Simulation run");
  }
  res.json(run);
}));

router.get("/api/simulation-runs/:id/report-pdf", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const lang = (req.query.lang as string) === "en" ? "en" : "fr";
  const opt = (req.query.opt as string) || 'npv';
  const useV2 = req.query.v !== "1";
  const docData = await prepareDocumentData(req.params.id, storage);

  if (req.userRole === "client" && req.userClientId) {
    const site = await storage.getSite(docData.simulation.siteId);
    if (!site || site.clientId !== req.userClientId) {
      throw new ForbiddenError("Access denied");
    }

    // Check qualification status for client
    const opportunities = await storage.getOpportunitiesBySiteId(site.id);
    const designAgreement = await storage.getDesignAgreementBySite(site.id);

    // Allow if design agreement exists or if opportunity is past "qualified" stage
    const isQualified = !!designAgreement || opportunities.some(opp => {
      const stages = ["qualified", "analysis_done", "design_mandate_signed", "epc_proposal_sent", "negotiation", "won"];
      return stages.includes(opp.stage);
    });

    if (!isQualified) {
      throw new ForbiddenError("PDF report locked until qualification call is completed");
    }
  }

  const optimizedSimulation = applyOptimalScenario(docData.simulation, opt as any);

  if (useV2) {
    const { generateProfessionalPDFv2 } = await import("../services/pdfGeneratorV2");
    const simData = {
      ...optimizedSimulation,
      roofPolygons: docData.roofPolygons,
      roofVisualizationBuffer: docData.roofVisualizationBuffer,
      catalogEquipment: docData.catalogEquipment,
      constructionTimeline: docData.constructionTimeline,
      isSynthetic: docData.isSynthetic,
    };

    const pdfBuffer = await generateProfessionalPDFv2(simData as any, lang);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="etude-solaire-stockage-${docData.simulation.site.name.replace(/\s+/g, '-')}.pdf"`);
    res.send(pdfBuffer);
    return;
  }

  const doc = new PDFDocument({ size: "LETTER", margin: 50 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="etude-solaire-stockage-${docData.simulation.site.name.replace(/\s+/g, '-')}.pdf"`);

  doc.pipe(res);

  const simulationWithRoof = {
    ...optimizedSimulation,
    roofPolygons: docData.roofPolygons,
    roofVisualizationBuffer: docData.roofVisualizationBuffer,
    isSynthetic: docData.isSynthetic,
  };

  const { generateProfessionalPDF } = await import("../pdf");
  generateProfessionalPDF(doc, simulationWithRoof, lang, docData.siteSimulations);

  doc.end();
}));

router.get("/api/simulation-runs/:id/executive-summary-pdf", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const lang = (req.query.lang as string) === "en" ? "en" : "fr";
  const opt = (req.query.opt as string) || 'npv';
  const docData = await prepareDocumentData(req.params.id, storage);

  if (req.userRole === "client" && req.userClientId) {
    const site = await storage.getSite(docData.simulation.siteId);
    if (!site || site.clientId !== req.userClientId) {
      throw new ForbiddenError("Access denied");
    }

    // Check qualification status for client
    const opportunities = await storage.getOpportunitiesBySiteId(site.id);
    const designAgreement = await storage.getDesignAgreementBySite(site.id);

    // Allow if design agreement exists or if opportunity is past "qualified" stage
    const isQualified = !!designAgreement || opportunities.some(opp => {
      const stages = ["qualified", "analysis_done", "design_mandate_signed", "epc_proposal_sent", "negotiation", "won"];
      return stages.includes(opp.stage);
    });

    if (!isQualified) {
      throw new ForbiddenError("PDF report locked until qualification call is completed");
    }
  }

  const optimizedSimulation = applyOptimalScenario(docData.simulation, opt as any);
  const simulationWithRoof = {
    ...optimizedSimulation,
    roofVisualizationBuffer: docData.roofVisualizationBuffer,
    isSynthetic: docData.isSynthetic,
  };

  const { generateExecutiveSummaryV2 } = await import("../services/executiveSummaryV2");
  const pdfBuffer = await generateExecutiveSummaryV2(simulationWithRoof, lang);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="resume-executif-${docData.simulation.site.name.replace(/\s+/g, '-')}.pdf"`);
  res.send(pdfBuffer);
}));

router.get("/api/simulation-runs/:id/presentation-pptx", authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
  const lang = (req.query.lang as string) === "en" ? "en" : "fr";
  const opt = (req.query.opt as string) || 'npv';
  const docData = await prepareDocumentData(req.params.id, storage);

  if (req.userRole === "client" && req.userClientId) {
    const site = await storage.getSite(docData.simulation.siteId);
    if (!site || site.clientId !== req.userClientId) {
      throw new ForbiddenError("Access denied");
    }
  }

  const optimizedSimulation = applyOptimalScenario(docData.simulation, opt as any);
  const simWithSyntheticFlag = { ...optimizedSimulation, isSynthetic: docData.isSynthetic };
  const { generatePresentationPPTX } = await import("../pptxGenerator");
  const pptxOptions = {
    catalogEquipment: (optimizedSimulation as any).catalogEquipment,
    constructionTimeline: (optimizedSimulation as any).constructionTimeline,
    roofPolygons: (optimizedSimulation as any).roofPolygons?.map((p: any) => ({
      label: p.label,
      areaSqM: p.areaSqM,
      orientation: p.orientation,
    })),
  };
  const pptxBuffer = await generatePresentationPPTX(simWithSyntheticFlag as any, docData.roofVisualizationBuffer, lang, pptxOptions);

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
  res.setHeader("Content-Disposition", `attachment; filename="proposition-${docData.simulation.site.name.replace(/\s+/g, '-')}.pptx"`);
  res.send(pptxBuffer);
}));

router.get("/api/methodology/pdf", authMiddleware, asyncHandler(async (req, res) => {
  const lang = req.headers["accept-language"]?.includes("en") ? "en" : "fr";

  const doc = new PDFDocument({ size: "LETTER", margin: 50 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="methodology-${lang}.pdf"`);

  doc.pipe(res);

  const { generateMethodologyPDF } = await import("../pdf");
  generateMethodologyPDF(doc, lang);

  doc.end();
}));

router.get("/api/designs", authMiddleware, asyncHandler(async (req, res) => {
  const designs = await storage.getDesigns();
  res.json(designs);
}));

router.get("/api/designs/:id", authMiddleware, asyncHandler(async (req, res) => {
  const design = await storage.getDesign(req.params.id);
  if (!design) {
    throw new NotFoundError("Design");
  }
  res.json(design);
}));

router.post("/api/designs", authMiddleware, asyncHandler(async (req, res) => {
  const { designName, simulationRunId, moduleModelId, inverterModelId, batteryModelId, pvSizeKW, batteryEnergyKWh, batteryPowerKW, marginPercent } = req.body;

  const moduleItem = moduleModelId ? await storage.getCatalogItem(moduleModelId) : null;
  const inverterItem = inverterModelId ? await storage.getCatalogItem(inverterModelId) : null;
  const batteryItem = batteryModelId ? await storage.getCatalogItem(batteryModelId) : null;

  const moduleWattage = 660;
  const modulesCount = Math.ceil((pvSizeKW * 1000) / moduleWattage);
  const invertersCount = Math.ceil(pvSizeKW / 25);
  const batteryUnits = Math.ceil(batteryEnergyKWh / 16);

  const moduleCost = modulesCount * (moduleItem?.unitCost || 180);
  const inverterCost = invertersCount * (inverterItem?.unitCost || 3500);
  const batteryCost = batteryUnits * (batteryItem?.unitCost || 9000);
  const bosCost = (moduleCost + inverterCost) * 0.15;

  const totalCapexPV = moduleCost + inverterCost + bosCost * 0.7;
  const totalCapexBattery = batteryCost + bosCost * 0.3;
  const totalCapexBOS = bosCost;
  const totalCapex = moduleCost + inverterCost + batteryCost + bosCost;
  const margin = marginPercent / 100;
  const totalSellPrice = totalCapex * (1 + margin);

  const design = await storage.createDesign({
    simulationRunId,
    designName,
    pvSizeKW,
    moduleModel: moduleItem ? `${moduleItem.manufacturer} ${moduleItem.model}` : null,
    moduleWattage,
    modulesCount,
    inverterModel: inverterItem ? `${inverterItem.manufacturer} ${inverterItem.model}` : null,
    invertersCount,
    batteryModel: batteryItem ? `${batteryItem.manufacturer} ${batteryItem.model}` : null,
    batteryEnergyKWh,
    batteryUnits,
    rackingSystem: "Ground mount",
    notes: null,
    totalCapex,
    totalCapexPV,
    totalCapexBattery,
    totalCapexBOS,
    marginPercent,
    totalSellPrice,
  });

  const bomItemsData = [
    {
      designId: design.id,
      category: "MODULE",
      description: moduleItem ? `${moduleItem.manufacturer} ${moduleItem.model}` : "Module PV 410W",
      quantity: modulesCount,
      unit: "pc",
      unitCost: moduleItem?.unitCost || 180,
      unitSellPrice: moduleItem?.unitSellPrice || 250,
      lineTotalCost: moduleCost,
      lineTotalSell: modulesCount * (moduleItem?.unitSellPrice || 250),
    },
    {
      designId: design.id,
      category: "INVERTER",
      description: inverterItem ? `${inverterItem.manufacturer} ${inverterItem.model}` : "Onduleur 25kW",
      quantity: invertersCount,
      unit: "pc",
      unitCost: inverterItem?.unitCost || 3500,
      unitSellPrice: inverterItem?.unitSellPrice || 4500,
      lineTotalCost: inverterCost,
      lineTotalSell: invertersCount * (inverterItem?.unitSellPrice || 4500),
    },
    {
      designId: design.id,
      category: "BATTERY",
      description: batteryItem ? `${batteryItem.manufacturer} ${batteryItem.model}` : "Batterie 16kWh",
      quantity: batteryUnits,
      unit: "pc",
      unitCost: batteryItem?.unitCost || 9000,
      unitSellPrice: batteryItem?.unitSellPrice || 12000,
      lineTotalCost: batteryCost,
      lineTotalSell: batteryUnits * (batteryItem?.unitSellPrice || 12000),
    },
    {
      designId: design.id,
      category: "RACKING",
      description: "Structure de montage au sol",
      quantity: modulesCount * 0.3,
      unit: "m²",
      unitCost: 45,
      unitSellPrice: 65,
      lineTotalCost: modulesCount * 0.3 * 45,
      lineTotalSell: modulesCount * 0.3 * 65,
    },
    {
      designId: design.id,
      category: "BOS",
      description: "Balance of System (câblage, connecteurs, etc.)",
      quantity: 1,
      unit: "lot",
      unitCost: bosCost * 0.5,
      unitSellPrice: bosCost * 0.5 * 1.3,
      lineTotalCost: bosCost * 0.5,
      lineTotalSell: bosCost * 0.5 * 1.3,
    },
  ];

  const bomItems = await storage.createBomItems(bomItemsData);

  res.status(201).json({ ...design, bomItems });
}));

router.get("/api/designs/:id/pricing", authMiddleware, asyncHandler(async (req, res) => {
  const designId = req.params.id;
  const design = await storage.getDesign(designId);
  if (!design) {
    throw new NotFoundError("Design");
  }

  const simulation = await storage.getSimulationRun(design.simulationRunId);
  if (!simulation) {
    throw new NotFoundError("Simulation");
  }

  const visits = await storage.getSiteVisitsBySite(simulation.siteId);
  const completedVisit = visits.find(v => v.status === "completed") || visits[0] || null;

  const pricingBreakdown = calculatePricingFromSiteVisit({
    siteVisit: completedVisit,
    design,
    pvSizeKW: design.pvSizeKW || 0,
    batteryEnergyKWh: design.batteryEnergyKWh || 0,
  });

  const visitCompleteness = getSiteVisitCompleteness(completedVisit);

  res.json({
    designId,
    siteId: simulation.siteId,
    siteVisitId: completedVisit?.id || null,
    visitCompleteness,
    pricing: pricingBreakdown,
  });
}));

router.get("/api/sites/:siteId/construction-estimate", authMiddleware, asyncHandler(async (req, res) => {
  const siteId = req.params.siteId;
  const site = await storage.getSite(siteId);
  if (!site) {
    throw new NotFoundError("Site");
  }

  const simulations = await storage.getSimulationRunsBySite(siteId);
  const latestSim = simulations.find(s => s.type === "SCENARIO") || simulations[0];

  const visits = await storage.getSiteVisitsBySite(siteId);
  const completedVisit = visits.find(v => v.status === "completed") || visits[0] || null;

  const pvSizeKW = latestSim?.pvSizeKW || 100;
  const batteryEnergyKWh = latestSim?.battEnergyKWh || 0;

  const estimate = estimateConstructionCost(pvSizeKW, batteryEnergyKWh, completedVisit);
  const visitCompleteness = getSiteVisitCompleteness(completedVisit);

  res.json({
    siteId,
    siteName: site.name,
    pvSizeKW,
    batteryEnergyKWh,
    siteVisitId: completedVisit?.id || null,
    siteVisitStatus: completedVisit?.status || "none",
    visitCompleteness,
    estimate,
  });
}));

router.post("/api/designs/:designId/generate-preliminary-schedule", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const { designId } = req.params;
  const { startDate } = req.body;

  if (!startDate) {
    throw new BadRequestError("startDate is required");
  }

  const design = await storage.getDesign(designId);
  if (!design) {
    throw new NotFoundError("Design");
  }

  const bomItems = await storage.getBomItems(designId);
  const simulationRun = design.simulationRunId ? await storage.getSimulationRun(design.simulationRunId) : null;
  const site = simulationRun?.siteId ? await storage.getSite(simulationRun.siteId) : null;

  let project;

  if (design.constructionAgreementId) {
    const existingProjects = await storage.getConstructionProjects();
    project = existingProjects.find(p => p.constructionAgreementId === design.constructionAgreementId);
  }

  if (!project) {
    const agreements = await storage.getConstructionAgreements();
    let agreementId = design.constructionAgreementId;

    if (!agreementId && site) {
      const agreement = await storage.createConstructionAgreement({
        siteId: site.id,
        designId: designId,
        status: "draft",
        pvSizeKW: design.pvSizeKW || 0,
        batteryEnergyKWh: design.batteryEnergyKWh || 0,
        totalContractValue: design.totalSellPrice || 0,
      });
      agreementId = agreement.id;
    }

    if (agreementId && site) {
      project = await storage.createConstructionProject({
        constructionAgreementId: agreementId,
        siteId: site.id,
        name: `${site.name || 'Site'} - Preliminary Schedule`,
        status: "planning",
        plannedStartDate: new Date(startDate),
      });
    } else {
      throw new BadRequestError("Cannot create project: missing site or agreement data");
    }
  }

  const pvSizeKW = design.pvSizeKW || 0;
  const batteryEnergyKWh = design.batteryEnergyKWh || 0;

  const taskTemplates = [
    {
      name: "Mobilisation",
      nameEn: "Mobilization",
      category: "general",
      durationDays: 2,
      dependencies: [] as string[],
    },
    {
      name: "Approvisionnement équipements",
      nameEn: "Equipment Procurement",
      category: "procurement",
      durationDays: pvSizeKW > 100 ? 21 : 14,
      dependencies: ["Mobilisation"],
    },
    {
      name: "Installation structure",
      nameEn: "Structure Installation",
      category: "structural",
      durationDays: Math.max(2, Math.ceil(pvSizeKW * 0.05)),
      dependencies: ["Approvisionnement équipements"],
    },
    {
      name: "Installation panneaux",
      nameEn: "Panel Installation",
      category: "mechanical",
      durationDays: Math.max(3, Math.ceil(pvSizeKW * 0.1)),
      dependencies: ["Installation structure"],
    },
    ...(batteryEnergyKWh > 0 ? [{
      name: "Installation batteries",
      nameEn: "Battery Installation",
      category: "mechanical" as const,
      durationDays: Math.max(1, Math.ceil(batteryEnergyKWh * 0.02)),
      dependencies: ["Installation panneaux"],
    }] : []),
    {
      name: "Câblage électrique",
      nameEn: "Electrical Wiring",
      category: "electrical",
      durationDays: Math.max(2, Math.ceil(pvSizeKW * 0.08)),
      dependencies: batteryEnergyKWh > 0 ? ["Installation panneaux", "Installation batteries"] : ["Installation panneaux"],
    },
    {
      name: "Inspection électrique",
      nameEn: "Electrical Inspection",
      category: "inspection",
      durationDays: 1,
      dependencies: ["Câblage électrique"],
    },
    {
      name: "Mise en service",
      nameEn: "Commissioning",
      category: "commissioning",
      durationDays: 2,
      dependencies: ["Inspection électrique"],
    },
  ];

  const existingTasks = await storage.getConstructionTasksByProjectId(project.id);
  for (const task of existingTasks) {
    if (task.isPreliminary && task.sourceDesignId === designId) {
      await storage.deleteConstructionTask(task.id);
    }
  }

  interface CreatedTask {
    id: string;
    name: string;
    plannedStartDate: Date | null;
    plannedEndDate: Date | null;
    [key: string]: unknown;
  }
  const createdTasks: CreatedTask[] = [];
  const taskIdMap: Record<string, string> = {};
  let currentDate = new Date(startDate);

  for (let i = 0; i < taskTemplates.length; i++) {
    const template = taskTemplates[i];

    let taskStartDate = new Date(startDate);
    if (template.dependencies.length > 0) {
      for (const depName of template.dependencies) {
        const depTask = createdTasks.find(t => t.name === depName);
        if (depTask && depTask.plannedEndDate) {
          const depEndDate = new Date(depTask.plannedEndDate);
          if (depEndDate > taskStartDate) {
            taskStartDate = new Date(depEndDate);
            taskStartDate.setDate(taskStartDate.getDate() + 1);
          }
        }
      }
    }

    const taskEndDate = new Date(taskStartDate);
    taskEndDate.setDate(taskEndDate.getDate() + template.durationDays - 1);

    const dependsOnTaskIds = template.dependencies
      .map(depName => taskIdMap[depName])
      .filter(Boolean);

    const task = await storage.createConstructionTask({
      projectId: project.id,
      name: template.name,
      description: `${template.nameEn} - Auto-generated from design BOM`,
      category: template.category,
      status: "pending",
      priority: "medium",
      plannedStartDate: taskStartDate,
      plannedEndDate: taskEndDate,
      durationDays: template.durationDays,
      dependsOnTaskIds: dependsOnTaskIds.length > 0 ? dependsOnTaskIds : null,
      isPreliminary: true,
      sourceDesignId: designId,
      sortOrder: i,
    });

    createdTasks.push(task);
    taskIdMap[template.name] = task.id;
  }

  if (createdTasks.length > 0) {
    const firstTask = createdTasks[0];
    const lastTask = createdTasks[createdTasks.length - 1];
    await storage.updateConstructionProject(project.id, {
      plannedStartDate: firstTask.plannedStartDate,
      plannedEndDate: lastTask.plannedEndDate,
    });
  }

  res.status(201).json({
    project,
    tasks: createdTasks,
    message: `Generated ${createdTasks.length} preliminary tasks`,
  });
}));

export default router;
