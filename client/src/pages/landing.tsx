import { useState, useEffect, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import {
  Building2, Factory, School, HelpCircle,
  CheckCircle2, ArrowRight, BarChart3, Zap, Clock, DollarSign,
  TrendingUp, Shield, Award, Target, Wrench, HardHat,
  BatteryCharging, MapPin,
  Sun, Battery, FileText, Hammer, Loader2, FileCheck, ClipboardCheck, ChevronUp,
  Phone, Mail, Building, User, Info, Upload, Sparkles, FileSignature,
  Snowflake, XCircle, Star, ChevronDown, Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/lib/i18n";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { FunnelEvents, getStoredUTMParams } from "@/lib/analytics";
import { SEOHead, seoContent, getLocalBusinessSchema, getServiceSchema, getFAQSchema, organizationSchema } from "@/components/seo-head";
import { TIMELINE_GRADIENT, BRAND } from "@shared/colors";
import { getWhySolarNow, getTimeline } from "@shared/brandContent";
import logoFr from "@assets/kWh_Quebec_Logo-01_-_Rectangulaire_1764799021536.png";
import logoEn from "@assets/kWh_Quebec_Logo-02_-_Rectangle_1764799021536.png";
import installationPhoto from "@assets/hero-optimized.jpg";
import roofMeasurement from "@assets/generated_images/commercial_roof_solar_potential_overlay.png";
import consumptionAnalysis from "@assets/generated_images/consumption_analysis_hq_branded.png";
import heroRoofAnalysis from "@assets/generated_images/industrial_roof_solar_potential_overlay.png";
import roofZoneOverlay from "@assets/generated_images/commercial_roof_solar_zone_overlay.png";
import roofMeasurementOverlay from "@assets/generated_images/commercial_roof_solar_measurement_overlay.png";
import heroOptimization from "@assets/Screenshot_2025-12-11_at_2.44.53_PM_1765482299598.png";
import heroCashflow from "@assets/Screenshot_2025-12-07_at_10.53.40_AM_1765122823607.png";
import screenshotSystemEn from "@assets/Screenshot_2025-12-05_at_4.07.23_PM_1764968848494.png";
import screenshotFinancialEn from "@assets/Screenshot_2025-12-05_at_4.07.42_PM_1764968865040.png";
import screenshotOptimizationEn from "@assets/Screenshot_2025-12-05_at_4.07.56_PM_1764968884930.png";
import screenshotConsumptionEn from "@assets/Screenshot_2025-12-05_at_1.50.45_PM_1764960649956.png";
import screenshotConsumptionFr from "@assets/Screenshot_2025-12-04_at_6.51.04_PM_1764892267879.png";
import screenshotOptimizationFr from "@assets/Screenshot_2025-12-03_at_4.09.24_PM_1764796169826.png";
import screenshotFinancialFr from "@assets/Screenshot_2025-12-05_at_2.24.54_PM_1764963093938.png";
import carouselSlide1Fr from "@assets/Screenshot_2025-12-11_at_9.14.32_PM_1765505832705.png";
import carouselSlide2Fr from "@assets/Screenshot_2025-12-11_at_9.14.51_PM_1765505832704.png";
import carouselSlide3Fr from "@assets/Screenshot_2025-12-11_at_9.15.03_PM_1765505832704.png";
import carouselSlide4Fr from "@assets/Screenshot_2025-12-11_at_9.15.24_PM_1765505832703.png";
import carouselSlide5Fr from "@assets/Screenshot_2025-12-11_at_9.15.38_PM_1765505832702.png";
import carouselSlide6Fr from "@assets/Screenshot_2025-12-11_at_9.15.53_PM_1765505832701.png";
import carouselSlide7Fr from "@assets/Screenshot_2025-12-11_at_9.16.06_PM_1765505832689.png";
import dreamIndustrialLogo from "@assets/Dream_industrial_logo-removebg-preview_1769529256535.png";
import labSpaceLogo from "@assets/Logo_full_1769527493871.png";
import scaleCleantechLogo from "@assets/scale-cleantech-color_small-VSYW5GJE_1769527536419.webp";
import hqLogo from "@assets/Screenshot_2026-01-27_at_5.26.14_PM_1769552778826.png";

// Complete form with all fields
const leadFormSchema = z.object({
  companyName: z.string().min(1, "Ce champ est requis"),
  contactName: z.string().min(1, "Ce champ est requis"),
  email: z.string().email("Courriel invalide"),
  phone: z.string().optional(),
  streetAddress: z.string().min(1, "Ce champ est requis"),
  city: z.string().min(1, "Ce champ est requis"),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  estimatedMonthlyBill: z.coerce.number().optional(),
  buildingType: z.string().optional(),
  notes: z.string().optional(),
});

type LeadFormValues = z.infer<typeof leadFormSchema>;

interface HQBillData {
  accountNumber: string | null;
  clientName: string | null;
  serviceAddress: string | null;
  annualConsumptionKwh: number | null;
  peakDemandKw: number | null;
  tariffCode: string | null;
  billingPeriod: string | null;
  estimatedMonthlyBill: number | null;
  confidence: number;
}

type FlowStep = 'upload' | 'parsing' | 'extracted' | 'quickResult' | 'qualifying' | 'qualifiedResult' | 'manualEntry' | 'submitted';

// Client-side self-qualification types and logic
type LeadColor = 'green' | 'yellow' | 'red';

interface SelfQualData {
  ownershipType: 'owner' | 'tenant_authorized' | 'tenant_pending' | 'tenant_no_auth' | '';
  paysHydroDirectly: 'yes' | 'no' | 'unknown' | '';
  roofAgeRange: 'new' | 'recent' | 'mature' | 'old' | '';
  roofUsageRight: 'yes' | 'no' | 'unknown' | '';
}

interface QualBlocker {
  key: string;
  messageFr: string;
  messageEn: string;
  actionFr: string;
  actionEn: string;
}

interface QualOutcome {
  color: LeadColor;
  blockers: QualBlocker[];
  nextStepFr: string;
  nextStepEn: string;
}

function classifyLead(data: SelfQualData, monthlyBill?: number): QualOutcome {
  const redBlockers: QualBlocker[] = [];
  const yellowBlockers: QualBlocker[] = [];

  // RED: Tenant without auth AND no roof right
  if (data.ownershipType === 'tenant_no_auth' && data.roofUsageRight === 'no') {
    redBlockers.push({ key: 'no_roof_auth', messageFr: "Pas d'autorisation du propriétaire pour la toiture", messageEn: "No landlord authorization for roof usage", actionFr: "Obtenir une lettre d'autorisation de votre propriétaire pour l'utilisation de la toiture", actionEn: "Obtain written authorization from your landlord for roof usage" });
  }
  // RED: Electricity included in lease
  if (data.paysHydroDirectly === 'no') {
    redBlockers.push({ key: 'hydro_in_lease', messageFr: "L'électricité est incluse dans le bail", messageEn: "Electricity is included in the lease", actionFr: "Négocier un bail séparant les frais d'électricité, ou impliquer votre propriétaire dans le projet", actionEn: "Negotiate separate electricity costs in lease, or involve your landlord" });
  }
  // RED: Roof 25+ years
  if (data.roofAgeRange === 'old') {
    redBlockers.push({ key: 'roof_old', messageFr: "Toiture de plus de 25 ans", messageEn: "Roof over 25 years old", actionFr: "Planifier le remplacement de la toiture. Le solaire peut être installé immédiatement après", actionEn: "Plan roof replacement. Solar can be installed immediately after" });
  }
  // RED: Bill too low
  if (monthlyBill !== undefined && monthlyBill > 0 && monthlyBill < 1500) {
    redBlockers.push({ key: 'bill_low', messageFr: "Facture mensuelle trop basse pour un projet C&I viable", messageEn: "Monthly bill too low for viable C&I project", actionFr: "Le solaire commercial est optimal pour des factures de 2 500$/mois et plus", actionEn: "Commercial solar is optimal for bills of $2,500/month and above" });
  }
  if (redBlockers.length > 0) {
    return { color: 'red', blockers: redBlockers, nextStepFr: "Le solaire n'est peut-être pas la meilleure option pour vous en ce moment. Voici ce qui pourrait changer la donne:", nextStepEn: "Solar may not be the best option for you right now. Here's what could change that:" };
  }

  // YELLOW: Authorization pending
  if (data.ownershipType === 'tenant_pending') {
    yellowBlockers.push({ key: 'auth_pending', messageFr: "Autorisation du propriétaire en cours", messageEn: "Landlord authorization in progress", actionFr: "Accélérer le processus d'approbation auprès de votre propriétaire", actionEn: "Accelerate the approval process with your landlord" });
  }
  // YELLOW: Roof 15-25 years
  if (data.roofAgeRange === 'mature') {
    yellowBlockers.push({ key: 'roof_mature', messageFr: "Toiture de 15-25 ans — inspection recommandée", messageEn: "Roof 15-25 years old — inspection recommended", actionFr: "Faire inspecter la toiture par un professionnel avant l'installation", actionEn: "Have roof professionally inspected before installation" });
  }
  // YELLOW: Hydro payment unknown
  if (data.paysHydroDirectly === 'unknown') {
    yellowBlockers.push({ key: 'hydro_unknown', messageFr: "À confirmer: paiement direct à Hydro-Québec", messageEn: "To confirm: direct payment to Hydro-Québec", actionFr: "Vérifier votre dernier compte ou contacter Hydro-Québec", actionEn: "Check your latest bill or contact Hydro-Québec directly" });
  }
  // YELLOW: Roof usage unknown (tenant)
  if (data.ownershipType.startsWith('tenant') && data.roofUsageRight === 'unknown') {
    yellowBlockers.push({ key: 'roof_right_unknown', messageFr: "Droit d'utilisation de la toiture à confirmer", messageEn: "Roof usage rights to be confirmed", actionFr: "Clarifier avec votre propriétaire si vous avez le droit d'utiliser la toiture", actionEn: "Clarify with your landlord whether you have roof usage rights" });
  }
  if (yellowBlockers.length > 0) {
    return { color: 'yellow', blockers: yellowBlockers, nextStepFr: "Quelques points à clarifier avant l'appel. Votre projet reste prometteur!", nextStepEn: "A few points to clarify before the call. Your project remains promising!" };
  }

  return { color: 'green', blockers: [], nextStepFr: "Votre projet a un excellent potentiel! Réservez votre appel découverte.", nextStepEn: "Your project has excellent potential! Book your discovery call." };
}

export default function LandingPage() {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [submitted, setSubmitted] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);

  // Upload-first flow state
  const [flowStep, setFlowStep] = useState<FlowStep>('upload');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedBillData, setParsedBillData] = useState<HQBillData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [quickEmail, setQuickEmail] = useState('');
  const [manualKwh, setManualKwh] = useState('');
  const [quickAnalysisResult, setQuickAnalysisResult] = useState<any>(null);
  // Qualification fields
  const [roofAgeYears, setRoofAgeYears] = useState<string>('');
  const [ownershipType, setOwnershipType] = useState<'owner' | 'tenant' | ''>('');

  // Self-qualification state (post quick-result)
  const [selfQualData, setSelfQualData] = useState<SelfQualData>({
    ownershipType: '', paysHydroDirectly: '', roofAgeRange: '', roofUsageRight: '',
  });
  const [qualOutcome, setQualOutcome] = useState<QualOutcome | null>(null);

  // FAQ accordion state
  const [expandedFaqItems, setExpandedFaqItems] = useState<string[]>(['item1']);

  // Client-side preview calculation — aligned with Quick Analysis methodology (leads.ts)
  const clientPreview = useMemo(() => {
    if (!parsedBillData?.annualConsumptionKwh) return null;
    const annualKwh = parsedBillData.annualConsumptionKwh;
    const monthlyBill = parsedBillData.estimatedMonthlyBill || (annualKwh * 0.07 / 12);
    const annualBill = monthlyBill * 12;

    // === UNIFIED METHODOLOGY (matches potentialAnalysis.ts & leads.ts) ===
    const BASELINE_YIELD = 1150;
    const TEMP_COEFF = -0.004;
    const AVG_CELL_TEMP = 35;
    const STC_TEMP = 25;
    const WIRE_LOSS = 0.02;
    const INVERTER_EFF = 0.96;
    const tempLoss = 1 + TEMP_COEFF * (AVG_CELL_TEMP - STC_TEMP);
    const EFFECTIVE_YIELD = BASELINE_YIELD * tempLoss * (1 - WIRE_LOSS) * INVERTER_EFF; // ~1035 kWh/kWp

    // System size: 70% offset target, capped at 1 MW (HQ Net Metering limit for incentives)
    const HQ_MW_LIMIT = 1000;
    const rawSystemSize = Math.round((annualKwh * 0.7) / EFFECTIVE_YIELD);
    const systemSizeKw = Math.min(rawSystemSize, HQ_MW_LIMIT);
    const isCapped = rawSystemSize > HQ_MW_LIMIT;

    // Energy rate: derive from bill data or default M tariff rate
    const energyRate = annualKwh > 0 ? (annualBill * 0.60) / annualKwh : 0.06061;
    const clampedRate = Math.max(0.03, Math.min(energyRate, 0.15));

    // Annual savings = solar production × energy rate (same formula as leads.ts line 162)
    const annualProductionKwh = systemSizeKw * EFFECTIVE_YIELD;
    const estimatedSavings = Math.round(annualProductionKwh * clampedRate);

    // Cost of inaction: 5-year projection at 3.5%/yr tariff escalation
    let costOfInaction5yr = 0;
    for (let y = 0; y < 5; y++) {
      costOfInaction5yr += annualBill * Math.pow(1.035, y);
    }
    const extraCost5yr = Math.round(costOfInaction5yr - (annualBill * 5));

    return { systemSizeKw, isCapped, estimatedSavings, annualBill, extraCost5yr, costOfInaction5yr: Math.round(costOfInaction5yr) };
  }, [parsedBillData]);

  const currentLogo = language === "fr" ? logoFr : logoEn;
  
  const analysisSlides = language === "fr" 
    ? [
        { id: "impact", image: carouselSlide1Fr, label: "Impact sur votre facture" },
        { id: "config", image: carouselSlide2Fr, label: "Configuration optimale" },
        { id: "evolution", image: carouselSlide3Fr, label: "Évolution sur 25 ans" },
        { id: "financing", image: carouselSlide4Fr, label: "Options d'acquisition" },
        { id: "profile", image: carouselSlide5Fr, label: "Profil énergétique" },
        { id: "optimization", image: carouselSlide6Fr, label: "Analyse d'optimisation" },
        { id: "sensitivity", image: carouselSlide7Fr, label: "Sensibilité système" },
      ]
    : [
        { id: "potential", image: roofMeasurement, label: "Roof solar potential" },
        { id: "industrial", image: heroRoofAnalysis, label: "Industrial analysis" },
        { id: "zones", image: roofZoneOverlay, label: "Solar zone mapping" },
        { id: "measurement", image: roofMeasurementOverlay, label: "Precision measurement" },
      ];
  
  useEffect(() => {
    setActiveSlide(0);
  }, [language]);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % analysisSlides.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [analysisSlides.length]);

  // Scroll depth tracking
  useEffect(() => {
    const handleScroll = () => {
      const scrollPercent = Math.round((window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100);
      const milestones = [25, 50, 75, 100];
      const reached = milestones.filter(m => scrollPercent >= m);
      reached.forEach(milestone => {
        const key = `scroll_${milestone}_tracked`;
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, 'true');
          FunnelEvents.scrollDepth(milestone, 'landing');
        }
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      companyName: "",
      contactName: "",
      email: "",
      phone: "",
      streetAddress: "",
      city: "",
      province: "Québec",
      postalCode: "",
      estimatedMonthlyBill: undefined,
      buildingType: "",
      notes: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: LeadFormValues) => {
      return apiRequest("POST", "/api/leads", data);
    },
    onSuccess: () => {
      const name = form.getValues('contactName') || form.getValues('email');
      navigate(`/merci?type=lead&name=${encodeURIComponent(name)}`);
    },
  });

  const onSubmit = (data: LeadFormValues) => {
    mutation.mutate(data);
  };

  const buildingTypes = [
    { value: "industrial", label: t("form.buildingType.industrial"), icon: Factory },
    { value: "commercial", label: t("form.buildingType.commercial"), icon: Building2 },
    { value: "institutional", label: t("form.buildingType.institutional"), icon: School },
    { value: "other", label: t("form.buildingType.other"), icon: HelpCircle },
  ];

  // Dropzone for bill upload
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    FunnelEvents.formStarted('bill_upload');

    const file = acceptedFiles[0];
    const isValidType = file.type === 'application/pdf' || file.type.startsWith('image/');
    const isValidSize = file.size <= 10 * 1024 * 1024;

    if (!isValidType) {
      setParseError(language === "fr"
        ? "Format invalide. Utilisez PDF ou image (JPG, PNG)."
        : "Invalid format. Use PDF or image (JPG, PNG).");
      return;
    }
    if (!isValidSize) {
      setParseError(language === "fr"
        ? "Fichier trop volumineux. Maximum 10 Mo."
        : "File too large. Maximum 10 MB.");
      return;
    }

    // Track bill upload event
    FunnelEvents.billUploaded(file.type);

    setUploadedFile(file);
    setParseError(null);
    setFlowStep('parsing');

    // Parse the bill with AI
    const formData = new FormData();
    formData.append('file', file);

    fetch('/api/parse-hq-bill', {
      method: 'POST',
      body: formData,
    })
      .then(response => {
        if (!response.ok) throw new Error('Failed to parse bill');
        return response.json();
      })
      .then(result => {
        if (!result.success || !result.data) {
          throw new Error('Failed to parse bill data');
        }
        setParsedBillData(result.data as HQBillData);
        setFlowStep('extracted');
        // Track successful bill parsing
        FunnelEvents.billParsed(result.data.annualConsumptionKwh || 0, result.data.confidence || 0);
      })
      .catch(() => {
        FunnelEvents.formError('bill_upload', 'parse_failed');
        setFlowStep('upload');
        setParseError(language === "fr"
          ? "Impossible d'analyser la facture. Réessayez ou entrez votre consommation manuellement."
          : "Unable to analyze the bill. Try again or enter your consumption manually.");
      });
  }, [language]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    },
    maxFiles: 1
  });

  // Quick analysis mutation
  const quickAnalysisMutation = useMutation({
    mutationFn: async (data: {
      email: string;
      annualKwh: number;
      clientName?: string;
      address?: string;
      roofAgeYears?: number;
      ownershipType?: string;
    }) => {
      const response = await fetch('/api/quick-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          annualConsumptionKwh: data.annualKwh,
          email: data.email,
          clientName: data.clientName || '',
          address: data.address || '',
          roofAgeYears: data.roofAgeYears,
          ownershipType: data.ownershipType,
          ...getStoredUTMParams(),
        }),
      });
      if (!response.ok) throw new Error('Failed to get quick analysis');
      return response.json();
    },
    onSuccess: (data) => {
      setQuickAnalysisResult(data);
      setFlowStep('quickResult');
    },
    onError: () => {
      FunnelEvents.formError('quick_analysis', 'api_error');
      toast({
        title: language === "fr" ? "Erreur" : "Error",
        description: language === "fr"
          ? "Impossible de générer l'analyse. Veuillez réessayer."
          : "Unable to generate analysis. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleQuickAnalysis = () => {
    if (!quickEmail || !quickEmail.includes('@')) {
      toast({
        title: language === "fr" ? "Courriel requis" : "Email required",
        description: language === "fr"
          ? "Veuillez entrer une adresse courriel valide."
          : "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    const annualKwh = parsedBillData?.annualConsumptionKwh || parseInt(manualKwh) || 0;
    if (annualKwh < 1000) {
      toast({
        title: language === "fr" ? "Consommation invalide" : "Invalid consumption",
        description: language === "fr"
          ? "La consommation annuelle doit être d'au moins 1,000 kWh."
          : "Annual consumption must be at least 1,000 kWh.",
        variant: "destructive",
      });
      return;
    }

    // Track email capture event
    FunnelEvents.emailCaptured('quick_estimate');

    // Track form submission method
    FunnelEvents.formSubmitted('quick_analysis', parsedBillData ? 'bill_upload' : 'manual_entry');

    quickAnalysisMutation.mutate({
      email: quickEmail,
      annualKwh,
      clientName: parsedBillData?.clientName || undefined,
      address: parsedBillData?.serviceAddress || undefined,
      roofAgeYears: roofAgeYears ? parseInt(roofAgeYears) : undefined,
      ownershipType: ownershipType || undefined,
    });
  };

  const handleDetailedPath = () => {
    // Track procuration start event
    FunnelEvents.procurationStarted();

    // Store parsed data in localStorage for analyse-detaillee to pick up
    if (parsedBillData) {
      localStorage.setItem('kwhquebec_bill_data', JSON.stringify({
        ...parsedBillData,
        email: quickEmail,
      }));
    }
    navigate('/analyse-detaillee');
  };

  const resetFlow = () => {
    setFlowStep('upload');
    setUploadedFile(null);
    setParsedBillData(null);
    setParseError(null);
    setQuickEmail('');
    setManualKwh('');
    setQuickAnalysisResult(null);
    setRoofAgeYears('');
    setOwnershipType('');
  };

  const seo = language === "fr" ? seoContent.home.fr : seoContent.home.en;

  // Build comprehensive schema markup for better SEO
  const schemas = [
    organizationSchema,
    getLocalBusinessSchema(language),
    getServiceSchema(language),
    getFAQSchema(language),
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={seo.title}
        description={seo.description}
        keywords={seo.keywords}
        structuredData={schemas}
        locale={language}
        canonical="https://kwh.quebec"
        includeHreflang={true}
      />
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-background backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <Link href="/">
              <img 
                src={currentLogo} 
                alt="kWh Québec" 
                className="h-[50px] sm:h-[3.75rem] w-auto"
                data-testid="logo-header"
              />
            </Link>
            
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/" className="text-sm font-medium text-foreground" data-testid="link-home">
                {language === "fr" ? "Accueil" : "Home"}
              </Link>
              <Link href="/ressources" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-resources">
                {language === "fr" ? "Ressources" : "Resources"}
              </Link>
              <Link href="/portfolio" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-portfolio">
                Portfolio
              </Link>
            </nav>

            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
              <Link href="/login">
                <Button variant="outline" size="sm" data-testid="button-login">
                  {t("nav.login")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>
      {/* ========== NEW HERO SECTION ========== */}
      <section className="relative pt-16 min-h-[85vh] flex items-center overflow-hidden" data-testid="section-hero">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${installationPhoto})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80" />
        
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <motion.div 
            className="max-w-3xl"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-4" data-testid="hero-headline">
              {language === "fr" 
                ? <>Panneaux solaires <span className="inline-flex items-center justify-center bg-yellow-400 text-white w-[0.9em] h-[0.9em] rounded-sm text-[0.8em] font-bold align-middle">+</span> stockage</> 
                : <>Solar panels <span className="inline-flex items-center justify-center bg-yellow-400 text-white w-[0.9em] h-[0.9em] rounded-sm text-[0.8em] font-bold align-middle">+</span> storage</>}
            </h1>
            
            <p className="text-2xl sm:text-3xl text-white/90 font-medium mb-2" data-testid="hero-subtitle">
              {language === "fr" 
                ? "Commercial & Industriel" 
                : "Commercial & Industrial"}
            </p>
            
            <p className="text-2xl sm:text-3xl text-white/90 font-medium mb-6" data-testid="hero-location">
              {language === "fr" 
                ? "Partout au Québec" 
                : "Across Quebec"}
            </p>
            
            <p className="text-xl text-yellow-400 font-semibold mb-8" data-testid="hero-value-prop">
              {language === "fr" 
                ? "Incitatifs financiers jusqu'à 60% du projet." 
                : "Financial incentives up to 60% of project."}
            </p>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <div className="flex flex-col items-start gap-2">
                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs">
                  {language === "fr" ? "GRATUIT · 2 minutes" : "FREE · 2 minutes"}
                </Badge>
                <Button
                  size="lg"
                  className="gap-2 text-lg px-8 py-6"
                  onClick={() => {
                    document.getElementById('analyse')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  data-testid="button-hero-cta"
                >
                  <Sun className="w-5 h-5" />
                  {language === "fr" ? "Obtenir mon analyse" : "Get my analysis"}
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </div>
            </motion.div>
          </motion.div>
          
          {/* Partner logos */}
          <motion.div 
            className="mt-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <p className="text-sm text-white/50 mb-4">
              {language === "fr" ? "Ils nous font confiance" : "They trust us"}
            </p>
            <div className="flex flex-wrap items-center gap-12" data-testid="hero-partner-logos">
              <img 
                src={dreamIndustrialLogo} 
                alt="Dream Industrial" 
                className="h-auto w-32 opacity-80 hover:opacity-100 transition-opacity brightness-0 invert"
                data-testid="logo-dream-industrial"
              />
              <img 
                src={labSpaceLogo} 
                alt="LabSpace" 
                className="h-auto w-36 opacity-80 hover:opacity-100 transition-opacity brightness-0 invert"
                data-testid="logo-labspace"
              />
              <img 
                src={scaleCleantechLogo} 
                alt="Scale Cleantech" 
                className="h-auto w-36 opacity-80 hover:opacity-100 transition-opacity brightness-0 invert"
                data-testid="logo-scale-cleantech"
              />
            </div>
          </motion.div>
        </div>
      </section>
      {/* ========== UPLOAD/ANALYSIS SECTION ========== */}
      <section id="analyse" className="relative py-16 overflow-hidden" data-testid="section-analyse">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />
        <div className="absolute top-20 right-0 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl opacity-50" />
        
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            className="text-center space-y-6"
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            {/* Section Header */}
            <div className="space-y-2">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight" data-testid="analyse-section-title">
                {language === "fr" 
                  ? "Obtenez votre analyse solaire gratuite" 
                  : "Get your free solar analysis"}
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                {language === "fr" 
                  ? "Commercial & Industriel • Incitatifs jusqu'à 60%" 
                  : "Commercial & Industrial • Incentives up to 60%"}
              </p>
            </div>

            {/* Main Flow Card */}
            <Card className="max-w-2xl mx-auto border-2 border-primary/20 shadow-xl">
              <CardContent className="p-6 sm:p-8">
                <AnimatePresence mode="wait">
                  {/* Step 1: Upload */}
                  {flowStep === 'upload' && (
                    <motion.div
                      key="upload"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-4"
                    >
                      <div className="space-y-2 text-center">
                        <h2 className="text-xl sm:text-2xl font-semibold">
                          {language === "fr" 
                            ? "Téléversez votre facture Hydro-Québec" 
                            : "Upload your Hydro-Québec bill"}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          {language === "fr" 
                            ? "Notre outil va automatiquement remplir le formulaire avec vos données" 
                            : "Our tool will automatically fill the form with your info"}
                        </p>
                      </div>
                      
                      {/* Dropzone */}
                      <div
                        {...getRootProps()}
                        data-testid="dropzone-bill"
                        className={`border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all ${
                          isDragActive 
                            ? "border-primary bg-primary/5" 
                            : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30"
                        }`}
                      >
                        <input {...getInputProps()} />
                        <div className="flex flex-col items-center gap-3 text-center">
                          <div className="p-4 rounded-full bg-primary/10">
                            <Upload className="w-8 h-8 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">
                              {isDragActive 
                                ? (language === "fr" ? "Déposez ici..." : "Drop here...")
                                : (language === "fr" ? "Glissez votre facture ici" : "Drag your bill here")}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {language === "fr" ? "ou cliquez pour sélectionner" : "or click to select"}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">PDF, JPG, PNG</p>
                        </div>
                      </div>
                      
                      {parseError && (
                        <p className="text-sm text-destructive text-center">{parseError}</p>
                      )}
                      
                      {/* Manual entry fallback */}
                      <div className="text-center pt-2">
                        <button
                          onClick={() => {
                            FunnelEvents.formStarted('manual_entry');
                            setFlowStep('manualEntry');
                          }}
                          className="text-sm text-muted-foreground hover:text-primary underline"
                          data-testid="link-manual-entry"
                        >
                          {language === "fr" 
                            ? "Pas de facture? Entrez votre consommation" 
                            : "No bill? Enter your consumption"}
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 1b: Parsing */}
                  {flowStep === 'parsing' && (
                    <motion.div
                      key="parsing"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="py-12 text-center space-y-4"
                    >
                      <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
                      <div>
                        <p className="font-medium">
                          {language === "fr" ? "Analyse en cours..." : "Analyzing..."}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {language === "fr" 
                            ? "Notre IA lit votre facture" 
                            : "Our AI is reading your bill"}
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 2: Extracted - Show data + partial preview + email gate */}
                  {flowStep === 'extracted' && parsedBillData && (
                    <motion.div
                      key="extracted"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-6"
                    >
                      {/* Success header */}
                      <div className="text-center space-y-2">
                        <div className="inline-flex items-center gap-2 text-green-600">
                          <CheckCircle2 className="w-5 h-5" />
                          <span className="font-medium">
                            {language === "fr" ? "Facture analysée!" : "Bill analyzed!"}
                          </span>
                        </div>
                      </div>

                      {/* Extracted data preview */}
                      <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                        {parsedBillData.clientName && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{language === "fr" ? "Client" : "Client"}</span>
                            <span className="font-medium">{parsedBillData.clientName}</span>
                          </div>
                        )}
                        {parsedBillData.serviceAddress && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{language === "fr" ? "Adresse" : "Address"}</span>
                            <span className="font-medium truncate max-w-[200px]">{parsedBillData.serviceAddress}</span>
                          </div>
                        )}
                        {parsedBillData.annualConsumptionKwh && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{language === "fr" ? "Consommation" : "Consumption"}</span>
                            <span className="font-medium text-primary">{parsedBillData.annualConsumptionKwh.toLocaleString()} kWh/an</span>
                          </div>
                        )}
                      </div>

                      {/* Partial preview results (3 cards) */}
                      {clientPreview && (
                        <div className="space-y-3">
                          <p className="text-sm font-medium text-center text-primary">
                            {language === "fr" ? "Potentiel estimé de votre bâtiment" : "Your building's estimated potential"}
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-primary/5 rounded-lg p-3 text-center">
                              <p className="text-2xl font-bold text-primary" data-testid="text-system-size-kw">{clientPreview.systemSizeKw}</p>
                              <p className="text-xs text-muted-foreground">
                                {language === "fr" ? "kWc recommandés" : "kWp recommended"}
                              </p>
                              {clientPreview.isCapped && (
                                <p className="text-[10px] text-amber-600 mt-0.5">
                                  {language === "fr" ? "plafonné à 1 MW (incitatifs)" : "capped at 1 MW (incentives)"}
                                </p>
                              )}
                            </div>
                            <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 text-center">
                              <p className="text-2xl font-bold text-green-600" data-testid="text-estimated-savings">${clientPreview.estimatedSavings.toLocaleString()}</p>
                              <p className="text-xs text-muted-foreground">
                                {language === "fr" ? "économies estimées/an" : "est. savings/yr"}
                              </p>
                              <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                                {language === "fr" ? "sur votre facture" : "on your bill"}
                              </p>
                            </div>
                            <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3 text-center">
                              <p className="text-2xl font-bold text-red-500" data-testid="text-inaction-cost">+${clientPreview.extraCost5yr.toLocaleString()}</p>
                              <p className="text-xs text-muted-foreground">
                                {language === "fr" ? "hausse prévue sur 5 ans" : "projected increase over 5 yrs"}
                              </p>
                              <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                                {language === "fr" ? "sans solaire" : "without solar"}
                              </p>
                            </div>
                          </div>
                          <p className="text-xs text-center text-red-500/80">
                            {language === "fr"
                              ? `Ne rien faire vous coûtera ${clientPreview.costOfInaction5yr.toLocaleString()}$ sur 5 ans avec la hausse des tarifs Hydro-Québec.`
                              : `Doing nothing will cost you $${clientPreview.costOfInaction5yr.toLocaleString()} over 5 years with Hydro-Québec rate increases.`}
                          </p>
                        </div>
                      )}

                      {/* Email gate */}
                      <div className="space-y-3 pt-2 border-t">
                        <p className="text-sm font-medium text-center">
                          {language === "fr"
                            ? "Recevez votre rapport complet avec les options de financement"
                            : "Get your full report with financing options"}
                        </p>
                        <Input
                          type="email"
                          placeholder={language === "fr" ? "votre@courriel.com" : "your@email.com"}
                          value={quickEmail}
                          onChange={(e) => setQuickEmail(e.target.value)}
                          className="text-center"
                          data-testid="input-quick-email"
                        />
                        <Button
                          onClick={handleQuickAnalysis}
                          disabled={quickAnalysisMutation.isPending}
                          className="w-full gap-2 h-11"
                          data-testid="button-submit-quick"
                        >
                          {quickAnalysisMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <ArrowRight className="w-4 h-4" />
                          )}
                          {language === "fr" ? "Recevoir mon rapport gratuit" : "Get my free report"}
                        </Button>
                        <p className="text-[11px] text-center text-muted-foreground">
                          {language === "fr" ? "Gratuit et sans engagement" : "Free, no commitment"}
                        </p>
                      </div>

                      {/* Reset link */}
                      <div className="text-center">
                        <button onClick={resetFlow} className="text-xs text-muted-foreground hover:underline">
                          {language === "fr" ? "← Recommencer" : "← Start over"}
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 3: Quick results — single CTA to qualification */}
                  {flowStep === 'quickResult' && quickAnalysisResult && (
                    <motion.div
                      key="quickResult"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-4"
                    >
                      <div className="text-center space-y-2">
                        <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
                        <h3 className="text-lg font-semibold">
                          {language === "fr" ? "Rapport envoyé!" : "Report sent!"}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {language === "fr"
                            ? "Vérifiez votre boîte de réception."
                            : "Check your inbox."}
                        </p>
                      </div>

                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
                        <p className="text-sm font-medium text-center">
                          {language === "fr"
                            ? "Voyons si votre bâtiment est un bon candidat pour le solaire"
                            : "Let's see if your building is a good solar candidate"}
                        </p>
                        <p className="text-xs text-muted-foreground text-center">
                          {language === "fr"
                            ? "4 questions rapides (30 secondes) pour une recommandation personnalisée"
                            : "4 quick questions (30 seconds) for a personalized recommendation"}
                        </p>
                        <Button
                          onClick={() => setFlowStep('qualifying')}
                          className="w-full gap-2"
                          data-testid="button-start-qualification"
                        >
                          <ArrowRight className="w-4 h-4" />
                          {language === "fr" ? "Continuer →" : "Continue →"}
                        </Button>
                      </div>

                      <button onClick={resetFlow} className="w-full text-sm text-muted-foreground hover:underline">
                        {language === "fr" ? "Nouvelle analyse" : "New analysis"}
                      </button>
                    </motion.div>
                  )}

                  {/* Step 4: Self-Qualification Questions */}
                  {flowStep === 'qualifying' && (
                    <motion.div
                      key="qualifying"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="space-y-6"
                    >
                      <div className="text-center space-y-1">
                        <h3 className="text-lg font-semibold">
                          {language === "fr" ? "Parlons de votre bâtiment" : "Tell us about your building"}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {language === "fr" ? "4 questions, 30 secondes" : "4 questions, 30 seconds"}
                        </p>
                      </div>

                      {/* Q1: Ownership */}
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold">
                          {language === "fr" ? "Êtes-vous propriétaire de l'immeuble?" : "Do you own the building?"}
                        </label>
                        <div className="grid grid-cols-1 gap-2">
                          {([
                            { value: 'owner', fr: 'Propriétaire', en: 'Owner' },
                            { value: 'tenant_authorized', fr: 'Locataire avec autorisation', en: 'Tenant with authorization' },
                            { value: 'tenant_pending', fr: 'Locataire (en attente)', en: 'Tenant (pending auth)' },
                            { value: 'tenant_no_auth', fr: 'Locataire (sans autorisation)', en: 'Tenant (no authorization)' },
                          ] as const).map((opt) => (
                            <div
                              key={opt.value}
                              onClick={() => setSelfQualData({ ...selfQualData, ownershipType: opt.value })}
                              className={`p-3 rounded-lg border-2 cursor-pointer transition-all text-sm font-medium ${
                                selfQualData.ownershipType === opt.value
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'border-input hover:border-primary'
                              }`}
                            >
                              {language === "fr" ? opt.fr : opt.en}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Q2: Hydro payment */}
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold">
                          {language === "fr" ? "Payez-vous Hydro-Québec directement?" : "Do you pay Hydro-Québec directly?"}
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {([
                            { value: 'yes', fr: 'Oui', en: 'Yes' },
                            { value: 'no', fr: 'Non (bail)', en: 'No (lease)' },
                            { value: 'unknown', fr: 'Je ne sais pas', en: 'Not sure' },
                          ] as const).map((opt) => (
                            <div
                              key={opt.value}
                              onClick={() => setSelfQualData({ ...selfQualData, paysHydroDirectly: opt.value })}
                              className={`p-3 rounded-lg border-2 cursor-pointer transition-all text-sm font-medium text-center ${
                                selfQualData.paysHydroDirectly === opt.value
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'border-input hover:border-primary'
                              }`}
                            >
                              {language === "fr" ? opt.fr : opt.en}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Q3: Roof age */}
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold">
                          {language === "fr" ? "Âge approximatif de la toiture?" : "Approximate roof age?"}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {([
                            { value: 'new', fr: '0-5 ans', en: '0-5 years' },
                            { value: 'recent', fr: '5-15 ans', en: '5-15 years' },
                            { value: 'mature', fr: '15-25 ans', en: '15-25 years' },
                            { value: 'old', fr: '25+ ans', en: '25+ years' },
                          ] as const).map((opt) => (
                            <div
                              key={opt.value}
                              onClick={() => setSelfQualData({ ...selfQualData, roofAgeRange: opt.value })}
                              className={`p-3 rounded-lg border-2 cursor-pointer transition-all text-sm font-medium text-center ${
                                selfQualData.roofAgeRange === opt.value
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'border-input hover:border-primary'
                              }`}
                            >
                              {language === "fr" ? opt.fr : opt.en}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Q4: Roof usage right (only if tenant) */}
                      {selfQualData.ownershipType.startsWith('tenant') && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2">
                          <label className="block text-sm font-semibold">
                            {language === "fr" ? "Avez-vous le droit d'utiliser la toiture?" : "Do you have roof usage rights?"}
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {([
                              { value: 'yes', fr: 'Oui', en: 'Yes' },
                              { value: 'no', fr: 'Non', en: 'No' },
                              { value: 'unknown', fr: 'Je ne sais pas', en: 'Not sure' },
                            ] as const).map((opt) => (
                              <div
                                key={opt.value}
                                onClick={() => setSelfQualData({ ...selfQualData, roofUsageRight: opt.value })}
                                className={`p-3 rounded-lg border-2 cursor-pointer transition-all text-sm font-medium text-center ${
                                  selfQualData.roofUsageRight === opt.value
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'border-input hover:border-primary'
                                }`}
                              >
                                {language === "fr" ? opt.fr : opt.en}
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}

                      {/* Submit */}
                      <Button
                        onClick={async () => {
                          const outcome = classifyLead(selfQualData, quickAnalysisResult?.estimatedMonthlyBill);
                          setQualOutcome(outcome);
                          setFlowStep('qualifiedResult');
                          if (quickAnalysisResult?.leadId) {
                            try {
                              await fetch(`/api/leads/${quickAnalysisResult.leadId}/self-qualification`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ ...selfQualData, leadColor: outcome.color }),
                              });
                            } catch (e) { console.error('Failed to save qualification:', e); }
                          }
                        }}
                        disabled={
                          !selfQualData.ownershipType ||
                          !selfQualData.paysHydroDirectly ||
                          !selfQualData.roofAgeRange ||
                          (selfQualData.ownershipType.startsWith('tenant') && !selfQualData.roofUsageRight)
                        }
                        className="w-full gap-2"
                        data-testid="button-submit-qualification"
                      >
                        <ArrowRight className="w-4 h-4" />
                        {language === "fr" ? "Voir mes résultats →" : "See my results →"}
                      </Button>
                    </motion.div>
                  )}

                  {/* Step 5: Qualified Result — Conditional CTA (Green/Yellow/Red) */}
                  {flowStep === 'qualifiedResult' && qualOutcome && (
                    <motion.div
                      key="qualifiedResult"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-4"
                    >
                      {/* GREEN */}
                      {qualOutcome.color === 'green' && (
                        <div className="text-center space-y-4">
                          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                            <CheckCircle2 className="w-8 h-8 text-green-600" />
                          </div>
                          <h3 className="text-xl font-bold text-green-700">
                            {language === "fr" ? "Excellent potentiel solaire!" : "Excellent solar potential!"}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {language === "fr"
                              ? "Votre bâtiment a toutes les conditions réunies pour un projet solaire rentable."
                              : "Your building meets all conditions for a profitable solar project."}
                          </p>
                          <a
                            href={import.meta.env.VITE_CALENDLY_URL || 'https://calendly.com/kwh-quebec/decouverte'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white font-semibold transition-opacity hover:opacity-90 bg-green-600"
                          >
                            <Calendar className="w-4 h-4" />
                            {language === "fr" ? "Réserver mon appel découverte (10 min) →" : "Book my discovery call (10 min) →"}
                          </a>
                          <button onClick={handleDetailedPath} className="block w-full text-sm text-primary hover:underline">
                            {language === "fr" ? "Ou voir mon analyse complète" : "Or view my complete analysis"}
                          </button>
                        </div>
                      )}

                      {/* YELLOW */}
                      {qualOutcome.color === 'yellow' && (
                        <div className="text-center space-y-4">
                          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
                            <Info className="w-8 h-8 text-amber-600" />
                          </div>
                          <h3 className="text-xl font-bold text-amber-700">
                            {language === "fr" ? "Bon potentiel — quelques points à clarifier" : "Good potential — a few points to clarify"}
                          </h3>
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-left space-y-1">
                            {qualOutcome.blockers.map((b, i) => (
                              <p key={i} className="text-sm text-amber-900">• {language === "fr" ? b.messageFr : b.messageEn}</p>
                            ))}
                          </div>
                          <a
                            href={import.meta.env.VITE_CALENDLY_URL || 'https://calendly.com/kwh-quebec/decouverte'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white font-semibold transition-opacity hover:opacity-90"
                            style={{ backgroundColor: '#003DA6' }}
                          >
                            <Calendar className="w-4 h-4" />
                            {language === "fr" ? "Réserver mon appel découverte (10 min) →" : "Book my discovery call (10 min) →"}
                          </a>
                          <p className="text-xs text-muted-foreground">
                            {language === "fr"
                              ? "Nos experts vous aideront à résoudre ces points"
                              : "Our experts will help resolve these points"}
                          </p>
                          <button onClick={handleDetailedPath} className="block w-full text-sm text-primary hover:underline">
                            {language === "fr" ? "Ou voir mon analyse complète" : "Or view my complete analysis"}
                          </button>
                        </div>
                      )}

                      {/* RED */}
                      {qualOutcome.color === 'red' && (
                        <div className="text-center space-y-4">
                          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                            <Info className="w-8 h-8 text-slate-500" />
                          </div>
                          <h3 className="text-lg font-bold">
                            {language === "fr"
                              ? "Le solaire n'est pas optimal pour vous en ce moment"
                              : "Solar isn't optimal for you right now"}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {language === "fr"
                              ? "Mais voici ce qui pourrait changer la donne:"
                              : "But here's what could change that:"}
                          </p>
                          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-left space-y-3">
                            {qualOutcome.blockers.map((b, i) => (
                              <div key={i} className="text-sm">
                                <p className="font-semibold text-slate-800">• {language === "fr" ? b.messageFr : b.messageEn}</p>
                                <p className="text-slate-600 ml-4 text-xs italic">
                                  {language === "fr" ? "→ " : "→ "}{language === "fr" ? b.actionFr : b.actionEn}
                                </p>
                              </div>
                            ))}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {language === "fr"
                              ? "Quand ces points seront réglés, n'hésitez pas à nous recontacter."
                              : "When these points are resolved, don't hesitate to reach out again."}
                          </p>
                          <Button
                            variant="outline"
                            onClick={() => {
                              toast({
                                title: language === "fr" ? "Merci!" : "Thank you!",
                                description: language === "fr"
                                  ? "Vous recevrez nos conseils et mises à jour par courriel."
                                  : "You'll receive our tips and updates by email.",
                              });
                            }}
                            className="gap-2"
                          >
                            <Mail className="w-4 h-4" />
                            {language === "fr" ? "Restez informé — recevez nos conseils" : "Stay informed — get our tips"}
                          </Button>
                          <button onClick={resetFlow} className="w-full text-sm text-muted-foreground hover:underline">
                            {language === "fr" ? "Nouvelle analyse" : "New analysis"}
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* Manual entry */}
                  {flowStep === 'manualEntry' && (
                    <motion.div
                      key="manualEntry"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-4"
                    >
                      <div className="text-center space-y-1">
                        <h3 className="text-lg font-semibold">
                          {language === "fr" ? "Entrez votre consommation" : "Enter your consumption"}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {language === "fr" 
                            ? "Trouvez cette info sur votre facture Hydro-Québec" 
                            : "Find this on your Hydro-Québec bill"}
                        </p>
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm text-muted-foreground">
                            {language === "fr" ? "Consommation annuelle (kWh)" : "Annual consumption (kWh)"}
                          </label>
                          <Input
                            type="number"
                            placeholder="ex: 150000"
                            value={manualKwh}
                            onChange={(e) => setManualKwh(e.target.value)}
                            className="text-center text-lg"
                            data-testid="input-manual-kwh"
                          />
                        </div>
                        <Input
                          type="email"
                          placeholder={language === "fr" ? "votre@courriel.com" : "your@email.com"}
                          value={quickEmail}
                          onChange={(e) => setQuickEmail(e.target.value)}
                          className="text-center"
                          data-testid="input-manual-email"
                        />
                        <Button 
                          onClick={handleQuickAnalysis}
                          disabled={quickAnalysisMutation.isPending || !manualKwh}
                          className="w-full gap-2"
                          data-testid="button-submit-manual"
                        >
                          {quickAnalysisMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <ArrowRight className="w-4 h-4" />
                          )}
                          {language === "fr" ? "Obtenir mon estimation" : "Get my estimate"}
                        </Button>
                      </div>
                      
                      <div className="text-center">
                        <button onClick={() => setFlowStep('upload')} className="text-sm text-muted-foreground hover:underline">
                          ← {language === "fr" ? "Téléverser une facture" : "Upload a bill"}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
            
            {/* Trust badges below card */}
            <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-primary" />
                <span>{language === "fr" ? "Données sécurisées" : "Secure data"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Award className="w-4 h-4 text-primary" />
                <span>{language === "fr" ? "20+ ans d'expérience" : "20+ years experience"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                <span>{language === "fr" ? "100% gratuit" : "100% free"}</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ========== FULL PROCESS SECTION ========== */}
      <section id="process" className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">
              {language === "fr" ? "Votre parcours simplifié" : "Your Simplified Journey"}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {language === "fr"
                ? "De l'analyse gratuite à la production d'énergie — en 5 étapes claires"
                : "From free analysis to energy production — in 5 clear steps"
              }
            </p>
          </motion.div>

          {/* Process Timeline - 3-column grid: left content | center line+numbers | right content */}
          <div>
            {(() => {
              const timeline = getTimeline(language === "fr" ? "fr" : "en");
              const stepIcons = [BarChart3, FileText, HardHat, ClipboardCheck, Zap];

              const stepColors = [
                "rgba(0,61,166,0.40)",
                "rgba(0,61,166,0.55)",
                "rgba(0,61,166,0.70)",
                "rgba(0,61,166,0.85)",
                BRAND.primaryBlue,
              ];

              const phases = [
                { key: "discovery", labelFr: "Découverte", labelEn: "Discovery", descFr: "Gratuit, sans engagement", descEn: "Free, no commitment", steps: [0, 1] },
                { key: "design", labelFr: "Conception", labelEn: "Design", descFr: "Mandat préliminaire", descEn: "Preliminary mandate", steps: [2] },
                { key: "execution", labelFr: "Réalisation", labelEn: "Execution", descFr: "Clé en main", descEn: "Turnkey", steps: [3, 4] },
              ];

              const allRows: Array<{ type: "phase"; phase: typeof phases[0]; pi: number } | { type: "step"; si: number }> = [];
              phases.forEach((phase, pi) => {
                allRows.push({ type: "phase", phase, pi });
                phase.steps.forEach((si) => allRows.push({ type: "step", si }));
              });

              return (
                <div className="flex flex-col items-stretch">
                  {allRows.map((row, ri) => {
                    if (row.type === "phase") {
                      const { phase, pi } = row;
                      return (
                        <motion.div
                          key={`phase-${phase.key}`}
                          initial={{ opacity: 0, y: 10 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                        >
                          {/* Desktop: 3 columns with phase label spanning full width above */}
                          <div className="hidden md:grid md:grid-cols-[1fr_48px_1fr] gap-0">
                            <div />
                            <div className="flex justify-center">
                              <div
                                className="w-[2px] h-6"
                                style={{ backgroundColor: BRAND.primaryBlue, opacity: pi === 0 ? 0 : 0.15 }}
                              />
                            </div>
                            <div />
                          </div>
                          <div className="flex items-center justify-center gap-3 py-2">
                            <div className="hidden md:block h-[1px] w-12" style={{ backgroundColor: BRAND.accentGold, opacity: 0.4 }} />
                            <span
                              className="text-xs font-bold uppercase tracking-widest"
                              style={{ color: BRAND.accentGold }}
                              data-testid={`text-phase-${phase.key}`}
                            >
                              {language === "fr" ? phase.labelFr : phase.labelEn}
                              <span className="text-muted-foreground font-normal normal-case tracking-normal ml-2">
                                — {language === "fr" ? phase.descFr : phase.descEn}
                              </span>
                            </span>
                            {pi === 0 && (
                              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs no-default-hover-elevate no-default-active-elevate" data-testid="badge-free">
                                {language === "fr" ? "GRATUIT" : "FREE"}
                              </Badge>
                            )}
                            <div className="hidden md:block h-[1px] w-12" style={{ backgroundColor: BRAND.accentGold, opacity: 0.4 }} />
                          </div>
                        </motion.div>
                      );
                    }

                    const { si } = row;
                    const tl = timeline[si];
                    const Icon = stepIcons[si] || Zap;
                    const stepNum = si + 1;
                    const isLeft = si % 2 === 0;
                    const isLast = si === 4;
                    const stepColor = stepColors[si] || BRAND.primaryBlue;
                    const stepDisplay = tl.step;

                    const cardContent = (
                      <Card className="w-full">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                              style={{ backgroundColor: stepColor }}
                            >
                              <Icon className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-sm text-foreground">{stepDisplay}</h3>
                              {tl.duration && (
                                <Badge variant="secondary" className="text-xs mt-1.5">
                                  <Clock className="w-3 h-3 mr-1" />
                                  {tl.duration}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );

                    return (
                      <div key={`step-${si}`}>
                        {/* Desktop: 3-column grid */}
                        <div className="hidden md:grid md:grid-cols-[1fr_48px_1fr] gap-0">
                          {/* Left column */}
                          <div className={`flex ${isLeft ? "justify-end pr-6" : ""}`}>
                            {isLeft && (
                              <motion.div
                                initial={{ opacity: 0, x: -30 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.1 }}
                                className="max-w-sm w-full"
                              >
                                {cardContent}
                              </motion.div>
                            )}
                          </div>

                          {/* Center column: line segment + numbered circle + line segment */}
                          <div className="flex flex-col items-center">
                            <div
                              className="w-[2px] flex-1 min-h-[8px]"
                              style={{ backgroundColor: BRAND.primaryBlue, opacity: 0.15 }}
                            />
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm shrink-0 z-10"
                              style={{ backgroundColor: stepColor }}
                              data-testid={`timeline-step-${stepNum}`}
                            >
                              {stepNum}
                            </div>
                            <div
                              className="w-[2px] flex-1 min-h-[8px]"
                              style={{ backgroundColor: BRAND.primaryBlue, opacity: isLast ? 0 : 0.15 }}
                            />
                          </div>

                          {/* Right column */}
                          <div className={`flex ${!isLeft ? "justify-start pl-6" : ""}`}>
                            {!isLeft && (
                              <motion.div
                                initial={{ opacity: 0, x: 30 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.1 }}
                                className="max-w-sm w-full"
                              >
                                {cardContent}
                              </motion.div>
                            )}
                          </div>
                        </div>

                        {/* Mobile: left line + card */}
                        <div className="md:hidden flex gap-3">
                          <div className="flex flex-col items-center w-10 shrink-0">
                            <div
                              className="w-[2px] flex-1 min-h-[4px]"
                              style={{ backgroundColor: BRAND.primaryBlue, opacity: 0.15 }}
                            />
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs shrink-0"
                              style={{ backgroundColor: stepColor }}
                            >
                              {stepNum}
                            </div>
                            <div
                              className="w-[2px] flex-1 min-h-[4px]"
                              style={{ backgroundColor: BRAND.primaryBlue, opacity: isLast ? 0 : 0.15 }}
                            />
                          </div>
                          <motion.div
                            className="flex-1 py-1"
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1 }}
                          >
                            {cardContent}
                          </motion.div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* CTA to start */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mt-16"
          >
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm text-muted-foreground mb-2">
                {language === "fr"
                  ? "Prêt à commencer votre parcours?"
                  : "Ready to start your journey?"}
              </p>
              <a href="#analyse">
                <Button size="lg" className="gap-2" data-testid="button-start-journey">
                  {language === "fr" ? "Commencer mon analyse" : "Start my analysis"}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </a>
            </div>
          </motion.div>
        </div>
      </section>
      {/* ========== FAQ SECTION ========== */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-3xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
              {t("faq.title")}
            </h2>
            <p className="text-lg text-muted-foreground">
              {t("faq.subtitle")}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Accordion
              type="multiple"
              value={expandedFaqItems}
              onValueChange={setExpandedFaqItems}
              className="space-y-3"
            >
              {([
                { id: 1, slug: "calculer-rentabilite-projet-solaire" },
                { id: 2, slug: "incitatifs-solaires-quebec-2026" },
                { id: 3, slug: "guide-solaire-commercial-quebec" },
                { id: 4, slug: "programme-autoproduction-hydro-quebec-2026" },
                { id: 5, slug: "comprendre-facture-hydro-quebec" },
                { id: 6, slug: "solaire-commercial-vs-residentiel" },
                { id: 7, slug: "solaire-valeur-immobiliere-commercial" },
                { id: 8, slug: "etude-de-cas-projet-solaire-industriel" },
              ]).map(({ id: i, slug }) => (
                <AccordionItem
                  key={`item${i}`}
                  value={`item${i}`}
                  className="border border-border rounded-lg px-5 py-2 hover:border-primary/50 transition-colors"
                >
                  <AccordionTrigger className="font-semibold hover:no-underline">
                    <span className="text-left">
                      {t(`faq.item${i}.question`)}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed pt-2">
                    <p>{t(`faq.item${i}.answer`)}</p>
                    <Link href={`/blog/${slug}`}>
                      <span className="inline-flex items-center gap-1 mt-3 text-sm font-medium hover:underline" style={{ color: BRAND.primaryBlue }} data-testid={`link-faq-blog-${i}`}>
                        {language === "fr" ? "En savoir plus" : "Learn more"} <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </Link>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </section>
      {/* ========== WHY SOLAR NOW SECTION ========== */}
      {(() => {
        const whySolarContent = getWhySolarNow(language as "fr" | "en");
        return (
          <section id="why-now" className="py-16 px-4 sm:px-6 lg:px-8" data-testid="section-why-now">
            <div className="max-w-6xl mx-auto">
              <motion.div
                className="text-center mb-12"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <div className="flex items-center justify-center gap-3 mb-4">
                  <Sun className="w-8 h-8" style={{ color: BRAND.accentGold }} />
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold" data-testid="text-why-now-title">
                    {whySolarContent.sectionTitle}
                  </h2>
                </div>
              </motion.div>

              <div className="grid md:grid-cols-2 gap-6 mb-14">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                >
                  <Card className="h-full" data-testid="card-before">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-semibold mb-4 text-muted-foreground" data-testid="text-before-title">
                        {whySolarContent.beforeTitle}
                      </h3>
                      <ul className="space-y-3">
                        {whySolarContent.beforeReasons.map((reason, idx) => (
                          <li key={idx} className="flex items-start gap-3" data-testid={`text-before-reason-${idx}`}>
                            <XCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                            <span className="text-sm text-muted-foreground">{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 }}
                >
                  <Card className="h-full" style={{ borderColor: BRAND.accentGold, borderWidth: '2px' }} data-testid="card-now">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-semibold mb-4" data-testid="text-now-title">
                        {whySolarContent.nowTitle}
                      </h3>
                      <ul className="space-y-3">
                        {whySolarContent.nowReasons.map((reason, idx) => (
                          <li key={idx} className="flex items-start gap-3" data-testid={`text-now-reason-${idx}`}>
                            <CheckCircle2 className="w-5 h-5 text-[#16A34A] mt-0.5 shrink-0" />
                            <span className="text-sm">{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              <motion.div
                className="text-center mb-8"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <div className="flex items-center justify-center gap-3 mb-2">
                  <Snowflake className="w-6 h-6 text-blue-500" />
                  <h3 className="text-xl sm:text-2xl font-bold" data-testid="text-winter-title">
                    {whySolarContent.winterTitle}
                  </h3>
                </div>
                <p className="text-muted-foreground" data-testid="text-winter-subtitle">
                  {whySolarContent.winterSubtitle}
                </p>
              </motion.div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {whySolarContent.winterMyths.map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <Card className="h-full" data-testid={`card-myth-${idx}`}>
                      <CardContent className="p-5 space-y-3 text-center">
                        <div>
                          <Badge variant="destructive" className="mb-2 text-xs" data-testid={`badge-myth-${idx}`}>
                            {language === "fr" ? "Mythe" : "Myth"}
                          </Badge>
                          <p className="text-sm line-through text-muted-foreground" data-testid={`text-myth-${idx}`}>
                            {item.myth}
                          </p>
                        </div>
                        <div>
                          <Badge className="mb-2 text-xs bg-[#16A34A] text-white no-default-hover-elevate no-default-active-elevate" data-testid={`badge-reality-${idx}`}>
                            {language === "fr" ? "Réalité" : "Reality"}
                          </Badge>
                          <p className="text-sm" data-testid={`text-reality-${idx}`}>
                            {item.reality}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        );
      })()}
      {/* ========== CREDIBILITY SECTION (Merged: Values + Team + Testimonials) ========== */}
      <section id="credibility" className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/30" data-testid="section-credibility">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-10"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">
              {language === "fr" ? "Pourquoi kWh Québec?" : "Why kWh Québec?"}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {language === "fr"
                ? "Nous accompagnons les entreprises dans leurs projets d'énergie renouvelable depuis 2011. En tant que Québécois, nous sommes fiers de vous offrir des solutions solaires maintenant rentables ici au Québec."
                : "We've been supporting businesses in renewable energy projects since 2011. As Quebecers, we're proud to offer solar solutions that are now profitable here in Quebec."
              }
            </p>
          </motion.div>

          {/* Core Values */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10"
          >
            <div className="text-center p-4 rounded-xl bg-background border" data-testid="value-simplicity">
              <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-primary/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <h4 className="font-semibold text-sm mb-1">
                {language === "fr" ? "Simplicité" : "Simplicity"}
              </h4>
              <p className="text-xs text-muted-foreground">
                {language === "fr" ? "Un seul interlocuteur de A à Z. Zéro complexité pour vous." : "One point of contact from A to Z. Zero complexity for you."}
              </p>
            </div>

            <div className="text-center p-4 rounded-xl bg-background border" data-testid="value-reliability">
              <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <h4 className="font-semibold text-sm mb-1">
                {language === "fr" ? "Fiabilité" : "Reliability"}
              </h4>
              <p className="text-xs text-muted-foreground">
                {language === "fr" ? "Équipements certifiés, entrepreneur licencié RBQ." : "Certified equipment, RBQ licensed contractor."}
              </p>
            </div>

            <div className="text-center p-4 rounded-xl bg-background border" data-testid="value-longevity">
              <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <h4 className="font-semibold text-sm mb-1">
                {language === "fr" ? "Longévité" : "Longevity"}
              </h4>
              <p className="text-xs text-muted-foreground">
                {language === "fr" ? "Systèmes conçus pour 25+ ans de performance garantie." : "Systems designed for 25+ years of guaranteed performance."}
              </p>
            </div>

            <div className="text-center p-4 rounded-xl bg-background border" data-testid="value-pride">
              <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-primary/10 flex items-center justify-center">
                <Award className="w-5 h-5 text-primary" />
              </div>
              <h4 className="font-semibold text-sm mb-1">
                {language === "fr" ? "Fierté" : "Pride"}
              </h4>
              <p className="text-xs text-muted-foreground">
                {language === "fr" ? "Entreprise québécoise. Contribution à la transition énergétique locale." : "Quebec company. Contributing to the local energy transition."}
              </p>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="grid grid-cols-3 gap-4 mb-10"
          >
            <div className="text-center p-4 sm:p-6 rounded-xl bg-background border" data-testid="strength-experience">
              <p className="text-3xl sm:text-4xl md:text-5xl font-bold text-primary">15+</p>
              <p className="text-sm sm:text-base font-medium mt-1">
                {language === "fr" ? "ans" : "years"}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {language === "fr" ? "d'expérience" : "experience"}
              </p>
            </div>

            <div className="text-center p-4 sm:p-6 rounded-xl bg-background border" data-testid="strength-capacity">
              <p className="text-3xl sm:text-4xl md:text-5xl font-bold text-primary">120</p>
              <p className="text-sm sm:text-base font-medium mt-1">MW</p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {language === "fr" ? "installés" : "installed"}
              </p>
            </div>

            <div className="text-center p-4 sm:p-6 rounded-xl bg-background border" data-testid="strength-projects">
              <p className="text-3xl sm:text-4xl md:text-5xl font-bold text-primary">25+</p>
              <p className="text-sm sm:text-base font-medium mt-1">
                {language === "fr" ? "projets" : "projects"}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {language === "fr" ? "C&I" : "C&I"}
              </p>
            </div>
          </motion.div>

          {/* Team Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-10"
            data-testid="section-team"
          >
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="order-2 md:order-1"
              >
                <div className="relative rounded-xl overflow-hidden shadow-lg">
                  <img
                    src={installationPhoto}
                    alt={language === "fr" ? "Équipe kWh Québec sur un toit" : "kWh Québec team on a rooftop"}
                    className="w-full h-[300px] md:h-[350px] object-cover"
                    data-testid="img-team-photo"
                  />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="order-1 md:order-2 space-y-4"
              >
                <div>
                  <Badge variant="outline" className="mb-3">
                    {language === "fr" ? "Notre équipe" : "Our Team"}
                  </Badge>
                  <h3 className="text-xl sm:text-2xl font-bold mb-3" data-testid="text-team-title">
                    {language === "fr"
                      ? "Des experts dédiés à votre projet"
                      : "Experts dedicated to your project"
                    }
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {language === "fr"
                      ? "Ingénieurs, techniciens certifiés et gestionnaires de projet travaillent ensemble pour assurer le succès de votre installation."
                      : "Engineers, certified technicians, and project managers work together to ensure your solar installation's success."
                    }
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-background border text-sm">
                    <HardHat className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <p className="font-medium text-xs">{language === "fr" ? "Installation" : "Installation"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-2 rounded-lg bg-background border text-sm">
                    <FileCheck className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <p className="font-medium text-xs">{language === "fr" ? "Ingénierie" : "Engineering"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-2 rounded-lg bg-background border text-sm">
                    <ClipboardCheck className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <p className="font-medium text-xs">{language === "fr" ? "Gestion" : "Management"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-2 rounded-lg bg-background border text-sm">
                    <Wrench className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <p className="font-medium text-xs">{language === "fr" ? "Maintenance" : "Maintenance"}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                    <Shield className="w-3 h-3 mr-1" />
                    {language === "fr" ? "Licence RBQ" : "RBQ Licensed"}
                  </Badge>
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                    <Award className="w-3 h-3 mr-1" />
                    {language === "fr" ? "15+ ans" : "15+ yrs"}
                  </Badge>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* Key Benefits Checklist */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-12 py-6 border-y"
          >
            <div className="flex items-center gap-2" data-testid="strength-rbq">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              <span className="text-sm"><span className="font-medium">{language === "fr" ? "RBQ" : "RBQ"}</span></span>
            </div>

            <div className="flex items-center gap-2" data-testid="strength-financing">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              <span className="text-sm"><span className="font-medium">{language === "fr" ? "Financement flexible" : "Flexible financing"}</span></span>
            </div>

            <div className="flex items-center gap-2" data-testid="strength-coverage">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              <span className="text-sm font-medium">{language === "fr" ? "Partout au Québec" : "All Quebec"}</span>
            </div>

            <div className="flex items-center gap-2" data-testid="strength-warranty">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              <span className="text-sm"><span className="font-medium">{language === "fr" ? "Garantie 25 ans" : "25-yr warranty"}</span></span>
            </div>
          </motion.div>

          {/* Select Testimonials (1-2) from Social Proof */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-8"
          >
            <h3 className="text-lg sm:text-xl font-bold mb-6">
              {language === "fr" ? "Ils nous font confiance" : "Client success stories"}
            </h3>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6" data-testid="container-testimonials">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0 }}
            >
              <Card className="p-6 h-full" data-testid="card-testimonial-1">
                <div className="flex flex-col h-full">
                  <div className="flex gap-1 mb-4">
                    {[1,2,3,4,5].map(i => (
                      <Zap key={i} className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    ))}
                  </div>
                  <blockquote className="text-sm text-muted-foreground flex-1 mb-4">
                    "{language === "fr"
                      ? "L'analyse détaillée nous a permis de prendre une décision éclairée. Le retour sur investissement prévu s'est avéré exact à 2% près après la première année d'opération."
                      : "The detailed analysis allowed us to make an informed decision. The projected ROI proved accurate within 2% after the first year."
                    }"
                  </blockquote>
                  <div className="flex items-center gap-3 pt-4 border-t">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">L. Hodgkinson</p>
                      <p className="text-xs text-muted-foreground">Dream Industrial REIT</p>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <Card className="p-6 h-full" data-testid="card-testimonial-2">
                <div className="flex flex-col h-full">
                  <div className="flex gap-1 mb-4">
                    {[1,2,3,4,5].map(i => (
                      <Zap key={i} className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    ))}
                  </div>
                  <blockquote className="text-sm text-muted-foreground flex-1 mb-4">
                    "{language === "fr"
                      ? "Service professionnel du début à la fin. L'équipe a géré toutes les démarches avec Hydro-Québec et nous avons économisé 35% sur notre facture d'électricité dès la première année."
                      : "Professional service from start to finish. The team handled all steps with Hydro-Québec and we saved 35% on our electricity bill in the first year."
                    }"
                  </blockquote>
                  <div className="flex items-center gap-3 pt-4 border-t">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{language === "fr" ? "Propriétaire" : "Owner"}</p>
                      <p className="text-xs text-muted-foreground">{language === "fr" ? "Centre de distribution" : "Distribution center"}</p>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>
      {/* ========== CONTACT SECTION (Merged: Expert + Final Contact) ========== */}
      <section id="contact" className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-primary/5 to-primary/10" data-testid="section-contact">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            {/* Header */}
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Phone className="w-8 h-8 text-primary" />
                <h2 className="text-3xl sm:text-4xl font-bold" data-testid="contact-title">
                  {language === "fr" ? "Contactez-nous" : "Contact us"}
                </h2>
              </div>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                {language === "fr"
                  ? "Réservez une consultation gratuite avec nos experts ou contactez-nous directement"
                  : "Book a free consultation with our experts or contact us directly"
                }
              </p>
            </div>

            {/* Calendly / Consultation Section */}
            {import.meta.env.VITE_CALENDLY_URL ? (
              <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg p-6 min-h-[600px]">
                <iframe
                  src={import.meta.env.VITE_CALENDLY_URL}
                  width="100%"
                  height="650"
                  frameBorder="0"
                  title="Book a consultation"
                  data-testid="calendly-embed"
                />
              </div>
            ) : (
              <Card className="p-8 text-center space-y-4">
                <Phone className="w-12 h-12 text-primary mx-auto opacity-50" />
                <p className="text-muted-foreground">{t("expert.calendlyPlaceholder")}</p>
                <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-xs mb-2">
                  {language === "fr" ? "SANS FRAIS · Sans engagement" : "NO COST · No commitment"}
                </Badge>
              </Card>
            )}

            {/* Direct Contact Options */}
            <div className="border-t pt-8">
              <p className="text-center text-sm font-medium mb-6">
                {language === "fr"
                  ? "Ou contactez-nous directement:"
                  : "Or reach us directly:"
                }
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a href="mailto:info@kwh.quebec">
                  <Button variant="outline" size="lg" className="gap-2" data-testid="button-email-contact">
                    <Mail className="w-4 h-4" />
                    info@kwh.quebec
                  </Button>
                </a>
                <a href="tel:+15144278871">
                  <Button variant="outline" size="lg" className="gap-2" data-testid="button-phone-contact">
                    <Phone className="w-4 h-4" />
                    514.427.8871
                  </Button>
                </a>
              </div>
              <p className="text-center text-xs text-muted-foreground mt-4">
                {language === "fr"
                  ? "Ou retournez à l'analyse gratuite pour commencer immédiatement"
                  : "Or go back to the free analysis to get started now"
                }
              </p>
              <div className="flex justify-center mt-3">
                <a href="#analyse">
                  <Button variant="ghost" className="gap-1 text-primary" data-testid="button-back-to-paths">
                    <ChevronUp className="w-4 h-4" />
                    {language === "fr" ? "Retour aux options d'analyse" : "Back to analysis options"}
                  </Button>
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
      {/* ========== FOOTER ========== */}
      <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <img 
                src={currentLogo} 
                alt="kWh Québec" 
                className="h-8 w-auto"
              />
              <span className="text-sm text-muted-foreground">
                © {new Date().getFullYear()} kWh Québec. {language === "fr" ? "Tous droits réservés." : "All rights reserved."}
              </span>
            </div>
            
            <div className="flex items-center gap-6 text-sm text-muted-foreground flex-wrap">
              <a href="#analyse" className="hover:text-foreground transition-colors">
                {language === "fr" ? "Analyser" : "Analyze"}
              </a>
              <Link href="/ressources" className="hover:text-foreground transition-colors">
                {language === "fr" ? "Ressources" : "Resources"}
              </Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors" data-testid="link-privacy">
                {language === "fr" ? "Confidentialité" : "Privacy"}
              </Link>
              <a href="mailto:info@kwh.quebec" className="hover:text-foreground transition-colors">
                {t("footer.contact")}
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

