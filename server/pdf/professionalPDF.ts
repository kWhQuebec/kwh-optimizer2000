import type { SimulationData } from "./types";
import { createContext } from "./types";

// Section renderers
import { renderCover } from "./sections/cover";
import { renderBillComparison } from "./sections/billComparison";
import { renderProjectSnapshot } from "./sections/projectSnapshot";
import { renderKPIResults } from "./sections/kpiResults";
import { renderInvestmentBreakdown } from "./sections/investmentBreakdown";
import { renderRoofConfiguration } from "./sections/roofConfiguration";
import { renderFinancialProjections } from "./sections/financialProjections";
import { renderFinancingComparison } from "./sections/financingComparison";
import { renderEquipment } from "./sections/equipment";
import { renderTimeline } from "./sections/timeline";
import { renderAssumptions } from "./sections/assumptions";
import { renderNextSteps } from "./sections/nextSteps";
import { renderCredibility } from "./sections/credibility";

// Appendix renderers
import { renderScenarioComparison } from "./appendix/scenarioComparison";
import { renderCashflowTable } from "./appendix/cashflowTable";
import { renderOptimization } from "./appendix/optimization";

export function generateProfessionalPDF(
  doc: PDFKit.PDFDocument,
  simulation: SimulationData,
  lang: "fr" | "en" = "fr",
  allSiteSimulations: SimulationData[] = [],
  options?: {
    catalogEquipment?: Array<{ name: string; manufacturer: string; warranty: string; spec: string; category: string }>;
    constructionTimeline?: Array<{ step: string; duration: string; status?: string }>;
  }
): void {
  const ctx = createContext(doc, simulation, lang, options);

  // === SALES FLOW: Impact pages first, technical details later ===

  renderCover(ctx);                        // P1: Cover
  renderBillComparison(ctx);               // P2: Bill Before/After (conditional)
  renderProjectSnapshot(ctx);              // P3: Project Snapshot
  renderKPIResults(ctx);                   // P4: Your Results
  renderInvestmentBreakdown(ctx);          // P5: Net Investment
  renderFinancialProjections(ctx);         // P6: Financial Projections
  renderFinancingComparison(ctx);          // P7: Financing Options (conditional)
  renderAssumptions(ctx);                  // P8: Assumptions & Exclusions
  renderEquipment(ctx);                    // P9: Equipment & Timeline (shared page)
  renderTimeline(ctx);
  renderNextSteps(ctx);                    // P10: Next Steps
  renderCredibility(ctx);                  // P11: They Trust Us

  // === APPENDIX ===

  renderRoofConfiguration(ctx);            // Appendix: Roof Configuration (conditional)
  renderScenarioComparison(ctx, allSiteSimulations);
  renderCashflowTable(ctx);
  renderOptimization(ctx);
}
