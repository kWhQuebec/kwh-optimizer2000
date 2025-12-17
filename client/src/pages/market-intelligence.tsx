import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Plus, 
  Trash2, 
  Pencil,
  Building2,
  Swords,
  FileText,
  AlertTriangle,
  Globe,
  DollarSign,
  Target,
  Scale,
  ExternalLink,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import type { Competitor, BattleCardWithCompetitor, MarketNote } from "@shared/schema";

const competitorSchema = z.object({
  name: z.string().min(1, "Name required"),
  type: z.string().default("installer"),
  website: z.string().optional(),
  headquartersCity: z.string().optional(),
  province: z.string().optional(),
  businessModel: z.string().optional(),
  targetMarket: z.string().optional(),
  ppaYear1Rate: z.coerce.number().optional(),
  ppaYear2Rate: z.coerce.number().optional(),
  ppaTerm: z.coerce.number().optional(),
  cashPricePerWatt: z.coerce.number().optional(),
  legalNotes: z.string().optional(),
});

const battleCardSchema = z.object({
  competitorId: z.string().min(1, "Competitor required"),
  objectionScenario: z.string().min(1, "Objection scenario required"),
  responseStrategy: z.string().min(1, "Response strategy required"),
  financialComparison: z.string().optional(),
  language: z.string().default("fr"),
  priority: z.coerce.number().default(1),
});

const marketNoteSchema = z.object({
  category: z.string().min(1, "Category required"),
  title: z.string().min(1, "Title required"),
  content: z.string().min(1, "Content required"),
  jurisdiction: z.string().default("QC"),
  sourceUrl: z.string().optional(),
  importance: z.string().default("medium"),
});

type CompetitorForm = z.infer<typeof competitorSchema>;
type BattleCardForm = z.infer<typeof battleCardSchema>;
type MarketNoteForm = z.infer<typeof marketNoteSchema>;

