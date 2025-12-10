import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { 
  FileBarChart, Building2, Factory, School, HelpCircle, 
  CheckCircle2, ArrowRight, BarChart3, Zap, Clock, DollarSign,
  TrendingUp, Shield, Award, Target, FileSignature, Wrench, HardHat,
  Timer, Rocket, BatteryCharging, BadgePercent, Calculator, MapPin,
  Sun, Battery, FileText, Hammer
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

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

const analysisSlidesEn = [
  { id: "consumption", image: screenshotConsumptionEn, label: "Consumption Profile" },
  { id: "system", image: screenshotSystemEn, label: "Recommended System" },
  { id: "financial", image: screenshotFinancialEn, label: "Financial Breakdown" },
  { id: "optimization", image: screenshotOptimizationEn, label: "Optimization Analysis" },
];

const analysisSlidesFr = [
  { id: "consumption", image: screenshotConsumptionFr, label: "Profil de consommation" },
  { id: "optimization", image: screenshotOptimizationFr, label: "Analyse d'optimisation" },
  { id: "financial", image: screenshotFinancialFr, label: "Options de financement" },
];

export default function LandingPage() {
  const { t, language } = useI18n();
  const [submitted, setSubmitted] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [calcBill, setCalcBill] = useState<number>(5000);
  const [calcShowResults, setCalcShowResults] = useState(false);
  const currentLogo = language === "fr" ? logoFr : logoEn;
  const analysisSlides = language === "fr" ? analysisSlidesFr : analysisSlidesEn;
  
  // Quick calculator estimates (conservative values)
  const estimatedSavings = Math.round(calcBill * 0.35 * 12); // ~35% annual savings
  const estimatedSystemSize = Math.round(calcBill / 8); // Rough kW estimate
  const estimatedPayback = 6; // Conservative payback period
  
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
              <a href="#why-now" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-why-now">
                {t("landing.whyNow.title")}
              </a>
              <a href="#process" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-process">
                {t("landing.process.title")}
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

      {/* ========== HERO SECTION ========== */}
      <section className="relative pt-24 pb-20 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />
        <div className="absolute top-20 right-0 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl opacity-50" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-amber-500/10 rounded-full blur-3xl opacity-30" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <motion.div 
              className="space-y-8"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="space-y-4">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.15]">
                  {t("landing.hero.title")}
                </h1>
                <p className="text-xl sm:text-2xl text-primary font-semibold">
                  {t("landing.hero.subtitle")}
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <a href="#contact">
                  <Button size="lg" className="gap-2 text-base px-8" data-testid="button-hero-cta">
                    {t("landing.hero.cta")}
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </a>
              </div>

              {/* Trust badges */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  <span className="text-sm text-muted-foreground">{t("landing.trust.certified")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary" />
                  <span className="text-sm text-muted-foreground">{t("landing.trust.experience")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  <span className="text-sm text-muted-foreground">{t("landing.trust.datadriven")}</span>
                </div>
              </div>
            </motion.div>

            {/* Hero Image Grid - What your analysis includes */}
            <motion.div 
              className="relative"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="relative">
                {/* Decorative ring */}
                <div className="absolute -inset-4 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent rounded-3xl" />
                
                <div className="relative space-y-3 p-4">
                  <p className="text-sm font-medium text-muted-foreground text-center uppercase tracking-wider">
                    {language === "fr" ? "Ce que vous découvrirez" : "What you'll discover"}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <motion.div 
                      className="bg-card border rounded-xl overflow-hidden hover-elevate"
                      whileHover={{ scale: 1.02 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <img 
                        src={heroRoofAnalysis} 
                        alt={language === "fr" ? "Analyse du toit" : "Roof analysis"} 
                        className="w-full h-24 object-cover"
                      />
                      <div className="p-2 text-center">
                        <span className="text-xs font-medium text-muted-foreground">
                          {language === "fr" ? "Analyse du toit" : "Roof Analysis"}
                        </span>
                      </div>
                    </motion.div>
                    
                    <motion.div 
                      className="bg-card border rounded-xl overflow-hidden hover-elevate"
                      whileHover={{ scale: 1.02 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <img 
                        src={language === "fr" ? screenshotConsumptionFr : screenshotConsumptionEn} 
                        alt={language === "fr" ? "Profil de consommation" : "Consumption profile"} 
                        className="w-full h-24 object-cover object-top"
                      />
                      <div className="p-2 text-center">
                        <span className="text-xs font-medium text-muted-foreground">
                          {language === "fr" ? "Profil de consommation" : "Consumption Profile"}
                        </span>
                      </div>
                    </motion.div>
                    
                    <motion.div 
                      className="bg-card border rounded-xl overflow-hidden hover-elevate"
                      whileHover={{ scale: 1.02 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <img 
                        src={language === "fr" ? screenshotOptimizationFr : screenshotOptimizationEn} 
                        alt={language === "fr" ? "Scénarios optimaux" : "Optimal scenarios"} 
                        className="w-full h-24 object-cover object-top"
                      />
                      <div className="p-2 text-center">
                        <span className="text-xs font-medium text-muted-foreground">
                          {language === "fr" ? "Scénarios optimaux" : "Optimal Scenarios"}
                        </span>
                      </div>
                    </motion.div>
                    
                    <motion.div 
                      className="bg-card border rounded-xl overflow-hidden hover-elevate"
                      whileHover={{ scale: 1.02 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <img 
                        src={heroCashflow} 
                        alt={language === "fr" ? "Comparaison financement" : "Financing comparison"} 
                        className="w-full h-24 object-cover object-center"
                      />
                      <div className="p-2 text-center">
                        <span className="text-xs font-medium text-muted-foreground">
                          {language === "fr" ? "Comparaison financement" : "Financing Comparison"}
                        </span>
                      </div>
                    </motion.div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ========== QUICK CALCULATOR SECTION ========== */}
      <section id="calculator" className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-primary/5 to-background">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-8"
          >
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">
              <Calculator className="w-3 h-3 mr-1" />
              {language === "fr" ? "Calculateur rapide" : "Quick Calculator"}
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">
              {language === "fr" ? "Estimez vos économies en 10 secondes" : "Estimate your savings in 10 seconds"}
            </h2>
            <p className="text-muted-foreground">
              {language === "fr" 
                ? "Entrez votre facture mensuelle d'électricité pour voir votre potentiel d'économies"
                : "Enter your monthly electricity bill to see your savings potential"
              }
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <Card className="p-6 lg:p-8 border-2 border-primary/20">
              <div className="grid md:grid-cols-2 gap-8 items-center">
                {/* Input side */}
                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-primary" />
                      {language === "fr" ? "Facture mensuelle moyenne" : "Average monthly bill"}
                    </label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={calcBill}
                        onChange={(e) => {
                          setCalcBill(Number(e.target.value) || 0);
                          setCalcShowResults(true);
                        }}
                        className="text-2xl font-bold h-14 pl-8"
                        placeholder="5000"
                        data-testid="input-calc-bill"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xl text-muted-foreground">$</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {language === "fr" 
                        ? "Moyenne pour bâtiments commerciaux: 3 000$ - 15 000$/mois"
                        : "Average for commercial buildings: $3,000 - $15,000/month"
                      }
                    </p>
                  </div>
                  
                  <a href="#contact">
                    <Button size="lg" className="w-full gap-2" data-testid="button-calc-cta">
                      {language === "fr" ? "Obtenir mon analyse détaillée" : "Get my detailed analysis"}
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </a>
                </div>

                {/* Results side */}
                <div className={`space-y-4 transition-opacity duration-300 ${calcShowResults ? 'opacity-100' : 'opacity-50'}`}>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-primary/10 text-center">
                      <p className="text-xs text-muted-foreground mb-1">
                        {language === "fr" ? "Économies annuelles" : "Annual savings"}
                      </p>
                      <p className="text-2xl font-bold text-primary">
                        ${estimatedSavings.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-accent/10 text-center">
                      <p className="text-xs text-muted-foreground mb-1">
                        {language === "fr" ? "Retour sur investissement" : "Payback period"}
                      </p>
                      <p className="text-2xl font-bold text-accent">
                        ~{estimatedPayback} {language === "fr" ? "ans" : "years"}
                      </p>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-muted text-center">
                    <p className="text-xs text-muted-foreground mb-1">
                      {language === "fr" ? "Taille système estimée" : "Estimated system size"}
                    </p>
                    <p className="text-xl font-bold">
                      ~{estimatedSystemSize} kW
                    </p>
                  </div>
                  <p className="text-xs text-center text-muted-foreground">
                    {language === "fr" 
                      ? "* Estimation préliminaire. L'analyse détaillée fournira des chiffres précis."
                      : "* Preliminary estimate. Detailed analysis will provide exact figures."
                    }
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* ========== PVCASE-STYLE WORKFLOW SECTION ========== */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">
              {language === "fr" ? "Notre processus d'analyse" : "Our Analysis Process"}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {language === "fr" 
                ? "Une méthodologie éprouvée en 5 étapes pour optimiser votre projet solaire"
                : "A proven 5-step methodology to optimize your solar project"
              }
            </p>
          </motion.div>

          {/* PVcase-style step cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              { 
                step: 1, 
                icon: MapPin, 
                title: language === "fr" ? "Analyse du toit" : "Roof Analysis",
                description: language === "fr" ? "Évaluation satellite et estimation de surface" : "Satellite evaluation and area estimation",
                color: "bg-blue-500"
              },
              { 
                step: 2, 
                icon: BarChart3, 
                title: language === "fr" ? "Profil énergétique" : "Energy Profile",
                description: language === "fr" ? "Analyse de vos données de consommation" : "Analysis of your consumption data",
                color: "bg-primary"
              },
              { 
                step: 3, 
                icon: Sun, 
                title: language === "fr" ? "Dimensionnement" : "System Sizing",
                description: language === "fr" ? "Optimisation PV + batterie" : "PV + battery optimization",
                color: "bg-amber-500"
              },
              { 
                step: 4, 
                icon: DollarSign, 
                title: language === "fr" ? "Analyse financière" : "Financial Analysis",
                description: language === "fr" ? "VAN, TRI et options de financement" : "NPV, IRR and financing options",
                color: "bg-green-500"
              },
              { 
                step: 5, 
                icon: FileText, 
                title: language === "fr" ? "Rapport détaillé" : "Detailed Report",
                description: language === "fr" ? "Document prêt pour la prise de décision" : "Document ready for decision-making",
                color: "bg-accent"
              },
            ].map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="p-4 h-full hover-elevate text-center relative overflow-visible">
                  {/* Step number badge */}
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full ${item.color} flex items-center justify-center shadow-lg`}>
                    <span className="text-sm font-bold text-white">{item.step}</span>
                  </div>
                  
                  {/* Connection line (hidden on mobile and last item) */}
                  {index < 4 && (
                    <div className="hidden md:block absolute top-4 -right-2 w-4 h-0.5 bg-gradient-to-r from-muted-foreground/30 to-transparent z-10" />
                  )}
                  
                  <div className="pt-4 space-y-3">
                    <div className={`w-12 h-12 mx-auto rounded-xl ${item.color}/10 flex items-center justify-center`}>
                      <item.icon className={`w-6 h-6`} style={{ color: item.color.replace('bg-', '').includes('-') ? undefined : 'currentColor' }} />
                    </div>
                    <h3 className="font-semibold text-sm">{item.title}</h3>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            className="mt-8 text-center"
          >
            <a href="#contact">
              <Button size="lg" className="gap-2">
                {language === "fr" ? "Démarrer mon analyse gratuite" : "Start my free analysis"}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </a>
          </motion.div>
        </div>
      </section>

      {/* ========== WHY NOW SECTION ========== */}
      <section id="why-now" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">{t("landing.whyNow.title")}</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t("landing.whyNow.subtitle")}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { 
                icon: Zap, 
                title: t("landing.whyNow.hq.title"), 
                description: t("landing.whyNow.hq.description"),
                color: "text-primary",
                bg: "bg-primary/10",
                url: "https://www.hydroquebec.com/autoproduction/"
              },
              { 
                icon: BadgePercent, 
                title: t("landing.whyNow.federal.title"), 
                description: t("landing.whyNow.federal.description"),
                color: "text-accent",
                bg: "bg-accent/10",
                url: "https://natural-resources.canada.ca/climate-change/clean-energy-investment-tax-credits/clean-technology-investment-tax-credit/51492"
              },
              { 
                icon: TrendingUp, 
                title: t("landing.whyNow.fiscal.title"), 
                description: t("landing.whyNow.fiscal.description"),
                color: "text-primary",
                bg: "bg-primary/10",
                url: "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/sole-proprietorships-partnerships/report-business-income-expenses/claiming-capital-cost-allowance/classes-depreciable-property.html"
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="block h-full">
                  <Card className="h-full hover-elevate border-2 border-transparent hover:border-primary/20 transition-colors cursor-pointer">
                    <CardContent className="p-6 space-y-4">
                      <div className={`w-14 h-14 rounded-2xl ${item.bg} flex items-center justify-center`}>
                        <item.icon className={`w-7 h-7 ${item.color}`} />
                      </div>
                      <h3 className="text-xl font-semibold">{item.title}</h3>
                      <p className="text-muted-foreground">{item.description}</p>
                    </CardContent>
                  </Card>
                </a>
              </motion.div>
            ))}
          </div>

          {/* Urgency banner */}
          <motion.div 
            className="mt-12 p-6 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 border border-primary/20"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <Timer className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-lg">{t("landing.whyNow.deadline")}</p>
                  <p className="text-muted-foreground text-sm">
                    {language === "fr" 
                      ? "Profitez de ces programmes maintenant avant qu'il ne soit trop tard"
                      : "Take advantage of these programs now before it's too late"
                    }
                  </p>
                </div>
              </div>
              <a href="#contact">
                <Button size="lg" className="gap-2">
                  {t("landing.hero.cta")}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ========== PROCESS SECTION - PROGRESS PATH ========== */}
      <section id="process" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">{t("landing.process.title")}</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t("landing.process.subtitle")}
            </p>
          </motion.div>

          {/* Step 1 - Hero Focus (80%) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12"
          >
            <Card className="relative overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-background to-background">
              <CardContent className="p-6 lg:p-8">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                  {/* You are here marker */}
                  <div className="flex items-center gap-4">
                    <div className="relative flex-shrink-0">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
                        <span className="text-2xl font-bold text-white">1</span>
                      </div>
                      <div className="absolute -inset-2 rounded-full bg-primary/20" />
                      <div className="absolute -inset-2 rounded-full border-2 border-primary/20" />
                    </div>
                    <div className="hidden sm:block">
                      <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">
                        <Target className="w-3 h-3 mr-1" />
                        {t("landing.process.youAreHere")}
                      </Badge>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl lg:text-2xl font-bold">{t("landing.step1.title")}</h3>
                      <Badge variant="secondary" className="text-xs">
                        <Clock className="w-3 h-3 mr-1" />
                        {t("landing.step1.time")}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground">
                      {t("landing.step1.highlight")}
                    </p>
                  </div>

                  {/* CTA */}
                  <a href="#contact" className="flex-shrink-0">
                    <Button size="lg" className="gap-2" data-testid="button-step1-cta">
                      {t("landing.hero.cta")}
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Steps 2-5 - Compact Progress Path (20%) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <div className="text-center mb-6">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {t("landing.process.nextSteps")}
              </p>
            </div>

            {/* Progress Path - Horizontal Timeline */}
            <div className="relative">
              {/* Connecting line - Desktop */}
              <div className="hidden md:block absolute top-6 left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-accent via-primary to-accent opacity-30" />

              {/* Step Milestones */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4 relative">
                {[
                  { step: 2, icon: FileSignature, title: t("landing.step2.title"), time: t("landing.step2.time"), color: "bg-accent" },
                  { step: 3, icon: BarChart3, title: t("landing.step3.title"), time: t("landing.step3.time"), color: "bg-primary" },
                  { step: 4, icon: Wrench, title: t("landing.step4.title"), time: t("landing.step4.time"), color: "bg-primary/70" },
                  { step: 5, icon: HardHat, title: t("landing.step5.title"), time: t("landing.step5.time"), color: "bg-accent" },
                ].map((item, index) => (
                  <motion.div
                    key={item.step}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="flex flex-col items-center text-center"
                  >
                    {/* Numbered circle */}
                    <div className={`w-12 h-12 rounded-full ${item.color} flex items-center justify-center shadow-md mb-2 relative z-10`}>
                      <span className="text-lg font-bold text-white">{item.step}</span>
                    </div>
                    
                    <h4 className="font-medium text-sm leading-tight">{item.title}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.time}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Final destination */}
            <div className="flex justify-center mt-6">
              <Badge variant="outline" className="gap-1.5 py-1.5 px-3">
                <CheckCircle2 className="w-4 h-4 text-accent" />
                <span className="text-sm">
                  {language === "fr" ? "Système solaire en opération" : "Solar system in operation"}
                </span>
              </Badge>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ========== ANALYSIS PREVIEW SECTION - SPLIT INTO 2 PARTS ========== */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
              {language === "fr" ? "Aperçu de votre analyse" : "Preview of Your Analysis"}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {language === "fr" 
                ? "Un processus en deux temps pour une analyse complète"
                : "A two-step process for a complete analysis"
              }
            </p>
          </motion.div>

          {/* Step 1 - Instant Results */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                <span className="text-lg font-bold text-white">1</span>
              </div>
              <div>
                <h3 className="text-xl font-bold">
                  {language === "fr" ? "Ce que vous obtenez immédiatement" : "What you get immediately"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {language === "fr" ? "En quelques secondes après votre demande" : "Within seconds of your request"}
                </p>
              </div>
            </div>
            
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="grid md:grid-cols-2 gap-0">
                  <div className="relative aspect-[4/3] md:aspect-auto">
                    <img 
                      src={roofMeasurement} 
                      alt={language === "fr" ? "Analyse du toit avec mesures" : "Roof analysis with measurements"}
                      className="w-full h-full object-cover"
                      data-testid="img-roof-measurement"
                    />
                  </div>
                  <div className="p-6 lg:p-8 flex flex-col justify-center space-y-4">
                    <h4 className="text-lg font-semibold">
                      {language === "fr" ? "Estimation instantanée du potentiel" : "Instant potential estimate"}
                    </h4>
                    <ul className="space-y-3">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">
                          {language === "fr" ? "Surface utilisable de votre toiture" : "Usable roof surface area"}
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">
                          {language === "fr" ? "Capacité PV estimée en kW" : "Estimated PV capacity in kW"}
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">
                          {language === "fr" ? "Production annuelle approximative" : "Approximate annual production"}
                        </span>
                      </li>
                    </ul>
                    <a href="#contact">
                      <Button className="gap-2 mt-2">
                        {t("landing.hero.cta")}
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Step 2/3 - Full Analysis after HQ data */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                <span className="text-lg font-bold text-accent-foreground">2</span>
              </div>
              <div>
                <h3 className="text-xl font-bold">
                  {language === "fr" ? "Ce que vous obtenez après accès aux données HQ" : "What you get after HQ data access"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {language === "fr" ? "Après signature de la procuration Hydro-Québec (48h)" : "After signing the Hydro-Québec proxy (48h)"}
                </p>
              </div>
            </div>
            
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="grid md:grid-cols-2 gap-0">
                  <div className="p-6 lg:p-8 flex flex-col justify-center space-y-4 order-2 md:order-1">
                    <h4 className="text-lg font-semibold">
                      {language === "fr" ? "Analyse détaillée personnalisée" : "Personalized detailed analysis"}
                    </h4>
                    <ul className="space-y-3">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">
                          {language === "fr" ? "Simulation 8 760h basée sur votre consommation réelle" : "8,760h simulation based on your real consumption"}
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">
                          {language === "fr" ? "Dimensionnement optimal solaire + stockage" : "Optimal solar + storage sizing"}
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">
                          {language === "fr" ? "Projections financières sur 25 ans (VAN, TRI, LCOE)" : "25-year financial projections (NPV, IRR, LCOE)"}
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">
                          {language === "fr" ? "Comparaison des options de financement" : "Financing options comparison"}
                        </span>
                      </li>
                    </ul>
                  </div>
                  <div className="relative aspect-[4/3] md:aspect-auto order-1 md:order-2 bg-card">
                    <div className="relative h-full overflow-hidden">
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
                            data-testid={`img-analysis-${slide.id}`}
                          />
                        </div>
                      ))}
                    </div>
                    {/* Slide label */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                      <p className="text-white text-sm font-medium">
                        {analysisSlides[activeSlide]?.label}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Carousel dots */}
            <div className="flex justify-center gap-2 mt-4">
              {analysisSlides.map((slide, index) => (
                <button
                  key={slide.id}
                  onClick={() => setActiveSlide(index)}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    index === activeSlide ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                  data-testid={`button-slide-${slide.id}`}
                />
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ========== BENEFITS SECTION ========== */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">{t("landing.benefits.title")}</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t("landing.benefits.subtitle")}
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { 
                title: t("landing.benefits.analysis"), 
                description: t("landing.benefits.analysisDesc"),
                icon: BarChart3,
                color: "text-primary",
                bg: "bg-primary/10"
              },
              { 
                title: t("landing.benefits.financial"), 
                description: t("landing.benefits.financialDesc"),
                icon: TrendingUp,
                color: "text-accent",
                bg: "bg-accent/10"
              },
              { 
                title: t("landing.benefits.design"), 
                description: t("landing.benefits.designDesc"),
                icon: FileBarChart,
                color: "text-primary",
                bg: "bg-primary/10"
              },
              { 
                title: t("landing.benefits.installation"), 
                description: t("landing.benefits.installationDesc"),
                icon: Rocket,
                color: "text-accent",
                bg: "bg-accent/10"
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="p-6 hover-elevate h-full">
                  <div className={`w-12 h-12 rounded-xl ${item.bg} flex items-center justify-center mb-4`}>
                    <item.icon className={`w-6 h-6 ${item.color}`} />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== TRUST SECTION ========== */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t("landing.trust.title")}</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t("landing.trust.partners")}
            </p>
          </motion.div>

          <div className="max-w-2xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <Card className="p-8 hover-elevate">
                <div className="flex items-start gap-6">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Zap className="w-8 h-8 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-xl">{t("landing.trust.partner.hq")}</h3>
                    <p className="text-muted-foreground">
                      {t("landing.trust.partner.hqDesc")}
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ========== ABOUT US / TEAM SECTION ========== */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="relative rounded-2xl overflow-hidden">
              <img 
                src={installationPhoto} 
                alt={language === "fr" ? "Équipe d'installation de panneaux solaires" : "Solar panel installation team"}
                className="w-full h-64 md:h-80 object-cover"
                data-testid="img-installation-team"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
              <div className="absolute inset-0 flex items-center">
                <div className="p-6 md:p-10 max-w-xl">
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
                    {language === "fr" ? "Notre équipe" : "Our Team"}
                  </h2>
                  <p className="text-white/90 mb-4">
                    {language === "fr" 
                      ? "Des experts en énergie solaire au Québec. De la conception à la mise en service, notre équipe s'occupe de tout."
                      : "Solar energy experts in Québec. From design to commissioning, our team handles everything."
                    }
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30">
                      <Shield className="w-3 h-3 mr-1" />
                      {t("landing.trust.certified")}
                    </Badge>
                    <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30">
                      <Award className="w-3 h-3 mr-1" />
                      {t("landing.trust.experience")}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ========== AUTHORIZATION / POWER OF ATTORNEY SECTION ========== */}
      <section id="authorization" className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Card className="overflow-hidden border-2 border-accent/30 bg-gradient-to-br from-accent/5 via-background to-background">
              <CardContent className="p-6 lg:p-8">
                <div className="flex flex-col lg:flex-row gap-8 items-start">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-accent/10 text-accent border-accent/20 hover:bg-accent/10">
                        <FileSignature className="w-3 h-3 mr-1" />
                        {t("landing.auth.badge")}
                      </Badge>
                    </div>
                    
                    <h2 className="text-2xl lg:text-3xl font-bold">
                      {t("landing.auth.title")}
                    </h2>
                    
                    <p className="text-muted-foreground">
                      {t("landing.auth.subtitle")}
                    </p>
                    
                    <ul className="space-y-2 pt-2">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                        <span className="text-sm text-muted-foreground">{t("landing.auth.benefit1")}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                        <span className="text-sm text-muted-foreground">{t("landing.auth.benefit2")}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                        <span className="text-sm text-muted-foreground">{t("landing.auth.benefit3")}</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="w-full lg:w-auto flex flex-col items-center lg:items-end gap-4 pt-4 lg:pt-0">
                    <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center">
                      <FileSignature className="w-10 h-10 text-accent" />
                    </div>
                    
                    <Button 
                      size="lg" 
                      className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground"
                      onClick={() => {
                        window.open("mailto:info@kwhquebec.com?subject=Demande de procuration HQ&body=Bonjour,%0A%0AJe souhaite signer une procuration pour vous autoriser à accéder à mon profil de consommation Hydro-Québec.%0A%0ANom de l'entreprise:%0ANuméro de client HQ:%0ACourriel:%0ATéléphone:%0A%0AMerci", "_blank");
                      }}
                      data-testid="button-authorization-cta"
                    >
                      {t("landing.auth.cta")}
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                    
                    <p className="text-xs text-muted-foreground text-center max-w-xs">
                      {t("landing.auth.note")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* ========== CONTACT FORM SECTION ========== */}
      <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-5 gap-12">
            <motion.div 
              className="lg:col-span-2 space-y-6"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl sm:text-4xl font-bold">{t("landing.form.title")}</h2>
              <p className="text-lg text-muted-foreground">
                {t("landing.form.subtitle")}
              </p>
              
              <div className="space-y-4 pt-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">{t("landing.form.benefit1.title")}</div>
                    <div className="text-sm text-muted-foreground">{t("landing.form.benefit1.description")}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">{t("landing.form.benefit2.title")}</div>
                    <div className="text-sm text-muted-foreground">{t("landing.form.benefit2.description")}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">{t("landing.form.benefit3.title")}</div>
                    <div className="text-sm text-muted-foreground">{t("landing.form.benefit3.description")}</div>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div 
              className="lg:col-span-3"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <Card className="shadow-xl">
                <CardContent className="p-6 sm:p-8">
                  {submitted ? (
                    <motion.div 
                      className="text-center py-12 space-y-4"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                    >
                      <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-10 h-10 text-accent" />
                      </div>
                      <h3 className="text-2xl font-semibold">{t("form.success.title")}</h3>
                      <p className="text-muted-foreground max-w-md mx-auto">{t("form.success.message")}</p>
                    </motion.div>
                  ) : (
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid sm:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="companyName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("form.company")} *</FormLabel>
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
                                <FormLabel>{t("form.contact")} *</FormLabel>
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
                                <FormLabel>{t("form.email")} *</FormLabel>
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
                              <FormLabel>{t("form.streetAddress")} *</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder={language === "fr" ? "123 rue Exemple" : "123 Example Street"} 
                                  {...field} 
                                  data-testid="input-street-address"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid sm:grid-cols-3 gap-4">
                          <FormField
                            control={form.control}
                            name="city"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("form.city")} *</FormLabel>
                                <FormControl>
                                  <Input {...field} data-testid="input-city" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="province"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("form.province")}</FormLabel>
                                <FormControl>
                                  <Input {...field} data-testid="input-province" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="postalCode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("form.postalCode")}</FormLabel>
                                <FormControl>
                                  <Input 
                                    placeholder="G1A 1A1" 
                                    {...field} 
                                    data-testid="input-postal-code"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="estimatedMonthlyBill"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("form.monthlyBill")}</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  placeholder="5000" 
                                  {...field} 
                                  data-testid="input-monthly-bill"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="buildingType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("form.buildingType")}</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-building-type">
                                    <SelectValue placeholder={t("landing.form.select")} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {buildingTypes.map((type) => (
                                    <SelectItem key={type.value} value={type.value}>
                                      {type.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="notes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("form.notes")}</FormLabel>
                              <FormControl>
                                <Textarea 
                                  rows={3} 
                                  className="resize-none" 
                                  {...field} 
                                  data-testid="textarea-notes"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Button 
                          type="submit" 
                          size="lg" 
                          className="w-full gap-2"
                          disabled={mutation.isPending}
                          data-testid="button-submit-lead"
                        >
                          {mutation.isPending ? t("form.submitting") : t("form.submit")}
                          {!mutation.isPending && <ArrowRight className="w-4 h-4" />}
                        </Button>

                        <p className="text-xs text-muted-foreground text-center">
                          {t("landing.form.privacy")}
                        </p>
                      </form>
                    </Form>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t bg-card">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <img 
                src={currentLogo} 
                alt="kWh Québec" 
                className="h-12 w-auto"
                data-testid="logo-footer"
              />
              <div className="hidden sm:block text-sm text-muted-foreground">
                {t("landing.footer.tagline")}
              </div>
            </div>
            
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">{t("footer.privacy")}</a>
              <a href="#contact" className="hover:text-foreground transition-colors">{t("footer.contact")}</a>
            </div>

            <div className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} kWh Québec. {t("footer.rights")}.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
