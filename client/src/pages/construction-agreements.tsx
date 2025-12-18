import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  FileText, Building2, Calendar, DollarSign, CheckCircle2, 
  Clock, XCircle, Send, Eye, Filter 
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import type { ConstructionAgreement, Site, Client } from "@shared/schema";

interface ConstructionAgreementWithDetails extends ConstructionAgreement {
  site?: Site & { client?: Client };
}

type AgreementStatus = "draft" | "sent" | "accepted" | "in_progress" | "completed" | "cancelled";

const statusConfig: Record<AgreementStatus, { 
  color: string; 
  icon: typeof FileText;
  labelFr: string;
  labelEn: string;
}> = {
  draft: { 
    color: "bg-muted text-muted-foreground", 
    icon: FileText,
    labelFr: "Brouillon",
    labelEn: "Draft"
  },
  sent: { 
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300", 
    icon: Send,
    labelFr: "Envoyé",
    labelEn: "Sent"
  },
  accepted: { 
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300", 
    icon: CheckCircle2,
    labelFr: "Accepté",
    labelEn: "Accepted"
  },
  in_progress: { 
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300", 
    icon: Clock,
    labelFr: "En cours",
    labelEn: "In Progress"
  },
  completed: { 
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300", 
    icon: CheckCircle2,
    labelFr: "Complété",
    labelEn: "Completed"
  },
  cancelled: { 
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300", 
    icon: XCircle,
    labelFr: "Annulé",
    labelEn: "Cancelled"
  },
};

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(date: Date | string | null | undefined, language: "fr" | "en"): string {
  if (!date) return "—";
  const d = new Date(date);
  return d.toLocaleDateString(language === "fr" ? "fr-CA" : "en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function AgreementCard({ agreement }: { agreement: ConstructionAgreementWithDetails }) {
  const { language } = useI18n();
  
  const status = (agreement.status as AgreementStatus) || "draft";
  const config = statusConfig[status];
  const StatusIcon = config.icon;
  const statusLabel = language === "fr" ? config.labelFr : config.labelEn;
  
  const siteName = agreement.site?.name || "—";
  const clientName = agreement.site?.client?.name || "—";
  const hasDepositPaid = !!agreement.depositPaidAt;

  return (
    <Card className="hover-elevate" data-testid={`card-agreement-${agreement.id}`}>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold truncate" data-testid={`text-contract-number-${agreement.id}`}>
                  {agreement.contractNumber || `#${agreement.id.slice(0, 8)}`}
                </h3>
                <p className="text-sm text-muted-foreground truncate" data-testid={`text-site-client-${agreement.id}`}>
                  {siteName} • {clientName}
                </p>
              </div>
            </div>
            <Badge className={`${config.color} gap-1 shrink-0`} data-testid={`badge-status-${agreement.id}`}>
              <StatusIcon className="w-3 h-3" />
              {statusLabel}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {language === "fr" ? "Valeur:" : "Value:"}
              </span>
              <span className="font-mono font-medium text-primary" data-testid={`text-value-${agreement.id}`}>
                {formatCurrency(agreement.totalContractValue)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">PV:</span>
              <span className="font-mono font-medium">
                {agreement.pvSizeKW ? `${agreement.pvSizeKW.toFixed(0)} kWc` : "—"}
              </span>
            </div>
            <div className="flex items-center gap-2 col-span-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {language === "fr" ? "Début estimé:" : "Est. start:"}
              </span>
              <span className="font-medium" data-testid={`text-start-date-${agreement.id}`}>
                {formatDate(agreement.estimatedStartDate, language)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {language === "fr" ? "Dépôt:" : "Deposit:"}
              </span>
              {hasDepositPaid ? (
                <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 gap-1" data-testid={`badge-deposit-paid-${agreement.id}`}>
                  <CheckCircle2 className="w-3 h-3" />
                  {language === "fr" ? "Payé" : "Paid"}
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1" data-testid={`badge-deposit-pending-${agreement.id}`}>
                  <Clock className="w-3 h-3" />
                  {language === "fr" ? "En attente" : "Pending"}
                </Badge>
              )}
              {agreement.depositAmount && (
                <span className="text-sm font-mono">
                  ({formatCurrency(agreement.depositAmount)})
                </span>
              )}
            </div>
            <Link href={`/app/construction-agreements/${agreement.id}`}>
              <Button variant="outline" size="sm" className="gap-1.5" data-testid={`button-view-agreement-${agreement.id}`}>
                <Eye className="w-3.5 h-3.5" />
                {language === "fr" ? "Voir" : "View"}
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ConstructionAgreementsPage() {
  const { language } = useI18n();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: agreements, isLoading } = useQuery<ConstructionAgreementWithDetails[]>({
    queryKey: ["/api/construction-agreements"],
  });

  const filteredAgreements = agreements?.filter(agreement => {
    if (statusFilter === "all") return true;
    return agreement.status === statusFilter;
  });

  const statusOptions = [
    { value: "all", labelFr: "Tous les statuts", labelEn: "All statuses" },
    { value: "draft", labelFr: "Brouillon", labelEn: "Draft" },
    { value: "sent", labelFr: "Envoyé", labelEn: "Sent" },
    { value: "accepted", labelFr: "Accepté", labelEn: "Accepted" },
    { value: "in_progress", labelFr: "En cours", labelEn: "In Progress" },
    { value: "completed", labelFr: "Complété", labelEn: "Completed" },
    { value: "cancelled", labelFr: "Annulé", labelEn: "Cancelled" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
            {language === "fr" ? "Contrats de construction" : "Construction Agreements"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {language === "fr" 
              ? "Gérez vos contrats et suivez les paiements" 
              : "Manage your contracts and track payments"}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {language === "fr" ? option.labelFr : option.labelEn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-xl" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredAgreements && filteredAgreements.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAgreements.map((agreement) => (
            <AgreementCard key={agreement.id} agreement={agreement} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-1">
              {language === "fr" ? "Aucun contrat" : "No agreements"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {statusFilter !== "all" 
                ? (language === "fr" 
                    ? "Aucun contrat avec ce statut." 
                    : "No agreements with this status.")
                : (language === "fr" 
                    ? "Créez un design puis générez un contrat de construction." 
                    : "Create a design then generate a construction agreement.")}
            </p>
            {statusFilter !== "all" && (
              <Button 
                variant="outline" 
                onClick={() => setStatusFilter("all")}
                data-testid="button-clear-filter"
              >
                {language === "fr" ? "Voir tous les contrats" : "View all agreements"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
