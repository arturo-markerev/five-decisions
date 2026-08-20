"use client";

import type { ReactNode } from "react";
import type { Confidence, RiskLevel } from "@/types/golf";

export function Screen({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return <main className={wide ? "wide-shell" : "app-shell"}>{children}</main>;
}

export function PageHeader({
  eyebrow,
  title,
  right,
}: {
  eyebrow?: string;
  title: string;
  right?: ReactNode;
}) {
  return (
    <header className="flex items-end justify-between pt-8 pb-5">
      <div>
        {eyebrow ? <div className="eyebrow mb-1">{eyebrow}</div> : null}
        <h1 className="headline">{title}</h1>
      </div>
      {right}
    </header>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className ?? ""}`}>{children}</section>;
}

export function Label({ children }: { children: ReactNode }) {
  return <div className="eyebrow mb-2">{children}</div>;
}

export function StatRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="stat-row">
      <span className="muted text-sm">{label}</span>
      <span className="font-bold mono">{value}</span>
    </div>
  );
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  const cls = level === "RED" ? "badge-red" : level === "YELLOW" ? "badge-yellow" : "badge-green";
  return <span className={`badge ${cls}`}>{level}</span>;
}

export function ConfidenceBadge({ level }: { level: Confidence }) {
  return <span className="badge">{level} confidence</span>;
}

export function MockBadge({ quality }: { quality: string }) {
  if (quality === "REAL") return <span className="badge badge-green">Real data</span>;
  if (quality === "EMPTY") return <span className="badge badge-mock">No data</span>;
  if (quality === "PARTIAL") return <span className="badge badge-mock">Partial</span>;
  return <span className="badge badge-mock">Mock data</span>;
}

export function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="card text-center py-10">
      <div className="font-bold mb-2">{title}</div>
      <p className="muted text-sm">{detail}</p>
    </div>
  );
}
