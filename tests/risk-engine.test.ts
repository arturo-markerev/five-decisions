import { describe, expect, it } from "vitest";
import { classifyLanding, flagRisk, riskFromPenaltyProbability } from "@/lib/risk-engine";
import { expectedStrokes } from "@/lib/distance-engine";
import { hole } from "./helpers";

describe("landing classification", () => {
  it("puts a ball in the water when it is inside the hazard band", () => {
    const out = classifyLanding(hole(2), 250, -30); // 30 yd izquierda a 250
    expect(out.penalty).toBe(1);
    expect(out.label).toBe("Water");
  });

  it("keeps a ball in the fairway when it is inside the corridor", () => {
    const out = classifyLanding(hole(2), 250, 5);
    expect(out.penalty).toBe(0);
    expect(out.lie).toBe("FAIRWAY");
  });

  it("charges OB as stroke and distance", () => {
    const out = classifyLanding(hole(5), 200, 40);
    expect(out.penalty).toBe(2);
    expect(out.remainingDistance).toBe(hole(5).whiteTeeYardage);
  });
});

describe("flag risk", () => {
  it("marks a flag tucked next to water as RED", () => {
    expect(flagRisk(hole(2), "FRONT_LEFT", 20)).toBe("RED");
  });

  it("leaves a center flag on an open green as GREEN", () => {
    expect(flagRisk(hole(1), "MIDDLE_CENTER", 12)).toBe("GREEN");
  });

  it("treats unknown flag as play the center", () => {
    expect(flagRisk(hole(2), "UNKNOWN", 20)).toBe("GREEN");
  });
});

describe("risk bands", () => {
  it("maps penalty probability to a strategic risk level", () => {
    expect(riskFromPenaltyProbability(0.01)).toBe("GREEN");
    expect(riskFromPenaltyProbability(0.1)).toBe("YELLOW");
    expect(riskFromPenaltyProbability(0.3)).toBe("RED");
  });
});

describe("expected strokes model", () => {
  it("is monotonic in distance", () => {
    expect(expectedStrokes(100, "FAIRWAY")).toBeLessThan(expectedStrokes(200, "FAIRWAY"));
  });

  it("charges worse lies more", () => {
    expect(expectedStrokes(150, "FAIRWAY")).toBeLessThan(expectedStrokes(150, "HEAVY_ROUGH"));
    expect(expectedStrokes(150, "HEAVY_ROUGH")).toBeLessThan(expectedStrokes(150, "TREES"));
  });
});
