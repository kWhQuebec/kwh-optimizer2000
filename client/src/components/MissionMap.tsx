import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import {
  Zap,
  Lock,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  Star,
  Trophy,
  Map,
  Flag,
  Sparkles,
  Eye,
  EyeOff,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// ─── TYPES ───────────────────────────────────────────────────
interface MissionTask {
  id?: number;
  title: string;
  points: number;
  completed?: boolean;
  completedAt?: string;
  assignedTo: "client" | "account_manager";
}

interface Mission {
  id?: number;
  missionNumber: number;
  title: string;
  stage: string;
  pointsReward: number;
  status: "locked" | "active" | "completed";
  tasks: MissionTask[];
  completedAt?: string;
}

interface MissionMapProps {
  opportunityId?: number | string;
  currentStage?: string;
  /** "client" = portail client, "am" = côté account manager */
  viewMode: "client" | "am";
  /** Points totaux accumulés */
  totalPoints?: number;
  /** Niveau actuel */
  level?: string;
  /** Compact mode for embedding in small spaces */
  compact?: boolean;
}

// ─── STAGE ORDER ─────────────────────────────────────────────
const STAGE_ORDER = [
  "prospect",
  "contacted",
  "qualified",
  "analysis_done",
  "design_mandate_signed",
  "epc_proposal_sent",
  "negotiation",
  "won_to_be_delivered",
  "won_in_construction",
  "won_delivered",
];

const MISSION_STAGE_MAP: Record<string, number> = {
  qualified: 1,
  design_mandate_signed: 2,
  epc_proposal_sent: 3,
  won_to_be_delivered: 4,
  won_in_construction: 5,
  won_delivered: 6,
};

// Mission metadata (icons, descriptions, colors)
const MISSION_META: Record<number, {
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  descFr: string;
  descEn: string;
  unlockFr: string;
  unlockEn: string;
}> = {
  1: {
    icon: "🔍",
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-50 dark:bg-gray-950",
    borderColor: "border-gray-300 dark:border-gray-700",
    descFr: "Calcul basé sur votre facture Hydro-Québec — résultats instantanés",
    descEn: "Calculation based on your Hydro-Québec bill — instant results",
    unlockFr: "Débloque : Estimation des économies et du retour sur investissement",
    unlockEn: "Unlocks: Savings and ROI estimate",
  },
  2: {
    icon: "📊",
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-50 dark:bg-gray-950",
    borderColor: "border-gray-300 dark:border-gray-700",
    descFr: "Analyse du profil énergétique et rapport détaillé des impacts",
    descEn: "Energy profile analysis and detailed impact report",
    unlockFr: "Débloque : Rapport financier et environnemental complet (PDF, PPT, portail)",
    unlockEn: "Unlocks: Complete financial and environmental report (PDF, PPT, portal)",
  },
  3: {
    icon: "📐",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950",
    borderColor: "border-blue-200 dark:border-blue-800",
    descFr: "Visite de site, inspection du toit et conception détaillée du système",
    descEn: "Site visit, roof inspection and detailed system design",
    unlockFr: "Débloque : Soumission forfaitaire et prix garantis",
    unlockEn: "Unlocks: Fixed-price quote with guaranteed pricing",
  },
  4: {
    icon: "🏗️",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950",
    borderColor: "border-amber-200 dark:border-amber-800",
    descFr: "Plans d'ingénierie structurelle et électrique pour construction",
    descEn: "Structural and electrical engineering plans for construction",
    unlockFr: "Débloque : Dossier complet pour financement et incitatifs",
    unlockEn: "Unlocks: Complete file for financing and incentives",
  },
  5: {
    icon: "⚡",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950",
    borderColor: "border-amber-200 dark:border-amber-800",
    descFr: "Permis, installation par techniciens certifiés et mise en service",
    descEn: "Permits, installation by certified technicians and commissioning",
    unlockFr: "Débloque : Monitoring en temps réel et garanties",
    unlockEn: "Unlocks: Real-time monitoring and warranties",
  },
  6: {
    icon: "🌟",
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-950",
    borderColor: "border-green-200 dark:border-green-800",
    descFr: "Votre système produit — suivez la performance et devenez ambassadeur",
    descEn: "Your system is producing — track performance and become an ambassador",
    unlockFr: "Débloque : Dashboard production + Programme de référencement",
    unlockEn: "Unlocks: Production dashboard + Referral program",
  },
};

// ─── HELPER: derive missions from current stage ──────────────
function deriveMissionsFromStage(currentStage: string): Mission[] {
  const stageIdx = STAGE_ORDER.indexOf(currentStage);

  // Pre-defined mission templates (matching gamificationEngine.ts)
  const templates = [
    { num: 1, title: "Analyse rapide du potentiel", titleEn: "Quick Potential Analysis", stage: "qualified", points: 250,
      clientTasks: ["Uploader sa facture Hydro-Québec", "Confirmer son type de propriété", "Consulter sa simulation", "Booker un appel découverte"],
      clientPts: [50, 25, 25, 50],
      amTasks: ["Valider le parsing AI de la facture", "Qualifier le lead (4 portes)", "Préparer l'analyse", "Compléter l'appel dans les 48h"],
      amPts: [25, 50, 25, 50],
    },
    { num: 2, title: "Validation économique", titleEn: "Economic Validation", stage: "design_mandate_signed", points: 750,
      clientTasks: ["Lire la proposition préliminaire", "Poser au moins 1 question", "Signer la procuration HQ", "Payer le mandat"],
      clientPts: [50, 50, 100, 200],
      amTasks: ["Envoyer la proposition < 3 jours", "Répondre aux questions < 24h", "Soumettre procuration à HQ", "Confirmer réception"],
      amPts: [100, 50, 50, 50],
    },
    { num: 3, title: "Validation technique", titleEn: "Technical Validation", stage: "epc_proposal_sent", points: 500,
      clientTasks: ["Donner accès au site", "Fournir plans de toiture", "Consulter le rapport VC0", "Valider les hypothèses"],
      clientPts: [50, 50, 50, 50],
      amTasks: ["Coordonner visite Rematek", "Suivre la progression VC0", "Importer VC0 plateforme", "Calibrer CashflowEngine"],
      amPts: [50, 50, 50, 50],
    },
    { num: 4, title: "Ingénierie, plans & devis", titleEn: "Engineering, Plans & Quotes", stage: "won_to_be_delivered", points: 1000,
      clientTasks: ["Recevoir la proposition EPC", "Comparer les scénarios", "Finaliser la négociation", "Signer le contrat EPC"],
      clientPts: [50, 100, 100, 250],
      amTasks: ["Générer proposition 3 scénarios", "Présenter en meeting", "Adresser objections < 24h", "Obtenir signature + paiement"],
      amPts: [100, 50, 100, 250],
    },
    { num: 5, title: "Permis & installation clé en main", titleEn: "Permits & Turnkey Installation", stage: "won_in_construction", points: 2000,
      clientTasks: ["Confirmer dates d'accès", "Valider checklist pré-installation", "Consulter photos quotidiennes", "Être présent inspection", "Activer compte monitoring"],
      clientPts: [100, 100, 100, 100, 100],
      amTasks: ["Commander matériel", "Valider réception matériel", "Upload photos + daily log", "Compléter inspection", "Configurer monitoring"],
      amPts: [100, 100, 100, 100, 100],
    },
    { num: 6, title: "Monitoring & performance", titleEn: "Monitoring & Performance", stage: "won_delivered", points: 2000,
      clientTasks: ["Consulter dashboard production", "Partager résultats LinkedIn", "Référer 1 contact", "Évaluer l'expérience kWh"],
      clientPts: [100, 200, 500, 100],
      amTasks: ["Envoyer rapport 90 jours", "Demander le témoignage", "Qualifier la référence < 48h", "Documenter le cas portfolio"],
      amPts: [200, 100, 200, 200],
    },
  ];

  return templates.map((t) => {
    const missionStageIdx = STAGE_ORDER.indexOf(t.stage);
    let status: "locked" | "active" | "completed";
    if (stageIdx > missionStageIdx) {
      status = "completed";
    } else if (stageIdx >= missionStageIdx - 1) {
      // Active if we're at or just before this mission's stage
      status = "active";
    } else {
      status = "locked";
    }

    const tasks: MissionTask[] = [
      ...t.clientTasks.map((title, i) => ({
        title,
        points: t.clientPts[i],
        assignedTo: "client" as const,
        completed: status === "completed",
      })),
      ...t.amTasks.map((title, i) => ({
        title,
        points: t.amPts[i],
        assignedTo: "account_manager" as const,
        completed: status === "completed",
      })),
    ];

    return {
      missionNumber: t.num,
      title: t.title,
      stage: t.stage,
      pointsReward: t.points,
      status,
      tasks,
    };
  });
}

// ─── MISSION NODE COMPONENT ─────────────────────────────────
function MissionNode({
  mission,
  viewMode,
  language,
  isExpanded,
  onToggle,
  isLast,
}: {
  mission: Mission;
  viewMode: "client" | "am";
  language: string;
  isExpanded: boolean;
  onToggle: () => void;
  isLast: boolean;
}) {
  const meta = MISSION_META[mission.missionNumber];
  const isLocked = mission.status === "locked";
  const isActive = mission.status === "active";
  const isCompleted = mission.status === "completed";

  // Filter tasks based on view mode
  const myTasks = mission.tasks.filter((t) =>
    viewMode === "client" ? t.assignedTo === "client" : t.assignedTo === "account_manager"
  );
  const otherTasks = mission.tasks.filter((t) =>
    viewMode === "client" ? t.assignedTo === "account_manager" : t.assignedTo === "client"
  );

  const completedTasks = mission.tasks.filter((t) => t.completed).length;
  const totalTasks = mission.tasks.length;
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const myCompletedTasks = myTasks.filter((t) => t.completed).length;
  const otherCompletedTasks = otherTasks.filter((t) => t.completed).length;

  return (
    <div className="relative">
      {/* Connector line to next mission */}
      {!isLast && (
        <div className="absolute left-6 top-14 bottom-0 w-0.5 z-0">
          <div
            className={`w-full h-full ${
              isCompleted
                ? "bg-gradient-to-b from-green-400 to-green-300 dark:from-green-600 dark:to-green-700"
                : isActive
                ? "bg-gradient-to-b from-blue-400 to-gray-200 dark:from-blue-600 dark:to-gray-700"
                : "bg-gray-200 dark:bg-gray-700 border-dashed border-l-2 border-gray-300 dark:border-gray-600 w-0"
            }`}
          />
        </div>
      )}

      <div className="relative z-10">
        {/* Mission header - always visible */}
        <button
          onClick={isLocked ? undefined : onToggle}
          disabled={isLocked}
          className={`w-full text-left flex items-start gap-3 p-3 rounded-xl transition-all duration-300 ${
            isLocked
              ? "opacity-50 cursor-not-allowed"
              : isActive
              ? `${meta.bgColor} border-2 ${meta.borderColor} shadow-md hover:shadow-lg`
              : isCompleted
              ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-950/50"
              : "hover:bg-muted/50 border border-transparent"
          }`}
        >
          {/* Mission icon circle */}
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-xl ${
              isLocked
                ? "bg-gray-100 dark:bg-gray-800"
                : isCompleted
                ? "bg-green-100 dark:bg-green-900"
                : isActive
                ? `${meta.bgColor} ring-2 ring-offset-2 ring-offset-background ${meta.borderColor.replace("border", "ring")}`
                : "bg-muted"
            }`}
          >
            {isLocked ? (
              <Lock className="w-5 h-5 text-gray-400" />
            ) : isCompleted ? (
              <CheckCircle2 className="w-6 h-6 text-green-500" />
            ) : (
              <span>{meta.icon}</span>
            )}
          </div>

          {/* Mission info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`text-xs font-bold uppercase tracking-wider ${isLocked ? "text-muted-foreground" : meta.color}`}>
                Mission {mission.missionNumber}
              </span>
              {isActive && (
                <Badge className="bg-blue-500 text-white text-[10px] px-1.5 py-0 animate-pulse">
                  {language === "fr" ? "EN COURS" : "ACTIVE"}
                </Badge>
              )}
              {isCompleted && (
                <Badge className="bg-green-500 text-white text-[10px] px-1.5 py-0">
                  ✓
                </Badge>
              )}
            </div>

            <h3 className={`font-semibold text-sm ${isLocked ? "text-muted-foreground" : ""}`}>
              {isLocked ? "???" : mission.title}
            </h3>

            {!isLocked && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {language === "fr" ? meta.descFr : meta.descEn}
              </p>
            )}

            {/* Progress bar for active/completed */}
            {!isLocked && (
              <div className="mt-2 flex items-center gap-2">
                <Progress value={progressPct} className="h-1.5 flex-1" />
                <span className="text-xs font-mono text-muted-foreground">
                  {completedTasks}/{totalTasks}
                </span>
                <div className="flex items-center gap-0.5">
                  <Zap className="w-3 h-3 text-yellow-500" />
                  <span className="text-xs font-bold">{mission.pointsReward}</span>
                </div>
              </div>
            )}

            {/* Fog of war message for locked */}
            {isLocked && (
              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                <EyeOff className="w-3 h-3" />
                <span>{language === "fr" ? "Complétez la mission précédente pour débloquer" : "Complete the previous mission to unlock"}</span>
              </div>
            )}
          </div>

          {/* Expand/collapse indicator */}
          {!isLocked && (
            <div className="shrink-0 mt-1">
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
          <div className="ml-[3.75rem] mt-2 mb-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
            {/* Unlock reward */}
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-xs">
              <Sparkles className="w-4 h-4 text-yellow-500 shrink-0" />
              <span className="text-muted-foreground">
                {language === "fr" ? meta.unlockFr : meta.unlockEn}
              </span>
            </div>

            {/* My tasks */}
            <div>
              <h4 className="text-xs font-semibold mb-1.5 flex items-center gap-1.5">
                <Flag className="w-3 h-3" />
                {viewMode === "client"
                  ? (language === "fr" ? "Vos missions" : "Your missions")
                  : (language === "fr" ? "Vos tâches (AM)" : "Your tasks (AM)")}
                <span className="text-muted-foreground font-normal">
                  {myCompletedTasks}/{myTasks.length}
                </span>
              </h4>
              <div className="space-y-1">
                {myTasks.map((task, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 p-2 rounded-lg text-sm transition-colors ${
                      task.completed
                        ? "bg-green-50 dark:bg-green-950/30 line-through text-muted-foreground"
                        : "bg-background border hover:bg-muted/30"
                    }`}
                  >
                    {task.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="flex-1 text-xs">{task.title}</span>
                    <span className="flex items-center gap-0.5 text-xs font-medium">
                      <Zap className="w-3 h-3 text-yellow-500" />
                      {task.points}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Other side's tasks (visible but from their perspective) */}
            <div>
              <h4 className="text-xs font-semibold mb-1.5 flex items-center gap-1.5 text-muted-foreground">
                <Eye className="w-3 h-3" />
                {viewMode === "client"
                  ? (language === "fr" ? "Côté kWh Québec" : "kWh Québec's side")
                  : (language === "fr" ? "Côté client" : "Client's side")}
                <span className="font-normal">
                  {otherCompletedTasks}/{otherTasks.length}
                </span>
              </h4>
              <div className="space-y-1">
                {otherTasks.map((task, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 p-1.5 rounded text-xs ${
                      task.completed
                        ? "text-green-600 dark:text-green-400"
                        : "text-muted-foreground"
                    }`}
                  >
                    {task.completed ? (
                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                    ) : (
                      <Circle className="w-3 h-3 shrink-0 opacity-40" />
                    )}
                    <span className="flex-1">{task.title}</span>
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

// ─── MAIN MISSION MAP COMPONENT ──────────────────────────────
export function MissionMap({
  opportunityId,
  currentStage = "prospect",
  viewMode,
  totalPoints = 0,
  level = "bronze",
  compact = false,
}: MissionMapProps) {
  const { language } = useI18n();
  const [expandedMission, setExpandedMission] = useState<number | null>(null);

  // Try to fetch real missions from API, fallback to derived
  const { data: apiMissions } = useQuery({
    queryKey: ["gamification", "missions", opportunityId],
    queryFn: async () => {
      if (!opportunityId) return null;
      const res = await fetch(`/api/gamification/missions/${opportunityId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!opportunityId,
  });

  // Derive missions from current stage (fallback when API has no data)
  const missions = apiMissions?.length > 0
    ? apiMissions
    : deriveMissionsFromStage(currentStage);

  // Auto-expand the active mission
  const activeMission = missions.find((m: Mission) => m.status === "active");
  const effectiveExpanded = expandedMission ?? activeMission?.missionNumber ?? null;

  // Calculate overall progress
  const completedMissions = missions.filter((m: Mission) => m.status === "completed").length;
  const overallProgress = Math.round((completedMissions / missions.length) * 100);

  // Level display
  const levelConfig: Record<string, { label: string; color: string; icon: string }> = {
    bronze: { label: "Bronze", color: "bg-amber-700 text-white", icon: "🥉" },
    silver: { label: "Silver", color: "bg-gray-400 text-white", icon: "🥈" },
    gold: { label: "Gold", color: "bg-yellow-500 text-white", icon: "🥇" },
    platinum: { label: "Platinum", color: "bg-gradient-to-r from-gray-300 to-gray-100 text-gray-800", icon: "💎" },
  };
  const currentLevel = levelConfig[level] || levelConfig.bronze;

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {/* Header with progress overview */}
      <div className={`flex items-center gap-3 ${compact ? "p-2" : "p-3"} rounded-xl bg-gradient-to-r from-primary/5 to-primary/10 border`}>
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
          <Map className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">
              {language === "fr" ? "Votre aventure solaire" : "Your Solar Adventure"}
            </h3>
            <Badge className={currentLevel.color}>
              {currentLevel.icon} {currentLevel.label}
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex-1">
              <Progress value={overallProgress} className="h-2" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {completedMissions}/{missions.length} missions
            </span>
            <div className="flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-yellow-500" />
              <span className="text-xs font-bold">{totalPoints.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mission nodes */}
      <div className="space-y-1 pl-0">
        {missions.map((mission: Mission, idx: number) => (
          <MissionNode
            key={mission.missionNumber}
            mission={mission}
            viewMode={viewMode}
            language={language}
            isExpanded={effectiveExpanded === mission.missionNumber}
            onToggle={() =>
              setExpandedMission(
                effectiveExpanded === mission.missionNumber ? null : mission.missionNumber
              )
            }
            isLast={idx === missions.length - 1}
          />
        ))}
      </div>

      {/* Victory state */}
      {overallProgress === 100 && (
        <div className="text-center p-4 rounded-xl bg-gradient-to-r from-yellow-50 to-green-50 dark:from-yellow-950/30 dark:to-green-950/30 border border-yellow-200 dark:border-yellow-800">
          <Trophy className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
          <p className="font-bold text-sm">
            {language === "fr" ? "Aventure complétée ! 🎉" : "Adventure Complete! 🎉"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {language === "fr"
              ? "Votre système solaire produit de l'énergie propre. Bienvenue dans la communauté kWh !"
              : "Your solar system is producing clean energy. Welcome to the kWh community!"}
          </p>
        </div>
      )}
    </div>
  );
}
