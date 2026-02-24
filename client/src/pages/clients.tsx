import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { Plus, Users, Mail, Phone, MapPin, Building2, MoreHorizontal, Pencil, Trash2, KeyRound, Send, Loader2, ChevronDown, ChevronLeft, ChevronRight, FileSignature, X, ArrowUpDown, LayoutGrid, List, Eye } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
import { GrantPortalAccessDialog, type ClientWithSites } from "@/components/grant-portal-access-dialog";

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
  accountManagerEmail: z.string().email("Courriel invalide").optional().or(z.literal("")),
});

type ClientFormValues = z.infer<typeof clientFormSchema>;

interface ClientsListResponse {
  clients: ClientWithSites[];
  total: number;
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

function ClientCard({ client, onEdit, onDelete, onGrantAccess, onSendHqProcuration, isSelected, onToggleSelect }: { client: ClientWithSites; onEdit: () => void; onDelete: () => void; onGrantAccess: () => void; onSendHqProcuration: () => void; isSelected?: boolean; onToggleSelect?: (id: string) => void }) {
  const { t, language } = useI18n();

  return (
    <Card className={`hover-elevate ${isSelected ? 'ring-2 ring-primary' : ''}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3 min-w-0 flex-1">
            <div className="flex items-start gap-3">
              {onToggleSelect && (
                <div className="pt-2.5 shrink-0">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleSelect(client.id)}
                    data-testid={`checkbox-client-${client.id}`}
                  />
                </div>
              )}
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
                  {client.siteCount ?? client.sites?.length ?? 0} {t("clients.sites").toLowerCase()}
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
              <DropdownMenuItem asChild>
                <a href={`/app/clients/${client.id}/portal-preview`} target="_blank" rel="noopener noreferrer">
                  <Eye className="w-4 h-4 mr-2" />
                  {language === "fr" ? "Voir comme client" : "View as client"}
                </a>
              </DropdownMenuItem>
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
      accountManagerEmail: client?.accountManagerEmail || "info@kwh.quebec",
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

        <FormField
          control={form.control}
          name="accountManagerEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{language === "fr" ? "Responsable du compte" : "Account Manager"}</FormLabel>
              <FormControl>
                <Input type="email" {...field} placeholder="info@kwh.quebec" data-testid="input-client-account-manager" />
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
  const [page, setPage] = useState(0);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [cascadeDeleteClient, setCascadeDeleteClient] = useState<ClientWithSites | null>(null);
  const [sortBy, setSortBy] = useState("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    return (localStorage.getItem("clients-view-mode") as "grid" | "list") || "grid";
  });

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", String(ITEMS_PER_PAGE));
    params.set("offset", String(page * ITEMS_PER_PAGE));
    if (sortBy !== "newest") params.set("sortBy", sortBy);
    return params.toString();
  }, [page, sortBy]);

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

  const cascadeDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/clients/${id}/cascade`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/clients/list"], refetchType: 'all' });
      toast({ title: language === "fr" ? "Client supprime avec succes" : "Client deleted successfully" });
      setCascadeDeleteClient(null);
    },
    onError: (error: Error) => {
      let errorMessage = language === "fr" ? "Erreur lors de la suppression" : "Error deleting client";
      try {
        const match = error.message?.match(/^\d+:\s*(.+)$/);
        if (match) {
          const parsed = JSON.parse(match[1]);
          errorMessage = parsed.error || errorMessage;
        }
      } catch {
        if (error.message) errorMessage = error.message.replace(/^\d+:\s*/, '');
      }
      toast({ title: errorMessage, variant: "destructive" });
    },
  });

  const { data: cascadeCounts } = useQuery<{ clientName: string; sites: number; simulations: number; portalUsers: number; portfolios: number; opportunities: number; designAgreements: number; siteVisits: number }>({
    queryKey: ['/api/clients', cascadeDeleteClient?.id, 'cascade-counts'],
    queryFn: async () => {
      return await apiRequest("GET", `/api/clients/${cascadeDeleteClient!.id}/cascade-counts`);
    },
    enabled: !!cascadeDeleteClient,
  });

