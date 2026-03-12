/**
 * Cleanup Script: Remove old DEMO/TEST sites, keeping only the latest v3 seed.
 * Usage: npx tsx server/scripts/cleanupDemoSites.ts
 */
import { db } from "../db";
import { clients, sites, simulationRuns, opportunities, portfolios, portfolioSites } from "@shared/schema";
import { eq, or, ilike, inArray, sql } from "drizzle-orm";

const KEEP_SLUGS = [
  "demo-marche-beau-soleil-laval",
  "demo-usine-thermopak-sherbrooke",
  "demo-portfolio-horizon",
  "demo-pharmacie-sante-plus",
  "demo-centre-medical-laval",
  "demo-entrepot-logistik",
  "demo-tour-horizon-bureaux",
  "demo-aliments-fresco",
];

async function main() {
  console.log("Scanning for DEMO/TEST sites...\n");

  const allDemoSites = await db
    .select({ id: sites.id, name: sites.name, slug: sites.slug, clientId: sites.clientId })
    .from(sites)
    .where(or(
      ilike(sites.name, "%DEMO%"),
      ilike(sites.name, "%DÉMO%"),
      ilike(sites.name, "%TEST%"),
      ilike(sites.name, "%test site%"),
      ilike(sites.name, "%demo site%"),
    ));

  console.log("Found " + allDemoSites.length + " DEMO/TEST sites total:\n");

  const toKeep: typeof allDemoSites = [];
  const toDelete: typeof allDemoSites = [];

  for (const site of allDemoSites) {
    if (KEEP_SLUGS.includes(site.slug || "")) {
      toKeep.push(site);
      console.log("  KEEP: ID=" + site.id + " " + site.name + " (slug: " + site.slug + ")");
    } else {
      toDelete.push(site);
      console.log("  DELETE: ID=" + site.id + " " + site.name + " (slug: " + site.slug + ")");
    }
  }

  if (toDelete.length === 0) {
    console.log("\nNothing to delete -- database is clean!");
    process.exit(0);
  }

  const deleteIds = toDelete.map((s) => s.id);
  const deleteClientIds = [...new Set(toDelete.map((s) => s.clientId).filter(Boolean))] as number[];
  const keepClientIds = new Set(toKeep.map((s) => s.clientId).filter(Boolean));
  const safeToDeleteClientIds = deleteClientIds.filter((cid) => !keepClientIds.has(cid));

  console.log("\nDeleting " + toDelete.length + " old sites...\n");

  // 1. Delete simulation_runs
  await db.delete(simulationRuns).where(inArray(simulationRuns.siteId, deleteIds));
  console.log("  Deleted simulation_runs");

  // 2. Delete opportunities
  await db.delete(opportunities).where(inArray(opportunities.siteId, deleteIds));
  console.log("  Deleted opportunities");

  // 3. Delete portfolio_sites entries
  await db.delete(portfolioSites).where(inArray(portfolioSites.siteId, deleteIds));
  console.log("  Deleted portfolio_sites entries");

  // 4. Delete sites
  await db.delete(sites).where(inArray(sites.id, deleteIds));
  console.log("  Deleted " + deleteIds.length + " sites");

  // 5. Delete orphan clients
  for (const cid of safeToDeleteClientIds) {
    const remaining = await db.select({ count: sql<number>\`count(*)\` }).from(sites).where(eq(sites.clientId, cid));
    if (Number(remaining[0]?.count) === 0) {
      await db.delete(clients).where(eq(clients.id, cid));
      console.log("  Deleted orphan client ID=" + cid);
    }
  }

  // 6. Delete orphan portfolios
  await db.execute(sql\`
    DELETE FROM portfolios p
    WHERE NOT EXISTS (SELECT 1 FROM portfolio_sites ps WHERE ps.portfolio_id = p.id)
    AND (p.name ILIKE '%DEMO%' OR p.name ILIKE '%DÉMO%' OR p.name ILIKE '%TEST%')
  \`);
  console.log("  Cleaned orphan portfolios");

  console.log("\nCleanup complete! Kept " + toKeep.length + " v3 sites, deleted " + toDelete.length + " old ones.");

  const finalSites = await db
    .select({ id: sites.id, name: sites.name })
    .from(sites)
    .where(or(ilike(sites.name, "%DEMO%"), ilike(sites.name, "%DÉMO%"), ilike(sites.name, "%TEST%")));
  console.log("\nRemaining DEMO/TEST sites:");
  for (const s of finalSites) { console.log("  ID=" + s.id + " " + s.name); }
  process.exit(0);
}

main().catch((err) => { console.error("Error:", err); process.exit(1); });
