/**
 * workflowSteps.ts — Single source of truth for the 6-step unified workflow.
 * Merges the workflow stepper (site-detail) and gamification missions (MissionMap)
 * into one coherent model with gates (hard blocks) and task scoring.
 */

// ─── TYPES ────────────────────────────────────────────────────
export type WorkflowPhase = "exploration" | "conception" | "realisation" | "operation";

export type GateStatus = "locked" | "blocked" | "passed";

export type EngineeringOutcome = "pending" | "proceed" | "amendment" | "cancellation";

export interface WorkflowStepDef {
  id: string;
  stepNum: number;
  missionNum: number;
  labelFr: string;
  labelEn: string;
  objectiveFr: string;
  objectiveEn: string;
  phase: WorkflowPhase;
  /** Pipeline stages that map to this step being "active" */
  activeStages: string[];
  /** Pipeline stages that mean this step is "completed" */
  completedStages: string[];
  /** Gate description */
  gateFr: string;
  gateEn: string;
  /** Whether this gate is a hard block (cannot proceed without it) */
  isHardBlock: boolean;
  /** Tabs in site-detail that belong to this step */
  tabs: string[];
  /** Total possible points for this step's mission */
  maxPoints: number;
}

export interface WorkflowTaskDef {
  stepNum: number;
  assignedTo: "client" | "account_manager";
  titleFr: string;
  titleEn: string;
  points: number;
  /** If true, this task is not required to pass the gate */
  optional: boolean;
}

// ─── PHASE COLORS (brand-aligned) ────────────────────────────
export const PHASE_CONFIG: Record<WorkflowPhase, {
  labelFr: string;
  labelEn: string;
  color: string;
  bgClass: string;
  ringClass: string;
}> = {
  exploration: {
    labelFr: "Exploration",
    labelEn: "Exploration",
    color: "#6B7280", // gray-500
    bgClass: "bg-gray-100 dark:bg-gray-800",
    ringClass: "ring-gray-400",
  },
  conception: {
    labelFr: "Conception",
    labelEn: "Design",
    color: "#003DA6", // brand blue
    bgClass: "bg-blue-50 dark:bg-blue-950",
    ringClass: "ring-blue-400",
  },
  realisation: {
    labelFr: "Réalisation",
    labelEn: "Construction",
    color: "#FFB005", // brand gold
    bgClass: "bg-amber-50 dark:bg-amber-950",
    ringClass: "ring-amber-400",
  },
  operation: {
    labelFr: "Opération",
    labelEn: "Operations",
    color: "#16A34A", // brand green
    bgClass: "bg-green-50 dark:bg-green-950",
    ringClass: "ring-green-400",
  },
};

