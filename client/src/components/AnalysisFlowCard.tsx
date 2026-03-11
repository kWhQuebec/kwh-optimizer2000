import { useState, useCallback, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import {
  CheckCircle2, ArrowRight, Loader2, Upload, Mail, Info, Calendar,
  Shield, Award
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import TurnstileWidget, { getTurnstileToken, clearTurnstileToken } from "@/components/TurnstileWidget";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { FunnelEvents, getStoredUTMParams } from "@/lib/analytics";

const CANADIAN_PHONE_REGEX = /^(\+1)?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/;

function formatPhoneNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const d = digits.startsWith('1') ? digits.slice(1) : digits;
  if (d.length === 10) {
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return raw;
}

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
}

type FlowStep = 'upload' | 'parsing' | 'extracted' | 'quickResult' | 'qualifying' | 'qualifiedResult' | 'manualEntry' | 'submitted';

type LeadColor = 'green' | 'yellow' | 'red';

interface SelfQualData {
  ownershipType: 'owner' | 'tenant_authorized' | 'tenant_pending' | 'tenant_no_auth' | '';
  paysHydroDirectly: 'yes' | 'no' | 'unknown' | '';
  roofAgeRange: 'new' | 'recent' | 'mature' | 'old' | '';
  roofUsageRight: 'yes' | 'no' | 'unknown' | '';
}

interface QualBlocker {
  key: string;
  messageFr: string;
  messageEn: string;
  actionFr: string;
  actionEn: string;
}

interface QualOutcome {
  color: LeadColor;
  blockers: QualBlocker[];
  nextStepFr: string;
  nextStepEn: string;
}

function classifyLead(data: SelfQualData, monthlyBill?: number): QualOutcome {
  const redBlockers: QualBlocker[] = [];
  const yellowBlockers: QualBlocker[] = [];

  if (data.ownershipType === 'tenant_no_auth' && data.roofUsageRight === 'no') {
    redBlockers.push({ key: 'no_roof_auth', messageFr: "Pas d'autorisation du propriétaire pour la toiture", messageEn: "No landlord authorization for roof usage", actionFr: "Obtenir une lettre d'autorisation de votre propriétaire pour l'utilisation de la toiture", actionEn: "Obtain written authorization from your landlord for roof usage" });
  }
  if (data.paysHydroDirectly === 'no') {
    redBlockers.push({ key: 'hydro_in_lease', messageFr: "L'électricité est incluse dans le bail", messageEn: "Electricity is included in the lease", actionFr: "Négocier un bail séparant les frais d'électricité, ou impliquer votre propriétaire dans le projet", actionEn: "Negotiate separate electricity costs in lease, or involve your landlord" });
  }
  if (data.roofAgeRange === 'old') {
    redBlockers.push({ key: 'roof_old', messageFr: "Toiture de plus de 25 ans", messageEn: "Roof over 25 years old", actionFr: "Planifier le remplacement de la toiture. Le solaire peut être installé immédiatement après", actionEn: "Plan roof replacement. Solar can be installed immediately after" });
  }
  if (monthlyBill !== undefined && monthlyBill > 0 && monthlyBill < 2500) {
    redBlockers.push({ key: 'bill_low', messageFr: "Facture mensuelle trop basse pour un projet C&I viable", messageEn: "Monthly bill too low for viable C&I project", actionFr: "Le solaire commercial est optimal pour des factures de 2 500$/mois et plus. Contactez-nous pour explorer d'autres options.", actionEn: "Commercial solar is optimal for bills of $2,500/month and above. Contact us to explore other options." });
  }
  if (redBlockers.length > 0) {
    return { color: 'red', blockers: redBlockers, nextStepFr: "Le solaire n'est peut-être pas la meilleure option pour vous en ce moment. Voici ce qui pourrait changer la donne:", nextStepEn: "Solar may not be the best option for you right now. Here's what could change that:" };
  }

  if (data.ownershipType === 'tenant_pending') {
    yellowBlockers.push({ key: 'auth_pending', messageFr: "Autorisation du propriétaire en cours", messageEn: "Landlord authorization in progress", actionFr: "Accélérer le processus d'approbation auprès de votre propriétaire", actionEn: "Accelerate the approval process with your landlord" });
  }
  if (data.roofAgeRange === 'mature') {
    yellowBlockers.push({ key: 'roof_mature', messageFr: "Toiture de 15-25 ans — inspection recommandée", messageEn: "Roof 15-25 years old — inspection recommended", actionFr: "Faire inspecter la toiture par un professionnel avant l'installation", actionEn: "Have roof professionally inspected before installation" });
  }
  if (data.paysHydroDirectly === 'unknown') {
    yellowBlockers.push({ key: 'hydro_unknown', messageFr: "À confirmer: paiement direct à Hydro-Québec", messageEn: "To confirm: direct payment to Hydro-Québec", actionFr: "Vérifier votre dernier compte ou contacter Hydro-Québec", actionEn: "Check your latest bill or contact Hydro-Québec directly" });
  }
  if (data.ownershipType.startsWith('tenant') && data.roofUsageRight === 'unknown') {
    yellowBlockers.push({ key: 'roof_right_unknown', messageFr: "Droit d'utilisation de la toiture à confirmer", messageEn: "Roof usage rights to be confirmed", actionFr: "Clarifier avec votre propriétaire si vous avez le droit d'utiliser la toiture", actionEn: "Clarify with your landlord whether you have roof usage rights" });
  }
  if (yellowBlockers.length > 0) {
    return { color: 'yellow', blockers: yellowBlockers, nextStepFr: "Quelques points à clarifier avant l'appel. Votre projet reste prometteur!", nextStepEn: "A few points to clarify before the call. Your project remains promising!" };
  }

  return { color: 'green', blockers: [], nextStepFr: "Votre projet a un excellent potentiel! Réservez votre appel découverte.", nextStepEn: "Your project has excellent potential! Book your discovery call." };
}

interface AnalysisFlowCardProps {
  source?: string;
  showTrustBadges?: boolean;
}

export default function AnalysisFlowCard({ source, showTrustBadges = true }: AnalysisFlowCardProps) {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [flowStep, setFlowStep] = useState<FlowStep>('upload');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedBillData, setParsedBillData] = useState<HQBillData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [quickEmail, setQuickEmail] = useState('');
  const [quickCompany, setQuickCompany] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickAddress, setQuickAddress] = useState('');
  const [manualKwh, setManualKwh] = useState('');
  const [quickAnalysisResult, setQuickAnalysisResult] = useState<any>(null);
  const [roofAgeYears, setRoofAgeYears] = useState<string>('');
  const [ownershipType, setOwnershipType] = useState<'owner' | 'tenant' | ''>('');

  const [selfQualData, setSelfQualData] = useState<SelfQualData>({
    ownershipType: '', paysHydroDirectly: '', roofAgeRange: '', roofUsageRight: '',
  });
  const [qualOutcome, setQualOutcome] = useState<QualOutcome | null>(null);

  const clientPreview = useMemo(() => {
    if (!parsedBillData?.annualConsumptionKwh) return null;
    const annualKwh = parsedBillData.annualConsumptionKwh;
    const monthlyBill = parsedBillData.estimatedMonthlyBill || (annualKwh * 0.07 / 12);
    const annualBill = monthlyBill * 12;

    const BASELINE_YIELD = 1150;
    const TEMP_COEFF = -0.004;
    const AVG_CELL_TEMP = 35;
    const STC_TEMP = 25;
    const WIRE_LOSS = 0.02;
    const INVERTER_EFF = 0.96;
    const tempLoss = 1 + TEMP_COEFF * (AVG_CELL_TEMP - STC_TEMP);
    const EFFECTIVE_YIELD = BASELINE_YIELD * tempLoss * (1 - WIRE_LOSS) * INVERTER_EFF;

    const HQ_MW_LIMIT = 1000;
    const rawSystemSize = Math.round((annualKwh * 0.7) / EFFECTIVE_YIELD);
    const systemSizeKw = Math.min(rawSystemSize, HQ_MW_LIMIT);
    const isCapped = rawSystemSize > HQ_MW_LIMIT;

    const energyRate = annualKwh > 0 ? (annualBill * 0.60) / annualKwh : 0.06061;
    const clampedRate = Math.max(0.03, Math.min(energyRate, 0.15));

    const annualProductionKwh = systemSizeKw * EFFECTIVE_YIELD;
    const estimatedSavings = Math.round(annualProductionKwh * clampedRate);

    let costOfInaction5yr = 0;
    for (let y = 0; y < 5; y++) {
      costOfInaction5yr += annualBill * Math.pow(1.035, y);
    }
    const extraCost5yr = Math.round(costOfInaction5yr - (annualBill * 5));

    return { systemSizeKw, isCapped, estimatedSavings, annualBill, extraCost5yr, costOfInaction5yr: Math.round(costOfInaction5yr) };
  }, [parsedBillData]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    FunnelEvents.formStarted('bill_upload');

    const file = acceptedFiles[0];
    const isValidType = file.type === 'application/pdf' || file.type.startsWith('image/');
    const isValidSize = file.size <= 10 * 1024 * 1024;

    if (!isValidType) {
      setParseError(language === "fr"
        ? "Format invalide. Utilisez PDF ou image (JPG, PNG)."
        : "Invalid format. Use PDF or image (JPG, PNG).");
      return;
    }
    if (!isValidSize) {
      setParseError(language === "fr"
        ? "Fichier trop volumineux. Maximum 10 Mo."
        : "File too large. Maximum 10 MB.");
      return;
    }

    FunnelEvents.billUploaded(file.type);

    setUploadedFile(file);
    setParseError(null);
    setFlowStep('parsing');

    const formData = new FormData();
    formData.append('file', file);
    const billToken = getTurnstileToken();
    if (billToken) {
      formData.append('cf-turnstile-response', billToken);
      clearTurnstileToken();
    }

    fetch('/api/parse-hq-bill', {
      method: 'POST',
      body: formData,
    })
      .then(response => {
        if (!response.ok) throw new Error('Failed to parse bill');
        return response.json();
      })
      .then(result => {
        if (!result.success || !result.data) {
          throw new Error('Failed to parse bill data');
        }
        setParsedBillData(result.data as HQBillData);
        if (result.data.clientName) setQuickCompany(result.data.clientName);
        if (result.data.serviceAddress) setQuickAddress(result.data.serviceAddress);
        setFlowStep('extracted');
        FunnelEvents.billParsed(result.data.annualConsumptionKwh || 0, result.data.confidence || 0);
        toast({
          title: t("toast.success.title"),
          description: t("toast.billParse.success"),
        });
      })
      .catch(() => {
        FunnelEvents.formError('bill_upload', 'parse_failed');
        setFlowStep('upload');
        setParseError(language === "fr"
          ? "Impossible d'analyser la facture. Réessayez ou entrez votre consommation manuellement."
          : "Unable to analyze the bill. Try again or enter your consumption manually.");
        toast({
          title: t("toast.error.title"),
          description: t("toast.billParse.error"),
          variant: "destructive",
        });
      });
  }, [language, t, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    },
    maxFiles: 1
  });

  const quickAnalysisMutation = useMutation({
    mutationFn: async (data: {
      email: string;
      annualKwh: number;
      clientName?: string;
      address?: string;
      phone?: string;
      roofAgeYears?: number;
      ownershipType?: string;
    }) => {
      const estimateToken = getTurnstileToken();
      const estimatePayload: Record<string, unknown> = {
        annualConsumptionKwh: data.annualKwh,
        email: data.email,
        clientName: data.clientName || '',
        address: data.address || '',
        phone: data.phone || '',
        roofAgeYears: data.roofAgeYears,
        ownershipType: data.ownershipType,
        language,
        source: source || undefined,
        ...getStoredUTMParams(),
      };
      if (estimateToken) {
        estimatePayload['cf-turnstile-response'] = estimateToken;
        clearTurnstileToken();
      }
      const response = await fetch('/api/quick-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(estimatePayload),
      });
      if (!response.ok) throw new Error('Failed to get quick analysis');
      return response.json();
    },
    onSuccess: (data) => {
      setQuickAnalysisResult(data);
      setFlowStep('quickResult');
    },
    onError: () => {
      FunnelEvents.formError('quick_analysis', 'api_error');
      toast({
        title: language === "fr" ? "Erreur" : "Error",
        description: language === "fr"
          ? "Impossible de générer l'analyse. Veuillez réessayer."
          : "Unable to generate analysis. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleQuickAnalysis = () => {
    if (!quickEmail || !quickEmail.includes('@')) {
      toast({
        title: language === "fr" ? "Courriel requis" : "Email required",
        description: language === "fr"
          ? "Veuillez entrer une adresse courriel valide."
          : "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    if (!quickAddress || quickAddress.trim() === '') {
      toast({
        title: language === "fr" ? "Adresse requise" : "Address required",
        description: language === "fr"
          ? "Veuillez entrer l'adresse du bâtiment pour l'analyse."
          : "Please enter the building address for the analysis.",
        variant: "destructive",
      });
      return;
    }

    if (quickPhone && quickPhone.trim() !== '' && !CANADIAN_PHONE_REGEX.test(quickPhone)) {
      toast({
        title: t("form.invalidPhone"),
        description: language === "fr"
          ? "Veuillez entrer un numéro de téléphone canadien valide, ex: (514) 555-1234"
          : "Please enter a valid Canadian phone number, e.g. (514) 555-1234",
        variant: "destructive",
      });
      return;
    }

    const annualKwh = parsedBillData?.annualConsumptionKwh || parseInt(manualKwh) || 0;
    if (annualKwh < 1000) {
      toast({
        title: language === "fr" ? "Consommation invalide" : "Invalid consumption",
        description: language === "fr"
          ? "La consommation annuelle doit être d'au moins 1,000 kWh."
          : "Annual consumption must be at least 1,000 kWh.",
        variant: "destructive",
      });
      return;
    }

    FunnelEvents.emailCaptured('quick_estimate');
    FunnelEvents.formSubmitted('quick_analysis', parsedBillData ? 'bill_upload' : 'manual_entry');

    quickAnalysisMutation.mutate({
      email: quickEmail,
      annualKwh,
      clientName: quickCompany || parsedBillData?.clientName || undefined,
      address: quickAddress || parsedBillData?.serviceAddress || undefined,
      phone: quickPhone || undefined,
      roofAgeYears: roofAgeYears ? parseInt(roofAgeYears) : undefined,
      ownershipType: ownershipType || undefined,
    });
  };

  const handleDetailedPath = () => {
    if (!quickEmail || !quickEmail.trim()) {
      toast({
        title: language === "fr" ? "Courriel requis" : "Email required",
        description: language === "fr"
          ? "Veuillez entrer votre courriel pour accéder à l'analyse complète."
          : "Please enter your email to access the full analysis.",
        variant: "destructive",
      });
      return;
    }

    FunnelEvents.procurationStarted();

    if (parsedBillData) {
      sessionStorage.setItem('kwhquebec_bill_data', JSON.stringify({
        ...parsedBillData,
        email: quickEmail,
        companyName: quickCompany,
        phone: quickPhone,
        address: quickAddress || parsedBillData.serviceAddress,
        entryMethod: 'bill_upload',
      }));
    } else {
      sessionStorage.setItem('kwhquebec_bill_data', JSON.stringify({
        email: quickEmail,
        companyName: quickCompany,
        phone: quickPhone,
        address: quickAddress,
        annualConsumptionKwh: parseInt(manualKwh) || undefined,
        estimatedMonthlyBill: quickAnalysisResult?.billing?.monthlyBillBefore || undefined,
        entryMethod: 'manual',
      }));
    }
    navigate('/analyse-detaillee');
  };

  const resetFlow = () => {
    setFlowStep('upload');
    setUploadedFile(null);
    setParsedBillData(null);
    setParseError(null);
    setQuickEmail('');
    setQuickCompany('');
    setQuickPhone('');
    setQuickAddress('');
    setManualKwh('');
    setQuickAnalysisResult(null);
    setRoofAgeYears('');
    setOwnershipType('');
    setSelfQualData({ ownershipType: '', paysHydroDirectly: '', roofAgeRange: '', roofUsageRight: '' });
    setQualOutcome(null);
  };

  return (
    <div className="space-y-4">
      <Card className="max-w-2xl mx-auto border-2 border-primary/20 shadow-xl">
        <CardContent className="p-6 sm:p-8" aria-live="polite">
          {(flowStep === 'upload' || flowStep === 'manualEntry') && (
            <div role="tablist" aria-label={language === "fr" ? "Méthode d'entrée" : "Input method"} className="flex gap-2 mb-4" data-testid="tablist-input-method">
              <button
                role="tab"
                aria-selected={flowStep === 'upload'}
                aria-controls="tabpanel-upload"
                id="tab-upload"
                onClick={() => setFlowStep('upload')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${flowStep === 'upload' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                data-testid="tab-upload"
              >
                {language === "fr" ? "Téléverser une facture" : "Upload a bill"}
              </button>
              <button
                role="tab"
                aria-selected={flowStep === 'manualEntry'}
                aria-controls="tabpanel-manual"
                id="tab-manual"
                onClick={() => {
                  FunnelEvents.formStarted('manual_entry');
                  setFlowStep('manualEntry');
                }}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${flowStep === 'manualEntry' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                data-testid="tab-manual-entry"
              >
                {language === "fr" ? "Saisie manuelle" : "Manual entry"}
              </button>
            </div>
          )}
          <AnimatePresence mode="wait">
            {flowStep === 'upload' && (
              <motion.div
                key="upload"
                id="tabpanel-upload"
                role="tabpanel"
                aria-labelledby="tab-upload"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="space-y-2 text-center">
                  <h2 className="text-xl sm:text-2xl font-semibold">
                    {language === "fr"
                      ? <>Téléversez une facture récente <span style={{ fontSize: '18px' }}>(moins de 3 mois)</span></>
                      : <>Upload a recent bill <span style={{ fontSize: '18px' }}>(less than 3 months old)</span></>}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {language === "fr"
                      ? <><span className="underline">Si vous avez plusieurs compteurs</span>, ajoutez une facture par compte et notre outil d'analyse fera le tri pour vous.</>
                      : <><span className="underline">If you have multiple meters</span>, add one bill per account and our analysis tool will sort them for you.</>}
                  </p>
                </div>

                <div
                  {...getRootProps()}
                  role="button"
                  tabIndex={0}
                  data-testid="dropzone-bill"
                  className={`border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all ${
                    isDragActive
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30"
                  }`}
                >
                  <input {...getInputProps()} />
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="p-4 rounded-full bg-primary/10">
                      <Upload aria-hidden="true" className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {isDragActive
                          ? (language === "fr" ? "Déposez ici..." : "Drop here...")
                          : (language === "fr" ? "Glissez votre (vos) facture(s) ici ou prenez une photo" : "Drag your bill(s) here or take a photo")}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {language === "fr" ? "ou cliquez pour sélectionner" : "or click to select"}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">PDF, JPG, PNG</p>
                  </div>
                </div>

                {parseError && (
                  <p className="text-sm text-destructive text-center">{parseError}</p>
                )}
              </motion.div>
            )}

            {flowStep === 'parsing' && (
              <motion.div
                key="parsing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-12 text-center space-y-4"
              >
                <Loader2 aria-hidden="true" className="w-12 h-12 text-primary animate-spin mx-auto" />
                <div>
                  <p className="font-medium">
                    {language === "fr" ? "Analyse en cours..." : "Analyzing..."}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {language === "fr"
                      ? "Notre IA lit votre facture"
                      : "Our AI is reading your bill"}
                  </p>
                </div>
              </motion.div>
            )}

            {flowStep === 'extracted' && parsedBillData && (
              <motion.div
                key="extracted"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center gap-2 text-green-600">
                    <CheckCircle2 aria-hidden="true" className="w-5 h-5" />
                    <span className="font-medium">
                      {language === "fr" ? "Facture analysée!" : "Bill analyzed!"}
                    </span>
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  {parsedBillData.clientName && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{language === "fr" ? "Client" : "Client"}</span>
                      <span className="font-medium">{parsedBillData.clientName}</span>
                    </div>
                  )}
                  {parsedBillData.serviceAddress && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{language === "fr" ? "Adresse" : "Address"}</span>
                      <span className="font-medium truncate max-w-[200px]">{parsedBillData.serviceAddress}</span>
                    </div>
                  )}
                  {parsedBillData.annualConsumptionKwh && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{language === "fr" ? "Consommation" : "Consumption"}</span>
                      <span className="font-medium text-primary">{parsedBillData.annualConsumptionKwh.toLocaleString()} kWh/an</span>
                    </div>
                  )}
                </div>

                {clientPreview && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-center text-primary">
                      {language === "fr" ? "Potentiel estimé de votre bâtiment" : "Your building's estimated potential"}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-primary/5 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-primary" data-testid="text-system-size-kw">{clientPreview.systemSizeKw}</p>
                        <p className="text-xs text-muted-foreground">
                          {language === "fr" ? "kWc recommandés" : "kWp recommended"}
                        </p>
                        {clientPreview.isCapped && (
                          <p className="text-[10px] text-amber-600 mt-0.5">
                            {language === "fr" ? "plafonné à 1 MW (incitatifs)" : "capped at 1 MW (incentives)"}
                          </p>
                        )}
                      </div>
                      <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-green-600" data-testid="text-estimated-savings">${clientPreview.estimatedSavings.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">
                          {language === "fr" ? "économies estimées/an" : "est. savings/yr"}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                          {language === "fr" ? "sur votre facture" : "on your bill"}
                        </p>
                      </div>
                      <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-red-500" data-testid="text-inaction-cost">+${clientPreview.extraCost5yr.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">
                          {language === "fr" ? "hausse prévue sur 5 ans" : "projected increase over 5 yrs"}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                          {language === "fr" ? "sans solaire" : "without solar"}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-center text-red-500/80">
                      {language === "fr"
                        ? `Ne rien faire vous coûtera ${clientPreview.costOfInaction5yr.toLocaleString()}$ sur 5 ans avec la hausse des tarifs Hydro-Québec.`
                        : `Doing nothing will cost you $${clientPreview.costOfInaction5yr.toLocaleString()} over 5 years with Hydro-Québec rate increases.`}
                    </p>
                  </div>
                )}

                <div className="space-y-3 pt-2 border-t">
                  <p className="text-sm font-medium text-center">
                    {language === "fr"
                      ? "Recevez votre rapport complet avec les options de financement"
                      : "Get your full report with financing options"}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium">
                        {language === "fr" ? "Nom de l'entreprise" : "Company name"} <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="text"
                        placeholder={language === "fr" ? "Nom de l'entreprise" : "Company name"}
                        value={quickCompany}
                        onChange={(e) => setQuickCompany(e.target.value)}
                        data-testid="input-quick-company"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium">
                        {t("form.email")} <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="email"
                        placeholder={t("form.email")}
                        value={quickEmail}
                        onChange={(e) => setQuickEmail(e.target.value)}
                        data-testid="input-quick-email"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium">
                        {t("form.phone")} <span className="text-muted-foreground font-normal">{t("form.optional")}</span>
                      </label>
                      <Input
                        type="tel"
                        placeholder="(514) 555-1234"
                        value={quickPhone}
                        onChange={(e) => setQuickPhone(e.target.value)}
                        onBlur={() => { if (quickPhone) setQuickPhone(formatPhoneNumber(quickPhone)); }}
                        data-testid="input-quick-phone"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium">
                        {language === "fr" ? "Adresse du bâtiment" : "Building address"} <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="text"
                        placeholder={language === "fr" ? "Adresse du bâtiment" : "Building address"}
                        value={quickAddress}
                        onChange={(e) => setQuickAddress(e.target.value)}
                        data-testid="input-quick-address"
                      />
                    </div>
                  </div>
                  <TurnstileWidget size="compact" className="flex justify-center mb-3" />
                  <Button
                    onClick={handleQuickAnalysis}
                    disabled={quickAnalysisMutation.isPending || !quickEmail || !quickCompany}
                    className="w-full gap-2 h-11"
                    data-testid="button-submit-quick"
                  >
                    {quickAnalysisMutation.isPending ? (
                      <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRight aria-hidden="true" className="w-4 h-4" />
                    )}
                    {language === "fr" ? "Recevoir mon rapport gratuit" : "Get my free report"}
                  </Button>
                  <p className="text-[11px] text-center text-muted-foreground">
                    {language === "fr" ? "Gratuit et sans engagement" : "Free, no commitment"}
                  </p>
                </div>

                <div className="text-center">
                  <button onClick={resetFlow} className="text-xs text-muted-foreground hover:underline" data-testid="button-reset-flow">
                    {language === "fr" ? "← Recommencer" : "← Start over"}
                  </button>
                </div>
              </motion.div>
            )}

            {flowStep === 'quickResult' && quickAnalysisResult && (
              <motion.div
                key="quickResult"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="text-center space-y-2">
                  <CheckCircle2 aria-hidden="true" className="w-10 h-10 text-green-500 mx-auto" />
                  <h3 className="text-lg font-semibold">
                    {language === "fr" ? "Rapport envoyé!" : "Report sent!"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {language === "fr"
                      ? "Vérifiez votre boîte de réception."
                      : "Check your inbox."}
                  </p>
                </div>

                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
                  <p className="text-sm font-medium text-center">
                    {language === "fr"
                      ? "Voyons si votre bâtiment est un bon candidat pour le solaire"
                      : "Let's see if your building is a good solar candidate"}
                  </p>
                  <p className="text-xs text-muted-foreground text-center">
                    {language === "fr"
                      ? "Quelques questions rapides (30 secondes) pour une recommandation personnalisée"
                      : "A few quick questions (30 seconds) for a personalized recommendation"}
                  </p>
                  <Button
                    onClick={() => setFlowStep('qualifying')}
                    className="w-full gap-2"
                    data-testid="button-start-qualification"
                  >
                    <ArrowRight aria-hidden="true" className="w-4 h-4" />
                    {language === "fr" ? "Continuer →" : "Continue →"}
                  </Button>
                </div>

                <button onClick={resetFlow} className="w-full text-sm text-muted-foreground hover:underline" data-testid="button-new-analysis">
                  {language === "fr" ? "Nouvelle analyse" : "New analysis"}
                </button>
              </motion.div>
            )}

            {flowStep === 'qualifying' && (
              <motion.div
                key="qualifying"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="text-center space-y-1">
                  <h3 className="text-lg font-semibold">
                    {language === "fr" ? "Parlons de votre bâtiment" : "Tell us about your building"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {language === "fr" ? "Quelques questions rapides · 30 secondes" : "A few quick questions · 30 seconds"}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold">
                    {language === "fr" ? "Êtes-vous propriétaire de l'immeuble?" : "Do you own the building?"}
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {([
                      { value: 'owner', fr: 'Propriétaire', en: 'Owner' },
                      { value: 'tenant_authorized', fr: 'Locataire avec autorisation', en: 'Tenant with authorization' },
                      { value: 'tenant_pending', fr: 'Locataire (en attente)', en: 'Tenant (pending auth)' },
                      { value: 'tenant_no_auth', fr: 'Locataire (sans autorisation)', en: 'Tenant (no authorization)' },
                    ] as const).map((opt) => (
                      <div
                        key={opt.value}
                        onClick={() => setSelfQualData({ ...selfQualData, ownershipType: opt.value })}
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all text-sm font-medium ${
                          selfQualData.ownershipType === opt.value
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-input hover:border-primary'
                        }`}
                      >
                        {language === "fr" ? opt.fr : opt.en}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold">
                    {language === "fr" ? "Payez-vous Hydro-Québec directement?" : "Do you pay Hydro-Québec directly?"}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { value: 'yes', fr: 'Oui', en: 'Yes' },
                      { value: 'no', fr: 'Non (bail)', en: 'No (lease)' },
                      { value: 'unknown', fr: 'Je ne sais pas', en: 'Not sure' },
                    ] as const).map((opt) => (
                      <div
                        key={opt.value}
                        onClick={() => setSelfQualData({ ...selfQualData, paysHydroDirectly: opt.value })}
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all text-sm font-medium text-center ${
                          selfQualData.paysHydroDirectly === opt.value
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-input hover:border-primary'
                        }`}
                      >
                        {language === "fr" ? opt.fr : opt.en}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold">
                    {language === "fr" ? "Âge approximatif de la toiture?" : "Approximate roof age?"}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { value: 'new', fr: '0-5 ans', en: '0-5 years' },
                      { value: 'recent', fr: '5-15 ans', en: '5-15 years' },
                      { value: 'mature', fr: '15-25 ans', en: '15-25 years' },
                      { value: 'old', fr: '25+ ans', en: '25+ years' },
                    ] as const).map((opt) => (
                      <div
                        key={opt.value}
                        onClick={() => setSelfQualData({ ...selfQualData, roofAgeRange: opt.value })}
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all text-sm font-medium text-center ${
                          selfQualData.roofAgeRange === opt.value
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-input hover:border-primary'
                        }`}
                      >
                        {language === "fr" ? opt.fr : opt.en}
                      </div>
                    ))}
                  </div>
                </div>

                {selfQualData.ownershipType.startsWith('tenant') && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2">
                    <label className="block text-sm font-semibold">
                      {language === "fr" ? "Avez-vous le droit d'utiliser la toiture?" : "Do you have roof usage rights?"}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { value: 'yes', fr: 'Oui', en: 'Yes' },
                        { value: 'no', fr: 'Non', en: 'No' },
                        { value: 'unknown', fr: 'Je ne sais pas', en: 'Not sure' },
                      ] as const).map((opt) => (
                        <div
                          key={opt.value}
                          onClick={() => setSelfQualData({ ...selfQualData, roofUsageRight: opt.value })}
                          className={`p-3 rounded-lg border-2 cursor-pointer transition-all text-sm font-medium text-center ${
                            selfQualData.roofUsageRight === opt.value
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'border-input hover:border-primary'
                          }`}
                        >
                          {language === "fr" ? opt.fr : opt.en}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                <Button
                  onClick={async () => {
                    const outcome = classifyLead(selfQualData, quickAnalysisResult?.estimatedMonthlyBill);
                    setQualOutcome(outcome);
                    setFlowStep('qualifiedResult');
                    if (quickAnalysisResult?.leadId) {
                      try {
                        const qualToken = getTurnstileToken();
                        const qualPayload: Record<string, unknown> = { ...selfQualData, leadColor: outcome.color };
                        if (qualToken) {
                          qualPayload['cf-turnstile-response'] = qualToken;
                          clearTurnstileToken();
                        }
                        await fetch(`/api/leads/${quickAnalysisResult.leadId}/self-qualification`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(qualPayload),
                        });
                      } catch (e) { console.error('Failed to save qualification:', e); }
                    }
                  }}
                  disabled={
                    !selfQualData.ownershipType ||
                    !selfQualData.paysHydroDirectly ||
                    !selfQualData.roofAgeRange ||
                    (selfQualData.ownershipType.startsWith('tenant') && !selfQualData.roofUsageRight)
                  }
                  className="w-full gap-2"
                  data-testid="button-submit-qualification"
                >
                  <ArrowRight aria-hidden="true" className="w-4 h-4" />
                  {language === "fr" ? "Voir mes résultats →" : "See my results →"}
                </Button>
              </motion.div>
            )}

            {flowStep === 'qualifiedResult' && qualOutcome && (
              <motion.div
                key="qualifiedResult"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {qualOutcome.color === 'green' && (
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle2 aria-hidden="true" className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="text-xl font-bold text-green-700">
                      {language === "fr" ? "Excellent potentiel solaire!" : "Excellent solar potential!"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {language === "fr"
                        ? "Votre bâtiment a toutes les conditions réunies pour un projet solaire rentable."
                        : "Your building meets all conditions for a profitable solar project."}
                    </p>
                    <a
                      href={language === "fr"
                        ? "mailto:ventes@kwh.quebec?subject=Demande%20appel%20d%C3%A9couverte&body=Bonjour%2C%20j'aimerais%20planifier%20un%20appel%20d%C3%A9couverte%20pour%20mon%20projet%20solaire."
                        : "mailto:sales@kwh.quebec?subject=Discovery%20call%20request&body=Hello%2C%20I'd%20like%20to%20schedule%20a%20discovery%20call%20for%20my%20solar%20project."}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white font-semibold transition-opacity hover:opacity-90 bg-green-600"
                      data-testid="link-discovery-call-green"
                    >
                      <Calendar aria-hidden="true" className="w-4 h-4" />
                      {language === "fr" ? "Demander un appel découverte (10 min) →" : "Request a discovery call (10 min) →"}
                    </a>
                    <button onClick={handleDetailedPath} className="block w-full text-sm text-primary hover:underline" data-testid="button-detailed-analysis">
                      {language === "fr" ? "Ou voir mon analyse complète" : "Or view my complete analysis"}
                    </button>
                    <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-3 text-left">
                      <p className="text-xs font-semibold text-blue-800 mb-1">
                        {language === "fr" ? "Points investigués lors de la visite de site:" : "Items investigated during site visit:"}
                      </p>
                      <div className="grid grid-cols-2 gap-1 text-xs text-blue-700">
                        <span>⚡ {language === "fr" ? "Capacité électrique" : "Electrical capacity"}</span>
                        <span>🏗️ {language === "fr" ? "Structure du bâtiment" : "Building structure"}</span>
                        <span>🔌 {language === "fr" ? "Interconnexion HQ" : "HQ interconnection"}</span>
                        <span>🏠 {language === "fr" ? "État de la toiture" : "Roof condition"}</span>
                      </div>
                    </div>
                  </div>
                )}

                {qualOutcome.color === 'yellow' && (
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
                      <Info aria-hidden="true" className="w-8 h-8 text-amber-600" />
                    </div>
                    <h3 className="text-xl font-bold text-amber-700">
                      {language === "fr" ? "Bon potentiel — quelques points à clarifier" : "Good potential — a few points to clarify"}
                    </h3>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-left space-y-1">
                      {qualOutcome.blockers.map((b, i) => (
                        <p key={i} className="text-sm text-amber-900">• {language === "fr" ? b.messageFr : b.messageEn}</p>
                      ))}
                    </div>
                    <a
                      href={language === "fr"
                        ? "mailto:ventes@kwh.quebec?subject=Demande%20appel%20d%C3%A9couverte&body=Bonjour%2C%20j'aimerais%20planifier%20un%20appel%20d%C3%A9couverte%20pour%20mon%20projet%20solaire."
                        : "mailto:sales@kwh.quebec?subject=Discovery%20call%20request&body=Hello%2C%20I'd%20like%20to%20schedule%20a%20discovery%20call%20for%20my%20solar%20project."}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white font-semibold transition-opacity hover:opacity-90"
                      style={{ backgroundColor: '#003DA6' }}
                      data-testid="link-discovery-call-yellow"
                    >
                      <Calendar aria-hidden="true" className="w-4 h-4" />
                      {language === "fr" ? "Demander un appel découverte (10 min) →" : "Request a discovery call (10 min) →"}
                    </a>
                    <p className="text-xs text-muted-foreground">
                      {language === "fr"
                        ? "Nos experts vous aideront à résoudre ces points"
                        : "Our experts will help resolve these points"}
                    </p>
                    <button onClick={handleDetailedPath} className="block w-full text-sm text-primary hover:underline" data-testid="button-detailed-analysis-yellow">
                      {language === "fr" ? "Ou voir mon analyse complète" : "Or view my complete analysis"}
                    </button>
                  </div>
                )}

                {qualOutcome.color === 'red' && (
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                      <Info aria-hidden="true" className="w-8 h-8 text-slate-500" />
                    </div>
                    <h3 className="text-lg font-bold">
                      {language === "fr"
                        ? "Le solaire n'est pas optimal pour vous en ce moment"
                        : "Solar isn't optimal for you right now"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {language === "fr"
                        ? "Mais voici ce qui pourrait changer la donne:"
                        : "But here's what could change that:"}
                    </p>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-left space-y-3">
                      {qualOutcome.blockers.map((b, i) => (
                        <div key={i} className="text-sm">
                          <p className="font-semibold text-slate-800">• {language === "fr" ? b.messageFr : b.messageEn}</p>
                          <p className="text-slate-600 ml-4 text-xs italic">
                            {"→ "}{language === "fr" ? b.actionFr : b.actionEn}
                          </p>
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {language === "fr"
                        ? "Quand ces points seront réglés, n'hésitez pas à nous recontacter."
                        : "When these points are resolved, don't hesitate to reach out again."}
                    </p>
                    <a
                      href={language === "fr"
                        ? "mailto:info@kwh.quebec?subject=Int%C3%A9r%C3%AAt%20futur%20solaire&body=Bonjour%2C%20je%20souhaite%20%C3%AAtre%20contact%C3%A9(e)%20lorsque%20les%20conditions%20seront%20r%C3%A9unies%20pour%20mon%20projet%20solaire."
                        : "mailto:info@kwh.quebec?subject=Future%20solar%20interest&body=Hello%2C%20I'd%20like%20to%20be%20contacted%20when%20conditions%20are%20right%20for%20my%20solar%20project."}
                      className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover-elevate"
                      data-testid="link-contact-later"
                    >
                      <Mail aria-hidden="true" className="w-4 h-4" />
                      {language === "fr" ? "Nous contacter quand je serai prêt" : "Contact us when I'm ready"}
                    </a>
                    <button onClick={resetFlow} className="w-full text-sm text-muted-foreground hover:underline" data-testid="button-new-analysis-red">
                      {language === "fr" ? "Nouvelle analyse" : "New analysis"}
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {flowStep === 'manualEntry' && (
              <motion.div
                key="manualEntry"
                id="tabpanel-manual"
                role="tabpanel"
                aria-labelledby="tab-manual"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="text-center space-y-1">
                  <h3 className="text-lg font-semibold">
                    {language === "fr" ? "Entrez vos informations" : "Enter your information"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {language === "fr"
                      ? "Trouvez votre consommation sur votre facture Hydro-Québec"
                      : "Find your consumption on your Hydro-Québec bill"}
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-muted-foreground">
                      {language === "fr" ? "Consommation annuelle (kWh)" : "Annual consumption (kWh)"}
                    </label>
                    <Input
                      type="number"
                      placeholder="ex: 150000"
                      value={manualKwh}
                      onChange={(e) => setManualKwh(e.target.value)}
                      className="text-center text-lg"
                      data-testid="input-manual-kwh"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium">
                        {language === "fr" ? "Nom de l'entreprise" : "Company name"} <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="text"
                        placeholder={language === "fr" ? "Nom de l'entreprise" : "Company name"}
                        value={quickCompany}
                        onChange={(e) => setQuickCompany(e.target.value)}
                        data-testid="input-manual-company"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium">
                        {t("form.email")} <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="email"
                        placeholder={t("form.email")}
                        value={quickEmail}
                        onChange={(e) => setQuickEmail(e.target.value)}
                        data-testid="input-manual-email"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium">
                        {t("form.phone")} <span className="text-muted-foreground font-normal">{t("form.optional")}</span>
                      </label>
                      <Input
                        type="tel"
                        placeholder="(514) 555-1234"
                        value={quickPhone}
                        onChange={(e) => setQuickPhone(e.target.value)}
                        onBlur={() => { if (quickPhone) setQuickPhone(formatPhoneNumber(quickPhone)); }}
                        data-testid="input-manual-phone"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium">
                        {language === "fr" ? "Adresse du bâtiment" : "Building address"} <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="text"
                        placeholder={language === "fr" ? "Adresse du bâtiment" : "Building address"}
                        value={quickAddress}
                        onChange={(e) => setQuickAddress(e.target.value)}
                        data-testid="input-manual-address"
                      />
                    </div>
                  </div>
                  <TurnstileWidget size="compact" className="flex justify-center mb-3" />
                  <Button
                    onClick={handleQuickAnalysis}
                    disabled={quickAnalysisMutation.isPending || !manualKwh || !quickEmail || !quickCompany}
                    className="w-full gap-2"
                    data-testid="button-submit-manual"
                  >
                    {quickAnalysisMutation.isPending ? (
                      <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRight aria-hidden="true" className="w-4 h-4" />
                    )}
                    {language === "fr" ? "Voir mon potentiel solaire" : "See my solar potential"}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {showTrustBadges && (
        <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Shield aria-hidden="true" className="w-4 h-4 text-primary" />
            <span>{language === "fr" ? "Données sécurisées" : "Secure data"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Award aria-hidden="true" className="w-4 h-4 text-primary" />
            <span>{language === "fr" ? "Équipe cumulant 15+ ans d'expérience en énergie" : "Team with 15+ yrs combined energy experience"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 aria-hidden="true" className="w-4 h-4 text-primary" />
            <span>{language === "fr" ? "100% gratuit" : "100% free"}</span>
          </div>
        </div>
      )}
    </div>
  );
}
