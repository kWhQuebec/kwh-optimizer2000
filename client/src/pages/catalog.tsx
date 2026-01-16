import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Package, Zap, Battery, Settings, MoreHorizontal, Pencil, Trash2, CheckCircle2, Clock, AlertTriangle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ComponentCatalog } from "@shared/schema";

const catalogFormSchema = z.object({
  category: z.string().min(1, "Ce champ est requis"),
  manufacturer: z.string().min(1, "Ce champ est requis"),
  model: z.string().min(1, "Ce champ est requis"),
  unitCost: z.coerce.number().min(0),
  unitSellPrice: z.coerce.number().min(0),
  active: z.boolean(),
});

type CatalogFormValues = z.infer<typeof catalogFormSchema>;

const getCategoryLabel = (value: string, t: (key: string) => string) => {
  const labels: Record<string, string> = {
    MODULE: t("catalog.module"),
    INVERTER: t("catalog.inverter"),
    BATTERY: t("catalog.battery"),
    RACKING: t("catalog.racking"),
    CABLE: t("catalog.cable"),
    BOS: t("catalog.bos"),
  };
  return labels[value] || value;
};

const categoryValues = [
  { value: "MODULE", icon: Zap },
  { value: "INVERTER", icon: Settings },
  { value: "BATTERY", icon: Battery },
  { value: "RACKING", icon: Package },
  { value: "CABLE", icon: Package },
  { value: "BOS", icon: Package },
];

function getCategoryIcon(category: string) {
  const cat = categoryValues.find(c => c.value === category);
  return cat?.icon || Package;
}

