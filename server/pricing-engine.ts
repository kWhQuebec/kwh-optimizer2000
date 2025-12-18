import type { SiteVisit, Design } from "@shared/schema";

export interface PricingContext {
  siteVisit: SiteVisit | null;
  design: Design;
  pvSizeKW: number;
  batteryEnergyKWh: number;
}

export interface PricingModifier {
  category: string;
  description: string;
  descriptionFr: string;
  cost: number;
  multiplier?: number;
  condition: string;
}

export interface PricingBreakdown {
  baseCost: number;
  modifiers: PricingModifier[];
  totalModifiers: number;
  finalCost: number;
  warnings: string[];
}

const RACKING_COSTS = {
  ballast: { perKW: 150, description: "Ballasted racking system", descriptionFr: "Système de racking lesté" },
  anchored: { perKW: 200, description: "Anchored racking system", descriptionFr: "Système de racking ancré" },
  ground_mount: { perKW: 250, description: "Ground mount racking", descriptionFr: "Structure au sol" },
  carport: { perKW: 400, description: "Solar carport structure", descriptionFr: "Structure ombrière solaire" },
};

const ACCESS_COSTS = {
  ladder: { fixed: 500, description: "Ladder access - equipment crane required", descriptionFr: "Accès par échelle - grue requise" },
  stairs: { fixed: 0, description: "Stair access", descriptionFr: "Accès par escalier" },
  elevator: { fixed: 0, description: "Elevator access", descriptionFr: "Accès par ascenseur" },
  other: { fixed: 1000, description: "Special access requirements", descriptionFr: "Exigences d'accès spéciales" },
};

const BUILDING_HEIGHT_MULTIPLIERS = {
  low: { maxHeight: 10, multiplier: 1.0 },
  medium: { maxHeight: 20, multiplier: 1.05 },
  high: { maxHeight: 30, multiplier: 1.10 },
  veryHigh: { maxHeight: Infinity, multiplier: 1.15 },
};

const ELECTRICAL_UPGRADES = {
  lowVoltage: { voltage: 120, cost: 5000, description: "120V service upgrade required", descriptionFr: "Mise à niveau service 120V requise" },
  mediumVoltage: { voltage: 240, cost: 2500, description: "240V service may need upgrade", descriptionFr: "Service 240V peut nécessiter mise à niveau" },
  highVoltage: { voltage: 600, cost: 0, description: "600V service adequate", descriptionFr: "Service 600V adéquat" },
};

const SLD_COSTS = {
  mainNeeded: { cost: 2500, description: "Main SLD creation required", descriptionFr: "Création schéma unifilaire principal requise" },
  secondaryNeeded: { cost: 1500, description: "Secondary SLD creation required", descriptionFr: "Création schéma unifilaire secondaire requise" },
  mainUpdate: { cost: 1000, description: "Main SLD update required", descriptionFr: "Mise à jour schéma unifilaire principal requise" },
  secondaryUpdate: { cost: 750, description: "Secondary SLD update required", descriptionFr: "Mise à jour schéma unifilaire secondaire requise" },
};

const CABLE_RUN_COSTS = {
  perMeter: 25,
  description: "DC cable run to inverter location",
  descriptionFr: "Câblage DC vers emplacement onduleur",
};

const OBSTACLE_COSTS = {
  treeRemoval: { cost: 2000, description: "Tree trimming/removal", descriptionFr: "Taille/enlèvement d'arbres" },
  roofObstacles: { perObstacle: 500, description: "Working around roof obstacles", descriptionFr: "Travail autour des obstacles de toit" },
};

const ROOF_AGE_FACTORS = {
  new: { maxAge: 5, factor: 1.0 },
  recent: { maxAge: 10, factor: 1.0 },
  middle: { maxAge: 15, factor: 1.02 },
  aging: { maxAge: 20, factor: 1.05 },
  old: { maxAge: Infinity, factor: 1.08 },
};

