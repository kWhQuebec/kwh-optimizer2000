import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  ArrowLeft, 
  Zap, 
  Battery, 
  Package, 
  DollarSign, 
  TrendingUp,
  Settings,
  ExternalLink,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SimulationRun, Site, Client, Design, BomItem, ComponentCatalog } from "@shared/schema";

interface SimulationWithSite extends SimulationRun {
  site: Site & { client: Client };
}

interface DesignWithBom extends Design {
  bomItems: BomItem[];
}

// Schema created inside component to use translations
function createDesignFormSchema(t: (key: string) => string) {
  return z.object({
    designName: z.string().min(1, t("design.designNameRequired")),
    moduleModelId: z.string().optional(),
    inverterModelId: z.string().optional(),
    batteryModelId: z.string().optional(),
    pvSizeKW: z.coerce.number().min(0),
    batteryEnergyKWh: z.coerce.number().min(0),
    batteryPowerKW: z.coerce.number().min(0),
    marginPercent: z.coerce.number().min(0).max(100),
  });
}

type DesignFormValues = {
  designName: string;
  moduleModelId?: string;
  inverterModelId?: string;
  batteryModelId?: string;
  pvSizeKW: number;
  batteryEnergyKWh: number;
  batteryPowerKW: number;
  marginPercent: number;
};

function MetricCard({ 
  title, 
  value, 
  unit, 
  icon: Icon 
}: { 
  title: string; 
  value: string | number; 
  unit?: string; 
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-xl">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-lg font-bold font-mono">
          {value}
          {unit && <span className="text-sm font-normal ml-1">{unit}</span>}
        </p>
      </div>
    </div>
  );
}

function BomTable({ items }: { items: BomItem[] }) {
  const { t } = useI18n();

  const totalCost = items.reduce((sum, item) => sum + (item.lineTotalCost || 0), 0);
  const totalSell = items.reduce((sum, item) => sum + (item.lineTotalSell || 0), 0);

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("design.category")}</TableHead>
            <TableHead>{t("design.description")}</TableHead>
            <TableHead className="text-right">{t("design.quantity")}</TableHead>
            <TableHead className="text-right">{t("design.unitCost")}</TableHead>
            <TableHead className="text-right">{t("design.totalCost")}</TableHead>
            <TableHead className="text-right">{t("design.sellPrice")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted text-xs font-medium">
                  {item.category}
                </span>
              </TableCell>
              <TableCell className="font-medium">{item.description}</TableCell>
              <TableCell className="text-right font-mono">
                {item.quantity} {item.unit}
              </TableCell>
              <TableCell className="text-right font-mono text-muted-foreground">
                ${(item.unitCost || 0).toLocaleString()}
              </TableCell>
              <TableCell className="text-right font-mono">
                ${(item.lineTotalCost || 0).toLocaleString()}
              </TableCell>
              <TableCell className="text-right font-mono text-primary">
                ${(item.lineTotalSell || 0).toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Separator />

      <div className="flex justify-end">
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-right">
          <span className="text-muted-foreground">{t("design.costTotal")}:</span>
          <span className="font-mono font-semibold">${totalCost.toLocaleString()}</span>
          <span className="text-muted-foreground">{t("design.sellPriceTotal")}:</span>
          <span className="font-mono font-semibold text-primary">${totalSell.toLocaleString()}</span>
          <span className="text-muted-foreground">{t("design.marginAmount")}:</span>
          <span className="font-mono font-semibold text-primary">
            ${(totalSell - totalCost).toLocaleString()} ({totalCost > 0 ? (((totalSell - totalCost) / totalCost) * 100).toFixed(1) : 0}%)
          </span>
        </div>
      </div>
    </div>
  );
}

