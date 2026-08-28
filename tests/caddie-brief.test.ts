import { describe, expect, it } from "vitest";
import { buildCaddieBrief } from "@/lib/caddie-brief";
import type { Course, Hole } from "@/types/golf";
import campanario from "@/data/courses/campanario.json";
import { profile } from "./helpers";

const COURSE = campanario as unknown as Course;
function hole(n: number): Hole {
  const h = COURSE.holes.find((x) => x.holeNumber === n);
  if (!h) throw new Error(`hole ${n} missing`);
  return h;
}

describe("caddie brief — la cadena de golpes", () => {
  it("un par 3 se resuelve en un golpe", () => {
    const b = buildCaddieBrief({ profile: profile(), hole: hole(15), flagPosition: "UNKNOWN" });
    expect(b.shots).toHaveLength(1);
    expect(b.shots[0].title).toBe("Tee shot");
  });

  it("un par 5 encadena varios golpes hasta el green", () => {
    const b = buildCaddieBrief({ profile: profile(), hole: hole(16), flagPosition: "UNKNOWN" });
    expect(b.shots.length).toBeGreaterThanOrEqual(2);
    expect(b.shots[0].fromYards).toBe(hole(16).whiteTeeYardage);
  });

  it("la cadena siempre avanza y nunca se cuelga", () => {
    for (const h of COURSE.holes) {
      const b = buildCaddieBrief({ profile: profile(), hole: h, flagPosition: "UNKNOWN" });
      expect(b.shots.length).toBeGreaterThan(0);
      expect(b.shots.length).toBeLessThanOrEqual(5);
      for (let i = 1; i < b.shots.length; i++) {
        expect(b.shots[i].fromYards).toBeLessThan(b.shots[i - 1].fromYards);
      }
    }
  });
});

describe("caddie brief — el inventario del hoyo", () => {
  it("lista el agua con su distancia y la marca como penalidad", () => {
    const b = buildCaddieBrief({ profile: profile(), hole: hole(10), flagPosition: "UNKNOWN" });
    const agua = b.hazards.find((h) => h.text.startsWith("Water"));
    expect(agua).toBeDefined();
    expect(agua!.costsAStroke).toBe(true);
    expect(agua!.text).toContain("211");
  });

  it("ordena los peligros por donde aparecen caminando", () => {
    for (const h of COURSE.holes) {
      const b = buildCaddieBrief({ profile: profile(), hole: h, flagPosition: "UNKNOWN" });
      const conYardas = b.hazards.filter((x) => x.atYards != null).map((x) => x.atYards!);
      const ordenado = [...conYardas].sort((a, b2) => a - b2);
      expect(conYardas).toEqual(ordenado);
      // los de green van siempre al final
      const primerGreen = b.hazards.findIndex((x) => x.atYards == null);
      if (primerGreen >= 0) {
        expect(b.hazards.slice(primerGreen).every((x) => x.atYards == null)).toBe(true);
      }
    }
  });

  it("avisa el carry forzado del 15", () => {
    const b = buildCaddieBrief({ profile: profile(), hole: hole(15), flagPosition: "UNKNOWN" });
    expect(b.forcedCarry).toBe(111);
  });

  it("no inventa nada en un hoyo sin geometria de calle", () => {
    const b = buildCaddieBrief({ profile: profile(), hole: hole(8), flagPosition: "UNKNOWN" });
    expect(b.hasFairwayGeometry).toBe(false);
    expect(b.hazards.every((h) => h.atYards == null)).toBe(true);
  });
});

describe("driver desde el piso", () => {
  it("no recomienda driver en el segundo golpe de un par 5 largo", () => {
    // Sin este ajuste el motor elegia driver desde la calle, que para un H18
    // pierde distancia y abre la dispersion muchisimo mas que un wood.
    const b = buildCaddieBrief({ profile: profile(), hole: hole(16), flagPosition: "UNKNOWN" });
    const desdeLaCalle = b.shots.filter((s) => s.fromLie === "FAIRWAY");
    for (const s of desdeLaCalle) {
      expect(s.club.toUpperCase()).not.toContain("DRIVER");
    }
  });

  it("el driver sigue siendo valido desde el tee", () => {
    const b = buildCaddieBrief({ profile: profile(), hole: hole(1), flagPosition: "UNKNOWN" });
    expect(b.shots[0].fromLie).toBe("TEE");
  });
});
