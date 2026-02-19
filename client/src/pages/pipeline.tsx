import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Target,
  Plus,
  Building2,
  DollarSign,
  Calendar,
  User,
  ChevronRight,
  Filter,
  X,
  TrendingUp,
  Trophy,
  HelpCircle,
  LayoutGrid,
  List,
  Flame,
  Snowflake,
  Clock as ClockIcon,
  Loader2,
  Trash2,
  Phone,
  TrendingDown
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Opportunity, User as UserType, Client, Site, Lead } from "@shared/schema";
import { QualificationForm } from "@/components/qualification";
import { NurtureStatusPanel } from "@/components/nurture-status-panel";
import { MissionMap } from "@/components/MissionMap";

const CallScriptWizard = lazy(() => import("@/components/qualification/call-script-wizard"));

// Format currency in a compact, readable way (e.g., "$128M", "$1.5M", "$250k")
function formatCompactCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return "$0";
  if (value >= 1000000) {
    const millions = value / 1000000;
    return millions >= 10 ? `$${Math.round(millions)}M` : `$${millions.toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${Math.round(value / 1000)}k`;
  }
  return `$${Math.round(value)}`;
}

const STAGES = ["prospect", "contacted", "qualified", "analysis_done", "design_mandate_signed", "epc_proposal_sent", "negotiation", "won_to_be_delivered", "won_in_construction", "won_delivered", "lost", "disqualified"] as const;
type Stage = typeof STAGES[number];

const STAGE_LABELS: Record<string, { fr: string; en: string }> = {
  prospect: { fr: "Prospect (5%)", en: "Prospect (5%)" },
  contacted: { fr: "Contacté (10%)", en: "Contacted (10%)" },
  qualified: { fr: "Qualifié (20%)", en: "Qualified (20%)" },
  analysis_done: { fr: "Analyse détaillée réalisée (25%)", en: "Detailed Analysis Done (25%)" },
  design_mandate_signed: { fr: "Mandat de conception signé (50%)", en: "Design Mandate Signed (50%)" },
  epc_proposal_sent: { fr: "Proposition EPC envoyée (75%)", en: "EPC Proposal Sent (75%)" },
  negotiation: { fr: "Négociation (90%)", en: "Negotiation (90%)" },
  won_to_be_delivered: { fr: "Gagné - À livrer (100%)", en: "Won - To be Delivered (100%)" },
  won_in_construction: { fr: "Gagné - En construction (100%)", en: "Won - In Construction (100%)" },
  won_delivered: { fr: "Gagné - Livré (100%)", en: "Won - Delivered (100%)" },
  lost: { fr: "Perdu (0%)", en: "Lost (0%)" },
  disqualified: { fr: "Non qualifié (0%)", en: "Disqualified (0%)" },
};

const STAGE_SHORT_LABELS: Record<string, { fr: string; en: string }> = {
  prospect: { fr: "Prospect", en: "Prospect" },
  contacted: { fr: "Contacté", en: "Contacted" },
  qualified: { fr: "Qualifié", en: "Qualified" },
  analysis_done: { fr: "Analyse", en: "Analysis" },
  design_mandate_signed: { fr: "Mandat signé", en: "Mandate Signed" },
  epc_proposal_sent: { fr: "Prop. EPC", en: "EPC Prop." },
  negotiation: { fr: "Négociation", en: "Negotiation" },
  won_to_be_delivered: { fr: "Gagné - À livrer", en: "Won - To Deliver" },
  won_in_construction: { fr: "En construction", en: "In Construction" },
  won_delivered: { fr: "Livré", en: "Delivered" },
  lost: { fr: "Perdu", en: "Lost" },
  disqualified: { fr: "Non qualifié", en: "Disqualified" },
};

const STAGE_DESCRIPTIONS: Record<string, { fr: string; en: string }> = {
  prospect: { 
    fr: "Nouveau lead entrant ou identifié, pas encore contacté", 
    en: "New incoming or identified lead, not yet contacted" 
  },
  contacted: { 
    fr: "Premier contact réalisé, en cours d'évaluation et collecte d'informations", 
    en: "First contact made, evaluating and gathering information" 
  },
  qualified: { 
    fr: "Lead vert — projet solaire viable confirmé, toutes les infos de qualification obtenues", 
    en: "Green lead — viable solar project confirmed, all qualification info obtained" 
  },
  analysis_done: { 
    fr: "Analyse détaillée de consommation et simulation solaire complétée", 
    en: "Detailed consumption analysis and solar simulation completed" 
  },
  design_mandate_signed: {
    fr: "Client a signé le mandat de conception préliminaire",
    en: "Client signed the preliminary design mandate"
  },
  epc_proposal_sent: {
    fr: "Proposition EPC complète soumise au client",
    en: "Complete EPC proposal submitted to client"
  },
  negotiation: { 
    fr: "Négociation finale du contrat de construction", 
    en: "Final construction contract negotiation" 
  },
  won_to_be_delivered: { 
    fr: "Contrat signé – en attente de démarrage de la construction", 
    en: "Contract signed – awaiting construction start" 
  },
  won_in_construction: { 
    fr: "Construction en cours sur le site", 
    en: "Construction in progress on site" 
  },
  won_delivered: { 
    fr: "Projet complété et livré au client", 
    en: "Project completed and delivered to client" 
  },
  lost: { 
    fr: "Opportunité fermée sans succès", 
    en: "Opportunity closed without success" 
  },
  disqualified: { 
    fr: "Lead non qualifié – ne correspond pas aux critères (test, doublon, hors cible)", 
    en: "Disqualified lead – does not meet criteria (test, duplicate, out of scope)" 
  },
};

const STAGE_PROBABILITIES: Record<Stage, number> = {
  prospect: 5,
  contacted: 10,
  qualified: 20,
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

// Helper to check if a stage is a "won" stage
const WON_STAGES = ["won_to_be_delivered", "won_in_construction", "won_delivered"] as const;
const isWonStage = (stage: string) => WON_STAGES.includes(stage as any);

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  urgent: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const PRIORITY_LABELS: Record<string, { fr: string; en: string }> = {
  low: { fr: "Basse", en: "Low" },
  medium: { fr: "Moyenne", en: "Medium" },
  high: { fr: "Haute", en: "High" },
  urgent: { fr: "Urgente", en: "Urgent" },
};

type ViewMode = "kanban" | "list";
const VIEW_STORAGE_KEY = "pipeline-view-preference";

const SOURCE_OPTIONS = ["web_form", "referral", "cold_call", "event", "other"] as const;

interface RfpBreakdown {
  eligibleSites: number;
  eligibleCapex: number;
  eligiblePvKW: number;
  nonEligibleSites: number;
  nonEligibleCapex: number;
  nonEligiblePvKW: number;
  totalSites: number;
}

interface OpportunityWithRelations extends Opportunity {
  owner?: UserType | null;
  client?: Client | null;
  site?: Site | null;
  rfpBreakdown?: RfpBreakdown;
  lead?: Lead | null;
}

// Extended opportunity type for display (includes virtual split opportunities)
interface DisplayOpportunity extends OpportunityWithRelations {
  isVirtualSplit?: boolean;
  splitType?: 'rfp' | 'non-rfp';
  displayName?: string;
  displayValue?: number;
  displaySiteCount?: number;
  parentOpportunityId?: string;
}

const opportunityFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  stage: z.string().default("prospect"),
  estimatedValue: z.coerce.number().optional(),
  pvSizeKW: z.coerce.number().optional(),
  expectedCloseDate: z.string().optional(),
  priority: z.string().default("medium"),
  source: z.string().optional(),
  clientId: z.string().optional(),
  siteId: z.string().optional(),
  // Inline client creation fields
  newClientName: z.string().optional(),
  newClientEmail: z.string().email().optional().or(z.literal("")),
  newClientPhone: z.string().optional(),
  // Inline site creation fields
  newSiteName: z.string().optional(),
  newSiteAddress: z.string().optional(),
  newSiteCity: z.string().optional(),
  newSiteProvince: z.string().optional(),
});

type OpportunityFormValues = z.infer<typeof opportunityFormSchema>;

const CREATE_NEW_CLIENT_VALUE = "__create_new__";
const CREATE_NEW_SITE_VALUE = "__create_new_site__";

