/**
 * KB Racking Cost Estimator
 * Based on validated pricing data from 18 real projects (~40 MW)
 * Product: AeroGrid 10° Landscape with Jinko 625W bifacial panels
 */

// ═══════════════════════════════════════════════════════════════════════════════
// KB RACKING VALIDATED PRICING CURVE
// Validated across 18 projects (1,354 to 14,185 panels)
// ═══════════════════════════════════════════════════════════════════════════════

export interface KBRackingEstimate {
  panelCount: number;
  kwDc: number;
  pricePerPanel: number;
  rackingSubtotal: number;
  shippingEstimate: number;
  engineeringCost: number;
  totalEstimate: number;
  pricingTier: string;
  confidenceLevel: 'high' | 'medium' | 'low';
}

export interface KBRackingSpecs {
  panelPowerW: number;
  panelLengthMm: number;
  panelWidthMm: number;
  panelThicknessMm: number;
  panelWeightKg: number;
  rackingWeightKgPerPanel: number;
  tiltDeg: number;
  rowSpacingM: number;
  interRowSpacingM: number;
  setbackM: number;
  systemName: string;
}

// KB Racking standard specs (validated from engineering drawings)
export const KB_RACKING_SPECS: KBRackingSpecs = {
  panelPowerW: 625,
  panelLengthMm: 2382,
  panelWidthMm: 1134,
  panelThicknessMm: 30,
  panelWeightKg: 32.4,
  rackingWeightKgPerPanel: 12.838644,
  tiltDeg: 10,
  rowSpacingM: 1.557,
  interRowSpacingM: 0.435,
  setbackM: 1.22,
  systemName: 'AeroGrid 10° Landscape',
};

// Pricing tiers based on validated data
const PRICING_TIERS = [
  { maxPanels: 1500, pricePerPanel: 115.50, tier: 'Small (<1,500 panels)' },
  { maxPanels: 3000, pricePerPanel: 113.00, tier: 'Medium (1,500-3,000 panels)' },
  { maxPanels: 5000, pricePerPanel: 111.50, tier: 'Large (3,000-5,000 panels)' },
  { maxPanels: 8000, pricePerPanel: 111.00, tier: 'Industrial (5,000-8,000 panels)' },
  { maxPanels: Infinity, pricePerPanel: 110.00, tier: 'Utility (8,000+ panels)' },
];

// Shipping cost formula (validated from quotes)
const SHIPPING_BASE_COST = 5855; // Minimum shipping cost
const SHIPPING_PER_PANEL = 3.50; // Average per-panel shipping

// Engineering costs
const ENGINEERING_SMALL = 2200; // < 2 MW
const ENGINEERING_LARGE = 2400; // >= 2 MW
const ENGINEERING_THRESHOLD_KW = 2000;

/**
 * Calculate KB Racking price per panel based on project size
 */
export function calculatePricePerPanel(panelCount: number): number {
  for (const tier of PRICING_TIERS) {
    if (panelCount <= tier.maxPanels) {
      return tier.pricePerPanel;
    }
  }
  return PRICING_TIERS[PRICING_TIERS.length - 1].pricePerPanel;
}

/**
 * Get pricing tier description
 */
export function getPricingTier(panelCount: number): string {
  for (const tier of PRICING_TIERS) {
    if (panelCount <= tier.maxPanels) {
      return tier.tier;
    }
  }
  return PRICING_TIERS[PRICING_TIERS.length - 1].tier;
}

/**
 * Calculate shipping estimate
 */
export function calculateShippingEstimate(panelCount: number): number {
  const calculatedShipping = panelCount * SHIPPING_PER_PANEL;
  return Math.max(SHIPPING_BASE_COST, calculatedShipping);
}

/**
 * Calculate engineering cost based on system size
 */
export function calculateEngineeringCost(kwDc: number): number {
  return kwDc >= ENGINEERING_THRESHOLD_KW ? ENGINEERING_LARGE : ENGINEERING_SMALL;
}

/**
 * Generate complete KB Racking cost estimate
 */
