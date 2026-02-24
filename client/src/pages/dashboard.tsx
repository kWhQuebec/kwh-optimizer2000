import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  BarChart3,
  DollarSign,
  TrendingUp,
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
  Hammer,
  Activity,
  FileSignature,
  Phone,
  Search,
  Send,
  Handshake,
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
  STAGE_PROBABILITIES,
  ACTIVE_STAGES,
  getPhaseColor,
  getPhaseForStage,
} from "@shared/stageLabels";

// ============================================
// BRAND CONSTANTS — kWh Québec
// Bleu #003DA6 | Or #FFB005 | Gris #AAAAAA
// ============================================
const BRAND = {
  blue: "#003DA6",
  darkBlue: "#002B75",
  gold: "#FFB005",
  gray: "#AAAAAA",
  green: "#16A34A",
} as const;

// Funnel gradient: blue → gold → green (brand progression)
const FUNNEL_COLORS: Record<string, string> = {
  prospect:               "#4A7DC8", // lighter blue
  contacted:              "#2D66BB", // medium blue
  qualified:              "#003DA6", // brand blue
  analysis_done:          "#3B7AD4", // blue-teal transition
  design_mandate_signed:  "#D4940A", // dark gold
  epc_proposal_sent:      "#FFB005", // brand gold
  negotiation:            "#E6A005", // deep gold
};

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
  deliveredOpportunities?: Array<{
    id: string;
    name: string;
    clientName: string | null;
    pvSizeKW?: number;
    estimatedValue?: number | null;
  }>;
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
// Brand blue accent on left border
// ============================================

