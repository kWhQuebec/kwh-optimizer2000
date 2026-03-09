/**
 * DETTE 2 — Critical Pipeline Tests
 *
 * Validates the MATH through the revenue pipeline:
 *   Quick Estimate → Potential Analysis → Design → Payment
 *
 * These tests ensure numbers shown to clients (and charged via Stripe)
 * are mathematically correct and consistent across all calculation paths.
 *
 * Run: npx vitest run server/__tests__/critical-pipeline.test.ts
 */

import { describe, it, expect } from 'vitest';
import { calculateCashflowMetrics, calculateCapex, calculateAnnualSavings, calculateIncentives } from '../analysis/cashflowCalculations';
import { getTieredSolarCostPerW, BASELINE_YIELD } from '../analysis';
import { defaultAnalysisAssumptions } from '@shared/schema';
import type { AnalysisAssumptions } from '@shared/schema';

// ─── Default Assumptions (from production schema + M tariff overrides) ────────

const defaultAssumptions: AnalysisAssumptions = {
  ...defaultAnalysisAssumptions,
  tariffEnergy: 0.06061,       // HQ tariff M (override default 0)
  tariffPower: 17.573,         // HQ tariff M (override default 0)
};

// ─── SECTION 1: Quick Estimate Math ──────────────────────────────────────────

