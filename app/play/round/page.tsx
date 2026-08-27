"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Course,
  FlagPosition,
  Hole,
  Lie,
  PlayerProfile,
  PuttResult,
  Recommendation,
  Round,
  ShotRecord,
  ShotResultCode,
  TigerFiveTally,
} from "@/types/golf";
import { mergeCourses } from "@/lib/courses";
import { recommendShot } from "@/lib/decision-engine";
import { buildHolePlan } from "@/lib/hole-plan";
import { learnHole } from "@/lib/course-learning";
import { evaluateHole, emptyTally, tigerFivePrompt } from "@/lib/tiger-five-engine";
import { puttPlan } from "@/lib/putting-engine";
import {
  correctMissFromResult,
  estimateNextDistance,
  LIE_OPTIONS,
  lieFromResult,
  penaltyFromResult,
} from "@/lib/shot-flow";
import {
  getCurrentRound,
  getProfile,
  getRounds,
  getUserCourses,
  saveCurrentRound,
  upsertRound,
} from "@/lib/storage";
import HoleHeader from "@/components/HoleHeader";
import HoleMap from "@/components/HoleMap";
import HolePlan from "@/components/HolePlan";
import FlagSelector, { flagLabel } from "@/components/FlagSelector";
import LaserInput from "@/components/LaserInput";
import ClubRecommendation from "@/components/ClubRecommendation";
import ShotResult from "@/components/ShotResult";
import PuttDistance from "@/components/PuttDistance";
import PuttCaddie from "@/components/PuttCaddie";
import TigerFiveWidget from "@/components/TigerFiveWidget";

type Phase =
  | "FLAG"
  | "HOLE_PLAN"
  | "PLAN"
  | "CLUB_OVERRIDE"
  | "LASER"
  | "LIE"
  | "RESULT"
  | "PUTT_DISTANCE"
  | "PUTT_RESULT"
  | "PUTT_TOTAL"
  | "HOLE_FINISH"
  | "HOLE_COMPLETE";