export function calculatePricingFromSiteVisit(context: PricingContext): PricingBreakdown {
  const { siteVisit, design, pvSizeKW, batteryEnergyKWh } = context;
  const warnings: string[] = [];
  const modifiers: PricingModifier[] = [];
  
  // Base cost from design or calculate from system size
  const baseCost = design.totalCapex || (pvSizeKW * 2000 + batteryEnergyKWh * 600);
  
  if (!siteVisit) {
    warnings.push("No site visit data available - using default estimates");
    return {
      baseCost,
      modifiers: [],
      totalModifiers: 0,
      finalCost: baseCost,
      warnings,
    };
  }
  
  // Use anchoringMethod field, fallback to inferring from anchoringPossible
  const anchoringMethod = siteVisit.anchoringMethod || 
    (siteVisit.anchoringPossible === false ? "ballast" : "anchored");
  
  if (anchoringMethod && RACKING_COSTS[anchoringMethod as keyof typeof RACKING_COSTS]) {
    const racking = RACKING_COSTS[anchoringMethod as keyof typeof RACKING_COSTS];
    const rackingCost = racking.perKW * pvSizeKW;
    modifiers.push({
      category: "RACKING",
      description: racking.description,
      descriptionFr: racking.descriptionFr,
      cost: rackingCost,
      condition: `${anchoringMethod} installation method`,
    });
  }
  
  if (siteVisit.accessMethod && ACCESS_COSTS[siteVisit.accessMethod as keyof typeof ACCESS_COSTS]) {
    const access = ACCESS_COSTS[siteVisit.accessMethod as keyof typeof ACCESS_COSTS];
    if (access.fixed > 0) {
      modifiers.push({
        category: "ACCESS",
        description: access.description,
        descriptionFr: access.descriptionFr,
        cost: access.fixed,
        condition: `Access via ${siteVisit.accessMethod}`,
      });
    }
  }
  
  if (siteVisit.buildingHeight) {
    let heightMultiplier = 1.0;
    for (const [, config] of Object.entries(BUILDING_HEIGHT_MULTIPLIERS)) {
      if (siteVisit.buildingHeight <= config.maxHeight) {
        heightMultiplier = config.multiplier;
        break;
      }
    }
    
    if (heightMultiplier > 1.0) {
      const heightCost = baseCost * (heightMultiplier - 1);
      modifiers.push({
        category: "HEIGHT",
        description: `High building (${siteVisit.buildingHeight}m) - additional safety/logistics`,
        descriptionFr: `Bâtiment en hauteur (${siteVisit.buildingHeight}m) - sécurité/logistique additionnelle`,
        cost: heightCost,
        multiplier: heightMultiplier,
        condition: `Building height: ${siteVisit.buildingHeight}m`,
      });
    }
  }
  
  if (siteVisit.mainPanelVoltage) {
    const voltage = parseFloat(siteVisit.mainPanelVoltage.replace(/[^\d.]/g, "")) || 0;
    if (voltage > 0 && voltage < 600) {
      const upgrade = voltage <= 120 ? ELECTRICAL_UPGRADES.lowVoltage :
                      voltage <= 240 ? ELECTRICAL_UPGRADES.mediumVoltage :
                      ELECTRICAL_UPGRADES.highVoltage;
      if (upgrade.cost > 0) {
        modifiers.push({
          category: "ELECTRICAL",
          description: upgrade.description,
          descriptionFr: upgrade.descriptionFr,
          cost: upgrade.cost,
          condition: `Current voltage: ${siteVisit.mainPanelVoltage}`,
        });
      }
    }
  }
  
  if (!siteVisit.sldMainAvailable) {
    modifiers.push({
      category: "ENGINEERING",
      description: SLD_COSTS.mainNeeded.description,
      descriptionFr: SLD_COSTS.mainNeeded.descriptionFr,
      cost: SLD_COSTS.mainNeeded.cost,
      condition: "Main SLD not available",
    });
  } else if (siteVisit.sldMainNeedsUpdate) {
    modifiers.push({
      category: "ENGINEERING",
      description: SLD_COSTS.mainUpdate.description,
      descriptionFr: SLD_COSTS.mainUpdate.descriptionFr,
      cost: SLD_COSTS.mainUpdate.cost,
      condition: "Main SLD needs update",
    });
  }
  
  if (!siteVisit.sldSecondaryAvailable) {
    modifiers.push({
      category: "ENGINEERING",
      description: SLD_COSTS.secondaryNeeded.description,
      descriptionFr: SLD_COSTS.secondaryNeeded.descriptionFr,
      cost: SLD_COSTS.secondaryNeeded.cost,
      condition: "Secondary SLD not available",
    });
  } else if (siteVisit.sldSecondaryNeedsUpdate) {
    modifiers.push({
      category: "ENGINEERING",
      description: SLD_COSTS.secondaryUpdate.description,
      descriptionFr: SLD_COSTS.secondaryUpdate.descriptionFr,
      cost: SLD_COSTS.secondaryUpdate.cost,
      condition: "Secondary SLD needs update",
    });
  }
  
  if (siteVisit.technicalRoomDistance && siteVisit.technicalRoomDistance > 10) {
    const cableRun = siteVisit.technicalRoomDistance;
    const cableCost = cableRun * CABLE_RUN_COSTS.perMeter;
    modifiers.push({
      category: "CABLE",
      description: `${CABLE_RUN_COSTS.description} (${cableRun}m)`,
      descriptionFr: `${CABLE_RUN_COSTS.descriptionFr} (${cableRun}m)`,
      cost: cableCost,
      condition: `Inverter distance: ${cableRun}m`,
    });
  }
  
  if (siteVisit.treesPresent && siteVisit.treeNotes) {
    modifiers.push({
      category: "SITE_PREP",
      description: OBSTACLE_COSTS.treeRemoval.description,
      descriptionFr: OBSTACLE_COSTS.treeRemoval.descriptionFr,
      cost: OBSTACLE_COSTS.treeRemoval.cost,
      condition: `Trees present: ${siteVisit.treeNotes}`,
    });
  }
  
  if (siteVisit.hasObstacles && siteVisit.otherObstacles) {
    const obstacleCount = (siteVisit.otherObstacles.match(/,/g) || []).length + 1;
    const obstacleCost = obstacleCount * OBSTACLE_COSTS.roofObstacles.perObstacle;
    modifiers.push({
      category: "SITE_PREP",
      description: OBSTACLE_COSTS.roofObstacles.description,
      descriptionFr: OBSTACLE_COSTS.roofObstacles.descriptionFr,
      cost: obstacleCost,
      condition: `${obstacleCount} obstacle(s): ${siteVisit.otherObstacles}`,
    });
  }
  
  if (siteVisit.roofAge) {
    let ageFactor = 1.0;
    for (const [, config] of Object.entries(ROOF_AGE_FACTORS)) {
      if (siteVisit.roofAge <= config.maxAge) {
        ageFactor = config.factor;
        break;
      }
    }
    
    if (ageFactor > 1.0) {
      const ageCost = baseCost * (ageFactor - 1);
      modifiers.push({
        category: "ROOF_CONDITION",
        description: `Aging roof (${siteVisit.roofAge} years) - additional inspection/warranty`,
        descriptionFr: `Toit vieillissant (${siteVisit.roofAge} ans) - inspection/garantie additionnelle`,
        cost: ageCost,
        multiplier: ageFactor,
        condition: `Roof age: ${siteVisit.roofAge} years`,
      });
    }
    
    if (siteVisit.roofAge > 15) {
      warnings.push(`Roof is ${siteVisit.roofAge} years old - recommend roof inspection before installation`);
    }
  }
  
  if (siteVisit.lightningRodPresent) {
    modifiers.push({
      category: "ELECTRICAL",
      description: "Lightning protection integration",
      descriptionFr: "Intégration protection contre la foudre",
      cost: 1500,
      condition: "Lightning rod present on building",
    });
  }
  
  const totalModifiers = modifiers.reduce((sum, m) => sum + m.cost, 0);
  const finalCost = baseCost + totalModifiers;
  
  return {
    baseCost,
    modifiers,
    totalModifiers,
    finalCost,
    warnings,
  };
}

