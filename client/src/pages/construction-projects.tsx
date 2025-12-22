import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  HardHat, Building2, Calendar, DollarSign, User, 
  AlertTriangle, CheckCircle2, Clock, PlayCircle, 
  Settings, ClipboardList, Filter, Search, Plus, Eye 
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ConstructionProject, Site, Client, ConstructionAgreement } from "@shared/schema";

interface ConstructionProjectWithDetails extends ConstructionProject {
  site?: Site & { client?: Client };
  client?: Client;
  projectManager?: { id: string; name: string | null; email: string };
}

type ProjectStatus = "planning" | "mobilization" | "in_progress" | "commissioning" | "punch_list" | "completed";
type RiskLevel = "low" | "medium" | "high";

const statusConfig: Record<ProjectStatus, { 
  color: string; 
  icon: typeof HardHat;
  labelFr: string;
  labelEn: string;
}> = {
  planning: { 
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300", 
    icon: ClipboardList,
    labelFr: "Planification",
    labelEn: "Planning"
  },
  mobilization: { 
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300", 
    icon: Settings,
    labelFr: "Mobilisation",
    labelEn: "Mobilization"
  },
  in_progress: { 
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300", 
    icon: PlayCircle,
    labelFr: "En cours",
    labelEn: "In Progress"
  },
  commissioning: { 
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300", 
    icon: Clock,
    labelFr: "Mise en service",
    labelEn: "Commissioning"
  },
  punch_list: { 
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300", 
    icon: AlertTriangle,
    labelFr: "Punch list",
    labelEn: "Punch List"
  },
  completed: { 
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300", 
    icon: CheckCircle2,
    labelFr: "Complété",
    labelEn: "Completed"
  },
};

const riskConfig: Record<RiskLevel, { 
  color: string; 
  labelFr: string;
  labelEn: string;
}> = {
  low: { 
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300", 
    labelFr: "Faible",
    labelEn: "Low"
  },
  medium: { 
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300", 
    labelFr: "Moyen",
    labelEn: "Medium"
  },
  high: { 
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300", 
    labelFr: "Élevé",
    labelEn: "High"
  },
};

const workflowSteps: { key: ProjectStatus; labelFr: string; labelEn: string }[] = [
  { key: "planning", labelFr: "Plan", labelEn: "Plan" },
  { key: "mobilization", labelFr: "Mob", labelEn: "Mob" },
  { key: "in_progress", labelFr: "Constr", labelEn: "Build" },
  { key: "commissioning", labelFr: "Mise", labelEn: "Comm" },
  { key: "punch_list", labelFr: "Punch", labelEn: "Punch" },
  { key: "completed", labelFr: "Fini", labelEn: "Done" },
];

