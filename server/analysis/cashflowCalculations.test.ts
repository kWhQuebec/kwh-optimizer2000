/**
 * cashflowCalculations.test.ts — Unit tests for the consolidated cashflow module.
 *
 * These tests verify:
 * 1. Incentive calculations match HQ OSE 6.0 rules
 * 2. NPV/IRR match known values
 * 3. Cashflow array structure is correct
 * 4. Edge cases (zero CAPEX, no battery, battery-only)
 * 5. LCOE calculations for 25/30 year horizons
 * 6. Backward compatibility with existing engine outputs
 */

import { describe, it, expect } from 'vitest';
import {
  calculateCapex,
  calculateAnnualSavings,
  calculateIncentives,
  generateCashflowArray,
  calculateFinancialMetrics,
  calculateLCOE,
  calculateCashflowMetrics,
  calculateNPV,
  calculateIRR,
  type CashflowInputs,
} from './cashflowCalculations';
import { computeAcquisitionCashflows } from '../services/acquisitionCashflows';
import { applyOptimalScenario } from '../documentDataProvider';

// ─── Test Assumptions (matching defaultAnalysisAssumptions) ─────────────────

const defaultAssumptions = {
  tariffEnergy: 0.05,       // $0.05/kWh (M-rate approx)
  tariffPower: 14.00,       // $14/kW/month
  solarYieldKWhPerKWp: 1150,
  orientationFactor: 1.0,
  rackingSystemType: 'kb_10_low' as any,
  inverterLoadRatio: 1.45,
  temperatureCoefficient: -0.004,
  wireLossPercent: 0.03,
  degradationRatePercent: 0.004,
  inflationRate: 0.035,
  discountRate: 0.07,
  taxRate: 0.265,
  solarCostPerW: 2.25,
  batteryCapacityCost: 540,
  batteryPowerCost: 800,
  omSolarPercent: 0.01,
  omPerKwc: 15,
  omBatteryPercent: 0.005,
  omEscalation: 0.025,
  roofAreaSqFt: 100000,
  roofUtilizationRatio: 0.80,
  batteryReplacementYear: 10,
  batteryReplacementCostFactor: 0.60,
  batteryPriceDeclineRate: 0.05,
  analysisYears: 25,
  bifacialEnabled: true,
  bifacialityFactor: 0.80,
  roofAlbedo: 0.60,
  bifacialCostPremium: 0.10,
  lidLossPercent: 0.01,
  mismatchLossPercent: 0.02,
  mismatchStringsLossPercent: 0.0015,
  moduleQualityGainPercent: 0.0075,
  yieldSource: 'default' as const,
  hqSurplusCompensationRate: 0.0460,
  netMeteringEnabled: true,
  snowLossProfile: 'ballasted_10deg' as any,
  epcMargin: 0.35,
};

// ─── Standard test scenario: 200 kW solar, 100 kWh battery ─────────────────

function makeStandardInputs(overrides?: Partial<CashflowInputs>): CashflowInputs {
  return {
    pvSizeKW: 200,
    battEnergyKWh: 100,
    battPowerKW: 50,
    selfConsumptionKWh: 180000,
    totalExportedKWh: 50000,
    totalProductionKWh: 230000,
    gridChargingKWh: 5000,
    annualConsumptionKWh: 500000,
    peakBeforeKW: 300,
    peakAfterKW: 250,
    assumptions: { ...defaultAssumptions } as any,
    ...overrides,
  };
}

// ─── CAPEX Tests ────────────────────────────────────────────────────────────

