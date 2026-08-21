import type {
  Club,
  Confidence,
  DecisionAlternative,
  FlagPosition,
  GreenSide,
  Hole,
  HoleClubLearning,
  Lie,
  PlayCategory,
  PlayerProfile,
  Recommendation,
  RiskLevel,
  ShotIntent,
  TigerFiveKey,
} from "@/types/golf";
import {
  LIE_DISPERSION_FACTOR,
  LIE_DISTANCE_FACTOR,
  buildDispersion,
  patternWidth,
} from "@/lib/dispersion-engine";
import { costBand, expectedStrokes } from "@/lib/distance-engine";
import {
  classifyLanding,
  effectivePenalty,
  findHazard,
  flagGeometry,
  flagRisk,
  greensideBySide,
  riskFromPenaltyProbability,
} from "@/lib/risk-engine";

/**
 * MOTOR DE DECISION V1 — determinista, offline, sin IA externa.
 *
 * La pregunta NO es "que palo llega".
 * La pregunta es: "que golpe produce el score esperado mas bajo PARA ESTE jugador".
 *
 * Reglas duras:
 *  - Se planifica con planningDistance, jamas con goodStrikeDistance.
 *  - Se evalua TODO el patron de dispersion, no el centro.
 *  - No se es conservador ni agresivo por default: se optimiza.
 */

export interface DecisionInput {
  profile: PlayerProfile;
  hole: Hole;
  shotNumber: number;
  lie: Lie;
  /** yardas a la bandera (laser tiene prioridad) o al centro si no hay bandera */
  distanceToGreen: number;
  flagPosition: FlagPosition;
  /** historial de este hoyo, si existe */
  holeHistory?: HoleClubLearning[];
}

interface OptionResult {
  club: Club;
  aimOffset: number;
  aimDistance: number;
  cost: number;
  penaltyProbability: number;
  fairwayProbability: number;
  greenProbability: number;
  expectedRemaining: number;
  worstSide: "LEFT" | "RIGHT" | "SHORT" | "LONG" | "NONE";
  bestSide: "LEFT" | "RIGHT" | "SHORT" | "LONG" | "NONE";
  isApproach: boolean;
}

/**
 * AVERSION A LA PENALIDAD.
 *
 * El costo esperado puro trata una penalidad como "+1 golpe promedio". Para un
 * H18 casi nunca cuesta 1: cuesta el golpe, cuesta la posicion, y cuesta el
 * doble que viene detras. Por eso dos opciones con el MISMO costo esperado no
 * son la misma decision si una mete el 9% del patron en el agua.
 *
 * Este termino rompe esos empates siempre hacia el lado sin penalidad. Es la
 * GOLDEN RULE dentro de la funcion de costo, no solo en el texto que se muestra.
 */
const PENALTY_AVERSION = 1.1;

const CORRIDOR_AIMS = [-22, -14, -7, 0, 7, 14, 22];
const APPROACH_AIMS = [-14, -10, -6, -3, 0, 3, 6, 10, 14];
const APPROACH_DEPTHS = [-7, -3, 0];


type Side = "LEFT" | "RIGHT" | "SHORT" | "LONG" | "NONE";

/**
 * LADO CARO / LADO JUGABLE.
 *
 * El miss caro es una propiedad del HOYO, no de la punteria. Si el agua esta a
 * la izquierda, la izquierda sigue siendo el miss que mata aunque ya estemos
 * apuntando a la derecha para evitarla — de hecho por eso apuntamos ahi.
 * Calcular esto sobre el patron ya desplazado invertia el consejo: "safe miss
 * derecha" con el agua a la izquierda es como se firma un doble.
 *
 * Se sondea el hoyo a la distancia planeada, con misses del tamano real de la
 * dispersion del palo.
 */
const MISS_PROBES = [
  { magnitude: 0.5, weight: 0.35 },
  { magnitude: 0.8, weight: 0.4 },
  { magnitude: 1, weight: 0.25 },
];

