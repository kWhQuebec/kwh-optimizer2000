import { describe, it, expect } from "vitest";
import {
  generateSyntheticProfile,
  estimateAnnualConsumption,
  type BuildingSubType,
} from "../syntheticProfile";

describe("generateSyntheticProfile", () => {
  const annualKWh = 500_000;

  it("produces 8760 hourly readings for a non-leap year", () => {
    const result = generateSyntheticProfile({
      buildingSubType: "office",
      annualConsumptionKWh: annualKWh,
    });
    expect(result.readings).toHaveLength(8760);
  });

  it("sum of kWh equals annualConsumptionKWh within 1%", () => {
    const result = generateSyntheticProfile({
      buildingSubType: "warehouse",
      annualConsumptionKWh: annualKWh,
    });
    const totalKWh = result.readings.reduce((sum, r) => sum + r.kWh, 0);
    expect(totalKWh).toBeCloseTo(annualKWh, -3); // within ~1000 kWh due to rounding
    expect(Math.abs(totalKWh - annualKWh) / annualKWh).toBeLessThan(0.01);
  });

  it("returns correct metadata", () => {
    const result = generateSyntheticProfile({
      buildingSubType: "retail",
      annualConsumptionKWh: annualKWh,
    });
    expect(result.metadata.buildingSubType).toBe("retail");
    expect(result.metadata.annualConsumptionKWh).toBe(annualKWh);
    expect(result.metadata.estimatedPeakKW).toBeGreaterThan(0);
    expect(result.metadata.loadFactor).toBe(0.40);
  });

  it("peak kW is consistent with load factor", () => {
    const result = generateSyntheticProfile({
      buildingSubType: "office",
      annualConsumptionKWh: annualKWh,
    });
    const avgKW = annualKWh / 8760;
    const expectedPeak = avgKW / 0.45; // office load factor
    expect(result.metadata.estimatedPeakKW).toBeCloseTo(expectedPeak, 0);
  });

  it("office: business hours > nighttime hours", () => {
    const result = generateSyntheticProfile({
      buildingSubType: "office",
      annualConsumptionKWh: annualKWh,
    });
    // Pick a weekday: Jan 2 2023 is a Monday
    const mondayReadings = result.readings.filter(r => {
      const d = r.timestamp;
      return d.getMonth() === 0 && d.getDate() === 2;
    });

    const noonKWh = mondayReadings.find(r => r.timestamp.getHours() === 12)!.kWh;
    const nightKWh = mondayReadings.find(r => r.timestamp.getHours() === 3)!.kWh;
    expect(noonKWh).toBeGreaterThan(nightKWh * 2);
  });

  it("office: weekday > weekend", () => {
    const result = generateSyntheticProfile({
      buildingSubType: "office",
      annualConsumptionKWh: annualKWh,
    });

    // Jan 2 2023 = Monday, Jan 7 2023 = Saturday
    const mondayNoon = result.readings.find(r =>
      r.timestamp.getMonth() === 0 && r.timestamp.getDate() === 2 && r.timestamp.getHours() === 12
    )!;
    const saturdayNoon = result.readings.find(r =>
      r.timestamp.getMonth() === 0 && r.timestamp.getDate() === 7 && r.timestamp.getHours() === 12
    )!;

    expect(mondayNoon.kWh).toBeGreaterThan(saturdayNoon.kWh * 2);
  });

  it("institutional: weekday > weekend (low weekend factor)", () => {
    const result = generateSyntheticProfile({
      buildingSubType: "institutional",
      annualConsumptionKWh: annualKWh,
    });

    const mondayNoon = result.readings.find(r =>
      r.timestamp.getMonth() === 0 && r.timestamp.getDate() === 2 && r.timestamp.getHours() === 12
    )!;
    const saturdayNoon = result.readings.find(r =>
      r.timestamp.getMonth() === 0 && r.timestamp.getDate() === 7 && r.timestamp.getHours() === 12
    )!;

    expect(mondayNoon.kWh).toBeGreaterThan(saturdayNoon.kWh * 3);
  });

  it("industrial: flat profile (night/day ratio > 0.7)", () => {
    const result = generateSyntheticProfile({
      buildingSubType: "industrial",
      annualConsumptionKWh: annualKWh,
    });

    // Pick a weekday
    const mondayReadings = result.readings.filter(r => {
      const d = r.timestamp;
      return d.getMonth() === 0 && d.getDate() === 2;
    });

    const noonKWh = mondayReadings.find(r => r.timestamp.getHours() === 12)!.kWh;
    const nightKWh = mondayReadings.find(r => r.timestamp.getHours() === 3)!.kWh;

    expect(nightKWh / noonKWh).toBeGreaterThan(0.7);
  });

  it("respects operatingSchedule override", () => {
    const standard = generateSyntheticProfile({
      buildingSubType: "office",
      annualConsumptionKWh: annualKWh,
      operatingSchedule: "standard",
    });

    const extended = generateSyntheticProfile({
      buildingSubType: "office",
      annualConsumptionKWh: annualKWh,
      operatingSchedule: "extended",
    });

    // Extended schedule should have higher nighttime usage relative to peak
    const stdNight = standard.readings.find(r =>
      r.timestamp.getMonth() === 0 && r.timestamp.getDate() === 2 && r.timestamp.getHours() === 22
    )!;
    const extNight = extended.readings.find(r =>
      r.timestamp.getMonth() === 0 && r.timestamp.getDate() === 2 && r.timestamp.getHours() === 22
    )!;

    // Extended 22h is within operating hours, standard 22h is outside
    const stdNoon = standard.readings.find(r =>
      r.timestamp.getMonth() === 0 && r.timestamp.getDate() === 2 && r.timestamp.getHours() === 12
    )!;
    const extNoon = extended.readings.find(r =>
      r.timestamp.getMonth() === 0 && r.timestamp.getDate() === 2 && r.timestamp.getHours() === 12
    )!;

    // Night/noon ratio should be higher for extended
    expect(extNight.kWh / extNoon.kWh).toBeGreaterThan(stdNight.kWh / stdNoon.kWh);
  });

  it("throws on unknown building type", () => {
    expect(() =>
      generateSyntheticProfile({
        buildingSubType: "spaceship" as BuildingSubType,
        annualConsumptionKWh: annualKWh,
      })
    ).toThrow("Unknown building sub-type");
  });

  it("all readings have positive kWh and kW", () => {
    const types: BuildingSubType[] = ["office", "warehouse", "retail", "industrial", "institutional"];
    for (const type of types) {
      const result = generateSyntheticProfile({
        buildingSubType: type,
        annualConsumptionKWh: annualKWh,
      });
      for (const r of result.readings) {
        expect(r.kWh).toBeGreaterThanOrEqual(0);
        expect(r.kW).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("estimateAnnualConsumption", () => {
  it("estimates from monthly bill with tariff M", () => {
    const result = estimateAnnualConsumption({
      monthlyBill: 5000,
      tariffCode: "M",
      buildingSubType: "office",
    });
    // $5000/month × 0.7 / $0.06061 × 12 ≈ 693,450 kWh
    expect(result).toBeGreaterThan(600_000);
    expect(result).toBeLessThan(800_000);
  });

  it("estimates from monthly bill with tariff G", () => {
    const result = estimateAnnualConsumption({
      monthlyBill: 1500,
      tariffCode: "G",
      buildingSubType: "retail",
    });
    // $1500/month × 0.7 / $0.11933 × 12 ≈ 105,596 kWh
    expect(result).toBeGreaterThan(80_000);
    expect(result).toBeLessThan(140_000);
  });

  it("prefers bill over area when both provided", () => {
    const result = estimateAnnualConsumption({
      monthlyBill: 5000,
      tariffCode: "M",
      buildingSqFt: 10000,
      buildingSubType: "office",
    });
    // Should use bill (≈693k), not area (10000 × 18 = 180k)
    expect(result).toBeGreaterThan(500_000);
  });

  it("estimates from building area when no bill", () => {
    const result = estimateAnnualConsumption({
      buildingSqFt: 50000,
      buildingSubType: "warehouse",
    });
    // 50000 × 10 = 500,000
    expect(result).toBe(500_000);
  });

  it("uses correct intensity per building type", () => {
    const office = estimateAnnualConsumption({ buildingSqFt: 10000, buildingSubType: "office" });
    const warehouse = estimateAnnualConsumption({ buildingSqFt: 10000, buildingSubType: "warehouse" });
    // Office: 18 kWh/ft², Warehouse: 10 kWh/ft²
    expect(office).toBe(180_000);
    expect(warehouse).toBe(100_000);
  });

  it("returns 200,000 kWh fallback when no inputs", () => {
    const result = estimateAnnualConsumption({
      buildingSubType: "office",
    });
    expect(result).toBe(200_000);
  });
});
