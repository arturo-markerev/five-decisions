"use client";

import { LONG_PUTT_PHILOSOPHY, puttPlan } from "@/lib/putting-engine";

export default function PuttCaddie({ steps }: { steps: number }) {
  const plan = puttPlan(steps);
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <span className="eyebrow">Putt · {steps === 20 ? "20+" : steps} steps</span>
        <span className="badge badge-green">{plan.objectiveLabel}</span>
      </div>
      <div className="value-xl mb-2" style={{ fontSize: 26 }}>
        {plan.message}
      </div>
      <div className="card-flat">
        <div className="eyebrow mb-1">Target</div>
        <div className="font-bold">{plan.finishTarget}</div>
      </div>
      {steps >= 5 ? <p className="muted text-xs mt-3">{LONG_PUTT_PHILOSOPHY}</p> : null}
    </div>
  );
}
