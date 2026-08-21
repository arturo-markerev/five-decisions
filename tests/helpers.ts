import type { Course, Hole, HoleRecord, PlayerProfile, Round, ShotRecord } from "@/types/golf";
import { DEFAULT_PROFILE } from "@/data/player-defaults";
import mockCourse from "./fixtures/mock-course.json";

/** Campo sintetico. Los tests del motor NO deben depender de datos reales:
 *  corregir un campo de verdad no puede tumbar la suite. */
export const COURSE = mockCourse as unknown as Course;

export function hole(n: number): Hole {
  const h = COURSE.holes.find((x) => x.holeNumber === n);
  if (!h) throw new Error(`hole ${n} missing`);
  return h;
}

export function profile(): PlayerProfile {
  return JSON.parse(JSON.stringify(DEFAULT_PROFILE)) as PlayerProfile;
}

export function shot(partial: Partial<ShotRecord>): ShotRecord {
  return {
    roundId: "r1",
    courseId: "mock-course",
    holeNumber: 1,
    shotNumber: 1,
    club: "7 Iron",
    recommendedClub: "7 Iron",
    selectedClub: "7 Iron",
    followedRecommendation: true,
    planningDistance: 165,
    laserDistance: null,
    distanceToGreen: 165,
    lie: "FAIRWAY",
    target: "Center",
    targetOffsetYards: 0,
    safeMiss: "Right",
    dangerMiss: "Left",
    flagPosition: "MIDDLE_CENTER",
    flagRisk: "GREEN",
    result: "GREEN",
    penalty: 0,
    correctMiss: null,
    strategyRisk: "GREEN",
    decisionConfidence: "MEDIUM",
    notes: "",
    timestamp: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

export function holeRecord(partial: Partial<HoleRecord>): HoleRecord {
  return {
    holeNumber: 1,
    par: 4,
    flagPosition: "MIDDLE_CENTER",
    shots: [],
    firstPuttSteps: null,
    firstPuttResult: null,
    putts: 2,
    penalties: 0,
    score: 4,
    completed: true,
    ...partial,
  };
}

export function round(holes: HoleRecord[]): Round {
  return {
    id: "r1",
    courseId: "mock-course",
    courseName: "Ventanas",
    teeId: "white",
    teeName: "White",
    hideScore: true,
    startedAt: "2026-01-01T00:00:00.000Z",
    finishedAt: "2026-01-01T04:00:00.000Z",
    currentHoleIndex: holes.length - 1,
    holes,
  };
}