function InputKPIs({ stats, language, isLoading }: { stats?: PipelineStats; language: 'fr' | 'en'; isLoading: boolean }) {
  const getStageCount = (stage: string) =>
    stats?.stageBreakdown?.find(s => s.stage === stage)?.count || 0;

  const inputs = [
    {
      label: language === 'fr' ? 'Nouveaux prospects' : 'New Prospects',
      value: getStageCount('prospect'),
      icon: UserPlus,
      color: BRAND.blue,
    },
    {
      label: language === 'fr' ? 'En contact' : 'Contacted',
      value: getStageCount('contacted'),
      icon: Phone,
      color: BRAND.blue,
    },
    {
      label: language === 'fr' ? 'Analyses à faire' : 'Analyses Pending',
      value: (stats?.pendingTasksCount?.runAnalysis || 0) + getStageCount('qualified'),
      icon: Search,
      color: BRAND.blue,
    },
    {
      label: language === 'fr' ? 'Propositions envoyées' : 'Proposals Sent',
      value: getStageCount('epc_proposal_sent') + getStageCount('negotiation'),
      icon: Send,
      color: BRAND.gold,
    },
  ];

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND.blue}15` }}>
          <ArrowDown className="w-4 h-4" style={{ color: BRAND.blue }} />
        </div>
        <h2 className="text-base font-extrabold uppercase tracking-wide" style={{ color: BRAND.blue }}>
          {language === 'fr' ? 'Remplir l\'entonnoir' : 'Fill the Funnel'}
        </h2>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {inputs.map((inp, i) => (
          <Card key={i} className="border-l-[3px] overflow-hidden" style={{ borderLeftColor: inp.color }}>
            <CardContent className="p-3.5">
              {isLoading ? (
                <Skeleton className="h-14 w-full" />
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${inp.color}12` }}>
                    <inp.icon className="w-5 h-5" style={{ color: inp.color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground truncate font-medium">{inp.label}</p>
                    <p className="text-2xl font-extrabold font-mono" style={{ color: BRAND.darkBlue }}>{inp.value}</p>
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
// VISUAL FUNNEL — SVG with brand gradients,
// rounded look, hover tooltips, stagger anim
// ============================================

function VisualFunnel({ data, stats, language, isLoading }: {
  data: PipelineStats['stageBreakdown'];
  stats?: PipelineStats;
  language: 'fr' | 'en';
  isLoading: boolean;
}) {
  const [hoveredStage, setHoveredStage] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Stagger animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

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
  const W = 640;
  const H = 420;
  const topW = W * 0.92;
  const bottomW = W * 0.16;
  const stageCount = activeStages.length;
  const stageH = H / stageCount;
  const gap = 3;
  const cornerR = 4;

  const getWidthAtLevel = (level: number) => {
    const t = level / stageCount;
    return topW - (topW - bottomW) * t;
  };

  // Build rounded trapezoid path
  const trapezoidPath = (topX: number, topW: number, botX: number, botW: number, y: number, h: number) => {
    const r = cornerR;
    const t = y + gap / 2;
    const b = y + h - gap / 2;
    return `
      M ${topX + r} ${t}
      L ${topX + topW - r} ${t}
      Q ${topX + topW} ${t} ${topX + topW - r * 0.3} ${t + r}
      L ${botX + botW - r * 0.3} ${b - r}
      Q ${botX + botW} ${b} ${botX + botW - r} ${b}
      L ${botX + r} ${b}
      Q ${botX} ${b} ${botX + r * 0.3} ${b - r}
      L ${topX + r * 0.3} ${t + r}
      Q ${topX} ${t} ${topX + r} ${t}
      Z
    `;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-[440px] w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-t-[3px]" style={{ borderTopColor: BRAND.blue }}>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
        <div>
          <CardTitle className="text-lg font-extrabold" style={{ color: BRAND.darkBlue }}>
            {language === 'fr' ? 'Entonnoir de ventes' : 'Sales Funnel'}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalActiveCount} {language === 'fr' ? 'opportunités' : 'opportunities'} — {formatCompactCurrency(totalActiveValue)}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: BRAND.blue }} />
          <span>Exploration</span>
          <span className="inline-block w-2.5 h-2.5 rounded-sm ml-1.5" style={{ backgroundColor: BRAND.blue, opacity: 0.6 }} />
          <span>Conception</span>
          <span className="inline-block w-2.5 h-2.5 rounded-sm ml-1.5" style={{ backgroundColor: BRAND.gold }} />
          <span>{language === 'fr' ? 'Réalisation' : 'Delivery'}</span>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-5 pt-1" ref={ref}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          preserveAspectRatio="xMidYMid meet"
          style={{ maxHeight: '440px' }}
        >
          {/* SVG defs for gradients and filters */}
          <defs>
            <filter id="funnelShadow" x="-5%" y="-5%" width="110%" height="115%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.08" />
            </filter>
            {activeStages.map((stage, i) => {
              const color = FUNNEL_COLORS[stage.stage] || '#9CA3AF';
              return (
                <linearGradient key={`grad-${stage.stage}`} id={`grad-${stage.stage}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={color} stopOpacity="0.75" />
                  <stop offset="50%" stopColor={color} stopOpacity="0.92" />
                  <stop offset="100%" stopColor={color} stopOpacity="0.75" />
                </linearGradient>
              );
            })}
          </defs>

          {activeStages.map((stage, i) => {
            const y = i * stageH;
            const topWidth = getWidthAtLevel(i);
            const botWidth = getWidthAtLevel(i + 1);
            const topX = (W - topWidth) / 2;
            const botX = (W - botWidth) / 2;
            const isHovered = hoveredStage === stage.stage;
            const label = STAGE_SHORT_LABELS[stage.stage]?.[language] || stage.stage;
            const midY = y + stageH / 2;
            const prob = STAGE_PROBABILITIES[stage.stage] || 0;
            const hasData = stage.count > 0;
            const fillOpacity = hasData ? 1 : 0.35;

            // Stagger animation delay
            const animDelay = `${i * 80}ms`;
            const animStyle = {
              opacity: visible ? fillOpacity : 0,
              transform: visible ? 'translateY(0)' : 'translateY(12px)',
              transition: `opacity 0.4s ease ${animDelay}, transform 0.4s ease ${animDelay}`,
            };

            const path = trapezoidPath(topX, topWidth, botX, botWidth, y, stageH);

            return (
              <g
                key={stage.stage}
                style={animStyle}
                onMouseEnter={() => setHoveredStage(stage.stage)}
                onMouseLeave={() => setHoveredStage(null)}
                className="cursor-pointer"
              >
                {/* Shadow on hover */}
                <path
                  d={path}
                  fill={`url(#grad-${stage.stage})`}
                  filter={isHovered ? "url(#funnelShadow)" : undefined}
                  stroke={isHovered ? "#FFFFFF" : "rgba(255,255,255,0.4)"}
                  strokeWidth={isHovered ? "2" : "1"}
                  style={{
                    transform: isHovered ? 'scale(1.015)' : 'scale(1)',
                    transformOrigin: `${W / 2}px ${midY}px`,
                    transition: 'transform 0.2s ease, stroke-width 0.2s ease',
                  }}
                />

                {/* Stage label */}
                <text
                  x={W / 2}
                  y={midY - (stageH > 55 ? 7 : 5)}
                  textAnchor="middle"
                  style={{
                    fontSize: stageH > 55 ? '14px' : '12px',
                    fontWeight: 800,
                    fontFamily: "'Montserrat', sans-serif",
                    fill: hasData ? '#FFFFFF' : '#9CA3AF',
                    textShadow: hasData ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
                  }}
                >
                  {label}
                </text>

                {/* Count + Value */}
                <text
                  x={W / 2}
                  y={midY + (stageH > 55 ? 13 : 10)}
                  textAnchor="middle"
                  style={{
                    fontSize: stageH > 55 ? '12px' : '10px',
                    fontWeight: 600,
                    fontFamily: "'JetBrains Mono', monospace",
                    fill: hasData ? 'rgba(255,255,255,0.9)' : '#BFBFBF',
                  }}
                >
                  {hasData
                    ? `${stage.count} opp. — ${formatCompactCurrency(stage.totalValue)}`
                    : `— (${prob}%)`
                  }
                </text>

                {/* Probability badge on right */}
                {hasData && (
                  <text
                    x={W / 2 + (topWidth + botWidth) / 4 + 20}
                    y={midY + 4}
                    textAnchor="start"
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      fontFamily: "'JetBrains Mono', monospace",
                      fill: 'rgba(255,255,255,0.6)',
                    }}
                  >
                    {prob}%
                  </text>
                )}

                {/* Hover tooltip */}
                {isHovered && hasData && (
                  <g>
                    <rect
                      x={W / 2 - 110}
                      y={y - 36}
                      width="220"
                      height="30"
                      rx="6"
                      fill={BRAND.darkBlue}
                      opacity="0.95"
                    />
                    <text
                      x={W / 2}
                      y={y - 17}
                      textAnchor="middle"
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        fontFamily: "'Montserrat', sans-serif",
                        fill: '#FFFFFF',
                      }}
                    >
                      {stage.count} opp. · {formatCompactCurrency(stage.totalValue)} · Pondéré: {formatCompactCurrency(stage.weightedValue)}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Bottom arrow → results */}
          <polygon
            points={`${W / 2 - 14},${H - 3} ${W / 2 + 14},${H - 3} ${W / 2},${H + 10}`}
            fill={BRAND.green}
            opacity={visible ? 0.7 : 0}
            style={{ transition: `opacity 0.5s ease ${activeStages.length * 80 + 200}ms` }}
          />
        </svg>
      </CardContent>
    </Card>
  );
}

// ============================================
// CONVERSION RATE — Between funnel and results
// ============================================

function ConversionIndicator({ stats, language }: { stats?: PipelineStats; language: 'fr' | 'en' }) {
  if (!stats?.stageBreakdown) return null;

  const prospectCount = stats.stageBreakdown.find(s => s.stage === 'prospect')?.count || 0;
  const wonCount = stats.stageBreakdown
    .filter(s => WON_STAGES.includes(s.stage))
    .reduce((sum, s) => sum + s.count, 0);
  const totalEntered = prospectCount + (stats.stageBreakdown.find(s => s.stage === 'contacted')?.count || 0) + wonCount;
  const conversionRate = totalEntered > 0 ? Math.round((wonCount / totalEntered) * 100) : 0;

  return (
    <div className="flex items-center justify-center gap-4 py-1">
      <div className="h-px flex-1 max-w-24" style={{ background: `linear-gradient(to right, transparent, ${BRAND.gold})` }} />
      <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border" style={{ borderColor: `${BRAND.gold}40`, backgroundColor: `${BRAND.gold}08` }}>
        <TrendingUp className="w-3.5 h-3.5" style={{ color: BRAND.gold }} />
        <span className="text-xs font-bold font-mono" style={{ color: BRAND.darkBlue }}>
          {language === 'fr' ? 'Taux de conversion' : 'Conversion Rate'}: {conversionRate}%
        </span>
        <span className="text-[10px] text-muted-foreground">
          ({wonCount}/{totalEntered})
        </span>
      </div>
      <div className="h-px flex-1 max-w-24" style={{ background: `linear-gradient(to left, transparent, ${BRAND.gold})` }} />
    </div>
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
      href: `/app/pipeline?opp=${opp.id}`,
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
      href: `/app/pipeline?opp=${opp.id}`,
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
    <Card className="shadow-sm border-l-[3px]" style={{ borderLeftColor: BRAND.gold }}>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${BRAND.gold}15` }}>
            <Zap className="w-5 h-5" style={{ color: BRAND.gold }} />
          </div>
          <div>
            <CardTitle className="text-lg font-extrabold" style={{ color: BRAND.darkBlue }}>
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
                        <p className="text-sm font-semibold truncate">{action.title}</p>
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
            <p className="font-semibold">{language === 'fr' ? 'Aucune action en attente' : 'No pending actions'}</p>
            <p className="text-xs mt-1">{language === 'fr' ? 'Tout est à jour!' : 'Everything is up to date!'}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// QUALIFICATION SUMMARY CARD
// Lead qualification status & blockers
// ============================================

interface QualificationSummaryData {
  byStatus: { hot: number; warm: number; nurture: number; cold: number; disqualified: number; pending: number };
  byColor: { green: number; yellow: number; red: number; unscored: number };
  topBlockers: Array<{
    type: string;
    description: string;
    count: number;
  }>;
  yellowLeads: Array<{
    id: string;
    name: string;
    email: string;
    blockerCount: number;
    score: number;
  }>;
  total: number;
  scored: number;
}

function QualificationSummaryCard({ language, isLoading }: { language: 'fr' | 'en'; isLoading: boolean }) {
  const { data: qualData, isLoading: qualLoading } = useQuery<QualificationSummaryData>({
    queryKey: ["/api/leads/qualification-summary"],
  });

  const loading = isLoading || qualLoading;

  const statusBadges = [
    {
      label: language === 'fr' ? 'Hot' : 'Hot',
      value: qualData?.byStatus.hot || 0,
      bgColor: '#EF4444', // red
    },
    {
      label: language === 'fr' ? 'Warm' : 'Warm',
      value: qualData?.byStatus.warm || 0,
      bgColor: '#F97316', // orange
    },
    {
      label: language === 'fr' ? 'Nurture' : 'Nurture',
      value: qualData?.byStatus.nurture || 0,
      bgColor: '#FBBF24', // yellow/amber
    },
    {
      label: language === 'fr' ? 'Cold' : 'Cold',
      value: qualData?.byStatus.cold || 0,
      bgColor: '#3B82F6', // blue
    },
  ];

  const yellowLeadsCount = qualData?.byColor.yellow || 0;
  const yellowLeadsLabel = language === 'fr'
    ? `${yellowLeadsCount} lead${yellowLeadsCount !== 1 ? 's' : ''} à qualifier`
    : `${yellowLeadsCount} lead${yellowLeadsCount !== 1 ? 's' : ''} to qualify`;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
        <CardTitle className="text-base font-extrabold" style={{ color: BRAND.darkBlue }}>
          {language === 'fr' ? 'Qualification des leads' : 'Lead Qualification'}
        </CardTitle>
        <Target className="w-4 h-4" style={{ color: BRAND.blue }} />
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <>
            {/* Status Badges Row */}
            <div className="grid grid-cols-4 gap-2">
              {statusBadges.map((badge, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center justify-center p-3 rounded-lg text-white"
                  style={{ backgroundColor: badge.bgColor }}
                >
                  <p className="text-2xl font-extrabold font-mono">{badge.value}</p>
                  <p className="text-xs font-semibold mt-1 text-center">{badge.label}</p>
                </div>
              ))}
            </div>

            {/* Top Blockers */}
            {qualData?.topBlockers && qualData.topBlockers.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                  {language === 'fr' ? 'Principaux blocages' : 'Top Blockers'}
                </p>
                <div className="space-y-1.5">
                  {qualData.topBlockers.slice(0, 5).map((blocker, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm">
                      <span className="truncate flex-1">{blocker.description}</span>
                      <Badge variant="secondary" className="ml-2 shrink-0">
                        {blocker.count}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Yellow Leads Link */}
            {yellowLeadsCount > 0 && (
              <div className="pt-2 border-t">
                <Link href="/app/leads?filter=yellow">
                  <Button variant="outline" size="sm" className="w-full gap-2">
                    <span>{yellowLeadsLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>
            )}

            {/* Empty state */}
            {(!qualData?.topBlockers || qualData.topBlockers.length === 0) && yellowLeadsCount === 0 && (
              <div className="text-center py-4 text-muted-foreground">
                <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-green-500" />
                <p className="text-sm font-semibold">{language === 'fr' ? 'Aucun problème détecté' : 'No issues detected'}</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// OUTPUT KPIs — "Les résultats"
// Brand gold accent on left border
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
      accentColor: BRAND.green,
    },
    {
      label: language === 'fr' ? 'Capacité installée' : 'Installed Capacity',
      value: formatCapacity(totalMW),
      sub: `${vpp?.totalPanelCount?.toLocaleString() || 0} ${language === 'fr' ? 'panneaux' : 'panels'}`,
      icon: Sun,
      accentColor: BRAND.gold,
    },
    {
      label: language === 'fr' ? 'Production annuelle' : 'Annual Production',
      value: formatEnergy(totalKWh),
      sub: `${(vpp?.totalProjectsCompleted || 0)} ${language === 'fr' ? 'systèmes' : 'systems'}`,
      icon: Zap,
      accentColor: BRAND.blue,
    },
    {
      label: language === 'fr' ? 'CO₂ évité' : 'CO₂ Avoided',
      value: co2Tonnes >= 1000 ? `${(co2Tonnes / 1000).toFixed(1)}k t` : `${Math.round(co2Tonnes)} t`,
      sub: `≈ ${(vpp?.equivalentHomesP || Math.round(totalKWh / 20000)).toLocaleString()} ${language === 'fr' ? 'maisons' : 'homes'}`,
      icon: Leaf,
      accentColor: BRAND.green,
    },
  ];

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND.green}15` }}>
          <Trophy className="w-4 h-4" style={{ color: BRAND.green }} />
        </div>
        <h2 className="text-base font-extrabold uppercase tracking-wide" style={{ color: BRAND.darkBlue }}>
          {language === 'fr' ? 'Les résultats' : 'Results'}
        </h2>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {outputs.map((out, i) => (
          <Card key={i} className="border-l-[3px] overflow-hidden" style={{ borderLeftColor: out.accentColor }}>
            <CardContent className="p-3.5">
              {loading ? (
                <Skeleton className="h-14 w-full" />
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${out.accentColor}12` }}>
                    <out.icon className="w-5 h-5" style={{ color: out.accentColor }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground truncate font-medium">{out.label}</p>
                    <p className="text-xl font-extrabold font-mono" style={{ color: BRAND.darkBlue }}>{out.value}</p>
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
      color: BRAND.gold,
    },
    {
      stage: 'won_in_construction',
      label: language === 'fr' ? 'Permis & installation' : 'Permits & Installation',
      icon: Hammer,
      color: BRAND.green,
    },
    {
      stage: 'won_delivered',
      label: language === 'fr' ? 'En opération' : 'In Operation',
      icon: Activity,
      color: '#16A34A',
    },
  ];

  const getStageData = (stageKey: string) => {
    if (!stats?.stageBreakdown) return { count: 0, totalValue: 0 };
    return stats.stageBreakdown.find(s => s.stage === stageKey) || { count: 0, totalValue: 0 };
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
        <CardTitle className="text-base font-extrabold" style={{ color: BRAND.darkBlue }}>
          {language === 'fr' ? 'Projets signés — détails' : 'Signed Projects — Details'}
        </CardTitle>
        <Trophy className="w-4 h-4" style={{ color: BRAND.gold }} />
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
                <div key={ws.stage} className="flex items-center gap-3 p-3 rounded-lg border-l-[3px] bg-muted/30" style={{ borderLeftColor: ws.color }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${ws.color}15` }}>
                    <ws.icon className="w-4 h-4" style={{ color: ws.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{ws.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {data.count} {language === 'fr' ? 'projet' : 'project'}{data.count !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <p className="text-sm font-extrabold font-mono shrink-0" style={{ color: BRAND.darkBlue }}>{formatCompactCurrency(data.totalValue)}</p>
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
// POST-DELIVERY KPIs — "Post-livraison"
// Projects delivered and in operation
// ============================================

function PostDeliveryKPIs({ stats, language, isLoading }: { stats?: PipelineStats; language: 'fr' | 'en'; isLoading: boolean }) {
  const getStageData = (stageKey: string) => {
    if (!stats?.stageBreakdown) return { count: 0, totalValue: 0 };
    return stats.stageBreakdown.find(s => s.stage === stageKey) || { count: 0, totalValue: 0 };
  };

  const deliveredData = getStageData('won_delivered');
  const projectCount = deliveredData.count;

  // Calculate totals from delivered opportunities
  let totalCapacityKW = 0;
  let totalSavings = 0;

  if (stats?.deliveredOpportunities && stats.deliveredOpportunities.length > 0) {
    stats.deliveredOpportunities.forEach(opp => {
      if (opp.pvSizeKW) totalCapacityKW += opp.pvSizeKW;
      if (opp.estimatedValue) totalSavings += opp.estimatedValue;
    });
  } else if (deliveredData.totalValue) {
    totalSavings = deliveredData.totalValue;
  }

  // CO2 avoided: capacity (MW) * 1150 (kWh/kW/year) * 0.0005 (tonnes CO2 per kWh)
  const capacityMW = totalCapacityKW / 1000;
  const co2Avoided = capacityMW * 1150 * 0.0005;

  const kpis = [
    {
      label: language === 'fr' ? 'Capacité installée' : 'Installed Capacity',
      value: formatCapacity(capacityMW),
      icon: Sun,
      color: BRAND.gold,
    },
    {
      label: language === 'fr' ? 'Projets livrés' : 'Projects Delivered',
      value: `${projectCount}`,
      sub: language === 'fr' ? 'systèmes actifs' : 'active systems',
      icon: CheckCircle2,
      color: BRAND.green,
    },
    {
      label: language === 'fr' ? 'Économies estimées' : 'Estimated Savings',
      value: formatCompactCurrency(totalSavings),
      icon: DollarSign,
      color: BRAND.blue,
    },
    {
      label: language === 'fr' ? 'CO₂ évité' : 'CO₂ Avoided',
      value: `${Math.round(co2Avoided)} t`,
      sub: language === 'fr' ? 'par an' : 'per year',
      icon: Leaf,
      color: BRAND.green,
    },
  ];

  if (projectCount === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND.green}15` }}>
          <Package className="w-4 h-4" style={{ color: BRAND.green }} />
        </div>
        <h2 className="text-base font-extrabold uppercase tracking-wide" style={{ color: BRAND.darkBlue }}>
          {language === 'fr' ? 'Post-livraison' : 'Post-Delivery'}
        </h2>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((kpi, i) => (
          <Card key={i} className="border-l-[3px] overflow-hidden" style={{ borderLeftColor: kpi.color }}>
            <CardContent className="p-3.5">
              {isLoading ? (
                <Skeleton className="h-14 w-full" />
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${kpi.color}12` }}>
                    <kpi.icon className="w-5 h-5" style={{ color: kpi.color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground truncate font-medium">{kpi.label}</p>
                    <p className="text-2xl font-extrabold font-mono" style={{ color: BRAND.darkBlue }}>{kpi.value}</p>
                    {kpi.sub && <p className="text-[10px] text-muted-foreground truncate">{kpi.sub}</p>}
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
          <p className="font-semibold truncate text-sm" data-testid={`text-opportunity-name-${id}`}>{name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {clientName || (language === 'fr' ? 'Client non assigné' : 'Unassigned client')}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {value && (
            <span className="font-mono text-sm font-bold" style={{ color: BRAND.darkBlue }} data-testid={`text-opportunity-value-${id}`}>
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
// Flow: Command Center → Inputs → Funnel → Conversion → Outputs
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
      {/* Header — Brand blue title */}
      <div className="flex flex-wrap items-center justify-between gap-3 md:gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: BRAND.darkBlue }} data-testid="text-dashboard-title">
            {language === 'fr' ? 'Tableau de bord' : 'Dashboard'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {language === 'fr' ? 'Centre de commandes — vos priorités du jour' : 'Command center — your priorities for today'}
          </p>
        </div>
        <Link href="/app/pipeline">
          <Button data-testid="button-view-pipeline" style={{ backgroundColor: BRAND.blue }}>
            <BarChart3 className="w-4 h-4 mr-2" />
            {language === 'fr' ? 'Voir le pipeline' : 'View Pipeline'}
          </Button>
        </Link>
      </div>

      {/* Section 1: Command Center */}
      <CommandCenter stats={stats} language={language as 'fr' | 'en'} isLoading={isLoading} />

      {/* ========================================= */}
      {/* FLOW: INPUTS → FUNNEL → OUTPUTS          */}
      {/* ========================================= */}

      {/* Section 2: Input KPIs */}
      <InputKPIs stats={stats} language={language as 'fr' | 'en'} isLoading={isLoading} />

      {/* Connector: blue → gold gradient line */}
      <div className="flex justify-center -my-2">
        <div className="w-0.5 h-8 rounded-full" style={{ background: `linear-gradient(to bottom, ${BRAND.blue}, ${BRAND.gold})` }} />
      </div>

      {/* Section 3: FUNNEL + Top Opportunities */}
      <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2">
          {stats?.stageBreakdown ? (
            <VisualFunnel data={stats.stageBreakdown} stats={stats} language={language as 'fr' | 'en'} isLoading={isLoading} />
          ) : (
            <Card>
              <CardContent className="p-6">
                {isLoading ? (
                  <Skeleton className="h-[440px] w-full rounded-xl" />
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
            <CardTitle className="text-base font-extrabold" style={{ color: BRAND.darkBlue }}>
              {language === 'fr' ? 'Top opportunités' : 'Top Opportunities'}
            </CardTitle>
            <DollarSign className="w-4 h-4" style={{ color: BRAND.gold }} />
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
                    href={`/app/pipeline?opp=${opp.id}`}
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

      {/* Connector: gold → green with conversion rate */}
      <div className="-my-2">
        <div className="flex justify-center mb-1">
          <div className="w-0.5 h-4 rounded-full" style={{ background: `linear-gradient(to bottom, ${BRAND.gold}, ${BRAND.green})` }} />
        </div>
        <ConversionIndicator stats={stats} language={language as 'fr' | 'en'} />
        <div className="flex justify-center mt-1">
          <div className="w-0.5 h-4 rounded-full" style={{ background: `linear-gradient(to bottom, ${BRAND.gold}, ${BRAND.green})` }} />
        </div>
      </div>

      {/* Section 3b: Qualification Summary — Lead readiness metrics */}
      <QualificationSummaryCard language={language as 'fr' | 'en'} isLoading={isLoading} />

      {/* Section 4: Output KPIs */}
      <OutputKPIs stats={stats} vpp={vpp} language={language as 'fr' | 'en'} isLoading={isLoading} vppLoading={vppLoading} />

      {/* Section 5: Signed projects + Recent wins */}
      <div className="grid lg:grid-cols-2 gap-4 md:gap-6">
        <SignedProjectsBreakdown stats={stats} language={language as 'fr' | 'en'} isLoading={isLoading} />

        {stats?.recentWins && stats.recentWins.length > 0 ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
              <CardTitle className="text-base font-extrabold" style={{ color: BRAND.darkBlue }}>
                {language === 'fr' ? 'Gains récents' : 'Recent Wins'}
              </CardTitle>
              <Trophy className="w-4 h-4" style={{ color: BRAND.gold }} />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.recentWins.map((win) => (
                  <Link key={win.id} href={`/app/pipeline?opp=${win.id}`}>
                    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer border">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.green}15` }}>
                        <CheckCircle2 className="w-4 h-4" style={{ color: BRAND.green }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate text-sm">{win.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{win.clientName || '—'}</p>
                      </div>
                      {win.estimatedValue && (
                        <span className="font-mono text-sm font-bold shrink-0" style={{ color: BRAND.green }}>
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
          <div />
        )}
      </div>

      {/* Section 6: Post-Delivery KPIs */}
      <PostDeliveryKPIs stats={stats} language={language as 'fr' | 'en'} isLoading={isLoading} />
    </div>
  );
}