// ─── 6 WORKFLOW STEPS ─────────────────────────────────────────
export const WORKFLOW_STEPS: WorkflowStepDef[] = [
  {
    id: "quick-analysis",
    stepNum: 1,
    missionNum: 1,
    labelFr: "Analyse rapide",
    labelEn: "Quick Analysis",
    objectiveFr: "Collecter les données de base et obtenir le CSV de consommation",
    objectiveEn: "Collect basic data and obtain consumption CSV",
    phase: "exploration",
    activeStages: ["prospect", "contacted", "qualified"],
    completedStages: ["analysis_done", "design_mandate_signed", "epc_proposal_sent", "negotiation", "won_to_be_delivered", "won_in_construction", "won_delivered"],
    gateFr: "CSV de consommation disponible",
    gateEn: "Consumption CSV available",
    isHardBlock: true,
    tabs: ["quick-analysis"],
    maxPoints: 325,
  },
  {
    id: "economic-validation",
    stepNum: 2,
    missionNum: 2,
    labelFr: "Validation économique",
    labelEn: "Economic Validation",
    objectiveFr: "Signer le mandat de conception préliminaire et recevoir le dépôt",
    objectiveEn: "Sign the preliminary design mandate and receive deposit",
    phase: "conception",
    activeStages: ["analysis_done"],
    completedStages: ["design_mandate_signed", "epc_proposal_sent", "negotiation", "won_to_be_delivered", "won_in_construction", "won_delivered"],
    gateFr: "Mandat de conception signé + dépôt reçu",
    gateEn: "Design mandate signed + deposit received",
    isHardBlock: true,
    tabs: ["consumption", "analysis", "design-agreement"],
    maxPoints: 750,
  },
  {
    id: "technical-validation",
    stepNum: 3,
    missionNum: 3,
    labelFr: "Validation technique",
    labelEn: "Technical Validation",
    objectiveFr: "Signer l'entente EPC (conditionnelle à la validation d'ingénierie)",
    objectiveEn: "Sign EPC agreement (conditional on engineering validation)",
    phase: "conception",
    activeStages: ["design_mandate_signed"],
    completedStages: ["epc_proposal_sent", "negotiation", "won_to_be_delivered", "won_in_construction", "won_delivered"],
    gateFr: "Entente EPC signée",
    gateEn: "EPC agreement signed",
    isHardBlock: true,
    tabs: ["site-visit"],
    maxPoints: 500,
  },
  {
    id: "engineering",
    stepNum: 4,
    missionNum: 4,
    labelFr: "Ingénierie & design final",
    labelEn: "Engineering & Final Design",
    objectiveFr: "Permis obtenus, plans stampés, budget respecté — sinon avenant ou résiliation",
    objectiveEn: "Permits obtained, stamped plans, budget met — otherwise amendment or cancellation",
    phase: "realisation",
    activeStages: ["epc_proposal_sent", "negotiation"],
    completedStages: ["won_to_be_delivered", "won_in_construction", "won_delivered"],
    gateFr: "Permis obtenus, plans approuvés, budget confirmé",
    gateEn: "Permits obtained, plans approved, budget confirmed",
    isHardBlock: true,
    tabs: ["epc-proposal", "plans-specs"],
    maxPoints: 1000,
  },
  {
    id: "construction",
    stepNum: 5,
    missionNum: 5,
    labelFr: "Construction",
    labelEn: "Construction",
    objectiveFr: "Installation dans les délais, qualité exceptionnelle, marge > industrie",
    objectiveEn: "On-time installation, exceptional quality, margin above industry",
    phase: "realisation",
    activeStages: ["won_to_be_delivered", "won_in_construction"],
    completedStages: ["won_delivered"],
    gateFr: "Installation complétée + inspection réussie",
    gateEn: "Installation completed + inspection passed",
    isHardBlock: true,
    tabs: ["permits"],
    maxPoints: 2000,
  },
  {
    id: "operation",
    stepNum: 6,
    missionNum: 6,
    labelFr: "Opération",
    labelEn: "Operations",
    objectiveFr: "Uptime maximal, production annuelle maximale, coûts d'entretien minimaux",
    objectiveEn: "Maximum uptime, maximum annual production, minimum maintenance costs",
    phase: "operation",
    activeStages: ["won_delivered"],
    completedStages: [],
    gateFr: "Système en production",
    gateEn: "System in production",
    isHardBlock: false,
    tabs: ["operations"],
    maxPoints: 2000,
  },
];

