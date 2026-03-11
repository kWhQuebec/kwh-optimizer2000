/**
 * Debug Weedon site — investigate why sizing = 5 kW
 *
 * Usage: npx tsx scripts/debug-weedon.ts
 */

import { storage } from '../server/storage';

async function main() {
  const sites = await storage.getSites();

  // Find Weedon
  const weedon = sites.find((s: any) =>
    (s.name || '').toLowerCase().includes('weedon') ||
    (s.address || '').toLowerCase().includes('weedon') ||
    (s.name || '').toLowerCase().includes('fromagerie')
  );

  if (!weedon) {
    console.log('❌ Site Weedon non trouvé. Sites disponibles:');
    sites.forEach((s: any) => console.log(`  - ${s.name || 'Sans nom'} | ${s.address || 'Sans adresse'} | ID: ${s.id}`));
    process.exit(1);
  }

  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   DEBUG WEEDON — Sizing Investigation        ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  console.log('📍 SITE INFO:');
  console.log(`  ID:            ${weedon.id}`);
  console.log(`  Nom:           ${weedon.name}`);
  console.log(`  Adresse:       ${weedon.address}`);
  console.log(`  roofAreaSqM:   ${weedon.roofAreaSqM}`);
  console.log(`  buildingSqFt:  ${weedon.buildingSqFt}`);
  console.log(`  kbKwDc:        ${weedon.kbKwDc}`);
  console.log(`  maxDemandKw:   ${weedon.maxDemandKw}`);
  console.log(`  pfmKw:         ${weedon.pfmKw}`);
  console.log(`  hqTariffDetail:${weedon.hqTariffDetail}`);
  console.log(`  annualKwh:     ${weedon.annualConsumptionKwh || (weedon as any).annualConsumptionKWh}`);
  console.log(`  quickAnalysis: ${weedon.quickAnalysisSystemSizeKw} kW, payback ${weedon.quickAnalysisPaybackYears}y`);

  // Meter files
  const meterFiles = await storage.getMeterFilesBySite(weedon.id);
  console.log(`\n📁 METER FILES: ${meterFiles.length}`);
  for (const mf of meterFiles) {
    console.log(`  - ${(mf as any).originalFileName || mf.id} | type: ${(mf as any).fileType} | isSynthetic: ${(mf as any).isSynthetic} | granularity: ${(mf as any).granularity}`);
  }

  // Meter readings
  const readings = await storage.getMeterReadingsBySite(weedon.id);
  console.log(`\n📊 METER READINGS: ${readings.length} total`);

  if (readings.length === 0) {
    console.log('  ❌ AUCUNE LECTURE — voilà le problème!');
    process.exit(0);
  }

  // Analyze readings
  const kWhValues = readings.map(r => r.kWh || 0).filter(v => v !== 0);
  const kWValues = readings.map(r => r.kW || 0).filter(v => v !== 0);
  const granularities = [...new Set(readings.map(r => (r as any).granularity))];

  const timestamps = readings.map(r => new Date(r.timestamp));
  const minDate = new Date(Math.min(...timestamps.map(t => t.getTime())));
  const maxDate = new Date(Math.max(...timestamps.map(t => t.getTime())));
  const spanDays = (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);

  console.log(`\n📈 DATA ANALYSIS:`);
  console.log(`  Date range:    ${minDate.toISOString().slice(0,10)} → ${maxDate.toISOString().slice(0,10)} (${spanDays.toFixed(0)} jours)`);
  console.log(`  Granularités:  ${granularities.join(', ')}`);
  console.log(`  kWh values:    ${kWhValues.length} non-zero (min: ${Math.min(...kWhValues).toFixed(2)}, max: ${Math.max(...kWhValues).toFixed(2)}, sum: ${kWhValues.reduce((a,b)=>a+b,0).toFixed(0)})`);
  console.log(`  kW values:     ${kWValues.length} non-zero (min: ${Math.min(...kWValues).toFixed(2)}, max: ${Math.max(...kWValues).toFixed(2)})`);

  // Annualized
  const annualizationFactor = 365 / Math.max(spanDays, 1);
  const totalKWh = kWhValues.reduce((a,b) => a + b, 0);
  const annualKWh = totalKWh * annualizationFactor;
  const peakKW = kWValues.length > 0 ? Math.max(...kWValues) : 0;

  console.log(`\n🔑 SIZING INPUTS (ce qui détermine le dimensionnement):`);
  console.log(`  totalKWh raw:  ${totalKWh.toFixed(0)}`);
  console.log(`  annualized:    ${annualKWh.toFixed(0)} kWh/an (factor: ${annualizationFactor.toFixed(2)})`);
  console.log(`  peakKW:        ${peakKW.toFixed(2)} kW  ⚠️ C'EST LE CAP PV (règle mesurage net)`);

  // What sizing would be
  const yieldKwh = 1150;
  const targetPV = (annualKWh / yieldKwh) * 1.2;
  const maxPVFromRoof = weedon.kbKwDc || ((weedon.roofAreaSqM || 0) * 0.85 / 3.71 * 0.660);
  const pvSize = Math.min(Math.round(targetPV), Math.round(maxPVFromRoof), Math.round(peakKW));

  console.log(`\n🧮 SIZING CALCULATION:`);
  console.log(`  targetPV (consumption):  ${targetPV.toFixed(1)} kW`);
  console.log(`  maxPVFromRoof:           ${maxPVFromRoof.toFixed(1)} kW`);
  console.log(`  peakKW (HQ cap):         ${peakKW.toFixed(1)} kW`);
  console.log(`  → pvSizeKW = min(${targetPV.toFixed(0)}, ${maxPVFromRoof.toFixed(0)}, ${peakKW.toFixed(0)}) = ${pvSize} kW`);

  if (peakKW < 50) {
    console.log(`\n⚠️  PROBLÈME IDENTIFIÉ: peakKW = ${peakKW.toFixed(2)} kW — anormalement bas pour un bâtiment commercial.`);
    console.log(`  Causes possibles:`);
    console.log(`  1. Données mensuelles (kWh totaux) interprétées comme horaires`);
    console.log(`  2. kW jamais peuplé dans les readings (que des kWh)`);
    console.log(`  3. Données 15-min mais kW pas calculé correctement`);
  }

  // Sample readings
  console.log(`\n📋 SAMPLE READINGS (5 premières + 5 dernières):`);
  const sample = [...readings.slice(0, 5), ...readings.slice(-5)];
  for (const r of sample) {
    console.log(`  ${new Date(r.timestamp).toISOString()} | kWh: ${(r.kWh || 0).toFixed(3)} | kW: ${(r.kW || 0).toFixed(3)} | gran: ${(r as any).granularity}`);
  }

  // Check latest simulation
  const simRuns = await storage.getSimulationRunsBySite(weedon.id);
  if (simRuns.length > 0) {
    const latest = simRuns[simRuns.length - 1];
    console.log(`\n🔬 DERNIÈRE SIMULATION:`);
    console.log(`  ID:            ${latest.id}`);
    console.log(`  Date:          ${latest.createdAt}`);
    console.log(`  PV:            ${latest.pvSizeKW} kW`);
    console.log(`  Batt:          ${latest.battEnergyKWh} kWh / ${latest.battPowerKW} kW`);
    console.log(`  Peak demand:   ${latest.peakDemandKW} kW`);
    console.log(`  Annual kWh:    ${latest.annualConsumptionKWh}`);
    console.log(`  Savings:       $${latest.annualSavings}`);
    console.log(`  NPV25:         $${latest.npv25}`);
    console.log(`  Payback:       ${latest.simplePaybackYears} ans`);

    // Check breakdown for margin
    const bk = latest.breakdown as any;
    if (bk?.internalMargin) {
      console.log(`\n💰 MARGE INTERNE:`);
      const m = bk.internalMargin;
      console.log(`  Coût solar:    $${m.costSolar}`);
      console.log(`  Vente solar:   $${m.sellSolar}`);
      console.log(`  Marge solar:   $${m.marginDollarsSolar} (${m.marginPercentSolar?.toFixed(1)}%)`);
      console.log(`  Marge totale:  $${m.marginDollarsTotal} (${m.marginPercentTotal?.toFixed(1)}%)`);
      console.log(`  Estimé:        ${m.isEstimated}`);
    } else {
      console.log(`\n💰 MARGE INTERNE: ❌ Absente du breakdown (analyse faite avant le commit margin)`);
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
