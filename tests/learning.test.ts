import { describe, expect, it } from "vitest";
import { learnClub, sampleBand } from "@/lib/player-learning";
import { learnHole } from "@/lib/course-learning";
import { holeRecord, profile, round, shot } from "./helpers";

describe("sample size protection", () => {
  it("bands the sample honestly", () => {
    expect(sampleBand(0)).toBe("INSUFFICIENT");
    expect(sampleBand(9)).toBe("INSUFFICIENT");
    expect(sampleBand(10)).toBe("EARLY");
    expect(sampleBand(24)).toBe("EARLY");
    expect(sampleBand(25)).toBe("USABLE");
    expect(sampleBand(50)).toBe("RELIABLE");
  });

  it("never suggests a new planning distance from a small sample", () => {
    const p = profile();
    const club = p.clubs.find((c) => c.clubName === "7 Iron")!;
    const shots = Array.from({ length: 6 }, (_, i) =>
      shot({ shotNumber: 1, selectedClub: "7 Iron", distanceToGreen: 165 - i }),
    );
    const r = round([holeRecord({ shots })]);
    const learning = learnClub(p, [r], club);
    expect(learning.band).toBe("INSUFFICIENT");
    expect(learning.suggestedPlanningDistance).toBeNull();
  });

  it("keeps the profile untouched until the player applies a suggestion", () => {
    const p = profile();
    const before = p.clubs.find((c) => c.clubName === "7 Iron")!.planningDistance;
    const r = round([holeRecord({ shots: [shot({ selectedClub: "7 Iron" })] })]);
    learnClub(p, [r], p.clubs.find((c) => c.clubName === "7 Iron")!);
    expect(p.clubs.find((c) => c.clubName === "7 Iron")!.planningDistance).toBe(before);
  });
});

describe("course learning", () => {
  it("aggregates per hole and per club without treating it as truth", () => {
    const shots = [
      shot({ holeNumber: 2, selectedClub: "Driver", result: "WATER", penalty: 1 }),
      shot({ holeNumber: 2, selectedClub: "Mini Driver", result: "FAIRWAY" }),
    ];
    const r = round([holeRecord({ holeNumber: 2, shots })]);
    const learned = learnHole([r], "ventanas", 2);
    const driver = learned.find((l) => l.clubName === "Driver")!;
    const mini = learned.find((l) => l.clubName === "Mini Driver")!;
    expect(driver.penalties).toBe(1);
    expect(mini.fairways).toBe(1);
    expect(driver.band).toBe("INSUFFICIENT");
  });
});
