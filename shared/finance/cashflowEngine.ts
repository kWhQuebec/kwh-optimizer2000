/**
 * Centralized Financial Cashflow Engine
 * 
 * This module provides a single source of truth for all financing option calculations:
 * - Cash purchase (with CCA tax shield)
 * - Capital lease (7-year term with buyout)
 * - PPA (Power Purchase Agreement)
 * 
 * All displays in Market Intelligence should derive from these calculations.
 */

// FIX: Helper for currency rounding to avoid floating-point accumulation errors
// Uses multiplication/rounding/division pattern which is more reliable than toFixed
function roundCurrency(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export interface CashflowInputs {
  // System parameters
  systemSizeKW: number;
  annualProductionKWh: number;
  
  // Cost parameters
  kwhCostPerWatt: number;
  
  // Incentive parameters
  hqIncentivePerKw: number;  // $1,000/kW, capped at 40% CAPEX and 1MW max
  itcRate: number;           // 30% federal ITC
  
  // Rate parameters
  gridRateY1: number;        // Client's electricity rate $/kWh
  kwhInflation: number;      // HQ tariff inflation assumption (3.5%)
  trcInflation: number;      // TRC/competitor inflation assumption (3%)
  degradation: number;       // Panel degradation rate (0.5%/year)
  omRate: number;            // O&M as % of CAPEX (1%)
  omEscalation: number;      // O&M annual escalation (2.5%)
  
  // Tax parameters
  ccaRate: number;           // CCA depreciation rate (50%)
  taxRate: number;           // Corporate tax rate (26.5%)
  
  // Lease parameters
  leaseTerm: number;         // Years (7)
  leasePremium: number;      // Premium over cash cost (15%)
  
  // PPA parameters
  ppaTerm: number;           // PPA contract term (16 years)
  ppaDiscount: number;       // Discount vs grid rate (40%)
  ppaOmRate: number;         // Post-PPA O&M as % of solar value (7%)
  
  // TRC provider cost (for provider economics)
  trcProjectCost?: number;
}

export interface YearlyCashflow {
  year: number;
  production: number;
  gridRate: number;
  gridSavings: number;
  omCost: number;
  ccaBenefit?: number;
  leasePayment?: number;
  ppaPayment?: number;
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

export interface ProviderEconomics {
  grossCost: number;
  hqIncentive: number;
  itc: number;
  ccaShield: number;
  totalIncentives: number;
  actualInvestment: number;
}

export interface CashflowModel {
  // Input assumptions
  inputs: CashflowInputs;
  
  // Derived base values
  grossCapex: number;
  hqIncentive: number;
  netAfterHQ: number;
  itc: number;
  netClientInvestment: number;
  
  // Financing scenarios
  cash: FinancingScenario;
  lease: FinancingScenario;
  ppa: FinancingScenario;
  
  // Provider economics (for "How PPA providers make money" section)
  providerEconomics: ProviderEconomics;
  
  // Foregone incentives (what client gives up with PPA)
  foregoneIncentives: number;
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
    trcInflation,
    degradation,
    omRate,
    omEscalation,
    ccaRate,
    taxRate,
    leaseTerm,
    leasePremium,
    ppaTerm,
    ppaDiscount,
    ppaOmRate,
    trcProjectCost
  } = inputs;

  // Calculate base values (rounded for precision)
  const grossCapex = roundCurrency(systemSizeKW * 1000 * kwhCostPerWatt);
  // HQ incentive: $1000/kW, capped at 1MW (1000 kW) and 40% of CAPEX
  const eligibleSolarKW = Math.min(systemSizeKW, 1000); // HQ Autoproduction program limited to 1 MW
  const potentialHQIncentive = roundCurrency(eligibleSolarKW * hqIncentivePerKw);
  const hqIncentive = roundCurrency(Math.min(potentialHQIncentive, grossCapex * 0.4));
  const netAfterHQ = roundCurrency(grossCapex - hqIncentive);
  const itc = roundCurrency(netAfterHQ * itcRate);
  const netClientInvestment = roundCurrency(netAfterHQ - itc);

  // Build yearly arrays for each scenario
  const cashCashflows: YearlyCashflow[] = [];
  const leaseCashflows: YearlyCashflow[] = [];
  const ppaCashflows: YearlyCashflow[] = [];

  let cashCumulative = -netClientInvestment;
  let leaseCumulative = 0;
  let ppaCumulative = 0;

  // CCA tracking for cash option
  let ucc = netClientInvestment;
  
  // Lease payment calculation
  const leasePayment = roundCurrency(netClientInvestment / leaseTerm * (1 + leasePremium));

  for (let year = 1; year <= 25; year++) {
    // Production with degradation
    const production = annualProductionKWh * Math.pow(1 - degradation, year - 1);
    
    // Grid rate with inflation (kWh Québec assumption)
    const gridRate = gridRateY1 * Math.pow(1 + kwhInflation, year - 1);
    
    // Grid savings
    const gridSavings = production * gridRate;
    
    // O&M cost with escalation
    const omCost = grossCapex * omRate * Math.pow(1 + omEscalation, year - 1);

    // === CASH SCENARIO ===
    // CCA benefit (half-year rule in year 1)
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

    // === LEASE SCENARIO ===
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

    // === PPA SCENARIO ===
    let ppaNet: number;
    let ppaPayment: number;
    
    if (year <= ppaTerm) {
      // During PPA term: pay discounted rate to provider
      const trcRate = gridRateY1 * Math.pow(1 + trcInflation, year - 1) * (1 - ppaDiscount);
      ppaPayment = roundCurrency(production * trcRate);
      ppaNet = roundCurrency(gridSavings - ppaPayment);
    } else {
      // After PPA term: own system with O&M
      const solarValue = roundCurrency(production * gridRate);
      ppaPayment = roundCurrency(solarValue * ppaOmRate);
      ppaNet = roundCurrency(solarValue - ppaPayment);
    }
    ppaCumulative = roundCurrency(ppaCumulative + ppaNet);
    
    ppaCashflows.push({
      year,
      production: roundCurrency(production, 0),
      gridRate: roundCurrency(gridRate, 4),
      gridSavings: roundCurrency(gridSavings),
      omCost: roundCurrency(omCost),
      ppaPayment,
      netCashflow: ppaNet,
      cumulative: ppaCumulative
    });
  }

  // Calculate payback years
  const findPaybackYear = (cashflows: YearlyCashflow[]): number | null => {
    const found = cashflows.find(cf => cf.cumulative >= 0);
    return found ? found.year : null;
  };

  const cashPayback = findPaybackYear(cashCashflows);
  const leasePayback = findPaybackYear(leaseCashflows);

  // Provider economics (using TRC cost if available, otherwise estimate)
  const providerCost = roundCurrency(trcProjectCost || grossCapex);
  // Provider also subject to 1MW cap
  const providerHQ = roundCurrency(Math.min(eligibleSolarKW * hqIncentivePerKw, providerCost * 0.4));
  const providerNetAfterHQ = roundCurrency(providerCost - providerHQ);
  const providerITC = roundCurrency(providerNetAfterHQ * itcRate);
  const providerNetInvestment = roundCurrency(providerNetAfterHQ - providerITC);
  const providerCCAShield = roundCurrency(providerNetInvestment * 0.26); // 26% effective CCA benefit
  const totalProviderIncentives = roundCurrency(providerHQ + providerITC + providerCCAShield);

  const providerEconomics: ProviderEconomics = {
    grossCost: providerCost,
    hqIncentive: providerHQ,
    itc: providerITC,
    ccaShield: providerCCAShield,
    totalIncentives: totalProviderIncentives,
    actualInvestment: roundCurrency(Math.max(0, providerCost - totalProviderIncentives))
  };

  // Foregone incentives (client perspective - what they give up with PPA)
  const clientCCAShield = roundCurrency(netClientInvestment * 0.26);
  const foregoneIncentives = roundCurrency(hqIncentive + itc + clientCCAShield);

  // PPA payback based on foregone incentives
  const ppaPaybackIdx = ppaCashflows.findIndex(cf => cf.cumulative >= foregoneIncentives);
  const ppaPayback = ppaPaybackIdx >= 0 ? ppaPaybackIdx + 1 : null;

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
    ppa: {
      name: "PPA",
      nameEn: "PPA",
      investment: 0,
      yearlyCashflows: ppaCashflows,
      totalSavings: roundCurrency(ppaCumulative),
      avgAnnualSavings: roundCurrency(ppaCumulative / 25),
      paybackYear: ppaPayback,
      ownershipYear: ppaTerm + 1
    },
    providerEconomics,
    foregoneIncentives
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
  ppaTerm: 16,
  ppaDiscount: 0.40,
  ppaOmRate: 0.07
};
