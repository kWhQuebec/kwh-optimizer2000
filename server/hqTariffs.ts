// Hydro-Québec Tariffs - Effective April 1, 2025
// Reference: Grille des tarifs d'électricité 2025

export interface HQTariff {
  code: string;
  name: { fr: string; en: string };
  description: { fr: string; en: string };
  applicability: { fr: string; en: string };
  minDemandKW?: number;
  maxDemandKW?: number;
  accessFee: {
    type: "daily" | "monthly";
    amount: number; // $ or ¢ depending on type
  };
  powerPremium?: {
    perKW: number; // $/kW
    thresholdKW?: number; // Only charged above this threshold
  };
  energyRates: Array<{
    tier: number;
    thresholdKWh?: number; // Per month or per day
    thresholdType?: "monthly" | "daily";
    rate: number; // $/kWh
  }>;
  minimumMonthly?: {
    singlePhase: number;
    threePhase: number;
  };
}

// Official HQ Tariffs 2025
export const HQ_TARIFFS: Record<string, HQTariff> = {
  D: {
    code: "D",
    name: { fr: "Tarif D (Domestique)", en: "Rate D (Domestic)" },
    description: { 
      fr: "Tarif résidentiel standard", 
      en: "Standard residential rate" 
    },
    applicability: { 
      fr: "Logements résidentiels", 
      en: "Residential dwellings" 
    },
    maxDemandKW: 50,
    accessFee: { type: "daily", amount: 0.46154 }, // 46.154¢/day
    energyRates: [
      { tier: 1, thresholdKWh: 40, thresholdType: "daily", rate: 0.06905 }, // 6.905¢/kWh
      { tier: 2, rate: 0.10652 }, // 10.652¢/kWh for rest
    ],
  },

  G: {
    code: "G",
    name: { fr: "Tarif G (Petite puissance)", en: "Rate G (Small Power)" },
    description: { 
      fr: "Commercial/Industriel - Petite puissance", 
      en: "Commercial/Industrial - Small Power" 
    },
    applicability: { 
      fr: "Demande < 65 kW", 
      en: "Demand < 65 kW" 
    },
    maxDemandKW: 65,
    accessFee: { type: "monthly", amount: 14.86 }, // $14.86/month
    powerPremium: { perKW: 21.261, thresholdKW: 50 }, // $21.261/kW above 50 kW
    energyRates: [
      { tier: 1, thresholdKWh: 15090, thresholdType: "monthly", rate: 0.11933 }, // 11.933¢/kWh
      { tier: 2, rate: 0.09184 }, // 9.184¢/kWh for rest
    ],
    minimumMonthly: { singlePhase: 14.86, threePhase: 44.58 },
  },

  M: {
    code: "M",
    name: { fr: "Tarif M (Moyenne puissance)", en: "Rate M (Medium Power)" },
    description: { 
      fr: "Commercial/Industriel - Moyenne puissance", 
      en: "Commercial/Industrial - Medium Power" 
    },
    applicability: { 
      fr: "Demande 65 kW - 5 MW", 
      en: "Demand 65 kW - 5 MW" 
    },
    minDemandKW: 65,
    maxDemandKW: 5000,
    accessFee: { type: "monthly", amount: 0 }, // No separate access fee
    powerPremium: { perKW: 17.573 }, // $17.573/kW (all power billed)
    energyRates: [
      { tier: 1, thresholdKWh: 210000, thresholdType: "monthly", rate: 0.06061 }, // 6.061¢/kWh
      { tier: 2, rate: 0.04495 }, // 4.495¢/kWh for rest
    ],
    minimumMonthly: { singlePhase: 14.86, threePhase: 44.58 },
  },

  L: {
    code: "L",
    name: { fr: "Tarif L (Grande puissance)", en: "Rate L (Large Power)" },
    description: { 
      fr: "Grande puissance industrielle", 
      en: "Large industrial power" 
    },
    applicability: { 
      fr: "Demande > 5 MW", 
      en: "Demand > 5 MW" 
    },
    minDemandKW: 5000,
    accessFee: { type: "monthly", amount: 0 },
    powerPremium: { perKW: 14.476 }, // $14.476/kW
    energyRates: [
      { tier: 1, rate: 0.03681 }, // 3.681¢/kWh (flat rate)
    ],
  },

  G9: {
    code: "G9",
    name: { fr: "Tarif G9", en: "Rate G9" },
    description: { 
      fr: "Tarif pour usage général (sans écrêtage)", 
      en: "General rate (without demand shaving)" 
    },
    applicability: { 
      fr: "Clients moyens sans gestion de pointe", 
      en: "Medium clients without peak management" 
    },
    minDemandKW: 65,
    maxDemandKW: 5000,
    accessFee: { type: "monthly", amount: 0 },
    powerPremium: { perKW: 5.098 }, // $5.098/kW
    energyRates: [
      { tier: 1, rate: 0.12148 }, // 12.148¢/kWh (flat rate)
    ],
    minimumMonthly: { singlePhase: 14.86, threePhase: 44.58 },
  },

  GD: {
    code: "GD",
    name: { fr: "Tarif GD", en: "Rate GD" },
    description: { 
      fr: "Tarif à double composante", 
      en: "Dual component rate" 
    },
    applicability: { 
      fr: "Clients moyens avec facturation saisonnière", 
      en: "Medium clients with seasonal billing" 
    },
    minDemandKW: 65,
    maxDemandKW: 5000,
    accessFee: { type: "monthly", amount: 0 },
    powerPremium: { perKW: 6.39 }, // $6.39/kW
    energyRates: [
      { tier: 1, rate: 0.0753 }, // 7.53¢/kWh summer
      // Note: Winter rate is 18.655¢/kWh - would need seasonal handling
    ],
    minimumMonthly: { singlePhase: 14.86, threePhase: 44.58 },
  },

  BR: {
    code: "BR",
    name: { fr: "Tarif BR (Biénergie)", en: "Rate BR (Dual-energy)" },
    description: { 
      fr: "Biénergie pour systèmes de chauffage", 
      en: "Dual-energy for heating systems" 
    },
    applicability: { 
      fr: "Clients avec système biénergie", 
      en: "Clients with dual-energy systems" 
    },
    accessFee: { type: "monthly", amount: 0 },
    energyRates: [
      { tier: 1, thresholdKWh: 50, thresholdType: "daily", rate: 0.127 }, // First 50 kW
      { tier: 2, rate: 0.24574 }, // Excess
      { tier: 3, rate: 0.16837 }, // Rest
    ],
    minimumMonthly: { singlePhase: 14.86, threePhase: 44.58 },
  },
};

