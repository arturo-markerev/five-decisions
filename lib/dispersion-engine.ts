import type { Club, Lie } from "@/types/golf";

/**
 * Patron de dispersion determinista.
 * NO usamos random: una grilla ponderada, siempre igual, testeable y offline.
 *
 * Filosofia (seccion 12): planificamos con planningDistance + dispersion.
 * NUNCA con goodStrikeDistance.
 */

export interface DispersionSample {
  /** yardas de vuelo/rodada totales desde el punto de golpe */
  carry: number;
  /** desviacion lateral: negativo = izquierda, positivo = derecha */
  lateral: number;
  /** peso de probabilidad, suma 1 en el set completo */
  weight: number;
}

/** ~normal discretizada en 5 puntos */
const AXIS_OFFSETS = [-1, -0.5, 0, 0.5, 1];
const AXIS_WEIGHTS = [0.09, 0.21, 0.4, 0.21, 0.09];

/** Multiplicador de distancia segun el lie. ESTIMATE. */
export const LIE_DISTANCE_FACTOR: Record<Lie, number> = {
  TEE: 1,
  FAIRWAY: 1,
  LIGHT_ROUGH: 0.94,
  HEAVY_ROUGH: 0.8,
  BUNKER: 0.85,
  TREES: 0.72,
  RECOVERY: 0.6,
  GREEN: 1,
  OTHER: 0.9,
};

/** Multiplicador de dispersion segun el lie. ESTIMATE. */
export const LIE_DISPERSION_FACTOR: Record<Lie, number> = {
  TEE: 1,
  FAIRWAY: 1,
  LIGHT_ROUGH: 1.2,
  HEAVY_ROUGH: 1.55,
  BUNKER: 1.45,
  TREES: 1.9,
  RECOVERY: 2.1,
  GREEN: 1,
  OTHER: 1.3,
};

export interface DispersionOptions {
  lie: Lie;
  /** distancia objetivo si es un golpe parcial (wedges / control) */
  targetDistance?: number;
  /** desplazamiento de puntería lateral. negativo = apuntar izquierda */
  aimOffset?: number;
}

/**
 * Sesgo del patron hacia el miss tipico.
 * Un H18 con miss derecho no tiene un patron simetrico.
 */
function missBias(club: Club): { lateral: number; longitudinal: number } {
  const width = (club.leftDispersionYards + club.rightDispersionYards) / 2;
  switch (club.typicalMiss) {
    case "RIGHT":
      return { lateral: width * 0.18, longitudinal: 0 };
    case "LEFT":
      return { lateral: -width * 0.18, longitudinal: 0 };
    case "SHORT":
      return { lateral: 0, longitudinal: -club.shortDispersionYards * 0.2 };
    case "LONG":
      return { lateral: 0, longitudinal: club.longDispersionYards * 0.2 };
    default:
      return { lateral: 0, longitudinal: 0 };
  }
}

/**
 * Driver desde el piso NO es el mismo palo que desde el tee.
 * Sin esto el motor recomienda driver en el segundo golpe de todos los par 5,
 * que para un handicap 18 es un consejo malo: pierde distancia y sobre todo
 * abre muchisimo la dispersion. Los numeros son ESTIMATE.
 */
function offTheDeck(club: Club, lie: Lie): { distance: number; dispersion: number } {
  if (lie === "TEE") return { distance: 1, dispersion: 1 };
  if (club.category === "DRIVER") return { distance: 0.94, dispersion: 1.7 };
  if (club.category === "FAIRWAY_WOOD") return { distance: 0.98, dispersion: 1.15 };
  return { distance: 1, dispersion: 1 };
}

export function buildDispersion(club: Club, opts: DispersionOptions): DispersionSample[] {
  const distFactor = LIE_DISTANCE_FACTOR[opts.lie];
  const dispFactor = LIE_DISPERSION_FACTOR[opts.lie];

  const deck = offTheDeck(club, opts.lie);
  const fullDistance = club.planningDistance * distFactor * deck.distance;
  const nominal = opts.targetDistance != null ? Math.min(opts.targetDistance, fullDistance) : fullDistance;

  // Golpe parcial: menos distancia, algo menos de dispersion lateral.
  const partialRatio = fullDistance > 0 ? Math.min(1, nominal / fullDistance) : 1;
  const lateralScale = dispFactor * deck.dispersion * (0.55 + 0.45 * partialRatio);
  const longScale = dispFactor * deck.dispersion;

  const bias = missBias(club);
  const aim = opts.aimOffset ?? 0;

  const samples: DispersionSample[] = [];
  for (let i = 0; i < AXIS_OFFSETS.length; i++) {
    const lo = AXIS_OFFSETS[i];
    const longitudinal =
      lo < 0
        ? lo * club.shortDispersionYards * longScale * partialRatio
        : lo * club.longDispersionYards * longScale * partialRatio;

    for (let j = 0; j < AXIS_OFFSETS.length; j++) {
      const la = AXIS_OFFSETS[j];
      const lateral =
        la < 0 ? la * club.leftDispersionYards * lateralScale : la * club.rightDispersionYards * lateralScale;

      samples.push({
        carry: Math.max(5, nominal + longitudinal + bias.longitudinal),
        lateral: lateral + bias.lateral + aim,
        weight: AXIS_WEIGHTS[i] * AXIS_WEIGHTS[j],
      });
    }
  }
  return samples;
}

/** Semiancho del patron: cuanto espacio necesita realmente este palo. */
export function patternWidth(club: Club, lie: Lie): number {
  const f = LIE_DISPERSION_FACTOR[lie];
  return (club.leftDispersionYards + club.rightDispersionYards) * f;
}

/** Distancia maxima creible del patron. Se usa para carries forzados. */
export function patternShortEdge(club: Club, lie: Lie): number {
  return club.planningDistance * LIE_DISTANCE_FACTOR[lie] - club.shortDispersionYards * LIE_DISPERSION_FACTOR[lie];
}

export function patternLongEdge(club: Club, lie: Lie): number {
  return club.planningDistance * LIE_DISTANCE_FACTOR[lie] + club.longDispersionYards * LIE_DISPERSION_FACTOR[lie];
}
