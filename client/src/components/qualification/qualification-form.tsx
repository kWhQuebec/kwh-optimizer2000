import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Building2,
  User,
  Home,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  Flame,
  Snowflake,
  Target,
  Loader2,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Lead, QualificationFormData } from "@shared/schema";
import { qualificationFormSchema } from "@shared/schema";

interface QualificationFormProps {
  lead: Lead;
  open: boolean;
  onClose: () => void;
  onSuccess?: (result: any) => void;
}

const TRANSLATIONS = {
  fr: {
    title: "Qualification du prospect",
    subtitle: "Évaluez le potentiel et identifiez les bloqueurs",
    sectionA: "A. Potentiel économique",
    sectionB: "B. Droit d'installation",
    sectionC: "C. État du toit",
    sectionD: "D. Capacité de décision",
    monthlyBill: "Facture mensuelle Hydro-Québec",
    monthlyBillDesc: "Montant moyen de la facture d'électricité",
    propertyRelationship: "Relation avec la propriété",
    owner: "Propriétaire",
    tenantAuthorized: "Locataire (autorisé)",
    tenantPending: "Locataire (autorisation en cours)",
    tenantNoAuth: "Locataire (sans autorisation)",
    unknown: "Inconnu",
    landlordName: "Nom du propriétaire",
    landlordEmail: "Courriel du propriétaire",
    landlordPhone: "Téléphone du propriétaire",
    hasAuthorizationLetter: "Lettre d'autorisation obtenue",
    roofAge: "Âge du toit",
    roofAgeNew: "Neuf (0-5 ans)",
    roofAgeRecent: "Récent (5-10 ans)",
    roofAgeMature: "Mature (10-20 ans)",
    roofAgeOld: "Âgé (20+ ans)",
    roofAgeYears: "Âge approximatif (années)",
    roofCondition: "État du toit",
    roofExcellent: "Excellent",
    roofGood: "Bon",
    roofNeedsRepair: "Nécessite réparations",
    roofNeedsReplacement: "Nécessite remplacement",
    plannedRoofWork: "Travaux de toiture prévus (5 ans)",
    plannedRoofWorkDesc: "Description des travaux prévus",
    contactIsDecisionMaker: "Le contact est le décideur",
    decisionMakerName: "Nom du décideur",
    decisionMakerTitle: "Titre du décideur",
    decisionMakerEmail: "Courriel du décideur",
    budgetReadiness: "Disponibilité du budget",
    budgetAllocated: "Budget alloué",
    budgetPossible: "Budget possible",
    budgetNeeded: "Budget à approuver",
    noBudget: "Pas de budget",
    timelineUrgency: "Urgence du projet",
    immediate: "Immédiat",
    thisYear: "Cette année",
    nextYear: "L'an prochain",
    exploring: "En exploration",
    targetDecisionQuarter: "Trimestre cible de décision",
    cancel: "Annuler",
    qualify: "Qualifier",
    qualifying: "Qualification en cours...",
    resultTitle: "Résultat de la qualification",
    score: "Score",
    status: "Statut",
    blockers: "Bloqueurs identifiés",
    nextSteps: "Prochaines étapes suggérées",
    hot: "Chaud",
    warm: "Tiède",
    nurture: "À nourrir",
    cold: "Froid",
    disqualified: "Non qualifié",
    pending: "En attente",
    close: "Fermer",
    economic: "Économique",
    property: "Propriété",
    roof: "Toiture",
    decision: "Décision",
  },
  en: {
    title: "Lead Qualification",
    subtitle: "Assess potential and identify blockers",
    sectionA: "A. Economic Potential",
    sectionB: "B. Installation Rights",
    sectionC: "C. Roof Condition",
    sectionD: "D. Decision Capacity",
    monthlyBill: "Monthly Hydro-Québec Bill",
    monthlyBillDesc: "Average monthly electricity bill",
    propertyRelationship: "Property Relationship",
    owner: "Owner",
    tenantAuthorized: "Tenant (authorized)",
    tenantPending: "Tenant (authorization pending)",
    tenantNoAuth: "Tenant (no authorization)",
    unknown: "Unknown",
    landlordName: "Landlord Name",
    landlordEmail: "Landlord Email",
    landlordPhone: "Landlord Phone",
    hasAuthorizationLetter: "Authorization letter obtained",
    roofAge: "Roof Age",
    roofAgeNew: "New (0-5 years)",
    roofAgeRecent: "Recent (5-10 years)",
    roofAgeMature: "Mature (10-20 years)",
    roofAgeOld: "Old (20+ years)",
    roofAgeYears: "Approximate age (years)",
    roofCondition: "Roof Condition",
    roofExcellent: "Excellent",
    roofGood: "Good",
    roofNeedsRepair: "Needs repair",
    roofNeedsReplacement: "Needs replacement",
    plannedRoofWork: "Planned roof work (5 years)",
    plannedRoofWorkDesc: "Description of planned work",
    contactIsDecisionMaker: "Contact is decision maker",
    decisionMakerName: "Decision Maker Name",
    decisionMakerTitle: "Decision Maker Title",
    decisionMakerEmail: "Decision Maker Email",
    budgetReadiness: "Budget Readiness",
    budgetAllocated: "Budget allocated",
    budgetPossible: "Budget possible",
    budgetNeeded: "Budget needs approval",
    noBudget: "No budget",
    timelineUrgency: "Project Timeline",
    immediate: "Immediate",
    thisYear: "This year",
    nextYear: "Next year",
    exploring: "Exploring",
    targetDecisionQuarter: "Target decision quarter",
    cancel: "Cancel",
    qualify: "Qualify",
    qualifying: "Qualifying...",
    resultTitle: "Qualification Result",
    score: "Score",
    status: "Status",
    blockers: "Identified Blockers",
    nextSteps: "Suggested Next Steps",
    hot: "Hot",
    warm: "Warm",
    nurture: "Nurture",
    cold: "Cold",
    disqualified: "Disqualified",
    pending: "Pending",
    close: "Close",
    economic: "Economic",
    property: "Property",
    roof: "Roof",
    decision: "Decision",
  },
};

