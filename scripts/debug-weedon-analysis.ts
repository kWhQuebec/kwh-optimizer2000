/**
 * Debug Weedon analysis results — understand why $286/an for 106 kW
 * Usage: npx tsx scripts/debug-weedon-analysis.ts
 */
import { db } from '../server/db';
import { sites, meterFiles, meterReadings, simulationRuns, roofPolygons } from '../shared/schema';
import { eq, sql, desc } from 'drizzle-orm';

const SITE_ID = '996990a9-081c-47f3-8c27-d46248cfd66d';

async function main() {
  // 1. Get latest simulation
  const sims = await db.select().from(simulationRuns)
    .where(eq(simulationRuns.siteId, SITE_ID))
    .orderBy(desc(simulationRuns.createdAt))
    .limit(1);

  if (sims.length === 0) {
    console.log('No simulations found!');
    process.exit(1);
  }

  const sim = sims[0];
  const assumptions = sim.assumptions as any;

  console.log('=== LATEST SIMULATION RESULTS ===');
  console.log(`pvSizeKW:              ${sim.pvSizeKW}`);
  console.log(`battEnergyKWh:         ${sim.battEnergyKWh}`);
  console.log(`battPowerKW:           ${sim.battPowerKW}`);
  console.log(`annualConsumptionKWh:  ${sim.annualConsumptionKWh}`);
  console.log(`peakDemandKW:          ${sim.peakDemandKW}`);
  console.log(`totalProductionKWh:    ${sim.totalProductionKWh}`);
  console.log(`selfConsumptionKWh:    ${sim.selfConsumptionKWh}`);
  console.log(`totalExportedKWh:      ${sim.totalExportedKWh}`);
  console.log(`selfSufficiencyPercent: ${sim.selfSufficiencyPercent}`);
  console.log(`annualEnergySavingsKWh: ${sim.annualEnergySavingsKWh}`);
  console.log(`annualEnergyCostSavings: ${sim.annualEnergyCostSavings}`);
  console.log(`annualDemandCostSavings: ${sim.annualDemandCostSavings}`);
  console.log(`annualDemandReductionKW: ${sim.annualDemandReductionKW}`);
  console.log(`annualSurplusRevenue:  ${sim.annualSurplusRevenue}`);
  console.log(`totalAnnualSavings:    ${sim.totalAnnualSavings}`);
  console.log(`systemCost:            ${sim.systemCost}`);
  console.log(`simplePaybackYears:    ${sim.simplePaybackYears}`);
  console.log(`npv:                   ${sim.npv}`);
  console.log(`irr:                   ${sim.irr}`);
  console.log(`lcoe:                  ${sim.lcoe}`);
  console.log(`demandShavingSetpoint:  ${sim.demandShavingSetpointKW}`);

  console.log('\n=== KEY ASSUMPTIONS ===');
  console.log(`solarYieldKWhPerKWp:   ${assumptions?.solarYieldKWhPerKWp}`);
  console.log(`yieldSource:           ${assumptions?.yieldSource}`);
  console.log(`roofAreaSqFt:          ${assumptions?.roofAreaSqFt}`);
  console.log(`maxPVFromRoofKw:       ${assumptions?.maxPVFromRoofKw}`);
  console.log(`pfmKW:                 ${assumptions?.pfmKW}`);
  console.log(`energyRatePerKWh:      ${assumptions?.energyRatePerKWh}`);
  console.log(`demandRatePerKW:       ${assumptions?.demandRatePerKW}`);
  console.log(`hqTariff:              ${assumptions?.hqTariff}`);
  console.log(`roofUtilizationRatio:  ${assumptions?.roofUtilizationRatio}`);
  console.log(`batteryCapacityCost:   ${assumptions?.batteryCapacityCost}`);
  console.log(`batteryPowerCost:      ${assumptions?.batteryPowerCost}`);
  console.log(`bifacialBoost:         ${assumptions?.bifacialBoost}`);

  // 2. Check meter data stats
  const readingStats = await db.select({
    count: sql<number>`count(*)`,
    sumKwh: sql<number>`sum(kwh)`,
    sumKw: sql<number>`sum(kw)`,
    minKw: sql<number>`min(kw)`,
    maxKw: sql<number>`max(kw)`,
    avgKw: sql<number>`avg(kw)`,
    minTs: sql<string>`min(timestamp)`,
    maxTs: sql<string>`max(timestamp)`,
    nullKwh: sql<number>`sum(case when kwh is null or kwh = 0 then 1 else 0 end)`,
    hasKwh: sql<number>`sum(case when kwh > 0 then 1 else 0 end)`,
  }).from(meterReadings)
    .innerJoin(meterFiles, eq(meterReadings.meterFileId, meterFiles.id))
    .where(eq(meterFiles.siteId, SITE_ID));

  const stats = readingStats[0];
  console.log('\n=== METER DATA STATS ===');
  console.log(`Total readings:   ${stats.count}`);
  console.log(`Sum kWh (raw):    ${stats.sumKwh}`);
  console.log(`Sum kW:           ${stats.sumKw}`);
  console.log(`Min/Max/Avg kW:   ${stats.minKw} / ${stats.maxKw} / ${Number(stats.avgKw).toFixed(1)}`);
  console.log(`Date range:       ${stats.minTs} → ${stats.maxTs}`);
  console.log(`Null/zero kWh:    ${stats.nullKwh}`);
  console.log(`Has kWh > 0:      ${stats.hasKwh}`);

  // Expected annual kWh if derived from kW × 0.25
  const derivedTotal = Number(stats.sumKw) * 0.25;
  const minTs = new Date(stats.minTs as string);
  const maxTs = new Date(stats.maxTs as string);
  const spanDays = (maxTs.getTime() - minTs.getTime()) / (1000*60*60*24);
  const annualFactor = 365 / Math.max(spanDays, 1);
  console.log(`\nDerived total kWh: ${derivedTotal.toFixed(0)} (kW×0.25)`);
  console.log(`Data span:         ${spanDays.toFixed(0)} days`);
  console.log(`Annual factor:     ${annualFactor.toFixed(3)}`);
  console.log(`Expected annual:   ${(derivedTotal * annualFactor).toFixed(0)} kWh`);

  // 3. Check if some readings have BOTH kWh and kW
  const sampleWithBoth = await db.select({
    kWh: meterReadings.kWh,
    kW: meterReadings.kW,
    ts: meterReadings.timestamp,
    granularity: meterReadings.granularity,
  }).from(meterReadings)
    .innerJoin(meterFiles, eq(meterReadings.meterFileId, meterFiles.id))
    .where(eq(meterFiles.siteId, SITE_ID))
    .limit(20);

  console.log('\n=== SAMPLE READINGS (first 20) ===');
  for (const r of sampleWithBoth) {
    console.log(`  ${r.ts} | kWh=${r.kWh} | kW=${r.kW} | gran=${r.granularity}`);
  }

  // Check if the NEW site's 17 files have DIFFERENT data
  const fileStats = await db.select({
    id: meterFiles.id,
    fileName: meterFiles.fileName,
    granularity: meterFiles.granularity,
    readingCount: sql<number>`(select count(*) from meter_readings where meter_file_id = ${meterFiles.id})`,
  }).from(meterFiles)
    .where(eq(meterFiles.siteId, SITE_ID));

  console.log(`\n=== METER FILES (${fileStats.length}) ===`);
  for (const f of fileStats) {
    console.log(`  ${f.fileName} | ${f.granularity} | ${f.readingCount} readings`);
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
