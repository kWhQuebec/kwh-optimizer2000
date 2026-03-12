import { storage } from "../server/storage";

async function testWeedon() {
  const siteId = "996990a9-081c-47f3-8c27-d46248cfd66d";
  const site = await storage.getSite(siteId);
  if (!site) { console.log("Site not found"); return; }
  
  // Get polygon area
  const polygons = await storage.getSolarPolygons(siteId);
  const polygonArea = polygons.reduce((sum, p) => sum + ((p as any).areaSqM || 0), 0);
  
  // KB Racking formula
  const roofUtilRatio = 0.85;
  const usableArea = polygonArea * roofUtilRatio;
  const formulaMaxPvKw = (usableArea / 3.71) * 0.660;
  
  console.log("=== WEEDON PV SIZING VALIDATION ===");
  console.log(`kbKwDc (Google Solar): ${site.kbKwDc} kW`);
  console.log(`Polygon area: ${polygonArea.toFixed(1)} m²`);
  console.log(`Usable area (85%): ${usableArea.toFixed(1)} m²`);
  console.log(`KB Racking maxPV: ${formulaMaxPvKw.toFixed(1)} kW`);
  console.log(`\nBEFORE fix: PV capped at ${site.kbKwDc} kW (kbKwDc)`);
  console.log(`AFTER fix: PV based on ${formulaMaxPvKw.toFixed(1)} kW (polygon area)`);
  console.log(`Improvement: +${(formulaMaxPvKw - (site.kbKwDc || 0)).toFixed(1)} kW (+${(((formulaMaxPvKw / (site.kbKwDc || 1)) - 1) * 100).toFixed(0)}%)`);
  
  // Check latest simulation
  const sims = await storage.getSimulationRunsBySite(siteId);
  if (sims.length > 0) {
    const latest = sims.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())[0];
    console.log(`\nLatest simulation PV: ${latest.pvSizeKW} kW (needs re-run to pick up new formula)`);
  }
  
  process.exit(0);
}
testWeedon().catch(e => { console.error(e); process.exit(1); });
