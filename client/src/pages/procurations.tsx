import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr, enCA } from "date-fns/locale";
import { 
  FileSignature, 
  Download, 
  Building2, 
  Calendar, 
  FileText,
  Loader2,
  ExternalLink
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useI18n } from "@/lib/i18n";
import type { Lead } from "@shared/schema";

interface ProcurationPdf {
  filename: string;
  leadId: string | null;
  createdAt: string;
  size: number;
}

export default function ProcurationsPage() {
  const { t, language } = useI18n();
  const dateLocale = language === "fr" ? fr : enCA;

  const { data: procurations, isLoading } = useQuery<ProcurationPdf[]>({
    queryKey: ["/api/admin/procuration-pdfs"],
  });

  const { data: leads } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });

  const getLeadInfo = (leadId: string | null) => {
    if (!leadId || !leads) return null;
    return leads.find(l => l.id === leadId);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownload = (filename: string) => {
    const token = localStorage.getItem("token");
    const url = `/api/admin/procuration-pdfs/${filename}`;
    
    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
    })
      .then(res => res.blob())
      .then(blob => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        a.remove();
      });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSignature className="w-6 h-6 text-primary" />
            {t("procurations.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("procurations.description")}
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {procurations?.length || 0} {language === "fr" ? "procurations" : "authorizations"}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("procurations.recentTitle")}</CardTitle>
          <CardDescription>{t("procurations.recentDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : procurations && procurations.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("procurations.company")}</TableHead>
                  <TableHead>{t("procurations.contact")}</TableHead>
                  <TableHead>{t("procurations.date")}</TableHead>
                  <TableHead>{t("procurations.size")}</TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {procurations.map((proc) => {
                  const lead = getLeadInfo(proc.leadId);
                  return (
                    <TableRow key={proc.filename} data-testid={`procuration-row-${proc.filename}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">
                            {lead?.companyName || t("procurations.unknown")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {lead ? (
                          <div className="text-sm">
                            <div>{lead.contactName}</div>
                            <div className="text-muted-foreground">{lead.email}</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          {format(new Date(proc.createdAt), "PPp", { locale: dateLocale })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          <FileText className="w-3 h-3 mr-1" />
                          {formatFileSize(proc.size)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownload(proc.filename)}
                          data-testid={`button-download-${proc.filename}`}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          {t("common.download")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileSignature className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>{t("procurations.empty")}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("procurations.infoTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            {language === "fr"
              ? "Les procurations sont générées automatiquement lorsqu'un prospect complète le formulaire d'analyse détaillée avec signature électronique."
              : "Authorizations are automatically generated when a prospect completes the detailed analysis form with electronic signature."
            }
          </p>
          <p>
            {language === "fr"
              ? "Une fois signée, la procuration doit être envoyée à Hydro-Québec pour obtenir l'accès aux données de consommation du client (délai: ~3 jours ouvrables)."
              : "Once signed, the authorization must be sent to Hydro-Québec to gain access to the client's consumption data (delay: ~3 business days)."
            }
          </p>
          <div className="flex items-center gap-2 pt-2">
            <ExternalLink className="w-4 h-4" />
            <span className="font-medium">
              {language === "fr" ? "Email Hydro-Québec:" : "Hydro-Québec Email:"}
            </span>
            <code className="bg-muted px-2 py-0.5 rounded text-xs">
              procuration@hydroquebec.com
            </code>
            <Badge variant="outline" className="text-xs">TODO: confirmer</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
