import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Download,
  RotateCcw,
  Printer,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Zap,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useI18n } from "@/lib/i18n";

interface CompetitorQuote {
  competitorName: string;
  systemSizeKw: number;
  totalPrice: number;
  annualProductionKwh: number;
  warrantyYears: number;
  inverterType: "string" | "micro" | "central";
  panelBrandModel: string;
  degradationRate: number;
}

interface KwhQuote {
  systemSizeKw: number;
  totalPrice: number;
  annualProductionKwh: number;
  warrantyYears: number;
  degradationRate: number;
}

interface LcoeCalculation {
  lcoe: number;
  totalLifecycleCost: number;
  totalLifetimeProduction: number;
  initialCost: number;
  omCost: number;
  salvageValue: number;
}

interface RiskAdjustments {
  installerReputation: boolean;
  equipmentQuality: boolean;
  localPresence: boolean;
}

const DISCOUNT_RATE = 0.05; // 5%
const OM_RATE = 0.01; // 1% of initial cost per year
const ANALYSIS_YEARS = 25;
const SALVAGE_RATE = 0.1; // 10% of initial cost

// Calculate NPV of costs over 25 years with discount rate
function calculateNPV(annualCost: number, years: number, rate: number): number {
  let npv = 0;
  for (let year = 1; year <= years; year++) {
    npv += annualCost / Math.pow(1 + rate, year);
  }
  return npv;
}

// Calculate total lifetime energy production considering degradation
function calculateLifetimeProduction(
  annualProduction: number,
  degradationRate: number,
  years: number
): number {
  let totalProduction = 0;
  for (let year = 0; year < years; year++) {
    const degradation = Math.pow(1 - degradationRate / 100, year);
    totalProduction += annualProduction * degradation;
  }
  return totalProduction;
}

// Calculate LCOE
function calculateLcoe(
  initialCost: number,
  degradationRate: number,
  annualProduction: number,
  years: number = ANALYSIS_YEARS,
  discountRate: number = DISCOUNT_RATE
): LcoeCalculation {
  // O&M costs (1% of initial cost per year)
  const annualOmCost = initialCost * OM_RATE;
  const npvOmCost = calculateNPV(annualOmCost, years, discountRate);

  // Salvage value (negative, so it reduces total cost)
  const salvageValue = initialCost * SALVAGE_RATE;
  const npvSalvageValue = salvageValue / Math.pow(1 + discountRate, years);

  // Total lifecycle cost
  const totalLifecycleCost =
    initialCost + npvOmCost - npvSalvageValue;

  // Total lifetime production with degradation
  const totalProduction = calculateLifetimeProduction(
    annualProduction,
    degradationRate,
    years
  );

  // LCOE = Total Cost / Total Production
  const lcoe = totalProduction > 0 ? totalLifecycleCost / totalProduction : 0;

  return {
    lcoe,
    totalLifecycleCost,
    totalLifetimeProduction: totalProduction,
    initialCost,
    omCost: npvOmCost,
    salvageValue: npvSalvageValue,
  };
}

// Apply risk adjustments
function applyRiskAdjustments(
  baseLcoe: number,
  competitorData: CompetitorQuote,
  risks: RiskAdjustments
): number {
  let adjustment = baseLcoe;

  if (risks.installerReputation) {
    // Shorter warranty = higher risk (add $0.01/kWh per year less than 25)
    const warrantyDiff = Math.max(0, 25 - competitorData.warrantyYears);
    adjustment += (warrantyDiff * 0.001); // $0.001 per year less warranty
  }

  if (risks.equipmentQuality) {
    // String inverters have higher risk
    if (competitorData.inverterType === "string") {
      adjustment += 0.005;
    }
    // Micro is baseline, central is also baseline
  }

  if (risks.localPresence) {
    // Assume Quebec area code as local (simplified for demo)
    // Out-of-province companies add risk
    adjustment += 0.01;
  }

  return adjustment;
}

