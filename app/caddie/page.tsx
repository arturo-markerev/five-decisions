"use client";

import { useEffect, useMemo, useState } from "react";
import type { Course, FlagPosition, PlayerProfile } from "@/types/golf";
import { TIGER_FIVE_LABELS } from "@/types/golf";
import { isPlayable, mergeCourses } from "@/lib/courses";
import { getProfile, getUserCourses } from "@/lib/storage";
import { buildCaddieBrief } from "@/lib/caddie-brief";
import { MockBadge, RiskBadge, Screen } from "@/components/ui";
import { flagLabel } from "@/components/FlagSelector";

/**
 * CADDIE — el hoyo entero en un scroll, sin jugar nada.
 * El score va en TheGrint. Aca solo se lee, en el tee, antes de pegar.
 */

const FLAG_ROW: FlagPosition[] = ["UNKNOWN", "FRONT_CENTER", "MIDDLE_CENTER", "BACK_CENTER"];
const FLAG_SIDE: Record<string, FlagPosition[]> = {
  FRONT_CENTER: ["FRONT_LEFT", "FRONT_CENTER", "FRONT_RIGHT"],
  MIDDLE_CENTER: ["MIDDLE_LEFT", "MIDDLE_CENTER", "MIDDLE_RIGHT"],
  BACK_CENTER: ["BACK_LEFT", "BACK_CENTER", "BACK_RIGHT"],
};

