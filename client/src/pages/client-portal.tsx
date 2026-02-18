import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Building2, 
  MapPin, 
  BarChart3, 
  FileText,
  CheckCircle2,
  Clock,
  Download,
  TrendingUp,
  Leaf,
  Sun,
  FileCheck,
  PenLine,
  Wrench,
  ChevronRight,
  Mail,
  Phone,
  DollarSign,
  Zap,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import type { Site, SimulationRun, DesignAgreement } from "@shared/schema";

type SiteWithClient = Site & { 
  client: { name: string } | null;
  simulationRuns?: SimulationRun[];
  designAgreement?: DesignAgreement | null;
};

type ProjectPhase = "analysis" | "design" | "installation" | "complete";

function getProjectPhase(site: SiteWithClient): { phase: ProjectPhase; progress: number; label: string; labelEn: string } {
  if (!site.analysisAvailable) {
    return { phase: "analysis", progress: 25, label: "Analyse en cours", labelEn: "Analysis in Progress" };
  }
  if (!site.designAgreement || site.designAgreement.status === "draft") {
    return { phase: "design", progress: 50, label: "En attente de design", labelEn: "Awaiting Design" };
  }
  if (site.designAgreement.status === "accepted") {
    return { phase: "installation", progress: 75, label: "Design approuvé", labelEn: "Design Approved" };
  }
  return { phase: "complete", progress: 100, label: "Projet complété", labelEn: "Project Complete" };
}

