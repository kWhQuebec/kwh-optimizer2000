/**
 * Debug script: trace the full analysis pipeline for Fromagerie Weedon
 * Calls functions DIRECTLY (not HTTP) → loads the newly pulled code
 */
import { storage } from "../server/storage";
import { deduplicateMeterReadingsByHour, runPotentialAnalysis, getDefaultAnalysisAssumptions, resolveYieldStrategy } from "../server/routes/siteAnalysisHelpers";

async function debug() {
  const WEEDON_SITE_ID = "996990a9-081c-47f3-8c27-d46248cfd66d";

  console.log("=== DEBUG WEEDON ANALYSIS PIPELINE ===\n");

  // 1. Fetch readings
  const readings = await storage.getMeterReadingsBySite(WEEDON_SITE_ID);
  console.log(`1. Raw readings: ${readings.length}`);

  // Show granularity breakdown
  const byGran: Record<string, number> = {};
  for (const r of readings) {
    byGran[r.granularity] = (byGran[r.granularity] || 0) + 1;
  }
  console.log(`   Granularity breakdown:`, byGran);

  // 2. Run dedup
  const mapped = readings.map(r => ({
    kWh: r.kWh,
    kW: r.kW,
    timestamp: new Date(r.timestamp),
    granularity: r.granularity || undefined
  }));

  const dedupResult = deduplicateMeterReadingsByHour(mapped);
  console.log(`\n2. Dedup result: ${dedupResult.readings.length} hourly readings, dataSpan=${dedupResult.dataSpanDays.toFixed(1)} days`);

  // Stats on dedup output
  let nullKwh = 0, zeroKwh = 0, posKwh = 0, sumKwh = 0;
  let nullKw = 0, zeroKw = 0, posKw = 0, maxKw = 0;
  for (const r of dedupResult.readings) {
    if (r.kWh === null) nullKwh++;
    else if (r.kWh === 0) zeroKwh++;
    else { posKwh++; sumKwh += r.kWh; }

    if (r.kW === null) nullKw++;
    else if (r.kW === 0) zeroKw++;
    else { posKw++; if (r.kW > maxKw) maxKw = r.kW; }
  }
  console.log(`   kWh: null=${nullKwh}, zero=${zeroKwh}, positive=${posKwh}, sum=${sumKwh.toFixed(0)}`);
  console.log(`   kW:  null=${nullKw}, zero=${zeroKw}, positive=${posKw}, max=${maxKw.toFixed(1)}`);

  // Sample first 5 non-null readings
  const samples = dedupResult.readings.filter(r => r.kWh !== null && r.kWh > 0).slice(0, 5);
  console.log(`   Sample readings:`, samples.map(r => ({ ts: r.timestamp.toISOString().slice(0,13), kWh: r.kWh?.toFixed(1), kW: r.kW?.toFixed(1) })));

  // 3. Annualized consumption
  const annualKWh = dedupResult.readings.reduce((sum, r) => sum + (r.kWh || 0), 0);
  const dataSpanFactor = 365 / Math.max(dedupResult.dataSpanDays, 1);
  const annualizedKWh = annualKWh * dataSpanFactor;
  const peakKW = dedupResult.readings.reduce((max, r) => Math.max(max, r.kW || 0), 0);
  console.log(`\n3. Annual consumption: ${annualizedKWh.toFixed(0)} kWh (raw sum=${annualKWh.toFixed(0)}, factor=${dataSpanFactor.toFixed(2)})`);
  console.log(`   Peak kW: ${peakKW.toFixed(1)}`);

  // 4. Tariff detection
  const { detectTariff } = await import("../server/hqTariffs");
  const hasRealPower = dedupResult.readings.some(r => r.kW !== null && r.kW > 0);
  const detected = detectTariff(peakKW, annualizedKWh, hasRealPower);
  let tariffCode = detected.detectedTariff;
  if (tariffCode === "D" || tariffCode === "Flex D") {
    tariffCode = peakKW >= 65 ? "M" : "G";
  }
  console.log(`\n4. Tariff: ${tariffCode} (detected=${detected.detectedTariff}, peak=${peakKW.toFixed(1)}kW, annual=${annualizedKWh.toFixed(0)}kWh, hasPower=${hasRealPower})`);

  // 5. Run full analysis
  const site = await storage.getSite(WEEDON_SITE_ID);
  if (!site) { console.log("Site not found!"); process.exit(1); }

  const baseAssumptions = {
    ...getDefaultAnalysisAssumptions(),
    bifacialEnabled: true
  };
  const roofDetails = site.roofAreaAutoDetails as any;
  const googleData = roofDetails?.yearlyEnergyDcKwh && (site as any).kbKwDc
    ? { googleProductionEstimate: { yearlyEnergyAcKwh: roofDetails.yearlyEnergyDcKwh, systemSizeKw: (site as any).kbKwDc } }
    : undefined;

  const yieldStrategy = resolveYieldStrategy(baseAssumptions as any, googleData, (site as any).roofColorType);

  const rateMap: Record<string, { energy: number; power: number }> = {
    "G": { energy: 0.11933, power: 21.261 },
    "M": { energy: 0.06061, power: 17.573 },
    "L": { energy: 0.03681, power: 14.476 },
  };
  const rates = rateMap[tariffCode] || rateMap["M"];

  const polygons = await storage.getRoofPolygons(WEEDON_SITE_ID);
  const solarPolygons = polygons.filter((p: any) => {
    if (p.color === "#f97316") return false;
    const label = (p.label || "").toLowerCase();
    return !label.includes("constraint") && !label.includes("contrainte");
  });
  const tracedArea = solarPolygons.reduce((sum: number, p: any) => sum + (p.areaSqM || 0), 0);
  const effectiveArea = tracedArea > 0 ? tracedArea : (site.roofAreaSqM || site.roofAreaAutoSqM || 0);
  const usable = effectiveArea * 0.85;
  const maxPV = (usable / 3.71) * 0.660;
  const kbMaxPv = (site as any).kbKwDc && (site as any).kbKwDc > 0 ? (site as any).kbKwDc : maxPV;

  console.log(`\n5. Roof: traced=${tracedArea.toFixed(0)}m², effective=${effectiveArea.toFixed(0)}m², maxPV=${kbMaxPv.toFixed(1)}kW`);

  const analysisAssumptions: any = {
    ...baseAssumptions,
    solarYieldKWhPerKWp: yieldStrategy.effectiveYield,
    yieldSource: yieldStrategy.yieldSource,
    _yieldStrategy: yieldStrategy,
    tariffEnergy: rates.energy,
    tariffPower: rates.power,
    tariffCode,
    roofAreaSqFt: effectiveArea * 10.764,
    maxPVFromRoofKw: kbMaxPv,
  };

  const result = runPotentialAnalysis(
    dedupResult.readings,
    analysisAssumptions,
    { preCalculatedDataSpanDays: dedupResult.dataSpanDays }
  );

  console.log(`\n6. ANALYSIS RESULTS:`);
  console.log(`   PV Size: ${result.pvSizeKW} kW`);
  console.log(`   Battery: ${result.battEnergyKWh} kWh / ${result.battPowerKW} kW`);
  console.log(`   Annual Consumption: ${result.annualConsumptionKWh?.toFixed(0)} kWh`);
  console.log(`   Peak Demand: ${result.peakDemandKW?.toFixed(1)} kW`);
  console.log(`   Self-Consumption: ${result.selfConsumptionKWh?.toFixed(0)} kWh`);
  console.log(`   Total Production: ${result.totalProductionKWh?.toFixed(0)} kWh`);
  console.log(`   Total Exported: ${result.totalExportedKWh?.toFixed(0)} kWh`);
  console.log(`   Self-Sufficiency: ${result.selfSufficiencyPercent?.toFixed(1)}%`);
  console.log(`   Annual Cost Before: $${result.annualCostBefore?.toFixed(0)}`);
  console.log(`   Annual Cost After: $${result.annualCostAfter?.toFixed(0)}`);
  console.log(`   ⭐ Annual Savings: $${result.annualSavings?.toFixed(0)}`);
  console.log(`   NPV25: $${result.npv25?.toFixed(0)}`);
  console.log(`   IRR25: ${(result.irr25 * 100)?.toFixed(1)}%`);
  console.log(`   Simple Payback: ${result.simplePaybackYears?.toFixed(1)} years`);
  console.log(`   LCOE: $${result.lcoe?.toFixed(4)}/kWh`);
  console.log(`   Tariff: ${tariffCode} (energy=$${rates.energy}/kWh, power=$${rates.power}/kW)`);

  process.exit(0);
}

debug().catch(e => { console.error(e); process.exit(1); });
