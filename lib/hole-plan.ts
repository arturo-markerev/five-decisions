import type {
  FlagPosition,
  Hazard,
  Hole,
  HoleClubLearning,
  PlayerProfile,
  RiskLevel,
  TigerFiveKey,
} from "@/types/golf";
import { recommendShot } from "@/lib/decision-engine";

/**
 * HOLE PLAN — el plan completo del hoyo ANTES de pegar el primer golpe.
 *
 * Junta las dos mitades del sistema en una sola pantalla:
 *   FIVE DECISIONS  = la regla que manda en ESTE hoyo (estrategia, antes)
 *   TIGER FIVE H18  = el error que hay que no cometer aca (control, despues)
 *
 * Y le pone numero al hoyo: para un handicap 18 el numero es BOGEY.
 * Par es upside. Doble es lo que rompe la ronda.
 */

export type DecisionRule = 1 | 2 | 3 | 4 | 5;

export const FIVE_DECISIONS: Record<DecisionRule, string> = {
  1: "KEEP THE BALL IN PLAY",
  2: "RESPECT RISK",
  3: "PLAY YOUR NUMBER",
  4: "MISS SMART",
  5: "AVOID BIG NUMBERS",
};

export interface PlanShot {
  label: string;
  club: string;
  target: string;
  detail: string;
  risk: RiskLevel;
}

export interface HolePlanResult {
  holeNumber: number;
  par: number;
  yardage: number;
  /** Para H18 el numero del hoyo es bogey: recibimos un golpe en los 18. */
  yourNumber: number;
  yourNumberLabel: string;
  upsideLabel: string;
  avoidLabel: string;
  tee: PlanShot;
  approach: PlanShot | null;
  danger: string;
  rule: DecisionRule;
  ruleName: string;
  ruleWhy: string;
  tigerFive: TigerFiveKey[];
  caddieLine: string;
  hasFairwayGeometry: boolean;
}

const SEVERITY_RANK: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, EXTREME: 4 };

function sideWord(side: string): string {
  switch (side) {
    case "LEFT":
      return "left";
    case "RIGHT":
      return "right";
    case "SHORT":
      return "short";
    case "LONG":
      return "long";
    case "CROSS":
      return "across the hole";
    default:
      return "in play";
  }
}

function typeWord(type: string): string {
  switch (type) {
    case "WATER":
      return "Water";
    case "PENALTY":
      return "Penalty area";
    case "OB":
      return "OB";
    case "BUNKER":
      return "Bunker";
    case "TREES":
      return "Trees";
    default:
      return "Trouble";
  }
}

/** El peor peligro del hoyo, dicho en una linea. */
function worstDanger(hole: Hole): { text: string; hazard: Hazard | null; penalty: boolean } {
  const corridor = [...hole.hazards].sort(
    (a, b) =>
      SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.penaltyCost - a.penaltyCost,
  );
  if (corridor.length > 0) {
    const h = corridor[0];
    const where =
      h.side === "CROSS"
        ? `from ${h.startDistanceFromTee} to ${h.endDistanceFromTee} yd, all the way across`
        : `${sideWord(h.side)} from ${h.startDistanceFromTee} to ${h.endDistanceFromTee} yd`;
    return { text: `${typeWord(h.type)} ${where}`, hazard: h, penalty: h.penaltyCost > 0 };
  }

  const greenside = [...hole.greensideHazards].sort(
    (a, b) =>
      SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.penaltyCost - a.penaltyCost,
  );
  if (greenside.length > 0) {
    const g = greenside[0];
    return {
      text: `${typeWord(g.type)} ${sideWord(g.side)} of the green`,
      hazard: null,
      penalty: g.penaltyCost > 0,
    };
  }
  return { text: "Nothing that costs you a penalty stroke", hazard: null, penalty: false };
}

export interface HolePlanInput {
  profile: PlayerProfile;
  hole: Hole;
  flagPosition: FlagPosition;
  holeHistory?: HoleClubLearning[];
}

