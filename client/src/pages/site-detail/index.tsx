import React, { useState, useCallback, useEffect, Fragment, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Upload,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  Download,
  Zap,
  BarChart3,
  DollarSign,
  TrendingUp,
  PenTool,
  Loader2,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleCheck,
  CircleDot,
  AlertTriangle,
  Sun,
  Layers,
  Sparkles,
  XCircle,
  Scale,
  Grid3X3,
  Pencil,
  Gift
} from "lucide-react";
import type { AnalysisAssumptions, SimulationRun, RoofPolygon, InsertRoofPolygon } from "@shared/schema";
import { defaultAnalysisAssumptions } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoadProfileEditor, SingleBillEstimator, SyntheticProfileGenerator } from "@/components/consumption-tools";
import { SiteVisitSection } from "@/components/site-visit-section";
import { DesignAgreementSection } from "@/components/design-agreement-section";
import { ActivityFeed } from "@/components/activity-feed";
import { RoofDrawingModal } from "@/components/RoofDrawingModal";
import { RoofVisualization } from "@/components/RoofVisualization";

import { FileUploadZone } from "./components/FileUploadZone";
import { FileStatusBadge } from "./components/FileStatusBadge";
import { AnalysisParametersEditor } from "./components/AnalysisParametersEditor";
import { StructuralConstraintsEditor } from "./components/StructuralConstraintsEditor";
import { DownloadReportButton } from "./components/DownloadReportButton";
import { ScenarioComparison } from "./components/ScenarioComparison";
import { AnalysisResults } from "./components/AnalysisResults";
import { BenchmarkTab } from "./components/BenchmarkTab";
import type { SiteWithDetails, QuickPotentialResult, DeliverablePhase } from "./types";
import { formatNumber, getTariffRates } from "./utils";
import { formatSmartPower, formatSmartEnergy, formatSmartCurrency, formatSmartNumber, formatSmartPercent } from "@shared/formatters";

