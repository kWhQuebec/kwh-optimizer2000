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
  Sparkles,
  Upload,
  Play,
  FileCheck,
  X,
  Package,
  CheckCircle2,
  ClipboardList,
  Grid3X3,
  UserPlus,
  Zap,
  ArrowUpRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/lib/i18n";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  Legend
} from "recharts";
import {
  STAGE_LABELS,
  STAGE_SHORT_LABELS,
  STAGE_CHART_COLORS,
  STAGE_TAILWIND,
  STAGE_PHASES,
  PHASE_COLORS,
  getPhaseForStage,
  getPhaseColor,
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

const WON_STAGES = ['won_to_be_delivered', 'won_in_construction', 'won_delivered'];
const isWonStage = (stage: string) => WON_STAGES.includes(stage);

// Format currency compactly: k for < 1M, M for >= 1M
function formatCompactCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return "$0";
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  return `$${(value / 1000).toFixed(0)}k`;
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

  // 1. Pending tasks (urgent first)
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

  // 2. At-risk opportunities (stale deals)
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

  // 3. Top opportunities (push to next stage)
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

  // Sort: urgent → high → normal
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
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                            {language === 'fr' ? 'URGENT' : 'URGENT'}
                          </Badge>
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
            <p className="font-medium">
              {language === 'fr' ? 'Aucune action en attente' : 'No pending actions'}
            </p>
            <p className="text-xs mt-1">
              {language === 'fr' ? 'Tout est à jour!' : 'Everything is up to date!'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// KPI STRIP (compact)
// ============================================

function KPIStrip({ stats, language, isLoading }: { stats?: PipelineStats; language: 'fr' | 'en'; isLoading: boolean }) {
  const [, setLocation] = useLocation();

  const kpis = [
    {
      label: language === 'fr' ? 'Prospects' : 'Prospects',
      value: stats?.stageBreakdown?.find(s => s.stage === 'prospect')?.count || 0,
      format: 'number' as const,
      icon: UserPlus,
      color: 'text-gray-600',
      onClick: () => setLocation("/app/pipeline?stage=prospect"),
    },
    {
      label: language === 'fr' ? 'Pipeline actif' : 'Active Pipeline',
      value: stats?.totalPipelineValue || 0,
      format: 'currency' as const,
      icon: TrendingUp,
      color: 'text-blue-600',
      subtitle: `${stats?.activeOpportunityCount || 0} opp.`,
    },
    {
      label: language === 'fr' ? 'Valeur pondérée' : 'Weighted Value',
      value: stats?.weightedPipelineValue || 0,
      format: 'currency' as const,
      icon: DollarSign,
      color: 'text-green-600',
    },
    {
      label: language === 'fr' ? 'Livraison' : 'Delivery',
      value: stats?.deliveryBacklogValue || 0,
      format: 'currency' as const,
      icon: Package,
      color: 'text-amber-600',
      subtitle: `${stats?.deliveryBacklogCount || 0} ${language === 'fr' ? 'projets' : 'projects'}`,
    },
    {
      label: language === 'fr' ? 'Gagné' : 'Won',
      value: stats?.wonValue || 0,
      format: 'currency' as const,
      icon: Trophy,
      color: 'text-[#FFB005]',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {kpis.map((kpi, i) => (
        <Card
          key={i}
          className={`${kpi.onClick ? 'hover:bg-muted/50 cursor-pointer' : ''}`}
          onClick={kpi.onClick}
        >
          <CardContent className="p-3">
            {isLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : (
              <div className="flex items-center gap-2.5">
                <kpi.icon className={`w-4 h-4 shrink-0 ${kpi.color}`} />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground truncate">{kpi.label}</p>
                  <p className="text-base font-bold font-mono truncate">
                    {kpi.format === 'currency' ? formatCompactCurrency(kpi.value) : kpi.value}
                  </p>
                  {kpi.subtitle && (
                    <p className="text-[10px] text-muted-foreground">{kpi.subtitle}</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================
// FUNNEL CHART (nomenclature + couleurs corrigées)
// ============================================

function FunnelChart({ data, language }: { data: PipelineStats['stageBreakdown']; language: 'fr' | 'en' }) {
  const activeStages = data.filter(s => !isWonStage(s.stage) && s.stage !== 'lost' && s.stage !== 'disqualified');
  const maxValue = Math.max(...activeStages.map(s => s.totalValue), 1);

  return (
    <div className="space-y-3">
      {activeStages.map((stage) => {
        const widthPercent = maxValue > 0 ? Math.max((stage.totalValue / maxValue) * 100, 15) : 15;
        const tailwind = STAGE_TAILWIND[stage.stage];
        const chartColor = STAGE_CHART_COLORS[stage.stage];
        return (
          <div key={stage.stage} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: chartColor }}
                />
                <span className="font-medium">
                  {STAGE_SHORT_LABELS[stage.stage]?.[language] || stage.stage}
                </span>
                <Badge variant="secondary" className="text-xs">{stage.count}</Badge>
              </div>
              <span className="font-mono text-muted-foreground">
                {formatCompactCurrency(stage.totalValue)}
              </span>
            </div>
            <div className="relative h-6 bg-muted/50 rounded overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full transition-all duration-500 rounded"
                style={{ width: `${widthPercent}%`, backgroundColor: chartColor }}
              />
              <div className="absolute inset-0 flex items-center justify-end pr-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {stage.count > 0 ? `${Math.round((stage.weightedValue / stage.totalValue) * 100) || 0}%` : ''}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// OPPORTUNITY ROW
// ============================================

function OpportunityRow({
  id,
  name,
  clientName,
  value,
  stage,
  probability,
  badge,
  badgeVariant = "secondary",
  href
}: {
  id: string;
  name: string;
  clientName: string | null;
  value: number | null;
  stage?: string;
  probability?: number;
  badge?: string;
  badgeVariant?: "secondary" | "destructive" | "default";
  href: string;
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
          {badge && (
            <Badge variant={badgeVariant} className="text-xs" data-testid={`badge-opportunity-${id}`}>
              {badge}
            </Badge>
          )}
          {stage && (
            <Badge variant="outline" className="text-xs">
              {STAGE_SHORT_LABELS[stage]?.[language] || stage}
            </Badge>
          )}
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    </Link>
  );
}

// ============================================
// WEIGHTED VS ACTUAL CHART
// ============================================

function WeightedVsActualChart({ stageBreakdown, language }: { stageBreakdown: PipelineStats['stageBreakdown']; language: 'fr' | 'en' }) {
  const activeStages = ['prospect', 'contacted', 'qualified', 'analysis_done', 'design_mandate_signed', 'epc_proposal_sent', 'negotiation'];
  const data = stageBreakdown
    .filter(s => activeStages.includes(s.stage))
    .map(item => ({
      stage: item.stage,
      name: STAGE_SHORT_LABELS[item.stage]?.[language] || item.stage,
      actual: item.totalValue,
      weighted: item.weightedValue,
    }));

  const hasData = data.some(d => d.actual > 0);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
        {language === 'fr' ? 'Aucune opportunité active' : 'No active opportunities'}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10 }}
            angle={-15}
            textAnchor="end"
            height={50}
            className="text-muted-foreground"
          />
          <YAxis
            tick={{ fontSize: 11 }}
            className="text-muted-foreground"
            tickFormatter={(value) => formatCompactCurrency(value)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: 12
            }}
            formatter={(value: number, name: string) => [
              formatCompactCurrency(value),
              name === 'actual'
                ? (language === 'fr' ? 'Valeur totale' : 'Total Value')
                : (language === 'fr' ? 'Valeur pondérée' : 'Weighted Value')
            ]}
          />
          <Legend
            formatter={(value) => value === 'actual'
              ? (language === 'fr' ? 'Total' : 'Total')
              : (language === 'fr' ? 'Pondéré' : 'Weighted')
            }
          />
          <Bar dataKey="actual" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="weighted" fill="#22c55e" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================
// MAIN DASHBOARD PAGE
// ============================================

export default function DashboardPage() {
  const { t, language } = useI18n();
  const [, setLocation] = useLocation();

  const { data: stats, isLoading } = useQuery<PipelineStats>({
    queryKey: ["/api/dashboard/pipeline-stats"],
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

      {/* Section 1: Command Center — Prochaines actions */}
      <CommandCenter stats={stats} language={language as 'fr' | 'en'} isLoading={isLoading} />

      {/* Section 2: KPI Strip (compact) */}
      <KPIStrip stats={stats} language={language as 'fr' | 'en'} isLoading={isLoading} />

      {/* Section 3: Entonnoir + Top Opportunités */}
      <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
            <CardTitle className="text-lg">
              {language === 'fr' ? 'Entonnoir de ventes' : 'Sales Funnel'}
            </CardTitle>
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-6 w-full" />
                  </div>
                ))}
              </div>
            ) : stats?.stageBreakdown ? (
              <FunnelChart data={stats.stageBreakdown} language={language as 'fr' | 'en'} />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>{language === 'fr' ? 'Aucune donnée de pipeline' : 'No pipeline data'}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
            <CardTitle className="text-lg">
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

      {/* Section 4: Gains récents */}
      <div className="grid lg:grid-cols-2 gap-4 md:gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
            <CardTitle className="text-lg">
              {language === 'fr' ? 'Gains récents' : 'Recent Wins'}
            </CardTitle>
            <Trophy className="w-4 h-4 text-[#FFB005]" />
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
            ) : stats?.recentWins && stats.recentWins.length > 0 ? (
              <div className="divide-y">
                {stats.recentWins.map((win) => (
                  <OpportunityRow
                    key={win.id}
                    id={win.id}
                    name={win.name}
                    clientName={win.clientName}
                    value={win.estimatedValue}
                    href="/app/pipeline"
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Trophy className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>{language === 'fr' ? 'Aucun gain récent' : 'No recent wins'}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
            <div>
              <CardTitle className="text-lg">
                {language === 'fr' ? 'Pipeline par étape' : 'Pipeline by Stage'}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {language === 'fr'
                  ? 'Valeur totale vs pondérée'
                  : 'Total vs weighted value'}
              </p>
            </div>
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : (
              <WeightedVsActualChart stageBreakdown={stats?.stageBreakdown || []} language={language as 'fr' | 'en'} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