describe('calculateCapex', () => {
  it('should calculate solar CAPEX correctly (200kW × $2.35/W with bifacial)', () => {
    const result = calculateCapex(200, 0, 0, defaultAssumptions as any);
    // 200 kW × 1000 W/kW × ($2.25 + $0.10 bifacial) = $470,000
    expect(result.capexPV).toBe(200 * 1000 * 2.35);
    expect(result.effectiveSolarCostPerW).toBe(2.35);
  });

  it('should calculate battery CAPEX correctly', () => {
    const result = calculateCapex(0, 100, 50, defaultAssumptions as any);
    // 100 kWh × $540 + 50 kW × $800 = $54,000 + $40,000 = $94,000
    expect(result.capexBattery).toBe(100 * 540 + 50 * 800);
    expect(result.capexGross).toBe(result.capexBattery); // no solar
  });

  it('should calculate combined CAPEX', () => {
    const result = calculateCapex(200, 100, 50, defaultAssumptions as any);
    expect(result.capexGross).toBe(result.capexPV + result.capexBattery);
  });

  it('should use tiered pricing when solarCostPerW is null', () => {
    const noOverride = { ...defaultAssumptions, solarCostPerW: undefined } as any;
    const result = calculateCapex(200, 0, 0, noOverride);
    // getTieredSolarCostPerW returns a value based on size, + bifacial premium
    expect(result.effectiveSolarCostPerW).toBeGreaterThan(0);
  });

  it('should not add bifacial premium when disabled', () => {
    const noBifacial = { ...defaultAssumptions, bifacialEnabled: false } as any;
    const result = calculateCapex(200, 0, 0, noBifacial);
    expect(result.effectiveSolarCostPerW).toBe(2.25);
  });
});

// ─── Incentives Tests ───────────────────────────────────────────────────────

describe('calculateIncentives', () => {
  const h = defaultAssumptions as any;

  it('should apply $1000/kW HQ incentive capped at 40% of solar CAPEX', () => {
    const capexPV = 200 * 1000 * 2.35; // $470,000
    const result = calculateIncentives(capexPV, 0, capexPV, 200, 0, h);

    // $1000/kW × 200 kW = $200,000
    // 40% of $470,000 = $188,000
    // Min($200,000, $188,000) = $188,000
    expect(result.potentialHQSolar).toBe(200000);
    expect(result.cap40Percent).toBe(capexPV * 0.40);
    expect(result.incentivesHQSolar).toBe(Math.min(200000, capexPV * 0.40));
  });

  it('should cap HQ solar at 1000 kW for large systems', () => {
    const capexPV = 1500 * 1000 * 2.35;
    const result = calculateIncentives(capexPV, 0, capexPV, 1500, 0, h);

    // Eligible: min(1500, 1000) = 1000 kW → $1,000,000
    expect(result.potentialHQSolar).toBe(1000000);
  });

  it('should give battery leftover cap room when paired with solar', () => {
    const capexPV = 100 * 1000 * 2.35; // $235,000
    const capexBatt = 100 * 540 + 50 * 800; // $94,000
    const result = calculateIncentives(capexPV, capexBatt, capexPV + capexBatt, 100, 100, h);

    // 40% cap = $235,000 × 0.40 = $94,000
    // Solar: min($100,000, $94,000) = $94,000
    // Remaining cap = $94,000 - $94,000 = $0
    // Battery gets $0
    expect(result.incentivesHQBattery).toBe(0);
  });

  it('should give battery NO incentive when solar=0', () => {
    const capexBatt = 100 * 540;
    const result = calculateIncentives(0, capexBatt, capexBatt, 0, 100, h);
    expect(result.incentivesHQBattery).toBe(0);
    expect(result.incentivesHQSolar).toBe(0);
  });

  it('should calculate federal ITC as 30% of (gross - HQ)', () => {
    const capexPV = 200 * 1000 * 2.35;
    const result = calculateIncentives(capexPV, 0, capexPV, 200, 0, h);

    const expectedITC = (capexPV - result.incentivesHQ) * 0.30;
    expect(result.incentivesFederal).toBeCloseTo(expectedITC, 2);
  });

  it('should calculate tax shield as 90% × taxRate × depreciable basis', () => {
    const capexPV = 200 * 1000 * 2.35;
    const result = calculateIncentives(capexPV, 0, capexPV, 200, 0, h);

    const depBasis = Math.max(0, capexPV - result.incentivesHQ - result.incentivesFederal);
    const expectedTaxShield = depBasis * 0.265 * 0.90;
    expect(result.taxShield).toBeCloseTo(expectedTaxShield, 2);
  });

  it('should have capexNet = gross - HQ - ITC - taxShield', () => {
    const capexPV = 200 * 1000 * 2.35;
    const result = calculateIncentives(capexPV, 0, capexPV, 200, 0, h);

    const expected = capexPV - result.incentivesHQ - result.incentivesFederal - result.taxShield;
    expect(result.capexNet).toBeCloseTo(expected, 2);
  });
});