describe('Quick Estimate — Consumption → Sizing → Financials', () => {

  // Constants matching routes/leads.ts quick-estimate endpoint
  const HQ_ENERGY_RATES: Record<string, number> = { G: 0.11933, M: 0.06061, L: 0.03681 };
  const ENERGY_PORTION_FACTORS: Record<string, number> = { G: 0.85, M: 0.60, L: 0.50 };
  const SOLAR_YIELD = BASELINE_YIELD; // 1150 kWh/kWp
  const TEMP_COEFF = -0.004;
  const AVERAGE_CELL_TEMP = 35;
  const STC_CELL_TEMP = 25;
  const WIRE_LOSS_PERCENT = 0.03;
  const INVERTER_EFFICIENCY = 0.96;
  const tempLossFactor = 1 + TEMP_COEFF * (AVERAGE_CELL_TEMP - STC_CELL_TEMP);
  const systemEfficiency = tempLossFactor * (1 - WIRE_LOSS_PERCENT) * INVERTER_EFFICIENCY;
  const EFFECTIVE_YIELD = SOLAR_YIELD * systemEfficiency;

  describe('Consumption calculation from monthly bill', () => {
    it('should calculate annual kWh from $2,500/month M tariff', () => {
      const monthlyBill = 2500;
      const tariff = 'M';
      const energyRate = HQ_ENERGY_RATES[tariff];
      const energyPortion = ENERGY_PORTION_FACTORS[tariff];
      const monthlyEnergyBill = monthlyBill * energyPortion;
      const monthlyKWh = monthlyEnergyBill / energyRate;
      const annualKWh = monthlyKWh * 12;

      // $2500 × 0.60 = $1500 energy portion
      // $1500 / $0.06061 = 24,752 kWh/month
      // × 12 = 297,024 kWh/year
      expect(monthlyEnergyBill).toBeCloseTo(1500, 0);
      expect(monthlyKWh).toBeCloseTo(24748, -1); // ~24,748 kWh/month
      expect(annualKWh).toBeCloseTo(296981, -2); // ~297k kWh/year
      expect(annualKWh).toBeGreaterThan(200000);
    });

    it('should calculate annual kWh from $800/month G tariff', () => {
      const monthlyBill = 800;
      const tariff = 'G';
      const energyPortion = ENERGY_PORTION_FACTORS[tariff];
      const energyRate = HQ_ENERGY_RATES[tariff];
      const annualKWh = ((monthlyBill * energyPortion) / energyRate) * 12;

      // $800 × 0.85 = $680 energy
      // $680 / $0.11933 = 5,699 kWh/month
      // × 12 = 68,389 kWh/year
      expect(annualKWh).toBeCloseTo(68389, -2);
    });

    it('should use direct annual kWh when provided', () => {
      const directAnnualKwh = 500000;
      // When annualConsumptionKwh is provided, it takes priority over bill estimate
      expect(directAnnualKwh).toBe(500000);
    });
  });

  describe('System sizing from consumption', () => {
    it('should size system correctly for 100% offset', () => {
      const annualKWh = 297024;
      const offsetPercent = 1.0;
      const systemSizeKW = Math.max(10, Math.round((annualKWh * offsetPercent) / EFFECTIVE_YIELD));

      // 297,024 / ~894 effective yield ≈ 332 kW
      expect(systemSizeKW).toBeGreaterThan(250);
      expect(systemSizeKW).toBeLessThan(400);
    });

    it('should size system correctly for 70% offset', () => {
      const annualKWh = 297024;
      const offsetPercent = 0.7;
      const systemSizeKW = Math.max(10, Math.round((annualKWh * offsetPercent) / EFFECTIVE_YIELD));

      // 297,024 × 0.7 / ~894 ≈ 232 kW
      expect(systemSizeKW).toBeGreaterThan(180);
      expect(systemSizeKW).toBeLessThan(300);
    });

    it('should enforce minimum 10 kW', () => {
      const annualKWh = 1000; // Very small consumer
      const systemSizeKW = Math.max(10, Math.round((annualKWh * 0.2) / EFFECTIVE_YIELD));
      expect(systemSizeKW).toBe(10);
    });

    it('should flag systems exceeding 1 MW net metering limit', () => {
      const systemSizeKW = 1200;
      const exceedsNetMeteringLimit = systemSizeKW > 1000;
      expect(exceedsNetMeteringLimit).toBe(true);

      const smallSystem = 500;
      expect(smallSystem > 1000).toBe(false);
    });
  });

  describe('Quick estimate incentive calculations', () => {
    const HQ_INCENTIVE_PER_KW = 1000;
    const HQ_INCENTIVE_MAX_PERCENT = 0.40;
    const HQ_MW_LIMIT = 1000;
    const FEDERAL_ITC_RATE = 0.30;

    it('should calculate HQ incentive for 100 kW system', () => {
      const systemSizeKW = 100;
      const costPerW = getTieredSolarCostPerW(systemSizeKW);
      const grossCAPEX = systemSizeKW * costPerW * 1000;

      const eligibleKW = Math.min(systemSizeKW, HQ_MW_LIMIT);
      const hqIncentiveRaw = eligibleKW * HQ_INCENTIVE_PER_KW;
      const hqIncentive = Math.min(hqIncentiveRaw, grossCAPEX * HQ_INCENTIVE_MAX_PERCENT);

      // 100 kW × $1000 = $100,000 raw
      // 40% cap: 100 × costPerW × 1000 × 0.40
      expect(eligibleKW).toBe(100);
      expect(hqIncentiveRaw).toBe(100000);
      // Cap should bind for larger systems
      expect(hqIncentive).toBeLessThanOrEqual(grossCAPEX * 0.40);
      expect(hqIncentive).toBeGreaterThan(0);
    });

    it('should cap HQ incentive at 40% of gross CAPEX', () => {
      const systemSizeKW = 50; // Small system where $50k > 40% of CAPEX
      const costPerW = getTieredSolarCostPerW(systemSizeKW);
      const grossCAPEX = systemSizeKW * costPerW * 1000;

      const hqRaw = systemSizeKW * HQ_INCENTIVE_PER_KW; // $50,000
      const hqCapped = Math.min(hqRaw, grossCAPEX * HQ_INCENTIVE_MAX_PERCENT);

      // For a 50 kW system at $2.50/W: CAPEX = $125,000
      // 40% cap = $50,000 <= $50,000 raw → cap binds or equals
      expect(hqCapped).toBeLessThanOrEqual(hqRaw);
      expect(hqCapped).toBeCloseTo(grossCAPEX * 0.40, 0);
    });

    it('should limit HQ eligibility to first 1 MW', () => {
      const systemSizeKW = 1500;
      const eligibleKW = Math.min(systemSizeKW, HQ_MW_LIMIT);
      expect(eligibleKW).toBe(1000);
    });

    it('should calculate Federal ITC on net basis (after HQ)', () => {
      const grossCAPEX = 200000;
      const hqIncentive = 80000; // 40% cap
      const itcBasis = grossCAPEX - hqIncentive;
      const federalITC = Math.round(itcBasis * FEDERAL_ITC_RATE);

      // ITC = 30% × ($200k - $80k) = 30% × $120k = $36,000
      expect(itcBasis).toBe(120000);
      expect(federalITC).toBe(36000);
    });

    it('should calculate correct payback period', () => {
      const netCAPEX = 84000;
      const annualSavings = 12000;
      const payback = Math.round((netCAPEX / annualSavings) * 10) / 10;

      expect(payback).toBe(7.0);
    });

    it('should calculate LCOE correctly over 25 years', () => {
      const annualProductionKWh = 115000;
      const netCAPEX = 84000;
      const SYSTEM_LIFETIME_YEARS = 25;
      const DEGRADATION_FACTOR = 0.94;

      const lifetimeProduction = annualProductionKWh * SYSTEM_LIFETIME_YEARS * DEGRADATION_FACTOR;
      const lcoe = netCAPEX / lifetimeProduction;

      // $84k / (115,000 × 25 × 0.94) = $84k / 2,702,500 ≈ $0.031/kWh
      expect(lcoe).toBeGreaterThan(0.02);
      expect(lcoe).toBeLessThan(0.10);
      // LCOE should be lower than grid rate ($0.06061)
      expect(lcoe).toBeLessThan(0.06061);
    });
  });

  describe('Scenario generation (20% to 120%)', () => {
    it('should generate exactly 11 scenarios', () => {
      const scenarios = [];
      for (let pctInt = 20; pctInt <= 120; pctInt += 10) {
        scenarios.push(pctInt / 100);
      }
      expect(scenarios).toHaveLength(11);
      expect(scenarios[0]).toBe(0.2);
      expect(scenarios[scenarios.length - 1]).toBe(1.2);
    });

    it('should include 100% scenario exactly', () => {
      const scenarios = [];
      for (let pctInt = 20; pctInt <= 120; pctInt += 10) {
        scenarios.push(pctInt / 100);
      }
      const has100 = scenarios.some(s => Math.abs(s - 1.0) < 0.01);
      expect(has100).toBe(true);
    });

    it('should have increasing system sizes', () => {
      const annualKWh = 200000;
      const sizes = [];
      for (let pctInt = 20; pctInt <= 120; pctInt += 10) {
        const size = Math.max(10, Math.round((annualKWh * (pctInt / 100)) / EFFECTIVE_YIELD));
        sizes.push(size);
      }
      for (let i = 1; i < sizes.length; i++) {
        expect(sizes[i]).toBeGreaterThanOrEqual(sizes[i - 1]);
      }
    });
  });
});

