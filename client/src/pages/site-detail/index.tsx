import React, { useState, useCallback, useEffect, Fragment, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
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
  AlertTriangle,
  Sun,
  Layers,
  XCircle,
  Scale,
  Grid3X3,
  Pencil,
  Gift,
  MoreHorizontal,
  Archive,
  ArchiveRestore,
  Trash2,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Share2,
  FileSignature,
  Send,
  Mail,
  Gauge,
  FileSpreadsheet,
  X
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import SLDDiagram, { type SLDArrayInfo, type SLDElectricalConfig } from "@/components/SLDDiagram";
import ClientWizard from "@/components/ClientWizard";
import { GrantPortalAccessDialog } from "@/components/grant-portal-access-dialog";

import { FileUploadZone } from "./components/FileUploadZone";
import { HQDataFetchInline } from "./components/HQDataFetchInline";
import { FileStatusBadge } from "./components/FileStatusBadge";
import { AnalysisParametersEditor } from "./components/AnalysisParametersEditor";
import { StructuralConstraintsEditor } from "./components/StructuralConstraintsEditor";
import { DownloadReportButton } from "./components/DownloadReportButton";
import { ScenarioComparison } from "./components/ScenarioComparison";
import { AnalysisResults } from "./components/AnalysisResults";
import { BenchmarkTab } from "./components/BenchmarkTab";
import { OperationsTab } from "./components/OperationsTab";
import { QuickInfoForm } from "./components/QuickInfoForm";
import type { SiteWithDetails, QuickPotentialResult } from "./types";
import { formatNumber, getTariffRates } from "./utils";
import { formatSmartPower, formatSmartEnergy, formatSmartCurrency, formatSmartNumber, formatSmartPercent } from "@shared/formatters";
import { WorkflowStepper } from "@/components/WorkflowStepper";
import { useWorkflowProgress } from "@/hooks/useWorkflowProgress";
import { WORKFLOW_STEPS, getStepForTab } from "@shared/workflowSteps";

export default function SiteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, language } = useI18n();
  const { toast } = useToast();
  const { isStaff, isClient, token } = useAuth();
  const [activeTab, setActiveTab] = useState("quick-analysis");
  const initialTabSetRef = useRef(false);
  const prevSiteIdRef = useRef<string | undefined>(undefined);
  const [customAssumptions, setCustomAssumptions] = useState<Partial<AnalysisAssumptions>>({});
  const assumptionsInitializedRef = useRef(false);
  const [selectedSimulationId, setSelectedSimulationId] = useState<string | null>(null);
  const pendingNewSimulationIdRef = useRef<string | null>(null);
  const autoAnalysisTriggeredRef = useRef(false);
  // Bifacial is always enabled for Quebec (snow albedo makes it worthwhile on any roof)
  const [isRoofDrawingModalOpen, setIsRoofDrawingModalOpen] = useState(false);
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);
  const [pendingModalOpen, setPendingModalOpen] = useState(false);
  const [optimizationTarget, setOptimizationTarget] = useState<'npv' | 'irr' | 'selfSufficiency'>('npv');
  const [syntheticBannerDismissed, setSyntheticBannerDismissed] = useState(false);
  const [isTransitioningSimulation, setIsTransitioningSimulation] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPortalAccessDialogOpen, setIsPortalAccessDialogOpen] = useState(false);
  const [isHqProcurationDialogOpen, setIsHqProcurationDialogOpen] = useState(false);
  const [procurationLanguage, setProcurationLanguage] = useState<"fr" | "en">(language as "fr" | "en");
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [, setLocation] = useLocation();


  const [quickPotential, setQuickPotential] = useState<QuickPotentialResult | null>(null);

  // Constraint factor for quick analysis (5-25%, default 10%)
  const [constraintFactor, setConstraintFactor] = useState(10);

  // Geometry-based capacity from RoofVisualization (more accurate than backend estimate)
  const [geometryCapacity, setGeometryCapacity] = useState<{
    maxCapacityKW: number;
    panelCount: number;
    realisticCapacityKW: number;
    constraintAreaSqM: number;
    arrays?: SLDArrayInfo[];
  } | null>(null);

  // SLD inverter type toggle
  const [sldInverterType, setSldInverterType] = useState<"string" | "micro">("string");

  // Visualization capture function ref for PDF generation
  const visualizationCaptureRef = useRef<(() => Promise<string | null>) | null>(null);

  // Lazy loading for full simulation data (heavy JSON columns: cashflows, breakdown, hourlyProfile, peakWeekData, sensitivity)
  const [fullSimulationRuns, setFullSimulationRuns] = useState<Map<string, SimulationRun>>(new Map());
  const [loadingFullSimulation, setLoadingFullSimulation] = useState<string | null>(null);

  const { data: site, isLoading, refetch } = useQuery<SiteWithDetails>({
    queryKey: ["/api/sites", id],
    enabled: !!id,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });

  // Restore geometryCapacity from DB when state is null but DB has saved values
  // This ensures SLD and other consumers get data even when RoofVisualization hasn't rendered yet
  useEffect(() => {
    if (geometryCapacity) return; // Already have live data
    if (!site?.kbKwDc || !site?.kbPanelCount) return; // Nothing saved in DB
    setGeometryCapacity({
      maxCapacityKW: site.kbKwDc,
      panelCount: site.kbPanelCount,
      realisticCapacityKW: Math.round(site.kbKwDc * 0.9),
      constraintAreaSqM: 0, // Not persisted, not critical for SLD
      // arrays not available from DB restore — will be populated when RoofVisualization renders
    });
  }, [site?.kbKwDc, site?.kbPanelCount, geometryCapacity]);

  // Query to fetch existing roof polygons
  const { data: roofPolygons = [], isSuccess: roofPolygonsLoaded } = useQuery<RoofPolygon[]>({
    queryKey: ['/api/sites', id, 'roof-polygons'],
    enabled: !!id
  });

  const roofCopyAttemptedRef = useRef<string | null>(null);
  const [roofCopyOffer, setRoofCopyOffer] = useState<{
    sourceId: string;
    sourceName: string;
    polygonCount: number;
    totalAreaSqM: number;
  } | null>(null);
  const [isRoofCopying, setIsRoofCopying] = useState(false);

  useEffect(() => {
    if (!site || !id || !roofPolygonsLoaded) return;
    if (roofPolygons.length > 0) return;
    if (roofCopyAttemptedRef.current === id) return;
    roofCopyAttemptedRef.current = id;

    apiRequest<{ available: boolean; sourceId?: string; sourceName?: string; polygonCount?: number; totalAreaSqM?: number }>(
      "GET", `/api/sites/${id}/copy-roof-from-address?preview=true`
    ).then((result) => {
      if (result.available && result.sourceId) {
        setRoofCopyOffer({
          sourceId: result.sourceId,
          sourceName: result.sourceName || result.sourceId,
          polygonCount: result.polygonCount || 0,
          totalAreaSqM: result.totalAreaSqM || 0,
        });
      }
    }).catch(() => {});
  }, [site, id, roofPolygonsLoaded, roofPolygons.length]);

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

      const result = await apiRequest<{ simulationId?: string; id?: string }>("POST", `/api/sites/${id}/run-potential-analysis`, { 
        assumptions: mergedAssumptions,
      });
      return result;
    },
    onSuccess: (data) => {
      setIsTransitioningSimulation(true);
      const newSimId = data?.simulationId || data?.id;
      if (newSimId) {
        pendingNewSimulationIdRef.current = newSimId;
      } else {
        pendingNewSimulationIdRef.current = "__latest__";
      }
      queryClient.invalidateQueries({ queryKey: ["/api/sites", id] });
      toast({ title: language === "fr" ? "Analyse terminée avec succès" : "Analysis completed successfully" });
      setActiveTab("analysis");
    },
    onError: (error: Error) => {
      autoAnalysisTriggeredRef.current = false;
      const errorMessage = error.message || (language === "fr" ? "Erreur lors de l'analyse" : "Error during analysis");
      toast({
        title: language === "fr" ? "Erreur lors de l'analyse" : "Error during analysis",
        description: errorMessage,
        variant: "destructive"
      });
    },
  });

  // Reset auto-trigger ref when navigating to a different site
  useEffect(() => {
    autoAnalysisTriggeredRef.current = false;
  }, [id]);

  // Auto-trigger analysis when consumption data is available and no analysis exists yet
  useEffect(() => {
    if (
      site &&
      isStaff &&
      !autoAnalysisTriggeredRef.current &&
      !runAnalysisMutation.isPending &&
      site.roofAreaValidated &&
      site.meterFiles && site.meterFiles.length > 0 &&
      (!site.simulationRuns || site.simulationRuns.length === 0)
    ) {
      autoAnalysisTriggeredRef.current = true;
      runAnalysisMutation.mutate(customAssumptions);
    }
  }, [site, isStaff, customAssumptions, id]);

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
          body: JSON.stringify({ imageDataUrl: imageData }),
        });
        if (!resp.ok) console.warn("Failed to save roof visualization before download");
      }
    } catch (e) {
      console.error("Failed to capture roof visualization:", e);
    }
  };


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
        apiRequest("PATCH", `/api/sites/${id}`, { buildingSqFt: totalAreaSqFt }).then(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/sites", id] });
        }).catch(() => {});
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

  const editSiteMutation = useMutation({
    mutationFn: async (data: { name: string; address: string; city: string; notes: string }) => {
      return apiRequest("PATCH", `/api/sites/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites", id] });
      setIsEditDialogOpen(false);
      toast({ title: language === "fr" ? "Site mis a jour" : "Site updated" });
    },
    onError: () => {
      toast({ title: language === "fr" ? "Erreur" : "Error", variant: "destructive" });
    },
  });

  const sendSiteProcurationMutation = useMutation({
    mutationFn: async ({ lang }: { lang: "fr" | "en" }) => {
      return apiRequest("POST", `/api/sites/${id}/send-hq-procuration`, { language: lang });
    },
    onSuccess: () => {
      toast({
        title: language === "fr" ? "Procuration envoyée" : "Procuration sent",
        description: language === "fr"
          ? `Courriel envoyé à ${site?.client?.email}`
          : `Email sent to ${site?.client?.email}`
      });
      setIsHqProcurationDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/sites', id] });
    },
    onError: (error: any) => {
      let message = error?.message || (language === "fr" ? "Erreur d'envoi" : "Send error");
      try {
        const colonIndex = message.indexOf(': ');
        if (colonIndex > 0) {
          const bodyPart = message.substring(colonIndex + 2);
          const parsed = JSON.parse(bodyPart);
          if (parsed.error) {
            message = parsed.error;
          }
        }
      } catch {}
      toast({
        title: language === "fr" ? "Erreur d'envoi" : "Send error",
        description: message,
        variant: "destructive"
      });
    },
  });

  const archiveSiteMutation = useMutation({
    mutationFn: async () => {
      const endpoint = (site as any)?.isArchived ? `/api/sites/${id}/unarchive` : `/api/sites/${id}/archive`;
      return apiRequest("POST", endpoint);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites", id] });
      const msg = (site as any)?.isArchived
        ? (language === "fr" ? "Site desarchive" : "Site unarchived")
        : (language === "fr" ? "Site archive" : "Site archived");
      toast({ title: msg });
    },
    onError: () => {
      toast({ title: language === "fr" ? "Erreur" : "Error", variant: "destructive" });
    },
  });

  const deleteSiteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/sites/${id}/cascade`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites/list"] });
      toast({ title: language === "fr" ? "Site supprime" : "Site deleted" });
      setLocation("/app/sites");
    },
    onError: (error: Error) => {
      let errorMessage = language === "fr" ? "Impossible de supprimer" : "Cannot delete";
      try {
        const match = error.message?.match(/^\d+:\s*(.+)$/);
        if (match) {
          const parsed = JSON.parse(match[1]);
          errorMessage = parsed.error || errorMessage;
        }
      } catch {
        if (error.message) errorMessage = error.message.replace(/^\d+:\s*/, '');
      }
      toast({ title: errorMessage, variant: "destructive" });
    },
  });

  const { data: siblingSites = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['/api/clients', site?.clientId, 'sites'],
    queryFn: async () => {
      return await apiRequest<Array<{ id: string; name: string }>>("GET", `/api/clients/${site?.clientId}/sites`);
    },
    enabled: !!site?.clientId && isStaff,
  });

  const currentIndex = siblingSites.findIndex(s => s.id === id);
  const prevSite = currentIndex > 0 ? siblingSites[currentIndex - 1] : null;
  const nextSite = currentIndex < siblingSites.length - 1 ? siblingSites[currentIndex + 1] : null;

  const handleBack = () => {
    if (window.history.length > 1 && document.referrer && document.referrer.includes(window.location.host)) {
      window.history.back();
    } else {
      setLocation(isClient ? "/app/portal" : "/app/sites");
    }
  };

  // Bifacial is always enabled — no dialog needed (Quebec snow albedo)

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
  }, [site, mostRecentSimulationFromAll, selectedSimulationId, id]);

  const filteredSimulations = useMemo(() => {
    if (!site?.simulationRuns) return [];
    return site.simulationRuns;
  }, [site?.simulationRuns]);

  // The simulation to display - with self-healing for stale selectedSimulationId
  const latestSimulation = useMemo(() => {
    if (selectedSimulationId && selectedSimulationId !== "__latest__") {
      const found = filteredSimulations.find(s => s.id === selectedSimulationId) 
        || site?.simulationRuns?.find(s => s.id === selectedSimulationId);
      if (found) return found;
    }
    return filteredSimulations.find(s => s.type === "SCENARIO") || filteredSimulations[0] || null;
  }, [selectedSimulationId, filteredSimulations, site?.simulationRuns]);

  useEffect(() => {
    if (selectedSimulationId && selectedSimulationId !== "__latest__" && filteredSimulations.length > 0) {
      const exists = filteredSimulations.some(s => s.id === selectedSimulationId);
      if (!exists) {
        const fallback = filteredSimulations.find(s => s.type === "SCENARIO") || filteredSimulations[0];
        if (fallback) {
          setSelectedSimulationId(fallback.id);
        }
      }
    }
  }, [selectedSimulationId, filteredSimulations]);

  // Auto-fetch full simulation data when viewing analysis tab
  useEffect(() => {
    if (activeTab === "analysis") {
      if (site && site.analysisAvailable && (!site.simulationRuns || site.simulationRuns.length === 0)) {
        refetch();
      }

      const targetSimId = selectedSimulationId && selectedSimulationId !== "__latest__"
        ? selectedSimulationId
        : (mostRecentSimulationFromAll?.id || site?.simulationRuns?.[0]?.id || null);

      if (targetSimId && !fullSimulationRuns.has(targetSimId)) {
        fetchFullSimulation(targetSimId);
      }
    }
  }, [activeTab, selectedSimulationId, mostRecentSimulationFromAll?.id, site?.simulationRuns, fullSimulationRuns, fetchFullSimulation, site, refetch]);

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

  const getStepStatus = useCallback((stepValue: string): "complete" | "available" | "pending" => {
    const hasConsumptionData = (site?.meterFiles?.length ?? 0) > 0;
    const hasAnalysis = !!latestSimulation;
    const hasDesignAgreement = !!designAgreement;

    switch (stepValue) {
      case "quick-analysis":
        const hasQuickInfo = !!(site?.quickInfoCompletedAt || site?.buildingType || site?.roofAreaSqM || site?.estimatedMonthlyBill);
        return (hasQuickInfo || quickPotential || site?.roofAreaValidated) ? "complete" : "pending";
      case "consumption":
        return hasConsumptionData ? "complete" : "pending";
      case "analysis":
        return hasAnalysis ? "complete" : (hasConsumptionData && site?.roofAreaValidated) ? "available" : "pending";
      case "design-agreement":
        return hasDesignAgreement ? "complete" : hasAnalysis ? "available" : "pending";
      case "site-visit":
        return hasAnalysis ? "available" : "pending";
      default:
        return "pending";
    }
  }, [site, latestSimulation, designAgreement, quickPotential]);

  const workflowSteps = [
    { value: "quick-analysis", label: language === "fr" ? "Analyse rapide" : "Quick Analysis", stepNum: 1 },
    { value: "consumption", label: language === "fr" ? "Données de consommation" : "Consumption Data", stepNum: 2 },
    { value: "analysis", label: language === "fr" ? "Validation économique" : "Economic Validation", stepNum: 3 },
    { value: "design-agreement", label: language === "fr" ? "Mandat" : "Mandate", stepNum: 4 },
    { value: "site-visit", label: language === "fr" ? "Validation technique" : "Technical Validation", stepNum: 5 },
    { value: "epc-proposal", label: language === "fr" ? "Proposition EPC" : "EPC Proposal", stepNum: 6 },
    { value: "plans-specs", label: language === "fr" ? "Plans & devis" : "Plans & Specs", stepNum: 7 },
    { value: "permits", label: language === "fr" ? "Permis et installation" : "Permits & Installation", stepNum: 8 },
    { value: "operations", label: language === "fr" ? "O&M" : "O&M", stepNum: 9 },
  ];

  const { data: clientProcurations } = useQuery<any[]>({
    queryKey: ["/api/clients", site?.clientId, "procurations"],
    enabled: !!site?.clientId && !isClient,
  });
  const hasProcurationSigned = (clientProcurations ?? []).some((p: any) => p.status === "signed");

  // Unified workflow progress (new 6-step model)
  const opportunityStage = opportunities.length > 0 ? opportunities[0].stage : "prospect";
  const workflowProgress = useWorkflowProgress({
    site,
    designAgreement,
    opportunityStage,
    viewMode: isClient ? "client" : "am",
    hasProcurationSigned,
  });

  // Map from unified step click to the appropriate tab
  // If user is already on a tab belonging to the clicked step, don't navigate away
  const handleStepClick = (stepId: string, firstTab: string) => {
    const clickedStep = WORKFLOW_STEPS.find(s => s.id === stepId);
    if (clickedStep && clickedStep.tabs.includes(activeTab)) {
      return;
    }
    setActiveTab(firstTab);
  };

  useEffect(() => {
    if (prevSiteIdRef.current !== id) {
      prevSiteIdRef.current = id;
      initialTabSetRef.current = false;
      // Reset simulation selection when switching sites
      setSelectedSimulationId(null);
      pendingNewSimulationIdRef.current = null;
      autoAnalysisTriggeredRef.current = false;
      assumptionsInitializedRef.current = false;
    }
  }, [id]);

  useEffect(() => {
    if (initialTabSetRef.current || isLoading || !site) return;
    initialTabSetRef.current = true;
    const stepsToCheck = isStaff
      ? workflowSteps
      : workflowSteps.filter(s => ["quick-analysis", "consumption", "analysis"].includes(s.value));
    for (const step of stepsToCheck) {
      const status = getStepStatus(step.value);
      if (status !== "complete") {
        setActiveTab(step.value);
        return;
      }
      if (step.value === "analysis" && status === "complete") {
        setActiveTab("analysis");
        return;
      }
    }
    setActiveTab(stepsToCheck[stepsToCheck.length - 1]?.value ?? "quick-analysis");
  }, [isLoading, site, isStaff, getStepStatus]);

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

  const postAnalysisSteps = ["analysis", "design-agreement", "site-visit", "epc-proposal", "plans-specs", "permits", "operations", "compare", "activities"];
  const designSteps = ["analysis", "design-agreement"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack} data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            {isStaff && (
              <Breadcrumb className="mb-2">
                <BreadcrumbList>
                  {site.client ? (
                    <>
                      <BreadcrumbItem>
                        <BreadcrumbLink asChild>
                          <Link href="/app/clients" data-testid="breadcrumb-clients">
                            {language === "fr" ? "Clients" : "Clients"}
                          </Link>
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <BreadcrumbLink asChild>
                          <Link href={`/app/clients/${site.client.id}/sites`} data-testid="breadcrumb-client-name">
                            {site.client.name}
                          </Link>
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <BreadcrumbLink asChild>
                          <Link href="/app/sites" data-testid="breadcrumb-sites">
                            Sites
                          </Link>
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator />
                    </>
                  ) : (
                    <>
                      <BreadcrumbItem>
                        <BreadcrumbLink asChild>
                          <Link href="/app/sites" data-testid="breadcrumb-sites">
                            Sites
                          </Link>
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator />
                    </>
                  )}
                  <BreadcrumbItem>
                    <BreadcrumbPage data-testid="breadcrumb-current">{site.name}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            )}
            <div className="flex items-center gap-3">
              {prevSite && (
                <Link href={`/app/sites/${prevSite.id}`}>
                  <Button variant="ghost" size="icon" data-testid="button-prev-site" title={prevSite.name}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                </Link>
              )}
              <h1 className="text-3xl font-bold tracking-tight">{site.name}</h1>
              {nextSite && (
                <Link href={`/app/sites/${nextSite.id}`}>
                  <Button variant="ghost" size="icon" data-testid="button-next-site" title={nextSite.name}>
                    <ChevronRightIcon className="w-4 h-4" />
                  </Button>
                </Link>
              )}
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
          {/* Presentation Mode Button */}
          {latestSimulation && postAnalysisSteps.includes(activeTab) && (
            <Link href={`/app/presentation/${site.id}${latestSimulation ? `?sim=${latestSimulation.id}&opt=${optimizationTarget}` : ''}`}>
              <Button variant="outline" className="gap-2" data-testid="button-presentation-mode">
                <Layers className="w-4 h-4" />
                {language === "fr" ? "Présentation" : "Presentation"}
              </Button>
            </Link>
          )}
          {/* Project Info Sheet PDF Button - Staff only, only for RFP portfolio sites */}
          {isStaff && latestSimulation && postAnalysisSteps.includes(activeTab) && (site as any).procurementProcess === "rfp_required" && (
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
          {latestSimulation && postAnalysisSteps.includes(activeTab) && (
            <>
              {(() => {
                const qualifiedStages = ["qualified", "analysis_done", "design_mandate_signed", "epc_proposal_sent", "negotiation", "won"];
                const isQualified = !!designAgreement || opportunities.some(opp => qualifiedStages.includes(opp.stage));
                return (
                  <DownloadReportButton
                    simulationId={latestSimulation.id}
                    siteName={site.name}
                    optimizationTarget={optimizationTarget}
                    isQualified={isQualified || isStaff}
                  />
                );
              })()}
            </>
          )}
          {isStaff && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="button-site-actions-menu">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  data-testid="menu-item-edit-site"
                  onClick={() => {
                    setEditName(site.name || "");
                    setEditAddress(site.address || "");
                    setEditCity(site.city || "");
                    setEditNotes(site.notes || "");
                    setIsEditDialogOpen(true);
                  }}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  {language === "fr" ? "Modifier" : "Edit"}
                </DropdownMenuItem>
                {site.analysisAvailable && (
                  <DropdownMenuItem
                    data-testid="menu-item-share-portal"
                    onClick={() => setIsPortalAccessDialogOpen(true)}
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    {language === "fr" ? "Partager au client" : "Share with client"}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  data-testid="menu-item-activities"
                  onClick={() => setActiveTab("activities")}
                >
                  <Clock className="w-4 h-4 mr-2" />
                  {t("activity.title")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  data-testid="menu-item-send-hq-procuration"
                  onClick={() => setIsHqProcurationDialogOpen(true)}
                >
                  <FileSignature className="w-4 h-4 mr-2" />
                  {language === "fr" ? "Envoyer procuration HQ" : "Send HQ Procuration"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  data-testid="menu-item-archive-site"
                  onClick={() => archiveSiteMutation.mutate()}
                >
                  {(site as any)?.isArchived ? (
                    <>
                      <ArchiveRestore className="w-4 h-4 mr-2" />
                      {language === "fr" ? "Desarchiver" : "Unarchive"}
                    </>
                  ) : (
                    <>
                      <Archive className="w-4 h-4 mr-2" />
                      {language === "fr" ? "Archiver" : "Archive"}
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  data-testid="menu-item-delete-site"
                  onClick={() => setIsDeleteDialogOpen(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {language === "fr" ? "Supprimer" : "Delete"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Edit Site Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{language === "fr" ? "Modifier le site" : "Edit Site"}</DialogTitle>
            <DialogDescription>
              {language === "fr" ? "Modifier les informations de base du site." : "Edit basic site information."}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              editSiteMutation.mutate({ name: editName, address: editAddress, city: editCity, notes: editNotes });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="edit-name">{language === "fr" ? "Nom" : "Name"}</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                data-testid="input-edit-site-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-address">{language === "fr" ? "Adresse" : "Address"}</Label>
              <Input
                id="edit-address"
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                data-testid="input-edit-site-address"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-city">{language === "fr" ? "Ville" : "City"}</Label>
              <Input
                id="edit-city"
                value={editCity}
                onChange={(e) => setEditCity(e.target.value)}
                data-testid="input-edit-site-city"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">{language === "fr" ? "Notes" : "Notes"}</Label>
              <Textarea
                id="edit-notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                className="resize-none"
                data-testid="textarea-edit-site-notes"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} data-testid="button-cancel-edit-site">
                {language === "fr" ? "Annuler" : "Cancel"}
              </Button>
              <Button type="submit" disabled={editSiteMutation.isPending} data-testid="button-save-edit-site">
                {editSiteMutation.isPending
                  ? (language === "fr" ? "Enregistrement..." : "Saving...")
                  : (language === "fr" ? "Enregistrer" : "Save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Site Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === "fr" ? "Supprimer le site" : "Delete Site"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  {language === "fr"
                    ? `Etes-vous sur de vouloir supprimer le site "${site.name}" ? Cette action est irreversible.`
                    : `Are you sure you want to delete the site "${site.name}"? This action cannot be undone.`}
                </p>
                <div className="rounded-lg border p-3 space-y-1 text-sm">
                  <p data-testid="text-delete-simulation-count">
                    {language === "fr" ? "Simulations" : "Simulation runs"}: <strong>{site.simulationRuns?.length || 0}</strong>
                  </p>
                  <p data-testid="text-delete-meter-count">
                    {language === "fr" ? "Fichiers de compteur" : "Meter files"}: <strong>{site.meterFiles?.length || 0}</strong>
                  </p>
                  <p data-testid="text-delete-polygon-count">
                    {language === "fr" ? "Zones de toit" : "Roof polygons"}: <strong>{roofPolygons.length}</strong>
                  </p>
                </div>
                <p className="font-medium text-destructive">
                  {language === "fr"
                    ? "Toutes les donnees associees seront definitivement supprimees."
                    : "All associated data will be permanently deleted."}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-site">
              {language === "fr" ? "Annuler" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteSiteMutation.mutate()}
              disabled={deleteSiteMutation.isPending}
              data-testid="button-confirm-delete-site"
            >
              {deleteSiteMutation.isPending
                ? (language === "fr" ? "Suppression..." : "Deleting...")
                : (language === "fr" ? "Confirmer la suppression" : "Confirm Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Roof Copy Confirmation Dialog */}
      <AlertDialog open={roofCopyOffer !== null} onOpenChange={(open) => { if (!open) setRoofCopyOffer(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === "fr" ? "Copier le dessin de toiture?" : "Copy roof drawing?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === "fr"
                ? `Un site frère (${roofCopyOffer?.sourceName}) à cette adresse a ${roofCopyOffer?.polygonCount} polygone(s) (${roofCopyOffer?.totalAreaSqM} m²). Voulez-vous copier ce dessin de toiture?`
                : `A sibling site (${roofCopyOffer?.sourceName}) at this address has ${roofCopyOffer?.polygonCount} polygon(s) (${roofCopyOffer?.totalAreaSqM} m²). Copy this roof drawing?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {language === "fr" ? "Non, dessiner manuellement" : "No, draw manually"}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isRoofCopying}
              onClick={() => {
                setIsRoofCopying(true);
                apiRequest<{ copied: boolean }>(
                  "GET", `/api/sites/${id}/copy-roof-from-address`
                ).then((result) => {
                  if (result.copied) {
                    queryClient.invalidateQueries({ queryKey: ['/api/sites', id, 'roof-polygons'] });
                    queryClient.invalidateQueries({ queryKey: ['/api/sites', id] });
                    toast({
                      title: language === "fr"
                        ? "Dessin de toit copié avec succès"
                        : "Roof drawing copied successfully",
                    });
                  }
                }).catch(() => {
                  toast({
                    title: language === "fr" ? "Erreur lors de la copie" : "Error copying roof drawing",
                    variant: "destructive",
                  });
                }).finally(() => {
                  setIsRoofCopying(false);
                  setRoofCopyOffer(null);
                });
              }}
            >
              {isRoofCopying
                ? (language === "fr" ? "Copie en cours..." : "Copying...")
                : (language === "fr" ? "Oui, copier" : "Yes, copy")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                    ? "Avant de lancer la validation économique, vous devez délimiter manuellement les zones de toit exploitables."
                    : "Before running the economic validation, you must manually outline the usable roof areas."}
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

      {/* Client Wizard — guided sequential experience */}
      {isClient && (
        <ClientWizard
          site={site}
          quickPotential={quickPotential}
          latestSimulation={latestSimulation}
          designAgreement={designAgreement}
          opportunityStage={opportunityStage}
          onNavigateToTab={setActiveTab}
          language={language as "fr" | "en"}
        />
      )}

      {/* Process Tabs with workflow stepper (Staff/AM view) */}
      {!isClient && (
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div role="presentation">
          <WorkflowStepper
            steps={workflowProgress.steps}
            overallProgress={workflowProgress.overallProgress}
            totalPoints={workflowProgress.totalPoints}
            maxTotalPoints={workflowProgress.maxTotalPoints}
            viewMode={isClient ? "client" : "am"}
            activeStepId={getStepForTab(activeTab)?.id}
            onStepClick={handleStepClick}
            compact={false}
          />
        </div>

        {/* Next action banner for AM */}
        {(() => {
          const actions: { label: string; tab: string; priority: number }[] = [];
          const fr = language === "fr";

          // Check what needs to be done based on project state
          if (!site?.buildingType || !site?.roofType) {
            actions.push({ label: fr ? "Compléter les informations du bâtiment" : "Complete building information", tab: "quick-analysis", priority: 1 });
          }
          if (!site?.meterFiles?.length && !site?.annualConsumptionKwh) {
            actions.push({ label: fr ? "Importer les données de consommation" : "Import consumption data", tab: "consumption", priority: 2 });
          } else if (site?.meterFiles?.length > 0 && !latestSimulation) {
            actions.push({ label: fr ? "Lancer la validation économique" : "Run economic validation", tab: "analysis", priority: 3 });
          }
          if (latestSimulation && !designAgreement) {
            actions.push({ label: fr ? "Préparer et envoyer le mandat" : "Prepare and send mandate", tab: "design-agreement", priority: 4 });
          }
          if (designAgreement?.status === "sent") {
            actions.push({ label: fr ? "Relancer le client pour signature du mandat" : "Follow up on mandate signature", tab: "design-agreement", priority: 5 });
          }

          if (actions.length === 0) return null;
          const action = actions.sort((a, b) => a.priority - b.priority)[0];

          return (
            <div
              className="flex items-center gap-3 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-lg cursor-pointer hover:bg-primary/10 transition-colors"
              onClick={() => setActiveTab(action.tab)}
            >
              <ArrowRight className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-sm font-medium text-primary">
                {fr ? "Prochaine action" : "Next action"}: {action.label}
              </span>
            </div>
          );
        })()}

        {/* Sub-navigation for workflow steps with multiple tabs */}
        {(() => {
          const currentStep = getStepForTab(activeTab);
          if (!currentStep || currentStep.tabs.length <= 1) return null;

          const tabLabels: Record<string, { fr: string; en: string }> = {
            "quick-analysis": { fr: "Analyse rapide", en: "Quick Analysis" },
            "consumption": { fr: "Données de consommation", en: "Consumption Data" },
            "analysis": { fr: "Validation économique", en: "Economic Validation" },
            "design-agreement": { fr: "Mandat", en: "Mandate" },
            "site-visit": { fr: "Validation technique", en: "Technical Validation" },
            "epc-proposal": { fr: "Proposition EPC", en: "EPC Proposal" },
            "plans-specs": { fr: "Plans & devis", en: "Plans & Specs" },
            "permits": { fr: "Permis et installation", en: "Permits & Installation" },
            "operations": { fr: "O&M", en: "O&M" },
          };

          return (
            <div className="flex items-center gap-1 px-1 py-1 bg-muted/50 rounded-lg w-fit">
              {currentStep.tabs.map((tab) => {
                const label = tabLabels[tab];
                if (!label) return null;
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      isActive
                        ? "bg-background text-foreground shadow-sm font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                    }`}
                  >
                    {language === "fr" ? label.fr : label.en}
                  </button>
                );
              })}
            </div>
          );
        })()}

        <TabsList className="sr-only">
          <TabsTrigger value="quick-analysis">{language === "fr" ? "Analyse rapide" : "Quick Analysis"}</TabsTrigger>
          <TabsTrigger value="consumption">{t("site.consumption")}</TabsTrigger>
          <TabsTrigger value="analysis">{t("analysis.title")}</TabsTrigger>
          {isStaff && <TabsTrigger value="design-agreement">{language === "fr" ? "Mandat" : "Mandate"}</TabsTrigger>}
          {isStaff && <TabsTrigger value="site-visit">{language === "fr" ? "Validation technique" : "Technical Validation"}</TabsTrigger>}
          {isStaff && <TabsTrigger value="epc-proposal">{language === "fr" ? "Proposition EPC" : "EPC Proposal"}</TabsTrigger>}
          {isStaff && <TabsTrigger value="plans-specs">{language === "fr" ? "Plans & devis" : "Plans & Specs"}</TabsTrigger>}
          {isStaff && <TabsTrigger value="permits">{language === "fr" ? "Permis et installation" : "Permits & Installation"}</TabsTrigger>}
          {isStaff && <TabsTrigger value="operations">{language === "fr" ? "O&M" : "O&M"}</TabsTrigger>}
          {isStaff && <TabsTrigger value="activities">{t("activity.title")}</TabsTrigger>}
          <TabsTrigger value="compare">{language === "fr" ? "Comparer" : "Compare"}</TabsTrigger>
        </TabsList>

        <TabsContent value="quick-analysis" className="space-y-6">
          <QuickInfoForm
            site={site}
            language={language}
            onSaved={() => refetch()}
            onGoToNextStep={() => setActiveTab("consumption")}
          />

          {isStaff && !site.roofAreaValidated && (
            <Card>
              <CardContent className="py-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Grid3X3 className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-medium mb-1">
                      {language === "fr" ? "Dessiner les zones de toiture" : "Draw Roof Areas"}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      {language === "fr"
                        ? "Requis pour la validation économique (étape 3). Délimitez les zones exploitables sur la vue satellite."
                        : "Required for economic validation (step 3). Outline usable areas on the satellite view."}
                    </p>
                    <Button
                      variant="outline"
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
                              headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                              credentials: "include"
                            });
                            if (!response.ok) {
                              const data = await response.json();
                              toast({ variant: "destructive", title: language === "fr" ? "Erreur de géocodage" : "Geocoding error", description: data.error || "" });
                              setIsGeocodingAddress(false);
                              return;
                            }
                            await refetch();
                            setIsGeocodingAddress(false);
                            setPendingModalOpen(true);
                          } catch (error) {
                            toast({ variant: "destructive", title: language === "fr" ? "Erreur" : "Error" });
                            setIsGeocodingAddress(false);
                          }
                        } else {
                          setIsRoofDrawingModalOpen(true);
                        }
                      }}
                      className="gap-2"
                      data-testid="button-draw-roof-step1"
                    >
                      {isGeocodingAddress ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
                      {isGeocodingAddress
                        ? (language === "fr" ? "Localisation..." : "Locating...")
                        : (language === "fr" ? "Dessiner les zones" : "Draw areas")}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {isStaff && site.roofAreaValidated && !quickPotential && !(site.meterFiles && site.meterFiles.length > 0) && (
            <Card>
              <CardContent className="py-8 text-center">
                <Zap className="w-12 h-12 text-primary/50 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-1">
                  {language === "fr" ? "Lancer l'analyse rapide" : "Run Quick Analysis"}
                </h3>
                <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                  {language === "fr"
                    ? "Estimez le potentiel solaire basé sur la surface de toit dessinée."
                    : "Estimate solar potential based on the drawn roof area."}
                </p>
                <div className="flex items-center justify-center gap-2">
                  <Select value={constraintFactor.toString()} onValueChange={(v) => setConstraintFactor(parseInt(v))}>
                    <SelectTrigger className="w-[90px]" data-testid="select-constraint-factor-step1">
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
                    onClick={() => quickPotentialMutation.mutate()}
                    disabled={quickPotentialMutation.isPending}
                    className="gap-2"
                    data-testid="button-quick-potential-step1"
                  >
                    {quickPotentialMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    {language === "fr" ? "Analyse rapide" : "Quick Analysis"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

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
                  const displayedCapacityKW = geometryCapacity?.realisticCapacityKW ?? Math.round(quickPotential.systemSizing.maxCapacityKW);
                  const displayedPanelCount = geometryCapacity?.panelCount ?? quickPotential.systemSizing.numPanels;

                  const costPerW = quickPotential.financial.costPerW || 2.00;
                  const displayedCapex = Math.round(displayedCapacityKW * 1000 * costPerW);
                  const yieldKWhPerKWp = quickPotential.production.yieldKWhPerKWp || 1039;
                  const displayedProductionKWh = Math.round(displayedCapacityKW * yieldKWhPerKWp);

                  const displayedHqIncentive = Math.min(displayedCapacityKW * 1000, displayedCapex * 0.40);
                  const displayedFederalItc = Math.round((displayedCapex - displayedHqIncentive) * 0.30);
                  const displayedNetCapex = displayedCapex - displayedHqIncentive - displayedFederalItc;

                  const energyRate = 0.06061; // Default M tariff rate ($/kWh)
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

                      {displayedNetCapex > 0 && displayedAnnualSavings > 0 && (() => {
                        const discountRate = 0.07; // 7% WACC (matches server-side defaultAnalysisAssumptions)
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
                                {language === "fr" ? "VAN 25 ans (7%)" : "NPV 25 yrs (7%)"}
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

          {quickPotential && !latestSimulation && site && site.latitude && site.longitude && import.meta.env.VITE_GOOGLE_MAPS_API_KEY && (
            <RoofVisualization
              siteId={id!}
              siteName={site.name}
              address={site.address || ""}
              latitude={site.latitude}
              longitude={site.longitude}
              roofAreaSqFt={quickPotential.roofAnalysis.totalRoofAreaSqM * 10.764}
              maxPVCapacityKW={quickPotential.systemSizing.maxCapacityKW}
              onGeometryCalculated={(data) => {
                setGeometryCapacity(data);
                if (data.maxCapacityKW != null && data.maxCapacityKW > 0 && !isNaN(data.maxCapacityKW)) {
                  const savedKw = site?.kbKwDc;
                  const newKw = Math.round(data.maxCapacityKW);
                  if (!savedKw || Math.abs(savedKw - newKw) > 1) {
                    apiRequest("PATCH", `/api/sites/${id}`, {
                      kbPanelCount: data.panelCount,
                      kbKwDc: newKw
                    }).then(() => {
                      queryClient.invalidateQueries({ queryKey: ['/api/sites', id] });
                    }).catch(err => console.error('Failed to save roof capacity:', err));
                  }
                }
              }}
              onVisualizationReady={(captureFunc) => { visualizationCaptureRef.current = captureFunc; }}
            />
          )}

          {(site.meterFiles && site.meterFiles.length > 0) && !quickPotential && (
            <Card>
              <CardContent className="py-8 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-500/50 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-1">
                  {language === "fr" ? "Données de consommation disponibles" : "Consumption Data Available"}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {language === "fr"
                    ? "L'analyse rapide est optionnelle lorsque des données de consommation sont importées. Passez directement à la validation économique."
                    : "Quick analysis is optional when consumption data is imported. Go directly to economic validation."}
                </p>
                <Button variant="outline" onClick={() => setActiveTab("analysis")} className="gap-2">
                  <BarChart3 className="w-4 h-4" />
                  {language === "fr" ? "Voir l'analyse" : "View Analysis"}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="consumption" className="space-y-6">
          {site.meterFiles?.some((f: any) => f.isSynthetic) && !syntheticBannerDismissed && (
            <div data-testid="banner-synthetic-consumption" className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-4">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-amber-800 dark:text-amber-300">
                  {language === "fr" ? "Données synthétiques" : "Synthetic data"}
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  {language === "fr"
                    ? "Ce site utilise un profil de consommation synthétique à des fins de démonstration. Les résultats d'analyse sont indicatifs et ne reflètent pas la consommation réelle du bâtiment."
                    : "This site uses a synthetic consumption profile for demonstration purposes. Analysis results are indicative and do not reflect actual building consumption."}
                </p>
              </div>
              <button
                onClick={() => setSyntheticBannerDismissed(true)}
                className="shrink-0 p-0.5 rounded hover-elevate text-amber-600 dark:text-amber-400"
                data-testid="button-dismiss-synthetic-banner"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {(site.meterFiles?.length ?? 0) > 0 && !site.roofAreaValidated && isStaff && (
            <div data-testid="banner-draw-roof-step2" className="flex items-start gap-3 rounded-md border border-blue-300 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-700 p-4">
              <Grid3X3 className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-blue-800 dark:text-blue-300">
                  {language === "fr" ? "Prochaine action : dessiner les zones de toiture" : "Next action: draw roof areas"}
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  {language === "fr"
                    ? "Les données de consommation sont importées. Dessinez les zones de toit pour pouvoir lancer la validation économique (étape 3)."
                    : "Consumption data is imported. Draw the roof areas to enable economic validation (step 3)."}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab("quick-analysis")}
                className="shrink-0 gap-1"
                data-testid="button-go-draw-roof-step2"
              >
                <Pencil className="w-3 h-3" />
                {language === "fr" ? "Dessiner" : "Draw"}
              </Button>
            </div>
          )}
          {isStaff && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <CardTitle className="text-lg">{t("site.uploadFiles")}</CardTitle>
                  <HQDataFetchInline
                    siteId={site.id}
                    onImportComplete={() => refetch()}
                    hqAccountNumber={site.hqAccountNumber}
                    hqContractNumber={site.hqContractNumber}
                  />
                </div>
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
                      ? `Nouvelle consommation: ${(totalKWh / 1000).toFixed(0)} MWh/an. Relancer la validation pour appliquer.`
                      : `New consumption: ${(totalKWh / 1000).toFixed(0)} MWh/year. Re-run validation to apply.`,
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
              <div className="flex items-center gap-2 flex-wrap">
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
                        {language === "fr" ? "Validation en cours..." : "Validating..."}
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        {t("site.runAnalysis")}
                      </>
                    )}
                  </Button>
                )}
              </div>
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
                            {(file as any).isSynthetic && (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                            )}
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

          {isStaff && (site.hqAccountNumber || site.hqContractNumber || site.hqMeterNumber) && (
            <Card data-testid="section-hq-meter-info">
              <CardHeader className="py-3">
                <div className="flex items-center gap-2">
                  <Gauge className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg">
                    {language === "fr" ? "Compteur Hydro-Québec" : "Hydro-Québec Meter"}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {site.hqAccountNumber && (
                    <div>
                      <p className="text-xs text-muted-foreground">{language === "fr" ? "Numéro de compte" : "Account Number"}</p>
                      <p className="font-mono text-sm" data-testid="text-hq-account">{site.hqAccountNumber}</p>
                    </div>
                  )}
                  {site.hqContractNumber && (
                    <div>
                      <p className="text-xs text-muted-foreground">{language === "fr" ? "Numéro de contrat" : "Contract Number"}</p>
                      <p className="font-mono text-sm" data-testid="text-hq-contract">{site.hqContractNumber}</p>
                    </div>
                  )}
                  {site.hqMeterNumber && (
                    <div>
                      <p className="text-xs text-muted-foreground">{language === "fr" ? "Numéro de compteur" : "Meter Number"}</p>
                      <p className="font-mono text-sm" data-testid="text-hq-meter">{site.hqMeterNumber}</p>
                    </div>
                  )}
                  {site.hqTariffDetail && (
                    <div>
                      <p className="text-xs text-muted-foreground">{language === "fr" ? "Tarif" : "Tariff"}</p>
                      <p className="text-sm" data-testid="text-hq-tariff">{site.hqTariffDetail}</p>
                    </div>
                  )}
                  {(site as any).subscribedPowerKw && (
                    <div>
                      <p className="text-xs text-muted-foreground">{language === "fr" ? "Puissance souscrite" : "Subscribed Power"}</p>
                      <p className="text-sm" data-testid="text-hq-subscribed-power">{(site as any).subscribedPowerKw} kW</p>
                    </div>
                  )}
                  {(site as any).maxDemandKw && (
                    <div>
                      <p className="text-xs text-muted-foreground">{language === "fr" ? "Puissance maximale" : "Max Demand"}</p>
                      <p className="text-sm" data-testid="text-hq-max-demand">{(site as any).maxDemandKw} kW</p>
                    </div>
                  )}
                  {(site as any).serviceAddress && (
                    <div className="col-span-2 md:col-span-3">
                      <p className="text-xs text-muted-foreground">{language === "fr" ? "Adresse de service" : "Service Address"}</p>
                      <p className="text-sm" data-testid="text-hq-service-address">{(site as any).serviceAddress}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
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
              <AnalysisResults
                simulation={getFullSimulation(latestSimulation.id) || latestSimulation}
                site={site}
                isStaff={isStaff}
                onNavigateToDesignAgreement={() => setActiveTab("design-agreement")}
                isLoadingFullData={loadingFullSimulation === latestSimulation.id || !isFullDataLoaded(latestSimulation.id)}
                optimizationTarget={optimizationTarget}
                onOptimizationTargetChange={setOptimizationTarget}
                onOpenRoofDrawing={() => setIsRoofDrawingModalOpen(true)}
                onCompareScenarios={(site.simulationRuns?.length ?? 0) > 1 ? () => setActiveTab("compare") : undefined}
                onGeometryUpdate={(data) => setGeometryCapacity(data)}
                onVisualizationCaptureReady={(captureFunc) => { visualizationCaptureRef.current = captureFunc; }}
              />
              {isStaff && latestSimulation && (
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="gap-2 w-full justify-between" data-testid="button-toggle-benchmark">
                      <div className="flex items-center gap-2">
                        <Scale className="w-4 h-4" />
                        {language === "fr" ? "Benchmark / Calibration" : "Benchmark / Calibration"}
                      </div>
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4">
                    <BenchmarkTab siteId={site.id} simulationRuns={site.simulationRuns || []} />
                  </CollapsibleContent>
                </Collapsible>
              )}
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
                        ? "Deux prérequis sont nécessaires pour lancer l'analyse :"
                        : "Two prerequisites are needed to run the analysis:")}
                </p>
                {isStaff && (
                  <div className="space-y-4">
                    <div className="flex flex-col items-center gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        {site.roofAreaValidated ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <Grid3X3 className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span className={site.roofAreaValidated ? "text-green-600" : "text-muted-foreground"}>
                          {language === "fr" ? "Zones de toiture dessinées" : "Roof areas drawn"}
                        </span>
                        {!site.roofAreaValidated && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto p-0 text-primary underline"
                            onClick={() => setActiveTab("quick-analysis")}
                            data-testid="link-draw-roof-from-step3"
                          >
                            {language === "fr" ? "(dessiner)" : "(draw)"}
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {(site.meterFiles?.length ?? 0) > 0 ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span className={(site.meterFiles?.length ?? 0) > 0 ? "text-green-600" : "text-muted-foreground"}>
                          {language === "fr" ? "Données de consommation importées" : "Consumption data imported"}
                        </span>
                        {!(site.meterFiles?.length ?? 0) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto p-0 text-primary underline"
                            onClick={() => setActiveTab("consumption")}
                            data-testid="link-import-data-from-step3"
                          >
                            {language === "fr" ? "(importer)" : "(import)"}
                          </Button>
                        )}
                      </div>
                    </div>
                    <Button
                      onClick={() => runAnalysisMutation.mutate(customAssumptions)}
                      disabled={!site.meterFiles?.length || runAnalysisMutation.isPending || !site.roofAreaValidated}
                      className="gap-2"
                      data-testid="button-run-analysis-step3"
                    >
                      <Play className="w-4 h-4" />
                      {t("site.runAnalysis")}
                    </Button>
                  </div>
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
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      {language === "fr" ? "Schéma unifilaire (SLD)" : "Single Line Diagram (SLD)"}
                    </CardTitle>
                    <CardDescription>
                      {language === "fr"
                        ? "Généré automatiquement à partir du layout modulaire"
                        : "Auto-generated from the modular array layout"}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={sldInverterType} onValueChange={(v: "string" | "micro") => setSldInverterType(v)}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="string">
                          {language === "fr" ? "Onduleur string (centralisé)" : "String inverter (central)"}
                        </SelectItem>
                        <SelectItem value="micro">
                          {language === "fr" ? "Micro-onduleurs" : "Microinverters"}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const container = document.querySelector('.sld-diagram-container');
                        if (!container) return;
                        const svgEl = container.querySelector('svg');
                        if (!svgEl) return;
                        const serializer = new XMLSerializer();
                        const svgStr = serializer.serializeToString(svgEl);
                        const blob = new Blob([svgStr], { type: 'image/svg+xml' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `SLD_${site?.address?.replace(/[^a-zA-Z0-9]/g, '_') || 'system'}.svg`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      SVG
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const container = document.querySelector('.sld-diagram-container');
                        if (!container) return;
                        const svgEl = container.querySelector('svg');
                        if (!svgEl) return;

                        const serializer = new XMLSerializer();
                        const svgStr = serializer.serializeToString(svgEl);
                        const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
                        const svgUrl = URL.createObjectURL(svgBlob);

                        const img = new Image();
                        img.onload = () => {
                          const canvas = document.createElement('canvas');
                          const scale = 2;
                          canvas.width = img.naturalWidth * scale;
                          canvas.height = img.naturalHeight * scale;
                          const ctx = canvas.getContext('2d');
                          if (!ctx) return;
                          ctx.fillStyle = 'white';
                          ctx.fillRect(0, 0, canvas.width, canvas.height);
                          ctx.scale(scale, scale);
                          ctx.drawImage(img, 0, 0);

                          canvas.toBlob((blob) => {
                            if (!blob) return;
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `SLD_${site?.address?.replace(/[^a-zA-Z0-9]/g, '_') || 'system'}.png`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }, 'image/png');
                          URL.revokeObjectURL(svgUrl);
                        };
                        img.src = svgUrl;
                      }}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      PNG
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {geometryCapacity && geometryCapacity.maxCapacityKW > 0 ? (
                  <SLDDiagram
                    arrays={geometryCapacity.arrays && geometryCapacity.arrays.length > 0
                      ? geometryCapacity.arrays
                      : [{
                          id: 1,
                          panelCount: geometryCapacity.panelCount,
                          rows: Math.ceil(Math.sqrt(geometryCapacity.panelCount)),
                          columns: Math.ceil(geometryCapacity.panelCount / Math.ceil(Math.sqrt(geometryCapacity.panelCount))),
                          capacityKW: geometryCapacity.maxCapacityKW,
                          polygonId: "fallback",
                        }]
                    }
                    config={{
                      inverterType: sldInverterType,
                      siteName: site?.name || site?.client?.name || "",
                      siteAddress: site?.address || "",
                      systemCapacityKW: geometryCapacity.maxCapacityKW,
                      totalPanels: geometryCapacity.panelCount,
                      serviceVoltage: sldInverterType === "string" ? 600 : 240,
                      serviceAmperage: sldInverterType === "string" ? 400 : 200,
                      mainBreakerA: sldInverterType === "string" ? 200 : 200,
                    }}
                    language={language as "fr" | "en"}
                  />
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <PenTool className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>
                      {language === "fr"
                        ? "Configurez d'abord le système PV dans l'onglet Analyse pour générer le SLD."
                        : "Configure the PV system in the Analysis tab first to generate the SLD."}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isStaff && (
          <TabsContent value="design-agreement" className="space-y-6">
            <DesignAgreementSection siteId={site.id} />
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

        {isStaff && (
          <TabsContent value="epc-proposal" className="space-y-6">
            <Card>
              <CardContent className="py-16 text-center">
                <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-1">
                  {language === "fr" ? "Proposition EPC" : "EPC Proposal"}
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {language === "fr"
                    ? "La gestion des propositions EPC sera disponible prochainement."
                    : "EPC proposal management will be available soon."}
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isStaff && (
          <TabsContent value="plans-specs" className="space-y-6">
            <Card>
              <CardContent className="py-16 text-center">
                <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-1">
                  {language === "fr" ? "Plans & devis" : "Plans & Specs"}
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {language === "fr"
                    ? "La gestion des plans et devis sera disponible prochainement."
                    : "Plans & specs management will be available soon."}
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isStaff && (
          <TabsContent value="permits" className="space-y-6">
            <Card>
              <CardContent className="py-16 text-center">
                <FileSignature className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-1">
                  {language === "fr" ? "Permis et installation" : "Permits & Installation"}
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {language === "fr"
                    ? "La gestion des permis et de l'installation sera disponible prochainement."
                    : "Permit and installation management will be available soon."}
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isStaff && (
          <TabsContent value="operations" className="space-y-6">
            <OperationsTab
              siteId={id!}
              site={site}
              latestSimulation={latestSimulation}
              language={language}
            />
          </TabsContent>
        )}
      </Tabs>
      )}

      {/* Bifacial always enabled — dialog removed */}

      {isPortalAccessDialogOpen && site?.client && (
        <GrantPortalAccessDialog
          client={{ ...site.client, sites: [], siteCount: 0 } as any}
          open={isPortalAccessDialogOpen}
          onOpenChange={setIsPortalAccessDialogOpen}
        />
      )}

      <Dialog open={isHqProcurationDialogOpen} onOpenChange={setIsHqProcurationDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSignature className="w-5 h-5 text-primary" />
              {language === "fr" ? "Envoyer procuration HQ" : "Send HQ Procuration"}
            </DialogTitle>
            <DialogDescription>
              {language === "fr"
                ? `Envoyer un courriel au client de ce site avec un lien vers le formulaire de procuration Hydro-Québec.`
                : `Send an email to this site's client with a link to the Hydro-Québec authorization form.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {language === "fr" ? "Site" : "Site"}
              </label>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm" data-testid="text-procuration-site-name">{site?.name}</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {language === "fr" ? "Adresse courriel du client" : "Client email address"}
              </label>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm" data-testid="text-procuration-client-email">{site?.client?.email || (language === "fr" ? "Aucun courriel" : "No email")}</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {language === "fr" ? "Langue du courriel" : "Email language"}
              </label>
              <RadioGroup
                value={procurationLanguage}
                onValueChange={(val) => setProcurationLanguage(val as "fr" | "en")}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="fr" id="site-lang-fr" data-testid="radio-site-procuration-language-fr" />
                  <label htmlFor="site-lang-fr" className="text-sm cursor-pointer">Français</label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="en" id="site-lang-en" data-testid="radio-site-procuration-language-en" />
                  <label htmlFor="site-lang-en" className="text-sm cursor-pointer">English</label>
                </div>
              </RadioGroup>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setIsHqProcurationDialogOpen(false)} data-testid="button-cancel-site-procuration">
              {language === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button
              onClick={() => sendSiteProcurationMutation.mutate({ lang: procurationLanguage })}
              disabled={sendSiteProcurationMutation.isPending || !site?.client?.email}
              className="gap-2"
              data-testid="button-send-site-procuration"
            >
              {sendSiteProcurationMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {language === "fr" ? "Envoi en cours..." : "Sending..."}
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {language === "fr" ? "Envoyer" : "Send"}
                </>
              )}
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
