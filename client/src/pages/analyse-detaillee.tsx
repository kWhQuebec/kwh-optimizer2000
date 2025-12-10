import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { 
  ArrowLeft, ArrowRight, CheckCircle2, Clock, FileCheck, 
  Shield, Award, BarChart3, Building2, Mail, Phone, User,
  MapPin, DollarSign, FileText, Zap, Battery, Sun, Calendar
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

const detailedFormSchema = z.object({
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
  hqAccountNumber: z.string().optional(),
  notes: z.string().optional(),
});

type DetailedFormValues = z.infer<typeof detailedFormSchema>;

export default function AnalyseDetailleePage() {
  const { t, language } = useI18n();
  const [submitted, setSubmitted] = useState(false);
  const currentLogo = language === "fr" ? logoFr : logoEn;

  const form = useForm<DetailedFormValues>({
    resolver: zodResolver(detailedFormSchema),
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
      hqAccountNumber: "",
      notes: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: DetailedFormValues) => {
      const notesContent = data.notes?.trim() || "";
      const hqAccount = data.hqAccountNumber?.trim() || (language === "fr" ? "Non fourni" : "Not provided");
      const combinedNotes = `[Analyse Détaillée] ${notesContent}\n${language === "fr" ? "Numéro de compte HQ" : "HQ Account Number"}: ${hqAccount}`.trim();
      
      return apiRequest("POST", "/api/leads", {
        ...data,
        notes: combinedNotes,
      });
    },
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  const onSubmit = (data: DetailedFormValues) => {
    mutation.mutate(data);
  };

  const buildingTypes = [
    { value: "industrial", label: language === "fr" ? "Industriel" : "Industrial" },
    { value: "commercial", label: language === "fr" ? "Commercial" : "Commercial" },
    { value: "institutional", label: language === "fr" ? "Institutionnel" : "Institutional" },
    { value: "other", label: language === "fr" ? "Autre" : "Other" },
  ];

  const processSteps = [
    {
      icon: FileText,
      title: language === "fr" ? "1. Vous nous donnez accès" : "1. You give us access",
      description: language === "fr" 
        ? "Autorisez kWh Québec comme mandataire via votre Espace client HQ"
        : "Authorize kWh Québec as agent via your HQ Customer Space"
    },
    {
      icon: BarChart3,
      title: language === "fr" ? "2. On analyse vos données" : "2. We analyze your data",
      description: language === "fr"
        ? "Analyse 8760 heures de consommation + potentiel solaire"
        : "8760-hour consumption analysis + solar potential"
    },
    {
      icon: Sun,
      title: language === "fr" ? "3. Optimisation PV + batterie" : "3. PV + battery optimization",
      description: language === "fr"
        ? "Dimensionnement optimal selon votre profil énergétique"
        : "Optimal sizing based on your energy profile"
    },
    {
      icon: DollarSign,
      title: language === "fr" ? "4. Rapport financier complet" : "4. Complete financial report",
      description: language === "fr"
        ? "VAN, TRI, 3 options de financement, incitatifs"
        : "NPV, IRR, 3 financing options, incentives"
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b">
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
            
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Back link */}
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-6 gap-2" data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4" />
              {language === "fr" ? "Retour à l'accueil" : "Back to home"}
            </Button>
          </Link>

          {/* Hero section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <Badge className="mb-4 bg-accent/20 text-accent-foreground border-accent/30">
              <FileCheck className="w-3 h-3 mr-1" />
              {language === "fr" ? "Analyse premium" : "Premium analysis"}
            </Badge>
            <h1 className="text-3xl sm:text-4xl font-bold mb-4">
              {language === "fr" ? "Analyse Détaillée" : "Detailed Analysis"}
            </h1>
            <div className="flex items-center justify-center gap-4 text-muted-foreground mb-4">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>5 {language === "fr" ? "jours ouvrables" : "business days"}</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="font-medium text-foreground">95% {language === "fr" ? "précision" : "accuracy"}</span>
              </div>
            </div>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {language === "fr"
                ? "Basée sur vos données de consommation réelles Hydro-Québec pour une analyse optimale et personnalisée."
                : "Based on your real Hydro-Québec consumption data for an optimal and personalized analysis."
              }
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
            {/* Left column - Process explanation */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-6"
            >
              <Card className="p-6">
                <h2 className="text-xl font-bold mb-6">
                  {language === "fr" ? "Comment ça fonctionne" : "How it works"}
                </h2>
                <div className="space-y-6">
                  {processSteps.map((step, index) => (
                    <div key={index} className="flex gap-4">
                      <div className="p-2 rounded-lg bg-primary/10 h-fit">
                        <step.icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1">{step.title}</h3>
                        <p className="text-sm text-muted-foreground">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* What's included */}
              <Card className="p-6 bg-accent/5 border-accent/20">
                <h2 className="text-xl font-bold mb-4">
                  {language === "fr" ? "Ce qui est inclus" : "What's included"}
                </h2>
                <ul className="space-y-3">
                  {[
                    language === "fr" ? "Analyse complète 8760 heures de consommation" : "Complete 8760-hour consumption analysis",
                    language === "fr" ? "Simulation PV basée sur votre toiture réelle" : "PV simulation based on your actual roof",
                    language === "fr" ? "Optimisation batterie peak-shaving" : "Battery peak-shaving optimization",
                    language === "fr" ? "Calcul incitatifs HQ + fédéral (ITC 30%)" : "HQ + federal incentives calculation (ITC 30%)",
                    language === "fr" ? "Comparaison 3 options de financement" : "3 financing options comparison",
                    language === "fr" ? "Analyse de sensibilité multi-scénario" : "Multi-scenario sensitivity analysis",
                    language === "fr" ? "Rapport PDF prêt pour décision" : "Decision-ready PDF report",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </Card>

              {/* Trust badges */}
              <div className="flex flex-wrap items-center gap-4 pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="w-4 h-4 text-primary" />
                  <span>{language === "fr" ? "Données sécurisées" : "Secure data"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Award className="w-4 h-4 text-primary" />
                  <span>{language === "fr" ? "Analyse gratuite" : "Free analysis"}</span>
                </div>
              </div>
            </motion.div>

            {/* Right column - Form */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="p-6 lg:p-8 border-2 border-accent/30">
                {submitted ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-12"
                  >
                    <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                    </div>
                    <h3 className="text-2xl font-bold mb-3">
                      {language === "fr" ? "Demande reçue!" : "Request received!"}
                    </h3>
                    <p className="text-muted-foreground mb-6">
                      {language === "fr"
                        ? "Notre équipe vous contactera dans les 24h pour vous guider dans la configuration de l'accès à vos données HQ."
                        : "Our team will contact you within 24h to guide you through setting up access to your HQ data."
                      }
                    </p>
                    <Link href="/">
                      <Button data-testid="button-back-after-submit">
                        {language === "fr" ? "Retour à l'accueil" : "Back to home"}
                      </Button>
                    </Link>
                  </motion.div>
                ) : (
                  <>
                    <h2 className="text-xl font-bold mb-6">
                      {language === "fr" ? "Demandez votre analyse détaillée" : "Request your detailed analysis"}
                    </h2>
                    
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid sm:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="companyName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center gap-1">
                                  <Building2 className="w-3 h-3" />
                                  {language === "fr" ? "Entreprise" : "Company"} *
                                </FormLabel>
                                <FormControl>
                                  <Input {...field} data-testid="input-company-name" />
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
                                <FormLabel className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {language === "fr" ? "Nom du contact" : "Contact name"} *
                                </FormLabel>
                                <FormControl>
                                  <Input {...field} data-testid="input-contact-name" />
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
                                <FormLabel className="flex items-center gap-1">
                                  <Mail className="w-3 h-3" />
                                  {language === "fr" ? "Courriel" : "Email"} *
                                </FormLabel>
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
                                <FormLabel className="flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {language === "fr" ? "Téléphone" : "Phone"}
                                </FormLabel>
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
                              <FormLabel className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {language === "fr" ? "Adresse du bâtiment" : "Building address"} *
                              </FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  placeholder={language === "fr" ? "123 rue Principale" : "123 Main Street"}
                                  data-testid="input-address" 
                                />
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
                                <FormLabel>{language === "fr" ? "Ville" : "City"} *</FormLabel>
                                <FormControl>
                                  <Input {...field} data-testid="input-city" />
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
                                <FormLabel>{language === "fr" ? "Code postal" : "Postal code"}</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="H2X 1Y4" data-testid="input-postal-code" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="buildingType"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center gap-1">
                                  <Building2 className="w-3 h-3" />
                                  {language === "fr" ? "Type de bâtiment" : "Building type"}
                                </FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-building-type">
                                      <SelectValue placeholder={language === "fr" ? "Sélectionner..." : "Select..."} />
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
                            name="estimatedMonthlyBill"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center gap-1">
                                  <DollarSign className="w-3 h-3" />
                                  {language === "fr" ? "Facture mensuelle approx." : "Approx. monthly bill"}
                                </FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    {...field} 
                                    placeholder="5000"
                                    data-testid="input-monthly-bill" 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="hqAccountNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-1">
                                <Zap className="w-3 h-3" />
                                {language === "fr" ? "Numéro de compte HQ (optionnel)" : "HQ account number (optional)"}
                              </FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  placeholder={language === "fr" ? "Visible sur votre facture HQ" : "Visible on your HQ bill"}
                                  data-testid="input-hq-account" 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="notes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{language === "fr" ? "Notes additionnelles" : "Additional notes"}</FormLabel>
                              <FormControl>
                                <Textarea 
                                  {...field} 
                                  rows={3}
                                  placeholder={language === "fr" 
                                    ? "Informations supplémentaires sur votre projet..."
                                    : "Additional information about your project..."
                                  }
                                  data-testid="input-notes" 
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
                          data-testid="button-submit-detailed"
                        >
                          {mutation.isPending ? (
                            language === "fr" ? "Envoi en cours..." : "Sending..."
                          ) : (
                            <>
                              {language === "fr" ? "Soumettre ma demande" : "Submit my request"}
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </Button>

                        <p className="text-xs text-center text-muted-foreground">
                          {language === "fr"
                            ? "Nous vous contacterons dans les 24h pour configurer l'accès à vos données HQ."
                            : "We'll contact you within 24h to set up access to your HQ data."
                          }
                        </p>
                      </form>
                    </Form>
                  </>
                )}
              </Card>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}
