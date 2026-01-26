import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { Plus, Users, Mail, Phone, MapPin, Building2, MoreHorizontal, Pencil, Trash2, KeyRound, Send, Loader2, Copy, Check, ChevronDown, Search, ChevronLeft, ChevronRight, FileSignature } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Client, Site } from "@shared/schema";

const clientFormSchema = z.object({
  name: z.string().min(1, "Ce champ est requis"),
  mainContactName: z.string().optional(),
  email: z.string().email("Courriel invalide").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  notes: z.string().optional(),
});

type ClientFormValues = z.infer<typeof clientFormSchema>;

interface ClientWithSites extends Client {
  sites: Site[];
}

interface ClientsListResponse {
  clients: ClientWithSites[];
  total: number;
}

const portalAccessFormSchema = z.object({
  email: z.string().email("Courriel invalide"),
  contactName: z.string().optional(),
  language: z.enum(["fr", "en"]),
  customMessage: z.string().optional(),
});

type PortalAccessFormValues = z.infer<typeof portalAccessFormSchema>;

function GrantPortalAccessDialog({ 
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
      // apiRequest already returns parsed JSON and throws on non-ok status
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
      // Parse error message - apiRequest throws errors in format "status: body"
      let message = error?.message || (language === "fr" ? "Une erreur est survenue" : "An error occurred");
      
      // Try to extract just the meaningful error from the format "status: {json}"
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
        // Keep original message if parsing fails
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

function SendHqProcurationDialog({ 
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
  const [selectedLanguage, setSelectedLanguage] = useState<"fr" | "en">(language as "fr" | "en");
  
  const sendProcurationMutation = useMutation({
    mutationFn: async (lang: "fr" | "en") => {
      return await apiRequest("POST", `/api/clients/${client.id}/send-hq-procuration`, { language: lang });
    },
    onSuccess: () => {
      toast({ 
        title: t("clients.procurationSent"),
        description: language === "fr" 
          ? `Courriel envoyé à ${client.email}` 
          : `Email sent to ${client.email}`
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      let message = error?.message || t("clients.procurationSendError");
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
        title: t("clients.procurationSendError"),
        description: message,
        variant: "destructive"
      });
    },
  });
  
  const handleSend = () => {
    sendProcurationMutation.mutate(selectedLanguage);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-primary" />
            {t("clients.sendHqProcuration")}
          </DialogTitle>
          <DialogDescription>
            {language === "fr" 
              ? `Envoyer un courriel à ${client.name} avec un lien vers le formulaire de procuration Hydro-Québec.`
              : `Send an email to ${client.name} with a link to the Hydro-Québec authorization form.`}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {language === "fr" ? "Adresse courriel" : "Email address"}
            </label>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm" data-testid="text-procuration-email">{client.email}</span>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {language === "fr" ? "Langue du courriel" : "Email language"}
            </label>
            <RadioGroup
              value={selectedLanguage}
              onValueChange={(val) => setSelectedLanguage(val as "fr" | "en")}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="fr" id="lang-fr" data-testid="radio-language-fr" />
                <label htmlFor="lang-fr" className="text-sm cursor-pointer">Français</label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="en" id="lang-en" data-testid="radio-language-en" />
                <label htmlFor="lang-en" className="text-sm cursor-pointer">English</label>
              </div>
            </RadioGroup>
          </div>
        </div>
        
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button 
            onClick={handleSend}
            disabled={sendProcurationMutation.isPending}
            className="gap-2"
            data-testid="button-send-procuration"
          >
            {sendProcurationMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {language === "fr" ? "Envoi en cours..." : "Sending..."}
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                {language === "fr" ? "Envoyer" : "Send"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClientCard({ client, onEdit, onDelete, onGrantAccess, onSendHqProcuration }: { client: ClientWithSites; onEdit: () => void; onDelete: () => void; onGrantAccess: () => void; onSendHqProcuration: () => void }) {
  const { t } = useI18n();

  return (
    <Card className="hover-elevate">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold truncate">{client.name}</h3>
                {client.mainContactName && (
                  <p className="text-sm text-muted-foreground truncate">{client.mainContactName}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5 text-sm">
              {client.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{client.email}</span>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <span>{client.phone}</span>
                </div>
              )}
              {(client.city || client.province) && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span>{[client.city, client.province].filter(Boolean).join(", ")}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Link href={`/app/clients/${client.id}/sites`}>
                <Button variant="outline" size="sm" className="gap-1.5" data-testid={`button-view-sites-${client.id}`}>
                  <Building2 className="w-3.5 h-3.5" />
                  {client.sites?.length || 0} {t("clients.sites").toLowerCase()}
                </Button>
              </Link>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" data-testid={`button-client-menu-${client.id}`}>
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onGrantAccess}>
                <KeyRound className="w-4 h-4 mr-2" />
                {t("clients.grantPortalAccess")}
              </DropdownMenuItem>
              {client.email && (
                <DropdownMenuItem onClick={onSendHqProcuration} data-testid={`menu-send-hq-procuration-${client.id}`}>
                  <FileSignature className="w-4 h-4 mr-2" />
                  {t("clients.sendHqProcuration")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="w-4 h-4 mr-2" />
                {t("common.edit")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                {t("common.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

function ClientForm({ 
  client, 
  onSubmit, 
  onCancel, 
  isLoading 
}: { 
  client?: Client; 
  onSubmit: (data: ClientFormValues) => void; 
  onCancel: () => void; 
  isLoading: boolean;
}) {
  const { t } = useI18n();
  
  const [addressOpen, setAddressOpen] = useState(
    !!(client?.address || client?.city || client?.province || client?.postalCode)
  );
  const { language } = useI18n();
  
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      name: client?.name || "",
      mainContactName: client?.mainContactName || "",
      email: client?.email || "",
      phone: client?.phone || "",
      address: client?.address || "",
      city: client?.city || "",
      province: client?.province || "QC",
      postalCode: client?.postalCode || "",
      notes: client?.notes || "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("clients.name")} *</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-client-name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="mainContactName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("clients.contact")}</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-client-contact" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("form.email")}</FormLabel>
              <FormControl>
                <Input type="email" {...field} data-testid="input-client-email" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("form.phone")}</FormLabel>
              <FormControl>
                <Input type="tel" {...field} data-testid="input-client-phone" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Collapsible open={addressOpen} onOpenChange={setAddressOpen}>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="flex items-center gap-2 w-full justify-start text-muted-foreground hover:text-foreground"
              data-testid="button-toggle-address"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${addressOpen ? "rotate-180" : ""}`} />
              <MapPin className="w-4 h-4" />
              {language === "fr" ? "Adresse complète" : "Full Address"}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("sites.address")}</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-client-address" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("form.city")}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-client-city" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="province"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("form.province")}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-client-province" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="postalCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "fr" ? "Code postal" : "Postal Code"}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-client-postal" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{language === "fr" ? "Notes" : "Notes"}</FormLabel>
              <FormControl>
                <Textarea 
                  {...field} 
                  placeholder={language === "fr" ? "Notes internes sur ce client..." : "Internal notes about this client..."}
                  className="min-h-[80px] resize-none"
                  data-testid="input-client-notes" 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={isLoading} data-testid="button-save-client">
            {isLoading ? t("common.loading") : t("common.save")}
          </Button>
        </div>
      </form>
    </Form>
  );
}

const ITEMS_PER_PAGE = 50;

export default function ClientsPage() {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [portalAccessClient, setPortalAccessClient] = useState<ClientWithSites | null>(null);
  const [hqProcurationClient, setHqProcurationClient] = useState<ClientWithSites | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);

  // Debounce search input
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setPage(0); // Reset to first page on search
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, []);

  // Build query params
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", String(ITEMS_PER_PAGE));
    params.set("offset", String(page * ITEMS_PER_PAGE));
    if (debouncedSearch) params.set("search", debouncedSearch);
    return params.toString();
  }, [page, debouncedSearch]);

  const { data: clientsData, isLoading } = useQuery<ClientsListResponse>({
    queryKey: ["/api/clients/list", queryParams],
    queryFn: async () => {
      return await apiRequest<ClientsListResponse>("GET", `/api/clients/list?${queryParams}`);
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  const clients = clientsData?.clients ?? [];
  const totalClients = clientsData?.total ?? 0;
  const totalPages = Math.ceil(totalClients / ITEMS_PER_PAGE);

  const createMutation = useMutation({
    mutationFn: async (data: ClientFormValues) => {
      return apiRequest("POST", "/api/clients", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients/list"] });
      setDialogOpen(false);
      toast({ title: t("clients.clientCreated") });
    },
    onError: () => {
      toast({ title: t("clients.createError"), variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ClientFormValues & { id: string }) => {
      const { id, ...rest } = data;
      return apiRequest("PATCH", `/api/clients/${id}`, rest);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients/list"] });
      setEditingClient(null);
      toast({ title: t("clients.clientUpdated") });
    },
    onError: () => {
      toast({ title: t("clients.updateError"), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/clients/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients/list"] });
      toast({ title: t("clients.clientDeleted") });
    },
    onError: (error: Error) => {
      // Parse error message from apiRequest format: "status: {json}"
      let errorMessage = t("clients.deleteError");
      try {
        const match = error.message?.match(/^\d+:\s*(.+)$/);
        if (match) {
          const parsed = JSON.parse(match[1]);
          errorMessage = parsed.error || errorMessage;
        }
      } catch {
        // If parsing fails, use the raw message or fallback
        if (error.message) {
          errorMessage = error.message.replace(/^\d+:\s*/, '');
        }
      }
      toast({ 
        title: language === "fr" ? "Impossible de supprimer" : "Cannot delete",
        description: errorMessage,
        variant: "destructive" 
      });
    },
  });

  const handleCreate = (data: ClientFormValues) => {
    createMutation.mutate(data);
  };

  const handleUpdate = (data: ClientFormValues) => {
    if (editingClient) {
      updateMutation.mutate({ ...data, id: editingClient.id });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("clients.title")}</h1>
          <p className="text-muted-foreground mt-1">
            {language === "fr" 
              ? `Entreprises avec projets actifs ou convertis • ${totalClients} client(s)`
              : `Companies with active or converted projects • ${totalClients} client(s)`
            }
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {language === "fr" 
              ? "Pour un nouveau lead, utilisez le Pipeline de ventes"
              : "For a new lead, use the Sales Pipeline"}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={language === "fr" ? "Rechercher..." : "Search..."}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 w-48"
              data-testid="input-search-clients"
            />
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-add-client">
                <Plus className="w-4 h-4" />
                {t("clients.add")}
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("clients.add")}</DialogTitle>
            </DialogHeader>
            <ClientForm
              onSubmit={handleCreate}
              onCancel={() => setDialogOpen(false)}
              isLoading={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
        </div>
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
                <div className="space-y-2">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : clients && clients.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onEdit={() => setEditingClient(client)}
              onDelete={() => deleteMutation.mutate(client.id)}
              onGrantAccess={() => setPortalAccessClient(client)}
              onSendHqProcuration={() => setHqProcurationClient(client)}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-1">{t("clients.empty")}</h3>
            <p className="text-muted-foreground mb-4">{t("clients.emptyDescription")}</p>
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              {t("clients.add")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            data-testid="button-prev-page"
          >
            <ChevronLeft className="w-4 h-4" />
            {language === "fr" ? "Précédent" : "Previous"}
          </Button>
          <span className="text-sm text-muted-foreground px-3">
            {language === "fr" 
              ? `Page ${page + 1} de ${totalPages}`
              : `Page ${page + 1} of ${totalPages}`
            }
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            data-testid="button-next-page"
          >
            {language === "fr" ? "Suivant" : "Next"}
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingClient} onOpenChange={(open) => !open && setEditingClient(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("common.edit")} - {editingClient?.name}</DialogTitle>
          </DialogHeader>
          {editingClient && (
            <ClientForm
              client={editingClient}
              onSubmit={handleUpdate}
              onCancel={() => setEditingClient(null)}
              isLoading={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
      
      {/* Grant Portal Access Dialog */}
      {portalAccessClient && (
        <GrantPortalAccessDialog
          client={portalAccessClient}
          open={!!portalAccessClient}
          onOpenChange={(open) => !open && setPortalAccessClient(null)}
        />
      )}
      
      {/* Send HQ Procuration Dialog */}
      {hqProcurationClient && (
        <SendHqProcurationDialog
          client={hqProcurationClient}
          open={!!hqProcurationClient}
          onOpenChange={(open) => !open && setHqProcurationClient(null)}
        />
      )}
    </div>
  );
}
