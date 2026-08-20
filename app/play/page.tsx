"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Course, Round } from "@/types/golf";
import { mergeCourses, isPlayable } from "@/lib/courses";
import { getSettings, getUserCourses, newId, saveCurrentRound, getCurrentRound } from "@/lib/storage";
import { Card, MockBadge, PageHeader, Screen } from "@/components/ui";

export default function PlaySetupPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState<string>("ventanas");
  const [teeId, setTeeId] = useState<string>("white");
  const [hideScore, setHideScore] = useState(true);
  const [existing, setExisting] = useState<Round | null>(null);

  useEffect(() => {
    setCourses(mergeCourses(getUserCourses()));
    const s = getSettings();
    setHideScore(s.hideScoreDefault);
    setTeeId(s.defaultTeeId);
    setExisting(getCurrentRound());
  }, []);

  const course = useMemo(() => courses.find((c) => c.id === courseId) ?? null, [courses, courseId]);
  const playable = course != null && isPlayable(course);

  function start() {
    if (!course) return;
    const tee = course.tees.find((t) => t.id === teeId) ?? course.tees[0];
    const round: Round = {
      id: newId("round"),
      courseId: course.id,
      courseName: course.name,
      teeId: tee.id,
      teeName: tee.name,
      hideScore,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      currentHoleIndex: 0,
      holes: course.holes.map((h) => ({
        holeNumber: h.holeNumber,
        par: h.par,
        flagPosition: "UNKNOWN",
        shots: [],
        firstPuttSteps: null,
        firstPuttResult: null,
        putts: null,
        penalties: 0,
        score: null,
        completed: false,
      })),
    };
    saveCurrentRound(round);
    router.push("/play/round");
  }

  return (
    <Screen>
      <PageHeader eyebrow="Five Decisions" title="Play Round" />

      {existing ? (
        <Card className="mb-4">
          <div className="eyebrow mb-2">Round in progress</div>
          <div className="font-bold mb-3">
            {existing.courseName} · hole {existing.currentHoleIndex + 1}
          </div>
          <button className="btn btn-primary" onClick={() => router.push("/play/round")}>
            RESUME
          </button>
        </Card>
      ) : null}

      <div className="eyebrow mb-2">Select course</div>
      <div className="grid gap-2 mb-6">
        {courses.map((c) => {
          const ok = isPlayable(c);
          return (
            <button
              key={c.id}
              onClick={() => {
                setCourseId(c.id);
                setTeeId(c.tees[0]?.id ?? "white");
              }}
              className="card text-left"
              style={{
                borderColor: courseId === c.id ? "var(--accent)" : "var(--line)",
                opacity: ok ? 1 : 0.55,
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold">{c.name}</div>
                  <div className="muted text-xs mt-1">
                    {ok ? `${c.holes.length} holes` : "No holes loaded yet"}
                    {c.nameConfirmed ? "" : " · name unconfirmed"}
                  </div>
                </div>
                <MockBadge quality={c.dataQuality} />
              </div>
            </button>
          );
        })}
      </div>

      {course && course.tees.length > 0 ? (
        <>
          <div className="eyebrow mb-2">Tee</div>
          <div className="tap-grid-3 mb-6">
            {course.tees.map((t) => (
              <button
                key={t.id}
                className="tap"
                data-selected={teeId === t.id}
                onClick={() => setTeeId(t.id)}
              >
                {t.name}
              </button>
            ))}
          </div>
        </>
      ) : null}

      <div className="eyebrow mb-2">Mode</div>
      <div className="tap-grid mb-2">
        <button className="tap" data-selected={hideScore} onClick={() => setHideScore(true)}>
          HIDE SCORE
        </button>
        <button className="tap" data-selected={!hideScore} onClick={() => setHideScore(false)}>
          SHOW SCORE
        </button>
      </div>
      <p className="muted text-xs mb-6">
        Hide Score keeps the total out of sight all round. It is still recorded silently and shown at the
        end.
      </p>

      {!playable ? (
        <p className="caution text-sm mb-3 font-semibold">
          This course has no hole data yet. Load it in Course Builder first — nothing was invented for it.
        </p>
      ) : null}

      <div className="sticky-actions">
        <button className="btn btn-primary" disabled={!playable} onClick={start}>
          START ROUND
        </button>
      </div>
    </Screen>
  );
}
