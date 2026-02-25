import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Zap, Battery, BarChart3, DollarSign, Leaf, TrendingUp, TrendingDown,
  Sun, Shield, Car, Award, Sparkles, MousePointerClick, Plus, FileSignature,
  TreePine, Phone, ArrowRight, Star, AlertTriangle, CheckCircle2, CreditCard,
  Home, Calculator, Info, Settings, Loader2, Clock, Quote, Wrench, ListChecks, Users,
  Building2, CheckCircle, ChevronRight, Scale, X
} from "lucide-react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Bar, Legend, ComposedChart, Line, ReferenceLine,
  ScatterChart, Scatter, ZAxis, LineChart, BarChart, Cell
} from "recharts";
import type {
  FinancialBreakdown, AnalysisAssumptions, SensitivityAnalysis,
  FrontierPoint, HourlyProfileEntry, SimulationRun
} from "@shared/schema";
import { defaultAnalysisAssumptions, getBifacialConfigFromRoofColor } from "@shared/schema";
import { formatSmartPower, formatSmartEnergy, formatSmartCurrency, formatSmartNumber, formatSmartPercent } from "@shared/formatters";
import { getAssumptions, getExclusions, getEquipment, getTimeline, getAllStats, getNarrativeAct, getNarrativeTransition, getDesignFeeCovers, getClientProvides, getClientReceives } from "@shared/brandContent";
import { TIMELINE_GRADIENT } from "@shared/colors";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/lib/i18n";
import { MonteCarloAnalysis } from "@/components/monte-carlo-analysis";
import { RoofVisualization } from "@/components/RoofVisualization";
import { CreateVariantDialog } from "./CreateVariantDialog";
import { FinancingCalculator } from "./FinancingCalculator";
import { PriceBreakdownSection } from "./PriceBreakdownSection";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SiteWithDetails, VariantPreset, DisplayedScenarioType } from "../types";

