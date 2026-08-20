"use client";

import { PUTT_STEP_OPTIONS } from "@/lib/putting-engine";

/** Pasos, porque en cancha puedo contar pasos (seccion 33). */
export default function PuttDistance({ onPick }: { onPick: (steps: number) => void }) {
  return (
    <div>
      <div className="eyebrow mb-1">First putt distance</div>
      <div className="muted text-sm mb-3">In steps. Count them walking to the ball.</div>
      <div className="grid grid-cols-4 gap-2">
        {PUTT_STEP_OPTIONS.map((s) => (
          <button key={s} className="tap" style={{ minHeight: 58 }} onClick={() => onPick(s)}>
            {s === 20 ? "20+" : s}
          </button>
        ))}
      </div>
    </div>
  );
}
