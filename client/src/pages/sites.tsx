import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useParams } from "wouter";
import { Plus, Building2, MapPin, CheckCircle2, Clock, MoreHorizontal, Pencil, Trash2, BarChart3, ArrowLeft, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Client, Site } from "@shared/schema";

const siteFormSchema = z.object({
  name: z.string().min(1, "Ce champ est requis"),
  clientId: z.string().min(1, "Ce champ est requis"),
  address: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  notes: z.string().optional(),
});

type SiteFormValues = z.infer<typeof siteFormSchema>;

interface SiteWithClient extends Site {
  client: Client;
}

function SiteCard({ site, onEdit, onDelete }: { site: SiteWithClient; onEdit: () => void; onDelete: () => void }) {
  const { t } = useI18n();

  return (
    <Card className="hover-elevate">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3 min-w-0 flex-1">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold truncate">{site.name}</h3>
                {site.client ? (
                  <Link href={`/app/clients/${site.client.id}/sites`}>
                    <span 
                      className="text-sm text-muted-foreground hover:text-primary hover:underline cursor-pointer truncate block"
                      data-testid={`link-client-${site.client.id}`}
                    >
                      {site.client.name}
                    </span>
                  </Link>
                ) : (
                  <p className="text-sm text-muted-foreground truncate">—</p>
                )}
              </div>
            </div>

            {(site.address || site.city) && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {[site.address, site.city, site.province].filter(Boolean).join(", ")}
                </span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1 flex-wrap">
              {site.analysisAvailable ? (
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {t("sites.analysisReady")}
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <Clock className="w-3 h-3" />
                  {t("sites.pending")}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Link href={`/app/sites/${site.id}`}>
                <Button variant="outline" size="sm" className="gap-1.5" data-testid={`button-view-site-${site.id}`}>
                  <BarChart3 className="w-3.5 h-3.5" />
                  {t("common.view")}
                </Button>
              </Link>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" data-testid={`button-site-menu-${site.id}`}>
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
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

function SiteForm({ 
  site, 
  clients,
  onSubmit, 
  onCancel, 
  isLoading 
}: { 
  site?: Site; 
  clients: Client[];
  onSubmit: (data: SiteFormValues) => void; 
  onCancel: () => void; 
  isLoading: boolean;
}) {
  const { t } = useI18n();
  
  const form = useForm<SiteFormValues>({
    resolver: zodResolver(siteFormSchema),
    defaultValues: {
      name: site?.name || "",
      clientId: site?.clientId || "",
      address: site?.address || "",
      city: site?.city || "",
      province: site?.province || "QC",
      postalCode: site?.postalCode || "",
      notes: site?.notes || "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="clientId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("sites.client")} *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-site-client">
                    <SelectValue placeholder="Sélectionner un client..." />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("sites.name")} *</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Usine A – Montréal" {...field} data-testid="input-site-name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("sites.address")}</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-site-address" />
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
                  <Input {...field} data-testid="input-site-city" />
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
                  <Input {...field} data-testid="input-site-province" />
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
                <FormLabel>Code postal</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-site-postal" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea rows={3} className="resize-none" {...field} data-testid="textarea-site-notes" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={isLoading} data-testid="button-save-site">
            {isLoading ? t("common.loading") : t("common.save")}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default function SitesPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const params = useParams<{ clientId?: string }>();
  const clientId = params.clientId;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);

  // Fetch all sites
  const { data: allSites, isLoading } = useQuery<SiteWithClient[]>({
    queryKey: ["/api/sites"],
  });

  // Filter sites by clientId if provided
  const sites = clientId 
    ? allSites?.filter(site => site.clientId === clientId)
    : allSites;

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Get the current client if filtering
  const currentClient = clientId 
    ? clients?.find(c => c.id === clientId)
    : null;

  const createMutation = useMutation({
    mutationFn: async (data: SiteFormValues) => {
      return apiRequest("POST", "/api/sites", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      setDialogOpen(false);
      toast({ title: t("sites.siteCreated") });
    },
    onError: () => {
      toast({ title: t("sites.createError"), variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: SiteFormValues & { id: string }) => {
      const { id, ...rest } = data;
      return apiRequest("PATCH", `/api/sites/${id}`, rest);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      setEditingSite(null);
      toast({ title: t("sites.siteUpdated") });
    },
    onError: () => {
      toast({ title: t("sites.updateError"), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/sites/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      toast({ title: t("sites.siteDeleted") });
    },
    onError: () => {
      toast({ title: t("sites.deleteError"), variant: "destructive" });
    },
  });

  const handleCreate = (data: SiteFormValues) => {
    createMutation.mutate(data);
  };

  const handleUpdate = (data: SiteFormValues) => {
    if (editingSite) {
      updateMutation.mutate({ ...data, id: editingSite.id });
    }
  };

  // When creating a new site for a specific client, pre-select the client
  const handleCreateWithClient = (data: SiteFormValues) => {
    createMutation.mutate(clientId ? { ...data, clientId } : data);
  };

  return (
    <div className="space-y-6">
      {/* Back button and breadcrumb when viewing a specific client's sites */}
      {currentClient && (
        <div className="flex items-center gap-3">
          <Link href="/app/clients">
            <Button variant="ghost" size="icon" data-testid="button-back-clients">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>{currentClient.name}</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {currentClient 
              ? `${t("sites.title")} - ${currentClient.name}`
              : t("sites.title")
            }
          </h1>
          <p className="text-muted-foreground mt-1">
            {currentClient 
              ? `${sites?.length || 0} site(s) pour ce client`
              : "Gérez les sites et leurs données de consommation"
            }
          </p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" disabled={!clients || clients.length === 0} data-testid="button-add-site">
              <Plus className="w-4 h-4" />
              {t("sites.add")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("sites.add")}</DialogTitle>
            </DialogHeader>
            <SiteForm
              site={clientId ? { clientId } as Site : undefined}
              clients={clientId ? clients?.filter(c => c.id === clientId) || [] : clients || []}
              onSubmit={handleCreateWithClient}
              onCancel={() => setDialogOpen(false)}
              isLoading={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
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
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sites && sites.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sites.map((site) => (
            <SiteCard
              key={site.id}
              site={site}
              onEdit={() => setEditingSite(site)}
              onDelete={() => deleteMutation.mutate(site.id)}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <Building2 className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-1">{t("sites.empty")}</h3>
            <p className="text-muted-foreground mb-4">{t("sites.emptyDescription")}</p>
            {clients && clients.length > 0 ? (
              <Button onClick={() => setDialogOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                {t("sites.add")}
              </Button>
            ) : (
              <Link href="/app/clients">
                <Button variant="outline" className="gap-2">
                  <Plus className="w-4 h-4" />
                  {t("sites.createClientFirst")}
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingSite} onOpenChange={(open) => !open && setEditingSite(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("common.edit")} - {editingSite?.name}</DialogTitle>
          </DialogHeader>
          {editingSite && (
            <SiteForm
              site={editingSite}
              clients={clients || []}
              onSubmit={handleUpdate}
              onCancel={() => setEditingSite(null)}
              isLoading={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
