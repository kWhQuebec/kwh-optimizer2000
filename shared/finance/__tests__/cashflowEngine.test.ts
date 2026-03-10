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
  describe("HQ incentive $1000/kW", () => {
    it("calculates $1000/kW for a 100 kW system", () => {
      const model = buildCashflowModel(makeInputs());
      expect(model.hqIncentive).toBe(86000);
    });

    it("uses full $1000/kW when 40% cap does NOT bind", () => {
      const model = buildCashflowModel(makeInputs({ kwhCostPerWatt: 3.0 }));
      expect(model.grossCapex).toBe(300000);
      expect(model.hqIncentive).toBe(100000);
    });

    it("caps at 40% of CAPEX for small high-cost systems", () => {
      const model = buildCashflowModel(makeInputs({ systemSizeKW: 50 }));
      expect(model.hqIncentive).toBe(43000);
    });

    it("caps eligible kW at 1 MW (1000 kW)", () => {
      const model = buildCashflowModel(
        makeInputs({ systemSizeKW: 2000, kwhCostPerWatt: 1.85 })
      );
      expect(model.hqIncentive).toBe(1000000);
    });

    it("applies 40% cap even above 1 MW when CAPEX is low", () => {
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

  describe("ITC 30% federal", () => {
    it("applies 30% to net-after-HQ, not gross CAPEX", () => {
      const model = buildCashflowModel(makeInputs());
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
      expect(model.netClientInvestment).toBe(90300);
    });

    it("ITC reduces total client investment by ~30% of post-HQ cost", () => {
      const model = buildCashflowModel(makeInputs({ kwhCostPerWatt: 3.0 }));
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

  describe("25-year NPV projection", () => {
    it("produces exactly 25 yearly cashflows for all scenarios", () => {
      const model = buildCashflowModel(makeInputs());
      expect(model.cash.yearlyCashflows).toHaveLength(25);
      expect(model.lease.yearlyCashflows).toHaveLength(25);
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
      expect(cfs[0].production).toBe(Math.round(115000));
      const expectedY25 = 115000 * Math.pow(1 - 0.005, 24);
      expect(cfs[24].production).toBeCloseTo(expectedY25, -1);
    });

    it("grid rate inflates at kwhInflation each year", () => {
      const model = buildCashflowModel(makeInputs());
      const cfs = model.cash.yearlyCashflows;
      expect(cfs[0].gridRate).toBeCloseTo(0.07, 4);
      expect(cfs[1].gridRate).toBeCloseTo(0.07 * 1.035, 4);
      expect(cfs[24].gridRate).toBeCloseTo(0.07 * Math.pow(1.035, 24), 4);
    });

    it("gridSavings ≈ production × gridRate each year (rounding tolerance)", () => {
      const model = buildCashflowModel(makeInputs());
      for (const cf of model.cash.yearlyCashflows) {
        const expected = cf.production * cf.gridRate;
        const relError = Math.abs(cf.gridSavings - expected) / expected;
        expect(relError).toBeLessThan(0.001);
      }
    });

    it("O&M escalates each year from base", () => {
      const model = buildCashflowModel(makeInputs());
      const cfs = model.cash.yearlyCashflows;
      const baseOM = 215000 * 0.01;
      expect(cfs[0].omCost).toBeCloseTo(baseOM, 2);
      expect(cfs[1].omCost).toBeCloseTo(baseOM * 1.025, 2);
      expect(cfs[24].omCost).toBeCloseTo(baseOM * Math.pow(1.025, 24), 0);
    });

    it("avgAnnualSavings is correct for cash scenario", () => {
      const model = buildCashflowModel(makeInputs());
      const expected =
        (model.cash.totalSavings + model.netClientInvestment) / 25;
      expect(model.cash.avgAnnualSavings).toBeCloseTo(expected, 2);
    });

    it("avgAnnualSavings is correct for lease scenario", () => {
      const model = buildCashflowModel(makeInputs());
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
      expect(model.cash.totalSavings).toBeGreaterThan(0);
      const totalCash = model.cash.yearlyCashflows.reduce(
        (sum, cf) => sum + cf.netCashflow,
        0
      );
      expect(totalCash).toBeGreaterThan(model.netClientInvestment);
    });
  });

  describe("CCA tax shield", () => {
    it("applies half-year rule in year 1 (effective rate = ccaRate/2)", () => {
      const model = buildCashflowModel(makeInputs());
      const ucc = model.netClientInvestment;
      const expectedCCA = Math.round(ucc * 0.25 * 0.265 * 100) / 100;
      expect(model.cash.yearlyCashflows[0].ccaBenefit).toBeCloseTo(
        expectedCCA,
        2
      );
    });

    it("applies full CCA rate from year 2 onward", () => {
      const model = buildCashflowModel(makeInputs());
      const ucc = model.netClientInvestment;
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
      expect(firstFreeYear.netCashflow).toBeGreaterThan(
        lastLeaseYear.netCashflow
      );
    });
  });

  describe("edge cases — negative cashflow", () => {
    it("never reaches payback when costs exceed savings (cash)", () => {
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
          omRate: 0.05,
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
      for (let i = 0; i < 7; i++) {
        expect(model.lease.yearlyCashflows[i].netCashflow).toBeLessThan(0);
      }
    });
  });
});
