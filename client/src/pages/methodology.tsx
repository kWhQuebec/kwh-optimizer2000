import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileDown, Calculator, Sun, Battery, DollarSign, BarChart3, Zap, TrendingUp, Info, Clock, Wallet, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function MethodologyPage() {
  const { language } = useI18n();
  const { token } = useAuth();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const t = language === "fr" ? fr : en;

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const response = await fetch("/api/methodology/pdf", {
        method: "GET",
        headers: {
          "Accept-Language": language,
          "Authorization": `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error("Failed to generate PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `methodology-${language}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: language === "fr" ? "PDF exporté" : "PDF exported",
        description: language === "fr" ? "Le document méthodologique a été téléchargé." : "The methodology document has been downloaded.",
      });
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast({
        variant: "destructive",
        title: language === "fr" ? "Erreur" : "Error",
        description: language === "fr" ? "Impossible de générer le PDF." : "Failed to generate PDF.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display" data-testid="text-methodology-title">
            {t.title}
          </h1>
          <p className="text-muted-foreground mt-1">{t.subtitle}</p>
        </div>
        <Button onClick={handleExportPdf} disabled={isExporting} data-testid="button-export-methodology-pdf">
          <FileDown className="mr-2 h-4 w-4" />
          {isExporting ? t.exporting : t.exportPdf}
        </Button>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5" data-testid="tabs-methodology">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Info className="mr-2 h-4 w-4" />
            {t.tabs.overview}
          </TabsTrigger>
          <TabsTrigger value="solar" data-testid="tab-solar">
            <Sun className="mr-2 h-4 w-4" />
            {t.tabs.solar}
          </TabsTrigger>
          <TabsTrigger value="battery" data-testid="tab-battery">
            <Battery className="mr-2 h-4 w-4" />
            {t.tabs.battery}
          </TabsTrigger>
          <TabsTrigger value="financial" data-testid="tab-financial">
            <DollarSign className="mr-2 h-4 w-4" />
            {t.tabs.financial}
          </TabsTrigger>
          <TabsTrigger value="optimization" data-testid="tab-optimization">
            <TrendingUp className="mr-2 h-4 w-4" />
            {t.tabs.optimization}
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="h-[calc(100vh-280px)] mt-4">
          <TabsContent value="overview" className="space-y-6">
            <OverviewSection t={t} />
          </TabsContent>

          <TabsContent value="solar" className="space-y-6">
            <SolarSection t={t} />
          </TabsContent>

          <TabsContent value="battery" className="space-y-6">
            <BatterySection t={t} />
          </TabsContent>

          <TabsContent value="financial" className="space-y-6">
            <FinancialSection t={t} />
          </TabsContent>

          <TabsContent value="optimization" className="space-y-6">
            <OptimizationSection t={t} />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

function OverviewSection({ t }: { t: typeof fr }) {
  const { language } = useI18n();
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            {t.overview.purpose.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none">
          <p>{t.overview.purpose.description}</p>
          <ul>
            {t.overview.purpose.points.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.overview.dataInputs.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="consumption">
              <AccordionTrigger data-testid="accordion-trigger-consumption">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  {t.overview.dataInputs.consumption.title}
                </div>
              </AccordionTrigger>
              <AccordionContent className="prose dark:prose-invert max-w-none">
                <p>{t.overview.dataInputs.consumption.description}</p>
                <ul>
                  {t.overview.dataInputs.consumption.formats.map((format, i) => (
                    <li key={i}>{format}</li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="site">
              <AccordionTrigger data-testid="accordion-trigger-site">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  {t.overview.dataInputs.site.title}
                </div>
              </AccordionTrigger>
              <AccordionContent className="prose dark:prose-invert max-w-none">
                <p>{t.overview.dataInputs.site.description}</p>
                <ul>
                  {t.overview.dataInputs.site.params.map((param, i) => (
                    <li key={i}>{param}</li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="interpolation">
              <AccordionTrigger data-testid="accordion-trigger-interpolation">
                <div className="flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  {t.overview.dataInputs.interpolation.title}
                </div>
              </AccordionTrigger>
              <AccordionContent className="prose dark:prose-invert max-w-none">
                <p>{t.overview.dataInputs.interpolation.description}</p>
                
                <h4>{t.overview.dataInputs.interpolation.method.title}</h4>
                <ol>
                  {t.overview.dataInputs.interpolation.method.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>

                <h4>{t.overview.dataInputs.interpolation.quality.title}</h4>
                <p>{t.overview.dataInputs.interpolation.quality.description}</p>

                <h4 className="text-amber-600 dark:text-amber-400">{language === "fr" ? "Limitations" : "Limitations"}</h4>
                <ul>
                  {t.overview.dataInputs.interpolation.limitations.map((limitation, i) => (
                    <li key={i}>{limitation}</li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="tariff-detection">
              <AccordionTrigger data-testid="accordion-trigger-tariff-detection">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  {t.overview.dataInputs.tariffDetection.title}
                </div>
              </AccordionTrigger>
              <AccordionContent className="prose dark:prose-invert max-w-none">
                <p>{t.overview.dataInputs.tariffDetection.description}</p>
                
                <div className="grid md:grid-cols-2 gap-3 mt-4 not-prose">
                  {t.overview.dataInputs.tariffDetection.tariffs.map((tariff, i) => (
                    <div key={i} className="border rounded-lg p-3" data-testid={`card-tariff-${tariff.code}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="default" className="font-mono" data-testid={`badge-tariff-${tariff.code}`}>{language === "fr" ? "Tarif" : "Tariff"} {tariff.code}</Badge>
                        <span className="text-sm font-medium" data-testid={`text-threshold-${tariff.code}`}>{tariff.threshold}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{tariff.description}</p>
                    </div>
                  ))}
                </div>
                
                <p className="text-sm text-muted-foreground mt-4 italic">{t.overview.dataInputs.tariffDetection.note}</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.overview.assumptions.title}</CardTitle>
          <CardDescription>{t.overview.assumptions.subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            {t.overview.assumptions.categories.map((cat, i) => (
              <div key={i} className="border rounded-lg p-4">
                <h4 className="font-semibold mb-2">{cat.name}</h4>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  {cat.items.map((item, j) => (
                    <li key={j} className="flex justify-between">
                      <span>{item.label}</span>
                      <Badge variant="outline">{item.value}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function SolarSection({ t }: { t: typeof fr }) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sun className="h-5 w-5 text-amber-500" />
            {t.solar.production.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none">
          <p>{t.solar.production.description}</p>
          
          <h4>{t.solar.production.formula.title}</h4>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto">
            {t.solar.production.formula.equation}
          </div>
          
          <h4>{t.solar.production.variables.title}</h4>
          <ul>
            {t.solar.production.variables.list.map((v, i) => (
              <li key={i}><code>{v.symbol}</code>: {v.description}</li>
            ))}
          </ul>

          <h4>{t.solar.production.seasonal.title}</h4>
          <p>{t.solar.production.seasonal.description}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.solar.sizing.title}</CardTitle>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none">
          <p>{t.solar.sizing.description}</p>
          
          <div className="bg-muted p-4 rounded-lg font-mono text-sm">
            {t.solar.sizing.formula}
          </div>

          <h4>{t.solar.sizing.constraints.title}</h4>
          <ul>
            {t.solar.sizing.constraints.list.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.solar.selfConsumption.title}</CardTitle>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none">
          <p>{t.solar.selfConsumption.description}</p>
          
          <div className="bg-muted p-4 rounded-lg font-mono text-sm space-y-2">
            <div>{t.solar.selfConsumption.formulas.selfConsumption}</div>
            <div>{t.solar.selfConsumption.formulas.selfSufficiency}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            {t.solar.advancedModeling.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none">
          <p>{t.solar.advancedModeling.description}</p>
          
          <Accordion type="single" collapsible className="w-full">
            {t.solar.advancedModeling.parameters.map((param, i) => (
              <AccordionItem key={i} value={`param-${i}`}>
                <AccordionTrigger data-testid={`accordion-trigger-param-${i}`}>
                  <div className="flex items-center gap-2 font-semibold">
                    {param.name}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p>{param.description}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Default: {param.default}</Badge>
                  </div>
                  <div className="bg-muted p-3 rounded-lg font-mono text-xs">
                    {param.formula}
                  </div>
                  {param.note && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      {param.note}
                    </p>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <h4>{t.solar.advancedModeling.temperatureProfile.title}</h4>
          <div className="grid grid-cols-4 gap-2 text-sm">
            {t.solar.advancedModeling.temperatureProfile.months.map((m, i) => (
              <div key={i} className="flex justify-between border rounded p-2">
                <span>{m.month}</span>
                <Badge variant="secondary">{m.temp}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-bifacial">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sun className="h-5 w-5 text-amber-500" />
            {t.solar.bifacial.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none">
          <p>{t.solar.bifacial.description}</p>
          
          <h4>{t.solar.bifacial.detection.title}</h4>
          <p>{t.solar.bifacial.detection.description}</p>
          
          <h4>{t.solar.bifacial.formula.title}</h4>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm">
            {t.solar.bifacial.formula.equation}
          </div>
          
          <div className="grid md:grid-cols-2 gap-3 mt-4">
            {t.solar.bifacial.parameters.map((p, i) => (
              <div key={i} className="border rounded-lg p-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium text-sm">{p.name}</span>
                  <Badge variant="outline">{p.default}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{p.description}</p>
              </div>
            ))}
          </div>
          
          <h4>{t.solar.bifacial.costPremium.title}</h4>
          <p>{t.solar.bifacial.costPremium.description}</p>
        </CardContent>
      </Card>

      <Card data-testid="card-yield-hierarchy">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            {t.solar.yieldHierarchy.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none">
          <p>{t.solar.yieldHierarchy.description}</p>
          
          <div className="space-y-3 mt-4">
            {t.solar.yieldHierarchy.levels.map((level, i) => (
              <div key={i} className="flex items-start gap-4 border-l-4 border-primary pl-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{level.name}</span>
                    <Badge variant="secondary">{level.value}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{level.description}</p>
                </div>
              </div>
            ))}
          </div>
          
          <div className="bg-muted p-4 rounded-lg font-mono text-xs mt-4">
            {t.solar.yieldHierarchy.formula}
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-google-validation">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-500" />
            {t.solar.googleValidation.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none">
          <p>{t.solar.googleValidation.description}</p>
          
          <h4>{t.solar.googleValidation.method.title}</h4>
          <p>{t.solar.googleValidation.method.description}</p>
          
          <div className="grid md:grid-cols-3 gap-3 mt-4">
            {t.solar.googleValidation.thresholds.map((threshold, i) => (
              <div key={i} className={`border rounded-lg p-3 ${
                threshold.color === 'green' ? 'border-green-500 bg-green-50/50 dark:bg-green-950/20' :
                threshold.color === 'yellow' ? 'border-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20' :
                'border-red-500 bg-red-50/50 dark:bg-red-950/20'
              }`} data-testid={`card-threshold-${threshold.color}`}>
                <div className="font-mono font-bold" data-testid={`text-range-${threshold.color}`}>{threshold.range}</div>
                <Badge variant={threshold.color === 'green' ? 'default' : 'secondary'} className="mt-1" data-testid={`badge-status-${threshold.color}`}>
                  {threshold.status}
                </Badge>
                <p className="text-xs text-muted-foreground mt-2">{threshold.description}</p>
              </div>
            ))}
          </div>
          
          <h4>{t.solar.googleValidation.limitations.title}</h4>
          <ul>
            {t.solar.googleValidation.limitations.list.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card data-testid="card-kb-racking">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-teal-500" />
            {t.solar.kbRacking.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none">
          <p>{t.solar.kbRacking.description}</p>
          
          <h4>{t.solar.kbRacking.methodology.title}</h4>
          <ol>
            {t.solar.kbRacking.methodology.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>

          <h4>{t.solar.kbRacking.specs.title}</h4>
          <div className="grid md:grid-cols-2 gap-4 not-prose">
            <div className="border rounded-lg p-4" data-testid="card-kb-panels">
              <h5 className="font-semibold mb-2 text-sm">{t.solar.kbRacking.specs.panelsLabel}</h5>
              <ul className="text-sm space-y-1 text-muted-foreground">
                {t.solar.kbRacking.specs.panels.map((item, i) => (
                  <li key={i} className="flex justify-between" data-testid={`row-kb-panel-${i}`}>
                    <span>{item.name}</span>
                    <Badge variant="outline">{item.value}</Badge>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border rounded-lg p-4" data-testid="card-kb-racking-specs">
              <h5 className="font-semibold mb-2 text-sm">{t.solar.kbRacking.specs.rackingLabel}</h5>
              <ul className="text-sm space-y-1 text-muted-foreground">
                {t.solar.kbRacking.specs.racking.map((item, i) => (
                  <li key={i} className="flex justify-between" data-testid={`row-kb-racking-${i}`}>
                    <span>{item.name}</span>
                    <Badge variant="outline">{item.value}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <h4>{t.solar.kbRacking.pricing.title}</h4>
          <div className="grid grid-cols-5 gap-2 not-prose">
            {t.solar.kbRacking.pricing.tiers.map((tier, i) => (
              <div key={i} className="border rounded-lg p-2 text-center text-sm">
                <div className="font-mono text-xs text-muted-foreground">{tier.range}</div>
                <Badge variant="secondary" className="mt-1">{tier.price}</Badge>
              </div>
            ))}
          </div>

          <h4>{t.solar.kbRacking.comparison.title}</h4>
          <p className="text-sm bg-muted p-3 rounded-lg">{t.solar.kbRacking.comparison.description}</p>
        </CardContent>
      </Card>
    </>
  );
}

function BatterySection({ t }: { t: typeof fr }) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Battery className="h-5 w-5 text-green-500" />
            {t.battery.peakShaving.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none">
          <p>{t.battery.peakShaving.description}</p>
          
          <h4>{t.battery.peakShaving.algorithm.title}</h4>
          <ol>
            {t.battery.peakShaving.algorithm.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>

          <h4>{t.battery.peakShaving.socTracking.title}</h4>
          <p>{t.battery.peakShaving.socTracking.description}</p>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm">
            {t.battery.peakShaving.socTracking.formula}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.battery.sizing.title}</CardTitle>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none">
          <p>{t.battery.sizing.description}</p>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4">
              <h4 className="font-semibold">{t.battery.sizing.energy.title}</h4>
              <p className="text-sm text-muted-foreground">{t.battery.sizing.energy.description}</p>
              <div className="bg-muted p-2 rounded font-mono text-xs mt-2">
                {t.battery.sizing.energy.formula}
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <h4 className="font-semibold">{t.battery.sizing.power.title}</h4>
              <p className="text-sm text-muted-foreground">{t.battery.sizing.power.description}</p>
              <div className="bg-muted p-2 rounded font-mono text-xs mt-2">
                {t.battery.sizing.power.formula}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.battery.degradation.title}</CardTitle>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none">
          <p>{t.battery.degradation.description}</p>
          <ul>
            {t.battery.degradation.factors.map((factor, i) => (
              <li key={i}>{factor}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}

function FinancialSection({ t }: { t: typeof fr }) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            {t.financial.capex.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none">
          <p>{t.financial.capex.description}</p>
          
          <div className="bg-muted p-4 rounded-lg font-mono text-sm">
            {t.financial.capex.formula}
          </div>

          <h4>{t.financial.capex.components.title}</h4>
          <ul>
            {t.financial.capex.components.list.map((c, i) => (
              <li key={i}><strong>{c.name}</strong>: {c.description}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.financial.incentives.title}</CardTitle>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="hq">
              <AccordionTrigger data-testid="accordion-trigger-hq">{t.financial.incentives.hq.title}</AccordionTrigger>
              <AccordionContent>
                <p>{t.financial.incentives.hq.description}</p>
                <ul>
                  {t.financial.incentives.hq.details.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
                <div className="bg-muted p-2 rounded font-mono text-xs mt-2">
                  {t.financial.incentives.hq.formula}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="itc">
              <AccordionTrigger data-testid="accordion-trigger-itc">{t.financial.incentives.itc.title}</AccordionTrigger>
              <AccordionContent>
                <p>{t.financial.incentives.itc.description}</p>
                <div className="bg-muted p-2 rounded font-mono text-xs mt-2">
                  {t.financial.incentives.itc.formula}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="taxShield">
              <AccordionTrigger data-testid="accordion-trigger-taxshield">{t.financial.incentives.taxShield.title}</AccordionTrigger>
              <AccordionContent>
                <p>{t.financial.incentives.taxShield.description}</p>
                <div className="bg-muted p-2 rounded font-mono text-xs mt-2">
                  {t.financial.incentives.taxShield.formula}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="timing">
              <AccordionTrigger data-testid="accordion-trigger-timing">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {t.financial.incentives.timing.title}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <p>{t.financial.incentives.timing.description}</p>
                <div className="space-y-2 mt-3">
                  {t.financial.incentives.timing.timeline.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 border-l-2 border-primary pl-3">
                      <Badge variant="outline">{item.year}</Badge>
                      <ul className="text-sm space-y-1">
                        {item.items.map((it, j) => (
                          <li key={j}>{it}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mt-3 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  {t.financial.incentives.timing.note}
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.financial.cashflow.title}</CardTitle>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none">
          <p>{t.financial.cashflow.description}</p>
          
          <h4>{t.financial.cashflow.revenue.title}</h4>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm">
            {t.financial.cashflow.revenue.formula}
          </div>

          <h4>{t.financial.cashflow.costs.title}</h4>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm">
            {t.financial.cashflow.costs.formula}
          </div>

          <h4>{t.financial.cashflow.degradation.title}</h4>
          <p>{t.financial.cashflow.degradation.description}</p>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm">
            {t.financial.cashflow.degradation.formula}
          </div>
          <p className="text-sm text-muted-foreground">{t.financial.cashflow.degradation.example}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            {t.financial.financing.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none">
          <p>{t.financial.financing.description}</p>
          
          <Accordion type="single" collapsible className="w-full">
            {t.financial.financing.options.map((option, i) => (
              <AccordionItem key={i} value={`financing-${i}`}>
                <AccordionTrigger data-testid={`accordion-trigger-financing-${i}`}>
                  <div className="font-semibold">{option.name}</div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <p>{option.description}</p>
                  <div className="bg-muted p-3 rounded-lg font-mono text-xs">
                    {option.formula}
                  </div>
                  {option.params && (
                    <ul className="text-sm">
                      {option.params.map((p, j) => (
                        <li key={j}>{p}</li>
                      ))}
                    </ul>
                  )}
                  {option.pros && (
                    <div className="flex flex-wrap gap-1">
                      {option.pros.map((p, j) => (
                        <Badge key={j} variant="secondary" className="text-xs">{p}</Badge>
                      ))}
                    </div>
                  )}
                  {option.note && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      {option.note}
                    </p>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.financial.metrics.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            {t.financial.metrics.list.map((metric, i) => (
              <div key={i} className="border rounded-lg p-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  {metric.name}
                </h4>
                <p className="text-sm text-muted-foreground mt-1">{metric.description}</p>
                <div className="bg-muted p-2 rounded font-mono text-xs mt-2">
                  {metric.formula}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function OptimizationSection({ t }: { t: typeof fr }) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            {t.optimization.sensitivity.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none">
          <p>{t.optimization.sensitivity.description}</p>
          
          <h4>{t.optimization.sensitivity.scenarios.title}</h4>
          <ul>
            {t.optimization.sensitivity.scenarios.list.map((s, i) => (
              <li key={i}><strong>{s.type}</strong>: {s.description}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.optimization.frontier.title}</CardTitle>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none">
          <p>{t.optimization.frontier.description}</p>
          
          <h4>{t.optimization.frontier.axes.title}</h4>
          <ul>
            <li><strong>X</strong>: {t.optimization.frontier.axes.x}</li>
            <li><strong>Y</strong>: {t.optimization.frontier.axes.y}</li>
          </ul>
          
          <p>{t.optimization.frontier.optimal}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.optimization.selection.title}</CardTitle>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none">
          <p>{t.optimization.selection.description}</p>
          <ol>
            {t.optimization.selection.criteria.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </>
  );
}

const fr = {
  title: "Méthodologie d'Analyse",
  subtitle: "Documentation technique complète des hypothèses, formules et calculs utilisés dans les analyses solaire + stockage",
  exportPdf: "Exporter en PDF",
  exporting: "Exportation...",
  
  tabs: {
    overview: "Aperçu",
    solar: "Production Solaire",
    battery: "Stockage",
    financial: "Financier",
    optimization: "Optimisation",
  },

  overview: {
    purpose: {
      title: "Objectif de l'Analyse",
      description: "L'outil d'analyse kWh Québec effectue une simulation énergétique et financière complète sur 25 ans pour des systèmes solaires photovoltaïques avec ou sans stockage par batterie.",
      points: [
        "Simulation horaire 8760 heures de la production solaire et consommation",
        "Modélisation du comportement de la batterie avec suivi de l'état de charge",
        "Calcul des économies d'énergie et de puissance selon les tarifs Hydro-Québec",
        "Projection financière incluant tous les incitatifs gouvernementaux",
        "Analyse de sensibilité multi-scénarios pour optimiser le dimensionnement",
      ],
    },
    dataInputs: {
      title: "Données d'Entrée",
      consumption: {
        title: "Données de Consommation",
        description: "Fichiers CSV exportés d'Hydro-Québec contenant les données de consommation historiques.",
        formats: [
          "Données horaires en kWh (énergie)",
          "Données 15-minutes en kW (puissance)",
          "Format CSV avec encodage Latin-1 et délimiteurs point-virgule",
          "Jusqu'à 200 fichiers simultanés couvrant 24+ mois",
        ],
      },
      site: {
        title: "Paramètres du Site",
        description: "Caractéristiques physiques et contraintes du bâtiment.",
        params: [
          "Superficie de toiture disponible (pi²)",
          "Ratio d'utilisation de la toiture (%)",
          "Orientation et inclinaison (si connues)",
          "Contraintes structurelles",
        ],
      },
      interpolation: {
        title: "Interpolation des Données Manquantes",
        description: "Lorsque des mois entiers de données de consommation sont manquants dans les fichiers CSV, le système effectue une interpolation intelligente pour estimer les valeurs.",
        method: {
          title: "Méthode d'Interpolation",
          steps: [
            "Détection automatique des mois sans aucune donnée de consommation",
            "Calcul de la moyenne horaire à partir des mois adjacents (ex: janvier + mars pour estimer février)",
            "Gestion circulaire pour les mois de bordure (décembre utilise novembre/janvier, janvier utilise décembre/février)",
            "Valeur par défaut à zéro si aucune donnée adjacente disponible",
          ],
        },
        quality: {
          title: "Indicateur de Qualité des Données",
          description: "Lorsque des mois sont interpolés, un avertissement est affiché dans l'interface indiquant les mois estimés. Cette transparence permet à l'utilisateur de comprendre la source des données utilisées dans l'analyse.",
        },
        limitations: [
          "L'interpolation ne s'applique qu'aux mois entièrement manquants",
          "Les mois partiellement incomplets utilisent la moyenne des données disponibles",
          "Les résultats d'analyse peuvent être moins précis pour les sites avec beaucoup de données interpolées",
        ],
      },
      tariffDetection: {
        title: "Détection Automatique du Tarif",
        description: "Le système détecte automatiquement le code tarifaire Hydro-Québec approprié selon la pointe de puissance simulée.",
        tariffs: [
          { code: "G", threshold: "< 65 kW", description: "Tarif petite puissance pour sites avec pointe mensuelle inférieure à 65 kW" },
          { code: "M", threshold: "≥ 65 kW", description: "Tarif moyenne puissance pour sites avec pointe mensuelle de 65 kW ou plus" },
        ],
        note: "La détection s'exécute lors de l'initialisation des hypothèses d'analyse. Les hypothèses sauvegardées ont priorité sur les valeurs auto-détectées.",
      },
    },
    assumptions: {
      title: "Hypothèses par Défaut",
      subtitle: "Ces valeurs peuvent être modifiées dans les paramètres d'analyse",
      categories: [
        {
          name: "Production Solaire",
          items: [
            { label: "Rendement système", value: "85%" },
            { label: "Dégradation annuelle", value: "0.5%/an" },
            { label: "Irradiation de référence", value: "Québec moyen" },
          ],
        },
        {
          name: "Stockage Batterie",
          items: [
            { label: "Efficacité aller-retour", value: "90%" },
            { label: "Profondeur de décharge", value: "90%" },
            { label: "Durée de vie", value: "10-15 ans" },
          ],
        },
        {
          name: "Financier",
          items: [
            { label: "Taux d'actualisation", value: "8%" },
            { label: "Inflation tarif HQ", value: "4.8%/an" },
            { label: "Taux d'imposition", value: "26.5%" },
          ],
        },
        {
          name: "CAPEX",
          items: [
            { label: "Coût solaire", value: "2.25 $/Wc" },
            { label: "Coût batterie énergie", value: "550 $/kWh" },
            { label: "Coût batterie puissance", value: "800 $/kW" },
          ],
        },
      ],
    },
  },

  solar: {
    production: {
      title: "Simulation de Production Solaire",
      description: "La production solaire est simulée pour chaque heure de l'année (8760 heures) en utilisant un modèle gaussien ajusté selon la latitude du Québec et les variations saisonnières.",
      formula: {
        title: "Formule de Production Horaire",
        equation: "P(h) = Pnom × Geff(h) / Gstc × ηsys × (1 - δ)^année",
      },
      variables: {
        title: "Variables",
        list: [
          { symbol: "P(h)", description: "Production à l'heure h (kWh)" },
          { symbol: "Pnom", description: "Puissance nominale du système (kWc)" },
          { symbol: "Geff(h)", description: "Irradiation effective à l'heure h (W/m²)" },
          { symbol: "Gstc", description: "Irradiation aux conditions standard (1000 W/m²)" },
          { symbol: "ηsys", description: "Rendement système global (85%)" },
          { symbol: "δ", description: "Taux de dégradation annuel (0.5%)" },
        ],
      },
      seasonal: {
        title: "Ajustement Saisonnier",
        description: "Le modèle intègre les variations saisonnières typiques du Québec avec un pic de production en juin et une production minimale en décembre. L'amplitude de production varie d'un facteur 3-4x entre l'été et l'hiver.",
      },
    },
    sizing: {
      title: "Dimensionnement du Système",
      description: "La taille maximale du système solaire est limitée par la superficie de toiture disponible et son ratio d'utilisation.",
      formula: "PV_max (kWc) = (Superficie × Ratio_utilisation) / 10",
      constraints: {
        title: "Contraintes Considérées",
        list: [
          "Superficie de toiture utilisable (pi² → m²)",
          "Ratio d'utilisation (typiquement 60-80%)",
          "Densité de puissance standard: 10 pi²/kWc",
          "Contraintes structurelles et réglementaires",
        ],
      },
    },
    selfConsumption: {
      title: "Autoconsommation et Autosuffisance",
      description: "Deux métriques clés mesurent l'utilisation efficace de la production solaire.",
      formulas: {
        selfConsumption: "Autoconsommation (%) = Production_autoconsommée / Production_totale × 100",
        selfSufficiency: "Autosuffisance (%) = Production_autoconsommée / Consommation_totale × 100",
      },
    },
    advancedModeling: {
      title: "Modélisation Avancée (Paramètres Helioscope)",
      description: "Le moteur de simulation horaire intègre des paramètres de modélisation professionnels inspirés d'outils industriels comme Helioscope.",
      parameters: [
        {
          name: "Ratio DC/AC (ILR)",
          description: "Surdimensionnement configurable du champ DC par rapport à la capacité AC de l'onduleur.",
          default: "1.2 (plage: 1.0-2.0)",
          formula: "Si Production_DC > Capacité_AC_onduleur: Production_écrêtée = Capacité_AC",
          note: "Comptabilise les pertes par écrêtage lorsque la production DC dépasse la capacité AC.",
        },
        {
          name: "Coefficient de Température",
          description: "Ajuste la production PV horaire selon la température cellulaire.",
          default: "-0.4%/°C (typique pour silicium cristallin)",
          formula: "P_corrigée = P_base × (1 + Coeff_temp × (T_cellule - 25°C))",
          note: "Utilise T_cellule = T_ambiante + 25°C avec moyennes mensuelles québécoises.",
        },
        {
          name: "Pertes de Câblage",
          description: "Pertes dans les conducteurs et le câblage appliquées après correction de température.",
          default: "2% (configurable 0-10%)",
          formula: "P_finale = P_après_écrêtage × (1 - Pertes_câblage)",
        },
        {
          name: "Taux de Dégradation",
          description: "Dégradation annuelle des panneaux appliquée dans tous les calculs financiers.",
          default: "0.5%/an",
          formula: "Revenus_année_Y = Économies_base × (1 - dégradation)^(Y-1) × (1 + inflation)^(Y-1)",
          note: "Affecte le LCOE et la VAN sur 25 ans.",
        },
      ],
      temperatureProfile: {
        title: "Profil de Température Québec",
        months: [
          { month: "Janvier", temp: "-10°C" },
          { month: "Février", temp: "-8°C" },
          { month: "Mars", temp: "-2°C" },
          { month: "Avril", temp: "6°C" },
          { month: "Mai", temp: "13°C" },
          { month: "Juin", temp: "18°C" },
          { month: "Juillet", temp: "21°C" },
          { month: "Août", temp: "20°C" },
          { month: "Septembre", temp: "15°C" },
          { month: "Octobre", temp: "8°C" },
          { month: "Novembre", temp: "2°C" },
          { month: "Décembre", temp: "-7°C" },
        ],
      },
    },
    bifacial: {
      title: "Analyse Panneaux Bifaciaux",
      description: "Le système détecte automatiquement les toitures à membrane blanche via l'imagerie satellite de Google Solar API et propose une analyse bifaciale.",
      detection: {
        title: "Détection Automatique",
        description: "L'algorithme analyse la luminosité moyenne RGB de l'imagerie satellite du toit. Un seuil > 200 indique une membrane blanche à haute réflectivité.",
      },
      formula: {
        title: "Formule de Boost Bifacial",
        equation: "Rendement_bifacial = Rendement_base × (1 + Facteur_bifacialité × Albédo_toit × Facteur_vue)",
      },
      parameters: [
        { name: "Facteur de bifacialité", default: "0.85", description: "Ratio de sensibilité face arrière vs face avant" },
        { name: "Albédo toit blanc", default: "0.70", description: "Réflectivité membrane blanche TPO/EPDM" },
        { name: "Albédo toit gravier", default: "0.20", description: "Réflectivité ballast gravier typique" },
        { name: "Albédo toit foncé", default: "0.10", description: "Réflectivité asphalte/membrane noire" },
        { name: "Facteur de vue", default: "0.35", description: "Portion du rayonnement réfléchi atteignant l'arrière des panneaux" },
      ],
      costPremium: {
        title: "Prime de Coût",
        description: "Les panneaux bifaciaux ont une prime de 5% sur le coût par watt par rapport aux panneaux monofaces standard.",
      },
    },
    yieldHierarchy: {
      title: "Hiérarchie des Rendements",
      description: "Le système affiche trois niveaux de rendement pour une transparence complète sur les calculs de production.",
      levels: [
        { 
          name: "Rendement de Base", 
          value: "1000-1200 kWh/kWc", 
          description: "Rendement variable selon système de racking (KB 10°: 1000, Opsun 25°: 1200)" 
        },
        { 
          name: "Rendement Brut", 
          value: "Variable", 
          description: "Après ajustements d'orientation, inclinaison et boost bifacial (si applicable)" 
        },
        { 
          name: "Rendement Net Livré", 
          value: "Variable", 
          description: "Rendement final après toutes les pertes: température, câblage, ILR, ombrage" 
        },
      ],
      formula: "Rendement_net = Rendement_base × Facteur_orientation × Boost_bifacial × (1 - Pertes_temp) × (1 - Pertes_câblage) × Facteur_ILR",
    },
    googleValidation: {
      title: "Validation Google Solar API",
      description: "Le système effectue une comparaison croisée avec les données de Google Solar API pour valider les estimations de rendement.",
      method: {
        title: "Méthodologie de Comparaison",
        description: "La comparaison se fait sur le rendement spécifique (kWh/kWc) plutôt que sur la production totale, car Google Solar API est optimisé pour les installations résidentielles et peut sous-estimer la taille des systèmes commerciaux et industriels.",
      },
      thresholds: [
        { range: "±10%", status: "Validé", color: "green", description: "Rendement conforme aux données satellite" },
        { range: "10-20%", status: "Acceptable", color: "yellow", description: "Écart dans les marges acceptables" },
        { range: ">20%", status: "À vérifier", color: "red", description: "Recommandation de réviser les paramètres" },
      ],
      limitations: {
        title: "Limitations Connues",
        list: [
          "Google Solar API plafonne souvent à ~50kWc (échelle résidentielle)",
          "Les grands bâtiments commerciaux et industriels peuvent dépasser les capacités de l'API",
          "La comparaison du rendement spécifique reste valide même si les tailles diffèrent",
        ],
      },
    },
    kbRacking: {
      title: "Données KB Racking Validées",
      description: "Les paramètres de dimensionnement sont validés contre 18 projets commerciaux réels (~40 MW, 7.3M$ en valeur de rack). Cette approche utilise le traçage manuel des toits comme source de vérité et applique directement les specs KB Racking pour un calcul précis.",
      methodology: {
        title: "Calcul Direct KB Racking (Sans Facteur de Correction)",
        steps: [
          "Traçage manuel des toits: Source de vérité pour les surfaces de toit (Google n'est pas fiable pour C&I)",
          "Surface utilisable = Surface tracée × 85% (retrait périmètre 1.22m code IFC)",
          "Nombre de panneaux = Surface utilisable ÷ 3.71 m² (empreinte KB Racking)",
          "Capacité = Nombre de panneaux × 625W (panneau Jinko bifacial)",
        ],
      },
      specs: {
        title: "Spécifications KB Racking Validées",
        panelsLabel: "Panneaux",
        rackingLabel: "Structure de montage",
        panels: [
          { name: "Modèle de panneau", value: "Jinko Solar 625W bifacial" },
          { name: "Dimensions", value: "2382 × 1134 × 30 mm" },
          { name: "Poids panneau", value: "32.4 kg" },
          { name: "Type cellule", value: "72-cell bifacial" },
        ],
        racking: [
          { name: "Système", value: "AeroGrid 10° Landscape" },
          { name: "Poids rack/panneau", value: "12.84 kg" },
          { name: "Espacement rangées", value: "1.557 m (centre à centre)" },
          { name: "Inter-rangée", value: "0.435 m" },
          { name: "Retrait périmètre", value: "1.22 m (code IFC)" },
          { name: "Inclinaison", value: "10°" },
        ],
      },
      pricing: {
        title: "Courbe de Prix KB Racking",
        tiers: [
          { range: "< 1,500 panneaux", price: "115.50 $/panneau" },
          { range: "1,500-3,000", price: "113.00 $/panneau" },
          { range: "3,000-5,000", price: "111.50 $/panneau" },
          { range: "5,000-8,000", price: "111.00 $/panneau" },
          { range: "8,000+", price: "110.00 $/panneau" },
        ],
      },
      comparison: {
        title: "Validation KB Racking",
        description: "Basé sur l'analyse de 18 sites réels, le calcul direct (surface × 85% ÷ 3.71 m² × 625W) donne des résultats à ~6% des designs KB finaux. L'écart s'explique par les ajustements finaux: passages, câblage, obstacles spécifiques.",
      },
    },
  },

  battery: {
    peakShaving: {
      title: "Écrêtage de Pointe (Peak Shaving)",
      description: "L'algorithme de gestion de la batterie vise à réduire les pointes de puissance appelées du réseau, générant des économies sur les frais de puissance.",
      algorithm: {
        title: "Algorithme de Dispatch",
        steps: [
          "Calculer la charge nette: Load_net = Consommation - Production_solaire",
          "Si Load_net > Seuil_écrêtage ET SOC > SOC_min: Décharger la batterie",
          "Si Load_net < 0 ET SOC < SOC_max: Charger avec surplus solaire",
          "Respecter les limites de puissance C-rate de la batterie",
          "Mise à jour de l'état de charge (SOC) après chaque intervalle",
        ],
      },
      socTracking: {
        title: "Suivi de l'État de Charge",
        description: "L'état de charge (SOC) est suivi à chaque intervalle de 15 minutes pour assurer le respect des contraintes opérationnelles.",
        formula: "SOC(t+1) = SOC(t) ± (P_batt × Δt × η) / E_batt",
      },
    },
    sizing: {
      title: "Dimensionnement de la Batterie",
      description: "La capacité de la batterie est dimensionnée selon deux paramètres: l'énergie (kWh) et la puissance (kW).",
      energy: {
        title: "Capacité Énergétique (kWh)",
        description: "Détermine la quantité d'énergie stockable, affectant la durée de soutien possible.",
        formula: "E_batt = Énergie_écrêtage_quotidienne × Facteur_sécurité / DoD",
      },
      power: {
        title: "Puissance (kW)",
        description: "Détermine le taux de charge/décharge maximal.",
        formula: "P_batt = Réduction_pointe_cible × Facteur_sécurité",
      },
    },
    degradation: {
      title: "Dégradation et Remplacement",
      description: "La batterie subit une dégradation au fil du temps et doit être remplacée.",
      factors: [
        "Durée de vie typique: 10-15 ans selon l'utilisation",
        "Coût de remplacement: % du coût initial avec déclin annuel",
        "Inflation appliquée au coût de remplacement",
        "Année de remplacement configurable dans les paramètres",
      ],
    },
  },

  financial: {
    capex: {
      title: "Coûts d'Investissement (CAPEX)",
      description: "Le CAPEX total comprend tous les coûts initiaux du système.",
      formula: "CAPEX_total = (PV_kWc × Coût_PV) + (Batt_kWh × Coût_kWh) + (Batt_kW × Coût_kW)",
      components: {
        title: "Composantes",
        list: [
          { name: "Coût solaire ($/Wc)", description: "Modules, onduleurs, structure, installation" },
          { name: "Coût batterie énergie ($/kWh)", description: "Cellules et modules de batterie" },
          { name: "Coût batterie puissance ($/kW)", description: "Onduleur batterie et contrôleur" },
        ],
      },
    },
    incentives: {
      title: "Incitatifs et Subventions",
      hq: {
        title: "Incitatifs Hydro-Québec",
        description: "Programme Autoproduction d'Hydro-Québec pour installations commerciales.",
        details: [
          "Solaire: 1 000 $/kWc installé",
          "Stockage: crédit uniquement si jumelé au solaire (utilise le reste du plafond)",
          "Plafond: 40% du CAPEX brut",
        ],
        formula: "Incitatif_HQ = min(PV_kWc × 1000, CAPEX × 0.40) + crédit résiduel pour stockage",
      },
      itc: {
        title: "Crédit d'Impôt Fédéral (CII)",
        description: "Crédit d'impôt à l'investissement de 30% sur le CAPEX net (après incitatifs HQ).",
        formula: "CII = (CAPEX_brut - Incitatif_HQ) × 0.30",
      },
      taxShield: {
        title: "Bouclier Fiscal (DPA/CCA)",
        description: "Déductions pour amortissement accéléré sur les équipements solaires (Classe 43.2).",
        formula: "Bouclier_fiscal = CAPEX_net × Taux_CCA × Taux_imposition",
      },
      timing: {
        title: "Chronologie des Incitatifs",
        description: "Les incitatifs sont versés à différents moments, affectant le flux de trésorerie réel.",
        timeline: [
          { year: "Année 0", items: ["Subvention HQ Solaire (100%)", "Subvention HQ Batterie (50%)"] },
          { year: "Année 1", items: ["Subvention HQ Batterie restante (50%)", "Bouclier fiscal (DPA/CCA)"] },
          { year: "Année 2", items: ["Crédit d'impôt fédéral (CII 30%)"] },
        ],
        note: "L'équité initiale requise = CAPEX brut - Subvention HQ Solaire - 50% Subvention HQ Batterie",
      },
    },
    cashflow: {
      title: "Flux de Trésorerie",
      description: "Le modèle génère un flux de trésorerie annuel sur 25 ans.",
      revenue: {
        title: "Revenus (Économies)",
        formula: "Économies(an) = Énergie_économisée × Tarif_énergie + Puissance_réduite × Tarif_puissance × 12",
      },
      costs: {
        title: "Coûts d'Exploitation (O&M)",
        formula: "O&M(an) = CAPEX_PV × %O&M_PV + CAPEX_Batt × %O&M_Batt × (1 + inflation_O&M)^an",
      },
      degradation: {
        title: "Impact de la Dégradation",
        description: "Les revenus annuels diminuent selon le taux de dégradation des panneaux.",
        formula: "Revenus(an) = Économies_base × (1 - dégradation)^(an-1) × (1 + inflation)^(an-1)",
        example: "Avec 0.5%/an de dégradation: An 1 = 100%, An 10 = 95.5%, An 25 = 88.6%",
      },
    },
    financing: {
      title: "Options de Financement",
      description: "Le calculateur compare trois options de financement sur un horizon de 25 ans.",
      options: [
        {
          name: "Achat Comptant",
          description: "Paiement initial complet avec retour maximum des incitatifs.",
          formula: "Équité = CAPEX_brut - Subv_HQ_Solaire - 50%_Subv_HQ_Batterie",
          pros: ["Rendement maximum", "Propriété immédiate", "Incitatifs complets"],
          cons: ["Capital initial élevé"],
        },
        {
          name: "Prêt",
          description: "Financement par emprunt avec versements mensuels.",
          formula: "Paiement_mensuel = Principal × [r(1+r)^n] / [(1+r)^n - 1]",
          params: ["Terme: 5-20 ans", "Taux d'intérêt: variable", "Mise de fonds: 0-30%"],
        },
        {
          name: "Crédit-Bail (Capital Lease)",
          description: "Paiements mensuels fixes avec propriété fiscale au client. Le client reçoit tous les incitatifs (rabais HQ, CII fédéral 30%, bouclier fiscal ACC).",
          formula: "Paiement_mensuel = (CAPEX × Facteur_taux_implicite) / (Terme × 12)",
          note: "Résulte typiquement en flux de trésorerie positifs ou neutres grâce aux incitatifs.",
        },
      ],
    },
    metrics: {
      title: "Métriques Financières",
      list: [
        {
          name: "VAN (Valeur Actuelle Nette)",
          description: "Somme actualisée de tous les flux de trésorerie sur la durée du projet.",
          formula: "VAN = -CAPEX_net + Σ(CF_an / (1 + r)^an)",
        },
        {
          name: "TRI (Taux de Rendement Interne)",
          description: "Taux d'actualisation qui rend la VAN égale à zéro.",
          formula: "VAN(TRI) = 0 → résoudre pour TRI",
        },
        {
          name: "Temps de Retour Simple",
          description: "Nombre d'années pour récupérer l'investissement initial.",
          formula: "Payback = CAPEX_net / Économies_annuelles_moyennes",
        },
        {
          name: "LCOE (Coût Actualisé de l'Énergie)",
          description: "Coût moyen par kWh produit sur la durée de vie du système.",
          formula: "LCOE = (CAPEX_net + VAN_O&M) / Σ(Production_actualisée)",
        },
      ],
    },
  },

  optimization: {
    sensitivity: {
      title: "Analyse de Sensibilité",
      description: "L'analyse de sensibilité explore différentes combinaisons de tailles de système pour identifier la configuration optimale.",
      scenarios: {
        title: "Types de Scénarios",
        list: [
          { type: "Solaire seul", description: "Variation de la taille PV de 10% à 100% de la capacité maximale" },
          { type: "Batterie seule", description: "Variation de la capacité batterie de 0 à la capacité optimale" },
          { type: "Hybride", description: "Combinaisons de PV et batterie à différentes échelles" },
        ],
      },
    },
    frontier: {
      title: "Frontière d'Efficience",
      description: "Le graphique de frontière d'efficience visualise le compromis entre l'investissement (CAPEX) et le rendement (VAN).",
      axes: {
        title: "Axes du Graphique",
        x: "CAPEX net après incitatifs ($)",
        y: "VAN sur 25 ans ($)",
      },
      optimal: "Le point optimal est celui qui maximise la VAN tout en respectant les contraintes du site.",
    },
    selection: {
      title: "Sélection du Système Optimal",
      description: "Le système recommandé est sélectionné automatiquement selon les critères suivants:",
      criteria: [
        "Maximisation de la VAN sur 25 ans",
        "Respect des contraintes de toiture et structurelles",
        "Équilibre entre taille du système et rendement marginal",
        "Considération du TRI minimum acceptable (si spécifié)",
      ],
    },
  },
};

const en = {
  title: "Analysis Methodology",
  subtitle: "Complete technical documentation of assumptions, formulas and calculations used in solar + storage analyses",
  exportPdf: "Export to PDF",
  exporting: "Exporting...",
  
  tabs: {
    overview: "Overview",
    solar: "Solar Production",
    battery: "Storage",
    financial: "Financial",
    optimization: "Optimization",
  },

  overview: {
    purpose: {
      title: "Analysis Purpose",
      description: "The kWh Québec analysis tool performs a comprehensive 25-year energy and financial simulation for photovoltaic solar systems with or without battery storage.",
      points: [
        "8760-hour simulation of solar production and consumption",
        "Battery behavior modeling with state of charge tracking",
        "Energy and power savings calculation based on Hydro-Québec rates",
        "Financial projection including all government incentives",
        "Multi-scenario sensitivity analysis for sizing optimization",
      ],
    },
    dataInputs: {
      title: "Input Data",
      consumption: {
        title: "Consumption Data",
        description: "CSV files exported from Hydro-Québec containing historical consumption data.",
        formats: [
          "Hourly data in kWh (energy)",
          "15-minute data in kW (power)",
          "CSV format with Latin-1 encoding and semicolon delimiters",
          "Up to 200 simultaneous files covering 24+ months",
        ],
      },
      site: {
        title: "Site Parameters",
        description: "Physical characteristics and building constraints.",
        params: [
          "Available roof area (sq ft)",
          "Roof utilization ratio (%)",
          "Orientation and tilt (if known)",
          "Structural constraints",
        ],
      },
      interpolation: {
        title: "Missing Data Interpolation",
        description: "When entire months of consumption data are missing from the CSV files, the system performs intelligent interpolation to estimate values.",
        method: {
          title: "Interpolation Method",
          steps: [
            "Automatic detection of months with no consumption data",
            "Hourly average calculation from adjacent months (e.g., January + March to estimate February)",
            "Circular handling for edge months (December uses November/January, January uses December/February)",
            "Default to zero if no adjacent data available",
          ],
        },
        quality: {
          title: "Data Quality Indicator",
          description: "When months are interpolated, a warning is displayed in the interface showing which months were estimated. This transparency helps users understand the source of data used in the analysis.",
        },
        limitations: [
          "Interpolation only applies to entirely missing months",
          "Partially incomplete months use the average of available data",
          "Analysis results may be less accurate for sites with significant interpolated data",
        ],
      },
      tariffDetection: {
        title: "Automatic Tariff Detection",
        description: "The system automatically detects the appropriate Hydro-Québec tariff code based on simulated peak demand.",
        tariffs: [
          { code: "G", threshold: "< 65 kW", description: "Small power tariff for sites with monthly peak under 65 kW" },
          { code: "M", threshold: "≥ 65 kW", description: "Medium power tariff for sites with monthly peak of 65 kW or more" },
        ],
        note: "Detection runs when initializing analysis assumptions. Saved assumptions take priority over auto-detected values.",
      },
    },
    assumptions: {
      title: "Default Assumptions",
      subtitle: "These values can be modified in analysis parameters",
      categories: [
        {
          name: "Solar Production",
          items: [
            { label: "System efficiency", value: "85%" },
            { label: "Annual degradation", value: "0.5%/year" },
            { label: "Reference irradiation", value: "Quebec average" },
          ],
        },
        {
          name: "Battery Storage",
          items: [
            { label: "Round-trip efficiency", value: "90%" },
            { label: "Depth of discharge", value: "90%" },
            { label: "Lifespan", value: "10-15 years" },
          ],
        },
        {
          name: "Financial",
          items: [
            { label: "Discount rate", value: "8%" },
            { label: "HQ rate inflation", value: "4.8%/year" },
            { label: "Tax rate", value: "26.5%" },
          ],
        },
        {
          name: "CAPEX",
          items: [
            { label: "Solar cost", value: "$2.25/Wp" },
            { label: "Battery energy cost", value: "$550/kWh" },
            { label: "Battery power cost", value: "$800/kW" },
          ],
        },
      ],
    },
  },

  solar: {
    production: {
      title: "Solar Production Simulation",
      description: "Solar production is simulated for each hour of the year (8760 hours) using a Gaussian model adjusted for Quebec's latitude and seasonal variations.",
      formula: {
        title: "Hourly Production Formula",
        equation: "P(h) = Pnom × Geff(h) / Gstc × ηsys × (1 - δ)^year",
      },
      variables: {
        title: "Variables",
        list: [
          { symbol: "P(h)", description: "Production at hour h (kWh)" },
          { symbol: "Pnom", description: "System nominal power (kWp)" },
          { symbol: "Geff(h)", description: "Effective irradiation at hour h (W/m²)" },
          { symbol: "Gstc", description: "Standard test conditions irradiation (1000 W/m²)" },
          { symbol: "ηsys", description: "Overall system efficiency (85%)" },
          { symbol: "δ", description: "Annual degradation rate (0.5%)" },
        ],
      },
      seasonal: {
        title: "Seasonal Adjustment",
        description: "The model incorporates typical Quebec seasonal variations with peak production in June and minimum production in December. Production amplitude varies by a factor of 3-4x between summer and winter.",
      },
    },
    sizing: {
      title: "System Sizing",
      description: "Maximum solar system size is limited by available roof area and utilization ratio.",
      formula: "PV_max (kWp) = (Area × Utilization_ratio) / 10",
      constraints: {
        title: "Constraints Considered",
        list: [
          "Usable roof area (sq ft → m²)",
          "Utilization ratio (typically 60-80%)",
          "Standard power density: 10 sq ft/kWp",
          "Structural and regulatory constraints",
        ],
      },
    },
    selfConsumption: {
      title: "Self-Consumption and Self-Sufficiency",
      description: "Two key metrics measure effective use of solar production.",
      formulas: {
        selfConsumption: "Self-consumption (%) = Self-consumed_production / Total_production × 100",
        selfSufficiency: "Self-sufficiency (%) = Self-consumed_production / Total_consumption × 100",
      },
    },
    advancedModeling: {
      title: "Advanced Modeling (Helioscope Parameters)",
      description: "The hourly simulation engine includes professional-grade modeling parameters inspired by industry tools like Helioscope.",
      parameters: [
        {
          name: "DC/AC Ratio (ILR)",
          description: "Configurable oversizing of DC array relative to inverter AC capacity.",
          default: "1.2 (range: 1.0-2.0)",
          formula: "If DC_production > Inverter_AC_capacity: Clipped_production = AC_capacity",
          note: "Tracks clipping losses when DC production exceeds AC capacity.",
        },
        {
          name: "Temperature Coefficient",
          description: "Adjusts hourly PV output based on cell temperature.",
          default: "-0.4%/°C (typical for crystalline silicon)",
          formula: "P_corrected = P_base × (1 + Temp_coeff × (T_cell - 25°C))",
          note: "Uses T_cell = T_ambient + 25°C with Quebec monthly averages.",
        },
        {
          name: "Wire Losses",
          description: "Conductor and wiring losses applied after temperature correction.",
          default: "2% (configurable 0-10%)",
          formula: "P_final = P_after_clipping × (1 - Wire_losses)",
        },
        {
          name: "Degradation Rate",
          description: "Annual panel degradation applied in all financial calculations.",
          default: "0.5%/year",
          formula: "Revenue_year_Y = Base_savings × (1 - degradation)^(Y-1) × (1 + inflation)^(Y-1)",
          note: "Affects LCOE and 25-year NPV.",
        },
      ],
      temperatureProfile: {
        title: "Quebec Temperature Profile",
        months: [
          { month: "January", temp: "-10°C" },
          { month: "February", temp: "-8°C" },
          { month: "March", temp: "-2°C" },
          { month: "April", temp: "6°C" },
          { month: "May", temp: "13°C" },
          { month: "June", temp: "18°C" },
          { month: "July", temp: "21°C" },
          { month: "August", temp: "20°C" },
          { month: "September", temp: "15°C" },
          { month: "October", temp: "8°C" },
          { month: "November", temp: "2°C" },
          { month: "December", temp: "-7°C" },
        ],
      },
    },
    bifacial: {
      title: "Bifacial Panel Analysis",
      description: "The system automatically detects white membrane roofs via Google Solar API satellite imagery and offers bifacial analysis.",
      detection: {
        title: "Automatic Detection",
        description: "The algorithm analyzes average RGB brightness of satellite roof imagery. A threshold > 200 indicates a white high-reflectivity membrane.",
      },
      formula: {
        title: "Bifacial Boost Formula",
        equation: "Bifacial_yield = Base_yield × (1 + Bifaciality_factor × Roof_albedo × View_factor)",
      },
      parameters: [
        { name: "Bifaciality factor", default: "0.85", description: "Back-side to front-side sensitivity ratio" },
        { name: "White roof albedo", default: "0.70", description: "TPO/EPDM white membrane reflectivity" },
        { name: "Gravel roof albedo", default: "0.20", description: "Typical gravel ballast reflectivity" },
        { name: "Dark roof albedo", default: "0.10", description: "Asphalt/black membrane reflectivity" },
        { name: "View factor", default: "0.35", description: "Portion of reflected radiation reaching panel backs" },
      ],
      costPremium: {
        title: "Cost Premium",
        description: "Bifacial panels have a 5% premium on cost per watt compared to standard monofacial panels.",
      },
    },
    yieldHierarchy: {
      title: "Yield Hierarchy",
      description: "The system displays three yield levels for complete transparency on production calculations.",
      levels: [
        { 
          name: "Base Yield", 
          value: "1000-1200 kWh/kWp", 
          description: "Variable yield based on racking system (KB 10°: 1000, Opsun 25°: 1200)" 
        },
        { 
          name: "Gross Yield", 
          value: "Variable", 
          description: "After orientation, tilt, and bifacial boost adjustments (if applicable)" 
        },
        { 
          name: "Net Delivered Yield", 
          value: "Variable", 
          description: "Final yield after all losses: temperature, wiring, ILR, shading" 
        },
      ],
      formula: "Net_yield = Base_yield × Orientation_factor × Bifacial_boost × (1 - Temp_losses) × (1 - Wire_losses) × ILR_factor",
    },
    googleValidation: {
      title: "Google Solar API Validation",
      description: "The system performs cross-validation with Google Solar API data to validate yield estimates.",
      method: {
        title: "Comparison Methodology",
        description: "Comparison is based on specific yield (kWh/kWp) rather than total production, as Google Solar API is optimized for residential installations and may underestimate C&I system sizes.",
      },
      thresholds: [
        { range: "±10%", status: "Validated", color: "green", description: "Yield consistent with satellite data" },
        { range: "10-20%", status: "Acceptable", color: "yellow", description: "Difference within acceptable margins" },
        { range: ">20%", status: "Review needed", color: "red", description: "Recommendation to revise parameters" },
      ],
      limitations: {
        title: "Known Limitations",
        list: [
          "Google Solar API often caps at ~50kWp (residential scale)",
          "Large C&I buildings may exceed API capabilities",
          "Specific yield comparison remains valid even when sizes differ",
        ],
      },
    },
    kbRacking: {
      title: "KB Racking Validated Data",
      description: "Sizing parameters are validated against 18 real commercial projects (~40 MW, $7.3M racking value). This approach uses manual roof tracing as the source of truth and applies KB Racking specs directly for accurate calculations.",
      methodology: {
        title: "Direct KB Racking Calculation (No Correction Factor)",
        steps: [
          "Manual roof tracing: Source of truth for roof surfaces (Google not reliable for C&I)",
          "Usable area = Traced area × 85% (1.22m perimeter setback per IFC code)",
          "Number of panels = Usable area ÷ 3.71 m² (KB Racking footprint)",
          "Capacity = Number of panels × 625W (Jinko bifacial panel)",
        ],
      },
      specs: {
        title: "KB Racking Validated Specifications",
        panelsLabel: "Panels",
        rackingLabel: "Racking System",
        panels: [
          { name: "Panel model", value: "Jinko Solar 625W bifacial" },
          { name: "Dimensions", value: "2382 × 1134 × 30 mm" },
          { name: "Panel weight", value: "32.4 kg" },
          { name: "Cell type", value: "72-cell bifacial" },
        ],
        racking: [
          { name: "System", value: "AeroGrid 10° Landscape" },
          { name: "Racking weight/panel", value: "12.84 kg" },
          { name: "Row spacing", value: "1.557 m (center to center)" },
          { name: "Inter-row gap", value: "0.435 m" },
          { name: "Perimeter setback", value: "1.22 m (IFC fire code)" },
          { name: "Tilt angle", value: "10°" },
        ],
      },
      pricing: {
        title: "KB Racking Pricing Curve",
        tiers: [
          { range: "< 1,500 panels", price: "$115.50/panel" },
          { range: "1,500-3,000", price: "$113.00/panel" },
          { range: "3,000-5,000", price: "$111.50/panel" },
          { range: "5,000-8,000", price: "$111.00/panel" },
          { range: "8,000+", price: "$110.00/panel" },
        ],
      },
      comparison: {
        title: "KB Racking Validation",
        description: "Based on analysis of 18 real sites, the direct calculation (area × 85% ÷ 3.71 m² × 625W) yields results within ~6% of final KB designs. The difference is explained by final adjustments: walkways, wiring paths, specific obstacles.",
      },
    },
  },

  battery: {
    peakShaving: {
      title: "Peak Shaving",
      description: "The battery management algorithm aims to reduce power peaks drawn from the grid, generating savings on demand charges.",
      algorithm: {
        title: "Dispatch Algorithm",
        steps: [
          "Calculate net load: Load_net = Consumption - Solar_production",
          "If Load_net > Shaving_threshold AND SOC > SOC_min: Discharge battery",
          "If Load_net < 0 AND SOC < SOC_max: Charge with solar surplus",
          "Respect battery C-rate power limits",
          "Update state of charge (SOC) after each interval",
        ],
      },
      socTracking: {
        title: "State of Charge Tracking",
        description: "State of charge (SOC) is tracked at each 15-minute interval to ensure operational constraints are met.",
        formula: "SOC(t+1) = SOC(t) ± (P_batt × Δt × η) / E_batt",
      },
    },
    sizing: {
      title: "Battery Sizing",
      description: "Battery capacity is sized according to two parameters: energy (kWh) and power (kW).",
      energy: {
        title: "Energy Capacity (kWh)",
        description: "Determines storable energy amount, affecting possible support duration.",
        formula: "E_batt = Daily_shaving_energy × Safety_factor / DoD",
      },
      power: {
        title: "Power (kW)",
        description: "Determines maximum charge/discharge rate.",
        formula: "P_batt = Target_peak_reduction × Safety_factor",
      },
    },
    degradation: {
      title: "Degradation and Replacement",
      description: "The battery degrades over time and must be replaced.",
      factors: [
        "Typical lifespan: 10-15 years depending on usage",
        "Replacement cost: % of initial cost with annual decline",
        "Inflation applied to replacement cost",
        "Replacement year configurable in parameters",
      ],
    },
  },

  financial: {
    capex: {
      title: "Capital Costs (CAPEX)",
      description: "Total CAPEX includes all initial system costs.",
      formula: "CAPEX_total = (PV_kWp × PV_cost) + (Batt_kWh × kWh_cost) + (Batt_kW × kW_cost)",
      components: {
        title: "Components",
        list: [
          { name: "Solar cost ($/Wp)", description: "Modules, inverters, racking, installation" },
          { name: "Battery energy cost ($/kWh)", description: "Battery cells and modules" },
          { name: "Battery power cost ($/kW)", description: "Battery inverter and controller" },
        ],
      },
    },
    incentives: {
      title: "Incentives and Subsidies",
      hq: {
        title: "Hydro-Québec Incentives",
        description: "Hydro-Québec Self-Generation program for commercial installations.",
        details: [
          "Solar: $1,000/kWp installed",
          "Storage: credit only when paired with solar (uses remaining cap room)",
          "Cap: 40% of gross CAPEX",
        ],
        formula: "HQ_incentive = min(PV_kWp × 1000, CAPEX × 0.40) + residual credit for storage",
      },
      itc: {
        title: "Federal Investment Tax Credit (ITC)",
        description: "30% investment tax credit on net CAPEX (after HQ incentives).",
        formula: "ITC = (Gross_CAPEX - HQ_incentive) × 0.30",
      },
      taxShield: {
        title: "Tax Shield (CCA/DPA)",
        description: "Accelerated capital cost allowance deductions on solar equipment (Class 43.2).",
        formula: "Tax_shield = Net_CAPEX × CCA_rate × Tax_rate",
      },
      timing: {
        title: "Incentive Timeline",
        description: "Incentives are paid at different times, affecting actual cash flow.",
        timeline: [
          { year: "Year 0", items: ["HQ Solar Rebate (100%)", "HQ Battery Rebate (50%)"] },
          { year: "Year 1", items: ["Remaining HQ Battery Rebate (50%)", "Tax Shield (CCA/DPA)"] },
          { year: "Year 2", items: ["Federal Investment Tax Credit (ITC 30%)"] },
        ],
        note: "Initial equity required = Gross CAPEX - HQ Solar Rebate - 50% HQ Battery Rebate",
      },
    },
    cashflow: {
      title: "Cash Flow",
      description: "The model generates annual cash flow over 25 years.",
      revenue: {
        title: "Revenue (Savings)",
        formula: "Savings(year) = Energy_saved × Energy_rate + Power_reduced × Power_rate × 12",
      },
      costs: {
        title: "Operating Costs (O&M)",
        formula: "O&M(year) = CAPEX_PV × %O&M_PV + CAPEX_Batt × %O&M_Batt × (1 + O&M_inflation)^year",
      },
      degradation: {
        title: "Degradation Impact",
        description: "Annual revenue decreases according to panel degradation rate.",
        formula: "Revenue(year) = Base_savings × (1 - degradation)^(year-1) × (1 + inflation)^(year-1)",
        example: "With 0.5%/year degradation: Year 1 = 100%, Year 10 = 95.5%, Year 25 = 88.6%",
      },
    },
    financing: {
      title: "Financing Options",
      description: "The calculator compares three financing options over a 25-year horizon.",
      options: [
        {
          name: "Cash Purchase",
          description: "Full upfront payment with maximum incentive returns.",
          formula: "Equity = Gross_CAPEX - HQ_Solar_Rebate - 50%_HQ_Battery_Rebate",
          pros: ["Maximum return", "Immediate ownership", "Full incentives"],
          cons: ["High initial capital"],
        },
        {
          name: "Loan",
          description: "Debt financing with monthly payments.",
          formula: "Monthly_payment = Principal × [r(1+r)^n] / [(1+r)^n - 1]",
          params: ["Term: 5-20 years", "Interest rate: variable", "Down payment: 0-30%"],
        },
        {
          name: "Capital Lease (Crédit-Bail)",
          description: "Fixed monthly payments with client treated as owner for tax purposes. Client receives all incentives (HQ rebates, Federal ITC 30%, CCA tax shield).",
          formula: "Monthly_payment = (CAPEX × Implicit_rate_factor) / (Term × 12)",
          note: "Typically results in positive or break-even cash flows due to incentives.",
        },
      ],
    },
    metrics: {
      title: "Financial Metrics",
      list: [
        {
          name: "NPV (Net Present Value)",
          description: "Discounted sum of all cash flows over project lifetime.",
          formula: "NPV = -Net_CAPEX + Σ(CF_year / (1 + r)^year)",
        },
        {
          name: "IRR (Internal Rate of Return)",
          description: "Discount rate that makes NPV equal to zero.",
          formula: "NPV(IRR) = 0 → solve for IRR",
        },
        {
          name: "Simple Payback",
          description: "Number of years to recover initial investment.",
          formula: "Payback = Net_CAPEX / Average_annual_savings",
        },
        {
          name: "LCOE (Levelized Cost of Energy)",
          description: "Average cost per kWh produced over system lifetime.",
          formula: "LCOE = (Net_CAPEX + NPV_O&M) / Σ(Discounted_production)",
        },
      ],
    },
  },

  optimization: {
    sensitivity: {
      title: "Sensitivity Analysis",
      description: "Sensitivity analysis explores different system size combinations to identify optimal configuration.",
      scenarios: {
        title: "Scenario Types",
        list: [
          { type: "Solar only", description: "PV size variation from 10% to 100% of maximum capacity" },
          { type: "Battery only", description: "Battery capacity variation from 0 to optimal capacity" },
          { type: "Hybrid", description: "PV and battery combinations at different scales" },
        ],
      },
    },
    frontier: {
      title: "Efficiency Frontier",
      description: "The efficiency frontier chart visualizes the trade-off between investment (CAPEX) and return (NPV).",
      axes: {
        title: "Chart Axes",
        x: "Net CAPEX after incentives ($)",
        y: "25-year NPV ($)",
      },
      optimal: "The optimal point is the one that maximizes NPV while respecting site constraints.",
    },
    selection: {
      title: "Optimal System Selection",
      description: "The recommended system is automatically selected based on the following criteria:",
      criteria: [
        "Maximization of 25-year NPV",
        "Compliance with roof and structural constraints",
        "Balance between system size and marginal return",
        "Consideration of minimum acceptable IRR (if specified)",
      ],
    },
  },
};
