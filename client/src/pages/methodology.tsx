import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileDown, Calculator, Sun, Battery, DollarSign, BarChart3, Zap, TrendingUp, Info } from "lucide-react";
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
            { label: "Coût solaire", value: "1.50 $/Wc" },
            { label: "Coût batterie énergie", value: "400 $/kWh" },
            { label: "Coût batterie puissance", value: "200 $/kW" },
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
          "Stockage: 300 $/kW de capacité",
          "Plafond: 40% du CAPEX brut",
        ],
        formula: "Incitatif_HQ = min(PV_kWc × 1000 + Batt_kW × 300, CAPEX × 0.40)",
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
            { label: "Solar cost", value: "$1.50/Wp" },
            { label: "Battery energy cost", value: "$400/kWh" },
            { label: "Battery power cost", value: "$200/kW" },
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
          "Storage: $300/kW capacity",
          "Cap: 40% of gross CAPEX",
        ],
        formula: "HQ_incentive = min(PV_kWp × 1000 + Batt_kW × 300, CAPEX × 0.40)",
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