export function buildHolePlan(input: HolePlanInput): HolePlanResult {
  const { profile, hole, flagPosition, holeHistory } = input;

  const teeRec = recommendShot({
    profile,
    hole,
    shotNumber: 1,
    lie: "TEE",
    distanceToGreen: hole.whiteTeeYardage,
    flagPosition,
    holeHistory,
  });

  const isPar3 = hole.par === 3;

  const tee: PlanShot = {
    label: isPar3 ? "The shot" : "Off the tee",
    club: teeRec.recommendedClub,
    target: teeRec.target,
    detail: isPar3
      ? `${hole.whiteTeeYardage} yd. Safe miss: ${teeRec.safeMiss.toLowerCase()}.`
      : `Leaves about ${teeRec.expectedRemainingDistance} yd. Safe miss: ${teeRec.safeMiss.toLowerCase()}.`,
    risk: teeRec.riskLevel,
  };

  let approach: PlanShot | null = null;
  let approachRec: ReturnType<typeof recommendShot> | null = null;

  if (!isPar3 && teeRec.expectedRemainingDistance > 15) {
    approachRec = recommendShot({
      profile,
      hole,
      shotNumber: 2,
      lie: "FAIRWAY",
      distanceToGreen: teeRec.expectedRemainingDistance,
      flagPosition,
      holeHistory,
    });
    approach = {
      label: `Approach from ~${teeRec.expectedRemainingDistance} yd`,
      club: approachRec.recommendedClub,
      target: approachRec.target,
      detail: `Safe miss: ${approachRec.safeMiss.toLowerCase()}. Avoid: ${approachRec.dangerMiss.toLowerCase()}.`,
      risk: approachRec.riskLevel,
    };
  }

  const danger = worstDanger(hole);
  const hasFairwayGeometry = hole.hazards.length > 0;

  // Que regla manda en este hoyo. Una sola: el jugador tiene que salir con UNA idea.
  let rule: DecisionRule;
  let ruleWhy: string;

  const aggressiveExposure = Math.max(
    teeRec.penaltyProbability,
    ...teeRec.alternatives.map((a) => a.penaltyExposure),
    0,
  );

  if (hole.forcedCarry != null && hole.forcedCarry > 0) {
    rule = 1;
    ruleWhy = `You have to carry ${hole.forcedCarry} yd before anything else matters. Take the club that clears it on a normal strike, not on your best one.`;
  } else if (danger.penalty && aggressiveExposure >= 0.06) {
    rule = 2;
    ruleWhy = `The long play brings a penalty into your pattern here. The distance it buys does not pay for that.`;
  } else if (teeRec.flagRisk === "RED" || (approachRec && approachRec.flagRisk === "RED")) {
    rule = 4;
    ruleWhy = `The pin has an expensive side. Aim off it and let a good miss be a good miss.`;
  } else if (danger.penalty) {
    rule = 5;
    ruleWhy = `There is a penalty on this hole. One swing at it turns a bogey into a seven.`;
  } else {
    rule = 3;
    ruleWhy = `Nothing here costs you a stroke. Hit your number and take what the hole gives.`;
  }

  const tigerFive: TigerFiveKey[] = [];
  for (const k of teeRec.tigerFiveRisk) if (!tigerFive.includes(k)) tigerFive.push(k);
  if (approachRec) {
    for (const k of approachRec.tigerFiveRisk) if (!tigerFive.includes(k)) tigerFive.push(k);
  }

  const yourNumber = hole.par + 1;

  return {
    holeNumber: hole.holeNumber,
    par: hole.par,
    yardage: hole.whiteTeeYardage,
    yourNumber,
    yourNumberLabel: `BOGEY ${yourNumber}`,
    upsideLabel: `PAR ${hole.par}`,
    avoidLabel: `${hole.par + 2} OR WORSE`,
    tee,
    approach,
    danger: danger.text,
    rule,
    ruleName: FIVE_DECISIONS[rule],
    ruleWhy,
    tigerFive,
    caddieLine: teeRec.caddieLine,
    hasFairwayGeometry,
  };
}
