"use client";

import type { FlagPosition } from "@/types/golf";

const GRID: FlagPosition[][] = [
  ["BACK_LEFT", "BACK_CENTER", "BACK_RIGHT"],
  ["MIDDLE_LEFT", "MIDDLE_CENTER", "MIDDLE_RIGHT"],
  ["FRONT_LEFT", "FRONT_CENTER", "FRONT_RIGHT"],
];

export function flagLabel(f: FlagPosition): string {
  if (f === "UNKNOWN") return "Unknown / Center";
  return f
    .split("_")
    .map((p) => p[0] + p.slice(1).toLowerCase())
    .join(" ");
}

export default function FlagSelector({
  value,
  onChange,
}: {
  value: FlagPosition;
  onChange: (f: FlagPosition) => void;
}) {
  return (
    <div>
      <div
        style={{
          background: "color-mix(in srgb, var(--accent) 16%, var(--surface-2))",
          borderRadius: 18,
          padding: 10,
          border: "1px solid var(--line)",
        }}
      >
        {GRID.map((row, i) => (
          <div key={i} className="grid grid-cols-3 gap-2 mb-2 last:mb-0">
            {row.map((f) => {
              const selected = value === f;
              return (
                <button
                  key={f}
                  onClick={() => onChange(f)}
                  aria-pressed={selected}
                  style={{
                    height: 62,
                    borderRadius: 12,
                    border: selected ? "2px solid var(--accent)" : "1px solid var(--line)",
                    background: selected ? "var(--accent)" : "var(--surface)",
                    color: selected ? "#04150d" : "var(--muted)",
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "0.05em",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {selected ? "⛳" : f.split("_")[1][0] + f.split("_")[0][0]}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <button
        className="btn btn-ghost mt-3"
        data-selected={value === "UNKNOWN"}
        onClick={() => onChange("UNKNOWN")}
        style={value === "UNKNOWN" ? { color: "var(--accent)", borderColor: "var(--accent)" } : undefined}
      >
        Unknown / play the center
      </button>
      <div className="text-center mt-2 muted text-sm font-semibold">{flagLabel(value)}</div>
    </div>
  );
}