export default function SiteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, language } = useI18n();
  const { toast } = useToast();
  const { isStaff, isClient, token } = useAuth();
  const [activeTab, setActiveTab] = useState("consumption");
  const [customAssumptions, setCustomAssumptions] = useState<Partial<AnalysisAssumptions>>({});
  const assumptionsInitializedRef = useRef(false);
  const [selectedSimulationId, setSelectedSimulationId] = useState<string | null>(null);
  const pendingNewSimulationIdRef = useRef<string | null>(null);
  const [bifacialDialogOpen, setBifacialDialogOpen] = useState(false);
  const [isRoofDrawingModalOpen, setIsRoofDrawingModalOpen] = useState(false);
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);
  const [pendingModalOpen, setPendingModalOpen] = useState(false);
  const [optimizationTarget, setOptimizationTarget] = useState<'npv' | 'irr' | 'selfSufficiency'>('npv');
  const [isTransitioningSimulation, setIsTransitioningSimulation] = useState(false);

  const [deliverablePhase, setDeliverablePhase] = useState<DeliverablePhase>('idle');

  const [quickPotential, setQuickPotential] = useState<QuickPotentialResult | null>(null);

  // Constraint factor for quick analysis (5-25%, default 10%)
  const [constraintFactor, setConstraintFactor] = useState(10);

  // Geometry-based capacity from RoofVisualization (more accurate than backend estimate)
  const [geometryCapacity, setGeometryCapacity] = useState<{
    maxCapacityKW: number;
    panelCount: number;
    realisticCapacityKW: number;
    constraintAreaSqM: number;
  } | null>(null);

  // Visualization capture function ref for PDF generation
  const visualizationCaptureRef = useRef<(() => Promise<string | null>) | null>(null);

  // Lazy loading for full simulation data (heavy JSON columns: cashflows, breakdown, hourlyProfile, peakWeekData, sensitivity)
  const [fullSimulationRuns, setFullSimulationRuns] = useState<Map<string, SimulationRun>>(new Map());
  const [loadingFullSimulation, setLoadingFullSimulation] = useState<string | null>(null);

  const { data: site, isLoading, refetch } = useQuery<SiteWithDetails>({
    queryKey: ["/api/sites", id],
    enabled: !!id,
  });

  // Query to fetch existing roof polygons
  const { data: roofPolygons = [] } = useQuery<RoofPolygon[]>({
    queryKey: ['/api/sites', id, 'roof-polygons'],
    enabled: !!id
  });

  // Fetch design agreement status for the site
  const { data: designAgreement } = useQuery<{ id: string; status: string } | null>({
    queryKey: ["/api/sites", id, "design-agreement"],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/sites/${id}/design-agreement`, {
        credentials: "include",
        headers
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch agreement");
      return res.json();
    },
    enabled: !!id && isStaff,
  });

  // Fetch opportunities for the site to check qualification status
  const { data: opportunities = [] } = useQuery<Array<{ id: string; stage: string }>>({
    queryKey: ["/api/sites", id, "opportunities"],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/sites/${id}/opportunities`, {
        credentials: "include",
        headers
      });
      if (res.status === 404) return [];
      if (!res.ok) throw new Error("Failed to fetch opportunities");
      return res.json();
    },
    enabled: !!id,
  });

  // Effect to open roof drawing modal after site data is refreshed with coordinates
  useEffect(() => {
    if (pendingModalOpen && site?.latitude && site?.longitude) {
      setPendingModalOpen(false);
      setIsRoofDrawingModalOpen(true);
    }
  }, [pendingModalOpen, site?.latitude, site?.longitude]);

  // Load cached Quick Analysis results from database when site data loads
  useEffect(() => {
    if (site?.quickAnalysisCompletedAt && site?.quickAnalysisSystemSizeKw && !quickPotential) {
      const systemSizeKw = site.quickAnalysisSystemSizeKw;
      const annualProductionKwh = site.quickAnalysisAnnualProductionKwh || 0;
      const annualSavings = site.quickAnalysisAnnualSavings || 0;
      const paybackYears = site.quickAnalysisPaybackYears || 0;
      const grossCapex = site.quickAnalysisGrossCapex || 0;
      const hqIncentive = site.quickAnalysisHqIncentive || 0;
      const netCapex = site.quickAnalysisNetCapex || 0;
      const federalItc = Math.round((grossCapex - hqIncentive) * 0.30);

      const solarPolygons = roofPolygons.filter((p: RoofPolygon) => {
        if (p.color === "#f97316") return false;
        const label = (p.label || "").toLowerCase();
        return !label.includes("constraint") && !label.includes("contrainte") &&
               !label.includes("hvac") && !label.includes("obstacle");
      });
      const polygonAreaSqM = solarPolygons.reduce((sum: number, p: RoofPolygon) => sum + (p.areaSqM || 0), 0);
      const totalRoofAreaSqM = polygonAreaSqM > 0 ? polygonAreaSqM : (site.roofAreaSqM || site.roofAreaAutoSqM || 0);
      const polygonCount = solarPolygons.length > 0 ? solarPolygons.length : 1;

      const savedConstraintFactor = site.quickAnalysisConstraintFactor ?? 0.10;
      const effectiveUtilizationRatio = 0.85 * (1 - savedConstraintFactor);

      if (site.quickAnalysisConstraintFactor !== null && site.quickAnalysisConstraintFactor !== undefined) {
        setConstraintFactor(Math.round(site.quickAnalysisConstraintFactor * 100));
      }

      setQuickPotential({
        roofAnalysis: {
          totalRoofAreaSqM: Math.round(totalRoofAreaSqM),
          usableRoofAreaSqM: Math.round(totalRoofAreaSqM * effectiveUtilizationRatio),
          utilizationRatio: effectiveUtilizationRatio,
          constraintFactor: savedConstraintFactor,
          polygonCount,
        },
        systemSizing: {
          maxCapacityKW: systemSizeKw,
          numPanels: Math.ceil(systemSizeKw * 1000 / 660),
          panelPowerW: 660,
        },
        production: {
          annualProductionKWh: annualProductionKwh,
          annualProductionMWh: annualProductionKwh / 1000,
          yieldKWhPerKWp: systemSizeKw > 0 ? annualProductionKwh / systemSizeKw : 1150,
        },
        financial: {
          costPerW: grossCapex > 0 && systemSizeKw > 0 ? grossCapex / (systemSizeKw * 1000) : 1.20,
          pricingTier: systemSizeKw >= 1000 ? "Large (1000+ kW)" : systemSizeKw >= 500 ? "Medium (500-999 kW)" : "Standard (<500 kW)",
          estimatedCapex: grossCapex,
          estimatedAnnualSavings: annualSavings,
          simplePaybackYears: paybackYears,
          hqIncentive: hqIncentive,
          federalItc: federalItc,
          netCapex: netCapex,
        },
      });
    }
  }, [site?.id, site?.quickAnalysisCompletedAt, site?.quickAnalysisSystemSizeKw, site?.roofAreaSqM, site?.roofAreaAutoSqM, roofPolygons, quickPotential]);

  // Initialize assumptions from site data when loaded (only once per page load)
  useEffect(() => {
    if (site && !assumptionsInitializedRef.current) {
      const initialAssumptions: Partial<AnalysisAssumptions> = {};

      if (site.roofAreaAutoSqM && site.roofAreaAutoSqM > 0 && site.roofEstimateStatus === "success") {
        initialAssumptions.roofAreaSqFt = Math.round(site.roofAreaAutoSqM * 10.764);
      }
      else if (site.roofAreaSqM && site.roofAreaSqM > 0) {
        initialAssumptions.roofAreaSqFt = Math.round(site.roofAreaSqM * 10.764);
      }

      if (site.simulationRuns && site.simulationRuns.length > 0) {
        const peakDemands = site.simulationRuns
          .map(sim => sim.peakDemandKW)
          .filter((v): v is number => v !== null && v !== undefined && v > 0);

        if (peakDemands.length > 0) {
          const peakDemandKW = Math.max(...peakDemands);
          const autoTariff = peakDemandKW >= 65 ? "M" : "G";
          const rates = getTariffRates(autoTariff);
          initialAssumptions.tariffCode = autoTariff;
          initialAssumptions.tariffEnergy = rates.energyRate;
          initialAssumptions.tariffPower = rates.demandRate;
        }
      }

      if (site.analysisAssumptions) {
        const savedAssumptions = site.analysisAssumptions as Partial<AnalysisAssumptions>;
        Object.assign(initialAssumptions, savedAssumptions);
      }

      if (Object.keys(initialAssumptions).length > 0) {
        setCustomAssumptions(initialAssumptions);
      }
      assumptionsInitializedRef.current = true;
    }
  }, [site]);

  const runAnalysisMutation = useMutation({
    mutationFn: async (customAssumptionsOverrides: Partial<AnalysisAssumptions>) => {
      const mergedAssumptions: AnalysisAssumptions = {
        ...defaultAnalysisAssumptions,
        ...customAssumptionsOverrides
      };
      delete (mergedAssumptions as any).yieldSource;

      const result = await apiRequest<{ id?: string }>("POST", `/api/sites/${id}/run-potential-analysis`, { assumptions: mergedAssumptions });
      return result;
    },
    onSuccess: (data) => {
      setIsTransitioningSimulation(true);
      if (data?.id) {
        pendingNewSimulationIdRef.current = data.id;
      } else {
        pendingNewSimulationIdRef.current = "__latest__";
      }
      queryClient.invalidateQueries({ queryKey: ["/api/sites", id] });
      toast({ title: language === "fr" ? "Analyse terminée avec succès" : "Analysis completed successfully" });
      setActiveTab("analysis");
    },
    onError: (error: Error) => {
      const errorMessage = error.message || (language === "fr" ? "Erreur lors de l'analyse" : "Error during analysis");
      toast({
        title: language === "fr" ? "Erreur lors de l'analyse" : "Error during analysis",
        description: errorMessage,
        variant: "destructive"
      });
    },
  });

  // Quick potential analysis mutation (roof-only, no consumption data needed)
  const quickPotentialMutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest<{ success: boolean } & QuickPotentialResult>("POST", `/api/sites/${id}/quick-potential`, {
        constraintFactor: constraintFactor / 100
      });
      return result;
    },
    onSuccess: (data) => {
      setQuickPotential(data);
      queryClient.invalidateQueries({ queryKey: ['/api/sites', id] });
      toast({
        title: language === "fr" ? "Analyse rapide terminée" : "Quick analysis complete",
        description: language === "fr"
          ? "Visualisation du potentiel solaire en cours..."
          : "Loading solar potential visualization..."
      });
    },
    onError: (error: Error) => {
      const errorMessage = error.message || "";
      toast({
        title: language === "fr" ? "Erreur lors de l'analyse rapide" : "Error during quick analysis",
        description: errorMessage,
        variant: "destructive"
      });
    },
  });

  const captureAndSaveVisualization = async () => {
    if (!visualizationCaptureRef.current || !site) return;
    try {
      const imageData = await visualizationCaptureRef.current();
      if (imageData) {
        const tkn = localStorage.getItem("token");
        const resp = await fetch(`/api/sites/${site.id}/save-visualization`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(tkn ? { Authorization: `Bearer ${tkn}` } : {})
          },
          body: JSON.stringify({ imageData }),
        });
        if (!resp.ok) console.warn("Failed to save roof visualization before download");
      }
    } catch (e) {
      console.error("Failed to capture roof visualization:", e);
    }
  };

  const handleDownloadDeliverables = async (simId: string) => {
    if (!site) return;

    setDeliverablePhase('pdf');
    const token = localStorage.getItem("token");

    try {
      await captureAndSaveVisualization();
      const pdfResponse = await fetch(`/api/simulation-runs/${simId}/report-pdf?lang=${language}&opt=${optimizationTarget}`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (pdfResponse.ok) {
        const pdfBlob = await pdfResponse.blob();
        const pdfUrl = window.URL.createObjectURL(pdfBlob);
        const pdfLink = document.createElement("a");
        pdfLink.href = pdfUrl;
        pdfLink.download = `rapport-${site?.name?.replace(/\s+/g, '-') || 'site'}.pdf`;
        document.body.appendChild(pdfLink);
        pdfLink.click();
        document.body.removeChild(pdfLink);
        window.URL.revokeObjectURL(pdfUrl);
      } else {
        console.warn("PDF generation failed:", pdfResponse.status);
      }

      setDeliverablePhase('pptx');
      const pptxResponse = await fetch(`/api/simulation-runs/${simId}/presentation-pptx?lang=${language}&opt=${optimizationTarget}`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (pptxResponse.ok) {
        const pptxBlob = await pptxResponse.blob();
        const pptxUrl = window.URL.createObjectURL(pptxBlob);
        const pptxLink = document.createElement("a");
        pptxLink.href = pptxUrl;
        pptxLink.download = `proposition-${site?.name?.replace(/\s+/g, '-') || 'site'}.pptx`;
        document.body.appendChild(pptxLink);
        pptxLink.click();
        document.body.removeChild(pptxLink);
        window.URL.revokeObjectURL(pptxUrl);
      } else {
        console.warn("PPTX generation failed:", pptxResponse.status);
      }

      setDeliverablePhase('complete');
      toast({
        title: language === "fr" ? "Livrables générés" : "Deliverables generated",
        description: language === "fr" ? "PDF et PowerPoint téléchargés" : "PDF and PowerPoint downloaded"
      });

      setTimeout(() => setDeliverablePhase('idle'), 2000);

    } catch (error) {
      setDeliverablePhase('error');
      toast({
        title: language === "fr" ? "Erreur de génération" : "Generation error",
        variant: "destructive"
      });
      setTimeout(() => setDeliverablePhase('idle'), 3000);
    }
  };

  // Bifacial response mutation
  const bifacialResponseMutation = useMutation({
    mutationFn: async (accepted: boolean) => {
      return apiRequest("POST", `/api/sites/${id}/bifacial-response`, { accepted });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites", id] });
      setBifacialDialogOpen(false);
    },
  });

  // Mutation to save roof polygons
  const saveRoofPolygonsMutation = useMutation({
    mutationFn: async (polygons: InsertRoofPolygon[]) => {
      await apiRequest("DELETE", `/api/sites/${id}/roof-polygons`);
      for (const polygon of polygons) {
        await apiRequest("POST", `/api/sites/${id}/roof-polygons`, polygon);
      }
      return polygons;
    },
    onSuccess: (polygons) => {
      queryClient.invalidateQueries({ queryKey: ['/api/sites', id, 'roof-polygons'] });
      queryClient.invalidateQueries({ queryKey: ["/api/sites", id] });
      toast({ title: language === "fr" ? "Zones de toit sauvegardées" : "Roof areas saved" });
      const totalAreaSqM = polygons.reduce((sum, p) => sum + p.areaSqM, 0);
      const totalAreaSqFt = Math.round(totalAreaSqM * 10.764);
      if (totalAreaSqFt > 0) {
        setCustomAssumptions(prev => ({ ...prev, roofAreaSqFt: totalAreaSqFt }));
      }
      setIsRoofDrawingModalOpen(false);
    },
    onError: (error) => {
      console.error("Error saving roof polygons:", error);
      toast({
        title: language === "fr" ? "Erreur" : "Error",
        description: language === "fr" ? "Impossible de sauvegarder les zones de toit" : "Failed to save roof areas",
        variant: "destructive"
      });
    }
  });

  const handleSaveRoofPolygons = async (polygons: InsertRoofPolygon[]) => {
    saveRoofPolygonsMutation.mutate(polygons);
  };

  // Show bifacial dialog when white membrane detected and not yet prompted
  useEffect(() => {
    if (site &&
        (site.roofColorType === "white_membrane" || site.roofColorType === "light") &&
        !site.bifacialAnalysisPrompted &&
        site.roofEstimateStatus === "success") {
      setBifacialDialogOpen(true);
    }
  }, [site]);

  // Fetch full simulation data (with heavy JSON columns) for a specific simulation
  const fetchFullSimulation = useCallback(async (simulationId: string) => {
    if (fullSimulationRuns.has(simulationId)) return fullSimulationRuns.get(simulationId);

    setLoadingFullSimulation(simulationId);
    try {
      const data = await apiRequest<SimulationRun>("GET", `/api/simulation-runs/${simulationId}/full`);
      setFullSimulationRuns(prev => new Map(prev).set(simulationId, data));
      return data;
    } catch (error) {
      console.error("Error fetching full simulation:", error);
      return null;
    } finally {
      setLoadingFullSimulation(null);
    }
  }, [fullSimulationRuns]);

  // Get valid scenarios for comparison
  const validScenarios = site?.simulationRuns?.filter(s =>
    s.type === "SCENARIO" &&
    (s.pvSizeKW !== null || s.battEnergyKWh !== null) &&
    s.npv20 !== null
  ) || [];

  // Find the best scenario by NPV
  const bestScenarioByNPV = validScenarios.length > 0
    ? validScenarios.reduce((best, current) =>
        (current.npv20 || 0) > (best.npv20 || 0) ? current : best
      )
    : null;

  // Find the most recent simulation by created_at from ALL simulations
  const allSimulations = site?.simulationRuns || [];
  const mostRecentSimulationFromAll = allSimulations.length > 0
    ? allSimulations.reduce((latest, current) => {
        const latestDate = latest.createdAt ? new Date(latest.createdAt).getTime() : 0;
        const currentDate = current.createdAt ? new Date(current.createdAt).getTime() : 0;
        return currentDate > latestDate ? current : latest;
      })
    : null;

  // Initialize selected simulation with the best scenario when site loads
  useEffect(() => {
    if (pendingNewSimulationIdRef.current && site?.simulationRuns && site.simulationRuns.length > 0) {
      const pendingId = pendingNewSimulationIdRef.current;

      if (pendingId === "__latest__") {
        const mostRecent = mostRecentSimulationFromAll || site.simulationRuns[0];
        if (mostRecent) {
          setSelectedSimulationId(mostRecent.id);
          pendingNewSimulationIdRef.current = null;
          setIsTransitioningSimulation(false);
          return;
        }
      } else {
        const foundSimulation = site.simulationRuns.find(s => s.id === pendingId);
        if (foundSimulation) {
          setSelectedSimulationId(pendingId);
          pendingNewSimulationIdRef.current = null;
          setIsTransitioningSimulation(false);
          return;
        }
      }
    }

    if (site && mostRecentSimulationFromAll && !selectedSimulationId) {
      setSelectedSimulationId(mostRecentSimulationFromAll.id);
    }
  }, [site, mostRecentSimulationFromAll, selectedSimulationId]);

  // The simulation to display
  const latestSimulation = selectedSimulationId && selectedSimulationId !== "__latest__"
    ? site?.simulationRuns?.find(s => s.id === selectedSimulationId)
    : (mostRecentSimulationFromAll || bestScenarioByNPV || site?.simulationRuns?.find(s => s.type === "SCENARIO") || site?.simulationRuns?.[0]);

  // Auto-fetch full simulation data when viewing analysis tab
  useEffect(() => {
    if (activeTab === "analysis") {
      const targetSimId = selectedSimulationId && selectedSimulationId !== "__latest__"
        ? selectedSimulationId
        : (mostRecentSimulationFromAll?.id || site?.simulationRuns?.[0]?.id || null);

      if (targetSimId && !fullSimulationRuns.has(targetSimId)) {
        fetchFullSimulation(targetSimId);
      }
    }
  }, [activeTab, selectedSimulationId, mostRecentSimulationFromAll?.id, site?.simulationRuns, fullSimulationRuns, fetchFullSimulation]);

  // Get full simulation with heavy data (merges lightweight + full data)
  const getFullSimulation = useCallback((simId: string): SimulationRun | null => {
    const full = fullSimulationRuns.get(simId);
    if (full) return full;
    const lightweight = site?.simulationRuns?.find(s => s.id === simId);
    return lightweight || null;
  }, [fullSimulationRuns, site?.simulationRuns]);

  // Check if full data is loaded for a simulation
  const isFullDataLoaded = useCallback((simId: string): boolean => {
    return fullSimulationRuns.has(simId);
  }, [fullSimulationRuns]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!site) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Site non trouvé</h2>
        <Link href="/app/sites">
          <Button variant="outline">{t("common.back")}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <Link href={isClient ? "/app/portal" : "/app/sites"}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{site.name}</h1>
              {site.analysisAvailable ? (
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {t("sites.analysisReady")}
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <Clock className="w-3 h-3" />
                  {t("sites.pending")}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
              <span>{site.client?.name}</span>
              {(site.address || site.city) && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {[site.address, site.city, site.postalCode].filter(Boolean).join(", ")}
                </span>
              )}
              {site.roofEstimateStatus === "pending" && (
                <span className="flex items-center gap-1 text-primary">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {language === "fr" ? "Estimation toit..." : "Estimating roof..."}
                </span>
              )}
              {site.roofEstimateStatus === "failed" && (
                <span className="flex items-center gap-1 text-destructive">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {language === "fr" ? "Estimation échouée" : "Estimation failed"}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isStaff && (
            <>
              {!(site.meterFiles && site.meterFiles.length > 0) && (
                <div className="flex items-center gap-1">
                  <Select
                    value={constraintFactor.toString()}
                    onValueChange={(v) => setConstraintFactor(parseInt(v))}
                  >
                    <SelectTrigger className="w-[90px] h-9" data-testid="select-constraint-factor">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5%</SelectItem>
                      <SelectItem value="10">10%</SelectItem>
                      <SelectItem value="15">15%</SelectItem>
                      <SelectItem value="20">20%</SelectItem>
                      <SelectItem value="25">25%</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="secondary"
                    onClick={() => quickPotentialMutation.mutate()}
                    disabled={quickPotentialMutation.isPending || !site.roofAreaValidated}
                    className="gap-2"
                    data-testid="button-quick-potential"
                  >
                    {quickPotentialMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4" />
                    )}
                    {language === "fr" ? "Analyse rapide" : "Quick Analysis"}
                  </Button>
                </div>
              )}
              <Button
                onClick={() => runAnalysisMutation.mutate(customAssumptions)}
                disabled={runAnalysisMutation.isPending || !site.roofAreaValidated || deliverablePhase !== 'idle'}
                className="gap-2"
                data-testid="button-run-analysis-header"
              >
                {runAnalysisMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                {language === "fr" ? "Lancer analyse" : "Run Analysis"}
              </Button>
              {latestSimulation && (
                <Button
                  variant="outline"
                  onClick={() => handleDownloadDeliverables(latestSimulation.id)}
                  disabled={runAnalysisMutation.isPending || deliverablePhase !== 'idle'}
                  className="gap-2"
                  data-testid="button-download-deliverables"
                >
                  {deliverablePhase === 'pdf' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      PDF...
                    </>
                  ) : deliverablePhase === 'pptx' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      PPTX...
                    </>
                  ) : deliverablePhase === 'complete' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      {language === "fr" ? "Terminé" : "Done"}
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      {language === "fr" ? "Télécharger livrables" : "Download Deliverables"}
                    </>
                  )}
                </Button>
              )}
            </>
          )}
          {/* Presentation Mode Button */}
          <Link href={`/app/presentation/${site.id}${latestSimulation ? `?sim=${latestSimulation.id}&opt=${optimizationTarget}` : ''}`}>
            <Button variant="outline" className="gap-2" data-testid="button-presentation-mode">
              <Layers className="w-4 h-4" />
              {language === "fr" ? "Présentation" : "Presentation"}
            </Button>
          </Link>
          {/* Project Info Sheet PDF Button - Staff only */}
          {isStaff && (
            <Button
              variant="outline"
              className="gap-2"
              data-testid="button-project-info-sheet"
              onClick={async () => {
                try {
                  const token = localStorage.getItem("token");

                  await captureAndSaveVisualization();

                  const response = await fetch(`/api/sites/${site.id}/project-info-sheet?lang=${language}`, {
                    credentials: "include",
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                  });
                  if (!response.ok) throw new Error("Failed to generate PDF");
                  const blob = await response.blob();
                  const url = window.URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = `fiche-projet-${site.name.replace(/\s+/g, '-')}.pdf`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  window.URL.revokeObjectURL(url);
                  toast({ title: language === "fr" ? "Fiche projet téléchargée" : "Project sheet downloaded" });
                } catch (error) {
                  toast({ title: language === "fr" ? "Erreur" : "Error", variant: "destructive" });
                }
              }}
            >
              <FileText className="w-4 h-4" />
              {language === "fr" ? "Fiche Projet" : "Project Sheet"}
            </Button>
          )}
          {latestSimulation && (
            <>
              {(() => {
                // Determine if site is qualified for PDF downloads
                const qualifiedStages = ["qualified", "analysis_done", "design_mandate_signed", "epc_proposal_sent", "negotiation", "won"];
                const isQualified = !!designAgreement || opportunities.some(opp => qualifiedStages.includes(opp.stage));
                return (
                  <DownloadReportButton
                    simulationId={latestSimulation.id}
                    siteName={site.name}
                    optimizationTarget={optimizationTarget}
                    onBeforeDownload={captureAndSaveVisualization}
                    isQualified={isQualified || isStaff}
                  />
                );
              })()}
              {isStaff && (
                <Link href={`/app/analyses/${latestSimulation.id}/design`}>
                  <Button className="gap-2" data-testid="button-create-design">
                    <PenTool className="w-4 h-4" />
                    {t("analysis.createDesign")}
                  </Button>
                </Link>
              )}
            </>
          )}
        </div>
      </div>

      {/* Roof Validation Required Alert Banner */}
      {site.roofAreaValidated !== true && (
        <Card
          className="border-amber-500 bg-amber-50 dark:bg-amber-950/30"
          data-testid="alert-roof-validation-required"
        >
          <CardContent className="py-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
                <Grid3X3 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 space-y-1">
                <h4 className="font-semibold text-amber-800 dark:text-amber-200">
                  {language === "fr"
                    ? "Étape requise: Dessiner les zones de toiture"
                    : "Required step: Draw roof areas"}
                </h4>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {language === "fr"
                    ? "Avant de lancer l'analyse, vous devez délimiter manuellement les zones de toit exploitables."
                    : "Before running the analysis, you must manually outline the usable roof areas."}
                </p>
              </div>
              <Button
                disabled={isGeocodingAddress}
                onClick={async () => {
                  const hasCoordinates = site.latitude && site.longitude;

                  if (!hasCoordinates) {
                    if (!site.address) {
                      toast({
                        variant: "destructive",
                        title: language === "fr" ? "Adresse manquante" : "Missing address",
                        description: language === "fr"
                          ? "Veuillez d'abord ajouter une adresse dans les paramètres du site."
                          : "Please add an address in site settings first."
                      });
                      return;
                    }

                    setIsGeocodingAddress(true);

                    try {
                      const token = localStorage.getItem("token");
                      const response = await fetch(`/api/sites/${site.id}/geocode`, {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          ...(token ? { Authorization: `Bearer ${token}` } : {})
                        },
                        credentials: "include"
                      });

                      if (!response.ok) {
                        const data = await response.json();
                        toast({
                          variant: "destructive",
                          title: language === "fr" ? "Erreur de géocodage" : "Geocoding error",
                          description: data.error || (language === "fr"
                            ? "Impossible de localiser l'adresse. Vérifiez qu'elle est valide."
                            : "Could not locate address. Please verify it is valid.")
                        });
                        setIsGeocodingAddress(false);
                        return;
                      }

                      toast({
                        title: language === "fr" ? "Coordonnées trouvées" : "Coordinates found",
                        description: language === "fr"
                          ? "Ouverture de l'outil de dessin..."
                          : "Opening drawing tool..."
                      });

                      await refetch();
                      setIsGeocodingAddress(false);
                      setPendingModalOpen(true);
                    } catch (error) {
                      toast({
                        variant: "destructive",
                        title: language === "fr" ? "Erreur" : "Error",
                        description: language === "fr" ? "Erreur de connexion" : "Connection error"
                      });
                      setIsGeocodingAddress(false);
                    }
                  } else {
                    setIsRoofDrawingModalOpen(true);
                  }
                }}
                className="gap-2"
                data-testid="button-draw-roof-areas-banner"
              >
                {isGeocodingAddress ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Pencil className="w-4 h-4" />
                )}
                {isGeocodingAddress
                  ? (language === "fr" ? "Localisation..." : "Locating...")
                  : (language === "fr" ? "Dessiner les zones" : "Draw areas")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hydro-Québec Information Section */}
      {(site.hqClientNumber || site.hqAccountNumber || site.hqBillNumber || site.hqContractNumber || site.hqLegalClientName || site.hqTariffDetail) && (
        <Collapsible defaultOpen={true}>
          <Card data-testid="section-hq-information">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover-elevate py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-primary" />
                    <CardTitle className="text-lg">
                      {language === "fr" ? "Informations Hydro-Québec" : "Hydro-Québec Information"}
                    </CardTitle>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform duration-200" />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="hq-metadata-grid">
                  {site.hqLegalClientName && (
                    <div data-testid="hq-field-legal-name">
                      <div className="text-sm text-muted-foreground">
                        {language === "fr" ? "Nom légal du client" : "Legal Client Name"}
                      </div>
                      <div className="font-medium">{site.hqLegalClientName}</div>
                    </div>
                  )}
                  {site.hqClientNumber && (
                    <div data-testid="hq-field-client-number">
                      <div className="text-sm text-muted-foreground">
                        {language === "fr" ? "Numéro de client" : "Client Number"}
                      </div>
                      <div className="font-medium">{site.hqClientNumber}</div>
                    </div>
                  )}
                  {site.hqAccountNumber && (
                    <div data-testid="hq-field-account-number">
                      <div className="text-sm text-muted-foreground">
                        {language === "fr" ? "Numéro de compte" : "Account Number"}
                      </div>
                      <div className="font-medium">{site.hqAccountNumber}</div>
                    </div>
                  )}
                  {site.hqBillNumber && (
                    <div data-testid="hq-field-bill-number">
                      <div className="text-sm text-muted-foreground">
                        {language === "fr" ? "Numéro de facture" : "Bill Number"}
                      </div>
                      <div className="font-medium">{site.hqBillNumber}</div>
                    </div>
                  )}
                  {site.hqContractNumber && (
                    <div data-testid="hq-field-contract-number">
                      <div className="text-sm text-muted-foreground">
                        {language === "fr" ? "Numéro de contrat" : "Contract Number"}
                      </div>
                      <div className="font-medium">{site.hqContractNumber}</div>
                    </div>
                  )}
                  {site.hqTariffDetail && (
                    <div data-testid="hq-field-tariff">
                      <div className="text-sm text-muted-foreground">
                        {language === "fr" ? "Tarif" : "Tariff"}
                      </div>
                      <div className="font-medium">
                        <Badge variant="secondary">{site.hqTariffDetail}</Badge>
                      </div>
                    </div>
                  )}
                </div>

                {(() => {
                  const history = site.hqConsumptionHistory as Array<{ period?: string; kWh?: number; kW?: number; amount?: number; days?: number }> | null;
                  if (!history || !Array.isArray(history) || history.length === 0) return null;
                  return (
                    <div className="pt-4 border-t border-border/50" data-testid="hq-consumption-history">
                      <div className="text-sm font-medium mb-2">
                        {language === "fr" ? "Historique de consommation" : "Consumption History"}
                      </div>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{language === "fr" ? "Période" : "Period"}</TableHead>
                              <TableHead className="text-right">kWh</TableHead>
                              <TableHead className="text-right">kW</TableHead>
                              <TableHead className="text-right">{language === "fr" ? "Montant ($)" : "Amount ($)"}</TableHead>
                              <TableHead className="text-right">{language === "fr" ? "Jours" : "Days"}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {history.map((entry, idx) => (
                              <TableRow key={idx} data-testid={`hq-history-row-${idx}`}>
                                <TableCell>{entry.period || "—"}</TableCell>
                                <TableCell className="text-right">{entry.kWh != null ? formatNumber(entry.kWh, language) : "—"}</TableCell>
                                <TableCell className="text-right">{entry.kW != null ? formatNumber(entry.kW, language) : "—"}</TableCell>
                                <TableCell className="text-right">{entry.amount != null ? formatNumber(entry.amount, language) : "—"}</TableCell>
                                <TableCell className="text-right">{entry.days != null ? entry.days : "—"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Quick Potential Results Card */}
      {quickPotential && (
        <Card className="border-primary/30 bg-primary/5" data-testid="card-quick-potential">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Zap className="w-5 h-5 text-primary" />
                {language === "fr" ? "Potentiel solaire estimé" : "Estimated Solar Potential"}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setQuickPotential(null); setGeometryCapacity(null); }}
                data-testid="button-close-quick-potential"
              >
                <XCircle className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {language === "fr"
                ? "Analyse basée uniquement sur la surface de toit dessinée. L'analyse complète nécessite les données de consommation."
                : "Analysis based only on drawn roof area. Full analysis requires consumption data."}
            </p>

            {/* Structural Warning Banner */}
            {(site.structuralPassStatus === "no" || site.structuralPassStatus === "partial" || site.structuralBallastRemoval === "yes" || site.structuralNotes) && (
              <div className="flex items-start gap-2 mt-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800" data-testid="alert-structural-warning">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-300">
                    {language === "fr" ? "Avertissement structurel" : "Structural Warning"}
                  </p>
                  <p className="text-amber-700 dark:text-amber-400/80 mt-0.5">
                    {site.structuralPassStatus === "no"
                      ? (language === "fr"
                          ? "La structure existante ne supporte pas le poids ballast requis. Une analyse par ingénieur recommandée."
                          : "Existing structure cannot support required ballast weight. Engineer analysis recommended.")
                      : site.structuralPassStatus === "partial"
                      ? (language === "fr"
                          ? "Capacité structurelle partielle. Certaines zones du toit peuvent nécessiter un renforcement."
                          : "Partial structural capacity. Some roof areas may require reinforcement.")
                      : site.structuralBallastRemoval === "yes"
                      ? (language === "fr"
                          ? "Retrait de ballast existant requis avant installation."
                          : "Existing ballast removal required before installation.")
                      : (language === "fr"
                          ? "Contraintes structurelles notées. Consultez les détails ci-dessous."
                          : "Structural constraints noted. See details below.")}
                  </p>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {(() => {
              const displayedCapacityKW = geometryCapacity?.realisticCapacityKW ?? Math.round(quickPotential.systemSizing.maxCapacityKW * 0.9);
              const displayedPanelCount = geometryCapacity?.panelCount ?? quickPotential.systemSizing.numPanels;

              const costPerW = quickPotential.financial.costPerW || 2.00;
              const displayedCapex = Math.round(displayedCapacityKW * 1000 * costPerW);
              const yieldKWhPerKWp = quickPotential.production.yieldKWhPerKWp || 1039;
              const displayedProductionKWh = Math.round(displayedCapacityKW * yieldKWhPerKWp);

              const displayedHqIncentive = Math.min(displayedCapacityKW * 1000, displayedCapex * 0.40);
              const displayedFederalItc = Math.round((displayedCapex - displayedHqIncentive) * 0.30);
              const displayedNetCapex = displayedCapex - displayedHqIncentive - displayedFederalItc;

              const energyRate = 0.06;
              const displayedAnnualSavings = Math.round(displayedProductionKWh * energyRate);
              const displayedPaybackYears = displayedAnnualSavings > 0 ? displayedNetCapex / displayedAnnualSavings : 0;

              return (
            <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Sun className="w-4 h-4" />
                  {language === "fr" ? "Capacité estimée" : "Estimated Capacity"}
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {formatSmartPower(displayedCapacityKW, language, 'kWc')}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatNumber(displayedPanelCount, language)} {language === "fr" ? "panneaux" : "panels"} • -10% {language === "fr" ? "marge obstacles" : "obstacle margin"}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Zap className="w-4 h-4" />
                  {language === "fr" ? "Production annuelle" : "Annual Production"}
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {formatSmartEnergy(displayedProductionKWh, language)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatNumber(yieldKWhPerKWp, language)} kWh/kWc
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <DollarSign className="w-4 h-4" />
                  {language === "fr" ? "Investissement estimé" : "Estimated Investment"}
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {formatSmartCurrency(displayedCapex, language)}
                </div>
                <div className="text-xs text-muted-foreground">
                  ${costPerW.toFixed(2)}/W
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <TrendingUp className="w-4 h-4" />
                  {language === "fr" ? "Retour simple" : "Simple Payback"}
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {displayedPaybackYears.toFixed(1)} {language === "fr" ? "ans" : "years"}
                </div>
                <div className="text-xs text-muted-foreground">
                  ~{formatSmartCurrency(displayedAnnualSavings, language)}/{language === "fr" ? "an" : "year"}
                </div>
              </div>
            </div>

            {/* VAN and TRI 25 years */}
            {displayedNetCapex > 0 && displayedAnnualSavings > 0 && (() => {
              const discountRate = 0.06;
              const years = 25;
              let npv = -displayedNetCapex;
              for (let y = 1; y <= years; y++) {
                npv += displayedAnnualSavings / Math.pow(1 + discountRate, y);
              }
              let irr = 0.10;
              for (let iter = 0; iter < 50; iter++) {
                let npvCalc = -displayedNetCapex;
                let npvDerivative = 0;
                for (let y = 1; y <= years; y++) {
                  npvCalc += displayedAnnualSavings / Math.pow(1 + irr, y);
                  npvDerivative -= y * displayedAnnualSavings / Math.pow(1 + irr, y + 1);
                }
                if (Math.abs(npvCalc) < 1) break;
                irr = irr - npvCalc / npvDerivative;
                if (irr < 0) irr = 0.001;
                if (irr > 1) irr = 0.999;
              }
              return (
                <div className="flex gap-6 mt-3 pt-3 border-t border-border/50">
                  <div className="space-y-0.5">
                    <div className="text-xs text-muted-foreground">
                      {language === "fr" ? "VAN 25 ans (6%)" : "NPV 25 yrs (6%)"}
                    </div>
                    <div className={`text-lg font-bold ${npv >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatSmartCurrency(npv, language)}
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-xs text-muted-foreground">
                      {language === "fr" ? "TRI 25 ans" : "IRR 25 yrs"}
                    </div>
                    <div className="text-lg font-bold text-primary">
                      {(irr * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Incentives breakdown */}
            {displayedHqIncentive > 0 && (
              <div className="mt-4 pt-4 border-t border-border/50" data-testid="quick-analysis-incentives">
                <div className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <Gift className="w-4 h-4 text-green-600" />
                  {language === "fr" ? "Incitatifs estimés" : "Estimated Incentives"}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3" data-testid="incentive-hq">
                    <div className="text-xs text-muted-foreground">Hydro-Québec</div>
                    <div className="font-semibold text-green-700 dark:text-green-400">
                      {formatSmartCurrency(displayedHqIncentive, language)}
                    </div>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3" data-testid="incentive-federal">
                    <div className="text-xs text-muted-foreground">{language === "fr" ? "Crédit fédéral (30%)" : "Federal ITC (30%)"}</div>
                    <div className="font-semibold text-green-700 dark:text-green-400">
                      {formatSmartCurrency(displayedFederalItc, language)}
                    </div>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3" data-testid="incentive-net">
                    <div className="text-xs text-muted-foreground">{language === "fr" ? "Investissement net" : "Net Investment"}</div>
                    <div className="font-semibold text-blue-700 dark:text-blue-400">
                      {formatSmartCurrency(displayedNetCapex, language)}
                    </div>
                  </div>
                </div>
              </div>
            )}
            </>
              );
            })()}

            {/* Roof info */}
            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Grid3X3 className="w-4 h-4" />
                  {language === "fr" ? "Surface totale:" : "Total area:"} {formatNumber(quickPotential.roofAnalysis.totalRoofAreaSqM, language)} m²
                </span>
                <span>
                  {language === "fr" ? "Surface utilisable:" : "Usable area:"} {formatNumber(quickPotential.roofAnalysis.usableRoofAreaSqM, language)} m² ({Math.round(quickPotential.roofAnalysis.utilizationRatio * 100)}%)
                </span>
                <span>
                  {quickPotential.roofAnalysis.polygonCount} {language === "fr" ? "zone(s) de toit" : "roof zone(s)"}
                </span>
                {quickPotential.roofAnalysis.constraintFactor !== undefined && (
                  <span className="text-xs bg-muted px-2 py-0.5 rounded">
                    {language === "fr" ? "Contraintes:" : "Constraints:"} {Math.round(quickPotential.roofAnalysis.constraintFactor * 100)}%
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Roof Visualization with Panels - Quick Potential mode */}
      {quickPotential && !latestSimulation && site && site.latitude && site.longitude && import.meta.env.VITE_GOOGLE_MAPS_API_KEY && (
        <RoofVisualization
          siteId={id!}
          siteName={site.name}
          address={site.address || ""}
          latitude={site.latitude}
          longitude={site.longitude}
          roofAreaSqFt={quickPotential.roofAnalysis.totalRoofAreaSqM * 10.764}
          maxPVCapacityKW={quickPotential.systemSizing.maxCapacityKW}
          onGeometryCalculated={setGeometryCapacity}
          onVisualizationReady={(captureFunc) => { visualizationCaptureRef.current = captureFunc; }}
        />
      )}

      {/* Process Tabs with progression indicators */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex flex-wrap items-center gap-2" role="presentation">
          <div className="flex flex-wrap items-center bg-muted/50 rounded-lg p-1 gap-1 flex-1">
            {(() => {
              const hasConsumptionData = (site.meterFiles?.length ?? 0) > 0;
              const hasAnalysis = !!latestSimulation;
              const hasDesignAgreement = !!designAgreement;

              const tabs = [
                {
                  value: "consumption",
                  label: t("site.consumption"),
                  showAlways: true,
                  status: hasConsumptionData ? "complete" : "pending"
                },
                {
                  value: "analysis",
                  label: t("analysis.title"),
                  showAlways: true,
                  status: hasAnalysis ? "complete" : hasConsumptionData ? "available" : "pending"
                },
                {
                  value: "site-visit",
                  label: language === "fr" ? "Visite technique" : "Technical Visit",
                  showAlways: false,
                  status: hasAnalysis ? "available" : "pending"
                },
                {
                  value: "design-agreement",
                  label: language === "fr" ? "Mandat de conception préliminaire" : "Preliminary Design Mandate",
                  showAlways: false,
                  status: hasDesignAgreement ? "complete" : hasAnalysis ? "available" : "pending"
                },
                {
                  value: "benchmark",
                  label: "Benchmark",
                  showAlways: false,
                  status: hasAnalysis ? "available" : "pending"
                },
              ];

              const visibleTabs = tabs.filter(tab => tab.showAlways || isStaff);

              const getStatusIcon = (status: string) => {
                switch (status) {
                  case "complete":
                    return <CircleCheck className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />;
                  case "available":
                    return <CircleDot className="w-3.5 h-3.5 text-blue-500" />;
                  default:
                    return <Circle className="w-3.5 h-3.5 text-muted-foreground/50" />;
                }
              };

              return visibleTabs.map((tab, index) => (
                <Fragment key={tab.value}>
                  <button
                    type="button"
                    onClick={() => setActiveTab(tab.value)}
                    className={`
                      inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium
                      ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                      ${activeTab === tab.value
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                      }
                    `}
                    data-testid={`tab-${tab.value}`}
                    title={
                      tab.status === "complete"
                        ? (language === "fr" ? "Complété" : "Completed")
                        : tab.status === "available"
                        ? (language === "fr" ? "Disponible" : "Available")
                        : (language === "fr" ? "En attente" : "Pending")
                    }
                  >
                    {getStatusIcon(tab.status)}
                    {tab.label}
                  </button>
                  {index < visibleTabs.length - 1 && (
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
                  )}
                </Fragment>
              ));
            })()}
          </div>

          {isStaff && (
            <Button
              variant={activeTab === "activities" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("activities")}
              className="gap-1.5"
              data-testid="tab-activities"
              title={language === "fr" ? "Historique des activités" : "Activity History"}
            >
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">{t("activity.title")}</span>
            </Button>
          )}
        </div>

        {/* Hidden TabsList for Radix state management */}
        <TabsList className="sr-only">
          <TabsTrigger value="consumption">{t("site.consumption")}</TabsTrigger>
          <TabsTrigger value="analysis">{t("analysis.title")}</TabsTrigger>
          {isStaff && <TabsTrigger value="site-visit">{language === "fr" ? "Visite technique" : "Technical Visit"}</TabsTrigger>}
          {isStaff && <TabsTrigger value="design-agreement">{language === "fr" ? "Mandat de conception préliminaire" : "Preliminary Design Mandate"}</TabsTrigger>}
          {isStaff && <TabsTrigger value="benchmark">Benchmark</TabsTrigger>}
          {isStaff && <TabsTrigger value="activities">{t("activity.title")}</TabsTrigger>}
          <TabsTrigger value="compare">{language === "fr" ? "Comparer" : "Compare"}</TabsTrigger>
        </TabsList>

        <TabsContent value="consumption" className="space-y-6">
          {isStaff && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("site.uploadFiles")}</CardTitle>
              </CardHeader>
              <CardContent>
                <FileUploadZone siteId={site.id} onUploadComplete={() => refetch()} />
              </CardContent>
            </Card>
          )}

          {isStaff && (
            <AnalysisParametersEditor
              value={customAssumptions}
              onChange={setCustomAssumptions}
              disabled={runAnalysisMutation.isPending || !site.roofAreaValidated}
              site={site}
              showOnlyRoofSection={!site.meterFiles?.length}
              onOpenRoofDrawing={() => setIsRoofDrawingModalOpen(true)}
              onGeocodeAndDraw={async () => {
                if (!site.address) {
                  toast({
                    variant: "destructive",
                    title: language === "fr" ? "Adresse manquante" : "Missing address",
                    description: language === "fr"
                      ? "Veuillez d'abord ajouter une adresse dans les paramètres du site."
                      : "Please add an address in site settings first."
                  });
                  return;
                }
                setIsGeocodingAddress(true);
                try {
                  const token = localStorage.getItem("token");
                  const response = await fetch(`/api/sites/${site.id}/geocode`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      ...(token ? { Authorization: `Bearer ${token}` } : {})
                    },
                    credentials: "include"
                  });
                  if (!response.ok) {
                    const data = await response.json();
                    toast({
                      variant: "destructive",
                      title: language === "fr" ? "Erreur de géocodage" : "Geocoding error",
                      description: data.error || (language === "fr"
                        ? "Impossible de localiser l'adresse."
                        : "Could not locate address.")
                    });
                    setIsGeocodingAddress(false);
                    return;
                  }
                  toast({
                    title: language === "fr" ? "Coordonnées trouvées" : "Coordinates found",
                    description: language === "fr" ? "Ouverture de l'outil de dessin..." : "Opening drawing tool..."
                  });
                  await refetch();
                  setIsGeocodingAddress(false);
                  setPendingModalOpen(true);
                } catch (error) {
                  toast({
                    variant: "destructive",
                    title: language === "fr" ? "Erreur" : "Error",
                    description: language === "fr" ? "Erreur de connexion" : "Connection error"
                  });
                  setIsGeocodingAddress(false);
                }
              }}
              roofPolygons={roofPolygons}
            />
          )}

          {isStaff && (
            <StructuralConstraintsEditor
              site={site}
              onUpdate={() => refetch()}
            />
          )}

          {isStaff && (!site.meterFiles || site.meterFiles.length === 0) && (
            <SyntheticProfileGenerator
              siteId={site.id}
              buildingSqFt={site.buildingSqFt}
              clientWebsite={(site as any).client?.website}
              onGenerated={() => refetch()}
            />
          )}

          {isStaff && site.meterFiles && site.meterFiles.length > 0 && latestSimulation && (() => {
            const hourlyProfile = latestSimulation.hourlyProfile as Array<{hour: number; month: number; consumption: number}> | null;
            let monthlyData: Array<{month: number; consumption: number}>;

            if (hourlyProfile && Array.isArray(hourlyProfile) && hourlyProfile.length > 0) {
              const monthTotals: Record<number, number> = {};
              for (const entry of hourlyProfile) {
                const m = entry.month - 1;
                monthTotals[m] = (monthTotals[m] || 0) + (entry.consumption || 0);
              }
              monthlyData = Array.from({length: 12}, (_, m) => ({
                month: m,
                consumption: Math.round(monthTotals[m] || 0),
              }));
            } else {
              const annualKWh = latestSimulation.annualConsumptionKWh || 0;
              const seasonalFactors = [1.15, 1.1, 1.0, 0.9, 0.85, 0.8, 0.75, 0.8, 0.9, 1.0, 1.05, 1.15];
              const factorSum = seasonalFactors.reduce((s, f) => s + f, 0);
              monthlyData = seasonalFactors.map((factor, month) => ({
                month,
                consumption: Math.round((annualKWh * factor) / factorSum),
              }));
            }

            return (
              <LoadProfileEditor
                monthlyData={monthlyData}
                onUpdate={(newData) => {
                  const totalKWh = newData.reduce((sum, d) => sum + d.consumption, 0);
                  setCustomAssumptions(prev => ({
                    ...prev,
                    modifiedMonthlyConsumption: newData,
                  }));
                  toast({
                    title: language === "fr" ? "Profil modifié" : "Profile modified",
                    description: language === "fr"
                      ? `Nouvelle consommation: ${(totalKWh / 1000).toFixed(0)} MWh/an. Relancer l'analyse pour appliquer.`
                      : `New consumption: ${(totalKWh / 1000).toFixed(0)} MWh/year. Re-run analysis to apply.`,
                  });
                }}
                disabled={runAnalysisMutation.isPending || !site.roofAreaValidated}
              />
            );
          })()}

          {/* Files Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-lg">{t("site.files")}</CardTitle>
              {isStaff && (
                <Button
                  onClick={() => runAnalysisMutation.mutate(customAssumptions)}
                  disabled={!site.meterFiles?.length || runAnalysisMutation.isPending || !site.roofAreaValidated}
                  className="gap-2"
                  data-testid="button-run-analysis"
                >
                  {runAnalysisMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {language === "fr" ? "Analyse en cours..." : "Analyzing..."}
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      {t("site.runAnalysis")}
                    </>
                  )}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {site.meterFiles && site.meterFiles.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("site.fileName")}</TableHead>
                      <TableHead>{t("site.granularity")}</TableHead>
                      <TableHead>{t("site.period")}</TableHead>
                      <TableHead>{t("sites.status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {site.meterFiles.map((file) => (
                      <TableRow key={file.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                            {file.fileName}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {file.granularity === "HOUR" ? t("status.hour") : t("status.fifteenMin")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {file.periodStart && file.periodEnd ? (
                            `${new Date(file.periodStart).toLocaleDateString("fr-CA")} - ${new Date(file.periodEnd).toLocaleDateString("fr-CA")}`
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          <FileStatusBadge status={file.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                    <Upload className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h4 className="font-medium mb-1">
                    {language === "fr" ? "Aucun fichier importé" : "No files imported"}
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3 max-w-sm mx-auto">
                    {language === "fr"
                      ? "Utilisez la zone d'importation ci-dessus pour ajouter des fichiers CSV d'Hydro-Québec."
                      : "Use the upload zone above to add Hydro-Québec CSV files."}
                  </p>
                  {isStaff && (
                    <p className="text-xs text-muted-foreground">
                      {language === "fr"
                        ? "Formats acceptés: Données horaires ou aux 15 minutes"
                        : "Accepted formats: Hourly or 15-minute data"}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-6">
          {(runAnalysisMutation.isPending || isTransitioningSimulation) ? (
            <Card>
              <CardContent className="py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
                <h3 className="text-lg font-medium mb-2">
                  {language === "fr" ? "Analyse en cours..." : "Analysis in progress..."}
                </h3>
                <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                  {language === "fr"
                    ? "Traitement des données de consommation et calcul du dimensionnement optimal du système solaire et stockage."
                    : "Processing consumption data and calculating optimal solar and storage system sizing."}
                </p>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  {language === "fr" ? "Cela peut prendre quelques instants..." : "This may take a moment..."}
                </div>
              </CardContent>
            </Card>
          ) : latestSimulation ? (
            <>
              {(site.simulationRuns?.length ?? 0) > 1 && (
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setActiveTab("compare")}
                    className="gap-2"
                    data-testid="button-compare-scenarios"
                  >
                    <Scale className="w-4 h-4" />
                    {language === "fr" ? "Comparer les scénarios" : "Compare scenarios"}
                  </Button>
                </div>
              )}
              <AnalysisResults
                simulation={getFullSimulation(latestSimulation.id) || latestSimulation}
                site={site}
                isStaff={isStaff}
                onNavigateToDesignAgreement={() => setActiveTab("design-agreement")}
                isLoadingFullData={loadingFullSimulation === latestSimulation.id || !isFullDataLoaded(latestSimulation.id)}
                optimizationTarget={optimizationTarget}
                onOptimizationTargetChange={setOptimizationTarget}
              />
            </>
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <BarChart3 className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-1">
                  {language === "fr" ? "Aucune analyse disponible" : "No analysis available"}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {isClient
                    ? (language === "fr"
                        ? "L'analyse pour ce site est en cours de préparation par notre équipe."
                        : "The analysis for this site is being prepared by our team.")
                    : (language === "fr"
                        ? "Importez des fichiers CSV et lancez une analyse pour voir les résultats."
                        : "Import CSV files and run an analysis to see results.")}
                </p>
                {isStaff && (
                  <Button
                    onClick={() => runAnalysisMutation.mutate(customAssumptions)}
                    disabled={!site.meterFiles?.length || runAnalysisMutation.isPending || !site.roofAreaValidated}
                    className="gap-2"
                  >
                    <Play className="w-4 h-4" />
                    {t("site.runAnalysis")}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="compare" className="space-y-6">
          <ScenarioComparison
            simulations={site.simulationRuns || []}
            site={site}
            selectedSimulationId={selectedSimulationId || undefined}
            onSelectSimulation={(simId) => {
              setSelectedSimulationId(simId);
              setActiveTab("analysis");
              toast({
                title: language === "fr" ? "Scénario sélectionné" : "Scenario selected",
                description: language === "fr"
                  ? "Les résultats affichés correspondent maintenant au scénario choisi."
                  : "The displayed results now correspond to the selected scenario."
              });
            }}
          />
        </TabsContent>

        {isStaff && (
          <TabsContent value="site-visit" className="space-y-6">
            <SiteVisitSection
              siteId={site.id}
              siteLat={site.latitude}
              siteLng={site.longitude}
              designAgreementStatus={designAgreement?.status}
            />
          </TabsContent>
        )}

        {isStaff && (
          <TabsContent value="design-agreement" className="space-y-6">
            <DesignAgreementSection siteId={site.id} />
          </TabsContent>
        )}

        {isStaff && (
          <TabsContent value="benchmark" className="space-y-6">
            <BenchmarkTab siteId={site.id} simulationRuns={site.simulationRuns || []} />
          </TabsContent>
        )}

        {isStaff && (
          <TabsContent value="activities" className="space-y-6">
            <ActivityFeed
              siteId={site.id}
              clientId={site.clientId}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* Bifacial PV Detection Dialog */}
      <Dialog open={bifacialDialogOpen} onOpenChange={setBifacialDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sun className="w-5 h-5 text-yellow-500" />
              {t("bifacial.detected.title")}
            </DialogTitle>
            <DialogDescription className="space-y-3">
              <p>{t("bifacial.detected.description")}</p>
              <p className="font-medium text-foreground">{t("bifacial.detected.question")}</p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => bifacialResponseMutation.mutate(false)}
              disabled={bifacialResponseMutation.isPending}
              data-testid="button-bifacial-decline"
            >
              {t("bifacial.detected.decline")}
            </Button>
            <Button
              onClick={() => bifacialResponseMutation.mutate(true)}
              disabled={bifacialResponseMutation.isPending}
              className="gap-2"
              data-testid="button-bifacial-accept"
            >
              <Sparkles className="w-4 h-4" />
              {t("bifacial.detected.accept")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Roof Drawing Modal */}
      {site && site.latitude && site.longitude && (
        <RoofDrawingModal
          isOpen={isRoofDrawingModalOpen}
          onClose={() => setIsRoofDrawingModalOpen(false)}
          siteId={site.id}
          latitude={site.latitude}
          longitude={site.longitude}
          existingPolygons={roofPolygons}
          onSave={handleSaveRoofPolygons}
        />
      )}
    </div>
  );
}
