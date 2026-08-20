"use client";

import { useEffect, useState } from "react";
import type { Course, GreensideHazard, Hazard, Hole } from "@/types/golf";
import { emptyHole, findCourse, mergeCourses } from "@/lib/courses";
import { downloadJson, getUserCourses, newId, upsertUserCourse } from "@/lib/storage";
import { Card, MockBadge, PageHeader, Screen } from "@/components/ui";
import HoleMap from "@/components/HoleMap";

/**
 * COURSE BUILDER (Phase 5 — V1 por formulario).
 * Pensado para desktop: estudias el hoyo UNA vez y guardas todo.
 * Podes subir una imagen de referencia (TheGrint, Google Earth, yardage book)
 * y tenerla al lado mientras cargas las distancias criticas.
 */

function Field({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
}) {
  return (
    <label className="block">
      <span className="eyebrow">
        {label} {suffix ? <span className="muted">({suffix})</span> : null}
      </span>
      <input
        className="text-input mt-1 mono"
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/[^0-9-]/g, ""), 10);
          onChange(Number.isNaN(n) ? 0 : n);
        }}
      />
    </label>
  );
}

const HAZARD_TYPES = ["WATER", "OB", "BUNKER", "TREES", "PENALTY", "RECOVERY"] as const;
const SIDES = ["LEFT", "RIGHT", "CENTER", "BOTH", "CROSS"] as const;
const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "EXTREME"] as const;
const RECOVERIES = ["EASY", "NORMAL", "DIFFICULT", "NO_RECOVERY"] as const;
const GREEN_SIDES = ["LEFT", "RIGHT", "SHORT", "LONG"] as const;

