"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Round } from "@/types/golf";
import { deleteRound, getCurrentRound, getRounds, saveCurrentRound } from "@/lib/storage";
import { computeRoundStats } from "@/lib/round-stats";
import { evaluateRound, totalEvents } from "@/lib/tiger-five-engine";
import { Card, Empty, PageHeader, Screen } from "@/components/ui";

export default function RoundsPage() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [current, setCurrent] = useState<Round | null>(null);

  function reload() {
    setRounds(getRounds().filter((r) => r.finishedAt));
    setCurrent(getCurrentRound());
  }

  useEffect(reload, []);

  return (
    <Screen>
      <PageHeader eyebrow="History" title="Rounds" />

      {current ? (
        <Card className="mb-4">
          <div className="eyebrow mb-2">In progress</div>
          <div className="font-bold mb-3">
            {current.courseName} · hole {current.currentHoleIndex + 1}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/play/round" className="btn btn-primary btn-sm">
              RESUME
            </Link>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => {
                if (!window.confirm("Discard the round in progress?")) return;
                saveCurrentRound(null);
                reload();
              }}
            >
              Discard
            </button>
          </div>
        </Card>
      ) : null}

      {rounds.length === 0 ? (
        <Empty title="No finished rounds yet" detail="Finish 18 holes and the full review shows up here." />
      ) : (
        <div className="grid gap-3">
          {rounds.map((r) => {
            const s = computeRoundStats(r);
            const tf = evaluateRound(r);
            return (
              <Link key={r.id} href={`/rounds/${r.id}`} className="card block">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-bold">{r.courseName}</div>
                    <div className="muted text-xs mt-1">
                      {new Date(r.startedAt).toLocaleDateString()} · {r.teeName} · {s.holesCompleted} holes
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="value-xl" style={{ fontSize: 30 }}>
                      {s.score}
                    </div>
                    <div className="muted text-xs mono">
                      {s.toPar > 0 ? `+${s.toPar}` : s.toPar}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <span className="badge">{totalEvents(tf.tally)} Tiger Five</span>
                  <span className="badge">{s.penalties} penalties</span>
                  <span className="badge">{s.threePutts} three-putts</span>
                </div>
                <button
                  className="btn btn-danger btn-sm mt-3"
                  onClick={(e) => {
                    e.preventDefault();
                    if (!window.confirm("Delete this round?")) return;
                    deleteRound(r.id);
                    reload();
                  }}
                >
                  Delete
                </button>
              </Link>
            );
          })}
        </div>
      )}
    </Screen>
  );
}
