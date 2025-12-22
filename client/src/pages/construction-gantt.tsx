import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  ListChecks,
  AlertCircle
} from "lucide-react";
import type { ConstructionTask, ConstructionProject } from "@shared/schema";

type TimeScale = "days" | "weeks" | "months";

interface EnrichedTask extends ConstructionTask {
  project?: ConstructionProject;
}

function formatDate(date: Date | string | null | undefined, language: string): string {
  if (!date) return "—";
  const d = new Date(date);
  return d.toLocaleDateString(language === "fr" ? "fr-CA" : "en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getDaysBetween(start: Date, end: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / oneDay);
}

function getStatusColor(status: string): string {
  switch (status) {
    case "completed": return "bg-green-500";
    case "in_progress": return "bg-blue-500";
    case "blocked": return "bg-red-500";
    case "cancelled": return "bg-gray-400";
    default: return "bg-gray-300";
  }
}

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "completed": return "default";
    case "in_progress": return "secondary";
    case "blocked": return "destructive";
    default: return "outline";
  }
}

function getCategoryColor(category: string): string {
  switch (category) {
    case "permitting": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
    case "procurement": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
    case "electrical": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
    case "mechanical": return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300";
    case "structural": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
    case "inspection": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
  }
}

export default function ConstructionGanttPage() {
  const { t, language } = useI18n();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [timeScale, setTimeScale] = useState<TimeScale>("weeks");
  const [selectedTask, setSelectedTask] = useState<EnrichedTask | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<EnrichedTask[]>({
    queryKey: ["/api/construction-tasks", selectedProjectId === "all" ? undefined : selectedProjectId],
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery<ConstructionProject[]>({
    queryKey: ["/api/construction-projects"],
  });

  const filteredTasks = useMemo(() => {
    if (selectedProjectId === "all") return tasks;
    return tasks.filter(task => task.projectId === selectedProjectId);
  }, [tasks, selectedProjectId]);

  const { minDate, maxDate, totalDays, todayPosition } = useMemo(() => {
    if (filteredTasks.length === 0) {
      const today = new Date();
      const start = new Date(today);
      start.setDate(start.getDate() - 7);
      const end = new Date(today);
      end.setDate(end.getDate() + 30);
      return { 
        minDate: start, 
        maxDate: end, 
        totalDays: 37, 
        todayPosition: 7 
      };
    }

    let min = new Date();
    let max = new Date();
    
    filteredTasks.forEach(task => {
      const startDate = task.plannedStartDate ? new Date(task.plannedStartDate) : null;
      const endDate = task.plannedEndDate ? new Date(task.plannedEndDate) : null;
      const actualStart = task.actualStartDate ? new Date(task.actualStartDate) : null;
      const actualEnd = task.actualEndDate ? new Date(task.actualEndDate) : null;

      [startDate, endDate, actualStart, actualEnd].forEach(d => {
        if (d) {
          if (d < min) min = new Date(d);
          if (d > max) max = new Date(d);
        }
      });
    });

    min.setDate(min.getDate() - 7);
    max.setDate(max.getDate() + 14);

    const today = new Date();
    const todayPos = getDaysBetween(min, today);

    return {
      minDate: min,
      maxDate: max,
      totalDays: getDaysBetween(min, max),
      todayPosition: todayPos
    };
  }, [filteredTasks]);

  const dayWidth = useMemo(() => {
    switch (timeScale) {
      case "days": return 40;
      case "weeks": return 20;
      case "months": return 8;
    }
  }, [timeScale]);

  const timeHeaders = useMemo(() => {
    const headers: { label: string; width: number; isMonth?: boolean }[] = [];
    const currentDate = new Date(minDate);
    
    if (timeScale === "days") {
      while (currentDate <= maxDate) {
        headers.push({
          label: currentDate.getDate().toString(),
          width: dayWidth
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else if (timeScale === "weeks") {
      while (currentDate <= maxDate) {
        const weekStart = new Date(currentDate);
        const weekEnd = new Date(currentDate);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const label = `${weekStart.getDate()}/${weekStart.getMonth() + 1}`;
        headers.push({
          label,
          width: dayWidth * 7
        });
        currentDate.setDate(currentDate.getDate() + 7);
      }
    } else {
      let currentMonth = currentDate.getMonth();
      let monthDays = 0;
      const monthNames = language === "fr" 
        ? ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"]
        : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      
      while (currentDate <= maxDate) {
        if (currentDate.getMonth() !== currentMonth) {
          if (monthDays > 0) {
            headers.push({
              label: monthNames[currentMonth],
              width: dayWidth * monthDays,
              isMonth: true
            });
          }
          currentMonth = currentDate.getMonth();
          monthDays = 0;
        }
        monthDays++;
        currentDate.setDate(currentDate.getDate() + 1);
      }
      if (monthDays > 0) {
        headers.push({
          label: monthNames[currentMonth],
          width: dayWidth * monthDays,
          isMonth: true
        });
      }
    }
    
    return headers;
  }, [minDate, maxDate, timeScale, dayWidth, language]);

  const getTaskBarStyles = (task: EnrichedTask) => {
    const plannedStart = task.plannedStartDate ? new Date(task.plannedStartDate) : null;
    const plannedEnd = task.plannedEndDate ? new Date(task.plannedEndDate) : null;
    
    if (!plannedStart || !plannedEnd) return null;

    const left = getDaysBetween(minDate, plannedStart) * dayWidth;
    const width = Math.max(getDaysBetween(plannedStart, plannedEnd) * dayWidth, dayWidth);
    
    return { left, width };
  };

  const getActualBarStyles = (task: EnrichedTask) => {
    const actualStart = task.actualStartDate ? new Date(task.actualStartDate) : null;
    const actualEnd = task.actualEndDate ? new Date(task.actualEndDate) : null;
    
    if (!actualStart) return null;

    const endDate = actualEnd || new Date();
    const left = getDaysBetween(minDate, actualStart) * dayWidth;
    const width = Math.max(getDaysBetween(actualStart, endDate) * dayWidth, dayWidth / 2);
    
    const plannedEnd = task.plannedEndDate ? new Date(task.plannedEndDate) : null;
    const isDelayed = plannedEnd && endDate > plannedEnd;
    
    return { left, width, isDelayed };
  };

  const getDependencyLines = useMemo(() => {
    const lines: { fromTask: EnrichedTask; toTask: EnrichedTask }[] = [];
    
    filteredTasks.forEach(task => {
      if (task.dependsOnTaskIds && task.dependsOnTaskIds.length > 0) {
        task.dependsOnTaskIds.forEach(depId => {
          const dependsOnTask = filteredTasks.find(t => t.id === depId);
          if (dependsOnTask) {
            lines.push({ fromTask: dependsOnTask, toTask: task });
          }
        });
      }
    });
    
    return lines;
  }, [filteredTasks]);

  const isLoading = tasksLoading || projectsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-construction-gantt">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-gantt-title">
            {t("gantt.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("gantt.subtitle")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-[200px]" data-testid="select-project-filter">
              <SelectValue placeholder={t("gantt.selectProject")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" data-testid="select-item-all">
                {t("gantt.allProjects")}
              </SelectItem>
              {projects.map(project => (
                <SelectItem 
                  key={project.id} 
                  value={project.id}
                  data-testid={`select-item-project-${project.id}`}
                >
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center border rounded-md">
            <Button
              variant={timeScale === "days" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setTimeScale("days")}
              data-testid="button-timescale-days"
            >
              {t("gantt.timeScale.days")}
            </Button>
            <Button
              variant={timeScale === "weeks" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setTimeScale("weeks")}
              data-testid="button-timescale-weeks"
            >
              {t("gantt.timeScale.weeks")}
            </Button>
            <Button
              variant={timeScale === "months" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setTimeScale("months")}
              data-testid="button-timescale-months"
            >
              {t("gantt.timeScale.months")}
            </Button>
          </div>
        </div>
      </div>

      <Card className="p-2 text-xs flex flex-wrap gap-4 items-center">
        <span className="font-medium text-muted-foreground">{t("gantt.legend")}:</span>
        <div className="flex items-center gap-2">
          <div className="w-6 h-3 bg-blue-500 rounded-sm" />
          <span>{t("gantt.plannedDates")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-3 bg-green-500 rounded-sm" />
          <span>{t("gantt.actualOnTime")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-3 bg-red-500 rounded-sm" />
          <span>{t("gantt.actualDelayed")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-px h-4 border-l-2 border-dashed border-red-500" />
          <span>{t("gantt.today")}</span>
        </div>
      </Card>

      {filteredTasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ListChecks className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t("gantt.noTasks")}</h3>
            <p className="text-muted-foreground">{t("gantt.noTasksDescription")}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {t("gantt.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex">
              <div className="w-64 shrink-0 border-r bg-muted/30">
                <div className="h-10 border-b flex items-center px-3 font-medium text-sm">
                  {language === "fr" ? "Tâche" : "Task"}
                </div>
                {filteredTasks.map((task, index) => (
                  <div
                    key={task.id}
                    className="h-12 border-b flex items-center px-3 gap-2 hover-elevate cursor-pointer"
                    onClick={() => setSelectedTask(task)}
                    data-testid={`row-task-${task.id}`}
                  >
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(task.status)}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{task.name}</div>
                      {task.project && (
                        <div className="text-xs text-muted-foreground truncate">
                          {task.project.name}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <ScrollArea className="flex-1" ref={scrollRef}>
                <div style={{ width: totalDays * dayWidth, minWidth: "100%" }}>
                  <div className="h-10 border-b flex bg-muted/30 sticky top-0">
                    {timeHeaders.map((header, i) => (
                      <div
                        key={i}
                        className="h-full border-r flex items-center justify-center text-xs font-medium text-muted-foreground"
                        style={{ width: header.width }}
                      >
                        {header.label}
                      </div>
                    ))}
                  </div>

                  <div className="relative">
                    {todayPosition >= 0 && todayPosition <= totalDays && (
                      <div
                        className="absolute top-0 bottom-0 w-px border-l-2 border-dashed border-red-500 z-10"
                        style={{ left: todayPosition * dayWidth }}
                        data-testid="line-today"
                      />
                    )}

                    {filteredTasks.map((task, taskIndex) => {
                      const barStyles = getTaskBarStyles(task);
                      const actualStyles = getActualBarStyles(task);
                      
                      return (
                        <div
                          key={task.id}
                          className="h-12 border-b relative"
                          style={{ 
                            backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent ${dayWidth - 1}px, hsl(var(--border)) ${dayWidth - 1}px, hsl(var(--border)) ${dayWidth}px)` 
                          }}
                        >
                          {barStyles && (
                            <div
                              className="absolute top-2 h-4 bg-blue-500/80 rounded cursor-pointer hover:bg-blue-600/80 transition-colors"
                              style={{
                                left: barStyles.left,
                                width: barStyles.width,
                              }}
                              onClick={() => setSelectedTask(task)}
                              data-testid={`bar-planned-${task.id}`}
                            >
                              <div
                                className="h-full bg-blue-700 rounded-l"
                                style={{ width: `${task.progressPercent || 0}%` }}
                              />
                            </div>
                          )}

                          {actualStyles && (
                            <div
                              className={`absolute top-6 h-2 rounded cursor-pointer transition-colors ${
                                actualStyles.isDelayed 
                                  ? "bg-red-500/80 hover:bg-red-600/80" 
                                  : "bg-green-500/80 hover:bg-green-600/80"
                              }`}
                              style={{
                                left: actualStyles.left,
                                width: actualStyles.width,
                              }}
                              onClick={() => setSelectedTask(task)}
                              data-testid={`bar-actual-${task.id}`}
                            />
                          )}
                        </div>
                      );
                    })}

                    <svg
                      className="absolute top-0 left-0 w-full h-full pointer-events-none"
                      style={{ height: filteredTasks.length * 48 }}
                    >
                      {getDependencyLines.map(({ fromTask, toTask }, i) => {
                        const fromBar = getTaskBarStyles(fromTask);
                        const toBar = getTaskBarStyles(toTask);
                        if (!fromBar || !toBar) return null;

                        const fromIndex = filteredTasks.findIndex(t => t.id === fromTask.id);
                        const toIndex = filteredTasks.findIndex(t => t.id === toTask.id);

                        const x1 = fromBar.left + fromBar.width;
                        const y1 = fromIndex * 48 + 16;
                        const x2 = toBar.left;
                        const y2 = toIndex * 48 + 16;

                        return (
                          <g key={i}>
                            <path
                              d={`M ${x1} ${y1} L ${x1 + 10} ${y1} L ${x1 + 10} ${y2} L ${x2} ${y2}`}
                              fill="none"
                              stroke="hsl(var(--muted-foreground))"
                              strokeWidth="1.5"
                              strokeDasharray="4 2"
                              opacity={0.5}
                            />
                            <polygon
                              points={`${x2},${y2} ${x2 - 6},${y2 - 3} ${x2 - 6},${y2 + 3}`}
                              fill="hsl(var(--muted-foreground))"
                              opacity={0.5}
                            />
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent className="max-w-lg" data-testid="dialog-task-details">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="w-5 h-5" />
              {t("gantt.taskDetails")}
            </DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">{selectedTask.name}</h3>
                {selectedTask.description && (
                  <p className="text-muted-foreground text-sm mt-1">
                    {selectedTask.description}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant={getStatusBadgeVariant(selectedTask.status)}>
                  {t(`gantt.status.${selectedTask.status}`)}
                </Badge>
                <Badge className={getCategoryColor(selectedTask.category)}>
                  {t(`gantt.category.${selectedTask.category}`)}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">{t("gantt.planned")}</div>
                  <div className="font-medium">
                    {formatDate(selectedTask.plannedStartDate, language)} — {formatDate(selectedTask.plannedEndDate, language)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">{t("gantt.actual")}</div>
                  <div className="font-medium">
                    {formatDate(selectedTask.actualStartDate, language)} — {formatDate(selectedTask.actualEndDate, language)}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-muted-foreground text-sm mb-1">{t("gantt.progress")}</div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${selectedTask.progressPercent || 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">{selectedTask.progressPercent || 0}%</span>
                </div>
              </div>

              {selectedTask.assignedToName && (
                <div>
                  <div className="text-muted-foreground text-sm">{t("gantt.assignedTo")}</div>
                  <div className="font-medium">{selectedTask.assignedToName}</div>
                </div>
              )}

              {selectedTask.dependsOnTaskIds && selectedTask.dependsOnTaskIds.length > 0 && (
                <div>
                  <div className="text-muted-foreground text-sm mb-1">{t("gantt.dependencies")}</div>
                  <div className="flex flex-wrap gap-1">
                    {selectedTask.dependsOnTaskIds.map(depId => {
                      const depTask = tasks.find(t => t.id === depId);
                      return (
                        <Badge key={depId} variant="outline" className="text-xs">
                          {depTask?.name || depId}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedTask.blockedReason && (
                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-900">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-red-700 dark:text-red-300">
                      {language === "fr" ? "Raison du blocage" : "Blocked Reason"}
                    </div>
                    <div className="text-sm text-red-600 dark:text-red-400">
                      {selectedTask.blockedReason}
                    </div>
                  </div>
                </div>
              )}

              {selectedTask.project && (
                <div className="pt-2 border-t">
                  <div className="text-muted-foreground text-sm">
                    {language === "fr" ? "Projet" : "Project"}
                  </div>
                  <div className="font-medium">{selectedTask.project.name}</div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
