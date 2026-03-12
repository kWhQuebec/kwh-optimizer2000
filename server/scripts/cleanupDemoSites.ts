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

// Ordered cascade: child tables first, then parent tables
// meter_readings → meter_files → sites
// construction_tasks/daily_logs → construction_projects → sites
// etc.
const FK_DELETE_ORDER = [
  // Deep children first
  'meter_readings',       // FK → meter_files
  'construction_tasks',   // FK → construction_projects
  'construction_daily_logs', // FK → construction_projects
  'construction_milestones', // FK → construction_agreements
  // Then direct site_id FK tables (no cascade)
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

  // Delete indirect children first (no site_id, linked via parent table)
  try {
    await db.execute(sql.raw('DELETE FROM meter_readings WHERE meter_file_id IN (SELECT id FROM meter_files WHERE site_id IN (' + ids + '))'));
    console.log('  meter_readings cleaned');
  } catch (e: any) { console.log('  meter_readings skipped'); }

  try {
    await db.execute(sql.raw('DELETE FROM construction_tasks WHERE project_id IN (SELECT id FROM construction_projects WHERE site_id IN (' + ids + '))'));
    console.log('  construction_tasks cleaned');
  } catch (e: any) { console.log('  construction_tasks skipped'); }

  try {
    await db.execute(sql.raw('DELETE FROM construction_daily_logs WHERE project_id IN (SELECT id FROM construction_projects WHERE site_id IN (' + ids + '))'));
    console.log('  construction_daily_logs cleaned');
  } catch (e: any) { console.log('  construction_daily_logs skipped'); }

  try {
    await db.execute(sql.raw('DELETE FROM construction_milestones WHERE agreement_id IN (SELECT id FROM construction_agreements WHERE site_id IN (' + ids + '))'));
    console.log('  construction_milestones cleaned');
  } catch (e: any) { console.log('  construction_milestones skipped'); }

  // om_visits and om_performance_snapshots link via om_contract_id, not site_id directly
  try {
    await db.execute(sql.raw('DELETE FROM om_visits WHERE om_contract_id IN (SELECT id FROM om_contracts WHERE site_id IN (' + ids + '))'));
    console.log('  om_visits cleaned');
  } catch (e: any) { console.log('  om_visits skipped'); }

  try {
    await db.execute(sql.raw('DELETE FROM om_performance_snapshots WHERE om_contract_id IN (SELECT id FROM om_contracts WHERE site_id IN (' + ids + '))'));
    console.log('  om_performance_snapshots cleaned');
  } catch (e: any) { console.log('  om_performance_snapshots skipped'); }

  // Delete direct site_id FK tables — ORDER MATTERS (children before parents)
  const DIRECT_FK_TABLES = [
    'meter_files',                // child of sites
    'simulation_runs',            // child of sites
    'site_visits',                // child of sites
    'procuration_signatures',     // child of sites
    'competitor_proposal_analysis', // child of sites
    'om_contracts',               // child of sites (om_visits/snapshots already cleaned above)
    'construction_projects',      // child of construction_agreements (must be before)
    'construction_agreements',    // child of design_agreements + sites (must be before design_agreements)
    'design_agreements',          // child of sites
    'opportunities',              // child of sites
    'activities',                 // child of sites
    'email_logs',                 // child of sites
    'portfolio_sites',            // child of sites
  ];
  for (const table of DIRECT_FK_TABLES) {
    try {
      await db.execute(sql.raw('DELETE FROM ' + table + ' WHERE site_id IN (' + ids + ')'));
      console.log('  ' + table + ' cleaned');
    } catch (e: any) {
      console.log('  ' + table + ' skipped (' + (e.message || '').slice(0, 80) + ')');
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
