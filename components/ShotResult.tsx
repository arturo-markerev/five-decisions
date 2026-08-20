"use client";

import type { ShotResultCode } from "@/types/golf";

const OPTIONS: Array<{ code: ShotResultCode; label: string; tone?: "danger" | "caution" }> = [
  { code: "FAIRWAY", label: "FAIRWAY" },
  { code: "GREEN", label: "GREEN" },
  { code: "LEFT_ROUGH", label: "LEFT ROUGH" },
  { code: "RIGHT_ROUGH", label: "RIGHT ROUGH" },
  { code: "SHORT", label: "SHORT" },
  { code: "LONG", label: "LONG" },
  { code: "LEFT", label: "LEFT" },
  { code: "RIGHT", label: "RIGHT" },
  { code: "BUNKER", label: "BUNKER", tone: "caution" },
  { code: "TREES", label: "TREES", tone: "caution" },
  { code: "WATER", label: "WATER", tone: "danger" },
  { code: "OB", label: "OB", tone: "danger" },
  { code: "OTHER", label: "OTHER" },
];

/** Un solo tap. Nada de formularios durante la ronda (seccion 24). */
export default function ShotResult({ onPick }: { onPick: (code: ShotResultCode) => void }) {
  return (
    <div>
      <div className="eyebrow mb-3">Where did it finish?</div>
      <div className="tap-grid">
        {OPTIONS.map((o) => (
          <button key={o.code} className="tap" data-tone={o.tone} onClick={() => onPick(o.code)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