export default function DesignPage() {
  const { simulationId } = useParams<{ simulationId: string }>();
  const { t } = useI18n();
  const { toast } = useToast();
  const [generatedDesign, setGeneratedDesign] = useState<DesignWithBom | null>(null);

  const { data: simulation, isLoading: simLoading } = useQuery<SimulationWithSite>({
    queryKey: ["/api/simulation-runs", simulationId],
    enabled: !!simulationId,
  });

  const { data: catalog } = useQuery<ComponentCatalog[]>({
    queryKey: ["/api/catalog"],
  });

  const modules = catalog?.filter(c => c.category === "MODULE" && c.active) || [];
  const inverters = catalog?.filter(c => c.category === "INVERTER" && c.active) || [];
  const batteries = catalog?.filter(c => c.category === "BATTERY" && c.active) || [];

  // Create schema with translated validation messages
  const designFormSchema = createDesignFormSchema(t);

  const form = useForm<DesignFormValues>({
    resolver: zodResolver(designFormSchema),
    defaultValues: {
      designName: "",
      moduleModelId: "",
      inverterModelId: "",
      batteryModelId: "",
      pvSizeKW: 0,
      batteryEnergyKWh: 0,
      batteryPowerKW: 0,
      marginPercent: 25,
    },
  });

  // Auto-populate form with simulation values when data loads
  useEffect(() => {
    if (simulation) {
      form.setValue("pvSizeKW", simulation.pvSizeKW || 0);
      form.setValue("batteryEnergyKWh", simulation.battEnergyKWh || 0);
      form.setValue("batteryPowerKW", simulation.battPowerKW || 0);
      
      // Auto-generate design name from site and timestamp
      const siteName = simulation.site?.name || t("design.title");
      const dateStr = new Date().toLocaleDateString();
      form.setValue("designName", `${siteName} - ${dateStr}`);
    }
  }, [simulation, form, t]);

  const generateMutation = useMutation({
    mutationFn: async (data: DesignFormValues) => {
      const response = await apiRequest("POST", "/api/designs", {
        ...data,
        simulationRunId: simulationId,
      });
      return response as DesignWithBom;
    },
    onSuccess: (design) => {
      setGeneratedDesign(design);
      toast({ title: t("design.designGenerated") });
    },
    onError: () => {
      toast({ title: t("design.generateError"), variant: "destructive" });
    },
  });

  const syncZohoMutation = useMutation({
    mutationFn: async () => {
      if (!generatedDesign) return;
      return apiRequest("POST", `/api/designs/${generatedDesign.id}/sync-zoho`);
    },
    onSuccess: () => {
      toast({ title: t("design.zohoSynced") });
    },
    onError: () => {
      toast({ title: t("design.syncError"), variant: "destructive" });
    },
  });

  const onSubmit = (data: DesignFormValues) => {
    generateMutation.mutate(data);
  };

  if (simLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="w-10 h-10" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!simulation) {
    return (
      <div className="text-center py-12">
        <Settings className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">{t("design.simulationNotFound")}</h2>
        <Link href="/app/analyses">
          <Button variant="outline">{t("common.back")}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href={`/app/sites/${simulation.siteId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("design.title")}</h1>
          <p className="text-muted-foreground mt-1">
            {simulation.site?.name} • {simulation.site?.client?.name}
          </p>
        </div>
      </div>

      {/* Summary from Analysis */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title={t("analysis.recommendedPV")}
          value={(simulation.pvSizeKW || 0).toFixed(0)}
          unit="kWc"
          icon={Zap}
        />
        <MetricCard
          title={t("design.recommendedBattery")}
          value={(simulation.battEnergyKWh || 0).toFixed(0)}
          unit="kWh"
          icon={Battery}
        />
        <MetricCard
          title={t("analysis.annualSavings")}
          value={`$${((simulation.annualSavings || 0) / 1000).toFixed(1)}k`}
          icon={DollarSign}
        />
        <MetricCard
          title={t("analysis.payback")}
          value={(simulation.simplePaybackYears || 0).toFixed(1)}
          unit={t("common.years")}
          icon={TrendingUp}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Design Form */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("design.configuration")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="designName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("design.name")} *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Ex: Design v1 - 250 kWc"
                          {...field} 
                          data-testid="input-design-name" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid sm:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="moduleModelId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("design.selectModule")}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-module">
                              <SelectValue placeholder={t("design.selectPlaceholder")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {modules.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.manufacturer} {m.model}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="inverterModelId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("design.selectInverter")}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-inverter">
                              <SelectValue placeholder={t("design.selectPlaceholder")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {inverters.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.manufacturer} {m.model}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="batteryModelId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("design.selectBattery")}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-battery">
                              <SelectValue placeholder={t("design.selectPlaceholder")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {batteries.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.manufacturer} {m.model}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid sm:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="pvSizeKW"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("design.pvSize")}</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.1"
                            {...field} 
                            data-testid="input-pv-size" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="batteryEnergyKWh"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("design.batteryEnergy")}</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.1"
                            {...field} 
                            data-testid="input-battery-energy" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="batteryPowerKW"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("design.batteryPower")}</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.1"
                            {...field} 
                            data-testid="input-battery-power" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="marginPercent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("design.margin")}</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="1"
                            {...field} 
                            data-testid="input-margin" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full gap-2"
                  disabled={generateMutation.isPending}
                  data-testid="button-generate-design"
                >
                  <Package className="w-4 h-4" />
                  {generateMutation.isPending ? t("common.loading") : t("design.generate")}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Pricing Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Résumé des coûts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {generatedDesign ? (
              <>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">CAPEX PV</span>
                    <span className="font-mono">${(generatedDesign.totalCapexPV || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">CAPEX Batterie</span>
                    <span className="font-mono">${(generatedDesign.totalCapexBattery || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">CAPEX BOS</span>
                    <span className="font-mono">${(generatedDesign.totalCapexBOS || 0).toLocaleString()}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-medium">
                    <span>{t("design.totalCapex")}</span>
                    <span className="font-mono">${(generatedDesign.totalCapex || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Marge ({generatedDesign.marginPercent}%)</span>
                    <span className="font-mono">
                      ${((generatedDesign.totalSellPrice || 0) - (generatedDesign.totalCapex || 0)).toLocaleString()}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-semibold text-primary">
                    <span>{t("design.totalSellPrice")}</span>
                    <span className="font-mono">${(generatedDesign.totalSellPrice || 0).toLocaleString()}</span>
                  </div>
                </div>

                <Button 
                  variant="outline" 
                  className="w-full gap-2"
                  onClick={() => syncZohoMutation.mutate()}
                  disabled={syncZohoMutation.isPending}
                  data-testid="button-sync-zoho"
                >
                  {syncZohoMutation.isPending ? (
                    t("common.loading")
                  ) : generatedDesign.zohoDealId ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Synced with Zoho
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-4 h-4" />
                      {t("design.syncZoho")}
                    </>
                  )}
                </Button>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Générez un design pour voir le résumé des coûts</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* BOM Table */}
      {generatedDesign && generatedDesign.bomItems && generatedDesign.bomItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("design.bom")}</CardTitle>
          </CardHeader>
          <CardContent>
            <BomTable items={generatedDesign.bomItems} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
