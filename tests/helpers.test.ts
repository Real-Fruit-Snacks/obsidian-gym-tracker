import { describe, it, expect } from "vitest";
import {
  normalizeTrackerData,
  normalizeWorkout,
  normalizeRuck,
  normalizeWorkoutSet,
  normalizeWorkoutMode,
  quoteYaml,
  escapeTableCell,
  sanitizeFileName,
  calculateSetVolume,
  calculateWorkoutVolume,
  calculateRuckPace,
  calculateRuckLoadDistance,
  countCompletedSets,
  compareWorkoutsDesc,
  roundNumber,
  uniqueStrings,
  clampNumber,
} from "../src/main";

function makeSet(overrides: Record<string, unknown> = {}) {
  return normalizeWorkoutSet({
    id: "s1",
    reps: 5,
    weight: 100,
    rpe: 8,
    rir: 2,
    type: "working",
    completed: true,
    notes: "",
    ...overrides,
  })!;
}

function makeWorkout(overrides: Record<string, unknown> = {}) {
  return normalizeWorkout({
    id: "w1",
    date: "2026-07-19",
    mode: "strength",
    type: "Strength",
    durationMinutes: 60,
    notes: "",
    createdAt: "2026-07-19T10:00:00.000Z",
    updatedAt: "2026-07-19T10:00:00.000Z",
    exercises: [
      {
        id: "e1",
        name: "Squat",
        notes: "",
        sets: [
          { id: "s1", reps: 5, weight: 100, completed: true, type: "working", notes: "" },
          { id: "s2", reps: 5, weight: 110, completed: false, type: "working", notes: "" },
        ],
      },
    ],
    ...overrides,
  })!;
}

describe("normalizeTrackerData", () => {
  it("returns defaults for junk input", () => {
    const data = normalizeTrackerData("garbage");
    expect(data.workouts).toEqual([]);
    expect(data.routines).toEqual([]);
    expect(data.exerciseLibrary.length).toBeGreaterThan(0);
  });

  it("drops malformed entries instead of crashing", () => {
    const data = normalizeTrackerData({
      workouts: [null, 42, makeWorkout()],
      routines: ["bad"],
      exerciseLibrary: [],
    });
    expect(data.workouts).toHaveLength(1);
    expect(data.routines).toHaveLength(0);
  });
});

describe("normalizeWorkout", () => {
  it("returns null for non-object input", () => {
    expect(normalizeWorkout(null)).toBeNull();
    expect(normalizeWorkout("x")).toBeNull();
  });

  it("fills defaults for missing fields", () => {
    const w = normalizeWorkout({})!;
    expect(w.mode).toBe("strength");
    expect(w.exercises).toEqual([]);
    expect(typeof w.id).toBe("string");
    expect(w.id.length).toBeGreaterThan(0);
  });

  it("preserves valid nested data", () => {
    const w = makeWorkout();
    expect(w.exercises).toHaveLength(1);
    expect(w.exercises[0].sets).toHaveLength(2);
    expect(w.exercises[0].sets[0].weight).toBe(100);
  });
});

describe("normalizeRuck", () => {
  it("falls back to an empty ruck for junk", () => {
    const r = normalizeRuck(null);
    expect(r.distance).toBe(0);
    expect(r.distanceUnit).toBe("mi");
  });

  it("clamps rpe into 0..10", () => {
    expect(normalizeRuck({ rpe: 99 }).rpe).toBe(10);
    expect(normalizeRuck({ rpe: -5 }).rpe).toBe(0);
  });

  it("accepts only known units", () => {
    expect(normalizeRuck({ distanceUnit: "km" }).distanceUnit).toBe("km");
    expect(normalizeRuck({ distanceUnit: "furlongs" }).distanceUnit).toBe("mi");
    expect(normalizeRuck({ elevationUnit: "m" }).elevationUnit).toBe("m");
    expect(normalizeRuck({ elevationUnit: "cubits" }).elevationUnit).toBe("ft");
  });
});

describe("normalizeWorkoutMode", () => {
  it("only ever returns strength or ruck", () => {
    expect(normalizeWorkoutMode("ruck")).toBe("ruck");
    expect(normalizeWorkoutMode("strength")).toBe("strength");
    expect(normalizeWorkoutMode("yoga")).toBe("strength");
  });
});

describe("markdown/YAML escaping", () => {
  it("quoteYaml escapes backslashes and quotes", () => {
    expect(quoteYaml('He said "hi" \\ bye')).toBe('"He said \\"hi\\" \\\\ bye"');
  });

  it("escapeTableCell escapes pipes and flattens newlines", () => {
    expect(escapeTableCell("a|b\nc")).toBe("a\\|b c");
  });

  it("sanitizeFileName strips path and wiki-link characters", () => {
    expect(sanitizeFileName("Bench: 5x5 [heavy]/#1|^top\\")).toBe("Bench 5x5 heavy1top");
  });

  it("sanitizeFileName falls back when nothing survives", () => {
    expect(sanitizeFileName("/\\#^|")).toBe("Exercise");
  });
});

describe("volume and pace calculations", () => {
  it("only completed sets count toward volume", () => {
    expect(calculateSetVolume(makeSet({ completed: true }))).toBe(500);
    expect(calculateSetVolume(makeSet({ completed: false }))).toBe(0);
  });

  it("workout volume sums completed sets across exercises", () => {
    expect(calculateWorkoutVolume(makeWorkout())).toBe(500);
  });

  it("countCompletedSets counts only completed sets", () => {
    expect(countCompletedSets(makeWorkout())).toBe(1);
  });

  it("ruck pace divides duration by distance, guarding zeros", () => {
    const ruck = makeWorkout({
      mode: "ruck",
      durationMinutes: 60,
      ruck: { distance: 4, distanceUnit: "mi", elevationGain: 0, elevationUnit: "ft", packWeight: 35, route: "", rpe: 7 },
    });
    expect(calculateRuckPace(ruck)).toBe(15);
    expect(calculateRuckLoadDistance(ruck)).toBe(140);

    const zeroDistance = makeWorkout({ mode: "ruck", durationMinutes: 60 });
    expect(calculateRuckPace(zeroDistance)).toBe(0);
  });

  it("strength workouts have no ruck pace or load distance", () => {
    expect(calculateRuckPace(makeWorkout())).toBe(0);
    expect(calculateRuckLoadDistance(makeWorkout())).toBe(0);
  });
});

describe("compareWorkoutsDesc", () => {
  it("sorts newest date first, then newest update", () => {
    const older = makeWorkout({ date: "2026-07-01" });
    const newer = makeWorkout({ date: "2026-07-18" });
    const newerButStale = makeWorkout({ date: "2026-07-18", updatedAt: "2026-07-18T00:00:00.000Z" });
    const sorted = [older, newerButStale, newer].sort(compareWorkoutsDesc);
    expect(sorted[0]).toBe(newer);
    expect(sorted[2]).toBe(older);
  });
});

describe("small utilities", () => {
  it("roundNumber rounds to two decimal places", () => {
    expect(roundNumber(3.14159)).toBe(3.14);
    expect(roundNumber(2.675)).toBe(2.68);
    expect(roundNumber(5)).toBe(5);
  });

  it("clampNumber clamps to bounds", () => {
    expect(clampNumber(5, 0, 10)).toBe(5);
    expect(clampNumber(-1, 0, 10)).toBe(0);
    expect(clampNumber(11, 0, 10)).toBe(10);
  });

  it("uniqueStrings dedupes preserving order", () => {
    expect(uniqueStrings(["a", "b", "a", "c"])).toEqual(["a", "b", "c"]);
  });
});
