import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
  LineChart,
  Line,
  ComposedChart,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { PIPELINE } from "@shared/colors";
import { TrendingUp, AlertCircle, Clock, Target } from "lucide-react";

interface ConversionFunnelMetrics {
  funnel: Array<{
    stage: string;
    count: number;
    conversionToNext: number;
    avgDaysInStage: number;
  }>;
  winRate: number;
  avgDealCycle: number;
  lostReasons: Record<string, number>;
  totalOpportunities: number;
  periodDays: number;
}

const STAGE_LABELS: Record<string, { fr: string; en: string }> = {
  prospect: { fr: "Prospect", en: "Prospect" },
  contacted: { fr: "Contacté", en: "Contacted" },
  qualified: { fr: "Qualifié", en: "Qualified" },
  analysis_done: { fr: "Analyse complétée", en: "Analysis Done" },
  design_mandate_signed: { fr: "Mandat signé", en: "Design Mandate Signed" },
  epc_proposal_sent: { fr: "Proposition EPC", en: "EPC Proposal Sent" },
  negotiation: { fr: "Négociation", en: "Negotiation" },
  won_to_be_delivered: { fr: "Remportée - À livrer", en: "Won - To Be Delivered" },
  won_in_construction: { fr: "Remportée - Construction", en: "Won - In Construction" },
  won_delivered: { fr: "Remportée - Livrée", en: "Won - Delivered" },
  lost: { fr: "Perdue", en: "Lost" },
  disqualified: { fr: "Disqualifiée", en: "Disqualified" },
};

const LOST_REASON_LABELS: Record<string, { fr: string; en: string }> = {
  price: { fr: "Prix", en: "Price" },
  competition: { fr: "Compétition", en: "Competition" },
  timing: { fr: "Timing", en: "Timing" },
  no_budget: { fr: "Pas de budget", en: "No Budget" },
  other: { fr: "Autre", en: "Other" },
};

const STAGE_COLORS: Record<string, string> = {
  prospect: "#BFDBFE",
  contacted: "#93C5FD",
  qualified: "#60A5FA",
  analysis_done: "#6366F1",
  design_mandate_signed: "#FCD34D",
  epc_proposal_sent: "#F59E0B",
  negotiation: "#EAB308",
  won_to_be_delivered: "#86EFAC",
  won_in_construction: "#4ADE80",
  won_delivered: "#15803D",
  lost: "#DC2626",
  disqualified: "#6B7280",
};

const LOST_REASON_COLORS = [
  "#EF4444",
  "#F97316",
  "#F59E0B",
  "#EAAB3C",
  "#A3A3A3",
];

function CardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-40" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-64 w-full" />
      </CardContent>
    </Card>
  );
}