// Generate 25-year projection data for charts
function generateProjectionData(
  competitorData: CompetitorQuote,
  kwhData: KwhQuote
) {
  const data = [];

  for (let year = 0; year <= ANALYSIS_YEARS; year++) {
    const competitorDegradation = Math.pow(
      1 - competitorData.degradationRate / 100,
      year
    );
    const kwhDegradation = Math.pow(
      1 - kwhData.degradationRate / 100,
      year
    );

    const competitorProduction =
      competitorData.annualProductionKwh * competitorDegradation;
    const kwhProduction =
      kwhData.annualProductionKwh * kwhDegradation;

    // Cumulative cost with O&M
    const competitorCumulativeCost =
      competitorData.totalPrice +
      competitorData.totalPrice * OM_RATE * year;
    const kwhCumulativeCost =
      kwhData.totalPrice +
      kwhData.totalPrice * OM_RATE * year;

    data.push({
      year,
      competitorProduction: Math.round(competitorProduction),
      kwhProduction: Math.round(kwhProduction),
      competitorCost: Math.round(competitorCumulativeCost),
      kwhCost: Math.round(kwhCumulativeCost),
    });
  }

  return data;
}

export default function LcoeComparisonPage() {
  const [, navigate] = useLocation();
  const { t } = useI18n();

  // Form state
  const [competitor, setCompetitor] = useState<CompetitorQuote>({
    competitorName: "",
    systemSizeKw: 10,
    totalPrice: 30000,
    annualProductionKwh: 12000,
    warrantyYears: 20,
    inverterType: "string",
    panelBrandModel: "",
    degradationRate: 0.5,
  });

  const [kwh, setKwh] = useState<KwhQuote>({
    systemSizeKw: 10,
    totalPrice: 28000,
    annualProductionKwh: 13000,
    warrantyYears: 25,
    degradationRate: 0.4,
  });

  const [risks, setRisks] = useState<RiskAdjustments>({
    installerReputation: true,
    equipmentQuality: true,
    localPresence: false,
  });

  // Calculate LCOEs
  const competitorLcoe = useMemo(
    () =>
      calculateLcoe(
        competitor.totalPrice,
        competitor.degradationRate,
        competitor.annualProductionKwh
      ),
    [competitor]
  );

  const kwhLcoe = useMemo(
    () =>
      calculateLcoe(
        kwh.totalPrice,
        kwh.degradationRate,
        kwh.annualProductionKwh
      ),
    [kwh]
  );

  // Apply risk adjustments
  const adjustedCompetitorLcoe = useMemo(
    () => applyRiskAdjustments(competitorLcoe.lcoe, competitor, risks),
    [competitorLcoe, competitor, risks]
  );

  const advantagePerKwh = adjustedCompetitorLcoe - kwhLcoe.lcoe;
  const totalAdvantage =
    advantagePerKwh * kwhLcoe.totalLifetimeProduction;

  // Chart data
  const projectionData = useMemo(
    () => generateProjectionData(competitor, kwh),
    [competitor, kwh]
  );

  const lcoeChartData = [
    {
      name: competitor.competitorName || "Competitor",
      lcoe: parseFloat(adjustedCompetitorLcoe.toFixed(4)),
      fill: advantagePerKwh > 0 ? "#ef4444" : "#22c55e",
    },
    {
      name: "kWh Québec",
      lcoe: parseFloat(kwhLcoe.lcoe.toFixed(4)),
      fill: "#3b82f6",
    },
  ];

  const resetForm = () => {
    setCompetitor({
      competitorName: "",
      systemSizeKw: 10,
      totalPrice: 30000,
      annualProductionKwh: 12000,
      warrantyYears: 20,
      inverterType: "string",
      panelBrandModel: "",
      degradationRate: 0.5,
    });
    setKwh({
      systemSizeKw: 10,
      totalPrice: 28000,
      annualProductionKwh: 13000,
      warrantyYears: 25,
      degradationRate: 0.4,
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/app/pipeline")}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">LCOE Comparison Tool</h1>
          <p className="text-muted-foreground mt-1">
            Compare kWh Québec's offer against competitor quotes using levelized
            cost of energy analysis
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Forms */}
        <div className="lg:col-span-2 space-y-6">
          {/* Competitor Quote */}
          <Card className="print:page-break-inside-avoid">
            <CardHeader>
              <CardTitle className="text-lg">Competitor Quote</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Competitor Name</Label>
                  <Input
                    value={competitor.competitorName}
                    onChange={(e) =>
                      setCompetitor({
                        ...competitor,
                        competitorName: e.target.value,
                      })
                    }
                    placeholder="e.g., SolarCorp Solutions"
                  />
                </div>

                <div>
                  <Label>System Size (kW)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={competitor.systemSizeKw}
                    onChange={(e) =>
                      setCompetitor({
                        ...competitor,
                        systemSizeKw: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>

                <div>
                  <Label>Total Price ($)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1000"
                    value={competitor.totalPrice}
                    onChange={(e) =>
                      setCompetitor({
                        ...competitor,
                        totalPrice: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>

                <div>
                  <Label>Annual Production (kWh)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1000"
                    value={competitor.annualProductionKwh}
                    onChange={(e) =>
                      setCompetitor({
                        ...competitor,
                        annualProductionKwh: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>

                <div>
                  <Label>Warranty (years)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    value={competitor.warrantyYears}
                    onChange={(e) =>
                      setCompetitor({
                        ...competitor,
                        warrantyYears: parseFloat(e.target.value) || 1,
                      })
                    }
                  />
                </div>

                <div>
                  <Label>Degradation Rate (%/year)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={competitor.degradationRate}
                    onChange={(e) =>
                      setCompetitor({
                        ...competitor,
                        degradationRate: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>

                <div>
                  <Label>Inverter Type</Label>
                  <Select
                    value={competitor.inverterType}
                    onValueChange={(value: any) =>
                      setCompetitor({
                        ...competitor,
                        inverterType: value,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="string">String</SelectItem>
                      <SelectItem value="micro">Microinverter</SelectItem>
                      <SelectItem value="central">Central</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <Label>Panel Brand/Model (optional)</Label>
                  <Input
                    value={competitor.panelBrandModel}
                    onChange={(e) =>
                      setCompetitor({
                        ...competitor,
                        panelBrandModel: e.target.value,
                      })
                    }
                    placeholder="e.g., Canadian Solar HiKu7"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* kWh Québec Quote */}
          <Card className="print:page-break-inside-avoid">
            <CardHeader>
              <CardTitle className="text-lg">kWh Québec Offer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>System Size (kW)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={kwh.systemSizeKw}
                    onChange={(e) =>
                      setKwh({
                        ...kwh,
                        systemSizeKw: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>

                <div>
                  <Label>Total Price ($)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1000"
                    value={kwh.totalPrice}
                    onChange={(e) =>
                      setKwh({
                        ...kwh,
                        totalPrice: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>

                <div>
                  <Label>Annual Production (kWh)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1000"
                    value={kwh.annualProductionKwh}
                    onChange={(e) =>
                      setKwh({
                        ...kwh,
                        annualProductionKwh: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>

                <div>
                  <Label>Warranty (years)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    value={kwh.warrantyYears}
                    onChange={(e) =>
                      setKwh({
                        ...kwh,
                        warrantyYears: parseFloat(e.target.value) || 1,
                      })
                    }
                  />
                </div>

                <div className="col-span-2">
                  <Label>Degradation Rate (%/year)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={kwh.degradationRate}
                    onChange={(e) =>
                      setKwh({
                        ...kwh,
                        degradationRate: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Risk Adjustments */}
          <Card className="print:page-break-inside-avoid">
            <CardHeader>
              <CardTitle className="text-lg">Risk Adjustments</CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                These factors adjust the competitor's LCOE upward based on
                installation and equipment risks
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Installer Reputation Risk</Label>
                  <Switch
                    checked={risks.installerReputation}
                    onCheckedChange={(checked) =>
                      setRisks({
                        ...risks,
                        installerReputation: checked,
                      })
                    }
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Adjusts for warranty duration. Shorter warranty = higher risk.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Equipment Quality Risk</Label>
                  <Switch
                    checked={risks.equipmentQuality}
                    onCheckedChange={(checked) =>
                      setRisks({
                        ...risks,
                        equipmentQuality: checked,
                      })
                    }
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  String inverters add +$0.005/kWh risk premium vs. micro or
                  central.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Local Presence Risk</Label>
                  <Switch
                    checked={risks.localPresence}
                    onCheckedChange={(checked) =>
                      setRisks({
                        ...risks,
                        localPresence: checked,
                      })
                    }
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Out-of-province installers add +$0.01/kWh (support, response
                  time).
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary Results */}
        <div className="space-y-6">
          {/* LCOE Summary Card */}
          <Card className="print:page-break-inside-avoid border-2 border-blue-500">
            <CardHeader>
              <CardTitle className="text-lg">LCOE Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">
                  Competitor LCOE (with risk adjustments)
                </div>
                <div className="text-3xl font-bold text-red-600">
                  ${adjustedCompetitorLcoe.toFixed(4)}/kWh
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="text-sm font-medium text-muted-foreground">
                  kWh Québec LCOE
                </div>
                <div className="text-3xl font-bold text-blue-600">
                  ${kwhLcoe.lcoe.toFixed(4)}/kWh
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="text-sm font-medium text-muted-foreground">
                  Advantage per kWh
                </div>
                <div
                  className={`text-2xl font-bold ${
                    advantagePerKwh > 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {advantagePerKwh > 0 ? "+" : ""}${advantagePerKwh.toFixed(4)}
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="text-sm font-medium text-muted-foreground">
                  25-Year Total Advantage
                </div>
                <div
                  className={`text-2xl font-bold ${
                    totalAdvantage > 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {totalAdvantage > 0 ? "+" : ""}
                  ${(totalAdvantage / 1000).toFixed(1)}k
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Advantage Message */}
          {advantagePerKwh > 0 ? (
            <Card className="border-green-500 bg-green-50 dark:bg-green-950">
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-green-900 dark:text-green-100">
                      kWh Québec Has the Better Offer
                    </p>
                    <p className="text-sm text-green-800 dark:text-green-200 mt-1">
                      Your client saves approximately $
                      {(totalAdvantage / 1000).toFixed(0)}k over 25 years.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950">
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-900 dark:text-amber-100">
                      Competitor Offer is More Attractive
                    </p>
                    <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                      Consider: risk factors, warranty terms, installer
                      experience, and equipment quality.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 print:hidden">
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={resetForm}
            >
              <RotateCcw className="h-4 w-4" />
              Réinitialiser
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={handlePrint}
            >
              <Printer className="h-4 w-4" />
              Imprimer
            </Button>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <Tabs defaultValue="lcoe" className="print:page-break-inside-avoid">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="lcoe">LCOE Comparison</TabsTrigger>
          <TabsTrigger value="production">25-Year Production</TabsTrigger>
          <TabsTrigger value="costs">Cumulative Costs</TabsTrigger>
        </TabsList>

        {/* LCOE Bar Chart */}
        <TabsContent value="lcoe" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Levelized Cost of Energy ($/kWh)</CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Lower LCOE = better long-term value. Competitor LCOE includes
                risk adjustments.
              </p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={lcoeChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis label={{ value: "$/kWh", angle: -90, position: "insideLeft" }} />
                  <Tooltip
                    formatter={(value: any) => `$${value.toFixed(4)}/kWh`}
                  />
                  <Bar dataKey="lcoe" radius={[8, 8, 0, 0]}>
                    {lcoeChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Production Chart */}
        <TabsContent value="production" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Annual Production Over 25 Years</CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Shows degradation effect on annual output. Steeper decline =
                higher degradation rate.
              </p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={projectionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" label={{ value: "Year", position: "insideBottomRight", offset: -5 }} />
                  <YAxis label={{ value: "kWh", angle: -90, position: "insideLeft" }} />
                  <Tooltip formatter={(value: any) => `${value.toLocaleString()} kWh`} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="competitorProduction"
                    stroke="#ef4444"
                    name={competitor.competitorName || "Competitor"}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="kwhProduction"
                    stroke="#3b82f6"
                    name="kWh Québec"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cost Chart */}
        <TabsContent value="costs" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Cumulative System Cost Over 25 Years</CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Includes initial cost + annual O&M (1% of initial cost per
                year).
              </p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={projectionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" label={{ value: "Year", position: "insideBottomRight", offset: -5 }} />
                  <YAxis label={{ value: "Cumulative Cost ($)", angle: -90, position: "insideLeft" }} />
                  <Tooltip formatter={(value: any) => `$${value.toLocaleString()}`} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="competitorCost"
                    stroke="#ef4444"
                    name={competitor.competitorName || "Competitor"}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="kwhCost"
                    stroke="#3b82f6"
                    name="kWh Québec"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detailed Comparison Table */}
      <Card className="print:page-break-inside-avoid">
        <CardHeader>
          <CardTitle>Detailed Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead className="text-right">
                    {competitor.competitorName || "Competitor"}
                  </TableHead>
                  <TableHead className="text-right">kWh Québec</TableHead>
                  <TableHead className="text-right">Advantage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">System Size</TableCell>
                  <TableCell className="text-right">
                    {competitor.systemSizeKw.toFixed(1)} kW
                  </TableCell>
                  <TableCell className="text-right">
                    {kwh.systemSizeKw.toFixed(1)} kW
                  </TableCell>
                  <TableCell className="text-right">
                    {kwh.systemSizeKw === competitor.systemSizeKw ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                    ) : (
                      "-"
                    )}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Initial Cost</TableCell>
                  <TableCell className="text-right">
                    ${competitor.totalPrice.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    ${kwh.totalPrice.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {kwh.totalPrice < competitor.totalPrice && (
                      <span className="text-green-600 font-medium">
                        Save $
                        {(
                          competitor.totalPrice - kwh.totalPrice
                        ).toLocaleString()}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">
                    Annual Production
                  </TableCell>
                  <TableCell className="text-right">
                    {competitor.annualProductionKwh.toLocaleString()} kWh
                  </TableCell>
                  <TableCell className="text-right">
                    {kwh.annualProductionKwh.toLocaleString()} kWh
                  </TableCell>
                  <TableCell className="text-right">
                    {kwh.annualProductionKwh >
                      competitor.annualProductionKwh && (
                      <span className="text-green-600 font-medium">
                        +
                        {(
                          kwh.annualProductionKwh -
                          competitor.annualProductionKwh
                        ).toLocaleString()}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Warranty</TableCell>
                  <TableCell className="text-right">
                    {competitor.warrantyYears} years
                  </TableCell>
                  <TableCell className="text-right">
                    {kwh.warrantyYears} years
                  </TableCell>
                  <TableCell className="text-right">
                    {kwh.warrantyYears > competitor.warrantyYears && (
                      <span className="text-green-600 font-medium">
                        +{kwh.warrantyYears - competitor.warrantyYears}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Degradation Rate</TableCell>
                  <TableCell className="text-right">
                    {competitor.degradationRate.toFixed(2)}%/year
                  </TableCell>
                  <TableCell className="text-right">
                    {kwh.degradationRate.toFixed(2)}%/year
                  </TableCell>
                  <TableCell className="text-right">
                    {kwh.degradationRate < competitor.degradationRate && (
                      <span className="text-green-600 font-medium">
                        {(
                          competitor.degradationRate - kwh.degradationRate
                        ).toFixed(2)}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
                <TableRow className="border-t-2">
                  <TableCell className="font-bold">LCOE</TableCell>
                  <TableCell className="text-right font-bold text-red-600">
                    ${adjustedCompetitorLcoe.toFixed(4)}/kWh
                  </TableCell>
                  <TableCell className="text-right font-bold text-blue-600">
                    ${kwhLcoe.lcoe.toFixed(4)}/kWh
                  </TableCell>
                  <TableCell className="text-right">
                    {advantagePerKwh > 0 && (
                      <span className="text-green-600 font-bold">
                        ${advantagePerKwh.toFixed(4)}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-bold">
                    25-Year Total Cost
                  </TableCell>
                  <TableCell className="text-right">
                    ${competitorLcoe.totalLifecycleCost.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    ${kwhLcoe.totalLifecycleCost.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  </TableCell>
                  <TableCell className="text-right" />
                </TableRow>
                <TableRow>
                  <TableCell className="font-bold">
                    25-Year Total Production
                  </TableCell>
                  <TableCell className="text-right">
                    {competitorLcoe.totalLifetimeProduction.toLocaleString(
                      undefined,
                      {
                        maximumFractionDigits: 0,
                      }
                    )}{" "}
                    kWh
                  </TableCell>
                  <TableCell className="text-right">
                    {kwhLcoe.totalLifetimeProduction.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}{" "}
                    kWh
                  </TableCell>
                  <TableCell className="text-right" />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Methodology */}
      <Card className="print:page-break-inside-avoid">
        <CardHeader>
          <CardTitle className="text-sm">Methodology</CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-3 text-muted-foreground">
          <p>
            <strong>LCOE Calculation:</strong> LCOE = Total Lifecycle Cost /
            Total Lifetime Energy Production over 25 years
          </p>
          <p>
            <strong>Total Lifecycle Cost:</strong> Initial cost + NPV of O&M
            costs (1% annually, discounted at 5%) - NPV of salvage value
            (10% of initial cost)
          </p>
          <p>
            <strong>Lifetime Production:</strong> Sum of annual production
            adjusted for degradation: P(year n) = Annual Production ×
            (1 - degradation_rate)^n
          </p>
          <p>
            <strong>Risk Adjustments:</strong> Added to competitor LCOE based
            on warranty strength, inverter type, and local presence.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