function corridorSides(
  hole: Hole,
  club: Club,
  lie: Lie,
  distanceFromTee: number,
): { worst: Side; best: Side } {
  const carry = club.planningDistance * LIE_DISTANCE_FACTOR[lie];
  const dft = distanceFromTee + carry;
  const dispFactor = LIE_DISPERSION_FACTOR[lie];

  const sideCost = (dispersion: number, sign: -1 | 1): number => {
    let acc = 0;
    for (const probe of MISS_PROBES) {
      const lateral = sign * dispersion * dispFactor * probe.magnitude;
      const out = classifyLanding(hole, dft, lateral);
      acc += (1 + out.penalty + expectedStrokes(out.remainingDistance, out.lie)) * probe.weight;
    }
    return acc;
  };

  const left = sideCost(club.leftDispersionYards, -1);
  const right = sideCost(club.rightDispersionYards, 1);
  const diff = right - left;
  if (Math.abs(diff) < 0.05) return { worst: "NONE", best: "NONE" };
  return diff > 0 ? { worst: "RIGHT", best: "LEFT" } : { worst: "LEFT", best: "RIGHT" };
}

function playableClubs(profile: PlayerProfile): Club[] {
  return profile.clubs.filter((c) => c.enabled && c.category !== "PUTTER" && c.planningDistance > 0);
}

/* ------------------------------------------------------------------ */
/* Evaluacion corridor (tee shot / avance)                             */
/* ------------------------------------------------------------------ */

function evaluateCorridor(
  hole: Hole,
  club: Club,
  lie: Lie,
  distanceFromTee: number,
  aimOffset: number,
): OptionResult {
  const samples = buildDispersion(club, { lie, aimOffset });
  let cost = 0;
  let penaltyProb = 0;
  let fairwayProb = 0;
  let remaining = 0;

  for (const s of samples) {
    const dft = distanceFromTee + s.carry;
    const outcome = classifyLanding(hole, dft, s.lateral);
    const c = 1 + outcome.penalty + expectedStrokes(outcome.remainingDistance, outcome.lie);
    cost += c * s.weight;
    remaining += outcome.remainingDistance * s.weight;
    if (outcome.penalty > 0) penaltyProb += s.weight;
    if (outcome.lie === "FAIRWAY" || outcome.lie === "GREEN") fairwayProb += s.weight;
  }

  const sides = corridorSides(hole, club, lie, distanceFromTee);

  return {
    club,
    aimOffset,
    aimDistance: club.planningDistance,
    // penaltyProbability se reporta crudo; la aversion solo entra al comparar.
    cost: cost + PENALTY_AVERSION * penaltyProb,
    penaltyProbability: penaltyProb,
    fairwayProbability: fairwayProb,
    greenProbability: 0,
    expectedRemaining: remaining,
    worstSide: sides.worst,
    bestSide: sides.best,
    isApproach: false,
  };
}

/* ------------------------------------------------------------------ */
/* Evaluacion approach (al green)                                      */
/* ------------------------------------------------------------------ */


interface GreenPoint {
  side: Side;
  onGreen: boolean;
  penalty: number;
  distToFlag: number;
  cost: number;
}

/** Se deriva de greensideBySide para no repetir la forma en dos lados. */
type GreensideMap = ReturnType<typeof greensideBySide>;

/**
 * Clasifica UN punto alrededor del green y le pone precio.
 * Lo usan tanto el patron de dispersion como la sonda de lados, para que el
 * "safe miss" que se muestra y el costo que se optimiza hablen del mismo green.
 *
 * lateralPos / depthPos van respecto del CENTRO del green (+ = derecha / atras).
 */