export function getSiteVisitCompleteness(siteVisit: SiteVisit | null): { 
  percentage: number; 
  missingFields: string[]; 
  criticalMissing: string[];
} {
  if (!siteVisit) {
    return { 
      percentage: 0, 
      missingFields: ["All fields"], 
      criticalMissing: ["Site visit not completed"] 
    };
  }
  
  const criticalFields = [
    { key: "roofType", label: "Roof type" },
    { key: "roofSurfaceAreaSqM", label: "Roof surface area" },
    { key: "buildingHeight", label: "Building height" },
    { key: "mainPanelVoltage", label: "Main panel voltage" },
    { key: "mainPanelPower", label: "Main panel power" },
    { key: "accessMethod", label: "Access method" },
  ];
  
  const importantFields = [
    { key: "roofMaterial", label: "Roof material" },
    { key: "roofAge", label: "Roof age" },
    { key: "anchoringPossible", label: "Anchoring possible" },
    { key: "technicalRoomSpace", label: "Technical room space" },
    { key: "technicalRoomDistance", label: "Inverter distance" },
    { key: "sldMainAvailable", label: "Main SLD available" },
    { key: "hasObstacles", label: "Obstacles checked" },
    { key: "treesPresent", label: "Trees checked" },
    { key: "lightningRodPresent", label: "Lightning rod checked" },
    { key: "photosTaken", label: "Photos taken" },
  ];
  
  const missingFields: string[] = [];
  const criticalMissing: string[] = [];
  
  for (const field of criticalFields) {
    const value = (siteVisit as any)[field.key];
    if (value === null || value === undefined || value === "") {
      criticalMissing.push(field.label);
      missingFields.push(field.label);
    }
  }
  
  for (const field of importantFields) {
    const value = (siteVisit as any)[field.key];
    if (value === null || value === undefined || value === "") {
      missingFields.push(field.label);
    }
  }
  
  const totalFields = criticalFields.length + importantFields.length;
  const filledFields = totalFields - missingFields.length;
  const percentage = Math.round((filledFields / totalFields) * 100);
  
  return { percentage, missingFields, criticalMissing };
}

