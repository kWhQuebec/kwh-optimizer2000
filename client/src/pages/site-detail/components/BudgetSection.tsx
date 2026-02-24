import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Plus, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Budget category labels
const BUDGET_CATEGORIES = [
  { key: "racking", labelFr: "Structure", labelEn: "Racking" },
  { key: "panels", labelFr: "Panneaux", labelEn: "Panels" },
  { key: "inverters", labelFr: "Onduleurs", labelEn: "Inverters" },
  { key: "bos_electrical", labelFr: "BOS Électrique", labelEn: "BOS Electrical" },
  { key: "labor", labelFr: "Main-d'œuvre", labelEn: "Labor" },
  { key: "soft_costs", labelFr: "Coûts indirects", labelEn: "Soft Costs" },
  { key: "permits", labelFr: "Permis & Ingénierie", labelEn: "Permits & Engineering" },
  { key: "other", labelFr: "Autres", labelEn: "Other" },
];

interface ProjectBudget {
  id: string;
  siteId: string;
  category: string;
  original: number;
  revised: number;
  committed: number;
  actual: number;
  createdAt: string;
  updatedAt: string;
}

interface BudgetResponse {
  siteId: string;
  budgets: ProjectBudget[];
  summary: {
    totalOriginal: number;
    totalRevised: number;
    totalCommitted: number;
    totalActual: number;
    variance: number;
    percentOfRevised: number;
  };
}

interface BudgetSectionProps {
  siteId: string;
  language: "fr" | "en";
}

