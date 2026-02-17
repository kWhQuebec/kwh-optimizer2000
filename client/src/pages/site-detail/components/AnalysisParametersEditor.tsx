import React, { useState } from "react";
import {
  Settings,
  ChevronDown,
  ChevronUp,
  DollarSign,
  TrendingUp,
  Sun,
  Snowflake,
  Info,
  Layers,
  Percent,
  Calculator,
  Battery,
  Home,
  Pencil,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import type { AnalysisAssumptions, Site, RoofPolygon } from "@shared/schema";
import { defaultAnalysisAssumptions, getBifacialConfigFromRoofColor } from "@shared/schema";
import { getTariffRates } from "../utils";

interface AnalysisParametersEditorProps {
  value: Partial<AnalysisAssumptions>;
  onChange: (value: Partial<AnalysisAssumptions>) => void;
  disabled?: boolean;
  site?: Site;
  showOnlyRoofSection?: boolean;
  onOpenRoofDrawing?: () => void;
  onGeocodeAndDraw?: () => void;
  roofPolygons?: RoofPolygon[];
}

export function AnalysisParametersEditor({
  value,
  onChange,
  disabled = false,
  site,
  showOnlyRoofSection = false,
  onOpenRoofDrawing,
  onGeocodeAndDraw,
  roofPolygons = []
}: AnalysisParametersEditorProps) {
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

              {/* Snow Loss Profile Section */}
              <div className="pt-3 border-t border-dashed space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Snowflake className="w-4 h-4 text-primary" />
                    {language === "fr" ? "Pertes de neige" : "Snow Losses"}
                  </Label>
                  <select
                    value={merged.snowLossProfile || "none"}
                    onChange={(e) => onChange({ ...value, snowLossProfile: e.target.value as 'none' | 'flat_roof' })}
                    disabled={disabled}
                    className="h-8 text-sm rounded-md border border-input bg-background px-3 py-1 focus:outline-none focus:ring-2 focus:ring-ring"
                    data-testid="select-snow-loss-profile"
                  >
                    <option value="none">{language === "fr" ? "Aucun" : "None"}</option>
                    <option value="flat_roof">
                      {language === "fr"
                        ? "Toit plat (jan-f\u00E9v 100%, mars 70%, d\u00E9c 50%)"
                        : "Flat roof (Jan-Feb 100%, Mar 70%, Dec 50%)"}
                    </option>
                  </select>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  {language === "fr"
                    ? "Appliquer un profil de pertes saisonni\u00E8res dues \u00E0 la neige. D\u00E9sactiv\u00E9 par d\u00E9faut (la plupart des syst\u00E8mes C&I \u00E9vacuent la neige efficacement)."
                    : "Apply seasonal snow loss profile. Off by default (most C&I systems shed snow effectively)."}
                </p>
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
                      onClick={() => {
                        if (site?.latitude && site?.longitude) {
                          onOpenRoofDrawing?.();
                        } else {
                          onGeocodeAndDraw?.();
                        }
                      }}
                      disabled={disabled}
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