function classifyGreenPoint(
  hole: Hole,
  geo: { lateral: number; depth: number },
  sides: GreensideMap,
  ballFromTee: number,
  centerDistance: number,
  lateralPos: number,
  depthPos: number,
): GreenPoint {
  const halfW = hole.greenWidth / 2;
  const halfD = hole.greenDepth / 2;
  const onGreen = Math.abs(lateralPos) <= halfW && Math.abs(depthPos) <= halfD;

  let side: Side = "NONE";
  if (!onGreen) {
    const exLat = Math.abs(lateralPos) - halfW;
    const exDep = Math.abs(depthPos) - halfD;
    if (exLat >= exDep) side = lateralPos < 0 ? "LEFT" : "RIGHT";
    else side = depthPos < 0 ? "SHORT" : "LONG";
  }

  // Hazard del corridor primero (agua corta, OB largo, etc.)
  const dft = ballFromTee + centerDistance + depthPos;
  const hz = findHazard(hole, dft, lateralPos);

  let lieOut: Lie;
  let penalty = 0;

  if (hz && !onGreen) {
    penalty = effectivePenalty(hz);
    lieOut =
      hz.type === "BUNKER"
        ? "BUNKER"
        : hz.type === "TREES"
          ? "TREES"
          : hz.type === "RECOVERY"
            ? "RECOVERY"
            : "LIGHT_ROUGH";
  } else if (onGreen) {
    lieOut = "GREEN";
  } else {
    const g = side !== "NONE" ? sides[side] : null;
    const excess = Math.max(Math.abs(lateralPos) - halfW, Math.abs(depthPos) - halfD);
    if (g && g.penalty > 0) {
      // Agua / OB: se dropea. El costo real vive en el penalty, no en el lie.
      penalty = g.penalty;
      lieOut = "LIGHT_ROUGH";
    } else if (g) {
      // El TIPO manda sobre la severidad. Antes un bunker "MEDIUM" se modelaba
      // como light rough, o sea cargar bunkers no cambiaba ni una decision.
      // Para un H18 la arena de green no es rough: es medio golpe.
      lieOut =
        g.type === "BUNKER"
          ? "BUNKER"
          : g.type === "TREES"
            ? "TREES"
            : g.type === "RECOVERY"
              ? "RECOVERY"
              : g.severity === "EXTREME" || g.severity === "HIGH"
                ? "HEAVY_ROUGH"
                : "LIGHT_ROUGH";
    } else {
      lieOut = excess <= 8 ? "LIGHT_ROUGH" : "HEAVY_ROUGH";
    }
  }

  const distToFlag = Math.max(
    onGreen ? 1 : 3,
    Math.hypot(lateralPos - geo.lateral, depthPos - geo.depth),
  );

  return {
    side,
    onGreen,
    penalty,
    distToFlag,
    cost: 1 + penalty + expectedStrokes(distToFlag, lieOut),
  };
}

/**
 * Que lado del green es el miss caro. Igual que en el corridor: es geometria
 * del hoyo, no de la punteria. Se sondea un miss justo afuera de cada borde.
 */
function greenSides(
  hole: Hole,
  geo: { lateral: number; depth: number },
  sides: GreensideMap,
  ballFromTee: number,
  centerDistance: number,
): { worst: Side; best: Side } {
  const halfW = hole.greenWidth / 2;
  const halfD = hole.greenDepth / 2;
  const OUT = 6;

  const probes: Array<{ side: GreenSide; lateral: number; depth: number }> = [
    { side: "LEFT", lateral: -(halfW + OUT), depth: geo.depth },
    { side: "RIGHT", lateral: halfW + OUT, depth: geo.depth },
    { side: "SHORT", lateral: geo.lateral, depth: -(halfD + OUT) },
    { side: "LONG", lateral: geo.lateral, depth: halfD + OUT },
  ];

  let worst: Side = "NONE";
  let best: Side = "NONE";
  let worstVal = -Infinity;
  let bestVal = Infinity;

  for (const probe of probes) {
    const pt = classifyGreenPoint(
      hole,
      geo,
      sides,
      ballFromTee,
      centerDistance,
      probe.lateral,
      probe.depth,
    );
    if (pt.cost > worstVal) {
      worstVal = pt.cost;
      worst = probe.side;
    }
    if (pt.cost < bestVal) {
      bestVal = pt.cost;
      best = probe.side;
    }
  }

  return { worst, best };
}

