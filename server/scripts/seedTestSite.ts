/**
 * Seed Script: Create "TEST - Won & Delivered" site with complete data
 *
 * Creates a full test site with:
 * - Client + Site with HQ consumption history
 * - Simulation run with realistic production data
 * - Construction agreement (completed)
 * - Opportunity at won_delivered stage
 * - Baseline snapshot (auto-set)
 * - Project budgets (8 categories)
 * - Meter file + meter readings (post-installation)
 *
 * Usage: npx tsx server/scripts/seedTestSite.ts
 */

import { db } from "../db";
import {
  clients,
  sites,
  simulationRuns,
  constructionAgreements,
  opportunities,
  projectBudgets,
  meterFiles,
  meterReadings,
} from "@shared/schema";
import { sql } from "drizzle-orm";

// ─── Configuration ──────────────────────────────────────────────────────────
const SYSTEM_SIZE_KW = 150;
const ANNUAL_PRODUCTION_KWH = 172500; // ~1150 kWh/kWp
const COST_PER_W = 2.25;
const CAPEX_GROSS = SYSTEM_SIZE_KW * 1000 * COST_PER_W; // $337,500
const HQ_INCENTIVE = SYSTEM_SIZE_KW * 1000; // $150,000 ($1/W)
const FEDERAL_ITC = CAPEX_GROSS * 0.30; // $101,250
const TAX_SHIELD = (CAPEX_GROSS - HQ_INCENTIVE) * 0.265 * 0.5; // ~$24,844
const CAPEX_NET = CAPEX_GROSS - HQ_INCENTIVE - FEDERAL_ITC - TAX_SHIELD;

// Realistic monthly consumption profile for a 100,000 sqft industrial building in Quebec
// Higher in winter (heating + lighting), lower in summer
const MONTHLY_CONSUMPTION = [
  { month: 1,  kWh: 52000, kW: 220, cost: 3152 },  // Jan
  { month: 2,  kWh: 48000, kW: 210, cost: 2909 },  // Fév
  { month: 3,  kWh: 44000, kW: 195, cost: 2667 },  // Mar
  { month: 4,  kWh: 38000, kW: 175, cost: 2303 },  // Avr
  { month: 5,  kWh: 32000, kW: 160, cost: 1939 },  // Mai
  { month: 6,  kWh: 30000, kW: 155, cost: 1818 },  // Jun
  { month: 7,  kWh: 35000, kW: 170, cost: 2121 },  // Jul (climatisation)
  { month: 8,  kWh: 34000, kW: 165, cost: 2061 },  // Aoû
  { month: 9,  kWh: 33000, kW: 160, cost: 2000 },  // Sep
  { month: 10, kWh: 38000, kW: 175, cost: 2303 },  // Oct
  { month: 11, kWh: 45000, kW: 200, cost: 2727 },  // Nov
  { month: 12, kWh: 51000, kW: 215, cost: 3091 },  // Déc
];

const ANNUAL_CONSUMPTION = MONTHLY_CONSUMPTION.reduce((s, m) => s + m.kWh, 0); // ~480,000 kWh
const ANNUAL_COST = MONTHLY_CONSUMPTION.reduce((s, m) => s + m.cost, 0);
const PEAK_DEMAND = Math.max(...MONTHLY_CONSUMPTION.map(m => m.kW));