function ProjectTimeline({ site, language }: { site: SiteWithClient; language: string }) {
  const phaseInfo = getProjectPhase(site);
  
  const steps = [
    { 
      id: "analysis", 
      label: language === "fr" ? "Analyse" : "Analysis",
      icon: BarChart3,
      complete: site.analysisAvailable
    },
    { 
      id: "design", 
      label: language === "fr" ? "Design" : "Design",
      icon: PenLine,
      complete: site.designAgreement?.status === "accepted"
    },
    { 
      id: "installation", 
      label: language === "fr" ? "Installation" : "Installation",
      icon: Wrench,
      complete: phaseInfo.phase === "complete"
    },
    { 
      id: "complete", 
      label: language === "fr" ? "Terminé" : "Complete",
      icon: CheckCircle2,
      complete: phaseInfo.phase === "complete"
    },
  ];

  return (
    <div className="space-y-3" data-testid={`timeline-site-${site.id}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {language === "fr" ? phaseInfo.label : phaseInfo.labelEn}
        </span>
        <span className="text-xs font-medium">{phaseInfo.progress}%</span>
      </div>
      <Progress value={phaseInfo.progress} className="h-2" />
      <div className="flex justify-between">
        {steps.map((step, idx) => {
          const StepIcon = step.icon;
          const isActive = steps.findIndex(s => !s.complete) === idx;
          const isComplete = step.complete;
          
          return (
            <div 
              key={step.id} 
              className="flex flex-col items-center gap-1"
              data-testid={`timeline-step-${step.id}-${site.id}`}
            >
              <div className={`
                w-6 h-6 rounded-full flex items-center justify-center text-xs
                ${isComplete ? "bg-primary text-primary-foreground" : 
                  isActive ? "bg-primary/20 text-primary ring-2 ring-primary/50" : 
                  "bg-muted text-muted-foreground"}
              `}>
                {isComplete ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <StepIcon className="w-3 h-3" />
                )}
              </div>
              <span className={`text-[10px] ${isComplete || isActive ? "font-medium" : "text-muted-foreground"}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ClientPortalPage() {
  const { t, language } = useI18n();
  const { user } = useAuth();

  const { data: sites = [], isLoading } = useQuery<SiteWithClient[]>({
    queryKey: ["/api/sites"],
  });

  const getAnalysisStatus = (site: SiteWithClient) => {
    if (!site.analysisAvailable) {
      return { 
        status: "pending", 
        label: t("portal.analysisPending") || "Analysis Pending",
        icon: Clock,
        variant: "secondary" as const
      };
    }
    return { 
      status: "complete", 
      label: t("portal.analysisComplete") || "Analysis Complete",
      icon: CheckCircle2,
      variant: "default" as const
    };
  };

  // Normalize sites data with defensive defaults for missing relations
  const normalizedSites = sites.map(site => ({
    ...site,
    simulationRuns: site.simulationRuns || [],
    designAgreement: site.designAgreement || null
  }));

  // Calculate dashboard KPIs
  const totalSites = normalizedSites.length;
  const sitesWithAnalysis = normalizedSites.filter(s => s.analysisAvailable).length;
  const sitesWithDesign = normalizedSites.filter(s => s.designAgreement?.status === "accepted").length;
  
  // Estimate total savings from simulation runs (simplified calculation)
  const totalProjectedSavings = normalizedSites.reduce((sum, site) => {
    if (site.simulationRuns && site.simulationRuns.length > 0) {
      const latestRun = site.simulationRuns[site.simulationRuns.length - 1];
      // Use NPV as savings estimate if available
      return sum + (latestRun.npv25 || 0);
    }
    return sum;
  }, 0);

  // Get pending actions
  const pendingActions = normalizedSites.filter(site => {
    if (!site.analysisAvailable) return false;
    if (!site.designAgreement) return true;
    if (site.designAgreement.status === "sent") return true;
    return false;
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold" data-testid="text-portal-title">
          {t("portal.welcome") || "Welcome"}, {user?.name || user?.email}
        </h1>
        <p className="text-muted-foreground">
          {user?.clientName && (
            <span className="font-medium">{user.clientName} - </span>
          )}
          {t("portal.subtitle") || "View your solar analysis reports and site information"}
        </p>
      </div>

      {/* Dashboard KPIs */}
      {sites.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" data-testid="dashboard-kpis">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="kpi-total-sites">{totalSites}</p>
                  <p className="text-sm text-muted-foreground">
                    {language === "fr" ? "Sites" : "Sites"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
                  <BarChart3 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="kpi-analyses-complete">
                    {sitesWithAnalysis}/{totalSites}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {language === "fr" ? "Analyses complétées" : "Analyses Complete"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900/30">
                  <TrendingUp className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="kpi-projected-savings">
                    {totalProjectedSavings > 0 ? formatCurrency(totalProjectedSavings) : "-"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {language === "fr" ? "VAN projetée (25 ans)" : "Projected NPV (25 yrs)"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <FileCheck className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="kpi-designs-approved">
                    {sitesWithDesign}/{totalSites}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {language === "fr" ? "Designs approuvés" : "Designs Approved"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pending Actions Alert */}
      {pendingActions.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20" data-testid="pending-actions">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertCircle className="w-4 h-4" />
              {language === "fr" ? "Actions requises" : "Actions Required"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {pendingActions.map(site => {
                const hasMandateToSign = site.designAgreement && site.designAgreement.status === "sent" && site.designAgreement.publicToken;
                const actionLabel = hasMandateToSign
                  ? (language === "fr" ? `Signer le mandat de conception pour ${site.name}` : `Sign design mandate for ${site.name}`)
                  : (language === "fr" ? `Consulter l'analyse pour ${site.name}` : `Review analysis for ${site.name}`);
                const actionHref = hasMandateToSign
                  ? `/sign/${site.designAgreement!.publicToken}`
                  : `/app/sites/${site.id}`;
                const ActionIcon = hasMandateToSign ? PenLine : BarChart3;
                
                return (
                  <li key={site.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <ActionIcon className="w-4 h-4 text-amber-600" />
                      <span>{actionLabel}</span>
                    </div>
                    <Button asChild size="sm" variant={hasMandateToSign ? "default" : "outline"} data-testid={`button-action-${site.id}`}>
                      <Link href={actionHref}>
                        {hasMandateToSign 
                          ? (language === "fr" ? "Signer" : "Sign")
                          : <ChevronRight className="w-4 h-4" />
                        }
                      </Link>
                    </Button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Sites Grid */}
      {normalizedSites.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Building2 className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">
              {t("portal.noSites") || "No sites available"}
            </h3>
            <p className="text-muted-foreground max-w-sm">
              {t("portal.noSitesDescription") || "Your solar analysis sites will appear here once they are set up by our team."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sun className="w-5 h-5 text-primary" />
            {language === "fr" ? "Vos sites" : "Your Sites"}
          </h2>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {normalizedSites.map(site => {
              const analysisStatus = getAnalysisStatus(site);
              const StatusIcon = analysisStatus.icon;
              
              return (
                <Card key={site.id} className="hover-elevate" data-testid={`card-site-${site.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <CardTitle className="text-lg truncate">
                          {site.name}
                        </CardTitle>
                        {(site.city || site.address) && (
                          <CardDescription className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">
                              {[site.address, site.city].filter(Boolean).join(", ")}
                            </span>
                          </CardDescription>
                        )}
                      </div>
                      <Badge variant={analysisStatus.variant} className="shrink-0">
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {analysisStatus.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Project Timeline */}
                    <ProjectTimeline site={site} language={language} />
                    
                    <Separator />
                    
                    {/* Quick Stats */}
                    {site.analysisAvailable && (
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {(site.roofAreaSqM || site.roofAreaAutoSqM) && (
                          <div>
                            <div className="text-muted-foreground text-xs">
                              {t("portal.roofArea") || "Roof Area"}
                            </div>
                            <div className="font-medium">
                              {(site.roofAreaSqM || site.roofAreaAutoSqM || 0).toLocaleString()} m²
                            </div>
                          </div>
                        )}
                        {site.simulationRuns && site.simulationRuns.length > 0 && (
                          <div>
                            <div className="text-muted-foreground text-xs">
                              {language === "fr" ? "Capacité suggérée" : "Suggested Capacity"}
                            </div>
                            <div className="font-medium">
                              {(site.simulationRuns[site.simulationRuns.length - 1]?.pvSizeKW || 0).toLocaleString()} kW
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {site.analysisAvailable && site.simulationRuns && site.simulationRuns.length > 0 && (() => {
                      const latestRun = site.simulationRuns[site.simulationRuns.length - 1];
                      return (
                        <div className="space-y-3 pt-2">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Zap className="w-3 h-3" />
                            {language === "fr" ? "Résultats financiers" : "Financial Results"}
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                            {latestRun.pvSizeKW && (
                              <div>
                                <div className="text-muted-foreground text-xs">
                                  {language === "fr" ? "Taille du système" : "System Size"}
                                </div>
                                <div className="font-medium" data-testid={`kpi-system-size-${site.id}`}>
                                  {latestRun.pvSizeKW.toLocaleString()} kW
                                </div>
                              </div>
                            )}
                            {latestRun.savingsYear1 != null && (
                              <div>
                                <div className="text-muted-foreground text-xs">
                                  {language === "fr" ? "Économies an 1" : "Year 1 Savings"}
                                </div>
                                <div className="font-medium text-green-600" data-testid={`kpi-savings-${site.id}`}>
                                  {formatCurrency(latestRun.savingsYear1)}
                                </div>
                              </div>
                            )}
                            {latestRun.simplePaybackYears != null && (
                              <div>
                                <div className="text-muted-foreground text-xs">
                                  {language === "fr" ? "Retour sur investissement" : "Simple Payback"}
                                </div>
                                <div className="font-medium" data-testid={`kpi-payback-${site.id}`}>
                                  {latestRun.simplePaybackYears.toFixed(1)} {language === "fr" ? "ans" : "years"}
                                </div>
                              </div>
                            )}
                            {latestRun.npv25 != null && (
                              <div>
                                <div className="text-muted-foreground text-xs">
                                  VAN 25 ans
                                </div>
                                <div className="font-medium text-green-600" data-testid={`kpi-npv-${site.id}`}>
                                  {formatCurrency(latestRun.npv25)}
                                </div>
                              </div>
                            )}
                            {latestRun.co2AvoidedTonnesPerYear != null && latestRun.co2AvoidedTonnesPerYear > 0 && (
                              <div>
                                <div className="text-muted-foreground text-xs">
                                  {language === "fr" ? "Réduction GES" : "GHG Reduction"}
                                </div>
                                <div className="font-medium flex items-center gap-1" data-testid={`kpi-ghg-${site.id}`}>
                                  <Leaf className="w-3 h-3 text-green-600" />
                                  {latestRun.co2AvoidedTonnesPerYear.toFixed(0)} t CO₂/an
                                </div>
                              </div>
                            )}
                            {latestRun.irr25 != null && (
                              <div>
                                <div className="text-muted-foreground text-xs">TRI</div>
                                <div className="font-medium" data-testid={`kpi-irr-${site.id}`}>
                                  {(latestRun.irr25 * 100).toFixed(1)}%
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                    
                    {/* Sign Mandate CTA */}
                    {site.designAgreement && site.designAgreement.status === "sent" && site.designAgreement.publicToken && (
                      <Button asChild className="w-full gap-2" data-testid={`button-sign-mandate-${site.id}`}>
                        <Link href={`/sign/${site.designAgreement.publicToken}`}>
                          <PenLine className="w-4 h-4" />
                          {language === "fr" ? "Signer le mandat de conception" : "Sign Design Mandate"}
                        </Link>
                      </Button>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button asChild variant="outline" className="flex-1" data-testid={`button-view-site-${site.id}`}>
                        <Link href={`/app/sites/${site.id}`}>
                          {site.analysisAvailable ? (
                            <>
                              <BarChart3 className="w-4 h-4 mr-2" />
                              {language === "fr" ? "Voir l'analyse" : "View Analysis"}
                            </>
                          ) : (
                            <>
                              <FileText className="w-4 h-4 mr-2" />
                              {language === "fr" ? "Voir détails" : "View Details"}
                            </>
                          )}
                        </Link>
                      </Button>
                      {site.analysisAvailable && (
                        <Button
                          variant="default"
                          className="flex-1"
                          onClick={async () => {
                            try {
                              const response = await fetch(`/api/sites/${site.id}/report/pdf`, {
                                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
                              });
                              if (!response.ok) throw new Error("Download failed");
                              const blob = await response.blob();
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `${site.name || "report"}-analysis.pdf`;
                              document.body.appendChild(a);
                              a.click();
                              window.URL.revokeObjectURL(url);
                              document.body.removeChild(a);
                            } catch (err) {
                              console.error("Download error:", err);
                            }
                          }}
                          data-testid={`button-download-pdf-${site.id}`}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          PDF
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Documents Section */}
      {normalizedSites.some(s => s.analysisAvailable) && (
        <Card data-testid="documents-section">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {language === "fr" ? "Vos documents" : "Your Documents"}
            </CardTitle>
            <CardDescription>
              {language === "fr" 
                ? "Téléchargez vos rapports d'analyse et ententes signées"
                : "Download your analysis reports and signed agreements"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {normalizedSites.filter(s => s.analysisAvailable).map(site => (
                <div 
                  key={site.id} 
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                  data-testid={`document-row-${site.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded bg-primary/10">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{site.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {language === "fr" ? "Rapport d'analyse solaire" : "Solar Analysis Report"}
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={async () => {
                      try {
                        const response = await fetch(`/api/sites/${site.id}/report/pdf`, {
                          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
                        });
                        if (!response.ok) throw new Error("Download failed");
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${site.name || "report"}-analysis.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                      } catch (err) {
                        console.error("Download error:", err);
                      }
                    }}
                    data-testid={`button-download-report-${site.id}`}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {language === "fr" ? "Télécharger" : "Download"}
                  </Button>
                </div>
              ))}
              
              {normalizedSites.filter(s => s.designAgreement?.status === "accepted").map(site => (
                <div 
                  key={`agreement-${site.id}`} 
                  className="flex items-center justify-between p-3 rounded-lg border bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                  data-testid={`document-agreement-${site.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded bg-green-100 dark:bg-green-900/50">
                      <FileCheck className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{site.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {language === "fr" ? "Mandat de conception préliminaire signé" : "Signed Preliminary Design Mandate"}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-green-600 border-green-300">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    {language === "fr" ? "Signé" : "Signed"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Help Section */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">
            {t("portal.needHelp") || "Need Help?"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            {t("portal.helpText") || "If you have questions about your solar analysis or need additional information, please contact our team."}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <a 
              href="mailto:info@kwhquebec.ca" 
              className="flex items-center gap-2 text-primary hover:underline"
              data-testid="link-contact-email"
            >
              <Mail className="w-4 h-4" />
              info@kwhquebec.ca
            </a>
            <a
              href="tel:+15144278871"
              className="flex items-center gap-2 text-primary hover:underline"
              data-testid="link-contact-phone"
            >
              <Phone className="w-4 h-4" />
              (514) 123-4567
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
