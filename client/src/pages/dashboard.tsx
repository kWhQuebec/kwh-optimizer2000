import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
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
  ArrowRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/lib/i18n";

interface PipelineStats {
  totalPipelineValue: number;
  weightedPipelineValue: number;
  wonValue: number;
  lostValue: number;
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
}

const STAGE_LABELS: Record<string, { fr: string; en: string }> = {
  prospect: { fr: "Prospect", en: "Prospect" },
  qualified: { fr: "Qualifié", en: "Qualified" },
  proposal: { fr: "Proposition", en: "Proposal" },
  design_signed: { fr: "Design signé", en: "Design Signed" },
  negotiation: { fr: "Négociation", en: "Negotiation" },
  won: { fr: "Gagné", en: "Won" },
  lost: { fr: "Perdu", en: "Lost" },
};

const STAGE_COLORS: Record<string, string> = {
  prospect: "bg-slate-400",
  qualified: "bg-blue-400",
  proposal: "bg-purple-400",
  design_signed: "bg-yellow-500",
  negotiation: "bg-orange-400",
  won: "bg-green-500",
  lost: "bg-red-500",
};

function StatCard({ 
  title, 
  value, 
  subtitle,
  icon: Icon, 
  iconBg,
  loading,
  trend 
}: { 
  title: string; 
  value: string | number; 
  subtitle?: string;
  icon: React.ElementType; 
  iconBg?: string;
  loading?: boolean;
  trend?: { value: number; positive: boolean };
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <p className="text-2xl font-bold font-mono" data-testid={`stat-${title.toLowerCase().replace(/\s+/g, '-')}`}>
                  {typeof value === "number" ? value.toLocaleString() : value}
                </p>
                {subtitle && (
                  <p className="text-xs text-muted-foreground">{subtitle}</p>
                )}
              </>
            )}
          </div>
          <div className={`w-10 h-10 rounded-xl ${iconBg || "bg-primary/10"} flex items-center justify-center shrink-0`}>
            <Icon className={`w-5 h-5 ${iconBg ? "text-white" : "text-primary"}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FunnelChart({ data, language }: { data: PipelineStats['stageBreakdown']; language: 'fr' | 'en' }) {
  const activeStages = data.filter(s => s.stage !== 'won' && s.stage !== 'lost');
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
                ${(stage.totalValue / 1000).toFixed(0)}k
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
              ${(value / 1000).toFixed(0)}k
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

export default function DashboardPage() {
  const { t, language } = useI18n();

  const { data: stats, isLoading } = useQuery<PipelineStats>({
    queryKey: ["/api/dashboard/pipeline-stats"],
  });

  const coverageRatio = stats?.weightedPipelineValue 
    ? Math.round((stats.weightedPipelineValue / 100000) * 100) // Assuming 100k as a target
    : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
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

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={language === 'fr' ? 'Pipeline total' : 'Total Pipeline'}
          value={stats?.totalPipelineValue ? `$${(stats.totalPipelineValue / 1000).toFixed(0)}k` : "$0"}
          subtitle={`${stats?.activeOpportunityCount || 0} ${language === 'fr' ? 'opportunités actives' : 'active opportunities'}`}
          icon={TrendingUp}
          loading={isLoading}
        />
        <StatCard
          title={language === 'fr' ? 'Valeur pondérée' : 'Weighted Value'}
          value={stats?.weightedPipelineValue ? `$${(stats.weightedPipelineValue / 1000).toFixed(0)}k` : "$0"}
          subtitle={language === 'fr' ? 'Prévision réaliste' : 'Realistic forecast'}
          icon={Target}
          iconBg="bg-purple-500"
          loading={isLoading}
        />
        <StatCard
          title={language === 'fr' ? 'Gagnées' : 'Won'}
          value={stats?.wonValue ? `$${(stats.wonValue / 1000).toFixed(0)}k` : "$0"}
          subtitle={`${stats?.stageBreakdown.find(s => s.stage === 'won')?.count || 0} ${language === 'fr' ? 'projets' : 'projects'}`}
          icon={Trophy}
          iconBg="bg-green-500"
          loading={isLoading}
        />
        <StatCard
          title={language === 'fr' ? 'À risque' : 'At Risk'}
          value={stats?.atRiskOpportunities.length || 0}
          subtitle={language === 'fr' ? 'Inactives >30 jours' : 'Inactive >30 days'}
          icon={AlertTriangle}
          iconBg={stats?.atRiskOpportunities.length ? "bg-orange-500" : "bg-muted"}
          loading={isLoading}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
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

      <div className="grid lg:grid-cols-2 gap-6">
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
              {language === 'fr' ? 'Opportunités à risque' : 'At-Risk Opportunities'}
              {stats?.atRiskOpportunities && stats.atRiskOpportunities.length > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {stats.atRiskOpportunities.length}
                </Badge>
              )}
            </CardTitle>
            <AlertTriangle className="w-4 h-4 text-orange-500" />
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
            ) : stats?.atRiskOpportunities && stats.atRiskOpportunities.length > 0 ? (
              <div className="divide-y">
                {stats.atRiskOpportunities.map((opp) => (
                  <OpportunityRow
                    key={opp.id}
                    id={opp.id}
                    name={opp.name}
                    clientName={opp.clientName}
                    value={opp.estimatedValue}
                    stage={opp.stage}
                    badge={`${opp.daysSinceUpdate}j`}
                    badgeVariant="destructive"
                    href="/app/pipeline"
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>{language === 'fr' ? 'Aucune opportunité à risque' : 'No at-risk opportunities'}</p>
                <p className="text-xs mt-1 text-green-600">
                  {language === 'fr' ? 'Excellent! Tout est à jour.' : 'Great! Everything is up to date.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
