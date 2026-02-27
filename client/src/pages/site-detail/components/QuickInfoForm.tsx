import { useState, useCallback, useRef, useEffect } from "react";
import {
  Building2,
  Store,
  GraduationCap,
  HelpCircle,
  Layers,
  Mountain,
  CircleDot,
  Droplets,
  Ruler,
  DollarSign,
  Zap,
  LayoutGrid,
  Upload,
  ArrowRight,
  CheckCircle2,
  ArrowUpDown,
  Grip,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SiteWithDetails } from "../types";

interface QuickInfoFormProps {
  site: SiteWithDetails;
  language: "fr" | "en";
  onSaved: () => void;
  onGoToNextStep?: () => void;
}

const SQ_FT_TO_SQ_M = 0.092903;
const SQ_M_TO_SQ_FT = 10.7639;

const BUILDING_TYPES = [
  { value: "industrial", labelFr: "Industriel", labelEn: "Industrial", Icon: Building2 },
  { value: "commercial", labelFr: "Commercial", labelEn: "Commercial", Icon: Store },
  { value: "institutional", labelFr: "Institutionnel", labelEn: "Institutional", Icon: GraduationCap },
  { value: "other", labelFr: "Autre", labelEn: "Other", Icon: HelpCircle },
];

const ROOF_SHAPES = [
  { value: "flat", labelFr: "Toit plat", labelEn: "Flat roof", Icon: Layers },
  { value: "inclined", labelFr: "Toit incliné", labelEn: "Inclined roof", Icon: Mountain },
];

const ROOF_COVERINGS = [
  { value: "white_membrane", labelFr: "Membrane blanche", labelEn: "White membrane", Icon: CircleDot },
  { value: "gravel", labelFr: "Gravier", labelEn: "Gravel", Icon: Droplets },
  { value: "shingle", labelFr: "Bardeau", labelEn: "Shingle", Icon: Grip },
  { value: "metal", labelFr: "Tôle / métal", labelEn: "Metal", Icon: Layers },
];

const FLOOR_OPTIONS = [1, 2, 3, 4, 5];
const HEIGHT_OPTIONS = [14, 20, 30, 40, 50];

