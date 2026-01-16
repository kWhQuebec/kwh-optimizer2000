import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  DollarSign,
  Zap,
  AlertCircle,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";

interface PortfolioStats {
  totalSites: number;
  sitesWithDesign: number;
  totalPanels: number;
  totalKwDc: number;
  totalMwDc: number;
  totalRackingValue: number;
  averagePricePerPanel: number;
  minPricePerPanel: number;
  maxPricePerPanel: number;
  quotesExpiringSoon: number;
  quotesExpired: number;
}

interface ExpiringQuotesResponse {
  count: number;
  daysAhead: number;
  sites: Array<{
    id: string;
    name: string;
    address: string;
    kbPanelCount: number;
    kbKwDc: number;
    kbRackingSubtotal: number;
    kbQuoteDate: string;
    kbQuoteExpiry: string;
    daysUntilExpiry: number;
  }>;
}

interface KBRackingDashboardProps {
  portfolioId?: string;
}

export function KBRackingDashboard({ portfolioId }: KBRackingDashboardProps) {
  const { t, language } = useI18n();

  // Fetch portfolio statistics
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<PortfolioStats>({
    queryKey: ["/api/kb-racking/portfolio-stats", portfolioId],
    queryFn: async () => {
      const url = portfolioId
        ? `/api/kb-racking/portfolio-stats?portfolioId=${portfolioId}`
        : "/api/kb-racking/portfolio-stats";
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch portfolio stats");
      return response.json();
    },
  });

  // Fetch expiring quotes
  const { data: expiringQuotes, isLoading: quotesLoading } = useQuery<ExpiringQuotesResponse>({
    queryKey: ["/api/kb-racking/expiring-quotes", 7],
    queryFn: async () => {
      const response = await fetch("/api/kb-racking/expiring-quotes?days=7", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch expiring quotes");
      return response.json();
    },
  });

  const isLoading = statsLoading || quotesLoading;
  const locale = language === "fr" ? "fr-CA" : "en-CA";

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "CAD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Format number with commas
  const formatNumber = (value: number) => {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Format decimal with 2 places
  const formatDecimal = (value: number) => {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  if (statsError) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <p className="text-sm text-destructive">{t("kbRacking.error")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight" data-testid="title-kb-dashboard">
          {t("kbRacking.title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("kbRacking.subtitle")}</p>
      </div>

      {/* Stats Grid - 4 Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total MW Designed */}
        <Card data-testid="card-total-mw">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("kbRacking.totalMW")}</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="space-y-1">
                <div className="text-2xl font-bold" data-testid="value-total-mw">
                  {formatNumber(stats?.totalMwDc ?? 0)}
                </div>
                <p className="text-xs text-muted-foreground">MW</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Total Racking Value */}
        <Card data-testid="card-total-value">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("kbRacking.totalValue")}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="space-y-1">
                <div className="text-2xl font-bold" data-testid="value-total-value">
                  {formatCurrency(stats?.totalRackingValue ?? 0)}
                </div>
                <p className="text-xs text-muted-foreground">CAD</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sites with KB Design */}
        <Card data-testid="card-sites-with-design">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("kbRacking.sitesWithDesign")}</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="space-y-1">
                <div className="text-2xl font-bold" data-testid="value-sites-with-design">
                  {formatNumber(stats?.sitesWithDesign ?? 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("common.actions")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Average Price Per Panel */}
        <Card data-testid="card-avg-price">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("kbRacking.avgPrice")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="space-y-1">
                <div className="text-2xl font-bold" data-testid="value-avg-price">
                  {formatCurrency(stats?.averagePricePerPanel ?? 0)}
                </div>
                <p className="text-xs text-muted-foreground">{t("common.actions")}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Second Row - Price Range and Quote Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Price Range */}
        <Card data-testid="card-price-range">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t("kbRacking.priceRange")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-6 w-24" />
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{t("kbRacking.min")}</span>
                  <span className="text-sm font-semibold" data-testid="value-min-price">
                    {formatCurrency(stats?.minPricePerPanel ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{t("kbRacking.max")}</span>
                  <span className="text-sm font-semibold" data-testid="value-max-price">
                    {formatCurrency(stats?.maxPricePerPanel ?? 0)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quotes Expiring Soon */}
        <Card data-testid="card-expiring-soon">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t("kbRacking.expiringSoon")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <Skeleton className="h-10 w-24" />
            ) : (
              <div className="flex items-end justify-between gap-2">
                <div className="text-3xl font-bold" data-testid="value-expiring-soon">
                  {stats?.quotesExpiringSoon ?? 0}
                </div>
                <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {t("kbRacking.warning")}
                </Badge>
              </div>
            )}
            {!isLoading && (stats?.quotesExpiringSoon ?? 0) > 0 && (
              <p className="text-xs text-muted-foreground">
                {expiringQuotes?.daysAhead} {
                  expiringQuotes?.daysAhead === 1
                    ? t("kbRacking.daysSingular")
                    : t("kbRacking.daysPlural")
                }
              </p>
            )}
          </CardContent>
        </Card>

        {/* Quotes Expired */}
        <Card data-testid="card-expired">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t("kbRacking.expired")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <Skeleton className="h-10 w-24" />
            ) : (
              <div className="flex items-end justify-between gap-2">
                <div className="text-3xl font-bold" data-testid="value-expired">
                  {stats?.quotesExpired ?? 0}
                </div>
                <Badge variant="outline" className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {t("kbRacking.alert")}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Data availability notice */}
      {!isLoading && (!stats?.sitesWithDesign || stats.sitesWithDesign === 0) && (
        <div className="flex items-center gap-2 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
          <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <p className="text-sm text-blue-600 dark:text-blue-400">{t("kbRacking.noData")}</p>
        </div>
      )}
    </div>
  );
}
