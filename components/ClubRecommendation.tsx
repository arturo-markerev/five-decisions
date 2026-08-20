"use client";

import { useState } from "react";
import type { Recommendation } from "@/types/golf";
import { GOLDEN_RULE, goldenRuleApplies } from "@/lib/decision-engine";
import { RiskBadge } from "@/components/ui";

/**
 * Pantalla principal del golpe (seccion 21).
 * En menos de 5 segundos: PALO / TARGET / PELIGRO / SAFE MISS.
 * La explicacion vive detras de WHY?, nunca al frente.
 */
export default function ClubRecommendation({ rec }: { rec: Recommendation }) {
  const [why, setWhy] = useState(false);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <span className="eyebrow">Recommended</span>
        <div className="flex gap-2">
          {rec.flagRisk !== "GREEN" ? (
            <span className={`badge ${rec.flagRisk === "RED" ? "badge-red" : "badge-yellow"}`}>
              {rec.flagRisk} flag
            </span>
          ) : null}
          <RiskBadge level={rec.riskLevel} />
        </div>
      </div>

      <div className="value-xl mb-1">{rec.recommendedClub.toUpperCase()}</div>
      <div className="muted font-bold mb-4">
        PLANNING {rec.planningDistance} YD
        {rec.expectedRemainingDistance > 0 && rec.intent !== "APPROACH" ? (
          <> · LEAVES ~{rec.expectedRemainingDistance} YD</>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card-flat">
          <div className="eyebrow mb-1">Target</div>
          <div className="font-bold">{rec.target}</div>
          <div className="muted text-xs mt-1">{rec.targetOffsetLabel}</div>
        </div>
        <div className="card-flat">
          <div className="eyebrow mb-1">Safe miss</div>
          <div className="font-bold accent">{rec.safeMiss}</div>
        </div>
      </div>

      <div className="card-flat mt-3" style={{ borderLeft: "3px solid var(--danger)" }}>
        <div className="eyebrow mb-1">Avoid</div>
        <div className="font-bold danger">{rec.dangerMiss}</div>
      </div>

      <button className="btn btn-ghost mt-4" onClick={() => setWhy((v) => !v)}>
        {why ? "Hide" : "Why?"}
      </button>

      {why ? (
        <div className="mt-3">
          <p className="text-sm leading-relaxed">{rec.rationale}</p>
          {goldenRuleApplies(rec) ? (
            <p className="text-sm mt-3 caution font-semibold">{GOLDEN_RULE}</p>
          ) : null}
          {rec.alternatives.length > 0 ? (
            <div className="mt-4">
              <div className="eyebrow mb-2">Alternatives</div>
              {rec.alternatives.map((a) => (
                <div key={a.club + a.label} className="stat-row">
                  <span className="text-sm">
                    <strong>{a.club}</strong>
                    <span className="muted"> · {a.note}</span>
                  </span>
                  <span
                    className="badge"
                    style={
                      a.estimatedCost === "HIGH"
                        ? { color: "var(--danger)" }
                        : a.estimatedCost === "MEDIUM"
                          ? { color: "var(--caution)" }
                          : undefined
                    }
                  >
                    {a.estimatedCost} cost
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          <p className="muted text-xs mt-4">
            Estimated Decision Advantage · {rec.confidence} confidence · no strokes-gained table is being
            faked here.
          </p>
        </div>
      ) : null}
    </div>
  );
}