// Flex tariffs (time-of-use with peak events)
export const HQ_FLEX_TARIFFS: Record<string, HQTariff & { peakEventRate: number }> = {
  "Flex D": {
    code: "Flex D",
    name: { fr: "Tarif Flex D", en: "Flex D Rate" },
    description: { 
      fr: "Tarif domestique dynamique avec événements de pointe", 
      en: "Dynamic domestic rate with peak events" 
    },
    applicability: { 
      fr: "Résidentiel avec gestion de pointe", 
      en: "Residential with peak management" 
    },
    accessFee: { type: "daily", amount: 0.46154 },
    energyRates: [
      { tier: 1, thresholdKWh: 40, thresholdType: "daily", rate: 0.04774 }, // Winter off-peak
      { tier: 2, rate: 0.08699 }, // Winter off-peak rest
    ],
    peakEventRate: 0.45088, // 45.088¢/kWh during peak events
  },

  "Flex G": {
    code: "Flex G",
    name: { fr: "Tarif Flex G", en: "Flex G Rate" },
    description: { 
      fr: "Tarif commercial dynamique avec événements de pointe", 
      en: "Dynamic commercial rate with peak events" 
    },
    applicability: { 
      fr: "Commercial avec gestion de pointe", 
      en: "Commercial with peak management" 
    },
    accessFee: { type: "monthly", amount: 14.86 },
    energyRates: [
      { tier: 1, rate: 0.098 }, // Winter off-peak: 9.8¢/kWh
    ],
    peakEventRate: 0.54442, // 54.442¢/kWh during peak events
    minimumMonthly: { singlePhase: 14.86, threePhase: 44.58 },
  },

  "Flex M": {
    code: "Flex M",
    name: { fr: "Tarif Flex M", en: "Flex M Rate" },
    description: { 
      fr: "Tarif moyenne puissance dynamique", 
      en: "Dynamic medium power rate" 
    },
    applicability: { 
      fr: "Moyenne puissance avec gestion de pointe", 
      en: "Medium power with peak management" 
    },
    minDemandKW: 65,
    maxDemandKW: 5000,
    accessFee: { type: "monthly", amount: 0 },
    powerPremium: { perKW: 17.573 },
    energyRates: [
      { tier: 1, rate: 0.0382 }, // Winter off-peak: 3.82¢/kWh
    ],
    peakEventRate: 0.60262, // 60.262¢/kWh during peak events
    minimumMonthly: { singlePhase: 14.86, threePhase: 44.58 },
  },
};

