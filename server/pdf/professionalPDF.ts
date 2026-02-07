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

  renderCover(ctx);
  renderBillComparison(ctx);
  renderProjectSnapshot(ctx);
  renderKPIResults(ctx);
  renderInvestmentBreakdown(ctx);
  renderFinancingComparison(ctx);
  renderFinancialProjections(ctx);
  renderNextSteps(ctx);
  renderCredibility(ctx);

  // === TECHNICAL APPENDIX ===

  renderEquipment(ctx);
  renderTimeline(ctx);
  renderRoofConfiguration(ctx);
  renderAssumptions(ctx);

  // === DATA APPENDIX ===

  renderScenarioComparison(ctx, allSiteSimulations);
  renderCashflowTable(ctx);
  renderOptimization(ctx);
}
