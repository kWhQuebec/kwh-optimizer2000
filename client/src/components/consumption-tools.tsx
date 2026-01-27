import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
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
  Building2
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

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

const BUILDING_PROFILES: Record<string, number[]> = {
  office: [1.0, 1.0, 1.0, 0.95, 0.9, 0.85, 0.8, 0.85, 0.95, 1.0, 1.05, 1.1],
  warehouse: [0.95, 0.95, 1.0, 1.0, 1.0, 1.05, 1.1, 1.1, 1.0, 1.0, 0.95, 0.9],
  retail: [1.15, 1.0, 0.95, 0.9, 0.85, 0.8, 0.85, 0.9, 0.95, 1.0, 1.15, 1.4],
  industrial: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
  healthcare: [1.0, 1.0, 1.0, 0.95, 0.9, 0.95, 1.0, 1.0, 0.95, 1.0, 1.05, 1.1],
  education: [1.1, 1.1, 1.0, 0.9, 0.7, 0.5, 0.4, 0.5, 1.0, 1.1, 1.1, 1.2],
};

const BUILDING_LABELS = {
  fr: {
    office: "Bureau",
    warehouse: "Entrepôt",
    retail: "Commerce",
    industrial: "Industriel",
    healthcare: "Santé",
    education: "Éducation",
  },
  en: {
    office: "Office",
    warehouse: "Warehouse",
    retail: "Retail",
    industrial: "Industrial",
    healthcare: "Healthcare",
    education: "Education",
  },
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
    const energyRate = HQ_ENERGY_RATES[tariffCode] || 0.06;
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
