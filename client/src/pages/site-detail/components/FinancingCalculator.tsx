import { useState } from "react";
import {
  Wallet,
  CreditCard,
  FileCheck,
  Clock,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useI18n } from "@/lib/i18n";
import type { SimulationRun, CashflowEntry } from "@shared/schema";
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

export const FINANCING_COLORS = {
  cash: { bg: "bg-[#16A34A]", text: "text-[#16A34A]", border: "border-[#16A34A]", stroke: "#16A34A", hsl: "hsl(142, 72%, 36%)" },
  loan: { bg: "bg-[#003DA6]", text: "text-[#003DA6]", border: "border-[#003DA6]", stroke: "#003DA6", hsl: "hsl(218, 100%, 33%)" },
  lease: { bg: "bg-[#FFB005]", text: "text-[#FFB005]", border: "border-[#FFB005]", stroke: "#FFB005", hsl: "hsl(41, 100%, 51%)" },
};

export function FinancingCalculator({ simulation, displayedScenario }: { simulation: SimulationRun; displayedScenario: DisplayedScenarioType }) {
  const { t, language } = useI18n();
  const [financingType, setFinancingType] = useState<"cash" | "loan" | "lease">("cash");
  const [loanTerm, setLoanTerm] = useState(10);
  const [interestRate, setInterestRate] = useState(5.5);
  const [downPayment, setDownPayment] = useState(20);
  const [leaseImplicitRate, setLeaseImplicitRate] = useState(8.5);
  const [leaseTerm, setLeaseTerm] = useState(15);

  const scenarioBreakdown = displayedScenario.scenarioBreakdown;

  const capexNet = displayedScenario.capexNet || 0;
  const capexGross = scenarioBreakdown?.capexGross || (simulation.capexNet || 0);

  const hqSolar = scenarioBreakdown?.actualHQSolar || 0;
  // HQ battery incentive has been discontinued (potentialHQBattery = 0 in cashflowCalculations)
  const federalITC = scenarioBreakdown?.itcAmount || 0;
  const taxShield = scenarioBreakdown?.taxShield || 0;
  const totalIncentives = hqSolar + federalITC + taxShield;

  const upfrontCashNeeded = capexGross - hqSolar;
  const year1Returns = taxShield;
  const year2Returns = federalITC;

  interface ScenarioCashflowEntry {
    year: number;
    netCashflow: number;
    ebitda?: number;
    investment?: number;
    dpa?: number;
    incentives?: number;
    revenue?: number;
    opex?: number;
  }

  const serverCashflows: CashflowEntry[] = (simulation.cashflows as CashflowEntry[] || []);
  const scenarioCashflows: ScenarioCashflowEntry[] =
    (displayedScenario.scenarioBreakdown?.cashflows as ScenarioCashflowEntry[] | undefined) || [];

  const hasScenarioCashflows = scenarioCashflows.length > 0;

  const scenarioCfHasDetail = (cf: ScenarioCashflowEntry) =>
    typeof cf.ebitda === "number" || typeof cf.investment === "number" || typeof cf.dpa === "number" || typeof cf.incentives === "number";

  const hasFullDetail = hasScenarioCashflows
    ? scenarioCashflows.some(cf => cf.year >= 1 && scenarioCfHasDetail(cf))
    : serverCashflows.length > 1 &&
      typeof serverCashflows[1]?.ebitda === "number" && serverCashflows[1]?.ebitda !== 0;

  const analysisHorizon = 25;

  const getYearCashflow = (year: number) => {
    if (hasScenarioCashflows) {
      const scf = scenarioCashflows.find(cf => cf.year === year);
      if (scf) {
        if (scenarioCfHasDetail(scf)) {
          return {
            year: scf.year,
            netCashflow: scf.netCashflow,
            ebitda: scf.ebitda ?? 0,
            investment: scf.investment ?? 0,
            dpa: scf.dpa ?? 0,
            incentives: scf.incentives ?? 0,
          };
        }
        return { ...scf, ebitda: 0, investment: 0, dpa: 0, incentives: 0 };
      }
      return null;
    }
    return serverCashflows.find(cf => cf.year === year) || null;
  };

  const totalServerNet25 = (() => {
    const source = hasScenarioCashflows ? scenarioCashflows
      : serverCashflows.length > 0 ? serverCashflows
      : [];
    return source
      .filter(cf => cf.year >= 0 && cf.year <= analysisHorizon)
      .reduce((sum, cf) => sum + cf.netCashflow, 0);
  })();

  const totalOperating25 = hasFullDetail
    ? (() => {
        const detailSource = hasScenarioCashflows ? scenarioCashflows : serverCashflows;
        return detailSource
          .filter(cf => cf.year >= 1 && cf.year <= analysisHorizon)
          .reduce((sum, cf) => sum + (cf.ebitda || 0) + (cf.investment || 0), 0);
      })()
    : totalServerNet25 + upfrontCashNeeded - totalIncentives;

  const loanDownPaymentAmount = capexGross * downPayment / 100;
  const loanAmount = capexGross - loanDownPaymentAmount;
  const monthlyRate = interestRate / 100 / 12;
  const numPayments = loanTerm * 12;
  const monthlyPayment = monthlyRate > 0
    ? (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)
    : loanAmount / numPayments;
  const totalLoanPayments = monthlyPayment * numPayments + loanDownPaymentAmount;
  const effectiveLoanCost = totalLoanPayments - totalIncentives;

  const leaseFinancedAmount = capexGross - federalITC;
  const leaseMonthlyRate = leaseImplicitRate / 100 / 12;
  const leaseNumPayments = leaseTerm * 12;
  const leaseMonthlyPayment = leaseFinancedAmount > 0 && leaseMonthlyRate > 0
    ? (leaseFinancedAmount * leaseMonthlyRate * Math.pow(1 + leaseMonthlyRate, leaseNumPayments)) / (Math.pow(1 + leaseMonthlyRate, leaseNumPayments) - 1)
    : leaseFinancedAmount / Math.max(1, leaseNumPayments);
  const leaseTotalPayments = leaseMonthlyPayment * leaseNumPayments;
  const effectiveLeaseCost = leaseTotalPayments;

  const leaseNetSavings = totalOperating25 - effectiveLeaseCost;

  const formatCurrency = (value: number) => {
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

  const cashNetSavings = totalServerNet25;
  const loanNetSavings = totalServerNet25 + upfrontCashNeeded - totalLoanPayments;

  const options = [
    {
      type: "cash" as const,
      icon: Wallet,
      label: t("financing.cash"),
      upfrontCost: upfrontCashNeeded,
      totalCost: capexNet,
      monthlyPayment: 0,
      netSavings: cashNetSavings,
    },
    {
      type: "loan" as const,
      icon: CreditCard,
      label: t("financing.loan"),
      upfrontCost: loanDownPaymentAmount,
      totalCost: effectiveLoanCost,
      totalPayments: totalLoanPayments,
      monthlyPayment: monthlyPayment,
      netSavings: loanNetSavings,
    },
    {
      type: "lease" as const,
      icon: FileCheck,
      label: t("financing.lease"),
      upfrontCost: 0,
      totalCost: effectiveLeaseCost,
      totalPayments: leaseTotalPayments,
      monthlyPayment: leaseMonthlyPayment,
      netSavings: leaseNetSavings,
    },
  ];

  const calculateCumulativeCashflows = () => {
    const data: { year: number; cash: number; loan: number; lease: number }[] = [];

    const scenarioYear0 = hasScenarioCashflows
      ? scenarioCashflows.find(cf => cf.year === 0)?.netCashflow
      : undefined;
    const serverYear0 = serverCashflows.find(cf => cf.year === 0)?.netCashflow;
    const year0cf = scenarioYear0 ?? serverYear0 ?? -upfrontCashNeeded;
    let cashCumulative = year0cf;
    let loanCumulative = -loanDownPaymentAmount;
    let leaseCumulative = 0;
    const annualLoanPayment = monthlyPayment * 12;
    const annualLeasePayment = leaseMonthlyPayment * 12;

    data.push({
      year: 0,
      cash: cashCumulative / 1000,
      loan: loanCumulative / 1000,
      lease: leaseCumulative / 1000,
    });

    for (let year = 1; year <= analysisHorizon; year++) {
      const cf = getYearCashflow(year);

      if (cf && hasFullDetail) {
        cashCumulative += cf.netCashflow;

        const operating = cf.ebitda + cf.investment;
        loanCumulative += operating + cf.dpa + cf.incentives - (year <= loanTerm ? annualLoanPayment : 0);
        leaseCumulative += operating - (year <= leaseTerm ? annualLeasePayment : 0);
      } else if (cf) {
        cashCumulative += cf.netCashflow;

        const operatingEstimate = cf.netCashflow
          - (year === 1 ? year1Returns : 0)
          - (year === 2 ? year2Returns : 0);

        loanCumulative += operatingEstimate
          + (year === 1 ? year1Returns : 0)
          + (year === 2 ? year2Returns : 0)
          - (year <= loanTerm ? annualLoanPayment : 0);

        leaseCumulative += operatingEstimate - (year <= leaseTerm ? annualLeasePayment : 0);
      }

      data.push({
        year,
        cash: cashCumulative / 1000,
        loan: loanCumulative / 1000,
        lease: leaseCumulative / 1000,
      });
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
        <div className="grid grid-cols-3 gap-3">
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
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-700 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
                {language === "fr"
                  ? "Au Québec, Hydro-Québec exige que le client soit propriétaire et exploitant de l'installation pour être admissible aux incitatifs. Dans un crédit-bail, le bailleur est propriétaire du système. Les incitatifs Hydro-Québec ne s'appliquent pas. Le CII fédéral (30%) est réclamé par le bailleur et reflété dans les paiements réduits."
                  : "In Quebec, Hydro-Québec requires the client to be both owner and operator to be eligible for incentives. In a lease, the lessor owns the system. Hydro-Québec incentives do not apply. The federal ITC (30%) is claimed by the lessor and reflected in reduced payments."}
              </p>
            </div>
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
                  <span>{language === "fr" ? "Montant financé (CAPEX brut − CII fédéral):" : "Financed amount (Gross CAPEX − federal ITC):"}</span>
                  <span className="font-mono">{formatCurrency(leaseFinancedAmount)}</span>
                </p>
                <p className="flex justify-between gap-2 pt-2 border-t">
                  <span>{language === "fr" ? "Paiement mensuel:" : "Monthly payment:"}</span>
                  <span className="font-mono font-semibold">{formatCurrency(leaseMonthlyPayment)}</span>
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
                      (language === "fr" ? "Crédit-bail" : "Capital Lease")
                    ]}
                    labelFormatter={(year) => `${language === "fr" ? "Année" : "Year"} ${year}`}
                  />
                  <Legend
                    formatter={(value) =>
                      value === "cash" ? (language === "fr" ? "Comptant" : "Cash") :
                      value === "loan" ? (language === "fr" ? "Prêt" : "Loan") :
                      (language === "fr" ? "Crédit-bail" : "Capital Lease")
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
