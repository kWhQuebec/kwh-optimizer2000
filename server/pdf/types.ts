import type { CashflowEntry, FinancialBreakdown, HourlyProfileEntry, PeakWeekEntry, SensitivityAnalysis } from "@shared/schema";
import type { DocumentSimulationData, RoofPolygonData } from "../documentDataProvider";

export type SimulationData = DocumentSimulationData;

export interface PDFContext {
  doc: PDFKit.PDFDocument;
  simulation: SimulationData;
  lang: "fr" | "en";
  t: (fr: string, en: string) => string;
  pageWidth: number;    // 612 (Letter)
  pageHeight: number;   // 792
  margin: number;       // 50
  contentWidth: number; // 512
  dateStr: string;
  headerHeight: number; // 80
  // Dynamic data (optional, fetched by enhanced documentDataProvider)
  catalogEquipment?: Array<{
    name: string;
    manufacturer: string;
    warranty: string;
    spec: string;
    category: string;
  }>;
  constructionTimeline?: Array<{
    step: string;
    duration: string;
    status?: string;
  }>;
}

export const COLORS = {
  blue: "#003DA6",
  gold: "#FFB005",
  darkGray: "#2d3748",
  mediumGray: "#4a5568",
  lightGray: "#718096",
  green: "#48bb78",
  red: "#DC2626",
  white: "#FFFFFF",
  background: "#f7fafc",
};

export function createContext(
  doc: PDFKit.PDFDocument,
  simulation: SimulationData,
  lang: "fr" | "en",
  options?: {
    catalogEquipment?: PDFContext["catalogEquipment"];
    constructionTimeline?: PDFContext["constructionTimeline"];
  }
): PDFContext {
  const t = (fr: string, en: string) => (lang === "fr" ? fr : en);
  const dateStr = new Date().toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA");
  return {
    doc,
    simulation,
    lang,
    t,
    pageWidth: 612,
    pageHeight: 792,
    margin: 50,
    contentWidth: 512,
    dateStr,
    headerHeight: 80,
    catalogEquipment: options?.catalogEquipment,
    constructionTimeline: options?.constructionTimeline,
  };
}
