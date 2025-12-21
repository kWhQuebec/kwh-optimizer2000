import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { 
  Handshake, 
  Plus, 
  Pencil, 
  Trash2, 
  DollarSign,
  Users,
  CheckCircle,
  MessageSquare,
  Calendar,
  Phone,
  Mail
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Partnership } from "@shared/schema";
import { insertPartnershipSchema } from "@shared/schema";

const PARTNER_TYPES = ["financing", "technical", "distribution", "supplier", "installer", "other"] as const;
const STATUSES = ["initial_contact", "discussion", "negotiation", "pending_signature", "active", "on_hold", "closed"] as const;
const PRIORITIES = ["low", "medium", "high", "critical"] as const;

const PARTNER_TYPE_LABELS: Record<string, { fr: string; en: string }> = {
  financing: { fr: "Financement", en: "Financing" },
  technical: { fr: "Technique", en: "Technical" },
  distribution: { fr: "Distribution", en: "Distribution" },
  supplier: { fr: "Fournisseur", en: "Supplier" },
  installer: { fr: "Installateur", en: "Installer" },
  other: { fr: "Autre", en: "Other" },
};

const STATUS_LABELS: Record<string, { fr: string; en: string }> = {
  initial_contact: { fr: "Premier contact", en: "Initial Contact" },
  discussion: { fr: "En discussion", en: "In Discussion" },
  negotiation: { fr: "Négociation", en: "Negotiation" },
  pending_signature: { fr: "Signature en attente", en: "Pending Signature" },
  active: { fr: "Actif", en: "Active" },
  on_hold: { fr: "En pause", en: "On Hold" },
  closed: { fr: "Terminé", en: "Closed" },
};

