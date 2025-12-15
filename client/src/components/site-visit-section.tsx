import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Calendar,
  Building2,
  Zap,
  TreePine,
  ClipboardList,
  Plus,
  Loader2,
  Save,
  Trash2,
  Edit3,
  ChevronDown,
  ChevronUp,
  DollarSign,
  CheckCircle2,
  Clock,
  XCircle,
  User,
  Lock,
  Settings,
  FileText,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SiteVisit } from "@shared/schema";

interface SiteVisitSectionProps {
  siteId: string;
  siteLat?: number | null;
  siteLng?: number | null;
  designAgreementStatus?: string | null;
}

interface EstimatedCost {
  numBuildings: number;
  travelDays: number;
  travel: number;
  visit: number;
  evaluation: number;
  diagrams: number;
  sldSupplement: number;
  total: number;
}

const visitFormSchema = z.object({
  siteId: z.string(),
  visitDate: z.string().optional(),
  visitedBy: z.string().optional(),
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]).default("scheduled"),
  notes: z.string().optional(),
  gpsLatitude: z.number().optional().nullable(),
  gpsLongitude: z.number().optional().nullable(),
  siteContactName: z.string().optional(),
  siteContactPhone: z.string().optional(),
  siteContactEmail: z.string().optional(),
  meterNumbers: z.string().optional(),
  numberOfMeters: z.number().optional().nullable(),
  roofType: z.string().optional(),
  roofTypeOther: z.string().optional(),
  buildingHeight: z.number().optional().nullable(),
  parapetHeight: z.number().optional().nullable(),
  roofSlope: z.number().optional().nullable(),
  roofMaterial: z.string().optional(),
  roofMaterialOther: z.string().optional(),
  roofAge: z.number().optional().nullable(),
  roofSurfaceAreaSqM: z.number().optional().nullable(),
  anchoringPossible: z.boolean().optional(),
  anchoringNotes: z.string().optional(),
  lightningRodPresent: z.boolean().optional(),
  pvReservedAreas: z.string().optional(),
  roofAccessible: z.boolean().optional(),
  accessMethod: z.string().optional(),
  accessNotes: z.string().optional(),
  hasObstacles: z.boolean().optional(),
  treesPresent: z.boolean().optional(),
  treeNotes: z.string().optional(),
  otherObstacles: z.string().optional(),
  adjacentRoofsSameLevel: z.boolean().optional(),
  technicalRoomCovered: z.boolean().optional(),
  technicalRoomSpace: z.string().optional(),
  technicalRoomDistance: z.number().optional().nullable(),
  injectionPointPosition: z.string().optional(),
  mainPanelPower: z.string().optional(),
  mainPanelVoltage: z.string().optional(),
  hqMeterNumber: z.string().optional(),
  sldMainAvailable: z.boolean().optional(),
  sldMainNeedsUpdate: z.boolean().optional(),
  sldSecondaryAvailable: z.boolean().optional(),
  sldSecondaryNeedsUpdate: z.boolean().optional(),
  mainPanelManufacturer: z.string().optional(),
  mainPanelModel: z.string().optional(),
  mainBreakerManufacturer: z.string().optional(),
  mainBreakerModel: z.string().optional(),
  circuitBreakerManufacturer: z.string().optional(),
  circuitBreakerModel: z.string().optional(),
  disconnectSwitchManufacturer: z.string().optional(),
  disconnectSwitchModel: z.string().optional(),
  secondaryPanelManufacturer: z.string().optional(),
  secondaryPanelModel: z.string().optional(),
  secondaryBreakerManufacturer: z.string().optional(),
  secondaryBreakerModel: z.string().optional(),
  secondaryDisconnectManufacturer: z.string().optional(),
  secondaryDisconnectModel: z.string().optional(),
  secondaryEquipmentNotes: z.string().optional(),
  photosTaken: z.boolean().optional(),
  documentsCollected: z.object({
    electricalDrawings: z.boolean().optional(),
    meterDetails: z.boolean().optional(),
    other: z.string().optional(),
  }).optional(),
  inspectorSignature: z.string().optional(),
  numBuildings: z.number().default(1),
  travelDays: z.number().default(0),
});

type VisitFormValues = z.infer<typeof visitFormSchema>;

