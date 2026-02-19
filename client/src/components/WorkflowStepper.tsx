/**
 * WorkflowStepper — Unified 6-step workflow with score rings, gates, and task progress.
 * Replaces both the inline stepper in site-detail and ProjectTimeline+MissionMap in client-portal.
 */
import { useState } from "react";
import {
  Search, BarChart3, Compass, HardHat, Hammer, Sun,
  Lock, CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp,
  Zap, Circle, Flag, Eye, Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PHASE_CONFIG, WORKFLOW_TASKS, type WorkflowPhase, type EngineeringOutcome } from "@shared/workflowSteps";
import type { StepProgress } from "@/hooks/useWorkflowProgress";
import { useI18n } from "@/lib/i18n";

// ─── STEP ICONS ───────────────────────────────────────────────
const STEP_ICONS = [Search, BarChart3, Compass, HardHat, Hammer, Sun];

// ─── SCORE RING SVG ───────────────────────────────────────────
function ScoreRing({
  percentage,
  size = 40,
  strokeWidth = 3.5,
  color,
  status,
  engineeringOutcome,
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  status: "locked" | "active" | "completed";
  engineeringOutcome?: EngineeringOutcome;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const center = size / 2;

  // Override color for special states
  let ringColor = color;
  let bgColor = "#E5E7EB"; // gray-200
  if (status === "locked") {
    ringColor = "#D1D5DB"; // gray-300
    bgColor = "#F3F4F6"; // gray-100
  }
  if (status === "completed") {
    ringColor = "#16A34A"; // brand green
  }
  if (engineeringOutcome === "amendment") {
    ringColor = "#FFB005"; // brand gold
  }
  if (engineeringOutcome === "cancellation") {
    ringColor = "#DC2626"; // red
  }

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      {/* Background ring */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={bgColor}
        strokeWidth={strokeWidth}
        className="dark:opacity-30"
      />
      {/* Progress ring */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={ringColor}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700 ease-out"
      />
    </svg>
  );
}

// ─── STEP NODE ────────────────────────────────────────────────
function StepNode({
  stepProgress,
  viewMode,
  isExpanded,
  onToggle,
  onClick,
  isLast,
}: {
  stepProgress: StepProgress;
  viewMode: "client" | "am";
  isExpanded: boolean;
  onToggle: () => void;
  onClick?: () => void;
  isLast: boolean;
}) {
  const { language } = useI18n();
  const fr = language === "fr";
  const { step, status, gateStatus, gateLabel, myTasks, otherTasks, allTasks, engineeringOutcome } = stepProgress;
  const StepIcon = STEP_ICONS[step.stepNum - 1] || Circle;
  const phaseConfig = PHASE_CONFIG[step.phase];
  const isLocked = status === "locked";
  const isCompleted = status === "completed";
  const isActive = status === "active";

  const label = fr ? step.labelFr : step.labelEn;
  const objective = fr ? step.objectiveFr : step.objectiveEn;

  // Get tasks for expanded view
  const role = viewMode === "client" ? "client" : "account_manager";
  const otherRole = viewMode === "client" ? "account_manager" : "client";
  const myTaskDefs = WORKFLOW_TASKS.filter(t => t.stepNum === step.stepNum && t.assignedTo === role);
  const otherTaskDefs = WORKFLOW_TASKS.filter(t => t.stepNum === step.stepNum && t.assignedTo === otherRole);

  // Gate badge
  const renderGateBadge = () => {
    if (isCompleted) {
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-300 text-green-700 dark:border-green-700 dark:text-green-400 gap-1">
          <CheckCircle2 className="w-3 h-3" />
          {fr ? "Complété" : "Complete"}
        </Badge>
      );
    }
    if (engineeringOutcome === "amendment") {
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400 gap-1 animate-pulse">
          <AlertTriangle className="w-3 h-3" />
          {fr ? "Avenant requis" : "Amendment required"}
        </Badge>
      );
    }
    if (engineeringOutcome === "cancellation") {
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-300 text-red-700 dark:border-red-700 dark:text-red-400 gap-1">
          <XCircle className="w-3 h-3" />
          {fr ? "Résiliation" : "Cancelled"}
        </Badge>
      );
    }
    if (isActive && gateStatus === "blocked" && step.isHardBlock) {
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-orange-300 text-orange-700 dark:border-orange-700 dark:text-orange-400 gap-1">
          <Lock className="w-3 h-3" />
          {gateLabel}
        </Badge>
      );
    }
    if (isActive && gateStatus === "passed") {
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-300 text-green-700 dark:border-green-700 dark:text-green-400 gap-1">
          <CheckCircle2 className="w-3 h-3" />
          {fr ? "Gate ✓" : "Gate ✓"}
        </Badge>
      );
    }
    return null;
  };

  return (
    <div className="relative">
      {/* Connector line */}
      {!isLast && (
        <div className="absolute left-5 top-[52px] bottom-0 w-0.5 z-0">
          <div className={`w-full h-full ${
            isCompleted
              ? "bg-gradient-to-b from-green-400 to-green-300 dark:from-green-600 dark:to-green-700"
              : isActive
              ? "bg-gradient-to-b from-blue-400/50 to-gray-200 dark:from-blue-600/50 dark:to-gray-700"
              : "bg-gray-200 dark:bg-gray-700"
          }`} />
        </div>
      )}

      <div className="relative z-10">
        {/* Step header row */}
        <button
          type="button"
          onClick={() => {
            if (!isLocked) {
              if (onClick) onClick();
              onToggle();
            }
          }}
          disabled={isLocked}
          className={`
            w-full text-left flex items-center gap-3 p-2.5 rounded-xl transition-all duration-200
            ${isLocked
              ? "opacity-40 cursor-not-allowed"
              : isActive
              ? `${phaseConfig.bgClass} border-2 border-current/20 shadow-sm hover:shadow-md`
              : isCompleted
              ? "hover:bg-green-50 dark:hover:bg-green-950/30 border border-transparent"
              : "hover:bg-muted/50 border border-transparent"
            }
          `}
        >
          {/* Score ring with icon overlay */}
          <div className="relative">
            <ScoreRing
              percentage={allTasks.percentage}
              color={phaseConfig.color}
              status={status}
              engineeringOutcome={engineeringOutcome}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              {isLocked ? (
                <Lock className="w-4 h-4 text-gray-400" />
              ) : isCompleted ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : (
                <StepIcon className="w-4 h-4" style={{ color: phaseConfig.color }} />
              )}
            </div>
          </div>

          {/* Step info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm truncate">
                {step.stepNum}. {label}
              </span>
              {renderGateBadge()}
            </div>

            {!isLocked && (
              <div className="flex items-center gap-3 mt-1">
                <Progress value={allTasks.percentage} className="h-1.5 flex-1 max-w-[120px]" />
                <span className="text-[11px] font-mono text-muted-foreground">
                  {allTasks.completed}/{allTasks.total}
                </span>
                <span className="flex items-center gap-0.5 text-[11px] font-bold">
                  <Zap className="w-3 h-3 text-yellow-500" />
                  {allTasks.points}/{allTasks.maxPoints}
                </span>
              </div>
            )}
          </div>

          {/* Expand indicator */}
          {!isLocked && (
            <div className="shrink-0">
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          )}
        </button>

        {/* Expanded task list */}
        {isExpanded && !isLocked && (
          <div className="ml-[52px] mt-2 mb-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
            {/* Objective */}
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-xs">
              <Sparkles className="w-4 h-4 text-yellow-500 shrink-0" />
              <span className="text-muted-foreground">{fr ? "Objectif" : "Objective"}: {objective}</span>
            </div>

            {/* My tasks */}
            <div>
              <h4 className="text-xs font-semibold mb-1.5 flex items-center gap-1.5">
                <Flag className="w-3 h-3" />
                {viewMode === "client"
                  ? (fr ? "Vos actions" : "Your actions")
                  : (fr ? "Vos tâches (AM)" : "Your tasks (AM)")}
                <span className="text-muted-foreground font-normal">
                  {myTasks.completed}/{myTasks.total}
                </span>
              </h4>
              <div className="space-y-1">
                {myTaskDefs.map((task, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
                      false /* TODO: check task.completed from API */
                        ? "bg-green-50 dark:bg-green-950/30 line-through text-muted-foreground"
                        : "bg-background border hover:bg-muted/30"
                    }`}
                  >
                    <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 text-xs">
                      {fr ? task.titleFr : task.titleEn}
                      {task.optional && (
                        <span className="text-muted-foreground ml-1">{fr ? "(optionnel)" : "(optional)"}</span>
                      )}
                    </span>
                    <span className="flex items-center gap-0.5 text-xs font-medium">
                      <Zap className="w-3 h-3 text-yellow-500" />
                      {task.points}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Other side's tasks */}
            <div>
              <h4 className="text-xs font-semibold mb-1.5 flex items-center gap-1.5 text-muted-foreground">
                <Eye className="w-3 h-3" />
                {viewMode === "client"
                  ? (fr ? "Côté kWh Québec" : "kWh Québec's side")
                  : (fr ? "Côté client" : "Client's side")}
                <span className="font-normal">
                  {otherTasks.completed}/{otherTasks.total}
                </span>
              </h4>
              <div className="space-y-1">
                {otherTaskDefs.map((task, i) => (
                  <div key={i} className="flex items-center gap-2 p-1.5 rounded text-xs text-muted-foreground">
                    <Circle className="w-3 h-3 shrink-0 opacity-40" />
                    <span className="flex-1">{fr ? task.titleFr : task.titleEn}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────
export function WorkflowStepper({
  steps,
  overallProgress,
  totalPoints,
  maxTotalPoints,
  viewMode = "am",
  activeStepId,
  onStepClick,
  compact = false,
  level = "bronze",
}: {
  steps: StepProgress[];
  overallProgress: number;
  totalPoints: number;
  maxTotalPoints: number;
  viewMode?: "client" | "am";
  activeStepId?: string;
  onStepClick?: (stepId: string, firstTab: string) => void;
  compact?: boolean;
  level?: string;
}) {
  const { language } = useI18n();
  const fr = language === "fr";
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  // Auto-expand the active step
  const activeStep = steps.find(s => s.isCurrent);
  const effectiveExpanded = expandedStep ?? (activeStep?.step.stepNum ?? null);

  // Level display
  const levelConfig: Record<string, { label: string; color: string; icon: string }> = {
    bronze: { label: "Bronze", color: "bg-amber-700 text-white", icon: "🥉" },
    silver: { label: "Silver", color: "bg-gray-400 text-white", icon: "🥈" },
    gold: { label: "Gold", color: "bg-yellow-500 text-white", icon: "🥇" },
    platinum: { label: "Platinum", color: "bg-gradient-to-r from-gray-300 to-gray-100 text-gray-800", icon: "💎" },
  };
  const currentLevel = levelConfig[level] || levelConfig.bronze;

  // Completed count
  const completedSteps = steps.filter(s => s.status === "completed").length;

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {/* Header with overall progress */}
      <div className={`flex items-center gap-3 ${compact ? "p-2" : "p-3"} rounded-xl bg-gradient-to-r from-[#003DA6]/5 to-[#003DA6]/10 border`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-sm">
              {fr ? "Progression du projet" : "Project Progress"}
            </h3>
            <Badge className={`${currentLevel.color} text-[10px] px-1.5 py-0`}>
              {currentLevel.icon} {currentLevel.label}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <Progress value={overallProgress} className="h-2 flex-1" />
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              {completedSteps}/{steps.length} {fr ? "étapes" : "steps"}
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <Zap className="w-3.5 h-3.5 text-yellow-500" />
              <span className="text-xs font-bold">{totalPoints.toLocaleString()}</span>
              <span className="text-[10px] text-muted-foreground">/{maxTotalPoints.toLocaleString()}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Step nodes */}
      <div className="space-y-0.5">
        {steps.map((sp, idx) => (
          <StepNode
            key={sp.step.id}
            stepProgress={sp}
            viewMode={viewMode}
            isExpanded={!compact && effectiveExpanded === sp.step.stepNum}
            onToggle={() => {
              if (compact) return;
              setExpandedStep(
                effectiveExpanded === sp.step.stepNum ? null : sp.step.stepNum
              );
            }}
            onClick={onStepClick ? () => onStepClick(sp.step.id, sp.step.tabs[0]) : undefined}
            isLast={idx === steps.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
