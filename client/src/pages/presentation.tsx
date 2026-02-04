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

// kWh Québec logo assets - bilingual
import logoFr from "@assets/kWh_Quebec_Logo-01_-_Rectangulaire_1764799021536.png";
import logoEn from "@assets/kWh_Quebec_Logo-02_-_Rectangle_1764799021536.png";

// kWh Québec Brand Colors
const BRAND_COLORS = {
  primaryBlue: '#003DA6',
  accentGold: '#FFB005',
  darkBlue: '#002B75',
};
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

  // Get the most recent simulation (for presentation purposes)
  // Sort by createdAt descending and take the first one
  const bestSimulation = site?.simulationRuns?.length 
    ? [...site.simulationRuns].sort((a, b) => 
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      )[0]
    : null;

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

  // Select logo based on language
  const currentLogo = language === 'fr' ? logoFr : logoEn;

  return (
    <div 
      className="min-h-screen text-white font-['Montserrat',sans-serif]"
      style={{ 
        background: `linear-gradient(135deg, ${BRAND_COLORS.primaryBlue} 0%, ${BRAND_COLORS.darkBlue} 100%)`
      }}
    >
      {/* Top Navigation Bar with kWh Québec Logo */}
      <div 
        className="fixed top-0 left-0 right-0 z-50 backdrop-blur-sm border-b border-white/10"
        style={{ backgroundColor: 'rgba(0, 43, 117, 0.8)' }}
      >
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            {/* kWh Québec Logo - inverted for dark background */}
            <img 
              src={currentLogo} 
              alt="kWh Québec" 
              className="h-10 w-auto"
              style={{ filter: 'brightness(0) invert(1)' }}
              data-testid="logo-kwh-quebec"
            />
            <div className="h-8 w-px bg-white/20" />
            <Link href={`/app/sites/${id}`}>
              <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10">
                <ChevronLeft className="h-4 w-4 mr-1" />
                {language === 'fr' ? 'Quitter' : 'Exit'}
              </Button>
            </Link>
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

      {/* Bottom Navigation with kWh Québec Branding */}
      <div 
        className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur-sm border-t border-white/10"
        style={{ backgroundColor: 'rgba(0, 43, 117, 0.8)' }}
      >
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

          {/* Slide Indicators with Gold Accent */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              {SLIDES.map((slide, index) => (
                <button
                  key={slide}
                  onClick={() => setCurrentSlide(index)}
                  className="w-3 h-3 rounded-full transition-all"
                  style={{ 
                    backgroundColor: index === currentSlide ? BRAND_COLORS.accentGold : 'rgba(255,255,255,0.3)',
                    transform: index === currentSlide ? 'scale(1.1)' : 'scale(1)'
                  }}
                  data-testid={`slide-indicator-${index}`}
                />
              ))}
            </div>
            {/* kWh Québec footer text */}
            <span className="text-xs text-white/50">
              {language === 'fr' ? 'Propulsé par' : 'Powered by'} kWh Québec
            </span>
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
        {/* Analysis Type Badge with Gold Accent */}
        <div className="flex items-center justify-center mb-8">
          <div 
            className="px-6 py-3 rounded-full flex items-center gap-3 shadow-2xl"
            style={{ backgroundColor: BRAND_COLORS.accentGold }}
          >
            <Sun className="h-6 w-6 text-white" />
            <span className="text-white font-semibold text-lg uppercase tracking-wider">
              {language === 'fr' ? 'Analyse Solaire Commerciale' : 'Commercial Solar Analysis'}
            </span>
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
              {[site.address, site.city, site.postalCode].filter(Boolean).join(", ")}
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

        {/* Building Info Tags with Gold Border */}
        <div className="flex items-center justify-center gap-4 mt-8">
          {site.buildingType && (
            <Badge 
              variant="secondary" 
              className="text-white text-lg px-4 py-2"
              style={{ backgroundColor: 'rgba(255,176,5,0.2)', borderColor: BRAND_COLORS.accentGold, borderWidth: 1 }}
            >
              <Building2 className="h-4 w-4 mr-2" style={{ color: BRAND_COLORS.accentGold }} />
              {site.buildingType === 'industrial' 
                ? (language === 'fr' ? 'Industriel' : 'Industrial')
                : site.buildingType === 'commercial'
                ? (language === 'fr' ? 'Commercial' : 'Commercial')
                : site.buildingType}
            </Badge>
          )}
          {site.roofAreaAutoSqM && (
            <Badge 
              variant="secondary" 
              className="text-white text-lg px-4 py-2"
              style={{ backgroundColor: 'rgba(255,176,5,0.2)', borderColor: BRAND_COLORS.accentGold, borderWidth: 1 }}
            >
              <Sun className="h-4 w-4 mr-2" style={{ color: BRAND_COLORS.accentGold }} />
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

  // kWh Québec branded metrics - using gold accent for icons
  const metrics = [
    {
      icon: DollarSign,
      label: language === 'fr' ? 'VAN @7% (25 ans)' : 'NPV @7% (25 years)',
      value: simulation?.npv25 ? formatCurrency(simulation.npv25) : '--',
      sublabel: language === 'fr' ? 'Valeur actuelle nette' : 'Net present value',
    },
    {
      icon: TrendingUp,
      label: language === 'fr' ? 'Taux de Rendement Interne' : 'Internal Rate of Return',
      value: simulation?.irr25 ? `${(simulation.irr25 * 100).toFixed(1)}%` : '--',
      sublabel: language === 'fr' ? 'Rendement annuel moyen' : 'Average annual return',
    },
    {
      icon: Calendar,
      label: language === 'fr' ? 'Retour sur Investissement' : 'Payback Period',
      value: simulation?.simplePaybackYears ? `${simulation.simplePaybackYears.toFixed(1)} ${language === 'fr' ? 'ans' : 'years'}` : '--',
      sublabel: language === 'fr' ? 'Temps de récupération' : 'Time to recoup investment',
    },
    {
      icon: Zap,
      label: language === 'fr' ? 'Économies Annuelles' : 'Annual Savings',
      value: simulation?.savingsYear1 ? formatCurrency(simulation.savingsYear1) : '--',
      sublabel: language === 'fr' ? 'Première année' : 'First year',
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
                  <div 
                    className="h-16 w-16 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: BRAND_COLORS.accentGold }}
                  >
                    <metric.icon className="h-8 w-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white/60 text-lg mb-2">{metric.label}</p>
                    <p className="text-5xl font-bold mb-2" style={{ color: BRAND_COLORS.accentGold }}>{metric.value}</p>
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
              <Sun className="h-5 w-5" style={{ color: BRAND_COLORS.accentGold }} />
              <span className="text-xl">
                {annualProductionKWh > 0 
                  ? `${Math.round(annualProductionKWh).toLocaleString()} kWh/${language === 'fr' ? 'an' : 'year'}`
                  : '--'}
              </span>
            </div>
            {simulation?.selfSufficiencyPercent && (
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5" style={{ color: BRAND_COLORS.accentGold }} />
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
                    <stop offset="0%" stopColor={BRAND_COLORS.accentGold} />
                    <stop offset="100%" stopColor={BRAND_COLORS.accentGold} stopOpacity={0.7} />
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
              <Sun className="h-8 w-8 mx-auto mb-2" style={{ color: BRAND_COLORS.accentGold }} />
              <p className="text-3xl font-bold" style={{ color: BRAND_COLORS.accentGold }}>{simulation.pvSizeKW.toFixed(0)} kW</p>
              <p className="text-white/60">{language === 'fr' ? 'Puissance installée' : 'Installed capacity'}</p>
            </div>
            {simulation.battEnergyKWh && simulation.battEnergyKWh > 0 && (
              <div className="bg-white/5 rounded-xl border border-white/10 p-6 text-center">
                <Battery className="h-8 w-8 mx-auto mb-2" style={{ color: BRAND_COLORS.accentGold }} />
                <p className="text-3xl font-bold" style={{ color: BRAND_COLORS.accentGold }}>{simulation.battEnergyKWh.toFixed(0)} kWh</p>
                <p className="text-white/60">{language === 'fr' ? 'Stockage batterie' : 'Battery storage'}</p>
              </div>
            )}
            <div className="bg-white/5 rounded-xl border border-white/10 p-6 text-center">
              <Leaf className="h-8 w-8 mx-auto mb-2" style={{ color: BRAND_COLORS.accentGold }} />
              <p className="text-3xl font-bold" style={{ color: BRAND_COLORS.accentGold }}>
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
              <span className="font-semibold" style={{ color: BRAND_COLORS.accentGold }}>{breakEvenYear}</span>
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
                  fill="rgba(0,61,166,0.6)" 
                  radius={[2, 2, 0, 0]}
                />
                <Line 
                  type="monotone" 
                  dataKey="cumulative" 
                  stroke={BRAND_COLORS.accentGold}
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
          {/* Investment - Corporate Blue */}
          <Card 
            className="border"
            style={{ 
              background: `linear-gradient(135deg, rgba(0,61,166,0.3) 0%, rgba(0,43,117,0.2) 100%)`,
              borderColor: 'rgba(0,61,166,0.5)'
            }}
          >
            <CardContent className="p-8 text-center">
              <div 
                className="h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: 'rgba(0,61,166,0.3)' }}
              >
                <DollarSign className="h-8 w-8 text-white" />
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

          {/* Annual Savings - Gold Accent */}
          <Card 
            className="border"
            style={{ 
              background: `linear-gradient(135deg, rgba(255,176,5,0.2) 0%, rgba(255,176,5,0.1) 100%)`,
              borderColor: 'rgba(255,176,5,0.4)'
            }}
          >
            <CardContent className="p-8 text-center">
              <div 
                className="h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: 'rgba(255,176,5,0.2)' }}
              >
                <TrendingUp className="h-8 w-8" style={{ color: BRAND_COLORS.accentGold }} />
              </div>
              <p className="text-white/60 text-lg mb-2">
                {language === 'fr' ? 'Économies Année 1' : 'Year 1 Savings'}
              </p>
              <p className="text-4xl font-bold" style={{ color: BRAND_COLORS.accentGold }}>
                {year1Savings > 0 ? `${Math.round(year1Savings).toLocaleString()}$` : '--'}
              </p>
              <p className="text-white/40 text-sm mt-2">
                {language === 'fr' ? 'Première année' : 'First year'}
              </p>
            </CardContent>
          </Card>

          {/* 25-year Value - kWh Québec Gold Accent */}
          <Card 
            className="border-2"
            style={{ 
              background: `linear-gradient(135deg, rgba(255,176,5,0.3) 0%, rgba(255,176,5,0.15) 100%)`,
              borderColor: BRAND_COLORS.accentGold
            }}
          >
            <CardContent className="p-8 text-center">
              <div 
                className="h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: `rgba(255,176,5,0.3)` }}
              >
                <Zap className="h-8 w-8" style={{ color: BRAND_COLORS.accentGold }} />
              </div>
              <p className="text-white/60 text-lg mb-2">
                {language === 'fr' ? 'VAN @7% (25 ans)' : 'NPV @7% (25 years)'}
              </p>
              <p className="text-4xl font-bold" style={{ color: BRAND_COLORS.accentGold }}>
                {totalSavings25 !== 0 
                  ? `${(totalSavings25 / 1000000).toFixed(1)}M$`
                  : '--'}
              </p>
              <p className="text-white/40 text-sm mt-2">
                {language === 'fr' ? 'Taux d\'actualisation: 7%' : 'Discount rate: 7%'}
              </p>
            </CardContent>
          </Card>
        </div>

        {simulation?.irr25 && (
          <div className="mt-12 text-center">
            <div 
              className="inline-block rounded-2xl px-12 py-8 border-2"
              style={{ 
                backgroundColor: 'rgba(255,176,5,0.1)',
                borderColor: BRAND_COLORS.accentGold
              }}
            >
              <p className="text-white/60 text-xl mb-2">
                {language === 'fr' ? 'Taux de Rendement Interne' : 'Internal Rate of Return'}
              </p>
              <p className="text-6xl font-bold" style={{ color: BRAND_COLORS.accentGold }}>
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

// Summary Slide - Call to Action with kWh Québec branding
function SummarySlide({ 
  site, 
  simulation, 
  language 
}: { 
  site: SiteWithDetails; 
  simulation: SimulationRun | null; 
  language: string 
}) {
  const currentLogo = language === 'fr' ? logoFr : logoEn;
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-8">
      <div className="max-w-4xl w-full text-center">
        <div className="mb-12">
          <div 
            className="h-24 w-24 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl"
            style={{ backgroundColor: BRAND_COLORS.accentGold }}
          >
            <Sun className="h-12 w-12 text-white" />
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            {language === 'fr' ? 'Prochaines Étapes' : 'Next Steps'}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white/5 rounded-xl border border-white/10 p-6">
            <div 
              className="h-12 w-12 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'rgba(255,176,5,0.2)' }}
            >
              <span className="text-2xl font-bold" style={{ color: BRAND_COLORS.accentGold }}>1</span>
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
            <div 
              className="h-12 w-12 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'rgba(255,176,5,0.2)' }}
            >
              <span className="text-2xl font-bold" style={{ color: BRAND_COLORS.accentGold }}>2</span>
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
            <div 
              className="h-12 w-12 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'rgba(255,176,5,0.2)' }}
            >
              <span className="text-2xl font-bold" style={{ color: BRAND_COLORS.accentGold }}>3</span>
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

        {/* kWh Québec contact footer with branding */}
        <div 
          className="rounded-2xl border-2 p-8"
          style={{ 
            backgroundColor: 'rgba(255,176,5,0.1)',
            borderColor: BRAND_COLORS.accentGold
          }}
        >
          <img 
            src={currentLogo} 
            alt="kWh Québec" 
            className="h-16 mx-auto mb-4"
          />
          <p className="text-white/80 text-lg mb-6">
            {language === 'fr' 
              ? 'Votre partenaire pour la transition énergétique commerciale au Québec'
              : 'Your partner for commercial energy transition in Quebec'}
          </p>
          <div className="flex items-center justify-center gap-8 text-white/60">
            <span>info@kwhquebec.com</span>
            <span style={{ color: BRAND_COLORS.accentGold }}>•</span>
            <span>kwhquebec.com</span>
          </div>
        </div>
      </div>
    </div>
  );
}