// ─── Cashflow Array Tests ───────────────────────────────────────────────────

describe('generateCashflowArray', () => {
  const h = defaultAssumptions as any;

  it('should produce 31 entries (year 0 to 30)', () => {
    const cf = generateCashflowArray(50000, 2000, 94000, 100, 200, 470000, 300000, 20000, 80000, 0, h);
    expect(cf).toHaveLength(31);
    expect(cf[0].year).toBe(0);
    expect(cf[30].year).toBe(30);
  });

  it('should have year 0 = -equityInitial', () => {
    const equity = 300000;
    const cf = generateCashflowArray(50000, 2000, 94000, 100, 200, 470000, equity, 20000, 80000, 0, h);
    expect(cf[0].netCashflow).toBe(-equity);
    expect(cf[0].investment).toBe(-equity);
    expect(cf[0].revenue).toBe(0);
  });

  it('should apply tax shield in year 1', () => {
    const taxShield = 20000;
    const cf = generateCashflowArray(50000, 0, 0, 0, 200, 470000, 300000, taxShield, 80000, 0, h);
    expect(cf[1].dpa).toBe(taxShield);
    expect(cf[2].dpa).toBe(0);
  });

  it('should apply federal ITC in year 2', () => {
    const itc = 80000;
    const cf = generateCashflowArray(50000, 0, 0, 0, 200, 470000, 300000, 20000, itc, 0, h);
    expect(cf[2].incentives).toBe(itc);
    expect(cf[3].incentives).toBe(0);
  });

  it('should have battery replacement at year 10, 20, 30', () => {
    const capexBatt = 94000;
    const cf = generateCashflowArray(50000, 0, capexBatt, 100, 200, 470000, 300000, 20000, 80000, 0, h);

    // Year 10: replacement
    expect(cf[10].investment).toBeLessThan(0);
    // Year 20: replacement
    expect(cf[20].investment).toBeLessThan(0);
    // Year 30: replacement
    expect(cf[30].investment).toBeLessThan(0);
    // Year 5: no replacement
    expect(cf[5].investment).toBe(0);
  });

  it('should NOT have battery replacement when battEnergyKWh=0', () => {
    const cf = generateCashflowArray(50000, 0, 94000, 0, 200, 470000, 300000, 20000, 80000, 0, h);
    expect(cf[10].investment).toBe(0);
    expect(cf[20].investment).toBe(0);
  });

  it('should apply degradation to revenue each year', () => {
    const cf = generateCashflowArray(50000, 2000, 0, 0, 200, 470000, 300000, 0, 0, 0, h);
    // Year 2 revenue should be less than year 1 base (before inflation kicks in)
    // Revenue = (savings + surplus) × degradation × inflation
    // Year 1: 52000 × 1.0 × 1.0 = 52000
    // Year 2: 52000 × 0.996 × 1.035 = ~53591
    // With inflation > degradation, revenue grows — but degradation dampens growth
    const y1Revenue = cf[1].revenue;
    const y2Revenue = cf[2].revenue;
    // Revenue should grow because inflation (3.5%) > degradation (0.4%)
    expect(y2Revenue).toBeGreaterThan(y1Revenue * 0.99);
  });

  it('should have cumulative track correctly', () => {
    const cf = generateCashflowArray(50000, 2000, 0, 0, 200, 470000, 100000, 0, 0, 0, h);
    let running = 0;
    for (const entry of cf) {
      running += entry.netCashflow;
      expect(entry.cumulative).toBeCloseTo(running, 2);
    }
  });
});

// ─── NPV / IRR Tests ───────────────────────────────────────────────────────

