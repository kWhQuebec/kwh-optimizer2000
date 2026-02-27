import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useParams } from "wouter";
import { Plus, Building2, MapPin, CheckCircle2, Clock, MoreHorizontal, Pencil, Trash2, BarChart3, ArrowLeft, Users, ChevronLeft, ChevronRight, ChevronDown, Grid3X3, AlertTriangle, Archive, ArchiveRestore, Eye, EyeOff, FileSignature, Download, Calendar, FileText, FolderOpen, X, ArrowUpDown, LayoutGrid, List, Mail, Phone, Globe, User, Settings2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Client, Site, ProcurationSignature } from "@shared/schema";
import { getBuildingTypesByCategory } from "@shared/buildingTypes";

// Helper function to download files with authentication
async function downloadWithAuth(url: string, filename: string): Promise<void> {
  const token = localStorage.getItem("token");
  const response = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    throw new Error(`Download failed: ${response.statusText}`);
  }
  
  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
}

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

function StreetViewThumbnail({ address, city, siteId }: { address?: string | null; city?: string | null; siteId: string }) {
  const [imgError, setImgError] = useState(false);
  const fullAddress = [address, city, "QC, Canada"].filter(Boolean).join(", ");
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const hasLocation = !!(address || city);

  if (!hasLocation || !apiKey || imgError) {
    return (
      <div className="w-full h-36 bg-muted/50 flex items-center justify-center">
        <Building2 className="w-10 h-10 text-muted-foreground/30" />
      </div>
    );
  }

  return (
    <img
      src={`https://maps.googleapis.com/maps/api/streetview?size=600x300&location=${encodeURIComponent(fullAddress)}&key=${apiKey}`}
      alt={fullAddress}
      className="w-full h-36 object-cover"
      onError={() => setImgError(true)}
      loading="lazy"
      data-testid={`img-streetview-thumbnail-${siteId}`}
    />
  );
}

