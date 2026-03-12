const { Pool } = require('pg');
const p = new Pool({ ssl: { rejectUnauthorized: false } });

async function run() {
  // 1. Schema of key tables
  const tables = ['sites', 'simulation_runs', 'designs', 'opportunities', 'leads'];
  for (const t of tables) {
    const r = await p.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`, [t]);
    console.log(`\n=== ${t.toUpperCase()} (${r.rows.length} cols) ===`);
    r.rows.forEach(c => console.log(`  ${c.column_name} (${c.data_type})`));
  }

  // 2. Search for Rampart, STROM, and all non-test sites
  console.log('\n=== ALL SITES (non-demo) ===');
  const sites = await p.query(`SELECT id, name, address, "rateCode", "avgKW", "annualKWh" FROM sites WHERE lower(name) NOT LIKE '%demo%' AND lower(name) NOT LIKE '%test%' ORDER BY name`);
  sites.rows.forEach(s => console.log(`  ${s.name} | ${s.address} | rate=${s.rateCode} | avgKW=${s.avgKW} | kWh=${s.annualKWh}`));

  // 3. Count simulation_runs per site
  console.log('\n=== SIMULATION RUNS PER SITE ===');
  const runs = await p.query(`SELECT s.name, sr."siteId", COUNT(*) as cnt, MAX(sr."createdAt") as latest FROM simulation_runs sr JOIN sites s ON sr."siteId"=s.id GROUP BY s.name, sr."siteId" ORDER BY cnt DESC LIMIT 20`);
  runs.rows.forEach(r => console.log(`  ${r.name} | runs=${r.cnt} | latest=${r.latest}`));

  // 4. Sample simulation_run data for RONA+ Saint-Laurent
  console.log('\n=== LATEST SIM RUN - RONA+ Saint-Laurent ===');
  const sim = await p.query(`SELECT * FROM simulation_runs WHERE "siteId"='59610b81-a797-4d85-9bc6-2f39bcb2d78d' ORDER BY "createdAt" DESC LIMIT 1`);
  if (sim.rows.length > 0) {
    const row = sim.rows[0];
    console.log(JSON.stringify(row, null, 2).substring(0, 3000));
  } else {
    console.log('  No simulation runs found');
  }

  await p.end();
}
run().catch(e => { console.error('ERROR:', e.message); p.end(); });