const MONTH_NAMES_FR = ['', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTH_NAMES_EN = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function formatDollarSigned(value: number, lang: string = 'fr'): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${formatSmartCurrency(value, lang)}`;
}

type HqHistoryEntry = { period?: string; kWh?: number; kW?: number; amount?: number; days?: number };

function computeAnnualBillFromHQ(
  hqHistory: HqHistoryEntry[] | null | undefined,
  _meterFiles: Array<{ isSynthetic?: boolean | null }> | null | undefined,
  simulationEstimate: number,
): { amount: number; isReal: boolean } {
  if (hqHistory && Array.isArray(hqHistory) && hqHistory.length > 0) {
    const entriesWithAmount = hqHistory.filter(e => typeof e.amount === 'number' && e.amount > 0);
    if (entriesWithAmount.length >= 3) {
      const allHaveDays = entriesWithAmount.every(e => typeof e.days === 'number' && e.days > 0);
      const totalAmount = entriesWithAmount.reduce((sum, e) => sum + (e.amount || 0), 0);
      if (allHaveDays) {
        const totalDays = entriesWithAmount.reduce((sum, e) => sum + (e.days!), 0);
        const annualized = (totalAmount / totalDays) * 365;
        const hasSufficientCoverage = totalDays >= 300;
        return { amount: annualized, isReal: hasSufficientCoverage };
      }
      if (entriesWithAmount.length >= 10) {
        return { amount: totalAmount, isReal: true };
      }
      return { amount: totalAmount, isReal: false };
    }
  }

  return { amount: simulationEstimate, isReal: false };
}

export function AnalysisResults({
  simulation,
  site,
  isStaff = false,
  onNavigateToDesignAgreement,
  isLoadingFullData = false,
  optimizationTarget = 'npv',
  onOptimizationTargetChange,
  onOpenRoofDrawing,
  onCompareScenarios,
  onGeometryUpdate,
  onVisualizationCaptureReady,
}: {
  simulation: SimulationRun;
  site: SiteWithDetails;
  isStaff?: boolean;
  onNavigateToDesignAgreement?: () => void;
  isLoadingFullData?: boolean;
  optimizationTarget?: 'npv' | 'irr' | 'selfSufficiency';
  onOptimizationTargetChange?: (target: 'npv' | 'irr' | 'selfSufficiency') => void;
  onOpenRoofDrawing?: () => void;
  onCompareScenarios?: () => void;
  onGeometryUpdate?: (data: { maxCapacityKW: number; panelCount: number; realisticCapacityKW: number; constraintAreaSqM: number; arrays?: any[] }) => void;
  onVisualizationCaptureReady?: (captureFunc: (() => Promise<string | null>) | null) => void;
}) {
  const { t, language } = useI18n();
  const [showBreakdown, setShowBreakdown] = useState(true);
  const [showIncentives, setShowIncentives] = useState(true);
  const [syntheticWarningDismissed, setSyntheticWarningDismissed] = useState(false);
  const [variantDialogOpen, setVariantDialogOpen] = useState(false);
  const [variantPreset, setVariantPreset] = useState<VariantPreset | null>(null);
  const [showExtendedLifeAnalysis, setShowExtendedLifeAnalysis] = useState(false);

  const visualizationCaptureRef = useRef<(() => Promise<string | null>) | null>(null);
  const [roofGeometryCapacityKW, setRoofGeometryCapacityKW] = useState<number | null>(null);

  const handleChartPointClick = (data: any, _index: number, event?: React.MouseEvent) => {
    if (!isStaff) return;
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    const point = (data?.payload || data) as FrontierPoint | undefined;
    if (!point || !point.type) return;

    const pvKW = point.pvSizeKW || 0;
    const battKWh = point.battEnergyKWh || 0;
    const battPower = point.battPowerKW || Math.round(battKWh / 2);
    const actualType = pvKW > 0 && battKWh > 0 ? 'hybrid' :
                      pvKW > 0 ? 'solar' : 'battery';
    const typeLabel = actualType === 'hybrid' ? 'Hybride' :
                      actualType === 'solar' ? 'Solaire' : 'Stockage';
    const sizingLabel = actualType === 'hybrid'
      ? `${pvKW}kW + ${battKWh}kWh`
      : actualType === 'solar'
        ? `${pvKW}kW Solar`
        : `${battKWh}kWh`;

    setVariantPreset({
      pvSize: pvKW,
      batterySize: battKWh,
      batteryPower: battPower,
      label: `${typeLabel} ${sizingLabel}`,
    });
    setVariantDialogOpen(true);
  };

  const assumptions = (simulation.assumptions as AnalysisAssumptions | null) || defaultAnalysisAssumptions;
  const interpolatedMonths = (simulation.interpolatedMonths as number[] | null) || [];
  const breakdown = simulation.breakdown as FinancialBreakdown | null;

  useEffect(() => {
    if (breakdown && simulation.pvSizeKW && assumptions.solarCostPerW) {
      const expectedCapexSolar = simulation.pvSizeKW * 1000 * assumptions.solarCostPerW;
      const actualCapexSolar = breakdown.capexSolar || 0;
      const mismatchRatio = Math.abs(expectedCapexSolar - actualCapexSolar) / Math.max(expectedCapexSolar, 1);

      if (mismatchRatio > 0.1) {
        console.warn(
          `[BREAKDOWN MISMATCH] Financial breakdown may be stale!\n` +
          `  Solar Size: ${simulation.pvSizeKW} kW\n` +
          `  Expected CAPEX Solar: $${expectedCapexSolar.toFixed(0)}\n` +
          `  Actual CAPEX Solar: $${actualCapexSolar.toFixed(0)}\n` +
          `  Mismatch: ${(mismatchRatio * 100).toFixed(1)}%`
        );
      }
    }
  }, [breakdown, simulation.pvSizeKW, assumptions.solarCostPerW]);

  const usableRoofSqM = (assumptions.roofAreaSqFt / 10.764) * assumptions.roofUtilizationRatio;
  const maxPVFromRoof = (usableRoofSqM / 3.71) * 0.660;
  const effectiveMaxPV = roofGeometryCapacityKW !== null ? roofGeometryCapacityKW : maxPVFromRoof;
  const isRoofLimited = (simulation.pvSizeKW || 0) >= effectiveMaxPV * 0.95;

  const SectionDivider = ({ title, icon: Icon }: { title: string; icon?: any }) => (
    <div className="flex items-center gap-3 py-2">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-primary" />}
        <span className="text-sm font-semibold text-primary uppercase tracking-wider">{title}</span>
      </div>
      <div className="flex-1 h-px bg-border" />
    </div>
  );

  const NarrativeActHeader = ({ actKey }: { actKey: "act1_challenge" | "act2_solution" | "act3_results" | "act4_action" }) => {
    const act = getNarrativeAct(actKey, language as "fr" | "en");
    return (
      <div className="pt-6 pb-2">
        <h2 className="text-lg font-bold tracking-wide text-primary">{act.title}</h2>
        <p className="text-sm text-muted-foreground mt-1">{act.subtitle}</p>
      </div>
    );
  };

  const NarrativeTransition = ({ transitionKey }: { transitionKey: "challengeToSolution" | "solutionToResults" | "resultsToAction" }) => {
    const text = getNarrativeTransition(transitionKey, language as "fr" | "en");
    return (
      <div className="flex items-center gap-3 py-4">
        <ChevronRight className="w-4 h-4 text-primary flex-shrink-0" />
        <p className="text-sm italic text-muted-foreground">{text}</p>
      </div>
    );
  };

  const optimalScenario = simulation.sensitivity
    ? (simulation.sensitivity as SensitivityAnalysis).frontier.find(p => p.isOptimal)
    : null;

  const optimizationScenarios = useMemo(() => {
    if (!simulation.sensitivity) return null;
    const sensitivity = simulation.sensitivity as SensitivityAnalysis;
    const optScenarios = sensitivity.optimalScenarios;
    if (!optScenarios) return null;

    return {
      npv: optScenarios.bestNPV ? {
        pvSizeKW: optScenarios.bestNPV.pvSizeKW,
        battEnergyKWh: optScenarios.bestNPV.battEnergyKWh,
        battPowerKW: optScenarios.bestNPV.battPowerKW,
        npv25: optScenarios.bestNPV.npv25,
        irr25: optScenarios.bestNPV.irr25,
        selfSufficiencyPercent: optScenarios.bestNPV.selfSufficiencyPercent,
        simplePaybackYears: optScenarios.bestNPV.simplePaybackYears,
        capexNet: optScenarios.bestNPV.capexNet,
        annualSavings: optScenarios.bestNPV.annualSavings,
        totalProductionKWh: optScenarios.bestNPV.totalProductionKWh,
        co2AvoidedTonnesPerYear: optScenarios.bestNPV.co2AvoidedTonnesPerYear,
        scenarioBreakdown: optScenarios.bestNPV.scenarioBreakdown,
      } : null,
      irr: (() => {
        const src = optScenarios.bestIRR || optScenarios.bestNPV;
        if (!src) return null;
        return {
          pvSizeKW: src.pvSizeKW,
          battEnergyKWh: src.battEnergyKWh,
          battPowerKW: src.battPowerKW,
          npv25: src.npv25,
          irr25: src.irr25,
          selfSufficiencyPercent: src.selfSufficiencyPercent,
          simplePaybackYears: src.simplePaybackYears,
          capexNet: src.capexNet,
          annualSavings: src.annualSavings,
          totalProductionKWh: src.totalProductionKWh,
          co2AvoidedTonnesPerYear: src.co2AvoidedTonnesPerYear,
          scenarioBreakdown: src.scenarioBreakdown,
        };
      })(),
      selfSufficiency: optScenarios.maxSelfSufficiency ? {
        pvSizeKW: optScenarios.maxSelfSufficiency.pvSizeKW,
        battEnergyKWh: optScenarios.maxSelfSufficiency.battEnergyKWh,
        battPowerKW: optScenarios.maxSelfSufficiency.battPowerKW,
        npv25: optScenarios.maxSelfSufficiency.npv25,
        irr25: optScenarios.maxSelfSufficiency.irr25,
        selfSufficiencyPercent: optScenarios.maxSelfSufficiency.selfSufficiencyPercent,
        simplePaybackYears: optScenarios.maxSelfSufficiency.simplePaybackYears,
        capexNet: optScenarios.maxSelfSufficiency.capexNet,
        annualSavings: optScenarios.maxSelfSufficiency.annualSavings,
        totalProductionKWh: optScenarios.maxSelfSufficiency.totalProductionKWh,
        co2AvoidedTonnesPerYear: optScenarios.maxSelfSufficiency.co2AvoidedTonnesPerYear,
        scenarioBreakdown: optScenarios.maxSelfSufficiency.scenarioBreakdown,
      } : null,
    };
  }, [simulation.sensitivity]);

  const displayedScenario = useMemo(() => {
    const estimatedAnnualBillFallback = (simulation.annualConsumptionKWh || 0) * (assumptions.tariffEnergy || 0.06061);
    const fallbackScenario: DisplayedScenarioType = {
      pvSizeKW: simulation.pvSizeKW || 0,
      battEnergyKWh: simulation.battEnergyKWh || 0,
      battPowerKW: simulation.battPowerKW || 0,
      npv25: simulation.npv25 || 0,
      irr25: simulation.irr25 || 0,
      selfSufficiencyPercent: simulation.selfSufficiencyPercent || 0,
      simplePaybackYears: simulation.simplePaybackYears || 0,
      capexNet: simulation.capexNet || 0,
      annualSavings: simulation.annualSavings || 0,
      totalProductionKWh: simulation.totalProductionKWh || 0,
      co2AvoidedTonnesPerYear: simulation.co2AvoidedTonnesPerYear || 0,
      scenarioBreakdown: breakdown ? {
        capexSolar: breakdown.capexSolar || 0,
        capexBattery: breakdown.capexBattery || 0,
        capexGross: breakdown.capexGross || 0,
        actualHQSolar: breakdown.actualHQSolar || 0,
        actualHQBattery: breakdown.actualHQBattery || 0,
        itcAmount: breakdown.itcAmount || 0,
        taxShield: breakdown.taxShield || 0,
        totalExportedKWh: simulation.totalExportedKWh || 0,
        annualSurplusRevenue: simulation.annualSurplusRevenue || 0,
        estimatedAnnualBillBefore: estimatedAnnualBillFallback,
        estimatedAnnualBillAfter: Math.max(0, estimatedAnnualBillFallback - (simulation.annualSavings || 0)),
        lcoe: simulation.lcoe || 0,
        peakDemandAfterKW: simulation.peakDemandKW || 0,
        annualEnergySavingsKWh: simulation.annualEnergySavingsKWh || 0,
        cashflows: ((simulation.cashflows || []) as Array<{year: number; netCashflow: number}>),
      } : undefined,
    };

    if (!optimizationScenarios) {
      return fallbackScenario;
    }

    const selected = optimizationScenarios[optimizationTarget];
    if (!selected) {
      return { ...fallbackScenario, ...(optimizationScenarios.npv || {}) };
    }
    return { ...fallbackScenario, ...selected };
  }, [optimizationScenarios, optimizationTarget, simulation, breakdown, assumptions]);

  const annualBillInfo = useMemo(() => {
    const simulationEstimate = displayedScenario.scenarioBreakdown?.estimatedAnnualBillBefore
      || ((simulation.annualConsumptionKWh || 0) * (assumptions.tariffEnergy || 0.06061));
    return computeAnnualBillFromHQ(
      site?.hqConsumptionHistory as HqHistoryEntry[] | null,
      site?.meterFiles,
      simulationEstimate,
    );
  }, [site?.hqConsumptionHistory, site?.meterFiles, displayedScenario, simulation, assumptions]);

  const hourlyProfileData = useMemo(() => {
    const scenarioProfile = displayedScenario?.scenarioBreakdown?.hourlyProfileSummary;
    if (scenarioProfile && scenarioProfile.length > 0) {
      return scenarioProfile;
    }

    const rawProfile = simulation.hourlyProfile as HourlyProfileEntry[] | null;
    if (!rawProfile || rawProfile.length === 0) {
      return null;
    }

    const byHour: Map<number, {
      consumptionSum: number;
      productionSum: number;
      peakBeforeSum: number;
      peakAfterSum: number;
      count: number
    }> = new Map();

    for (const entry of rawProfile) {
      const existing = byHour.get(entry.hour) || {
        consumptionSum: 0,
        productionSum: 0,
        peakBeforeSum: 0,
        peakAfterSum: 0,
        count: 0
      };
      existing.consumptionSum += entry.consumption;
      existing.productionSum += entry.production;
      existing.peakBeforeSum += entry.peakBefore;
      existing.peakAfterSum += entry.peakAfter;
      existing.count++;
      byHour.set(entry.hour, existing);
    }

    const result = [];
    for (let h = 0; h < 24; h++) {
      const data = byHour.get(h);
      if (data && data.count > 0) {
        const avgConsumption = data.consumptionSum / data.count;
        const avgProduction = data.productionSum / data.count;
        const avgPeakBefore = data.peakBeforeSum / data.count;
        const consumptionAfter = avgConsumption - avgProduction;
        const peakAfterNet = Math.max(0, avgPeakBefore - avgProduction);
        result.push({
          hour: `${h}h`,
          consumptionBefore: Math.round(avgConsumption),
          consumptionAfter: Math.max(0, Math.round(consumptionAfter)),
          peakBefore: Math.round(avgPeakBefore),
          peakAfter: Math.round(peakAfterNet),
        });
      }
    }
    return result;
  }, [simulation.hourlyProfile, displayedScenario]);

  const optimizationLabels = {
    npv: { fr: "Meilleur VAN", en: "Best NPV", icon: DollarSign },
    irr: { fr: "Meilleur TRI", en: "Best IRR", icon: TrendingUp },
    selfSufficiency: { fr: "Autonomie max", en: "Max Independence", icon: Battery },
  };

  const dashboardPvSizeKW = displayedScenario.pvSizeKW ?? simulation.pvSizeKW ?? 0;
  const uncappedPvSizeKW = displayedScenario.pvSizeKW ?? simulation.pvSizeKW ?? 0;
  const displayedRoofCapacityKW = Math.round(effectiveMaxPV);
  const cappedPvSizeKW = displayedRoofCapacityKW > 0
    ? Math.min(uncappedPvSizeKW, displayedRoofCapacityKW)
    : uncappedPvSizeKW;
  const dashboardBattEnergyKWh = displayedScenario.battEnergyKWh ?? 0;
  const dashboardProductionMWh = displayedScenario.totalProductionKWh != null
    ? displayedScenario.totalProductionKWh / 1000
    : (dashboardPvSizeKW * (assumptions.solarYieldKWhPerKWp || 1150)) / 1000;
  const dashboardCoveragePercent = displayedScenario.selfSufficiencyPercent
    ?? simulation.selfSufficiencyPercent
    ?? ((simulation.selfConsumptionKWh && simulation.annualConsumptionKWh)
      ? (simulation.selfConsumptionKWh / simulation.annualConsumptionKWh) * 100
      : 0);
  const dashboardPaybackYears = displayedScenario.simplePaybackYears ?? simulation.simplePaybackYears ?? 0;
  const dashboardAnnualSavings = displayedScenario.annualSavings ?? simulation.annualSavings ?? 0;
  const dashboardNpv25 = displayedScenario.npv25 ?? simulation.npv25 ?? 0;
  const dashboardIrr25 = displayedScenario.irr25 ?? simulation.irr25 ?? 0;
  const dashboardCo2Tonnes = displayedScenario.co2AvoidedTonnesPerYear ?? simulation.co2AvoidedTonnesPerYear ?? 0;

  const waterfallData = useMemo(() => {
    const sb = displayedScenario.scenarioBreakdown;
    if (!sb) return null;
    const capexGross = sb.capexGross || 0;
    const hqSolar = sb.actualHQSolar || 0;
    const hqBattery = sb.actualHQBattery || 0;
    const itc = sb.itcAmount || 0;
    const taxShield = sb.taxShield || 0;
    const netCapex = displayedScenario.capexNet || 0;

    const items: Array<{name: string; base: number; value: number; fill: string; label: string; isEndpoint: boolean}> = [];
    let running = capexGross;
    items.push({
      name: language === "fr" ? "CAPEX Brut" : "Gross CAPEX",
      base: 0,
      value: capexGross,
      fill: "hsl(var(--muted-foreground))",
      label: `${formatSmartCurrency(capexGross, language)}`,
      isEndpoint: true
    });
    if (hqSolar > 0) {
      running -= hqSolar;
      items.push({
        name: language === "fr" ? "- Hydro-Québec Solaire" : "- Hydro-Québec Solar",
        base: running,
        value: hqSolar,
        fill: "#FFB005",
        label: `${formatSmartCurrency(-hqSolar, language)}`,
        isEndpoint: false
      });
    }
    if (hqBattery > 0) {
      running -= hqBattery;
      items.push({
        name: language === "fr" ? "- Hydro-Québec Stockage" : "- Hydro-Québec Battery",
        base: running,
        value: hqBattery,
        fill: "#FFB005",
        label: `${formatSmartCurrency(-hqBattery, language)}`,
        isEndpoint: false
      });
    }
    if (itc > 0) {
      running -= itc;
      items.push({
        name: language === "fr" ? "- CII 30%" : "- ITC 30%",
        base: running,
        value: itc,
        fill: "#3B82F6",
        label: `${formatSmartCurrency(-itc, language)}`,
        isEndpoint: false
      });
    }
    if (taxShield > 0) {
      running -= taxShield;
      items.push({
        name: language === "fr" ? "- Bouclier DPA" : "- Tax Shield CCA",
        base: running,
        value: taxShield,
        fill: "#3B82F6",
        label: `${formatSmartCurrency(-taxShield, language)}`,
        isEndpoint: false
      });
    }
    items.push({
      name: language === "fr" ? "CAPEX Net" : "Net CAPEX",
      base: 0,
      value: netCapex,
      fill: "hsl(var(--primary))",
      label: `${formatSmartCurrency(netCapex, language)}`,
      isEndpoint: true
    });
    return items;
  }, [displayedScenario, language]);


  return (
    <div className="space-y-6">

      {site?.meterFiles?.some((f: any) => f.isSynthetic) && !syntheticWarningDismissed && (
        <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-amber-800 dark:text-amber-300">
              {language === "fr" ? "Résultats basés sur un profil synthétique" : "Results based on synthetic profile"}
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-400">
              {language === "fr"
                ? "Cette analyse utilise des données de consommation synthétiques. Les résultats financiers et techniques sont indicatifs et seront recalculés avec les données réelles du client."
                : "This analysis uses synthetic consumption data. Financial and technical results are indicative and will be recalculated with actual client data."}
            </p>
          </div>
          <button
            onClick={() => setSyntheticWarningDismissed(true)}
            className="shrink-0 p-0.5 rounded hover-elevate text-amber-600 dark:text-amber-400"
            data-testid="button-dismiss-synthetic-warning"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* EXECUTIVE SUMMARY                                              */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-xs text-primary font-semibold uppercase tracking-wider mb-1">
                {language === "fr" ? "Voici votre opportunité" : "Your opportunity awaits"}
              </p>
              <h1 className="text-2xl font-bold">
                {site?.name || (language === "fr" ? "Votre projet solaire" : "Your Solar Project")}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {language === "fr"
                  ? `${formatSmartPower(cappedPvSizeKW, language)} solaire${(displayedScenario.battEnergyKWh || 0) > 0 ? ` + ${formatSmartEnergy(displayedScenario.battEnergyKWh || 0, language)} stockage` : ''}`
                  : `${formatSmartPower(cappedPvSizeKW, language, 'kW')} solar${(displayedScenario.battEnergyKWh || 0) > 0 ? ` + ${formatSmartEnergy(displayedScenario.battEnergyKWh || 0, language)} storage` : ''}`}
              </p>
              {site?.meterFiles?.some((f: any) => f.isSynthetic) && (
                <Badge variant="outline" className="mt-2 border-amber-400 text-amber-700 bg-amber-50 gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {language === "fr" ? "Basé sur un profil synthétique" : "Based on synthetic profile"}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold font-mono text-primary">{formatSmartCurrency(dashboardAnnualSavings || 0, language)}</p>
                <p className="text-xs text-muted-foreground">{language === "fr" ? "économies/an" : "savings/yr"}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold font-mono">{(dashboardPaybackYears || 0).toFixed(1)} {language === "fr" ? "ans" : "yrs"}</p>
                <p className="text-xs text-muted-foreground">{language === "fr" ? "retour" : "payback"}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold font-mono text-green-600">{formatSmartCurrency(dashboardNpv25 || 0, language)}</p>
                <p className="text-xs text-muted-foreground">{language === "fr" ? "VAN 25 ans" : "NPV 25 yrs"}</p>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <a href="#next-steps-cta">
              <Button size="sm" className="gap-2" data-testid="button-exec-summary-cta">
                <ArrowRight className="w-4 h-4" />
                {language === "fr" ? "Voir les prochaines étapes" : "View next steps"}
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ACT 1: THE ENERGY CHALLENGE                                    */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <NarrativeActHeader actKey="act1_challenge" />

      <SectionDivider
        title={language === "fr" ? "Votre bâtiment" : "Your Building"}
        icon={Building2}
      />

      <Card>
        <CardContent className="py-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FFB005]/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-[#FFB005]" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{language === "fr" ? "Consommation annuelle" : "Annual Consumption"}</p>
                <p className="text-lg font-bold font-mono" data-testid="text-annual-consumption">
                  {formatSmartEnergy(simulation.annualConsumptionKWh || 0, language)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{language === "fr" ? "Demande de pointe" : "Peak Demand"}</p>
                <p className="text-lg font-bold font-mono" data-testid="text-peak-demand">
                  {(simulation.peakDemandKW || 0).toFixed(0)} <span className="text-sm font-normal">kW</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{language === "fr" ? "Tarif Hydro-Québec" : "Hydro-Québec Tariff"}</p>
                <p className="text-lg font-bold font-mono" data-testid="text-tariff">
                  {assumptions.tariffCode || (language === "fr" ? "M / G" : "M / G")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {annualBillInfo.isReal
                    ? (language === "fr" ? "Facture annuelle" : "Annual Bill")
                    : (language === "fr" ? "Facture annuelle est." : "Est. Annual Bill")}
                </p>
                <p className="text-lg font-bold font-mono text-red-600" data-testid="text-est-bill">
                  {formatSmartCurrency(annualBillInfo.amount, language)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <NarrativeTransition transitionKey="challengeToSolution" />

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ACT 2: OUR SOLUTION                                            */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <NarrativeActHeader actKey="act2_solution" />

      <SectionDivider
        title={language === "fr" ? "Aperçu du projet" : "Project Snapshot"}
        icon={Zap}
      />

      <Card id="pdf-section-system-config" className="border-primary/20">
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Zap className="w-6 h-6 text-primary" />
                {language === "fr" ? "Configuration optimale" : "Optimal Configuration"}
              </CardTitle>
              <CardDescription>
                {language === "fr"
                  ? "Sélectionnez votre objectif d'optimisation"
                  : "Select your optimization objective"}
              </CardDescription>
            </div>

            {optimizationScenarios && (
              <div className="flex flex-col items-end gap-1">
                <ToggleGroup
                  type="single"
                  value={optimizationTarget}
                  onValueChange={(value) => {
                    if (value && onOptimizationTargetChange) {
                      onOptimizationTargetChange(value as 'npv' | 'irr' | 'selfSufficiency');
                    }
                  }}
                  className="flex-wrap justify-start sm:justify-end border rounded-lg p-1 bg-muted/30"
                  data-testid="toggle-optimization-target"
                >
                  {(['npv', 'irr', 'selfSufficiency'] as const).map((target) => {
                    const label = optimizationLabels[target];
                    const scenario = optimizationScenarios[target];
                    if (!scenario) return null;
                    const Icon = label.icon;
                    const isSelected = optimizationTarget === target;
                    return (
                      <ToggleGroupItem
                        key={target}
                        value={target}
                        className={`flex items-center gap-1.5 px-3 py-2 text-xs transition-all duration-200
                          data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-md
                          data-[state=off]:hover:bg-muted/80
                          ${isSelected ? 'ring-2 ring-primary/30 ring-offset-1' : ''}`}
                        data-testid={`toggle-${target}`}
                      >
                        <Icon className={`w-4 h-4 ${isSelected ? '' : 'opacity-70'}`} />
                        <span className="hidden sm:inline font-medium">{language === "fr" ? label.fr : label.en}</span>
                      </ToggleGroupItem>
                    );
                  })}
                </ToggleGroup>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  {language === "fr" ? "Cliquez pour changer les données" : "Click to change data"}
                </p>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-4 gap-6">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Sun className="w-6 h-6 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{language === "fr" ? "Panneaux solaires" : "Solar Panels"}</p>
                <p className="text-2xl font-bold font-mono text-primary" data-testid="text-pv-size">{formatSmartPower(cappedPvSizeKW, language)}</p>
                {cappedPvSizeKW > 1000 && (
                  <Badge variant="destructive" className="mt-1 text-xs inline-flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span className="truncate">{language === "fr" ? "Dépasse 1 MW (limite HQ)" : "Exceeds 1 MW (HQ limit)"}</span>
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Battery className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{language === "fr" ? "Stockage énergie" : "Energy Storage"}</p>
                <p className="text-2xl font-bold font-mono text-primary" data-testid="text-battery-size">{formatSmartEnergy(displayedScenario.battEnergyKWh || 0, language)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{language === "fr" ? "Puissance stockage" : "Storage Power"}</p>
                <p className="text-2xl font-bold font-mono text-primary" data-testid="text-battery-power">{(displayedScenario.battPowerKW || 0).toFixed(0)} <span className="text-sm font-normal">kW</span></p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center">
                <Home className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{language === "fr" ? "Capacité toit estimée" : "Est. Roof Capacity"}</p>
                <p className="text-lg font-bold font-mono">{formatSmartPower(displayedRoofCapacityKW, language)}</p>
                {isRoofLimited && (
                  <Badge variant="secondary" className="mt-1 text-xs">
                    {language === "fr" ? "Limité par le toit" : "Roof limited"}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Roof Configuration (moved up into Act 2) */}
      {site && site.latitude && site.longitude && import.meta.env.VITE_GOOGLE_MAPS_API_KEY && dashboardPvSizeKW > 0 && (
        <>
          <SectionDivider
            title={language === "fr" ? "Configuration du toit" : "Roof Configuration"}
            icon={Home}
          />
          <RoofVisualization
            siteId={site.id}
            siteName={site.name}
            address={site.address || ""}
            latitude={site.latitude}
            longitude={site.longitude}
            roofAreaSqFt={assumptions.roofAreaSqFt}
            maxPVCapacityKW={maxPVFromRoof}
            currentPVSizeKW={cappedPvSizeKW || undefined}
            onGeometryCalculated={(data) => {
              if (data.maxCapacityKW != null && data.maxCapacityKW > 0 && !isNaN(data.maxCapacityKW)) {
                setRoofGeometryCapacityKW(data.maxCapacityKW);
                const savedKw = site.kbKwDc;
                const newKw = Math.round(data.maxCapacityKW);
                if (!savedKw || Math.abs(savedKw - newKw) > 1) {
                  // Guard: never auto-overwrite if new value is < 50% of saved value
                  if (savedKw && newKw < savedKw * 0.5) {
                    console.warn(
                      `[RoofVisualization] Skipping auto-save: new kbKwDc (${newKw} kW) is less than 50% of saved value (${savedKw} kW). ` +
                      `This likely indicates incorrect polygons. User must redraw roof manually.`
                    );
                  } else {
                    apiRequest("PATCH", `/api/sites/${site.id}`, {
                      kbPanelCount: data.panelCount,
                      kbKwDc: newKw
                    }).then(() => {
                      queryClient.invalidateQueries({ queryKey: ['/api/sites', site.id] });
                    }).catch(err => console.error('Failed to save roof capacity:', err));
                  }
                }
                // Propagate full geometry data (including arrays) to parent for SLD
                onGeometryUpdate?.(data);
              }
              visualizationCaptureRef.current = null;
              onVisualizationCaptureReady?.(null);
            }}
            onVisualizationReady={(captureFunc) => { visualizationCaptureRef.current = captureFunc; onVisualizationCaptureReady?.(captureFunc); }}
            onOpenRoofDrawing={onOpenRoofDrawing}
          />
        </>
      )}

      <NarrativeTransition transitionKey="solutionToResults" />

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ACT 3: YOUR RESULTS                                            */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <NarrativeActHeader actKey="act3_results" />

      <SectionDivider
        title={language === "fr" ? "Voici le potentiel de votre bâtiment" : "Here's your building's potential"}
        icon={Star}
      />

      <div id="pdf-section-value-proposition" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-amber-500 border-t-0 border-r-0 border-b-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-amber-500" />
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {language === "fr" ? "Économies annuelles" : "Annual Savings"}
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold font-mono" data-testid="text-savings">
                {formatSmartCurrency(dashboardAnnualSavings || 0, language)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {language === "fr" ? "par année" : "per year"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-slate-400 border-t-0 border-r-0 border-b-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-4 h-4 text-slate-400" />
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {language === "fr" ? "Investissement Net" : "Net Investment"}
              </p>
            </div>
            <p className="text-2xl font-bold font-mono" data-testid="text-capex-net">
              {formatSmartCurrency(displayedScenario.capexNet || 0, language)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {language === "fr" ? "après incitatifs" : "after incentives"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 border-t-0 border-r-0 border-b-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {language === "fr" ? "Profit net sur 25 ans" : "Net profit over 25 years"}
              </p>
            </div>
            <p className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400" data-testid="text-npv">
              {formatSmartCurrency(dashboardNpv25 || 0, language)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {language === "fr" ? "après 25 ans" : "after 25 years"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 border-t-0 border-r-0 border-b-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-green-500" />
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {language === "fr" ? "TRI 25 ans" : "IRR 25 years"}
              </p>
            </div>
            <p className="text-2xl font-bold font-mono text-green-600 dark:text-green-400" data-testid="text-irr">
              {((dashboardIrr25 || 0) * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {language === "fr" ? "rendement annuel" : "annual return"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">{language === "fr" ? "Autosuffisance" : "Self-sufficiency"}</p>
            <p className="text-lg font-bold font-mono" data-testid="text-self-sufficiency">{(dashboardCoveragePercent || 0).toFixed(0)}%</p>
          </div>
          <Progress value={dashboardCoveragePercent || 0} className="h-2 w-16" />
        </div>
        <div className="p-3 bg-muted/30 rounded-lg border">
          <p className="text-xs text-muted-foreground">{language === "fr" ? "Retour simple" : "Payback"}</p>
          <p className="text-lg font-bold font-mono" data-testid="text-payback">{(dashboardPaybackYears || 0).toFixed(1)} {language === "fr" ? "ans" : "yrs"}</p>
        </div>
        <div className="p-3 bg-muted/30 rounded-lg border">
          <p className="text-xs text-muted-foreground">LCOE</p>
          <p className="text-lg font-bold font-mono" data-testid="text-lcoe">${(displayedScenario.scenarioBreakdown?.lcoe || simulation.lcoe || 0).toFixed(3)}/kWh</p>
        </div>
        <div className="p-3 bg-muted/30 rounded-lg border">
          <p className="text-xs text-muted-foreground">CO₂ {language === "fr" ? "évité" : "avoided"}</p>
          <p className="text-lg font-bold font-mono text-green-600 dark:text-green-400" data-testid="text-co2">{(dashboardCo2Tonnes || 0).toFixed(1)} t/{language === "fr" ? "an" : "yr"}</p>
        </div>
      </div>

      {/* Environmental Impact (moved up from bottom) */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-2 mb-3">
            <Leaf className="w-4 h-4 text-green-500" />
            <div>
              <span className="text-sm font-semibold">{language === "fr" ? "Votre impact sur la planète" : "Your impact on the planet"}</span>
              <p className="text-xs text-muted-foreground mt-0.5">
                {language === "fr" ? "Équivalent à planter des arbres et retirer des voitures de la route" : "Equivalent to planting trees and removing cars from the road"}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              <Leaf className="w-5 h-5 text-green-500 flex-shrink-0" />
              <div>
                <p className="text-lg font-bold font-mono">{((dashboardCo2Tonnes || 0) * 25).toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">{language === "fr" ? "t CO₂ évitées (25a)" : "t CO₂ avoided (25y)"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Car className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-lg font-bold font-mono">{(((dashboardCo2Tonnes || 0) / 4.6) * 25).toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">{language === "fr" ? "années-auto retirées" : "car-years removed"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <TreePine className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-lg font-bold font-mono">{Math.round(((dashboardCo2Tonnes || 0) * 25) / 0.022)}</p>
                <p className="text-xs text-muted-foreground">{language === "fr" ? "arbres équivalents" : "trees equivalent"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Award className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <div>
                <p className="text-lg font-bold font-mono">{(dashboardCoveragePercent || 0).toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">{language === "fr" ? "autosuffisance" : "self-sufficiency"}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Strategic Benefits (client-visible version) */}
      {(() => {
        const pvKW = displayedScenario.pvSizeKW || 0;
        const battKWh = displayedScenario.battEnergyKWh || 0;
        const battPowerKW = displayedScenario.battPowerKW || 0;

        const avgLoadKW = battPowerKW > 0 ? battPowerKW * 0.5 : (simulation.peakDemandKW ? simulation.peakDemandKW * 0.3 : 0);
        const backupHours = (battKWh > 0 && avgLoadKW > 0) ? (battKWh / avgLoadKW) : 0;
        const selfSufficiency = dashboardCoveragePercent || 0;
        const propertyValueIncrease = pvKW * 1000;

        const hasSolar = pvKW > 0;
        const hasBattery = battKWh > 0;

        if (!hasSolar && !hasBattery) return null;

        return (
          <Card className="border-primary/10">
            <CardContent className="py-5">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">{language === "fr" ? "Bénéfices stratégiques" : "Strategic Benefits"}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {hasBattery && backupHours > 0 && (
                  <div className="p-4 bg-muted/30 rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-medium">{language === "fr" ? "Résilience" : "Resilience"}</span>
                    </div>
                    <p className="text-2xl font-bold font-mono text-blue-600">
                      {backupHours >= 1 ? `${backupHours.toFixed(1)}h` : `${Math.round(backupHours * 60)}min`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{language === "fr" ? "autonomie en cas de panne" : "backup during outage"}</p>
                  </div>
                )}
                {hasSolar && (
                  <div className="p-4 bg-muted/30 rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                      <Award className="w-4 h-4 text-amber-500" />
                      <span className="text-sm font-medium">{language === "fr" ? "Indépendance énergétique" : "Energy Independence"}</span>
                    </div>
                    <p className="text-2xl font-bold font-mono text-amber-600">{selfSufficiency.toFixed(0)}%</p>
                    <p className="text-xs text-muted-foreground mt-1">{language === "fr" ? "de vos besoins couverts" : "of your needs covered"}</p>
                  </div>
                )}
                {hasSolar && propertyValueIncrease > 0 && (
                  <div className="p-4 bg-muted/30 rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-purple-500" />
                      <span className="text-sm font-medium">{language === "fr" ? "Valeur immobilière" : "Property Value"}</span>
                    </div>
                    <p className="text-2xl font-bold font-mono text-purple-600">
                      {formatDollarSigned(propertyValueIncrease, language)}
                    </p>
                    <a href="/blog/solaire-valeur-immobiliere-commercial" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-1 inline-block">{language === "fr" ? "~$1k/kWc (voir les études)" : "~$1k/kW (see studies)"}</a>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SECTION 3: NET INVESTMENT BREAKDOWN (Waterfall)                */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <SectionDivider
        title={language === "fr" ? "Ventilation de l'investissement" : "Investment Breakdown"}
        icon={DollarSign}
      />

      {waterfallData ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">
              {language === "fr" ? "Du coût brut à l'investissement net" : "From Gross Cost to Net Investment"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={waterfallData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    angle={-15}
                    textAnchor="end"
                    height={55}
                    interval={0}
                  />
                  <YAxis
                    tickFormatter={(v) => formatSmartCurrency(v, language)}
                    className="text-xs"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === "base") return [null, null];
                      return [`$${Math.round(value as number).toLocaleString()}`, language === "fr" ? "Montant" : "Amount"];
                    }}
                  />
                  <Bar dataKey="base" stackId="stack" fill="transparent" fillOpacity={0} strokeOpacity={0} isAnimationActive={false} />
                  <Bar
                    dataKey="value"
                    stackId="stack"
                    radius={[3, 3, 0, 0]}
                    label={{
                      position: "top",
                      formatter: (_v: number, _n: string, props: any) => {
                        const item = waterfallData?.[props?.index];
                        return item?.label || '';
                      },
                      style: { fontSize: 11, fontFamily: "monospace", fill: "hsl(var(--foreground))" }
                    }}
                  >
                    {waterfallData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 gap-6 items-center">
              <div className="text-center p-4 bg-muted/30 rounded-lg border">
                <p className="text-sm text-muted-foreground mb-1">{language === "fr" ? "CAPEX brut estimé" : "Est. Gross CAPEX"}</p>
                <p className="text-2xl font-bold font-mono">
                  {formatSmartCurrency((displayedScenario.capexNet || 0) * 1.6, language)}
                </p>
              </div>
              <div className="text-center p-4 bg-primary/5 rounded-lg border border-primary/20">
                <p className="text-sm text-muted-foreground mb-1">{language === "fr" ? "CAPEX net" : "Net CAPEX"}</p>
                <p className="text-2xl font-bold font-mono text-primary">
                  {formatSmartCurrency(displayedScenario.capexNet || 0, language)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{language === "fr" ? "après incitatifs" : "after incentives"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isStaff && <PriceBreakdownSection siteId={site.id} />}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SECTION 5: FINANCIAL PROJECTIONS                               */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <SectionDivider
        title={language === "fr" ? "Projections financières" : "Financial Projections"}
        icon={TrendingUp}
      />

      {/* 5a: Bill Comparison */}
      {(() => {
        const annualBill = annualBillInfo.amount;
        const annualSavings = (displayedScenario.annualSavings ?? simulation.annualSavings) || 0;
        const estimatedBillAfter = displayedScenario.scenarioBreakdown?.estimatedAnnualBillAfter ?? Math.max(0, annualBill - annualSavings);
        const savingsPercent = annualBill > 0 ? Math.round((annualSavings / annualBill) * 100) : 0;

        return (
          <Card id="pdf-section-billing">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="font-semibold">
                    {language === "fr" ? "L'impact sur votre facture" : "Transform your energy bill"}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {language === "fr"
                      ? `Ne rien faire vous coûtera $${Math.round(annualBill * 25).toLocaleString()} sur 25 ans`
                      : `Doing nothing will cost you $${Math.round(annualBill * 25).toLocaleString()} over 25 years`}
                  </p>
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-6 items-center">
                <div className="text-center p-4 bg-muted/30 rounded-xl border">
                  <p className="text-sm text-muted-foreground mb-1">
                    {language === "fr" ? "Facture actuelle" : "Current bill"}
                  </p>
                  <p className="text-3xl font-bold font-mono text-red-600 dark:text-red-400" data-testid="text-annual-bill-before">
                    {formatSmartCurrency(annualBill || 0, language)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {annualBillInfo.isReal
                      ? (language === "fr" ? "/année (réel)" : "/year (actual)")
                      : (language === "fr" ? "/année (estimé)" : "/year (estimated)")}
                  </p>
                </div>

                <div className="flex flex-col items-center justify-center">
                  <div className="hidden md:flex items-center gap-2">
                    <div className="h-0.5 w-8 bg-green-500"></div>
                    <ArrowRight className="w-6 h-6 text-green-500" />
                  </div>
                  <div className="md:mt-2 p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <p className="text-xs text-green-700 dark:text-green-300 font-medium text-center">
                      {language === "fr" ? "Économie" : "Savings"} ({savingsPercent}%)
                    </p>
                    <p className="text-xl font-bold font-mono text-green-700 dark:text-green-300 text-center" data-testid="text-annual-savings-highlight">
                      {formatSmartCurrency(-(annualSavings || 0), language)}
                    </p>
                  </div>
                </div>

                <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-xl border border-green-200 dark:border-green-800">
                  <p className="text-sm text-muted-foreground mb-1">
                    {language === "fr"
                      ? `Facture après ${displayedScenario.pvSizeKW > 0 && displayedScenario.battEnergyKWh > 0 ? 'solaire + stockage' : displayedScenario.pvSizeKW > 0 ? 'solaire' : 'stockage'}`
                      : `Bill after ${displayedScenario.pvSizeKW > 0 && displayedScenario.battEnergyKWh > 0 ? 'solar + storage' : displayedScenario.pvSizeKW > 0 ? 'solar' : 'storage'}`}
                  </p>
                  <p className="text-3xl font-bold font-mono text-green-600 dark:text-green-400" data-testid="text-annual-bill-after">
                    {formatSmartCurrency(estimatedBillAfter || 0, language)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{language === "fr" ? "/année (énergie)" : "/year (energy)"}</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground mt-4 text-center">
                {language === "fr"
                  ? "* Estimation basée sur le tarif énergétique. La facture réelle inclut aussi les frais de puissance."
                  : "* Estimate based on energy tariff. Actual bill also includes demand charges."}
              </p>
            </CardContent>
          </Card>
        );
      })()}

      {/* 5b: Surplus Credits (Net Metering) */}
      {displayedScenario.pvSizeKW > 0 && (displayedScenario.scenarioBreakdown?.totalExportedKWh || 0) > 0 && (displayedScenario.scenarioBreakdown?.annualSurplusRevenue || 0) > 0 && (
        <Card className="border-blue-200 dark:border-blue-800">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {language === "fr" ? "Crédits de surplus Hydro-Québec" : "Hydro-Québec Surplus Credits"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {language === "fr" ? "Programme d'autoproduction (mesurage net)" : "Self-production program (net metering)"}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">
                  {language === "fr" ? "Surplus annuel exporté" : "Annual surplus exported"}
                </p>
                <p className="text-lg font-bold font-mono text-blue-600 dark:text-blue-400">
                  {formatSmartEnergy(displayedScenario.scenarioBreakdown?.totalExportedKWh || 0, language)}
                </p>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">
                  {language === "fr" ? "Valeur annuelle des crédits" : "Annual credit value"}
                </p>
                <p className="text-lg font-bold font-mono text-green-600 dark:text-green-400">
                  ${Math.round(displayedScenario.scenarioBreakdown?.annualSurplusRevenue || 0).toLocaleString()}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              {language === "fr"
                ? "Les crédits kWh compensent votre facture pendant 24 mois. Le surplus non utilisé après 24 mois est compensé au tarif de référence (~4,54¢/kWh)."
                : "kWh credits offset your bill for up to 24 months. Unused surplus after 24 months is compensated at the reference rate (~4.54¢/kWh)."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* 5c: Financial KPIs with 25/30 Year Toggle */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">
              {language === "fr" ? "Horizon d'analyse financière" : "Financial Analysis Horizon"}
            </p>
            <p className="text-xs text-muted-foreground">
              {showExtendedLifeAnalysis
                ? (language === "fr" ? "30 ans - Durée de vie réelle des panneaux" : "30 years - Real panel lifetime")
                : (language === "fr" ? "25 ans - Standard de l'industrie (bancable)" : "25 years - Industry standard (bankable)")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm ${!showExtendedLifeAnalysis ? 'font-medium text-primary' : 'text-muted-foreground'}`}>25 {language === "fr" ? "ans" : "yrs"}</span>
            <Switch
              checked={showExtendedLifeAnalysis}
              onCheckedChange={setShowExtendedLifeAnalysis}
              data-testid="toggle-extended-life"
            />
            <span className={`text-sm ${showExtendedLifeAnalysis ? 'font-medium text-primary' : 'text-muted-foreground'}`}>30 {language === "fr" ? "ans" : "yrs"}</span>
          </div>
        </div>


        <div id="pdf-section-kpis" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-primary" />
                <p className="text-sm text-muted-foreground">
                  {language === "fr"
                    ? `Profit net ${showExtendedLifeAnalysis ? "30" : "25"} ans`
                    : `Net Profit ${showExtendedLifeAnalysis ? "30" : "25"} years`}
                </p>
              </div>
              <p className="text-2xl font-bold font-mono text-primary">
                {formatSmartCurrency(showExtendedLifeAnalysis ? (simulation.npv30 || displayedScenario.npv25 || 0) : (displayedScenario.npv25 || 0), language)}
              </p>
              {showExtendedLifeAnalysis && simulation.npv30 && displayedScenario.npv25 && (
                <p className="text-xs text-green-600 mt-1">
                  {formatDollarSigned((simulation.npv30 || 0) - (displayedScenario.npv25 || 0), language)} {language === "fr" ? "vs 25 ans" : "vs 25 yrs"}
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-primary" />
                <p className="text-sm text-muted-foreground">
                  {language === "fr"
                    ? `TRI ${showExtendedLifeAnalysis ? "30" : "25"} ans`
                    : `IRR ${showExtendedLifeAnalysis ? "30" : "25"} Year`}
                </p>
              </div>
              <p className="text-2xl font-bold font-mono text-primary">
                {((showExtendedLifeAnalysis ? (simulation.irr30 || displayedScenario.irr25 || 0) : (displayedScenario.irr25 || 0)) * 100).toFixed(1)}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calculator className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {language === "fr"
                    ? `LCOE (Coût moyen ${showExtendedLifeAnalysis ? "30" : "25"} ans)`
                    : `LCOE (${showExtendedLifeAnalysis ? "30" : "25"} yr avg cost)`}
                </p>
              </div>
              <p className="text-2xl font-bold font-mono">
                ${(showExtendedLifeAnalysis ? (simulation.lcoe30 || displayedScenario.scenarioBreakdown?.lcoe || simulation.lcoe || 0) : (displayedScenario.scenarioBreakdown?.lcoe || simulation.lcoe || 0)).toFixed(3)}
                <span className="text-sm font-normal text-muted-foreground">/kWh</span>
              </p>
              {showExtendedLifeAnalysis && simulation.lcoe30 && (displayedScenario.scenarioBreakdown?.lcoe || simulation.lcoe) && (
                <p className="text-xs text-green-600 mt-1">
                  -{(((displayedScenario.scenarioBreakdown?.lcoe || simulation.lcoe || 0) - (simulation.lcoe30 || 0)) * 100 / (displayedScenario.scenarioBreakdown?.lcoe || simulation.lcoe || 1)).toFixed(0)}% {language === "fr" ? "vs 25 ans" : "vs 25 yrs"}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Leaf className="w-4 h-4 text-green-500" />
                <p className="text-sm text-muted-foreground">CO₂ {language === "fr" ? "évité" : "avoided"}</p>
              </div>
              <p className="text-2xl font-bold font-mono text-green-600">
                {((displayedScenario.co2AvoidedTonnesPerYear || 0) * (showExtendedLifeAnalysis ? 30 : 25)).toFixed(0)}
                <span className="text-sm font-normal"> t/{showExtendedLifeAnalysis ? "30" : "25"} {language === "fr" ? "ans" : "yrs"}</span>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 5d: Hourly Profile Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {language === "fr" ? "Profil moyen (Avant vs Après)" : "Average Profile (Before vs After)"}
          </CardTitle>
          {(!displayedScenario?.scenarioBreakdown?.hourlyProfileSummary) &&
            (displayedScenario.pvSizeKW !== (simulation.pvSizeKW || 0) ||
             displayedScenario.battEnergyKWh !== (simulation.battEnergyKWh || 0)) && (
            <p className="text-xs text-muted-foreground mt-1">
              {language === "fr"
                ? `Profil basé sur la configuration initiale (${formatSmartPower(simulation.pvSizeKW || 0, language)} Solaire + ${formatSmartEnergy(simulation.battEnergyKWh || 0, language)} stockage)`
                : `Profile based on initial configuration (${formatSmartPower(simulation.pvSizeKW || 0, language, 'kW')} Solar + ${formatSmartEnergy(simulation.battEnergyKWh || 0, language)} storage)`}
            </p>
          )}
        </CardHeader>
        <CardContent>
          {hourlyProfileData && hourlyProfileData.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={hourlyProfileData} margin={{ top: 10, right: 40, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="hour"
                    className="text-xs"
                    label={{ value: language === "fr" ? "Heure" : "Hour", position: "bottom", offset: 0, style: { fontSize: 11 } }}
                  />
                  <YAxis
                    yAxisId="left"
                    className="text-xs"
                    label={{ value: "kWh", angle: -90, position: "insideLeft", style: { fontSize: 11 } }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    className="text-xs"
                    label={{ value: "kW", angle: 90, position: "insideRight", style: { fontSize: 11 } }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: 10 }} />
                  <Bar
                    yAxisId="left"
                    dataKey="consumptionBefore"
                    fill="hsl(var(--muted-foreground))"
                    fillOpacity={0.4}
                    name={language === "fr" ? "kWh Avant" : "kWh Before"}
                    radius={[2, 2, 0, 0]}
                    barSize={8}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="consumptionAfter"
                    fill="hsl(var(--primary))"
                    name={language === "fr" ? "kWh Après" : "kWh After"}
                    radius={[2, 2, 0, 0]}
                    barSize={8}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="peakBefore"
                    stroke="#1a1a1a"
                    strokeWidth={2}
                    dot={false}
                    name={language === "fr" ? "kW Avant" : "kW Before"}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="peakAfter"
                    stroke="#FFB005"
                    strokeWidth={2}
                    dot={false}
                    name={language === "fr" ? "kW Après" : "kW After"}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              {language === "fr" ? "Données horaires non disponibles" : "Hourly data not available"}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SECTION 6: FINANCING OPTIONS                                   */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <SectionDivider
        title={language === "fr" ? "Options d'acquisition" : "Acquisition Options"}
        icon={CreditCard}
      />

      <FinancingCalculator simulation={simulation} displayedScenario={displayedScenario} />

      <NarrativeTransition transitionKey="resultsToAction" />

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ACT 4: TAKE ACTION                                             */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <NarrativeActHeader actKey="act4_action" />

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* CTA BANNER                                                     */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <FileSignature className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">
                  {language === "fr" ? "Intéressé par ce projet?" : "Interested in this project?"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {language === "fr"
                    ? "Voyez les détails de la prochaine étape et les frais associés"
                    : "See the details of the next step and associated fees"}
                </p>
              </div>
            </div>
            <a href="#next-steps-cta">
              <Button className="gap-2" data-testid="button-mid-cta">
                <ArrowRight className="w-4 h-4" />
                {language === "fr" ? "Voir les prochaines étapes" : "View next steps"}
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SECTION 7: ASSUMPTIONS & EXCLUSIONS                            */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <SectionDivider title={t("analysis.assumptions")} icon={ListChecks} />

      <Card>
        <CardContent className="pt-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-sm text-primary mb-3">{t("analysis.assumptions.title")}</h4>
              <div className="space-y-2">
                {getAssumptions(language as "fr" | "en", !(simulation.hourlyProfile && (simulation.hourlyProfile as any[]).length > 0)).map((a, i) => (
                  <div key={i} className="flex justify-between items-center text-sm py-1 border-b border-border/50 last:border-0">
                    <span className="text-muted-foreground">{a.label}</span>
                    <span className="font-mono font-medium">{a.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-destructive mb-3">{t("analysis.exclusions.title")}</h4>
              <div className="space-y-2">
                {getExclusions(language as "fr" | "en").map((excl, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm py-1">
                    <span className="text-destructive font-bold mt-0.5">✕</span>
                    <span className="text-muted-foreground">{excl}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SECTION 8: EQUIPMENT & WARRANTIES                              */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <SectionDivider title={t("analysis.equipment")} icon={Wrench} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {getEquipment(language as "fr" | "en").map((eq, i) => (
          <Card key={i} className="text-center">
            <CardContent className="pt-6 pb-4">
              <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <p className="text-sm font-medium mb-1">{eq.label}</p>
              <p className="text-lg font-bold text-primary font-mono">{eq.warranty}</p>
              <p className="text-xs text-muted-foreground">{language === "fr" ? "garantie" : "warranty"}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center">{t("analysis.equipment.note")}</p>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SECTION 9: TIMELINE                                            */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <SectionDivider title={t("analysis.timeline")} icon={Clock} />

      <Card>
        <CardContent className="pt-6 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {getTimeline(language as "fr" | "en").map((tl, i, arr) => (
              <div key={i} className="text-center p-3 rounded-lg" style={{
                backgroundColor: TIMELINE_GRADIENT.getStepHex(i, arr.length),
                color: TIMELINE_GRADIENT.getStepTextColor(i, arr.length),
              }}>
                <p className="text-xs font-bold opacity-70 mb-1">0{i + 1}</p>
                <p className="font-semibold text-sm">{tl.step}</p>
                {tl.duration && <p className="text-xs opacity-80 mt-1">{tl.duration}</p>}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center mt-3">{t("analysis.timeline.note")}</p>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SECTION 10: NEXT STEPS CTA                                     */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <SectionDivider
        title={language === "fr" ? "Prochaines étapes" : "Next Steps"}
        icon={FileSignature}
      />

      <Card className="border-primary/20" id="next-steps-cta">
        <CardHeader>
          {isStaff ? (
            <>
              <CardTitle className="text-xl flex items-center gap-2">
                <FileSignature className="w-6 h-6 text-primary" />
                {language === "fr" ? "Prêt à passer à l'action?" : "Ready to Take Action?"}
              </CardTitle>
              <CardDescription>
                {language === "fr"
                  ? "Signez le mandat de conception pour démarrer votre projet solaire"
                  : "Sign the Design Mandate to start your solar project"}
              </CardDescription>
            </>
          ) : (
            <>
              <CardTitle className="text-xl flex items-center gap-2">
                <FileSignature className="w-6 h-6 text-primary" />
                {language === "fr" ? "Prochaine étape" : "Next Step"}
              </CardTitle>
              <CardDescription>
                {language === "fr"
                  ? "Votre conseiller kWh Québec vous contactera pour discuter de votre projet et planifier les prochaines étapes, incluant le Mandat de conception."
                  : "Your kWh Québec advisor will contact you to discuss your project and plan the next steps, including the Design Mandate."}
              </CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent>
          {isStaff && (
            <div className="grid md:grid-cols-3 gap-6">
              {/* Column 1: Design fee covers */}
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                <h4 className="font-semibold text-sm text-primary mb-3 flex items-center gap-2">
                  <FileSignature className="w-4 h-4" />
                  {language === "fr" ? "L'entente couvre" : "Design fee covers"}
                </h4>
                <ul className="space-y-2">
                  {getDesignFeeCovers(language as "fr" | "en").map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Column 2: Client provides */}
              <div className="p-4 bg-muted/30 rounded-lg border">
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  {language === "fr" ? "Vous fournissez" : "You provide"}
                </h4>
                <ul className="space-y-2">
                  {getClientProvides(language as "fr" | "en").map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <ArrowRight className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Column 3: Client receives */}
              <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                <h4 className="font-semibold text-sm text-green-700 dark:text-green-400 mb-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  {language === "fr" ? "Vous recevez" : "You receive"}
                </h4>
                <ul className="space-y-2">
                  {getClientReceives(language as "fr" | "en").map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Star className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {isStaff ? (
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                className="gap-2 px-8"
                onClick={onNavigateToDesignAgreement}
                data-testid="button-cta-create-design"
              >
                <FileSignature className="w-5 h-5" />
                {language === "fr" ? "Voir le mandat de conception" : "View Design Mandate"}
              </Button>
              <Button variant="outline" size="lg" className="gap-2" data-testid="button-cta-contact">
                <Phone className="w-5 h-5" />
                {language === "fr" ? "Nous contacter" : "Contact Us"}
              </Button>
            </div>
          ) : (
            <div className="mt-6 flex justify-center">
              <Button variant="outline" size="lg" className="gap-2" data-testid="button-cta-contact">
                <Phone className="w-5 h-5" />
                {language === "fr" ? "Nous contacter" : "Contact Us"}
              </Button>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground mt-4">
            {isStaff ? (
              <>
                {language === "fr"
                  ? "Frais de conception préliminaire: 2 500$ + taxes. Crédité sur le contrat EPC si vous procédez. Le rapport a une valeur complète indépendamment du choix du fournisseur."
                  : "Preliminary design fee: $2,500 + taxes. Credited toward the EPC contract if you proceed. The report has complete value regardless of provider choice."}
              </>
            ) : (
              <>
                {language === "fr"
                  ? "Mandat de conception préliminaire : 2 500$ + taxes"
                  : "Preliminary Design Mandate: $2,500 + taxes"}
              </>
            )}
          </p>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SECTION 11: CREDIBILITY                                        */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <SectionDivider title={t("analysis.credibility")} icon={Users} />

      <Card className="border-primary/20">
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-6 mb-6">
            {getAllStats(language as "fr" | "en").map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-4xl font-bold text-primary font-mono">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          <p className="text-sm text-muted-foreground text-center mb-4">
            {language === "fr"
              ? "Notre équipe accompagne les entreprises partout au Canada dans leurs projets d'énergie renouvelable depuis 2011."
              : "Our team has been supporting businesses across Canada in renewable energy projects since 2011."}
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {(language === "fr"
              ? ["Simplicité", "Fiabilité", "Longévité", "Fierté"]
              : ["Simplicity", "Reliability", "Longevity", "Pride"]
            ).map((val, i) => (
              <span key={i} className="text-xs font-semibold text-primary px-3 py-1 bg-primary/5 rounded-md">{val}</span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* STAFF-ONLY: TECHNICAL ANALYSIS                                 */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {isStaff && (
        <>
          <div className="flex items-center gap-3 py-4 mt-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md border">
              <Settings className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {language === "fr" ? "Analyse technique (Personnel)" : "Technical Analysis (Staff Only)"}
              </span>
            </div>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Cross-Validation with Google Solar */}
          {dashboardPvSizeKW > 0 && site && site.roofAreaAutoDetails && (() => {
            const details = site.roofAreaAutoDetails as any;
            const solarPotential = details?.solarPotential;
            const panelConfigs = solarPotential?.solarPanelConfigs;
            const panelWatts = solarPotential?.panelCapacityWatts || 400;

            if (!panelConfigs || panelConfigs.length === 0) return null;

            const ourPvKw = dashboardPvSizeKW;
            const maxConfig = panelConfigs.reduce((max: any, config: any) =>
              config.panelsCount > (max?.panelsCount || 0) ? config : max, panelConfigs[0]);

            const googleMaxPvKw = (maxConfig.panelsCount * panelWatts) / 1000;
            const googleProdDc = maxConfig.yearlyEnergyDcKwh || 0;
            const googleProdAc = googleProdDc * 0.85;

            const ourAnnualProd = displayedScenario.totalProductionKWh || simulation.totalProductionKWh || 0;

            const googleYield = googleMaxPvKw > 0 ? googleProdAc / googleMaxPvKw : 0;
            const ourYield = ourPvKw > 0 ? ourAnnualProd / ourPvKw : 0;

            const yieldDiffPercent = googleYield > 0 ? ((ourYield - googleYield) / googleYield * 100) : 0;
            const isYieldWithinMargin = Math.abs(yieldDiffPercent) <= 20;

            const sizeMismatchRatio = ourPvKw > 0 && googleMaxPvKw > 0 ? ourPvKw / googleMaxPvKw : 1;
            const hasSignificantSizeMismatch = sizeMismatchRatio > 1.5;

            const getCalibrationStatus = () => {
              if (Math.abs(yieldDiffPercent) <= 10) {
                return { status: 'validated', color: 'green', message: language === "fr"
                  ? "Rendement validé par Google Solar" : "Yield validated by Google Solar" };
              } else if (yieldDiffPercent > 20) {
                return { status: 'review', color: 'amber', message: language === "fr"
                  ? "Vérifier les hypothèses de production" : "Review production assumptions" };
              } else if (yieldDiffPercent < -20) {
                return { status: 'conservative', color: 'blue', message: language === "fr"
                  ? "Estimation conservatrice" : "Conservative estimate" };
              } else {
                return { status: 'acceptable', color: 'green', message: language === "fr"
                  ? "Écart acceptable" : "Acceptable variance" };
              }
            };
            const calibration = getCalibrationStatus();

            return (
              <Card className="border-dashed">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    {language === "fr" ? "Validation croisée" : "Cross-Validation"}
                    {hasSignificantSizeMismatch ? (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
                        {language === "fr" ? "Calibration rendement" : "Yield Calibration"}
                      </Badge>
                    ) : isYieldWithinMargin ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                        {language === "fr" ? "Cohérent" : "Consistent"}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200">
                        {language === "fr" ? "Écart détecté" : "Variance Detected"}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {language === "fr"
                      ? "Comparaison du rendement spécifique (kWh/kWc) avec Google Solar API"
                      : "Specific yield (kWh/kWp) comparison with Google Solar API"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-muted/30 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">
                        {language === "fr" ? "Notre rendement" : "Our Yield"}
                        {assumptions?.yieldSource && assumptions.yieldSource !== 'default' && (
                          <span className="ml-1 text-[10px] text-primary">
                            ({assumptions.yieldSource === 'google' ? 'Google' : language === "fr" ? 'Manuel' : 'Manual'})
                          </span>
                        )}
                      </p>
                      <p className="text-2xl font-bold font-mono">{Math.round(ourYield)}</p>
                      <p className="text-xs text-muted-foreground">kWh/kWp</p>
                    </div>
                    <div className="text-center p-4 bg-primary/10 rounded-lg border border-primary/20">
                      <p className="text-xs text-muted-foreground mb-1">Google Solar</p>
                      <p className="text-2xl font-bold font-mono text-primary">{Math.round(googleYield)}</p>
                      <p className="text-xs text-muted-foreground">kWh/kWp</p>
                    </div>
                    <div className={`text-center p-4 rounded-lg ${
                      calibration.color === 'green' ? 'bg-green-50 border border-green-200' :
                      calibration.color === 'amber' ? 'bg-amber-50 border border-amber-200' :
                      'bg-blue-50 border border-blue-200'
                    }`}>
                      <p className="text-xs text-muted-foreground mb-1">
                        {language === "fr" ? "Écart rendement" : "Yield Difference"}
                      </p>
                      <p className={`text-2xl font-bold font-mono ${
                        calibration.color === 'green' ? 'text-green-700' :
                        calibration.color === 'amber' ? 'text-amber-700' :
                        'text-blue-700'
                      }`}>
                        {yieldDiffPercent >= 0 ? "+" : ""}{yieldDiffPercent.toFixed(1)}%
                      </p>
                      <p className={`text-xs ${
                        calibration.color === 'green' ? 'text-green-600' :
                        calibration.color === 'amber' ? 'text-amber-600' :
                        'text-blue-600'
                      }`}>
                        {calibration.message}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-muted/20 rounded-lg">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{language === "fr" ? "Notre système" : "Our system"}</span>
                        <span className="font-mono font-medium">{formatSmartPower(ourPvKw, language)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{language === "fr" ? "Google max config" : "Google max config"}</span>
                        <span className="font-mono">{formatSmartPower(googleMaxPvKw, language)} ({maxConfig.panelsCount} pan.)</span>
                      </div>
                    </div>

                    {hasSignificantSizeMismatch && googleYield > 0 && (
                      <div className="mt-3 pt-3 border-t border-dashed">
                        <div className="flex items-center gap-2 mb-2">
                          <Sun className="w-3.5 h-3.5 text-amber-500" />
                          <span className="text-xs font-medium">
                            {language === "fr" ? "Production calibrée (via rendement Google)" : "Calibrated production (via Google yield)"}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{language === "fr" ? "Notre simulation" : "Our simulation"}</span>
                            <span className="font-mono">{formatSmartEnergy(ourAnnualProd, language)}/{language === "fr" ? "an" : "yr"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{language === "fr" ? "Basé sur rendement Google" : "Based on Google yield"}</span>
                            <span className="font-mono text-primary">{formatSmartEnergy(ourPvKw * googleYield, language)}/{language === "fr" ? "an" : "yr"}</span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {language === "fr"
                            ? `Votre système de ${formatSmartPower(ourPvKw, language)} × rendement Google de ${Math.round(googleYield)} kWh/kWc = ${formatSmartEnergy(ourPvKw * googleYield, language)}/an`
                            : `Your ${formatSmartPower(ourPvKw, language, 'kW')} system × Google yield of ${Math.round(googleYield)} kWh/kWp = ${formatSmartEnergy(ourPvKw * googleYield, language)}/yr`}
                        </p>
                      </div>
                    )}

                    {!hasSignificantSizeMismatch && (
                      <div className="mt-2 pt-2 border-t border-dashed text-sm">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{language === "fr" ? "Notre prod." : "Our prod."}</span>
                            <span className="font-mono">{formatSmartEnergy(ourAnnualProd, language)}/{language === "fr" ? "an" : "yr"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{language === "fr" ? "Google prod." : "Google prod."}</span>
                            <span className="font-mono">{formatSmartEnergy(googleProdAc, language)}/{language === "fr" ? "an" : "yr"}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <p className="mt-4 text-xs text-muted-foreground">
                    <Info className="w-3 h-3 inline mr-1" />
                    {language === "fr"
                      ? "Les écarts de ±20% en rendement spécifique sont normaux et peuvent être dus à la météo locale, l'orientation, l'ombrage, et les hypothèses de pertes système."
                      : "Differences of ±20% in specific yield are normal and can be due to local weather, orientation, shading, and system loss assumptions."}
                  </p>
                </CardContent>
              </Card>
            );
          })()}

          {/* Financial Breakdown (collapsible) */}
          {displayedScenario.scenarioBreakdown && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-lg">
                  {language === "fr" ? "Ventilation financière" : "Financial Breakdown"}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowBreakdown(!showBreakdown)}>
                  {showBreakdown ? (language === "fr" ? "Masquer" : "Hide") : (language === "fr" ? "Afficher" : "Show")}
                </Button>
              </CardHeader>
              {showBreakdown && (
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                        {language === "fr" ? "CAPEX" : "Capital Costs"}
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">{language === "fr" ? "Solaire" : "Solar"}</span>
                          <span className="font-mono text-sm">{formatSmartCurrency(displayedScenario.scenarioBreakdown.capexSolar || 0, language)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">{language === "fr" ? "Stockage" : "Storage"}</span>
                          <span className="font-mono text-sm">{formatSmartCurrency(displayedScenario.scenarioBreakdown.capexBattery || 0, language)}</span>
                        </div>
                        <div className="flex justify-between border-t pt-2">
                          <span className="text-sm font-medium">{language === "fr" ? "CAPEX brut" : "Gross CAPEX"}</span>
                          <span className="font-mono text-sm font-bold">{formatSmartCurrency(displayedScenario.scenarioBreakdown.capexGross || 0, language)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                        {language === "fr" ? "Incitatifs" : "Incentives"}
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">{language === "fr" ? "Hydro-Québec (solaire)" : "Hydro-Québec Solar"}</span>
                          <span className="font-mono text-sm text-primary">{formatSmartCurrency(-(displayedScenario.scenarioBreakdown.actualHQSolar || 0), language)}</span>
                        </div>
                        {(displayedScenario.scenarioBreakdown.actualHQBattery || 0) > 0 && (
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">
                              {language === "fr" ? "Hydro-Québec (crédit stockage jumelé)" : "Hydro-Québec (paired storage credit)"}
                            </span>
                            <span className="font-mono text-sm text-primary">{formatSmartCurrency(-(displayedScenario.scenarioBreakdown.actualHQBattery || 0), language)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-sm">{language === "fr" ? "CII fédéral (30%)" : "Federal ITC (30%)"}</span>
                          <span className="font-mono text-sm text-primary">{formatSmartCurrency(-(displayedScenario.scenarioBreakdown.itcAmount || 0), language)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">{language === "fr" ? "Bouclier fiscal (DPA)" : "Tax Shield (CCA)"}</span>
                          <span className="font-mono text-sm text-primary">{formatSmartCurrency(-(displayedScenario.scenarioBreakdown.taxShield || 0), language)}</span>
                        </div>
                        <div className="flex justify-between border-t pt-2">
                          <span className="text-sm font-medium">{language === "fr" ? "CAPEX net" : "Net CAPEX"}</span>
                          <span className="font-mono text-sm font-bold">{formatSmartCurrency(displayedScenario.capexNet || 0, language)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div>
                        <p className="text-xs text-muted-foreground">{language === "fr" ? "Autosuffisance" : "Self-sufficiency"}</p>
                        <p className="text-lg font-bold font-mono">{(displayedScenario.selfSufficiencyPercent || 0).toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">LCOE</p>
                        <p className="text-lg font-bold font-mono">${(displayedScenario.scenarioBreakdown?.lcoe || simulation.lcoe || 0).toFixed(3)}/kWh</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{language === "fr" ? "VAN 25 ans" : "NPV 25 years"}</p>
                        <p className="text-lg font-bold font-mono">{formatSmartCurrency(displayedScenario.npv25 || 0, language)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{language === "fr" ? "TRI 25 ans" : "IRR 25 years"}</p>
                        <p className="text-lg font-bold font-mono">{((displayedScenario.irr25 || 0) * 100).toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Analysis & Optimization */}
          {(simulation.sensitivity || isLoadingFullData) && (
            <>
              <SectionDivider
                title={language === "fr" ? "Analyse et optimisation" : "Analysis & Optimization"}
                icon={BarChart3}
              />

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {language === "fr" ? "Analyse d'optimisation" : "Optimization Analysis"}
                  </CardTitle>
                  <CardDescription>
                    {language === "fr"
                      ? "Comparaison des scénarios et optimisation des tailles de système"
                      : "Scenario comparison and system sizing optimization"}
                  </CardDescription>
                </CardHeader>
                {isLoadingFullData && !simulation.sensitivity ? (
                  <CardContent className="py-12">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      <p className="text-sm text-muted-foreground">
                        {language === "fr" ? "Chargement des données d'analyse..." : "Loading analysis data..."}
                      </p>
                    </div>
                  </CardContent>
                ) : (
                <CardContent className="space-y-8">
                  {/* Efficiency Frontier Chart */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
                      <h4 className="text-sm font-semibold">
                        {language === "fr" ? "Frontière d'efficacité (tous scénarios)" : "Efficiency Frontier (all scenarios)"}
                      </h4>
                      {onCompareScenarios && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={onCompareScenarios}
                          className="gap-1.5"
                          data-testid="button-compare-scenarios"
                        >
                          <Scale className="w-3.5 h-3.5" />
                          {language === "fr" ? "Comparer les scénarios" : "Compare scenarios"}
                        </Button>
                      )}
                    </div>
                    <div
                      className="h-72"
                      onClick={(e) => {
                        if (isStaff) {
                          e.stopPropagation();
                        }
                      }}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart
                          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                          onClick={(data: any, event: React.MouseEvent) => {
                            if (isStaff && data?.activePayload?.[0]?.payload) {
                              event.stopPropagation();
                              event.preventDefault();
                              handleChartPointClick(data.activePayload[0], 0, event);
                            }
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis
                            type="number"
                            dataKey="capexNet"
                            name={language === "fr" ? "Investissement net" : "Net Investment"}
                            tickFormatter={(v) => formatSmartCurrency(v, language)}
                            className="text-xs"
                          />
                          <YAxis
                            type="number"
                            dataKey="npv25"
                            name={language === "fr" ? "VAN" : "NPV"}
                            tickFormatter={(v) => formatSmartCurrency(v, language)}
                            className="text-xs"
                          />
                          <ZAxis type="number" range={[60, 200]} />
                          <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="5 5" strokeWidth={2} />
                          <Tooltip
                            cursor={{ strokeDasharray: '3 3' }}
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px"
                            }}
                            content={({ active, payload }) => {
                              if (!active || !payload || !payload.length) return null;
                              const point = payload[0]?.payload as FrontierPoint;
                              if (!point) return null;

                              const pvKW = point.pvSizeKW || 0;
                              const battKWh = point.battEnergyKWh || 0;
                              const actualType = pvKW > 0 && battKWh > 0 ? 'hybrid' :
                                                pvKW > 0 ? 'solar' :
                                                battKWh > 0 ? 'battery' : 'none';

                              const typeLabel = actualType === 'hybrid'
                                ? (language === "fr" ? "Hybride" : "Hybrid")
                                : actualType === 'solar'
                                  ? (language === "fr" ? "Solaire" : "Solar")
                                  : (language === "fr" ? "Stockage" : "Storage");

                              const sizingLabel = actualType === 'hybrid'
                                ? `${formatSmartPower(pvKW, language, 'kW')} Solar + ${formatSmartEnergy(battKWh, language)}`
                                : actualType === 'solar'
                                  ? `${formatSmartPower(pvKW, language, 'kW')} Solar`
                                  : formatSmartEnergy(battKWh, language);

                              return (
                                <div className="bg-card border rounded-lg p-2 shadow-lg">
                                  <p className="text-sm font-medium">
                                    <span className="inline-block w-2 h-2 rounded-full mr-1.5"
                                      style={{ backgroundColor: actualType === 'solar' ? '#FFB005' : actualType === 'battery' ? '#003DA6' : '#16A34A' }}
                                    />
                                    {typeLabel}: {sizingLabel}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {language === "fr" ? "Investissement" : "Investment"}: {formatSmartCurrency(point.capexNet || 0, language)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {language === "fr" ? "VAN 25 ans" : "NPV 25 years"}: {formatSmartCurrency(point.npv25 || 0, language)}
                                  </p>
                                  {point.isOptimal && (
                                    <p className="text-xs font-medium text-primary mt-1">
                                      ★ {language === "fr" ? "Optimal" : "Optimal"}
                                    </p>
                                  )}
                                  {isStaff && (
                                    <p className="text-xs font-medium text-blue-500 mt-1.5 flex items-center gap-1">
                                      <Plus className="w-3 h-3" />
                                      {language === "fr" ? "Cliquer pour créer variante" : "Click to create variant"}
                                    </p>
                                  )}
                                </div>
                              );
                            }}
                          />
                          <Legend />
                          <Scatter
                            name={language === "fr" ? "Solaire" : "Solar"}
                            data={(simulation.sensitivity as SensitivityAnalysis).frontier.filter(p => p.type === 'solar' && !p.isOptimal)}
                            fill="#FFB005"
                            shape={(props: any) => {
                              const { cx, cy, payload } = props;
                              const fillOpacity = payload.npv25 >= 0 ? 1 : 0.25;
                              return (
                                <circle
                                  cx={cx} cy={cy} r={6} fill="#FFB005" fillOpacity={fillOpacity}
                                  style={{ cursor: isStaff ? 'pointer' : 'default' }}
                                  data-testid={`scatter-solar-${payload.pvSizeKW}`}
                                  onClick={(e) => { if (isStaff) { e.stopPropagation(); e.preventDefault(); handleChartPointClick({ payload }, 0); } }}
                                />
                              );
                            }}
                          />
                          <Scatter
                            name={language === "fr" ? "Stockage" : "Storage"}
                            data={(simulation.sensitivity as SensitivityAnalysis).frontier.filter(p => p.type === 'battery' && !p.isOptimal)}
                            fill="#003DA6"
                            shape={(props: any) => {
                              const { cx, cy, payload } = props;
                              const fillOpacity = payload.npv25 >= 0 ? 1 : 0.25;
                              return (
                                <circle
                                  cx={cx} cy={cy} r={6} fill="#003DA6" fillOpacity={fillOpacity}
                                  style={{ cursor: isStaff ? 'pointer' : 'default' }}
                                  data-testid={`scatter-battery-${payload.battEnergyKWh}`}
                                  onClick={(e) => { if (isStaff) { e.stopPropagation(); e.preventDefault(); handleChartPointClick({ payload }, 0); } }}
                                />
                              );
                            }}
                          />
                          <Scatter
                            name={language === "fr" ? "Solaire variable" : "Solar sweep"}
                            data={(simulation.sensitivity as SensitivityAnalysis).frontier.filter(p => p.type === 'hybrid' && !p.isOptimal && p.sweepSource === 'pvSweep')}
                            fill="#16A34A"
                            shape={(props: any) => {
                              const { cx, cy, payload } = props;
                              const fillOpacity = payload.npv25 >= 0 ? 1 : 0.25;
                              return (
                                <circle
                                  cx={cx} cy={cy} r={6} fill="#16A34A" fillOpacity={fillOpacity}
                                  style={{ cursor: isStaff ? 'pointer' : 'default' }}
                                  data-testid={`scatter-hybrid-pv-${payload.pvSizeKW}-${payload.battEnergyKWh}`}
                                  onClick={(e) => { if (isStaff) { e.stopPropagation(); e.preventDefault(); handleChartPointClick({ payload }, 0); } }}
                                />
                              );
                            }}
                          />
                          <Scatter
                            name={language === "fr" ? "Stockage variable" : "Storage sweep"}
                            data={(simulation.sensitivity as SensitivityAnalysis).frontier.filter(p => p.type === 'hybrid' && !p.isOptimal && p.sweepSource === 'battSweep')}
                            fill="#10B981"
                            shape={(props: any) => {
                              const { cx, cy, payload } = props;
                              const fillOpacity = payload.npv25 >= 0 ? 1 : 0.25;
                              return (
                                <rect
                                  x={cx - 5} y={cy - 5} width={10} height={10} fill="#10B981" fillOpacity={fillOpacity} rx={2}
                                  style={{ cursor: isStaff ? 'pointer' : 'default' }}
                                  data-testid={`scatter-hybrid-batt-${payload.pvSizeKW}-${payload.battEnergyKWh}`}
                                  onClick={(e) => { if (isStaff) { e.stopPropagation(); e.preventDefault(); handleChartPointClick({ payload }, 0); } }}
                                />
                              );
                            }}
                          />
                          <Scatter
                            name={language === "fr" ? "Hybride" : "Hybrid"}
                            data={(simulation.sensitivity as SensitivityAnalysis).frontier.filter(p => p.type === 'hybrid' && !p.isOptimal && !p.sweepSource)}
                            fill="#16A34A"
                            shape={(props: any) => {
                              const { cx, cy, payload } = props;
                              const fillOpacity = payload.npv25 >= 0 ? 1 : 0.25;
                              return (
                                <circle
                                  cx={cx} cy={cy} r={6} fill="#16A34A" fillOpacity={fillOpacity}
                                  style={{ cursor: isStaff ? 'pointer' : 'default' }}
                                  data-testid={`scatter-hybrid-${payload.pvSizeKW}-${payload.battEnergyKWh}`}
                                  onClick={(e) => { if (isStaff) { e.stopPropagation(); e.preventDefault(); handleChartPointClick({ payload }, 0); } }}
                                />
                              );
                            }}
                          />
                          <Scatter
                            name={language === "fr" ? "Optimal ★" : "Optimal ★"}
                            data={(simulation.sensitivity as SensitivityAnalysis).frontier.filter(p => p.isOptimal)}
                            shape={(props: any) => {
                              const { cx, cy, payload } = props;
                              const pvKW = payload.pvSizeKW || 0;
                              const battKWh = payload.battEnergyKWh || 0;
                              const actualType = pvKW > 0 && battKWh > 0 ? 'hybrid' :
                                                pvKW > 0 ? 'solar' : 'battery';
                              const color = actualType === 'solar' ? '#FFB005' :
                                            actualType === 'battery' ? '#003DA6' : '#16A34A';
                              return (
                                <g
                                  style={{ cursor: isStaff ? 'pointer' : 'default' }}
                                  data-testid={`scatter-optimal-${pvKW}-${battKWh}`}
                                  onClick={(e) => { if (isStaff) { e.stopPropagation(); e.preventDefault(); handleChartPointClick({ payload }, 0); } }}
                                >
                                  <circle cx={cx} cy={cy} r={12} fill={color} stroke="#000" strokeWidth={3} />
                                  <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="#fff" fontWeight="bold">★</text>
                                </g>
                              );
                            }}
                          />
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      {(simulation.sensitivity as SensitivityAnalysis).frontier.some(p => p.sweepSource === 'pvSweep') && (
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#16A34A' }}></div>
                          <span>{language === "fr" ? "Solaire variable (stockage fixe)" : "Solar sweep (fixed storage)"}</span>
                        </div>
                      )}
                      {(simulation.sensitivity as SensitivityAnalysis).frontier.some(p => p.sweepSource === 'battSweep') && (
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#10B981' }}></div>
                          <span>{language === "fr" ? "Stockage variable (solaire fixe)" : "Storage sweep (fixed solar)"}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-0.5 bg-destructive" style={{ borderStyle: 'dashed' }}></div>
                        <span>{language === "fr" ? "Seuil de rentabilité (VAN = 0)" : "Profitability threshold (NPV = 0)"}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="opacity-30">●</span>
                        <span>{language === "fr" ? "Points pâles = non rentable" : "Faded points = not profitable"}</span>
                      </div>
                      {isStaff && (
                        <div className="flex items-center gap-1 text-blue-500 font-medium">
                          <MousePointerClick className="w-3 h-3" />
                          <span>{language === "fr" ? "Cliquer sur un point pour créer une variante" : "Click on a point to create a variant"}</span>
                        </div>
                      )}
                    </div>
                    {(() => {
                      const optimal = (simulation.sensitivity as SensitivityAnalysis).frontier.find(p => p.isOptimal);
                      if (optimal && optimal.npv25 > 0) return null;

                      return (
                        <div className="mt-2 p-3 bg-destructive/5 border border-destructive/20 rounded-lg flex items-center gap-3">
                          <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-destructive">
                              {language === "fr" ? "Aucun investissement recommandé" : "No investment recommended"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {language === "fr"
                                ? "Toutes les configurations ont une VAN négative avec les hypothèses actuelles"
                                : "All configurations have negative NPV under current assumptions"}
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    {(() => {
                      const optimal = (simulation.sensitivity as SensitivityAnalysis).frontier.find(p => p.isOptimal);
                      if (!optimal) return null;

                      const pvKW = optimal.pvSizeKW || 0;
                      const battKWh = optimal.battEnergyKWh || 0;
                      const battPowerKW = optimal.battPowerKW || 0;

                      const avgLoadKW = battPowerKW > 0 ? battPowerKW * 0.5 : (simulation.peakDemandKW ? simulation.peakDemandKW * 0.3 : 0);
                      const backupHours = (battKWh > 0 && avgLoadKW > 0) ? (battKWh / avgLoadKW) : 0;

                      const selfSufficiency = optimal.selfSufficiencyPercent
                        ?? displayedScenario.selfSufficiencyPercent
                        ?? (pvKW > 0 ? Math.min(40, pvKW / 10) : 0);

                      const propertyValueIncrease = pvKW * 1000;

                      const hasSolar = pvKW > 0;
                      const hasBattery = battKWh > 0;

                      if (!hasSolar && !hasBattery) return null;

                      return (
                        <div className="mt-4 p-4 bg-muted/30 border border-dashed rounded-lg">
                          <div className="flex items-center gap-2 mb-3">
                            <Sparkles className="w-4 h-4 text-primary" />
                            <h4 className="text-sm font-semibold">
                              {language === "fr" ? "Bénéfices stratégiques" : "Strategic Benefits"}
                            </h4>
                            <span className="text-xs text-muted-foreground">
                              {language === "fr" ? "(au-delà du rendement financier)" : "(beyond financial returns)"}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {hasBattery && backupHours > 0 && (
                              <div className="p-3 bg-background rounded-lg border">
                                <div className="flex items-center gap-2 mb-1">
                                  <Shield className="w-4 h-4 text-blue-500" />
                                  <span className="text-xs font-medium">{language === "fr" ? "Résilience" : "Resilience"}</span>
                                </div>
                                <p className="text-lg font-bold font-mono text-blue-600">
                                  {backupHours >= 1 ? `${backupHours.toFixed(1)}h` : `${Math.round(backupHours * 60)}min`}
                                </p>
                                <p className="text-xs text-muted-foreground">{language === "fr" ? "autonomie estimée" : "estimated backup"}</p>
                              </div>
                            )}

                            {hasSolar && (
                              <div className="p-3 bg-background rounded-lg border">
                                <div className="flex items-center gap-2 mb-1">
                                  <Award className="w-4 h-4 text-amber-500" />
                                  <span className="text-xs font-medium">{language === "fr" ? "Autonomie énergétique" : "Energy Independence"}</span>
                                </div>
                                <p className="text-lg font-bold font-mono text-amber-600">{(selfSufficiency || 0).toFixed(0)}%</p>
                                <p className="text-xs text-muted-foreground">{language === "fr" ? "de vos besoins" : "of your needs"}</p>
                              </div>
                            )}

                            {hasSolar && propertyValueIncrease > 0 && (
                              <div className="p-3 bg-background rounded-lg border">
                                <div className="flex items-center gap-2 mb-1">
                                  <TrendingUp className="w-4 h-4 text-purple-500" />
                                  <span className="text-xs font-medium">{language === "fr" ? "Valeur immo." : "Property Value"}</span>
                                </div>
                                <p className="text-lg font-bold font-mono text-purple-600">
                                  {formatDollarSigned(propertyValueIncrease, language)}
                                </p>
                                <a href="/blog/solaire-valeur-immobiliere-commercial" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                                  {language === "fr" ? `~$1k/kWc (voir les études)` : `~$1k/kW (see studies)`}
                                </a>
                              </div>
                            )}
                          </div>

                          <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded text-xs">
                            <div className="flex items-start gap-2">
                              <TrendingDown className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="font-medium text-amber-700 dark:text-amber-400">
                                  {language === "fr" ? "Protection tarifaire:" : "Rate Protection:"}
                                </span>
                                <span className="text-amber-600 dark:text-amber-300 ml-1">
                                  {language === "fr"
                                    ? `Si Hydro-Québec augmente de +6%/an au lieu de +${((assumptions.inflationRate || 0.035) * 100).toFixed(1).replace('.0', '')}%/an, la rentabilité s'améliore significativement.`
                                    : `If Hydro-Québec increases +6%/year instead of +${((assumptions.inflationRate || 0.035) * 100).toFixed(1).replace('.0', '')}%/year, profitability improves significantly.`}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Solar and Battery Optimization Charts */}
                  <div className="grid lg:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-semibold mb-4">
                        {language === "fr" ? "Optimisation taille solaire (VAN vs kWc)" : "Solar Size Optimization (NPV vs kWc)"}
                      </h4>
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={(simulation.sensitivity as SensitivityAnalysis).solarSweep}
                            margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="pvSizeKW" className="text-xs" label={{ value: language === "fr" ? "Solaire (kWc)" : "Solar (kWp)", position: "bottom", offset: 0, style: { fontSize: 11 } }} />
                            <YAxis tickFormatter={(v) => formatSmartCurrency(v, language)} className="text-xs" label={{ value: language === "fr" ? "VAN" : "NPV", angle: -90, position: "insideLeft", style: { fontSize: 11 } }} />
                            <Tooltip
                              contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                              formatter={(value: number) => [formatSmartCurrency(value, language), language === "fr" ? "VAN 25 ans" : "NPV 25 years"]}
                              labelFormatter={(v) => formatSmartPower(Number(v), language)}
                            />
                            <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="5 5" strokeWidth={1.5} label={{ value: language === "fr" ? "Taux d'actualisation" : "Discount Rate", position: "right", fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                            <Line
                              type="monotone" dataKey="npv25" stroke="#FFB005" strokeWidth={2}
                              dot={(props: any) => {
                                const { cx, cy, payload } = props;
                                const isProfitable = payload.npv25 >= 0;
                                const isOptimal = payload.isOptimal;
                                return (
                                  <circle cx={cx} cy={cy} r={isOptimal ? 8 : 4} fill="#FFB005" fillOpacity={isProfitable ? 1 : 0.3} stroke={isOptimal ? "#000" : "none"} strokeWidth={isOptimal ? 2 : 0} />
                                );
                              }}
                              activeDot={{ r: 6 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      {(() => {
                        const solarSweep = (simulation.sensitivity as SensitivityAnalysis).solarSweep;
                        const optimalSolar = solarSweep.reduce((best, curr) =>
                          (curr.npv25 > (best?.npv25 || -Infinity)) ? curr : best, solarSweep[0]);
                        if (optimalSolar && optimalSolar.npv25 > 0) {
                          return (
                            <p className="text-xs text-muted-foreground mt-2">
                              {language === "fr" ? "Optimal: " : "Optimal: "}
                              <span className="font-medium text-foreground">{formatSmartPower(optimalSolar.pvSizeKW, language)}</span>
                              {language === "fr" ? " → VAN " : " → NPV "}
                              <span className="font-medium text-primary">{formatSmartCurrency(optimalSolar.npv25, language)}</span>
                            </p>
                          );
                        }
                        return (
                          <p className="text-xs text-destructive mt-2">
                            {language === "fr" ? "Aucune taille solaire rentable" : "No profitable solar size"}
                          </p>
                        );
                      })()}
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold mb-4">
                        {language === "fr" ? "Optimisation taille stockage (VAN vs kWh)" : "Storage Size Optimization (NPV vs kWh)"}
                      </h4>
                      <p className="text-xs text-muted-foreground -mt-3 mb-3">
                        {language === "fr" ? `VAN selon la taille du stockage` : `NPV vs storage capacity`}
                      </p>
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={(simulation.sensitivity as SensitivityAnalysis).batterySweep}
                            margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="battEnergyKWh" className="text-xs" label={{ value: language === "fr" ? "Stockage (kWh)" : "Storage (kWh)", position: "bottom", offset: 0, style: { fontSize: 11 } }} />
                            <YAxis tickFormatter={(v) => formatSmartCurrency(v, language)} className="text-xs" label={{ value: language === "fr" ? "VAN" : "NPV", angle: -90, position: "insideLeft", style: { fontSize: 11 } }} />
                            <Tooltip
                              contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                              formatter={(value: number) => [formatSmartCurrency(value, language), language === "fr" ? "VAN 25 ans" : "NPV 25 years"]}
                              labelFormatter={(v) => formatSmartEnergy(Number(v), language)}
                            />
                            <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="5 5" strokeWidth={1.5} label={{ value: language === "fr" ? "Taux d'actualisation" : "Discount Rate", position: "right", fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                            <Line
                              type="monotone" dataKey="npv25" stroke="#003DA6" strokeWidth={2}
                              dot={(props: any) => {
                                const { cx, cy, payload } = props;
                                const isProfitable = payload.npv25 >= 0;
                                return (<circle cx={cx} cy={cy} r={4} fill="#003DA6" fillOpacity={isProfitable ? 1 : 0.3} />);
                              }}
                              activeDot={{ r: 6 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      {(() => {
                        const batterySweep = (simulation.sensitivity as SensitivityAnalysis).batterySweep;
                        const optimalBattery = batterySweep.reduce((best, curr) =>
                          (curr.npv25 > (best?.npv25 || -Infinity)) ? curr : best, batterySweep[0]);
                        if (optimalBattery && optimalBattery.npv25 > 0) {
                          return (
                            <p className="text-xs text-muted-foreground mt-2">
                              {language === "fr" ? "Optimal: " : "Optimal: "}
                              <span className="font-medium text-foreground">{formatSmartEnergy(optimalBattery.battEnergyKWh, language)}</span>
                              {language === "fr" ? " → VAN " : " → NPV "}
                              <span className="font-medium text-primary">{formatSmartCurrency(optimalBattery.npv25, language)}</span>
                            </p>
                          );
                        }
                        return (
                          <p className="text-xs text-amber-600 mt-2">
                            {language === "fr" ? "Stockage seul non rentable (VAN négative)" : "Storage alone not profitable (negative NPV)"}
                          </p>
                        );
                      })()}
                    </div>
                  </div>
                </CardContent>
                )}
              </Card>
            </>
          )}

          {/* Parameters Used */}
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">
                  {language === "fr" ? "Paramètres utilisés" : "Parameters Used"}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <p className="text-muted-foreground">{language === "fr" ? "Tarif énergie" : "Energy tariff"}</p>
                  <p className="font-mono">${assumptions.tariffEnergy}/kWh</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{language === "fr" ? "Tarif puissance" : "Power tariff"}</p>
                  <p className="font-mono">${assumptions.tariffPower}/kW/mois</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{language === "fr" ? "Coût solaire" : "Solar cost"}</p>
                  <p className="font-mono">${assumptions.solarCostPerW}/Wc</p>
                </div>
                {(() => {
                  const baseYield = assumptions.solarYieldKWhPerKWp || 1150;
                  const orientationFactor = assumptions.orientationFactor || 1.0;
                  const bifacialConfig = getBifacialConfigFromRoofColor(site?.roofColorType);
                  const bifacialBoost = assumptions.bifacialEnabled ? bifacialConfig.boost : 1.0;
                  const grossYield = Math.round(baseYield * orientationFactor * bifacialBoost);

                  const hourlyProfile = simulation.hourlyProfile as HourlyProfileEntry[] | null;
                  let annualProduction = 0;
                  if (hourlyProfile && hourlyProfile.length > 0) {
                    annualProduction = hourlyProfile.reduce((sum, h) => sum + (h.production || 0), 0);
                  }
                  const pvKW = simulation.pvSizeKW || 0;
                  const netYield = pvKW > 0 ? Math.round(annualProduction / pvKW) : 0;

                  return (
                    <>
                      <div>
                        <p className="text-muted-foreground">
                          {language === "fr" ? "Rendement brut" : "Gross yield"}
                          {assumptions.bifacialEnabled && bifacialConfig.boostPercent > 0 && (
                            <span className="text-primary ml-1">(+{bifacialConfig.boostPercent}%)</span>
                          )}
                        </p>
                        <p className="font-mono">{grossYield} kWh/kWc</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{language === "fr" ? "Rendement net livré" : "Net delivered yield"}</p>
                        <p className="font-mono text-primary font-semibold">{netYield} kWh/kWc</p>
                      </div>
                    </>
                  );
                })()}
                <div>
                  <p className="text-muted-foreground">{language === "fr" ? "Taux actualisation" : "Discount rate"}</p>
                  <p className="font-mono">{((assumptions.discountRate || 0) * 100).toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{language === "fr" ? "Surface toit" : "Roof area"}</p>
                  <p className="font-mono">{(assumptions.roofAreaSqFt || 0).toLocaleString()} pi²</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{language === "fr" ? "Utilisation toit" : "Roof utilization"}</p>
                  <p className="font-mono">{((assumptions.roofUtilizationRatio || 0) * 100).toFixed(0)}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{language === "fr" ? "Inflation Hydro-Québec" : "Hydro-Québec Inflation"}</p>
                  <p className="font-mono">{((assumptions.inflationRate || 0) * 100).toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{language === "fr" ? "Taux imposition" : "Tax rate"}</p>
                  <p className="font-mono">{((assumptions.taxRate || 0) * 100).toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Monte Carlo */}
          {site?.id && (
            <MonteCarloAnalysis
              siteId={site.id}
              hasMeterData={(site?.meterFiles?.length || 0) > 0}
              meterId={(simulation as any)?.meterId || null}
            />
          )}

          {/* Data Quality Indicator */}
          {interpolatedMonths.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30">
              <CardContent className="py-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800 dark:text-amber-200">
                      {language === "fr" ? "Données interpolées" : "Interpolated Data"}
                    </p>
                    <p className="text-amber-700 dark:text-amber-300 text-xs mt-1">
                      {language === "fr"
                        ? `Les mois suivants n'avaient pas de données et ont été estimés à partir des mois adjacents: ${interpolatedMonths.filter(m => m >= 1 && m <= 12).map(m => MONTH_NAMES_FR[m]).join(', ')}.`
                        : `The following months had no data and were estimated from adjacent months: ${interpolatedMonths.filter(m => m >= 1 && m <= 12).map(m => MONTH_NAMES_EN[m]).join(', ')}.`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Externally controlled Create Variant Dialog */}
      {isStaff && (
        <CreateVariantDialog
          simulation={simulation}
          siteId={site.id}
          onSuccess={() => {}}
          externalOpen={variantDialogOpen}
          onExternalOpenChange={setVariantDialogOpen}
          preset={variantPreset}
          showTrigger={false}
        />
      )}
    </div>
  );
}
