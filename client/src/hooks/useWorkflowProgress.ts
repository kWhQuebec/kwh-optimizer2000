/**
 * useWorkflowProgress — Computes gate status, task progress, and step state
 * for the unified 6-step workflow stepper.
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
export interface StepProgress {
  step: WorkflowStepDef;
  /** locked | active | completed — derived from opportunity stage */
  status: "locked" | "active" | "completed";
  /** Gate condition evaluation */
  gateStatus: GateStatus;
  /** Gate human-readable description */
  gateLabel: string;
  /** Task progress for the current viewMode */
  myTasks: {
    completed: number;
    total: number;
    points: number;
    maxPoints: number;
  };
  /** Task progress for the other side */
  otherTasks: {
    completed: number;
    total: number;
    points: number;
    maxPoints: number;
  };
  /** Overall task progress (both sides) */
  allTasks: {
    completed: number;
    total: number;
    points: number;
    maxPoints: number;
    percentage: number;
  };
  /** Special outcome for step 4 (engineering) */
  engineeringOutcome?: EngineeringOutcome;
  /** Is this the current active step? */
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

// ─── SITE DATA INTERFACE (minimal, to avoid importing full schema) ─────
interface SiteData {
  meterFiles?: Array<unknown> | null;
  quickInfoCompletedAt?: string | null;
  buildingType?: string | null;
  roofAreaSqM?: number | null;
  estimatedMonthlyBill?: number | null;
  roofAreaValidated?: boolean | null;
  analysisAvailable?: boolean | null;
  quickAnalysisCompletedAt?: string | null;
  engineeringOutcome?: string | null;
}

interface DesignAgreementData {
  status?: string | null;
  depositPaidAt?: string | null;
}

interface MissionTaskData {
  id?: number;
  missionNumber?: number;
  assignedTo: "client" | "account_manager";
  completed: boolean;
  points?: number;
}

interface MissionData {
  missionNumber: number;
  status: "locked" | "active" | "completed";
  tasks: MissionTaskData[];
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
      // Gate: CSV de consommation disponible
      const hasMeterFiles = (site.meterFiles?.length ?? 0) > 0;
      return hasMeterFiles ? "passed" : "blocked";
    }
    case 2: {
      // Gate: Mandat signé + dépôt reçu
      const mandatSigned = designAgreement?.status === "accepted";
      const depositPaid = !!designAgreement?.depositPaidAt;
      return (mandatSigned && depositPaid) ? "passed" : "blocked";
    }
    case 3: {
      // Gate: Entente EPC signée — derived from stage
      const epcStages = ["epc_proposal_sent", "negotiation", "won_to_be_delivered", "won_in_construction", "won_delivered"];
      return epcStages.includes(opportunityStage) ? "passed" : "blocked";
    }
    case 4: {
      // Gate: Permis obtenus, plans approuvés, budget confirmé
      const goStages = ["won_to_be_delivered", "won_in_construction", "won_delivered"];
      return goStages.includes(opportunityStage) ? "passed" : "blocked";
    }
    case 5: {
      // Gate: Installation complétée + inspection réussie
      return opportunityStage === "won_delivered" ? "passed" : "blocked";
    }
    case 6: {
      // No gate — permanent state
      return opportunityStage === "won_delivered" ? "passed" : "locked";
    }
    default:
      return "locked";
  }
}

// ─── TASK PROGRESS CALCULATION ────────────────────────────────
function computeTaskProgress(
  stepNum: number,
  viewMode: "client" | "am",
  missions: MissionData[] | null,
) {
  const role = viewMode === "client" ? "client" : "account_manager";
  const otherRole = viewMode === "client" ? "account_manager" : "client";

  // Try to use real mission data from API
  const mission = missions?.find(m => m.missionNumber === stepNum);

  if (mission && mission.tasks.length > 0) {
    const myTasks = mission.tasks.filter(t => t.assignedTo === role);
    const otherTasks = mission.tasks.filter(t => t.assignedTo === otherRole);
    const allTasks = mission.tasks;

    const myCompleted = myTasks.filter(t => t.completed).length;
    const otherCompleted = otherTasks.filter(t => t.completed).length;
    const allCompleted = allTasks.filter(t => t.completed).length;

    const myPoints = myTasks.filter(t => t.completed).reduce((s, t) => s + (t.points ?? 0), 0);
    const myMaxPoints = myTasks.reduce((s, t) => s + (t.points ?? 0), 0);
    const otherPoints = otherTasks.filter(t => t.completed).reduce((s, t) => s + (t.points ?? 0), 0);
    const otherMaxPoints = otherTasks.reduce((s, t) => s + (t.points ?? 0), 0);
    const allPoints = myPoints + otherPoints;
    const allMaxPoints = myMaxPoints + otherMaxPoints;

    return {
      myTasks: { completed: myCompleted, total: myTasks.length, points: myPoints, maxPoints: myMaxPoints },
      otherTasks: { completed: otherCompleted, total: otherTasks.length, points: otherPoints, maxPoints: otherMaxPoints },
      allTasks: {
        completed: allCompleted,
        total: allTasks.length,
        points: allPoints,
        maxPoints: allMaxPoints,
        percentage: allTasks.length > 0 ? Math.round((allCompleted / allTasks.length) * 100) : 0,
      },
    };
  }

  // Fallback: use static task definitions
  const stepTasks = WORKFLOW_TASKS.filter(t => t.stepNum === stepNum);
  const myTaskDefs = stepTasks.filter(t => t.assignedTo === role);
  const otherTaskDefs = stepTasks.filter(t => t.assignedTo === otherRole);
  const myMaxPoints = myTaskDefs.reduce((s, t) => s + t.points, 0);
  const otherMaxPoints = otherTaskDefs.reduce((s, t) => s + t.points, 0);

  return {
    myTasks: { completed: 0, total: myTaskDefs.length, points: 0, maxPoints: myMaxPoints },
    otherTasks: { completed: 0, total: otherTaskDefs.length, points: 0, maxPoints: otherMaxPoints },
    allTasks: {
      completed: 0,
      total: stepTasks.length,
      points: 0,
      maxPoints: myMaxPoints + otherMaxPoints,
      percentage: 0,
    },
  };
}

// ─── MAIN HOOK ────────────────────────────────────────────────
export function useWorkflowProgress({
  site,
  designAgreement,
  opportunityStage = "prospect",
  viewMode = "am",
  missions = null,
}: {
  site: SiteData | null;
  designAgreement?: DesignAgreementData | null;
  opportunityStage?: string;
  viewMode?: "client" | "am";
  missions?: MissionData[] | null;
}): WorkflowProgress {
  return useMemo(() => {
    const steps: StepProgress[] = WORKFLOW_STEPS.map((step) => {
      const status = getStepStatusFromStage(step, opportunityStage);
      const gateStatus = status === "completed"
        ? "passed" as GateStatus
        : evaluateGate(step, site, designAgreement ?? null, opportunityStage);

      const taskProgress = computeTaskProgress(step.missionNum, viewMode, missions);

      const isCurrent = status === "active";
      const language = "fr"; // TODO: pass from context if needed
      const gateLabel = language === "fr" ? step.gateFr : step.gateEn;

      // Engineering outcome for step 4
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
  }, [site, designAgreement, opportunityStage, viewMode, missions]);
}
