import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useParams } from "wouter";
import { Plus, Building2, MapPin, CheckCircle2, Clock, MoreHorizontal, Pencil, Trash2, BarChart3, ArrowLeft, Users, Search, ChevronLeft, ChevronRight, ChevronDown, Grid3X3, AlertTriangle, Archive, ArchiveRestore, Eye, EyeOff } from "lucide-react";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Client, Site } from "@shared/schema";

// Lightweight site type for list view
interface SiteListItem {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  analysisAvailable: boolean | null;
  roofAreaValidated: boolean | null;
  createdAt: string | null;
  clientId: string;
  clientName: string;
  hasSimulation: boolean;
  hasDesignAgreement: boolean;
  isArchived?: boolean;
}

interface SitesListResponse {
  sites: SiteListItem[];
  total: number;
}

const siteFormSchema = z.object({
  name: z.string().min(1, "Ce champ est requis"),
  clientId: z.string().min(1, "Ce champ est requis"),
  address: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  buildingType: z.string().optional(),
  roofType: z.string().optional(),
  roofAreaSqM: z.coerce.number().optional().or(z.literal("")),
  latitude: z.coerce.number().optional().or(z.literal("")),
  longitude: z.coerce.number().optional().or(z.literal("")),
  notes: z.string().optional(),
});

type SiteFormValues = z.infer<typeof siteFormSchema>;

