import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Building2, 
  MapPin, 
  BarChart3, 
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import type { Site, SimulationRun } from "@shared/schema";

type SiteWithClient = Site & { 
  client: { name: string } | null;
  simulationRuns?: SimulationRun[];
};

export default function ClientPortalPage() {
  const { t } = useI18n();
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
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

      {sites.length === 0 ? (
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sites.map(site => {
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
                            {[site.address, site.city, site.province].filter(Boolean).join(", ")}
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
                  {site.analysisAvailable && (
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {(site.roofAreaSqM || site.roofAreaAutoSqM) && (
                        <div>
                          <div className="text-muted-foreground">
                            {t("portal.roofArea") || "Roof Area"}
                          </div>
                          <div className="font-medium">
                            {(site.roofAreaSqM || site.roofAreaAutoSqM || 0).toLocaleString()} m²
                          </div>
                        </div>
                      )}
                      {site.latitude && site.longitude && (
                        <div>
                          <div className="text-muted-foreground">
                            {t("portal.location") || "Location"}
                          </div>
                          <div className="font-medium">
                            {site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <Button asChild className="flex-1" data-testid={`button-view-site-${site.id}`}>
                      <Link href={`/app/sites/${site.id}`}>
                        {site.analysisAvailable ? (
                          <>
                            <BarChart3 className="w-4 h-4 mr-2" />
                            {t("portal.viewAnalysis") || "View Analysis"}
                          </>
                        ) : (
                          <>
                            <FileText className="w-4 h-4 mr-2" />
                            {t("portal.viewDetails") || "View Details"}
                          </>
                        )}
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

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
          <div className="mt-3 flex items-center gap-4">
            <a href="mailto:info@kwhquebec.ca" className="text-primary hover:underline">
              info@kwhquebec.ca
            </a>
            <a href="tel:+15141234567" className="text-primary hover:underline">
              (514) 123-4567
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
