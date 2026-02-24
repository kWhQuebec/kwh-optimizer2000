/**
 * ClientWizard — Guided sequential experience for client portal users.
 *
 * Instead of scattered tabs, the client sees ONE screen at a time:
 * the next action that requires their attention, contextualized to their project state.
 *
 * Steps auto-detect from project data. Completed steps are visible in a timeline
 * but the primary focus is always "what's next."
 */

import React, { useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Clock,
  ChevronRight,
  ChevronDown,
  Upload,
  FileText,
  Zap,
  Building2,
  Shield,
  Wrench,
  BarChart3,
  Eye,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/lib/i18n";
import type { SimulationRun } from "@shared/schema";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type WizardStepStatus = "completed" | "active" | "locked";

export interface WizardStepDef {
  id: string;
  titleFr: string;
  titleEn: string;
  descriptionFr: string;
  descriptionEn: string;
  icon: React.ElementType;
  statusColor: string;
}

export interface ClientWizardProps {
  site: any; // SiteWithDetails
  quickPotential: any | null;
  latestSimulation: SimulationRun | null;
  designAgreement: any | null;
  opportunityStage: string;
  onNavigateToTab: (tab: string) => void;
  language: "fr" | "en";
  // Child renderers — each step can render its own content
  renderQuickAnalysis?: () => React.ReactNode;
  renderConsumption?: () => React.ReactNode;
  renderAnalysis?: () => React.ReactNode;
  renderProjectStatus?: () => React.ReactNode;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

const WIZARD_STEPS: WizardStepDef[] = [
  {
    id: "building-info",
    titleFr: "Mon bâtiment",
    titleEn: "My Building",
    descriptionFr: "Décrivez votre bâtiment pour que nous puissions estimer le potentiel solaire.",
    descriptionEn: "Describe your building so we can estimate the solar potential.",
    icon: Building2,
    statusColor: "#6B7280",
  },
  {
    id: "consumption",
    titleFr: "Ma consommation",
    titleEn: "My Consumption",
    descriptionFr: "Partagez vos données de consommation pour une analyse personnalisée.",
    descriptionEn: "Share your consumption data for a personalized analysis.",
    icon: Zap,
    statusColor: "#3B82F6",
  },
  {
    id: "results",
    titleFr: "Mes résultats",
    titleEn: "My Results",
    descriptionFr: "Consultez l'analyse économique de votre projet solaire.",
    descriptionEn: "Review the economic analysis of your solar project.",
    icon: BarChart3,
    statusColor: "#10B981",
  },
  {
    id: "mandate",
    titleFr: "Mon mandat",
    titleEn: "My Mandate",
    descriptionFr: "Signez le mandat de conception pour lancer la prochaine étape.",
    descriptionEn: "Sign the design mandate to start the next phase.",
    icon: FileText,
    statusColor: "#003DA6",
  },
  {
    id: "technical",
    titleFr: "Validation technique",
    titleEn: "Technical Validation",
    descriptionFr: "Notre équipe valide les aspects techniques de votre toiture.",
    descriptionEn: "Our team validates the technical aspects of your roof.",
    icon: Shield,
    statusColor: "#F59E0B",
  },
  {
    id: "project",
    titleFr: "Mon projet",
    titleEn: "My Project",
    descriptionFr: "Suivez l'avancement de votre installation solaire.",
    descriptionEn: "Track the progress of your solar installation.",
    icon: Wrench,
    statusColor: "#16A34A",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

function detectStepStatuses(
  site: any,
  quickPotential: any | null,
  latestSimulation: SimulationRun | null,
  designAgreement: any | null,
  opportunityStage: string
): Map<string, WizardStepStatus> {
  const statuses = new Map<string, WizardStepStatus>();

  // Step 1: Building info — completed if basic fields filled
  const hasBuildingInfo = !!(
    site?.buildingType &&
    site?.roofType &&
    (site?.roofAreaSqM || site?.roofAreaAutoSqM || site?.roofAreaValidated)
  );
  statuses.set("building-info", hasBuildingInfo ? "completed" : "active");

  // Step 2: Consumption — completed if meter files uploaded or consumption estimate exists
  const hasConsumption = (site?.meterFiles?.length > 0) || site?.annualConsumptionKwh;
  statuses.set("consumption", hasBuildingInfo ? (hasConsumption ? "completed" : "active") : "locked");

  // Step 3: Results — completed if simulation exists AND user has seen it
  const hasResults = !!latestSimulation;
  statuses.set("results", hasConsumption ? (hasResults ? "completed" : "active") : "locked");

  // Step 4: Mandate — completed if design agreement signed
  const hasMandateSigned = designAgreement?.status === "accepted";
  const mandateStages = ["design_mandate_signed", "epc_proposal_sent", "negotiation", "won_to_be_delivered", "won_in_construction", "won_delivered"];
  const mandateDone = hasMandateSigned || mandateStages.includes(opportunityStage);
  statuses.set("mandate", hasResults ? (mandateDone ? "completed" : "active") : "locked");

  // Step 5: Technical — completed when site visit done + EPC stages
  const technicalStages = ["epc_proposal_sent", "negotiation", "won_to_be_delivered", "won_in_construction", "won_delivered"];
  const technicalDone = technicalStages.includes(opportunityStage);
  statuses.set("technical", mandateDone ? (technicalDone ? "completed" : "active") : "locked");

  // Step 6: Project — active when past technical, completed when delivered
  const projectStages = ["won_to_be_delivered", "won_in_construction", "won_delivered"];
  const projectDone = opportunityStage === "won_delivered";
  statuses.set("project", technicalDone ? (projectDone ? "completed" : "active") : "locked");

  return statuses;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP TIMELINE ITEM
// ═══════════════════════════════════════════════════════════════════════════════

function WizardTimelineItem({
  step,
  status,
  isLast,
  isExpanded,
  onToggle,
  language,
  children,
}: {
  step: WizardStepDef;
  status: WizardStepStatus;
  isLast: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  language: "fr" | "en";
  children?: React.ReactNode;
}) {
  const fr = language === "fr";
  const Icon = step.icon;

  const statusIcon = status === "completed" ? (
    <CheckCircle2 className="w-6 h-6 text-green-500" />
  ) : status === "active" ? (
    <div className="w-6 h-6 rounded-full border-2 border-primary bg-primary/10 flex items-center justify-center">
      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
    </div>
  ) : (
    <Circle className="w-6 h-6 text-muted-foreground/30" />
  );

  const isClickable = status !== "locked";

  return (
    <div className="relative">
      {/* Vertical connector line */}
      {!isLast && (
        <div
          className={`absolute left-3 top-8 w-0.5 ${
            status === "completed" ? "bg-green-300" : "bg-border"
          }`}
          style={{ height: isExpanded ? "calc(100% - 16px)" : "calc(100% - 8px)" }}
        />
      )}

      {/* Step header */}
      <button
        onClick={isClickable ? onToggle : undefined}
        disabled={!isClickable}
        className={`flex items-start gap-3 w-full text-left p-2 rounded-lg transition-colors ${
          isClickable ? "hover:bg-accent/50 cursor-pointer" : "opacity-40 cursor-not-allowed"
        } ${isExpanded && status === "active" ? "bg-accent/30" : ""}`}
      >
        <div className="flex-shrink-0 mt-0.5">{statusIcon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 flex-shrink-0" style={{ color: status !== "locked" ? step.statusColor : undefined }} />
            <span className={`font-medium text-sm ${status === "locked" ? "text-muted-foreground" : ""}`}>
              {fr ? step.titleFr : step.titleEn}
            </span>
            {status === "active" && (
              <Badge variant="default" className="text-[10px] px-1.5 py-0">
                {fr ? "En cours" : "In progress"}
              </Badge>
            )}
            {status === "completed" && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 text-green-700 bg-green-50">
                {fr ? "Complété" : "Completed"}
              </Badge>
            )}
          </div>
          {(status === "active" || isExpanded) && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {fr ? step.descriptionFr : step.descriptionEn}
            </p>
          )}
        </div>
        {isClickable && (
          <div className="flex-shrink-0 mt-1">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && children && (
        <div className="ml-9 mt-2 mb-4">
          {children}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WAITING STATUS CARD
// ═══════════════════════════════════════════════════════════════════════════════

function WaitingCard({ titleFr, titleEn, descFr, descEn, language }: {
  titleFr: string; titleEn: string; descFr: string; descEn: string; language: "fr" | "en";
}) {
  const fr = language === "fr";
  return (
    <Card className="border-dashed">
      <CardContent className="py-6 text-center">
        <Clock className="w-8 h-8 text-amber-500/60 mx-auto mb-3" />
        <h4 className="font-medium text-sm mb-1">{fr ? titleFr : titleEn}</h4>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">{fr ? descFr : descEn}</p>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function ClientWizard({
  site,
  quickPotential,
  latestSimulation,
  designAgreement,
  opportunityStage,
  onNavigateToTab,
  language,
  renderQuickAnalysis,
  renderConsumption,
  renderAnalysis,
  renderProjectStatus,
}: ClientWizardProps) {
  const fr = language === "fr";

  // Detect step statuses
  const stepStatuses = useMemo(
    () => detectStepStatuses(site, quickPotential, latestSimulation, designAgreement, opportunityStage),
    [site, quickPotential, latestSimulation, designAgreement, opportunityStage]
  );

  // Auto-expand the first active step
  const firstActiveStep = useMemo(() => {
    for (const step of WIZARD_STEPS) {
      if (stepStatuses.get(step.id) === "active") return step.id;
    }
    return WIZARD_STEPS[0].id;
  }, [stepStatuses]);

  const [expandedStep, setExpandedStep] = useState<string>(firstActiveStep);

  // Progress calculation
  const completedCount = WIZARD_STEPS.filter(s => stepStatuses.get(s.id) === "completed").length;
  const progressPercent = Math.round((completedCount / WIZARD_STEPS.length) * 100);

  // Render step content based on step ID and status
  const renderStepContent = (stepId: string, status: WizardStepStatus) => {
    if (status === "locked") return null;

    switch (stepId) {
      case "building-info":
        if (status === "completed") {
          return (
            <Card className="bg-green-50/50 border-green-200/50">
              <CardContent className="py-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {site?.buildingType && (
                    <div>
                      <span className="text-muted-foreground">{fr ? "Type" : "Type"}:</span>{" "}
                      <span className="font-medium">{site.buildingType}</span>
                    </div>
                  )}
                  {site?.roofType && (
                    <div>
                      <span className="text-muted-foreground">{fr ? "Toiture" : "Roof"}:</span>{" "}
                      <span className="font-medium">{site.roofType}</span>
                    </div>
                  )}
                  {(site?.roofAreaSqM || site?.roofAreaAutoSqM) && (
                    <div>
                      <span className="text-muted-foreground">{fr ? "Surface" : "Area"}:</span>{" "}
                      <span className="font-medium">
                        {Math.round(site.roofAreaSqM || site.roofAreaAutoSqM)} m²
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        }
        // Active: show the quick analysis form
        return renderQuickAnalysis?.() || (
          <Card>
            <CardContent className="py-6">
              <p className="text-sm text-muted-foreground mb-3">
                {fr
                  ? "Complétez les informations de base sur votre bâtiment pour démarrer l'analyse."
                  : "Complete the basic information about your building to start the analysis."}
              </p>
              <Button onClick={() => onNavigateToTab("quick-analysis")} className="gap-2">
                <ArrowRight className="w-4 h-4" />
                {fr ? "Compléter les informations" : "Complete information"}
              </Button>
            </CardContent>
          </Card>
        );

      case "consumption":
        if (status === "completed") {
          const fileCount = site?.meterFiles?.length || 0;
          return (
            <Card className="bg-green-50/50 border-green-200/50">
              <CardContent className="py-4">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span>
                    {fr
                      ? `${fileCount} fichier(s) de consommation importé(s)`
                      : `${fileCount} consumption file(s) imported`}
                  </span>
                  {site?.annualConsumptionKwh && (
                    <Badge variant="secondary" className="ml-auto">
                      ~{Math.round(site.annualConsumptionKwh).toLocaleString()} kWh/an
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        }
        return renderConsumption?.() || (
          <Card>
            <CardContent className="py-6">
              <p className="text-sm text-muted-foreground mb-3">
                {fr
                  ? "Importez votre facture Hydro-Québec ou vos données de consommation pour une analyse précise."
                  : "Upload your Hydro-Québec bill or consumption data for an accurate analysis."}
              </p>
              <Button onClick={() => onNavigateToTab("consumption")} className="gap-2">
                <Upload className="w-4 h-4" />
                {fr ? "Importer mes données" : "Import my data"}
              </Button>
            </CardContent>
          </Card>
        );

      case "results":
        if (status === "completed" && latestSimulation) {
          const sim = latestSimulation as any;
          return (
            <Card className="bg-green-50/50 border-green-200/50">
              <CardContent className="py-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {sim.pvSizeKW && (
                    <div>
                      <span className="text-muted-foreground">{fr ? "Système" : "System"}:</span>{" "}
                      <span className="font-medium">{Math.round(sim.pvSizeKW)} kWc</span>
                    </div>
                  )}
                  {sim.npv25 && (
                    <div>
                      <span className="text-muted-foreground">VAN 25 ans:</span>{" "}
                      <span className="font-medium text-green-700">
                        {Math.round(sim.npv25).toLocaleString()} $
                      </span>
                    </div>
                  )}
                  {sim.irr && (
                    <div>
                      <span className="text-muted-foreground">TRI:</span>{" "}
                      <span className="font-medium">{(sim.irr * 100).toFixed(1)}%</span>
                    </div>
                  )}
                  {sim.simplePaybackYears && (
                    <div>
                      <span className="text-muted-foreground">{fr ? "Retour" : "Payback"}:</span>{" "}
                      <span className="font-medium">{sim.simplePaybackYears.toFixed(1)} {fr ? "ans" : "yrs"}</span>
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-2"
                  onClick={() => onNavigateToTab("analysis")}
                >
                  <Eye className="w-3.5 h-3.5" />
                  {fr ? "Voir l'analyse complète" : "View full analysis"}
                </Button>
              </CardContent>
            </Card>
          );
        }
        if (status === "active" && !latestSimulation) {
          return (
            <WaitingCard
              titleFr="Analyse en préparation"
              titleEn="Analysis being prepared"
              descFr="Notre équipe prépare votre analyse économique personnalisée. Vous serez notifié dès qu'elle sera prête."
              descEn="Our team is preparing your personalized economic analysis. You'll be notified when it's ready."
              language={language}
            />
          );
        }
        return renderAnalysis?.();

      case "mandate":
        if (status === "completed") {
          return (
            <Card className="bg-green-50/50 border-green-200/50">
              <CardContent className="py-4">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span>{fr ? "Mandat de conception signé" : "Design mandate signed"}</span>
                  {designAgreement?.signedAt && (
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {new Date(designAgreement.signedAt).toLocaleDateString(fr ? "fr-CA" : "en-CA")}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        }
        return (
          <Card>
            <CardContent className="py-6">
              <p className="text-sm text-muted-foreground mb-3">
                {fr
                  ? "Notre équipe vous contactera pour présenter l'analyse et discuter des prochaines étapes. Le mandat de conception formalise notre engagement mutuel."
                  : "Our team will contact you to present the analysis and discuss next steps. The design mandate formalizes our mutual commitment."}
              </p>
              {designAgreement?.status === "sent" ? (
                <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                  {fr ? "Mandat envoyé — en attente de signature" : "Mandate sent — awaiting signature"}
                </Badge>
              ) : (
                <Badge variant="outline">
                  {fr ? "En attente de présentation" : "Awaiting presentation"}
                </Badge>
              )}
            </CardContent>
          </Card>
        );

      case "technical":
        if (status === "completed") {
          return (
            <Card className="bg-green-50/50 border-green-200/50">
              <CardContent className="py-4">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span>{fr ? "Validation technique complétée" : "Technical validation completed"}</span>
                </div>
              </CardContent>
            </Card>
          );
        }
        return (
          <WaitingCard
            titleFr="Visite technique en cours"
            titleEn="Technical visit in progress"
            descFr="Notre partenaire effectue la validation structurelle de votre toiture. Nous vous tiendrons informé de l'avancement."
            descEn="Our partner is performing the structural validation of your roof. We'll keep you updated on progress."
            language={language}
          />
        );

      case "project":
        if (status === "completed") {
          return (
            <Card className="bg-green-50/50 border-green-200/50">
              <CardContent className="py-4">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span>{fr ? "Installation complétée — système en production!" : "Installation completed — system in production!"}</span>
                </div>
              </CardContent>
            </Card>
          );
        }
        return renderProjectStatus?.() || (
          <WaitingCard
            titleFr="Projet en cours"
            titleEn="Project in progress"
            descFr="Votre installation solaire est en cours de réalisation. Restez connecté pour suivre l'avancement."
            descEn="Your solar installation is underway. Stay connected to track progress."
            language={language}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero section */}
      <Card>
        <CardContent className="pt-6 pb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold">
                {fr ? "Mon projet solaire" : "My Solar Project"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {site?.address || site?.name}
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold">{progressPercent}%</span>
              <p className="text-xs text-muted-foreground">{fr ? "complété" : "completed"}</p>
            </div>
          </div>
          <Progress value={progressPercent} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2">
            {fr
              ? `${completedCount} de ${WIZARD_STEPS.length} étapes complétées`
              : `${completedCount} of ${WIZARD_STEPS.length} steps completed`}
          </p>
        </CardContent>
      </Card>

      {/* Timeline */}
      <div className="space-y-1">
        {WIZARD_STEPS.map((step, idx) => {
          const status = stepStatuses.get(step.id) || "locked";
          const isExpanded = expandedStep === step.id;
          const isLast = idx === WIZARD_STEPS.length - 1;

          return (
            <WizardTimelineItem
              key={step.id}
              step={step}
              status={status}
              isLast={isLast}
              isExpanded={isExpanded}
              onToggle={() => setExpandedStep(isExpanded ? "" : step.id)}
              language={language}
            >
              {renderStepContent(step.id, status)}
            </WizardTimelineItem>
          );
        })}
      </div>

      {/* Help/Contact CTA */}
      <Card className="border-dashed">
        <CardContent className="py-4 text-center">
          <p className="text-sm text-muted-foreground">
            {fr
              ? "Des questions? Votre chargé de projet est là pour vous aider."
              : "Questions? Your project manager is here to help."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
