import type {
  FlagPosition,
  GreenSide,
  Hazard,
  Hole,
  Lie,
  RiskLevel,
} from "@/types/golf";

/**
 * Clasifica donde termina la pelota y cuanto cuesta.
 * Modelo de corridor: eje longitudinal (yardas desde el tee) + eje lateral
 * (yardas desde el centro del fairway, negativo = izquierda).
 */

export interface LandingOutcome {
  lie: Lie;
  penalty: number;
  /** yardas restantes al centro del green desde donde se juega el proximo golpe */
  remainingDistance: number;
  /** etiqueta corta para explicar el resultado */
  label: string;
  hazardId: string | null;
}

function lateralInHazard(h: Hazard, lateral: number): boolean {
  const abs = Math.abs(lateral);
  switch (h.side) {
    case "CROSS":
      return true;
    case "CENTER":
      return abs <= h.lateralEnd;
    case "LEFT":
      return lateral < 0 && abs >= h.lateralStart && abs <= h.lateralEnd;
    case "RIGHT":
      return lateral > 0 && abs >= h.lateralStart && abs <= h.lateralEnd;
    case "BOTH":
      return abs >= h.lateralStart && abs <= h.lateralEnd;
    default:
      return false;
  }
}

function hazardLie(h: Hazard): Lie {
  switch (h.type) {
    case "BUNKER":
      return "BUNKER";
    case "TREES":
      return "TREES";
    case "RECOVERY":
      return "RECOVERY";
    case "WATER":
    case "PENALTY":
    case "OB":
      return "FAIRWAY"; // se dropea; el costo real esta en penalty
    default:
      return "HEAVY_ROUGH";
  }
}