function SiteCard({ site, onEdit, onDelete, onArchive, isSelected, onToggleSelect }: { site: SiteListItem; onEdit: () => void; onDelete: () => void; onArchive: () => void; isSelected?: boolean; onToggleSelect?: (id: string) => void }) {
  const { t, language } = useI18n();

  return (
    <Card className={`overflow-hidden ${site.isArchived ? 'opacity-60' : ''} ${isSelected ? 'ring-2 ring-primary' : ''}`}>
      <StreetViewThumbnail address={site.address} city={site.city} siteId={site.id} />
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3 min-w-0 flex-1">
            <div className="flex items-start gap-3">
              {onToggleSelect && (
                <div className="pt-2.5 shrink-0">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleSelect(site.id)}
                    data-testid={`checkbox-site-${site.id}`}
                  />
                </div>
              )}
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
                  {[site.address, site.city].filter(Boolean).join(", ")}
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

  // Reset form when site changes (for editing different sites)
  useEffect(() => {
    if (site) {
      form.reset({
        name: site.name || "",
        clientId: site.clientId || "",
        address: site.address || "",
        city: site.city || "",
        province: site.province || (language === "fr" ? "Québec" : "Quebec"),
        postalCode: site.postalCode || "",
        buildingType: site.buildingType || "",
        roofType: site.roofType || "",
        roofAreaSqM: site.roofAreaSqM ?? "",
        latitude: site.latitude ?? "",
        longitude: site.longitude ?? "",
        notes: site.notes || "",
      });
    }
  }, [site?.id, form, language]);

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
                        {getBuildingTypesByCategory().map((group) => (
                          <SelectGroup key={group.category}>
                            <SelectLabel>{language === "fr" ? group.labelFr : group.labelEn}</SelectLabel>
                            {group.types.map((bt) => (
                              <SelectItem key={bt.key} value={bt.key} data-testid={`select-site-building-type-${bt.key}`}>
                                {language === "fr" ? bt.labelFr : bt.labelEn}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
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
  const [page, setPage] = useState(0);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedSites, setSelectedSites] = useState<Set<string>>(new Set());
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [sortBy, setSortBy] = useState("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    return (localStorage.getItem("sites-view-mode") as "grid" | "list") || "grid";
  });

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", String(ITEMS_PER_PAGE));
    params.set("offset", String(page * ITEMS_PER_PAGE));
    if (clientId) params.set("clientId", clientId);
    if (showArchived) params.set("includeArchived", "true");
    if (sortBy !== "newest") params.set("sortBy", sortBy);
    return params.toString();
  }, [page, clientId, showArchived, sortBy]);

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

  const { data: clientsData } = useQuery<{ clients: Client[]; total: number }>({
    queryKey: ["/api/clients"],
  });
  const clients = clientsData?.clients;

  // Get the current client if filtering
  const currentClient = clientId 
    ? clients?.find(c => c.id === clientId)
    : null;

  // Fetch all documents (HQ bills + procurations) for the current client
  type DocumentItem = {
    id: string;
    type: 'hq_bill' | 'procuration';
    name: string;
    downloadPath: string;
    uploadedAt: string | null;
    metadata?: Record<string, string>;
  };
  const { data: documents } = useQuery<DocumentItem[]>({
    queryKey: [`/api/clients/${clientId}/documents`],
    enabled: !!clientId,
  });

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

  const toggleSiteSelection = (id: string) => {
    setSelectedSites(prev => {
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
    if (selectedSites.size === sites.length) {
      setSelectedSites(new Set());
    } else {
      setSelectedSites(new Set(sites.map(s => s.id)));
    }
  };

  const handleBulkArchive = async () => {
    const promises = Array.from(selectedSites).map(siteId => {
      const site = sites.find(s => s.id === siteId);
      const endpoint = site?.isArchived ? `/api/sites/${siteId}/unarchive` : `/api/sites/${siteId}/archive`;
      return apiRequest("POST", endpoint);
    });
    try {
      await Promise.all(promises);
      queryClient.invalidateQueries({ queryKey: ["/api/sites/list"] });
      toast({ title: language === "fr" ? `${selectedSites.size} site(s) archive(s)` : `${selectedSites.size} site(s) archived` });
      setSelectedSites(new Set());
    } catch {
      toast({ title: language === "fr" ? "Erreur" : "Error", variant: "destructive" });
    }
  };

  const handleBulkDelete = async () => {
    const promises = Array.from(selectedSites).map(siteId => 
      apiRequest("DELETE", `/api/sites/${siteId}`)
    );
    try {
      await Promise.all(promises);
      queryClient.invalidateQueries({ queryKey: ["/api/sites/list"] });
      toast({ title: language === "fr" ? `${selectedSites.size} site(s) supprime(s)` : `${selectedSites.size} site(s) deleted` });
      setSelectedSites(new Set());
      setIsBulkDeleteDialogOpen(false);
    } catch {
      toast({ title: language === "fr" ? "Erreur lors de la suppression" : "Error during deletion", variant: "destructive" });
      setIsBulkDeleteDialogOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      {currentClient && (
        <div className="space-y-4">
          <Link href="/app/clients" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" data-testid="link-back-clients">
            <ArrowLeft className="w-3.5 h-3.5" />
            {language === "fr" ? "Clients" : "Clients"}
          </Link>
          <Card>
            <CardContent className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-3 min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <h1 className="text-xl font-bold tracking-tight truncate" data-testid="text-client-name">
                      {currentClient.name}
                    </h1>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                    {currentClient.mainContactName && (
                      <span className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 shrink-0" />
                        {currentClient.mainContactName}
                      </span>
                    )}
                    {currentClient.email && (
                      <a href={`mailto:${currentClient.email}`} className="flex items-center gap-1.5 hover:text-foreground" data-testid="link-client-email">
                        <Mail className="w-3.5 h-3.5 shrink-0" />
                        {currentClient.email}
                      </a>
                    )}
                    {currentClient.phone && (
                      <a href={`tel:${currentClient.phone}`} className="flex items-center gap-1.5 hover:text-foreground" data-testid="link-client-phone">
                        <Phone className="w-3.5 h-3.5 shrink-0" />
                        {currentClient.phone}
                      </a>
                    )}
                    {currentClient.website && (
                      <a href={currentClient.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-foreground" data-testid="link-client-website">
                        <Globe className="w-3.5 h-3.5 shrink-0" />
                        {currentClient.website}
                      </a>
                    )}
                    {(currentClient.address || currentClient.city) && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        {[currentClient.address, currentClient.city, currentClient.province, currentClient.postalCode].filter(Boolean).join(", ")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-center px-3 py-1.5 rounded-lg bg-muted/50" data-testid="stat-total-sites">
                    <p className="text-lg font-bold">{totalSites}</p>
                    <p className="text-xs text-muted-foreground">{language === "fr" ? "Sites" : "Sites"}</p>
                  </div>
                  <div className="text-center px-3 py-1.5 rounded-lg bg-muted/50" data-testid="stat-roof-validated">
                    <p className="text-lg font-bold">{sites.filter(s => s.roofAreaValidated).length}</p>
                    <p className="text-xs text-muted-foreground">{language === "fr" ? "Toits" : "Roofs"}</p>
                  </div>
                  <div className="text-center px-3 py-1.5 rounded-lg bg-muted/50" data-testid="stat-analysis-ready">
                    <p className="text-lg font-bold">{sites.filter(s => s.analysisAvailable).length}</p>
                    <p className="text-xs text-muted-foreground">{language === "fr" ? "Analyses" : "Analyses"}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {currentClient && documents && documents.length > 0 && (() => {
        const hqBills = documents.filter(d => d.type === 'hq_bill');
        const procurations = documents.filter(d => d.type === 'procuration');
        return (
          <Card>
            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger asChild>
                <CardContent className="p-4 cursor-pointer hover-elevate flex items-center justify-between gap-2" data-testid="button-toggle-documents">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FolderOpen className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">Documents</h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {hqBills.length > 0 && (
                          <span>{hqBills.length} {language === "fr" ? "facture(s) HQ" : "HQ bill(s)"}</span>
                        )}
                        {hqBills.length > 0 && procurations.length > 0 && <span>·</span>}
                        {procurations.length > 0 && (
                          <span>{procurations.length} {language === "fr" ? "procuration(s)" : "authorization(s)"}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                </CardContent>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 pb-4 space-y-3">
                  {hqBills.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
                        {language === "fr" ? "Factures Hydro-Québec" : "Hydro-Québec Bills"}
                      </p>
                      <div className="space-y-1">
                        {hqBills.map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between py-2 px-3 rounded-md border text-sm" data-testid={`row-doc-${doc.id}`}>
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span className="font-medium truncate">{doc.name}</span>
                              {doc.metadata?.hqAccountNumber && (
                                <span className="text-xs text-muted-foreground hidden sm:inline">#{doc.metadata.hqAccountNumber}</span>
                              )}
                              {doc.uploadedAt && (
                                <span className="text-xs text-muted-foreground hidden md:inline">
                                  {new Date(doc.uploadedAt).toLocaleDateString(language === "fr" ? "fr-CA" : "en-CA")}
                                </span>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={language === "fr" ? "Télécharger le document" : "Download document"}
                              onClick={async () => {
                                try {
                                  await downloadWithAuth(`/api/hq-bills/download?path=${encodeURIComponent(doc.downloadPath)}`, doc.name);
                                } catch (error) { console.error('Download failed:', error); }
                              }}
                              data-testid={`button-download-doc-${doc.id}`}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {procurations.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
                        {language === "fr" ? "Procurations" : "Authorizations"}
                      </p>
                      <div className="space-y-1">
                        {procurations.map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between py-2 px-3 rounded-md border text-sm" data-testid={`row-doc-${doc.id}`}>
                            <div className="flex items-center gap-2 min-w-0">
                              <FileSignature className="w-3.5 h-3.5 text-green-600 shrink-0" />
                              <span className="font-medium truncate">{doc.name}</span>
                              {doc.metadata?.hqAccountNumber && (
                                <span className="text-xs text-muted-foreground hidden sm:inline">#{doc.metadata.hqAccountNumber}</span>
                              )}
                              {doc.uploadedAt && (
                                <span className="text-xs text-muted-foreground hidden md:inline">
                                  {new Date(doc.uploadedAt).toLocaleDateString(language === "fr" ? "fr-CA" : "en-CA")}
                                </span>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={language === "fr" ? "Télécharger le document" : "Download document"}
                              onClick={async () => {
                                try {
                                  const filename = `${doc.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
                                  await downloadWithAuth(doc.downloadPath, filename);
                                } catch (error) { console.error('Download failed:', error); }
                              }}
                              data-testid={`button-download-doc-${doc.id}`}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })()}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className={`font-bold tracking-tight ${currentClient ? 'text-xl' : 'text-3xl'}`}>
            {currentClient ? t("sites.title") : t("sites.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {currentClient 
              ? `${totalSites} site(s)`
              : language === "fr" 
                ? `${totalSites} site(s) au total`
                : `${totalSites} site(s) total`
            }
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={sortBy} onValueChange={(val) => { setSortBy(val); setPage(0); }}>
            <SelectTrigger className="w-[150px]" data-testid="select-sort-sites">
              <ArrowUpDown className="w-3.5 h-3.5 mr-1.5 shrink-0" />
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" data-testid="button-sites-options">
                <Settings2 className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={toggleSelectAll} data-testid="menu-select-all">
                <Checkbox
                  checked={selectedSites.size > 0 && selectedSites.size === sites.length}
                  className="mr-2 pointer-events-none"
                  tabIndex={-1}
                  data-testid="checkbox-select-all-sites"
                />
                {language === "fr" ? "Tout sélectionner" : "Select all"}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => { setShowArchived(!showArchived); setPage(0); }}
                data-testid="menu-toggle-archived"
              >
                {showArchived ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
                {showArchived 
                  ? (language === "fr" ? "Masquer archivés" : "Hide archived")
                  : (language === "fr" ? "Voir archivés" : "Show archived")
                }
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => { 
                  const next = viewMode === "grid" ? "list" : "grid";
                  setViewMode(next);
                  localStorage.setItem("sites-view-mode", next);
                }}
                data-testid="menu-toggle-view"
              >
                {viewMode === "grid" ? <List className="w-4 h-4 mr-2" /> : <LayoutGrid className="w-4 h-4 mr-2" />}
                {viewMode === "grid"
                  ? (language === "fr" ? "Vue liste" : "List view")
                  : (language === "fr" ? "Vue grille" : "Grid view")
                }
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

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
        viewMode === "grid" ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sites.map((site) => (
              <SiteCard
                key={site.id}
                site={site}
                onEdit={() => setEditingSite(site)}
                onDelete={() => deleteMutation.mutate(site.id)}
                onArchive={() => archiveMutation.mutate({ id: site.id, isArchived: !!site.isArchived })}
                isSelected={selectedSites.has(site.id)}
                onToggleSelect={toggleSiteSelection}
              />
            ))}
          </div>
        ) : (
          <Card>
            <div className="divide-y">
              {sites.map((site) => (
                <div key={site.id} className={`flex items-center gap-3 px-4 py-3 hover-elevate ${site.isArchived ? 'opacity-60' : ''} ${selectedSites.has(site.id) ? 'bg-primary/5' : ''}`} data-testid={`row-site-${site.id}`}>
                  {toggleSiteSelection && (
                    <Checkbox
                      checked={selectedSites.has(site.id)}
                      onCheckedChange={() => toggleSiteSelection(site.id)}
                      data-testid={`checkbox-site-list-${site.id}`}
                    />
                  )}
                  <Building2 className="w-4 h-4 text-primary shrink-0" />
                  <Link href={`/app/sites/${site.id}`} className="font-medium hover:text-primary hover:underline min-w-0 shrink-0 max-w-[280px] truncate" data-testid={`link-site-list-${site.id}`}>
                    {site.name}
                  </Link>
                  <span className="text-sm text-muted-foreground truncate min-w-0 hidden sm:inline">
                    {site.clientName}
                  </span>
                  <span className="text-sm text-muted-foreground truncate min-w-0 hidden md:inline">
                    {[site.address, site.city].filter(Boolean).join(", ") || "—"}
                  </span>
                  <div className="flex items-center gap-1.5 ml-auto shrink-0">
                    {site.roofAreaValidated ? (
                      <Badge variant="default" className="gap-1 text-xs">
                        <Grid3X3 className="w-3 h-3" />
                        {t("sites.roofValidated")}
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1 text-xs">
                        <AlertTriangle className="w-3 h-3" />
                        {t("sites.roofPending")}
                      </Badge>
                    )}
                    {site.analysisAvailable ? (
                      <Badge variant="default" className="gap-1 text-xs">
                        <CheckCircle2 className="w-3 h-3" />
                        {t("sites.analysisReady")}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Clock className="w-3 h-3" />
                        {t("sites.pending")}
                      </Badge>
                    )}
                    {site.isArchived && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Archive className="w-3 h-3" />
                      </Badge>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-site-menu-list-${site.id}`}>
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingSite(site)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          {t("common.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => archiveMutation.mutate({ id: site.id, isArchived: !!site.isArchived })}>
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
                        <DropdownMenuItem
                          onClick={() => deleteMutation.mutate(site.id)}
                          className="text-destructive focus:text-destructive"
                        >
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

      {/* Floating Bulk Action Bar */}
      {selectedSites.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border shadow-lg rounded-lg px-4 py-3 flex items-center gap-3" data-testid="bulk-action-bar">
          <span className="text-sm font-medium" data-testid="text-selected-count">
            {selectedSites.size} {language === "fr" ? "selectionne(s)" : "selected"}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleBulkArchive}
            data-testid="button-bulk-archive"
          >
            <Archive className="w-3.5 h-3.5" />
            {language === "fr" ? "Archiver" : "Archive"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-destructive"
            onClick={() => setIsBulkDeleteDialogOpen(true)}
            data-testid="button-bulk-delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {language === "fr" ? "Supprimer" : "Delete"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedSites(new Set())}
            data-testid="button-clear-selection"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === "fr" ? "Supprimer les sites selectionnes" : "Delete Selected Sites"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === "fr"
                ? `Etes-vous sur de vouloir supprimer ${selectedSites.size} site(s) ? Cette action est irreversible.`
                : `Are you sure you want to delete ${selectedSites.size} site(s)? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-bulk-delete">
              {language === "fr" ? "Annuler" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleBulkDelete}
              data-testid="button-confirm-bulk-delete"
            >
              {language === "fr" ? "Confirmer la suppression" : "Confirm Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
