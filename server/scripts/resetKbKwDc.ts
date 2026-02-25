/**
 * One-shot script to reset kbKwDc and kbPanelCount for the 3 Rampart sites
 * that received a bad 20 kWc cap from polygon sharing.
 *
 * Usage: npx tsx server/scripts/resetKbKwDc.ts
 */
import { db } from "../db";
import { sites } from "@shared/schema";
import { inArray } from "drizzle-orm";

const AFFECTED_SITE_IDS = [
  "0758f7ee", // G4AE0056067
  "d026b5e3", // G4AE0056082
  "b426d015", // G4AE0056083
];

async function main() {
  console.log("Resetting kbKwDc and kbPanelCount for affected Rampart sites...");

  // First check current values
  const affectedSites = await db
    .select({ id: sites.id, name: sites.name, kbKwDc: sites.kbKwDc, kbPanelCount: sites.kbPanelCount })
    .from(sites)
    .where(inArray(sites.id, AFFECTED_SITE_IDS));

  for (const s of affectedSites) {
    console.log(`  ${s.id} (${s.name}): kbKwDc=${s.kbKwDc}, kbPanelCount=${s.kbPanelCount}`);
  }

  if (affectedSites.length === 0) {
    console.log("No matching sites found. Check if site IDs are correct (they may be UUIDs, not prefixes).");
    // Try partial match
    const allSites = await db
      .select({ id: sites.id, name: sites.name, address: sites.address })
      .from(sites);
    const rampartSites = allSites.filter(s =>
      s.address?.includes("1305") || s.name?.includes("Rampart") || s.name?.includes("G4AE005606") || s.name?.includes("G4AE005608")
    );
    if (rampartSites.length > 0) {
      console.log("\nPossible matches by address/name:");
      for (const s of rampartSites) {
        console.log(`  ${s.id} — ${s.name} — ${s.address}`);
      }
      console.log("\nUpdate the AFFECTED_SITE_IDS array with the correct full UUIDs and re-run.");
    }
    process.exit(0);
  }

  // Reset
  await db
    .update(sites)
    .set({ kbKwDc: null, kbPanelCount: null })
    .where(inArray(sites.id, AFFECTED_SITE_IDS));

  console.log(`\nDone. Reset kbKwDc and kbPanelCount to NULL for ${affectedSites.length} sites.`);
  console.log("RoofVisualization will recalculate correct values when each site is opened.");
  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
