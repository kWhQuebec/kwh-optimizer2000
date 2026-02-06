import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { DollarSign, ChevronUp, ChevronDown, AlertCircle, Settings, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useI18n } from "@/lib/i18n";
import type { PriceBreakdownResponse } from "../types";

export function PriceBreakdownSection({ siteId, isAdmin }: { siteId: string; isAdmin?: boolean }) {
  const { language } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  // Category labels in both languages
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

  // Category colors for visualization
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

  // Fetch price breakdown data
  const { data: priceData, isLoading, error } = useQuery<PriceBreakdownResponse>({
    queryKey: ['/api/sites', siteId, 'price-breakdown'],
    enabled: isOpen,
  });

  // Get label for a category
  const getCategoryLabel = (category: string) => {
    const key = category.toLowerCase().replace(/\s+/g, '_');
    const label = categoryLabels[key];
    if (label) {
      return language === "fr" ? label.fr : label.en;
    }
    return category;
  };

  // Get color for a category
  const getCategoryColor = (category: string) => {
    const key = category.toLowerCase().replace(/\s+/g, '_');
    return categoryColors[key] || "bg-gray-400";
  };

  // Calculate percentage for progress bar
  const getPercentage = (cost: number, total: number) => {
    if (!total || total === 0) return 0;
    return Math.round((cost / total) * 100);
  };

  // Sort categories by cost (descending)
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
                  ? `Coût total estimé: ${priceData.totalCost.toLocaleString('fr-CA')} $ CAD`
                  : `Estimated total cost: $${priceData.totalCost.toLocaleString('en-CA')} CAD`}
              </CardDescription>
            )}
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* Loading state */}
            {isLoading && (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            )}

            {/* Error state */}
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

            {/* Data display */}
            {priceData && !isLoading && (
              <>
                {/* Total Cost Summary - Prominent */}
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        {language === "fr" ? "Coût total estimé" : "Estimated Total Cost"}
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

                {/* Category Breakdown with Progress Bars */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">
                    {language === "fr" ? "Répartition par catégorie" : "Breakdown by Category"}
                  </p>

                  {sortedCategories.length === 0 && (
                    <div className="p-4 bg-muted/50 rounded-lg text-center">
                      <p className="text-sm text-muted-foreground">
                        {language === "fr"
                          ? "Aucune composante de prix configurée"
                          : "No pricing components configured"}
                      </p>
                      {isAdmin && (
                        <Link href="/admin/pricing">
                          <Button variant="ghost" size="sm" className="mt-2 text-primary" data-testid="link-add-pricing">
                            <Plus className="w-3 h-3 mr-1" />
                            {language === "fr" ? "Configurer les prix" : "Configure pricing"}
                          </Button>
                        </Link>
                      )}
                    </div>
                  )}

                  {sortedCategories.map(([category, data]) => {
                    const percentage = getPercentage(data.cost, priceData.totalCost);
                    return (
                      <div key={category} className="space-y-1" data-testid={`category-${category.toLowerCase().replace(/\s+/g, '-')}`}>
                        <div className="flex items-center justify-between text-sm">
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

                {/* Admin Link */}
                {isAdmin && (
                  <div className="pt-2 border-t">
                    <Link href="/admin/pricing">
                      <Button variant="outline" size="sm" className="w-full" data-testid="link-admin-pricing">
                        <Settings className="w-4 h-4 mr-2" />
                        {language === "fr" ? "Gérer les composantes de prix" : "Manage Pricing Components"}
                      </Button>
                    </Link>
                  </div>
                )}

                {/* Component Count Info */}
                <p className="text-xs text-muted-foreground text-center">
                  {language === "fr"
                    ? `Basé sur ${priceData.componentCount} composantes de prix`
                    : `Based on ${priceData.componentCount} pricing components`}
                </p>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
