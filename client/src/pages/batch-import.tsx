import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { Upload, FileSpreadsheet, Check, X, AlertCircle, Loader2, Trash2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ParsedProspect {
  companyName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  streetAddress?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  estimatedMonthlyBill?: string | number;
  buildingType?: string;
  notes?: string;
  _valid?: boolean;
  _errors?: string[];
}

interface ParseResponse {
  prospects: ParsedProspect[];
  count: number;
  message: string;
}

interface ImportResponse {
  created: number;
  errors: number;
  errorDetails: { index: number; error: string }[];
  leads: unknown[];
}

function validateProspect(prospect: ParsedProspect): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!prospect.companyName) errors.push("companyName");
  if (!prospect.contactName) errors.push("contactName");
  if (!prospect.email) errors.push("email");
  return { valid: errors.length === 0, errors };
}

export default function BatchImportPage() {
  const { language } = useI18n();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [prospects, setProspects] = useState<ParsedProspect[]>([]);
  const [importProgress, setImportProgress] = useState(0);

  const t = {
    title: language === "fr" ? "Import en lot de prospects" : "Batch Import Prospects",
    description: language === "fr" 
      ? "Téléversez un fichier CSV contenant vos prospects. L'IA analysera le contenu et extraira les données automatiquement."
      : "Upload a CSV file containing your prospects. AI will analyze the content and extract data automatically.",
    dropzoneText: language === "fr" 
      ? "Glissez-déposez un fichier CSV ici, ou cliquez pour sélectionner"
      : "Drag and drop a CSV file here, or click to select",
    dropzoneHint: language === "fr" 
      ? "Format supporté: .csv (convertissez Excel en CSV avant l'import)"
      : "Supported format: .csv (convert Excel to CSV before importing)",
    excelError: language === "fr"
      ? "Les fichiers Excel (.xlsx, .xls) ne sont pas supportés. Veuillez convertir votre fichier en CSV."
      : "Excel files (.xlsx, .xls) are not supported. Please convert your file to CSV.",
    parseWithAI: language === "fr" ? "Analyser avec l'IA" : "Parse with AI",
    parsing: language === "fr" ? "Analyse en cours..." : "Parsing...",
    importAll: language === "fr" ? "Importer tout" : "Import All",
    importing: language === "fr" ? "Import en cours..." : "Importing...",
    removeFile: language === "fr" ? "Retirer le fichier" : "Remove file",
    preview: language === "fr" ? "Aperçu des prospects" : "Prospects Preview",
    company: language === "fr" ? "Entreprise" : "Company",
    contact: language === "fr" ? "Contact" : "Contact",
    email: language === "fr" ? "Courriel" : "Email",
    phone: language === "fr" ? "Téléphone" : "Phone",
    city: language === "fr" ? "Ville" : "City",
    status: language === "fr" ? "Statut" : "Status",
    valid: language === "fr" ? "Valide" : "Valid",
    invalid: language === "fr" ? "Invalide" : "Invalid",
    missingFields: language === "fr" ? "Champs manquants" : "Missing fields",
    successTitle: language === "fr" ? "Import réussi" : "Import successful",
    successDesc: (count: number) => language === "fr" 
      ? `${count} prospect(s) importé(s) avec succès.`
      : `${count} prospect(s) imported successfully.`,
    errorTitle: language === "fr" ? "Erreur d'import" : "Import error",
    parseSuccess: (count: number) => language === "fr"
      ? `${count} prospect(s) détecté(s) dans le fichier.`
      : `${count} prospect(s) detected in file.`,
    noValidProspects: language === "fr" 
      ? "Aucun prospect valide à importer. Corrigez les erreurs ci-dessous."
      : "No valid prospects to import. Fix the errors below.",
    totalValid: language === "fr" ? "prospects valides" : "valid prospects",
    totalInvalid: language === "fr" ? "invalides" : "invalid",
  };

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: { file: File }[]) => {
    if (rejectedFiles.length > 0) {
      const rejected = rejectedFiles[0].file;
      const ext = rejected.name.toLowerCase().split('.').pop();
      if (ext === 'xlsx' || ext === 'xls') {
        toast({
          title: t.errorTitle,
          description: t.excelError,
          variant: "destructive",
        });
        return;
      }
    }
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const ext = file.name.toLowerCase().split('.').pop();
      if (ext === 'xlsx' || ext === 'xls') {
        toast({
          title: t.errorTitle,
          description: t.excelError,
          variant: "destructive",
        });
        return;
      }
      setFile(file);
      setProspects([]);
    }
  }, [t.errorTitle, t.excelError, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
  });

  const parseMutation = useMutation({
    mutationFn: async (file: File): Promise<ParseResponse> => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/import/prospects/ai-parse", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to parse file");
      }
      return response.json();
    },
    onSuccess: (data: ParseResponse) => {
      const validatedProspects = data.prospects.map((p: ParsedProspect) => {
        const { valid, errors } = validateProspect(p);
        return { ...p, _valid: valid, _errors: errors };
      });
      setProspects(validatedProspects);
      toast({
        title: t.successTitle,
        description: t.parseSuccess(data.count),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t.errorTitle,
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (prospects: ParsedProspect[]): Promise<ImportResponse> => {
      const validProspects = prospects.filter(p => p._valid);
      return await apiRequest("POST", "/api/import/prospects/batch", { prospects: validProspects }) as ImportResponse;
    },
    onSuccess: (data: ImportResponse) => {
      toast({
        title: t.successTitle,
        description: t.successDesc(data.created),
      });
      setProspects([]);
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
    },
    onError: (error: Error) => {
      toast({
        title: t.errorTitle,
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleParse = () => {
    if (file) {
      parseMutation.mutate(file);
    }
  };

  const handleImport = () => {
    const validProspects = prospects.filter(p => p._valid);
    if (validProspects.length > 0) {
      importMutation.mutate(prospects);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setProspects([]);
  };

  const handleFieldChange = (index: number, field: keyof ParsedProspect, value: string) => {
    setProspects(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      const { valid, errors } = validateProspect(updated[index]);
      updated[index]._valid = valid;
      updated[index]._errors = errors;
      return updated;
    });
  };

  const handleRemoveProspect = (index: number) => {
    setProspects(prev => prev.filter((_, i) => i !== index));
  };

  const validCount = prospects.filter(p => p._valid).length;
  const invalidCount = prospects.filter(p => !p._valid).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold" data-testid="text-page-title">{t.title}</h1>
        <p className="text-muted-foreground mt-2">{t.description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            {language === "fr" ? "Fichier source" : "Source File"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!file ? (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                ${isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}`}
              data-testid="dropzone-file"
            >
              <input {...getInputProps()} data-testid="input-file" />
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium">{t.dropzoneText}</p>
              <p className="text-sm text-muted-foreground mt-2">{t.dropzoneHint}</p>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-medium" data-testid="text-filename">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveFile}
                  data-testid="button-remove-file"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {t.removeFile}
                </Button>
                <Button
                  onClick={handleParse}
                  disabled={parseMutation.isPending}
                  data-testid="button-parse"
                >
                  {parseMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t.parsing}
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      {t.parseWithAI}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {prospects.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t.preview}</CardTitle>
                <CardDescription className="mt-1">
                  <span className="text-green-600 font-medium">{validCount}</span> {t.totalValid}
                  {invalidCount > 0 && (
                    <>, <span className="text-red-600 font-medium">{invalidCount}</span> {t.totalInvalid}</>
                  )}
                </CardDescription>
              </div>
              <Button
                onClick={handleImport}
                disabled={validCount === 0 || importMutation.isPending}
                data-testid="button-import-all"
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t.importing}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {t.importAll} ({validCount})
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {validCount === 0 && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{t.errorTitle}</AlertTitle>
                <AlertDescription>{t.noValidProspects}</AlertDescription>
              </Alert>
            )}

            {importMutation.isPending && (
              <div className="mb-4">
                <Progress value={importProgress} className="h-2" />
              </div>
            )}

            <div className="border rounded-lg overflow-auto max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead className="min-w-[180px]">{t.company}</TableHead>
                    <TableHead className="min-w-[150px]">{t.contact}</TableHead>
                    <TableHead className="min-w-[180px]">{t.email}</TableHead>
                    <TableHead className="min-w-[130px]">{t.phone}</TableHead>
                    <TableHead className="min-w-[120px]">{t.city}</TableHead>
                    <TableHead className="w-24">{t.status}</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prospects.map((prospect, index) => (
                    <TableRow 
                      key={index} 
                      className={!prospect._valid ? "bg-red-50/50 dark:bg-red-950/20" : ""}
                      data-testid={`row-prospect-${index}`}
                    >
                      <TableCell className="font-mono text-muted-foreground">{index + 1}</TableCell>
                      <TableCell>
                        <Input
                          value={prospect.companyName || ""}
                          onChange={(e) => handleFieldChange(index, "companyName", e.target.value)}
                          className={`h-8 ${prospect._errors?.includes("companyName") ? "border-red-500" : ""}`}
                          data-testid={`input-company-${index}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={prospect.contactName || ""}
                          onChange={(e) => handleFieldChange(index, "contactName", e.target.value)}
                          className={`h-8 ${prospect._errors?.includes("contactName") ? "border-red-500" : ""}`}
                          data-testid={`input-contact-${index}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={prospect.email || ""}
                          onChange={(e) => handleFieldChange(index, "email", e.target.value)}
                          className={`h-8 ${prospect._errors?.includes("email") ? "border-red-500" : ""}`}
                          data-testid={`input-email-${index}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={prospect.phone || ""}
                          onChange={(e) => handleFieldChange(index, "phone", e.target.value)}
                          className="h-8"
                          data-testid={`input-phone-${index}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={prospect.city || ""}
                          onChange={(e) => handleFieldChange(index, "city", e.target.value)}
                          className="h-8"
                          data-testid={`input-city-${index}`}
                        />
                      </TableCell>
                      <TableCell>
                        {prospect._valid ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            <Check className="h-3 w-3 mr-1" />
                            {t.valid}
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <X className="h-3 w-3 mr-1" />
                            {t.invalid}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveProspect(index)}
                          data-testid={`button-remove-${index}`}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
