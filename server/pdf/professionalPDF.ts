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
// renderEquipment removed — merged into renderSystemElements
import { renderTimeline } from "./sections/timeline";
import { renderAssumptions } from "./sections/assumptions";
import { renderNextSteps } from "./sections/nextSteps";
import { renderCredibility } from "./sections/credibility";
import { renderSystemElements } from "./sections/systemElements";
import { renderDeliveryAssurance } from "./sections/deliveryAssurance";
import { renderFitScore } from "./sections/fitScore";

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

  /**
   * NARRATIVE ARC FOR PDF STORYTELLING
   *
   * This PDF is structured to follow a compelling sales narrative:
   *
   * 1. EMOTIONAL IMPACT (Early pages)
   *    - Cover: Brand identity & project overview
   *    - Bill Comparison: "Here's how much you'll save" (concrete numbers)
   *    - Project Snapshot: Visual context & location
   *    - KPI Results: "Here's what your building earns over 25 years" + profit comparison
   *    - Investment Breakdown: What the net cost actually is
   *    - Financial Projections: The path to positive returns
   *
   * 2. TECHNICAL CREDIBILITY (Middle pages)
   *    - Financing Comparison: Options and flexibility
   *    - Assumptions & Exclusions: Transparency builds trust
   *    - Equipment & Timeline: Detailed specifications
   *
   * 3. CALL TO ACTION (Final pages)
   *    - Next Steps: Action-oriented language ("Let's take action")
   *    - Urgency messaging: Limited-time incentives
   *    - Credibility: Social proof of other successful projects
   *
   * 4. APPENDIX (Reference)
   *    - Detailed analysis for technical reviewers
   *
   * Future developers: Maintain this order to preserve narrative flow.
   * Emotional impact must come before technical details for better conversion.
   */

  // === SALES FLOW: Impact pages first, technical details later ===

  renderCover(ctx);                        // P1: Cover
  renderBillComparison(ctx);               // P2: Bill Before/After (conditional)
  renderProjectSnapshot(ctx);              // P3: Project Snapshot
  renderKPIResults(ctx);                   // P4: Your Results
  renderInvestmentBreakdown(ctx);          // P5: Net Investment
  renderFinancialProjections(ctx);         // P6: Financial Projections
  renderFinancingComparison(ctx);          // P7: Financing Options (conditional)
  renderAssumptions(ctx);                  // P8: Assumptions & Exclusions
  renderSystemElements(ctx);               // P9: System & Equipment (merged — flow + table + structural data)
  renderDeliveryAssurance(ctx);            // P10: Project Delivery Assurance
  renderFitScore(ctx);                     // P11: Desktop Screening / Fit Score
  renderTimeline(ctx);
  renderNextSteps(ctx);                    // P13: Next Steps
  renderCredibility(ctx);                  // P14: Why kWh Québec

  // === APPENDIX ===

  renderRoofConfiguration(ctx);            // Appendix: Roof Configuration (conditional)
  renderScenarioComparison(ctx, allSiteSimulations);
  renderCashflowTable(ctx);
  renderOptimization(ctx);
}
