import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  ListChecks, Building2, Calendar, User, 
  AlertTriangle, CheckCircle2, Clock, PlayCircle, 
  Filter, Search, Plus, Ban, ChevronDown,
  FileText, Zap, Wrench, HardHat, ClipboardCheck, Settings
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
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
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ConstructionTask, ConstructionProject } from "@shared/schema";

interface TaskWithProject extends ConstructionTask {
  project?: ConstructionProject;
}

type TaskStatus = "pending" | "in_progress" | "blocked" | "completed" | "cancelled";
type TaskCategory = "permitting" | "procurement" | "electrical" | "mechanical" | "structural" | "inspection" | "general";
type TaskPriority = "low" | "medium" | "high" | "critical";
type SortField = "due_date" | "priority" | "status";

const statusConfig: Record<TaskStatus, { 
  color: string; 
  icon: typeof ListChecks;
  labelFr: string;
  labelEn: string;
}> = {
  pending: { 
    color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300", 
    icon: Clock,
    labelFr: "En attente",
    labelEn: "Pending"
  },
  in_progress: { 
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300", 
    icon: PlayCircle,
    labelFr: "En cours",
    labelEn: "In Progress"
  },
  blocked: { 
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300", 
    icon: AlertTriangle,
    labelFr: "Bloqué",
    labelEn: "Blocked"
  },
  completed: { 
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300", 
    icon: CheckCircle2,
    labelFr: "Complété",
    labelEn: "Completed"
  },
  cancelled: { 
    color: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300", 
    icon: Ban,
    labelFr: "Annulé",
    labelEn: "Cancelled"
  },
};

const categoryConfig: Record<TaskCategory, { 
  color: string; 
  icon: typeof FileText;
  labelFr: string;
  labelEn: string;
}> = {
  permitting: { 
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300", 
    icon: FileText,
    labelFr: "Permis",
    labelEn: "Permitting"
  },
  procurement: { 
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300", 
    icon: Settings,
    labelFr: "Approvisionnement",
    labelEn: "Procurement"
  },
  electrical: { 
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300", 
    icon: Zap,
    labelFr: "Électrique",
    labelEn: "Electrical"
  },
  mechanical: { 
    color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300", 
    icon: Wrench,
    labelFr: "Mécanique",
    labelEn: "Mechanical"
  },
  structural: { 
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300", 
    icon: HardHat,
    labelFr: "Structure",
    labelEn: "Structural"
  },
  inspection: { 
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300", 
    icon: ClipboardCheck,
    labelFr: "Inspection",
    labelEn: "Inspection"
  },
  general: { 
    color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300", 
    icon: ListChecks,
    labelFr: "Général",
    labelEn: "General"
  },
};

const priorityConfig: Record<TaskPriority, { 
  color: string; 
  labelFr: string;
  labelEn: string;
}> = {
  low: { 
    color: "text-gray-500", 
    labelFr: "Basse",
    labelEn: "Low"
  },
  medium: { 
    color: "text-blue-600 dark:text-blue-400", 
    labelFr: "Moyenne",
    labelEn: "Medium"
  },
  high: { 
    color: "text-orange-600 dark:text-orange-400", 
    labelFr: "Haute",
    labelEn: "High"
  },
  critical: { 
    color: "text-red-600 dark:text-red-400", 
    labelFr: "Critique",
    labelEn: "Critical"
  },
};

