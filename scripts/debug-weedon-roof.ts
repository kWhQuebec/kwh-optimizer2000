/**
 * Debug Weedon roof data
 * Usage: npx tsx scripts/debug-weedon-roof.ts
 */
import { storage } from '../server/storage';

async function main() {
  const siteId = 'f44bffd4-adca-48bc-8734-54af62cc350c';

  const site = await storage.getSite(siteId);
  console.log('SITE ROOF DATA:');
  console.log(`  roofAreaSqM:         ${site?.roofAreaSqM}`);
  console.log(`  roofAreaAutoSqM:     ${(site as any)?.roofAreaAutoSqM}`);
  console.log(`  buildingSqFt:        ${site?.buildingSqFt}`);
  console.log(`  buildingAreaSqM:     ${(site as any)?.buildingAreaSqM}`);
  console.log(`  kbKwDc:              ${site?.kbKwDc}`);
  console.log(`  roofAreaValidated:   ${(site as any)?.roofAreaValidated}`);
  console.log(`  roofColorType:       ${(site as any)?.roofColorType}`);
  console.log(`  roofAreaAutoDetails: ${JSON.stringify((site as any)?.roofAreaAutoDetails)?.substring(0, 200)}`);

  const polygons = await storage.getRoofPolygons(siteId);
  console.log(`\nROOF POLYGONS: ${polygons.length}`);
  for (const p of polygons) {
    console.log(`  - label: ${p.label} | area: ${p.areaSqM?.toFixed(1)}m² | color: ${p.color} | panels: ${(p as any).panels}`);
  }

  const totalArea = polygons.reduce((sum, p) => sum + (p.areaSqM || 0), 0);
  const solarPolygons = polygons.filter(p => {
    if (p.color === "#f97316") return false;
    const label = (p.label || "").toLowerCase();
    return !label.includes("constraint") && !label.includes("contrainte") && !label.includes("hvac") && !label.includes("obstacle");
  });
  const solarArea = solarPolygons.reduce((sum, p) => sum + (p.areaSqM || 0), 0);

  console.log(`\n  Total area:    ${totalArea.toFixed(1)} m²`);
  console.log(`  Solar area:    ${solarArea.toFixed(1)} m² (${solarPolygons.length} polygons)`);
  console.log(`  Max PV (KB):   ${(solarArea * 0.85 / 3.71 * 0.660).toFixed(1)} kW`);

  // Also check latest simulation
  const simRuns = await storage.getSimulationRunsBySite(siteId);
  if (simRuns.length > 0) {
    const latest = simRuns[simRuns.length - 1];
    console.log(`\nLATEST SIMULATION:`);
    console.log(`  pvSizeKW:     ${latest.pvSizeKW}`);
    console.log(`  assumptions:  roofAreaSqFt=${(latest.assumptions as any)?.roofAreaSqFt}, maxPVFromRoofKw=${(latest.assumptions as any)?.maxPVFromRoofKw}`);
  }

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
