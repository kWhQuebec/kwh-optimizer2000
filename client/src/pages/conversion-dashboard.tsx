import { useQuery } from "@tanstack/react-query";

interface ConversionFunnelMetrics {
  conversionRate: number;
  totalLeads: number;
  qualifiedLeads: number;
  lostOpportunities: number;
  closedDeals: number;
  avgDaysToClose: number;
  totalOpportunities: number;
  periodDays: number;
}

interface EstimateAccuracy {
  deals: Array<{
    companyName: string;
    quickEstimateSavings: number;
    finalSavings: number;
    variancePercent: number;
    quickEstimateSize: number;
    finalSize: number;
    sizeVariancePercent: number;
  }>;
  avgSavingsVariance: number;
  avgSizeVariance: number;
}

export const ConversionDashboard = ({ language }) => {
  const [periodDays, setPeriodDays] = React.useState(90);

  const { data: metrics } = useQuery({
    queryKey: ["conversion-metrics", periodDays],
    queryFn: async () => {
      const response = await fetch(
        `/api/analytics/conversion-metrics?periodDays=${periodDays}`
      );
      if (!response.ok) return null;
      return (await response.json()) as ConversionFunnelMetrics;
    },
  });

  const { data: estimateAccuracy } = useQuery({
    queryKey: ["estimate-accuracy", periodDays],
    queryFn: async () => {
      const response = await fetch(
        `/api/analytics/estimate-accuracy?periodDays=${periodDays}`
      );
      if (!response.ok) return { deals: [], avgSavingsVariance: 0, avgSizeVariance: 0 };
      return (await response.json()) as EstimateAccuracy;
    },
  });

  return (
    <div className="p-6 space-y-6">
      {/* Estimate Accuracy Section */}
      {estimateAccuracy && estimateAccuracy.deals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              {language === "fr" ? "Précision des estimations" : "Estimate Accuracy"}
            </CardTitle>
            <p className="text-sm text-gray-600 mt-2">
              {language === "fr"
                ? "Comparaison entre les estimations rapides et les valeurs finales"
                : "Comparison between quick estimates and final design values"}
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-gray-600 mb-2">
                    {language === "fr" ? "Variance moyenne — Économies" : "Avg Variance — Savings"}
                  </p>
                  <span className="text-2xl font-bold text-blue-600">
                    ±{Math.abs(estimateAccuracy.avgSavingsVariance).toFixed(1)}%
                  </span>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-sm text-gray-600 mb-2">
                    {language === "fr" ? "Variance moyenne — Taille système" : "Avg Variance — System Size"}
                  </p>
                  <span className="text-2xl font-bold text-purple-600">
                    ±{Math.abs(estimateAccuracy.avgSizeVariance).toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold">{language === "fr" ? "Entreprise" : "Company"}</th>
                      <th className="text-right py-3 px-4 font-semibold">{language === "fr" ? "Est. (kW)" : "Est. (kW)"}</th>
                      <th className="text-right py-3 px-4 font-semibold">{language === "fr" ? "Final (kW)" : "Final (kW)"}</th>
                      <th className="text-right py-3 px-4 font-semibold">{language === "fr" ? "Var." : "Var."}</th>
                      <th className="text-right py-3 px-4 font-semibold">{language === "fr" ? "Écon. Est." : "Est. Savings"}</th>
                      <th className="text-right py-3 px-4 font-semibold">{language === "fr" ? "Écon. Fin." : "Final Savings"}</th>
                      <th className="text-right py-3 px-4 font-semibold">{language === "fr" ? "Var." : "Var."}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estimateAccuracy.deals.map((deal, i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="py-3 px-4 font-medium">{deal.companyName}</td>
                        <td className="text-right py-3 px-4">{deal.quickEstimateSize.toFixed(0)}</td>
                        <td className="text-right py-3 px-4">{deal.finalSize.toFixed(0)}</td>
                        <td className="text-right py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${Math.abs(deal.sizeVariancePercent) > 10 ? "bg-red-100 text-red-800" : Math.abs(deal.sizeVariancePercent) > 5 ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}`}>
                            {deal.sizeVariancePercent > 0 ? "+" : ""}{deal.sizeVariancePercent.toFixed(1)}%
                          </span>
                        </td>
                        <td className="text-right py-3 px-4">${deal.quickEstimateSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="text-right py-3 px-4">${deal.finalSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="text-right py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${Math.abs(deal.variancePercent) > 10 ? "bg-red-100 text-red-800" : Math.abs(deal.variancePercent) > 5 ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}`}>
                            {deal.variancePercent > 0 ? "+" : ""}{deal.variancePercent.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Funnel Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {language === "fr" ? "Résumé de conversion" : "Conversion Summary"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600">
                {language === "fr" ? "Taux de conversion" : "Conversion Rate"}
              </p>
              <span className="text-2xl font-bold">{metrics?.conversionRate || 0}%</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
