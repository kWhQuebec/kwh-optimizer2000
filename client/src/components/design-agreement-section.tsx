import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  FileText,
  DollarSign,
  Send,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Plus,
  ChevronDown,
  ChevronUp,
  Download,
  Copy,
  ExternalLink,
  XCircle,
  Calendar,
  Gift,
  Info,
  Settings,
  Zap,
  Battery,
  Building2,
  Car,
  Stamp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { DesignAgreement, SiteVisit, SimulationRun } from "@shared/schema";

interface DesignAgreementSectionProps {
  siteId: string;
}

// Pricing defaults
const PRICING_DEFAULTS = {
  baseFeePerBuilding: 1500,
  pricePerKW: 15,
  pricePerKWh: 10,
  travelCostPerDay: 150,
  structuralStampFee: 1500,
  electricalStampFee: 1000,
};

interface PricingConfig {
  numBuildings: number;
  pvSizeKW: number;
  battEnergyKWh: number;
  travelDays: number;
  includeStructuralStamp: boolean;
  includeElectricalStamp: boolean;
  baseFeePerBuilding: number;
  pricePerKW: number;
  pricePerKWh: number;
  travelCostPerDay: number;
  structuralStampFee: number;
  electricalStampFee: number;
}

interface QuotedCosts {
  siteVisit?: {
    numBuildings?: number;
    travelDays?: number;
    travel?: number;
    visit?: number;
    evaluation?: number;
    diagrams?: number;
    sldSupplement?: number;
    total?: number;
  } | null;
  additionalFees?: Array<{ description: string; amount: number }>;
  subtotal?: number;
  taxes?: { gst?: number; qst?: number };
  total?: number;
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  
  switch (status) {
    case "accepted":
      return (
        <Badge variant="default" className="gap-1 bg-green-600" data-testid="badge-agreement-status-accepted">
          <CheckCircle2 className="w-3 h-3" />
          {t("designAgreement.status.accepted")}
        </Badge>
      );
    case "sent":
      return (
        <Badge variant="secondary" className="gap-1" data-testid="badge-agreement-status-sent">
          <Send className="w-3 h-3" />
          {t("designAgreement.status.sent")}
        </Badge>
      );
    case "declined":
      return (
        <Badge variant="destructive" className="gap-1" data-testid="badge-agreement-status-declined">
          <AlertCircle className="w-3 h-3" />
          {t("designAgreement.status.declined")}
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="gap-1" data-testid="badge-agreement-status-draft">
          <Clock className="w-3 h-3" />
          {t("designAgreement.status.draft")}
        </Badge>
      );
  }
}

function formatCurrency(amount: number | undefined | null): string {
  if (amount === undefined || amount === null) return "$0.00";
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
  }).format(amount);
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("fr-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function calculatePricingTotal(config: PricingConfig) {
  const baseFee = config.numBuildings * config.baseFeePerBuilding;
  const pvFee = config.pvSizeKW * config.pricePerKW;
  const batteryFee = config.battEnergyKWh * config.pricePerKWh;
  const travelFee = config.travelDays * config.travelCostPerDay;
  const structuralFee = config.includeStructuralStamp ? config.structuralStampFee : 0;
  const electricalFee = config.includeElectricalStamp ? config.electricalStampFee : 0;
  
  const subtotal = baseFee + pvFee + batteryFee + travelFee + structuralFee + electricalFee;
  const gst = subtotal * 0.05;
  const qst = subtotal * 0.09975;
  const total = subtotal + gst + qst;
  
  return {
    baseFee,
    pvFee,
    batteryFee,
    travelFee,
    structuralFee,
    electricalFee,
    subtotal,
    gst,
    qst,
    total,
  };
}