export default function CourseBuilderPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState<string>("");
  const [holeNumber, setHoleNumber] = useState(1);
  const [hole, setHole] = useState<Hole | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const list = mergeCourses(getUserCourses());
    setCourses(list);
    const q = new URLSearchParams(window.location.search).get("course");
    setCourseId(q && list.some((c) => c.id === q) ? q : (list[0]?.id ?? ""));
  }, []);

  const course = findCourse(courses, courseId);

  useEffect(() => {
    if (!course) return;
    const existing = course.holes.find((h) => h.holeNumber === holeNumber);
    setHole(existing ? JSON.parse(JSON.stringify(existing)) : emptyHole(holeNumber));
  }, [course, holeNumber]);

  function patch(p: Partial<Hole>) {
    setHole((h) => (h ? { ...h, ...p } : h));
  }

  function saveHole() {
    if (!course || !hole) return;
    const holes = [...course.holes.filter((h) => h.holeNumber !== hole.holeNumber), hole].sort(
      (a, b) => a.holeNumber - b.holeNumber,
    );
    const anyReal = holes.some((h) => h.dataQuality === "REAL");
    const allReal = holes.length === 18 && holes.every((h) => h.dataQuality === "REAL");
    const next: Course = {
      ...course,
      holes,
      dataQuality: allReal ? "REAL" : anyReal ? "PARTIAL" : course.dataQuality === "EMPTY" ? "PARTIAL" : course.dataQuality,
      source: "USER",
    };
    upsertUserCourse(next);
    setCourses(mergeCourses(getUserCourses()));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  }

  function addHazard() {
    if (!hole) return;
    const h: Hazard = {
      id: newId("hz"),
      type: "BUNKER",
      side: "RIGHT",
      startDistanceFromTee: 220,
      endDistanceFromTee: 245,
      lateralStart: 15,
      lateralEnd: 35,
      carryRequired: null,
      severity: "MEDIUM",
      penaltyCost: 0,
      recoveryDifficulty: "NORMAL",
      notes: "",
    };
    patch({ hazards: [...hole.hazards, h] });
  }

  function updateHazard(id: string, p: Partial<Hazard>) {
    if (!hole) return;
    patch({ hazards: hole.hazards.map((h) => (h.id === id ? { ...h, ...p } : h)) });
  }

  function addGreenside() {
    if (!hole) return;
    const g: GreensideHazard = {
      id: newId("gh"),
      type: "BUNKER",
      side: "LEFT",
      severity: "MEDIUM",
      penaltyCost: 0,
      recoveryDifficulty: "NORMAL",
      notes: "",
    };
    patch({ greensideHazards: [...hole.greensideHazards, g] });
  }

  return (
    <Screen wide>
      <PageHeader
        eyebrow="Build Course"
        title="Course Builder"
        right={saved ? <span className="badge badge-green">Hole saved</span> : undefined}
      />

      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <label className="block">
          <span className="eyebrow">Course</span>
          <select className="text-input mt-1" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="eyebrow">Hole number</span>
          <select
            className="text-input mt-1"
            value={holeNumber}
            onChange={(e) => setHoleNumber(parseInt(e.target.value, 10))}
          >
            {Array.from({ length: 18 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                Hole {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!hole ? (
        <p className="muted">Pick a course.</p>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(0,1fr) 340px" }}>
          <div className="grid gap-4">
            <Card>
              <div className="flex items-center justify-between mb-3">
                <span className="eyebrow">Basics</span>
                <MockBadge quality={hole.dataQuality} />
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <Field label="Par" value={hole.par} onChange={(n) => patch({ par: n })} />
                <Field
                  label="Handicap index"
                  value={hole.handicapIndex}
                  onChange={(n) => patch({ handicapIndex: n })}
                />
                <Field
                  label="White tee"
                  suffix="yd"
                  value={hole.whiteTeeYardage}
                  onChange={(n) => patch({ whiteTeeYardage: n })}
                />
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <Field
                  label="Fairway width"
                  suffix="yd"
                  value={hole.fairwayWidthYards}
                  onChange={(n) => patch({ fairwayWidthYards: n })}
                />
                <Field
                  label="Fairway starts"
                  suffix="yd from tee"
                  value={hole.fairwayStart}
                  onChange={(n) => patch({ fairwayStart: n })}
                />
                <Field
                  label="Through the fairway"
                  suffix="yd from tee"
                  value={hole.fairwayEnd}
                  onChange={(n) => patch({ fairwayEnd: n })}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field
                  label="Forced carry"
                  suffix="yd, 0 = none"
                  value={hole.forcedCarry ?? 0}
                  onChange={(n) => patch({ forcedCarry: n > 0 ? n : null })}
                />
                <Field
                  label="Elevation change"
                  suffix="yd, +/-"
                  value={hole.elevationChangeYards}
                  onChange={(n) => patch({ elevationChangeYards: n })}
                />
                <label className="block">
                  <span className="eyebrow">Data quality</span>
                  <select
                    className="text-input mt-1"
                    value={hole.dataQuality}
                    onChange={(e) => patch({ dataQuality: e.target.value as Hole["dataQuality"] })}
                  >
                    {["MOCK", "PARTIAL", "REAL"].map((q) => (
                      <option key={q} value={q}>
                        {q}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </Card>

            <Card>
              <div className="eyebrow mb-3">Green</div>
              <div className="grid grid-cols-4 gap-3">
                <Field
                  label="Width"
                  suffix="yd"
                  value={hole.greenWidth}
                  onChange={(n) => patch({ greenWidth: n })}
                />
                <Field
                  label="Depth"
                  suffix="yd"
                  value={hole.greenDepth}
                  onChange={(n) => patch({ greenDepth: n })}
                />
                <label className="block">
                  <span className="eyebrow">Safe side</span>
                  <select
                    className="text-input mt-1"
                    value={hole.greenSafeSide}
                    onChange={(e) => patch({ greenSafeSide: e.target.value as Hole["greenSafeSide"] })}
                  >
                    {["NONE", ...GREEN_SIDES].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="eyebrow">Bad side</span>
                  <select
                    className="text-input mt-1"
                    value={hole.greenBadSide}
                    onChange={(e) => patch({ greenBadSide: e.target.value as Hole["greenBadSide"] })}
                  >
                    {["NONE", ...GREEN_SIDES].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex items-center justify-between mt-5 mb-2">
                <span className="eyebrow">Greenside hazards</span>
                <button className="badge" onClick={addGreenside}>
                  + Add
                </button>
              </div>
              {hole.greensideHazards.map((g) => (
                <div key={g.id} className="card-flat mb-2 grid grid-cols-5 gap-2 items-end">
                  <label className="block">
                    <span className="eyebrow">Type</span>
                    <select
                      className="text-input mt-1"
                      value={g.type}
                      onChange={(e) =>
                        patch({
                          greensideHazards: hole.greensideHazards.map((x) =>
                            x.id === g.id ? { ...x, type: e.target.value as Hazard["type"] } : x,
                          ),
                        })
                      }
                    >
                      {HAZARD_TYPES.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="eyebrow">Side</span>
                    <select
                      className="text-input mt-1"
                      value={g.side}
                      onChange={(e) =>
                        patch({
                          greensideHazards: hole.greensideHazards.map((x) =>
                            x.id === g.id ? { ...x, side: e.target.value as GreensideHazard["side"] } : x,
                          ),
                        })
                      }
                    >
                      {GREEN_SIDES.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="eyebrow">Severity</span>
                    <select
                      className="text-input mt-1"
                      value={g.severity}
                      onChange={(e) =>
                        patch({
                          greensideHazards: hole.greensideHazards.map((x) =>
                            x.id === g.id ? { ...x, severity: e.target.value as Hazard["severity"] } : x,
                          ),
                        })
                      }
                    >
                      {SEVERITIES.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="eyebrow">Penalty</span>
                    <input
                      className="text-input mt-1 mono"
                      value={g.penaltyCost}
                      onChange={(e) =>
                        patch({
                          greensideHazards: hole.greensideHazards.map((x) =>
                            x.id === g.id
                              ? { ...x, penaltyCost: parseInt(e.target.value || "0", 10) || 0 }
                              : x,
                          ),
                        })
                      }
                    />
                  </label>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() =>
                      patch({ greensideHazards: hole.greensideHazards.filter((x) => x.id !== g.id) })
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </Card>

            <Card>
              <div className="flex items-center justify-between mb-3">
                <span className="eyebrow">Hazards on the hole</span>
                <button className="badge" onClick={addHazard}>
                  + Add hazard
                </button>
              </div>
              <p className="muted text-xs mb-3">
                Distances are measured from the tee along the hole. Lateral start/end is how far from the
                center of the fairway the trouble begins and ends. CROSS = crosses the whole hole.
              </p>
              {hole.hazards.length === 0 ? (
                <p className="muted text-sm">No hazards loaded for this hole.</p>
              ) : null}
              {hole.hazards.map((hz) => (
                <div key={hz.id} className="card-flat mb-3">
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    <label className="block">
                      <span className="eyebrow">Type</span>
                      <select
                        className="text-input mt-1"
                        value={hz.type}
                        onChange={(e) => updateHazard(hz.id, { type: e.target.value as Hazard["type"] })}
                      >
                        {HAZARD_TYPES.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="eyebrow">Side</span>
                      <select
                        className="text-input mt-1"
                        value={hz.side}
                        onChange={(e) => updateHazard(hz.id, { side: e.target.value as Hazard["side"] })}
                      >
                        {SIDES.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="eyebrow">Severity</span>
                      <select
                        className="text-input mt-1"
                        value={hz.severity}
                        onChange={(e) =>
                          updateHazard(hz.id, { severity: e.target.value as Hazard["severity"] })
                        }
                      >
                        {SEVERITIES.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="eyebrow">Recovery</span>
                      <select
                        className="text-input mt-1"
                        value={hz.recoveryDifficulty}
                        onChange={(e) =>
                          updateHazard(hz.id, {
                            recoveryDifficulty: e.target.value as Hazard["recoveryDifficulty"],
                          })
                        }
                      >
                        {RECOVERIES.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="grid grid-cols-5 gap-2 items-end">
                    <Field
                      label="Starts"
                      suffix="yd"
                      value={hz.startDistanceFromTee}
                      onChange={(n) => updateHazard(hz.id, { startDistanceFromTee: n })}
                    />
                    <Field
                      label="Ends"
                      suffix="yd"
                      value={hz.endDistanceFromTee}
                      onChange={(n) => updateHazard(hz.id, { endDistanceFromTee: n })}
                    />
                    <Field
                      label="Lateral from"
                      suffix="yd"
                      value={hz.lateralStart}
                      onChange={(n) => updateHazard(hz.id, { lateralStart: n })}
                    />
                    <Field
                      label="Lateral to"
                      suffix="yd"
                      value={hz.lateralEnd}
                      onChange={(n) => updateHazard(hz.id, { lateralEnd: n })}
                    />
                    <Field
                      label="Penalty"
                      suffix="strokes"
                      value={hz.penaltyCost}
                      onChange={(n) => updateHazard(hz.id, { penaltyCost: n })}
                    />
                  </div>
                  <input
                    className="text-input mt-2"
                    placeholder="Notes"
                    value={hz.notes}
                    onChange={(e) => updateHazard(hz.id, { notes: e.target.value })}
                  />
                  <button
                    className="btn btn-danger btn-sm mt-2"
                    onClick={() => patch({ hazards: hole.hazards.filter((x) => x.id !== hz.id) })}
                  >
                    Remove hazard
                  </button>
                </div>
              ))}
            </Card>

            <Card>
              <div className="eyebrow mb-2">Strategic notes</div>
              <textarea
                className="text-input"
                rows={4}
                value={hole.strategicNotes}
                onChange={(e) => patch({ strategicNotes: e.target.value })}
                placeholder="What you actually learned standing on this tee."
              />
            </Card>
          </div>

          <div className="grid gap-4" style={{ alignContent: "start" }}>
            <Card>
              <div className="eyebrow mb-3">Live preview</div>
              <HoleMap hole={hole} flagPosition="MIDDLE_CENTER" />
              <p className="muted text-xs mt-3">
                Schematic, built from the numbers on the left. Real polygons come later.
              </p>
            </Card>

            <Card>
              <div className="eyebrow mb-2">Reference image</div>
              <input
                type="file"
                accept="image/*"
                className="text-input"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const reader = new FileReader();
                  reader.onload = () => patch({ referenceImage: String(reader.result) });
                  reader.readAsDataURL(f);
                }}
              />
              {hole.referenceImage ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={hole.referenceImage}
                    alt={`Reference for hole ${hole.holeNumber}`}
                    style={{ width: "100%", borderRadius: 12, marginTop: 12 }}
                  />
                  <button
                    className="btn btn-danger btn-sm mt-2"
                    onClick={() => patch({ referenceImage: null })}
                  >
                    Remove image
                  </button>
                </>
              ) : (
                <p className="muted text-xs mt-2">
                  TheGrint screenshot, Google Earth, GPS or yardage book. Kept on this device.
                </p>
              )}
            </Card>

            <button className="btn btn-primary" onClick={saveHole}>
              SAVE HOLE {hole.holeNumber}
            </button>
            {course ? (
              <button className="btn btn-secondary btn-sm" onClick={() => downloadJson(`${course.id}.json`, course)}>
                Export {course.id}.json
              </button>
            ) : null}
          </div>
        </div>
      )}
    </Screen>
  );
}
