import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { 
  ArrowLeft, 
  Activity, 
  Zap, 
  DollarSign, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wrench,
  TrendingUp,
  Calendar,
  Building2
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";

interface OmSite {
  id: string;
  name: string;
  address: string;
  pvSizeKW: number | null;
}

interface MaintenanceVisit {
  id: string;
  date: string;
  type: string;
  status: string;
  technician: string | null;
  notes: string | null;
}

interface Alert {
  id: string;
  type: string;
  severity: string;
  message: string;
  createdAt: string;
  resolved: boolean;
}

interface MonthlyProduction {
  month: string;
  expected: number;
  actual: number;
}

interface MonthlySavings {
  month: string;
  savings: number;
}

interface OmDashboardData {
  site: OmSite;
  performanceRatio: number;
  systemUptime: number;
  totalSavings: number;
  openIssuesCount: number;
  productionData: MonthlyProduction[];
  savingsData: MonthlySavings[];
  recentVisits: MaintenanceVisit[];
  alerts: Alert[];
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(1)}%`;
}

function formatDate(dateStr: string | null | undefined, language: string): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return date.toLocaleDateString(language === "fr" ? "fr-CA" : "en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getVisitStatusBadge(status: string, language: string) {
  const statusConfig: Record<string, { label: Record<string, string>; className: string }> = {
    completed: { 
      label: { fr: "Complétée", en: "Completed" }, 
      className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" 
    },
    scheduled: { 
      label: { fr: "Planifiée", en: "Scheduled" }, 
      className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300" 
    },
    in_progress: { 
      label: { fr: "En cours", en: "In Progress" }, 
      className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300" 
    },
    cancelled: { 
      label: { fr: "Annulée", en: "Cancelled" }, 
      className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300" 
    },
  };
  
  const config = statusConfig[status] || statusConfig.scheduled;
  return (
    <Badge className={config.className}>
      {config.label[language] || status}
    </Badge>
  );
}

function getAlertSeverityBadge(severity: string, language: string) {
  const severityConfig: Record<string, { label: Record<string, string>; className: string }> = {
    critical: { 
      label: { fr: "Critique", en: "Critical" }, 
      className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300" 
    },
    warning: { 
      label: { fr: "Avertissement", en: "Warning" }, 
      className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300" 
    },
    info: { 
      label: { fr: "Info", en: "Info" }, 
      className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300" 
    },
  };
  
  const config = severityConfig[severity] || severityConfig.info;
  return (
    <Badge className={config.className}>
      {config.label[language] || severity}
    </Badge>
  );
}

function getVisitTypeLabel(type: string, language: string): string {
  const types: Record<string, Record<string, string>> = {
    preventive: { fr: "Préventive", en: "Preventive" },
    corrective: { fr: "Corrective", en: "Corrective" },
    inspection: { fr: "Inspection", en: "Inspection" },
    emergency: { fr: "Urgence", en: "Emergency" },
  };
  return types[type]?.[language] || type;
}

function MetricCard({ 
  title, 
  value, 
  icon: Icon,
  trend,
  testId
}: { 
  title: string; 
  value: string | number; 
  icon: React.ElementType;
  trend?: string;
  testId: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold font-mono" data-testid={`${testId}-value`}>
              {value}
            </p>
            {trend && (
              <p className="text-xs text-primary flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {trend}
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

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Skeleton className="h-10 w-64" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-6 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function OmPerformancePage() {
  const { siteId } = useParams<{ siteId: string }>();
  const { language } = useI18n();

  const { data: omSites, isLoading: sitesLoading } = useQuery<OmSite[]>({
    queryKey: ["/api/om-performance/sites"],
  });

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<OmDashboardData>({
    queryKey: ["/api/om-performance/dashboard", siteId],
    enabled: !!siteId,
  });

  const isLoading = sitesLoading || dashboardLoading;

  const handleSiteChange = (newSiteId: string) => {
    window.location.href = `/app/om-performance/${newSiteId}`;
  };

  if (isLoading && !dashboardData) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href={siteId ? `/app/sites/${siteId}` : "/app/om-contracts"}>
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-om-performance">
              {language === "fr" ? "Performance O&M" : "O&M Performance"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {language === "fr" 
                ? "Tableau de bord de suivi de performance du système solaire" 
                : "Solar system performance monitoring dashboard"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {language === "fr" ? "Site:" : "Site:"}
          </span>
        </div>
        <Select value={siteId || ""} onValueChange={handleSiteChange}>
          <SelectTrigger className="w-72" data-testid="select-site">
            <SelectValue placeholder={language === "fr" ? "Sélectionner un site" : "Select a site"} />
          </SelectTrigger>
          <SelectContent>
            {omSites?.map((site) => (
              <SelectItem key={site.id} value={site.id} data-testid={`option-site-${site.id}`}>
                {site.name} {site.pvSizeKW ? `(${site.pvSizeKW} kW)` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!siteId && (
        <Card>
          <CardContent className="py-16 text-center">
            <Activity className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-1">
              {language === "fr" ? "Sélectionnez un site" : "Select a site"}
            </h3>
            <p className="text-muted-foreground">
              {language === "fr" 
                ? "Choisissez un site avec un contrat O&M pour voir ses performances." 
                : "Choose a site with an O&M contract to view its performance."}
            </p>
          </CardContent>
        </Card>
      )}

      {siteId && dashboardData && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title={language === "fr" ? "Ratio de performance" : "Performance Ratio"}
              value={formatPercent(dashboardData.performanceRatio)}
              icon={Activity}
              trend={dashboardData.performanceRatio >= 85 
                ? (language === "fr" ? "Dans la cible" : "On target") 
                : undefined}
              testId="card-performance-ratio"
            />
            <MetricCard
              title={language === "fr" ? "Disponibilité système" : "System Uptime"}
              value={formatPercent(dashboardData.systemUptime)}
              icon={Zap}
              testId="card-system-uptime"
            />
            <MetricCard
              title={language === "fr" ? "Économies totales" : "Total Savings"}
              value={formatCurrency(dashboardData.totalSavings)}
              icon={DollarSign}
              testId="card-total-savings"
            />
            <MetricCard
              title={language === "fr" ? "Problèmes ouverts" : "Open Issues"}
              value={dashboardData.openIssuesCount}
              icon={AlertTriangle}
              testId="card-open-issues"
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
                <CardTitle className="text-lg" data-testid="heading-production-chart">
                  {language === "fr" ? "Production mensuelle" : "Monthly Production"}
                </CardTitle>
                <Zap className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {dashboardData.productionData && dashboardData.productionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280} data-testid="chart-production">
                    <BarChart data={dashboardData.productionData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fontSize: 12 }} 
                        className="fill-muted-foreground"
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }} 
                        className="fill-muted-foreground"
                        tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--card))", 
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px"
                        }}
                        formatter={(value: number) => [`${value.toLocaleString()} kWh`, ""]}
                      />
                      <Legend />
                      <Bar 
                        dataKey="expected" 
                        name={language === "fr" ? "Attendue" : "Expected"} 
                        fill="hsl(var(--muted-foreground))" 
                        opacity={0.5}
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar 
                        dataKey="actual" 
                        name={language === "fr" ? "Réelle" : "Actual"} 
                        fill="hsl(var(--primary))" 
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    {language === "fr" ? "Aucune donnée disponible" : "No data available"}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
                <CardTitle className="text-lg" data-testid="heading-savings-chart">
                  {language === "fr" ? "Économies mensuelles" : "Monthly Savings"}
                </CardTitle>
                <DollarSign className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {dashboardData.savingsData && dashboardData.savingsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280} data-testid="chart-savings">
                    <AreaChart data={dashboardData.savingsData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fontSize: 12 }} 
                        className="fill-muted-foreground"
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }} 
                        className="fill-muted-foreground"
                        tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--card))", 
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px"
                        }}
                        formatter={(value: number) => [formatCurrency(value), language === "fr" ? "Économies" : "Savings"]}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="savings" 
                        name={language === "fr" ? "Économies" : "Savings"}
                        stroke="hsl(var(--primary))" 
                        fill="hsl(var(--primary))" 
                        fillOpacity={0.2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    {language === "fr" ? "Aucune donnée disponible" : "No data available"}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
                <CardTitle className="text-lg" data-testid="heading-recent-visits">
                  {language === "fr" ? "Visites récentes" : "Recent Visits"}
                </CardTitle>
                <Wrench className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {dashboardData.recentVisits && dashboardData.recentVisits.length > 0 ? (
                  <div className="space-y-4">
                    {dashboardData.recentVisits.slice(0, 5).map((visit) => (
                      <div 
                        key={visit.id} 
                        className="flex items-start gap-3 py-3 border-b last:border-0"
                        data-testid={`visit-item-${visit.id}`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                          {visit.status === "completed" ? (
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                          ) : (
                            <Clock className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium">
                              {getVisitTypeLabel(visit.type, language)}
                            </p>
                            {getVisitStatusBadge(visit.status, language)}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <Calendar className="w-3 h-3" />
                            <span>{formatDate(visit.date, language)}</span>
                            {visit.technician && (
                              <>
                                <span>•</span>
                                <span>{visit.technician}</span>
                              </>
                            )}
                          </div>
                          {visit.notes && (
                            <p className="text-sm text-muted-foreground mt-1 truncate">
                              {visit.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    <Wrench className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>{language === "fr" ? "Aucune visite récente" : "No recent visits"}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
                <CardTitle className="text-lg" data-testid="heading-alerts">
                  {language === "fr" ? "Alertes et anomalies" : "Alerts & Anomalies"}
                </CardTitle>
                <AlertTriangle className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {dashboardData.alerts && dashboardData.alerts.filter(a => !a.resolved).length > 0 ? (
                  <div className="space-y-4">
                    {dashboardData.alerts.filter(a => !a.resolved).slice(0, 5).map((alert) => (
                      <div 
                        key={alert.id} 
                        className="flex items-start gap-3 py-3 border-b last:border-0"
                        data-testid={`alert-item-${alert.id}`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          alert.severity === "critical" 
                            ? "bg-red-100 dark:bg-red-900/30" 
                            : alert.severity === "warning"
                            ? "bg-orange-100 dark:bg-orange-900/30"
                            : "bg-blue-100 dark:bg-blue-900/30"
                        }`}>
                          <AlertTriangle className={`w-4 h-4 ${
                            alert.severity === "critical" 
                              ? "text-red-600" 
                              : alert.severity === "warning"
                              ? "text-orange-600"
                              : "text-blue-600"
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium truncate">{alert.message}</p>
                            {getAlertSeverityBadge(alert.severity, language)}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatDate(alert.createdAt, language)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500 opacity-75" />
                    <p>{language === "fr" ? "Aucune alerte active" : "No active alerts"}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
