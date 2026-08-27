import type { Course, Hole } from "@/types/golf";
import ventanasJson from "@/data/courses/ventanas.json";
import zibataJson from "@/data/courses/zibata.json";
import sanMiguelJson from "@/data/courses/san-miguel.json";
import campanarioJson from "@/data/courses/campanario.json";

/**
 * Los campos bundled viven en JSON independientes por campo.
 * Los campos del usuario (ADD COURSE / COURSE BUILDER) viven en localStorage
 * y ganan si comparten id con uno bundled (permite editar Ventanas sin tocar el repo).
 */

export const BUNDLED_COURSES: Course[] = [
  ventanasJson as unknown as Course,
  zibataJson as unknown as Course,
  sanMiguelJson as unknown as Course,
  campanarioJson as unknown as Course,
];

export function mergeCourses(userCourses: Course[]): Course[] {
  const byId = new Map<string, Course>();
  for (const c of BUNDLED_COURSES) byId.set(c.id, c);
  for (const c of userCourses) byId.set(c.id, c);
  return [...byId.values()];
}

export function findCourse(courses: Course[], id: string): Course | null {
  return courses.find((c) => c.id === id) ?? null;
}

export function findHole(course: Course, holeNumber: number): Hole | null {
  return course.holes.find((h) => h.holeNumber === holeNumber) ?? null;
}

export function isPlayable(course: Course): boolean {
  return course.holes.length > 0;
}

export function courseTotalYardage(course: Course): number {
  return course.holes.reduce((s, h) => s + h.whiteTeeYardage, 0);
}

export function coursePar(course: Course): number {
  return course.holes.reduce((s, h) => s + h.par, 0);
}

export function emptyHole(holeNumber: number): Hole {
  return {
    holeNumber,
    par: 4,
    handicapIndex: holeNumber,
    whiteTeeYardage: 0,
    fairwayWidthYards: 30,
    fairwayStart: 150,
    fairwayEnd: 300,
    greenWidth: 26,
    greenDepth: 24,
    greenSafeSide: "NONE",
    greenBadSide: "NONE",
    greensideHazards: [],
    hazards: [],
    forcedCarry: null,
    layupZones: [],
    preferredLandingZones: [],
    elevationChangeYards: 0,
    strategicNotes: "",
    dataQuality: "PARTIAL",
    teeCoordinates: null,
    greenCenter: null,
    greenPolygon: [],
    fairwayPolygon: [],
    referenceImage: null,
  };
}

export function emptyCourse(id: string, name: string): Course {
  return {
    id,
    name,
    nameConfirmed: true,
    location: "",
    tees: [{ id: "white", name: "White", color: "#F5F3EE" }],
    holes: [],
    dataQuality: "EMPTY",
    source: "USER",
    notes: "",
    updatedAt: new Date().toISOString(),
  };
}
