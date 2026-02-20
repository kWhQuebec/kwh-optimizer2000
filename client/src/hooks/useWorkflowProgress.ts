/**
 * useWorkflowProgress — Computes gate status, task progress, and step state
 * for the unified 6-step workflow stepper.
 *
 * Tasks are auto-detected from real site data — no manual checkboxes.
 * Each task has a `key` mapped to a boolean condition derived from DB fields.
 */
import { useMemo } from "react";
import {
  WORKFLOW_STEPS,
  WORKFLOW_TASKS,
  type WorkflowStepDef,
  type WorkflowTaskDef,
  type GateStatus,
  type EngineeringOutcome,
  type WorkflowPhase,
  getStepStatusFromStage,
} from "@shared/workflowSteps";

// ─── TYPES ────────────────────────────────────────────────────
export interface TaskStatus {
  task: WorkflowTaskDef;
  completed: boolean;
}

export interface StepProgress {
  step: WorkflowStepDef;
  status: "locked" | "active" | "completed";
  gateStatus: GateStatus;
  gateLabel: string;
  myTasks: { completed: number; total: number; points: number; maxPoints: number };
  otherTasks: { completed: number; total: number; points: number; maxPoints: number };
  allTasks: { completed: number; total: number; points: number; maxPoints: number; percentage: number };
  /** Individual task statuses for rendering checkmarks */
  taskStatuses: TaskStatus[];
  engineeringOutcome?: EngineeringOutcome;
  isCurrent: boolean;
}

export interface WorkflowProgress {
  steps: StepProgress[];
  currentStep: StepProgress | null;
  overallProgress: number;
  totalPoints: number;
  maxTotalPoints: number;
  currentPhase: WorkflowPhase;
}

// ─── SITE DATA INTERFACE ─────────────────────────────────────
// Expanded to include all fields needed for auto-detection
interface SiteData {
  // Step 1 fields
  meterFiles?: Array<unknown> | null;
  buildingType?: string | null;
  roofAreaSqM?: number | null;
  roofAreaAutoSqM?: number | null;
  estimatedAnnualConsumptionKwh?: number | null;
  estimatedMonthlyBill?: number | null;
  hqBillPath?: string | null;
  hqLegalClientName?: string | null;
  hqClientNumber?: string | null;
  quickInfoCompletedAt?: string | null;
  roofAreaValidated?: boolean | null;
  readyForAnalysis?: boolean | null;
  analysisAvailable?: boolean | null;
  quickAnalysisCompletedAt?: string | null;
  // Step 2+ fields
  procurationStatus?: string | null;
  procurationSentAt?: string | null;
  procurationSignedAt?: string | null;
  // Step 4
  engineeringOutcome?: string | null;
  // Nested data
  simulationRuns?: Array<{ id?: string; type?: string; pvSizeKW?: number; assumptions?: unknown }> | null;
  siteVisits?: Array<{ status?: string; visitDate?: string; notes?: string }> | null;
}

interface DesignAgreementData {
  status?: string | null;
  depositPaidAt?: string | null;
  acceptedAt?: string | null;
}

// ─── AUTO-DETECTION ENGINE ───────────────────────────────────
// Each task key maps to a function that returns true if the task is completed.
// This is the ONLY place where task completion logic lives.
type TaskDetector = (ctx: DetectionContext) => boolean;

interface DetectionContext {
  site: SiteData | null;
  designAgreement: DesignAgreementData | null;
  opportunityStage: string;
}

