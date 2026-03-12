/**
 * nukeAllDemoSites.ts — Delete ALL demo sites (DÉMO prefix) and re-seed fresh.
 * Uses the same FK cascade logic as cleanupDemoSites.ts but deletes ALL DÉMO sites.
 */
import { db } from "../db";
import { sql } from "drizzle-orm";

async function nukeAllDemoSites() {
  console.log("🔥 Deleting ALL DÉMO sites and their FK children...\n");

  // 1. Find all DÉMO site IDs
  const demoSites = await db.execute(sql.raw(
    `SELECT id, name FROM sites WHERE name LIKE 'DÉMO%'`
  ));
  const siteIds = demoSites.rows.map((r: any) => `'${r.id}'`);
  console.log(`Found ${siteIds.length} DÉMO sites to delete`);

  if (siteIds.length === 0) {
    console.log("Nothing to delete!");
    process.exit(0);
  }

  const siteIdList = siteIds.join(",");

  // 2. Find all DÉMO client IDs
  const demoClients = await db.execute(sql.raw(
    `SELECT id, name FROM clients WHERE name LIKE 'DÉMO%'`
  ));
  const clientIds = demoClients.rows.map((r: any) => `'${r.id}'`);
  console.log(`Found ${clientIds.length} DÉMO clients`);
  const clientIdList = clientIds.join(",");

  // 3. Delete FK children of sites (order matters)
  const tables = [
    // Indirect children (reference simulation_runs or opportunities)
    { table: "meter_readings", fk: "site_id", idList: siteIdList },
    { table: "stage_transition_logs", fk: "opportunity_id", subquery: `SELECT id FROM opportunities WHERE site_id IN (${siteIdList})` },
    { table: "construction_tasks", fk: "simulation_run_id", subquery: `SELECT id FROM simulation_runs WHERE site_id IN (${siteIdList})` },
    // Direct children of sites
    { table: "design_agreements", fk: "site_id", idList: siteIdList },
    { table: "simulation_runs", fk: "site_id", idList: siteIdList },
    { table: "opportunities", fk: "site_id", idList: siteIdList },
  ];

  for (const t of tables) {
    try {
      let query: string;
      if (t.subquery) {
        query = `DELETE FROM ${t.table} WHERE ${t.fk} IN (${t.subquery})`;
      } else {
        query = `DELETE FROM ${t.table} WHERE ${t.fk} IN (${t.idList})`;
      }
      const result = await db.execute(sql.raw(query));
      const count = (result as any).rowCount || 0;
      if (count > 0) console.log(`  Deleted ${count} rows from ${t.table}`);
    } catch (e: any) {
      console.log(`  ⚠️ ${t.table}: ${e.message}`);
    }
  }

  // 4. Delete sites
  const siteResult = await db.execute(sql.raw(
    `DELETE FROM sites WHERE name LIKE 'DÉMO%'`
  ));
  console.log(`  Deleted ${(siteResult as any).rowCount} sites`);

  // 5. Delete orphan portfolios
  if (clientIds.length > 0) {
    try {
      await db.execute(sql.raw(
        `DELETE FROM portfolios WHERE client_id IN (${clientIdList})`
      ));
    } catch (e) {}
  }

  // 6. Delete clients
  const clientResult = await db.execute(sql.raw(
    `DELETE FROM clients WHERE name LIKE 'DÉMO%'`
  ));
  console.log(`  Deleted ${(clientResult as any).rowCount} clients`);

  console.log("\n✅ All DÉMO data nuked. Run seedDemoSites.ts to recreate.\n");
  process.exit(0);
}

nukeAllDemoSites().catch(e => { console.error(e); process.exit(1); });
