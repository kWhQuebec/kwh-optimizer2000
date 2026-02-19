import { useState, useMemo } from "react";
import {
  Layers,
  Check,
  Award,
  Zap,
  DollarSign,
  TrendingUp,
  Battery,
  Info,
  Plus,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import type {
  Site,
  Client,
  MeterFile,
  SimulationRun,
  SensitivityAnalysis,
  OptimalScenarios,
  OptimalScenario,
} from "@shared/schema";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  Legend,
} from "recharts";
import { CreateVariantDialog } from "./CreateVariantDialog";

interface SiteWithDetails extends Site {
  client: Client;
  meterFiles: MeterFile[];
  simulationRuns: SimulationRun[];
}

interface ScenarioComparisonProps {
  simulations: SimulationRun[];
  site: SiteWithDetails;
  selectedSimulationId?: string;
  onSelectSimulation?: (simulationId: string) => void;
}

const MONTH_NAMES_FR = ['', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTH_NAMES_EN = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function ScenarioComparison({
  simulations,
  site,
  selectedSimulationId,
  onSelectSimulation
}: ScenarioComparisonProps) {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const [optimizationDialogOpen, setOptimizationDialogOpen] = useState(false);
  const [optimizationPreset, setOptimizationPreset] = useState<{
    pvSize: number;
    batterySize: number;
    batteryPower: number;
    label: string;
  } | null>(null);

  const validScenarios = useMemo(() =>
    simulations.filter(s =>
      s.type === "SCENARIO" &&
      (s.pvSizeKW !== null || s.battEnergyKWh !== null) &&
      s.npv25 !== null
    ),
    [simulations]
  );

  if (validScenarios.length < 2) {
    return (
      <Card data-testid="card-compare-empty">
        <CardContent className="py-16 text-center">
          <Layers className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-1" data-testid="text-compare-title">
            {t("compare.scenarios")}
          </h3>
          <p className="text-muted-foreground mb-4" data-testid="text-compare-description">
            {t("compare.noScenarios")}
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined || isNaN(value)) return "-";
    return new Intl.NumberFormat(language === "fr" ? "fr-CA" : "en-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number | null | undefined, decimals = 0) => {
    if (value === null || value === undefined || isNaN(value)) return "-";
    return value.toLocaleString(language === "fr" ? "fr-CA" : "en-CA", {
      maximumFractionDigits: decimals,
    });
  };

  const formatPercent = (value: number | null | undefined) => {
    if (value === null || value === undefined || isNaN(value)) return "-";
    return `${(value * 100).toFixed(1)}%`;
  };

  const getScenarioColor = (index: number) => {
    const colors = ["#FFB005", "#003DA6", "#16A34A", "#002B75", "#D4940A"];
    return colors[index % colors.length];
  };

  const getScenarioLabel = (sim: SimulationRun, index: number) => {
    if (sim.label) return sim.label;
    if (sim.pvSizeKW && sim.battEnergyKWh) {
      return language === "fr" ? `Hybride ${index + 1}` : `Hybrid ${index + 1}`;
    }
    if (sim.pvSizeKW && !sim.battEnergyKWh) {
      return language === "fr" ? `Solaire seul ${index + 1}` : `Solar Only ${index + 1}`;
    }
    if (!sim.pvSizeKW && sim.battEnergyKWh) {
      return language === "fr" ? `Stockage seul ${index + 1}` : `Storage Only ${index + 1}`;
    }
    return `${language === "fr" ? "Scénario" : "Scenario"} ${index + 1}`;
  };

  // Memoize comparison data transformation
  const comparisonData = useMemo(() =>
    validScenarios.map((sim, index) => ({
      id: sim.id,
      name: getScenarioLabel(sim, index),
      color: getScenarioColor(index),
      pvSize: sim.pvSizeKW || 0,
      batterySize: sim.battEnergyKWh || 0,
      annualSavings: sim.annualSavings || 0,
      npv25: sim.npv25 || 0,
      irr25: sim.irr25 || 0,
      payback: sim.simplePaybackYears && sim.simplePaybackYears > 0 ? sim.simplePaybackYears : 0,
      capexNet: sim.capexNet || 0,
      co2: sim.co2AvoidedTonnesPerYear || 0,
      selfSufficiency: sim.selfSufficiencyPercent || 0,
    })),
    [validScenarios]
  );

  // Round values consistently to avoid floating-point comparison issues
  const round = (val: number, decimals = 2) => Math.round(val * Math.pow(10, decimals)) / Math.pow(10, decimals);

  // Memoize best value calculations with consistent rounding
  const { bestNPV, bestIRR, bestPayback, bestSelfSufficiency } = useMemo(() => {
    const validNPVs = comparisonData.filter(d => d.npv25 > 0).map(d => round(d.npv25));
    const validPaybacks = comparisonData.filter(d => d.payback > 0).map(d => round(d.payback));
    const validIRRs = comparisonData.filter(d => d.irr25 > 0).map(d => round(d.irr25, 4));
    const validSelfSufficiency = comparisonData.filter(d => d.selfSufficiency > 0).map(d => round(d.selfSufficiency, 4));
    return {
      bestNPV: validNPVs.length > 0 ? Math.max(...validNPVs) : null,
      bestIRR: validIRRs.length > 0 ? Math.max(...validIRRs) : null,
      bestPayback: validPaybacks.length > 0 ? Math.min(...validPaybacks) : null,
      bestSelfSufficiency: validSelfSufficiency.length > 0 ? Math.max(...validSelfSufficiency) : null,
    };
  }, [comparisonData]);

  // Badge definitions
  const badgeConfigs = {
    npv: {
      labelFr: 'Meilleure VAN',
      labelEn: 'Best NPV',
      bgClass: 'bg-green-500 border-green-500',
      borderClass: 'border-green-500 bg-green-50/50 dark:bg-green-950/20'
    },
    irr: {
      labelFr: 'Meilleur TRI',
      labelEn: 'Best IRR',
      bgClass: 'bg-blue-500 border-blue-500',
      borderClass: 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
    },
    selfSufficiency: {
      labelFr: 'Meilleure autonomie',
      labelEn: 'Best Self-Sufficiency',
      bgClass: 'bg-purple-500 border-purple-500',
      borderClass: 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/20'
    },
  };

  // Compute unique badge assignments across ALL scenarios (not just displayed ones)
  // Each scenario gets at most one badge, and each badge type is assigned to at most one scenario
  // But we only show badges on scenarios that happen to be displayed in the top 3
  const badgeAssignments = useMemo(() => {
    const assignments: Record<string, keyof typeof badgeConfigs> = {};
    const usedBadges = new Set<string>();

    // Use ALL scenarios for champion determination, not just displayed subset
    const allScenarios = comparisonData;

    // Round values to avoid floating-point comparison issues
    const round = (val: number, decimals = 2) => Math.round(val * Math.pow(10, decimals)) / Math.pow(10, decimals);

    // Find champion for each metric across ALL scenarios
    // For ties, use secondary metrics or index as tiebreaker
    const findChampion = (
      metric: 'npv' | 'irr' | 'selfSufficiency',
      getValue: (s: typeof allScenarios[0]) => number,
      isHigherBetter: boolean
    ) => {
      const valid = allScenarios.filter(s => getValue(s) > 0);
      if (valid.length === 0) return null;

      const bestValue = isHigherBetter
        ? Math.max(...valid.map(s => round(getValue(s))))
        : Math.min(...valid.map(s => round(getValue(s))));

      // Get all scenarios with the best value
      const champions = valid.filter(s => round(getValue(s)) === bestValue);

      if (champions.length === 1) {
        return champions[0].id;
      }

      // Tiebreaker: among tied scenarios, use secondary metric (NPV as tiebreaker)
      // If still tied, use first one by original index
      if (metric !== 'npv') {
        const byNpv = [...champions].sort((a, b) => b.npv25 - a.npv25);
        return byNpv[0].id;
      }

      // For NPV ties, use IRR as tiebreaker
      const byIrr = [...champions].sort((a, b) => b.irr25 - a.irr25);
      return byIrr[0].id;
    };

    // Assign badges in priority order: NPV > IRR > Self-Sufficiency > Payback
    const metrics: Array<{key: keyof typeof badgeConfigs, getValue: (s: typeof allScenarios[0]) => number, higherBetter: boolean}> = [
      { key: 'npv', getValue: s => s.npv25, higherBetter: true },
      { key: 'irr', getValue: s => s.irr25, higherBetter: true },
      { key: 'selfSufficiency', getValue: s => s.selfSufficiency, higherBetter: true },
    ];

    for (const { key, getValue, higherBetter } of metrics) {
      if (usedBadges.has(key)) continue;

      const championId = findChampion(key, getValue, higherBetter);
      if (championId && !assignments[championId]) {
        assignments[championId] = key;
        usedBadges.add(key);
      }
    }

    return assignments;
  }, [comparisonData]);

  // Reorder scenarios to prioritize badge winners for display
  // This ensures that champions are always visible in the top 3 cards
  const displayedScenarios = useMemo(() => {
    // Badge priority order (same as assignment order)
    const badgePriority: Array<keyof typeof badgeConfigs> = ['npv', 'irr', 'selfSufficiency'];

    // Separate scenarios with badges from those without
    const withBadges: typeof comparisonData = [];
    const withoutBadges: typeof comparisonData = [];

    comparisonData.forEach(scenario => {
      if (badgeAssignments[scenario.id]) {
        withBadges.push(scenario);
      } else {
        withoutBadges.push(scenario);
      }
    });

    // Sort badge winners by badge priority
    withBadges.sort((a, b) => {
      const aPriority = badgePriority.indexOf(badgeAssignments[a.id]);
      const bPriority = badgePriority.indexOf(badgeAssignments[b.id]);
      return aPriority - bPriority;
    });

    // Combine: champions first (in priority order), then others (in original order)
    return [...withBadges, ...withoutBadges];
  }, [comparisonData, badgeAssignments]);

  // Reference simulation for optimization presets (use best NPV scenario or first valid)
  const referenceSimulation = useMemo(() => {
    if (validScenarios.length === 0) return null;
    const bestNpvSim = validScenarios.reduce((best, sim) =>
      (sim.npv25 || 0) > (best.npv25 || 0) ? sim : best
    );
    return bestNpvSim;
  }, [validScenarios]);

  // Get optimal scenarios from sensitivity analysis (real optimization, not heuristics)
  // First try the reference simulation, then look for any simulation with optimalScenarios
  const optimalScenarios = useMemo(() => {
    // First, check if referenceSimulation has optimalScenarios
    if (referenceSimulation?.sensitivity) {
      const sensitivity = referenceSimulation.sensitivity as SensitivityAnalysis;
      if (sensitivity.optimalScenarios) {
        return sensitivity.optimalScenarios;
      }
    }

    // If not, search through all simulations for one that has optimalScenarios
    // Prefer the most recent one (simulations are typically ordered by creation date)
    for (const sim of simulations) {
      if (sim.sensitivity) {
        const sensitivity = sim.sensitivity as SensitivityAnalysis;
        if (sensitivity.optimalScenarios) {
          return sensitivity.optimalScenarios;
        }
      }
    }

    return null;
  }, [referenceSimulation, simulations]);

  // Calculate optimization presets based on reference simulation (fallback to heuristics if no optimalScenarios)
  const optimizationPresets = useMemo(() => {
    if (!referenceSimulation) return null;

    // If we have real optimal scenarios from the backend, use those
    if (optimalScenarios) {
      return {
        npv: optimalScenarios.bestNPV ? {
          pvSize: optimalScenarios.bestNPV.pvSizeKW,
          batterySize: optimalScenarios.bestNPV.battEnergyKWh,
          batteryPower: optimalScenarios.bestNPV.battPowerKW,
          label: language === "fr" ? "Meilleur VAN" : "Best NPV",
          description: language === "fr"
            ? "Profit total maximisé sur 25 ans"
            : "Maximum total profit over 25 years",
          npv25: optimalScenarios.bestNPV.npv25,
          irr25: optimalScenarios.bestNPV.irr25,
          selfSufficiency: optimalScenarios.bestNPV.selfSufficiencyPercent,
          paybackYears: optimalScenarios.bestNPV.simplePaybackYears,
          capexNet: optimalScenarios.bestNPV.capexNet,
        } : null,
        irr: optimalScenarios.bestIRR ? {
          pvSize: optimalScenarios.bestIRR.pvSizeKW,
          batterySize: optimalScenarios.bestIRR.battEnergyKWh,
          batteryPower: optimalScenarios.bestIRR.battPowerKW,
          label: language === "fr" ? "Meilleur TRI" : "Best IRR",
          description: language === "fr"
            ? "Rendement relatif maximisé"
            : "Maximum relative return on investment",
          npv25: optimalScenarios.bestIRR.npv25,
          irr25: optimalScenarios.bestIRR.irr25,
          selfSufficiency: optimalScenarios.bestIRR.selfSufficiencyPercent,
          paybackYears: optimalScenarios.bestIRR.simplePaybackYears,
          capexNet: optimalScenarios.bestIRR.capexNet,
        } : null,
        selfSufficiency: optimalScenarios.maxSelfSufficiency ? {
          pvSize: optimalScenarios.maxSelfSufficiency.pvSizeKW,
          batterySize: optimalScenarios.maxSelfSufficiency.battEnergyKWh,
          batteryPower: optimalScenarios.maxSelfSufficiency.battPowerKW,
          label: language === "fr" ? "Autonomie maximale" : "Max Self-Sufficiency",
          description: language === "fr"
            ? "Indépendance énergétique maximale"
            : "Maximum energy independence",
          npv25: optimalScenarios.maxSelfSufficiency.npv25,
          irr25: optimalScenarios.maxSelfSufficiency.irr25,
          selfSufficiency: optimalScenarios.maxSelfSufficiency.selfSufficiencyPercent,
          paybackYears: optimalScenarios.maxSelfSufficiency.simplePaybackYears,
          capexNet: optimalScenarios.maxSelfSufficiency.capexNet,
        } : null,
      };
    }

    // Fallback to heuristics if no optimalScenarios available
    const refPV = referenceSimulation.pvSizeKW || 100;

    return {
      npv: null, // Already shown as main result
      irr: {
        pvSize: Math.round(refPV * 0.6),
        batterySize: 0,
        batteryPower: 0,
        label: language === "fr" ? "Meilleur TRI" : "Best IRR",
        description: language === "fr"
          ? "Système plus petit = CAPEX réduit = meilleur rendement relatif"
          : "Smaller system = lower CAPEX = better relative return"
      },
      selfSufficiency: {
        pvSize: Math.round(refPV * 1.3),
        batterySize: Math.max(Math.round(refPV * 0.5), 50),
        batteryPower: Math.max(Math.round(refPV * 0.25), 25),
        label: language === "fr" ? "Autonomie maximale" : "Max Self-Sufficiency",
        description: language === "fr"
          ? "Système agrandi + stockage = moins de dépendance au réseau"
          : "Larger system + storage = less grid dependence"
      },
    };
  }, [referenceSimulation, optimalScenarios, language]);

  // Handler for opening optimization dialog with preset
  const handleOptimizationClick = (presetType: 'irr' | 'selfSufficiency') => {
    if (!optimizationPresets || !referenceSimulation) {
      toast({
        title: language === "fr" ? "Erreur" : "Error",
        description: language === "fr" ? "Aucun scénario de référence disponible" : "No reference scenario available",
        variant: "destructive"
      });
      return;
    }

    const preset = optimizationPresets[presetType];
    if (!preset) {
      toast({
        title: language === "fr" ? "Erreur" : "Error",
        description: language === "fr" ? "Configuration non disponible" : "Configuration not available",
        variant: "destructive"
      });
      return;
    }

    setOptimizationPreset({
      pvSize: preset.pvSize,
      batterySize: preset.batterySize,
      batteryPower: preset.batteryPower,
      label: preset.label
    });
    setOptimizationDialogOpen(true);
  };

  // Handler for successful variant creation
  const handleOptimizationSuccess = () => {
    setOptimizationDialogOpen(false);
    setOptimizationPreset(null);
  };

  return (
    <div className="space-y-6" data-testid="section-scenario-comparison">
      <Card data-testid="card-comparison-table">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5" />
            {t("compare.scenarios")}
          </CardTitle>
          <CardDescription>
            {validScenarios.length} {t("compare.scenarioCount")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Visual Side-by-Side Comparison Cards - reordered to show champions first */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {displayedScenarios.slice(0, 3).map((scenario, index) => {
              // Use consistent rounding for best-value comparisons
              const isBestNPV = bestNPV !== null && round(scenario.npv25) === bestNPV;
              const isBestPayback = bestPayback !== null && scenario.payback > 0 && round(scenario.payback) === bestPayback;
              const isBestIRR = bestIRR !== null && round(scenario.irr25, 4) === bestIRR;
              const isBestSelfSufficiency = bestSelfSufficiency !== null && round(scenario.selfSufficiency, 4) === bestSelfSufficiency;

              // Get unique champion badge for this scenario from pre-computed assignments
              const badgeType = badgeAssignments[scenario.id];
              const badgeConfig = badgeType ? badgeConfigs[badgeType] : null;

              return (
                <div
                  key={scenario.id}
                  className={`relative rounded-xl border-2 p-4 transition-all ${
                    badgeConfig ? badgeConfig.borderClass : 'border-muted hover:border-primary/50'
                  }`}
                  data-testid={`card-scenario-${index}`}
                >
                  {badgeConfig && (
                    <Badge className={`absolute -top-2.5 left-1/2 -translate-x-1/2 text-white ${badgeConfig.bgClass}`}>
                      {language === "fr" ? badgeConfig.labelFr : badgeConfig.labelEn}
                    </Badge>
                  )}

                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-md"
                      style={{ backgroundColor: scenario.color }}
                    >
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold">{scenario.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {scenario.pvSize > 0 && `${formatNumber(scenario.pvSize)} kW`}
                        {scenario.pvSize > 0 && scenario.batterySize > 0 && " + "}
                        {scenario.batterySize > 0 && `${formatNumber(scenario.batterySize)} kWh`}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-2 rounded-lg bg-primary/5">
                      <p className="text-xs text-muted-foreground">{language === "fr" ? "VAN 25 ans" : "NPV 25y"}</p>
                      <p className={`font-bold ${isBestNPV ? 'text-green-600' : ''}`}>
                        ${formatNumber(scenario.npv25 / 1000)}k
                      </p>
                    </div>
                    <div className="p-2 rounded-lg bg-primary/5">
                      <p className="text-xs text-muted-foreground">{language === "fr" ? "TRI" : "IRR"}</p>
                      <p className={`font-bold ${isBestIRR ? 'text-green-600' : ''}`}>
                        {formatPercent(scenario.irr25)}
                      </p>
                    </div>
                    <div className="p-2 rounded-lg bg-primary/5">
                      <p className="text-xs text-muted-foreground">{language === "fr" ? "Retour" : "Payback"}</p>
                      <p className={`font-bold ${isBestPayback ? 'text-green-600' : ''}`}>
                        {scenario.payback > 0 ? `${formatNumber(scenario.payback, 1)} ${language === "fr" ? "ans" : "yrs"}` : "-"}
                      </p>
                    </div>
                    <div className="p-2 rounded-lg bg-primary/5">
                      <p className="text-xs text-muted-foreground">{language === "fr" ? "Économies/an" : "Savings/yr"}</p>
                      <p className="font-bold">${formatNumber(scenario.annualSavings / 1000)}k</p>
                    </div>
                  </div>

                  {onSelectSimulation && (
                    <Button
                      variant={selectedSimulationId === scenario.id ? "default" : "outline"}
                      size="sm"
                      className="w-full mt-4"
                      onClick={() => onSelectSimulation(scenario.id)}
                      data-testid={`button-select-card-scenario-${index}`}
                    >
                      {selectedSimulationId === scenario.id ? (
                        <>
                          <Check className="w-4 h-4 mr-1" />
                          {language === "fr" ? "Sélectionné" : "Selected"}
                        </>
                      ) : (
                        language === "fr" ? "Voir détails" : "View details"
                      )}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Detailed Table */}
          <div className="overflow-x-auto">
            <Table data-testid="table-comparison">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">
                    {t("compare.scenario")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("compare.pvSize")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("compare.batterySize")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("compare.investment")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("compare.savings")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("compare.npv")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("compare.irr")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("compare.payback")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("compare.co2")}
                  </TableHead>
                  {onSelectSimulation && (
                    <TableHead className="text-center w-[100px]">
                      {language === "fr" ? "Sélectionner" : "Select"}
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparisonData.map((row, index) => {
                  const isSelected = selectedSimulationId === row.id;
                  return (
                    <TableRow
                      key={index}
                      className={`hover:bg-muted/50 ${isSelected ? "bg-primary/10 border-l-4 border-l-primary" : ""}`}
                      data-testid={`row-scenario-${index}`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: row.color }}
                          />
                          <span className="font-medium" data-testid={`text-scenario-name-${index}`}>{row.name}</span>
                          {bestNPV !== null && row.npv25 === bestNPV && row.npv25 > 0 && (
                            <Badge variant="default" className="text-xs gap-1" data-testid={`badge-best-${index}`}>
                              <Award className="w-3 h-3" />
                              {t("compare.best")}
                            </Badge>
                          )}
                          {isSelected && (
                            <Badge variant="outline" className="text-xs gap-1 border-primary text-primary" data-testid={`badge-selected-${index}`}>
                              <Check className="w-3 h-3" />
                              {language === "fr" ? "Affiché" : "Displayed"}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono" data-testid={`text-pv-${index}`}>
                        {formatNumber(row.pvSize, 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono" data-testid={`text-battery-${index}`}>
                        {row.batterySize > 0 ? formatNumber(row.batterySize, 0) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono" data-testid={`text-capex-${index}`}>
                        {formatCurrency(row.capexNet)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-primary" data-testid={`text-savings-${index}`}>
                        {formatCurrency(row.annualSavings)}
                      </TableCell>
                      <TableCell className="text-right font-mono" data-testid={`text-npv-${index}`}>
                        <span className={bestNPV !== null && row.npv25 === bestNPV ? "text-primary font-bold" : ""}>
                          {formatCurrency(row.npv25)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono" data-testid={`text-irr-${index}`}>
                        <span className={bestIRR !== null && row.irr25 === bestIRR && row.irr25 > 0 ? "text-primary font-bold" : ""}>
                          {formatPercent(row.irr25)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono" data-testid={`text-payback-${index}`}>
                        <span className={bestPayback !== null && row.payback === bestPayback && row.payback > 0 ? "text-primary font-bold" : ""}>
                          {row.payback > 0 ? `${formatNumber(row.payback, 1)} ${t("compare.years")}` : "-"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-green-600" data-testid={`text-co2-${index}`}>
                        {formatNumber(row.co2, 1)} t
                      </TableCell>
                      {onSelectSimulation && (
                        <TableCell className="text-center">
                          <Button
                            variant={isSelected ? "default" : "outline"}
                            size="sm"
                            onClick={() => onSelectSimulation(row.id)}
                            data-testid={`button-select-scenario-${index}`}
                          >
                            {isSelected ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              language === "fr" ? "Afficher" : "View"
                            )}
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Multi-Objective Optimization Comparison Table */}
      {referenceSimulation && optimalScenarios && (
        <Card data-testid="card-optimization-strategies">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="w-5 h-5 text-amber-500" />
              {language === "fr" ? "Stratégies d'optimisation" : "Optimization Strategies"}
            </CardTitle>
            <CardDescription>
              {language === "fr"
                ? "Comparez différentes stratégies pour trouver le système optimal selon vos priorités"
                : "Compare different strategies to find the optimal system for your priorities"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px]">{language === "fr" ? "Stratégie" : "Strategy"}</TableHead>
                    <TableHead className="text-right">{language === "fr" ? "Solaire (kW)" : "Solar (kW)"}</TableHead>
                    <TableHead className="text-right">{language === "fr" ? "Stockage" : "Storage"}</TableHead>
                    <TableHead className="text-right">{language === "fr" ? "CAPEX net" : "Net CAPEX"}</TableHead>
                    <TableHead className="text-right">VAN/NPV</TableHead>
                    <TableHead className="text-right">TRI/IRR</TableHead>
                    <TableHead className="text-right">{language === "fr" ? "Autonomie" : "Self-Suff"}</TableHead>
                    <TableHead className="text-right">{language === "fr" ? "Retour" : "Payback"}</TableHead>
                    <TableHead className="text-center">{language === "fr" ? "Action" : "Action"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Best NPV Row */}
                  {optimalScenarios.bestNPV && (
                    <TableRow className="bg-green-50/50 dark:bg-green-950/20" data-testid="row-strategy-npv">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-green-600" />
                          <div>
                            <span className="font-medium text-green-700 dark:text-green-400">
                              {language === "fr" ? "Meilleur VAN" : "Best NPV"}
                            </span>
                            <p className="text-xs text-muted-foreground">
                              {language === "fr" ? "Profit maximisé" : "Max profit"}
                            </p>
                          </div>
                          <Badge variant="outline" className="ml-1 text-xs bg-green-100 text-green-700 border-green-300">
                            {language === "fr" ? "Recommandé" : "Recommended"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatNumber(optimalScenarios.bestNPV.pvSizeKW, 0)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {optimalScenarios.bestNPV.battEnergyKWh > 0
                          ? `${formatNumber(optimalScenarios.bestNPV.battEnergyKWh, 0)} kWh`
                          : <span className="text-muted-foreground">-</span>
                        }
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(optimalScenarios.bestNPV.capexNet)}</TableCell>
                      <TableCell className="text-right font-mono font-bold text-green-600">{formatCurrency(optimalScenarios.bestNPV.npv25)}</TableCell>
                      <TableCell className="text-right font-mono">{formatNumber(optimalScenarios.bestNPV.irr25 * 100, 1)}%</TableCell>
                      <TableCell className="text-right font-mono">{formatNumber(optimalScenarios.bestNPV.selfSufficiencyPercent, 1)}%</TableCell>
                      <TableCell className="text-right font-mono">{formatNumber(optimalScenarios.bestNPV.simplePaybackYears, 1)} {language === "fr" ? "ans" : "yrs"}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="text-xs">
                          {language === "fr" ? "Affiché" : "Shown"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Best IRR Row */}
                  {optimalScenarios.bestIRR && optimalScenarios.bestIRR.id !== optimalScenarios.bestNPV?.id && (
                    <TableRow className="hover-elevate" data-testid="row-strategy-irr">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-blue-600" />
                          <div>
                            <span className="font-medium text-blue-700 dark:text-blue-400">
                              {language === "fr" ? "Meilleur TRI" : "Best IRR"}
                            </span>
                            <p className="text-xs text-muted-foreground">
                              {language === "fr" ? "Rendement maximisé" : "Max return %"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatNumber(optimalScenarios.bestIRR.pvSizeKW, 0)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {optimalScenarios.bestIRR.battEnergyKWh > 0
                          ? `${formatNumber(optimalScenarios.bestIRR.battEnergyKWh, 0)} kWh`
                          : <span className="text-muted-foreground">-</span>
                        }
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(optimalScenarios.bestIRR.capexNet)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(optimalScenarios.bestIRR.npv25)}</TableCell>
                      <TableCell className="text-right font-mono font-bold text-blue-600">{formatNumber(optimalScenarios.bestIRR.irr25 * 100, 1)}%</TableCell>
                      <TableCell className="text-right font-mono">{formatNumber(optimalScenarios.bestIRR.selfSufficiencyPercent, 1)}%</TableCell>
                      <TableCell className="text-right font-mono">{formatNumber(optimalScenarios.bestIRR.simplePaybackYears, 1)} {language === "fr" ? "ans" : "yrs"}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOptimizationClick('irr')}
                          data-testid="button-create-irr-variant"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          {language === "fr" ? "Variante" : "Variant"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Max Self-Sufficiency Row */}
                  {optimalScenarios.maxSelfSufficiency && optimalScenarios.maxSelfSufficiency.id !== optimalScenarios.bestNPV?.id && (
                    <TableRow className="hover-elevate" data-testid="row-strategy-self-sufficiency">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Battery className="w-4 h-4 text-purple-600" />
                          <div>
                            <span className="font-medium text-purple-700 dark:text-purple-400">
                              {language === "fr" ? "Autonomie max" : "Max Independence"}
                            </span>
                            <p className="text-xs text-muted-foreground">
                              {language === "fr" ? "Moins de réseau" : "Less grid"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatNumber(optimalScenarios.maxSelfSufficiency.pvSizeKW, 0)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {optimalScenarios.maxSelfSufficiency.battEnergyKWh > 0
                          ? `${formatNumber(optimalScenarios.maxSelfSufficiency.battEnergyKWh, 0)} kWh`
                          : <span className="text-muted-foreground">-</span>
                        }
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(optimalScenarios.maxSelfSufficiency.capexNet)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(optimalScenarios.maxSelfSufficiency.npv25)}</TableCell>
                      <TableCell className="text-right font-mono">{formatNumber(optimalScenarios.maxSelfSufficiency.irr25 * 100, 1)}%</TableCell>
                      <TableCell className="text-right font-mono font-bold text-purple-600">{formatNumber(optimalScenarios.maxSelfSufficiency.selfSufficiencyPercent, 1)}%</TableCell>
                      <TableCell className="text-right font-mono">{formatNumber(optimalScenarios.maxSelfSufficiency.simplePaybackYears, 1)} {language === "fr" ? "ans" : "yrs"}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOptimizationClick('selfSufficiency')}
                          data-testid="button-create-self-sufficiency-variant"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          {language === "fr" ? "Variante" : "Variant"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )}

                </TableBody>
              </Table>
            </div>

            {/* Legend / Explanation */}
            <div className="mt-4 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground space-y-2">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                <p>
                  {language === "fr"
                    ? "Ces stratégies représentent les meilleures configurations trouvées par l'analyse de sensibilité. Cliquez sur 'Variante' pour créer une proposition basée sur cette configuration."
                    : "These strategies represent the best configurations found by the sensitivity analysis. Click 'Variant' to create a proposal based on that configuration."}
                </p>
              </div>
              {/* Note about shared configurations */}
              {optimalScenarios && (
                (optimalScenarios.bestIRR?.id === optimalScenarios.bestNPV?.id ||
                 optimalScenarios.maxSelfSufficiency?.id === optimalScenarios.bestNPV?.id) && (
                <div className="flex items-start gap-2 border-t border-muted pt-2">
                  <span className="text-xs text-muted-foreground">
                    {language === "fr"
                      ? "Note: Certaines stratégies partagent la même configuration optimale et ne sont pas affichées séparément."
                      : "Note: Some strategies share the same optimal configuration and are not shown separately."}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* CreateVariantDialog for optimization presets */}
      {referenceSimulation && (
        <CreateVariantDialog
          simulation={referenceSimulation}
          siteId={site.id}
          onSuccess={handleOptimizationSuccess}
          externalOpen={optimizationDialogOpen}
          onExternalOpenChange={setOptimizationDialogOpen}
          preset={optimizationPreset}
          showTrigger={false}
        />
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Card data-testid="card-chart-npv">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {language === "fr" ? "VAN 25 ans" : "NPV 25 Years"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    fontSize={12}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    fontSize={12}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => label}
                  />
                  <Bar dataKey="npv25" name={language === "fr" ? "VAN 25 ans" : "NPV 25 Years"}>
                    {comparisonData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-chart-irr">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {language === "fr" ? "TRI 25 ans" : "IRR 25 Years"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                    fontSize={12}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    fontSize={12}
                  />
                  <Tooltip
                    formatter={(value: number) => `${(value * 100).toFixed(1)}%`}
                    labelFormatter={(label) => label}
                  />
                  <Bar dataKey="irr25" name={language === "fr" ? "TRI 25 ans" : "IRR 25 Years"}>
                    {comparisonData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-chart-savings">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {t("compare.savingsChart")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    fontSize={12}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    fontSize={12}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => label}
                  />
                  <Bar dataKey="annualSavings" name={t("compare.savings")}>
                    {comparisonData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-chart-payback">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {t("compare.paybackChart")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => `${v} ${t("compare.years")}`}
                    fontSize={12}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    fontSize={12}
                  />
                  <Tooltip
                    formatter={(value: number) => `${value.toFixed(1)} ${t("compare.years")}`}
                    labelFormatter={(label) => label}
                  />
                  <Bar dataKey="payback" name={t("compare.payback")}>
                    {comparisonData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-chart-sizing">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {t("compare.sizingChart")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="pvSize"
                    name={t("compare.pvSize")}
                    fill="#f5a623"
                  />
                  <Bar
                    dataKey="batterySize"
                    name={t("compare.batterySize")}
                    fill="#3b82f6"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
