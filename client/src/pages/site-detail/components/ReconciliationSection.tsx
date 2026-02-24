import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Zap, DollarSign, Target } from "lucide-react";

interface ReconciliationData {
  hasData: boolean;
  months: Array<{
    year: number;
    month: number;
    label: string;
    historicalKwh: number;
    predictedSavingsKwh: number;
    actualConsumptionKwh: number;
    savingsKwh: number;
    achievementPercent: number;
  }>;
  summary: {
    totalHistoricalKwh: number;
    totalPredictedSavingsKwh: number;
    totalActualKwh: number;
    totalSavingsKwh: number;
    achievementPercent: number;
    costSavings: number;
  };
}

interface ReconciliationSectionProps {
  siteId: string;
  language: "fr" | "en";
}

const translations = {
  fr: {
    title: "Réconciliation Facturation",
    savingsTitle: "Économies Totales",
    costSavingsTitle: "Économies ($)",
    achievementTitle: "% de la Promesse",
    kwhUnit: "kWh",
    noDataMessage: "Les données de réconciliation seront disponibles après la mise en service",
    chartHistorical: "Historique",
    chartActual: "Consommation Réelle",
    chartPredicted: "Économies Prévues",
    tableMonth: "Mois",
    tableHistorical: "Historique (kWh)",
    tableActual: "Réel (kWh)",
    tableSavings: "Économie (kWh)",
    tableAchievement: "% Atteinte",
    tableSummary: "Total",
    loading: "Chargement...",
    error: "Erreur de chargement",
  },
  en: {
    title: "Bill Reconciliation",
    savingsTitle: "Total Savings",
    costSavingsTitle: "Cost Savings",
    achievementTitle: "Promise Achievement",
    kwhUnit: "kWh",
    noDataMessage: "Reconciliation data will be available after commissioning",
    chartHistorical: "Historical",
    chartActual: "Actual Consumption",
    chartPredicted: "Predicted Savings",
    tableMonth: "Month",
    tableHistorical: "Historical (kWh)",
    tableActual: "Actual (kWh)",
    tableSavings: "Savings (kWh)",
    tableAchievement: "Achievement %",
    tableSummary: "Total",
    loading: "Loading...",
    error: "Error loading data",
  },
};

const getAchievementColor = (percent: number): "bg-green-100 text-green-800" | "bg-yellow-100 text-yellow-800" | "bg-red-100 text-red-800" => {
  if (percent >= 90) return "bg-green-100 text-green-800";
  if (percent >= 70) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
};

const formatNumber = (value: number, language: "fr" | "en"): string => {
  const formatter = new Intl.NumberFormat(language === "fr" ? "fr-FR" : "en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return formatter.format(value);
};

const formatCurrency = (value: number, language: "fr" | "en"): string => {
  const formatter = new Intl.NumberFormat(language === "fr" ? "fr-FR" : "en-US", {
    style: "currency",
    currency: language === "fr" ? "EUR" : "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return formatter.format(value);
};

export const ReconciliationSection = ({ siteId, language }: ReconciliationSectionProps) => {
  const t = translations[language];

  const { data, isLoading, isError } = useQuery<ReconciliationData>({
    queryKey: ["reconciliation", siteId],
    queryFn: async () => {
      const response = await fetch(`/api/sites/${siteId}/reconciliation`);
      if (!response.ok) throw new Error("Failed to fetch reconciliation data");
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">{t.title}</h2>
        <div className="text-gray-500">{t.loading}</div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">{t.title}</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="text-red-600">{t.error}</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data.hasData) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">{t.title}</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12 text-gray-500">{t.noDataMessage}</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { summary, months } = data;

  // Prepare chart data
  const chartData = months.map((month) => ({
    label: month.label,
    [t.chartHistorical]: month.historicalKwh,
    [t.chartActual]: month.actualConsumptionKwh,
    [t.chartPredicted]: month.predictedSavingsKwh,
  }));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{t.title}</h2>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Savings Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.savingsTitle}</CardTitle>
            <Zap className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(summary.totalSavingsKwh, language)}</div>
            <p className="text-xs text-gray-500">{t.kwhUnit}</p>
          </CardContent>
        </Card>

        {/* Cost Savings Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.costSavingsTitle}</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.costSavings, language)}</div>
            <p className="text-xs text-gray-500">{language === "fr" ? "Économies" : "Savings"}</p>
          </CardContent>
        </Card>

        {/* Achievement Percentage Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.achievementTitle}</CardTitle>
            <Target className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(summary.achievementPercent, language)}%</div>
            <p className={`text-xs mt-1 px-2 py-1 rounded inline-block font-semibold ${getAchievementColor(summary.achievementPercent)}`}>
              {summary.achievementPercent >= 90 ? (language === "fr" ? "Excellent" : "Excellent") : summary.achievementPercent >= 70 ? (language === "fr" ? "Bon" : "Good") : language === "fr" ? "À améliorer" : "Needs improvement"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>{language === "fr" ? "Consommation par Mois" : "Monthly Consumption"}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 0, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                angle={-45}
                textAnchor="end"
                height={100}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                label={{ value: t.kwhUnit, angle: -90, position: "insideLeft" }}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value: number) => formatNumber(value, language)}
                contentStyle={{ backgroundColor: "#fff", border: "1px solid #ccc" }}
              />
              <Legend wrapperStyle={{ paddingTop: "20px" }} />
              <Bar dataKey={t.chartHistorical} fill="#9ca3af" />
              <Bar dataKey={t.chartActual} fill="#3b82f6" />
              <Bar dataKey={t.chartPredicted} fill="#22c55e" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle>{language === "fr" ? "Détail Mensuel" : "Monthly Breakdown"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.tableMonth}</TableHead>
                <TableHead className="text-right">{t.tableHistorical}</TableHead>
                <TableHead className="text-right">{t.tableActual}</TableHead>
                <TableHead className="text-right">{t.tableSavings}</TableHead>
                <TableHead className="text-right">{t.tableAchievement}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {months.map((month) => (
                <TableRow key={`${month.year}-${month.month}`}>
                  <TableCell className="font-medium">{month.label}</TableCell>
                  <TableCell className="text-right">{formatNumber(month.historicalKwh, language)}</TableCell>
                  <TableCell className="text-right">{formatNumber(month.actualConsumptionKwh, language)}</TableCell>
                  <TableCell className="text-right">{formatNumber(month.savingsKwh, language)}</TableCell>
                  <TableCell className="text-right">
                    <Badge className={getAchievementColor(month.achievementPercent)}>
                      {formatNumber(month.achievementPercent, language)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {/* Summary Row */}
              <TableRow className="bg-gray-50 font-bold">
                <TableCell>{t.tableSummary}</TableCell>
                <TableCell className="text-right">{formatNumber(summary.totalHistoricalKwh, language)}</TableCell>
                <TableCell className="text-right">{formatNumber(summary.totalActualKwh, language)}</TableCell>
                <TableCell className="text-right">{formatNumber(summary.totalSavingsKwh, language)}</TableCell>
                <TableCell className="text-right">
                  <Badge className={getAchievementColor(summary.achievementPercent)}>
                    {formatNumber(summary.achievementPercent, language)}%
                  </Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