function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  
  switch (status) {
    case "completed":
      return (
        <Badge variant="default" className="gap-1 bg-green-600" data-testid="badge-status-completed">
          <CheckCircle2 className="w-3 h-3" />
          {t("siteVisit.status.completed")}
        </Badge>
      );
    case "in_progress":
      return (
        <Badge variant="secondary" className="gap-1 bg-blue-600 text-white" data-testid="badge-status-in-progress">
          <Clock className="w-3 h-3" />
          {t("siteVisit.status.in_progress")}
        </Badge>
      );
    case "cancelled":
      return (
        <Badge variant="destructive" className="gap-1" data-testid="badge-status-cancelled">
          <XCircle className="w-3 h-3" />
          {t("siteVisit.status.cancelled")}
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="gap-1" data-testid="badge-status-scheduled">
          <Calendar className="w-3 h-3" />
          {t("siteVisit.status.scheduled")}
        </Badge>
      );
  }
}

function CostEstimator({ numBuildings, travelDays, hasSld }: { numBuildings: number; travelDays: number; hasSld: boolean }) {
  const { t, language } = useI18n();
  
  const TRAVEL_COST_PER_DAY = 150;
  const VISIT_COST_PER_BUILDING = 600;
  const EVALUATION_COST_PER_BUILDING = 1000;
  const DIAGRAMS_COST_PER_BUILDING = 1900;
  const SLD_SUPPLEMENT = 100;
  
  const buildings = numBuildings || 1;
  const travel = travelDays || 0;
  
  const breakdown = {
    travel: travel * TRAVEL_COST_PER_DAY,
    visit: buildings * VISIT_COST_PER_BUILDING,
    evaluation: buildings * EVALUATION_COST_PER_BUILDING,
    diagrams: buildings * DIAGRAMS_COST_PER_BUILDING,
    sldSupplement: !hasSld ? buildings * SLD_SUPPLEMENT : 0,
  };
  
  const total = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(language === "fr" ? "fr-CA" : "en-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0,
    }).format(value);
  };
  
  return (
    <Card className="border-dashed">
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-primary" />
          {t("siteVisit.costEstimate")}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        <div className="grid grid-cols-2 gap-2 text-sm">
          {breakdown.travel > 0 && (
            <>
              <span className="text-muted-foreground">{t("siteVisit.travelCost")}</span>
              <span className="text-right font-mono" data-testid="text-travel-cost">{formatCurrency(breakdown.travel)}</span>
            </>
          )}
          <span className="text-muted-foreground">{t("siteVisit.visitCost")}</span>
          <span className="text-right font-mono" data-testid="text-visit-cost">{formatCurrency(breakdown.visit)}</span>
          <span className="text-muted-foreground">{t("siteVisit.evaluationCost")}</span>
          <span className="text-right font-mono" data-testid="text-evaluation-cost">{formatCurrency(breakdown.evaluation)}</span>
          <span className="text-muted-foreground">{t("siteVisit.diagramsCost")}</span>
          <span className="text-right font-mono" data-testid="text-diagrams-cost">{formatCurrency(breakdown.diagrams)}</span>
          {breakdown.sldSupplement > 0 && (
            <>
              <span className="text-muted-foreground">{t("siteVisit.sldSupplement")}</span>
              <span className="text-right font-mono" data-testid="text-sld-supplement">{formatCurrency(breakdown.sldSupplement)}</span>
            </>
          )}
        </div>
        <Separator />
        <div className="flex justify-between items-center font-semibold">
          <span>{t("siteVisit.totalCost")}</span>
          <span className="font-mono text-lg text-primary" data-testid="text-total-cost">{formatCurrency(total)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function calculateEstimatedCost(numBuildings: number, travelDays: number, hasSld: boolean): EstimatedCost {
  const TRAVEL_COST_PER_DAY = 150;
  const VISIT_COST_PER_BUILDING = 600;
  const EVALUATION_COST_PER_BUILDING = 1000;
  const DIAGRAMS_COST_PER_BUILDING = 1900;
  const SLD_SUPPLEMENT = 100;
  
  const buildings = numBuildings || 1;
  const travel = travelDays || 0;
  
  const breakdown = {
    numBuildings: buildings,
    travelDays: travel,
    travel: travel * TRAVEL_COST_PER_DAY,
    visit: buildings * VISIT_COST_PER_BUILDING,
    evaluation: buildings * EVALUATION_COST_PER_BUILDING,
    diagrams: buildings * DIAGRAMS_COST_PER_BUILDING,
    sldSupplement: !hasSld ? buildings * SLD_SUPPLEMENT : 0,
    total: 0,
  };
  
  breakdown.total = breakdown.travel + breakdown.visit + breakdown.evaluation + breakdown.diagrams + breakdown.sldSupplement;
  
  return breakdown;
}

function SiteVisitForm({ 
  siteId, 
  visit, 
  onClose, 
  siteLat, 
  siteLng 
}: { 
  siteId: string; 
  visit?: SiteVisit | null; 
  onClose: () => void;
  siteLat?: number | null;
  siteLng?: number | null;
}) {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const [roofOpen, setRoofOpen] = useState(true);
  const [electricalOpen, setElectricalOpen] = useState(false);
  const [obstaclesOpen, setObstaclesOpen] = useState(false);
  const [techRoomOpen, setTechRoomOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [documentationOpen, setDocumentationOpen] = useState(false);
  
  const existingCost = visit?.estimatedCost as EstimatedCost | null | undefined;
  
  const form = useForm<VisitFormValues>({
    resolver: zodResolver(visitFormSchema),
    defaultValues: {
      siteId,
      visitDate: visit?.visitDate ? new Date(visit.visitDate).toISOString().split('T')[0] : undefined,
      visitedBy: visit?.visitedBy || "",
      status: (visit?.status as VisitFormValues["status"]) || "scheduled",
      notes: visit?.notes || "",
      gpsLatitude: visit?.gpsLatitude ?? siteLat ?? null,
      gpsLongitude: visit?.gpsLongitude ?? siteLng ?? null,
      siteContactName: visit?.siteContactName || "",
      siteContactPhone: visit?.siteContactPhone || "",
      siteContactEmail: visit?.siteContactEmail || "",
      meterNumbers: visit?.meterNumbers || "",
      roofType: visit?.roofType || "",
      roofTypeOther: visit?.roofTypeOther || "",
      buildingHeight: visit?.buildingHeight ?? null,
      parapetHeight: visit?.parapetHeight ?? null,
      roofSlope: visit?.roofSlope ?? null,
      roofMaterial: visit?.roofMaterial || "",
      roofMaterialOther: visit?.roofMaterialOther || "",
      roofAge: visit?.roofAge ?? null,
      anchoringPossible: visit?.anchoringPossible ?? false,
      anchoringNotes: visit?.anchoringNotes || "",
      lightningRodPresent: visit?.lightningRodPresent ?? false,
      pvReservedAreas: visit?.pvReservedAreas || "",
      roofAccessible: visit?.roofAccessible ?? false,
      accessMethod: visit?.accessMethod || "",
      accessNotes: visit?.accessNotes || "",
      hasObstacles: visit?.hasObstacles ?? false,
      treesPresent: visit?.treesPresent ?? false,
      treeNotes: visit?.treeNotes || "",
      otherObstacles: visit?.otherObstacles || "",
      adjacentRoofsSameLevel: visit?.adjacentRoofsSameLevel ?? false,
      technicalRoomCovered: visit?.technicalRoomCovered ?? false,
      technicalRoomSpace: visit?.technicalRoomSpace || "",
      technicalRoomDistance: visit?.technicalRoomDistance ?? null,
      injectionPointPosition: visit?.injectionPointPosition || "",
      mainPanelPower: visit?.mainPanelPower || "",
      mainPanelVoltage: visit?.mainPanelVoltage || "",
      hqMeterNumber: visit?.hqMeterNumber || "",
      sldMainAvailable: visit?.sldMainAvailable ?? false,
      sldMainNeedsUpdate: visit?.sldMainNeedsUpdate ?? false,
      sldSecondaryAvailable: visit?.sldSecondaryAvailable ?? false,
      sldSecondaryNeedsUpdate: visit?.sldSecondaryNeedsUpdate ?? false,
      mainPanelManufacturer: visit?.mainPanelManufacturer || "",
      mainPanelModel: visit?.mainPanelModel || "",
      mainBreakerManufacturer: visit?.mainBreakerManufacturer || "",
      mainBreakerModel: visit?.mainBreakerModel || "",
      circuitBreakerManufacturer: visit?.circuitBreakerManufacturer || "",
      circuitBreakerModel: visit?.circuitBreakerModel || "",
      disconnectSwitchManufacturer: visit?.disconnectSwitchManufacturer || "",
      disconnectSwitchModel: visit?.disconnectSwitchModel || "",
      secondaryPanelManufacturer: visit?.secondaryPanelManufacturer || "",
      secondaryPanelModel: visit?.secondaryPanelModel || "",
      secondaryBreakerManufacturer: visit?.secondaryBreakerManufacturer || "",
      secondaryBreakerModel: visit?.secondaryBreakerModel || "",
      secondaryDisconnectManufacturer: visit?.secondaryDisconnectManufacturer || "",
      secondaryDisconnectModel: visit?.secondaryDisconnectModel || "",
      secondaryEquipmentNotes: visit?.secondaryEquipmentNotes || "",
      numberOfMeters: visit?.numberOfMeters ?? null,
      roofSurfaceAreaSqM: visit?.roofSurfaceAreaSqM ?? null,
      photosTaken: visit?.photosTaken ?? false,
      documentsCollected: {
        electricalDrawings: (visit?.documentsCollected as any)?.electricalDrawings ?? false,
        meterDetails: (visit?.documentsCollected as any)?.meterDetails ?? false,
        other: (visit?.documentsCollected as any)?.other || "",
      },
      inspectorSignature: visit?.inspectorSignature || "",
      numBuildings: existingCost?.numBuildings ?? 1,
      travelDays: existingCost?.travelDays ?? 0,
    },
  });
  
  const numBuildings = form.watch("numBuildings");
  const travelDays = form.watch("travelDays");
  const sldMainAvailable = form.watch("sldMainAvailable");
  const roofType = form.watch("roofType");
  const roofMaterial = form.watch("roofMaterial");
  
  const createMutation = useMutation({
    mutationFn: async (data: VisitFormValues) => {
      const { numBuildings: nb, travelDays: td, ...formData } = data;
      const estimatedCost = calculateEstimatedCost(nb, td, formData.sldMainAvailable ?? false);
      const payload = {
        ...formData,
        visitDate: data.visitDate ? new Date(data.visitDate) : null,
        estimatedCost,
      };
      return apiRequest("POST", "/api/site-visits", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites", siteId] });
      queryClient.invalidateQueries({ queryKey: ["/api/sites", siteId, "visits"] });
      toast({ title: t("siteVisit.created") });
      onClose();
    },
    onError: () => {
      toast({ title: t("siteVisit.createError"), variant: "destructive" });
    },
  });
  
  const updateMutation = useMutation({
    mutationFn: async (data: VisitFormValues) => {
      const { numBuildings: nb, travelDays: td, ...formData } = data;
      const estimatedCost = calculateEstimatedCost(nb, td, formData.sldMainAvailable ?? false);
      const payload = {
        ...formData,
        visitDate: data.visitDate ? new Date(data.visitDate) : null,
        estimatedCost,
      };
      return apiRequest("PATCH", `/api/site-visits/${visit!.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites", siteId] });
      queryClient.invalidateQueries({ queryKey: ["/api/sites", siteId, "visits"] });
      toast({ title: t("siteVisit.updated") });
      onClose();
    },
    onError: () => {
      toast({ title: t("siteVisit.updateError"), variant: "destructive" });
    },
  });
  
  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/site-visits/${visit!.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites", siteId] });
      queryClient.invalidateQueries({ queryKey: ["/api/sites", siteId, "visits"] });
      toast({ title: t("siteVisit.deleted") });
      onClose();
    },
    onError: () => {
      toast({ title: t("siteVisit.deleteError"), variant: "destructive" });
    },
  });
  
  const onSubmit = (data: VisitFormValues) => {
    if (visit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };
  
  const isPending = createMutation.isPending || updateMutation.isPending;
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="visitDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("siteVisit.scheduledFor")}</FormLabel>
                <FormControl>
                  <Input type="date" {...field} data-testid="input-visit-date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="visitedBy"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("siteVisit.visitedBy")}</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Rematek" data-testid="input-visited-by" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("siteVisit.status")}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-visit-status">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="scheduled">{t("siteVisit.status.scheduled")}</SelectItem>
                    <SelectItem value="in_progress">{t("siteVisit.status.in_progress")}</SelectItem>
                    <SelectItem value="completed">{t("siteVisit.status.completed")}</SelectItem>
                    <SelectItem value="cancelled">{t("siteVisit.status.cancelled")}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="grid grid-cols-2 gap-2">
            <FormField
              control={form.control}
              name="numBuildings"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("siteVisit.buildingCount")}</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min={1} 
                      {...field} 
                      onChange={e => field.onChange(parseInt(e.target.value) || 1)}
                      data-testid="input-building-count" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="travelDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("siteVisit.travelDays")}</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min={0} 
                      {...field} 
                      onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                      data-testid="input-travel-days" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        
        <CostEstimator numBuildings={numBuildings} travelDays={travelDays} hasSld={sldMainAvailable ?? false} />
        
        <Collapsible open={roofOpen} onOpenChange={setRoofOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between" type="button" data-testid="button-expand-roof">
              <span className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                {t("siteVisit.roofInfo")}
              </span>
              {roofOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="roofType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("siteVisit.roofType")}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-roof-type">
                          <SelectValue placeholder={language === "fr" ? "Sélectionner" : "Select"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="flat">{t("siteVisit.roofType.flat")}</SelectItem>
                        <SelectItem value="inclined">{t("siteVisit.roofType.sloped")}</SelectItem>
                        <SelectItem value="other">{language === "fr" ? "Autre" : "Other"}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {roofType === "other" && (
                <FormField
                  control={form.control}
                  name="roofTypeOther"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Préciser" : "Specify"}</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-roof-type-other" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              <FormField
                control={form.control}
                name="buildingHeight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("siteVisit.roofHeight")}</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.1"
                        {...field} 
                        value={field.value ?? ""}
                        onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                        data-testid="input-building-height" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="parapetHeight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "fr" ? "Hauteur parapet (m)" : "Parapet Height (m)"}</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.1"
                        {...field} 
                        value={field.value ?? ""}
                        onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                        data-testid="input-parapet-height" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="roofMaterial"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("siteVisit.roofMaterial")}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-roof-material">
                          <SelectValue placeholder={language === "fr" ? "Sélectionner" : "Select"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="concrete">{language === "fr" ? "Béton" : "Concrete"}</SelectItem>
                        <SelectItem value="steel_deck">{language === "fr" ? "Pont d'acier" : "Steel Deck"}</SelectItem>
                        <SelectItem value="wood">{language === "fr" ? "Bois" : "Wood"}</SelectItem>
                        <SelectItem value="other">{language === "fr" ? "Autre" : "Other"}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {roofMaterial === "other" && (
                <FormField
                  control={form.control}
                  name="roofMaterialOther"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Préciser" : "Specify"}</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-roof-material-other" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              <FormField
                control={form.control}
                name="roofAge"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("siteVisit.roofAge")}</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        value={field.value ?? ""}
                        onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                        data-testid="input-roof-age" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="roofSlope"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "fr" ? "Pente (%)" : "Slope (%)"}</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.1"
                        {...field} 
                        value={field.value ?? ""}
                        onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                        data-testid="input-roof-slope" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="roofSurfaceAreaSqM"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("siteVisit.roofSurfaceArea")}</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.1"
                        {...field} 
                        value={field.value ?? ""}
                        onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                        data-testid="input-roof-surface-area" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="space-y-3">
              <FormField
                control={form.control}
                name="anchoringPossible"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <FormLabel>{language === "fr" ? "Ancrage pénétrant possible" : "Penetrating anchoring possible"}</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-anchoring-possible"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="lightningRodPresent"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <FormLabel>{language === "fr" ? "Paratonnerre présent" : "Lightning rod present"}</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-lightning-rod"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="anchoringNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{language === "fr" ? "Notes d'ancrage" : "Anchoring Notes"}</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder={language === "fr" ? "Ballast, pénétrant, détails..." : "Ballast, penetrating, details..."}
                      data-testid="textarea-anchoring-notes" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="pvReservedAreas"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{language === "fr" ? "Zones réservées PV" : "PV Reserved Areas"}</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder={language === "fr" ? "Zones identifiées pour l'installation PV..." : "Areas identified for PV installation..."}
                      data-testid="textarea-pv-reserved" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CollapsibleContent>
        </Collapsible>
        
        <Collapsible open={accessOpen} onOpenChange={setAccessOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between" type="button" data-testid="button-expand-access">
              <span className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                {language === "fr" ? "Accessibilité" : "Accessibility"}
              </span>
              {accessOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="roofAccessible"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <FormLabel>{language === "fr" ? "Toit accessible" : "Roof accessible"}</FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-roof-accessible"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="accessMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{language === "fr" ? "Méthode d'accès" : "Access Method"}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-access-method">
                        <SelectValue placeholder={language === "fr" ? "Sélectionner" : "Select"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ladder">{language === "fr" ? "Échelle" : "Ladder"}</SelectItem>
                      <SelectItem value="trapdoor">{language === "fr" ? "Trappe" : "Trapdoor"}</SelectItem>
                      <SelectItem value="stairs">{language === "fr" ? "Escalier" : "Stairs"}</SelectItem>
                      <SelectItem value="lift">{t("siteVisit.accessMethod.lift")}</SelectItem>
                      <SelectItem value="other">{language === "fr" ? "Autre" : "Other"}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="accessNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{language === "fr" ? "Notes d'accès" : "Access Notes"}</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder={language === "fr" ? "Détails sur l'accès au toit..." : "Details about roof access..."}
                      data-testid="textarea-access-notes" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CollapsibleContent>
        </Collapsible>
        
        <Collapsible open={electricalOpen} onOpenChange={setElectricalOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between" type="button" data-testid="button-expand-electrical">
              <span className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                {t("siteVisit.electrical")}
              </span>
              {electricalOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="mainPanelPower"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("siteVisit.mainPanelInfo")}</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder={language === "fr" ? "Ex: 400A, 800A..." : "E.g.: 400A, 800A..."}
                        data-testid="input-panel-power" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="mainPanelVoltage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("siteVisit.mainPanelVoltage")}</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="120/208V, 347/600V..."
                        data-testid="input-panel-voltage" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="mainPanelManufacturer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "fr" ? "Fabricant panneau" : "Panel Manufacturer"}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-panel-manufacturer" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="mainPanelModel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "fr" ? "Modèle panneau" : "Panel Model"}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-panel-model" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="numberOfMeters"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("siteVisit.numberOfMeters")}</FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        min={1}
                        {...field} 
                        value={field.value ?? ""}
                        onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                        data-testid="input-number-of-meters" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="meterNumbers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("siteVisit.meterNumber")}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-meter-numbers" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="hqMeterNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "fr" ? "No compteur HQ" : "HQ Meter No"}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-hq-meter" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="injectionPointPosition"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{language === "fr" ? "Position point d'injection" : "Injection Point Position"}</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-injection-point" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Separator className="my-4" />
            <h4 className="text-sm font-medium">{t("siteVisit.circuitBreaker")}</h4>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="circuitBreakerManufacturer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("siteVisit.manufacturer")}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-circuit-breaker-manufacturer" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="circuitBreakerModel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("siteVisit.model")}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-circuit-breaker-model" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <h4 className="text-sm font-medium">{t("siteVisit.disconnectSwitch")}</h4>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="disconnectSwitchManufacturer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("siteVisit.manufacturer")}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-disconnect-switch-manufacturer" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="disconnectSwitchModel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("siteVisit.model")}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-disconnect-switch-model" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <Separator className="my-4" />
            <h4 className="text-sm font-medium">{t("siteVisit.secondaryPanel")}</h4>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="secondaryPanelManufacturer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("siteVisit.manufacturer")}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-secondary-panel-manufacturer" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="secondaryPanelModel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("siteVisit.model")}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-secondary-panel-model" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <h4 className="text-sm font-medium">{t("siteVisit.secondaryBreaker")}</h4>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="secondaryBreakerManufacturer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("siteVisit.manufacturer")}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-secondary-breaker-manufacturer" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="secondaryBreakerModel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("siteVisit.model")}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-secondary-breaker-model" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <h4 className="text-sm font-medium">{t("siteVisit.secondaryDisconnect")}</h4>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="secondaryDisconnectManufacturer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("siteVisit.manufacturer")}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-secondary-disconnect-manufacturer" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="secondaryDisconnectModel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("siteVisit.model")}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-secondary-disconnect-model" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="space-y-3">
              <FormField
                control={form.control}
                name="sldMainAvailable"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>{t("siteVisit.hasSld")}</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        {language === "fr" 
                          ? "Un schéma unifilaire existant réduit les coûts" 
                          : "An existing single line diagram reduces costs"}
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-sld-available"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              {sldMainAvailable && (
                <FormField
                  control={form.control}
                  name="sldMainNeedsUpdate"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3 ml-4">
                      <FormLabel>{language === "fr" ? "SLD principal nécessite mise à jour" : "Main SLD Needs Update"}</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-sld-needs-update"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
        
        <Collapsible open={obstaclesOpen} onOpenChange={setObstaclesOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between" type="button" data-testid="button-expand-obstacles">
              <span className="flex items-center gap-2">
                <TreePine className="w-4 h-4" />
                {t("siteVisit.obstacles")}
              </span>
              {obstaclesOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            <div className="space-y-3">
              <FormField
                control={form.control}
                name="hasObstacles"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <FormLabel>{language === "fr" ? "Obstacles présents sur le toit" : "Obstacles present on roof"}</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-has-obstacles"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="treesPresent"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <FormLabel>{language === "fr" ? "Arbres à proximité" : "Trees nearby"}</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-trees-present"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="adjacentRoofsSameLevel"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <FormLabel>{language === "fr" ? "Toits adjacents au même niveau" : "Adjacent roofs at same level"}</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-adjacent-roofs"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="otherObstacles"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("siteVisit.obstacleDescription")}</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder={language === "fr" 
                        ? "Cheminées, évents, unités HVAC, parapets..." 
                        : "Chimneys, vents, HVAC units, parapets..."}
                      data-testid="textarea-obstacles" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="treeNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("siteVisit.shadingAnalysis")}</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder={language === "fr" 
                        ? "Arbres, bâtiments adjacents, sources d'ombrage..." 
                        : "Trees, adjacent buildings, shading sources..."}
                      data-testid="textarea-shading" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CollapsibleContent>
        </Collapsible>
        
        <Collapsible open={techRoomOpen} onOpenChange={setTechRoomOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between" type="button" data-testid="button-expand-tech-room">
              <span className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                {t("siteVisit.technicalRoom")}
              </span>
              {techRoomOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="technicalRoomCovered"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <FormLabel>{language === "fr" ? "Salle technique couverte" : "Covered technical room"}</FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-tech-room-covered"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="technicalRoomSpace"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("siteVisit.techRoomSpace")}</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder={language === "fr" ? "Dimensions approximatives..." : "Approximate dimensions..."}
                      data-testid="input-tech-room-space" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="technicalRoomDistance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{language === "fr" ? "Distance du PV (m)" : "Distance from PV (m)"}</FormLabel>
                  <FormControl>
                    <Input 
                      type="number"
                      step="0.1"
                      {...field} 
                      value={field.value ?? ""}
                      onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                      data-testid="input-tech-room-distance" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CollapsibleContent>
        </Collapsible>
        
        <Collapsible open={documentationOpen} onOpenChange={setDocumentationOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between" type="button" data-testid="button-expand-documentation">
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {t("siteVisit.documentation")}
              </span>
              {documentationOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="photosTaken"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <FormLabel>{t("siteVisit.photosTaken")}</FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-photos-taken"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            
            <h4 className="text-sm font-medium">{t("siteVisit.documentsCollected")}</h4>
            <div className="space-y-3">
              <FormField
                control={form.control}
                name="documentsCollected.electricalDrawings"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <FormLabel>{t("siteVisit.electricalDrawings")}</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-electrical-drawings"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="documentsCollected.meterDetails"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <FormLabel>{t("siteVisit.meterDetails")}</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-meter-details"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="documentsCollected.other"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("siteVisit.otherDocuments")}</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder={language === "fr" ? "Autres documents collectés..." : "Other documents collected..."}
                        data-testid="input-other-documents" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="inspectorSignature"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("siteVisit.inspectorSignature")}</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder={language === "fr" ? "Nom de l'inspecteur" : "Inspector name"}
                      data-testid="input-inspector-signature" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CollapsibleContent>
        </Collapsible>
        
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("siteVisit.notes")}</FormLabel>
              <FormControl>
                <Textarea 
                  {...field} 
                  placeholder={language === "fr" 
                    ? "Notes générales sur la visite..." 
                    : "General notes about the visit..."}
                  data-testid="textarea-visit-notes" 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <DialogFooter className="gap-2">
          {visit && (
            <Button
              type="button"
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              data-testid="button-delete-visit"
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {t("siteVisit.delete")}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel-visit">
            {t("siteVisit.cancel")}
          </Button>
          <Button type="submit" disabled={isPending} data-testid="button-save-visit">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t("siteVisit.save")}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

export function SiteVisitSection({ siteId, siteLat, siteLng, designAgreementStatus }: SiteVisitSectionProps) {
  const { t, language } = useI18n();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState<SiteVisit | null>(null);
  
  const { data: visits, isLoading } = useQuery<SiteVisit[]>({
    queryKey: ["/api/sites", siteId, "visits"],
  });
  
  // Check if the design agreement is signed (accepted status)
  const isAgreementSigned = designAgreementStatus === "accepted";
  
  const handleNewVisit = () => {
    setEditingVisit(null);
    setDialogOpen(true);
  };
  
  const handleEditVisit = (visit: SiteVisit) => {
    setEditingVisit(visit);
    setDialogOpen(true);
  };
  
  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    const d = new Date(date);
    return d.toLocaleDateString(language === "fr" ? "fr-CA" : "en-CA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            {t("siteVisit.title")}
          </CardTitle>
          <CardDescription>
            {language === "fr" 
              ? "Planifier et documenter les visites techniques sur site" 
              : "Schedule and document on-site technical visits"}
          </CardDescription>
        </div>
        <Button 
          onClick={handleNewVisit} 
          className="gap-1" 
          disabled={!isAgreementSigned}
          data-testid="button-new-site-visit"
        >
          {!isAgreementSigned && <Lock className="w-4 h-4" />}
          {isAgreementSigned && <Plus className="w-4 h-4" />}
          {t("siteVisit.newVisit")}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : visits && visits.length > 0 ? (
          <div className="space-y-3">
            {visits.map((visit) => {
              const cost = visit.estimatedCost as EstimatedCost | null | undefined;
              return (
                <Card key={visit.id} className="cursor-pointer hover-elevate" onClick={() => handleEditVisit(visit)} data-testid={`card-visit-${visit.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-3">
                        <StatusBadge status={visit.status} />
                        <div>
                          <p className="font-medium" data-testid={`text-visit-date-${visit.id}`}>
                            {visit.visitDate ? formatDate(visit.visitDate) : (language === "fr" ? "Date à confirmer" : "Date TBD")}
                          </p>
                          {visit.visitedBy && (
                            <p className="text-sm text-muted-foreground" data-testid={`text-visited-by-${visit.id}`}>{visit.visitedBy}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {cost && cost.numBuildings > 1 && (
                          <Badge variant="secondary" className="gap-1">
                            <Building2 className="w-3 h-3" />
                            {cost.numBuildings} {language === "fr" ? "bâtiments" : "buildings"}
                          </Badge>
                        )}
                        {cost && cost.total > 0 && (
                          <Badge variant="outline" className="gap-1" data-testid={`badge-cost-${visit.id}`}>
                            <DollarSign className="w-3 h-3" />
                            {new Intl.NumberFormat(language === "fr" ? "fr-CA" : "en-CA", {
                              style: "currency",
                              currency: "CAD",
                              maximumFractionDigits: 0,
                            }).format(cost.total)}
                          </Badge>
                        )}
                        <Button size="icon" variant="ghost" data-testid={`button-edit-visit-${visit.id}`}>
                          <Edit3 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    {visit.notes && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2" data-testid={`text-notes-${visit.id}`}>{visit.notes}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : !isAgreementSigned ? (
          <div className="text-center py-8">
            <Lock className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground font-medium" data-testid="text-no-visits">
              {t("siteVisit.noVisits")}
            </p>
            <p className="text-sm text-muted-foreground mt-1" data-testid="text-sign-agreement-first">
              {t("siteVisit.signAgreementFirst")}
            </p>
          </div>
        ) : (
          <div className="text-center py-8">
            <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground" data-testid="text-no-visits">{t("siteVisit.noVisits")}</p>
            <Button variant="ghost" onClick={handleNewVisit} className="mt-2 gap-1" data-testid="button-create-first-visit">
              <Plus className="w-4 h-4" />
              {t("siteVisit.createFirst")}
            </Button>
          </div>
        )}
      </CardContent>
      
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="dialog-title-visit">
              {editingVisit ? t("siteVisit.editVisit") : t("siteVisit.newVisit")}
            </DialogTitle>
            <DialogDescription>
              {language === "fr" 
                ? "Remplissez les informations techniques collectées lors de la visite." 
                : "Fill in the technical information collected during the visit."}
            </DialogDescription>
          </DialogHeader>
          <SiteVisitForm 
            siteId={siteId} 
            visit={editingVisit} 
            onClose={() => setDialogOpen(false)}
            siteLat={siteLat}
            siteLng={siteLng}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
