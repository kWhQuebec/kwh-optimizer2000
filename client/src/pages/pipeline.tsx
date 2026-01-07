import { useState, useEffect } from "react";
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
  XCircle,
  HelpCircle,
  LayoutGrid,
  List
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import type { Opportunity, User as UserType, Client } from "@shared/schema";

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

const STAGES = ["prospect", "qualified", "proposal", "design_signed", "negotiation", "won_to_be_delivered", "won_in_construction", "won_delivered", "lost"] as const;
type Stage = typeof STAGES[number];

const STAGE_LABELS: Record<string, { fr: string; en: string }> = {
  prospect: { fr: "Prospect (5%)", en: "Prospect (5%)" },
  qualified: { fr: "Qualifié (15%)", en: "Qualified (15%)" },
  proposal: { fr: "Proposition (25%)", en: "Proposal (25%)" },
  design_signed: { fr: "Design signé (50%)", en: "Design Signed (50%)" },
  negotiation: { fr: "Négociation (75%)", en: "Negotiation (75%)" },
  won_to_be_delivered: { fr: "Gagné - À livrer (100%)", en: "Won - To be Delivered (100%)" },
  won_in_construction: { fr: "Gagné - En construction (100%)", en: "Won - In Construction (100%)" },
  won_delivered: { fr: "Gagné - Livré (100%)", en: "Won - Delivered (100%)" },
  lost: { fr: "Perdu (0%)", en: "Lost (0%)" },
};

const STAGE_DESCRIPTIONS: Record<string, { fr: string; en: string }> = {
  prospect: { 
    fr: "Premier contact – lead entrant ou identifié, aucune qualification faite encore", 
    en: "First contact – incoming or identified lead, no qualification done yet" 
  },
  qualified: { 
    fr: "Intérêt confirmé, site viable pour le solaire, budget réaliste et décideur identifié", 
    en: "Confirmed interest, viable solar site, realistic budget and decision-maker identified" 
  },
  proposal: { 
    fr: "Analyse solaire et proposition financière remises au client", 
    en: "Solar analysis and financial proposal delivered to client" 
  },
  design_signed: { 
    fr: "Client a signé l'entente de design pour les plans détaillés", 
    en: "Client signed the design agreement for detailed plans" 
  },
  negotiation: { 
    fr: "Négociation du contrat de construction en cours", 
    en: "Construction contract negotiation in progress" 
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
};

const STAGE_PROBABILITIES: Record<Stage, number> = {
  prospect: 5,
  qualified: 15,
  proposal: 25,
  design_signed: 50,
  negotiation: 75,
  won_to_be_delivered: 100,
  won_in_construction: 100,
  won_delivered: 100,
  lost: 0,
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
  rfpBreakdown?: RfpBreakdown;
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
});

type OpportunityFormValues = z.infer<typeof opportunityFormSchema>;

