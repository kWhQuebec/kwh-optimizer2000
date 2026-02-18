import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { KeyRound, Send, Loader2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Client, Site } from "@shared/schema";

export interface ClientWithSites extends Client {
  sites: Site[];
  siteCount?: number;
}

export const portalAccessFormSchema = z.object({
  email: z.string().email("Courriel invalide"),
  contactName: z.string().optional(),
  language: z.enum(["fr", "en"]),
  customMessage: z.string().optional(),
});

export type PortalAccessFormValues = z.infer<typeof portalAccessFormSchema>;

export function GrantPortalAccessDialog({ 
  client, 
  open, 
  onOpenChange 
}: { 
  client: ClientWithSites; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const [result, setResult] = useState<{ success: boolean; emailSent: boolean; tempPassword?: string; error?: string; warning?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: language === "fr" ? "Copié" : "Copied",
        description: language === "fr" ? "Mot de passe copié dans le presse-papiers" : "Password copied to clipboard",
      });
    } catch (err) {
      console.error('Failed to copy:', err);
      toast({
        title: language === "fr" ? "Impossible de copier" : "Unable to copy",
        description: language === "fr" 
          ? "Veuillez sélectionner et copier le mot de passe manuellement."
          : "Please select and copy the password manually.",
        variant: "destructive",
      });
    }
  };
  
  const form = useForm<PortalAccessFormValues>({
    resolver: zodResolver(portalAccessFormSchema),
    defaultValues: {
      email: client.email || "",
      contactName: client.mainContactName || "",
      language: language as "fr" | "en",
      customMessage: "",
    },
  });
  
  type GrantAccessResult = { success: boolean; emailSent: boolean; tempPassword?: string; error?: string; warning?: string };
  
  const grantAccessMutation = useMutation({
    mutationFn: async (data: PortalAccessFormValues): Promise<GrantAccessResult> => {
      return await apiRequest("POST", `/api/clients/${client.id}/grant-portal-access`, data) as GrantAccessResult;
    },
    onSuccess: (data: { success: boolean; emailSent: boolean; tempPassword?: string; error?: string; warning?: string }) => {
      setResult(data);
      if (data.emailSent) {
        toast({ 
          title: language === "fr" ? "Accès au portail accordé" : "Portal access granted",
          description: language === "fr" 
            ? "Le courriel d'invitation a été envoyé avec succès." 
            : "The invitation email has been sent successfully."
        });
      } else {
        toast({ 
          title: language === "fr" ? "Compte créé" : "Account created",
          description: language === "fr" 
            ? "Le compte a été créé mais le courriel n'a pas pu être envoyé." 
            : "The account was created but the email could not be sent.",
          variant: "default"
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error: any) => {
      let message = error?.message || (language === "fr" ? "Une erreur est survenue" : "An error occurred");
      
      try {
        const colonIndex = message.indexOf(': ');
        if (colonIndex > 0) {
          const bodyPart = message.substring(colonIndex + 2);
          const parsed = JSON.parse(bodyPart);
          if (parsed.error) {
            message = parsed.error;
          }
        }
      } catch {
      }
      
      toast({ 
        title: language === "fr" ? "Erreur" : "Error",
        description: message,
        variant: "destructive"
      });
    },
  });
  
  const handleSubmit = (data: PortalAccessFormValues) => {
    setResult(null);
    grantAccessMutation.mutate(data);
  };
  
  const handleClose = () => {
    setResult(null);
    form.reset();
    onOpenChange(false);
  };
  
  const defaultMessageFr = `Bonjour,

Nous avons le plaisir de vous informer que votre analyse solaire est maintenant disponible sur notre portail client. Vous pourrez y consulter les résultats détaillés, les projections financières et télécharger le rapport PDF complet.

N'hésitez pas à nous contacter si vous avez des questions.`;

  const defaultMessageEn = `Hello,

We are pleased to inform you that your solar analysis is now available on our client portal. You will be able to view detailed results, financial projections, and download the complete PDF report.

Please don't hesitate to contact us if you have any questions.`;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            {language === "fr" ? "Accorder l'accès au portail" : "Grant Portal Access"}
          </DialogTitle>
          <DialogDescription>
            {language === "fr" 
              ? `Créer un compte utilisateur pour ${client.name} et envoyer les identifiants par courriel.`
              : `Create a user account for ${client.name} and send credentials by email.`}
          </DialogDescription>
        </DialogHeader>
        
        {result?.success ? (
          <div className="space-y-4">
            <Alert className={result.emailSent ? "border-green-500 bg-green-50 dark:bg-green-950" : "border-yellow-500 bg-yellow-50 dark:bg-yellow-950"}>
              <AlertDescription>
                {result.emailSent ? (
                  <span className="text-green-700 dark:text-green-300">
                    {language === "fr" 
                      ? "Le compte a été créé et le courriel d'invitation a été envoyé avec succès."
                      : "The account has been created and the invitation email has been sent successfully."}
                  </span>
                ) : (
                  <div className="text-yellow-700 dark:text-yellow-300">
                    <p className="font-medium mb-2">
                      {language === "fr" 
                        ? "Le compte a été créé mais l'envoi du courriel a échoué."
                        : "The account was created but the email failed to send."}
                    </p>
                    {result.tempPassword && (
                      <div className="bg-white dark:bg-black p-3 rounded border mt-2">
                        <p className="text-sm text-muted-foreground mb-1">
                          {language === "fr" ? "Mot de passe temporaire :" : "Temporary password:"}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="text-base font-mono font-bold flex-1" data-testid="text-temp-password">{result.tempPassword}</code>
                          <Button 
                            size="icon" 
                            variant="outline"
                            onClick={() => copyToClipboard(result.tempPassword!)}
                            data-testid="button-copy-password"
                          >
                            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {language === "fr" 
                            ? "Copiez ce mot de passe et envoyez-le au client par un autre moyen (téléphone, message, etc.)."
                            : "Copy this password and share it with the client through another method (phone, message, etc.)."}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <Button onClick={handleClose}>
                {language === "fr" ? "Fermer" : "Close"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "fr" ? "Courriel du client" : "Client Email"} *</FormLabel>
                    <FormControl>
                      <Input 
                        type="email" 
                        placeholder="client@example.com" 
                        {...field} 
                        data-testid="input-portal-email" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="contactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "fr" ? "Nom du contact" : "Contact Name"}</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder={language === "fr" ? "Jean Dupont" : "John Doe"} 
                        {...field} 
                        data-testid="input-portal-contact-name" 
                      />
                    </FormControl>
                    <FormDescription>
                      {language === "fr" 
                        ? "Nom utilisé dans le courriel de bienvenue"
                        : "Name used in the welcome email"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="language"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "fr" ? "Langue du courriel" : "Email Language"}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-portal-language">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="fr">Français</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="customMessage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "fr" ? "Message personnalisé (optionnel)" : "Custom Message (optional)"}</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder={form.watch("language") === "fr" ? defaultMessageFr : defaultMessageEn}
                        className="min-h-[120px] resize-none"
                        {...field} 
                        data-testid="input-portal-custom-message" 
                      />
                    </FormControl>
                    <FormDescription>
                      {language === "fr" 
                        ? "Ce message sera ajouté au courriel d'invitation standard"
                        : "This message will be added to the standard invitation email"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={handleClose}>
                  {t("common.cancel")}
                </Button>
                <Button 
                  type="submit" 
                  disabled={grantAccessMutation.isPending}
                  className="gap-2"
                  data-testid="button-send-portal-invite"
                >
                  {grantAccessMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {language === "fr" ? "Envoi en cours..." : "Sending..."}
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      {language === "fr" ? "Créer le compte et envoyer" : "Create Account & Send"}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}