import React, { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Copy, Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SimulationRun, AnalysisAssumptions } from "@shared/schema";
import { defaultAnalysisAssumptions } from "@shared/schema";
import type { VariantPreset } from "../types";

export function CreateVariantDialog({
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
