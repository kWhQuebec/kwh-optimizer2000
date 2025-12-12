import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { 
  ArrowLeft, Building2, Plus, Trash2, Calculator, FileText, 
  Zap, Battery, DollarSign, TrendingUp, Leaf, Download, Loader2,
  ChevronDown, ChevronUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription 
} from "@/components/ui/dialog";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
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
  const [selectedSiteId, setSelectedSiteId] = useState("");

  const { data: clientSites = [] } = useQuery<Site[]>({
    queryKey: ["/api/clients", clientId, "sites"],
    enabled: !!clientId,
  });

  const availableSites = clientSites.filter(s => !existingSiteIds.includes(s.id));

  const addSiteMutation = useMutation({
    mutationFn: async (siteId: string) => {
      return apiRequest("POST", `/api/portfolios/${portfolioId}/sites`, { siteId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios", portfolioId] });
      setOpen(false);
      setSelectedSiteId("");
      onSuccess();
      toast({ 
        title: language === "fr" ? "Site ajouté" : "Site added" 
      });
    },
    onError: () => {
      toast({ 
        title: language === "fr" ? "Erreur lors de l'ajout" : "Error adding site", 
        variant: "destructive" 
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" data-testid="button-add-site-to-portfolio">
          <Plus className="w-4 h-4" />
          {language === "fr" ? "Ajouter un site" : "Add Site"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {language === "fr" ? "Ajouter un site au portfolio" : "Add Site to Portfolio"}
          </DialogTitle>
          <DialogDescription>
            {language === "fr" 
              ? "Sélectionnez un site analysé pour l'inclure dans ce portfolio." 
              : "Select an analyzed site to include in this portfolio."}
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
              <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                <SelectTrigger data-testid="select-site-for-portfolio">
                  <SelectValue placeholder={language === "fr" ? "Sélectionnez un site" : "Select a site"} />
                </SelectTrigger>
                <SelectContent>
                  {availableSites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name} {site.city ? `- ${site.city}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  {language === "fr" ? "Annuler" : "Cancel"}
                </Button>
                <Button 
                  onClick={() => selectedSiteId && addSiteMutation.mutate(selectedSiteId)}
                  disabled={!selectedSiteId || addSiteMutation.isPending}
                  data-testid="button-confirm-add-site"
                >
                  {addSiteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {language === "fr" ? "Ajouter" : "Add"}
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

export default function PortfolioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { language } = useI18n();
  const { toast } = useToast();
  const [pricingOpen, setPricingOpen] = useState(true);

  const { data: portfolio, isLoading: portfolioLoading } = useQuery<Portfolio>({
    queryKey: ["/api/portfolios", id],
    enabled: !!id,
  });

  const { data: portfolioSites = [], isLoading: sitesLoading } = useQuery<PortfolioSiteWithDetails[]>({
    queryKey: ["/api/portfolios", id, "sites"],
    enabled: !!id,
  });

  const removeSiteMutation = useMutation({
    mutationFn: async (siteId: string) => {
      return apiRequest("DELETE", `/api/portfolios/${id}/sites/${siteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios", id] });
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

  const recalculateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/portfolios/${id}/recalculate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios", id] });
      toast({ 
        title: language === "fr" ? "Portfolio recalculé" : "Portfolio recalculated" 
      });
    },
    onError: () => {
      toast({ 
        title: language === "fr" ? "Erreur lors du recalcul" : "Error recalculating", 
        variant: "destructive" 
      });
    },
  });

  if (portfolioLoading) {
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
  const numBuildings = portfolio.numBuildings || 0;
  const volumeDiscount = portfolio.volumeDiscountPercent || 0;

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
            data-testid="button-recalculate-portfolio"
          >
            {recalculateMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Calculator className="w-4 h-4" />
            )}
            {language === "fr" ? "Recalculer" : "Recalculate"}
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
          label={language === "fr" ? "Puissance PV totale" : "Total PV Size"}
          value={`${formatNumber(portfolio.totalPvSizeKW)} kW`}
          color="text-yellow-600 dark:text-yellow-400"
        />
        <KpiCard 
          icon={Battery} 
          label={language === "fr" ? "Stockage total" : "Total Storage"}
          value={`${formatNumber(portfolio.totalBatteryKWh)} kWh`}
          color="text-blue-600 dark:text-blue-400"
        />
        <KpiCard 
          icon={DollarSign} 
          label="NPV (25 ans)"
          value={formatCurrency(portfolio.totalNpv25)}
          color="text-green-600 dark:text-green-400"
        />
        <KpiCard 
          icon={TrendingUp} 
          label={language === "fr" ? "TRI pondéré" : "Weighted IRR"}
          value={formatPercent(portfolio.weightedIrr25)}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard 
          icon={DollarSign} 
          label={language === "fr" ? "CAPEX net total" : "Total Net CAPEX"}
          value={formatCurrency(portfolio.totalCapexNet)}
        />
        <KpiCard 
          icon={DollarSign} 
          label={language === "fr" ? "Économies/an" : "Annual Savings"}
          value={formatCurrency(portfolio.totalAnnualSavings)}
          color="text-green-600 dark:text-green-400"
        />
        <KpiCard 
          icon={Leaf} 
          label={language === "fr" ? "CO₂ évité/an" : "CO₂ Avoided/yr"}
          value={`${formatNumber(portfolio.totalCo2Avoided, 1)} t`}
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
        </CardHeader>
        <CardContent>
          {sitesLoading ? (
            <Skeleton className="h-48" />
          ) : portfolioSites.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{language === "fr" ? "Aucun site dans ce portfolio" : "No sites in this portfolio"}</p>
              <p className="text-sm">{language === "fr" ? "Ajoutez des sites analysés pour voir le tableau récapitulatif." : "Add analyzed sites to see the summary table."}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === "fr" ? "Site" : "Site"}</TableHead>
                    <TableHead className="text-right">PV (kW)</TableHead>
                    <TableHead className="text-right">{language === "fr" ? "Batt. (kWh)" : "Batt. (kWh)"}</TableHead>
                    <TableHead className="text-right">CAPEX net</TableHead>
                    <TableHead className="text-right">NPV</TableHead>
                    <TableHead className="text-right">TRI</TableHead>
                    <TableHead className="text-right">{language === "fr" ? "Écon./an" : "Savings/yr"}</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {portfolioSites.map((ps) => {
                    const sim = ps.latestSimulation;
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
                        <TableCell className="text-right">{formatNumber(sim?.pvSizeKW)}</TableCell>
                        <TableCell className="text-right">{formatNumber(sim?.battEnergyKWh)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(sim?.capexNet)}</TableCell>
                        <TableCell className="text-right text-green-600 dark:text-green-400">{formatCurrency(sim?.npv25)}</TableCell>
                        <TableCell className="text-right">{sim?.irr25 ? formatPercent(sim.irr25) : "—"}</TableCell>
                        <TableCell className="text-right">{formatCurrency(sim?.annualSavings)}</TableCell>
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
                  })}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>Total</TableCell>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