function OpportunityCard({ 
  opportunity, 
  onStageChange, 
  onClick 
}: { 
  opportunity: DisplayOpportunity; 
  onStageChange: (id: string, stage: Stage) => void;
  onClick: () => void;
}) {
  const { language } = useI18n();
  const currentStageIndex = STAGES.indexOf(opportunity.stage as Stage);
  const canMoveForward = currentStageIndex < STAGES.length - 2;
  const canMoveBack = currentStageIndex > 0 && !isWonStage(opportunity.stage) && opportunity.stage !== "lost";
  
  // For virtual split opportunities, use display values; otherwise use original values
  const displayName = opportunity.displayName || opportunity.name;
  const displayValue = opportunity.displayValue ?? opportunity.estimatedValue;
  const realOpportunityId = opportunity.parentOpportunityId || opportunity.id;
  
  // Visual indicator for RFP split type
  const splitBadge = opportunity.isVirtualSplit && opportunity.splitType === 'rfp' 
    ? { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300", label: "RFP HQ" }
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
            <h4 className="font-medium text-sm leading-tight line-clamp-2">{displayName}</h4>
            <Badge 
              className={`shrink-0 text-xs ${PRIORITY_COLORS[opportunity.priority || "medium"]}`}
              data-testid={`badge-priority-${opportunity.id}`}
            >
              {opportunity.priority || "medium"}
            </Badge>
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
                onClick={() => onStageChange(realOpportunityId, STAGES[currentStageIndex - 1])}
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
                onClick={() => onStageChange(realOpportunityId, STAGES[currentStageIndex + 1])}
                data-testid={`button-move-forward-${opportunity.id}`}
              >
                {STAGE_LABELS[STAGES[currentStageIndex + 1]][language]}
                <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            )}
            {!isWonStage(opportunity.stage) && opportunity.stage !== "lost" && (
              <>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 px-2 text-xs text-green-600"
                  onClick={() => onStageChange(realOpportunityId, "won_to_be_delivered")}
                  data-testid={`button-mark-won-${opportunity.id}`}
                >
                  <Trophy className="w-3 h-3" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 px-2 text-xs text-red-600"
                  onClick={() => onStageChange(realOpportunityId, "lost")}
                  data-testid={`button-mark-lost-${opportunity.id}`}
                >
                  <XCircle className="w-3 h-3" />
                </Button>
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
  onCardClick
}: { 
  stage: Stage; 
  opportunities: DisplayOpportunity[];
  onStageChange: (id: string, stage: Stage) => void;
  onCardClick: (opp: DisplayOpportunity) => void;
}) {
  const { language } = useI18n();
  const stageOpps = opportunities.filter(o => o.stage === stage);
  // For pipeline value, use displayValue for split opportunities, otherwise estimatedValue
  const stageValue = stageOpps.reduce((sum, o) => sum + (o.displayValue ?? o.estimatedValue ?? 0), 0);
  
  const stageColors: Record<Stage, string> = {
    prospect: "border-t-slate-400",
    qualified: "border-t-blue-400",
    proposal: "border-t-purple-400",
    design_signed: "border-t-yellow-500",
    negotiation: "border-t-orange-400",
    won_to_be_delivered: "border-t-emerald-400",
    won_in_construction: "border-t-green-500",
    won_delivered: "border-t-green-700",
    lost: "border-t-red-500",
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
              <h3 className="font-semibold text-sm">{STAGE_LABELS[stage][language]}</h3>
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
    prospect: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    qualified: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    proposal: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    design_signed: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    negotiation: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
    won_to_be_delivered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
    won_in_construction: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    won_delivered: "bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200",
    lost: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
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
                  <div className="min-w-0">
                    <h4 className="font-medium text-sm truncate">{displayName}</h4>
                    {opp.client && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3" />
                        <span className="truncate">{opp.client.name}</span>
                      </p>
                    )}
                  </div>
                  <Badge className={`shrink-0 text-xs ${PRIORITY_COLORS[opp.priority || "medium"]}`}>
                    {PRIORITY_LABELS[opp.priority || "medium"]?.[language] || opp.priority}
                  </Badge>
                </div>

                {/* RFP Split Type Badge */}
                {opp.isVirtualSplit && (
                  <Badge className={`text-xs ${opp.splitType === 'rfp' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'}`}>
                    {opp.splitType === 'rfp' ? 'RFP HQ' : 'Hors RFP'}
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
  const [selectedOpportunity, setSelectedOpportunity] = useState<OpportunityWithRelations | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
  }, [viewMode]);

  const { data: opportunities = [], isLoading } = useQuery<OpportunityWithRelations[]>({
    queryKey: ["/api/opportunities"],
  });

  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
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

  const createMutation = useMutation({
    mutationFn: async (data: OpportunityFormValues) => {
      const payload = {
        ...data,
        expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate).toISOString() : undefined,
      };
      return apiRequest("POST", "/api/opportunities", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      setIsAddOpen(false);
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
      const payload = {
        ...data,
        expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate).toISOString() : undefined,
      };
      return apiRequest("PATCH", `/api/opportunities/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      setIsDetailOpen(false);
      setSelectedOpportunity(null);
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

  const addForm = useForm<OpportunityFormValues>({
    resolver: zodResolver(opportunityFormSchema),
    defaultValues: {
      name: "",
      description: "",
      stage: "prospect",
      priority: "medium",
      source: "web_form",
    },
  });

  const editForm = useForm<OpportunityFormValues>({
    resolver: zodResolver(opportunityFormSchema),
  });

  const handleStageChange = (id: string, stage: Stage) => {
    stageChangeMutation.mutate({ id, stage });
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
    });
    setIsDetailOpen(true);
  };

  // Split portfolio opportunities with mixed RFP eligibility into two virtual cards
  const splitOpportunities: DisplayOpportunity[] = opportunities.flatMap((opp): DisplayOpportunity[] => {
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

  const filteredOpportunities = splitOpportunities.filter((opp) => {
    if (filterOwner !== "all" && opp.ownerId !== filterOwner) return false;
    if (filterPriority !== "all" && opp.priority !== filterPriority) return false;
    if (filterSource !== "all" && opp.source !== filterSource) return false;
    return true;
  });

  const activeOpportunities = filteredOpportunities.filter(o => !isWonStage(o.stage) && o.stage !== "lost");
  // Use displayValue for split opportunities, otherwise use estimatedValue
  const totalPipelineValue = activeOpportunities.reduce((sum, o) => sum + (o.displayValue ?? o.estimatedValue ?? 0), 0);
  const weightedPipelineValue = activeOpportunities.reduce((sum, o) => {
    const prob = o.probability ?? STAGE_PROBABILITIES[o.stage as Stage] ?? 0;
    return sum + ((o.displayValue ?? o.estimatedValue ?? 0) * prob / 100);
  }, 0);
  const wonValue = filteredOpportunities.filter(o => isWonStage(o.stage)).reduce((sum, o) => sum + (o.displayValue ?? o.estimatedValue ?? 0), 0);

  const owners = users.filter(u => u.role === "admin" || u.role === "analyst");

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
            {language === "fr" ? "Gérez vos opportunités commerciales" : "Manage your sales opportunities"}
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

        {(filterOwner !== "all" || filterPriority !== "all" || filterSource !== "all") && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => {
              setFilterOwner("all");
              setFilterPriority("all");
              setFilterSource("all");
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
                opportunities={filteredOpportunities}
                onStageChange={handleStageChange}
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

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {language === "fr" ? "Nouvelle opportunité" : "New Opportunity"}
            </DialogTitle>
          </DialogHeader>
          <Form {...addForm}>
            <form onSubmit={addForm.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
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
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-opportunity-client">
                              <SelectValue placeholder={language === "fr" ? "Sélectionner..." : "Select..."} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
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
                        <FormLabel>{language === "fr" ? "Taille PV (kW)" : "PV Size (kW)"}</FormLabel>
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
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
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
                onSubmit={editForm.handleSubmit((data) => 
                  updateMutation.mutate({ id: selectedOpportunity.id, data })
                )} 
                className="space-y-4"
              >
                <Tabs defaultValue="opportunity" className="w-full">
                  <TabsList className="grid w-full grid-cols-3" data-testid="tabs-edit-opportunity">
                    <TabsTrigger value="opportunity" data-testid="tab-edit-opportunity">
                      {language === "fr" ? "Opportunité" : "Opportunity"}
                    </TabsTrigger>
                    <TabsTrigger value="financial" data-testid="tab-edit-financial">
                      {language === "fr" ? "Financier" : "Financial"}
                    </TabsTrigger>
                    <TabsTrigger value="stakeholders" data-testid="tab-edit-stakeholders">
                      {language === "fr" ? "Parties prenantes" : "Stakeholders"}
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
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-edit-client">
                                <SelectValue placeholder={language === "fr" ? "Sélectionner..." : "Select..."} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
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
                          <FormLabel>{language === "fr" ? "Taille PV (kW)" : "PV Size (kW)"}</FormLabel>
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
                </Tabs>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDetailOpen(false)}>
                    {language === "fr" ? "Annuler" : "Cancel"}
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
    </div>
  );
}
