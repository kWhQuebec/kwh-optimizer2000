import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { 
  ArrowLeft, Building2, Plus, Trash2, Calculator, FileText, 
  Zap, Battery, DollarSign, TrendingUp, Leaf, Download, Loader2,
  ChevronDown, ChevronUp, Pencil, Check, X, MapPin, Calendar, Users,
  FileSignature, Send, Mail
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Collapsible, CollapsibleContent, CollapsibleTrigger 
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Portfolio, Site, PortfolioSiteWithDetails } from "@shared/schema";

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("fr-CA", {
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

// HQ RFP status badge component - uses semantic Badge variants for design system compliance
function HqRfpStatusBadge({ status, language }: { status: string | null | undefined; language: string }) {
  if (!status) return <span className="text-muted-foreground text-sm">—</span>;
  
  const labels: Record<string, { fr: string; en: string }> = {
    eligible: { fr: "Éligible RFP", en: "RFP Eligible" },
    not_eligible: { fr: "Non éligible", en: "Not Eligible" },
    pending: { fr: "En évaluation", en: "Pending" },
  };
  
  // Use semantic Badge variants for design system compliance
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    eligible: "default",        // Primary color for positive status
    not_eligible: "destructive", // Red/destructive for negative status
    pending: "secondary",        // Muted for pending/neutral status
  };
  
  const label = labels[status]?.[language === "fr" ? "fr" : "en"] || status;
  const variant = variants[status] || "outline";
  
  return (
    <Badge variant={variant} className="text-xs" data-testid={`badge-hq-rfp-${status}`}>
      {label}
    </Badge>
  );
}

// Inline editable cell component for override values
function EditableCell({
  value,
  overrideValue,
  portfolioSiteId,
  field,
  type = "number",
  formatFn,
  onSave,
  isOverride,
}: {
  value: number | null | undefined;
  overrideValue: number | null | undefined;
  portfolioSiteId: string;
  field: string;
  type?: "number" | "currency" | "percent";
  formatFn: (v: number | null | undefined) => string;
  onSave: (id: string, field: string, value: number | null) => void;
  isOverride: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Display override if present, otherwise show simulation value
  const displayValue = overrideValue ?? value;
  
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);
  
  const handleStartEdit = () => {
    // For percent, convert from decimal to percentage display
    const initialValue = type === "percent" && displayValue != null 
      ? (displayValue * 100).toFixed(1)
      : displayValue?.toString() || "";
    setEditValue(initialValue);
    setIsEditing(true);
  };
  
  const handleSave = () => {
    let parsedValue: number | null = null;
    const trimmed = editValue.trim();
    
    if (trimmed !== "") {
      const num = parseFloat(trimmed.replace(/[^0-9.-]/g, ""));
      if (!isNaN(num)) {
        // For percent, convert back to decimal
        parsedValue = type === "percent" ? num / 100 : num;
      }
    }
    
    onSave(portfolioSiteId, field, parsedValue);
    setIsEditing(false);
  };
  
  const handleCancel = () => {
    setIsEditing(false);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") handleCancel();
  };
  
  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="w-20 h-7 text-right text-sm px-1"
          data-testid={`input-edit-${field}-${portfolioSiteId}`}
        />
      </div>
    );
  }
  
  return (
    <div 
      className={`group flex items-center justify-end gap-1 cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 ${
        isOverride ? "font-medium text-blue-600 dark:text-blue-400" : ""
      }`}
      onClick={handleStartEdit}
      title={isOverride ? "Valeur manuelle (cliquer pour modifier)" : "Cliquer pour saisir une valeur manuelle"}
      data-testid={`cell-${field}-${portfolioSiteId}`}
    >
      <span>{formatFn(displayValue)}</span>
      <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
    </div>
  );
}