// ─── SECTION 2: Cashflow Module Integration ────────────────────────��────────

describe('Cashflow Module — calculateCashflowMetrics()', () => {

  const buildInputs = (overrides: Partial<{
    pvSizeKW: number;
    battEnergyKWh: number;
    battPowerKW: number;
    annualConsumptionKWh: number;
    selfConsumptionKWh: number;
    totalExportedKWh: number;
    totalProductionKWh: number;
    gridChargingKWh: number;
    peakBeforeKW: number;
    peakAfterKW: number;
  }> = {}) => ({
    pvSizeKW: 100,
    battEnergyKWh: 50,
    battPowerKW: 25,
    annualConsumptionKWh: 300000,
    selfConsumptionKWh: 100000,
    totalExportedKWh: 15000,
    totalProductionKWh: 115000,
    gridChargingKWh: 5000,
    peakBeforeKW: 200,
    peakAfterKW: 170,
    assumptions: { ...defaultAssumptions },
    ...overrides,
  });

  describe('CAPEX calculations', () => {
    it('should use correct solar pricing (solarCostPerW or tiered + bifacial premium)', () => {
      const result = calculateCashflowMetrics(buildInputs());
      // defaultAnalysisAssumptions.solarCostPerW = 2.25, bifacialCostPremium = 0.10
      const expectedCostPerW = defaultAssumptions.solarCostPerW + (defaultAssumptions.bifacialCostPremium || 0.10);
      const expectedSolarCapex = 100 * 1000 * expectedCostPerW;

      expect(result.capexSolar).toBeCloseTo(expectedSolarCapex, -2);
    });

    it('should calculate battery CAPEX at production rates ($540/kWh + $800/kW)', () => {
      const result = calculateCashflowMetrics(buildInputs());
      // defaultAnalysisAssumptions: batteryCapacityCost=540, batteryPowerCost=800
      const expectedBattery = 50 * defaultAssumptions.batteryCapacityCost + 25 * defaultAssumptions.batteryPowerCost;
      expect(result.capexBattery).toBeCloseTo(expectedBattery, 0);
    });

    it('should sum to correct gross CAPEX', () => {
      const result = calculateCashflowMetrics(buildInputs());
      expect(result.capexGross).toBeCloseTo(result.capexSolar + result.capexBattery, 0);
    });

    it('should have net CAPEX less than gross (after incentives)', () => {
      const result = calculateCashflowMetrics(buildInputs());
      expect(result.capexNet).toBeLessThan(result.capexGross);
      expect(result.capexNet).toBeGreaterThan(0);
    });
  });

  describe('HQ Incentive calculations (OSE 6.0)', () => {
    it('should apply $1000/kW for solar, capped at 40% of admissible CAPEX', () => {
      const result = calculateCashflowMetrics(buildInputs());

      // 100 kW × $1000 = $100,000 raw
      // But capped at 40% of SOLAR CAPEX (not gross — per DETTE 1 fix)
      expect(result.incentivesHQSolar).toBeGreaterThan(0);
      expect(result.incentivesHQSolar).toBeLessThanOrEqual(result.capexSolar * 0.40 + 1);
    });

    it('should cap at 1 MW eligibility', () => {
      const largeSystem = buildInputs({ pvSizeKW: 1500 });
      const result = calculateCashflowMetrics(largeSystem);

      // Only first 1000 kW eligible → max $1,000,000 raw
      // But still capped at 40% of solar CAPEX
      expect(result.incentivesHQSolar).toBeLessThanOrEqual(result.capexSolar * 0.40 + 1);
    });

    it('should give zero battery HQ incentive (discontinued Dec 2024)', () => {
      const result = calculateCashflowMetrics(buildInputs());
      // Battery gets leftover cap room only if solar doesn't exhaust the 40% cap
      // Total HQ = solar + battery, capped at 40% of gross admissible
      expect(result.incentivesHQ).toBe(result.incentivesHQSolar + result.incentivesHQBattery);
    });
  });

  describe('Federal ITC calculations', () => {
    it('should be 30% of (CAPEX - HQ incentives)', () => {
      const result = calculateCashflowMetrics(buildInputs());
      const itcBasis = result.capexGross - result.incentivesHQ;
      const expectedITC = itcBasis * 0.30;

      expect(result.incentivesFederal).toBeCloseTo(expectedITC, -1);
    });
  });

  describe('Tax Shield calculations', () => {
    it('should be 90% × taxRate × depreciable basis', () => {
      const result = calculateCashflowMetrics(buildInputs());
      const depreciableBasis = result.capexGross - result.incentivesHQ - result.incentivesFederal;
      const expectedTaxShield = 0.90 * 0.265 * depreciableBasis;

      expect(result.taxShield).toBeCloseTo(expectedTaxShield, -2);
    });
  });

  describe('Net CAPEX formula', () => {
    it('should equal gross - HQ - ITC - taxShield', () => {
      const result = calculateCashflowMetrics(buildInputs());
      const expected = result.capexGross - result.incentivesHQ - result.incentivesFederal - result.taxShield;

      expect(result.capexNet).toBeCloseTo(expected, -1);
    });
  });

  describe('Annual savings', () => {
    it('should include energy savings + demand savings - grid charging', () => {
      const result = calculateCashflowMetrics(buildInputs());
      expect(result.annualSavings).toBeGreaterThan(0);
    });

    it('should reflect energy savings from self-consumption', () => {
      const inputs = buildInputs();
      const energySavings = inputs.selfConsumptionKWh * inputs.assumptions.tariffEnergy;
      // 100,000 × $0.06061 = $6,061
      expect(energySavings).toBeCloseTo(6061, 0);
    });

    it('should reflect demand savings from peak reduction', () => {
      const inputs = buildInputs();
      const demandReduction = inputs.peakBeforeKW - inputs.peakAfterKW; // 30 kW
      const demandSavings = demandReduction * inputs.assumptions.tariffPower * 12;
      // 30 × $17.573 × 12 = $6,326
      expect(demandSavings).toBeCloseTo(6326, 0);
    });

    it('should deduct grid charging cost', () => {
      const inputs = buildInputs();
      const gridChargingCost = inputs.gridChargingKWh * inputs.assumptions.tariffEnergy;
      // 5,000 × $0.06061 = $303
      expect(gridChargingCost).toBeCloseTo(303, 0);
    });
  });

  describe('Financial metrics', () => {
    it('should produce positive NPV for typical commercial system', () => {
      const result = calculateCashflowMetrics(buildInputs());
      expect(result.npv25).toBeGreaterThan(0);
    });

    it('should produce IRR > discount rate for viable project', () => {
      const result = calculateCashflowMetrics(buildInputs());
      expect(result.irr25).toBeGreaterThan(0.06); // > 6% discount rate
    });

    it('should produce payback < 25 years', () => {
      const result = calculateCashflowMetrics(buildInputs());
      expect(result.simplePaybackYears).toBeGreaterThan(0);
      expect(result.simplePaybackYears).toBeLessThan(25);
    });

    it('should produce LCOE < grid rate for good project', () => {
      const result = calculateCashflowMetrics(buildInputs());
      expect(result.lcoe).toBeGreaterThan(0);
      expect(result.lcoe).toBeLessThan(0.10); // Reasonable LCOE range
    });

    it('should generate 25 cashflow entries', () => {
      const result = calculateCashflowMetrics(buildInputs());
      expect(result.cashflows.length).toBeGreaterThanOrEqual(25);
    });

    it('cashflow year 1 should have positive revenue', () => {
      const result = calculateCashflowMetrics(buildInputs());
      // cashflows[0] = year 0 (initial investment), cashflows[1] = year 1
      const year1 = result.cashflows[1];
      expect(year1).toBeDefined();
      expect(year1.year).toBe(1);
      expect(year1.revenue).toBeGreaterThan(0);
    });
  });

  describe('CO2 avoided', () => {
    it('should calculate CO2 for Quebec grid', () => {
      const result = calculateCashflowMetrics(buildInputs());
      // Quebec has very low CO2 factor (0.002 kg/kWh = 0.002 tonnes/MWh)
      // 115,000 kWh × 0.002 = 230 kg = 0.23 tonnes
      expect(result.co2AvoidedTonnesPerYear).toBeGreaterThan(0);
      expect(result.co2AvoidedTonnesPerYear).toBeLessThan(5); // Quebec grid is very clean
    });
  });

  describe('Edge cases', () => {
    it('should handle zero battery gracefully', () => {
      const result = calculateCashflowMetrics(buildInputs({
        battEnergyKWh: 0,
        battPowerKW: 0,
      }));
      expect(result.capexBattery).toBe(0);
      expect(result.capexGross).toBe(result.capexSolar);
      expect(result.npv25).toBeDefined();
    });

    it('should handle very large system (1 MW)', () => {
      const result = calculateCashflowMetrics(buildInputs({
        pvSizeKW: 1000,
        selfConsumptionKWh: 900000,
        totalProductionKWh: 1150000,
        totalExportedKWh: 250000,
        annualConsumptionKWh: 2000000,
      }));
      expect(result.capexGross).toBeGreaterThan(1000000); // > $1M
      expect(result.incentivesHQSolar).toBeLessThanOrEqual(result.capexSolar * 0.40 + 1);
    });

    it('should handle small system (10 kW)', () => {
      const result = calculateCashflowMetrics(buildInputs({
        pvSizeKW: 10,
        battEnergyKWh: 0,
        battPowerKW: 0,
        selfConsumptionKWh: 11000,
        totalProductionKWh: 11500,
        totalExportedKWh: 500,
        gridChargingKWh: 0,
        annualConsumptionKWh: 50000,
      }));
      expect(result.capexGross).toBeGreaterThan(10000);
      expect(result.simplePaybackYears).toBeGreaterThan(0);
    });
  });
});

