import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  FileCheck, Building2, Calendar, Clock, DollarSign, 
  Eye, Wrench, CalendarClock, Filter
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import type { Client, Site } from "@shared/schema";

interface OmContract {
  id: string;
  siteId: string;
  clientId: string;
  contractNumber: string | null;
  status: string;
  coverageType: string;
  pvSizeKW: number | null;
  batteryEnergyKWh: number | null;
  startDate: string | null;
  endDate: string | null;
  termMonths: number | null;
  annualFee: number | null;
  responseTimeHours: number | null;
  scheduledVisitsPerYear: number | null;
  performanceGuaranteePercent: number | null;
  createdAt: string;
  site?: Site & { client?: Client };
  client?: Client;
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateStr: string | null | undefined, language: string): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return date.toLocaleDateString(language === "fr" ? "fr-CA" : "en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getContractProgress(startDate: string | null, endDate: string | null): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const now = Date.now();
  
  if (now <= start) return 0;
  if (now >= end) return 100;
  
  return Math.round(((now - start) / (end - start)) * 100);
}

function getStatusBadgeClass(status: string): string {
  const statusClasses: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    suspended: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
    expired: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  };
  return statusClasses[status] || statusClasses.draft;
}

function getCoverageLabel(coverage: string, language: string): string {
  const labels: Record<string, Record<string, string>> = {
    basic: { fr: "Basique", en: "Basic" },
    standard: { fr: "Standard", en: "Standard" },
    premium: { fr: "Premium", en: "Premium" },
    custom: { fr: "Personnalisé", en: "Custom" },
  };
  return labels[coverage]?.[language] || coverage;
}

function getStatusLabel(status: string, language: string): string {
  const labels: Record<string, Record<string, string>> = {
    draft: { fr: "Brouillon", en: "Draft" },
    active: { fr: "Actif", en: "Active" },
    suspended: { fr: "Suspendu", en: "Suspended" },
    expired: { fr: "Expiré", en: "Expired" },
    cancelled: { fr: "Annulé", en: "Cancelled" },
  };
  return labels[status]?.[language] || status;
}

