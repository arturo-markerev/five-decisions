"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Course } from "@/types/golf";
import { emptyCourse, mergeCourses, coursePar, courseTotalYardage } from "@/lib/courses";
import { courseConfidence } from "@/lib/course-learning";
import { getRounds, getUserCourses, newId, upsertUserCourse } from "@/lib/storage";
import { Card, MockBadge, PageHeader, Screen } from "@/components/ui";

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  function reload() {
    setCourses(mergeCourses(getUserCourses()));
  }

  useEffect(reload, []);

  const rounds = typeof window !== "undefined" ? getRounds() : [];

  return (
    <Screen>
      <PageHeader eyebrow="Course Intelligence" title="Courses" />

      <div className="grid gap-3 mb-6">
        {courses.map((c) => {
          const conf = courseConfidence(c, rounds);
          return (
            <Card key={c.id}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="font-bold">{c.name}</div>
                  <div className="muted text-xs mt-1">{c.location || "Location not set"}</div>
                  {!c.nameConfirmed ? (
                    <div className="caution text-xs mt-1 font-semibold">Name not confirmed</div>
                  ) : null}
                </div>
                <MockBadge quality={c.dataQuality} />
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="card-flat">
                  <div className="eyebrow">Holes</div>
                  <div className="font-bold mono">{c.holes.length}</div>
                </div>
                <div className="card-flat">
                  <div className="eyebrow">Par</div>
                  <div className="font-bold mono">{c.holes.length ? coursePar(c) : "—"}</div>
                </div>
                <div className="card-flat">
                  <div className="eyebrow">Yards</div>
                  <div className="font-bold mono">
                    {c.holes.length ? courseTotalYardage(c) : "—"}
                  </div>
                </div>
              </div>

              <div className="stat-row">
                <span className="muted text-sm">Course knowledge</span>
                <span className="font-bold">{conf.level}</span>
              </div>
              <div className="stat-row">
                <span className="muted text-sm">Rounds played here</span>
                <span className="font-bold mono">{conf.rounds}</span>
              </div>

              {c.notes ? <p className="muted text-xs mt-3">{c.notes}</p> : null}

              <Link href={`/course-builder?course=${c.id}`} className="btn btn-secondary btn-sm mt-4">
                BUILD / EDIT
              </Link>
            </Card>
          );
        })}
      </div>

      {adding ? (
        <Card>
          <div className="eyebrow mb-2">New course</div>
          <input
            className="text-input mb-3"
            placeholder="Course name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              className="btn btn-primary btn-sm"
              disabled={!name.trim()}
              onClick={() => {
                const c = emptyCourse(newId("course"), name.trim());
                upsertUserCourse(c);
                setName("");
                setAdding(false);
                reload();
              }}
            >
              CREATE
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </Card>
      ) : (
        <button className="btn btn-secondary" onClick={() => setAdding(true)}>
          + ADD COURSE
        </button>
      )}

      <p className="muted text-xs mt-6">
        No yardages, hazards or greens were invented for any course. Ventanas ships with MOCK geometry
        purely so the engine can be tested; Zibatá and San Miguel are empty until you load them.
      </p>
    </Screen>
  );
}
