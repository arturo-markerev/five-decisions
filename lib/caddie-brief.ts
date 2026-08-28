import type {
  FlagPosition,
  Hole,
  Lie,
  PlayerProfile,
  RiskLevel,
  TigerFiveKey,
} from "@/types/golf";
import { recommendShot } from "@/lib/decision-engine";
import { buildHolePlan, type DecisionRule } from "@/lib/hole-plan";

/**
 * CADDIE BRIEFING — el hoyo entero en un solo scroll, sin jugar nada.
 *
 * El jugador lleva el score en TheGrint. Aca no se registra ni un golpe:
 * se para en el tee, baja una vez, y sale con todo el hoyo en la cabeza.
 *
 * Por eso el briefing muestra la cadena COMPLETA de golpes, no solo el
 * primero: que se pega del tee, que queda, que se pega despues, y con que
 * se llega al green.
 */

export interface BriefShot {
  number: number;
  title: string;
  fromYards: number;
  fromLie: Lie;
  club: string;
  target: string;
  leaves: string;
  safeMiss: string;
  avoid: string;
  risk: RiskLevel;
  caddieLine: string;
}

export interface BriefHazard {
  text: string;
  costsAStroke: boolean;
  /** yardas desde el tee a las que aparece; null si es junto al green */
  atYards: number | null;
}

export interface CaddieBrief {
  holeNumber: number;
  par: number;
  yardage: number;
  handicapIndex: number;
  dataQuality: string;

  playFor: string;
  upside: string;
  breaks: string;

  /** Todo lo que tiene el hoyo, en orden de aparicion. */
  hazards: BriefHazard[];
  forcedCarry: number | null;

  shots: BriefShot[];

  greenNotes: string[];

  rule: DecisionRule;
  ruleName: string;
  ruleWhy: string;
  tigerFive: TigerFiveKey[];
  caddieLine: string;

  hasFairwayGeometry: boolean;
  strategicNotes: string;
}

function typeWord(t: string): string {
  switch (t) {
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
    case "RECOVERY":
      return "Recovery area";
    default:
      return "Trouble";
  }
}

function sideWord(s: string): string {
  switch (s) {
    case "LEFT":
      return "left";
    case "RIGHT":
      return "right";
    case "BOTH":
      return "both sides";
    case "CROSS":
      return "across the hole";
    case "SHORT":
      return "short";
    case "LONG":
      return "long";
    default:
      return "center";
  }
}

/** Todo lo que tiene el hoyo, ordenado por donde aparece caminando. */
function hazardInventory(hole: Hole): BriefHazard[] {
  const out: BriefHazard[] = [];

  for (const h of hole.hazards) {
    const reachesGreen = h.endDistanceFromTee >= hole.whiteTeeYardage - 20;
    const span = reachesGreen
      ? `from ${h.startDistanceFromTee} yd all the way to the green`
      : `from ${h.startDistanceFromTee} to ${h.endDistanceFromTee} yd`;
    out.push({
      text: `${typeWord(h.type)} ${sideWord(h.side)}, ${span}`,
      costsAStroke: h.penaltyCost > 0,
      atYards: h.startDistanceFromTee,
    });
  }

  for (const g of hole.greensideHazards) {
    out.push({
      text: `${typeWord(g.type)} ${sideWord(g.side)} of the green`,
      costsAStroke: g.penaltyCost > 0,
      atYards: null,
    });
  }

  out.sort((a, b) => {
    if (a.atYards == null) return 1;
    if (b.atYards == null) return -1;
    return a.atYards - b.atYards;
  });
  return out;
}

function greenNotes(hole: Hole): string[] {
  const notes: string[] = [];
  notes.push(`Green runs about ${hole.greenWidth} yd wide and ${hole.greenDepth} yd deep.`);
  if (hole.greenBadSide !== "NONE") {
    notes.push(`The expensive miss is ${sideWord(hole.greenBadSide)}.`);
  }
  if (hole.greenSafeSide !== "NONE" && hole.greenSafeSide !== hole.greenBadSide) {
    notes.push(`${sideWord(hole.greenSafeSide).replace(/^./, (c) => c.toUpperCase())} is the playable side.`);
  }
  if (hole.greensideHazards.length === 0) {
    notes.push("Nothing loaded around this green yet.");
  }
  return notes;
}

const MAX_SHOTS = 5;

export interface CaddieBriefInput {
  profile: PlayerProfile;
  hole: Hole;
  flagPosition: FlagPosition;
}

export function buildCaddieBrief(input: CaddieBriefInput): CaddieBrief {
  const { profile, hole, flagPosition } = input;
  const plan = buildHolePlan({ profile, hole, flagPosition });

  const shots: BriefShot[] = [];
  let distance = hole.whiteTeeYardage;
  let lie: Lie = "TEE";

  for (let n = 1; n <= MAX_SHOTS; n++) {
    const rec = recommendShot({
      profile,
      hole,
      shotNumber: n,
      lie,
      distanceToGreen: distance,
      flagPosition,
    });

    const reachesGreen = rec.expectedRemainingDistance <= 20;
    const title =
      n === 1
        ? hole.par === 3
          ? "Tee shot"
          : "Off the tee"
        : reachesGreen
          ? `Into the green from ~${Math.round(distance)} yd`
          : `Next one from ~${Math.round(distance)} yd`;

    shots.push({
      number: n,
      title,
      fromYards: Math.round(distance),
      fromLie: lie,
      club: rec.recommendedClub,
      target: rec.target,
      leaves: reachesGreen
        ? "Should be on or around the green"
        : `Leaves about ${rec.expectedRemainingDistance} yd`,
      safeMiss: rec.safeMiss,
      avoid: rec.dangerMiss,
      risk: rec.riskLevel,
      caddieLine: rec.caddieLine,
    });

    if (reachesGreen) break;
    // Sin progreso: cortamos en vez de repetir el mismo golpe para siempre.
    if (rec.expectedRemainingDistance >= distance - 5) break;

    distance = rec.expectedRemainingDistance;
    lie = "FAIRWAY";
  }

  return {
    holeNumber: hole.holeNumber,
    par: hole.par,
    yardage: hole.whiteTeeYardage,
    handicapIndex: hole.handicapIndex,
    dataQuality: hole.dataQuality,

    playFor: plan.yourNumberLabel,
    upside: plan.upsideLabel,
    breaks: plan.avoidLabel,

    hazards: hazardInventory(hole),
    forcedCarry: hole.forcedCarry,

    shots,
    greenNotes: greenNotes(hole),

    rule: plan.rule,
    ruleName: plan.ruleName,
    ruleWhy: plan.ruleWhy,
    tigerFive: plan.tigerFive,
    caddieLine: plan.caddieLine,

    hasFairwayGeometry: plan.hasFairwayGeometry,
    strategicNotes: hole.strategicNotes,
  };
}
