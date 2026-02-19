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
  Copy,
  ExternalLink,
  XCircle,
  Calendar,
  Gift,
  Info,
  Trash2,
  Mail,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { DesignAgreement, EmailLog, Site, Client } from "@shared/schema";

interface DesignAgreementSectionProps {
  siteId: string;
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
  
  // Email dialog state
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailForm, setEmailForm] = useState({
    recipientEmail: "",
    recipientName: "",
    subject: "",
    body: "",
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

  // Fetch site data for email defaults
  const { data: siteData } = useQuery<Site>({
    queryKey: ["/api/sites", siteId],
  });

  // Fetch client data for email defaults
  const { data: clientData } = useQuery<Client>({
    queryKey: ["/api/clients", siteData?.clientId],
    enabled: !!siteData?.clientId,
  });

  // Fetch email logs for this agreement
  const { data: emailLogs } = useQuery<EmailLog[]>({
    queryKey: ["/api/design-agreements", agreement?.id, "email-logs"],
    queryFn: async () => {
      if (!agreement?.id) return [];
      const token = localStorage.getItem("token");
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/design-agreements/${agreement.id}/email-logs`, { 
        credentials: "include",
        headers,
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!agreement?.id,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/sites/${siteId}/generate-design-agreement`, {});
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
  
  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/design-agreements/${agreement?.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites", siteId, "design-agreement"] });
      toast({ title: t("designAgreement.deleted") });
    },
    onError: () => {
      toast({ title: t("designAgreement.deleteError"), variant: "destructive" });
    },
  });

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async (data: { recipientEmail: string; recipientName: string; subject: string; body: string }) => {
      return apiRequest("POST", `/api/design-agreements/${agreement?.id}/send-email`, {
        ...data,
        language,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites", siteId, "design-agreement"] });
      queryClient.invalidateQueries({ queryKey: ["/api/design-agreements", agreement?.id, "email-logs"] });
      setEmailDialogOpen(false);
      toast({ title: t("designAgreement.emailDialog.success") });
    },
    onError: () => {
      toast({ title: t("designAgreement.emailDialog.error"), variant: "destructive" });
    },
  });

  // Open email dialog with default values
  const handleOpenEmailDialog = () => {
    const siteName = siteData?.name || "";
    const clientName = clientData?.name || "";
    const clientEmail = clientData?.email || "";
    
    // Get default subject and body with placeholders replaced
    const defaultSubject = t("designAgreement.emailDialog.defaultSubject")
      .replace("{{siteName}}", siteName);
    const defaultBody = t("designAgreement.emailDialog.defaultBody")
      .replace("{{clientName}}", clientName)
      .replace("{{siteName}}", siteName);
    
    setEmailForm({
      recipientEmail: clientEmail,
      recipientName: clientName,
      subject: defaultSubject,
      body: defaultBody,
    });
    setEmailDialogOpen(true);
  };

  const handleSendEmail = () => {
    if (!emailForm.recipientEmail || !emailForm.subject) {
      toast({ title: t("common.fillRequiredFields"), variant: "destructive" });
      return;
    }
    sendEmailMutation.mutate(emailForm);
  };

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  if (agreementLoading) {
    return (
      <Card data-testid="card-design-agreement-loading">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

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
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between" data-testid="row-fixed-fee">
                        <span>{t("designAgreement.fixedFee")}</span>
                        <span>{formatCurrency(2500)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground" data-testid="row-gst">
                        <span>{t("designAgreement.gst")}</span>
                        <span>{formatCurrency(125)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground" data-testid="row-qst">
                        <span>{t("designAgreement.qst")}</span>
                        <span>{formatCurrency(249.38)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-semibold text-base" data-testid="row-total">
                        <span>{t("designAgreement.total")}</span>
                        <span className="text-primary">{formatCurrency(2874.38)}</span>
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

                <div className="flex flex-wrap gap-3 justify-between">
                  {/* Delete button on the left */}
                  <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="text-destructive border-destructive/50 hover:bg-destructive/10"
                        data-testid="button-delete-agreement"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {t("designAgreement.delete")}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t("designAgreement.deleteConfirmTitle")}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t("designAgreement.deleteConfirmDescription")}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel data-testid="button-cancel-delete">
                          {t("common.cancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate()}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          data-testid="button-confirm-delete"
                        >
                          {deleteMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4 mr-2" />
                          )}
                          {t("designAgreement.delete")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  
                  {/* Other actions on the right */}
                  <div className="flex flex-wrap gap-3">
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
                    {(agreement.status === "draft" || agreement.status === "sent") && (
                      <Button
                        onClick={handleOpenEmailDialog}
                        disabled={sendEmailMutation.isPending}
                        data-testid="button-send-agreement"
                      >
                        {sendEmailMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Mail className="w-4 h-4 mr-2" />
                        )}
                        {agreement.status === "sent" ? t("designAgreement.resend") : t("designAgreement.send")}
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
                </div>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
      
      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              {t("designAgreement.emailDialog.title")}
            </DialogTitle>
            <DialogDescription>
              {t("designAgreement.emailDialog.description")}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="recipientEmail">{t("designAgreement.emailDialog.recipientEmail")} *</Label>
                <Input
                  id="recipientEmail"
                  type="email"
                  value={emailForm.recipientEmail}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, recipientEmail: e.target.value }))}
                  placeholder="client@example.com"
                  data-testid="input-email-recipient"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="recipientName">{t("designAgreement.emailDialog.recipientName")}</Label>
                <Input
                  id="recipientName"
                  value={emailForm.recipientName}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, recipientName: e.target.value }))}
                  placeholder="John Doe"
                  data-testid="input-email-name"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="emailSubject">{t("designAgreement.emailDialog.subject")} *</Label>
              <Input
                id="emailSubject"
                value={emailForm.subject}
                onChange={(e) => setEmailForm(prev => ({ ...prev, subject: e.target.value }))}
                data-testid="input-email-subject"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="emailBody">{t("designAgreement.emailDialog.message")}</Label>
              <Textarea
                id="emailBody"
                value={emailForm.body}
                onChange={(e) => setEmailForm(prev => ({ ...prev, body: e.target.value }))}
                rows={8}
                className="resize-none"
                data-testid="input-email-body"
              />
            </div>

            {/* Email History */}
            {emailLogs && emailLogs.length > 0 && (
              <div className="space-y-2 pt-4 border-t">
                <Label className="flex items-center gap-2">
                  <History className="w-4 h-4" />
                  {t("designAgreement.emailHistory")}
                </Label>
                <div className="space-y-1 text-sm text-muted-foreground">
                  {emailLogs.slice(0, 3).map((log) => (
                    <div key={log.id} className="flex items-center gap-2" data-testid={`email-log-${log.id}`}>
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                      <span>
                        {t("designAgreement.emailSentOn")
                          .replace("{{date}}", formatDate(log.createdAt))
                          .replace("{{email}}", log.recipientEmail)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)} data-testid="button-cancel-email">
              {t("common.cancel")}
            </Button>
            <Button 
              onClick={handleSendEmail} 
              disabled={sendEmailMutation.isPending || !emailForm.recipientEmail || !emailForm.subject}
              data-testid="button-confirm-send-email"
            >
              {sendEmailMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("designAgreement.emailDialog.sending")}
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  {t("designAgreement.emailDialog.send")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Collapsible>
  );
}