// ─── TASK DEFINITIONS (per step, per role) ───────────────────
export const WORKFLOW_TASKS: WorkflowTaskDef[] = [
  // ── Step 1: Analyse rapide ──
  { stepNum: 1, assignedTo: "client", titleFr: "Sélectionner le type de bâtiment", titleEn: "Select building type", points: 25, optional: true },
  { stepNum: 1, assignedTo: "client", titleFr: "Estimer la superficie de toiture", titleEn: "Estimate roof area", points: 25, optional: true },
  { stepNum: 1, assignedTo: "client", titleFr: "Uploader sa facture Hydro-Québec", titleEn: "Upload Hydro-Québec bill", points: 50, optional: false },
  { stepNum: 1, assignedTo: "client", titleFr: "Fournir consommation annuelle estimée", titleEn: "Provide estimated annual consumption", points: 25, optional: true },
  { stepNum: 1, assignedTo: "client", titleFr: "Booker un appel découverte", titleEn: "Book a discovery call", points: 50, optional: true },
  { stepNum: 1, assignedTo: "account_manager", titleFr: "Valider le parsing AI de la facture", titleEn: "Validate AI bill parsing", points: 25, optional: false },
  { stepNum: 1, assignedTo: "account_manager", titleFr: "Qualifier le lead (4 portes)", titleEn: "Qualify lead (4 gates)", points: 50, optional: false },
  { stepNum: 1, assignedTo: "account_manager", titleFr: "Préparer l'analyse préliminaire", titleEn: "Prepare preliminary analysis", points: 25, optional: false },
  { stepNum: 1, assignedTo: "account_manager", titleFr: "Compléter l'appel dans les 48h", titleEn: "Complete call within 48h", points: 50, optional: false },

  // ── Step 2: Validation économique ──
  { stepNum: 2, assignedTo: "client", titleFr: "Lire la proposition préliminaire", titleEn: "Read preliminary proposal", points: 50, optional: true },
  { stepNum: 2, assignedTo: "client", titleFr: "Poser au moins 1 question", titleEn: "Ask at least 1 question", points: 50, optional: true },
  { stepNum: 2, assignedTo: "client", titleFr: "Signer la procuration Hydro-Québec", titleEn: "Sign Hydro-Québec proxy", points: 100, optional: false },
  { stepNum: 2, assignedTo: "client", titleFr: "Signer le mandat + verser le dépôt", titleEn: "Sign mandate + pay deposit", points: 200, optional: false },
  { stepNum: 2, assignedTo: "account_manager", titleFr: "Envoyer la proposition < 3 jours", titleEn: "Send proposal within 3 days", points: 100, optional: false },
  { stepNum: 2, assignedTo: "account_manager", titleFr: "Répondre aux questions < 24h", titleEn: "Answer questions within 24h", points: 50, optional: false },
  { stepNum: 2, assignedTo: "account_manager", titleFr: "Soumettre procuration à HQ", titleEn: "Submit proxy to HQ", points: 50, optional: false },
  { stepNum: 2, assignedTo: "account_manager", titleFr: "Confirmer réception + créer fiche CRM", titleEn: "Confirm receipt + create CRM record", points: 50, optional: false },

  // ── Step 3: Validation technique ──
  { stepNum: 3, assignedTo: "client", titleFr: "Donner accès au site", titleEn: "Provide site access", points: 50, optional: false },
  { stepNum: 3, assignedTo: "client", titleFr: "Fournir plans de toiture existants", titleEn: "Provide existing roof plans", points: 50, optional: true },
  { stepNum: 3, assignedTo: "client", titleFr: "Consulter le rapport VC0", titleEn: "Review VC0 report", points: 50, optional: true },
  { stepNum: 3, assignedTo: "client", titleFr: "Valider les hypothèses de production", titleEn: "Validate production assumptions", points: 50, optional: true },
  { stepNum: 3, assignedTo: "account_manager", titleFr: "Coordonner visite avec Rematek", titleEn: "Coordinate visit with Rematek", points: 50, optional: false },
  { stepNum: 3, assignedTo: "account_manager", titleFr: "Suivre la progression du VC0", titleEn: "Track VC0 progress", points: 50, optional: false },
  { stepNum: 3, assignedTo: "account_manager", titleFr: "Importer VC0 dans la plateforme", titleEn: "Import VC0 into platform", points: 50, optional: false },
  { stepNum: 3, assignedTo: "account_manager", titleFr: "Calibrer CashflowEngine avec VC0", titleEn: "Calibrate CashflowEngine with VC0", points: 50, optional: false },

  // ── Step 4: Ingénierie & design final ──
  { stepNum: 4, assignedTo: "client", titleFr: "Recevoir la proposition EPC complète", titleEn: "Receive complete EPC proposal", points: 50, optional: false },
  { stepNum: 4, assignedTo: "client", titleFr: "Comparer les scénarios financiers", titleEn: "Compare financial scenarios", points: 100, optional: true },
  { stepNum: 4, assignedTo: "client", titleFr: "Reviewer le rapport d'ingénierie", titleEn: "Review engineering report", points: 100, optional: false },
  { stepNum: 4, assignedTo: "client", titleFr: "Approuver le design final ou avenant", titleEn: "Approve final design or amendment", points: 250, optional: false },
  { stepNum: 4, assignedTo: "account_manager", titleFr: "Générer proposition 3 scénarios", titleEn: "Generate 3-scenario proposal", points: 100, optional: false },
  { stepNum: 4, assignedTo: "account_manager", titleFr: "Coordonner rapport d'ingénieur", titleEn: "Coordinate engineering report", points: 100, optional: false },
  { stepNum: 4, assignedTo: "account_manager", titleFr: "Préparer avenant si requis", titleEn: "Prepare amendment if required", points: 100, optional: true },
  { stepNum: 4, assignedTo: "account_manager", titleFr: "Obtenir GO final + permis confirmés", titleEn: "Obtain final GO + permits confirmed", points: 250, optional: false },

  // ── Step 5: Construction ──
  { stepNum: 5, assignedTo: "client", titleFr: "Confirmer dates d'accès au site", titleEn: "Confirm site access dates", points: 100, optional: false },
  { stepNum: 5, assignedTo: "client", titleFr: "Valider checklist pré-installation", titleEn: "Validate pre-installation checklist", points: 100, optional: false },
  { stepNum: 5, assignedTo: "client", titleFr: "Consulter photos quotidiennes", titleEn: "Review daily photos", points: 100, optional: true },
  { stepNum: 5, assignedTo: "client", titleFr: "Être présent à l'inspection finale", titleEn: "Attend final inspection", points: 100, optional: false },
  { stepNum: 5, assignedTo: "client", titleFr: "Activer son compte monitoring", titleEn: "Activate monitoring account", points: 100, optional: false },
  { stepNum: 5, assignedTo: "account_manager", titleFr: "Commander matériel (Jinko + Kaco)", titleEn: "Order materials (Jinko + Kaco)", points: 100, optional: false },
  { stepNum: 5, assignedTo: "account_manager", titleFr: "Valider réception matériel", titleEn: "Validate material receipt", points: 100, optional: false },
  { stepNum: 5, assignedTo: "account_manager", titleFr: "Upload photos + daily log", titleEn: "Upload photos + daily log", points: 100, optional: false },
  { stepNum: 5, assignedTo: "account_manager", titleFr: "Compléter inspection", titleEn: "Complete inspection", points: 100, optional: false },
  { stepNum: 5, assignedTo: "account_manager", titleFr: "Configurer monitoring API", titleEn: "Configure monitoring API", points: 100, optional: false },

  // ── Step 6: Opération ──
  { stepNum: 6, assignedTo: "client", titleFr: "Consulter dashboard production (hebdo)", titleEn: "Check production dashboard (weekly)", points: 100, optional: true },
  { stepNum: 6, assignedTo: "client", titleFr: "Partager résultats sur LinkedIn", titleEn: "Share results on LinkedIn", points: 200, optional: true },
  { stepNum: 6, assignedTo: "client", titleFr: "Référer 1 contact intéressé", titleEn: "Refer 1 interested contact", points: 500, optional: true },
  { stepNum: 6, assignedTo: "client", titleFr: "Évaluer l'expérience kWh (NPS)", titleEn: "Rate kWh experience (NPS)", points: 100, optional: true },
  { stepNum: 6, assignedTo: "account_manager", titleFr: "Envoyer rapport 90 jours", titleEn: "Send 90-day report", points: 200, optional: false },
  { stepNum: 6, assignedTo: "account_manager", titleFr: "Demander le témoignage", titleEn: "Request testimonial", points: 100, optional: true },
  { stepNum: 6, assignedTo: "account_manager", titleFr: "Qualifier la référence < 48h", titleEn: "Qualify referral within 48h", points: 200, optional: false },
  { stepNum: 6, assignedTo: "account_manager", titleFr: "Documenter le cas portfolio", titleEn: "Document portfolio case", points: 200, optional: false },
];

