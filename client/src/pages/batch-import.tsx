import { useState, useCallback, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { 
  Upload, FileSpreadsheet, Check, X, AlertCircle, Loader2, 
  Trash2, CheckCircle2, ArrowRight, MapPin, Users, Package 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";

type DataType = "clients" | "catalog";

interface ColumnMapping {
  csvColumn: string;
  dbField: string | null;
}

interface ParsedRow {
  [key: string]: string | number | boolean | null | undefined | string[];
  _valid?: boolean;
  _errors?: string[];
  _rowIndex?: number;
}

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  errorDetails: { index: number; error: string }[];
}

const CLIENT_FIELDS = [
  { key: "name", label: { fr: "Nom", en: "Name" }, required: true },
  { key: "mainContactName", label: { fr: "Contact principal", en: "Main Contact" }, required: false },
  { key: "email", label: { fr: "Courriel", en: "Email" }, required: false },
  { key: "phone", label: { fr: "Téléphone", en: "Phone" }, required: false },
  { key: "address", label: { fr: "Adresse", en: "Address" }, required: false },
  { key: "city", label: { fr: "Ville", en: "City" }, required: false },
  { key: "province", label: { fr: "Province", en: "Province" }, required: false },
  { key: "postalCode", label: { fr: "Code postal", en: "Postal Code" }, required: false },
];

const CATALOG_FIELDS = [
  { key: "category", label: { fr: "Catégorie", en: "Category" }, required: true },
  { key: "manufacturer", label: { fr: "Fabricant", en: "Manufacturer" }, required: true },
  { key: "model", label: { fr: "Modèle", en: "Model" }, required: true },
  { key: "specJson", label: { fr: "Spécifications (JSON)", en: "Specifications (JSON)" }, required: false },
  { key: "unitCost", label: { fr: "Coût unitaire", en: "Unit Cost" }, required: false },
  { key: "unitSellPrice", label: { fr: "Prix de vente", en: "Sell Price" }, required: false },
  { key: "active", label: { fr: "Actif", en: "Active" }, required: false },
];

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  
  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if ((char === "," || char === ";") && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };
  
  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow);
  
  return { headers, rows };
}

function autoMapColumns(csvHeaders: string[], dbFields: typeof CLIENT_FIELDS): ColumnMapping[] {
  const normalizeHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");
  
  const mappings: ColumnMapping[] = csvHeaders.map(csvCol => {
    const normalized = normalizeHeader(csvCol);
    
    const match = dbFields.find(field => {
      const fieldNorm = normalizeHeader(field.key);
      const labelFrNorm = normalizeHeader(field.label.fr);
      const labelEnNorm = normalizeHeader(field.label.en);
      
      return fieldNorm === normalized || 
             labelFrNorm === normalized || 
             labelEnNorm === normalized ||
             normalized.includes(fieldNorm) ||
             fieldNorm.includes(normalized);
    });
    
    return {
      csvColumn: csvCol,
      dbField: match?.key || null,
    };
  });
  
  return mappings;
}

function validateRow(row: ParsedRow, dataType: DataType, language: "fr" | "en"): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const fields = dataType === "clients" ? CLIENT_FIELDS : CATALOG_FIELDS;
  
  fields.forEach(field => {
    if (field.required) {
      const value = row[field.key];
      if (value === null || value === undefined || value === "") {
        errors.push(field.label[language]);
      }
    }
  });
  
  if (dataType === "catalog") {
    if (row.unitCost && isNaN(Number(row.unitCost))) {
      errors.push(language === "fr" ? "Coût unitaire invalide" : "Invalid unit cost");
    }
    if (row.unitSellPrice && isNaN(Number(row.unitSellPrice))) {
      errors.push(language === "fr" ? "Prix de vente invalide" : "Invalid sell price");
    }
  }
  
  return { valid: errors.length === 0, errors };
}

