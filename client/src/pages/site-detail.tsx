import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useDropzone } from "react-dropzone";
import { 
  ArrowLeft, 
  Building2, 
  MapPin, 
  Upload, 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Play,
  Download,
  Zap,
  Battery,
  BarChart3,
  DollarSign,
  Leaf,
  TrendingUp,
  PenTool
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Site, Client, MeterFile, SimulationRun } from "@shared/schema";

interface SiteWithDetails extends Site {
  client: Client;
  meterFiles: MeterFile[];
  simulationRuns: SimulationRun[];
}

function MetricCard({ 
  title, 
  value, 
  unit, 
  icon: Icon,
  trend
}: { 
  title: string; 
  value: string | number; 
  unit?: string; 
  icon: React.ElementType;
  trend?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold font-mono">
              {value}
              {unit && <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
            </p>
            {trend && (
              <p className="text-xs text-primary flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {trend}
              </p>
            )}
          </div>
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FileUploadZone({ siteId, onUploadComplete }: { siteId: string; onUploadComplete: () => void }) {
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

function FileStatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  
  switch (status) {
    case "PARSED":
      return (
        <Badge variant="default" className="gap-1">
          <CheckCircle2 className="w-3 h-3" />
          {t("status.parsed")}
        </Badge>
      );
    case "FAILED":
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="w-3 h-3" />
          {t("status.failed")}
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="w-3 h-3" />
          {t("status.uploaded")}
        </Badge>
      );
  }
}

function DownloadReportButton({ simulationId }: { simulationId: string }) {
  const { t, language } = useI18n();
  const { token } = useAuth();
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await fetch(`/api/simulation-runs/${simulationId}/report-pdf?lang=${language}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error("Download failed");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rapport-potentiel-${simulationId.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({ title: language === "fr" ? "Rapport téléchargé" : "Report downloaded" });
    } catch (error) {
      toast({ title: language === "fr" ? "Erreur lors du téléchargement" : "Download error", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Button variant="outline" className="gap-2" onClick={handleDownload} disabled={downloading} data-testid="button-download-report">
      <Download className="w-4 h-4" />
      {downloading ? "..." : t("site.downloadReport")}
    </Button>
  );
}

function AnalysisResults({ simulation }: { simulation: SimulationRun }) {
  const { t } = useI18n();

  const loadProfileData = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}h`,
    consumption: Math.sin(i / 24 * Math.PI * 2) * 50 + 100 + Math.random() * 20,
    production: i >= 6 && i <= 18 ? Math.sin((i - 6) / 12 * Math.PI) * 80 : 0,
  }));

  const comparisonData = [
    { name: "Consommation", before: simulation.annualConsumptionKWh || 0, after: (simulation.annualConsumptionKWh || 0) - (simulation.annualEnergySavingsKWh || 0) },
    { name: "Pic kW", before: simulation.demandShavingSetpointKW || 0, after: (simulation.demandShavingSetpointKW || 0) - (simulation.annualDemandReductionKW || 0) },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard
          title={t("analysis.annualSavings")}
          value={`$${((simulation.annualSavings || 0) / 1000).toFixed(1)}k`}
          icon={DollarSign}
          trend="+15% vs baseline"
        />
        <MetricCard
          title={t("analysis.netInvestment")}
          value={`$${((simulation.capexNet || 0) / 1000).toFixed(0)}k`}
          icon={TrendingUp}
        />
        <MetricCard
          title={t("analysis.npv20")}
          value={`$${((simulation.npv20 || 0) / 1000).toFixed(0)}k`}
          icon={BarChart3}
        />
        <MetricCard
          title={t("analysis.irr20")}
          value={`${((simulation.irr20 || 0) * 100).toFixed(1)}%`}
          icon={TrendingUp}
        />
        <MetricCard
          title={t("analysis.payback")}
          value={(simulation.simplePaybackYears || 0).toFixed(1)}
          unit={t("common.years")}
          icon={Clock}
        />
        <MetricCard
          title={t("analysis.co2Avoided")}
          value={(simulation.co2AvoidedTonnesPerYear || 0).toFixed(1)}
          unit={t("common.tonnesYear")}
          icon={Leaf}
        />
      </div>

      {/* Recommended System */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Système recommandé</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("analysis.recommendedPV")}</p>
                <p className="text-xl font-bold font-mono">{(simulation.pvSizeKW || 0).toFixed(0)} <span className="text-sm font-normal">kWc</span></p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Battery className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Énergie batterie</p>
                <p className="text-xl font-bold font-mono">{(simulation.battEnergyKWh || 0).toFixed(0)} <span className="text-sm font-normal">kWh</span></p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Battery className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Puissance batterie</p>
                <p className="text-xl font-bold font-mono">{(simulation.battPowerKW || 0).toFixed(0)} <span className="text-sm font-normal">kW</span></p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("analysis.charts.loadProfile")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={loadProfileData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="hour" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="consumption" 
                    stackId="1" 
                    stroke="hsl(var(--chart-2))" 
                    fill="hsl(var(--chart-2))" 
                    fillOpacity={0.3}
                    name="Consommation (kW)"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="production" 
                    stackId="2" 
                    stroke="hsl(var(--chart-1))" 
                    fill="hsl(var(--chart-1))" 
                    fillOpacity={0.3}
                    name="Production PV (kW)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("analysis.charts.beforeAfter")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Legend />
                  <Bar dataKey="before" fill="hsl(var(--chart-2))" name="Avant" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="after" fill="hsl(var(--chart-1))" name="Après" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SiteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const { toast } = useToast();

  const { data: site, isLoading, refetch } = useQuery<SiteWithDetails>({
    queryKey: ["/api/sites", id],
    enabled: !!id,
  });

  const runAnalysisMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/sites/${id}/run-potential-analysis`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites", id] });
      toast({ title: "Analyse lancée avec succès" });
    },
    onError: () => {
      toast({ title: "Erreur lors de l'analyse", variant: "destructive" });
    },
  });

  const latestSimulation = site?.simulationRuns?.find(s => s.type === "SCENARIO") || site?.simulationRuns?.[0];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!site) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Site non trouvé</h2>
        <Link href="/app/sites">
          <Button variant="outline">{t("common.back")}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <Link href="/app/sites">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{site.name}</h1>
              {site.analysisAvailable ? (
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {t("sites.analysisReady")}
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <Clock className="w-3 h-3" />
                  {t("sites.pending")}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span>{site.client?.name}</span>
              {(site.city || site.province) && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {[site.city, site.province].filter(Boolean).join(", ")}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {latestSimulation && (
            <>
              <DownloadReportButton simulationId={latestSimulation.id} />
              <Link href={`/app/analyses/${latestSimulation.id}/design`}>
                <Button className="gap-2" data-testid="button-create-design">
                  <PenTool className="w-4 h-4" />
                  {t("analysis.createDesign")}
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="consumption" className="space-y-6">
        <TabsList>
          <TabsTrigger value="consumption" data-testid="tab-consumption">{t("site.consumption")}</TabsTrigger>
          <TabsTrigger value="analysis" data-testid="tab-analysis">{t("analysis.title")}</TabsTrigger>
        </TabsList>

        <TabsContent value="consumption" className="space-y-6">
          {/* Upload Zone */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("site.uploadFiles")}</CardTitle>
            </CardHeader>
            <CardContent>
              <FileUploadZone siteId={site.id} onUploadComplete={() => refetch()} />
            </CardContent>
          </Card>

          {/* Files Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-lg">{t("site.files")}</CardTitle>
              <Button 
                onClick={() => runAnalysisMutation.mutate()}
                disabled={!site.meterFiles?.length || runAnalysisMutation.isPending}
                className="gap-2"
                data-testid="button-run-analysis"
              >
                <Play className="w-4 h-4" />
                {runAnalysisMutation.isPending ? t("common.loading") : t("site.runAnalysis")}
              </Button>
            </CardHeader>
            <CardContent>
              {site.meterFiles && site.meterFiles.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("site.fileName")}</TableHead>
                      <TableHead>{t("site.granularity")}</TableHead>
                      <TableHead>{t("site.period")}</TableHead>
                      <TableHead>{t("sites.status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {site.meterFiles.map((file) => (
                      <TableRow key={file.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                            {file.fileName}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {file.granularity === "HOUR" ? t("status.hour") : t("status.fifteenMin")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {file.periodStart && file.periodEnd ? (
                            `${new Date(file.periodStart).toLocaleDateString("fr-CA")} - ${new Date(file.periodEnd).toLocaleDateString("fr-CA")}`
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          <FileStatusBadge status={file.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Aucun fichier importé</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-6">
          {latestSimulation ? (
            <AnalysisResults simulation={latestSimulation} />
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <BarChart3 className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-1">Aucune analyse disponible</h3>
                <p className="text-muted-foreground mb-4">
                  Importez des fichiers CSV et lancez une analyse pour voir les résultats.
                </p>
                <Button 
                  onClick={() => runAnalysisMutation.mutate()}
                  disabled={!site.meterFiles?.length || runAnalysisMutation.isPending}
                  className="gap-2"
                >
                  <Play className="w-4 h-4" />
                  {t("site.runAnalysis")}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
