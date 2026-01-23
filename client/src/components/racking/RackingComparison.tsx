import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trophy, Loader2, BarChart3 } from "lucide-react";

interface RackingConfig {
  type: string;
  angle: number;
  profile: 'low' | 'standard' | 'high';
  profileHeightInches: number;
  manufacturer: string;
  pricePerWatt: number;
  ballastPerWatt: number;
  densityFactor: number;
  bifacialGainPercent: number;
  baseYieldKWhKWp: number;
  effectiveYieldKWhKWp: number;
  recommendedDcAcRatio: number;
  description: { fr: string; en: string };
}

interface RackingComparisonResult {
  config: RackingConfig;
  maxSystemSizeKW: number;
  annualProductionKWh: number;
  totalRackingCost: number;
  estimatedTotalCost: number;
  costPerKWhYear1: number;
  isWinner: boolean;
}

interface ComparisonResponse {
  roofAreaSqM: number;
  roofColorType: string | null;
  results: RackingComparisonResult[];
  winnerType: string | null;
}

interface RackingComparisonProps {
  lang?: 'fr' | 'en';
}

const labels = {
  fr: {
    title: "Comparaison des systèmes de montage",
    description: "Comparez les options de montage KB Racking vs Opsun Systems",
    roofArea: "Surface du toit (m²)",
    roofAreaPlaceholder: "Ex: 1000",
    roofColor: "Type de couleur du toit",
    roofColorNone: "Non spécifié",
    roofColorWhite: "Membrane blanche",
    roofColorLight: "Clair",
    roofColorDark: "Foncé",
    roofColorGravel: "Gravier",
    compare: "Comparer",
    comparing: "Analyse en cours...",
    results: "Résultats de la comparaison",
    manufacturer: "Fabricant",
    model: "Modèle",
    angle: "Angle",
    profile: "Profil",
    systemSize: "Taille système (kW)",
    production: "Production annuelle (kWh)",
    rackingCost: "Coût montage ($)",
    totalCost: "Coût total estimé ($)",
    costPerKwh: "Coût/kWh An 1 ($)",
    bifacialGain: "Gain bifacial (%)",
    dcAcRatio: "Ratio DC/AC recommandé",
    winner: "Meilleur choix",
    winnerMessage: "Option optimale avec le coût/kWh le plus bas",
    noResults: "Entrez une surface de toit et cliquez sur Comparer",
    profileLow: "Bas",
    profileStandard: "Standard",
    profileHigh: "Élevé",
  },
  en: {
    title: "Racking System Comparison",
    description: "Compare KB Racking vs Opsun Systems mounting options",
    roofArea: "Roof Area (sqm)",
    roofAreaPlaceholder: "e.g., 1000",
    roofColor: "Roof Color Type",
    roofColorNone: "Not specified",
    roofColorWhite: "White membrane",
    roofColorLight: "Light",
    roofColorDark: "Dark",
    roofColorGravel: "Gravel",
    compare: "Compare",
    comparing: "Analyzing...",
    results: "Comparison Results",
    manufacturer: "Manufacturer",
    model: "Model",
    angle: "Angle",
    profile: "Profile",
    systemSize: "System Size (kW)",
    production: "Annual Production (kWh)",
    rackingCost: "Racking Cost ($)",
    totalCost: "Est. Total Cost ($)",
    costPerKwh: "Cost/kWh Yr1 ($)",
    bifacialGain: "Bifacial Gain (%)",
    dcAcRatio: "Rec. DC/AC Ratio",
    winner: "Best Choice",
    winnerMessage: "Optimal option with lowest cost/kWh",
    noResults: "Enter a roof area and click Compare",
    profileLow: "Low",
    profileStandard: "Standard",
    profileHigh: "High",
  },
};

