import { useState, useMemo } from "react";
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
  FileArchive,
  AlertTriangle,
  Globe,
  DollarSign,
  Target,
  Scale,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Tag,
  Printer,
  Mail,
  Copy,
  Check,
  TrendingUp,
  TrendingDown,
  Wrench,
  Hammer,
  CircleCheck,
  CircleX,
  Banknote,
  CreditCard,
  Building,
  ShieldCheck,
  Percent,
  Calendar,
  FileQuestion,
  HelpCircle,
} from "lucide-react";
import { useCashflowModel } from "@/hooks/useCashflowModel";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  ReferenceLine,
} from "recharts";
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
import type { Competitor, BattleCardWithCompetitor, MarketNote, MarketDocument, CompetitorProposalAnalysis } from "@shared/schema";

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

const documentFormSchema = z.object({
  title: z.string().min(1, "Title required"),
  entityType: z.string().min(1, "Entity type required"),
  competitorId: z.string().optional(),
  documentType: z.string().min(1, "Document type required"),
  fileName: z.string().min(1, "File path required"),
  fileUrl: z.string().optional(),
  description: z.string().optional(),
  tags: z.string().optional(),
});

type CompetitorForm = z.infer<typeof competitorSchema>;
type BattleCardForm = z.infer<typeof battleCardSchema>;
type MarketNoteForm = z.infer<typeof marketNoteSchema>;
type DocumentForm = z.infer<typeof documentFormSchema>;

interface FinancingComparisonSectionProps {
  proposal: CompetitorProposalAnalysis;
  competitorName: string;
  language: string;
  formatCurrency: (value: number) => string;
}

