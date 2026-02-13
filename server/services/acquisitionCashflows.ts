interface AcquisitionInputs {
  capexGross: number;
  capexNet: number;
  annualSavings: number;
  incentivesHQSolar: number;
  incentivesHQBattery: number;
  incentivesFederal: number;
  taxShield: number;
  loanTermYears?: number;
  loanInterestRate?: number;
  loanDownPaymentPct?: number;
  leaseTermYears?: number;
  leaseImplicitRate?: number;
  cashflows?: { year: number; cumulative: number; netCashflow: number }[];
}

export interface CumulativePoint {
  year: number;
  cash: number;
  loan: number;
  lease: number;
}

export interface AcquisitionResult {
  series: CumulativePoint[];
  cashPaybackYear: number | null;
  loanPaybackYear: number | null;
  leasePaybackYear: number | null;
}

const DEGRADATION_RATE = 0.005;

export function computeAcquisitionCashflows(inputs: AcquisitionInputs): AcquisitionResult {
  const {
    annualSavings,
    incentivesHQSolar: hqSolar = 0,
    incentivesHQBattery: hqBattery = 0,
    incentivesFederal: federalITC = 0,
    taxShield = 0,
    loanTermYears = 10,
    loanInterestRate = 7,
    loanDownPaymentPct = 30,
    leaseTermYears = 15,
    leaseImplicitRate = 8.5,
  } = inputs;

  const capexGross = inputs.capexGross || inputs.capexNet || 0;

  const horizon = 25;

  const loanDownPaymentAmount = capexGross * loanDownPaymentPct / 100;
  const loanAmount = capexGross - loanDownPaymentAmount;
  const monthlyRate = loanInterestRate / 100 / 12;
  const numPayments = loanTermYears * 12;
  const monthlyPayment = monthlyRate > 0
    ? (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)
    : loanAmount / numPayments;
  const annualLoanPayment = monthlyPayment * 12;

  const leaseFinancedAmount = capexGross - hqSolar - (hqBattery * 0.5);
  const leaseMonthlyRate = leaseImplicitRate / 100 / 12;
  const leaseNumPayments = leaseTermYears * 12;
  const leaseMonthlyPayment = leaseFinancedAmount > 0 && leaseMonthlyRate > 0
    ? (leaseFinancedAmount * leaseMonthlyRate * Math.pow(1 + leaseMonthlyRate, leaseNumPayments)) / (Math.pow(1 + leaseMonthlyRate, leaseNumPayments) - 1)
    : leaseFinancedAmount / Math.max(1, leaseNumPayments);
  const annualLeasePayment = leaseMonthlyPayment * 12;

  const upfrontCashNeeded = capexGross - hqSolar - (hqBattery * 0.5);
  const year1Returns = (hqBattery * 0.5) + taxShield;
  const year2Returns = federalITC;

  let cashCumulative = -upfrontCashNeeded;
  let loanCumulative = -loanDownPaymentAmount;
  let leaseCumulative = 0;

  const series: CumulativePoint[] = [];
  let cashPaybackYear: number | null = null;
  let loanPaybackYear: number | null = null;
  let leasePaybackYear: number | null = null;

  const existingCashflows = inputs.cashflows;

  for (let year = 0; year <= horizon; year++) {
    if (year === 0) {
      series.push({
        year,
        cash: cashCumulative,
        loan: loanCumulative,
        lease: leaseCumulative,
      });
      continue;
    }

    const degradedSavings = annualSavings * Math.pow(1 - DEGRADATION_RATE, year - 1);

    if (existingCashflows && existingCashflows.length > 0) {
      const cf = existingCashflows.find(c => c.year === year);
      if (cf) {
        cashCumulative = cf.cumulative;
      } else {
        cashCumulative += degradedSavings;
      }
    } else {
      cashCumulative += degradedSavings;
    }

    loanCumulative += degradedSavings;
    leaseCumulative += degradedSavings;

    if (year <= loanTermYears) {
      loanCumulative -= annualLoanPayment;
    }

    if (year <= leaseTermYears) {
      leaseCumulative -= annualLeasePayment;
    }

    if (year === 1) {
      if (!existingCashflows || existingCashflows.length === 0) {
        cashCumulative += year1Returns;
      }
      loanCumulative += year1Returns;
      leaseCumulative += year1Returns;
    }
    if (year === 2) {
      if (!existingCashflows || existingCashflows.length === 0) {
        cashCumulative += year2Returns;
      }
      loanCumulative += year2Returns;
      leaseCumulative += year2Returns;
    }

    series.push({
      year,
      cash: Math.round(cashCumulative),
      loan: Math.round(loanCumulative),
      lease: Math.round(leaseCumulative),
    });

    if (cashPaybackYear === null && cashCumulative >= 0) cashPaybackYear = year;
    if (loanPaybackYear === null && loanCumulative >= 0) loanPaybackYear = year;
    if (leasePaybackYear === null && leaseCumulative >= 0) leasePaybackYear = year;
  }

  return { series, cashPaybackYear, loanPaybackYear, leasePaybackYear };
}