function getFreshnessInfo(updatedAt: Date | string | null | undefined, language: "fr" | "en") {
  if (!updatedAt) {
    return {
      status: "unknown" as const,
      label: language === "fr" ? "Inconnu" : "Unknown",
      variant: "secondary" as const,
      icon: Clock,
    };
  }
  
  const now = new Date();
  const updated = new Date(updatedAt);
  const daysDiff = Math.floor((now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysDiff < 30) {
    return {
      status: "fresh" as const,
      label: language === "fr" ? "À jour" : "Fresh",
      variant: "default" as const,
      icon: CheckCircle2,
    };
  } else if (daysDiff <= 90) {
    return {
      status: "stale" as const,
      label: language === "fr" ? "Vieillissant" : "Stale",
      variant: "outline" as const,
      icon: AlertTriangle,
    };
  } else {
    return {
      status: "outdated" as const,
      label: language === "fr" ? "Périmé" : "Outdated",
      variant: "destructive" as const,
      icon: AlertCircle,
    };
  }
}

function ComponentCard({ component, onEdit, onDelete }: { 
  component: ComponentCatalog; 
  onEdit: () => void; 
  onDelete: () => void;
}) {
  const { t, language } = useI18n();
  const Icon = getCategoryIcon(component.category);
  const freshness = getFreshnessInfo(component.updatedAt, language);
  const FreshnessIcon = freshness.icon;

  return (
    <Card className="hover-elevate">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-medium truncate">{component.model}</h3>
                {component.active ? (
                  <Badge variant="default" className="gap-1 shrink-0">
                    <CheckCircle2 className="w-3 h-3" />
                    {t("catalog.active")}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="shrink-0">{t("catalog.inactive")}</Badge>
                )}
                <Badge 
                  variant={freshness.variant} 
                  className="gap-1 shrink-0"
                  data-testid={`badge-freshness-${component.id}`}
                >
                  <FreshnessIcon className="w-3 h-3" />
                  {freshness.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground truncate">{component.manufacturer}</p>
              <div className="flex items-center gap-4 mt-2 text-sm">
                <span className="text-muted-foreground">
                  {t("catalog.cost")}: <span className="font-mono">${(component.unitCost || 0).toLocaleString()}</span>
                </span>
                <span className="text-primary">
                  {t("catalog.sale")}: <span className="font-mono">${(component.unitSellPrice || 0).toLocaleString()}</span>
                </span>
              </div>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" data-testid={`button-component-menu-${component.id}`}>
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

function CatalogForm({ 
  component, 
  onSubmit, 
  onCancel, 
  isLoading 
}: { 
  component?: ComponentCatalog; 
  onSubmit: (data: CatalogFormValues) => void; 
  onCancel: () => void; 
  isLoading: boolean;
}) {
  const { t } = useI18n();
  
  const form = useForm<CatalogFormValues>({
    resolver: zodResolver(catalogFormSchema),
    defaultValues: {
      category: component?.category || "MODULE",
      manufacturer: component?.manufacturer || "",
      model: component?.model || "",
      unitCost: component?.unitCost || 0,
      unitSellPrice: component?.unitSellPrice || 0,
      active: component?.active ?? true,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("catalog.category")} *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-category">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categoryValues.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {getCategoryLabel(cat.value, t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="manufacturer"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("catalog.manufacturer")} *</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Canadian Solar" {...field} data-testid="input-manufacturer" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="model"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("catalog.model")} *</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: CS6R-410MS" {...field} data-testid="input-model" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="unitCost"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("catalog.unitCost")}</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} data-testid="input-unit-cost" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="unitSellPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("catalog.sellPrice")}</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} data-testid="input-unit-sell" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="active"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">{t("catalog.active")}</FormLabel>
                <p className="text-sm text-muted-foreground">
                  {t("catalog.activeDescription")}
                </p>
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
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={isLoading} data-testid="button-save-component">
            {isLoading ? t("common.loading") : t("common.save")}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default function CatalogPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<ComponentCatalog | null>(null);
  const [activeTab, setActiveTab] = useState("MODULE");

  const { data: catalog, isLoading } = useQuery<ComponentCatalog[]>({
    queryKey: ["/api/catalog"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: CatalogFormValues) => {
      return apiRequest("POST", "/api/catalog", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/catalog"] });
      setDialogOpen(false);
      toast({ title: t("catalog.componentAdded") });
    },
    onError: () => {
      toast({ title: t("catalog.addError"), variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: CatalogFormValues & { id: string }) => {
      const { id, ...rest } = data;
      return apiRequest("PATCH", `/api/catalog/${id}`, rest);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/catalog"] });
      setEditingComponent(null);
      toast({ title: t("catalog.componentUpdated") });
    },
    onError: () => {
      toast({ title: t("catalog.updateError"), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/catalog/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/catalog"] });
      toast({ title: t("catalog.componentDeleted") });
    },
    onError: () => {
      toast({ title: t("catalog.deleteError"), variant: "destructive" });
    },
  });

  const filteredCatalog = catalog?.filter(c => c.category === activeTab) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("nav.catalog")}</h1>
          <p className="text-muted-foreground mt-1">{t("catalog.subtitle")}</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-add-component">
              <Plus className="w-4 h-4" />
              {t("catalog.addComponent")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("catalog.addComponent")}</DialogTitle>
            </DialogHeader>
            <CatalogForm
              onSubmit={(data) => createMutation.mutate(data)}
              onCancel={() => setDialogOpen(false)}
              isLoading={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {categoryValues.map((cat) => (
            <TabsTrigger key={cat.value} value={cat.value} data-testid={`tab-${cat.value.toLowerCase()}`}>
              <cat.icon className="w-4 h-4 mr-2" />
              {getCategoryLabel(cat.value, t)}
            </TabsTrigger>
          ))}
        </TabsList>

        {categoryValues.map((cat) => (
          <TabsContent key={cat.value} value={cat.value} className="mt-6">
            {isLoading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-10 h-10 rounded-lg" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredCatalog.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCatalog.map((component) => (
                  <ComponentCard
                    key={component.id}
                    component={component}
                    onEdit={() => setEditingComponent(component)}
                    onDelete={() => deleteMutation.mutate(component.id)}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <cat.icon className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                  <p className="text-muted-foreground">{t("catalog.noComponents")}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={!!editingComponent} onOpenChange={(open) => !open && setEditingComponent(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("catalog.editComponent")}</DialogTitle>
          </DialogHeader>
          {editingComponent && (
            <CatalogForm
              component={editingComponent}
              onSubmit={(data) => updateMutation.mutate({ ...data, id: editingComponent.id })}
              onCancel={() => setEditingComponent(null)}
              isLoading={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
