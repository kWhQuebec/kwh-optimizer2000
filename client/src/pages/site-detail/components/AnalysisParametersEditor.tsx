import React, { useState, useEffect, Fragment } from "react";
import {
  Settings,
  ChevronDown,
  ChevronUp,
  DollarSign,
  TrendingUp,
  Sun,
  Info,
  Layers,
  Percent,
  Calculator,
  Battery,
  Home,
  Satellite,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Grid3X3,
  Pencil,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import type { AnalysisAssumptions, Site, RoofPolygon } from "@shared/schema";
import { defaultAnalysisAssumptions, getBifacialConfigFromRoofColor } from "@shared/schema";
import { getTariffRates } from "../utils";

interface AnalysisParametersEditorProps {
  value: Partial<AnalysisAssumptions>;
  onChange: (value: Partial<AnalysisAssumptions>) => void;
  disabled?: boolean;
  site?: Site;
  onSiteRefresh?: () => void;
  showOnlyRoofSection?: boolean;
  onOpenRoofDrawing?: () => void;
  roofPolygons?: RoofPolygon[];
}

export function AnalysisParametersEditor({
  value,
  onChange,
  disabled = false,
  site,
  onSiteRefresh,
  showOnlyRoofSection = false,
  onOpenRoofDrawing,
  roofPolygons = []
}: AnalysisParametersEditorProps) {
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
                <Settings className="w-5 h-5 text-muted-foreground" />
                <CardTitle className="text-lg">
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
                  ? "Les tarifs sont basés sur la grille Hydro-Québec avril 2025. Vous pouvez les ajuster manuellement."
                  : "Tariffs based on Hydro-Québec April 2025 rates. You can adjust them manually."}
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
                // Use roof color-based bifacial config instead of fixed 15%
                const bifacialConfig = getBifacialConfigFromRoofColor(site?.roofColorType);
                const bifacialBoost = merged.bifacialEnabled ? bifacialConfig.boost : 1.0;
                const grossYield = Math.round(baseYield * orientationFactor * bifacialBoost);
                const bifacialLabel = merged.bifacialEnabled && bifacialConfig.boostPercent > 0
                  ? ` (+${bifacialConfig.boostPercent}% bifacial)`
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

              {/* Bifacial PV Section - Roof color-based recommendation */}
              {(() => {
                const bifacialConfig = getBifacialConfigFromRoofColor(site?.roofColorType);
                return (
                  <div className="pt-3 border-t border-dashed space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Layers className="w-4 h-4 text-primary" />
                        {language === "fr" ? "Panneaux bifaciaux" : "Bifacial Panels"}
                        {bifacialConfig.recommended && (
                          <Badge variant="secondary" className="text-xs">
                            {language === "fr" ? "Recommandé" : "Recommended"}
                          </Badge>
                        )}
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
                            ? (language === "fr"
                                ? `Activé (+${bifacialConfig.boostPercent}%)`
                                : `Enabled (+${bifacialConfig.boostPercent}%)`)
                            : (language === "fr" ? "Désactivé" : "Disabled")}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      {language === "fr" ? bifacialConfig.reason.fr : bifacialConfig.reason.en}
                    </p>
                  </div>
                );
              })()}
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
                  <Label className="text-xs">{language === "fr" ? "Inflation tarif Hydro-Québec (%)" : "Hydro-Québec Tariff Inflation (%)"}</Label>
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
                  <Label className="text-xs">{language === "fr" ? "O&M Stockage (% CAPEX)" : "Storage O&M (% CAPEX)"}</Label>
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

            {/* Storage Replacement Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Battery className="w-4 h-4 text-primary" />
                {language === "fr" ? "Remplacement de stockage" : "Storage Replacement"}
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
                            {(() => {
                              // Helper function to calculate quality score
                              const getQualityScore = (seg: any) => {
                                const azimuth = seg.azimuthDegrees || 0;
                                const pitch = seg.pitchDegrees || 0;
                                const azimuthScore = Math.max(0, 100 - Math.abs(azimuth - 180) * 0.8);
                                const pitchScore = Math.max(0, 100 - Math.abs(pitch - 32) * 3);
                                return (azimuthScore * 0.6 + pitchScore * 0.4);
                              };

                              // Sort segments by quality score (best first) for optimal orientation display
                              const sortedSegments = [...segments].sort((a: any, b: any) =>
                                getQualityScore(b) - getQualityScore(a)
                              );

                              return sortedSegments.slice(0, 6).map((seg: any, idx: number) => {
                                const azimuth = seg.azimuthDegrees || 0;
                                const pitch = seg.pitchDegrees || 0;
                                const area = seg.stats?.areaMeters2 || 0;
                                const isOptimal = idx === 0;

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
                                const qualityScore = getQualityScore(seg);

                                // Get quality color
                                let qualityColor = "bg-red-500";
                                let qualityLabel = "⚠";
                                if (qualityScore >= 80) { qualityColor = "bg-green-500"; qualityLabel = "★★★"; }
                                else if (qualityScore >= 60) { qualityColor = "bg-amber-400"; qualityLabel = "★★"; }
                                else if (qualityScore >= 40) { qualityColor = "bg-orange-400"; qualityLabel = "★"; }

                                return (
                                  <Fragment key={idx}>
                                    <div className={`font-mono ${isOptimal ? "text-primary font-bold" : ""}`}>
                                      {isOptimal ? "★" : idx + 1}
                                    </div>
                                    <div className={`font-mono ${isOptimal ? "text-primary font-semibold" : ""}`}>{Math.round(area)} m²</div>
                                    <div className={`font-mono ${isOptimal ? "text-primary font-semibold" : ""}`}>{orientation}</div>
                                    <div className={`font-mono ${isOptimal ? "text-primary font-semibold" : ""}`}>{Math.round(pitch)}°</div>
                                    <div className="flex items-center gap-1">
                                      <div
                                        className={`w-2 h-2 rounded-full ${qualityColor}`}
                                        title={`${Math.round(qualityScore)}% - ${orientation} @ ${Math.round(pitch)}°`}
                                      />
                                      <span className="text-[10px]">{qualityLabel}</span>
                                    </div>
                                  </Fragment>
                                );
                              });
                            })()}
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

                          {/* Local irradiance data from Google Solar API - only show sunshine/yield, not panel counts (C&I buildings need manual sizing) */}
                          {maxSunshine ? (
                            <div className="pt-2 border-t border-dashed">
                              <div className="flex items-center gap-2 mb-1">
                                <Sun className="w-3.5 h-3.5 text-amber-500" />
                                <span className="text-xs font-medium">
                                  {language === "fr" ? "Irradiance locale" : "Local Irradiance"}
                                </span>
                              </div>
                              <p className="text-xs">
                                <span className="text-muted-foreground">{language === "fr" ? "Ensoleillement" : "Sunshine"}: </span>
                                <span className="font-mono font-medium">{Math.round(maxSunshine).toLocaleString()} h/{language === "fr" ? "an" : "year"}</span>
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-1">
                                {language === "fr"
                                  ? "Données d'irradiance Google Solar. Le dimensionnement C&I utilise la surface de toit tracée."
                                  : "Google Solar irradiance data. C&I sizing uses manually traced roof area."}
                              </p>
                            </div>
                          ) : (
                            <div className="pt-2 border-t border-dashed">
                              <div className="flex items-center gap-2 mb-1">
                                <Grid3X3 className="w-3.5 h-3.5 text-teal-500" />
                                <span className="text-xs font-medium">
                                  {language === "fr" ? "Estimation algorithmique" : "Algorithmic Estimate"}
                                </span>
                              </div>
                              <p className="text-[10px] text-muted-foreground">
                                {language === "fr"
                                  ? "Données d'irradiance non disponibles. Le dimensionnement utilise le rendement standard de 1035 kWh/kWp pour le Québec."
                                  : "Irradiance data not available. Sizing uses standard Quebec yield of 1035 kWh/kWp."}
                              </p>
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
