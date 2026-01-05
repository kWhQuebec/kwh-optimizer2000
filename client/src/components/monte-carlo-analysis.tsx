import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  BarChart3, 
  Settings2, 
  Play, 
  Loader2,
  Info,
  DollarSign,
  Percent,
  Calendar,
  AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  ReferenceLine
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { apiRequest } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";

interface MonteCarloConfig {
  iterations: number;
  variableRanges: {
    tariffEscalation: [number, number];
    discountRate: [number, number];
    solarYield: [number, number];
    bifacialBoost: [number, number];
    omPerKwc: [number, number];
  };
}

interface FinancialSummary {
  npv25: number;
  npv10: number;
  npv20: number;
  irr25: number;
  irr10: number;
  irr20: number;
  paybackYears: number;
  capexNet: number;
  totalSavings25: number;
}

interface MonteCarloResult {
  p10: FinancialSummary;
  p50: FinancialSummary;
  p90: FinancialSummary;
  mean: FinancialSummary;
  iterations: number;
  distribution: {
    npv25: number[];
    irr25: number[];
    paybackYears: number[];
  };
  inputRanges: MonteCarloConfig['variableRanges'];
}

interface MonteCarloResponse {
  success: boolean;
  siteId: string;
  systemSizing: {
    pvSizeKW: number;
    batteryKWh: number;
    batteryKW: number;
  };
  monteCarlo: MonteCarloResult;
  baseAssumptions: Record<string, unknown>;
}

interface MonteCarloAnalysisProps {
  siteId: string;
  hasMeterData: boolean;
}

