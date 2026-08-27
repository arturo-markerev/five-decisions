"use client";

import type { HolePlanResult } from "@/lib/hole-plan";
import { TIGER_FIVE_LABELS } from "@/types/golf";
import { RiskBadge } from "@/components/ui";

/**
 * El plan entero del hoyo en una pantalla, antes de pegar.
 * Orden deliberado: primero el numero, despues el plan, despues el peligro,
 * y al final la UNICA regla con la que hay que salir del tee.
 */
export default function HolePlan({ plan }: { plan: HolePlanResult }) {
  return (
    <div className="grid gap-3">
      <section className="card" style={{ textAlign: "center" }}>
        <div className="eyebrow mb-2">Play for</div>
        <div className="display" style={{ fontSize: 38 }}>
          {plan.yourNumberLabel}
        </div>
        <div className="muted text-sm mt-2">
          <span className="accent font-bold">{plan.upsideLabel}</span> is upside ·{" "}
          <span className="danger font-bold">{plan.avoidLabel}</span> is what breaks the round
        </div>
      </section>

      <section className="card">
        <div className="flex items-center justify-between mb-3">
          <span className="eyebrow">{plan.tee.label}</span>
          <RiskBadge level={plan.tee.risk} />
        </div>
        <div className="value-xl" style={{ fontSize: 30 }}>
          {plan.tee.club.toUpperCase()}
        </div>
        <div className="font-bold mt-1">{plan.tee.target}</div>
        <div className="muted text-sm mt-1">{plan.tee.detail}</div>

        {plan.approach ? (
          <>
            <div className="divider my-4" />
            <div className="flex items-center justify-between mb-2">
              <span className="eyebrow">{plan.approach.label}</span>
              <RiskBadge level={plan.approach.risk} />
            </div>
            <div className="font-bold" style={{ fontSize: 20 }}>
              {plan.approach.club.toUpperCase()}
            </div>
            <div className="font-bold mt-1">{plan.approach.target}</div>
            <div className="muted text-sm mt-1">{plan.approach.detail}</div>
            <p className="muted text-xs mt-3">
              The approach assumes an average tee shot. Laser the real number when you get there.
            </p>
          </>
        ) : null}
      </section>

      <section className="card-flat" style={{ borderLeft: "3px solid var(--danger)" }}>
        <div className="eyebrow mb-1">The danger</div>
        <div className="font-bold">{plan.danger}</div>
        {!plan.hasFairwayGeometry ? (
          <p className="caution text-xs mt-2">
            No fairway distances loaded for this hole yet, so the tee plan is based on the green only.
          </p>
        ) : null}
      </section>

      <section className="card" style={{ borderColor: "var(--accent)" }}>
        <div className="eyebrow mb-2">Decision {plan.rule} · the one that matters here</div>
        <div className="headline accent" style={{ fontSize: 22 }}>
          {plan.ruleName}
        </div>
        <p className="text-sm mt-2 leading-relaxed">{plan.ruleWhy}</p>
      </section>

      {plan.tigerFive.length > 0 ? (
        <section className="card-flat" style={{ borderLeft: "3px solid var(--caution)" }}>
          <div className="eyebrow mb-1">Tiger Five in play</div>
          <div className="font-bold caution">
            {plan.tigerFive.map((k) => TIGER_FIVE_LABELS[k]).join(" · ")}
          </div>
        </section>
      ) : (
        <section className="card-flat">
          <div className="eyebrow mb-1">Tiger Five</div>
          <div className="font-bold accent">Nothing forced here. Just play the hole.</div>
        </section>
      )}

      <p className="text-center font-semibold" style={{ fontSize: 16 }}>
        “{plan.caddieLine}”
      </p>
    </div>
  );
}
