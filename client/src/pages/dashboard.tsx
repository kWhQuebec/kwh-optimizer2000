import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  Building2,
  BarChart3,
  DollarSign,
  TrendingUp,
  Clock,
  ChevronRight,
  Trophy,
  AlertTriangle,
  Target,
  ArrowRight,
  ArrowDown,
  Play,
  Package,
  CheckCircle2,
  Grid3X3,
  UserPlus,
  Zap,
  ArrowUpRight,
  Sun,
  Leaf,
  Home,
  Car,
  Hammer,
  Activity,
  FileSignature,
  Phone,
  Search,
  Send,
  Handshake,
  ChevronDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import {
  STAGE_LABELS,
  STAGE_SHORT_LABELS,
  STAGE_CHART_COLORS,
  STAGE_TAILWIND,
  STAGE_PROBABILITIES,
  ACTIVE_STAGES,
  getPhaseColor,
  getPhaseForStage,
} from "@shared/stageLabels";

interface PipelineStats {
  totalPipelineValue: number;
  weightedPipelineValue: number;
  wonValue: number;
  lostValue: number;
  deliveryBacklogValue: number;
  deliveryBacklogCount: number;
  deliveredValue: number;
  deliveredCount: number;
  activeOpportunityCount: number;
  stageBreakdown: Array<{
    stage: string;
    count: number;
    totalValue: number;
    weightedValue: number;
  }>;
  topOpportunities: Array<{
    id: string;
    name: string;
    clientName: string | null;
    stage: string;
    probability: number;
    estimatedValue: number | null;
    updatedAt: Date | null;
  }>;
  atRiskOpportunities: Array<{
    id: string;
    name: string;
    clientName: string | null;
    stage: string;
    estimatedValue: number | null;
    daysSinceUpdate: number;
  }>;
  recentWins: Array<{
    id: string;
    name: string;
    clientName: string | null;
    estimatedValue: number | null;
    updatedAt: Date | null;
  }>;
  pendingTasks: Array<{
    id: string;
    siteId: string;
    siteName: string;
    clientName: string | null;
    taskType: 'roof_drawing' | 'run_analysis';
    priority: 'urgent' | 'normal';
  }>;
  pendingTasksCount: {
    roofDrawing: number;
    runAnalysis: number;
    total: number;
  };
}

interface VirtualPowerPlant {
  totalInstalledMW: number;
  totalProjectsCompleted: number;
  totalProjectsInProgress: number;
  totalPanelCount: number;
  totalKWhProduced: number;
  totalCO2AvoidedTonnes?: number;
  totalSavingsDollars?: number;
  equivalentHomesP?: number;
  equivalentCarsRemoved?: number;
  lastUpdatedAt?: string;
}

const WON_STAGES = ['won_to_be_delivered', 'won_in_construction', 'won_delivered'];
const isWonStage = (stage: string) => WON_STAGES.includes(stage);

function formatCompactCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return "$0";
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
  return `$${value.toFixed(0)}`;
}

function formatEnergy(kwh: number): string {
  if (kwh >= 1000000000) return `${(kwh / 1000000000).toFixed(1)} GWh`;
  if (kwh >= 1000000) return `${(kwh / 1000000).toFixed(1)} MWh`;
  if (kwh >= 1000) return `${(kwh / 1000).toFixed(0)} kWh`;
  return `${kwh.toFixed(0)} kWh`;
}

function formatCapacity(mw: number): string {
  if (mw >= 1000) return `${(mw / 1000).toFixed(1)} GW`;
  if (mw >= 1) return `${mw.toFixed(1)} MW`;
  return `${(mw * 1000).toFixed(0)} kW`;
}

// ============================================
// INPUT KPIs — "Remplir l'entonnoir"
// Derived from stageBreakdown counts
// ============================================

