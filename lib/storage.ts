"use client";

import type { Course, PlayerProfile, Round } from "@/types/golf";
import { DEFAULT_PROFILE } from "@/data/player-defaults";

/**
 * Persistencia V1: localStorage.
 * La forma de las funciones esta pensada para cambiar a Supabase sin tocar la UI:
 * todo pasa por getX / saveX.
 */

const KEYS = {
  profile: "fd.profile.v1",
  rounds: "fd.rounds.v1",
  currentRound: "fd.currentRound.v1",
  userCourses: "fd.courses.v1",
  settings: "fd.settings.v1",
} as const;

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage lleno o modo privado: la ronda sigue en memoria.
  }
}

/* ---------------- Player ---------------- */

export function getProfile(): PlayerProfile {
  const p = read<PlayerProfile | null>(KEYS.profile, null);
  if (!p || !Array.isArray(p.clubs) || p.clubs.length === 0) return DEFAULT_PROFILE;
  return p;
}

export function saveProfile(p: PlayerProfile): void {
  write(KEYS.profile, { ...p, updatedAt: new Date().toISOString() });
}

export function resetProfile(): void {
  write(KEYS.profile, DEFAULT_PROFILE);
}

/* ---------------- Rounds ---------------- */

export function getRounds(): Round[] {
  return read<Round[]>(KEYS.rounds, []);
}

export function saveRounds(rounds: Round[]): void {
  write(KEYS.rounds, rounds);
}

export function upsertRound(round: Round): void {
  const rounds = getRounds();
  const i = rounds.findIndex((r) => r.id === round.id);
  if (i >= 0) rounds[i] = round;
  else rounds.unshift(round);
  saveRounds(rounds);
}

export function getRound(id: string): Round | null {
  return getRounds().find((r) => r.id === id) ?? null;
}

export function deleteRound(id: string): void {
  saveRounds(getRounds().filter((r) => r.id !== id));
}

/* ---------------- Ronda en curso ---------------- */

export function getCurrentRound(): Round | null {
  return read<Round | null>(KEYS.currentRound, null);
}

export function saveCurrentRound(round: Round | null): void {
  write(KEYS.currentRound, round);
}

/* ---------------- Campos del usuario ---------------- */

export function getUserCourses(): Course[] {
  return read<Course[]>(KEYS.userCourses, []);
}

export function saveUserCourses(courses: Course[]): void {
  write(KEYS.userCourses, courses);
}

export function upsertUserCourse(course: Course): void {
  const list = getUserCourses();
  const i = list.findIndex((c) => c.id === course.id);
  const next = { ...course, updatedAt: new Date().toISOString() };
  if (i >= 0) list[i] = next;
  else list.push(next);
  saveUserCourses(list);
}

/* ---------------- Settings ---------------- */

export interface AppSettings {
  hideScoreDefault: boolean;
  darkMode: boolean;
  defaultTeeId: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  hideScoreDefault: true,
  darkMode: true,
  defaultTeeId: "white",
};

export function getSettings(): AppSettings {
  return { ...DEFAULT_SETTINGS, ...read<Partial<AppSettings>>(KEYS.settings, {}) };
}

export function saveSettings(s: AppSettings): void {
  write(KEYS.settings, s);
}

/* ---------------- Export / Import ---------------- */

export interface BackupBundle {
  app: "FIVE DECISIONS";
  version: 1;
  exportedAt: string;
  profile: PlayerProfile;
  courses: Course[];
  rounds: Round[];
  settings: AppSettings;
}

export function buildBackup(): BackupBundle {
  return {
    app: "FIVE DECISIONS",
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: getProfile(),
    courses: getUserCourses(),
    rounds: getRounds(),
    settings: getSettings(),
  };
}

export function restoreBackup(bundle: Partial<BackupBundle>): void {
  if (bundle.profile) saveProfile(bundle.profile);
  if (bundle.courses) saveUserCourses(bundle.courses);
  if (bundle.rounds) saveRounds(bundle.rounds);
  if (bundle.settings) saveSettings(bundle.settings);
}

export function downloadJson(filename: string, data: unknown): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
