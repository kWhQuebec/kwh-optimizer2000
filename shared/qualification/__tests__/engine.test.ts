import { describe, it, expect } from "vitest";
import {
  calculateEconomicStatus,
  calculateQualification,
  quickQualificationScore,
} from "../engine";
import type { QualificationData } from "../types";

function makeQualData(
  overrides: Partial<QualificationData> = {}
): QualificationData {
  return {
    estimatedMonthlyBill: 8000,
    economicStatus: "medium",
    propertyRelationship: "owner",
    roofCondition: "good",
    roofAge: "recent",
    decisionAuthority: "decision_maker",
    budgetReadiness: "budget_allocated",
    timelineUrgency: "this_year",
    ...overrides,
  };
}

describe("calculateEconomicStatus", () => {
  it("returns 'high' for bills >= $10,000", () => {
    expect(calculateEconomicStatus(10000)).toBe("high");
    expect(calculateEconomicStatus(15000)).toBe("high");
  });

  it("returns 'medium' for bills $5,000-$9,999", () => {
    expect(calculateEconomicStatus(5000)).toBe("medium");
    expect(calculateEconomicStatus(9999)).toBe("medium");
  });

  it("returns 'low' for bills $2,500-$4,999", () => {
    expect(calculateEconomicStatus(2500)).toBe("low");
    expect(calculateEconomicStatus(4999)).toBe("low");
  });

  it("returns 'insufficient' for bills below $2,500", () => {
    expect(calculateEconomicStatus(2499)).toBe("insufficient");
    expect(calculateEconomicStatus(1500)).toBe("insufficient");
    expect(calculateEconomicStatus(0)).toBe("insufficient");
  });

  it("returns 'insufficient' for null", () => {
    expect(calculateEconomicStatus(null)).toBe("insufficient");
  });

  it("handles exact thresholds correctly", () => {
    expect(calculateEconomicStatus(10000)).toBe("high");
    expect(calculateEconomicStatus(5000)).toBe("medium");
    expect(calculateEconomicStatus(2500)).toBe("low");
    // $1,500 is below MINIMUM (1500 is NOT >= 2500)
    expect(calculateEconomicStatus(1500)).toBe("insufficient");
  });
});

