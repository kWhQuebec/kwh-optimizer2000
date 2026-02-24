import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ErrorBoundary } from "../components/ErrorBoundary";
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
  BarChart3,
  FileSignature,
  Calendar,
} from "lucide-react";

import logoFr from "@assets/kWh_Quebec_Logo-01_-_Rectangulaire_1764799021536.png";
import logoEn from "@assets/kWh_Quebec_Logo-02_-_Rectangle_1764799021536.png";
import { RoofVisualization } from "@/components/RoofVisualization";

const BRAND_COLORS = {
  primaryBlue: '#003DA6',
  accentGold: '#FFB005',
  darkBlue: '#002B75',
  positive: '#16A34A',
  negative: '#DC2626',
  neutral: '#6B7280',
  info: '#3B82F6',
};

import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  Cell,
  Line,
  Legend,
  ReferenceLine,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/lib/i18n";
import type { Site, Client, SimulationRun, CashflowEntry, HourlyProfileEntry } from "@shared/schema";
import { formatSmartPower, formatSmartEnergy, formatSmartCurrency as sharedFormatSmartCurrency, formatSmartCurrencyFull } from "@shared/formatters";
import { TIMELINE_GRADIENT } from "@shared/colors";
import {
  getAssumptions,
  getExclusions,
  getEquipment,
  getBatteryEquipment,
  getEquipmentTechnicalSummary,
  getTimeline,
  getAllStats,
  getContactString,
  getProjectSnapshotLabels,
  getDesignFeeCovers,
  getClientProvides,
  getClientReceives,
  getNarrativeAct,
  getWhySolarNow,
  getDesignMandatePrice,
  getDesignMandateIncludes,
  getMessagingLane,
  getDeliveryAssurance,
  getDeliveryPartners,
  getWarrantyRoadmap,
  BRAND_CONTENT,
  type BusinessDriver,
} from "@shared/brandContent";
import { computeFitScore } from "@shared/fitScore";

interface SiteWithDetails extends Site {
  client: Client;
  simulationRuns: SimulationRun[];
}

const SLIDES = [
  'hero',
  'whySolarNow',
  'billComparison',
  'energyProfile',
  'snapshot',
  'kpi',
  'waterfall',
  'cashflow',
  'financing',
  'surplusCredits',
  'assumptions',
  'systemElements',
  'deliveryAssurance',
  'fitScore',
  'nextSteps',
  'timeline',
  'credibility',
] as const;
type SlideType = typeof SLIDES[number];