const formatNumber = (num: number, decimals: number = 0): string => {
  return new Intl.NumberFormat('en-CA', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
};

const formatCurrency = (num: number, decimals: number = 0): string => {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
};

export function RackingComparison({ lang = 'en' }: RackingComparisonProps) {
  const t = labels[lang];
  const [roofAreaSqM, setRoofAreaSqM] = useState<string>("");
  const [roofColorType, setRoofColorType] = useState<string>("");

  const compareMutation = useMutation({
    mutationFn: async (data: { roofAreaSqM: number; roofColorType?: string }) => {
      const response = await apiRequest("POST", "/api/racking/compare", data);
      return response.json() as Promise<ComparisonResponse>;
    },
  });

  const handleCompare = () => {
    const area = parseFloat(roofAreaSqM);
    if (isNaN(area) || area <= 0) return;
    
    compareMutation.mutate({
      roofAreaSqM: area,
      roofColorType: roofColorType || undefined,
    });
  };

  const getProfileLabel = (profile: string): string => {
    switch (profile) {
      case 'low': return t.profileLow;
      case 'standard': return t.profileStandard;
      case 'high': return t.profileHigh;
      default: return profile;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          {t.title}
        </CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="roof-area">{t.roofArea}</Label>
            <Input
              id="roof-area"
              type="number"
              placeholder={t.roofAreaPlaceholder}
              value={roofAreaSqM}
              onChange={(e) => setRoofAreaSqM(e.target.value)}
              data-testid="input-roof-area"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="roof-color">{t.roofColor}</Label>
            <Select value={roofColorType} onValueChange={setRoofColorType}>
              <SelectTrigger id="roof-color" data-testid="select-roof-color">
                <SelectValue placeholder={t.roofColorNone} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t.roofColorNone}</SelectItem>
                <SelectItem value="white_membrane">{t.roofColorWhite}</SelectItem>
                <SelectItem value="light">{t.roofColorLight}</SelectItem>
                <SelectItem value="dark">{t.roofColorDark}</SelectItem>
                <SelectItem value="gravel">{t.roofColorGravel}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleCompare}
            disabled={!roofAreaSqM || compareMutation.isPending}
            data-testid="button-compare"
          >
            {compareMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.comparing}
              </>
            ) : (
              t.compare
            )}
          </Button>
        </div>

        {compareMutation.data?.results && compareMutation.data.results.length > 0 ? (
          <div className="space-y-4">
            {compareMutation.data.results.some(r => r.isWinner) && (
              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 rounded-md border border-green-200 dark:border-green-800">
                <Trophy className="h-5 w-5 text-green-600 dark:text-green-400" />
                <span className="font-medium text-green-700 dark:text-green-300">
                  {t.winner}: {compareMutation.data.results.find(r => r.isWinner)?.config.manufacturer} {compareMutation.data.results.find(r => r.isWinner)?.config.angle}°
                </span>
                <span className="text-sm text-green-600 dark:text-green-400 ml-2">
                  — {t.winnerMessage}
                </span>
              </div>
            )}

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.manufacturer}</TableHead>
                    <TableHead className="text-center">{t.angle}</TableHead>
                    <TableHead className="text-center">{t.profile}</TableHead>
                    <TableHead className="text-right">{t.systemSize}</TableHead>
                    <TableHead className="text-right">{t.production}</TableHead>
                    <TableHead className="text-right">{t.rackingCost}</TableHead>
                    <TableHead className="text-right">{t.totalCost}</TableHead>
                    <TableHead className="text-right">{t.costPerKwh}</TableHead>
                    <TableHead className="text-center">{t.bifacialGain}</TableHead>
                    <TableHead className="text-center">{t.dcAcRatio}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {compareMutation.data.results.map((result, idx) => (
                    <TableRow
                      key={result.config.type}
                      className={result.isWinner ? "bg-green-50 dark:bg-green-950/50" : ""}
                      data-testid={`row-racking-${idx}`}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {result.isWinner && (
                            <Trophy className="h-4 w-4 text-green-600 dark:text-green-400" />
                          )}
                          {result.config.manufacturer}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{result.config.angle}°</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-xs">
                          {getProfileLabel(result.config.profile)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(result.maxSystemSizeKW, 1)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(result.annualProductionKWh, 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(result.totalRackingCost)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(result.estimatedTotalCost)}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${result.isWinner ? "text-green-700 dark:text-green-400" : ""}`}>
                        {formatCurrency(result.costPerKWhYear1, 3)}
                      </TableCell>
                      <TableCell className="text-center">
                        {result.config.bifacialGainPercent > 0 ? (
                          <Badge variant="secondary" className="text-xs">
                            +{result.config.bifacialGainPercent}%
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {result.config.recommendedDcAcRatio.toFixed(1)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          !compareMutation.isPending && (
            <div className="text-center py-8 text-muted-foreground">
              {t.noResults}
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}

export default RackingComparison;
