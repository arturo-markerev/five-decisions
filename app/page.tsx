"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Round } from "@/types/golf";
import { getCurrentRound, getRounds } from "@/lib/storage";
import { computeRoundStats } from "@/lib/round-stats";
import { evaluateRound, totalEvents } from "@/lib/tiger-five-engine";
import TigerFiveWidget from "@/components/TigerFiveWidget";
import { Card, Screen } from "@/components/ui";

export default function HomePage() {
  const [last, setLast] = useState<Round | null>(null);
  const [current, setCurrent] = useState<Round | null>(null);

  useEffect(() => {
    const rounds = getRounds().filter((r) => r.finishedAt);
    setLast(rounds[0] ?? null);
    setCurrent(getCurrentRound());
  }, []);

  const stats = last ? computeRoundStats(last) : null;
  const tf = last ? evaluateRound(last) : null;

  return (
    <Screen>
      <header className="pt-12 pb-8">
        <h1 className="display" style={{ fontSize: 38, lineHeight: 1.05 }}>
          FIVE
          <br />
          DECISIONS
        </h1>
        <p className="muted font-semibold mt-3" style={{ letterSpacing: "0.02em" }}>
          Play Smarter. Score Lower.
        </p>
      </header>

      {current ? (
        <Card className="mb-4">
          <div className="eyebrow mb-2">Round in progress</div>
          <div className="font-bold mb-3">
            {current.courseName} · hole {current.currentHoleIndex + 1}
          </div>
          <Link href="/play/round" className="btn btn-primary">
            RESUME ROUND
          </Link>
        </Card>
      ) : (
        <Link href="/play" className="btn btn-primary mb-4">
          PLAY ROUND
        </Link>
      )}

      <Link href="/caddie" className="btn btn-secondary mb-4">
        CADDIE · READ THE HOLE
      </Link>

      <div className="grid grid-cols-2 gap-2 mb-6">
        <Link href="/courses" className="btn btn-secondary btn-sm">
          COURSES
        </Link>
        <Link href="/my-game" className="btn btn-secondary btn-sm">
          MY GAME
        </Link>
        <Link href="/rounds" className="btn btn-secondary btn-sm">
          ROUNDS
        </Link>
        <Link href="/insights" className="btn btn-secondary btn-sm">
          INSIGHTS
        </Link>
      </div>

      {last && stats && tf ? (
        <Card className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="eyebrow">Last round</span>
            <Link href={`/rounds/${last.id}`} className="badge">
              Open
            </Link>
          </div>
          <div className="font-bold mb-1">{last.courseName}</div>
          <div className="muted text-sm mb-4">
            {new Date(last.startedAt).toLocaleDateString()} · {stats.holesCompleted} holes
          </div>
          <div className="flex items-baseline gap-6 mb-5">
            <div>
              <div className="eyebrow mb-1">Score</div>
              <div className="value-xl">{stats.score}</div>
            </div>
            <div>
              <div className="eyebrow mb-1">To par</div>
              <div className="value-xl">
                {stats.toPar > 0 ? `+${stats.toPar}` : stats.toPar}
              </div>
            </div>
            <div>
              <div className="eyebrow mb-1">Tiger Five</div>
              <div className="value-xl">{totalEvents(tf.tally)}</div>
            </div>
          </div>
          <TigerFiveWidget tally={tf.tally} />
        </Card>
      ) : (
        <Card className="mb-4">
          <div className="eyebrow mb-2">No rounds yet</div>
          <p className="muted text-sm">
            The engine works offline from the first tee shot. Ventanas is loaded with MOCK geometry so you
            can test decisions before we load the real numbers.
          </p>
        </Card>
      )}

      <Link href="/settings" className="btn btn-ghost">
        SETTINGS
      </Link>

      <p className="muted text-xs text-center mt-8">
        Your official score, handicap and stats stay in TheGrint. This is the caddie.
      </p>
    </Screen>
  );
}
