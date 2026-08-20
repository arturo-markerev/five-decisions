import { describe, expect, it } from "vitest";
import { evaluateHole, evaluateRound, isCleanHole, totalEvents } from "@/lib/tiger-five-engine";
import { holeRecord, round, shot } from "./helpers";

describe("tiger five h18 — detection", () => {
  it("counts a penalty event", () => {
    const h = holeRecord({
      penalties: 1,
      score: 6,
      shots: [shot({ result: "WATER", penalty: 1 })],
    });
    const keys = evaluateHole(h).map((e) => e.key);
    expect(keys).toContain("PENALTY");
  });

  it("separates a double by execution from a double by decision", () => {
    const byExecution = holeRecord({
      par: 4,
      score: 6,
      putts: 2,
      shots: [shot({ result: "LEFT_ROUGH" }), shot({ shotNumber: 2, result: "BUNKER" })],
    });
    const byDecision = holeRecord({
      par: 4,
      score: 6,
      putts: 2,
      penalties: 1,
      shots: [
        shot({
          result: "WATER",
          penalty: 1,
          followedRecommendation: false,
          recommendedClub: "Mini Driver",
          selectedClub: "Driver",
        }),
      ],
    });

    const e1 = evaluateHole(byExecution).find((e) => e.key === "DOUBLE_PLUS");
    const e2 = evaluateHole(byDecision).find((e) => e.key === "DOUBLE_PLUS");
    expect(e1?.cause).toBe("EXECUTION");
    expect(e2?.cause).toBe("DECISION");
  });

  it("detects a three putt", () => {
    const h = holeRecord({ putts: 3, score: 5 });
    expect(evaluateHole(h).map((e) => e.key)).toContain("THREE_PUTT");
  });

  it("detects a double short game", () => {
    const h = holeRecord({
      score: 6,
      putts: 2,
      shots: [
        shot({ shotNumber: 3, distanceToGreen: 30, result: "SHORT", lie: "FAIRWAY" }),
        shot({ shotNumber: 4, distanceToGreen: 12, result: "GREEN", lie: "LIGHT_ROUGH" }),
      ],
    });
    expect(evaluateHole(h).map((e) => e.key)).toContain("DOUBLE_SHORT_GAME");
  });

  it("flags a bad decision inside 150 only when the plan was ignored", () => {
    const ignoredPlan = holeRecord({
      score: 6,
      putts: 2,
      shots: [
        shot({
          distanceToGreen: 140,
          flagRisk: "RED",
          followedRecommendation: false,
          result: "WATER",
          penalty: 1,
        }),
      ],
    });
    const followedPlan = holeRecord({
      score: 6,
      putts: 2,
      shots: [
        shot({ distanceToGreen: 140, flagRisk: "RED", followedRecommendation: true, result: "BUNKER" }),
      ],
    });
    expect(evaluateHole(ignoredPlan).map((e) => e.key)).toContain("BAD_DECISION_INSIDE_150");
    expect(evaluateHole(followedPlan).map((e) => e.key)).not.toContain("BAD_DECISION_INSIDE_150");
  });

  it("does not punish a miss that came from a good decision", () => {
    const h = holeRecord({
      par: 4,
      score: 4,
      putts: 2,
      shots: [shot({ result: "LEFT_ROUGH", followedRecommendation: true, correctMiss: true })],
    });
    expect(isCleanHole(h)).toBe(true);
  });

  it("tallies a full round", () => {
    const r = round([
      holeRecord({ holeNumber: 1, score: 4, putts: 2 }),
      holeRecord({ holeNumber: 2, score: 7, putts: 3, penalties: 1, shots: [shot({ result: "WATER", penalty: 1 })] }),
    ]);
    const { tally } = evaluateRound(r);
    expect(tally.PENALTY).toBe(1);
    expect(tally.THREE_PUTT).toBe(1);
    expect(tally.DOUBLE_PLUS).toBe(1);
    expect(totalEvents(tally)).toBeGreaterThanOrEqual(3);
  });
});