function OmContractCard({ contract }: { contract: OmContract }) {
  const { language, t } = useI18n();
  const progress = getContractProgress(contract.startDate, contract.endDate);
  const siteName = contract.site?.name || "—";
  const clientName = contract.site?.client?.name || contract.client?.name || "—";

  return (
    <Card className="hover-elevate" data-testid={`card-om-contract-${contract.id}`}>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <FileCheck className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold truncate" data-testid={`text-contract-number-${contract.id}`}>
                  {contract.contractNumber || `O&M-${contract.id.slice(0, 8).toUpperCase()}`}
                </h3>
                <p className="text-sm text-muted-foreground truncate" data-testid={`text-client-site-${contract.id}`}>
                  {siteName} • {clientName}
                </p>
              </div>
            </div>
            <Badge className={getStatusBadgeClass(contract.status)} data-testid={`badge-status-${contract.id}`}>
              {getStatusLabel(contract.status, language)}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">{language === "fr" ? "Couverture:" : "Coverage:"}</span>
              <Badge variant="outline" className="font-normal">
                {getCoverageLabel(contract.coverageType, language)}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">{language === "fr" ? "Frais annuels:" : "Annual fee:"}</span>
              <span className="font-mono font-medium text-primary" data-testid={`text-annual-fee-${contract.id}`}>
                {formatCurrency(contract.annualFee)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">{language === "fr" ? "Début:" : "Start:"}</span>
              <span className="font-medium" data-testid={`text-start-date-${contract.id}`}>
                {formatDate(contract.startDate, language)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">{language === "fr" ? "Fin:" : "End:"}</span>
              <span className="font-medium" data-testid={`text-end-date-${contract.id}`}>
                {formatDate(contract.endDate, language)}
              </span>
            </div>
          </div>

          {contract.status === "active" && contract.startDate && contract.endDate && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{language === "fr" ? "Progression du contrat" : "Contract progress"}</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" data-testid={`progress-contract-${contract.id}`} />
            </div>
          )}

          <div className="flex items-center gap-4 text-sm border-t pt-3">
            <div className="flex items-center gap-1.5">
              <Wrench className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">{language === "fr" ? "Visites/an:" : "Visits/yr:"}</span>
              <span className="font-medium" data-testid={`text-visits-${contract.id}`}>
                {contract.scheduledVisitsPerYear ?? "—"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">SLA:</span>
              <span className="font-medium" data-testid={`text-response-time-${contract.id}`}>
                {contract.responseTimeHours ? `${contract.responseTimeHours}h` : "—"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Link href={`/app/sites/${contract.siteId}`}>
              <Button variant="outline" size="sm" className="gap-1.5" data-testid={`button-view-contract-${contract.id}`}>
                <Eye className="w-3.5 h-3.5" />
                {t("common.view")}
              </Button>
            </Link>
            <Link href={`/app/sites/${contract.siteId}`}>
              <Button variant="ghost" size="sm" className="gap-1.5" data-testid={`button-maintenance-${contract.id}`}>
                <Wrench className="w-3.5 h-3.5" />
                {language === "fr" ? "Visites" : "Visits"}
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function OmContractsPage() {
  const { language, t } = useI18n();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");

  const { data: contracts, isLoading } = useQuery<OmContract[]>({
    queryKey: ["/api/om-contracts"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const filteredContracts = contracts?.filter((contract) => {
    const matchesStatus = statusFilter === "all" || contract.status === statusFilter;
    const matchesClient = clientFilter === "all" || contract.clientId === clientFilter;
    return matchesStatus && matchesClient;
  });

  const statusCounts = contracts?.reduce((acc, contract) => {
    acc[contract.status] = (acc[contract.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-om-contracts">
          {language === "fr" ? "Contrats O&M" : "O&M Contracts"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {language === "fr" 
            ? "Gérez vos contrats d'opération et maintenance" 
            : "Manage your operation and maintenance contracts"}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">{language === "fr" ? "Filtrer:" : "Filter:"}</span>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="select-status-filter">
            <SelectValue placeholder={language === "fr" ? "Statut" : "Status"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {language === "fr" ? "Tous les statuts" : "All statuses"}
            </SelectItem>
            <SelectItem value="draft">
              {getStatusLabel("draft", language)} ({statusCounts.draft || 0})
            </SelectItem>
            <SelectItem value="active">
              {getStatusLabel("active", language)} ({statusCounts.active || 0})
            </SelectItem>
            <SelectItem value="suspended">
              {getStatusLabel("suspended", language)} ({statusCounts.suspended || 0})
            </SelectItem>
            <SelectItem value="expired">
              {getStatusLabel("expired", language)} ({statusCounts.expired || 0})
            </SelectItem>
            <SelectItem value="cancelled">
              {getStatusLabel("cancelled", language)} ({statusCounts.cancelled || 0})
            </SelectItem>
          </SelectContent>
        </Select>

        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-48" data-testid="select-client-filter">
            <SelectValue placeholder={language === "fr" ? "Client" : "Client"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {language === "fr" ? "Tous les clients" : "All clients"}
            </SelectItem>
            {clients?.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(statusFilter !== "all" || clientFilter !== "all") && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => {
              setStatusFilter("all");
              setClientFilter("all");
            }}
            data-testid="button-clear-filters"
          >
            {language === "fr" ? "Effacer filtres" : "Clear filters"}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-xl" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-2 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredContracts && filteredContracts.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContracts.map((contract) => (
            <OmContractCard key={contract.id} contract={contract} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <FileCheck className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-1">
              {language === "fr" ? "Aucun contrat O&M" : "No O&M contracts"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {language === "fr" 
                ? "Les contrats d'opération et maintenance apparaîtront ici." 
                : "Operation and maintenance contracts will appear here."}
            </p>
            <Link href="/app/sites">
              <Button variant="outline" className="gap-2">
                <Building2 className="w-4 h-4" />
                {language === "fr" ? "Voir les sites" : "View sites"}
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
