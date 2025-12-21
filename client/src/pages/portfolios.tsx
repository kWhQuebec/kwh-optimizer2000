import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { 
  Plus, FolderKanban, Building2, MoreHorizontal, Pencil, Trash2, 
  Calculator, Eye, Loader2, DollarSign, TrendingUp, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription 
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Portfolio, Client } from "@shared/schema";

const portfolioFormSchema = z.object({
  name: z.string().min(1, "Ce champ est requis"),
  clientId: z.string().min(1, "Sélectionnez un client"),
  description: z.string().optional(),
});

type PortfolioFormValues = z.infer<typeof portfolioFormSchema>;

interface PortfolioWithClient extends Portfolio {
  client?: Client;
  sites?: { id: string }[];
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("fr-CA", {
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function PortfolioCard({ 
  portfolio, 
  onEdit, 
  onDelete,
  onRecalculate 
}: { 
  portfolio: PortfolioWithClient; 
  onEdit: () => void; 
  onDelete: () => void;
  onRecalculate: () => void;
}) {
  const { language } = useI18n();

  const statusColors: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    quoted: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    accepted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    in_progress: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    completed: "bg-primary/10 text-primary",
  };

  const statusLabels: Record<string, Record<string, string>> = {
    draft: { fr: "Brouillon", en: "Draft" },
    quoted: { fr: "Soumis", en: "Quoted" },
    accepted: { fr: "Accepté", en: "Accepted" },
    in_progress: { fr: "En cours", en: "In Progress" },
    completed: { fr: "Complété", en: "Completed" },
  };

  const status = portfolio.status || "draft";
  // Use dynamic count from sites array, fallback to stored numBuildings
  const numBuildings = portfolio.sites?.length ?? portfolio.numBuildings ?? 0;
  const discount = portfolio.volumeDiscountPercent || 0;

  return (
    <Card className="hover-elevate">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <FolderKanban className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base truncate">{portfolio.name}</CardTitle>
              {portfolio.client && (
                <CardDescription className="truncate">{portfolio.client.name}</CardDescription>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={statusColors[status]}>
              {statusLabels[status]?.[language] || status}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" data-testid={`button-portfolio-menu-${portfolio.id}`}>
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onRecalculate}>
                  <Calculator className="w-4 h-4 mr-2" />
                  {language === "fr" ? "Recalculer" : "Recalculate"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="w-4 h-4 mr-2" />
                  {language === "fr" ? "Modifier" : "Edit"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  {language === "fr" ? "Supprimer" : "Delete"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <span>
              {numBuildings} {language === "fr" ? "bâtiments" : "buildings"}
            </span>
          </div>
          {discount > 0 && (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <DollarSign className="w-4 h-4" />
              <span>-{formatPercent(discount)}</span>
            </div>
          )}
        </div>

        {(portfolio.totalPvSizeKW || portfolio.totalNpv25) && (
          <div className="grid grid-cols-3 gap-2 text-sm border-t pt-3">
            <div className="text-center">
              <div className="text-muted-foreground text-xs">
                {language === "fr" ? "Puissance PV" : "PV Size"}
              </div>
              <div className="font-semibold flex items-center justify-center gap-1">
                <Zap className="w-3 h-3 text-yellow-500" />
                {formatNumber(portfolio.totalPvSizeKW)} kW
              </div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground text-xs">NPV</div>
              <div className="font-semibold text-green-600 dark:text-green-400">
                {formatCurrency(portfolio.totalNpv25)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground text-xs">TRI</div>
              <div className="font-semibold flex items-center justify-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {formatPercent(portfolio.weightedIrr25)}
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Link href={`/app/portfolios/${portfolio.id}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full gap-1.5" data-testid={`button-view-portfolio-${portfolio.id}`}>
              <Eye className="w-3.5 h-3.5" />
              {language === "fr" ? "Voir détails" : "View Details"}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function PortfolioForm({ 
  portfolio, 
  clients,
  onSubmit, 
  onCancel, 
  isLoading 
}: { 
  portfolio?: Portfolio; 
  clients: Client[];
  onSubmit: (data: PortfolioFormValues) => void; 
  onCancel: () => void; 
  isLoading: boolean;
}) {
  const { language } = useI18n();
  
  const form = useForm<PortfolioFormValues>({
    resolver: zodResolver(portfolioFormSchema),
    defaultValues: {
      name: portfolio?.name || "",
      clientId: portfolio?.clientId || "",
      description: portfolio?.description || "",
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
              <FormLabel>{language === "fr" ? "Client" : "Client"} *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-portfolio-client">
                    <SelectValue placeholder={language === "fr" ? "Sélectionnez un client" : "Select a client"} />
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
              <FormLabel>{language === "fr" ? "Nom du projet" : "Project Name"} *</FormLabel>
              <FormControl>
                <Input {...field} placeholder={language === "fr" ? "ex: Évaluation 2026 - Région Montréal" : "e.g., 2026 Assessment - Montreal Region"} data-testid="input-portfolio-name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{language === "fr" ? "Description" : "Description"}</FormLabel>
              <FormControl>
                <Textarea {...field} placeholder={language === "fr" ? "Notes sur ce portfolio..." : "Notes about this portfolio..."} data-testid="input-portfolio-description" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            {language === "fr" ? "Annuler" : "Cancel"}
          </Button>
          <Button type="submit" disabled={isLoading} data-testid="button-save-portfolio">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {language === "fr" ? "Enregistrer" : "Save"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default function PortfoliosPage() {
  const { language } = useI18n();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPortfolio, setEditingPortfolio] = useState<Portfolio | null>(null);

  const { data: portfolios, isLoading } = useQuery<PortfolioWithClient[]>({
    queryKey: ["/api/portfolios"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: PortfolioFormValues) => {
      return apiRequest("POST", "/api/portfolios", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
      setDialogOpen(false);
      toast({ 
        title: language === "fr" ? "Portfolio créé" : "Portfolio created" 
      });
    },
    onError: () => {
      toast({ 
        title: language === "fr" ? "Erreur lors de la création" : "Error creating portfolio", 
        variant: "destructive" 
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: PortfolioFormValues & { id: string }) => {
      const { id, ...rest } = data;
      return apiRequest("PATCH", `/api/portfolios/${id}`, rest);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
      setEditingPortfolio(null);
      toast({ 
        title: language === "fr" ? "Portfolio mis à jour" : "Portfolio updated" 
      });
    },
    onError: () => {
      toast({ 
        title: language === "fr" ? "Erreur lors de la mise à jour" : "Error updating portfolio", 
        variant: "destructive" 
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/portfolios/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
      toast({ 
        title: language === "fr" ? "Portfolio supprimé" : "Portfolio deleted" 
      });
    },
    onError: () => {
      toast({ 
        title: language === "fr" ? "Erreur lors de la suppression" : "Error deleting portfolio", 
        variant: "destructive" 
      });
    },
  });

  const recalculateMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/portfolios/${id}/recalculate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
      toast({ 
        title: language === "fr" ? "Portfolio recalculé" : "Portfolio recalculated" 
      });
    },
    onError: () => {
      toast({ 
        title: language === "fr" ? "Erreur lors du recalcul" : "Error recalculating", 
        variant: "destructive" 
      });
    },
  });

  const handleCreate = (data: PortfolioFormValues) => {
    createMutation.mutate(data);
  };

  const handleUpdate = (data: PortfolioFormValues) => {
    if (editingPortfolio) {
      updateMutation.mutate({ ...data, id: editingPortfolio.id });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {language === "fr" ? "Portfolios" : "Portfolios"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {language === "fr" 
              ? "Gérez les projets multi-bâtiments avec tarification dégressive" 
              : "Manage multi-building projects with volume pricing"}
          </p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-add-portfolio">
              <Plus className="w-4 h-4" />
              {language === "fr" ? "Nouveau portfolio" : "New Portfolio"}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {language === "fr" ? "Créer un portfolio" : "Create Portfolio"}
              </DialogTitle>
              <DialogDescription>
                {language === "fr" 
                  ? "Regroupez plusieurs sites d'un client pour une évaluation groupée avec tarification dégressive." 
                  : "Group multiple sites from a client for a bundled assessment with volume pricing."}
              </DialogDescription>
            </DialogHeader>
            <PortfolioForm
              clients={clients}
              onSubmit={handleCreate}
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
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-xl" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : portfolios && portfolios.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {portfolios.map((portfolio) => (
            <PortfolioCard
              key={portfolio.id}
              portfolio={portfolio}
              onEdit={() => setEditingPortfolio(portfolio)}
              onDelete={() => deleteMutation.mutate(portfolio.id)}
              onRecalculate={() => recalculateMutation.mutate(portfolio.id)}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <FolderKanban className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-1">
              {language === "fr" ? "Aucun portfolio" : "No portfolios"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {language === "fr" 
                ? "Créez un portfolio pour regrouper plusieurs sites d'un même client." 
                : "Create a portfolio to group multiple sites from the same client."}
            </p>
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              {language === "fr" ? "Créer un portfolio" : "Create Portfolio"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editingPortfolio} onOpenChange={(open) => !open && setEditingPortfolio(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {language === "fr" ? "Modifier le portfolio" : "Edit Portfolio"} - {editingPortfolio?.name}
            </DialogTitle>
          </DialogHeader>
          {editingPortfolio && (
            <PortfolioForm
              portfolio={editingPortfolio}
              clients={clients}
              onSubmit={handleUpdate}
              onCancel={() => setEditingPortfolio(null)}
              isLoading={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
