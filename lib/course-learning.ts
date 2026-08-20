import type { Course, CourseConfidence, HoleClubLearning, Round } from "@/types/golf";
import { sampleBand } from "@/lib/player-learning";

/**
 * COURSE LEARNING (secciones 49-50).
 * Aprendemos por CAMPO y por HOYO, pero nunca tratamos una muestra chica
 * como verdad. El historial se combina con la geometria, no la reemplaza.
 */

export function learnHole(rounds: Round[], courseId: string, holeNumber: number): HoleClubLearning[] {
  const byClub = new Map<string, HoleClubLearning>();

  for (const r of rounds) {
    if (r.courseId !== courseId) continue;
    for (const h of r.holes) {
      if (h.holeNumber !== holeNumber) continue;
      for (const s of h.shots) {
        if (!s.selectedClub || s.lie === "GREEN") continue;
        const cur: HoleClubLearning = byClub.get(s.selectedClub) ?? {
          courseId,
          holeNumber,
          clubName: s.selectedClub,
          shots: 0,
          penalties: 0,
          fairways: 0,
          band: "INSUFFICIENT",
        };
        cur.shots += 1;
        if (s.penalty > 0 || s.result === "WATER" || s.result === "OB") cur.penalties += 1;
        if (s.result === "FAIRWAY" || s.result === "GREEN") cur.fairways += 1;
        byClub.set(s.selectedClub, cur);
      }
    }
  }

  const out = [...byClub.values()];
  for (const o of out) o.band = sampleBand(o.shots);
  return out;
}

export function roundsOnCourse(rounds: Round[], courseId: string): number {
  return rounds.filter((r) => r.courseId === courseId).length;
}

export function courseConfidence(course: Course, rounds: Round[]): CourseConfidence {
  const n = roundsOnCourse(rounds, course.id);
  const geometry = course.dataQuality;

  let level: CourseConfidence["level"] = "Low";
  if (geometry === "REAL" && n >= 3) level = "High";
  else if ((geometry === "REAL" && n >= 1) || (geometry === "PARTIAL" && n >= 3)) level = "Medium";
  else if (geometry === "PARTIAL" || n >= 2) level = "Medium";

  return {
    courseId: course.id,
    courseName: course.name,
    rounds: n,
    geometryQuality: geometry,
    level,
  };
}
