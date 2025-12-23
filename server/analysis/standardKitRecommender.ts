/**
 * Module C: Standard Kit Recommender
 * 
 * Takes the optimal system size calculated by the analysis engine and
 * "snaps" it to the nearest predefined Standard Kit. This simplifies
 * sales proposals by offering standardized, pre-priced packages.
 * 
 * When the optimal size falls between kits, the recommender suggests
 * the next size up to avoid undersizing and provides comparative
 * analysis for both options.
 */

export interface StandardKit {
  id: string;
  name: string;
  nameFr: string;
  pvKW: number;
  batteryKWh: number;
  batteryKW: number;
  basePrice: number;
  pricePerWatt: number;
  targetMarket: 'small' | 'medium' | 'large' | 'industrial';
  features: string[];
  featuresFr: string[];
}

export interface KitRecommendation {
  recommendedKit: StandardKit;
  alternativeKit: StandardKit | null;
  optimalSizing: {
    pvKW: number;
    batteryKWh: number;
    batteryKW: number;
  };
  comparison: {
    oversizePercent: number;
    undersizePercent: number | null;
    priceVsCustom: number;
    customPrice: number;
  };
  reasoning: string;
  reasoningFr: string;
}

export interface KitSelectionConfig {
  preferOversizing?: boolean;
  maxOversizePercent?: number;
  includeAlternative?: boolean;
  customPricePerWatt?: number;
  customBatteryCapacityCost?: number;
  customBatteryPowerCost?: number;
}

