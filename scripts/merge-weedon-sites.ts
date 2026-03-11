/**
 * Merge duplicate Weedon sites:
 *   - "Fromagerie Weadon" (typo, f44bffd4) has meter data (46k readings) but no roof
 *   - "Fromagerie Weedon" (correct, 996990a9) has roof polygons (1304 m²) but no meter data
 *
 * Action: Move meter_files + meter_readings from Weadon → Weedon, then delete Weadon.
 *
 * Usage: npx tsx scripts/merge-weedon-sites.ts [--dry-run]
 */
import { db } from '../server/db';
import { sites, meterFiles, meterReadings, simulationRuns, roofPolygons } from '../shared/schema';
import { eq, sql } from 'drizzle-orm';

const OLD_ID = 'f44bffd4-adca-48bc-8734-54af62cc350c'; // Weadon (typo) — has meter data
const NEW_ID = '996990a9-081c-47f3-8c27-d46248cfd66d'; // Weedon (correct) — has roof

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(`\n=== MERGE WEEDON SITES ${DRY_RUN ? '(DRY RUN)' : ''} ===\n`);

  // 1. Verify both sites exist
  const [oldSite] = await db.select().from(sites).where(eq(sites.id, OLD_ID));
  const [newSite] = await db.select().from(sites).where(eq(sites.id, NEW_ID));

  if (!oldSite) { console.error('OLD site not found!'); process.exit(1); }
  if (!newSite) { console.error('NEW site not found!'); process.exit(1); }

  console.log(`OLD (to delete): "${oldSite.name}" — ${OLD_ID}`);
  console.log(`NEW (to keep):   "${newSite.name}" — ${NEW_ID}`);

  // 2. Count meter files + readings on old site
  const oldFiles = await db.select().from(meterFiles).where(eq(meterFiles.siteId, OLD_ID));
  const oldReadingCount = await db.select({ count: sql<number>`count(*)` })
    .from(meterReadings)
    .innerJoin(meterFiles, eq(meterReadings.meterFileId, meterFiles.id))
    .where(eq(meterFiles.siteId, OLD_ID));

  console.log(`\nOLD site meter files: ${oldFiles.length}`);
  console.log(`OLD site readings:    ${oldReadingCount[0]?.count || 0}`);

  // 3. Check new site doesn't already have meter data
  const newFiles = await db.select().from(meterFiles).where(eq(meterFiles.siteId, NEW_ID));
  console.log(`NEW site meter files: ${newFiles.length}`);

  // 4. Check for simulations on old site
  const oldSims = await db.select().from(simulationRuns).where(eq(simulationRuns.siteId, OLD_ID));
  console.log(`OLD site simulations: ${oldSims.length}`);

  // 5. Check polygons (should be 0 on old, 2 on new)
  const oldPolygons = await db.select().from(roofPolygons).where(eq(roofPolygons.siteId, OLD_ID));
  const newPolygons = await db.select().from(roofPolygons).where(eq(roofPolygons.siteId, NEW_ID));
  console.log(`OLD site polygons:    ${oldPolygons.length}`);
  console.log(`NEW site polygons:    ${newPolygons.length}`);

  if (DRY_RUN) {
    console.log('\n--- DRY RUN — no changes made ---');
    console.log(`Would move ${oldFiles.length} meter files to new site`);
    console.log(`Would delete ${oldSims.length} simulations from old site`);
    console.log(`Would delete old site "${oldSite.name}"`);
    process.exit(0);
  }

  // 6. Move meter files: UPDATE siteId from OLD → NEW
  console.log('\n--- EXECUTING MIGRATION ---');

  const movedFiles = await db.update(meterFiles)
    .set({ siteId: NEW_ID })
    .where(eq(meterFiles.siteId, OLD_ID))
    .returning({ id: meterFiles.id });
  console.log(`✅ Moved ${movedFiles.length} meter files to new site`);

  // 7. Delete old simulations (they're based on wrong/empty data anyway)
  if (oldSims.length > 0) {
    // Delete cashflows first (FK to simulation_runs)
    for (const sim of oldSims) {
      await db.execute(sql`DELETE FROM cashflows WHERE simulation_run_id = ${sim.id}`);
    }
    const deletedSims = await db.delete(simulationRuns)
      .where(eq(simulationRuns.siteId, OLD_ID))
      .returning({ id: simulationRuns.id });
    console.log(`✅ Deleted ${deletedSims.length} old simulations`);
  }

  // 8. Delete any other references to old site (hq_fetch_jobs, opportunities, etc.)
  await db.execute(sql`DELETE FROM hq_fetch_jobs WHERE site_id = ${OLD_ID}`);
  await db.execute(sql`DELETE FROM site_meters WHERE site_id = ${OLD_ID}`);

  // 9. Delete old site
  const deleted = await db.delete(sites).where(eq(sites.id, OLD_ID)).returning({ id: sites.id });
  console.log(`✅ Deleted old site "${oldSite.name}" (${deleted.length} row)`);

  // 10. Verify
  const verifyFiles = await db.select().from(meterFiles).where(eq(meterFiles.siteId, NEW_ID));
  const verifyReadings = await db.select({ count: sql<number>`count(*)` })
    .from(meterReadings)
    .innerJoin(meterFiles, eq(meterReadings.meterFileId, meterFiles.id))
    .where(eq(meterFiles.siteId, NEW_ID));
  const verifyPolygons = await db.select().from(roofPolygons).where(eq(roofPolygons.siteId, NEW_ID));

  console.log(`\n=== VERIFICATION ===`);
  console.log(`NEW site meter files: ${verifyFiles.length}`);
  console.log(`NEW site readings:    ${verifyReadings[0]?.count || 0}`);
  console.log(`NEW site polygons:    ${verifyPolygons.length}`);
  console.log(`\n✅ Migration complete. Run analysis on new site to recalculate.`);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
