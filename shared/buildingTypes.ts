export type BuildingTypeKey =
  | 'office'
  | 'retail'
  | 'hotel'
  | 'restaurant'
  | 'warehouse'
  | 'cold_warehouse'
  | 'industrial'
  | 'light_industrial'
  | 'healthcare'
  | 'education'
  | 'government'
  | 'agricultural';

export type BuildingCategory = 'commercial' | 'industrial' | 'institutional' | 'agricultural';

export interface BuildingTypeDefinition {
  key: BuildingTypeKey;
  cubfRange: string;
  category: BuildingCategory;
  labelFr: string;
  labelEn: string;
  iconName: string;
  intensityKwhPerSqFt: number;
  operatingStart: number;
  operatingEnd: number;
  baseNight: number;
  weekendFactor: number;
  loadFactor: number;
  monthlyFactors: number[];
  benchmark: {
    energyIntensity: { average: number; top25: number; bottom25: number };
    solarAdoption: number;
    avgPayback: number;
  };
}

export const BUILDING_TYPES_REGISTRY: Record<BuildingTypeKey, BuildingTypeDefinition> = {
  office: {
    key: 'office',
    cubfRange: '2100',
    category: 'commercial',
    labelFr: 'Bureau',
    labelEn: 'Office',
    iconName: 'Briefcase',
    intensityKwhPerSqFt: 18,
    operatingStart: 7, operatingEnd: 19,
    baseNight: 0.30, weekendFactor: 0.25, loadFactor: 0.45,
    monthlyFactors: [1.0, 1.0, 1.0, 0.95, 0.9, 0.85, 0.8, 0.85, 0.95, 1.0, 1.05, 1.1],
    benchmark: {
      energyIntensity: { average: 285, top25: 210, bottom25: 380 },
      solarAdoption: 12,
      avgPayback: 5.2,
    },
  },
  retail: {
    key: 'retail',
    cubfRange: '2300',
    category: 'commercial',
    labelFr: 'Commerce',
    labelEn: 'Retail',
    iconName: 'Store',
    intensityKwhPerSqFt: 22,
    operatingStart: 9, operatingEnd: 21,
    baseNight: 0.20, weekendFactor: 0.85, loadFactor: 0.40,
    monthlyFactors: [1.15, 1.0, 0.95, 0.9, 0.85, 0.8, 0.85, 0.9, 0.95, 1.0, 1.15, 1.4],
    benchmark: {
      energyIntensity: { average: 340, top25: 250, bottom25: 450 },
      solarAdoption: 8,
      avgPayback: 5.8,
    },
  },
  hotel: {
    key: 'hotel',
    cubfRange: '2500',
    category: 'commercial',
    labelFr: 'Hôtel',
    labelEn: 'Hotel',
    iconName: 'Hotel',
    intensityKwhPerSqFt: 25,
    operatingStart: 0, operatingEnd: 24,
    baseNight: 0.60, weekendFactor: 0.95, loadFactor: 0.55,
    monthlyFactors: [1.05, 1.0, 0.95, 0.90, 0.85, 0.95, 1.05, 1.10, 1.0, 0.95, 1.0, 1.1],
    benchmark: {
      energyIntensity: { average: 380, top25: 280, bottom25: 490 },
      solarAdoption: 6,
      avgPayback: 5.5,
    },
  },
  restaurant: {
    key: 'restaurant',
    cubfRange: '2600',
    category: 'commercial',
    labelFr: 'Restaurant',
    labelEn: 'Restaurant',
    iconName: 'UtensilsCrossed',
    intensityKwhPerSqFt: 35,
    operatingStart: 8, operatingEnd: 23,
    baseNight: 0.15, weekendFactor: 1.0, loadFactor: 0.35,
    monthlyFactors: [1.0, 1.0, 1.0, 0.95, 0.90, 0.95, 1.05, 1.05, 1.0, 1.0, 1.0, 1.05],
    benchmark: {
      energyIntensity: { average: 510, top25: 380, bottom25: 680 },
      solarAdoption: 3,
      avgPayback: 6.8,
    },
  },
  warehouse: {
    key: 'warehouse',
    cubfRange: '3400',
    category: 'industrial',
    labelFr: 'Entrepôt',
    labelEn: 'Warehouse',
    iconName: 'Warehouse',
    intensityKwhPerSqFt: 10,
    operatingStart: 6, operatingEnd: 22,
    baseNight: 0.60, weekendFactor: 0.50, loadFactor: 0.65,
    monthlyFactors: [0.95, 0.95, 1.0, 1.0, 1.0, 1.05, 1.1, 1.1, 1.0, 1.0, 0.95, 0.9],
    benchmark: {
      energyIntensity: { average: 145, top25: 95, bottom25: 210 },
      solarAdoption: 28,
      avgPayback: 3.8,
    },
  },
  cold_warehouse: {
    key: 'cold_warehouse',
    cubfRange: '3400',
    category: 'industrial',
    labelFr: 'Entrepôt réfrigéré',
    labelEn: 'Cold Warehouse',
    iconName: 'Snowflake',
    intensityKwhPerSqFt: 30,
    operatingStart: 0, operatingEnd: 24,
    baseNight: 0.85, weekendFactor: 0.95, loadFactor: 0.75,
    monthlyFactors: [0.85, 0.85, 0.90, 0.95, 1.05, 1.15, 1.25, 1.25, 1.10, 0.95, 0.85, 0.85],
    benchmark: {
      energyIntensity: { average: 200, top25: 140, bottom25: 280 },
      solarAdoption: 25,
      avgPayback: 4.0,
    },
  },
  industrial: {
    key: 'industrial',
    cubfRange: '3000',
    category: 'industrial',
    labelFr: 'Industriel',
    labelEn: 'Industrial',
    iconName: 'Factory',
    intensityKwhPerSqFt: 15,
    operatingStart: 0, operatingEnd: 24,
    baseNight: 0.80, weekendFactor: 0.75, loadFactor: 0.70,
    monthlyFactors: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    benchmark: {
      energyIntensity: { average: 230, top25: 160, bottom25: 320 },
      solarAdoption: 22,
      avgPayback: 4.1,
    },
  },
  light_industrial: {
    key: 'light_industrial',
    cubfRange: '3100',
    category: 'industrial',
    labelFr: 'Industriel léger',
    labelEn: 'Light Industrial',
    iconName: 'Wrench',
    intensityKwhPerSqFt: 14,
    operatingStart: 7, operatingEnd: 20,
    baseNight: 0.40, weekendFactor: 0.30, loadFactor: 0.55,
    monthlyFactors: [1.0, 1.0, 1.0, 0.97, 0.95, 0.92, 0.9, 0.92, 0.97, 1.0, 1.03, 1.05],
    benchmark: {
      energyIntensity: { average: 200, top25: 140, bottom25: 280 },
      solarAdoption: 20,
      avgPayback: 4.3,
    },
  },
  healthcare: {
    key: 'healthcare',
    cubfRange: '4300',
    category: 'institutional',
    labelFr: 'Santé',
    labelEn: 'Healthcare',
    iconName: 'Heart',
    intensityKwhPerSqFt: 28,
    operatingStart: 0, operatingEnd: 24,
    baseNight: 0.65, weekendFactor: 0.90, loadFactor: 0.60,
    monthlyFactors: [1.0, 1.0, 1.0, 0.95, 0.9, 0.95, 1.0, 1.0, 0.95, 1.0, 1.05, 1.1],
    benchmark: {
      energyIntensity: { average: 420, top25: 310, bottom25: 550 },
      solarAdoption: 5,
      avgPayback: 6.2,
    },
  },
  education: {
    key: 'education',
    cubfRange: '4100',
    category: 'institutional',
    labelFr: 'Éducation',
    labelEn: 'Education',
    iconName: 'GraduationCap',
    intensityKwhPerSqFt: 20,
    operatingStart: 7, operatingEnd: 17,
    baseNight: 0.25, weekendFactor: 0.20, loadFactor: 0.40,
    monthlyFactors: [1.1, 1.1, 1.0, 0.9, 0.7, 0.5, 0.4, 0.5, 1.0, 1.1, 1.1, 1.2],
    benchmark: {
      energyIntensity: { average: 195, top25: 140, bottom25: 270 },
      solarAdoption: 15,
      avgPayback: 4.8,
    },
  },
  government: {
    key: 'government',
    cubfRange: '4200',
    category: 'institutional',
    labelFr: 'Gouvernement / Municipal',
    labelEn: 'Government / Municipal',
    iconName: 'Landmark',
    intensityKwhPerSqFt: 19,
    operatingStart: 8, operatingEnd: 17,
    baseNight: 0.25, weekendFactor: 0.15, loadFactor: 0.42,
    monthlyFactors: [1.1, 1.05, 1.0, 0.95, 0.85, 0.75, 0.7, 0.75, 0.95, 1.05, 1.1, 1.15],
    benchmark: {
      energyIntensity: { average: 250, top25: 180, bottom25: 340 },
      solarAdoption: 10,
      avgPayback: 5.0,
    },
  },
  agricultural: {
    key: 'agricultural',
    cubfRange: '5000',
    category: 'agricultural',
    labelFr: 'Agricole',
    labelEn: 'Agricultural',
    iconName: 'Tractor',
    intensityKwhPerSqFt: 8,
    operatingStart: 5, operatingEnd: 21,
    baseNight: 0.30, weekendFactor: 0.80, loadFactor: 0.50,
    monthlyFactors: [0.85, 0.85, 0.90, 1.0, 1.1, 1.15, 1.2, 1.15, 1.05, 0.95, 0.90, 0.85],
    benchmark: {
      energyIntensity: { average: 120, top25: 80, bottom25: 180 },
      solarAdoption: 18,
      avgPayback: 4.5,
    },
  },
};

