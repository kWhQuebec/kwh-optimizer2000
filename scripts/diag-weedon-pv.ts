import { storage } from "../server/storage";
const siteId = "996990a9-081c-47f3-8c27-d46248cfd66d";
async function main() {
  const site = await storage.getSite(siteId) as any;
  console.log("=== WEEDON PV DIAGNOSTIC ===");
  console.log("kbKwDc:", site.kbKwDc);
  console.log("kbPanelCount:", site.kbPanelCount);
  console.log("roofAreaSqM:", site.roofAreaSqM);
  console.log("roofAreaAutoSqM:", site.roofAreaAutoSqM);
  const polygons = await storage.getRoofPolygons(siteId);
  const solarPolygons = polygons.filter((p: any) => {
    if (p.color === "#F97316") return false;
    const label = (p.label || "").toLowerCase();
    return !label.includes("constraint") && !label.includes("contrainte") && !label.includes("hvac") && !label.includes("obstacle");
  });
  const polygonArea = solarPolygons.reduce((s: number, p: any) => s + (p.areaSqM || 0), 0);
  console.log("polygonArea:", polygonArea, "m²");
  console.log("polygon count:", solarPolygons.length);
  const effectiveArea = polygonArea > 0 ? polygonArea : (site.roofAreaSqM || site.roofAreaAutoSqM || 0);
  console.log("effectiveRoofAreaSqM:", effectiveArea);
  const usable = effectiveArea * 0.85;
  const kbMaxPv = (usable / 3.71) * 0.660;
  console.log("KB Racking maxPV:", kbMaxPv.toFixed(1), "kW");
  const readings = await storage.getMeterReadings(siteId);
  console.log("readings count:", readings?.length);
  if (readings && readings.length > 0) {
    const peakKW = readings.reduce((max: number, r: any) => Math.max(max, r.kW || 0), 0);
    console.log("peakKW from readings:", peakKW.toFixed(1));
    const totalKwh = readings.reduce((s: number, r: any) => s + (r.kWh || 0), 0);
    console.log("totalKwh from readings:", totalKwh.toFixed(0));
  }
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
