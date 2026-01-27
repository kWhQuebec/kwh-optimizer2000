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
  UserPlus
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

const STAGE_LABELS: Record<string, { fr: string; en: string }> = {
  prospect: { fr: "Prospect", en: "Prospect" },
  qualified: { fr: "Qualifié", en: "Qualified" },
  proposal: { fr: "Proposition", en: "Proposal" },
  design_signed: { fr: "Design signé", en: "Design Signed" },
  negotiation: { fr: "Négociation", en: "Negotiation" },
  won_to_be_delivered: { fr: "Gagné - À livrer", en: "Won - To be Delivered" },
  won_in_construction: { fr: "Gagné - En construction", en: "Won - In Construction" },
  won_delivered: { fr: "Gagné - Livré", en: "Won - Delivered" },
  lost: { fr: "Perdu", en: "Lost" },
};

const STAGE_COLORS: Record<string, string> = {
  prospect: "bg-slate-400",
  qualified: "bg-blue-400",
  proposal: "bg-purple-400",
  design_signed: "bg-yellow-500",
  negotiation: "bg-orange-400",
  won_to_be_delivered: "bg-emerald-400",
  won_in_construction: "bg-green-500",
  won_delivered: "bg-green-700",
  lost: "bg-red-500",
};

const WON_STAGES = ['won_to_be_delivered', 'won_in_construction', 'won_delivered'];
const isWonStage = (stage: string) => WON_STAGES.includes(stage);

const STAGE_BAR_COLORS: Record<string, string> = {
  prospect: "#64748b",
  qualified: "#3b82f6",
  proposal: "#a855f7",
  design_signed: "#eab308",
  negotiation: "#f97316",
  won_to_be_delivered: "#34d399",
  won_in_construction: "#22c55e",
  won_delivered: "#15803d",
  lost: "#ef4444",
};

// Format currency compactly: k for < 1M, M for >= 1M
function formatCompactCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return "$0";
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  return `$${(value / 1000).toFixed(0)}k`;
}

