import { useQuery } from "@tanstack/react-query";
import { Building2, BarChart3, DollarSign, Leaf, TrendingUp, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import type { Site, SimulationRun } from "@shared/schema";

interface DashboardStats {
  totalSites: number;
  activeAnalyses: number;
  totalSavings: number;
  co2Avoided: number;
  recentSites: Site[];
  recentAnalyses: SimulationRun[];
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  suffix,
  loading 
}: { 
  title: string; 
  value: string | number; 
  icon: React.ElementType; 
  suffix?: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold font-mono">
                {typeof value === "number" ? value.toLocaleString() : value}
                {suffix && <span className="text-lg font-normal text-muted-foreground ml-1">{suffix}</span>}
              </p>
            )}
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RecentActivityItem({ 
  title, 
  subtitle, 
  time, 
  icon: Icon 
}: { 
  title: string; 
  subtitle: string; 
  time: string; 
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{title}</p>
        <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
      </div>
      <div className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
        <Clock className="w-3 h-3" />
        {time}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { t } = useI18n();

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("dashboard.title")}</h1>
        <p className="text-muted-foreground mt-1">Vue d'ensemble de vos projets solaires et stockage</p>
      </div>

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t("dashboard.totalSites")}
          value={stats?.totalSites || 0}
          icon={Building2}
          loading={isLoading}
        />
        <StatCard
          title={t("dashboard.activeAnalyses")}
          value={stats?.activeAnalyses || 0}
          icon={BarChart3}
          loading={isLoading}
        />
        <StatCard
          title={t("dashboard.totalSavings")}
          value={stats?.totalSavings ? `$${(stats.totalSavings / 1000).toFixed(0)}k` : "$0"}
          icon={DollarSign}
          loading={isLoading}
        />
        <StatCard
          title={t("dashboard.co2Avoided")}
          value={stats?.co2Avoided || 0}
          suffix="t/an"
          icon={Leaf}
          loading={isLoading}
        />
      </div>

      {/* Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
            <CardTitle className="text-lg">Sites récents</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-8 h-8 rounded-lg" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : stats?.recentSites && stats.recentSites.length > 0 ? (
              <div className="divide-y">
                {stats.recentSites.map((site) => (
                  <RecentActivityItem
                    key={site.id}
                    title={site.name}
                    subtitle={`${site.city || ""}, ${site.province || "QC"}`}
                    time={site.createdAt ? new Date(site.createdAt).toLocaleDateString("fr-CA") : ""}
                    icon={Building2}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Aucun site récent</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
            <CardTitle className="text-lg">Analyses récentes</CardTitle>
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-8 h-8 rounded-lg" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : stats?.recentAnalyses && stats.recentAnalyses.length > 0 ? (
              <div className="divide-y">
                {stats.recentAnalyses.map((analysis) => (
                  <RecentActivityItem
                    key={analysis.id}
                    title={analysis.label || `Analyse ${analysis.id.slice(0, 8)}`}
                    subtitle={`${analysis.pvSizeKW?.toFixed(0) || 0} kWc • ${analysis.annualSavings?.toLocaleString() || 0} $/an`}
                    time={analysis.createdAt ? new Date(analysis.createdAt).toLocaleDateString("fr-CA") : ""}
                    icon={BarChart3}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Aucune analyse récente</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