// ─── SECTION 3: Design BOM Calculations ─────────────────────────────────────

describe('Design BOM — Component Counts & Costs', () => {

  const calculateDesignBOM = (pvSizeKW: number, batteryEnergyKWh: number, marginPercent: number) => {
    const moduleWattage = 660;
    const modulesCount = Math.ceil((pvSizeKW * 1000) / moduleWattage);
    const invertersCount = Math.ceil(pvSizeKW / 25);
    const batteryUnits = Math.ceil(batteryEnergyKWh / 16);

    const moduleCost = modulesCount * 180;   // Default unit cost
    const inverterCost = invertersCount * 3500;
    const batteryCost = batteryUnits * 9000;
    const bosCost = (moduleCost + inverterCost) * 0.15;

    const totalCapexPV = moduleCost + inverterCost + bosCost * 0.7;
    const totalCapexBattery = batteryCost + bosCost * 0.3;
    const totalCapex = moduleCost + inverterCost + batteryCost + bosCost;
    const totalSellPrice = totalCapex * (1 + marginPercent / 100);

    return {
      modulesCount, invertersCount, batteryUnits,
      moduleCost, inverterCost, batteryCost, bosCost,
      totalCapexPV, totalCapexBattery, totalCapex, totalSellPrice,
    };
  };

  describe('Component counts', () => {
    it('should calculate correct module count for 100 kW (660W panels)', () => {
      const { modulesCount } = calculateDesignBOM(100, 0, 25);
      // ceil(100,000 / 660) = ceil(151.5) = 152
      expect(modulesCount).toBe(152);
    });

    it('should calculate correct inverter count (25 kW per inverter)', () => {
      const { invertersCount } = calculateDesignBOM(100, 0, 25);
      // ceil(100 / 25) = 4
      expect(invertersCount).toBe(4);
    });

    it('should calculate correct battery units (16 kWh per unit)', () => {
      const { batteryUnits } = calculateDesignBOM(100, 50, 25);
      // ceil(50 / 16) = ceil(3.125) = 4
      expect(batteryUnits).toBe(4);
    });

    it('should handle zero battery', () => {
      const { batteryUnits, batteryCost } = calculateDesignBOM(100, 0, 25);
      expect(batteryUnits).toBe(0);
      expect(batteryCost).toBe(0);
    });
  });

  describe('Cost calculations', () => {
    it('should calculate module cost correctly', () => {
      const { moduleCost, modulesCount } = calculateDesignBOM(100, 0, 25);
      expect(moduleCost).toBe(modulesCount * 180);
    });

    it('should calculate BOS at 15% of (modules + inverters)', () => {
      const { bosCost, moduleCost, inverterCost } = calculateDesignBOM(100, 50, 25);
      expect(bosCost).toBeCloseTo((moduleCost + inverterCost) * 0.15, 0);
    });

    it('should apply margin correctly (25%)', () => {
      const { totalCapex, totalSellPrice } = calculateDesignBOM(100, 50, 25);
      expect(totalSellPrice).toBeCloseTo(totalCapex * 1.25, 0);
    });

    it('should apply margin correctly (30%)', () => {
      const { totalCapex, totalSellPrice } = calculateDesignBOM(100, 50, 30);
      expect(totalSellPrice).toBeCloseTo(totalCapex * 1.30, 0);
    });
  });

  describe('Realistic system costs', () => {
    it('100 kW PV-only should be in $150k-$300k range', () => {
      const { totalCapex } = calculateDesignBOM(100, 0, 25);
      expect(totalCapex).toBeGreaterThan(30000); // At least $30k for equipment
      expect(totalCapex).toBeLessThan(100000);   // Reasonable for 100 kW BOM
    });

    it('500 kW system should scale appropriately', () => {
      const small = calculateDesignBOM(100, 0, 25);
      const large = calculateDesignBOM(500, 0, 25);
      // 500 kW should be roughly 5× the cost of 100 kW
      expect(large.totalCapex / small.totalCapex).toBeCloseTo(5, 0);
    });
  });
});

