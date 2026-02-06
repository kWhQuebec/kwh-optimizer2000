import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";

export function FileUploadZone({ siteId, onUploadComplete }: { siteId: string; onUploadComplete: () => void }) {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const { token } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<"uploading" | "processing" | "done">("uploading");
  const [fileCount, setFileCount] = useState(0);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    setUploading(true);
    setProgress(0);
    setUploadPhase("uploading");
    setFileCount(acceptedFiles.length);

    const formData = new FormData();
    acceptedFiles.forEach((file) => {
      formData.append("files", file);
    });

    try {
      await new Promise<void>((resolve, reject) => {
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
            resolve();
          } else {
            reject(new Error("Upload failed"));
          }
        });

        xhr.addEventListener("error", () => {
          reject(new Error("Upload failed"));
        });

        xhr.open("POST", `/api/sites/${siteId}/upload-meters`);
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.send(formData);
      });

      setProgress(100);
      toast({
        title: language === "fr"
          ? `${acceptedFiles.length} fichier(s) téléversé(s) avec succès`
          : `${acceptedFiles.length} file(s) uploaded successfully`
      });
      onUploadComplete();
    } catch (error) {
      toast({
        title: language === "fr" ? "Erreur lors du téléversement" : "Upload error",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      setProgress(0);
      setUploadPhase("uploading");
    }
  }, [siteId, token, toast, onUploadComplete, language]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
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
      return language === "fr"
        ? "Traitement des fichiers CSV..."
        : "Processing CSV files...";
    }
    return language === "fr" ? "Terminé!" : "Done!";
  };

  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
        ${isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}
        ${uploading ? "pointer-events-none" : ""}
      `}
      data-testid="dropzone-upload"
    >
      <input {...getInputProps()} />
      <div className="space-y-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto ${uploading ? "bg-primary/10" : "bg-muted"}`}>
          {uploading ? (
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            <Upload className="w-6 h-6 text-muted-foreground" />
          )}
        </div>
        <div>
          {uploading ? (
            <>
              <p className="font-medium text-primary">{getPhaseText()}</p>
              <div className="mt-3 max-w-xs mx-auto space-y-2">
                <Progress value={uploadPhase === "processing" ? 100 : progress} className="h-2" />
                {uploadPhase === "processing" && (
                  <p className="text-xs text-muted-foreground">
                    {language === "fr"
                      ? "Analyse des données de consommation..."
                      : "Analyzing consumption data..."}
                  </p>
                )}
              </div>
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