export default function ConversionDashboard() {
  const { t, language } = useI18n();
  const [periodDays, setPeriodDays] = useState(90);

  const { data: metrics, isLoading, error } = useQuery({
    queryKey: ["conversion-funnel", periodDays],
    queryFn: async () => {
      const response = await fetch(
        `/api/analytics/conversion-funnel?periodDays=${periodDays}`
      );
      if (!response.ok) throw new Error("Failed to fetch metrics");
      return (await response.json()) as ConversionFunnelMetrics;
    },
  });

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Error loading metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">{error.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getLostReasonLabel = (reason: string): string => {
    return LOST_REASON_LABELS[reason]?.[language === "fr" ? "fr" : "en"] || reason;
  };

  const getStageLabel = (stage: string): string => {
    return STAGE_LABELS[stage]?.[language === "fr" ? "fr" : "en"] || stage;
  };

  // Prepare data for charts
  const funnelChartData = metrics?.funnel.map((item) => ({
    ...item,
    label: getStageLabel(item.stage),
    conversionPercentage: Math.round(item.conversionToNext * 100),
  })) || [];

  const timeChartData = metrics?.funnel.map((item) => ({
    ...item,
    label: getStageLabel(item.stage),
  })) || [];

  const lostReasonsData =
    metrics && Object.keys(metrics.lostReasons).length > 0
      ? Object.entries(metrics.lostReasons).map(([reason, count]) => ({
          name: getLostReasonLabel(reason),
          value: count,
          reason,
        }))
      : [];

  return (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {language === "fr"
              ? "Tableau de bord des conversions"
              : "Conversion Dashboard"}
          </h1>
          <p className="text-sm text-gray-600 mt-2">
            {language === "fr"
              ? `Analyse des métriques de conversion sur ${periodDays} jours`
              : `Conversion metrics analysis over ${periodDays} days`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={periodDays === 30 ? "default" : "outline"}
            onClick={() => setPeriodDays(30)}
            size="sm"
          >
            30 {language === "fr" ? "jours" : "days"}
          </Button>
          <Button
            variant={periodDays === 90 ? "default" : "outline"}
            onClick={() => setPeriodDays(90)}
            size="sm"
          >
            90 {language === "fr" ? "jours" : "days"}
          </Button>
          <Button
            variant={periodDays === 365 ? "default" : "outline"}
            onClick={() => setPeriodDays(365)}
            size="sm"
          >
            1 {language === "fr" ? "an" : "year"}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {isLoading ? (
          <>
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </>
        ) : metrics ? (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {language === "fr" ? "Total d'opportunités" : "Total Opportunities"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">
                  {metrics.totalOpportunities}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  {language === "fr" ? "Taux de victoire" : "Win Rate"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {Math.round(metrics.winRate * 100)}%
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {language === "fr" ? "Cycle moyen" : "Avg Deal Cycle"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {metrics.avgDealCycle}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {language === "fr" ? "jours" : "days"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  {language === "fr" ? "1ère étape" : "First Stage"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">
                  {metrics.funnel[0]?.count || 0}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {language === "fr" ? "prospects" : "prospects"}
                </p>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel Conversion Rates */}
        <Card>
          <CardHeader>
            <CardTitle>
              {language === "fr"
                ? "Taux de conversion par étape"
                : "Conversion Rate by Stage"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64" />
            ) : funnelChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={funnelChartData.slice(0, -1)}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 150 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" />
                  <YAxis dataKey="label" type="category" width={140} />
                  <Tooltip
                    formatter={(value: number) => `${Math.round(value * 100)}%`}
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                    }}
                  />
                  <Bar dataKey="conversionToNext" fill="#3B82F6" radius={[0, 4, 4, 0]}>
                    {funnelChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={STAGE_COLORS[entry.stage] || "#3B82F6"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                {language === "fr"
                  ? "Pas de données disponibles"
                  : "No data available"}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Average Time in Stage */}
        <Card>
          <CardHeader>
            <CardTitle>
              {language === "fr"
                ? "Durée moyenne par étape"
                : "Average Time per Stage"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64" />
            ) : timeChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={timeChartData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 150 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" />
                  <YAxis dataKey="label" type="category" width={140} />
                  <Tooltip
                    formatter={(value: number) =>
                      `${value} ${language === "fr" ? "jours" : "days"}`
                    }
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                    }}
                  />
                  <Bar dataKey="avgDaysInStage" fill="#10B981" radius={[0, 4, 4, 0]}>
                    {timeChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={STAGE_COLORS[entry.stage] || "#10B981"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                {language === "fr"
                  ? "Pas de données disponibles"
                  : "No data available"}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Funnel Drop-off and Lost Reasons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stage Opportunity Count */}
        <Card>
          <CardHeader>
            <CardTitle>
              {language === "fr"
                ? "Opportunités par étape"
                : "Opportunities by Stage"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-96" />
            ) : funnelChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={funnelChartData} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="label"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    interval={0}
                  />
                  <YAxis />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                    }}
                  />
                  <Bar dataKey="count" fill="#8B5CF6" radius={[4, 4, 0, 0]}>
                    {funnelChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={STAGE_COLORS[entry.stage] || "#8B5CF6"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-96 flex items-center justify-center text-gray-500">
                {language === "fr"
                  ? "Pas de données disponibles"
                  : "No data available"}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lost Reasons Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>
              {language === "fr" ? "Raisons des pertes" : "Lost Reasons Breakdown"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-96" />
            ) : lostReasonsData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={lostReasonsData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {lostReasonsData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={LOST_REASON_COLORS[index % LOST_REASON_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => `${value}`}
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-96 flex items-center justify-center text-gray-500">
                {language === "fr"
                  ? "Pas de données disponibles"
                  : "No data available"}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Funnel Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {language === "fr"
              ? "Résumé du funnel de conversion"
              : "Conversion Funnel Summary"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-96" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">
                      {language === "fr" ? "Étape" : "Stage"}
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-900">
                      {language === "fr" ? "Nombre" : "Count"}
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-900">
                      {language === "fr"
                        ? "% du total"
                        : "% of Total"}
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-900">
                      {language === "fr"
                        ? "Conversion vers suivante"
                        : "Conversion to Next"}
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-900">
                      {language === "fr"
                        ? "Jours moyens"
                        : "Avg Days"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {funnelChartData.map((row, index) => (
                    <tr
                      key={row.stage}
                      className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                    >
                      <td className="py-3 px-4 flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor: STAGE_COLORS[row.stage],
                          }}
                        />
                        <span className="font-medium">{row.label}</span>
                      </td>
                      <td className="text-right py-3 px-4 text-gray-900 font-semibold">
                        {row.count}
                      </td>
                      <td className="text-right py-3 px-4 text-gray-600">
                        {metrics?.totalOpportunities
                          ? Math.round(
                              ((row.count / metrics.totalOpportunities) * 100 +
                                Number.EPSILON) *
                                100
                            ) / 100
                          : 0}
                        %
                      </td>
                      <td className="text-right py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${
                            row.conversionPercentage > 50
                              ? "bg-green-100 text-green-800"
                              : row.conversionPercentage > 25
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {row.conversionPercentage}%
                        </span>
                      </td>
                      <td className="text-right py-3 px-4 text-gray-900">
                        {row.avgDaysInStage}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
