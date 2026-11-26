import { describe, expect, it } from "vitest";
import { assignClefsForSplitStaff, type ClefChoice } from "./staff-clef-assignment";
import { getIntervalMeta, DEFAULT_STRING_STEP_OPTIONS } from "./music-engine";

describe("Split Grand Staff clef assignment", () => {
  it("splits spread two-hand voicings cleanly between Bass and Treble", () => {
    const emptyPrev = new Map<string, ClefChoice>();
    // C3 (48), G3 (55), E4 (64), B4 (71)
    const spread = assignClefsForSplitStaff(
      [
        { note: "C3", midi: 48, seq: 1 },
        { note: "G3", midi: 55, seq: 2 },
        { note: "E4", midi: 64, seq: 3 },
        { note: "B4", midi: 71, seq: 4 },
      ],
      emptyPrev
    );
    expect(spread.get("C3")).toBe("bass");
    expect(spread.get("G3")).toBe("bass");
    expect(spread.get("E4")).toBe("treble");
    expect(spread.get("B4")).toBe("treble");

    // 5-note spread spanning > 1 octave: C3 (48), E3 (52), G3 (55), B3 (59), D4 (62)
    const fiveNote = assignClefsForSplitStaff(
      [
        { note: "C3", midi: 48, seq: 1 },
        { note: "E3", midi: 52, seq: 2 },
        { note: "G3", midi: 55, seq: 3 },
        { note: "B3", midi: 59, seq: 4 },
        { note: "D4", midi: 62, seq: 5 },
      ],
      emptyPrev
    );
    expect(fiveNote.get("C3")).toBe("bass");
    expect(fiveNote.get("E3")).toBe("bass");
    expect(fiveNote.get("D4")).toBe("treble");
  });

  it("keeps compact chords crossing Middle C on adjacent ledger lines", () => {
    const emptyPrev = new Map<string, ClefChoice>();

    // A3 (57), C4 (60), E4 (64) -> compact triad within Treble ledger lines
    const aMinor = assignClefsForSplitStaff(
      [
        { note: "A3", midi: 57, seq: 1 },
        { note: "C4", midi: 60, seq: 2 },
        { note: "E4", midi: 64, seq: 3 },
      ],
      emptyPrev
    );
    expect(aMinor.get("A3")).toBe("treble");
    expect(aMinor.get("C4")).toBe("treble");
    expect(aMinor.get("E4")).toBe("treble");

    // F3 (53), A3 (57), C4 (60) -> compact triad within Bass ledger lines
    const fMajor = assignClefsForSplitStaff(
      [
        { note: "F3", midi: 53, seq: 1 },
        { note: "A3", midi: 57, seq: 2 },
        { note: "C4", midi: 60, seq: 3 },
      ],
      emptyPrev
    );
    expect(fMajor.get("F3")).toBe("bass");
    expect(fMajor.get("A3")).toBe("bass");
    expect(fMajor.get("C4")).toBe("bass");
  });

  it("preserves melodic continuity across Middle C onto ledger lines", () => {
    const emptyPrev = new Map<string, ClefChoice>();

    // After playing E4 (64) in Treble, stepping down to B3 (59) or A3 (57) stays in Treble
    const nextInTreble = assignClefsForSplitStaff(
      [{ note: "B3", midi: 59, seq: 2 }],
      emptyPrev,
      { midi: 64, clef: "treble" }
    );
    expect(nextInTreble.get("B3")).toBe("treble");

    // After playing G3 (55) in Bass, stepping up to C4 (60) or D4 (62) stays in Bass
    const nextInBass = assignClefsForSplitStaff(
      [{ note: "D4", midi: 62, seq: 2 }],
      emptyPrev,
      { midi: 55, clef: "bass" }
    );
    expect(nextInBass.get("D4")).toBe("bass");
  });
});

describe("Guitar default string step metadata", () => {
  it("provides interval name and shortName for all default string step options", () => {
    expect(DEFAULT_STRING_STEP_OPTIONS).toContain(5);
    expect(getIntervalMeta(4)).toEqual({ semitones: 4, name: "Major 3rd", shortName: "M3" });
    expect(getIntervalMeta(5)).toEqual({ semitones: 5, name: "Perfect 4th", shortName: "P4" });
    expect(getIntervalMeta(7)).toEqual({ semitones: 7, name: "Perfect 5th", shortName: "P5" });
  });
});
