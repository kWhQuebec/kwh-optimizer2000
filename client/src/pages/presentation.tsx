import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { 
  ArrowLeft, 
  ArrowRight, 
  Maximize2, 
  Minimize2,
  Sun,
  DollarSign,
  TrendingUp,
  Zap,
  Battery,
  Leaf,
  Building2,
  MapPin,
  ChevronLeft,
  Download,
  Loader2,
  Calendar
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  ComposedChart,
  Line
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/lib/i18n";
import type { Site, Client, SimulationRun, CashflowEntry } from "@shared/schema";

interface SiteWithDetails extends Site {
  client: Client;
  simulationRuns: SimulationRun[];
}

const SLIDES = ['hero', 'metrics', 'production', 'cashflow', 'savings', 'summary'] as const;
type SlideType = typeof SLIDES[number];

export default function PresentationPage() {
  const { id } = useParams<{ id: string }>();
  const { language } = useI18n();
  const [currentSlide, setCurrentSlide] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { data: site, isLoading } = useQuery<SiteWithDetails>({
    queryKey: ['/api/sites', id],
    enabled: !!id,
  });

  // Get the best simulation (highest NPV)
  const bestSimulation = site?.simulationRuns?.reduce((best, sim) => {
    if (!best) return sim;
    return (sim.npv25 || 0) > (best.npv25 || 0) ? sim : best;
  }, null as SimulationRun | null);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip navigation if user is focused on interactive elements
      const activeEl = document.activeElement;
      if (activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'BUTTON' || 
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'A' ||
        activeEl.tagName === 'SELECT'
      )) {
        return;
      }
      
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        setCurrentSlide(prev => Math.min(prev + 1, SLIDES.length - 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentSlide(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        }
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Track fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  const nextSlide = () => setCurrentSlide(prev => Math.min(prev + 1, SLIDES.length - 1));
  const prevSlide = () => setCurrentSlide(prev => Math.max(prev - 1, 0));

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!site) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-xl text-muted-foreground">
            {language === 'fr' ? 'Site non trouvé' : 'Site not found'}
          </p>
          <Link href="/app/sites">
            <Button variant="outline">
              <ChevronLeft className="h-4 w-4 mr-2" />
              {language === 'fr' ? 'Retour aux sites' : 'Back to sites'}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const slideContent = SLIDES[currentSlide];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Top Navigation Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <Link href={`/app/sites/${id}`}>
              <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10">
                <ChevronLeft className="h-4 w-4 mr-1" />
                {language === 'fr' ? 'Quitter' : 'Exit'}
              </Button>
            </Link>
            <div className="h-6 w-px bg-white/20" />
            <span className="text-sm text-white/60">
              {language === 'fr' ? 'Mode Présentation' : 'Presentation Mode'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <LanguageToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className="text-white/70 hover:text-white hover:bg-white/10"
              data-testid="button-fullscreen"
            >
              {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="pt-16 pb-24 min-h-screen">
        {slideContent === 'hero' && (
          <HeroSlide site={site} language={language} />
        )}
        {slideContent === 'metrics' && (
          <MetricsSlide site={site} simulation={bestSimulation ?? null} language={language} />
        )}
        {slideContent === 'production' && (
          <ProductionSlide site={site} simulation={bestSimulation ?? null} language={language} />
        )}
        {slideContent === 'cashflow' && (
          <CashflowSlide simulation={bestSimulation ?? null} language={language} />
        )}
        {slideContent === 'savings' && (
          <SavingsSlide simulation={bestSimulation ?? null} language={language} />
        )}
        {slideContent === 'summary' && (
          <SummarySlide site={site} simulation={bestSimulation ?? null} language={language} />
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-sm border-t border-white/10">
        <div className="flex items-center justify-between px-6 py-4">
          <Button
            variant="ghost"
            onClick={prevSlide}
            disabled={currentSlide === 0}
            className="text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30"
            data-testid="button-prev-slide"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            {language === 'fr' ? 'Précédent' : 'Previous'}
          </Button>

          {/* Slide Indicators */}
          <div className="flex items-center gap-2">
            {SLIDES.map((slide, index) => (
              <button
                key={slide}
                onClick={() => setCurrentSlide(index)}
                className={`w-3 h-3 rounded-full transition-all ${
                  index === currentSlide 
                    ? 'bg-primary scale-110' 
                    : 'bg-white/30 hover:bg-white/50'
                }`}
                data-testid={`slide-indicator-${index}`}
              />
            ))}
          </div>

          <Button
            variant="ghost"
            onClick={nextSlide}
            disabled={currentSlide === SLIDES.length - 1}
            className="text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30"
            data-testid="button-next-slide"
          >
            {language === 'fr' ? 'Suivant' : 'Next'}
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Hero Slide - Site Overview
function HeroSlide({ site, language }: { site: SiteWithDetails; language: string }) {
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const hasCoords = site.latitude && site.longitude;
  
  const satelliteImageUrl = hasCoords && googleMapsApiKey
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${site.latitude},${site.longitude}&zoom=18&size=800x500&maptype=satellite&key=${googleMapsApiKey}`
    : null;

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-8">
      <div className="max-w-6xl w-full">
        {/* Client Logo Placeholder */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-2xl">
              <Sun className="h-10 w-10 text-white" />
            </div>
            <div>
              <p className="text-lg text-white/60 uppercase tracking-widest">kWh Québec</p>
              <p className="text-sm text-white/40">
                {language === 'fr' ? 'Analyse Solaire Commerciale' : 'Commercial Solar Analysis'}
              </p>
            </div>
          </div>
        </div>

        {/* Site Info */}
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-7xl font-bold mb-4 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
            {site.client.name}
          </h1>
          <h2 className="text-3xl md:text-4xl font-light text-white/80 mb-6">
            {site.name}
          </h2>
          <div className="flex items-center justify-center gap-2 text-white/60">
            <MapPin className="h-5 w-5" />
            <span className="text-xl">
              {site.address}, {site.city}, {site.province} {site.postalCode}
            </span>
          </div>
        </div>

        {/* Satellite Image */}
        {satelliteImageUrl ? (
          <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 mx-auto max-w-4xl">
            <img 
              src={satelliteImageUrl} 
              alt="Vue satellite" 
              className="w-full h-auto"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <div className="absolute bottom-4 right-4 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1.5">
              <span className="text-sm text-white/80">Google Solar</span>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-12 text-center mx-auto max-w-4xl">
            <Building2 className="h-24 w-24 mx-auto text-white/20 mb-4" />
            <p className="text-white/40">
              {language === 'fr' 
                ? 'Image satellite en cours de chargement...' 
                : 'Satellite image loading...'}
            </p>
          </div>
        )}

        {/* Building Info Tags */}
        <div className="flex items-center justify-center gap-4 mt-8">
          {site.buildingType && (
            <Badge variant="secondary" className="bg-white/10 text-white border-0 text-lg px-4 py-2">
              <Building2 className="h-4 w-4 mr-2" />
              {site.buildingType === 'industrial' 
                ? (language === 'fr' ? 'Industriel' : 'Industrial')
                : site.buildingType === 'commercial'
                ? (language === 'fr' ? 'Commercial' : 'Commercial')
                : site.buildingType}
            </Badge>
          )}
          {site.roofAreaAutoSqM && (
            <Badge variant="secondary" className="bg-white/10 text-white border-0 text-lg px-4 py-2">
              <Sun className="h-4 w-4 mr-2" />
              {Math.round(site.roofAreaAutoSqM).toLocaleString()} m²
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

// Metrics Slide - Key Financial Indicators
function MetricsSlide({ 
  site, 
  simulation, 
  language 
}: { 
  site: SiteWithDetails; 
  simulation: SimulationRun | null; 
  language: string 
}) {
  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M$`;
    }
    return `${Math.round(value).toLocaleString()}$`;
  };

  const metrics = [
    {
      icon: DollarSign,
      label: language === 'fr' ? 'Valeur Actuelle Nette (25 ans)' : 'Net Present Value (25 years)',
      value: simulation?.npv25 ? formatCurrency(simulation.npv25) : '--',
      sublabel: language === 'fr' ? 'Profit total actualisé' : 'Total discounted profit',
      color: 'from-green-400 to-emerald-500'
    },
    {
      icon: TrendingUp,
      label: language === 'fr' ? 'Taux de Rendement Interne' : 'Internal Rate of Return',
      value: simulation?.irr25 ? `${(simulation.irr25 * 100).toFixed(1)}%` : '--',
      sublabel: language === 'fr' ? 'Rendement annuel moyen' : 'Average annual return',
      color: 'from-blue-400 to-indigo-500'
    },
    {
      icon: Calendar,
      label: language === 'fr' ? 'Retour sur Investissement' : 'Payback Period',
      value: simulation?.simplePaybackYears ? `${simulation.simplePaybackYears.toFixed(1)} ${language === 'fr' ? 'ans' : 'years'}` : '--',
      sublabel: language === 'fr' ? 'Temps de récupération' : 'Time to recoup investment',
      color: 'from-amber-400 to-orange-500'
    },
    {
      icon: Zap,
      label: language === 'fr' ? 'Économies Annuelles' : 'Annual Savings',
      value: simulation?.savingsYear1 ? formatCurrency(simulation.savingsYear1) : '--',
      sublabel: language === 'fr' ? 'Première année' : 'First year',
      color: 'from-purple-400 to-pink-500'
    }
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-8">
      <div className="max-w-7xl w-full">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            {language === 'fr' ? 'Indicateurs Financiers Clés' : 'Key Financial Indicators'}
          </h2>
          <p className="text-xl text-white/60">
            {simulation?.pvSizeKW && (
              <>
                {language === 'fr' ? 'Système recommandé: ' : 'Recommended system: '}
                <span className="text-white font-semibold">{simulation.pvSizeKW.toFixed(0)} kW</span>
                {simulation.battEnergyKWh && simulation.battEnergyKWh > 0 && (
                  <> + <span className="text-white font-semibold">{simulation.battEnergyKWh.toFixed(0)} kWh</span> {language === 'fr' ? 'batterie' : 'battery'}</>
                )}
              </>
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {metrics.map((metric, index) => (
            <Card 
              key={index} 
              className="bg-white/5 border-white/10 overflow-hidden"
            >
              <CardContent className="p-8">
                <div className="flex items-start gap-6">
                  <div className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${metric.color} flex items-center justify-center shrink-0`}>
                    <metric.icon className="h-8 w-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white/60 text-lg mb-2">{metric.label}</p>
                    <p className="text-5xl font-bold text-white mb-2">{metric.value}</p>
                    <p className="text-white/40 text-sm">{metric.sublabel}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {!simulation && (
          <div className="text-center mt-8 p-6 bg-white/5 rounded-xl border border-white/10">
            <p className="text-white/60">
              {language === 'fr' 
                ? 'Aucune simulation disponible. Lancez une analyse pour voir les projections financières.'
                : 'No simulation available. Run an analysis to see financial projections.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Production Slide - Monthly Production Chart
function ProductionSlide({ 
  site, 
  simulation, 
  language 
}: { 
  site: SiteWithDetails; 
  simulation: SimulationRun | null; 
  language: string 
}) {
  // Generate monthly production data from annual estimate
  const annualProductionKWh = simulation?.totalProductionKWh || 0;
  
  // Typical Quebec solar distribution by month (normalized)
  const monthlyDistribution = [0.04, 0.05, 0.08, 0.10, 0.12, 0.12, 0.13, 0.11, 0.09, 0.07, 0.05, 0.04];
  
  const months = language === 'fr' 
    ? ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
    : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const chartData = months.map((month, index) => ({
    month,
    production: Math.round(annualProductionKWh * monthlyDistribution[index])
  }));

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-8">
      <div className="max-w-6xl w-full">
        <div className="text-center mb-8">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            {language === 'fr' ? 'Production Solaire Estimée' : 'Estimated Solar Production'}
          </h2>
          <div className="flex items-center justify-center gap-8 text-white/60">
            <div className="flex items-center gap-2">
              <Sun className="h-5 w-5 text-amber-400" />
              <span className="text-xl">
                {annualProductionKWh > 0 
                  ? `${Math.round(annualProductionKWh).toLocaleString()} kWh/${language === 'fr' ? 'an' : 'year'}`
                  : '--'}
              </span>
            </div>
            {simulation?.selfSufficiencyPercent && (
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-green-400" />
                <span className="text-xl">
                  {simulation.selfSufficiencyPercent.toFixed(0)}% {language === 'fr' ? 'autosuffisance' : 'self-sufficiency'}
                </span>
              </div>
            )}
          </div>
        </div>

        {annualProductionKWh > 0 ? (
          <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis 
                  dataKey="month" 
                  stroke="rgba(255,255,255,0.5)"
                  tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 14 }}
                />
                <YAxis 
                  stroke="rgba(255,255,255,0.5)"
                  tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 14 }}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(0,0,0,0.8)', 
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px'
                  }}
                  labelStyle={{ color: 'white' }}
                  formatter={(value: number) => [`${value.toLocaleString()} kWh`, language === 'fr' ? 'Production' : 'Production']}
                />
                <Bar 
                  dataKey="production" 
                  fill="url(#productionGradient)" 
                  radius={[4, 4, 0, 0]}
                />
                <defs>
                  <linearGradient id="productionGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fbbf24" />
                    <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
          </div>
        ) : (
          <div className="bg-white/5 rounded-2xl border border-white/10 p-12 text-center">
            <Sun className="h-16 w-16 mx-auto mb-4 text-white/20" />
            <p className="text-white/60 text-xl">
              {language === 'fr' 
                ? 'Aucune simulation disponible. Lancez une analyse pour voir les projections de production.'
                : 'No simulation available. Run an analysis to see production projections.'}
            </p>
          </div>
        )}

        {simulation?.pvSizeKW && (
          <div className="grid grid-cols-3 gap-6 mt-8">
            <div className="bg-white/5 rounded-xl border border-white/10 p-6 text-center">
              <Sun className="h-8 w-8 mx-auto mb-2 text-amber-400" />
              <p className="text-3xl font-bold text-white">{simulation.pvSizeKW.toFixed(0)} kW</p>
              <p className="text-white/60">{language === 'fr' ? 'Puissance installée' : 'Installed capacity'}</p>
            </div>
            {simulation.battEnergyKWh && simulation.battEnergyKWh > 0 && (
              <div className="bg-white/5 rounded-xl border border-white/10 p-6 text-center">
                <Battery className="h-8 w-8 mx-auto mb-2 text-blue-400" />
                <p className="text-3xl font-bold text-white">{simulation.battEnergyKWh.toFixed(0)} kWh</p>
                <p className="text-white/60">{language === 'fr' ? 'Stockage batterie' : 'Battery storage'}</p>
              </div>
            )}
            <div className="bg-white/5 rounded-xl border border-white/10 p-6 text-center">
              <Leaf className="h-8 w-8 mx-auto mb-2 text-green-400" />
              <p className="text-3xl font-bold text-white">
                {simulation.co2AvoidedTonnesPerYear 
                  ? `${simulation.co2AvoidedTonnesPerYear.toFixed(0)} t`
                  : '--'}
              </p>
              <p className="text-white/60">CO₂ {language === 'fr' ? 'évité/an' : 'avoided/year'}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Cashflow Slide - 25-year projection
function CashflowSlide({ 
  simulation, 
  language 
}: { 
  simulation: SimulationRun | null; 
  language: string 
}) {
  const cashflowData = simulation?.cashflows as CashflowEntry[] | undefined;
  
  const chartData = cashflowData?.map((entry, index) => ({
    year: entry.year || index + 1,
    cumulative: entry.cumulative,
    annual: entry.netCashflow
  })) || [];

  // Find break-even year
  const breakEvenYear = chartData.find(d => d.cumulative >= 0)?.year;

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-8">
      <div className="max-w-6xl w-full">
        <div className="text-center mb-8">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            {language === 'fr' ? 'Flux de Trésorerie sur 25 ans' : '25-Year Cash Flow'}
          </h2>
          {breakEvenYear && (
            <p className="text-xl text-white/60">
              {language === 'fr' ? 'Seuil de rentabilité atteint en année ' : 'Break-even reached in year '}
              <span className="text-green-400 font-semibold">{breakEvenYear}</span>
            </p>
          )}
        </div>

        {chartData.length > 0 ? (
          <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis 
                  dataKey="year" 
                  stroke="rgba(255,255,255,0.5)"
                  tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                  label={{ 
                    value: language === 'fr' ? 'Année' : 'Year', 
                    position: 'bottom', 
                    fill: 'rgba(255,255,255,0.5)' 
                  }}
                />
                <YAxis 
                  stroke="rgba(255,255,255,0.5)"
                  tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k$`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(0,0,0,0.8)', 
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px'
                  }}
                  labelStyle={{ color: 'white' }}
                  formatter={(value: number, name: string) => [
                    `${Math.round(value).toLocaleString()}$`, 
                    name === 'cumulative' 
                      ? (language === 'fr' ? 'Cumulatif' : 'Cumulative')
                      : (language === 'fr' ? 'Annuel' : 'Annual')
                  ]}
                />
                <Legend 
                  wrapperStyle={{ color: 'rgba(255,255,255,0.7)' }}
                  formatter={(value) => value === 'cumulative' 
                    ? (language === 'fr' ? 'Cash-flow cumulatif' : 'Cumulative cash flow')
                    : (language === 'fr' ? 'Cash-flow annuel' : 'Annual cash flow')}
                />
                <Bar 
                  dataKey="annual" 
                  fill="rgba(59, 130, 246, 0.5)" 
                  radius={[2, 2, 0, 0]}
                />
                <Line 
                  type="monotone" 
                  dataKey="cumulative" 
                  stroke="#22c55e" 
                  strokeWidth={3}
                  dot={false}
                />
                {/* Zero line */}
                <Line 
                  type="monotone" 
                  dataKey={() => 0} 
                  stroke="rgba(255,255,255,0.3)" 
                  strokeDasharray="5 5"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="bg-white/5 rounded-2xl border border-white/10 p-12 text-center">
            <p className="text-white/60">
              {language === 'fr' 
                ? 'Données de cash-flow non disponibles. Lancez une simulation complète.'
                : 'Cash flow data not available. Run a complete simulation.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Savings Slide - Cost comparison
function SavingsSlide({ 
  simulation, 
  language 
}: { 
  simulation: SimulationRun | null; 
  language: string 
}) {
  const year1Savings = simulation?.savingsYear1 || 0;
  const totalSavings25 = simulation?.npv25 || 0;
  const capexNet = simulation?.capexNet || 0;

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-8">
      <div className="max-w-5xl w-full">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            {language === 'fr' ? 'Économies Projetées' : 'Projected Savings'}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Investment */}
          <Card className="bg-gradient-to-br from-slate-700/50 to-slate-800/50 border-white/10">
            <CardContent className="p-8 text-center">
              <div className="h-16 w-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
                <DollarSign className="h-8 w-8 text-white/70" />
              </div>
              <p className="text-white/60 text-lg mb-2">
                {language === 'fr' ? 'Investissement Net' : 'Net Investment'}
              </p>
              <p className="text-4xl font-bold text-white">
                {capexNet > 0 ? `${Math.round(capexNet).toLocaleString()}$` : '--'}
              </p>
              <p className="text-white/40 text-sm mt-2">
                {language === 'fr' ? 'Après incitatifs' : 'After incentives'}
              </p>
            </CardContent>
          </Card>

          {/* Annual Savings */}
          <Card className="bg-gradient-to-br from-green-600/30 to-emerald-700/30 border-green-500/30">
            <CardContent className="p-8 text-center">
              <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="h-8 w-8 text-green-400" />
              </div>
              <p className="text-white/60 text-lg mb-2">
                {language === 'fr' ? 'Économies Année 1' : 'Year 1 Savings'}
              </p>
              <p className="text-4xl font-bold text-green-400">
                {year1Savings > 0 ? `${Math.round(year1Savings).toLocaleString()}$` : '--'}
              </p>
              <p className="text-white/40 text-sm mt-2">
                {language === 'fr' ? 'Première année' : 'First year'}
              </p>
            </CardContent>
          </Card>

          {/* 25-year Value */}
          <Card className="bg-gradient-to-br from-amber-600/30 to-orange-700/30 border-amber-500/30">
            <CardContent className="p-8 text-center">
              <div className="h-16 w-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                <Zap className="h-8 w-8 text-amber-400" />
              </div>
              <p className="text-white/60 text-lg mb-2">
                {language === 'fr' ? 'Valeur Totale (25 ans)' : 'Total Value (25 years)'}
              </p>
              <p className="text-4xl font-bold text-amber-400">
                {totalSavings25 !== 0 
                  ? `${(totalSavings25 / 1000000).toFixed(1)}M$`
                  : '--'}
              </p>
              <p className="text-white/40 text-sm mt-2">
                {language === 'fr' ? 'Valeur actuelle nette' : 'Net present value'}
              </p>
            </CardContent>
          </Card>
        </div>

        {simulation?.irr25 && (
          <div className="mt-12 text-center">
            <div className="inline-block bg-white/5 rounded-2xl border border-white/10 px-12 py-8">
              <p className="text-white/60 text-xl mb-2">
                {language === 'fr' ? 'Taux de Rendement Interne' : 'Internal Rate of Return'}
              </p>
              <p className="text-6xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                {(simulation.irr25 * 100).toFixed(1)}%
              </p>
              <p className="text-white/40 mt-2">
                {language === 'fr' 
                  ? 'Bien supérieur aux placements traditionnels'
                  : 'Well above traditional investments'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Summary Slide - Call to Action
function SummarySlide({ 
  site, 
  simulation, 
  language 
}: { 
  site: SiteWithDetails; 
  simulation: SimulationRun | null; 
  language: string 
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-8">
      <div className="max-w-4xl w-full text-center">
        <div className="mb-12">
          <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-8 shadow-2xl">
            <Sun className="h-12 w-12 text-white" />
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            {language === 'fr' ? 'Prochaines Étapes' : 'Next Steps'}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white/5 rounded-xl border border-white/10 p-6">
            <div className="h-12 w-12 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-blue-400">1</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {language === 'fr' ? 'Données Énergétiques' : 'Energy Data'}
            </h3>
            <p className="text-white/60">
              {language === 'fr' 
                ? 'Fournir les données de consommation Hydro-Québec pour une analyse précise'
                : 'Provide Hydro-Québec consumption data for accurate analysis'}
            </p>
          </div>

          <div className="bg-white/5 rounded-xl border border-white/10 p-6">
            <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-green-400">2</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {language === 'fr' ? 'Visite Technique' : 'Technical Visit'}
            </h3>
            <p className="text-white/60">
              {language === 'fr' 
                ? 'Évaluation structurelle et électrique du site'
                : 'Structural and electrical site assessment'}
            </p>
          </div>

          <div className="bg-white/5 rounded-xl border border-white/10 p-6">
            <div className="h-12 w-12 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-amber-400">3</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {language === 'fr' ? 'Proposition Finale' : 'Final Proposal'}
            </h3>
            <p className="text-white/60">
              {language === 'fr' 
                ? 'Conception détaillée et offre de prix clé en main'
                : 'Detailed design and turnkey price offer'}
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-primary/20 to-primary/10 rounded-2xl border border-primary/30 p-8">
          <h3 className="text-2xl font-bold mb-4">
            {language === 'fr' ? 'kWh Québec' : 'kWh Quebec'}
          </h3>
          <p className="text-white/80 text-lg mb-6">
            {language === 'fr' 
              ? 'Votre partenaire pour la transition énergétique commerciale au Québec'
              : 'Your partner for commercial energy transition in Quebec'}
          </p>
          <div className="flex items-center justify-center gap-8 text-white/60">
            <span>info@kwhquebec.com</span>
            <span>•</span>
            <span>kwhquebec.com</span>
          </div>
        </div>
      </div>
    </div>
  );
}