export interface TariffDetectionResult {
  detectedTariff: string;
  confidence: "high" | "medium" | "low";
  reason: { fr: string; en: string };
  suggestedTariffs: string[];
  metrics: {
    peakDemandKW: number;
    annualConsumptionKWh: number;
    loadFactor: number;
  };
}

// Detect tariff based on consumption data
export function detectTariff(
  peakDemandKW: number,
  annualConsumptionKWh: number,
  hasPowerColumn: boolean
): TariffDetectionResult {
  const monthlyConsumption = annualConsumptionKWh / 12;
  const loadFactor = monthlyConsumption / (peakDemandKW * 730); // 730 hours/month avg

  // Determine tariff based on peak demand thresholds
  let detectedTariff: string;
  let confidence: "high" | "medium" | "low";
  let reason: { fr: string; en: string };
  let suggestedTariffs: string[] = [];

  if (!hasPowerColumn || peakDemandKW < 10) {
    // No power data or very low demand - likely residential
    detectedTariff = "D";
    confidence = hasPowerColumn ? "high" : "medium";
    reason = {
      fr: hasPowerColumn 
        ? `Demande de pointe < 10 kW indique usage résidentiel`
        : `Absence de données de puissance suggère tarif résidentiel`,
      en: hasPowerColumn
        ? `Peak demand < 10 kW indicates residential use`
        : `No power data suggests residential rate`,
    };
    suggestedTariffs = ["D", "Flex D"];
  } else if (peakDemandKW < 65) {
    // Small power
    detectedTariff = "G";
    confidence = "high";
    reason = {
      fr: `Demande de pointe de ${peakDemandKW.toFixed(0)} kW < 65 kW`,
      en: `Peak demand of ${peakDemandKW.toFixed(0)} kW < 65 kW`,
    };
    suggestedTariffs = ["G", "Flex G"];
  } else if (peakDemandKW < 5000) {
    // Medium power - could be M, G9, or GD
    detectedTariff = "M";
    confidence = "high";
    reason = {
      fr: `Demande de pointe de ${peakDemandKW.toFixed(0)} kW entre 65 kW et 5 MW`,
      en: `Peak demand of ${peakDemandKW.toFixed(0)} kW between 65 kW and 5 MW`,
    };
    
    // Suggest G9 if load factor is very low (intermittent usage)
    if (loadFactor < 0.3) {
      suggestedTariffs = ["G9", "M", "Flex M"];
    } else {
      suggestedTariffs = ["M", "Flex M", "G9"];
    }
  } else {
    // Large power
    detectedTariff = "L";
    confidence = "high";
    reason = {
      fr: `Demande de pointe de ${(peakDemandKW / 1000).toFixed(1)} MW > 5 MW`,
      en: `Peak demand of ${(peakDemandKW / 1000).toFixed(1)} MW > 5 MW`,
    };
    suggestedTariffs = ["L"];
  }

  return {
    detectedTariff,
    confidence,
    reason,
    suggestedTariffs,
    metrics: {
      peakDemandKW,
      annualConsumptionKWh,
      loadFactor,
    },
  };
}

