import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Trash2, BarChart3, Loader2 } from "lucide-react";
import type { Benchmark, SimulationRun } from "@shared/schema";

type SimulationRunSummary = Omit<SimulationRun, 'cashflows' | 'breakdown' | 'hourlyProfile' | 'peakWeekData' | 'sensitivity'>;

interface BenchmarkTabProps {
  siteId: string;
  simulationRuns: SimulationRunSummary[];
}

export function BenchmarkTab({ siteId, simulationRuns }: BenchmarkTabProps) {
  const { language } = useI18n();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string>(simulationRuns[0]?.id || "");

  const [form, setForm] = useState({
    toolName: "",
    reportDate: "",
    analyst: "",
    simPvSizeKW: "",
    simAnnualProductionKWh: "",
    simYieldKWhPerKWp: "",
    simPerformanceRatio: "",
    simSpecificYieldP50: "",
    simSpecificYieldP90: "",
    simCapexTotal: "",
    simDcAcRatio: "",
    notes: "",
  });

  const { data: benchmarks = [], isLoading } = useQuery<Benchmark[]>({
    queryKey: ['/api/sites', siteId, 'benchmarks'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return apiRequest<Benchmark>("POST", `/api/sites/${siteId}/benchmarks`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sites', siteId, 'benchmarks'] });
      toast({ title: language === "fr" ? "Benchmark ajouté" : "Benchmark added" });
      setShowForm(false);
      setForm({ toolName: "", reportDate: "", analyst: "", simPvSizeKW: "", simAnnualProductionKWh: "", simYieldKWhPerKWp: "", simPerformanceRatio: "", simSpecificYieldP50: "", simSpecificYieldP90: "", simCapexTotal: "", simDcAcRatio: "", notes: "" });
    },
    onError: () => {
      toast({ title: language === "fr" ? "Erreur" : "Error", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/benchmarks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sites', siteId, 'benchmarks'] });
      toast({ title: language === "fr" ? "Benchmark supprimé" : "Benchmark deleted" });
    },
  });

  const autoYield = useMemo(() => {
    const prod = parseFloat(form.simAnnualProductionKWh);
    const size = parseFloat(form.simPvSizeKW);
    if (prod > 0 && size > 0) return (prod / size).toFixed(1);
    return "";
  }, [form.simAnnualProductionKWh, form.simPvSizeKW]);

  const handleSubmit = () => {
    if (!form.toolName) return;
    const data: Record<string, unknown> = {
      siteId,
      toolName: form.toolName,
      simulationRunId: selectedRunId || null,
    };
    if (form.reportDate) data.reportDate = form.reportDate;
    if (form.analyst) data.analyst = form.analyst;
    if (form.simPvSizeKW) data.simPvSizeKW = parseFloat(form.simPvSizeKW);
    if (form.simAnnualProductionKWh) data.simAnnualProductionKWh = parseFloat(form.simAnnualProductionKWh);
    if (form.simYieldKWhPerKWp || autoYield) data.simYieldKWhPerKWp = parseFloat(form.simYieldKWhPerKWp || autoYield);
    if (form.simPerformanceRatio) data.simPerformanceRatio = parseFloat(form.simPerformanceRatio) / 100;
    if (form.simSpecificYieldP50) data.simSpecificYieldP50 = parseFloat(form.simSpecificYieldP50);
    if (form.simSpecificYieldP90) data.simSpecificYieldP90 = parseFloat(form.simSpecificYieldP90);
    if (form.simCapexTotal) data.simCapexTotal = parseFloat(form.simCapexTotal);
    if (form.simDcAcRatio) data.simDcAcRatio = parseFloat(form.simDcAcRatio);
    if (form.notes) data.notes = form.notes;
    createMutation.mutate(data);
  };

  const selectedRun = simulationRuns.find(r => r.id === selectedRunId);

  const getDeltaColor = (deltaPercent: number | null) => {
    if (deltaPercent === null) return "";
    const abs = Math.abs(deltaPercent);
    if (abs <= 5) return "text-green-600 dark:text-green-400";
    if (abs <= 15) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getDeltaBadgeVariant = (deltaPercent: number | null): "default" | "secondary" | "destructive" | "outline" => {
    if (deltaPercent === null) return "secondary";
    const abs = Math.abs(deltaPercent);
    if (abs <= 5) return "default";
    if (abs <= 15) return "outline";
    return "destructive";
  };

  const formatVal = (v: number | null | undefined, unit?: string) => {
    if (v === null || v === undefined) return "—";
    const formatted = v >= 1000 ? v.toLocaleString(language === "fr" ? "fr-CA" : "en-CA", { maximumFractionDigits: 0 }) : v.toFixed(1);
    return unit ? `${formatted} ${unit}` : formatted;
  };

  const comparisonRows = useMemo(() => {
    if (!benchmarks.length || !selectedRun) return [];

    const latestBenchmark = benchmarks[0];
    const runYield = selectedRun.pvSizeKW && selectedRun.totalProductionKWh
      ? selectedRun.totalProductionKWh / selectedRun.pvSizeKW
      : null;

    const metrics: Array<{
      label: { fr: string; en: string };
      kwhQc: number | null;
      sim: number | null;
      unit?: string;
      isPercent?: boolean;
    }> = [
      {
        label: { fr: "Taille PV (kW)", en: "PV Size (kW)" },
        kwhQc: selectedRun.pvSizeKW,
        sim: latestBenchmark.simPvSizeKW,
        unit: "kW",
      },
      {
        label: { fr: "Production annuelle (kWh)", en: "Annual Production (kWh)" },
        kwhQc: selectedRun.totalProductionKWh,
        sim: latestBenchmark.simAnnualProductionKWh,
        unit: "kWh",
      },
      {
        label: { fr: "Rendement (kWh/kWp)", en: "Yield (kWh/kWp)" },
        kwhQc: runYield,
        sim: latestBenchmark.simYieldKWhPerKWp,
        unit: "kWh/kWp",
      },
      {
        label: { fr: "Ratio de performance", en: "Performance Ratio" },
        kwhQc: null,
        sim: latestBenchmark.simPerformanceRatio != null ? latestBenchmark.simPerformanceRatio * 100 : null,
        unit: "%",
        isPercent: true,
      },
      {
        label: { fr: "Rendement P50 (kWh/kWp)", en: "P50 Yield (kWh/kWp)" },
        kwhQc: runYield,
        sim: latestBenchmark.simSpecificYieldP50,
        unit: "kWh/kWp",
      },
      {
        label: { fr: "Rendement P90 (kWh/kWp)", en: "P90 Yield (kWh/kWp)" },
        kwhQc: null,
        sim: latestBenchmark.simSpecificYieldP90,
        unit: "kWh/kWp",
      },
      {
        label: { fr: "CAPEX total ($)", en: "CAPEX Total ($)" },
        kwhQc: selectedRun.capexGross,
        sim: latestBenchmark.simCapexTotal,
        unit: "$",
      },
      {
        label: { fr: "Ratio DC:AC", en: "DC:AC Ratio" },
        kwhQc: null,
        sim: latestBenchmark.simDcAcRatio,
      },
    ];

    return metrics.map(m => {
      let delta: number | null = null;
      let deltaPercent: number | null = null;
      if (m.kwhQc != null && m.sim != null && m.kwhQc !== 0) {
        delta = m.sim - m.kwhQc;
        deltaPercent = (delta / m.kwhQc) * 100;
      }
      return { ...m, delta, deltaPercent };
    });
  }, [benchmarks, selectedRun, language]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="w-5 h-5" />
            {language === "fr" ? "Benchmarks — Calibration" : "Benchmarks — Calibration"}
          </CardTitle>
          <Button
            size="sm"
            onClick={() => setShowForm(!showForm)}
            data-testid="button-add-benchmark"
          >
            <Plus className="w-4 h-4 mr-1" />
            {language === "fr" ? "Ajouter" : "Add"}
          </Button>
        </CardHeader>

        {showForm && (
          <CardContent className="border-t pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>{language === "fr" ? "Outil de simulation" : "Simulation Tool"} *</Label>
                <Input
                  placeholder="PVsyst, HelioScope, Aurora..."
                  value={form.toolName}
                  onChange={e => setForm(f => ({ ...f, toolName: e.target.value }))}
                  data-testid="input-tool-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{language === "fr" ? "Date du rapport" : "Report Date"}</Label>
                <Input
                  type="date"
                  value={form.reportDate}
                  onChange={e => setForm(f => ({ ...f, reportDate: e.target.value }))}
                  data-testid="input-report-date"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{language === "fr" ? "Analyste" : "Analyst"}</Label>
                <Input
                  value={form.analyst}
                  onChange={e => setForm(f => ({ ...f, analyst: e.target.value }))}
                  data-testid="input-analyst"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{language === "fr" ? "Taille PV (kW)" : "PV Size (kW)"}</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.simPvSizeKW}
                  onChange={e => setForm(f => ({ ...f, simPvSizeKW: e.target.value }))}
                  data-testid="input-pv-size"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{language === "fr" ? "Production annuelle (kWh)" : "Annual Production (kWh)"}</Label>
                <Input
                  type="number"
                  step="1"
                  value={form.simAnnualProductionKWh}
                  onChange={e => setForm(f => ({ ...f, simAnnualProductionKWh: e.target.value }))}
                  data-testid="input-annual-production"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{language === "fr" ? "Rendement (kWh/kWp)" : "Yield (kWh/kWp)"}
                  {autoYield && <span className="text-xs text-muted-foreground ml-1">({language === "fr" ? "auto" : "auto"}: {autoYield})</span>}
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder={autoYield || ""}
                  value={form.simYieldKWhPerKWp}
                  onChange={e => setForm(f => ({ ...f, simYieldKWhPerKWp: e.target.value }))}
                  data-testid="input-yield"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{language === "fr" ? "Ratio de performance (%)" : "Performance Ratio (%)"}</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.simPerformanceRatio}
                  onChange={e => setForm(f => ({ ...f, simPerformanceRatio: e.target.value }))}
                  data-testid="input-performance-ratio"
                />
              </div>
              <div className="space-y-1.5">
                <Label>P50 (kWh/kWp)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.simSpecificYieldP50}
                  onChange={e => setForm(f => ({ ...f, simSpecificYieldP50: e.target.value }))}
                  data-testid="input-p50"
                />
              </div>
              <div className="space-y-1.5">
                <Label>P90 (kWh/kWp)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.simSpecificYieldP90}
                  onChange={e => setForm(f => ({ ...f, simSpecificYieldP90: e.target.value }))}
                  data-testid="input-p90"
                />
              </div>
              <div className="space-y-1.5">
                <Label>CAPEX ($)</Label>
                <Input
                  type="number"
                  step="1"
                  value={form.simCapexTotal}
                  onChange={e => setForm(f => ({ ...f, simCapexTotal: e.target.value }))}
                  data-testid="input-capex"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{language === "fr" ? "Ratio DC:AC" : "DC:AC Ratio"}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.simDcAcRatio}
                  onChange={e => setForm(f => ({ ...f, simDcAcRatio: e.target.value }))}
                  data-testid="input-dc-ac-ratio"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2 lg:col-span-3">
                <Label>Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  data-testid="input-benchmark-notes"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <Button
                onClick={handleSubmit}
                disabled={!form.toolName || createMutation.isPending}
                data-testid="button-submit-benchmark"
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                {language === "fr" ? "Enregistrer" : "Save"}
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)} data-testid="button-cancel-benchmark">
                {language === "fr" ? "Annuler" : "Cancel"}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {benchmarks.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <CardTitle className="text-lg">
                {language === "fr" ? "Comparaison" : "Comparison"}
              </CardTitle>
              {simulationRuns.length > 1 && (
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground whitespace-nowrap">
                    {language === "fr" ? "Simulation kWh QC" : "kWh QC Simulation"}
                  </Label>
                  <Select value={selectedRunId} onValueChange={setSelectedRunId}>
                    <SelectTrigger className="w-[220px]" data-testid="select-simulation-run">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {simulationRuns.map(run => (
                        <SelectItem key={run.id} value={run.id}>
                          {run.label || run.type} — {run.pvSizeKW ? `${run.pvSizeKW} kW` : "N/A"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {comparisonRows.length > 0 && (
              <div className="overflow-x-auto">
                <Table data-testid="table-benchmark-comparison">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{language === "fr" ? "Métrique" : "Metric"}</TableHead>
                      <TableHead className="text-right">kWh Québec</TableHead>
                      <TableHead className="text-right">{benchmarks[0]?.toolName || "Simulation"}</TableHead>
                      <TableHead className="text-right">Delta</TableHead>
                      <TableHead className="text-right">Delta %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparisonRows.map((row, i) => (
                      <TableRow key={i} data-testid={`row-comparison-${i}`}>
                        <TableCell className="font-medium">{row.label[language]}</TableCell>
                        <TableCell className="text-right">{formatVal(row.kwhQc)}</TableCell>
                        <TableCell className="text-right">{formatVal(row.sim)}</TableCell>
                        <TableCell className={`text-right ${getDeltaColor(row.deltaPercent)}`}>
                          {row.delta != null ? (row.delta >= 0 ? "+" : "") + formatVal(row.delta) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.deltaPercent != null ? (
                            <Badge variant={getDeltaBadgeVariant(row.deltaPercent)}>
                              {row.deltaPercent >= 0 ? "+" : ""}{row.deltaPercent.toFixed(1)}%
                            </Badge>
                          ) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="mt-6 space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">
                {language === "fr" ? "Historique des benchmarks" : "Benchmark History"}
              </h4>
              {benchmarks.map(bm => (
                <div key={bm.id} className="flex flex-wrap items-center justify-between gap-2 py-2 border-b last:border-0" data-testid={`benchmark-entry-${bm.id}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{bm.toolName}</Badge>
                    {bm.analyst && <span className="text-sm text-muted-foreground">{bm.analyst}</span>}
                    {bm.reportDate && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(bm.reportDate).toLocaleDateString(language === "fr" ? "fr-CA" : "en-CA")}
                      </span>
                    )}
                    {bm.simPvSizeKW && <span className="text-xs text-muted-foreground">{bm.simPvSizeKW} kW</span>}
                    {bm.simAnnualProductionKWh && <span className="text-xs text-muted-foreground">{Math.round(bm.simAnnualProductionKWh).toLocaleString()} kWh</span>}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(bm.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-benchmark-${bm.id}`}
                  >
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && benchmarks.length === 0 && !showForm && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>
              {language === "fr"
                ? "Aucun benchmark enregistré. Ajoutez une comparaison avec un outil de simulation professionnel (PVsyst, HelioScope, Aurora, etc.)."
                : "No benchmarks recorded. Add a comparison with a professional simulation tool (PVsyst, HelioScope, Aurora, etc.)."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
