import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { 
  Plus, 
  Trash2, 
  Pencil, 
  TrendingUp,
  TrendingDown,
  Building2,
  Star,
  Clock,
  Search,
  Filter,
  BarChart3,
  PackagePlus,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import type { Supplier, PriceHistory } from "@shared/schema";

const PRICE_CATEGORIES = [
  "panels",
  "racking", 
  "inverters",
  "bos_electrical",
  "labor",
  "soft_costs"
] as const;

const SUPPLIER_CATEGORIES = [
  "racking",
  "panels",
  "inverters",
  "electrical",
  "labor",
  "full_service"
] as const;

const UNITS = ["W", "panel", "kW", "project", "percent", "hour"] as const;

const categoryLabels: Record<string, { fr: string; en: string }> = {
  panels: { fr: "Panneaux", en: "Panels" },
  racking: { fr: "Structure", en: "Racking" },
  inverters: { fr: "Onduleurs", en: "Inverters" },
  bos_electrical: { fr: "BOS Électrique", en: "BOS Electrical" },
  labor: { fr: "Main-d'œuvre", en: "Labor" },
  soft_costs: { fr: "Coûts indirects", en: "Soft Costs" },
  electrical: { fr: "Électrique", en: "Electrical" },
  full_service: { fr: "Service complet", en: "Full Service" },
};

const unitLabels: Record<string, { fr: string; en: string }> = {
  W: { fr: "W", en: "W" },
  panel: { fr: "panneau", en: "panel" },
  kW: { fr: "kW", en: "kW" },
  project: { fr: "projet", en: "project" },
  percent: { fr: "%", en: "%" },
  hour: { fr: "heure", en: "hour" },
};

const supplierSchema = z.object({
  name: z.string().min(1, "Name required"),
  category: z.string().min(1, "Category required"),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  notes: z.string().optional(),
  rating: z.coerce.number().min(1).max(5).optional().nullable(),
  leadTimeWeeks: z.coerce.number().min(0).optional().nullable(),
  paymentTerms: z.string().optional(),
  active: z.boolean().default(true),
});

const priceHistorySchema = z.object({
  supplierId: z.string().optional(),
  category: z.string().min(1, "Category required"),
  itemName: z.string().min(1, "Item name required"),
  pricePerUnit: z.coerce.number().min(0, "Price must be positive"),
  unit: z.string().min(1, "Unit required"),
  quantity: z.coerce.number().optional().nullable(),
  quoteNumber: z.string().optional(),
  quoteDate: z.string().min(1, "Quote date required"),
  validUntil: z.string().optional(),
  notes: z.string().optional(),
});

type SupplierForm = z.infer<typeof supplierSchema>;
type PriceHistoryForm = z.infer<typeof priceHistorySchema>;

interface PriceTrend {
  category: string;
  currentAvgPrice: number;
  priceChange3Months: number;
  priceChange6Months: number;
  priceChange12Months: number;
  unit: string;
  entryCount: number;
}

interface SupplierComparison {
  supplierId: string;
  supplierName: string;
  avgPrice: number;
  entryCount: number;
}

export default function MarketIntelligencePricingPage() {
  const { language } = useI18n();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("suppliers");
  
  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [deleteSupplier, setDeleteSupplier] = useState<Supplier | null>(null);
  const [supplierCategoryFilter, setSupplierCategoryFilter] = useState<string>("all");
  
  const [isPriceHistoryDialogOpen, setIsPriceHistoryDialogOpen] = useState(false);
  const [deletePriceHistory, setDeletePriceHistory] = useState<PriceHistory | null>(null);
  const [promoteEntry, setPromoteEntry] = useState<PriceHistory | null>(null);
  const [priceHistoryCategoryFilter, setPriceHistoryCategoryFilter] = useState<string>("all");
  const [priceHistorySupplierFilter, setPriceHistorySupplierFilter] = useState<string>("all");
  const [priceHistorySearchQuery, setPriceHistorySearchQuery] = useState("");
  
  const [analyticsCategory, setAnalyticsCategory] = useState<string>("panels");

  const { data: suppliers = [], isLoading: suppliersLoading } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: priceHistoryData = [], isLoading: priceHistoryLoading } = useQuery<PriceHistory[]>({
    queryKey: ["/api/price-history"],
  });

  const { data: priceTrends = [], isLoading: priceTrendsLoading } = useQuery<PriceTrend[]>({
    queryKey: ["/api/market-intelligence/price-trends"],
  });

  const { data: supplierComparison = [], isLoading: supplierComparisonLoading } = useQuery<SupplierComparison[]>({
    queryKey: ["/api/market-intelligence/supplier-comparison", analyticsCategory],
    queryFn: () => fetch(`/api/market-intelligence/supplier-comparison?category=${analyticsCategory}`, {
      headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
    }).then(res => res.json()),
  });

  const filteredSuppliers = useMemo(() => {
    if (supplierCategoryFilter === "all") return suppliers;
    return suppliers.filter(s => s.category === supplierCategoryFilter);
  }, [suppliers, supplierCategoryFilter]);

  const filteredPriceHistory = useMemo(() => {
    let filtered = priceHistoryData;
    if (priceHistoryCategoryFilter !== "all") {
      filtered = filtered.filter(p => p.category === priceHistoryCategoryFilter);
    }
    if (priceHistorySupplierFilter !== "all") {
      filtered = filtered.filter(p => p.supplierId === priceHistorySupplierFilter);
    }
    if (priceHistorySearchQuery) {
      const query = priceHistorySearchQuery.toLowerCase();
      filtered = filtered.filter(p => p.itemName.toLowerCase().includes(query));
    }
    return filtered;
  }, [priceHistoryData, priceHistoryCategoryFilter, priceHistorySupplierFilter, priceHistorySearchQuery]);

  const supplierForm = useForm<SupplierForm>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: "",
      category: "racking",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      website: "",
      address: "",
      city: "",
      province: "QC",
      notes: "",
      rating: null,
      leadTimeWeeks: null,
      paymentTerms: "",
      active: true,
    },
  });

  const priceHistoryForm = useForm<PriceHistoryForm>({
    resolver: zodResolver(priceHistorySchema),
    defaultValues: {
      supplierId: "",
      category: "panels",
      itemName: "",
      pricePerUnit: 0,
      unit: "W",
      quantity: null,
      quoteNumber: "",
      quoteDate: format(new Date(), "yyyy-MM-dd"),
      validUntil: "",
      notes: "",
    },
  });

  const createSupplierMutation = useMutation({
    mutationFn: (data: SupplierForm) => apiRequest("POST", "/api/suppliers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      setIsSupplierDialogOpen(false);
      supplierForm.reset();
      toast({
        title: language === "fr" ? "Fournisseur créé" : "Supplier Created",
        description: language === "fr" ? "Le fournisseur a été ajouté." : "The supplier has been added.",
      });
    },
    onError: (error: Error) => {
      toast({ title: language === "fr" ? "Erreur" : "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateSupplierMutation = useMutation({
    mutationFn: (data: SupplierForm & { id: string }) => apiRequest("PATCH", `/api/suppliers/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      setIsSupplierDialogOpen(false);
      setEditingSupplier(null);
      toast({
        title: language === "fr" ? "Fournisseur modifié" : "Supplier Updated",
        description: language === "fr" ? "Les modifications ont été enregistrées." : "Changes have been saved.",
      });
    },
    onError: (error: Error) => {
      toast({ title: language === "fr" ? "Erreur" : "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/suppliers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      setDeleteSupplier(null);
      toast({
        title: language === "fr" ? "Fournisseur supprimé" : "Supplier Deleted",
        description: language === "fr" ? "Le fournisseur a été supprimé." : "The supplier has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({ title: language === "fr" ? "Erreur" : "Error", description: error.message, variant: "destructive" });
    },
  });

  const createPriceHistoryMutation = useMutation({
    mutationFn: (data: PriceHistoryForm) => {
      const payload = {
        ...data,
        supplierId: data.supplierId || null,
        quoteDate: new Date(data.quoteDate),
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        quantity: data.quantity || null,
        quoteNumber: data.quoteNumber || null,
        notes: data.notes || null,
      };
      return apiRequest("POST", "/api/price-history", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/price-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/market-intelligence/price-trends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/market-intelligence/supplier-comparison"] });
      setIsPriceHistoryDialogOpen(false);
      priceHistoryForm.reset();
      toast({
        title: language === "fr" ? "Entrée ajoutée" : "Entry Added",
        description: language === "fr" ? "L'entrée de prix a été ajoutée." : "The price entry has been added.",
      });
    },
    onError: (error: Error) => {
      toast({ title: language === "fr" ? "Erreur" : "Error", description: error.message, variant: "destructive" });
    },
  });

  const deletePriceHistoryMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/price-history/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/price-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/market-intelligence/price-trends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/market-intelligence/supplier-comparison"] });
      setDeletePriceHistory(null);
      toast({
        title: language === "fr" ? "Entrée supprimée" : "Entry Deleted",
        description: language === "fr" ? "L'entrée de prix a été supprimée." : "The price entry has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({ title: language === "fr" ? "Erreur" : "Error", description: error.message, variant: "destructive" });
    },
  });

  const promoteToCatalogMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/price-history/${id}/promote-to-catalog`),
    onSuccess: (data: { action: string; message: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/catalog"] });
      setPromoteEntry(null);
      const isUpdate = data.action === "updated";
      toast({
        title: isUpdate 
          ? (language === "fr" ? "Catalogue mis à jour" : "Catalog Updated")
          : (language === "fr" ? "Ajouté au catalogue" : "Added to Catalog"),
        description: isUpdate
          ? (language === "fr" ? "Le prix du composant a été mis à jour dans le catalogue." : "The component price has been updated in the catalog.")
          : (language === "fr" ? "Le composant a été ajouté au catalogue." : "The component has been added to the catalog."),
      });
    },
    onError: (error: Error) => {
      toast({ title: language === "fr" ? "Erreur" : "Error", description: error.message, variant: "destructive" });
    },
  });

  const openEditSupplierDialog = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    supplierForm.reset({
      name: supplier.name,
      category: supplier.category,
      contactName: supplier.contactName || "",
      contactEmail: supplier.contactEmail || "",
      contactPhone: supplier.contactPhone || "",
      website: supplier.website || "",
      address: supplier.address || "",
      city: supplier.city || "",
      province: supplier.province || "QC",
      notes: supplier.notes || "",
      rating: supplier.rating || null,
      leadTimeWeeks: supplier.leadTimeWeeks || null,
      paymentTerms: supplier.paymentTerms || "",
      active: supplier.active ?? true,
    });
    setIsSupplierDialogOpen(true);
  };

  const openCreateSupplierDialog = () => {
    setEditingSupplier(null);
    supplierForm.reset();
    setIsSupplierDialogOpen(true);
  };

  const openCreatePriceHistoryDialog = () => {
    priceHistoryForm.reset({
      supplierId: "",
      category: "panels",
      itemName: "",
      pricePerUnit: 0,
      unit: "W",
      quantity: null,
      quoteNumber: "",
      quoteDate: format(new Date(), "yyyy-MM-dd"),
      validUntil: "",
      notes: "",
    });
    setIsPriceHistoryDialogOpen(true);
  };

  const onSubmitSupplier = (data: SupplierForm) => {
    if (editingSupplier) {
      updateSupplierMutation.mutate({ ...data, id: editingSupplier.id });
    } else {
      createSupplierMutation.mutate(data);
    }
  };

  const onSubmitPriceHistory = (data: PriceHistoryForm) => {
    createPriceHistoryMutation.mutate(data);
  };

  const getSupplierName = (supplierId: string | null) => {
    if (!supplierId) return "-";
    const supplier = suppliers.find(s => s.id === supplierId);
    return supplier?.name || "-";
  };

  const renderRating = (rating: number | null) => {
    if (!rating) return "-";
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <Star
            key={star}
            className={`w-3 h-3 ${star <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
          />
        ))}
      </div>
    );
  };

  const formatPriceChange = (change: number) => {
    if (change === 0) return <span className="text-muted-foreground">-</span>;
    const isPositive = change > 0;
    return (
      <span className={`flex items-center gap-1 ${isPositive ? "text-red-600" : "text-green-600"}`}>
        {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {isPositive ? "+" : ""}{change.toFixed(1)}%
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="page-title">
            {language === "fr" ? "Intelligence de marché - Prix" : "Market Intelligence - Pricing"}
          </h1>
          <p className="text-muted-foreground">
            {language === "fr" 
              ? "Gérer les fournisseurs et suivre l'historique des prix" 
              : "Manage suppliers and track price history"}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList data-testid="tabs-list">
          <TabsTrigger value="suppliers" data-testid="tab-suppliers">
            <Building2 className="w-4 h-4 mr-2" />
            {language === "fr" ? "Fournisseurs" : "Suppliers"}
          </TabsTrigger>
          <TabsTrigger value="price-history" data-testid="tab-price-history">
            <Clock className="w-4 h-4 mr-2" />
            {language === "fr" ? "Historique des prix" : "Price History"}
          </TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">
            <BarChart3 className="w-4 h-4 mr-2" />
            {language === "fr" ? "Analytique" : "Analytics"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="suppliers" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={supplierCategoryFilter} onValueChange={setSupplierCategoryFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-supplier-category-filter">
                  <SelectValue placeholder={language === "fr" ? "Catégorie" : "Category"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === "fr" ? "Toutes" : "All"}</SelectItem>
                  {SUPPLIER_CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {categoryLabels[cat]?.[language] || cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={openCreateSupplierDialog} data-testid="button-add-supplier">
              <Plus className="w-4 h-4 mr-2" />
              {language === "fr" ? "Ajouter un fournisseur" : "Add Supplier"}
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {suppliersLoading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : filteredSuppliers.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  {language === "fr" ? "Aucun fournisseur" : "No suppliers"}
                </div>
              ) : (
                <Table data-testid="table-suppliers">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{language === "fr" ? "Nom" : "Name"}</TableHead>
                      <TableHead>{language === "fr" ? "Catégorie" : "Category"}</TableHead>
                      <TableHead>{language === "fr" ? "Contact" : "Contact"}</TableHead>
                      <TableHead>{language === "fr" ? "Délai" : "Lead Time"}</TableHead>
                      <TableHead>{language === "fr" ? "Note" : "Rating"}</TableHead>
                      <TableHead>{language === "fr" ? "Statut" : "Status"}</TableHead>
                      <TableHead className="text-right">{language === "fr" ? "Actions" : "Actions"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSuppliers.map(supplier => (
                      <TableRow key={supplier.id} data-testid={`row-supplier-${supplier.id}`}>
                        <TableCell className="font-medium">{supplier.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {categoryLabels[supplier.category]?.[language] || supplier.category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {supplier.contactName && <div>{supplier.contactName}</div>}
                            {supplier.contactEmail && <div className="text-muted-foreground">{supplier.contactEmail}</div>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {supplier.leadTimeWeeks 
                            ? `${supplier.leadTimeWeeks} ${language === "fr" ? "sem." : "wks"}`
                            : "-"}
                        </TableCell>
                        <TableCell>{renderRating(supplier.rating)}</TableCell>
                        <TableCell>
                          <Badge variant={supplier.active ? "default" : "secondary"}>
                            {supplier.active 
                              ? (language === "fr" ? "Actif" : "Active") 
                              : (language === "fr" ? "Inactif" : "Inactive")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditSupplierDialog(supplier)}
                              data-testid={`button-edit-supplier-${supplier.id}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteSupplier(supplier)}
                              data-testid={`button-delete-supplier-${supplier.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="price-history" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={language === "fr" ? "Filtrer..." : "Filter..."}
                  value={priceHistorySearchQuery}
                  onChange={(e) => setPriceHistorySearchQuery(e.target.value)}
                  className="pl-8 w-[180px]"
                  data-testid="input-price-history-search"
                />
              </div>
              <Select value={priceHistoryCategoryFilter} onValueChange={setPriceHistoryCategoryFilter}>
                <SelectTrigger className="w-[160px]" data-testid="select-price-history-category-filter">
                  <SelectValue placeholder={language === "fr" ? "Catégorie" : "Category"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === "fr" ? "Toutes" : "All"}</SelectItem>
                  {PRICE_CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {categoryLabels[cat]?.[language] || cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={priceHistorySupplierFilter} onValueChange={setPriceHistorySupplierFilter}>
                <SelectTrigger className="w-[160px]" data-testid="select-price-history-supplier-filter">
                  <SelectValue placeholder={language === "fr" ? "Fournisseur" : "Supplier"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === "fr" ? "Tous" : "All"}</SelectItem>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={openCreatePriceHistoryDialog} data-testid="button-add-price-entry">
              <Plus className="w-4 h-4 mr-2" />
              {language === "fr" ? "Ajouter une entrée" : "Add Price Entry"}
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {priceHistoryLoading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : filteredPriceHistory.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  {language === "fr" ? "Aucune entrée" : "No entries"}
                </div>
              ) : (
                <Table data-testid="table-price-history">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{language === "fr" ? "Date" : "Date"}</TableHead>
                      <TableHead>{language === "fr" ? "Article" : "Item"}</TableHead>
                      <TableHead>{language === "fr" ? "Fournisseur" : "Supplier"}</TableHead>
                      <TableHead>{language === "fr" ? "Prix" : "Price"}</TableHead>
                      <TableHead>{language === "fr" ? "Unité" : "Unit"}</TableHead>
                      <TableHead>{language === "fr" ? "Valide jusqu'au" : "Valid Until"}</TableHead>
                      <TableHead>{language === "fr" ? "Notes" : "Notes"}</TableHead>
                      <TableHead className="text-right">{language === "fr" ? "Actions" : "Actions"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPriceHistory.map(entry => (
                      <TableRow key={entry.id} data-testid={`row-price-history-${entry.id}`}>
                        <TableCell>
                          {entry.quoteDate ? format(new Date(entry.quoteDate), "yyyy-MM-dd") : "-"}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{entry.itemName}</div>
                            <Badge variant="outline" className="text-xs">
                              {categoryLabels[entry.category]?.[language] || entry.category}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>{getSupplierName(entry.supplierId)}</TableCell>
                        <TableCell className="font-mono">
                          ${entry.pricePerUnit.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {unitLabels[entry.unit]?.[language] || entry.unit}
                        </TableCell>
                        <TableCell>
                          {entry.validUntil ? format(new Date(entry.validUntil), "yyyy-MM-dd") : "-"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={entry.notes || ""}>
                          {entry.notes || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setPromoteEntry(entry)}
                              title={language === "fr" ? "Promouvoir au catalogue" : "Promote to Catalog"}
                              data-testid={`button-promote-price-history-${entry.id}`}
                            >
                              <PackagePlus className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeletePriceHistory(entry)}
                              data-testid={`button-delete-price-history-${entry.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {language === "fr" ? "Tendances des prix par catégorie" : "Price Trends by Category"}
              </CardTitle>
              <CardDescription>
                {language === "fr" 
                  ? "Variation des prix moyens sur 3, 6 et 12 mois" 
                  : "Average price changes over 3, 6, and 12 months"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {priceTrendsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
                </div>
              ) : priceTrends.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  {language === "fr" ? "Pas de données disponibles" : "No data available"}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="grid-price-trends">
                  {priceTrends.map(trend => (
                    <Card key={trend.category} data-testid={`card-price-trend-${trend.category}`}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline">
                            {categoryLabels[trend.category]?.[language] || trend.category}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {trend.entryCount} {language === "fr" ? "entrées" : "entries"}
                          </span>
                        </div>
                        <div className="text-2xl font-bold mb-2">
                          ${trend.currentAvgPrice.toFixed(2)} / {unitLabels[trend.unit]?.[language] || trend.unit}
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">3 {language === "fr" ? "mois" : "mo"}</span>
                            {formatPriceChange(trend.priceChange3Months)}
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">6 {language === "fr" ? "mois" : "mo"}</span>
                            {formatPriceChange(trend.priceChange6Months)}
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">12 {language === "fr" ? "mois" : "mo"}</span>
                            {formatPriceChange(trend.priceChange12Months)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>
                    {language === "fr" ? "Comparaison des fournisseurs" : "Supplier Comparison"}
                  </CardTitle>
                  <CardDescription>
                    {language === "fr" 
                      ? "Prix moyen par fournisseur pour la catégorie sélectionnée" 
                      : "Average price by supplier for selected category"}
                  </CardDescription>
                </div>
                <Select value={analyticsCategory} onValueChange={setAnalyticsCategory}>
                  <SelectTrigger className="w-[180px]" data-testid="select-analytics-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRICE_CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>
                        {categoryLabels[cat]?.[language] || cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {supplierComparisonLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : supplierComparison.length === 0 ? (
                <div className="text-center text-muted-foreground py-8 h-[300px] flex items-center justify-center">
                  {language === "fr" 
                    ? "Pas de données pour cette catégorie" 
                    : "No data for this category"}
                </div>
              ) : (
                <div className="h-[300px]" data-testid="chart-supplier-comparison">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={supplierComparison} layout="vertical" margin={{ left: 120 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(v) => `$${v.toFixed(2)}`} />
                      <YAxis type="category" dataKey="supplierName" width={110} />
                      <Tooltip 
                        formatter={(value: number) => [`$${value.toFixed(2)}`, language === "fr" ? "Prix moyen" : "Avg Price"]}
                        labelFormatter={(label) => label}
                      />
                      <Bar dataKey="avgPrice" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isSupplierDialogOpen} onOpenChange={setIsSupplierDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSupplier 
                ? (language === "fr" ? "Modifier le fournisseur" : "Edit Supplier")
                : (language === "fr" ? "Ajouter un fournisseur" : "Add Supplier")}
            </DialogTitle>
            <DialogDescription>
              {language === "fr" 
                ? "Remplissez les informations du fournisseur" 
                : "Fill in the supplier information"}
            </DialogDescription>
          </DialogHeader>
          <Form {...supplierForm}>
            <form onSubmit={supplierForm.handleSubmit(onSubmitSupplier)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={supplierForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Nom" : "Name"} *</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-supplier-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={supplierForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Catégorie" : "Category"} *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-supplier-category">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SUPPLIER_CATEGORIES.map(cat => (
                            <SelectItem key={cat} value={cat}>
                              {categoryLabels[cat]?.[language] || cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={supplierForm.control}
                  name="contactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Nom du contact" : "Contact Name"}</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-supplier-contact-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={supplierForm.control}
                  name="contactEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Courriel" : "Email"}</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} data-testid="input-supplier-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={supplierForm.control}
                  name="contactPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Téléphone" : "Phone"}</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-supplier-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={supplierForm.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Site web" : "Website"}</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-supplier-website" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={supplierForm.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Ville" : "City"}</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-supplier-city" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={supplierForm.control}
                  name="province"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Province" : "Province"}</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-supplier-province" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={supplierForm.control}
                  name="leadTimeWeeks"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Délai (semaines)" : "Lead Time (weeks)"}</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          value={field.value ?? ""} 
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                          data-testid="input-supplier-lead-time"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={supplierForm.control}
                  name="rating"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Note (1-5)" : "Rating (1-5)"}</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={1} 
                          max={5} 
                          {...field} 
                          value={field.value ?? ""} 
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                          data-testid="input-supplier-rating"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={supplierForm.control}
                  name="paymentTerms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Conditions de paiement" : "Payment Terms"}</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Net 30" data-testid="input-supplier-payment-terms" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={supplierForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "fr" ? "Notes" : "Notes"}</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} data-testid="textarea-supplier-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsSupplierDialogOpen(false)}>
                  {language === "fr" ? "Annuler" : "Cancel"}
                </Button>
                <Button 
                  type="submit" 
                  disabled={createSupplierMutation.isPending || updateSupplierMutation.isPending}
                  data-testid="button-submit-supplier"
                >
                  {createSupplierMutation.isPending || updateSupplierMutation.isPending
                    ? (language === "fr" ? "Enregistrement..." : "Saving...")
                    : (language === "fr" ? "Enregistrer" : "Save")}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isPriceHistoryDialogOpen} onOpenChange={setIsPriceHistoryDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {language === "fr" ? "Ajouter une entrée de prix" : "Add Price Entry"}
            </DialogTitle>
            <DialogDescription>
              {language === "fr" 
                ? "Entrez les détails du devis ou de la facture" 
                : "Enter quote or invoice details"}
            </DialogDescription>
          </DialogHeader>
          <Form {...priceHistoryForm}>
            <form onSubmit={priceHistoryForm.handleSubmit(onSubmitPriceHistory)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={priceHistoryForm.control}
                  name="supplierId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Fournisseur" : "Supplier"}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-price-history-supplier">
                            <SelectValue placeholder={language === "fr" ? "Sélectionner..." : "Select..."} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {suppliers.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={priceHistoryForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Catégorie" : "Category"} *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-price-history-category">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PRICE_CATEGORIES.map(cat => (
                            <SelectItem key={cat} value={cat}>
                              {categoryLabels[cat]?.[language] || cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={priceHistoryForm.control}
                  name="itemName"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>{language === "fr" ? "Nom de l'article" : "Item Name"} *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Jinko 625W Bifacial" data-testid="input-price-history-item-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={priceHistoryForm.control}
                  name="pricePerUnit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Prix par unité ($)" : "Price per Unit ($)"} *</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} data-testid="input-price-history-price" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={priceHistoryForm.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Unité" : "Unit"} *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-price-history-unit">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {UNITS.map(unit => (
                            <SelectItem key={unit} value={unit}>
                              {unitLabels[unit]?.[language] || unit}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={priceHistoryForm.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Quantité" : "Quantity"}</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          value={field.value ?? ""} 
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                          data-testid="input-price-history-quantity"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={priceHistoryForm.control}
                  name="quoteNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "N° de devis" : "Quote Number"}</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-price-history-quote-number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={priceHistoryForm.control}
                  name="quoteDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Date du devis" : "Quote Date"} *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-price-history-quote-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={priceHistoryForm.control}
                  name="validUntil"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Valide jusqu'au" : "Valid Until"}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-price-history-valid-until" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={priceHistoryForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "fr" ? "Notes" : "Notes"}</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} data-testid="textarea-price-history-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsPriceHistoryDialogOpen(false)}>
                  {language === "fr" ? "Annuler" : "Cancel"}
                </Button>
                <Button 
                  type="submit" 
                  disabled={createPriceHistoryMutation.isPending}
                  data-testid="button-submit-price-history"
                >
                  {createPriceHistoryMutation.isPending
                    ? (language === "fr" ? "Enregistrement..." : "Saving...")
                    : (language === "fr" ? "Enregistrer" : "Save")}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteSupplier} onOpenChange={() => setDeleteSupplier(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === "fr" ? "Supprimer le fournisseur?" : "Delete Supplier?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === "fr" 
                ? `Êtes-vous sûr de vouloir supprimer "${deleteSupplier?.name}"? Cette action est irréversible.`
                : `Are you sure you want to delete "${deleteSupplier?.name}"? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-supplier">
              {language === "fr" ? "Annuler" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteSupplier && deleteSupplierMutation.mutate(deleteSupplier.id)}
              data-testid="button-confirm-delete-supplier"
            >
              {language === "fr" ? "Supprimer" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletePriceHistory} onOpenChange={() => setDeletePriceHistory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === "fr" ? "Supprimer l'entrée?" : "Delete Entry?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === "fr" 
                ? `Êtes-vous sûr de vouloir supprimer cette entrée de prix? Cette action est irréversible.`
                : `Are you sure you want to delete this price entry? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-price-history">
              {language === "fr" ? "Annuler" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deletePriceHistory && deletePriceHistoryMutation.mutate(deletePriceHistory.id)}
              data-testid="button-confirm-delete-price-history"
            >
              {language === "fr" ? "Supprimer" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!promoteEntry} onOpenChange={() => setPromoteEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === "fr" ? "Promouvoir au catalogue?" : "Promote to Catalog?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === "fr" 
                ? `Voulez-vous ajouter "${promoteEntry?.itemName}" au catalogue des composants? Si un composant avec le même modèle existe déjà, son prix sera mis à jour.`
                : `Do you want to add "${promoteEntry?.itemName}" to the component catalog? If a component with the same model already exists, its price will be updated.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-promote">
              {language === "fr" ? "Annuler" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => promoteEntry && promoteToCatalogMutation.mutate(promoteEntry.id)}
              data-testid="button-confirm-promote"
            >
              {language === "fr" ? "Promouvoir" : "Promote"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