export default function CaddiePage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [courseId, setCourseId] = useState("");
  const [holeIndex, setHoleIndex] = useState(0);
  const [flag, setFlag] = useState<FlagPosition>("UNKNOWN");

  useEffect(() => {
    const list = mergeCourses(getUserCourses()).filter(isPlayable);
    setCourses(list);
    setCourseId(list[0]?.id ?? "");
    setProfile(getProfile());
  }, []);

  const course = useMemo(() => courses.find((c) => c.id === courseId) ?? null, [courses, courseId]);
  const hole = course?.holes[holeIndex] ?? null;

  const brief = useMemo(() => {
    if (!profile || !hole) return null;
    return buildCaddieBrief({ profile, hole, flagPosition: flag });
  }, [profile, hole, flag]);

  if (!course || !hole || !brief) {
    return (
      <Screen>
        <header className="pt-10 pb-6">
          <div className="eyebrow mb-1">Five Decisions</div>
          <h1 className="headline">Caddie</h1>
        </header>
        <p className="muted">Load a course first and the caddie has something to read.</p>
      </Screen>
    );
  }

  const depthKey = flag === "UNKNOWN" ? "MIDDLE_CENTER" : `${flag.split("_")[0]}_CENTER`;

  return (
    <Screen>
      <header className="pt-8 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="eyebrow">Caddie · read only</div>
          <MockBadge quality={brief.dataQuality} />
        </div>
        {/* Botones a la vista: un select sin flecha parecia un titulo y el
            jugador no encontraba el segundo campo. */}
        <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: `repeat(${Math.min(courses.length, 2)}, minmax(0, 1fr))` }}>
          {courses.map((c) => (
            <button
              key={c.id}
              className="tap"
              style={{ minHeight: 52, fontSize: 13, lineHeight: 1.2 }}
              data-selected={courseId === c.id}
              onClick={() => {
                setCourseId(c.id);
                setHoleIndex(0);
                setFlag("UNKNOWN");
              }}
            >
              {c.name.replace(/^Club de Golf /, "")}
            </button>
          ))}
        </div>

        <div className="flex items-end justify-between">
          <div>
            <div className="eyebrow mb-1">Hole</div>
            <div className="display">{brief.holeNumber}</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-extrabold">PAR {brief.par}</div>
            <div className="muted text-sm font-semibold">
              {brief.yardage} YD · HCP {brief.handicapIndex}
            </div>
          </div>
        </div>
      </header>

      {/* Bandera: cambia el plan, asi que va arriba y en dos taps */}
      <section className="card mb-3">
        <div className="eyebrow mb-2">Flag · {flagLabel(flag)}</div>
        <div className="grid grid-cols-4 gap-2 mb-2">
          {FLAG_ROW.map((f) => (
            <button
              key={f}
              className="tap"
              style={{ minHeight: 44, fontSize: 12 }}
              data-selected={f === "UNKNOWN" ? flag === "UNKNOWN" : flag.startsWith(f.split("_")[0])}
              onClick={() => setFlag(f)}
            >
              {f === "UNKNOWN" ? "?" : f.split("_")[0]}
            </button>
          ))}
        </div>
        {flag !== "UNKNOWN" ? (
          <div className="grid grid-cols-3 gap-2">
            {(FLAG_SIDE[depthKey] ?? []).map((f) => (
              <button
                key={f}
                className="tap"
                style={{ minHeight: 44, fontSize: 12 }}
                data-selected={flag === f}
                onClick={() => setFlag(f)}
              >
                {f.split("_")[1]}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="card mb-3" style={{ textAlign: "center" }}>
        <div className="eyebrow mb-2">Play for</div>
        <div className="display" style={{ fontSize: 36 }}>
          {brief.playFor}
        </div>
        <div className="muted text-sm mt-2">
          <span className="accent font-bold">{brief.upside}</span> is upside ·{" "}
          <span className="danger font-bold">{brief.breaks}</span> breaks the round
        </div>
      </section>

      <section className="card mb-3">
        <div className="eyebrow mb-3">What the hole has</div>
        {brief.forcedCarry ? (
          <div className="card-flat mb-2" style={{ borderLeft: "3px solid var(--danger)" }}>
            <span className="font-bold danger">Forced carry of {brief.forcedCarry} yd</span>
          </div>
        ) : null}
        {brief.hazards.length === 0 ? (
          <p className="muted text-sm">Nothing loaded for this hole yet.</p>
        ) : (
          brief.hazards.map((h, i) => (
            <div key={i} className="stat-row">
              <span className="text-sm">{h.text}</span>
              {h.costsAStroke ? <span className="badge badge-red">Penalty</span> : null}
            </div>
          ))
        )}
        {!brief.hasFairwayGeometry ? (
          <p className="caution text-xs mt-3">
            No fairway distances loaded here, so the tee plan is read off the green only.
          </p>
        ) : null}
      </section>

      <div className="eyebrow mb-2">Shot by shot</div>
      {brief.shots.map((s) => (
        <section className="card mb-3" key={s.number}>
          <div className="flex items-center justify-between mb-2">
            <span className="eyebrow">
              {s.number}. {s.title}
            </span>
            <RiskBadge level={s.risk} />
          </div>
          <div className="value-xl" style={{ fontSize: 27 }}>
            {s.club.toUpperCase()}
          </div>
          <div className="font-bold mt-1">{s.target}</div>
          <div className="muted text-sm mt-1">{s.leaves}</div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="card-flat">
              <div className="eyebrow mb-1">Safe miss</div>
              <div className="font-bold accent text-sm">{s.safeMiss}</div>
            </div>
            <div className="card-flat">
              <div className="eyebrow mb-1">Avoid</div>
              <div className="font-bold danger text-sm">{s.avoid}</div>
            </div>
          </div>
          <p className="text-center font-semibold mt-3" style={{ fontSize: 14 }}>
            “{s.caddieLine}”
          </p>
        </section>
      ))}

      <section className="card mb-3">
        <div className="eyebrow mb-2">Around the green</div>
        {brief.greenNotes.map((n, i) => (
          <p key={i} className="text-sm mb-1">
            {n}
          </p>
        ))}
      </section>

      <section className="card mb-3" style={{ borderColor: "var(--accent)" }}>
        <div className="eyebrow mb-2">Decision {brief.rule} · the one that matters here</div>
        <div className="headline accent" style={{ fontSize: 21 }}>
          {brief.ruleName}
        </div>
        <p className="text-sm mt-2 leading-relaxed">{brief.ruleWhy}</p>
      </section>

      <section className="card-flat mb-3">
        <div className="eyebrow mb-1">Tiger Five in play</div>
        {brief.tigerFive.length > 0 ? (
          <div className="font-bold caution">
            {brief.tigerFive.map((k) => TIGER_FIVE_LABELS[k]).join(" · ")}
          </div>
        ) : (
          <div className="font-bold accent">Nothing forced here. Just play the hole.</div>
        )}
      </section>

      {brief.strategicNotes ? (
        <p className="muted text-xs mb-4">{brief.strategicNotes}</p>
      ) : null}

      <div className="sticky-actions">
        <div className="grid grid-cols-2 gap-2">
          <button
            className="btn btn-secondary"
            disabled={holeIndex === 0}
            onClick={() => {
              setHoleIndex((i) => Math.max(0, i - 1));
              setFlag("UNKNOWN");
              window.scrollTo(0, 0);
            }}
          >
            ← HOLE {holeIndex}
          </button>
          <button
            className="btn btn-primary"
            disabled={holeIndex >= course.holes.length - 1}
            onClick={() => {
              setHoleIndex((i) => Math.min(course.holes.length - 1, i + 1));
              setFlag("UNKNOWN");
              window.scrollTo(0, 0);
            }}
          >
            HOLE {holeIndex + 2} →
          </button>
        </div>
      </div>
    </Screen>
  );
}
