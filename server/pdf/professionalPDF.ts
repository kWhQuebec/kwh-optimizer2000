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

  // Section 1: Cover
  renderCover(ctx);

  // Section 2: Bill Comparison (Before / After) — immediate financial impact
  renderBillComparison(ctx);

  // Section 3: Project Snapshot — system overview
  renderProjectSnapshot(ctx);

  // Section 4: KPI Results — key financial metrics
  renderKPIResults(ctx);

  // Section 5: Net Investment Breakdown — how incentives reduce cost
  renderInvestmentBreakdown(ctx);

  // Section 6: Financing Options — how to pay
  renderFinancingComparison(ctx);

  // Section 7: Financial Projections — long-term value
  renderFinancialProjections(ctx);

  // Section 8: Next Steps — call to action while motivation is high
  renderNextSteps(ctx);

  // Section 9: Credibility — social proof
  renderCredibility(ctx);

  // === TECHNICAL APPENDIX ===

  // Section 10 + 11: Equipment & Timeline
  renderEquipment(ctx);
  renderTimeline(ctx);

  // Section 12: Roof Configuration
  renderRoofConfiguration(ctx);

  // Section 13: Assumptions & Exclusions
  renderAssumptions(ctx);

  // === DATA APPENDIX ===

  // Appendix A: Scenario Comparison (conditional)
  renderScenarioComparison(ctx, allSiteSimulations);

  // Appendix B: 25-Year Cashflow Table
  renderCashflowTable(ctx);

  // Appendix C: Optimization Analysis
  renderOptimization(ctx);
}
