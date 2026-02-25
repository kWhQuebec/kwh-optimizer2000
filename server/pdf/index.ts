// Re-export all PDF generators with the same function names as the old pdfGenerator.ts
// so that route imports just change path from "../pdfGenerator" to "../pdf"

export { generateMethodologyPDF } from "./methodologyPDF";
export { generateDesignAgreementPDF } from "./designAgreementPDF";
export { generatePortfolioSummaryPDF } from "./portfolioSummaryPDF";
export { generateExecutiveSummaryPDF } from "./executiveSummaryPDF";
export { generateMasterAgreementPDF } from "./masterAgreementPDF";
