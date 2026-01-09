import React, { useState, useCallback, useEffect, Fragment, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useDropzone } from "react-dropzone";
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
  Battery,
  BarChart3,
  DollarSign,
  Leaf,
  TrendingUp,
  PenTool,
  Loader2,
  Settings,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Circle,
  CircleCheck,
  CircleDot,
  Home,
  Calculator,
  Percent,
  Info,
  Satellite,
  RefreshCw,
  AlertTriangle,
  Sun,
  Layers,
  Shield,
  Car,
  TrendingDown,
  Award,
  Sparkles,
  Copy,
  CreditCard,
  Wallet,
  FileCheck,
  Check,
  MousePointerClick,
  Plus,
  FileSignature,
  TreePine,
  Phone,
  ArrowRight,
  XCircle,
  Scale,
  Star,
  Grid3X3,
  Pencil,
  Mail,
  Presentation
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  ComposedChart,
  Line,
  ReferenceLine,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
  LineChart
} from "recharts";
import type { 
  CashflowEntry, 
  FinancialBreakdown, 
  AnalysisAssumptions,
  SensitivityAnalysis,
  FrontierPoint,
  SolarSweepPoint,
  BatterySweepPoint,
  HourlyProfileEntry,
  OptimalScenario,
  OptimalScenarios
} from "@shared/schema";
import { defaultAnalysisAssumptions } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoadProfileEditor, SingleBillEstimator, KPIDashboard } from "@/components/consumption-tools";
import { SiteVisitSection } from "@/components/site-visit-section";
import { DesignAgreementSection } from "@/components/design-agreement-section";
import { ActivityFeed } from "@/components/activity-feed";
import { MonteCarloAnalysis } from "@/components/monte-carlo-analysis";
import { SolarMockup } from "@/components/SolarMockup";
import { RoofDrawingModal } from "@/components/RoofDrawingModal";
import { RoofVisualization } from "@/components/RoofVisualization";
import type { Site, Client, MeterFile, SimulationRun, RoofPolygon, InsertRoofPolygon } from "@shared/schema";

interface SiteWithDetails extends Site {
  client: Client;
  meterFiles: MeterFile[];
  simulationRuns: SimulationRun[];
}

