import { useState, useRef, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  CheckCircle2, 
  FileText, 
  Clock, 
  AlertCircle,
  Building2,
  MapPin,
  CreditCard,
  Loader2,
  Eraser,
  PenLine,
  XCircle,
  Calendar,
  Gift,
  Info,
  Download,
  Mail,
  Phone,
  ArrowRight,
  Shield,
  Lock,
  Scale,
  Users,
  Zap,
  Target
} from "lucide-react";

interface PublicAgreementData {
  id: string;
  status: string;
  validUntil: string | null;
  quotedCosts: {
    siteVisit: {
      travel: number;
      visit: number;
      evaluation: number;
      diagrams: number;
      sldSupplement: number;
      total: number;
    };
    subtotal: number;
    taxes: { gst: number; qst: number };
    total: number;
  } | null;
  totalCad: number | null;
  paymentTerms: string | null;
  acceptedAt: string | null;
  acceptedByName: string | null;
  site: {
    name: string;
    address: string | null;
    city: string | null;
    province: string | null;
  };
  client: {
    name: string;
    email: string | null;
  };
}

function formatCurrency(amount: number | undefined | null): string {
  if (amount === undefined || amount === null) return "$0.00";
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
  }).format(amount);
}

function formatDate(date: Date | string | null | undefined, language: string): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(language === "fr" ? "fr-CA" : "en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

type StepStatus = "completed" | "current" | "pending";

function StepTracker({ currentStep }: { currentStep: 1 | 2 | 3 }) {
  const { t } = useI18n();
  
  const steps = [
    { number: 1, label: t("publicAgreement.step1") },
    { number: 2, label: t("publicAgreement.step2") },
    { number: 3, label: t("publicAgreement.step3") },
  ];

  const getStepStatus = (stepNumber: number): StepStatus => {
    if (stepNumber < currentStep) return "completed";
    if (stepNumber === currentStep) return "current";
    return "pending";
  };

  return (
    <div className="w-full py-6" data-testid="step-tracker">
      <div className="flex items-center justify-center gap-2 sm:gap-4">
        {steps.map((step, index) => {
          const status = getStepStatus(step.number);
          return (
            <div key={step.number} className="flex items-center gap-2 sm:gap-4">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm
                    transition-all duration-300
                    ${status === "completed" 
                      ? "bg-primary text-primary-foreground" 
                      : status === "current" 
                        ? "bg-primary text-primary-foreground ring-4 ring-primary/20" 
                        : "bg-muted text-muted-foreground"
                    }
                  `}
                  data-testid={`step-circle-${step.number}`}
                >
                  {status === "completed" ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    step.number
                  )}
                </div>
                <span 
                  className={`text-xs sm:text-sm font-medium text-center max-w-[80px] sm:max-w-none
                    ${status === "current" ? "text-primary" : status === "completed" ? "text-primary" : "text-muted-foreground"}
                  `}
                  data-testid={`step-label-${step.number}`}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div 
                  className={`
                    w-8 sm:w-16 h-0.5 mb-6
                    ${getStepStatus(step.number + 1) !== "pending" ? "bg-primary" : "bg-muted"}
                  `}
                  data-testid={`step-connector-${step.number}`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConfettiAnimation() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" data-testid="confetti-animation">
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-100%) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes confetti-shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
        .confetti {
          position: absolute;
          width: 10px;
          height: 10px;
          animation: confetti-fall 3s ease-out forwards;
        }
        .confetti:nth-child(odd) {
          animation: confetti-fall 3s ease-out forwards, confetti-shake 0.5s ease-in-out infinite;
        }
      `}</style>
      {Array.from({ length: 30 }).map((_, i) => (
        <div
          key={i}
          className="confetti"
          style={{
            left: `${Math.random() * 100}%`,
            backgroundColor: ["#003DA6", "#FFB005", "#16A34A", "#002B75", "#FFB005"][Math.floor(Math.random() * 5)],
            animationDelay: `${Math.random() * 0.5}s`,
            borderRadius: Math.random() > 0.5 ? "50%" : "0",
          }}
        />
      ))}
    </div>
  );
}

function AnimatedCheckmark() {
  return (
    <div className="relative" data-testid="animated-checkmark">
      <style>{`
        @keyframes checkmark-circle {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes checkmark-draw {
          0% { stroke-dashoffset: 100; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        .checkmark-container {
          animation: checkmark-circle 0.6s ease-out forwards;
        }
        .checkmark-svg {
          stroke-dasharray: 100;
          stroke-dashoffset: 100;
          animation: checkmark-draw 0.6s ease-out 0.3s forwards;
        }
        .pulse-ring {
          animation: pulse-ring 1.5s ease-out infinite;
        }
      `}</style>
      <div className="relative w-24 h-24 mx-auto">
        <div className="pulse-ring absolute inset-0 rounded-full bg-green-500/20" />
        <div className="pulse-ring absolute inset-0 rounded-full bg-green-500/20" style={{ animationDelay: "0.5s" }} />
        <div className="checkmark-container w-24 h-24 rounded-full bg-green-500 flex items-center justify-center">
          <svg className="checkmark-svg w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function SuccessConfirmation({ 
  agreement, 
  language,
  token
}: { 
  agreement: PublicAgreementData;
  language: string;
  token: string;
}) {
  const { t } = useI18n();
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const nextSteps = [
    { 
      step: t("publicAgreement.nextStep1"), 
      time: t("publicAgreement.nextStep1Time"),
      icon: Mail 
    },
    { 
      step: t("publicAgreement.nextStep2"), 
      time: t("publicAgreement.nextStep2Time"),
      icon: Calendar 
    },
    { 
      step: t("publicAgreement.nextStep3"), 
      time: t("publicAgreement.nextStep3Time"),
      icon: MapPin 
    },
    { 
      step: t("publicAgreement.nextStep4"), 
      time: t("publicAgreement.nextStep4Time"),
      icon: FileText 
    },
  ];

  return (
    <div className="min-h-screen bg-background py-8 relative">
      {showConfetti && <ConfettiAnimation />}
      
      <div className="container max-w-2xl mx-auto px-4 space-y-6">
        <StepTracker currentStep={3} />
        
        <Card className="relative overflow-visible" data-testid="success-card">
          <CardContent className="pt-8 pb-8">
            <div className="text-center space-y-6">
              <AnimatedCheckmark />
              
              <div className="space-y-2">
                <h2 className="text-3xl font-bold text-primary" data-testid="text-success-title">
                  {t("publicAgreement.agreementSigned")}
                </h2>
                <p className="text-xl text-muted-foreground" data-testid="text-thank-you">
                  {t("publicAgreement.thankYou")}
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-center gap-2 sm:gap-4">
                  <span data-testid="text-signed-by">{t("publicAgreement.signedBy")}: <strong className="text-foreground">{agreement.acceptedByName}</strong></span>
                  <span className="hidden sm:inline">•</span>
                  <span data-testid="text-signed-on">{t("publicAgreement.signedOn")}: <strong className="text-foreground">{formatDate(agreement.acceptedAt, language)}</strong></span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="whats-next-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRight className="w-5 h-5 text-primary" />
              {t("publicAgreement.whatsNext")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {nextSteps.map((item, index) => (
                <div 
                  key={index} 
                  className="flex items-start gap-4 p-3 rounded-lg bg-muted/30"
                  data-testid={`next-step-${index + 1}`}
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <item.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{item.step}</p>
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {item.time}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="contact-card">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => window.open(`/api/public/agreements/${token}/pdf`, "_blank")}
                data-testid="button-download-agreement"
              >
                <Download className="w-4 h-4" />
                {t("publicAgreement.downloadAgreement")}
              </Button>
            </div>
            
            <Separator className="my-6" />
            
            <div className="text-center space-y-3">
              <p className="text-sm text-muted-foreground">{t("publicAgreement.contactUs")}</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm">
                <a 
                  href={`mailto:${t("publicAgreement.contactEmail")}`} 
                  className="flex items-center gap-2 text-primary hover:underline"
                  data-testid="link-contact-email"
                >
                  <Mail className="w-4 h-4" />
                  {t("publicAgreement.contactEmail")}
                </a>
                <a 
                  href={`tel:${t("publicAgreement.contactPhone")}`} 
                  className="flex items-center gap-2 text-primary hover:underline"
                  data-testid="link-contact-phone"
                >
                  <Phone className="w-4 h-4" />
                  {t("publicAgreement.contactPhone")}
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground py-4">
          <p>kWh Québec inc. | info@kwh.quebec</p>
        </div>
      </div>
    </div>
  );
}

function SignaturePad({ 
  onSignatureChange 
}: { 
  onSignatureChange: (dataUrl: string | null) => void 
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const { t } = useI18n();

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setIsDrawing(true);
    setHasSignature(true);
    
    const rect = canvas.getBoundingClientRect();
    let x: number, y: number;
    
    if ("touches" in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }
    
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    let x: number, y: number;
    
    if ("touches" in e) {
      e.preventDefault();
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (hasSignature && canvasRef.current) {
      onSignatureChange(canvasRef.current.toDataURL());
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onSignatureChange(null);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.strokeStyle = "#1a365d";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <PenLine className="w-4 h-4" />
        {t("publicAgreement.drawSignature")} <span className="text-destructive">*</span>
      </Label>
      <div className="border rounded-lg bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          width={400}
          height={150}
          className="w-full touch-none cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          data-testid="canvas-signature"
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={clearSignature}
        className="gap-2"
        data-testid="button-clear-signature"
      >
        <Eraser className="w-4 h-4" />
        {t("publicAgreement.clearSignature")}
      </Button>
    </div>
  );
}

const signAgreementSchema = z.object({
  name: z.string().min(2, "publicAgreement.nameMinLength"),
  email: z.string().email("publicAgreement.emailInvalid"),
  signatureData: z.string().min(1, "publicAgreement.signatureRequired"),
});

type SignAgreementFormValues = z.infer<typeof signAgreementSchema>;

function SignAgreementContent() {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const [, params] = useRoute("/sign/:token");
  const token = params?.token;

  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const form = useForm<SignAgreementFormValues>({
    resolver: zodResolver(signAgreementSchema),
    defaultValues: {
      name: "",
      email: "",
      signatureData: "",
    },
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get("payment");
    const sessionId = urlParams.get("session_id");
    
    if (paymentStatus === "success" && sessionId && token) {
      setIsProcessingPayment(true);
      fetch(`/api/public/agreements/${token}/confirm-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            toast({
              title: t("publicAgreement.signingSuccess"),
              description: t("publicAgreement.nextSteps"),
            });
            queryClient.invalidateQueries({ queryKey: ["/api/public/agreements", token] });
          }
        })
        .catch(() => {
          toast({ title: t("publicAgreement.error"), variant: "destructive" });
        })
        .finally(() => {
          setIsProcessingPayment(false);
          window.history.replaceState({}, "", `/sign/${token}`);
        });
    } else if (paymentStatus === "cancelled") {
      toast({
        title: language === "fr" ? "Paiement annulé" : "Payment cancelled",
        variant: "destructive",
      });
      window.history.replaceState({}, "", `/sign/${token}`);
    }
  }, [token, toast, t, language]);

  const { data: agreement, isLoading, error } = useQuery<PublicAgreementData>({
    queryKey: ["/api/public/agreements", token],
    queryFn: async () => {
      const res = await fetch(`/api/public/agreements/${token}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error("not_found");
        throw new Error("error");
      }
      return res.json();
    },
    enabled: !!token,
  });

  const signMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; signatureData: string }) => {
      return apiRequest("POST", `/api/public/agreements/${token}/sign`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/public/agreements", token] });
      toast({
        title: t("publicAgreement.signingSuccess"),
        description: t("publicAgreement.nextSteps"),
      });
    },
    onError: () => {
      toast({
        title: t("publicAgreement.error"),
        variant: "destructive",
      });
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; signatureData: string; language: string }) => {
      const res = await apiRequest("POST", `/api/public/agreements/${token}/create-checkout`, data) as Response;
      return res.json();
    },
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        toast({
          title: t("publicAgreement.redirectingToPayment"),
        });
        window.location.href = data.checkoutUrl;
      }
    },
    onError: () => {
      toast({
        title: t("publicAgreement.error"),
        variant: "destructive",
      });
    },
  });

  const handleSignatureChange = (dataUrl: string | null) => {
    form.setValue("signatureData", dataUrl || "", { shouldValidate: form.formState.isSubmitted });
  };

  const handleFormSubmit = (data: SignAgreementFormValues) => {
    signMutation.mutate({ name: data.name, email: data.email, signatureData: data.signatureData });
  };

  const handlePayAndSign = () => {
    form.handleSubmit((data) => {
      paymentMutation.mutate({ name: data.name, email: data.email, signatureData: data.signatureData, language });
    })();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">{t("publicAgreement.loading")}</p>
        </div>
      </div>
    );
  }

  if (error || !agreement) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">{t("publicAgreement.notFound")}</h2>
            <p className="text-muted-foreground">{t("publicAgreement.error")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isExpired = agreement.validUntil && new Date(agreement.validUntil) < new Date();
  const isAlreadySigned = agreement.status === "accepted";
  const costs = agreement.quotedCosts;
  const depositAmount = (agreement.totalCad || 0) * 0.5;

  if (isAlreadySigned) {
    return (
      <SuccessConfirmation 
        agreement={agreement} 
        language={language}
        token={token || ""}
      />
    );
  }

  if (isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <Clock className="w-12 h-12 mx-auto text-yellow-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">{t("publicAgreement.expired")}</h2>
            <p className="text-muted-foreground">
              {t("designAgreement.validUntil")}: {formatDate(agreement.validUntil, language)}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const signatureData = form.watch("signatureData");
  const currentStep = signatureData ? 2 : 1;

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container max-w-3xl mx-auto px-4 space-y-6">
        <StepTracker currentStep={currentStep as 1 | 2 | 3} />

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-primary">{t("publicAgreement.title")}</h1>
          <p className="text-muted-foreground">{t("designAgreement.subtitle")}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              {t("publicAgreement.preparedFor")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-semibold text-lg" data-testid="text-client-name">{agreement.client.name}</p>
              {agreement.client.email && (
                <p className="text-muted-foreground">{agreement.client.email}</p>
              )}
            </div>
            <Separator />
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 mt-1 text-muted-foreground" />
              <div>
                <p className="font-medium">{t("publicAgreement.site")}: {agreement.site.name}</p>
                <p className="text-sm text-muted-foreground">
                  {[agreement.site.address, agreement.site.city]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Purpose */}
        <div className="bg-primary/5 rounded-lg p-4 border border-primary/10" data-testid="section-purpose">
          <div className="flex items-start gap-3">
            <Target className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <h4 className="font-medium text-primary mb-1">
                {language === "fr" ? "Objet de l'entente" : "Purpose of Agreement"}
              </h4>
              <p className="text-sm text-muted-foreground">
                {language === "fr"
                  ? "Le présent Mandat de conception autorise kWh Québec inc. à réaliser une étude technique et économique préliminaire (« Design Agreement ») pour évaluer la faisabilité d'un système solaire photovoltaïque et/ou de stockage d'énergie pour le bâtiment identifié ci-dessus. Cette étude est un prérequis à toute proposition EPC (Engineering, Procurement & Construction) ferme."
                  : "This Design Agreement authorizes kWh Québec inc. to conduct a preliminary technical and economic study to evaluate the feasibility of a solar photovoltaic and/or energy storage system for the building identified above. This study is a prerequisite to any firm EPC (Engineering, Procurement & Construction) proposal."}
              </p>
            </div>
          </div>
        </div>

        {/* Section 4: Scope A/B/C */}
        <Card data-testid="section-scope">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              {language === "fr" ? "Portée des travaux" : "Scope of Work"}
            </CardTitle>
            <CardDescription>
              {language === "fr"
                ? "Le Design Agreement couvre trois volets complémentaires"
                : "The Design Agreement covers three complementary phases"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Scope A */}
            <div className="border rounded-lg p-4 bg-blue-50/50 dark:bg-blue-950/20">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary" className="bg-primary text-primary-foreground">A</Badge>
                <h4 className="font-semibold">{language === "fr" ? "Conception préliminaire (Desktop)" : "Desktop Design"}</h4>
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground ml-8">
                <li>• {language === "fr" ? "Analyse de la consommation et du profil de charge" : "Consumption and load profile analysis"}</li>
                <li>• {language === "fr" ? "Dimensionnement solaire + stockage (si applicable)" : "Solar + storage sizing (if applicable)"}</li>
                <li>• {language === "fr" ? "Modélisation financière 25 ans (NPV, TRI, cashflows)" : "25-year financial modeling (NPV, IRR, cashflows)"}</li>
                <li>• {language === "fr" ? "Demande d'interconnexion Hydro-Québec" : "Hydro-Québec interconnection application"}</li>
                <li>• {language === "fr" ? "Analyse des incitatifs (ITC fédéral, HQ, RS&DE)" : "Incentive analysis (Federal ITC, HQ, SR&ED)"}</li>
              </ul>
            </div>
            {/* Scope B */}
            <div className="border rounded-lg p-4 bg-amber-50/50 dark:bg-amber-950/20">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary" className="bg-amber-500 text-white">B</Badge>
                <h4 className="font-semibold">{language === "fr" ? "Visite de site" : "Site Visit"}</h4>
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground ml-8">
                <li>• {language === "fr" ? "Inspection toiture (état, pente, membrane, obstructions)" : "Roof inspection (condition, slope, membrane, obstructions)"}</li>
                <li>• {language === "fr" ? "Évaluation électrique (panneau, capacité, point de raccord)" : "Electrical assessment (panel, capacity, connection point)"}</li>
                <li>• {language === "fr" ? "Évaluation structurale préliminaire" : "Preliminary structural assessment"}</li>
                <li>• {language === "fr" ? "Photos et mesures pour conception détaillée" : "Photos and measurements for detailed design"}</li>
                <li>• {language === "fr" ? "Identification des risques (6 catégories)" : "Risk identification (6 categories)"}</li>
              </ul>
            </div>
            {/* Scope C */}
            <div className="border rounded-lg p-4 bg-green-50/50 dark:bg-green-950/20">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary" className="bg-green-600 text-white">C</Badge>
                <h4 className="font-semibold">{language === "fr" ? "Ingénierie & livrables" : "Engineering & Deliverables"}</h4>
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground ml-8">
                <li>• {language === "fr" ? "Plans d'implantation et schémas électriques (SLD)" : "Layout plans and single-line diagrams (SLD)"}</li>
                <li>• {language === "fr" ? "Rapport technique complet avec recommandations" : "Complete technical report with recommendations"}</li>
                <li>• {language === "fr" ? "Spécifications d'équipement (panneaux, onduleurs, racking)" : "Equipment specifications (panels, inverters, racking)"}</li>
                <li>• {language === "fr" ? "Proposition EPC ferme avec prix et calendrier" : "Firm EPC proposal with pricing and schedule"}</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Section 5: Client Responsibilities */}
        <Card data-testid="section-client-responsibilities">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              {language === "fr" ? "Responsabilités du client" : "Client Responsibilities"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary/70 shrink-0" />
                <span>{language === "fr" ? "Fournir les 12 derniers relevés de facture Hydro-Québec (ou accès au compte en ligne)" : "Provide the last 12 Hydro-Québec bills (or online account access)"}</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary/70 shrink-0" />
                <span>{language === "fr" ? "Accorder l'accès à la toiture et au panneau électrique lors de la visite" : "Grant roof and electrical panel access during site visit"}</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary/70 shrink-0" />
                <span>{language === "fr" ? "Fournir les plans du bâtiment si disponibles (structure, toiture, électrique)" : "Provide building plans if available (structural, roof, electrical)"}</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary/70 shrink-0" />
                <span>{language === "fr" ? "Communiquer tout changement prévu (expansion, rénovation, électrification)" : "Communicate any planned changes (expansion, renovation, electrification)"}</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary/70 shrink-0" />
                <span>{language === "fr" ? "Désigner un interlocuteur principal pour la coordination" : "Designate a primary contact for coordination"}</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Section 7: Timeline */}
        <Card data-testid="section-timeline">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              {t("designAgreement.timeline")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">1</span>
                </div>
                <div>
                  <p className="font-medium text-sm">{language === "fr" ? "Visite de site" : "Site Visit"}</p>
                  <p className="text-xs text-muted-foreground">{language === "fr" ? "Dans les 10 jours ouvrables suivant la signature" : "Within 10 business days of signing"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">2</span>
                </div>
                <div>
                  <p className="font-medium text-sm">{language === "fr" ? "Rapport technique + proposition EPC" : "Technical Report + EPC Proposal"}</p>
                  <p className="text-xs text-muted-foreground">{language === "fr" ? "4-6 semaines après la visite de site" : "4-6 weeks after site visit"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">{language === "fr" ? "Interconnexion Hydro-Québec" : "Hydro-Québec Interconnection"}</p>
                  <p className="text-xs text-muted-foreground">{language === "fr" ? "Délai variable: 4-16 semaines (en parallèle)" : "Variable delay: 4-16 weeks (in parallel)"}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("designAgreement.costBreakdown")}</CardTitle>
          </CardHeader>
          <CardContent>
            {costs ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  {costs.siteVisit.travel > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>{t("designAgreement.travel")}</span>
                      <span>{formatCurrency(costs.siteVisit.travel)}</span>
                    </div>
                  )}
                  {costs.siteVisit.visit > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>{t("designAgreement.visit")}</span>
                      <span>{formatCurrency(costs.siteVisit.visit)}</span>
                    </div>
                  )}
                  {costs.siteVisit.evaluation > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>{t("designAgreement.evaluation")}</span>
                      <span>{formatCurrency(costs.siteVisit.evaluation)}</span>
                    </div>
                  )}
                  {costs.siteVisit.diagrams > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>{t("designAgreement.diagrams")}</span>
                      <span>{formatCurrency(costs.siteVisit.diagrams)}</span>
                    </div>
                  )}
                  {costs.siteVisit.sldSupplement > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>{t("designAgreement.sldSupplement")}</span>
                      <span>{formatCurrency(costs.siteVisit.sldSupplement)}</span>
                    </div>
                  )}
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{t("designAgreement.subtotal")}</span>
                    <span>{formatCurrency(costs.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{t("designAgreement.gst")}</span>
                    <span>{formatCurrency(costs.taxes.gst)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{t("designAgreement.qst")}</span>
                    <span>{formatCurrency(costs.taxes.qst)}</span>
                  </div>
                </div>
                
                <Separator />
                
                <div className="flex justify-between font-semibold text-lg">
                  <span>{t("designAgreement.total")}</span>
                  <span className="text-primary">{formatCurrency(agreement.totalCad)}</span>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">-</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              {t("designAgreement.paymentTerms")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>{agreement.paymentTerms || t("designAgreement.defaultPaymentTerms")}</p>
            
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="font-medium">{t("publicAgreement.depositAmount")} (50%)</span>
                <Badge variant="secondary" className="text-lg px-3 py-1">
                  {formatCurrency(depositAmount)}
                </Badge>
              </div>
            </div>

            {agreement.validUntil && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {t("designAgreement.validUntil")}: {formatDate(agreement.validUntil, language)}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Section 9: Assumptions & Exclusions */}
        <Card data-testid="section-assumptions-exclusions">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              {language === "fr" ? "Hypothèses et exclusions" : "Assumptions & Exclusions"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold mb-2">{language === "fr" ? "Hypothèses" : "Assumptions"}</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• {language === "fr" ? "Le client fournit un accès raisonnable au bâtiment pour la visite de site" : "Client provides reasonable building access for site visit"}</li>
                <li>• {language === "fr" ? "Les données de consommation fournies sont exactes et représentatives" : "Consumption data provided is accurate and representative"}</li>
                <li>• {language === "fr" ? "Aucune modification structurale majeure n'est requise (sauf avis contraire dans le rapport)" : "No major structural modifications required (unless noted in report)"}</li>
                <li>• {language === "fr" ? "Les tarifs et incitatifs sont basés sur les programmes en vigueur au moment de l'étude" : "Rates and incentives are based on programs in effect at time of study"}</li>
              </ul>
            </div>
            <Separator />
            <div>
              <h4 className="text-sm font-semibold mb-2">{language === "fr" ? "Exclusions" : "Exclusions"}</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 mt-0.5 text-destructive/70 shrink-0" />
                  <span>{language === "fr" ? "Construction, installation ou mise en service du système" : "System construction, installation, or commissioning"}</span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 mt-0.5 text-destructive/70 shrink-0" />
                  <span>{language === "fr" ? "Travaux de toiture, réparations structurales ou mises à niveau électriques" : "Roofing work, structural repairs, or electrical upgrades"}</span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 mt-0.5 text-destructive/70 shrink-0" />
                  <span>{language === "fr" ? "Frais de tierce partie (ingénieur structural, HQ, arpenteur) — facturés séparément si requis" : "Third-party fees (structural engineer, HQ, surveyor) — billed separately if required"}</span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 mt-0.5 text-destructive/70 shrink-0" />
                  <span>{language === "fr" ? "Permis municipaux et autorisations réglementaires" : "Municipal permits and regulatory approvals"}</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Sections 10-13: Legal terms (Accordion) */}
        <Card data-testid="section-legal-terms">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-primary" />
              {language === "fr" ? "Conditions générales" : "General Terms"}
            </CardTitle>
            <CardDescription>
              {language === "fr" ? "Cliquez pour voir les détails" : "Click to view details"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {/* Section 10: Ownership */}
              <AccordionItem value="ownership">
                <AccordionTrigger className="text-sm font-medium">
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    {language === "fr" ? "Propriété intellectuelle" : "Ownership of Work Product"}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>{language === "fr"
                    ? "Les plans, rapports et documents produits dans le cadre de cette entente demeurent la propriété de kWh Québec inc. jusqu'au paiement intégral des frais du Design Agreement."
                    : "Plans, reports, and documents produced under this agreement remain the property of kWh Québec inc. until full payment of the Design Agreement fees."}</p>
                  <p>{language === "fr"
                    ? "Après paiement complet, le client obtient une licence d'utilisation non exclusive pour les documents livrés, limitée au projet décrit dans l'entente. kWh Québec conserve les droits de propriété intellectuelle sur ses méthodologies, outils et processus."
                    : "After full payment, the client receives a non-exclusive license to use the delivered documents, limited to the project described in this agreement. kWh Québec retains intellectual property rights over its methodologies, tools, and processes."}</p>
                </AccordionContent>
              </AccordionItem>

              {/* Section 11: Confidentiality */}
              <AccordionItem value="confidentiality">
                <AccordionTrigger className="text-sm font-medium">
                  <span className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    {language === "fr" ? "Confidentialité" : "Confidentiality"}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>{language === "fr"
                    ? "Les deux parties s'engagent à traiter comme confidentielle toute information technique, financière ou commerciale échangée dans le cadre de cette entente."
                    : "Both parties agree to treat as confidential any technical, financial, or commercial information exchanged under this agreement."}</p>
                  <p>{language === "fr"
                    ? "Cette obligation de confidentialité survit à la terminaison de l'entente pour une période de deux (2) ans."
                    : "This confidentiality obligation survives termination of the agreement for a period of two (2) years."}</p>
                </AccordionContent>
              </AccordionItem>

              {/* Section 12: Limitation of Liability */}
              <AccordionItem value="liability">
                <AccordionTrigger className="text-sm font-medium">
                  <span className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    {language === "fr" ? "Limitation de responsabilité" : "Limitation of Liability"}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>{language === "fr"
                    ? "La responsabilité totale de kWh Québec inc. dans le cadre de cette entente est limitée au montant des frais payés pour le Design Agreement."
                    : "The total liability of kWh Québec inc. under this agreement is limited to the amount of fees paid for the Design Agreement."}</p>
                  <p>{language === "fr"
                    ? "kWh Québec ne saurait être tenu responsable des dommages indirects, consécutifs ou punitifs, incluant les pertes de profits ou de revenus."
                    : "kWh Québec shall not be liable for indirect, consequential, or punitive damages, including lost profits or revenue."}</p>
                </AccordionContent>
              </AccordionItem>

              {/* Section 13: Termination */}
              <AccordionItem value="termination">
                <AccordionTrigger className="text-sm font-medium">
                  <span className="flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    {language === "fr" ? "Résiliation" : "Termination"}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>{language === "fr"
                    ? "Le client peut résilier cette entente à tout moment par avis écrit. Les frais du Design Agreement ne sont pas remboursables."
                    : "The client may terminate this agreement at any time by written notice. Design Agreement fees are non-refundable."}</p>
                  <p>{language === "fr"
                    ? "Si la résiliation survient avant la visite de site, kWh Québec remettra au client tous les livrables complétés à cette date."
                    : "If termination occurs before the site visit, kWh Québec will deliver all completed deliverables as of that date."}</p>
                  <p>{language === "fr"
                    ? "kWh Québec se réserve le droit de résilier l'entente si le client ne remplit pas ses obligations (accès, documents requis) dans un délai raisonnable."
                    : "kWh Québec reserves the right to terminate the agreement if the client fails to fulfill their obligations (access, required documents) within a reasonable timeframe."}</p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Section 8 (expanded): Fee, Credit & Path to EPC */}
        <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4 border border-green-200 dark:border-green-800" data-testid="section-credit-policy">
          <div className="flex items-start gap-3">
            <Gift className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-medium text-green-700 dark:text-green-400 mb-1">{t("designAgreement.creditPolicy")}</h4>
              <p className="text-sm text-green-600 dark:text-green-500">{t("designAgreement.creditPolicyText")}</p>
            </div>
          </div>
        </div>

        {/* Section 14: Path to EPC Contract */}
        <Card className="border-primary/30" data-testid="section-path-to-epc">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              {language === "fr" ? "Chemin vers le contrat EPC" : "Path to EPC Contract"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {language === "fr"
                  ? "Si l'étude confirme la viabilité du projet, kWh Québec présentera une proposition EPC ferme comprenant:"
                  : "If the study confirms project viability, kWh Québec will present a firm EPC proposal including:"}
              </p>
              <ul className="space-y-1 text-sm text-muted-foreground ml-4">
                <li>• {language === "fr" ? "Prix fixe garanti pour la conception, l'approvisionnement et la construction" : "Guaranteed fixed price for design, procurement, and construction"}</li>
                <li>• {language === "fr" ? "Calendrier détaillé avec jalons de paiement" : "Detailed schedule with payment milestones"}</li>
                <li>• {language === "fr" ? "Garanties de performance et de production" : "Performance and production guarantees"}</li>
                <li>• {language === "fr" ? "Plan O&M 25 ans avec monitoring en temps réel" : "25-year O&M plan with real-time monitoring"}</li>
              </ul>
              <div className="bg-primary/5 rounded-lg p-3 mt-3">
                <p className="text-sm font-medium text-primary">
                  {language === "fr"
                    ? "Le montant complet du Design Agreement sera crédité sur le contrat EPC si le projet va de l'avant."
                    : "The full Design Agreement amount will be credited on the EPC contract if the project proceeds."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Important Notes */}
        <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4 border border-amber-200 dark:border-amber-800" data-testid="section-important-notes">
          <h4 className="font-medium text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {t("designAgreement.importantNotes")}
          </h4>
          <ul className="space-y-1 text-sm text-amber-600 dark:text-amber-500">
            <li data-testid="note-1">{t("designAgreement.note1")}</li>
            <li data-testid="note-2">{t("designAgreement.note2")}</li>
            <li data-testid="note-3">{t("designAgreement.note3")}</li>
          </ul>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("publicAgreement.signatureSection")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t("publicAgreement.yourName")} <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Jean Tremblay"
                            data-testid="input-signer-name"
                          />
                        </FormControl>
                        <FormMessage>{form.formState.errors.name && t(form.formState.errors.name.message || "")}</FormMessage>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t("publicAgreement.yourEmail")} <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="email"
                            placeholder="jean@entreprise.com"
                            data-testid="input-signer-email"
                          />
                        </FormControl>
                        <FormMessage>{form.formState.errors.email && t(form.formState.errors.email.message || "")}</FormMessage>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <SignaturePad onSignatureChange={handleSignatureChange} />
                  {form.formState.errors.signatureData && (
                    <p className="text-sm font-medium text-destructive" data-testid="error-signature">
                      {t(form.formState.errors.signatureData.message || "")}
                    </p>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    type="button"
                    size="lg"
                    className="flex-1 gap-2"
                    onClick={handlePayAndSign}
                    disabled={paymentMutation.isPending || signMutation.isPending || isProcessingPayment}
                    data-testid="button-sign-and-pay"
                  >
                    {paymentMutation.isPending || isProcessingPayment ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CreditCard className="w-4 h-4" />
                    )}
                    {t("publicAgreement.signAndPay")}
                  </Button>
                  <Button
                    type="submit"
                    size="lg"
                    variant="outline"
                    className="gap-2"
                    disabled={signMutation.isPending || paymentMutation.isPending}
                    data-testid="button-sign-agreement"
                  >
                    {signMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    {t("publicAgreement.signOnly")}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground py-4">
          <p>kWh Québec inc. | info@kwh.quebec</p>
        </div>
      </div>
    </div>
  );
}

export default function SignAgreementPage() {
  return (
    <I18nProvider>
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="font-bold text-xl text-primary">kWh Québec</div>
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>
        </header>
        <SignAgreementContent />
      </div>
    </I18nProvider>
  );
}