function WorkflowStepsIndicator({ currentStatus, language }: { currentStatus: ProjectStatus; language: "fr" | "en" }) {
  const currentIndex = workflowSteps.findIndex(s => s.key === currentStatus);
  
  return (
    <div className="flex items-center gap-1 w-full" data-testid="workflow-steps">
      {workflowSteps.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isPending = index > currentIndex;
        
        return (
          <div key={step.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div 
                className={`w-3 h-3 rounded-full flex items-center justify-center transition-colors ${
                  isCompleted 
                    ? "bg-green-500" 
                    : isCurrent 
                    ? "bg-primary ring-2 ring-primary/30" 
                    : "bg-muted"
                }`}
                title={language === "fr" ? step.labelFr : step.labelEn}
              >
                {isCompleted && <CheckCircle2 className="w-2 h-2 text-white" />}
              </div>
              <span className={`text-[9px] mt-0.5 ${isCurrent ? "font-medium text-primary" : "text-muted-foreground"}`}>
                {language === "fr" ? step.labelFr : step.labelEn}
              </span>
            </div>
            {index < workflowSteps.length - 1 && (
              <div className={`h-0.5 flex-1 mx-0.5 ${isCompleted ? "bg-green-500" : "bg-muted"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

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

function ProjectCard({ project }: { project: ConstructionProjectWithDetails }) {
  const { language } = useI18n();
  
  const status = (project.status as ProjectStatus) || "planning";
  const config = statusConfig[status];
  const StatusIcon = config.icon;
  const statusLabel = language === "fr" ? config.labelFr : config.labelEn;
  
  const riskLevel = (project.riskLevel as RiskLevel) || "low";
  const risk = riskConfig[riskLevel];
  const riskLabel = language === "fr" ? risk.labelFr : risk.labelEn;
  
  const siteName = project.site?.name || "—";
  const clientName = project.site?.client?.name || project.client?.name || "—";
  const projectManagerName = project.projectManager?.name || "—";
  
  const progress = project.progressPercent ?? 0;
  const budgetTotal = project.budgetTotal ?? 0;
  const budgetSpent = project.budgetSpent ?? 0;
  const budgetPercent = budgetTotal > 0 ? Math.round((budgetSpent / budgetTotal) * 100) : 0;

  return (
    <Card className="hover-elevate" data-testid={`card-project-${project.id}`}>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <HardHat className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold truncate" data-testid={`text-project-name-${project.id}`}>
                  {project.name}
                </h3>
                <p className="text-sm text-muted-foreground truncate" data-testid={`text-project-number-${project.id}`}>
                  {project.projectNumber || `#${project.id.slice(0, 8)}`}
                </p>
              </div>
            </div>
            <Badge className={`${config.color} gap-1 shrink-0`} data-testid={`badge-status-${project.id}`}>
              <StatusIcon className="w-3 h-3" />
              {statusLabel}
            </Badge>
          </div>

          <div className="text-sm">
            <div className="flex items-center gap-2 text-muted-foreground" data-testid={`text-site-client-${project.id}`}>
              <Building2 className="w-4 h-4" />
              <span className="truncate">{siteName} • {clientName}</span>
            </div>
          </div>

          <WorkflowStepsIndicator currentStatus={status} language={language} />

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {language === "fr" ? "Progrès" : "Progress"}
              </span>
              <span className="font-medium" data-testid={`text-progress-${project.id}`}>
                {progress}%
              </span>
            </div>
            <Progress value={progress} className="h-2" data-testid={`progress-bar-${project.id}`} />
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div className="min-w-0">
                <span className="text-muted-foreground block text-xs">
                  {language === "fr" ? "Début" : "Start"}
                </span>
                <span className="font-medium truncate block" data-testid={`text-start-date-${project.id}`}>
                  {formatDate(project.plannedStartDate, language)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div className="min-w-0">
                <span className="text-muted-foreground block text-xs">
                  {language === "fr" ? "Fin" : "End"}
                </span>
                <span className="font-medium truncate block" data-testid={`text-end-date-${project.id}`}>
                  {formatDate(project.plannedEndDate, language)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {language === "fr" ? "Chef de projet:" : "PM:"}
            </span>
            <span className="font-medium truncate" data-testid={`text-pm-${project.id}`}>
              {projectManagerName}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {language === "fr" ? "Budget:" : "Budget:"}
            </span>
            <span className="font-mono font-medium" data-testid={`text-budget-${project.id}`}>
              {formatCurrency(budgetSpent)} / {formatCurrency(budgetTotal)}
              {budgetTotal > 0 && (
                <span className={`ml-1 ${budgetPercent > 100 ? 'text-red-600' : 'text-muted-foreground'}`}>
                  ({budgetPercent}%)
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {language === "fr" ? "Risque:" : "Risk:"}
              </span>
              <Badge className={`${risk.color} gap-1`} data-testid={`badge-risk-${project.id}`}>
                {riskLabel}
              </Badge>
            </div>
            <Link href={`/app/construction-projects/${project.id}`}>
              <Button variant="outline" size="sm" className="gap-1.5" data-testid={`button-view-project-${project.id}`}>
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

function CreateProjectDialog({ 
  open, 
  onOpenChange 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const { language } = useI18n();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [agreementId, setAgreementId] = useState("");
  
  const { data: agreements } = useQuery<ConstructionAgreement[]>({
    queryKey: ["/api/construction-agreements"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; constructionAgreementId: string; siteId: string }) => {
      return apiRequest("POST", "/api/construction-projects", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/construction-projects"] });
      toast({
        title: language === "fr" ? "Projet créé" : "Project created",
        description: language === "fr" 
          ? "Le projet a été créé avec succès." 
          : "The project has been created successfully.",
      });
      setName("");
      setAgreementId("");
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: language === "fr" ? "Erreur" : "Error",
        description: language === "fr" 
          ? "Impossible de créer le projet." 
          : "Failed to create project.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    const agreement = agreements?.find(a => a.id === agreementId);
    if (!name || !agreementId || !agreement?.siteId) return;
    
    createMutation.mutate({
      name,
      constructionAgreementId: agreementId,
      siteId: agreement.siteId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {language === "fr" ? "Nouveau projet" : "New Project"}
          </DialogTitle>
          <DialogDescription>
            {language === "fr" 
              ? "Créez un nouveau projet de construction à partir d'un contrat accepté." 
              : "Create a new construction project from an accepted agreement."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">
              {language === "fr" ? "Nom du projet" : "Project Name"}
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={language === "fr" ? "Ex: Installation solaire ABC" : "e.g., Solar Installation ABC"}
              data-testid="input-project-name"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="agreement">
              {language === "fr" ? "Contrat de construction" : "Construction Agreement"}
            </Label>
            <Select value={agreementId} onValueChange={setAgreementId}>
              <SelectTrigger data-testid="select-agreement">
                <SelectValue placeholder={language === "fr" ? "Sélectionner un contrat" : "Select an agreement"} />
              </SelectTrigger>
              <SelectContent>
                {agreements?.filter(a => a.status === "accepted" || a.status === "in_progress").map((agreement) => (
                  <SelectItem key={agreement.id} value={agreement.id}>
                    {agreement.contractNumber || agreement.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-create"
          >
            {language === "fr" ? "Annuler" : "Cancel"}
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!name || !agreementId || createMutation.isPending}
            data-testid="button-submit-create"
          >
            {createMutation.isPending 
              ? (language === "fr" ? "Création..." : "Creating...") 
              : (language === "fr" ? "Créer" : "Create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ConstructionProjectsPage() {
  const { language } = useI18n();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: projects, isLoading } = useQuery<ConstructionProjectWithDetails[]>({
    queryKey: ["/api/construction-projects"],
  });

  const filteredProjects = projects?.filter(project => {
    const matchesStatus = statusFilter === "all" || project.status === statusFilter;
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = searchQuery === "" || 
      project.name.toLowerCase().includes(searchLower) ||
      project.projectNumber?.toLowerCase().includes(searchLower) ||
      project.site?.name?.toLowerCase().includes(searchLower) ||
      project.site?.client?.name?.toLowerCase().includes(searchLower);
    
    return matchesStatus && matchesSearch;
  });

  const statusOptions = [
    { value: "all", labelFr: "Tous les statuts", labelEn: "All statuses" },
    { value: "planning", labelFr: "Planification", labelEn: "Planning" },
    { value: "mobilization", labelFr: "Mobilisation", labelEn: "Mobilization" },
    { value: "in_progress", labelFr: "En cours", labelEn: "In Progress" },
    { value: "commissioning", labelFr: "Mise en service", labelEn: "Commissioning" },
    { value: "punch_list", labelFr: "Punch list", labelEn: "Punch List" },
    { value: "completed", labelFr: "Complété", labelEn: "Completed" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
            {language === "fr" ? "Projets de construction" : "Construction Projects"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {language === "fr" 
              ? "Suivez l'avancement de vos projets de construction" 
              : "Track the progress of your construction projects"}
          </p>
        </div>
        
        <Button 
          onClick={() => setCreateDialogOpen(true)}
          className="gap-2"
          data-testid="button-create-project"
        >
          <Plus className="w-4 h-4" />
          {language === "fr" ? "Nouveau projet" : "New Project"}
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={language === "fr" ? "Rechercher par nom ou site..." : "Search by name or site..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search"
          />
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
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-2 w-full rounded-full" />
                <div className="grid grid-cols-2 gap-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-40" />
                <div className="flex justify-between pt-2 border-t">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredProjects && filteredProjects.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <HardHat className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-1">
              {language === "fr" ? "Aucun projet" : "No projects"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || statusFilter !== "all"
                ? (language === "fr" 
                    ? "Aucun projet ne correspond à vos critères." 
                    : "No projects match your criteria.")
                : (language === "fr" 
                    ? "Créez un projet à partir d'un contrat de construction accepté." 
                    : "Create a project from an accepted construction agreement.")}
            </p>
            {(searchQuery || statusFilter !== "all") ? (
              <Button 
                variant="outline" 
                onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}
                data-testid="button-clear-filters"
              >
                {language === "fr" ? "Effacer les filtres" : "Clear filters"}
              </Button>
            ) : (
              <Button 
                onClick={() => setCreateDialogOpen(true)}
                data-testid="button-create-project-empty"
              >
                <Plus className="w-4 h-4 mr-2" />
                {language === "fr" ? "Nouveau projet" : "New Project"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <CreateProjectDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen} 
      />
    </div>
  );
}