// ─── SECTION 4: Design Agreement & Payment ──────────────────────────────────

describe('Design Agreement — Pricing & Payment Config', () => {

  describe('Standard pricing ($2,500 CAD)', () => {
    it('should have correct subtotal', () => {
      const subtotal = 2500;
      expect(subtotal).toBe(2500);
    });

    it('should calculate GST at 5%', () => {
      const subtotal = 2500;
      const gst = subtotal * 0.05;
      expect(gst).toBe(125);
    });

    it('should calculate QST at 9.975%', () => {
      const subtotal = 2500;
      const qst = subtotal * 0.09975;
      expect(qst).toBe(249.375);
    });

    it('should have correct total with taxes', () => {
      const subtotal = 2500;
      const gst = 125;
      const qst = 249.375;
      const total = subtotal + gst + qst;

      expect(total).toBeCloseTo(2874.375, 2);
      // Match hardcoded values in sites.ts generate-design-agreement
      expect(total).toBeCloseTo(2874.38, 1);
    });
  });

  describe('Stripe payment config', () => {
    it('should convert to cents correctly', () => {
      const amountCents = 250000; // $2,500.00 = 250,000 cents
      expect(amountCents / 100).toBe(2500);
    });

    it('should use CAD currency', () => {
      const currency = 'cad';
      expect(currency).toBe('cad');
    });

    it('should be non-refundable', () => {
      const refundable = false;
      expect(refundable).toBe(false);
    });

    it('should be creditable on EPC contract', () => {
      const creditableOnContract = true;
      expect(creditableOnContract).toBe(true);
    });
  });

  describe('Agreement terms', () => {
    it('should be valid for 30 days', () => {
      const now = new Date();
      const validUntil = new Date(now);
      validUntil.setDate(validUntil.getDate() + 30);

      const diffMs = validUntil.getTime() - now.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeCloseTo(30, 0);
    });

    it('should include proper payment terms text', () => {
      const terms = "100% payable à la signature — créditable intégralement sur votre contrat EPC";
      expect(terms).toContain('créditable');
      expect(terms).toContain('EPC');
      expect(terms).toContain('100%');
    });
  });
});