export const STANDARD_KITS: StandardKit[] = [
  {
    id: 'kit-20-0',
    name: 'Starter 20',
    nameFr: 'Débutant 20',
    pvKW: 20,
    batteryKWh: 0,
    batteryKW: 0,
    basePrice: 45000,
    pricePerWatt: 2.25,
    targetMarket: 'small',
    features: ['Entry-level commercial', 'No storage', 'Quick installation'],
    featuresFr: ['Commercial entrée de gamme', 'Sans stockage', 'Installation rapide'],
  },
  {
    id: 'kit-30-0',
    name: 'Starter 30',
    nameFr: 'Débutant 30',
    pvKW: 30,
    batteryKWh: 0,
    batteryKW: 0,
    basePrice: 67500,
    pricePerWatt: 2.25,
    targetMarket: 'small',
    features: ['Small commercial', 'No storage', 'Quick installation'],
    featuresFr: ['Petit commercial', 'Sans stockage', 'Installation rapide'],
  },
  {
    id: 'kit-50-0',
    name: 'Business 50',
    nameFr: 'Affaires 50',
    pvKW: 50,
    batteryKWh: 0,
    batteryKW: 0,
    basePrice: 110000,
    pricePerWatt: 2.20,
    targetMarket: 'small',
    features: ['Medium commercial', 'Volume discount', 'Standard warranty'],
    featuresFr: ['Commercial moyen', 'Rabais volume', 'Garantie standard'],
  },
  {
    id: 'kit-50-50',
    name: 'Business 50 + Storage',
    nameFr: 'Affaires 50 + Stockage',
    pvKW: 50,
    batteryKWh: 50,
    batteryKW: 25,
    basePrice: 150000,
    pricePerWatt: 2.20,
    targetMarket: 'medium',
    features: ['Peak shaving ready', 'Demand charge reduction', 'Backup capable'],
    featuresFr: ['Écrêtage des pointes', 'Réduction frais de puissance', 'Secours possible'],
  },
  {
    id: 'kit-100-0',
    name: 'Pro 100',
    nameFr: 'Pro 100',
    pvKW: 100,
    batteryKWh: 0,
    batteryKW: 0,
    basePrice: 210000,
    pricePerWatt: 2.10,
    targetMarket: 'medium',
    features: ['Large commercial', 'Significant savings', 'Extended warranty'],
    featuresFr: ['Grand commercial', 'Économies importantes', 'Garantie étendue'],
  },
  {
    id: 'kit-100-100',
    name: 'Pro 100 + Storage',
    nameFr: 'Pro 100 + Stockage',
    pvKW: 100,
    batteryKWh: 100,
    batteryKW: 50,
    basePrice: 290000,
    pricePerWatt: 2.10,
    targetMarket: 'medium',
    features: ['Full peak shaving', 'Rate M optimized', 'Premium support'],
    featuresFr: ['Écrêtage complet', 'Optimisé Tarif M', 'Support premium'],
  },
  {
    id: 'kit-250-0',
    name: 'Industrial 250',
    nameFr: 'Industriel 250',
    pvKW: 250,
    batteryKWh: 0,
    batteryKW: 0,
    basePrice: 500000,
    pricePerWatt: 2.15,
    targetMarket: 'large',
    features: ['Industrial scale', 'Major energy offset', 'Project management included'],
    featuresFr: ['Échelle industrielle', 'Compensation énergétique majeure', 'Gestion de projet incluse'],
  },
  {
    id: 'kit-250-250',
    name: 'Industrial 250 + Storage',
    nameFr: 'Industriel 250 + Stockage',
    pvKW: 250,
    batteryKWh: 250,
    batteryKW: 125,
    basePrice: 700000,
    pricePerWatt: 2.15,
    targetMarket: 'large',
    features: ['Full industrial', 'Maximum demand reduction', 'Turnkey solution'],
    featuresFr: ['Industriel complet', 'Réduction de puissance maximale', 'Solution clé en main'],
  },
  {
    id: 'kit-500-0',
    name: 'Mega 500',
    nameFr: 'Méga 500',
    pvKW: 500,
    batteryKWh: 0,
    batteryKW: 0,
    basePrice: 950000,
    pricePerWatt: 1.90,
    targetMarket: 'industrial',
    features: ['Utility scale', 'Corporate PPA ready', 'Full EPC service'],
    featuresFr: ['Échelle utilitaire', 'Prêt pour AAE corporatif', 'Service EPC complet'],
  },
  {
    id: 'kit-500-500',
    name: 'Mega 500 + Storage',
    nameFr: 'Méga 500 + Stockage',
    pvKW: 500,
    batteryKWh: 500,
    batteryKW: 250,
    basePrice: 1350000,
    pricePerWatt: 1.90,
    targetMarket: 'industrial',
    features: ['Maximum scale', 'Grid services ready', 'Dedicated account team'],
    featuresFr: ['Échelle maximale', 'Prêt services réseau', 'Équipe dédiée'],
  },
  {
    id: 'kit-1000-0',
    name: 'Enterprise 1MW',
    nameFr: 'Entreprise 1MW',
    pvKW: 1000,
    batteryKWh: 0,
    batteryKW: 0,
    basePrice: 1800000,
    pricePerWatt: 1.80,
    targetMarket: 'industrial',
    features: ['Megawatt class', 'Net metering limit', 'Multi-year financing'],
    featuresFr: ['Classe mégawatt', 'Limite mesurage net', 'Financement pluriannuel'],
  },
];

function calculateCustomPrice(
  pvKW: number,
  batteryKWh: number,
  batteryKW: number,
  config: KitSelectionConfig
): number {
  const solarCostPerW = config.customPricePerWatt || 2.25;
  const batteryCapacityCost = config.customBatteryCapacityCost || 550;
  const batteryPowerCost = config.customBatteryPowerCost || 800;
  
  const solarCost = pvKW * 1000 * solarCostPerW;
  const batteryCost = (batteryKWh * batteryCapacityCost) + (batteryKW * batteryPowerCost);
  
  return solarCost + batteryCost;
}

