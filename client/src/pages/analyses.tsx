import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { BarChart3, Building2, Zap, Battery, DollarSign, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import type { SimulationRun, Site, Client } from "@shared/schema";

interface SimulationWithSite extends SimulationRun {
  site: Site & { client: Client };
}

function AnalysisCard({ simulation }: { simulation: SimulationWithSite }) {
  const { t } = useI18n();

  return (
    <Card className="hover-elevate">
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold truncate">
                  {simulation.label || `Analyse ${simulation.id.slice(0, 8)}`}
                </h3>
                <p className="text-sm text-muted-foreground truncate">
                  {simulation.site?.name} • {simulation.site?.client?.name}
                </p>
              </div>
            </div>
            <Badge variant={simulation.type === "SCENARIO" ? "default" : "secondary"}>
              {simulation.type === "SCENARIO" ? t("analyses.scenario") : t("analyses.baseline")}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">PV:</span>
              <span className="font-mono font-medium">{(simulation.pvSizeKW || 0).toFixed(0)} kWc</span>
            </div>
            <div className="flex items-center gap-2">
              <Battery className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Batt:</span>
              <span className="font-mono font-medium">{(simulation.battEnergyKWh || 0).toFixed(0)} kWh</span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">{t("analyses.savings")}:</span>
              <span className="font-mono font-medium text-primary">
                ${((simulation.annualSavings || 0) / 1000).toFixed(1)}k/{t("analyses.perYear")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">{t("analyses.payback")}:</span>
              <span className="font-mono font-medium">
                {(simulation.simplePaybackYears || 0).toFixed(1)} {t("analyses.years")}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Link href={`/app/sites/${simulation.siteId}`}>
              <Button variant="outline" size="sm" className="gap-1.5" data-testid={`button-view-site-${simulation.id}`}>
                <Building2 className="w-3.5 h-3.5" />
                {t("analyses.viewSite")}
              </Button>
            </Link>
            <Link href={`/app/analyses/${simulation.id}/design`}>
              <Button size="sm" className="gap-1.5" data-testid={`button-create-design-${simulation.id}`}>
                {t("analyses.createDesign")}
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AnalysesPage() {
  const { t } = useI18n();

  const { data: analyses, isLoading } = useQuery<SimulationWithSite[]>({
    queryKey: ["/api/simulation-runs"],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("nav.analyses")}</h1>
        <p className="text-muted-foreground mt-1">{t("analyses.subtitle")}</p>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-xl" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : analyses && analyses.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {analyses.map((simulation) => (
            <AnalysisCard key={simulation.id} simulation={simulation} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <BarChart3 className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-1">{t("analyses.noAnalyses")}</h3>
            <p className="text-muted-foreground mb-4">
              {t("analyses.noAnalysesDescription")}
            </p>
            <Link href="/app/sites">
              <Button variant="outline" className="gap-2">
                <Building2 className="w-4 h-4" />
                Voir les sites
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
