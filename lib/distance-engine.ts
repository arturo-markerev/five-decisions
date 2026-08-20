import type { Lie } from "@/types/golf";

/**
 * MODELO DE GOLPES ESPERADOS — H18 ESTIMATE.
 *
 * IMPORTANTE / FILOSOFIA (secciones 14 y 46 del brief):
 * Esto NO es una tabla profesional de Strokes Gained.
 * Se usa SOLO para ordenar opciones entre si (cual deja mejor posicion).
 * La UI nunca muestra estos numeros como "+0.73 strokes".
 * La UI solo muestra bandas: LOW / MEDIUM / HIGH COST.
 */

export const MODEL_NAME = "H18 ESTIMATE v1";

/** Golpes esperados desde fairway, por yardas restantes. */
const FAIRWAY_TABLE: Array<[number, number]> = [
  [10, 2.45],
  [20, 2.55],
  [30, 2.62],
  [40, 2.7],
  [50, 2.75],
  [60, 2.8],
  [80, 2.9],
  [100, 2.97],
  [120, 3.06],
  [140, 3.2],
  [160, 3.35],
  [180, 3.5],
  [200, 3.65],
  [220, 3.8],
  [240, 3.95],
  [260, 4.1],
  [280, 4.25],
  [300, 4.4],
  [330, 4.6],
  [360, 4.85],
  [400, 5.1],
  [450, 5.45],
  [500, 5.8],
  [560, 6.2],
  [620, 6.6],
];

/** Putts esperados H18 por pies al hoyo. */
const PUTT_TABLE: Array<[number, number]> = [
  [1, 1.02],
  [2, 1.08],
  [3, 1.18],
  [4, 1.32],
  [5, 1.44],
  [6, 1.55],
  [8, 1.7],
  [10, 1.8],
  [12, 1.87],
  [15, 1.94],
  [20, 2.03],
  [25, 2.11],
  [30, 2.2],
  [40, 2.35],
  [50, 2.48],
  [60, 2.6],
  [75, 2.76],
  [90, 2.92],
  [120, 3.15],
];

function interpolate(table: Array<[number, number]>, x: number): number {
  if (x <= table[0][0]) return table[0][1];
  const last = table[table.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 0; i < table.length - 1; i++) {
    const [x0, y0] = table[i];
    const [x1, y1] = table[i + 1];
    if (x >= x0 && x <= x1) {
      const t = (x - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return last[1];
}

/** Castigo aditivo por lie, en golpes. ESTIMATE. */
const LIE_PENALTY: Record<Lie, number> = {
  TEE: 0,
  FAIRWAY: 0,
  LIGHT_ROUGH: 0.22,
  HEAVY_ROUGH: 0.48,
  BUNKER: 0.5,
  TREES: 0.85,
  RECOVERY: 1.05,
  GREEN: 0,
  OTHER: 0.3,
};

export function puttsExpected(feet: number): number {
  return interpolate(PUTT_TABLE, Math.max(0.5, feet));
}

export const YARDS_PER_STEP = 0.95; // 1 paso ~ 0.87 m ~ 0.95 yd
export const FEET_PER_STEP = 2.85;

export function stepsToFeet(steps: number): number {
  return steps * FEET_PER_STEP;
}

/**
 * Golpes esperados para terminar el hoyo desde una posicion.
 * distance = yardas al centro del green (o al hoyo dentro de 30 yd).
 */
export function expectedStrokes(distanceYards: number, lie: Lie): number {
  const d = Math.max(0, distanceYards);
  if (lie === "GREEN") {
    return puttsExpected(d * 3);
  }
  if (d < 1) return 0;

  const base = interpolate(FAIRWAY_TABLE, d);
  let penalty = LIE_PENALTY[lie];

  // Bunker de green (cerca) pesa distinto que bunker de calle (lejos).
  if (lie === "BUNKER" && d <= 40) penalty = 0.58;
  // Rough cerca del green castiga menos que rough a 180 yd.
  if ((lie === "LIGHT_ROUGH" || lie === "HEAVY_ROUGH") && d <= 30) {
    penalty = lie === "LIGHT_ROUGH" ? 0.14 : 0.3;
  }
  return base + penalty;
}

/** Banda cualitativa para la UI. Nunca mostramos decimales de golpes. */
export function costBand(deltaStrokes: number): "LOW" | "MEDIUM" | "HIGH" {
  if (deltaStrokes < 0.15) return "LOW";
  if (deltaStrokes < 0.45) return "MEDIUM";
  return "HIGH";
}

export function yardsToMeters(y: number): number {
  return y * 0.9144;
}
