import { useState } from "react";
import {
  Wallet,
  CreditCard,
  FileCheck,
  Zap,
  Clock,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useI18n } from "@/lib/i18n";
import type { SimulationRun, AnalysisAssumptions, ScenarioBreakdown } from "@shared/schema";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { DisplayedScenarioType } from "../types";
import { formatNumber } from "../utils";

export const FINANCING_COLORS = {
  cash: { bg: "bg-[#16A34A]", text: "text-[#16A34A]", border: "border-[#16A34A]", stroke: "#16A34A", hsl: "hsl(142, 72%, 36%)" },
  loan: { bg: "bg-[#003DA6]", text: "text-[#003DA6]", border: "border-[#003DA6]", stroke: "#003DA6", hsl: "hsl(218, 100%, 33%)" },
  lease: { bg: "bg-[#FFB005]", text: "text-[#FFB005]", border: "border-[#FFB005]", stroke: "#FFB005", hsl: "hsl(41, 100%, 51%)" },
  ppa: { bg: "bg-[#3B82F6]", text: "text-[#3B82F6]", border: "border-[#3B82F6]", stroke: "#3B82F6", hsl: "hsl(217, 91%, 60%)" },
};

export function FinancingCalculator({ simulation, displayedScenario }: { simulation: SimulationRun; displayedScenario: DisplayedScenarioType }) {
  const { t, language } = useI18n();
  const [financingType, setFinancingType] = useState<"cash" | "loan" | "lease" | "ppa">("cash");
  const [loanTerm, setLoanTerm] = useState(15);
  const [interestRate, setInterestRate] = useState(5.5);
  const [downPayment, setDownPayment] = useState(20);
  const [leaseImplicitRate, setLeaseImplicitRate] = useState(8.5);
  const [leaseTerm, setLeaseTerm] = useState(15); // Default 15-year lease term

  // PPA (Third-Party Power Purchase Agreement) - TRC Solar model defaults
  // Note: More conservative defaults to show realistic competitor comparison
  const [ppaTerm, setPpaTerm] = useState(15); // 15 years typical for TRC
  const [ppaYear1Rate, setPpaYear1Rate] = useState(100); // Year 1: 100% of HQ rate (no savings)
  const [ppaYear2Rate, setPpaYear2Rate] = useState(85); // Year 2+: 85% of HQ rate (15% savings - conservative)
  const [ppaBuyoutPct, setPpaBuyoutPct] = useState(10); // Buyout cost as % of original CAPEX at end of term

  const degradationRate = 0.005; // 0.5% per year panel degradation

  const scenarioBreakdown = displayedScenario.scenarioBreakdown;
  const assumptions = simulation.assumptions as AnalysisAssumptions | null;

  const baseCapexNet = simulation.capexNet || 0;

  const capexNet = displayedScenario.capexNet || 0;
  const capexGross = scenarioBreakdown?.capexGross || baseCapexNet;
  const annualSavings = displayedScenario.annualSavings || simulation.annualSavings || 0;
  const selfConsumptionKWh = scenarioBreakdown?.annualEnergySavingsKWh || simulation.annualEnergySavingsKWh || 0;

  const pvSizeKW = displayedScenario.pvSizeKW || 0;
  const solarYield = assumptions?.solarYieldKWhPerKWp || 1150;
  const totalAnnualProductionKWh = pvSizeKW * solarYield;

  const hqSolar = scenarioBreakdown?.actualHQSolar || 0;
  const hqBattery = scenarioBreakdown?.actualHQBattery || 0;
  const federalITC = scenarioBreakdown?.itcAmount || 0;
  const taxShield = scenarioBreakdown?.taxShield || 0;

  // Realistic cash flow timing for cash purchase:
  // Day 0: Pay Gross CAPEX, receive HQ Solar rebate immediately (often direct to installer)
  // Year 0: Receive 50% of HQ Battery rebate
  // Year 1: Receive remaining 50% HQ Battery + Tax shield (CCA)
  // Year 2: Federal ITC as tax credit
  const upfrontCashNeeded = capexGross - hqSolar - (hqBattery * 0.5); // What client actually pays
  const year1Returns = (hqBattery * 0.5) + taxShield;
  const year2Returns = federalITC;
  const totalIncentives = hqSolar + hqBattery + federalITC + taxShield;

  // Loan calculation: loan on gross CAPEX, incentives return separately
  const loanDownPaymentAmount = capexGross * downPayment / 100;
  const loanAmount = capexGross - loanDownPaymentAmount;
  const monthlyRate = interestRate / 100 / 12;
  const numPayments = loanTerm * 12;
  const monthlyPayment = monthlyRate > 0
    ? (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)
    : loanAmount / numPayments;
  const totalLoanPayments = monthlyPayment * numPayments + loanDownPaymentAmount; // Total cash out for loan
  const effectiveLoanCost = totalLoanPayments - totalIncentives; // Net after incentives return

  // Capital Lease (Crédit-bail) calculation:
  // In a capital lease, the lessee is treated as owner for tax purposes
  // HQ solar rebate and 50% HQ battery rebate reduce the financed amount (not received as cash)
  // Remaining incentives return to client as cash:
  //   - 50% HQ battery rebate: Client receives in Year 1
  //   - Federal ITC: Client receives in Year 2
  //   - Tax shield (CCA): Client receives in Year 1
  // Uses standard amortization formula (same as loan) for realistic payment calculation
  const leaseFinancedAmount = capexGross - hqSolar - (hqBattery * 0.5); // Rebates reduce financed amount
  const leaseMonthlyRate = leaseImplicitRate / 100 / 12;
  const leaseNumPayments = leaseTerm * 12;
  const leaseMonthlyPayment = leaseFinancedAmount > 0 && leaseMonthlyRate > 0
    ? (leaseFinancedAmount * leaseMonthlyRate * Math.pow(1 + leaseMonthlyRate, leaseNumPayments)) / (Math.pow(1 + leaseMonthlyRate, leaseNumPayments) - 1)
    : leaseFinancedAmount / Math.max(1, leaseNumPayments);
  const leaseTotalPayments = leaseMonthlyPayment * leaseNumPayments;
  // Only incentives NOT already netted from financed amount
  const leaseTotalIncentives = (hqBattery * 0.5) + federalITC + taxShield;
  const effectiveLeaseCost = leaseTotalPayments - leaseTotalIncentives;

  const formatCurrency = (value: number) => {
    // For values >= 1M, show as "X,XM$" format
    if (Math.abs(value) >= 1000000) {
      const millions = value / 1000000;
      if (language === "fr") {
        return `${millions.toFixed(2).replace(".", ",")} M$`;
      }
      return `$${millions.toFixed(2)}M`;
    }
    return new Intl.NumberFormat(language === "fr" ? "fr-CA" : "en-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Use consistent 25-year horizon for all financing comparisons
  const analysisHorizon = 25;

  // Total degraded savings over analysis horizon (accounts for 0.5%/yr panel degradation)
  const totalDegradedSavings = Array.from({ length: analysisHorizon }, (_, i) =>
    annualSavings * Math.pow(1 - degradationRate, i)
  ).reduce((a, b) => a + b, 0);

  // Capital Lease: payments with incentives, then free energy after lease term (you own the system)
  // Net savings = Total degraded savings over 25 years - effective cost (lease payments - incentives)
  const leaseNetSavings = totalDegradedSavings - effectiveLeaseCost;

  // PPA (Third-Party Power Purchase Agreement) calculation:
  // Based on TRC Solar model - client pays for electricity, not the system
  // Year 1: 100% of HQ rate (no savings in year 1)
  // Year 2+: 85% of HQ rate (15% savings vs HQ)
  // After term: Client must buy out system at fair market value (~10% of original CAPEX)
  // Post-buyout: Client owns system and gets 100% energy savings
  // IMPORTANT: All incentives (HQ rebates, federal ITC, tax shield) are RETAINED by PPA provider
  const hqTariffRate = assumptions?.tariffCode === "M" ? 0.06061 : 0.11933; // $/kWh based on tariff
  // Compute degradation-aware PPA totals
  let ppaTotalPayments = 0;
  let hqCostDuringPpa = 0;
  for (let y = 1; y <= ppaTerm; y++) {
    const degradedProd = totalAnnualProductionKWh * Math.pow(1 - degradationRate, y - 1);
    const ppaRate = y === 1 ? (ppaYear1Rate / 100) : (ppaYear2Rate / 100);
    ppaTotalPayments += degradedProd * hqTariffRate * ppaRate;
    hqCostDuringPpa += degradedProd * hqTariffRate;
  }
  // PPA provider keeps ALL incentives - this is where they profit
  const ppaProviderKeepsIncentives = totalIncentives;
  // Buyout cost at end of PPA term (fair market value, typically 10% of original CAPEX)
  const ppaBuyoutCost = capexGross * (ppaBuyoutPct / 100);
  // Post-PPA savings: After buyout, client owns system — same total savings as ownership (includes demand savings, surplus credits, etc.)
  let postPpaSavings = 0;
  for (let y = ppaTerm + 1; y <= analysisHorizon; y++) {
    postPpaSavings += annualSavings * Math.pow(1 - degradationRate, y - 1);
  }
  // PPA savings during term = what they would have paid HQ - what they pay PPA provider
  const ppaSavingsDuringTerm = hqCostDuringPpa - ppaTotalPayments;
  // Total PPA "cost" = payments to PPA provider + buyout cost
  const ppaEffectiveCost = ppaTotalPayments + ppaBuyoutCost;
  // Net savings over 25 years = savings during PPA + free electricity after PPA - buyout cost
  const ppaNetSavings = ppaSavingsDuringTerm + postPpaSavings - ppaBuyoutCost;
  // Display values for PPA cost breakdown UI
  const ppaYear1Annual = totalAnnualProductionKWh * hqTariffRate * (ppaYear1Rate / 100);
  const ppaYear2Annual = totalAnnualProductionKWh * hqTariffRate * (ppaYear2Rate / 100);
  const postPpaYears = Math.max(0, analysisHorizon - ppaTerm);
  // Average monthly "payment" for display purposes
  const ppaMonthlyPayment = ppaTotalPayments / (ppaTerm * 12);

  const options = [
    {
      type: "cash" as const,
      icon: Wallet,
      label: t("financing.cash"),
      upfrontCost: upfrontCashNeeded, // Realistic cash needed at signing
      totalCost: capexNet, // Net after all incentives return
      monthlyPayment: 0,
      netSavings: totalDegradedSavings - capexNet,
    },
    {
      type: "loan" as const,
      icon: CreditCard,
      label: t("financing.loan"),
      upfrontCost: loanDownPaymentAmount,
      totalCost: effectiveLoanCost, // Net after incentives return
      totalPayments: totalLoanPayments, // Gross cash out
      monthlyPayment: monthlyPayment,
      netSavings: totalDegradedSavings - effectiveLoanCost,
    },
    {
      type: "lease" as const,
      icon: FileCheck,
      label: t("financing.lease"),
      upfrontCost: 0,
      totalCost: effectiveLeaseCost, // Net after incentives return (like loan)
      totalPayments: leaseTotalPayments, // Gross lease payments
      monthlyPayment: leaseMonthlyPayment,
      netSavings: leaseNetSavings, // 25 years of savings minus effective cost
    },
    {
      type: "ppa" as const,
      icon: Zap,
      label: t("financing.ppa"),
      upfrontCost: 0, // No upfront cost for PPA
      totalCost: ppaEffectiveCost, // Total payments to PPA provider
      totalPayments: ppaTotalPayments,
      monthlyPayment: ppaMonthlyPayment,
      netSavings: ppaNetSavings, // Savings during term + free electricity after
      isPpa: true, // Flag to show special PPA info
    },
  ];

  // Calculate cumulative cashflow for each financing option over analysis horizon
  const calculateCumulativeCashflows = () => {
    const years = analysisHorizon;
    const data: { year: number; cash: number; loan: number; lease: number; ppa: number }[] = [];

    // Cash option: upfront cost, then savings, with incentive returns
    let cashCumulative = -upfrontCashNeeded;

    // Loan option: down payment, then monthly payments + savings, with incentive returns
    let loanCumulative = -loanDownPaymentAmount;
    const annualLoanPayment = monthlyPayment * 12;

    // Capital Lease (Crédit-bail): rebates reduce financed amount, so no upfront cash received
    // Year 0 starts at 0 (rebates already netted from the financed amount)
    const annualLeasePayment = leaseMonthlyPayment * 12;
    let leaseCumulative = 0;

    // PPA: No upfront cost, pay for electricity during term, free after term
    let ppaCumulative = 0;

    for (let year = 0; year <= years; year++) {
      if (year === 0) {
        // Year 0: initial investments
        data.push({
          year,
          cash: cashCumulative / 1000,
          loan: loanCumulative / 1000,
          lease: leaseCumulative / 1000,
          ppa: ppaCumulative / 1000,
        });
      } else {
        // Add degraded savings each year for ownership options (cash, loan, lease)
        const degradedSavings = annualSavings * Math.pow(1 - degradationRate, year - 1);
        cashCumulative += degradedSavings;
        loanCumulative += degradedSavings;
        leaseCumulative += degradedSavings;

        // PPA: During term, client saves vs HQ rate but pays PPA provider (energy-only, with degradation)
        // At end of term, client must buy out system at fair market value
        // After buyout, client gets energy-only savings (consistent with during-term basis)
        if (year <= ppaTerm) {
          const degradedProduction = totalAnnualProductionKWh * Math.pow(1 - degradationRate, year - 1);
          const ppaRateThisYear = year === 1 ? (ppaYear1Rate / 100) : (ppaYear2Rate / 100);
          const hqCostThisYear = degradedProduction * hqTariffRate;
          const ppaCostThisYear = degradedProduction * hqTariffRate * ppaRateThisYear;
          ppaCumulative += (hqCostThisYear - ppaCostThisYear);
          if (year === ppaTerm) {
            ppaCumulative -= ppaBuyoutCost;
          }
        } else {
          // After buyout: client owns system — same total savings as ownership options (includes demand savings, surplus credits, etc.)
          ppaCumulative += degradedSavings;
        }

        // Subtract payments for loan (if still in term)
        if (year <= loanTerm) {
          loanCumulative -= annualLoanPayment;
        }

        // Subtract lease payments (during lease term)
        if (year <= leaseTerm) {
          leaseCumulative -= annualLeasePayment;
        }

        // Add incentive returns for cash, loan, and capital lease
        // Capital lease: rebates already netted from financed amount, only remaining incentives return
        // PPA: NO incentives return to client (provider keeps them all)
        if (year === 1) {
          cashCumulative += year1Returns;
          loanCumulative += year1Returns;
          // Lease Year 1: 50% HQ battery + tax shield (NO extra hqSolar — already netted from financed amount)
          leaseCumulative += year1Returns;
        }
        if (year === 2) {
          cashCumulative += year2Returns;
          loanCumulative += year2Returns;
          leaseCumulative += year2Returns; // Crédit-bail: Federal ITC
        }

        data.push({
          year,
          cash: cashCumulative / 1000,
          loan: loanCumulative / 1000,
          lease: leaseCumulative / 1000,
          ppa: ppaCumulative / 1000,
        });
      }
    }

    return data;
  };

  const cumulativeCashflowData = calculateCumulativeCashflows();

  return (
    <Card id="pdf-section-financing" data-testid="card-financing-calculator">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          {t("financing.title")}
        </CardTitle>
        <CardDescription>{t("financing.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {options.map((option) => {
            const colors = FINANCING_COLORS[option.type];
            const isSelected = financingType === option.type;
            return (
              <button
                key={option.type}
                onClick={() => setFinancingType(option.type)}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  isSelected
                    ? `${colors.border} bg-opacity-10`
                    : "border-border hover:border-muted-foreground/50"
                }`}
                style={isSelected ? { backgroundColor: `${colors.stroke}15` } : undefined}
                data-testid={`button-financing-${option.type}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`w-3 h-3 rounded-full ${colors.bg}`}
                    style={{ boxShadow: isSelected ? `0 0 8px ${colors.stroke}` : undefined }}
                  />
                  <option.icon className={`w-4 h-4 ${isSelected ? colors.text : "text-muted-foreground"}`} />
                </div>
                <p className={`font-medium text-sm ${isSelected ? colors.text : ""}`}>{option.label}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {option.monthlyPayment > 0
                    ? `${formatCurrency(option.monthlyPayment)}${language === "fr" ? "/mois" : "/mo"}`
                    : language === "fr" ? "Paiement unique" : "One-time"
                  }
                </p>
              </button>
            );
          })}
        </div>

        {financingType === "loan" && (
          <div className="grid md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="space-y-2">
              <Label>{t("financing.loanTerm")}</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[loanTerm]}
                  onValueChange={([v]) => setLoanTerm(v)}
                  min={5}
                  max={20}
                  step={1}
                  data-testid="slider-loan-term"
                />
                <span className="text-sm font-mono w-12">{loanTerm}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("financing.interestRate")}</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[interestRate]}
                  onValueChange={([v]) => setInterestRate(v)}
                  min={3}
                  max={12}
                  step={0.25}
                  data-testid="slider-interest-rate"
                />
                <span className="text-sm font-mono w-12">{interestRate}%</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("financing.downPayment")}</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[downPayment]}
                  onValueChange={([v]) => setDownPayment(v)}
                  min={0}
                  max={50}
                  step={5}
                  data-testid="slider-down-payment"
                />
                <span className="text-sm font-mono w-12">{downPayment}%</span>
              </div>
            </div>
          </div>
        )}

        {financingType === "lease" && (
          <div className="p-4 bg-muted/50 rounded-lg space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === "fr" ? "Durée du bail" : "Lease term"}</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[leaseTerm]}
                    onValueChange={([v]) => setLeaseTerm(v)}
                    min={5}
                    max={20}
                    step={1}
                    data-testid="slider-lease-term"
                  />
                  <span className="text-sm font-mono w-16">{leaseTerm} {language === "fr" ? "ans" : "yrs"}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("financing.leaseImplicitRate")}</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[leaseImplicitRate]}
                    onValueChange={([v]) => setLeaseImplicitRate(v)}
                    min={5}
                    max={15}
                    step={0.5}
                    data-testid="slider-lease-implicit-rate"
                  />
                  <span className="text-sm font-mono w-12">{leaseImplicitRate}%</span>
                </div>
              </div>
            </div>
            <div className="text-sm space-y-1 text-muted-foreground">
              <p className="flex justify-between gap-2 font-medium">
                <span>{language === "fr" ? "Montant financé (CAPEX total):" : "Financed amount (total CAPEX):"}</span>
                <span className="font-mono">{formatCurrency(leaseFinancedAmount)}</span>
              </p>
              <p className="flex justify-between gap-2 pt-2 border-t">
                <span>{language === "fr" ? "Paiement mensuel:" : "Monthly payment:"}</span>
                <span className="font-mono font-semibold">{formatCurrency(leaseMonthlyPayment)}</span>
              </p>
              <p className="flex justify-between gap-2 pt-2 border-t text-xs">
                <span>{language === "fr" ? "Incitatifs retournés au client:" : "Incentives returned to client:"}</span>
                <span className="font-mono text-primary">+{formatCurrency(leaseTotalIncentives)}</span>
              </p>
            </div>
          </div>
        )}

        {/* PPA Controls and Legal Warning */}
        {financingType === "ppa" && (
          <div className="space-y-4">
            {/* Legal Warning - Prominent */}
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-700 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
                {t("financing.ppaLegalWarning")}
              </p>
            </div>

            {/* PPA Parameters */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Zap className="w-4 h-4" />
                <span>{t("financing.ppaCompetitorModel")}</span>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("financing.ppaTerm")}</Label>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[ppaTerm]}
                      onValueChange={([v]) => setPpaTerm(v)}
                      min={10}
                      max={25}
                      step={1}
                      data-testid="slider-ppa-term"
                    />
                    <span className="text-sm font-mono w-16">{ppaTerm} {language === "fr" ? "ans" : "yrs"}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("financing.ppaYear1Rate")}</Label>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[ppaYear1Rate]}
                      onValueChange={([v]) => setPpaYear1Rate(v)}
                      min={80}
                      max={110}
                      step={5}
                      data-testid="slider-ppa-year1-rate"
                    />
                    <span className="text-sm font-mono w-12">{ppaYear1Rate}%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("financing.ppaYear2Rate")}</Label>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[ppaYear2Rate]}
                      onValueChange={([v]) => setPpaYear2Rate(v)}
                      min={50}
                      max={95}
                      step={5}
                      data-testid="slider-ppa-year2-rate"
                    />
                    <span className="text-sm font-mono w-12">{ppaYear2Rate}%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{language === "fr" ? "Rachat fin de terme" : "End-of-term buyout"}</Label>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[ppaBuyoutPct]}
                      onValueChange={([v]) => setPpaBuyoutPct(v)}
                      min={0}
                      max={25}
                      step={1}
                      data-testid="slider-ppa-buyout"
                    />
                    <span className="text-sm font-mono w-12">{ppaBuyoutPct}%</span>
                  </div>
                </div>
              </div>

              {/* PPA Cost Breakdown */}
              <div className="text-sm space-y-1 text-muted-foreground pt-2 border-t">
                <p className="flex justify-between gap-2">
                  <span>{language === "fr" ? "Paiement An 1:" : "Year 1 payment:"}</span>
                  <span className="font-mono">{formatCurrency(ppaYear1Annual)}</span>
                </p>
                <p className="flex justify-between gap-2">
                  <span>{language === "fr" ? `Paiement An 2-${ppaTerm}:` : `Year 2-${ppaTerm} payment:`}</span>
                  <span className="font-mono">{formatCurrency(ppaYear2Annual)}{language === "fr" ? "/an" : "/yr"}</span>
                </p>
                <p className="flex justify-between gap-2 pt-2 border-t font-medium">
                  <span>{language === "fr" ? `Total ${ppaTerm} ans:` : `Total ${ppaTerm} years:`}</span>
                  <span className="font-mono font-semibold">{formatCurrency(ppaTotalPayments)}</span>
                </p>
                <p className="flex justify-between gap-2 pt-2 border-t text-xs text-red-600 dark:text-red-400">
                  <span>{t("financing.ppaNoIncentives")}:</span>
                  <span className="font-mono">-{formatCurrency(ppaProviderKeepsIncentives)}</span>
                </p>
                {ppaBuyoutCost > 0 && (
                  <p className="flex justify-between gap-2 text-xs text-red-600 dark:text-red-400">
                    <span>{language === "fr" ? `Rachat An ${ppaTerm} (${ppaBuyoutPct}% CAPEX):` : `Buyout Year ${ppaTerm} (${ppaBuyoutPct}% CAPEX):`}</span>
                    <span className="font-mono">-{formatCurrency(ppaBuyoutCost)}</span>
                  </p>
                )}
                <p className="flex justify-between gap-2 text-xs text-[#16A34A] dark:text-green-400">
                  <span>{language === "fr" ? `Propriété post-rachat:` : `Post-buyout ownership:`}</span>
                  <span className="font-mono">+{formatCurrency(postPpaSavings)} ({postPpaYears} {language === "fr" ? "ans" : "yrs"})</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Cash Flow Timeline for Cash and Loan */}
        {(financingType === "cash" || financingType === "loan") && totalIncentives > 0 && (
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {language === "fr" ? "Flux de trésorerie réaliste" : "Realistic Cash Flow"}
            </h4>
            <div className="grid gap-2 text-sm">
              {financingType === "cash" ? (
                <>
                  <div className="flex justify-between items-center py-1 border-b border-dashed">
                    <span className="text-muted-foreground">
                      {language === "fr" ? "Jour 0 — Paiement initial" : "Day 0 — Initial Payment"}
                    </span>
                    <span className="font-mono font-bold text-destructive">
                      -{formatCurrency(upfrontCashNeeded)}
                    </span>
                  </div>
                  {hqSolar > 0 && (
                    <div className="flex justify-between items-center py-1 border-b border-dashed">
                      <span className="text-muted-foreground text-xs">
                        {language === "fr" ? "└ Incl. rabais Hydro-Québec solaire" : "└ Incl. Hydro-Québec solar rebate"}
                      </span>
                      <span className="font-mono text-xs text-primary">
                        (-{formatCurrency(hqSolar)})
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex justify-between items-center py-1 border-b border-dashed">
                    <span className="text-muted-foreground">
                      {language === "fr" ? "Jour 0 — Mise de fonds" : "Day 0 — Down Payment"}
                    </span>
                    <span className="font-mono font-bold text-destructive">
                      -{formatCurrency(loanDownPaymentAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-dashed">
                    <span className="text-muted-foreground">
                      {language === "fr" ? `An 1-${loanTerm} — Paiements` : `Year 1-${loanTerm} — Payments`}
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {formatCurrency(monthlyPayment)}{language === "fr" ? "/mois" : "/mo"}
                    </span>
                  </div>
                </>
              )}
              {year1Returns > 0 && (
                <div className="flex justify-between items-center py-1 border-b border-dashed">
                  <span className="text-muted-foreground">
                    {language === "fr" ? "An 1 — Rabais Hydro-Québec + Crédit CCA" : "Year 1 — Hydro-Québec Rebate + CCA Credit"}
                  </span>
                  <span className="font-mono font-semibold text-primary">
                    +{formatCurrency(year1Returns)}
                  </span>
                </div>
              )}
              {year2Returns > 0 && (
                <div className="flex justify-between items-center py-1 border-b border-dashed">
                  <span className="text-muted-foreground">
                    {language === "fr" ? "An 2 — CII fédéral (30%)" : "Year 2 — Federal ITC (30%)"}
                  </span>
                  <span className="font-mono font-semibold text-primary">
                    +{formatCurrency(year2Returns)}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center py-1 pt-2 border-t">
                <span className="font-medium">
                  {language === "fr" ? "Coût net final" : "Final Net Cost"}
                </span>
                <span className="font-mono font-bold">
                  {formatCurrency(financingType === "cash" ? capexNet : effectiveLoanCost)}
                </span>
              </div>
            </div>
          </div>
        )}

        <div
          className="grid grid-cols-3 gap-4 pt-4 border-t rounded-lg p-4 mt-2"
          style={{ backgroundColor: `${FINANCING_COLORS[financingType].stroke}10` }}
        >
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">
              {financingType === "cash"
                ? (language === "fr" ? "Mise de fonds" : "Upfront Cash")
                : financingType === "loan"
                  ? (language === "fr" ? "Coût net" : "Net Cost")
                  : t("financing.totalCost")
              }
            </p>
            <p className={`text-xl font-bold font-mono ${FINANCING_COLORS[financingType].text}`}>
              {formatCurrency(
                financingType === "cash"
                  ? upfrontCashNeeded
                  : (options.find(o => o.type === financingType)?.totalCost || 0)
              )}
            </p>
            {financingType === "cash" && (
              <p className="text-xs text-muted-foreground mt-1">
                {language === "fr" ? `(net: ${formatCurrency(capexNet)})` : `(net: ${formatCurrency(capexNet)})`}
              </p>
            )}
            {financingType === "loan" && (
              <p className="text-xs text-muted-foreground mt-1">
                {language === "fr"
                  ? `(paiements: ${formatCurrency(totalLoanPayments)})`
                  : `(payments: ${formatCurrency(totalLoanPayments)})`
                }
              </p>
            )}
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">{t("financing.monthlyPayment")}</p>
            <p className={`text-xl font-bold font-mono ${FINANCING_COLORS[financingType].text}`}>
              {formatCurrency(options.find(o => o.type === financingType)?.monthlyPayment || 0)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">{t("financing.netSavings")} (25 {t("compare.years")})</p>
            <p className={`text-xl font-bold font-mono ${(options.find(o => o.type === financingType)?.netSavings || 0) > 0 ? "text-[#16A34A]" : "text-red-500"}`}>
              {formatCurrency(options.find(o => o.type === financingType)?.netSavings || 0)}
            </p>
          </div>
        </div>

        {/* Unified Cashflow Chart - All Acquisition Models */}
        {cumulativeCashflowData.length > 0 && (
          <div id="pdf-section-financing-chart" className="pt-4 border-t bg-white dark:bg-card rounded-lg p-4">
            <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              {language === "fr" ? "Flux de trésorerie selon le mode d'acquisition (25 ans)" : "Cash Flow by Acquisition Mode (25 years)"}
            </h4>
            <div className="h-64 bg-white dark:bg-gray-900 rounded">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cumulativeCashflowData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="year"
                    fontSize={11}
                    label={{ value: language === "fr" ? "Année" : "Year", position: "bottom", offset: 0, fontSize: 11 }}
                  />
                  <YAxis
                    fontSize={11}
                    tickFormatter={(v) => `${v >= 0 ? "" : "-"}$${Math.abs(v).toFixed(0)}k`}
                    label={{ value: language === "fr" ? "Flux cumulatif ($k)" : "Cumulative Flow ($k)", angle: -90, position: "insideLeft", fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      `$${(value * 1000).toLocaleString()}`,
                      name === "cash" ? (language === "fr" ? "Comptant" : "Cash") :
                      name === "loan" ? (language === "fr" ? "Prêt" : "Loan") :
                      name === "lease" ? (language === "fr" ? "Crédit-bail" : "Capital Lease") :
                      (language === "fr" ? "PPA Tiers" : "Third-Party PPA")
                    ]}
                    labelFormatter={(year) => `${language === "fr" ? "Année" : "Year"} ${year}`}
                  />
                  <Legend
                    formatter={(value) =>
                      value === "cash" ? (language === "fr" ? "Comptant" : "Cash") :
                      value === "loan" ? (language === "fr" ? "Prêt" : "Loan") :
                      value === "lease" ? (language === "fr" ? "Crédit-bail" : "Capital Lease") :
                      (language === "fr" ? "PPA Tiers ⚠️" : "Third-Party PPA ⚠️")
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="cash"
                    stroke={FINANCING_COLORS.cash.stroke}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="loan"
                    stroke={FINANCING_COLORS.loan.stroke}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="lease"
                    stroke={FINANCING_COLORS.lease.stroke}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="ppa"
                    stroke={FINANCING_COLORS.ppa.stroke}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              {language === "fr"
                ? "Flux de trésorerie cumulatif incluant tous les coûts, économies et incitatifs"
                : "Cumulative cash flow including all costs, savings, and incentives"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
