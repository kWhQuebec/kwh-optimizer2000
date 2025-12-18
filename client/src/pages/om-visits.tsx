import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import { fr, enCA } from "date-fns/locale";
import { 
  Wrench, Building2, Calendar, User, Filter, Eye, CheckCircle,
  AlertTriangle, Clock, XCircle, ClipboardCheck
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Site, OmContract } from "@shared/schema";

interface OmVisit {
  id: string;
  omContractId: string;
  siteId: string;
  visitType: string;
  status: string;
  scheduledDate: string | null;
  actualDate: string | null;
  duration: number | null;
  technicianName: string | null;
  technicianId: string | null;
  issuesFound: number | null;
  issuesResolved: number | null;
  actionsTaken: string | null;
  followUpRequired: boolean | null;
  clientVisibleNotes: string | null;
  createdAt: string;
  site?: Site;
  contract?: OmContract;
}

function formatDate(dateStr: string | null | undefined, language: string): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return format(date, "PP", { locale: language === "fr" ? fr : enCA });
}

function getStatusBadgeClass(status: string): string {
  const statusClasses: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    in_progress: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  };
  return statusClasses[status] || statusClasses.scheduled;
}

function getVisitTypeBadgeClass(visitType: string): string {
  const typeClasses: Record<string, string> = {
    scheduled: "bg-primary/10 text-primary",
    emergency: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    warranty: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
    inspection: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300",
  };
  return typeClasses[visitType] || typeClasses.scheduled;
}

function getStatusLabel(status: string, language: string): string {
  const labels: Record<string, Record<string, string>> = {
    scheduled: { fr: "Planifié", en: "Scheduled" },
    in_progress: { fr: "En cours", en: "In Progress" },
    completed: { fr: "Complété", en: "Completed" },
    cancelled: { fr: "Annulé", en: "Cancelled" },
  };
  return labels[status]?.[language] || status;
}

function getVisitTypeLabel(visitType: string, language: string): string {
  const labels: Record<string, Record<string, string>> = {
    scheduled: { fr: "Planifié", en: "Scheduled" },
    emergency: { fr: "Urgence", en: "Emergency" },
    warranty: { fr: "Garantie", en: "Warranty" },
    inspection: { fr: "Inspection", en: "Inspection" },
  };
  return labels[visitType]?.[language] || visitType;
}

function getStatusIcon(status: string) {
  switch (status) {
    case "scheduled":
      return <Clock className="w-4 h-4" />;
    case "in_progress":
      return <AlertTriangle className="w-4 h-4" />;
    case "completed":
      return <CheckCircle className="w-4 h-4" />;
    case "cancelled":
      return <XCircle className="w-4 h-4" />;
    default:
      return <Clock className="w-4 h-4" />;
  }
}