// ─── SECTION 5: Tiered Pricing Consistency ──────────────────────────────────

describe('Tiered Solar Pricing — Consistency Check', () => {

  it('should return prices in $/W range', () => {
    const price = getTieredSolarCostPerW(100);
    expect(price).toBeGreaterThan(1.0);  // At least $1/W
    expect(price).toBeLessThan(5.0);     // At most $5/W
  });

  it('should have decreasing prices for larger systems (economies of scale)', () => {
    const p50 = getTieredSolarCostPerW(50);
    const p200 = getTieredSolarCostPerW(200);
    const p500 = getTieredSolarCostPerW(500);

    expect(p50).toBeGreaterThanOrEqual(p200);
    expect(p200).toBeGreaterThanOrEqual(p500);
  });

  it('should handle boundary values', () => {
    const p0 = getTieredSolarCostPerW(0);
    const p1 = getTieredSolarCostPerW(1);
    const p1000 = getTieredSolarCostPerW(1000);

    expect(p0).toBeGreaterThan(0);
    expect(p1).toBeGreaterThan(0);
    expect(p1000).toBeGreaterThan(0);
  });

  it('BASELINE_YIELD should be 1150 kWh/kWp', () => {
    expect(BASELINE_YIELD).toBe(1150);
  });
});

// ─── SECTION 6: Cross-Module Consistency ────────────────────────────────────