function PresentationPage() {
  const { id } = useParams<{ id: string }>();
  const { language } = useI18n();
  const [currentSlide, setCurrentSlide] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const simIdFromUrl = urlParams.get('sim');
  const optFromUrl = (urlParams.get('opt') || 'npv') as 'npv' | 'irr' | 'selfSufficiency';

  const { data: site, isLoading } = useQuery<SiteWithDetails>({
    queryKey: ['/api/sites', id],
    enabled: !!id,
  });

  const bestSimulation = (() => {
    if (!site?.simulationRuns?.length) return null;
    if (simIdFromUrl) {
      const found = site.simulationRuns.find(s => s.id === simIdFromUrl);
      if (found) return found;
    }
    return [...site.simulationRuns].sort((a, b) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    )[0];
  })();

  const { data: fullSimulation } = useQuery<SimulationRun>({
    queryKey: ['/api/simulation-runs', bestSimulation?.id, 'full'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/simulation-runs/${bestSimulation!.id}/full`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to fetch full simulation');
      return res.json();
    },
    enabled: !!bestSimulation?.id,
  });

  const optimizedSimulation = (() => {
    const sim = fullSimulation ?? bestSimulation;
    if (!sim) return null;
    const sensitivity = sim.sensitivity as any;
    if (!sensitivity?.optimalScenarios) return sim;

    const targetMap: Record<string, any> = {
      npv: sensitivity.optimalScenarios.bestNPV,
      irr: sensitivity.optimalScenarios.bestIRR,
      selfSufficiency: sensitivity.optimalScenarios.maxSelfSufficiency,
    };
    const optimal = targetMap[optFromUrl] ?? sensitivity.optimalScenarios.bestNPV;
    if (!optimal) return sim;

    const merged = { ...sim } as any;
    merged.pvSizeKW = optimal.pvSizeKW;
    merged.battEnergyKWh = optimal.battEnergyKWh;
    merged.battPowerKW = optimal.battPowerKW;
    merged.capexNet = optimal.capexNet;
    merged.npv25 = optimal.npv25;
    merged.irr25 = optimal.irr25;
    merged.simplePaybackYears = optimal.simplePaybackYears;
    merged.selfSufficiencyPercent = optimal.selfSufficiencyPercent;
    merged.annualSavings = optimal.annualSavings;
    merged.savingsYear1 = optimal.annualSavings;
    merged.totalProductionKWh = optimal.totalProductionKWh;
    merged.co2AvoidedTonnesPerYear = optimal.co2AvoidedTonnesPerYear;

    const bd = optimal.scenarioBreakdown;
    if (bd) {
      merged.capexGross = bd.capexGross ?? sim.capexGross;
      merged.capexPV = bd.capexSolar ?? (sim as any).capexPV;
      merged.capexBattery = bd.capexBattery ?? (sim as any).capexBattery;
      merged.incentivesHQSolar = bd.actualHQSolar ?? (sim as any).incentivesHQSolar;
      merged.incentivesHQBattery = bd.actualHQBattery ?? (sim as any).incentivesHQBattery;
      merged.incentivesHQ = (merged.incentivesHQSolar ?? 0) + (merged.incentivesHQBattery ?? 0);
      merged.incentivesFederal = bd.itcAmount ?? (sim as any).incentivesFederal;
      merged.taxShield = bd.taxShield ?? (sim as any).taxShield;
      merged.totalIncentives = (merged.incentivesHQ ?? 0) + (merged.incentivesFederal ?? 0) + (merged.taxShield ?? 0);
      merged.lcoe = bd.lcoe ?? sim.lcoe;
      merged.annualCostAfter = Math.max(0, ((sim as any).annualCostBefore ?? 0) - (optimal.annualSavings ?? 0));
      merged.annualEnergySavingsKWh = bd.annualEnergySavingsKWh ?? (sim as any).annualEnergySavingsKWh;
      merged.totalExportedKWh = bd.totalExportedKWh ?? (sim as any).totalExportedKWh;
      merged.annualSurplusRevenue = bd.annualSurplusRevenue ?? (sim as any).annualSurplusRevenue;

      if (bd.hourlyProfileSummary && bd.hourlyProfileSummary.length > 0) {
        merged._scenarioHourlyProfileSummary = bd.hourlyProfileSummary;
      }

      if (bd.cashflows && bd.cashflows.length > 0) {
        let cumulative = -(merged.capexNet ?? merged.capexGross ?? 0);
        merged.cashflows = bd.cashflows.map((cf: any, i: number) => {
          if (i === 0) {
            cumulative = cf.netCashflow;
          } else {
            cumulative += cf.netCashflow;
          }
          return {
            year: cf.year,
            revenue: 0,
            opex: 0,
            ebitda: 0,
            investment: i === 0 ? -(merged.capexNet ?? 0) : 0,
            dpa: 0,
            incentives: 0,
            netCashflow: cf.netCashflow,
            cumulative,
          };
        });
      }
    }
    return merged as SimulationRun;
  })();

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

  const touchStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = touchStartRef.current.x - e.changedTouches[0].clientX;
    const dy = touchStartRef.current.y - e.changedTouches[0].clientY;
    const minSwipeDistance = 50;

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) >= minSwipeDistance) {
      if (dx > 0) {
        setCurrentSlide(prev => Math.min(prev + 1, SLIDES.length - 1));
      } else {
        setCurrentSlide(prev => Math.max(prev - 1, 0));
      }
    }
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

  const displaySim = optimizedSimulation ?? bestSimulation ?? null;

  const slideComponents: Record<SlideType, JSX.Element> = {
    hero: <HeroSlide site={site} simulation={displaySim} language={language} />,
    whySolarNow: <WhySolarNowSlide language={language} />,
    billComparison: <BillComparisonSlide simulation={displaySim} language={language} />,
    energyProfile: <EnergyProfileSlide simulation={displaySim} language={language} />,
    snapshot: <SnapshotSlide simulation={displaySim} language={language} />,
    kpi: <KPIResultsSlide simulation={displaySim} language={language} />,
    waterfall: <WaterfallSlide simulation={displaySim} language={language} />,
    cashflow: <CashflowSlide simulation={displaySim} language={language} />,
    surplusCredits: <SurplusCreditsSlide simulation={displaySim} language={language} />,
    financing: <FinancingSlide simulation={displaySim} language={language} />,
    assumptions: <AssumptionsSlide language={language} isSyntheticData={!fullSimulation?.hourlyProfile || (fullSimulation.hourlyProfile as any[]).length === 0} />,
    systemElements: <SystemElementsSlide simulation={displaySim} language={language} />,
    deliveryAssurance: <DeliveryAssuranceSlide language={language} />,
    fitScore: <FitScoreSlide simulation={displaySim} language={language} />,
    timeline: <TimelineSlide language={language} />,
    nextSteps: <NextStepsSlide simulation={displaySim} language={language} isSyntheticData={!displaySim?.hourlyProfile || (displaySim.hourlyProfile as any[]).length === 0} />,
    credibility: <CredibilitySlide language={language} />,
  };

  return (
    <div
      className="min-h-screen font-['Montserrat',sans-serif]"
      style={{
        background: '#FFFFFF',
        color: '#1F2937',
      }}
    >
      <div
        className="fixed top-0 left-0 right-0 z-50 backdrop-blur-sm"
        style={{
          backgroundColor: 'rgba(255,255,255,0.95)',
          borderBottom: '1px solid #E5E7EB',
        }}
      >
        <div className="flex items-center justify-between px-6 py-2">
          <div className="flex items-center gap-4">
            <img
              src={currentLogo}
              alt={language === "fr" ? "Logo kWh Québec – Présentation solaire" : "kWh Québec Logo – Solar Presentation"}
              className="h-14 w-auto"
              data-testid="logo-kwh-quebec"
            />
            <div className="h-8 w-px" style={{ backgroundColor: '#E5E7EB' }} />
            <Link href={`/app/sites/${id}`}>
              <Button variant="ghost" size="sm" style={{ color: BRAND_COLORS.primaryBlue }}>
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
              style={{ color: BRAND_COLORS.primaryBlue }}
              data-testid="button-fullscreen"
              aria-label={isFullscreen ? (language === 'fr' ? 'Quitter le plein écran' : 'Exit fullscreen') : (language === 'fr' ? 'Plein écran' : 'Fullscreen')}
            >
              {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      <div className="pt-20 pb-24 min-h-screen" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} role="region" aria-live="polite" aria-label={language === 'fr' ? 'Contenu de la diapositive' : 'Slide content'}>
        {slideComponents[slideContent]}
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur-sm"
        style={{
          backgroundColor: 'rgba(255,255,255,0.95)',
          borderTop: '1px solid #E5E7EB',
        }}
      >
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4">
          <Button
            variant="ghost"
            onClick={prevSlide}
            disabled={currentSlide === 0}
            className="disabled:opacity-30"
            style={{ color: BRAND_COLORS.primaryBlue }}
            data-testid="button-prev-slide"
            aria-label={language === 'fr' ? 'Slide précédent' : 'Previous slide'}
          >
            <ArrowLeft className="h-5 w-5 mr-0 md:mr-2" />
            <span className="hidden md:inline">{language === 'fr' ? 'Précédent' : 'Previous'}</span>
          </Button>

          <div className="flex flex-col items-center gap-1 md:gap-2">
            <div className="flex items-center gap-1 md:gap-1.5" role="tablist" aria-label={language === 'fr' ? 'Navigation des diapositives' : 'Slide navigation'}>
              {SLIDES.map((slide, index) => (
                <button
                  key={slide}
                  onClick={() => setCurrentSlide(index)}
                  className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full transition-all"
                  style={{
                    backgroundColor: index === currentSlide
                      ? BRAND_COLORS.accentGold
                      : '#D1D5DB',
                    transform: index === currentSlide ? 'scale(1.2)' : 'scale(1)'
                  }}
                  data-testid={`slide-indicator-${index}`}
                  role="tab"
                  aria-current={index === currentSlide ? "step" : undefined}
                  aria-label={`${language === 'fr' ? 'Diapositive' : 'Slide'} ${index + 1}`}
                />
              ))}
            </div>
            <span className="hidden md:inline text-xs" style={{ color: '#9CA3AF' }}>
              {currentSlide + 1}/{SLIDES.length} — {language === 'fr' ? 'Propulsé par' : 'Powered by'} kWh Québec
            </span>
          </div>

          <Button
            variant="ghost"
            onClick={nextSlide}
            disabled={currentSlide === SLIDES.length - 1}
            className="disabled:opacity-30"
            style={{ color: BRAND_COLORS.primaryBlue }}
            data-testid="button-next-slide"
            aria-label={language === 'fr' ? 'Slide suivant' : 'Next slide'}
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

function HeroSlide({ site, simulation, language }: { site: SiteWithDetails; simulation: SimulationRun | null; language: string }) {
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const hasCoords = site.latitude && site.longitude;
  const currentPVSizeKW = simulation?.pvSizeKW ? Number(simulation.pvSizeKW) : undefined;

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-6 md:px-8">
      <div className="max-w-6xl w-full">
        <div className="flex items-center justify-center mb-6">
          <div
            className="px-6 py-3 rounded-full flex items-center gap-3 shadow-sm"
            style={{ backgroundColor: BRAND_COLORS.accentGold }}
          >
            <Sun className="h-6 w-6 text-white" />
            <span className="text-white font-semibold text-base md:text-lg uppercase tracking-wider">
              {language === 'fr' ? 'Analyse solaire commerciale' : 'Commercial Solar Analysis'}
            </span>
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-6xl font-bold mb-3" style={{ color: BRAND_COLORS.primaryBlue }}>
            {site.client.name}
          </h1>
          <h2 className="text-2xl md:text-3xl font-light mb-4" style={{ color: '#4B5563' }}>
            {site.name}
          </h2>
          <div className="flex items-center justify-center gap-2" style={{ color: '#9CA3AF' }}>
            <MapPin className="h-5 w-5" />
            <span className="text-lg md:text-xl">
              {[site.address, site.city, site.postalCode].filter(Boolean).join(", ")}
            </span>
          </div>
        </div>

        {hasCoords && googleMapsApiKey ? (
          <div className="mx-auto max-w-5xl rounded-2xl overflow-hidden shadow-sm" style={{ border: '1px solid #E5E7EB' }}>
            <RoofVisualization
              siteId={site.id}
              siteName={site.name}
              address={site.address || ""}
              latitude={site.latitude!}
              longitude={site.longitude!}
              roofAreaSqFt={site.roofAreaAutoSqM ? site.roofAreaAutoSqM * 10.764 : undefined}
              currentPVSizeKW={currentPVSizeKW}
            />
          </div>
        ) : (
          <div className="rounded-2xl p-12 text-center mx-auto max-w-4xl shadow-sm" style={{ border: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' }}>
            <Building2 className="h-24 w-24 mx-auto mb-4" style={{ color: '#D1D5DB' }} />
            <p style={{ color: '#9CA3AF' }}>
              {language === 'fr' ? 'Image satellite non disponible' : 'Satellite image not available'}
            </p>
          </div>
        )}

        <div className="flex items-center justify-center gap-4 flex-wrap mt-6">
          {site.buildingType && (
            <Badge
              variant="secondary"
              className="text-base md:text-lg px-4 py-2"
              style={{ backgroundColor: 'rgba(0,61,166,0.08)', color: BRAND_COLORS.primaryBlue, borderColor: 'rgba(0,61,166,0.15)', borderWidth: 1 }}
            >
              <Building2 className="h-4 w-4 mr-2" style={{ color: BRAND_COLORS.primaryBlue }} />
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
              className="text-base md:text-lg px-4 py-2"
              style={{ backgroundColor: 'rgba(255,176,5,0.08)', color: '#92400E', borderColor: 'rgba(255,176,5,0.3)', borderWidth: 1 }}
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
          {language === 'fr' ? 'Votre facture avant / après' : 'Your Bill Before / After'}
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
              {costBefore > 0 ? sharedFormatSmartCurrency(costBefore, language) : '--'}
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
              {costAfter > 0 ? sharedFormatSmartCurrency(costAfter, language) : '--'}
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
                {sharedFormatSmartCurrency(savings, language)}
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

            <div className="mt-4 text-center" style={{ color: '#DC2626' }}>
              <p className="text-base font-semibold">
                {language === 'fr'
                  ? "C'est de l'argent que vous perdez chaque mois en inaction."
                  : "That's money you're losing every month through inaction."}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EnergyProfileSlide({ simulation, language }: { simulation: SimulationRun | null; language: string }) {
  const hourlyProfileData = useMemo(() => {
    const scenarioProfile = (simulation as any)?._scenarioHourlyProfileSummary;
    if (scenarioProfile && scenarioProfile.length > 0) {
      return scenarioProfile;
    }

    const rawProfile = simulation?.hourlyProfile as HourlyProfileEntry[] | null;
    if (!rawProfile || rawProfile.length === 0) return null;

    const byHour: Map<number, {
      consumptionSum: number;
      productionSum: number;
      peakBeforeSum: number;
      peakAfterSum: number;
      count: number;
    }> = new Map();

    for (const entry of rawProfile) {
      const existing = byHour.get(entry.hour) || {
        consumptionSum: 0, productionSum: 0, peakBeforeSum: 0, peakAfterSum: 0, count: 0,
      };
      existing.consumptionSum += entry.consumption;
      existing.productionSum += entry.production;
      existing.peakBeforeSum += entry.peakBefore;
      existing.peakAfterSum += entry.peakAfter;
      existing.count++;
      byHour.set(entry.hour, existing);
    }

    const result = [];
    for (let h = 0; h < 24; h++) {
      const data = byHour.get(h);
      if (data && data.count > 0) {
        const avgConsumption = data.consumptionSum / data.count;
        const avgProduction = data.productionSum / data.count;
        const avgPeakBefore = data.peakBeforeSum / data.count;
        const consumptionAfter = avgConsumption - avgProduction;
        const peakAfterNet = Math.max(0, avgPeakBefore - avgProduction);
        result.push({
          hour: `${h}h`,
          consumptionBefore: Math.round(avgConsumption),
          consumptionAfter: Math.max(0, Math.round(consumptionAfter)),
          peakBefore: Math.round(avgPeakBefore),
          peakAfter: Math.round(peakAfterNet),
        });
      }
    }
    return result;
  }, [simulation?.hourlyProfile, (simulation as any)?._scenarioHourlyProfileSummary]);

  if (!hourlyProfileData || hourlyProfileData.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <p style={{ color: '#9CA3AF' }}>
          {language === 'fr' ? 'Données horaires non disponibles' : 'Hourly data not available'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-6 md:px-8">
      <div className="max-w-6xl w-full">
        <SlideTitle>
          {language === 'fr' ? 'Profil moyen (Avant vs Après)' : 'Average Profile (Before vs After)'}
        </SlideTitle>

        <div className="rounded-2xl p-6 md:p-8 shadow-sm" style={{ border: '1px solid #E5E7EB' }}>
          <div style={{ height: 420 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={hourlyProfileData} margin={{ top: 10, right: 40, left: 10, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  label={{ value: language === 'fr' ? 'Heure' : 'Hour', position: 'bottom', offset: 10, style: { fontSize: 12, fill: '#6B7280' } }}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  label={{ value: 'kWh', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#6B7280' } }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  label={{ value: 'kW', angle: 90, position: 'insideRight', style: { fontSize: 12, fill: '#6B7280' } }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    fontSize: 13,
                  }}
                />
                <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: 10, fontSize: 13 }} />
                <Bar
                  yAxisId="left"
                  dataKey="consumptionBefore"
                  fill="#6B7280"
                  fillOpacity={0.4}
                  name={language === 'fr' ? 'kWh Avant' : 'kWh Before'}
                  radius={[2, 2, 0, 0]}
                  barSize={10}
                />
                <Bar
                  yAxisId="left"
                  dataKey="consumptionAfter"
                  fill={BRAND_COLORS.primaryBlue}
                  name={language === 'fr' ? 'kWh Après' : 'kWh After'}
                  radius={[2, 2, 0, 0]}
                  barSize={10}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="peakBefore"
                  stroke="#6B7280"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  name={language === 'fr' ? 'kW Avant' : 'kW Before'}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="peakAfter"
                  stroke={BRAND_COLORS.accentGold}
                  strokeWidth={2}
                  dot={false}
                  name={language === 'fr' ? 'kW Après' : 'kW After'}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function SnapshotSlide({ simulation, language }: { simulation: SimulationRun | null; language: string }) {
  const lang = language as "fr" | "en";
  const labels = getProjectSnapshotLabels(lang);
  const act1 = getNarrativeAct("act1_challenge", lang);
  const systemSize = simulation?.pvSizeKW ? formatSmartPower(Number(simulation.pvSizeKW), language, 'kWc') : null;

  const items = [
    { icon: Zap, label: labels.annualConsumption?.label || '', value: simulation?.annualConsumptionKWh ? formatSmartEnergy(simulation.annualConsumptionKWh, language) : '--' },
    { icon: TrendingUp, label: labels.peakDemand?.label || '', value: simulation?.peakDemandKW ? formatSmartPower(Number(simulation.peakDemandKW), language, 'kW') : '--' },
    { icon: Sun, label: labels.solarCapacity?.label || '', value: simulation?.pvSizeKW ? formatSmartPower(Number(simulation.pvSizeKW), language, 'kWc') : '--' },
    { icon: Battery, label: labels.batteryCapacity?.label || '', value: simulation?.battEnergyKWh && Number(simulation.battEnergyKWh) > 0 ? formatSmartEnergy(Number(simulation.battEnergyKWh), language) : '0 kWh' },
    { icon: Sun, label: labels.estimatedProduction?.label || '', value: simulation?.pvSizeKW ? formatSmartEnergy(Math.round(Number(simulation.pvSizeKW) * 1035), language) : '--' },
    { icon: CheckCircle2, label: labels.selfConsumptionRate?.label || '', value: simulation?.selfSufficiencyPercent ? `${Number(simulation.selfSufficiencyPercent).toFixed(0)}%` : '--' },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-6 md:px-8">
      <div className="max-w-6xl w-full">
        <SlideTitle
          subtitle={systemSize ? (language === 'fr' ? `Système de ${systemSize} proposé` : `Proposed ${systemSize} system`) : undefined}
        >
          {language === 'fr' ? 'Aperçu du projet' : 'Project Snapshot'}
        </SlideTitle>
        <p className="text-center text-base mb-2" style={{ color: BRAND_COLORS.primaryBlue, fontWeight: '500' }}>
          {language === 'fr' ? 'Voici ce que nous avons découvert sur votre bâtiment' : 'Here\'s what we discovered about your building'}
        </p>
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

        {simulation?.productionP50KWh && simulation?.productionP90KWh && (
          <p className="text-center text-xs mt-4" style={{ color: '#9CA3AF' }}>
            {language === 'fr'
              ? `Productible P50: ${Math.round(simulation.productionP50KWh).toLocaleString()} kWh/kWp | P90: ${Math.round(simulation.productionP90KWh).toLocaleString()} kWh/kWp`
              : `Production P50: ${Math.round(simulation.productionP50KWh).toLocaleString()} kWh/kWp | P90: ${Math.round(simulation.productionP90KWh).toLocaleString()} kWh/kWp`}
          </p>
        )}
      </div>
    </div>
  );
}

function KPIResultsSlide({ simulation, language }: { simulation: SimulationRun | null; language: string }) {
  const npv25Val = simulation?.npv25 ? Number(simulation.npv25) : 0;

  const kpis = [
    {
      icon: DollarSign,
      label: language === 'fr' ? 'Économies an 1' : 'Year 1 Savings',
      value: simulation?.savingsYear1 ? sharedFormatSmartCurrency(simulation.savingsYear1, language) : '--',
      highlight: false
    },
    {
      icon: TrendingUp,
      label: language === 'fr' ? 'Investissement net' : 'Net Investment',
      value: simulation?.capexNet ? sharedFormatSmartCurrency(Number(simulation.capexNet), language) : '--',
      highlight: false
    },
    {
      icon: Zap,
      label: language === 'fr' ? 'Profit net (VAN)' : 'Net Profit (NPV)',
      value: simulation?.npv25 ? sharedFormatSmartCurrency(npv25Val, language) : '--',
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

  const co2Total25 = Math.round(co2Tonnes * 25);
  const treesEquiv = Math.round((co2Tonnes * 25 * 1000) / 21.77);
  const carsRemoved = Math.round((co2Tonnes / 4.6) * 25);
  const totalProdKWh = simulation?.totalProductionKWh ? Number(simulation.totalProductionKWh) : (simulation?.pvSizeKW ? Number(simulation.pvSizeKW) * 1035 : 0);
  const homesPowered = totalProdKWh > 0 ? Math.round(totalProdKWh / 20000) : 0;

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-6 md:px-8">
      <div className="max-w-7xl w-full">
        <SlideTitle
          subtitle={npv25Val > 0 ? (language === 'fr' ? `Votre bâtiment génère un profit net de ${sharedFormatSmartCurrency(npv25Val, language)} sur 25 ans` : `Your building generates a net profit of ${sharedFormatSmartCurrency(npv25Val, language)} over 25 years`) : undefined}
        >
          {language === 'fr' ? 'Vos résultats' : 'Your Results'}
        </SlideTitle>

        {simulation?.pvSizeKW && (
          <p className="text-center mb-6" style={{ color: '#6B7280' }}>
            {language === 'fr' ? 'Système: ' : 'System: '}
            <span className="font-semibold" style={{ color: '#1F2937' }}>{formatSmartPower(Number(simulation.pvSizeKW), language, 'kWc')}</span>
            {Number(simulation.battEnergyKWh) > 0 && (
              <> + <span className="font-semibold" style={{ color: '#1F2937' }}>{formatSmartEnergy(Number(simulation.battEnergyKWh), language)}</span></>
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

        {/* Business Driver Messaging Lane */}
        {(() => {
          const driver = ((simulation as any)?.businessDriver || "other") as BusinessDriver;
          const lane = getMessagingLane(driver, language as "fr" | "en");
          return (
            <div className="text-center mb-8 px-4 py-6 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.6)', border: '1px solid #E5E7EB' }}>
              <span className="text-3xl mb-2 block">{lane.iconEmoji}</span>
              <h2 className="text-xl md:text-2xl font-bold mb-2" style={{ color: lane.color }}>
                {lane.headline}
              </h2>
              <p className="text-sm max-w-2xl mx-auto" style={{ color: '#6B7280' }}>
                {lane.subline}
              </p>
            </div>
          );
        })()}

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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 rounded-xl p-4 shadow-sm" style={{ border: '1px solid #E5E7EB', backgroundColor: '#F0FDF4' }}>
              <Leaf className="h-8 w-8 shrink-0" style={{ color: '#16A34A' }} />
              <div>
                <p className="text-xl font-bold" style={{ color: '#166534' }}>{co2Total25.toLocaleString()}</p>
                <p className="text-xs" style={{ color: '#6B7280' }}>{language === 'fr' ? 't CO₂ évitées (25 ans)' : 't CO₂ avoided (25 yrs)'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl p-4 shadow-sm" style={{ border: '1px solid #E5E7EB', backgroundColor: '#EFF6FF' }}>
              <Car className="h-8 w-8 shrink-0" style={{ color: BRAND_COLORS.primaryBlue }} />
              <div>
                <p className="text-xl font-bold" style={{ color: BRAND_COLORS.primaryBlue }}>{carsRemoved.toLocaleString()}</p>
                <p className="text-xs" style={{ color: '#6B7280' }}>{language === 'fr' ? 'années-auto retirées' : 'car-years removed'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl p-4 shadow-sm" style={{ border: '1px solid #E5E7EB', backgroundColor: '#F0FDF4' }}>
              <TreePine className="h-8 w-8 shrink-0" style={{ color: '#16A34A' }} />
              <div>
                <p className="text-xl font-bold" style={{ color: '#166534' }}>{treesEquiv.toLocaleString()}</p>
                <p className="text-xs" style={{ color: '#6B7280' }}>{language === 'fr' ? 'arbres équivalents' : 'trees equivalent'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl p-4 shadow-sm" style={{ border: '1px solid #E5E7EB', backgroundColor: '#FFFBEB' }}>
              <Home className="h-8 w-8 shrink-0" style={{ color: '#D97706' }} />
              <div>
                <p className="text-xl font-bold" style={{ color: '#92400E' }}>{homesPowered.toLocaleString()}</p>
                <p className="text-xs" style={{ color: '#6B7280' }}>{language === 'fr' ? 'maisons alimentées' : 'homes powered'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Collapsible Assumptions Section */}
        <AssumptionsCollapsible simulation={simulation} language={language} />
      </div>
    </div>
  );
}

// Collapsible Assumptions Component
function AssumptionsCollapsible({ simulation, language }: { simulation: SimulationRun | null; language: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const marketingAssumptions = [
    { label: language === 'fr' ? 'Escalade prix électricité' : 'Utility price escalation', value: '3.5%/yr' },
    { label: language === 'fr' ? 'Dégradation panneaux' : 'Panel degradation', value: '0.4%/yr' },
    { label: language === 'fr' ? 'Ratio DC:AC' : 'DC:AC ratio', value: '1.40–1.47' },
    { label: language === 'fr' ? 'Durée de vie système' : 'System lifespan', value: '25 years' },
    { label: language === 'fr' ? 'Autoconsommation estimée' : 'Est. self-consumption', value: '~90%' },
    { label: language === 'fr' ? 'Taux d\'actualisation (WACC)' : 'Discount rate (WACC)', value: '7%' },
    { label: language === 'fr' ? 'O&M solaire (% CAPEX)' : 'Solar O&M (% CAPEX)', value: '1.0%/yr' },
  ];

  return (
    <div className="mt-8 border border-gray-200 rounded-xl overflow-hidden bg-white">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
        style={{ borderBottom: isExpanded ? '1px solid #E5E7EB' : 'none' }}
      >
        <span className="text-base md:text-lg font-semibold" style={{ color: BRAND_COLORS.primaryBlue }}>
          {language === 'fr' ? 'Hypothèses de calcul' : 'Calculation Assumptions'}
        </span>
        <ChevronLeft
          className="h-5 w-5 transition-transform duration-300"
          style={{
            color: BRAND_COLORS.primaryBlue,
            transform: isExpanded ? 'rotate(-90deg)' : 'rotate(0deg)'
          }}
        />
      </button>

      {isExpanded && (
        <div className="px-6 py-4">
          <div className="space-y-3">
            {marketingAssumptions.map((assumption, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                <span className="text-sm" style={{ color: '#6B7280' }}>
                  {assumption.label}
                </span>
                <span className="text-sm font-semibold" style={{ color: '#1F2937' }}>
                  {assumption.value}
                </span>
              </div>
            ))}

            {(simulation?.assumptions as any)?.tariffCode && (
              <>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm" style={{ color: '#6B7280' }}>
                    {language === 'fr' ? 'Code tarifaire' : 'Tariff code'}
                  </span>
                  <span className="text-sm font-semibold" style={{ color: '#1F2937' }}>
                    {(simulation?.assumptions as any)?.tariffCode}
                  </span>
                </div>
              </>
            )}

            {simulation?.pvSizeKW && (
              <>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm" style={{ color: '#6B7280' }}>
                    {language === 'fr' ? 'Puissance solaire' : 'Solar capacity'}
                  </span>
                  <span className="text-sm font-semibold" style={{ color: '#1F2937' }}>
                    {formatSmartPower(Number(simulation.pvSizeKW), language, 'kWc')}
                  </span>
                </div>
              </>
            )}

            {simulation?.lcoe && (
              <>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm" style={{ color: '#6B7280' }}>
                    {language === 'fr' ? 'Coût nivelé (LCOE)' : 'Levelized Cost (LCOE)'}
                  </span>
                  <span className="text-sm font-semibold" style={{ color: '#1F2937' }}>
                    {Number(simulation.lcoe).toFixed(2)} ¢/kWh
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
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
    { label: language === 'fr' ? 'CAPEX Brut' : 'Gross CAPEX', value: capexGross, type: 'start' as const, color: '#6B7280' },
    { label: language === 'fr' ? '- Hydro-Québec Solaire' : '- Hydro-Québec Solar', value: hqSolar, type: 'deduction' as const, color: '#FFB005' },
    { label: language === 'fr' ? '- Hydro-Québec Batterie' : '- Hydro-Québec Battery', value: hqBattery, type: 'deduction' as const, color: '#FFB005' },
    { label: language === 'fr' ? '- Crédit fédéral (ITC)' : '- Federal ITC', value: itcFederal, type: 'deduction' as const, color: '#3B82F6' },
    { label: language === 'fr' ? '- Bouclier fiscal' : '- Tax Shield', value: taxShield, type: 'deduction' as const, color: '#3B82F6' },
    { label: language === 'fr' ? 'CAPEX Net' : 'Net CAPEX', value: capexNet, type: 'total' as const, color: BRAND_COLORS.primaryBlue },
  ].filter(bar => bar.type === 'start' || bar.type === 'total' || bar.value > 0);

  const maxVal = Math.max(capexGross, 1);
  const chartHeight = 300;
  let running = capexGross;

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-6 md:px-8">
      <div className="max-w-6xl w-full">
        <SlideTitle
          subtitle={capexGross > 0 ? (language === 'fr' ? `Réduction de ${savingsPercent} % du coût d'investissement grâce aux incitatifs` : `${savingsPercent}% investment cost reduction through incentives`) : undefined}
        >
          {language === 'fr' ? "Ventilation de l'investissement" : 'Investment Breakdown'}
        </SlideTitle>

        {capexGross > 0 ? (
          <>
            <div className="rounded-2xl p-6 md:p-8 shadow-sm" style={{ border: '1px solid #E5E7EB' }}>
              <div className="flex items-end justify-center gap-3 md:gap-4" style={{ height: chartHeight + 60 }}>
                {bars.map((bar, i) => {
                  const barHeight = Math.max(8, (bar.value / maxVal) * chartHeight);

                  let topOffset: number;
                  if (bar.type === 'start') {
                    topOffset = chartHeight - barHeight;
                  } else if (bar.type === 'deduction') {
                    const runningHeight = (running / maxVal) * chartHeight;
                    topOffset = chartHeight - runningHeight;
                    running -= bar.value;
                  } else {
                    topOffset = chartHeight - barHeight;
                  }

                  return (
                    <div key={i} className="flex flex-col items-center min-w-[50px] md:min-w-[60px]" style={{ width: '14%' }}>
                      <div className={`${bars.length >= 6 ? 'text-xs' : 'text-sm'} font-bold mb-1`} style={{ color: '#1F2937' }}>
                        {bar.type === 'start' || bar.type === 'total' ? sharedFormatSmartCurrency(bar.value, language) : `-${formatSmartCurrencyFull(bar.value, language)}`}
                      </div>
                      <div className="w-full relative" style={{ height: chartHeight }}>
                        <div style={{ height: topOffset }} />
                        <div
                          className="w-full rounded-t"
                          style={{
                            height: barHeight,
                            backgroundColor: bar.color,
                          }}
                        />
                      </div>
                      <p className="text-xs text-center mt-2 leading-tight" style={{ color: '#6B7280', height: '2.5em', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>{bar.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-4 mt-6">
              {[
                { label: language === 'fr' ? 'Hydro-Québec solaire' : 'Hydro-Québec Solar', value: hqSolar },
                { label: language === 'fr' ? 'Hydro-Québec batterie' : 'Hydro-Québec Battery', value: hqBattery },
                { label: language === 'fr' ? 'Crédit fédéral (ITC)' : 'Federal ITC', value: itcFederal },
                { label: language === 'fr' ? 'Bouclier fiscal' : 'Tax Shield', value: taxShield },
              ].filter(item => item.value > 0).map((item, i) => (
                <div key={i} className="rounded-xl p-4 text-center shadow-sm min-w-[160px] flex-1 max-w-[220px]" style={{ border: '1px solid #E5E7EB' }}>
                  <p className="text-sm" style={{ color: '#6B7280' }}>{item.label}</p>
                  <p className="text-lg md:text-xl font-bold" style={{ color: BRAND_COLORS.accentGold }}>-{formatSmartCurrencyFull(item.value, language)}</p>
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

function computeAcquisitionSeries(simulation: SimulationRun) {
  const capexGross = (simulation as any).capexGross || simulation.capexNet || 0;
  const annualSavings = simulation.savingsYear1 || simulation.annualSavings || 0;
  const hqSolar = (simulation as any).incentivesHQSolar || 0;
  const hqBattery = (simulation as any).incentivesHQBattery || 0;
  const federalITC = (simulation as any).incentivesFederal || 0;
  const taxShield = (simulation as any).taxShield || 0;

  const loanTermYears = 10;
  const loanInterestRate = 7;
  const loanDownPaymentPct = 30;
  const leaseTermYears = 15;
  const leaseImplicitRate = 8.5;

  const loanDownPaymentAmount = capexGross * loanDownPaymentPct / 100;
  const loanAmount = capexGross - loanDownPaymentAmount;
  const monthlyRate = loanInterestRate / 100 / 12;
  const numPayments = loanTermYears * 12;
  const monthlyPayment = monthlyRate > 0
    ? (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)
    : loanAmount / numPayments;
  const annualLoanPayment = monthlyPayment * 12;

  const leaseFinancedAmount = capexGross;
  const leaseMonthlyRate = leaseImplicitRate / 100 / 12;
  const leaseNumPayments = leaseTermYears * 12;
  const leaseMonthlyPayment = leaseFinancedAmount > 0 && leaseMonthlyRate > 0
    ? (leaseFinancedAmount * leaseMonthlyRate * Math.pow(1 + leaseMonthlyRate, leaseNumPayments)) / (Math.pow(1 + leaseMonthlyRate, leaseNumPayments) - 1)
    : leaseFinancedAmount / Math.max(1, leaseNumPayments);
  const annualLeasePayment = leaseMonthlyPayment * 12;

  const upfrontCashNeeded = capexGross - hqSolar - (hqBattery * 0.5);
  const year1Returns = (hqBattery * 0.5) + taxShield;
  const year2Returns = federalITC;

  let cashCumulative = -upfrontCashNeeded;
  let loanCumulative = -loanDownPaymentAmount;
  let leaseCumulative = (hqSolar * 0.5) + (hqBattery * 0.5);

  const cashflowData = simulation?.cashflows as CashflowEntry[] | undefined;

  const data: { year: number; cash: number; loan: number; lease: number; annual: number }[] = [];
  let cashPaybackYear: number | null = null;

  for (let year = 1; year <= 25; year++) {
    const cf = cashflowData?.find(c => c.year === year);
    if (cf) {
      cashCumulative = cf.cumulative;
    } else {
      cashCumulative += annualSavings;
      if (year === 1) cashCumulative += year1Returns;
      if (year === 2) cashCumulative += year2Returns;
    }

    loanCumulative += annualSavings;
    leaseCumulative += annualSavings;

    if (year <= loanTermYears) loanCumulative -= annualLoanPayment;
    if (year <= leaseTermYears) leaseCumulative -= annualLeasePayment;

    if (year === 1) {
      loanCumulative += year1Returns;
      leaseCumulative += year1Returns + (hqSolar * 0.5);
    }
    if (year === 2) {
      loanCumulative += year2Returns;
      leaseCumulative += year2Returns;
    }

    if (cashPaybackYear === null && cashCumulative >= 0) cashPaybackYear = year;

    data.push({
      year,
      cash: Math.round(cashCumulative),
      loan: Math.round(loanCumulative),
      lease: Math.round(leaseCumulative),
      annual: cf?.netCashflow || 0,
    });
  }

  return { data, cashPaybackYear };
}

function CashflowSlide({ simulation, language }: { simulation: SimulationRun | null; language: string }) {
  if (!simulation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-6 md:px-8">
        <div className="max-w-6xl w-full">
          <SlideTitle>{language === 'fr' ? 'Projections financières' : 'Financial Projections'}</SlideTitle>
          <div className="rounded-2xl p-12 text-center shadow-sm" style={{ border: '1px solid #E5E7EB' }}>
            <p style={{ color: '#6B7280' }}>{language === 'fr' ? 'Données de cash-flow non disponibles.' : 'Cash flow data not available.'}</p>
          </div>
        </div>
      </div>
    );
  }

  const { data: chartData, cashPaybackYear } = computeAcquisitionSeries(simulation);
  const savingsYear1 = simulation?.savingsYear1 || 0;
  const costOfInaction = savingsYear1 * 25;

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-6 md:px-8">
      <div className="max-w-6xl w-full">
        <SlideTitle
          subtitle={cashPaybackYear ? (language === 'fr' ? `Rentable en ${cashPaybackYear} ans (comptant)` : `Payback in ${cashPaybackYear} years (cash)`) : undefined}
        >
          {language === 'fr' ? "Projections financières — Options d'acquisition" : 'Financial Projections — Acquisition Options'}
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
                    tickFormatter={(value: number) => sharedFormatSmartCurrency(value, language)}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px', color: '#1F2937' }}
                    labelStyle={{ color: '#1F2937', fontWeight: 'bold' }}
                    formatter={(value: number, name: string) => {
                      const labels: Record<string, string> = language === 'fr'
                        ? { cash: 'Comptant', loan: 'Prêt', lease: 'Crédit-bail 15 ans', annual: 'Cash-flow annuel' }
                        : { cash: 'Cash', loan: 'Loan', lease: '15-yr Lease', annual: 'Annual cash flow' };
                      return [formatSmartCurrencyFull(value, language), labels[name] || name];
                    }}
                  />
                  <Legend
                    wrapperStyle={{ color: '#6B7280' }}
                    formatter={(value) => {
                      const labels: Record<string, string> = language === 'fr'
                        ? { cash: 'Comptant', loan: 'Prêt', lease: 'Crédit-bail 15 ans', annual: 'Cash-flow annuel (comptant)' }
                        : { cash: 'Cash', loan: 'Loan', lease: '15-yr Lease', annual: 'Annual cash flow (cash)' };
                      return labels[value] || value;
                    }}
                  />
                  <Bar dataKey="annual" radius={[2, 2, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.annual >= 0 ? '#16A34A' : '#DC2626'} opacity={0.3} />
                    ))}
                  </Bar>
                  <Line type="monotone" dataKey="cash" stroke={BRAND_COLORS.positive} strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="loan" stroke={BRAND_COLORS.primaryBlue} strokeWidth={2.5} dot={false} strokeDasharray="6 3" />
                  <Line type="monotone" dataKey="lease" stroke={BRAND_COLORS.accentGold} strokeWidth={2.5} dot={false} strokeDasharray="4 2" />
                  <Line type="monotone" dataKey={() => 0} stroke="#D1D5DB" strokeDasharray="5 5" dot={false} name="zero" legendType="none" />
                  {cashPaybackYear && (
                    <ReferenceLine
                      x={cashPaybackYear}
                      stroke={BRAND_COLORS.positive}
                      strokeWidth={1.5}
                      strokeDasharray="5 3"
                      label={{
                        value: language === 'fr' ? `Récup. An ${cashPaybackYear}` : `Payback Yr ${cashPaybackYear}`,
                        position: 'top',
                        fill: BRAND_COLORS.positive,
                        fontSize: 13,
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
                  {language === 'fr' ? "Ne rien faire coûtera" : 'Doing nothing will cost'} {sharedFormatSmartCurrency(costOfInaction, language)} {language === 'fr' ? "sur 25 ans" : "over 25 years"}
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
              {formatSmartEnergy(exported, language)}
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
              {sharedFormatSmartCurrency(revenue, language)}
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
      keyNumber: capexNet > 0 ? formatSmartCurrencyFull(capexNet, language) : '--',
      keyLabel: language === 'fr' ? 'Investissement net' : 'Net investment',
      bullets: [
        language === 'fr' ? `Économies An 1: ${formatSmartCurrencyFull(savingsYear1, language)}` : `Year 1 savings: ${formatSmartCurrencyFull(savingsYear1, language)}`,
        language === 'fr' ? `Retour simple: ${paybackYears} ans` : `Simple payback: ${paybackYears} years`,
        language === 'fr' ? `VAN 25 ans: ${formatSmartCurrencyFull(npv25, language)}` : `25yr NPV: ${formatSmartCurrencyFull(npv25, language)}`,
      ],
    },
    {
      key: 'loan',
      title: language === 'fr' ? 'Financement' : 'Loan',
      icon: CreditCard,
      recommended: false,
      keyNumber: capexNet > 0 ? `${formatSmartCurrencyFull(loanMonthly, language)}/m` : '--',
      keyLabel: language === 'fr' ? 'Paiement mensuel' : 'Monthly payment',
      bullets: [
        language === 'fr' ? `Taux: 5 %, terme 10 ans` : `Rate: 5%, 10yr term`,
        language === 'fr' ? `Net an 1: ${formatSmartCurrencyFull(loanNetYear1, language)}` : `Net Year 1: ${formatSmartCurrencyFull(loanNetYear1, language)}`,
        language === 'fr' ? `Annuel: ${formatSmartCurrencyFull(loanAnnualPayment, language)}` : `Annual: ${formatSmartCurrencyFull(loanAnnualPayment, language)}`,
      ],
    },
    {
      key: 'lease',
      title: language === 'fr' ? 'Location / Crédit-bail' : 'Lease',
      icon: Receipt,
      recommended: false,
      keyNumber: capexNet > 0 ? `${formatSmartCurrencyFull(leaseMonthly, language)}/m` : '--',
      keyLabel: language === 'fr' ? 'Paiement mensuel' : 'Monthly payment',
      bullets: [
        language === 'fr' ? `Taux: 7 %, terme 15 ans` : `Rate: 7%, 15yr term`,
        language === 'fr' ? `Net an 1: ${formatSmartCurrencyFull(leaseNetYear1, language)}` : `Net Year 1: ${formatSmartCurrencyFull(leaseNetYear1, language)}`,
        language === 'fr' ? 'Aucun investissement initial' : 'No upfront investment',
      ],
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-6 md:px-8">
      <div className="max-w-6xl w-full">
        <SlideTitle>
          {language === 'fr' ? "Options d'acquisition" : 'Acquisition Options'}
        </SlideTitle>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
          {options.map((opt) => (
            <div
              key={opt.key}
              className="rounded-2xl p-5 md:p-6 shadow-sm relative"
              style={{
                border: '1px solid #E5E7EB',
              }}
              data-testid={`card-financing-${opt.key}`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(0,61,166,0.08)' }}
                >
                  <opt.icon className="h-5 w-5" style={{ color: BRAND_COLORS.primaryBlue }} />
                </div>
                <h3 className="text-lg font-bold" style={{ color: BRAND_COLORS.primaryBlue }}>{opt.title}</h3>
              </div>
              <p className="text-2xl md:text-3xl font-bold mb-1" style={{ color: BRAND_COLORS.primaryBlue }}>
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

function AssumptionsSlide({ language, isSyntheticData }: { language: string; isSyntheticData?: boolean }) {
  const lang = language as "fr" | "en";
  const assumptions = getAssumptions(lang, isSyntheticData);
  const exclusions = getExclusions(lang);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-6 md:px-8">
      <div className="max-w-6xl w-full">
        <SlideTitle>
          {language === 'fr' ? 'Hypothèses et exclusions' : 'Assumptions & Exclusions'}
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

function TimelineSlide({ language }: { language: string }) {
  const lang = language as "fr" | "en";
  const timeline = getTimeline(lang);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-6 md:px-8">
      <div className="max-w-6xl w-full">
        <SlideTitle>
          {language === 'fr' ? 'Échéancier préliminaire' : 'Preliminary Timeline'}
        </SlideTitle>

        <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4">
          {timeline.map((tl, i) => {
            const isFirst = i === 0;
            const isLast = i === timeline.length - 1;

            return (
              <div key={i} className="flex flex-col md:flex-row items-center gap-2 md:gap-4">
                <div
                  className="rounded-xl px-3 py-4 text-center w-full md:w-[140px] shadow-sm flex flex-col items-center justify-center"
                  style={{
                    backgroundColor: TIMELINE_GRADIENT.getStepHex(i, timeline.length),
                    border: 'none',
                    color: TIMELINE_GRADIENT.getStepTextColor(i, timeline.length),
                    minHeight: '90px',
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

        {/* Total duration bracket */}
        <div className="hidden md:block max-w-6xl w-full mt-6 px-6" data-testid="timeline-total-bracket">
          <div className="relative mx-auto" style={{ maxWidth: `${timeline.length * 172}px` }}>
            {/* Bracket shape: left tick + horizontal line + right tick (ticks point up toward timeline) */}
            <div className="flex items-end">
              <div className="w-[2px] h-3" style={{ backgroundColor: BRAND_COLORS.primaryBlue }} />
              <div className="flex-1 h-[2px] mb-0" style={{ backgroundColor: BRAND_COLORS.primaryBlue }} />
              <div className="w-[2px] h-3" style={{ backgroundColor: BRAND_COLORS.primaryBlue }} />
            </div>
            {/* Total label */}
            <p className="text-center text-sm font-semibold mt-2" style={{ color: BRAND_COLORS.accentGold }}>
              {language === 'fr'
                ? 'Délai total approximatif : 4 à 8 mois'
                : 'Approximate total timeline: 4 to 8 months'}
            </p>
          </div>
        </div>
        {/* Mobile total duration */}
        <div className="md:hidden text-center mt-4" data-testid="timeline-total-mobile">
          <p className="text-sm font-semibold" style={{ color: BRAND_COLORS.accentGold }}>
            {language === 'fr'
              ? 'Délai total approximatif : 4 à 8 mois'
              : 'Approximate total timeline: 4 to 8 months'}
          </p>
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

function NextStepsSlide({ simulation, language, isSyntheticData = true }: { simulation: SimulationRun | null; language: string; isSyntheticData?: boolean }) {
  const lang = language as "fr" | "en";
  const designCovers = getDesignFeeCovers(lang);
  const clientProvidesList = getClientProvides(lang);
  const clientReceivesList = getClientReceives(lang);
  const contact = getContactString();

  const capexGross = Number(simulation?.capexGross || 0);
  const hqSolar = Number(simulation?.incentivesHQSolar || 0);
  const hqBattery = Number(simulation?.incentivesHQBattery || 0);
  const itcFederal = Number(simulation?.incentivesFederal || 0);
  const taxShield = Number(simulation?.taxShield || 0);
  const totalIncentives = hqSolar + hqBattery + itcFederal + taxShield;
  const incentivePercent = capexGross > 0 ? Math.round((totalIncentives / capexGross) * 100) : 60;

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
      headerBg: '#16A34A',
      headerText: 'white',
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-6 md:px-8">
      <div className="max-w-6xl w-full">
        <SlideTitle>
          {language === 'fr' ? 'Passons à l\'action' : 'Let\'s Take Action'}
        </SlideTitle>

        {!isSyntheticData && (
          <div
            className="rounded-2xl px-6 py-4 mb-6 text-center shadow-sm"
            style={{ backgroundColor: 'rgba(22,163,74,0.06)', border: '2px solid rgba(22,163,74,0.3)' }}
            data-testid="banner-analysis-complete"
          >
            <div className="flex items-center justify-center gap-2 mb-1">
              <CheckCircle2 className="h-5 w-5" style={{ color: '#16A34A' }} />
              <p className="text-base md:text-lg font-bold" style={{ color: '#16A34A' }}>
                {language === 'fr' ? 'Votre analyse est complétée' : 'Your analysis is complete'}
              </p>
            </div>
            <p className="text-sm" style={{ color: '#4B5563' }}>
              {language === 'fr'
                ? 'La prochaine étape : signer le mandat de conception préliminaire pour valider les conditions de votre site.'
                : 'Next step: sign the Preliminary Design Mandate to validate your site conditions.'}
            </p>
          </div>
        )}


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

        {!isSyntheticData && (
          <div
            className="rounded-2xl px-6 md:px-8 py-6 mb-10 shadow-sm"
            style={{ backgroundColor: 'rgba(255,176,5,0.06)', border: `2px solid ${BRAND_COLORS.accentGold}` }}
          >
            <h3 className="text-lg md:text-xl font-bold mb-3 text-center" style={{ color: BRAND_COLORS.accentGold }}>
              {getDesignMandatePrice(language as "fr" | "en")}
            </h3>
            <div className="max-w-2xl mx-auto">
              <div className="space-y-2">
                {getDesignMandateIncludes(language as "fr" | "en").slice(0, 4).map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" style={{ color: BRAND_COLORS.accentGold }} />
                    <span className="text-sm" style={{ color: '#4B5563' }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {isSyntheticData ? (
          // Unqualified lead: Show Calendly booking CTA
          <div
            className="rounded-2xl px-6 md:px-8 py-6 shadow-sm"
            style={{ backgroundColor: 'rgba(0,61,166,0.05)', border: `2px solid ${BRAND_COLORS.primaryBlue}` }}
          >
            <div className="flex items-center gap-3 mb-4 justify-center">
              <Calendar className="h-6 w-6" style={{ color: BRAND_COLORS.primaryBlue }} />
              <h3 className="text-lg md:text-xl font-bold" style={{ color: BRAND_COLORS.primaryBlue }}>
                {language === 'fr' ? 'Prochaine étape : validez votre projet' : 'Next step: validate your project'}
              </h3>
            </div>
            <p className="text-sm mb-4 text-center" style={{ color: '#4B5563' }}>
              {language === 'fr'
                ? 'Un appel de 10 minutes avec notre équipe pour confirmer la faisabilité et débloquer votre rapport PDF personnalisé.'
                : 'A 10-minute call with our team to confirm feasibility and unlock your personalized PDF report.'}
            </p>
            {import.meta.env.VITE_CALENDLY_URL ? (
              <div className="flex justify-center mb-4">
                <a
                  href={import.meta.env.VITE_CALENDLY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white text-base font-medium transition-opacity hover:opacity-90"
                  style={{ backgroundColor: BRAND_COLORS.primaryBlue }}
                >
                  <Calendar className="h-5 w-5" />
                  {language === 'fr' ? 'Réserver un appel' : 'Book a call'}
                </a>
              </div>
            ) : (
              <div className="flex justify-center mb-4">
                <a
                  href="mailto:info@kwh.quebec?subject=Demande de consultation"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white text-base font-medium transition-opacity hover:opacity-90"
                  style={{ backgroundColor: BRAND_COLORS.primaryBlue }}
                >
                  {language === 'fr' ? 'Nous contacter' : 'Contact us'}
                </a>
              </div>
            )}
            <p className="text-base md:text-lg font-semibold text-center" style={{ color: BRAND_COLORS.accentGold }}>{contact}</p>
            <p className="text-sm mt-4 text-center" style={{ color: '#DC2626' }}>
              {language === 'fr'
                ? `Les incitatifs couvrent jusqu'à ${incentivePercent} % du projet — ces programmes peuvent changer à tout moment.`
                : `Incentives cover up to ${incentivePercent}% of the project — these programs can change at any time.`}
            </p>
          </div>
        ) : (
          // Qualified lead: Show design mandate signing CTA
          <div
            className="rounded-2xl px-6 md:px-8 py-6 text-center shadow-sm"
            style={{ backgroundColor: 'rgba(0,61,166,0.05)', border: `2px solid ${BRAND_COLORS.primaryBlue}` }}
          >
            <p className="text-lg md:text-xl font-bold mb-2" style={{ color: BRAND_COLORS.primaryBlue }}>
              {language === 'fr' ? 'Signez votre mandat de conception préliminaire en ligne' : 'Sign your Preliminary Design Mandate online'}
            </p>
            <p className="text-sm mb-3" style={{ color: '#4B5563' }}>
              {language === 'fr'
                ? 'Un lien sécurisé vous sera envoyé par courriel pour signer et compléter le paiement en ligne.'
                : 'A secure link will be sent to you by email to sign and complete the payment online.'}
            </p>
            <p className="text-base md:text-lg font-semibold" style={{ color: BRAND_COLORS.accentGold }}>{contact}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function WhySolarNowSlide({ language }: { language: string }) {
  const lang = language as "fr" | "en";
  const content = getWhySolarNow(lang);
  const displayedMyths = content.winterMyths.slice(0, 3);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-6 md:px-8">
      <div className="max-w-6xl w-full">
        <SlideTitle>{content.sectionTitle}</SlideTitle>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6">
          <div className="rounded-2xl overflow-hidden shadow-sm" style={{ border: '1px solid #E5E7EB' }}>
            <div className="px-4 py-2" style={{ backgroundColor: 'rgba(220,38,38,0.08)' }}>
              <h3 className="font-bold text-sm text-center" style={{ color: '#DC2626' }}>{content.beforeTitle}</h3>
            </div>
            <div className="p-4 space-y-2">
              {content.beforeReasons.map((reason, i) => (
                <div key={i} className="flex items-start gap-2">
                  <X className="h-4 w-4 mt-0.5 shrink-0" style={{ color: '#DC2626' }} />
                  <span className="text-xs" style={{ color: '#4B5563' }}>{reason}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden shadow-sm" style={{ border: `2px solid ${BRAND_COLORS.accentGold}` }}>
            <div className="px-4 py-2" style={{ backgroundColor: 'rgba(22,163,74,0.08)' }}>
              <h3 className="font-bold text-sm text-center" style={{ color: '#16A34A' }}>{content.nowTitle}</h3>
            </div>
            <div className="p-4 space-y-2">
              {content.nowReasons.map((reason, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Check className="h-4 w-4 mt-0.5 shrink-0" style={{ color: '#16A34A' }} />
                  <span className="text-xs" style={{ color: '#4B5563' }}>{reason}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl p-4 md:p-5 shadow-sm" style={{ backgroundColor: 'rgba(0,61,166,0.04)', border: '1px solid #E5E7EB' }}>
          <h3 className="font-bold text-sm md:text-base text-center mb-3" style={{ color: BRAND_COLORS.primaryBlue }}>
            {content.winterTitle}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {displayedMyths.map((item, i) => (
              <div key={i} className="space-y-1">
                <p className="text-xs line-through" style={{ color: '#9CA3AF' }}>{item.myth}</p>
                <p className="text-xs" style={{ color: '#4B5563' }}>{item.reality}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== SYSTEM ELEMENTS SLIDE ==========
function SystemElementsSlide({ simulation, language }: { simulation: SimulationRun | null; language: string }) {
  const lang = language as "fr" | "en";
  const t = (fr: string, en: string) => lang === "fr" ? fr : en;
  const equipment = getEquipment(lang);
  const techSummary = getEquipmentTechnicalSummary(lang);
  const hasBattery = (simulation?.battEnergyKWh ?? 0) > 0;
  const battEq = hasBattery ? getBatteryEquipment(lang) : null;

  const flowBoxes = [
    { label: t("Panneaux solaires", "Solar Panels"), detail: formatSmartPower(simulation?.pvSizeKW ?? 0, lang), bg: BRAND_COLORS.accentGold, text: '#1a1a1a' },
    { label: t("Onduleur(s)", "Inverter(s)"), detail: "DC → AC", bg: BRAND_COLORS.primaryBlue, text: '#fff' },
  ];
  if (hasBattery) {
    flowBoxes.push({ label: t("Batterie BESS", "BESS Battery"), detail: formatSmartEnergy(simulation?.battEnergyKWh ?? 0, lang), bg: '#059669', text: '#fff' });
  }
  flowBoxes.push(
    { label: t("Charges", "Loads"), detail: formatSmartEnergy(simulation?.annualConsumptionKWh ?? 0, lang) + t("/an", "/yr"), bg: '#374151', text: '#fff' },
    { label: t("Réseau HQ", "HQ Grid"), detail: t("Surplus / Appoint", "Surplus / Backup"), bg: '#d1d5db', text: '#374151' },
  );

  const modes = [
    { icon: <Sun className="h-5 w-5" />, title: t("Autoconsommation", "Self-consumption"), desc: t("Production solaire → charges directement", "Solar → loads directly") },
  ];
  if (hasBattery) {
    modes.push({ icon: <Battery className="h-5 w-5" />, title: t("Écrêtage de pointe", "Peak Shaving"), desc: t("Batterie réduit la demande de pointe", "Battery reduces peak demand") });
  }
  modes.push({ icon: <Zap className="h-5 w-5" />, title: t("Injection surplus", "Surplus Export"), desc: t("Surplus → réseau HQ (mesurage net)", "Surplus → HQ grid (net metering)") });

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-6 md:px-8">
      <div className="max-w-6xl w-full">
        <SlideTitle>{t("Système et équipement", "System & Equipment")}</SlideTitle>

        {/* Flow diagram */}
        <div className="flex items-center justify-center gap-2 md:gap-3 flex-wrap mb-6">
          {flowBoxes.map((box, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="rounded-xl px-4 py-3 md:px-5 md:py-3 text-center min-w-[90px] md:min-w-[130px]" style={{ backgroundColor: box.bg, color: box.text }}>
                <p className="font-bold text-xs md:text-sm">{box.label}</p>
                <p className="text-[10px] md:text-xs opacity-85">{box.detail}</p>
              </div>
              {i < flowBoxes.length - 1 && (
                <ArrowRight className="h-4 w-4 flex-shrink-0" style={{ color: BRAND_COLORS.accentGold }} />
              )}
            </div>
          ))}
        </div>

        {/* Component table with warranty + certifications */}
        <div className="overflow-x-auto mb-5">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: BRAND_COLORS.primaryBlue }}>
                <th className="text-left text-white font-semibold px-3 py-2 rounded-tl-lg">{t("Composant", "Component")}</th>
                <th className="text-left text-white font-semibold px-3 py-2">{t("Fabricant", "Manufacturer")}</th>
                <th className="text-left text-white font-semibold px-3 py-2">{t("Spécification", "Specification")}</th>
                <th className="text-left text-white font-semibold px-3 py-2">{t("Garantie", "Warranty")}</th>
                <th className="text-left text-white font-semibold px-3 py-2 rounded-tr-lg">{t("Certifications", "Certifications")}</th>
              </tr>
            </thead>
            <tbody>
              {equipment.map((eq, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                  <td className="px-3 py-2 font-medium">{eq.label}</td>
                  <td className="px-3 py-2 text-gray-600">{eq.manufacturer}</td>
                  <td className="px-3 py-2 text-gray-600 text-xs">{eq.specs || "—"}</td>
                  <td className="px-3 py-2 font-bold" style={{ color: BRAND_COLORS.primaryBlue }}>{eq.warranty}</td>
                  <td className="px-3 py-2">
                    {eq.certifications && eq.certifications.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {eq.certifications.map((cert: string, ci: number) => (
                          <span key={ci} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(0,61,166,0.08)', color: BRAND_COLORS.primaryBlue }}>
                            {cert}
                          </span>
                        ))}
                      </div>
                    ) : "—"}
                  </td>
                </tr>
              ))}
              {battEq && (
                <tr className={equipment.length % 2 === 0 ? 'bg-gray-50' : ''}>
                  <td className="px-3 py-2 font-medium">{battEq.label}</td>
                  <td className="px-3 py-2 text-gray-600">{battEq.manufacturer}</td>
                  <td className="px-3 py-2 text-gray-600 text-xs">{battEq.specs || "—"}</td>
                  <td className="px-3 py-2 font-bold" style={{ color: BRAND_COLORS.primaryBlue }}>{battEq.warranty}</td>
                  <td className="px-3 py-2">—</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Operating modes + Structural data side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Operating modes */}
          <div>
            <h3 className="text-sm font-bold mb-3" style={{ color: BRAND_COLORS.primaryBlue }}>
              {t("Modes d'opération", "Operating Modes")}
            </h3>
            <div className="flex flex-col gap-3">
              {modes.map((mode, i) => (
                <div key={i} className="rounded-xl p-3" style={{ backgroundColor: '#f3f4f6', border: '1px solid #E5E7EB' }}>
                  <div className="flex items-center gap-2 mb-1" style={{ color: BRAND_COLORS.primaryBlue }}>
                    {mode.icon}
                    <span className="font-bold text-sm">{mode.title}</span>
                  </div>
                  <p className="text-xs" style={{ color: '#6B7280' }}>{mode.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Structural data */}
          <div className="rounded-xl p-5" style={{ backgroundColor: 'rgba(0,61,166,0.04)', border: '1px solid rgba(0,61,166,0.12)' }}>
            <h3 className="text-sm font-bold mb-3" style={{ color: BRAND_COLORS.primaryBlue }}>
              {t("Données structurelles", "Structural Data")}
            </h3>
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-baseline gap-4 justify-center">
                <div className="text-center" data-testid="text-total-weight-metric">
                  <p className="text-xs mb-1" style={{ color: '#6B7280' }}>{t("Charge totale", "Total Load")}</p>
                  <p className="text-xl font-bold" style={{ color: BRAND_COLORS.accentGold }}>{techSummary.totalSystemWeightKgPerM2.value} <span className="text-sm font-normal">kg/m²</span></p>
                </div>
                <span className="text-muted-foreground text-lg font-light">/</span>
                <div className="text-center" data-testid="text-total-weight-imperial">
                  <p className="text-xs mb-1" style={{ color: '#6B7280' }}>{t("Impérial", "Imperial")}</p>
                  <p className="text-xl font-bold" style={{ color: BRAND_COLORS.accentGold }}>{techSummary.totalSystemWeightPsfPerSf.value} <span className="text-sm font-normal">{t('lb/p²', 'lb/sf')}</span></p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground" data-testid="text-weight-breakdown">
                {t(
                  `(Panneaux ${techSummary.panelWeightKgPerM2.value} kg/m² + Structure ${techSummary.rackingWeightKgPerM2.value} kg/m²)`,
                  `(Panels ${techSummary.panelWeightKgPerM2.value} kg/m² + Racking ${techSummary.rackingWeightKgPerM2.value} kg/m²)`
                )}
              </p>
              <div className="flex flex-wrap gap-3 justify-center mt-1">
                <span className="text-xs flex items-center gap-1" style={{ color: '#6B7280' }}>
                  <CheckCircle2 className="h-3 w-3" style={{ color: BRAND_COLORS.positive }} />
                  {techSummary.windLoadDesign}
                </span>
                <span className="text-xs flex items-center gap-1" style={{ color: '#6B7280' }}>
                  <CheckCircle2 className="h-3 w-3" style={{ color: BRAND_COLORS.positive }} />
                  {techSummary.snowLoadNote}
                </span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: '#9CA3AF' }}>
          {t("Équipement indicatif — confirmé dans la soumission forfaitaire", "Indicative equipment — confirmed in the firm quote")}
        </p>
      </div>
    </div>
  );
}

// ========== DELIVERY ASSURANCE SLIDE ==========
function DeliveryAssuranceSlide({ language }: { language: string }) {
  const lang = language as "fr" | "en";
  const t = (fr: string, en: string) => lang === "fr" ? fr : en;
  const milestones = getDeliveryAssurance(lang);
  const partners = getDeliveryPartners(lang);
  const roadmap = getWarrantyRoadmap(lang);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-6 md:px-8">
      <div className="max-w-6xl w-full">
        <SlideTitle>{t("Assurance de livraison", "Project Delivery Assurance")}</SlideTitle>

        {/* Milestones table */}
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: BRAND_COLORS.primaryBlue }}>
                <th className="text-left text-white font-semibold px-3 py-2 rounded-tl-lg">{t("Phase", "Phase")}</th>
                <th className="text-left text-white font-semibold px-3 py-2">{t("Durée", "Duration")}</th>
                <th className="text-left text-white font-semibold px-3 py-2">{t("Livrables", "Deliverables")}</th>
                <th className="text-left text-white font-semibold px-3 py-2 rounded-tr-lg">{t("Contrôle qualité", "QA Checkpoint")}</th>
              </tr>
            </thead>
            <tbody>
              {milestones.map((m, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                  <td className="px-3 py-2 font-semibold" style={{ color: BRAND_COLORS.primaryBlue }}>{m.phase}</td>
                  <td className="px-3 py-2 text-gray-600">{m.duration}</td>
                  <td className="px-3 py-2 text-gray-600 text-xs">{m.deliverables.join(", ")}</td>
                  <td className="px-3 py-2 text-xs font-semibold" style={{ color: BRAND_COLORS.positive }}>
                    <CheckCircle2 className="h-3 w-3 inline mr-1" />{m.qaCheckpoint}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Delivery team */}
        <h3 className="text-sm font-bold mb-3" style={{ color: BRAND_COLORS.primaryBlue }}>
          {t("ÉQUIPE DE LIVRAISON", "DELIVERY TEAM")}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {partners.map((p, i) => (
            <div key={i} className="rounded-lg p-3 text-center" style={{ backgroundColor: '#f3f4f6', border: '1px solid #E5E7EB' }}>
              <p className="font-bold text-xs" style={{ color: BRAND_COLORS.primaryBlue }}>{p.role}</p>
              <p className="text-xs text-gray-700 mt-1">{p.name}</p>
              <p className="text-[10px] text-gray-400 mt-1">{p.qualification}</p>
            </div>
          ))}
        </div>

        {/* Warranty roadmap */}
        <h3 className="text-sm font-bold mb-3" style={{ color: BRAND_COLORS.primaryBlue }}>
          {t("PLAN DE SUPPORT ET GARANTIES", "WARRANTY & SUPPORT ROADMAP")}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {roadmap.map((r, i) => {
            const isLast = i === roadmap.length - 1;
            return (
              <div key={i} className="rounded-lg p-3 text-center" style={{
                backgroundColor: isLast ? BRAND_COLORS.primaryBlue : '#f3f4f6',
                border: isLast ? 'none' : '1px solid #E5E7EB',
              }}>
                <p className="font-bold text-sm" style={{ color: isLast ? BRAND_COLORS.accentGold : BRAND_COLORS.primaryBlue }}>{r.period}</p>
                <div className="mt-2 space-y-1">
                  {r.items.map((item, j) => (
                    <p key={j} className="text-[11px]" style={{ color: isLast ? 'rgba(255,255,255,0.9)' : '#6B7280' }}>{item}</p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* HQ interconnection note */}
        <div className="rounded-lg p-3" style={{ backgroundColor: '#FFF3CD', border: '1px solid #FBBF24' }}>
          <p className="text-xs" style={{ color: '#856404' }}>
            <span className="font-bold">{t("INTERCONNEXION HQ", "HQ INTERCONNECTION")}:</span>{" "}
            {t(
              "kWh gère le processus complet. Délai typique: 8-16 semaines. Risque faible pour systèmes < 1 MW.",
              "kWh manages the complete process. Typical delay: 8-16 weeks. Low risk for systems < 1 MW."
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

// ========== FIT SCORE SLIDE ==========
function FitScoreSlide({ simulation, language }: { simulation: SimulationRun | null; language: string }) {
  const lang = language as "fr" | "en";
  const t = (fr: string, en: string) => lang === "fr" ? fr : en;

  const fitResult = computeFitScore({
    simplePaybackYears: simulation?.simplePaybackYears ?? null,
    irr25: simulation?.irr25 ?? null,
    annualSavings: simulation?.annualSavings ?? null,
    annualCostBefore: simulation?.annualCostBefore ?? null,
    selfSufficiencyPercent: simulation?.selfSufficiencyPercent ?? null,
    capexNet: simulation?.capexNet ?? null,
  });

  // Factor display — directly from computeFitScore (single source of truth)
  const factors = fitResult.factors.map(f => ({
    label: lang === "fr" ? f.labelFr : f.labelEn,
    value: f.displayValue,
    score: f.score,
    max: f.maxScore,
    barColor: f.barColor,
  }));

  const fitLabel = lang === "fr" ? fitResult.labelFr : fitResult.labelEn;
  const verdictText = (fitResult.level === "excellent" || fitResult.level === "bon")
    ? t(
        "Ce bâtiment présente un potentiel solaire favorable. Nous recommandons de procéder à la validation technique sur site.",
        "This building shows favorable solar potential. We recommend proceeding with on-site technical validation."
      )
    : t(
        "Le potentiel nécessite une validation approfondie. Le projet peut rester pertinent pour des raisons non financières.",
        "The potential requires deeper validation. The project may still be relevant for non-financial reasons."
      );

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-6 md:px-8">
      <div className="max-w-5xl w-full">
        <SlideTitle>{t("Évaluation de faisabilité", "Feasibility Assessment")}</SlideTitle>

        <div className="flex flex-col md:flex-row gap-8 items-center md:items-start mb-8">
          {/* Score gauge */}
          <div className="flex-shrink-0 text-center">
            <div
              className="w-40 h-40 md:w-48 md:h-48 rounded-full flex flex-col items-center justify-center mx-auto"
              style={{ border: `6px solid ${fitResult.color}` }}
            >
              <span className="text-5xl md:text-6xl font-bold" style={{ color: fitResult.color }}>{fitResult.score}</span>
              <span className="text-sm text-gray-400">/ 100</span>
            </div>
            <p className="mt-3 text-lg md:text-xl font-bold" style={{ color: fitResult.color }}>{fitLabel}</p>
          </div>

          {/* Factor bars */}
          <div className="flex-1 w-full">
            <h3 className="text-sm font-bold mb-4" style={{ color: BRAND_COLORS.primaryBlue }}>
              {t("CRITÈRES D'ÉVALUATION", "EVALUATION CRITERIA")}
            </h3>
            <div className="space-y-3">
              {factors.map((f, i) => {
                const pct = f.max > 0 ? (f.score / f.max) * 100 : 0;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-32 md:w-40 text-sm font-medium text-gray-700">{f.label}</span>
                    <div className="flex-1 h-5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: f.barColor }} />
                    </div>
                    <span className="w-16 text-right text-sm text-gray-500">{f.value}</span>
                    <span className="w-12 text-right text-sm font-bold" style={{ color: BRAND_COLORS.primaryBlue }}>{f.score}/{f.max}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Verdict */}
        <div className="rounded-xl p-5" style={{ backgroundColor: fitResult.color }}>
          <p className="font-bold text-white text-sm mb-1">{t("VERDICT", "VERDICT")}</p>
          <p className="text-white text-sm">{verdictText}</p>
        </div>
      </div>
    </div>
  );
}

function CredibilitySlide({ language }: { language: string }) {
  const lang = language as "fr" | "en";
  const stats = getAllStats(lang);
  const contact = getContactString();
  const currentLogo = language === 'fr' ? logoFr : logoEn;

  const credDesc = BRAND_CONTENT.credibilityDescription[lang];

  const valuesData = BRAND_CONTENT.values.map(v => ({
    label: lang === 'fr' ? v.labelFr : v.labelEn,
    desc: lang === 'fr' ? v.descFr : v.descEn,
  }));

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-6 md:px-8">
      <div className="max-w-5xl w-full text-center">
        <SlideTitle>
          {language === 'fr' ? 'Pourquoi kWh Québec' : 'Why kWh Québec'}
        </SlideTitle>

        <div className="flex items-center justify-center gap-8 md:gap-16 flex-wrap mb-12">
          {stats.map((stat, i) => (
            <div key={i}>
              <p className="text-4xl md:text-6xl font-bold" style={{ color: BRAND_COLORS.accentGold }}>{stat.value}</p>
              <p className="text-sm mt-1" style={{ color: '#6B7280' }}>{stat.label}</p>
            </div>
          ))}
        </div>

        <p className="text-base md:text-lg mb-8 max-w-3xl mx-auto" style={{ color: '#4B5563' }}>{credDesc}</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {valuesData.map((v, i) => (
            <div key={i} className="rounded-xl px-5 py-4 text-center" style={{ backgroundColor: '#F7F9FC' }}>
              <p className="font-bold text-base mb-1" style={{ color: BRAND_COLORS.primaryBlue }}>{v.label}</p>
              <p className="text-xs" style={{ color: '#6B7280' }}>{v.desc}</p>
            </div>
          ))}
        </div>

        <div
          className="rounded-2xl p-6 md:p-8 shadow-sm"
          style={{ backgroundColor: 'rgba(255,176,5,0.06)', border: `2px solid ${BRAND_COLORS.accentGold}` }}
        >
          <img
            src={currentLogo}
            alt={language === "fr" ? "Logo kWh Québec – Énergie solaire commerciale" : "kWh Québec Logo – Commercial Solar Energy"}
            className="h-12 md:h-14 mx-auto mb-4"
          />
          <p className="text-base md:text-lg mb-4 font-semibold" style={{ color: BRAND_COLORS.primaryBlue }}>
            {language === 'fr'
              ? 'Prêt à transformer vos coûts d\'énergie? Contactez-nous pour planifier votre visite de site.'
              : 'Ready to transform your energy costs? Contact us to schedule your site visit.'}
          </p>
          <p className="text-base md:text-lg font-bold" style={{ color: BRAND_COLORS.accentGold }}>{contact}</p>
          <p className="text-sm mt-4" style={{ color: '#4B5563' }}>
            {language === 'fr'
              ? 'Votre partenaire pour la transition énergétique commerciale au Québec'
              : 'Your partner for commercial energy transition in Quebec'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PresentationPageWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <PresentationPage />
    </ErrorBoundary>
  );
}