function AddSiteDialog({ 
  portfolioId, 
  clientId,
  existingSiteIds,
  onSuccess 
}: { 
  portfolioId: string;
  clientId: string;
  existingSiteIds: string[];
  onSuccess: () => void;
}) {
  const { language } = useI18n();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);

  const { data: clientSites = [] } = useQuery<Site[]>({
    queryKey: ["/api/clients", clientId, "sites"],
    enabled: !!clientId,
  });

  const availableSites = clientSites.filter(s => !existingSiteIds.includes(s.id));

  const addSitesMutation = useMutation({
    mutationFn: async (siteIds: string[]) => {
      return apiRequest("POST", `/api/portfolios/${portfolioId}/sites`, { siteIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios", portfolioId, "full"] });
      setOpen(false);
      setSelectedSiteIds([]);
      onSuccess();
      toast({ 
        title: language === "fr" 
          ? `${selectedSiteIds.length} site(s) ajouté(s)` 
          : `${selectedSiteIds.length} site(s) added` 
      });
    },
    onError: () => {
      toast({ 
        title: language === "fr" ? "Erreur lors de l'ajout" : "Error adding sites", 
        variant: "destructive" 
      });
    },
  });

  const toggleSite = (siteId: string) => {
    setSelectedSiteIds(prev => 
      prev.includes(siteId) 
        ? prev.filter(id => id !== siteId)
        : [...prev, siteId]
    );
  };

  const selectAll = () => {
    setSelectedSiteIds(availableSites.map(s => s.id));
  };

  const deselectAll = () => {
    setSelectedSiteIds([]);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) setSelectedSiteIds([]);
    }}>
      <DialogTrigger asChild>
        <Button className="gap-2" data-testid="button-add-site-to-portfolio">
          <Plus className="w-4 h-4" />
          {language === "fr" ? "Ajouter des sites" : "Add Sites"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {language === "fr" ? "Ajouter des sites au portfolio" : "Add Sites to Portfolio"}
          </DialogTitle>
          <DialogDescription>
            {language === "fr" 
              ? "Cochez les sites à inclure dans ce portfolio." 
              : "Check the sites to include in this portfolio."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {availableSites.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {language === "fr" 
                ? "Tous les sites de ce client sont déjà dans le portfolio." 
                : "All sites from this client are already in the portfolio."}
            </p>
          ) : (
            <>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">
                  {selectedSiteIds.length} / {availableSites.length} {language === "fr" ? "sélectionnés" : "selected"}
                </span>
                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={selectAll}
                    data-testid="button-select-all-sites"
                  >
                    {language === "fr" ? "Tout sélectionner" : "Select all"}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={deselectAll}
                    data-testid="button-deselect-all-sites"
                  >
                    {language === "fr" ? "Désélectionner" : "Deselect all"}
                  </Button>
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto border rounded-md">
                {availableSites.map((site) => (
                  <label 
                    key={site.id}
                    className="flex items-center gap-3 p-3 hover-elevate cursor-pointer border-b last:border-b-0"
                    data-testid={`checkbox-site-${site.id}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSiteIds.includes(site.id)}
                      onChange={() => toggleSite(site.id)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{site.name}</p>
                      {site.city && (
                        <p className="text-sm text-muted-foreground truncate">{site.city}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  {language === "fr" ? "Annuler" : "Cancel"}
                </Button>
                <Button 
                  onClick={() => addSitesMutation.mutate(selectedSiteIds)}
                  disabled={selectedSiteIds.length === 0 || addSitesMutation.isPending}
                  data-testid="button-confirm-add-sites"
                >
                  {addSitesMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {language === "fr" 
                    ? `Ajouter (${selectedSiteIds.length})` 
                    : `Add (${selectedSiteIds.length})`}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function KpiCard({ 
  icon: Icon, 
  label, 
  value, 
  subValue,
  color = "text-foreground" 
}: { 
  icon: typeof Zap; 
  label: string; 
  value: string;
  subValue?: string;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
            {subValue && <p className="text-xs text-muted-foreground">{subValue}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Type for the optimized API response
interface PortfolioFullResponse {
  portfolio: Portfolio;
  sites: PortfolioSiteWithDetails[];
  kpis: {
    totalPvSizeKW: number;
    totalBatteryCapacityKWh: number;
    totalNetCapex: number;
    totalNpv: number;
    weightedIrr: number;
    totalAnnualSavings: number;
    totalCo2Avoided: number;
    numBuildings: number;
    sitesWithSimulations: number;
    volumeDiscount: number;
    discountedCapex: number;
  };
}

import { COMMUNITY_SESSIONS } from "@shared/communitySessionData";

function CommunityFlyerSection({ portfolioId, language }: { portfolioId: string; language: string }) {
  const [downloading, setDownloading] = useState<number | null>(null);
  const { toast } = useToast();

  const handleDownload = async (sessionIndex: number) => {
    setDownloading(sessionIndex);
    try {
      const response = await fetch(`/api/portfolios/${portfolioId}/community-flyer/${sessionIndex}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Community_Flyer_${sessionIndex + 1}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({
        title: language === "fr" ? "Erreur de téléchargement" : "Download failed",
        description: language === "fr"
          ? "Impossible de télécharger le dépliant. Veuillez réessayer."
          : "Could not download the flyer. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {COMMUNITY_SESSIONS.map((session, idx) => (
        <div
          key={idx}
          className="border rounded-md p-3 flex flex-col gap-2"
          data-testid={`card-community-session-${idx}`}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs shrink-0">
              {language === "fr" ? `Session ${idx + 1}` : `Session ${idx + 1}`}
            </Badge>
            {idx === 3 && (
              <Badge variant="secondary" className="text-xs shrink-0">
                {language === "fr" ? "Sessions 4-5 fusionnées" : "Sessions 4-5 merged"}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground truncate">
              {language === "fr" ? session.regionFr : session.regionEn}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3 shrink-0" />
            <span>{language === "fr" ? session.dateFr : session.dateEn}</span>
            <span className="mx-0.5">·</span>
            <span>{language === "fr" ? session.timeFr : session.timeEn}</span>
          </div>
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Building2 className="w-3 h-3 shrink-0 mt-0.5" />
            <span className="line-clamp-2">{session.buildings.join(", ")}</span>
          </div>
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
            <span className="line-clamp-2">
              {language === "fr" ? session.meetingAddressFr : session.meetingAddressEn}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-auto w-full"
            onClick={() => handleDownload(idx)}
            disabled={downloading === idx}
            data-testid={`button-download-flyer-${idx}`}
          >
            {downloading === idx ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span className="ml-1.5">
              {language === "fr" ? "Télécharger PDF" : "Download PDF"}
            </span>
          </Button>
        </div>
      ))}
    </div>
  );
}

export default function PortfolioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { language } = useI18n();
  const { toast } = useToast();
  const [pricingOpen, setPricingOpen] = useState(true);
  const [exportingSheets, setExportingSheets] = useState(false);

  // Single optimized query that fetches portfolio, sites, and pre-calculated KPIs
  const { data, isLoading } = useQuery<PortfolioFullResponse>({
    queryKey: ["/api/portfolios", id, "full"],
    enabled: !!id,
  });

  const portfolio = data?.portfolio;
  const portfolioSites = data?.sites || [];
  const kpis = data?.kpis;

  const removeSiteMutation = useMutation({
    mutationFn: async (siteId: string) => {
      return apiRequest("DELETE", `/api/portfolios/${id}/sites/${siteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios", id, "full"] });
      toast({ 
        title: language === "fr" ? "Site retiré" : "Site removed" 
      });
    },
    onError: () => {
      toast({ 
        title: language === "fr" ? "Erreur lors du retrait" : "Error removing site", 
        variant: "destructive" 
      });
    },
  });

  // Smart "Sync Latest" mutation - refreshes all site data and recalculates aggregates
  const recalculateMutation = useMutation({
    mutationFn: async () => {
      // First, invalidate all portfolio site caches to ensure fresh data
      for (const ps of portfolioSites) {
        await queryClient.invalidateQueries({ queryKey: ["/api/sites", ps.siteId] });
      }
      
      // Then recalculate portfolio aggregates from latest simulations
      return apiRequest("POST", `/api/portfolios/${id}/recalculate`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/portfolios", id, "full"] });
      await queryClient.refetchQueries({ queryKey: ["/api/portfolios", id, "full"] });
      toast({ 
        title: language === "fr" ? "Portfolio synchronisé" : "Portfolio synced",
        description: language === "fr" 
          ? "Les KPIs ont été mis à jour avec les dernières simulations."
          : "KPIs have been updated with the latest simulations."
      });
    },
    onError: () => {
      toast({ 
        title: language === "fr" ? "Erreur lors de la synchronisation" : "Error syncing", 
        variant: "destructive" 
      });
    },
  });

  // Mutation for updating portfolio site overrides
  const updateOverrideMutation = useMutation({
    mutationFn: async ({ portfolioSiteId, field, value }: { portfolioSiteId: string; field: string; value: number | null }) => {
      const response = await apiRequest("PATCH", `/api/portfolio-sites/${portfolioSiteId}`, { [field]: value });
      return response;
    },
    onSuccess: async () => {
      // Invalidate and refetch to ensure all data is fresh
      await queryClient.invalidateQueries({ queryKey: ["/api/portfolios", id, "full"] });
      await queryClient.refetchQueries({ queryKey: ["/api/portfolios", id, "full"] });
      toast({ 
        title: language === "fr" ? "Valeur mise à jour" : "Value updated" 
      });
    },
    onError: () => {
      toast({ 
        title: language === "fr" ? "Erreur lors de la mise à jour" : "Error updating value", 
        variant: "destructive" 
      });
    },
  });

  const handleSaveOverride = async (portfolioSiteId: string, field: string, value: number | null) => {
    await updateOverrideMutation.mutateAsync({ portfolioSiteId, field, value });
  };

  const [isBatchProcurationDialogOpen, setIsBatchProcurationDialogOpen] = useState(false);
  const [batchProcurationLanguage, setBatchProcurationLanguage] = useState<"fr" | "en">(language as "fr" | "en");
  const [batchResult, setBatchResult] = useState<{ sent: number; skipped: number; errors: string[] } | null>(null);

  const batchProcurationMutation = useMutation({
    mutationFn: async (lang: "fr" | "en") => {
      const res = await apiRequest("POST", `/api/portfolios/${id}/batch-send-hq-procuration`, { language: lang });
      return res as unknown as { sent: number; skipped: number; errors: string[] };
    },
    onSuccess: (data) => {
      setBatchResult(data);
      if (data.sent > 0) {
        toast({
          title: language === "fr" ? "Procurations envoyées" : "Procurations sent",
          description: language === "fr"
            ? `${data.sent} courriel(s) envoyé(s), ${data.skipped} ignoré(s)`
            : `${data.sent} email(s) sent, ${data.skipped} skipped`
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: language === "fr" ? "Erreur d'envoi" : "Send error",
        description: error?.message || (language === "fr" ? "Erreur inconnue" : "Unknown error"),
        variant: "destructive"
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">
          {language === "fr" ? "Portfolio introuvable" : "Portfolio not found"}
        </p>
        <Link href="/app/portfolios">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {language === "fr" ? "Retour" : "Back"}
          </Button>
        </Link>
      </div>
    );
  }

  const existingSiteIds = portfolioSites.map(ps => ps.siteId);
  const quotedCosts = portfolio.quotedCosts as any || {};
  
  // Use pre-calculated KPIs from server (fresh) with fallback to stored values
  const numBuildings = kpis?.numBuildings || portfolio.numBuildings || 0;
  const volumeDiscount = kpis?.volumeDiscount || portfolio.volumeDiscountPercent || 0;
  const totalPvSizeKW = kpis?.totalPvSizeKW || portfolio.totalPvSizeKW || 0;
  const totalBatteryKWh = kpis?.totalBatteryCapacityKWh || portfolio.totalBatteryKWh || 0;
  const totalNpv = kpis?.totalNpv || portfolio.totalNpv25 || 0;
  const weightedIrr = kpis?.weightedIrr || portfolio.weightedIrr25 || 0;
  const totalCapex = kpis?.totalNetCapex || portfolio.totalCapexNet || 0;
  const totalAnnualSavings = kpis?.totalAnnualSavings || portfolio.totalAnnualSavings || 0;
  const totalCo2Avoided = kpis?.totalCo2Avoided || portfolio.totalCo2Avoided || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/app/portfolios">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">{portfolio.name}</h1>
          <p className="text-muted-foreground">
            {numBuildings} {language === "fr" ? "bâtiments" : "buildings"}
            {volumeDiscount > 0 && (
              <Badge variant="secondary" className="ml-2 text-green-600">
                -{formatPercent(volumeDiscount)} {language === "fr" ? "volume" : "volume"}
              </Badge>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="gap-2"
            onClick={() => recalculateMutation.mutate()}
            disabled={recalculateMutation.isPending}
            data-testid="button-sync-portfolio"
          >
            {recalculateMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Calculator className="w-4 h-4" />
            )}
            {recalculateMutation.isPending 
              ? (language === "fr" ? "Synchronisation..." : "Syncing...")
              : (language === "fr" ? "Synchroniser" : "Sync Latest")}
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              setBatchResult(null);
              setIsBatchProcurationDialogOpen(true);
            }}
            data-testid="button-batch-send-procurations"
          >
            <FileSignature className="w-4 h-4" />
            {language === "fr" ? "Envoyer les procurations" : "Send procurations"}
          </Button>
          {portfolio.clientId && (
            <AddSiteDialog 
              portfolioId={id!}
              clientId={portfolio.clientId}
              existingSiteIds={existingSiteIds}
              onSuccess={() => recalculateMutation.mutate()}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard 
          icon={Zap} 
          label={language === "fr" ? "Puissance Solaire totale" : "Total Solar Size"}
          value={`${formatNumber(totalPvSizeKW)} kW`}
          color="text-yellow-600 dark:text-yellow-400"
        />
        <KpiCard 
          icon={Battery} 
          label={language === "fr" ? "Stockage total" : "Total Storage"}
          value={`${formatNumber(totalBatteryKWh)} kWh`}
          color="text-blue-600 dark:text-blue-400"
        />
        <KpiCard 
          icon={DollarSign} 
          label="NPV (25 ans)"
          value={formatCurrency(totalNpv)}
          color="text-green-600 dark:text-green-400"
        />
        <KpiCard 
          icon={TrendingUp} 
          label={language === "fr" ? "TRI pondéré" : "Weighted IRR"}
          value={formatPercent(weightedIrr)}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard 
          icon={DollarSign} 
          label={language === "fr" ? "CAPEX net total" : "Total Net CAPEX"}
          value={formatCurrency(totalCapex)}
        />
        <KpiCard 
          icon={DollarSign} 
          label={language === "fr" ? "Économies/an" : "Annual Savings"}
          value={formatCurrency(totalAnnualSavings)}
          color="text-green-600 dark:text-green-400"
        />
        <KpiCard 
          icon={Leaf} 
          label={language === "fr" ? "CO₂ évité/an" : "CO₂ Avoided/yr"}
          value={`${formatNumber(totalCo2Avoided, 1)} t`}
          color="text-green-600 dark:text-green-400"
        />
        <KpiCard 
          icon={Building2} 
          label={language === "fr" ? "Bâtiments" : "Buildings"}
          value={String(numBuildings)}
        />
      </div>

      <Collapsible open={pricingOpen} onOpenChange={setPricingOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {language === "fr" ? "Tarification services d'évaluation" : "Assessment Services Pricing"}
                  </CardTitle>
                  <CardDescription>
                    {language === "fr" 
                      ? "Visite de site, évaluation et schémas unifilaires" 
                      : "Site visit, evaluation and single-line diagrams"}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xl font-bold text-primary">
                    {formatCurrency(quotedCosts.total || portfolio.totalCad)}
                  </span>
                  {pricingOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b">
                  <span>{language === "fr" ? "Frais de déplacement" : "Travel costs"} ({portfolio.estimatedTravelDays} {language === "fr" ? "jours" : "days"})</span>
                  <span>{formatCurrency(quotedCosts.travel)}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span>{language === "fr" ? "Visites de site" : "Site visits"} ({numBuildings} × 600$)</span>
                  <span>{formatCurrency(quotedCosts.visit)}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span>{language === "fr" ? "Évaluation technique" : "Technical evaluation"} ({numBuildings} × 1 000$)</span>
                  <span>{formatCurrency(quotedCosts.evaluation)}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span>{language === "fr" ? "Schémas unifilaires" : "Single-line diagrams"} ({numBuildings} × 1 900$)</span>
                  <span>{formatCurrency(quotedCosts.diagrams)}</span>
                </div>
                {volumeDiscount > 0 && (
                  <div className="flex justify-between py-2 border-b text-green-600 dark:text-green-400">
                    <span>{language === "fr" ? "Rabais volume" : "Volume discount"} (-{formatPercent(volumeDiscount)})</span>
                    <span>-{formatCurrency(quotedCosts.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b font-medium">
                  <span>{language === "fr" ? "Sous-total" : "Subtotal"}</span>
                  <span>{formatCurrency(quotedCosts.subtotal)}</span>
                </div>
                <div className="flex justify-between py-1 text-muted-foreground">
                  <span>TPS (5%)</span>
                  <span>{formatCurrency(quotedCosts.taxes?.gst)}</span>
                </div>
                <div className="flex justify-between py-1 text-muted-foreground">
                  <span>TVQ (9.975%)</span>
                  <span>{formatCurrency(quotedCosts.taxes?.qst)}</span>
                </div>
                <Separator />
                <div className="flex justify-between py-2 text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(quotedCosts.total)}</span>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>
              {language === "fr" ? "Sites du portfolio" : "Portfolio Sites"}
            </CardTitle>
            <CardDescription>
              {language === "fr" 
                ? "Tableau récapitulatif des analyses par site" 
                : "Summary table of analyses by site"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2" 
              data-testid="button-download-pdf"
              onClick={async () => {
                try {
                  const token = localStorage.getItem("token");
                  const response = await fetch(`/api/portfolios/${id}/pdf?lang=${language}`, {
                    headers: {
                      Authorization: `Bearer ${token}`,
                    },
                  });
                  if (!response.ok) throw new Error("Failed to download PDF");
                  const blob = await response.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `portfolio-${portfolio.name.replace(/\s+/g, "-").toLowerCase()}.pdf`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  window.URL.revokeObjectURL(url);
                } catch (error) {
                  console.error("PDF download error:", error);
                }
              }}
            >
              <Download className="w-4 h-4" />
              PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={exportingSheets || portfolioSites.length === 0}
              data-testid="button-export-info-sheets"
              onClick={async () => {
                setExportingSheets(true);
                try {
                  const token = localStorage.getItem("token");
                  const response = await fetch(`/api/portfolios/${id}/export-info-sheets`, {
                    headers: {
                      Authorization: `Bearer ${token}`,
                    },
                  });
                  if (!response.ok) throw new Error("Failed to export info sheets");
                  const blob = await response.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `Info_Sheets_${portfolio?.name?.replace(/\s+/g, "-") || "portfolio"}.zip`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  window.URL.revokeObjectURL(url);
                  toast({
                    title: language === "fr" ? "Fiches exportées" : "Info sheets exported",
                    description: language === "fr"
                      ? `${portfolioSites.length} fiches (FR + EN) téléchargées.`
                      : `${portfolioSites.length} sheets (FR + EN) downloaded.`,
                  });
                } catch (error) {
                  console.error("Export info sheets error:", error);
                  toast({
                    title: language === "fr" ? "Erreur d'exportation" : "Export error",
                    description: language === "fr"
                      ? "Impossible d'exporter les fiches. Réessayez."
                      : "Could not export info sheets. Please try again.",
                    variant: "destructive",
                  });
                } finally {
                  setExportingSheets(false);
                }
              }}
            >
              {exportingSheets ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              {language === "fr" ? "Fiches projet (ZIP)" : "Info Sheets (ZIP)"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48" />
          ) : portfolioSites.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{language === "fr" ? "Aucun site dans ce portfolio" : "No sites in this portfolio"}</p>
              <p className="text-sm">{language === "fr" ? "Ajoutez des sites analysés pour voir le tableau récapitulatif." : "Add analyzed sites to see the summary table."}</p>
            </div>
          ) : (() => {
            // Separate sites into RFP eligible and Hors RFP categories
            const rfpEligibleSites = portfolioSites.filter(ps => 
              (ps.site as any)?.hqRfpStatus === "eligible"
            );
            const horsRfpSites = portfolioSites.filter(ps => 
              (ps.site as any)?.hqRfpStatus !== "eligible"
            );

            const renderSiteRow = (ps: typeof portfolioSites[0]) => {
              const sim = ps.latestSimulation;
              const psAny = ps as any;
              return (
                <TableRow key={ps.siteId}>
                  <TableCell>
                    <Link href={`/app/sites/${ps.siteId}`}>
                      <span className="font-medium hover:underline cursor-pointer" data-testid={`link-site-${ps.siteId}`}>
                        {ps.site?.name || ps.siteId}
                      </span>
                    </Link>
                    {ps.site?.city && (
                      <span className="text-muted-foreground text-sm block">{ps.site.city}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <HqRfpStatusBadge status={(ps.site as any)?.hqRfpStatus} language={language} />
                  </TableCell>
                  <TableCell className="text-right">
                    <EditableCell
                      value={sim?.pvSizeKW}
                      overrideValue={psAny.overridePvSizeKW}
                      portfolioSiteId={ps.id}
                      field="overridePvSizeKW"
                      type="number"
                      formatFn={formatNumber}
                      onSave={handleSaveOverride}
                      isOverride={psAny.overridePvSizeKW != null}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <EditableCell
                      value={sim?.battEnergyKWh}
                      overrideValue={psAny.overrideBatteryKWh}
                      portfolioSiteId={ps.id}
                      field="overrideBatteryKWh"
                      type="number"
                      formatFn={formatNumber}
                      onSave={handleSaveOverride}
                      isOverride={psAny.overrideBatteryKWh != null}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <EditableCell
                      value={sim?.capexNet}
                      overrideValue={psAny.overrideCapexNet}
                      portfolioSiteId={ps.id}
                      field="overrideCapexNet"
                      type="currency"
                      formatFn={formatCurrency}
                      onSave={handleSaveOverride}
                      isOverride={psAny.overrideCapexNet != null}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <EditableCell
                      value={sim?.npv25}
                      overrideValue={psAny.overrideNpv}
                      portfolioSiteId={ps.id}
                      field="overrideNpv"
                      type="currency"
                      formatFn={formatCurrency}
                      onSave={handleSaveOverride}
                      isOverride={psAny.overrideNpv != null}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <EditableCell
                      value={sim?.irr25}
                      overrideValue={psAny.overrideIrr}
                      portfolioSiteId={ps.id}
                      field="overrideIrr"
                      type="percent"
                      formatFn={formatPercent}
                      onSave={handleSaveOverride}
                      isOverride={psAny.overrideIrr != null}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <EditableCell
                      value={sim?.annualSavings}
                      overrideValue={psAny.overrideAnnualSavings}
                      portfolioSiteId={ps.id}
                      field="overrideAnnualSavings"
                      type="currency"
                      formatFn={formatCurrency}
                      onSave={handleSaveOverride}
                      isOverride={psAny.overrideAnnualSavings != null}
                    />
                  </TableCell>
                  <TableCell>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => removeSiteMutation.mutate(ps.siteId)}
                      disabled={removeSiteMutation.isPending}
                      data-testid={`button-remove-site-${ps.siteId}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            };

            const tableHeader = (
              <TableHeader>
                <TableRow>
                  <TableHead>{language === "fr" ? "Site" : "Site"}</TableHead>
                  <TableHead>{language === "fr" ? "Statut RFP" : "RFP Status"}</TableHead>
                  <TableHead className="text-right">PV (kW)</TableHead>
                  <TableHead className="text-right">{language === "fr" ? "Batt. (kWh)" : "Batt. (kWh)"}</TableHead>
                  <TableHead className="text-right">CAPEX net</TableHead>
                  <TableHead className="text-right">NPV</TableHead>
                  <TableHead className="text-right">TRI</TableHead>
                  <TableHead className="text-right">{language === "fr" ? "Écon./an" : "Savings/yr"}</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
            );

            return (
              <div className="space-y-6">
                {/* RFP Eligible Sites Section */}
                {rfpEligibleSites.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="default" className="text-sm">
                        {language === "fr" ? "Éligible RFP Hydro-Québec" : "Hydro-Québec RFP Eligible"}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        ({rfpEligibleSites.length} {language === "fr" ? "sites" : "sites"})
                      </span>
                    </div>
                    <div className="overflow-x-auto border rounded-lg">
                      <Table>
                        {tableHeader}
                        <TableBody>
                          {rfpEligibleSites.map(renderSiteRow)}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Hors RFP Sites Section */}
                {horsRfpSites.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="secondary" className="text-sm">
                        {language === "fr" ? "Hors RFP" : "Non-RFP"}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        ({horsRfpSites.length} {language === "fr" ? "sites" : "sites"})
                      </span>
                    </div>
                    <div className="overflow-x-auto border rounded-lg">
                      <Table>
                        {tableHeader}
                        <TableBody>
                          {horsRfpSites.map(renderSiteRow)}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Portfolio Total */}
                <div className="overflow-x-auto border rounded-lg bg-muted/30">
                  <Table>
                    <TableBody>
                      <TableRow className="font-bold">
                        <TableCell>{language === "fr" ? "Total Portfolio" : "Portfolio Total"}</TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {portfolioSites.length} {language === "fr" ? "sites" : "sites"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{formatNumber(portfolio.totalPvSizeKW)}</TableCell>
                        <TableCell className="text-right">{formatNumber(portfolio.totalBatteryKWh)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(portfolio.totalCapexNet)}</TableCell>
                        <TableCell className="text-right text-green-600 dark:text-green-400">{formatCurrency(portfolio.totalNpv25)}</TableCell>
                        <TableCell className="text-right">{formatPercent(portfolio.weightedIrr25)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(portfolio.totalAnnualSavings)}</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Community Information Sessions — Dream-RFP */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            {language === "fr" ? "Rencontres d'information communautaires" : "Community Information Sessions"}
          </CardTitle>
          <CardDescription>
            {language === "fr"
              ? "Dépliants bilingues pour les rencontres de voisinage — Dream-RFP"
              : "Bilingual flyers for neighbourhood meetings — Dream-RFP"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CommunityFlyerSection portfolioId={id!} language={language} />
        </CardContent>
      </Card>

      <Dialog open={isBatchProcurationDialogOpen} onOpenChange={(open) => {
        setIsBatchProcurationDialogOpen(open);
        if (!open) setBatchResult(null);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSignature className="w-5 h-5 text-primary" />
              {language === "fr" ? "Envoyer les procurations HQ" : "Send HQ Procurations"}
            </DialogTitle>
            <DialogDescription>
              {language === "fr"
                ? `Envoyer un courriel de procuration Hydro-Québec à tous les clients de ce portfolio.`
                : `Send an Hydro-Québec authorization email to all clients in this portfolio.`}
            </DialogDescription>
          </DialogHeader>
          {!batchResult ? (
            <>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {language === "fr" ? "Portfolio" : "Portfolio"}
                  </label>
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm" data-testid="text-batch-portfolio-name">{portfolio.name}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {language === "fr" ? "Sites dans le portfolio" : "Sites in portfolio"}
                  </label>
                  <div className="p-3 bg-muted rounded-md text-sm" data-testid="text-batch-site-count">
                    {portfolioSites.length} {language === "fr" ? "site(s)" : "site(s)"}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {language === "fr" ? "Langue du courriel" : "Email language"}
                  </label>
                  <RadioGroup
                    value={batchProcurationLanguage}
                    onValueChange={(val) => setBatchProcurationLanguage(val as "fr" | "en")}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="fr" id="batch-lang-fr" data-testid="radio-batch-procuration-language-fr" />
                      <label htmlFor="batch-lang-fr" className="text-sm cursor-pointer">Français</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="en" id="batch-lang-en" data-testid="radio-batch-procuration-language-en" />
                      <label htmlFor="batch-lang-en" className="text-sm cursor-pointer">English</label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setIsBatchProcurationDialogOpen(false)} data-testid="button-cancel-batch-procuration">
                  {language === "fr" ? "Annuler" : "Cancel"}
                </Button>
                <Button
                  onClick={() => batchProcurationMutation.mutate(batchProcurationLanguage)}
                  disabled={batchProcurationMutation.isPending || portfolioSites.length === 0}
                  className="gap-2"
                  data-testid="button-send-batch-procuration"
                >
                  {batchProcurationMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {language === "fr" ? "Envoi en cours..." : "Sending..."}
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      {language === "fr" ? "Envoyer" : "Send"}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-green-600" />
                  <span data-testid="text-batch-sent-count">
                    {language === "fr" ? `${batchResult.sent} courriel(s) envoyé(s)` : `${batchResult.sent} email(s) sent`}
                  </span>
                </div>
                {batchResult.skipped > 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span data-testid="text-batch-skipped-count">
                      {language === "fr" ? `${batchResult.skipped} ignoré(s) (pas de courriel ou doublon)` : `${batchResult.skipped} skipped (no email or duplicate)`}
                    </span>
                  </div>
                )}
                {batchResult.errors.length > 0 && (
                  <div className="space-y-1" data-testid="text-batch-errors">
                    <span className="text-sm font-medium text-destructive">
                      {language === "fr" ? "Erreurs:" : "Errors:"}
                    </span>
                    {batchResult.errors.map((err, i) => (
                      <p key={i} className="text-sm text-destructive">{err}</p>
                    ))}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={() => setIsBatchProcurationDialogOpen(false)} data-testid="button-close-batch-result">
                  {language === "fr" ? "Fermer" : "Close"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
