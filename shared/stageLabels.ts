// ============================================
// SOURCE UNIQUE — Labels, couleurs et phases des stages pipeline
// Aligné sur brandContent.ts (parcours client unifié)
// Modifier ici = mise à jour partout (dashboard, pipeline, gamification)
// ============================================

export type PipelineStage =
  | "prospect"
  | "contacted"
  | "qualified"
  | "analysis_done"
  | "design_mandate_signed"
  | "epc_proposal_sent"
  | "negotiation"
  | "won_to_be_delivered"
  | "won_in_construction"
  | "won_delivered"
  | "lost"
  | "disqualified";

export type WorkflowPhase = "exploration" | "conception" | "realisation" | "operation" | "closed";

// === LABELS COMPLETS (avec %) ===
export const STAGE_LABELS: Record<string, { fr: string; en: string }> = {
  prospect:               { fr: "Nouveau prospect (5%)",            en: "New Prospect (5%)" },
  contacted:              { fr: "Premier contact (10%)",            en: "First Contact (10%)" },
  qualified:              { fr: "Analyse rapide du potentiel (15%)",en: "Quick Potential Analysis (15%)" },
  analysis_done:          { fr: "Validation économique (25%)",      en: "Economic Validation (25%)" },
  design_mandate_signed:  { fr: "Validation technique (50%)",       en: "Technical Validation (50%)" },
  epc_proposal_sent:      { fr: "Ingénierie, plans & devis (75%)", en: "Engineering, Plans & Quotes (75%)" },
  negotiation:            { fr: "Négociation EPC (90%)",            en: "EPC Negotiation (90%)" },
  won_to_be_delivered:    { fr: "Contrat signé (100%)",             en: "Contract Signed (100%)" },
  won_in_construction:    { fr: "Permis & installation (100%)",     en: "Permits & Installation (100%)" },
  won_delivered:          { fr: "En opération (100%)",              en: "In Operation (100%)" },
  lost:                   { fr: "Perdu (0%)",                       en: "Lost (0%)" },
  disqualified:           { fr: "Non qualifié (0%)",                en: "Disqualified (0%)" },
};

// === LABELS COURTS (pour colonnes pipeline, badges, UI compacte) ===
export const STAGE_SHORT_LABELS: Record<string, { fr: string; en: string }> = {
  prospect:               { fr: "Prospect",        en: "Prospect" },
  contacted:              { fr: "Contact",          en: "Contacted" },
  qualified:              { fr: "Potentiel",        en: "Potential" },
  analysis_done:          { fr: "Valid. éco.",      en: "Econ. Valid." },
  design_mandate_signed:  { fr: "Valid. tech.",     en: "Tech. Valid." },
  epc_proposal_sent:      { fr: "Plans & devis",   en: "Plans & Quotes" },
  negotiation:            { fr: "Négociation",      en: "Negotiation" },
  won_to_be_delivered:    { fr: "Contrat signé",    en: "Contract Signed" },
  won_in_construction:    { fr: "Installation",     en: "Installation" },
  won_delivered:          { fr: "En opération",     en: "In Operation" },
  lost:                   { fr: "Perdu",            en: "Lost" },
  disqualified:           { fr: "Non qualifié",     en: "Disqualified" },
};

// === PHASES (4 phases workflow) ===
export const STAGE_PHASES: Record<string, WorkflowPhase> = {
  prospect:               "exploration",
  contacted:              "exploration",
  qualified:              "exploration",
  analysis_done:          "conception",
  design_mandate_signed:  "conception",
  epc_proposal_sent:      "realisation",
  negotiation:            "realisation",
  won_to_be_delivered:    "realisation",
  won_in_construction:    "operation",
  won_delivered:          "operation",
  lost:                   "closed",
  disqualified:           "closed",
};

// === COULEURS PAR PHASE ===
export const PHASE_COLORS: Record<WorkflowPhase, { bg: string; text: string; border: string; solid: string; tailwind: string; tailwindBg: string }> = {
  exploration:  { bg: "#F3F4F6", text: "#374151", border: "#9CA3AF", solid: "#6B7280", tailwind: "text-gray-600",  tailwindBg: "bg-gray-100" },
  conception:   { bg: "#DBEAFE", text: "#1E40AF", border: "#93C5FD", solid: "#3B82F6", tailwind: "text-blue-600",  tailwindBg: "bg-blue-100" },
  realisation:  { bg: "#FEF3C7", text: "#92400E", border: "#FCD34D", solid: "#F59E0B", tailwind: "text-amber-600", tailwindBg: "bg-amber-100" },
  operation:    { bg: "#D1FAE5", text: "#065F46", border: "#6EE7B7", solid: "#10B981", tailwind: "text-green-600", tailwindBg: "bg-green-100" },
  closed:       { bg: "#F3F4F6", text: "#6B7280", border: "#D1D5DB", solid: "#9CA3AF", tailwind: "text-gray-400",  tailwindBg: "bg-gray-50" },
};