function evaluateApproach(
  hole: Hole,
  club: Club,
  lie: Lie,
  distanceToFlag: number,
  flag: FlagPosition,
  aimLateral: number,
  depthOffset: number,
): OptionResult {
  const geo = flagGeometry(hole, flag);
  const centerDistance = distanceToFlag - geo.depth; // yardas al centro del green
  const aimDistance = Math.max(20, distanceToFlag + depthOffset);
  const holeLength = hole.whiteTeeYardage;
  const ballFromTee = Math.max(0, holeLength - centerDistance);

  const samples = buildDispersion(club, { lie, aimOffset: 0, targetDistance: aimDistance });
  const sides = greensideBySide(hole);

  let cost = 0;
  let penaltyProb = 0;
  let greenProb = 0;
  let remaining = 0;

  for (const s of samples) {
    // Posicion respecto del CENTRO del green.
    const depthPos = s.carry - centerDistance;
    const lateralPos = geo.lateral + aimLateral + s.lateral;
    const pt = classifyGreenPoint(hole, geo, sides, ballFromTee, centerDistance, lateralPos, depthPos);

    cost += pt.cost * s.weight;
    remaining += pt.distToFlag * s.weight;
    if (pt.penalty > 0) penaltyProb += s.weight;
    if (pt.onGreen) greenProb += s.weight;
  }

  const { worst, best } = greenSides(hole, geo, sides, ballFromTee, centerDistance);

  return {
    club,
    aimOffset: aimLateral,
    aimDistance,
    cost: cost + PENALTY_AVERSION * penaltyProb,
    penaltyProbability: penaltyProb,
    fairwayProbability: 0,
    greenProbability: greenProb,
    expectedRemaining: remaining,
    worstSide: worst,
    bestSide: best,
    isApproach: true,
  };
}

/* ------------------------------------------------------------------ */
/* Ajustes                                                             */
/* ------------------------------------------------------------------ */

/** Incertidumbre del palo. Un palo sin calibrar merece un poco de castigo. */
function uncertaintyPenalty(club: Club): number {
  let p = 0;
  if (club.needsCalibration) p += 0.04;
  if (club.confidence === "LOW") p += 0.05;
  else if (club.confidence === "MEDIUM") p += 0.015;
  if (club.dispersionSource === "ESTIMATE") p += 0.01;
  return p;
}

/** Historial del hoyo. Solo pesa con muestra suficiente (seccion 48-49). */
function historyAdjustment(club: Club, history?: HoleClubLearning[]): number {
  if (!history) return 0;
  const h = history.find((x) => x.clubName === club.clubName);
  if (!h || h.shots === 0) return 0;
  if (h.band === "INSUFFICIENT") return 0;
  const weight = h.band === "EARLY" ? 0.25 : h.band === "USABLE" ? 0.6 : 1;
  const penaltyRate = h.penalties / h.shots;
  const fairwayRate = h.fairways / h.shots;
  return weight * (penaltyRate * 0.5 - fairwayRate * 0.12);
}

/* ------------------------------------------------------------------ */
/* Salida                                                              */
/* ------------------------------------------------------------------ */

function exposureWord(p: number): string {
  if (p < 0.03) return "practically no";
  if (p < 0.08) return "a small part of";
  if (p < 0.18) return "a meaningful part of";
  if (p < 0.35) return "a large part of";
  return "most of";
}

function offsetLabel(offset: number, isApproach: boolean): string {
  const a = Math.round(Math.abs(offset));
  if (a < 3) return isApproach ? "At the flag" : "Center";
  const dir = offset < 0 ? "LEFT" : "RIGHT";
  return isApproach ? `${a} yd ${dir} of flag` : `${a} yd ${dir} of center`;
}

function targetLabel(offset: number, isApproach: boolean): string {
  if (isApproach) {
    if (Math.abs(offset) < 3) return "Flag";
    return offset < 0 ? "Left of flag" : "Right of flag";
  }
  if (Math.abs(offset) < 3) return "Center";
  if (Math.abs(offset) < 12) return offset < 0 ? "Left-center" : "Right-center";
  return offset < 0 ? "Left side" : "Right side";
}

