import { describe, expect, it } from "vitest";
import { recommendShot } from "@/lib/decision-engine";
import { buildDispersion } from "@/lib/dispersion-engine";
import { classifyLanding } from "@/lib/risk-engine";
import { hole, profile } from "./helpers";

/** Exposicion a penalidad de un palo apuntado al centro, sin optimizar. */
function naivePenaltyExposure(holeNumber: number, clubName: string): number {
  const club = profile().clubs.find((c) => c.clubName === clubName)!;
  const h = hole(holeNumber);
  return buildDispersion(club, { lie: "TEE" }).reduce((acc, s) => {
    const out = classifyLanding(h, s.carry, s.lateral);
    return acc + (out.penalty > 0 ? s.weight : 0);
  }, 0);
}

describe("decision engine — hazard detection off the tee", () => {
  it("sees that a center-aimed driver puts real dispersion in the water", () => {
    // Hoyo 2 (MOCK): agua izquierda de 215 a 300 yd. Driver planning 250.
    expect(naivePenaltyExposure(2, "Driver")).toBeGreaterThan(0.05);
  });

  it("recommends a shot that removes most of that penalty exposure", () => {
    const rec = recommendShot({
      profile: profile(),
      hole: hole(2),
      shotNumber: 1,
      lie: "TEE",
      distanceToGreen: hole(2).whiteTeeYardage,
      flagPosition: "MIDDLE_CENTER",
    });
    expect(rec.penaltyProbability).toBeLessThan(naivePenaltyExposure(2, "Driver"));
    expect(rec.penaltyProbability).toBeLessThan(0.1);
    expect(rec.riskLevel).not.toBe("RED");
  });

  it("aims away from the penalty side, not at the center by default", () => {
    const rec = recommendShot({
      profile: profile(),
      hole: hole(2),
      shotNumber: 1,
      lie: "TEE",
      distanceToGreen: hole(2).whiteTeeYardage,
      flagPosition: "MIDDLE_CENTER",
    });
    // agua a la izquierda => la punteria se corre a la derecha
    expect(rec.targetOffset).toBeGreaterThanOrEqual(0);
    expect(rec.dangerMiss.toUpperCase()).toContain("LEFT");
  });

  it("does not turn conservative when the corridor is clean", () => {
    // Hoyo 1 (MOCK): sin hazards de penalidad, calle ancha, 372 yd.
    const rec = recommendShot({
      profile: profile(),
      hole: hole(1),
      shotNumber: 1,
      lie: "TEE",
      distanceToGreen: hole(1).whiteTeeYardage,
      flagPosition: "MIDDLE_CENTER",
    });
    expect(rec.riskLevel).toBe("GREEN");
    expect(rec.penaltyProbability).toBe(0);
    // avanza de verdad: no se esconde con un hierro corto sin motivo
    expect(rec.expectedRemainingDistance).toBeLessThan(230);
  });

  it("never plans around good strike distance", () => {
    const p = profile();
    const driver = p.clubs.find((c) => c.clubName === "Driver")!;
    const rec = recommendShot({
      profile: p,
      hole: hole(1),
      shotNumber: 1,
      lie: "TEE",
      distanceToGreen: hole(1).whiteTeeYardage,
      flagPosition: "MIDDLE_CENTER",
    });
    expect(rec.planningDistance).not.toBe(driver.goodStrikeDistance);
  });
});

describe("decision engine — forced carries", () => {
  it("does not pick a club whose pattern lands in the forced carry", () => {
    // Hoyo 7 (MOCK): agua cruzada de 150 a 185 yd desde el tee.
    const rec = recommendShot({
      profile: profile(),
      hole: hole(7),
      shotNumber: 1,
      lie: "TEE",
      distanceToGreen: hole(7).whiteTeeYardage,
      flagPosition: "MIDDLE_CENTER",
    });
    expect(rec.planningDistance).toBeGreaterThan(185);
    expect(rec.penaltyProbability).toBeLessThan(0.15);
  });
});

describe("decision engine — approach and red flags", () => {
  it("moves the target away from a red flag instead of firing at it", () => {
    // Hoyo 2: agua a la izquierda del green, bandera front-left.
    const rec = recommendShot({
      profile: profile(),
      hole: hole(2),
      shotNumber: 2,
      lie: "FAIRWAY",
      distanceToGreen: 150,
      flagPosition: "FRONT_LEFT",
    });
    expect(rec.flagRisk).toBe("RED");
    expect(rec.targetOffset).toBeGreaterThan(0); // se corre a la derecha del pin
    expect(rec.tigerFiveRisk).toContain("BAD_DECISION_INSIDE_150");
  });

  it("is allowed to attack a safe flag", () => {
    const rec = recommendShot({
      profile: profile(),
      hole: hole(1),
      shotNumber: 2,
      lie: "FAIRWAY",
      distanceToGreen: 155,
      flagPosition: "MIDDLE_CENTER",
    });
    expect(rec.flagRisk).toBe("GREEN");
    expect(Math.abs(rec.targetOffset)).toBeLessThanOrEqual(10);
  });

  it("picks a club that covers the number rather than one that maybe reaches", () => {
    const rec = recommendShot({
      profile: profile(),
      hole: hole(1),
      shotNumber: 2,
      lie: "FAIRWAY",
      distanceToGreen: 165,
      flagPosition: "MIDDLE_CENTER",
    });
    expect(rec.planningDistance).toBeGreaterThanOrEqual(155);
  });
});

describe("decision engine — recovery", () => {
  it("recommends getting back in play from the trees instead of the hero shot", () => {
    const rec = recommendShot({
      profile: profile(),
      hole: hole(6),
      shotNumber: 2,
      lie: "TREES",
      distanceToGreen: 210,
      flagPosition: "MIDDLE_CENTER",
    });
    expect(["PITCH_OUT", "LAYUP", "ADVANCE", "STANDARD"]).toContain(rec.playCategory);
    expect(rec.intent).toBe("RECOVERY");
    expect(rec.caddieLine.length).toBeLessThan(80);
  });
});

describe("decision engine — output contract", () => {
  it("never exposes a fake strokes-gained number in user-facing text", () => {
    const rec = recommendShot({
      profile: profile(),
      hole: hole(2),
      shotNumber: 1,
      lie: "TEE",
      distanceToGreen: hole(2).whiteTeeYardage,
      flagPosition: "MIDDLE_CENTER",
    });
    const text = `${rec.rationale} ${rec.caddieLine} ${rec.target} ${rec.safeMiss}`;
    expect(text).not.toMatch(/[+-]\d\.\d{1,2}\s*strokes/i);
    for (const alt of rec.alternatives) {
      expect(["LOW", "MEDIUM", "HIGH"]).toContain(alt.estimatedCost);
    }
    expect(["LOW", "MEDIUM", "HIGH"]).toContain(rec.confidence);
  });
});