export function QuickInfoForm({ site, language, onSaved, onGoToNextStep }: QuickInfoFormProps) {
  const fr = language === "fr";

  const [buildingType, setBuildingType] = useState<string | null>(site.buildingType || null);
  const [roofShape, setRoofShape] = useState<string | null>(site.roofType || null);
  const [roofCovering, setRoofCovering] = useState<string | null>(site.roofColorType || null);
  const [useMetric, setUseMetric] = useState(true);
  const [roofAreaSqM, setRoofAreaSqM] = useState<number>(site.roofAreaSqM || 2000);
  const [estimatedMonthlyBill, setEstimatedMonthlyBill] = useState<number>(site.estimatedMonthlyBill || 2000);
  const [estimatedAnnualConsumptionKwh, setEstimatedAnnualConsumptionKwh] = useState<string>(
    site.estimatedAnnualConsumptionKwh ? String(Math.round(site.estimatedAnnualConsumptionKwh)) : ""
  );
  const [numFloors, setNumFloors] = useState<number | null>(site.numFloors || null);
  const [buildingHeightFt, setBuildingHeightFt] = useState<string>(
    site.buildingHeightFt ? String(Math.round(site.buildingHeightFt)) : ""
  );
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const pendingChangesRef = useRef<Record<string, unknown>>({});
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    if (site.roofAreaSqM && site.roofAreaSqM !== roofAreaSqM) {
      setRoofAreaSqM(site.roofAreaSqM);
    }
  }, [site.roofAreaSqM]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const hasMinimumData = !!(
    buildingType ||
    (roofAreaSqM && roofAreaSqM !== 2000) ||
    (estimatedMonthlyBill && estimatedMonthlyBill !== 2000) ||
    estimatedAnnualConsumptionKwh
  );

  const doSave = useCallback(async (fields: Record<string, unknown>) => {
    if (!isMountedRef.current) return;
    setSaveStatus("saving");

    const hasMeaningful = !!(
      fields.buildingType ||
      (fields.roofAreaSqM && fields.roofAreaSqM !== 2000) ||
      (fields.estimatedMonthlyBill && fields.estimatedMonthlyBill !== 2000) ||
      fields.estimatedAnnualConsumptionKwh
    );

    const payload: Record<string, unknown> = { ...fields };
    if (hasMeaningful && !site.quickInfoCompletedAt) {
      payload.quickInfoCompletedAt = new Date().toISOString();
    }

    try {
      await apiRequest("PATCH", `/api/sites/${site.id}`, payload);
      if (isMountedRef.current) {
        setSaveStatus("saved");
        setTimeout(() => {
          if (isMountedRef.current) setSaveStatus("idle");
        }, 2000);
        queryClient.invalidateQueries({ queryKey: ["/api/sites", site.id] });
        onSaved();
      }
    } catch {
      if (isMountedRef.current) setSaveStatus("idle");
    }
  }, [site.id, site.quickInfoCompletedAt, onSaved]);

  const scheduleAutoSave = useCallback((fieldUpdates: Record<string, unknown>) => {
    Object.assign(pendingChangesRef.current, fieldUpdates);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      const changes = { ...pendingChangesRef.current };
      pendingChangesRef.current = {};
      doSave(changes);
    }, 1000);
  }, [doSave]);

  const handleBuildingType = (value: string) => {
    setBuildingType(value);
    scheduleAutoSave({ buildingType: value });
  };

  const handleRoofShape = (value: string) => {
    const newVal = roofShape === value ? null : value;
    setRoofShape(newVal);
    scheduleAutoSave({ roofType: newVal });
  };

  const handleRoofCovering = (value: string) => {
    const newVal = roofCovering === value ? null : value;
    setRoofCovering(newVal);
    scheduleAutoSave({ roofColorType: newVal });
  };

  const handleRoofAreaChange = (valueSqM: number) => {
    setRoofAreaSqM(valueSqM);
    scheduleAutoSave({ roofAreaSqM: valueSqM });
  };

  const handleRoofAreaSlider = (values: number[]) => {
    const rawValue = values[0];
    if (useMetric) {
      handleRoofAreaChange(rawValue);
    } else {
      handleRoofAreaChange(Math.round(rawValue * SQ_FT_TO_SQ_M));
    }
  };

  const handleRoofAreaInput = (val: string) => {
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 0) return;
    if (useMetric) {
      handleRoofAreaChange(num);
    } else {
      handleRoofAreaChange(Math.round(num * SQ_FT_TO_SQ_M));
    }
  };

  const handleMonthlyBillSlider = (values: number[]) => {
    setEstimatedMonthlyBill(values[0]);
    scheduleAutoSave({ estimatedMonthlyBill: values[0] });
  };

  const handleMonthlyBillInput = (val: string) => {
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 0) return;
    setEstimatedMonthlyBill(num);
    scheduleAutoSave({ estimatedMonthlyBill: num });
  };

  const handleAnnualConsumption = (val: string) => {
    setEstimatedAnnualConsumptionKwh(val);
    const num = parseInt(val, 10);
    if (val === "") {
      scheduleAutoSave({ estimatedAnnualConsumptionKwh: null });
    } else if (!isNaN(num) && num >= 0) {
      scheduleAutoSave({ estimatedAnnualConsumptionKwh: num });
    }
  };

  const handleNumFloors = (value: number) => {
    const newVal = numFloors === value ? null : value;
    setNumFloors(newVal);
    scheduleAutoSave({ numFloors: newVal });
  };

  const handleHeightQuickPick = (value: number) => {
    const currentNum = buildingHeightFt ? parseInt(buildingHeightFt, 10) : null;
    if (currentNum === value) {
      setBuildingHeightFt("");
      scheduleAutoSave({ buildingHeightFt: null });
    } else {
      setBuildingHeightFt(String(value));
      scheduleAutoSave({ buildingHeightFt: value });
    }
  };

  const handleHeightInput = (val: string) => {
    setBuildingHeightFt(val);
    const num = parseInt(val, 10);
    if (val === "") {
      scheduleAutoSave({ buildingHeightFt: null });
    } else if (!isNaN(num) && num > 0) {
      scheduleAutoSave({ buildingHeightFt: num });
    }
  };

  const displayArea = useMetric ? roofAreaSqM : Math.round(roofAreaSqM * SQ_M_TO_SQ_FT);
  const sliderArea = useMetric ? roofAreaSqM : Math.round(roofAreaSqM * SQ_M_TO_SQ_FT);
  const sliderMax = useMetric ? 50000 : Math.round(50000 * SQ_M_TO_SQ_FT);
  const sliderMin = useMetric ? 500 : Math.round(500 * SQ_M_TO_SQ_FT);
  const conversionText = useMetric
    ? `= ${Math.round(roofAreaSqM * SQ_M_TO_SQ_FT).toLocaleString()} pi\u00b2`
    : `= ${roofAreaSqM.toLocaleString()} m\u00b2`;

  const heightNum = buildingHeightFt ? parseInt(buildingHeightFt, 10) : null;

  return (
    <div className="space-y-6">
      {saveStatus === "saved" && (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 className="w-4 h-4" />
          <span data-testid="text-save-status">{fr ? "Sauvegard\u00e9" : "Saved"}</span>
        </div>
      )}

      <div>
        <Label className="flex items-center gap-2 mb-3 text-base font-medium">
          <Building2 className="w-4 h-4" />
          {fr ? "Type de b\u00e2timent" : "Building type"}
        </Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {BUILDING_TYPES.map((bt) => (
            <Card
              key={bt.value}
              className={`cursor-pointer toggle-elevate ${buildingType === bt.value ? "toggle-elevated border-primary" : ""}`}
              onClick={() => handleBuildingType(bt.value)}
              data-testid={`card-building-type-${bt.value}`}
            >
              <CardContent className="flex flex-col items-center justify-center gap-2 p-4">
                <bt.Icon className="w-6 h-6" />
                <span className="text-sm font-medium text-center">
                  {fr ? bt.labelFr : bt.labelEn}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <Label className="flex items-center gap-2 mb-3 text-base font-medium">
          <Layers className="w-4 h-4" />
          {fr ? "Forme de toiture" : "Roof shape"}
        </Label>
        <div className="flex items-center gap-2 flex-wrap">
          {ROOF_SHAPES.map((rs) => (
            <Button
              key={rs.value}
              variant="outline"
              className={`toggle-elevate gap-2 ${roofShape === rs.value ? "toggle-elevated border-primary" : ""}`}
              onClick={() => handleRoofShape(rs.value)}
              data-testid={`button-roof-shape-${rs.value}`}
            >
              <rs.Icon className="w-4 h-4" />
              {fr ? rs.labelFr : rs.labelEn}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <Label className="flex items-center gap-2 mb-3 text-base font-medium">
          <CircleDot className="w-4 h-4" />
          {fr ? "Rev\u00eatement de toiture" : "Roof covering"}
        </Label>
        <div className="flex items-center gap-2 flex-wrap">
          {ROOF_COVERINGS.map((rc) => (
            <Button
              key={rc.value}
              variant="outline"
              className={`toggle-elevate gap-2 ${roofCovering === rc.value ? "toggle-elevated border-primary" : ""}`}
              onClick={() => handleRoofCovering(rc.value)}
              data-testid={`button-roof-covering-${rc.value}`}
            >
              <rc.Icon className="w-4 h-4" />
              {fr ? rc.labelFr : rc.labelEn}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <Label className="flex items-center gap-2 mb-3 text-base font-medium">
          <Ruler className="w-4 h-4" />
          {fr ? "Superficie de toiture estim\u00e9e" : "Estimated roof area"}
        </Label>
        <div className="flex items-center gap-3 mb-3">
          <Input
            type="number"
            value={displayArea}
            onChange={(e) => handleRoofAreaInput(e.target.value)}
            className="w-32"
            data-testid="input-roof-area"
          />
          <span className="text-sm font-medium">{useMetric ? "m\u00b2" : "pi\u00b2"}</span>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-muted-foreground">pi\u00b2</span>
            <Switch
              checked={useMetric}
              onCheckedChange={setUseMetric}
              data-testid="switch-area-unit"
            />
            <span className="text-xs text-muted-foreground">m\u00b2</span>
          </div>
        </div>
        <Slider
          min={sliderMin}
          max={sliderMax}
          step={useMetric ? 100 : 500}
          value={[sliderArea]}
          onValueChange={handleRoofAreaSlider}
          className="mb-2"
          data-testid="slider-roof-area"
        />
        <p className="text-sm text-muted-foreground">{conversionText}</p>
      </div>

      <div>
        <Label className="flex items-center gap-2 mb-3 text-base font-medium">
          <DollarSign className="w-4 h-4" />
          {fr ? "Facture d'\u00e9lectricit\u00e9 mensuelle estim\u00e9e" : "Estimated monthly electricity bill"}
        </Label>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-sm font-medium">$</span>
          <Input
            type="number"
            value={estimatedMonthlyBill}
            onChange={(e) => handleMonthlyBillInput(e.target.value)}
            className="w-32"
            data-testid="input-monthly-bill"
          />
          <span className="text-sm text-muted-foreground">/ {fr ? "mois" : "month"}</span>
        </div>
        <Slider
          min={500}
          max={50000}
          step={100}
          value={[estimatedMonthlyBill]}
          onValueChange={handleMonthlyBillSlider}
          data-testid="slider-monthly-bill"
        />
      </div>

      <div>
        <Label className="flex items-center gap-2 mb-3 text-base font-medium">
          <Zap className="w-4 h-4" />
          {fr ? "Consommation annuelle estim\u00e9e" : "Estimated annual consumption"}
        </Label>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            value={estimatedAnnualConsumptionKwh}
            onChange={(e) => handleAnnualConsumption(e.target.value)}
            placeholder={fr ? "Ex: 500000" : "Ex: 500000"}
            className="w-40"
            data-testid="input-annual-consumption"
          />
          <span className="text-sm text-muted-foreground">kWh / {fr ? "an" : "year"}</span>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          {fr
            ? "Si vous ne connaissez pas ce chiffre, laissez vide \u2014 nous l'estimerons \u00e0 partir de vos factures."
            : "If you don't know this number, leave it blank \u2014 we'll estimate it from your bills."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label className="flex items-center gap-2 mb-3 text-base font-medium">
            <LayoutGrid className="w-4 h-4" />
            {fr ? "Nombre d'\u00e9tages" : "Number of floors"}
          </Label>
          <div className="flex items-center gap-2 flex-wrap">
            {FLOOR_OPTIONS.map((n) => (
              <Button
                key={n}
                variant="outline"
                className={`toggle-elevate ${numFloors === n ? "toggle-elevated border-primary" : ""}`}
                onClick={() => handleNumFloors(n)}
                data-testid={`button-floors-${n}`}
              >
                {n === 5 ? "5+" : n}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <Label className="flex items-center gap-2 mb-3 text-base font-medium">
            <ArrowUpDown className="w-4 h-4" />
            {fr ? "Hauteur du b\u00e2timent" : "Building height"}
          </Label>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {HEIGHT_OPTIONS.map((h) => (
              <Button
                key={h}
                variant="outline"
                className={`toggle-elevate ${heightNum === h ? "toggle-elevated border-primary" : ""}`}
                onClick={() => handleHeightQuickPick(h)}
                data-testid={`button-height-${h}`}
              >
                {h}'
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={buildingHeightFt}
              onChange={(e) => handleHeightInput(e.target.value)}
              placeholder={fr ? "Autre" : "Other"}
              className="w-24"
              data-testid="input-building-height"
            />
            <span className="text-sm text-muted-foreground">{fr ? "pieds" : "feet"}</span>
          </div>
        </div>
      </div>

      <Card className="border-dashed" data-testid="card-upload-prompt">
        <CardContent className="flex items-center gap-4 p-4">
          <Upload className="w-8 h-8 text-muted-foreground shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">
              {fr
                ? "Vous avez une facture Hydro-Qu\u00e9bec? Passez \u00e0 l'\u00e9tape 2 pour l'importer."
                : "Have a Hydro-Qu\u00e9bec bill? Go to Step 2 to import it."}
            </p>
          </div>
          <Button variant="outline" size="sm" data-testid="button-import-bill">
            {fr ? "Importer ma facture" : "Import my bill"}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </CardContent>
      </Card>

      {(hasMinimumData || site.quickInfoCompletedAt) && (
        <div
          className={`flex items-center gap-3 rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950 p-4 ${onGoToNextStep ? 'cursor-pointer hover-elevate' : ''}`}
          data-testid="banner-quick-info-complete"
          onClick={onGoToNextStep}
        >
          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
          <p className="text-sm text-green-700 dark:text-green-300 flex-1">
            {fr
              ? "Informations de base enregistr\u00e9es. Passez \u00e0 l'\u00e9tape suivante pour importer vos donn\u00e9es de consommation."
              : "Basic information saved. Move to the next step to import your consumption data."}
          </p>
          {onGoToNextStep && (
            <Button
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={(e) => { e.stopPropagation(); onGoToNextStep(); }}
              data-testid="button-go-to-step-2"
            >
              {fr ? "\u00c9tape suivante" : "Next step"}
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
