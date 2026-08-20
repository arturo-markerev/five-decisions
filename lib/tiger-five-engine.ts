import type {
  HoleRecord,
  Round,
  ShotRecord,
  TigerFiveEvent,
  TigerFiveKey,
  TigerFiveTally,
} from "@/types/golf";

/**
 * TIGER FIVE — H18.
 * Adaptacion para handicap 18. NO son los numeros originales de Tiger Woods.
 * Siempre se muestra "Adapted for H18".
 *
 * FIVE DECISIONS  = estrategia ANTES del golpe.
 * TIGER FIVE H18  = control de grandes errores DESPUES.
 */

export const TIGER_FIVE_SUBTITLE = "Adapted for H18";

export const TIGER_FIVE_KEYS: TigerFiveKey[] = [
  "PENALTY",
  "DOUBLE_PLUS",
  "THREE_PUTT",
  "DOUBLE_SHORT_GAME",
  "BAD_DECISION_INSIDE_150",
];

export function emptyTally(): TigerFiveTally {
  return {
    PENALTY: 0,
    DOUBLE_PLUS: 0,
    THREE_PUTT: 0,
    DOUBLE_SHORT_GAME: 0,
    BAD_DECISION_INSIDE_150: 0,
  };
}

const PENALTY_RESULTS = new Set(["WATER", "OB"]);

function isShortGameShot(s: ShotRecord): boolean {
  const d = s.laserDistance ?? s.distanceToGreen;
  if (d == null) return false;
  return d <= 50 && s.lie !== "GREEN";
}

function reachedGreen(s: ShotRecord): boolean {
  return s.result === "GREEN";
}

export function evaluateHole(hole: HoleRecord): TigerFiveEvent[] {
  const events: TigerFiveEvent[] = [];
  if (!hole.completed) return events;

  // 1. PENALTY — el mas importante para H18.
  const penaltyShots = hole.shots.filter((s) => s.penalty > 0 || PENALTY_RESULTS.has(s.result));
  const penaltyStrokes = hole.penalties > 0 ? hole.penalties : penaltyShots.length;
  if (penaltyStrokes > 0) {
    events.push({
      key: "PENALTY",
      holeNumber: hole.holeNumber,
      detail: `${penaltyStrokes} penalty stroke${penaltyStrokes > 1 ? "s" : ""}`,
    });
  }

  // 2. DOUBLE BOGEY+ — separando decision de ejecucion.
  if (hole.score != null && hole.score >= hole.par + 2) {
    const decisionDriven = hole.shots.some(
      (s) =>
        (!s.followedRecommendation && (s.penalty > 0 || PENALTY_RESULTS.has(s.result))) ||
        (!s.followedRecommendation && s.strategyRisk === "RED") ||
        (s.flagRisk === "RED" && !s.followedRecommendation),
    );
    events.push({
      key: "DOUBLE_PLUS",
      holeNumber: hole.holeNumber,
      detail: `${hole.score} on a par ${hole.par}`,
      cause: decisionDriven ? "DECISION" : "EXECUTION",
    });
  }

  // 3. THREE PUTT
  if ((hole.putts ?? 0) >= 3) {
    events.push({
      key: "THREE_PUTT",
      holeNumber: hole.holeNumber,
      detail: `${hole.putts} putts`,
    });
  }

  // 4. DOUBLE SHORT GAME — dos golpes de short game para llegar al green.
  const shortGame = hole.shots.filter(isShortGameShot);
  const shortGameMisses = shortGame.filter((s) => !reachedGreen(s)).length;
  if (shortGame.length >= 2 && shortGameMisses >= 1) {
    events.push({
      key: "DOUBLE_SHORT_GAME",
      holeNumber: hole.holeNumber,
      detail: `${shortGame.length} short game shots to reach the green`,
    });
  }

  // 5. BAD DECISION INSIDE 150 — se penaliza la DECISION, no el error de golpe.
  const bad = hole.shots.find((s) => {
    const d = s.laserDistance ?? s.distanceToGreen;
    if (d == null || d > 150) return false;
    const ignoredSafeOption = !s.followedRecommendation;
    const attackedRedFlag = s.flagRisk === "RED";
    const badOutcome =
      s.penalty > 0 || PENALTY_RESULTS.has(s.result) || s.result === "BUNKER" || s.result === "TREES";
    return ignoredSafeOption && (attackedRedFlag || s.strategyRisk === "RED") && badOutcome;
  });
  if (bad) {
    events.push({
      key: "BAD_DECISION_INSIDE_150",
      holeNumber: hole.holeNumber,
      detail: `Attacked from ${bad.laserDistance ?? bad.distanceToGreen} yd against the plan`,
    });
  }

  return events;
}

export function evaluateRound(round: Round): { events: TigerFiveEvent[]; tally: TigerFiveTally } {
  const events: TigerFiveEvent[] = [];
  for (const h of round.holes) events.push(...evaluateHole(h));
  const tally = emptyTally();
  for (const e of events) tally[e.key] += 1;
  return { events, tally };
}

export function totalEvents(tally: TigerFiveTally): number {
  return TIGER_FIVE_KEYS.reduce((sum, k) => sum + tally[k], 0);
}

export function isCleanHole(hole: HoleRecord): boolean {
  return evaluateHole(hole).length === 0;
}

/** Que Tiger Five esta en juego ANTES del golpe. Se muestra corto y sin drama. */
export function tigerFivePrompt(keys: TigerFiveKey[]): string | null {
  if (keys.includes("PENALTY")) return "PENALTY IN PLAY";
  if (keys.includes("BAD_DECISION_INSIDE_150")) return "BAD <150 DECISION IN PLAY";
  if (keys.includes("DOUBLE_PLUS")) return "BIG NUMBER IN PLAY";
  if (keys.includes("DOUBLE_SHORT_GAME")) return "SHORT GAME IN PLAY";
  return null;
}