function sideText(side: OptionResult["worstSide"]): string {
  switch (side) {
    case "LEFT":
      return "Left";
    case "RIGHT":
      return "Right";
    case "SHORT":
      return "Short";
    case "LONG":
      return "Long";
    default:
      return "Center";
  }
}

function confidenceFor(hole: Hole, club: Club, history?: HoleClubLearning[]): Confidence {
  let score = 0;
  if (hole.dataQuality === "REAL") score += 2;
  else if (hole.dataQuality === "PARTIAL") score += 1;
  if (club.dispersionSource === "OBSERVED") score += 2;
  if (!club.needsCalibration) score += 1;
  const h = history?.find((x) => x.clubName === club.clubName);
  if (h && (h.band === "USABLE" || h.band === "RELIABLE")) score += 1;
  if (score >= 4) return "HIGH";
  if (score >= 2) return "MEDIUM";
  return "LOW";
}

/* ------------------------------------------------------------------ */
/* API principal                                                       */
/* ------------------------------------------------------------------ */

export function recommendShot(input: DecisionInput): Recommendation {
  const { profile, hole, lie, flagPosition } = input;
  const distance = Math.max(1, input.distanceToGreen);
  const clubs = playableClubs(profile);
  const isTee = input.shotNumber === 1;
  const distanceFromTee = Math.max(0, hole.whiteTeeYardage - distance);

  if (clubs.length === 0) {
    return emptyRecommendation("No clubs enabled. Load your distances in MY GAME.");
  }

  const inTrouble = lie === "TREES" || lie === "RECOVERY";
  const results: OptionResult[] = [];

  for (const club of clubs) {
    const reaches = club.planningDistance >= distance - 12;
    let best: OptionResult | null = null;

    if (reaches) {
      for (const aim of APPROACH_AIMS) {
        for (const depth of APPROACH_DEPTHS) {
          const r = evaluateApproach(hole, club, lie, distance, flagPosition, aim, depth);
          if (!best || r.cost < best.cost) best = r;
        }
      }
    } else {
      for (const aim of CORRIDOR_AIMS) {
        const r = evaluateCorridor(hole, club, lie, distanceFromTee, aim);
        if (!best || r.cost < best.cost) best = r;
      }
    }
    if (!best) continue;

    let cost = best.cost + uncertaintyPenalty(club) + historyAdjustment(club, input.holeHistory);

    // Desde arboles / recovery: probabilidad real de ejecucion.
    if (inTrouble) {
      const p = lie === "TREES" ? 0.5 : 0.4;
      const blocked = 1 + 0.4 + expectedStrokes(Math.max(30, distance - 15), "RECOVERY");
      cost = p * cost + (1 - p) * blocked;
    }

    results.push({ ...best, cost });
  }

  // Opcion PITCH OUT explicita cuando estoy en problemas.
  let pitchOut: OptionResult | null = null;
  if (inTrouble) {
    const advance = 35;
    const after = Math.max(20, distance - advance);
    const shortest = clubs.reduce((a, b) => (a.planningDistance < b.planningDistance ? a : b));
    pitchOut = {
      club: shortest,
      aimOffset: 0,
      aimDistance: advance,
      cost: 1 + expectedStrokes(after, "FAIRWAY") + 0.05,
      penaltyProbability: 0,
      fairwayProbability: 0.85,
      greenProbability: 0,
      expectedRemaining: after,
      worstSide: "NONE",
      bestSide: "NONE",
      isApproach: false,
    };
    results.push(pitchOut);
  }

  results.sort((a, b) => a.cost - b.cost);
  const best = results[0];
  const isPitchOut = pitchOut != null && best === pitchOut;

  // La alternativa "agresiva": el palo mas largo evaluado.
  const longest = results.reduce((a, b) =>
    a.club.planningDistance >= b.club.planningDistance ? a : b,
  );

  const dispHalf = patternWidth(best.club, lie) / 2;
  const fRisk = best.isApproach ? flagRisk(hole, flagPosition, dispHalf) : "GREEN";
  const strategyRisk = riskFromPenaltyProbability(best.penaltyProbability);

  const tigerFiveRisk: TigerFiveKey[] = [];
  if (best.penaltyProbability >= 0.05 || longest.penaltyProbability >= 0.12) tigerFiveRisk.push("PENALTY");
  if (distance <= 150 && fRisk === "RED") tigerFiveRisk.push("BAD_DECISION_INSIDE_150");
  if (inTrouble) tigerFiveRisk.push("DOUBLE_PLUS");
  if (distance <= 50 && !best.isApproach) tigerFiveRisk.push("DOUBLE_SHORT_GAME");

  const intent: ShotIntent = inTrouble
    ? "RECOVERY"
    : isTee
      ? "TEE_SHOT"
      : best.isApproach
        ? distance <= 50
          ? "SHORT_GAME"
          : "APPROACH"
        : hole.par === 5
          ? "LAYUP"
          : "ADVANCE";

  const playCategory: PlayCategory = isPitchOut
    ? "PITCH_OUT"
    : best.isApproach
      ? "GO_FOR_GREEN"
      : hole.par === 5 && !isTee
        ? longest.club.planningDistance >= distance - 12
          ? "LAYUP"
          : "ADVANCE"
        : "STANDARD";

  const safeMiss = isPitchOut
    ? "Anywhere in play"
    : best.isApproach
      ? `${sideText(best.bestSide)}`
      : best.bestSide === "NONE"
        ? "Either side of center"
        : `${sideText(best.bestSide)} side`;

  const dangerMiss = isPitchOut
    ? "Trying the hero shot"
    : best.isApproach
      ? `${sideText(best.worstSide)}`
      : best.worstSide === "NONE"
        ? "Long and offline"
        : `${sideText(best.worstSide)} side`;

  const rationale = buildRationale({
    best,
    longest,
    isPitchOut,
    inTrouble,
    flagRiskLevel: fRisk,
    distance,
    hole,
  });

  const caddieLine = buildCaddieLine({ best, isPitchOut, flagRiskLevel: fRisk, distance });

  const alternatives: DecisionAlternative[] = results
    .filter((r) => r !== best)
    .slice(0, 3)
    .map((r) => ({
      club: r === pitchOut ? "Pitch out" : r.club.clubName,
      label: r === pitchOut ? "Sideways, back in play" : offsetLabel(r.aimOffset, r.isApproach),
      estimatedCost: costBand(r.cost - best.cost),
      penaltyExposure: r.penaltyProbability,
      expectedRemainingDistance: Math.round(r.expectedRemaining),
      note:
        r.penaltyProbability > best.penaltyProbability + 0.04
          ? "More penalty exposure"
          : r.expectedRemaining < best.expectedRemaining - 15
            ? "Shorter next shot, higher variance"
            : "Similar outcome",
    }));

  return {
    recommendedClub: isPitchOut ? `${best.club.clubName} — PITCH OUT` : best.club.clubName,
    clubId: best.club.id,
    intent,
    playCategory,
    target: isPitchOut ? "Back to the fairway" : targetLabel(best.aimOffset, best.isApproach),
    targetOffset: Math.round(best.aimOffset),
    targetOffsetLabel: isPitchOut ? "Safest gap" : offsetLabel(best.aimOffset, best.isApproach),
    planningDistance: Math.round(best.isApproach ? best.aimDistance : best.club.planningDistance),
    expectedRemainingDistance: Math.round(best.expectedRemaining),
    safeMiss,
    dangerMiss,
    riskLevel: strategyRisk,
    flagRisk: fRisk,
    tigerFiveRisk,
    rationale,
    caddieLine,
    confidence: confidenceFor(hole, best.club, input.holeHistory),
    penaltyProbability: best.penaltyProbability,
    fairwayProbability: best.fairwayProbability,
    greenProbability: best.greenProbability,
    alternatives,
    debugScore: best.cost,
  };
}

