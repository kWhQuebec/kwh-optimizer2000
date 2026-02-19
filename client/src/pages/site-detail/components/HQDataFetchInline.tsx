import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Zap, Loader2, CheckCircle2, AlertCircle, Lock, Eye, EyeOff, Clock, Mail, Timer, FileSpreadsheet, BarChart3 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface HqFetchJob {
  id: string;
  siteId: string;
  status: "pending" | "authenticating" | "fetching" | "importing" | "completed" | "failed";
  totalContracts: number;
  completedContracts: number;
  totalCsvFiles: number;
  importedCsvFiles: number;
  totalReadings: number;
  currentStage: string | null;
  currentDetail: string | null;
  errorMessage: string | null;
  contractsData: Array<{
    contractId: string;
    meterId?: string;
    address?: string;
  }> | null;
  billHistory: unknown;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface HQDataFetchInlineProps {
  siteId: string;
  onImportComplete: () => void;
  hqAccountNumber?: string | null;
  hqContractNumber?: string | null;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

function getStageLabel(stage: string | null, language: "fr" | "en"): string {
  if (!stage) return language === "fr" ? "Initialisation" : "Initializing";
  const stageMap: Record<string, { fr: string; en: string }> = {
    login: { fr: "Connexion au portail", en: "Logging into portal" },
    fetching_accounts: { fr: "Récupération des comptes", en: "Fetching accounts" },
    fetching_contracts: { fr: "Récupération des contrats", en: "Fetching contracts" },
    downloading: { fr: "Téléchargement des CSV", en: "Downloading CSVs" },
    downloading_csv: { fr: "Téléchargement des CSV", en: "Downloading CSVs" },
    importing_csv: { fr: "Importation des CSV", en: "Importing CSVs" },
    processing: { fr: "Traitement en cours", en: "Processing" },
    completed: { fr: "Terminé", en: "Completed" },
    failed: { fr: "Échoué", en: "Failed" },
  };
  return stageMap[stage]?.[language] || stage;
}

export function HQDataFetchInline({ siteId, onImportComplete, hqAccountNumber, hqContractNumber }: HQDataFetchInlineProps) {
  const { language } = useI18n();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifyEnabled, setNotifyEnabled] = useState(false);

  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<HqFetchJob | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedNotifiedRef = useRef(false);

  const isActive = job && (job.status === "pending" || job.status === "authenticating" || job.status === "fetching" || job.status === "importing");

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const startTimer = useCallback((startedAt: string | null) => {
    stopTimer();
    const startTime = startedAt ? new Date(startedAt).getTime() : Date.now();
    setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
    }, 1000);
  }, [stopTimer]);

  const pollJob = useCallback(async (id: string) => {
    try {
      const data = await apiRequest<HqFetchJob>("GET", `/api/admin/hq-data/jobs/${id}`);
      setJob(data);

      if (data.status === "completed") {
        stopPolling();
        stopTimer();
        if (data.completedAt && data.startedAt) {
          setElapsedSeconds(Math.max(0, Math.floor((new Date(data.completedAt).getTime() - new Date(data.startedAt).getTime()) / 1000)));
        }
        if (!completedNotifiedRef.current) {
          completedNotifiedRef.current = true;
          toast({
            title: language === "fr" ? "Importation terminée" : "Import completed",
            description: language === "fr"
              ? `${data.completedContracts} contrat(s), ${data.importedCsvFiles} fichier(s), ${data.totalReadings.toLocaleString()} lectures importées`
              : `${data.completedContracts} contract(s), ${data.importedCsvFiles} file(s), ${data.totalReadings.toLocaleString()} readings imported`,
          });
          onImportComplete();
        }
      } else if (data.status === "failed") {
        stopPolling();
        stopTimer();
        setError(data.errorMessage || (language === "fr" ? "Erreur inconnue" : "Unknown error"));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("404")) {
        stopPolling();
        stopTimer();
        setError(language === "fr" ? "Tâche introuvable" : "Job not found");
      }
    }
  }, [stopPolling, stopTimer, toast, language, onImportComplete]);

  const startPolling = useCallback((id: string) => {
    stopPolling();
    pollJob(id);
    pollingRef.current = setInterval(() => pollJob(id), 2000);
  }, [stopPolling, pollJob]);

  useEffect(() => {
    let cancelled = false;
    const checkActive = async () => {
      try {
        const data = await apiRequest<{ job: HqFetchJob | null }>("GET", "/api/admin/hq-data/active-job");
        if (cancelled) return;
        if (data.job && data.job.siteId === siteId) {
          setJob(data.job);
          setJobId(data.job.id);
          completedNotifiedRef.current = false;
          setDialogOpen(true);
          startTimer(data.job.startedAt);
          startPolling(data.job.id);
        }
      } catch {}
    };
    checkActive();
    return () => {
      cancelled = true;
    };
  }, [siteId, startTimer, startPolling]);

  useEffect(() => {
    return () => {
      stopTimer();
      stopPolling();
    };
  }, [stopTimer, stopPolling]);

  const startFetch = async () => {
    setIsStarting(true);
    setError(null);
    setJob(null);
    setJobId(null);
    completedNotifiedRef.current = false;

    try {
      const body: Record<string, unknown> = {
        username,
        password,
        siteId,
      };
      if (hqAccountNumber) {
        body.filterAccountNumbers = [hqAccountNumber.replace(/\s/g, "")];
      }
      if (hqContractNumber) {
        body.filterContractNumbers = [hqContractNumber.replace(/\s/g, "")];
      }
      if (notifyEnabled && notifyEmail.trim()) {
        body.notifyEmail = notifyEmail.trim();
      }

      const data = await apiRequest<{ jobId: string; status: string; error?: string; job?: HqFetchJob }>(
        "POST",
        "/api/admin/hq-data/start-job",
        body
      );

      if (data.error === "already_running" && data.job) {
        setJob(data.job);
        setJobId(data.jobId);
        startTimer(data.job.startedAt);
        startPolling(data.jobId);
        toast({
          title: language === "fr" ? "Tâche déjà en cours" : "Job already running",
          description: language === "fr"
            ? "Une récupération est déjà en cours pour ce site."
            : "A fetch is already running for this site.",
        });
      } else {
        setJobId(data.jobId);
        startTimer(null);
        startPolling(data.jobId);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsStarting(false);
    }
  };

  const contractsProgress = job && job.totalContracts > 0
    ? Math.round((job.completedContracts / job.totalContracts) * 100)
    : 0;

  const csvProgress = job && job.totalCsvFiles > 0
    ? Math.round((job.importedCsvFiles / job.totalCsvFiles) * 100)
    : 0;

  const estimatedRemaining = (() => {
    if (!isActive || contractsProgress <= 0 || elapsedSeconds < 5) return null;
    const totalEstimate = Math.round(elapsedSeconds / (contractsProgress / 100));
    const remaining = Math.max(0, totalEstimate - elapsedSeconds);
    return remaining;
  })();

  const handleOpenDialog = () => {
    setDialogOpen(true);
    if (!isActive && job?.status !== "completed") {
      setError(null);
      setJob(null);
      setJobId(null);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={handleOpenDialog}
        data-testid="button-hq-fetch-open"
      >
        <Zap className="w-4 h-4 mr-2" />
        {language === "fr" ? "Récupérer depuis Hydro-Québec" : "Fetch from Hydro-Québec"}
        {isActive && (
          <Badge variant="secondary" className="ml-2">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            {contractsProgress}%
          </Badge>
        )}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-hq-dialog-title">
              {language === "fr" ? "Récupérer depuis Hydro-Québec" : "Fetch from Hydro-Québec"}
            </DialogTitle>
            <DialogDescription>
              {language === "fr"
                ? "Connectez-vous au portail Hydro-Québec pour récupérer et importer automatiquement les données de consommation."
                : "Connect to the Hydro-Québec portal to automatically retrieve and import consumption data."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!isActive && job?.status !== "completed" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-md">
                    <Lock className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {language === "fr" ? "Identifiants Hydro-Québec" : "Hydro-Québec Credentials"}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hq-inline-username">
                    {language === "fr" ? "Courriel / Nom d'utilisateur" : "Email / Username"}
                  </Label>
                  <Input
                    id="hq-inline-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={language === "fr" ? "votre@courriel.com" : "your@email.com"}
                    disabled={isStarting}
                    data-testid="input-hq-inline-username"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hq-inline-password">
                    {language === "fr" ? "Mot de passe" : "Password"}
                  </Label>
                  <div className="relative">
                    <Input
                      id="hq-inline-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isStarting}
                      data-testid="input-hq-inline-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0"
                      onClick={() => setShowPassword(!showPassword)}
                      data-testid="button-hq-toggle-password"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Lock className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>
                    {language === "fr"
                      ? "Vos identifiants ne sont pas stockés et sont utilisés uniquement pour la session en cours."
                      : "Your credentials are not stored and are only used for the current session."}
                  </span>
                </div>

                {(hqAccountNumber || hqContractNumber) && (
                  <div className="flex items-start gap-2 text-xs p-2 rounded-md bg-primary/5 border border-primary/10">
                    <FileSpreadsheet className="w-3 h-3 mt-0.5 shrink-0 text-primary" />
                    <span>
                      {language === "fr"
                        ? `Récupération ciblée — seules les données liées à ce site seront téléchargées${hqAccountNumber ? ` (compte ${hqAccountNumber})` : ""}${hqContractNumber ? ` (contrat ${hqContractNumber})` : ""}.`
                        : `Targeted fetch — only data related to this site will be downloaded${hqAccountNumber ? ` (account ${hqAccountNumber})` : ""}${hqContractNumber ? ` (contract ${hqContractNumber})` : ""}.`}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="hq-notify-email"
                    checked={notifyEnabled}
                    onChange={(e) => setNotifyEnabled(e.target.checked)}
                    disabled={isStarting}
                    className="accent-primary"
                    data-testid="checkbox-hq-notify-email"
                  />
                  <label htmlFor="hq-notify-email" className="text-sm cursor-pointer select-none">
                    <Mail className="w-3.5 h-3.5 inline mr-1.5 text-muted-foreground" />
                    {language === "fr"
                      ? "M'avertir par courriel quand c'est terminé"
                      : "Notify me by email when it's done"}
                  </label>
                </div>

                {notifyEnabled && (
                  <div className="space-y-2">
                    <Label htmlFor="hq-notify-email-input">
                      {language === "fr" ? "Courriel de notification" : "Notification email"}
                    </Label>
                    <Input
                      id="hq-notify-email-input"
                      type="email"
                      value={notifyEmail}
                      onChange={(e) => setNotifyEmail(e.target.value)}
                      placeholder={language === "fr" ? "votre@courriel.com" : "your@email.com"}
                      disabled={isStarting}
                      data-testid="input-hq-notify-email"
                    />
                  </div>
                )}

                <Button
                  onClick={startFetch}
                  disabled={isStarting || !username || !password}
                  data-testid="button-hq-start-fetch"
                >
                  {isStarting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {language === "fr" ? "Démarrage..." : "Starting..."}
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      {language === "fr" ? "Récupérer et importer" : "Fetch & Import"}
                    </>
                  )}
                </Button>
              </div>
            )}

            {isActive && job && (
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      <span className="text-sm font-medium">
                        {language === "fr" ? "Récupération en cours" : "Fetching in progress"}
                      </span>
                    </div>
                    <Badge variant="secondary">
                      {getStageLabel(job.currentStage, language)}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Timer className="w-3.5 h-3.5" />
                      <span data-testid="text-hq-elapsed">{formatElapsed(elapsedSeconds)}</span>
                    </div>
                    {estimatedRemaining !== null && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span data-testid="text-hq-remaining">
                          ~{formatElapsed(estimatedRemaining)} {language === "fr" ? "restant" : "remaining"}
                        </span>
                      </div>
                    )}
                  </div>

                  {job.totalContracts > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
                        <span>
                          {language === "fr" ? "Contrats" : "Contracts"}: {job.completedContracts}/{job.totalContracts}
                        </span>
                        <span>{contractsProgress}%</span>
                      </div>
                      <Progress value={contractsProgress} className="h-2" data-testid="progress-hq-contracts" />
                    </div>
                  )}

                  {job.totalCsvFiles > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <FileSpreadsheet className="w-3 h-3" />
                          CSV: {job.importedCsvFiles}/{job.totalCsvFiles}
                        </span>
                        <span>{csvProgress}%</span>
                      </div>
                      <Progress value={csvProgress} className="h-1.5" data-testid="progress-hq-csv" />
                    </div>
                  )}

                  {job.currentDetail && (
                    <p className="text-xs text-muted-foreground" data-testid="text-hq-current-detail">
                      {job.currentDetail}
                    </p>
                  )}

                  {job.totalReadings > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <BarChart3 className="w-3 h-3" />
                      <span>
                        {job.totalReadings.toLocaleString()} {language === "fr" ? "lectures traitées" : "readings processed"}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {job?.status === "completed" && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-md border border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-800">
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                  <div className="space-y-2 flex-1">
                    <p className="font-medium text-sm" data-testid="text-hq-success-title">
                      {language === "fr" ? "Importation terminée avec succès" : "Import completed successfully"}
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-1.5">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-muted-foreground" />
                        <span data-testid="text-hq-result-contracts">
                          {job.completedContracts} {language === "fr" ? "contrat(s)" : "contract(s)"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-muted-foreground" />
                        <span data-testid="text-hq-result-files">
                          {job.importedCsvFiles} {language === "fr" ? "fichier(s) importé(s)" : "file(s) imported"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
                        <span data-testid="text-hq-result-readings">
                          {job.totalReadings.toLocaleString()} {language === "fr" ? "lectures" : "readings"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Timer className="w-3.5 h-3.5 text-muted-foreground" />
                        <span data-testid="text-hq-result-time">
                          {formatElapsed(elapsedSeconds)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {job.contractsData && job.contractsData.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      {language === "fr" ? "Contrats trouvés" : "Contracts found"}
                    </p>
                    <div className="space-y-1.5">
                      {job.contractsData.map((c, idx) => (
                        <div
                          key={c.contractId || idx}
                          className="flex items-center justify-between gap-3 p-2 rounded-md bg-muted/50 text-sm"
                          data-testid={`card-hq-contract-${c.contractId || idx}`}
                        >
                          <div className="min-w-0">
                            <span className="font-medium">
                              {language === "fr" ? "Contrat" : "Contract"} {c.contractId}
                            </span>
                            {c.address && (
                              <span className="text-muted-foreground ml-2 text-xs">{c.address}</span>
                            )}
                          </div>
                          {c.meterId && (
                            <Badge variant="secondary">
                              {language === "fr" ? "Compteur" : "Meter"}: {c.meterId}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && !isActive && (
              <div className="flex items-start gap-3 p-3 rounded-md border border-destructive bg-destructive/5">
                <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive text-sm">
                    {language === "fr" ? "Erreur" : "Error"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1" data-testid="text-hq-error">{error}</p>
                </div>
              </div>
            )}

            {(job?.status === "completed" || (error && !isActive)) && (
              <Button
                variant="outline"
                onClick={() => {
                  setJob(null);
                  setJobId(null);
                  setError(null);
                  setElapsedSeconds(0);
                  completedNotifiedRef.current = false;
                }}
                data-testid="button-hq-new-fetch"
              >
                <Zap className="w-4 h-4 mr-2" />
                {language === "fr" ? "Nouvelle récupération" : "New fetch"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
