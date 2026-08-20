"use client";

import type { FlagPosition, Hole, Recommendation } from "@/types/golf";
import { flagGeometry } from "@/lib/risk-engine";

/**
 * Mapa ESQUEMATICO del hoyo (no es geometria real).
 * Modelo corridor: tee abajo, green arriba, laterales en yardas desde el centro.
 * Cuando carguemos poligonos reales, este componente se reemplaza sin tocar el motor.
 */

const W = 320;
const H = 420;
const PAD_Y = 26;
const HALF_CORRIDOR = 58; // yardas visibles a cada lado del centro

function hazardColor(type: string): string {
  switch (type) {
    case "WATER":
    case "PENALTY":
      return "#2563eb";
    case "OB":
      return "var(--danger)";
    case "BUNKER":
      return "#c9b285";
    case "TREES":
      return "#1f4d33";
    default:
      return "var(--surface-3)";
  }
}

export default function HoleMap({
  hole,
  recommendation,
  flagPosition,
  ballDistanceFromTee = 0,
}: {
  hole: Hole;
  recommendation?: Recommendation | null;
  flagPosition: FlagPosition;
  ballDistanceFromTee?: number;
}) {
  const length = Math.max(100, hole.whiteTeeYardage);
  const yFor = (yards: number) => H - PAD_Y - (yards / length) * (H - PAD_Y * 2);
  const xFor = (lateral: number) => W / 2 + (lateral / HALF_CORRIDOR) * (W / 2);
  const yardToPx = (H - PAD_Y * 2) / length;

  const geo = flagGeometry(hole, flagPosition);
  const greenY = yFor(length);
  const greenRx = Math.max(10, (hole.greenWidth / 2 / HALF_CORRIDOR) * (W / 2));
  const greenRy = Math.max(9, (hole.greenDepth / 2) * yardToPx);

  const landing =
    recommendation && recommendation.planningDistance > 0
      ? Math.min(length, ballDistanceFromTee + recommendation.planningDistance)
      : null;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ display: "block", borderRadius: 16, background: "var(--surface)" }}
      role="img"
      aria-label={`Schematic map of hole ${hole.holeNumber}`}
    >
      {/* corridor */}
      <rect x={0} y={0} width={W} height={H} fill="var(--surface)" />
      <rect
        x={xFor(-45)}
        y={PAD_Y - 10}
        width={xFor(45) - xFor(-45)}
        height={H - PAD_Y * 2 + 20}
        fill="var(--surface-2)"
        rx={12}
      />

      {/* fairway */}
      <rect
        x={xFor(-hole.fairwayWidthYards / 2)}
        y={yFor(Math.min(length, hole.fairwayEnd))}
        width={xFor(hole.fairwayWidthYards / 2) - xFor(-hole.fairwayWidthYards / 2)}
        height={Math.max(4, yFor(hole.fairwayStart) - yFor(Math.min(length, hole.fairwayEnd)))}
        fill="color-mix(in srgb, var(--accent) 18%, var(--surface-2))"
        rx={10}
      />

      {/* hazards */}
      {hole.hazards.map((hz) => {
        const top = yFor(Math.min(length, hz.endDistanceFromTee));
        const bottom = yFor(Math.max(0, hz.startDistanceFromTee));
        const height = Math.max(3, bottom - top);
        const latEnd = Math.min(hz.lateralEnd, HALF_CORRIDOR);
        let x1: number;
        let x2: number;
        if (hz.side === "CROSS") {
          x1 = xFor(-HALF_CORRIDOR);
          x2 = xFor(HALF_CORRIDOR);
        } else if (hz.side === "LEFT") {
          x1 = xFor(-latEnd);
          x2 = xFor(-hz.lateralStart);
        } else if (hz.side === "RIGHT") {
          x1 = xFor(hz.lateralStart);
          x2 = xFor(latEnd);
        } else {
          x1 = xFor(-latEnd);
          x2 = xFor(latEnd);
        }
        return (
          <rect
            key={hz.id}
            x={Math.min(x1, x2)}
            y={top}
            width={Math.abs(x2 - x1)}
            height={height}
            fill={hazardColor(hz.type)}
            opacity={hz.type === "OB" ? 0.32 : 0.55}
            rx={6}
          />
        );
      })}

      {/* dispersion recomendada */}
      {landing != null && recommendation ? (
        <ellipse
          cx={xFor(recommendation.targetOffset)}
          cy={yFor(landing)}
          rx={Math.max(12, (26 / HALF_CORRIDOR) * (W / 2))}
          ry={Math.max(10, 18 * yardToPx)}
          fill="color-mix(in srgb, var(--accent) 26%, transparent)"
          stroke="var(--accent)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      ) : null}

      {/* green */}
      <ellipse cx={W / 2} cy={greenY} rx={greenRx} ry={greenRy} fill="#3fbe80" opacity={0.9} />
      {/* bandera */}
      <g>
        <circle
          cx={xFor(geo.lateral)}
          cy={greenY - geo.depth * yardToPx}
          r={3.2}
          fill="var(--bg)"
        />
        <line
          x1={xFor(geo.lateral)}
          y1={greenY - geo.depth * yardToPx}
          x2={xFor(geo.lateral)}
          y2={greenY - geo.depth * yardToPx - 14}
          stroke="var(--text)"
          strokeWidth={1.4}
        />
        <polygon
          points={`${xFor(geo.lateral)},${greenY - geo.depth * yardToPx - 14} ${xFor(geo.lateral) + 9},${greenY - geo.depth * yardToPx - 11} ${xFor(geo.lateral)},${greenY - geo.depth * yardToPx - 8}`}
          fill={
            recommendation?.flagRisk === "RED"
              ? "var(--danger)"
              : recommendation?.flagRisk === "YELLOW"
                ? "var(--caution)"
                : "var(--accent)"
          }
        />
      </g>

      {/* posicion de la pelota */}
      <circle cx={W / 2} cy={yFor(ballDistanceFromTee)} r={4.5} fill="var(--text)" />

      {/* escala */}
      <text x={8} y={H - 8} fill="var(--muted)" fontSize={9} fontWeight={700}>
        TEE
      </text>
      <text x={8} y={PAD_Y - 12} fill="var(--muted)" fontSize={9} fontWeight={700}>
        {length} YD
      </text>
      <text x={W - 8} y={H - 8} fill="var(--muted)" fontSize={9} textAnchor="end" fontWeight={700}>
        SCHEMATIC
      </text>
    </svg>
  );
}