const LEGACY_ALIASES: Record<string, BuildingTypeKey> = {
  commercial: 'retail',
  institutional: 'education',
  other: 'office',
};

export const CATEGORY_LABELS: Record<BuildingCategory, { fr: string; en: string }> = {
  commercial: { fr: 'Commercial', en: 'Commercial' },
  industrial: { fr: 'Industriel', en: 'Industrial' },
  institutional: { fr: 'Institutionnel', en: 'Institutional' },
  agricultural: { fr: 'Agricole', en: 'Agricultural' },
};

const CATEGORY_ORDER: BuildingCategory[] = ['commercial', 'industrial', 'institutional', 'agricultural'];

export function getBuildingTypeByKey(key: string): BuildingTypeDefinition {
  const resolved = LEGACY_ALIASES[key] || key;
  return BUILDING_TYPES_REGISTRY[resolved as BuildingTypeKey] || BUILDING_TYPES_REGISTRY.office;
}

export function getBuildingTypeLabel(key: string, lang: 'fr' | 'en'): string {
  const def = getBuildingTypeByKey(key);
  return lang === 'fr' ? def.labelFr : def.labelEn;
}

export function getAllBuildingTypes(): BuildingTypeDefinition[] {
  return Object.values(BUILDING_TYPES_REGISTRY);
}