function buildRationale(args: {
  best: OptionResult;
  longest: OptionResult;
  isPitchOut: boolean;
  inTrouble: boolean;
  flagRiskLevel: RiskLevel;
  distance: number;
  hole: Hole;
}): string {
  const { best, longest, isPitchOut, inTrouble, flagRiskLevel } = args;

  if (isPitchOut) {
    return "The aggressive line here is low percentage from this lie. Getting back to short grass keeps bogey alive and stops one bad shot from becoming two.";
  }

  if (inTrouble) {
    return `From this lie your strike is unreliable, so the plan is built around advancing safely rather than around your best case. ${best.club.clubName} keeps the next shot playable.`;
  }

  if (best.isApproach) {
    const parts: string[] = [];
    parts.push(
      `${best.club.clubName} to ${offsetLabel(best.aimOffset, true).toLowerCase()} centers your pattern on the safe half of the green.`,
    );
    if (flagRiskLevel === "RED") {
      parts.push(`This is a red flag: the miss beside it is expensive, so the target moves away from it, not to the middle for its own sake.`);
    } else if (best.worstSide !== "NONE") {
      parts.push(`${sideText(best.worstSide).toLowerCase()} is the costly miss; ${sideText(best.bestSide).toLowerCase()} is playable.`);
    }
    return parts.join(" ");
  }

  const gain = Math.round(longest.club.planningDistance - best.club.planningDistance);
  const extraPenalty = longest.penaltyProbability - best.penaltyProbability;

  if (longest.club.id === best.club.id) {
    return `${best.club.clubName} is both the longest sensible option and the safest one here: your pattern fits the corridor, so there is no reason to give up distance.`;
  }

  if (extraPenalty > 0.04) {
    return `${longest.club.clubName} adds roughly ${gain} yd but brings ${exposureWord(longest.penaltyProbability)} your expected dispersion into trouble. ${best.club.clubName} leaves about ${Math.round(best.expectedRemaining)} yd in and removes most of that exposure. ${gain} yd gained do not justify that penalty exposure.`;
  }

  return `${best.club.clubName} keeps your whole pattern in the playable corridor and leaves about ${Math.round(best.expectedRemaining)} yd. ${longest.club.clubName} does not buy enough here to be worth the wider miss.`;
}

