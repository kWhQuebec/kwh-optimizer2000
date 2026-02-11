import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function AdminSettingsPage() {
  const { language } = useI18n();
  const { toast } = useToast();
  const { isAdmin } = useAuth();

  const { data: nurturingSetting, isLoading } = useQuery<{ settingKey: string; value: any }>({
    queryKey: ["admin", "settings", "email_nurturing_enabled"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/settings/email_nurturing_enabled");
      return res as { settingKey: string; value: any };
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      return apiRequest("PUT", "/api/admin/settings/email_nurturing_enabled", { value: enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
      toast({
        title: language === "fr" ? "Paramètre mis à jour" : "Setting updated",
        description: language === "fr" 
          ? "Le nurturing par email a été mis à jour." 
          : "Email nurturing has been updated.",
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

  const isNurturingEnabled = nurturingSetting?.value !== false;

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <Shield className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <p className="text-lg text-muted-foreground">
          {language === "fr" ? "Accès réservé aux administrateurs" : "Admin access required"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-settings-title">
          {language === "fr" ? "Paramètres système" : "System Settings"}
        </h1>
        <p className="text-muted-foreground mt-2">
          {language === "fr"
            ? "Configuration globale de la plateforme"
            : "Global platform configuration"}
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-md">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">
                    {language === "fr" ? "Nurturing par email" : "Email Lead Nurturing"}
                  </CardTitle>
                  <CardDescription>
                    {language === "fr"
                      ? "Séquence automatique de 6 emails envoyée aux nouveaux prospects sur 30 jours"
                      : "Automatic 6-email sequence sent to new leads over 30 days"}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Badge variant={isNurturingEnabled ? "default" : "secondary"} data-testid="badge-nurturing-status">
                  {isNurturingEnabled 
                    ? (language === "fr" ? "Actif" : "Active")
                    : (language === "fr" ? "Inactif" : "Inactive")}
                </Badge>
                <Switch
                  checked={isNurturingEnabled}
                  onCheckedChange={(checked) => toggleMutation.mutate(checked)}
                  disabled={toggleMutation.isPending}
                  data-testid="switch-nurturing-global"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                {language === "fr"
                  ? "Quand cette option est activée, chaque nouveau prospect reçoit automatiquement une séquence de 6 emails éducatifs :"
                  : "When enabled, every new lead automatically receives a 6-email educational sequence:"}
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>{language === "fr" ? "Jour 3 : Rappel des incitatifs financiers" : "Day 3: Financial incentives reminder"}</li>
                <li>{language === "fr" ? "Jour 7 : Étude de cas / preuve sociale" : "Day 7: Case study / social proof"}</li>
                <li>{language === "fr" ? "Jour 10 : Hausse des coûts d'énergie" : "Day 10: Rising energy costs"}</li>
                <li>{language === "fr" ? "Jour 14 : Démystification des mythes" : "Day 14: Myth busting"}</li>
                <li>{language === "fr" ? "Jour 21 : Incitatifs à durée limitée" : "Day 21: Time-sensitive incentives"}</li>
                <li>{language === "fr" ? "Jour 30 : Dernier suivi respectueux" : "Day 30: Last respectful follow-up"}</li>
              </ul>
              <p className="text-xs mt-3 italic">
                {language === "fr"
                  ? "Note : Désactiver cette option arrête l'envoi de tous les emails de nurturing en attente. Les emails déjà envoyés ne sont pas affectés. Vous pouvez aussi contrôler le nurturing individuellement sur chaque prospect."
                  : "Note: Disabling this stops all pending nurture emails from being sent. Already sent emails are not affected. You can also control nurturing individually on each lead."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
