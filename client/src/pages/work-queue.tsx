import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  ClipboardList, 
  Building2, 
  User,
  ArrowRight,
  Filter,
  Pencil,
  BarChart3,
  FileText,
  Mail,
  X
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Site, User as UserType } from "@shared/schema";

type TaskType = "roof_pending" | "analysis_pending" | "report_pending";
type Priority = "high" | "normal" | "low";

interface SiteWithClient extends Site {
  clientName?: string;
}

const TASK_LABELS: Record<TaskType, { fr: string; en: string }> = {
  roof_pending: { fr: "Dessin du toit", en: "Roof Drawing" },
  analysis_pending: { fr: "Lancer l'analyse", en: "Run Analysis" },
  report_pending: { fr: "Générer le rapport", en: "Generate Report" },
};

const TASK_DESCRIPTIONS: Record<TaskType, { fr: string; en: string }> = {
  roof_pending: { 
    fr: "Sites nécessitant un dessin de toit validé", 
    en: "Sites needing validated roof drawing" 
  },
  analysis_pending: { 
    fr: "Sites prêts pour l'analyse solaire", 
    en: "Sites ready for solar analysis" 
  },
  report_pending: { 
    fr: "Sites prêts pour la génération de rapport", 
    en: "Sites ready for report generation" 
  },
};

