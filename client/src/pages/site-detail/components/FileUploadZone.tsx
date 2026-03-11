import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, FileImage, CheckCircle2, AlertCircle, ArrowRightLeft } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { getFreshToken } from "@/lib/queryClient";

interface BillResult {
  fileName: string;
  confidence: number;
  fieldsExtracted: number;
  error?: string;
}

interface FieldUpdate {
  field: string;
  label: string;
  oldValue: string | null;
  newValue: string | null;
}

interface UploadSummary {
  csvCount: number;
  billCount: number;
  csvProcessed: number;
  billsProcessed: number;
  fieldsApplied: number;
  fieldsPending: number;
}

interface UploadResponse {
  files: any[];
  billResults?: BillResult[];
  appliedUpdates?: FieldUpdate[];
  pendingUpdates?: FieldUpdate[];
  summary?: UploadSummary;
}

export function FileUploadZone({ siteId, onUploadComplete }: { siteId: string; onUploadComplete: () => void }) {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<"uploading" | "processing" | "done">("uploading");
  const [fileCount, setFileCount] = useState(0);
  const [fileSummary, setFileSummary] = useState<{ csv: number; bills: number } | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [pendingSelections, setPendingSelections] = useState<Record<string, boolean>>({});
  const [applyingUpdates, setApplyingUpdates] = useState(false);

  const categorizeFiles = (files: File[]) => {
    const billExtensions = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];
    let csv = 0;
    let bills = 0;
    for (const file of files) {
      const ext = file.name.toLowerCase().substring(file.name.lastIndexOf("."));
      if (billExtensions.includes(ext)) {
        bills++;
      } else {
        csv++;
      }
    }
    return { csv, bills };
  };

  const resetState = () => {
    setUploading(false);
    setProgress(0);
    setUploadPhase("uploading");
    setFileSummary(null);
    setUploadResult(null);
    setPendingSelections({});
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    setUploading(true);
    setProgress(0);
    setUploadPhase("uploading");
    setFileCount(acceptedFiles.length);
    setUploadResult(null);
    setPendingSelections({});

    const summary = categorizeFiles(acceptedFiles);
    setFileSummary(summary);

    const formData = new FormData();
    acceptedFiles.forEach((file) => {
      formData.append("files", file);
    });

    try {
      const freshToken = await getFreshToken();
      if (!freshToken) {
        throw new Error("Not authenticated");
      }

      const response = await new Promise<UploadResponse>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            setProgress(percentComplete);
            if (percentComplete >= 100) {
              setUploadPhase("processing");
            }
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadPhase("done");
            try {
              const data = JSON.parse(xhr.responseText);
              resolve(data);
            } catch {
              resolve({ files: [] });
            }
          } else {
            reject(new Error(`Upload failed (${xhr.status})`));
          }
        });

        xhr.addEventListener("error", () => {
          reject(new Error("Upload failed"));
        });

        xhr.open("POST", `/api/sites/${siteId}/upload-meters`);
        xhr.setRequestHeader("Authorization", `Bearer ${freshToken}`);
        xhr.send(formData);
      });

      setProgress(100);
      setUploadResult(response);

      if (response.pendingUpdates && response.pendingUpdates.length > 0) {
        const defaults: Record<string, boolean> = {};
        for (const u of response.pendingUpdates) {
          defaults[u.field] = false;
        }
        setPendingSelections(defaults);
      }

      const s = response.summary;
      if (s) {
        const parts: string[] = [];
        if (s.csvCount > 0) {
          parts.push(language === "fr"
            ? `${s.csvProcessed}/${s.csvCount} CSV traité(s)`
            : `${s.csvProcessed}/${s.csvCount} CSV processed`);
        }
        if (s.billCount > 0) {
          parts.push(language === "fr"
            ? `${s.billsProcessed}/${s.billCount} facture(s) analysée(s)`
            : `${s.billsProcessed}/${s.billCount} bill(s) analyzed`);
        }
        if (s.fieldsApplied > 0) {
          parts.push(language === "fr"
            ? `${s.fieldsApplied} champ(s) mis à jour`
            : `${s.fieldsApplied} field(s) updated`);
        }
        toast({
          title: language === "fr" ? "Téléversement terminé" : "Upload complete",
          description: parts.join(" · "),
        });
      } else {
        toast({
          title: language === "fr"
            ? `${acceptedFiles.length} fichier(s) téléversé(s) avec succès`
            : `${acceptedFiles.length} file(s) uploaded successfully`
        });
      }
      onUploadComplete();

      const hasPending = response.pendingUpdates && response.pendingUpdates.length > 0;
      if (!hasPending) {
        setTimeout(resetState, 5000);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      toast({
        title: language === "fr" ? "Erreur lors du téléversement" : "Upload error",
        description: msg.includes("Not authenticated")
          ? (language === "fr" ? "Veuillez vous reconnecter" : "Please log in again")
          : msg || undefined,
        variant: "destructive"
      });
      resetState();
    }
  }, [siteId, toast, onUploadComplete, language]);

  const handleApplyPendingUpdates = async () => {
    if (!uploadResult?.pendingUpdates) return;

    const selected = uploadResult.pendingUpdates.filter(u => pendingSelections[u.field]);
    if (selected.length === 0) {
      resetState();
      return;
    }

    setApplyingUpdates(true);
    try {
      const freshToken = await getFreshToken();
      if (!freshToken) throw new Error("Not authenticated");

      const resp = await fetch(`/api/sites/${siteId}/apply-bill-updates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${freshToken}`,
        },
        body: JSON.stringify({ updates: selected }),
      });

      if (!resp.ok) throw new Error(`Failed (${resp.status})`);

      toast({
        title: language === "fr"
          ? `${selected.length} champ(s) mis à jour`
          : `${selected.length} field(s) updated`,
      });
      onUploadComplete();
      setApplyingUpdates(false);
      resetState();
    } catch (err) {
      setApplyingUpdates(false);
      toast({
        title: language === "fr" ? "Erreur lors de la mise à jour" : "Update error",
        description: language === "fr" ? "Veuillez réessayer" : "Please try again",
        variant: "destructive",
      });
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/pdf": [".pdf"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
    },
    disabled: uploading,
  });

  const getPhaseText = () => {
    if (uploadPhase === "uploading") {
      return language === "fr"
        ? `Téléversement de ${fileCount} fichier(s)... ${progress}%`
        : `Uploading ${fileCount} file(s)... ${progress}%`;
    }
    if (uploadPhase === "processing") {
      if (fileSummary && fileSummary.bills > 0) {
        return language === "fr"
          ? "Analyse des fichiers (CSV + factures IA)..."
          : "Processing files (CSV + AI bill parsing)...";
      }
      return language === "fr"
        ? "Traitement des fichiers CSV..."
        : "Processing CSV files...";
    }
    return language === "fr" ? "Terminé!" : "Done!";
  };

  const hasPendingUpdates = uploadResult?.pendingUpdates && uploadResult.pendingUpdates.length > 0;

  const renderUploadResult = () => {
    if (!uploadResult || !uploadResult.summary) return null;
    const s = uploadResult.summary;

    return (
      <div className="mt-3 space-y-3 text-left max-w-md mx-auto" data-testid="upload-result-summary">
        <div className="flex items-center gap-2 flex-wrap">
          {s.csvCount > 0 && (
            <Badge variant="secondary" data-testid="badge-csv-count">
              <FileText className="w-3 h-3 mr-1" />
              {s.csvProcessed}/{s.csvCount} CSV
            </Badge>
          )}
          {s.billCount > 0 && (
            <Badge variant="secondary" data-testid="badge-bill-count">
              <FileImage className="w-3 h-3 mr-1" />
              {s.billsProcessed}/{s.billCount} {language === "fr" ? "facture(s)" : "bill(s)"}
            </Badge>
          )}
          {s.fieldsApplied > 0 && (
            <Badge variant="default" data-testid="badge-fields-applied">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              {s.fieldsApplied} {language === "fr" ? "champ(s) ajouté(s)" : "field(s) added"}
            </Badge>
          )}
        </div>

        {uploadResult.appliedUpdates && uploadResult.appliedUpdates.length > 0 && (
          <div className="text-xs space-y-1 border rounded-md p-2 bg-muted/30" data-testid="applied-updates-list">
            <p className="font-medium text-muted-foreground">
              {language === "fr" ? "Champs remplis automatiquement :" : "Auto-filled fields:"}
            </p>
            {uploadResult.appliedUpdates.map((update, i) => (
              <div key={i} className="flex items-start gap-1">
                <CheckCircle2 className="w-3 h-3 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                <span>
                  <span className="font-medium">{update.label}:</span>{" "}
                  <span className="text-muted-foreground">{update.newValue}</span>
                </span>
              </div>
            ))}
          </div>
        )}

        {hasPendingUpdates && (
          <div className="border rounded-md p-3 bg-muted/20 space-y-2" data-testid="pending-updates-section">
            <p className="text-xs font-medium flex items-center gap-1">
              <ArrowRightLeft className="w-3 h-3" />
              {language === "fr"
                ? "Données existantes détectées — confirmer les mises à jour :"
                : "Existing data detected — confirm updates:"}
            </p>
            {uploadResult.pendingUpdates!.map((update, i) => (
              <label
                key={i}
                className="flex items-start gap-2 text-xs cursor-pointer hover-elevate rounded p-1.5"
                data-testid={`pending-update-${update.field}`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 rounded"
                  checked={!!pendingSelections[update.field]}
                  onChange={(e) => {
                    e.stopPropagation();
                    setPendingSelections(prev => ({
                      ...prev,
                      [update.field]: !prev[update.field],
                    }));
                  }}
                  data-testid={`checkbox-${update.field}`}
                />
                <span className="flex-1">
                  <span className="font-medium">{update.label}</span>
                  <span className="block text-muted-foreground">
                    {language === "fr" ? "Actuel" : "Current"}: <span className="line-through">{update.oldValue}</span>
                  </span>
                  <span className="block text-foreground">
                    {language === "fr" ? "Nouveau" : "New"}: {update.newValue}
                  </span>
                </span>
              </label>
            ))}
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleApplyPendingUpdates();
                }}
                disabled={applyingUpdates || !Object.values(pendingSelections).some(Boolean)}
                data-testid="button-apply-updates"
              >
                {applyingUpdates
                  ? (language === "fr" ? "Application..." : "Applying...")
                  : (language === "fr" ? "Appliquer la sélection" : "Apply selected")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  resetState();
                }}
                disabled={applyingUpdates}
                data-testid="button-ignore-updates"
              >
                {language === "fr" ? "Ignorer" : "Ignore"}
              </Button>
            </div>
          </div>
        )}

        {uploadResult.billResults && uploadResult.billResults.some(b => b.error) && (
          <div className="text-xs space-y-1" data-testid="bill-errors">
            {uploadResult.billResults.filter(b => b.error).map((b, i) => (
              <div key={i} className="flex items-start gap-1 text-destructive">
                <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                <span>{b.fileName}: {b.error}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const isInteractive = !uploading && !hasPendingUpdates;

  return (
    <div
      {...(isInteractive ? getRootProps() : {})}
      className={`
        border-2 border-dashed rounded-xl p-8 text-center transition-colors
        ${isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25"}
        ${isInteractive ? "cursor-pointer hover:border-primary/50" : "cursor-default"}
        ${uploading && !hasPendingUpdates ? "pointer-events-none" : ""}
      `}
      data-testid="dropzone-upload"
    >
      {isInteractive && <input {...getInputProps()} />}
      <div className="space-y-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto ${uploading ? "bg-primary/10" : "bg-muted"}`}>
          {uploading ? (
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            <Upload className="w-6 h-6 text-muted-foreground" />
          )}
        </div>
        <div>
          {uploading || hasPendingUpdates ? (
            <>
              <p className="font-medium text-primary">{getPhaseText()}</p>
              {fileSummary && (fileSummary.csv > 0 || fileSummary.bills > 0) && uploadPhase !== "done" && !hasPendingUpdates && (
                <p className="text-xs text-muted-foreground mt-1" data-testid="text-file-breakdown">
                  {fileSummary.csv > 0 && fileSummary.bills > 0
                    ? (language === "fr"
                      ? `${fileSummary.csv} CSV + ${fileSummary.bills} facture(s)`
                      : `${fileSummary.csv} CSV + ${fileSummary.bills} bill(s)`)
                    : fileSummary.bills > 0
                      ? (language === "fr"
                        ? `${fileSummary.bills} facture(s) détectée(s)`
                        : `${fileSummary.bills} bill(s) detected`)
                      : ""}
                </p>
              )}
              {!hasPendingUpdates && (
                <div className="mt-3 max-w-xs mx-auto space-y-2">
                  <Progress value={uploadPhase === "processing" ? 100 : progress} className="h-2" />
                  {uploadPhase === "processing" && (
                    <p className="text-xs text-muted-foreground">
                      {fileSummary && fileSummary.bills > 0
                        ? (language === "fr"
                          ? "Analyse IA des factures Hydro-Québec..."
                          : "AI analysis of Hydro-Québec bills...")
                        : (language === "fr"
                          ? "Analyse des données de consommation..."
                          : "Analyzing consumption data...")}
                    </p>
                  )}
                </div>
              )}
              {(uploadPhase === "done" || hasPendingUpdates) && renderUploadResult()}
            </>
          ) : (
            <>
              <p className="font-medium">{t("site.dropzone")}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("site.fileType")}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {language === "fr"
                  ? "Jusqu'à 200 fichiers simultanément"
                  : "Up to 200 files at once"}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
