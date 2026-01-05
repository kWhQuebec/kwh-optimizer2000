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
    omEscalation: [number, number];
    productionVariance: [number, number];
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
  
  const [tariffMin, setTariffMin] = useState(2);
  const [tariffMax, setTariffMax] = useState(7);
  const [omMin, setOmMin] = useState(3);
  const [omMax, setOmMax] = useState(6);
  const [productionVariance, setProductionVariance] = useState(10);

  const runAnalysisMutation = useMutation({
    mutationFn: async () => {
      setError(null);
      const config: MonteCarloConfig = {
        iterations: 500,
        variableRanges: {
          tariffEscalation: [tariffMin / 100, tariffMax / 100],
          omEscalation: [omMin / 100, omMax / 100],
          productionVariance: [-productionVariance / 100, productionVariance / 100],
        },
      };
      
      const response = await apiRequest("POST", `/api/sites/${siteId}/monte-carlo-analysis`, {
        config,
      });
      return (response as Response).json() as Promise<MonteCarloResponse>;
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-primary" />
                      {language === "fr" ? "Escalade tarifaire (inflation énergie)" : "Tariff Escalation (energy inflation)"}
                    </Label>
                    <div className="flex items-center gap-4">
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
                          min={0}
                          max={10}
                          step={0.5}
                          data-testid="slider-tariff-escalation"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {language === "fr" 
                        ? "Taux d'augmentation annuel des tarifs d'électricité"
                        : "Annual electricity tariff increase rate"}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <Percent className="w-4 h-4 text-accent" />
                      {language === "fr" ? "Escalade O&M" : "O&M Escalation"}
                    </Label>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>{omMin}%</span>
                          <span>{omMax}%</span>
                        </div>
                        <Slider
                          value={[omMin, omMax]}
                          onValueChange={([min, max]) => {
                            setOmMin(min);
                            setOmMax(max);
                          }}
                          min={0}
                          max={10}
                          step={0.5}
                          data-testid="slider-om-escalation"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {language === "fr" 
                        ? "Taux d'augmentation annuel des coûts d'entretien"
                        : "Annual maintenance cost increase rate"}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-green-600" />
                      {language === "fr" ? "Variance de production" : "Production Variance"}
                    </Label>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>±{productionVariance}%</span>
                        </div>
                        <Slider
                          value={[productionVariance]}
                          onValueChange={([val]) => setProductionVariance(val)}
                          min={0}
                          max={20}
                          step={1}
                          data-testid="slider-production-variance"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {language === "fr" 
                        ? "Variation possible de la production solaire annuelle"
                        : "Possible variation in annual solar production"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                  <Info className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    {language === "fr"
                      ? `Exemple: Avec une escalade tarifaire de ${tariffMin}% à ${tariffMax}%, la simulation compare des scénarios où l'inflation des coûts d'électricité varie entre ces bornes sur 25 ans.`
                      : `Example: With tariff escalation of ${tariffMin}% to ${tariffMax}%, the simulation compares scenarios where electricity cost inflation varies between these bounds over 25 years.`}
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
