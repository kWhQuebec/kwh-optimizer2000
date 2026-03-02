import { describe, it, expect } from "vitest";
import {
  STANDARD_KITS,
  recommendStandardKit,
  getKitById,
  getKitsForMarket,
  getKitsInRange,
  type StandardKit,
  type KitRecommendation,
} from "../standardKitRecommender";

// ─── STANDARD_KITS data integrity ────────────────────────────────────────────

describe("STANDARD_KITS", () => {
  it("has 11 predefined kits", () => {
    expect(STANDARD_KITS.length).toBe(11);
  });

  it("all kits have required fields", () => {
    for (const kit of STANDARD_KITS) {
      expect(kit.id).toBeTruthy();
      expect(kit.name).toBeTruthy();
      expect(kit.nameFr).toBeTruthy();
      expect(kit.pvKW).toBeGreaterThan(0);
      expect(kit.basePrice).toBeGreaterThan(0);
      expect(kit.pricePerWatt).toBeGreaterThan(0);
      expect(["small", "medium", "large", "industrial"]).toContain(kit.targetMarket);
      expect(kit.features.length).toBeGreaterThan(0);
      expect(kit.featuresFr.length).toEqual(kit.features.length);
    }
  });

  it("kits with battery have matching batteryKWh and batteryKW", () => {
    for (const kit of STANDARD_KITS) {
      if (kit.batteryKWh > 0) {
        expect(kit.batteryKW).toBeGreaterThan(0);
      }
      if (kit.batteryKW > 0) {
        expect(kit.batteryKWh).toBeGreaterThan(0);
      }
    }
  });

  it("kit IDs are unique", () => {
    const ids = STANDARD_KITS.map(k => k.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("kits are priced reasonably (\$1.50-\$2.50/W)", () => {
    for (const kit of STANDARD_KITS) {
      expect(kit.pricePerWatt).toBeGreaterThanOrEqual(1.50);
      expect(kit.pricePerWatt).toBeLessThanOrEqual(2.50);
    }
  });
});

// ─── recommendStandardKit ────────────────────────────────────────────────────

describe("recommendStandardKit", () => {
  it("recommends exact match for 50 kW system", () => {
    const result = recommendStandardKit(50);
    expect(result.recommendedKit.pvKW).toBe(50);
    expect(result.comparison.oversizePercent).toBeCloseTo(0, 0);
  });

  it("recommends next size up for 60 kW (between 50 and 100)", () => {
    const result = recommendStandardKit(60);
    expect(result.recommendedKit.pvKW).toBe(100);
    expect(result.comparison.oversizePercent).toBeGreaterThan(0);
  });

  it("provides alternative kit when includeAlternative is true", () => {
    const result = recommendStandardKit(60, 0, 0, { includeAlternative: true });
    expect(result.alternativeKit).not.toBeNull();
    expect(result.alternativeKit!.pvKW).toBeLessThan(result.recommendedKit.pvKW);
  });

  it("returns no alternative when includeAlternative is false", () => {
    const result = recommendStandardKit(60, 0, 0, { includeAlternative: false });
    // preferOversizing finds the next kit up, no alternative requested
    expect(result.alternativeKit).toBeNull();
  });

  it("handles system larger than all kits", () => {
    const result = recommendStandardKit(2000);
    // Should return the largest kit
    expect(result.recommendedKit.pvKW).toBe(1000);
    expect(result.comparison.oversizePercent).toBeLessThan(0);
  });

  it("handles very small system (5 kW)", () => {
    const result = recommendStandardKit(5);
    expect(result.recommendedKit.pvKW).toBe(20);
    expect(result.comparison.oversizePercent).toBeGreaterThan(100);
  });

  it("filters for battery kits when battery is requested", () => {
    const result = recommendStandardKit(100, 50, 25);
    expect(result.recommendedKit.batteryKWh).toBeGreaterThan(0);
  });

  it("uses closest kit when preferOversizing is false", () => {
    const result = recommendStandardKit(60, 0, 0, { preferOversizing: false });
    // 60 is closer to 50 than to 100
    expect(result.recommendedKit.pvKW).toBe(50);
  });

  it("calculates custom price correctly", () => {
    const result = recommendStandardKit(100);
    expect(result.comparison.customPrice).toBeGreaterThan(0);
    expect(result.comparison.priceVsCustom).toBeDefined();
  });

  it("generates bilingual reasoning", () => {
    const result = recommendStandardKit(50);
    expect(result.reasoning).toBeTruthy();
    expect(result.reasoningFr).toBeTruthy();
    expect(result.reasoning).not.toEqual(result.reasoningFr);
  });

  it("includes optimal sizing in result", () => {
    const result = recommendStandardKit(75, 40, 20);
    expect(result.optimalSizing.pvKW).toBe(75);
    expect(result.optimalSizing.batteryKWh).toBe(40);
    expect(result.optimalSizing.batteryKW).toBe(20);
  });

  it("oversize reasoning changes based on percentage", () => {
    const small = recommendStandardKit(95);   // ~5% oversize
    const medium = recommendStandardKit(60);   // ~67% oversize
    const large = recommendStandardKit(5);     // >300% oversize
    // Different oversize levels should produce different messages
    expect(small.reasoning).not.toEqual(large.reasoning);
  });
});

// ─── getKitById ──────────────────────────────────────────────────────────────

describe("getKitById", () => {
  it("finds kit by valid ID", () => {
    const kit = getKitById("kit-100-0");
    expect(kit).toBeDefined();
    expect(kit!.pvKW).toBe(100);
  });

  it("returns undefined for invalid ID", () => {
    const kit = getKitById("nonexistent");
    expect(kit).toBeUndefined();
  });
});

// ─── getKitsForMarket ────────────────────────────────────────────────────────

describe("getKitsForMarket", () => {
  it("returns small market kits", () => {
    const kits = getKitsForMarket("small");
    expect(kits.length).toBeGreaterThan(0);
    kits.forEach(k => expect(k.targetMarket).toBe("small"));
  });

  it("returns industrial market kits", () => {
    const kits = getKitsForMarket("industrial");
    expect(kits.length).toBeGreaterThan(0);
    kits.forEach(k => expect(k.targetMarket).toBe("industrial"));
  });
});

// ─── getKitsInRange ──────────────────────────────────────────────────────────

describe("getKitsInRange", () => {
  it("returns kits within 50-250 kW range", () => {
    const kits = getKitsInRange(50, 250);
    expect(kits.length).toBeGreaterThan(0);
    kits.forEach(k => {
      expect(k.pvKW).toBeGreaterThanOrEqual(50);
      expect(k.pvKW).toBeLessThanOrEqual(250);
    });
  });

  it("returns empty for impossible range", () => {
    const kits = getKitsInRange(10000, 20000);
    expect(kits.length).toBe(0);
  });
});
