import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Phone } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";

interface CallScriptWizardProps {
  leadId: string;
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

const callScriptSchema = z.object({
  businessDriver: z.string().optional(),
  businessDriverNotes: z.string().optional(),
  leaseType: z.string().optional(),
  billPayer: z.string().optional(),
  plannedLoadChanges: z.string().optional(),
  loadChangeTimeline: z.string().optional(),
  procurementProcess: z.string().optional(),
  roofMaterialType: z.string().optional(),
  roofSlope: z.string().optional(),
  roofRemainingLifeYears: z.number().optional(),
  roofWarrantyYears: z.number().optional(),
  leadColor: z.string().optional(),
  leadColorReason: z.string().optional(),
  qualificationNotes: z.string().optional(),
});

type CallScriptFormData = z.infer<typeof callScriptSchema>;

export default function CallScriptWizard({
  leadId,
  open,
  onClose,
  onComplete,
}: CallScriptWizardProps) {
  const { language } = useI18n();
  const { toast } = useToast();
  const [currentTab, setCurrentTab] = useState("introduction");

  const form = useForm<CallScriptFormData>({
    resolver: zodResolver(callScriptSchema),
    defaultValues: {
      businessDriver: "",
      businessDriverNotes: "",
      leaseType: "",
      billPayer: "",
      plannedLoadChanges: "",
      loadChangeTimeline: "",
      procurementProcess: "",
      roofMaterialType: "",
      roofSlope: "",
      roofRemainingLifeYears: undefined,
      roofWarrantyYears: undefined,
      leadColor: "",
      leadColorReason: "",
      qualificationNotes: "",
    },
  });

  const { data: lead, isLoading } = useQuery({
    queryKey: [`/api/leads/${leadId}`],
    queryFn: () => apiRequest("GET", `/api/leads/${leadId}`),
    enabled: !!leadId && open,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: CallScriptFormData) => {
      return await apiRequest(
        "PATCH",
        `/api/leads/${leadId}/business-context`,
        data
      );
    },
    onSuccess: () => {
      toast({
        title: language === "fr" ? "Succès" : "Success",
        description: language === "fr"
          ? "Les informations d'appel ont été enregistrées"
          : "Call script information has been saved",
      });
      onComplete?.();
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: language === "fr" ? "Erreur" : "Error",
        description: language === "fr"
          ? "Impossible d'enregistrer les informations"
          : "Failed to save call script information",
        variant: "destructive",
      });
    },
  });

  async function onSubmit(data: CallScriptFormData) {
    updateMutation.mutate(data);
  }

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            {language === "fr" ? "Appel de qualification" : "Call Script Wizard"}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : lead ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="bg-muted p-4 rounded-lg mb-4">
                <p className="text-sm font-medium">
                  {language === "fr" ? "Prospect" : "Lead"}:{" "}
                  <span className="font-semibold">{(lead as any).companyName || (lead as any).clientName || (lead as any).contactName}</span>
                </p>
                {(lead as any).email && (
                  <p className="text-xs text-muted-foreground">{(lead as any).email}</p>
                )}
              </div>

              <Tabs
                value={currentTab}
                onValueChange={setCurrentTab}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-4 text-xs">
                  <TabsTrigger value="introduction">
                    {language === "fr" ? "Intro" : "Intro"}
                  </TabsTrigger>
                  <TabsTrigger value="business">
                    {language === "fr" ? "Métier" : "Business"}
                  </TabsTrigger>
                  <TabsTrigger value="technical">
                    {language === "fr" ? "Tech" : "Tech"}
                  </TabsTrigger>
                  <TabsTrigger value="notes">
                    {language === "fr" ? "Notes" : "Notes"}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="introduction" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        {language === "fr"
                          ? "Script d'introduction"
                          : "Introduction Script"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        {language === "fr"
                          ? "Outil pour guider votre appel de qualification avec le prospect."
                          : "Tool to guide your qualification call with the prospect."}
                      </p>
                      <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                        <p className="text-sm font-medium">
                          {language === "fr"
                            ? "Points clés à couvrir:"
                            : "Key points to cover:"}
                        </p>
                        <ul className="text-xs mt-2 space-y-1 ml-4 list-disc text-muted-foreground">
                          <li>
                            {language === "fr"
                              ? "Moteur économique de l'entreprise"
                              : "Company's economic driver"}
                          </li>
                          <li>
                            {language === "fr"
                              ? "Type de contrat (location/propriété)"
                              : "Contract type (lease/ownership)"}
                          </li>
                          <li>
                            {language === "fr"
                              ? "État du toit et matériaux"
                              : "Roof condition and materials"}
                          </li>
                          <li>
                            {language === "fr"
                              ? "Processus d'approvisionnement"
                              : "Procurement process"}
                          </li>
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="business" className="space-y-4 mt-4">
                  <FormField
                    control={form.control}
                    name="businessDriver"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {language === "fr"
                            ? "Moteur économique principal"
                            : "Primary Business Driver"}
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value || ""}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  language === "fr"
                                    ? "Sélectionner..."
                                    : "Select..."
                                }
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="cost_reduction">
                              {language === "fr"
                                ? "Réduction des coûts"
                                : "Cost Reduction"}
                            </SelectItem>
                            <SelectItem value="sustainability">
                              {language === "fr"
                                ? "Durabilité"
                                : "Sustainability"}
                            </SelectItem>
                            <SelectItem value="energy_independence">
                              {language === "fr"
                                ? "Indépendance énergétique"
                                : "Energy Independence"}
                            </SelectItem>
                            <SelectItem value="tax_benefits">
                              {language === "fr"
                                ? "Avantages fiscaux"
                                : "Tax Benefits"}
                            </SelectItem>
                            <SelectItem value="other">
                              {language === "fr" ? "Autre" : "Other"}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="businessDriverNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {language === "fr"
                            ? "Détails du moteur économique"
                            : "Business Driver Details"}
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={
                              language === "fr"
                                ? "Expliquer le moteur économique principal..."
                                : "Explain the primary business driver..."
                            }
                            {...field}
                            className="min-h-[80px]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="leaseType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {language === "fr"
                            ? "Type de contrat"
                            : "Lease Type"}
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value || ""}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  language === "fr"
                                    ? "Sélectionner..."
                                    : "Select..."
                                }
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="owner">
                              {language === "fr" ? "Propriétaire" : "Owner"}
                            </SelectItem>
                            <SelectItem value="tenant_authorized">
                              {language === "fr"
                                ? "Locataire (autorisé)"
                                : "Tenant (Authorized)"}
                            </SelectItem>
                            <SelectItem value="tenant_pending">
                              {language === "fr"
                                ? "Locataire (en cours)"
                                : "Tenant (Pending)"}
                            </SelectItem>
                            <SelectItem value="mixed">
                              {language === "fr" ? "Mixte" : "Mixed"}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="billPayer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {language === "fr"
                            ? "Qui paie la facture?"
                            : "Who Pays the Bill?"}
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value || ""}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  language === "fr"
                                    ? "Sélectionner..."
                                    : "Select..."
                                }
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="company">
                              {language === "fr"
                                ? "L'entreprise"
                                : "The Company"}
                            </SelectItem>
                            <SelectItem value="landlord">
                              {language === "fr"
                                ? "Le propriétaire"
                                : "The Landlord"}
                            </SelectItem>
                            <SelectItem value="shared">
                              {language === "fr" ? "Partagée" : "Shared"}
                            </SelectItem>
                            <SelectItem value="unknown">
                              {language === "fr" ? "Inconnu" : "Unknown"}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                <TabsContent value="technical" className="space-y-4 mt-4">
                  <FormField
                    control={form.control}
                    name="roofMaterialType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {language === "fr"
                            ? "Type de toiture"
                            : "Roof Material Type"}
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value || ""}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  language === "fr"
                                    ? "Sélectionner..."
                                    : "Select..."
                                }
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="elastomere">
                              {language === "fr" ? "Membrane élastomère (bitume modifié SBS)" : "Elastomeric membrane (SBS modified bitumen)"}
                            </SelectItem>
                            <SelectItem value="tpo">
                              {language === "fr" ? "TPO (thermoplastique)" : "TPO (thermoplastic)"}
                            </SelectItem>
                            <SelectItem value="epdm">
                              {language === "fr" ? "EPDM (caoutchouc synthétique)" : "EPDM (synthetic rubber)"}
                            </SelectItem>
                            <SelectItem value="bur_gravel">
                              {language === "fr" ? "Asphalte et gravier (multicouche BUR)" : "Asphalt & gravel (BUR built-up)"}
                            </SelectItem>
                            <SelectItem value="metal">
                              {language === "fr" ? "Métal (acier/aluminium)" : "Metal (steel/aluminum)"}
                            </SelectItem>
                            <SelectItem value="other">
                              {language === "fr" ? "Autre (voir notes)" : "Other (see notes)"}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="roofSlope"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {language === "fr" ? "Pente de la toiture" : "Roof Slope"}
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={language === "fr" ? "Sélectionner..." : "Select..."} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="flat">
                              {language === "fr" ? "Plat (< 2°)" : "Flat (< 2°)"}
                            </SelectItem>
                            <SelectItem value="low_slope">
                              {language === "fr" ? "Faible pente (2-15°)" : "Low slope (2-15°)"}
                            </SelectItem>
                            <SelectItem value="steep">
                              {language === "fr" ? "Forte pente (> 15°)" : "Steep (> 15°)"}
                            </SelectItem>
                            <SelectItem value="unknown">
                              {language === "fr" ? "Inconnu" : "Unknown"}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="roofRemainingLifeYears"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {language === "fr" ? "Vie utile restante estimée (années)" : "Estimated Remaining Life (Years)"}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="15"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          {language === "fr"
                            ? "< 5 ans = rouge, 5-15 ans = jaune, > 15 ans = vert"
                            : "< 5 yrs = red, 5-15 yrs = yellow, > 15 yrs = green"}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="roofWarrantyYears"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {language === "fr"
                            ? "Garantie du toit (années)"
                            : "Roof Warranty (Years)"}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="10"
                            {...field}
                            onChange={(e) =>
                              field.onChange(e.target.value ? Number(e.target.value) : undefined)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="plannedLoadChanges"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {language === "fr"
                            ? "Changements de charge prévus?"
                            : "Planned Load Changes?"}
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value || ""}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  language === "fr"
                                    ? "Sélectionner..."
                                    : "Select..."
                                }
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="yes">
                              {language === "fr" ? "Oui" : "Yes"}
                            </SelectItem>
                            <SelectItem value="no">
                              {language === "fr" ? "Non" : "No"}
                            </SelectItem>
                            <SelectItem value="unknown">
                              {language === "fr" ? "Inconnu" : "Unknown"}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="loadChangeTimeline"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {language === "fr"
                            ? "Calendrier des changements"
                            : "Timeline for Changes"}
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={
                              language === "fr"
                                ? "Décrire quand et comment..."
                                : "Describe when and how..."
                            }
                            {...field}
                            className="min-h-[60px]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="procurementProcess"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {language === "fr"
                            ? "Processus d'approvisionnement"
                            : "Procurement Process"}
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={
                              language === "fr"
                                ? "Décrire le processus de prise de décision et les approbations..."
                                : "Describe decision-making process and approvals..."
                            }
                            {...field}
                            className="min-h-[80px]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                <TabsContent value="notes" className="space-y-4 mt-4">
                  {/* Live color badge */}
                  {form.watch("leadColor") && (
                    <div className="flex items-center gap-3 p-4 rounded-lg border-2" style={{
                      backgroundColor: form.watch("leadColor") === "green" ? "#DCFCE7" : form.watch("leadColor") === "yellow" ? "#FEF9C3" : "#FEE2E2",
                      borderColor: form.watch("leadColor") === "green" ? "#16A34A" : form.watch("leadColor") === "yellow" ? "#EAB308" : "#DC2626",
                    }}>
                      <div className="w-5 h-5 rounded-full" style={{
                        backgroundColor: form.watch("leadColor") === "green" ? "#16A34A" : form.watch("leadColor") === "yellow" ? "#EAB308" : "#DC2626",
                      }} />
                      <span className="font-bold text-sm" style={{
                        color: form.watch("leadColor") === "green" ? "#16A34A" : form.watch("leadColor") === "yellow" ? "#92400E" : "#991B1B",
                      }}>
                        {form.watch("leadColor") === "green" ? (language === "fr" ? "VERT — Prospect viable" : "GREEN — Viable prospect") :
                         form.watch("leadColor") === "yellow" ? (language === "fr" ? "JAUNE — À explorer" : "YELLOW — To explore") :
                         (language === "fr" ? "ROUGE — Non viable" : "RED — Not viable")}
                      </span>
                    </div>
                  )}

                  <FormField
                    control={form.control}
                    name="leadColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {language === "fr"
                            ? "Classification du prospect"
                            : "Lead Classification"}
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value || ""}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  language === "fr"
                                    ? "Sélectionner..."
                                    : "Select..."
                                }
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="red">
                              {language === "fr"
                                ? "Rouge (Pas viable)"
                                : "Red (Not Viable)"}
                            </SelectItem>
                            <SelectItem value="yellow">
                              {language === "fr"
                                ? "Jaune (À explorer)"
                                : "Yellow (To Explore)"}
                            </SelectItem>
                            <SelectItem value="green">
                              {language === "fr" ? "Vert (Viable)" : "Green (Viable)"}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="leadColorReason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {language === "fr"
                            ? "Raison de la couleur"
                            : "Reason for Color"}
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={
                              language === "fr"
                                ? "Expliquer pourquoi cette couleur..."
                                : "Explain why this color..."
                            }
                            {...field}
                            className="min-h-[80px]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="qualificationNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {language === "fr"
                            ? "Notes de qualification"
                            : "Qualification Notes"}
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={
                              language === "fr"
                                ? "Notes supplémentaires et points clés de l'appel..."
                                : "Additional notes and call highlights..."
                            }
                            {...field}
                            className="min-h-[100px]"
                          />
                        </FormControl>
                        <FormDescription>
                          {language === "fr"
                            ? "Toutes les informations pertinentes de cet appel"
                            : "All relevant information from this call"}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
              </Tabs>

              <DialogFooter className="gap-2 mt-6">
                <Button type="button" variant="outline" onClick={onClose}>
                  {language === "fr" ? "Annuler" : "Cancel"}
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {language === "fr" ? "Enregistrement..." : "Saving..."}
                    </>
                  ) : (
                    language === "fr" ? "Enregistrer" : "Save"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              {language === "fr" ? "Prospect non trouvé" : "Lead not found"}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
