/**
 * Cleanup Script: Remove old DEMO/TEST sites via raw SQL.
 * Keeps only the v3 seed sites by slug.
 * Usage: npx tsx server/scripts/cleanupDemoSites.ts
 */
import { db } from "../db";
import { sql } from "drizzle-orm";

const KEEP_SLUGS = [
  'demo-marche-beau-soleil-laval',
  'demo-usine-thermopak-sherbrooke',
  'demo-portfolio-horizon',
  'demo-pharmacie-sante-plus',
  'demo-centre-medical-laval',
  'demo-entrepot-logistik',
  'demo-tour-horizon-bureaux',
  'demo-aliments-fresco',
];

async function main() {
  console.log('Scanning for DEMO/TEST sites...\n');

  // Find all demo/test sites
  const allDemo = await db.execute(sql.raw(
    "SELECT id, name, slug, client_id FROM sites WHERE name ILIKE '%DEMO%' OR name ILIKE '%DÉMO%' OR name ILIKE '%TEST%' OR name ILIKE '%test site%' ORDER BY id"
  ));

  const rows = allDemo.rows || [];
  console.log('Found ' + rows.length + ' DEMO/TEST sites:\n');

  const toKeep: any[] = [];
  const toDelete: any[] = [];

  for (const r of rows) {
    if (KEEP_SLUGS.includes(String(r.slug || ''))) {
      toKeep.push(r);
      console.log('  KEEP: ID=' + r.id + ' ' + r.name);
    } else {
      toDelete.push(r);
      console.log('  DELETE: ID=' + r.id + ' ' + r.name);
    }
  }

  if (toDelete.length === 0) {
    console.log('\nNothing to delete -- database is clean!');
    process.exit(0);
  }

  const ids = toDelete.map((s: any) => s.id);
  const idList = ids.join(',');

  console.log('\nDeleting ' + ids.length + ' old sites...\n');

  // Cascade delete
  await db.execute(sql.raw('DELETE FROM simulation_runs WHERE site_id IN (' + idList + ')'));
  console.log('  Deleted simulation_runs');

  await db.execute(sql.raw('DELETE FROM opportunities WHERE site_id IN (' + idList + ')'));
  console.log('  Deleted opportunities');

  await db.execute(sql.raw('DELETE FROM portfolio_sites WHERE site_id IN (' + idList + ')'));
  console.log('  Deleted portfolio_sites');

  await db.execute(sql.raw('DELETE FROM sites WHERE id IN (' + idList + ')'));
  console.log('  Deleted ' + ids.length + ' sites');

  // Orphan clients
  const clientIds = [...new Set(toDelete.map((s: any) => s.client_id).filter(Boolean))];
  const keepClientIds = new Set(toKeep.map((s: any) => s.client_id).filter(Boolean));
  for (const cid of clientIds) {
    if (keepClientIds.has(cid)) continue;
    const check = await db.execute(sql.raw('SELECT count(*) as cnt FROM sites WHERE client_id = ' + cid));
    if (Number((check.rows[0] as any)?.cnt) === 0) {
      await db.execute(sql.raw('DELETE FROM clients WHERE id = ' + cid));
      console.log('  Deleted orphan client ID=' + cid);
    }
  }

  // Orphan portfolios
  await db.execute(sql.raw("DELETE FROM portfolios WHERE id NOT IN (SELECT DISTINCT portfolio_id FROM portfolio_sites) AND (name ILIKE '%DEMO%' OR name ILIKE '%DÉMO%' OR name ILIKE '%TEST%')"));
  console.log('  Cleaned orphan portfolios');

  // Final state
  const final = await db.execute(sql.raw("SELECT id, name FROM sites WHERE name ILIKE '%DEMO%' OR name ILIKE '%DÉMO%' OR name ILIKE '%TEST%' ORDER BY id"));
  console.log('\nRemaining DEMO/TEST sites:');
  for (const s of (final.rows || [])) {
    console.log('  ID=' + (s as any).id + ' ' + (s as any).name);
  }
  console.log('\nDone!');
  process.exit(0);
}

main().catch((err) => { console.error('Error:', err); process.exit(1); });
