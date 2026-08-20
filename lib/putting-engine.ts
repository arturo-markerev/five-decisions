import type { PuttResult } from "@/types/golf";
import { puttsExpected, stepsToFeet } from "@/lib/distance-engine";

/**
 * PUTTING CADDIE — expectativas realistas para H18.
 * Nunca decimos "you should make this" desde 2 m o mas.
 * Objetivo estructural: minimizar 3-putts, no fingir que embocamos todo.
 */

export type PuttObjective =
  | "MAKE"
  | "MAKE_ACCEPT_MISS"
  | "TRY_TO_HOLE"
  | "TWO_PUTT"
  | "LAG";

export interface PuttPlan {
  steps: number;
  objective: PuttObjective;
  objectiveLabel: string;
  message: string;
  /** zona objetivo para el primer putt */
  finishTarget: string;
  expectedPutts: number;
}

export const PUTT_STEP_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20];

export function puttPlan(steps: number): PuttPlan {
  const s = Math.max(0.5, steps);
  const expected = puttsExpected(stepsToFeet(s));

  if (s <= 1) {
    return {
      steps,
      objective: "MAKE",
      objectiveLabel: "MAKE",
      message: "Firm, committed stroke.",
      finishTarget: "Past the hole",
      expectedPutts: expected,
    };
  }
  if (s <= 2) {
    return {
      steps,
      objective: "MAKE_ACCEPT_MISS",
      objectiveLabel: "MAKE / ACCEPT MISS",
      message: "Commit to line. Good putts can miss.",
      finishTarget: "Inside 1 step",
      expectedPutts: expected,
    };
  }
  if (s <= 4) {
    return {
      steps,
      objective: "TRY_TO_HOLE",
      objectiveLabel: "TRY TO HOLE, CONTROL SPEED",
      message: "Pick the line. Finish close.",
      finishTarget: "Finish inside 3–4 ft",
      expectedPutts: expected,
    };
  }
  if (s <= 10) {
    return {
      steps,
      objective: "TWO_PUTT",
      objectiveLabel: "TWO PUTT",
      message: "Give it a chance, but control speed.",
      finishTarget: "Finish inside 1 step",
      expectedPutts: expected,
    };
  }
  return {
    steps,
    objective: "LAG",
    objectiveLabel: "LAG",
    message: "Leave it dead.",
    finishTarget: "Finish inside 2 steps",
    expectedPutts: expected,
  };
}

/**
 * Seccion 35: en putts largos NO usamos "un putt corto nunca entra".
 * Centramos la dispersion en el hoyo para no sobreacelerar.
 */
export const LONG_PUTT_PHILOSOPHY =
  "Center your speed on the hole, not past it. A few short is fine — three-putts are not.";

export function puttResultLabel(r: PuttResult): string {
  switch (r) {
    case "HOLED":
      return "Holed";
    case "UNDER_1_STEP":
      return "< 1 step";
    case "1_STEP":
      return "1 step";
    case "2_STEPS":
      return "2 steps";
    case "3_PLUS_STEPS":
      return "3+ steps";
  }
}

/** Un lag es "bueno" si deja tap-in razonable. */
export function lagQuality(steps: number, result: PuttResult): "GOOD" | "OK" | "POOR" {
  if (result === "HOLED") return "GOOD";
  if (steps <= 4) {
    return result === "UNDER_1_STEP" ? "GOOD" : result === "1_STEP" ? "OK" : "POOR";
  }
  if (result === "UNDER_1_STEP" || result === "1_STEP") return "GOOD";
  if (result === "2_STEPS") return "OK";
  return "POOR";
}
