import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, ChevronUp, ChevronDown, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useI18n } from "@/lib/i18n";
import type { PriceBreakdownResponse } from "../types";

export function PriceBreakdownSection({ siteId }: { siteId: string }) {
  const { language } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  const categoryLabels: Record<string, { en: string; fr: string }> = {
    panels: { en: "Panels", fr: "Panneaux" },
    racking: { en: "Racking", fr: "Structure" },
    inverters: { en: "Inverters", fr: "Onduleurs" },
    bos_electrical: { en: "BOS Electrical", fr: "BOS Électrique" },
    labor: { en: "Labor", fr: "Main-d'œuvre" },
    soft_costs: { en: "Soft Costs", fr: "Coûts indirects" },
    permits: { en: "Permits & Engineering", fr: "Permis & Ingénierie" },
    other: { en: "Other", fr: "Autres" },
  };

  const categoryColors: Record<string, string> = {
    panels: "bg-amber-500",
    racking: "bg-blue-500",
    inverters: "bg-green-500",
    bos_electrical: "bg-purple-500",
    labor: "bg-orange-500",
    soft_costs: "bg-pink-500",
    permits: "bg-cyan-500",
    other: "bg-gray-500",
  };

  const { data: priceData, isLoading, error } = useQuery<PriceBreakdownResponse>({
    queryKey: ['/api/sites', siteId, 'price-breakdown', language],
    queryFn: async () => {
      const res = await fetch(`/api/sites/${siteId}/price-breakdown?lang=${language}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch price breakdown');
      return res.json();
    },
    enabled: isOpen,
  });

  const getCategoryLabel = (category: string) => {
    const key = category.toLowerCase().replace(/\s+/g, '_');
    const label = categoryLabels[key];
    if (label) {
      return language === "fr" ? label.fr : label.en;
    }
    return category;
  };

  const getCategoryColor = (category: string) => {
    const key = category.toLowerCase().replace(/\s+/g, '_');
    return categoryColors[key] || "bg-gray-400";
  };

  const getPercentage = (cost: number, total: number) => {
    if (!total || total === 0) return 0;
    return Math.round((cost / total) * 100);
  };

  const sortedCategories = priceData?.breakdown
    ? Object.entries(priceData.breakdown).sort((a, b) => b[1].cost - a[1].cost)
    : [];

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover-elevate rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">
                  {language === "fr" ? "Ventilation des coûts" : "Price Breakdown"}
                </CardTitle>
                {priceData && (
                  <Badge variant="outline" className="font-mono">
                    ${priceData.totalPerW.toFixed(2)}/W
                  </Badge>
                )}
              </div>
              {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
            {!isOpen && priceData && (
              <CardDescription className="mt-1">
                {language === "fr"
                  ? `Investissement estimé: ${priceData.totalCost.toLocaleString('fr-CA')} $ CAD`
                  : `Estimated investment: $${priceData.totalCost.toLocaleString('en-CA')} CAD`}
              </CardDescription>
            )}
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {isLoading && (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            )}

            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-center">
                <AlertCircle className="w-6 h-6 text-destructive mx-auto mb-2" />
                <p className="text-sm text-destructive">
                  {language === "fr"
                    ? "Impossible de charger la ventilation des coûts"
                    : "Unable to load price breakdown"}
                </p>
              </div>
            )}

            {priceData && !isLoading && (
              <>
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        {language === "fr" ? "Investissement estimé" : "Estimated Investment"}
                      </p>
                      <p className="text-3xl font-bold font-mono text-primary" data-testid="text-total-cost">
                        {language === "fr"
                          ? `${priceData.totalCost.toLocaleString('fr-CA')} $`
                          : `$${priceData.totalCost.toLocaleString('en-CA')}`}
                      </p>
                    </div>
                    <div className="flex gap-4">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">{language === "fr" ? "Par Watt" : "Per Watt"}</p>
                        <p className="text-2xl font-bold font-mono text-primary" data-testid="text-per-watt">
                          ${priceData.totalPerW.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">{language === "fr" ? "Capacité" : "Capacity"}</p>
                        <p className="text-lg font-bold font-mono">
                          {priceData.capacityKW.toFixed(0)} kW
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">{language === "fr" ? "Panneaux" : "Panels"}</p>
                        <p className="text-lg font-bold font-mono">
                          {priceData.panelCount}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">
                    {language === "fr" ? "Répartition par catégorie" : "Breakdown by Category"}
                  </p>

                  {sortedCategories.map(([category, data]) => {
                    const percentage = getPercentage(data.cost, priceData.totalCost);
                    return (
                      <div key={category} className="space-y-1" data-testid={`category-${category.toLowerCase().replace(/\s+/g, '-')}`}>
                        <div className="flex items-center justify-between gap-1 text-sm flex-wrap">
                          <span className="font-medium">{getCategoryLabel(category)}</span>
                          <div className="flex items-center gap-3 font-mono text-muted-foreground">
                            <span className="text-xs">${data.perW.toFixed(2)}/W</span>
                            <span className="font-semibold text-foreground">
                              {language === "fr"
                                ? `${data.cost.toLocaleString('fr-CA')} $`
                                : `$${data.cost.toLocaleString('en-CA')}`}
                            </span>
                          </div>
                        </div>
                        <div className="relative h-4 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full ${getCategoryColor(category)} transition-all duration-300`}
                            style={{ width: `${percentage}%` }}
                          />
                          <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                            {percentage}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  {language === "fr"
                    ? `Prix basé sur le barème ${priceData.tierLabel} — ${priceData.totalPerW.toFixed(2)} $/W installé`
                    : `Price based on ${priceData.tierLabel} schedule — $${priceData.totalPerW.toFixed(2)}/W installed`}
                </p>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