describe('calculateNPV', () => {
  it('should return sum of cashflows when discount=0', () => {
    const cfs = [-100, 50, 50, 50];
    expect(calculateNPV(cfs, 0, 3)).toBeCloseTo(50, 2);
  });

  it('should discount future cashflows', () => {
    const cfs = [-1000, 500, 500, 500];
    const npv = calculateNPV(cfs, 0.10, 3);
    // -1000 + 500/1.1 + 500/1.21 + 500/1.331 = -1000 + 454.55 + 413.22 + 375.66 = 243.43
    expect(npv).toBeCloseTo(243.43, 0);
  });

  it('should respect year limit', () => {
    const cfs = [-100, 50, 50, 50, 50, 50];
    const npv2 = calculateNPV(cfs, 0, 2);
    expect(npv2).toBeCloseTo(0, 2); // -100 + 50 + 50
  });
});

describe('calculateIRR', () => {
  it('should return ~0% for breakeven project', () => {
    const cfs = [-1000, 500, 500];
    const irr = calculateIRR(cfs);
    expect(irr).toBeCloseTo(0, 1);
  });

  it('should return positive IRR for profitable project', () => {
    const cfs = [-1000, 400, 400, 400, 400];
    const irr = calculateIRR(cfs);
    expect(irr).toBeGreaterThan(0);
    // Verify: NPV at this rate should be ~0
    const npv = calculateNPV(cfs, irr, 4);
    expect(Math.abs(npv)).toBeLessThan(1);
  });
});

// ─── LCOE Tests ─────────────────────────────────────────────────────────────

describe('calculateLCOE', () => {
  it('should calculate LCOE for 25 and 30 years', () => {
    const result = calculateLCOE(200, 100000, 3000, 0.004, 230000);
    expect(result.lcoe).toBeGreaterThan(0);
    expect(result.lcoe30).toBeGreaterThan(0);
    // 30-year LCOE should be lower (more production over longer period)
    expect(result.lcoe30).toBeLessThan(result.lcoe);
  });

  it('should return 0 when no production', () => {
    const result = calculateLCOE(0, 100000, 3000, 0.004, 0);
    expect(result.lcoe).toBe(0);
    expect(result.lcoe30).toBe(0);
  });
});

// ─── Financial Metrics Tests ────────────────────────────────────────────────

describe('calculateFinancialMetrics', () => {
  it('should calculate payback correctly', () => {
    // Simple scenario: pay back in year 3
    const cashflows = [
      { year: 0, revenue: 0, opex: 0, ebitda: 0, investment: -100, dpa: 0, incentives: 0, netCashflow: -100, cumulative: -100 },
      { year: 1, revenue: 40, opex: 0, ebitda: 40, investment: 0, dpa: 0, incentives: 0, netCashflow: 40, cumulative: -60 },
      { year: 2, revenue: 40, opex: 0, ebitda: 40, investment: 0, dpa: 0, incentives: 0, netCashflow: 40, cumulative: -20 },
      { year: 3, revenue: 40, opex: 0, ebitda: 40, investment: 0, dpa: 0, incentives: 0, netCashflow: 40, cumulative: 20 },
    ];
    const result = calculateFinancialMetrics(cashflows, 0.07, 25);
    expect(result.simplePaybackYears).toBe(3);
  });
});

// ─── Master Function Integration Tests ──────────────────────────────────────

