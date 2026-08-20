"use client";

import type { TigerFiveKey, TigerFiveTally } from "@/types/golf";
import { TIGER_FIVE_LABELS } from "@/types/golf";
import { TIGER_FIVE_KEYS, TIGER_FIVE_SUBTITLE } from "@/lib/tiger-five-engine";

/**
 * Discreto durante la ronda (seccion 16).
 * Nunca mensajes negativos permanentes: solo el marcador de eventos.
 */
export default function TigerFiveWidget({
  tally,
  inPlay = [],
  compact = false,
}: {
  tally: TigerFiveTally;
  inPlay?: TigerFiveKey[];
  compact?: boolean;
}) {
  return (
    <div>
      {!compact ? (
        <div className="flex items-center justify-between mb-2">
          <span className="eyebrow">Tiger Five — H18</span>
          <span className="muted" style={{ fontSize: 10 }}>
            {TIGER_FIVE_SUBTITLE}
          </span>
        </div>
      ) : null}
      <div className="tiger-strip">
        {TIGER_FIVE_KEYS.map((k) => (
          <div key={k} className="tiger-cell" data-hot={inPlay.includes(k)}>
            <div className="tiger-label">{TIGER_FIVE_LABELS[k]}</div>
            <div className="tiger-value" style={tally[k] > 0 ? { color: "var(--caution)" } : undefined}>
              {tally[k]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
