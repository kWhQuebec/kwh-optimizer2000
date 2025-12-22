import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRoute, useLocation, Link } from "wouter";
import {
  ArrowLeft,
  Calendar,
  Building2,
  Zap,
  TreePine,
  ClipboardList,
  Loader2,
  Save,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  Mail,
  User,
  Ruler,
  Camera,
  FileText,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Wifi,
  WifiOff,
  Home,
  Settings,
  PenTool,
  Upload,
  X,
  Image,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Site, SiteVisit } from "@shared/schema";

const visitFormSchema = z.object({
  siteId: z.string(),
  visitDate: z.string().optional(),
  visitedBy: z.string().optional(),
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]).default("in_progress"),
  notes: z.string().optional(),
  gpsLatitude: z.number().optional().nullable(),
  gpsLongitude: z.number().optional().nullable(),
  siteContactName: z.string().optional(),
  siteContactPhone: z.string().optional(),
  siteContactEmail: z.string().optional(),
  numberOfMeters: z.number().optional().nullable(),
  meterNumbers: z.string().optional(),
  roofType: z.string().optional(),
  roofTypeOther: z.string().optional(),
  roofSurfaceAreaSqM: z.number().optional().nullable(),
  buildingHeight: z.number().optional().nullable(),
  roofMaterial: z.string().optional(),
  roofMaterialOther: z.string().optional(),
  roofAge: z.number().optional().nullable(),
  anchoringMethod: z.string().optional(),
  anchoringPossible: z.boolean().optional(),
  anchoringNotes: z.string().optional(),
  lightningRodPresent: z.boolean().optional(),
  hasObstacles: z.boolean().optional(),
  treesPresent: z.boolean().optional(),
  treeNotes: z.string().optional(),
  otherObstacles: z.string().optional(),
  parapetHeight: z.number().optional().nullable(),
  solarCarportCandidate: z.boolean().optional(),
  solarCarportArea: z.number().optional().nullable(),
  roofAccessible: z.boolean().optional(),
  accessMethod: z.string().optional(),
  accessNotes: z.string().optional(),
  storageLocations: z.string().optional(),
  technicalRoomCovered: z.boolean().optional(),
  technicalRoomSpace: z.string().optional(),
  technicalRoomDistance: z.number().optional().nullable(),
  mainPanelPower: z.string().optional(),
  mainPanelVoltage: z.string().optional(),
  sldMainAvailable: z.boolean().optional(),
  sldMainNeedsUpdate: z.boolean().optional(),
  sldSecondaryAvailable: z.boolean().optional(),
  sldSecondaryNeedsUpdate: z.boolean().optional(),
  mainPanelManufacturer: z.string().optional(),
  mainPanelModel: z.string().optional(),
  mainBreakerManufacturer: z.string().optional(),
  mainBreakerModel: z.string().optional(),
  disconnectSwitchManufacturer: z.string().optional(),
  disconnectSwitchModel: z.string().optional(),
  distributionPanelManufacturer: z.string().optional(),
  distributionPanelModel: z.string().optional(),
  transformerInfo: z.string().optional(),
  nearestTransmissionLine: z.string().optional(),
  electricalRoomSpace: z.boolean().optional(),
  secondaryPanelManufacturer: z.string().optional(),
  secondaryPanelModel: z.string().optional(),
  secondaryBreakerManufacturer: z.string().optional(),
  secondaryBreakerModel: z.string().optional(),
  secondaryDisconnectManufacturer: z.string().optional(),
  secondaryDisconnectModel: z.string().optional(),
  photosTaken: z.boolean().optional(),
  documentsCollected: z.object({
    electricalDrawings: z.boolean().optional(),
    meterDetails: z.boolean().optional(),
    other: z.string().optional(),
  }).optional(),
  inspectorSignature: z.string().optional(),
});

type VisitFormValues = z.infer<typeof visitFormSchema>;

function CollapsibleSection({ 
  title, 
  icon: Icon, 
  children, 
  defaultOpen = false,
  progress 
}: { 
  title: string; 
  icon: React.ElementType; 
  children: React.ReactNode; 
  defaultOpen?: boolean;
  progress?: { filled: number; total: number };
}) {
  const [open, setOpen] = useState(defaultOpen);
  
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button 
          variant="ghost" 
          className="w-full justify-between py-4 h-auto"
          type="button"
        >
          <span className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <span className="font-medium">{title}</span>
          </span>
          <div className="flex items-center gap-2">
            {progress && (
              <Badge variant="secondary" className="text-xs">
                {progress.filled}/{progress.total}
              </Badge>
            )}
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pb-4 space-y-4 px-1">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function SignatureCanvas({ 
  value, 
  onChange 
}: { 
  value?: string; 
  onChange: (signature: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const { language } = useI18n();
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
      };
      img.src = value;
    }
  }, []);
  
  const getCoordinates = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };
  
  const startDrawing = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };
  
  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    
    const { x, y } = getCoordinates(e);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000000';
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  
  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    const canvas = canvasRef.current;
    if (canvas) {
      onChange(canvas.toDataURL('image/png'));
    }
  };
  
  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onChange('');
  };
  
  return (
    <div className="space-y-2">
      <div className="border rounded-lg overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={400}
          height={150}
          className="w-full touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      <Button 
        type="button" 
        variant="outline" 
        size="sm"
        onClick={clearSignature}
      >
        {language === 'fr' ? 'Effacer' : 'Clear'}
      </Button>
    </div>
  );
}

