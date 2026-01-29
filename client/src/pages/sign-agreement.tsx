import { useState, useRef, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  ArrowRight
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
            backgroundColor: ["#003DA6", "#FFB005", "#22c55e", "#3b82f6", "#f97316"][Math.floor(Math.random() * 5)],
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
          <p>kWh Québec inc. | info@kwhquebec.com</p>
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
        {t("publicAgreement.drawSignature")}
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

function SignAgreementContent() {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const [, params] = useRoute("/sign/:token");
  const token = params?.token;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

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

  const validateForm = (): boolean => {
    if (!name.trim()) {
      toast({ title: t("publicAgreement.nameRequired"), variant: "destructive" });
      return false;
    }
    if (!email.trim()) {
      toast({ title: t("publicAgreement.emailRequired"), variant: "destructive" });
      return false;
    }
    if (!signatureData) {
      toast({ title: t("publicAgreement.signatureRequired"), variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    signMutation.mutate({ name, email, signatureData: signatureData! });
  };

  const handlePayAndSign = () => {
    if (!validateForm()) return;
    paymentMutation.mutate({ name, email, signatureData: signatureData!, language });
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

        <div className="bg-primary/5 rounded-lg p-4 border border-primary/10" data-testid="section-intro">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <h4 className="font-medium text-primary mb-1">{t("designAgreement.introduction")}</h4>
              <p className="text-sm text-muted-foreground">{t("designAgreement.introText")}</p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              {t("designAgreement.deliverablesDetailed")}
            </CardTitle>
            <CardDescription>{t("publicAgreement.scopeDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <li key={n} className="flex items-start gap-2" data-testid={`deliverable-${n}`}>
                  <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-500 shrink-0" />
                  <span className="text-sm">{t(`designAgreement.deliverableDetail${n}`)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-destructive" />
              {t("designAgreement.exclusions")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {[1, 2, 3, 4].map((n) => (
                <li key={n} className="flex items-start gap-2" data-testid={`exclusion-${n}`}>
                  <XCircle className="w-4 h-4 mt-0.5 text-destructive/70 shrink-0" />
                  <span className="text-sm text-muted-foreground">{t(`designAgreement.exclusion${n}`)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              {t("designAgreement.timeline")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li className="flex items-start gap-2" data-testid="timeline-visit">
                <Clock className="w-4 h-4 mt-0.5 text-primary/70 shrink-0" />
                <span className="text-sm text-muted-foreground">{t("designAgreement.timelineVisit")}</span>
              </li>
              <li className="flex items-start gap-2" data-testid="timeline-delivery">
                <Clock className="w-4 h-4 mt-0.5 text-primary/70 shrink-0" />
                <span className="text-sm text-muted-foreground">{t("designAgreement.timelineDelivery")}</span>
              </li>
            </ul>
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

        <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4 border border-green-200 dark:border-green-800" data-testid="section-credit-policy">
          <div className="flex items-start gap-3">
            <Gift className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-medium text-green-700 dark:text-green-400 mb-1">{t("designAgreement.creditPolicy")}</h4>
              <p className="text-sm text-green-600 dark:text-green-500">{t("designAgreement.creditPolicyText")}</p>
            </div>
          </div>
        </div>

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
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">{t("publicAgreement.yourName")}</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jean Tremblay"
                    data-testid="input-signer-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{t("publicAgreement.yourEmail")}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jean@entreprise.com"
                    data-testid="input-signer-email"
                  />
                </div>
              </div>

              <SignaturePad onSignatureChange={setSignatureData} />

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
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground py-4">
          <p>kWh Québec inc. | info@kwhquebec.com</p>
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
