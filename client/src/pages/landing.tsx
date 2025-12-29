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
  ClipboardCheck, Phone, Mail, Building, CalendarDays, User
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
import { SEOHead, seoContent, getLocalBusinessSchema } from "@/components/seo-head";
import logoFr from "@assets/kWh_Quebec_Logo-01_-_Rectangulaire_1764799021536.png";
import logoEn from "@assets/kWh_Quebec_Logo-02_-_Rectangle_1764799021536.png";
import installationPhoto from "@assets/dynamic-teamwork-solar-energy-diverse-technicians-installing-p_1764967501352.jpg";
import roofMeasurement from "@assets/generated_images/commercial_roof_solar_potential_overlay.png";
import heroRoofAnalysis from "@assets/generated_images/industrial_roof_solar_potential_overlay.png";
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
  const [submitted, setSubmitted] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  
  // Pathway states
  const [quickPathExpanded, setQuickPathExpanded] = useState(false);
  const [detailedPathExpanded, setDetailedPathExpanded] = useState(false);
  
  // Refs for scroll-to-section functionality
  const quickPathRef = useRef<HTMLDivElement>(null);
  const detailedPathRef = useRef<HTMLDivElement>(null);
  
  // Quick calculator states
  const [calcBill, setCalcBill] = useState<string>("");
  const [calcAddress, setCalcAddress] = useState<string>("");
  const [calcBuildingType, setCalcBuildingType] = useState<string>("office");
  const [calcTariff, setCalcTariff] = useState<string>("M");
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcResults, setCalcResults] = useState<{
    success: boolean;
    hasRoofData: boolean;
    system: { sizeKW: number; annualProductionKWh: number };
    financial: { annualSavings: number; paybackYears: number; hqIncentive: number; netCAPEX: number };
    roof?: { areaM2: number; maxCapacityKW: number; satelliteImageUrl?: string | null };
  } | null>(null);
  const [calcError, setCalcError] = useState<string>("");
  
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
        { id: "impact", image: carouselSlide1Fr, label: "Impact on your bill" },
        { id: "config", image: carouselSlide2Fr, label: "Optimal configuration" },
        { id: "evolution", image: carouselSlide3Fr, label: "25-year evolution" },
        { id: "financing", image: carouselSlide4Fr, label: "Financing options" },
        { id: "profile", image: carouselSlide5Fr, label: "Energy profile" },
        { id: "optimization", image: carouselSlide6Fr, label: "Optimization analysis" },
        { id: "sensitivity", image: carouselSlide7Fr, label: "System sensitivity" },
      ];
  
  // Building type labels
  const buildingTypeLabels = language === "fr" 
    ? { office: "Bureau", warehouse: "Entrepôt", retail: "Commerce", industrial: "Industriel", healthcare: "Santé", education: "Éducation" }
    : { office: "Office", warehouse: "Warehouse", retail: "Retail", industrial: "Industrial", healthcare: "Healthcare", education: "Education" };
  
  // Tariff labels
  const tariffLabels = language === "fr"
    ? { G: "G - Petite puissance (<65 kW)", M: "M - Moyenne puissance", L: "L - Grande puissance" }
    : { G: "G - Small power (<65 kW)", M: "M - Medium power", L: "L - Large power" };
  
  // Quick estimate function
  const handleQuickEstimate = async () => {
    if (!calcAddress.trim()) {
      setCalcError(language === "fr" ? "Veuillez entrer une adresse" : "Please enter an address");
      return;
    }
    
    const billAmount = parseInt(calcBill, 10);
    if (!billAmount || billAmount < 500) {
      setCalcError(language === "fr" ? "Veuillez entrer une facture d'au moins 500$" : "Please enter a bill of at least $500");
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
          address: calcAddress,
          monthlyBill: billAmount,
          buildingType: calcBuildingType,
          tariffCode: calcTariff,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setCalcResults(data);
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
                className="h-10 sm:h-12 w-auto"
                data-testid="logo-header"
              />
            </Link>
            
            <nav className="hidden md:flex items-center gap-6">
              <a href="#paths" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-analyze">
                {language === "fr" ? "Analyser" : "Analyze"}
              </a>
              <Link href="/ressources" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-resources">
                {language === "fr" ? "Ressources" : "Resources"}
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
                  src={heroOptimization} 
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
          
          <div className="grid lg:grid-cols-2 gap-6 lg:gap-8 relative mt-4">
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
              className={quickPathExpanded ? "lg:col-span-2" : ""}
            >
              <Card ref={quickPathRef} className={`border-2 transition-all scroll-mt-24 relative ${quickPathExpanded ? 'border-primary' : 'border-primary/40 hover:border-primary/60'}`}>
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
                  className={`p-6 cursor-pointer ${!quickPathExpanded ? 'hover-elevate pt-8' : ''}`}
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
                        <p className="text-muted-foreground mt-1">
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
                          src={roofMeasurement} 
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
                              {language === "fr" ? "Capacité PV estimée" : "Estimated PV capacity"}
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
                                <Sun className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                <span>{language === "fr" ? "Analyse satellite de votre toiture" : "Satellite analysis of your roof"}</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <BarChart3 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                <span>{language === "fr" ? "Capacité PV estimée (kW)" : "Estimated PV capacity (kW)"}</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <DollarSign className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                <span>{language === "fr" ? "Économies annuelles estimées" : "Estimated annual savings"}</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <BadgePercent className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                <span>{language === "fr" ? "Incitatifs Hydro-Québec applicables" : "Applicable Hydro-Québec incentives"}</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <TrendingUp className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                <span>{language === "fr" ? "Période de retour sur investissement" : "Payback period estimate"}</span>
                              </li>
                            </ul>
                            
                            {/* Roof preview image - shows real satellite when available */}
                            <div className="pt-2">
                              <div className="relative">
                                <img 
                                  src={calcResults?.roof?.satelliteImageUrl || roofMeasurement} 
                                  alt={calcResults?.roof?.satelliteImageUrl 
                                    ? (language === "fr" ? "Votre toiture" : "Your roof")
                                    : (language === "fr" ? "Exemple d'analyse de toit" : "Roof analysis example")
                                  }
                                  className="w-full h-40 object-cover rounded-lg border"
                                />
                                {calcResults?.roof?.satelliteImageUrl && (
                                  <div className="absolute bottom-2 left-2 right-2 bg-primary text-primary-foreground text-xs font-semibold py-1.5 px-3 rounded-md text-center">
                                    {language === "fr" 
                                      ? `POTENTIEL = ${calcResults.system.sizeKW.toFixed(0)} kW`
                                      : `POTENTIAL = ${calcResults.system.sizeKW.toFixed(0)} kW`
                                    }
                                  </div>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 text-center">
                                {calcResults?.roof?.satelliteImageUrl 
                                  ? (language === "fr" ? "Image satellite de votre immeuble" : "Satellite image of your building")
                                  : (language === "fr" ? "Exemple d'analyse satellite" : "Example satellite analysis")
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
                                {/* Address */}
                                <div className="space-y-2">
                                  <label className="text-sm font-medium flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-primary" />
                                    {language === "fr" ? "Adresse du bâtiment" : "Building address"}
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
                                
                                {/* Monthly bill + Building type */}
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
                                      min={500}
                                      data-testid="input-calc-bill"
                                    />
                                  </div>
                                  
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
                                </div>
                                
                                {/* Tariff */}
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
                                
                                {calcError && (
                                  <p className="text-sm text-destructive">{calcError}</p>
                                )}
                                
                                <Button 
                                  size="lg" 
                                  className="w-full gap-2"
                                  onClick={handleQuickEstimate}
                                  disabled={calcLoading}
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
                                      {language === "fr" ? "Analyser mon potentiel" : "Analyze my potential"}
                                    </>
                                  )}
                                </Button>
                              </div>
                            ) : (
                              /* Results display */
                              <div className="space-y-4">
                                <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                                  <div className="flex items-center gap-2 mb-3">
                                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                                    <span className="font-semibold text-green-800 dark:text-green-200">
                                      {language === "fr" ? "Analyse complétée!" : "Analysis complete!"}
                                    </span>
                                  </div>
                                  
                                  {/* Before/After HQ Bill Comparison */}
                                  <div className="p-3 bg-background rounded-lg border mb-4">
                                    <p className="text-xs text-muted-foreground mb-2 font-medium">
                                      {language === "fr" ? "Votre facture Hydro-Québec" : "Your Hydro-Québec bill"}
                                    </p>
                                    <div className="flex items-center justify-between gap-4">
                                      <div className="text-center">
                                        <p className="text-xs text-muted-foreground">
                                          {language === "fr" ? "Avant" : "Before"}
                                        </p>
                                        <p className="text-lg font-bold text-destructive line-through" data-testid="text-bill-before">
                                          ${calcResults.billing?.monthlyBillBefore?.toLocaleString() || calcResults.inputs.monthlyBill.toLocaleString()}/mo
                                        </p>
                                      </div>
                                      <ArrowRight className="w-5 h-5 text-green-600 shrink-0" />
                                      <div className="text-center">
                                        <p className="text-xs text-muted-foreground">
                                          {language === "fr" ? "Après" : "After"}
                                        </p>
                                        <p className="text-lg font-bold text-green-600" data-testid="text-bill-after">
                                          ${calcResults.billing?.monthlyBillAfter?.toLocaleString() || 0}/mo
                                        </p>
                                      </div>
                                      <div className="text-center bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded">
                                        <p className="text-xs text-green-700 dark:text-green-300">
                                          {language === "fr" ? "Économie" : "Savings"}
                                        </p>
                                        <p className="text-sm font-bold text-green-700 dark:text-green-300" data-testid="text-monthly-savings">
                                          -${calcResults.billing?.monthlySavings?.toLocaleString() || Math.round(calcResults.financial.annualSavings / 12).toLocaleString()}
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="grid sm:grid-cols-2 gap-3">
                                    <div className="bg-background rounded-lg p-3 border">
                                      <p className="text-xs text-muted-foreground mb-1">
                                        {language === "fr" ? "Système recommandé" : "Recommended system"}
                                      </p>
                                      <p className="text-xl font-bold text-primary" data-testid="text-quick-system-kw">
                                        {calcResults.system.sizeKW.toFixed(0)} kW
                                      </p>
                                      {calcResults.system.roofMaxCapacityKW && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                          {calcResults.system.roofMaxCapacityKW > calcResults.system.sizeKW
                                            ? (language === "fr" 
                                                ? `Capacité toit: ${calcResults.system.roofMaxCapacityKW} kW (expansion possible)` 
                                                : `Roof capacity: ${calcResults.system.roofMaxCapacityKW} kW (expansion possible)`)
                                            : (language === "fr" 
                                                ? `Limité par le toit (${calcResults.system.roofMaxCapacityKW} kW max)` 
                                                : `Roof limited (${calcResults.system.roofMaxCapacityKW} kW max)`)}
                                        </p>
                                      )}
                                    </div>
                                    
                                    <div className="bg-background rounded-lg p-3 border">
                                      <p className="text-xs text-muted-foreground mb-1">
                                        {language === "fr" ? "Production annuelle" : "Annual production"}
                                      </p>
                                      <p className="text-xl font-bold" data-testid="text-quick-production-mwh">
                                        {(calcResults.system.annualProductionKWh / 1000).toFixed(0)} MWh
                                      </p>
                                    </div>
                                    
                                    <div className="bg-background rounded-lg p-3 border">
                                      <p className="text-xs text-muted-foreground mb-1">
                                        {language === "fr" ? "Économies annuelles" : "Annual savings"}
                                      </p>
                                      <p className="text-xl font-bold text-green-600" data-testid="text-quick-savings">
                                        ${calcResults.financial.annualSavings.toLocaleString()}
                                      </p>
                                    </div>
                                    
                                    <div className="bg-background rounded-lg p-3 border">
                                      <p className="text-xs text-muted-foreground mb-1">
                                        {language === "fr" ? "Retour sur investissement" : "Payback period"}
                                      </p>
                                      <p className="text-xl font-bold" data-testid="text-quick-payback">
                                        {calcResults.financial.paybackYears.toFixed(1)} {language === "fr" ? "ans" : "years"}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  <div className="mt-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm font-medium">
                                        {language === "fr" ? "Incitatif Hydro-Québec" : "Hydro-Québec incentive"}
                                      </span>
                                      <span className="text-lg font-bold text-primary" data-testid="text-quick-incentive">
                                        ${calcResults.financial.hqIncentive.toLocaleString()}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex flex-col sm:flex-row gap-3">
                                  <Button 
                                    variant="outline" 
                                    onClick={() => setCalcResults(null)}
                                    className="flex-1"
                                  >
                                    {language === "fr" ? "Refaire une analyse" : "Run another analysis"}
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
              className={`${detailedPathExpanded ? "lg:col-span-2" : ""} ${quickPathExpanded ? "hidden lg:block lg:col-span-1" : ""}`}
            >
                <Card ref={detailedPathRef} className={`border-2 transition-all scroll-mt-24 relative ${detailedPathExpanded ? 'border-accent' : 'border-accent/60 hover:border-accent bg-gradient-to-br from-accent/5 to-transparent'}`}>
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
                    className={`p-6 cursor-pointer ${!detailedPathExpanded ? 'hover-elevate pt-8' : ''}`}
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
                          <p className="text-muted-foreground mt-1">
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
                                {language === "fr" ? "Simulation 8 760h complète" : "Complete 8,760h simulation"}
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
                                  <span>{language === "fr" ? "Simulation 8 760h basée sur votre consommation réelle" : "8,760h simulation based on your real consumption"}</span>
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
                                    { step: 2, text: language === "fr" ? "Vous signez la procuration HQ" : "You sign the HQ proxy", icon: FileSignature },
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
                                    <span>{language === "fr" ? "Téléversement de factures HQ" : "HQ bill upload"}</span>
                                  </div>
                                </div>
                                
                                <Link href="/analyse-detaillee">
                                  <Button 
                                    size="lg" 
                                    className="w-full gap-2 bg-accent text-accent-foreground"
                                    data-testid="button-go-to-detailed-form"
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
                      ? "Simulation 8 760h, rapport complet"
                      : "8,760h simulation, full report"
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
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">{t("landing.trust.title")}</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {language === "fr" 
                ? "Une équipe d'experts dédiée à votre projet solaire"
                : "A team of experts dedicated to your solar project"
              }
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Key Strengths - Hero Numbers + Checklist */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <Card className="p-6 h-full bg-gradient-to-br from-primary/5 via-background to-background border-primary/20">
                {/* Hero Numbers */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-3 rounded-xl bg-primary/10" data-testid="strength-experience">
                    <p className="text-3xl sm:text-4xl font-bold text-primary">15+</p>
                    <p className="text-xs sm:text-sm font-medium mt-1">
                      {language === "fr" ? "ans" : "years"}
                    </p>
                    <p className="text-xs text-muted-foreground hidden sm:block">
                      {language === "fr" ? "d'expérience" : "experience"}
                    </p>
                  </div>
                  
                  <div className="text-center p-3 rounded-xl bg-primary/10" data-testid="strength-capacity">
                    <p className="text-3xl sm:text-4xl font-bold text-primary">120</p>
                    <p className="text-xs sm:text-sm font-medium mt-1">MW</p>
                    <p className="text-xs text-muted-foreground hidden sm:block">
                      {language === "fr" ? "installés" : "installed"}
                    </p>
                  </div>
                  
                  <div className="text-center p-3 rounded-xl bg-primary/10" data-testid="strength-projects">
                    <p className="text-3xl sm:text-4xl font-bold text-primary">25+</p>
                    <p className="text-xs sm:text-sm font-medium mt-1">
                      {language === "fr" ? "projets" : "projects"}
                    </p>
                    <p className="text-xs text-muted-foreground hidden sm:block">
                      {language === "fr" ? "C&I" : "C&I"}
                    </p>
                  </div>
                </div>
                
                {/* Checklist Benefits */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3" data-testid="strength-rbq">
                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                    <span className="text-sm">
                      <span className="font-medium">{language === "fr" ? "Licence RBQ" : "RBQ License"}</span>
                      <span className="text-muted-foreground"> — {language === "fr" ? "Entrepreneur général" : "General contractor"}</span>
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3" data-testid="strength-financing">
                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                    <span className="text-sm">
                      <span className="font-medium">{language === "fr" ? "Financement flexible" : "Flexible financing"}</span>
                      <span className="text-muted-foreground"> — {language === "fr" ? "Options disponibles" : "Options available"}</span>
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3" data-testid="strength-coverage">
                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                    <span className="text-sm">
                      <span className="font-medium">{language === "fr" ? "Service partout au Québec" : "Service across Quebec"}</span>
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3" data-testid="strength-warranty">
                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                    <span className="text-sm">
                      <span className="font-medium">{language === "fr" ? "Garantie 25 ans" : "25-year warranty"}</span>
                      <span className="text-muted-foreground"> — {language === "fr" ? "Performance garantie" : "Performance guaranteed"}</span>
                    </span>
                  </div>
                </div>
              </Card>
            </motion.div>
            
            {/* Team Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <Card className="p-0 h-full overflow-hidden">
                <div className="relative h-full">
                  <img 
                    src={installationPhoto} 
                    alt={language === "fr" ? "Équipe d'installation" : "Installation team"}
                    className="w-full h-full min-h-[200px] object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
                  <div className="absolute inset-0 flex items-center p-6">
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold text-white">
                        {language === "fr" ? "Notre équipe" : "Our Team"}
                      </h3>
                      <p className="text-sm text-white/90">
                        {language === "fr" 
                          ? "De la conception à la mise en service, notre équipe s'occupe de tout."
                          : "From design to commissioning, our team handles everything."
                        }
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge className="bg-white/20 text-white border-white/30">
                          <Shield className="w-3 h-3 mr-1" />
                          {t("landing.trust.certified")}
                        </Badge>
                        <Badge className="bg-white/20 text-white border-white/30">
                          <Award className="w-3 h-3 mr-1" />
                          {t("landing.trust.experience")}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
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
            className="flex flex-wrap items-center justify-center gap-8 mb-16 opacity-60"
          >
            {/* Placeholder logos - replace with real client logos */}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="w-8 h-8" />
              <span className="text-sm font-medium">{language === "fr" ? "Votre logo ici" : "Your logo here"}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Factory className="w-8 h-8" />
              <span className="text-sm font-medium">{language === "fr" ? "Votre logo ici" : "Your logo here"}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <School className="w-8 h-8" />
              <span className="text-sm font-medium">{language === "fr" ? "Votre logo ici" : "Your logo here"}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="w-8 h-8" />
              <span className="text-sm font-medium">{language === "fr" ? "Votre logo ici" : "Your logo here"}</span>
            </div>
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
              <Link href="/services" className="hover:text-foreground transition-colors">
                Services
              </Link>
              <Link href="/comment-ca-marche" className="hover:text-foreground transition-colors">
                {language === "fr" ? "Comment ça marche" : "How it works"}
              </Link>
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