interface PhotoFile {
  id: string;
  file?: File;
  preview: string;
  category: string;
  uploaded: boolean;
  uploading?: boolean;
}

function InlinePhotoCapture({
  siteId,
  visitId,
  category,
  label,
}: {
  siteId: string;
  visitId?: string;
  category: string;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [photoCount, setPhotoCount] = useState(0);
  const [uploading, setUploading] = useState(false);
  const { language } = useI18n();
  const { toast } = useToast();

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    
    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append("photo", file);
        formData.append("category", category);
        formData.append("siteId", siteId);
        if (visitId) {
          formData.append("visitId", visitId);
        }

        const response = await fetch("/api/site-visits/photos", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        if (response.ok) {
          setPhotoCount(prev => prev + 1);
          toast({
            title: language === 'fr' ? 'Photo ajoutée' : 'Photo added',
            description: label,
          });
        } else {
          throw new Error("Upload failed");
        }
      } catch (error) {
        toast({
          title: language === 'fr' ? "Erreur" : "Error",
          description: language === 'fr' ? "Échec de l'envoi de la photo" : "Failed to upload photo",
          variant: "destructive",
        });
      }
    }
    
    setUploading(false);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const openCamera = () => {
    if (inputRef.current) {
      inputRef.current.setAttribute("capture", "environment");
      inputRef.current.click();
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleCapture}
        data-testid={`input-inline-photo-${category}`}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 px-2 gap-1 text-xs border-primary/30 text-primary hover:bg-primary/10"
        onClick={openCamera}
        disabled={uploading}
        data-testid={`button-inline-photo-${category}`}
      >
        {uploading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Camera className="w-3 h-3" />
        )}
        {photoCount > 0 ? (
          <span>{photoCount}</span>
        ) : (
          <span>{language === 'fr' ? 'Photo' : 'Photo'}</span>
        )}
      </Button>
    </>
  );
}

