import type { HoleRecord, Round, ShotRecord } from "@/types/golf";
import { evaluateRound, totalEvents } from "@/lib/tiger-five-engine";

export interface RoundStats {
  holesCompleted: number;
  score: number;
  par: number;
  toPar: number;
  fairwaysHit: number;
  fairwayOpportunities: number;
  gir: number;
  girOpportunities: number;
  putts: number;
  onePutts: number;
  threePutts: number;
  penalties: number;
  doublesPlus: number;
  scramblingAttempts: number;
  scramblingSuccess: number;
  correctMisses: number;
  missOpportunities: number;
  recommendationsFollowed: number;
  recommendationOpportunities: number;
  tigerFiveTotal: number;
}

function isTeeShotOnParFourOrFive(s: ShotRecord, hole: HoleRecord): boolean {
  return s.shotNumber === 1 && hole.par >= 4;
}

export function computeRoundStats(round: Round): RoundStats {
  const completed = round.holes.filter((h) => h.completed);
  let fairwaysHit = 0;
  let fairwayOpportunities = 0;
  let gir = 0;
  let girOpportunities = 0;
  let putts = 0;
  let onePutts = 0;
  let threePutts = 0;
  let penalties = 0;
  let doublesPlus = 0;
  let scramblingAttempts = 0;
  let scramblingSuccess = 0;
  let correctMisses = 0;
  let missOpportunities = 0;
  let followed = 0;
  let opportunities = 0;
  let score = 0;
  let par = 0;

  for (const h of completed) {
    par += h.par;
    score += h.score ?? h.par;
    penalties += h.penalties;
    putts += h.putts ?? 0;
    if ((h.putts ?? 0) === 1) onePutts += 1;
    if ((h.putts ?? 0) >= 3) threePutts += 1;
    if (h.score != null && h.score >= h.par + 2) doublesPlus += 1;

    for (const s of h.shots) {
      if (isTeeShotOnParFourOrFive(s, h)) {
        fairwayOpportunities += 1;
        if (s.result === "FAIRWAY") fairwaysHit += 1;
      }
      if (s.recommendedClub && s.recommendedClub !== "—") {
        opportunities += 1;
        if (s.followedRecommendation) followed += 1;
      }
      if (s.correctMiss != null) {
        missOpportunities += 1;
        if (s.correctMiss) correctMisses += 1;
      }
    }

    // GIR: llego al green en (par - 2) golpes o menos, sin contar putts.
    const nonPutt = h.shots.filter((s) => s.lie !== "GREEN");
    const strokesToGreen = (h.score ?? h.par) - (h.putts ?? 0);
    girOpportunities += 1;
    const hitGreen = strokesToGreen <= h.par - 2 && (h.putts ?? 0) > 0;
    if (hitGreen) gir += 1;
    else {
      scramblingAttempts += 1;
      if (h.score != null && h.score <= h.par) scramblingSuccess += 1;
    }
    void nonPutt;
  }

  const { tally } = evaluateRound(round);

  return {
    holesCompleted: completed.length,
    score,
    par,
    toPar: score - par,
    fairwaysHit,
    fairwayOpportunities,
    gir,
    girOpportunities,
    putts,
    onePutts,
    threePutts,
    penalties,
    doublesPlus,
    scramblingAttempts,
    scramblingSuccess,
    correctMisses,
    missOpportunities,
    recommendationsFollowed: followed,
    recommendationOpportunities: opportunities,
    tigerFiveTotal: totalEvents(tally),
  };
}

export function pct(n: number, d: number): string {
  if (d <= 0) return "—";
  return `${Math.round((n / d) * 100)}%`;
}

export interface DecisionReviewRow {
  holeNumber: number;
  shotNumber: number;
  recommended: string;
  played: string;
  result: string;
  decision: "GOOD" | "OVERRIDE" | "—";
  execution: "HIT" | "MISS" | "PENALTY";
}

/**
 * Seccion 43-44: DECISION y EJECUCION se evaluan por separado.
 * Un buen plan que sale mal sigue siendo un buen plan.
 */
export function decisionReview(round: Round): DecisionReviewRow[] {
  const rows: DecisionReviewRow[] = [];
  for (const h of round.holes) {
    for (const s of h.shots) {
      if (!s.recommendedClub || s.recommendedClub === "—") continue;
      const execution: DecisionReviewRow["execution"] =
        s.penalty > 0 || s.result === "WATER" || s.result === "OB"
          ? "PENALTY"
          : s.result === "FAIRWAY" || s.result === "GREEN"
            ? "HIT"
            : "MISS";
      rows.push({
        holeNumber: h.holeNumber,
        shotNumber: s.shotNumber,
        recommended: s.recommendedClub,
        played: s.selectedClub,
        result: s.result,
        decision: s.followedRecommendation ? "GOOD" : "OVERRIDE",
        execution,
      });
    }
  }
  return rows;
}

export interface CoachLine {
  title: string;
  detail: string;
}

/** Seccion 45-46: costos en bandas, nunca "perdiste 2.3 golpes". */
export function coachReport(round: Round): { cost: CoachLine[]; good: CoachLine[] } {
  const stats = computeRoundStats(round);
  const { events } = evaluateRound(round);
  const cost: CoachLine[] = [];
  const good: CoachLine[] = [];

  if (stats.penalties > 0) {
    cost.push({
      title: "Penalty decisions",
      detail: `${stats.penalties} penalty stroke${stats.penalties > 1 ? "s" : ""} — LIKELY HIGH COST`,
    });
  }
  const redAttacks = events.filter((e) => e.key === "BAD_DECISION_INSIDE_150").length;
  if (redAttacks > 0) {
    cost.push({ title: "Red flag attacks", detail: `${redAttacks} inside 150 — MEDIUM COST` });
  }
  if (stats.threePutts > 0) {
    cost.push({ title: "Three putts", detail: `${stats.threePutts} this round — MEDIUM COST` });
  }
  if (stats.missOpportunities > 0 && stats.correctMisses / stats.missOpportunities < 0.5) {
    cost.push({
      title: "Wrong-side misses",
      detail: `${stats.correctMisses}/${stats.missOpportunities} misses on the safe side — MEDIUM COST`,
    });
  }
  const doublesByDecision = events.filter((e) => e.key === "DOUBLE_PLUS" && e.cause === "DECISION").length;
  if (doublesByDecision > 0) {
    cost.push({
      title: "Doubles by decision",
      detail: `${doublesByDecision} avoidable big number${doublesByDecision > 1 ? "s" : ""} — LIKELY HIGH COST`,
    });
  }

  if (stats.penalties === 0) good.push({ title: "Zero penalties", detail: "The most important Tiger Five for H18." });
  if (stats.threePutts === 0) good.push({ title: "No three-putts", detail: "Speed control held up." });
  if (stats.missOpportunities > 0 && stats.correctMisses / stats.missOpportunities >= 0.5) {
    good.push({
      title: "Missed on the correct side",
      detail: `${stats.correctMisses}/${stats.missOpportunities} misses were the cheap ones.`,
    });
  }
  if (stats.recommendationOpportunities > 0 && stats.recommendationsFollowed / stats.recommendationOpportunities >= 0.7) {
    good.push({ title: "Stuck to the plan", detail: "Committed to the shot you chose before you hit it." });
  }
  if (good.length === 0) good.push({ title: "You finished 18", detail: "Baseline logged. That is the data we build on." });

  return { cost, good };
}