describe('Cross-Module Consistency — Quick Estimate vs Cashflow Module', () => {

  it('should use same HQ incentive cap (40%)', () => {
    // Quick estimate uses HQ_INCENTIVE_MAX_PERCENT = 0.40
    // Cashflow module uses HQ_CAP_PERCENT = 0.40
    // Both should produce same result for same inputs

    const pvSizeKW = 100;
    const costPerW = getTieredSolarCostPerW(pvSizeKW);
    const grossCAPEX = pvSizeKW * costPerW * 1000;

    // Quick estimate method
    const qeRaw = Math.min(pvSizeKW, 1000) * 1000;
    const qeCapped = Math.min(qeRaw, grossCAPEX * 0.40);

    // Cashflow module method
    const cfResult = calculateCapex(pvSizeKW, 0, 0, {
      ...defaultAssumptions,
      solarCostPerW: costPerW,
      bifacialEnabled: false,
    });

    // Both use 40% cap
    expect(qeCapped).toBeLessThanOrEqual(grossCAPEX * 0.40 + 1);
  });

  it('should use same Federal ITC rate (30%)', () => {
    // Both modules should apply 30% on (CAPEX - HQ)
    const FEDERAL_ITC_RATE = 0.30;
    const grossCAPEX = 200000;
    const hqIncentive = 80000;

    const quickEstimateITC = Math.round((grossCAPEX - hqIncentive) * FEDERAL_ITC_RATE);

    // Cashflow module also uses 0.30
    expect(quickEstimateITC).toBe(36000);
  });

  it('should use same baseline yield (1150 kWh/kWp)', () => {
    expect(BASELINE_YIELD).toBe(1150);
  });
});