export function getBuildingTypesByCategory(): Array<{
  category: BuildingCategory;
  labelFr: string;
  labelEn: string;
  types: BuildingTypeDefinition[];
}> {
  return CATEGORY_ORDER.map(cat => ({
    category: cat,
    labelFr: CATEGORY_LABELS[cat].fr,
    labelEn: CATEGORY_LABELS[cat].en,
    types: Object.values(BUILDING_TYPES_REGISTRY).filter(t => t.category === cat),
  }));
}

export function getCubfCategory(cubfCode: string): BuildingTypeKey | null {
  const code = parseInt(cubfCode, 10);
  if (isNaN(code)) return null;

  if (code >= 2100 && code < 2300) return 'office';
  if (code >= 2300 && code < 2500) return 'retail';
  if (code >= 2500 && code < 2600) return 'hotel';
  if (code >= 2600 && code < 3000) return 'restaurant';
  if (code >= 3000 && code < 3100) return 'industrial';
  if (code >= 3100 && code < 3400) return 'light_industrial';
  if (code >= 3400 && code < 4000) return 'warehouse';
  if (code >= 4100 && code < 4200) return 'education';
  if (code >= 4200 && code < 4300) return 'government';
  if (code >= 4300 && code < 5000) return 'healthcare';
  if (code >= 5000 && code < 6000) return 'agricultural';

  return null;
}

export function resolveBuildingTypeKey(key: string): BuildingTypeKey {
  if (key in BUILDING_TYPES_REGISTRY) return key as BuildingTypeKey;
  if (key in LEGACY_ALIASES) return LEGACY_ALIASES[key];
  return 'office';
}

export function getArchetypeParams(key: string) {
  const def = getBuildingTypeByKey(key);
  return {
    operatingStart: def.operatingStart,
    operatingEnd: def.operatingEnd,
    baseNight: def.baseNight,
    weekendFactor: def.weekendFactor,
    loadFactor: def.loadFactor,
    intensityKwhPerSqFt: def.intensityKwhPerSqFt,
  };
}

export function getMonthlyFactors(key: string): number[] {
  const def = getBuildingTypeByKey(key);
  return def.monthlyFactors;
}