const STATUS_COLORS: Record<string, string> = {
  hot: "bg-red-500 text-white",
  warm: "bg-orange-500 text-white",
  nurture: "bg-yellow-500 text-black",
  cold: "bg-blue-500 text-white",
  disqualified: "bg-gray-500 text-white",
  pending: "bg-gray-300 text-gray-700",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  hot: <Flame className="h-4 w-4" />,
  warm: <Target className="h-4 w-4" />,
  nurture: <Clock className="h-4 w-4" />,
  cold: <Snowflake className="h-4 w-4" />,
  disqualified: <AlertTriangle className="h-4 w-4" />,
  pending: <Clock className="h-4 w-4" />,
};

export function QualificationForm({ lead, open, onClose, onSuccess }: QualificationFormProps) {
  const { language } = useI18n();
  const { toast } = useToast();
  const t = TRANSLATIONS[language];
  const [activeTab, setActiveTab] = useState("economic");
  const [result, setResult] = useState<any>(null);

  // Fetch existing qualification data
  const { data: existingData, isLoading: isLoadingExisting } = useQuery<any>({
    queryKey: ["/api/leads", lead.id, "qualification"],
    queryFn: async () => {
      const response = await fetch(`/api/leads/${lead.id}/qualification`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch qualification");
      return response.json();
    },
    enabled: open,
  });

  const form = useForm<QualificationFormData>({
    resolver: zodResolver(qualificationFormSchema),
    defaultValues: {
      estimatedMonthlyBill: lead.estimatedMonthlyBill || null,
      propertyRelationship: (lead as any).propertyRelationship || "unknown",
      landlordName: (lead as any).landlordName || "",
      landlordEmail: "",
      landlordPhone: "",
      hasAuthorizationLetter: false,
      roofAge: (lead as any).roofAge || "unknown",
      roofAgeYearsApprox: (lead as any).roofAgeYears || undefined,
      roofCondition: (lead as any).roofCondition || "unknown",
      plannedRoofWorkNext5Years: false,
      plannedRoofWorkDescription: "",
      contactIsDecisionMaker: (lead as any).decisionAuthority === "decision_maker",
      decisionMakerName: (lead as any).decisionMakerName || "",
      decisionMakerTitle: (lead as any).decisionMakerTitle || "",
      decisionMakerEmail: "",
      budgetReadiness: (lead as any).budgetReadiness || "unknown",
      timelineUrgency: (lead as any).timelineUrgency || "unknown",
      targetDecisionQuarter: "",
    },
  });

  // Populate form with existing qualification data when loaded
  useEffect(() => {
    if (existingData?.qualificationData) {
      const data = existingData.qualificationData;
      form.reset({
        estimatedMonthlyBill: data.estimatedMonthlyBill || null,
        propertyRelationship: data.propertyRelationship || "unknown",
        landlordName: data.landlordName || "",
        landlordEmail: "",
        landlordPhone: "",
        hasAuthorizationLetter: false,
        roofAge: data.roofAge || "unknown",
        roofAgeYearsApprox: data.roofAgeYears || undefined,
        roofCondition: data.roofCondition || "unknown",
        plannedRoofWorkNext5Years: !!data.plannedRoofWork,
        plannedRoofWorkDescription: data.plannedRoofWork || "",
        contactIsDecisionMaker: data.decisionAuthority === "decision_maker",
        decisionMakerName: data.decisionMakerName || "",
        decisionMakerTitle: data.decisionMakerTitle || "",
        decisionMakerEmail: "",
        budgetReadiness: data.budgetReadiness || "unknown",
        timelineUrgency: data.timelineUrgency || "unknown",
        targetDecisionQuarter: "",
      });
    }
    // Also set result from saved data if it exists
    if (existingData?.savedResult?.score) {
      setResult({
        score: existingData.savedResult.score,
        status: existingData.savedResult.status,
        blockers: existingData.savedResult.blockers || [],
        gateScores: existingData.result?.gateScores || { economic: 0, property: 0, roof: 0, decision: 0 },
        suggestedNextSteps: existingData.savedResult.nextSteps || [],
      });
    }
  }, [existingData, form]);

  const qualifyMutation = useMutation({
    mutationFn: async (data: QualificationFormData) => {
      const response = await apiRequest("PUT", `/api/leads/${lead.id}/qualification`, data);
      return response.json();
    },
    onSuccess: (data) => {
      setResult(data.result);
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      toast({
        title: language === "fr" ? "Qualification enregistrée" : "Qualification saved",
        description: language === "fr"
          ? `Score: ${data.result.score}/100 - Statut: ${t[data.result.status as keyof typeof t]}`
          : `Score: ${data.result.score}/100 - Status: ${t[data.result.status as keyof typeof t]}`,
      });
      onSuccess?.(data);
    },
    onError: (error) => {
      toast({
        title: language === "fr" ? "Erreur" : "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: QualificationFormData) => {
    qualifyMutation.mutate(data);
  };

  const propertyRelationship = form.watch("propertyRelationship");
  const plannedRoofWork = form.watch("plannedRoofWorkNext5Years");
  const contactIsDecisionMaker = form.watch("contactIsDecisionMaker");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-qualification">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            {t.title}
          </DialogTitle>
          <DialogDescription>
            {t.subtitle} - {lead.companyName}
          </DialogDescription>
        </DialogHeader>

        {isLoadingExisting ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">
              {language === "fr" ? "Chargement des données..." : "Loading data..."}
            </span>
          </div>
        ) : result ? (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{t.resultTitle}</span>
                  <Badge className={STATUS_COLORS[result.status]} data-testid="badge-qualification-status">
                    {STATUS_ICONS[result.status]}
                    <span className="ml-1">{t[result.status as keyof typeof t]}</span>
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">{t.score}</span>
                    <span className="text-sm font-bold" data-testid="text-qualification-score">{result.score}/100</span>
                  </div>
                  <Progress value={result.score} className="h-3" data-testid="progress-qualification-score" />
                </div>

                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2 bg-muted rounded">
                    <div className="font-medium">{t.economic}</div>
                    <div className="text-lg font-bold">{result.gateScores.economic}/25</div>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <div className="font-medium">{t.property}</div>
                    <div className="text-lg font-bold">{result.gateScores.property}/25</div>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <div className="font-medium">{t.roof}</div>
                    <div className="text-lg font-bold">{result.gateScores.roof}/25</div>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <div className="font-medium">{t.decision}</div>
                    <div className="text-lg font-bold">{result.gateScores.decision}/25</div>
                  </div>
                </div>

                {result.blockers.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      {t.blockers}
                    </h4>
                    <ul className="space-y-2">
                      {result.blockers.map((blocker: any, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <Badge
                            variant={blocker.severity === "critical" ? "destructive" : "secondary"}
                            className="shrink-0"
                          >
                            {blocker.severity}
                          </Badge>
                          <span>{blocker.description}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.suggestedNextSteps.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      {t.nextSteps}
                    </h4>
                    <ul className="space-y-1">
                      {result.suggestedNextSteps.map((step: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <span className="text-muted-foreground">•</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            <DialogFooter>
              <Button onClick={onClose} data-testid="button-close-qualification">
                {t.close}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="economic" className="flex items-center gap-1" data-testid="tab-economic">
                    <DollarSign className="h-4 w-4" />
                    <span className="hidden sm:inline">A</span>
                  </TabsTrigger>
                  <TabsTrigger value="property" className="flex items-center gap-1" data-testid="tab-property">
                    <Home className="h-4 w-4" />
                    <span className="hidden sm:inline">B</span>
                  </TabsTrigger>
                  <TabsTrigger value="roof" className="flex items-center gap-1" data-testid="tab-roof">
                    <Building2 className="h-4 w-4" />
                    <span className="hidden sm:inline">C</span>
                  </TabsTrigger>
                  <TabsTrigger value="decision" className="flex items-center gap-1" data-testid="tab-decision">
                    <User className="h-4 w-4" />
                    <span className="hidden sm:inline">D</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="economic" className="space-y-4 mt-4">
                  <h3 className="font-semibold">{t.sectionA}</h3>
                  <FormField
                    control={form.control}
                    name="estimatedMonthlyBill"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.monthlyBill}</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                            <Input
                              type="number"
                              className="pl-7"
                              placeholder="5000"
                              data-testid="input-monthly-bill"
                              {...field}
                              value={field.value ?? ""}
                              onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                            />
                          </div>
                        </FormControl>
                        <FormDescription>{t.monthlyBillDesc}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {form.watch("estimatedMonthlyBill") && (
                    <Alert>
                      <DollarSign className="h-4 w-4" />
                      <AlertDescription>
                        {form.watch("estimatedMonthlyBill")! >= 10000
                          ? language === "fr" ? "Potentiel élevé!" : "High potential!"
                          : form.watch("estimatedMonthlyBill")! >= 5000
                          ? language === "fr" ? "Bon potentiel" : "Good potential"
                          : form.watch("estimatedMonthlyBill")! >= 2500
                          ? language === "fr" ? "Potentiel marginal" : "Marginal potential"
                          : language === "fr" ? "Potentiel insuffisant" : "Insufficient potential"}
                      </AlertDescription>
                    </Alert>
                  )}
                </TabsContent>

                <TabsContent value="property" className="space-y-4 mt-4">
                  <h3 className="font-semibold">{t.sectionB}</h3>
                  <FormField
                    control={form.control}
                    name="propertyRelationship"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.propertyRelationship}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-property-relationship">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="owner">{t.owner}</SelectItem>
                            <SelectItem value="tenant_authorized">{t.tenantAuthorized}</SelectItem>
                            <SelectItem value="tenant_pending">{t.tenantPending}</SelectItem>
                            <SelectItem value="tenant_no_auth">{t.tenantNoAuth}</SelectItem>
                            <SelectItem value="unknown">{t.unknown}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {(propertyRelationship === "tenant_authorized" ||
                    propertyRelationship === "tenant_pending" ||
                    propertyRelationship === "tenant_no_auth") && (
                    <>
                      <FormField
                        control={form.control}
                        name="landlordName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t.landlordName}</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-landlord-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="landlordEmail"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t.landlordEmail}</FormLabel>
                              <FormControl>
                                <Input type="email" {...field} data-testid="input-landlord-email" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="landlordPhone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t.landlordPhone}</FormLabel>
                              <FormControl>
                                <Input type="tel" {...field} data-testid="input-landlord-phone" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="hasAuthorizationLetter"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                              <FormLabel>{t.hasAuthorizationLetter}</FormLabel>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                </TabsContent>

                <TabsContent value="roof" className="space-y-4 mt-4">
                  <h3 className="font-semibold">{t.sectionC}</h3>
                  <FormField
                    control={form.control}
                    name="roofAge"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.roofAge}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-roof-age">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="new">{t.roofAgeNew}</SelectItem>
                            <SelectItem value="recent">{t.roofAgeRecent}</SelectItem>
                            <SelectItem value="mature">{t.roofAgeMature}</SelectItem>
                            <SelectItem value="old">{t.roofAgeOld}</SelectItem>
                            <SelectItem value="unknown">{t.unknown}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="roofCondition"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.roofCondition}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-roof-condition">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="excellent">{t.roofExcellent}</SelectItem>
                            <SelectItem value="good">{t.roofGood}</SelectItem>
                            <SelectItem value="needs_repair">{t.roofNeedsRepair}</SelectItem>
                            <SelectItem value="needs_replacement">{t.roofNeedsReplacement}</SelectItem>
                            <SelectItem value="unknown">{t.unknown}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="plannedRoofWorkNext5Years"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <FormLabel>{t.plannedRoofWork}</FormLabel>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {plannedRoofWork && (
                    <FormField
                      control={form.control}
                      name="plannedRoofWorkDescription"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.plannedRoofWorkDesc}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-planned-roof-work" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </TabsContent>

                <TabsContent value="decision" className="space-y-4 mt-4">
                  <h3 className="font-semibold">{t.sectionD}</h3>
                  
                  <FormField
                    control={form.control}
                    name="contactIsDecisionMaker"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <FormLabel>{t.contactIsDecisionMaker}</FormLabel>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {!contactIsDecisionMaker && (
                    <>
                      <FormField
                        control={form.control}
                        name="decisionMakerName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t.decisionMakerName}</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-decision-maker-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="decisionMakerTitle"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t.decisionMakerTitle}</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-decision-maker-title" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}

                  <FormField
                    control={form.control}
                    name="budgetReadiness"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.budgetReadiness}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-budget-readiness">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="budget_allocated">{t.budgetAllocated}</SelectItem>
                            <SelectItem value="budget_possible">{t.budgetPossible}</SelectItem>
                            <SelectItem value="budget_needed">{t.budgetNeeded}</SelectItem>
                            <SelectItem value="no_budget">{t.noBudget}</SelectItem>
                            <SelectItem value="unknown">{t.unknown}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="timelineUrgency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.timelineUrgency}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-timeline-urgency">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="immediate">{t.immediate}</SelectItem>
                            <SelectItem value="this_year">{t.thisYear}</SelectItem>
                            <SelectItem value="next_year">{t.nextYear}</SelectItem>
                            <SelectItem value="exploring">{t.exploring}</SelectItem>
                            <SelectItem value="unknown">{t.unknown}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
              </Tabs>

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel-qualification">
                  {t.cancel}
                </Button>
                <Button type="submit" disabled={qualifyMutation.isPending} data-testid="button-submit-qualification">
                  {qualifyMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t.qualifying}
                    </>
                  ) : (
                    t.qualify
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
