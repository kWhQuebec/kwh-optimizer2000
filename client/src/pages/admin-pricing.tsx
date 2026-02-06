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
  DollarSign,
  ChevronDown,
  ChevronRight,
  Package,
  MoreHorizontal,
  Search
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import type { PricingComponent } from "@shared/schema";

const CATEGORIES = [
  "panels",
  "racking", 
  "inverters",
  "bos_electrical",
  "labor",
  "soft_costs"
] as const;

const UNITS = ["W", "panel", "kW", "project", "percent", "hour"] as const;

const categoryLabels: Record<string, { fr: string; en: string }> = {
  panels: { fr: "Panneaux", en: "Panels" },
  racking: { fr: "Structure", en: "Racking" },
  inverters: { fr: "Onduleurs", en: "Inverters" },
  bos_electrical: { fr: "BOS Électrique", en: "BOS Electrical" },
  labor: { fr: "Main-d'œuvre", en: "Labor" },
  soft_costs: { fr: "Coûts indirects", en: "Soft Costs" },
};

const unitLabels: Record<string, { fr: string; en: string }> = {
  W: { fr: "W", en: "W" },
  panel: { fr: "panneau", en: "panel" },
  kW: { fr: "kW", en: "kW" },
  project: { fr: "projet", en: "project" },
  percent: { fr: "%", en: "%" },
  hour: { fr: "heure", en: "hour" },
};

const pricingComponentSchema = z.object({
  category: z.string().min(1, "Category required"),
  name: z.string().min(1, "Name required"),
  description: z.string().optional(),
  pricePerUnit: z.coerce.number().min(0, "Price must be positive"),
  unit: z.string().min(1, "Unit required"),
  minQuantity: z.coerce.number().optional().nullable(),
  maxQuantity: z.coerce.number().optional().nullable(),
  source: z.string().optional(),
  sourceDate: z.string().optional(),
  validUntil: z.string().optional(),
  notes: z.string().optional(),
  active: z.boolean().default(true),
});

type PricingComponentForm = z.infer<typeof pricingComponentSchema>;

