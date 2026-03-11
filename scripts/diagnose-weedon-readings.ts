/**
 * Diagnostic: vérifie les données brutes de Weedon dans meter_readings
 * pour comprendre pourquoi selfConsumption = 0
 */
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function diagnose() {
  // 1. Find Weedon site
  const sites = await db.execute(sql`SELECT id, name FROM sites WHERE name ILIKE '%weedon%'`);
  console.log("=== SITES WEEDON ===");
  for (const s of sites.rows) {
    console.log(`  ID: ${s.id} | Name: ${s.name}`);
  }
  const siteId = sites.rows[0]?.id;
  if (!siteId) { console.log("No site found!"); process.exit(1); }

  // 2. Count readings by granularity + data profile
  const byGran = await db.execute(sql`
    SELECT granularity, COUNT(*) as cnt,
      MIN("kWh") as min_kwh, MAX("kWh") as max_kwh, AVG("kWh")::numeric(10,2) as avg_kwh,
      MIN(kw) as min_kw, MAX(kw) as max_kw, AVG(kw)::numeric(10,2) as avg_kw,
      COUNT(CASE WHEN "kWh" = 0 THEN 1 END) as zero_kwh,
      COUNT(CASE WHEN "kWh" IS NULL THEN 1 END) as null_kwh,
      COUNT(CASE WHEN kw = 0 THEN 1 END) as zero_kw,
      COUNT(CASE WHEN kw IS NULL THEN 1 END) as null_kw
    FROM meter_readings WHERE site_id = ${siteId}
    GROUP BY granularity ORDER BY granularity
  `);
  console.log("\n=== READINGS BY GRANULARITY ===");
  for (const r of byGran.rows) {
    console.log(`  ${r.granularity}: ${r.cnt} readings`);
    console.log(`    kWh: min=${r.min_kwh} max=${r.max_kwh} avg=${r.avg_kwh} | zero=${r.zero_kwh} null=${r.null_kwh}`);
    console.log(`    kW:  min=${r.min_kw} max=${r.max_kw} avg=${r.avg_kw} | zero=${r.zero_kw} null=${r.null_kw}`);
  }

  // 3. Sample HOUR readings (the suspicious monthly ones)
  const hourSample = await db.execute(sql`
    SELECT timestamp, "kWh", kw, granularity FROM meter_readings
    WHERE site_id = ${siteId} AND granularity = 'HOUR'
    ORDER BY timestamp LIMIT 10
  `);
  console.log("\n=== SAMPLE HOUR READINGS (first 10) ===");
  for (const r of hourSample.rows) {
    console.log(`  ${r.timestamp} | kWh=${r.kWh} | kW=${r.kw} | gran=${r.granularity}`);
  }

  // 4. Sample 15MIN/FIFTEEN_MIN readings
  for (const gran of ["FIFTEEN_MIN", "15MIN"]) {
    const sample = await db.execute(sql`
      SELECT timestamp, "kWh", kw, granularity FROM meter_readings
      WHERE site_id = ${siteId} AND granularity = ${gran}
      ORDER BY timestamp LIMIT 10
    `);
    if (sample.rows.length > 0) {
      console.log(`\n=== SAMPLE ${gran} READINGS (first 10) ===`);
      for (const r of sample.rows) {
        console.log(`  ${r.timestamp} | kWh=${r.kWh} | kW=${r.kw} | gran=${r.granularity}`);
      }
    } else {
      console.log(`\n=== NO ${gran} READINGS FOUND ===`);
    }
  }

  // 5. Check if dedup filter would activate
  const hasNonHour = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM meter_readings
    WHERE site_id = ${siteId} AND granularity NOT IN ('HOUR', 'MONTH', 'DAY')
  `);
  console.log(`\n=== FILTER CHECK ===`);
  console.log(`  Non-HOUR/MONTH/DAY readings: ${hasNonHour.rows[0]?.cnt}`);
  console.log(`  hasSubHourlyData would be: ${Number(hasNonHour.rows[0]?.cnt) > 0}`);

  // 6. Check how many HOUR readings match the monthly filter
  const monthlyLike = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM meter_readings
    WHERE site_id = ${siteId} AND granularity = 'HOUR' AND "kWh" IS NOT NULL AND "kWh" > 500 AND kw IS NULL
  `);
  console.log(`  Monthly-like HOUR readings (kWh>500, kW=null): ${monthlyLike.rows[0]?.cnt}`);

  // 7. After filtering, what remains? Simulate the dedup
  const remaining = await db.execute(sql`
    SELECT COUNT(*) as cnt,
      MIN("kWh") as min_kwh, MAX("kWh") as max_kwh,
      MIN(kw) as min_kw, MAX(kw) as max_kw
    FROM meter_readings
    WHERE site_id = ${siteId}
    AND NOT (granularity = 'HOUR' AND "kWh" IS NOT NULL AND "kWh" > 500 AND kw IS NULL)
    AND granularity NOT IN ('MONTH', 'DAY')
  `);
  console.log(`\n=== AFTER MONTHLY FILTER ===`);
  console.log(`  Remaining readings: ${remaining.rows[0]?.cnt}`);
  console.log(`  kWh range: ${remaining.rows[0]?.min_kwh} to ${remaining.rows[0]?.max_kwh}`);
  console.log(`  kW range: ${remaining.rows[0]?.min_kw} to ${remaining.rows[0]?.max_kw}`);

  // 8. Check specifically: do 15-min readings have kWh > 0?
  const fifteenMinKwh = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN "kWh" > 0 THEN 1 END) as has_kwh,
      COUNT(CASE WHEN "kWh" = 0 THEN 1 END) as zero_kwh,
      COUNT(CASE WHEN "kWh" IS NULL THEN 1 END) as null_kwh,
      COUNT(CASE WHEN kw > 0 THEN 1 END) as has_kw,
      COUNT(CASE WHEN kw = 0 THEN 1 END) as zero_kw
    FROM meter_readings
    WHERE site_id = ${siteId} AND granularity NOT IN ('HOUR', 'MONTH', 'DAY')
  `);
  console.log(`\n=== 15-MIN READINGS PROFILE ===`);
  const r = fifteenMinKwh.rows[0];
  console.log(`  Total: ${r?.total}`);
  console.log(`  kWh > 0: ${r?.has_kwh} | kWh = 0: ${r?.zero_kwh} | kWh null: ${r?.null_kwh}`);
  console.log(`  kW > 0: ${r?.has_kw} | kW = 0: ${r?.zero_kw}`);

  process.exit(0);
}

diagnose().catch(e => { console.error(e); process.exit(1); });
