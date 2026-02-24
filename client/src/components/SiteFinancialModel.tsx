import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ChevronDown, ChevronUp, Building2, DollarSign, TrendingUp,
  FileText, Loader2, Pencil, Check, X
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SiteFinancialModel } from "@shared/schema";

type Responsibility = "kwh" | "dream" | "computed";

interface FieldDef {
  key: string;
  labelFr: string;
  labelEn: string;
  responsibility: Responsibility;
  format: "currency" | "percent" | "number" | "currency_per_w" | "kwh" | "kw" | "years" | "boolean" | "rate";
  getValue: (m: SiteFinancialModel) => number | boolean | null | undefined;
}

function formatFieldValue(value: number | boolean | null | undefined, format: string): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes / Oui" : "No / Non";
  switch (format) {
    case "currency":
      return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value);
    case "currency_per_w":
      return `${value.toFixed(2)} $/W`;
    case "percent":
      return `${(value * 100).toFixed(1)}%`;
    case "rate":
      return `${value.toFixed(2)} $/kWh`;
    case "kwh":
      return `${new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 0 }).format(value)} kWh`;
    case "kw":
      return `${new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 0 }).format(value)} kW`;
    case "years":
      return `${value} ${value === 1 ? "an" : "ans"}`;
    case "number":
      return new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 2 }).format(value);
    default:
      return String(value);
  }
}

const responsibilityConfig: Record<Responsibility, { label: string; className: string }> = {
  kwh: { label: "kWh Québec", className: "bg-[#FFB005]/15 text-[#996800] border-[#FFB005]" },
  dream: { label: "Dream", className: "bg-[#00B0F0]/15 text-[#006890] border-[#00B0F0]" },
  computed: { label: "Résultat", className: "bg-[#16A34A]/15 text-[#0A6B2E] border-[#16A34A]" },
};

