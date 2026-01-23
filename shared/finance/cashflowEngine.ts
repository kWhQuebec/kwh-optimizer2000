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
  kwhInflation: number;      // kWh Québec inflation assumption (4.8%)
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

  // Calculate base values
  const grossCapex = systemSizeKW * 1000 * kwhCostPerWatt;
  // HQ incentive: $1000/kW, capped at 1MW (1000 kW) and 40% of CAPEX
  const eligibleSolarKW = Math.min(systemSizeKW, 1000); // HQ Autoproduction program limited to 1 MW
  const potentialHQIncentive = eligibleSolarKW * hqIncentivePerKw;
  const hqIncentive = Math.min(potentialHQIncentive, grossCapex * 0.4);
  const netAfterHQ = grossCapex - hqIncentive;
  const itc = netAfterHQ * itcRate;
  const netClientInvestment = netAfterHQ - itc;

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
  const leasePayment = netClientInvestment / leaseTerm * (1 + leasePremium);

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
    
    const cashNet = gridSavings - omCost + ccaBenefit;
    cashCumulative += cashNet;
    
    cashCashflows.push({
      year,
      production,
      gridRate,
      gridSavings,
      omCost,
      ccaBenefit,
      netCashflow: cashNet,
      cumulative: cashCumulative
    });

    // === LEASE SCENARIO ===
    const leasePaymentThisYear = year <= leaseTerm ? leasePayment : 0;
    const leaseNet = gridSavings - omCost - leasePaymentThisYear;
    leaseCumulative += leaseNet;
    
    leaseCashflows.push({
      year,
      production,
      gridRate,
      gridSavings,
      omCost,
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
      ppaPayment = production * trcRate;
      ppaNet = gridSavings - ppaPayment;
    } else {
      // After PPA term: own system with O&M
      const solarValue = production * gridRate;
      ppaPayment = solarValue * ppaOmRate;
      ppaNet = solarValue - ppaPayment;
    }
    ppaCumulative += ppaNet;
    
    ppaCashflows.push({
      year,
      production,
      gridRate,
      gridSavings,
      omCost,
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
  const providerCost = trcProjectCost || grossCapex;
  // Provider also subject to 1MW cap
  const providerHQ = Math.min(eligibleSolarKW * hqIncentivePerKw, providerCost * 0.4);
  const providerNetAfterHQ = providerCost - providerHQ;
  const providerITC = providerNetAfterHQ * itcRate;
  const providerNetInvestment = providerNetAfterHQ - providerITC;
  const providerCCAShield = providerNetInvestment * 0.26; // 26% effective CCA benefit
  const totalProviderIncentives = providerHQ + providerITC + providerCCAShield;

  const providerEconomics: ProviderEconomics = {
    grossCost: providerCost,
    hqIncentive: providerHQ,
    itc: providerITC,
    ccaShield: providerCCAShield,
    totalIncentives: totalProviderIncentives,
    actualInvestment: Math.max(0, providerCost - totalProviderIncentives)
  };

  // Foregone incentives (client perspective - what they give up with PPA)
  const clientCCAShield = netClientInvestment * 0.26;
  const foregoneIncentives = hqIncentive + itc + clientCCAShield;

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
      totalSavings: cashCumulative,
      avgAnnualSavings: (cashCumulative + netClientInvestment) / 25,
      paybackYear: cashPayback,
      ownershipYear: 1
    },
    lease: {
      name: "Crédit-bail (kWh)",
      nameEn: "Lease (kWh)",
      investment: 0,
      yearlyCashflows: leaseCashflows,
      totalSavings: leaseCumulative,
      avgAnnualSavings: leaseCumulative / 25,
      paybackYear: leasePayback,
      ownershipYear: leaseTerm + 1
    },
    ppa: {
      name: "PPA",
      nameEn: "PPA",
      investment: 0,
      yearlyCashflows: ppaCashflows,
      totalSavings: ppaCumulative,
      avgAnnualSavings: ppaCumulative / 25,
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
  kwhInflation: 0.048,
  trcInflation: 0.03,
  degradation: 0.005,
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