function MetricCard({ 
  title, 
  value, 
  unit, 
  icon: Icon,
  trend
}: { 
  title: string; 
  value: string | number; 
  unit?: string; 
  icon: React.ElementType;
  trend?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold font-mono">
              {value}
              {unit && <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
            </p>
            {trend && (
              <p className="text-xs text-primary flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {trend}
              </p>
            )}
          </div>
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FileUploadZone({ siteId, onUploadComplete }: { siteId: string; onUploadComplete: () => void }) {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const { token } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<"uploading" | "processing" | "done">("uploading");
  const [fileCount, setFileCount] = useState(0);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    setUploading(true);
    setProgress(0);
    setUploadPhase("uploading");
    setFileCount(acceptedFiles.length);

    const formData = new FormData();
    acceptedFiles.forEach((file) => {
      formData.append("files", file);
    });

    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            setProgress(percentComplete);
            if (percentComplete >= 100) {
              setUploadPhase("processing");
            }
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadPhase("done");
            resolve();
          } else {
            reject(new Error("Upload failed"));
          }
        });

        xhr.addEventListener("error", () => {
          reject(new Error("Upload failed"));
        });

        xhr.open("POST", `/api/sites/${siteId}/upload-meters`);
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.send(formData);
      });

      setProgress(100);
      toast({ 
        title: language === "fr" 
          ? `${acceptedFiles.length} fichier(s) téléversé(s) avec succès` 
          : `${acceptedFiles.length} file(s) uploaded successfully`
      });
      onUploadComplete();
    } catch (error) {
      toast({ 
        title: language === "fr" ? "Erreur lors du téléversement" : "Upload error", 
        variant: "destructive" 
      });
    } finally {
      setUploading(false);
      setProgress(0);
      setUploadPhase("uploading");
    }
  }, [siteId, token, toast, onUploadComplete, language]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
    },
    disabled: uploading,
  });

  const getPhaseText = () => {
    if (uploadPhase === "uploading") {
      return language === "fr" 
        ? `Téléversement de ${fileCount} fichier(s)... ${progress}%`
        : `Uploading ${fileCount} file(s)... ${progress}%`;
    }
    if (uploadPhase === "processing") {
      return language === "fr"
        ? "Traitement des fichiers CSV..."
        : "Processing CSV files...";
    }
    return language === "fr" ? "Terminé!" : "Done!";
  };

  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
        ${isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}
        ${uploading ? "pointer-events-none" : ""}
      `}
      data-testid="dropzone-upload"
    >
      <input {...getInputProps()} />
      <div className="space-y-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto ${uploading ? "bg-primary/10" : "bg-muted"}`}>
          {uploading ? (
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            <Upload className="w-6 h-6 text-muted-foreground" />
          )}
        </div>
        <div>
          {uploading ? (
            <>
              <p className="font-medium text-primary">{getPhaseText()}</p>
              <div className="mt-3 max-w-xs mx-auto space-y-2">
                <Progress value={uploadPhase === "processing" ? 100 : progress} className="h-2" />
                {uploadPhase === "processing" && (
                  <p className="text-xs text-muted-foreground">
                    {language === "fr" 
                      ? "Analyse des données de consommation..." 
                      : "Analyzing consumption data..."}
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="font-medium">{t("site.dropzone")}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("site.fileType")}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {language === "fr" 
                  ? "Jusqu'à 200 fichiers simultanément" 
                  : "Up to 200 files at once"}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FileStatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  
  switch (status) {
    case "PARSED":
      return (
        <Badge variant="default" className="gap-1">
          <CheckCircle2 className="w-3 h-3" />
          {t("status.parsed")}
        </Badge>
      );
    case "FAILED":
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="w-3 h-3" />
          {t("status.failed")}
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="w-3 h-3" />
          {t("status.uploaded")}
        </Badge>
      );
  }
}

// Structural constraints interface matching JSONB schema
interface StructuralConstraints {
  maxPvLoadKpa?: number;
  roofChangeRequired?: boolean;
  engineeringReportRef?: string;
  zones?: Array<{
    name: string;
    maxLoadKpa: number;
    areaM2?: number;
    notes?: string;
  }>;
}

// Structural Constraints Editor Component
function StructuralConstraintsEditor({
  site,
  onUpdate
}: {
  site: Site;
  onUpdate: () => void;
}) {
  const { language } = useI18n();
  const { token } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Parse existing constraints from site
  const existingConstraints = (site.structuralConstraints as StructuralConstraints | null) || {};
  
  // Local state for form fields
  const [notes, setNotes] = useState(site.structuralNotes || "");
  const [maxPvLoadKpa, setMaxPvLoadKpa] = useState(existingConstraints.maxPvLoadKpa?.toString() || "");
  const [roofChangeRequired, setRoofChangeRequired] = useState(existingConstraints.roofChangeRequired || false);
  const [engineeringReportRef, setEngineeringReportRef] = useState(existingConstraints.engineeringReportRef || "");
  
  // Check if there are any constraints to display
  const hasConstraints = site.structuralNotes || Object.keys(existingConstraints).length > 0;
  
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const constraints: StructuralConstraints = {
        ...existingConstraints,
        maxPvLoadKpa: maxPvLoadKpa ? parseFloat(maxPvLoadKpa) : undefined,
        roofChangeRequired,
        engineeringReportRef: engineeringReportRef || undefined,
      };
      
      // Remove undefined values
      Object.keys(constraints).forEach(key => {
        if (constraints[key as keyof StructuralConstraints] === undefined) {
          delete constraints[key as keyof StructuralConstraints];
        }
      });
      
      const response = await fetch(`/api/sites/${site.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          structuralNotes: notes || null,
          structuralConstraints: Object.keys(constraints).length > 0 ? constraints : null,
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to save");
      }
      
      toast({
        title: language === "fr" ? "Contraintes sauvegardées" : "Constraints saved",
        description: language === "fr" 
          ? "Les contraintes structurales ont été mises à jour" 
          : "Structural constraints have been updated",
      });
      
      onUpdate();
    } catch (error) {
      toast({
        title: language === "fr" ? "Erreur" : "Error",
        description: language === "fr" 
          ? "Impossible de sauvegarder les contraintes" 
          : "Failed to save constraints",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <Card className={hasConstraints ? "border-amber-500/50 bg-amber-50/30 dark:bg-amber-950/20" : ""}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover-elevate rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className={`w-5 h-5 ${hasConstraints ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`} />
                <CardTitle className="text-lg">
                  {language === "fr" ? "Contraintes structurales" : "Structural Constraints"}
                </CardTitle>
                {hasConstraints && (
                  <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
                    {language === "fr" ? "Données présentes" : "Data present"}
                  </Badge>
                )}
              </div>
              {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
            {!isOpen && hasConstraints && (
              <CardDescription className="mt-1">
                {existingConstraints.maxPvLoadKpa && (
                  <span className="mr-3">
                    {language === "fr" ? "Charge max:" : "Max load:"} {existingConstraints.maxPvLoadKpa} kPa
                  </span>
                )}
                {existingConstraints.roofChangeRequired && (
                  <Badge variant="destructive" className="mr-2 text-xs">
                    {language === "fr" ? "Réfection requise" : "Roof replacement required"}
                  </Badge>
                )}
              </CardDescription>
            )}
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* Engineering Report Reference */}
            <div className="space-y-2">
              <Label htmlFor="engineering-report">
                {language === "fr" ? "Référence du rapport d'ingénierie" : "Engineering Report Reference"}
              </Label>
              <Input
                id="engineering-report"
                placeholder={language === "fr" ? "Ex: MON.142502.0001" : "e.g., MON.142502.0001"}
                value={engineeringReportRef}
                onChange={(e) => setEngineeringReportRef(e.target.value)}
                data-testid="input-engineering-report"
              />
            </div>
            
            {/* Max PV Load */}
            <div className="space-y-2">
              <Label htmlFor="max-pv-load">
                {language === "fr" ? "Charge max PV admissible (kPa)" : "Max Allowable PV Load (kPa)"}
              </Label>
              <Input
                id="max-pv-load"
                type="number"
                step="0.01"
                placeholder={language === "fr" ? "Ex: 0.60" : "e.g., 0.60"}
                value={maxPvLoadKpa}
                onChange={(e) => setMaxPvLoadKpa(e.target.value)}
                data-testid="input-max-pv-load"
              />
              <p className="text-xs text-muted-foreground">
                {language === "fr" 
                  ? "Charge additionnelle que le toit peut supporter pour l'installation PV" 
                  : "Additional load the roof can support for PV installation"}
              </p>
            </div>
            
            {/* Roof Change Required Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-background">
              <div>
                <Label htmlFor="roof-change" className="font-medium">
                  {language === "fr" ? "Réfection de toiture requise" : "Roof Replacement Required"}
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {language === "fr" 
                    ? "Le toit doit être refait avant l'installation solaire" 
                    : "Roof must be replaced before solar installation"}
                </p>
              </div>
              <Switch
                id="roof-change"
                checked={roofChangeRequired}
                onCheckedChange={setRoofChangeRequired}
                data-testid="switch-roof-change"
              />
            </div>
            
            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="structural-notes">
                {language === "fr" ? "Notes de l'ingénieur" : "Engineer's Notes"}
              </Label>
              <Textarea
                id="structural-notes"
                placeholder={language === "fr" 
                  ? "Notes sur la structure du bâtiment, les zones, les restrictions..." 
                  : "Notes about building structure, zones, restrictions..."}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                data-testid="textarea-structural-notes"
              />
            </div>
            
            {/* Zones (read-only display if present) */}
            {existingConstraints.zones && existingConstraints.zones.length > 0 && (
              <div className="space-y-2">
                <Label>{language === "fr" ? "Zones de toiture" : "Roof Zones"}</Label>
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{language === "fr" ? "Zone" : "Zone"}</TableHead>
                        <TableHead>{language === "fr" ? "Charge max (kPa)" : "Max Load (kPa)"}</TableHead>
                        <TableHead>{language === "fr" ? "Superficie (m²)" : "Area (m²)"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {existingConstraints.zones.map((zone, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{zone.name}</TableCell>
                          <TableCell>{zone.maxLoadKpa}</TableCell>
                          <TableCell>{zone.areaM2 || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
            
            {/* Save Button */}
            <div className="flex justify-end pt-2">
              <Button 
                onClick={handleSave} 
                disabled={isSaving}
                data-testid="button-save-constraints"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {language === "fr" ? "Sauvegarde..." : "Saving..."}
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    {language === "fr" ? "Sauvegarder" : "Save"}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// HQ Tariff rates (April 2025) - Weighted average rates for simplified analysis
// Source: Hydro-Québec official rate schedule April 1, 2025
function getTariffRates(code: string): { energyRate: number; demandRate: number } {
  switch (code) {
    case "D":
      // Domestic: 46.154¢/day access + 6.905¢/kWh first 40kWh/day + 10.652¢/kWh rest
      // Using tier 1 rate as most residential consumption is in this tier
      return { energyRate: 0.06905, demandRate: 0 }; 
    case "G":
      // Small Power (<65kW): $14.86/mo access + $21.261/kW above 50kW
      // Energy: 11.933¢/kWh first 15,090 kWh/mo + 9.184¢/kWh rest
      // Using tier 1 rate and demand only above 50kW threshold
      return { energyRate: 0.11933, demandRate: 21.261 };
    case "M":
      // Medium Power (65kW-5MW): $17.573/kW (all power billed)
      // Energy: 6.061¢/kWh first 210,000 kWh/mo + 4.495¢/kWh rest
      return { energyRate: 0.06061, demandRate: 17.573 };
    case "L":
      // Large Power (>5MW): $14.476/kW + 3.681¢/kWh flat rate
      return { energyRate: 0.03681, demandRate: 14.476 };
    default:
      return { energyRate: 0.06061, demandRate: 17.573 }; // Default to M
  }
}

function AnalysisParametersEditor({ 
  value, 
  onChange,
  disabled = false,
  site,
  onSiteRefresh,
  showOnlyRoofSection = false,
  onOpenRoofDrawing,
  roofPolygons = []
}: { 
  value: Partial<AnalysisAssumptions>; 
  onChange: (value: Partial<AnalysisAssumptions>) => void;
  disabled?: boolean;
  site?: Site;
  onSiteRefresh?: () => void;
  showOnlyRoofSection?: boolean;
  onOpenRoofDrawing?: () => void;
  roofPolygons?: RoofPolygon[];
}) {
  const { language } = useI18n();
  const { token } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetButton, setShowResetButton] = useState(false);
  
  // Stale detection using server-provided timestamp:
  // - Use roofEstimatePendingAt from server to calculate real elapsed time
  // - Show reset after 15s from when server started pending
  useEffect(() => {
    // If not pending or actively estimating, hide reset button
    if (site?.roofEstimateStatus !== "pending" || isEstimating) {
      setShowResetButton(false);
      return;
    }
    
    // Pending status exists and we're not actively estimating
    // Use server timestamp if available, otherwise show reset immediately (stale from before timestamp was added)
    const pendingAt = site.roofEstimatePendingAt ? new Date(site.roofEstimatePendingAt).getTime() : null;
    
    if (!pendingAt) {
      // No timestamp = legacy stale status, show reset immediately
      setShowResetButton(true);
      return;
    }
    
    // Calculate remaining time until reset button should show (15s grace period)
    const elapsed = Date.now() - pendingAt;
    const remaining = Math.max(0, 15000 - elapsed);
    
    if (remaining === 0) {
      // Already past 15 seconds, show immediately
      setShowResetButton(true);
    } else {
      // Wait for remaining time
      const timer = setTimeout(() => {
        setShowResetButton(true);
      }, remaining);
      return () => clearTimeout(timer);
    }
  }, [site?.roofEstimateStatus, site?.roofEstimatePendingAt, isEstimating]);

  // Reset stale pending status
  const handleResetStatus = async () => {
    if (!site || !token || isResetting) return;
    setIsResetting(true);
    try {
      const response = await fetch(`/api/sites/${site.id}/reset-roof-status`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      if (response.ok) {
        setShowResetButton(false);
        onSiteRefresh?.();
        toast({
          title: language === "fr" ? "Statut réinitialisé" : "Status reset",
          description: language === "fr" 
            ? "Vous pouvez maintenant relancer l'estimation" 
            : "You can now retry the estimation",
        });
      } else {
        toast({
          variant: "destructive",
          title: language === "fr" ? "Erreur" : "Error",
          description: language === "fr" 
            ? "Impossible de réinitialiser le statut" 
            : "Could not reset status",
        });
      }
    } catch (error) {
      console.error("Failed to reset status:", error);
      toast({
        variant: "destructive",
        title: language === "fr" ? "Erreur" : "Error",
        description: language === "fr" 
          ? "Impossible de réinitialiser le statut" 
          : "Could not reset status",
      });
    } finally {
      setIsResetting(false);
    }
  };

  const merged: AnalysisAssumptions = { ...defaultAnalysisAssumptions, ...value };

  // Roof estimation mutation with 20-second timeout
  const handleRoofEstimate = async () => {
    if (!site || !token) return;
    
    setIsEstimating(true);
    setShowResetButton(false); // Hide reset button when starting new estimation
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    
    try {
      const response = await fetch(`/api/sites/${site.id}/roof-estimate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Estimation failed");
      }
      
      // Apply the estimated value to analysis parameters (convert m² to sq ft)
      if (data.roofEstimate?.roofAreaSqFt) {
        onChange({ ...value, roofAreaSqFt: Math.round(data.roofEstimate.roofAreaSqFt) });
      }
      
      toast({
        title: language === "fr" ? "Estimation réussie" : "Estimation successful",
        description: language === "fr" 
          ? `Surface estimée: ${Math.round(data.roofEstimate.roofAreaSqM)} m² (${Math.round(data.roofEstimate.roofAreaSqFt)} pi²)`
          : `Estimated area: ${Math.round(data.roofEstimate.roofAreaSqM)} m² (${Math.round(data.roofEstimate.roofAreaSqFt)} sq ft)`,
      });
      
      onSiteRefresh?.();
    } catch (error) {
      clearTimeout(timeoutId);
      const isTimeout = error instanceof Error && error.name === 'AbortError';
      toast({
        variant: "destructive",
        title: language === "fr" ? "Erreur d'estimation" : "Estimation error",
        description: isTimeout 
          ? (language === "fr" 
              ? "Délai dépassé. Veuillez entrer la surface manuellement." 
              : "Request timed out. Please enter the area manually.")
          : (error instanceof Error ? error.message : "Unknown error"),
      });
    } finally {
      setIsEstimating(false);
    }
  };

  const updateField = (field: keyof AnalysisAssumptions, newValue: number) => {
    onChange({ ...value, [field]: newValue });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-dashed">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover-elevate py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">
                  {language === "fr" ? "Paramètres d'analyse" : "Analysis Parameters"}
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {language === "fr" ? "Personnalisable" : "Customizable"}
                </Badge>
                {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-6">
            {/* Tariffs Section - hidden when only showing roof */}
            {!showOnlyRoofSection && (
            <>
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" />
                {language === "fr" ? "Tarifs Hydro-Québec (Avril 2025)" : "Hydro-Québec Tariffs (April 2025)"}
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">{language === "fr" ? "Code tarifaire" : "Tariff Code"}</Label>
                  <select
                    value={merged.tariffCode || "M"}
                    onChange={(e) => {
                      const code = e.target.value;
                      const rates = getTariffRates(code);
                      onChange({ 
                        ...value, 
                        tariffCode: code,
                        tariffEnergy: rates.energyRate,
                        tariffPower: rates.demandRate
                      });
                    }}
                    disabled={disabled}
                    className="h-8 w-full text-sm font-mono rounded-md border border-input bg-background px-3 py-1 focus:outline-none focus:ring-2 focus:ring-ring"
                    data-testid="select-tariff-code"
                  >
                    <option value="D">D - {language === "fr" ? "Domestique" : "Domestic"}</option>
                    <option value="G">G - {language === "fr" ? "Petite puissance (<65kW)" : "Small Power (<65kW)"}</option>
                    <option value="M">M - {language === "fr" ? "Moyenne puissance (65kW-5MW)" : "Medium Power (65kW-5MW)"}</option>
                    <option value="L">L - {language === "fr" ? "Grande puissance (>5MW)" : "Large Power (>5MW)"}</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{language === "fr" ? "Énergie ($/kWh)" : "Energy ($/kWh)"}</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={merged.tariffEnergy || ""}
                    onChange={(e) => updateField("tariffEnergy", parseFloat(e.target.value) || 0)}
                    disabled={disabled}
                    className="h-8 text-sm font-mono"
                    data-testid="input-energy-tariff"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{language === "fr" ? "Puissance ($/kW/mois)" : "Power ($/kW/month)"}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={merged.tariffPower || ""}
                    onChange={(e) => updateField("tariffPower", parseFloat(e.target.value) || 0)}
                    disabled={disabled}
                    className="h-8 text-sm font-mono"
                    data-testid="input-demand-tariff"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" />
                {language === "fr" 
                  ? "Les tarifs sont basés sur la grille HQ avril 2025. Vous pouvez les ajuster manuellement." 
                  : "Tariffs based on HQ April 2025 rates. You can adjust them manually."}
              </p>
            </div>

            {/* CAPEX Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                {language === "fr" ? "Coûts d'investissement (CAPEX)" : "Capital Costs (CAPEX)"}
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">{language === "fr" ? "Solaire ($/Wc)" : "Solar ($/Wp)"}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={merged.solarCostPerW || ""}
                    onChange={(e) => updateField("solarCostPerW", parseFloat(e.target.value) || 0)}
                    disabled={disabled}
                    className="h-8 text-sm font-mono"
                    data-testid="input-solar-cost"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{language === "fr" ? "Batt. énergie ($/kWh)" : "Batt. energy ($/kWh)"}</Label>
                  <Input
                    type="number"
                    step="1"
                    value={merged.batteryCapacityCost || ""}
                    onChange={(e) => updateField("batteryCapacityCost", parseFloat(e.target.value) || 0)}
                    disabled={disabled}
                    className="h-8 text-sm font-mono"
                    data-testid="input-battery-energy-cost"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{language === "fr" ? "Batt. puissance ($/kW)" : "Batt. power ($/kW)"}</Label>
                  <Input
                    type="number"
                    step="1"
                    value={merged.batteryPowerCost || ""}
                    onChange={(e) => updateField("batteryPowerCost", parseFloat(e.target.value) || 0)}
                    disabled={disabled}
                    className="h-8 text-sm font-mono"
                    data-testid="input-battery-power-cost"
                  />
                </div>
              </div>
            </div>

            {/* Solar Production Parameters */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Sun className="w-4 h-4 text-primary" />
                {language === "fr" ? "Production solaire" : "Solar Production"}
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">{language === "fr" ? "Rendement (kWh/kWc/an)" : "Yield (kWh/kWp/yr)"}</Label>
                  <Input
                    type="number"
                    step="10"
                    min="800"
                    max="1500"
                    value={merged.solarYieldKWhPerKWp || 1150}
                    onChange={(e) => updateField("solarYieldKWhPerKWp", parseInt(e.target.value) || 1150)}
                    disabled={disabled}
                    className="h-8 text-sm font-mono"
                    data-testid="input-solar-yield"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{language === "fr" ? "Facteur orientation/inclinaison" : "Orientation/Tilt Factor"}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.6"
                    max="1.0"
                    value={(merged.orientationFactor || 1.0).toFixed(2)}
                    onChange={(e) => updateField("orientationFactor", parseFloat(e.target.value) || 1.0)}
                    disabled={disabled}
                    className="h-8 text-sm font-mono"
                    data-testid="input-orientation-factor"
                  />
                </div>
              </div>
              {(() => {
                const baseYield = merged.solarYieldKWhPerKWp || 1150;
                const orientationFactor = merged.orientationFactor || 1.0;
                const bifacialBoost = merged.bifacialEnabled ? 1.15 : 1.0;
                const grossYield = Math.round(baseYield * orientationFactor * bifacialBoost);
                const bifacialLabel = merged.bifacialEnabled ? " (+15% bifacial)" : "";
                return (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      {language === "fr" 
                        ? `Rendement brut: ${grossYield} kWh/kWc/an${bifacialLabel}`
                        : `Gross yield: ${grossYield} kWh/kWp/yr${bifacialLabel}`}
                    </p>
                    <p className="text-xs text-muted-foreground/70 pl-4">
                      {language === "fr" 
                        ? "→ Rendement net après pertes système affiché dans les résultats d'analyse"
                        : "→ Net yield after system losses shown in analysis results"}
                    </p>
                  </div>
                );
              })()}
              
              {/* Advanced System Modeling (Helioscope-inspired) */}
              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-dashed">
                <div className="space-y-1.5">
                  <Label className="text-xs">{language === "fr" ? "Ratio DC/AC (ILR)" : "DC/AC Ratio (ILR)"}</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="1.0"
                    max="2.0"
                    value={(merged.inverterLoadRatio || 1.2).toFixed(1)}
                    onChange={(e) => updateField("inverterLoadRatio", parseFloat(e.target.value) || 1.2)}
                    disabled={disabled}
                    className="h-8 text-sm font-mono"
                    data-testid="input-ilr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{language === "fr" ? "Coeff. temp. (%/°C)" : "Temp. Coeff. (%/°C)"}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="-0.6"
                    max="0"
                    value={((merged.temperatureCoefficient || -0.004) * 100).toFixed(2)}
                    onChange={(e) => updateField("temperatureCoefficient", (parseFloat(e.target.value) || -0.4) / 100)}
                    disabled={disabled}
                    className="h-8 text-sm font-mono"
                    data-testid="input-temp-coeff"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{language === "fr" ? "Dégradation (%/an)" : "Degradation (%/yr)"}</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={((merged.degradationRatePercent || 0.005) * 100).toFixed(1)}
                    onChange={(e) => updateField("degradationRatePercent", (parseFloat(e.target.value) || 0.5) / 100)}
                    disabled={disabled}
                    className="h-8 text-sm font-mono"
                    data-testid="input-degradation"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" />
                {language === "fr" 
                  ? "Modélisation avancée: ILR typique 1.1-1.5, dégradation 0.5%/an"
                  : "Advanced modeling: Typical ILR 1.1-1.5, degradation 0.5%/yr"}
              </p>
              
              {/* Bifacial PV Section - Simplified */}
              <div className="pt-3 border-t border-dashed space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" />
                    {language === "fr" ? "Panneaux bifaciaux" : "Bifacial Panels"}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={merged.bifacialEnabled || false}
                      onCheckedChange={(checked) => onChange({ ...value, bifacialEnabled: checked })}
                      disabled={disabled}
                      data-testid="switch-bifacial-enabled"
                    />
                    <span className="text-xs text-muted-foreground">
                      {merged.bifacialEnabled 
                        ? (language === "fr" ? "Activé (+15%)" : "Enabled (+15%)")
                        : (language === "fr" ? "Désactivé" : "Disabled")}
                    </span>
                  </div>
                </div>
                
                {merged.bifacialEnabled && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    {language === "fr"
                      ? "Les panneaux bifaciaux captent la lumière des deux côtés. Gain estimé: +15% rendement (typique pour toits commerciaux)."
                      : "Bifacial panels capture light from both sides. Estimated gain: +15% yield (typical for commercial roofs)."}
                  </p>
                )}
              </div>
            </div>

            {/* Financial Assumptions Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Percent className="w-4 h-4 text-primary" />
                {language === "fr" ? "Hypothèses financières" : "Financial Assumptions"}
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">{language === "fr" ? "Taux d'actualisation (%)" : "Discount Rate (%)"}</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={(merged.discountRate * 100).toFixed(1)}
                    onChange={(e) => updateField("discountRate", (parseFloat(e.target.value) || 0) / 100)}
                    disabled={disabled}
                    className="h-8 text-sm font-mono"
                    data-testid="input-discount-rate"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{language === "fr" ? "Inflation tarif HQ (%)" : "HQ Tariff Inflation (%)"}</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={(merged.inflationRate * 100).toFixed(1)}
                    onChange={(e) => updateField("inflationRate", (parseFloat(e.target.value) || 0) / 100)}
                    disabled={disabled}
                    className="h-8 text-sm font-mono"
                    data-testid="input-inflation-rate"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{language === "fr" ? "Taux d'imposition (%)" : "Tax Rate (%)"}</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={(merged.taxRate * 100).toFixed(1)}
                    onChange={(e) => updateField("taxRate", (parseFloat(e.target.value) || 0) / 100)}
                    disabled={disabled}
                    className="h-8 text-sm font-mono"
                    data-testid="input-tax-rate"
                  />
                </div>
              </div>
            </div>

            {/* O&M Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Calculator className="w-4 h-4 text-primary" />
                {language === "fr" ? "Exploitation et maintenance (O&M)" : "Operations & Maintenance (O&M)"}
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">{language === "fr" ? "O&M Solaire (% CAPEX)" : "Solar O&M (% CAPEX)"}</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={(merged.omSolarPercent * 100).toFixed(1)}
                    onChange={(e) => updateField("omSolarPercent", (parseFloat(e.target.value) || 0) / 100)}
                    disabled={disabled}
                    className="h-8 text-sm font-mono"
                    data-testid="input-om-solar"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{language === "fr" ? "O&M Batterie (% CAPEX)" : "Battery O&M (% CAPEX)"}</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={(merged.omBatteryPercent * 100).toFixed(1)}
                    onChange={(e) => updateField("omBatteryPercent", (parseFloat(e.target.value) || 0) / 100)}
                    disabled={disabled}
                    className="h-8 text-sm font-mono"
                    data-testid="input-om-battery"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{language === "fr" ? "Escalade O&M (%/an)" : "O&M Escalation (%/yr)"}</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={(merged.omEscalation * 100).toFixed(1)}
                    onChange={(e) => updateField("omEscalation", (parseFloat(e.target.value) || 0) / 100)}
                    disabled={disabled}
                    className="h-8 text-sm font-mono"
                    data-testid="input-om-escalation"
                  />
                </div>
              </div>
            </div>

            {/* Battery Replacement Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Battery className="w-4 h-4 text-primary" />
                {language === "fr" ? "Remplacement de batterie" : "Battery Replacement"}
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">{language === "fr" ? "Année de remplacement" : "Replacement Year"}</Label>
                  <Input
                    type="number"
                    step="1"
                    min="5"
                    max="20"
                    value={merged.batteryReplacementYear || 10}
                    onChange={(e) => updateField("batteryReplacementYear", parseInt(e.target.value) || 10)}
                    disabled={disabled}
                    className="h-8 text-sm font-mono"
                    data-testid="input-battery-replacement-year"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{language === "fr" ? "Coût rempl. (% original)" : "Repl. Cost (% original)"}</Label>
                  <Input
                    type="number"
                    step="5"
                    min="20"
                    max="100"
                    value={((merged.batteryReplacementCostFactor || 0.6) * 100).toFixed(0)}
                    onChange={(e) => updateField("batteryReplacementCostFactor", (parseFloat(e.target.value) || 60) / 100)}
                    disabled={disabled}
                    className="h-8 text-sm font-mono"
                    data-testid="input-battery-replacement-cost"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{language === "fr" ? "Baisse prix batt. (%/an)" : "Batt. price decline (%/yr)"}</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    max="15"
                    value={((merged.batteryPriceDeclineRate || 0.05) * 100).toFixed(1)}
                    onChange={(e) => updateField("batteryPriceDeclineRate", (parseFloat(e.target.value) || 5) / 100)}
                    disabled={disabled}
                    className="h-8 text-sm font-mono"
                    data-testid="input-battery-price-decline"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" />
                {language === "fr" 
                  ? `Coût estimé an ${merged.batteryReplacementYear || 10}: ${((merged.batteryReplacementCostFactor || 0.6) * Math.pow(1 + (merged.inflationRate || 0.025) - (merged.batteryPriceDeclineRate || 0.05), merged.batteryReplacementYear || 10) * 100).toFixed(0)}% du coût original` 
                  : `Estimated cost year ${merged.batteryReplacementYear || 10}: ${((merged.batteryReplacementCostFactor || 0.6) * Math.pow(1 + (merged.inflationRate || 0.025) - (merged.batteryPriceDeclineRate || 0.05), merged.batteryReplacementYear || 10) * 100).toFixed(0)}% of original cost`}
              </p>
            </div>
            </>
            )}

            {/* Roof Constraints Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Home className="w-4 h-4 text-primary" />
                {language === "fr" ? "Contraintes de toiture" : "Roof Constraints"}
              </h4>
              
              {/* Satellite Roof View */}
              {site && site.latitude && site.longitude && site.roofAreaAutoSqM && import.meta.env.VITE_GOOGLE_MAPS_API_KEY && (
                <div className="rounded-lg overflow-hidden border">
                  <div className="relative">
                    <iframe
                      className="w-full h-48"
                      style={{ border: 0 }}
                      loading="lazy"
                      allowFullScreen
                      referrerPolicy="no-referrer-when-downgrade"
                      src={`https://www.google.com/maps/embed/v1/view?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&center=${site.latitude},${site.longitude}&zoom=20&maptype=satellite`}
                      title={language === "fr" ? "Vue satellite du toit" : "Satellite roof view"}
                    />
                    <div className="absolute bottom-2 left-2 bg-background/90 backdrop-blur-sm rounded-md px-2 py-1 text-xs font-medium flex items-center gap-1.5">
                      <Home className="w-3.5 h-3.5 text-primary" />
                      {Math.round(site.roofAreaAutoSqM)} m² ({Math.round(site.roofAreaAutoSqM * 10.764)} pi²)
                    </div>
                    <div className="absolute top-2 right-2 bg-background/90 backdrop-blur-sm rounded-md px-2 py-1 text-xs text-muted-foreground">
                      {language === "fr" ? "Vue satellite" : "Satellite view"}
                    </div>
                  </div>
                </div>
              )}

              {/* Satellite Estimation Status & Button */}
              {site && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    {site.roofEstimateStatus === "pending" && (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        <span className="text-xs text-muted-foreground">
                          {language === "fr" ? "Estimation satellite en cours..." : "Satellite estimation in progress..."}
                        </span>
                        {showResetButton && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleResetStatus}
                            disabled={isResetting}
                            className="h-6 text-xs ml-auto text-destructive hover:text-destructive"
                            data-testid="button-reset-roof-status"
                          >
                            {isResetting ? (
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            ) : (
                              <XCircle className="w-3 h-3 mr-1" />
                            )}
                            {language === "fr" ? "Réinitialiser" : "Reset"}
                          </Button>
                        )}
                      </>
                    )}
                    {site.roofEstimateStatus === "success" && site.roofAreaAutoSqM && (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span className="text-xs">
                          {language === "fr" 
                            ? `Estimation satellite: ${Math.round(site.roofAreaAutoSqM)} m² (${Math.round(site.roofAreaAutoSqM * 10.764)} pi²)`
                            : `Satellite estimate: ${Math.round(site.roofAreaAutoSqM)} m² (${Math.round(site.roofAreaAutoSqM * 10.764)} sq ft)`}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (site.roofAreaAutoSqM) {
                              updateField("roofAreaSqFt", Math.round(site.roofAreaAutoSqM * 10.764));
                            }
                          }}
                          className="h-6 text-xs ml-auto"
                          disabled={disabled}
                          data-testid="button-apply-satellite-estimate"
                        >
                          {language === "fr" ? "Appliquer" : "Apply"}
                        </Button>
                      </>
                    )}
                    {site.roofEstimateStatus === "failed" && (
                      <>
                        <AlertCircle className="w-4 h-4 text-destructive" />
                        <span className="text-xs text-destructive">
                          {language === "fr" ? "Estimation échouée" : "Estimation failed"}
                          {site.roofEstimateError && `: ${site.roofEstimateError}`}
                        </span>
                      </>
                    )}
                    {(!site.roofEstimateStatus || site.roofEstimateStatus === "none" || site.roofEstimateStatus === "skipped") && (
                      <span className="text-xs text-muted-foreground">
                        {language === "fr" ? "Aucune estimation satellite disponible" : "No satellite estimation available"}
                      </span>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRoofEstimate}
                      disabled={disabled || isEstimating || site.roofEstimateStatus === "pending"}
                      className="h-7 text-xs gap-1.5 ml-auto"
                      data-testid="button-estimate-roof-satellite"
                    >
                      {isEstimating ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : site.roofEstimateStatus === "success" ? (
                        <RefreshCw className="w-3 h-3" />
                      ) : (
                        <Satellite className="w-3 h-3" />
                      )}
                      {isEstimating 
                        ? (language === "fr" ? "Estimation..." : "Estimating...")
                        : site.roofEstimateStatus === "success"
                          ? (language === "fr" ? "Recalculer" : "Recalculate")
                          : (language === "fr" ? "Estimer via satellite" : "Estimate from satellite")}
                    </Button>
                  </div>
                  
                  {/* Roof Segments from Google Solar API */}
                  {site.roofEstimateStatus === "success" && site.roofAreaAutoDetails && (
                    ((): React.ReactNode => {
                      const details = site.roofAreaAutoDetails as any;
                      const segments = details?.solarPotential?.roofSegmentStats;
                      const maxSunshine = details?.solarPotential?.maxSunshineHoursPerYear;
                      const panelConfigs = details?.solarPotential?.solarPanelConfigs;
                      const bestConfig = panelConfigs?.[panelConfigs.length - 1];
                      const panelWatts = details?.solarPotential?.panelCapacityWatts || 400;
                      
                      // Detect if Google data is limited (< 10 panels means likely residential-focused or incomplete)
                      const hasLimitedGoogleData = !bestConfig || (bestConfig.panelsCount || 0) < 10;
                      
                      if (!segments || segments.length === 0) return null;
                      
                      return (
                        <div className="p-2 rounded-lg border border-dashed bg-muted/30 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Layers className="w-3.5 h-3.5 text-primary" />
                            <span className="text-xs font-medium">
                              {language === "fr" ? "Segments de toit détectés" : "Detected Roof Segments"}
                            </span>
                            <Badge variant="secondary" className="text-xs h-5">
                              {segments.length} {language === "fr" ? "segments" : "segments"}
                            </Badge>
                            {/* Fallback mode indicator for limited Google data */}
                            {hasLimitedGoogleData && (
                              <Badge variant="outline" className="text-xs h-5 gap-1 bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800">
                                <Grid3X3 className="w-3 h-3" />
                                {language === "fr" ? "Mode estimation" : "Estimation mode"}
                              </Badge>
                            )}
                          </div>
                          
                          {/* Segment summary table with solar quality */}
                          <div className="grid grid-cols-5 gap-1 text-xs">
                            <div className="font-medium text-muted-foreground">#</div>
                            <div className="font-medium text-muted-foreground">
                              {language === "fr" ? "Surface" : "Area"}
                            </div>
                            <div className="font-medium text-muted-foreground">
                              {language === "fr" ? "Orientation" : "Orientation"}
                            </div>
                            <div className="font-medium text-muted-foreground">
                              {language === "fr" ? "Incl." : "Pitch"}
                            </div>
                            <div className="font-medium text-muted-foreground">
                              {language === "fr" ? "Qualité" : "Quality"}
                            </div>
                            {segments.slice(0, 6).map((seg: any, idx: number) => {
                              const azimuth = seg.azimuthDegrees || 0;
                              const pitch = seg.pitchDegrees || 0;
                              const area = seg.stats?.areaMeters2 || 0;
                              
                              // Determine orientation label
                              let orientation = "?";
                              if (azimuth >= 337.5 || azimuth < 22.5) orientation = "N";
                              else if (azimuth >= 22.5 && azimuth < 67.5) orientation = "NE";
                              else if (azimuth >= 67.5 && azimuth < 112.5) orientation = "E";
                              else if (azimuth >= 112.5 && azimuth < 157.5) orientation = "SE";
                              else if (azimuth >= 157.5 && azimuth < 202.5) orientation = "S";
                              else if (azimuth >= 202.5 && azimuth < 247.5) orientation = "SW";
                              else if (azimuth >= 247.5 && azimuth < 292.5) orientation = "W";
                              else if (azimuth >= 292.5 && azimuth < 337.5) orientation = "NW";
                              
                              // Calculate solar quality score (0-100) based on orientation and pitch
                              // South-facing (180°) with 30-35° pitch is optimal for Quebec
                              const azimuthScore = Math.max(0, 100 - Math.abs(azimuth - 180) * 0.8);
                              const pitchScore = Math.max(0, 100 - Math.abs(pitch - 32) * 3);
                              const qualityScore = (azimuthScore * 0.6 + pitchScore * 0.4);
                              
                              // Get quality color
                              let qualityColor = "bg-red-500";
                              let qualityLabel = "⚠";
                              if (qualityScore >= 80) { qualityColor = "bg-green-500"; qualityLabel = "★★★"; }
                              else if (qualityScore >= 60) { qualityColor = "bg-amber-400"; qualityLabel = "★★"; }
                              else if (qualityScore >= 40) { qualityColor = "bg-orange-400"; qualityLabel = "★"; }
                              
                              return (
                                <Fragment key={idx}>
                                  <div className="font-mono">{idx + 1}</div>
                                  <div className="font-mono">{Math.round(area)} m²</div>
                                  <div className="font-mono">{orientation}</div>
                                  <div className="font-mono">{Math.round(pitch)}°</div>
                                  <div className="flex items-center gap-1">
                                    <div 
                                      className={`w-2 h-2 rounded-full ${qualityColor}`} 
                                      title={`${Math.round(qualityScore)}% - ${orientation} @ ${Math.round(pitch)}°`}
                                    />
                                    <span className="text-[10px]">{qualityLabel}</span>
                                  </div>
                                </Fragment>
                              );
                            })}
                          </div>
                          {segments.length > 6 && (
                            <p className="text-xs text-muted-foreground">
                              {language === "fr" 
                                ? `+ ${segments.length - 6} autres segments...`
                                : `+ ${segments.length - 6} more segments...`}
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {language === "fr" 
                              ? "★★★ = Optimal (Sud, 30-35°) | ★★ = Bon | ★ = Acceptable"
                              : "★★★ = Optimal (South, 30-35°) | ★★ = Good | ★ = Acceptable"}
                          </p>
                          
                          {/* Google production estimate or fallback algorithmic estimate */}
                          {bestConfig && !hasLimitedGoogleData ? (
                            <div className="pt-2 border-t border-dashed">
                              <div className="flex items-center gap-2 mb-1">
                                <Sun className="w-3.5 h-3.5 text-amber-500" />
                                <span className="text-xs font-medium">
                                  {language === "fr" ? "Estimation Google Solar" : "Google Solar Estimate"}
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-xs">
                                <div>
                                  <span className="text-muted-foreground">{language === "fr" ? "Panneaux" : "Panels"}: </span>
                                  <span className="font-mono">{bestConfig.panelsCount}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">{language === "fr" ? "Puissance" : "Capacity"}: </span>
                                  <span className="font-mono">{((bestConfig.panelsCount * panelWatts) / 1000).toFixed(1)} kWc</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">{language === "fr" ? "Prod. annuelle" : "Annual prod."}: </span>
                                  <span className="font-mono">{Math.round(bestConfig.yearlyEnergyDcKwh * 0.85).toLocaleString()} kWh</span>
                                </div>
                              </div>
                              {maxSunshine && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {language === "fr" 
                                    ? `Ensoleillement: ${Math.round(maxSunshine).toLocaleString()} h/an`
                                    : `Sunshine: ${Math.round(maxSunshine).toLocaleString()} h/year`}
                                </p>
                              )}
                            </div>
                          ) : hasLimitedGoogleData && (
                            <div className="pt-2 border-t border-dashed">
                              <div className="flex items-center gap-2 mb-1">
                                <Grid3X3 className="w-3.5 h-3.5 text-teal-500" />
                                <span className="text-xs font-medium">
                                  {language === "fr" ? "Estimation algorithmique" : "Algorithmic Estimate"}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {language === "fr" 
                                  ? `Google Solar API n'a pas de données de panneaux détaillées pour ce bâtiment commercial. Utilisez les champs Surface de toit et Taux d'utilisation ci-dessous pour une estimation précise.`
                                  : `Google Solar API doesn't have detailed panel data for this commercial building. Use the Roof Area and Utilization Rate fields below for an accurate estimate.`}
                              </p>
                              {maxSunshine && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {language === "fr" 
                                    ? `Ensoleillement disponible: ${Math.round(maxSunshine).toLocaleString()} h/an`
                                    : `Available sunshine: ${Math.round(maxSunshine).toLocaleString()} h/year`}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()
                  )}
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs">{language === "fr" ? "Surface de toit (pi²)" : "Roof Area (sq ft)"}</Label>
                      {roofPolygons.length > 0 && (
                        <Badge variant="outline" className="text-[10px] h-4 gap-0.5">
                          <Pencil className="w-2.5 h-2.5" />
                          {roofPolygons.length} {language === "fr" ? "zones tracées" : "drawn areas"}
                        </Badge>
                      )}
                    </div>
                    {site?.roofAreaAutoSqM && site.roofEstimateStatus === "success" && (
                      <span className="text-[10px] text-muted-foreground">
                        {language === "fr" ? `Satellite: ${Math.round(site.roofAreaAutoSqM * 10.764).toLocaleString()} pi²` : `Satellite: ${Math.round(site.roofAreaAutoSqM * 10.764).toLocaleString()} sqft`}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onOpenRoofDrawing}
                      disabled={!site?.latitude || !site?.longitude || disabled}
                      className="gap-1 h-8"
                      data-testid="button-draw-roof"
                    >
                      <Pencil className="w-3 h-3" />
                      {language === "fr" ? "Tracer" : "Draw"}
                    </Button>
                    <Input
                      type="number"
                      step="100"
                      value={merged.roofAreaSqFt}
                      onChange={(e) => updateField("roofAreaSqFt", parseFloat(e.target.value) || 0)}
                      disabled={disabled}
                      className="h-8 text-sm font-mono flex-1"
                      data-testid="input-roof-area"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{language === "fr" ? "Taux d'utilisation (%)" : "Utilization Rate (%)"}</Label>
                  <Input
                    type="number"
                    step="1"
                    value={(merged.roofUtilizationRatio * 100).toFixed(0)}
                    onChange={(e) => updateField("roofUtilizationRatio", (parseFloat(e.target.value) || 0) / 100)}
                    disabled={disabled}
                    className="h-8 text-sm font-mono"
                    data-testid="input-roof-utilization"
                  />
                </div>
              </div>
              
              {/* Manual Override Guidance for Large C&I Buildings */}
              {merged.roofAreaSqFt > 5000 && (
                <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs">
                  <div className="flex items-start gap-2">
                    <Info className="w-3.5 h-3.5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-blue-800">
                      <span className="font-medium">
                        {language === "fr" ? "Grand bâtiment commercial ou industriel" : "Large C&I building"}
                      </span>
                      <p className="text-blue-700 mt-0.5">
                        {language === "fr" 
                          ? "Pour les grands bâtiments, entrez la superficie réelle de toiture. Google Solar API est optimisé pour les toitures résidentielles et peut sous-estimer les grands toits commerciaux."
                          : "For large buildings, enter actual roof area. Google Solar API is optimized for residential rooftops and may underestimate large commercial roofs."}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" />
                {language === "fr" 
                  ? `Capacité max PV estimée: ${Math.round((merged.roofAreaSqFt * merged.roofUtilizationRatio) / 100)} kWc` 
                  : `Estimated max PV capacity: ${Math.round((merged.roofAreaSqFt * merged.roofUtilizationRatio) / 100)} kWp`}
              </p>
            </div>

            {/* Reset Button */}
            <div className="flex justify-end pt-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => onChange({})}
                disabled={disabled}
                data-testid="button-reset-parameters"
              >
                {language === "fr" ? "Réinitialiser aux valeurs par défaut" : "Reset to defaults"}
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function DownloadReportButton({ 
  simulationId, 
  siteName, 
  clientName, 
  location,
  onSwitchToAnalysis
}: { 
  simulationId: string;
  siteName: string;
  clientName?: string;
  location?: string;
  onSwitchToAnalysis?: () => void;
}) {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const [downloadPhase, setDownloadPhase] = useState<"idle" | "preparing" | "generating">("idle");
  const [downloadType, setDownloadType] = useState<"full" | "executive">("full");

  const handleDownloadFull = async () => {
    setDownloading(true);
    setDownloadType("full");
    setDownloadPhase("preparing");
    try {
      // Switch to Analysis tab first so PDF sections are rendered
      if (onSwitchToAnalysis) {
        onSwitchToAnalysis();
        
        // Wait deterministically for the PDF sections to be rendered in the DOM
        const waitForElement = async (elementId: string, maxWaitMs = 3000): Promise<boolean> => {
          const startTime = Date.now();
          while (Date.now() - startTime < maxWaitMs) {
            if (document.getElementById(elementId)) {
              return true;
            }
            await new Promise(resolve => requestAnimationFrame(resolve));
          }
          return false;
        };
        
        // Wait for the main PDF section to exist
        const sectionReady = await waitForElement("pdf-section-system-config");
        if (!sectionReady) {
          throw new Error("PDF sections not ready");
        }
        
        // Small additional delay for images and charts to fully render
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      setDownloadPhase("generating");
      const { downloadClientPDF } = await import("@/lib/clientPdfGenerator");
      await downloadClientPDF(siteName, clientName, location, language);
      toast({ title: language === "fr" ? "Rapport téléchargé" : "Report downloaded" });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({ title: language === "fr" ? "Erreur lors du téléchargement" : "Download error", variant: "destructive" });
    } finally {
      setDownloading(false);
      setDownloadPhase("idle");
    }
  };

  const handleDownloadExecutive = async () => {
    setDownloading(true);
    setDownloadType("executive");
    setDownloadPhase("generating");
    try {
      // Download executive summary PDF from server
      const response = await fetch(`/api/simulation-runs/${simulationId}/executive-summary-pdf?lang=${language}`, {
        credentials: "include"
      });
      
      if (!response.ok) {
        throw new Error("Failed to generate executive summary");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `resume-executif-${siteName.replace(/\s+/g, '-')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({ title: language === "fr" ? "Résumé exécutif téléchargé" : "Executive summary downloaded" });
    } catch (error) {
      console.error("Executive summary PDF error:", error);
      toast({ title: language === "fr" ? "Erreur lors du téléchargement" : "Download error", variant: "destructive" });
    } finally {
      setDownloading(false);
      setDownloadPhase("idle");
    }
  };

  const handleDownloadPPTX = async () => {
    setDownloading(true);
    setDownloadType("full");
    setDownloadPhase("generating");
    try {
      const response = await fetch(`/api/simulation-runs/${simulationId}/presentation-pptx?lang=${language}`, {
        credentials: "include"
      });
      
      if (!response.ok) {
        throw new Error("Failed to generate presentation");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `proposition-${siteName.replace(/\s+/g, '-')}.pptx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({ title: language === "fr" ? "Présentation téléchargée" : "Presentation downloaded" });
    } catch (error) {
      console.error("PPTX generation error:", error);
      toast({ title: language === "fr" ? "Erreur lors du téléchargement" : "Download error", variant: "destructive" });
    } finally {
      setDownloading(false);
      setDownloadPhase("idle");
    }
  };

  if (downloading) {
    return (
      <Button 
        variant="outline" 
        className="gap-2 min-w-[160px]" 
        disabled 
        data-testid="button-download-report"
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        {downloadPhase === "preparing" 
          ? (language === "fr" ? "Préparation..." : "Preparing...")
          : (language === "fr" ? "Génération PDF..." : "Generating PDF...")
        }
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className="gap-2 min-w-[160px]" 
          data-testid="button-download-report"
        >
          <Download className="w-4 h-4" />
          {t("site.downloadReport")}
          <ChevronDown className="w-4 h-4 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem onClick={handleDownloadFull} data-testid="menu-item-full-report">
          <FileText className="w-4 h-4 mr-2" />
          {language === "fr" ? "Rapport PDF complet" : "Full PDF report"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownloadExecutive} data-testid="menu-item-executive-summary">
          <Mail className="w-4 h-4 mr-2" />
          {language === "fr" ? "Résumé exécutif (1 page)" : "Executive summary (1 page)"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownloadPPTX} data-testid="menu-item-presentation">
          <Presentation className="w-4 h-4 mr-2" />
          {language === "fr" ? "Présentation PowerPoint" : "PowerPoint presentation"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const MONTH_NAMES_FR = ['', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTH_NAMES_EN = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function ScenarioComparison({ 
  simulations, 
  site, 
  selectedSimulationId, 
  onSelectSimulation 
}: { 
  simulations: SimulationRun[]; 
  site: SiteWithDetails;
  selectedSimulationId?: string;
  onSelectSimulation?: (simulationId: string) => void;
}) {
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
    const colors = ["#f5a623", "#3b82f6", "#22c55e", "#a855f7", "#ec4899"];
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
    payback: { 
      labelFr: 'Retour le plus rapide', 
      labelEn: 'Fastest Payback',
      bgClass: 'bg-orange-500 border-orange-500',
      borderClass: 'border-orange-500 bg-orange-50/50 dark:bg-orange-950/20'
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
      metric: 'npv' | 'irr' | 'selfSufficiency' | 'payback',
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
      { key: 'payback', getValue: s => s.payback, higherBetter: false },
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
    const badgePriority: Array<keyof typeof badgeConfigs> = ['npv', 'irr', 'selfSufficiency', 'payback'];
    
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
        payback: optimalScenarios.fastPayback ? {
          pvSize: optimalScenarios.fastPayback.pvSizeKW,
          batterySize: optimalScenarios.fastPayback.battEnergyKWh,
          batteryPower: optimalScenarios.fastPayback.battPowerKW,
          label: language === "fr" ? "Retour rapide" : "Fast Payback",
          description: language === "fr"
            ? "Récupération de l'investissement la plus rapide"
            : "Fastest investment recovery",
          npv25: optimalScenarios.fastPayback.npv25,
          irr25: optimalScenarios.fastPayback.irr25,
          selfSufficiency: optimalScenarios.fastPayback.selfSufficiencyPercent,
          paybackYears: optimalScenarios.fastPayback.simplePaybackYears,
          capexNet: optimalScenarios.fastPayback.capexNet,
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
      payback: {
        pvSize: Math.round(refPV * 0.5),
        batterySize: 0,
        batteryPower: 0,
        label: language === "fr" ? "Retour rapide" : "Fast Payback",
        description: language === "fr"
          ? "Investissement minimal = récupération plus rapide"
          : "Minimal investment = faster break-even"
      }
    };
  }, [referenceSimulation, optimalScenarios, language]);
  
  // Handler for opening optimization dialog with preset
  const handleOptimizationClick = (presetType: 'irr' | 'selfSufficiency' | 'payback') => {
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
                    <TableHead className="text-right">PV (kW)</TableHead>
                    <TableHead className="text-right">{language === "fr" ? "Batterie" : "Battery"}</TableHead>
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
                  
                  {/* Fast Payback Row */}
                  {optimalScenarios.fastPayback && optimalScenarios.fastPayback.id !== optimalScenarios.bestNPV?.id && optimalScenarios.fastPayback.id !== optimalScenarios.bestIRR?.id && (
                    <TableRow className="hover-elevate" data-testid="row-strategy-payback">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-orange-600" />
                          <div>
                            <span className="font-medium text-orange-700 dark:text-orange-400">
                              {language === "fr" ? "Retour rapide" : "Fast Payback"}
                            </span>
                            <p className="text-xs text-muted-foreground">
                              {language === "fr" ? "ROI le plus rapide" : "Fastest ROI"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatNumber(optimalScenarios.fastPayback.pvSizeKW, 0)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {optimalScenarios.fastPayback.battEnergyKWh > 0 
                          ? `${formatNumber(optimalScenarios.fastPayback.battEnergyKWh, 0)} kWh`
                          : <span className="text-muted-foreground">-</span>
                        }
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(optimalScenarios.fastPayback.capexNet)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(optimalScenarios.fastPayback.npv25)}</TableCell>
                      <TableCell className="text-right font-mono">{formatNumber(optimalScenarios.fastPayback.irr25 * 100, 1)}%</TableCell>
                      <TableCell className="text-right font-mono">{formatNumber(optimalScenarios.fastPayback.selfSufficiencyPercent, 1)}%</TableCell>
                      <TableCell className="text-right font-mono font-bold text-orange-600">{formatNumber(optimalScenarios.fastPayback.simplePaybackYears, 1)} {language === "fr" ? "ans" : "yrs"}</TableCell>
                      <TableCell className="text-center">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleOptimizationClick('payback')}
                          data-testid="button-create-payback-variant"
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
                 optimalScenarios.maxSelfSufficiency?.id === optimalScenarios.bestNPV?.id ||
                 optimalScenarios.fastPayback?.id === optimalScenarios.bestNPV?.id ||
                 optimalScenarios.fastPayback?.id === optimalScenarios.bestIRR?.id) && (
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

interface VariantPreset {
  pvSize: number;
  batterySize: number;
  batteryPower: number;
  label?: string;
}

function CreateVariantDialog({ 
  simulation, 
  siteId, 
  onSuccess,
  externalOpen,
  onExternalOpenChange,
  preset,
  showTrigger = true
}: { 
  simulation: SimulationRun; 
  siteId: string;
  onSuccess: () => void;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
  preset?: VariantPreset | null;
  showTrigger?: boolean;
}) {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [pvSize, setPvSize] = useState(simulation.pvSizeKW || 100);
  const [batterySize, setBatterySize] = useState(simulation.battEnergyKWh || 0);
  const [batteryPower, setBatteryPower] = useState(simulation.battPowerKW || 0);
  
  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;
  const setOpen = isControlled ? (onExternalOpenChange || (() => {})) : setInternalOpen;
  
  const assumptions = (simulation.assumptions as AnalysisAssumptions | null) || defaultAnalysisAssumptions;
  
  const createVariantMutation = useMutation({
    mutationFn: async () => {
      const modifiedAssumptions: AnalysisAssumptions = {
        ...assumptions,
      };
      return apiRequest("POST", `/api/sites/${siteId}/run-potential-analysis`, { 
        assumptions: modifiedAssumptions,
        label: label || undefined,
        forcePvSize: pvSize,
        forceBatterySize: batterySize,
        forceBatteryPower: batteryPower,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites", siteId] });
      toast({ title: t("variant.success") });
      setOpen(false);
      onSuccess();
    },
    onError: () => {
      toast({ title: t("variant.error"), variant: "destructive" });
    },
  });
  
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      if (preset) {
        setLabel(preset.label || "");
        setPvSize(preset.pvSize);
        setBatterySize(preset.batterySize);
        setBatteryPower(preset.batteryPower);
      } else {
        setLabel("");
        setPvSize(simulation.pvSizeKW || 100);
        setBatterySize(simulation.battEnergyKWh || 0);
        setBatteryPower(simulation.battPowerKW || 0);
      }
    }
    setOpen(newOpen);
  };
  
  useEffect(() => {
    if (open && preset) {
      setLabel(preset.label || "");
      setPvSize(preset.pvSize);
      setBatterySize(preset.batterySize);
      setBatteryPower(preset.batteryPower);
    }
  }, [open, preset]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {showTrigger && (
        <DialogTrigger asChild>
          <Button variant="outline" className="gap-2" data-testid="button-create-variant">
            <Copy className="w-4 h-4" />
            {t("variant.createVariant")}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("variant.title")}</DialogTitle>
          <DialogDescription>{t("variant.description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="variant-label">{t("variant.label")}</Label>
            <Input 
              id="variant-label"
              placeholder={t("variant.labelPlaceholder")}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              data-testid="input-variant-label"
            />
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t("variant.pvSize")}</Label>
              <span className="text-sm font-mono font-medium">{pvSize} kWc</span>
            </div>
            <Slider
              value={[pvSize]}
              onValueChange={([v]) => setPvSize(v)}
              min={10}
              max={Math.max(500, (simulation.pvSizeKW || 100) * 2)}
              step={5}
              data-testid="slider-pv-size"
            />
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t("variant.batterySize")}</Label>
              <span className="text-sm font-mono font-medium">{batterySize} kWh</span>
            </div>
            <Slider
              value={[batterySize]}
              onValueChange={([v]) => setBatterySize(v)}
              min={0}
              max={Math.max(1000, (simulation.battEnergyKWh || 100) * 2)}
              step={10}
              data-testid="slider-battery-size"
            />
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t("variant.batteryPower")}</Label>
              <span className="text-sm font-mono font-medium">{batteryPower} kW</span>
            </div>
            <Slider
              value={[batteryPower]}
              onValueChange={([v]) => setBatteryPower(v)}
              min={0}
              max={Math.max(500, (simulation.battPowerKW || 50) * 2)}
              step={5}
              data-testid="slider-battery-power"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-variant-cancel">
            {t("variant.cancel")}
          </Button>
          <Button 
            onClick={() => createVariantMutation.mutate()} 
            disabled={createVariantMutation.isPending}
            className="gap-2"
            data-testid="button-variant-run"
          >
            {createVariantMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {t("variant.runAnalysis")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Financing option color constants - matching chart curves
const FINANCING_COLORS = {
  cash: { bg: "bg-emerald-500", text: "text-emerald-500", border: "border-emerald-500", stroke: "#22C55E", hsl: "hsl(142, 76%, 36%)" },
  loan: { bg: "bg-blue-500", text: "text-blue-500", border: "border-blue-500", stroke: "#3B82F6", hsl: "hsl(221, 83%, 53%)" },
  lease: { bg: "bg-amber-500", text: "text-amber-500", border: "border-amber-500", stroke: "#F59E0B", hsl: "hsl(38, 92%, 50%)" },
  ppa: { bg: "bg-rose-500", text: "text-rose-500", border: "border-rose-500", stroke: "#F43F5E", hsl: "hsl(347, 77%, 50%)" },
};

interface DisplayedScenarioType {
  pvSizeKW: number;
  battEnergyKWh: number;
  battPowerKW: number;
  npv25: number;
  irr25: number;
  selfSufficiencyPercent: number;
  simplePaybackYears: number;
  capexNet: number;
  annualSavings: number;
  totalProductionKWh?: number;
  co2AvoidedTonnesPerYear?: number;
}

function FinancingCalculator({ simulation, displayedScenario }: { simulation: SimulationRun; displayedScenario: DisplayedScenarioType }) {
  const { t, language } = useI18n();
  const [financingType, setFinancingType] = useState<"cash" | "loan" | "lease" | "ppa">("cash");
  const [loanTerm, setLoanTerm] = useState(10);
  const [interestRate, setInterestRate] = useState(7);
  const [downPayment, setDownPayment] = useState(30);
  const [leaseImplicitRate, setLeaseImplicitRate] = useState(8.5);
  const [leaseTerm, setLeaseTerm] = useState(15); // Default 15-year lease term
  
  // PPA (Third-Party Power Purchase Agreement) - TRC Solar model defaults
  const [ppaTerm, setPpaTerm] = useState(16); // 16 years typical
  const [ppaYear1Rate, setPpaYear1Rate] = useState(100); // Year 1: 100% of HQ rate
  const [ppaYear2Rate, setPpaYear2Rate] = useState(60); // Year 2+: 60% of HQ rate
  
  const breakdown = simulation.breakdown as FinancialBreakdown | null;
  const assumptions = simulation.assumptions as AnalysisAssumptions | null;
  
  // Use displayedScenario values to scale incentives proportionally
  const baseCapexNet = simulation.capexNet || 0;
  const baseCapexGross = breakdown?.capexGross || baseCapexNet;
  
  // Calculate scaling ratio: if displayed scenario has different system size, scale capex
  const basePvKW = simulation.pvSizeKW || 1;
  const baseBattKWh = simulation.battEnergyKWh || 0;
  const displayedPvKW = displayedScenario.pvSizeKW || 0;
  const displayedBattKWh = displayedScenario.battEnergyKWh || 0;
  
  // Scale CAPEX based on system size ratio (simplified linear scaling)
  const pvRatio = basePvKW > 0 ? displayedPvKW / basePvKW : 1;
  const battRatio = baseBattKWh > 0 ? displayedBattKWh / baseBattKWh : (displayedBattKWh > 0 ? 1 : 0);
  
  // Use displayedScenario capexNet directly (already calculated for that scenario)
  const capexNet = displayedScenario.capexNet || 0;
  // Scale capexGross proportionally
  const capexGross = baseCapexGross > 0 && baseCapexNet > 0 
    ? (baseCapexGross / baseCapexNet) * capexNet 
    : capexNet;
  const annualSavings = displayedScenario.annualSavings || simulation.annualSavings || 0;
  const selfConsumptionKWh = simulation.annualEnergySavingsKWh || 0;
  
  // Calculate total annual solar production = PV size × solar yield
  // This is what the system actually produces (different from self-consumption)
  const pvSizeKW = displayedPvKW; // Use displayed scenario PV size
  const solarYield = assumptions?.solarYieldKWhPerKWp || 1150; // kWh/kWp/year
  const totalAnnualProductionKWh = pvSizeKW * solarYield;
  
  // Incentive breakdown with timing - scale proportionally to displayed scenario
  const baseHqSolar = breakdown?.actualHQSolar || 0;
  const baseHqBattery = breakdown?.actualHQBattery || 0;
  const baseFederalITC = breakdown?.itcAmount || 0;
  const baseTaxShield = breakdown?.taxShield || 0;
  
  // Scale incentives proportionally
  const hqSolar = baseHqSolar * pvRatio;
  const hqBattery = baseHqBattery * battRatio;
  const federalITC = baseFederalITC * pvRatio; // Federal ITC is 30% of net CAPEX, scales with PV
  const taxShield = baseTaxShield * pvRatio; // Tax shield scales similarly
  
  // Realistic cash flow timing for cash purchase:
  // Day 0: Pay Gross CAPEX, receive HQ Solar rebate immediately (often direct to installer)
  // Year 0: Receive 50% of HQ Battery rebate
  // Year 1: Receive remaining 50% HQ Battery + Tax shield (CCA)
  // Year 2: Federal ITC as tax credit
  const upfrontCashNeeded = capexGross - hqSolar - (hqBattery * 0.5); // What client actually pays
  const year1Returns = (hqBattery * 0.5) + taxShield;
  const year2Returns = federalITC;
  const totalIncentives = hqSolar + hqBattery + federalITC + taxShield;
  
  // Loan calculation: loan on gross CAPEX, incentives return separately
  const loanDownPaymentAmount = capexGross * downPayment / 100;
  const loanAmount = capexGross - loanDownPaymentAmount;
  const monthlyRate = interestRate / 100 / 12;
  const numPayments = loanTerm * 12;
  const monthlyPayment = monthlyRate > 0 
    ? (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)
    : loanAmount / numPayments;
  const totalLoanPayments = monthlyPayment * numPayments + loanDownPaymentAmount; // Total cash out for loan
  const effectiveLoanCost = totalLoanPayments - totalIncentives; // Net after incentives return
  
  // Capital Lease (Crédit-bail) calculation:
  // In a capital lease, the lessee is treated as owner for tax purposes
  // Full CAPEX is financed - ALL incentives return to client as cash:
  //   - HQ solar rebate: Client receives (50% Year 0, 50% Year 1) - applied to bill, not to EPC
  //   - HQ battery rebate: Client receives (50% Year 0, 50% Year 1)
  //   - Federal ITC: Client receives in Year 2
  //   - Tax shield (CCA): Client receives in Year 1
  // Uses standard amortization formula (same as loan) for realistic payment calculation
  const leaseFinancedAmount = capexGross; // Full CAPEX financed - HQ rebates go to client, not bank
  const leaseMonthlyRate = leaseImplicitRate / 100 / 12;
  const leaseNumPayments = leaseTerm * 12;
  const leaseMonthlyPayment = leaseFinancedAmount > 0 && leaseMonthlyRate > 0
    ? (leaseFinancedAmount * leaseMonthlyRate * Math.pow(1 + leaseMonthlyRate, leaseNumPayments)) / (Math.pow(1 + leaseMonthlyRate, leaseNumPayments) - 1)
    : leaseFinancedAmount / Math.max(1, leaseNumPayments);
  const leaseTotalPayments = leaseMonthlyPayment * leaseNumPayments;
  // ALL incentives return to client as cash (HQ rebates go to client's bill, not to EPC/bank)
  const leaseTotalIncentives = hqSolar + hqBattery + federalITC + taxShield;
  const effectiveLeaseCost = leaseTotalPayments - leaseTotalIncentives;
  
  const formatCurrency = (value: number) => {
    // For values >= 1M, show as "X,XM$" format
    if (Math.abs(value) >= 1000000) {
      const millions = value / 1000000;
      if (language === "fr") {
        return `${millions.toFixed(2).replace(".", ",")} M$`;
      }
      return `$${millions.toFixed(2)}M`;
    }
    return new Intl.NumberFormat(language === "fr" ? "fr-CA" : "en-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0,
    }).format(value);
  };
  
  // Use consistent 25-year horizon for all financing comparisons
  const analysisHorizon = 25;
  
  // Capital Lease: 20-year payments with incentives, then 5 years of free energy (you own the system)
  // Net savings = Total savings over 25 years - effective cost (lease payments - incentives)
  const leaseNetSavings = annualSavings * analysisHorizon - effectiveLeaseCost;
  
  // PPA (Third-Party Power Purchase Agreement) calculation:
  // Based on TRC Solar model - client pays for electricity, not the system
  // Year 1: 100% of HQ rate (no savings in year 1)
  // Year 2+: 60% of HQ rate (40% savings vs HQ)
  // After term: System transfers to client for $1 (free electricity thereafter)
  // IMPORTANT: All incentives (HQ rebates, federal ITC, tax shield) are RETAINED by PPA provider
  const hqTariffRate = assumptions?.tariffCode === "M" ? 0.06061 : 0.11933; // $/kWh based on tariff
  const ppaYear1Annual = totalAnnualProductionKWh * hqTariffRate * (ppaYear1Rate / 100);
  const ppaYear2Annual = totalAnnualProductionKWh * hqTariffRate * (ppaYear2Rate / 100);
  const ppaTotalPayments = ppaYear1Annual + (ppaYear2Annual * (ppaTerm - 1));
  // PPA provider keeps ALL incentives - this is where they profit
  const ppaProviderKeepsIncentives = totalIncentives;
  // Post-PPA savings: After term ends, client owns system for $1 and gets free electricity
  const postPpaYears = Math.max(0, analysisHorizon - ppaTerm);
  const postPpaSavings = annualSavings * postPpaYears;
  // PPA savings during term = what they would have paid HQ - what they pay PPA provider
  const hqCostDuringPpa = totalAnnualProductionKWh * hqTariffRate * ppaTerm;
  const ppaSavingsDuringTerm = hqCostDuringPpa - ppaTotalPayments;
  // Total PPA "cost" = payments to PPA provider (no ownership benefit during term)
  const ppaEffectiveCost = ppaTotalPayments;
  // Net savings over 25 years = savings during PPA + free electricity after PPA
  const ppaNetSavings = ppaSavingsDuringTerm + postPpaSavings;
  // Average monthly "payment" for display purposes
  const ppaMonthlyPayment = ppaTotalPayments / (ppaTerm * 12);
  
  const options = [
    {
      type: "cash" as const,
      icon: Wallet,
      label: t("financing.cash"),
      upfrontCost: upfrontCashNeeded, // Realistic cash needed at signing
      totalCost: capexNet, // Net after all incentives return
      monthlyPayment: 0,
      netSavings: annualSavings * analysisHorizon - capexNet,
    },
    {
      type: "loan" as const,
      icon: CreditCard,
      label: t("financing.loan"),
      upfrontCost: loanDownPaymentAmount,
      totalCost: effectiveLoanCost, // Net after incentives return
      totalPayments: totalLoanPayments, // Gross cash out
      monthlyPayment: monthlyPayment,
      netSavings: annualSavings * analysisHorizon - effectiveLoanCost,
    },
    {
      type: "lease" as const,
      icon: FileCheck,
      label: t("financing.lease"),
      upfrontCost: 0,
      totalCost: effectiveLeaseCost, // Net after incentives return (like loan)
      totalPayments: leaseTotalPayments, // Gross lease payments
      monthlyPayment: leaseMonthlyPayment,
      netSavings: leaseNetSavings, // 25 years of savings minus effective cost
    },
    {
      type: "ppa" as const,
      icon: Zap,
      label: t("financing.ppa"),
      upfrontCost: 0, // No upfront cost for PPA
      totalCost: ppaEffectiveCost, // Total payments to PPA provider
      totalPayments: ppaTotalPayments,
      monthlyPayment: ppaMonthlyPayment,
      netSavings: ppaNetSavings, // Savings during term + free electricity after
      isPpa: true, // Flag to show special PPA info
    },
  ];

  // Calculate cumulative cashflow for each financing option over analysis horizon
  const calculateCumulativeCashflows = () => {
    const years = analysisHorizon;
    const data: { year: number; cash: number; loan: number; lease: number; ppa: number }[] = [];
    
    // Cash option: upfront cost, then savings, with incentive returns
    let cashCumulative = -upfrontCashNeeded;
    
    // Loan option: down payment, then monthly payments + savings, with incentive returns
    let loanCumulative = -loanDownPaymentAmount;
    const annualLoanPayment = monthlyPayment * 12;
    
    // Capital Lease (Crédit-bail): no upfront cash, monthly payments, savings + incentive returns
    // Client receives ALL incentives as cash (HQ rebates go to client's bill, not to EPC/bank)
    // Year 0: Receive 50% HQ Solar + 50% HQ Battery as bill credits/cash
    const annualLeasePayment = leaseMonthlyPayment * 12;
    let leaseCumulative = (hqSolar * 0.5) + (hqBattery * 0.5); // 50% of both HQ rebates at Year 0
    
    // PPA: No upfront cost, pay for electricity during term, free after term
    let ppaCumulative = 0;
    
    for (let year = 0; year <= years; year++) {
      if (year === 0) {
        // Year 0: initial investments
        data.push({
          year,
          cash: cashCumulative / 1000,
          loan: loanCumulative / 1000,
          lease: leaseCumulative / 1000,
          ppa: ppaCumulative / 1000,
        });
      } else {
        // Add savings each year for ownership options (cash, loan, lease)
        cashCumulative += annualSavings;
        loanCumulative += annualSavings;
        leaseCumulative += annualSavings;
        
        // PPA: During term, client saves vs HQ rate but pays PPA provider
        // After term, client gets free electricity (full savings)
        if (year <= ppaTerm) {
          // During PPA term: savings = HQ rate - PPA rate
          const ppaRateThisYear = year === 1 ? (ppaYear1Rate / 100) : (ppaYear2Rate / 100);
          const hqCostThisYear = totalAnnualProductionKWh * hqTariffRate;
          const ppaCostThisYear = totalAnnualProductionKWh * hqTariffRate * ppaRateThisYear;
          ppaCumulative += (hqCostThisYear - ppaCostThisYear);
        } else {
          // After PPA term: client owns system for $1, gets full savings
          ppaCumulative += annualSavings;
        }
        
        // Subtract payments for loan (if still in term)
        if (year <= loanTerm) {
          loanCumulative -= annualLoanPayment;
        }
        
        // Subtract lease payments (during lease term)
        if (year <= leaseTerm) {
          leaseCumulative -= annualLeasePayment;
        }
        
        // Add incentive returns for cash, loan, and capital lease
        // Capital lease client is treated as owner for tax purposes
        // Lease gets additional 50% HQ solar that cash/loan don't get (they got it upfront)
        // PPA: NO incentives return to client (provider keeps them all)
        if (year === 1) {
          cashCumulative += year1Returns;
          loanCumulative += year1Returns;
          // Lease Year 1: 50% HQ battery + tax shield (same as cash/loan) PLUS 50% HQ solar
          leaseCumulative += year1Returns + (hqSolar * 0.5); // Crédit-bail: includes HQ solar tranche
        }
        if (year === 2) {
          cashCumulative += year2Returns;
          loanCumulative += year2Returns;
          leaseCumulative += year2Returns; // Crédit-bail: Federal ITC
        }
        
        data.push({
          year,
          cash: cashCumulative / 1000,
          loan: loanCumulative / 1000,
          lease: leaseCumulative / 1000,
          ppa: ppaCumulative / 1000,
        });
      }
    }
    
    return data;
  };
  
  const cumulativeCashflowData = calculateCumulativeCashflows();

  return (
    <Card id="pdf-section-financing" data-testid="card-financing-calculator">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          {t("financing.title")}
        </CardTitle>
        <CardDescription>{t("financing.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {options.map((option) => {
            const colors = FINANCING_COLORS[option.type];
            const isSelected = financingType === option.type;
            return (
              <button
                key={option.type}
                onClick={() => setFinancingType(option.type)}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  isSelected 
                    ? `${colors.border} bg-opacity-10` 
                    : "border-border hover:border-muted-foreground/50"
                }`}
                style={isSelected ? { backgroundColor: `${colors.stroke}15` } : undefined}
                data-testid={`button-financing-${option.type}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div 
                    className={`w-3 h-3 rounded-full ${colors.bg}`}
                    style={{ boxShadow: isSelected ? `0 0 8px ${colors.stroke}` : undefined }}
                  />
                  <option.icon className={`w-4 h-4 ${isSelected ? colors.text : "text-muted-foreground"}`} />
                </div>
                <p className={`font-medium text-sm ${isSelected ? colors.text : ""}`}>{option.label}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {option.monthlyPayment > 0 
                    ? `${formatCurrency(option.monthlyPayment)}${language === "fr" ? "/mois" : "/mo"}`
                    : language === "fr" ? "Paiement unique" : "One-time"
                  }
                </p>
              </button>
            );
          })}
        </div>
        
        {financingType === "loan" && (
          <div className="grid md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="space-y-2">
              <Label>{t("financing.loanTerm")}</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[loanTerm]}
                  onValueChange={([v]) => setLoanTerm(v)}
                  min={5}
                  max={20}
                  step={1}
                  data-testid="slider-loan-term"
                />
                <span className="text-sm font-mono w-12">{loanTerm}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("financing.interestRate")}</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[interestRate]}
                  onValueChange={([v]) => setInterestRate(v)}
                  min={3}
                  max={12}
                  step={0.25}
                  data-testid="slider-interest-rate"
                />
                <span className="text-sm font-mono w-12">{interestRate}%</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("financing.downPayment")}</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[downPayment]}
                  onValueChange={([v]) => setDownPayment(v)}
                  min={0}
                  max={50}
                  step={5}
                  data-testid="slider-down-payment"
                />
                <span className="text-sm font-mono w-12">{downPayment}%</span>
              </div>
            </div>
          </div>
        )}
        
        {financingType === "lease" && (
          <div className="p-4 bg-muted/50 rounded-lg space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === "fr" ? "Durée du bail" : "Lease term"}</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[leaseTerm]}
                    onValueChange={([v]) => setLeaseTerm(v)}
                    min={5}
                    max={20}
                    step={1}
                    data-testid="slider-lease-term"
                  />
                  <span className="text-sm font-mono w-16">{leaseTerm} {language === "fr" ? "ans" : "yrs"}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("financing.leaseImplicitRate")}</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[leaseImplicitRate]}
                    onValueChange={([v]) => setLeaseImplicitRate(v)}
                    min={5}
                    max={15}
                    step={0.5}
                    data-testid="slider-lease-implicit-rate"
                  />
                  <span className="text-sm font-mono w-12">{leaseImplicitRate}%</span>
                </div>
              </div>
            </div>
            <div className="text-sm space-y-1 text-muted-foreground">
              <p className="flex justify-between gap-2 font-medium">
                <span>{language === "fr" ? "Montant financé (CAPEX total):" : "Financed amount (total CAPEX):"}</span>
                <span className="font-mono">{formatCurrency(leaseFinancedAmount)}</span>
              </p>
              <p className="flex justify-between gap-2 pt-2 border-t">
                <span>{language === "fr" ? "Paiement mensuel:" : "Monthly payment:"}</span>
                <span className="font-mono font-semibold">{formatCurrency(leaseMonthlyPayment)}</span>
              </p>
              <p className="flex justify-between gap-2 pt-2 border-t text-xs">
                <span>{language === "fr" ? "Incitatifs retournés au client:" : "Incentives returned to client:"}</span>
                <span className="font-mono text-primary">+{formatCurrency(leaseTotalIncentives)}</span>
              </p>
            </div>
          </div>
        )}
        
        {/* PPA Controls and Legal Warning */}
        {financingType === "ppa" && (
          <div className="space-y-4">
            {/* Legal Warning - Prominent */}
            <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border-2 border-rose-300 dark:border-rose-700 rounded-lg">
              <p className="text-sm text-rose-800 dark:text-rose-200 leading-relaxed">
                {t("financing.ppaLegalWarning")}
              </p>
            </div>
            
            {/* PPA Parameters */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Zap className="w-4 h-4" />
                <span>{t("financing.ppaCompetitorModel")}</span>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{t("financing.ppaTerm")}</Label>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[ppaTerm]}
                      onValueChange={([v]) => setPpaTerm(v)}
                      min={10}
                      max={25}
                      step={1}
                      data-testid="slider-ppa-term"
                    />
                    <span className="text-sm font-mono w-16">{ppaTerm} {language === "fr" ? "ans" : "yrs"}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("financing.ppaYear1Rate")}</Label>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[ppaYear1Rate]}
                      onValueChange={([v]) => setPpaYear1Rate(v)}
                      min={80}
                      max={110}
                      step={5}
                      data-testid="slider-ppa-year1-rate"
                    />
                    <span className="text-sm font-mono w-12">{ppaYear1Rate}%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("financing.ppaYear2Rate")}</Label>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[ppaYear2Rate]}
                      onValueChange={([v]) => setPpaYear2Rate(v)}
                      min={40}
                      max={80}
                      step={5}
                      data-testid="slider-ppa-year2-rate"
                    />
                    <span className="text-sm font-mono w-12">{ppaYear2Rate}%</span>
                  </div>
                </div>
              </div>
              
              {/* PPA Cost Breakdown */}
              <div className="text-sm space-y-1 text-muted-foreground pt-2 border-t">
                <p className="flex justify-between gap-2">
                  <span>{language === "fr" ? "Paiement An 1:" : "Year 1 payment:"}</span>
                  <span className="font-mono">{formatCurrency(ppaYear1Annual)}</span>
                </p>
                <p className="flex justify-between gap-2">
                  <span>{language === "fr" ? `Paiement An 2-${ppaTerm}:` : `Year 2-${ppaTerm} payment:`}</span>
                  <span className="font-mono">{formatCurrency(ppaYear2Annual)}{language === "fr" ? "/an" : "/yr"}</span>
                </p>
                <p className="flex justify-between gap-2 pt-2 border-t font-medium">
                  <span>{language === "fr" ? `Total ${ppaTerm} ans:` : `Total ${ppaTerm} years:`}</span>
                  <span className="font-mono font-semibold">{formatCurrency(ppaTotalPayments)}</span>
                </p>
                <p className="flex justify-between gap-2 pt-2 border-t text-xs text-rose-600 dark:text-rose-400">
                  <span>{t("financing.ppaNoIncentives")}:</span>
                  <span className="font-mono">-{formatCurrency(ppaProviderKeepsIncentives)}</span>
                </p>
                <p className="flex justify-between gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                  <span>{t("financing.ppaTransfer")} ({language === "fr" ? "pour 1$" : "for $1"}):</span>
                  <span className="font-mono">+{formatCurrency(postPpaSavings)} ({postPpaYears} {language === "fr" ? "ans" : "yrs"})</span>
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Cash Flow Timeline for Cash and Loan */}
        {(financingType === "cash" || financingType === "loan") && totalIncentives > 0 && (
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {language === "fr" ? "Flux de trésorerie réaliste" : "Realistic Cash Flow"}
            </h4>
            <div className="grid gap-2 text-sm">
              {financingType === "cash" ? (
                <>
                  <div className="flex justify-between items-center py-1 border-b border-dashed">
                    <span className="text-muted-foreground">
                      {language === "fr" ? "Jour 0 — Paiement initial" : "Day 0 — Initial Payment"}
                    </span>
                    <span className="font-mono font-bold text-destructive">
                      -{formatCurrency(upfrontCashNeeded)}
                    </span>
                  </div>
                  {hqSolar > 0 && (
                    <div className="flex justify-between items-center py-1 border-b border-dashed">
                      <span className="text-muted-foreground text-xs">
                        {language === "fr" ? "└ Incl. rabais HQ solaire" : "└ Incl. HQ solar rebate"}
                      </span>
                      <span className="font-mono text-xs text-primary">
                        (-{formatCurrency(hqSolar)})
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex justify-between items-center py-1 border-b border-dashed">
                    <span className="text-muted-foreground">
                      {language === "fr" ? "Jour 0 — Mise de fonds" : "Day 0 — Down Payment"}
                    </span>
                    <span className="font-mono font-bold text-destructive">
                      -{formatCurrency(loanDownPaymentAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-dashed">
                    <span className="text-muted-foreground">
                      {language === "fr" ? `An 1-${loanTerm} — Paiements` : `Year 1-${loanTerm} — Payments`}
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {formatCurrency(monthlyPayment)}{language === "fr" ? "/mois" : "/mo"}
                    </span>
                  </div>
                </>
              )}
              {year1Returns > 0 && (
                <div className="flex justify-between items-center py-1 border-b border-dashed">
                  <span className="text-muted-foreground">
                    {language === "fr" ? "An 1 — Rabais HQ + Crédit CCA" : "Year 1 — HQ Rebate + CCA Credit"}
                  </span>
                  <span className="font-mono font-semibold text-primary">
                    +{formatCurrency(year1Returns)}
                  </span>
                </div>
              )}
              {year2Returns > 0 && (
                <div className="flex justify-between items-center py-1 border-b border-dashed">
                  <span className="text-muted-foreground">
                    {language === "fr" ? "An 2 — CII fédéral (30%)" : "Year 2 — Federal ITC (30%)"}
                  </span>
                  <span className="font-mono font-semibold text-primary">
                    +{formatCurrency(year2Returns)}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center py-1 pt-2 border-t">
                <span className="font-medium">
                  {language === "fr" ? "Coût net final" : "Final Net Cost"}
                </span>
                <span className="font-mono font-bold">
                  {formatCurrency(financingType === "cash" ? capexNet : effectiveLoanCost)}
                </span>
              </div>
            </div>
          </div>
        )}
        
        <div 
          className="grid grid-cols-3 gap-4 pt-4 border-t rounded-lg p-4 mt-2"
          style={{ backgroundColor: `${FINANCING_COLORS[financingType].stroke}10` }}
        >
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">
              {financingType === "cash" 
                ? (language === "fr" ? "Mise de fonds" : "Upfront Cash")
                : financingType === "loan"
                  ? (language === "fr" ? "Coût net" : "Net Cost")
                  : t("financing.totalCost")
              }
            </p>
            <p className={`text-xl font-bold font-mono ${FINANCING_COLORS[financingType].text}`}>
              {formatCurrency(
                financingType === "cash" 
                  ? upfrontCashNeeded 
                  : (options.find(o => o.type === financingType)?.totalCost || 0)
              )}
            </p>
            {financingType === "cash" && (
              <p className="text-xs text-muted-foreground mt-1">
                {language === "fr" ? `(net: ${formatCurrency(capexNet)})` : `(net: ${formatCurrency(capexNet)})`}
              </p>
            )}
            {financingType === "loan" && (
              <p className="text-xs text-muted-foreground mt-1">
                {language === "fr" 
                  ? `(paiements: ${formatCurrency(totalLoanPayments)})` 
                  : `(payments: ${formatCurrency(totalLoanPayments)})`
                }
              </p>
            )}
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">{t("financing.monthlyPayment")}</p>
            <p className={`text-xl font-bold font-mono ${FINANCING_COLORS[financingType].text}`}>
              {formatCurrency(options.find(o => o.type === financingType)?.monthlyPayment || 0)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">{t("financing.netSavings")} (25 {t("compare.years")})</p>
            <p className={`text-xl font-bold font-mono ${(options.find(o => o.type === financingType)?.netSavings || 0) > 0 ? "text-emerald-600" : "text-red-500"}`}>
              {formatCurrency(options.find(o => o.type === financingType)?.netSavings || 0)}
            </p>
          </div>
        </div>
        
        {/* Unified Cashflow Chart - All Acquisition Models */}
        {cumulativeCashflowData.length > 0 && (
          <div id="pdf-section-financing-chart" className="pt-4 border-t bg-white dark:bg-card rounded-lg p-4">
            <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              {language === "fr" ? "Flux de trésorerie selon le mode d'acquisition (25 ans)" : "Cash Flow by Acquisition Mode (25 years)"}
            </h4>
            <div className="h-64 bg-white dark:bg-gray-900 rounded">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cumulativeCashflowData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="year" 
                    fontSize={11}
                    label={{ value: language === "fr" ? "Année" : "Year", position: "bottom", offset: 0, fontSize: 11 }}
                  />
                  <YAxis 
                    fontSize={11}
                    tickFormatter={(v) => `${v >= 0 ? "" : "-"}$${Math.abs(v).toFixed(0)}k`}
                    label={{ value: language === "fr" ? "Flux cumulatif ($k)" : "Cumulative Flow ($k)", angle: -90, position: "insideLeft", fontSize: 11 }}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      `$${(value * 1000).toLocaleString()}`,
                      name === "cash" ? (language === "fr" ? "Comptant" : "Cash") :
                      name === "loan" ? (language === "fr" ? "Prêt" : "Loan") :
                      name === "lease" ? (language === "fr" ? "Crédit-bail" : "Capital Lease") :
                      (language === "fr" ? "PPA Tiers" : "Third-Party PPA")
                    ]}
                    labelFormatter={(year) => `${language === "fr" ? "Année" : "Year"} ${year}`}
                  />
                  <Legend 
                    formatter={(value) => 
                      value === "cash" ? (language === "fr" ? "Comptant" : "Cash") :
                      value === "loan" ? (language === "fr" ? "Prêt" : "Loan") :
                      value === "lease" ? (language === "fr" ? "Crédit-bail" : "Capital Lease") :
                      (language === "fr" ? "PPA Tiers ⚠️" : "Third-Party PPA ⚠️")
                    }
                  />
                  <Line 
                    type="monotone" 
                    dataKey="cash" 
                    stroke={FINANCING_COLORS.cash.stroke}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="loan" 
                    stroke={FINANCING_COLORS.loan.stroke}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="lease" 
                    stroke={FINANCING_COLORS.lease.stroke}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="ppa" 
                    stroke={FINANCING_COLORS.ppa.stroke}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              {language === "fr" 
                ? "Flux de trésorerie cumulatif incluant tous les coûts, économies et incitatifs" 
                : "Cumulative cash flow including all costs, savings, and incentives"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AnalysisResults({ 
  simulation, 
  site, 
  isStaff = false, 
  onNavigateToDesignAgreement, 
  isLoadingFullData = false,
  optimizationTarget = 'npv',
  onOptimizationTargetChange
}: { 
  simulation: SimulationRun; 
  site: SiteWithDetails; 
  isStaff?: boolean; 
  onNavigateToDesignAgreement?: () => void; 
  isLoadingFullData?: boolean;
  optimizationTarget?: 'npv' | 'irr' | 'selfSufficiency' | 'payback';
  onOptimizationTargetChange?: (target: 'npv' | 'irr' | 'selfSufficiency' | 'payback') => void;
}) {
  const { t, language } = useI18n();
  const [showBreakdown, setShowBreakdown] = useState(true);
  const [showIncentives, setShowIncentives] = useState(true);
  const [variantDialogOpen, setVariantDialogOpen] = useState(false);
  const [variantPreset, setVariantPreset] = useState<VariantPreset | null>(null);
  const [showExtendedLifeAnalysis, setShowExtendedLifeAnalysis] = useState(false);
  
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
        ? `${pvKW}kW PV`
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
  
  // Validation: Detect breakdown/pvSizeKW mismatch (regression detection)
  useEffect(() => {
    if (breakdown && simulation.pvSizeKW && assumptions.solarCostPerW) {
      const expectedCapexSolar = simulation.pvSizeKW * 1000 * assumptions.solarCostPerW;
      const actualCapexSolar = breakdown.capexSolar || 0;
      const mismatchRatio = Math.abs(expectedCapexSolar - actualCapexSolar) / Math.max(expectedCapexSolar, 1);
      
      if (mismatchRatio > 0.1) { // More than 10% mismatch
        console.warn(
          `[BREAKDOWN MISMATCH] Financial breakdown may be stale!\n` +
          `  PV Size: ${simulation.pvSizeKW} kW\n` +
          `  Expected CAPEX Solar: $${expectedCapexSolar.toFixed(0)}\n` +
          `  Actual CAPEX Solar: $${actualCapexSolar.toFixed(0)}\n` +
          `  Mismatch: ${(mismatchRatio * 100).toFixed(1)}%`
        );
      }
    }
  }, [breakdown, simulation.pvSizeKW, assumptions.solarCostPerW]);

  const usableRoofSqFt = assumptions.roofAreaSqFt * assumptions.roofUtilizationRatio;
  const maxPVFromRoof = usableRoofSqFt / 100;
  const isRoofLimited = (simulation.pvSizeKW || 0) >= maxPVFromRoof * 0.95;

  // Memoize expensive hourly profile aggregation (8760 entries -> 24 hourly averages)
  const hourlyProfileData = useMemo(() => {
    const rawProfile = simulation.hourlyProfile as HourlyProfileEntry[] | null;
    if (!rawProfile || rawProfile.length === 0) {
      return null;
    }
    
    // Aggregate by hour of day (average across all days for "Profil moyen")
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
    
    // Convert to array sorted by hour (all values are averages)
    const result = [];
    for (let h = 0; h < 24; h++) {
      const data = byHour.get(h);
      if (data && data.count > 0) {
        const consumptionAfter = (data.consumptionSum - data.productionSum) / data.count;
        result.push({
          hour: `${h}h`,
          consumptionBefore: Math.round(data.consumptionSum / data.count),
          consumptionAfter: Math.max(0, Math.round(consumptionAfter)), // Clamp negative (exports)
          peakBefore: Math.round(data.peakBeforeSum / data.count),
          peakAfter: Math.round(data.peakAfterSum / data.count),
        });
      }
    }
    return result;
  }, [simulation.hourlyProfile]);

  // Section Divider component for visual hierarchy
  const SectionDivider = ({ title, icon: Icon }: { title: string; icon?: any }) => (
    <div className="flex items-center gap-3 py-2">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-primary" />}
        <span className="text-sm font-semibold text-primary uppercase tracking-wider">{title}</span>
      </div>
      <div className="flex-1 h-px bg-gradient-to-r from-primary/30 to-transparent" />
    </div>
  );

  // Get optimal scenario from sensitivity analysis for unified Dashboard display
  const optimalScenario = simulation.sensitivity 
    ? (simulation.sensitivity as SensitivityAnalysis).frontier.find(p => p.isOptimal)
    : null;

  // Get all optimization target scenarios from sensitivity analysis
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
      } : null,
      irr: optScenarios.bestIRR ? {
        pvSizeKW: optScenarios.bestIRR.pvSizeKW,
        battEnergyKWh: optScenarios.bestIRR.battEnergyKWh,
        battPowerKW: optScenarios.bestIRR.battPowerKW,
        npv25: optScenarios.bestIRR.npv25,
        irr25: optScenarios.bestIRR.irr25,
        selfSufficiencyPercent: optScenarios.bestIRR.selfSufficiencyPercent,
        simplePaybackYears: optScenarios.bestIRR.simplePaybackYears,
        capexNet: optScenarios.bestIRR.capexNet,
        annualSavings: optScenarios.bestIRR.annualSavings,
      } : null,
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
      } : null,
      payback: optScenarios.fastPayback ? {
        pvSizeKW: optScenarios.fastPayback.pvSizeKW,
        battEnergyKWh: optScenarios.fastPayback.battEnergyKWh,
        battPowerKW: optScenarios.fastPayback.battPowerKW,
        npv25: optScenarios.fastPayback.npv25,
        irr25: optScenarios.fastPayback.irr25,
        selfSufficiencyPercent: optScenarios.fastPayback.selfSufficiencyPercent,
        simplePaybackYears: optScenarios.fastPayback.simplePaybackYears,
        capexNet: optScenarios.fastPayback.capexNet,
        annualSavings: optScenarios.fastPayback.annualSavings,
      } : null,
    };
  }, [simulation.sensitivity]);

  // Get displayed scenario based on optimization target
  const displayedScenario = useMemo(() => {
    const fallbackScenario = {
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
    };
    
    if (!optimizationScenarios) {
      return fallbackScenario;
    }
    
    const selected = optimizationScenarios[optimizationTarget];
    if (!selected) {
      // Fallback to NPV if selected target not available
      return { ...fallbackScenario, ...(optimizationScenarios.npv || {}) };
    }
    return { ...fallbackScenario, ...selected };
  }, [optimizationScenarios, optimizationTarget, simulation]);

  // Optimization target labels
  const optimizationLabels = {
    npv: { fr: "Meilleur VAN", en: "Best NPV", icon: DollarSign },
    irr: { fr: "Meilleur TRI", en: "Best IRR", icon: TrendingUp },
    selfSufficiency: { fr: "Autonomie max", en: "Max Independence", icon: Battery },
    payback: { fr: "Retour rapide", en: "Fast Payback", icon: Clock },
  };

  // Use displayed scenario KPIs based on selected optimization target (updates all page data)
  const dashboardPvSizeKW = displayedScenario.pvSizeKW ?? simulation.pvSizeKW ?? 0;
  const dashboardBattEnergyKWh = displayedScenario.battEnergyKWh ?? 0;
  const dashboardProductionMWh = displayedScenario.totalProductionKWh 
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

  // NOTE: 30-year extended life analysis requires backend cashflow engine changes
  // to properly synchronize revenue, OPEX, debt, incentives, and replacements.
  // The 25-year analysis is the industry standard for bankable projects.
  // Future enhancement: Add analysisYears=30 parameter to backend simulation engine.

  return (
    <div className="space-y-6">
      {/* Optimal System Recommendation Banner - updates based on selected optimization target */}
      {displayedScenario && (
        <Card className="border-primary bg-gradient-to-r from-primary/10 to-primary/5">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/20">
                  <Star className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {language === "fr" 
                      ? `Configuration sélectionnée (${optimizationLabels[optimizationTarget].fr.toLowerCase()})` 
                      : `Selected Configuration (${optimizationLabels[optimizationTarget].en.toLowerCase()})`}
                  </p>
                  <p className="text-lg font-bold text-foreground" data-testid="text-recommended-system">
                    {dashboardPvSizeKW > 0 && `${Math.round(dashboardPvSizeKW)} kWc PV`}
                    {dashboardPvSizeKW > 0 && dashboardBattEnergyKWh > 0 && " + "}
                    {dashboardBattEnergyKWh > 0 && `${Math.round(dashboardBattEnergyKWh)} kWh ${language === "fr" ? "stockage" : "storage"}`}
                  </p>
                </div>
              </div>
              <Badge variant="default" className="text-sm px-3 py-1">
                {language === "fr" ? "VAN" : "NPV"}: ${(dashboardNpv25 / 1000).toFixed(0)}k
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Dashboard - Quick Overview (using optimal scenario data) */}
      <KPIDashboard
        pvSizeKW={dashboardPvSizeKW}
        productionMWh={dashboardProductionMWh}
        coveragePercent={dashboardCoveragePercent}
        paybackYears={dashboardPaybackYears}
        annualSavings={dashboardAnnualSavings}
        npv25={dashboardNpv25}
        irr25={dashboardIrr25}
        co2Tonnes={dashboardCo2Tonnes}
      />

      {/* Interactive Roof Visualization with Drawn Polygons */}
      {site && site.latitude && site.longitude && import.meta.env.VITE_GOOGLE_MAPS_API_KEY && (
        <RoofVisualization
          siteId={site.id}
          siteName={site.name}
          address={site.address || ""}
          latitude={site.latitude}
          longitude={site.longitude}
          roofAreaSqFt={assumptions.roofAreaSqFt}
          maxPVCapacityKW={maxPVFromRoof}
          currentPVSizeKW={dashboardPvSizeKW || undefined}
        />
      )}


      {/* ========== SECTION 1: RECOMMENDED SYSTEM ========== */}
      <SectionDivider 
        title={language === "fr" ? "Système recommandé" : "Recommended System"} 
        icon={Zap}
      />

      {/* Recommended System with Roof Constraint - PROMINENT */}
      <Card id="pdf-section-system-config" className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
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
            
            {/* Optimization Target Toggle - Interactive selection */}
            {optimizationScenarios && (
              <div className="flex flex-col items-end gap-1">
                <ToggleGroup 
                  type="single" 
                  value={optimizationTarget}
                  onValueChange={(value) => {
                    if (value && onOptimizationTargetChange) {
                      onOptimizationTargetChange(value as 'npv' | 'irr' | 'selfSufficiency' | 'payback');
                    }
                  }}
                  className="flex-wrap justify-start sm:justify-end border rounded-lg p-1 bg-muted/30"
                  data-testid="toggle-optimization-target"
                >
                  {(['npv', 'irr', 'selfSufficiency', 'payback'] as const).map((target) => {
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
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sun className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{language === "fr" ? "Panneaux solaires" : "Solar Panels"}</p>
                <p className="text-2xl font-bold font-mono text-primary" data-testid="text-pv-size">{displayedScenario.pvSizeKW.toFixed(0)} <span className="text-sm font-normal">kWc</span></p>
                {displayedScenario.pvSizeKW > 1000 && (
                  <Badge variant="destructive" className="mt-1 text-xs flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {language === "fr" ? "Dépasse 1 MW (limite HQ)" : "Exceeds 1 MW (HQ limit)"}
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
                <p className="text-2xl font-bold font-mono text-primary" data-testid="text-battery-size">{displayedScenario.battEnergyKWh.toFixed(0)} <span className="text-sm font-normal">kWh</span></p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{language === "fr" ? "Puissance batterie" : "Battery Power"}</p>
                <p className="text-2xl font-bold font-mono text-primary" data-testid="text-battery-power">{displayedScenario.battPowerKW.toFixed(0)} <span className="text-sm font-normal">kW</span></p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center">
                <Home className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{language === "fr" ? "Capacité toit" : "Roof Capacity"}</p>
                <p className="text-lg font-bold font-mono">{Math.round(maxPVFromRoof)} <span className="text-sm font-normal">kWc max</span></p>
                {isRoofLimited && (
                  <Badge variant="secondary" className="mt-1 text-xs">
                    {language === "fr" ? "Limité par le toit" : "Roof limited"}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          {/* KPI Summary for selected scenario */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3 bg-background rounded-lg border text-center">
              <p className="text-xs text-muted-foreground mb-1">VAN (25 ans)</p>
              <p className="text-lg font-bold font-mono text-green-600 dark:text-green-400" data-testid="text-npv">
                ${(displayedScenario.npv25 / 1000).toFixed(0)}k
              </p>
            </div>
            <div className="p-3 bg-background rounded-lg border text-center">
              <p className="text-xs text-muted-foreground mb-1">TRI</p>
              <p className="text-lg font-bold font-mono" data-testid="text-irr">
                {((displayedScenario.irr25 || 0) * 100).toFixed(1)}%
              </p>
            </div>
            <div className="p-3 bg-background rounded-lg border text-center">
              <p className="text-xs text-muted-foreground mb-1">{language === "fr" ? "Retour" : "Payback"}</p>
              <p className="text-lg font-bold font-mono" data-testid="text-payback">
                {displayedScenario.simplePaybackYears.toFixed(1)} {language === "fr" ? "ans" : "yrs"}
              </p>
            </div>
            <div className="p-3 bg-background rounded-lg border text-center">
              <p className="text-xs text-muted-foreground mb-1">{language === "fr" ? "Écon./an" : "Savings/yr"}</p>
              <p className="text-lg font-bold font-mono text-green-600 dark:text-green-400" data-testid="text-savings">
                ${(displayedScenario.annualSavings / 1000).toFixed(0)}k
              </p>
            </div>
          </div>
          
          {/* Self-sufficiency bar */}
          <div className="mt-6 p-4 bg-background rounded-lg border">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">{language === "fr" ? "Autonomie énergétique" : "Energy Independence"}</span>
              <span className="text-xl font-bold font-mono text-primary" data-testid="text-self-sufficiency">{displayedScenario.selfSufficiencyPercent.toFixed(0)}%</span>
            </div>
            <Progress value={displayedScenario.selfSufficiencyPercent} className="h-3" />
          </div>
          
          {/* Surplus Revenue Info (HQ Net Metering Dec 2024) - More Prominent */}
          {(simulation.totalExportedKWh || 0) > 0 && (simulation.annualSurplusRevenue || 0) > 0 && (
            <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/40 dark:to-cyan-950/40 rounded-lg border-2 border-blue-300 dark:border-blue-700">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                    {language === "fr" ? "Revenus de surplus HQ" : "HQ Surplus Revenue"}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    {language === "fr" ? "Programme d'autoproduction (mesurage net)" : "Self-production program (net metering)"}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-white/50 dark:bg-white/5 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">
                    {language === "fr" ? "Surplus annuel exporté" : "Annual surplus exported"}
                  </p>
                  <p className="text-lg font-bold font-mono text-blue-600 dark:text-blue-400">
                    {Math.round(simulation.totalExportedKWh || 0).toLocaleString()} kWh
                  </p>
                </div>
                <div className="p-3 bg-white/50 dark:bg-white/5 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">
                    {language === "fr" ? "Revenu annuel (après 24 mois)" : "Annual revenue (after 24 months)"}
                  </p>
                  <p className="text-lg font-bold font-mono text-green-600 dark:text-green-400">
                    ${Math.round(simulation.annualSurplusRevenue || 0).toLocaleString()}
                  </p>
                </div>
              </div>
              <p className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-3">
                {language === "fr" 
                  ? "Tarif coût d'approvisionnement HQ: ~$0.06/kWh. Les premiers 24 mois créditent votre facture, ensuite HQ vous paie."
                  : "HQ cost of supply rate: ~$0.06/kWh. First 24 months credit your bill, then HQ pays you."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ========== SECTION 2: VALUE PROPOSITION - BIG NUMBERS ========== */}
      <SectionDivider 
        title={language === "fr" ? "Votre investissement" : "Your Investment"} 
        icon={DollarSign}
      />

      {/* Hero Value Card - Annual Savings + 25-Year Total (uses displayedScenario with fallback to simulation) */}
      <Card id="pdf-section-value-proposition" className="border-green-500/30 bg-gradient-to-br from-green-500/10 to-transparent overflow-hidden">
        <CardContent className="p-6">
          {(() => {
            const annualSavingsValue = (displayedScenario.annualSavings ?? simulation.annualSavings) || 0;
            const capexNetValue = (displayedScenario.capexNet ?? simulation.capexNet) || 0;
            const paybackYears = (displayedScenario.simplePaybackYears ?? simulation.simplePaybackYears) || 0;
            const irrValue = (displayedScenario.irr25 ?? simulation.irr25) || 0;
            const lifetimeSavings = annualSavingsValue * 25;
            const gicRate = 4.5;
            
            return (
              <>
                <div className="grid md:grid-cols-2 gap-8 items-center">
                  <div className="text-center md:text-left">
                    <p className="text-sm text-muted-foreground mb-1">
                      {language === "fr" ? "Économies cumulées sur 25 ans" : "Cumulative Savings over 25 Years"}
                    </p>
                    <p className="text-5xl font-bold font-mono text-green-600 dark:text-green-400" data-testid="text-lifetime-savings">
                      ${lifetimeSavings >= 1000000 
                        ? `${(lifetimeSavings / 1000000).toFixed(1)}M`
                        : `${(lifetimeSavings / 1000).toFixed(0)}k`}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      {language === "fr" 
                        ? `soit $${(annualSavingsValue / 1000).toFixed(0)}k/an dès la 1ère année` 
                        : `or $${(annualSavingsValue / 1000).toFixed(0)}k/year from year 1`}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 bg-background rounded-xl border">
                      <p className="text-xs text-muted-foreground mb-1">{language === "fr" ? "Investissement net" : "Net Investment"}</p>
                      <p className="text-xl font-bold font-mono" data-testid="text-capex-net">
                        {capexNetValue >= 1000000 
                          ? (language === "fr" 
                              ? `${(capexNetValue / 1000000).toFixed(2).replace(".", ",")} M$` 
                              : `$${(capexNetValue / 1000000).toFixed(2)}M`)
                          : `$${(capexNetValue / 1000).toFixed(0)}k`}
                      </p>
                      <p className="text-xs text-green-600">{language === "fr" ? "après incitatifs" : "after incentives"}</p>
                    </div>
                    <div className="text-center p-3 bg-background rounded-xl border">
                      <p className="text-xs text-muted-foreground mb-1">{language === "fr" ? "Retour" : "Payback"}</p>
                      <p className="text-xl font-bold font-mono" data-testid="text-payback-years">{paybackYears.toFixed(1)}</p>
                      <p className="text-xs text-muted-foreground">{language === "fr" ? "années" : "years"}</p>
                    </div>
                    <div className="text-center p-3 bg-background rounded-xl border">
                      <p className="text-xs text-muted-foreground mb-1">{language === "fr" ? "Rendement" : "Return"}</p>
                      <p className="text-xl font-bold font-mono text-primary" data-testid="text-irr-hero">{(irrValue * 100).toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">TRI/IRR</p>
                    </div>
                  </div>
                </div>
                
                {/* ROI Comparison vs GIC/Bonds - Only show when solar outperforms */}
                {irrValue > 0 && (irrValue * 100) > gicRate && (
                  <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">
                          {language === "fr" ? "Comparaison rendement" : "Return Comparison"}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{language === "fr" ? "CPG/Obligations:" : "GIC/Bonds:"}</span>
                          <span className="font-mono font-medium">{gicRate}%</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <ArrowRight className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{language === "fr" ? "Solaire:" : "Solar:"}</span>
                          <span className="font-mono font-bold text-primary">{(irrValue * 100).toFixed(1)}%</span>
                        </div>
                        <Badge variant="secondary" className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                          +{((irrValue * 100) - gicRate).toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </CardContent>
      </Card>

      {/* Before/After HQ Bill Comparison - High Impact Visual (uses displayedScenario with fallback) */}
      {(() => {
        // Calculate estimated annual bill from consumption data - use displayedScenario with fallback to simulation
        const estimatedAnnualBill = (simulation.annualConsumptionKWh || 0) * (assumptions.tariffEnergy || 0.06);
        const annualSavings = (displayedScenario.annualSavings ?? simulation.annualSavings) || 0;
        const estimatedBillAfter = Math.max(0, estimatedAnnualBill - annualSavings);
        const savingsPercent = estimatedAnnualBill > 0 ? Math.round((annualSavings / estimatedAnnualBill) * 100) : 0;
        
        return (
          <Card id="pdf-section-billing" className="border-green-500/30 overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">
                  {language === "fr" ? "Impact sur votre facture Hydro-Québec" : "Impact on your Hydro-Québec bill"}
                </h3>
              </div>
              <div className="grid md:grid-cols-3 gap-6 items-center">
                {/* Before */}
                <div className="text-center p-4 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-800">
                  <p className="text-sm text-muted-foreground mb-1">
                    {language === "fr" ? "Facture actuelle" : "Current bill"}
                  </p>
                  <p className="text-3xl font-bold font-mono text-red-600 dark:text-red-400" data-testid="text-annual-bill-before">
                    ${(estimatedAnnualBill / 1000).toFixed(0)}k
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{language === "fr" ? "/année (énergie)" : "/year (energy)"}</p>
                </div>
                
                {/* Arrow + Savings */}
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
                      -${(annualSavings / 1000).toFixed(0)}k
                    </p>
                  </div>
                </div>
                
                {/* After */}
                <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-xl border border-green-200 dark:border-green-800">
                  <p className="text-sm text-muted-foreground mb-1">
                    {language === "fr" ? "Facture après solaire" : "Bill after solar"}
                  </p>
                  <p className="text-3xl font-bold font-mono text-green-600 dark:text-green-400" data-testid="text-annual-bill-after">
                    ${(estimatedBillAfter / 1000).toFixed(0)}k
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

      {/* Main Financial KPIs with 25/30 Year Toggle */}
      <div className="space-y-4">
        {/* Toggle for extended life analysis */}
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
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-primary" />
                <p className="text-sm text-muted-foreground">
                  {language === "fr" 
                    ? `Profit net ${showExtendedLifeAnalysis ? "30" : "25"} ans` 
                    : `Net Profit ${showExtendedLifeAnalysis ? "30" : "25"} years`}
                </p>
              </div>
              <p className="text-2xl font-bold font-mono text-primary" data-testid="text-npv">
                ${((showExtendedLifeAnalysis ? (simulation.npv30 || simulation.npv25 || 0) : (simulation.npv25 || 0)) / 1000).toFixed(0)}k
              </p>
              {showExtendedLifeAnalysis && simulation.npv30 && simulation.npv25 && (
                <p className="text-xs text-green-600 mt-1">
                  +${(((simulation.npv30 || 0) - (simulation.npv25 || 0)) / 1000).toFixed(0)}k {language === "fr" ? "vs 25 ans" : "vs 25 yrs"}
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-primary" />
                <p className="text-sm text-muted-foreground">
                  {language === "fr" 
                    ? `TRI ${showExtendedLifeAnalysis ? "30" : "25"} ans` 
                    : `IRR ${showExtendedLifeAnalysis ? "30" : "25"} Year`}
                </p>
              </div>
              <p className="text-2xl font-bold font-mono text-primary" data-testid="text-irr">
                {((showExtendedLifeAnalysis ? (simulation.irr30 || simulation.irr25 || 0) : (simulation.irr25 || 0)) * 100).toFixed(1)}%
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
              <p className="text-2xl font-bold font-mono" data-testid="text-lcoe">
                ${(showExtendedLifeAnalysis ? (simulation.lcoe30 || simulation.lcoe || 0) : (simulation.lcoe || 0)).toFixed(3)}
                <span className="text-sm font-normal text-muted-foreground">/kWh</span>
              </p>
              {showExtendedLifeAnalysis && simulation.lcoe30 && simulation.lcoe && (
                <p className="text-xs text-green-600 mt-1">
                  -{((simulation.lcoe - simulation.lcoe30) * 100 / simulation.lcoe).toFixed(0)}% {language === "fr" ? "vs 25 ans" : "vs 25 yrs"}
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
              <p className="text-2xl font-bold font-mono text-green-600" data-testid="text-co2">
                {((simulation.co2AvoidedTonnesPerYear || 0) * (showExtendedLifeAnalysis ? 30 : 25)).toFixed(0)} 
                <span className="text-sm font-normal"> t/{showExtendedLifeAnalysis ? "30" : "25"} {language === "fr" ? "ans" : "yrs"}</span>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ========== SECTION 3: FINANCING OPTIONS ========== */}
      {/* Note: The unified cashflow chart is now integrated in FinancingCalculator */}
      <SectionDivider 
        title={language === "fr" ? "Options de financement" : "Financing Options"} 
        icon={CreditCard}
      />
      
      {/* Financing Options Calculator */}
      <FinancingCalculator simulation={simulation} displayedScenario={displayedScenario} />

      {/* Mid-page CTA Banner */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-transparent to-primary/5">
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <FileSignature className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">
                  {language === "fr" ? "Prêt à passer à l'étape suivante?" : "Ready for the next step?"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {language === "fr" 
                    ? "Demandez une conception détaillée et une soumission ferme" 
                    : "Request detailed engineering and a firm quote"}
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

      {/* ========== SECTION 5: ENVIRONMENTAL IMPACT ========== */}
      <SectionDivider 
        title={language === "fr" ? "Impact environnemental" : "Environmental Impact"} 
        icon={Leaf}
      />

      {/* Environmental Impact Card */}
      <Card className="border-green-500/30 bg-gradient-to-br from-green-500/5 to-transparent">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Leaf className="w-5 h-5 text-green-500" />
            {language === "fr" ? "Votre contribution à l'environnement" : "Your Environmental Contribution"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-background rounded-xl border">
              <Leaf className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <p className="text-3xl font-bold font-mono text-green-600">
                {((simulation.co2AvoidedTonnesPerYear || 0) * 25).toFixed(0)}
              </p>
              <p className="text-sm text-muted-foreground">
                {language === "fr" ? "tonnes CO₂ évitées" : "tonnes CO₂ avoided"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{language === "fr" ? "sur 25 ans" : "over 25 years"}</p>
            </div>
            <div className="text-center p-4 bg-background rounded-xl border">
              <Car className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-3xl font-bold font-mono text-emerald-600">
                {(((simulation.co2AvoidedTonnesPerYear || 0) / 4.6) * 25).toFixed(0)}
              </p>
              <p className="text-sm text-muted-foreground">
                {language === "fr" ? "années-auto retirées" : "car-years removed"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{language === "fr" ? "équivalent" : "equivalent"}</p>
            </div>
            <div className="text-center p-4 bg-background rounded-xl border">
              <TreePine className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-3xl font-bold font-mono text-green-700">
                {Math.round(((simulation.co2AvoidedTonnesPerYear || 0) * 25) / 0.022)}
              </p>
              <p className="text-sm text-muted-foreground">
                {language === "fr" ? "arbres équivalents" : "trees equivalent"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{language === "fr" ? "plantés" : "planted"}</p>
            </div>
            <div className="text-center p-4 bg-background rounded-xl border">
              <Award className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <p className="text-3xl font-bold font-mono text-amber-600">
                {(simulation.selfSufficiencyPercent || 0).toFixed(0)}%
              </p>
              <p className="text-sm text-muted-foreground">
                {language === "fr" ? "énergie verte" : "green energy"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{language === "fr" ? "autosuffisance" : "self-sufficiency"}</p>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm text-green-700 dark:text-green-300 text-center">
              {language === "fr" 
                ? "Ce projet contribue directement aux objectifs ESG de votre entreprise et démontre votre engagement envers le développement durable." 
                : "This project directly contributes to your company's ESG goals and demonstrates your commitment to sustainable development."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ========== SECTION 6: TECHNICAL DETAILS (Collapsible) ========== */}
      <SectionDivider 
        title={language === "fr" ? "Détails techniques" : "Technical Details"} 
        icon={Settings}
      />

      {/* Cross-Validation with Google Solar - Yield-Based Comparison */}
      {site && site.roofAreaAutoDetails && (() => {
        const details = site.roofAreaAutoDetails as any;
        const solarPotential = details?.solarPotential;
        const panelConfigs = solarPotential?.solarPanelConfigs;
        const panelWatts = solarPotential?.panelCapacityWatts || 400;
        
        if (!panelConfigs || panelConfigs.length === 0) return null;
        
        // Find the MAX config from Google (their largest possible)
        const ourPvKw = simulation.pvSizeKW || 0;
        const maxConfig = panelConfigs.reduce((max: any, config: any) => 
          config.panelsCount > (max?.panelsCount || 0) ? config : max, panelConfigs[0]);
        
        const googleMaxPvKw = (maxConfig.panelsCount * panelWatts) / 1000;
        const googleProdDc = maxConfig.yearlyEnergyDcKwh || 0;
        const googleProdAc = googleProdDc * 0.85; // Assume 85% DC-to-AC efficiency
        
        // Calculate our production from hourly profile
        const hourlyProfile = simulation.hourlyProfile as HourlyProfileEntry[] | null;
        let ourAnnualProd = 0;
        if (hourlyProfile && hourlyProfile.length > 0) {
          ourAnnualProd = hourlyProfile.reduce((sum, h) => sum + (h.production || 0), 0);
        }
        
        // Calculate specific yield (kWh/kWp) - THE KEY METRIC
        const googleYield = googleMaxPvKw > 0 ? googleProdAc / googleMaxPvKw : 0;
        const ourYield = ourPvKw > 0 ? ourAnnualProd / ourPvKw : 0;
        
        // YIELD difference is the meaningful comparison (not total production!)
        const yieldDiffPercent = googleYield > 0 ? ((ourYield - googleYield) / googleYield * 100) : 0;
        const isYieldWithinMargin = Math.abs(yieldDiffPercent) <= 20; // Within 20% is acceptable for yields
        
        // Detect system size mismatch (>50% difference = Google API limitation)
        const sizeMismatchRatio = ourPvKw > 0 && googleMaxPvKw > 0 ? ourPvKw / googleMaxPvKw : 1;
        const hasSignificantSizeMismatch = sizeMismatchRatio > 1.5; // Our system is 50%+ larger
        const isGoogleMaxTooSmall = googleMaxPvKw < 50; // Google caps at residential scale
        
        // Calibration guidance based on yield difference
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
              {/* System Size Mismatch Warning */}
              {hasSignificantSizeMismatch && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-blue-800">
                        {language === "fr" 
                          ? "Différence de taille de système importante" 
                          : "Significant System Size Difference"}
                      </p>
                      <p className="text-blue-700 mt-1">
                        {language === "fr" 
                          ? `Votre système de ${ourPvKw.toFixed(0)} kW est ${sizeMismatchRatio.toFixed(1)}× plus grand que la configuration max de Google (${googleMaxPvKw.toFixed(1)} kW). Google Solar API est optimisé pour les toitures résidentielles et plafonne généralement à 25-50 kW.`
                          : `Your ${ourPvKw.toFixed(0)} kW system is ${sizeMismatchRatio.toFixed(1)}× larger than Google's max config (${googleMaxPvKw.toFixed(1)} kW). Google Solar API is optimized for residential rooftops and typically caps at 25-50 kW.`}
                      </p>
                      <p className="text-blue-600 mt-2 font-medium">
                        {language === "fr" 
                          ? "→ Comparez le rendement spécifique (kWh/kWc), pas la production totale."
                          : "→ Compare specific yield (kWh/kWp), not total production."}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Primary Metric: Specific Yield Comparison */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">
                    {language === "fr" ? "Notre rendement" : "Our Yield"}
                  </p>
                  <p className="text-2xl font-bold font-mono">{Math.round(ourYield)}</p>
                  <p className="text-xs text-muted-foreground">kWh/kWp</p>
                </div>
                <div className="text-center p-4 bg-primary/10 rounded-lg border border-primary/20">
                  <p className="text-xs text-muted-foreground mb-1">
                    {language === "fr" ? "Google Solar" : "Google Solar"}
                  </p>
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
              
              {/* Secondary: System Size Context */}
              <div className="mt-4 p-3 bg-muted/20 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{language === "fr" ? "Notre système" : "Our system"}</span>
                    <span className="font-mono font-medium">{ourPvKw.toFixed(1)} kWc</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{language === "fr" ? "Google max config" : "Google max config"}</span>
                    <span className="font-mono">{googleMaxPvKw.toFixed(1)} kWc ({maxConfig.panelsCount} pan.)</span>
                  </div>
                </div>
                
                {/* Calibrated production estimate using Google's yield */}
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
                        <span className="font-mono">{Math.round(ourAnnualProd).toLocaleString()} kWh/an</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{language === "fr" ? "Basé sur rendement Google" : "Based on Google yield"}</span>
                        <span className="font-mono text-primary">{Math.round(ourPvKw * googleYield).toLocaleString()} kWh/an</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {language === "fr" 
                        ? `Votre système de ${ourPvKw.toFixed(0)} kWc × rendement Google de ${Math.round(googleYield)} kWh/kWc = ${Math.round(ourPvKw * googleYield).toLocaleString()} kWh/an`
                        : `Your ${ourPvKw.toFixed(0)} kWp system × Google yield of ${Math.round(googleYield)} kWh/kWp = ${Math.round(ourPvKw * googleYield).toLocaleString()} kWh/yr`}
                    </p>
                  </div>
                )}
                
                {!hasSignificantSizeMismatch && (
                  <div className="mt-2 pt-2 border-t border-dashed text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{language === "fr" ? "Notre prod." : "Our prod."}</span>
                        <span className="font-mono">{Math.round(ourAnnualProd).toLocaleString()} kWh/an</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{language === "fr" ? "Google prod." : "Google prod."}</span>
                        <span className="font-mono">{Math.round(googleProdAc).toLocaleString()} kWh/an</span>
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

      {/* Average Profile Chart - Full Width */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {language === "fr" ? "Profil moyen (Avant vs Après)" : "Average Profile (Before vs After)"}
          </CardTitle>
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
                  {/* Consumption bars */}
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
                  {/* Peak lines */}
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
      
      {/* Financial Breakdown */}
      {breakdown && (
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
                      <span className="text-sm">{language === "fr" ? "Solaire PV" : "Solar PV"}</span>
                      <span className="font-mono text-sm">${((breakdown.capexSolar || 0) / 1000).toFixed(1)}k</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">{language === "fr" ? "Batterie" : "Battery"}</span>
                      <span className="font-mono text-sm">${((breakdown.capexBattery || 0) / 1000).toFixed(1)}k</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-sm font-medium">{language === "fr" ? "CAPEX brut" : "Gross CAPEX"}</span>
                      <span className="font-mono text-sm font-bold">${((breakdown.capexGross || 0) / 1000).toFixed(1)}k</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    {language === "fr" ? "Incitatifs" : "Incentives"}
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">{language === "fr" ? "Hydro-Québec (solaire)" : "HQ Solar"}</span>
                      <span className="font-mono text-sm text-primary">-${((breakdown.actualHQSolar || 0) / 1000).toFixed(1)}k</span>
                    </div>
                    {(breakdown.actualHQBattery || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">
                          {language === "fr" ? "HQ (crédit stockage jumelé)" : "HQ (paired storage credit)"}
                        </span>
                        <span className="font-mono text-sm text-primary">-${((breakdown.actualHQBattery || 0) / 1000).toFixed(1)}k</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-sm">{language === "fr" ? "CII fédéral (30%)" : "Federal ITC (30%)"}</span>
                      <span className="font-mono text-sm text-primary">-${((breakdown.itcAmount || 0) / 1000).toFixed(1)}k</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">{language === "fr" ? "Bouclier fiscal (DPA)" : "Tax Shield (CCA)"}</span>
                      <span className="font-mono text-sm text-primary">-${((breakdown.taxShield || 0) / 1000).toFixed(1)}k</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-sm font-medium">{language === "fr" ? "CAPEX net" : "Net CAPEX"}</span>
                      <span className="font-mono text-sm font-bold">${((breakdown.capexNet || 0) / 1000).toFixed(1)}k</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">{language === "fr" ? "Autosuffisance" : "Self-sufficiency"}</p>
                    <p className="text-lg font-bold font-mono">{(simulation.selfSufficiencyPercent || 0).toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">LCOE</p>
                    <p className="text-lg font-bold font-mono">${(simulation.lcoe || 0).toFixed(3)}/kWh</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{language === "fr" ? "VAN 25 ans" : "NPV 25 years"}</p>
                    <p className="text-lg font-bold font-mono">${((simulation.npv25 || 0) / 1000).toFixed(0)}k</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{language === "fr" ? "TRI 25 ans" : "IRR 25 years"}</p>
                    <p className="text-lg font-bold font-mono">{((simulation.irr25 || 0) * 100).toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Section: Analysis & Optimization */}
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
              <h4 className="text-sm font-semibold mb-4">
                {language === "fr" ? "Frontière d'efficacité (tous scénarios)" : "Efficiency Frontier (all scenarios)"}
              </h4>
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
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      className="text-xs"
                    />
                    <YAxis 
                      type="number" 
                      dataKey="npv25" 
                      name={language === "fr" ? "VAN" : "NPV"}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      className="text-xs"
                    />
                    <ZAxis type="number" range={[60, 200]} />
                    {/* Profitability threshold line */}
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
                          ? `${pvKW}kW PV + ${battKWh}kWh`
                          : actualType === 'solar'
                            ? `${pvKW}kW PV`
                            : `${battKWh}kWh`;
                        
                        return (
                          <div className="bg-card border rounded-lg p-2 shadow-lg">
                            <p className="text-sm font-medium">
                              <span className="inline-block w-2 h-2 rounded-full mr-1.5" 
                                style={{ backgroundColor: actualType === 'solar' ? '#FFB005' : actualType === 'battery' ? '#003DA6' : '#22C55E' }} 
                              />
                              {typeLabel}: {sizingLabel}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {language === "fr" ? "Investissement" : "Investment"}: ${(point.capexNet / 1000).toFixed(1)}k
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {language === "fr" ? "VAN 25 ans" : "NPV 25 years"}: ${(point.npv25 / 1000).toFixed(1)}k
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
                    {/* Solar points - single series with opacity based on profitability */}
                    <Scatter
                      name={language === "fr" ? "Solaire" : "Solar"}
                      data={(simulation.sensitivity as SensitivityAnalysis).frontier.filter(p => p.type === 'solar' && !p.isOptimal)}
                      fill="#FFB005"
                      shape={(props: any) => {
                        const { cx, cy, payload } = props;
                        const fillOpacity = payload.npv25 >= 0 ? 1 : 0.25;
                        return (
                          <circle 
                            cx={cx} 
                            cy={cy} 
                            r={6} 
                            fill="#FFB005" 
                            fillOpacity={fillOpacity}
                            style={{ cursor: isStaff ? 'pointer' : 'default' }}
                            data-testid={`scatter-solar-${payload.pvSizeKW}`}
                            onClick={(e) => {
                              if (isStaff) {
                                e.stopPropagation();
                                e.preventDefault();
                                handleChartPointClick({ payload }, 0);
                              }
                            }}
                          />
                        );
                      }}
                    />
                    {/* Storage points */}
                    <Scatter
                      name={language === "fr" ? "Stockage" : "Storage"}
                      data={(simulation.sensitivity as SensitivityAnalysis).frontier.filter(p => p.type === 'battery' && !p.isOptimal)}
                      fill="#003DA6"
                      shape={(props: any) => {
                        const { cx, cy, payload } = props;
                        const fillOpacity = payload.npv25 >= 0 ? 1 : 0.25;
                        return (
                          <circle 
                            cx={cx} 
                            cy={cy} 
                            r={6} 
                            fill="#003DA6" 
                            fillOpacity={fillOpacity}
                            style={{ cursor: isStaff ? 'pointer' : 'default' }}
                            data-testid={`scatter-battery-${payload.battEnergyKWh}`}
                            onClick={(e) => {
                              if (isStaff) {
                                e.stopPropagation();
                                e.preventDefault();
                                handleChartPointClick({ payload }, 0);
                              }
                            }}
                          />
                        );
                      }}
                    />
                    {/* Hybrid points - PV sweep (varies PV at fixed battery) */}
                    <Scatter
                      name={language === "fr" ? "PV variable" : "PV sweep"}
                      data={(simulation.sensitivity as SensitivityAnalysis).frontier.filter(p => p.type === 'hybrid' && !p.isOptimal && p.sweepSource === 'pvSweep')}
                      fill="#22C55E"
                      shape={(props: any) => {
                        const { cx, cy, payload } = props;
                        const fillOpacity = payload.npv25 >= 0 ? 1 : 0.25;
                        return (
                          <circle 
                            cx={cx} 
                            cy={cy} 
                            r={6} 
                            fill="#22C55E" 
                            fillOpacity={fillOpacity}
                            style={{ cursor: isStaff ? 'pointer' : 'default' }}
                            data-testid={`scatter-hybrid-pv-${payload.pvSizeKW}-${payload.battEnergyKWh}`}
                            onClick={(e) => {
                              if (isStaff) {
                                e.stopPropagation();
                                e.preventDefault();
                                handleChartPointClick({ payload }, 0);
                              }
                            }}
                          />
                        );
                      }}
                    />
                    {/* Hybrid points - Battery sweep (varies battery at fixed PV) */}
                    <Scatter
                      name={language === "fr" ? "Batterie variable" : "Battery sweep"}
                      data={(simulation.sensitivity as SensitivityAnalysis).frontier.filter(p => p.type === 'hybrid' && !p.isOptimal && p.sweepSource === 'battSweep')}
                      fill="#10B981"
                      shape={(props: any) => {
                        const { cx, cy, payload } = props;
                        const fillOpacity = payload.npv25 >= 0 ? 1 : 0.25;
                        return (
                          <rect 
                            x={cx - 5} 
                            y={cy - 5} 
                            width={10} 
                            height={10} 
                            fill="#10B981" 
                            fillOpacity={fillOpacity}
                            rx={2}
                            style={{ cursor: isStaff ? 'pointer' : 'default' }}
                            data-testid={`scatter-hybrid-batt-${payload.pvSizeKW}-${payload.battEnergyKWh}`}
                            onClick={(e) => {
                              if (isStaff) {
                                e.stopPropagation();
                                e.preventDefault();
                                handleChartPointClick({ payload }, 0);
                              }
                            }}
                          />
                        );
                      }}
                    />
                    {/* Legacy hybrid points without sweepSource (backwards compatibility) */}
                    <Scatter
                      name={language === "fr" ? "Hybride" : "Hybrid"}
                      data={(simulation.sensitivity as SensitivityAnalysis).frontier.filter(p => p.type === 'hybrid' && !p.isOptimal && !p.sweepSource)}
                      fill="#22C55E"
                      shape={(props: any) => {
                        const { cx, cy, payload } = props;
                        const fillOpacity = payload.npv25 >= 0 ? 1 : 0.25;
                        return (
                          <circle 
                            cx={cx} 
                            cy={cy} 
                            r={6} 
                            fill="#22C55E" 
                            fillOpacity={fillOpacity}
                            style={{ cursor: isStaff ? 'pointer' : 'default' }}
                            data-testid={`scatter-hybrid-${payload.pvSizeKW}-${payload.battEnergyKWh}`}
                            onClick={(e) => {
                              if (isStaff) {
                                e.stopPropagation();
                                e.preventDefault();
                                handleChartPointClick({ payload }, 0);
                              }
                            }}
                          />
                        );
                      }}
                    />
                    {/* Optimal point highlighted with special marker - uses corrected type color with star shape */}
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
                                      actualType === 'battery' ? '#003DA6' : '#22C55E';
                        return (
                          <g 
                            style={{ cursor: isStaff ? 'pointer' : 'default' }}
                            data-testid={`scatter-optimal-${pvKW}-${battKWh}`}
                            onClick={(e) => {
                              if (isStaff) {
                                e.stopPropagation();
                                e.preventDefault();
                                handleChartPointClick({ payload }, 0);
                              }
                            }}
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
              {/* Legend clarification */}
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                {/* Only show PV sweep legend if there are PV sweep hybrid points */}
                {(simulation.sensitivity as SensitivityAnalysis).frontier.some(p => p.sweepSource === 'pvSweep') && (
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#22C55E' }}></div>
                    <span>{language === "fr" ? "PV variable (batterie fixe)" : "PV sweep (fixed battery)"}</span>
                  </div>
                )}
                {/* Only show Battery sweep legend if there are battery sweep hybrid points */}
                {(simulation.sensitivity as SensitivityAnalysis).frontier.some(p => p.sweepSource === 'battSweep') && (
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#10B981' }}></div>
                    <span>{language === "fr" ? "Batterie variable (PV fixe)" : "Battery sweep (fixed PV)"}</span>
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
              {/* Warning if no profitable scenario */}
              {(() => {
                const optimal = (simulation.sensitivity as SensitivityAnalysis).frontier.find(p => p.isOptimal);
                if (optimal && optimal.npv25 > 0) return null; // Profitable - recommendation shown at top
                
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
              
              {/* Strategic Benefits Section - Simplified: Resilience, Autonomy, Property Value */}
              {(() => {
                const optimal = (simulation.sensitivity as SensitivityAnalysis).frontier.find(p => p.isOptimal);
                if (!optimal) return null;
                
                const pvKW = optimal.pvSizeKW || 0;
                const battKWh = optimal.battEnergyKWh || 0;
                const battPowerKW = optimal.battPowerKW || 0;
                
                const avgLoadKW = battPowerKW > 0 ? battPowerKW * 0.5 : (simulation.peakDemandKW ? simulation.peakDemandKW * 0.3 : 0);
                const backupHours = (battKWh > 0 && avgLoadKW > 0) ? (battKWh / avgLoadKW) : 0;
                
                const selfSufficiency = simulation.selfSufficiencyPercent 
                  ? simulation.selfSufficiencyPercent 
                  : (pvKW > 0 ? Math.min(40, pvKW / 10) : 0);
                
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
                      {/* Energy Resilience */}
                      {hasBattery && backupHours > 0 && (
                        <div className="p-3 bg-background rounded-lg border">
                          <div className="flex items-center gap-2 mb-1">
                            <Shield className="w-4 h-4 text-blue-500" />
                            <span className="text-xs font-medium">
                              {language === "fr" ? "Résilience" : "Resilience"}
                            </span>
                          </div>
                          <p className="text-lg font-bold font-mono text-blue-600">
                            {backupHours >= 1 ? `${backupHours.toFixed(1)}h` : `${Math.round(backupHours * 60)}min`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {language === "fr" ? "autonomie estimée" : "estimated backup"}
                          </p>
                        </div>
                      )}
                      
                      {/* ESG / Sustainability - Autonomy % */}
                      {hasSolar && (
                        <div className="p-3 bg-background rounded-lg border">
                          <div className="flex items-center gap-2 mb-1">
                            <Award className="w-4 h-4 text-amber-500" />
                            <span className="text-xs font-medium">
                              {language === "fr" ? "Autonomie énergétique" : "Energy Independence"}
                            </span>
                          </div>
                          <p className="text-lg font-bold font-mono text-amber-600">
                            {selfSufficiency.toFixed(0)}%
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {language === "fr" ? "de vos besoins" : "of your needs"}
                          </p>
                        </div>
                      )}
                      
                      {/* Property Value */}
                      {hasSolar && propertyValueIncrease > 0 && (
                        <div className="p-3 bg-background rounded-lg border">
                          <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="w-4 h-4 text-purple-500" />
                            <span className="text-xs font-medium">
                              {language === "fr" ? "Valeur immo." : "Property Value"}
                            </span>
                          </div>
                          <p className="text-lg font-bold font-mono text-purple-600">
                            {propertyValueIncrease >= 1000 
                              ? `+$${(propertyValueIncrease / 1000).toFixed(0)}k`
                              : `+$${propertyValueIncrease.toFixed(0)}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {language === "fr" 
                              ? `~$1k/kWc (études sectorielles)` 
                              : `~$1k/kW (industry studies)`}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {/* Rate Protection Sensitivity Note */}
                    <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded text-xs">
                      <div className="flex items-start gap-2">
                        <TrendingDown className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-medium text-amber-700 dark:text-amber-400">
                            {language === "fr" ? "Protection tarifaire:" : "Rate Protection:"}
                          </span>
                          <span className="text-amber-600 dark:text-amber-300 ml-1">
                            {language === "fr" 
                              ? `Si Hydro-Québec augmente de +6%/an au lieu de +4.8%/an, la rentabilité s'améliore significativement.` 
                              : `If Hydro-Québec increases +6%/year instead of +4.8%/year, profitability improves significantly.`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Solar and Battery Optimization Charts - Side by Side */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Solar Size Optimization */}
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
                      <XAxis 
                        dataKey="pvSizeKW" 
                        className="text-xs"
                        label={{ 
                          value: language === "fr" ? "Solaire (kWc)" : "Solar (kWp)", 
                          position: "bottom",
                          offset: 0,
                          style: { fontSize: 11 }
                        }}
                      />
                      <YAxis 
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                        className="text-xs"
                        label={{ 
                          value: language === "fr" ? "VAN" : "NPV", 
                          angle: -90, 
                          position: "insideLeft",
                          style: { fontSize: 11 }
                        }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px"
                        }}
                        formatter={(value: number) => [`$${(value / 1000).toFixed(1)}k`, language === "fr" ? "VAN 25 ans" : "NPV 25 years"]}
                        labelFormatter={(v) => `${v} kWc`}
                      />
                      <ReferenceLine 
                        y={0} 
                        stroke="hsl(var(--destructive))" 
                        strokeDasharray="5 5" 
                        strokeWidth={1.5}
                        label={{ 
                          value: language === "fr" ? "Seuil rentabilité" : "Breakeven", 
                          position: "right",
                          fontSize: 10,
                          fill: "hsl(var(--muted-foreground))"
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="npv25" 
                        stroke="#FFB005" 
                        strokeWidth={2}
                        dot={(props: any) => {
                          const { cx, cy, payload } = props;
                          const isProfitable = payload.npv25 >= 0;
                          const isOptimal = payload.isOptimal;
                          return (
                            <circle
                              cx={cx}
                              cy={cy}
                              r={isOptimal ? 8 : 4}
                              fill={isProfitable ? "#FFB005" : "#FFB005"}
                              fillOpacity={isProfitable ? 1 : 0.3}
                              stroke={isOptimal ? "#000" : "none"}
                              strokeWidth={isOptimal ? 2 : 0}
                            />
                          );
                        }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {/* Find and display optimal solar point */}
                {(() => {
                  const solarSweep = (simulation.sensitivity as SensitivityAnalysis).solarSweep;
                  const optimalSolar = solarSweep.reduce((best, curr) => 
                    (curr.npv25 > (best?.npv25 || -Infinity)) ? curr : best, solarSweep[0]);
                  if (optimalSolar && optimalSolar.npv25 > 0) {
                    return (
                      <p className="text-xs text-muted-foreground mt-2">
                        {language === "fr" ? "Optimal: " : "Optimal: "}
                        <span className="font-medium text-foreground">{optimalSolar.pvSizeKW} kWc</span>
                        {language === "fr" ? " → VAN " : " → NPV "}
                        <span className="font-medium text-primary">${(optimalSolar.npv25 / 1000).toFixed(1)}k</span>
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

              {/* Storage Size Optimization - Shows hybrid economics at configured PV */}
              <div>
                <h4 className="text-sm font-semibold mb-4">
                  {language === "fr" ? "Optimisation taille stockage (VAN vs kWh)" : "Storage Size Optimization (NPV vs kWh)"}
                </h4>
                <p className="text-xs text-muted-foreground -mt-3 mb-3">
                  {language === "fr" 
                    ? `VAN selon la taille du stockage` 
                    : `NPV vs storage capacity`}
                </p>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart 
                      data={(simulation.sensitivity as SensitivityAnalysis).batterySweep}
                      margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="battEnergyKWh" 
                        className="text-xs"
                        label={{ 
                          value: language === "fr" ? "Stockage (kWh)" : "Storage (kWh)", 
                          position: "bottom",
                          offset: 0,
                          style: { fontSize: 11 }
                        }}
                      />
                      <YAxis 
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                        className="text-xs"
                        label={{ 
                          value: language === "fr" ? "VAN" : "NPV", 
                          angle: -90, 
                          position: "insideLeft",
                          style: { fontSize: 11 }
                        }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px"
                        }}
                        formatter={(value: number) => [`$${(value / 1000).toFixed(1)}k`, language === "fr" ? "VAN 25 ans" : "NPV 25 years"]}
                        labelFormatter={(v) => `${v} kWh`}
                      />
                      <ReferenceLine 
                        y={0} 
                        stroke="hsl(var(--destructive))" 
                        strokeDasharray="5 5" 
                        strokeWidth={1.5}
                        label={{ 
                          value: language === "fr" ? "Seuil rentabilité" : "Breakeven", 
                          position: "right",
                          fontSize: 10,
                          fill: "hsl(var(--muted-foreground))"
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="npv25" 
                        stroke="#003DA6" 
                        strokeWidth={2}
                        dot={(props: any) => {
                          const { cx, cy, payload } = props;
                          const isProfitable = payload.npv25 >= 0;
                          return (
                            <circle
                              cx={cx}
                              cy={cy}
                              r={4}
                              fill={isProfitable ? "#003DA6" : "#003DA6"}
                              fillOpacity={isProfitable ? 1 : 0.3}
                            />
                          );
                        }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {/* Find and display optimal battery point */}
                {(() => {
                  const batterySweep = (simulation.sensitivity as SensitivityAnalysis).batterySweep;
                  const optimalBattery = batterySweep.reduce((best, curr) => 
                    (curr.npv25 > (best?.npv25 || -Infinity)) ? curr : best, batterySweep[0]);
                  if (optimalBattery && optimalBattery.npv25 > 0) {
                    return (
                      <p className="text-xs text-muted-foreground mt-2">
                        {language === "fr" ? "Optimal: " : "Optimal: "}
                        <span className="font-medium text-foreground">{optimalBattery.battEnergyKWh} kWh</span>
                        {language === "fr" ? " → VAN " : " → NPV "}
                        <span className="font-medium text-primary">${(optimalBattery.npv25 / 1000).toFixed(1)}k</span>
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
              const bifacialBoost = assumptions.bifacialEnabled ? 1.15 : 1.0;
              const grossYield = Math.round(baseYield * orientationFactor * bifacialBoost);
              
              // Calculate net yield from actual simulation data
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
                      {assumptions.bifacialEnabled && <span className="text-primary ml-1">(+15%)</span>}
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
              <p className="font-mono">{(assumptions.discountRate * 100).toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">{language === "fr" ? "Surface toit" : "Roof area"}</p>
              <p className="font-mono">{assumptions.roofAreaSqFt.toLocaleString()} pi²</p>
            </div>
            <div>
              <p className="text-muted-foreground">{language === "fr" ? "Utilisation toit" : "Roof utilization"}</p>
              <p className="font-mono">{(assumptions.roofUtilizationRatio * 100).toFixed(0)}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">{language === "fr" ? "Inflation HQ" : "HQ Inflation"}</p>
              <p className="font-mono">{(assumptions.inflationRate * 100).toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">{language === "fr" ? "Taux imposition" : "Tax rate"}</p>
              <p className="font-mono">{(assumptions.taxRate * 100).toFixed(1)}%</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Monte Carlo Probabilistic Analysis */}
      {isStaff && site?.id && (
        <MonteCarloAnalysis 
          siteId={site.id} 
          hasMeterData={(site?.meterFiles?.length || 0) > 0}
        />
      )}
      
      {/* Data Quality Indicator - Interpolated Months */}
      {interpolatedMonths.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30">
          <CardContent className="py-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  {language === "fr" 
                    ? "Données interpolées" 
                    : "Interpolated Data"}
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

      {/* ========== FINAL SECTION: NEXT STEPS CTA ========== */}
      <SectionDivider 
        title={language === "fr" ? "Prochaines étapes" : "Next Steps"} 
        icon={FileSignature}
      />

      {/* Next Steps CTA Card - Final Call to Action */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent" id="next-steps-cta">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <FileSignature className="w-6 h-6 text-primary" />
            {language === "fr" ? "Prêt à passer à l'action?" : "Ready to Take Action?"}
          </CardTitle>
          <CardDescription>
            {language === "fr" 
              ? "Signez l'entente de conception et d'ingénierie pour démarrer votre projet solaire" 
              : "Sign the Design & Engineering Agreement to start your solar project"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-bold">1</span>
              </div>
              <div>
                <h4 className="font-medium">{language === "fr" ? "Entente de conception" : "Design Agreement"}</h4>
                <p className="text-sm text-muted-foreground">
                  {language === "fr" 
                    ? "Notre équipe prépare les plans détaillés et la liste d'équipements" 
                    : "Our team prepares detailed plans and equipment specifications"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-bold">2</span>
              </div>
              <div>
                <h4 className="font-medium">{language === "fr" ? "Soumission finale" : "Final Quote"}</h4>
                <p className="text-sm text-muted-foreground">
                  {language === "fr" 
                    ? "Vous recevez une soumission détaillée avec prix fermes garantis" 
                    : "You receive a detailed quote with guaranteed firm pricing"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-bold">3</span>
              </div>
              <div>
                <h4 className="font-medium">{language === "fr" ? "Installation" : "Installation"}</h4>
                <p className="text-sm text-muted-foreground">
                  {language === "fr" 
                    ? "Nous gérons l'installation clé en main et les demandes de subventions" 
                    : "We manage turnkey installation and incentive applications"}
                </p>
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
            {isStaff ? (
              <Button 
                size="lg" 
                className="gap-2 px-8" 
                onClick={onNavigateToDesignAgreement}
                data-testid="button-cta-create-design"
              >
                <FileSignature className="w-5 h-5" />
                {language === "fr" ? "Créer l'entente de design" : "Create Design Agreement"}
              </Button>
            ) : (
              <Button size="lg" className="gap-2 px-8" data-testid="button-cta-sign-agreement">
                <FileSignature className="w-5 h-5" />
                {language === "fr" ? "Signer l'entente" : "Sign Agreement"}
              </Button>
            )}
            <Button variant="outline" size="lg" className="gap-2" data-testid="button-cta-contact">
              <Phone className="w-5 h-5" />
              {language === "fr" ? "Nous contacter" : "Contact Us"}
            </Button>
          </div>
          
          <p className="text-center text-xs text-muted-foreground mt-4">
            {language === "fr" 
              ? "L'entente de conception est sans engagement pour le projet complet. Frais de conception: 2 500$ + taxes (crédité si vous procédez)." 
              : "The design agreement is non-binding for the full project. Design fee: $2,500 + taxes (credited if you proceed)."}
          </p>
        </CardContent>
      </Card>

      {/* PDF-only Environmental Impact Section - Hidden from view but captured for PDF */}
      <div id="pdf-section-environment" aria-hidden="true" tabIndex={-1} data-testid="pdf-section-environment" className="bg-white p-6 rounded-lg" style={{ position: 'absolute', left: '-9999px', top: '0', pointerEvents: 'none' }}>
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-green-700 mb-2">
            {language === "fr" ? "Impact environnemental" : "Environmental Impact"}
          </h2>
          <p className="text-gray-600">
            {language === "fr" 
              ? "Votre contribution à un avenir durable" 
              : "Your contribution to a sustainable future"}
          </p>
        </div>
        
        <div className="grid grid-cols-3 gap-6 mb-6">
          <div className="text-center p-5 bg-green-50 rounded-xl border border-green-200">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-green-100 flex items-center justify-center">
              <Leaf className="w-7 h-7 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-700 mb-1" data-testid="text-co2-avoided-total">
              {((simulation.co2AvoidedTonnesPerYear || 0) * 25).toFixed(0)}
            </p>
            <p className="text-sm font-medium text-green-800">
              {language === "fr" ? "tonnes CO₂" : "tonnes CO₂"}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {language === "fr" ? "évitées sur 25 ans" : "avoided over 25 years"}
            </p>
          </div>
          
          <div className="text-center p-5 bg-green-50 rounded-xl border border-green-200">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-green-100 flex items-center justify-center">
              <TreePine className="w-7 h-7 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-700 mb-1" data-testid="text-trees-equivalent">
              {Math.round((simulation.co2AvoidedTonnesPerYear || 0) * 25 * 45)}
            </p>
            <p className="text-sm font-medium text-green-800">
              {language === "fr" ? "arbres équivalents" : "equivalent trees"}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {language === "fr" ? "plantés pendant 10 ans" : "planted for 10 years"}
            </p>
          </div>
          
          <div className="text-center p-5 bg-green-50 rounded-xl border border-green-200">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-green-100 flex items-center justify-center">
              <Car className="w-7 h-7 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-700 mb-1" data-testid="text-cars-off-road">
              {Math.round((simulation.co2AvoidedTonnesPerYear || 0) * 25 / 4.6)}
            </p>
            <p className="text-sm font-medium text-green-800">
              {language === "fr" ? "voitures retirées" : "cars off the road"}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {language === "fr" ? "pendant un an" : "for one year"}
            </p>
          </div>
        </div>
        
        <div className="bg-green-700 text-white p-5 rounded-lg">
          <p className="text-center text-sm">
            {language === "fr" 
              ? "En choisissant l'énergie solaire, vous contribuez activement à la transition énergétique du Québec et à la réduction des émissions de gaz à effet de serre." 
              : "By choosing solar energy, you are actively contributing to Quebec's energy transition and the reduction of greenhouse gas emissions."}
          </p>
        </div>
      </div>

      {/* PDF-only About kWh Québec Section - Hidden from view but captured for PDF */}
      <div id="pdf-section-about" aria-hidden="true" tabIndex={-1} data-testid="pdf-section-about" className="bg-white p-6 rounded-lg" style={{ position: 'absolute', left: '-9999px', top: '0', pointerEvents: 'none' }}>
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-[#003DA6] mb-2">
            {language === "fr" ? "À propos de kWh Québec" : "About kWh Québec"}
          </h2>
          <p className="text-gray-600">
            {language === "fr" 
              ? "Votre partenaire de confiance en énergie solaire" 
              : "Your trusted solar energy partner"}
          </p>
        </div>
        
        <div className="grid grid-cols-3 gap-6 mb-6">
          <div className="text-center p-4 border rounded-lg">
            <p className="text-3xl font-bold text-[#003DA6]">10+</p>
            <p className="text-sm text-gray-600 mt-1">
              {language === "fr" ? "années d'expérience" : "years of experience"}
            </p>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <p className="text-3xl font-bold text-[#003DA6]">500+</p>
            <p className="text-sm text-gray-600 mt-1">
              {language === "fr" ? "projets réalisés" : "completed projects"}
            </p>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <p className="text-3xl font-bold text-[#003DA6]">50 MW+</p>
            <p className="text-sm text-gray-600 mt-1">
              {language === "fr" ? "capacité installée" : "installed capacity"}
            </p>
          </div>
        </div>
        
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-[#003DA6] mb-3">
            {language === "fr" ? "Notre expertise" : "Our Expertise"}
          </h3>
          <ul className="text-sm text-gray-700 space-y-2">
            <li>• {language === "fr" ? "Conception et ingénierie de systèmes solaires commerciaux et industriels" : "Commercial and industrial solar system design and engineering"}</li>
            <li>• {language === "fr" ? "Installation clé en main et gestion de projet" : "Turnkey installation and project management"}</li>
            <li>• {language === "fr" ? "Accompagnement pour les subventions et le financement" : "Support for grants and financing"}</li>
            <li>• {language === "fr" ? "Service après-vente et maintenance" : "After-sales service and maintenance"}</li>
          </ul>
        </div>
        
        <div className="bg-[#003DA6] text-white p-5 rounded-lg text-center">
          <h3 className="font-semibold mb-2">
            {language === "fr" ? "Contactez-nous" : "Contact Us"}
          </h3>
          <p className="text-sm opacity-90">
            info@kwhquebec.com | 1-888-kWh-SOLAR
          </p>
          <p className="text-sm opacity-90 mt-1">
            www.kwhquebec.com
          </p>
        </div>
      </div>

      {/* PDF-only Disclaimers Section - Hidden from view but captured for PDF */}
      <div id="pdf-section-disclaimers" aria-hidden="true" tabIndex={-1} data-testid="pdf-section-disclaimers" className="bg-white p-6 rounded-lg" style={{ position: 'absolute', left: '-9999px', top: '0', pointerEvents: 'none' }}>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-800 mb-1">
            {language === "fr" ? "Avis importants" : "Important Notices"}
          </h2>
          <div className="h-0.5 w-16 bg-[#FFB005]"></div>
        </div>
        
        <div className="space-y-4 text-sm text-gray-700">
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="font-semibold text-yellow-800 mb-1">
              {language === "fr" ? "Validité de l'estimation" : "Estimate Validity"}
            </p>
            <p className="text-yellow-700">
              {language === "fr" 
                ? `Cette estimation préliminaire est valide pour une période de 30 jours à compter de la date du rapport. Les conditions du marché et les prix des équipements peuvent varier.`
                : `This preliminary estimate is valid for a period of 30 days from the report date. Market conditions and equipment prices may vary.`}
            </p>
          </div>
          
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="font-semibold text-gray-800 mb-1">
              {language === "fr" ? "Nature préliminaire" : "Preliminary Nature"}
            </p>
            <p>
              {language === "fr" 
                ? "Ce rapport constitue une estimation préliminaire basée sur les informations disponibles. Les calculs de production solaire sont basés sur des données météorologiques historiques et peuvent varier selon les conditions réelles. Les économies présentées sont des projections et ne constituent pas une garantie."
                : "This report constitutes a preliminary estimate based on available information. Solar production calculations are based on historical weather data and may vary according to actual conditions. The savings presented are projections and do not constitute a guarantee."}
            </p>
          </div>
          
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="font-semibold text-gray-800 mb-1">
              {language === "fr" ? "Visite de site requise" : "Site Visit Required"}
            </p>
            <p>
              {language === "fr" 
                ? "Le prix final et les spécifications techniques définitives dépendent d'une visite de site et d'une évaluation détaillée. Des facteurs tels que l'état de la toiture, l'infrastructure électrique existante et les conditions d'accès peuvent influencer le coût final du projet."
                : "The final price and definitive technical specifications depend on a site visit and detailed assessment. Factors such as roof condition, existing electrical infrastructure, and access conditions may influence the final project cost."}
            </p>
          </div>
          
          <div className="text-xs text-gray-500 mt-4 pt-4 border-t border-gray-200">
            <p className="mb-2">
              {language === "fr" 
                ? "© kWh Québec - Tous droits réservés. Ce document est confidentiel et destiné uniquement au destinataire."
                : "© kWh Québec - All rights reserved. This document is confidential and intended only for the recipient."}
            </p>
            <p>
              {language === "fr" 
                ? "Les informations contenues dans ce rapport sont protégées par le droit d'auteur et ne peuvent être reproduites sans autorisation écrite."
                : "The information contained in this report is protected by copyright and may not be reproduced without written permission."}
            </p>
          </div>
        </div>
      </div>

      {/* PDF-only Design Agreement CTA Section - Hidden from view but captured for PDF */}
      <div id="pdf-section-service-offer" aria-hidden="true" tabIndex={-1} className="bg-white p-6 rounded-lg" style={{ position: 'absolute', left: '-9999px', top: '0', pointerEvents: 'none' }}>
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-[#003DA6] mb-2">
            {language === "fr" ? "Prochaine étape: Entente de conception" : "Next Step: Design Agreement"}
          </h2>
          <p className="text-gray-600">
            {language === "fr" 
              ? "Passez à l'action pour concrétiser votre projet solaire" 
              : "Take action to make your solar project a reality"}
          </p>
        </div>
        
        <div className="grid grid-cols-3 gap-6 mb-6">
          <div className="text-center p-4 border rounded-lg">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#003DA6]/10 flex items-center justify-center">
              <span className="text-xl font-bold text-[#003DA6]">1</span>
            </div>
            <h4 className="font-semibold mb-2">{language === "fr" ? "Conception détaillée" : "Detailed Design"}</h4>
            <p className="text-sm text-gray-600">
              {language === "fr" 
                ? "Plans d'ingénierie et spécifications techniques" 
                : "Engineering plans and technical specifications"}
            </p>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#003DA6]/10 flex items-center justify-center">
              <span className="text-xl font-bold text-[#003DA6]">2</span>
            </div>
            <h4 className="font-semibold mb-2">{language === "fr" ? "Soumission ferme" : "Firm Quote"}</h4>
            <p className="text-sm text-gray-600">
              {language === "fr" 
                ? "Prix garantis et calendrier d'exécution" 
                : "Guaranteed pricing and execution timeline"}
            </p>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#003DA6]/10 flex items-center justify-center">
              <span className="text-xl font-bold text-[#003DA6]">3</span>
            </div>
            <h4 className="font-semibold mb-2">{language === "fr" ? "Installation clé en main" : "Turnkey Installation"}</h4>
            <p className="text-sm text-gray-600">
              {language === "fr" 
                ? "Gestion complète du projet et subventions" 
                : "Complete project management and incentives"}
            </p>
          </div>
        </div>
        
        <div className="bg-[#003DA6] text-white p-6 rounded-lg text-center">
          <p className="text-lg font-semibold mb-2">
            {language === "fr" ? "Frais de conception: 2 500$ + taxes" : "Design Fee: $2,500 + taxes"}
          </p>
          <p className="text-sm opacity-90 mb-4">
            {language === "fr" 
              ? "Crédité intégralement si vous procédez avec l'installation" 
              : "Fully credited if you proceed with installation"}
          </p>
          <div className="inline-block bg-[#FFB005] text-[#003DA6] font-bold px-8 py-3 rounded-lg">
            {language === "fr" ? "Contactez-nous pour démarrer" : "Contact us to get started"}
          </div>
        </div>
        
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>{language === "fr" ? "Questions?" : "Questions?"} info@kwhquebec.com | 1-800-XXX-XXXX</p>
        </div>
      </div>
      
      {/* Externally controlled Create Variant Dialog for chart click-to-create */}
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

export default function SiteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, language } = useI18n();
  const { toast } = useToast();
  const { isStaff, isClient, token } = useAuth();
  const [activeTab, setActiveTab] = useState("consumption");
  const [customAssumptions, setCustomAssumptions] = useState<Partial<AnalysisAssumptions>>({});
  const assumptionsInitializedRef = useRef(false);
  const [selectedSimulationId, setSelectedSimulationId] = useState<string | null>(null);
  const pendingNewSimulationIdRef = useRef<string | null>(null); // Track newly created simulation ID across data refresh
  const [bifacialDialogOpen, setBifacialDialogOpen] = useState(false);
  const [isRoofDrawingModalOpen, setIsRoofDrawingModalOpen] = useState(false);
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);
  const [pendingModalOpen, setPendingModalOpen] = useState(false);
  const [optimizationTarget, setOptimizationTarget] = useState<'npv' | 'irr' | 'selfSufficiency' | 'payback'>('npv');
  
  // Smart "Refresh + Deliverables" state machine
  type RefreshPhase = 'idle' | 'analyzing' | 'pdf' | 'pptx' | 'complete' | 'error';
  const [refreshPhase, setRefreshPhase] = useState<RefreshPhase>('idle');
  const [refreshError, setRefreshError] = useState<string | null>(null);
  
  // Quick potential analysis state
  interface QuickPotentialResult {
    roofAnalysis: {
      totalRoofAreaSqM: number;
      usableRoofAreaSqM: number;
      utilizationRatio: number;
      polygonCount: number;
    };
    systemSizing: {
      maxCapacityKW: number;
      numPanels: number;
      panelPowerW: number;
    };
    production: {
      annualProductionKWh: number;
      annualProductionMWh: number;
      yieldKWhPerKWp: number;
    };
    financial: {
      costPerW: number;
      pricingTier: string;
      estimatedCapex: number;
      estimatedAnnualSavings: number;
      simplePaybackYears: number;
    };
  }
  const [quickPotential, setQuickPotential] = useState<QuickPotentialResult | null>(null);
  
  // Geometry-based capacity from RoofVisualization (more accurate than backend estimate)
  const [geometryCapacity, setGeometryCapacity] = useState<{ 
    maxCapacityKW: number; 
    panelCount: number; 
    realisticCapacityKW: number; 
    constraintAreaSqM: number;
  } | null>(null);
  
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
      const res = await fetch(`/api/sites/${id}/design-agreement`, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch agreement");
      return res.json();
    },
    enabled: !!id && isStaff,
  });

  // Effect to open roof drawing modal after site data is refreshed with coordinates
  useEffect(() => {
    if (pendingModalOpen && site?.latitude && site?.longitude) {
      setPendingModalOpen(false);
      setIsRoofDrawingModalOpen(true);
    }
  }, [pendingModalOpen, site?.latitude, site?.longitude]);

  // Initialize assumptions from site data when loaded (only once per page load)
  useEffect(() => {
    if (site && !assumptionsInitializedRef.current) {
      const initialAssumptions: Partial<AnalysisAssumptions> = {};
      
      // Priority: 1. Saved assumptions, 2. Auto-detected (Google Solar), 3. Manual entry
      // First check for auto-detected roof area from Google Solar API
      if (site.roofAreaAutoSqM && site.roofAreaAutoSqM > 0 && site.roofEstimateStatus === "success") {
        initialAssumptions.roofAreaSqFt = Math.round(site.roofAreaAutoSqM * 10.764);
      }
      // Fallback to manually entered roof area
      else if (site.roofAreaSqM && site.roofAreaSqM > 0) {
        initialAssumptions.roofAreaSqFt = Math.round(site.roofAreaSqM * 10.764);
      }
      
      // Auto-detect tariff code based on peak demand from simulation data
      // Tariff G: < 65 kW, Tariff M: >= 65 kW
      if (site.simulationRuns && site.simulationRuns.length > 0) {
        // Get peak demand from most recent simulation that has it
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
      
      // Load saved assumptions from site if they exist (overrides auto-detected)
      if (site.analysisAssumptions) {
        const savedAssumptions = site.analysisAssumptions as Partial<AnalysisAssumptions>;
        Object.assign(initialAssumptions, savedAssumptions);
      }
      
      if (Object.keys(initialAssumptions).length > 0) {
        setCustomAssumptions(initialAssumptions);
      }
      // Mark as initialized using ref (persists across re-renders, won't trigger useEffect again)
      assumptionsInitializedRef.current = true;
    }
  }, [site]);

  const runAnalysisMutation = useMutation({
    mutationFn: async (customAssumptionsOverrides: Partial<AnalysisAssumptions>) => {
      // Merge with defaults to ensure all parameters are sent
      const mergedAssumptions: AnalysisAssumptions = { 
        ...defaultAnalysisAssumptions, 
        ...customAssumptionsOverrides 
      };
      // CRITICAL: Don't send yieldSource from frontend - let server determine it 
      // based on whether Google Solar API data is available
      // This prevents overwriting the server's 'google' yieldSource with 'default'
      delete (mergedAssumptions as any).yieldSource;
      
      // Wrap assumptions in the expected format for the API
      // apiRequest returns parsed JSON directly
      const result = await apiRequest<{ id?: string }>("POST", `/api/sites/${id}/run-potential-analysis`, { assumptions: mergedAssumptions });
      return result;
    },
    onSuccess: (data) => {
      // Store the new simulation ID in ref so it survives through data refresh
      if (data?.id) {
        pendingNewSimulationIdRef.current = data.id;
      } else {
        // Mark that we want the latest simulation
        pendingNewSimulationIdRef.current = "__latest__";
      }
      queryClient.invalidateQueries({ queryKey: ["/api/sites", id] });
      toast({ title: language === "fr" ? "Analyse terminée avec succès" : "Analysis completed successfully" });
      setActiveTab("analysis");
    },
    onError: () => {
      toast({ title: language === "fr" ? "Erreur lors de l'analyse" : "Error during analysis", variant: "destructive" });
    },
  });

  // Quick potential analysis mutation (roof-only, no consumption data needed)
  const quickPotentialMutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest<{ success: boolean } & QuickPotentialResult>("POST", `/api/sites/${id}/quick-potential`);
      return result;
    },
    onSuccess: (data) => {
      setQuickPotential(data);
      toast({ 
        title: language === "fr" ? "Analyse rapide terminée" : "Quick analysis complete",
        description: language === "fr" 
          ? `Potentiel: ${data.systemSizing.maxCapacityKW} kW / ${data.production.annualProductionMWh} MWh/an`
          : `Potential: ${data.systemSizing.maxCapacityKW} kW / ${data.production.annualProductionMWh} MWh/year`
      });
    },
    onError: () => {
      toast({ 
        title: language === "fr" ? "Erreur lors de l'analyse rapide" : "Error during quick analysis", 
        variant: "destructive" 
      });
    },
  });

  // Smart "Refresh + Deliverables" handler - chains analysis → PDF → PPTX
  const handleRefreshAndDeliverables = async () => {
    if (!site || !site.roofAreaValidated) return;
    
    setRefreshPhase('analyzing');
    setRefreshError(null);
    
    try {
      // Phase 1: Run analysis
      const mergedAssumptions: AnalysisAssumptions = { 
        ...defaultAnalysisAssumptions, 
        ...customAssumptions 
      };
      delete (mergedAssumptions as any).yieldSource;
      
      const result = await apiRequest<{ id?: string }>("POST", `/api/sites/${id}/run-potential-analysis`, { assumptions: mergedAssumptions });
      const newSimId = result?.id;
      
      if (!newSimId) {
        throw new Error("No simulation ID returned");
      }
      
      // Refresh site data
      await queryClient.invalidateQueries({ queryKey: ["/api/sites", id] });
      
      toast({ 
        title: language === "fr" ? "Analyse terminée" : "Analysis complete",
        description: language === "fr" ? "Génération des livrables..." : "Generating deliverables..."
      });
      
      // Phase 2: Download PDF
      setRefreshPhase('pdf');
      const token = localStorage.getItem("token");
      
      const pdfResponse = await fetch(`/api/simulation-runs/${newSimId}/pdf?lang=${language}`, {
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
      
      // Phase 3: Download PPTX
      setRefreshPhase('pptx');
      const pptxResponse = await fetch(`/api/simulation-runs/${newSimId}/presentation-pptx?lang=${language}`, {
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
      
      setRefreshPhase('complete');
      toast({ 
        title: language === "fr" ? "Livrables générés" : "Deliverables generated",
        description: language === "fr" ? "PDF et PowerPoint téléchargés" : "PDF and PowerPoint downloaded"
      });
      
      setActiveTab("analysis");
      
      // Reset phase after a short delay
      setTimeout(() => setRefreshPhase('idle'), 2000);
      
    } catch (error) {
      setRefreshPhase('error');
      setRefreshError(error instanceof Error ? error.message : "Unknown error");
      toast({ 
        title: language === "fr" ? "Erreur" : "Error", 
        variant: "destructive" 
      });
      setTimeout(() => setRefreshPhase('idle'), 3000);
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
      // Mark roof as validated after saving polygons
      await apiRequest("PATCH", `/api/sites/${id}`, {
        roofAreaValidated: true,
        roofAreaValidatedAt: new Date().toISOString(),
      });
      return polygons;
    },
    onSuccess: (polygons) => {
      queryClient.invalidateQueries({ queryKey: ['/api/sites', id, 'roof-polygons'] });
      queryClient.invalidateQueries({ queryKey: ["/api/sites", id] });
      toast({ title: language === "fr" ? "Zones de toit sauvegardées" : "Roof areas saved" });
      // Update local roof area state
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

  // Callback to handle saving roof polygons
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

  // Find the most recent simulation by created_at from ALL simulations (not just validated ones)
  const allSimulations = site?.simulationRuns || [];
  const mostRecentSimulationFromAll = allSimulations.length > 0
    ? allSimulations.reduce((latest, current) => {
        const latestDate = latest.createdAt ? new Date(latest.createdAt).getTime() : 0;
        const currentDate = current.createdAt ? new Date(current.createdAt).getTime() : 0;
        return currentDate > latestDate ? current : latest;
      })
    : null;

  // Initialize selected simulation with the best scenario when site loads
  // Also handle pending new simulation selection after data refresh
  useEffect(() => {
    // First, check if we have a pending simulation to select (from newly created analysis)
    if (pendingNewSimulationIdRef.current && site?.simulationRuns && site.simulationRuns.length > 0) {
      const pendingId = pendingNewSimulationIdRef.current;
      
      if (pendingId === "__latest__") {
        // Select the most recent simulation from ALL simulations
        // If we have simulations, just pick the most recent one (by index 0 since they're often sorted by date desc)
        // or find the one with the latest createdAt
        const mostRecent = mostRecentSimulationFromAll || site.simulationRuns[0];
        if (mostRecent) {
          setSelectedSimulationId(mostRecent.id);
          pendingNewSimulationIdRef.current = null;
          return;
        }
      } else {
        // Check if the simulation with this ID exists in the refreshed data (search ALL simulations)
        const foundSimulation = site.simulationRuns.find(s => s.id === pendingId);
        if (foundSimulation) {
          setSelectedSimulationId(pendingId);
          pendingNewSimulationIdRef.current = null;
          return;
        }
        // Simulation not found yet - keep waiting (don't exit, continue to initial selection as fallback)
      }
    }
    
    // Initial selection: most recent simulation when site first loads (user expects to see their latest work)
    if (site && mostRecentSimulationFromAll && !selectedSimulationId) {
      setSelectedSimulationId(mostRecentSimulationFromAll.id);
    }
  }, [site, mostRecentSimulationFromAll, selectedSimulationId]);

  // The simulation to display - either selected one or fallback to latest/best
  const latestSimulation = selectedSimulationId && selectedSimulationId !== "__latest__"
    ? site?.simulationRuns?.find(s => s.id === selectedSimulationId)
    : (mostRecentSimulationFromAll || bestScenarioByNPV || site?.simulationRuns?.find(s => s.type === "SCENARIO") || site?.simulationRuns?.[0]);

  // Auto-fetch full simulation data when viewing analysis tab
  useEffect(() => {
    if (activeTab === "analysis") {
      // Determine which simulation to fetch (selected or latest)
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
    // Return lightweight version if full not loaded yet
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
              {(site.address || site.city || site.province) && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {[site.address, site.city, site.province, site.postalCode].filter(Boolean).join(", ")}
                </span>
              )}
              {/* Roof Estimation Status Badge */}
              {site.roofEstimateStatus === "pending" && (
                <span className="flex items-center gap-1 text-primary">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {language === "fr" ? "Estimation toit..." : "Estimating roof..."}
                </span>
              )}
              {site.roofEstimateStatus === "success" && site.roofAreaAutoSqM && (
                <span className="flex items-center gap-1 text-green-600">
                  <Satellite className="w-3.5 h-3.5" />
                  {language === "fr" 
                    ? `Toit: ${Math.round(site.roofAreaAutoSqM)} m²`
                    : `Roof: ${Math.round(site.roofAreaAutoSqM)} m²`}
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
              {/* Quick Potential Button - available after roof validation, no consumption data needed */}
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
              <Button 
                onClick={() => runAnalysisMutation.mutate(customAssumptions)}
                disabled={runAnalysisMutation.isPending || !site.roofAreaValidated || refreshPhase !== 'idle'}
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
              <Button 
                variant="outline"
                onClick={handleRefreshAndDeliverables}
                disabled={runAnalysisMutation.isPending || !site.roofAreaValidated || refreshPhase !== 'idle'}
                className="gap-2"
                data-testid="button-refresh-deliverables"
              >
                {refreshPhase === 'analyzing' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {language === "fr" ? "Analyse..." : "Analyzing..."}
                  </>
                ) : refreshPhase === 'pdf' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    PDF...
                  </>
                ) : refreshPhase === 'pptx' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    PPTX...
                  </>
                ) : refreshPhase === 'complete' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    {language === "fr" ? "Terminé" : "Done"}
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    {language === "fr" ? "Analyse + Livrables" : "Analyze + Deliverables"}
                  </>
                )}
              </Button>
            </>
          )}
          {/* Presentation Mode Button */}
          <Link href={`/app/presentation/${site.id}`}>
            <Button variant="outline" className="gap-2" data-testid="button-presentation-mode">
              <Layers className="w-4 h-4" />
              {language === "fr" ? "Présentation" : "Presentation"}
            </Button>
          </Link>
          {latestSimulation && (
            <>
              <DownloadReportButton 
                simulationId={latestSimulation.id}
                siteName={site.name}
                clientName={site.client?.name}
                location={[site.city, site.province].filter(Boolean).join(", ")}
                onSwitchToAnalysis={() => setActiveTab("analysis")}
              />
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
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Capacity - use geometry values when available (more accurate) */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Sun className="w-4 h-4" />
                  {language === "fr" ? "Capacité estimée" : "Estimated Capacity"}
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {(geometryCapacity?.realisticCapacityKW ?? Math.round((quickPotential.systemSizing.maxCapacityKW) * 0.9)).toLocaleString()} kW
                </div>
                <div className="text-xs text-muted-foreground">
                  {language === "fr" ? "Max:" : "Max:"} {(geometryCapacity?.maxCapacityKW ?? quickPotential.systemSizing.maxCapacityKW).toLocaleString()} kW
                  {geometryCapacity?.constraintAreaSqM && geometryCapacity.constraintAreaSqM > 0 && (
                    <span className="ml-1 text-orange-500">
                      (-{Math.round(geometryCapacity.constraintAreaSqM)} m² {language === "fr" ? "contraintes" : "constraints"})
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {(geometryCapacity?.panelCount ?? quickPotential.systemSizing.numPanels).toLocaleString()} {language === "fr" ? "panneaux" : "panels"} • -10% {language === "fr" ? "marge obstacles" : "obstacle margin"}
                </div>
              </div>
              
              {/* Production */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Zap className="w-4 h-4" />
                  {language === "fr" ? "Production annuelle" : "Annual Production"}
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {quickPotential.production.annualProductionMWh.toLocaleString()} MWh
                </div>
                <div className="text-xs text-muted-foreground">
                  {quickPotential.production.yieldKWhPerKWp} kWh/kWp
                </div>
              </div>
              
              {/* Investment */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <DollarSign className="w-4 h-4" />
                  {language === "fr" ? "Investissement estimé" : "Estimated Investment"}
                </div>
                <div className="text-2xl font-bold text-foreground">
                  ${(quickPotential.financial.estimatedCapex / 1000000).toFixed(2)}M
                </div>
                <div className="text-xs text-muted-foreground">
                  ${quickPotential.financial.costPerW.toFixed(2)}/W
                </div>
              </div>
              
              {/* Payback */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <TrendingUp className="w-4 h-4" />
                  {language === "fr" ? "Retour simple" : "Simple Payback"}
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {quickPotential.financial.simplePaybackYears} {language === "fr" ? "ans" : "years"}
                </div>
                <div className="text-xs text-muted-foreground">
                  ~${(quickPotential.financial.estimatedAnnualSavings / 1000).toFixed(0)}k/{language === "fr" ? "an" : "year"}
                </div>
              </div>
            </div>
            
            {/* Roof info */}
            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Grid3X3 className="w-4 h-4" />
                  {language === "fr" ? "Surface totale:" : "Total area:"} {quickPotential.roofAnalysis.totalRoofAreaSqM.toLocaleString()} m²
                </span>
                <span>
                  {language === "fr" ? "Surface utilisable:" : "Usable area:"} {quickPotential.roofAnalysis.usableRoofAreaSqM.toLocaleString()} m² ({Math.round(quickPotential.roofAnalysis.utilizationRatio * 100)}%)
                </span>
                <span>
                  {quickPotential.roofAnalysis.polygonCount} {language === "fr" ? "zone(s) de toit" : "roof zone(s)"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Roof Visualization with Panels - shown after quick potential is calculated */}
      {quickPotential && site && site.latitude && site.longitude && import.meta.env.VITE_GOOGLE_MAPS_API_KEY && (
        <RoofVisualization
          siteId={id!}
          siteName={site.name}
          address={site.address || ""}
          latitude={site.latitude}
          longitude={site.longitude}
          roofAreaSqFt={quickPotential.roofAnalysis.totalRoofAreaSqM * 10.764} 
          maxPVCapacityKW={quickPotential.systemSizing.maxCapacityKW}
          onGeometryCalculated={setGeometryCapacity}
        />
      )}

      {/* Process Tabs with progression indicators */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        {/* Custom process step navigation with chevrons and status indicators */}
        <div className="flex flex-wrap items-center gap-2" role="presentation">
          <div className="flex flex-wrap items-center bg-muted/50 rounded-lg p-1 gap-1 flex-1">
            {/* Build tabs array based on user role with step completion status */}
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
                  label: language === "fr" ? "Entente de design" : "Design Agreement", 
                  showAlways: false,
                  status: hasDesignAgreement ? "complete" : hasAnalysis ? "available" : "pending"
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
          
          {/* Separate Activities button - not part of the process flow */}
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
          {isStaff && <TabsTrigger value="design-agreement">{language === "fr" ? "Entente de design" : "Design Agreement"}</TabsTrigger>}
          {isStaff && <TabsTrigger value="activities">{t("activity.title")}</TabsTrigger>}
          <TabsTrigger value="compare">{language === "fr" ? "Comparer" : "Compare"}</TabsTrigger>
        </TabsList>

        <TabsContent value="consumption" className="space-y-6">
          {/* Upload Zone - Staff only */}
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

          {/* Analysis Parameters - always show for roof estimation, full params when files exist */}
          {isStaff && (
            <AnalysisParametersEditor 
              value={customAssumptions}
              onChange={setCustomAssumptions}
              disabled={runAnalysisMutation.isPending || !site.roofAreaValidated}
              site={site}
              onSiteRefresh={() => refetch()}
              showOnlyRoofSection={!site.meterFiles?.length}
              onOpenRoofDrawing={() => setIsRoofDrawingModalOpen(true)}
              roofPolygons={roofPolygons}
            />
          )}

          {/* Structural Constraints - Staff only */}
          {isStaff && (
            <StructuralConstraintsEditor 
              site={site}
              onUpdate={() => refetch()}
            />
          )}

          {/* Single Bill Estimator - Staff only, when no files */}
          {isStaff && (!site.meterFiles || site.meterFiles.length === 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {language === "fr" ? "Pas de fichiers CSV?" : "No CSV files?"}
                </CardTitle>
                <CardDescription>
                  {language === "fr" 
                    ? "Estimez la consommation annuelle à partir d'une seule facture Hydro-Québec"
                    : "Estimate annual consumption from a single Hydro-Québec bill"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SingleBillEstimator 
                  onEstimate={(monthlyData) => {
                    const totalKWh = monthlyData.reduce((sum, d) => sum + d.consumption, 0);
                    toast({
                      title: language === "fr" ? "Profil généré" : "Profile generated",
                      description: language === "fr" 
                        ? `Consommation estimée: ${(totalKWh / 1000).toFixed(0)} MWh/an`
                        : `Estimated consumption: ${(totalKWh / 1000).toFixed(0)} MWh/year`,
                    });
                  }}
                />
              </CardContent>
            </Card>
          )}

          {/* Load Profile Editor - Staff only, when files exist and simulation is available */}
          {isStaff && site.meterFiles && site.meterFiles.length > 0 && latestSimulation && (() => {
            // Try to extract monthly data from hourlyProfile if available
            const hourlyProfile = latestSimulation.hourlyProfile as Array<{hour: number; month: number; consumption: number}> | null;
            let monthlyData: Array<{month: number; consumption: number}>;
            
            if (hourlyProfile && Array.isArray(hourlyProfile) && hourlyProfile.length > 0) {
              // Aggregate hourly data by month
              const monthTotals: Record<number, number> = {};
              for (const entry of hourlyProfile) {
                const m = entry.month - 1; // 0-indexed
                monthTotals[m] = (monthTotals[m] || 0) + (entry.consumption || 0);
              }
              monthlyData = Array.from({length: 12}, (_, m) => ({
                month: m,
                consumption: Math.round(monthTotals[m] || 0),
              }));
            } else {
              // Fallback: derive from annual data with Quebec seasonal profile
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
                  // Store modified profile in customAssumptions for next analysis run
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
          {runAnalysisMutation.isPending ? (
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
              {/* Compare scenarios button - only show when there are multiple simulation runs */}
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

        {/* Site Visit Tab - Staff only */}
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

        {/* Design Agreement Tab - Staff only */}
        {isStaff && (
          <TabsContent value="design-agreement" className="space-y-6">
            <DesignAgreementSection siteId={site.id} />
          </TabsContent>
        )}

        {/* Activities Tab - Staff only */}
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