export default function OmVisitsPage() {
  const { language, t } = useI18n();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [visitTypeFilter, setVisitTypeFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  const { data: visits, isLoading } = useQuery<OmVisit[]>({
    queryKey: ["/api/om-visits"],
  });

  const completeVisitMutation = useMutation({
    mutationFn: async (visitId: string) => {
      return apiRequest("PATCH", `/api/om-visits/${visitId}`, { status: "completed" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/om-visits"] });
      toast({
        title: language === "fr" ? "Visite complétée" : "Visit completed",
        description: language === "fr" ? "Le statut de la visite a été mis à jour." : "The visit status has been updated.",
      });
    },
    onError: () => {
      toast({
        title: language === "fr" ? "Erreur" : "Error",
        description: language === "fr" ? "Impossible de mettre à jour la visite." : "Could not update the visit.",
        variant: "destructive",
      });
    },
  });

  const filteredVisits = visits?.filter((visit) => {
    const matchesStatus = statusFilter === "all" || visit.status === statusFilter;
    const matchesType = visitTypeFilter === "all" || visit.visitType === visitTypeFilter;
    
    let matchesDateRange = true;
    if (dateFrom || dateTo) {
      const visitDate = visit.scheduledDate ? new Date(visit.scheduledDate) : null;
      if (visitDate) {
        if (dateFrom && visitDate < dateFrom) matchesDateRange = false;
        if (dateTo && visitDate > dateTo) matchesDateRange = false;
      } else {
        matchesDateRange = false;
      }
    }
    
    return matchesStatus && matchesType && matchesDateRange;
  });

  const statusCounts = visits?.reduce((acc, visit) => {
    acc[visit.status] = (acc[visit.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const typeCounts = visits?.reduce((acc, visit) => {
    acc[visit.visitType] = (acc[visit.visitType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const clearFilters = () => {
    setStatusFilter("all");
    setVisitTypeFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const hasActiveFilters = statusFilter !== "all" || visitTypeFilter !== "all" || dateFrom || dateTo;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-om-visits">
          {language === "fr" ? "Visites O&M" : "O&M Visits"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {language === "fr" 
            ? "Gérez les visites de maintenance planifiées et effectuées" 
            : "Manage scheduled and completed maintenance visits"}
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
            <SelectItem value="scheduled">
              {getStatusLabel("scheduled", language)} ({statusCounts.scheduled || 0})
            </SelectItem>
            <SelectItem value="in_progress">
              {getStatusLabel("in_progress", language)} ({statusCounts.in_progress || 0})
            </SelectItem>
            <SelectItem value="completed">
              {getStatusLabel("completed", language)} ({statusCounts.completed || 0})
            </SelectItem>
            <SelectItem value="cancelled">
              {getStatusLabel("cancelled", language)} ({statusCounts.cancelled || 0})
            </SelectItem>
          </SelectContent>
        </Select>

        <Select value={visitTypeFilter} onValueChange={setVisitTypeFilter}>
          <SelectTrigger className="w-40" data-testid="select-type-filter">
            <SelectValue placeholder={language === "fr" ? "Type" : "Type"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {language === "fr" ? "Tous les types" : "All types"}
            </SelectItem>
            <SelectItem value="scheduled">
              {getVisitTypeLabel("scheduled", language)} ({typeCounts.scheduled || 0})
            </SelectItem>
            <SelectItem value="emergency">
              {getVisitTypeLabel("emergency", language)} ({typeCounts.emergency || 0})
            </SelectItem>
            <SelectItem value="warranty">
              {getVisitTypeLabel("warranty", language)} ({typeCounts.warranty || 0})
            </SelectItem>
            <SelectItem value="inspection">
              {getVisitTypeLabel("inspection", language)} ({typeCounts.inspection || 0})
            </SelectItem>
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-date-from">
              <Calendar className="w-4 h-4" />
              {dateFrom ? format(dateFrom, "PP", { locale: language === "fr" ? fr : enCA }) : (language === "fr" ? "Date début" : "Start date")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarPicker
              mode="single"
              selected={dateFrom}
              onSelect={setDateFrom}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-date-to">
              <Calendar className="w-4 h-4" />
              {dateTo ? format(dateTo, "PP", { locale: language === "fr" ? fr : enCA }) : (language === "fr" ? "Date fin" : "End date")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarPicker
              mode="single"
              selected={dateTo}
              onSelect={setDateTo}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {hasActiveFilters && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={clearFilters}
            data-testid="button-clear-filters"
          >
            {language === "fr" ? "Effacer filtres" : "Clear filters"}
          </Button>
        )}
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === "fr" ? "Site" : "Site"}</TableHead>
                  <TableHead>{language === "fr" ? "Type" : "Type"}</TableHead>
                  <TableHead>{language === "fr" ? "Statut" : "Status"}</TableHead>
                  <TableHead>{language === "fr" ? "Date planifiée" : "Scheduled Date"}</TableHead>
                  <TableHead>{language === "fr" ? "Technicien" : "Technician"}</TableHead>
                  <TableHead>{language === "fr" ? "Problèmes" : "Issues"}</TableHead>
                  <TableHead>{language === "fr" ? "Actions" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[1, 2, 3, 4, 5].map((i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : filteredVisits && filteredVisits.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === "fr" ? "Site" : "Site"}</TableHead>
                  <TableHead>{language === "fr" ? "Type" : "Type"}</TableHead>
                  <TableHead>{language === "fr" ? "Statut" : "Status"}</TableHead>
                  <TableHead>{language === "fr" ? "Date planifiée" : "Scheduled Date"}</TableHead>
                  <TableHead>{language === "fr" ? "Technicien" : "Technician"}</TableHead>
                  <TableHead>{language === "fr" ? "Problèmes" : "Issues"}</TableHead>
                  <TableHead>{language === "fr" ? "Actions" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVisits.map((visit) => (
                  <TableRow key={visit.id} data-testid={`row-visit-${visit.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate max-w-[200px]" data-testid={`text-site-${visit.id}`}>
                          {visit.site?.name || "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getVisitTypeBadgeClass(visit.visitType)} data-testid={`badge-type-${visit.id}`}>
                        {getVisitTypeLabel(visit.visitType, language)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`gap-1 ${getStatusBadgeClass(visit.status)}`} data-testid={`badge-status-${visit.id}`}>
                        {getStatusIcon(visit.status)}
                        {getStatusLabel(visit.status, language)}
                      </Badge>
                    </TableCell>
                    <TableCell data-testid={`text-date-${visit.id}`}>
                      {formatDate(visit.scheduledDate, language)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="truncate max-w-[150px]" data-testid={`text-technician-${visit.id}`}>
                          {visit.technicianName || (language === "fr" ? "Non assigné" : "Unassigned")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm" data-testid={`text-issues-${visit.id}`}>
                        <span className="text-red-600 dark:text-red-400 font-medium">
                          {visit.issuesFound ?? 0}
                        </span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-green-600 dark:text-green-400 font-medium">
                          {visit.issuesResolved ?? 0}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({language === "fr" ? "trouvés/résolus" : "found/resolved"})
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Link href={`/app/sites/${visit.siteId}`}>
                          <Button variant="outline" size="sm" className="gap-1.5" data-testid={`button-view-${visit.id}`}>
                            <Eye className="w-3.5 h-3.5" />
                            {t("common.view")}
                          </Button>
                        </Link>
                        {visit.status !== "completed" && visit.status !== "cancelled" && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="gap-1.5"
                            onClick={() => completeVisitMutation.mutate(visit.id)}
                            disabled={completeVisitMutation.isPending}
                            data-testid={`button-complete-${visit.id}`}
                          >
                            <ClipboardCheck className="w-3.5 h-3.5" />
                            {language === "fr" ? "Compléter" : "Complete"}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <Wrench className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-1">
              {language === "fr" ? "Aucune visite O&M" : "No O&M visits"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {language === "fr" 
                ? "Les visites de maintenance apparaîtront ici une fois planifiées." 
                : "Maintenance visits will appear here once scheduled."}
            </p>
            <Link href="/app/om-contracts">
              <Button variant="outline" className="gap-2">
                <Building2 className="w-4 h-4" />
                {language === "fr" ? "Voir les contrats O&M" : "View O&M contracts"}
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