const sections: Array<{
  id: string;
  titleFr: string;
  titleEn: string;
  icon: typeof DollarSign;
  fields: FieldDef[];
}> = [
  {
    id: "projectSpecs",
    titleFr: "Spécifications du projet",
    titleEn: "Project Specifications",
    icon: Building2,
    fields: [
      { key: "projectSizeDcKw", labelFr: "Taille DC (kW)", labelEn: "Project Size DC (kW)", responsibility: "kwh", format: "kw", getValue: m => m.projectSpecs.projectSizeDcKw },
      { key: "projectSizeAcKw", labelFr: "Taille AC (kW)", labelEn: "Project Size AC (kW)", responsibility: "kwh", format: "kw", getValue: m => m.projectSpecs.projectSizeAcKw },
      { key: "yieldKwhPerKwp", labelFr: "Rendement (kWh/kWp)", labelEn: "Yield (kWh/kWp)", responsibility: "kwh", format: "number", getValue: m => m.projectSpecs.yieldKwhPerKwp },
      { key: "firstYearKwh", labelFr: "Production 1re année", labelEn: "1st Year Production", responsibility: "kwh", format: "kwh", getValue: m => m.projectSpecs.firstYearKwh },
      { key: "degradationPct", labelFr: "Dégradation annuelle", labelEn: "Annual Degradation", responsibility: "kwh", format: "percent", getValue: m => m.projectSpecs.degradationPct ? m.projectSpecs.degradationPct / 100 : null },
      { key: "availabilityPct", labelFr: "Disponibilité", labelEn: "Availability", responsibility: "kwh", format: "percent", getValue: m => m.projectSpecs.availabilityPct ? m.projectSpecs.availabilityPct / 100 : null },
      { key: "usefulLifeYears", labelFr: "Durée de vie utile", labelEn: "Projected Useful Life", responsibility: "kwh", format: "years", getValue: m => m.projectSpecs.usefulLifeYears },
    ]
  },
  {
    id: "projectCosts",
    titleFr: "Coûts du projet",
    titleEn: "Project Costs",
    icon: DollarSign,
    fields: [
      { key: "installCostPerW", labelFr: "Coût d'installation ($/W)", labelEn: "Install Cost ($/W)", responsibility: "kwh", format: "currency_per_w", getValue: m => m.projectCosts.installCostPerW },
      { key: "constructionCosts", labelFr: "Coûts de construction", labelEn: "Construction Costs", responsibility: "kwh", format: "currency", getValue: m => m.projectCosts.constructionCosts },
      { key: "municipalFees", labelFr: "Frais municipaux", labelEn: "Municipal Fees", responsibility: "dream", format: "currency", getValue: m => m.projectCosts.municipalFees },
      { key: "interconnectionCost", labelFr: "Interconnexion (Hydro-Québec)", labelEn: "Interconnection (Hydro-Québec)", responsibility: "dream", format: "currency", getValue: m => m.projectCosts.interconnectionCost },
      { key: "developmentFees", labelFr: "Frais de développement", labelEn: "Development Fees", responsibility: "kwh", format: "currency", getValue: m => m.projectCosts.developmentFees },
      { key: "totalProjectCost", labelFr: "Coût total du projet", labelEn: "Total Project Cost", responsibility: "computed", format: "currency", getValue: m => m.projectCosts.totalProjectCost },
      { key: "allInCosts", labelFr: "Coûts tout inclus", labelEn: "All-in Costs", responsibility: "computed", format: "currency", getValue: m => m.projectCosts.allInCosts },
      { key: "projectCostPerW", labelFr: "Coût du projet ($/W)", labelEn: "Project Cost ($/W)", responsibility: "computed", format: "currency_per_w", getValue: m => m.projectCosts.projectCostPerW },
    ]
  },
  {
    id: "revenue",
    titleFr: "Revenus",
    titleEn: "Revenue",
    icon: TrendingUp,
    fields: [
      { key: "ppaRate", labelFr: "Taux PPA ($/kWh)", labelEn: "PPA Rate ($/kWh)", responsibility: "kwh", format: "rate", getValue: m => m.revenue.ppaRate },
      { key: "ppaEscalator", labelFr: "Escalade PPA (%)", labelEn: "PPA Escalator (%)", responsibility: "kwh", format: "percent", getValue: m => m.revenue.ppaEscalator },
      { key: "ppaLengthYears", labelFr: "Durée PPA", labelEn: "PPA Length", responsibility: "kwh", format: "years", getValue: m => m.revenue.ppaLengthYears },
      { key: "tailRate", labelFr: "Taux résiduel ($/kWh)", labelEn: "Tail Rate ($/kWh)", responsibility: "kwh", format: "rate", getValue: m => m.revenue.tailRate },
    ]
  },
  {
    id: "operatingCosts",
    titleFr: "Coûts d'exploitation",
    titleEn: "Operating Costs",
    icon: FileText,
    fields: [
      { key: "omRatePerKw", labelFr: "O&M ($/kW)", labelEn: "O&M Rate ($/kW)", responsibility: "kwh", format: "currency_per_w", getValue: m => m.operatingCosts.omRatePerKw },
      { key: "omCost", labelFr: "Coût O&M", labelEn: "O&M Cost", responsibility: "kwh", format: "currency", getValue: m => m.operatingCosts.omCost },
      { key: "variableOpCostPerKw", labelFr: "Coûts variables ($/kW)", labelEn: "Variable Costs ($/kW)", responsibility: "kwh", format: "currency_per_w", getValue: m => m.operatingCosts.variableOpCostPerKw },
      { key: "variableOpCost", labelFr: "Coûts variables ($)", labelEn: "Variable Costs ($)", responsibility: "kwh", format: "currency", getValue: m => m.operatingCosts.variableOpCost },
      { key: "totalOperationsCostYr1", labelFr: "Total exploitation an 1", labelEn: "Total Operations Yr 1", responsibility: "computed", format: "currency", getValue: m => m.operatingCosts.totalOperationsCostYr1 },
      { key: "inflationRate", labelFr: "Inflation", labelEn: "Inflation", responsibility: "kwh", format: "percent", getValue: m => m.operatingCosts.inflationRate },
    ]
  },
  {
    id: "financing",
    titleFr: "Financement",
    titleEn: "Financing",
    icon: DollarSign,
    fields: [
      { key: "financingEnabled", labelFr: "Financement", labelEn: "Financing", responsibility: "kwh", format: "boolean", getValue: m => m.financing.financingEnabled },
      { key: "debtPercent", labelFr: "% dette", labelEn: "Debt %", responsibility: "kwh", format: "percent", getValue: m => m.financing.debtPercent },
      { key: "debtAmount", labelFr: "Montant dette", labelEn: "Debt Amount", responsibility: "computed", format: "currency", getValue: m => m.financing.debtAmount },
      { key: "debtTerm", labelFr: "Terme", labelEn: "Term", responsibility: "kwh", format: "years", getValue: m => m.financing.debtTerm },
      { key: "interestRate", labelFr: "Taux d'intérêt", labelEn: "Interest Rate", responsibility: "kwh", format: "percent", getValue: m => m.financing.interestRate },
      { key: "dscrTarget", labelFr: "DSCR cible", labelEn: "DSCR Target", responsibility: "kwh", format: "number", getValue: m => m.financing.dscrTarget },
      { key: "equity", labelFr: "Équité requise", labelEn: "Required Equity", responsibility: "computed", format: "currency", getValue: m => m.financing.equity },
    ]
  },
  {
    id: "itc",
    titleFr: "Crédit d'impôt (CII)",
    titleEn: "Investment Tax Credit (ITC)",
    icon: DollarSign,
    fields: [
      { key: "itcEligible", labelFr: "Éligible CII", labelEn: "ITC Eligible", responsibility: "kwh", format: "boolean", getValue: m => m.itc.itcEligible },
      { key: "itcRate", labelFr: "Taux CII", labelEn: "ITC Rate", responsibility: "kwh", format: "percent", getValue: m => m.itc.itcRate },
      { key: "eligibleCostsAssumption", labelFr: "Hypothèse coûts éligibles", labelEn: "Eligible Costs Assumption", responsibility: "kwh", format: "percent", getValue: m => m.itc.eligibleCostsAssumption },
      { key: "eligibleCosts", labelFr: "Coûts éligibles", labelEn: "Eligible Costs", responsibility: "computed", format: "currency", getValue: m => m.itc.eligibleCosts },
      { key: "nonEligibleCosts", labelFr: "Coûts non éligibles", labelEn: "Non-Eligible Costs", responsibility: "computed", format: "currency", getValue: m => m.itc.nonEligibleCosts },
      { key: "potentialItcRebate", labelFr: "Remise CII potentielle", labelEn: "Potential ITC Rebate", responsibility: "computed", format: "currency", getValue: m => m.itc.potentialItcRebate },
      { key: "effectiveItcRebate", labelFr: "Remise CII effective", labelEn: "Effective ITC Rebate", responsibility: "computed", format: "currency", getValue: m => m.itc.effectiveItcRebate },
    ]
  },
  {
    id: "results",
    titleFr: "Résultats",
    titleEn: "Results",
    icon: TrendingUp,
    fields: [
      { key: "pretaxIrr", labelFr: "TRI avant impôt", labelEn: "Pretax IRR", responsibility: "computed", format: "percent", getValue: m => m.results.pretaxIrr },
    ]
  },
];

