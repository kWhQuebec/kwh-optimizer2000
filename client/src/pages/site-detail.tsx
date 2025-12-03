import { useState, useCallback, useEffect } from "react";
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
  Info
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
  BatterySweepPoint
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
  disabled = false 
}: { 
  value: Partial<AnalysisAssumptions>; 
  onChange: (value: Partial<AnalysisAssumptions>) => void;
  disabled?: boolean;
}) {
  const { language } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  const merged: AnalysisAssumptions = { ...defaultAnalysisAssumptions, ...value };

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
            {/* Tariffs Section */}
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

            {/* Roof Constraints Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Home className="w-4 h-4 text-primary" />
                {language === "fr" ? "Contraintes de toiture" : "Roof Constraints"}
              </h4>
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

function AnalysisResults({ simulation }: { simulation: SimulationRun }) {
  const { t, language } = useI18n();
  const [showBreakdown, setShowBreakdown] = useState(true);
  const [showIncentives, setShowIncentives] = useState(true);

  const assumptions = (simulation.assumptions as AnalysisAssumptions | null) || defaultAnalysisAssumptions;
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

  const loadProfileData = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}h`,
    consumption: Math.sin(i / 24 * Math.PI * 2) * 50 + 100 + Math.random() * 20,
    production: i >= 6 && i <= 18 ? Math.sin((i - 6) / 12 * Math.PI) * 80 : 0,
  }));

  const comparisonData = [
    { 
      name: language === "fr" ? "Consommation" : "Consumption", 
      before: simulation.annualConsumptionKWh || 0, 
      after: (simulation.annualConsumptionKWh || 0) - (simulation.annualEnergySavingsKWh || 0) 
    },
    { 
      name: language === "fr" ? "Pic kW" : "Peak kW", 
      before: (simulation.peakDemandKW || simulation.demandShavingSetpointKW || 0), 
      after: ((simulation.peakDemandKW || simulation.demandShavingSetpointKW || 0) - (simulation.annualDemandReductionKW || 0)) 
    },
  ];

  return (
    <div className="space-y-6">
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

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("analysis.charts.loadProfile")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={loadProfileData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="hour" className="text-xs" />
                  <YAxis className="text-xs" />
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
                    name="Consommation (kW)"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="production" 
                    stackId="2" 
                    stroke="hsl(var(--chart-1))" 
                    fill="hsl(var(--chart-1))" 
                    fillOpacity={0.3}
                    name="Production PV (kW)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("analysis.charts.beforeAfter")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Legend />
                  <Bar dataKey="before" fill="hsl(var(--chart-2))" name={language === "fr" ? "Avant" : "Before"} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="after" fill="hsl(var(--chart-1))" name={language === "fr" ? "Après" : "After"} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
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
                      formatter={(value: number, name: string) => [
                        `$${(value / 1000).toFixed(1)}k`,
                        name === "capexNet" 
                          ? (language === "fr" ? "Investissement" : "Investment")
                          : "VAN 25 ans"
                      ]}
                      labelFormatter={(label: string) => label}
                    />
                    <Legend />
                    {/* Solar-only profitable points (solid orange) */}
                    <Scatter
                      name={language === "fr" ? "Solaire rentable" : "Solar profitable"}
                      data={(simulation.sensitivity as SensitivityAnalysis).frontier.filter(p => p.type === 'solar' && p.npv25 >= 0)}
                      fill="#FFB005"
                    />
                    {/* Solar-only unprofitable points (faded) */}
                    <Scatter
                      name={language === "fr" ? "Solaire non rentable" : "Solar unprofitable"}
                      data={(simulation.sensitivity as SensitivityAnalysis).frontier.filter(p => p.type === 'solar' && p.npv25 < 0)}
                      fill="#FFB005"
                      fillOpacity={0.25}
                    />
                    {/* Battery-only profitable points (solid blue) */}
                    <Scatter
                      name={language === "fr" ? "Batterie rentable" : "Battery profitable"}
                      data={(simulation.sensitivity as SensitivityAnalysis).frontier.filter(p => p.type === 'battery' && p.npv25 >= 0)}
                      fill="#003DA6"
                    />
                    {/* Battery-only unprofitable points (faded) */}
                    <Scatter
                      name={language === "fr" ? "Batterie non rentable" : "Battery unprofitable"}
                      data={(simulation.sensitivity as SensitivityAnalysis).frontier.filter(p => p.type === 'battery' && p.npv25 < 0)}
                      fill="#003DA6"
                      fillOpacity={0.25}
                    />
                    {/* Hybrid profitable points (solid green) */}
                    <Scatter
                      name={language === "fr" ? "Hybride rentable" : "Hybrid profitable"}
                      data={(simulation.sensitivity as SensitivityAnalysis).frontier.filter(p => p.type === 'hybrid' && p.npv25 >= 0)}
                      fill="#22C55E"
                    />
                    {/* Hybrid unprofitable points (faded) */}
                    <Scatter
                      name={language === "fr" ? "Hybride non rentable" : "Hybrid unprofitable"}
                      data={(simulation.sensitivity as SensitivityAnalysis).frontier.filter(p => p.type === 'hybrid' && p.npv25 < 0)}
                      fill="#22C55E"
                      fillOpacity={0.25}
                    />
                    {/* Optimal point highlighted with special marker */}
                    <Scatter
                      name={language === "fr" ? "Point optimal" : "Optimal point"}
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
                  <span className="text-base">⭐</span>
                  <span>{language === "fr" ? "Scénario optimal (meilleure VAN)" : "Optimal scenario (best NPV)"}</span>
                </div>
              </div>
              {/* Optimal scenario indicator */}
              {(simulation.sensitivity as SensitivityAnalysis).frontier.find(p => p.isOptimal) && (
                <div className="mt-2 p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-center gap-3">
                  <span className="text-2xl">⭐</span>
                  <div>
                    <p className="text-sm font-medium">
                      {language === "fr" ? "Recommandation: " : "Recommendation: "}
                      <span className="text-primary">
                        {(simulation.sensitivity as SensitivityAnalysis).frontier.find(p => p.isOptimal)?.label}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {language === "fr" 
                        ? "Ce scénario offre le meilleur retour sur investissement (VAN maximale)"
                        : "This scenario offers the best return on investment (maximum NPV)"}
                    </p>
                  </div>
                </div>
              )}
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
      
      // Convert site roof area from sq meters to sq feet if available
      if (site.roofAreaSqM && site.roofAreaSqM > 0) {
        initialAssumptions.roofAreaSqFt = Math.round(site.roofAreaSqM * 10.764);
      }
      
      // Load saved assumptions from site if they exist
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
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span>{site.client?.name}</span>
              {(site.city || site.province) && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {[site.city, site.province].filter(Boolean).join(", ")}
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

          {/* Analysis Parameters */}
          {site.meterFiles?.length > 0 && (
            <AnalysisParametersEditor 
              value={customAssumptions}
              onChange={setCustomAssumptions}
              disabled={runAnalysisMutation.isPending}
            />
          )}

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
            <AnalysisResults simulation={latestSimulation} />
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