const STATUS_COLORS: Record<string, string> = {
  initial_contact: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  discussion: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  negotiation: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  pending_signature: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  active: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  on_hold: "bg-muted text-muted-foreground",
  closed: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const PRIORITY_LABELS: Record<string, { fr: string; en: string }> = {
  low: { fr: "Faible", en: "Low" },
  medium: { fr: "Moyenne", en: "Medium" },
  high: { fr: "Élevée", en: "High" },
  critical: { fr: "Critique", en: "Critical" },
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  critical: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const partnershipFormSchema = insertPartnershipSchema.extend({
  partnerName: z.string().min(1, "Partner name is required"),
  title: z.string().min(1, "Title is required"),
  partnerType: z.string().min(1, "Partner type is required"),
  status: z.string().default("initial_contact"),
  strategicPriority: z.string().default("medium"),
  estimatedAnnualValue: z.coerce.number().optional().nullable(),
  firstContactDate: z.string().optional().nullable(),
  nextFollowUpDate: z.string().optional().nullable(),
  expectedDecisionDate: z.string().optional().nullable(),
});

type PartnershipFormValues = z.infer<typeof partnershipFormSchema>;

export default function Partnerships() {
  const { language } = useI18n();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPartnership, setEditingPartnership] = useState<Partnership | null>(null);
  const [deletePartnership, setDeletePartnership] = useState<Partnership | null>(null);

  const { data: partnerships, isLoading } = useQuery<Partnership[]>({
    queryKey: ["/api/partnerships"],
  });

  const form = useForm<PartnershipFormValues>({
    resolver: zodResolver(partnershipFormSchema),
    defaultValues: {
      partnerName: "",
      partnerType: "technical",
      title: "",
      description: "",
      status: "initial_contact",
      strategicPriority: "medium",
      estimatedAnnualValue: null,
      primaryContactName: "",
      primaryContactEmail: "",
      primaryContactPhone: "",
      primaryContactRole: "",
      notes: "",
      tags: [],
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: PartnershipFormValues) => {
      const payload = {
        ...data,
        firstContactDate: data.firstContactDate ? new Date(data.firstContactDate).toISOString() : null,
        nextFollowUpDate: data.nextFollowUpDate ? new Date(data.nextFollowUpDate).toISOString() : null,
        expectedDecisionDate: data.expectedDecisionDate ? new Date(data.expectedDecisionDate).toISOString() : null,
      };
      return apiRequest("POST", "/api/partnerships", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partnerships"] });
      toast({
        title: language === "fr" ? "Partenariat créé" : "Partnership created",
        description: language === "fr" ? "Le partenariat a été créé avec succès." : "The partnership has been created successfully.",
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: language === "fr" ? "Erreur" : "Error",
        description: language === "fr" ? "Une erreur est survenue." : "An error occurred.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: PartnershipFormValues & { id: string }) => {
      const { id, ...rest } = data;
      const payload = {
        ...rest,
        firstContactDate: rest.firstContactDate ? new Date(rest.firstContactDate).toISOString() : null,
        nextFollowUpDate: rest.nextFollowUpDate ? new Date(rest.nextFollowUpDate).toISOString() : null,
        expectedDecisionDate: rest.expectedDecisionDate ? new Date(rest.expectedDecisionDate).toISOString() : null,
      };
      return apiRequest("PATCH", `/api/partnerships/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partnerships"] });
      toast({
        title: language === "fr" ? "Partenariat mis à jour" : "Partnership updated",
        description: language === "fr" ? "Le partenariat a été mis à jour avec succès." : "The partnership has been updated successfully.",
      });
      setIsDialogOpen(false);
      setEditingPartnership(null);
      form.reset();
    },
    onError: () => {
      toast({
        title: language === "fr" ? "Erreur" : "Error",
        description: language === "fr" ? "Une erreur est survenue." : "An error occurred.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/partnerships/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partnerships"] });
      toast({
        title: language === "fr" ? "Partenariat supprimé" : "Partnership deleted",
        description: language === "fr" ? "Le partenariat a été supprimé avec succès." : "The partnership has been deleted successfully.",
      });
      setDeletePartnership(null);
    },
    onError: () => {
      toast({
        title: language === "fr" ? "Erreur" : "Error",
        description: language === "fr" ? "Une erreur est survenue." : "An error occurred.",
        variant: "destructive",
      });
    },
  });

  const openAddDialog = () => {
    setEditingPartnership(null);
    form.reset({
      partnerName: "",
      partnerType: "technical",
      title: "",
      description: "",
      status: "initial_contact",
      strategicPriority: "medium",
      estimatedAnnualValue: null,
      primaryContactName: "",
      primaryContactEmail: "",
      primaryContactPhone: "",
      primaryContactRole: "",
      notes: "",
      tags: [],
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (partnership: Partnership) => {
    setEditingPartnership(partnership);
    form.reset({
      partnerName: partnership.partnerName,
      partnerType: partnership.partnerType,
      title: partnership.title,
      description: partnership.description || "",
      status: partnership.status,
      strategicPriority: partnership.strategicPriority || "medium",
      estimatedAnnualValue: partnership.estimatedAnnualValue,
      primaryContactName: partnership.primaryContactName || "",
      primaryContactEmail: partnership.primaryContactEmail || "",
      primaryContactPhone: partnership.primaryContactPhone || "",
      primaryContactRole: partnership.primaryContactRole || "",
      notes: partnership.notes || "",
      tags: partnership.tags || [],
      firstContactDate: partnership.firstContactDate ? format(new Date(partnership.firstContactDate), "yyyy-MM-dd") : "",
      nextFollowUpDate: partnership.nextFollowUpDate ? format(new Date(partnership.nextFollowUpDate), "yyyy-MM-dd") : "",
      expectedDecisionDate: partnership.expectedDecisionDate ? format(new Date(partnership.expectedDecisionDate), "yyyy-MM-dd") : "",
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: PartnershipFormValues) => {
    if (editingPartnership) {
      updateMutation.mutate({ ...data, id: editingPartnership.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const totalPartnerships = partnerships?.length || 0;
  const activePartnerships = partnerships?.filter(p => p.status === "active").length || 0;
  const inDiscussionPartnerships = partnerships?.filter(p => ["initial_contact", "discussion", "negotiation", "pending_signature"].includes(p.status)).length || 0;
  const totalEstimatedValue = partnerships?.reduce((sum, p) => sum + (p.estimatedAnnualValue || 0), 0) || 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Handshake className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            {language === "fr" ? "Partenariats" : "Partnerships"}
          </h1>
        </div>
        <Button onClick={openAddDialog} data-testid="button-add-partnership">
          <Plus className="w-4 h-4 mr-2" />
          {language === "fr" ? "Ajouter un partenariat" : "Add Partnership"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-stat-total">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "fr" ? "Total partenariats" : "Total Partnerships"}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPartnerships}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-active">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "fr" ? "Actifs" : "Active"}
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activePartnerships}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-discussion">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "fr" ? "En discussion" : "In Discussion"}
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{inDiscussionPartnerships}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-value">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "fr" ? "Valeur annuelle estimée" : "Est. Annual Value"}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalEstimatedValue.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === "fr" ? "Partenaire" : "Partner"}</TableHead>
                <TableHead>{language === "fr" ? "Type" : "Type"}</TableHead>
                <TableHead>{language === "fr" ? "Statut" : "Status"}</TableHead>
                <TableHead>{language === "fr" ? "Priorité" : "Priority"}</TableHead>
                <TableHead>{language === "fr" ? "Contact principal" : "Primary Contact"}</TableHead>
                <TableHead>{language === "fr" ? "Prochain suivi" : "Next Follow-up"}</TableHead>
                <TableHead className="text-right">{language === "fr" ? "Actions" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partnerships && partnerships.length > 0 ? (
                partnerships.map((partnership) => (
                  <TableRow key={partnership.id} data-testid={`row-partnership-${partnership.id}`}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{partnership.partnerName}</div>
                        <div className="text-sm text-muted-foreground">{partnership.title}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {PARTNER_TYPE_LABELS[partnership.partnerType]?.[language] || partnership.partnerType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[partnership.status] || ""}>
                        {STATUS_LABELS[partnership.status]?.[language] || partnership.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={PRIORITY_COLORS[partnership.strategicPriority || "medium"] || ""}>
                        {PRIORITY_LABELS[partnership.strategicPriority || "medium"]?.[language] || partnership.strategicPriority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {partnership.primaryContactName ? (
                        <div className="space-y-1">
                          <div className="text-sm font-medium">{partnership.primaryContactName}</div>
                          {partnership.primaryContactEmail && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Mail className="w-3 h-3" />
                              {partnership.primaryContactEmail}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {partnership.nextFollowUpDate ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                          {format(new Date(partnership.nextFollowUpDate), "MMM d, yyyy")}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(partnership)}
                          data-testid={`button-edit-${partnership.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletePartnership(partnership)}
                          data-testid={`button-delete-${partnership.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Handshake className="w-12 h-12 opacity-50" />
                      <p>{language === "fr" ? "Aucun partenariat trouvé" : "No partnerships found"}</p>
                      <Button variant="outline" onClick={openAddDialog} data-testid="button-add-first-partnership">
                        <Plus className="w-4 h-4 mr-2" />
                        {language === "fr" ? "Ajouter le premier partenariat" : "Add first partnership"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPartnership
                ? (language === "fr" ? "Modifier le partenariat" : "Edit Partnership")
                : (language === "fr" ? "Nouveau partenariat" : "New Partnership")}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="partnerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Nom du partenaire *" : "Partner Name *"}</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-partner-name" placeholder="Ex: RBC, Rematek" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="partnerType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Type de partenaire *" : "Partner Type *"}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-partner-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PARTNER_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {PARTNER_TYPE_LABELS[type][language]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "fr" ? "Titre *" : "Title *"}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-title" placeholder={language === "fr" ? "Ex: Financement commercial RBC" : "Ex: RBC Commercial Financing"} />
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
                      <Textarea {...field} value={field.value || ""} data-testid="input-description" rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Statut" : "Status"}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-status">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                              {STATUS_LABELS[status][language]}
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
                  name="strategicPriority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Priorité stratégique" : "Strategic Priority"}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "medium"}>
                        <FormControl>
                          <SelectTrigger data-testid="select-priority">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PRIORITIES.map((priority) => (
                            <SelectItem key={priority} value={priority}>
                              {PRIORITY_LABELS[priority][language]}
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
                  name="estimatedAnnualValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Valeur annuelle estimée ($)" : "Est. Annual Value ($)"}</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          value={field.value ?? ""} 
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                          data-testid="input-estimated-value" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">{language === "fr" ? "Contact principal" : "Primary Contact"}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="primaryContactName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === "fr" ? "Nom" : "Name"}</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} data-testid="input-contact-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="primaryContactRole"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === "fr" ? "Rôle" : "Role"}</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} data-testid="input-contact-role" placeholder="Ex: VP Sales" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="primaryContactEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === "fr" ? "Courriel" : "Email"}</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} value={field.value || ""} data-testid="input-contact-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="primaryContactPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === "fr" ? "Téléphone" : "Phone"}</FormLabel>
                        <FormControl>
                          <Input type="tel" {...field} value={field.value || ""} data-testid="input-contact-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">{language === "fr" ? "Dates clés" : "Key Dates"}</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="firstContactDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === "fr" ? "Premier contact" : "First Contact"}</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value || ""} data-testid="input-first-contact-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="nextFollowUpDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === "fr" ? "Prochain suivi" : "Next Follow-up"}</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value || ""} data-testid="input-next-followup-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="expectedDecisionDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === "fr" ? "Décision attendue" : "Expected Decision"}</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value || ""} data-testid="input-expected-decision-date" />
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
                    <FormLabel>{language === "fr" ? "Notes" : "Notes"}</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={field.value || ""} data-testid="input-notes" rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} data-testid="button-cancel">
                  {language === "fr" ? "Annuler" : "Cancel"}
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit"
                >
                  {(createMutation.isPending || updateMutation.isPending) 
                    ? (language === "fr" ? "Enregistrement..." : "Saving...")
                    : (editingPartnership 
                        ? (language === "fr" ? "Mettre à jour" : "Update")
                        : (language === "fr" ? "Créer" : "Create"))}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletePartnership} onOpenChange={() => setDeletePartnership(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === "fr" ? "Supprimer le partenariat ?" : "Delete Partnership?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === "fr" 
                ? `Êtes-vous sûr de vouloir supprimer le partenariat "${deletePartnership?.partnerName}" ? Cette action est irréversible.`
                : `Are you sure you want to delete the partnership "${deletePartnership?.partnerName}"? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              {language === "fr" ? "Annuler" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deletePartnership && deleteMutation.mutate(deletePartnership.id)}
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
