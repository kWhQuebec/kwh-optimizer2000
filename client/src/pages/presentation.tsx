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
  Building2,
  MapPin,
  ChevronLeft,
  Loader2,
  Shield,
  CheckCircle2,
  AlertTriangle,
  TreePine,
  Car,
  Home,
  CreditCard,
  Banknote,
  Receipt,
  ArrowDownRight,
  Leaf,
  Check,
  X,
  Square,
  FileText,
  Settings,
  ClipboardCheck,
  Wrench,
} from "lucide-react";

import logoFr from "@assets/kWh_Quebec_Logo-01_-_Rectangulaire_1764799021536.png";
import logoEn from "@assets/kWh_Quebec_Logo-02_-_Rectangle_1764799021536.png";

const BRAND_COLORS = {
  primaryBlue: '#003DA6',
  accentGold: '#FFB005',
  darkBlue: '#002B75',
};

import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  Line,
  Legend,
  ReferenceLine,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/lib/i18n";
import type { Site, Client, SimulationRun, CashflowEntry } from "@shared/schema";
import {
  getAssumptions,
  getExclusions,
  getEquipment,
  getTimeline,
  getAllStats,
  getFirstTestimonial,
  getContactString,
  getProjectSnapshotLabels,
  getDesignFeeCovers,
  getClientProvides,
  getClientReceives,
  getNarrativeAct,
} from "@shared/brandContent";

interface SiteWithDetails extends Site {
  client: Client;
  simulationRuns: SimulationRun[];
}