function FinancingComparisonSection({ proposal, competitorName, language, formatCurrency }: FinancingComparisonSectionProps) {
  const cashflowModel = useCashflowModel({
    systemSizeKW: proposal.systemSizeKW || 0,
    annualProductionKWh: proposal.annualProductionKWh,
    kwhCostPerWatt: proposal.kwhCostPerWatt,
    gridRateY1: proposal.compElecRate,
    kwhInflation: proposal.kwhInflationRate,
    trcInflation: proposal.compInflationRate,
    degradation: proposal.kwhDegradationRate,
    ppaTerm: proposal.ppaTerm,
    ppaDiscount: (proposal.ppaDiscountPercent || 40) / 100,
    trcProjectCost: proposal.projectCostTotal
  });

  if (!cashflowModel) {
    return null;
  }

  const { cash, lease, ppa, providerEconomics, foregoneIncentives } = cashflowModel;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse" data-testid={`table-financing-comparison-${proposal.id}`}>
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left py-2 px-3 font-medium border-b">
                {language === "fr" ? "Option" : "Option"}
              </th>
              <th className="text-center py-2 px-3 font-medium border-b">
                {language === "fr" ? "Écon. annuelles" : "Annual Savings"}
              </th>
              <th className="text-center py-2 px-3 font-medium border-b">
                {language === "fr" ? "Investissement" : "Investment"}
              </th>
              <th className="text-center py-2 px-3 font-medium border-b">
                {language === "fr" ? "Économies 25 ans" : "25-Year Savings"}
              </th>
              <th className="text-center py-2 px-3 font-medium border-b">
                {language === "fr" ? "Propriété" : "Ownership"}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-blue-50 dark:bg-blue-950/30">
              <td className="py-2 px-3 border-b font-medium text-blue-700 dark:text-blue-400">
                <Banknote className="w-4 h-4 inline mr-1" />
                {language === "fr" ? cash.name : cash.nameEn}
              </td>
              <td className={`text-center py-2 px-3 border-b font-bold ${cash.avgAnnualSavings >= 0 ? 'text-blue-600' : 'text-red-600'}`} data-testid={`text-cash-annual-${proposal.id}`}>
                {cash.avgAnnualSavings >= 0 
                  ? `${formatCurrency(Math.round(cash.avgAnnualSavings))}/an`
                  : `(${formatCurrency(Math.round(Math.abs(cash.avgAnnualSavings)))})/an`}
              </td>
              <td className="text-center py-2 px-3 border-b">
                {formatCurrency(Math.round(cash.investment))}
              </td>
              <td className={`text-center py-2 px-3 border-b font-semibold ${cash.totalSavings >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid={`text-cash-savings-${proposal.id}`}>
                {cash.totalSavings >= 0 
                  ? formatCurrency(Math.round(cash.totalSavings))
                  : `(${formatCurrency(Math.round(Math.abs(cash.totalSavings)))})`}
              </td>
              <td className="text-center py-2 px-3 border-b text-green-600 font-medium">
                {language === "fr" ? "Jour 1" : "Day 1"}
              </td>
            </tr>
            <tr className="bg-green-50 dark:bg-green-950/30">
              <td className="py-2 px-3 border-b font-medium text-green-700 dark:text-green-400">
                <CreditCard className="w-4 h-4 inline mr-1" />
                {language === "fr" ? lease.name : lease.nameEn}
              </td>
              <td className={`text-center py-2 px-3 border-b font-bold ${lease.avgAnnualSavings >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid={`text-lease-annual-${proposal.id}`}>
                {lease.avgAnnualSavings >= 0 
                  ? `${formatCurrency(Math.round(lease.avgAnnualSavings))}/an`
                  : `(${formatCurrency(Math.round(Math.abs(lease.avgAnnualSavings)))})/an`}
              </td>
              <td className="text-center py-2 px-3 border-b">
                $0
              </td>
              <td className={`text-center py-2 px-3 border-b font-semibold ${lease.totalSavings >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid={`text-lease-savings-${proposal.id}`}>
                {lease.totalSavings >= 0 
                  ? formatCurrency(Math.round(lease.totalSavings))
                  : `(${formatCurrency(Math.round(Math.abs(lease.totalSavings)))})`}
              </td>
              <td className="text-center py-2 px-3 border-b">
                {language === "fr" ? `Année ${lease.ownershipYear}` : `Year ${lease.ownershipYear}`}
              </td>
            </tr>
            <tr className="bg-red-50 dark:bg-red-950/30">
              <td className="py-2 px-3 border-b font-medium text-red-700 dark:text-red-400">
                <Building className="w-4 h-4 inline mr-1" />
                PPA ({competitorName})
              </td>
              <td className={`text-center py-2 px-3 border-b font-bold ${ppa.avgAnnualSavings >= 0 ? 'text-amber-600' : 'text-red-600'}`} data-testid={`text-ppa-annual-${proposal.id}`}>
                {ppa.avgAnnualSavings >= 0 
                  ? `${formatCurrency(Math.round(ppa.avgAnnualSavings))}/an`
                  : `(${formatCurrency(Math.round(Math.abs(ppa.avgAnnualSavings)))})/an`}
              </td>
              <td className="text-center py-2 px-3 border-b">
                $0
              </td>
              <td className={`text-center py-2 px-3 border-b font-semibold ${ppa.totalSavings >= 0 ? 'text-amber-600' : 'text-red-600'}`} data-testid={`text-ppa-savings-${proposal.id}`}>
                {ppa.totalSavings >= 0 
                  ? formatCurrency(Math.round(ppa.totalSavings))
                  : `(${formatCurrency(Math.round(Math.abs(ppa.totalSavings)))})`}
              </td>
              <td className="text-center py-2 px-3 border-b">
                {language === "fr" ? `Année ${ppa.ownershipYear}` : `Year ${ppa.ownershipYear}`}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div className="text-xs text-muted-foreground">
        <p>{language === "fr" 
          ? "Économies annuelles moyennes sur 25 ans. Crédit-bail inclut paiements sur 7 ans. PPA inclut rabais pendant le terme et frais O&M après." 
          : "Average annual savings over 25 years. Lease includes payments over 7 years. PPA includes discount during term and O&M fees after."}</p>
      </div>

      <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
        <h6 className="text-sm font-semibold mb-3 flex items-center gap-2 text-amber-800 dark:text-amber-300">
          <DollarSign className="w-4 h-4" />
          {language === "fr" ? "Comment le fournisseur PPA fait-il de l'argent?" : "How does the PPA provider make money?"}
        </h6>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-medium text-amber-700 dark:text-amber-400 mb-2">
              {language === "fr" ? "Incitatifs captés par le fournisseur:" : "Incentives captured by provider:"}
            </p>
            <ul className="space-y-1 text-amber-900 dark:text-amber-200">
              <li className="flex justify-between gap-2">
                <span>{language === "fr" ? "Incitatif Hydro-Québec:" : "Hydro-Québec Incentive:"}</span>
                <span className="font-mono">{formatCurrency(Math.round(providerEconomics.hqIncentive))}</span>
              </li>
              <li className="flex justify-between gap-2">
                <span>{language === "fr" ? "ITC fédéral (30%):" : "Federal ITC (30%):"}</span>
                <span className="font-mono">{formatCurrency(Math.round(providerEconomics.itc))}</span>
              </li>
              <li className="flex justify-between gap-2">
                <span>{language === "fr" ? "Bouclier CCA (est.):" : "CCA Shield (est.):"}</span>
                <span className="font-mono">{formatCurrency(Math.round(providerEconomics.ccaShield))}</span>
              </li>
              <li className="flex justify-between gap-2 font-semibold border-t border-amber-300 dark:border-amber-700 pt-1 mt-1">
                <span>{language === "fr" ? "Total incitatifs:" : "Total incentives:"}</span>
                <span className="font-mono">{formatCurrency(Math.round(providerEconomics.totalIncentives))}</span>
              </li>
            </ul>
          </div>
          
          <div>
            <p className="font-medium text-amber-700 dark:text-amber-400 mb-2">
              {language === "fr" ? "Économique pour le fournisseur:" : "Provider economics:"}
            </p>
            <ul className="space-y-1 text-amber-900 dark:text-amber-200">
              <li className="flex justify-between gap-2">
                <span>{language === "fr" ? "Coût brut:" : "Gross cost:"}</span>
                <span className="font-mono">{formatCurrency(providerEconomics.grossCost)}</span>
              </li>
              <li className="flex justify-between gap-2">
                <span>{language === "fr" ? "- Incitatifs:" : "- Incentives:"}</span>
                <span className="font-mono text-green-600">-{formatCurrency(Math.round(providerEconomics.totalIncentives))}</span>
              </li>
              <li className="flex justify-between gap-2 font-semibold border-t border-amber-300 dark:border-amber-700 pt-1 mt-1">
                <span>{language === "fr" ? "Investissement réel:" : "Actual investment:"}</span>
                <span className="font-mono">{formatCurrency(Math.round(providerEconomics.actualInvestment))}</span>
              </li>
            </ul>
          </div>
        </div>
        
        <p className="mt-3 text-xs text-amber-800 dark:text-amber-300 italic">
          {language === "fr" 
            ? "Le fournisseur PPA utilise les incitatifs gouvernementaux pour financer le système. Le client obtient de l'électricité à rabais, mais renonce aux avantages fiscaux." 
            : "The PPA provider uses government incentives to fund the system. The client gets discounted electricity but gives up the tax benefits."}
        </p>
      </div>

      <div className="mt-4 p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
        <h6 className="text-sm font-semibold mb-2 flex items-center gap-2 text-green-800 dark:text-green-300">
          <CircleCheck className="w-4 h-4" />
          {language === "fr" ? "Avantage kWh Québec" : "kWh Québec Advantage"}
        </h6>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="text-center p-2 bg-white dark:bg-background rounded border" data-testid={`card-savings-advantage-${proposal.id}`}>
            <p className="text-2xl font-bold text-green-600">
              +{formatCurrency(Math.round(cash.totalSavings - ppa.totalSavings))}
            </p>
            <p className="text-xs text-muted-foreground">
              {language === "fr" ? "Économies additionnelles (Cash vs PPA)" : "Additional savings (Cash vs PPA)"}
            </p>
          </div>
          <div className="text-center p-2 bg-white dark:bg-background rounded border" data-testid={`card-avg-savings-${proposal.id}`}>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(Math.round(cash.avgAnnualSavings))}/an
            </p>
            <p className="text-xs text-muted-foreground">
              {language === "fr" ? "Économies annuelles moyennes (Cash)" : "Average annual savings (Cash)"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

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

  const [isDocumentDialogOpen, setIsDocumentDialogOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<MarketDocument | null>(null);
  const [deleteDocumentId, setDeleteDocumentId] = useState<string | null>(null);

  const [isProposalDialogOpen, setIsProposalDialogOpen] = useState(false);
  const [editingProposal, setEditingProposal] = useState<CompetitorProposalAnalysis | null>(null);
  const [deleteProposalId, setDeleteProposalId] = useState<string | null>(null);
  const [copiedProposalId, setCopiedProposalId] = useState<string | null>(null);

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

  const { data: marketDocuments = [], isLoading: documentsLoading } = useQuery<MarketDocument[]>({
    queryKey: ["/api/admin/market-documents"],
    enabled: isAdmin,
  });

  const { data: proposalAnalyses = [], isLoading: proposalsLoading } = useQuery<CompetitorProposalAnalysis[]>({
    queryKey: ["/api/market-intelligence/proposal-analyses"],
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

  const documentForm = useForm<DocumentForm>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      title: "",
      entityType: "competitor",
      competitorId: "",
      documentType: "proposal",
      fileName: "",
      fileUrl: "",
      description: "",
      tags: "",
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

  const createDocumentMutation = useMutation({
    mutationFn: (data: DocumentForm) => apiRequest("POST", "/api/admin/market-documents", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/market-documents"] });
      setIsDocumentDialogOpen(false);
      documentForm.reset();
      toast({ title: language === "fr" ? "Document ajouté" : "Document added" });
    },
  });

  const updateDocumentMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DocumentForm> }) => 
      apiRequest("PATCH", `/api/admin/market-documents/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/market-documents"] });
      setIsDocumentDialogOpen(false);
      setEditingDocument(null);
      documentForm.reset();
      toast({ title: language === "fr" ? "Document modifié" : "Document updated" });
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/market-documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/market-documents"] });
      setDeleteDocumentId(null);
      toast({ title: language === "fr" ? "Document supprimé" : "Document deleted" });
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

  const openEditDocument = (doc: MarketDocument) => {
    setEditingDocument(doc);
    documentForm.reset({
      title: doc.title,
      entityType: doc.entityType,
      competitorId: doc.entityId || "",
      documentType: doc.documentType,
      fileName: doc.fileName,
      fileUrl: doc.fileUrl || "",
      description: doc.description || "",
      tags: doc.tags ? doc.tags.join(", ") : "",
    });
    setIsDocumentDialogOpen(true);
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

  const getEntityTypeBadge = (entityType: string) => {
    const colors: Record<string, string> = {
      competitor: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      supplier: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      partner: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      hydro_quebec: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
      government: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      internal: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
    };
    const labels: Record<string, string> = {
      competitor: language === "fr" ? "Concurrent" : "Competitor",
      supplier: language === "fr" ? "Fournisseur" : "Supplier",
      partner: language === "fr" ? "Partenaire" : "Partner",
      hydro_quebec: "Hydro-Québec",
      government: language === "fr" ? "Gouvernement" : "Government",
      internal: language === "fr" ? "Interne" : "Internal",
    };
    return <Badge className={colors[entityType] || colors.internal}>{labels[entityType] || entityType}</Badge>;
  };

  const getDocumentTypeBadge = (docType: string) => {
    const colors: Record<string, string> = {
      proposal: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
      pricing: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      analysis: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
      specification: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
      presentation: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
      other: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
    };
    const labels: Record<string, string> = {
      proposal: language === "fr" ? "Proposition" : "Proposal",
      pricing: language === "fr" ? "Tarification" : "Pricing",
      analysis: language === "fr" ? "Analyse" : "Analysis",
      specification: language === "fr" ? "Spécification" : "Specification",
      presentation: language === "fr" ? "Présentation" : "Presentation",
      other: language === "fr" ? "Autre" : "Other",
    };
    return <Badge className={colors[docType] || colors.other}>{labels[docType] || docType}</Badge>;
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
        <TabsList className="grid w-full grid-cols-5">
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
          <TabsTrigger value="documents" data-testid="tab-documents">
            <FileArchive className="w-4 h-4 mr-2" />
            {language === "fr" ? "Documents" : "Documents"}
          </TabsTrigger>
          <TabsTrigger value="proposals" data-testid="tab-proposals">
            <Scale className="w-4 h-4 mr-2" />
            {language === "fr" ? "Analyses de propositions" : "Proposal Analyses"}
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
                          <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                            <div className="flex items-center gap-2 text-sm font-medium mb-1 text-red-700 dark:text-red-300">
                              <Scale className="w-4 h-4" />
                              {language === "fr" ? "Notes légales" : "Legal Notes"}
                            </div>
                            <p className="text-sm text-red-600 dark:text-red-400">
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
                      <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                        <div className="text-sm font-medium mb-1 text-green-700 dark:text-green-300">
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

        <TabsContent value="documents" className="space-y-4">
          <div className="flex justify-end">
            <Button 
              onClick={() => {
                setEditingDocument(null);
                documentForm.reset();
                setIsDocumentDialogOpen(true);
              }}
              data-testid="button-add-document"
            >
              <Plus className="w-4 h-4 mr-2" />
              {language === "fr" ? "Ajouter un document" : "Add Document"}
            </Button>
          </div>

          {documentsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
            </div>
          ) : marketDocuments.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {language === "fr" 
                  ? "Aucun document. Ajoutez des propositions concurrentes, analyses ou spécifications."
                  : "No documents. Add competitor proposals, analyses, or specifications."}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {marketDocuments.map(doc => (
                <Card key={doc.id} data-testid={`card-document-${doc.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {getEntityTypeBadge(doc.entityType)}
                          {getDocumentTypeBadge(doc.documentType)}
                        </div>
                        <CardTitle className="text-base">{doc.title}</CardTitle>
                        {doc.entityName && (
                          <p className="text-sm text-muted-foreground">{doc.entityName}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {doc.fileUrl && (
                          <Button 
                            size="icon" 
                            variant="ghost"
                            asChild
                          >
                            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </Button>
                        )}
                        <Button 
                          size="icon" 
                          variant="ghost"
                          onClick={() => openEditDocument(doc)}
                          data-testid={`button-edit-document-${doc.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost"
                          onClick={() => setDeleteDocumentId(doc.id)}
                          data-testid={`button-delete-document-${doc.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {doc.description && (
                      <p className="text-sm whitespace-pre-wrap mb-2">{doc.description}</p>
                    )}
                    {doc.tags && doc.tags.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Tag className="w-3 h-3 text-muted-foreground" />
                        {doc.tags.map((tag, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">{doc.fileName}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="proposals" className="space-y-4">
          {proposalsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
            </div>
          ) : proposalAnalyses.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {language === "fr" 
                  ? "Aucune analyse de proposition. Les analyses seront ajoutées ici."
                  : "No proposal analyses. Analyses will be added here."}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {proposalAnalyses.map(proposal => {
                const competitor = competitorsList.find(c => c.id === proposal.competitorId);
                const getStatusBadge = (status: string | null) => {
                  const colors: Record<string, string> = {
                    active: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
                    won: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
                    lost: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
                    archived: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
                  };
                  const labels: Record<string, string> = {
                    active: language === "fr" ? "Actif" : "Active",
                    won: language === "fr" ? "Gagné" : "Won",
                    lost: language === "fr" ? "Perdu" : "Lost",
                    archived: language === "fr" ? "Archivé" : "Archived",
                  };
                  return <Badge className={colors[status || "active"] || colors.active}>{labels[status || "active"] || status}</Badge>;
                };

                const formatPercent = (value: number | null) => {
                  if (value === null || value === undefined) return "—";
                  const percent = value * 100;
                  // Use more precision for small values to avoid showing 0.0% when it's 0.02%
                  if (Math.abs(percent) < 0.1 && percent !== 0) {
                    return `${percent.toFixed(2)}%`;
                  }
                  return `${percent.toFixed(1)}%`;
                };

                const formatCurrency = (value: number | null) => {
                  if (value === null || value === undefined) return "—";
                  return new Intl.NumberFormat(language === "fr" ? "fr-CA" : "en-CA", {
                    style: "currency",
                    currency: "CAD",
                    maximumFractionDigits: 0,
                  }).format(value);
                };

                return (
                  <Card key={proposal.id} data-testid={`card-proposal-${proposal.id}`} className="overflow-hidden">
                    {/* HERO: Big advantage number - always visible */}
                    <div 
                      className={`p-6 text-white ${
                        proposal.totalAdvantageKwh && proposal.totalAdvantageKwh > 0
                          ? "bg-gradient-to-r from-green-600 to-green-700 dark:from-green-700 dark:to-green-800"
                          : "bg-gradient-to-r from-slate-500 to-slate-600 dark:from-slate-600 dark:to-slate-700"
                      }`} 
                      data-testid={`text-proposal-advantage-${proposal.id}`}
                    >
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div>
                          <p className="text-white/80 text-sm mb-1">
                            {language === "fr" ? "Votre avantage avec kWh Québec" : "Your advantage with kWh Québec"}
                          </p>
                          <p className="text-4xl font-bold tracking-tight">
                            {proposal.totalAdvantageKwh && proposal.totalAdvantageKwh > 0
                              ? formatCurrency(proposal.totalAdvantageKwh)
                              : language === "fr" ? "Analyse en cours..." : "Analysis pending..."}
                          </p>
                          <p className="text-white/80 text-sm mt-1">
                            {proposal.totalAdvantageKwh && proposal.totalAdvantageKwh > 0
                              ? `${language === "fr" ? "d'économies sur 25 ans vs" : "in savings over 25 years vs"} ${competitor?.name || "concurrent"}`
                              : language === "fr" ? "Données en attente" : "Awaiting data"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 print:hidden">
                          <Button 
                            size="icon" 
                            variant="secondary"
                            className="bg-white/20 hover:bg-white/30 text-white border-0"
                            onClick={() => {
                              setEditingProposal(proposal);
                              setIsProposalDialogOpen(true);
                            }}
                            data-testid={`button-edit-proposal-${proposal.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="secondary"
                            className="bg-white/20 hover:bg-white/30 text-white border-0"
                            onClick={() => setDeleteProposalId(proposal.id)}
                            data-testid={`button-delete-proposal-${proposal.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {competitor && (
                          <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                            vs {competitor.name}
                          </Badge>
                        )}
                        {getStatusBadge(proposal.status)}
                        {proposal.dealType === "ppa" && (
                          <Badge variant="outline" className="text-purple-600 border-purple-300">
                            PPA {proposal.ppaTerm} {language === "fr" ? "ans" : "years"}
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-lg" data-testid={`text-proposal-name-${proposal.id}`}>
                        {proposal.projectName}
                      </CardTitle>
                      <div className="text-sm text-muted-foreground">
                        <span data-testid={`text-proposal-client-${proposal.id}`}>
                          {proposal.clientName}
                        </span>
                        {proposal.tenantName && <span> | {proposal.tenantName}</span>}
                        {proposal.projectAddress && <span> | {proposal.projectAddress}</span>}
                      </div>
                      <div className="flex items-center gap-4 text-sm mt-2">
                        {proposal.systemSizeKW && (
                          <span className="flex items-center gap-1">
                            <Target className="w-3 h-3" />
                            {proposal.systemSizeKW.toLocaleString()} kW
                          </span>
                        )}
                        {proposal.projectCostTotal && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            {formatCurrency(proposal.projectCostTotal)}
                          </span>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-6">
                      {/* Section 1: Visual assumption cards */}
                      <div>
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-orange-500" />
                          {language === "fr" ? "Pourquoi leurs projections sont trompeuses" : "Why their projections are misleading"}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid={`cards-assumptions-${proposal.id}`}>
                          {/* Inflation card - only show if data exists */}
                          {proposal.inflationDiff25Years && proposal.inflationDiff25Years > 0 && (
                            <div className="p-3 rounded-lg border bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
                              <div className="flex items-start gap-3">
                                <div className="p-2 rounded-full bg-red-100 dark:bg-red-900">
                                  <TrendingUp className="w-4 h-4 text-red-600 dark:text-red-400" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-sm">Inflation HQ</span>
                                    <span className="text-green-600 dark:text-green-400 font-semibold text-sm">
                                      +{formatCurrency(proposal.inflationDiff25Years)}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {language === "fr" 
                                      ? `${competitor?.name || "Concurrent"} utilise ${formatPercent(proposal.compInflationRate)}. La réalité: ${formatPercent(proposal.kwhInflationRate)}`
                                      : `${competitor?.name || "Competitor"} uses ${formatPercent(proposal.compInflationRate)}. Reality: ${formatPercent(proposal.kwhInflationRate)}`}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Degradation card - only show if data exists */}
                          {proposal.degradationDiffValue && proposal.degradationDiffValue > 0 && (
                            <div className="p-3 rounded-lg border bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
                              <div className="flex items-start gap-3">
                                <div className="p-2 rounded-full bg-red-100 dark:bg-red-900">
                                  <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-sm">{language === "fr" ? "Dégradation panneaux" : "Panel degradation"}</span>
                                    <span className="text-green-600 dark:text-green-400 font-semibold text-sm">
                                      +{formatCurrency(proposal.degradationDiffValue)}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {language === "fr"
                                      ? `Ils promettent ${formatPercent(proposal.compDegradationRate)}/an. L'industrie: ${formatPercent(proposal.kwhDegradationRate)}/an`
                                      : `They promise ${formatPercent(proposal.compDegradationRate)}/yr. Industry: ${formatPercent(proposal.kwhDegradationRate)}/yr`}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* O&M card - only show if data exists */}
                          {proposal.omDiff && proposal.omDiff > 0 && (
                            <div className="p-3 rounded-lg border bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
                              <div className="flex items-start gap-3">
                                <div className="p-2 rounded-full bg-red-100 dark:bg-red-900">
                                  <Wrench className="w-4 h-4 text-red-600 dark:text-red-400" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-sm">O&M {language === "fr" ? `après ${proposal.compOmStartYear || 16} ans` : `after year ${proposal.compOmStartYear || 16}`}</span>
                                    <span className="text-green-600 dark:text-green-400 font-semibold text-sm">
                                      +{formatCurrency(proposal.omDiff)}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {language === "fr"
                                      ? `Ils facturent ${formatPercent(proposal.compOmCostPercent)}. Le marché: ${formatPercent(proposal.kwhOmCostPercent)}`
                                      : `They charge ${formatPercent(proposal.compOmCostPercent)}. Market rate: ${formatPercent(proposal.kwhOmCostPercent)}`}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Construction card - calculate dynamically from $/W prices */}
                          {(() => {
                            const kwhPrice = proposal.kwhCostPerWatt || 2.15;
                            const compPrice = proposal.costPerWatt || 0;
                            const systemW = (proposal.systemSizeKW || 0) * 1000;
                            const constructionSavings = compPrice > kwhPrice ? (compPrice - kwhPrice) * systemW : 0;
                            
                            if (constructionSavings <= 0) return null;
                            
                            return (
                              <div className="p-3 rounded-lg border bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
                                <div className="flex items-start gap-3">
                                  <div className="p-2 rounded-full bg-green-100 dark:bg-green-900">
                                    <Hammer className="w-4 h-4 text-green-600 dark:text-green-400" />
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium text-sm">Construction</span>
                                      <span className="text-green-600 dark:text-green-400 font-semibold text-sm">
                                        +{formatCurrency(constructionSavings)}
                                      </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {language === "fr"
                                        ? `kWh: $${kwhPrice.toFixed(2)}/W vs ${competitor?.name || "concurrent"}: $${compPrice.toFixed(2)}/W`
                                        : `kWh: $${kwhPrice.toFixed(2)}/W vs ${competitor?.name || "competitor"}: $${compPrice.toFixed(2)}/W`}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Overproduction Billing Risk card - PPA only */}
                          {proposal.dealType === "ppa" && (
                            <div className="p-3 rounded-lg border bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
                              <div className="flex items-start gap-3">
                                <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900">
                                  <FileQuestion className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-sm">
                                      {language === "fr" ? "Facturation surproduction" : "Overproduction Billing"}
                                    </span>
                                    {proposal.billingModel === "production" ? (
                                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300 dark:bg-red-900 dark:text-red-300 dark:border-red-700">
                                        {language === "fr" ? "100% prod." : "100% prod."}
                                      </Badge>
                                    ) : proposal.billingModel === "consumption" ? (
                                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 dark:bg-green-900 dark:text-green-300 dark:border-green-700">
                                        {language === "fr" ? "Conso. seulement" : "Consumption only"}
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-900 dark:text-amber-300 dark:border-amber-700">
                                        {language === "fr" ? "À clarifier" : "To clarify"}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {language === "fr"
                                      ? proposal.billingModel === "production"
                                        ? `Client paie 100% de la production, même les surplus exportés à HQ. Risque: ${proposal.overproductionRiskValue ? formatCurrency(proposal.overproductionRiskValue) + "/an" : "à calculer"}`
                                        : proposal.billingModel === "consumption"
                                        ? "Client paie seulement l'énergie autoconsommée"
                                        : "Demandez: Payez-vous 100% de la production ou seulement ce que vous consommez?"
                                      : proposal.billingModel === "production"
                                        ? `Client pays for 100% of production, even surplus exported to HQ. Risk: ${proposal.overproductionRiskValue ? formatCurrency(proposal.overproductionRiskValue) + "/yr" : "to calculate"}`
                                        : proposal.billingModel === "consumption"
                                        ? "Client pays only for self-consumed energy"
                                        : "Ask: Do you pay for 100% of production or only what you consume?"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Section 1.5: Questions to Clarify */}
                      {proposal.dealType === "ppa" && (
                        <div className="p-4 bg-amber-50/30 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
                          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-amber-700 dark:text-amber-400">
                            <HelpCircle className="w-4 h-4" />
                            {language === "fr" ? "Questions à clarifier avec le client" : "Questions to Clarify with Client"}
                          </h4>
                          <ul className="space-y-2 text-sm">
                            {(!proposal.billingModel || proposal.billingModel === "unknown") && (
                              <li className="flex items-start gap-2">
                                <span className="text-amber-600 dark:text-amber-400 mt-0.5">•</span>
                                <span>
                                  {language === "fr"
                                    ? `"Avec ${competitor?.name || "votre fournisseur"}, payez-vous pour 100% de l'électricité produite, ou seulement ce que vous consommez?"`
                                    : `"With ${competitor?.name || "your provider"}, do you pay for 100% of electricity produced, or only what you consume?"`}
                                </span>
                              </li>
                            )}
                            <li className="flex items-start gap-2">
                              <span className="text-amber-600 dark:text-amber-400 mt-0.5">•</span>
                              <span>
                                {language === "fr"
                                  ? `"Qui garde les crédits de surplus accumulés après 24 mois (compensation Hydro-Québec à 4.54¢/kWh)?"`
                                  : `"Who keeps the surplus credits accumulated after 24 months (Hydro-Québec compensation at 4.54¢/kWh)?"`}
                              </span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-amber-600 dark:text-amber-400 mt-0.5">•</span>
                              <span>
                                {language === "fr"
                                  ? `"Après ${proposal.ppaTerm || 16} ans, le système sera-t-il vraiment gratuit ou y a-t-il des frais de transfert?"`
                                  : `"After ${proposal.ppaTerm || 16} years, will the system truly be free or are there transfer fees?"`}
                              </span>
                            </li>
                          </ul>
                        </div>
                      )}

                      {/* Section 2: Financing comparison */}
                      <div className="p-4 bg-muted/30 rounded-lg border">
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <Banknote className="w-4 h-4 text-primary" />
                          {language === "fr" ? '"Mais le PPA me coûte 0$ CAPEX!"' : '"But PPA costs me $0 CAPEX!"'}
                        </h4>
                        <p className="text-sm text-muted-foreground mb-4">
                          {language === "fr" 
                            ? "Le crédit-bail aussi! Et vous gardez tous les avantages:"
                            : "So does a capital lease! And you keep all the benefits:"}
                        </p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left py-2 pr-2 font-medium"></th>
                                <th className="text-center py-2 px-2 font-medium text-orange-600">
                                  <div className="flex flex-col items-center gap-1">
                                    <CreditCard className="w-4 h-4" />
                                    <span>PPA</span>
                                  </div>
                                </th>
                                <th className="text-center py-2 px-2 font-medium text-primary">
                                  <div className="flex flex-col items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    <span>{language === "fr" ? "Crédit-bail" : "Lease"}</span>
                                  </div>
                                </th>
                                <th className="text-center py-2 px-2 font-medium text-green-600">
                                  <div className="flex flex-col items-center gap-1">
                                    <Banknote className="w-4 h-4" />
                                    <span>Cash</span>
                                  </div>
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="border-b border-muted">
                                <td className="py-2 pr-2">{language === "fr" ? "CAPEX initial" : "Upfront CAPEX"}</td>
                                <td className="text-center py-2 px-2">
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">0$</Badge>
                                </td>
                                <td className="text-center py-2 px-2">
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">0$</Badge>
                                </td>
                                <td className="text-center py-2 px-2 text-sm">
                                  {proposal.projectCostTotal && proposal.systemSizeKW
                                    ? (() => {
                                        const hqIncentive = Math.min((proposal.systemSizeKW || 0) * 1000, proposal.projectCostTotal * 0.4);
                                        const netCost = Math.max(0, proposal.projectCostTotal - hqIncentive);
                                        return `~${formatCurrency(Math.round(netCost * 0.7))}*`;
                                      })()
                                    : "—"}
                                </td>
                              </tr>
                              <tr className="border-b border-muted">
                                <td className="py-2 pr-2">{language === "fr" ? "Propriété" : "Ownership"}</td>
                                <td className="text-center py-2 px-2">
                                  <CircleX className="w-4 h-4 text-red-500 mx-auto" />
                                </td>
                                <td className="text-center py-2 px-2">
                                  <CircleCheck className="w-4 h-4 text-green-500 mx-auto" />
                                </td>
                                <td className="text-center py-2 px-2">
                                  <CircleCheck className="w-4 h-4 text-green-500 mx-auto" />
                                </td>
                              </tr>
                              <tr className="border-b border-muted">
                                <td className="py-2 pr-2">{language === "fr" ? "Incitatif Hydro-Québec ($1,000/kW)" : "Hydro-Québec Incentive ($1,000/kW)"}</td>
                                <td className="text-center py-2 px-2">
                                  <span className="text-xs text-muted-foreground">{language === "fr" ? "TRC garde" : "TRC keeps"}</span>
                                </td>
                                <td className="text-center py-2 px-2">
                                  <CircleCheck className="w-4 h-4 text-green-500 mx-auto" />
                                </td>
                                <td className="text-center py-2 px-2">
                                  <CircleCheck className="w-4 h-4 text-green-500 mx-auto" />
                                </td>
                              </tr>
                              <tr className="border-b border-muted">
                                <td className="py-2 pr-2">{language === "fr" ? "Bouclier fiscal (CCA)" : "Tax Shield (CCA)"}</td>
                                <td className="text-center py-2 px-2">
                                  <CircleX className="w-4 h-4 text-red-500 mx-auto" />
                                </td>
                                <td className="text-center py-2 px-2">
                                  <CircleCheck className="w-4 h-4 text-green-500 mx-auto" />
                                </td>
                                <td className="text-center py-2 px-2">
                                  <CircleCheck className="w-4 h-4 text-green-500 mx-auto" />
                                </td>
                              </tr>
                              <tr>
                                <td className="py-2 pr-2">{language === "fr" ? "Coût total 25 ans" : "25-year total cost"}</td>
                                <td className="text-center py-2 px-2 text-red-600 font-semibold">
                                  {proposal.totalAdvantageKwh && proposal.totalAdvantageKwh > 0
                                    ? `+${formatCurrency(Math.round(proposal.totalAdvantageKwh / 100000) * 100000)}`
                                    : "—"}
                                </td>
                                <td className="text-center py-2 px-2 text-green-600 font-semibold">
                                  {language === "fr" ? "Optimal" : "Optimal"}
                                </td>
                                <td className="text-center py-2 px-2 text-green-600 font-semibold">
                                  {language === "fr" ? "Meilleur" : "Best"}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          *{language === "fr" 
                            ? "CAPEX estimé: coût − incitatif Hydro-Québec (min $1000/kW ou 40%) × 70% après ITC fédéral. Le graphique inclut le bouclier fiscal CCA (Classe 43.2, 50% dégressif, taux 26.5%)." 
                            : "Estimated CAPEX: cost − Hydro-Québec incentive (min $1000/kW or 40%) × 70% after federal ITC. Chart includes CCA tax shield (Class 43.2, 50% declining, 26.5% rate)."}
                        </p>

                        {/* Cashflow comparison chart */}
                        {proposal.projectCostTotal && proposal.systemSizeKW && (
                          <div className="mt-4 pt-4 border-t">
                            <h5 className="text-sm font-medium mb-3 flex items-center gap-2">
                              <TrendingUp className="w-4 h-4 text-primary" />
                              {language === "fr" ? "Flux de trésorerie cumulés sur 30 ans" : "Cumulative Cashflow over 30 years"}
                            </h5>
                            <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                  data={(() => {
                                    const projectCost = proposal.projectCostTotal || 0;
                                    const systemKW = proposal.systemSizeKW || 0;
                                    const hqIncentive = Math.min(systemKW * 1000, projectCost * 0.4);
                                    const netCostAfterHQ = projectCost - hqIncentive;
                                    const cashCapex = netCostAfterHQ * 0.7; // After 30% ITC
                                    const annualProduction = systemKW * 1200;
                                    
                                    // Use TRC's actual data
                                    const compElecRate = proposal.compElecRate || 0.12; // TRC's grid rate assumption
                                    const ppaDiscountPercent = proposal.ppaDiscountPercent || 40; // TRC's discount
                                    const ppaRate = compElecRate * (1 - ppaDiscountPercent / 100); // Calculate actual PPA rate
                                    const ppaTerm = proposal.ppaTerm || 16; // TRC's 16-year term
                                    const realInflationRate = proposal.kwhInflationRate || 0.035; // HQ tariff inflation (3.5%)
                                    
                                    const leasePayment = cashCapex / 7 * 1.15; // 7-year lease with interest
                                    
                                    // CCA Tax Shield (Class 43.2: 50% declining balance)
                                    const ccaRate = 0.50; // Class 43.2 for clean energy
                                    const taxRate = 0.265; // Quebec combined: 15% fed + 11.5% prov
                                    const ccaBase = cashCapex; // Depreciable amount after incentives
                                    
                                    // Pre-calculate annual CCA benefits for ownership scenarios
                                    const ccaBenefits: { cash: number; lease: number }[] = [];
                                    let uccCash = ccaBase;
                                    let uccLease = ccaBase;
                                    const leaseOwnershipYear = 8; // Year when lease ownership transfers
                                    
                                    for (let y = 1; y <= 30; y++) {
                                      // Half-year rule: applies to FIRST year of CCA claim for each scenario
                                      const cashEffectiveRate = y === 1 ? ccaRate * 0.5 : ccaRate;
                                      const leaseEffectiveRate = y === leaseOwnershipYear ? ccaRate * 0.5 : ccaRate;
                                      
                                      // Cash: CCA from year 1
                                      const ccaDeductionCash = uccCash * cashEffectiveRate;
                                      
                                      // Lease: CCA only after ownership (year 8+), with half-year rule on first claim
                                      const ccaDeductionLease = y < leaseOwnershipYear ? 0 : uccLease * leaseEffectiveRate;
                                      
                                      ccaBenefits.push({
                                        cash: ccaDeductionCash * taxRate,
                                        lease: ccaDeductionLease * taxRate
                                      });
                                      
                                      uccCash -= ccaDeductionCash;
                                      if (y >= leaseOwnershipYear) uccLease -= ccaDeductionLease;
                                    }
                                    
                                    const data = [];
                                    let ppaCumulative = 0;
                                    let leaseCumulative = 0;
                                    let cashCumulative = -cashCapex;
                                    
                                    for (let year = 0; year <= 30; year++) {
                                      if (year === 0) {
                                        data.push({
                                          year,
                                          ppa: 0,
                                          lease: 0,
                                          cash: Math.round(cashCumulative / 100000) / 10,
                                        });
                                        continue;
                                      }
                                      
                                      // Real grid rate with actual HQ inflation
                                      const realGridRate = compElecRate * Math.pow(1 + realInflationRate, year);
                                      const annualGridCost = annualProduction * realGridRate;
                                      
                                      // Get CCA tax shield for this year (ownership benefits)
                                      const ccaBenefit = ccaBenefits[year - 1] as { cash: number; lease: number };
                                      
                                      // PPA: Fixed rate for ppaTerm years (TRC's terms) - NO TAX BENEFITS during term
                                      if (year <= ppaTerm) {
                                        // During PPA: savings = grid cost - PPA payment (escalates 2%/year typically)
                                        const ppaAnnualCost = annualProduction * ppaRate * Math.pow(1.02, year - 1);
                                        ppaCumulative += (annualGridCost - ppaAnnualCost);
                                      } else {
                                        // After PPA ends (year 17+): client OWNS the system for $1
                                        // Full solar savings minus O&M costs (TRC: 7% of solar value)
                                        const omCostPercent = 0.07; // TRC charges 7% of annual solar value for O&M
                                        const solarValue = annualGridCost; // Solar value = avoided grid cost
                                        const omCost = solarValue * omCostPercent;
                                        ppaCumulative += (solarValue - omCost); // Net savings after O&M
                                      }
                                      
                                      // Credit-lease: 7-year payments then free solar + CCA benefits after ownership
                                      if (year <= 7) {
                                        leaseCumulative += (annualGridCost - leasePayment);
                                      } else {
                                        leaseCumulative += annualGridCost + ccaBenefit.lease;
                                      }
                                      
                                      // Cash: Own the system from day 1, all savings + CCA tax shield
                                      cashCumulative += annualGridCost + ccaBenefit.cash;
                                      
                                      data.push({
                                        year,
                                        ppa: Math.round(ppaCumulative / 100000) / 10,
                                        lease: Math.round(leaseCumulative / 100000) / 10,
                                        cash: Math.round(cashCumulative / 100000) / 10,
                                      });
                                    }
                                    return data;
                                  })()}
                                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                  <XAxis 
                                    dataKey="year" 
                                    tick={{ fontSize: 11 }}
                                    label={{ value: language === "fr" ? "Année" : "Year", position: "insideBottomRight", offset: -5, fontSize: 11 }}
                                  />
                                  <YAxis 
                                    tick={{ fontSize: 11 }}
                                    tickFormatter={(value) => `${value}M$`}
                                    label={{ value: language === "fr" ? "$ cumulés (M$)" : "Cumulative ($M)", angle: -90, position: "insideLeft", fontSize: 11 }}
                                  />
                                  <Tooltip 
                                    formatter={(value: number) => [`${value.toFixed(1)}M$`, ""]}
                                    labelFormatter={(label) => `${language === "fr" ? "Année" : "Year"} ${label}`}
                                    contentStyle={{ 
                                      backgroundColor: 'hsl(var(--background))', 
                                      border: '1px solid hsl(var(--border))',
                                      borderRadius: '8px',
                                      fontSize: '12px'
                                    }}
                                  />
                                  <Legend 
                                    wrapperStyle={{ fontSize: '12px' }}
                                    formatter={(value) => {
                                      const labels: Record<string, string> = {
                                        ppa: "PPA",
                                        lease: language === "fr" ? "Crédit-bail" : "Credit Lease",
                                        cash: language === "fr" ? "Comptant" : "Cash"
                                      };
                                      return labels[value] || value;
                                    }}
                                  />
                                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                                  <Line 
                                    type="monotone" 
                                    dataKey="ppa" 
                                    stroke="#DC2626" 
                                    strokeWidth={2}
                                    dot={false}
                                  />
                                  <Line 
                                    type="monotone" 
                                    dataKey="lease" 
                                    stroke="#22c55e" 
                                    strokeWidth={2}
                                    dot={false}
                                  />
                                  <Line 
                                    type="monotone" 
                                    dataKey="cash" 
                                    stroke="#3b82f6" 
                                    strokeWidth={2}
                                    dot={false}
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2 text-center">
                              {language === "fr" 
                                ? "Comptant devient plus avantageux après le remboursement initial (~7-10 ans)"
                                : "Cash becomes more advantageous after initial payback (~7-10 years)"}
                            </p>
                          </div>
                        )}

                        {/* Financing Comparison Section */}
                        {proposal.projectCostTotal && proposal.systemSizeKW && (
                          <div className="mt-6 pt-4 border-t" data-testid={`section-financing-comparison-${proposal.id}`}>
                            <h5 className="text-sm font-medium mb-3 flex items-center gap-2">
                              <TrendingUp className="w-4 h-4 text-primary" />
                              {language === "fr" ? "Comparaison des options d'acquisition" : "Acquisition Options Comparison"}
                            </h5>
                            
                            <FinancingComparisonSection
                              proposal={proposal}
                              competitorName={competitor?.name || "TRC"}
                              language={language}
                              formatCurrency={formatCurrency}
                            />
                          </div>
                        )}
                      </div>

                      {/* Section 3: Key findings */}
                      {proposal.keyFindings && proposal.keyFindings.length > 0 && (
                        <div data-testid={`list-findings-${proposal.id}`}>
                          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-primary" />
                            {language === "fr" ? "Points à mentionner au client" : "Key points for the client"}
                          </h4>
                          <ul className="space-y-2">
                            {proposal.keyFindings.map((finding, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-sm">
                                <CircleCheck className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>{finding}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-4 border-t print:hidden">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            window.print();
                          }}
                          data-testid={`button-print-proposal-${proposal.id}`}
                        >
                          <Printer className="w-4 h-4 mr-2" />
                          {language === "fr" ? "Imprimer" : "Print"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const subject = encodeURIComponent(
                              language === "fr" 
                                ? `Analyse comparative: ${proposal.projectName}` 
                                : `Comparative Analysis: ${proposal.projectName}`
                            );
                            // Calculate construction savings dynamically
                            const kwhPrice = proposal.kwhCostPerWatt || 2.15;
                            const compPrice = proposal.costPerWatt || 0;
                            const systemW = (proposal.systemSizeKW || 0) * 1000;
                            const constructionSavings = compPrice > kwhPrice ? (compPrice - kwhPrice) * systemW : 0;
                            
                            const body = encodeURIComponent(
                              `${language === "fr" ? "Projet" : "Project"}: ${proposal.projectName}\n` +
                              `${language === "fr" ? "Client" : "Client"}: ${proposal.clientName}\n` +
                              `${language === "fr" ? "Concurrent" : "Competitor"}: ${competitor?.name || "N/A"}\n\n` +
                              `${language === "fr" ? "Avantage kWh Québec" : "kWh Québec Advantage"}: ${formatCurrency(proposal.totalAdvantageKwh)}\n\n` +
                              `${language === "fr" ? "Hypothèses comparées" : "Compared Assumptions"}:\n` +
                              `- Inflation: ${formatPercent(proposal.compInflationRate)} vs ${formatPercent(proposal.kwhInflationRate)} (${formatCurrency(proposal.inflationDiff25Years)})\n` +
                              `- ${language === "fr" ? "Dégradation" : "Degradation"}: ${formatPercent(proposal.compDegradationRate)} vs ${formatPercent(proposal.kwhDegradationRate)} (${formatCurrency(proposal.degradationDiffValue)})\n` +
                              `- O&M: ${formatPercent(proposal.compOmCostPercent)} vs ${formatPercent(proposal.kwhOmCostPercent)} (${formatCurrency(proposal.omDiff)})\n` +
                              (constructionSavings > 0 ? `- Construction: ${formatCurrency(constructionSavings)}\n` : "") +
                              `\n${language === "fr" ? "Points clés" : "Key Findings"}:\n` +
                              (proposal.keyFindings?.map(f => `• ${f}`).join("\n") || "")
                            );
                            window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
                          }}
                          data-testid={`button-email-proposal-${proposal.id}`}
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          {language === "fr" ? "Envoyer par email" : "Email"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            // Calculate construction savings dynamically
                            const kwhPrice = proposal.kwhCostPerWatt || 2.15;
                            const compPrice = proposal.costPerWatt || 0;
                            const systemW = (proposal.systemSizeKW || 0) * 1000;
                            const constructionSavings = compPrice > kwhPrice ? (compPrice - kwhPrice) * systemW : 0;
                            
                            const text = 
                              `${language === "fr" ? "Projet" : "Project"}: ${proposal.projectName}\n` +
                              `${language === "fr" ? "Client" : "Client"}: ${proposal.clientName}\n` +
                              `${language === "fr" ? "Concurrent" : "Competitor"}: ${competitor?.name || "N/A"}\n\n` +
                              `${language === "fr" ? "Avantage kWh Québec" : "kWh Québec Advantage"}: ${formatCurrency(proposal.totalAdvantageKwh)}\n\n` +
                              `${language === "fr" ? "Hypothèses comparées" : "Compared Assumptions"}:\n` +
                              `- Inflation: ${formatPercent(proposal.compInflationRate)} vs ${formatPercent(proposal.kwhInflationRate)} → ${formatCurrency(proposal.inflationDiff25Years)}\n` +
                              `- ${language === "fr" ? "Dégradation" : "Degradation"}: ${formatPercent(proposal.compDegradationRate)} vs ${formatPercent(proposal.kwhDegradationRate)} → ${formatCurrency(proposal.degradationDiffValue)}\n` +
                              `- O&M: ${formatPercent(proposal.compOmCostPercent)} vs ${formatPercent(proposal.kwhOmCostPercent)} → ${formatCurrency(proposal.omDiff)}\n` +
                              (constructionSavings > 0 ? `- Construction: → ${formatCurrency(constructionSavings)}\n` : "") +
                              `\n${language === "fr" ? "Points clés" : "Key Findings"}:\n` +
                              (proposal.keyFindings?.map(f => `• ${f}`).join("\n") || "");
                            
                            await navigator.clipboard.writeText(text);
                            setCopiedProposalId(proposal.id);
                            setTimeout(() => setCopiedProposalId(null), 2000);
                            toast({ 
                              title: language === "fr" ? "Copié!" : "Copied!",
                              description: language === "fr" ? "Analyse copiée dans le presse-papiers" : "Analysis copied to clipboard"
                            });
                          }}
                          data-testid={`button-copy-proposal-${proposal.id}`}
                        >
                          {copiedProposalId === proposal.id ? (
                            <Check className="w-4 h-4 mr-2 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4 mr-2" />
                          )}
                          {language === "fr" ? "Copier" : "Copy"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
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
                        <FormDescription>{language === "fr" ? "% du tarif Hydro-Québec" : "% of Hydro-Québec rate"}</FormDescription>
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
                        <FormDescription>{language === "fr" ? "% du tarif Hydro-Québec" : "% of Hydro-Québec rate"}</FormDescription>
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

      <Dialog open={isDocumentDialogOpen} onOpenChange={setIsDocumentDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingDocument 
                ? (language === "fr" ? "Modifier le document" : "Edit Document")
                : (language === "fr" ? "Ajouter un document" : "Add Document")}
            </DialogTitle>
          </DialogHeader>
          <Form {...documentForm}>
            <form onSubmit={documentForm.handleSubmit((data) => {
              const { competitorId, tags, ...rest } = data;
              const payload = {
                ...rest,
                entityId: competitorId && competitorId.length > 0 ? competitorId : null,
                tags: tags ? tags.split(",").map(t => t.trim()).filter(t => t) : [],
              };
              if (editingDocument) {
                updateDocumentMutation.mutate({ id: editingDocument.id, data: payload });
              } else {
                createDocumentMutation.mutate(payload as any);
              }
            })} className="space-y-4">
              <FormField
                control={documentForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "fr" ? "Titre" : "Title"} *</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-document-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={documentForm.control}
                  name="entityType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Type d'entité" : "Entity Type"} *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-document-entity-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="competitor">{language === "fr" ? "Concurrent" : "Competitor"}</SelectItem>
                          <SelectItem value="supplier">{language === "fr" ? "Fournisseur" : "Supplier"}</SelectItem>
                          <SelectItem value="partner">{language === "fr" ? "Partenaire" : "Partner"}</SelectItem>
                          <SelectItem value="hydro_quebec">Hydro-Québec</SelectItem>
                          <SelectItem value="government">{language === "fr" ? "Gouvernement" : "Government"}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={documentForm.control}
                  name="competitorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Concurrent associé" : "Associated Competitor"}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-document-competitor">
                            <SelectValue placeholder={language === "fr" ? "Aucun" : "None"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">{language === "fr" ? "Aucun" : "None"}</SelectItem>
                          {competitorsList.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={documentForm.control}
                name="documentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "fr" ? "Type de document" : "Document Type"} *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-document-type">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="proposal">{language === "fr" ? "Proposition" : "Proposal"}</SelectItem>
                        <SelectItem value="pricing">{language === "fr" ? "Tarification" : "Pricing"}</SelectItem>
                        <SelectItem value="analysis">{language === "fr" ? "Analyse" : "Analysis"}</SelectItem>
                        <SelectItem value="specification">{language === "fr" ? "Spécification" : "Specification"}</SelectItem>
                        <SelectItem value="presentation">{language === "fr" ? "Présentation" : "Presentation"}</SelectItem>
                        <SelectItem value="other">{language === "fr" ? "Autre" : "Other"}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={documentForm.control}
                  name="fileName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Nom du fichier" : "File Name"} *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="document.pdf" data-testid="input-document-filename" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={documentForm.control}
                  name="fileUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "URL du fichier" : "File URL"}</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://" data-testid="input-document-url" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={documentForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        rows={3}
                        placeholder={language === "fr" 
                          ? "Description du document..."
                          : "Document description..."}
                        data-testid="input-document-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={documentForm.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "fr" ? "Tags" : "Tags"}</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder={language === "fr" 
                          ? "ex: ppa, commercial, 2024"
                          : "e.g., ppa, commercial, 2024"}
                        data-testid="input-document-tags"
                      />
                    </FormControl>
                    <FormDescription>
                      {language === "fr" ? "Séparés par des virgules" : "Comma-separated"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDocumentDialogOpen(false)}>
                  {language === "fr" ? "Annuler" : "Cancel"}
                </Button>
                <Button 
                  type="submit" 
                  disabled={createDocumentMutation.isPending || updateDocumentMutation.isPending}
                  data-testid="button-save-document"
                >
                  {editingDocument 
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

      <AlertDialog open={!!deleteDocumentId} onOpenChange={() => setDeleteDocumentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{language === "fr" ? "Supprimer ce document?" : "Delete this document?"}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === "fr" ? "Annuler" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDocumentId && deleteDocumentMutation.mutate(deleteDocumentId)}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete-document"
            >
              {language === "fr" ? "Supprimer" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
