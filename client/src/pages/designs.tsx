import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { PenTool, Building2, Zap, Battery, DollarSign, ExternalLink, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import type { Design, SimulationRun, Site, Client } from "@shared/schema";

interface DesignWithDetails extends Design {
  simulationRun: SimulationRun & {
    site: Site & { client: Client };
  };
}

function DesignCard({ design }: { design: DesignWithDetails }) {
  const { t } = useI18n();

  return (
    <Card className="hover-elevate">
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <PenTool className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold truncate">{design.designName}</h3>
                <p className="text-sm text-muted-foreground truncate">
                  {design.simulationRun?.site?.name} • {design.simulationRun?.site?.client?.name}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">PV:</span>
              <span className="font-mono font-medium">{(design.pvSizeKW || 0).toFixed(0)} kWc</span>
            </div>
            <div className="flex items-center gap-2">
              <Battery className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Batt:</span>
              <span className="font-mono font-medium">{(design.batteryEnergyKWh || 0).toFixed(0)} kWh</span>
            </div>
            <div className="flex items-center gap-2 col-span-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Prix de vente:</span>
              <span className="font-mono font-medium text-primary">
                ${(design.totalSellPrice || 0).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Link href={`/app/analyses/${design.simulationRunId}/design`}>
              <Button variant="outline" size="sm" className="gap-1.5" data-testid={`button-view-design-${design.id}`}>
                <PenTool className="w-3.5 h-3.5" />
                {t("common.view")}
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DesignsPage() {
  const { t } = useI18n();

  const { data: designs, isLoading } = useQuery<DesignWithDetails[]>({
    queryKey: ["/api/designs"],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("nav.designs")}</h1>
        <p className="text-muted-foreground mt-1">Consultez tous les designs de systèmes</p>
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
      ) : designs && designs.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {designs.map((design) => (
            <DesignCard key={design.id} design={design} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <PenTool className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-1">Aucun design</h3>
            <p className="text-muted-foreground mb-4">
              Créez une analyse puis générez un design de système.
            </p>
            <Link href="/app/analyses">
              <Button variant="outline" className="gap-2">
                Voir les analyses
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
