import React, { useState } from "react";
import { Download, ChevronDown, Loader2, FileText, Mail, Presentation, Lock, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

export function DownloadReportButton({
  simulationId,
  siteName,
  optimizationTarget = 'npv',
  onBeforeDownload,
  isQualified = true,
}: {
  simulationId: string;
  siteName: string;
  optimizationTarget?: 'npv' | 'irr' | 'selfSufficiency';
  onBeforeDownload?: () => Promise<void>;
  isQualified?: boolean;
}) {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const [downloadPhase, setDownloadPhase] = useState<"idle" | "generating">("idle");

  const handleDownloadFull = async () => {
    setDownloading(true);
    setDownloadPhase("generating");
    try {
      if (onBeforeDownload) await onBeforeDownload();
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/simulation-runs/${simulationId}/report-pdf?lang=${language}&opt=${optimizationTarget}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (!response.ok) {
        throw new Error("Failed to generate PDF report");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `rapport-${siteName.replace(/\s+/g, '-')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({ title: language === "fr" ? "Rapport téléchargé" : "Report downloaded" });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({ title: language === "fr" ? "Erreur lors du téléchargement" : "Download error", variant: "destructive" });
    } finally {
      setDownloading(false);
      setDownloadPhase("idle");
    }
  };

  const handleDownloadExecutive = async () => {
    setDownloading(true);
    setDownloadPhase("generating");
    try {
      if (onBeforeDownload) await onBeforeDownload();
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/simulation-runs/${simulationId}/executive-summary-pdf?lang=${language}&opt=${optimizationTarget}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (!response.ok) {
        throw new Error("Failed to generate executive summary");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `resume-executif-${siteName.replace(/\s+/g, '-')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({ title: language === "fr" ? "Résumé exécutif téléchargé" : "Executive summary downloaded" });
    } catch (error) {
      console.error("Executive summary PDF error:", error);
      toast({ title: language === "fr" ? "Erreur lors du téléchargement" : "Download error", variant: "destructive" });
    } finally {
      setDownloading(false);
      setDownloadPhase("idle");
    }
  };

  const handleDownloadPPTX = async () => {
    setDownloading(true);
    setDownloadPhase("generating");
    try {
      if (onBeforeDownload) await onBeforeDownload();
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/simulation-runs/${simulationId}/presentation-pptx?lang=${language}&opt=${optimizationTarget}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (!response.ok) {
        throw new Error("Failed to generate presentation");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `proposition-${siteName.replace(/\s+/g, '-')}.pptx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({ title: language === "fr" ? "Présentation téléchargée" : "Presentation downloaded" });
    } catch (error) {
      console.error("PPTX generation error:", error);
      toast({ title: language === "fr" ? "Erreur lors du téléchargement" : "Download error", variant: "destructive" });
    } finally {
      setDownloading(false);
      setDownloadPhase("idle");
    }
  };

  if (downloading) {
    return (
      <Button
        variant="outline"
        className="gap-2 min-w-[160px]"
        disabled
        data-testid="button-download-report"
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        {language === "fr" ? "Génération PDF..." : "Generating PDF..."}
      </Button>
    );
  }

  if (!isQualified) {
    return (
      <div className="flex flex-col items-end gap-2" data-testid="button-download-report-locked">
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-3 border border-dashed border-muted-foreground/30">
          <Lock className="w-4 h-4 shrink-0" />
          <span>
            {language === "fr"
              ? "Rapport débloqué après un appel découverte de 10 min"
              : "Report unlocked after a 10-min discovery call"}
          </span>
        </div>
        <Button
          variant="default"
          className="gap-2"
          onClick={() => {
            window.open("https://calendly.com/kwh-quebec/decouverte", "_blank");
          }}
          data-testid="button-book-call-unlock"
        >
          <Calendar className="w-4 h-4" />
          {language === "fr" ? "Réserver mon appel →" : "Book my call →"}
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 min-w-[160px]"
          data-testid="button-download-report"
        >
          <Download className="w-4 h-4" />
          {t("site.downloadReport")}
          <ChevronDown className="w-4 h-4 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem onClick={handleDownloadFull} data-testid="menu-item-full-report">
          <FileText className="w-4 h-4 mr-2" />
          {language === "fr" ? "Rapport PDF complet" : "Full PDF report"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownloadExecutive} data-testid="menu-item-executive-summary">
          <Mail className="w-4 h-4 mr-2" />
          {language === "fr" ? "Résumé exécutif (1 page)" : "Executive summary (1 page)"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownloadPPTX} data-testid="menu-item-presentation">
          <Presentation className="w-4 h-4 mr-2" />
          {language === "fr" ? "Présentation PowerPoint" : "PowerPoint presentation"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
