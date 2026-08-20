import type { Club, ClubLearning, PlayerProfile, Round, SampleBand, ShotRecord } from "@/types/golf";

/**
 * LEARNING ENGINE.
 * Regla dura (seccion 48): NUNCA modificamos el perfil solo por tener datos.
 * Con muestra chica se muestra, no se aplica. El jugador aprieta UPDATE MY GAME.
 */

export function sampleBand(n: number): SampleBand {
  if (n < 10) return "INSUFFICIENT";
  if (n < 25) return "EARLY";
  if (n < 50) return "USABLE";
  return "RELIABLE";
}

export const BAND_LABEL: Record<SampleBand, string> = {
  INSUFFICIENT: "INSUFFICIENT",
  EARLY: "EARLY",
  USABLE: "USABLE",
  RELIABLE: "RELIABLE",
};

export function allShots(rounds: Round[]): ShotRecord[] {
  const out: ShotRecord[] = [];
  for (const r of rounds) for (const h of r.holes) for (const s of h.shots) out.push(s);
  return out;
}

/**
 * Distancia observada: se infiere de la diferencia de distancia al green
 * entre este golpe y el siguiente del mismo hoyo. Solo golpes limpios.
 */
export function observedDistances(rounds: Round[], clubName: string): number[] {
  const out: number[] = [];
  for (const r of rounds) {
    for (const h of r.holes) {
      const shots = [...h.shots].sort((a, b) => a.shotNumber - b.shotNumber);
      for (let i = 0; i < shots.length - 1; i++) {
        const s = shots[i];
        const n = shots[i + 1];
        if (s.selectedClub !== clubName) continue;
        if (s.penalty > 0) continue;
        const from = s.laserDistance ?? s.distanceToGreen;
        const to = n.laserDistance ?? n.distanceToGreen;
        if (from == null || to == null) continue;
        const d = from - to;
        if (d > 20 && d < 400) out.push(d);
      }
    }
  }
  return out;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : Math.round((v[mid - 1] + v[mid]) / 2);
}

function rate(n: number, d: number): number | null {
  return d > 0 ? n / d : null;
}

export function learnClub(profile: PlayerProfile, rounds: Round[], club: Club): ClubLearning {
  const shots = allShots(rounds).filter((s) => s.selectedClub === club.clubName);
  const n = shots.length;
  const band = sampleBand(n);

  const count = (fn: (s: ShotRecord) => boolean) => shots.filter(fn).length;
  const obs = observedDistances(rounds, club.clubName);
  const med = median(obs);

  // Solo sugerimos cambiar planning distance con muestra USABLE o mejor.
  const suggested =
    med != null && obs.length >= 10 && (band === "USABLE" || band === "RELIABLE") ? Math.round(med) : null;

  return {
    clubName: club.clubName,
    shots: n,
    band,
    fairwayPct: rate(count((s) => s.result === "FAIRWAY"), n),
    greenPct: rate(count((s) => s.result === "GREEN"), n),
    leftPct: rate(count((s) => s.result === "LEFT" || s.result === "LEFT_ROUGH"), n),
    rightPct: rate(count((s) => s.result === "RIGHT" || s.result === "RIGHT_ROUGH"), n),
    shortPct: rate(count((s) => s.result === "SHORT"), n),
    longPct: rate(count((s) => s.result === "LONG"), n),
    penaltyPct: rate(count((s) => s.penalty > 0 || s.result === "WATER" || s.result === "OB"), n),
    observedMedianDistance: med,
    observedDistanceSamples: obs.length,
    currentPlanningDistance: club.planningDistance,
    suggestedPlanningDistance: suggested,
  };
}

export function learnAllClubs(profile: PlayerProfile, rounds: Round[]): ClubLearning[] {
  return profile.clubs
    .filter((c) => c.category !== "PUTTER")
    .map((c) => learnClub(profile, rounds, c));
}

/** Aplica una sugerencia. Explicito, nunca automatico. */
export function applyLearning(profile: PlayerProfile, clubName: string, newPlanning: number): PlayerProfile {
  return {
    ...profile,
    updatedAt: new Date().toISOString(),
    clubs: profile.clubs.map((c) =>
      c.clubName === clubName
        ? {
            ...c,
            planningDistance: newPlanning,
            conservativeDistance: Math.min(c.conservativeDistance, newPlanning - 5),
            goodStrikeDistance: Math.max(c.goodStrikeDistance, newPlanning + 5),
            dispersionSource: "OBSERVED" as const,
            needsCalibration: false,
          }
        : c,
    ),
  };
}