export default function RoundPage() {
  const router = useRouter();

  const [round, setRound] = useState<Round | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [phase, setPhase] = useState<Phase>("FLAG");

  const [shotNumber, setShotNumber] = useState(1);
  const [lie, setLie] = useState<Lie>("TEE");
  const [distance, setDistance] = useState(0);
  const [laser, setLaser] = useState<number | null>(null);
  const [overrideClub, setOverrideClub] = useState<string | null>(null);
  const [holeScore, setHoleScore] = useState<number | null>(null);
  const [holePenalties, setHolePenalties] = useState(0);

  /* ---------------- carga ---------------- */

  useEffect(() => {
    const r = getCurrentRound();
    if (!r) {
      router.replace("/play");
      return;
    }
    const courses = mergeCourses(getUserCourses());
    const c = courses.find((x) => x.id === r.courseId) ?? null;
    setRound(r);
    setCourse(c);
    setProfile(getProfile());

    const h = c?.holes[r.currentHoleIndex];
    if (h) setDistance(h.whiteTeeYardage);
    const rec = r.holes[r.currentHoleIndex];
    setShotNumber((rec?.shots.length ?? 0) + 1);
    setPhase(rec && rec.flagPosition !== "UNKNOWN" ? "PLAN" : "FLAG");
  }, [router]);

  const hole: Hole | null = useMemo(() => {
    if (!course || !round) return null;
    return course.holes[round.currentHoleIndex] ?? null;
  }, [course, round]);

  const holeRecord = useMemo(() => {
    if (!round) return null;
    return round.holes[round.currentHoleIndex] ?? null;
  }, [round]);

  const persist = useCallback((next: Round) => {
    setRound(next);
    saveCurrentRound(next);
  }, []);

  const updateHoleRecord = useCallback(
    (patch: Partial<Round["holes"][number]>) => {
      if (!round) return;
      const holes = round.holes.map((h, i) =>
        i === round.currentHoleIndex ? { ...h, ...patch } : h,
      );
      persist({ ...round, holes });
    },
    [round, persist],
  );

  /* ---------------- recomendacion ---------------- */

  const holeHistory = useMemo(() => {
    if (!round || !hole) return [];
    return learnHole(getRounds(), round.courseId, hole.holeNumber);
  }, [round, hole]);

  const recommendation: Recommendation | null = useMemo(() => {
    if (!profile || !hole || !holeRecord) return null;
    return recommendShot({
      profile,
      hole,
      shotNumber,
      lie,
      distanceToGreen: laser ?? distance,
      flagPosition: holeRecord.flagPosition,
      holeHistory,
    });
  }, [profile, hole, holeRecord, shotNumber, lie, laser, distance, holeHistory]);

  const holePlan = useMemo(() => {
    if (!profile || !hole || !holeRecord) return null;
    return buildHolePlan({
      profile,
      hole,
      flagPosition: holeRecord.flagPosition,
      holeHistory,
    });
  }, [profile, hole, holeRecord, holeHistory]);

  const tally: TigerFiveTally = useMemo(() => {
    const t = emptyTally();
    if (!round) return t;
    for (const h of round.holes) {
      for (const e of evaluateHole(h)) t[e.key] += 1;
    }
    return t;
  }, [round]);

  if (!round || !course || !hole || !holeRecord || !profile) {
    return (
      <main className="app-shell">
        <p className="muted pt-20 text-center">Loading round…</p>
      </main>
    );
  }

  const ballFromTee = Math.max(0, hole.whiteTeeYardage - (laser ?? distance));
  const clubList = profile.clubs.filter((c) => c.enabled && c.category !== "PUTTER");
  const playedClub = overrideClub ?? recommendation?.recommendedClub ?? "—";

  /* ---------------- acciones ---------------- */

  function exitRound() {
    router.push("/rounds");
  }

  function recordShot(result: ShotResultCode) {
    if (!recommendation || !round || !hole) return;
    const penalty = penaltyFromResult(result);
    const selected = overrideClub ?? recommendation.recommendedClub;
    const clubObj = profile?.clubs.find((c) => c.clubName === selected);
    const planning = clubObj?.planningDistance ?? recommendation.planningDistance;

    const shot: ShotRecord = {
      roundId: round.id,
      courseId: round.courseId,
      holeNumber: hole.holeNumber,
      shotNumber,
      club: selected,
      recommendedClub: recommendation.recommendedClub,
      selectedClub: selected,
      followedRecommendation: selected === recommendation.recommendedClub,
      planningDistance: planning,
      laserDistance: laser,
      distanceToGreen: laser ?? distance,
      lie,
      target: recommendation.target,
      targetOffsetYards: recommendation.targetOffset,
      safeMiss: recommendation.safeMiss,
      dangerMiss: recommendation.dangerMiss,
      flagPosition: holeRecord!.flagPosition,
      flagRisk: recommendation.flagRisk,
      result,
      penalty,
      correctMiss: correctMissFromResult(recommendation, result),
      strategyRisk: recommendation.riskLevel,
      decisionConfidence: recommendation.confidence,
      notes: "",
      timestamp: new Date().toISOString(),
    };

    const holes = round.holes.map((h, i) =>
      i === round.currentHoleIndex
        ? { ...h, shots: [...h.shots, shot], penalties: h.penalties + penalty }
        : h,
    );
    persist({ ...round, holes });

    const nextLie = lieFromResult(result, lie);
    const nextDistance = estimateNextDistance(laser ?? distance, planning, lie, result);

    setOverrideClub(null);
    setLaser(null);

    if (result === "GREEN") {
      setPhase("PUTT_DISTANCE");
      return;
    }

    setShotNumber((n) => n + penalty + 1);
    setLie(nextLie);
    setDistance(nextDistance);
    setPhase("PLAN");
  }

  function recordFirstPutt(steps: number) {
    updateHoleRecord({ firstPuttSteps: steps });
    setPhase("PUTT_RESULT");
  }

  function recordPuttResult(result: PuttResult) {
    updateHoleRecord({ firstPuttResult: result });
    if (result === "HOLED") {
      finishPutting(1);
      return;
    }
    setPhase("PUTT_TOTAL");
  }

  function finishPutting(putts: number) {
    if (!round) return;
    const rec = round.holes[round.currentHoleIndex];
    const strokes = rec.shots.length + rec.penalties + putts;
    updateHoleRecord({ putts });
    setHoleScore(strokes);
    setHolePenalties(rec.penalties);
    setPhase("HOLE_FINISH");
  }

  function confirmHole() {
    if (!round) return;
    updateHoleRecord({
      score: holeScore,
      penalties: holePenalties,
      completed: true,
    });
    setPhase("HOLE_COMPLETE");
  }

  function nextHole() {
    if (!round || !course) return;
    const nextIndex = round.currentHoleIndex + 1;
    if (nextIndex >= course.holes.length) {
      const finished: Round = { ...round, finishedAt: new Date().toISOString() };
      upsertRound(finished);
      saveCurrentRound(null);
      router.push(`/rounds/${finished.id}`);
      return;
    }
    const next: Round = { ...round, currentHoleIndex: nextIndex };
    persist(next);
    const h = course.holes[nextIndex];
    setDistance(h.whiteTeeYardage);
    setLaser(null);
    setLie("TEE");
    setShotNumber(1);
    setHoleScore(null);
    setHolePenalties(0);
    setOverrideClub(null);
    setPhase("FLAG");
  }

  /* ---------------- render ---------------- */

  const inPlay = recommendation?.tigerFiveRisk ?? [];
  const prompt = tigerFivePrompt(inPlay);
  const currentHoleEvents = evaluateHole({ ...holeRecord, completed: true });

  return (
    <main className="app-shell">
      <HoleHeader
        hole={hole}
        teeName={round.teeName}
        holeIndex={round.currentHoleIndex}
        totalHoles={course.holes.length}
        onExit={exitRound}
      />

      {phase === "FLAG" ? (
        <>
          <div className="eyebrow mb-2">Flag position</div>
          <FlagSelector
            value={holeRecord.flagPosition}
            onChange={(f: FlagPosition) => updateHoleRecord({ flagPosition: f })}
          />
          <div className="sticky-actions">
            <button className="btn btn-primary" onClick={() => setPhase("HOLE_PLAN")}>
              SEE THE PLAN
            </button>
          </div>
        </>
      ) : null}

      {phase === "HOLE_PLAN" && holePlan ? (
        <>
          <HolePlan plan={holePlan} />
          <div className="sticky-actions">
            <button className="btn btn-primary" onClick={() => setPhase("PLAN")}>
              PLAY THE HOLE
            </button>
            <button className="btn btn-ghost mt-2" onClick={() => setPhase("FLAG")}>
              Change the flag
            </button>
          </div>
        </>
      ) : null}

      {phase === "PLAN" && recommendation ? (
        <>
          <HoleMap
            hole={hole}
            recommendation={recommendation}
            flagPosition={holeRecord.flagPosition}
            ballDistanceFromTee={ballFromTee}
          />

          <div className="flex items-center justify-between mt-4 mb-3">
            <div>
              <div className="eyebrow">Shot {shotNumber}</div>
              <div className="font-bold">
                {(laser ?? distance).toFixed(0)} yd · {lie.replace("_", " ").toLowerCase()}
                {laser != null ? <span className="accent"> · laser</span> : null}
              </div>
            </div>
            <div className="flex gap-2">
              <button className="badge" onClick={() => setPhase("LASER")}>
                Laser
              </button>
              <button className="badge" onClick={() => setPhase("LIE")}>
                Lie
              </button>
              {shotNumber === 1 ? (
                <button className="badge" onClick={() => setPhase("HOLE_PLAN")}>
                  Plan
                </button>
              ) : null}
            </div>
          </div>

          {prompt ? (
            <div className="card-flat mb-3" style={{ borderLeft: "3px solid var(--caution)" }}>
              <span className="caution font-bold text-sm">⚠ {prompt}</span>
            </div>
          ) : null}

          <ClubRecommendation rec={recommendation} />

          <p className="mt-4 text-center font-semibold" style={{ fontSize: 15 }}>
            “{recommendation.caddieLine}”
          </p>

          {overrideClub ? (
            <p className="text-center muted text-sm mt-2">
              Playing <strong>{overrideClub}</strong> instead. Logged, not judged.
            </p>
          ) : null}

          <div className="mt-6">
            <TigerFiveWidget tally={tally} inPlay={inPlay} />
          </div>

          <div className="sticky-actions">
            <button className="btn btn-primary" onClick={() => setPhase("RESULT")}>
              PLAY THIS SHOT
            </button>
            <button className="btn btn-ghost mt-2" onClick={() => setPhase("CLUB_OVERRIDE")}>
              Different club
            </button>
          </div>
        </>
      ) : null}

      {phase === "CLUB_OVERRIDE" ? (
        <>
          <div className="eyebrow mb-3">Play a different club</div>
          <div className="tap-grid">
            {clubList.map((c) => (
              <button
                key={c.id}
                className="tap"
                data-selected={playedClub === c.clubName}
                onClick={() => {
                  setOverrideClub(c.clubName);
                  setPhase("PLAN");
                }}
              >
                <span>
                  {c.clubName}
                  <br />
                  <span className="muted" style={{ fontSize: 11 }}>
                    {c.planningDistance} yd
                  </span>
                </span>
              </button>
            ))}
          </div>
          <div className="sticky-actions">
            <button
              className="btn btn-ghost"
              onClick={() => {
                setOverrideClub(null);
                setPhase("PLAN");
              }}
            >
              Keep the recommendation
            </button>
          </div>
        </>
      ) : null}

      {phase === "LASER" ? (
        <LaserInput
          initial={laser ?? distance}
          onConfirm={(y) => {
            setLaser(y);
            setPhase("PLAN");
          }}
          onSkip={() => setPhase("PLAN")}
        />
      ) : null}

      {phase === "LIE" ? (
        <>
          <div className="eyebrow mb-3">Lie</div>
          <div className="tap-grid">
            {LIE_OPTIONS.map((o) => (
              <button
                key={o.value}
                className="tap"
                data-selected={lie === o.value}
                onClick={() => {
                  setLie(o.value);
                  setPhase("PLAN");
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {phase === "RESULT" ? (
        <>
          <div className="card-flat mb-4">
            <div className="eyebrow mb-1">Played</div>
            <div className="font-bold">{playedClub}</div>
          </div>
          <ShotResult onPick={recordShot} />
          <div className="sticky-actions">
            <button className="btn btn-ghost" onClick={() => setPhase("PLAN")}>
              Back
            </button>
          </div>
        </>
      ) : null}

      {phase === "PUTT_DISTANCE" ? <PuttDistance onPick={recordFirstPutt} /> : null}

      {phase === "PUTT_RESULT" && holeRecord.firstPuttSteps != null ? (
        <>
          <PuttCaddie steps={holeRecord.firstPuttSteps} />
          <div className="mt-5 eyebrow mb-3">Result</div>
          <div className="tap-grid">
            {(
              [
                ["HOLED", "HOLED"],
                ["UNDER_1_STEP", "< 1 STEP"],
                ["1_STEP", "1 STEP"],
                ["2_STEPS", "2 STEPS"],
                ["3_PLUS_STEPS", "3+ STEPS"],
              ] as Array<[PuttResult, string]>
            ).map(([code, label]) => (
              <button key={code} className="tap" onClick={() => recordPuttResult(code)}>
                {label}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {phase === "PUTT_TOTAL" ? (
        <>
          <div className="eyebrow mb-3">Total putts</div>
          <div className="tap-grid">
            {[1, 2, 3, 4].map((n) => (
              <button key={n} className="tap" onClick={() => finishPutting(n)}>
                {n === 4 ? "4+" : n}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {phase === "HOLE_FINISH" ? (
        <>
          <div className="eyebrow mb-2">Score</div>
          <div className="tap-grid-3 mb-5">
            {[2, 3, 4, 5, 6, 7, 8].map((n) => (
              <button
                key={n}
                className="tap"
                data-selected={holeScore === n}
                onClick={() => setHoleScore(n)}
              >
                {n === 8 ? "8+" : n}
              </button>
            ))}
          </div>
          <div className="eyebrow mb-2">Penalties</div>
          <div className="tap-grid-3 mb-5">
            {[0, 1, 2].map((n) => (
              <button
                key={n}
                className="tap"
                data-selected={holePenalties === n}
                onClick={() => setHolePenalties(n)}
              >
                {n === 2 ? "2+" : n}
              </button>
            ))}
          </div>
          <p className="muted text-sm">
            Putts logged: <strong>{holeRecord.putts ?? "—"}</strong>
          </p>
          <div className="sticky-actions">
            <button className="btn btn-primary" disabled={holeScore == null} onClick={confirmHole}>
              CONFIRM
            </button>
          </div>
        </>
      ) : null}

      {phase === "HOLE_COMPLETE" ? (
        <>
          <div className="card text-center py-8">
            <div className="eyebrow mb-3">Hole complete</div>
            {round.hideScore ? null : (
              <div className="display mb-3">{holeScore}</div>
            )}
            <div className="mb-4">
              <div className="eyebrow mb-1">Decision quality</div>
              <div className="headline accent">
                {holeRecord.shots.every((s) => s.followedRecommendation) ? "GOOD" : "MIXED"}
              </div>
            </div>
            <div>
              <div className="eyebrow mb-1">Tiger Five</div>
              <div className="font-bold">
                {currentHoleEvents.length === 0
                  ? "Clean hole"
                  : currentHoleEvents.map((e) => e.key.replace(/_/g, " ")).join(" · ")}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <TigerFiveWidget tally={tally} />
          </div>

          <div className="sticky-actions">
            <button className="btn btn-primary" onClick={nextHole}>
              {round.currentHoleIndex + 1 >= course.holes.length ? "FINISH ROUND" : "NEXT HOLE"}
            </button>
          </div>
        </>
      ) : null}

      <p className="muted text-xs text-center mt-8">
        Flag: {flagLabel(holeRecord.flagPosition)} ·{" "}
        {holeRecord.firstPuttSteps != null
          ? `first putt ${holeRecord.firstPuttSteps} steps (${puttPlan(holeRecord.firstPuttSteps).objectiveLabel})`
          : "flag set once per hole"}
      </p>
    </main>
  );
}
