import { useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { DesignAgreement, SiteVisit } from "@shared/schema";

interface DesignAgreementSectionProps {
  siteId: string;
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

export function DesignAgreementSection({ siteId }: DesignAgreementSectionProps) {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(true);

  const { data: agreement, isLoading: agreementLoading } = useQuery<DesignAgreement>({
    queryKey: ["/api/sites", siteId, "design-agreement"],
    queryFn: async () => {
      const res = await fetch(`/api/sites/${siteId}/design-agreement`, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch agreement");
      return res.json();
    },
  });

  const { data: siteVisits } = useQuery<SiteVisit[]>({
    queryKey: ["/api/sites", siteId, "site-visits"],
  });

  const latestVisit = siteVisits?.find(v => v.status !== "cancelled");

  const generateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/sites/${siteId}/generate-design-agreement`, {
        siteVisitId: latestVisit?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites", siteId, "design-agreement"] });
      toast({ title: t("designAgreement.created") });
    },
    onError: () => {
      toast({ title: t("designAgreement.createError"), variant: "destructive" });
    },
  });

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
                {!latestVisit ? (
                  <>
                    <AlertCircle className="w-10 h-10 mx-auto text-muted-foreground" />
                    <p className="text-muted-foreground">{t("designAgreement.noVisit")}</p>
                    <p className="text-sm text-muted-foreground">{t("designAgreement.scheduleVisitFirst")}</p>
                  </>
                ) : (
                  <>
                    <DollarSign className="w-10 h-10 mx-auto text-primary" />
                    <p className="text-muted-foreground">
                      {t("designAgreement.subtitle")}
                    </p>
                    <Button
                      onClick={() => generateMutation.mutate()}
                      disabled={generateMutation.isPending}
                      data-testid="button-generate-agreement"
                    >
                      {generateMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4 mr-2" />
                      )}
                      {t("designAgreement.generate")}
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <h4 className="font-medium flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      {t("designAgreement.costBreakdown")}
                    </h4>
                    
                    {siteVisitCosts && (
                      <div className="space-y-2 text-sm">
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

                    <Separator />

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
                        <span>{formatCurrency(agreement.totalCad)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-medium flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      {t("designAgreement.deliverables")}
                    </h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2" data-testid="deliverable-1">
                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                        {t("designAgreement.deliverable1")}
                      </li>
                      <li className="flex items-start gap-2" data-testid="deliverable-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                        {t("designAgreement.deliverable2")}
                      </li>
                      <li className="flex items-start gap-2" data-testid="deliverable-3">
                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                        {t("designAgreement.deliverable3")}
                      </li>
                      <li className="flex items-start gap-2" data-testid="deliverable-4">
                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                        {t("designAgreement.deliverable4")}
                      </li>
                      <li className="flex items-start gap-2" data-testid="deliverable-5">
                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                        {t("designAgreement.deliverable5")}
                      </li>
                    </ul>

                    <Separator />

                    <div className="space-y-2 text-sm">
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
                </div>

                <Separator />

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
    </Collapsible>
  );
}