const formatCurrency = (v: number) => `${Math.round(v).toLocaleString('fr-CA')} $`;
const formatSmartCurrency = (v: number): string => {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M $`;
  if (abs >= 10_000) return `${sign}${Math.round(abs / 1000)}k $`;
  return `${sign}${Math.round(abs).toLocaleString('fr-CA')} $`;
};
const formatPercent = (v: number) => `${v.toFixed(0)} %`;

const SLIDES = [
  'hero',
  'billComparison',
  'snapshot',
  'kpi',
  'waterfall',
  'roofConfig',
  'cashflow',
  'surplusCredits',
  'financing',
  'equipment',
  'timeline',
  'assumptions',
  'nextSteps',
  'credibility',
] as const;
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

  const bestSimulation = site?.simulationRuns?.length
    ? [...site.simulationRuns].sort((a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      )[0]
    : null;

  const { data: fullSimulation } = useQuery<SimulationRun>({
    queryKey: ['/api/simulation-runs', bestSimulation?.id],
    enabled: !!bestSimulation?.id,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-12 w-12 animate-spin" style={{ color: BRAND_COLORS.primaryBlue }} />
      </div>
    );
  }

  if (!site) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center space-y-4">
          <p className="text-xl" style={{ color: '#6B7280' }}>
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
  const currentLogo = language === 'fr' ? logoFr : logoEn;
  const isHeroSlide = slideContent === 'hero';

  const slideComponents: Record<SlideType, JSX.Element> = {
    hero: <HeroSlide site={site} language={language} />,
    billComparison: <BillComparisonSlide simulation={fullSimulation ?? bestSimulation ?? null} language={language} />,
    snapshot: <SnapshotSlide simulation={bestSimulation ?? null} language={language} />,
    kpi: <KPIResultsSlide simulation={bestSimulation ?? null} language={language} />,
    waterfall: <WaterfallSlide simulation={bestSimulation ?? null} language={language} />,
    roofConfig: <RoofConfigSlide site={site} simulation={bestSimulation ?? null} language={language} />,
    cashflow: <CashflowSlide simulation={fullSimulation ?? bestSimulation ?? null} language={language} />,
    surplusCredits: <SurplusCreditsSlide simulation={fullSimulation ?? bestSimulation ?? null} language={language} />,
    financing: <FinancingSlide simulation={fullSimulation ?? bestSimulation ?? null} language={language} />,
    assumptions: <AssumptionsSlide language={language} />,
    equipment: <EquipmentSlide language={language} />,
    timeline: <TimelineSlide language={language} />,
    nextSteps: <NextStepsSlide language={language} />,
    credibility: <CredibilitySlide language={language} />,
  };

  return (
    <div
      className="min-h-screen font-['Montserrat',sans-serif]"
      style={{
        background: isHeroSlide
          ? `linear-gradient(135deg, ${BRAND_COLORS.primaryBlue} 0%, ${BRAND_COLORS.darkBlue} 100%)`
          : '#FFFFFF',
        color: isHeroSlide ? '#FFFFFF' : '#1F2937',
      }}
    >
      <div
        className="fixed top-0 left-0 right-0 z-50 backdrop-blur-sm"
        style={{
          backgroundColor: isHeroSlide ? 'rgba(0, 43, 117, 0.8)' : 'rgba(255,255,255,0.95)',
          borderBottom: isHeroSlide ? '1px solid rgba(255,255,255,0.1)' : '1px solid #E5E7EB',
        }}
      >
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <img
              src={currentLogo}
              alt="kWh Québec"
              className="h-10 w-auto"
              style={isHeroSlide ? { filter: 'brightness(0) invert(1)' } : {}}
              data-testid="logo-kwh-quebec"
            />
            <div className="h-8 w-px" style={{ backgroundColor: isHeroSlide ? 'rgba(255,255,255,0.2)' : '#E5E7EB' }} />
            <Link href={`/app/sites/${id}`}>
              <Button variant="ghost" size="sm" style={{ color: isHeroSlide ? 'rgba(255,255,255,0.7)' : BRAND_COLORS.primaryBlue }}>
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
              style={{ color: isHeroSlide ? 'rgba(255,255,255,0.7)' : BRAND_COLORS.primaryBlue }}
              data-testid="button-fullscreen"
            >
              {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      <div className="pt-16 pb-24 min-h-screen">
        {slideComponents[slideContent]}
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur-sm"
        style={{
          backgroundColor: isHeroSlide ? 'rgba(0, 43, 117, 0.8)' : 'rgba(255,255,255,0.95)',
          borderTop: isHeroSlide ? '1px solid rgba(255,255,255,0.1)' : '1px solid #E5E7EB',
        }}
      >
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4">
          <Button
            variant="ghost"
            onClick={prevSlide}
            disabled={currentSlide === 0}
            className="disabled:opacity-30"
            style={{ color: isHeroSlide ? 'rgba(255,255,255,0.7)' : BRAND_COLORS.primaryBlue }}
            data-testid="button-prev-slide"
          >
            <ArrowLeft className="h-5 w-5 mr-0 md:mr-2" />
            <span className="hidden md:inline">{language === 'fr' ? 'Précédent' : 'Previous'}</span>
          </Button>

          <div className="flex flex-col items-center gap-1 md:gap-2">
            <div className="flex items-center gap-1 md:gap-1.5">
              {SLIDES.map((slide, index) => (
                <button
                  key={slide}
                  onClick={() => setCurrentSlide(index)}
                  className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full transition-all"
                  style={{
                    backgroundColor: index === currentSlide
                      ? BRAND_COLORS.accentGold
                      : isHeroSlide ? 'rgba(255,255,255,0.3)' : '#D1D5DB',
                    transform: index === currentSlide ? 'scale(1.2)' : 'scale(1)'
                  }}
                  data-testid={`slide-indicator-${index}`}
                />
              ))}
            </div>
            <span className="hidden md:inline text-xs" style={{ color: isHeroSlide ? 'rgba(255,255,255,0.5)' : '#9CA3AF' }}>
              {currentSlide + 1}/{SLIDES.length} — {language === 'fr' ? 'Propulsé par' : 'Powered by'} kWh Québec
            </span>
          </div>

          <Button
            variant="ghost"
            onClick={nextSlide}
            disabled={currentSlide === SLIDES.length - 1}
            className="disabled:opacity-30"
            style={{ color: isHeroSlide ? 'rgba(255,255,255,0.7)' : BRAND_COLORS.primaryBlue }}
            data-testid="button-next-slide"
          >
            <span className="hidden md:inline">{language === 'fr' ? 'Suivant' : 'Next'}</span>
            <ArrowRight className="h-5 w-5 ml-0 md:ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function SlideTitle({ children, subtitle }: { children: string; subtitle?: string }) {
  return (
    <div className="text-center mb-8 md:mb-10">
      <h2 className="text-3xl md:text-5xl font-bold mb-2" style={{ color: BRAND_COLORS.primaryBlue }}>
        {children}
      </h2>
      <div className="w-20 h-1 mx-auto mb-3 rounded-full" style={{ backgroundColor: BRAND_COLORS.accentGold }} />
      {subtitle && (
        <p className="text-lg md:text-xl font-semibold" style={{ color: BRAND_COLORS.accentGold }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

function HeroSlide({ site, language }: { site: SiteWithDetails; language: string }) {
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const hasCoords = site.latitude && site.longitude;

  const satelliteImageUrl = hasCoords && googleMapsApiKey
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${site.latitude},${site.longitude}&zoom=18&size=800x500&maptype=satellite&key=${googleMapsApiKey}`
    : null;

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-6 md:px-8">
      <div className="max-w-6xl w-full">
        <div className="flex items-center justify-center mb-8">
          <div
            className="px-6 py-3 rounded-full flex items-center gap-3 shadow-2xl"
            style={{ backgroundColor: BRAND_COLORS.accentGold }}
          >
            <Sun className="h-6 w-6 text-white" />
            <span className="text-white font-semibold text-base md:text-lg uppercase tracking-wider">
              {language === 'fr' ? 'Analyse Solaire Commerciale' : 'Commercial Solar Analysis'}
            </span>
          </div>
        </div>

        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-7xl font-bold mb-4 text-white">
            {site.client.name}
          </h1>
          <h2 className="text-2xl md:text-4xl font-light text-white/80 mb-6">
            {site.name}
          </h2>
          <div className="flex items-center justify-center gap-2 text-white/60">
            <MapPin className="h-5 w-5" />
            <span className="text-lg md:text-xl">
              {[site.address, site.city, site.postalCode].filter(Boolean).join(", ")}
            </span>
          </div>
        </div>

        {satelliteImageUrl ? (
          <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 mx-auto max-w-4xl">
            <img src={satelliteImageUrl} alt="Vue satellite" className="w-full h-auto" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <div className="absolute bottom-4 right-4 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1.5">
              <span className="text-sm text-white/80">Google Solar</span>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-12 text-center mx-auto max-w-4xl">
            <Building2 className="h-24 w-24 mx-auto text-white/20 mb-4" />
            <p className="text-white/40">
              {language === 'fr' ? 'Image satellite en cours de chargement...' : 'Satellite image loading...'}
            </p>
          </div>
        )}

        <div className="flex items-center justify-center gap-4 flex-wrap mt-8">
          {site.buildingType && (
            <Badge
              variant="secondary"
              className="text-white text-base md:text-lg px-4 py-2"
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
              className="text-white text-base md:text-lg px-4 py-2"
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

function BillComparisonSlide({ simulation, language }: { simulation: SimulationRun | null; language: string }) {
  if (!simulation || !simulation.annualCostBefore || Number(simulation.annualCostBefore) <= 0) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <p className="text-gray-400">{language === 'fr' ? 'Données de facturation non disponibles' : 'Billing data not available'}</p>
      </div>
    );
  }

  const costBefore = Number(simulation.annualCostBefore);
  const costAfter = Number(simulation?.annualCostAfter || 0);
  const savings = Number(simulation?.annualSavings || 0);
  const savingsPercent = costBefore > 0 ? ((savings / costBefore) * 100).toFixed(0) : '0';

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-6 md:px-8">
      <div className="max-w-5xl w-full">
        <SlideTitle>
          {language === 'fr' ? 'Votre Facture Avant / Après' : 'Your Bill Before / After'}
        </SlideTitle>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-8">
          <div
            className="rounded-2xl p-6 md:p-8 text-center shadow-sm"
            style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}
            data-testid="card-bill-before"
          >
            <Receipt className="h-10 w-10 mx-auto mb-3" style={{ color: '#DC2626' }} />
            <p className="text-base font-semibold mb-2" style={{ color: '#991B1B' }}>
              {language === 'fr' ? "Aujourd'hui" : 'Today'}
            </p>
            <p className="text-4xl md:text-5xl font-bold" style={{ color: '#DC2626' }}>
              {costBefore > 0 ? formatSmartCurrency(costBefore) : '--'}
            </p>
            <p className="text-sm mt-2" style={{ color: '#6B7280' }}>
              {language === 'fr' ? 'par année' : 'per year'}
            </p>
          </div>

          <div
            className="rounded-2xl p-6 md:p-8 text-center shadow-sm"
            style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}
            data-testid="card-bill-after"
          >
            <Sun className="h-10 w-10 mx-auto mb-3" style={{ color: '#16A34A' }} />
            <p className="text-base font-semibold mb-2" style={{ color: '#166534' }}>
              {language === 'fr' ? 'Avec Solaire' : 'With Solar'}
            </p>
            <p className="text-4xl md:text-5xl font-bold" style={{ color: '#16A34A' }}>
              {costAfter > 0 ? formatSmartCurrency(costAfter) : '--'}
            </p>
            <p className="text-sm mt-2" style={{ color: '#6B7280' }}>
              {language === 'fr' ? 'par année' : 'per year'}
            </p>
          </div>
        </div>

        {savings > 0 && (
          <>
            <div
              className="rounded-2xl px-6 py-5 text-center shadow-md"
              style={{ backgroundColor: BRAND_COLORS.accentGold }}
              data-testid="banner-savings"
            >
              <p className="text-3xl md:text-4xl font-bold text-white mb-1">
                {formatSmartCurrency(savings)}
              </p>
              <p className="text-white/90 text-base md:text-lg font-medium">
                {language === 'fr' ? "d'économies par année" : 'savings per year'}
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 mt-6" style={{ color: BRAND_COLORS.primaryBlue }}>
              <ArrowDownRight className="h-5 w-5" />
              <span className="text-lg font-semibold">
                {language === 'fr'
                  ? `Économies de ${savingsPercent} % sur votre facture`
                  : `${savingsPercent}% savings on your bill`}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SnapshotSlide({ simulation, language }: { simulation: SimulationRun | null; language: string }) {
  const lang = language as "fr" | "en";
  const labels = getProjectSnapshotLabels(lang);
  const act1 = getNarrativeAct("act1_challenge", lang);
  const systemSize = simulation?.pvSizeKW ? Number(simulation.pvSizeKW).toFixed(0) : null;

  const items = [
    { icon: Zap, label: labels.annualConsumption?.label || '', value: simulation?.annualConsumptionKWh ? `${Math.round(simulation.annualConsumptionKWh).toLocaleString()} kWh` : '--' },
    { icon: TrendingUp, label: labels.peakDemand?.label || '', value: simulation?.peakDemandKW ? `${Number(simulation.peakDemandKW).toFixed(0)} kW` : '--' },
    { icon: Sun, label: labels.solarCapacity?.label || '', value: simulation?.pvSizeKW ? `${Number(simulation.pvSizeKW).toFixed(0)} kWc` : '--' },
    { icon: Battery, label: labels.batteryCapacity?.label || '', value: simulation?.battEnergyKWh && Number(simulation.battEnergyKWh) > 0 ? `${Number(simulation.battEnergyKWh).toFixed(0)} kWh` : '0 kWh' },
    { icon: Sun, label: labels.estimatedProduction?.label || '', value: simulation?.pvSizeKW ? `${Math.round(Number(simulation.pvSizeKW) * 1035).toLocaleString()} kWh` : '--' },
    { icon: CheckCircle2, label: labels.selfConsumptionRate?.label || '', value: simulation?.selfSufficiencyPercent ? `${Number(simulation.selfSufficiencyPercent).toFixed(0)}%` : '--' },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-6 md:px-8">
      <div className="max-w-6xl w-full">
        <SlideTitle
          subtitle={systemSize ? (language === 'fr' ? `Système de ${systemSize} kWc proposé` : `Proposed ${systemSize} kWp system`) : undefined}
        >
          {language === 'fr' ? 'Aperçu du Projet' : 'Project Snapshot'}
        </SlideTitle>
        <p className="text-center text-sm italic mb-8" style={{ color: '#6B7280' }}>{act1.subtitle}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item, i) => (
            <div
              key={i}
              className="rounded-xl p-5 flex items-center gap-4 shadow-sm"
              style={{ border: '1px solid #E5E7EB' }}
            >
              <div
                className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'rgba(255,176,5,0.1)' }}
              >
                <item.icon className="h-6 w-6" style={{ color: BRAND_COLORS.accentGold }} />
              </div>
              <div>
                <p className="text-sm" style={{ color: '#6B7280' }}>{item.label}</p>
                <p className="text-xl md:text-2xl font-bold" style={{ color: BRAND_COLORS.primaryBlue }}>{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KPIResultsSlide({ simulation, language }: { simulation: SimulationRun | null; language: string }) {
  const npv25Val = simulation?.npv25 ? Number(simulation.npv25) : 0;

  const kpis = [
    {
      icon: DollarSign,
      label: language === 'fr' ? 'Économies An 1' : 'Year 1 Savings',
      value: simulation?.savingsYear1 ? formatSmartCurrency(simulation.savingsYear1) : '--',
      highlight: false
    },
    {
      icon: TrendingUp,
      label: language === 'fr' ? 'Investissement Net' : 'Net Investment',
      value: simulation?.capexNet ? formatSmartCurrency(Number(simulation.capexNet)) : '--',
      highlight: false
    },
    {
      icon: Zap,
      label: language === 'fr' ? 'Profit Net (VAN)' : 'Net Profit (NPV)',
      value: simulation?.npv25 ? formatSmartCurrency(npv25Val) : '--',
      highlight: true
    },
    {
      icon: TrendingUp,
      label: language === 'fr' ? 'Rendement (TRI)' : 'Return (IRR)',
      value: simulation?.irr25 ? `${(simulation.irr25 * 100).toFixed(1)}%` : '--',
      highlight: true
    },
  ];

  const lcoe = simulation?.lcoe ? Number(simulation.lcoe).toFixed(2) : '0.00';
  const co2Tonnes = simulation?.co2AvoidedTonnesPerYear ? Number(simulation.co2AvoidedTonnesPerYear) : 0;
  const backupHours = (simulation?.battEnergyKWh && Number(simulation.battEnergyKWh) > 0 && simulation?.peakDemandKW && Number(simulation.peakDemandKW) > 0)
    ? (Number(simulation.battEnergyKWh) / (Number(simulation.peakDemandKW) * 0.3)).toFixed(1)
    : '0';

  const treesPerYear = Math.round(co2Tonnes * 40);
  const carsRemoved = co2Tonnes > 0 ? (co2Tonnes / 4.6).toFixed(1) : '0';
  const totalProdKWh = simulation?.totalProductionKWh ? Number(simulation.totalProductionKWh) : (simulation?.pvSizeKW ? Number(simulation.pvSizeKW) * 1035 : 0);
  const homesPowered = totalProdKWh > 0 ? (totalProdKWh / 20000).toFixed(1) : '0';

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-6 md:px-8">
      <div className="max-w-7xl w-full">
        <SlideTitle
          subtitle={npv25Val > 0 ? (language === 'fr' ? `Profit net de ${formatSmartCurrency(npv25Val)} sur 25 ans` : `Net profit of ${formatSmartCurrency(npv25Val)} over 25 years`) : undefined}
        >
          {language === 'fr' ? 'Vos Résultats' : 'Your Results'}
        </SlideTitle>

        {simulation?.pvSizeKW && (
          <p className="text-center mb-6" style={{ color: '#6B7280' }}>
            {language === 'fr' ? 'Système: ' : 'System: '}
            <span className="font-semibold" style={{ color: '#1F2937' }}>{Number(simulation.pvSizeKW).toFixed(0)} kW</span>
            {simulation.battEnergyKWh && Number(simulation.battEnergyKWh) > 0 && (
              <> + <span className="font-semibold" style={{ color: '#1F2937' }}>{Number(simulation.battEnergyKWh).toFixed(0)} kWh</span></>
            )}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
          {kpis.map((kpi, i) => (
            <div
              key={i}
              className="rounded-xl p-5 md:p-6 shadow-sm overflow-visible"
              style={{
                border: kpi.highlight ? `2px solid ${BRAND_COLORS.accentGold}` : '1px solid #E5E7EB',
                backgroundColor: kpi.highlight ? 'rgba(255,176,5,0.04)' : '#FFFFFF',
              }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="h-12 w-12 md:h-14 md:w-14 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: kpi.highlight ? BRAND_COLORS.accentGold : 'rgba(0,61,166,0.1)' }}
                >
                  <kpi.icon className="h-6 w-6 md:h-7 md:w-7" style={{ color: kpi.highlight ? '#FFFFFF' : BRAND_COLORS.primaryBlue }} />
                </div>
                <div>
                  <p className="text-sm md:text-base mb-1" style={{ color: '#6B7280' }}>{kpi.label}</p>
                  <p className="text-3xl md:text-4xl font-bold" style={{ color: kpi.highlight ? BRAND_COLORS.accentGold : BRAND_COLORS.primaryBlue }}>{kpi.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div
          className="rounded-xl py-3 px-4 md:px-6 mb-4 shadow-sm"
          style={{ border: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' }}
        >
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm" style={{ color: '#6B7280' }}>
            <span>LCOE: <span className="font-semibold" style={{ color: '#1F2937' }}>{lcoe} ¢/kWh</span></span>
            <span style={{ color: '#D1D5DB' }}>|</span>
            <span>CO&#8322;: <span className="font-semibold" style={{ color: '#1F2937' }}>{co2Tonnes.toFixed(1)} t/{language === 'fr' ? 'an' : 'yr'}</span></span>
            <span style={{ color: '#D1D5DB' }}>|</span>
            <span>{language === 'fr' ? 'Autonomie batterie' : 'Battery backup'}: <span className="font-semibold" style={{ color: '#1F2937' }}>{backupHours}h</span></span>
          </div>
        </div>

        {co2Tonnes > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 rounded-xl p-4 shadow-sm" style={{ border: '1px solid #E5E7EB', backgroundColor: '#F0FDF4' }}>
              <TreePine className="h-8 w-8 shrink-0" style={{ color: '#16A34A' }} />
              <div>
                <p className="text-xl font-bold" style={{ color: '#166534' }}>{treesPerYear.toLocaleString()}</p>
                <p className="text-xs" style={{ color: '#6B7280' }}>{language === 'fr' ? 'arbres plantés / an' : 'trees planted / yr'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl p-4 shadow-sm" style={{ border: '1px solid #E5E7EB', backgroundColor: '#EFF6FF' }}>
              <Car className="h-8 w-8 shrink-0" style={{ color: BRAND_COLORS.primaryBlue }} />
              <div>
                <p className="text-xl font-bold" style={{ color: BRAND_COLORS.primaryBlue }}>{carsRemoved}</p>
                <p className="text-xs" style={{ color: '#6B7280' }}>{language === 'fr' ? 'voitures retirées / an' : 'cars removed / yr'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl p-4 shadow-sm" style={{ border: '1px solid #E5E7EB', backgroundColor: '#FFFBEB' }}>
              <Home className="h-8 w-8 shrink-0" style={{ color: '#D97706' }} />
              <div>
                <p className="text-xl font-bold" style={{ color: '#92400E' }}>{homesPowered}</p>
                <p className="text-xs" style={{ color: '#6B7280' }}>{language === 'fr' ? 'maisons alimentées' : 'homes powered'}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function WaterfallSlide({ simulation, language }: { simulation: SimulationRun | null; language: string }) {
  const capexGross = Number(simulation?.capexGross || 0);
  const hqSolar = Number(simulation?.incentivesHQSolar || 0);
  const hqBattery = Number(simulation?.incentivesHQBattery || 0);
  const itcFederal = Number(simulation?.incentivesFederal || 0);
  const taxShield = Number(simulation?.taxShield || 0);
  const capexNet = Number(simulation?.capexNet || 0);
  const totalIncentives = hqSolar + hqBattery + itcFederal + taxShield;
  const savingsPercent = capexGross > 0 ? ((totalIncentives / capexGross) * 100).toFixed(0) : '0';

  const bars = [
    { label: language === 'fr' ? 'CAPEX Brut' : 'Gross CAPEX', value: capexGross, type: 'start' as const, color: BRAND_COLORS.primaryBlue },
    { label: language === 'fr' ? 'HQ Solaire' : 'HQ Solar', value: hqSolar, type: 'deduction' as const, color: '#DC2626' },
    { label: language === 'fr' ? 'HQ Batterie' : 'HQ Battery', value: hqBattery, type: 'deduction' as const, color: '#DC2626' },
    { label: language === 'fr' ? 'ITC Fédéral' : 'Federal ITC', value: itcFederal, type: 'deduction' as const, color: '#DC2626' },
    { label: language === 'fr' ? 'Bouclier Fiscal' : 'Tax Shield', value: taxShield, type: 'deduction' as const, color: '#DC2626' },
    { label: language === 'fr' ? 'Net' : 'Net', value: capexNet, type: 'total' as const, color: '#2D915F' },
  ];

  const maxVal = Math.max(capexGross, 1);
  const chartHeight = 300;
  let running = capexGross;

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-6 md:px-8">
      <div className="max-w-6xl w-full">
        <SlideTitle
          subtitle={capexGross > 0 ? (language === 'fr' ? `Réduction de ${savingsPercent} % du coût d'investissement grâce aux incitatifs` : `${savingsPercent}% investment cost reduction through incentives`) : undefined}
        >
          {language === 'fr' ? "Ventilation de l'Investissement" : 'Investment Breakdown'}
        </SlideTitle>

        {capexGross > 0 ? (
          <>
            <div className="rounded-2xl p-6 md:p-8 shadow-sm" style={{ border: '1px solid #E5E7EB' }}>
              <div className="flex items-end justify-center gap-3 md:gap-4" style={{ height: chartHeight + 60 }}>
                {bars.map((bar, i) => {
                  const barHeight = Math.max(8, (bar.value / maxVal) * chartHeight);

                  if (bar.type === 'deduction') {
                    running -= bar.value;
                  }

                  return (
                    <div key={i} className="flex flex-col items-center min-w-[50px] md:min-w-[60px]" style={{ width: '14%' }}>
                      <div className={`${bars.length >= 6 ? 'text-xs' : 'text-sm'} font-bold mb-1`} style={{ color: bar.type === 'deduction' ? '#DC2626' : '#1F2937' }}>
                        {bar.type === 'deduction' ? '-' : ''}{bar.type === 'start' || bar.type === 'total' ? formatSmartCurrency(bar.value) : formatCurrency(bar.value)}
                      </div>
                      <div className="w-full relative" style={{ height: chartHeight }}>
                        <div style={{ height: chartHeight - barHeight }} />
                        <div
                          className="w-full rounded-t"
                          style={{
                            height: barHeight,
                            backgroundColor: bar.color,
                            opacity: bar.type === 'deduction' ? 0.85 : 1
                          }}
                        />
                      </div>
                      <p className="text-xs text-center mt-2 leading-tight" style={{ color: '#6B7280' }}>{bar.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              {[
                { label: 'HQ Solar', value: hqSolar },
                { label: 'HQ Battery', value: hqBattery },
                { label: language === 'fr' ? 'ITC Fédéral' : 'Federal ITC', value: itcFederal },
                { label: language === 'fr' ? 'Bouclier Fiscal' : 'Tax Shield', value: taxShield },
              ].filter(item => item.value > 0).map((item, i) => (
                <div key={i} className="rounded-xl p-4 text-center shadow-sm" style={{ border: '1px solid #E5E7EB' }}>
                  <p className="text-sm" style={{ color: '#6B7280' }}>{item.label}</p>
                  <p className="text-lg md:text-xl font-bold" style={{ color: BRAND_COLORS.accentGold }}>-{formatCurrency(item.value)}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-2xl p-12 text-center shadow-sm" style={{ border: '1px solid #E5E7EB' }}>
            <p style={{ color: '#6B7280' }}>{language === 'fr' ? 'Données non disponibles' : 'Data not available'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function RoofConfigSlide({ site, simulation, language }: { site: SiteWithDetails; simulation: SimulationRun | null; language: string }) {
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const hasCoords = site.latitude && site.longitude;

  const satelliteImageUrl = hasCoords && googleMapsApiKey
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${site.latitude},${site.longitude}&zoom=19&size=600x400&maptype=satellite&key=${googleMapsApiKey}`
    : null;

  const summaryItems = [
    { label: language === 'fr' ? 'Puissance solaire' : 'Solar capacity', value: simulation?.pvSizeKW ? `${Number(simulation.pvSizeKW).toFixed(0)} kWc` : '--' },
    { label: language === 'fr' ? 'Stockage' : 'Storage', value: simulation?.battEnergyKWh && Number(simulation.battEnergyKWh) > 0 ? `${Number(simulation.battEnergyKWh).toFixed(0)} kWh` : (language === 'fr' ? 'Non inclus' : 'N/A') },
    { label: language === 'fr' ? 'Production An 1' : 'Year-1 production', value: simulation?.pvSizeKW ? `${Math.round(Number(simulation.pvSizeKW) * 1035).toLocaleString()} kWh` : '--' },
    { label: language === 'fr' ? 'Autoconsommation' : 'Self-consumption', value: simulation?.selfSufficiencyPercent ? `${Number(simulation.selfSufficiencyPercent).toFixed(0)}%` : '--' },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-6 md:px-8">
      <div className="max-w-6xl w-full">
        <SlideTitle>
          {language === 'fr' ? 'Configuration Toiture' : 'Roof Configuration'}
        </SlideTitle>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          <div>
            {satelliteImageUrl ? (
              <div className="rounded-2xl overflow-hidden shadow-sm" style={{ border: '1px solid #E5E7EB' }}>
                <img src={satelliteImageUrl} alt="Vue satellite" className="w-full h-auto" />
              </div>
            ) : (
              <div className="rounded-2xl p-12 text-center h-full flex items-center justify-center shadow-sm" style={{ border: '1px solid #E5E7EB' }}>
                <div>
                  <Building2 className="h-16 w-16 mx-auto mb-4" style={{ color: '#D1D5DB' }} />
                  <p style={{ color: '#9CA3AF' }}>{language === 'fr' ? 'Image non disponible' : 'Image not available'}</p>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl p-6 shadow-sm" style={{ border: '1px solid #E5E7EB' }}>
            <h3 className="text-xl font-bold mb-6" style={{ color: BRAND_COLORS.primaryBlue }}>
              {language === 'fr' ? 'Dimensionnement' : 'Sizing Summary'}
            </h3>
            <div className="space-y-5">
              {summaryItems.map((item, i) => (
                <div key={i}>
                  <p className="text-sm mb-1" style={{ color: '#6B7280' }}>{item.label}</p>
                  <p className="text-2xl font-bold" style={{ color: '#1F2937' }}>{item.value}</p>
                  {i < summaryItems.length - 1 && <div className="mt-4" style={{ borderBottom: '1px solid #E5E7EB' }} />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CashflowSlide({ simulation, language }: { simulation: SimulationRun | null; language: string }) {
  const cashflowData = simulation?.cashflows as CashflowEntry[] | undefined;

  const chartData = cashflowData?.map((entry, index) => ({
    year: entry.year || index + 1,
    cumulative: entry.cumulative,
    annual: entry.netCashflow
  })) || [];

  const breakEvenYear = chartData.find(d => d.cumulative >= 0)?.year;
  const savingsYear1 = simulation?.savingsYear1 || 0;
  const costOfInaction = savingsYear1 * 25;

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-6 md:px-8">
      <div className="max-w-6xl w-full">
        <SlideTitle
          subtitle={breakEvenYear ? (language === 'fr' ? `Rentable en ${breakEvenYear} ans` : `Payback in ${breakEvenYear} years`) : undefined}
        >
          {language === 'fr' ? 'Projections Financières' : 'Financial Projections'}
        </SlideTitle>

        {chartData.length > 0 ? (
          <>
            <div className="rounded-2xl p-4 md:p-6 shadow-sm" style={{ border: '1px solid #E5E7EB' }}>
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis
                    dataKey="year"
                    stroke="#9CA3AF"
                    tick={{ fill: '#6B7280', fontSize: 12 }}
                  />
                  <YAxis
                    stroke="#9CA3AF"
                    tick={{ fill: '#6B7280', fontSize: 12 }}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k$`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px', color: '#1F2937' }}
                    labelStyle={{ color: '#1F2937', fontWeight: 'bold' }}
                    formatter={(value: number, name: string) => [
                      `${Math.round(value).toLocaleString('fr-CA')} $`,
                      name === 'cumulative' ? (language === 'fr' ? 'Cumulatif' : 'Cumulative') : (language === 'fr' ? 'Annuel' : 'Annual')
                    ]}
                  />
                  <Legend
                    wrapperStyle={{ color: '#6B7280' }}
                    formatter={(value) => value === 'cumulative'
                      ? (language === 'fr' ? 'Cash-flow cumulatif' : 'Cumulative cash flow')
                      : (language === 'fr' ? 'Cash-flow annuel' : 'Annual cash flow')}
                  />
                  <Bar dataKey="annual" fill={BRAND_COLORS.primaryBlue} opacity={0.6} radius={[2, 2, 0, 0]} />
                  <Line type="monotone" dataKey="cumulative" stroke={BRAND_COLORS.accentGold} strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey={() => 0} stroke="#D1D5DB" strokeDasharray="5 5" dot={false} />
                  {breakEvenYear && (
                    <ReferenceLine
                      x={breakEvenYear}
                      stroke="#FFB005"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      label={{
                        value: language === 'fr' ? `Rentable An ${breakEvenYear}` : `Payback Year ${breakEvenYear}`,
                        position: 'top',
                        fill: '#FFB005',
                        fontSize: 14,
                        fontWeight: 'bold'
                      }}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {costOfInaction > 0 && (
              <div
                className="mt-6 rounded-xl px-6 py-4 text-center shadow-sm"
                style={{
                  backgroundColor: 'rgba(255,176,5,0.08)',
                  border: `2px solid ${BRAND_COLORS.accentGold}`
                }}
              >
                <AlertTriangle className="h-5 w-5 inline-block mr-2" style={{ color: BRAND_COLORS.accentGold }} />
                <span className="text-base md:text-lg font-semibold" style={{ color: BRAND_COLORS.accentGold }}>
                  {language === 'fr' ? "Coût de l'inaction sur 25 ans" : 'Cost of inaction over 25 years'}: {formatSmartCurrency(costOfInaction)}
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-2xl p-12 text-center shadow-sm" style={{ border: '1px solid #E5E7EB' }}>
            <p style={{ color: '#6B7280' }}>
              {language === 'fr' ? 'Données de cash-flow non disponibles.' : 'Cash flow data not available.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function SurplusCreditsSlide({ simulation, language }: { simulation: SimulationRun | null; language: string }) {
  const exported = simulation?.totalExportedKWh ?? 0;
  const revenue = simulation?.annualSurplusRevenue ?? 0;

  if (!exported || exported <= 0) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <div className="text-center" style={{ color: '#6B7280' }}>
          <Zap className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <p className="text-xl font-semibold">
            {language === 'fr' ? "Aucun surplus d'énergie" : 'No surplus energy'}
          </p>
          <p className="text-sm mt-2">
            {language === 'fr'
              ? "La production solaire est entièrement autoconsommée."
              : 'All solar production is self-consumed.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-6 md:px-8">
      <div className="max-w-5xl w-full">
        <SlideTitle>
          {language === 'fr'
            ? 'CRÉDITS DE SURPLUS (MESURAGE NET)'
            : 'SURPLUS CREDITS (NET METERING)'}
        </SlideTitle>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <div
            className="rounded-2xl p-8 text-center shadow-sm"
            style={{ backgroundColor: '#EFF6FF', border: `2px solid ${BRAND_COLORS.primaryBlue}20` }}
            data-testid="card-surplus-kwh"
          >
            <Zap className="h-12 w-12 mx-auto mb-4" style={{ color: BRAND_COLORS.primaryBlue }} />
            <p className="text-base font-semibold mb-3" style={{ color: BRAND_COLORS.darkBlue }}>
              {language === 'fr' ? 'Surplus exporté annuel' : 'Annual surplus exported'}
            </p>
            <p className="text-4xl md:text-5xl font-bold" style={{ color: BRAND_COLORS.primaryBlue }}>
              {Math.round(exported).toLocaleString('fr-CA')} kWh
            </p>
          </div>

          <div
            className="rounded-2xl p-8 text-center shadow-sm"
            style={{ backgroundColor: '#F0FDF4', border: '2px solid #BBF7D020' }}
            data-testid="card-surplus-revenue"
          >
            <DollarSign className="h-12 w-12 mx-auto mb-4" style={{ color: '#16A34A' }} />
            <p className="text-base font-semibold mb-3" style={{ color: '#166534' }}>
              {language === 'fr' ? 'Valeur annuelle du crédit' : 'Annual credit value'}
            </p>
            <p className="text-4xl md:text-5xl font-bold" style={{ color: '#16A34A' }}>
              {formatSmartCurrency(revenue)}
            </p>
          </div>
        </div>

        <div
          className="mt-8 rounded-xl px-6 py-4 text-center"
          style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}
          data-testid="text-surplus-footnote"
        >
          <p className="text-sm" style={{ color: '#6B7280' }}>
            {language === 'fr'
              ? "Les crédits kWh compensent votre facture pendant 24 mois. Le surplus non utilisé est compensé au tarif de référence (~4,54¢/kWh)."
              : 'kWh credits offset your bill for up to 24 months. Unused surplus is compensated at the reference rate (~4.54¢/kWh).'}
          </p>
        </div>
      </div>
    </div>
  );
}

function FinancingSlide({ simulation, language }: { simulation: SimulationRun | null; language: string }) {
  if (!simulation || !simulation.capexNet || Number(simulation.capexNet) <= 0) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <p className="text-gray-400">{language === 'fr' ? 'Données de financement non disponibles' : 'Financing data not available'}</p>
      </div>
    );
  }

  const capexNet = Number(simulation.capexNet);
  const savingsYear1 = Number(simulation?.savingsYear1 || 0);
  const paybackYears = simulation?.simplePaybackYears ? Number(simulation.simplePaybackYears).toFixed(1) : '--';
  const npv25 = simulation?.npv25 ? Number(simulation.npv25) : 0;

  const loanRate = 0.05;
  const loanTermMonths = 120;
  const loanMonthlyRate = loanRate / 12;
  const loanMonthly = capexNet > 0 ? capexNet * loanMonthlyRate / (1 - Math.pow(1 + loanMonthlyRate, -loanTermMonths)) : 0;
  const loanAnnualPayment = loanMonthly * 12;
  const loanNetYear1 = savingsYear1 - loanAnnualPayment;

  const leaseRate = 0.07;
  const leaseTermMonths = 180;
  const leaseMonthlyRate = leaseRate / 12;
  const leaseMonthly = capexNet > 0 ? capexNet * leaseMonthlyRate / (1 - Math.pow(1 + leaseMonthlyRate, -leaseTermMonths)) : 0;
  const leaseAnnualPayment = leaseMonthly * 12;
  const leaseNetYear1 = savingsYear1 - leaseAnnualPayment;

  const options = [
    {
      key: 'cash',
      title: language === 'fr' ? 'Comptant' : 'Cash',
      icon: Banknote,
      recommended: true,
      keyNumber: capexNet > 0 ? formatCurrency(capexNet) : '--',
      keyLabel: language === 'fr' ? 'Investissement net' : 'Net investment',
      bullets: [
        language === 'fr' ? `Économies An 1: ${formatCurrency(savingsYear1)}` : `Year 1 savings: ${formatCurrency(savingsYear1)}`,
        language === 'fr' ? `Retour simple: ${paybackYears} ans` : `Simple payback: ${paybackYears} years`,
        language === 'fr' ? `VAN 25 ans: ${formatCurrency(npv25)}` : `25yr NPV: ${formatCurrency(npv25)}`,
      ],
    },
    {
      key: 'loan',
      title: language === 'fr' ? 'Financement' : 'Loan',
      icon: CreditCard,
      recommended: false,
      keyNumber: capexNet > 0 ? `${Math.round(loanMonthly).toLocaleString('fr-CA')} $/m` : '--',
      keyLabel: language === 'fr' ? 'Paiement mensuel' : 'Monthly payment',
      bullets: [
        language === 'fr' ? `Taux: 5 %, terme 10 ans` : `Rate: 5%, 10yr term`,
        language === 'fr' ? `Net An 1: ${formatCurrency(loanNetYear1)}` : `Net Year 1: ${formatCurrency(loanNetYear1)}`,
        language === 'fr' ? `Annuel: ${formatCurrency(loanAnnualPayment)}` : `Annual: ${formatCurrency(loanAnnualPayment)}`,
      ],
    },
    {
      key: 'lease',
      title: language === 'fr' ? 'Location / Crédit-bail' : 'Lease',
      icon: Receipt,
      recommended: false,
      keyNumber: capexNet > 0 ? `${Math.round(leaseMonthly).toLocaleString('fr-CA')} $/m` : '--',
      keyLabel: language === 'fr' ? 'Paiement mensuel' : 'Monthly payment',
      bullets: [
        language === 'fr' ? `Taux: 7 %, terme 15 ans` : `Rate: 7%, 15yr term`,
        language === 'fr' ? `Net An 1: ${formatCurrency(leaseNetYear1)}` : `Net Year 1: ${formatCurrency(leaseNetYear1)}`,
        language === 'fr' ? 'Aucun investissement initial' : 'No upfront investment',
      ],
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-6 md:px-8">
      <div className="max-w-6xl w-full">
        <SlideTitle>
          {language === 'fr' ? 'Options de Financement' : 'Financing Options'}
        </SlideTitle>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
          {options.map((opt) => (
            <div
              key={opt.key}
              className="rounded-2xl p-5 md:p-6 shadow-sm relative"
              style={{
                border: opt.recommended ? `2px solid ${BRAND_COLORS.accentGold}` : '1px solid #E5E7EB',
              }}
              data-testid={`card-financing-${opt.key}`}
            >
              {opt.recommended && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: BRAND_COLORS.accentGold }}
                >
                  {language === 'fr' ? 'Recommandé' : 'Recommended'}
                </div>
              )}
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: opt.recommended ? 'rgba(255,176,5,0.1)' : 'rgba(0,61,166,0.08)' }}
                >
                  <opt.icon className="h-5 w-5" style={{ color: opt.recommended ? BRAND_COLORS.accentGold : BRAND_COLORS.primaryBlue }} />
                </div>
                <h3 className="text-lg font-bold" style={{ color: BRAND_COLORS.primaryBlue }}>{opt.title}</h3>
              </div>
              <p className="text-2xl md:text-3xl font-bold mb-1" style={{ color: opt.recommended ? BRAND_COLORS.accentGold : BRAND_COLORS.primaryBlue }}>
                {opt.keyNumber}
              </p>
              <p className="text-sm mb-4" style={{ color: '#6B7280' }}>{opt.keyLabel}</p>
              <div className="space-y-2">
                {opt.bullets.map((bullet, j) => (
                  <div key={j} className="flex items-start gap-2">
                    <Check className="h-4 w-4 mt-0.5 shrink-0" style={{ color: '#16A34A' }} />
                    <span className="text-sm" style={{ color: '#4B5563' }}>{bullet}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AssumptionsSlide({ language }: { language: string }) {
  const lang = language as "fr" | "en";
  const assumptions = getAssumptions(lang);
  const exclusions = getExclusions(lang);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-6 md:px-8">
      <div className="max-w-6xl w-full">
        <SlideTitle>
          {language === 'fr' ? 'Hypothèses et Exclusions' : 'Assumptions & Exclusions'}
        </SlideTitle>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          <div className="rounded-2xl p-6 shadow-sm" style={{ border: '1px solid #E5E7EB' }}>
            <h3 className="text-xl font-bold mb-6" style={{ color: BRAND_COLORS.primaryBlue }}>
              {language === 'fr' ? 'Hypothèses' : 'Assumptions'}
            </h3>
            <div className="space-y-3">
              {assumptions.map((a, i) => (
                <div key={i} className="flex justify-between items-center py-2" style={{ borderBottom: i < assumptions.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                  <span className="text-sm" style={{ color: '#6B7280' }}>{a.label}</span>
                  <span className="text-sm font-semibold" style={{ color: '#1F2937' }}>{a.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl p-6 shadow-sm" style={{ border: '1px solid #E5E7EB' }}>
            <h3 className="text-xl font-bold mb-6" style={{ color: '#DC2626' }}>
              {language === 'fr' ? 'Exclusions' : 'Exclusions'}
            </h3>
            <div className="space-y-3">
              {exclusions.map((excl, i) => (
                <div key={i} className="flex items-start gap-3 py-2">
                  <X className="h-4 w-4 mt-0.5 shrink-0" style={{ color: '#DC2626' }} />
                  <span className="text-sm" style={{ color: '#4B5563' }}>{excl}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EquipmentSlide({ language }: { language: string }) {
  const lang = language as "fr" | "en";
  const equipment = getEquipment(lang);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-6 md:px-8">
      <div className="max-w-6xl w-full">
        <SlideTitle>
          {language === 'fr' ? 'Équipement et Garanties' : 'Equipment & Warranties'}
        </SlideTitle>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {equipment.map((eq, i) => (
            <div key={i} className="rounded-xl text-center p-6 shadow-sm" style={{ border: '1px solid #E5E7EB' }}>
              <div
                className="h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: 'rgba(255,176,5,0.1)' }}
              >
                <Shield className="h-7 w-7" style={{ color: BRAND_COLORS.accentGold }} />
              </div>
              <p className="text-sm min-h-[2.5rem] mb-3" style={{ color: '#6B7280' }}>{eq.label}</p>
              <p className="text-3xl font-bold" style={{ color: BRAND_COLORS.primaryBlue }}>{eq.warranty}</p>
              <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>{language === 'fr' ? 'garantie' : 'warranty'}</p>
            </div>
          ))}
        </div>

        <p className="text-center text-sm mt-8" style={{ color: '#9CA3AF' }}>
          {language === 'fr'
            ? 'Équipement indicatif — marques et modèles confirmés dans la soumission ferme'
            : 'Indicative equipment — brands and models confirmed in the firm quote'}
        </p>
      </div>
    </div>
  );
}

function TimelineSlide({ language }: { language: string }) {
  const lang = language as "fr" | "en";
  const timeline = getTimeline(lang);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-6 md:px-8">
      <div className="max-w-6xl w-full">
        <SlideTitle>
          {language === 'fr' ? 'Échéancier Type' : 'Typical Timeline'}
        </SlideTitle>

        <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4">
          {timeline.map((tl, i) => {
            const isFirst = i === 0;
            const isLast = i === timeline.length - 1;

            return (
              <div key={i} className="flex flex-col md:flex-row items-center gap-2 md:gap-4">
                <div
                  className="rounded-xl px-5 py-4 text-center min-w-[140px] w-full md:w-auto shadow-sm"
                  style={{
                    backgroundColor: isFirst ? BRAND_COLORS.primaryBlue : isLast ? '#2D915F' : '#FFFFFF',
                    border: (isFirst || isLast) ? 'none' : '1px solid #E5E7EB',
                    color: (isFirst || isLast) ? '#FFFFFF' : '#1F2937',
                  }}
                >
                  <p className="font-bold text-base mb-1">{tl.step}</p>
                  {tl.duration && (
                    <p className="text-sm" style={{ opacity: 0.8 }}>{tl.duration}</p>
                  )}
                </div>
                {i < timeline.length - 1 && (
                  <>
                    <ArrowRight className="h-6 w-6 shrink-0 hidden md:block" style={{ color: BRAND_COLORS.accentGold }} />
                    <svg className="h-5 w-5 shrink-0 md:hidden" viewBox="0 0 24 24" fill="none" stroke={BRAND_COLORS.accentGold} strokeWidth="2">
                      <path d="M12 5v14M5 12l7 7 7-7" />
                    </svg>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-center text-sm mt-10" style={{ color: '#9CA3AF' }}>
          {language === 'fr'
            ? 'Délais sujets à approbation Hydro-Québec et conditions météorologiques'
            : 'Timelines subject to Hydro-Québec approval and weather conditions'}
        </p>
      </div>
    </div>
  );
}

function NextStepsSlide({ language }: { language: string }) {
  const lang = language as "fr" | "en";
  const designCovers = getDesignFeeCovers(lang);
  const clientProvidesList = getClientProvides(lang);
  const clientReceivesList = getClientReceives(lang);
  const contact = getContactString();

  const milestones = [
    {
      icon: FileText,
      label: language === 'fr' ? 'Signature' : 'Signature',
      duration: language === 'fr' ? 'Semaine 0' : 'Week 0',
      color: '#003DA6',
    },
    {
      icon: Settings,
      label: language === 'fr' ? 'Ingénierie' : 'Engineering',
      duration: language === 'fr' ? '4-6 sem.' : '4-6 wks',
      color: '#9CA3AF',
    },
    {
      icon: ClipboardCheck,
      label: language === 'fr' ? 'Permis' : 'Permits',
      duration: language === 'fr' ? '6-8 sem.' : '6-8 wks',
      color: '#9CA3AF',
    },
    {
      icon: Wrench,
      label: language === 'fr' ? 'Installation' : 'Installation',
      duration: language === 'fr' ? '4-8 sem.' : '4-8 wks',
      color: '#9CA3AF',
    },
    {
      icon: Zap,
      label: language === 'fr' ? 'Mise en service' : 'Commissioning',
      duration: language === 'fr' ? '~6 mois total' : '~6 months total',
      color: '#16A34A',
    },
  ];

  const columns = [
    {
      title: language === 'fr' ? 'Le Design Fee couvre' : 'The design fee covers',
      items: designCovers,
      icon: CheckCircle2,
      headerBg: BRAND_COLORS.primaryBlue,
      headerText: 'white',
    },
    {
      title: language === 'fr' ? 'Le client fournit' : 'The client provides',
      items: clientProvidesList,
      icon: Square,
      headerBg: BRAND_COLORS.accentGold,
      headerText: '#333',
    },
    {
      title: language === 'fr' ? 'Le client reçoit' : 'The client receives',
      items: clientReceivesList,
      icon: ArrowRight,
      headerBg: '#2D915F',
      headerText: 'white',
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-6 md:px-8">
      <div className="max-w-6xl w-full">
        <SlideTitle>
          {language === 'fr' ? 'Prochaines Étapes' : 'Next Steps'}
        </SlideTitle>

        <div className="rounded-2xl p-4 md:p-6 mb-8 shadow-sm" style={{ border: '1px solid #E5E7EB' }} data-testid="timeline-milestones">
          <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-4 md:gap-0 relative">
            {milestones.map((milestone, i) => (
              <div key={i} className="flex flex-col md:flex-col items-center relative z-10" style={{ flex: 1 }}>
                <div className="flex flex-row md:flex-col items-center gap-3 md:gap-0">
                  <div
                    className="h-11 w-11 md:h-12 md:w-12 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: milestone.color }}
                    data-testid={`milestone-circle-${i + 1}`}
                  >
                    <milestone.icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-left md:text-center md:mt-2">
                    <p className="text-xs md:text-sm font-semibold" style={{ color: '#1F2937' }}>{milestone.label}</p>
                    <p className="text-xs" style={{ color: '#6B7280' }}>{milestone.duration}</p>
                  </div>
                </div>
                {i < milestones.length - 1 && (
                  <>
                    <div
                      className="hidden md:block absolute top-5 md:top-6"
                      style={{
                        left: '50%',
                        width: '100%',
                        height: '2px',
                        backgroundColor: BRAND_COLORS.accentGold,
                        transform: 'translateX(50%)',
                      }}
                    />
                    <div
                      className="md:hidden"
                      style={{
                        width: '2px',
                        height: '16px',
                        backgroundColor: BRAND_COLORS.accentGold,
                        marginLeft: '22px',
                        alignSelf: 'flex-start',
                      }}
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 mb-10">
          {columns.map((col, i) => (
            <div key={i} className="rounded-2xl overflow-hidden shadow-sm" style={{ border: '1px solid #E5E7EB' }}>
              <div className="px-4 py-3" style={{ backgroundColor: col.headerBg }}>
                <h3 className="font-bold text-center" style={{ color: col.headerText }}>{col.title}</h3>
              </div>
              <div className="p-5 space-y-3">
                {col.items.map((item, j) => (
                  <div key={j} className="flex items-start gap-2">
                    <col.icon className="h-4 w-4 mt-0.5 shrink-0" style={{ color: '#6B7280' }} />
                    <span className="text-sm" style={{ color: '#4B5563' }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div
          className="rounded-2xl px-6 md:px-8 py-6 text-center shadow-sm"
          style={{ backgroundColor: 'rgba(0,61,166,0.05)', border: `2px solid ${BRAND_COLORS.primaryBlue}` }}
        >
          <p className="text-lg md:text-xl font-bold mb-2" style={{ color: BRAND_COLORS.primaryBlue }}>
            {language === 'fr' ? 'Contactez-nous pour planifier votre visite de site' : 'Contact us to schedule your site visit'}
          </p>
          <p className="text-base md:text-lg font-semibold" style={{ color: BRAND_COLORS.accentGold }}>{contact}</p>
        </div>
      </div>
    </div>
  );
}

function CredibilitySlide({ language }: { language: string }) {
  const lang = language as "fr" | "en";
  const stats = getAllStats(lang);
  const testimonial = getFirstTestimonial(lang);
  const contact = getContactString();
  const currentLogo = language === 'fr' ? logoFr : logoEn;

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-6 md:px-8">
      <div className="max-w-5xl w-full text-center">
        <SlideTitle>
          {language === 'fr' ? 'Ils Nous Font Confiance' : 'They Trust Us'}
        </SlideTitle>

        <div className="flex items-center justify-center gap-8 md:gap-16 flex-wrap mb-12">
          {stats.map((stat, i) => (
            <div key={i}>
              <p className="text-4xl md:text-6xl font-bold" style={{ color: BRAND_COLORS.accentGold }}>{stat.value}</p>
              <p className="text-sm mt-1" style={{ color: '#6B7280' }}>{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl p-6 md:p-8 mb-10 max-w-3xl mx-auto shadow-sm" style={{ border: '1px solid #E5E7EB' }}>
          <p className="text-lg md:text-xl italic mb-4" style={{ color: '#4B5563' }}>
            &laquo; {testimonial.quote} &raquo;
          </p>
          <p style={{ color: '#9CA3AF' }}>&mdash; {testimonial.author}</p>
        </div>

        <div
          className="rounded-2xl p-6 md:p-8 shadow-sm"
          style={{ backgroundColor: 'rgba(255,176,5,0.06)', border: `2px solid ${BRAND_COLORS.accentGold}` }}
        >
          <img
            src={currentLogo}
            alt="kWh Québec"
            className="h-12 md:h-14 mx-auto mb-4"
          />
          <p className="text-base md:text-lg mb-4" style={{ color: '#4B5563' }}>
            {language === 'fr'
              ? 'Votre partenaire pour la transition énergétique commerciale au Québec'
              : 'Your partner for commercial energy transition in Quebec'}
          </p>
          <p className="text-base md:text-lg font-bold" style={{ color: BRAND_COLORS.accentGold }}>{contact}</p>
        </div>
      </div>
    </div>
  );
}