interface SiteFinancialCardProps {
  portfolioSiteId: string;
  siteName: string;
  siteAddress: string;
  siteCity: string;
  financialModel: SiteFinancialModel | null;
  language: string;
  portfolioId: string;
}

function SiteFinancialCard({ portfolioSiteId, siteName, siteAddress, siteCity, financialModel, language, portfolioId }: SiteFinancialCardProps) {
  const [isOpen, setIsOpen] = useState(!!financialModel);
  const t = (fr: string, en: string) => language === "fr" ? fr : en;
  const hasData = !!financialModel;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer flex flex-row items-center justify-between gap-2 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <Building2 className="w-5 h-5 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <CardTitle className="text-base truncate" data-testid={`text-financial-site-${portfolioSiteId}`}>
                  {siteName}
                </CardTitle>
                <p className="text-sm text-muted-foreground truncate">{siteAddress}, {siteCity}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {hasData ? (
                <Badge variant="default" className="text-xs" data-testid={`badge-financial-status-${portfolioSiteId}`}>
                  {t("Complété", "Complete")}
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs" data-testid={`badge-financial-status-${portfolioSiteId}`}>
                  {t("En attente", "Pending")}
                </Badge>
              )}
              {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {!hasData ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">{t("Données financières en attente", "Financial data pending")}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <div key={section.id}>
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="w-4 h-4 text-[#003DA6]" />
                        <h4 className="text-sm font-semibold text-[#003DA6]">
                          {t(section.titleFr, section.titleEn)}
                        </h4>
                      </div>
                      <div className="overflow-x-auto border rounded-lg">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[40%]">{t("Paramètre", "Parameter")}</TableHead>
                              <TableHead className="text-right w-[35%]">{t("Valeur", "Value")}</TableHead>
                              <TableHead className="text-right w-[25%]">{t("Responsable", "Responsibility")}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {section.fields.map((field) => {
                              const value = field.getValue(financialModel);
                              const config = responsibilityConfig[field.responsibility];
                              return (
                                <TableRow key={field.key} data-testid={`row-financial-${field.key}`}>
                                  <TableCell className="text-sm">{t(field.labelFr, field.labelEn)}</TableCell>
                                  <TableCell className="text-right font-mono text-sm">
                                    {formatFieldValue(value, field.format)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Badge variant="outline" className={`text-xs ${config.className}`}>
                                      {config.label}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

interface MasterAgreementHeaderProps {
  language: string;
  numSites: number;
}

function MasterAgreementHeader({ language, numSites }: MasterAgreementHeaderProps) {
  const t = (fr: string, en: string) => language === "fr" ? fr : en;

  return (
    <Card className="border-[#003DA6]/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-[#003DA6]">
          <FileText className="w-5 h-5" />
          {t("Entente maîtresse — Modèle financier", "Master Agreement — Financial Model")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-[#003DA6]/5 border border-[#003DA6]/10">
            <p className="text-xs text-muted-foreground mb-1">{t("Propriétaire", "Owner")}</p>
            <p className="text-sm font-semibold">Dream Industrial REIT</p>
          </div>
          <div className="p-3 rounded-lg bg-[#FFB005]/10 border border-[#FFB005]/20">
            <p className="text-xs text-muted-foreground mb-1">{t("EPC & exploitation", "EPC & Operations")}</p>
            <p className="text-sm font-semibold">kWh Québec</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 border">
            <p className="text-xs text-muted-foreground mb-1">{t("Consultant RFP", "RFP Consultant")}</p>
            <p className="text-sm font-semibold">ScaleClean Tech</p>
          </div>
        </div>
        <Separator />
        <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
          <span>{numSites} {t("sites", "sites")}</span>
          <span className="text-muted-foreground/30">|</span>
          <span>{t("Proposition globale avec tarification par site", "Global proposal with per-site pricing")}</span>
          <span className="text-muted-foreground/30">|</span>
          <span>{t("Escompte volume inclus", "Volume discount included")}</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="outline" className={responsibilityConfig.kwh.className}>
            {responsibilityConfig.kwh.label} — {t("Responsabilité kWh", "kWh Responsibility")}
          </Badge>
          <Badge variant="outline" className={responsibilityConfig.dream.className}>
            {responsibilityConfig.dream.label} — {t("Responsabilité Dream", "Dream Responsibility")}
          </Badge>
          <Badge variant="outline" className={responsibilityConfig.computed.className}>
            {responsibilityConfig.computed.label} — {t("Valeur calculée", "Computed Value")}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

interface PortfolioFinancialModelsProps {
  portfolioId: string;
  portfolioSites: Array<{
    id: string;
    siteId: string;
    financialModel: any;
    site: { id: string; name: string; address: string; city: string };
  }>;
  language: string;
}

export default function PortfolioFinancialModels({ portfolioId, portfolioSites, language }: PortfolioFinancialModelsProps) {
  const t = (fr: string, en: string) => language === "fr" ? fr : en;
  const sitesWithData = portfolioSites.filter(ps => ps.financialModel);
  const sitesWithoutData = portfolioSites.filter(ps => !ps.financialModel);

  const sorted = [...sitesWithData, ...sitesWithoutData];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          {t("Modèles financiers par site", "Per-Site Financial Models")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {sitesWithData.length}/{portfolioSites.length} {t("sites avec données", "sites with data")}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <MasterAgreementHeader language={language} numSites={portfolioSites.length} />
        <div className="space-y-3">
          {sorted.map((ps) => (
            <SiteFinancialCard
              key={ps.id}
              portfolioSiteId={ps.id}
              siteName={ps.site.name}
              siteAddress={ps.site.address}
              siteCity={ps.site.city}
              financialModel={ps.financialModel as SiteFinancialModel | null}
              language={language}
              portfolioId={portfolioId}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
