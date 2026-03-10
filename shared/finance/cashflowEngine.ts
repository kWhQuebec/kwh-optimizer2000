/**
 * Centralized Financial Cashflow Engine
 * 
 * This module provides a single source of truth for all financing option calculations:
 * - Cash purchase (with CCA tax shield)
 * - Capital lease (7-year term with buyout)
 * 
 * All displays in Market Intelligence should derive from these calculations.
 */

function roundCurrency(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export interface CashflowInputs {
  systemSizeKW: number;
  annualProductionKWh: number;
  
  kwhCostPerWatt: number;
  
  hqIncentivePerKw: number;
  itcRate: number;
  
  gridRateY1: number;
  kwhInflation: number;
  trcInflation: number;
  degradation: number;
  omRate: number;
  omEscalation: number;
  
  ccaRate: number;
  taxRate: number;
  
  leaseTerm: number;
  leasePremium: number;
}

export interface YearlyCashflow {
  year: number;
  production: number;
  gridRate: number;
  gridSavings: number;
  omCost: number;
  ccaBenefit?: number;
  leasePayment?: number;
  netCashflow: number;
  cumulative: number;
}

export interface FinancingScenario {
  name: string;
  nameEn: string;
  investment: number;
  yearlyCashflows: YearlyCashflow[];
  totalSavings: number;
  avgAnnualSavings: number;
  paybackYear: number | null;
  ownershipYear: number;
}

export interface CashflowModel {
  inputs: CashflowInputs;
  
  grossCapex: number;
  hqIncentive: number;
  netAfterHQ: number;
  itc: number;
  netClientInvestment: number;
  
  cash: FinancingScenario;
  lease: FinancingScenario;
}

/**
 * Build the complete cashflow model for all financing scenarios
 */
export function buildCashflowModel(inputs: CashflowInputs): CashflowModel {
  const {
    systemSizeKW,
    annualProductionKWh,
    kwhCostPerWatt,
    hqIncentivePerKw,
    itcRate,
    gridRateY1,
    kwhInflation,
    degradation,
    omRate,
    omEscalation,
    ccaRate,
    taxRate,
    leaseTerm,
    leasePremium,
  } = inputs;

  const grossCapex = roundCurrency(systemSizeKW * 1000 * kwhCostPerWatt);
  const eligibleSolarKW = Math.min(systemSizeKW, 1000);
  const potentialHQIncentive = roundCurrency(eligibleSolarKW * hqIncentivePerKw);
  const hqIncentive = roundCurrency(Math.min(potentialHQIncentive, grossCapex * 0.4));
  const netAfterHQ = roundCurrency(grossCapex - hqIncentive);
  const itc = roundCurrency(netAfterHQ * itcRate);
  const netClientInvestment = roundCurrency(netAfterHQ - itc);

  const cashCashflows: YearlyCashflow[] = [];
  const leaseCashflows: YearlyCashflow[] = [];

  let cashCumulative = -netClientInvestment;
  let leaseCumulative = 0;

  let ucc = netClientInvestment;
  
  const leasePayment = roundCurrency(netClientInvestment / leaseTerm * (1 + leasePremium));

  for (let year = 1; year <= 25; year++) {
    const production = annualProductionKWh * Math.pow(1 - degradation, year - 1);
    
    const gridRate = gridRateY1 * Math.pow(1 + kwhInflation, year - 1);
    
    const gridSavings = production * gridRate;
    
    const omCost = grossCapex * omRate * Math.pow(1 + omEscalation, year - 1);

    const ccaEffective = year === 1 ? ccaRate * 0.5 : ccaRate;
    const ccaDeduction = ucc * ccaEffective;
    const ccaBenefit = ccaDeduction * taxRate;
    ucc -= ccaDeduction;
    
    const cashNet = roundCurrency(gridSavings - omCost + ccaBenefit);
    cashCumulative = roundCurrency(cashCumulative + cashNet);
    
    cashCashflows.push({
      year,
      production: roundCurrency(production, 0),
      gridRate: roundCurrency(gridRate, 4),
      gridSavings: roundCurrency(gridSavings),
      omCost: roundCurrency(omCost),
      ccaBenefit: roundCurrency(ccaBenefit),
      netCashflow: cashNet,
      cumulative: cashCumulative
    });

    const leasePaymentThisYear = year <= leaseTerm ? roundCurrency(leasePayment) : 0;
    const leaseNet = roundCurrency(gridSavings - omCost - leasePaymentThisYear);
    leaseCumulative = roundCurrency(leaseCumulative + leaseNet);
    
    leaseCashflows.push({
      year,
      production: roundCurrency(production, 0),
      gridRate: roundCurrency(gridRate, 4),
      gridSavings: roundCurrency(gridSavings),
      omCost: roundCurrency(omCost),
      leasePayment: leasePaymentThisYear,
      netCashflow: leaseNet,
      cumulative: leaseCumulative
    });
  }

  const findPaybackYear = (cashflows: YearlyCashflow[]): number | null => {
    const found = cashflows.find(cf => cf.cumulative >= 0);
    return found ? found.year : null;
  };

  const cashPayback = findPaybackYear(cashCashflows);
  const leasePayback = findPaybackYear(leaseCashflows);

  return {
    inputs,
    grossCapex,
    hqIncentive,
    netAfterHQ,
    itc,
    netClientInvestment,
    cash: {
      name: "Comptant (kWh)",
      nameEn: "Cash (kWh)",
      investment: netClientInvestment,
      yearlyCashflows: cashCashflows,
      totalSavings: roundCurrency(cashCumulative),
      avgAnnualSavings: roundCurrency((cashCumulative + netClientInvestment) / 25),
      paybackYear: cashPayback,
      ownershipYear: 1
    },
    lease: {
      name: "Crédit-bail (kWh)",
      nameEn: "Lease (kWh)",
      investment: 0,
      yearlyCashflows: leaseCashflows,
      totalSavings: roundCurrency(leaseCumulative),
      avgAnnualSavings: roundCurrency(leaseCumulative / 25),
      paybackYear: leasePayback,
      ownershipYear: leaseTerm + 1
    },
  };
}

/**
 * Default assumptions based on Quebec market conditions
 */
export const DEFAULT_CASHFLOW_INPUTS: Partial<CashflowInputs> = {
  hqIncentivePerKw: 1000,
  itcRate: 0.30,
  kwhInflation: 0.035,
  trcInflation: 0.03,
  degradation: 0.004,
  omRate: 0.01,
  omEscalation: 0.025,
  ccaRate: 0.50,
  taxRate: 0.265,
  leaseTerm: 7,
  leasePremium: 0.15,
};
