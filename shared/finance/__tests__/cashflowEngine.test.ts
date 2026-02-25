import { describe, it, expect } from "vitest";
import {
  buildCashflowModel,
  CashflowInputs,
  DEFAULT_CASHFLOW_INPUTS,
} from "../cashflowEngine";

function makeInputs(overrides: Partial<CashflowInputs> = {}): CashflowInputs {
  return {
    systemSizeKW: 100,
    annualProductionKWh: 115000,
    kwhCostPerWatt: 2.15,
    gridRateY1: 0.07,
    ...DEFAULT_CASHFLOW_INPUTS,
    ...overrides,
  } as CashflowInputs;
}

describe("buildCashflowModel", () => {
  // ─────────────────────────────────────────────────────────
  // HQ Incentive $1000/kW — all cap scenarios
  // ─────────────────────────────────────────────────────────
  describe("HQ incentive $1000/kW", () => {
    it("calculates $1000/kW for a 100 kW system", () => {
      const model = buildCashflowModel(makeInputs());
      // Potential: 100 * $1000 = $100,000
      // 40% cap: $215,000 * 0.4 = $86,000 — cap binds
      expect(model.hqIncentive).toBe(86000);
    });

    it("uses full $1000/kW when 40% cap does NOT bind", () => {
      // At $3/W: CAPEX = $300,000, 40% = $120,000 > $100,000
      const model = buildCashflowModel(makeInputs({ kwhCostPerWatt: 3.0 }));
      expect(model.grossCapex).toBe(300000);
      expect(model.hqIncentive).toBe(100000); // Full $1000/kW, no cap
    });

    it("caps at 40% of CAPEX for small high-cost systems", () => {
      const model = buildCashflowModel(makeInputs({ systemSizeKW: 50 }));
      const grossCapex = 50 * 1000 * 2.15; // $107,500
      // Potential: 50 * 1000 = $50,000
      // 40% cap: $107,500 * 0.4 = $43,000 — cap binds
      expect(model.hqIncentive).toBe(43000);
    });

    it("caps eligible kW at 1 MW (1000 kW)", () => {
      const model = buildCashflowModel(
        makeInputs({ systemSizeKW: 2000, kwhCostPerWatt: 1.85 })
      );
      // Eligible: min(2000, 1000) = 1000 kW
      // Potential: 1000 * $1000 = $1,000,000
      // CAPEX: 2000 * 1000 * 1.85 = $3,700,000 → 40% = $1,480,000
      // min($1M, $1.48M) = $1,000,000
      expect(model.hqIncentive).toBe(1000000);
    });

    it("applies 40% cap even above 1 MW when CAPEX is low", () => {
      // 1500 kW @ $1.50/W → CAPEX = $2,250,000
      // Eligible: 1000 kW → potential = $1,000,000
      // 40% cap: $900,000 — cap binds
      const model = buildCashflowModel(
        makeInputs({ systemSizeKW: 1500, kwhCostPerWatt: 1.5 })
      );
      expect(model.hqIncentive).toBe(900000);
    });

    it("returns 0 incentive for 0 kW system", () => {
      const model = buildCashflowModel(
        makeInputs({ systemSizeKW: 0, annualProductionKWh: 0 })
      );
      expect(model.hqIncentive).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────
  // ITC 30% federal — precise math
  // ─────────────────────────────────────────────────────────
  describe("ITC 30% federal", () => {
    it("applies 30% to net-after-HQ, not gross CAPEX", () => {
      const model = buildCashflowModel(makeInputs());
      // CAPEX $215,000 − HQ $86,000 = $129,000
      // ITC = $129,000 × 0.30 = $38,700
      expect(model.netAfterHQ).toBe(129000);
      expect(model.itc).toBe(38700);
    });

    it("ITC is exactly 30% of net-after-HQ for various sizes", () => {
      for (const size of [25, 50, 200, 500]) {
        const model = buildCashflowModel(
          makeInputs({ systemSizeKW: size, annualProductionKWh: size * 1150 })
        );
        expect(model.itc).toBeCloseTo(model.netAfterHQ * 0.3, 2);
      }
    });

    it("netClientInvestment = netAfterHQ − ITC", () => {
      const model = buildCashflowModel(makeInputs());
      // $129,000 − $38,700 = $90,300
      expect(model.netClientInvestment).toBe(90300);
    });

    it("ITC reduces total client investment by ~30% of post-HQ cost", () => {
      const model = buildCashflowModel(makeInputs({ kwhCostPerWatt: 3.0 }));
      // CAPEX $300,000, HQ $100,000 (full, no cap), netAfterHQ $200,000
      // ITC = $60,000, netInvestment = $140,000
      expect(model.itc).toBe(60000);
      expect(model.netClientInvestment).toBe(140000);
    });

    it("ITC is 0 when system size is 0", () => {
      const model = buildCashflowModel(
        makeInputs({ systemSizeKW: 0, annualProductionKWh: 0 })
      );
      expect(model.itc).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────
  // NPV / 25-year cashflow projection
  // ─────────────────────────────────────────────────────────
  describe("25-year NPV projection", () => {
    it("produces exactly 25 yearly cashflows for all scenarios", () => {
      const model = buildCashflowModel(makeInputs());
      expect(model.cash.yearlyCashflows).toHaveLength(25);
      expect(model.lease.yearlyCashflows).toHaveLength(25);
      expect(model.ppa.yearlyCashflows).toHaveLength(25);
    });

    it("year numbers go from 1 to 25", () => {
      const model = buildCashflowModel(makeInputs());
      const years = model.cash.yearlyCashflows.map((cf) => cf.year);
      expect(years).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
    });

    it("totalSavings equals final year cumulative (cash)", () => {
      const model = buildCashflowModel(makeInputs());
      const lastYear = model.cash.yearlyCashflows[24];
      expect(model.cash.totalSavings).toBe(lastYear.cumulative);
    });

    it("totalSavings equals final year cumulative (lease)", () => {
      const model = buildCashflowModel(makeInputs());
      const lastYear = model.lease.yearlyCashflows[24];
      expect(model.lease.totalSavings).toBe(lastYear.cumulative);
    });

    it("totalSavings equals final year cumulative (PPA)", () => {
      const model = buildCashflowModel(makeInputs());
      const lastYear = model.ppa.yearlyCashflows[24];
      expect(model.ppa.totalSavings).toBe(lastYear.cumulative);
    });

    it("cumulative is running sum of netCashflow (cash)", () => {
      const model = buildCashflowModel(makeInputs());
      const cfs = model.cash.yearlyCashflows;
      let expected = -model.netClientInvestment;
      for (const cf of cfs) {
        expected = Math.round((expected + cf.netCashflow) * 100) / 100;
        expect(cf.cumulative).toBeCloseTo(expected, 1);
      }
    });

    it("cumulative is running sum of netCashflow (lease, starts at 0)", () => {
      const model = buildCashflowModel(makeInputs());
      const cfs = model.lease.yearlyCashflows;
      let expected = 0;
      for (const cf of cfs) {
        expected = Math.round((expected + cf.netCashflow) * 100) / 100;
        expect(cf.cumulative).toBeCloseTo(expected, 1);
      }
    });

    it("production degrades correctly over 25 years", () => {
      const inputs = makeInputs({ degradation: 0.005 });
      const model = buildCashflowModel(inputs);
      const cfs = model.cash.yearlyCashflows;
      // Year 1: no degradation, Year 25: (1-0.005)^24
      expect(cfs[0].production).toBe(Math.round(115000));
      const expectedY25 = 115000 * Math.pow(1 - 0.005, 24);
      expect(cfs[24].production).toBeCloseTo(expectedY25, -1);
    });

    it("grid rate inflates at kwhInflation each year", () => {
      const model = buildCashflowModel(makeInputs());
      const cfs = model.cash.yearlyCashflows;
      // Year 1: 0.07, Year 2: 0.07 * 1.035
      expect(cfs[0].gridRate).toBeCloseTo(0.07, 4);
      expect(cfs[1].gridRate).toBeCloseTo(0.07 * 1.035, 4);
      expect(cfs[24].gridRate).toBeCloseTo(0.07 * Math.pow(1.035, 24), 4);
    });

    it("gridSavings ≈ production × gridRate each year (rounding tolerance)", () => {
      const model = buildCashflowModel(makeInputs());
      for (const cf of model.cash.yearlyCashflows) {
        // production and gridRate are stored rounded; gridSavings is computed
        // from unrounded values, so we allow <0.1% relative error
        const expected = cf.production * cf.gridRate;
        const relError = Math.abs(cf.gridSavings - expected) / expected;
        expect(relError).toBeLessThan(0.001);
      }
    });

    it("O&M escalates each year from base", () => {
      const model = buildCashflowModel(makeInputs());
      const cfs = model.cash.yearlyCashflows;
      const baseOM = 215000 * 0.01; // $2,150
      expect(cfs[0].omCost).toBeCloseTo(baseOM, 2);
      expect(cfs[1].omCost).toBeCloseTo(baseOM * 1.025, 2);
      expect(cfs[24].omCost).toBeCloseTo(baseOM * Math.pow(1.025, 24), 0);
    });

    it("avgAnnualSavings is correct for cash scenario", () => {
      const model = buildCashflowModel(makeInputs());
      // Formula: (cumulative + investment) / 25
      const expected =
        (model.cash.totalSavings + model.netClientInvestment) / 25;
      expect(model.cash.avgAnnualSavings).toBeCloseTo(expected, 2);
    });

    it("avgAnnualSavings is correct for lease scenario", () => {
      const model = buildCashflowModel(makeInputs());
      // Lease: totalSavings / 25
      expect(model.lease.avgAnnualSavings).toBeCloseTo(
        model.lease.totalSavings / 25,
        2
      );
    });

    it("cash 25-year totalSavings is positive for standard system", () => {
      const model = buildCashflowModel(makeInputs());
      expect(model.cash.totalSavings).toBeGreaterThan(0);
    });

    it("cash savings exceed initial investment over 25 years", () => {
      const model = buildCashflowModel(makeInputs());
      // totalSavings = final cumulative, which started at -investment
      // So total NET benefit = totalSavings (already accounts for investment)
      expect(model.cash.totalSavings).toBeGreaterThan(0);
      // Sum of all netCashflows should exceed investment
      const totalCash = model.cash.yearlyCashflows.reduce(
        (sum, cf) => sum + cf.netCashflow,
        0
      );
      expect(totalCash).toBeGreaterThan(model.netClientInvestment);
    });
  });

  // ─────────────────────────────────────────────────────────
  // CCA tax shield (cash scenario)
  // ─────────────────────────────────────────────────────────
  describe("CCA tax shield", () => {
    it("applies half-year rule in year 1 (effective rate = ccaRate/2)", () => {
      const model = buildCashflowModel(makeInputs());
      const ucc = model.netClientInvestment; // $90,300
      // Year 1: ccaEffective = 0.50 * 0.50 = 0.25
      const expectedCCA = Math.round(ucc * 0.25 * 0.265 * 100) / 100;
      expect(model.cash.yearlyCashflows[0].ccaBenefit).toBeCloseTo(
        expectedCCA,
        2
      );
    });

    it("applies full CCA rate from year 2 onward", () => {
      const model = buildCashflowModel(makeInputs());
      const ucc = model.netClientInvestment;
      // After year 1: ucc = 90300 - (90300 * 0.25) = 67725
      const uccY2 = ucc - ucc * 0.25;
      const expectedY2CCA = Math.round(uccY2 * 0.5 * 0.265 * 100) / 100;
      expect(model.cash.yearlyCashflows[1].ccaBenefit).toBeCloseTo(
        expectedY2CCA,
        2
      );
    });

    it("CCA benefit decreases each year as UCC depletes", () => {
      const model = buildCashflowModel(makeInputs());
      const cfs = model.cash.yearlyCashflows;
      // After year 1, CCA should decrease monotonically (until both round to 0)
      for (let i = 2; i < 25; i++) {
        expect(cfs[i].ccaBenefit!).toBeLessThanOrEqual(cfs[i - 1].ccaBenefit!);
      }
    });

    it("CCA benefit is 0 when taxRate is 0", () => {
      const model = buildCashflowModel(makeInputs({ taxRate: 0 }));
      for (const cf of model.cash.yearlyCashflows) {
        expect(cf.ccaBenefit).toBe(0);
      }
    });
  });

  // ─────────────────────────────────────────────────────────
  // Cash scenario — payback
  // ─────────────────────────────────────────────────────────
  describe("cash scenario payback", () => {
    it("starts with negative cumulative (investment deducted)", () => {
      const model = buildCashflowModel(makeInputs());
      expect(model.cash.yearlyCashflows[0].cumulative).toBeLessThan(0);
    });

    it("finds payback year where cumulative crosses zero", () => {
      const model = buildCashflowModel(makeInputs());
      expect(model.cash.paybackYear).not.toBeNull();
      if (model.cash.paybackYear) {
        const year = model.cash.paybackYear;
        const prev = model.cash.yearlyCashflows[year - 2];
        const curr = model.cash.yearlyCashflows[year - 1];
        expect(prev.cumulative).toBeLessThan(0);
        expect(curr.cumulative).toBeGreaterThanOrEqual(0);
      }
    });

    it("has ownership from year 1", () => {
      const model = buildCashflowModel(makeInputs());
      expect(model.cash.ownershipYear).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────
  // Lease scenario
  // ─────────────────────────────────────────────────────────
  describe("lease scenario", () => {
    it("has zero initial investment", () => {
      const model = buildCashflowModel(makeInputs());
      expect(model.lease.investment).toBe(0);
    });

    it("lease payment = netInvestment / term × (1 + premium)", () => {
      const model = buildCashflowModel(makeInputs());
      const expected =
        Math.round(((90300 / 7) * 1.15) * 100) / 100;
      expect(model.lease.yearlyCashflows[0].leasePayment).toBeCloseTo(
        expected,
        0
      );
    });

    it("has lease payments only during lease term", () => {
      const model = buildCashflowModel(makeInputs({ leaseTerm: 7 }));
      for (let i = 0; i < 7; i++) {
        expect(model.lease.yearlyCashflows[i].leasePayment).toBeGreaterThan(0);
      }
      for (let i = 7; i < 25; i++) {
        expect(model.lease.yearlyCashflows[i].leasePayment).toBe(0);
      }
    });

    it("ownership year is leaseTerm + 1", () => {
      const model = buildCashflowModel(makeInputs({ leaseTerm: 7 }));
      expect(model.lease.ownershipYear).toBe(8);
    });

    it("post-lease years have higher net cashflow (no lease payment)", () => {
      const model = buildCashflowModel(makeInputs({ leaseTerm: 7 }));
      const lastLeaseYear = model.lease.yearlyCashflows[6];
      const firstFreeYear = model.lease.yearlyCashflows[7];
      // Net cashflow jumps when lease payments stop
      expect(firstFreeYear.netCashflow).toBeGreaterThan(
        lastLeaseYear.netCashflow
      );
    });
  });

  // ─────────────────────────────────────────────────────────
  // PPA scenario
  // ─────────────────────────────────────────────────────────
  describe("PPA scenario", () => {
    it("has zero initial investment", () => {
      const model = buildCashflowModel(makeInputs());
      expect(model.ppa.investment).toBe(0);
    });

    it("PPA payment during term uses discounted TRC rate", () => {
      const model = buildCashflowModel(makeInputs());
      const cf1 = model.ppa.yearlyCashflows[0];
      // Year 1 TRC rate: gridRateY1 × (1 + trcInflation)^0 × (1 - ppaDiscount)
      // = 0.07 × 1 × 0.60 = 0.042
      const expectedPayment = Math.round(115000 * 0.042 * 100) / 100;
      expect(cf1.ppaPayment).toBeCloseTo(expectedPayment, 0);
    });

    it("post-PPA years use O&M at ppaOmRate of solar value", () => {
      const model = buildCashflowModel(makeInputs({ ppaTerm: 16 }));
      const cfPostPPA = model.ppa.yearlyCashflows[16]; // Year 17
      // Solar value = production × gridRate
      const solarValue = cfPostPPA.production * cfPostPPA.gridRate;
      const expectedPayment = Math.round(solarValue * 0.07 * 100) / 100;
      expect(cfPostPPA.ppaPayment).toBeCloseTo(expectedPayment, 0);
    });

    it("ownership year is ppaTerm + 1", () => {
      const model = buildCashflowModel(makeInputs({ ppaTerm: 16 }));
      expect(model.ppa.ownershipYear).toBe(17);
    });

    it("positive cumulative savings over 25 years", () => {
      const model = buildCashflowModel(makeInputs());
      expect(model.ppa.totalSavings).toBeGreaterThan(0);
    });

    it("foregoneIncentives = HQ + ITC + CCA shield estimate", () => {
      const model = buildCashflowModel(makeInputs());
      const clientCCAShield = Math.round(model.netClientInvestment * 0.26 * 100) / 100;
      const expected = Math.round((model.hqIncentive + model.itc + clientCCAShield) * 100) / 100;
      expect(model.foregoneIncentives).toBeCloseTo(expected, 0);
    });
  });

  // ─────────────────────────────────────────────────────────
  // Provider economics
  // ─────────────────────────────────────────────────────────
  describe("provider economics", () => {
    it("uses grossCapex when no trcProjectCost provided", () => {
      const model = buildCashflowModel(makeInputs());
      expect(model.providerEconomics.grossCost).toBe(model.grossCapex);
    });

    it("uses trcProjectCost when provided", () => {
      const model = buildCashflowModel(makeInputs({ trcProjectCost: 180000 }));
      expect(model.providerEconomics.grossCost).toBe(180000);
    });

    it("calculates provider HQ incentive with 1MW and 40% caps", () => {
      const model = buildCashflowModel(makeInputs());
      expect(model.providerEconomics.hqIncentive).toBeGreaterThan(0);
      expect(model.providerEconomics.hqIncentive).toBeLessThanOrEqual(
        model.providerEconomics.grossCost * 0.4
      );
    });

    it("provider ITC is 30% of net-after-HQ", () => {
      const model = buildCashflowModel(makeInputs());
      const netAfterHQ =
        model.providerEconomics.grossCost -
        model.providerEconomics.hqIncentive;
      expect(model.providerEconomics.itc).toBeCloseTo(netAfterHQ * 0.3, 0);
    });

    it("actual investment is non-negative", () => {
      const model = buildCashflowModel(makeInputs());
      expect(model.providerEconomics.actualInvestment).toBeGreaterThanOrEqual(
        0
      );
    });

    it("totalIncentives = HQ + ITC + CCA shield", () => {
      const model = buildCashflowModel(makeInputs());
      const pe = model.providerEconomics;
      expect(pe.totalIncentives).toBeCloseTo(
        pe.hqIncentive + pe.itc + pe.ccaShield,
        2
      );
    });
  });

  // ─────────────────────────────────────────────────────────
  // Edge cases — negative cashflow
  // ─────────────────────────────────────────────────────────
  describe("edge cases — negative cashflow", () => {
    it("never reaches payback when costs exceed savings (cash)", () => {
      // Very poor site: low production, high cost, low grid rate, no tax benefit
      const model = buildCashflowModel(
        makeInputs({
          systemSizeKW: 10,
          annualProductionKWh: 3000,
          kwhCostPerWatt: 5.0,
          gridRateY1: 0.03,
          taxRate: 0,
          omRate: 0.02,
        })
      );
      // Grid savings Y1: 3000 × $0.03 = $90
      // O&M Y1: $50,000 × 0.02 = $1,000
      // Net = $90 − $1,000 = −$910/year → never pays back
      expect(model.cash.paybackYear).toBeNull();
    });

    it("has negative totalSavings when project is unviable (cash)", () => {
      const model = buildCashflowModel(
        makeInputs({
          systemSizeKW: 10,
          annualProductionKWh: 3000,
          kwhCostPerWatt: 5.0,
          gridRateY1: 0.03,
          taxRate: 0,
          omRate: 0.02,
        })
      );
      expect(model.cash.totalSavings).toBeLessThan(0);
    });

    it("cumulative stays negative all 25 years when unviable", () => {
      const model = buildCashflowModel(
        makeInputs({
          systemSizeKW: 10,
          annualProductionKWh: 3000,
          kwhCostPerWatt: 5.0,
          gridRateY1: 0.03,
          taxRate: 0,
          omRate: 0.02,
        })
      );
      for (const cf of model.cash.yearlyCashflows) {
        expect(cf.cumulative).toBeLessThan(0);
      }
    });

    it("net cashflow is negative every year when O&M dwarfs savings", () => {
      const model = buildCashflowModel(
        makeInputs({
          systemSizeKW: 10,
          annualProductionKWh: 3000,
          kwhCostPerWatt: 5.0,
          gridRateY1: 0.03,
          taxRate: 0,
          omRate: 0.05, // 5% O&M = $2,500/yr vs $90 savings
        })
      );
      for (const cf of model.cash.yearlyCashflows) {
        expect(cf.netCashflow).toBeLessThan(0);
      }
    });

    it("lease has negative net cashflow during term when savings < payment", () => {
      const model = buildCashflowModel(
        makeInputs({
          systemSizeKW: 10,
          annualProductionKWh: 3000,
          kwhCostPerWatt: 5.0,
          gridRateY1: 0.03,
          taxRate: 0,
          omRate: 0.02,
        })
      );
      // Lease payments + O&M far exceed grid savings
      for (let i = 0; i < 7; i++) {
        expect(model.lease.yearlyCashflows[i].netCashflow).toBeLessThan(0);
      }
    });

    it("PPA still generates some savings even for poor sites", () => {
      // PPA has $0 investment, client only pays discounted rate
      // Net = gridSavings - ppaPayment = production × (gridRate - discountedRate)
      // This is always positive if gridRate > discountedRate
      const model = buildCashflowModel(
        makeInputs({
          systemSizeKW: 10,
          annualProductionKWh: 3000,
          kwhCostPerWatt: 5.0,
          gridRateY1: 0.03,
          taxRate: 0,
        })
      );
      // PPA year 1 net = production × gridRate × ppaDiscount
      // = 3000 × 0.03 × 0.40 = $36 (small but positive)
      expect(model.ppa.yearlyCashflows[0].netCashflow).toBeGreaterThan(0);
    });
  });

  // ─────────────────────────────────────────────────────────
  // Edge cases — boundary conditions
  // ─────────────────────────────────────────────────────────
  describe("edge cases — boundary conditions", () => {
    it("handles zero system size", () => {
      const model = buildCashflowModel(
        makeInputs({ systemSizeKW: 0, annualProductionKWh: 0 })
      );
      expect(model.grossCapex).toBe(0);
      expect(model.hqIncentive).toBe(0);
      expect(model.itc).toBe(0);
      expect(model.netClientInvestment).toBe(0);
      expect(model.cash.yearlyCashflows).toHaveLength(25);
    });

    it("handles very large system (5MW) with 1MW HQ cap", () => {
      const model = buildCashflowModel(
        makeInputs({
          systemSizeKW: 5000,
          annualProductionKWh: 5750000,
          kwhCostPerWatt: 1.7,
        })
      );
      // HQ capped at 1MW eligible: min(1000 × $1000, CAPEX × 0.4)
      // CAPEX = $8,500,000, 40% = $3,400,000 > $1,000,000
      expect(model.hqIncentive).toBe(1000000);
      expect(model.cash.yearlyCashflows).toHaveLength(25);
    });

    it("handles exactly 1 MW system (boundary of HQ cap)", () => {
      const model = buildCashflowModel(
        makeInputs({
          systemSizeKW: 1000,
          annualProductionKWh: 1150000,
          kwhCostPerWatt: 2.15,
        })
      );
      // Eligible: min(1000, 1000) = 1000 kW
      // Potential: $1,000,000
      // CAPEX: $2,150,000, 40% = $860,000 — cap binds
      expect(model.hqIncentive).toBe(860000);
    });

    it("handles zero degradation (production constant)", () => {
      const model = buildCashflowModel(makeInputs({ degradation: 0 }));
      const y1Prod = model.cash.yearlyCashflows[0].production;
      const y25Prod = model.cash.yearlyCashflows[24].production;
      expect(y25Prod).toBe(y1Prod);
    });

    it("handles zero inflation (grid rate constant)", () => {
      const model = buildCashflowModel(makeInputs({ kwhInflation: 0 }));
      const y1Rate = model.cash.yearlyCashflows[0].gridRate;
      const y25Rate = model.cash.yearlyCashflows[24].gridRate;
      expect(y25Rate).toBeCloseTo(y1Rate, 4);
    });

    it("handles very high grid rate (fast payback)", () => {
      const model = buildCashflowModel(makeInputs({ gridRateY1: 0.30 }));
      // GridSavings Y1 ≈ 115,000 × $0.30 = $34,500 vs $90,300 investment
      expect(model.cash.paybackYear).not.toBeNull();
      expect(model.cash.paybackYear!).toBeLessThanOrEqual(5);
    });

    it("handles zero O&M rate", () => {
      const model = buildCashflowModel(makeInputs({ omRate: 0 }));
      for (const cf of model.cash.yearlyCashflows) {
        expect(cf.omCost).toBe(0);
      }
    });
  });
});
