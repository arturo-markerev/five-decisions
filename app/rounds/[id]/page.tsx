"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { Round } from "@/types/golf";
import { TIGER_FIVE_LABELS } from "@/types/golf";
import { getRounds } from "@/lib/storage";
import { coachReport, computeRoundStats, decisionReview, pct } from "@/lib/round-stats";
import { evaluateRound, totalEvents, TIGER_FIVE_KEYS, TIGER_FIVE_SUBTITLE } from "@/lib/tiger-five-engine";
import TigerFiveWidget from "@/components/TigerFiveWidget";
import { Card, Empty, PageHeader, Screen, StatRow } from "@/components/ui";

export default function RoundReviewPage() {
  const params = useParams<{ id: string }>();
  const [round, setRound] = useState<Round | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const id = params?.id;
    setRound(getRounds().find((r) => r.id === id) ?? null);
    setLoaded(true);
  }, [params]);

  if (!loaded) {
    return (
      <Screen>
        <p className="muted pt-20 text-center">Loading…</p>
      </Screen>
    );
  }

  if (!round) {
    return (
      <Screen>
        <PageHeader eyebrow="Round" title="Not found" />
        <Empty title="This round is not on this device" detail="Rounds live in local storage on the phone that played them." />
      </Screen>
    );
  }

  const stats = computeRoundStats(round);
  const { events, tally } = evaluateRound(round);
  const review = decisionReview(round);
  const coach = coachReport(round);
  const prevRounds = getRounds()
    .filter((r) => r.finishedAt && r.id !== round.id)
    .slice(0, 10);
  const last5 = prevRounds.slice(0, 5).map((r) => totalEvents(evaluateRound(r).tally));
  const avg5 = last5.length ? (last5.reduce((a, b) => a + b, 0) / last5.length).toFixed(1) : "—";
  const best = prevRounds.length
    ? Math.min(...prevRounds.map((r) => totalEvents(evaluateRound(r).tally)))
    : null;

  return (
    <Screen>
      <PageHeader eyebrow="Round Review" title={round.courseName} />

      <Card className="mb-4">
        <div className="flex items-baseline gap-8 mb-4">
          <div>
            <div className="eyebrow mb-1">Score</div>
            <div className="display">{stats.score}</div>
          </div>
          <div>
            <div className="eyebrow mb-1">To par</div>
            <div className="display">{stats.toPar > 0 ? `+${stats.toPar}` : stats.toPar}</div>
          </div>
        </div>
        <div className="muted text-sm">
          {new Date(round.startedAt).toLocaleDateString()} · {round.teeName} tees ·{" "}
          {stats.holesCompleted} holes
        </div>
      </Card>

      <Card className="mb-4">
        <div className="eyebrow mb-2">The numbers</div>
        <StatRow label="Fairways" value={`${stats.fairwaysHit}/${stats.fairwayOpportunities}`} />
        <StatRow label="Greens in regulation" value={`${stats.gir}/${stats.girOpportunities}`} />
        <StatRow label="Putts" value={stats.putts} />
        <StatRow label="1 putts" value={stats.onePutts} />
        <StatRow label="3 putts" value={stats.threePutts} />
        <StatRow label="Penalties" value={stats.penalties} />
        <StatRow label="Doubles+" value={stats.doublesPlus} />
        <StatRow
          label="Scrambling"
          value={`${stats.scramblingSuccess}/${stats.scramblingAttempts}`}
        />
        <StatRow
          label="Correct miss %"
          value={pct(stats.correctMisses, stats.missOpportunities)}
        />
        <StatRow
          label="Recommendation follow %"
          value={pct(stats.recommendationsFollowed, stats.recommendationOpportunities)}
        />
      </Card>

      <Card className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="eyebrow">Tiger Five — H18</span>
          <span className="muted" style={{ fontSize: 10 }}>
            {TIGER_FIVE_SUBTITLE}
          </span>
        </div>
        <TigerFiveWidget tally={tally} compact />
        <div className="mt-4">
          {TIGER_FIVE_KEYS.map((k) => (
            <StatRow key={k} label={TIGER_FIVE_LABELS[k]} value={tally[k]} />
          ))}
          <StatRow label="TOTAL EVENTS" value={totalEvents(tally)} />
        </div>
        <div className="mt-4 card-flat">
          <StatRow label="Last 5 rounds average" value={avg5} />
          <StatRow label="Personal best" value={best ?? "—"} />
        </div>
        {events.length > 0 ? (
          <div className="mt-4">
            <div className="eyebrow mb-2">Events</div>
            {events.map((e, i) => (
              <div key={i} className="stat-row">
                <span className="text-sm">
                  <strong>H{e.holeNumber}</strong> · {TIGER_FIVE_LABELS[e.key]}
                  {e.cause ? <span className="muted"> · by {e.cause.toLowerCase()}</span> : null}
                </span>
                <span className="muted text-xs">{e.detail}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="accent font-bold mt-4">Clean round. Zero Tiger Five events.</p>
        )}
      </Card>

      <Card className="mb-4">
        <div className="eyebrow mb-1">Coach report</div>
        <p className="muted text-xs mb-3">
          Costs are shown as bands. No strokes-gained table is being faked.
        </p>
        <div className="eyebrow mb-2">What cost you today</div>
        {coach.cost.length === 0 ? (
          <p className="text-sm mb-4">Nothing structural. That is the goal.</p>
        ) : (
          coach.cost.map((c, i) => (
            <div key={i} className="stat-row">
              <span className="text-sm font-bold">
                {i + 1}. {c.title}
              </span>
              <span className="muted text-xs">{c.detail}</span>
            </div>
          ))
        )}
        <div className="eyebrow mt-5 mb-2">What you did well</div>
        {coach.good.map((c, i) => (
          <div key={i} className="stat-row">
            <span className="text-sm font-bold accent">{c.title}</span>
            <span className="muted text-xs">{c.detail}</span>
          </div>
        ))}
      </Card>

      <Card className="mb-4">
        <div className="eyebrow mb-1">Decision vs execution</div>
        <p className="muted text-xs mb-3">
          A good decision can produce a bad result. That is still a good decision.
        </p>
        {review.length === 0 ? (
          <p className="muted text-sm">No logged shots.</p>
        ) : (
          review.map((r, i) => (
            <div key={i} className="stat-row">
              <span className="text-sm">
                <strong>H{r.holeNumber}</strong> · {r.played}
                {r.decision === "OVERRIDE" ? (
                  <span className="muted"> (rec: {r.recommended})</span>
                ) : null}
              </span>
              <span className="flex gap-2">
                <span className={`badge ${r.decision === "GOOD" ? "badge-green" : "badge-yellow"}`}>
                  {r.decision}
                </span>
                <span
                  className={`badge ${r.execution === "PENALTY" ? "badge-red" : r.execution === "HIT" ? "badge-green" : ""}`}
                >
                  {r.execution}
                </span>
              </span>
            </div>
          ))
        )}
      </Card>

      <Link href="/rounds" className="btn btn-secondary">
        BACK TO ROUNDS
      </Link>
    </Screen>
  );
}