// ─── HELPERS ──────────────────────────────────────────────────

/** Get tasks for a specific step and role */
export function getStepTasks(stepNum: number, role?: "client" | "account_manager"): WorkflowTaskDef[] {
  return WORKFLOW_TASKS.filter(t =>
    t.stepNum === stepNum && (!role || t.assignedTo === role)
  );
}

/** Get step definition by ID */
export function getStepById(id: string): WorkflowStepDef | undefined {
  return WORKFLOW_STEPS.find(s => s.id === id);
}

/** Get step definition by step number */
export function getStepByNum(num: number): WorkflowStepDef | undefined {
  return WORKFLOW_STEPS.find(s => s.stepNum === num);
}

/** Get the step that contains a given tab */
export function getStepForTab(tabId: string): WorkflowStepDef | undefined {
  return WORKFLOW_STEPS.find(s => s.tabs.includes(tabId));
}

/** Get the current step based on opportunity stage */
export function getCurrentStep(stage: string): WorkflowStepDef {
  // Check if any step has this as an active stage
  const activeStep = WORKFLOW_STEPS.find(s => s.activeStages.includes(stage));
  if (activeStep) return activeStep;

  // Check if it's a completed stage for any step - return the next incomplete
  for (let i = 0; i < WORKFLOW_STEPS.length; i++) {
    if (WORKFLOW_STEPS[i].completedStages.includes(stage)) {
      // Return the next step if available, otherwise this one
      return WORKFLOW_STEPS[Math.min(i + 1, WORKFLOW_STEPS.length - 1)];
    }
  }

  // Default to step 1
  return WORKFLOW_STEPS[0];
}

/** Determine step status based on opportunity stage */
export function getStepStatusFromStage(
  step: WorkflowStepDef,
  currentStage: string
): "locked" | "active" | "completed" {
  if (step.completedStages.includes(currentStage)) return "completed";
  if (step.activeStages.includes(currentStage)) return "active";

  // Check if any prior step is active or if this step is past
  const stageOrder = [
    "prospect", "contacted", "qualified", "analysis_done",
    "design_mandate_signed", "epc_proposal_sent", "negotiation",
    "won_to_be_delivered", "won_in_construction", "won_delivered"
  ];

  const currentIdx = stageOrder.indexOf(currentStage);
  const stepActiveIdxs = step.activeStages.map(s => stageOrder.indexOf(s));
  const stepCompletedIdxs = step.completedStages.map(s => stageOrder.indexOf(s));

  const minActiveIdx = Math.min(...stepActiveIdxs);

  if (currentIdx > minActiveIdx) {
    // We're past this step's active stages — it's completed
    return "completed";
  }

  return "locked";
}
