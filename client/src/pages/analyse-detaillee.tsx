import { useState, useCallback, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useDropzone } from "react-dropzone";
import useEmblaCarousel from "embla-carousel-react";
import { 
  ArrowLeft, ArrowRight, CheckCircle2, Clock, FileCheck, 
  Shield, Award, BarChart3, Building2, Mail, Phone, User,
  MapPin, DollarSign, FileText, Zap, Battery, Sun, Calendar,
  Upload, X, File, AlertCircle, FileSignature, ChevronLeft, ChevronRight, Image
} from "lucide-react";
import SignaturePad, { SignaturePadRef } from "@/components/signature-pad";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/lib/i18n";
import { apiRequest } from "@/lib/queryClient";
import logoFr from "@assets/kWh_Quebec_Logo-01_-_Rectangulaire_1764799021536.png";
import logoEn from "@assets/kWh_Quebec_Logo-02_-_Rectangle_1764799021536.png";

import carouselImg1Fr from "@assets/Screenshot_2025-12-11_at_9.14.32_PM_1765505832705.png";
import carouselImg2Fr from "@assets/Screenshot_2025-12-11_at_9.14.51_PM_1765505832704.png";
import carouselImg3Fr from "@assets/Screenshot_2025-12-11_at_9.15.03_PM_1765505832704.png";
import carouselImg4Fr from "@assets/Screenshot_2025-12-11_at_9.15.24_PM_1765505832703.png";
import carouselImg5Fr from "@assets/Screenshot_2025-12-11_at_9.15.38_PM_1765505832702.png";
import carouselImg6Fr from "@assets/Screenshot_2025-12-11_at_9.15.53_PM_1765505832701.png";
import carouselImg7Fr from "@assets/Screenshot_2025-12-11_at_9.16.06_PM_1765505832689.png";

const detailedFormSchema = z.object({
  companyName: z.string().min(1, "Ce champ est requis"),
  contactName: z.string().min(1, "Ce champ est requis"),
  signerTitle: z.string().min(1, "Ce champ est requis"),
  email: z.string().email("Courriel invalide"),
  phone: z.string().optional(),
  streetAddress: z.string().min(1, "Ce champ est requis"),
  city: z.string().min(1, "Ce champ est requis"),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  estimatedMonthlyBill: z.coerce.number().optional(),
  buildingType: z.string().optional(),
  hqAccountNumber: z.string().min(1, "Ce champ est requis"),
  signatureCity: z.string().min(1, "Ce champ est requis"),
  notes: z.string().optional(),
  procurationAccepted: z.boolean().refine(val => val === true, {
    message: "Vous devez accepter la procuration pour continuer"
  }),
});

type DetailedFormValues = z.infer<typeof detailedFormSchema>;

interface UploadedFile {
  file: File;
  preview: string;
}

const carouselSlides = [
  {
    image: carouselImg1Fr,
    titleFr: "Impact sur votre facture",
    titleEn: "Impact on your bill",
    descriptionFr: "Visualisez les économies annuelles sur votre facture Hydro-Québec",
    descriptionEn: "Visualize annual savings on your Hydro-Québec bill",
  },
  {
    image: carouselImg2Fr,
    titleFr: "Configuration optimale",
    titleEn: "Optimal configuration",
    descriptionFr: "Système dimensionné pour maximiser votre retour sur investissement",
    descriptionEn: "System sized to maximize your return on investment",
  },
  {
    image: carouselImg3Fr,
    titleFr: "Évolution sur 25 ans",
    titleEn: "25-year evolution",
    descriptionFr: "Suivez vos économies cumulatives année après année",
    descriptionEn: "Track your cumulative savings year after year",
  },
  {
    image: carouselImg4Fr,
    titleFr: "Options de financement",
    titleEn: "Financing options",
    descriptionFr: "Comparez comptant, prêt et crédit-bail sur 25 ans",
    descriptionEn: "Compare cash, loan and capital lease over 25 years",
  },
  {
    image: carouselImg5Fr,
    titleFr: "Profil énergétique",
    titleEn: "Energy profile",
    descriptionFr: "Analyse horaire avant/après avec production solaire",
    descriptionEn: "Hourly before/after analysis with solar production",
  },
  {
    image: carouselImg6Fr,
    titleFr: "Analyse d'optimisation",
    titleEn: "Optimization analysis",
    descriptionFr: "Frontière d'efficacité pour trouver la configuration optimale",
    descriptionEn: "Efficiency frontier to find the optimal configuration",
  },
  {
    image: carouselImg7Fr,
    titleFr: "Sensibilité système",
    titleEn: "System sensitivity",
    descriptionFr: "Optimisation taille solaire et stockage selon VAN",
    descriptionEn: "Solar and storage size optimization by NPV",
  },
];

