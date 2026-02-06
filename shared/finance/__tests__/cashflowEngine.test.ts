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
  describe("base value calculations", () => {
    it("calculates grossCapex correctly", () => {
      const model = buildCashflowModel(makeInputs());
      // 100 kW * 1000 W/kW * $2.15/W = $215,000
      expect(model.grossCapex).toBe(215000);
    });

    it("calculates HQ incentive at $1000/kW", () => {
      const model = buildCashflowModel(makeInputs());
      // 100 kW * $1000/kW = $100,000
      // But capped at 40% of $215,000 = $86,000
      expect(model.hqIncentive).toBe(86000);
    });

    it("caps HQ incentive at 40% of CAPEX", () => {
      const model = buildCashflowModel(makeInputs({ systemSizeKW: 50 }));
      const grossCapex = 50 * 1000 * 2.15; // $107,500
      const potential = 50 * 1000; // $50,000
      const cap = grossCapex * 0.4; // $43,000
      // $50,000 > $43,000 cap, so capped
      expect(model.hqIncentive).toBe(43000);
    });

    it("caps HQ incentive at 1MW eligible", () => {
      const model = buildCashflowModel(
        makeInputs({ systemSizeKW: 2000, kwhCostPerWatt: 1.85 })
      );
      // Eligible: min(2000, 1000) = 1000 kW
      // Potential: 1000 * $1000 = $1,000,000
      // Gross CAPEX: 2000 * 1000 * 1.85 = $3,700,000
      // 40% cap: $1,480,000
      // HQ incentive = min($1,000,000, $1,480,000) = $1,000,000
      expect(model.hqIncentive).toBe(1000000);
    });

    it("calculates federal ITC at 30% of net-after-HQ", () => {
      const model = buildCashflowModel(makeInputs());
      const expectedNetAfterHQ = model.grossCapex - model.hqIncentive;
      expect(model.netAfterHQ).toBe(expectedNetAfterHQ);
      expect(model.itc).toBeCloseTo(expectedNetAfterHQ * 0.3, 0);
    });

    it("calculates netClientInvestment correctly", () => {
      const model = buildCashflowModel(makeInputs());
      expect(model.netClientInvestment).toBeCloseTo(
        model.netAfterHQ - model.itc,
        0
      );
    });
  });

  describe("cash scenario", () => {
    it("has 25 yearly cashflows", () => {
      const model = buildCashflowModel(makeInputs());
      expect(model.cash.yearlyCashflows).toHaveLength(25);
    });

    it("starts with negative cumulative (investment)", () => {
      const model = buildCashflowModel(makeInputs());
      // Year 1 cumulative = -investment + year 1 net cash
      expect(model.cash.yearlyCashflows[0].cumulative).toBeLessThan(0);
    });

    it("applies degradation to production each year", () => {
      const model = buildCashflowModel(makeInputs({ degradation: 0.005 }));
      const year1 = model.cash.yearlyCashflows[0].production;
      const year2 = model.cash.yearlyCashflows[1].production;
      expect(year2).toBeLessThan(year1);
      // Degradation: 0.5% per year
      expect(year2).toBeCloseTo(year1 * (1 - 0.005), -1);
    });

    it("includes CCA benefit in cashflows", () => {
      const model = buildCashflowModel(makeInputs());
      const year1 = model.cash.yearlyCashflows[0];
      expect(year1.ccaBenefit).toBeDefined();
      expect(year1.ccaBenefit!).toBeGreaterThan(0);
    });

    it("applies half-year CCA rule in year 1", () => {
      const model = buildCashflowModel(makeInputs());
      const year1CCA = model.cash.yearlyCashflows[0].ccaBenefit!;
      const year2CCA = model.cash.yearlyCashflows[1].ccaBenefit!;
      // Year 1 has half-year rule, so CCA should be roughly half of year 2's
      // UCC depletes, but the rate is 25% (50%*50%) vs 50%, so year1 < year2
      expect(year1CCA).toBeLessThan(year2CCA);
    });

    it("finds correct payback year", () => {
      const model = buildCashflowModel(makeInputs());
      expect(model.cash.paybackYear).not.toBeNull();
      if (model.cash.paybackYear) {
        const year = model.cash.paybackYear;
        const prev = model.cash.yearlyCashflows[year - 2]; // year before payback
        const curr = model.cash.yearlyCashflows[year - 1]; // payback year
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

    it("has lease payments only during lease term", () => {
      const model = buildCashflowModel(makeInputs({ leaseTerm: 7 }));
      // Years 1-7 should have lease payments
      for (let i = 0; i < 7; i++) {
        expect(model.lease.yearlyCashflows[i].leasePayment).toBeGreaterThan(0);
      }
      // Years 8+ should have zero lease payment
      for (let i = 7; i < 25; i++) {
        expect(model.lease.yearlyCashflows[i].leasePayment).toBe(0);
      }
    });

    it("ownership year is leaseTerm + 1", () => {
      const model = buildCashflowModel(makeInputs({ leaseTerm: 7 }));
      expect(model.lease.ownershipYear).toBe(8);
    });
  });

  describe("PPA scenario", () => {
    it("has zero initial investment", () => {
      const model = buildCashflowModel(makeInputs());
      expect(model.ppa.investment).toBe(0);
    });

    it("has PPA payments during PPA term", () => {
      const model = buildCashflowModel(makeInputs({ ppaTerm: 16 }));
      for (let i = 0; i < 16; i++) {
        expect(
          model.ppa.yearlyCashflows[i].ppaPayment
        ).toBeGreaterThan(0);
      }
    });

    it("ownership year is ppaTerm + 1", () => {
      const model = buildCashflowModel(makeInputs({ ppaTerm: 16 }));
      expect(model.ppa.ownershipYear).toBe(17);
    });

    it("positive cumulative savings over 25 years", () => {
      const model = buildCashflowModel(makeInputs());
      expect(model.ppa.totalSavings).toBeGreaterThan(0);
    });
  });

  describe("provider economics", () => {
    it("calculates provider HQ incentive", () => {
      const model = buildCashflowModel(makeInputs());
      expect(model.providerEconomics.hqIncentive).toBeGreaterThan(0);
    });

    it("calculates provider ITC", () => {
      const model = buildCashflowModel(makeInputs());
      expect(model.providerEconomics.itc).toBeGreaterThan(0);
    });

    it("actual investment is positive", () => {
      const model = buildCashflowModel(makeInputs());
      expect(model.providerEconomics.actualInvestment).toBeGreaterThanOrEqual(0);
    });
  });

  describe("edge cases", () => {
    it("handles zero system size", () => {
      const model = buildCashflowModel(
        makeInputs({ systemSizeKW: 0, annualProductionKWh: 0 })
      );
      expect(model.grossCapex).toBe(0);
      expect(model.hqIncentive).toBe(0);
      expect(model.netClientInvestment).toBe(0);
    });

    it("handles very large system (5MW)", () => {
      const model = buildCashflowModel(
        makeInputs({
          systemSizeKW: 5000,
          annualProductionKWh: 5750000,
          kwhCostPerWatt: 1.7,
        })
      );
      // HQ incentive capped at 1MW eligible
      expect(model.hqIncentive).toBeLessThanOrEqual(1000000);
      expect(model.cash.yearlyCashflows).toHaveLength(25);
    });
  });
});