/** Encuentra el hazard mas severo que toca una posicion. Exportado para el motor. */
export function findHazard(hole: Hole, distanceFromTee: number, lateral: number): Hazard | null {
  const hits = hole.hazards.filter(
    (h) =>
      distanceFromTee >= h.startDistanceFromTee &&
      distanceFromTee <= h.endDistanceFromTee &&
      lateralInHazard(h, lateral),
  );
  if (hits.length === 0) return null;
  const severityRank: Record<string, number> = { EXTREME: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  hits.sort((a, b) => severityRank[b.severity] - severityRank[a.severity]);
  return hits[0];
}

/** Golpes de penalidad efectivos. OB se modela como stroke and distance. */
export function effectivePenalty(h: Hazard): number {
  if (h.penaltyCost > 0) return h.penaltyCost;
  if (h.type === "OB") return 2;
  if (h.type === "WATER" || h.type === "PENALTY") return 1;
  return 0;
}

/**
 * Donde termina un golpe desde el tee / calle, dado el punto de aterrizaje.
 * @param distanceFromTee posicion longitudinal del golpe (yardas desde el tee)
 */
export function classifyLanding(hole: Hole, distanceFromTee: number, lateral: number): LandingOutcome {
  const holeLength = hole.whiteTeeYardage;

  // 1. Hazards, del mas severo al menos severo dentro de la banda.
  const hits = hole.hazards.filter(
    (h) =>
      distanceFromTee >= h.startDistanceFromTee &&
      distanceFromTee <= h.endDistanceFromTee &&
      lateralInHazard(h, lateral),
  );

  if (hits.length > 0) {
    const severityRank: Record<string, number> = { EXTREME: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    hits.sort((a, b) => severityRank[b.severity] - severityRank[a.severity]);
    const h = hits[0];
    const penalty = effectivePenalty(h);

    if (h.type === "OB") {
      // Stroke and distance: se vuelve a jugar desde donde salio.
      return {
        lie: "TEE",
        penalty,
        remainingDistance: holeLength,
        label: "OB",
        hazardId: h.id,
      };
    }
    if (h.type === "WATER" || h.type === "PENALTY") {
      // Drop cerca del punto de entrada.
      const dropAt = Math.max(20, h.startDistanceFromTee - 5);
      return {
        lie: "LIGHT_ROUGH",
        penalty,
        remainingDistance: Math.max(15, holeLength - dropAt),
        label: h.type === "WATER" ? "Water" : "Penalty area",
        hazardId: h.id,
      };
    }
    return {
      lie: hazardLie(h),
      penalty,
      remainingDistance: Math.max(10, holeLength - distanceFromTee),
      label: h.type === "BUNKER" ? "Bunker" : h.type === "TREES" ? "Trees" : "Recovery",
      hazardId: h.id,
    };
  }

  // 2. Pasado el fairway.
  const remaining = Math.max(5, holeLength - distanceFromTee);
  const half = hole.fairwayWidthYards / 2;
  const abs = Math.abs(lateral);

  if (distanceFromTee > hole.fairwayEnd && distanceFromTee < holeLength - 25) {
    return {
      lie: "HEAVY_ROUGH",
      penalty: 0,
      remainingDistance: remaining,
      label: "Through the fairway",
      hazardId: null,
    };
  }

  if (distanceFromTee >= holeLength - 25) {
    // Llego a la zona del green.
    return {
      lie: abs <= hole.greenWidth / 2 ? "GREEN" : "LIGHT_ROUGH",
      penalty: 0,
      remainingDistance: Math.max(3, remaining),
      label: abs <= hole.greenWidth / 2 ? "Green" : "Greenside",
      hazardId: null,
    };
  }

  if (distanceFromTee < hole.fairwayStart) {
    return {
      lie: "HEAVY_ROUGH",
      penalty: 0,
      remainingDistance: remaining,
      label: "Short of the fairway",
      hazardId: null,
    };
  }

  if (abs <= half) {
    return { lie: "FAIRWAY", penalty: 0, remainingDistance: remaining, label: "Fairway", hazardId: null };
  }
  if (abs <= half + 12) {
    return {
      lie: "LIGHT_ROUGH",
      penalty: 0,
      remainingDistance: remaining,
      label: lateral < 0 ? "Left rough" : "Right rough",
      hazardId: null,
    };
  }
  return {
    lie: "HEAVY_ROUGH",
    penalty: 0,
    remainingDistance: remaining,
    label: lateral < 0 ? "Left heavy rough" : "Right heavy rough",
    hazardId: null,
  };
}

/* ------------------------------------------------------------------ */
/* Green / bandera                                                     */
/* ------------------------------------------------------------------ */

export interface FlagGeometry {
  /** offset lateral de la bandera respecto del centro (yd, + = derecha) */
  lateral: number;
  /** offset de profundidad respecto del centro (yd, + = atras) */
  depth: number;
}

export function flagGeometry(hole: Hole, flag: FlagPosition): FlagGeometry {
  if (flag === "UNKNOWN") return { lateral: 0, depth: 0 };
  const [depthPart, lateralPart] = flag.split("_");
  const lateralUnit = hole.greenWidth * 0.3;
  const depthUnit = hole.greenDepth * 0.3;
  const lateral = lateralPart === "LEFT" ? -lateralUnit : lateralPart === "RIGHT" ? lateralUnit : 0;
  const depth = depthPart === "FRONT" ? -depthUnit : depthPart === "BACK" ? depthUnit : 0;
  return { lateral, depth };
}

/** Que hazard hay de cada lado del green. */
export function greensideBySide(hole: Hole): Record<GreenSide, { severity: string; penalty: number } | null> {
  const out: Record<GreenSide, { severity: string; penalty: number } | null> = {
    LEFT: null,
    RIGHT: null,
    SHORT: null,
    LONG: null,
  };
  for (const g of hole.greensideHazards) {
    const penalty = g.penaltyCost > 0 ? g.penaltyCost : g.type === "OB" ? 2 : g.type === "WATER" ? 1 : 0;
    const cur = out[g.side];
    if (!cur || penalty > cur.penalty) out[g.side] = { severity: g.severity, penalty };
  }
  return out;
}

const SEVERITY_WEIGHT: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, EXTREME: 4 };

/**
 * FLAG RISK (seccion 28).
 * GREEN  = hay espacio alrededor del objetivo para mi dispersion.
 * YELLOW = un lado cuesta claramente mas.
 * RED    = la bandera esta pegada a algo caro.
 */
export function flagRisk(hole: Hole, flag: FlagPosition, dispersionHalfWidth: number): RiskLevel {
  if (flag === "UNKNOWN") return "GREEN";
  const geo = flagGeometry(hole, flag);
  const sides = greensideBySide(hole);
  const [depthPart, lateralPart] = flag.split("_");

  const nearSide: GreenSide | null =
    lateralPart === "LEFT" ? "LEFT" : lateralPart === "RIGHT" ? "RIGHT" : null;
  const nearDepth: GreenSide | null = depthPart === "FRONT" ? "SHORT" : depthPart === "BACK" ? "LONG" : null;

  let worst = 0;
  for (const s of [nearSide, nearDepth]) {
    if (!s) continue;
    const h = sides[s];
    if (!h) continue;
    const weight = SEVERITY_WEIGHT[h.severity] ?? 1;
    worst = Math.max(worst, weight + (h.penalty > 0 ? 1.5 : 0));
  }

  // Espacio disponible del lado de la bandera.
  const roomLateral = hole.greenWidth / 2 - Math.abs(geo.lateral);
  const tight = roomLateral < dispersionHalfWidth * 0.55;

  if (worst >= 4 || (worst >= 3 && tight)) return "RED";
  if (worst >= 2 || tight) return "YELLOW";
  return "GREEN";
}

export function riskFromPenaltyProbability(p: number): RiskLevel {
  if (p >= 0.16) return "RED";
  if (p >= 0.06) return "YELLOW";
  return "GREEN";
}

export function sideLabel(offset: number): string {
  if (Math.abs(offset) < 3) return "Center";
  return offset < 0 ? "Left" : "Right";
}
