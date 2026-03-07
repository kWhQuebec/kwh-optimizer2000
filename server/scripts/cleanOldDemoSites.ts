/**
 * Clean Old Demo Sites
 *
 * Removes the incorrectly seeded demo clients/sites from a previous session:
 * - "Garage Tremblay" (was wrong name for Persona 1)
 * - "Hôtel & Spa Laurentides" (hallucinated — not a real persona)
 * - "Ferme Beausoleil" (hallucinated — not a real persona)
 *
 * Run BEFORE seedDemoSites.ts:
 *   npx tsx server/scripts/cleanOldDemoSites.ts
 *   npx tsx server/scripts/seedDemoSites.ts
 */

import { db } from "../db";
import { clients, sites } from "@shared/schema";
import { eq } from "drizzle-orm";

const OLD_DEMO_NAMES = [
  "Garage Tremblay",
  "Hôtel & Spa Laurentides",
  "Ferme Beausoleil",
];

async function cleanOldDemoSites() {
  console.log("🧹 Cleaning old (incorrect) demo sites...\n");

  for (const name of OLD_DEMO_NAMES) {
    const existing = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.name, name))
      .limit(1);

    if (existing.length === 0) {
      console.log(`⏭️  "${name}" not found in DB. Skipping.`);
      continue;
    }

    const clientId = existing[0].id;

    // Delete sites first (FK constraint)
    const deletedSites = await db
      .delete(sites)
      .where(eq(sites.clientId, clientId))
      .returning({ id: sites.id, name: sites.name });

    for (const s of deletedSites) {
      console.log(`   🗑️  Site deleted: "${s.name}" (id: ${s.id})`);
    }

    // Delete client
    await db.delete(clients).where(eq(clients.id, clientId));
    console.log(`✅ Client deleted: "${name}" (id: ${clientId})\n`);
  }

  console.log("🧹 Cleanup complete!");
}

cleanOldDemoSites()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Cleanup failed:", err);
    process.exit(1);
  });