function StatCard({ 
  title, 
  value, 
  subtitle,
  icon: Icon, 
  iconBg,
  loading,
  trend,
  onClick
}: { 
  title: string; 
  value: string | number; 
  subtitle?: string;
  icon: React.ElementType; 
  iconBg?: string;
  loading?: boolean;
  trend?: { value: number; positive: boolean };
  onClick?: () => void;
}) {
  return (
    <Card className={onClick ? "hover-elevate cursor-pointer" : ""} onClick={onClick}>
      <CardContent className="p-4 md:p-6">
        <div className="flex items-start justify-between gap-3 md:gap-4">
          <div className="space-y-1">
            <p className="text-xs md:text-sm text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="h-7 md:h-8 w-20 md:w-24" />
            ) : (
              <>
                <p className="text-xl md:text-2xl font-bold font-mono" data-testid={`stat-${title.toLowerCase().replace(/\s+/g, '-')}`}>
                  {typeof value === "number" ? value.toLocaleString() : value}
                </p>
                {subtitle && (
                  <p className="text-xs text-muted-foreground">{subtitle}</p>
                )}
              </>
            )}
          </div>
          <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl ${iconBg || "bg-primary/10"} flex items-center justify-center shrink-0`}>
            <Icon className={`w-4 h-4 md:w-5 md:h-5 ${iconBg ? "text-white" : "text-primary"}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FunnelChart({ data, language }: { data: PipelineStats['stageBreakdown']; language: 'fr' | 'en' }) {
  const activeStages = data.filter(s => !isWonStage(s.stage) && s.stage !== 'lost');
  const maxValue = Math.max(...activeStages.map(s => s.totalValue), 1);
  
  return (
    <div className="space-y-3">
      {activeStages.map((stage, index) => {
        const widthPercent = maxValue > 0 ? Math.max((stage.totalValue / maxValue) * 100, 15) : 15;
        return (
          <div key={stage.stage} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-sm ${STAGE_COLORS[stage.stage]}`} />
                <span className="font-medium">{STAGE_LABELS[stage.stage][language]}</span>
                <Badge variant="secondary" className="text-xs">{stage.count}</Badge>
              </div>
              <span className="font-mono text-muted-foreground">
                {formatCompactCurrency(stage.totalValue)}
              </span>
            </div>
            <div className="relative h-6 bg-muted/50 rounded overflow-hidden">
              <div 
                className={`absolute left-0 top-0 h-full ${STAGE_COLORS[stage.stage]} transition-all duration-500 rounded`}
                style={{ width: `${widthPercent}%` }}
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
      <div className="flex items-center gap-3 py-3 hover-elevate rounded-lg px-2 -mx-2 cursor-pointer">
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
              {STAGE_LABELS[stage]?.[language] || stage}
            </Badge>
          )}
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    </Link>
  );
}

function QuickStartCard({ language, onDismiss }: { language: 'fr' | 'en'; onDismiss: () => void }) {
  const steps = [
    {
      icon: UserPlus,
      title: language === 'fr' ? '0. Nouvelle opportunité' : '0. New Opportunity',
      description: language === 'fr' 
        ? 'Capturez un nouveau prospect (appel, email, référence)' 
        : 'Capture a new lead (call, email, referral)',
      href: '/app/pipeline',
      action: language === 'fr' ? 'Voir le pipeline' : 'View Pipeline'
    },
    {
      icon: Building2,
      title: language === 'fr' ? '1. Créer un site' : '1. Create a Site',
      description: language === 'fr' 
        ? 'Ajoutez un nouveau bâtiment à analyser' 
        : 'Add a new building to analyze',
      href: '/app/sites',
      action: language === 'fr' ? 'Voir les sites' : 'View Sites'
    },
    {
      icon: Upload,
      title: language === 'fr' ? '2. Importer les données' : '2. Import Data',
      description: language === 'fr' 
        ? 'Téléversez les fichiers CSV d\'Hydro-Québec' 
        : 'Upload Hydro-Québec CSV files',
      href: '/app/sites',
      action: null
    },
    {
      icon: Play,
      title: language === 'fr' ? '3. Lancer l\'analyse' : '3. Run Analysis',
      description: language === 'fr' 
        ? 'Calculez le potentiel solaire et les économies' 
        : 'Calculate solar potential and savings',
      href: null,
      action: null
    },
    {
      icon: FileCheck,
      title: language === 'fr' ? '4. Générer la proposition' : '4. Generate Proposal',
      description: language === 'fr' 
        ? 'Créez un devis professionnel pour votre client' 
        : 'Create a professional quote for your client',
      href: null,
      action: null
    }
  ];

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">
              {language === 'fr' ? 'Démarrage rapide' : 'Quick Start'}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {language === 'fr' ? 'Suivez ces étapes pour créer votre première analyse solaire' : 'Follow these steps to create your first solar analysis'}
            </p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="shrink-0" 
          onClick={onDismiss}
          title={language === 'fr' ? 'Masquer' : 'Dismiss'}
        >
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {steps.map((step, index) => (
            <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-background/50">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <step.icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm">{step.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                {step.href && step.action && (
                  <Link href={step.href} className="inline-flex items-center text-xs text-primary hover:underline mt-1">
                    {step.action}
                    <ArrowRight className="w-3 h-3 ml-1" />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function WeightedVsActualChart({ stageBreakdown, language }: { stageBreakdown: PipelineStats['stageBreakdown']; language: 'fr' | 'en' }) {
  const activeStages = ['prospect', 'qualified', 'proposal', 'design_signed', 'negotiation'];
  const data = stageBreakdown
    .filter(s => activeStages.includes(s.stage))
    .map(item => ({
      stage: item.stage,
      name: STAGE_LABELS[item.stage]?.[language] || item.stage,
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

export default function DashboardPage() {
  const { t, language } = useI18n();
  const [, setLocation] = useLocation();
  const [showQuickStart, setShowQuickStart] = useState(() => {
    // Check localStorage for dismissed state
    if (typeof window !== 'undefined') {
      return localStorage.getItem('kwhq_quickstart_dismissed') !== 'true';
    }
    return true;
  });

  const { data: stats, isLoading } = useQuery<PipelineStats>({
    queryKey: ["/api/dashboard/pipeline-stats"],
  });

  const coverageRatio = stats?.weightedPipelineValue 
    ? Math.round((stats.weightedPipelineValue / 100000) * 100) // Assuming 100k as a target
    : 0;

  const handleDismissQuickStart = () => {
    setShowQuickStart(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('kwhq_quickstart_dismissed', 'true');
    }
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 md:gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-dashboard-title">
            {language === 'fr' ? 'Tableau de bord' : 'Dashboard'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {language === 'fr' ? 'Vue d\'ensemble du pipeline de ventes' : 'Sales pipeline overview'}
          </p>
        </div>
        <Link href="/app/pipeline">
          <Button data-testid="button-view-pipeline">
            <BarChart3 className="w-4 h-4 mr-2" />
            {language === 'fr' ? 'Voir le pipeline' : 'View Pipeline'}
          </Button>
        </Link>
      </div>

      {/* Quick Start Guide for new users */}
      {showQuickStart && (
        <QuickStartCard 
          language={language as 'fr' | 'en'} 
          onDismiss={handleDismissQuickStart} 
        />
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          title={language === 'fr' ? 'Nouveaux prospects' : 'New Prospects'}
          value={stats?.stageBreakdown?.find(s => s.stage === 'prospect')?.count || 0}
          subtitle={language === 'fr' ? 'À contacter' : 'To follow up'}
          icon={UserPlus}
          iconBg={(stats?.stageBreakdown?.find(s => s.stage === 'prospect')?.count || 0) > 0 ? "bg-yellow-500" : "bg-slate-400"}
          loading={isLoading}
          onClick={() => setLocation("/app/pipeline?stage=prospect")}
        />
        <StatCard
          title={language === 'fr' ? 'Pipeline actif' : 'Active Pipeline'}
          value={formatCompactCurrency(stats?.totalPipelineValue)}
          subtitle={`${stats?.activeOpportunityCount || 0} ${language === 'fr' ? 'opportunités' : 'opportunities'}`}
          icon={TrendingUp}
          loading={isLoading}
        />
        <StatCard
          title={language === 'fr' ? 'Valeur pondérée' : 'Weighted Value'}
          value={formatCompactCurrency(stats?.weightedPipelineValue)}
          subtitle={language === 'fr' ? 'Prévision réaliste' : 'Realistic forecast'}
          icon={Target}
          iconBg="bg-purple-500"
          loading={isLoading}
        />
        <StatCard
          title={language === 'fr' ? 'Carnet de livraison' : 'Delivery Backlog'}
          value={formatCompactCurrency(stats?.deliveryBacklogValue)}
          subtitle={`${stats?.deliveryBacklogCount || 0} ${language === 'fr' ? 'projets en cours' : 'projects in progress'}`}
          icon={Package}
          iconBg="bg-blue-500"
          loading={isLoading}
        />
        <StatCard
          title={language === 'fr' ? 'Livrés' : 'Delivered'}
          value={formatCompactCurrency(stats?.deliveredValue)}
          subtitle={`${stats?.deliveredCount || 0} ${language === 'fr' ? 'projets complétés' : 'completed projects'}`}
          icon={CheckCircle2}
          iconBg="bg-green-600"
          loading={isLoading}
        />
        <StatCard
          title={language === 'fr' ? 'Total gagné' : 'Total Won'}
          value={formatCompactCurrency(stats?.wonValue)}
          subtitle={language === 'fr' ? 'Toutes phases confondues' : 'All phases combined'}
          icon={Trophy}
          iconBg="bg-green-500"
          loading={isLoading}
        />
        <StatCard
          title={language === 'fr' ? 'Tâches' : 'Tasks'}
          value={stats?.pendingTasksCount?.total || 0}
          subtitle={language === 'fr' ? 'À compléter' : 'To complete'}
          icon={ClipboardList}
          iconBg={stats?.pendingTasksCount?.total ? "bg-orange-500" : "bg-green-500"}
          loading={isLoading}
        />
      </div>

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
              {language === 'fr' ? 'Gains récents' : 'Recent Wins'}
            </CardTitle>
            <Trophy className="w-4 h-4 text-green-500" />
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
                <p className="text-xs mt-1">
                  {language === 'fr' ? 'Continuez à travailler le pipeline!' : 'Keep working the pipeline!'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 md:gap-6">
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              {language === 'fr' ? 'Tâches à faire' : 'To-Do List'}
              {stats?.pendingTasksCount && stats.pendingTasksCount.total > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {stats.pendingTasksCount.total}
                </Badge>
              )}
            </CardTitle>
            <ClipboardList className="w-4 h-4 text-primary" />
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
            ) : stats?.pendingTasks && stats.pendingTasks.length > 0 ? (
              <div className="space-y-3">
                {stats.pendingTasks.map((task) => (
                  <Link key={task.id} href={`/app/sites/${task.siteId}`}>
                    <div className="flex items-center gap-3 p-2 rounded-lg hover-elevate cursor-pointer" data-testid={`task-item-${task.siteId}`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        task.taskType === 'roof_drawing' ? 'bg-orange-100 dark:bg-orange-950' : 'bg-blue-100 dark:bg-blue-950'
                      }`}>
                        {task.taskType === 'roof_drawing' ? (
                          <Grid3X3 className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                        ) : (
                          <Play className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{task.siteName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {task.taskType === 'roof_drawing' 
                            ? (language === 'fr' ? 'Toit à dessiner' : 'Roof Drawing')
                            : (language === 'fr' ? 'Analyse à lancer' : 'Run Analysis')
                          }
                        </p>
                      </div>
                      {task.priority === 'urgent' && (
                        <Badge variant="destructive" className="text-xs shrink-0">
                          {language === 'fr' ? 'Urgent' : 'Urgent'}
                        </Badge>
                      )}
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </div>
                  </Link>
                ))}
                <Link href="/app/work-queue">
                  <Button variant="outline" size="sm" className="w-full mt-2 gap-2" data-testid="button-view-all-tasks">
                    {language === 'fr' ? 'Voir toutes les tâches' : 'View all tasks'}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p>{language === 'fr' ? 'Aucune tâche en attente' : 'No pending tasks'}</p>
                <p className="text-xs mt-1 text-green-600">
                  {language === 'fr' ? 'Excellent! Tout est complété.' : 'Great! Everything is complete.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
          <div>
            <CardTitle className="text-lg">
              {language === 'fr' ? 'Pipeline par étape' : 'Pipeline by Stage'}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {language === 'fr' 
                ? 'Comparaison valeur totale et pondérée par étape' 
                : 'Compare total and weighted value by stage'}
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
  );
}
