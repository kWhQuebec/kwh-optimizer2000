import React, { useState } from "react";
import { Download, ChevronDown, Loader2, FileText, Mail, Presentation } from "lucide-react";
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
  clientName,
  location,
  onSwitchToAnalysis
}: {
  simulationId: string;
  siteName: string;
  clientName?: string;
  location?: string;
  onSwitchToAnalysis?: () => void;
}) {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const [downloadPhase, setDownloadPhase] = useState<"idle" | "preparing" | "generating">("idle");
  const [downloadType, setDownloadType] = useState<"full" | "executive">("full");

  const handleDownloadFull = async () => {
    setDownloading(true);
    setDownloadType("full");
    setDownloadPhase("preparing");
    try {
      // Switch to Analysis tab first so PDF sections are rendered
      if (onSwitchToAnalysis) {
        onSwitchToAnalysis();

        // Wait deterministically for the PDF sections to be rendered in the DOM
        const waitForElement = async (elementId: string, maxWaitMs = 3000): Promise<boolean> => {
          const startTime = Date.now();
          while (Date.now() - startTime < maxWaitMs) {
            if (document.getElementById(elementId)) {
              return true;
            }
            await new Promise(resolve => requestAnimationFrame(resolve));
          }
          return false;
        };

        // Wait for the main PDF section to exist
        const sectionReady = await waitForElement("pdf-section-system-config");
        if (!sectionReady) {
          throw new Error("PDF sections not ready");
        }

        // Small additional delay for images and charts to fully render
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      setDownloadPhase("generating");
      const { downloadClientPDF } = await import("@/lib/clientPdfGenerator");
      await downloadClientPDF(siteName, clientName, location, language);
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
    setDownloadType("executive");
    setDownloadPhase("generating");
    try {
      // Download executive summary PDF from server
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/simulation-runs/${simulationId}/executive-summary-pdf?lang=${language}`, {
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
    setDownloadType("full");
    setDownloadPhase("generating");
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/simulation-runs/${simulationId}/presentation-pptx?lang=${language}`, {
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
        {downloadPhase === "preparing"
          ? (language === "fr" ? "Préparation..." : "Preparing...")
          : (language === "fr" ? "Génération PDF..." : "Generating PDF...")
        }
      </Button>
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
