"use client";

import { useEffect, useState } from "react";
import type { ClubLearning, PlayerProfile, Round } from "@/types/golf";
import { getProfile, getRounds, getUserCourses, saveProfile } from "@/lib/storage";
import { applyLearning, learnAllClubs } from "@/lib/player-learning";
import { courseConfidence } from "@/lib/course-learning";
import { mergeCourses } from "@/lib/courses";
import { Card, Empty, PageHeader, Screen, StatRow } from "@/components/ui";

function fmtPct(v: number | null): string {
  return v == null ? "—" : `${Math.round(v * 100)}%`;
}

export default function InsightsPage() {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [learning, setLearning] = useState<ClubLearning[]>([]);

  function reload() {
    const p = getProfile();
    const r = getRounds().filter((x) => x.finishedAt);
    setProfile(p);
    setRounds(r);
    setLearning(learnAllClubs(p, r));
  }

  useEffect(reload, []);

  if (!profile) return null;

  const courses = mergeCourses(getUserCourses());
  const withData = learning.filter((l) => l.shots > 0);

  return (
    <Screen>
      <PageHeader eyebrow="Learning Engine" title="Insights" />

      <div className="card-flat mb-4">
        <div className="eyebrow mb-1">Sample size protection</div>
        <p className="text-sm">
          Nothing in your profile changes automatically. Under 10 shots a club is INSUFFICIENT; suggestions
          only appear at USABLE (25+).
        </p>
      </div>

      <div className="eyebrow mb-2">Course confidence</div>
      <Card className="mb-6">
        {courses.map((c) => {
          const conf = courseConfidence(c, rounds);
          return (
            <StatRow
              key={c.id}
              label={c.name}
              value={`${conf.level} · ${conf.rounds} round${conf.rounds === 1 ? "" : "s"}`}
            />
          );
        })}
      </Card>

      <div className="eyebrow mb-2">Clubs</div>
      {withData.length === 0 ? (
        <Empty
          title="No shot data yet"
          detail="Play a round and the engine starts measuring your real distances and misses."
        />
      ) : (
        <div className="grid gap-3">
          {withData.map((l) => (
            <Card key={l.clubName}>
              <div className="flex items-center justify-between mb-3">
                <div className="font-bold">{l.clubName}</div>
                <span
                  className={`badge ${l.band === "RELIABLE" ? "badge-green" : l.band === "INSUFFICIENT" ? "" : "badge-yellow"}`}
                >
                  {l.band} · {l.shots}
                </span>
              </div>
              <StatRow label="Fairway" value={fmtPct(l.fairwayPct)} />
              <StatRow label="Green" value={fmtPct(l.greenPct)} />
              <StatRow label="Left / Right" value={`${fmtPct(l.leftPct)} / ${fmtPct(l.rightPct)}`} />
              <StatRow label="Short / Long" value={`${fmtPct(l.shortPct)} / ${fmtPct(l.longPct)}`} />
              <StatRow label="Penalty" value={fmtPct(l.penaltyPct)} />
              <StatRow label="Current planning distance" value={`${l.currentPlanningDistance} yd`} />
              <StatRow
                label="Observed planning distance"
                value={
                  l.observedMedianDistance != null
                    ? `${l.observedMedianDistance} yd (${l.observedDistanceSamples})`
                    : "—"
                }
              />
              {l.suggestedPlanningDistance != null &&
              l.suggestedPlanningDistance !== l.currentPlanningDistance ? (
                <button
                  className="btn btn-primary btn-sm mt-3"
                  onClick={() => {
                    const next = applyLearning(profile, l.clubName, l.suggestedPlanningDistance!);
                    saveProfile(next);
                    reload();
                  }}
                >
                  UPDATE MY GAME → {l.suggestedPlanningDistance} yd
                </button>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </Screen>
  );
}