export function recommendStandardKit(
  optimalPvKW: number,
  optimalBatteryKWh: number = 0,
  optimalBatteryKW: number = 0,
  config: KitSelectionConfig = {}
): KitRecommendation {
  const {
    preferOversizing = true,
    maxOversizePercent = 30,
    includeAlternative = true,
  } = config;

  const needsBattery = optimalBatteryKWh > 0 || optimalBatteryKW > 0;
  
  const relevantKits = needsBattery
    ? STANDARD_KITS.filter(k => k.batteryKWh > 0)
    : STANDARD_KITS;
  
  const sortedKits = [...relevantKits].sort((a, b) => a.pvKW - b.pvKW);
  
  let recommendedKit: StandardKit | undefined;
  let alternativeKit: StandardKit | null = null;
  
  if (preferOversizing) {
    recommendedKit = sortedKits.find(kit => kit.pvKW >= optimalPvKW);
    
    if (!recommendedKit) {
      recommendedKit = sortedKits[sortedKits.length - 1];
    }
    
    if (includeAlternative) {
      const currentIndex = sortedKits.indexOf(recommendedKit);
      if (currentIndex > 0) {
        alternativeKit = sortedKits[currentIndex - 1];
      }
    }
  } else {
    let closestKit = sortedKits[0];
    let minDiff = Math.abs(sortedKits[0].pvKW - optimalPvKW);
    
    for (const kit of sortedKits) {
      const diff = Math.abs(kit.pvKW - optimalPvKW);
      if (diff < minDiff) {
        minDiff = diff;
        closestKit = kit;
      }
    }
    
    recommendedKit = closestKit;
  }
  
  const oversizePercent = ((recommendedKit.pvKW / optimalPvKW) - 1) * 100;
  const undersizePercent = alternativeKit 
    ? ((1 - alternativeKit.pvKW / optimalPvKW)) * 100 
    : null;
  
  const customPrice = calculateCustomPrice(optimalPvKW, optimalBatteryKWh, optimalBatteryKW, config);
  const priceVsCustom = recommendedKit.basePrice - customPrice;
  
  let reasoning: string;
  let reasoningFr: string;
  
  if (oversizePercent <= 5) {
    reasoning = `The ${recommendedKit.name} kit is an excellent match, only ${oversizePercent.toFixed(0)}% larger than the optimal size.`;
    reasoningFr = `Le kit ${recommendedKit.nameFr} est un excellent choix, seulement ${oversizePercent.toFixed(0)}% plus grand que la taille optimale.`;
  } else if (oversizePercent <= maxOversizePercent) {
    reasoning = `The ${recommendedKit.name} kit is ${oversizePercent.toFixed(0)}% larger than optimal, providing room for future load growth.`;
    reasoningFr = `Le kit ${recommendedKit.nameFr} est ${oversizePercent.toFixed(0)}% plus grand que l'optimal, permettant une croissance future.`;
  } else {
    reasoning = `The ${recommendedKit.name} kit is significantly larger (${oversizePercent.toFixed(0)}%) than optimal. Consider a custom solution.`;
    reasoningFr = `Le kit ${recommendedKit.nameFr} est significativement plus grand (${oversizePercent.toFixed(0)}%) que l'optimal. Considérez une solution sur mesure.`;
  }
  
  return {
    recommendedKit,
    alternativeKit,
    optimalSizing: {
      pvKW: optimalPvKW,
      batteryKWh: optimalBatteryKWh,
      batteryKW: optimalBatteryKW,
    },
    comparison: {
      oversizePercent,
      undersizePercent,
      priceVsCustom,
      customPrice,
    },
    reasoning,
    reasoningFr,
  };
}

export function getKitById(kitId: string): StandardKit | undefined {
  return STANDARD_KITS.find(k => k.id === kitId);
}

export function getKitsForMarket(market: StandardKit['targetMarket']): StandardKit[] {
  return STANDARD_KITS.filter(k => k.targetMarket === market);
}

export function getKitsInRange(minKW: number, maxKW: number): StandardKit[] {
  return STANDARD_KITS.filter(k => k.pvKW >= minKW && k.pvKW <= maxKW);
}
