import { db } from "../db";
import { sql } from "drizzle-orm";

// Names of the v3 demo sites we KEEP
const KEEP_NAMES = [
  'DÉMO — Marché Beau-Soleil Laval',
  'DÉMO — Usine Thermopak Sherbrooke',
  'DÉMO — Portfolio Horizon',
  'DÉMO — Pharmacie Santé Plus (G)',
  'DÉMO — Centre Médical Laval (G)',
  'DÉMO — Entrepôt Logistik (M)',
  'DÉMO — Tour Horizon Bureaux (G)',
  'DÉMO — Aliments Fresco (M)',
];

// All tables with site_id FK that do NOT have onDelete cascade
const FK_TABLES_NO_CASCADE = [
  'meter_files',
  'simulation_runs',
  'site_visits',
  'procuration_signatures',
  'design_agreements',
  'competitor_proposal_analysis',
  'construction_agreements',
  'construction_projects',
  'om_contracts',
  'om_visits',
  'om_performance_snapshots',
  'opportunities',
  'activities',
  'email_logs',
  'portfolio_sites',
];

async function main() {
  console.log('Scanning for DEMO/TEST sites...\n');

  const allDemo = await db.execute(sql.raw(
    "SELECT id, name, client_id FROM sites WHERE name ILIKE '%DEMO%' OR name ILIKE '%DÉMO%' OR name ILIKE '%TEST%' OR name ILIKE '%test site%' ORDER BY id"
  ));
  const rows = allDemo.rows || [];
  console.log('Found ' + rows.length + ' DEMO/TEST sites:\n');

  const toKeep: any[] = [];
  const toDelete: any[] = [];

  for (const r of rows) {
    if (KEEP_NAMES.includes(String(r.name || ''))) {
      toKeep.push(r);
      console.log('  KEEP: ' + r.id + ' ' + r.name);
    } else {
      toDelete.push(r);
      console.log('  DELETE: ' + r.id + ' ' + r.name);
    }
  }

  if (toDelete.length === 0) {
    console.log('\nNothing to delete!');
    process.exit(0);
  }

  const ids = toDelete.map((s: any) => "'" + s.id + "'").join(',');
  console.log('\nDeleting ' + toDelete.length + ' old sites...\n');

  // Delete from ALL tables with site_id FK (no cascade)
  for (const table of FK_TABLES_NO_CASCADE) {
    try {
      await db.execute(sql.raw('DELETE FROM ' + table + ' WHERE site_id IN (' + ids + ')'));
      console.log('  ' + table + ' cleaned');
    } catch (e: any) {
      // Table might not exist in this DB version
      console.log('  ' + table + ' skipped (' + (e.message || '').slice(0, 60) + ')');
    }
  }

  // Now delete the sites themselves (cascade will handle site_meters, hq_fetch_jobs, site_visit_photos, roof_polygons)
  await db.execute(sql.raw('DELETE FROM sites WHERE id IN (' + ids + ')'));
  console.log('  ' + toDelete.length + ' sites deleted');

  // Orphan clients
  const clientIds = [...new Set(toDelete.map((s: any) => s.client_id).filter(Boolean))];
  const keepClientIds = new Set(toKeep.map((s: any) => s.client_id).filter(Boolean));
  for (const cid of clientIds) {
    if (keepClientIds.has(cid)) continue;
    const check = await db.execute(sql.raw("SELECT count(*) as cnt FROM sites WHERE client_id = '" + cid + "'"));
    if (Number((check.rows[0] as any)?.cnt) === 0) {
      await db.execute(sql.raw("DELETE FROM clients WHERE id = '" + cid + "'"));
      console.log('  Orphan client ' + cid + ' deleted');
    }
  }

  // Orphan portfolios
  await db.execute(sql.raw("DELETE FROM portfolios WHERE id NOT IN (SELECT DISTINCT portfolio_id FROM portfolio_sites) AND (name ILIKE '%DEMO%' OR name ILIKE '%DÉMO%' OR name ILIKE '%TEST%')"));
  console.log('  Orphan portfolios cleaned');

  const final = await db.execute(sql.raw("SELECT id, name FROM sites WHERE name ILIKE '%DEMO%' OR name ILIKE '%DÉMO%' OR name ILIKE '%TEST%' ORDER BY name"));
  console.log('\nRemaining DEMO/TEST sites:');
  for (const s of (final.rows || [])) { console.log('  ' + (s as any).name); }
  console.log('\nDone!');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
