import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Shield, Download, Loader2, CheckCircle2, AlertCircle, Zap, FileSpreadsheet, Lock, Eye, EyeOff } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";

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

export default function HQDataFetchPage() {
  const { language } = useI18n();
  const { isAdmin } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [currentProgress, setCurrentProgress] = useState<HQProgressData | null>(null);
  const [results, setResults] = useState<HQContractResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <Shield className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <p className="text-lg text-muted-foreground">
          {language === "fr" ? "Accès réservé aux administrateurs" : "Admin access required"}
        </p>
      </div>
    );
  }

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
            } catch {
            }
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

  const downloadCsv = (csv: HQCsvFile, contractId: string, index: number) => {
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

  const totalCsvs = results ? results.reduce((sum, r) => sum + r.csvFiles.length, 0) : 0;
  const totalRows = results ? results.reduce((sum, r) => r.csvFiles.reduce((s, f) => s + f.rowCount, sum), 0) : 0;
  const progressPercent = currentProgress && currentProgress.total > 0 ? Math.round((currentProgress.current / currentProgress.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-hq-fetch-title">
          {language === "fr" ? "Récupération Hydro-Québec" : "Hydro-Québec Data Retrieval"}
        </h1>
        <p className="text-muted-foreground mt-2">
          {language === "fr"
            ? "Connectez-vous au portail Hydro-Québec pour télécharger automatiquement toutes les données de consommation (CSV) de vos contrats."
            : "Connect to the Hydro-Québec portal to automatically download all consumption data (CSV) from your contracts."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-md">
              <Lock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">
                {language === "fr" ? "Identifiants Hydro-Québec" : "Hydro-Québec Credentials"}
              </CardTitle>
              <CardDescription>
                {language === "fr"
                  ? "Entrez vos identifiants du portail client Hydro-Québec"
                  : "Enter your Hydro-Québec customer portal credentials"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hq-username">
              {language === "fr" ? "Courriel / Nom d'utilisateur" : "Email / Username"}
            </Label>
            <Input
              id="hq-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={language === "fr" ? "votre@courriel.com" : "your@email.com"}
              disabled={isRunning}
              data-testid="input-hq-username"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hq-password">
              {language === "fr" ? "Mot de passe" : "Password"}
            </Label>
            <div className="relative">
              <Input
                id="hq-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isRunning}
                data-testid="input-hq-password"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0"
                onClick={() => setShowPassword(!showPassword)}
                data-testid="button-toggle-password"
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
            data-testid="button-start-fetch"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {language === "fr" ? "Récupération en cours..." : "Fetching data..."}
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                {language === "fr" ? "Démarrer la récupération" : "Start Retrieval"}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {isRunning && currentProgress && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              {language === "fr" ? "Progression" : "Progress"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progressPercent} className="h-2" />
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium" data-testid="text-progress-stage">
                  {currentProgress.stage}
                </p>
                <p className="text-sm text-muted-foreground" data-testid="text-progress-message">
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
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive">
                  {language === "fr" ? "Erreur" : "Error"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {results && (
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="font-medium">
                  {language === "fr" ? "Récupération terminée" : "Retrieval Complete"}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span>
                  {language === "fr" ? "Contrats" : "Contracts"}: <strong>{results.length}</strong>
                </span>
                <span>
                  {language === "fr" ? "Fichiers CSV" : "CSV Files"}: <strong>{totalCsvs}</strong>
                </span>
                <span>
                  {language === "fr" ? "Lignes totales" : "Total Rows"}: <strong>{totalRows.toLocaleString()}</strong>
                </span>
              </div>
            </CardContent>
          </Card>

          {results.map((contract) => (
            <Card key={contract.contractId} data-testid={`card-contract-${contract.contractId}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">
                      {language === "fr" ? "Contrat" : "Contract"} {contract.contractId}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {contract.address}
                    </CardDescription>
                    {contract.meterId && (
                      <p className="text-xs text-muted-foreground mt-1">
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
                    const globalIdx = results.slice(0, results.indexOf(contract)).reduce((s, r) => s + r.csvFiles.length, 0) + idx;
                    return (
                      <div key={idx} className="flex items-center justify-between gap-4 p-2 rounded-md bg-muted/50">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileSpreadsheet className="w-4 h-4 text-green-600 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{csv.option}</p>
                            <p className="text-xs text-muted-foreground">
                              {csv.periodStart} → {csv.periodEnd} · {csv.rowCount.toLocaleString()} {language === "fr" ? "lignes" : "rows"}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => downloadCsv(csv, contract.contractId, idx)}
                          data-testid={`button-download-csv-${globalIdx}`}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
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
  );
}
