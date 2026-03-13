import { db } from "../db";
import { simulationRuns } from "@shared/schema";
import type { SensitivityAnalysis, OptimalScenario } from "@shared/schema";
import { eq, isNull, or } from "drizzle-orm";
import { createLogger } from "../lib/logger";

const log = createLogger("BackfillSimulationMetrics");

export async function backfillSimulationMetrics(): Promise<{ updated: number; skipped: number; errors: number }> {
  const allRuns = await db.select().from(simulationRuns).where(
    or(
      isNull(simulationRuns.npv25),
      isNull(simulationRuns.capexGross),
      isNull(simulationRuns.incentivesHQ),
      isNull(simulationRuns.capexNet),
    )
  );

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const run of allRuns) {
    try {
      const sensitivity = run.sensitivity as SensitivityAnalysis | null;
      if (!sensitivity?.optimalScenarios) {
        skipped++;
        continue;
      }

      const optimal: OptimalScenario | null =
        sensitivity.optimalScenarios.bestNPV ??
        sensitivity.optimalScenarios.bestIRR ??
        sensitivity.optimalScenarios.maxSelfSufficiency ??
        null;

      if (!optimal) {
        skipped++;
        continue;
      }

      const bd = optimal.scenarioBreakdown;

      const updateData: Record<string, number | null> = {};

      if (run.npv25 == null) updateData.npv25 = optimal.npv25;
      if (run.irr25 == null) updateData.irr25 = optimal.irr25;
      if (run.capexNet == null) updateData.capexNet = optimal.capexNet;
      if (run.annualSavings == null) updateData.annualSavings = optimal.annualSavings;
      if (run.simplePaybackYears == null) updateData.simplePaybackYears = optimal.simplePaybackYears;
      if (run.selfSufficiencyPercent == null) updateData.selfSufficiencyPercent = optimal.selfSufficiencyPercent;
      if (run.totalProductionKWh == null) updateData.totalProductionKWh = optimal.totalProductionKWh;
      if (run.co2AvoidedTonnesPerYear == null) updateData.co2AvoidedTonnesPerYear = optimal.co2AvoidedTonnesPerYear;

      if (bd) {
        if (run.capexGross == null) updateData.capexGross = bd.capexGross ?? null;
        if (run.capexPV == null) updateData.capexPV = bd.capexSolar ?? null;
        if (run.capexBattery == null) updateData.capexBattery = bd.capexBattery ?? null;
        if (run.incentivesHQSolar == null) updateData.incentivesHQSolar = bd.actualHQSolar ?? null;
        if (run.incentivesHQBattery == null) updateData.incentivesHQBattery = bd.actualHQBattery ?? null;
        if (run.incentivesHQ == null) updateData.incentivesHQ = (bd.actualHQSolar ?? 0) + (bd.actualHQBattery ?? 0);
        if (run.incentivesFederal == null) updateData.incentivesFederal = bd.itcAmount ?? null;
        if (run.taxShield == null) updateData.taxShield = bd.taxShield ?? null;
        if (run.totalIncentives == null) {
          const hq = (bd.actualHQSolar ?? 0) + (bd.actualHQBattery ?? 0);
          updateData.totalIncentives = hq + (bd.itcAmount ?? 0) + (bd.taxShield ?? 0);
        }
        if (run.lcoe == null) updateData.lcoe = bd.lcoe ?? null;
        if (run.annualEnergySavingsKWh == null) updateData.annualEnergySavingsKWh = bd.annualEnergySavingsKWh ?? null;
        if (run.totalExportedKWh == null) updateData.totalExportedKWh = bd.totalExportedKWh ?? null;
        if (run.annualSurplusRevenue == null) updateData.annualSurplusRevenue = bd.annualSurplusRevenue ?? null;
        if (run.annualCostBefore == null) updateData.annualCostBefore = bd.estimatedAnnualBillBefore ?? null;
        if (run.annualCostAfter == null) updateData.annualCostAfter = bd.estimatedAnnualBillAfter ?? null;
      }

      if (Object.keys(updateData).length === 0) {
        skipped++;
        continue;
      }

      await db.update(simulationRuns)
        .set(updateData)
        .where(eq(simulationRuns.id, run.id));

      updated++;
      log.info(`Backfilled simulation ${run.id} (site=${run.siteId}): filled ${Object.keys(updateData).length} columns`);
    } catch (err) {
      errors++;
      log.error(`Failed to backfill simulation ${run.id}: ${err}`);
    }
  }

  log.info(`Backfill complete: ${updated} updated, ${skipped} skipped (no sensitivity data or already complete), ${errors} errors`);
  return { updated, skipped, errors };
}

if (require.main === module) {
  backfillSimulationMetrics()
    .then(result => {
      console.log("Backfill result:", result);
      process.exit(0);
    })
    .catch(err => {
      console.error("Backfill failed:", err);
      process.exit(1);
    });
}
