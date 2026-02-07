import type { SimulationData } from "./types";
import { createContext } from "./types";

// Section renderers
import { renderCover } from "./sections/cover";
import { renderProjectSnapshot } from "./sections/projectSnapshot";
import { renderKPIResults } from "./sections/kpiResults";
import { renderInvestmentBreakdown } from "./sections/investmentBreakdown";
import { renderRoofConfiguration } from "./sections/roofConfiguration";
import { renderFinancialProjections } from "./sections/financialProjections";
import { renderAssumptions } from "./sections/assumptions";
import { renderEquipment } from "./sections/equipment";
import { renderTimeline } from "./sections/timeline";
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

  // === MAIN SECTIONS (11) ===

  // Section 1: Cover
  renderCover(ctx);

  // Section 2: Project Snapshot
  renderProjectSnapshot(ctx);

  // Section 3: KPI Results
  renderKPIResults(ctx);

  // Section 4: Net Investment Breakdown (visual waterfall)
  renderInvestmentBreakdown(ctx);

  // Section 5: Roof Configuration (enriched with per-zone table)
  renderRoofConfiguration(ctx);

  // Section 6: Financial Projections (cashflow + cost of inaction)
  renderFinancialProjections(ctx);

  // Section 7: Assumptions & Exclusions
  renderAssumptions(ctx);

  // Section 8 + 9: Equipment & Timeline (shared page)
  renderEquipment(ctx);
  renderTimeline(ctx);

  // Section 10: Next Steps (own page)
  renderNextSteps(ctx);

  // Section 11: They Trust Us (Credibility)
  renderCredibility(ctx);

  // === APPENDIX ===

  // Appendix A: Scenario Comparison (conditional)
  renderScenarioComparison(ctx, allSiteSimulations);

  // Appendix B: 25-Year Cashflow Table
  renderCashflowTable(ctx);

  // Appendix C: Optimization Analysis
  renderOptimization(ctx);
}
