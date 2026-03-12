/**
 * Seed Script: Create 3 Demo Sites for Persona Demonstrations
 *
 * Creates pre-configured demo sites matching the 3 priority personas:
 * 1. DÉMO — Marché Beau-Soleil Laval (Tarif G, ~400 MWh/an, 75 kWc)
 * 2. DÉMO — Usine Thermopak Sherbrooke (Tarif M, ~2 GWh/an, 350 kWc)
 * 3. DÉMO — Groupe Immobilier Horizon (Mix G+M, 5 sites, 490 kWc total)
 *
 * All financial calculations match cashflowCalculations.ts EXACTLY.
 * Constants imported from shared/constants.ts.
 *
 * Usage: npx tsx server/scripts/seedDemoSites.ts
 *
 * Updated: March 2026 — v2 (corrected incentive cascade, DPA 90%, yield 1340)
 */

import { db } from "../db";
import {
  clients,
  sites,
  simulationRuns,
  opportunities,
  portfolios,
} from "@shared/schema";
import {
  HQ_ITC_CAP_PER_KW,
  HQ_ITC_MAX_CAPACITY_KW,
  HQ_ITC_PERCENT,
  FEDERAL_ITC_RATE,
  CORPORATE_TAX_RATE,
  CCA_RECOVERY_FACTOR,
} from "@shared/constants";
import { getTieredSolarCostPerW } from "../analysis/potentialAnalysis";

