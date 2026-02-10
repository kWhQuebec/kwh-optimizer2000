import { useState, useEffect, useCallback } from "react";
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
  Rocket, BatteryCharging, BadgePercent, MapPin,
  Sun, Battery, FileText, Hammer, Loader2, FileCheck, ClipboardCheck, ChevronUp,
  Phone, Mail, Building, CalendarDays, User, Info, Upload, Sparkles, FileSignature,
  Snowflake, XCircle
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
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/lib/i18n";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SEOHead, seoContent, getLocalBusinessSchema } from "@/components/seo-head";
import { TIMELINE_GRADIENT, BRAND } from "@shared/colors";
import { getWhySolarNow } from "@shared/brandContent";
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

type FlowStep = 'upload' | 'parsing' | 'extracted' | 'quickForm' | 'quickResult' | 'manualEntry' | 'submitted';

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
  
  
  const currentLogo = language === "fr" ? logoFr : logoEn;
  
  const analysisSlides = language === "fr" 
    ? [
        { id: "impact", image: carouselSlide1Fr, label: "Impact sur votre facture" },
        { id: "config", image: carouselSlide2Fr, label: "Configuration optimale" },
        { id: "evolution", image: carouselSlide3Fr, label: "Évolution sur 25 ans" },
        { id: "financing", image: carouselSlide4Fr, label: "Options de financement" },
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
      setSubmitted(true);
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
      })
      .catch(() => {
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

  return (
    <div className="min-h-screen bg-background">
      <SEOHead 
        title={seo.title} 
        description={seo.description} 
        keywords={seo.keywords}
        structuredData={getLocalBusinessSchema(language)}
        locale={language}
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
                            : "Our tool will automatically fill the form with your data"}
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
                          <p className="text-xs text-muted-foreground">
                            PDF, JPG, PNG • Max 10 Mo
                          </p>
                        </div>
                      </div>
                      
                      {parseError && (
                        <p className="text-sm text-destructive text-center">{parseError}</p>
                      )}
                      
                      {/* Manual entry fallback */}
                      <div className="text-center pt-2">
                        <button
                          onClick={() => setFlowStep('manualEntry')}
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

                  {/* Step 2: Extracted - Show data + two paths */}
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
                      
                      {/* Two path choice */}
                      <div className="space-y-3">
                        <p className="text-center font-medium">
                          {language === "fr" ? "Choisissez votre analyse:" : "Choose your analysis:"}
                        </p>
                        
                        <div className="grid sm:grid-cols-2 gap-3">
                          {/* Quick path */}
                          <button
                            onClick={() => setFlowStep('quickForm')}
                            className="p-4 border-2 rounded-xl text-left hover:border-primary/50 hover:bg-muted/30 transition-all group"
                            data-testid="button-quick-path"
                          >
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                                <Zap className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="font-semibold group-hover:text-primary">
                                  {language === "fr" ? "Estimation rapide" : "Quick Estimate"}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {language === "fr" ? "2 min • Courriel seulement" : "2 min • Email only"}
                                </p>
                              </div>
                            </div>
                          </button>
                          
                          {/* Detailed path */}
                          <button
                            onClick={handleDetailedPath}
                            className="p-4 border-2 border-primary/30 bg-primary/5 rounded-xl text-left hover:border-primary hover:bg-primary/10 transition-all group"
                            data-testid="button-detailed-path"
                          >
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                <FileSignature className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="font-semibold text-primary">
                                  {language === "fr" ? "Analyse complète" : "Complete Analysis"}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {language === "fr" ? "5 jours • Avec procuration" : "5 days • With authorization"}
                                </p>
                              </div>
                            </div>
                          </button>
                        </div>
                      </div>
                      
                      {/* Reset link */}
                      <div className="text-center">
                        <button onClick={resetFlow} className="text-xs text-muted-foreground hover:underline">
                          {language === "fr" ? "← Recommencer" : "← Start over"}
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 3a: Quick form - just email */}
                  {flowStep === 'quickForm' && (
                    <motion.div
                      key="quickForm"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-4"
                    >
                      <div className="text-center space-y-1">
                        <h3 className="text-lg font-semibold">
                          {language === "fr" ? "Recevez votre estimation" : "Get your estimate"}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {language === "fr" 
                            ? "Entrez votre courriel pour recevoir les résultats" 
                            : "Enter your email to receive the results"}
                        </p>
                      </div>
                      
                      <div className="space-y-3">
                        <Input
                          type="email"
                          placeholder={language === "fr" ? "votre@courriel.com" : "your@email.com"}
                          value={quickEmail}
                          onChange={(e) => setQuickEmail(e.target.value)}
                          className="text-center"
                          data-testid="input-quick-email"
                        />
                        
                        {/* Qualification Questions */}
                        <div className="grid grid-cols-2 gap-3">
                          {/* Roof Age */}
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">
                              {language === "fr" ? "Âge de la toiture" : "Roof age"}
                            </label>
                            <Select value={roofAgeYears} onValueChange={setRoofAgeYears}>
                              <SelectTrigger data-testid="select-roof-age">
                                <SelectValue placeholder={language === "fr" ? "Sélectionner..." : "Select..."} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="5">{language === "fr" ? "< 5 ans" : "< 5 years"}</SelectItem>
                                <SelectItem value="10">5-10 {language === "fr" ? "ans" : "years"}</SelectItem>
                                <SelectItem value="15">10-15 {language === "fr" ? "ans" : "years"}</SelectItem>
                                <SelectItem value="20">15-20 {language === "fr" ? "ans" : "years"}</SelectItem>
                                <SelectItem value="25">{language === "fr" ? "> 20 ans" : "> 20 years"}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          {/* Ownership */}
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">
                              {language === "fr" ? "Propriétaire?" : "Owner?"}
                            </label>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant={ownershipType === 'owner' ? 'default' : 'outline'}
                                size="sm"
                                className="flex-1"
                                onClick={() => setOwnershipType('owner')}
                                data-testid="button-owner"
                              >
                                {language === "fr" ? "Oui" : "Yes"}
                              </Button>
                              <Button
                                type="button"
                                variant={ownershipType === 'tenant' ? 'default' : 'outline'}
                                size="sm"
                                className="flex-1"
                                onClick={() => setOwnershipType('tenant')}
                                data-testid="button-tenant"
                              >
                                {language === "fr" ? "Non" : "No"}
                              </Button>
                            </div>
                          </div>
                        </div>
                        
                        <Button 
                          onClick={handleQuickAnalysis}
                          disabled={quickAnalysisMutation.isPending}
                          className="w-full gap-2"
                          data-testid="button-submit-quick"
                        >
                          {quickAnalysisMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <ArrowRight className="w-4 h-4" />
                          )}
                          {language === "fr" ? "Voir mon estimation" : "See my estimate"}
                        </Button>
                      </div>
                      
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <button onClick={() => setFlowStep('extracted')} className="hover:underline">
                          ← {language === "fr" ? "Retour" : "Back"}
                        </button>
                        <button onClick={handleDetailedPath} className="hover:underline text-primary">
                          {language === "fr" ? "Analyse complète →" : "Complete analysis →"}
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 3b: Quick results */}
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
                          {language === "fr" ? "Votre estimation est prête!" : "Your estimate is ready!"}
                        </h3>
                      </div>
                      
                      {quickAnalysisResult.recommendedScenario && (
                        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
                          <p className="text-sm text-muted-foreground text-center">
                            {language === "fr" ? "Configuration recommandée" : "Recommended configuration"}
                          </p>
                          <p className="text-2xl font-bold text-center text-primary">
                            {quickAnalysisResult.recommendedScenario.systemSizeKw?.toFixed(0) || '—'} kWc
                          </p>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="text-center">
                              <p className="text-muted-foreground">{language === "fr" ? "Économies/an" : "Savings/yr"}</p>
                              <p className="font-semibold">${(quickAnalysisResult.recommendedScenario.annualSavings || 0).toLocaleString()}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-muted-foreground">{language === "fr" ? "Retour" : "Payback"}</p>
                              <p className="font-semibold">{quickAnalysisResult.recommendedScenario.simplePaybackYears?.toFixed(1) || '—'} {language === "fr" ? "ans" : "yrs"}</p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <p className="text-sm text-muted-foreground text-center">
                        {language === "fr" 
                          ? "Résultats envoyés à votre courriel" 
                          : "Results sent to your email"}
                      </p>
                      
                      <div className="space-y-2">
                        <Button onClick={handleDetailedPath} className="w-full gap-2" data-testid="button-upgrade-detailed">
                          <FileSignature className="w-4 h-4" />
                          {language === "fr" ? "Obtenir l'analyse complète" : "Get the complete analysis"}
                        </Button>
                        <button onClick={resetFlow} className="w-full text-sm text-muted-foreground hover:underline">
                          {language === "fr" ? "Nouvelle analyse" : "New analysis"}
                        </button>
                      </div>
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
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">
              {language === "fr" ? "Le solaire simplifié pour votre entreprise" : "Streamlined solar for your business"}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {language === "fr" 
                ? "De l'analyse initiale à l'opération de votre système, nous vous accompagnons à chaque étape"
                : "From initial analysis to system operation, we support you every step of the way"
              }
            </p>
          </motion.div>
          
          {/* Process Timeline */}
          <div className="relative">
            {/* Connection line - centered between icons and duration badges */}
            <div className="hidden md:block absolute top-[68px] left-0 right-0 h-0.5 bg-border z-0" />
            
            <div className="grid md:grid-cols-4 gap-6 relative z-10">
              {/* Step 1: Detailed Analysis */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0 }}
                className="text-center"
                data-testid="process-step-1"
              >
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: TIMELINE_GRADIENT.getStepHex(0, 4) }}>
                    <BarChart3 className="w-6 h-6" style={{ color: TIMELINE_GRADIENT.getStepTextColor(0, 4) }} />
                  </div>
                  <Badge className="mb-3" style={{ backgroundColor: `${TIMELINE_GRADIENT.getStepHex(0, 4)}20`, color: TIMELINE_GRADIENT.getStepHex(0, 4), borderColor: `${TIMELINE_GRADIENT.getStepHex(0, 4)}33` }}>
                    5 {language === "fr" ? "jours" : "days"}
                  </Badge>
                  <h3 className="font-semibold text-sm mb-1">
                    {language === "fr" ? "Analyse DÉTAILLÉE" : "Detailed Analysis"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {language === "fr" 
                      ? "Analyse horaire complète, rapport détaillé"
                      : "Complete hourly analysis, detailed report"
                    }
                  </p>
                </div>
              </motion.div>
              
              {/* Step 2: Design */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="text-center"
                data-testid="process-step-2"
              >
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: TIMELINE_GRADIENT.getStepHex(1, 4) }}>
                    <FileText className="w-6 h-6" style={{ color: TIMELINE_GRADIENT.getStepTextColor(1, 4) }} />
                  </div>
                  <Badge className="mb-3" style={{ backgroundColor: `${TIMELINE_GRADIENT.getStepHex(1, 4)}20`, color: TIMELINE_GRADIENT.getStepHex(1, 4), borderColor: `${TIMELINE_GRADIENT.getStepHex(1, 4)}33` }}>
                    10-16 {language === "fr" ? "sem." : "wks"}
                  </Badge>
                  <h3 className="font-semibold text-sm mb-1">
                    {language === "fr" ? "Conception & Planification" : "Design & Planning"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {language === "fr" 
                      ? "Ingénierie, permis, approvisionnement"
                      : "Engineering, permits, procurement"
                    }
                  </p>
                </div>
              </motion.div>
              
              {/* Step 3: Construction */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="text-center"
                data-testid="process-step-3"
              >
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: TIMELINE_GRADIENT.getStepHex(2, 4) }}>
                    <HardHat className="w-6 h-6" style={{ color: TIMELINE_GRADIENT.getStepTextColor(2, 4) }} />
                  </div>
                  <Badge className="mb-3" style={{ backgroundColor: `${TIMELINE_GRADIENT.getStepHex(2, 4)}20`, color: TIMELINE_GRADIENT.getStepHex(2, 4), borderColor: `${TIMELINE_GRADIENT.getStepHex(2, 4)}33` }}>
                    3-6 {language === "fr" ? "sem." : "wks"}
                  </Badge>
                  <h3 className="font-semibold text-sm mb-1">
                    {language === "fr" ? "Construction" : "Construction"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {language === "fr" 
                      ? "Installation clé en main"
                      : "Turnkey installation"
                    }
                  </p>
                </div>
              </motion.div>
              
              {/* Step 4: O&M */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="text-center"
                data-testid="process-step-4"
              >
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: TIMELINE_GRADIENT.getStepHex(3, 4) }}>
                    <Wrench className="w-6 h-6" style={{ color: TIMELINE_GRADIENT.getStepTextColor(3, 4) }} />
                  </div>
                  <Badge className="mb-3" style={{ backgroundColor: `${TIMELINE_GRADIENT.getStepHex(3, 4)}20`, color: TIMELINE_GRADIENT.getStepHex(3, 4), borderColor: `${TIMELINE_GRADIENT.getStepHex(3, 4)}33` }}>
                    25+ {language === "fr" ? "ans" : "yrs"}
                  </Badge>
                  <h3 className="font-semibold text-sm mb-1">
                    {language === "fr" ? "Opération & Maintenance" : "Operations & Maintenance"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {language === "fr" 
                      ? "Monitoring, support continu"
                      : "Monitoring, ongoing support"
                    }
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
          
          {/* CTA to start */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mt-10"
          >
            <a href="#paths">
              <Button size="lg" className="gap-2" data-testid="button-start-journey">
                {language === "fr" ? "Commencer mon analyse" : "Start my analysis"}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </a>
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
      {/* ========== CREDIBILITY SECTION ========== */}
      <section id="credibility" className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/30">
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
                {language === "fr" ? "Solution clé en main, on s'occupe de tout" : "Turnkey solution, we handle everything"}
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
                {language === "fr" ? "Performance garantie, on respecte nos engagements" : "Guaranteed performance, we keep our commitments"}
              </p>
            </div>
            
            <div className="text-center p-4 rounded-xl bg-background border" data-testid="value-sustainability">
              <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <h4 className="font-semibold text-sm mb-1">
                {language === "fr" ? "Pérennité" : "Sustainability"}
              </h4>
              <p className="text-xs text-muted-foreground">
                {language === "fr" ? "Relations et solutions pour le long terme" : "Long-term relationships and solutions"}
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
                {language === "fr" ? "Fiers de nos projets et de leur impact" : "Proud of our projects and their impact"}
              </p>
            </div>
          </motion.div>
          
          {/* Stats - Full width like core values */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="grid grid-cols-3 gap-4 mb-8"
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
          
          {/* Checklist Benefits - Centered */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-wrap justify-center gap-x-8 gap-y-3"
          >
            <div className="flex items-center gap-2" data-testid="strength-rbq">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              <span className="text-sm">
                <span className="font-medium">{language === "fr" ? "Licence RBQ" : "RBQ License"}</span>
                <span className="text-muted-foreground"> — {language === "fr" ? "Entrepreneur général" : "General contractor"}</span>
              </span>
            </div>
            
            <div className="flex items-center gap-2" data-testid="strength-financing">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              <span className="text-sm">
                <span className="font-medium">{language === "fr" ? "Financement flexible" : "Flexible financing"}</span>
                <span className="text-muted-foreground"> — {language === "fr" ? "Options disponibles" : "Options available"}</span>
              </span>
            </div>
            
            <div className="flex items-center gap-2" data-testid="strength-coverage">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              <span className="text-sm font-medium">{language === "fr" ? "Service partout au Québec" : "Service across Quebec"}</span>
            </div>
            
            <div className="flex items-center gap-2" data-testid="strength-warranty">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              <span className="text-sm">
                <span className="font-medium">{language === "fr" ? "Garantie 25 ans" : "25-year warranty"}</span>
                <span className="text-muted-foreground"> — {language === "fr" ? "Performance garantie" : "Performance guaranteed"}</span>
              </span>
            </div>
          </motion.div>
        </div>
      </section>
      {/* ========== TEAM SECTION ========== */}
      <section id="team" className="py-16 px-4 sm:px-6 lg:px-8" data-testid="section-team">
        <div className="max-w-6xl mx-auto">
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
                  className="w-full h-[300px] md:h-[400px] object-cover"
                  data-testid="img-team-photo"
                />
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="order-1 md:order-2 space-y-6"
            >
              <div>
                <Badge variant="outline" className="mb-3">
                  {language === "fr" ? "Notre équipe" : "Our Team"}
                </Badge>
                <h2 className="text-2xl sm:text-3xl font-bold mb-4" data-testid="text-team-title">
                  {language === "fr" 
                    ? "Des experts dédiés à votre projet"
                    : "Experts dedicated to your project"
                  }
                </h2>
                <p className="text-muted-foreground mb-6">
                  {language === "fr" 
                    ? "De la première analyse jusqu'à la mise en service et au-delà, notre équipe multidisciplinaire s'occupe de tout. Ingénieurs, techniciens certifiés et gestionnaires de projet travaillent ensemble pour assurer le succès de votre installation solaire."
                    : "From the initial analysis to commissioning and beyond, our multidisciplinary team handles everything. Engineers, certified technicians, and project managers work together to ensure the success of your solar installation."
                  }
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <HardHat className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {language === "fr" ? "Installation" : "Installation"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {language === "fr" ? "Techniciens certifiés" : "Certified technicians"}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <FileCheck className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {language === "fr" ? "Ingénierie" : "Engineering"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {language === "fr" ? "Plans et calculs" : "Plans & calculations"}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <ClipboardCheck className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {language === "fr" ? "Gestion" : "Management"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {language === "fr" ? "Suivi de projet" : "Project tracking"}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Wrench className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {language === "fr" ? "Maintenance" : "Maintenance"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {language === "fr" ? "Support 25 ans" : "25-year support"}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2 pt-2">
                <Badge className="bg-primary/10 text-primary border-primary/20">
                  <Shield className="w-3 h-3 mr-1" />
                  {language === "fr" ? "Licence RBQ" : "RBQ Licensed"}
                </Badge>
                <Badge className="bg-primary/10 text-primary border-primary/20">
                  <Award className="w-3 h-3 mr-1" />
                  {language === "fr" ? "15+ ans d'expérience" : "15+ years experience"}
                </Badge>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
      {/* ========== SOCIAL PROOF SECTION ========== */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/30" data-testid="section-social-proof">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl sm:text-3xl font-bold mb-3" data-testid="text-social-proof-title">
              {language === "fr" ? "Ils nous font confiance" : "They trust us"}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {language === "fr" 
                ? "Des entreprises québécoises de toutes tailles font confiance à notre expertise"
                : "Quebec businesses of all sizes trust our expertise"
              }
            </p>
          </motion.div>
          
          {/* Client Logos */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-wrap items-center justify-center gap-12 mb-16"
          >
            <img 
              src={dreamIndustrialLogo} 
              alt="Dream Industrial REIT" 
              className="h-20 object-contain"
              data-testid="logo-dream-industrial"
            />
            <img 
              src={labSpaceLogo} 
              alt="Lab.Space Construction" 
              className="h-10 object-contain dark:invert"
              data-testid="logo-labspace"
            />
            <img 
              src={scaleCleantechLogo} 
              alt="Scale Cleantech" 
              className="h-10 object-contain"
              data-testid="logo-scale-cleantech"
            />
          </motion.div>
          
          {/* Testimonials */}
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
                  <blockquote className="text-muted-foreground flex-1 mb-4">
                    "{language === "fr" 
                      ? "L'analyse détaillée nous a permis de prendre une décision éclairée. Le retour sur investissement prévu s'est avéré exact à 2% près après la première année d'opération."
                      : "The detailed analysis allowed us to make an informed decision. The projected ROI proved accurate within 2% after the first year of operation."
                    }"
                  </blockquote>
                  <div className="flex items-center gap-3 pt-4 border-t">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{language === "fr" ? "Directeur des opérations" : "Operations Director"}</p>
                      <p className="text-xs text-muted-foreground">{language === "fr" ? "Entreprise manufacturière, Montréal" : "Manufacturing company, Montreal"}</p>
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
                  <blockquote className="text-muted-foreground flex-1 mb-4">
                    "{language === "fr" 
                      ? "Service professionnel du début à la fin. L'équipe a géré toutes les démarches avec Hydro-Québec et nous avons économisé 35% sur notre facture d'électricité dès la première année."
                      : "Professional service from start to finish. The team handled all the steps with Hydro-Québec and we saved 35% on our electricity bill in the first year."
                    }"
                  </blockquote>
                  <div className="flex items-center gap-3 pt-4 border-t">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{language === "fr" ? "Propriétaire" : "Owner"}</p>
                      <p className="text-xs text-muted-foreground">{language === "fr" ? "Centre de distribution, Québec" : "Distribution center, Quebec City"}</p>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>
      {/* ========== FINAL CTA / CONTACT SECTION ========== */}
      <section id="contact" className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Card className="p-8 text-center space-y-6 border-0 shadow-none">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Phone className="w-8 h-8 text-primary" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-2xl sm:text-3xl font-bold">
                  {language === "fr" ? "Prêt à passer au solaire?" : "Ready to go solar?"}
                </h2>
                <p className="text-muted-foreground max-w-lg mx-auto">
                  {language === "fr" 
                    ? "Contactez-nous pour discuter de votre projet ou demandez une analyse directement ci-dessus."
                    : "Contact us to discuss your project or request an analysis directly above."
                  }
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a href="mailto:info@kwhquebec.com">
                  <Button variant="outline" size="lg" className="gap-2" data-testid="button-email-contact">
                    <Mail className="w-4 h-4" />
                    info@kwhquebec.com
                  </Button>
                </a>
                <a href="tel:+15145551234">
                  <Button variant="outline" size="lg" className="gap-2" data-testid="button-phone-contact">
                    <Phone className="w-4 h-4" />
                    (514) 555-1234
                  </Button>
                </a>
              </div>
              
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  {language === "fr" 
                    ? "Ou utilisez les options d'analyse ci-dessus pour commencer immédiatement"
                    : "Or use the analysis options above to get started immediately"
                  }
                </p>
                <a href="#paths">
                  <Button variant="ghost" className="gap-1 text-primary" data-testid="button-back-to-paths">
                    <ChevronUp className="w-4 h-4" />
                    {language === "fr" ? "Retour aux options d'analyse" : "Back to analysis options"}
                  </Button>
                </a>
              </div>
            </Card>
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
              <a href="#paths" className="hover:text-foreground transition-colors">
                {language === "fr" ? "Analyser" : "Analyze"}
              </a>
              <Link href="/ressources" className="hover:text-foreground transition-colors">
                {language === "fr" ? "Ressources" : "Resources"}
              </Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors" data-testid="link-privacy">
                {language === "fr" ? "Confidentialité" : "Privacy"}
              </Link>
              <a href="mailto:info@kwhquebec.com" className="hover:text-foreground transition-colors">
                {t("footer.contact")}
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