function OpportunityCard({ 
  opportunity, 
  onStageChange, 
  onDelete,
  onClick 
}: { 
  opportunity: DisplayOpportunity; 
  onStageChange: (id: string, stage: Stage) => void;
  onDelete: (id: string) => void;
  onClick: () => void;
}) {
  const { language } = useI18n();
  const currentStageIndex = STAGES.indexOf(opportunity.stage as Stage);
  const TERMINAL_STAGES = ["lost", "disqualified"] as const;
  const isTerminalStage = (s: string) => (TERMINAL_STAGES as readonly string[]).includes(s);
  const activeStages = STAGES.filter(s => !isTerminalStage(s));
  const activeIndex = activeStages.indexOf(opportunity.stage as any);
  const canMoveForward = activeIndex >= 0 && activeIndex < activeStages.length - 1 && !isWonStage(opportunity.stage);
  const canMoveBack = currentStageIndex > 0 && !isWonStage(opportunity.stage) && !isTerminalStage(opportunity.stage);
  
  // For virtual split opportunities, use display values; otherwise use original values
  const displayName = opportunity.displayName || opportunity.name;
  const displayValue = opportunity.displayValue ?? opportunity.estimatedValue;
  const realOpportunityId = opportunity.parentOpportunityId || opportunity.id;
  
  // Visual indicator for RFP split type
  const splitBadge = opportunity.isVirtualSplit && opportunity.splitType === 'rfp' 
    ? { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300", label: "RFP Hydro-Québec" }
    : opportunity.isVirtualSplit && opportunity.splitType === 'non-rfp'
    ? { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", label: "Hors RFP" }
    : null;

  return (
    <Card 
      className="hover-elevate cursor-pointer mb-3"
      onClick={onClick}
      data-testid={`card-opportunity-${opportunity.id}`}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-1">
              <h4 className="font-medium text-sm leading-tight line-clamp-2">{displayName}</h4>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="shrink-0 rounded-full mt-1"
                  style={{
                    width: "10px",
                    height: "10px",
                    backgroundColor:
                      (opportunity.lead as any)?.leadColor === "green" ? "#16A34A" :
                      (opportunity.lead as any)?.leadColor === "yellow" ? "#EAB308" :
                      (opportunity.lead as any)?.leadColor === "red" ? "#DC2626" :
                      "#D1D5DB",
                  }}
                  data-testid={`indicator-lead-color-${opportunity.id}`}
                />
              </TooltipTrigger>
              <TooltipContent>
                {(opportunity.lead as any)?.leadColorReason || (
                  (opportunity.lead as any)?.leadColor === "green" ? (language === "fr" ? "Qualifié — viable" : "Qualified - good to go") :
                  (opportunity.lead as any)?.leadColor === "yellow" ? (language === "fr" ? "Info manquante — à explorer" : "Missing info - needs nurture") :
                  (opportunity.lead as any)?.leadColor === "red" ? (language === "fr" ? "Non qualifié" : "Not qualified") :
                  (language === "fr" ? "Non classifié" : "Not yet classified")
                )}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* RFP Split Type Badge */}
          {splitBadge && (
            <Badge className={`text-xs ${splitBadge.bg} ${splitBadge.text}`}>
              {splitBadge.label}
            </Badge>
          )}

          {opportunity.client && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 className="w-3 h-3" />
              <span className="truncate">{opportunity.client.name}</span>
            </div>
          )}

          {displayValue && displayValue > 0 && (
            <div className="flex items-center gap-1.5 text-sm font-medium text-primary">
              <DollarSign className="w-3.5 h-3.5" />
              <span>{formatCompactCurrency(displayValue)}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            {opportunity.expectedCloseDate && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{format(new Date(opportunity.expectedCloseDate), "MMM d, yyyy")}</span>
              </div>
            )}
            {opportunity.owner && (
              <div className="flex items-center gap-1">
                <User className="w-3 h-3" />
                <span className="truncate max-w-[80px]">{opportunity.owner.name || opportunity.owner.email}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 pt-1" onClick={(e) => e.stopPropagation()}>
            {canMoveBack && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 px-2 text-xs"
                onClick={() => {
                  const prevActive = activeStages[activeIndex - 1];
                  if (prevActive) onStageChange(realOpportunityId, prevActive as Stage);
                }}
                data-testid={`button-move-back-${opportunity.id}`}
              >
                <ChevronRight className="w-3 h-3 rotate-180" />
              </Button>
            )}
            {canMoveForward && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 px-2 text-xs flex-1"
                onClick={() => {
                  const nextActive = activeStages[activeIndex + 1];
                  if (nextActive) onStageChange(realOpportunityId, nextActive as Stage);
                }}
                data-testid={`button-move-forward-${opportunity.id}`}
              >
                {STAGE_LABELS[activeStages[activeIndex + 1]][language]}
                <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            )}
            {!isWonStage(opportunity.stage) && !isTerminalStage(opportunity.stage) && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 px-2 text-xs text-green-600"
                      onClick={() => onStageChange(realOpportunityId, "won_to_be_delivered")}
                      data-testid={`button-mark-won-${opportunity.id}`}
                    >
                      <Trophy className="w-3 h-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{language === "fr" ? "Gagné" : "Won"}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 px-2 text-xs text-red-600"
                      onClick={() => onDelete(realOpportunityId)}
                      data-testid={`button-delete-${opportunity.id}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{language === "fr" ? "Supprimer" : "Delete"}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 px-2 text-xs text-muted-foreground"
                      onClick={() => onStageChange(realOpportunityId, "lost")}
                      data-testid={`button-mark-lost-${opportunity.id}`}
                    >
                      <TrendingDown className="w-3 h-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{language === "fr" ? "Perdu" : "Lost"}</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StageColumn({ 
  stage, 
  opportunities, 
  onStageChange,
  onDelete,
  onCardClick
}: { 
  stage: Stage; 
  opportunities: DisplayOpportunity[];  // Already filtered by stage!
  onStageChange: (id: string, stage: Stage) => void;
  onDelete: (id: string) => void;
  onCardClick: (opp: DisplayOpportunity) => void;
}) {
  const { language } = useI18n();
  // Opportunities are already pre-filtered by stage via opportunitiesByStage
  const stageOpps = opportunities;
  // For pipeline value, use displayValue for split opportunities, otherwise estimatedValue
  const stageValue = stageOpps.reduce((sum, o) => sum + (o.displayValue ?? o.estimatedValue ?? 0), 0);
  
  const stageColors: Record<Stage, string> = {
    prospect: "border-t-blue-200",
    contacted: "border-t-blue-300",
    qualified: "border-t-blue-400",
    analysis_done: "border-t-blue-500",
    design_mandate_signed: "border-t-amber-400",
    epc_proposal_sent: "border-t-amber-500",
    negotiation: "border-t-amber-600",
    won_to_be_delivered: "border-t-green-300",
    won_in_construction: "border-t-green-400",
    won_delivered: "border-t-green-500",
    lost: "border-t-red-400",
    disqualified: "border-t-gray-400",
  };

  return (
    <div 
      className="flex-shrink-0 w-72"
      data-testid={`column-${stage}`}
    >
      <div className={`bg-muted/30 rounded-lg border-t-4 ${stageColors[stage]} min-h-[500px]`}>
        <div className="p-3 border-b">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-sm">{STAGE_SHORT_LABELS[stage]?.[language] || STAGE_LABELS[stage][language]}</h3>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-muted-foreground hover:text-foreground transition-colors" data-testid={`tooltip-trigger-${stage}`}>
                    <HelpCircle className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[250px] text-center">
                  <p className="text-xs">{STAGE_DESCRIPTIONS[stage][language]}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Badge variant="secondary" className="text-xs" data-testid={`badge-count-${stage}`}>
              {stageOpps.length}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 font-mono">
            {formatCompactCurrency(stageValue)}
          </p>
        </div>
        <div className="p-3">
          {stageOpps.map((opp) => (
            <OpportunityCard 
              key={opp.id} 
              opportunity={opp} 
              onStageChange={onStageChange}
              onDelete={onDelete}
              onClick={() => onCardClick(opp)}
            />
          ))}
          {stageOpps.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">
              {language === "fr" ? "Aucune opportunité" : "No opportunities"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function OpportunityListView({
  opportunities,
  onRowClick,
}: {
  opportunities: DisplayOpportunity[];
  onRowClick: (opp: DisplayOpportunity) => void;
}) {
  const { language } = useI18n();

  const stageColors: Record<Stage, string> = {
    prospect: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    contacted: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    qualified: "bg-blue-200 text-blue-900 dark:bg-blue-800 dark:text-blue-100",
    analysis_done: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
    design_mandate_signed: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    epc_proposal_sent: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    negotiation: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    won_to_be_delivered: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    won_in_construction: "bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200",
    won_delivered: "bg-green-300 text-green-900 dark:bg-green-700 dark:text-green-100",
    lost: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    disqualified: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };

  if (opportunities.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          {language === "fr" ? "Aucune opportunité" : "No opportunities"}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Mobile: Stacked Cards View */}
      <div className="md:hidden space-y-3">
        {opportunities.map((opp) => {
          const displayName = opp.displayName || opp.name;
          const displayValue = opp.displayValue ?? opp.estimatedValue;
          return (
            <Card 
              key={opp.id}
              className="hover-elevate cursor-pointer"
              onClick={() => onRowClick(opp)}
              data-testid={`card-opportunity-${opp.id}`}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    {/* Lead Color Indicator */}
                    {opp.lead && (opp.lead as any).leadColor && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className="shrink-0 rounded-full mt-0.5"
                            style={{
                              width: "8px",
                              height: "8px",
                              backgroundColor:
                                (opp.lead as any).leadColor === "green" ? "#16A34A" :
                                (opp.lead as any).leadColor === "yellow" ? "#EAB308" :
                                (opp.lead as any).leadColor === "red" ? "#DC2626" :
                                "#9CA3AF",
                            }}
                            data-testid={`indicator-lead-color-${opp.id}`}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          {(opp.lead as any).leadColorReason || (
                            (opp.lead as any).leadColor === "green" ? "Qualified - good to go" :
                            (opp.lead as any).leadColor === "yellow" ? "Missing info - needs nurture" :
                            (opp.lead as any).leadColor === "red" ? "Not qualified" :
                            "Not yet classified"
                          )}
                        </TooltipContent>
                      </Tooltip>
                    )}
                    <div className="min-w-0">
                      <h4 className="font-medium text-sm truncate">{displayName}</h4>
                      {opp.client && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3" />
                          <span className="truncate">{opp.client.name}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge className={`shrink-0 text-xs ${PRIORITY_COLORS[opp.priority || "medium"]}`}>
                    {PRIORITY_LABELS[opp.priority || "medium"]?.[language] || opp.priority}
                  </Badge>
                </div>

                {/* RFP Split Type Badge */}
                {opp.isVirtualSplit && (
                  <Badge className={`text-xs ${opp.splitType === 'rfp' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'}`}>
                    {opp.splitType === 'rfp' ? 'RFP Hydro-Québec' : 'Hors RFP'}
                  </Badge>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={`text-xs ${stageColors[opp.stage as Stage]}`}>
                    {STAGE_LABELS[opp.stage]?.[language] || opp.stage}
                  </Badge>
                  {displayValue && displayValue > 0 && (
                    <span className="text-sm font-medium font-mono text-primary">
                      {formatCompactCurrency(displayValue)}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {opp.expectedCloseDate && (
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{format(new Date(opp.expectedCloseDate), "MMM d, yyyy")}</span>
                    </div>
                  )}
                  {opp.owner && (
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      <span className="truncate">{opp.owner.name || opp.owner.email}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Desktop: Table View */}
      <Card className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{language === "fr" ? "Nom" : "Name"}</TableHead>
              <TableHead>{language === "fr" ? "Client" : "Client"}</TableHead>
              <TableHead>{language === "fr" ? "Étape" : "Stage"}</TableHead>
              <TableHead className="text-right">{language === "fr" ? "Valeur" : "Value"}</TableHead>
              <TableHead>{language === "fr" ? "Date de clôture" : "Close Date"}</TableHead>
              <TableHead>{language === "fr" ? "Priorité" : "Priority"}</TableHead>
              <TableHead>{language === "fr" ? "Propriétaire" : "Owner"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {opportunities.map((opp) => {
              const displayName = opp.displayName || opp.name;
              const displayValue = opp.displayValue ?? opp.estimatedValue;
              return (
                <TableRow 
                  key={opp.id} 
                  className="cursor-pointer hover-elevate"
                  onClick={() => onRowClick(opp)}
                  data-testid={`row-opportunity-${opp.id}`}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {/* Lead Color Indicator */}
                      {opp.lead && (opp.lead as any).leadColor && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className="shrink-0 rounded-full"
                              style={{
                                width: "8px",
                                height: "8px",
                                backgroundColor:
                                  (opp.lead as any).leadColor === "green" ? "#16A34A" :
                                  (opp.lead as any).leadColor === "yellow" ? "#EAB308" :
                                  (opp.lead as any).leadColor === "red" ? "#DC2626" :
                                  "#9CA3AF",
                              }}
                              data-testid={`indicator-lead-color-${opp.id}`}
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            {(opp.lead as any).leadColorReason || (
                              (opp.lead as any).leadColor === "green" ? "Qualified - good to go" :
                              (opp.lead as any).leadColor === "yellow" ? "Missing info - needs nurture" :
                              (opp.lead as any).leadColor === "red" ? "Not qualified" :
                              "Not yet classified"
                            )}
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {displayName}
                      {opp.isVirtualSplit && (
                        <Badge className={`text-xs ${opp.splitType === 'rfp' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'}`}>
                          {opp.splitType === 'rfp' ? 'RFP' : 'Hors RFP'}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {opp.client?.name || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${stageColors[opp.stage as Stage]}`}>
                      {STAGE_LABELS[opp.stage]?.[language] || opp.stage}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCompactCurrency(displayValue)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {opp.expectedCloseDate 
                      ? format(new Date(opp.expectedCloseDate), "MMM d, yyyy")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${PRIORITY_COLORS[opp.priority || "medium"]}`}>
                      {PRIORITY_LABELS[opp.priority || "medium"]?.[language] || opp.priority}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {opp.owner?.name || opp.owner?.email || "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

export default function PipelinePage() {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(VIEW_STORAGE_KEY);
      return (stored === "kanban" || stored === "list") ? stored : "kanban";
    }
    return "kanban";
  });
  const [filterOwner, setFilterOwner] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterStage, setFilterStage] = useState<string>("all");
  const [selectedOpportunity, setSelectedOpportunity] = useState<OpportunityWithRelations | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isCreatingNewClient, setIsCreatingNewClient] = useState(false);
  const [isEditCreatingNewClient, setIsEditCreatingNewClient] = useState(false);
  const [isCreatingNewSite, setIsCreatingNewSite] = useState(false);
  
  // Stage advance modal state
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [pendingStageChange, setPendingStageChange] = useState<{ id: string; stage: Stage; opp: OpportunityWithRelations | null } | null>(null);
  const [advanceNotes, setAdvanceNotes] = useState("");
  const [advanceExpectedCloseDate, setAdvanceExpectedCloseDate] = useState("");
  const [isAdvancing, setIsAdvancing] = useState(false);
  
  // Qualification state
  const [isQualificationOpen, setIsQualificationOpen] = useState(false);
  const [selectedLeadForQualification, setSelectedLeadForQualification] = useState<Lead | null>(null);

  // Call Script Wizard state
  const [isCallScriptOpen, setIsCallScriptOpen] = useState(false);
  const [selectedLeadForCallScript, setSelectedLeadForCallScript] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
  }, [viewMode]);

  const [, setLocation] = useLocation();
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "new") {
      setIsAddOpen(true);
      setLocation("/app/pipeline", { replace: true });
    }
    // Handle stage filter from URL
    const stageParam = params.get("stage");
    if (stageParam && STAGES.includes(stageParam as Stage)) {
      setFilterStage(stageParam);
      // Switch to list view for filtered stage view
      setViewMode("list");
    }
  }, [setLocation]);

  const { data: opportunities = [], isLoading } = useQuery<OpportunityWithRelations[]>({
    queryKey: ["/api/opportunities"],
  });

  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  const { data: clientsData } = useQuery<{ clients: Client[]; total: number }>({
    queryKey: ["/api/clients"],
  });
  const clients = clientsData?.clients ?? [];

  // Fetch minimal sites for site selection in opportunity form (optimized - no heavy JSON data)
  const { data: sites = [] } = useQuery<Array<{ id: string; name: string; city: string | null; clientId: string; isArchived: boolean }>>({
    queryKey: ["/api/sites/minimal"],
  });

  const stageChangeMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: Stage }) => {
      const probability = STAGE_PROBABILITIES[stage];
      return apiRequest("POST", `/api/opportunities/${id}/stage`, { stage, probability });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      toast({
        title: language === "fr" ? "Étape mise à jour" : "Stage updated",
      });
    },
    onError: () => {
      toast({
        title: language === "fr" ? "Erreur" : "Error",
        variant: "destructive",
      });
    },
  });

  const createClientMutation = useMutation({
    mutationFn: async (data: { name: string; email?: string; phone?: string }) => {
      // apiRequest already returns parsed JSON
      return apiRequest<{ id: string; name: string }>("POST", "/api/clients", data);
    },
  });

  const createSiteMutation = useMutation({
    mutationFn: async (data: { name: string; clientId: string; address?: string; city?: string; province?: string }) => {
      return apiRequest<{ id: string; name: string }>("POST", "/api/sites", data);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: OpportunityFormValues) => {
      let clientId = data.clientId;
      let siteId = data.siteId;
      
      // If creating new client, create it first
      if (clientId === CREATE_NEW_CLIENT_VALUE && data.newClientName) {
        const newClient = await createClientMutation.mutateAsync({
          name: data.newClientName,
          email: data.newClientEmail || undefined,
          phone: data.newClientPhone || undefined,
        });
        clientId = newClient.id;
      }
      
      // Normalize clientId: treat empty string or CREATE_NEW_CLIENT_VALUE as undefined
      const normalizedClientId = clientId && clientId !== CREATE_NEW_CLIENT_VALUE ? clientId : undefined;
      
      // If creating new site, create it after we have a clientId
      if (siteId === CREATE_NEW_SITE_VALUE && data.newSiteName && normalizedClientId) {
        const newSite = await createSiteMutation.mutateAsync({
          name: data.newSiteName,
          clientId: normalizedClientId,
          address: data.newSiteAddress || undefined,
          city: data.newSiteCity || undefined,
          province: data.newSiteProvince || "Québec",
        });
        siteId = newSite.id;
      }
      
      // Remove inline fields and normalize IDs
      const { newClientName, newClientEmail, newClientPhone, newSiteName, newSiteAddress, newSiteCity, newSiteProvince, ...opportunityData } = data;
      const normalizedSiteId = siteId && siteId !== CREATE_NEW_SITE_VALUE ? siteId : undefined;
      
      const payload = {
        ...opportunityData,
        clientId: normalizedClientId,
        siteId: normalizedSiteId,
        expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate).toISOString() : undefined,
      };
      return apiRequest("POST", "/api/opportunities", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      setIsAddOpen(false);
      setIsCreatingNewClient(false);
      setIsCreatingNewSite(false);
      addForm.reset();
      toast({
        title: language === "fr" ? "Opportunité créée" : "Opportunity created",
      });
    },
    onError: () => {
      toast({
        title: language === "fr" ? "Erreur" : "Error",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<OpportunityFormValues> }) => {
      let clientId = data.clientId;

      if (clientId === CREATE_NEW_CLIENT_VALUE && data.newClientName) {
        const newClient = await createClientMutation.mutateAsync({
          name: data.newClientName,
          email: data.newClientEmail || undefined,
          phone: data.newClientPhone || undefined,
        });
        clientId = newClient.id;
      }

      const normalizedClientId = clientId && clientId !== CREATE_NEW_CLIENT_VALUE ? clientId : undefined;

      const { newClientName, newClientEmail, newClientPhone, newSiteName, newSiteAddress, newSiteCity, newSiteProvince, ...opportunityData } = data;

      const payload = {
        ...opportunityData,
        clientId: normalizedClientId,
        expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate).toISOString() : undefined,
      };
      return apiRequest("PATCH", `/api/opportunities/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setIsDetailOpen(false);
      setSelectedOpportunity(null);
      setIsEditCreatingNewClient(false);
      toast({
        title: language === "fr" ? "Opportunité mise à jour" : "Opportunity updated",
      });
    },
    onError: () => {
      toast({
        title: language === "fr" ? "Erreur" : "Error",
        variant: "destructive",
      });
    },
  });


  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/opportunities/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      setIsDetailOpen(false);
      setSelectedOpportunity(null);
      setDeleteConfirmId(null);
      toast({
        title: language === "fr" ? "Opportunité supprimée" : "Opportunity deleted",
      });
    },
    onError: () => {
      toast({
        title: language === "fr" ? "Erreur lors de la suppression" : "Error deleting opportunity",
        variant: "destructive",
      });
    },
  });

  const addForm = useForm<OpportunityFormValues>({
    resolver: zodResolver(opportunityFormSchema),
    defaultValues: {
      name: "",
      description: "",
      stage: "prospect",
      priority: "medium",
      source: "web_form",
      clientId: "",
      siteId: "",
      newClientName: "",
      newClientEmail: "",
      newClientPhone: "",
      newSiteName: "",
      newSiteAddress: "",
      newSiteCity: "",
      newSiteProvince: "Québec",
    },
  });

  const editForm = useForm<OpportunityFormValues>({
    resolver: zodResolver(opportunityFormSchema),
  });

  // Watch clientId for site selection
  const watchClientId = addForm.watch("clientId");
  
  // Get sites for selected client
  const clientSites = useMemo(() => {
    if (!watchClientId || watchClientId === CREATE_NEW_CLIENT_VALUE) return [];
    return sites.filter(s => s.clientId === watchClientId && !s.isArchived);
  }, [watchClientId, sites]);

  // Smart stage change handler - shows modal for advancing stages
  const handleStageChange = (id: string, stage: Stage) => {
    const opp = opportunities.find(o => o.id === id) || null;
    setPendingStageChange({ id, stage, opp });
    setAdvanceNotes("");
    setAdvanceExpectedCloseDate(
      opp?.expectedCloseDate 
        ? format(new Date(opp.expectedCloseDate), "yyyy-MM-dd") 
        : ""
    );
    setIsAdvanceModalOpen(true);
  };
  
  // Confirm stage advance with optional notes and close date
  const confirmStageAdvance = async () => {
    if (!pendingStageChange || isAdvancing) return;
    
    setIsAdvancing(true);
    const { id, stage } = pendingStageChange;
    const probability = STAGE_PROBABILITIES[stage];
    
    try {
      // Update stage and notes/date atomically in one request if possible
      const updatePayload: Record<string, unknown> = {
        stage,
        probability,
      };
      
      if (advanceNotes) {
        const existingDescription = pendingStageChange.opp?.description || "";
        const timestamp = format(new Date(), "yyyy-MM-dd HH:mm");
        updatePayload.description = existingDescription 
          ? `${existingDescription}\n\n[${timestamp}] ${advanceNotes}`
          : `[${timestamp}] ${advanceNotes}`;
      }
      if (advanceExpectedCloseDate) {
        updatePayload.expectedCloseDate = new Date(advanceExpectedCloseDate).toISOString();
      }
      
      // Use PATCH to update all fields atomically
      await apiRequest("PATCH", `/api/opportunities/${id}`, updatePayload);
      
      await queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      toast({
        title: language === "fr" ? "Étape avancée avec succès" : "Stage advanced successfully",
      });
      
      setIsAdvanceModalOpen(false);
      setPendingStageChange(null);
      setAdvanceNotes("");
      setAdvanceExpectedCloseDate("");
    } catch {
      toast({
        title: language === "fr" ? "Erreur" : "Error",
        variant: "destructive",
      });
    } finally {
      setIsAdvancing(false);
    }
  };

  const handleCardClick = (opp: DisplayOpportunity) => {
    // For virtual split opportunities, find and use the parent opportunity
    const actualOpp = opp.isVirtualSplit && opp.parentOpportunityId
      ? opportunities.find(o => o.id === opp.parentOpportunityId) || opp
      : opp;
    setSelectedOpportunity(actualOpp);
    editForm.reset({
      name: actualOpp.name,
      description: actualOpp.description || "",
      stage: actualOpp.stage,
      estimatedValue: actualOpp.estimatedValue || undefined,
      pvSizeKW: actualOpp.pvSizeKW || undefined,
      expectedCloseDate: actualOpp.expectedCloseDate 
        ? format(new Date(actualOpp.expectedCloseDate), "yyyy-MM-dd") 
        : undefined,
      priority: actualOpp.priority || "medium",
      source: actualOpp.source || undefined,
      clientId: actualOpp.clientId || undefined,
      newClientName: "",
      newClientEmail: "",
      newClientPhone: "",
    });
    setIsEditCreatingNewClient(false);
    setIsDetailOpen(true);
  };

  // Split portfolio opportunities with mixed RFP eligibility into two virtual cards
  const splitOpportunities = useMemo((): DisplayOpportunity[] => {
    return opportunities.flatMap((opp): DisplayOpportunity[] => {
      const breakdown = opp.rfpBreakdown;
      
      // Only split if opportunity has a portfolioId and both eligible and non-eligible sites
      if (opp.portfolioId && breakdown && breakdown.eligibleSites > 0 && breakdown.nonEligibleSites > 0) {
        // Create two virtual opportunities
        const rfpOpp: DisplayOpportunity = {
          ...opp,
          id: `${opp.id}-rfp`,
          isVirtualSplit: true,
          splitType: 'rfp',
          displayName: opp.name.replace(/\s*\([^)]*sites?\)$/i, '') + ` - RFP (${breakdown.eligibleSites} sites)`,
          displayValue: breakdown.eligibleCapex,
          displaySiteCount: breakdown.eligibleSites,
          parentOpportunityId: opp.id,
        };
        
        const nonRfpOpp: DisplayOpportunity = {
          ...opp,
          id: `${opp.id}-non-rfp`,
          isVirtualSplit: true,
          splitType: 'non-rfp',
          displayName: opp.name.replace(/\s*\([^)]*sites?\)$/i, '') + ` - Hors RFP (${breakdown.nonEligibleSites} sites)`,
          displayValue: breakdown.nonEligibleCapex,
          displaySiteCount: breakdown.nonEligibleSites,
          parentOpportunityId: opp.id,
        };
        
        return [rfpOpp, nonRfpOpp];
      }
      
      // Return as-is for non-portfolio or single-type portfolio opportunities
      return [opp as DisplayOpportunity];
    });
  }, [opportunities]);

  const filteredOpportunities = useMemo(() => {
    return splitOpportunities.filter((opp) => {
      if (filterOwner !== "all" && opp.ownerId !== filterOwner) return false;
      if (filterPriority !== "all" && opp.priority !== filterPriority) return false;
      if (filterSource !== "all" && opp.source !== filterSource) return false;
      if (filterStage !== "all" && opp.stage !== filterStage) return false;
      return true;
    });
  }, [splitOpportunities, filterOwner, filterPriority, filterSource, filterStage]);

  const { activeOpportunities, totalPipelineValue, weightedPipelineValue, wonValue } = useMemo(() => {
    const active = filteredOpportunities.filter(o => !isWonStage(o.stage) && o.stage !== "lost");
    const totalValue = active.reduce((sum, o) => sum + (o.displayValue ?? o.estimatedValue ?? 0), 0);
    const weighted = active.reduce((sum, o) => {
      const prob = o.probability ?? STAGE_PROBABILITIES[o.stage as Stage] ?? 0;
      return sum + ((o.displayValue ?? o.estimatedValue ?? 0) * prob / 100);
    }, 0);
    const won = filteredOpportunities
      .filter(o => isWonStage(o.stage))
      .reduce((sum, o) => sum + (o.displayValue ?? o.estimatedValue ?? 0), 0);

    return {
      activeOpportunities: active,
      totalPipelineValue: totalValue,
      weightedPipelineValue: weighted,
      wonValue: won,
    };
  }, [filteredOpportunities]);

  // Pre-group opportunities by stage to avoid repeated filtering in StageColumn
  const opportunitiesByStage = useMemo(() => {
    const grouped = new Map<Stage, DisplayOpportunity[]>();
    STAGES.forEach(s => grouped.set(s, []));
    filteredOpportunities.forEach(opp => {
      const stage = opp.stage as Stage;
      if (grouped.has(stage)) {
        grouped.get(stage)!.push(opp);
      }
    });
    return grouped;
  }, [filteredOpportunities]);

  const owners = useMemo(() => {
    return users.filter(u => u.role === "admin" || u.role === "analyst");
  }, [users]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="flex gap-4 overflow-hidden">
          {STAGES.map((stage) => (
            <Skeleton key={stage} className="h-[500px] w-72 shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 md:gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
            {language === "fr" ? "Pipeline de ventes" : "Sales Pipeline"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {language === "fr" 
              ? "Commencez ici pour un nouveau lead – ajoutez une opportunité et suivez-la jusqu'à la conversion" 
              : "Start here for new leads – add an opportunity and track it through conversion"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-lg p-1 gap-1">
            <Button
              variant={viewMode === "kanban" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("kanban")}
              data-testid="button-view-kanban"
              className="gap-1.5"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">{language === "fr" ? "Kanban" : "Kanban"}</span>
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              data-testid="button-view-list"
              className="gap-1.5"
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">{language === "fr" ? "Liste" : "List"}</span>
            </Button>
          </div>
          <Button onClick={() => setIsAddOpen(true)} data-testid="button-add-opportunity">
            <Plus className="w-4 h-4 mr-2" />
            {language === "fr" ? "Nouvelle opportunité" : "Add Opportunity"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{language === "fr" ? "Filtres:" : "Filters:"}</span>
        </div>
        
        <Select value={filterOwner} onValueChange={setFilterOwner}>
          <SelectTrigger className="w-40" data-testid="select-filter-owner">
            <SelectValue placeholder={language === "fr" ? "Propriétaire" : "Owner"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{language === "fr" ? "Tous" : "All"}</SelectItem>
            {owners.map((owner) => (
              <SelectItem key={owner.id} value={owner.id}>
                {owner.name || owner.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-32" data-testid="select-filter-priority">
            <SelectValue placeholder={language === "fr" ? "Priorité" : "Priority"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{language === "fr" ? "Toutes" : "All"}</SelectItem>
            <SelectItem value="low">{language === "fr" ? "Basse" : "Low"}</SelectItem>
            <SelectItem value="medium">{language === "fr" ? "Moyenne" : "Medium"}</SelectItem>
            <SelectItem value="high">{language === "fr" ? "Haute" : "High"}</SelectItem>
            <SelectItem value="urgent">{language === "fr" ? "Urgente" : "Urgent"}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterSource} onValueChange={setFilterSource}>
          <SelectTrigger className="w-36" data-testid="select-filter-source">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{language === "fr" ? "Toutes" : "All"}</SelectItem>
            <SelectItem value="web_form">{language === "fr" ? "Formulaire web" : "Web Form"}</SelectItem>
            <SelectItem value="referral">{language === "fr" ? "Référence" : "Referral"}</SelectItem>
            <SelectItem value="cold_call">{language === "fr" ? "Appel froid" : "Cold Call"}</SelectItem>
            <SelectItem value="event">{language === "fr" ? "Événement" : "Event"}</SelectItem>
            <SelectItem value="other">{language === "fr" ? "Autre" : "Other"}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterStage} onValueChange={setFilterStage}>
          <SelectTrigger className="w-36" data-testid="select-filter-stage">
            <SelectValue placeholder={language === "fr" ? "Étape" : "Stage"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{language === "fr" ? "Toutes" : "All"}</SelectItem>
            {STAGES.map((stage) => (
              <SelectItem key={stage} value={stage}>
                {STAGE_LABELS[stage][language === "fr" ? "fr" : "en"]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(filterOwner !== "all" || filterPriority !== "all" || filterSource !== "all" || filterStage !== "all") && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => {
              setFilterOwner("all");
              setFilterPriority("all");
              setFilterSource("all");
              setFilterStage("all");
            }}
            data-testid="button-clear-filters"
          >
            <X className="w-3 h-3 mr-1" />
            {language === "fr" ? "Effacer" : "Clear"}
          </Button>
        )}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {language === "fr" ? "Pipeline actif" : "Active Pipeline"}
                </p>
                <p className="text-xl font-bold font-mono" data-testid="stat-pipeline-value">
                  {formatCompactCurrency(totalPipelineValue)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
                <Trophy className="w-4 h-4 md:w-5 md:h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {language === "fr" ? "Gagnées" : "Won"}
                </p>
                <p className="text-xl font-bold font-mono text-green-600" data-testid="stat-won-value">
                  {formatCompactCurrency(wonValue)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-blue-100 dark:bg-blue-900 flex items-center justify-center shrink-0">
                <Target className="w-4 h-4 md:w-5 md:h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {language === "fr" ? "Opportunités actives" : "Active Opportunities"}
                </p>
                <p className="text-xl font-bold font-mono" data-testid="stat-active-count">
                  {activeOpportunities.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-purple-100 dark:bg-purple-900 flex items-center justify-center shrink-0">
                <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {language === "fr" ? "Valeur pondérée" : "Weighted Value"}
                </p>
                <p className="text-xl font-bold font-mono" data-testid="stat-weighted-value">
                  {formatCompactCurrency(weightedPipelineValue)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {viewMode === "kanban" ? (
        <ScrollArea className="w-full">
          <div className="flex gap-4 pb-4">
            {STAGES.map((stage) => (
              <StageColumn
                key={stage}
                stage={stage}
                opportunities={opportunitiesByStage.get(stage) || []}
                onStageChange={handleStageChange}
                onDelete={(id) => setDeleteConfirmId(id)}
                onCardClick={handleCardClick}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      ) : (
        <OpportunityListView
          opportunities={filteredOpportunities}
          onRowClick={handleCardClick}
        />
      )}

      <Dialog open={isAddOpen} onOpenChange={(open) => {
        setIsAddOpen(open);
        if (!open) {
          setIsCreatingNewClient(false);
          addForm.reset();
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {language === "fr" ? "Nouvelle opportunité" : "New Opportunity"}
            </DialogTitle>
          </DialogHeader>
          <Form {...addForm}>
            <form onSubmit={addForm.handleSubmit((data) => {
              // Validate new client name if creating new client
              if (data.clientId === CREATE_NEW_CLIENT_VALUE && !data.newClientName?.trim()) {
                addForm.setError("newClientName", { 
                  type: "required", 
                  message: language === "fr" ? "Le nom du client est requis" : "Client name is required" 
                });
                return;
              }
              // Validate new site name if creating new site
              if (data.siteId === CREATE_NEW_SITE_VALUE && !data.newSiteName?.trim()) {
                addForm.setError("newSiteName", { 
                  type: "required", 
                  message: language === "fr" ? "Le nom du site est requis" : "Site name is required" 
                });
                return;
              }
              createMutation.mutate(data);
            })} className="space-y-4">
              <Tabs defaultValue="opportunity" className="w-full">
                <TabsList className="grid w-full grid-cols-3" data-testid="tabs-add-opportunity">
                  <TabsTrigger value="opportunity" data-testid="tab-add-opportunity">
                    {language === "fr" ? "Opportunité" : "Opportunity"}
                  </TabsTrigger>
                  <TabsTrigger value="financial" data-testid="tab-add-financial">
                    {language === "fr" ? "Financier" : "Financial"}
                  </TabsTrigger>
                  <TabsTrigger value="stakeholders" data-testid="tab-add-stakeholders">
                    {language === "fr" ? "Parties prenantes" : "Stakeholders"}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="opportunity" className="space-y-4 mt-4" data-testid="tabcontent-add-opportunity">
                  <FormField
                    control={addForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === "fr" ? "Nom" : "Name"} *</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-opportunity-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={addForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === "fr" ? "Description" : "Description"}</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={3} data-testid="input-opportunity-description" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={addForm.control}
                    name="clientId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === "fr" ? "Client" : "Client"}</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value);
                            const isNewClient = value === CREATE_NEW_CLIENT_VALUE;
                            setIsCreatingNewClient(isNewClient);
                            // Reset site selection when client changes
                            setIsCreatingNewSite(false);
                            addForm.setValue("siteId", "");
                            addForm.setValue("newSiteName", "");
                            addForm.setValue("newSiteAddress", "");
                            addForm.setValue("newSiteCity", "");
                            addForm.setValue("newSiteProvince", "Québec");
                            // Clear new client fields when switching to existing client
                            if (!isNewClient) {
                              addForm.setValue("newClientName", "");
                              addForm.setValue("newClientEmail", "");
                              addForm.setValue("newClientPhone", "");
                            }
                          }} 
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-opportunity-client">
                              <SelectValue placeholder={language === "fr" ? "Sélectionner..." : "Select..."} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={CREATE_NEW_CLIENT_VALUE} className="text-primary font-medium">
                              <span className="flex items-center gap-1.5">
                                <Plus className="w-3.5 h-3.5" />
                                {language === "fr" ? "Créer un nouveau client" : "Create new client"}
                              </span>
                            </SelectItem>
                            {clients.length > 0 && (
                              <SelectSeparator />
                            )}
                            {clients.map((client) => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Inline client creation fields */}
                  {isCreatingNewClient && (
                    <div className="space-y-3 p-3 border rounded-md bg-muted/30">
                      <p className="text-xs font-medium text-muted-foreground">
                        {language === "fr" ? "Nouveau client" : "New Client"}
                      </p>
                      <FormField
                        control={addForm.control}
                        name="newClientName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{language === "fr" ? "Nom du client" : "Client Name"} *</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder={language === "fr" ? "Nom de l'entreprise" : "Company name"} data-testid="input-new-client-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={addForm.control}
                          name="newClientEmail"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{language === "fr" ? "Courriel" : "Email"}</FormLabel>
                              <FormControl>
                                <Input {...field} type="email" placeholder="email@example.com" data-testid="input-new-client-email" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={addForm.control}
                          name="newClientPhone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{language === "fr" ? "Téléphone" : "Phone"}</FormLabel>
                              <FormControl>
                                <Input {...field} type="tel" placeholder="514-555-0000" data-testid="input-new-client-phone" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}

                  {/* Site Selection - only show when client is selected */}
                  {(watchClientId && watchClientId !== CREATE_NEW_CLIENT_VALUE) && (
                    <FormField
                      control={addForm.control}
                      name="siteId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === "fr" ? "Site" : "Site"}</FormLabel>
                          <Select 
                            onValueChange={(value) => {
                              field.onChange(value);
                              setIsCreatingNewSite(value === CREATE_NEW_SITE_VALUE);
                              if (value !== CREATE_NEW_SITE_VALUE) {
                                addForm.setValue("newSiteName", "");
                                addForm.setValue("newSiteAddress", "");
                                addForm.setValue("newSiteCity", "");
                              }
                            }} 
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-opportunity-site">
                                <SelectValue placeholder={language === "fr" ? "Sélectionner un site (optionnel)" : "Select a site (optional)"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value={CREATE_NEW_SITE_VALUE}>
                                <span className="flex items-center gap-2">
                                  <Plus className="h-3 w-3" />
                                  {language === "fr" ? "Créer un nouveau site" : "Create new site"}
                                </span>
                              </SelectItem>
                              {clientSites.map((site) => (
                                <SelectItem key={site.id} value={site.id}>
                                  {site.name} {site.city && `(${site.city})`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Inline site creation fields */}
                  {isCreatingNewSite && watchClientId && watchClientId !== CREATE_NEW_CLIENT_VALUE && (
                    <div className="space-y-3 p-3 border rounded-md bg-muted/30">
                      <p className="text-xs font-medium text-muted-foreground">
                        {language === "fr" ? "Nouveau site" : "New Site"}
                      </p>
                      <FormField
                        control={addForm.control}
                        name="newSiteName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{language === "fr" ? "Nom du site" : "Site Name"} *</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder={language === "fr" ? "Ex: Entrepôt Montréal" : "Ex: Montreal Warehouse"} data-testid="input-new-site-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addForm.control}
                        name="newSiteAddress"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{language === "fr" ? "Adresse" : "Address"}</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="123 rue Example" data-testid="input-new-site-address" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={addForm.control}
                          name="newSiteCity"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{language === "fr" ? "Ville" : "City"}</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Montréal" data-testid="input-new-site-city" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={addForm.control}
                          name="newSiteProvince"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{language === "fr" ? "Province" : "Province"}</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Québec" data-testid="input-new-site-province" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}

                  <FormField
                    control={addForm.control}
                    name="stage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === "fr" ? "Étape" : "Stage"}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-opportunity-stage">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {STAGES.map((stage) => (
                              <SelectItem key={stage} value={stage}>
                                {STAGE_LABELS[stage][language]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={addForm.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === "fr" ? "Priorité" : "Priority"}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-opportunity-priority">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="low">{language === "fr" ? "Basse" : "Low"}</SelectItem>
                              <SelectItem value="medium">{language === "fr" ? "Moyenne" : "Medium"}</SelectItem>
                              <SelectItem value="high">{language === "fr" ? "Haute" : "High"}</SelectItem>
                              <SelectItem value="urgent">{language === "fr" ? "Urgente" : "Urgent"}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={addForm.control}
                      name="source"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Source</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-opportunity-source">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="web_form">{language === "fr" ? "Formulaire web" : "Web Form"}</SelectItem>
                              <SelectItem value="referral">{language === "fr" ? "Référence" : "Referral"}</SelectItem>
                              <SelectItem value="cold_call">{language === "fr" ? "Appel froid" : "Cold Call"}</SelectItem>
                              <SelectItem value="event">{language === "fr" ? "Événement" : "Event"}</SelectItem>
                              <SelectItem value="other">{language === "fr" ? "Autre" : "Other"}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="financial" className="space-y-4 mt-4" data-testid="tabcontent-add-financial">
                  <FormField
                    control={addForm.control}
                    name="estimatedValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === "fr" ? "Valeur estimée ($)" : "Estimated Value ($)"}</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} data-testid="input-opportunity-value" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={addForm.control}
                    name="pvSizeKW"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === "fr" ? "Taille Solaire (kW)" : "Solar Size (kW)"}</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} data-testid="input-opportunity-pv" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={addForm.control}
                    name="expectedCloseDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === "fr" ? "Date de clôture prévue" : "Expected Close Date"}</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-opportunity-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                <TabsContent value="stakeholders" className="mt-4" data-testid="tabcontent-add-stakeholders">
                  <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                    {language === "fr" 
                      ? "Les contacts clés seront ajoutés prochainement" 
                      : "Key contacts coming soon"}
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => {
                  setIsAddOpen(false);
                  setIsCreatingNewClient(false);
                  setIsCreatingNewSite(false);
                  addForm.reset();
                }}>
                  {language === "fr" ? "Annuler" : "Cancel"}
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-opportunity">
                  {createMutation.isPending 
                    ? (language === "fr" ? "Création..." : "Creating...") 
                    : (language === "fr" ? "Créer" : "Create")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {language === "fr" ? "Détails de l'opportunité" : "Opportunity Details"}
            </DialogTitle>
          </DialogHeader>
          {selectedOpportunity && (
            <Form {...editForm}>
              <form
                onSubmit={editForm.handleSubmit((data) => {
                  if (data.clientId === CREATE_NEW_CLIENT_VALUE && !data.newClientName?.trim()) {
                    editForm.setError("newClientName", {
                      type: "required",
                      message: language === "fr" ? "Le nom du client est requis" : "Client name is required"
                    });
                    return;
                  }
                  updateMutation.mutate({ id: selectedOpportunity.id, data });
                })}
                className="space-y-4"
              >
                {/* Lead Color Badge — prominent display */}
                {selectedOpportunity.lead && (selectedOpportunity.lead as any).leadColor && (() => {
                  const lc = (selectedOpportunity.lead as any).leadColor;
                  const reason = (selectedOpportunity.lead as any).leadColorReason;
                  const bgColor = lc === "green" ? "#DCFCE7" : lc === "yellow" ? "#FEF9C3" : "#FEE2E2";
                  const borderColor = lc === "green" ? "#16A34A" : lc === "yellow" ? "#EAB308" : "#DC2626";
                  const textColor = lc === "green" ? "#16A34A" : lc === "yellow" ? "#92400E" : "#991B1B";
                  const label = lc === "green" ? (language === "fr" ? "VERT — Viable" : "GREEN — Viable") :
                                lc === "yellow" ? (language === "fr" ? "JAUNE — À explorer" : "YELLOW — To explore") :
                                (language === "fr" ? "ROUGE — Non viable" : "RED — Not viable");
                  return (
                    <div className="flex items-center gap-3 p-3 rounded-lg border-2" style={{ backgroundColor: bgColor, borderColor }}>
                      <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: borderColor }} />
                      <div>
                        <span className="font-bold text-sm" style={{ color: textColor }}>{label}</span>
                        {reason && <p className="text-xs mt-0.5" style={{ color: textColor, opacity: 0.8 }}>{reason}</p>}
                      </div>
                    </div>
                  );
                })()}

                <Tabs defaultValue="opportunity" className="w-full">
                  <TabsList className="flex w-full flex-wrap h-auto gap-1 p-1" data-testid="tabs-edit-opportunity">
                    <TabsTrigger value="opportunity" className="text-xs px-2.5 py-1.5" data-testid="tab-edit-opportunity">
                      {language === "fr" ? "Opportunité" : "Opportunity"}
                    </TabsTrigger>
                    <TabsTrigger value="site" className="text-xs px-2.5 py-1.5" data-testid="tab-edit-site">
                      Site
                    </TabsTrigger>
                    <TabsTrigger value="financial" className="text-xs px-2.5 py-1.5" data-testid="tab-edit-financial">
                      {language === "fr" ? "Financier" : "Financial"}
                    </TabsTrigger>
                    <TabsTrigger value="stakeholders" className="text-xs px-2.5 py-1.5" data-testid="tab-edit-stakeholders">
                      {language === "fr" ? "Parties prenantes" : "Stakeholders"}
                    </TabsTrigger>
                    <TabsTrigger value="nurturing" className="text-xs px-2.5 py-1.5" data-testid="tab-edit-nurturing">
                      Nurturing
                    </TabsTrigger>
                    <TabsTrigger value="progression" className="text-xs px-2.5 py-1.5" data-testid="tab-edit-progression">
                      {language === "fr" ? "🗺️ Aventure" : "🗺️ Adventure"}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="opportunity" className="space-y-4 mt-4" data-testid="tabcontent-edit-opportunity">
                    <FormField
                      control={editForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === "fr" ? "Nom" : "Name"} *</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-edit-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={editForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === "fr" ? "Description" : "Description"}</FormLabel>
                          <FormControl>
                            <Textarea {...field} rows={3} data-testid="input-edit-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={editForm.control}
                      name="clientId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === "fr" ? "Client" : "Client"}</FormLabel>
                          <Select 
                            onValueChange={(value) => {
                              field.onChange(value);
                              const isNewClient = value === CREATE_NEW_CLIENT_VALUE;
                              setIsEditCreatingNewClient(isNewClient);
                              if (!isNewClient) {
                                editForm.setValue("newClientName", "");
                                editForm.setValue("newClientEmail", "");
                                editForm.setValue("newClientPhone", "");
                              }
                            }} 
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-edit-client">
                                <SelectValue placeholder={language === "fr" ? "Sélectionner..." : "Select..."} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value={CREATE_NEW_CLIENT_VALUE} className="text-primary font-medium">
                                <span className="flex items-center gap-1.5">
                                  <Plus className="w-3.5 h-3.5" />
                                  {language === "fr" ? "Créer un nouveau client" : "Create new client"}
                                </span>
                              </SelectItem>
                              {clients.length > 0 && (
                                <SelectSeparator />
                              )}
                              {clients.map((client) => (
                                <SelectItem key={client.id} value={client.id}>
                                  {client.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {isEditCreatingNewClient && (
                      <div className="space-y-3 p-3 border rounded-md bg-muted/30">
                        <p className="text-xs font-medium text-muted-foreground">
                          {language === "fr" ? "Nouveau client" : "New Client"}
                        </p>
                        <FormField
                          control={editForm.control}
                          name="newClientName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{language === "fr" ? "Nom du client" : "Client Name"} *</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder={language === "fr" ? "Nom de l'entreprise" : "Company name"} data-testid="input-edit-new-client-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <FormField
                            control={editForm.control}
                            name="newClientEmail"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{language === "fr" ? "Courriel" : "Email"}</FormLabel>
                                <FormControl>
                                  <Input {...field} type="email" placeholder="email@example.com" data-testid="input-edit-new-client-email" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={editForm.control}
                            name="newClientPhone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{language === "fr" ? "Téléphone" : "Phone"}</FormLabel>
                                <FormControl>
                                  <Input {...field} type="tel" placeholder="514-555-0000" data-testid="input-edit-new-client-phone" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    )}

                    <FormField
                      control={editForm.control}
                      name="stage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === "fr" ? "Étape" : "Stage"}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-edit-stage">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {STAGES.map((stage) => (
                                <SelectItem key={stage} value={stage}>
                                  {STAGE_LABELS[stage][language]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={editForm.control}
                        name="priority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{language === "fr" ? "Priorité" : "Priority"}</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-edit-priority">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="low">{language === "fr" ? "Basse" : "Low"}</SelectItem>
                                <SelectItem value="medium">{language === "fr" ? "Moyenne" : "Medium"}</SelectItem>
                                <SelectItem value="high">{language === "fr" ? "Haute" : "High"}</SelectItem>
                                <SelectItem value="urgent">{language === "fr" ? "Urgente" : "Urgent"}</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={editForm.control}
                        name="source"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Source</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-edit-source">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="web_form">{language === "fr" ? "Formulaire web" : "Web Form"}</SelectItem>
                                <SelectItem value="referral">{language === "fr" ? "Référence" : "Referral"}</SelectItem>
                                <SelectItem value="cold_call">{language === "fr" ? "Appel froid" : "Cold Call"}</SelectItem>
                                <SelectItem value="event">{language === "fr" ? "Événement" : "Event"}</SelectItem>
                                <SelectItem value="other">{language === "fr" ? "Autre" : "Other"}</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="site" className="space-y-4 mt-4" data-testid="tabcontent-edit-site">
                    {selectedOpportunity?.site ? (
                      <div className="space-y-4">
                        <div className="p-4 border rounded-lg space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">{selectedOpportunity.site.name}</h4>
                              <p className="text-sm text-muted-foreground">
                                {[selectedOpportunity.site.address, selectedOpportunity.site.city].filter(Boolean).join(", ")}
                              </p>
                            </div>
                            <Button 
                              type="button"
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setIsDetailOpen(false);
                                window.location.href = `/app/sites/${selectedOpportunity.site!.id}`;
                              }}
                              data-testid="button-goto-site"
                            >
                              <Building2 className="w-4 h-4 mr-2" />
                              {language === "fr" ? "Ouvrir le site" : "Open Site"}
                            </Button>
                          </div>
                          {selectedOpportunity.site.address && (
                            <p className="text-sm">{selectedOpportunity.site.address}</p>
                          )}
                          {selectedOpportunity.site.roofAreaSqM && (
                            <p className="text-sm text-muted-foreground">
                              {language === "fr" ? "Superficie de toiture:" : "Roof area:"} {Math.round(selectedOpportunity.site.roofAreaSqM)} m²
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 space-y-4">
                        <Building2 className="w-12 h-12 mx-auto text-muted-foreground opacity-50" />
                        <p className="text-muted-foreground">
                          {language === "fr" 
                            ? "Aucun site lié à cette opportunité" 
                            : "No site linked to this opportunity"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {language === "fr" 
                            ? "Créez un client d'abord, puis ajoutez un site depuis la page client" 
                            : "Create a client first, then add a site from the client page"}
                        </p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="financial" className="space-y-4 mt-4" data-testid="tabcontent-edit-financial">
                    <FormField
                      control={editForm.control}
                      name="estimatedValue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === "fr" ? "Valeur estimée ($)" : "Estimated Value ($)"}</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} data-testid="input-edit-value" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={editForm.control}
                      name="pvSizeKW"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === "fr" ? "Taille Solaire (kW)" : "Solar Size (kW)"}</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} data-testid="input-edit-pv" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={editForm.control}
                      name="expectedCloseDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === "fr" ? "Date de clôture prévue" : "Expected Close Date"}</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-edit-date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>

                  <TabsContent value="stakeholders" className="mt-4" data-testid="tabcontent-edit-stakeholders">
                    <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                      {language === "fr" 
                        ? "Les contacts clés seront ajoutés prochainement" 
                        : "Key contacts coming soon"}
                    </div>
                  </TabsContent>

                  <TabsContent value="nurturing" className="mt-4" data-testid="tabcontent-edit-nurturing">
                    {(selectedOpportunity as any)?.leadId ? (
                      <NurtureStatusPanel leadId={(selectedOpportunity as any).leadId} />
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        {language === "fr" 
                          ? "Cette opportunité n'est pas liée à un prospect." 
                          : "This opportunity is not linked to a lead."}
                      </p>
                    )}
                  </TabsContent>

                  <TabsContent value="progression" className="mt-4" data-testid="tabcontent-edit-progression">
                    <MissionMap
                      opportunityId={selectedOpportunity.id}
                      currentStage={selectedOpportunity.stage}
                      viewMode="am"
                      compact={true}
                    />
                  </TabsContent>
                </Tabs>

                <DialogFooter className="gap-2 flex-wrap">
                  <div className="flex items-center gap-2 mr-auto">
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="text-destructive border-destructive/30"
                      onClick={() => selectedOpportunity && setDeleteConfirmId(selectedOpportunity.id)}
                      data-testid="button-delete-opportunity"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      {language === "fr" ? "Supprimer" : "Delete"}
                    </Button>
                  </div>
                  <Button type="button" variant="outline" onClick={() => setIsDetailOpen(false)}>
                    {language === "fr" ? "Annuler" : "Cancel"}
                  </Button>
                  {(selectedOpportunity as any)?.leadId && (
                    <>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={async () => {
                          try {
                            // apiRequest already returns parsed JSON
                            const lead = await apiRequest("GET", `/api/leads/${(selectedOpportunity as any).leadId}`) as any;
                            setSelectedLeadForQualification(lead as any);
                            setIsQualificationOpen(true);
                          } catch (error) {
                            console.error("Failed to fetch lead:", error);
                          }
                        }}
                        data-testid="button-qualify-lead"
                      >
                        <Target className="w-4 h-4 mr-2" />
                        {language === "fr" ? "Qualifier" : "Qualify"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setSelectedLeadForCallScript((selectedOpportunity as any).leadId);
                          setIsCallScriptOpen(true);
                        }}
                        data-testid="button-call-script"
                      >
                        <Phone className="w-4 h-4 mr-2" />
                        {language === "fr" ? "Appel de qualification" : "Call Script"}
                      </Button>
                    </>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDetailOpen(false);
                      setLocation("/app/tools/lcoe-comparison");
                    }}
                    className="gap-2"
                  >
                    <TrendingDown className="w-4 h-4" />
                    {language === "fr" ? "Comparer LCOE" : "Compare LCOE"}
                  </Button>
                  <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-opportunity">
                    {updateMutation.isPending
                      ? (language === "fr" ? "Sauvegarde..." : "Saving...")
                      : (language === "fr" ? "Sauvegarder" : "Save")}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === "fr" ? "Supprimer cette opportunité?" : "Delete this opportunity?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === "fr" 
                ? "Cette action est irréversible. L'opportunité sera définitivement supprimée du pipeline."
                : "This action cannot be undone. The opportunity will be permanently removed from the pipeline."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === "fr" ? "Annuler" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmId) deleteMutation.mutate(deleteConfirmId);
                setDeleteConfirmId(null);
              }}
              className="bg-red-600 text-white"
              data-testid="button-confirm-delete-card"
            >
              {language === "fr" ? "Supprimer" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Qualification Dialog */}
      {selectedLeadForQualification && (
        <QualificationForm
          lead={selectedLeadForQualification}
          open={isQualificationOpen}
          onClose={() => {
            setIsQualificationOpen(false);
            setSelectedLeadForQualification(null);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
          }}
        />
      )}

      {/* Stage Advance Modal */}
      <Dialog open={isAdvanceModalOpen} onOpenChange={setIsAdvanceModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {language === "fr" ? "Avancer l'opportunité" : "Advance Opportunity"}
            </DialogTitle>
          </DialogHeader>
          
          {pendingStageChange && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg space-y-2">
                <p className="text-sm font-medium">
                  {pendingStageChange.opp?.name}
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {STAGE_LABELS[pendingStageChange.opp?.stage as Stage]?.[language] || pendingStageChange.opp?.stage}
                  </Badge>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  <Badge>
                    {STAGE_LABELS[pendingStageChange.stage]?.[language] || pendingStageChange.stage}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {language === "fr" ? "Probabilité:" : "Probability:"} {STAGE_PROBABILITIES[pendingStageChange.stage]}%
                </p>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {language === "fr" ? "Date de clôture prévue" : "Expected Close Date"}
                </label>
                <Input
                  type="date"
                  value={advanceExpectedCloseDate}
                  onChange={(e) => setAdvanceExpectedCloseDate(e.target.value)}
                  data-testid="input-advance-close-date"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {language === "fr" ? "Notes / Suivi" : "Notes / Follow-up"}
                </label>
                <Textarea
                  value={advanceNotes}
                  onChange={(e) => setAdvanceNotes(e.target.value)}
                  placeholder={language === "fr" 
                    ? "Ajouter une note sur cette progression..." 
                    : "Add a note about this progression..."}
                  className="min-h-[80px]"
                  data-testid="input-advance-notes"
                />
              </div>
            </div>
          )}
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => {
              setIsAdvanceModalOpen(false);
              setPendingStageChange(null);
              setAdvanceNotes("");
              setAdvanceExpectedCloseDate("");
            }} disabled={isAdvancing}>
              {language === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button onClick={confirmStageAdvance} disabled={isAdvancing} data-testid="button-confirm-advance">
              {isAdvancing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {language === "fr" ? "En cours..." : "Processing..."}
                </>
              ) : (
                language === "fr" ? "Confirmer" : "Confirm"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Call Script Wizard Dialog */}
      {selectedLeadForCallScript && isCallScriptOpen && (
        <Suspense fallback={<div className="text-center py-8">{language === "fr" ? "Chargement..." : "Loading..."}</div>}>
          <CallScriptWizard
            leadId={selectedLeadForCallScript}
            open={isCallScriptOpen}
            onClose={() => {
              setIsCallScriptOpen(false);
              setSelectedLeadForCallScript(null);
            }}
            onComplete={() => {
              setIsCallScriptOpen(false);
              setSelectedLeadForCallScript(null);
              queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