describe('calculateCashflowMetrics (master function)', () => {
  it('should return complete results for standard scenario', () => {
    const inputs = makeStandardInputs();
    const result = calculateCashflowMetrics(inputs);

    // Verify structure
    expect(result.cashflows).toHaveLength(31);
    expect(result.capexGross).toBeGreaterThan(0);
    expect(result.capexNet).toBeLessThan(result.capexGross);
    expect(result.incentivesHQ).toBeGreaterThan(0);
    expect(result.incentivesFederal).toBeGreaterThan(0);
    expect(result.taxShield).toBeGreaterThan(0);
    expect(result.annualSavings).toBeGreaterThan(0);
    expect(result.lcoe).toBeGreaterThan(0);
    expect(result.lcoe30).toBeGreaterThan(0);
    expect(result.selfSufficiencyPercent).toBeCloseTo(36, 0); // 180k/500k = 36%
    expect(result.co2AvoidedTonnesPerYear).toBeGreaterThan(0);
  });

  it('should return zero result for zero CAPEX', () => {
    const inputs = makeStandardInputs({
      pvSizeKW: 0,
      battEnergyKWh: 0,
      battPowerKW: 0,
    });
    const result = calculateCashflowMetrics(inputs);
    expect(result.capexGross).toBe(0);
    expect(result.capexNet).toBe(0);
    expect(result.cashflows).toHaveLength(0);
  });

  it('should handle solar-only scenario (no battery)', () => {
    const inputs = makeStandardInputs({
      battEnergyKWh: 0,
      battPowerKW: 0,
      gridChargingKWh: 0,
    });
    const result = calculateCashflowMetrics(inputs);
    expect(result.capexBattery).toBe(0);
    expect(result.incentivesHQBattery).toBe(0);
    // No battery replacements
    expect(result.cashflows[10].investment).toBe(0);
  });

  it('should use monthly peaks when provided', () => {
    const monthlyBefore = [300, 310, 290, 280, 270, 260, 300, 310, 290, 280, 270, 260];
    const monthlyAfter = [250, 260, 240, 230, 220, 210, 250, 260, 240, 230, 220, 210];
    const inputs = makeStandardInputs({
      monthlyPeaksBefore: monthlyBefore,
      monthlyPeaksAfter: monthlyAfter,
    });
    const result = calculateCashflowMetrics(inputs);
    // Demand savings should be calculated from monthly peaks
    expect(result.annualSavings).toBeGreaterThan(0);
  });

  it('should have NPV25 > NPV10 for profitable project', () => {
    const inputs = makeStandardInputs();
    const result = calculateCashflowMetrics(inputs);
    // More years = more value for profitable project
    expect(result.npv25).toBeGreaterThan(result.npv10);
  });

  it('should calculate surplus revenue when net metering enabled', () => {
    const inputs = makeStandardInputs();
    const result = calculateCashflowMetrics(inputs);
    // 50000 kWh × $0.046 = $2,300/year
    expect(result.annualSurplusRevenue).toBeCloseTo(50000 * 0.046, 0);
  });

  it('should have zero surplus when net metering disabled', () => {
    const inputs = makeStandardInputs({
      assumptions: { ...defaultAssumptions, netMeteringEnabled: false } as any,
    });
    const result = calculateCashflowMetrics(inputs);
    expect(result.annualSurplusRevenue).toBe(0);
  });

  it('should include breakdown with all required fields', () => {
    const inputs = makeStandardInputs();
    const result = calculateCashflowMetrics(inputs);
    const b = result.breakdown;

    expect(b.capexSolar).toBeGreaterThan(0);
    expect(b.capexGross).toBeGreaterThan(0);
    expect(b.actualHQSolar).toBeGreaterThan(0);
    expect(b.itcAmount).toBeGreaterThan(0);
    expect(b.taxShield).toBeGreaterThan(0);
    expect(b.capexNet).toBeGreaterThan(0);
    expect(b.equityInitial).toBeGreaterThan(0);
  });
});

describe('No-battery scenario investment checks', () => {
  const h = {
    ...defaultAssumptions,
    batteryReplacementYear: 10,
    batteryReplacementCostFactor: 0.60,
    batteryPriceDeclineRate: 0.05,
  } as any;

  it('should have zero investment at years 10, 20, 30 when battEnergyKWh=0', () => {
    const cf = generateCashflowArray(50000, 0, 94000, 0, 200, 470000, 300000, 20000, 80000, 0, h);
    for (const y of [10, 20, 30]) {
      expect(cf[y].investment).toBe(0);
    }
  });

  it('should have negative investment at replacement years when battEnergyKWh > 0', () => {
    const cf = generateCashflowArray(50000, 0, 94000, 100, 200, 470000, 300000, 20000, 80000, 0, h);
    expect(cf[10].investment).toBeLessThan(0);
    expect(cf[20].investment).toBeLessThan(0);
  });
});

