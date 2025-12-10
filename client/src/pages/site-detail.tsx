import { useState, useCallback, useEffect, Fragment, useRef, useMemo } from "react";
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
  XCircle
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
  HourlyProfileEntry
} from "@shared/schema";
import { defaultAnalysisAssumptions } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoadProfileEditor, SingleBillEstimator, KPIDashboard } from "@/components/consumption-tools";
import type { Site, Client, MeterFile, SimulationRun } from "@shared/schema";

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
  showOnlyRoofSection = false
}: { 
  value: Partial<AnalysisAssumptions>; 
  onChange: (value: Partial<AnalysisAssumptions>) => void;
  disabled?: boolean;
  site?: Site;
  onSiteRefresh?: () => void;
  showOnlyRoofSection?: boolean;
}) {
  const { language } = useI18n();
  const { token } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isEstimating, setIsEstimating] = useState(false);
  const [showResetButton, setShowResetButton] = useState(false);
  const [pendingStartTime] = useState<number>(() => Date.now());

  // Detect stale "pending" status - show reset button after 15 seconds
  useEffect(() => {
    if (site?.roofEstimateStatus === "pending" && !isEstimating) {
      const timer = setTimeout(() => {
        setShowResetButton(true);
      }, 15000);
      return () => clearTimeout(timer);
    } else {
      setShowResetButton(false);
    }
  }, [site?.roofEstimateStatus, isEstimating]);

  // Reset stale pending status
  const handleResetStatus = async () => {
    if (!site || !token) return;
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
      }
    } catch (error) {
      console.error("Failed to reset status:", error);
    }
  };

  const merged: AnalysisAssumptions = { ...defaultAnalysisAssumptions, ...value };

  // Roof estimation mutation with 20-second timeout
  const handleRoofEstimate = async () => {
    if (!site || !token) return;
    
    setIsEstimating(true);
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
                const bifacialBoost = merged.bifacialEnabled 
                  ? (1 + (merged.bifacialityFactor || 0.85) * (merged.roofAlbedo || 0.70) * 0.35)
                  : 1.0;
                const grossYield = Math.round(baseYield * orientationFactor * bifacialBoost);
                const bifacialLabel = merged.bifacialEnabled 
                  ? ` (+${Math.round((bifacialBoost - 1) * 100)}% bifacial)`
                  : "";
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
              <div className="grid grid-cols-4 gap-3 pt-2 border-t border-dashed">
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
                  <Label className="text-xs">{language === "fr" ? "Pertes câblage (%)" : "Wire Losses (%)"}</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    max="10"
                    value={((merged.wireLossPercent || 0.02) * 100).toFixed(1)}
                    onChange={(e) => updateField("wireLossPercent", (parseFloat(e.target.value) || 2) / 100)}
                    disabled={disabled}
                    className="h-8 text-sm font-mono"
                    data-testid="input-wire-loss"
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
                  ? "Modélisation avancée: ILR typique 1.1-1.5, pertes câblage 1-3%, dégradation 0.5%/an"
                  : "Advanced modeling: Typical ILR 1.1-1.5, wire losses 1-3%, degradation 0.5%/yr"}
              </p>
              
              {/* Bifacial PV Section */}
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
                        ? (language === "fr" ? "Activé" : "Enabled")
                        : (language === "fr" ? "Désactivé" : "Disabled")}
                    </span>
                  </div>
                </div>
                
                {merged.bifacialEnabled && (
                  <>
                    <p className="text-xs text-muted-foreground">
                      {language === "fr"
                        ? "Les panneaux bifaciaux captent la lumière des deux côtés, augmentant le rendement sur les toits à membrane blanche."
                        : "Bifacial panels capture light from both sides, increasing yield on white membrane roofs."}
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">{language === "fr" ? "Bifacialité (%)" : "Bifaciality (%)"}</Label>
                        <Input
                          type="number"
                          step="1"
                          min="70"
                          max="95"
                          value={Math.round((merged.bifacialityFactor || 0.85) * 100)}
                          onChange={(e) => updateField("bifacialityFactor", (parseInt(e.target.value) || 85) / 100)}
                          disabled={disabled}
                          className="h-8 text-sm font-mono"
                          data-testid="input-bifaciality-factor"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">{language === "fr" ? "Albédo du toit" : "Roof Albedo"}</Label>
                        <select
                          value={(merged.roofAlbedo || 0.70).toFixed(2)}
                          onChange={(e) => updateField("roofAlbedo", parseFloat(e.target.value) || 0.70)}
                          disabled={disabled}
                          className="h-8 w-full text-sm font-mono rounded-md border border-input bg-background px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ring"
                          data-testid="select-roof-albedo"
                        >
                          <option value="0.70">{language === "fr" ? "Blanc (0.70)" : "White (0.70)"}</option>
                          <option value="0.50">{language === "fr" ? "Clair (0.50)" : "Light (0.50)"}</option>
                          <option value="0.20">{language === "fr" ? "Gravier (0.20)" : "Gravel (0.20)"}</option>
                          <option value="0.10">{language === "fr" ? "Sombre (0.10)" : "Dark (0.10)"}</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">{language === "fr" ? "Prime coût ($/W)" : "Cost Premium ($/W)"}</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="0.50"
                          value={(merged.bifacialCostPremium || 0.10).toFixed(2)}
                          onChange={(e) => updateField("bifacialCostPremium", parseFloat(e.target.value) || 0.10)}
                          disabled={disabled}
                          className="h-8 text-sm font-mono"
                          data-testid="input-bifacial-cost-premium"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      {language === "fr"
                        ? `Gain estimé: +${Math.round((merged.bifacialityFactor || 0.85) * (merged.roofAlbedo || 0.70) * 0.35 * 100)}% rendement`
                        : `Estimated gain: +${Math.round((merged.bifacialityFactor || 0.85) * (merged.roofAlbedo || 0.70) * 0.35 * 100)}% yield`}
                    </p>
                  </>
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
                            className="h-6 text-xs ml-auto text-destructive hover:text-destructive"
                            data-testid="button-reset-roof-status"
                          >
                            <XCircle className="w-3 h-3 mr-1" />
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
                    (() => {
                      const details = site.roofAreaAutoDetails as any;
                      const segments = details?.solarPotential?.roofSegmentStats;
                      const maxSunshine = details?.solarPotential?.maxSunshineHoursPerYear;
                      const panelConfigs = details?.solarPotential?.solarPanelConfigs;
                      const bestConfig = panelConfigs?.[panelConfigs.length - 1];
                      const panelWatts = details?.solarPotential?.panelCapacityWatts || 400;
                      
                      if (!segments || segments.length === 0) return null;
                      
                      return (
                        <div className="p-2 rounded-lg border border-dashed bg-muted/30 space-y-2">
                          <div className="flex items-center gap-2">
                            <Layers className="w-3.5 h-3.5 text-primary" />
                            <span className="text-xs font-medium">
                              {language === "fr" ? "Segments de toit détectés" : "Detected Roof Segments"}
                            </span>
                            <Badge variant="secondary" className="text-xs h-5">
                              {segments.length} {language === "fr" ? "segments" : "segments"}
                            </Badge>
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
                          
                          {/* Google production estimate */}
                          {bestConfig && (
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
                          )}
                        </div>
                      );
                    })()
                  )}
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">{language === "fr" ? "Surface de toit (pi²)" : "Roof Area (sq ft)"}</Label>
                    {site?.roofAreaAutoSqM && site.roofEstimateStatus === "success" && (
                      <span className="text-[10px] text-muted-foreground">
                        {language === "fr" ? `Satellite: ${Math.round(site.roofAreaAutoSqM * 10.764).toLocaleString()} pi²` : `Satellite: ${Math.round(site.roofAreaAutoSqM * 10.764).toLocaleString()} sqft`}
                      </span>
                    )}
                  </div>
                  <Input
                    type="number"
                    step="100"
                    value={merged.roofAreaSqFt}
                    onChange={(e) => updateField("roofAreaSqFt", parseFloat(e.target.value) || 0)}
                    disabled={disabled}
                    className="h-8 text-sm font-mono"
                    data-testid="input-roof-area"
                  />
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
                        {language === "fr" ? "Bâtiment C&I de grande taille" : "Large C&I building"}
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
  location 
}: { 
  simulationId: string;
  siteName: string;
  clientName?: string;
  location?: string;
}) {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { downloadClientPDF } = await import("@/lib/clientPdfGenerator");
      await downloadClientPDF(siteName, clientName, location, language);
      toast({ title: language === "fr" ? "Rapport téléchargé" : "Report downloaded" });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({ title: language === "fr" ? "Erreur lors du téléchargement" : "Download error", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Button variant="outline" className="gap-2" onClick={handleDownload} disabled={downloading} data-testid="button-download-report">
      <Download className="w-4 h-4" />
      {downloading ? "..." : t("site.downloadReport")}
    </Button>
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
    })),
    [validScenarios]
  );
  
  // Memoize best value calculations
  const { bestNPV, bestIRR, bestPayback } = useMemo(() => {
    const validNPVs = comparisonData.filter(d => d.npv25 > 0).map(d => d.npv25);
    const validPaybacks = comparisonData.filter(d => d.payback > 0).map(d => d.payback);
    const validIRRs = comparisonData.filter(d => d.irr25 > 0).map(d => d.irr25);
    return {
      bestNPV: validNPVs.length > 0 ? Math.max(...validNPVs) : null,
      bestIRR: validIRRs.length > 0 ? Math.max(...validIRRs) : null,
      bestPayback: validPaybacks.length > 0 ? Math.min(...validPaybacks) : null,
    };
  }, [comparisonData]);

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
          {/* Visual Side-by-Side Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {comparisonData.slice(0, 3).map((scenario, index) => {
              const isBestNPV = bestNPV !== null && scenario.npv25 === bestNPV;
              const isBestPayback = bestPayback !== null && scenario.payback > 0 && scenario.payback === bestPayback;
              const isBestIRR = bestIRR !== null && scenario.irr25 === bestIRR;
              
              return (
                <div 
                  key={scenario.id}
                  className={`relative rounded-xl border-2 p-4 transition-all ${
                    isBestNPV ? 'border-green-500 bg-green-50/50 dark:bg-green-950/20' : 'border-muted hover:border-primary/50'
                  }`}
                  data-testid={`card-scenario-${index}`}
                >
                  {isBestNPV && (
                    <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-green-500 text-white border-green-500">
                      {language === "fr" ? "Meilleur VAN" : "Best NPV"}
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
};

function FinancingCalculator({ simulation }: { simulation: SimulationRun }) {
  const { t, language } = useI18n();
  const [financingType, setFinancingType] = useState<"cash" | "loan" | "lease">("cash");
  const [loanTerm, setLoanTerm] = useState(10);
  const [interestRate, setInterestRate] = useState(7);
  const [downPayment, setDownPayment] = useState(30);
  const [leaseImplicitRate, setLeaseImplicitRate] = useState(8.5);
  const [leaseTerm, setLeaseTerm] = useState(15); // Default 15-year lease term
  
  const breakdown = simulation.breakdown as FinancialBreakdown | null;
  const assumptions = simulation.assumptions as AnalysisAssumptions | null;
  const capexNet = simulation.capexNet || 0;
  const capexGross = breakdown?.capexGross || capexNet;
  const annualSavings = simulation.annualSavings || 0;
  const selfConsumptionKWh = simulation.annualEnergySavingsKWh || 0;
  
  // Calculate total annual solar production = PV size × solar yield
  // This is what the system actually produces (different from self-consumption)
  const pvSizeKW = simulation.pvSizeKW || 0;
  const solarYield = assumptions?.solarYieldKWhPerKWp || 1150; // kWh/kWp/year
  const totalAnnualProductionKWh = pvSizeKW * solarYield;
  
  // Incentive breakdown with timing
  const hqSolar = breakdown?.actualHQSolar || 0;
  const hqBattery = breakdown?.actualHQBattery || 0;
  const federalITC = breakdown?.itcAmount || 0;
  const taxShield = breakdown?.taxShield || 0;
  
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
  ];

  // Calculate cumulative cashflow for each financing option over analysis horizon
  const calculateCumulativeCashflows = () => {
    const years = analysisHorizon;
    const data: { year: number; cash: number; loan: number; lease: number }[] = [];
    
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
    
    for (let year = 0; year <= years; year++) {
      if (year === 0) {
        // Year 0: initial investments
        data.push({
          year,
          cash: cashCumulative / 1000,
          loan: loanCumulative / 1000,
          lease: leaseCumulative / 1000,
        });
      } else {
        // Add savings each year for ownership options (cash, loan, lease)
        cashCumulative += annualSavings;
        loanCumulative += annualSavings;
        leaseCumulative += annualSavings;
        
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
        <div className="grid grid-cols-3 gap-3">
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
        
        {/* Cumulative Cashflow Comparison Chart - All Acquisition Models */}
        {cumulativeCashflowData.length > 0 && (
          <div id="pdf-section-financing-chart" className="pt-4 border-t bg-white dark:bg-card rounded-lg p-4">
            <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              {language === "fr" ? "Comparaison des modèles d'acquisition (25 ans)" : "Acquisition Models Comparison (25 years)"}
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
                      (language === "fr" ? "Crédit-bail" : "Capital Lease")
                    ]}
                    labelFormatter={(year) => `${language === "fr" ? "Année" : "Year"} ${year}`}
                  />
                  <Legend 
                    formatter={(value) => 
                      value === "cash" ? (language === "fr" ? "Comptant" : "Cash") :
                      value === "loan" ? (language === "fr" ? "Prêt" : "Loan") :
                      (language === "fr" ? "Crédit-bail" : "Capital Lease")
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

function AnalysisResults({ simulation, site, isStaff = false }: { simulation: SimulationRun; site: SiteWithDetails; isStaff?: boolean }) {
  const { t, language } = useI18n();
  const [showBreakdown, setShowBreakdown] = useState(true);
  const [showIncentives, setShowIncentives] = useState(true);
  const [variantDialogOpen, setVariantDialogOpen] = useState(false);
  const [variantPreset, setVariantPreset] = useState<VariantPreset | null>(null);
  
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
  const cashflows = (simulation.cashflows as CashflowEntry[] | null) || [];
  const breakdown = simulation.breakdown as FinancialBreakdown | null;
  
  // Memoize expensive cashflow chart data transformation
  const cashflowChartData = useMemo(() => 
    cashflows.map(cf => ({
      year: cf.year,
      cashflow: cf.netCashflow / 1000,
      cumulative: cf.cumulative / 1000,
    })),
    [cashflows]
  );

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

  return (
    <div className="space-y-6">
      {/* KPI Dashboard - Quick Overview */}
      <KPIDashboard
        pvSizeKW={simulation.pvSizeKW || 0}
        productionMWh={((simulation.pvSizeKW || 0) * (assumptions.solarYieldKWhPerKWp || 1150)) / 1000}
        coveragePercent={
          simulation.selfSufficiencyPercent 
            ? simulation.selfSufficiencyPercent 
            : (simulation.selfConsumptionKWh && simulation.annualConsumptionKWh)
              ? (simulation.selfConsumptionKWh / simulation.annualConsumptionKWh) * 100
              : 0
        }
        paybackYears={simulation.simplePaybackYears || 0}
        annualSavings={simulation.annualSavings || 0}
        npv25={simulation.npv25 || 0}
        irr25={simulation.irr25 || 0}
        co2Tonnes={simulation.co2AvoidedTonnesPerYear || 0}
      />

      {/* Satellite Hero Image */}
      {site && site.latitude && site.longitude && import.meta.env.VITE_GOOGLE_MAPS_API_KEY && (
        <div className="relative rounded-xl overflow-hidden" data-testid="satellite-hero">
          <iframe
            className="w-full h-56 md:h-72"
            style={{ border: 0 }}
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
            src={`https://www.google.com/maps/embed/v1/view?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&center=${site.latitude},${site.longitude}&zoom=19&maptype=satellite`}
            title={language === "fr" ? "Vue satellite du site" : "Satellite view of site"}
          />
          {/* Dark gradient overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />
          
          {/* Building name and stats overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-white mb-1">{site.name}</h2>
                <p className="text-sm text-white/80">{site.address}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
                  <Home className="w-3 h-3 mr-1" />
                  {assumptions.roofAreaSqFt.toLocaleString()} pi²
                </Badge>
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
                  <Sun className="w-3 h-3 mr-1" />
                  {Math.round(maxPVFromRoof)} kWc max
                </Badge>
                {simulation.pvSizeKW && (
                  <Badge variant="secondary" className="bg-primary/80 text-white border-primary backdrop-blur-sm">
                    <Zap className="w-3 h-3 mr-1" />
                    {Math.round(simulation.pvSizeKW)} kWc
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== SECTION 1: RECOMMENDED SYSTEM ========== */}
      <SectionDivider 
        title={language === "fr" ? "Système recommandé" : "Recommended System"} 
        icon={Zap}
      />

      {/* Recommended System with Roof Constraint - PROMINENT */}
      <Card id="pdf-section-system-config" className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl flex items-center gap-2">
            <Zap className="w-6 h-6 text-primary" />
            {language === "fr" ? "Configuration optimale" : "Optimal Configuration"}
          </CardTitle>
          <CardDescription>
            {language === "fr" 
              ? "Le système qui maximise votre retour sur investissement" 
              : "The system that maximizes your return on investment"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-4 gap-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sun className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{language === "fr" ? "Panneaux solaires" : "Solar Panels"}</p>
                <p className="text-2xl font-bold font-mono text-primary">{(simulation.pvSizeKW || 0).toFixed(0)} <span className="text-sm font-normal">kWc</span></p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Battery className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{language === "fr" ? "Stockage énergie" : "Energy Storage"}</p>
                <p className="text-2xl font-bold font-mono text-primary">{(simulation.battEnergyKWh || 0).toFixed(0)} <span className="text-sm font-normal">kWh</span></p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{language === "fr" ? "Puissance batterie" : "Battery Power"}</p>
                <p className="text-2xl font-bold font-mono text-primary">{(simulation.battPowerKW || 0).toFixed(0)} <span className="text-sm font-normal">kW</span></p>
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
          
          {/* Self-sufficiency bar */}
          <div className="mt-6 p-4 bg-background rounded-lg border">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">{language === "fr" ? "Autonomie énergétique" : "Energy Independence"}</span>
              <span className="text-xl font-bold font-mono text-primary">{(simulation.selfSufficiencyPercent || 0).toFixed(0)}%</span>
            </div>
            <Progress value={simulation.selfSufficiencyPercent || 0} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {/* ========== SECTION 2: VALUE PROPOSITION - BIG NUMBERS ========== */}
      <SectionDivider 
        title={language === "fr" ? "Votre investissement" : "Your Investment"} 
        icon={DollarSign}
      />

      {/* Hero Value Card - Annual Savings Focus */}
      <Card id="pdf-section-value-proposition" className="border-green-500/30 bg-gradient-to-br from-green-500/10 to-transparent overflow-hidden">
        <CardContent className="p-6">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="text-center md:text-left">
              <p className="text-sm text-muted-foreground mb-1">
                {language === "fr" ? "Économies annuelles estimées" : "Estimated Annual Savings"}
              </p>
              <p className="text-5xl font-bold font-mono text-green-600 dark:text-green-400">
                ${((simulation.annualSavings || 0) / 1000).toFixed(0)}k
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {language === "fr" ? "par année, dès la première année" : "per year, starting year one"}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-background rounded-xl border">
                <p className="text-xs text-muted-foreground mb-1">{language === "fr" ? "Investissement net" : "Net Investment"}</p>
                <p className="text-2xl font-bold font-mono">${((simulation.capexNet || 0) / 1000).toFixed(0)}k</p>
                <p className="text-xs text-green-600">{language === "fr" ? "après incitatifs" : "after incentives"}</p>
              </div>
              <div className="text-center p-4 bg-background rounded-xl border">
                <p className="text-xs text-muted-foreground mb-1">{language === "fr" ? "Retour" : "Payback"}</p>
                <p className="text-2xl font-bold font-mono">{(simulation.simplePaybackYears || 0).toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">{language === "fr" ? "années" : "years"}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Financial KPIs - 25 Year Focus */}
      <div id="pdf-section-kpis" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-primary" />
              <p className="text-sm text-muted-foreground">{language === "fr" ? "Profit net 25 ans" : "Net Profit 25 years"}</p>
            </div>
            <p className="text-2xl font-bold font-mono text-primary">${((simulation.npv25 || 0) / 1000).toFixed(0)}k</p>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-primary" />
              <p className="text-sm text-muted-foreground">{language === "fr" ? "TRI 25 ans" : "IRR 25 Year"}</p>
            </div>
            <p className="text-2xl font-bold font-mono text-primary">{((simulation.irr25 || 0) * 100).toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Calculator className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{language === "fr" ? "Coût énergie" : "Energy Cost"}</p>
            </div>
            <p className="text-2xl font-bold font-mono">${(simulation.lcoe || 0).toFixed(3)}<span className="text-sm font-normal text-muted-foreground">/kWh</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Leaf className="w-4 h-4 text-green-500" />
              <p className="text-sm text-muted-foreground">CO₂ {language === "fr" ? "évité" : "avoided"}</p>
            </div>
            <p className="text-2xl font-bold font-mono text-green-600">{((simulation.co2AvoidedTonnesPerYear || 0) * 25).toFixed(0)} <span className="text-sm font-normal">t/25 ans</span></p>
          </CardContent>
        </Card>
      </div>

      {/* ========== SECTION 3: WEALTH BUILDING STORY ========== */}
      {/* 25-Year Cashflow Chart - Visual Story of Money Growing */}
      {cashflowChartData.length > 0 && (
        <>
          <SectionDivider 
            title={language === "fr" ? "Votre croissance financière" : "Your Financial Growth"} 
            icon={TrendingUp}
          />
          
          <Card id="pdf-section-cashflow-chart">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                {language === "fr" ? "Évolution de vos économies sur 25 ans" : "Your Savings Over 25 Years"}
              </CardTitle>
              <CardDescription>
                {language === "fr" 
                  ? "Visualisez comment votre investissement génère des profits année après année" 
                  : "See how your investment generates profits year after year"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={cashflowChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="year" className="text-xs" label={{ value: language === "fr" ? "Année" : "Year", position: "bottom" }} />
                    <YAxis 
                      yAxisId="left" 
                      className="text-xs" 
                      label={{ value: "k$", angle: -90, position: "insideLeft" }}
                    />
                    <YAxis 
                      yAxisId="right" 
                      orientation="right" 
                      className="text-xs"
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }}
                      formatter={(value: number) => `$${value.toFixed(1)}k`}
                    />
                    <Legend />
                    <ReferenceLine yAxisId="left" y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                    <Bar 
                      yAxisId="left" 
                      dataKey="cashflow" 
                      name={language === "fr" ? "Flux annuel" : "Annual Cashflow"}
                      radius={[4, 4, 0, 0]}
                    >
                      {cashflowChartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.cashflow >= 0 ? "hsl(var(--chart-1))" : "hsl(var(--destructive))"} 
                        />
                      ))}
                    </Bar>
                    <Line 
                      yAxisId="right" 
                      type="monotone" 
                      dataKey="cumulative" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      name={language === "fr" ? "Cumulatif" : "Cumulative"}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ========== SECTION 4: FINANCING OPTIONS ========== */}
      <SectionDivider 
        title={language === "fr" ? "Options de financement" : "Financing Options"} 
        icon={CreditCard}
      />
      
      {/* Financing Options Calculator */}
      <FinancingCalculator simulation={simulation} />

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
      {simulation.sensitivity && (
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
                    {/* Hybrid points */}
                    <Scatter
                      name={language === "fr" ? "Hybride" : "Hybrid"}
                      data={(simulation.sensitivity as SensitivityAnalysis).frontier.filter(p => p.type === 'hybrid' && !p.isOptimal)}
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
              {/* Optimal scenario indicator - only show recommendation if NPV is positive */}
              {(() => {
                const optimal = (simulation.sensitivity as SensitivityAnalysis).frontier.find(p => p.isOptimal);
                const isProfitable = optimal && optimal.npv25 > 0;
                
                if (!optimal) return null;
                
                const pvKW = optimal.pvSizeKW || 0;
                const battKWh = optimal.battEnergyKWh || 0;
                const actualType = pvKW > 0 && battKWh > 0 ? 'hybrid' : 
                                  pvKW > 0 ? 'solar' : 
                                  battKWh > 0 ? 'battery' : 'none';
                
                const typeLabel = actualType === 'hybrid' 
                  ? (language === "fr" ? "Hybride" : "Hybrid")
                  : actualType === 'solar' 
                    ? (language === "fr" ? "Solaire seul" : "Solar only")
                    : (language === "fr" ? "Stockage seul" : "Storage only");
                
                const sizingLabel = actualType === 'hybrid'
                  ? `${pvKW}kW PV + ${battKWh}kWh`
                  : actualType === 'solar'
                    ? `${pvKW}kW PV`
                    : `${battKWh}kWh`;
                
                const correctedLabel = `${typeLabel} - ${sizingLabel}`;
                
                if (isProfitable) {
                  return (
                    <div className="mt-2 p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-center gap-3">
                      <span className="text-2xl">⭐</span>
                      <div>
                        <p className="text-sm font-medium">
                          {language === "fr" ? "Recommandation: " : "Recommendation: "}
                          <span className="text-primary">{correctedLabel}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {language === "fr" 
                            ? "Ce scénario offre le meilleur retour sur investissement (VAN maximale)"
                            : "This scenario offers the best return on investment (maximum NPV)"}
                        </p>
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div className="mt-2 p-3 bg-destructive/5 border border-destructive/20 rounded-lg flex items-center gap-3">
                      <span className="text-2xl">⚠️</span>
                      <div>
                        <p className="text-sm font-medium text-destructive">
                          {language === "fr" ? "Aucun investissement recommandé" : "No investment recommended"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {language === "fr" 
                            ? "Toutes les configurations ont une VAN négative avec les hypothèses actuelles. Considérez ajuster les paramètres (coûts, tarifs) ou explorer d'autres options."
                            : "All configurations have negative NPV under current assumptions. Consider adjusting parameters (costs, tariffs) or exploring other options."}
                        </p>
                      </div>
                    </div>
                  );
                }
              })()}
              
              {/* Strategic Benefits Section - Always visible, even if NPV negative */}
              {(() => {
                const optimal = (simulation.sensitivity as SensitivityAnalysis).frontier.find(p => p.isOptimal);
                if (!optimal) return null;
                
                const pvKW = optimal.pvSizeKW || 0;
                const battKWh = optimal.battEnergyKWh || 0;
                const battPowerKW = optimal.battPowerKW || 0;
                const co2PerYear = simulation.co2AvoidedTonnesPerYear || 0;
                
                const avgLoadKW = battPowerKW > 0 ? battPowerKW * 0.5 : (simulation.peakDemandKW ? simulation.peakDemandKW * 0.3 : 0);
                const backupHours = (battKWh > 0 && avgLoadKW > 0) ? (battKWh / avgLoadKW) : 0;
                
                const carsEquivalent = co2PerYear / 4.6;
                const co2_25Years = co2PerYear * 25;
                
                const selfSufficiency = simulation.selfSufficiencyPercent 
                  ? simulation.selfSufficiencyPercent 
                  : (pvKW > 0 ? Math.min(40, pvKW / 10) : 0);
                
                const systemCost = (pvKW * 1.50 * 1000) + (battKWh * 400);
                // Industry standard: ~$1,000 per kW of installed PV capacity (Lawrence Berkeley studies)
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
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
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
                      
                      {/* CO2 Reduction */}
                      {hasSolar && co2PerYear > 0 && (
                        <div className="p-3 bg-background rounded-lg border">
                          <div className="flex items-center gap-2 mb-1">
                            <Leaf className="w-4 h-4 text-green-500" />
                            <span className="text-xs font-medium">
                              {language === "fr" ? "Impact carbone" : "Carbon Impact"}
                            </span>
                          </div>
                          <p className="text-lg font-bold font-mono text-green-600">
                            {co2_25Years.toFixed(0)}t
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {language === "fr" ? `CO₂ évité sur 25 ans` : `CO₂ avoided over 25 years`}
                          </p>
                        </div>
                      )}
                      
                      {/* Car Equivalent */}
                      {hasSolar && carsEquivalent >= 0.1 && (
                        <div className="p-3 bg-background rounded-lg border">
                          <div className="flex items-center gap-2 mb-1">
                            <Car className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs font-medium">
                              {language === "fr" ? "Équivalent" : "Equivalent"}
                            </span>
                          </div>
                          <p className="text-lg font-bold font-mono text-emerald-600">
                            {carsEquivalent >= 1 ? carsEquivalent.toFixed(1) : carsEquivalent.toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {language === "fr" ? "voitures retirées/an" : "cars removed/year"}
                          </p>
                        </div>
                      )}
                      
                      {/* ESG / Sustainability Image */}
                      {hasSolar && (
                        <div className="p-3 bg-background rounded-lg border">
                          <div className="flex items-center gap-2 mb-1">
                            <Award className="w-4 h-4 text-amber-500" />
                            <span className="text-xs font-medium">
                              {language === "fr" ? "Image ESG" : "ESG Image"}
                            </span>
                          </div>
                          <p className="text-lg font-bold font-mono text-amber-600">
                            {selfSufficiency.toFixed(0)}%
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {language === "fr" ? "énergie verte" : "green energy"}
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
              const bifacialBoost = assumptions.bifacialEnabled 
                ? (1 + (assumptions.bifacialityFactor || 0.85) * (assumptions.roofAlbedo || 0.70) * 0.35)
                : 1.0;
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
                      {assumptions.bifacialEnabled && <span className="text-primary ml-1">(+bifacial)</span>}
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
              <Link href={`/app/analyses/${simulation.id}/design`}>
                <Button size="lg" className="gap-2 px-8" data-testid="button-cta-create-design">
                  <PenTool className="w-5 h-5" />
                  {language === "fr" ? "Créer le devis" : "Create Design Quote"}
                </Button>
              </Link>
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
  const { isStaff, isClient } = useAuth();
  const [activeTab, setActiveTab] = useState("consumption");
  const [customAssumptions, setCustomAssumptions] = useState<Partial<AnalysisAssumptions>>({});
  const assumptionsInitializedRef = useRef(false);
  const [selectedSimulationId, setSelectedSimulationId] = useState<string | null>(null);
  const [bifacialDialogOpen, setBifacialDialogOpen] = useState(false);

  const { data: site, isLoading, refetch } = useQuery<SiteWithDetails>({
    queryKey: ["/api/sites", id],
    enabled: !!id,
  });

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
      // Wrap assumptions in the expected format for the API
      return apiRequest("POST", `/api/sites/${id}/run-potential-analysis`, { assumptions: mergedAssumptions });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites", id] });
      toast({ title: language === "fr" ? "Analyse terminée avec succès" : "Analysis completed successfully" });
      setActiveTab("analysis");
      setSelectedSimulationId(null); // Reset selection so it picks the best new scenario
    },
    onError: () => {
      toast({ title: language === "fr" ? "Erreur lors de l'analyse" : "Error during analysis", variant: "destructive" });
    },
  });

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

  // Show bifacial dialog when white membrane detected and not yet prompted
  useEffect(() => {
    if (site && 
        (site.roofColorType === "white_membrane" || site.roofColorType === "light") && 
        !site.bifacialAnalysisPrompted && 
        site.roofEstimateStatus === "success") {
      setBifacialDialogOpen(true);
    }
  }, [site]);

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

  // Initialize selected simulation with the best scenario when site loads
  useEffect(() => {
    if (site && bestScenarioByNPV && !selectedSimulationId) {
      setSelectedSimulationId(bestScenarioByNPV.id);
    }
  }, [site, bestScenarioByNPV, selectedSimulationId]);

  // The simulation to display - either selected one or fallback to latest/best
  const latestSimulation = selectedSimulationId 
    ? site?.simulationRuns?.find(s => s.id === selectedSimulationId)
    : (bestScenarioByNPV || site?.simulationRuns?.find(s => s.type === "SCENARIO") || site?.simulationRuns?.[0]);

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
              {(site.city || site.province) && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {[site.city, site.province].filter(Boolean).join(", ")}
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
          {latestSimulation && (
            <>
              <DownloadReportButton 
                simulationId={latestSimulation.id}
                siteName={site.name}
                clientName={site.client?.name}
                location={[site.city, site.province].filter(Boolean).join(", ")}
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="consumption" data-testid="tab-consumption">{t("site.consumption")}</TabsTrigger>
          <TabsTrigger value="analysis" data-testid="tab-analysis">{t("analysis.title")}</TabsTrigger>
          <TabsTrigger value="compare" data-testid="tab-compare">
            {language === "fr" ? "Comparer" : "Compare"}
          </TabsTrigger>
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
              disabled={runAnalysisMutation.isPending}
              site={site}
              onSiteRefresh={() => refetch()}
              showOnlyRoofSection={!site.meterFiles?.length}
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
                disabled={runAnalysisMutation.isPending}
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
                  disabled={!site.meterFiles?.length || runAnalysisMutation.isPending}
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
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Aucun fichier importé</p>
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
            <AnalysisResults simulation={latestSimulation} site={site} isStaff={isStaff} />
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
                    disabled={!site.meterFiles?.length || runAnalysisMutation.isPending}
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
    </div>
  );
}
