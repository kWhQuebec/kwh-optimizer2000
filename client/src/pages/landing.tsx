import { useState, useEffect } from "react";
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
  ClipboardCheck, Phone, Mail, Building, CalendarDays
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
import logoFr from "@assets/kWh_Quebec_Logo-01_-_Rectangulaire_1764799021536.png";
import logoEn from "@assets/kWh_Quebec_Logo-02_-_Rectangle_1764799021536.png";
import installationPhoto from "@assets/dynamic-teamwork-solar-energy-diverse-technicians-installing-p_1764967501352.jpg";
import roofMeasurement from "@assets/generated_images/commercial_roof_solar_potential_overlay.png";
import heroRoofAnalysis from "@assets/generated_images/industrial_roof_solar_potential_overlay.png";
import heroCashflow from "@assets/Screenshot_2025-12-07_at_10.53.40_AM_1765122823607.png";
import screenshotSystemEn from "@assets/Screenshot_2025-12-05_at_4.07.23_PM_1764968848494.png";
import screenshotFinancialEn from "@assets/Screenshot_2025-12-05_at_4.07.42_PM_1764968865040.png";
import screenshotOptimizationEn from "@assets/Screenshot_2025-12-05_at_4.07.56_PM_1764968884930.png";
import screenshotConsumptionEn from "@assets/Screenshot_2025-12-05_at_1.50.45_PM_1764960649956.png";
import screenshotConsumptionFr from "@assets/Screenshot_2025-12-04_at_6.51.04_PM_1764892267879.png";
import screenshotOptimizationFr from "@assets/Screenshot_2025-12-03_at_4.09.24_PM_1764796169826.png";
import screenshotFinancialFr from "@assets/Screenshot_2025-12-05_at_2.24.54_PM_1764963093938.png";

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
    roof?: { areaM2: number; maxCapacityKW: number };
  } | null>(null);
  const [calcError, setCalcError] = useState<string>("");
  
  const currentLogo = language === "fr" ? logoFr : logoEn;
  
  const analysisSlides = language === "fr" 
    ? [
        { id: "consumption", image: screenshotConsumptionFr, label: "Profil de consommation" },
        { id: "optimization", image: screenshotOptimizationFr, label: "Analyse d'optimisation" },
        { id: "financial", image: screenshotFinancialFr, label: "Options de financement" },
      ]
    : [
        { id: "consumption", image: screenshotConsumptionEn, label: "Consumption Profile" },
        { id: "system", image: screenshotSystemEn, label: "Recommended System" },
        { id: "financial", image: screenshotFinancialEn, label: "Financial Breakdown" },
        { id: "optimization", image: screenshotOptimizationEn, label: "Optimization Analysis" },
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

  return (
    <div className="min-h-screen bg-background">
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
              <a href="#credibility" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-trust">
                {language === "fr" ? "Confiance" : "Trust"}
              </a>
              <a href="#contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-contact">
                {t("footer.contact")}
              </a>
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

      {/* ========== HERO SECTION - COMPACT ========== */}
      <section className="relative pt-24 pb-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />
        <div className="absolute top-20 right-0 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl opacity-50" />
        
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div 
            className="space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.15]">
                {t("landing.hero.title")}
              </h1>
              <p className="text-xl sm:text-2xl text-primary font-semibold">
                {t("landing.hero.subtitle")}
              </p>
            </div>
            
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {language === "fr" 
                ? "Choisissez le niveau d'analyse adapté à vos besoins"
                : "Choose the analysis level that fits your needs"
              }
            </p>

            {/* Trust badges - compact */}
            <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2 pt-2">
              <div className="flex items-center gap-2" data-testid="badge-trust-certified">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-sm text-muted-foreground">{t("landing.trust.certified")}</span>
              </div>
              <div className="flex items-center gap-2" data-testid="badge-trust-experience">
                <Award className="w-4 h-4 text-primary" />
                <span className="text-sm text-muted-foreground">{t("landing.trust.experience")}</span>
              </div>
              <div className="flex items-center gap-2" data-testid="badge-trust-datadriven">
                <BarChart3 className="w-4 h-4 text-primary" />
                <span className="text-sm text-muted-foreground">{t("landing.trust.datadriven")}</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ========== TWO PATHWAYS SECTION ========== */}
      <section id="paths" className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-6">
            
            {/* ===== PATH 1: QUICK ANALYSIS (5 min) ===== */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className={quickPathExpanded ? "lg:col-span-2" : ""}
            >
              <Card className={`overflow-hidden border-2 transition-all ${quickPathExpanded ? 'border-primary' : 'border-primary/30'}`}>
                {/* Header - Always visible */}
                <div 
                  className={`p-6 cursor-pointer ${!quickPathExpanded ? 'hover-elevate' : ''}`}
                  onClick={() => {
                    if (!quickPathExpanded) {
                      setQuickPathExpanded(true);
                      setDetailedPathExpanded(false);
                    }
                  }}
                  data-testid="section-quick-header"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-primary/10 shrink-0">
                        <Timer className="w-7 h-7 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-xl font-bold">
                            {language === "fr" ? "Analyse Rapide" : "Quick Analysis"}
                          </h3>
                          <Badge className="bg-primary/10 text-primary border-primary/20">
                            5 min
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
                            
                            {/* Roof preview image */}
                            <div className="pt-2">
                              <img 
                                src={roofMeasurement} 
                                alt={language === "fr" ? "Exemple d'analyse de toit" : "Roof analysis example"}
                                className="w-full h-32 object-cover rounded-lg border"
                              />
                              <p className="text-xs text-muted-foreground mt-1 text-center">
                                {language === "fr" ? "Exemple d'analyse satellite" : "Example satellite analysis"}
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
                                  
                                  <div className="grid sm:grid-cols-2 gap-4">
                                    <div className="bg-background rounded-lg p-3 border">
                                      <p className="text-xs text-muted-foreground mb-1">
                                        {language === "fr" ? "Système recommandé" : "Recommended system"}
                                      </p>
                                      <p className="text-xl font-bold text-primary">
                                        {calcResults.system.sizeKW.toFixed(0)} kW
                                      </p>
                                    </div>
                                    
                                    <div className="bg-background rounded-lg p-3 border">
                                      <p className="text-xs text-muted-foreground mb-1">
                                        {language === "fr" ? "Production annuelle" : "Annual production"}
                                      </p>
                                      <p className="text-xl font-bold">
                                        {(calcResults.system.annualProductionKWh / 1000).toFixed(0)} MWh
                                      </p>
                                    </div>
                                    
                                    <div className="bg-background rounded-lg p-3 border">
                                      <p className="text-xs text-muted-foreground mb-1">
                                        {language === "fr" ? "Économies annuelles" : "Annual savings"}
                                      </p>
                                      <p className="text-xl font-bold text-green-600">
                                        ${calcResults.financial.annualSavings.toLocaleString()}
                                      </p>
                                    </div>
                                    
                                    <div className="bg-background rounded-lg p-3 border">
                                      <p className="text-xs text-muted-foreground mb-1">
                                        {language === "fr" ? "Retour sur investissement" : "Payback period"}
                                      </p>
                                      <p className="text-xl font-bold">
                                        {calcResults.financial.paybackYears.toFixed(1)} {language === "fr" ? "ans" : "years"}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm font-medium">
                                        {language === "fr" ? "Incitatif Hydro-Québec" : "Hydro-Québec incentive"}
                                      </span>
                                      <span className="text-lg font-bold text-primary">
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
                                  <a href="#contact" className="flex-1">
                                    <Button className="w-full gap-2">
                                      {language === "fr" ? "Obtenir une analyse détaillée" : "Get detailed analysis"}
                                      <ArrowRight className="w-4 h-4" />
                                    </Button>
                                  </a>
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
                <Card className={`overflow-hidden border-2 transition-all ${detailedPathExpanded ? 'border-accent' : 'border-accent/30'}`}>
                  {/* Header - Always visible */}
                  <div 
                    className={`p-6 cursor-pointer ${!detailedPathExpanded ? 'hover-elevate' : ''}`}
                    onClick={() => {
                      if (!detailedPathExpanded) {
                        setDetailedPathExpanded(true);
                        setQuickPathExpanded(false);
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-xl font-bold">
                              {language === "fr" ? "Analyse Détaillée" : "Detailed Analysis"}
                            </h3>
                            <Badge className="bg-accent/10 text-accent border-accent/20">
                              5 {language === "fr" ? "jours" : "days"}
                            </Badge>
                            <Badge variant="outline" className="text-muted-foreground">
                              ~95% {language === "fr" ? "précision" : "accuracy"}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground mt-1">
                            {language === "fr" 
                              ? "Analyse complète basée sur vos données réelles"
                              : "Complete analysis based on your real data"
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
                                    <div key={item.step} className="flex items-center gap-3">
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
                            
                            {/* Right: Contact form */}
                            <div className="p-6 space-y-5">
                              <h4 className="font-semibold">
                                {language === "fr" ? "Demander mon analyse" : "Request my analysis"}
                              </h4>
                              
                              {!submitted ? (
                                <Form {...form}>
                                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                    <div className="grid sm:grid-cols-2 gap-4">
                                      <FormField
                                        control={form.control}
                                        name="companyName"
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>{t("form.companyName")}</FormLabel>
                                            <FormControl>
                                              <Input {...field} data-testid="input-company" />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                      <FormField
                                        control={form.control}
                                        name="contactName"
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>{t("form.contactName")}</FormLabel>
                                            <FormControl>
                                              <Input {...field} data-testid="input-contact" />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                    </div>
                                    
                                    <div className="grid sm:grid-cols-2 gap-4">
                                      <FormField
                                        control={form.control}
                                        name="email"
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>{t("form.email")}</FormLabel>
                                            <FormControl>
                                              <Input type="email" {...field} data-testid="input-email" />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                      <FormField
                                        control={form.control}
                                        name="phone"
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>{t("form.phone")}</FormLabel>
                                            <FormControl>
                                              <Input type="tel" {...field} data-testid="input-phone" />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                    </div>
                                    
                                    <FormField
                                      control={form.control}
                                      name="streetAddress"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>{language === "fr" ? "Adresse du bâtiment" : "Building address"}</FormLabel>
                                          <FormControl>
                                            <Input {...field} data-testid="input-address" />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    
                                    <div className="grid sm:grid-cols-2 gap-4">
                                      <FormField
                                        control={form.control}
                                        name="city"
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>{t("form.city")}</FormLabel>
                                            <FormControl>
                                              <Input {...field} data-testid="input-city" />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                      <FormField
                                        control={form.control}
                                        name="estimatedMonthlyBill"
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>{t("form.monthlyBill")}</FormLabel>
                                            <FormControl>
                                              <Input 
                                                type="number" 
                                                placeholder="$"
                                                {...field}
                                                data-testid="input-bill" 
                                              />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                    </div>
                                    
                                    <Button 
                                      type="submit" 
                                      size="lg" 
                                      className="w-full gap-2 bg-accent text-accent-foreground"
                                      disabled={mutation.isPending}
                                      data-testid="button-submit-detailed"
                                    >
                                      {mutation.isPending ? (
                                        <>
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                          {language === "fr" ? "Envoi en cours..." : "Sending..."}
                                        </>
                                      ) : (
                                        <>
                                          {language === "fr" ? "Demander mon analyse détaillée" : "Request my detailed analysis"}
                                          <ArrowRight className="w-4 h-4" />
                                        </>
                                      )}
                                    </Button>
                                    
                                    <p className="text-xs text-muted-foreground text-center">
                                      {language === "fr" 
                                        ? "Nous vous contacterons dans les 24h pour les prochaines étapes"
                                        : "We'll contact you within 24h for the next steps"
                                      }
                                    </p>
                                  </form>
                                </Form>
                              ) : (
                                <div className="text-center py-8 space-y-4">
                                  <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                                  </div>
                                  <h4 className="text-xl font-bold">
                                    {language === "fr" ? "Demande reçue!" : "Request received!"}
                                  </h4>
                                  <p className="text-muted-foreground">
                                    {language === "fr" 
                                      ? "Notre équipe vous contactera dans les 24 heures."
                                      : "Our team will contact you within 24 hours."
                                    }
                                  </p>
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
            {/* HQ Partner Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <Card className="p-6 h-full">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Zap className="w-7 h-7 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-lg">{t("landing.trust.partner.hq")}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t("landing.trust.partner.hqDesc")}
                    </p>
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

      {/* ========== FINAL CTA / CONTACT SECTION ========== */}
      <section id="contact" className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Card className="p-8 text-center space-y-6 border-2">
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
            
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/login" className="hover:text-foreground transition-colors">
                {t("nav.login")}
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
