import { describe, expect, it } from "vitest";
import { lagQuality, puttPlan } from "@/lib/putting-engine";

describe("putting caddie — objectives by steps", () => {
  it("1 step: make it", () => {
    expect(puttPlan(1).objective).toBe("MAKE");
    expect(puttPlan(1).message).toContain("Firm");
  });

  it("2 steps: commit, but a miss is acceptable", () => {
    const p = puttPlan(2);
    expect(p.objective).toBe("MAKE_ACCEPT_MISS");
    expect(p.message.toLowerCase()).toContain("can miss");
  });

  it("3-4 steps: try to hole, control speed", () => {
    expect(puttPlan(3).objective).toBe("TRY_TO_HOLE");
    expect(puttPlan(4).objective).toBe("TRY_TO_HOLE");
    expect(puttPlan(4).finishTarget).toContain("3–4 ft");
  });

  it("5-10 steps: two putt", () => {
    expect(puttPlan(5).objective).toBe("TWO_PUTT");
    expect(puttPlan(10).objective).toBe("TWO_PUTT");
  });

  it("over 10 steps: lag", () => {
    expect(puttPlan(15).objective).toBe("LAG");
    expect(puttPlan(20).message).toBe("Leave it dead.");
  });

  it("never promises a make from long range", () => {
    for (const s of [5, 8, 10, 15, 20]) {
      expect(puttPlan(s).objectiveLabel).not.toBe("MAKE");
    }
  });

  it("expected putts grow with distance", () => {
    expect(puttPlan(1).expectedPutts).toBeLessThan(puttPlan(5).expectedPutts);
    expect(puttPlan(5).expectedPutts).toBeLessThan(puttPlan(20).expectedPutts);
  });

  it("rates a lag by what it leaves, not by holing it", () => {
    expect(lagQuality(15, "1_STEP")).toBe("GOOD");
    expect(lagQuality(15, "3_PLUS_STEPS")).toBe("POOR");
    expect(lagQuality(2, "2_STEPS")).toBe("POOR");
  });
});
