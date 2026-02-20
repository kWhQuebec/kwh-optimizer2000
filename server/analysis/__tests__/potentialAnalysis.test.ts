import { describe, it, expect } from "vitest";
import {
  getTieredSolarCostPerW,
  resolveYieldStrategy,
  buildSystemParams,
  BASELINE_YIELD,
} from "../potentialAnalysis";

describe("getTieredSolarCostPerW", () => {
  it("returns $2.30/W for systems < 100 kW", () => {
    expect(getTieredSolarCostPerW(50)).toBe(2.3);
    expect(getTieredSolarCostPerW(99)).toBe(2.3);
  });

  it("returns $2.15/W for 100-499 kW systems", () => {
    expect(getTieredSolarCostPerW(100)).toBe(2.15);
    expect(getTieredSolarCostPerW(499)).toBe(2.15);
  });

  it("returns $2.00/W for 500-999 kW systems", () => {
    expect(getTieredSolarCostPerW(500)).toBe(2.0);
    expect(getTieredSolarCostPerW(999)).toBe(2.0);
  });

  it("returns $1.85/W for 1-3 MW systems", () => {
    expect(getTieredSolarCostPerW(1000)).toBe(1.85);
    expect(getTieredSolarCostPerW(2999)).toBe(1.85);
  });

  it("returns $1.70/W for 3 MW+ systems", () => {
    expect(getTieredSolarCostPerW(3000)).toBe(1.7);
    expect(getTieredSolarCostPerW(10000)).toBe(1.7);
  });

  it("returns $2.30/W for zero size", () => {
    expect(getTieredSolarCostPerW(0)).toBe(2.3);
  });

  it("returns $2.30/W for negative size", () => {
    expect(getTieredSolarCostPerW(-10)).toBe(2.3);
  });
});

describe("resolveYieldStrategy", () => {
  it("uses default yield when no data provided", () => {
    const strategy = resolveYieldStrategy({});
    expect(strategy.yieldSource).toBe("default");
    expect(strategy.baseYield).toBe(BASELINE_YIELD);
    expect(strategy.skipTempCorrection).toBe(false);
  });

  it("uses stored google source when yieldSource is google", () => {
    const strategy = resolveYieldStrategy({
      yieldSource: "google",
      solarYieldKWhPerKWp: 1200,
    });
    expect(strategy.yieldSource).toBe("google");
    expect(strategy.baseYield).toBe(1200);
    expect(strategy.skipTempCorrection).toBe(true);
  });

  it("uses fresh Google production estimate (priority 1)", () => {
    const strategy = resolveYieldStrategy(
      {},
      {
        googleProductionEstimate: {
          yearlyEnergyAcKwh: 120000,
          systemSizeKw: 100,
        },
      }
    );
    expect(strategy.yieldSource).toBe("google");
    expect(strategy.baseYield).toBe(1200); // 120000/100
    expect(strategy.skipTempCorrection).toBe(true);
  });

  it("uses Google sunshine hours as fallback (priority 2)", () => {
    const strategy = resolveYieldStrategy(
      {},
      { maxSunshineHoursPerYear: 1400 }
    );
    expect(strategy.yieldSource).toBe("google");
    expect(strategy.baseYield).toBe(Math.round(1400 * 0.85));
    expect(strategy.skipTempCorrection).toBe(true);
  });

  it("prefers manual yield when useManualYield flag is set", () => {
    const strategy = resolveYieldStrategy(
      { useManualYield: true, solarYieldKWhPerKWp: 1100 } as any,
      {
        googleProductionEstimate: {
          yearlyEnergyAcKwh: 120000,
          systemSizeKw: 100,
        },
      }
    );
    expect(strategy.yieldSource).toBe("manual");
    expect(strategy.skipTempCorrection).toBe(true);
  });

  it("detects manual source for non-default yield values", () => {
    const strategy = resolveYieldStrategy({ solarYieldKWhPerKWp: 1300 });
    expect(strategy.yieldSource).toBe("manual");
    expect(strategy.baseYield).toBe(1300);
  });

  it("applies bifacial boost when enabled", () => {
    const strategy = resolveYieldStrategy({ bifacialEnabled: true });
    expect(strategy.bifacialBoost).toBe(1.15);
    expect(strategy.effectiveYield).toBe(BASELINE_YIELD * 1.15);
  });

  it("no bifacial boost when explicitly disabled", () => {
    const strategy = resolveYieldStrategy({ bifacialEnabled: false });
    expect(strategy.bifacialBoost).toBe(1.0);
    expect(strategy.effectiveYield).toBe(BASELINE_YIELD);
  });

  it("clamps orientation factor between 0.6 and 1.0", () => {
    const strategy = resolveYieldStrategy({ orientationFactor: 0.3 });
    expect(strategy.orientationFactor).toBe(0.6);
  });

  it("ignores orientation factor for google yield", () => {
    const strategy = resolveYieldStrategy(
      { orientationFactor: 0.8, yieldSource: "google", solarYieldKWhPerKWp: 1200 }
    );
    expect(strategy.orientationFactor).toBe(1.0);
  });

  it("calculates yieldFactor relative to BASELINE_YIELD", () => {
    const strategy = resolveYieldStrategy({
      solarYieldKWhPerKWp: 1150,
      bifacialEnabled: false,
    });
    expect(strategy.yieldFactor).toBeCloseTo(1.0, 2);
  });
});

describe("buildSystemParams", () => {
  it("uses default values when assumptions are empty", () => {
    const yieldStrategy = resolveYieldStrategy({});
    const params = buildSystemParams({}, yieldStrategy);
    expect(params.inverterLoadRatio).toBe(1.45);
    expect(params.temperatureCoefficient).toBe(-0.004);
    expect(params.wireLossPercent).toBe(0.03);
    expect(params.lidLossPercent).toBe(0.01);
    expect(params.mismatchLossPercent).toBe(0.02);
    expect(params.mismatchStringsLossPercent).toBe(0.0015);
    expect(params.moduleQualityGainPercent).toBe(0.0075);
  });

  it("respects custom assumptions", () => {
    const yieldStrategy = resolveYieldStrategy({});
    const params = buildSystemParams(
      {
        inverterLoadRatio: 1.3,
        temperatureCoefficient: -0.003,
        wireLossPercent: 0.03,
      },
      yieldStrategy
    );
    expect(params.inverterLoadRatio).toBe(1.3);
    expect(params.temperatureCoefficient).toBe(-0.003);
    expect(params.wireLossPercent).toBe(0.03);
  });

  it("derives skipTempCorrection from yield strategy", () => {
    const defaultStrategy = resolveYieldStrategy({});
    expect(buildSystemParams({}, defaultStrategy).skipTempCorrection).toBe(false);

    const googleStrategy = resolveYieldStrategy({
      yieldSource: "google",
      solarYieldKWhPerKWp: 1200,
    });
    expect(buildSystemParams({}, googleStrategy).skipTempCorrection).toBe(true);
  });
});