// ─── Incentive calculation (mirrors cashflowCalculations.ts exactly) ─────
function calculateIncentiveCascade(pvKW: number, bifacial = true) {
  const baseCostPerW = getTieredSolarCostPerW(pvKW);
  const effectiveCostPerW = bifacial ? baseCostPerW + 0.10 : baseCostPerW;
  const capexPV = pvKW * 1000 * effectiveCostPerW;

  // HQ OSE 6.0 — solar only, no battery incentive
  const eligibleKW = Math.min(pvKW, HQ_ITC_MAX_CAPACITY_KW);
  const potentialHQ = eligibleKW * HQ_ITC_CAP_PER_KW;
  const cap40 = capexPV * HQ_ITC_PERCENT;
  const hqIncentive = Math.min(potentialHQ, cap40);

  // Federal ITC — 30% of (CAPEX - HQ)
  const itcBasis = capexPV - hqIncentive;
  const federalITC = itcBasis * FEDERAL_ITC_RATE;

  // Tax shield (DPA/CCA) — 90% × 26.5% × (CAPEX - HQ - ITC)
  const capexNetAccounting = Math.max(0, capexPV - hqIncentive - federalITC);
  const taxShield = capexNetAccounting * CORPORATE_TAX_RATE * CCA_RECOVERY_FACTOR;

  const totalIncentives = hqIncentive + federalITC + taxShield;
  const capexNet = capexPV - totalIncentives;

  return {
    effectiveCostPerW,
    capexPV,
    hqIncentive,
    federalITC,
    taxShield,
    totalIncentives,
    capexNet,
    cap40,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const YIELD_KWH_KWP = 1340; // Opsun 20° high profile (bifacial)
const SURPLUS_RATE = 0.046; // HQ surplus compensation $/kWh

function buildConsumptionHistory(
  monthlyProfile: Array<{ kWh: number; kW: number; cost: number }>,
  months = 24
) {
  const history: Array<Record<string, unknown>> = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const entry = monthlyProfile[d.getMonth()];
    const variance = 0.95 + Math.random() * 0.10;
    history.push({
      period: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      kWh: Math.round(entry.kWh * variance),
      kW: Math.round(entry.kW * variance),
      amount: Math.round(entry.cost * variance),
    });
  }
  return history;
}

// ─── SITE 1: Marché Beau-Soleil Laval (Tarif G, 75 kWc) ─────────────────
const S1_MONTHLY = [
  { month: 1,  kWh: 38000, kW: 90, cost: 4535 },  // Jan — chauffage + réfrigération
  { month: 2,  kWh: 35000, kW: 88, cost: 4177 },
  { month: 3,  kWh: 32000, kW: 82, cost: 3819 },
  { month: 4,  kWh: 30000, kW: 78, cost: 3580 },
  { month: 5,  kWh: 28000, kW: 75, cost: 3341 },
  { month: 6,  kWh: 32000, kW: 84, cost: 3819 },  // Jun — A/C + réfrigération
  { month: 7,  kWh: 38000, kW: 95, cost: 4535 },  // Jul — pic A/C
  { month: 8,  kWh: 37000, kW: 92, cost: 4416 },
  { month: 9,  kWh: 32000, kW: 82, cost: 3819 },
  { month: 10, kWh: 33000, kW: 84, cost: 3938 },
  { month: 11, kWh: 35000, kW: 87, cost: 4177 },
  { month: 12, kWh: 38000, kW: 90, cost: 4535 },  // Déc — chauffage
];
const S1_ANNUAL_KWH = S1_MONTHLY.reduce((s, m) => s + m.kWh, 0); // ~408,000
const S1_ANNUAL_COST = S1_MONTHLY.reduce((s, m) => s + m.cost, 0);
const S1_PEAK = Math.max(...S1_MONTHLY.map(m => m.kW)); // 95 kW
const S1_PV_KW = 75;
const S1_PRODUCTION = S1_PV_KW * YIELD_KWH_KWP; // 100,500 kWh
const S1_SELF_PCT = 0.85;
const S1_SELF = Math.round(S1_PRODUCTION * S1_SELF_PCT);
const S1_EXPORT = S1_PRODUCTION - S1_SELF;
const S1 = calculateIncentiveCascade(S1_PV_KW);

// Energy savings (Tarif G: 11.933¢/kWh)
const S1_ENERGY_SAVINGS = Math.round(S1_SELF * 0.11933);
// Demand savings (Tarif G: $21.261/kW above 50kW threshold, ~20kW reduction)
const S1_PEAK_AFTER = 75; // 95 → 75 kW (solar shaves ~20 kW during peak)
const S1_DEMAND_SAVINGS = Math.round((Math.max(0, S1_PEAK - 50) - Math.max(0, S1_PEAK_AFTER - 50)) * 21.261 * 12);
const S1_SURPLUS = Math.round(S1_EXPORT * SURPLUS_RATE);
const S1_SAVINGS = S1_ENERGY_SAVINGS + S1_DEMAND_SAVINGS + S1_SURPLUS;

// ─── SITE 2: Usine Thermopak Sherbrooke (Tarif M, 350 kWc) ──────────────
const S2_MONTHLY = [
  { month: 1,  kWh: 190000, kW: 520, cost: 20496 },
  { month: 2,  kWh: 185000, kW: 510, cost: 19957 },
  { month: 3,  kWh: 170000, kW: 480, cost: 18340 },
  { month: 4,  kWh: 155000, kW: 450, cost: 16722 },
  { month: 5,  kWh: 145000, kW: 420, cost: 15644 },
  { month: 6,  kWh: 150000, kW: 440, cost: 16183 },  // Jun — clim process
  { month: 7,  kWh: 170000, kW: 480, cost: 18340 },  // Jul — pic
  { month: 8,  kWh: 165000, kW: 470, cost: 17800 },
  { month: 9,  kWh: 155000, kW: 450, cost: 16722 },
  { month: 10, kWh: 170000, kW: 480, cost: 18340 },
  { month: 11, kWh: 180000, kW: 500, cost: 19418 },
  { month: 12, kWh: 188000, kW: 515, cost: 20281 },
];
const S2_ANNUAL_KWH = S2_MONTHLY.reduce((s, m) => s + m.kWh, 0); // ~2,023,000
const S2_ANNUAL_COST = S2_MONTHLY.reduce((s, m) => s + m.cost, 0);
const S2_PEAK = Math.max(...S2_MONTHLY.map(m => m.kW)); // 520 kW
const S2_PV_KW = 350;
const S2_PRODUCTION = S2_PV_KW * YIELD_KWH_KWP; // 469,000 kWh
const S2_SELF_PCT = 0.90;
const S2_SELF = Math.round(S2_PRODUCTION * S2_SELF_PCT);
const S2_EXPORT = S2_PRODUCTION - S2_SELF;
const S2 = calculateIncentiveCascade(S2_PV_KW);

// Tarif M: 6.061¢/kWh + $17.573/kW (no threshold)
const S2_ENERGY_SAVINGS = Math.round(S2_SELF * 0.06061);
const S2_PEAK_AFTER = 460; // ~60 kW reduction from solar
const S2_DEMAND_SAVINGS = Math.round((S2_PEAK - S2_PEAK_AFTER) * 17.573 * 12);
const S2_SURPLUS = Math.round(S2_EXPORT * SURPLUS_RATE);
const S2_SAVINGS = S2_ENERGY_SAVINGS + S2_DEMAND_SAVINGS + S2_SURPLUS;

// ─── SITES 3-7: Portfolio Groupe Immobilier Horizon (Mix G+M) ────────────
const PORTFOLIO_SITES = [
  { name: "DÉMO — Succursale A (G)", city: "Laval", type: "retail", tariff: "G" as const,
    sqft: 12000, roofM2: 1115, pvKW: 45, annualKWh: 200000, peakKW: 55, peakAfterKW: 45, selfPct: 0.90 },
  { name: "DÉMO — Succursale B (G)", city: "Longueuil", type: "retail", tariff: "G" as const,
    sqft: 16000, roofM2: 1485, pvKW: 60, annualKWh: 300000, peakKW: 75, peakAfterKW: 60, selfPct: 0.87 },
  { name: "DÉMO — Entrepôt Montréal-Est (M)", city: "Montréal-Est", type: "warehouse", tariff: "M" as const,
    sqft: 45000, roofM2: 4180, pvKW: 200, annualKWh: 1200000, peakKW: 350, peakAfterKW: 305, selfPct: 0.92 },
  { name: "DÉMO — Bureau principal Plateau (G)", city: "Montréal", type: "office", tariff: "G" as const,
    sqft: 8000, roofM2: 745, pvKW: 35, annualKWh: 150000, peakKW: 40, peakAfterKW: 35, selfPct: 0.88 },
  { name: "DÉMO — Usine secondaire Anjou (M)", city: "Anjou", type: "light_industrial", tariff: "M" as const,
    sqft: 30000, roofM2: 2790, pvKW: 150, annualKWh: 900000, peakKW: 280, peakAfterKW: 245, selfPct: 0.91 },
];

// ─── Seed function ──────────────────────────────────────────────────────
async function seedDemoSites() {
  console.warn("🌱 Création des 3 sites démo pour les personas (v2 — formules corrigées)...\n");

  // ════════════════════════════════════════════════════════════════════════
  // SITE 1: Marché Beau-Soleil (Commerçant Tarif G, 75 kWc)
  // ════════════════════════════════════════════════════════════════════════
  const [s1Client] = await db.insert(clients).values({
    name: "DÉMO — Marché Beau-Soleil Inc.",
    mainContactName: "Pierre Gagnon",
    email: "demo-pgagnon@kwh.quebec",
    phone: "450-555-0101",
    address: "2800 Boulevard Le Carrefour",
    city: "Laval",
    province: "QC",
    postalCode: "H7T 2K7",
    accountManagerEmail: "malabarre@kwh.quebec",
  }).returning();

  const s1History = buildConsumptionHistory(S1_MONTHLY);
  const [s1Site] = await db.insert(sites).values({
    clientId: s1Client.id,
    name: "DÉMO — Marché Beau-Soleil Laval",
    address: "2800 Boulevard Le Carrefour",
    city: "Laval",
    province: "QC",
    postalCode: "H7T 2K7",
    buildingType: "grocery",
    roofType: "flat",
    roofAreaSqM: 2800,
    latitude: 45.5569,
    longitude: -73.7498,
    roofAreaValidated: true,
    roofAreaValidatedAt: new Date(),
    roofEstimateStatus: "success",
    buildingSqFt: 30000,
    yearBuilt: 2001,
    hqTariffDetail: "G - Général",
    subscribedPowerKw: 100,
    maxDemandKw: S1_PEAK,
    hqConsumptionHistory: s1History,
    quickAnalysisSystemSizeKw: S1_PV_KW,
    quickAnalysisAnnualProductionKwh: S1_PRODUCTION,
    quickAnalysisAnnualSavings: S1_SAVINGS,
    quickAnalysisPaybackYears: 3.8,
    quickAnalysisGrossCapex: S1.capexPV,
    quickAnalysisNetCapex: Math.round(S1.capexNet),
    quickAnalysisHqIncentive: S1.hqIncentive,
    quickAnalysisMonthlyBill: Math.round(S1_ANNUAL_COST / 12),
  }).returning();

  await db.insert(simulationRuns).values({
    siteId: s1Site.id,
    label: "Scénario solaire — 75 kWc (bifacial Opsun 20°)",
    type: "BASELINE",
    pvSizeKW: S1_PV_KW,
    battEnergyKWh: 0, battPowerKW: 0,
    annualConsumptionKWh: S1_ANNUAL_KWH,
    peakDemandKW: S1_PEAK,
    annualEnergySavingsKWh: S1_SELF,
    totalProductionKWh: S1_PRODUCTION,
    totalExportedKWh: S1_EXPORT,
    annualSurplusRevenue: S1_SURPLUS,
    selfConsumptionKWh: S1_SELF,
    selfSufficiencyPercent: Math.round((S1_SELF / S1_ANNUAL_KWH) * 100),
    annualCostBefore: S1_ANNUAL_COST,
    annualCostAfter: S1_ANNUAL_COST - S1_SAVINGS,
    annualSavings: S1_SAVINGS,
    savingsYear1: S1_SAVINGS,
    capexGross: S1.capexPV, capexPV: S1.capexPV, capexBattery: 0,
    incentivesHQ: S1.hqIncentive, incentivesHQSolar: S1.hqIncentive, incentivesHQBattery: 0,
    incentivesFederal: Math.round(S1.federalITC),
    taxShield: Math.round(S1.taxShield),
    totalIncentives: Math.round(S1.totalIncentives),
    capexNet: Math.round(S1.capexNet),
    npv25: 243986,  // From Python calculation with full escalation model
    irr25: 0.230,
    simplePaybackYears: 3.8,
    lcoe: 0.035,
    co2AvoidedTonnesPerYear: Math.round(S1_PRODUCTION * 0.002 * 10) / 10,
    assumptions: {
      tariffCode: "G",
      tariffEnergy: 0.11933,
      tariffPower: 21.261,
      solarYieldKWhPerKWp: YIELD_KWH_KWP,
      orientationFactor: 1.0,
      rackingSystemType: "opsun_20_high",
      solarCostPerW: S1.effectiveCostPerW,
      bifacialEnabled: true,
      bifacialCostPremium: 0.10,
      analysisYears: 25,
      netMeteringEnabled: true,
      hqSurplusCompensationRate: SURPLUS_RATE,
    },
  });

  await db.insert(opportunities).values({
    siteId: s1Site.id,
    clientId: s1Client.id,
    name: "DÉMO — Marché Beau-Soleil — 75 kWc Solaire",
    stage: "qualified",
    probability: 25,
    estimatedValue: S1.capexPV,
    pvSizeKW: S1_PV_KW,
    source: "website",
    priority: "high",
    tags: ["demo", "epicerie", "tarif-G", "persona-1"],
  });

  console.warn(`✅ Site 1: Marché Beau-Soleil Laval (Tarif G, ${S1_PV_KW} kWc, payback 3.8 ans, IRR 23.0%)`);
  console.warn(`   CAPEX: $${S1.capexPV.toLocaleString()} → Net $${Math.round(S1.capexNet).toLocaleString()} ($${S1.effectiveCostPerW.toFixed(2)}/W → $${(S1.capexNet/S1_PV_KW/1000).toFixed(2)}/W net)`);

  // ════════════════════════════════════════════════════════════════════════
  // SITE 2: Usine Thermopak (Industriel Tarif M, 350 kWc)
  // ════════════════════════════════════════════════════════════════════════
  const [s2Client] = await db.insert(clients).values({
    name: "DÉMO — Thermopak Industries Inc.",
    mainContactName: "Marie-Claude Fortier",
    email: "demo-mcfortier@kwh.quebec",
    phone: "819-555-0202",
    address: "1200 Rue de l'Industrie",
    city: "Sherbrooke",
    province: "QC",
    postalCode: "J1L 2Z3",
    accountManagerEmail: "malabarre@kwh.quebec",
  }).returning();

  const s2History = buildConsumptionHistory(S2_MONTHLY);
  const [s2Site] = await db.insert(sites).values({
    clientId: s2Client.id,
    name: "DÉMO — Usine Thermopak Sherbrooke",
    address: "1200 Rue de l'Industrie",
    city: "Sherbrooke",
    province: "QC",
    postalCode: "J1L 2Z3",
    buildingType: "industrial",
    roofType: "flat",
    roofAreaSqM: 6500,
    latitude: 45.4042,
    longitude: -71.8929,
    roofAreaValidated: true,
    roofAreaValidatedAt: new Date(),
    roofEstimateStatus: "success",
    buildingSqFt: 70000,
    yearBuilt: 1995,
    hqTariffDetail: "M - Moyenne puissance",
    subscribedPowerKw: 600,
    maxDemandKw: S2_PEAK,
    hqConsumptionHistory: s2History,
    quickAnalysisSystemSizeKw: S2_PV_KW,
    quickAnalysisAnnualProductionKwh: S2_PRODUCTION,
    quickAnalysisAnnualSavings: S2_SAVINGS,
    quickAnalysisPaybackYears: 6.0,
    quickAnalysisGrossCapex: S2.capexPV,
    quickAnalysisNetCapex: Math.round(S2.capexNet),
    quickAnalysisHqIncentive: S2.hqIncentive,
    quickAnalysisMonthlyBill: Math.round(S2_ANNUAL_COST / 12),
  }).returning();

  await db.insert(simulationRuns).values({
    siteId: s2Site.id,
    label: "Scénario solaire — 350 kWc (bifacial Opsun 20°)",
    type: "BASELINE",
    pvSizeKW: S2_PV_KW,
    battEnergyKWh: 0, battPowerKW: 0,
    annualConsumptionKWh: S2_ANNUAL_KWH,
    peakDemandKW: S2_PEAK,
    annualEnergySavingsKWh: S2_SELF,
    totalProductionKWh: S2_PRODUCTION,
    totalExportedKWh: S2_EXPORT,
    annualSurplusRevenue: S2_SURPLUS,
    selfConsumptionKWh: S2_SELF,
    selfSufficiencyPercent: Math.round((S2_SELF / S2_ANNUAL_KWH) * 100),
    annualCostBefore: S2_ANNUAL_COST,
    annualCostAfter: S2_ANNUAL_COST - S2_SAVINGS,
    annualSavings: S2_SAVINGS,
    savingsYear1: S2_SAVINGS,
    capexGross: S2.capexPV, capexPV: S2.capexPV, capexBattery: 0,
    incentivesHQ: S2.hqIncentive, incentivesHQSolar: S2.hqIncentive, incentivesHQBattery: 0,
    incentivesFederal: Math.round(S2.federalITC),
    taxShield: Math.round(S2.taxShield),
    totalIncentives: Math.round(S2.totalIncentives),
    capexNet: Math.round(S2.capexNet),
    npv25: 494672,  // From Python calculation with full escalation model
    irr25: 0.155,
    simplePaybackYears: 6.0,
    lcoe: 0.030,
    co2AvoidedTonnesPerYear: Math.round(S2_PRODUCTION * 0.002 * 10) / 10,
    assumptions: {
      tariffCode: "M",
      tariffEnergy: 0.06061,
      tariffPower: 17.573,
      solarYieldKWhPerKWp: YIELD_KWH_KWP,
      orientationFactor: 1.0,
      rackingSystemType: "opsun_20_high",
      solarCostPerW: S2.effectiveCostPerW,
      bifacialEnabled: true,
      bifacialCostPremium: 0.10,
      analysisYears: 25,
      netMeteringEnabled: true,
      hqSurplusCompensationRate: SURPLUS_RATE,
    },
  });

  await db.insert(opportunities).values({
    siteId: s2Site.id,
    clientId: s2Client.id,
    name: "DÉMO — Usine Thermopak — 350 kWc Solaire",
    stage: "analysis_done",
    probability: 30,
    estimatedValue: S2.capexPV,
    pvSizeKW: S2_PV_KW,
    source: "cold_outreach",
    priority: "high",
    tags: ["demo", "industriel", "tarif-M", "persona-2"],
  });

  console.warn(`✅ Site 2: Usine Thermopak Sherbrooke (Tarif M, ${S2_PV_KW} kWc, payback 6.0 ans, IRR 15.5%)`);
  console.warn(`   CAPEX: $${S2.capexPV.toLocaleString()} → Net $${Math.round(S2.capexNet).toLocaleString()} ($${S2.effectiveCostPerW.toFixed(2)}/W → $${(S2.capexNet/S2_PV_KW/1000).toFixed(2)}/W net)`);
  console.warn(`   Note: HQ cap 40% binds at $${Math.round(S2.cap40).toLocaleString()} (< potential $${(S2_PV_KW * HQ_ITC_CAP_PER_KW).toLocaleString()})`);

  // ════════════════════════════════════════════════════════════════════════
  // SITES 3-7: Portfolio Groupe Immobilier Horizon (Multi-Sites)
  // ════════════════════════════════════════════════════════════════════════
  const [portfolioClient] = await db.insert(clients).values({
    name: "DÉMO — Groupe Immobilier Horizon Inc.",
    mainContactName: "François Bouchard",
    email: "demo-fbouchard@kwh.quebec",
    phone: "514-555-0303",
    address: "500 Rue Sherbrooke Ouest, bureau 800",
    city: "Montréal",
    province: "QC",
    postalCode: "H3A 3C6",
    accountManagerEmail: "malabarre@kwh.quebec",
  }).returning();

  const portfolioSiteIds: number[] = [];
  let totalPvKW = 0;
  let totalCapex = 0;
  let totalCapexNet = 0;
  let totalSavings = 0;
  let totalProduction = 0;
  let totalIncentives = 0;

  for (const ps of PORTFOLIO_SITES) {
    const cascade = calculateIncentiveCascade(ps.pvKW);
    const production = ps.pvKW * YIELD_KWH_KWP;
    const selfKWh = Math.round(production * ps.selfPct);
    const exportKWh = production - selfKWh;

    const rate = ps.tariff === "G" ? 0.11933 : 0.06061;
    const demandRate = ps.tariff === "G" ? 21.261 : 17.573;
    const threshold = ps.tariff === "G" ? 50 : 0;

    const energySavings = Math.round(selfKWh * rate);
    const demandBefore = Math.max(0, ps.peakKW - threshold) * demandRate * 12;
    const demandAfter = Math.max(0, ps.peakAfterKW - threshold) * demandRate * 12;
    const demandSavings = Math.round(demandBefore - demandAfter);
    const surplus = Math.round(exportKWh * SURPLUS_RATE);
    const siteSavings = energySavings + demandSavings + surplus;

    const annualCost = Math.round(ps.annualKWh * rate + ps.peakKW * demandRate * 12);
    const monthlyBase = Math.round(ps.annualKWh / 12);
    const monthlyPeak = ps.peakKW;

    const monthly = Array.from({ length: 12 }, (_, i) => {
      const seasonFactor = [1.05, 1.0, 0.95, 0.90, 0.85, 0.90, 1.05, 1.10, 1.0, 0.95, 1.0, 1.15][i];
      return {
        kWh: Math.round(monthlyBase * seasonFactor),
        kW: Math.round(monthlyPeak * seasonFactor),
        cost: Math.round((annualCost / 12) * seasonFactor),
      };
    });

    const history = buildConsumptionHistory(monthly);

    const [pSite] = await db.insert(sites).values({
      clientId: portfolioClient.id,
      name: ps.name,
      city: ps.city,
      province: "QC",
      buildingType: ps.type,
      roofType: "flat",
      roofAreaSqM: ps.roofM2,
      buildingSqFt: ps.sqft,
      hqTariffDetail: ps.tariff === "G" ? "G - Général" : "M - Moyenne puissance",
      maxDemandKw: ps.peakKW,
      hqConsumptionHistory: history,
      quickAnalysisSystemSizeKw: ps.pvKW,
      quickAnalysisAnnualProductionKwh: production,
      quickAnalysisAnnualSavings: siteSavings,
      quickAnalysisGrossCapex: cascade.capexPV,
      quickAnalysisNetCapex: Math.round(cascade.capexNet),
      quickAnalysisMonthlyBill: Math.round(annualCost / 12),
    }).returning();

    portfolioSiteIds.push(pSite.id);
    totalPvKW += ps.pvKW;
    totalCapex += cascade.capexPV;
    totalCapexNet += cascade.capexNet;
    totalSavings += siteSavings;
    totalProduction += production;
    totalIncentives += cascade.totalIncentives;

    await db.insert(opportunities).values({
      siteId: pSite.id,
      clientId: portfolioClient.id,
      name: `${ps.name} — ${ps.pvKW} kWc Solaire`,
      stage: "prospect",
      probability: 10,
      estimatedValue: cascade.capexPV,
      pvSizeKW: ps.pvKW,
      source: "referral",
      priority: "medium",
      tags: ["demo", "portfolio", `tarif-${ps.tariff}`, "persona-3"],
    });

    console.warn(`   📍 ${ps.name}: ${ps.pvKW} kW, $${Math.round(cascade.capexPV).toLocaleString()} → Net $${Math.round(cascade.capexNet).toLocaleString()}, eco. $${siteSavings.toLocaleString()}/an`);
  }

  // Create portfolio
  await db.insert(portfolios).values({
    clientId: portfolioClient.id,
    name: "DÉMO — Portfolio Groupe Immobilier Horizon",
    description: "Déploiement solaire multi-sites: 2 succursales G + entrepôt M + bureau G + usine M",
    siteIds: portfolioSiteIds,
    totalPvSizeKw: totalPvKW,
    totalCapex: Math.round(totalCapex),
    totalAnnualSavings: Math.round(totalSavings),
    totalCo2AvoidedTonnes: Math.round(totalProduction * 0.002 * 10) / 10,
    consolidatedNpv: 1015555,  // From Python calculation
    consolidatedIrr: 18.8,
    tags: ["demo", "multi-sites", "immobilier", "persona-3"],
  });

  console.warn(`\n✅ Portfolio: ${PORTFOLIO_SITES.length} sites, ${totalPvKW} kWc total, payback 4.8 ans, IRR 18.8%`);
  console.warn(`   CAPEX: $${Math.round(totalCapex).toLocaleString()} → Net $${Math.round(totalCapexNet).toLocaleString()} (incitatifs: $${Math.round(totalIncentives).toLocaleString()})`);

  // ─── Summary ────────────────────────────────────────────────────────────
  console.warn("\n" + "═".repeat(70));
  console.warn("🎉 3 SITES DÉMO CRÉÉS AVEC SUCCÈS! (v2 — formules corrigées)");
  console.warn("═".repeat(70));
  console.warn(`  1. Marché Beau-Soleil  → Tarif G, ${S1_PV_KW} kWc, Payback 3.8 ans, IRR 23.0%`);
  console.warn(`  2. Usine Thermopak     → Tarif M, ${S2_PV_KW} kWc, Payback 6.0 ans, IRR 15.5%`);
  console.warn(`  3. Portfolio Horizon   → Mix G+M, ${totalPvKW} kWc, Payback 4.8 ans, IRR 18.8%`);
  console.warn("═".repeat(70));
  console.warn("\n📋 Constantes utilisées:");
  console.warn(`   HQ OSE 6.0: $${HQ_ITC_CAP_PER_KW}/kW, max ${HQ_ITC_MAX_CAPACITY_KW} kW, cap ${HQ_ITC_PERCENT*100}%`);
  console.warn(`   ITC fédéral: ${FEDERAL_ITC_RATE*100}% de (CAPEX - HQ)`);
  console.warn(`   DPA/CCA: ${CCA_RECOVERY_FACTOR*100}% × ${CORPORATE_TAX_RATE*100}%`);
  console.warn(`   Racking: Opsun 20° high, ${YIELD_KWH_KWP} kWh/kWp (bifacial)`);
  console.warn(`   Batterie: $0 HQ (volet stockage discontinué jan 2026)`);
  console.warn("\n👉 Les sites démo sont identifiables par le préfixe 'DÉMO —'");
  console.warn("   Chacun a : client, site, simulation, opportunité dans le pipeline\n");

  process.exit(0);
}

seedDemoSites().catch((err) => {
  console.error("❌ Erreur:", err);
  process.exit(1);
});
