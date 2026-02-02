import { useState, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import { 
  Upload, Sparkles, Loader2, CheckCircle2, FileText, 
  ArrowRight, Shield, Lock, Phone, Mail
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import logoFr from "@assets/kWh_Quebec_Logo-01_-_Rectangulaire_1764799021536.png";
import logoEn from "@assets/kWh_Quebec_Logo-02_-_Rectangle_1764799021536.png";
import hqLogo from "@assets/Screenshot_2026-01-27_at_5.26.14_PM_1769552778826.png";

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

type FlowStep = 'upload' | 'parsing' | 'extracted';

export default function AutorisationHQPage() {
  const { language } = useI18n();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  const urlParams = new URLSearchParams(window.location.search);
  const clientId = urlParams.get('clientId');
  
  const [flowStep, setFlowStep] = useState<FlowStep>('upload');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedBillData, setParsedBillData] = useState<HQBillData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  
  const currentLogo = language === "fr" ? logoFr : logoEn;
  
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
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
    
    setUploadedFile(file);
    setParseError(null);
    setFlowStep('parsing');
    
    const formData = new FormData();
    formData.append('file', file);
    
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
        setFlowStep('extracted');
      })
      .catch(() => {
        setFlowStep('upload');
        setParseError(language === "fr" 
          ? "Impossible d'analyser la facture. Réessayez ou contactez-nous."
          : "Unable to analyze the bill. Try again or contact us.");
      });
  }, [language]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    },
    maxFiles: 1
  });

  const handleProceedToAuthorization = () => {
    if (parsedBillData) {
      localStorage.setItem('kwhquebec_bill_data', JSON.stringify({
        ...parsedBillData,
        clientId,
      }));
    }
    navigate('/analyse-detaillee');
  };

  const resetFlow = () => {
    setFlowStep('upload');
    setUploadedFile(null);
    setParsedBillData(null);
    setParseError(null);
  };

  const formatNumber = (num: number | null) => {
    if (num === null) return '—';
    return num.toLocaleString(language === 'fr' ? 'fr-CA' : 'en-CA');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <Link href="/">
              <img 
                src={currentLogo} 
                alt="kWh Québec" 
                className="h-10 sm:h-12 w-auto"
                data-testid="logo-header"
              />
            </Link>
            <LanguageToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto space-y-8">
          <motion.div 
            className="text-center space-y-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight" data-testid="text-headline">
              {language === "fr" 
                ? "Autorisation d'accès aux données Hydro-Québec" 
                : "Hydro-Québec Data Access Authorization"}
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto" data-testid="text-description">
              {language === "fr" 
                ? "Signez l'autorisation pour que nous puissions accéder à vos données de consommation et vous fournir une analyse détaillée de votre potentiel solaire."
                : "Sign the authorization so we can access your consumption data and provide a detailed analysis of your solar potential."}
            </p>
          </motion.div>

          <motion.div 
            className="flex items-center justify-center gap-6 py-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <img 
              src={hqLogo} 
              alt="Hydro-Québec" 
              className="h-10 object-contain opacity-70"
              data-testid="img-hq-logo"
            />
            <div className="flex items-center gap-2 text-muted-foreground">
              <Shield className="w-5 h-5" />
              <span className="text-sm font-medium">
                {language === "fr" ? "Sécurisé" : "Secure"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Lock className="w-5 h-5" />
              <span className="text-sm font-medium">
                {language === "fr" ? "Confidentiel" : "Confidential"}
              </span>
            </div>
          </motion.div>

          <Card className="overflow-hidden" data-testid="card-main-action">
            <CardContent className="p-6 sm:p-8">
              <AnimatePresence mode="wait">
                {flowStep === 'upload' && (
                  <motion.div
                    key="upload"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-semibold text-sm">
                        1
                      </div>
                      <h2 className="text-xl font-semibold" data-testid="text-step1-title">
                        {language === "fr" ? "Téléversez votre facture Hydro-Québec" : "Upload your Hydro-Québec bill"}
                      </h2>
                    </div>

                    <div
                      {...getRootProps()}
                      className={`
                        relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all
                        ${isDragActive 
                          ? 'border-primary bg-primary/5' 
                          : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50'
                        }
                      `}
                      data-testid="dropzone-bill-upload"
                    >
                      <input {...getInputProps()} data-testid="input-file-upload" />
                      <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-lg font-medium mb-2">
                        {isDragActive 
                          ? (language === "fr" ? "Déposez le fichier ici..." : "Drop the file here...")
                          : (language === "fr" ? "Glissez-déposez votre facture" : "Drag & drop your bill")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {language === "fr" 
                          ? "ou cliquez pour sélectionner (PDF, JPG, PNG)" 
                          : "or click to select (PDF, JPG, PNG)"}
                      </p>
                      <p className="text-sm text-muted-foreground mt-4">
                        {language === "fr" 
                          ? "Notre outil va automatiquement remplir le formulaire avec vos données" 
                          : "Our tool will automatically fill the form with your data"}
                      </p>
                    </div>

                    {parseError && (
                      <p className="text-sm text-destructive text-center" data-testid="text-parse-error">
                        {parseError}
                      </p>
                    )}
                  </motion.div>
                )}

                {flowStep === 'parsing' && (
                  <motion.div
                    key="parsing"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="py-12 text-center space-y-6"
                  >
                    <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary" />
                    <div className="space-y-2">
                      <p className="text-lg font-medium" data-testid="text-parsing-status">
                        {language === "fr" ? "Analyse de votre facture en cours..." : "Analyzing your bill..."}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {uploadedFile?.name}
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                      <span className="text-sm text-primary">
                        {language === "fr" ? "Extraction des données par IA" : "AI-powered data extraction"}
                      </span>
                    </div>
                  </motion.div>
                )}

                {flowStep === 'extracted' && parsedBillData && (
                  <motion.div
                    key="extracted"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500 text-white">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <h2 className="text-xl font-semibold" data-testid="text-extracted-title">
                        {language === "fr" ? "Données extraites avec succès" : "Data extracted successfully"}
                      </h2>
                    </div>

                    <div className="bg-muted/50 rounded-lg p-4 space-y-3" data-testid="card-extracted-data">
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {language === "fr" ? "No. de compte:" : "Account #:"}
                        </span>
                        <span className="font-medium" data-testid="text-account-number">
                          {parsedBillData.accountNumber || '—'}
                        </span>
                      </div>
                      {parsedBillData.serviceAddress && (
                        <div className="flex items-start gap-2 text-sm">
                          <span className="text-muted-foreground w-28 shrink-0">
                            {language === "fr" ? "Adresse:" : "Address:"}
                          </span>
                          <span className="font-medium" data-testid="text-address">
                            {parsedBillData.serviceAddress}
                          </span>
                        </div>
                      )}
                      {parsedBillData.annualConsumptionKwh && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground w-28 shrink-0">
                            {language === "fr" ? "Consommation:" : "Consumption:"}
                          </span>
                          <span className="font-medium" data-testid="text-consumption">
                            {formatNumber(parsedBillData.annualConsumptionKwh)} kWh/
                            {language === "fr" ? "an" : "year"}
                          </span>
                        </div>
                      )}
                      {parsedBillData.tariffCode && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground w-28 shrink-0">
                            {language === "fr" ? "Tarif:" : "Rate:"}
                          </span>
                          <Badge variant="secondary" data-testid="text-tariff">
                            {parsedBillData.tariffCode}
                          </Badge>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-semibold text-sm">
                          2
                        </div>
                        <h2 className="text-xl font-semibold" data-testid="text-step2-title">
                          {language === "fr" ? "Signez l'autorisation" : "Sign the authorization"}
                        </h2>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {language === "fr" 
                          ? "Continuez pour signer l'autorisation de procuration et recevoir votre analyse détaillée."
                          : "Continue to sign the proxy authorization and receive your detailed analysis."}
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button 
                        size="lg" 
                        className="flex-1 gap-2"
                        onClick={handleProceedToAuthorization}
                        data-testid="button-proceed-authorization"
                      >
                        {language === "fr" ? "Continuer vers l'autorisation" : "Continue to authorization"}
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="lg"
                        onClick={resetFlow}
                        data-testid="button-upload-different"
                      >
                        {language === "fr" ? "Autre facture" : "Different bill"}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="border-t py-8 px-4 sm:px-6 lg:px-8 mt-auto">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-6">
              <a 
                href="tel:514.427.8871" 
                className="flex items-center gap-2 hover:text-foreground transition-colors"
                data-testid="link-phone"
              >
                <Phone className="w-4 h-4" />
                514.427.8871
              </a>
              <a 
                href="mailto:info@kwh.quebec" 
                className="flex items-center gap-2 hover:text-foreground transition-colors"
                data-testid="link-email"
              >
                <Mail className="w-4 h-4" />
                info@kwh.quebec
              </a>
            </div>
            <div className="flex items-center gap-4">
              <Link 
                href="/privacy" 
                className="hover:text-foreground transition-colors"
                data-testid="link-privacy"
              >
                {language === "fr" ? "Confidentialité" : "Privacy"}
              </Link>
              <span>© {new Date().getFullYear()} kWh Québec</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
