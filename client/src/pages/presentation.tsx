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
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  Line,
  Legend,
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

const SLIDES = [
  'hero',        // 1. Cover
  'snapshot',    // 2. Project Snapshot
  'kpi',         // 3. KPI Results
  'waterfall',   // 4. Investment Breakdown
  'roofConfig',  // 5. Roof Configuration
  'cashflow',    // 6. Financial Projections
  'assumptions', // 7. Assumptions & Exclusions
  'equipment',   // 8. Equipment & Warranties
  'timeline',    // 9. Timeline
  'nextSteps',   // 10. Next Steps
  'credibility', // 11. Credibility
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

  // Keyboard navigation
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
  const currentLogo = language === 'fr' ? logoFr : logoEn;

  const slideComponents: Record<SlideType, JSX.Element> = {
    hero: <HeroSlide site={site} language={language} />,
    snapshot: <SnapshotSlide simulation={bestSimulation ?? null} language={language} />,
    kpi: <KPIResultsSlide simulation={bestSimulation ?? null} language={language} />,
    waterfall: <WaterfallSlide simulation={bestSimulation ?? null} language={language} />,
    roofConfig: <RoofConfigSlide site={site} simulation={bestSimulation ?? null} language={language} />,
    cashflow: <CashflowSlide simulation={bestSimulation ?? null} language={language} />,
    assumptions: <AssumptionsSlide language={language} />,
    equipment: <EquipmentSlide language={language} />,
    timeline: <TimelineSlide language={language} />,
    nextSteps: <NextStepsSlide language={language} />,
    credibility: <CredibilitySlide language={language} />,
  };

  return (
    <div
      className="min-h-screen text-white font-['Montserrat',sans-serif]"
      style={{
        background: `linear-gradient(135deg, ${BRAND_COLORS.primaryBlue} 0%, ${BRAND_COLORS.darkBlue} 100%)`
      }}
    >
      {/* Top Navigation Bar */}
      <div
        className="fixed top-0 left-0 right-0 z-50 backdrop-blur-sm border-b border-white/10"
        style={{ backgroundColor: 'rgba(0, 43, 117, 0.8)' }}
      >
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
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
        {slideComponents[slideContent]}
      </div>

      {/* Bottom Navigation */}
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

          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-1.5">
              {SLIDES.map((slide, index) => (
                <button
                  key={slide}
                  onClick={() => setCurrentSlide(index)}
                  className="w-2.5 h-2.5 rounded-full transition-all"
                  style={{
                    backgroundColor: index === currentSlide ? BRAND_COLORS.accentGold : 'rgba(255,255,255,0.3)',
                    transform: index === currentSlide ? 'scale(1.2)' : 'scale(1)'
                  }}
                  data-testid={`slide-indicator-${index}`}
                />
              ))}
            </div>
            <span className="text-xs text-white/50">
              {currentSlide + 1}/{SLIDES.length} — {language === 'fr' ? 'Propulsé par' : 'Powered by'} kWh Québec
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

// ==================== SLIDE 1: HERO ====================
function HeroSlide({ site, language }: { site: SiteWithDetails; language: string }) {
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const hasCoords = site.latitude && site.longitude;

  const satelliteImageUrl = hasCoords && googleMapsApiKey
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${site.latitude},${site.longitude}&zoom=18&size=800x500&maptype=satellite&key=${googleMapsApiKey}`
    : null;

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-8">
      <div className="max-w-6xl w-full">
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

// ==================== SLIDE 2: PROJECT SNAPSHOT ====================
function SnapshotSlide({ simulation, language }: { simulation: SimulationRun | null; language: string }) {
  const lang = language as "fr" | "en";
  const labels = getProjectSnapshotLabels(lang);
  const act1 = getNarrativeAct("act1_challenge", lang);

  const items = [
    { icon: Zap, label: labels.annualConsumption?.label || '', value: simulation?.annualConsumptionKWh ? `${Math.round(simulation.annualConsumptionKWh).toLocaleString()} kWh` : '--' },
    { icon: TrendingUp, label: labels.peakDemand?.label || '', value: simulation?.peakDemandKW ? `${Number(simulation.peakDemandKW).toFixed(0)} kW` : '--' },
    { icon: Sun, label: labels.solarCapacity?.label || '', value: simulation?.pvSizeKW ? `${Number(simulation.pvSizeKW).toFixed(0)} kWc` : '--' },
    { icon: Battery, label: labels.batteryCapacity?.label || '', value: simulation?.battEnergyKWh && Number(simulation.battEnergyKWh) > 0 ? `${Number(simulation.battEnergyKWh).toFixed(0)} kWh` : (language === 'fr' ? 'Non inclus' : 'Not included') },
    { icon: Sun, label: labels.estimatedProduction?.label || '', value: simulation?.pvSizeKW ? `${Math.round(Number(simulation.pvSizeKW) * 1035).toLocaleString()} kWh` : '--' },
    { icon: CheckCircle2, label: labels.selfConsumptionRate?.label || '', value: simulation?.selfSufficiencyPercent ? `${Number(simulation.selfSufficiencyPercent).toFixed(0)}%` : '--' },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-8">
      <div className="max-w-6xl w-full">
        <div className="text-center mb-10">
          <h2 className="text-4xl md:text-5xl font-bold mb-3">
            {language === 'fr' ? 'Aperçu du Projet' : 'Project Snapshot'}
          </h2>
          <p className="text-lg text-white/50 italic">{act1.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item, i) => (
            <Card key={i} className="bg-white/5 border-white/10">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(255,176,5,0.15)' }}>
                  <item.icon className="h-6 w-6" style={{ color: BRAND_COLORS.accentGold }} />
                </div>
                <div>
                  <p className="text-white/50 text-sm">{item.label}</p>
                  <p className="text-2xl font-bold" style={{ color: BRAND_COLORS.accentGold }}>{item.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ==================== SLIDE 3: KPI RESULTS (merged metrics + savings) ====================
function KPIResultsSlide({ simulation, language }: { simulation: SimulationRun | null; language: string }) {
  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M$`;
    return `${Math.round(value).toLocaleString()}$`;
  };

  const kpis = [
    {
      icon: DollarSign,
      label: language === 'fr' ? 'Économies An 1' : 'Year 1 Savings',
      value: simulation?.savingsYear1 ? formatCurrency(simulation.savingsYear1) : '--',
      highlight: false
    },
    {
      icon: TrendingUp,
      label: language === 'fr' ? 'Investissement Net' : 'Net Investment',
      value: simulation?.capexNet ? formatCurrency(Number(simulation.capexNet)) : '--',
      highlight: false
    },
    {
      icon: Zap,
      label: language === 'fr' ? 'Profit Net (VAN)' : 'Net Profit (NPV)',
      value: simulation?.npv25 ? formatCurrency(simulation.npv25) : '--',
      highlight: true
    },
    {
      icon: TrendingUp,
      label: language === 'fr' ? 'Rendement (TRI)' : 'Return (IRR)',
      value: simulation?.irr25 ? `${(simulation.irr25 * 100).toFixed(1)}%` : '--',
      highlight: true
    },
  ];

  // Supplementary metrics
  const lcoe = simulation?.lcoe ? Number(simulation.lcoe).toFixed(2) : '0.00';
  const co2 = simulation?.co2AvoidedTonnesPerYear ? Number(simulation.co2AvoidedTonnesPerYear).toFixed(1) : '0.0';
  const backupHours = (simulation?.battEnergyKWh && Number(simulation.battEnergyKWh) > 0 && simulation?.peakDemandKW && Number(simulation.peakDemandKW) > 0)
    ? (Number(simulation.battEnergyKWh) / (Number(simulation.peakDemandKW) * 0.3)).toFixed(1)
    : '0';

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-8">
      <div className="max-w-7xl w-full">
        <div className="text-center mb-10">
          <h2 className="text-4xl md:text-5xl font-bold mb-3">
            {language === 'fr' ? 'Vos Résultats' : 'Your Results'}
          </h2>
          <p className="text-lg text-white/50">
            {simulation?.pvSizeKW && (
              <>
                {language === 'fr' ? 'Système: ' : 'System: '}
                <span className="text-white font-semibold">{Number(simulation.pvSizeKW).toFixed(0)} kW</span>
                {simulation.battEnergyKWh && Number(simulation.battEnergyKWh) > 0 && (
                  <> + <span className="text-white font-semibold">{Number(simulation.battEnergyKWh).toFixed(0)} kWh</span></>
                )}
              </>
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {kpis.map((kpi, i) => (
            <Card
              key={i}
              className={`border overflow-hidden ${kpi.highlight ? 'border-2' : 'border-white/10'}`}
              style={kpi.highlight ? {
                background: `linear-gradient(135deg, rgba(255,176,5,0.2) 0%, rgba(255,176,5,0.1) 100%)`,
                borderColor: BRAND_COLORS.accentGold
              } : {
                background: 'rgba(255,255,255,0.05)'
              }}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-5">
                  <div
                    className="h-14 w-14 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: kpi.highlight ? BRAND_COLORS.accentGold : 'rgba(255,176,5,0.15)' }}
                  >
                    <kpi.icon className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <p className="text-white/60 text-base mb-1">{kpi.label}</p>
                    <p className="text-4xl font-bold" style={{ color: kpi.highlight ? BRAND_COLORS.accentGold : 'white' }}>{kpi.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Supplementary metrics line */}
        <div className="text-center py-3 px-6 bg-white/5 rounded-xl border border-white/10">
          <span className="text-white/60 text-sm">
            LCOE: <span className="text-white font-medium">{lcoe} ¢/kWh</span>
            <span className="mx-3 text-white/30">|</span>
            CO₂: <span className="text-white font-medium">{co2} t/{language === 'fr' ? 'an' : 'yr'}</span>
            <span className="mx-3 text-white/30">|</span>
            {language === 'fr' ? 'Autonomie batterie' : 'Battery backup'}: <span className="text-white font-medium">{backupHours}h</span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ==================== SLIDE 4: WATERFALL (Investment Breakdown) ====================
function WaterfallSlide({ simulation, language }: { simulation: SimulationRun | null; language: string }) {
  const capexGross = Number(simulation?.capexGross || 0);
  const hqSolar = Number(simulation?.incentivesHQSolar || 0);
  const hqBattery = Number(simulation?.incentivesHQBattery || 0);
  const itcFederal = Number(simulation?.incentivesFederal || 0);
  const taxShield = Number(simulation?.taxShield || 0);
  const capexNet = Number(simulation?.capexNet || 0);

  const formatCurrency = (v: number) => `${Math.round(v).toLocaleString()}$`;

  const bars = [
    { label: language === 'fr' ? 'CAPEX Brut' : 'Gross CAPEX', value: capexGross, type: 'start' as const, color: BRAND_COLORS.primaryBlue },
    { label: language === 'fr' ? 'HQ Solaire' : 'HQ Solar', value: hqSolar, type: 'deduction' as const, color: '#DC2626' },
    { label: language === 'fr' ? 'HQ Batterie' : 'HQ Battery', value: hqBattery, type: 'deduction' as const, color: '#DC2626' },
    { label: language === 'fr' ? 'ITC Fédéral' : 'Federal ITC', value: itcFederal, type: 'deduction' as const, color: '#DC2626' },
    { label: language === 'fr' ? 'Bouclier Fiscal' : 'Tax Shield', value: taxShield, type: 'deduction' as const, color: '#DC2626' },
    { label: language === 'fr' ? 'Net' : 'Net', value: capexNet, type: 'total' as const, color: '#2D915F' },
  ];

  const maxVal = Math.max(capexGross, 1);
  const chartHeight = 300; // px
  let running = capexGross;

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-8">
      <div className="max-w-6xl w-full">
        <div className="text-center mb-10">
          <h2 className="text-4xl md:text-5xl font-bold mb-3">
            {language === 'fr' ? 'Ventilation de l\'Investissement' : 'Investment Breakdown'}
          </h2>
        </div>

        {capexGross > 0 ? (
          <>
            <div className="bg-white/5 rounded-2xl border border-white/10 p-8">
              <div className="flex items-end justify-center gap-4" style={{ height: chartHeight + 60 }}>
                {bars.map((bar, i) => {
                  const barHeight = Math.max(8, (bar.value / maxVal) * chartHeight);
                  let spacerHeight = 0;

                  if (bar.type === 'deduction') {
                    const prevTop = chartHeight - (running / maxVal) * chartHeight;
                    spacerHeight = prevTop;
                    running -= bar.value;
                  }

                  const bottomPos = bar.type === 'total' ? 0 : (bar.type === 'start' ? 0 : chartHeight - (running / maxVal) * chartHeight - barHeight);

                  return (
                    <div key={i} className="flex flex-col items-center" style={{ width: '14%' }}>
                      {/* Value label */}
                      <div className="text-sm font-bold mb-1" style={{ color: bar.type === 'deduction' ? '#DC2626' : 'white' }}>
                        {bar.type === 'deduction' ? '-' : ''}{formatCurrency(bar.value)}
                      </div>
                      {/* Bar container */}
                      <div className="w-full relative" style={{ height: chartHeight }}>
                        {/* Spacer for floating deductions */}
                        {bar.type === 'deduction' && (
                          <div style={{ height: spacerHeight }} />
                        )}
                        {bar.type === 'start' && (
                          <div style={{ height: chartHeight - barHeight }} />
                        )}
                        {bar.type === 'total' && (
                          <div style={{ height: chartHeight - barHeight }} />
                        )}
                        {/* Actual bar */}
                        <div
                          className="w-full rounded-t"
                          style={{
                            height: barHeight,
                            backgroundColor: bar.color,
                            opacity: bar.type === 'deduction' ? 0.85 : 1
                          }}
                        />
                      </div>
                      {/* Label */}
                      <p className="text-xs text-white/60 text-center mt-2 leading-tight">{bar.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Incentive summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              {[
                { label: 'HQ Solar', value: hqSolar },
                { label: 'HQ Battery', value: hqBattery },
                { label: language === 'fr' ? 'ITC Fédéral' : 'Federal ITC', value: itcFederal },
                { label: language === 'fr' ? 'Bouclier Fiscal' : 'Tax Shield', value: taxShield },
              ].filter(item => item.value > 0).map((item, i) => (
                <div key={i} className="bg-white/5 rounded-xl border border-white/10 p-4 text-center">
                  <p className="text-white/50 text-sm">{item.label}</p>
                  <p className="text-xl font-bold" style={{ color: BRAND_COLORS.accentGold }}>-{formatCurrency(item.value)}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="bg-white/5 rounded-2xl border border-white/10 p-12 text-center">
            <p className="text-white/60">{language === 'fr' ? 'Données non disponibles' : 'Data not available'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== SLIDE 5: ROOF CONFIGURATION ====================
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
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-8">
      <div className="max-w-6xl w-full">
        <div className="text-center mb-10">
          <h2 className="text-4xl md:text-5xl font-bold mb-3">
            {language === 'fr' ? 'Configuration Toiture' : 'Roof Configuration'}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Satellite image */}
          <div>
            {satelliteImageUrl ? (
              <div className="rounded-2xl overflow-hidden border border-white/10">
                <img src={satelliteImageUrl} alt="Vue satellite" className="w-full h-auto" />
              </div>
            ) : (
              <div className="rounded-2xl bg-white/5 border border-white/10 p-12 text-center h-full flex items-center justify-center">
                <div>
                  <Building2 className="h-16 w-16 mx-auto text-white/20 mb-4" />
                  <p className="text-white/40">{language === 'fr' ? 'Image non disponible' : 'Image not available'}</p>
                </div>
              </div>
            )}
          </div>

          {/* Sizing summary */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h3 className="text-xl font-bold mb-6" style={{ color: BRAND_COLORS.accentGold }}>
              {language === 'fr' ? 'Dimensionnement' : 'Sizing Summary'}
            </h3>
            <div className="space-y-5">
              {summaryItems.map((item, i) => (
                <div key={i}>
                  <p className="text-white/50 text-sm mb-1">{item.label}</p>
                  <p className="text-2xl font-bold text-white">{item.value}</p>
                  {i < summaryItems.length - 1 && <div className="border-b border-white/10 mt-4" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== SLIDE 6: CASHFLOW + COST OF INACTION ====================
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
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-8">
      <div className="max-w-6xl w-full">
        <div className="text-center mb-8">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            {language === 'fr' ? 'Projections Financières' : 'Financial Projections'}
          </h2>
          {breakEvenYear && (
            <p className="text-xl text-white/60">
              {language === 'fr' ? 'Seuil de rentabilité: année ' : 'Break-even: year '}
              <span className="font-semibold" style={{ color: BRAND_COLORS.accentGold }}>{breakEvenYear}</span>
            </p>
          )}
        </div>

        {chartData.length > 0 ? (
          <>
            <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis
                    dataKey="year"
                    stroke="rgba(255,255,255,0.5)"
                    tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.5)"
                    tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k$`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }}
                    labelStyle={{ color: 'white' }}
                    formatter={(value: number, name: string) => [
                      `${Math.round(value).toLocaleString()}$`,
                      name === 'cumulative' ? (language === 'fr' ? 'Cumulatif' : 'Cumulative') : (language === 'fr' ? 'Annuel' : 'Annual')
                    ]}
                  />
                  <Legend
                    wrapperStyle={{ color: 'rgba(255,255,255,0.7)' }}
                    formatter={(value) => value === 'cumulative'
                      ? (language === 'fr' ? 'Cash-flow cumulatif' : 'Cumulative cash flow')
                      : (language === 'fr' ? 'Cash-flow annuel' : 'Annual cash flow')}
                  />
                  <Bar dataKey="annual" fill="rgba(0,61,166,0.6)" radius={[2, 2, 0, 0]} />
                  <Line type="monotone" dataKey="cumulative" stroke={BRAND_COLORS.accentGold} strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey={() => 0} stroke="rgba(255,255,255,0.3)" strokeDasharray="5 5" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Cost of inaction callout */}
            {costOfInaction > 0 && (
              <div
                className="mt-6 rounded-xl px-6 py-4 text-center border-2"
                style={{
                  backgroundColor: 'rgba(255,176,5,0.1)',
                  borderColor: BRAND_COLORS.accentGold
                }}
              >
                <AlertTriangle className="h-5 w-5 inline-block mr-2" style={{ color: BRAND_COLORS.accentGold }} />
                <span className="text-lg font-semibold" style={{ color: BRAND_COLORS.accentGold }}>
                  {language === 'fr' ? 'Coût de l\'inaction sur 25 ans' : 'Cost of inaction over 25 years'}: {Math.round(costOfInaction).toLocaleString()}$
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white/5 rounded-2xl border border-white/10 p-12 text-center">
            <p className="text-white/60">
              {language === 'fr' ? 'Données de cash-flow non disponibles.' : 'Cash flow data not available.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== SLIDE 7: ASSUMPTIONS & EXCLUSIONS ====================
function AssumptionsSlide({ language }: { language: string }) {
  const lang = language as "fr" | "en";
  const assumptions = getAssumptions(lang);
  const exclusions = getExclusions(lang);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-8">
      <div className="max-w-6xl w-full">
        <div className="text-center mb-10">
          <h2 className="text-4xl md:text-5xl font-bold mb-3">
            {language === 'fr' ? 'Hypothèses et Exclusions' : 'Assumptions & Exclusions'}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Assumptions */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h3 className="text-xl font-bold mb-6" style={{ color: BRAND_COLORS.accentGold }}>
              {language === 'fr' ? 'Hypothèses' : 'Assumptions'}
            </h3>
            <div className="space-y-3">
              {assumptions.map((a, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-white/10 last:border-b-0">
                  <span className="text-white/70 text-sm">{a.label}</span>
                  <span className="text-white font-semibold text-sm">{a.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Exclusions */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h3 className="text-xl font-bold mb-6 text-red-400">
              {language === 'fr' ? 'Exclusions' : 'Exclusions'}
            </h3>
            <div className="space-y-3">
              {exclusions.map((excl, i) => (
                <div key={i} className="flex items-start gap-3 py-2">
                  <span className="text-red-400 mt-0.5">✕</span>
                  <span className="text-white/70 text-sm">{excl}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== SLIDE 8: EQUIPMENT & WARRANTIES ====================
function EquipmentSlide({ language }: { language: string }) {
  const lang = language as "fr" | "en";
  const equipment = getEquipment(lang);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-8">
      <div className="max-w-6xl w-full">
        <div className="text-center mb-10">
          <h2 className="text-4xl md:text-5xl font-bold mb-3">
            {language === 'fr' ? 'Équipement et Garanties' : 'Equipment & Warranties'}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {equipment.map((eq, i) => (
            <Card key={i} className="bg-white/5 border-white/10 text-center">
              <CardContent className="p-6">
                <div
                  className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: 'rgba(255,176,5,0.15)' }}
                >
                  <Shield className="h-8 w-8" style={{ color: BRAND_COLORS.accentGold }} />
                </div>
                <p className="text-white/70 text-sm mb-3 min-h-[2.5rem]">{eq.label}</p>
                <p className="text-3xl font-bold" style={{ color: BRAND_COLORS.accentGold }}>{eq.warranty}</p>
                <p className="text-white/40 text-sm mt-1">{language === 'fr' ? 'garantie' : 'warranty'}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-center text-white/40 text-sm mt-8">
          {language === 'fr'
            ? 'Équipement indicatif — marques et modèles confirmés dans la soumission ferme'
            : 'Indicative equipment — brands and models confirmed in the firm quote'}
        </p>
      </div>
    </div>
  );
}

// ==================== SLIDE 9: TIMELINE ====================
function TimelineSlide({ language }: { language: string }) {
  const lang = language as "fr" | "en";
  const timeline = getTimeline(lang);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-8">
      <div className="max-w-6xl w-full">
        <div className="text-center mb-10">
          <h2 className="text-4xl md:text-5xl font-bold mb-3">
            {language === 'fr' ? 'Échéancier Type' : 'Typical Timeline'}
          </h2>
        </div>

        <div className="flex items-center justify-center gap-2 md:gap-4 flex-wrap">
          {timeline.map((tl, i) => {
            const isFirst = i === 0;
            const isLast = i === timeline.length - 1;
            const bgColor = isFirst ? BRAND_COLORS.primaryBlue : isLast ? '#2D915F' : 'rgba(255,255,255,0.08)';
            const borderColor = isFirst ? BRAND_COLORS.primaryBlue : isLast ? '#2D915F' : 'rgba(255,255,255,0.15)';

            return (
              <div key={i} className="flex items-center gap-2 md:gap-4">
                <div
                  className="rounded-xl px-5 py-5 text-center border min-w-[120px]"
                  style={{ backgroundColor: bgColor, borderColor }}
                >
                  <p className="font-bold text-base text-white mb-1">{tl.step}</p>
                  {tl.duration && (
                    <p className="text-sm text-white/70">{tl.duration}</p>
                  )}
                </div>
                {i < timeline.length - 1 && (
                  <ArrowRight className="h-6 w-6 shrink-0" style={{ color: BRAND_COLORS.accentGold }} />
                )}
              </div>
            );
          })}
        </div>

        <p className="text-center text-white/40 text-sm mt-10">
          {language === 'fr'
            ? 'Délais sujets à approbation Hydro-Québec et conditions météorologiques'
            : 'Timelines subject to Hydro-Québec approval and weather conditions'}
        </p>
      </div>
    </div>
  );
}

// ==================== SLIDE 10: NEXT STEPS ====================
function NextStepsSlide({ language }: { language: string }) {
  const lang = language as "fr" | "en";
  const designCovers = getDesignFeeCovers(lang);
  const clientProvides = getClientProvides(lang);
  const clientReceives = getClientReceives(lang);
  const contact = getContactString();

  const columns = [
    {
      title: language === 'fr' ? 'Le Design Fee couvre' : 'The design fee covers',
      items: designCovers,
      icon: '✓',
      headerBg: BRAND_COLORS.primaryBlue,
      headerText: 'white',
    },
    {
      title: language === 'fr' ? 'Le client fournit' : 'The client provides',
      items: clientProvides,
      icon: '□',
      headerBg: BRAND_COLORS.accentGold,
      headerText: '#333',
    },
    {
      title: language === 'fr' ? 'Le client reçoit' : 'The client receives',
      items: clientReceives,
      icon: '→',
      headerBg: '#2D915F',
      headerText: 'white',
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-8">
      <div className="max-w-6xl w-full">
        <div className="text-center mb-10">
          <h2 className="text-4xl md:text-5xl font-bold mb-3">
            {language === 'fr' ? 'Prochaines Étapes' : 'Next Steps'}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {columns.map((col, i) => (
            <div key={i} className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
              <div className="px-4 py-3" style={{ backgroundColor: col.headerBg }}>
                <h3 className="font-bold text-center" style={{ color: col.headerText }}>{col.title}</h3>
              </div>
              <div className="p-5 space-y-3">
                {col.items.map((item, j) => (
                  <div key={j} className="flex items-start gap-2">
                    <span className="text-white/60 mt-0.5">{col.icon}</span>
                    <span className="text-white/70 text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Contact CTA */}
        <div
          className="rounded-2xl px-8 py-6 text-center border-2"
          style={{ backgroundColor: 'rgba(0,61,166,0.3)', borderColor: BRAND_COLORS.primaryBlue }}
        >
          <p className="text-xl font-bold text-white mb-2">
            {language === 'fr' ? 'Contactez-nous pour planifier votre visite de site' : 'Contact us to schedule your site visit'}
          </p>
          <p className="text-lg" style={{ color: BRAND_COLORS.accentGold }}>{contact}</p>
        </div>
      </div>
    </div>
  );
}

// ==================== SLIDE 11: CREDIBILITY ====================
function CredibilitySlide({ language }: { language: string }) {
  const lang = language as "fr" | "en";
  const stats = getAllStats(lang);
  const testimonial = getFirstTestimonial(lang);
  const contact = getContactString();
  const currentLogo = language === 'fr' ? logoFr : logoEn;

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-8">
      <div className="max-w-5xl w-full text-center">
        <h2 className="text-4xl md:text-5xl font-bold mb-10">
          {language === 'fr' ? 'Ils Nous Font Confiance' : 'They Trust Us'}
        </h2>

        {/* Stats */}
        <div className="flex items-center justify-center gap-10 md:gap-16 mb-12">
          {stats.map((stat, i) => (
            <div key={i}>
              <p className="text-5xl md:text-6xl font-bold" style={{ color: BRAND_COLORS.accentGold }}>{stat.value}</p>
              <p className="text-white/60 text-sm mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Testimonial */}
        <div className="bg-white/5 rounded-2xl border border-white/10 p-8 mb-10 max-w-3xl mx-auto">
          <p className="text-xl italic text-white/80 mb-4">
            &laquo; {testimonial.quote} &raquo;
          </p>
          <p className="text-white/50">— {testimonial.author}</p>
        </div>

        {/* CTA footer */}
        <div
          className="rounded-2xl border-2 p-8"
          style={{ backgroundColor: 'rgba(255,176,5,0.1)', borderColor: BRAND_COLORS.accentGold }}
        >
          <img
            src={currentLogo}
            alt="kWh Québec"
            className="h-14 mx-auto mb-4"
          />
          <p className="text-white/70 text-lg mb-4">
            {language === 'fr'
              ? 'Votre partenaire pour la transition énergétique commerciale au Québec'
              : 'Your partner for commercial energy transition in Quebec'}
          </p>
          <p className="text-lg font-bold" style={{ color: BRAND_COLORS.accentGold }}>{contact}</p>
        </div>
      </div>
    </div>
  );
}