function formatDate(date: Date | string | null | undefined, language: "fr" | "en"): string {
  if (!date) return "—";
  const d = new Date(date);
  return d.toLocaleDateString(language === "fr" ? "fr-CA" : "en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function TaskStatusDropdown({ 
  task, 
  onStatusChange 
}: { 
  task: TaskWithProject; 
  onStatusChange: (taskId: string, status: TaskStatus, blockedReason?: string) => void;
}) {
  const { language } = useI18n();
  const [blockedDialogOpen, setBlockedDialogOpen] = useState(false);
  const [blockedReason, setBlockedReason] = useState("");
  
  const currentStatus = (task.status as TaskStatus) || "pending";
  const config = statusConfig[currentStatus];
  const StatusIcon = config.icon;
  
  const handleStatusSelect = (status: TaskStatus) => {
    if (status === "blocked") {
      setBlockedDialogOpen(true);
    } else {
      onStatusChange(task.id, status);
    }
  };

  const handleBlockedConfirm = () => {
    onStatusChange(task.id, "blocked", blockedReason);
    setBlockedDialogOpen(false);
    setBlockedReason("");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5 h-7 px-2" data-testid={`dropdown-status-${task.id}`}>
            <Badge className={`${config.color} gap-1`}>
              <StatusIcon className="w-3 h-3" />
              {language === "fr" ? config.labelFr : config.labelEn}
            </Badge>
            <ChevronDown className="w-3 h-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {Object.entries(statusConfig).map(([status, cfg]) => {
            const Icon = cfg.icon;
            return (
              <DropdownMenuItem 
                key={status}
                onClick={() => handleStatusSelect(status as TaskStatus)}
                data-testid={`menu-status-${status}-${task.id}`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {language === "fr" ? cfg.labelFr : cfg.labelEn}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={blockedDialogOpen} onOpenChange={setBlockedDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {language === "fr" ? "Raison du blocage" : "Blocked Reason"}
            </DialogTitle>
            <DialogDescription>
              {language === "fr" 
                ? "Décrivez pourquoi cette tâche est bloquée." 
                : "Describe why this task is blocked."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={blockedReason}
              onChange={(e) => setBlockedReason(e.target.value)}
              placeholder={language === "fr" ? "Ex: En attente de matériaux..." : "e.g., Waiting for materials..."}
              className="min-h-[100px]"
              data-testid="input-blocked-reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockedDialogOpen(false)}>
              {language === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button onClick={handleBlockedConfirm} data-testid="button-confirm-blocked">
              {language === "fr" ? "Confirmer" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CreateTaskDialog({ 
  open, 
  onOpenChange,
  projects
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  projects: ConstructionProject[];
}) {
  const { language } = useI18n();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [category, setCategory] = useState<TaskCategory>("general");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [plannedStartDate, setPlannedStartDate] = useState("");
  const [plannedEndDate, setPlannedEndDate] = useState("");
  const [assignedToName, setAssignedToName] = useState("");
  
  const createMutation = useMutation({
    mutationFn: async (data: Partial<ConstructionTask>) => {
      return apiRequest("POST", "/api/construction-tasks", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/construction-tasks"] });
      toast({
        title: language === "fr" ? "Tâche créée" : "Task created",
        description: language === "fr" 
          ? "La tâche a été créée avec succès." 
          : "The task has been created successfully.",
      });
      resetForm();
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: language === "fr" ? "Erreur" : "Error",
        description: language === "fr" 
          ? "Impossible de créer la tâche." 
          : "Failed to create task.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setName("");
    setDescription("");
    setProjectId("");
    setCategory("general");
    setPriority("medium");
    setPlannedStartDate("");
    setPlannedEndDate("");
    setAssignedToName("");
  };

  const handleSubmit = () => {
    if (!name || !projectId) return;
    
    createMutation.mutate({
      name,
      description: description || undefined,
      projectId,
      category,
      priority,
      plannedStartDate: plannedStartDate ? new Date(plannedStartDate) : undefined,
      plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : undefined,
      assignedToName: assignedToName || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {language === "fr" ? "Nouvelle tâche" : "New Task"}
          </DialogTitle>
          <DialogDescription>
            {language === "fr" 
              ? "Créez une nouvelle tâche de construction." 
              : "Create a new construction task."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
          <div className="grid gap-2">
            <Label htmlFor="name">
              {language === "fr" ? "Nom de la tâche" : "Task Name"} *
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={language === "fr" ? "Ex: Installation des panneaux" : "e.g., Panel Installation"}
              data-testid="input-task-name"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">
              {language === "fr" ? "Description" : "Description"}
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={language === "fr" ? "Détails de la tâche..." : "Task details..."}
              data-testid="input-task-description"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="project">
              {language === "fr" ? "Projet" : "Project"} *
            </Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger data-testid="select-project">
                <SelectValue placeholder={language === "fr" ? "Sélectionner un projet" : "Select a project"} />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="category">
                {language === "fr" ? "Catégorie" : "Category"}
              </Label>
              <Select value={category} onValueChange={(v) => setCategory(v as TaskCategory)}>
                <SelectTrigger data-testid="select-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryConfig).map(([cat, cfg]) => (
                    <SelectItem key={cat} value={cat}>
                      {language === "fr" ? cfg.labelFr : cfg.labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="priority">
                {language === "fr" ? "Priorité" : "Priority"}
              </Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger data-testid="select-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(priorityConfig).map(([pri, cfg]) => (
                    <SelectItem key={pri} value={pri}>
                      {language === "fr" ? cfg.labelFr : cfg.labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="startDate">
                {language === "fr" ? "Date de début" : "Start Date"}
              </Label>
              <Input
                id="startDate"
                type="date"
                value={plannedStartDate}
                onChange={(e) => setPlannedStartDate(e.target.value)}
                data-testid="input-start-date"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="endDate">
                {language === "fr" ? "Date de fin" : "End Date"}
              </Label>
              <Input
                id="endDate"
                type="date"
                value={plannedEndDate}
                onChange={(e) => setPlannedEndDate(e.target.value)}
                data-testid="input-end-date"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="assignee">
              {language === "fr" ? "Assigné à" : "Assigned To"}
            </Label>
            <Input
              id="assignee"
              value={assignedToName}
              onChange={(e) => setAssignedToName(e.target.value)}
              placeholder={language === "fr" ? "Nom de la personne..." : "Person's name..."}
              data-testid="input-assignee"
            />
          </div>
        </div>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => { resetForm(); onOpenChange(false); }}
            data-testid="button-cancel-create"
          >
            {language === "fr" ? "Annuler" : "Cancel"}
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!name || !projectId || createMutation.isPending}
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

function EditTaskDialog({ 
  task,
  open, 
  onOpenChange,
  projects
}: { 
  task: TaskWithProject | null;
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  projects: ConstructionProject[];
}) {
  const { language } = useI18n();
  const { toast } = useToast();
  const [name, setName] = useState(task?.name || "");
  const [description, setDescription] = useState(task?.description || "");
  const [projectId, setProjectId] = useState(task?.projectId || "");
  const [category, setCategory] = useState<TaskCategory>((task?.category as TaskCategory) || "general");
  const [priority, setPriority] = useState<TaskPriority>((task?.priority as TaskPriority) || "medium");
  const [plannedStartDate, setPlannedStartDate] = useState(
    task?.plannedStartDate ? new Date(task.plannedStartDate).toISOString().split('T')[0] : ""
  );
  const [plannedEndDate, setPlannedEndDate] = useState(
    task?.plannedEndDate ? new Date(task.plannedEndDate).toISOString().split('T')[0] : ""
  );
  const [assignedToName, setAssignedToName] = useState(task?.assignedToName || "");
  const [progressPercent, setProgressPercent] = useState(task?.progressPercent ?? 0);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<ConstructionTask>) => {
      return apiRequest("PATCH", `/api/construction-tasks/${task?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/construction-tasks"] });
      toast({
        title: language === "fr" ? "Tâche mise à jour" : "Task updated",
        description: language === "fr" 
          ? "La tâche a été mise à jour avec succès." 
          : "The task has been updated successfully.",
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: language === "fr" ? "Erreur" : "Error",
        description: language === "fr" 
          ? "Impossible de mettre à jour la tâche." 
          : "Failed to update task.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!name || !projectId || !task) return;
    
    updateMutation.mutate({
      name,
      description: description || undefined,
      projectId,
      category,
      priority,
      plannedStartDate: plannedStartDate ? new Date(plannedStartDate) : undefined,
      plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : undefined,
      assignedToName: assignedToName || undefined,
      progressPercent,
    });
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {language === "fr" ? "Modifier la tâche" : "Edit Task"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
          <div className="grid gap-2">
            <Label htmlFor="edit-name">
              {language === "fr" ? "Nom de la tâche" : "Task Name"} *
            </Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="input-edit-task-name"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-description">
              {language === "fr" ? "Description" : "Description"}
            </Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="input-edit-task-description"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-project">
              {language === "fr" ? "Projet" : "Project"} *
            </Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger data-testid="select-edit-project">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-category">
                {language === "fr" ? "Catégorie" : "Category"}
              </Label>
              <Select value={category} onValueChange={(v) => setCategory(v as TaskCategory)}>
                <SelectTrigger data-testid="select-edit-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryConfig).map(([cat, cfg]) => (
                    <SelectItem key={cat} value={cat}>
                      {language === "fr" ? cfg.labelFr : cfg.labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-priority">
                {language === "fr" ? "Priorité" : "Priority"}
              </Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger data-testid="select-edit-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(priorityConfig).map(([pri, cfg]) => (
                    <SelectItem key={pri} value={pri}>
                      {language === "fr" ? cfg.labelFr : cfg.labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-startDate">
                {language === "fr" ? "Date de début" : "Start Date"}
              </Label>
              <Input
                id="edit-startDate"
                type="date"
                value={plannedStartDate}
                onChange={(e) => setPlannedStartDate(e.target.value)}
                data-testid="input-edit-start-date"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-endDate">
                {language === "fr" ? "Date de fin" : "End Date"}
              </Label>
              <Input
                id="edit-endDate"
                type="date"
                value={plannedEndDate}
                onChange={(e) => setPlannedEndDate(e.target.value)}
                data-testid="input-edit-end-date"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-assignee">
              {language === "fr" ? "Assigné à" : "Assigned To"}
            </Label>
            <Input
              id="edit-assignee"
              value={assignedToName}
              onChange={(e) => setAssignedToName(e.target.value)}
              data-testid="input-edit-assignee"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-progress">
              {language === "fr" ? "Progrès" : "Progress"}: {progressPercent}%
            </Label>
            <Input
              id="edit-progress"
              type="range"
              min="0"
              max="100"
              value={progressPercent}
              onChange={(e) => setProgressPercent(Number(e.target.value))}
              className="w-full"
              data-testid="input-edit-progress"
            />
          </div>
        </div>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-edit"
          >
            {language === "fr" ? "Annuler" : "Cancel"}
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!name || !projectId || updateMutation.isPending}
            data-testid="button-submit-edit"
          >
            {updateMutation.isPending 
              ? (language === "fr" ? "Sauvegarde..." : "Saving...") 
              : (language === "fr" ? "Sauvegarder" : "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ConstructionTasksPage() {
  const { language } = useI18n();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("due_date");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithProject | null>(null);

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<TaskWithProject[]>({
    queryKey: ["/api/construction-tasks"],
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery<ConstructionProject[]>({
    queryKey: ["/api/construction-projects"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ taskId, status, blockedReason }: { taskId: string; status: TaskStatus; blockedReason?: string }) => {
      const updates: Partial<ConstructionTask> = { status };
      if (status === "blocked" && blockedReason) {
        updates.blockedReason = blockedReason;
        updates.blockedAt = new Date();
      } else if (status !== "blocked") {
        updates.blockedReason = undefined;
        updates.blockedAt = undefined;
      }
      return apiRequest("PATCH", `/api/construction-tasks/${taskId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/construction-tasks"] });
      toast({
        title: language === "fr" ? "Statut mis à jour" : "Status updated",
      });
    },
    onError: () => {
      toast({
        title: language === "fr" ? "Erreur" : "Error",
        description: language === "fr" 
          ? "Impossible de mettre à jour le statut." 
          : "Failed to update status.",
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (taskId: string, status: TaskStatus, blockedReason?: string) => {
    updateStatusMutation.mutate({ taskId, status, blockedReason });
  };

  const filteredAndSortedTasks = useMemo(() => {
    let result = tasks.filter(task => {
      const matchesStatus = statusFilter === "all" || task.status === statusFilter;
      const matchesCategory = categoryFilter === "all" || task.category === categoryFilter;
      const matchesProject = projectFilter === "all" || task.projectId === projectFilter;
      const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = searchQuery === "" || 
        task.name.toLowerCase().includes(searchLower) ||
        task.description?.toLowerCase().includes(searchLower);
      
      return matchesStatus && matchesCategory && matchesProject && matchesPriority && matchesSearch;
    });

    result.sort((a, b) => {
      if (sortField === "due_date") {
        const dateA = a.plannedEndDate ? new Date(a.plannedEndDate).getTime() : Infinity;
        const dateB = b.plannedEndDate ? new Date(b.plannedEndDate).getTime() : Infinity;
        return dateA - dateB;
      } else if (sortField === "priority") {
        const priorityOrder: Record<TaskPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        return (priorityOrder[a.priority as TaskPriority] ?? 2) - (priorityOrder[b.priority as TaskPriority] ?? 2);
      } else if (sortField === "status") {
        const statusOrder: Record<TaskStatus, number> = { blocked: 0, in_progress: 1, pending: 2, completed: 3, cancelled: 4 };
        return (statusOrder[a.status as TaskStatus] ?? 2) - (statusOrder[b.status as TaskStatus] ?? 2);
      }
      return 0;
    });

    return result;
  }, [tasks, statusFilter, categoryFilter, projectFilter, priorityFilter, searchQuery, sortField]);

  const projectsMap = useMemo(() => {
    const map: Record<string, ConstructionProject> = {};
    projects.forEach(p => { map[p.id] = p; });
    return map;
  }, [projects]);

  const isLoading = tasksLoading || projectsLoading;

  const statusOptions = [
    { value: "all", labelFr: "Tous les statuts", labelEn: "All statuses" },
    ...Object.entries(statusConfig).map(([value, cfg]) => ({
      value,
      labelFr: cfg.labelFr,
      labelEn: cfg.labelEn,
    })),
  ];

  const categoryOptions = [
    { value: "all", labelFr: "Toutes catégories", labelEn: "All categories" },
    ...Object.entries(categoryConfig).map(([value, cfg]) => ({
      value,
      labelFr: cfg.labelFr,
      labelEn: cfg.labelEn,
    })),
  ];

  const priorityOptions = [
    { value: "all", labelFr: "Toutes priorités", labelEn: "All priorities" },
    ...Object.entries(priorityConfig).map(([value, cfg]) => ({
      value,
      labelFr: cfg.labelFr,
      labelEn: cfg.labelEn,
    })),
  ];

  const sortOptions = [
    { value: "due_date", labelFr: "Date d'échéance", labelEn: "Due Date" },
    { value: "priority", labelFr: "Priorité", labelEn: "Priority" },
    { value: "status", labelFr: "Statut", labelEn: "Status" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
            {language === "fr" ? "Tâches de construction" : "Construction Tasks"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {language === "fr" 
              ? "Gérez les tâches de vos projets de construction" 
              : "Manage tasks for your construction projects"}
          </p>
        </div>
        
        <Button 
          onClick={() => setCreateDialogOpen(true)}
          className="gap-2"
          data-testid="button-create-task"
        >
          <Plus className="w-4 h-4" />
          {language === "fr" ? "Nouvelle tâche" : "New Task"}
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={language === "fr" ? "Rechercher par nom..." : "Search by name..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
            <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
              <SelectTrigger className="w-[140px]" data-testid="select-sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {language === "fr" ? option.labelFr : option.labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
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
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[170px]" data-testid="select-category-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categoryOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {language === "fr" ? option.labelFr : option.labelEn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[150px]" data-testid="select-priority-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {priorityOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {language === "fr" ? option.labelFr : option.labelEn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-project-filter">
              <SelectValue placeholder={language === "fr" ? "Tous les projets" : "All projects"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {language === "fr" ? "Tous les projets" : "All projects"}
              </SelectItem>
              {projects.map(project => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-0">
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 py-3">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-2 w-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : filteredAndSortedTasks.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">
                    {language === "fr" ? "Tâche" : "Task"}
                  </TableHead>
                  <TableHead>
                    {language === "fr" ? "Projet" : "Project"}
                  </TableHead>
                  <TableHead>
                    {language === "fr" ? "Catégorie" : "Category"}
                  </TableHead>
                  <TableHead>
                    {language === "fr" ? "Statut" : "Status"}
                  </TableHead>
                  <TableHead>
                    {language === "fr" ? "Priorité" : "Priority"}
                  </TableHead>
                  <TableHead>
                    {language === "fr" ? "Dates" : "Dates"}
                  </TableHead>
                  <TableHead>
                    {language === "fr" ? "Assigné" : "Assigned"}
                  </TableHead>
                  <TableHead className="w-[100px]">
                    {language === "fr" ? "Progrès" : "Progress"}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedTasks.map((task) => {
                  const status = (task.status as TaskStatus) || "pending";
                  const category = (task.category as TaskCategory) || "general";
                  const priority = (task.priority as TaskPriority) || "medium";
                  const categoryConf = categoryConfig[category];
                  const priorityConf = priorityConfig[priority];
                  const CategoryIcon = categoryConf.icon;
                  const project = projectsMap[task.projectId];
                  const isBlocked = status === "blocked";

                  return (
                    <TableRow 
                      key={task.id} 
                      className={`cursor-pointer ${isBlocked ? 'border-l-4 border-l-red-500 bg-red-50/50 dark:bg-red-950/20' : ''}`}
                      onClick={() => setEditingTask(task)}
                      data-testid={`row-task-${task.id}`}
                    >
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium" data-testid={`text-task-name-${task.id}`}>
                            {task.name}
                          </div>
                          {task.description && (
                            <div className="text-sm text-muted-foreground line-clamp-1">
                              {task.description}
                            </div>
                          )}
                          {isBlocked && task.blockedReason && (
                            <div className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              {task.blockedReason}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {project ? (
                          <Link 
                            href={`/app/construction-projects/${project.id}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span 
                              className="text-primary hover:underline flex items-center gap-1.5"
                              data-testid={`link-project-${task.id}`}
                            >
                              <Building2 className="w-3.5 h-3.5" />
                              {project.name}
                            </span>
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Badge className={`${categoryConf.color} gap-1`} data-testid={`badge-category-${task.id}`}>
                          <CategoryIcon className="w-3 h-3" />
                          {language === "fr" ? categoryConf.labelFr : categoryConf.labelEn}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <TaskStatusDropdown 
                          task={task} 
                          onStatusChange={handleStatusChange} 
                        />
                      </TableCell>
                      <TableCell>
                        <span className={`font-medium ${priorityConf.color}`} data-testid={`text-priority-${task.id}`}>
                          {language === "fr" ? priorityConf.labelFr : priorityConf.labelEn}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Calendar className="w-3.5 h-3.5" />
                          <span data-testid={`text-dates-${task.id}`}>
                            {formatDate(task.plannedStartDate, language)} — {formatDate(task.plannedEndDate, language)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm">
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                          <span data-testid={`text-assignee-${task.id}`}>
                            {task.assignedToName || "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={task.progressPercent ?? 0} className="h-2 w-16" />
                          <span className="text-sm text-muted-foreground" data-testid={`text-progress-${task.id}`}>
                            {task.progressPercent ?? 0}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <ListChecks className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-1">
              {language === "fr" ? "Aucune tâche" : "No tasks"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {(searchQuery || statusFilter !== "all" || categoryFilter !== "all" || projectFilter !== "all" || priorityFilter !== "all")
                ? (language === "fr" 
                    ? "Aucune tâche ne correspond à vos critères." 
                    : "No tasks match your criteria.")
                : (language === "fr" 
                    ? "Créez une tâche pour commencer à suivre le travail." 
                    : "Create a task to start tracking work.")}
            </p>
            {(searchQuery || statusFilter !== "all" || categoryFilter !== "all" || projectFilter !== "all" || priorityFilter !== "all") ? (
              <Button 
                variant="outline" 
                onClick={() => { 
                  setSearchQuery(""); 
                  setStatusFilter("all"); 
                  setCategoryFilter("all");
                  setProjectFilter("all");
                  setPriorityFilter("all");
                }}
                data-testid="button-clear-filters"
              >
                {language === "fr" ? "Effacer les filtres" : "Clear filters"}
              </Button>
            ) : (
              <Button 
                onClick={() => setCreateDialogOpen(true)}
                data-testid="button-create-task-empty"
              >
                <Plus className="w-4 h-4 mr-2" />
                {language === "fr" ? "Nouvelle tâche" : "New Task"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <CreateTaskDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen}
        projects={projects}
      />

      <EditTaskDialog 
        task={editingTask}
        open={!!editingTask} 
        onOpenChange={(open) => !open && setEditingTask(null)}
        projects={projects}
      />
    </div>
  );
}
