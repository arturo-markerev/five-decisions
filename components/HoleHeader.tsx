"use client";

import type { Hole } from "@/types/golf";
import { MockBadge } from "@/components/ui";

export default function HoleHeader({
  hole,
  teeName,
  holeIndex,
  totalHoles,
  onExit,
}: {
  hole: Hole;
  teeName: string;
  holeIndex: number;
  totalHoles: number;
  onExit: () => void;
}) {
  return (
    <header className="pt-6 pb-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={onExit} className="eyebrow" style={{ letterSpacing: "0.12em" }}>
          ← Exit
        </button>
        <span className="eyebrow">
          {holeIndex + 1} / {totalHoles}
        </span>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <div className="eyebrow mb-1">Hole</div>
          <div className="display">{hole.holeNumber}</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-extrabold">PAR {hole.par}</div>
          <div className="muted text-sm font-semibold">
            {teeName.toUpperCase()} · {hole.whiteTeeYardage} YD
          </div>
          <div className="mt-2">
            <MockBadge quality={hole.dataQuality} />
          </div>
        </div>
      </div>
    </header>
  );
}
