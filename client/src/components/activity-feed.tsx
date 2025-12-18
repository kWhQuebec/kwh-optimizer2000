import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { fr, enCA } from "date-fns/locale";
import {
  Phone,
  Mail,
  Calendar,
  FileText,
  MapPin,
  Plus,
  Trash2,
  Loader2,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Send,
  UserCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Activity } from "@shared/schema";

interface ActivityFeedProps {
  leadId?: string;
  clientId?: string;
  siteId?: string;
  opportunityId?: string;
  title?: string;
}

const activityFormSchema = z.object({
  activityType: z.enum(["call", "email", "meeting", "note", "site_visit", "proposal_sent", "follow_up"]),
  direction: z.enum(["inbound", "outbound"]).optional(),
  subject: z.string().min(1, "Subject is required"),
  description: z.string().optional(),
  outcome: z.string().optional(),
  followUpDate: z.string().optional(),
});

type ActivityFormData = z.infer<typeof activityFormSchema>;

const activityTypeIcons: Record<string, React.ElementType> = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  note: FileText,
  site_visit: MapPin,
  proposal_sent: Send,
  follow_up: UserCheck,
};

const outcomeLabels: Record<string, { fr: string; en: string }> = {
  connected: { fr: "Connecté", en: "Connected" },
  voicemail: { fr: "Messagerie vocale", en: "Voicemail" },
  no_answer: { fr: "Pas de réponse", en: "No answer" },
  scheduled_meeting: { fr: "Réunion planifiée", en: "Meeting scheduled" },
  sent: { fr: "Envoyé", en: "Sent" },
  received: { fr: "Reçu", en: "Received" },
  completed: { fr: "Terminé", en: "Completed" },
};