export default function BatchImportPage() {
  const { language } = useI18n();
  const { toast } = useToast();
  
  const [dataType, setDataType] = useState<DataType>("clients");
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [step, setStep] = useState<"upload" | "mapping" | "preview">("upload");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  
  const fields = dataType === "clients" ? CLIENT_FIELDS : CATALOG_FIELDS;
  
  const t = {
    title: language === "fr" ? "Import en lot" : "Batch Import",
    description: language === "fr" 
      ? "Importez vos données depuis un fichier CSV. Sélectionnez le type de données, téléversez votre fichier, mappez les colonnes et prévisualisez avant d'importer."
      : "Import your data from a CSV file. Select the data type, upload your file, map columns, and preview before importing.",
    dataTypeLabel: language === "fr" ? "Type de données" : "Data Type",
    clients: language === "fr" ? "Clients" : "Clients",
    catalog: language === "fr" ? "Catalogue de composants" : "Component Catalog",
    dropzoneText: language === "fr" 
      ? "Glissez-déposez un fichier CSV ici, ou cliquez pour sélectionner"
      : "Drag and drop a CSV file here, or click to select",
    dropzoneHint: language === "fr" 
      ? "Format supporté: .csv"
      : "Supported format: .csv",
    sourceFile: language === "fr" ? "Fichier source" : "Source File",
    removeFile: language === "fr" ? "Retirer" : "Remove",
    continueToMapping: language === "fr" ? "Continuer vers le mappage" : "Continue to Mapping",
    columnMapping: language === "fr" ? "Mappage des colonnes" : "Column Mapping",
    columnMappingDesc: language === "fr" 
      ? "Associez les colonnes de votre CSV aux champs de la base de données"
      : "Map your CSV columns to database fields",
    csvColumn: language === "fr" ? "Colonne CSV" : "CSV Column",
    dbField: language === "fr" ? "Champ BD" : "DB Field",
    skip: language === "fr" ? "— Ignorer —" : "— Skip —",
    required: language === "fr" ? "requis" : "required",
    preview: language === "fr" ? "Aperçu des données" : "Data Preview",
    previewDesc: language === "fr" 
      ? "Vérifiez les 5 premières lignes avant d'importer"
      : "Review the first 5 rows before importing",
    backToMapping: language === "fr" ? "Retour au mappage" : "Back to Mapping",
    importData: language === "fr" ? "Importer" : "Import",
    importing: language === "fr" ? "Import en cours..." : "Importing...",
    valid: language === "fr" ? "Valide" : "Valid",
    invalid: language === "fr" ? "Invalide" : "Invalid",
    missingFields: language === "fr" ? "Champs manquants" : "Missing fields",
    status: language === "fr" ? "Statut" : "Status",
    successTitle: language === "fr" ? "Import terminé" : "Import Complete",
    errorTitle: language === "fr" ? "Erreur" : "Error",
    created: language === "fr" ? "créés" : "created",
    updated: language === "fr" ? "mis à jour" : "updated",
    skipped: language === "fr" ? "ignorés" : "skipped",
    errors: language === "fr" ? "erreurs" : "errors",
    totalRows: language === "fr" ? "lignes au total" : "total rows",
    validRows: language === "fr" ? "lignes valides" : "valid rows",
    invalidRows: language === "fr" ? "lignes invalides" : "invalid rows",
    noValidRows: language === "fr" 
      ? "Aucune ligne valide à importer. Corrigez les erreurs de mappage."
      : "No valid rows to import. Fix the mapping errors.",
    results: language === "fr" ? "Résultats de l'import" : "Import Results",
    startNew: language === "fr" ? "Nouvel import" : "New Import",
  };
  
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      setFile(selectedFile);
      setImportResult(null);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const { headers, rows } = parseCSV(text);
        setCsvHeaders(headers);
        setCsvRows(rows);
        
        const mappings = autoMapColumns(headers, fields);
        setColumnMappings(mappings);
      };
      reader.readAsText(selectedFile);
    }
  }, [fields]);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
  });
  
  const handleDataTypeChange = (value: DataType) => {
    setDataType(value);
    setFile(null);
    setCsvHeaders([]);
    setCsvRows([]);
    setColumnMappings([]);
    setParsedData([]);
    setStep("upload");
    setImportResult(null);
  };
  
  const handleMappingChange = (csvColumn: string, dbField: string | null) => {
    setColumnMappings(prev => 
      prev.map(m => m.csvColumn === csvColumn ? { ...m, dbField } : m)
    );
  };
  
  const applyMappingAndPreview = () => {
    const mapped: ParsedRow[] = csvRows.map((row, rowIndex) => {
      const obj: ParsedRow = { _rowIndex: rowIndex };
      
      columnMappings.forEach((mapping, colIndex) => {
        if (mapping.dbField) {
          let value: string | number | boolean | null = row[colIndex] || null;
          
          if (mapping.dbField === "unitCost" || mapping.dbField === "unitSellPrice") {
            value = value ? parseFloat(String(value).replace(/[,$]/g, "")) : null;
          }
          if (mapping.dbField === "active") {
            const strVal = String(value).toLowerCase();
            value = strVal === "true" || strVal === "1" || strVal === "yes" || strVal === "oui";
          }
          
          obj[mapping.dbField] = value;
        }
      });
      
      const { valid, errors } = validateRow(obj, dataType, language);
      obj._valid = valid;
      obj._errors = errors;
      
      return obj;
    });
    
    setParsedData(mapped);
    setStep("preview");
  };
  
  const importMutation = useMutation({
    mutationFn: async (data: ParsedRow[]): Promise<ImportResult> => {
      const validData = data.filter(r => r._valid).map(r => {
        const cleaned: Record<string, unknown> = {};
        Object.keys(r).forEach(key => {
          if (!key.startsWith("_")) {
            cleaned[key] = r[key];
          }
        });
        return cleaned;
      });
      
      const endpoint = dataType === "clients" ? "/api/import/clients" : "/api/import/catalog";
      return await apiRequest("POST", endpoint, { items: validData }) as ImportResult;
    },
    onSuccess: (result: ImportResult) => {
      setImportResult(result);
      toast({
        title: t.successTitle,
        description: `${result.created} ${t.created}, ${result.updated} ${t.updated}, ${result.skipped} ${t.skipped}`,
      });
      
      if (dataType === "clients") {
        queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/catalog"] });
      }
    },
    onError: (error: Error) => {
      toast({
        title: t.errorTitle,
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleImport = () => {
    importMutation.mutate(parsedData);
  };
  
  const handleReset = () => {
    setFile(null);
    setCsvHeaders([]);
    setCsvRows([]);
    setColumnMappings([]);
    setParsedData([]);
    setStep("upload");
    setImportResult(null);
  };
  
  const validCount = parsedData.filter(r => r._valid).length;
  const invalidCount = parsedData.filter(r => !r._valid).length;
  const previewRows = parsedData.slice(0, 5);
  
  const mappedFieldsCount = columnMappings.filter(m => m.dbField).length;
  const requiredFieldsMapped = fields.filter(f => f.required).every(f => 
    columnMappings.some(m => m.dbField === f.key)
  );
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold" data-testid="text-page-title">{t.title}</h1>
        <p className="text-muted-foreground mt-2">{t.description}</p>
      </div>
      
      {importResult ? (
        <Card data-testid="card-import-results">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              {t.results}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                <p className="text-2xl font-bold text-green-600" data-testid="text-created-count">{importResult.created}</p>
                <p className="text-sm text-muted-foreground">{t.created}</p>
              </div>
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                <p className="text-2xl font-bold text-blue-600" data-testid="text-updated-count">{importResult.updated}</p>
                <p className="text-sm text-muted-foreground">{t.updated}</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
                <p className="text-2xl font-bold text-yellow-600" data-testid="text-skipped-count">{importResult.skipped}</p>
                <p className="text-sm text-muted-foreground">{t.skipped}</p>
              </div>
              <div className="text-center p-4 bg-red-50 dark:bg-red-950/30 rounded-lg">
                <p className="text-2xl font-bold text-red-600" data-testid="text-errors-count">{importResult.errors}</p>
                <p className="text-sm text-muted-foreground">{t.errors}</p>
              </div>
            </div>
            
            {importResult.errorDetails.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{t.errorTitle}</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    {importResult.errorDetails.slice(0, 5).map((err, i) => (
                      <li key={i} className="text-sm">
                        {language === "fr" ? "Ligne" : "Row"} {err.index + 1}: {err.error}
                      </li>
                    ))}
                    {importResult.errorDetails.length > 5 && (
                      <li className="text-sm">
                        ... {language === "fr" ? "et" : "and"} {importResult.errorDetails.length - 5} {language === "fr" ? "autres" : "more"}
                      </li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            
            <Button onClick={handleReset} className="w-full" data-testid="button-start-new">
              {t.startNew}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t.dataTypeLabel}</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={dataType} onValueChange={(v) => handleDataTypeChange(v as DataType)}>
                <SelectTrigger className="w-full md:w-80" data-testid="select-data-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clients" data-testid="option-clients">
                    <span className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {t.clients}
                    </span>
                  </SelectItem>
                  <SelectItem value="catalog" data-testid="option-catalog">
                    <span className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      {t.catalog}
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                {t.sourceFile}
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
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="h-8 w-8 text-primary" />
                      <div>
                        <p className="font-medium" data-testid="text-filename">{file.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(file.size / 1024).toFixed(1)} KB • {csvRows.length} {t.totalRows}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleReset}
                        data-testid="button-remove-file"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        {t.removeFile}
                      </Button>
                      {step === "upload" && csvHeaders.length > 0 && (
                        <Button onClick={() => setStep("mapping")} data-testid="button-continue-mapping">
                          {t.continueToMapping}
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          {step === "mapping" && csvHeaders.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  {t.columnMapping}
                </CardTitle>
                <CardDescription>{t.columnMappingDesc}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-1/2">{t.csvColumn}</TableHead>
                        <TableHead className="w-1/2">{t.dbField}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {columnMappings.map((mapping, index) => (
                        <TableRow key={index} data-testid={`row-mapping-${index}`}>
                          <TableCell className="font-mono text-sm">{mapping.csvColumn}</TableCell>
                          <TableCell>
                            <Select
                              value={mapping.dbField || "skip"}
                              onValueChange={(v) => handleMappingChange(mapping.csvColumn, v === "skip" ? null : v)}
                            >
                              <SelectTrigger data-testid={`select-mapping-${index}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="skip">{t.skip}</SelectItem>
                                {fields.map(field => (
                                  <SelectItem key={field.key} value={field.key}>
                                    {field.label[language]}
                                    {field.required && (
                                      <span className="text-red-500 ml-1">*</span>
                                    )}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {mappedFieldsCount} / {csvHeaders.length} {language === "fr" ? "colonnes mappées" : "columns mapped"}
                  </p>
                  <Button 
                    onClick={applyMappingAndPreview}
                    disabled={!requiredFieldsMapped}
                    data-testid="button-preview"
                  >
                    {t.preview}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
                
                {!requiredFieldsMapped && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>{t.errorTitle}</AlertTitle>
                    <AlertDescription>
                      {language === "fr" 
                        ? "Veuillez mapper tous les champs requis avant de continuer."
                        : "Please map all required fields before continuing."}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}
          
          {step === "preview" && parsedData.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <CardTitle>{t.preview}</CardTitle>
                    <CardDescription className="mt-1">
                      <span className="text-green-600 font-medium">{validCount}</span> {t.validRows}
                      {invalidCount > 0 && (
                        <>, <span className="text-red-600 font-medium">{invalidCount}</span> {t.invalidRows}</>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => setStep("mapping")} data-testid="button-back-mapping">
                      {t.backToMapping}
                    </Button>
                    <Button
                      onClick={handleImport}
                      disabled={validCount === 0 || importMutation.isPending}
                      data-testid="button-import"
                    >
                      {importMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {t.importing}
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          {t.importData} ({validCount})
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {validCount === 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>{t.errorTitle}</AlertTitle>
                    <AlertDescription>{t.noValidRows}</AlertDescription>
                  </Alert>
                )}
                
                {importMutation.isPending && (
                  <div className="space-y-2">
                    <Progress value={50} className="h-2" />
                    <p className="text-sm text-muted-foreground text-center">{t.importing}</p>
                  </div>
                )}
                
                <div className="border rounded-lg overflow-auto max-h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12 sticky left-0 bg-background">#</TableHead>
                        {fields.slice(0, 5).map(field => (
                          <TableHead key={field.key} className="min-w-[150px]">
                            {field.label[language]}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </TableHead>
                        ))}
                        <TableHead className="w-24">{t.status}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((row, index) => (
                        <TableRow 
                          key={index} 
                          className={!row._valid ? "bg-red-50/50 dark:bg-red-950/20" : ""}
                          data-testid={`row-preview-${index}`}
                        >
                          <TableCell className="font-mono text-muted-foreground sticky left-0 bg-background">
                            {(row._rowIndex ?? index) + 1}
                          </TableCell>
                          {fields.slice(0, 5).map(field => (
                            <TableCell 
                              key={field.key}
                              className={row._errors?.includes(field.label[language]) ? "text-red-600" : ""}
                            >
                              {row[field.key] !== null && row[field.key] !== undefined 
                                ? String(row[field.key]) 
                                : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                          ))}
                          <TableCell>
                            {row._valid ? (
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
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                
                {parsedData.length > 5 && (
                  <p className="text-sm text-muted-foreground text-center">
                    {language === "fr" 
                      ? `Affichage des 5 premières lignes sur ${parsedData.length}`
                      : `Showing first 5 of ${parsedData.length} rows`}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