export function BudgetSection({ siteId, language }: BudgetSectionProps) {
  const queryClient = useQueryClient();
  const [editingCell, setEditingCell] = useState<{ budgetId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  // Fetch budgets
  const { data, isLoading, error } = useQuery<BudgetResponse>({
    queryKey: ["/api/sites", siteId, "budgets"],
    queryFn: async () => {
      const res = await fetch(`/api/sites/${siteId}/budgets`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch budgets");
      return res.json();
    },
  });

  // Initialize budgets mutation
  const initMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/sites/${siteId}/budgets/initialize`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to initialize budgets");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/sites", siteId, "budgets"],
      });
    },
  });

  // Update budget mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      budgetId,
      field,
      value,
    }: {
      budgetId: string;
      field: string;
      value: number;
    }) => {
      const res = await fetch(`/api/sites/${siteId}/budgets/${budgetId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error("Failed to update budget");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/sites", siteId, "budgets"],
      });
      setEditingCell(null);
    },
  });

  // Delete budget mutation
  const deleteMutation = useMutation({
    mutationFn: async (budgetId: string) => {
      const res = await fetch(`/api/sites/${siteId}/budgets/${budgetId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete budget");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/sites", siteId, "budgets"],
      });
    },
  });

  const getCategoryLabel = (categoryKey: string): string => {
    const category = BUDGET_CATEGORIES.find((c) => c.key === categoryKey);
    if (!category) return categoryKey;
    return language === "fr" ? category.labelFr : category.labelEn;
  };

  const formatCurrency = (value: number): string => {
    if (language === "fr") {
      return `${value.toLocaleString("fr-CA")} $`;
    }
    return `$${value.toLocaleString("en-CA")}`;
  };

  const getVarianceColor = (variance: number): string => {
    if (variance < 0) return "text-green-600 dark:text-green-400";
    if (variance > 0) return "text-red-600 dark:text-red-400";
    return "text-muted-foreground";
  };

  const getPercentBadge = (percentage: number): React.ReactNode => {
    let variant: "default" | "secondary" | "outline" | "destructive" = "default";
    if (percentage < 80) {
      variant = "default";
    } else if (percentage <= 100) {
      variant = "secondary";
    } else {
      variant = "destructive";
    }
    return (
      <Badge variant={variant}>
        {percentage.toFixed(0)}%
      </Badge>
    );
  };

  const handleEditStart = (budgetId: string, field: string, value: number) => {
    setEditingCell({ budgetId, field });
    setEditValue(value.toString());
  };

  const handleEditSave = (budgetId: string, field: string) => {
    const value = parseFloat(editValue);
    if (!isNaN(value) && value >= 0) {
      updateMutation.mutate({ budgetId, field, value });
    }
    setEditingCell(null);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{language === "fr" ? "Budget du projet" : "Project Budget"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            {language === "fr" ? "Chargement..." : "Loading..."}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{language === "fr" ? "Budget du projet" : "Project Budget"}</CardTitle>
        </CardHeader>
        <CardContent className="text-center text-destructive">
          <AlertCircle className="w-6 h-6 mx-auto mb-2" />
          <p>
            {language === "fr"
              ? "Impossible de charger le budget"
              : "Unable to load budget"}
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasBudgets = data && data.budgets && data.budgets.length > 0;

  if (!hasBudgets) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{language === "fr" ? "Budget du projet" : "Project Budget"}</CardTitle>
          <CardDescription>
            {language === "fr"
              ? "Aucun budget défini. Initialisez le budget à partir de la ventilation des coûts."
              : "No budget defined. Initialize budget from the price breakdown."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center pt-6">
          <Button
            onClick={() => initMutation.mutate()}
            disabled={initMutation.isPending}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            {language === "fr" ? "Initialiser le budget" : "Initialize Budget"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{language === "fr" ? "Budget du projet" : "Project Budget"}</CardTitle>
        <CardDescription>
          {language === "fr"
            ? `Budget original: ${formatCurrency(data.summary.totalOriginal)}`
            : `Original budget: ${formatCurrency(data.summary.totalOriginal)}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === "fr" ? "Catégorie" : "Category"}</TableHead>
                <TableHead className="text-right">{language === "fr" ? "Original" : "Original"}</TableHead>
                <TableHead className="text-right">{language === "fr" ? "Révisé" : "Revised"}</TableHead>
                <TableHead className="text-right">{language === "fr" ? "Engagé" : "Committed"}</TableHead>
                <TableHead className="text-right">{language === "fr" ? "Réel" : "Actual"}</TableHead>
                <TableHead className="text-right">{language === "fr" ? "Variance" : "Variance"}</TableHead>
                <TableHead className="text-center">%</TableHead>
                <TableHead className="text-center">{language === "fr" ? "Actions" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.budgets.map((budget) => {
                const variance = budget.actual - budget.revised;
                const percentage = budget.revised > 0
                  ? (budget.actual / budget.revised) * 100
                  : 0;
                const isEditingRevised = editingCell?.budgetId === budget.id && editingCell?.field === "revised";
                const isEditingActual = editingCell?.budgetId === budget.id && editingCell?.field === "actual";

                return (
                  <TableRow key={budget.id}>
                    <TableCell className="font-medium">
                      {getCategoryLabel(budget.category)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(budget.original)}
                    </TableCell>
                    <TableCell className="text-right">
                      {isEditingRevised ? (
                        <input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleEditSave(budget.id, "revised")}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleEditSave(budget.id, "revised");
                            if (e.key === "Escape") setEditingCell(null);
                          }}
                          autoFocus
                          className="w-24 px-2 py-1 border rounded text-right font-mono text-sm"
                        />
                      ) : (
                        <span
                          onClick={() => handleEditStart(budget.id, "revised", budget.revised)}
                          className="cursor-pointer font-mono hover:bg-muted px-2 py-1 rounded transition-colors"
                        >
                          {formatCurrency(budget.revised)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(budget.committed)}
                    </TableCell>
                    <TableCell className="text-right">
                      {isEditingActual ? (
                        <input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleEditSave(budget.id, "actual")}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleEditSave(budget.id, "actual");
                            if (e.key === "Escape") setEditingCell(null);
                          }}
                          autoFocus
                          className="w-24 px-2 py-1 border rounded text-right font-mono text-sm"
                        />
                      ) : (
                        <span
                          onClick={() => handleEditStart(budget.id, "actual", budget.actual)}
                          className="cursor-pointer font-mono hover:bg-muted px-2 py-1 rounded transition-colors"
                        >
                          {formatCurrency(budget.actual)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className={`text-right font-mono ${getVarianceColor(variance)}`}>
                      {variance >= 0 ? "+" : ""}{formatCurrency(variance)}
                    </TableCell>
                    <TableCell className="text-center">
                      {getPercentBadge(percentage)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate(budget.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {/* Summary Row */}
              <TableRow className="bg-muted/50 font-semibold border-t-2">
                <TableCell>{language === "fr" ? "Total" : "Total"}</TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(data.summary.totalOriginal)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(data.summary.totalRevised)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(data.summary.totalCommitted)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(data.summary.totalActual)}
                </TableCell>
                <TableCell className={`text-right font-mono ${getVarianceColor(data.summary.variance)}`}>
                  {data.summary.variance >= 0 ? "+" : ""}{formatCurrency(data.summary.variance)}
                </TableCell>
                <TableCell className="text-center">
                  {getPercentBadge(data.summary.percentOfRevised)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Progress Indicator */}
        <div className="mt-6 p-4 bg-secondary/30 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              {language === "fr" ? "Dépenses réelles" : "Actual Spending"}
            </span>
            <span className="text-sm font-mono">
              {data.summary.percentOfRevised.toFixed(1)}%
            </span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                data.summary.percentOfRevised < 80
                  ? "bg-green-500"
                  : data.summary.percentOfRevised <= 100
                  ? "bg-yellow-500"
                  : "bg-red-500"
              }`}
              style={{ width: `${Math.min(data.summary.percentOfRevised, 100)}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