export function estimateConstructionCost(
  pvSizeKW: number,
  batteryEnergyKWh: number,
  siteVisit: SiteVisit | null
): { 
  lowEstimate: number; 
  midEstimate: number; 
  highEstimate: number;
  confidence: "low" | "medium" | "high";
} {
  const basePVCost = pvSizeKW * 2000;
  const baseBatteryCost = batteryEnergyKWh * 600;
  const baseTotal = basePVCost + baseBatteryCost;
  
  if (!siteVisit) {
    return {
      lowEstimate: baseTotal * 0.9,
      midEstimate: baseTotal * 1.15,
      highEstimate: baseTotal * 1.4,
      confidence: "low",
    };
  }
  
  const completeness = getSiteVisitCompleteness(siteVisit);
  
  if (completeness.percentage < 50) {
    return {
      lowEstimate: baseTotal * 0.95,
      midEstimate: baseTotal * 1.12,
      highEstimate: baseTotal * 1.3,
      confidence: "low",
    };
  }
  
  if (completeness.percentage < 80) {
    return {
      lowEstimate: baseTotal * 0.98,
      midEstimate: baseTotal * 1.08,
      highEstimate: baseTotal * 1.2,
      confidence: "medium",
    };
  }
  
  return {
    lowEstimate: baseTotal * 1.0,
    midEstimate: baseTotal * 1.05,
    highEstimate: baseTotal * 1.12,
    confidence: "high",
  };
}
