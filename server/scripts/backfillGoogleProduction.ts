/**
 * Backfill Script: Update all sites with Google Solar production estimates
 * 
 * This script re-runs roof estimation for all sites that have successful
 * roof estimates but are missing the googleProductionEstimate data.
 * 
 * Usage: npx tsx server/scripts/backfillGoogleProduction.ts
 */

import { db } from "../db";
import { sites } from "@shared/schema";
import { eq, isNotNull, and } from "drizzle-orm";
import * as googleSolar from "../googleSolarService";

async function backfillGoogleProduction() {
  console.log("Starting Google Production backfill...");
  
  // Get all sites with successful roof estimates
  const sitesWithRoofs = await db.select({
    id: sites.id,
    name: sites.name,
    latitude: sites.latitude,
    longitude: sites.longitude,
    roofAreaAutoDetails: sites.roofAreaAutoDetails,
  })
  .from(sites)
  .where(
    and(
      eq(sites.roofEstimateStatus, "success"),
      isNotNull(sites.latitude),
      isNotNull(sites.longitude)
    )
  );
  
  console.log(`Found ${sitesWithRoofs.length} sites with successful roof estimates`);
  
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const site of sitesWithRoofs) {
    const details = site.roofAreaAutoDetails as any;
    
    // Check if googleProductionEstimate already exists
    if (details?.googleProductionEstimate) {
      console.log(`[${site.name}] Already has googleProductionEstimate, skipping`);
      skipped++;
      continue;
    }
    
    console.log(`[${site.name}] Re-running roof estimation...`);
    
    try {
      const result = await googleSolar.estimateRoofFromLocation({
        latitude: site.latitude!,
        longitude: site.longitude!
      });
      
      if (!result.success) {
        console.log(`[${site.name}] Failed: ${result.error}`);
        failed++;
        continue;
      }
      
      // Create enriched details with googleProductionEstimate
      const enrichedDetails = JSON.parse(JSON.stringify({
        ...result.details,
        maxSunshineHoursPerYear: result.maxSunshineHoursPerYear,
        roofSegments: result.roofSegments,
        googleProductionEstimate: result.googleProductionEstimate,
        panelCapacityWatts: result.panelCapacityWatts,
        maxArrayAreaSqM: result.maxArrayAreaSqM,
      }));
      
      // Update the site
      await db.update(sites)
        .set({
          roofAreaAutoDetails: enrichedDetails,
          roofAreaAutoSqM: result.roofAreaSqM.toString(),
          roofAreaAutoTimestamp: new Date(),
        })
        .where(eq(sites.id, site.id));
      
      if (result.googleProductionEstimate) {
        const specificYield = Math.round(
          result.googleProductionEstimate.yearlyEnergyAcKwh / 
          result.googleProductionEstimate.systemSizeKw
        );
        console.log(`[${site.name}] Updated with Google yield: ${specificYield} kWh/kWp/year`);
      } else {
        console.log(`[${site.name}] Updated but no googleProductionEstimate available from API`);
      }
      
      updated++;
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`[${site.name}] Error:`, error);
      failed++;
    }
  }
  
  console.log("\n=== Backfill Complete ===");
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (already had data): ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${sitesWithRoofs.length}`);
}

backfillGoogleProduction()
  .then(() => {
    console.log("Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
