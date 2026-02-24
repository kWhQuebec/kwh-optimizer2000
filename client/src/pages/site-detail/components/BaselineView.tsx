import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingDown, DollarSign, Leaf, Zap } from 'lucide-react';

interface BaselineViewProps {
  siteId: string;
  language: 'fr' | 'en';
}

interface BaselineData {
  hasBaseline: boolean;
  baselineSnapshotDate?: string;
  baselineAnnualConsumptionKwh?: number;
  baselineAnnualCostCad?: number;
  baselinePeakDemandKw?: number;
  baselineMonthlyProfile?: Array<{
    month: number;
    kWh: number;
    cost: number;
    period: string;
  }>;
  operationsStartDate?: string;
}

interface ReconciliationData {
  hasData: boolean;
  months?: Array<{
    year: number;
    month: number;
    label: string;
    historicalKwh?: number;
    actualConsumptionKwh?: number;
    savingsKwh?: number;
  }>;
  summary?: {
    totalBaselineKwh?: number;
    totalActualKwh?: number;
    totalSavingsKwh?: number;
  };
}

const MONTHS_EN = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const MONTHS_FR = [
  'Jan',
  'Fév',
  'Mar',
  'Avr',
  'Mai',
  'Jun',
  'Jul',
  'Aoû',
  'Sep',
  'Oct',
  'Nov',
  'Déc',
];

const MONTHS = { en: MONTHS_EN, fr: MONTHS_FR };

const translations = {
  en: {
    annualSavingsKwh: 'Annual Savings',
    annualSavingsDollars: 'Annual Cost Savings',
    co2Avoided: 'CO2 Avoided',
    kWh: 'kWh',
    cad: 'CAD',
    tonnes: 'tonnes',
    noBaseline: 'No Baseline Captured',
    captureBaseline: 'Capture Baseline',
    baselineExplanation:
      'A baseline captures your energy consumption before solar installation. This allows us to measure and track your savings over time.',
    postInstallationMessage:
      'Post-installation data will be added automatically',
    baselineOnly: 'Baseline Data',
    baselineVsActual: 'Baseline vs Actual Consumption',
    monthlyDelta: 'Monthly Savings Analysis',
    month: 'Month',
    baseline: 'Baseline',
    actual: 'Actual',
    delta: 'Delta',
    reduction: 'Reduction %',
    total: 'Total',
  },
  fr: {
    annualSavingsKwh: 'Économie Annuelle',
    annualSavingsDollars: 'Économie Annuelle',
    co2Avoided: 'CO2 Évité',
    kWh: 'kWh',
    cad: 'CAD',
    tonnes: 'tonnes',
    noBaseline: 'Pas de Baseline',
    captureBaseline: 'Capturer le Baseline',
    baselineExplanation:
      'Un baseline capture votre consommation énergétique avant l\'installation solaire. Cela nous permet de mesurer et suivre vos économies dans le temps.',
    postInstallationMessage:
      'Les données post-installation seront ajoutées automatiquement',
    baselineOnly: 'Données de Baseline',
    baselineVsActual: 'Baseline vs Consommation Réelle',
    monthlyDelta: 'Analyse Mensuelle des Économies',
    month: 'Mois',
    baseline: 'Baseline',
    actual: 'Actuel',
    delta: 'Delta',
    reduction: 'Réduction %',
    total: 'Total',
  },
};

const t = (language: 'en' | 'fr', key: keyof (typeof translations)['en']) =>
  translations[language][key];