function buildCaddieLine(args: {
  best: OptionResult;
  isPitchOut: boolean;
  flagRiskLevel: RiskLevel;
  distance: number;
}): string {
  const { best, isPitchOut, flagRiskLevel } = args;
  if (isPitchOut) return "Pitch out. Bogey is still alive.";

  const club = best.club.clubName;
  if (best.isApproach) {
    if (flagRiskLevel === "RED") return `${club}. Don't chase it. ${sideText(best.bestSide)} is fine.`;
    if (Math.abs(best.aimOffset) < 3) return `${club}. At the flag.`;
    return `${club}. ${Math.round(Math.abs(best.aimOffset))} yards ${best.aimOffset < 0 ? "left" : "right"} of the pin.`;
  }

  const t = targetLabel(best.aimOffset, false).toLowerCase();
  if (best.penaltyProbability < 0.03) return `${club}. ${t}. Trouble stays out.`;
  return `${club}. ${t}. Commit.`;
}

function emptyRecommendation(message: string): Recommendation {
  return {
    recommendedClub: "—",
    clubId: "",
    intent: "TEE_SHOT",
    playCategory: "STANDARD",
    target: "—",
    targetOffset: 0,
    targetOffsetLabel: "—",
    planningDistance: 0,
    expectedRemainingDistance: 0,
    safeMiss: "—",
    dangerMiss: "—",
    riskLevel: "GREEN",
    flagRisk: "GREEN",
    tigerFiveRisk: [],
    rationale: message,
    caddieLine: message,
    confidence: "LOW",
    penaltyProbability: 0,
    fairwayProbability: 0,
    greenProbability: 0,
    alternatives: [],
    debugScore: 0,
  };
}

/** GOLDEN RULE — se muestra solo cuando aplica de verdad. */
export function goldenRuleApplies(rec: Recommendation): boolean {
  return rec.alternatives.some((a) => a.penaltyExposure > rec.penaltyProbability + 0.05);
}

export const GOLDEN_RULE = "Never trade a small distance gain for a large penalty risk.";