export function DesignAgreementSection({ siteId }: DesignAgreementSectionProps) {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(true);
  const [pricingDialogOpen, setPricingDialogOpen] = useState(false);
  const [pricingConfig, setPricingConfig] = useState<PricingConfig>({
    numBuildings: 1,
    pvSizeKW: 0,
    battEnergyKWh: 0,
    travelDays: 0,
    includeStructuralStamp: false,
    includeElectricalStamp: false,
    ...PRICING_DEFAULTS,
  });

  const { data: agreement, isLoading: agreementLoading } = useQuery<DesignAgreement>({
    queryKey: ["/api/sites", siteId, "design-agreement"],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/sites/${siteId}/design-agreement`, { 
        credentials: "include",
        headers,
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch agreement");
      return res.json();
    },
  });

  const { data: siteVisits } = useQuery<SiteVisit[]>({
    queryKey: ["/api/sites", siteId, "site-visits"],
  });

  // Fetch simulation runs to get optimal system size
  const { data: simulations } = useQuery<SimulationRun[]>({
    queryKey: ["/api/sites", siteId, "simulations"],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/sites/${siteId}/simulations`, { 
        credentials: "include",
        headers,
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const latestVisit = siteVisits?.find(v => v.status !== "cancelled");
  
  // Get optimal system configuration from simulations
  const optimalSimulation = simulations?.find(s => s.type === "SCENARIO" && s.npv20 !== null);
  
  // Pre-populate pricing config from simulation data
  useEffect(() => {
    if (optimalSimulation && !agreement) {
      setPricingConfig(prev => ({
        ...prev,
        pvSizeKW: optimalSimulation.pvSizeKW || 0,
        battEnergyKWh: optimalSimulation.battEnergyKWh || 0,
      }));
    }
  }, [optimalSimulation, agreement]);

  const generateMutation = useMutation({
    mutationFn: async (config: PricingConfig) => {
      const pricing = calculatePricingTotal(config);
      return apiRequest("POST", `/api/sites/${siteId}/generate-design-agreement`, {
        siteVisitId: latestVisit?.id,
        pricingConfig: {
          ...config,
          ...pricing,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites", siteId, "design-agreement"] });
      setPricingDialogOpen(false);
      toast({ title: t("designAgreement.created") });
    },
    onError: () => {
      toast({ title: t("designAgreement.createError"), variant: "destructive" });
    },
  });
  
  const handleOpenPricingDialog = () => {
    setPricingDialogOpen(true);
  };
  
  const handleGenerateAgreement = () => {
    generateMutation.mutate(pricingConfig);
  };
  
  const calculatedPricing = calculatePricingTotal(pricingConfig);

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const updateData: Record<string, unknown> = { status: newStatus };
      if (newStatus === "sent") updateData.sentAt = new Date().toISOString();
      if (newStatus === "accepted") updateData.acceptedAt = new Date().toISOString();
      return apiRequest("PATCH", `/api/design-agreements/${agreement?.id}`, updateData);
    },
    onSuccess: (_, newStatus) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites", siteId, "design-agreement"] });
      if (newStatus === "sent") {
        toast({ title: t("designAgreement.sent") });
      } else if (newStatus === "accepted") {
        toast({ title: t("designAgreement.accepted") });
      }
    },
    onError: () => {
      toast({ title: t("designAgreement.sendError"), variant: "destructive" });
    },
  });

  if (agreementLoading) {
    return (
      <Card data-testid="card-design-agreement-loading">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const quotedCosts = agreement?.quotedCosts as QuotedCosts | null;
  const siteVisitCosts = quotedCosts?.siteVisit;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card data-testid="card-design-agreement">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover-elevate">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                <div>
                  <CardTitle className="text-lg">{t("designAgreement.title")}</CardTitle>
                  <CardDescription>{t("designAgreement.subtitle")}</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {agreement && <StatusBadge status={agreement.status} />}
                {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-6">
            {!agreement ? (
              <div className="text-center py-6 space-y-4">
                <DollarSign className="w-10 h-10 mx-auto text-primary" />
                <p className="text-muted-foreground">
                  {t("designAgreement.subtitle")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("designAgreement.generateDescription")}
                </p>
                <Button
                  onClick={handleOpenPricingDialog}
                  data-testid="button-generate-agreement"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t("designAgreement.generate")}
                </Button>
              </div>
            ) : (
              <>
                {/* Introduction Section */}
                <div className="bg-primary/5 rounded-lg p-4 border border-primary/10" data-testid="section-introduction">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <h4 className="font-medium text-primary mb-1">{t("designAgreement.introduction")}</h4>
                      <p className="text-sm text-muted-foreground">{t("designAgreement.introText")}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  {/* Left Column: Costs */}
                  <div className="space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-primary" />
                      {t("designAgreement.costBreakdown")}
                    </h4>
                    
                    {siteVisitCosts && (
                      <div className="space-y-2 text-sm bg-muted/30 rounded-lg p-3">
                        <div className="text-muted-foreground font-medium">
                          {t("designAgreement.siteVisitCosts")}
                        </div>
                        {siteVisitCosts.travel !== undefined && siteVisitCosts.travel > 0 && (
                          <div className="flex justify-between" data-testid="row-cost-travel">
                            <span>{t("designAgreement.travel")}</span>
                            <span>{formatCurrency(siteVisitCosts.travel)}</span>
                          </div>
                        )}
                        <div className="flex justify-between" data-testid="row-cost-visit">
                          <span>{t("designAgreement.visit")}</span>
                          <span>{formatCurrency(siteVisitCosts.visit)}</span>
                        </div>
                        <div className="flex justify-between" data-testid="row-cost-evaluation">
                          <span>{t("designAgreement.evaluation")}</span>
                          <span>{formatCurrency(siteVisitCosts.evaluation)}</span>
                        </div>
                        <div className="flex justify-between" data-testid="row-cost-diagrams">
                          <span>{t("designAgreement.diagrams")}</span>
                          <span>{formatCurrency(siteVisitCosts.diagrams)}</span>
                        </div>
                        {siteVisitCosts.sldSupplement !== undefined && siteVisitCosts.sldSupplement > 0 && (
                          <div className="flex justify-between" data-testid="row-cost-sld">
                            <span>{t("designAgreement.sldSupplement")}</span>
                            <span>{formatCurrency(siteVisitCosts.sldSupplement)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between" data-testid="row-subtotal">
                        <span>{t("designAgreement.subtotal")}</span>
                        <span>{formatCurrency(quotedCosts?.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground" data-testid="row-gst">
                        <span>{t("designAgreement.gst")}</span>
                        <span>{formatCurrency(quotedCosts?.taxes?.gst)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground" data-testid="row-qst">
                        <span>{t("designAgreement.qst")}</span>
                        <span>{formatCurrency(quotedCosts?.taxes?.qst)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-semibold text-base" data-testid="row-total">
                        <span>{t("designAgreement.total")}</span>
                        <span className="text-primary">{formatCurrency(agreement.totalCad)}</span>
                      </div>
                    </div>

                    {/* Payment Terms */}
                    <div className="space-y-2 text-sm bg-muted/30 rounded-lg p-3">
                      <div className="font-medium">{t("designAgreement.paymentTerms")}</div>
                      <p className="text-muted-foreground" data-testid="text-payment-terms">
                        {agreement.paymentTerms || t("designAgreement.defaultPaymentTerms")}
                      </p>
                    </div>

                    {agreement.validUntil && (
                      <div className="space-y-1 text-sm">
                        <div className="font-medium">{t("designAgreement.validUntil")}</div>
                        <p className="text-muted-foreground" data-testid="text-valid-until">
                          {formatDate(agreement.validUntil)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Deliverables */}
                  <div className="space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      {t("designAgreement.deliverablesDetailed")}
                    </h4>
                    <ul className="space-y-2 text-sm">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                        <li key={i} className="flex items-start gap-2" data-testid={`deliverable-detail-${i}`}>
                          <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                          <span>{t(`designAgreement.deliverableDetail${i}`)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <Separator />

                {/* Exclusions and Timeline Row */}
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Exclusions */}
                  <div className="space-y-3" data-testid="section-exclusions">
                    <h4 className="font-medium flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-destructive" />
                      {t("designAgreement.exclusions")}
                    </h4>
                    <ul className="space-y-2 text-sm">
                      {[1, 2, 3, 4].map((i) => (
                        <li key={i} className="flex items-start gap-2" data-testid={`exclusion-${i}`}>
                          <XCircle className="w-4 h-4 text-destructive/70 mt-0.5 shrink-0" />
                          <span className="text-muted-foreground">{t(`designAgreement.exclusion${i}`)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Timeline */}
                  <div className="space-y-3" data-testid="section-timeline">
                    <h4 className="font-medium flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary" />
                      {t("designAgreement.timeline")}
                    </h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2" data-testid="timeline-visit">
                        <Clock className="w-4 h-4 text-primary/70 mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{t("designAgreement.timelineVisit")}</span>
                      </li>
                      <li className="flex items-start gap-2" data-testid="timeline-delivery">
                        <Clock className="w-4 h-4 text-primary/70 mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{t("designAgreement.timelineDelivery")}</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Credit Policy Highlight */}
                <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4 border border-green-200 dark:border-green-800" data-testid="section-credit-policy">
                  <div className="flex items-start gap-3">
                    <Gift className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="font-medium text-green-700 dark:text-green-400 mb-1">{t("designAgreement.creditPolicy")}</h4>
                      <p className="text-sm text-green-600 dark:text-green-500">{t("designAgreement.creditPolicyText")}</p>
                    </div>
                  </div>
                </div>

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

                <Separator />

                {/* Client signing link */}
                {agreement.publicToken && (
                  <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <ExternalLink className="w-4 h-4" />
                      {t("designAgreement.sendToClient")}
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-background p-2 rounded border truncate" data-testid="text-client-link">
                        {`${window.location.origin}/sign/${agreement.publicToken}`}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/sign/${agreement.publicToken}`);
                          toast({ title: t("designAgreement.linkCopied") });
                        }}
                        data-testid="button-copy-link"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        data-testid="button-view-client-page"
                      >
                        <a href={`/sign/${agreement.publicToken}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-3 justify-end">
                  <Button
                    variant="outline"
                    asChild
                    data-testid="button-download-agreement-pdf"
                  >
                    <a href={`/api/design-agreements/${agreement.id}/pdf?lang=${language}`} target="_blank" rel="noopener noreferrer">
                      <Download className="w-4 h-4 mr-2" />
                      {t("designAgreement.downloadPdf")}
                    </a>
                  </Button>
                  {agreement.status === "draft" && (
                    <Button
                      onClick={() => updateStatusMutation.mutate("sent")}
                      disabled={updateStatusMutation.isPending}
                      data-testid="button-send-agreement"
                    >
                      {updateStatusMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 mr-2" />
                      )}
                      {t("designAgreement.send")}
                    </Button>
                  )}
                  {agreement.status === "sent" && (
                    <Button
                      onClick={() => updateStatusMutation.mutate("accepted")}
                      disabled={updateStatusMutation.isPending}
                      variant="default"
                      className="bg-green-600 hover:bg-green-700"
                      data-testid="button-accept-agreement"
                    >
                      {updateStatusMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                      )}
                      {t("designAgreement.markAccepted")}
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
      
      {/* Pricing Configuration Dialog */}
      <Dialog open={pricingDialogOpen} onOpenChange={setPricingDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              {t("designAgreement.pricingConfig")}
            </DialogTitle>
            <DialogDescription>
              {t("designAgreement.pricingConfigDescription")}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* System Configuration */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                {t("designAgreement.systemConfig")}
              </h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="numBuildings" className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {t("designAgreement.numBuildings")}
                  </Label>
                  <Input
                    id="numBuildings"
                    type="number"
                    min={1}
                    value={pricingConfig.numBuildings}
                    onChange={(e) => setPricingConfig(prev => ({ ...prev, numBuildings: parseInt(e.target.value) || 1 }))}
                    data-testid="input-num-buildings"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="travelDays" className="flex items-center gap-1">
                    <Car className="w-3 h-3" />
                    {t("designAgreement.travelDays")}
                  </Label>
                  <Input
                    id="travelDays"
                    type="number"
                    min={0}
                    value={pricingConfig.travelDays}
                    onChange={(e) => setPricingConfig(prev => ({ ...prev, travelDays: parseInt(e.target.value) || 0 }))}
                    data-testid="input-travel-days"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="pvSizeKW" className="flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    {t("designAgreement.pvSizeKW")}
                  </Label>
                  <Input
                    id="pvSizeKW"
                    type="number"
                    min={0}
                    value={pricingConfig.pvSizeKW}
                    onChange={(e) => setPricingConfig(prev => ({ ...prev, pvSizeKW: parseFloat(e.target.value) || 0 }))}
                    data-testid="input-pv-size"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="battEnergyKWh" className="flex items-center gap-1">
                    <Battery className="w-3 h-3" />
                    {t("designAgreement.battEnergyKWh")}
                  </Label>
                  <Input
                    id="battEnergyKWh"
                    type="number"
                    min={0}
                    value={pricingConfig.battEnergyKWh}
                    onChange={(e) => setPricingConfig(prev => ({ ...prev, battEnergyKWh: parseFloat(e.target.value) || 0 }))}
                    data-testid="input-battery-size"
                  />
                </div>
              </div>
            </div>
            
            <Separator />
            
            {/* Engineering Stamps */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Stamp className="w-4 h-4 text-primary" />
                {t("designAgreement.engineeringStamps")}
              </h4>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="structuralStamp"
                      checked={pricingConfig.includeStructuralStamp}
                      onCheckedChange={(checked) => setPricingConfig(prev => ({ ...prev, includeStructuralStamp: checked === true }))}
                      data-testid="checkbox-structural-stamp"
                    />
                    <Label htmlFor="structuralStamp" className="cursor-pointer">
                      {t("designAgreement.structuralStamp")}
                    </Label>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    +{formatCurrency(pricingConfig.structuralStampFee)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="electricalStamp"
                      checked={pricingConfig.includeElectricalStamp}
                      onCheckedChange={(checked) => setPricingConfig(prev => ({ ...prev, includeElectricalStamp: checked === true }))}
                      data-testid="checkbox-electrical-stamp"
                    />
                    <Label htmlFor="electricalStamp" className="cursor-pointer">
                      {t("designAgreement.electricalStamp")}
                    </Label>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    +{formatCurrency(pricingConfig.electricalStampFee)}
                  </span>
                </div>
              </div>
            </div>
            
            <Separator />
            
            {/* Cost Summary */}
            <div className="space-y-3 bg-muted/30 rounded-lg p-4">
              <h4 className="font-medium text-sm">{t("designAgreement.costSummary")}</h4>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>{t("designAgreement.baseFee")} ({pricingConfig.numBuildings} × {formatCurrency(pricingConfig.baseFeePerBuilding)})</span>
                  <span>{formatCurrency(calculatedPricing.baseFee)}</span>
                </div>
                
                {pricingConfig.pvSizeKW > 0 && (
                  <div className="flex justify-between">
                    <span>{t("designAgreement.pvFee")} ({pricingConfig.pvSizeKW} kW × {formatCurrency(pricingConfig.pricePerKW)})</span>
                    <span>{formatCurrency(calculatedPricing.pvFee)}</span>
                  </div>
                )}
                
                {pricingConfig.battEnergyKWh > 0 && (
                  <div className="flex justify-between">
                    <span>{t("designAgreement.batteryFee")} ({pricingConfig.battEnergyKWh} kWh × {formatCurrency(pricingConfig.pricePerKWh)})</span>
                    <span>{formatCurrency(calculatedPricing.batteryFee)}</span>
                  </div>
                )}
                
                {pricingConfig.travelDays > 0 && (
                  <div className="flex justify-between">
                    <span>{t("designAgreement.travelFee")} ({pricingConfig.travelDays} × {formatCurrency(pricingConfig.travelCostPerDay)})</span>
                    <span>{formatCurrency(calculatedPricing.travelFee)}</span>
                  </div>
                )}
                
                {pricingConfig.includeStructuralStamp && (
                  <div className="flex justify-between">
                    <span>{t("designAgreement.structuralStamp")}</span>
                    <span>{formatCurrency(calculatedPricing.structuralFee)}</span>
                  </div>
                )}
                
                {pricingConfig.includeElectricalStamp && (
                  <div className="flex justify-between">
                    <span>{t("designAgreement.electricalStamp")}</span>
                    <span>{formatCurrency(calculatedPricing.electricalFee)}</span>
                  </div>
                )}
                
                <Separator className="my-2" />
                
                <div className="flex justify-between">
                  <span>{t("designAgreement.subtotal")}</span>
                  <span>{formatCurrency(calculatedPricing.subtotal)}</span>
                </div>
                
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("designAgreement.gst")} (5%)</span>
                  <span>{formatCurrency(calculatedPricing.gst)}</span>
                </div>
                
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("designAgreement.qst")} (9.975%)</span>
                  <span>{formatCurrency(calculatedPricing.qst)}</span>
                </div>
                
                <Separator className="my-2" />
                
                <div className="flex justify-between font-semibold text-base">
                  <span>{t("designAgreement.total")}</span>
                  <span className="text-primary">{formatCurrency(calculatedPricing.total)}</span>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setPricingDialogOpen(false)} data-testid="button-cancel-pricing">
              {t("common.cancel")}
            </Button>
            <Button 
              onClick={handleGenerateAgreement} 
              disabled={generateMutation.isPending}
              data-testid="button-confirm-generate"
            >
              {generateMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              {t("designAgreement.generate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Collapsible>
  );
}