const TASK_DETECTORS: Record<string, TaskDetector> = {
  // ── Step 1: Analyse rapide ──
  s1_building_type: ({ site }) =>
    !!(site?.buildingType),
  s1_roof_area: ({ site }) =>
    !!(site?.roofAreaSqM || site?.roofAreaAutoSqM),
  s1_upload_bill: ({ site }) =>
    (site?.meterFiles?.length ?? 0) > 0 || !!site?.hqBillPath,
  s1_annual_consumption: ({ site }) =>
    !!(site?.estimatedAnnualConsumptionKwh || site?.estimatedMonthlyBill),
  s1_discovery_call: () => false, // Needs activity log — future
  s1_validate_parsing: ({ site }) =>
    !!(site?.hqLegalClientName && site?.hqClientNumber),
  s1_qualify_lead: ({ opportunityStage }) => {
    const qualifiedStages = ["qualified", "analysis_done", "design_mandate_signed", "epc_proposal_sent", "negotiation", "won_to_be_delivered", "won_in_construction", "won_delivered"];
    return qualifiedStages.includes(opportunityStage);
  },
  s1_prepare_analysis: ({ site }) =>
    !!(site?.readyForAnalysis || site?.analysisAvailable || site?.quickAnalysisCompletedAt),
  s1_complete_call: () => false, // Needs activity log — future

  // ── Step 2: Validation économique ──
  s2_read_proposal: ({ site }) =>
    !!(site?.analysisAvailable), // Implicit: if analysis is available, proposal was readable
  s2_ask_question: () => false, // Needs activity log — future
  s2_sign_procuration: ({ site }) =>
    site?.procurationStatus === "signed" || !!site?.procurationSignedAt,
  s2_sign_mandate: ({ designAgreement }) =>
    designAgreement?.status === "accepted" && !!designAgreement?.depositPaidAt,
  s2_run_analysis: ({ site }) =>
    !!(site?.analysisAvailable),
  s2_present_results: ({ opportunityStage }) => {
    const presentedStages = ["design_mandate_signed", "epc_proposal_sent", "negotiation", "won_to_be_delivered", "won_in_construction", "won_delivered"];
    return presentedStages.includes(opportunityStage);
  },

  // ── Step 3: Validation technique ──
  s3_site_access: () => false, // Needs activity log — future
  s3_roof_plans: () => false, // Needs document upload tracking — future
  s3_review_vc0: () => false, // Needs activity log — future
  s3_validate_production: ({ site }) =>
    (site?.simulationRuns?.length ?? 0) > 0,
  s3_coordinate_visit: ({ site }) => {
    const visits = site?.siteVisits ?? [];
    return visits.some(v => v.status === "completed" || v.status === "scheduled");
  },
  s3_track_vc0: ({ site }) => {
    const visits = site?.siteVisits ?? [];
    return visits.some(v => v.status === "completed");
  },
  s3_import_vc0: ({ site }) => {
    const visits = site?.siteVisits ?? [];
    return visits.some(v => v.status === "completed" && v.notes);
  },
  s3_calibrate_cashflow: ({ site }) =>
    (site?.simulationRuns?.length ?? 0) > 0 && !!(site?.simulationRuns?.[0]?.assumptions),

  // ── Step 4: Ingénierie & design final ──
  s4_receive_epc: ({ opportunityStage }) => {
    const epcStages = ["epc_proposal_sent", "negotiation", "won_to_be_delivered", "won_in_construction", "won_delivered"];
    return epcStages.includes(opportunityStage);
  },
  s4_compare_scenarios: ({ site }) =>
    (site?.simulationRuns?.length ?? 0) >= 3,
  s4_review_engineering: () => false, // Needs activity log — future
  s4_approve_design: ({ opportunityStage }) => {
    const approvedStages = ["won_to_be_delivered", "won_in_construction", "won_delivered"];
    return approvedStages.includes(opportunityStage);
  },
  s4_generate_scenarios: ({ site }) =>
    (site?.simulationRuns?.length ?? 0) >= 3,
  s4_coordinate_engineering: () => false, // Needs engineering report tracking — future
  s4_prepare_amendment: ({ site }) =>
    site?.engineeringOutcome === "amendment",
  s4_final_go: ({ opportunityStage }) => {
    const goStages = ["won_to_be_delivered", "won_in_construction", "won_delivered"];
    return goStages.includes(opportunityStage);
  },

  // ── Step 5: Construction ── (mostly future — needs construction tracking)
  s5_confirm_dates: () => false,
  s5_preinstall_checklist: () => false,
  s5_review_photos: () => false,
  s5_attend_inspection: () => false,
  s5_activate_monitoring: () => false,
  s5_order_materials: () => false,
  s5_validate_materials: () => false,
  s5_upload_photos: () => false,
  s5_complete_inspection: ({ opportunityStage }) =>
    opportunityStage === "won_delivered",
  s5_configure_monitoring: () => false,

  // ── Step 6: Opération ── (mostly future — needs O&M tracking)
  s6_check_dashboard: () => false,
  s6_share_linkedin: () => false,
  s6_refer_contact: () => false,
  s6_nps_survey: () => false,
  s6_90day_report: () => false,
  s6_request_testimonial: () => false,
  s6_qualify_referral: () => false,
  s6_document_portfolio: () => false,
};

function isTaskCompleted(taskKey: string, ctx: DetectionContext): boolean {
  const detector = TASK_DETECTORS[taskKey];
  if (!detector) return false;
  try {
    return detector(ctx);
  } catch {
    return false;
  }
}

// ─── GATE EVALUATION ──────────────────────────────────────────
function evaluateGate(
  step: WorkflowStepDef,
  site: SiteData | null,
  designAgreement: DesignAgreementData | null,
  opportunityStage: string,
): GateStatus {
  if (!site) return "locked";

  switch (step.stepNum) {
    case 1: {
      const hasMeterFiles = (site.meterFiles?.length ?? 0) > 0 || !!site.hqBillPath;
      return hasMeterFiles ? "passed" : "blocked";
    }
    case 2: {
      const mandatSigned = designAgreement?.status === "accepted";
      const depositPaid = !!designAgreement?.depositPaidAt;
      return (mandatSigned && depositPaid) ? "passed" : "blocked";
    }
    case 3: {
      const epcStages = ["epc_proposal_sent", "negotiation", "won_to_be_delivered", "won_in_construction", "won_delivered"];
      return epcStages.includes(opportunityStage) ? "passed" : "blocked";
    }
    case 4: {
      const goStages = ["won_to_be_delivered", "won_in_construction", "won_delivered"];
      return goStages.includes(opportunityStage) ? "passed" : "blocked";
    }
    case 5: {
      return opportunityStage === "won_delivered" ? "passed" : "blocked";
    }
    case 6: {
      return opportunityStage === "won_delivered" ? "passed" : "locked";
    }
    default:
      return "locked";
  }
}