describe("calculateQualification", () => {
  describe("gate scoring", () => {
    it("scores economic gate: high = 25", () => {
      const result = calculateQualification(
        makeQualData({ economicStatus: "high" })
      );
      expect(result.gateScores.economic).toBe(25);
    });

    it("scores economic gate: medium = 20", () => {
      const result = calculateQualification(
        makeQualData({ economicStatus: "medium" })
      );
      expect(result.gateScores.economic).toBe(20);
    });

    it("scores economic gate: low = 12", () => {
      const result = calculateQualification(
        makeQualData({ economicStatus: "low" })
      );
      expect(result.gateScores.economic).toBe(12);
    });

    it("scores economic gate: insufficient = 0", () => {
      const result = calculateQualification(
        makeQualData({ economicStatus: "insufficient" })
      );
      expect(result.gateScores.economic).toBe(0);
    });

    it("scores property gate: owner = 25", () => {
      const result = calculateQualification(
        makeQualData({ propertyRelationship: "owner" })
      );
      expect(result.gateScores.property).toBe(25);
    });

    it("scores roof gate as sum of condition + age", () => {
      const result = calculateQualification(
        makeQualData({ roofCondition: "excellent", roofAge: "new" })
      );
      // excellent=15, new=10 => 25
      expect(result.gateScores.roof).toBe(25);
    });

    it("scores decision gate as sum of authority + budget + timeline", () => {
      const result = calculateQualification(
        makeQualData({
          decisionAuthority: "decision_maker",
          budgetReadiness: "budget_allocated",
          timelineUrgency: "immediate",
        })
      );
      // decision_maker=10, budget_allocated=8, immediate=7 => 25
      expect(result.gateScores.decision).toBe(25);
    });

    it("total score is sum of all gate scores", () => {
      const result = calculateQualification(makeQualData());
      const { economic, property, roof, decision } = result.gateScores;
      expect(result.score).toBe(economic + property + roof + decision);
    });

    it("maximum possible score is 100", () => {
      const result = calculateQualification(
        makeQualData({
          economicStatus: "high",
          propertyRelationship: "owner",
          roofCondition: "excellent",
          roofAge: "new",
          decisionAuthority: "decision_maker",
          budgetReadiness: "budget_allocated",
          timelineUrgency: "immediate",
        })
      );
      expect(result.score).toBe(100);
    });
  });

  describe("blocker identification", () => {
    it("identifies insufficient bill as critical blocker", () => {
      const result = calculateQualification(
        makeQualData({ economicStatus: "insufficient" })
      );
      const blocker = result.blockers.find(
        (b) => b.type === "insufficient_bill"
      );
      expect(blocker).toBeDefined();
      expect(blocker!.severity).toBe("critical");
    });

    it("identifies tenant_no_auth as critical blocker", () => {
      const result = calculateQualification(
        makeQualData({ propertyRelationship: "tenant_no_auth" })
      );
      const blocker = result.blockers.find(
        (b) => b.type === "property_authorization"
      );
      expect(blocker).toBeDefined();
      expect(blocker!.severity).toBe("critical");
    });

    it("identifies roof_replacement as critical blocker", () => {
      const result = calculateQualification(
        makeQualData({ roofCondition: "needs_replacement" })
      );
      const blocker = result.blockers.find(
        (b) => b.type === "roof_replacement_needed"
      );
      expect(blocker).toBeDefined();
      expect(blocker!.severity).toBe("critical");
    });

    it("identifies no_budget as critical blocker", () => {
      const result = calculateQualification(
        makeQualData({ budgetReadiness: "no_budget" })
      );
      const blocker = result.blockers.find((b) => b.type === "no_budget");
      expect(blocker).toBeDefined();
      expect(blocker!.severity).toBe("critical");
    });

    it("has no blockers for ideal lead", () => {
      const result = calculateQualification(
        makeQualData({
          economicStatus: "high",
          propertyRelationship: "owner",
          roofCondition: "excellent",
          roofAge: "new",
          decisionAuthority: "decision_maker",
          budgetReadiness: "budget_allocated",
          timelineUrgency: "immediate",
        })
      );
      expect(result.blockers).toHaveLength(0);
    });
  });

  describe("status determination", () => {
    it("returns 'hot' for high score with no blockers", () => {
      const result = calculateQualification(
        makeQualData({
          economicStatus: "high",
          propertyRelationship: "owner",
          roofCondition: "excellent",
          roofAge: "new",
          decisionAuthority: "decision_maker",
          budgetReadiness: "budget_allocated",
          timelineUrgency: "immediate",
        })
      );
      expect(result.status).toBe("hot");
    });

    it("returns 'disqualified' for insufficient bill", () => {
      const result = calculateQualification(
        makeQualData({ economicStatus: "insufficient" })
      );
      expect(result.status).toBe("disqualified");
    });

    it("returns 'cold' for critical blockers other than bill", () => {
      const result = calculateQualification(
        makeQualData({ propertyRelationship: "tenant_no_auth" })
      );
      expect(result.status).toBe("cold");
    });
  });

  describe("next steps", () => {
    it("includes proposal step for hot leads", () => {
      const result = calculateQualification(
        makeQualData({
          economicStatus: "high",
          propertyRelationship: "owner",
          roofCondition: "excellent",
          roofAge: "new",
          decisionAuthority: "decision_maker",
          budgetReadiness: "budget_allocated",
          timelineUrgency: "immediate",
        })
      );
      expect(result.suggestedNextSteps.length).toBeGreaterThan(0);
    });

    it("always returns at least one next step", () => {
      const result = calculateQualification(
        makeQualData({ economicStatus: "insufficient" })
      );
      expect(result.suggestedNextSteps.length).toBeGreaterThan(0);
    });
  });
});

describe("quickQualificationScore", () => {
  it("returns correct status for high bill", () => {
    const result = quickQualificationScore(12000);
    expect(result.status).toBe("high");
    expect(result.viable).toBe(true);
  });

  it("returns not viable for insufficient bill", () => {
    const result = quickQualificationScore(500);
    expect(result.status).toBe("insufficient");
    expect(result.viable).toBe(false);
  });

  it("estimates potential kW from bill", () => {
    const result = quickQualificationScore(5000);
    // $5000/month ≈ 500 kW (rough: bill/10)
    expect(result.estimatedPotentialKw).toBe(500);
  });

  it("returns null potential for null bill", () => {
    const result = quickQualificationScore(null);
    expect(result.estimatedPotentialKw).toBeNull();
    expect(result.viable).toBe(false);
  });
});
