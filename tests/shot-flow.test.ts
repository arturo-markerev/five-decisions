import { describe, expect, it } from "vitest";
import { correctMissFromResult, estimateNextDistance, lieFromResult, penaltyFromResult } from "@/lib/shot-flow";
import { recommendShot } from "@/lib/decision-engine";
import { hole, profile } from "./helpers";

describe("correct side miss", () => {
  it("counts a miss on the planned safe side as a correct miss", () => {
    const rec = recommendShot({
      profile: profile(),
      hole: hole(2),
      shotNumber: 2,
      lie: "FAIRWAY",
      distanceToGreen: 150,
      flagPosition: "FRONT_LEFT",
    });
    // agua a la izquierda => el fallo caro es izquierda
    expect(correctMissFromResult(rec, "LEFT")).toBe(false);
    expect(correctMissFromResult(rec, "WATER")).toBe(false);
    expect(correctMissFromResult(rec, "GREEN")).toBeNull();
  });
});

describe("shot flow bookkeeping", () => {
  it("maps results to the next lie", () => {
    expect(lieFromResult("FAIRWAY", "TEE")).toBe("FAIRWAY");
    expect(lieFromResult("BUNKER", "FAIRWAY")).toBe("BUNKER");
    expect(lieFromResult("OB", "TEE")).toBe("TEE");
    expect(lieFromResult("GREEN", "FAIRWAY")).toBe("GREEN");
  });

  it("charges the scorecard the right penalty", () => {
    expect(penaltyFromResult("WATER")).toBe(1);
    expect(penaltyFromResult("OB")).toBe(1);
    expect(penaltyFromResult("FAIRWAY")).toBe(0);
  });

  it("leaves OB at the same distance because the shot is replayed", () => {
    expect(estimateNextDistance(412, 250, "TEE", "OB")).toBe(412);
  });

  it("advances the ball on a normal shot", () => {
    expect(estimateNextDistance(412, 220, "TEE", "FAIRWAY")).toBe(192);
  });
});
