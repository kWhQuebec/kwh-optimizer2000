import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  FileText,
  Calculator,
  TrendingUp,
  Zap,
  DollarSign,
  Clock,
  Sun,
  Battery,
  Percent,
  Edit3,
  RotateCcw,
  Save,
  Building2,
  Loader2,
  Globe,
  AlertTriangle,
  Ruler
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getAllBuildingTypes, getMonthlyFactors, getBuildingTypeLabel, getBuildingTypeByKey, resolveBuildingTypeKey } from '@shared/buildingTypes';

const MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface MonthlyConsumption {
  month: number;
  consumption: number;
}

interface LoadProfileEditorProps {
  monthlyData: MonthlyConsumption[];
  onUpdate: (data: MonthlyConsumption[]) => void;
  disabled?: boolean;
}

export function LoadProfileEditor({ monthlyData, onUpdate, disabled = false }: LoadProfileEditorProps) {
  const { language } = useI18n();
  const months = language === "fr" ? MONTHS_FR : MONTHS_EN;
  
  const [localData, setLocalData] = useState<MonthlyConsumption[]>(monthlyData);
  const [hasChanges, setHasChanges] = useState(false);
  
  const maxValue = Math.max(...localData.map(d => d.consumption), 1);
  const totalConsumption = localData.reduce((sum, d) => sum + d.consumption, 0);
  
  const handleBarChange = useCallback((monthIndex: number, newValue: number) => {
    const updated = localData.map((d, i) => 
      i === monthIndex ? { ...d, consumption: Math.max(0, newValue) } : d
    );
    setLocalData(updated);
    setHasChanges(true);
  }, [localData]);
  
  const handleSave = () => {
    onUpdate(localData);
    setHasChanges(false);
  };
  
  const handleReset = () => {
    setLocalData(monthlyData);
    setHasChanges(false);
  };
  
  const handleScaleAll = (factor: number) => {
    const scaled = localData.map(d => ({ ...d, consumption: Math.round(d.consumption * factor) }));
    setLocalData(scaled);
    setHasChanges(true);
  };

  return (
    <Card data-testid="card-load-profile-editor">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Edit3 className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">
              {language === "fr" ? "Éditeur de profil de charge" : "Load Profile Editor"}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleReset}
                  data-testid="button-reset-profile"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  {language === "fr" ? "Réinitialiser" : "Reset"}
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleSave}
                  data-testid="button-save-profile"
                >
                  <Save className="h-3 w-3 mr-1" />
                  {language === "fr" ? "Appliquer" : "Apply"}
                </Button>
              </>
            )}
          </div>
        </div>
        <CardDescription>
          {language === "fr" 
            ? "Ajustez la consommation mensuelle en glissant les barres ou en entrant les valeurs"
            : "Adjust monthly consumption by dragging bars or entering values"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {language === "fr" ? "Consommation annuelle totale:" : "Total annual consumption:"}
            </span>
            <Badge variant="secondary" className="font-mono" data-testid="badge-total-consumption">
              {(totalConsumption / 1000).toFixed(0)} MWh
            </Badge>
          </div>
          
          <div className="flex gap-1 items-end h-48 border rounded-lg p-3 bg-muted/30" data-testid="chart-load-profile">
            {localData.map((data, i) => {
              const heightPercent = maxValue > 0 ? (data.consumption / maxValue) * 100 : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div 
                    className="w-full relative group cursor-pointer"
                    style={{ height: '140px' }}
                  >
                    <div 
                      className="absolute bottom-0 w-full bg-primary/80 hover:bg-primary rounded-t transition-all group-hover:shadow-lg"
                      style={{ height: `${heightPercent}%`, minHeight: heightPercent > 0 ? '4px' : '0' }}
                      data-testid={`bar-month-${i}`}
                    />
                    <input
                      type="range"
                      min="0"
                      max={maxValue * 1.5}
                      value={data.consumption}
                      onChange={(e) => handleBarChange(i, parseInt(e.target.value))}
                      disabled={disabled}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                      data-testid={`slider-month-${i}`}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">{months[i]}</span>
                </div>
              );
            })}
          </div>
          
          <div className="flex gap-2 justify-center">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleScaleAll(0.9)}
              disabled={disabled}
              data-testid="button-scale-down"
            >
              -10%
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleScaleAll(1.1)}
              disabled={disabled}
              data-testid="button-scale-up"
            >
              +10%
            </Button>
          </div>
          
          <div className="grid grid-cols-6 gap-2 text-xs">
            {localData.map((data, i) => (
              <div key={i} className="text-center">
                <Input
                  type="number"
                  value={Math.round(data.consumption)}
                  onChange={(e) => handleBarChange(i, parseInt(e.target.value) || 0)}
                  disabled={disabled}
                  className="h-7 text-xs text-center px-1"
                  data-testid={`input-month-${i}`}
                />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const BUILDING_PROFILES: Record<string, number[]> = Object.fromEntries(
  getAllBuildingTypes().map(t => [t.key, t.monthlyFactors])
);

const BUILDING_LABELS = {
  fr: Object.fromEntries(getAllBuildingTypes().map(t => [t.key, t.labelFr])) as Record<string, string>,
  en: Object.fromEntries(getAllBuildingTypes().map(t => [t.key, t.labelEn])) as Record<string, string>,
};

const HQ_ENERGY_RATES: Record<string, number> = {
  G: 0.11933,
  M: 0.06061,
  L: 0.03681,
};

interface SingleBillEstimatorProps {
  onEstimate: (monthlyData: MonthlyConsumption[]) => void;
}

export function SingleBillEstimator({ onEstimate }: SingleBillEstimatorProps) {
  const { language } = useI18n();
  const labels = language === "fr" ? BUILDING_LABELS.fr : BUILDING_LABELS.en;
  
  const [open, setOpen] = useState(false);
  const [billAmount, setBillAmount] = useState<number>(5000);
  const [billingPeriod, setBillingPeriod] = useState<number>(1);
  const [buildingType, setBuildingType] = useState<string>("office");
  const [tariffCode, setTariffCode] = useState<string>("M");
  const [estimatedAnnual, setEstimatedAnnual] = useState<number | null>(null);
  
  const calculateEstimate = () => {
    const monthlyBill = billAmount / billingPeriod;
    const energyRate = HQ_ENERGY_RATES[tariffCode] || 0.06061; // Default to M tariff
    const estimatedMonthlyKWh = (monthlyBill * 0.7) / energyRate;
    const annualKWh = estimatedMonthlyKWh * 12;
    setEstimatedAnnual(annualKWh);
    return annualKWh;
  };
  
  const handleGenerate = () => {
    const annualKWh = calculateEstimate();
    const profile = BUILDING_PROFILES[buildingType] || BUILDING_PROFILES.office;
    const profileSum = profile.reduce((a, b) => a + b, 0);
    
    const monthlyData: MonthlyConsumption[] = profile.map((factor, month) => ({
      month,
      consumption: Math.round((annualKWh * factor) / profileSum),
    }));
    
    onEstimate(monthlyData);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2" data-testid="button-open-bill-estimator">
          <FileText className="h-4 w-4" />
          {language === "fr" ? "Estimer à partir d'une facture" : "Estimate from a bill"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" data-testid="dialog-bill-estimator">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            {language === "fr" ? "Estimation de consommation" : "Consumption Estimation"}
          </DialogTitle>
          <DialogDescription>
            {language === "fr" 
              ? "Générez un profil de consommation annuel à partir d'une seule facture"
              : "Generate an annual consumption profile from a single bill"}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="bill-amount">
              {language === "fr" ? "Montant de la facture ($)" : "Bill Amount ($)"}
            </Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="bill-amount"
                type="number"
                value={billAmount}
                onChange={(e) => setBillAmount(parseFloat(e.target.value) || 0)}
                className="pl-9"
                placeholder="5000"
                data-testid="input-bill-amount"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="billing-period">
              {language === "fr" ? "Période de facturation (mois)" : "Billing Period (months)"}
            </Label>
            <Select value={billingPeriod.toString()} onValueChange={(v) => setBillingPeriod(parseInt(v))}>
              <SelectTrigger data-testid="select-billing-period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">{language === "fr" ? "1 mois" : "1 month"}</SelectItem>
                <SelectItem value="2">{language === "fr" ? "2 mois" : "2 months"}</SelectItem>
                <SelectItem value="3">{language === "fr" ? "3 mois" : "3 months"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="building-type">
              {language === "fr" ? "Type de bâtiment" : "Building Type"}
            </Label>
            <Select value={buildingType} onValueChange={setBuildingType}>
              <SelectTrigger data-testid="select-building-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(labels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      {label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="tariff-code">
              {language === "fr" ? "Code tarifaire Hydro-Québec" : "Hydro-Québec Tariff Code"}
            </Label>
            <Select value={tariffCode} onValueChange={setTariffCode}>
              <SelectTrigger data-testid="select-tariff-code">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="G">{language === "fr" ? "G - Petite puissance (<65 kW)" : "G - Small power (<65 kW)"}</SelectItem>
                <SelectItem value="M">{language === "fr" ? "M - Moyenne puissance (65kW-5MW)" : "M - Medium power (65kW-5MW)"}</SelectItem>
                <SelectItem value="L">{language === "fr" ? "L - Grande puissance (>5MW)" : "L - Large power (>5MW)"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {estimatedAnnual !== null && (
            <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
              <p className="text-sm text-muted-foreground">
                {language === "fr" ? "Consommation annuelle estimée:" : "Estimated annual consumption:"}
              </p>
              <p className="text-2xl font-bold font-mono text-primary" data-testid="text-estimated-annual">
                {(estimatedAnnual / 1000).toFixed(0)} MWh
              </p>
            </div>
          )}
        </div>
        
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { calculateEstimate(); }} data-testid="button-calculate-estimate">
            <Calculator className="h-4 w-4 mr-1" />
            {language === "fr" ? "Calculer" : "Calculate"}
          </Button>
          <Button onClick={handleGenerate} disabled={!estimatedAnnual} data-testid="button-generate-profile">
            <BarChart3 className="h-4 w-4 mr-1" />
            {language === "fr" ? "Générer le profil" : "Generate Profile"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface KPIDashboardProps {
  pvSizeKW: number;
  productionMWh: number;
  coveragePercent: number;
  paybackYears: number;
  annualSavings: number;
  npv25: number;
  irr25: number;
  co2Tonnes: number;
}

export function KPIDashboard({
  pvSizeKW,
  productionMWh,
  coveragePercent,
  paybackYears,
  annualSavings,
  npv25,
  irr25,
  co2Tonnes,
}: KPIDashboardProps) {
  const { language } = useI18n();
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(language === "fr" ? "fr-CA" : "en-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0,
    }).format(value);
  };
  
  const kpis = [
    {
      icon: Sun,
      label: language === "fr" ? "Puissance installée" : "Installed Power",
      value: `${pvSizeKW.toFixed(0)} kWc`,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
    {
      icon: Zap,
      label: language === "fr" ? "Production annuelle" : "Annual Production",
      value: `${productionMWh.toFixed(0)} MWh`,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      icon: Percent,
      label: language === "fr" ? "Couverture énergétique" : "Energy Coverage",
      value: `${coveragePercent.toFixed(0)}%`,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      icon: Clock,
      label: language === "fr" ? "Temps de retour" : "Payback Period",
      value: paybackYears > 0 ? `${paybackYears.toFixed(1)} ${language === "fr" ? "ans" : "yrs"}` : "-",
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      icon: DollarSign,
      label: language === "fr" ? "Économies annuelles" : "Annual Savings",
      value: formatCurrency(annualSavings),
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      icon: TrendingUp,
      label: language === "fr" ? "VAN 25 ans" : "NPV 25 years",
      value: formatCurrency(npv25),
      color: npv25 >= 0 ? "text-green-600" : "text-red-500",
      bgColor: npv25 >= 0 ? "bg-green-500/10" : "bg-red-500/10",
    },
    {
      icon: Percent,
      label: language === "fr" ? "TRI" : "IRR",
      value: `${(irr25 * 100).toFixed(1)}%`,
      color: "text-indigo-500",
      bgColor: "bg-indigo-500/10",
    },
    {
      icon: Battery,
      label: language === "fr" ? "CO₂ évité/an" : "CO₂ Avoided/yr",
      value: `${co2Tonnes.toFixed(0)} t`,
      color: "text-teal-500",
      bgColor: "bg-teal-500/10",
    },
  ];

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent" data-testid="card-kpi-dashboard">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart3 className="h-5 w-5 text-primary" />
          {language === "fr" ? "Tableau de bord" : "Dashboard"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpis.map((kpi, i) => (
            <div 
              key={i} 
              className={`p-3 rounded-lg ${kpi.bgColor} border border-transparent hover:border-primary/20 transition-colors`}
              data-testid={`kpi-${i}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                <span className="text-xs text-muted-foreground truncate">{kpi.label}</span>
              </div>
              <p className={`text-lg font-bold font-mono ${kpi.color}`}>
                {kpi.value}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== SYNTHETIC PROFILE GENERATOR ====================

const BUILDING_SUB_TYPES = getAllBuildingTypes().map(t => t.key);

const BUILDING_SUB_LABELS = BUILDING_LABELS;

const SCHEDULE_LABELS = {
  fr: { standard: "Standard", extended: "Étendu", "24/7": "24h/7" },
  en: { standard: "Standard", extended: "Extended", "24/7": "24/7" },
};

const ENERGY_INTENSITY: Record<string, number> = Object.fromEntries(
  getAllBuildingTypes().map(t => [t.key, t.intensityKwhPerSqFt])
);

interface SyntheticProfileGeneratorProps {
  siteId: string;
  buildingSqFt?: number | null;
  roofAreaSqM?: number | null;
  buildingType?: string | null;
  clientWebsite?: string | null;
  onGenerated: () => void;
}

function deriveSchedule(key: string): string {
  const def = getBuildingTypeByKey(key);
  if (def.operatingStart === 0 && def.operatingEnd === 24) return "24/7";
  if ((def.operatingEnd - def.operatingStart) > 14) return "extended";
  return "standard";
}

export function SyntheticProfileGenerator({ siteId, buildingSqFt, roofAreaSqM, buildingType, clientWebsite, onGenerated }: SyntheticProfileGeneratorProps) {
  const { language } = useI18n();
  const { toast } = useToast();
  const labels = language === "fr" ? BUILDING_SUB_LABELS.fr : BUILDING_SUB_LABELS.en;
  const schedLabels = language === "fr" ? SCHEDULE_LABELS.fr : SCHEDULE_LABELS.en;

  const resolvedType = resolveBuildingTypeKey(buildingType || "");
  const [buildingSubType, setBuildingSubType] = useState<string>(resolvedType);
  const [operatingSchedule, setOperatingSchedule] = useState<string>(deriveSchedule(resolvedType));
  const [inputMode, setInputMode] = useState<string>("bill");
  const [billAmount, setBillAmount] = useState<number>(5000);
  const [billingPeriod, setBillingPeriod] = useState<number>(1);
  const [tariffCode, setTariffCode] = useState<string>("M");
  const [sqFt, setSqFt] = useState<number>(buildingSqFt || Math.round((roofAreaSqM || 0) * 10.764));
  const [directKWh, setDirectKWh] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzingWeb, setIsAnalyzingWeb] = useState(false);

  // Compute estimated annual kWh for preview
  const estimatedAnnual = (() => {
    if (inputMode === "direct" && directKWh > 0) return directKWh;
    if (inputMode === "area" && sqFt > 0) {
      return sqFt * (ENERGY_INTENSITY[buildingSubType] || 18);
    }
    if (inputMode === "bill" && billAmount > 0) {
      const rate = HQ_ENERGY_RATES[tariffCode] || 0.06061; // Default to M tariff
      const monthlyKWh = ((billAmount / billingPeriod) * 0.7) / rate;
      return Math.round(monthlyKWh * 12);
    }
    return 0;
  })();

  const handleAnalyzeWeb = async () => {
    if (!clientWebsite) return;
    setIsAnalyzingWeb(true);
    try {
      const result = await apiRequest<{
        buildingSubType: string;
        operatingSchedule: string;
        sector: string;
        confidence: number;
        reasoning: string;
      }>("POST", `/api/sites/${siteId}/analyze-company-website`, { url: clientWebsite });

      if (BUILDING_SUB_TYPES.includes(result.buildingSubType as any)) {
        setBuildingSubType(result.buildingSubType);
      }
      if (['standard', 'extended', '24/7'].includes(result.operatingSchedule)) {
        setOperatingSchedule(result.operatingSchedule);
      }

      toast({
        title: language === "fr" ? "Analyse terminée" : "Analysis complete",
        description: language === "fr"
          ? `Secteur: ${result.sector} (confiance: ${Math.round(result.confidence * 100)}%)`
          : `Sector: ${result.sector} (confidence: ${Math.round(result.confidence * 100)}%)`,
      });
    } catch (err: any) {
      toast({
        title: language === "fr" ? "Erreur d'analyse" : "Analysis error",
        description: err.message || "Failed to analyze website",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzingWeb(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const body: Record<string, unknown> = {
        buildingSubType,
        operatingSchedule,
      };

      if (inputMode === "direct" && directKWh > 0) {
        body.annualConsumptionKWh = directKWh;
      } else if (inputMode === "area" && sqFt > 0) {
        body.buildingSqFt = sqFt;
      } else if (inputMode === "bill" && billAmount > 0) {
        body.monthlyBill = billAmount / billingPeriod;
        body.tariffCode = tariffCode;
      }

      const result = await apiRequest<{
        meterFile: any;
        metadata: { annualConsumptionKWh: number; estimatedPeakKW: number };
        readingsCount: number;
      }>("POST", `/api/sites/${siteId}/generate-synthetic-profile`, body);

      toast({
        title: language === "fr" ? "Profil synthétique généré" : "Synthetic profile generated",
        description: language === "fr"
          ? `${(result.metadata.annualConsumptionKWh / 1000).toFixed(0)} MWh/an — ${result.readingsCount} points horaires`
          : `${(result.metadata.annualConsumptionKWh / 1000).toFixed(0)} MWh/yr — ${result.readingsCount} hourly data points`,
      });

      onGenerated();
    } catch (err: any) {
      toast({
        title: language === "fr" ? "Erreur" : "Error",
        description: err.message || "Failed to generate profile",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="border-amber-200 bg-gradient-to-br from-amber-50/50 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-600" />
          <CardTitle className="text-lg">
            {language === "fr" ? "Générer un profil synthétique" : "Generate Synthetic Profile"}
          </CardTitle>
        </div>
        <CardDescription>
          {language === "fr"
            ? "Créez un profil de consommation horaire estimé (8760 points) pour débloquer l'analyse complète"
            : "Create an estimated hourly consumption profile (8760 points) to unlock the full analysis"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Web analysis button */}
        {clientWebsite && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleAnalyzeWeb}
            disabled={isAnalyzingWeb}
            className="w-full gap-2"
          >
            {isAnalyzingWeb ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
            {language === "fr" ? "Pré-remplir depuis le site web" : "Pre-fill from website"}
          </Button>
        )}

        {/* Building type */}
        <div className="space-y-2">
          <Label>{language === "fr" ? "Type de bâtiment" : "Building type"}</Label>
          <Select value={buildingSubType} onValueChange={setBuildingSubType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUILDING_SUB_TYPES.map(type => (
                <SelectItem key={type} value={type}>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {labels[type]}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Operating schedule */}
        <div className="space-y-2">
          <Label>{language === "fr" ? "Horaire d'opération" : "Operating schedule"}</Label>
          <Select value={operatingSchedule} onValueChange={setOperatingSchedule}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(schedLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Consumption input — 3 modes */}
        <div className="space-y-2">
          <Label>{language === "fr" ? "Consommation annuelle estimée" : "Estimated annual consumption"}</Label>
          <Tabs value={inputMode} onValueChange={setInputMode}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="bill" className="text-xs gap-1">
                <DollarSign className="h-3 w-3" />
                {language === "fr" ? "Facture" : "Bill"}
              </TabsTrigger>
              <TabsTrigger value="area" className="text-xs gap-1">
                <Ruler className="h-3 w-3" />
                {language === "fr" ? "Superficie" : "Area"}
              </TabsTrigger>
              <TabsTrigger value="direct" className="text-xs gap-1">
                <Zap className="h-3 w-3" />
                kWh
              </TabsTrigger>
            </TabsList>

            <TabsContent value="bill" className="space-y-3 mt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{language === "fr" ? "Montant ($)" : "Amount ($)"}</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      type="number"
                      value={billAmount || ""}
                      onChange={(e) => setBillAmount(parseFloat(e.target.value) || 0)}
                      className="pl-8 h-9"
                      placeholder="5000"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{language === "fr" ? "Période (mois)" : "Period (months)"}</Label>
                  <Select value={billingPeriod.toString()} onValueChange={(v) => setBillingPeriod(parseInt(v))}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{language === "fr" ? "Code tarifaire" : "Tariff code"}</Label>
                <Select value={tariffCode} onValueChange={setTariffCode}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="G">G – {language === "fr" ? "Petite puissance" : "Small power"} (&lt;65 kW)</SelectItem>
                    <SelectItem value="M">M – {language === "fr" ? "Moyenne puissance" : "Medium power"} (65kW–5MW)</SelectItem>
                    <SelectItem value="L">L – {language === "fr" ? "Grande puissance" : "Large power"} (&gt;5MW)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="area" className="space-y-3 mt-3">
              <div className="space-y-1">
                <Label className="text-xs">{language === "fr" ? "Superficie (pi²)" : "Area (sq ft)"}</Label>
                <Input
                  type="number"
                  value={sqFt || ""}
                  onChange={(e) => setSqFt(parseFloat(e.target.value) || 0)}
                  placeholder="50000"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {language === "fr"
                  ? `Intensité: ${ENERGY_INTENSITY[buildingSubType] || 18} kWh/pi²/an pour ${labels[buildingSubType as keyof typeof labels]}`
                  : `Intensity: ${ENERGY_INTENSITY[buildingSubType] || 18} kWh/ft²/yr for ${labels[buildingSubType as keyof typeof labels]}`}
              </p>
            </TabsContent>

            <TabsContent value="direct" className="space-y-3 mt-3">
              <div className="space-y-1">
                <Label className="text-xs">{language === "fr" ? "Consommation annuelle (kWh)" : "Annual consumption (kWh)"}</Label>
                <Input
                  type="number"
                  value={directKWh || ""}
                  onChange={(e) => setDirectKWh(parseFloat(e.target.value) || 0)}
                  placeholder="500000"
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Preview */}
        {estimatedAnnual > 0 && (
          <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {language === "fr" ? "Consommation estimée:" : "Estimated consumption:"}
              </span>
              <Badge variant="secondary" className="font-mono text-base">
                {(estimatedAnnual / 1000).toFixed(0)} MWh/{language === "fr" ? "an" : "yr"}
              </Badge>
            </div>
          </div>
        )}

        {/* Warning banner */}
        <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-md">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800">
            {language === "fr"
              ? "Ce profil est une estimation basée sur des archétypes. Il ne remplace pas les données réelles d'Hydro-Québec."
              : "This profile is an estimate based on archetypes. It does not replace real Hydro-Québec data."}
          </p>
        </div>

        {/* Generate button */}
        <Button
          className="w-full gap-2"
          onClick={handleGenerate}
          disabled={isGenerating || estimatedAnnual <= 0}
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <BarChart3 className="h-4 w-4" />
          )}
          {language === "fr"
            ? isGenerating ? "Génération en cours..." : "Générer le profil (8760 points)"
            : isGenerating ? "Generating..." : "Generate profile (8760 points)"}
        </Button>
      </CardContent>
    </Card>
  );
}
