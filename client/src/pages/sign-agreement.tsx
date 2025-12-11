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
  PenLine
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({ title: t("publicAgreement.nameRequired"), variant: "destructive" });
      return;
    }
    if (!email.trim()) {
      toast({ title: t("publicAgreement.emailRequired"), variant: "destructive" });
      return;
    }
    if (!signatureData) {
      toast({ title: t("publicAgreement.signatureRequired"), variant: "destructive" });
      return;
    }

    signMutation.mutate({ name, email, signatureData });
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
      <div className="min-h-screen bg-background py-8">
        <div className="container max-w-2xl mx-auto px-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <CheckCircle2 className="w-16 h-16 mx-auto text-green-500 mb-4" />
              <h2 className="text-2xl font-bold mb-2">{t("publicAgreement.thankYou")}</h2>
              <p className="text-muted-foreground mb-4">{t("publicAgreement.alreadySigned")}</p>
              <div className="text-sm text-muted-foreground">
                <p>{t("publicAgreement.signedBy")}: {agreement.acceptedByName}</p>
                <p>{t("publicAgreement.signedOn")}: {formatDate(agreement.acceptedAt, language)}</p>
              </div>
              <Separator className="my-6" />
              <p className="text-muted-foreground">{t("publicAgreement.nextSteps")}</p>
            </CardContent>
          </Card>
        </div>
      </div>
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

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container max-w-3xl mx-auto px-4 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-primary">{t("publicAgreement.title")}</h1>
          <p className="text-muted-foreground">{t("designAgreement.subtitle")}</p>
        </div>

        {/* Client & Site Info */}
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
                  {[agreement.site.address, agreement.site.city, agreement.site.province]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scope & Deliverables */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {t("publicAgreement.projectScope")}
            </CardTitle>
            <CardDescription>{t("publicAgreement.scopeDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <h4 className="font-medium">{t("designAgreement.deliverables")}</h4>
              <ul className="space-y-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <li key={n} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-500 shrink-0" />
                    <span className="text-sm">{t(`designAgreement.deliverable${n}`)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Cost Breakdown */}
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

        {/* Payment Terms */}
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

        {/* Terms & Conditions */}
        <Card>
          <CardHeader>
            <CardTitle>{t("publicAgreement.termsTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {[1, 2, 3, 4].map((n) => (
                <li key={n} className="flex items-start gap-2">
                  <span className="text-primary font-medium">{n}.</span>
                  <span>{t(`publicAgreement.term${n}`)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Signature Form */}
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
                  type="submit"
                  size="lg"
                  className="flex-1 gap-2"
                  disabled={signMutation.isPending}
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

        {/* Footer */}
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
        {/* Header with language/theme toggles */}
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