const formatCurrency = (value: number): string => {
  if (Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(2)} M$`;
  }
  return `${Math.round(value).toLocaleString()} $`;
};

const formatPercent = (value: number): string => {
  return `${(value * 100).toFixed(1)}%`;
};

export function MonteCarloAnalysis({ siteId, hasMeterData }: MonteCarloAnalysisProps) {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [result, setResult] = useState<MonteCarloResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // New variable ranges per James (solar expert) - Jan 2026
  // Tariff escalation: 2.5% (pessimistic) to 3.5% (optimistic)
  const [tariffMin, setTariffMin] = useState(2.5);
  const [tariffMax, setTariffMax] = useState(3.5);
  // Discount rate (WACC): 6% (optimistic) to 8% (pessimistic)
  const [discountMin, setDiscountMin] = useState(6);
  const [discountMax, setDiscountMax] = useState(8);
  // Solar yield: 1075 (pessimistic) to 1225 (optimistic) kWh/kWp/year
  const [yieldMin, setYieldMin] = useState(1075);
  const [yieldMax, setYieldMax] = useState(1225);
  // Bifacial boost: 10% (pessimistic) to 20% (optimistic)
  const [bifacialMin, setBifacialMin] = useState(10);
  const [bifacialMax, setBifacialMax] = useState(20);
  // O&M per kWc: $10 (optimistic) to $20 (pessimistic)
  const [omMin, setOmMin] = useState(10);
  const [omMax, setOmMax] = useState(20);

  const runAnalysisMutation = useMutation({
    mutationFn: async () => {
      setError(null);
      const config: MonteCarloConfig = {
        iterations: 500,
        variableRanges: {
          tariffEscalation: [tariffMin / 100, tariffMax / 100],
          discountRate: [discountMin / 100, discountMax / 100],
          solarYield: [yieldMin, yieldMax],
          bifacialBoost: [bifacialMin / 100, bifacialMax / 100],
          omPerKwc: [omMin, omMax],
        },
      };
      
      const response = await apiRequest<MonteCarloResponse>("POST", `/api/sites/${siteId}/monte-carlo-analysis`, {
        config,
      });
      return response;
    },
    onSuccess: (data) => {
      setResult(data);
      toast({
        title: language === "fr" ? "Analyse terminée" : "Analysis complete",
        description: language === "fr" 
          ? `${data.monteCarlo.iterations} simulations exécutées`
          : `${data.monteCarlo.iterations} simulations completed`,
      });
    },
    onError: (err: Error) => {
      console.error("Monte Carlo error:", err);
      setError(err.message || "Unknown error");
      toast({
        title: language === "fr" ? "Erreur d'analyse" : "Analysis error",
        description: err.message || "Unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const scenarios = result ? [
    {
      key: "pessimistic",
      label: language === "fr" ? "Pessimiste" : "Pessimistic",
      sublabel: "P10",
      icon: TrendingDown,
      color: "text-red-600",
      bgColor: "bg-red-50 dark:bg-red-950/30",
      borderColor: "border-red-200 dark:border-red-800",
      data: result.monteCarlo.p10,
    },
    {
      key: "realistic",
      label: language === "fr" ? "Réaliste" : "Realistic",
      sublabel: "P50",
      icon: Target,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
      borderColor: "border-blue-200 dark:border-blue-800",
      data: result.monteCarlo.p50,
    },
    {
      key: "optimistic",
      label: language === "fr" ? "Optimiste" : "Optimistic",
      sublabel: "P90",
      icon: TrendingUp,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950/30",
      borderColor: "border-green-600 dark:border-green-600",
      data: result.monteCarlo.p90,
    },
  ] : [];

  const distributionData = result ? (() => {
    const npvValues = result.monteCarlo.distribution.npv25;
    const buckets = 20;
    const min = Math.min(...npvValues);
    const max = Math.max(...npvValues);
    const range = max - min;
    const bucketSize = range / buckets;
    
    const histogram: { range: string; count: number; midpoint: number }[] = [];
    for (let i = 0; i < buckets; i++) {
      const bucketMin = min + i * bucketSize;
      const bucketMax = bucketMin + bucketSize;
      const count = npvValues.filter(v => v >= bucketMin && v < bucketMax).length;
      histogram.push({
        range: formatCurrency(bucketMin),
        count,
        midpoint: (bucketMin + bucketMax) / 2,
      });
    }
    return histogram;
  })() : [];

  if (!hasMeterData) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground">
            {language === "fr" 
              ? "Téléversez des données de consommation pour activer l'analyse Monte Carlo"
              : "Upload consumption data to enable Monte Carlo analysis"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              {language === "fr" ? "Analyse Monte Carlo" : "Monte Carlo Analysis"}
            </CardTitle>
            <CardDescription>
              {language === "fr"
                ? "Simulation probabiliste avec 1000 itérations pour évaluer la robustesse du projet"
                : "Probabilistic simulation with 1000 iterations to assess project robustness"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSettingsOpen(!settingsOpen)}
              data-testid="button-monte-carlo-settings"
            >
              <Settings2 className="w-4 h-4 mr-2" />
              {language === "fr" ? "Paramètres" : "Settings"}
            </Button>
            <Button
              onClick={() => runAnalysisMutation.mutate()}
              disabled={runAnalysisMutation.isPending}
              data-testid="button-run-monte-carlo"
            >
              {runAnalysisMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              {language === "fr" ? "Lancer l'analyse" : "Run Analysis"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
          <CollapsibleContent>
            <Card className="mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings2 className="w-4 h-4" />
                  {language === "fr" ? "Paramètres de simulation" : "Simulation Parameters"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Tariff Escalation */}
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-primary" />
                      {language === "fr" ? "Inflation tarifaire HQ" : "HQ Tariff Inflation"}
                    </Label>
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>{tariffMin}%</span>
                        <span>{tariffMax}%</span>
                      </div>
                      <Slider
                        value={[tariffMin, tariffMax]}
                        onValueChange={([min, max]) => {
                          setTariffMin(min);
                          setTariffMax(max);
                        }}
                        min={2.5}
                        max={3.5}
                        step={0.1}
                        data-testid="slider-tariff-escalation"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {language === "fr" 
                        ? "Taux d'augmentation annuel des tarifs HQ (historique: 2.6-3.1%)"
                        : "Annual HQ tariff increase rate (historic: 2.6-3.1%)"}
                    </p>
                  </div>

                  {/* Discount Rate */}
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <Percent className="w-4 h-4 text-orange-600" />
                      {language === "fr" ? "Taux d'actualisation" : "Discount Rate (WACC)"}
                    </Label>
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>{discountMin}%</span>
                        <span>{discountMax}%</span>
                      </div>
                      <Slider
                        value={[discountMin, discountMax]}
                        onValueChange={([min, max]) => {
                          setDiscountMin(min);
                          setDiscountMax(max);
                        }}
                        min={6}
                        max={8}
                        step={0.25}
                        data-testid="slider-discount-rate"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {language === "fr" 
                        ? "Coût moyen pondéré du capital (6% optimiste, 8% pessimiste)"
                        : "Weighted avg cost of capital (6% optimistic, 8% pessimistic)"}
                    </p>
                  </div>

                  {/* Solar Yield */}
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-yellow-600" />
                      {language === "fr" ? "Rendement solaire" : "Solar Yield"}
                    </Label>
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>{yieldMin} kWh/kWc</span>
                        <span>{yieldMax} kWh/kWc</span>
                      </div>
                      <Slider
                        value={[yieldMin, yieldMax]}
                        onValueChange={([min, max]) => {
                          setYieldMin(min);
                          setYieldMax(max);
                        }}
                        min={1075}
                        max={1225}
                        step={25}
                        data-testid="slider-solar-yield"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {language === "fr" 
                        ? "Production annuelle par kWc installé (Québec: 1075-1225)"
                        : "Annual production per installed kWp (Quebec: 1075-1225)"}
                    </p>
                  </div>

                  {/* Bifacial Boost */}
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      {language === "fr" ? "Bonus bifacial" : "Bifacial Boost"}
                    </Label>
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>+{bifacialMin}%</span>
                        <span>+{bifacialMax}%</span>
                      </div>
                      <Slider
                        value={[bifacialMin, bifacialMax]}
                        onValueChange={([min, max]) => {
                          setBifacialMin(min);
                          setBifacialMax(max);
                        }}
                        min={10}
                        max={20}
                        step={1}
                        data-testid="slider-bifacial-boost"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {language === "fr" 
                        ? "Gain de production panneaux bifaciaux (10-20% typique)"
                        : "Bifacial panel production gain (10-20% typical)"}
                    </p>
                  </div>

                  {/* O&M Cost per kWc */}
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      {language === "fr" ? "Coût O&M annuel" : "Annual O&M Cost"}
                    </Label>
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>${omMin}/kWc</span>
                        <span>${omMax}/kWc</span>
                      </div>
                      <Slider
                        value={[omMin, omMax]}
                        onValueChange={([min, max]) => {
                          setOmMin(min);
                          setOmMax(max);
                        }}
                        min={10}
                        max={20}
                        step={1}
                        data-testid="slider-om-cost"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {language === "fr" 
                        ? "Coût d'entretien par kWc/an ($10 optimiste, $20 pessimiste)"
                        : "Maintenance cost per kWc/year ($10 optimistic, $20 pessimistic)"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                  <Info className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    {language === "fr"
                      ? `Basé sur les recommandations d'experts solaires québécois (Jan 2026). La simulation exécute 500 itérations avec ces plages de paramètres.`
                      : `Based on Quebec solar expert recommendations (Jan 2026). Simulation runs 500 iterations with these parameter ranges.`}
                  </p>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {runAnalysisMutation.isPending && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground">
              {language === "fr" 
                ? "Exécution de 500 simulations..."
                : "Running 500 simulations..."}
            </p>
          </div>
        )}

        {error && !runAnalysisMutation.isPending && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-800 dark:text-red-200">
                {language === "fr" ? "Erreur d'analyse" : "Analysis Error"}
              </p>
              <p className="text-sm text-red-600 dark:text-red-300 mt-1">{error}</p>
            </div>
          </div>
        )}

        {result && !runAnalysisMutation.isPending && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {scenarios.map((scenario) => (
                <Card 
                  key={scenario.key} 
                  className={`${scenario.bgColor} ${scenario.borderColor} border-2`}
                  data-testid={`card-scenario-${scenario.key}`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <scenario.icon className={`w-5 h-5 ${scenario.color}`} />
                        <CardTitle className="text-base">{scenario.label}</CardTitle>
                      </div>
                      <Badge variant="outline" className={scenario.color}>
                        {scenario.sublabel}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          {language === "fr" ? "VAN 25 ans" : "NPV 25 years"}
                        </span>
                        <span className={`font-bold ${scenario.data.npv25 >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(scenario.data.npv25)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          {language === "fr" ? "TRI 25 ans" : "IRR 25 years"}
                        </span>
                        <span className="font-semibold">
                          {formatPercent(scenario.data.irr25)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          {language === "fr" ? "Retour" : "Payback"}
                        </span>
                        <span className="font-semibold">
                          {scenario.data.paybackYears.toFixed(1)} {language === "fr" ? "ans" : "yrs"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t">
                        <span className="text-sm text-muted-foreground">
                          {language === "fr" ? "Économies totales" : "Total Savings"}
                        </span>
                        <span className="font-semibold text-green-600">
                          {formatCurrency(scenario.data.totalSavings25)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  {language === "fr" ? "Distribution des résultats (VAN 25 ans)" : "Results Distribution (NPV 25 years)"}
                </CardTitle>
                <CardDescription>
                  {language === "fr"
                    ? `Basé sur ${result.monteCarlo.iterations} simulations`
                    : `Based on ${result.monteCarlo.iterations} simulations`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distributionData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="range" 
                        tick={{ fontSize: 10 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis 
                        tick={{ fontSize: 10 }}
                        label={{ 
                          value: language === "fr" ? "Fréquence" : "Frequency", 
                          angle: -90, 
                          position: "insideLeft",
                          fontSize: 12
                        }}
                      />
                      <Tooltip 
                        formatter={(value: number) => [value, language === "fr" ? "Simulations" : "Simulations"]}
                        labelFormatter={(label) => `VAN: ${label}`}
                      />
                      <ReferenceLine 
                        x={distributionData.find(d => d.midpoint >= result.monteCarlo.p50.npv25)?.range}
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        label={{ value: "P50", fill: "hsl(var(--primary))", fontSize: 10 }}
                      />
                      <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                        {distributionData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.midpoint < result.monteCarlo.p10.npv25 
                              ? "hsl(0, 84%, 60%)" 
                              : entry.midpoint > result.monteCarlo.p90.npv25 
                                ? "hsl(142, 71%, 45%)" 
                                : "hsl(var(--primary))"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-sm text-muted-foreground">
                      {language === "fr" ? "Pessimiste (P10)" : "Pessimistic (P10)"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-primary" />
                    <span className="text-sm text-muted-foreground">
                      {language === "fr" ? "Réaliste (P50)" : "Realistic (P50)"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-sm text-muted-foreground">
                      {language === "fr" ? "Optimiste (P90)" : "Optimistic (P90)"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-start gap-2 p-4 rounded-lg bg-muted/50">
              <Info className="w-5 h-5 mt-0.5 text-primary shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {language === "fr" ? "Interprétation des résultats" : "Interpreting Results"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {language === "fr"
                    ? `Le scénario pessimiste (P10) représente les 10% pires résultats possibles. Si le VAN pessimiste est positif (${formatCurrency(result.monteCarlo.p10.npv25)}), le projet est considéré robuste même dans des conditions défavorables.`
                    : `The pessimistic scenario (P10) represents the worst 10% of possible outcomes. If the pessimistic NPV is positive (${formatCurrency(result.monteCarlo.p10.npv25)}), the project is considered robust even under unfavorable conditions.`}
                </p>
              </div>
            </div>
          </>
        )}

        {!result && !runAnalysisMutation.isPending && (
          <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
            <BarChart3 className="w-12 h-12 text-muted-foreground/50" />
            <div>
              <p className="font-medium">
                {language === "fr" 
                  ? "Prêt à analyser les scénarios"
                  : "Ready to analyze scenarios"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {language === "fr"
                  ? "Cliquez sur \"Lancer l'analyse\" pour comparer les scénarios optimiste, réaliste et pessimiste"
                  : "Click \"Run Analysis\" to compare optimistic, realistic and pessimistic scenarios"}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
