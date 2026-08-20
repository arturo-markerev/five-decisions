import type { Lie, Recommendation, ShotResultCode } from "@/types/golf";
import { LIE_DISTANCE_FACTOR } from "@/lib/dispersion-engine";

/** Traduce el resultado de un tap al lie del proximo golpe. */
export function lieFromResult(result: ShotResultCode, previousLie: Lie): Lie {
  switch (result) {
    case "FAIRWAY":
      return "FAIRWAY";
    case "GREEN":
      return "GREEN";
    case "LEFT_ROUGH":
    case "RIGHT_ROUGH":
    case "LEFT":
    case "RIGHT":
    case "SHORT":
    case "LONG":
      return "LIGHT_ROUGH";
    case "BUNKER":
      return "BUNKER";
    case "TREES":
      return "TREES";
    case "WATER":
      return "LIGHT_ROUGH"; // despues del drop
    case "OB":
      return previousLie; // stroke and distance
    default:
      return "OTHER";
  }
}

/** Golpes de penalidad que van a la TARJETA (no el costo modelado del motor). */
export function penaltyFromResult(result: ShotResultCode): number {
  if (result === "WATER") return 1;
  if (result === "OB") return 1; // 1 de penalidad + se repite el golpe
  return 0;
}

/**
 * Estimacion de la distancia restante despues del golpe.
 * Es SOLO un punto de partida: el laser la reemplaza en el proximo golpe.
 */
export function estimateNextDistance(
  currentDistance: number,
  planningDistance: number,
  lie: Lie,
  result: ShotResultCode,
): number {
  if (result === "GREEN") return 0;
  if (result === "OB") return currentDistance;
  if (result === "WATER") return Math.max(20, currentDistance - planningDistance * 0.45);

  const factor = LIE_DISTANCE_FACTOR[lie] ?? 1;
  const shortResults: ShotResultCode[] = ["SHORT", "BUNKER", "TREES"];
  const carry = planningDistance * factor * (shortResults.includes(result) ? 0.85 : 1);
  return Math.max(3, Math.round(currentDistance - carry));
}

/**
 * ERRAR DEL LADO CORRECTO (seccion 30).
 * No evaluamos GIR si/no. Evaluamos si el fallo cayo del lado barato.
 * null = no aplica (pego donde queria, o no hay lado claro).
 */
export function correctMissFromResult(rec: Recommendation, result: ShotResultCode): boolean | null {
  if (result === "FAIRWAY" || result === "GREEN") return null;
  const safe = rec.safeMiss.toUpperCase();
  const danger = rec.dangerMiss.toUpperCase();

  const sideOf = (r: ShotResultCode): string | null => {
    if (r === "LEFT" || r === "LEFT_ROUGH") return "LEFT";
    if (r === "RIGHT" || r === "RIGHT_ROUGH") return "RIGHT";
    if (r === "SHORT") return "SHORT";
    if (r === "LONG") return "LONG";
    return null;
  };

  if (result === "WATER" || result === "OB") return false;
  const side = sideOf(result);
  if (!side) return null;
  if (danger.includes(side)) return false;
  if (safe.includes(side)) return true;
  return null;
}

export const LIE_OPTIONS: Array<{ value: Lie; label: string }> = [
  { value: "FAIRWAY", label: "FAIRWAY" },
  { value: "LIGHT_ROUGH", label: "LIGHT ROUGH" },
  { value: "HEAVY_ROUGH", label: "HEAVY ROUGH" },
  { value: "BUNKER", label: "BUNKER" },
  { value: "TREES", label: "TREES" },
  { value: "RECOVERY", label: "RECOVERY" },
  { value: "OTHER", label: "OTHER" },
];
