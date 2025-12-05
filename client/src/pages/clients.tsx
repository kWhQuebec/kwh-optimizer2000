import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { Plus, Users, Mail, Phone, MapPin, Building2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
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
});

type ClientFormValues = z.infer<typeof clientFormSchema>;

interface ClientWithSites extends Client {
  sites: Site[];
}

function ClientCard({ client, onEdit, onDelete }: { client: ClientWithSites; onEdit: () => void; onDelete: () => void }) {
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

        <div className="grid grid-cols-2 gap-4">
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
        </div>

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
                <FormLabel>Code postal</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-client-postal" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

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

export default function ClientsPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const { data: clients, isLoading } = useQuery<ClientWithSites[]>({
    queryKey: ["/api/clients"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: ClientFormValues) => {
      return apiRequest("POST", "/api/clients", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: t("clients.clientDeleted") });
    },
    onError: () => {
      toast({ title: t("clients.deleteError"), variant: "destructive" });
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
          <p className="text-muted-foreground mt-1">{t("clients.subtitle")}</p>
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
    </div>
  );
}
