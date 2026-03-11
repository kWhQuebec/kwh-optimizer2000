/**
 * Debug Weedon/Fromagerie roof data — search ALL matching sites
 * Usage: npx tsx scripts/debug-weedon-roof.ts
 */
import { db } from '../server/db';
import { sites, roofPolygons } from '../shared/schema';
import { ilike, or, eq } from 'drizzle-orm';

async function main() {
  // Search for ALL sites matching Weedon or Fromagerie
  const matchingSites = await db.select().from(sites).where(
    or(
      ilike(sites.name, '%weedon%'),
      ilike(sites.name, '%fromagerie%'),
      ilike(sites.address, '%weedon%')
    )
  );

  console.log(`\n=== SITES MATCHING "Weedon" / "Fromagerie" : ${matchingSites.length} ===\n`);

  for (const site of matchingSites) {
    console.log(`SITE: ${site.name}`);
    console.log(`  id:                ${site.id}`);
    console.log(`  address:           ${site.address}`);
    console.log(`  roofAreaSqM:       ${site.roofAreaSqM}`);
    console.log(`  buildingSqFt:      ${site.buildingSqFt}`);
    console.log(`  kbKwDc:            ${site.kbKwDc}`);
    console.log(`  roofAreaValidated: ${(site as any).roofAreaValidated}`);
    console.log(`  stage:             ${site.stage}`);
    console.log(`  createdAt:         ${site.createdAt}`);

    // Check polygons for this site
    const polys = await db.select().from(roofPolygons).where(eq(roofPolygons.siteId, site.id));
    console.log(`  POLYGONS:          ${polys.length}`);
    for (const p of polys) {
      console.log(`    - label: ${p.label} | area: ${p.areaSqM?.toFixed(1)}m² | color: ${p.color}`);
    }
    if (polys.length > 0) {
      const totalArea = polys.reduce((sum, p) => sum + (p.areaSqM || 0), 0);
      console.log(`    Total area: ${totalArea.toFixed(1)} m²`);
    }
    console.log('');
  }

  if (matchingSites.length === 0) {
    // Fallback: list ALL sites to find it manually
    console.log('No match found. Listing all sites:');
    const allSites = await db.select({ id: sites.id, name: sites.name, address: sites.address }).from(sites);
    for (const s of allSites) {
      console.log(`  ${s.id} | ${s.name} | ${s.address}`);
    }
  }

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