// Build hqConsumptionHistory (last 24 months)
function buildHqConsumptionHistory() {
  const history: any[] = [];
  const now = new Date();
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthIdx = d.getMonth(); // 0-indexed
    const entry = MONTHLY_CONSUMPTION[monthIdx];
    // Add ±5% random variance for realism
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

// Budget category ratios (matching price-breakdown)
const BUDGET_ITEMS = [
  { category: "racking",        ratio: 0.18, description: "KB Racking AeroGrid 10° - 228 panneaux" },
  { category: "panels",         ratio: 0.28, description: "Jinko Tiger Neo 660W bifacial × 228" },
  { category: "inverters",      ratio: 0.12, description: "Huawei SUN2000-100KTL-M2 × 2" },
  { category: "bos_electrical", ratio: 0.10, description: "BOS électrique: câblage, combiners, protection" },
  { category: "labor",          ratio: 0.20, description: "Installation main-d'œuvre (3 semaines)" },
  { category: "soft_costs",     ratio: 0.07, description: "Ingénierie, assurances, gestion de projet" },
  { category: "permits",        ratio: 0.05, description: "Permis municipaux et RBQ" },
  { category: "other",          ratio: 0.00, description: "Contingence" },
];

// ─── Seed function ──────────────────────────────────────────────────────────
async function seedTestSite() {
  console.log("🌱 Creating TEST - Won & Delivered...\n");

  // 1. Create client
  const [client] = await db.insert(clients).values({
    name: "TEST Industriel Inc.",
    mainContactName: "Jean Tremblay",
    email: "jean.tremblay@test-industriel.ca",
    phone: "514-555-0199",
    address: "4500 Boulevard Industriel",
    city: "Longueuil",
    province: "QC",
    postalCode: "J4G 1S8",
    accountManagerEmail: "malabarre@kwh.quebec",
  }).returning();
  console.log(`✅ Client: ${client.id} — ${client.name}`);

  // 2. Create site with full HQ data
  const hqHistory = buildHqConsumptionHistory();
  const opsStartDate = new Date();
  opsStartDate.setMonth(opsStartDate.getMonth() - 6); // In operation since 6 months

  // Build baseline from last 12 months of history (same logic as auto-baseline hook)
  const last12 = hqHistory.slice(-12);
  const baselineProfile = last12.map((entry, idx) => ({
    month: idx + 1,
    kWh: entry.kWh,
    cost: entry.amount,
  }));
  const baselineAnnualKwh = baselineProfile.reduce((s, m) => s + m.kWh, 0);
  const baselineAnnualCost = baselineProfile.reduce((s, m) => s + m.cost, 0);

  const [site] = await db.insert(sites).values({
    clientId: client.id,
    name: "TEST - Won & Delivered",
    address: "4500 Boulevard Industriel",
    city: "Longueuil",
    province: "QC",
    postalCode: "J4G 1S8",
    buildingType: "industrial",
    roofType: "flat",
    roofAreaSqM: 9290, // ~100,000 sqft
    latitude: 45.5369,
    longitude: -73.5114,
    roofAreaValidated: true,
    roofAreaValidatedAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
    roofEstimateStatus: "success",
    kbDesignStatus: "complete",
    kbPanelCount: 228,
    kbKwDc: 150.48,
    kbPricePerPanel: 265,
    kbRackingSubtotal: 60420,
    buildingSqFt: 100000,
    yearBuilt: 1998,
    hqTariffDetail: "M",
    hqClientNumber: "123456789",
    hqAccountNumber: "123456789012",
    hqContractNumber: "CT-2024-TEST",
    subscribedPowerKw: 250,
    maxDemandKw: PEAK_DEMAND,
    hqConsumptionHistory: hqHistory,
    // Baseline (pre-set as if auto-hook already ran)
    baselineSnapshotDate: opsStartDate,
    baselineAnnualConsumptionKwh: baselineAnnualKwh,
    baselineAnnualCostCad: baselineAnnualCost,
    baselinePeakDemandKw: PEAK_DEMAND,
    baselineMonthlyProfile: baselineProfile,
    operationsStartDate: opsStartDate,
    // Quick analysis cache
    quickAnalysisSystemSizeKw: SYSTEM_SIZE_KW,
    quickAnalysisAnnualProductionKwh: ANNUAL_PRODUCTION_KWH,
    quickAnalysisAnnualSavings: Math.round(ANNUAL_PRODUCTION_KWH * 0.06061),
    quickAnalysisPaybackYears: 5.2,
    quickAnalysisGrossCapex: CAPEX_GROSS,
    quickAnalysisNetCapex: Math.round(CAPEX_NET),
    quickAnalysisHqIncentive: HQ_INCENTIVE,
    quickAnalysisMonthlyBill: Math.round(ANNUAL_COST / 12),
  }).returning();
  console.log(`✅ Site: ${site.id} — ${site.name}`);

  // 3. Create simulation run
  const annualSavings = Math.round(ANNUAL_PRODUCTION_KWH * 0.06061);
  const [sim] = await db.insert(simulationRuns).values({
    siteId: site.id,
    label: "Scénario principal — 150 kW",
    type: "BASELINE",
    pvSizeKW: SYSTEM_SIZE_KW,
    battEnergyKWh: 0,
    battPowerKW: 0,
    annualConsumptionKWh: ANNUAL_CONSUMPTION,
    peakDemandKW: PEAK_DEMAND,
    annualEnergySavingsKWh: ANNUAL_PRODUCTION_KWH,
    totalProductionKWh: ANNUAL_PRODUCTION_KWH,
    totalExportedKWh: Math.round(ANNUAL_PRODUCTION_KWH * 0.15), // 15% exported
    annualSurplusRevenue: Math.round(ANNUAL_PRODUCTION_KWH * 0.15 * 0.046),
    selfConsumptionKWh: Math.round(ANNUAL_PRODUCTION_KWH * 0.85),
    selfSufficiencyPercent: Math.round((ANNUAL_PRODUCTION_KWH * 0.85 / ANNUAL_CONSUMPTION) * 100),
    annualCostBefore: ANNUAL_COST,
    annualCostAfter: ANNUAL_COST - annualSavings,
    annualSavings: annualSavings,
    savingsYear1: annualSavings,
    capexGross: CAPEX_GROSS,
    capexPV: CAPEX_GROSS,
    capexBattery: 0,
    incentivesHQ: HQ_INCENTIVE,
    incentivesHQSolar: HQ_INCENTIVE,
    incentivesHQBattery: 0,
    incentivesFederal: FEDERAL_ITC,
    taxShield: Math.round(TAX_SHIELD),
    totalIncentives: Math.round(HQ_INCENTIVE + FEDERAL_ITC + TAX_SHIELD),
    capexNet: Math.round(CAPEX_NET),
    npv25: Math.round(annualSavings * 14.5 - CAPEX_NET), // Rough NPV
    irr25: 18.5,
    simplePaybackYears: 5.2,
    lcoe: 0.035,
    npv30: Math.round(annualSavings * 16 - CAPEX_NET),
    irr30: 19.2,
    lcoe30: 0.032,
    co2AvoidedTonnesPerYear: Math.round(ANNUAL_PRODUCTION_KWH * 0.0005 * 10) / 10,
    assumptions: {
      tariffCode: "M",
      tariffEnergy: 0.06061,
      tariffPower: 0,
      solarYieldKWhPerKWp: 1150,
      orientationFactor: 1.0,
      rackingSystemType: "kb_10_low",
      inverterLoadRatio: 1.45,
      degradationRatePercent: 0.004,
      inflationRate: 0.035,
      discountRate: 0.07,
      taxRate: 0.265,
      solarCostPerW: COST_PER_W,
      analysisYears: 25,
      bifacialEnabled: true,
      bifacialityFactor: 0.80,
      roofAlbedo: 0.60,
      epcMargin: 0.35,
    },
    breakdown: {
      capexSolar: CAPEX_GROSS,
      capexBattery: 0,
      capexGross: CAPEX_GROSS,
      actualHQSolar: HQ_INCENTIVE,
      actualHQBattery: 0,
      totalHQ: HQ_INCENTIVE,
      itcAmount: FEDERAL_ITC,
      taxShield: Math.round(TAX_SHIELD),
      capexNet: Math.round(CAPEX_NET),
    },
  }).returning();
  console.log(`✅ Simulation: ${sim.id} — ${sim.label}`);

  // 4. Create construction agreement (completed)
  const contractDate = new Date(opsStartDate);
  contractDate.setMonth(contractDate.getMonth() - 4); // Signed 4 months before ops
  const startDate = new Date(opsStartDate);
  startDate.setMonth(startDate.getMonth() - 3); // Construction started 3 months before ops

  const [agreement] = await db.insert(constructionAgreements).values({
    siteId: site.id,
    contractNumber: "CA-TEST-2025-001",
    status: "completed",
    pvSizeKW: SYSTEM_SIZE_KW,
    batteryEnergyKWh: 0,
    totalContractValue: CAPEX_GROSS,
    currency: "CAD",
    depositPercent: 30,
    depositAmount: Math.round(CAPEX_GROSS * 0.30),
    depositPaidAt: contractDate,
    estimatedStartDate: startDate,
    estimatedCompletionDate: opsStartDate,
    actualStartDate: startDate,
    actualCompletionDate: opsStartDate,
    warrantyYears: 10,
    acceptedByName: "Jean Tremblay",
    acceptedByEmail: "jean.tremblay@test-industriel.ca",
    acceptedByTitle: "Directeur général",
    acceptedAt: contractDate,
    paymentSchedule: [
      { milestone: "Dépôt", percent: 30, amount: Math.round(CAPEX_GROSS * 0.30), paidAt: contractDate.toISOString() },
      { milestone: "Début construction", percent: 30, amount: Math.round(CAPEX_GROSS * 0.30), paidAt: startDate.toISOString() },
      { milestone: "Livraison", percent: 40, amount: Math.round(CAPEX_GROSS * 0.40), paidAt: opsStartDate.toISOString() },
    ],
  }).returning();
  console.log(`✅ Contrat: ${agreement.id} — ${agreement.contractNumber}`);

  // 5. Create opportunity (won_delivered)
  const [opp] = await db.insert(opportunities).values({
    siteId: site.id,
    clientId: client.id,
    name: "TEST - Won & Delivered — 150 kW Solar",
    stage: "won_delivered",
    probability: 100,
    estimatedValue: CAPEX_GROSS,
    pvSizeKW: SYSTEM_SIZE_KW,
    expectedCloseDate: contractDate,
    actualCloseDate: contractDate,
    engineeringOutcome: "proceed",
    source: "referral",
    priority: "high",
    tags: ["test", "industriel", "150kW"],
  }).returning();
  console.log(`✅ Opportunity: ${opp.id} — ${opp.name}`);

  // 6. Create project budgets (8 categories)
  for (const item of BUDGET_ITEMS) {
    const original = Math.round(CAPEX_GROSS * item.ratio);
    // Simulate realistic variances: revised ~same, committed ~95-105%, actual ~90-110%
    const revised = item.ratio > 0 ? Math.round(original * (0.98 + Math.random() * 0.04)) : 0;
    const committed = item.ratio > 0 ? Math.round(original * (0.95 + Math.random() * 0.10)) : 0;
    const actual = item.ratio > 0 ? Math.round(original * (0.90 + Math.random() * 0.15)) : 0;

    await db.insert(projectBudgets).values({
      siteId: site.id,
      category: item.category,
      description: item.description,
      originalAmount: original,
      revisedAmount: revised,
      committedAmount: committed,
      actualAmount: actual,
    });
  }
  console.log(`✅ Budgets: 8 catégories créées`);

  // 7. Create meter file + meter readings (6 months post-installation)
  // Monthly solar production profile for Quebec (higher in summer, lower in winter)
  const SOLAR_MONTHLY_RATIO = [
    0.04, 0.05, 0.08, 0.10, 0.12, 0.13,  // Jan-Jun
    0.13, 0.12, 0.09, 0.07, 0.04, 0.03,  // Jul-Dec
  ];

  const [meterFile] = await db.insert(meterFiles).values({
    siteId: site.id,
    fileName: "test-post-installation-readings.csv",
    periodStart: opsStartDate,
    periodEnd: new Date(),
    granularity: "HOUR",
    status: "PARSED",
    isSynthetic: true,
  }).returning();
  console.log(`✅ MeterFile: ${meterFile.id}`);

  // Generate daily readings for 6 months post-installation
  // Actual consumption = baseline - solar_production * achievement_factor
  const readingsToInsert: any[] = [];
  const cursor = new Date(opsStartDate);
  const now = new Date();

  while (cursor < now) {
    const monthIdx = cursor.getMonth();
    const daysInMonth = new Date(cursor.getFullYear(), monthIdx + 1, 0).getDate();
    const baselineMonthly = MONTHLY_CONSUMPTION[monthIdx].kWh;
    const solarProduction = ANNUAL_PRODUCTION_KWH * SOLAR_MONTHLY_RATIO[monthIdx];

    // Achievement ~82% of predicted savings (realistic first year)
    const achievementFactor = 0.78 + Math.random() * 0.08; // 78-86%
    const actualMonthlyConsumption = baselineMonthly - (solarProduction * achievementFactor);
    const dailyConsumption = actualMonthlyConsumption / daysInMonth;

    // Create one reading per day for this month
    for (let day = 1; day <= daysInMonth; day++) {
      const readingDate = new Date(cursor.getFullYear(), monthIdx, day, 12, 0, 0);
      if (readingDate > now) break;

      // Add daily variance ±10%
      const dailyVariance = 0.90 + Math.random() * 0.20;
      readingsToInsert.push({
        meterFileId: meterFile.id,
        timestamp: readingDate,
        granularity: "HOUR",
        kWh: Math.round(dailyConsumption * dailyVariance * 100) / 100,
        kW: Math.round((dailyConsumption * dailyVariance / 24) * 100) / 100,
      });
    }

    // Move to next month
    cursor.setMonth(cursor.getMonth() + 1);
    cursor.setDate(1);
  }

  // Batch insert readings (chunked to avoid query size limits)
  const CHUNK_SIZE = 100;
  for (let i = 0; i < readingsToInsert.length; i += CHUNK_SIZE) {
    const chunk = readingsToInsert.slice(i, i + CHUNK_SIZE);
    await db.insert(meterReadings).values(chunk);
  }
  console.log(`✅ MeterReadings: ${readingsToInsert.length} lectures quotidiennes insérées`);

  // ─── Summary ────────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(60));
  console.log("🎉 TEST SITE CRÉÉ AVEC SUCCÈS!");
  console.log("═".repeat(60));
  console.log(`  Client:      ${client.name} (${client.id})`);
  console.log(`  Site:        ${site.name} (${site.id})`);
  console.log(`  Système:     ${SYSTEM_SIZE_KW} kW — ${Math.round(ANNUAL_PRODUCTION_KWH / 1000)} MWh/an`);
  console.log(`  CAPEX:       $${CAPEX_GROSS.toLocaleString()} brut → $${Math.round(CAPEX_NET).toLocaleString()} net`);
  console.log(`  En opération depuis: ${opsStartDate.toLocaleDateString("fr-CA")}`);
  console.log(`  Lectures:    ${readingsToInsert.length} jours`);
  console.log(`  Baseline:    ${baselineAnnualKwh.toLocaleString()} kWh/an — $${baselineAnnualCost.toLocaleString()}/an`);
  console.log("═".repeat(60));
  console.log("\n👉 Ouvre le site dans l'app → Onglet Opérations pour voir:");
  console.log("   • Budget 4 colonnes");
  console.log("   • Réconciliation HQ (6 mois de données)");
  console.log("   • Performance baseline vs post-installation\n");

  process.exit(0);
}

seedTestSite().catch((err) => {
  console.error("❌ Erreur:", err);
  process.exit(1);
});
