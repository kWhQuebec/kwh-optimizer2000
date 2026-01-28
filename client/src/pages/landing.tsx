import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FileBarChart, Building2, Factory, School, HelpCircle, 
  CheckCircle2, ArrowRight, BarChart3, Zap, Clock, DollarSign,
  TrendingUp, Shield, Award, Target, FileSignature, Wrench, HardHat,
  Timer, Rocket, BatteryCharging, BadgePercent, Calculator, MapPin,
  Sun, Battery, FileText, Hammer, Loader2, FileCheck, ChevronDown, ChevronUp,
  ClipboardCheck, Phone, Mail, Building, CalendarDays, User, Upload, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/lib/i18n";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SEOHead, seoContent, getLocalBusinessSchema } from "@/components/seo-head";
import logoFr from "@assets/kWh_Quebec_Logo-01_-_Rectangulaire_1764799021536.png";
import logoEn from "@assets/kWh_Quebec_Logo-02_-_Rectangle_1764799021536.png";
import installationPhoto from "@assets/dynamic-teamwork-solar-energy-diverse-technicians-installing-p_1764967501352.jpg";
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
import hqBillUploadIllustration from "@assets/generated_images/hq_bill_upload_illustration.png";
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

export default function LandingPage() {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  
  // Pathway states
  const [quickPathExpanded, setQuickPathExpanded] = useState(false);
  const [detailedPathExpanded, setDetailedPathExpanded] = useState(false);
  
  // Refs for scroll-to-section functionality
  const quickPathRef = useRef<HTMLDivElement>(null);
  const detailedPathRef = useRef<HTMLDivElement>(null);
  
  // Quick calculator states
  const [calcInputMode, setCalcInputMode] = useState<"upload" | "manual">("upload");
  const [calcBill, setCalcBill] = useState<string>("");
  const [calcAnnualConsumption, setCalcAnnualConsumption] = useState<string>("");
  const [calcAddress, setCalcAddress] = useState<string>("");
  const [calcEmail, setCalcEmail] = useState<string>("");
  const [calcClientName, setCalcClientName] = useState<string>("");
  const [calcBuildingType, setCalcBuildingType] = useState<string>("office");
  const [calcTariff, setCalcTariff] = useState<string>("M");
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcBillFile, setCalcBillFile] = useState<File | null>(null);
  const [calcBillParsing, setCalcBillParsing] = useState(false);
  const [calcBillParsed, setCalcBillParsed] = useState<{
    annualConsumptionKwh?: number;
    accountNumber?: string;
    tariffCode?: string;
    serviceAddress?: string;
    clientName?: string;
  } | null>(null);
  const [calcResults, setCalcResults] = useState<{
    success: boolean;
    inputs: { address: string | null; monthlyBill: number; annualConsumptionKwh: number; buildingType: string; tariffCode: string };
    system: { sizeKW: number; annualProductionKWh: number };
    scenarios: Array<{
      key: string;
      offsetPercent: number;
      recommended: boolean;
      systemSizeKW: number;
      annualProductionKWh: number;
      annualSavings: number;
      grossCAPEX: number;
      hqIncentive: number;
      federalITC: number;
      totalIncentives: number;
      netCAPEX: number;
      paybackYears: number;
    }>;
    financial: { annualSavings: number; paybackYears: number; hqIncentive: number; federalITC: number; totalIncentives: number; netCAPEX: number; grossCAPEX: number };
    billing: { monthlyBillBefore: number; monthlyBillAfter: number; monthlySavings: number; annualBillBefore?: number; annualBillAfter?: number; annualSavings?: number };
    consumption: { annualKWh: number; monthlyKWh: number };
    storage?: {
      recommended: boolean;
      reason: string;
      batteryPowerKW: number;
      batteryEnergyKWh: number;
      estimatedCost: number;
      estimatedAnnualSavings: number;
      paybackYears: number;
      tariffHasDemandCharges: boolean;
    };
  } | null>(null);
  const [calcError, setCalcError] = useState<string>("");
  const billFileInputRef = useRef<HTMLInputElement>(null);
  
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
  
  // Building type labels
  const buildingTypeLabels = language === "fr" 
    ? { office: "Bureau", warehouse: "Entrepôt", retail: "Commerce", industrial: "Industriel", healthcare: "Santé", education: "Éducation" }
    : { office: "Office", warehouse: "Warehouse", retail: "Retail", industrial: "Industrial", healthcare: "Healthcare", education: "Education" };
  
  // Tariff labels
  const tariffLabels = language === "fr"
    ? { G: "G - Petite puissance (<65 kW)", M: "M - Moyenne puissance", L: "L - Grande puissance" }
    : { G: "G - Small power (<65 kW)", M: "M - Medium power", L: "L - Large power" };
  
  // Email validation helper
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };
  
  // Handle bill file upload and parsing
  const handleBillUpload = async (file: File) => {
    setCalcBillFile(file);
    setCalcBillParsing(true);
    setCalcBillParsed(null);
    setCalcError("");
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetch("/api/parse-hq-bill", {
        method: "POST",
        body: formData,
      });
      
      const result = await response.json();
      
      if (result.success && result.data) {
        setCalcBillParsed(result.data);
        if (result.data.annualConsumptionKwh) {
          setCalcAnnualConsumption(result.data.annualConsumptionKwh.toString());
        }
        if (result.data.tariffCode) {
          setCalcTariff(result.data.tariffCode);
        }
        if (result.data.serviceAddress) {
          setCalcAddress(result.data.serviceAddress);
        }
        if (result.data.clientName) {
          setCalcClientName(result.data.clientName);
        }
        toast({
          title: language === "fr" ? "Facture analysée!" : "Bill analyzed!",
          description: language === "fr" 
            ? `Consommation: ${result.data.annualConsumptionKwh?.toLocaleString() || "N/A"} kWh/an` 
            : `Consumption: ${result.data.annualConsumptionKwh?.toLocaleString() || "N/A"} kWh/yr`,
        });
      } else {
        setCalcError(language === "fr" 
          ? "Impossible d'extraire les données de la facture. Essayez l'entrée manuelle." 
          : "Could not extract data from bill. Try manual entry.");
      }
    } catch (err) {
      setCalcError(language === "fr" ? "Erreur lors de l'analyse de la facture" : "Error parsing bill");
    } finally {
      setCalcBillParsing(false);
    }
  };
  
  // Quick estimate function
  const handleQuickEstimate = async () => {
    if (!calcEmail.trim() || !isValidEmail(calcEmail)) {
      setCalcError(language === "fr" ? "Veuillez entrer un courriel valide" : "Please enter a valid email");
      return;
    }
    
    const annualConsumption = parseInt(calcAnnualConsumption, 10);
    const billAmount = parseInt(calcBill, 10);
    
    // Need either annual consumption or monthly bill
    if ((!annualConsumption || annualConsumption < 10000) && (!billAmount || billAmount < 200)) {
      setCalcError(language === "fr" 
        ? "Veuillez entrer une consommation annuelle (min 10,000 kWh) ou une facture mensuelle (min 200$)" 
        : "Please enter annual consumption (min 10,000 kWh) or monthly bill (min $200)");
      return;
    }
    
    setCalcLoading(true);
    setCalcError("");
    setCalcResults(null);
    
    try {
      const response = await fetch("/api/quick-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: calcAddress || null,
          email: calcEmail,
          clientName: calcClientName || null,
          monthlyBill: billAmount || null,
          annualConsumptionKwh: annualConsumption || null,
          buildingType: calcBuildingType,
          tariffCode: calcTariff,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setCalcResults(data);
        if (data.emailSent) {
          toast({
            title: language === "fr" ? "Rapport envoyé!" : "Report sent!",
            description: language === "fr" ? "Votre analyse a été envoyée par courriel." : "Your analysis has been sent by email.",
          });
        }
      } else {
        setCalcError(data.error || (language === "fr" ? "Erreur lors de l'analyse" : "Analysis error"));
      }
    } catch (err) {
      setCalcError(language === "fr" ? "Erreur de connexion" : "Connection error");
    } finally {
      setCalcLoading(false);
    }
  };
  
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
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b">
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

      {/* ========== HERO SECTION - SPLIT LAYOUT ========== */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />
        <div className="absolute top-20 right-0 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl opacity-50" />
        
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-5 gap-6 lg:gap-10 items-center">
            {/* Left: Text content - narrower */}
            <motion.div 
              className="lg:col-span-2 space-y-4 text-center lg:text-left"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="space-y-1">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl tracking-tight leading-[1.15]">
                  <span className="font-bold">
                    {language === "fr" ? "Panneaux solaires + stockage" : "Solar panels + storage"}
                  </span>
                  <br />
                  <span className="font-normal">
                    {language === "fr" ? "Commercial & Industriel" : "Commercial & Industrial"}
                  </span>
                  <br />
                  <span className="font-normal">
                    {language === "fr" ? "Partout au Québec" : "Across Quebec"}
                  </span>
                </h1>
                <p className="text-lg sm:text-xl text-primary font-bold pt-2">
                  {language === "fr" 
                    ? "Incitatifs financiers jusqu'à 60% du projet." 
                    : "Financial incentives up to 60% of the project."}
                </p>
              </div>

              {/* Trust badges - stacked */}
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex items-center gap-2 justify-center lg:justify-start" data-testid="badge-trust-certified">
                  <Shield className="w-4 h-4 text-primary" />
                  <span className="text-sm text-muted-foreground">{t("landing.trust.certified")}</span>
                </div>
                <div className="flex items-center gap-2 justify-center lg:justify-start" data-testid="badge-trust-experience">
                  <Award className="w-4 h-4 text-primary" />
                  <span className="text-sm text-muted-foreground">{t("landing.trust.experience")}</span>
                </div>
                <div className="flex items-center gap-2 justify-center lg:justify-start" data-testid="badge-trust-datadriven">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <span className="text-sm text-muted-foreground">{t("landing.trust.datadriven")}</span>
                </div>
              </div>
              
              </motion.div>
            
            {/* Right: Visual - wider */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="lg:col-span-3 space-y-3"
            >
              <div className="rounded-2xl overflow-hidden shadow-2xl border">
                <img 
                  src={language === "fr" ? heroOptimization : screenshotOptimizationEn} 
                  alt={language === "fr" ? "Analyse d'optimisation" : "Optimization analysis"}
                  className="w-full h-auto"
                  data-testid="img-hero-analysis"
                />
              </div>
              
              {/* Blue box below image */}
              <div className="bg-primary text-primary-foreground rounded-xl p-4 shadow-lg">
                <p className="text-base font-semibold text-center">
                  {language === "fr" 
                    ? <>GRATUIT: design du système <span className="underline">le plus rentable</span> pour votre immeuble</> 
                    : <>FREE: design of <span className="underline">the most profitable</span> system for your building</>}
                </p>
              </div>
            </motion.div>
          </div>
          
          </div>
      </section>
      
      {/* CTA Button - Centered between Hero and Pathways */}
      <div className="flex justify-center py-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <a href="#paths">
            <Button size="lg" className="gap-2 text-base px-8" data-testid="button-hero-cta">
              {language === "fr" ? "Choix de 2 types d'analyses GRATUITES" : "Choose from 2 FREE analysis types"}
              <ChevronDown className="w-5 h-5" />
            </Button>
          </a>
        </motion.div>
      </div>

      {/* ========== TWO PATHWAYS SECTION ========== */}
      <section id="paths" className="py-12 px-4 sm:px-6 lg:px-8 scroll-mt-24">
        <div className="max-w-6xl mx-auto">
          {/* Section header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-8"
          >
            <h2 className="text-2xl sm:text-3xl font-bold mb-2" data-testid="text-paths-title">
              {language === "fr" ? "Votre parcours en 2 étapes" : "Your journey in 2 steps"}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {language === "fr" 
                ? "Commencez par une estimation rapide, puis obtenez une analyse complète pour recevoir votre proposition"
                : "Start with a quick estimate, then get a complete analysis to receive your proposal"
              }
            </p>
          </motion.div>
          
          {/* Timeline connector - visible on desktop */}
          <div className="hidden lg:flex items-center justify-center mb-6 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center font-bold text-primary">
                1
              </div>
              <span className="text-sm font-medium text-muted-foreground">
                {language === "fr" ? "Estimation" : "Estimate"}
              </span>
            </div>
            <div className="flex-1 max-w-32 h-0.5 bg-gradient-to-r from-primary/50 via-muted-foreground/30 to-accent/50 relative">
              <ArrowRight className="w-5 h-5 text-muted-foreground absolute -right-2 -top-2" />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent/20 border-2 border-accent flex items-center justify-center font-bold text-accent">
                2
              </div>
              <span className="text-sm font-medium text-muted-foreground">
                {language === "fr" ? "Analyse complète" : "Full analysis"}
              </span>
            </div>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-6 lg:gap-8 relative mt-4 items-stretch">
            {/* Mobile arrow connector between cards */}
            <div className="lg:hidden absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
              <div className="bg-background border-2 border-muted rounded-full p-2 shadow-sm">
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
            
            {/* ===== PATH 1: QUICK ANALYSIS (5 min) ===== */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className={quickPathExpanded ? "lg:col-span-2" : "h-full"}
            >
              <Card ref={quickPathRef} className={`border-2 transition-all scroll-mt-24 relative h-full ${quickPathExpanded ? 'border-primary' : 'border-primary/40 hover:border-primary/60'}`}>
                {/* Step 1 badge - prominent circle */}
                {!quickPathExpanded && (
                  <div className="absolute -top-3 left-6 z-10">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center shadow-md">
                      1
                    </div>
                  </div>
                )}
                {/* Header - Always visible */}
                <div 
                  className={`p-6 cursor-pointer flex flex-col ${!quickPathExpanded ? 'hover-elevate pt-8 h-full' : ''}`}
                  onClick={() => {
                    if (!quickPathExpanded) {
                      setQuickPathExpanded(true);
                      setDetailedPathExpanded(false);
                      // Scroll to the section after expansion animation
                      setTimeout(() => {
                        quickPathRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }, 350);
                    }
                  }}
                  data-testid="section-quick-header"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-primary/15 shrink-0">
                        <Timer className="w-7 h-7 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">
                          {language === "fr" ? "Analyse RAPIDE" : "Quick Analysis"}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className="bg-primary/10 text-primary border-primary/20">
                            2 min
                          </Badge>
                          <Badge variant="outline" className="text-muted-foreground">
                            ~75% {language === "fr" ? "précision" : "accuracy"}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground mt-1 min-h-[2.5rem]">
                          {language === "fr" 
                            ? "Estimez votre potentiel solaire en quelques clics"
                            : "Estimate your solar potential in a few clicks"
                          }
                        </p>
                      </div>
                    </div>
                    {!quickPathExpanded && (
                      <Button size="sm" className="shrink-0 gap-1" data-testid="button-path-quick">
                        {language === "fr" ? "Commencer" : "Start"}
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  
                  {/* Preview thumbnail when collapsed */}
                  {!quickPathExpanded && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex gap-4 items-center">
                        <img 
                          src={consumptionAnalysis} 
                          alt={language === "fr" ? "Aperçu analyse" : "Analysis preview"}
                          className="w-24 h-16 object-cover rounded-lg border shrink-0"
                        />
                        <div className="text-sm">
                          <p className="font-medium text-muted-foreground">
                            {language === "fr" ? "Vous obtiendrez:" : "You'll get:"}
                          </p>
                          <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                            <li className="flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-green-500" />
                              {language === "fr" ? "Capacité solaire estimée" : "Estimated solar capacity"}
                            </li>
                            <li className="flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-green-500" />
                              {language === "fr" ? "Économies annuelles" : "Annual savings"}
                            </li>
                            <li className="flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-green-500" />
                              {language === "fr" ? "Retour sur investissement" : "Payback period"}
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Expanded content */}
                <AnimatePresence>
                  {quickPathExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="border-t">
                        <div className="grid lg:grid-cols-5 gap-0">
                          {/* Left: What's included */}
                          <div className="lg:col-span-2 p-6 bg-muted/30 space-y-4">
                            <h4 className="font-semibold flex items-center gap-2">
                              <CheckCircle2 className="w-5 h-5 text-primary" />
                              {language === "fr" ? "Ce que vous obtenez" : "What you get"}
                            </h4>
                            
                            <ul className="space-y-3 text-sm">
                              <li className="flex items-start gap-2">
                                <BarChart3 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                <span>{language === "fr" ? "3 scénarios de dimensionnement (70%, 85%, 100%)" : "3 sizing scenarios (70%, 85%, 100%)"}</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <Sun className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                <span>{language === "fr" ? "Production solaire estimée (kWh/an)" : "Estimated solar production (kWh/yr)"}</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <DollarSign className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                <span>{language === "fr" ? "Économies annuelles estimées" : "Estimated annual savings"}</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <BadgePercent className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                <span>{language === "fr" ? "Incitatifs directs (Hydro-Québec + ITC fédéral 30%)" : "Direct incentives (Hydro-Québec + Federal ITC 30%)"}</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <TrendingUp className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                <span>{language === "fr" ? "Période de retour sur investissement" : "Payback period estimate"}</span>
                              </li>
                            </ul>
                            
                            {/* Consumption analysis image - reflects the consumption-based approach */}
                            <div className="pt-2">
                              <div className="relative">
                                <img 
                                  src={consumptionAnalysis} 
                                  alt={language === "fr" ? "Analyse de consommation énergétique" : "Energy consumption analysis"}
                                  className="w-full h-40 object-cover rounded-lg border"
                                />
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 text-center">
                                {language === "fr" 
                                  ? "Dimensionnement basé sur votre consommation réelle" 
                                  : "Sizing based on your actual consumption"
                                }
                              </p>
                            </div>
                          </div>
                          
                          {/* Right: Calculator form */}
                          <div className="lg:col-span-3 p-6 space-y-5">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold">
                                {language === "fr" ? "Entrez vos informations" : "Enter your information"}
                              </h4>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setQuickPathExpanded(false)}
                                data-testid="button-collapse-quick"
                              >
                                <ChevronUp className="w-4 h-4 mr-1" />
                                {language === "fr" ? "Réduire" : "Collapse"}
                              </Button>
                            </div>
                            
                            {!calcResults ? (
                              <div className="space-y-4">
                                {/* Input mode toggle */}
                                <div className="flex items-center justify-center gap-2 p-1 bg-muted rounded-lg">
                                  <Button
                                    type="button"
                                    variant={calcInputMode === "upload" ? "default" : "ghost"}
                                    size="sm"
                                    className="flex-1 gap-2"
                                    onClick={() => setCalcInputMode("upload")}
                                    data-testid="button-mode-upload"
                                  >
                                    <Upload className="w-4 h-4" />
                                    {language === "fr" ? "Téléverser facture" : "Upload bill"}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant={calcInputMode === "manual" ? "default" : "ghost"}
                                    size="sm"
                                    className="flex-1 gap-2"
                                    onClick={() => setCalcInputMode("manual")}
                                    data-testid="button-mode-manual"
                                  >
                                    <Calculator className="w-4 h-4" />
                                    {language === "fr" ? "Entrée manuelle" : "Manual entry"}
                                  </Button>
                                </div>
                                
                                {/* Upload mode */}
                                {calcInputMode === "upload" && (
                                  <div className="space-y-3">
                                    <input
                                      type="file"
                                      ref={billFileInputRef}
                                      accept=".pdf,image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleBillUpload(file);
                                      }}
                                    />
                                    <div
                                      className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover-elevate transition-colors"
                                      onClick={() => billFileInputRef.current?.click()}
                                    >
                                      {calcBillParsing ? (
                                        <div className="flex flex-col items-center gap-2">
                                          <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                          <p className="text-sm text-muted-foreground">
                                            {language === "fr" ? "Analyse de la facture..." : "Analyzing bill..."}
                                          </p>
                                        </div>
                                      ) : calcBillParsed ? (
                                        <div className="flex flex-col items-center gap-2">
                                          <FileCheck className="w-8 h-8 text-green-600" />
                                          <p className="text-sm font-medium text-green-600">
                                            {language === "fr" ? "Facture analysée!" : "Bill analyzed!"}
                                          </p>
                                          <p className="text-lg font-bold text-primary">
                                            {calcBillParsed.annualConsumptionKwh?.toLocaleString()} kWh/{language === "fr" ? "an" : "yr"}
                                          </p>
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setCalcBillFile(null);
                                              setCalcBillParsed(null);
                                              setCalcAnnualConsumption("");
                                            }}
                                          >
                                            {language === "fr" ? "Changer de facture" : "Change bill"}
                                          </Button>
                                        </div>
                                      ) : (
                                        <div className="flex flex-col items-center gap-3">
                                          <div className="relative">
                                            <img 
                                              src={hqBillUploadIllustration} 
                                              alt="Hydro-Québec bill" 
                                              className="w-20 h-20 object-contain"
                                            />
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <img 
                                              src={hqLogo} 
                                              alt="Hydro-Québec" 
                                              className="h-6 object-contain"
                                            />
                                          </div>
                                          <p className="text-sm font-medium text-center">
                                            {language === "fr" ? "Téléversez votre facture Hydro-Québec" : "Upload your Hydro-Québec bill"}
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            PDF ou image (JPG, PNG)
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground text-center">
                                      {language === "fr" 
                                        ? "Nous extrayons automatiquement votre consommation annuelle" 
                                        : "We automatically extract your annual consumption"}
                                    </p>
                                  </div>
                                )}
                                
                                {/* Manual entry mode */}
                                {calcInputMode === "manual" && (
                                  <div className="space-y-4">
                                    {/* Annual consumption - primary input */}
                                    <div className="space-y-2">
                                      <label className="text-sm font-medium flex items-center gap-2">
                                        <Zap className="w-4 h-4 text-primary" />
                                        {language === "fr" ? "Consommation annuelle (kWh)" : "Annual consumption (kWh)"}
                                        <span className="text-xs text-muted-foreground">
                                          ({language === "fr" ? "recommandé" : "recommended"})
                                        </span>
                                      </label>
                                      <Input
                                        type="number"
                                        value={calcAnnualConsumption}
                                        onChange={(e) => setCalcAnnualConsumption(e.target.value)}
                                        className="h-11"
                                        placeholder={language === "fr" ? "ex: 150000" : "e.g., 150000"}
                                        min={10000}
                                        data-testid="input-calc-annual-consumption"
                                      />
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 h-px bg-border" />
                                      <span className="text-xs text-muted-foreground px-2">
                                        {language === "fr" ? "OU" : "OR"}
                                      </span>
                                      <div className="flex-1 h-px bg-border" />
                                    </div>
                                    
                                    {/* Monthly bill - alternative input */}
                                    <div className="grid sm:grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <label className="text-sm font-medium flex items-center gap-2">
                                          <DollarSign className="w-4 h-4 text-primary" />
                                          {language === "fr" ? "Facture mensuelle" : "Monthly bill"}
                                        </label>
                                        <Input
                                          type="number"
                                          value={calcBill}
                                          onChange={(e) => setCalcBill(e.target.value)}
                                          className="h-11"
                                          placeholder="$"
                                          min={200}
                                          data-testid="input-calc-bill"
                                        />
                                      </div>
                                      
                                      <div className="space-y-2">
                                        <label className="text-sm font-medium flex items-center gap-2">
                                          <Zap className="w-4 h-4 text-primary" />
                                          {language === "fr" ? "Tarif Hydro-Québec" : "Hydro-Québec tariff"}
                                        </label>
                                        <Select value={calcTariff} onValueChange={setCalcTariff}>
                                          <SelectTrigger className="h-11" data-testid="select-calc-tariff">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {Object.entries(tariffLabels).map(([value, label]) => (
                                              <SelectItem key={value} value={value}>{label}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                
                                {/* Building type - only show when no bill uploaded (manual entry needs this for estimation) */}
                                {!calcBillParsed && (
                                  <div className="space-y-2">
                                    <label className="text-sm font-medium flex items-center gap-2">
                                      <Building2 className="w-4 h-4 text-primary" />
                                      {language === "fr" ? "Type de bâtiment" : "Building type"}
                                    </label>
                                    <Select value={calcBuildingType} onValueChange={setCalcBuildingType}>
                                      <SelectTrigger className="h-11" data-testid="select-calc-building">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {Object.entries(buildingTypeLabels).map(([value, label]) => (
                                          <SelectItem key={value} value={value}>{label}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}
                                
                                {/* Email */}
                                <div className="space-y-2">
                                  <label className="text-sm font-medium flex items-center gap-2">
                                    <Mail className="w-4 h-4 text-primary" />
                                    {language === "fr" ? "Courriel" : "Email"}
                                  </label>
                                  <Input
                                    type="email"
                                    value={calcEmail}
                                    onChange={(e) => setCalcEmail(e.target.value)}
                                    className="h-11"
                                    placeholder={language === "fr" ? "votre@courriel.com" : "your@email.com"}
                                    data-testid="input-calc-email"
                                  />
                                </div>
                                
                                {/* Address */}
                                <div className="space-y-2">
                                  <label className="text-sm font-medium flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-primary" />
                                    {language === "fr" ? "Adresse" : "Address"}
                                  </label>
                                  <Input
                                    type="text"
                                    value={calcAddress}
                                    onChange={(e) => setCalcAddress(e.target.value)}
                                    className="h-11"
                                    placeholder={language === "fr" ? "123 rue Principale, Montréal" : "123 Main Street, Montreal"}
                                    data-testid="input-calc-address"
                                  />
                                </div>
                                
                                {calcError && (
                                  <p className="text-sm text-destructive">{calcError}</p>
                                )}
                                
                                <Button 
                                  size="lg" 
                                  className="w-full gap-2"
                                  onClick={handleQuickEstimate}
                                  disabled={calcLoading || (calcInputMode === "upload" && calcBillParsing)}
                                  data-testid="button-calc-analyze"
                                >
                                  {calcLoading ? (
                                    <>
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                      {language === "fr" ? "Analyse en cours..." : "Analyzing..."}
                                    </>
                                  ) : (
                                    <>
                                      <Calculator className="w-4 h-4" />
                                      {language === "fr" ? "Voir 3 scénarios" : "See 3 scenarios"}
                                    </>
                                  )}
                                </Button>
                              </div>
                            ) : (
                              /* Results display - 3 scenarios */
                              <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                                  <span className="font-semibold text-green-800 dark:text-green-200">
                                    {language === "fr" ? "Analyse complétée!" : "Analysis complete!"}
                                  </span>
                                </div>
                                
                                {/* Consumption summary */}
                                <div className="p-3 bg-muted/50 rounded-lg border mb-2">
                                  <p className="text-sm">
                                    <span className="text-muted-foreground">{language === "fr" ? "Consommation annuelle:" : "Annual consumption:"}</span>{" "}
                                    <span className="font-bold">{calcResults.consumption?.annualKWh?.toLocaleString() || calcResults.inputs.annualConsumptionKwh?.toLocaleString()} kWh</span>
                                  </p>
                                </div>
                                
                                {/* 3 Scenario cards */}
                                <div className="space-y-3">
                                  {calcResults.scenarios?.map((scenario) => {
                                    const scenarioLabels = {
                                      conservative: {
                                        title: language === "fr" ? "Conservateur" : "Conservative",
                                        subtitle: language === "fr" ? "70% de compensation" : "70% offset",
                                        tooltip: language === "fr" 
                                          ? "Couvre 70% de votre consommation. Recommandé pour la plupart des bâtiments." 
                                          : "Covers 70% of consumption. Recommended for most buildings.",
                                        badge: language === "fr" ? "Recommandé" : "Recommended",
                                      },
                                      optimal: {
                                        title: language === "fr" ? "Optimal" : "Optimal",
                                        subtitle: language === "fr" ? "85% de compensation" : "85% offset",
                                        tooltip: language === "fr" 
                                          ? "Équilibre idéal entre autoconsommation et surplus." 
                                          : "Ideal balance between self-consumption and surplus.",
                                        badge: null,
                                      },
                                      maximum: {
                                        title: "Maximum",
                                        subtitle: language === "fr" ? "100% de compensation" : "100% offset",
                                        tooltip: language === "fr" 
                                          ? "Couverture complète de votre consommation annuelle." 
                                          : "Full coverage of your annual consumption.",
                                        badge: null,
                                      },
                                    };
                                    const labels = scenarioLabels[scenario.key as keyof typeof scenarioLabels];
                                    const isRecommended = scenario.key === "conservative";
                                    
                                    // Calculate percentage savings vs current bill
                                    const annualBill = calcResults.billing.annualBillBefore || (calcResults.billing.monthlyBillBefore * 12);
                                    const savingsPercent = annualBill > 0 ? Math.round((scenario.annualSavings / annualBill) * 100) : 0;
                                    
                                    return (
                                      <div 
                                        key={scenario.key}
                                        className={`p-4 rounded-lg border ${isRecommended ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'bg-background'}`}
                                        data-testid={`scenario-${scenario.key}`}
                                      >
                                        <div className="flex items-start justify-between gap-2 mb-3">
                                          <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <h5 className="font-semibold">{labels.title}</h5>
                                              <span className="text-sm text-muted-foreground">({labels.subtitle})</span>
                                              <Badge variant="outline" className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 text-xs">
                                                -{savingsPercent}%
                                              </Badge>
                                              {labels.badge && (
                                                <Badge className="bg-primary text-primary-foreground text-xs">
                                                  {labels.badge}
                                                </Badge>
                                              )}
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                              <Info className="w-3 h-3" />
                                              {labels.tooltip}
                                            </p>
                                          </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                          <div>
                                            <p className="text-xs text-muted-foreground">{language === "fr" ? "Système" : "System"}</p>
                                            <p className="text-lg font-bold text-primary">{scenario.systemSizeKW} kW</p>
                                          </div>
                                          <div>
                                            <p className="text-xs text-muted-foreground">{language === "fr" ? "Production" : "Production"}</p>
                                            <p className="text-lg font-bold">{(scenario.annualProductionKWh / 1000).toFixed(0)} MWh/{language === "fr" ? "an" : "yr"}</p>
                                          </div>
                                          <div>
                                            <p className="text-xs text-muted-foreground">{language === "fr" ? "Économies" : "Savings"}</p>
                                            <p className="text-lg font-bold text-green-600">${scenario.annualSavings.toLocaleString()}/{language === "fr" ? "an" : "yr"}</p>
                                          </div>
                                          <div>
                                            <p className="text-xs text-muted-foreground">{language === "fr" ? "Retour" : "Payback"}</p>
                                            <p className="text-lg font-bold">{scenario.paybackYears.toFixed(1)} {language === "fr" ? "ans" : "yrs"}</p>
                                          </div>
                                        </div>
                                        
                                        <div className="mt-3 pt-3 border-t space-y-2">
                                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                            <span>{language === "fr" ? "Coût brut:" : "Gross cost:"} <span className="font-medium">${scenario.grossCAPEX.toLocaleString()}</span></span>
                                            <span>{language === "fr" ? "Coût net:" : "Net cost:"} <span className="font-medium">${scenario.netCAPEX.toLocaleString()}</span></span>
                                          </div>
                                          <div className="bg-green-50 dark:bg-green-950/30 rounded-md p-2 space-y-1">
                                            <p className="text-xs font-medium text-green-700 dark:text-green-400">
                                              {language === "fr" ? "Incitatifs directs inclus:" : "Direct incentives included:"}
                                            </p>
                                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                                              <span className="text-green-600 dark:text-green-400">
                                                Hydro-Québec: <span className="font-medium">-${scenario.hqIncentive?.toLocaleString() || 0}</span>
                                              </span>
                                              <span className="text-green-600 dark:text-green-400">
                                                {language === "fr" ? "ITC Fédéral (30%):" : "Federal ITC (30%):"} <span className="font-medium">-${scenario.federalITC?.toLocaleString() || 0}</span>
                                              </span>
                                            </div>
                                            <p className="text-xs font-semibold text-green-700 dark:text-green-300 pt-1 border-t border-green-200 dark:border-green-800">
                                              {language === "fr" ? "Total incitatifs:" : "Total incentives:"} -${scenario.totalIncentives?.toLocaleString() || 0}
                                            </p>
                                          </div>
                                          <p className="text-[10px] text-muted-foreground italic">
                                            {language === "fr" 
                                              ? "* L'amortissement accéléré (CCA 43.2) offre un avantage fiscal additionnel selon votre situation fiscale." 
                                              : "* Accelerated depreciation (CCA Class 43.2) provides additional tax benefits based on your tax situation."}
                                          </p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                
                                {/* Storage Recommendation Section */}
                                {calcResults.storage?.recommended && (
                                  <div className="mt-4 p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30" data-testid="storage-recommendation">
                                    <div className="flex items-start gap-3">
                                      <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50">
                                        <Battery className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                      </div>
                                      <div className="flex-1">
                                        <h5 className="font-semibold flex items-center gap-2">
                                          {language === "fr" ? "Stockage recommandé" : "Storage Recommended"}
                                          <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 text-xs">
                                            {language === "fr" ? "Optionnel" : "Optional"}
                                          </Badge>
                                        </h5>
                                        <p className="text-sm text-muted-foreground mt-1">
                                          {calcResults.storage.tariffHasDemandCharges 
                                            ? (language === "fr" 
                                                ? "Votre tarif comporte des frais de puissance. Le stockage peut réduire vos pointes de demande et générer des économies additionnelles." 
                                                : "Your tariff includes demand charges. Storage can reduce your demand peaks and generate additional savings.")
                                            : (language === "fr"
                                                ? "Avec un système solaire de cette taille, le stockage peut maximiser l'autoconsommation et fournir une alimentation de secours."
                                                : "With a solar system of this size, storage can maximize self-consumption and provide backup power.")}
                                        </p>
                                        
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                                          <div>
                                            <p className="text-xs text-muted-foreground">{language === "fr" ? "Puissance" : "Power"}</p>
                                            <p className="text-base font-bold text-amber-700 dark:text-amber-400">{calcResults.storage.batteryPowerKW} kW</p>
                                          </div>
                                          <div>
                                            <p className="text-xs text-muted-foreground">{language === "fr" ? "Capacité" : "Capacity"}</p>
                                            <p className="text-base font-bold text-amber-700 dark:text-amber-400">{calcResults.storage.batteryEnergyKWh} kWh</p>
                                          </div>
                                          <div>
                                            <p className="text-xs text-muted-foreground">{language === "fr" ? "Coût estimé" : "Est. Cost"}</p>
                                            <p className="text-base font-bold">${calcResults.storage.estimatedCost.toLocaleString()}</p>
                                          </div>
                                          {calcResults.storage.estimatedAnnualSavings > 0 && (
                                            <div>
                                              <p className="text-xs text-muted-foreground">{language === "fr" ? "Écon. add." : "Add. Savings"}</p>
                                              <p className="text-base font-bold text-green-600">${calcResults.storage.estimatedAnnualSavings.toLocaleString()}/{language === "fr" ? "an" : "yr"}</p>
                                            </div>
                                          )}
                                        </div>
                                        
                                        <p className="text-xs text-muted-foreground mt-2 italic">
                                          {language === "fr" 
                                            ? "* L'analyse détaillée avec données 15-min permettra un dimensionnement précis du stockage." 
                                            : "* Detailed analysis with 15-min data will enable precise storage sizing."}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                
                                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                  <Button 
                                    variant="outline" 
                                    onClick={() => {
                                      setCalcResults(null);
                                      setCalcBillFile(null);
                                      setCalcBillParsed(null);
                                    }}
                                    className="flex-1"
                                  >
                                    {language === "fr" ? "Nouvelle analyse" : "New analysis"}
                                  </Button>
                                  <Button 
                                    className="flex-1 gap-2"
                                    onClick={() => {
                                      setDetailedPathExpanded(true);
                                      setQuickPathExpanded(false);
                                      setTimeout(() => {
                                        detailedPathRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                      }, 350);
                                    }}
                                    data-testid="button-get-detailed-analysis"
                                  >
                                    {language === "fr" ? "Continuer vers l'Étape 2" : "Continue to Step 2"}
                                    <ArrowRight className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>

            {/* ===== PATH 2: DETAILED ANALYSIS (5 days) ===== */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className={`${detailedPathExpanded ? "lg:col-span-2" : "h-full"} ${quickPathExpanded ? "hidden lg:block lg:col-span-1" : ""}`}
            >
                <Card ref={detailedPathRef} className={`border-2 transition-all scroll-mt-24 relative h-full ${detailedPathExpanded ? 'border-accent' : 'border-accent/60 hover:border-accent bg-gradient-to-br from-accent/5 to-transparent'}`}>
                  {/* Step 2 badge - prominent circle */}
                  {!detailedPathExpanded && (
                    <div className="absolute -top-3 left-6 z-10">
                      <div className="w-8 h-8 rounded-full bg-accent text-accent-foreground text-sm font-bold flex items-center justify-center shadow-md">
                        2
                      </div>
                    </div>
                  )}
                  {/* Header - Always visible */}
                  <div 
                    className={`p-6 cursor-pointer flex flex-col ${!detailedPathExpanded ? 'hover-elevate pt-8 h-full' : ''}`}
                    onClick={() => {
                      if (!detailedPathExpanded) {
                        setDetailedPathExpanded(true);
                        setQuickPathExpanded(false);
                        // Scroll to the section after expansion animation
                        setTimeout(() => {
                          detailedPathRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 350);
                      }
                    }}
                    data-testid="section-detailed-header"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-accent/10 shrink-0">
                          <FileBarChart className="w-7 h-7 text-accent" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold">
                            {language === "fr" ? "Analyse DÉTAILLÉE" : "Detailed Analysis"}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className="bg-accent/10 text-accent border-accent/20">
                              5 {language === "fr" ? "jours" : "days"}
                            </Badge>
                            <Badge variant="outline" className="text-muted-foreground">
                              ~95% {language === "fr" ? "précision" : "accuracy"}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground mt-1 min-h-[2.5rem]">
                            {language === "fr" 
                              ? "Requis pour recevoir une proposition — basé sur vos données réelles"
                              : "Required for a proposal — based on your real data"
                            }
                          </p>
                        </div>
                      </div>
                      {!detailedPathExpanded && (
                        <Button size="sm" variant="outline" className="shrink-0 gap-1 border-accent text-accent" data-testid="button-path-detailed">
                          {language === "fr" ? "En savoir plus" : "Learn more"}
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    
                    {/* Preview thumbnail when collapsed */}
                    {!detailedPathExpanded && (
                      <div className="mt-4 pt-4 border-t">
                        <div className="flex gap-4 items-center">
                          <img 
                            src={language === "fr" ? screenshotFinancialFr : screenshotFinancialEn} 
                            alt={language === "fr" ? "Aperçu rapport" : "Report preview"}
                            className="w-24 h-16 object-cover rounded-lg border shrink-0"
                          />
                          <div className="text-sm">
                            <p className="font-medium text-muted-foreground">
                              {language === "fr" ? "Vous obtiendrez:" : "You'll get:"}
                            </p>
                            <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                              <li className="flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-green-500" />
                                {language === "fr" ? "Profil de consommation annuel complet" : "Complete annual consumption profile"}
                              </li>
                              <li className="flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-green-500" />
                                {language === "fr" ? "Projections financières 25 ans" : "25-year financial projections"}
                              </li>
                              <li className="flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-green-500" />
                                {language === "fr" ? "Rapport PDF professionnel" : "Professional PDF report"}
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Expanded content */}
                  <AnimatePresence>
                    {detailedPathExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <div className="border-t">
                          <div className="grid lg:grid-cols-2 gap-0">
                            {/* Left: What's included + Process */}
                            <div className="p-6 bg-muted/30 space-y-6">
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold flex items-center gap-2">
                                  <ClipboardCheck className="w-5 h-5 text-accent" />
                                  {language === "fr" ? "Ce qui est inclus" : "What's included"}
                                </h4>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => setDetailedPathExpanded(false)}
                                  data-testid="button-collapse-detailed"
                                >
                                  <ChevronUp className="w-4 h-4 mr-1" />
                                  {language === "fr" ? "Réduire" : "Collapse"}
                                </Button>
                              </div>
                              
                              <ul className="space-y-3 text-sm">
                                <li className="flex items-start gap-2">
                                  <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                                  <span>{language === "fr" ? "Analyse heure par heure basée sur votre consommation réelle" : "Hour-by-hour analysis based on your real consumption"}</span>
                                </li>
                                <li className="flex items-start gap-2">
                                  <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                                  <span>{language === "fr" ? "Dimensionnement optimal solaire + stockage" : "Optimal solar + storage sizing"}</span>
                                </li>
                                <li className="flex items-start gap-2">
                                  <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                                  <span>{language === "fr" ? "Projections financières sur 25 ans (VAN, TRI, LCOE)" : "25-year financial projections (NPV, IRR, LCOE)"}</span>
                                </li>
                                <li className="flex items-start gap-2">
                                  <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                                  <span>{language === "fr" ? "Comparaison des options de financement" : "Financing options comparison"}</span>
                                </li>
                                <li className="flex items-start gap-2">
                                  <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                                  <span>{language === "fr" ? "Rapport PDF professionnel" : "Professional PDF report"}</span>
                                </li>
                              </ul>
                              
                              {/* Process timeline */}
                              <div className="pt-4 border-t">
                                <p className="text-sm font-medium mb-3">
                                  {language === "fr" ? "Comment ça fonctionne" : "How it works"}
                                </p>
                                <div className="space-y-3">
                                  {[
                                    { step: 1, text: language === "fr" ? "Vous remplissez le formulaire" : "You fill out the form", icon: FileText },
                                    { step: 2, text: language === "fr" ? "Vous signez la procuration Hydro-Québec" : "You sign the Hydro-Québec proxy", icon: FileSignature },
                                    { step: 3, text: language === "fr" ? "Nous analysons vos données" : "We analyze your data", icon: BarChart3 },
                                    { step: 4, text: language === "fr" ? "Vous recevez votre rapport" : "You receive your report", icon: FileCheck },
                                  ].map((item) => (
                                    <div key={item.step} className="flex items-center gap-3" data-testid={`step-detailed-${item.step}`}>
                                      <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent">
                                        {item.step}
                                      </div>
                                      <item.icon className="w-4 h-4 text-muted-foreground" />
                                      <span className="text-sm">{item.text}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              
                              {/* Preview carousel */}
                              <div className="pt-4">
                                <div className="relative aspect-video rounded-lg overflow-hidden border bg-card">
                                  {analysisSlides.map((slide, index) => (
                                    <div
                                      key={slide.id}
                                      className={`absolute inset-0 transition-opacity duration-500 ${
                                        index === activeSlide ? "opacity-100" : "opacity-0"
                                      }`}
                                    >
                                      <img 
                                        src={slide.image} 
                                        alt={slide.label}
                                        className="w-full h-full object-contain bg-white"
                                      />
                                    </div>
                                  ))}
                                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                                    <p className="text-white text-xs font-medium">
                                      {analysisSlides[activeSlide]?.label}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex justify-center gap-1.5 mt-2">
                                  {analysisSlides.map((slide, index) => (
                                    <button
                                      key={slide.id}
                                      onClick={() => setActiveSlide(index)}
                                      className={`w-2 h-2 rounded-full transition-colors ${
                                        index === activeSlide ? "bg-accent" : "bg-muted-foreground/30"
                                      }`}
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>
                            
                            {/* Right: CTA to dedicated page */}
                            <div className="p-6 space-y-5 flex flex-col justify-start">
                              <h4 className="font-semibold">
                                {language === "fr" ? "Demander mon analyse" : "Request my analysis"}
                              </h4>
                              
                              <div className="space-y-4">
                                <p className="text-sm text-muted-foreground">
                                  {language === "fr" 
                                    ? "L'analyse détaillée nécessite la signature d'une procuration pour accéder à vos données Hydro-Québec. Notre formulaire sécurisé vous guide à travers les étapes."
                                    : "The detailed analysis requires signing an authorization to access your Hydro-Québec data. Our secure form guides you through the steps."
                                  }
                                </p>
                                
                                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                                  <div className="flex items-center gap-2 text-sm">
                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                    <span>{language === "fr" ? "Formulaire en 3 étapes simples" : "Simple 3-step form"}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-sm">
                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                    <span>{language === "fr" ? "Signature électronique sécurisée" : "Secure electronic signature"}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-sm">
                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                    <span>{language === "fr" ? "Téléversement de factures Hydro-Québec" : "Hydro-Québec bill upload"}</span>
                                  </div>
                                </div>
                                
                                <Link href="/analyse-detaillee">
                                  <Button 
                                    size="lg" 
                                    className="w-full gap-2 bg-accent text-accent-foreground"
                                    data-testid="button-go-to-detailed-form"
                                    onClick={() => {
                                      // Transfer parsed bill data to localStorage for use on detailed analysis page
                                      if (calcBillParsed) {
                                        localStorage.setItem('kwhquebec_bill_data', JSON.stringify({
                                          accountNumber: calcBillParsed.accountNumber || null,
                                          clientName: calcBillParsed.clientName || calcClientName || null,
                                          serviceAddress: calcBillParsed.serviceAddress || calcAddress || null,
                                          annualConsumptionKwh: calcBillParsed.annualConsumptionKwh || null,
                                          tariffCode: calcBillParsed.tariffCode || null,
                                          email: calcEmail || null,
                                        }));
                                      }
                                    }}
                                  >
                                    {language === "fr" ? "Commencer ma demande" : "Start my request"}
                                    <ArrowRight className="w-4 h-4" />
                                  </Button>
                                </Link>
                                
                                <p className="text-xs text-muted-foreground text-center">
                                  {language === "fr" 
                                    ? "Environ 5 minutes pour compléter"
                                    : "About 5 minutes to complete"
                                  }
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
            </motion.div>
          </div>
          
          {/* Collapsed state hint */}
          {(quickPathExpanded || detailedPathExpanded) && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 text-center"
            >
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setQuickPathExpanded(false);
                  setDetailedPathExpanded(false);
                }}
                className="text-muted-foreground"
                data-testid="button-view-both-options"
              >
                <ChevronUp className="w-4 h-4 mr-1" />
                {language === "fr" ? "Voir les deux options" : "View both options"}
              </Button>
            </motion.div>
          )}
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
            
            <div className="grid md:grid-cols-5 gap-6 relative z-10">
              {/* Step 1: Quick Analysis */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0 }}
                className="text-center"
                data-testid="process-step-1"
              >
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 rounded-full bg-primary/10 border-4 border-background flex items-center justify-center mb-6">
                    <Timer className="w-6 h-6 text-primary" />
                  </div>
                  <Badge className="mb-3 bg-primary/10 text-primary border-primary/20">
                    2 min
                  </Badge>
                  <h3 className="font-semibold text-sm mb-1">
                    {language === "fr" ? "Analyse RAPIDE" : "Quick Analysis"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {language === "fr" 
                      ? "Estimation satellite instantanée"
                      : "Instant satellite estimate"
                    }
                  </p>
                </div>
              </motion.div>
              
              {/* Step 2: Detailed Analysis */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="text-center"
                data-testid="process-step-2"
              >
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 rounded-full bg-accent/10 border-4 border-background flex items-center justify-center mb-6">
                    <BarChart3 className="w-6 h-6 text-accent" />
                  </div>
                  <Badge className="mb-3 bg-accent/10 text-accent border-accent/20">
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
              
              {/* Step 3: Design */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="text-center"
                data-testid="process-step-3"
              >
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 rounded-full bg-muted border-4 border-background flex items-center justify-center mb-6">
                    <FileText className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <Badge variant="outline" className="mb-3">
                    2-4 {language === "fr" ? "sem." : "wks"}
                  </Badge>
                  <h3 className="font-semibold text-sm mb-1">
                    {language === "fr" ? "Conception" : "Design"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {language === "fr" 
                      ? "Plans d'ingénierie, permis"
                      : "Engineering plans, permits"
                    }
                  </p>
                </div>
              </motion.div>
              
              {/* Step 4: Construction */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="text-center"
                data-testid="process-step-4"
              >
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 rounded-full bg-muted border-4 border-background flex items-center justify-center mb-6">
                    <HardHat className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <Badge variant="outline" className="mb-3">
                    4-12 {language === "fr" ? "sem." : "wks"}
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
              
              {/* Step 5: O&M */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                className="text-center"
                data-testid="process-step-5"
              >
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 rounded-full bg-muted border-4 border-background flex items-center justify-center mb-6">
                    <Wrench className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <Badge variant="outline" className="mb-3">
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
