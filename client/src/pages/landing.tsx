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
  TrendingUp, Shield, Award, Target,
  Timer, Rocket, BatteryCharging, BadgePercent
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

export default function LandingPage() {
  const { t, language } = useI18n();
  const [submitted, setSubmitted] = useState(false);
  const currentLogo = language === "fr" ? logoFr : logoEn;

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
              {/* Urgency badge */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Badge variant="secondary" className="px-4 py-2 text-sm bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800">
                  <Timer className="w-4 h-4 mr-2" />
                  {t("landing.whyNow.deadline")}
                </Badge>
              </motion.div>

              <div className="space-y-4">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
                  {t("landing.hero.title")}
                </h1>
                <p className="text-2xl sm:text-3xl text-primary font-semibold">
                  {t("landing.hero.subtitle")}
                </p>
                <p className="text-lg text-muted-foreground max-w-xl">
                  {t("landing.hero.description")}
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <a href="#contact">
                  <Button size="lg" className="gap-2 text-base px-8" data-testid="button-hero-cta">
                    {t("landing.hero.cta")}
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </a>
                <Link href="/login">
                  <Button variant="outline" size="lg" className="gap-2 text-base" data-testid="button-hero-secondary">
                    {t("landing.hero.ctaSecondary")}
                  </Button>
                </Link>
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

            {/* Hero Stats Grid */}
            <motion.div 
              className="relative"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="relative">
                {/* Decorative ring */}
                <div className="absolute -inset-4 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent rounded-3xl" />
                
                <div className="relative grid grid-cols-2 gap-4 p-4">
                  <motion.div 
                    className="bg-card border rounded-2xl p-6 space-y-3 hover-elevate"
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <FileBarChart className="w-6 h-6 text-primary" />
                    </div>
                    <div className="text-3xl font-bold">{t("landing.hero.stat1.value")}</div>
                    <div className="text-sm text-muted-foreground">{t("landing.hero.stat1.label")}</div>
                  </motion.div>
                  
                  <motion.div 
                    className="bg-card border rounded-2xl p-6 space-y-3 hover-elevate"
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                      <Clock className="w-6 h-6 text-amber-500" />
                    </div>
                    <div className="text-3xl font-bold">{t("landing.hero.stat2.value")}</div>
                    <div className="text-sm text-muted-foreground">{t("landing.hero.stat2.label")}</div>
                  </motion.div>
                  
                  <motion.div 
                    className="bg-card border rounded-2xl p-6 space-y-3 hover-elevate"
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-green-500" />
                    </div>
                    <div className="text-3xl font-bold">{t("landing.hero.stat3.value")}</div>
                    <div className="text-sm text-muted-foreground">{t("landing.hero.stat3.label")}</div>
                  </motion.div>
                  
                  <motion.div 
                    className="bg-card border rounded-2xl p-6 space-y-3 hover-elevate"
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <Rocket className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div className="text-3xl font-bold">{t("landing.hero.stat4.value")}</div>
                    <div className="text-sm text-muted-foreground">{t("landing.hero.stat4.label")}</div>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </div>
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

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { 
                icon: Zap, 
                title: t("landing.whyNow.hqPlan.title"), 
                description: t("landing.whyNow.hqPlan.description"),
                color: "text-blue-500",
                bg: "bg-blue-500/10"
              },
              { 
                icon: Target, 
                title: t("landing.whyNow.tender.title"), 
                description: t("landing.whyNow.tender.description"),
                color: "text-purple-500",
                bg: "bg-purple-500/10"
              },
              { 
                icon: BatteryCharging, 
                title: t("landing.whyNow.rebate.title"), 
                description: t("landing.whyNow.rebate.description"),
                color: "text-amber-500",
                bg: "bg-amber-500/10"
              },
              { 
                icon: BadgePercent, 
                title: t("landing.whyNow.federal.title"), 
                description: t("landing.whyNow.federal.description"),
                color: "text-green-500",
                bg: "bg-green-500/10"
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full hover-elevate border-2 border-transparent hover:border-primary/20 transition-colors">
                  <CardContent className="p-6 space-y-4">
                    <div className={`w-14 h-14 rounded-2xl ${item.bg} flex items-center justify-center`}>
                      <item.icon className={`w-7 h-7 ${item.color}`} />
                    </div>
                    <h3 className="text-xl font-semibold">{item.title}</h3>
                    <p className="text-muted-foreground">{item.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Urgency banner */}
          <motion.div 
            className="mt-12 p-6 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-amber-500/10 border border-primary/20"
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

      {/* ========== PROCESS SECTION ========== */}
      <section id="process" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">{t("landing.process.title")}</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t("landing.process.subtitle")}
            </p>
          </motion.div>

          <div className="relative">
            {/* Connection line */}
            <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-primary/50 via-primary to-primary/50 -translate-y-1/2" />
            
            <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
              {[
                { 
                  step: 1, 
                  icon: FileBarChart, 
                  title: t("landing.step1.title"), 
                  description: t("landing.step1.description"),
                  time: t("landing.step1.time"),
                  color: "from-blue-500 to-blue-600"
                },
                { 
                  step: 2, 
                  icon: BarChart3, 
                  title: t("landing.step2.title"), 
                  description: t("landing.step2.description"),
                  time: t("landing.step2.time"),
                  color: "from-primary to-primary"
                },
                { 
                  step: 3, 
                  icon: Rocket, 
                  title: t("landing.step3.title"), 
                  description: t("landing.step3.description"),
                  time: t("landing.step3.time"),
                  color: "from-green-500 to-green-600"
                },
              ].map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.15 }}
                  className="relative"
                >
                  <Card className="relative overflow-hidden hover-elevate h-full">
                    <CardContent className="p-8 space-y-4">
                      {/* Step number circle */}
                      <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-lg`}>
                        <item.icon className="w-8 h-8 text-white" />
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          {item.time}
                        </Badge>
                      </div>
                      
                      <h3 className="text-xl font-semibold">{item.title}</h3>
                      <p className="text-muted-foreground">{item.description}</p>
                    </CardContent>
                    
                    {/* Step number watermark */}
                    <div className="absolute top-4 right-4 text-6xl font-bold text-muted/10">
                      {item.step}
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ========== BENEFITS SECTION ========== */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
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
                color: "text-blue-500",
                bg: "bg-blue-500/10"
              },
              { 
                title: t("landing.benefits.financial"), 
                description: t("landing.benefits.financialDesc"),
                icon: TrendingUp,
                color: "text-green-500",
                bg: "bg-green-500/10"
              },
              { 
                title: t("landing.benefits.design"), 
                description: t("landing.benefits.designDesc"),
                icon: FileBarChart,
                color: "text-amber-500",
                bg: "bg-amber-500/10"
              },
              { 
                title: t("landing.benefits.installation"), 
                description: t("landing.benefits.installationDesc"),
                icon: Rocket,
                color: "text-emerald-500",
                bg: "bg-emerald-500/10"
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
                  <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center shrink-0">
                    <Zap className="w-8 h-8 text-blue-500" />
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
                      <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-10 h-10 text-green-500" />
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