export function estimateKBRackingCost(panelCount: number): KBRackingEstimate {
  const kwDc = panelCount * (KB_RACKING_SPECS.panelPowerW / 1000);
  const pricePerPanel = calculatePricePerPanel(panelCount);
  const rackingSubtotal = panelCount * pricePerPanel;
  const shippingEstimate = calculateShippingEstimate(panelCount);
  const engineeringCost = calculateEngineeringCost(kwDc);
  const totalEstimate = rackingSubtotal + shippingEstimate + engineeringCost;
  
  // Confidence level based on whether panel count falls within validated range
  let confidenceLevel: 'high' | 'medium' | 'low' = 'high';
  if (panelCount < 1000 || panelCount > 15000) {
    confidenceLevel = 'medium';
  }
  if (panelCount < 500 || panelCount > 20000) {
    confidenceLevel = 'low';
  }

  return {
    panelCount,
    kwDc: Math.round(kwDc * 100) / 100,
    pricePerPanel,
    rackingSubtotal: Math.round(rackingSubtotal * 100) / 100,
    shippingEstimate: Math.round(shippingEstimate * 100) / 100,
    engineeringCost,
    totalEstimate: Math.round(totalEstimate * 100) / 100,
    pricingTier: getPricingTier(panelCount),
    confidenceLevel,
  };
}

/**
 * Estimate panel count from roof area (using KB Racking specs)
 * Returns estimated panel count that can fit on the roof
 */
export function estimatePanelCountFromArea(roofAreaSqM: number): number {
  // Effective panel footprint with row spacing
  const panelLengthM = KB_RACKING_SPECS.panelLengthMm / 1000;
  const rowPitchM = KB_RACKING_SPECS.rowSpacingM;
  const effectiveAreaPerPanel = panelLengthM * rowPitchM; // ~3.72 m² per panel
  
  // Apply 85% utilization factor (setbacks, corridors, obstacles)
  const utilizationFactor = 0.85;
  const usableArea = roofAreaSqM * utilizationFactor;
  
  return Math.floor(usableArea / effectiveAreaPerPanel);
}

/**
 * Calculate expected kW DC from roof area
 */
export function estimateKwDcFromArea(roofAreaSqM: number): number {
  const panelCount = estimatePanelCountFromArea(roofAreaSqM);
  return panelCount * (KB_RACKING_SPECS.panelPowerW / 1000);
}

/**
 * Generate Bill of Materials for a project
 */
export interface BOMItem {
  category: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  lineTotalCost: number;
}

export function generateBOM(panelCount: number): BOMItem[] {
  const estimate = estimateKBRackingCost(panelCount);
  
  return [
    {
      category: 'PANEL',
      description: `Jinko Solar Tiger Neo N-type 625W Bifacial`,
      quantity: panelCount,
      unit: 'each',
      unitCost: 185.00, // Panel cost (separate from racking)
      lineTotalCost: panelCount * 185.00,
    },
    {
      category: 'RACKING',
      description: `KB Racking AeroGrid 10° Landscape System`,
      quantity: panelCount,
      unit: 'panel kit',
      unitCost: estimate.pricePerPanel,
      lineTotalCost: estimate.rackingSubtotal,
    },
    {
      category: 'SERVICE',
      description: 'Shipping, Handling & Transport Insurance',
      quantity: 1,
      unit: 'lump sum',
      unitCost: estimate.shippingEstimate,
      lineTotalCost: estimate.shippingEstimate,
    },
    {
      category: 'SERVICE',
      description: 'PE Stamped Engineering Design Report & Ballast Diagrams',
      quantity: 1,
      unit: 'lump sum',
      unitCost: estimate.engineeringCost,
      lineTotalCost: estimate.engineeringCost,
    },
  ];
}

/**
 * Portfolio statistics from KB Racking data
 */
export interface PortfolioKBStats {
  totalSites: number;
  sitesWithDesign: number;
  totalPanels: number;
  totalKwDc: number;
  totalMwDc: number;
  totalRackingValue: number;
  averagePricePerPanel: number;
  minPricePerPanel: number;
  maxPricePerPanel: number;
  quotesExpiringSoon: number; // Within 7 days
  quotesExpired: number;
}

/**
 * Check if a quote is expiring soon (within 7 days)
 */
export function isQuoteExpiringSoon(expiryDate: Date | null): boolean {
  if (!expiryDate) return false;
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return expiryDate > now && expiryDate <= sevenDaysFromNow;
}

/**
 * Check if a quote is expired
 */
export function isQuoteExpired(expiryDate: Date | null): boolean {
  if (!expiryDate) return false;
  return expiryDate < new Date();
}
