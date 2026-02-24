import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sun,
  Calendar,
  Clock,
  DollarSign,
  BarChart3,
  TrendingUp,
} from "lucide-react";
import { BudgetSection } from "./BudgetSection";
import { ReconciliationSection } from "./ReconciliationSection";
import { BaselineView } from "./BaselineView";

export interface OperationsTabProps {
  siteId: string;
  site: any; // SiteWithDetails
  latestSimulation: any | null;
  language: "fr" | "en";
}

export function OperationsTab({
  siteId,
  site,
  latestSimulation,
  language,
}: OperationsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<
    "budget" | "reconciliation" | "performance"
  >("budget");

  // Check if site is in won_delivered stage
  const isWonDelivered =
    site?.opportunityStage === "won_delivered" ||
    (site?.operationsStartDate && new Date(site.operationsStartDate) <= new Date());

  // Calculate system capacity
  const systemCapacity =
    latestSimulation?.pvSizeKW || site?.kbKwDc || "N/A";

  // Format operations start date
  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(language === "fr" ? "fr-FR" : "en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return "N/A";
    }
  };

  // Calculate months in operation
  const calculateMonthsInOperation = (startDate: string | null | undefined): number => {
    if (!startDate) return 0;
    try {
      const start = new Date(startDate);
      const now = new Date();
      let months =
        (now.getFullYear() - start.getFullYear()) * 12 +
        (now.getMonth() - start.getMonth());
      return Math.max(0, months);
    } catch {
      return 0;
    }
  };

  const operationsStartDate = site?.operationsStartDate;
  const formattedDate = formatDate(operationsStartDate);
  const monthsInOperation = calculateMonthsInOperation(operationsStartDate);

  // Placeholder content for non-won_delivered sites
  if (!isWonDelivered) {
    return (
      <Card className="p-8">
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <Sun className="h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">
            {language === "fr"
              ? "Opérations & Maintenance"
              : "Operations & Maintenance"}
          </h3>
          <p className="max-w-sm text-center text-sm text-muted-foreground">
            {language === "fr"
              ? "Le suivi des opérations sera disponible une fois l'installation livrée."
              : "Operations tracking will be available once installation is completed."}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Bar */}
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* System Capacity */}
          <div className="flex items-center gap-3">
            <Sun className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {language === "fr" ? "Capacité système" : "System capacity"}
              </p>
              <p className="text-sm font-semibold text-foreground">
                {typeof systemCapacity === "number"
                  ? systemCapacity.toFixed(2)
                  : systemCapacity}{" "}
                kW DC
              </p>
            </div>
          </div>

          {/* Operations Since */}
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {language === "fr"
                  ? "En opération depuis"
                  : "Operations since"}
              </p>
              <p className="text-sm font-semibold text-foreground">
                {formattedDate}
              </p>
            </div>
          </div>

          {/* Months in Operation */}
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {language === "fr" ? "Mois en opération" : "Months in operation"}
              </p>
              <p className="text-sm font-semibold text-foreground">
                {monthsInOperation} {language === "fr" ? "mois" : "months"}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Pill Navigation */}
      <div className="flex gap-2 overflow-x-auto">
        <Button
          variant={activeSubTab === "budget" ? "default" : "secondary"}
          size="sm"
          onClick={() => setActiveSubTab("budget")}
          className="flex items-center gap-2 whitespace-nowrap"
        >
          <DollarSign className="h-4 w-4" />
          {language === "fr" ? "Budget" : "Budget"}
        </Button>

        <Button
          variant={activeSubTab === "reconciliation" ? "default" : "secondary"}
          size="sm"
          onClick={() => setActiveSubTab("reconciliation")}
          className="flex items-center gap-2 whitespace-nowrap"
        >
          <BarChart3 className="h-4 w-4" />
          {language === "fr" ? "Réconciliation" : "Reconciliation"}
        </Button>

        <Button
          variant={activeSubTab === "performance" ? "default" : "secondary"}
          size="sm"
          onClick={() => setActiveSubTab("performance")}
          className="flex items-center gap-2 whitespace-nowrap"
        >
          <TrendingUp className="h-4 w-4" />
          {language === "fr" ? "Performance" : "Performance"}
        </Button>
      </div>

      {/* Content Area */}
      <div>
        {activeSubTab === "budget" && (
          <BudgetSection siteId={siteId} language={language} />
        )}

        {activeSubTab === "reconciliation" && (
          <ReconciliationSection siteId={siteId} language={language} />
        )}

        {activeSubTab === "performance" && (
          <BaselineView siteId={siteId} language={language} />
        )}
      </div>
    </div>
  );
}
