/**
 * WorkflowStepper — Unified 6-step workflow with score rings, gates, and task progress.
 * All steps are always collapsed by default. Click to expand one at a time.
 * Navigation is NEVER blocked — locked steps are dimmed but still clickable (for AM).
 */
import { useState } from "react";
import {
  Search, BarChart3, Compass, HardHat, Hammer, Sun,
  Lock, CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp,
  Zap, Circle, Flag, Eye, Sparkles, ArrowRight,
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
  size = 32,
  strokeWidth = 3,
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

  let ringColor = color;
  let bgColor = "#E5E7EB";
  if (status === "locked") {
    ringColor = "#D1D5DB";
    bgColor = "#F3F4F6";
  }
  if (status === "completed") ringColor = "#16A34A";
  if (engineeringOutcome === "amendment") ringColor = "#FFB005";
  if (engineeringOutcome === "cancellation") ringColor = "#DC2626";

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={center} cy={center} r={radius} fill="none" stroke={bgColor} strokeWidth={strokeWidth} className="dark:opacity-30" />
      <circle cx={center} cy={center} r={radius} fill="none" stroke={ringColor} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        className="transition-all duration-700 ease-out" />
    </svg>
  );
}

// ─── COMPACT STEP (single row, for the collapsed view) ───────
function CompactStepRow({
  stepProgress,
  isSelected,
  onClick,
}: {
  stepProgress: StepProgress;
  isSelected: boolean;
  onClick: () => void;
}) {
  const { step, status, allTasks, engineeringOutcome } = stepProgress;
  const StepIcon = STEP_ICONS[step.stepNum - 1] || Circle;
  const phaseConfig = PHASE_CONFIG[step.phase];
  const isLocked = status === "locked";
  const isCompleted = status === "completed";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all text-left w-full
        ${isSelected
          ? "bg-[#003DA6]/10 ring-1 ring-[#003DA6]/30"
          : isLocked
          ? "opacity-50 hover:opacity-70 hover:bg-muted/30"
          : isCompleted
          ? "hover:bg-green-50 dark:hover:bg-green-950/20"
          : "hover:bg-muted/40"
        }
      `}
    >
      {/* Mini score ring */}
      <div className="relative shrink-0">
        <ScoreRing
          percentage={allTasks.percentage}
          size={28}
          strokeWidth={2.5}
          color={phaseConfig.color}
          status={status}
          engineeringOutcome={engineeringOutcome}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          {isCompleted ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
          ) : isLocked ? (
            <span className="text-[9px] font-bold text-gray-400">{step.stepNum}</span>
          ) : (
            <StepIcon className="w-3 h-3" style={{ color: phaseConfig.color }} />
          )}
        </div>
      </div>

      {/* Label + progress */}
      <div className="flex-1 min-w-0">
        <span className={`text-xs font-medium truncate block ${isLocked ? "text-muted-foreground" : ""}`}>
          {step.stepNum}. {step.labelFr}
        </span>
      </div>

      {/* Score badge */}
      {!isLocked && (
        <span className="flex items-center gap-0.5 text-[10px] font-mono text-muted-foreground shrink-0">
          {allTasks.completed}/{allTasks.total}
        </span>
      )}
    </button>
  );
}

// ─── EXPANDED STEP DETAIL ────────────────────────────────────
function StepDetail({
  stepProgress,
  viewMode,
  onNavigate,
}: {
  stepProgress: StepProgress;
  viewMode: "client" | "am";
  onNavigate?: () => void;
}) {
  const { language } = useI18n();
  const fr = language === "fr";
  const { step, status, gateStatus, gateLabel, myTasks, otherTasks, allTasks, engineeringOutcome } = stepProgress;
  const phaseConfig = PHASE_CONFIG[step.phase];
  const isLocked = status === "locked";
  const isCompleted = status === "completed";
  const isActive = status === "active";

  const objective = fr ? step.objectiveFr : step.objectiveEn;
  const role = viewMode === "client" ? "client" : "account_manager";
  const otherRole = viewMode === "client" ? "account_manager" : "client";
  // Use taskStatuses from auto-detection (not static defs)
  const taskStatuses = stepProgress.taskStatuses ?? [];
  const myTaskStatuses = taskStatuses.filter(ts => ts.task.assignedTo === role);
  const otherTaskStatuses = taskStatuses.filter(ts => ts.task.assignedTo === otherRole);

  // Gate badge
  const gateBadge = (() => {
    if (isCompleted) return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-300 text-green-700 gap-1">
        <CheckCircle2 className="w-3 h-3" /> {fr ? "Complété" : "Complete"}
      </Badge>
    );
    if (engineeringOutcome === "amendment") return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-700 gap-1 animate-pulse">
        <AlertTriangle className="w-3 h-3" /> {fr ? "Avenant requis" : "Amendment required"}
      </Badge>
    );
    if (engineeringOutcome === "cancellation") return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-300 text-red-700 gap-1">
        <XCircle className="w-3 h-3" /> {fr ? "Résiliation" : "Cancelled"}
      </Badge>
    );
    if (isActive && gateStatus === "blocked" && step.isHardBlock) {
      const blockedLabel = fr ? (step.gateBlockedFr || gateLabel) : (step.gateBlockedEn || gateLabel);
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-orange-300 text-orange-700 gap-1">
          <Lock className="w-3 h-3" /> {blockedLabel}
        </Badge>
      );
    }
    if (isActive && gateStatus === "passed") return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-300 text-green-700 gap-1">
        <CheckCircle2 className="w-3 h-3" /> {gateLabel}
      </Badge>
    );
    if (isLocked) return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-gray-300 text-gray-500 gap-1">
        <Lock className="w-3 h-3" /> {fr ? "Pas encore débuté" : "Not started"}
      </Badge>
    );
    return null;
  })();

  return (
    <div className="p-3 rounded-lg border bg-card space-y-3 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ backgroundColor: isLocked ? "#9CA3AF" : phaseConfig.color }}>
            {step.stepNum}
          </div>
          <span className="font-semibold text-sm">{fr ? step.labelFr : step.labelEn}</span>
          {gateBadge}
        </div>
        <div className="flex items-center gap-2">
          <Progress value={allTasks.percentage} className="h-1.5 w-20" />
          <span className="flex items-center gap-0.5 text-[11px] font-bold whitespace-nowrap">
            <Zap className="w-3 h-3 text-yellow-500" />
            {allTasks.points}/{allTasks.maxPoints}
          </span>
        </div>
      </div>

      {/* Objective */}
      <div className="flex items-start gap-2 p-2 rounded-md bg-muted/50 text-xs text-muted-foreground">
        <Sparkles className="w-3.5 h-3.5 text-yellow-500 shrink-0 mt-0.5" />
        <span>{objective}</span>
      </div>

      {/* How to progress hint */}
      {isActive && onNavigate && (
        <button
          type="button"
          onClick={onNavigate}
          className="flex items-center gap-2 w-full p-2 rounded-md bg-[#003DA6]/5 hover:bg-[#003DA6]/10 text-xs text-[#003DA6] font-medium transition-colors"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          {fr
            ? "Complétez les formulaires ci-dessous pour avancer cette étape"
            : "Complete the forms below to advance this step"}
        </button>
      )}

      {/* My tasks */}
      <div>
        <h4 className="text-[11px] font-semibold mb-1 flex items-center gap-1.5 uppercase tracking-wider text-muted-foreground">
          <Flag className="w-3 h-3" />
          {viewMode === "client" ? (fr ? "Vos actions" : "Your actions") : (fr ? "Vos tâches" : "Your tasks")}
          <span className="font-normal">{myTasks.completed}/{myTasks.total}</span>
        </h4>
        <div className="space-y-0.5">
          {myTaskStatuses.map((ts, i) => (
            <div key={i} className={`flex items-center gap-2 py-1 px-2 rounded text-xs ${
              ts.completed
                ? "bg-green-50 dark:bg-green-950/20"
                : "hover:bg-muted/30"
            }`}>
              {ts.completed ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              )}
              <span className={`flex-1 ${ts.completed ? "text-green-700 dark:text-green-400 line-through" : ""}`}>
                {fr ? ts.task.titleFr : ts.task.titleEn}
                {ts.task.optional && <span className="text-muted-foreground ml-1 text-[10px]">({fr ? "opt." : "opt."})</span>}
              </span>
              <span className={`flex items-center gap-0.5 text-[10px] font-medium ${
                ts.completed ? "text-green-600" : "text-muted-foreground"
              }`}>
                <Zap className="w-2.5 h-2.5 text-yellow-500" />{ts.task.points}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Other side */}
      {otherTaskStatuses.length > 0 && (
        <div>
          <h4 className="text-[11px] font-semibold mb-1 flex items-center gap-1.5 uppercase tracking-wider text-muted-foreground/60">
            <Eye className="w-3 h-3" />
            {viewMode === "client" ? (fr ? "Côté kWh Québec" : "kWh Québec") : (fr ? "Côté client" : "Client")}
            <span className="font-normal">{otherTasks.completed}/{otherTasks.total}</span>
          </h4>
          <div className="space-y-0.5">
            {otherTaskStatuses.map((ts, i) => (
              <div key={i} className={`flex items-center gap-1.5 py-0.5 px-2 text-[11px] ${
                ts.completed ? "text-green-600/60" : "text-muted-foreground/60"
              }`}>
                {ts.completed ? (
                  <CheckCircle2 className="w-2.5 h-2.5 shrink-0 text-green-500/50" />
                ) : (
                  <Circle className="w-2.5 h-2.5 shrink-0 opacity-40" />
                )}
                <span className={ts.completed ? "line-through" : ""}>{fr ? ts.task.titleFr : ts.task.titleEn}</span>
              </div>
            ))}
          </div>
        </div>
      )}
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
  // -1 = all collapsed (default), null = nothing explicitly set, number = expanded step
  const [expandedStep, setExpandedStep] = useState<number>(-1);

  const completedSteps = steps.filter(s => s.status === "completed").length;

  // Find which step is selected (highlighted in the list)
  const selectedStepId = activeStepId || steps.find(s => s.isCurrent)?.step.id;
  const selectedStep = steps.find(s => s.step.id === selectedStepId) || steps.find(s => s.isCurrent);

  // Level display
  const levelConfig: Record<string, { label: string; color: string }> = {
    bronze: { label: "Bronze", color: "bg-amber-700 text-white" },
    silver: { label: "Silver", color: "bg-gray-400 text-white" },
    gold: { label: "Gold", color: "bg-yellow-500 text-white" },
    platinum: { label: "Platinum", color: "bg-gradient-to-r from-gray-300 to-gray-100 text-gray-800" },
  };
  const currentLevel = levelConfig[level] || levelConfig.bronze;

  const handleStepClick = (sp: StepProgress) => {
    // Always allow navigation (even for locked steps in AM mode)
    if (onStepClick) {
      onStepClick(sp.step.id, sp.step.tabs[0]);
    }
    // Toggle expand: if already expanded, collapse; otherwise expand this one
    setExpandedStep(prev => prev === sp.step.stepNum ? -1 : sp.step.stepNum);
  };

  // ── Compact mode (client-portal) — just show mini steps, no expand ──
  if (compact) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 px-1">
          <h3 className="text-xs font-semibold text-muted-foreground">{fr ? "Progression" : "Progress"}</h3>
          <Progress value={overallProgress} className="h-1.5 flex-1 max-w-[100px]" />
          <span className="text-[10px] font-mono text-muted-foreground">{completedSteps}/{steps.length}</span>
        </div>
        {steps.map(sp => (
          <CompactStepRow
            key={sp.step.id}
            stepProgress={sp}
            isSelected={sp.step.id === selectedStepId}
            onClick={() => onStepClick?.(sp.step.id, sp.step.tabs[0])}
          />
        ))}
      </div>
    );
  }

  // ── Full mode (site-detail) — step list + expand panel ──
  return (
    <div className="space-y-2">
      {/* Header bar with overall progress */}
      <div className="flex items-center gap-3 p-2.5 rounded-lg bg-gradient-to-r from-[#003DA6]/5 to-[#003DA6]/10 border">
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <h3 className="font-semibold text-sm whitespace-nowrap">
            {fr ? "Projet" : "Project"}
          </h3>
          <Progress value={overallProgress} className="h-2 flex-1 max-w-[200px]" />
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {completedSteps}/{steps.length} {fr ? "étapes" : "steps"}
          </span>
          <span className="flex items-center gap-0.5 whitespace-nowrap">
            <Zap className="w-3.5 h-3.5 text-yellow-500" />
            <span className="text-xs font-bold">{totalPoints.toLocaleString()}</span>
            <span className="text-[10px] text-muted-foreground">/ {maxTotalPoints.toLocaleString()}</span>
          </span>
          <Badge className={`${currentLevel.color} text-[10px] px-1.5 py-0 shrink-0`}>
            {currentLevel.label}
          </Badge>
        </div>
      </div>

      {/* Step list — all collapsed by default, one expandable at a time */}
      <div className="grid grid-cols-6 gap-1">
        {steps.map(sp => {
          const StepIcon = STEP_ICONS[sp.step.stepNum - 1] || Circle;
          const phaseConfig = PHASE_CONFIG[sp.step.phase];
          const isLocked = sp.status === "locked";
          const isCompleted = sp.status === "completed";
          const isThisSelected = sp.step.id === selectedStepId;
          const isThisExpanded = expandedStep === sp.step.stepNum;

          return (
            <button
              key={sp.step.id}
              type="button"
              onClick={() => handleStepClick(sp)}
              className={`
                relative flex flex-col items-center gap-1 p-2 rounded-lg transition-all text-center
                ${isThisSelected
                  ? "bg-[#003DA6]/10 ring-2 ring-[#003DA6]/30"
                  : isLocked
                  ? "opacity-40 hover:opacity-60 hover:bg-muted/20"
                  : isCompleted
                  ? "hover:bg-green-50 dark:hover:bg-green-950/20"
                  : "hover:bg-muted/30"
                }
              `}
            >
              {/* Score ring + icon */}
              <div className="relative">
                <ScoreRing
                  percentage={sp.allTasks.percentage}
                  color={phaseConfig.color}
                  status={sp.status}
                  engineeringOutcome={sp.engineeringOutcome}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : isLocked ? (
                    <Lock className="w-3 h-3 text-gray-400" />
                  ) : (
                    <StepIcon className="w-3.5 h-3.5" style={{ color: phaseConfig.color }} />
                  )}
                </div>
              </div>

              {/* Label */}
              <span className={`text-[10px] leading-tight font-medium line-clamp-2 ${isLocked ? "text-muted-foreground" : ""}`}>
                {sp.step.labelFr}
              </span>

              {/* Mini progress */}
              {!isLocked && (
                <span className="text-[9px] font-mono text-muted-foreground">
                  {sp.allTasks.completed}/{sp.allTasks.total}
                </span>
              )}

              {/* Expand indicator */}
              {isThisExpanded && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-card border border-border rotate-45 z-10" />
              )}
            </button>
          );
        })}
      </div>

      {/* Expanded detail panel (below the grid) */}
      {expandedStep > 0 && (() => {
        const sp = steps.find(s => s.step.stepNum === expandedStep);
        if (!sp) return null;
        return (
          <StepDetail
            stepProgress={sp}
            viewMode={viewMode}
            onNavigate={onStepClick ? () => onStepClick(sp.step.id, sp.step.tabs[0]) : undefined}
          />
        );
      })()}
    </div>
  );
}