function SiteCard({ site, onEdit, onDelete, onArchive }: { site: SiteListItem; onEdit: () => void; onDelete: () => void; onArchive: () => void }) {
  const { t, language } = useI18n();

  return (
    <Card className={`hover-elevate ${site.isArchived ? 'opacity-60' : ''}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3 min-w-0 flex-1">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold truncate">{site.name}</h3>
                  {site.isArchived && (
                    <Badge variant="secondary" className="text-xs">
                      <Archive className="w-3 h-3 mr-1" />
                      {language === "fr" ? "Archivé" : "Archived"}
                    </Badge>
                  )}
                </div>
                {site.clientName ? (
                  <Link 
                    href={`/app/clients/${site.clientId}/sites`}
                    className="text-sm text-muted-foreground hover:text-primary hover:underline cursor-pointer truncate block"
                    data-testid={`link-client-${site.clientId}`}
                  >
                    {site.clientName}
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
              {/* Roof validation status */}
              {site.roofAreaValidated ? (
                <Badge variant="default" className="gap-1" data-testid={`badge-roof-validated-${site.id}`}>
                  <Grid3X3 className="w-3 h-3" />
                  {t("sites.roofValidated")}
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1" data-testid={`badge-roof-pending-${site.id}`}>
                  <AlertTriangle className="w-3 h-3" />
                  {t("sites.roofPending")}
                </Badge>
              )}
              {/* Analysis status */}
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
              <DropdownMenuItem onClick={onArchive}>
                {site.isArchived ? (
                  <>
                    <ArchiveRestore className="w-4 h-4 mr-2" />
                    {language === "fr" ? "Désarchiver" : "Unarchive"}
                  </>
                ) : (
                  <>
                    <Archive className="w-4 h-4 mr-2" />
                    {language === "fr" ? "Archiver" : "Archive"}
                  </>
                )}
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

type SiteFormInput = {
  id?: string;
  clientId?: string;
  name?: string;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  buildingType?: string | null;
  roofType?: string | null;
  roofAreaSqM?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
};

function SiteForm({ 
  site, 
  clients,
  onSubmit, 
  onCancel, 
  isLoading 
}: { 
  site?: SiteFormInput; 
  clients: Client[];
  onSubmit: (data: SiteFormValues) => void; 
  onCancel: () => void; 
  isLoading: boolean;
}) {
  const { t, language } = useI18n();
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  
  const form = useForm<SiteFormValues>({
    resolver: zodResolver(siteFormSchema),
    defaultValues: {
      name: site?.name || "",
      clientId: site?.clientId || "",
      address: site?.address || "",
      city: site?.city || "",
      province: site?.province || (language === "fr" ? "Québec" : "Quebec"),
      postalCode: site?.postalCode || "",
      buildingType: site?.buildingType || "",
      roofType: site?.roofType || "",
      roofAreaSqM: site?.roofAreaSqM ?? "",
      latitude: site?.latitude ?? "",
      longitude: site?.longitude ?? "",
      notes: site?.notes || "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Primary Fields */}
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
          name="clientId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("sites.client")} *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-site-client">
                    <SelectValue placeholder={language === "fr" ? "Sélectionner un client..." : "Select a client..."} />
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
                <FormLabel>{t("form.postalCode")}</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-site-postal" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Secondary Fields - Collapsible Section */}
        <Collapsible open={moreOptionsOpen} onOpenChange={setMoreOptionsOpen} className="border rounded-lg">
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="w-full flex items-center justify-between px-4 py-3 h-auto"
              data-testid="button-more-options"
            >
              <span className="font-medium">{t("sites.moreOptions")}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${moreOptionsOpen ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="px-4 pb-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="buildingType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("form.buildingType")}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-site-building-type">
                          <SelectValue placeholder={language === "fr" ? "Sélectionner..." : "Select..."} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="industrial">{t("form.buildingType.industrial")}</SelectItem>
                        <SelectItem value="commercial">{t("form.buildingType.commercial")}</SelectItem>
                        <SelectItem value="institutional">{t("form.buildingType.institutional")}</SelectItem>
                        <SelectItem value="other">{t("form.buildingType.other")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="roofType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("sites.roofType")}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-site-roof-type">
                          <SelectValue placeholder={language === "fr" ? "Sélectionner..." : "Select..."} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="flat">{t("sites.roofType.flat")}</SelectItem>
                        <SelectItem value="inclined">{t("sites.roofType.inclined")}</SelectItem>
                        <SelectItem value="other">{t("sites.roofType.other")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="roofAreaSqM"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("sites.roofArea")}</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="Ex: 5000" 
                      {...field} 
                      value={field.value === "" ? "" : field.value}
                      data-testid="input-site-roof-area" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel className="text-sm font-medium">{t("sites.gpsCoordinates")}</FormLabel>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="latitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">{t("sites.latitude")}</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="any"
                          placeholder="Ex: 45.5017" 
                          {...field}
                          value={field.value === "" ? "" : field.value}
                          data-testid="input-site-latitude" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="longitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">{t("sites.longitude")}</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="any"
                          placeholder="Ex: -73.5673" 
                          {...field}
                          value={field.value === "" ? "" : field.value}
                          data-testid="input-site-longitude" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("form.notes")}</FormLabel>
                  <FormControl>
                    <Textarea rows={3} className="resize-none" {...field} data-testid="textarea-site-notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CollapsibleContent>
        </Collapsible>

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

const ITEMS_PER_PAGE = 24;

export default function SitesPage() {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const params = useParams<{ clientId?: string }>();
  const clientId = params.clientId;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<SiteListItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [showArchived, setShowArchived] = useState(false);

  // Debounce search input
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setPage(0); // Reset to first page on search
    // Debounce the actual API call
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
    if (clientId) params.set("clientId", clientId);
    if (showArchived) params.set("includeArchived", "true");
    return params.toString();
  }, [page, debouncedSearch, clientId, showArchived]);

  // Fetch sites with optimized endpoint using apiRequest (handles auth properly)
  const { data: sitesData, isLoading, error, isError } = useQuery<SitesListResponse>({
    queryKey: ["/api/sites/list", queryParams],
    queryFn: async () => {
      return await apiRequest<SitesListResponse>("GET", `/api/sites/list?${queryParams}`);
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  const sites = sitesData?.sites ?? [];
  const totalSites = sitesData?.total ?? 0;
  const totalPages = Math.ceil(totalSites / ITEMS_PER_PAGE);

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
      queryClient.invalidateQueries({ queryKey: ["/api/sites/list"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/sites/list"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/sites/list"] });
      toast({ title: t("sites.siteDeleted") });
    },
    onError: (error: Error) => {
      // Parse error message from apiRequest format: "status: {json}"
      let errorMessage = t("sites.deleteError");
      try {
        const match = error.message?.match(/^\d+:\s*(.+)$/);
        if (match) {
          const parsed = JSON.parse(match[1]);
          errorMessage = parsed.error || errorMessage;
        }
      } catch {
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

  const archiveMutation = useMutation({
    mutationFn: async ({ id, isArchived }: { id: string; isArchived: boolean }) => {
      const endpoint = isArchived ? `/api/sites/${id}/unarchive` : `/api/sites/${id}/archive`;
      return apiRequest("POST", endpoint);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites/list"] });
      const message = variables.isArchived
        ? (language === "fr" ? "Site désarchivé" : "Site unarchived")
        : (language === "fr" ? "Site archivé" : "Site archived");
      toast({ title: message });
    },
    onError: () => {
      toast({ 
        title: language === "fr" ? "Erreur" : "Error",
        variant: "destructive" 
      });
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
              ? `${totalSites} site(s) pour ce client`
              : language === "fr" 
                ? `${totalSites} site(s) au total`
                : `${totalSites} site(s) total`
            }
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
              data-testid="input-search-sites"
            />
          </div>
          
          <Button
            variant={showArchived ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setShowArchived(!showArchived);
              setPage(0); // Reset to first page on filter change
            }}
            className="gap-2"
            data-testid="button-toggle-archived-sites"
          >
            {showArchived ? (
              <>
                <Eye className="w-4 h-4" />
                {language === "fr" ? "Archivés visibles" : "Showing archived"}
              </>
            ) : (
              <>
                <EyeOff className="w-4 h-4" />
                {language === "fr" ? "Afficher archivés" : "Show archived"}
              </>
            )}
          </Button>
          
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
      </div>

      {isError ? (
        <Card className="p-6">
          <div className="text-center space-y-4">
            <Building2 className="w-12 h-12 mx-auto text-destructive" />
            <h3 className="font-semibold text-lg text-destructive">
              {language === "fr" ? "Erreur de chargement" : "Loading Error"}
            </h3>
            <p className="text-muted-foreground">
              {error?.message || (language === "fr" ? "Impossible de charger les sites" : "Failed to load sites")}
            </p>
          </div>
        </Card>
      ) : isLoading ? (
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
              onArchive={() => archiveMutation.mutate({ id: site.id, isArchived: !!site.isArchived })}
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
