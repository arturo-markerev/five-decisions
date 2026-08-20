"use client";

import { useState } from "react";

/**
 * El laser manda sobre el GPS estimado (seccion 25).
 * Input gigante, ajustes de -5/-1/+1/+5, cero teclado si no hace falta.
 */
export default function LaserInput({
  initial,
  onConfirm,
  onSkip,
}: {
  initial: number;
  onConfirm: (yards: number) => void;
  onSkip?: () => void;
}) {
  const [value, setValue] = useState<number>(Math.max(1, Math.round(initial)));

  const bump = (n: number) => setValue((v) => Math.max(1, Math.min(700, v + n)));

  return (
    <div>
      <div className="eyebrow mb-2">Distance</div>
      <input
        className="num-input mono"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
          setValue(Number.isNaN(n) ? 0 : Math.min(700, n));
        }}
        aria-label="Laser distance in yards"
      />
      <div className="text-center muted font-bold mt-1 mb-3">YD</div>
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[-5, -1, 1, 5].map((n) => (
          <button key={n} className="tap" style={{ minHeight: 56 }} onClick={() => bump(n)}>
            {n > 0 ? `+${n}` : n}
          </button>
        ))}
      </div>
      <button className="btn btn-primary" onClick={() => onConfirm(value)}>
        USE {value} YD
      </button>
      {onSkip ? (
        <button className="btn btn-ghost mt-2" onClick={onSkip}>
          Skip — use estimate
        </button>
      ) : null}
    </div>
  );
}