// ─── TASK PROGRESS WITH AUTO-DETECTION ───────────────────────
function computeTaskProgress(
  stepNum: number,
  viewMode: "client" | "am",
  ctx: DetectionContext,
) {
  const role = viewMode === "client" ? "client" : "account_manager";
  const otherRole = viewMode === "client" ? "account_manager" : "client";

  const stepTasks = WORKFLOW_TASKS.filter(t => t.stepNum === stepNum);
  const taskStatuses: TaskStatus[] = stepTasks.map(task => ({
    task,
    completed: isTaskCompleted(task.key, ctx),
  }));

  const myStatuses = taskStatuses.filter(ts => ts.task.assignedTo === role);
  const otherStatuses = taskStatuses.filter(ts => ts.task.assignedTo === otherRole);

  const myCompleted = myStatuses.filter(ts => ts.completed).length;
  const myPoints = myStatuses.filter(ts => ts.completed).reduce((s, ts) => s + ts.task.points, 0);
  const myMaxPoints = myStatuses.reduce((s, ts) => s + ts.task.points, 0);

  const otherCompleted = otherStatuses.filter(ts => ts.completed).length;
  const otherPoints = otherStatuses.filter(ts => ts.completed).reduce((s, ts) => s + ts.task.points, 0);
  const otherMaxPoints = otherStatuses.reduce((s, ts) => s + ts.task.points, 0);

  const allCompleted = myCompleted + otherCompleted;
  const allPoints = myPoints + otherPoints;
  const allMaxPoints = myMaxPoints + otherMaxPoints;

  return {
    taskStatuses,
    myTasks: { completed: myCompleted, total: myStatuses.length, points: myPoints, maxPoints: myMaxPoints },
    otherTasks: { completed: otherCompleted, total: otherStatuses.length, points: otherPoints, maxPoints: otherMaxPoints },
    allTasks: {
      completed: allCompleted,
      total: stepTasks.length,
      points: allPoints,
      maxPoints: allMaxPoints,
      percentage: stepTasks.length > 0 ? Math.round((allCompleted / stepTasks.length) * 100) : 0,
    },
  };
}

// ─── MAIN HOOK ────────────────────────────────────────────────
export function useWorkflowProgress({
  site,
  designAgreement,
  opportunityStage = "prospect",
  viewMode = "am",
}: {
  site: SiteData | null;
  designAgreement?: DesignAgreementData | null;
  opportunityStage?: string;
  viewMode?: "client" | "am";
}): WorkflowProgress {
  return useMemo(() => {
    const ctx: DetectionContext = {
      site,
      designAgreement: designAgreement ?? null,
      opportunityStage,
    };

    const steps: StepProgress[] = WORKFLOW_STEPS.map((step) => {
      const status = getStepStatusFromStage(step, opportunityStage);
      const gateStatus = status === "completed"
        ? "passed" as GateStatus
        : evaluateGate(step, site, designAgreement ?? null, opportunityStage);

      const taskProgress = computeTaskProgress(step.missionNum, viewMode, ctx);

      const isCurrent = status === "active";
      const gateLabel = step.gateFr; // Always French for now

      let engineeringOutcome: EngineeringOutcome | undefined;
      if (step.stepNum === 4 && site?.engineeringOutcome) {
        engineeringOutcome = site.engineeringOutcome as EngineeringOutcome;
      }

      return {
        step,
        status,
        gateStatus,
        gateLabel,
        ...taskProgress,
        engineeringOutcome,
        isCurrent,
      };
    });

    const currentStep = steps.find(s => s.isCurrent) ?? null;
    const completedSteps = steps.filter(s => s.status === "completed").length;
    const overallProgress = Math.round((completedSteps / steps.length) * 100);
    const totalPoints = steps.reduce((s, sp) => s + sp.allTasks.points, 0);
    const maxTotalPoints = steps.reduce((s, sp) => s + sp.allTasks.maxPoints, 0);
    const currentPhase = currentStep?.step.phase ?? steps[0]?.step.phase ?? "exploration";

    return {
      steps,
      currentStep,
      overallProgress,
      totalPoints,
      maxTotalPoints,
      currentPhase,
    };
  }, [site, designAgreement, opportunityStage, viewMode]);
}