export default function MarketIntelligencePage() {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const { isAdmin, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("competitors");
  
  const [isCompetitorDialogOpen, setIsCompetitorDialogOpen] = useState(false);
  const [editingCompetitor, setEditingCompetitor] = useState<Competitor | null>(null);
  const [deleteCompetitorId, setDeleteCompetitorId] = useState<string | null>(null);
  const [expandedCompetitors, setExpandedCompetitors] = useState<Set<string>>(new Set());
  
  const [isBattleCardDialogOpen, setIsBattleCardDialogOpen] = useState(false);
  const [editingBattleCard, setEditingBattleCard] = useState<BattleCardWithCompetitor | null>(null);
  const [deleteBattleCardId, setDeleteBattleCardId] = useState<string | null>(null);
  
  const [isMarketNoteDialogOpen, setIsMarketNoteDialogOpen] = useState(false);
  const [editingMarketNote, setEditingMarketNote] = useState<MarketNote | null>(null);
  const [deleteMarketNoteId, setDeleteMarketNoteId] = useState<string | null>(null);

  const { data: competitorsList = [], isLoading: competitorsLoading } = useQuery<Competitor[]>({
    queryKey: ["/api/admin/competitors"],
    enabled: isAdmin,
  });

  const { data: battleCards = [], isLoading: battleCardsLoading } = useQuery<BattleCardWithCompetitor[]>({
    queryKey: ["/api/admin/battle-cards"],
    enabled: isAdmin,
  });

  const { data: marketNotes = [], isLoading: marketNotesLoading } = useQuery<MarketNote[]>({
    queryKey: ["/api/admin/market-notes"],
    enabled: isAdmin,
  });

  const competitorForm = useForm<CompetitorForm>({
    resolver: zodResolver(competitorSchema),
    defaultValues: {
      name: "",
      type: "installer",
      website: "",
      headquartersCity: "",
      province: "QC",
      businessModel: "",
      targetMarket: "commercial",
    },
  });

  const battleCardForm = useForm<BattleCardForm>({
    resolver: zodResolver(battleCardSchema),
    defaultValues: {
      competitorId: "",
      objectionScenario: "",
      responseStrategy: "",
      financialComparison: "",
      language: "fr",
      priority: 1,
    },
  });

  const marketNoteForm = useForm<MarketNoteForm>({
    resolver: zodResolver(marketNoteSchema),
    defaultValues: {
      category: "regulation",
      title: "",
      content: "",
      jurisdiction: "QC",
      sourceUrl: "",
      importance: "medium",
    },
  });

  const createCompetitorMutation = useMutation({
    mutationFn: (data: CompetitorForm) => apiRequest("POST", "/api/admin/competitors", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/competitors"] });
      setIsCompetitorDialogOpen(false);
      competitorForm.reset();
      toast({ title: language === "fr" ? "Concurrent ajouté" : "Competitor added" });
    },
  });

  const updateCompetitorMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CompetitorForm> }) => 
      apiRequest("PATCH", `/api/admin/competitors/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/competitors"] });
      setIsCompetitorDialogOpen(false);
      setEditingCompetitor(null);
      competitorForm.reset();
      toast({ title: language === "fr" ? "Concurrent modifié" : "Competitor updated" });
    },
  });

  const deleteCompetitorMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/competitors/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/competitors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/battle-cards"] });
      setDeleteCompetitorId(null);
      toast({ title: language === "fr" ? "Concurrent supprimé" : "Competitor deleted" });
    },
  });

  const createBattleCardMutation = useMutation({
    mutationFn: (data: BattleCardForm) => apiRequest("POST", "/api/admin/battle-cards", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/battle-cards"] });
      setIsBattleCardDialogOpen(false);
      battleCardForm.reset();
      toast({ title: language === "fr" ? "Carte de combat ajoutée" : "Battle card added" });
    },
  });

  const updateBattleCardMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BattleCardForm> }) => 
      apiRequest("PATCH", `/api/admin/battle-cards/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/battle-cards"] });
      setIsBattleCardDialogOpen(false);
      setEditingBattleCard(null);
      battleCardForm.reset();
      toast({ title: language === "fr" ? "Carte de combat modifiée" : "Battle card updated" });
    },
  });

  const deleteBattleCardMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/battle-cards/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/battle-cards"] });
      setDeleteBattleCardId(null);
      toast({ title: language === "fr" ? "Carte de combat supprimée" : "Battle card deleted" });
    },
  });

  const createMarketNoteMutation = useMutation({
    mutationFn: (data: MarketNoteForm) => apiRequest("POST", "/api/admin/market-notes", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/market-notes"] });
      setIsMarketNoteDialogOpen(false);
      marketNoteForm.reset();
      toast({ title: language === "fr" ? "Note ajoutée" : "Note added" });
    },
  });

  const updateMarketNoteMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<MarketNoteForm> }) => 
      apiRequest("PATCH", `/api/admin/market-notes/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/market-notes"] });
      setIsMarketNoteDialogOpen(false);
      setEditingMarketNote(null);
      marketNoteForm.reset();
      toast({ title: language === "fr" ? "Note modifiée" : "Note updated" });
    },
  });

  const deleteMarketNoteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/market-notes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/market-notes"] });
      setDeleteMarketNoteId(null);
      toast({ title: language === "fr" ? "Note supprimée" : "Note deleted" });
    },
  });

  if (authLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!isAdmin) {
    setLocation("/app");
    return null;
  }

  const openEditCompetitor = (competitor: Competitor) => {
    setEditingCompetitor(competitor);
    competitorForm.reset({
      name: competitor.name,
      type: competitor.type || "installer",
      website: competitor.website || "",
      headquartersCity: competitor.headquartersCity || "",
      province: competitor.province || "",
      businessModel: competitor.businessModel || "",
      targetMarket: competitor.targetMarket || "",
      ppaYear1Rate: competitor.ppaYear1Rate || undefined,
      ppaYear2Rate: competitor.ppaYear2Rate || undefined,
      ppaTerm: competitor.ppaTerm || undefined,
      cashPricePerWatt: competitor.cashPricePerWatt || undefined,
      legalNotes: competitor.legalNotes || "",
    });
    setIsCompetitorDialogOpen(true);
  };

  const openEditBattleCard = (card: BattleCardWithCompetitor) => {
    setEditingBattleCard(card);
    battleCardForm.reset({
      competitorId: card.competitorId,
      objectionScenario: card.objectionScenario,
      responseStrategy: card.responseStrategy,
      financialComparison: card.financialComparison || "",
      language: card.language || "fr",
      priority: card.priority || 1,
    });
    setIsBattleCardDialogOpen(true);
  };

  const openEditMarketNote = (note: MarketNote) => {
    setEditingMarketNote(note);
    marketNoteForm.reset({
      category: note.category,
      title: note.title,
      content: note.content,
      jurisdiction: note.jurisdiction || "QC",
      sourceUrl: note.sourceUrl || "",
      importance: note.importance || "medium",
    });
    setIsMarketNoteDialogOpen(true);
  };

  const toggleCompetitorExpanded = (id: string) => {
    const newSet = new Set(expandedCompetitors);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedCompetitors(newSet);
  };

  const getBusinessModelBadge = (model: string | null) => {
    if (!model) return null;
    const colors: Record<string, string> = {
      ppa: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      lease: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      cash_sales: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      epc: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      mixed: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
    };
    return <Badge className={colors[model] || colors.mixed}>{model.toUpperCase()}</Badge>;
  };

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      regulation: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      incentive: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      legal: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      market_trend: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      competitor_news: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    };
    const labels: Record<string, string> = {
      regulation: language === "fr" ? "Réglementation" : "Regulation",
      incentive: language === "fr" ? "Incitatif" : "Incentive",
      legal: language === "fr" ? "Légal" : "Legal",
      market_trend: language === "fr" ? "Tendance" : "Trend",
      competitor_news: language === "fr" ? "Concurrence" : "Competitor",
    };
    return <Badge className={colors[category] || colors.market_trend}>{labels[category] || category}</Badge>;
  };

  const getImportanceBadge = (importance: string | null) => {
    if (!importance) return null;
    const colors: Record<string, string> = {
      low: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
      medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    };
    return <Badge className={colors[importance] || colors.medium}>{importance}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            {language === "fr" ? "Intelligence de marché" : "Market Intelligence"}
          </h1>
          <p className="text-muted-foreground">
            {language === "fr" 
              ? "Suivi des concurrents, réglementations et arguments de vente"
              : "Track competitors, regulations, and sales arguments"}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="competitors" data-testid="tab-competitors">
            <Building2 className="w-4 h-4 mr-2" />
            {language === "fr" ? "Concurrents" : "Competitors"}
          </TabsTrigger>
          <TabsTrigger value="battlecards" data-testid="tab-battlecards">
            <Swords className="w-4 h-4 mr-2" />
            {language === "fr" ? "Cartes de combat" : "Battle Cards"}
          </TabsTrigger>
          <TabsTrigger value="notes" data-testid="tab-notes">
            <FileText className="w-4 h-4 mr-2" />
            {language === "fr" ? "Notes de marché" : "Market Notes"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="competitors" className="space-y-4">
          <div className="flex justify-end">
            <Button 
              onClick={() => {
                setEditingCompetitor(null);
                competitorForm.reset();
                setIsCompetitorDialogOpen(true);
              }}
              data-testid="button-add-competitor"
            >
              <Plus className="w-4 h-4 mr-2" />
              {language === "fr" ? "Ajouter un concurrent" : "Add Competitor"}
            </Button>
          </div>

          {competitorsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
            </div>
          ) : competitorsList.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {language === "fr" 
                  ? "Aucun concurrent enregistré. Ajoutez votre premier concurrent."
                  : "No competitors recorded. Add your first competitor."}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {competitorsList.map(competitor => (
                <Card key={competitor.id} data-testid={`card-competitor-${competitor.id}`}>
                  <Collapsible 
                    open={expandedCompetitors.has(competitor.id)}
                    onOpenChange={() => toggleCompetitorExpanded(competitor.id)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-4">
                        <CollapsibleTrigger className="flex items-center gap-2 text-left hover:underline">
                          {expandedCompetitors.has(competitor.id) 
                            ? <ChevronDown className="w-4 h-4" /> 
                            : <ChevronRight className="w-4 h-4" />}
                          <CardTitle className="text-lg">{competitor.name}</CardTitle>
                        </CollapsibleTrigger>
                        <div className="flex items-center gap-2">
                          {getBusinessModelBadge(competitor.businessModel)}
                          <Button 
                            size="icon" 
                            variant="ghost"
                            onClick={() => openEditCompetitor(competitor)}
                            data-testid={`button-edit-competitor-${competitor.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost"
                            onClick={() => setDeleteCompetitorId(competitor.id)}
                            data-testid={`button-delete-competitor-${competitor.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        {competitor.headquartersCity && (
                          <span className="flex items-center gap-1">
                            <Globe className="w-3 h-3" />
                            {competitor.headquartersCity}, {competitor.province || "QC"}
                          </span>
                        )}
                        {competitor.website && (
                          <a 
                            href={competitor.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:text-primary"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Website
                          </a>
                        )}
                      </div>
                    </CardHeader>
                    <CollapsibleContent>
                      <CardContent className="pt-2 space-y-4">
                        {(competitor.ppaYear1Rate || competitor.ppaYear2Rate || competitor.ppaTerm) && (
                          <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                            <div className="flex items-center gap-2 text-sm font-medium mb-2">
                              <DollarSign className="w-4 h-4" />
                              {language === "fr" ? "Modèle PPA" : "PPA Model"}
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">
                                  {language === "fr" ? "An 1:" : "Year 1:"}
                                </span>
                                <span className="ml-2 font-mono">{competitor.ppaYear1Rate}%</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">
                                  {language === "fr" ? "An 2+:" : "Year 2+:"}
                                </span>
                                <span className="ml-2 font-mono">{competitor.ppaYear2Rate}%</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">
                                  {language === "fr" ? "Durée:" : "Term:"}
                                </span>
                                <span className="ml-2 font-mono">{competitor.ppaTerm} {language === "fr" ? "ans" : "yrs"}</span>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {competitor.cashPricePerWatt && (
                          <div className="flex items-center gap-2 text-sm">
                            <Target className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              {language === "fr" ? "Prix comptant:" : "Cash price:"}
                            </span>
                            <span className="font-mono">${competitor.cashPricePerWatt}/W</span>
                          </div>
                        )}

                        {competitor.legalNotes && (
                          <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-lg border border-rose-200 dark:border-rose-800">
                            <div className="flex items-center gap-2 text-sm font-medium mb-1 text-rose-700 dark:text-rose-300">
                              <Scale className="w-4 h-4" />
                              {language === "fr" ? "Notes légales" : "Legal Notes"}
                            </div>
                            <p className="text-sm text-rose-600 dark:text-rose-400">
                              {competitor.legalNotes}
                            </p>
                          </div>
                        )}

                        <div className="text-xs text-muted-foreground">
                          {battleCards.filter(c => c.competitorId === competitor.id).length} {language === "fr" ? "cartes de combat" : "battle cards"}
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="battlecards" className="space-y-4">
          <div className="flex justify-end">
            <Button 
              onClick={() => {
                setEditingBattleCard(null);
                battleCardForm.reset();
                setIsBattleCardDialogOpen(true);
              }}
              disabled={competitorsList.length === 0}
              data-testid="button-add-battlecard"
            >
              <Plus className="w-4 h-4 mr-2" />
              {language === "fr" ? "Ajouter une carte" : "Add Battle Card"}
            </Button>
          </div>

          {battleCardsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-40" />)}
            </div>
          ) : battleCards.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {competitorsList.length === 0 
                  ? (language === "fr" 
                      ? "Ajoutez d'abord un concurrent pour créer des cartes de combat."
                      : "Add a competitor first to create battle cards.")
                  : (language === "fr" 
                      ? "Aucune carte de combat. Créez des arguments de vente."
                      : "No battle cards. Create sales arguments.")}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {battleCards.map(card => (
                <Card key={card.id} data-testid={`card-battlecard-${card.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">{card.competitor?.name}</Badge>
                          <Badge variant="secondary">P{card.priority}</Badge>
                        </div>
                        <CardTitle className="text-base">
                          <AlertTriangle className="w-4 h-4 inline mr-2 text-amber-500" />
                          {card.objectionScenario}
                        </CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          size="icon" 
                          variant="ghost"
                          onClick={() => openEditBattleCard(card)}
                          data-testid={`button-edit-battlecard-${card.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost"
                          onClick={() => setDeleteBattleCardId(card.id)}
                          data-testid={`button-delete-battlecard-${card.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                        <div className="text-sm font-medium mb-1 text-emerald-700 dark:text-emerald-300">
                          {language === "fr" ? "Notre réponse:" : "Our response:"}
                        </div>
                        <p className="text-sm">{card.responseStrategy}</p>
                      </div>
                      {card.financialComparison && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                          <div className="text-sm font-medium mb-1 text-blue-700 dark:text-blue-300">
                            {language === "fr" ? "Comparaison financière:" : "Financial comparison:"}
                          </div>
                          <p className="text-sm">{card.financialComparison}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="notes" className="space-y-4">
          <div className="flex justify-end">
            <Button 
              onClick={() => {
                setEditingMarketNote(null);
                marketNoteForm.reset();
                setIsMarketNoteDialogOpen(true);
              }}
              data-testid="button-add-note"
            >
              <Plus className="w-4 h-4 mr-2" />
              {language === "fr" ? "Ajouter une note" : "Add Note"}
            </Button>
          </div>

          {marketNotesLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
            </div>
          ) : marketNotes.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {language === "fr" 
                  ? "Aucune note de marché. Ajoutez des informations réglementaires ou de tendances."
                  : "No market notes. Add regulatory or trend information."}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {marketNotes.map(note => (
                <Card key={note.id} data-testid={`card-note-${note.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {getCategoryBadge(note.category)}
                          {getImportanceBadge(note.importance)}
                          <Badge variant="outline">{note.jurisdiction}</Badge>
                        </div>
                        <CardTitle className="text-base">{note.title}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          size="icon" 
                          variant="ghost"
                          onClick={() => openEditMarketNote(note)}
                          data-testid={`button-edit-note-${note.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost"
                          onClick={() => setDeleteMarketNoteId(note.id)}
                          data-testid={`button-delete-note-${note.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                    {note.sourceUrl && (
                      <a 
                        href={note.sourceUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-primary flex items-center gap-1 mt-2 hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {language === "fr" ? "Source" : "Source"}
                      </a>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isCompetitorDialogOpen} onOpenChange={setIsCompetitorDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCompetitor 
                ? (language === "fr" ? "Modifier le concurrent" : "Edit Competitor")
                : (language === "fr" ? "Ajouter un concurrent" : "Add Competitor")}
            </DialogTitle>
          </DialogHeader>
          <Form {...competitorForm}>
            <form onSubmit={competitorForm.handleSubmit((data) => {
              if (editingCompetitor) {
                updateCompetitorMutation.mutate({ id: editingCompetitor.id, data });
              } else {
                createCompetitorMutation.mutate(data);
              }
            })} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={competitorForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Nom" : "Name"} *</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-competitor-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={competitorForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-competitor-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="installer">Installer</SelectItem>
                          <SelectItem value="epc">EPC</SelectItem>
                          <SelectItem value="ppa_provider">PPA Provider</SelectItem>
                          <SelectItem value="utility">Utility</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={competitorForm.control}
                  name="headquartersCity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Ville" : "City"}</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-competitor-city" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={competitorForm.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://" data-testid="input-competitor-website" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={competitorForm.control}
                  name="businessModel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Modèle d'affaires" : "Business Model"}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-competitor-business-model">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ppa">PPA</SelectItem>
                          <SelectItem value="lease">Lease</SelectItem>
                          <SelectItem value="cash_sales">Cash Sales</SelectItem>
                          <SelectItem value="epc">EPC</SelectItem>
                          <SelectItem value="mixed">Mixed</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={competitorForm.control}
                  name="targetMarket"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Marché cible" : "Target Market"}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-competitor-target-market">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="residential">{language === "fr" ? "Résidentiel" : "Residential"}</SelectItem>
                          <SelectItem value="commercial">Commercial</SelectItem>
                          <SelectItem value="industrial">{language === "fr" ? "Industriel" : "Industrial"}</SelectItem>
                          <SelectItem value="all">{language === "fr" ? "Tous" : "All"}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="p-4 bg-muted/50 rounded-lg space-y-4">
                <h4 className="font-medium">{language === "fr" ? "Données PPA (si applicable)" : "PPA Data (if applicable)"}</h4>
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={competitorForm.control}
                    name="ppaYear1Rate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === "fr" ? "Taux An 1 (%)" : "Year 1 Rate (%)"}</FormLabel>
                        <FormControl>
                          <Input type="number" step="1" {...field} data-testid="input-ppa-year1" />
                        </FormControl>
                        <FormDescription>{language === "fr" ? "% du tarif HQ" : "% of HQ rate"}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={competitorForm.control}
                    name="ppaYear2Rate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === "fr" ? "Taux An 2+ (%)" : "Year 2+ Rate (%)"}</FormLabel>
                        <FormControl>
                          <Input type="number" step="1" {...field} data-testid="input-ppa-year2" />
                        </FormControl>
                        <FormDescription>{language === "fr" ? "% du tarif HQ" : "% of HQ rate"}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={competitorForm.control}
                    name="ppaTerm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === "fr" ? "Durée (ans)" : "Term (years)"}</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} data-testid="input-ppa-term" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormField
                control={competitorForm.control}
                name="legalNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "fr" ? "Notes légales / Avertissements" : "Legal Notes / Warnings"}</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder={language === "fr" 
                          ? "Ex: Opère dans une zone grise réglementaire..." 
                          : "E.g., Operates in regulatory gray area..."}
                        data-testid="input-competitor-legal"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCompetitorDialogOpen(false)}>
                  {language === "fr" ? "Annuler" : "Cancel"}
                </Button>
                <Button 
                  type="submit" 
                  disabled={createCompetitorMutation.isPending || updateCompetitorMutation.isPending}
                  data-testid="button-save-competitor"
                >
                  {editingCompetitor 
                    ? (language === "fr" ? "Sauvegarder" : "Save")
                    : (language === "fr" ? "Ajouter" : "Add")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isBattleCardDialogOpen} onOpenChange={setIsBattleCardDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingBattleCard 
                ? (language === "fr" ? "Modifier la carte" : "Edit Battle Card")
                : (language === "fr" ? "Ajouter une carte de combat" : "Add Battle Card")}
            </DialogTitle>
            <DialogDescription>
              {language === "fr" 
                ? "Créez des réponses aux objections courantes des clients."
                : "Create responses to common client objections."}
            </DialogDescription>
          </DialogHeader>
          <Form {...battleCardForm}>
            <form onSubmit={battleCardForm.handleSubmit((data) => {
              if (editingBattleCard) {
                updateBattleCardMutation.mutate({ id: editingBattleCard.id, data });
              } else {
                createBattleCardMutation.mutate(data);
              }
            })} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={battleCardForm.control}
                  name="competitorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Concurrent" : "Competitor"} *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-battlecard-competitor">
                            <SelectValue placeholder={language === "fr" ? "Sélectionner..." : "Select..."} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {competitorsList.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={battleCardForm.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Priorité" : "Priority"}</FormLabel>
                      <Select onValueChange={(v) => field.onChange(parseInt(v))} value={String(field.value)}>
                        <FormControl>
                          <SelectTrigger data-testid="select-battlecard-priority">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">1 - {language === "fr" ? "Haute" : "High"}</SelectItem>
                          <SelectItem value="2">2 - {language === "fr" ? "Moyenne" : "Medium"}</SelectItem>
                          <SelectItem value="3">3 - {language === "fr" ? "Basse" : "Low"}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={battleCardForm.control}
                name="objectionScenario"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "fr" ? "Scénario d'objection" : "Objection Scenario"} *</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder={language === "fr" 
                          ? "Ex: Le client dit que TRC offre $0 comptant initial..."
                          : "E.g., Client says TRC offers $0 upfront..."}
                        data-testid="input-objection"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={battleCardForm.control}
                name="responseStrategy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "fr" ? "Notre réponse" : "Our Response"} *</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        rows={4}
                        placeholder={language === "fr" 
                          ? "Comment répondre à cette objection..."
                          : "How to respond to this objection..."}
                        data-testid="input-response"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={battleCardForm.control}
                name="financialComparison"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "fr" ? "Comparaison financière" : "Financial Comparison"}</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder={language === "fr" 
                          ? "Ex: Notre modèle économise $50k sur 25 ans..."
                          : "E.g., Our model saves $50k over 25 years..."}
                        data-testid="input-financial"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsBattleCardDialogOpen(false)}>
                  {language === "fr" ? "Annuler" : "Cancel"}
                </Button>
                <Button 
                  type="submit" 
                  disabled={createBattleCardMutation.isPending || updateBattleCardMutation.isPending}
                  data-testid="button-save-battlecard"
                >
                  {editingBattleCard 
                    ? (language === "fr" ? "Sauvegarder" : "Save")
                    : (language === "fr" ? "Ajouter" : "Add")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isMarketNoteDialogOpen} onOpenChange={setIsMarketNoteDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingMarketNote 
                ? (language === "fr" ? "Modifier la note" : "Edit Note")
                : (language === "fr" ? "Ajouter une note de marché" : "Add Market Note")}
            </DialogTitle>
          </DialogHeader>
          <Form {...marketNoteForm}>
            <form onSubmit={marketNoteForm.handleSubmit((data) => {
              if (editingMarketNote) {
                updateMarketNoteMutation.mutate({ id: editingMarketNote.id, data });
              } else {
                createMarketNoteMutation.mutate(data);
              }
            })} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={marketNoteForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Catégorie" : "Category"} *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-note-category">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="regulation">{language === "fr" ? "Réglementation" : "Regulation"}</SelectItem>
                          <SelectItem value="incentive">{language === "fr" ? "Incitatif" : "Incentive"}</SelectItem>
                          <SelectItem value="legal">{language === "fr" ? "Légal" : "Legal"}</SelectItem>
                          <SelectItem value="market_trend">{language === "fr" ? "Tendance" : "Trend"}</SelectItem>
                          <SelectItem value="competitor_news">{language === "fr" ? "Concurrence" : "Competitor"}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={marketNoteForm.control}
                  name="jurisdiction"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Juridiction" : "Jurisdiction"}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-note-jurisdiction">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="QC">Québec</SelectItem>
                          <SelectItem value="CA">Canada</SelectItem>
                          <SelectItem value="Federal">{language === "fr" ? "Fédéral" : "Federal"}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={marketNoteForm.control}
                  name="importance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Importance</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-note-importance">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">{language === "fr" ? "Basse" : "Low"}</SelectItem>
                          <SelectItem value="medium">{language === "fr" ? "Moyenne" : "Medium"}</SelectItem>
                          <SelectItem value="high">{language === "fr" ? "Haute" : "High"}</SelectItem>
                          <SelectItem value="critical">{language === "fr" ? "Critique" : "Critical"}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={marketNoteForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "fr" ? "Titre" : "Title"} *</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-note-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={marketNoteForm.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "fr" ? "Contenu" : "Content"} *</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={6} data-testid="input-note-content" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={marketNoteForm.control}
                name="sourceUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "fr" ? "URL source" : "Source URL"}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="https://" data-testid="input-note-source" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsMarketNoteDialogOpen(false)}>
                  {language === "fr" ? "Annuler" : "Cancel"}
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMarketNoteMutation.isPending || updateMarketNoteMutation.isPending}
                  data-testid="button-save-note"
                >
                  {editingMarketNote 
                    ? (language === "fr" ? "Sauvegarder" : "Save")
                    : (language === "fr" ? "Ajouter" : "Add")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteCompetitorId} onOpenChange={() => setDeleteCompetitorId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{language === "fr" ? "Supprimer ce concurrent?" : "Delete this competitor?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {language === "fr" 
                ? "Cette action supprimera également toutes les cartes de combat associées."
                : "This will also delete all associated battle cards."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === "fr" ? "Annuler" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCompetitorId && deleteCompetitorMutation.mutate(deleteCompetitorId)}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete-competitor"
            >
              {language === "fr" ? "Supprimer" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteBattleCardId} onOpenChange={() => setDeleteBattleCardId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{language === "fr" ? "Supprimer cette carte?" : "Delete this battle card?"}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === "fr" ? "Annuler" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteBattleCardId && deleteBattleCardMutation.mutate(deleteBattleCardId)}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete-battlecard"
            >
              {language === "fr" ? "Supprimer" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteMarketNoteId} onOpenChange={() => setDeleteMarketNoteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{language === "fr" ? "Supprimer cette note?" : "Delete this note?"}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === "fr" ? "Annuler" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMarketNoteId && deleteMarketNoteMutation.mutate(deleteMarketNoteId)}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete-note"
            >
              {language === "fr" ? "Supprimer" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