export function ActivityFeed({
  leadId,
  clientId,
  siteId,
  opportunityId,
  title,
}: ActivityFeedProps) {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const queryParams = new URLSearchParams();
  if (siteId) queryParams.append("siteId", siteId);
  if (clientId) queryParams.append("clientId", clientId);
  if (leadId) queryParams.append("leadId", leadId);
  if (opportunityId) queryParams.append("opportunityId", opportunityId);

  const queryKey = ["/api/activities", queryParams.toString()];

  const { data: activities, isLoading } = useQuery<Activity[]>({
    queryKey,
    queryFn: async () => {
      const response = await fetch(`/api/activities?${queryParams.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch activities");
      return response.json();
    },
  });

  const form = useForm<ActivityFormData>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: {
      activityType: "call",
      direction: "outbound",
      subject: "",
      description: "",
      outcome: "",
      followUpDate: "",
    },
  });

  const selectedType = form.watch("activityType");

  const createMutation = useMutation({
    mutationFn: async (data: ActivityFormData) => {
      const payload = {
        ...data,
        leadId,
        clientId,
        siteId,
        opportunityId,
        followUpDate: data.followUpDate ? new Date(data.followUpDate).toISOString() : undefined,
      };
      return apiRequest("POST", "/api/activities", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      setDialogOpen(false);
      form.reset();
      toast({
        title: language === "fr" ? "Activité créée" : "Activity created",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: language === "fr" ? "Erreur" : "Error",
        description: language === "fr" 
          ? "Impossible de créer l'activité" 
          : "Failed to create activity",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/activities/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      setDeleteId(null);
      toast({
        title: language === "fr" ? "Activité supprimée" : "Activity deleted",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: language === "fr" ? "Erreur" : "Error",
        description: language === "fr" 
          ? "Impossible de supprimer l'activité" 
          : "Failed to delete activity",
      });
    },
  });

  const handleSubmit = (data: ActivityFormData) => {
    createMutation.mutate(data);
  };

  const sortedActivities = activities?.slice().sort((a, b) => {
    const dateA = new Date(a.activityDate || a.createdAt || 0);
    const dateB = new Date(b.activityDate || b.createdAt || 0);
    return dateB.getTime() - dateA.getTime();
  });

  const formatDate = (dateString: string | Date | null | undefined) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return format(date, "PPp", { locale: language === "fr" ? fr : enCA });
  };

  const getActivityTypeLabel = (type: string) => {
    const labels: Record<string, { fr: string; en: string }> = {
      call: { fr: "Appel", en: "Call" },
      email: { fr: "Courriel", en: "Email" },
      meeting: { fr: "Réunion", en: "Meeting" },
      note: { fr: "Note", en: "Note" },
      site_visit: { fr: "Visite de site", en: "Site visit" },
      proposal_sent: { fr: "Proposition envoyée", en: "Proposal sent" },
      follow_up: { fr: "Suivi", en: "Follow-up" },
    };
    return labels[type]?.[language] || type;
  };

  const displayTitle = title || t("activity.title");

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover-elevate">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                {displayTitle}
                {activities && (
                  <Badge variant="secondary" className="ml-2">
                    {activities.length}
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDialogOpen(true);
                  }}
                  data-testid="button-add-activity"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {language === "fr" ? "Ajouter" : "Add"}
                </Button>
                {isOpen ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : !sortedActivities?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>{language === "fr" ? "Aucune activité enregistrée" : "No activities recorded"}</p>
                <p className="text-sm mt-1">
                  {language === "fr" 
                    ? "Cliquez sur 'Ajouter' pour créer une activité" 
                    : "Click 'Add' to create an activity"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedActivities.map((activity) => {
                  const Icon = activityTypeIcons[activity.activityType] || FileText;
                  return (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-card hover-elevate"
                      data-testid={`activity-item-${activity.id}`}
                    >
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">
                            {activity.subject || getActivityTypeLabel(activity.activityType)}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {getActivityTypeLabel(activity.activityType)}
                          </Badge>
                          {activity.direction && (
                            <Badge variant="secondary" className="text-xs gap-1">
                              {activity.direction === "inbound" ? (
                                <ArrowDownLeft className="w-3 h-3" />
                              ) : (
                                <ArrowUpRight className="w-3 h-3" />
                              )}
                              {activity.direction === "inbound" 
                                ? (language === "fr" ? "Entrant" : "Inbound")
                                : (language === "fr" ? "Sortant" : "Outbound")}
                            </Badge>
                          )}
                          {activity.outcome && (
                            <Badge className="text-xs">
                              {outcomeLabels[activity.outcome]?.[language] || activity.outcome}
                            </Badge>
                          )}
                        </div>
                        
                        {activity.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {activity.description}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>{formatDate(activity.activityDate)}</span>
                          {activity.followUpDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {language === "fr" ? "Suivi:" : "Follow-up:"} {formatDate(activity.followUpDate)}
                            </span>
                          )}
                        </div>
                      </div>

                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeleteId(activity.id)}
                        data-testid={`button-delete-activity-${activity.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {language === "fr" ? "Ajouter une activité" : "Add Activity"}
            </DialogTitle>
            <DialogDescription>
              {language === "fr" 
                ? "Enregistrez un appel, courriel, réunion ou note." 
                : "Log a call, email, meeting or note."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="activityType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "fr" ? "Type" : "Type"}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-activity-type">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="call">{language === "fr" ? "Appel" : "Call"}</SelectItem>
                        <SelectItem value="email">{language === "fr" ? "Courriel" : "Email"}</SelectItem>
                        <SelectItem value="meeting">{language === "fr" ? "Réunion" : "Meeting"}</SelectItem>
                        <SelectItem value="note">{language === "fr" ? "Note" : "Note"}</SelectItem>
                        <SelectItem value="site_visit">{language === "fr" ? "Visite de site" : "Site visit"}</SelectItem>
                        <SelectItem value="proposal_sent">{language === "fr" ? "Proposition envoyée" : "Proposal sent"}</SelectItem>
                        <SelectItem value="follow_up">{language === "fr" ? "Suivi" : "Follow-up"}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {(selectedType === "call" || selectedType === "email") && (
                <FormField
                  control={form.control}
                  name="direction"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Direction" : "Direction"}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value || "outbound"}>
                        <FormControl>
                          <SelectTrigger data-testid="select-direction">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="outbound">{language === "fr" ? "Sortant" : "Outbound"}</SelectItem>
                          <SelectItem value="inbound">{language === "fr" ? "Entrant" : "Inbound"}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "fr" ? "Sujet" : "Subject"}</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder={language === "fr" ? "Sujet de l'activité" : "Activity subject"}
                        data-testid="input-activity-subject"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "fr" ? "Description" : "Description"}</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder={language === "fr" ? "Détails de l'activité..." : "Activity details..."}
                        rows={3}
                        data-testid="textarea-activity-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="outcome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "fr" ? "Résultat" : "Outcome"}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-outcome">
                          <SelectValue placeholder={language === "fr" ? "Sélectionner..." : "Select..."} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="connected">{language === "fr" ? "Connecté" : "Connected"}</SelectItem>
                        <SelectItem value="voicemail">{language === "fr" ? "Messagerie vocale" : "Voicemail"}</SelectItem>
                        <SelectItem value="no_answer">{language === "fr" ? "Pas de réponse" : "No answer"}</SelectItem>
                        <SelectItem value="scheduled_meeting">{language === "fr" ? "Réunion planifiée" : "Meeting scheduled"}</SelectItem>
                        <SelectItem value="sent">{language === "fr" ? "Envoyé" : "Sent"}</SelectItem>
                        <SelectItem value="received">{language === "fr" ? "Reçu" : "Received"}</SelectItem>
                        <SelectItem value="completed">{language === "fr" ? "Terminé" : "Completed"}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="followUpDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "fr" ? "Date de suivi" : "Follow-up date"}</FormLabel>
                    <FormControl>
                      <Input 
                        type="datetime-local" 
                        {...field} 
                        data-testid="input-followup-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  data-testid="button-cancel-activity"
                >
                  {language === "fr" ? "Annuler" : "Cancel"}
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  data-testid="button-save-activity"
                >
                  {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {language === "fr" ? "Enregistrer" : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === "fr" ? "Supprimer l'activité?" : "Delete activity?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === "fr" 
                ? "Cette action est irréversible. L'activité sera définitivement supprimée."
                : "This action cannot be undone. The activity will be permanently deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              {language === "fr" ? "Annuler" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {language === "fr" ? "Supprimer" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Collapsible>
  );
}
