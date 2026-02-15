import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Pause, Square, RotateCcw, Mail, Check, Clock, XCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

const TEMPLATE_LABELS: Record<string, { fr: string; en: string; day: number }> = {
  nurtureWelcome: { fr: "Bienvenue", en: "Welcome", day: 0 },
  nurtureCTA1: { fr: "Appel découverte", en: "Discovery Call", day: 1 },
  nurtureRiskFlags: { fr: "Risques / valeur", en: "Risk Flags", day: 3 },
  nurtureTripwire: { fr: "Mandat conception", en: "Design Mandate", day: 7 },
  nurturingCaseStudy: { fr: "Étude de cas", en: "Case Study", day: 14 },
  nurturingLastChance: { fr: "Dernière chance", en: "Last Chance", day: 21 },
  nurtureReengagement: { fr: "Réengagement", en: "Re-engagement", day: 30 },
};

interface NurtureStatusData {
  leadId: string;
  nurtureStatus: string;
  nurtureStartedAt: string | null;
  totalEmails: number;
  sentCount: number;
  pendingCount: number;
  sequence: Array<{
    id: string;
    templateKey: string;
    scheduledFor: string;
    sentAt: string | null;
    cancelled: boolean;
    attempts: number;
    lastError: string | null;
    status: "sent" | "pending" | "cancelled" | "overdue";
  }>;
}

export function NurtureStatusPanel({ leadId }: { leadId: string }) {
  const { language } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<NurtureStatusData>({
    queryKey: ["leads", leadId, "nurture", "status"],
    queryFn: async () => {
      return apiRequest("GET", `/api/leads/${leadId}/nurture/status`) as Promise<NurtureStatusData>;
    },
    enabled: !!leadId,
  });

  const nurtureAction = useMutation({
    mutationFn: async (action: "start" | "pause" | "stop") => {
      return apiRequest("POST", `/api/leads/${leadId}/nurture/${action}`);
    },
    onSuccess: (_, action) => {
      queryClient.invalidateQueries({ queryKey: ["leads", leadId, "nurture"] });
      const messages: Record<string, { fr: string; en: string }> = {
        start: { fr: "Séquence de nurturing démarrée", en: "Nurture sequence started" },
        pause: { fr: "Séquence de nurturing mise en pause", en: "Nurture sequence paused" },
        stop: { fr: "Séquence de nurturing arrêtée", en: "Nurture sequence stopped" },
      };
      toast({
        title: language === "fr" ? messages[action].fr : messages[action].en,
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

  if (isLoading) return <Skeleton className="h-32" />;
  if (!data) return null;

  const status = data.nurtureStatus;

  const statusConfig: Record<string, { label: { fr: string; en: string }; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    active: { label: { fr: "Actif", en: "Active" }, variant: "default" },
    paused: { label: { fr: "En pause", en: "Paused" }, variant: "secondary" },
    stopped: { label: { fr: "Arrêté", en: "Stopped" }, variant: "destructive" },
    completed: { label: { fr: "Terminé", en: "Completed" }, variant: "outline" },
    none: { label: { fr: "Non démarré", en: "Not started" }, variant: "outline" },
  };
  const currentStatus = statusConfig[status] || statusConfig.none;

  return (
    <div className="space-y-4" data-testid="nurture-status-panel">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Mail className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm">
            {language === "fr" ? "Nurturing par email" : "Email Nurturing"}
          </span>
          <Badge variant={currentStatus.variant} data-testid="badge-nurture-status">
            {language === "fr" ? currentStatus.label.fr : currentStatus.label.en}
          </Badge>
          {data.totalEmails > 0 && (
            <span className="text-xs text-muted-foreground">
              {data.sentCount}/{data.totalEmails} {language === "fr" ? "envoyés" : "sent"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {(status === "none" || status === "stopped" || status === "paused") && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => nurtureAction.mutate("start")}
              disabled={nurtureAction.isPending}
              data-testid="button-nurture-start"
            >
              {status === "paused" ? <RotateCcw className="w-3 h-3 mr-1" /> : <Play className="w-3 h-3 mr-1" />}
              {status === "paused" 
                ? (language === "fr" ? "Reprendre" : "Resume")
                : (language === "fr" ? "Démarrer" : "Start")}
            </Button>
          )}
          {status === "active" && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => nurtureAction.mutate("pause")}
                disabled={nurtureAction.isPending}
                data-testid="button-nurture-pause"
              >
                <Pause className="w-3 h-3 mr-1" />
                {language === "fr" ? "Pause" : "Pause"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => nurtureAction.mutate("stop")}
                disabled={nurtureAction.isPending}
                data-testid="button-nurture-stop"
              >
                <Square className="w-3 h-3 mr-1" />
                {language === "fr" ? "Arrêter" : "Stop"}
              </Button>
            </>
          )}
        </div>
      </div>

      {data.sequence.length > 0 && (
        <div className="space-y-2">
          <div className="flex gap-1">
            {data.sequence.map((email, i) => (
              <div
                key={email.id}
                className={`h-1.5 flex-1 rounded-full ${
                  email.status === "sent" ? "bg-green-500" :
                  email.status === "pending" ? "bg-blue-200 dark:bg-blue-900" :
                  email.status === "overdue" ? "bg-amber-400" :
                  "bg-muted"
                }`}
                data-testid={`progress-bar-${i}`}
              />
            ))}
          </div>

          <div className="space-y-1.5">
            {data.sequence.map((email, i) => {
              const templateInfo = TEMPLATE_LABELS[email.templateKey] || {
                fr: email.templateKey, en: email.templateKey, day: 0
              };
              const statusIcon = email.status === "sent" ? <Check className="w-3.5 h-3.5 text-green-600" /> :
                email.status === "pending" ? <Clock className="w-3.5 h-3.5 text-blue-500" /> :
                email.status === "overdue" ? <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> :
                <XCircle className="w-3.5 h-3.5 text-muted-foreground" />;

              return (
                <div
                  key={email.id}
                  className="flex items-center justify-between gap-2 py-1 px-2 rounded text-xs"
                  data-testid={`nurture-email-${i}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {statusIcon}
                    <span className="font-medium truncate">
                      {language === "fr" ? `Jour ${templateInfo.day}` : `Day ${templateInfo.day}`}
                      {" — "}
                      {language === "fr" ? templateInfo.fr : templateInfo.en}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-muted-foreground">
                    {email.sentAt ? (
                      <span>{format(new Date(email.sentAt), "d MMM yyyy")}</span>
                    ) : email.status === "pending" ? (
                      <span>{format(new Date(email.scheduledFor), "d MMM yyyy")}</span>
                    ) : email.status === "cancelled" ? (
                      <span>{language === "fr" ? "Annulé" : "Cancelled"}</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data.sequence.length === 0 && status === "none" && (
        <p className="text-xs text-muted-foreground">
          {language === "fr"
            ? "Aucune séquence de nurturing n'a été démarrée pour ce prospect."
            : "No nurture sequence has been started for this lead."}
        </p>
      )}
    </div>
  );
}