const TASK_COLORS: Record<TaskType, string> = {
  roof_pending: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  analysis_pending: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  report_pending: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

const TASK_ICONS: Record<TaskType, typeof Pencil> = {
  roof_pending: Pencil,
  analysis_pending: BarChart3,
  report_pending: FileText,
};

const PRIORITY_LABELS: Record<Priority, { fr: string; en: string }> = {
  high: { fr: "Haute", en: "High" },
  normal: { fr: "Normale", en: "Normal" },
  low: { fr: "Basse", en: "Low" },
};

const PRIORITY_COLORS: Record<Priority, string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  normal: "bg-muted text-muted-foreground",
  low: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

function getTaskType(site: Site): TaskType | null {
  if (!site.roofAreaValidated) {
    return "roof_pending";
  }
  if (!site.quickAnalysisCompletedAt) {
    return "analysis_pending";
  }
  return "report_pending";
}

function TaskCard({ 
  site, 
  taskType,
  users,
  onAssigneeChange,
  onPriorityChange,
  isPending,
  isSelected,
  onToggleSelect
}: { 
  site: SiteWithClient; 
  taskType: TaskType;
  users: UserType[];
  onAssigneeChange: (siteId: string, userId: string | null) => void;
  onPriorityChange: (siteId: string, priority: Priority) => void;
  isPending: boolean;
  isSelected: boolean;
  onToggleSelect: (siteId: string) => void;
}) {
  const { language } = useI18n();
  const TaskIcon = TASK_ICONS[taskType];
  const priority = (site.workQueuePriority as Priority) || "normal";

  return (
    <Card 
      className="hover-elevate mb-3"
      data-testid={`card-task-${site.id}`}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggleSelect(site.id)}
                data-testid={`checkbox-select-${site.id}`}
                className="shrink-0"
              />
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <Link href={`/app/sites/${site.id}`}>
                  <span className="font-medium hover:underline cursor-pointer line-clamp-1" data-testid={`link-site-${site.id}`}>
                    {site.name}
                  </span>
                </Link>
                {site.clientName && (
                  <p className="text-sm text-muted-foreground truncate">{site.clientName}</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={TASK_COLORS[taskType]} data-testid={`badge-task-type-${site.id}`}>
              <TaskIcon className="w-3 h-3 mr-1" />
              {TASK_LABELS[taskType][language]}
            </Badge>
            <Badge className={PRIORITY_COLORS[priority]} data-testid={`badge-priority-${site.id}`}>
              {PRIORITY_LABELS[priority][language]}
            </Badge>
            {(site as any).workQueueDelegatedToEmail && (
              <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" data-testid={`badge-delegated-${site.id}`}>
                <Mail className="w-3 h-3 mr-1" />
                {(site as any).workQueueDelegatedToName || (site as any).workQueueDelegatedToEmail}
              </Badge>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground shrink-0" />
              <Select
                value={site.workQueueAssignedToId || "unassigned"}
                onValueChange={(value) => onAssigneeChange(site.id, value === "unassigned" ? null : value)}
                disabled={isPending}
              >
                <SelectTrigger className="h-8 text-sm" data-testid={`select-assignee-${site.id}`}>
                  <SelectValue placeholder={language === "fr" ? "Non assigné" : "Unassigned"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">
                    {language === "fr" ? "Non assigné" : "Unassigned"}
                  </SelectItem>
                  {users.filter(u => u.role !== "client").map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
              <Select
                value={priority}
                onValueChange={(value) => onPriorityChange(site.id, value as Priority)}
                disabled={isPending}
              >
                <SelectTrigger className="h-8 text-sm" data-testid={`select-priority-${site.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">{PRIORITY_LABELS.high[language]}</SelectItem>
                  <SelectItem value="normal">{PRIORITY_LABELS.normal[language]}</SelectItem>
                  <SelectItem value="low">{PRIORITY_LABELS.low[language]}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Link href={`/app/sites/${site.id}`}>
            <Button variant="outline" size="sm" className="w-full gap-2" data-testid={`button-go-to-site-${site.id}`}>
              {language === "fr" ? "Aller au site" : "Go to Site"}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskColumn({ 
  taskType, 
  sites, 
  users,
  onAssigneeChange,
  onPriorityChange,
  isPending,
  selectedSiteIds,
  onToggleSelect,
  onSelectAll
}: { 
  taskType: TaskType; 
  sites: SiteWithClient[];
  users: UserType[];
  onAssigneeChange: (siteId: string, userId: string | null) => void;
  onPriorityChange: (siteId: string, priority: Priority) => void;
  isPending: boolean;
  selectedSiteIds: Set<string>;
  onToggleSelect: (siteId: string) => void;
  onSelectAll: (siteIds: string[], select: boolean) => void;
}) {
  const { language } = useI18n();
  const TaskIcon = TASK_ICONS[taskType];
  
  const siteIds = sites.map(s => s.id);
  const allSelected = sites.length > 0 && siteIds.every(id => selectedSiteIds.has(id));
  const someSelected = siteIds.some(id => selectedSiteIds.has(id));

  return (
    <div className="flex flex-col min-w-[320px] max-w-[400px] flex-1">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b">
        <Checkbox
          checked={allSelected}
          onCheckedChange={(checked) => onSelectAll(siteIds, !!checked)}
          data-testid={`checkbox-select-all-${taskType}`}
          className="shrink-0"
          disabled={sites.length === 0}
        />
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${TASK_COLORS[taskType]}`}>
          <TaskIcon className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold truncate">{TASK_LABELS[taskType][language]}</h3>
          <p className="text-xs text-muted-foreground truncate">
            {TASK_DESCRIPTIONS[taskType][language]}
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0">
          {sites.length}
        </Badge>
      </div>

      <ScrollArea className="flex-1">
        <div className="pr-4 space-y-0">
          {sites.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {language === "fr" ? "Aucune tâche" : "No tasks"}
            </p>
          ) : (
            sites.map((site) => (
              <TaskCard
                key={site.id}
                site={site}
                taskType={taskType}
                users={users}
                onAssigneeChange={onAssigneeChange}
                onPriorityChange={onPriorityChange}
                isPending={isPending}
                isSelected={selectedSiteIds.has(site.id)}
                onToggleSelect={onToggleSelect}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

interface DelegationFormData {
  recipientEmail: string;
  recipientName: string;
  instructions: string;
  language: "fr" | "en";
}

function DelegationEmailModal({
  open,
  onOpenChange,
  selectedSites,
  onSuccess
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedSites: SiteWithClient[];
  onSuccess: () => void;
}) {
  const { language } = useI18n();
  const { toast } = useToast();
  const [formData, setFormData] = useState<DelegationFormData>({
    recipientEmail: "",
    recipientName: "",
    instructions: "",
    language: "fr"
  });

  const delegateMutation = useMutation({
    mutationFn: async (data: { siteIds: string[]; recipientEmail: string; recipientName?: string; instructions?: string; language: "fr" | "en" }) => {
      return apiRequest("POST", "/api/work-queue/delegate", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-queue/sites"] });
      toast({
        title: language === "fr" ? "Courriel envoyé" : "Email sent",
        description: language === "fr" 
          ? `${selectedSites.length} tâches déléguées avec succès`
          : `${selectedSites.length} tasks delegated successfully`,
      });
      onSuccess();
      onOpenChange(false);
      setFormData({ recipientEmail: "", recipientName: "", instructions: "", language: "fr" });
    },
    onError: (error: Error) => {
      toast({
        title: language === "fr" ? "Erreur" : "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.recipientEmail) return;
    
    delegateMutation.mutate({
      siteIds: selectedSites.map(s => s.id),
      recipientEmail: formData.recipientEmail,
      recipientName: formData.recipientName || undefined,
      instructions: formData.instructions || undefined,
      language: formData.language,
    });
  };

  const emailSubject = formData.language === "fr" 
    ? `[kWh Québec] Tâches assignées - ${selectedSites.length} sites`
    : `[kWh Québec] Assigned Tasks - ${selectedSites.length} sites`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {language === "fr" ? "Déléguer des tâches par courriel" : "Delegate Tasks by Email"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="recipientEmail">
                {language === "fr" ? "Courriel du destinataire" : "Recipient Email"} *
              </Label>
              <Input
                id="recipientEmail"
                type="email"
                required
                value={formData.recipientEmail}
                onChange={(e) => setFormData(prev => ({ ...prev, recipientEmail: e.target.value }))}
                placeholder="email@example.com"
                data-testid="input-recipient-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recipientName">
                {language === "fr" ? "Nom du destinataire" : "Recipient Name"}
              </Label>
              <Input
                id="recipientName"
                value={formData.recipientName}
                onChange={(e) => setFormData(prev => ({ ...prev, recipientName: e.target.value }))}
                placeholder={language === "fr" ? "Jean Dupont" : "John Doe"}
                data-testid="input-recipient-name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="emailLanguage">
              {language === "fr" ? "Langue du courriel" : "Email Language"}
            </Label>
            <Select
              value={formData.language}
              onValueChange={(value: "fr" | "en") => setFormData(prev => ({ ...prev, language: value }))}
            >
              <SelectTrigger data-testid="select-email-language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="instructions">
              {language === "fr" ? "Instructions personnalisées" : "Custom Instructions"}
            </Label>
            <Textarea
              id="instructions"
              value={formData.instructions}
              onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
              placeholder={language === "fr" 
                ? "Instructions supplémentaires pour le destinataire..."
                : "Additional instructions for the recipient..."}
              rows={3}
              data-testid="textarea-instructions"
            />
          </div>

          <div className="space-y-2">
            <Label>{language === "fr" ? "Aperçu du courriel" : "Email Preview"}</Label>
            <Card className="bg-muted/50">
              <CardContent className="p-4 space-y-3">
                <div>
                  <span className="text-sm text-muted-foreground">
                    {language === "fr" ? "Objet:" : "Subject:"}
                  </span>
                  <p className="font-medium">{emailSubject}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">
                    {language === "fr" ? "Sites inclus:" : "Included sites:"}
                  </span>
                  <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                    {selectedSites.map((site) => {
                      const taskType = getTaskType(site);
                      return (
                        <div key={site.id} className="text-sm flex items-center gap-2 py-1 border-b border-border/50 last:border-0">
                          <Building2 className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate flex-1">{site.name}</span>
                          {taskType && (
                            <Badge variant="secondary" className="text-xs shrink-0">
                              {TASK_LABELS[taskType][formData.language]}
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-delegation"
            >
              {language === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button 
              type="submit" 
              disabled={!formData.recipientEmail || delegateMutation.isPending}
              data-testid="button-send-delegation"
            >
              <Mail className="w-4 h-4 mr-2" />
              {delegateMutation.isPending 
                ? (language === "fr" ? "Envoi..." : "Sending...")
                : (language === "fr" ? "Envoyer le courriel" : "Send Email")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function WorkQueuePage() {
  const { language } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [filterTaskType, setFilterTaskType] = useState<string>("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [selectedSiteIds, setSelectedSiteIds] = useState<Set<string>>(new Set());
  const [delegationModalOpen, setDelegationModalOpen] = useState(false);

  const { data: sites, isLoading: sitesLoading } = useQuery<SiteWithClient[]>({
    queryKey: ["/api/work-queue/sites"],
  });

  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  const updateSiteMutation = useMutation({
    mutationFn: async ({ siteId, data }: { siteId: string; data: Partial<Site> }) => {
      return apiRequest("PATCH", `/api/sites/${siteId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-queue/sites"] });
      toast({
        title: language === "fr" ? "Mis à jour" : "Updated",
        description: language === "fr" ? "Tâche mise à jour avec succès" : "Task updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: language === "fr" ? "Erreur" : "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAssigneeChange = (siteId: string, userId: string | null) => {
    updateSiteMutation.mutate({
      siteId,
      data: { 
        workQueueAssignedToId: userId,
        workQueueAssignedAt: userId ? new Date().toISOString() : null
      } as Partial<Site>,
    });
  };

  const handlePriorityChange = (siteId: string, priority: Priority) => {
    updateSiteMutation.mutate({
      siteId,
      data: { workQueuePriority: priority } as Partial<Site>,
    });
  };

  const handleToggleSelect = (siteId: string) => {
    setSelectedSiteIds(prev => {
      const next = new Set(prev);
      if (next.has(siteId)) {
        next.delete(siteId);
      } else {
        next.add(siteId);
      }
      return next;
    });
  };

  const handleSelectAll = (siteIds: string[], select: boolean) => {
    setSelectedSiteIds(prev => {
      const next = new Set(prev);
      if (select) {
        siteIds.forEach(id => next.add(id));
      } else {
        siteIds.forEach(id => next.delete(id));
      }
      return next;
    });
  };

  const handleDeselectAll = () => {
    setSelectedSiteIds(new Set());
  };

  const categorizedSites = useMemo(() => {
    if (!sites) return { roof_pending: [], analysis_pending: [], report_pending: [] };

    const filtered = sites.filter((site) => {
      const taskType = getTaskType(site);
      if (!taskType) return false;

      if (filterTaskType !== "all") {
        if (filterTaskType === "roof" && taskType !== "roof_pending") return false;
        if (filterTaskType === "analysis" && taskType !== "analysis_pending") return false;
        if (filterTaskType === "report" && taskType !== "report_pending") return false;
      }

      if (filterAssignee === "my_tasks") {
        if (site.workQueueAssignedToId !== user?.id) return false;
      } else if (filterAssignee !== "all") {
        if (site.workQueueAssignedToId !== filterAssignee) return false;
      }

      if (filterPriority !== "all") {
        const sitePriority = site.workQueuePriority || "normal";
        if (sitePriority !== filterPriority) return false;
      }

      return true;
    });

    const result: Record<TaskType, SiteWithClient[]> = {
      roof_pending: [],
      analysis_pending: [],
      report_pending: [],
    };

    filtered.forEach((site) => {
      const taskType = getTaskType(site);
      if (taskType) {
        result[taskType].push(site);
      }
    });

    const priorityOrder: Record<string, number> = { high: 0, normal: 1, low: 2 };
    Object.keys(result).forEach((key) => {
      result[key as TaskType].sort((a, b) => {
        const aPriority = priorityOrder[a.workQueuePriority || "normal"] ?? 1;
        const bPriority = priorityOrder[b.workQueuePriority || "normal"] ?? 1;
        return aPriority - bPriority;
      });
    });

    return result;
  }, [sites, filterTaskType, filterAssignee, filterPriority, user?.id]);

  const totalTasks = 
    categorizedSites.roof_pending.length + 
    categorizedSites.analysis_pending.length + 
    categorizedSites.report_pending.length;

  const selectedSites = useMemo(() => {
    if (!sites) return [];
    return sites.filter(s => selectedSiteIds.has(s.id));
  }, [sites, selectedSiteIds]);

  if (sitesLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="flex gap-4">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-8 w-40" />
        </div>
        <div className="flex gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-1 space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <ClipboardList className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">
            {language === "fr" ? "Tâches à faire" : "To-Do List"}
          </h1>
          <p className="text-muted-foreground">
            {language === "fr" 
              ? `${totalTasks} tâches en attente`
              : `${totalTasks} pending tasks`}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {language === "fr" ? "Filtres:" : "Filters:"}
              </span>
            </div>

            <Select value={filterTaskType} onValueChange={setFilterTaskType}>
              <SelectTrigger className="w-[180px]" data-testid="filter-task-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === "fr" ? "Tous les types" : "All Types"}</SelectItem>
                <SelectItem value="roof">{TASK_LABELS.roof_pending[language]}</SelectItem>
                <SelectItem value="analysis">{TASK_LABELS.analysis_pending[language]}</SelectItem>
                <SelectItem value="report">{TASK_LABELS.report_pending[language]}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterAssignee} onValueChange={setFilterAssignee}>
              <SelectTrigger className="w-[180px]" data-testid="filter-assignee">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === "fr" ? "Tous" : "All"}</SelectItem>
                <SelectItem value="my_tasks">{language === "fr" ? "Mes tâches" : "My Tasks"}</SelectItem>
                {users.filter(u => u.role !== "client").map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-[140px]" data-testid="filter-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === "fr" ? "Toutes" : "All"}</SelectItem>
                <SelectItem value="high">{PRIORITY_LABELS.high[language]}</SelectItem>
                <SelectItem value="normal">{PRIORITY_LABELS.normal[language]}</SelectItem>
                <SelectItem value="low">{PRIORITY_LABELS.low[language]}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <ScrollArea className="w-full">
        <div className="flex gap-6 pb-4 min-h-[500px]">
          <TaskColumn
            taskType="roof_pending"
            sites={categorizedSites.roof_pending}
            users={users}
            onAssigneeChange={handleAssigneeChange}
            onPriorityChange={handlePriorityChange}
            isPending={updateSiteMutation.isPending}
            selectedSiteIds={selectedSiteIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
          />
          <TaskColumn
            taskType="analysis_pending"
            sites={categorizedSites.analysis_pending}
            users={users}
            onAssigneeChange={handleAssigneeChange}
            onPriorityChange={handlePriorityChange}
            isPending={updateSiteMutation.isPending}
            selectedSiteIds={selectedSiteIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
          />
          <TaskColumn
            taskType="report_pending"
            sites={categorizedSites.report_pending}
            users={users}
            onAssigneeChange={handleAssigneeChange}
            onPriorityChange={handlePriorityChange}
            isPending={updateSiteMutation.isPending}
            selectedSiteIds={selectedSiteIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
          />
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {selectedSiteIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <Card className="shadow-lg border-2">
            <CardContent className="p-3 flex items-center gap-3">
              <Badge variant="secondary" className="text-sm">
                {selectedSiteIds.size} {language === "fr" ? "sélectionnés" : "selected"}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeselectAll}
                data-testid="button-deselect-all"
              >
                <X className="w-4 h-4 mr-1" />
                {language === "fr" ? "Désélectionner" : "Deselect All"}
              </Button>
              <Button
                size="sm"
                onClick={() => setDelegationModalOpen(true)}
                data-testid="button-delegate-selected"
              >
                <Mail className="w-4 h-4 mr-1" />
                {language === "fr" 
                  ? `Déléguer ${selectedSiteIds.size} tâches`
                  : `Delegate ${selectedSiteIds.size} tasks`}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <DelegationEmailModal
        open={delegationModalOpen}
        onOpenChange={setDelegationModalOpen}
        selectedSites={selectedSites}
        onSuccess={handleDeselectAll}
      />
    </div>
  );
}