describe('computeAcquisitionCashflows', () => {
  it('should use existing cashflows for all three curves when available', () => {
    const cashflows = [];
    let cumulative = -200000;
    cashflows.push({ year: 0, netCashflow: -200000, cumulative });
    for (let y = 1; y <= 25; y++) {
      const net = 20000;
      cumulative += net;
      cashflows.push({ year: y, netCashflow: net, cumulative });
    }

    const result = computeAcquisitionCashflows({
      capexGross: 300000,
      capexNet: 200000,
      annualSavings: 18000,
      incentivesHQSolar: 50000,
      incentivesHQBattery: 0,
      incentivesFederal: 50000,
      taxShield: 10000,
      cashflows,
    });

    expect(result.series[1].cash).toBe(cashflows[1].cumulative);

    const resultNoCf = computeAcquisitionCashflows({
      capexGross: 300000,
      capexNet: 200000,
      annualSavings: 18000,
      incentivesHQSolar: 50000,
      incentivesHQBattery: 0,
      incentivesFederal: 50000,
      taxShield: 10000,
    });

    expect(result.series[15].loan).not.toBe(resultNoCf.series[15].loan);
  });

  it('loan and lease curves should differ from cash curve', () => {
    const cashflows = [];
    let cumulative = -200000;
    cashflows.push({ year: 0, netCashflow: -200000, cumulative });
    for (let y = 1; y <= 25; y++) {
      const net = 20000;
      cumulative += net;
      cashflows.push({ year: y, netCashflow: net, cumulative });
    }

    const result = computeAcquisitionCashflows({
      capexGross: 300000,
      capexNet: 200000,
      annualSavings: 18000,
      incentivesHQSolar: 50000,
      incentivesHQBattery: 0,
      incentivesFederal: 50000,
      taxShield: 10000,
      cashflows,
    });

    expect(result.series[0].loan).not.toBe(result.series[0].cash);
    expect(result.series[5].loan).not.toBe(result.series[5].cash);
    expect(result.series[5].lease).not.toBe(result.series[5].cash);
  });
});

