import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Zap, Download, Loader2, CheckCircle2, AlertCircle, FileSpreadsheet, Lock, Eye, EyeOff, Upload } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";

interface HQProgressData {
  type: "progress";
  stage: string;
  message: string;
  current: number;
  total: number;
  details?: string;
}

interface HQCsvFile {
  option: string;
  periodStart: string;
  periodEnd: string;
  csvContent: string;
  rowCount: number;
}

interface HQContractResult {
  contractId: string;
  meterId: string;
  address: string;
  csvFiles: HQCsvFile[];
}

interface HQDataFetchInlineProps {
  siteId: string;
  onImportComplete: () => void;
}

export function HQDataFetchInline({ siteId, onImportComplete }: HQDataFetchInlineProps) {
  const { language } = useI18n();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [currentProgress, setCurrentProgress] = useState<HQProgressData | null>(null);
  const [results, setResults] = useState<HQContractResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importingCsvs, setImportingCsvs] = useState<Set<string>>(new Set());
  const [importedCsvs, setImportedCsvs] = useState<Set<string>>(new Set());

  const startFetch = async () => {
    setIsRunning(true);
    setCurrentProgress(null);
    setResults(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/hq-data/fetch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const text = await response.text();
        setError(text || `${language === "fr" ? "Erreur" : "Error"} ${response.status}`);
        setIsRunning(false);
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let receivedComplete = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "progress") {
                setCurrentProgress(data);
              } else if (data.type === "complete") {
                setResults(data.results);
                receivedComplete = true;
              } else if (data.type === "error") {
                setError(data.message);
                receivedComplete = true;
              }
            } catch {}
          }
        }
      }

      if (!receivedComplete && !error) {
        setError(language === "fr"
          ? "La connexion a été interrompue avant la fin du transfert"
          : "Connection was interrupted before transfer completed");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }

    setIsRunning(false);
  };

  const importCsvToSite = async (csv: HQCsvFile, contractId: string, csvIndex: number) => {
    const csvKey = `${contractId}-${csvIndex}`;
    setImportingCsvs(prev => new Set(prev).add(csvKey));

    try {
      const blob = new Blob([csv.csvContent], { type: "text/csv;charset=utf-8;" });
      const fileName = `${contractId}_${csv.option}_${csv.periodStart}_${csv.periodEnd}.csv`;
      const file = new File([blob], fileName, { type: "text/csv" });

      const formData = new FormData();
      formData.append("files", file);

      const response = await fetch(`/api/sites/${siteId}/upload-meters`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      setImportedCsvs(prev => new Set(prev).add(csvKey));
      toast({
        title: language === "fr" ? "Fichier importé avec succès" : "File imported successfully",
      });
      onImportComplete();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast({
        title: language === "fr" ? "Erreur d'importation" : "Import error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setImportingCsvs(prev => {
        const next = new Set(prev);
        next.delete(csvKey);
        return next;
      });
    }
  };

  const downloadCsv = (csv: HQCsvFile, contractId: string) => {
    const blob = new Blob([csv.csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${contractId}_${csv.option}_${csv.periodStart}_${csv.periodEnd}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const progressPercent = currentProgress && currentProgress.total > 0
    ? Math.round((currentProgress.current / currentProgress.total) * 100)
    : 0;

  const totalCsvs = results ? results.reduce((sum, r) => sum + r.csvFiles.length, 0) : 0;
  const totalRows = results ? results.reduce((sum, r) => r.csvFiles.reduce((s, f) => s + f.rowCount, sum), 0) : 0;

  const handleOpenDialog = () => {
    setDialogOpen(true);
    setResults(null);
    setError(null);
    setCurrentProgress(null);
    setImportedCsvs(new Set());
    setImportingCsvs(new Set());
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
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-hq-dialog-title">
              {language === "fr" ? "Récupérer depuis Hydro-Québec" : "Fetch from Hydro-Québec"}
            </DialogTitle>
            <DialogDescription>
              {language === "fr"
                ? "Connectez-vous au portail Hydro-Québec pour récupérer les données de consommation."
                : "Connect to the Hydro-Québec portal to retrieve consumption data."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
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
                  disabled={isRunning}
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
                    disabled={isRunning}
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

              <Button
                onClick={startFetch}
                disabled={isRunning || !username || !password}
                data-testid="button-hq-start-fetch"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {language === "fr" ? "Récupération en cours..." : "Fetching data..."}
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    {language === "fr" ? "Récupérer les données" : "Fetch Data"}
                  </>
                )}
              </Button>
            </div>

            {isRunning && currentProgress && (
              <Card>
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-sm font-medium">
                      {language === "fr" ? "Progression" : "Progress"}
                    </span>
                  </div>
                  <Progress value={progressPercent} className="h-2" />
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium" data-testid="text-hq-progress-stage">
                        {currentProgress.stage}
                      </p>
                      <p className="text-sm text-muted-foreground" data-testid="text-hq-progress-message">
                        {currentProgress.message}
                      </p>
                      {currentProgress.details && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {currentProgress.details}
                        </p>
                      )}
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {currentProgress.current}/{currentProgress.total}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {error && (
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

            {results && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-sm">
                    {language === "fr" ? "Récupération terminée" : "Retrieval Complete"}
                  </span>
                  <div className="flex flex-wrap gap-3 ml-auto text-xs text-muted-foreground">
                    <span>{language === "fr" ? "Contrats" : "Contracts"}: <strong>{results.length}</strong></span>
                    <span>CSV: <strong>{totalCsvs}</strong></span>
                    <span>{language === "fr" ? "Lignes" : "Rows"}: <strong>{totalRows.toLocaleString()}</strong></span>
                  </div>
                </div>

                {results.map((contract) => (
                  <Card key={contract.contractId} data-testid={`card-hq-contract-${contract.contractId}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <CardTitle className="text-sm">
                            {language === "fr" ? "Contrat" : "Contract"} {contract.contractId}
                          </CardTitle>
                          <CardDescription className="text-xs mt-0.5">
                            {contract.address}
                          </CardDescription>
                          {contract.meterId && (
                            <p className="text-xs text-muted-foreground">
                              {language === "fr" ? "Compteur" : "Meter"}: {contract.meterId}
                            </p>
                          )}
                        </div>
                        <Badge variant="secondary">
                          {contract.csvFiles.length} CSV
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {contract.csvFiles.map((csv, idx) => {
                          const csvKey = `${contract.contractId}-${idx}`;
                          const isImporting = importingCsvs.has(csvKey);
                          const isImported = importedCsvs.has(csvKey);

                          return (
                            <div key={idx} className="flex items-center justify-between gap-3 p-2 rounded-md bg-muted/50">
                              <div className="flex items-center gap-2 min-w-0">
                                <FileSpreadsheet className="w-4 h-4 text-green-600 shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{csv.option}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {csv.periodStart} → {csv.periodEnd} · {csv.rowCount.toLocaleString()} {language === "fr" ? "lignes" : "rows"}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => downloadCsv(csv, contract.contractId)}
                                  data-testid={`button-hq-download-csv-${contract.contractId}-${idx}`}
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                                {isImported ? (
                                  <Badge variant="secondary" data-testid={`badge-hq-imported-${contract.contractId}-${idx}`}>
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    {language === "fr" ? "Importé" : "Imported"}
                                  </Badge>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => importCsvToSite(csv, contract.contractId, idx)}
                                    disabled={isImporting}
                                    data-testid={`button-hq-import-csv-${contract.contractId}-${idx}`}
                                  >
                                    {isImporting ? (
                                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                    ) : (
                                      <Upload className="w-3 h-3 mr-1" />
                                    )}
                                    {language === "fr" ? "Importer" : "Import"}
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