// === COULEURS PAR STAGE (pour charts/graphiques) ===
export const STAGE_CHART_COLORS: Record<string, string> = {
  prospect:               "#9CA3AF", // gray
  contacted:              "#9CA3AF",
  qualified:              "#6B7280",
  analysis_done:          "#60A5FA", // blue
  design_mandate_signed:  "#3B82F6",
  epc_proposal_sent:      "#F59E0B", // amber
  negotiation:            "#D97706",
  won_to_be_delivered:    "#F59E0B",
  won_in_construction:    "#10B981", // green
  won_delivered:          "#059669",
  lost:                   "#EF4444",
  disqualified:           "#9CA3AF",
};

// === COULEURS TAILWIND PAR STAGE (pour classes CSS) ===
export const STAGE_TAILWIND: Record<string, { bar: string; border: string; badge: string }> = {
  prospect:               { bar: "bg-gray-300",  border: "border-t-gray-300",  badge: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  contacted:              { bar: "bg-gray-400",  border: "border-t-gray-400",  badge: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  qualified:              { bar: "bg-gray-500",  border: "border-t-gray-500",  badge: "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200" },
  analysis_done:          { bar: "bg-blue-400",  border: "border-t-blue-400",  badge: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  design_mandate_signed:  { bar: "bg-blue-600",  border: "border-t-blue-600",  badge: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  epc_proposal_sent:      { bar: "bg-amber-400", border: "border-t-amber-400", badge: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  negotiation:            { bar: "bg-amber-500", border: "border-t-amber-500", badge: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  won_to_be_delivered:    { bar: "bg-amber-600", border: "border-t-amber-600", badge: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
  won_in_construction:    { bar: "bg-green-500", border: "border-t-green-500", badge: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  won_delivered:          { bar: "bg-green-600", border: "border-t-green-600", badge: "bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200" },
  lost:                   { bar: "bg-red-400",   border: "border-t-red-400",   badge: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
  disqualified:           { bar: "bg-gray-300",  border: "border-t-gray-300",  badge: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" },
};

// === PROBABILITÉS ===
export const STAGE_PROBABILITIES: Record<string, number> = {
  prospect: 5,
  contacted: 10,
  qualified: 15,
  analysis_done: 25,
  design_mandate_signed: 50,
  epc_proposal_sent: 75,
  negotiation: 90,
  won_to_be_delivered: 100,
  won_in_construction: 100,
  won_delivered: 100,
  lost: 0,
  disqualified: 0,
};

// === STAGES ACTIFS (entonnoir de ventes) ===
export const ACTIVE_STAGES: PipelineStage[] = [
  "prospect", "contacted", "qualified", "analysis_done",
  "design_mandate_signed", "epc_proposal_sent", "negotiation",
];

// === ALL STAGES IN ORDER ===
export const ALL_STAGES: PipelineStage[] = [
  "prospect", "contacted", "qualified", "analysis_done",
  "design_mandate_signed", "epc_proposal_sent", "negotiation",
  "won_to_be_delivered", "won_in_construction", "won_delivered",
  "lost", "disqualified",
];

// === HELPERS ===
export function getPhaseForStage(stage: string): WorkflowPhase {
  return STAGE_PHASES[stage] || "closed";
}

export function getPhaseColor(stage: string) {
  const phase = getPhaseForStage(stage);
  return PHASE_COLORS[phase];
}

export function getStageLabel(stage: string, lang: string = "fr"): string {
  const labels = STAGE_LABELS[stage];
  if (!labels) return stage;
  return lang === "fr" ? labels.fr : labels.en;
}

export function getStageShortLabel(stage: string, lang: string = "fr"): string {
  const labels = STAGE_SHORT_LABELS[stage];
  if (!labels) return stage;
  return lang === "fr" ? labels.fr : labels.en;
}