function InputKPIs({ stats, language, isLoading }: { stats?: PipelineStats; language: 'fr' | 'en'; isLoading: boolean }) {
  const getStageCount = (stage: string) =>
    stats?.stageBreakdown?.find(s => s.stage === stage)?.count || 0;

  const inputs = [
    {
      label: language === 'fr' ? 'Nouveaux prospects' : 'New Prospects',
      value: getStageCount('prospect'),
      icon: UserPlus,
      color: 'text-gray-600 dark:text-gray-400',
      bgColor: 'bg-gray-100 dark:bg-gray-800',
    },
    {
      label: language === 'fr' ? 'En contact' : 'Contacted',
      value: getStageCount('contacted'),
      icon: Phone,
      color: 'text-gray-700 dark:text-gray-300',
      bgColor: 'bg-gray-100 dark:bg-gray-800',
    },
    {
      label: language === 'fr' ? 'Analyses à faire' : 'Analyses Pending',
      value: (stats?.pendingTasksCount?.runAnalysis || 0) + getStageCount('qualified'),
      icon: Search,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950',
    },
    {
      label: language === 'fr' ? 'Propositions envoyées' : 'Proposals Sent',
      value: getStageCount('epc_proposal_sent') + getStageCount('negotiation'),
      icon: Send,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-950',
    },
  ];

  return (
    <div className="relative">
      {/* Section title */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
          <ArrowDown className="w-3.5 h-3.5 text-gray-500" />
        </div>
        <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {language === 'fr' ? 'Remplir l\'entonnoir' : 'Fill the Funnel'}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {inputs.map((inp, i) => (
          <Card key={i} className="border-dashed">
            <CardContent className="p-3">
              {isLoading ? (
                <Skeleton className="h-14 w-full" />
              ) : (
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${inp.bgColor}`}>
                    <inp.icon className={`w-5 h-5 ${inp.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground truncate">{inp.label}</p>
                    <p className="text-2xl font-bold font-mono">{inp.value}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============================================
// VISUAL FUNNEL — True funnel shape with SVG
// ============================================

function VisualFunnel({ data, stats, language, isLoading }: {
  data: PipelineStats['stageBreakdown'];
  stats?: PipelineStats;
  language: 'fr' | 'en';
  isLoading: boolean;
}) {
  // Only active pipeline stages (not won/lost/disqualified)
  const activeStages = ACTIVE_STAGES.map(stageKey => {
    const found = data.find(s => s.stage === stageKey);
    return {
      stage: stageKey,
      count: found?.count || 0,
      totalValue: found?.totalValue || 0,
      weightedValue: found?.weightedValue || 0,
    };
  });

  const totalActiveCount = activeStages.reduce((sum, s) => sum + s.count, 0);
  const totalActiveValue = activeStages.reduce((sum, s) => sum + s.totalValue, 0);

  // Funnel dimensions
  const funnelWidth = 600;
  const funnelHeight = 400;
  const topWidth = funnelWidth * 0.95;  // Wide at top
  const bottomWidth = funnelWidth * 0.18; // Narrow at bottom
  const stageCount = activeStages.length;
  const stageHeight = funnelHeight / stageCount;
  const padding = 0;

  // Calculate trapezoid widths for each stage level
  const getWidthAtLevel = (level: number) => {
    const t = level / stageCount;
    return topWidth - (topWidth - bottomWidth) * t;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-[420px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
        <div>
          <CardTitle className="text-lg">
            {language === 'fr' ? 'Entonnoir de ventes' : 'Sales Funnel'}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalActiveCount} {language === 'fr' ? 'opportunités actives' : 'active opportunities'} — {formatCompactCurrency(totalActiveValue)}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-block w-2 h-2 rounded-full bg-gray-400" /> {language === 'fr' ? 'Exploration' : 'Exploration'}
          <span className="inline-block w-2 h-2 rounded-full bg-blue-500 ml-2" /> {language === 'fr' ? 'Conception' : 'Design'}
          <span className="inline-block w-2 h-2 rounded-full bg-amber-500 ml-2" /> {language === 'fr' ? 'Réalisation' : 'Delivery'}
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-4 pt-0">
        <div className="w-full overflow-hidden" style={{ maxWidth: '100%' }}>
          <svg
            viewBox={`0 0 ${funnelWidth} ${funnelHeight}`}
            className="w-full h-auto"
            preserveAspectRatio="xMidYMid meet"
            style={{ maxHeight: '420px' }}
          >
            {activeStages.map((stage, i) => {
              const y = i * stageHeight + padding;
              const topW = getWidthAtLevel(i);
              const botW = getWidthAtLevel(i + 1);
              const topX = (funnelWidth - topW) / 2;
              const botX = (funnelWidth - botW) / 2;
              const chartColor = STAGE_CHART_COLORS[stage.stage] || '#9CA3AF';
              const phase = getPhaseForStage(stage.stage);
              const phaseColor = getPhaseColor(stage.stage);
              const gap = 2; // Gap between stages

              // Trapezoid points
              const points = [
                `${topX},${y + gap / 2}`,
                `${topX + topW},${y + gap / 2}`,
                `${botX + botW},${y + stageHeight - gap / 2}`,
                `${botX},${y + stageHeight - gap / 2}`,
              ].join(' ');

              // Fill proportion based on count (visual weight)
              const fillOpacity = stage.count > 0 ? 0.85 : 0.25;
              const label = STAGE_SHORT_LABELS[stage.stage]?.[language] || stage.stage;
              const midY = y + stageHeight / 2;
              const prob = STAGE_PROBABILITIES[stage.stage] || 0;

              return (
                <g key={stage.stage}>
                  {/* Trapezoid background */}
                  <polygon
                    points={points}
                    fill={chartColor}
                    opacity={fillOpacity}
                    stroke="white"
                    strokeWidth="1"
                    className="transition-all duration-300"
                  />
                  {/* Stage label (left) */}
                  <text
                    x={funnelWidth / 2}
                    y={midY - 6}
                    textAnchor="middle"
                    className="fill-current"
                    style={{
                      fontSize: stageHeight > 50 ? '13px' : '11px',
                      fontWeight: 600,
                      fill: fillOpacity > 0.5 ? '#FFFFFF' : '#6B7280',
                    }}
                  >
                    {label}
                  </text>
                  {/* Count + Value (center) */}
                  <text
                    x={funnelWidth / 2}
                    y={midY + 12}
                    textAnchor="middle"
                    style={{
                      fontSize: stageHeight > 50 ? '12px' : '10px',
                      fontWeight: 500,
                      fill: fillOpacity > 0.5 ? 'rgba(255,255,255,0.85)' : '#9CA3AF',
                    }}
                  >
                    {stage.count > 0
                      ? `${stage.count} opp. — ${formatCompactCurrency(stage.totalValue)} (${prob}%)`
                      : `— (${prob}%)`
                    }
                  </text>
                </g>
              );
            })}

            {/* Arrow pointing down at bottom */}
            <polygon
              points={`${funnelWidth / 2 - 12},${funnelHeight - 2} ${funnelWidth / 2 + 12},${funnelHeight - 2} ${funnelWidth / 2},${funnelHeight + 10}`}
              fill="#10B981"
              opacity="0.6"
            />
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// COMMAND CENTER — "Vos prochaines actions"
// ============================================

interface ActionItem {
  id: string;
  type: 'task' | 'at_risk' | 'opportunity';
  priority: 'urgent' | 'high' | 'normal';
  title: string;
  subtitle: string;
  stage?: string;
  href: string;
  icon: React.ElementType;
  iconBg: string;
}

function buildPrioritizedActions(stats: PipelineStats, language: 'fr' | 'en'): ActionItem[] {
  const actions: ActionItem[] = [];

  for (const task of stats.pendingTasks || []) {
    const isRoof = task.taskType === 'roof_drawing';
    actions.push({
      id: task.id,
      type: 'task',
      priority: task.priority === 'urgent' ? 'urgent' : 'normal',
      title: task.siteName,
      subtitle: isRoof
        ? (language === 'fr' ? 'Toit à dessiner' : 'Roof drawing needed')
        : (language === 'fr' ? 'Lancer la validation économique' : 'Run economic validation'),
      href: `/app/sites/${task.siteId}`,
      icon: isRoof ? Grid3X3 : Play,
      iconBg: isRoof ? 'bg-orange-100 dark:bg-orange-950' : 'bg-blue-100 dark:bg-blue-950',
    });
  }

  for (const opp of stats.atRiskOpportunities || []) {
    actions.push({
      id: opp.id,
      type: 'at_risk',
      priority: 'high',
      title: opp.clientName || opp.name,
      subtitle: language === 'fr'
        ? `${opp.daysSinceUpdate} jours sans mise à jour`
        : `${opp.daysSinceUpdate} days without update`,
      stage: opp.stage,
      href: `/app/pipeline`,
      icon: AlertTriangle,
      iconBg: 'bg-red-100 dark:bg-red-950',
    });
  }

  for (const opp of (stats.topOpportunities || []).slice(0, 3)) {
    actions.push({
      id: `top-${opp.id}`,
      type: 'opportunity',
      priority: 'normal',
      title: opp.clientName || opp.name,
      subtitle: language === 'fr'
        ? `${STAGE_SHORT_LABELS[opp.stage]?.fr || opp.stage} — ${formatCompactCurrency(opp.estimatedValue)}`
        : `${STAGE_SHORT_LABELS[opp.stage]?.en || opp.stage} — ${formatCompactCurrency(opp.estimatedValue)}`,
      stage: opp.stage,
      href: `/app/pipeline`,
      icon: ArrowUpRight,
      iconBg: 'bg-green-100 dark:bg-green-950',
    });
  }

  const priorityOrder = { urgent: 0, high: 1, normal: 2 };
  actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  return actions.slice(0, 8);
}

function CommandCenter({ stats, language, isLoading }: { stats?: PipelineStats; language: 'fr' | 'en'; isLoading: boolean }) {
  const actions = stats ? buildPrioritizedActions(stats, language) : [];
  const totalActions = actions.length;

  return (
    <Card className="border-primary/30 shadow-md">
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#FFB005]/15 flex items-center justify-center">
            <Zap className="w-5 h-5 text-[#FFB005]" />
          </div>
          <div>
            <CardTitle className="text-lg">
              {language === 'fr' ? 'Vos prochaines actions' : 'Your Next Actions'}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {language === 'fr'
                ? `${totalActions} action${totalActions > 1 ? 's' : ''} en attente`
                : `${totalActions} pending action${totalActions > 1 ? 's' : ''}`
              }
            </p>
          </div>
        </div>
        <Link href="/app/work-queue">
          <Button variant="outline" size="sm" className="gap-1.5">
            {language === 'fr' ? 'Tout voir' : 'View All'}
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <Skeleton className="w-9 h-9 rounded-lg" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
              </div>
            ))}
          </div>
        ) : actions.length > 0 ? (
          <div className="space-y-1">
            {actions.map((action) => {
              const phaseColor = action.stage ? getPhaseColor(action.stage) : null;
              return (
                <Link key={action.id} href={action.href}>
                  <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${action.iconBg}`}>
                      <action.icon className={`w-4 h-4 ${
                        action.type === 'at_risk' ? 'text-red-600 dark:text-red-400' :
                        action.type === 'task' && action.icon === Grid3X3 ? 'text-orange-600 dark:text-orange-400' :
                        action.type === 'task' ? 'text-blue-600 dark:text-blue-400' :
                        'text-green-600 dark:text-green-400'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{action.title}</p>
                        {action.priority === 'urgent' && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">URGENT</Badge>
                        )}
                        {action.type === 'at_risk' && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-300 text-red-600 dark:border-red-700 dark:text-red-400">
                            {language === 'fr' ? 'À RISQUE' : 'AT RISK'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{action.subtitle}</p>
                    </div>
                    {phaseColor && (
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: phaseColor.solid }}
                        title={action.stage ? STAGE_LABELS[action.stage]?.[language] : ''}
                      />
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
            <p className="font-medium">{language === 'fr' ? 'Aucune action en attente' : 'No pending actions'}</p>
            <p className="text-xs mt-1">{language === 'fr' ? 'Tout est à jour!' : 'Everything is up to date!'}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// OUTPUT KPIs — "Les résultats"
// ============================================

function OutputKPIs({ stats, vpp, language, isLoading, vppLoading }: {
  stats?: PipelineStats;
  vpp?: VirtualPowerPlant;
  language: 'fr' | 'en';
  isLoading: boolean;
  vppLoading: boolean;
}) {
  const getStageData = (stageKey: string) => {
    if (!stats?.stageBreakdown) return { count: 0, totalValue: 0 };
    return stats.stageBreakdown.find(s => s.stage === stageKey) || { count: 0, totalValue: 0 };
  };

  const wonToDeliver = getStageData('won_to_be_delivered');
  const wonConstruction = getStageData('won_in_construction');
  const wonDelivered = getStageData('won_delivered');
  const totalWonCount = wonToDeliver.count + wonConstruction.count + wonDelivered.count;
  const totalWonValue = wonToDeliver.totalValue + wonConstruction.totalValue + wonDelivered.totalValue;

  const totalMW = vpp?.totalInstalledMW || 0;
  const totalKWh = vpp?.totalKWhProduced || 0;
  const co2Tonnes = vpp?.totalCO2AvoidedTonnes || (totalMW * 1000 * 1030 * 0.0004);

  const loading = isLoading || vppLoading;

  const outputs = [
    {
      label: language === 'fr' ? 'Contrats signés' : 'Contracts Signed',
      value: formatCompactCurrency(totalWonValue),
      sub: `${totalWonCount} ${language === 'fr' ? 'projets' : 'projects'}`,
      icon: Handshake,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-950',
    },
    {
      label: language === 'fr' ? 'Capacité installée' : 'Installed Capacity',
      value: formatCapacity(totalMW),
      sub: `${vpp?.totalPanelCount?.toLocaleString() || 0} ${language === 'fr' ? 'panneaux' : 'panels'}`,
      icon: Sun,
      color: 'text-[#FFB005]',
      bgColor: 'bg-amber-100 dark:bg-amber-950',
    },
    {
      label: language === 'fr' ? 'Production annuelle' : 'Annual Production',
      value: formatEnergy(totalKWh),
      sub: `${(vpp?.totalProjectsCompleted || 0)} ${language === 'fr' ? 'systèmes actifs' : 'active systems'}`,
      icon: Zap,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-950',
    },
    {
      label: language === 'fr' ? 'CO₂ évité' : 'CO₂ Avoided',
      value: co2Tonnes >= 1000 ? `${(co2Tonnes / 1000).toFixed(1)}k t` : `${Math.round(co2Tonnes)} t`,
      sub: `≈ ${(vpp?.equivalentHomesP || Math.round(totalKWh / 20000)).toLocaleString()} ${language === 'fr' ? 'maisons' : 'homes'}`,
      icon: Leaf,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-100 dark:bg-emerald-950',
    },
  ];

  return (
    <div className="relative">
      {/* Section title */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-full bg-green-200 dark:bg-green-800 flex items-center justify-center">
          <Trophy className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
        </div>
        <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {language === 'fr' ? 'Les résultats' : 'Results'}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {outputs.map((out, i) => (
          <Card key={i} className="bg-gradient-to-br from-green-50/30 to-transparent dark:from-green-950/10">
            <CardContent className="p-3">
              {loading ? (
                <Skeleton className="h-14 w-full" />
              ) : (
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${out.bgColor}`}>
                    <out.icon className={`w-5 h-5 ${out.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground truncate">{out.label}</p>
                    <p className="text-xl font-bold font-mono truncate">{out.value}</p>
                    {out.sub && <p className="text-[10px] text-muted-foreground truncate">{out.sub}</p>}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============================================
// SIGNED PROJECTS BREAKDOWN
// ============================================

function SignedProjectsBreakdown({ stats, language, isLoading }: { stats?: PipelineStats; language: 'fr' | 'en'; isLoading: boolean }) {
  const wonStagesData = [
    {
      stage: 'won_to_be_delivered',
      label: language === 'fr' ? 'Contrat signé — à livrer' : 'Contract Signed — To Deliver',
      icon: FileSignature,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100 dark:bg-amber-950',
      borderColor: 'border-l-amber-500',
    },
    {
      stage: 'won_in_construction',
      label: language === 'fr' ? 'Permis & installation' : 'Permits & Installation',
      icon: Hammer,
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-950',
      borderColor: 'border-l-green-500',
    },
    {
      stage: 'won_delivered',
      label: language === 'fr' ? 'En opération' : 'In Operation',
      icon: Activity,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100 dark:bg-emerald-950',
      borderColor: 'border-l-emerald-600',
    },
  ];

  const getStageData = (stageKey: string) => {
    if (!stats?.stageBreakdown) return { count: 0, totalValue: 0 };
    return stats.stageBreakdown.find(s => s.stage === stageKey) || { count: 0, totalValue: 0 };
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
        <CardTitle className="text-base">
          {language === 'fr' ? 'Projets signés — détails' : 'Signed Projects — Details'}
        </CardTitle>
        <Trophy className="w-4 h-4 text-[#FFB005]" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : (
          <div className="space-y-2">
            {wonStagesData.map((ws) => {
              const data = getStageData(ws.stage);
              return (
                <div key={ws.stage} className={`flex items-center gap-3 p-3 rounded-lg border-l-4 ${ws.borderColor} bg-muted/30`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${ws.bgColor}`}>
                    <ws.icon className={`w-4 h-4 ${ws.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{ws.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {data.count} {language === 'fr' ? 'projet' : 'project'}{data.count !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <p className="text-sm font-bold font-mono shrink-0">{formatCompactCurrency(data.totalValue)}</p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// OPPORTUNITY ROW
// ============================================

function OpportunityRow({
  id, name, clientName, value, stage, probability, badge, badgeVariant = "secondary", href
}: {
  id: string; name: string; clientName: string | null; value: number | null;
  stage?: string; probability?: number; badge?: string;
  badgeVariant?: "secondary" | "destructive" | "default"; href: string;
}) {
  const { language } = useI18n();
  return (
    <Link href={href} data-testid={`link-opportunity-${id}`}>
      <div className="flex items-center gap-3 py-3 hover:bg-muted/50 rounded-lg px-2 -mx-2 cursor-pointer transition-colors">
        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <Target className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate text-sm" data-testid={`text-opportunity-name-${id}`}>{name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {clientName || (language === 'fr' ? 'Client non assigné' : 'Unassigned client')}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {value && (
            <span className="font-mono text-sm font-medium" data-testid={`text-opportunity-value-${id}`}>
              {formatCompactCurrency(value)}
            </span>
          )}
          {badge && <Badge variant={badgeVariant} className="text-xs">{badge}</Badge>}
          {stage && <Badge variant="outline" className="text-xs">{STAGE_SHORT_LABELS[stage]?.[language] || stage}</Badge>}
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    </Link>
  );
}

// ============================================
// MAIN DASHBOARD PAGE
// Flow: Inputs → Funnel → Outputs
// ============================================

export default function DashboardPage() {
  const { t, language } = useI18n();
  const [, setLocation] = useLocation();

  const { data: stats, isLoading } = useQuery<PipelineStats>({
    queryKey: ["/api/dashboard/pipeline-stats"],
  });

  const { data: vpp, isLoading: vppLoading } = useQuery<VirtualPowerPlant>({
    queryKey: ["/api/gamification/virtual-powerplant"],
  });

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 md:gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-dashboard-title">
            {language === 'fr' ? 'Tableau de bord' : 'Dashboard'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {language === 'fr' ? 'Centre de commandes — vos priorités du jour' : 'Command center — your priorities for today'}
          </p>
        </div>
        <Link href="/app/pipeline">
          <Button data-testid="button-view-pipeline">
            <BarChart3 className="w-4 h-4 mr-2" />
            {language === 'fr' ? 'Voir le pipeline' : 'View Pipeline'}
          </Button>
        </Link>
      </div>

      {/* Section 1: Command Center — priorités */}
      <CommandCenter stats={stats} language={language as 'fr' | 'en'} isLoading={isLoading} />

      {/* ========================================= */}
      {/* FLOW: INPUTS → FUNNEL → OUTPUTS          */}
      {/* ========================================= */}

      {/* Section 2: Input KPIs — "Remplir l'entonnoir" */}
      <InputKPIs stats={stats} language={language as 'fr' | 'en'} isLoading={isLoading} />

      {/* Visual connector */}
      <div className="flex justify-center -my-3">
        <div className="w-px h-6 bg-gradient-to-b from-gray-300 to-amber-400 dark:from-gray-600 dark:to-amber-500" />
      </div>

      {/* Section 3: FUNNEL + Top Opportunités */}
      <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2">
          {stats?.stageBreakdown ? (
            <VisualFunnel data={stats.stageBreakdown} stats={stats} language={language as 'fr' | 'en'} isLoading={isLoading} />
          ) : (
            <Card>
              <CardContent className="p-6">
                {isLoading ? (
                  <Skeleton className="h-[420px] w-full" />
                ) : (
                  <div className="text-center py-16 text-muted-foreground">
                    <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>{language === 'fr' ? 'Aucune donnée de pipeline' : 'No pipeline data'}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
            <CardTitle className="text-base">
              {language === 'fr' ? 'Top opportunités' : 'Top Opportunities'}
            </CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-8 h-8 rounded-lg" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : stats?.topOpportunities && stats.topOpportunities.length > 0 ? (
              <div className="divide-y">
                {stats.topOpportunities.map((opp) => (
                  <OpportunityRow
                    key={opp.id}
                    id={opp.id}
                    name={opp.name}
                    clientName={opp.clientName}
                    value={opp.estimatedValue}
                    stage={opp.stage}
                    probability={opp.probability}
                    href="/app/pipeline"
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>{language === 'fr' ? 'Aucune opportunité' : 'No opportunities'}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Visual connector */}
      <div className="flex justify-center -my-3">
        <div className="w-px h-6 bg-gradient-to-b from-amber-400 to-green-500 dark:from-amber-500 dark:to-green-400" />
      </div>

      {/* Section 4: Output KPIs — "Les résultats" */}
      <OutputKPIs stats={stats} vpp={vpp} language={language as 'fr' | 'en'} isLoading={isLoading} vppLoading={vppLoading} />

      {/* Section 5: Détails projets signés + Gains récents (2 colonnes) */}
      <div className="grid lg:grid-cols-2 gap-4 md:gap-6">
        <SignedProjectsBreakdown stats={stats} language={language as 'fr' | 'en'} isLoading={isLoading} />

        {/* Gains récents */}
        {stats?.recentWins && stats.recentWins.length > 0 ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
              <CardTitle className="text-base">
                {language === 'fr' ? 'Gains récents' : 'Recent Wins'}
              </CardTitle>
              <Trophy className="w-4 h-4 text-[#FFB005]" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.recentWins.map((win) => (
                  <Link key={win.id} href="/app/pipeline">
                    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer border">
                      <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-950 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-sm">{win.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{win.clientName || '—'}</p>
                      </div>
                      {win.estimatedValue && (
                        <span className="font-mono text-sm font-bold text-green-600 dark:text-green-400 shrink-0">
                          {formatCompactCurrency(win.estimatedValue)}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div /> /* Empty space when no recent wins */
        )}
      </div>
    </div>
  );
}