export default function AnalyseDetailleePage() {
  const { t, language } = useI18n();
  const [submitted, setSubmitted] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [signatureStatus, setSignatureStatus] = useState<{sent: boolean; configured: boolean}>({ sent: false, configured: false });
  const [hasSignature, setHasSignature] = useState(false);
  const signaturePadRef = useRef<SignaturePadRef>(null);
  const currentLogo = language === "fr" ? logoFr : logoEn;

  const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);
  
  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedSlide(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on('select', onSelect);
    onSelect();
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, onSelect]);

  const form = useForm<DetailedFormValues>({
    resolver: zodResolver(detailedFormSchema),
    defaultValues: {
      companyName: "",
      contactName: "",
      signerTitle: "",
      email: "",
      phone: "",
      streetAddress: "",
      city: "",
      province: "Québec",
      postalCode: "",
      estimatedMonthlyBill: undefined,
      buildingType: "",
      hqAccountNumber: "",
      signatureCity: "",
      notes: "",
      procurationAccepted: false,
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setUploadError(null);
    
    const validFiles = acceptedFiles.filter(file => {
      const isValidType = file.type === 'application/pdf' || 
                          file.type.startsWith('image/');
      const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB max
      
      if (!isValidType) {
        setUploadError(language === "fr" 
          ? "Format invalide. Utilisez PDF ou image (JPG, PNG)." 
          : "Invalid format. Use PDF or image (JPG, PNG).");
        return false;
      }
      if (!isValidSize) {
        setUploadError(language === "fr" 
          ? "Fichier trop volumineux. Maximum 10 Mo." 
          : "File too large. Maximum 10 MB.");
        return false;
      }
      return true;
    });

    const newFiles = validFiles.map(file => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : ''
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);
  }, [language]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    },
    maxFiles: 5
  });

  const removeFile = (index: number) => {
    setUploadedFiles(prev => {
      const newFiles = [...prev];
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const mutation = useMutation({
    mutationFn: async (data: DetailedFormValues) => {
      const formData = new FormData();
      
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, String(value));
        }
      });

      formData.append('language', language);
      formData.append('procurationDate', new Date().toISOString());

      // Add signature image if available
      if (signaturePadRef.current && !signaturePadRef.current.isEmpty()) {
        const signatureDataUrl = signaturePadRef.current.toDataURL('image/png');
        formData.append('signatureImage', signatureDataUrl);
      }

      uploadedFiles.forEach((uploadedFile, index) => {
        formData.append(`billFile_${index}`, uploadedFile.file);
      });

      const response = await fetch('/api/detailed-analysis-request', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to submit');
      }

      const result = await response.json();

      return result;
    },
    onSuccess: () => {
      // Clean up object URLs
      uploadedFiles.forEach(f => {
        if (f.preview) URL.revokeObjectURL(f.preview);
      });
      setUploadedFiles([]);
      setSubmitted(true);
    },
  });

  const onSubmit = (data: DetailedFormValues) => {
    if (uploadedFiles.length === 0) {
      setUploadError(language === "fr" 
        ? "Veuillez téléverser au moins une facture HQ" 
        : "Please upload at least one HQ bill");
      return;
    }
    mutation.mutate(data);
  };

  const buildingTypes = [
    { value: "industrial", label: language === "fr" ? "Industriel" : "Industrial" },
    { value: "commercial", label: language === "fr" ? "Commercial" : "Commercial" },
    { value: "institutional", label: language === "fr" ? "Institutionnel" : "Institutional" },
    { value: "other", label: language === "fr" ? "Autre" : "Other" },
  ];

  const steps = [
    { 
      number: 1, 
      title: language === "fr" ? "Informations" : "Information",
      icon: Building2 
    },
    { 
      number: 2, 
      title: language === "fr" ? "Procuration" : "Authorization",
      icon: FileSignature 
    },
    { 
      number: 3, 
      title: language === "fr" ? "Facture HQ" : "HQ Bill",
      icon: FileText 
    },
  ];

  const procurationTextFr = `
Je soussigné(e), autorise par la présente kWh Québec inc. à agir en mon nom et pour mon compte auprès d'Hydro-Québec afin d'obtenir les informations relatives à ma consommation électrique, incluant mais sans s'y limiter:

• Les données de consommation horaires (intervalles de 15 minutes ou horaires)
• L'historique de facturation des 24 derniers mois
• Les informations sur mon contrat et tarif actuel
• Les données de puissance appelée

Cette procuration est valide pour une durée de 12 mois à compter de la date de signature et peut être révoquée en tout temps par écrit.

Les données obtenues seront utilisées exclusivement pour l'analyse du potentiel solaire et le dimensionnement d'un système photovoltaïque pour mon bâtiment.
  `.trim();

  const procurationTextEn = `
I, the undersigned, hereby authorize kWh Québec inc. to act on my behalf with Hydro-Québec to obtain information regarding my electrical consumption, including but not limited to:

• Hourly consumption data (15-minute or hourly intervals)
• Billing history for the past 24 months
• Information about my current contract and rate
• Demand power data

This authorization is valid for 12 months from the date of signature and may be revoked at any time in writing.

The data obtained will be used exclusively for solar potential analysis and photovoltaic system sizing for my building.
  `.trim();

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

  const canProceedToStep2 = () => {
    const values = form.getValues();
    return values.companyName && values.contactName && values.signerTitle && 
           values.hqAccountNumber && values.email && values.streetAddress && values.city;
  };

  const canProceedToStep3 = () => {
    const values = form.getValues();
    return values.procurationAccepted === true && values.signatureCity && values.signatureCity.length > 0;
  };

  return (
    <div className="min-h-screen bg-background">
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
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-6 gap-2" data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4" />
              {language === "fr" ? "Retour à l'accueil" : "Back to home"}
            </Button>
          </Link>

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

              <Card className="p-4 overflow-hidden">
                <div className="flex items-center gap-2 mb-4">
                  <Image className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">
                    {language === "fr" ? "Aperçu de l'analyse" : "Analysis preview"}
                  </h3>
                </div>
                <div className="relative">
                  <div className="overflow-hidden rounded-lg" ref={emblaRef}>
                    <div className="flex">
                      {carouselSlides.map((slide, index) => (
                        <div key={index} className="flex-[0_0_100%] min-w-0">
                          <div className="relative">
                            <img 
                              src={slide.image} 
                              alt={language === "fr" ? slide.titleFr : slide.titleEn}
                              className="w-full h-auto rounded-lg border"
                              data-testid={`carousel-image-${index}`}
                            />
                          </div>
                          <div className="mt-3 text-center">
                            <h4 className="font-medium text-sm">
                              {language === "fr" ? slide.titleFr : slide.titleEn}
                            </h4>
                            <p className="text-xs text-muted-foreground mt-1">
                              {language === "fr" ? slide.descriptionFr : slide.descriptionEn}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="absolute left-2 top-1/3 -translate-y-1/2 bg-background/80 backdrop-blur-sm"
                    onClick={scrollPrev}
                    data-testid="carousel-prev"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="absolute right-2 top-1/3 -translate-y-1/2 bg-background/80 backdrop-blur-sm"
                    onClick={scrollNext}
                    data-testid="carousel-next"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex justify-center gap-1.5 mt-4">
                  {carouselSlides.map((_, index) => (
                    <button
                      key={index}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        selectedSlide === index ? 'bg-primary' : 'bg-muted-foreground/30'
                      }`}
                      onClick={() => emblaApi?.scrollTo(index)}
                      data-testid={`carousel-dot-${index}`}
                    />
                  ))}
                </div>
              </Card>

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
                    className="text-center py-8"
                  >
                    <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                    </div>
                    <h3 className="text-2xl font-bold mb-3">
                      {language === "fr" ? "Demande complétée!" : "Request completed!"}
                    </h3>
                    
                    {/* Procuration signed confirmation */}
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6">
                      <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-2">
                        <FileSignature className="w-5 h-5" />
                        <span className="font-semibold">
                          {language === "fr" ? "Procuration signée" : "Authorization Signed"}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {language === "fr"
                          ? "Votre procuration a été signée électroniquement et enregistrée. Nous sommes maintenant autorisés à récupérer vos données de consommation Hydro-Québec."
                          : "Your authorization has been electronically signed and recorded. We are now authorized to retrieve your Hydro-Québec consumption data."
                        }
                      </p>
                    </div>

                    {/* Timeline explanation */}
                    <div className="bg-muted/50 border border-border rounded-lg p-4 mb-6 text-left">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary" />
                        {language === "fr" ? "Prochaines étapes" : "Next Steps"}
                      </h4>
                      <div className="space-y-3 text-sm">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-bold text-primary">1</span>
                          </div>
                          <div>
                            <p className="font-medium">
                              {language === "fr" ? "Accès Hydro-Québec (3 jours ouvrables)" : "Hydro-Québec Access (3 business days)"}
                            </p>
                            <p className="text-muted-foreground">
                              {language === "fr"
                                ? "Nous soumettons votre procuration à Hydro-Québec pour obtenir l'accès à vos données de consommation détaillées."
                                : "We submit your authorization to Hydro-Québec to gain access to your detailed consumption data."
                              }
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-bold text-primary">2</span>
                          </div>
                          <div>
                            <p className="font-medium">
                              {language === "fr" ? "Analyse complète (48h)" : "Complete Analysis (48h)"}
                            </p>
                            <p className="text-muted-foreground">
                              {language === "fr"
                                ? "Une fois les données reçues, notre équipe procède à l'analyse détaillée et prépare votre rapport personnalisé."
                                : "Once we receive the data, our team performs the detailed analysis and prepares your personalized report."
                              }
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-bold text-primary">3</span>
                          </div>
                          <div>
                            <p className="font-medium">
                              {language === "fr" ? "Rapport envoyé par courriel" : "Report Sent by Email"}
                            </p>
                            <p className="text-muted-foreground">
                              {language === "fr"
                                ? "Vous recevrez votre analyse détaillée avec recommandations de dimensionnement et projections financières."
                                : "You will receive your detailed analysis with sizing recommendations and financial projections."
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Calendly CTA for qualified prospects (>$5000/month) */}
                    {form.getValues("estimatedMonthlyBill") && form.getValues("estimatedMonthlyBill")! >= 5000 && (
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-6">
                        <div className="flex items-center gap-2 text-primary mb-2">
                          <Calendar className="w-5 h-5" />
                          <span className="font-semibold">
                            {language === "fr" ? "Présentation personnalisée" : "Personalized Presentation"}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          {language === "fr"
                            ? "Compte tenu de la taille de votre projet, nous vous invitons à planifier un appel de 30 minutes avec notre équipe pour vous présenter l'analyse en détail."
                            : "Given the size of your project, we invite you to schedule a 30-minute call with our team to present the analysis in detail."
                          }
                        </p>
                        <Button 
                          onClick={() => window.open("https://calendly.com/kwh-quebec/presentation-analyse", "_blank")}
                          className="w-full"
                          data-testid="button-schedule-presentation"
                        >
                          <Calendar className="w-4 h-4 mr-2" />
                          {language === "fr" ? "Planifier une présentation" : "Schedule a Presentation"}
                        </Button>
                      </div>
                    )}

                    <Link href="/">
                      <Button variant="outline" data-testid="button-back-after-submit">
                        {language === "fr" ? "Retour à l'accueil" : "Back to home"}
                      </Button>
                    </Link>
                  </motion.div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      {steps.map((step, index) => (
                        <div key={step.number} className="flex items-center">
                          <div 
                            className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors cursor-pointer ${
                              currentStep === step.number 
                                ? 'bg-primary border-primary text-primary-foreground' 
                                : currentStep > step.number
                                  ? 'bg-green-500 border-green-500 text-white'
                                  : 'border-muted-foreground/30 text-muted-foreground'
                            }`}
                            onClick={() => {
                              if (step.number < currentStep) setCurrentStep(step.number);
                            }}
                            data-testid={`step-indicator-${step.number}`}
                          >
                            {currentStep > step.number ? (
                              <CheckCircle2 className="w-5 h-5" />
                            ) : (
                              <step.icon className="w-5 h-5" />
                            )}
                          </div>
                          {index < steps.length - 1 && (
                            <div className={`w-8 sm:w-16 h-0.5 mx-1 ${
                              currentStep > step.number ? 'bg-green-500' : 'bg-muted-foreground/20'
                            }`} />
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="text-center mb-6">
                      <h2 className="text-lg font-semibold">
                        {steps[currentStep - 1].title}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {language === "fr" ? `Étape ${currentStep} de 3` : `Step ${currentStep} of 3`}
                      </p>
                    </div>
                    
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        {currentStep === 1 && (
                          <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="space-y-4"
                          >
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
                                      {language === "fr" ? "Nom du signataire" : "Signer name"} *
                                    </FormLabel>
                                    <FormControl>
                                      <Input {...field} data-testid="input-contact-name" placeholder={language === "fr" ? "Ex: Jean Tremblay" : "Ex: John Smith"} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                            
                            <div className="grid sm:grid-cols-2 gap-4">
                              <FormField
                                control={form.control}
                                name="signerTitle"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="flex items-center gap-1">
                                      <Award className="w-3 h-3" />
                                      {language === "fr" ? "Titre / Fonction" : "Title / Position"} *
                                    </FormLabel>
                                    <FormControl>
                                      <Input {...field} data-testid="input-signer-title" placeholder={language === "fr" ? "Ex: Président, DG, VP Finances..." : "Ex: President, CEO, VP Finance..."} />
                                    </FormControl>
                                    <FormDescription className="text-xs">
                                      {language === "fr" ? "Votre titre pour la procuration HQ" : "Your title for the HQ authorization"}
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="hqAccountNumber"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="flex items-center gap-1">
                                      <Zap className="w-3 h-3" />
                                      {language === "fr" ? "No de compte HQ" : "HQ Account No"} *
                                    </FormLabel>
                                    <FormControl>
                                      <Input {...field} data-testid="input-hq-account" placeholder={language === "fr" ? "Ex: 100142202" : "Ex: 100142202"} />
                                    </FormControl>
                                    <FormDescription className="text-xs">
                                      {language === "fr" ? "Trouvé sur votre facture Hydro-Québec" : "Found on your Hydro-Québec bill"}
                                    </FormDescription>
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

                            <div className="pt-4">
                              <Button 
                                type="button" 
                                className="w-full gap-2"
                                onClick={() => {
                                  if (canProceedToStep2()) {
                                    setCurrentStep(2);
                                  } else {
                                    form.trigger(['companyName', 'contactName', 'signerTitle', 'hqAccountNumber', 'email', 'streetAddress', 'city']);
                                  }
                                }}
                                data-testid="button-next-step-1"
                              >
                                {language === "fr" ? "Continuer" : "Continue"}
                                <ArrowRight className="w-4 h-4" />
                              </Button>
                            </div>
                          </motion.div>
                        )}

                        {currentStep === 2 && (
                          <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="space-y-4"
                          >
                            <div className="bg-muted/50 rounded-lg p-4 border">
                              <div className="flex items-start gap-3 mb-4">
                                <FileSignature className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                                <div>
                                  <h3 className="font-semibold mb-1">
                                    {language === "fr" ? "Procuration Hydro-Québec" : "Hydro-Québec Authorization"}
                                  </h3>
                                  <p className="text-sm text-muted-foreground">
                                    {language === "fr" 
                                      ? "Pour accéder à vos données de consommation détaillées, nous avons besoin de votre autorisation."
                                      : "To access your detailed consumption data, we need your authorization."
                                    }
                                  </p>
                                </div>
                              </div>
                              
                              <div className="bg-background rounded-md p-4 text-sm max-h-48 overflow-y-auto border">
                                <pre className="whitespace-pre-wrap font-sans">
                                  {language === "fr" ? procurationTextFr : procurationTextEn}
                                </pre>
                              </div>
                            </div>

                            <FormField
                              control={form.control}
                              name="signatureCity"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {language === "fr" ? "Signée à (ville)" : "Signed at (city)"} *
                                  </FormLabel>
                                  <FormControl>
                                    <Input 
                                      {...field} 
                                      placeholder={language === "fr" ? "Ex: Montréal" : "Ex: Montreal"}
                                      data-testid="input-signature-city" 
                                    />
                                  </FormControl>
                                  <FormDescription className="text-xs">
                                    {language === "fr" 
                                      ? "Ville où vous signez ce document" 
                                      : "City where you are signing this document"
                                    }
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <div className="rounded-md border p-4 bg-primary/5 space-y-4">
                              <div className="space-y-1">
                                <h4 className="font-medium text-sm">
                                  {language === "fr" 
                                    ? "Signez ci-dessous pour accepter la procuration *"
                                    : "Sign below to accept the authorization *"
                                  }
                                </h4>
                                <p className="text-xs text-muted-foreground">
                                  {language === "fr"
                                    ? `Signature de ${form.getValues().contactName || 'le représentant'} pour ${form.getValues().companyName || 'l\'entreprise'}`
                                    : `Signature of ${form.getValues().contactName || 'representative'} for ${form.getValues().companyName || 'company'}`
                                  }
                                </p>
                              </div>
                              
                              <FormField
                                control={form.control}
                                name="procurationAccepted"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <div>
                                        <SignaturePad
                                          ref={signaturePadRef}
                                          width={500}
                                          height={150}
                                          onSignatureChange={(hasSig) => {
                                            setHasSignature(hasSig);
                                            field.onChange(hasSig);
                                          }}
                                          clearButtonText={language === "fr" ? "Effacer" : "Clear"}
                                          signedText={language === "fr" ? "Signature capturée" : "Signature captured"}
                                        />
                                      </div>
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            <div className="flex gap-3 pt-4">
                              <Button 
                                type="button" 
                                variant="outline"
                                className="flex-1"
                                onClick={() => setCurrentStep(1)}
                                data-testid="button-prev-step-2"
                              >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                {language === "fr" ? "Retour" : "Back"}
                              </Button>
                              <Button 
                                type="button" 
                                className="flex-1 gap-2"
                                onClick={() => {
                                  if (canProceedToStep3()) {
                                    setCurrentStep(3);
                                  } else {
                                    form.trigger(['procurationAccepted', 'signatureCity']);
                                  }
                                }}
                                data-testid="button-next-step-2"
                              >
                                {language === "fr" ? "Continuer" : "Continue"}
                                <ArrowRight className="w-4 h-4" />
                              </Button>
                            </div>
                          </motion.div>
                        )}

                        {currentStep === 3 && (
                          <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="space-y-4"
                          >
                            <div className="bg-muted/50 rounded-lg p-4 border">
                              <div className="flex items-start gap-3 mb-4">
                                <FileText className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                                <div>
                                  <h3 className="font-semibold mb-1">
                                    {language === "fr" ? "Facture Hydro-Québec" : "Hydro-Québec Bill"}
                                  </h3>
                                  <p className="text-sm text-muted-foreground">
                                    {language === "fr" 
                                      ? "Téléversez au moins une facture HQ datant de moins de 3 mois. Cela nous permet de valider votre numéro de compte."
                                      : "Upload at least one HQ bill from the last 3 months. This allows us to validate your account number."
                                    }
                                  </p>
                                </div>
                              </div>

                              <div
                                {...getRootProps()}
                                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                                  isDragActive 
                                    ? 'border-primary bg-primary/5' 
                                    : 'border-muted-foreground/30 hover:border-primary/50'
                                }`}
                                data-testid="dropzone-bill"
                              >
                                <input {...getInputProps()} />
                                <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                                <p className="text-sm font-medium mb-1">
                                  {isDragActive 
                                    ? (language === "fr" ? "Déposez le fichier ici..." : "Drop the file here...")
                                    : (language === "fr" ? "Glissez votre facture ici ou cliquez" : "Drag your bill here or click")
                                  }
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  PDF, JPG, PNG (max 10 Mo)
                                </p>
                              </div>

                              {uploadError && (
                                <div className="flex items-center gap-2 mt-3 p-3 bg-destructive/10 rounded-md text-destructive text-sm">
                                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                  {uploadError}
                                </div>
                              )}

                              {uploadedFiles.length > 0 && (
                                <div className="mt-4 space-y-2">
                                  <p className="text-sm font-medium">
                                    {language === "fr" ? "Fichiers téléversés:" : "Uploaded files:"}
                                  </p>
                                  {uploadedFiles.map((uploadedFile, index) => (
                                    <div 
                                      key={index} 
                                      className="flex items-center justify-between p-3 bg-background rounded-md border"
                                    >
                                      <div className="flex items-center gap-3">
                                        <File className="w-5 h-5 text-primary" />
                                        <div>
                                          <p className="text-sm font-medium truncate max-w-[200px]">
                                            {uploadedFile.file.name}
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            {(uploadedFile.file.size / 1024 / 1024).toFixed(2)} Mo
                                          </p>
                                        </div>
                                      </div>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeFile(index)}
                                        data-testid={`button-remove-file-${index}`}
                                      >
                                        <X className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

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

                            <div className="flex gap-3 pt-4">
                              <Button 
                                type="button" 
                                variant="outline"
                                className="flex-1"
                                onClick={() => setCurrentStep(2)}
                                data-testid="button-prev-step-3"
                              >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                {language === "fr" ? "Retour" : "Back"}
                              </Button>
                              <Button 
                                type="submit" 
                                className="flex-1 gap-2"
                                disabled={mutation.isPending || uploadedFiles.length === 0}
                                data-testid="button-submit-form"
                              >
                                {mutation.isPending ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    {language === "fr" ? "Envoi..." : "Sending..."}
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    {language === "fr" ? "Soumettre la demande" : "Submit request"}
                                  </>
                                )}
                              </Button>
                            </div>

                            {mutation.isError && (
                              <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-md text-destructive text-sm">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                {language === "fr" 
                                  ? "Une erreur est survenue. Veuillez réessayer."
                                  : "An error occurred. Please try again."
                                }
                              </div>
                            )}
                          </motion.div>
                        )}
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
