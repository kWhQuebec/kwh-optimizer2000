import { useState, useCallback, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { motion } from "framer-motion";
import { useDropzone } from "react-dropzone";
import useEmblaCarousel from "embla-carousel-react";
import { 
  ArrowLeft, ArrowRight, CheckCircle2, Clock, FileCheck, 
  Shield, Award, BarChart3, Building2, Mail, Phone, User,
  MapPin, DollarSign, FileText, Zap, Battery, Sun, Calendar,
  Upload, X, File, AlertCircle, FileSignature, ChevronLeft, ChevronRight, Image,
  Loader2, ScanLine, Sparkles
} from "lucide-react";
import SignaturePad, { SignaturePadRef } from "@/components/signature-pad";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/lib/i18n";
import { apiRequest } from "@/lib/queryClient";
import logoFr from "@assets/kWh_Quebec_Logo-01_-_Rectangulaire_1764799021536.png";
import logoEn from "@assets/kWh_Quebec_Logo-02_-_Rectangle_1764799021536.png";

import carouselImg1Fr from "@assets/Screenshot_2025-12-11_at_9.14.32_PM_1765505832705.png";
import carouselImg2Fr from "@assets/Screenshot_2025-12-11_at_9.14.51_PM_1765505832704.png";
import carouselImg3Fr from "@assets/Screenshot_2025-12-11_at_9.15.03_PM_1765505832704.png";
import carouselImg4Fr from "@assets/Screenshot_2025-12-11_at_9.15.24_PM_1765505832703.png";
import carouselImg5Fr from "@assets/Screenshot_2025-12-11_at_9.15.38_PM_1765505832702.png";
import carouselImg6Fr from "@assets/Screenshot_2025-12-11_at_9.15.53_PM_1765505832701.png";
import carouselImg7Fr from "@assets/Screenshot_2025-12-11_at_9.16.06_PM_1765505832689.png";

interface HQBillData {
  accountNumber: string | null;
  clientName: string | null;
  serviceAddress: string | null;
  annualConsumptionKwh: number | null;
  peakDemandKw: number | null;
  tariffCode: string | null;
  billingPeriod: string | null;
  estimatedMonthlyBill: number | null;
  confidence: number;
  savedBillPath?: string;
  billNumber: string | null;
  hqAccountNumber: string | null;
  contractNumber: string | null;
  tariffDetail: string | null;
  consumptionHistory: Array<{period: string; kWh: number | null; kW: number | null; amount: number | null; days: number | null}> | null;
}

const detailedFormSchema = z.object({
  companyName: z.string().min(1, "Ce champ est requis"),
  firstName: z.string().min(1, "Ce champ est requis"),
  lastName: z.string().min(1, "Ce champ est requis"),
  signerTitle: z.string().min(1, "Ce champ est requis"),
  email: z.string().email("Courriel invalide"),
  phone: z.string().optional(),
  streetAddress: z.string().min(1, "Ce champ est requis"),
  city: z.string().min(1, "Ce champ est requis"),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  estimatedMonthlyBill: z.coerce.number().optional(),
  buildingType: z.string().optional(),
  roofAgeYears: z.string().optional(),
  ownershipType: z.string().optional(),
  hqClientNumber: z.string().min(1, "Ce champ est requis"),
  tariffCode: z.string().optional(),
  signatureCity: z.string().min(1, "Ce champ est requis"),
  notes: z.string().optional(),
  savedBillPath: z.string().optional(),
  procurationAccepted: z.boolean().refine(val => val === true, {
    message: "Vous devez accepter la procuration pour continuer"
  }),
});

type DetailedFormValues = z.infer<typeof detailedFormSchema>;

interface UploadedFile {
  file: File;
  preview: string;
}

const carouselSlides = [
  {
    image: carouselImg1Fr,
    titleFr: "Impact sur votre facture",
    titleEn: "Impact on your bill",
    descriptionFr: "Visualisez les économies annuelles sur votre facture Hydro-Québec",
    descriptionEn: "Visualize annual savings on your Hydro-Québec bill",
  },
  {
    image: carouselImg2Fr,
    titleFr: "Configuration optimale",
    titleEn: "Optimal configuration",
    descriptionFr: "Système dimensionné pour maximiser votre retour sur investissement",
    descriptionEn: "System sized to maximize your return on investment",
  },
  {
    image: carouselImg3Fr,
    titleFr: "Évolution sur 25 ans",
    titleEn: "25-year evolution",
    descriptionFr: "Suivez vos économies cumulatives année après année",
    descriptionEn: "Track your cumulative savings year after year",
  },
  {
    image: carouselImg4Fr,
    titleFr: "Options d'acquisition",
    titleEn: "Acquisition options",
    descriptionFr: "Comparez comptant, prêt et crédit-bail sur 25 ans",
    descriptionEn: "Compare cash, loan and capital lease over 25 years",
  },
  {
    image: carouselImg5Fr,
    titleFr: "Profil énergétique",
    titleEn: "Energy profile",
    descriptionFr: "Analyse horaire avant/après avec production solaire",
    descriptionEn: "Hourly before/after analysis with solar production",
  },
  {
    image: carouselImg6Fr,
    titleFr: "Analyse d'optimisation",
    titleEn: "Optimization analysis",
    descriptionFr: "Frontière d'efficacité pour trouver la configuration optimale",
    descriptionEn: "Efficiency frontier to find the optimal configuration",
  },
  {
    image: carouselImg7Fr,
    titleFr: "Sensibilité système",
    titleEn: "System sensitivity",
    descriptionFr: "Optimisation taille solaire et stockage selon VAN",
    descriptionEn: "Solar and storage size optimization by NPV",
  },
];

function parseAddressParts(fullAddress: string | null): { street: string; city: string; postalCode: string } {
  if (!fullAddress) return { street: "", city: "", postalCode: "" };
  
  // Try comma-separated format first: "123 rue Example, Montréal, QC H2X 1Y4"
  const commaParts = fullAddress.split(",").map(p => p.trim());
  if (commaParts.length >= 2) {
    // Extract postal code from last part if present
    const postalMatch = fullAddress.match(/[A-Z]\d[A-Z]\s*\d[A-Z]\d/i);
    const postalCode = postalMatch ? postalMatch[0].toUpperCase() : "";
    return { street: commaParts[0], city: commaParts[1].replace(/\s*(QC|Quebec|Québec)\s*/i, "").trim(), postalCode };
  }
  
  // Quebec-style address without commas: "515 boul Champlain Québec QC G1K 0E4"
  // Extract postal code (Canadian format: A1A 1A1)
  const postalMatch = fullAddress.match(/([A-Z]\d[A-Z])\s*(\d[A-Z]\d)/i);
  const postalCode = postalMatch ? `${postalMatch[1]} ${postalMatch[2]}`.toUpperCase() : "";
  
  // Remove postal code and province code from address for parsing
  let addressWithoutPostal = fullAddress.replace(/[A-Z]\d[A-Z]\s*\d[A-Z]\d/i, "").trim();
  addressWithoutPostal = addressWithoutPostal.replace(/\s+(QC|Quebec|Québec)\s*$/i, "").trim();
  
  // Common Quebec cities and Montreal boroughs to detect
  const quebecCities = [
    // Montreal boroughs/arrondissements
    "Saint-Laurent", "St-Laurent", "Anjou", "Côte-des-Neiges", "Notre-Dame-de-Grâce", "NDG",
    "Outremont", "Plateau Mont-Royal", "Plateau-Mont-Royal", "Rosemont", "Petite-Patrie",
    "Villeray", "Saint-Michel", "St-Michel", "Ahuntsic", "Cartierville", "Verdun",
    "LaSalle", "Lachine", "Mercier", "Hochelaga", "Maisonneuve", "Pointe-aux-Trembles",
    "Rivière-des-Prairies", "Saint-Léonard", "St-Léonard", "Ville-Marie",
    "Sud-Ouest", "Île-Bizard", "Pierrefonds", "Roxboro", "Beaconsfield",
    "Pointe-Claire", "Dorval", "Mont-Royal", "Hampstead", "Westmount",
    // Major cities
    "Montréal", "Montreal", "Québec", "Quebec", "Laval", "Gatineau", "Longueuil", 
    "Sherbrooke", "Saguenay", "Lévis", "Levis", "Trois-Rivières", "Trois-Rivieres",
    "Terrebonne", "Saint-Jean-sur-Richelieu", "Repentigny", "Brossard", "Drummondville",
    "Saint-Jérôme", "Saint-Jerome", "Granby", "Blainville", "Saint-Hyacinthe",
    "Châteauguay", "Chateauguay", "Dollard-des-Ormeaux", "Rimouski", "Victoriaville",
    "Saint-Eustache", "Mascouche", "Rouyn-Noranda", "Shawinigan", "Côte Saint-Luc",
    "Boucherville", "Vaudreuil-Dorion", "Mirabel", "Sainte-Julie", "Varennes",
    // South Shore
    "Candiac", "La Prairie", "Sainte-Catherine", "Saint-Constant", "Saint-Bruno",
    "Saint-Basile-le-Grand", "Chambly", "Carignan", "Saint-Lambert", "Greenfield Park",
    // North Shore  
    "Boisbriand", "Rosemère", "Lorraine", "Sainte-Thérèse", "Sainte-Anne-des-Plaines",
    "Saint-Lin-Laurentides", "L'Assomption", "Joliette", "Rawdon"
  ];
  
  // Try to find a city name in the address
  let detectedCity = "";
  let street = addressWithoutPostal;
  
  for (const city of quebecCities) {
    const cityRegex = new RegExp(`\\b${city}\\b`, "i");
    if (cityRegex.test(addressWithoutPostal)) {
      detectedCity = city;
      // Extract street by removing city name
      street = addressWithoutPostal.replace(cityRegex, "").trim();
      break;
    }
  }
  
  return { street, city: detectedCity, postalCode };
}

export default function AnalyseDetailleePage() {
  const { t, language } = useI18n();
  const searchString = useSearch();
  
  // Parse clientId from URL params (for existing CRM clients)
  const clientId = new URLSearchParams(searchString).get('clientId');
  const isExistingClient = !!clientId;
  
  const [submitted, setSubmitted] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [hasSignature, setHasSignature] = useState(false);
  const signaturePadRef = useRef<SignaturePadRef>(null);
  const currentLogo = language === "fr" ? logoFr : logoEn;

  const [parsedBillData, setParsedBillData] = useState<HQBillData | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  
  // Use ref to store savedBillPath - survives HMR and component remounts
  const savedBillPathRef = useRef<string | null>(
    // Initialize from sessionStorage to survive HMR reloads during development
    typeof window !== 'undefined' ? sessionStorage.getItem('kwhquebec_savedBillPath') : null
  );

  const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);
  
  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedSlide(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on('select', onSelect);
    onSelect();
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, onSelect]);

  const form = useForm<DetailedFormValues>({
    resolver: zodResolver(detailedFormSchema),
    defaultValues: {
      companyName: "",
      firstName: "",
      lastName: "",
      signerTitle: "",
      email: "",
      phone: "",
      streetAddress: "",
      city: "",
      province: "Québec",
      postalCode: "",
      estimatedMonthlyBill: undefined,
      buildingType: "",
      roofAgeYears: "",
      ownershipType: "",
      hqClientNumber: "",
      tariffCode: "",
      signatureCity: "",
      notes: "",
      savedBillPath: "",
      procurationAccepted: false,
    },
  });

  // Check for pre-filled data from Quick Analysis (transferred via localStorage)
  useEffect(() => {
    const storedBillData = localStorage.getItem('kwhquebec_bill_data');
    if (storedBillData) {
      try {
        const billData = JSON.parse(storedBillData);
        
        // Pre-fill the form with transferred data
        if (billData.clientName) {
          form.setValue('companyName', billData.clientName);
        }
        if (billData.serviceAddress) {
          const { street, city, postalCode } = parseAddressParts(billData.serviceAddress);
          if (street) form.setValue('streetAddress', street);
          if (city) {
            form.setValue('city', city);
            form.setValue('signatureCity', city);
          }
          if (postalCode) form.setValue('postalCode', postalCode);
        }
        if (billData.tariffCode) {
          form.setValue('tariffCode', billData.tariffCode);
        }
        if (billData.email) {
          form.setValue('email', billData.email);
        }
        if (billData.accountNumber) {
          form.setValue('hqClientNumber', billData.accountNumber);
        }
        
        // Also set the parsed bill data state for display purposes
        if (billData.annualConsumptionKwh || billData.tariffCode || billData.accountNumber) {
          setParsedBillData({
            accountNumber: billData.accountNumber || null,
            clientName: billData.clientName || null,
            serviceAddress: billData.serviceAddress || null,
            annualConsumptionKwh: billData.annualConsumptionKwh || null,
            peakDemandKw: null,
            tariffCode: billData.tariffCode || null,
            billingPeriod: null,
            estimatedMonthlyBill: null,
            confidence: 0.8,
            billNumber: billData.billNumber || null,
            hqAccountNumber: billData.hqAccountNumber || null,
            contractNumber: billData.contractNumber || null,
            tariffDetail: billData.tariffDetail || null,
            consumptionHistory: billData.consumptionHistory || null,
          });
          
          // Skip to step 2 since we already have bill data
          setCurrentStep(2);
        }
        
        // Clear localStorage after reading (one-time transfer)
        localStorage.removeItem('kwhquebec_bill_data');
      } catch (e) {
        console.error('Failed to parse stored bill data:', e);
        localStorage.removeItem('kwhquebec_bill_data');
      }
    }
  }, [form]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setUploadError(null);
    setParseError(null);
    setParsedBillData(null);
    
    const validFiles = acceptedFiles.filter(file => {
      const isValidType = file.type === 'application/pdf' || 
                          file.type.startsWith('image/');
      const isValidSize = file.size <= 10 * 1024 * 1024;
      
      if (!isValidType) {
        setUploadError(language === "fr" 
          ? "Format invalide. Utilisez PDF ou image (JPG, PNG)." 
          : "Invalid format. Use PDF or image (JPG, PNG).");
        return false;
      }
      if (!isValidSize) {
        setUploadError(language === "fr" 
          ? "Fichier trop volumineux. Maximum 10 Mo." 
          : "File too large. Maximum 10 MB.");
        return false;
      }
      return true;
    });

    const newFiles = validFiles.map(file => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : ''
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);
    
    // Auto-trigger bill parsing after upload (like landing page)
    if (validFiles.length > 0) {
      setIsParsing(true);
      setParseError(null);
      
      // Parse the first valid file immediately
      const fileToparse = validFiles[0];
      const formData = new FormData();
      formData.append('file', fileToparse);
      
      fetch('/api/parse-hq-bill', {
        method: 'POST',
        body: formData,
      })
        .then(response => {
          if (!response.ok) throw new Error('Failed to parse bill');
          return response.json();
        })
        .then(result => {
          console.log('[Bill Parse] Result received:', result);
          // API returns { success: true, data: {...} } - unwrap it
          if (!result.success || !result.data) {
            throw new Error('Failed to parse bill data');
          }
          const data = result.data as HQBillData;
          console.log('[Bill Parse] Parsed data:', data);
          console.log('[Bill Parse] savedBillPath from server:', data.savedBillPath);
          setParsedBillData(data);
          setIsParsing(false);
          
          // Store savedBillPath in ref AND sessionStorage (survives HMR reloads)
          if (data.savedBillPath) {
            console.log('[Bill Parse] Storing savedBillPath:', data.savedBillPath);
            savedBillPathRef.current = data.savedBillPath;
            sessionStorage.setItem('kwhquebec_savedBillPath', data.savedBillPath);
            form.setValue('savedBillPath', data.savedBillPath);
            console.log('[Bill Parse] SessionStorage after set:', sessionStorage.getItem('kwhquebec_savedBillPath'));
          } else {
            console.log('[Bill Parse] WARNING: No savedBillPath in response!');
          }
          
          // Auto-transition to step 2 first, then fill form after fields mount
          setTimeout(() => {
            setCurrentStep(2);
            
            // Wait for step 2 fields to mount before setting values
            setTimeout(() => {
              if (data.accountNumber) {
                form.setValue('hqClientNumber', data.accountNumber);
              }
              if (data.clientName) {
                form.setValue('companyName', data.clientName);
              }
              if (data.serviceAddress) {
                const { street, city, postalCode } = parseAddressParts(data.serviceAddress);
                if (street) form.setValue('streetAddress', street);
                if (city) form.setValue('city', city);
                if (city) form.setValue('signatureCity', city);
                if (postalCode) form.setValue('postalCode', postalCode);
              }
              if (data.estimatedMonthlyBill) {
                form.setValue('estimatedMonthlyBill', data.estimatedMonthlyBill);
              }
              if (data.tariffCode) {
                form.setValue('tariffCode', data.tariffCode);
              }
            }, 100);
          }, 500);
        })
        .catch(() => {
          setIsParsing(false);
          setParseError(language === "fr" 
            ? "Impossible d'analyser la facture. Veuillez réessayer ou saisir les informations manuellement."
            : "Unable to analyze the bill. Please try again or enter information manually.");
        });
    }
  }, [language, form]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    },
    maxFiles: 5
  });

  const removeFile = (index: number) => {
    setUploadedFiles(prev => {
      const newFiles = [...prev];
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
    setParsedBillData(null);
    setParseError(null);
  };

  const parseBillMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/parse-hq-bill', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to parse bill');
      }

      const result = await response.json();
      // API returns { success: true, data: {...} }
      return result.data as HQBillData;
    },
    onSuccess: (data) => {
      setParsedBillData(data);
      setIsParsing(false);
      
      // Store savedBillPath in ref AND sessionStorage (survives HMR reloads)
      if (data.savedBillPath) {
        savedBillPathRef.current = data.savedBillPath;
        sessionStorage.setItem('kwhquebec_savedBillPath', data.savedBillPath);
        form.setValue('savedBillPath', data.savedBillPath);
      }
      
      // First transition to step 2, then set form values after fields are mounted
      setTimeout(() => {
        setCurrentStep(2);
        
        // Set values after step transition with a small delay to ensure fields are mounted
        setTimeout(() => {
          const setValueOptions = { shouldDirty: true, shouldTouch: true };
          
          if (data.accountNumber) {
            form.setValue('hqClientNumber', data.accountNumber, setValueOptions);
          }
          if (data.clientName) {
            form.setValue('companyName', data.clientName, setValueOptions);
          }
          if (data.serviceAddress) {
            const { street, city, postalCode } = parseAddressParts(data.serviceAddress);
            if (street) form.setValue('streetAddress', street, setValueOptions);
            if (city) form.setValue('city', city, setValueOptions);
            if (city) form.setValue('signatureCity', city, setValueOptions);
            if (postalCode) form.setValue('postalCode', postalCode, setValueOptions);
          }
          if (data.estimatedMonthlyBill) {
            form.setValue('estimatedMonthlyBill', data.estimatedMonthlyBill, setValueOptions);
          }
          if (data.tariffCode) {
            form.setValue('tariffCode', data.tariffCode, setValueOptions);
          }
        }, 100);
      }, 500);
    },
    onError: (error) => {
      setIsParsing(false);
      setParseError(language === "fr" 
        ? "Impossible d'analyser la facture. Veuillez réessayer ou saisir les informations manuellement."
        : "Unable to analyze the bill. Please try again or enter information manually.");
    },
  });

  const handleParseBill = () => {
    if (uploadedFiles.length === 0) return;
    
    setIsParsing(true);
    setParseError(null);
    parseBillMutation.mutate(uploadedFiles[0].file);
  };

  const mutation = useMutation({
    mutationFn: async (data: DetailedFormValues) => {
      const formData = new FormData();
      
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, String(value));
        }
      });

      formData.append('language', language);
      formData.append('procurationDate', new Date().toISOString());
      
      // If this is an existing CRM client, include clientId to skip Lead/Opportunity creation
      if (clientId) {
        formData.append('clientId', clientId);
      }

      if (signaturePadRef.current && !signaturePadRef.current.isEmpty()) {
        const signatureDataUrl = signaturePadRef.current.toDataURL('image/png');
        formData.append('signatureImage', signatureDataUrl);
      }

      uploadedFiles.forEach((uploadedFile, index) => {
        formData.append(`billFile_${index}`, uploadedFile.file);
      });

      // Read directly from sessionStorage (most reliable for HMR)
      const sessionPath = sessionStorage.getItem('kwhquebec_savedBillPath');
      const savedPath = sessionPath || savedBillPathRef.current || data.savedBillPath || parsedBillData?.savedBillPath;
      if (savedPath) {
        formData.append('savedBillPath', savedPath);
      }

      if (parsedBillData) {
        if (parsedBillData.billNumber) formData.append('hqBillNumber', parsedBillData.billNumber);
        if (parsedBillData.hqAccountNumber) formData.append('hqAccountNumber12', parsedBillData.hqAccountNumber);
        if (parsedBillData.contractNumber) formData.append('hqContractNumber', parsedBillData.contractNumber);
        if (parsedBillData.tariffDetail) formData.append('hqTariffDetail', parsedBillData.tariffDetail);
        if (parsedBillData.clientName) formData.append('hqLegalClientName', parsedBillData.clientName);
        if (parsedBillData.consumptionHistory) formData.append('hqConsumptionHistory', JSON.stringify(parsedBillData.consumptionHistory));
      }

      const response = await fetch('/api/detailed-analysis-request', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to submit');
      }

      const result = await response.json();

      return result;
    },
    onSuccess: () => {
      uploadedFiles.forEach(f => {
        if (f.preview) URL.revokeObjectURL(f.preview);
      });
      setUploadedFiles([]);
      // Clear sessionStorage after successful submission
      sessionStorage.removeItem('kwhquebec_savedBillPath');
      savedBillPathRef.current = null;
      setSubmitted(true);
    },
  });

  const onSubmit = (data: DetailedFormValues) => {
    console.log('[Form onSubmit] Validation passed, data:', data);
    // Read directly from sessionStorage (most reliable for HMR), then ref, then form, then state
    const sessionPath = sessionStorage.getItem('kwhquebec_savedBillPath');
    const savedPath = sessionPath || savedBillPathRef.current || data.savedBillPath || parsedBillData?.savedBillPath;
    // If form has HQ account number, the bill was already parsed/saved - trust that
    // (form values persist through HMR, useState doesn't)
    const formHasHQData = !!(data.hqClientNumber && data.hqClientNumber.length > 5);
    console.log('[Form onSubmit] uploadedFiles:', uploadedFiles.length, 'savedBillPath:', savedPath, 'session:', sessionPath, 'formHasHQData:', formHasHQData);
    
    if (uploadedFiles.length === 0 && !savedPath && !formHasHQData) {
      console.log('[Form onSubmit] No uploaded files, no saved bill path, no HQ data, showing error');
      setUploadError(language === "fr" 
        ? "Veuillez téléverser au moins une facture Hydro-Québec" 
        : "Please upload at least one Hydro-Québec bill");
      return;
    }
    console.log('[Form onSubmit] Calling mutation.mutate');
    mutation.mutate(data);
  };

  const buildingTypes = [
    { value: "industrial", label: language === "fr" ? "Industriel" : "Industrial" },
    { value: "commercial", label: language === "fr" ? "Commercial" : "Commercial" },
    { value: "institutional", label: language === "fr" ? "Institutionnel" : "Institutional" },
    { value: "other", label: language === "fr" ? "Autre" : "Other" },
  ];

  const tariffCodes = [
    { value: "G", label: language === "fr" ? "G - Petit débit" : "G - Small power" },
    { value: "G-9", label: language === "fr" ? "G-9 - Moyen débit" : "G-9 - Medium power" },
    { value: "M", label: language === "fr" ? "M - Moyenne puissance" : "M - Medium power" },
    { value: "L", label: language === "fr" ? "L - Grande puissance" : "L - Large power" },
    { value: "LG", label: language === "fr" ? "LG - Grande puissance" : "LG - Large power" },
  ];

  const steps = [
    { 
      number: 1, 
      title: language === "fr" ? "Facture Hydro-Québec" : "Hydro-Québec Bill",
      icon: FileText 
    },
    { 
      number: 2, 
      title: language === "fr" ? "Informations" : "Information",
      icon: FileSignature 
    },
  ];

  const procurationTextFr = `
Je soussigné(e), autorise par la présente kWh Québec inc. à agir en mon nom et pour mon compte auprès d'Hydro-Québec afin d'obtenir les informations relatives à ma consommation électrique, incluant mais sans s'y limiter:

• Les données de consommation horaires (intervalles de 15 minutes ou horaires)
• L'historique de facturation des 24 derniers mois
• Les informations sur mon contrat et tarif actuel
• Les données de puissance appelée

Cette procuration est valide pour une durée de 15 jours ouvrables à compter de la date de signature et peut être révoquée en tout temps par écrit.

Les données obtenues seront utilisées exclusivement pour l'analyse du potentiel solaire et le dimensionnement d'un système photovoltaïque pour mon bâtiment.
  `.trim();

  const procurationTextEn = `
I, the undersigned, hereby authorize kWh Québec inc. to act on my behalf with Hydro-Québec to obtain information regarding my electrical consumption, including but not limited to:

• Hourly consumption data (15-minute or hourly intervals)
• Billing history for the past 24 months
• Information about my current contract and rate
• Demand power data

This authorization is valid for 15 business days from the date of signature and may be revoked at any time in writing.

The data obtained will be used exclusively for solar potential analysis and photovoltaic system sizing for my building.
  `.trim();

  const processSteps = [
    {
      icon: FileText,
      title: language === "fr" ? "1. Vous nous donnez accès" : "1. You give us access",
      description: language === "fr" 
        ? "Autorisez kWh Québec comme mandataire via votre Espace client Hydro-Québec"
        : "Authorize kWh Québec as agent via your Hydro-Québec Customer Space"
    },
    {
      icon: BarChart3,
      title: language === "fr" ? "2. On analyse vos données" : "2. We analyze your data",
      description: language === "fr"
        ? "Analyse du profil de consommation détaillé de votre immeuble"
        : "Hour-by-hour consumption analysis + solar potential"
    },
    {
      icon: Sun,
      title: language === "fr" ? "3. Optimisation solaire + stockage" : "3. Solar + storage optimization",
      description: language === "fr"
        ? "Dimensionnement optimal selon votre profil énergétique"
        : "Optimal sizing based on your energy profile"
    },
    {
      icon: DollarSign,
      title: language === "fr" ? "4. Rapport financier complet" : "4. Complete financial report",
      description: language === "fr"
        ? "VAN, TRI, 3 options d'acquisition, incitatifs"
        : "NPV, IRR, 3 acquisition options, incentives"
    },
  ];

  const canProceedToStep2 = () => {
    return uploadedFiles.length > 0;
  };

  const canSubmit = () => {
    const values = form.getValues();
    return values.companyName && values.firstName && values.lastName && values.signerTitle && 
           values.hqClientNumber && values.email && values.streetAddress && values.city &&
           values.procurationAccepted === true && values.signatureCity && values.signatureCity.length > 0;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-green-600 dark:text-green-400";
    if (confidence >= 0.5) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return language === "fr" ? "Élevée" : "High";
    if (confidence >= 0.5) return language === "fr" ? "Moyenne" : "Medium";
    return language === "fr" ? "Faible" : "Low";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <Link href="/">
              <img 
                src={currentLogo} 
                alt="kWh Québec" 
                className="h-10 sm:h-12 w-auto"
                data-testid="logo-header"
              />
            </Link>
            
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-6 gap-2" data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4" />
              {language === "fr" ? "Retour à l'accueil" : "Back to home"}
            </Button>
          </Link>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="text-3xl sm:text-4xl font-bold mb-4">
              {language === "fr" ? "Analyse Détaillée" : "Detailed Analysis"}
            </h1>
            <div className="flex items-center justify-center gap-4 text-muted-foreground mb-4">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>7 {language === "fr" ? "jours ouvrables" : "business days"}</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="font-medium text-foreground">95% {language === "fr" ? "précision" : "accuracy"}</span>
              </div>
            </div>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {language === "fr"
                ? "Basée sur vos données de consommation réelles Hydro-Québec pour une analyse optimale et personnalisée."
                : "Based on your real Hydro-Québec consumption data for an optimal and personalized analysis."
              }
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-6"
            >
              <Card className="p-6">
                <h2 className="text-xl font-bold mb-6">
                  {language === "fr" ? "Comment ça fonctionne" : "How it works"}
                </h2>
                <div className="space-y-6">
                  {processSteps.map((step, index) => (
                    <div key={index} className="flex gap-4">
                      <div className="p-2 rounded-lg bg-primary/10 h-fit">
                        <step.icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1">{step.title}</h3>
                        <p className="text-sm text-muted-foreground">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-6 bg-accent/5 border-accent/20">
                <h2 className="text-xl font-bold mb-4">
                  {language === "fr" ? "Ce qui est inclus" : "What's included"}
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
                    <div className="p-2 rounded-lg bg-yellow-500/10">
                      <Sun className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <span className="text-sm font-medium">
                      {language === "fr" ? "Potentiel solaire" : "Solar potential"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="text-sm font-medium">
                      {language === "fr" ? "Économies 25 ans" : "25-year savings"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-sm font-medium">
                      {language === "fr" ? "Analyse financière" : "Financial analysis"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-sm font-medium">
                      {language === "fr" ? "Rapport PDF" : "PDF report"}
                    </span>
                  </div>
                </div>
              </Card>

              <Card className="p-4 overflow-hidden">
                <div className="flex items-center gap-2 mb-4">
                  <Image className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">
                    {language === "fr" ? "Aperçu de l'analyse" : "Analysis preview"}
                  </h3>
                </div>
                <div className="relative">
                  <div className="overflow-hidden rounded-lg" ref={emblaRef}>
                    <div className="flex">
                      {carouselSlides.map((slide, index) => (
                        <div key={index} className="flex-[0_0_100%] min-w-0">
                          <div className="relative">
                            <img 
                              src={slide.image} 
                              alt={language === "fr" ? slide.titleFr : slide.titleEn}
                              className="w-full h-auto rounded-lg border"
                              data-testid={`carousel-image-${index}`}
                            />
                          </div>
                          <div className="mt-3 text-center">
                            <h4 className="font-medium text-sm">
                              {language === "fr" ? slide.titleFr : slide.titleEn}
                            </h4>
                            <p className="text-xs text-muted-foreground mt-1">
                              {language === "fr" ? slide.descriptionFr : slide.descriptionEn}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex justify-center items-center gap-3 mt-4">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={scrollPrev}
                    data-testid="carousel-prev"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="flex gap-1.5">
                    {carouselSlides.map((_, index) => (
                      <button
                        key={index}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          selectedSlide === index ? 'bg-primary' : 'bg-muted-foreground/30'
                        }`}
                        onClick={() => emblaApi?.scrollTo(index)}
                        data-testid={`carousel-dot-${index}`}
                      />
                    ))}
                  </div>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={scrollNext}
                    data-testid="carousel-next"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </Card>

              <div className="flex flex-wrap items-center gap-4 pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="w-4 h-4 text-primary" />
                  <span>{language === "fr" ? "Données sécurisées" : "Secure data"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Award className="w-4 h-4 text-primary" />
                  <span>{language === "fr" ? "Analyse gratuite" : "Free analysis"}</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="p-6 lg:p-8 border-2 border-accent/30">
                {submitted ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-8"
                  >
                    <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                    </div>
                    <h3 className="text-2xl font-bold mb-2">
                      {language === "fr" ? "Procuration envoyée avec succès!" : "Authorization submitted successfully!"}
                    </h3>

                    {(form.getValues().firstName || form.getValues().lastName) && (
                      <p className="text-lg text-muted-foreground mb-6">
                        {language === "fr"
                          ? `Merci, ${form.getValues().firstName}${form.getValues().lastName ? ' ' + form.getValues().lastName : ''}!`
                          : `Thank you, ${form.getValues().firstName}${form.getValues().lastName ? ' ' + form.getValues().lastName : ''}!`
                        }
                      </p>
                    )}

                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6">
                      <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-2">
                        <FileSignature className="w-5 h-5" />
                        <span className="font-semibold">
                          {language === "fr" ? "Procuration signée" : "Authorization Signed"}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {language === "fr"
                          ? "Votre procuration a été signée électroniquement et enregistrée."
                          : "Your authorization has been electronically signed and recorded."
                        }
                      </p>
                      {form.getValues().email && (
                        <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                          {language === "fr"
                            ? `Un courriel de confirmation sera envoyé à ${form.getValues().email}`
                            : `A confirmation email will be sent to ${form.getValues().email}`
                          }
                        </p>
                      )}
                    </div>

                    <div className="bg-muted/50 border border-border rounded-lg p-4 mb-6 text-left">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary" />
                        {language === "fr" ? "Prochaines étapes" : "Next Steps"}
                      </h4>
                      <div className="space-y-3 text-sm">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-bold text-primary">1</span>
                          </div>
                          <div>
                            <p className="font-medium">
                              {language === "fr" ? "Accès aux données Hydro-Québec" : "Hydro-Québec Data Access"}
                            </p>
                            <p className="text-primary font-semibold text-xs mb-1">
                              {language === "fr" ? "3-4 jours ouvrables" : "3-4 business days"}
                            </p>
                            <p className="text-muted-foreground">
                              {language === "fr"
                                ? "Nous soumettons votre procuration à Hydro-Québec pour obtenir l'accès à vos données de consommation détaillées."
                                : "We submit your authorization to Hydro-Québec to gain access to your detailed consumption data."
                              }
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-bold text-primary">2</span>
                          </div>
                          <div>
                            <p className="font-medium">
                              {language === "fr" ? "Analyse détaillée de votre bâtiment" : "Detailed analysis of your building"}
                            </p>
                            <p className="text-primary font-semibold text-xs mb-1">
                              {language === "fr" ? "5-7 jours ouvrables" : "5-7 business days"}
                            </p>
                            <p className="text-muted-foreground">
                              {language === "fr"
                                ? "Une fois les données reçues, notre équipe procède à l'analyse détaillée et prépare votre rapport personnalisé."
                                : "Once we receive the data, our team performs the detailed analysis and prepares your personalized report."
                              }
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-bold text-primary">3</span>
                          </div>
                          <div>
                            {/* Show personalized presentation for high-value projects (annual bill >= $30k) */}
                            {(form.getValues("estimatedMonthlyBill") && form.getValues("estimatedMonthlyBill")! >= 2500) ? (
                              <>
                                <p className="font-medium">
                                  {language === "fr" ? "Présentation personnalisée de vos résultats" : "Personalized presentation of your results"}
                                </p>
                                <p className="text-muted-foreground">
                                  {language === "fr"
                                    ? "Un conseiller vous contactera pour planifier un rendez-vous et vous présenter l'analyse en détail avec les opportunités de savoir et les investissements recommandés."
                                    : "An advisor will contact you to schedule a meeting and present the analysis in detail with savings opportunities and recommended investments."
                                  }
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="font-medium">
                                  {language === "fr" ? "Rapport envoyé par courriel" : "Report sent by email"}
                                </p>
                                <p className="text-muted-foreground">
                                  {language === "fr"
                                    ? "Vous recevrez votre analyse complète par courriel avec un lien vers votre portail client pour explorer tous les détails de votre analyse."
                                    : "You will receive your complete analysis by email with a link to your client portal to explore all the details of your analysis."
                                  }
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Show personalized presentation offer for large projects: $2.5k+/month (approx $30k/year) */}
                    {(form.getValues("estimatedMonthlyBill") && form.getValues("estimatedMonthlyBill")! >= 2500) && (
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-6">
                        <div className="flex items-center gap-2 text-primary mb-2">
                          <Calendar className="w-5 h-5" />
                          <span className="font-semibold">
                            {language === "fr" ? "Présentation personnalisée" : "Personalized Presentation"}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          {language === "fr"
                            ? "Compte tenu de la taille de votre projet, un conseiller kWh Québec vous contactera dans les prochains jours pour planifier une présentation personnalisée."
                            : "Given the size of your project, a kWh Québec advisor will contact you in the coming days to schedule a personalized presentation."
                          }
                        </p>
                      </div>
                    )}

                    <div className="flex gap-3 justify-center">
                      <Link href="/">
                        <Button data-testid="button-back-after-submit">
                          {language === "fr" ? "Retour à l'accueil" : "Back to home"}
                        </Button>
                      </Link>
                    </div>
                  </motion.div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      {steps.map((step, index) => (
                        <div key={step.number} className="flex items-center">
                          <div 
                            className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors cursor-pointer ${
                              currentStep === step.number 
                                ? 'bg-primary border-primary text-primary-foreground' 
                                : currentStep > step.number
                                  ? 'bg-green-500 border-green-500 text-white'
                                  : 'border-muted-foreground/30 text-muted-foreground'
                            }`}
                            onClick={() => {
                              if (step.number < currentStep) setCurrentStep(step.number);
                            }}
                            data-testid={`step-indicator-${step.number}`}
                          >
                            {currentStep > step.number ? (
                              <CheckCircle2 className="w-5 h-5" />
                            ) : (
                              <step.icon className="w-5 h-5" />
                            )}
                          </div>
                          {index < steps.length - 1 && (
                            <div className={`w-16 sm:w-24 h-0.5 mx-2 ${
                              currentStep > step.number ? 'bg-green-500' : 'bg-muted-foreground/20'
                            }`} />
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="text-center mb-6">
                      <h2 className="text-lg font-semibold">
                        {steps[currentStep - 1].title}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {language === "fr" ? `Étape ${currentStep} de 2` : `Step ${currentStep} of 2`}
                      </p>
                    </div>
                    
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
                        console.log('[Form Validation Errors]', errors);
                      })} className="space-y-4">
                        {currentStep === 1 && (
                          <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="space-y-4"
                          >
                            <div className="text-center mb-6">
                              <div className="flex items-center justify-center gap-3 mb-4">
                                <div className="p-3 rounded-xl bg-primary/10">
                                  <Zap className="w-8 h-8 text-primary" />
                                </div>
                              </div>
                              <h3 className="text-xl font-bold mb-2">
                                {language === "fr" 
                                  ? "Téléversez votre facture Hydro-Québec" 
                                  : "Upload your Hydro-Québec bill"}
                              </h3>
                              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                <Sparkles className="w-4 h-4 text-primary" />
                                <span>
                                  {language === "fr" 
                                    ? "Notre outil va automatiquement remplir le formulaire avec vos données" 
                                    : "Our tool will automatically fill the form with your data"}
                                </span>
                              </div>
                            </div>

                            <div
                              {...getRootProps()}
                              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                                isDragActive 
                                  ? 'border-primary bg-primary/5 scale-[1.02]' 
                                  : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30'
                              }`}
                              data-testid="dropzone-bill"
                            >
                              <input {...getInputProps()} />
                              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                                <Upload className="w-8 h-8 text-primary" />
                              </div>
                              <p className="text-base font-semibold mb-2">
                                {isDragActive 
                                  ? (language === "fr" ? "Déposez le fichier ici..." : "Drop the file here...")
                                  : (language === "fr" ? "Glissez votre facture ici" : "Drag your bill here")
                                }
                              </p>
                              <p className="text-sm text-muted-foreground mb-3">
                                {language === "fr" ? "ou cliquez pour sélectionner" : "or click to select"}
                              </p>
                              <Badge variant="secondary" className="text-xs">
                                PDF, JPG, PNG (max 10 Mo)
                              </Badge>
                            </div>

                              {uploadError && (
                                <div className="flex items-center gap-2 mt-3 p-3 bg-destructive/10 rounded-md text-destructive text-sm">
                                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                  {uploadError}
                                </div>
                              )}

                              {uploadedFiles.length > 0 && (
                                <div className="mt-4 space-y-2">
                                  <p className="text-sm font-medium">
                                    {language === "fr" ? "Fichier sélectionné:" : "Selected file:"}
                                  </p>
                                  {uploadedFiles.map((uploadedFile, index) => (
                                    <div 
                                      key={index} 
                                      className="flex items-center justify-between p-3 bg-background rounded-md border"
                                      data-testid={`uploaded-file-${index}`}
                                    >
                                      <div className="flex items-center gap-3">
                                        <File className="w-5 h-5 text-primary" />
                                        <div>
                                          <p className="text-sm font-medium truncate max-w-[200px]">
                                            {uploadedFile.file.name}
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            {(uploadedFile.file.size / 1024 / 1024).toFixed(2)} Mo
                                          </p>
                                        </div>
                                      </div>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeFile(index)}
                                        data-testid={`button-remove-file-${index}`}
                                      >
                                        <X className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  ))}

                                  {!parsedBillData && !isParsing && (
                                    <Button
                                      type="button"
                                      onClick={handleParseBill}
                                      className="w-full gap-2 mt-4"
                                      data-testid="button-analyze-bill"
                                    >
                                      <ScanLine className="w-4 h-4" />
                                      {language === "fr" ? "Analyser la facture" : "Analyze Bill"}
                                    </Button>
                                  )}
                                </div>
                              )}

                              {isParsing && (
                                <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
                                  <div className="flex items-center gap-3">
                                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                                    <div>
                                      <p className="font-medium text-sm">
                                        {language === "fr" ? "Analyse en cours..." : "Analyzing..."}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {language === "fr" 
                                          ? "Notre IA extrait les informations de votre facture Hydro-Québec"
                                          : "Our AI is extracting information from your Hydro-Québec bill"
                                        }
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {parseError && (
                                <div className="flex items-center gap-2 mt-4 p-3 bg-destructive/10 rounded-md text-destructive text-sm">
                                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                  {parseError}
                                </div>
                              )}

                              {parsedBillData && (
                                <motion.div
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="mt-4 p-4 bg-green-500/5 rounded-lg border border-green-500/20"
                                  data-testid="parsed-bill-preview"
                                >
                                  <div className="flex items-center gap-2 mb-3">
                                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                                    <span className="font-semibold text-sm">
                                      {language === "fr" ? "Données extraites" : "Extracted Data"}
                                    </span>
                                  </div>
                                  
                                  <div className="space-y-2 text-sm">
                                    {parsedBillData.accountNumber && (
                                      <div className="flex items-center gap-2" data-testid="parsed-account-number">
                                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                                        <span className="text-muted-foreground">{language === "fr" ? "No compte:" : "Account #:"}</span>
                                        <span className="font-medium">{parsedBillData.accountNumber}</span>
                                      </div>
                                    )}
                                    {parsedBillData.clientName && (
                                      <div className="flex items-center gap-2" data-testid="parsed-client-name">
                                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                                        <span className="text-muted-foreground">{language === "fr" ? "Nom:" : "Name:"}</span>
                                        <span className="font-medium">{parsedBillData.clientName}</span>
                                      </div>
                                    )}
                                    {parsedBillData.serviceAddress && (
                                      <div className="flex items-center gap-2" data-testid="parsed-address">
                                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                                        <span className="text-muted-foreground">{language === "fr" ? "Adresse:" : "Address:"}</span>
                                        <span className="font-medium">{parsedBillData.serviceAddress}</span>
                                      </div>
                                    )}
                                    {parsedBillData.annualConsumptionKwh && (
                                      <div className="flex items-center gap-2" data-testid="parsed-consumption">
                                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                                        <span className="text-muted-foreground">{language === "fr" ? "Consommation:" : "Consumption:"}</span>
                                        <span className="font-medium">{parsedBillData.annualConsumptionKwh.toLocaleString()} kWh/{language === "fr" ? "an" : "yr"}</span>
                                      </div>
                                    )}
                                    {parsedBillData.tariffCode && (
                                      <div className="flex items-center gap-2" data-testid="parsed-tariff">
                                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                                        <span className="text-muted-foreground">{language === "fr" ? "Tarif:" : "Tariff:"}</span>
                                        <span className="font-medium">{parsedBillData.tariffCode}</span>
                                      </div>
                                    )}
                                    {parsedBillData.estimatedMonthlyBill && (
                                      <div className="flex items-center gap-2" data-testid="parsed-monthly-bill">
                                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                                        <span className="text-muted-foreground">{language === "fr" ? "Facture mensuelle:" : "Monthly bill:"}</span>
                                        <span className="font-medium">${parsedBillData.estimatedMonthlyBill.toLocaleString()}</span>
                                      </div>
                                    )}
                                  </div>

                                  <p className="text-xs text-muted-foreground mt-3">
                                    {language === "fr" 
                                      ? "Ces informations seront utilisées pour pré-remplir le formulaire. Vous pourrez les modifier à l'étape suivante."
                                      : "This information will be used to pre-fill the form. You can edit it in the next step."
                                    }
                                  </p>
                                </motion.div>
                              )}

                            <div className="flex flex-col gap-3 pt-4">
                              <Button 
                                type="button" 
                                className="w-full gap-2"
                                onClick={() => {
                                  if (canProceedToStep2()) {
                                    setCurrentStep(2);
                                  }
                                }}
                                disabled={!canProceedToStep2()}
                                data-testid="button-next-step-1"
                              >
                                {language === "fr" ? "Continuer" : "Continue"}
                                <ArrowRight className="w-4 h-4" />
                              </Button>
                              
                              <button
                                type="button"
                                className="text-sm text-muted-foreground hover:text-foreground underline"
                                onClick={() => setCurrentStep(2)}
                                data-testid="link-skip-parsing"
                              >
                                {language === "fr" ? "Je préfère saisir les informations manuellement" : "I prefer to enter information manually"}
                              </button>
                            </div>
                          </motion.div>
                        )}

                        {currentStep === 2 && (
                          <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="space-y-4"
                          >
                            {parsedBillData && (
                              <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-4 mb-4" data-testid="parsed-data-summary">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                                    <span className="font-semibold text-sm">
                                      {language === "fr" ? "Données extraites" : "Extracted Data"}
                                    </span>
                                  </div>
                                  <Badge variant="secondary" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                                    {(() => {
                                      let count = 0;
                                      if (parsedBillData.accountNumber) count++;
                                      if (parsedBillData.clientName) count++;
                                      if (parsedBillData.serviceAddress) count++;
                                      if (parsedBillData.tariffCode) count++;
                                      if (parsedBillData.annualConsumptionKwh) count++;
                                      return `${count} ${language === "fr" ? "champs pré-remplis" : "fields pre-filled"}`;
                                    })()}
                                  </Badge>
                                </div>
                                {parsedBillData.annualConsumptionKwh && (
                                  <div className="flex items-center gap-3 p-3 bg-background/50 rounded-md">
                                    <Zap className="w-5 h-5 text-primary" />
                                    <div>
                                      <p className="text-xs text-muted-foreground">
                                        {language === "fr" ? "Consommation annuelle détectée" : "Detected annual consumption"}
                                      </p>
                                      <p className="text-lg font-bold text-primary">
                                        {parsedBillData.annualConsumptionKwh.toLocaleString()} kWh/{language === "fr" ? "an" : "yr"}
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {parsedBillData && (
                              <div className="bg-muted/30 rounded-lg p-4 mb-2">
                                <div className="flex items-center gap-2 mb-3">
                                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                                  <span className="text-sm font-medium text-muted-foreground">
                                    {language === "fr" ? "Informations extraites de la facture" : "Information extracted from bill"}
                                  </span>
                                </div>
                                <div className="grid sm:grid-cols-2 gap-4 items-end">
                                  <FormField
                                    control={form.control}
                                    name="companyName"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="flex items-center gap-1 min-h-[2.5rem]">
                                          <Building2 className="w-3 h-3 flex-shrink-0" />
                                          <span>{language === "fr" ? "Entreprise" : "Company"} *</span>
                                          {field.value && <CheckCircle2 className="w-3 h-3 text-green-500 ml-auto flex-shrink-0" />}
                                        </FormLabel>
                                        <FormControl>
                                          <Input 
                                            {...field} 
                                            data-testid="input-company-name"
                                            className={field.value ? "border-green-500/30 bg-green-500/5" : ""}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  
                                  <FormField
                                    control={form.control}
                                    name="hqClientNumber"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="flex items-center gap-1 min-h-[2.5rem]">
                                          <Zap className="w-3 h-3 flex-shrink-0" />
                                          <span>{language === "fr" ? "No de client Hydro-Québec" : "Hydro-Québec Client No"} *</span>
                                          {field.value && <CheckCircle2 className="w-3 h-3 text-green-500 ml-auto flex-shrink-0" />}
                                        </FormLabel>
                                        <FormControl>
                                          <Input 
                                            {...field} 
                                            data-testid="input-hq-client" 
                                            placeholder="Ex: 100142202"
                                            className={field.value ? "border-green-500/30 bg-green-500/5" : ""}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>

                                <div className="mt-4">
                                  <FormField
                                    control={form.control}
                                    name="streetAddress"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="flex items-center gap-1">
                                          <MapPin className="w-3 h-3" />
                                          {language === "fr" ? "Adresse du bâtiment" : "Building address"} *
                                          {field.value && <CheckCircle2 className="w-3 h-3 text-green-500 ml-auto" />}
                                        </FormLabel>
                                        <FormControl>
                                          <Input 
                                            {...field} 
                                            placeholder={language === "fr" ? "123 rue Principale" : "123 Main Street"}
                                            data-testid="input-address"
                                            className={field.value ? "border-green-500/30 bg-green-500/5" : ""}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>

                                <div className="grid sm:grid-cols-2 gap-4 mt-4">
                                  <FormField
                                    control={form.control}
                                    name="city"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="flex items-center gap-1">
                                          {language === "fr" ? "Ville" : "City"} *
                                          {field.value && <CheckCircle2 className="w-3 h-3 text-green-500 ml-auto" />}
                                        </FormLabel>
                                        <FormControl>
                                          <Input 
                                            {...field} 
                                            data-testid="input-city"
                                            className={field.value ? "border-green-500/30 bg-green-500/5" : ""}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  
                                  <FormField
                                    control={form.control}
                                    name="tariffCode"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="flex items-center gap-1">
                                          <Zap className="w-3 h-3" />
                                          {language === "fr" ? "Code tarifaire" : "Tariff code"}
                                          {field.value && <CheckCircle2 className="w-3 h-3 text-green-500 ml-auto" />}
                                        </FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                          <FormControl>
                                            <SelectTrigger 
                                              data-testid="select-tariff-code"
                                              className={field.value ? "border-green-500/30 bg-green-500/5" : ""}
                                            >
                                              <SelectValue placeholder={language === "fr" ? "Sélectionner..." : "Select..."} />
                                            </SelectTrigger>
                                          </FormControl>
                                          <SelectContent>
                                            {tariffCodes.map((tariff) => (
                                              <SelectItem key={tariff.value} value={tariff.value}>
                                                {tariff.label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              </div>
                            )}

                            {!parsedBillData && (
                              <>
                                <div className="grid sm:grid-cols-2 gap-4 items-end">
                                  <FormField
                                    control={form.control}
                                    name="companyName"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="flex items-center gap-1 min-h-[2.5rem]">
                                          <Building2 className="w-3 h-3 flex-shrink-0" />
                                          <span>{language === "fr" ? "Entreprise" : "Company"} *</span>
                                        </FormLabel>
                                        <FormControl>
                                          <Input {...field} data-testid="input-company-name" />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  
                                  <FormField
                                    control={form.control}
                                    name="hqClientNumber"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="flex items-center gap-1 min-h-[2.5rem]">
                                          <Zap className="w-3 h-3 flex-shrink-0" />
                                          <span>{language === "fr" ? "No de client Hydro-Québec" : "Hydro-Québec Client No"} *</span>
                                        </FormLabel>
                                        <FormControl>
                                          <Input {...field} data-testid="input-hq-client" placeholder="Ex: 100142202" />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                
                                <FormField
                                  control={form.control}
                                  name="streetAddress"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="flex items-center gap-1">
                                        <MapPin className="w-3 h-3" />
                                        {language === "fr" ? "Adresse du bâtiment" : "Building address"} *
                                      </FormLabel>
                                      <FormControl>
                                        <Input 
                                          {...field} 
                                          placeholder={language === "fr" ? "123 rue Principale" : "123 Main Street"}
                                          data-testid="input-address" 
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <div className="grid sm:grid-cols-2 gap-4">
                                  <FormField
                                    control={form.control}
                                    name="city"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>{language === "fr" ? "Ville" : "City"} *</FormLabel>
                                        <FormControl>
                                          <Input {...field} data-testid="input-city" />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  
                                  <FormField
                                    control={form.control}
                                    name="tariffCode"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="flex items-center gap-1">
                                          <Zap className="w-3 h-3" />
                                          {language === "fr" ? "Code tarifaire" : "Tariff code"}
                                        </FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                          <FormControl>
                                            <SelectTrigger data-testid="select-tariff-code">
                                              <SelectValue placeholder={language === "fr" ? "Sélectionner..." : "Select..."} />
                                            </SelectTrigger>
                                          </FormControl>
                                          <SelectContent>
                                            {tariffCodes.map((tariff) => (
                                              <SelectItem key={tariff.value} value={tariff.value}>
                                                {tariff.label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              </>
                            )}

                            <div className={parsedBillData ? "bg-amber-500/5 border border-amber-500/20 rounded-lg p-4" : ""}>
                              {parsedBillData && (
                                <div className="flex items-center gap-2 mb-3">
                                  <AlertCircle className="w-4 h-4 text-amber-500" />
                                  <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                                    {language === "fr" ? "À compléter" : "To complete"}
                                  </span>
                                </div>
                              )}
                              
                              <div className="grid sm:grid-cols-2 gap-4">
                                <FormField
                                  control={form.control}
                                  name="firstName"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="flex items-center gap-1">
                                        <User className="w-3 h-3" />
                                        {language === "fr" ? "Prénom du signataire" : "Signer first name"} *
                                        {!field.value && parsedBillData && (
                                          <Badge variant="outline" className="ml-auto text-xs border-amber-500/30 text-amber-600 dark:text-amber-400">
                                            {language === "fr" ? "Requis" : "Required"}
                                          </Badge>
                                        )}
                                      </FormLabel>
                                      <FormControl>
                                        <Input 
                                          {...field} 
                                          data-testid="input-first-name" 
                                          placeholder={language === "fr" ? "Ex: Jean" : "Ex: John"}
                                          className={!field.value && parsedBillData ? "border-amber-500/30" : ""}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                
                                <FormField
                                  control={form.control}
                                  name="lastName"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="flex items-center gap-1">
                                        <User className="w-3 h-3" />
                                        {language === "fr" ? "Nom de famille" : "Last name"} *
                                        {!field.value && parsedBillData && (
                                          <Badge variant="outline" className="ml-auto text-xs border-amber-500/30 text-amber-600 dark:text-amber-400">
                                            {language === "fr" ? "Requis" : "Required"}
                                          </Badge>
                                        )}
                                      </FormLabel>
                                      <FormControl>
                                        <Input 
                                          {...field} 
                                          data-testid="input-last-name" 
                                          placeholder={language === "fr" ? "Ex: Tremblay" : "Ex: Smith"}
                                          className={!field.value && parsedBillData ? "border-amber-500/30" : ""}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                              
                              <div className="grid sm:grid-cols-2 gap-4 mt-4">
                                <FormField
                                  control={form.control}
                                  name="signerTitle"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="flex items-center gap-1">
                                        <Award className="w-3 h-3" />
                                        {language === "fr" ? "Titre / Fonction" : "Title / Position"} *
                                        {!field.value && parsedBillData && (
                                          <Badge variant="outline" className="ml-auto text-xs border-amber-500/30 text-amber-600 dark:text-amber-400">
                                            {language === "fr" ? "Requis" : "Required"}
                                          </Badge>
                                        )}
                                      </FormLabel>
                                      <FormControl>
                                        <Input 
                                          {...field} 
                                          data-testid="input-signer-title" 
                                          placeholder={language === "fr" ? "Ex: Président, DG, VP Finances..." : "Ex: President, CEO, VP Finance..."}
                                          className={!field.value && parsedBillData ? "border-amber-500/30" : ""}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                
                                <FormField
                                  control={form.control}
                                  name="email"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="flex items-center gap-1">
                                        <Mail className="w-3 h-3" />
                                        {language === "fr" ? "Courriel" : "Email"} *
                                        {!field.value && parsedBillData && (
                                          <Badge variant="outline" className="ml-auto text-xs border-amber-500/30 text-amber-600 dark:text-amber-400">
                                            {language === "fr" ? "Requis" : "Required"}
                                          </Badge>
                                        )}
                                      </FormLabel>
                                      <FormControl>
                                        <Input 
                                          type="email" 
                                          {...field} 
                                          data-testid="input-email"
                                          className={!field.value && parsedBillData ? "border-amber-500/30" : ""}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>

                              <div className="grid sm:grid-cols-2 gap-4 mt-4">
                                <FormField
                                  control={form.control}
                                  name="phone"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="flex items-center gap-1">
                                        <Phone className="w-3 h-3" />
                                        {language === "fr" ? "Téléphone" : "Phone"}
                                      </FormLabel>
                                      <FormControl>
                                        <Input type="tel" {...field} data-testid="input-phone" />
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
                                      <FormLabel>{language === "fr" ? "Code postal" : "Postal code"}</FormLabel>
                                      <FormControl>
                                        <Input {...field} placeholder="H2X 1Y4" data-testid="input-postal-code" />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                              
                              {/* Qualification Questions */}
                              <div className="grid sm:grid-cols-2 gap-4 mt-4">
                                {/* Roof Age */}
                                <FormField
                                  control={form.control}
                                  name="roofAgeYears"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="flex items-center gap-1">
                                        {language === "fr" ? "Âge de la toiture" : "Roof age"}
                                      </FormLabel>
                                      <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                          <SelectTrigger data-testid="select-roof-age">
                                            <SelectValue placeholder={language === "fr" ? "Sélectionner..." : "Select..."} />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          <SelectItem value="5">{language === "fr" ? "< 5 ans" : "< 5 years"}</SelectItem>
                                          <SelectItem value="10">5-10 {language === "fr" ? "ans" : "years"}</SelectItem>
                                          <SelectItem value="15">10-15 {language === "fr" ? "ans" : "years"}</SelectItem>
                                          <SelectItem value="20">15-20 {language === "fr" ? "ans" : "years"}</SelectItem>
                                          <SelectItem value="25">{language === "fr" ? "> 20 ans" : "> 20 years"}</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                
                                {/* Ownership */}
                                <FormField
                                  control={form.control}
                                  name="ownershipType"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="flex items-center gap-1">
                                        {language === "fr" ? "Propriétaire du bâtiment?" : "Building owner?"}
                                      </FormLabel>
                                      <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                          <SelectTrigger data-testid="select-ownership">
                                            <SelectValue placeholder={language === "fr" ? "Sélectionner..." : "Select..."} />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          <SelectItem value="owner">{language === "fr" ? "Oui, propriétaire" : "Yes, owner"}</SelectItem>
                                          <SelectItem value="tenant">{language === "fr" ? "Non, locataire" : "No, tenant"}</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </div>

                            {/* Only show building type and monthly bill fields when no bill was uploaded (manual entry mode) */}
                            {!parsedBillData && (
                              <div className="grid sm:grid-cols-2 gap-4">
                                <FormField
                                  control={form.control}
                                  name="buildingType"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="flex items-center gap-1">
                                        <Building2 className="w-3 h-3" />
                                        {language === "fr" ? "Type de bâtiment" : "Building type"}
                                      </FormLabel>
                                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                          <SelectTrigger data-testid="select-building-type">
                                            <SelectValue placeholder={language === "fr" ? "Sélectionner..." : "Select..."} />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {buildingTypes.map((type) => (
                                            <SelectItem key={type.value} value={type.value}>
                                              {type.label}
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
                                  name="estimatedMonthlyBill"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="flex items-center gap-1">
                                        <DollarSign className="w-3 h-3" />
                                        {language === "fr" ? "Facture mensuelle approx." : "Approx. monthly bill"}
                                      </FormLabel>
                                      <FormControl>
                                        <Input 
                                          type="number" 
                                          {...field} 
                                          placeholder="5000"
                                          data-testid="input-monthly-bill" 
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            )}

                            <div className="border-t pt-6 mt-6">
                              <div className="bg-muted/50 rounded-lg p-4 border mb-4">
                                <div className="flex items-start gap-3 mb-4">
                                  <FileSignature className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                                  <div>
                                    <h3 className="font-semibold mb-1">
                                      {language === "fr" ? "Procuration Hydro-Québec" : "Hydro-Québec Authorization"}
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                      {language === "fr"
                                        ? "Cette autorisation permet à kWh Québec d'accéder à vos données de consommation Hydro-Québec pour produire votre analyse détaillée gratuite sous 5-7 jours ouvrables."
                                        : "This authorization allows kWh Québec to access your Hydro-Québec consumption data to produce your free detailed analysis within 5-7 business days."
                                      }
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="bg-background rounded-md p-4 text-sm max-h-48 overflow-y-auto border">
                                  <pre className="whitespace-pre-wrap font-sans">
                                    {language === "fr" ? procurationTextFr : procurationTextEn}
                                  </pre>
                                </div>
                              </div>

                              <FormField
                                control={form.control}
                                name="signatureCity"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="flex items-center gap-1">
                                      <MapPin className="w-3 h-3" />
                                      {language === "fr" ? "Signée à (ville)" : "Signed at (city)"} *
                                    </FormLabel>
                                    <FormControl>
                                      <Input 
                                        {...field} 
                                        placeholder={language === "fr" ? "Ex: Montréal" : "Ex: Montreal"}
                                        data-testid="input-signature-city" 
                                      />
                                    </FormControl>
                                    <FormDescription className="text-xs">
                                      {language === "fr" 
                                        ? "Ville où vous signez ce document" 
                                        : "City where you are signing this document"
                                      }
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <div className="rounded-md border p-4 bg-primary/5 space-y-4 mt-4">
                                <div className="space-y-1">
                                  <h4 className="font-medium text-sm">
                                    {language === "fr" 
                                      ? "Signez ci-dessous pour accepter la procuration *"
                                      : "Sign below to accept the authorization *"
                                    }
                                  </h4>
                                  <p className="text-xs text-muted-foreground">
                                    {language === "fr"
                                      ? `Signature de ${form.getValues().firstName || ''} ${form.getValues().lastName || 'le représentant'} pour ${form.getValues().companyName || 'l\'entreprise'}`
                                      : `Signature of ${form.getValues().firstName || ''} ${form.getValues().lastName || 'representative'} for ${form.getValues().companyName || 'company'}`
                                    }
                                  </p>
                                </div>
                                
                                <FormField
                                  control={form.control}
                                  name="procurationAccepted"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <div>
                                          <SignaturePad
                                            ref={signaturePadRef}
                                            width={500}
                                            height={150}
                                            onSignatureChange={(hasSig) => {
                                              setHasSignature(hasSig);
                                              // Use form.setValue with shouldValidate to ensure form state is properly updated
                                              form.setValue('procurationAccepted', hasSig, { 
                                                shouldValidate: true, 
                                                shouldDirty: true,
                                                shouldTouch: true 
                                              });
                                            }}
                                            clearButtonText={language === "fr" ? "Effacer" : "Clear"}
                                            signedText={language === "fr" ? "Signature capturée" : "Signature captured"}
                                          />
                                        </div>
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
                                  <FormItem className="mt-4">
                                    <FormLabel>{language === "fr" ? "Notes additionnelles" : "Additional notes"}</FormLabel>
                                    <FormControl>
                                      <Textarea 
                                        {...field} 
                                        rows={3}
                                        placeholder={language === "fr" 
                                          ? "Informations supplémentaires sur votre projet..."
                                          : "Additional information about your project..."
                                        }
                                        data-testid="input-notes" 
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            <div className="flex gap-3 pt-4">
                              <Button 
                                type="button" 
                                variant="outline"
                                className="flex-1"
                                onClick={() => setCurrentStep(1)}
                                data-testid="button-prev-step-2"
                              >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                {language === "fr" ? "Retour" : "Back"}
                              </Button>
                              <Button 
                                type="submit" 
                                className="flex-1 gap-2"
                                disabled={mutation.isPending}
                                data-testid="button-submit-form"
                                onClick={() => console.log('[Button onClick] Submit button clicked')}
                              >
                                {mutation.isPending ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    {language === "fr" ? "Envoi..." : "Sending..."}
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    {language === "fr" ? "Signer et envoyer ma procuration" : "Sign and submit my authorization"}
                                  </>
                                )}
                              </Button>
                            </div>

                            {mutation.isError && (
                              <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-md text-destructive text-sm">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                {language === "fr" 
                                  ? "Une erreur est survenue. Veuillez réessayer."
                                  : "An error occurred. Please try again."
                                }
                              </div>
                            )}
                          </motion.div>
                        )}
                      </form>
                    </Form>
                  </>
                )}
              </Card>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}