// Calculate monthly cost based on tariff
export function calculateMonthlyCost(
  tariff: HQTariff,
  monthlyConsumptionKWh: number,
  peakDemandKW: number,
  isThreePhase: boolean = true
): {
  accessFee: number;
  powerCharge: number;
  energyCharge: number;
  total: number;
} {
  // Access fee
  let accessFee = 0;
  if (tariff.accessFee.type === "daily") {
    accessFee = tariff.accessFee.amount * 30; // 30 days average
  } else {
    accessFee = tariff.accessFee.amount;
  }

  // Power charge
  let powerCharge = 0;
  if (tariff.powerPremium) {
    const billablePower = tariff.powerPremium.thresholdKW
      ? Math.max(0, peakDemandKW - tariff.powerPremium.thresholdKW)
      : peakDemandKW;
    powerCharge = billablePower * tariff.powerPremium.perKW;
  }

  // Energy charge (tiered)
  let energyCharge = 0;
  let remainingKWh = monthlyConsumptionKWh;

  for (const rate of tariff.energyRates) {
    if (rate.thresholdKWh && rate.thresholdType) {
      const tierLimit = rate.thresholdType === "daily" 
        ? rate.thresholdKWh * 30 
        : rate.thresholdKWh;
      
      const tierConsumption = Math.min(remainingKWh, tierLimit);
      energyCharge += tierConsumption * rate.rate;
      remainingKWh -= tierConsumption;
    } else {
      // Last tier - all remaining consumption
      energyCharge += remainingKWh * rate.rate;
      remainingKWh = 0;
    }

    if (remainingKWh <= 0) break;
  }

  // Apply minimum if applicable
  let total = accessFee + powerCharge + energyCharge;
  if (tariff.minimumMonthly) {
    const minimum = isThreePhase 
      ? tariff.minimumMonthly.threePhase 
      : tariff.minimumMonthly.singlePhase;
    total = Math.max(total, minimum);
  }

  return {
    accessFee,
    powerCharge,
    energyCharge,
    total,
  };
}

// Calculate annual cost with all components
export function calculateAnnualCost(
  tariffCode: string,
  annualConsumptionKWh: number,
  peakDemandKW: number,
  isThreePhase: boolean = true
): {
  tariff: HQTariff;
  monthlyBreakdown: Array<{
    month: number;
    accessFee: number;
    powerCharge: number;
    energyCharge: number;
    total: number;
  }>;
  annualTotal: number;
  averageRate: number; // $/kWh effective rate
} {
  const tariff = HQ_TARIFFS[tariffCode];
  if (!tariff) {
    throw new Error(`Unknown tariff code: ${tariffCode}`);
  }

  const monthlyConsumption = annualConsumptionKWh / 12;
  const monthlyBreakdown = [];
  let annualTotal = 0;

  for (let month = 1; month <= 12; month++) {
    const monthCost = calculateMonthlyCost(
      tariff,
      monthlyConsumption,
      peakDemandKW,
      isThreePhase
    );
    monthlyBreakdown.push({ month, ...monthCost });
    annualTotal += monthCost.total;
  }

  return {
    tariff,
    monthlyBreakdown,
    annualTotal,
    averageRate: annualConsumptionKWh > 0 ? annualTotal / annualConsumptionKWh : 0,
  };
}

// Get simplified tariff rates for analysis (weighted average)
export function getSimplifiedRates(tariffCode: string): {
  energyRate: number; // $/kWh
  demandRate: number; // $/kW/month
} {
  const tariff = HQ_TARIFFS[tariffCode];
  if (!tariff) {
    // Default to Tarif M rates
    return { energyRate: 0.057, demandRate: 17.57 };
  }

  // Calculate weighted average energy rate
  // For simplicity, use the first tier rate (most consumption is in first tier)
  const energyRate = tariff.energyRates[0]?.rate || 0.057;
  const demandRate = tariff.powerPremium?.perKW || 0;

  return { energyRate, demandRate };
}
