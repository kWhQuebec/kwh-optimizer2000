import { useState, useCallback, useEffect, Fragment } from "react";
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
  Layers
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
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
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

  const merged: AnalysisAssumptions = { ...defaultAnalysisAssumptions, ...value };

  // Roof estimation mutation
  const handleRoofEstimate = async () => {
    if (!site || !token) return;
    
    setIsEstimating(true);
    try {
      const response = await fetch(`/api/sites/${site.id}/roof-estimate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      
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
      toast({
        variant: "destructive",
        title: language === "fr" ? "Erreur d'estimation" : "Estimation error",
        description: error instanceof Error ? error.message : "Unknown error",
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
                  <Label className="text-xs">{language === "fr" ? "Surface de toit (pi²)" : "Roof Area (sq ft)"}</Label>
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

function DownloadReportButton({ simulationId }: { simulationId: string }) {
  const { t, language } = useI18n();
  const { token } = useAuth();
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await fetch(`/api/simulation-runs/${simulationId}/report-pdf?lang=${language}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error("Download failed");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rapport-potentiel-${simulationId.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({ title: language === "fr" ? "Rapport téléchargé" : "Report downloaded" });
    } catch (error) {
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

function AnalysisResults({ simulation, site }: { simulation: SimulationRun; site: SiteWithDetails }) {
  const { t, language } = useI18n();
  const [showBreakdown, setShowBreakdown] = useState(true);
  const [showIncentives, setShowIncentives] = useState(true);

  const assumptions = (simulation.assumptions as AnalysisAssumptions | null) || defaultAnalysisAssumptions;
  const interpolatedMonths = (simulation.interpolatedMonths as number[] | null) || [];
  const cashflows = (simulation.cashflows as CashflowEntry[] | null) || [];
  const breakdown = simulation.breakdown as FinancialBreakdown | null;
  
  const cashflowChartData = cashflows.map(cf => ({
    year: cf.year,
    cashflow: cf.netCashflow / 1000,
    cumulative: cf.cumulative / 1000,
  }));

  const usableRoofSqFt = assumptions.roofAreaSqFt * assumptions.roofUtilizationRatio;
  const maxPVFromRoof = usableRoofSqFt / 100;
  const isRoofLimited = (simulation.pvSizeKW || 0) >= maxPVFromRoof * 0.95;

  const loadProfileData = (() => {
    const rawProfile = simulation.hourlyProfile as HourlyProfileEntry[] | null;
    if (!rawProfile || rawProfile.length === 0) {
      return null;
    }
    
    const byHour: Map<number, { 
      consumptionSum: number; 
      productionSum: number; 
      count: number 
    }> = new Map();
    
    for (const entry of rawProfile) {
      const existing = byHour.get(entry.hour) || { 
        consumptionSum: 0, 
        productionSum: 0, 
        count: 0 
      };
      existing.consumptionSum += entry.consumption;
      existing.productionSum += entry.production;
      existing.count++;
      byHour.set(entry.hour, existing);
    }
    
    const result = [];
    for (let h = 0; h < 24; h++) {
      const data = byHour.get(h);
      if (data && data.count > 0) {
        result.push({
          hour: `${h}h`,
          consumption: Math.round(data.consumptionSum / data.count),
          production: Math.round(data.productionSum / data.count),
        });
      }
    }
    return result;
  })();

  // Build hourly profile data from simulation.hourlyProfile
  const hourlyProfileData = (() => {
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
  })();

  return (
    <div className="space-y-6">
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

      {/* Main Financial KPIs - 25 Year Focus */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-primary" />
              <p className="text-sm text-muted-foreground">VAN 25 ans</p>
            </div>
            <p className="text-2xl font-bold font-mono text-primary">${((simulation.npv25 || 0) / 1000).toFixed(0)}k</p>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-primary" />
              <p className="text-sm text-muted-foreground">TRI 25 ans</p>
            </div>
            <p className="text-2xl font-bold font-mono text-primary">{((simulation.irr25 || 0) * 100).toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{language === "fr" ? "Retour simple" : "Simple Payback"}</p>
            </div>
            <p className="text-2xl font-bold font-mono">{(simulation.simplePaybackYears || 0).toFixed(1)} <span className="text-sm font-normal text-muted-foreground">{language === "fr" ? "ans" : "years"}</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Calculator className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">LCOE</p>
            </div>
            <p className="text-2xl font-bold font-mono">${(simulation.lcoe || 0).toFixed(3)}<span className="text-sm font-normal text-muted-foreground">/kWh</span></p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary KPIs - 10 Year */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">VAN 10 ans</p>
            <p className="text-lg font-bold font-mono">${((simulation.npv10 || 0) / 1000).toFixed(0)}k</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">TRI 10 ans</p>
            <p className="text-lg font-bold font-mono">{((simulation.irr10 || 0) * 100).toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">{language === "fr" ? "Économies An 1" : "Year 1 Savings"}</p>
            <p className="text-lg font-bold font-mono">${((simulation.savingsYear1 || simulation.annualSavings || 0) / 1000).toFixed(1)}k</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-1 mb-1">
              <Leaf className="w-3 h-3 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">CO₂ {language === "fr" ? "évité" : "avoided"}</p>
            </div>
            <p className="text-lg font-bold font-mono">{(simulation.co2AvoidedTonnesPerYear || 0).toFixed(1)} <span className="text-xs font-normal">t/an</span></p>
          </CardContent>
        </Card>
      </div>

      {/* Recommended System with Roof Constraint */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            {language === "fr" ? "Système recommandé" : "Recommended System"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-4 gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("analysis.recommendedPV")}</p>
                <p className="text-xl font-bold font-mono">{(simulation.pvSizeKW || 0).toFixed(0)} <span className="text-sm font-normal">kWc</span></p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Battery className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{language === "fr" ? "Énergie batterie" : "Battery Energy"}</p>
                <p className="text-xl font-bold font-mono">{(simulation.battEnergyKWh || 0).toFixed(0)} <span className="text-sm font-normal">kWh</span></p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Battery className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{language === "fr" ? "Puissance batterie" : "Battery Power"}</p>
                <p className="text-xl font-bold font-mono">{(simulation.battPowerKW || 0).toFixed(0)} <span className="text-sm font-normal">kW</span></p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center">
                <Home className="w-5 h-5 text-muted-foreground" />
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
          <div className="mt-6 p-4 bg-muted/30 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">{language === "fr" ? "Autosuffisance" : "Self-sufficiency"}</span>
              <span className="text-lg font-bold font-mono">{(simulation.selfSufficiencyPercent || 0).toFixed(1)}%</span>
            </div>
            <Progress value={simulation.selfSufficiencyPercent || 0} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Cross-Validation with Google Solar */}
      {site && site.roofAreaAutoDetails && (() => {
        const details = site.roofAreaAutoDetails as any;
        const solarPotential = details?.solarPotential;
        const panelConfigs = solarPotential?.solarPanelConfigs;
        const panelWatts = solarPotential?.panelCapacityWatts || 400;
        
        if (!panelConfigs || panelConfigs.length === 0) return null;
        
        // Find closest config to our simulation PV size
        const ourPvKw = simulation.pvSizeKW || 0;
        let closestConfig = panelConfigs[0];
        let closestDiff = Infinity;
        
        for (const config of panelConfigs) {
          const configKw = (config.panelsCount * panelWatts) / 1000;
          const diff = Math.abs(configKw - ourPvKw);
          if (diff < closestDiff) {
            closestDiff = diff;
            closestConfig = config;
          }
        }
        
        const googlePvKw = (closestConfig.panelsCount * panelWatts) / 1000;
        const googleProdDc = closestConfig.yearlyEnergyDcKwh || 0;
        const googleProdAc = googleProdDc * 0.85; // Assume 85% DC-to-AC efficiency
        
        // Calculate our production from hourly profile
        const hourlyProfile = simulation.hourlyProfile as HourlyProfileEntry[] | null;
        let ourAnnualProd = 0;
        if (hourlyProfile && hourlyProfile.length > 0) {
          ourAnnualProd = hourlyProfile.reduce((sum, h) => sum + (h.production || 0), 0);
        }
        
        // Calculate specific yield (kWh/kWp)
        const googleYield = googlePvKw > 0 ? googleProdAc / googlePvKw : 0;
        const ourYield = ourPvKw > 0 ? ourAnnualProd / ourPvKw : 0;
        
        // Calculate difference percentage
        const diffPercent = ourAnnualProd > 0 ? ((ourAnnualProd - googleProdAc) / googleProdAc * 100) : 0;
        const isWithinMargin = Math.abs(diffPercent) <= 15; // Within 15% is acceptable
        
        return (
          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                {language === "fr" ? "Validation croisée" : "Cross-Validation"}
                {isWithinMargin ? (
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
                  ? "Comparaison entre nos calculs et les estimations Google Solar API"
                  : "Comparison between our calculations and Google Solar API estimates"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">
                    {language === "fr" ? "Notre simulation" : "Our Simulation"}
                  </p>
                  <p className="text-lg font-bold font-mono">{Math.round(ourAnnualProd).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">kWh/an</p>
                </div>
                <div className="text-center p-3 bg-primary/10 rounded-lg border border-primary/20">
                  <p className="text-xs text-muted-foreground mb-1">
                    {language === "fr" ? "Google Solar" : "Google Solar"}
                  </p>
                  <p className="text-lg font-bold font-mono text-primary">{Math.round(googleProdAc).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">kWh/an</p>
                </div>
                <div className={`text-center p-3 rounded-lg ${isWithinMargin ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                  <p className="text-xs text-muted-foreground mb-1">
                    {language === "fr" ? "Écart" : "Difference"}
                  </p>
                  <p className={`text-lg font-bold font-mono ${isWithinMargin ? 'text-green-700' : 'text-amber-700'}`}>
                    {diffPercent >= 0 ? "+" : ""}{diffPercent.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {diffPercent >= 0 
                      ? (language === "fr" ? "plus élevé" : "higher")
                      : (language === "fr" ? "plus bas" : "lower")}
                  </p>
                </div>
              </div>
              
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{language === "fr" ? "Rendement spécifique (nous)" : "Specific yield (ours)"}</span>
                  <span className="font-mono">{Math.round(ourYield)} kWh/kWp</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{language === "fr" ? "Rendement spécifique (Google)" : "Specific yield (Google)"}</span>
                  <span className="font-mono">{Math.round(googleYield)} kWh/kWp</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{language === "fr" ? "Taille système analysé" : "System size analyzed"}</span>
                  <span className="font-mono">{ourPvKw.toFixed(1)} kWc</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{language === "fr" ? "Config. Google comparable" : "Comparable Google config"}</span>
                  <span className="font-mono">{googlePvKw.toFixed(1)} kWc ({closestConfig.panelsCount} pan.)</span>
                </div>
              </div>
              
              <p className="mt-4 text-xs text-muted-foreground">
                <Info className="w-3 h-3 inline mr-1" />
                {language === "fr" 
                  ? "Les écarts de ±15% sont normaux et peuvent être dus aux différences de modélisation météo, d'efficacité des panneaux, et d'hypothèses d'ombrage."
                  : "Differences of ±15% are normal and can be due to weather modeling, panel efficiency, and shading assumption variations."}
              </p>
            </CardContent>
          </Card>
        );
      })()}

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("analysis.charts.loadProfile")}</CardTitle>
          </CardHeader>
          <CardContent>
            {loadProfileData && loadProfileData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={loadProfileData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="hour" className="text-xs" />
                    <YAxis className="text-xs" label={{ value: "kWh", angle: -90, position: "insideLeft", style: { fontSize: 11 } }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="consumption" 
                      stackId="1" 
                      stroke="hsl(var(--chart-2))" 
                      fill="hsl(var(--chart-2))" 
                      fillOpacity={0.3}
                      name={language === "fr" ? "Consommation (kWh)" : "Consumption (kWh)"}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="production" 
                      stackId="2" 
                      stroke="hsl(var(--chart-1))" 
                      fill="hsl(var(--chart-1))" 
                      fillOpacity={0.3}
                      name={language === "fr" ? "Production PV (kWh)" : "PV Production (kWh)"}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                {language === "fr" ? "Données horaires non disponibles" : "Hourly data not available"}
              </div>
            )}
          </CardContent>
        </Card>

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
                      name={language === "fr" ? "Consommation (kWh) Avant" : "Consumption (kWh) Before"} 
                      radius={[2, 2, 0, 0]} 
                      barSize={8}
                    />
                    <Bar 
                      yAxisId="left"
                      dataKey="consumptionAfter" 
                      fill="hsl(var(--primary))" 
                      name={language === "fr" ? "Consommation (kWh) Après" : "Consumption (kWh) After"} 
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
                      name={language === "fr" ? "Pointes (kW) Avant" : "Peak (kW) Before"}
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="peakAfter" 
                      stroke="#FFB005" 
                      strokeWidth={2}
                      dot={false}
                      name={language === "fr" ? "Pointes (kW) Après" : "Peak (kW) After"}
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
      </div>
      
      {/* 25-Year Cashflow Chart */}
      {cashflowChartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {language === "fr" ? "Flux de trésorerie sur 25 ans" : "25-Year Cashflow Analysis"}
            </CardTitle>
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
      )}

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
                    <div className="flex justify-between">
                      <span className="text-sm">{language === "fr" ? "Hydro-Québec (batterie)" : "HQ Battery"}</span>
                      <span className="font-mono text-sm text-primary">-${((breakdown.actualHQBattery || 0) / 1000).toFixed(1)}k</span>
                    </div>
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
                    <p className="text-xs text-muted-foreground">VAN 25 ans</p>
                    <p className="text-lg font-bold font-mono">${((simulation.npv25 || 0) / 1000).toFixed(0)}k</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">TRI 25 ans</p>
                    <p className="text-lg font-bold font-mono">{((simulation.irr25 || 0) * 100).toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Sensitivity Analysis / Optimization Charts */}
      {simulation.sensitivity && (
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
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
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
                      name="VAN"
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
                        return (
                          <div className="bg-card border rounded-lg p-2 shadow-lg">
                            <p className="text-sm font-medium">{point.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {language === "fr" ? "Investissement" : "Investment"}: ${(point.capexNet / 1000).toFixed(1)}k
                            </p>
                            <p className="text-xs text-muted-foreground">
                              VAN 25 ans: ${(point.npv25 / 1000).toFixed(1)}k
                            </p>
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
                    >
                      {(simulation.sensitivity as SensitivityAnalysis).frontier.filter(p => p.type === 'solar' && !p.isOptimal).map((entry, index) => (
                        <Cell key={`solar-${index}`} fillOpacity={entry.npv25 >= 0 ? 1 : 0.25} />
                      ))}
                    </Scatter>
                    {/* Storage points */}
                    <Scatter
                      name={language === "fr" ? "Stockage" : "Storage"}
                      data={(simulation.sensitivity as SensitivityAnalysis).frontier.filter(p => p.type === 'battery' && !p.isOptimal)}
                      fill="#003DA6"
                    >
                      {(simulation.sensitivity as SensitivityAnalysis).frontier.filter(p => p.type === 'battery' && !p.isOptimal).map((entry, index) => (
                        <Cell key={`battery-${index}`} fillOpacity={entry.npv25 >= 0 ? 1 : 0.25} />
                      ))}
                    </Scatter>
                    {/* Hybrid points */}
                    <Scatter
                      name={language === "fr" ? "Hybride" : "Hybrid"}
                      data={(simulation.sensitivity as SensitivityAnalysis).frontier.filter(p => p.type === 'hybrid' && !p.isOptimal)}
                      fill="#22C55E"
                    >
                      {(simulation.sensitivity as SensitivityAnalysis).frontier.filter(p => p.type === 'hybrid' && !p.isOptimal).map((entry, index) => (
                        <Cell key={`hybrid-${index}`} fillOpacity={entry.npv25 >= 0 ? 1 : 0.25} />
                      ))}
                    </Scatter>
                    {/* Optimal point highlighted with special marker */}
                    <Scatter
                      name={language === "fr" ? "Optimal" : "Optimal"}
                      data={(simulation.sensitivity as SensitivityAnalysis).frontier.filter(p => p.isOptimal)}
                      fill="#FFD700"
                      stroke="#000"
                      strokeWidth={2}
                      shape="star"
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
              </div>
              {/* Optimal scenario indicator - only show recommendation if NPV is positive */}
              {(() => {
                const optimal = (simulation.sensitivity as SensitivityAnalysis).frontier.find(p => p.isOptimal);
                const isProfitable = optimal && optimal.npv25 > 0;
                
                if (!optimal) return null;
                
                if (isProfitable) {
                  return (
                    <div className="mt-2 p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-center gap-3">
                      <span className="text-2xl">⭐</span>
                      <div>
                        <p className="text-sm font-medium">
                          {language === "fr" ? "Recommandation: " : "Recommendation: "}
                          <span className="text-primary">{optimal.label}</span>
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
                          value: "VAN", 
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
                        formatter={(value: number) => [`$${(value / 1000).toFixed(1)}k`, "VAN 25 ans"]}
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
                        {" → VAN "}
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

              {/* Battery Size Optimization */}
              <div>
                <h4 className="text-sm font-semibold mb-4">
                  {language === "fr" ? "Optimisation taille batterie (VAN vs kWh)" : "Battery Size Optimization (NPV vs kWh)"}
                </h4>
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
                          value: language === "fr" ? "Batterie (kWh)" : "Battery (kWh)", 
                          position: "bottom",
                          offset: 0,
                          style: { fontSize: 11 }
                        }}
                      />
                      <YAxis 
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                        className="text-xs"
                        label={{ 
                          value: "VAN", 
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
                        formatter={(value: number) => [`$${(value / 1000).toFixed(1)}k`, "VAN 25 ans"]}
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
                        {" → VAN "}
                        <span className="font-medium text-primary">${(optimalBattery.npv25 / 1000).toFixed(1)}k</span>
                      </p>
                    );
                  }
                  return (
                    <p className="text-xs text-amber-600 mt-2">
                      {language === "fr" ? "Batterie seule non rentable (VAN négative)" : "Battery alone not profitable (negative NPV)"}
                    </p>
                  );
                })()}
              </div>
            </div>
          </CardContent>
        </Card>
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
    </div>
  );
}

export default function SiteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, language } = useI18n();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("consumption");
  const [customAssumptions, setCustomAssumptions] = useState<Partial<AnalysisAssumptions>>({});
  const [assumptionsInitialized, setAssumptionsInitialized] = useState(false);

  const { data: site, isLoading, refetch } = useQuery<SiteWithDetails>({
    queryKey: ["/api/sites", id],
    enabled: !!id,
  });

  // Initialize assumptions from site data when loaded
  useEffect(() => {
    if (site && !assumptionsInitialized) {
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
      
      // Load saved assumptions from site if they exist (overrides auto-detected)
      if (site.analysisAssumptions) {
        const savedAssumptions = site.analysisAssumptions as Partial<AnalysisAssumptions>;
        Object.assign(initialAssumptions, savedAssumptions);
      }
      
      if (Object.keys(initialAssumptions).length > 0) {
        setCustomAssumptions(initialAssumptions);
      }
      setAssumptionsInitialized(true);
    }
  }, [site, assumptionsInitialized]);

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
    },
    onError: () => {
      toast({ title: language === "fr" ? "Erreur lors de l'analyse" : "Error during analysis", variant: "destructive" });
    },
  });

  const latestSimulation = site?.simulationRuns?.find(s => s.type === "SCENARIO") || site?.simulationRuns?.[0];

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
          <Link href="/app/sites">
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
              <DownloadReportButton simulationId={latestSimulation.id} />
              <Link href={`/app/analyses/${latestSimulation.id}/design`}>
                <Button className="gap-2" data-testid="button-create-design">
                  <PenTool className="w-4 h-4" />
                  {t("analysis.createDesign")}
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="consumption" data-testid="tab-consumption">{t("site.consumption")}</TabsTrigger>
          <TabsTrigger value="analysis" data-testid="tab-analysis">{t("analysis.title")}</TabsTrigger>
        </TabsList>

        <TabsContent value="consumption" className="space-y-6">
          {/* Upload Zone */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("site.uploadFiles")}</CardTitle>
            </CardHeader>
            <CardContent>
              <FileUploadZone siteId={site.id} onUploadComplete={() => refetch()} />
            </CardContent>
          </Card>

          {/* Analysis Parameters - always show for roof estimation, full params when files exist */}
          <AnalysisParametersEditor 
            value={customAssumptions}
            onChange={setCustomAssumptions}
            disabled={runAnalysisMutation.isPending}
            site={site}
            onSiteRefresh={() => refetch()}
            showOnlyRoofSection={!site.meterFiles?.length}
          />

          {/* Files Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-lg">{t("site.files")}</CardTitle>
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
            <AnalysisResults simulation={latestSimulation} site={site} />
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <BarChart3 className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-1">
                  {language === "fr" ? "Aucune analyse disponible" : "No analysis available"}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {language === "fr" 
                    ? "Importez des fichiers CSV et lancez une analyse pour voir les résultats."
                    : "Import CSV files and run an analysis to see results."}
                </p>
                <Button 
                  onClick={() => runAnalysisMutation.mutate(customAssumptions)}
                  disabled={!site.meterFiles?.length || runAnalysisMutation.isPending}
                  className="gap-2"
                >
                  <Play className="w-4 h-4" />
                  {t("site.runAnalysis")}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
