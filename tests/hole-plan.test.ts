import { describe, expect, it } from "vitest";
import { buildHolePlan, FIVE_DECISIONS } from "@/lib/hole-plan";
import type { Course, Hole } from "@/types/golf";
import campanario from "@/data/courses/campanario.json";
import { profile } from "./helpers";

const COURSE = campanario as unknown as Course;
function hole(n: number): Hole {
  const h = COURSE.holes.find((x) => x.holeNumber === n);
  if (!h) throw new Error(`hole ${n} missing`);
  return h;
}

describe("hole plan — el numero del hoyo para un H18", () => {
  it("juega para bogey, no para par", () => {
    const plan = buildHolePlan({ profile: profile(), hole: hole(10), flagPosition: "MIDDLE_CENTER" });
    expect(plan.yourNumber).toBe(hole(10).par + 1);
    expect(plan.yourNumberLabel).toContain("BOGEY");
    expect(plan.upsideLabel).toContain("PAR");
    expect(plan.avoidLabel).toContain(String(hole(10).par + 2));
  });
});

describe("hole plan — una sola regla por hoyo", () => {
  it("elige RESPECT RISK cuando el palo largo mete agua en el patron", () => {
    // Hoyo 10: agua por la derecha desde 211 yd.
    const plan = buildHolePlan({ profile: profile(), hole: hole(10), flagPosition: "MIDDLE_CENTER" });
    expect([2, 5]).toContain(plan.rule);
    expect(plan.danger.toLowerCase()).toContain("water");
    expect(plan.tigerFive).toContain("PENALTY");
  });

  it("elige KEEP THE BALL IN PLAY cuando hay carry forzado", () => {
    // Hoyo 15: par 3 sobre el agua, carry 111 yd.
    const plan = buildHolePlan({ profile: profile(), hole: hole(15), flagPosition: "MIDDLE_CENTER" });
    expect(plan.rule).toBe(1);
    expect(plan.ruleName).toBe(FIVE_DECISIONS[1]);
    expect(plan.ruleWhy).toContain("111");
  });

  it("no inventa drama donde no hay penalidad", () => {
    // Hoyo 8: solo bunkers de green cargados, sin agua.
    const plan = buildHolePlan({ profile: profile(), hole: hole(8), flagPosition: "MIDDLE_CENTER" });
    expect(plan.rule).toBe(3);
    expect(plan.ruleName).toBe("PLAY YOUR NUMBER");
  });

  it("siempre devuelve exactamente una regla valida", () => {
    for (const h of COURSE.holes) {
      const plan = buildHolePlan({ profile: profile(), hole: h, flagPosition: "MIDDLE_CENTER" });
      expect([1, 2, 3, 4, 5]).toContain(plan.rule);
      expect(plan.ruleName).toBe(FIVE_DECISIONS[plan.rule]);
      expect(plan.caddieLine.length).toBeGreaterThan(0);
    }
  });
});

describe("hole plan — estructura del golpe", () => {
  it("en par 3 no arma approach separado", () => {
    const plan = buildHolePlan({ profile: profile(), hole: hole(15), flagPosition: "MIDDLE_CENTER" });
    expect(plan.approach).toBeNull();
    expect(plan.tee.label).toBe("The shot");
  });

  it("en par 4 arma tee y approach", () => {
    const plan = buildHolePlan({ profile: profile(), hole: hole(13), flagPosition: "MIDDLE_CENTER" });
    expect(plan.approach).not.toBeNull();
    expect(plan.tee.label).toBe("Off the tee");
    expect(plan.approach!.label).toContain("Approach from");
  });

  it("avisa cuando el hoyo no tiene geometria de calle cargada", () => {
    const conGeometria = buildHolePlan({ profile: profile(), hole: hole(10), flagPosition: "MIDDLE_CENTER" });
    const sinGeometria = buildHolePlan({ profile: profile(), hole: hole(8), flagPosition: "MIDDLE_CENTER" });
    expect(conGeometria.hasFairwayGeometry).toBe(true);
    expect(sinGeometria.hasFairwayGeometry).toBe(false);
  });
});