  const toggleClientSelection = (id: string) => {
    setSelectedClients(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedClients.size === clients.length) {
      setSelectedClients(new Set());
    } else {
      setSelectedClients(new Set(clients.map(c => c.id)));
    }
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all(
        Array.from(selectedClients).map(id =>
          apiRequest("DELETE", `/api/clients/${id}/cascade`)
        )
      );
      queryClient.invalidateQueries({ queryKey: ["/api/clients/list"] });
      toast({
        title: language === "fr" ? "Clients supprimes" : "Clients deleted",
        description: language === "fr"
          ? `${selectedClients.size} client(s) et toutes les donnees associees ont ete supprimes.`
          : `${selectedClients.size} client(s) and all associated data deleted successfully.`,
      });
      setSelectedClients(new Set());
      setIsBulkDeleteDialogOpen(false);
    } catch {
      toast({
        title: language === "fr" ? "Erreur" : "Error",
        description: language === "fr"
          ? "Certains clients n'ont pas pu etre supprimes."
          : "Some clients could not be deleted.",
        variant: "destructive",
      });
      setIsBulkDeleteDialogOpen(false);
    }
  };

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
          {clients.length > 0 && (
            <div className="flex items-center gap-2 mr-2">
              <Checkbox
                checked={selectedClients.size > 0 && selectedClients.size === clients.length}
                onCheckedChange={toggleSelectAll}
                data-testid="checkbox-select-all-clients"
              />
              <span className="text-sm text-muted-foreground">
                {language === "fr" ? "Tout" : "All"}
              </span>
            </div>
          )}
          <Select value={sortBy} onValueChange={(val) => { setSortBy(val); setPage(0); }}>
            <SelectTrigger className="w-[180px]" data-testid="select-sort-clients">
              <ArrowUpDown className="w-4 h-4 mr-2 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest" data-testid="sort-option-newest">
                {language === "fr" ? "Plus récents" : "Newest"}
              </SelectItem>
              <SelectItem value="modified" data-testid="sort-option-modified">
                {language === "fr" ? "Date d'ajout" : "Date added"}
              </SelectItem>
              <SelectItem value="name_asc" data-testid="sort-option-name-asc">
                {language === "fr" ? "Nom (A-Z)" : "Name (A-Z)"}
              </SelectItem>
              <SelectItem value="name_desc" data-testid="sort-option-name-desc">
                {language === "fr" ? "Nom (Z-A)" : "Name (Z-A)"}
              </SelectItem>
            </SelectContent>
          </Select>
          <div className="flex border rounded-md">
            <Button
              variant="ghost"
              size="icon"
              className={`rounded-r-none ${viewMode === "grid" ? "bg-muted" : ""}`}
              onClick={() => { setViewMode("grid"); localStorage.setItem("clients-view-mode", "grid"); }}
              data-testid="button-view-grid-clients"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={`rounded-l-none ${viewMode === "list" ? "bg-muted" : ""}`}
              onClick={() => { setViewMode("list"); localStorage.setItem("clients-view-mode", "list"); }}
              data-testid="button-view-list-clients"
            >
              <List className="w-4 h-4" />
            </Button>
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
        viewMode === "grid" ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                onEdit={() => setEditingClient(client)}
                onDelete={() => setCascadeDeleteClient(client)}
                onGrantAccess={() => setPortalAccessClient(client)}
                onSendHqProcuration={() => setHqProcurationClient(client)}
                isSelected={selectedClients.has(client.id)}
                onToggleSelect={toggleClientSelection}
              />
            ))}
          </div>
        ) : (
          <Card>
            <div className="divide-y">
              {clients.map((client) => (
                <div key={client.id} className={`flex items-center gap-3 px-4 py-3 hover-elevate ${selectedClients.has(client.id) ? 'bg-primary/5' : ''}`} data-testid={`row-client-${client.id}`}>
                  {toggleClientSelection && (
                    <Checkbox
                      checked={selectedClients.has(client.id)}
                      onCheckedChange={() => toggleClientSelection(client.id)}
                      data-testid={`checkbox-client-list-${client.id}`}
                    />
                  )}
                  <Users className="w-4 h-4 text-primary shrink-0" />
                  <Link href={`/app/clients/${client.id}/sites`} className="font-medium hover:text-primary hover:underline min-w-0 shrink-0 max-w-[280px] truncate" data-testid={`link-client-list-${client.id}`}>
                    {client.name}
                  </Link>
                  {client.mainContactName && (
                    <span className="text-sm text-muted-foreground truncate min-w-0 hidden sm:inline">
                      {client.mainContactName}
                    </span>
                  )}
                  {client.email && (
                    <span className="text-sm text-muted-foreground truncate min-w-0 hidden md:inline">
                      <Mail className="w-3 h-3 inline mr-1" />{client.email}
                    </span>
                  )}
                  {client.phone && (
                    <span className="text-sm text-muted-foreground truncate min-w-0 hidden lg:inline">
                      <Phone className="w-3 h-3 inline mr-1" />{client.phone}
                    </span>
                  )}
                  <div className="flex items-center gap-1.5 ml-auto shrink-0">
                    <Link href={`/app/clients/${client.id}/sites`}>
                      <Button variant="outline" size="sm" className="gap-1 text-xs" data-testid={`button-sites-list-${client.id}`}>
                        <Building2 className="w-3 h-3" />
                        {client.siteCount ?? client.sites?.length ?? 0}
                      </Button>
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-client-menu-list-${client.id}`}>
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <a href={`/app/clients/${client.id}/portal-preview`} target="_blank" rel="noopener noreferrer">
                            <Eye className="w-4 h-4 mr-2" />
                            {language === "fr" ? "Voir comme client" : "View as client"}
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setPortalAccessClient(client)}>
                          <KeyRound className="w-4 h-4 mr-2" />
                          {t("clients.grantPortalAccess")}
                        </DropdownMenuItem>
                        {client.email && (
                          <DropdownMenuItem onClick={() => setHqProcurationClient(client)}>
                            <FileSignature className="w-4 h-4 mr-2" />
                            {t("clients.sendHqProcuration")}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => setEditingClient(client)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          {t("common.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setCascadeDeleteClient(client)} className="text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" />
                          {t("common.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )
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

      {selectedClients.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border shadow-lg rounded-lg px-4 py-3 flex items-center gap-3" data-testid="bulk-action-bar-clients">
          <span className="text-sm font-medium" data-testid="text-selected-clients-count">
            {selectedClients.size} {language === "fr" ? "sélectionné(s)" : "selected"}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-destructive"
            onClick={() => setIsBulkDeleteDialogOpen(true)}
            data-testid="button-bulk-delete-clients"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {language === "fr" ? "Supprimer" : "Delete"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedClients(new Set())}
            data-testid="button-clear-client-selection"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === "fr" ? "Supprimer les clients sélectionnés" : "Delete Selected Clients"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === "fr"
                ? `Êtes-vous sûr de vouloir supprimer ${selectedClients.size} client(s) ? Cette action est irréversible.`
                : `Are you sure you want to delete ${selectedClients.size} client(s)? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-bulk-delete-clients">
              {language === "fr" ? "Annuler" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleBulkDelete}
              data-testid="button-confirm-bulk-delete-clients"
            >
              {language === "fr" ? "Confirmer la suppression" : "Confirm Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!cascadeDeleteClient} onOpenChange={(open) => { if (!open) setCascadeDeleteClient(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === "fr" ? "Supprimer le client" : "Delete Client"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  {language === "fr"
                    ? `Etes-vous sur de vouloir supprimer "${cascadeDeleteClient?.name}" et toutes les donnees associees ?`
                    : `Are you sure you want to delete "${cascadeDeleteClient?.name}" and all associated data?`}
                </p>
                {cascadeCounts && (
                  <div className="rounded-lg border p-3 space-y-1 text-sm" data-testid="cascade-delete-counts">
                    {cascadeCounts.sites > 0 && (
                      <p>Sites: <strong>{cascadeCounts.sites}</strong></p>
                    )}
                    {cascadeCounts.simulations > 0 && (
                      <p>{language === "fr" ? "Analyses" : "Analyses"}: <strong>{cascadeCounts.simulations}</strong></p>
                    )}
                    {cascadeCounts.portalUsers > 0 && (
                      <p>{language === "fr" ? "Utilisateurs portail" : "Portal users"}: <strong>{cascadeCounts.portalUsers}</strong></p>
                    )}
                    {cascadeCounts.portfolios > 0 && (
                      <p>Portfolios: <strong>{cascadeCounts.portfolios}</strong></p>
                    )}
                    {cascadeCounts.opportunities > 0 && (
                      <p>{language === "fr" ? "Opportunites" : "Opportunities"}: <strong>{cascadeCounts.opportunities}</strong></p>
                    )}
                    {cascadeCounts.designAgreements > 0 && (
                      <p>{language === "fr" ? "Mandats de conception" : "Design agreements"}: <strong>{cascadeCounts.designAgreements}</strong></p>
                    )}
                    {cascadeCounts.siteVisits > 0 && (
                      <p>{language === "fr" ? "Visites de site" : "Site visits"}: <strong>{cascadeCounts.siteVisits}</strong></p>
                    )}
                  </div>
                )}
                <p className="font-medium text-destructive">
                  {language === "fr"
                    ? "Cette action est irreversible."
                    : "This action cannot be undone."}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-cascade-delete">
              {language === "fr" ? "Annuler" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => cascadeDeleteClient && cascadeDeleteMutation.mutate(cascadeDeleteClient.id)}
              disabled={cascadeDeleteMutation.isPending}
              data-testid="button-confirm-cascade-delete"
            >
              {cascadeDeleteMutation.isPending
                ? (language === "fr" ? "Suppression..." : "Deleting...")
                : (language === "fr" ? "Supprimer definitivement" : "Delete permanently")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
