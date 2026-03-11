/**
 * Seed Script: Create 3 Demo Sites for Persona Demonstrations
 *
 * Creates pre-configured demo sites matching the 3 priority personas:
 * 1. DÉMO — Concessionnaire Laval (Tarif G, ~320 MWh/an, 55 kWc)
 * 2. DÉMO — Usine Sherbrooke (Tarif M, ~1.8 GWh/an, 280 kWc)
 * 3. DÉMO — Portfolio 5 Sites (Mix G+M, ~4.2 GWh/an, 620 kWc total)
 *
 * Usage: npx tsx server/scripts/seedDemoSites.ts
 */

import { db } from "../db";
import {
  clients,
  sites,
  simulationRuns,
  opportunities,
  portfolios,
} from "@shared/schema";

// ─── Helpers ────────────────────────────────────────────────────────────────
function buildConsumptionHistory(
  monthlyProfile: Array<{ kWh: number; kW: number; cost: number }>,
  months = 24
) {
  const history: any[] = [];
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

// ─── SITE 1: Concessionnaire Laval (Tarif G) ───────────────────────────────
const DEALER_MONTHLY = [
  { month: 1,  kWh: 30000, kW: 55, cost: 3579 },  // Jan — chauffage showroom
  { month: 2,  kWh: 28000, kW: 52, cost: 3340 },
  { month: 3,  kWh: 26000, kW: 48, cost: 3102 },
  { month: 4,  kWh: 24000, kW: 45, cost: 2863 },
  { month: 5,  kWh: 22000, kW: 42, cost: 2625 },
  { month: 6,  kWh: 26000, kW: 50, cost: 3102 },  // Jun — A/C showroom
  { month: 7,  kWh: 30000, kW: 58, cost: 3579 },  // Jul — A/C + éclairage lot
  { month: 8,  kWh: 29000, kW: 56, cost: 3460 },
  { month: 9,  kWh: 25000, kW: 47, cost: 2982 },
  { month: 10, kWh: 26000, kW: 48, cost: 3102 },
  { month: 11, kWh: 28000, kW: 52, cost: 3340 },
  { month: 12, kWh: 30000, kW: 55, cost: 3579 },  // Déc — chauffage
];
const DEALER_ANNUAL_KWH = DEALER_MONTHLY.reduce((s, m) => s + m.kWh, 0); // ~324,000
const DEALER_ANNUAL_COST = DEALER_MONTHLY.reduce((s, m) => s + m.cost, 0);
const DEALER_PEAK = Math.max(...DEALER_MONTHLY.map(m => m.kW)); // 58 kW
const DEALER_PV_KW = 55;
const DEALER_PRODUCTION = 63250; // 55 kW × 1150 kWh/kWp
const DEALER_CAPEX = DEALER_PV_KW * 1000 * 2.40; // $132,000
const DEALER_HQ = DEALER_PV_KW * 1000; // $55,000
const DEALER_ITC = DEALER_CAPEX * 0.30;
const DEALER_TAX = (DEALER_CAPEX - DEALER_HQ) * 0.265 * 0.5;
const DEALER_NET = DEALER_CAPEX - DEALER_HQ - DEALER_ITC - DEALER_TAX;

// ─── SITE 2: Usine Sherbrooke (Tarif M) ────────────────────────────────────
const USINE_MONTHLY = [
  { month: 1,  kWh: 170000, kW: 420, cost: 17700 },
  { month: 2,  kWh: 165000, kW: 410, cost: 17180 },
  { month: 3,  kWh: 155000, kW: 390, cost: 16140 },
  { month: 4,  kWh: 145000, kW: 370, cost: 15100 },
  { month: 5,  kWh: 135000, kW: 350, cost: 14058 },
  { month: 6,  kWh: 130000, kW: 340, cost: 13538 },
  { month: 7,  kWh: 140000, kW: 360, cost: 14578 },  // Clim
  { month: 8,  kWh: 138000, kW: 355, cost: 14370 },
  { month: 9,  kWh: 140000, kW: 360, cost: 14578 },
  { month: 10, kWh: 150000, kW: 380, cost: 15620 },
  { month: 11, kWh: 160000, kW: 400, cost: 16660 },
  { month: 12, kWh: 168000, kW: 415, cost: 17492 },
];
const USINE_ANNUAL_KWH = USINE_MONTHLY.reduce((s, m) => s + m.kWh, 0); // ~1,796,000
const USINE_ANNUAL_COST = USINE_MONTHLY.reduce((s, m) => s + m.cost, 0);
const USINE_PEAK = Math.max(...USINE_MONTHLY.map(m => m.kW)); // 420 kW
const USINE_PV_KW = 280;
const USINE_PRODUCTION = 322000; // 280 kW × 1150 kWh/kWp
const USINE_CAPEX = USINE_PV_KW * 1000 * 2.10; // $588,000
const USINE_HQ = USINE_PV_KW * 1000; // $280,000
const USINE_ITC = USINE_CAPEX * 0.30;
const USINE_TAX = (USINE_CAPEX - USINE_HQ) * 0.265 * 0.5;
const USINE_NET = USINE_CAPEX - USINE_HQ - USINE_ITC - USINE_TAX;

// ─── SITE 3-7: Portfolio 5 sites (Mix G+M) ─────────────────────────────────
const PORTFOLIO_SITES = [
  { name: "DÉMO — Concession Honda Laval", city: "Laval", type: "auto_dealership", tariff: "G", sqft: 18000, roofM2: 1670, pvKW: 45, annualKWh: 260000 },
  { name: "DÉMO — Concession Toyota Brossard", city: "Brossard", type: "auto_dealership", tariff: "G", sqft: 22000, roofM2: 2040, pvKW: 65, annualKWh: 340000 },
  { name: "DÉMO — Concession Ford Trois-Rivières", city: "Trois-Rivières", type: "auto_dealership", tariff: "G", sqft: 20000, roofM2: 1860, pvKW: 55, annualKWh: 300000 },
  { name: "DÉMO — Centre de distribution Québec", city: "Québec", type: "warehouse", tariff: "M", sqft: 85000, roofM2: 7900, pvKW: 250, annualKWh: 1500000 },
  { name: "DÉMO — Atelier carrosserie Gatineau", city: "Gatineau", type: "light_industrial", tariff: "M", sqft: 15000, roofM2: 1390, pvKW: 85, annualKWh: 420000 },
];

// ─── Seed function ──────────────────────────────────────────────────────────
async function seedDemoSites() {
  console.log("🌱 Création des 3 sites démo pour les personas...\n");

  // ════════════════════════════════════════════════════════════════════════
  // SITE 1: Concessionnaire Laval (Commerçant G)
  // ════════════════════════════════════════════════════════════════════════
  const [dealerClient] = await db.insert(clients).values({
    name: "DÉMO — Automobiles Laval Inc.",
    mainContactName: "Pierre Gagnon",
    email: "demo-pgagnon@kwh.quebec",
    phone: "450-555-0101",
    address: "2800 Boulevard Le Carrefour",
    city: "Laval",
    province: "QC",
    postalCode: "H7T 2K7",
    accountManagerEmail: "malabarre@kwh.quebec",
  }).returning();

  const dealerHistory = buildConsumptionHistory(DEALER_MONTHLY);
  const [dealerSite] = await db.insert(sites).values({
    clientId: dealerClient.id,
    name: "DÉMO — Concessionnaire Laval",
    address: "2800 Boulevard Le Carrefour",
    city: "Laval",
    province: "QC",
    postalCode: "H7T 2K7",
    buildingType: "auto_dealership",
    roofType: "flat",
    roofAreaSqM: 2400,
    latitude: 45.5569,
    longitude: -73.7498,
    roofAreaValidated: true,
    roofAreaValidatedAt: new Date(),
    roofEstimateStatus: "success",
    buildingSqFt: 25833,
    yearBuilt: 2005,
    hqTariffDetail: "G - Général",
    subscribedPowerKw: 60,
    maxDemandKw: DEALER_PEAK,
    hqConsumptionHistory: dealerHistory,
    quickAnalysisSystemSizeKw: DEALER_PV_KW,
    quickAnalysisAnnualProductionKwh: DEALER_PRODUCTION,
    quickAnalysisAnnualSavings: Math.round(DEALER_PRODUCTION * 0.11933),
    quickAnalysisPaybackYears: 4.5,
    quickAnalysisGrossCapex: DEALER_CAPEX,
    quickAnalysisNetCapex: Math.round(DEALER_NET),
    quickAnalysisHqIncentive: DEALER_HQ,
    quickAnalysisMonthlyBill: Math.round(DEALER_ANNUAL_COST / 12),
  }).returning();

  const dealerSavings = Math.round(DEALER_PRODUCTION * 0.11933);
  await db.insert(simulationRuns).values({
    siteId: dealerSite.id,
    label: "Scénario solaire — 55 kWc",
    type: "BASELINE",
    pvSizeKW: DEALER_PV_KW,
    battEnergyKWh: 0, battPowerKW: 0,
    annualConsumptionKWh: DEALER_ANNUAL_KWH,
    peakDemandKW: DEALER_PEAK,
    annualEnergySavingsKWh: DEALER_PRODUCTION,
    totalProductionKWh: DEALER_PRODUCTION,
    totalExportedKWh: Math.round(DEALER_PRODUCTION * 0.12),
    annualSurplusRevenue: Math.round(DEALER_PRODUCTION * 0.12 * 0.046),
    selfConsumptionKWh: Math.round(DEALER_PRODUCTION * 0.88),
    selfSufficiencyPercent: Math.round((DEALER_PRODUCTION * 0.88 / DEALER_ANNUAL_KWH) * 100),
    annualCostBefore: DEALER_ANNUAL_COST,
    annualCostAfter: DEALER_ANNUAL_COST - dealerSavings,
    annualSavings: dealerSavings,
    savingsYear1: dealerSavings,
    capexGross: DEALER_CAPEX, capexPV: DEALER_CAPEX, capexBattery: 0,
    incentivesHQ: DEALER_HQ, incentivesHQSolar: DEALER_HQ, incentivesHQBattery: 0,
    incentivesFederal: DEALER_ITC,
    taxShield: Math.round(DEALER_TAX),
    totalIncentives: Math.round(DEALER_HQ + DEALER_ITC + DEALER_TAX),
    capexNet: Math.round(DEALER_NET),
    npv25: Math.round(dealerSavings * 14.5 - DEALER_NET),
    irr25: 22.5,
    simplePaybackYears: 4.5,
    lcoe: 0.042,
    co2AvoidedTonnesPerYear: Math.round(DEALER_PRODUCTION * 0.0005 * 10) / 10,
    assumptions: {
      tariffCode: "G",
      tariffEnergy: 0.11933,
      tariffPower: 0,
      solarYieldKWhPerKWp: 1150,
      orientationFactor: 1.0,
      rackingSystemType: "kb_10_low",
      solarCostPerW: 2.40,
      analysisYears: 25,
      netMeteringEnabled: true,
    },
  });

  await db.insert(opportunities).values({
    siteId: dealerSite.id,
    clientId: dealerClient.id,
    name: "DÉMO — Concessionnaire Laval — 55 kWc Solaire",
    stage: "qualified",
    probability: 25,
    estimatedValue: DEALER_CAPEX,
    pvSizeKW: DEALER_PV_KW,
    source: "website",
    priority: "high",
    tags: ["demo", "concessionnaire", "tarif-G"],
  });

  console.log(`✅ Site 1: Concessionnaire Laval (Tarif G, ${DEALER_PV_KW} kWc, ${Math.round(DEALER_ANNUAL_KWH/1000)} MWh/an)`);

  // ════════════════════════════════════════════════════════════════════════
  // SITE 2: Usine Sherbrooke (Industriel M)
  // ════════════════════════════════════════════════════════════════════════
  const [usineClient] = await db.insert(clients).values({
    name: "DÉMO — Fabrication Sherbrooke Ltée",
    mainContactName: "Marie-Claude Fortier",
    email: "demo-mcfortier@kwh.quebec",
    phone: "819-555-0202",
    address: "1200 Rue de l'Industrie",
    city: "Sherbrooke",
    province: "QC",
    postalCode: "J1L 2Z3",
    accountManagerEmail: "malabarre@kwh.quebec",
  }).returning();

  const usineHistory = buildConsumptionHistory(USINE_MONTHLY);
  const [usineSite] = await db.insert(sites).values({
    clientId: usineClient.id,
    name: "DÉMO — Usine Sherbrooke",
    address: "1200 Rue de l'Industrie",
    city: "Sherbrooke",
    province: "QC",
    postalCode: "J1L 2Z3",
    buildingType: "industrial",
    roofType: "flat",
    roofAreaSqM: 5000,
    latitude: 45.4042,
    longitude: -71.8929,
    roofAreaValidated: true,
    roofAreaValidatedAt: new Date(),
    roofEstimateStatus: "success",
    buildingSqFt: 53820,
    yearBuilt: 1992,
    hqTariffDetail: "M - Moyenne puissance",
    subscribedPowerKw: 500,
    maxDemandKw: USINE_PEAK,
    hqConsumptionHistory: usineHistory,
    quickAnalysisSystemSizeKw: USINE_PV_KW,
    quickAnalysisAnnualProductionKwh: USINE_PRODUCTION,
    quickAnalysisAnnualSavings: Math.round(USINE_PRODUCTION * 0.06061),
    quickAnalysisPaybackYears: 6.2,
    quickAnalysisGrossCapex: USINE_CAPEX,
    quickAnalysisNetCapex: Math.round(USINE_NET),
    quickAnalysisHqIncentive: USINE_HQ,
    quickAnalysisMonthlyBill: Math.round(USINE_ANNUAL_COST / 12),
  }).returning();

  const usineSavings = Math.round(USINE_PRODUCTION * 0.06061);
  await db.insert(simulationRuns).values({
    siteId: usineSite.id,
    label: "Scénario solaire — 280 kWc",
    type: "BASELINE",
    pvSizeKW: USINE_PV_KW,
    battEnergyKWh: 0, battPowerKW: 0,
    annualConsumptionKWh: USINE_ANNUAL_KWH,
    peakDemandKW: USINE_PEAK,
    annualEnergySavingsKWh: USINE_PRODUCTION,
    totalProductionKWh: USINE_PRODUCTION,
    totalExportedKWh: Math.round(USINE_PRODUCTION * 0.08),
    annualSurplusRevenue: Math.round(USINE_PRODUCTION * 0.08 * 0.046),
    selfConsumptionKWh: Math.round(USINE_PRODUCTION * 0.92),
    selfSufficiencyPercent: Math.round((USINE_PRODUCTION * 0.92 / USINE_ANNUAL_KWH) * 100),
    annualCostBefore: USINE_ANNUAL_COST,
    annualCostAfter: USINE_ANNUAL_COST - usineSavings,
    annualSavings: usineSavings,
    savingsYear1: usineSavings,
    capexGross: USINE_CAPEX, capexPV: USINE_CAPEX, capexBattery: 0,
    incentivesHQ: USINE_HQ, incentivesHQSolar: USINE_HQ, incentivesHQBattery: 0,
    incentivesFederal: USINE_ITC,
    taxShield: Math.round(USINE_TAX),
    totalIncentives: Math.round(USINE_HQ + USINE_ITC + USINE_TAX),
    capexNet: Math.round(USINE_NET),
    npv25: Math.round(usineSavings * 14.5 - USINE_NET),
    irr25: 15.8,
    simplePaybackYears: 6.2,
    lcoe: 0.038,
    co2AvoidedTonnesPerYear: Math.round(USINE_PRODUCTION * 0.0005 * 10) / 10,
    assumptions: {
      tariffCode: "M",
      tariffEnergy: 0.06061,
      tariffPower: 17.57,
      solarYieldKWhPerKWp: 1150,
      orientationFactor: 1.0,
      rackingSystemType: "kb_10_low",
      solarCostPerW: 2.10,
      analysisYears: 25,
      netMeteringEnabled: true,
    },
  });

  await db.insert(opportunities).values({
    siteId: usineSite.id,
    clientId: usineClient.id,
    name: "DÉMO — Usine Sherbrooke — 280 kWc Solaire",
    stage: "analysis_done",
    probability: 30,
    estimatedValue: USINE_CAPEX,
    pvSizeKW: USINE_PV_KW,
    source: "cold_outreach",
    priority: "high",
    tags: ["demo", "industriel", "tarif-M"],
  });

  console.log(`✅ Site 2: Usine Sherbrooke (Tarif M, ${USINE_PV_KW} kWc, ${Math.round(USINE_ANNUAL_KWH/1000)} MWh/an)`);

  // ════════════════════════════════════════════════════════════════════════
  // SITES 3-7: Portfolio 5 Sites (Multi-Sites persona)
  // ════════════════════════════════════════════════════════════════════════
  const [portfolioClient] = await db.insert(clients).values({
    name: "DÉMO — Groupe Automobile Régional",
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

  for (const ps of PORTFOLIO_SITES) {
    const rate = ps.tariff === "G" ? 0.11933 : 0.06061;
    const annualCost = Math.round(ps.annualKWh * rate * 1.15); // ~15% fixed charges
    const monthlyBase = Math.round(ps.annualKWh / 12);
    const peak = Math.round(ps.annualKWh / 8760 / 0.45);

    const monthly = Array.from({ length: 12 }, (_, i) => {
      const seasonFactor = [1.05, 1.0, 0.95, 0.90, 0.85, 0.90, 1.05, 1.10, 1.0, 0.95, 1.0, 1.15][i];
      return {
        kWh: Math.round(monthlyBase * seasonFactor),
        kW: Math.round(peak * seasonFactor),
        cost: Math.round((annualCost / 12) * seasonFactor),
      };
    });

    const history = buildConsumptionHistory(monthly);
    const pvCapex = ps.pvKW * 1000 * (ps.tariff === "G" ? 2.40 : 2.10);

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
      maxDemandKw: peak,
      hqConsumptionHistory: history,
      quickAnalysisSystemSizeKw: ps.pvKW,
      quickAnalysisAnnualProductionKwh: Math.round(ps.pvKW * 1150),
      quickAnalysisAnnualSavings: Math.round(ps.pvKW * 1150 * rate),
      quickAnalysisGrossCapex: pvCapex,
      quickAnalysisMonthlyBill: Math.round(annualCost / 12),
    }).returning();

    portfolioSiteIds.push(pSite.id);
    totalPvKW += ps.pvKW;
    totalCapex += pvCapex;

    await db.insert(opportunities).values({
      siteId: pSite.id,
      clientId: portfolioClient.id,
      name: `${ps.name} — ${ps.pvKW} kWc Solaire`,
      stage: "prospect",
      probability: 10,
      estimatedValue: pvCapex,
      pvSizeKW: ps.pvKW,
      source: "referral",
      priority: "medium",
      tags: ["demo", "portfolio", `tarif-${ps.tariff}`],
    });
  }

  // Create portfolio
  const totalProduction = totalPvKW * 1150;
  const totalAnnualKWh = PORTFOLIO_SITES.reduce((s, p) => s + p.annualKWh, 0);

  await db.insert(portfolios).values({
    clientId: portfolioClient.id,
    name: "DÉMO — Portfolio Groupe Automobile Régional",
    description: "Déploiement solaire multi-sites: 3 concessionnaires + centre de distribution + atelier carrosserie",
    siteIds: portfolioSiteIds,
    totalPvSizeKw: totalPvKW,
    totalCapex: totalCapex,
    totalAnnualSavings: Math.round(totalProduction * 0.09), // blended rate
    totalCo2AvoidedTonnes: Math.round(totalProduction * 0.0005 * 10) / 10,
    consolidatedNpv: Math.round(totalProduction * 0.09 * 14.5 - totalCapex * 0.35),
    consolidatedIrr: 17.2,
    tags: ["demo", "multi-sites", "automobile"],
  });

  console.log(`✅ Portfolio: 5 sites, ${totalPvKW} kWc total, ${Math.round(totalAnnualKWh/1000)} MWh/an consommation`);

  // ─── Summary ────────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(60));
  console.log("🎉 3 SITES DÉMO CRÉÉS AVEC SUCCÈS!");
  console.log("═".repeat(60));
  console.log(`  1. Concessionnaire Laval  → Tarif G, ${DEALER_PV_KW} kWc, TRI 22.5%`);
  console.log(`  2. Usine Sherbrooke       → Tarif M, ${USINE_PV_KW} kWc, TRI 15.8%`);
  console.log(`  3. Portfolio 5 sites      → Mix G+M, ${totalPvKW} kWc, CAPEX $${Math.round(totalCapex/1000)}k`);
  console.log("═".repeat(60));
  console.log("\n👉 Les sites démo sont identifiables par le préfixe 'DÉMO —'");
  console.log("   Chacun a : client, site, simulation, opportunité dans le pipeline\n");

  process.exit(0);
}

seedDemoSites().catch((err) => {
  console.error("❌ Erreur:", err);
  process.exit(1);
});