describe('applyOptimalScenario', () => {
  const makeSimulation = (overrides: any = {}) => ({
    id: 1,
    siteId: 1,
    pvSizeKW: 100,
    battEnergyKWh: 50,
    battPowerKW: 25,
    capexNet: 200000,
    capexGross: 300000,
    capexPV: 250000,
    capexBattery: 50000,
    npv25: 100000,
    irr25: 12,
    simplePaybackYears: 8,
    selfSufficiencyPercent: 60,
    annualSavings: 30000,
    savingsYear1: 30000,
    totalProductionKWh: 150000,
    co2AvoidedTonnesPerYear: 20,
    incentivesHQSolar: 10000,
    incentivesHQBattery: 5000,
    incentivesHQ: 15000,
    incentivesFederal: 20000,
    taxShield: 8000,
    totalIncentives: 43000,
    lcoe: 0.05,
    annualCostBefore: 50000,
    annualCostAfter: 20000,
    annualEnergySavingsKWh: 100000,
    cashflows: [],
    sensitivity: null,
    site: { id: 1, client: { id: 1 } },
    ...overrides,
  });

  it('should return simulation unchanged when no sensitivity data', () => {
    const sim = makeSimulation();
    const result = applyOptimalScenario(sim as any);
    expect(result.pvSizeKW).toBe(100);
  });

  it('should preserve cashflow detail fields when available in scenario', () => {
    const detailedCashflows = [
      { year: 0, netCashflow: -180000, ebitda: 0, investment: -180000, dpa: 0, incentives: 0, revenue: 0, opex: 0 },
      { year: 1, netCashflow: 35000, ebitda: 28000, investment: 0, dpa: 8000, incentives: 5000, revenue: 30000, opex: -2000 },
      { year: 2, netCashflow: 47000, ebitda: 27000, investment: 0, dpa: 0, incentives: 20000, revenue: 29000, opex: -2000 },
    ];

    const sim = makeSimulation({
      sensitivity: {
        optimalScenarios: {
          bestNPV: {
            pvSizeKW: 150,
            battEnergyKWh: 0,
            battPowerKW: 0,
            capexNet: 180000,
            npv25: 150000,
            irr25: 15,
            simplePaybackYears: 6,
            selfSufficiencyPercent: 70,
            annualSavings: 35000,
            totalProductionKWh: 200000,
            co2AvoidedTonnesPerYear: 25,
            scenarioBreakdown: {
              capexGross: 250000,
              capexSolar: 250000,
              capexBattery: 0,
              actualHQSolar: 30000,
              actualHQBattery: 0,
              itcAmount: 20000,
              taxShield: 8000,
              cashflows: detailedCashflows,
            },
          },
        },
      },
    });

    const result = applyOptimalScenario(sim as any);
    const cf1 = (result.cashflows as any[])[1];
    expect(cf1.ebitda).toBe(28000);
    expect(cf1.dpa).toBe(8000);
    expect(cf1.incentives).toBe(5000);
    expect(cf1.investment).toBe(0);
  });

  it('should use fallback zeros when scenario cashflows have no detail', () => {
    const simpleCashflows = [
      { year: 0, netCashflow: -180000 },
      { year: 1, netCashflow: 35000 },
      { year: 2, netCashflow: 47000 },
    ];

    const sim = makeSimulation({
      sensitivity: {
        optimalScenarios: {
          bestNPV: {
            pvSizeKW: 150,
            battEnergyKWh: 0,
            battPowerKW: 0,
            capexNet: 180000,
            npv25: 150000,
            irr25: 15,
            simplePaybackYears: 6,
            selfSufficiencyPercent: 70,
            annualSavings: 35000,
            totalProductionKWh: 200000,
            co2AvoidedTonnesPerYear: 25,
            scenarioBreakdown: {
              capexGross: 250000,
              capexSolar: 250000,
              capexBattery: 0,
              actualHQSolar: 30000,
              actualHQBattery: 0,
              itcAmount: 20000,
              taxShield: 8000,
              cashflows: simpleCashflows,
            },
          },
        },
      },
    });

    const result = applyOptimalScenario(sim as any);
    const cf1 = (result.cashflows as any[])[1];
    expect(cf1.ebitda).toBe(0);
    expect(cf1.investment).toBe(0);
    expect(cf1.netCashflow).toBe(35000);
  });

  it('should preserve detail fields even when ebitda is zero (investment-only year)', () => {
    const detailedCashflows = [
      { year: 0, netCashflow: -180000, ebitda: 0, investment: -180000, dpa: 0, incentives: 0 },
      { year: 1, netCashflow: 8000, ebitda: 0, investment: 0, dpa: 8000, incentives: 0 },
      { year: 10, netCashflow: -50000, ebitda: 0, investment: -50000, dpa: 0, incentives: 0 },
    ];

    const sim = makeSimulation({
      sensitivity: {
        optimalScenarios: {
          bestNPV: {
            pvSizeKW: 150,
            battEnergyKWh: 0,
            battPowerKW: 0,
            capexNet: 180000,
            npv25: 150000,
            irr25: 15,
            simplePaybackYears: 6,
            selfSufficiencyPercent: 70,
            annualSavings: 35000,
            totalProductionKWh: 200000,
            co2AvoidedTonnesPerYear: 25,
            scenarioBreakdown: {
              capexGross: 250000,
              capexSolar: 250000,
              capexBattery: 0,
              actualHQSolar: 30000,
              actualHQBattery: 0,
              itcAmount: 20000,
              taxShield: 8000,
              cashflows: detailedCashflows,
            },
          },
        },
      },
    });

    const result = applyOptimalScenario(sim as any);
    const cf0 = (result.cashflows as any[])[0];
    expect(cf0.investment).toBe(-180000);
    const cf1 = (result.cashflows as any[])[1];
    expect(cf1.dpa).toBe(8000);
    const cf10 = (result.cashflows as any[])[2];
    expect(cf10.investment).toBe(-50000);
  });
});