export function BaselineView({ siteId, language }: BaselineViewProps) {
  const { data: baselineData, isLoading: baselineLoading } = useQuery<BaselineData>({
    queryKey: ['baseline', siteId],
    queryFn: async () => {
      const res = await fetch(`/api/sites/${siteId}/baseline`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch baseline');
      return res.json();
    },
  });

  const { data: reconciliationData, isLoading: reconciliationLoading } =
    useQuery<ReconciliationData>({
      queryKey: ['reconciliation', siteId],
      queryFn: async () => {
        const res = await fetch(`/api/sites/${siteId}/reconciliation`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to fetch reconciliation');
        return res.json();
      },
      enabled: baselineData?.hasBaseline,
    });

  const handleCaptureBaseline = async () => {
    try {
      const res = await fetch(`/api/sites/${siteId}/baseline/snapshot`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to capture baseline');
      window.location.reload();
    } catch (error) {
      console.error('Error capturing baseline:', error);
    }
  };

  const chartData = useMemo(() => {
    if (!baselineData?.baselineMonthlyProfile) return [];

    return baselineData.baselineMonthlyProfile.map((baseline, index) => {
      const monthData: any = {
        month: MONTHS[language][index],
        baseline: baseline.kWh,
      };

      if (reconciliationData?.months?.[index]) {
        monthData.actual = reconciliationData.months[index].actualConsumptionKwh || 0;
      }

      return monthData;
    });
  }, [baselineData, reconciliationData, language]);

  const kpiData = useMemo(() => {
    if (!baselineData?.baselineAnnualConsumptionKwh) return null;

    const baselineKwh = baselineData.baselineAnnualConsumptionKwh;
    const actualKwh = reconciliationData?.summary?.totalActualKwh || baselineKwh;
    const savingsKwh = baselineKwh - actualKwh;
    const savingsPercent = (savingsKwh / baselineKwh) * 100;

    const savingsDollars =
      (baselineData.baselineAnnualCostCad || 0) * (savingsPercent / 100);
    const co2Avoided = savingsKwh * 0.0005; // Quebec grid factor

    return {
      savingsKwh: Math.max(0, savingsKwh),
      savingsDollars: Math.max(0, savingsDollars),
      co2Avoided: Math.max(0, co2Avoided),
    };
  }, [baselineData, reconciliationData]);

  const tableData = useMemo(() => {
    if (!baselineData?.baselineMonthlyProfile) return [];

    return baselineData.baselineMonthlyProfile.map((baseline, index) => {
      const reconcMonth = reconciliationData?.months?.[index];
      const actualKwh = reconcMonth?.actualConsumptionKwh || 0;
      const delta = baseline.kWh - actualKwh;
      const reductionPercent = (delta / baseline.kWh) * 100;

      return {
        month: MONTHS[language][index],
        baseline: baseline.kWh,
        actual: actualKwh,
        delta: Math.max(0, delta),
        reduction: reductionPercent,
      };
    });
  }, [baselineData, reconciliationData, language]);

  if (baselineLoading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  if (!baselineData?.hasBaseline) {
    return (
      <Card className="border-2 border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            {t(language, 'noBaseline')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            {t(language, 'baselineExplanation')}
          </p>
          <Button onClick={handleCaptureBaseline} className="w-full sm:w-auto">
            {t(language, 'captureBaseline')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      {kpiData && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {t(language, 'annualSavingsKwh')}
                </span>
                <TrendingDown className="h-5 w-5 text-green-600" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {kpiData.savingsKwh.toLocaleString(language, {
                  maximumFractionDigits: 0,
                })}
              </div>
              <p className="text-xs text-gray-500">{t(language, 'kWh')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {t(language, 'annualSavingsDollars')}
                </span>
                <DollarSign className="h-5 w-5 text-green-600" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                $
                {kpiData.savingsDollars.toLocaleString(language, {
                  maximumFractionDigits: 0,
                })}
              </div>
              <p className="text-xs text-gray-500">{t(language, 'cad')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {t(language, 'co2Avoided')}
                </span>
                <Leaf className="h-5 w-5 text-green-600" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {kpiData.co2Avoided.toLocaleString(language, {
                  maximumFractionDigits: 1,
                })}
              </div>
              <p className="text-xs text-gray-500">{t(language, 'tonnes')}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chart Section */}
      <Card>
        <CardHeader>
          <CardTitle>
            {reconciliationData?.hasData
              ? t(language, 'baselineVsActual')
              : t(language, 'baselineOnly')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient
                      id="colorBaseline"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#d1d5db" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#d1d5db" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient
                      id="colorActual"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="baseline"
                    stroke="#9ca3af"
                    strokeDasharray="5 5"
                    fillOpacity={1}
                    fill="url(#colorBaseline)"
                    name={t(language, 'baseline')}
                  />
                  {reconciliationData?.hasData && (
                    <Area
                      type="monotone"
                      dataKey="actual"
                      stroke="#3b82f6"
                      fillOpacity={1}
                      fill="url(#colorActual)"
                      name={t(language, 'actual')}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
              {!reconciliationData?.hasData && (
                <p className="mt-4 text-sm text-gray-500">
                  {t(language, 'postInstallationMessage')}
                </p>
              )}
            </>
          ) : (
            <div className="py-8 text-center text-gray-500">
              No baseline data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Delta Table */}
      {reconciliationData?.hasData && tableData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t(language, 'monthlyDelta')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-2 text-left font-semibold">
                      {t(language, 'month')}
                    </th>
                    <th className="px-4 py-2 text-right font-semibold">
                      {t(language, 'baseline')}
                    </th>
                    <th className="px-4 py-2 text-right font-semibold">
                      {t(language, 'actual')}
                    </th>
                    <th className="px-4 py-2 text-right font-semibold">
                      {t(language, 'delta')}
                    </th>
                    <th className="px-4 py-2 text-right font-semibold">
                      {t(language, 'reduction')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.map((row, idx) => {
                    const reductionColor =
                      row.reduction > 0 ? 'text-green-600' : 'text-red-600';
                    return (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2">{row.month}</td>
                        <td className="px-4 py-2 text-right">
                          {row.baseline.toLocaleString(language, {
                            maximumFractionDigits: 0,
                          })}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {row.actual.toLocaleString(language, {
                            maximumFractionDigits: 0,
                          })}
                        </td>
                        <td className={`px-4 py-2 text-right font-semibold ${reductionColor}`}>
                          {row.delta.toLocaleString(language, {
                            maximumFractionDigits: 0,
                          })}
                        </td>
                        <td className={`px-4 py-2 text-right font-semibold ${reductionColor}`}>
                          {row.reduction.toLocaleString(language, {
                            maximumFractionDigits: 1,
                          })}
                          %
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