export default function AdminPricingPage() {
  const { language } = useI18n();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editComponent, setEditComponent] = useState<PricingComponent | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(
    Object.fromEntries(CATEGORIES.map(c => [c, true]))
  );

  const { data: components = [], isLoading } = useQuery<PricingComponent[]>({
    queryKey: ["/api/pricing-components"],
  });

  const groupedComponents = useMemo(() => {
    const filtered = components.filter(c => 
      !searchQuery || 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.source && c.source.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    
    const grouped: Record<string, PricingComponent[]> = {};
    for (const category of CATEGORIES) {
      grouped[category] = filtered.filter(c => c.category === category);
    }
    return grouped;
  }, [components, searchQuery]);

  const form = useForm<PricingComponentForm>({
    resolver: zodResolver(pricingComponentSchema),
    defaultValues: {
      category: "panels",
      name: "",
      description: "",
      pricePerUnit: 0,
      unit: "W",
      minQuantity: null,
      maxQuantity: null,
      source: "",
      sourceDate: "",
      validUntil: "",
      notes: "",
      active: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: PricingComponentForm) => {
      const payload = {
        ...data,
        sourceDate: data.sourceDate ? new Date(data.sourceDate) : null,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        minQuantity: data.minQuantity || null,
        maxQuantity: data.maxQuantity || null,
        description: data.description || null,
        source: data.source || null,
        notes: data.notes || null,
      };
      return apiRequest("POST", "/api/pricing-components", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-components"] });
      setIsCreateOpen(false);
      form.reset();
      toast({
        title: language === "fr" ? "Composant créé" : "Component Created",
        description: language === "fr" ? "Le composant de prix a été ajouté." : "The pricing component has been added.",
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

  const updateMutation = useMutation({
    mutationFn: (data: PricingComponentForm & { id: string }) => {
      const payload = {
        ...data,
        sourceDate: data.sourceDate ? new Date(data.sourceDate) : null,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        minQuantity: data.minQuantity || null,
        maxQuantity: data.maxQuantity || null,
        description: data.description || null,
        source: data.source || null,
        notes: data.notes || null,
      };
      return apiRequest("PATCH", `/api/pricing-components/${data.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-components"] });
      setEditComponent(null);
      toast({
        title: language === "fr" ? "Composant modifié" : "Component Updated",
        description: language === "fr" ? "Les modifications ont été enregistrées." : "Changes have been saved.",
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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/pricing-components/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-components"] });
      setDeleteId(null);
      toast({
        title: language === "fr" ? "Composant supprimé" : "Component Deleted",
        description: language === "fr" ? "Le composant a été supprimé." : "The component has been removed.",
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

  const openEditDialog = (component: PricingComponent) => {
    setEditComponent(component);
    form.reset({
      category: component.category,
      name: component.name,
      description: component.description || "",
      pricePerUnit: component.pricePerUnit,
      unit: component.unit,
      minQuantity: component.minQuantity,
      maxQuantity: component.maxQuantity,
      source: component.source || "",
      sourceDate: component.sourceDate ? format(new Date(component.sourceDate), "yyyy-MM-dd") : "",
      validUntil: component.validUntil ? format(new Date(component.validUntil), "yyyy-MM-dd") : "",
      notes: component.notes || "",
      active: component.active ?? true,
    });
  };

  const openCreateDialog = () => {
    setIsCreateOpen(true);
    form.reset({
      category: "panels",
      name: "",
      description: "",
      pricePerUnit: 0,
      unit: "W",
      minQuantity: null,
      maxQuantity: null,
      source: "",
      sourceDate: "",
      validUntil: "",
      notes: "",
      active: true,
    });
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const formatPrice = (price: number, unit: string) => {
    const formatted = price.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    return `$${formatted}/${unitLabels[unit]?.[language] || unit}`;
  };

  const getDollarPerWatt = (component: PricingComponent) => {
    if (component.unit === "W") {
      return component.pricePerUnit;
    }
    if (component.unit === "panel") {
      return component.pricePerUnit / 625;
    }
    if (component.unit === "kW") {
      return component.pricePerUnit / 1000;
    }
    return null;
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "-";
    try {
      return format(new Date(date), "dd MMM yyyy");
    } catch {
      return "-";
    }
  };

  const onSubmit = (data: PricingComponentForm) => {
    if (editComponent) {
      updateMutation.mutate({ ...data, id: editComponent.id });
    } else {
      createMutation.mutate(data);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-40" />
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-pricing-title">
            {language === "fr" ? "Composants de prix" : "Pricing Components"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {language === "fr" 
              ? "Gérez les coûts unitaires pour le calcul $/W" 
              : "Manage unit costs for $/W calculation"}
          </p>
        </div>
        <Button onClick={openCreateDialog} data-testid="button-create-component">
          <Plus className="w-4 h-4 mr-2" />
          {language === "fr" ? "Ajouter composant" : "Add Component"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-base">
                {language === "fr" ? "Tous les composants" : "All Components"}
              </CardTitle>
              <CardDescription>
                {components.length} {language === "fr" ? "composants" : "components"}
              </CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={language === "fr" ? "Filtrer..." : "Filter..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64"
                data-testid="input-search-components"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {components.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {language === "fr" ? "Aucun composant de prix" : "No pricing components"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {CATEGORIES.map(category => {
                const categoryComponents = groupedComponents[category] || [];
                if (categoryComponents.length === 0 && searchQuery) return null;
                
                return (
                  <Collapsible 
                    key={category} 
                    open={expandedCategories[category]}
                    onOpenChange={() => toggleCategory(category)}
                  >
                    <CollapsibleTrigger asChild>
                      <Button 
                        variant="ghost" 
                        className="w-full justify-start gap-2 h-auto py-3"
                        data-testid={`button-category-${category}`}
                      >
                        {expandedCategories[category] ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                        <span className="font-semibold">
                          {categoryLabels[category]?.[language] || category}
                        </span>
                        <Badge variant="secondary" className="ml-2">
                          {categoryComponents.length}
                        </Badge>
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      {categoryComponents.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 pl-8">
                          {language === "fr" ? "Aucun composant dans cette catégorie" : "No components in this category"}
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>{language === "fr" ? "Nom" : "Name"}</TableHead>
                                <TableHead>{language === "fr" ? "Prix/Unité" : "Price/Unit"}</TableHead>
                                <TableHead>$/W</TableHead>
                                <TableHead>{language === "fr" ? "Source" : "Source"}</TableHead>
                                <TableHead>{language === "fr" ? "Dernière MAJ" : "Last Updated"}</TableHead>
                                <TableHead>{language === "fr" ? "Actif" : "Active"}</TableHead>
                                <TableHead className="w-[60px]">{language === "fr" ? "Actions" : "Actions"}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {categoryComponents.map(component => {
                                const dollarPerWatt = getDollarPerWatt(component);
                                const isActive = component.active !== false;

                                return (
                                  <TableRow 
                                    key={component.id} 
                                    data-testid={`row-component-${component.id}`}
                                    className={!isActive ? "opacity-60" : ""}
                                  >
                                    <TableCell>
                                      <div>
                                        <p className="font-medium">{component.name}</p>
                                        {component.description && (
                                          <p className="text-xs text-muted-foreground">{component.description}</p>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="font-mono">
                                      {formatPrice(component.pricePerUnit, component.unit)}
                                    </TableCell>
                                    <TableCell className="font-mono">
                                      {dollarPerWatt !== null ? (
                                        <span className="text-primary font-semibold">
                                          ${dollarPerWatt.toFixed(4)}/W
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground">-</span>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <span className="text-sm">{component.source || "-"}</span>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {formatDate(component.updatedAt)}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant={isActive ? "default" : "secondary"}>
                                        {isActive 
                                          ? (language === "fr" ? "Actif" : "Active")
                                          : (language === "fr" ? "Inactif" : "Inactive")}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button 
                                            variant="ghost" 
                                            size="icon"
                                            data-testid={`button-component-actions-${component.id}`}
                                          >
                                            <MoreHorizontal className="w-4 h-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem 
                                            onClick={() => openEditDialog(component)}
                                            data-testid={`button-edit-component-${component.id}`}
                                          >
                                            <Pencil className="w-4 h-4 mr-2" />
                                            {language === "fr" ? "Modifier" : "Edit"}
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem 
                                            onClick={() => setDeleteId(component.id)}
                                            className="text-destructive focus:text-destructive"
                                            data-testid={`button-delete-component-${component.id}`}
                                          >
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            {language === "fr" ? "Supprimer" : "Delete"}
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen || !!editComponent} onOpenChange={(open) => {
        if (!open) {
          setIsCreateOpen(false);
          setEditComponent(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editComponent 
                ? (language === "fr" ? "Modifier le composant" : "Edit Component")
                : (language === "fr" ? "Ajouter un composant" : "Add Component")}
            </DialogTitle>
            <DialogDescription>
              {language === "fr" 
                ? "Définissez les coûts unitaires pour le calcul du prix $/W." 
                : "Define unit costs for $/W price calculation."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Catégorie" : "Category"}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-category">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CATEGORIES.map(cat => (
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
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Nom" : "Name"}</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Jinko 625W Bifacial" {...field} data-testid="input-component-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "fr" ? "Description" : "Description"} ({language === "fr" ? "optionnel" : "optional"})</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder={language === "fr" ? "Description du composant..." : "Component description..."} 
                        {...field} 
                        data-testid="input-component-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="pricePerUnit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Prix par unité ($CAD)" : "Price per unit ($CAD)"}</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.0001" min="0" {...field} data-testid="input-price-per-unit" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Unité" : "Unit"}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-unit">
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="minQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Qté minimum" : "Min Quantity"} ({language === "fr" ? "optionnel" : "optional"})</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="1" 
                          placeholder="-"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                          data-testid="input-min-quantity" 
                        />
                      </FormControl>
                      <FormDescription>
                        {language === "fr" ? "Pour prix échelonnés" : "For tiered pricing"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="maxQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Qté maximum" : "Max Quantity"} ({language === "fr" ? "optionnel" : "optional"})</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="1" 
                          placeholder="-"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                          data-testid="input-max-quantity" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Source" : "Source"}</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., KB Racking" {...field} data-testid="input-source" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sourceDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Date source" : "Source Date"}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-source-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="validUntil"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Valide jusqu'au" : "Valid Until"}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-valid-until" />
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
                    <FormLabel>{language === "fr" ? "Notes" : "Notes"} ({language === "fr" ? "optionnel" : "optional"})</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder={language === "fr" ? "Notes additionnelles..." : "Additional notes..."} 
                        {...field} 
                        data-testid="input-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">{language === "fr" ? "Actif" : "Active"}</FormLabel>
                      <FormDescription>
                        {language === "fr" 
                          ? "Ce composant est utilisé pour les calculs de prix" 
                          : "This component is used for price calculations"}
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsCreateOpen(false);
                    setEditComponent(null);
                  }}
                >
                  {language === "fr" ? "Annuler" : "Cancel"}
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit-component"
                >
                  {(createMutation.isPending || updateMutation.isPending) 
                    ? (language === "fr" ? "Enregistrement..." : "Saving...")
                    : (language === "fr" ? "Enregistrer" : "Save")}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === "fr" ? "Supprimer le composant?" : "Delete Component?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === "fr" 
                ? "Cette action est irréversible. Le composant sera définitivement supprimé." 
                : "This action cannot be undone. The component will be permanently deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {language === "fr" ? "Annuler" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending 
                ? (language === "fr" ? "Suppression..." : "Deleting...")
                : (language === "fr" ? "Supprimer" : "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