function PhotoUploader({
  siteId,
  visitId,
  category,
  label,
  maxPhotos = 5,
}: {
  siteId: string;
  visitId?: string;
  category: string;
  label: string;
  maxPhotos?: number;
}) {
  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { language } = useI18n();
  const { toast } = useToast();
  
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const remainingSlots = maxPhotos - photos.length;
    const filesToAdd = Array.from(files).slice(0, remainingSlots);
    
    const newPhotos: PhotoFile[] = filesToAdd.map(file => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      category,
      uploaded: false,
    }));
    
    setPhotos(prev => [...prev, ...newPhotos]);
    
    for (const photo of newPhotos) {
      await uploadPhoto(photo);
    }
    
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };
  
  const uploadPhoto = async (photo: PhotoFile) => {
    if (!photo.file) return;
    
    setPhotos(prev => prev.map(p => 
      p.id === photo.id ? { ...p, uploading: true } : p
    ));
    
    try {
      const formData = new FormData();
      formData.append("photo", photo.file);
      formData.append("category", category);
      formData.append("siteId", siteId);
      if (visitId) {
        formData.append("visitId", visitId);
      }
      
      const response = await fetch("/api/site-visits/photos", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (response.ok) {
        setPhotos(prev => prev.map(p => 
          p.id === photo.id ? { ...p, uploaded: true, uploading: false } : p
        ));
      } else {
        throw new Error("Upload failed");
      }
    } catch (error) {
      toast({
        title: language === 'fr' ? "Erreur" : "Error",
        description: language === 'fr' ? "Échec de l'envoi de la photo" : "Failed to upload photo",
        variant: "destructive",
      });
      setPhotos(prev => prev.map(p => 
        p.id === photo.id ? { ...p, uploading: false } : p
      ));
    }
  };
  
  const removePhoto = (id: string) => {
    setPhotos(prev => {
      const photo = prev.find(p => p.id === id);
      if (photo?.preview) {
        URL.revokeObjectURL(photo.preview);
      }
      return prev.filter(p => p.id !== id);
    });
  };
  
  const captureFromCamera = () => {
    if (inputRef.current) {
      inputRef.current.setAttribute("capture", "environment");
      inputRef.current.click();
    }
  };
  
  const selectFromGallery = () => {
    if (inputRef.current) {
      inputRef.current.removeAttribute("capture");
      inputRef.current.click();
    }
  };
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <Badge variant="secondary" className="text-xs">
          {photos.length}/{maxPhotos}
        </Badge>
      </div>
      
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
        data-testid={`input-photo-${category}`}
      />
      
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map(photo => (
            <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
              <img
                src={photo.preview}
                alt=""
                className="w-full h-full object-cover"
              />
              {photo.uploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                </div>
              )}
              {photo.uploaded && (
                <div className="absolute top-1 right-1">
                  <CheckCircle2 className="w-4 h-4 text-green-500 bg-white rounded-full" />
                </div>
              )}
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="absolute bottom-1 right-1 h-6 w-6"
                onClick={() => removePhoto(photo.id)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
      
      {photos.length < maxPhotos && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 gap-2"
            onClick={captureFromCamera}
            data-testid={`button-camera-${category}`}
          >
            <Camera className="w-4 h-4" />
            {language === 'fr' ? 'Appareil photo' : 'Camera'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 gap-2"
            onClick={selectFromGallery}
            data-testid={`button-gallery-${category}`}
          >
            <Image className="w-4 h-4" />
            {language === 'fr' ? 'Galerie' : 'Gallery'}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function SiteVisitFormPage() {
  const [, params] = useRoute("/app/site-visit/:siteId");
  const [, setLocation] = useLocation();
  const { t, language } = useI18n();
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const siteId = params?.siteId || "";
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  const { data: site, isLoading: siteLoading } = useQuery<Site>({
    queryKey: ["/api/sites", siteId],
    enabled: !!siteId,
  });
  
  const { data: visits } = useQuery<SiteVisit[]>({
    queryKey: ["/api/sites", siteId, "visits"],
    enabled: !!siteId,
  });
  
  const existingVisit = visits?.[0];
  
  const form = useForm<VisitFormValues>({
    resolver: zodResolver(visitFormSchema),
    defaultValues: {
      siteId,
      visitDate: new Date().toISOString().split('T')[0],
      status: "in_progress",
      gpsLatitude: site?.latitude ?? null,
      gpsLongitude: site?.longitude ?? null,
    },
  });
  
  useEffect(() => {
    if (existingVisit) {
      form.reset({
        siteId,
        visitDate: existingVisit.visitDate ? new Date(existingVisit.visitDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        visitedBy: existingVisit.visitedBy || "",
        status: (existingVisit.status as VisitFormValues["status"]) || "in_progress",
        notes: existingVisit.notes || "",
        gpsLatitude: existingVisit.gpsLatitude ?? site?.latitude ?? null,
        gpsLongitude: existingVisit.gpsLongitude ?? site?.longitude ?? null,
        siteContactName: existingVisit.siteContactName || "",
        siteContactPhone: existingVisit.siteContactPhone || "",
        siteContactEmail: existingVisit.siteContactEmail || "",
        numberOfMeters: existingVisit.numberOfMeters ?? null,
        meterNumbers: existingVisit.meterNumbers || "",
        roofType: existingVisit.roofType || "",
        roofTypeOther: existingVisit.roofTypeOther || "",
        roofSurfaceAreaSqM: existingVisit.roofSurfaceAreaSqM ?? null,
        buildingHeight: existingVisit.buildingHeight ?? null,
        roofMaterial: existingVisit.roofMaterial || "",
        roofMaterialOther: existingVisit.roofMaterialOther || "",
        roofAge: existingVisit.roofAge ?? null,
        anchoringPossible: existingVisit.anchoringPossible ?? false,
        anchoringMethod: existingVisit.anchoringMethod || "",
        anchoringNotes: existingVisit.anchoringNotes || "",
        lightningRodPresent: existingVisit.lightningRodPresent ?? false,
        hasObstacles: existingVisit.hasObstacles ?? false,
        treesPresent: existingVisit.treesPresent ?? false,
        treeNotes: existingVisit.treeNotes || "",
        otherObstacles: existingVisit.otherObstacles || "",
        parapetHeight: existingVisit.parapetHeight ?? null,
        roofAccessible: existingVisit.roofAccessible ?? false,
        accessMethod: existingVisit.accessMethod || "",
        accessNotes: existingVisit.accessNotes || "",
        technicalRoomCovered: existingVisit.technicalRoomCovered ?? false,
        technicalRoomSpace: existingVisit.technicalRoomSpace || "",
        technicalRoomDistance: existingVisit.technicalRoomDistance ?? null,
        mainPanelPower: existingVisit.mainPanelPower || "",
        mainPanelVoltage: existingVisit.mainPanelVoltage || "",
        sldMainAvailable: existingVisit.sldMainAvailable ?? false,
        sldMainNeedsUpdate: existingVisit.sldMainNeedsUpdate ?? false,
        sldSecondaryAvailable: existingVisit.sldSecondaryAvailable ?? false,
        sldSecondaryNeedsUpdate: existingVisit.sldSecondaryNeedsUpdate ?? false,
        mainPanelManufacturer: existingVisit.mainPanelManufacturer || "",
        mainPanelModel: existingVisit.mainPanelModel || "",
        mainBreakerManufacturer: existingVisit.mainBreakerManufacturer || "",
        mainBreakerModel: existingVisit.mainBreakerModel || "",
        disconnectSwitchManufacturer: existingVisit.disconnectSwitchManufacturer || "",
        disconnectSwitchModel: existingVisit.disconnectSwitchModel || "",
        secondaryPanelManufacturer: existingVisit.secondaryPanelManufacturer || "",
        secondaryPanelModel: existingVisit.secondaryPanelModel || "",
        secondaryBreakerManufacturer: existingVisit.secondaryBreakerManufacturer || "",
        secondaryBreakerModel: existingVisit.secondaryBreakerModel || "",
        secondaryDisconnectManufacturer: existingVisit.secondaryDisconnectManufacturer || "",
        secondaryDisconnectModel: existingVisit.secondaryDisconnectModel || "",
        photosTaken: existingVisit.photosTaken ?? false,
        documentsCollected: {
          electricalDrawings: (existingVisit.documentsCollected as any)?.electricalDrawings ?? false,
          meterDetails: (existingVisit.documentsCollected as any)?.meterDetails ?? false,
          other: (existingVisit.documentsCollected as any)?.other || "",
        },
        inspectorSignature: existingVisit.inspectorSignature || "",
      });
    }
  }, [existingVisit, site, siteId, form]);
  
  const saveMutation = useMutation({
    mutationFn: async (data: VisitFormValues) => {
      const payload = {
        ...data,
        visitDate: data.visitDate ? new Date(data.visitDate) : null,
      };
      
      if (existingVisit) {
        return apiRequest("PATCH", `/api/site-visits/${existingVisit.id}`, payload);
      } else {
        return apiRequest("POST", "/api/site-visits", payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites", siteId] });
      queryClient.invalidateQueries({ queryKey: ["/api/sites", siteId, "visits"] });
      toast({ 
        title: language === 'fr' ? 'Données sauvegardées' : 'Data saved',
        description: language === 'fr' ? 'Toutes les informations ont été enregistrées.' : 'All information has been saved.'
      });
    },
    onError: () => {
      toast({ 
        title: language === 'fr' ? 'Erreur de sauvegarde' : 'Save error',
        variant: "destructive" 
      });
    },
  });
  
  const completeMutation = useMutation({
    mutationFn: async (data: VisitFormValues) => {
      const payload = {
        ...data,
        status: "completed",
        visitDate: data.visitDate ? new Date(data.visitDate) : null,
      };
      
      if (existingVisit) {
        return apiRequest("PATCH", `/api/site-visits/${existingVisit.id}`, payload);
      } else {
        return apiRequest("POST", "/api/site-visits", payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites", siteId] });
      queryClient.invalidateQueries({ queryKey: ["/api/sites", siteId, "visits"] });
      toast({ 
        title: language === 'fr' ? 'Visite complétée' : 'Visit completed',
        description: language === 'fr' ? 'Le formulaire a été soumis avec succès.' : 'The form has been submitted successfully.'
      });
      setLocation(`/app/sites/${siteId}`);
    },
    onError: () => {
      toast({ 
        title: language === 'fr' ? 'Erreur' : 'Error',
        variant: "destructive" 
      });
    },
  });
  
  const handleSave = () => {
    const data = form.getValues();
    saveMutation.mutate(data);
  };
  
  const handleComplete = () => {
    const data = form.getValues();
    completeMutation.mutate(data);
  };
  
  const getGPSLocation = () => {
    if (!navigator.geolocation) {
      toast({ 
        title: language === 'fr' ? 'GPS non disponible' : 'GPS not available',
        variant: "destructive" 
      });
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        form.setValue('gpsLatitude', position.coords.latitude);
        form.setValue('gpsLongitude', position.coords.longitude);
        toast({ 
          title: language === 'fr' ? 'Position capturée' : 'Location captured'
        });
      },
      () => {
        toast({ 
          title: language === 'fr' ? 'Erreur GPS' : 'GPS Error',
          variant: "destructive" 
        });
      }
    );
  };
  
  const roofType = form.watch("roofType");
  const roofMaterial = form.watch("roofMaterial");
  const accessMethod = form.watch("accessMethod");
  
  if (siteLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-50 bg-background border-b px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href={`/app/sites/${siteId}`}>
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="font-semibold truncate" data-testid="text-site-name">
                {site?.name || (language === 'fr' ? 'Visite de site' : 'Site Visit')}
              </h1>
              <p className="text-xs text-muted-foreground truncate">
                {site?.address}, {site?.city}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Badge variant="secondary" className="gap-1">
                <Wifi className="w-3 h-3" />
                <span className="hidden sm:inline">{language === 'fr' ? 'En ligne' : 'Online'}</span>
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <WifiOff className="w-3 h-3" />
                <span className="hidden sm:inline">{language === 'fr' ? 'Hors ligne' : 'Offline'}</span>
              </Badge>
            )}
          </div>
        </div>
      </header>
      
      <Form {...form}>
        <form className="p-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="w-4 h-4" />
                {language === 'fr' ? 'Informations de visite' : 'Visit Information'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="visitDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === 'fr' ? 'Date' : 'Date'}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-visit-date" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="visitedBy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === 'fr' ? 'Inspecteur' : 'Inspector'}</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Nom" data-testid="input-inspector" />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>
          
          {/* Quick Photo Capture - Prominent Section */}
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Camera className="w-5 h-5 text-primary" />
                {language === 'fr' ? 'Capture de photos' : 'Photo Capture'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {language === 'fr' 
                  ? 'Prenez des photos du site pour documenter votre visite. Cliquez sur une catégorie pour capturer ou téléverser des images.'
                  : 'Take photos of the site to document your visit. Click a category to capture or upload images.'}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <PhotoUploader
                  siteId={siteId}
                  visitId={existingVisit?.id}
                  category="roof"
                  label={language === 'fr' ? 'Toit' : 'Roof'}
                  maxPhotos={10}
                />
                <PhotoUploader
                  siteId={siteId}
                  visitId={existingVisit?.id}
                  category="electrical"
                  label={language === 'fr' ? 'Électrique' : 'Electrical'}
                  maxPhotos={10}
                />
                <PhotoUploader
                  siteId={siteId}
                  visitId={existingVisit?.id}
                  category="meter"
                  label={language === 'fr' ? 'Compteurs' : 'Meters'}
                  maxPhotos={5}
                />
                <PhotoUploader
                  siteId={siteId}
                  visitId={existingVisit?.id}
                  category="general"
                  label={language === 'fr' ? 'Général' : 'General'}
                  maxPhotos={5}
                />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-0 divide-y">
              <CollapsibleSection 
                title={language === 'fr' ? '1. Informations client' : '1. Client Information'} 
                icon={User}
                defaultOpen
              >
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="siteContactName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === 'fr' ? 'Contact technique/bâtiment' : 'Technical/Building Contact'}</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-contact-name" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="siteContactPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === 'fr' ? 'Téléphone' : 'Phone'}</FormLabel>
                          <FormControl>
                            <Input type="tel" {...field} data-testid="input-contact-phone" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="siteContactEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === 'fr' ? 'Courriel' : 'Email'}</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} data-testid="input-contact-email" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </CollapsibleSection>
              
              <CollapsibleSection 
                title={language === 'fr' ? '2. Compteurs électriques' : '2. Electric Meters'} 
                icon={Zap}
              >
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="numberOfMeters"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === 'fr' ? 'Nombre de compteurs' : 'Number of meters'}</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            value={field.value ?? ''} 
                            onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                            data-testid="input-meter-count" 
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="meterNumbers"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center gap-1">
                          <FormLabel>{language === 'fr' ? 'Numéro(s) de compteur' : 'Meter number(s)'}</FormLabel>
                          <InlinePhotoCapture
                            siteId={siteId}
                            visitId={existingVisit?.id}
                            category="meters"
                            label={language === 'fr' ? 'Compteurs' : 'Meters'}
                          />
                        </div>
                        <FormControl>
                          <Input {...field} placeholder={language === 'fr' ? 'Ex: 12345678, 23456789' : 'E.g., 12345678, 23456789'} data-testid="input-meter-numbers" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CollapsibleSection>
              
              <CollapsibleSection 
                title={language === 'fr' ? '3. Informations sur le toit' : '3. Roof Information'} 
                icon={Building2}
              >
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="roofType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === 'fr' ? 'Type de toiture' : 'Roof type'}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-roof-type">
                              <SelectValue placeholder={language === 'fr' ? 'Sélectionner...' : 'Select...'} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="flat">{language === 'fr' ? 'Plate' : 'Flat'}</SelectItem>
                            <SelectItem value="sloped">{language === 'fr' ? 'Pente' : 'Sloped'}</SelectItem>
                            <SelectItem value="other">{language === 'fr' ? 'Autre' : 'Other'}</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  {roofType === 'other' && (
                    <FormField
                      control={form.control}
                      name="roofTypeOther"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === 'fr' ? 'Préciser' : 'Specify'}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-roof-type-other" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="roofSurfaceAreaSqM"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === 'fr' ? 'Surface (m² ou pi²)' : 'Surface (m² or sq ft)'}</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field}
                              value={field.value ?? ''}
                              onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                              data-testid="input-roof-area" 
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="buildingHeight"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === 'fr' ? 'Hauteur bâtiment (m)' : 'Building height (m)'}</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.1"
                              {...field}
                              value={field.value ?? ''}
                              onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                              data-testid="input-building-height" 
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="roofMaterial"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center gap-1">
                          <FormLabel>{language === 'fr' ? 'Type/matériaux de toiture' : 'Roof type/materials'}</FormLabel>
                          <InlinePhotoCapture
                            siteId={siteId}
                            visitId={existingVisit?.id}
                            category="roof"
                            label={language === 'fr' ? 'Matériau de toiture' : 'Roof material'}
                          />
                        </div>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-roof-material">
                              <SelectValue placeholder={language === 'fr' ? 'Sélectionner...' : 'Select...'} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="membrane">{language === 'fr' ? 'Membrane TPO/EPDM' : 'TPO/EPDM Membrane'}</SelectItem>
                            <SelectItem value="metal">{language === 'fr' ? 'Métal' : 'Metal'}</SelectItem>
                            <SelectItem value="gravel">{language === 'fr' ? 'Gravier' : 'Gravel'}</SelectItem>
                            <SelectItem value="shingles">{language === 'fr' ? 'Bardeaux' : 'Shingles'}</SelectItem>
                            <SelectItem value="other">{language === 'fr' ? 'Autre' : 'Other'}</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  {roofMaterial === 'other' && (
                    <FormField
                      control={form.control}
                      name="roofMaterialOther"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === 'fr' ? 'Préciser' : 'Specify'}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-roof-material-other" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}
                  
                  <FormField
                    control={form.control}
                    name="roofAge"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === 'fr' ? 'Âge du toit (années)' : 'Roof age (years)'}</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field}
                            value={field.value ?? ''}
                            onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                            data-testid="input-roof-age" 
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="anchoringMethod"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center gap-1">
                          <FormLabel>{language === 'fr' ? "Méthode d'installation de structure PV" : 'PV structure installation method'}</FormLabel>
                          <InlinePhotoCapture
                            siteId={siteId}
                            visitId={existingVisit?.id}
                            category="roof"
                            label={language === 'fr' ? 'Ancrage' : 'Anchoring'}
                          />
                        </div>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-anchoring-method">
                              <SelectValue placeholder={language === 'fr' ? 'Sélectionner...' : 'Select...'} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ballast">{language === 'fr' ? 'Ballast' : 'Ballast'}</SelectItem>
                            <SelectItem value="anchored">{language === 'fr' ? 'Ancré' : 'Anchored'}</SelectItem>
                            <SelectItem value="not_possible">{language === 'fr' ? 'Pas possible' : 'Not possible'}</SelectItem>
                            <SelectItem value="to_confirm">{language === 'fr' ? 'À confirmer' : 'To confirm'}</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="lightningRodPresent"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-1">
                          <FormLabel>{language === 'fr' ? 'Paratonnerre présent' : 'Lightning rod present'}</FormLabel>
                          <InlinePhotoCapture
                            siteId={siteId}
                            visitId={existingVisit?.id}
                            category="roof"
                            label={language === 'fr' ? 'Paratonnerre' : 'Lightning rod'}
                          />
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-lightning-rod" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="hasObstacles"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-1">
                          <FormLabel>{language === 'fr' ? 'Arbres ou autres obstacles présents' : 'Trees or other obstacles present'}</FormLabel>
                          <InlinePhotoCapture
                            siteId={siteId}
                            visitId={existingVisit?.id}
                            category="obstacles"
                            label={language === 'fr' ? 'Obstacles' : 'Obstacles'}
                          />
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-obstacles" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  {form.watch("hasObstacles") && (
                    <FormField
                      control={form.control}
                      name="otherObstacles"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === 'fr' ? 'Description des obstacles' : 'Obstacle description'}</FormLabel>
                          <FormControl>
                            <Textarea {...field} rows={2} data-testid="input-obstacles-description" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}
                  
                  <FormField
                    control={form.control}
                    name="parapetHeight"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center gap-1">
                          <FormLabel>{language === 'fr' ? 'Hauteur du parapet (m)' : 'Parapet height (m)'}</FormLabel>
                          <InlinePhotoCapture
                            siteId={siteId}
                            visitId={existingVisit?.id}
                            category="roof"
                            label={language === 'fr' ? 'Parapet' : 'Parapet'}
                          />
                        </div>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.1"
                            {...field}
                            value={field.value ?? ''}
                            onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                            data-testid="input-parapet-height" 
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="solarCarportCandidate"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between gap-4">
                        <FormLabel>{language === 'fr' ? 'Bon candidat pour ombrière solaire' : 'Good solar carport candidate'}</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-carport" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  {form.watch("solarCarportCandidate") && (
                    <FormField
                      control={form.control}
                      name="solarCarportArea"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === 'fr' ? 'Surface approximative pour ombrière (m²)' : 'Approximate carport area (m²)'}</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field}
                              value={field.value ?? ''}
                              onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                              data-testid="input-carport-area" 
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </CollapsibleSection>
              
              <CollapsibleSection 
                title={language === 'fr' ? '4. Accessibilité du toit' : '4. Roof Accessibility'} 
                icon={Ruler}
              >
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="accessMethod"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center gap-1">
                          <FormLabel>{language === 'fr' ? "Méthode d'accès" : 'Access method'}</FormLabel>
                          <InlinePhotoCapture
                            siteId={siteId}
                            visitId={existingVisit?.id}
                            category="general"
                            label={language === 'fr' ? 'Accès au toit' : 'Roof access'}
                          />
                        </div>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-access-method">
                              <SelectValue placeholder={language === 'fr' ? 'Sélectionner...' : 'Select...'} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ladder">{language === 'fr' ? 'Échelle' : 'Ladder'}</SelectItem>
                            <SelectItem value="stairs">{language === 'fr' ? 'Escalier' : 'Stairs'}</SelectItem>
                            <SelectItem value="elevator">{language === 'fr' ? 'Ascenseur' : 'Elevator'}</SelectItem>
                            <SelectItem value="other">{language === 'fr' ? 'Autre' : 'Other'}</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  {accessMethod === 'other' && (
                    <FormField
                      control={form.control}
                      name="accessNotes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === 'fr' ? 'Préciser' : 'Specify'}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-access-other" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}
                  
                  <FormField
                    control={form.control}
                    name="accessNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === 'fr' ? 'Contraintes de sécurité / Remarques' : 'Safety constraints / Notes'}</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={2} data-testid="input-safety-notes" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="storageLocations"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === 'fr' ? 'Emplacements entreposage et mise en place matériaux' : 'Material storage and staging locations'}</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={2} data-testid="input-storage-locations" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CollapsibleSection>
              
              <CollapsibleSection 
                title={language === 'fr' ? '5. Espace onduleurs et batteries' : '5. Inverter & Battery Space'} 
                icon={Settings}
              >
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="technicalRoomCovered"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-1">
                          <FormLabel>{language === 'fr' ? 'Espace disponible' : 'Space available'}</FormLabel>
                          <InlinePhotoCapture
                            siteId={siteId}
                            visitId={existingVisit?.id}
                            category="electrical"
                            label={language === 'fr' ? 'Salle technique' : 'Technical room'}
                          />
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-tech-room" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="technicalRoomSpace"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === 'fr' ? 'Emplacement' : 'Location'}</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-tech-room-location" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="technicalRoomDistance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === 'fr' ? 'Distance par rapport au système PV (m)' : 'Distance from PV system (m)'}</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.1"
                            {...field}
                            value={field.value ?? ''}
                            onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                            data-testid="input-tech-room-distance" 
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CollapsibleSection>
              
              <CollapsibleSection 
                title={language === 'fr' ? '6. Distribution électrique principale' : '6. Main Electrical Distribution'} 
                icon={Zap}
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium">{language === 'fr' ? 'Panneau principal' : 'Main panel'}</span>
                    <InlinePhotoCapture
                      siteId={siteId}
                      visitId={existingVisit?.id}
                      category="electrical"
                      label={language === 'fr' ? 'Panneau principal' : 'Main panel'}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="mainPanelPower"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === 'fr' ? 'Puissance nominale' : 'Rated power'}</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Ex: 600A" data-testid="input-main-power" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="mainPanelVoltage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === 'fr' ? 'Tension' : 'Voltage'}</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Ex: 600V" data-testid="input-main-voltage" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="sldMainAvailable"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between gap-4">
                        <FormLabel>{language === 'fr' ? 'Schéma unifilaire disponible' : 'Single-line diagram available'}</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-sld-main" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  {form.watch("sldMainAvailable") && (
                    <FormField
                      control={form.control}
                      name="sldMainNeedsUpdate"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between gap-4 ml-4">
                          <FormLabel className="text-muted-foreground">{language === 'fr' ? 'Nécessite mise à jour' : 'Needs update'}</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-sld-main-update" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}
                  
                  <Separator />
                  <p className="text-sm font-medium text-muted-foreground">{language === 'fr' ? 'Fabricants / Modèles' : 'Manufacturers / Models'}</p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="mainPanelManufacturer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === 'fr' ? 'Panneaux - Fab.' : 'Panels - Mfr.'}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-panel-mfr" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="mainPanelModel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === 'fr' ? 'Modèle' : 'Model'}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-panel-model" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="mainBreakerManufacturer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === 'fr' ? 'Disjoncteurs - Fab.' : 'Breakers - Mfr.'}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-breaker-mfr" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="mainBreakerModel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === 'fr' ? 'Modèle' : 'Model'}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-breaker-model" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="disconnectSwitchManufacturer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === 'fr' ? 'Interrupteurs-sect. - Fab.' : 'Disconnect - Mfr.'}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-disconnect-mfr" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="disconnectSwitchModel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === 'fr' ? 'Modèle' : 'Model'}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-disconnect-model" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="distributionPanelManufacturer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === 'fr' ? 'Armoire dist. - Fab.' : 'Dist. cabinet - Mfr.'}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-dist-mfr" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="distributionPanelModel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === 'fr' ? 'Modèle' : 'Model'}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-dist-model" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="transformerInfo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === 'fr' ? 'Transformateur' : 'Transformer'}</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-transformer" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="nearestTransmissionLine"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === 'fr' ? 'Emplacement ligne transmission/distribution' : 'Transmission/distribution line location'}</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-transmission-line" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="electricalRoomSpace"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between gap-4">
                        <FormLabel>{language === 'fr' ? 'Espace disponible pour interrupteur-sectionneur' : 'Space available for disconnect switch'}</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-elec-room" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CollapsibleSection>
              
              <CollapsibleSection 
                title={language === 'fr' ? '7. Distribution secondaire' : '7. Secondary Distribution'} 
                icon={Zap}
              >
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="sldSecondaryAvailable"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between gap-4">
                        <FormLabel>{language === 'fr' ? 'Schéma unifilaire disponible' : 'Single-line diagram available'}</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-sld-secondary" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  {form.watch("sldSecondaryAvailable") && (
                    <FormField
                      control={form.control}
                      name="sldSecondaryNeedsUpdate"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between gap-4 ml-4">
                          <FormLabel className="text-muted-foreground">{language === 'fr' ? 'Nécessite mise à jour' : 'Needs update'}</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-sld-secondary-update" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}
                  
                  <p className="text-sm font-medium text-muted-foreground">{language === 'fr' ? 'Fabricants / Modèles' : 'Manufacturers / Models'}</p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="secondaryPanelManufacturer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === 'fr' ? 'Panneaux - Fab.' : 'Panels - Mfr.'}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-sec-panel-mfr" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="secondaryPanelModel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === 'fr' ? 'Modèle' : 'Model'}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-sec-panel-model" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="secondaryBreakerManufacturer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === 'fr' ? 'Disjoncteurs - Fab.' : 'Breakers - Mfr.'}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-sec-breaker-mfr" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="secondaryBreakerModel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === 'fr' ? 'Modèle' : 'Model'}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-sec-breaker-model" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="secondaryDisconnectManufacturer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === 'fr' ? 'Interrupteurs - Fab.' : 'Disconnect - Mfr.'}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-sec-disc-mfr" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="secondaryDisconnectModel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === 'fr' ? 'Modèle' : 'Model'}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-sec-disc-model" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </CollapsibleSection>
              
              <CollapsibleSection 
                title={language === 'fr' ? '9. Documentation et photos' : '9. Documentation & Photos'} 
                icon={Camera}
              >
                <div className="space-y-6">
                  <p className="text-sm font-medium text-muted-foreground border-b pb-2">
                    {language === 'fr' ? 'Photos du site' : 'Site Photos'}
                  </p>
                  
                  <PhotoUploader
                    siteId={siteId}
                    visitId={existingVisit?.id}
                    category="roof"
                    label={language === 'fr' ? 'Photos du toit' : 'Roof Photos'}
                    maxPhotos={10}
                  />
                  
                  <PhotoUploader
                    siteId={siteId}
                    visitId={existingVisit?.id}
                    category="electrical"
                    label={language === 'fr' ? 'Équipement électrique (panneaux, disjoncteurs)' : 'Electrical Equipment (panels, breakers)'}
                    maxPhotos={10}
                  />
                  
                  <PhotoUploader
                    siteId={siteId}
                    visitId={existingVisit?.id}
                    category="meter"
                    label={language === 'fr' ? 'Compteurs Hydro-Québec' : 'Hydro-Québec Meters'}
                    maxPhotos={5}
                  />
                  
                  <PhotoUploader
                    siteId={siteId}
                    visitId={existingVisit?.id}
                    category="obstacles"
                    label={language === 'fr' ? 'Obstacles et ombrage' : 'Obstacles & Shading'}
                    maxPhotos={5}
                  />
                  
                  <PhotoUploader
                    siteId={siteId}
                    visitId={existingVisit?.id}
                    category="general"
                    label={language === 'fr' ? 'Photos générales du bâtiment' : 'General Building Photos'}
                    maxPhotos={5}
                  />
                  
                  <Separator className="my-4" />
                  
                  <p className="text-sm font-medium text-muted-foreground">
                    {language === 'fr' ? 'Documents recueillis' : 'Documents collected'}
                  </p>
                  
                  <FormField
                    control={form.control}
                    name="documentsCollected.electricalDrawings"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between gap-4">
                        <FormLabel>{language === 'fr' ? 'Plans électriques' : 'Electrical drawings'}</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-elec-drawings" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="documentsCollected.meterDetails"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between gap-4">
                        <FormLabel>{language === 'fr' ? 'Détails du compteur' : 'Meter details'}</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-meter-details" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="documentsCollected.other"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === 'fr' ? 'Autres documents' : 'Other documents'}</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-other-docs" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === 'fr' ? 'Notes générales' : 'General notes'}</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={4} data-testid="input-notes" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CollapsibleSection>
              
              <CollapsibleSection 
                title={language === 'fr' ? 'Signature de l\'inspecteur' : 'Inspector Signature'} 
                icon={PenTool}
              >
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="inspectorSignature"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === 'fr' ? 'Signez ci-dessous' : 'Sign below'}</FormLabel>
                        <FormControl>
                          <SignatureCanvas 
                            value={field.value} 
                            onChange={field.onChange} 
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex items-center gap-2">
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={getGPSLocation}
                      className="gap-2"
                    >
                      <MapPin className="w-4 h-4" />
                      {language === 'fr' ? 'Capturer GPS' : 'Capture GPS'}
                    </Button>
                    {form.watch("gpsLatitude") && form.watch("gpsLongitude") && (
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                        GPS OK
                      </Badge>
                    )}
                  </div>
                </div>
              </CollapsibleSection>
            </CardContent>
          </Card>
        </form>
      </Form>
      
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 flex gap-3">
        <Button 
          variant="outline" 
          className="flex-1 gap-2"
          onClick={handleSave}
          disabled={saveMutation.isPending}
          data-testid="button-save-draft"
        >
          {saveMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {language === 'fr' ? 'Sauvegarder' : 'Save Draft'}
        </Button>
        <Button 
          className="flex-1 gap-2"
          onClick={handleComplete}
          disabled={completeMutation.isPending}
          data-testid="button-complete-visit"
        >
          {completeMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          {language === 'fr' ? 'Terminer' : 'Complete'}
        </Button>
      </div>
    </div>
  );
}
