import { describe, expect, it } from "vitest";
import {
  SOLFEGE_COLORS,
  SOLFEGE_NEON_COLORS,
  getSolfegeColor,
  getSolfegeContrastText,
  getTriPitchClass,
  encodePianoTriangles,
  calculateChordCoincidence,
  midiToPptDiatonicPos,
} from "./pptConstants";
import {
  getDisplayNoteLabel,
  getNoteColor,
  RELATIVE_INTERVALS,
} from "./music-engine";

describe("PPT constants & movable-Do Solfège helpers", () => {
  it("resolves canonical Solfège syllables including Fi and So", () => {
    expect(RELATIVE_INTERVALS[0].solfege).toBe("Do");
    expect(RELATIVE_INTERVALS[6].solfege).toBe("Fi");
    expect(RELATIVE_INTERVALS[7].solfege).toBe("So");
  });

  it("colours pitch classes relative to the active Key Centre (movable Do)", () => {
    // In C major, C is Do (#E13610) and F# is Fi (#38BDF8 with neonFi)
    expect(getSolfegeColor(0, 0)).toBe(SOLFEGE_COLORS[0]);
    expect(getSolfegeColor(6, 0, { neonFi: true })).toBe(SOLFEGE_NEON_COLORS[6]);
    expect(getSolfegeColor(6, 0, { neonFi: false })).toBe(SOLFEGE_COLORS[6]);

    // In D major (tonic = 2), D is Do, A is So (#0032A4), G# is Fi (#38BDF8)
    expect(getNoteColor("D4", "D")).toBe(SOLFEGE_COLORS[0]);
    expect(getNoteColor("A4", "D")).toBe(SOLFEGE_COLORS[7]);
    expect(getNoteColor("G#4", "D")).toBe(SOLFEGE_NEON_COLORS[6]);
  });

  it("chooses dark contrast text for bright Solfège colours and neon Fi", () => {
    expect(getSolfegeContrastText(3)).toBe("#0b0d13"); // Me (yellow)
    expect(getSolfegeContrastText(4)).toBe("#0b0d13"); // Mi (yellow)
    expect(getSolfegeContrastText(6, { neonFi: true })).toBe("#0b0d13");
    expect(getSolfegeContrastText(0)).toBe("#ffffff"); // Do (red)
    expect(getSolfegeContrastText(7)).toBe("#ffffff"); // So (deep blue)
  });

  it("formats Tri pitch-class notation and display note labels across modes", () => {
    expect(getTriPitchClass(1)).toBe("△G");
    expect(getTriPitchClass(6)).toBe("△C");
    expect(getDisplayNoteLabel("F#4", "C", "tri", false)).toBe("△C");
    expect(getDisplayNoteLabel("F#4", "C", "solfege", false)).toBe("Fi");
    expect(getDisplayNoteLabel("G4", "C", "solfege", false)).toBe("So");
    expect(getDisplayNoteLabel("E4", "C", "degree", false, 48)).toBe("10");
  });

  it("encodes Piano Triangles (D/L/U/R) cleanly", () => {
    // Cmaj [C4=60, E4=64, G4=67] -> R3L1U1
    expect(encodePianoTriangles([60, 64, 67])).toBe("R3L1U1");
    // Adjacent cluster C#4+D4 -> D12
    expect(encodePianoTriangles([61, 62])).toBe("D12");
  });

  it("calculates Just Intonation ratios and Coincidence Super-Cycle", () => {
    // Major triad [0, 4, 7] -> 4:5:6, 5-limit, cycle 4x
    const maj = calculateChordCoincidence([0, 4, 7]);
    expect(maj.integerRatioString).toBe("4:5:6");
    expect(maj.primeLimit).toBe(5);
    expect(maj.rootTurnsToAlign).toBe(4);
  });

  it("places non-diatonic PPT noteheads on their paired diatonic staff position", () => {
    // C major: Eb4 (63) shares E4 (64) position = 2; Db4 (61) shares D4 (62) position = 1; Bb3 (58) = -1
    expect(midiToPptDiatonicPos(64, "C")).toBe(2);
    expect(midiToPptDiatonicPos(63, "C")).toBe(2);
    expect(midiToPptDiatonicPos(62, "C")).toBe(1);
    expect(midiToPptDiatonicPos(61, "C")).toBe(1);
    expect(midiToPptDiatonicPos(58, "C")).toBe(-1);

    // D major: F4 (65) and F#4 (66) both sit on F4 (pos 3); C4 (60) and C#4 (61) both sit on C4 (pos 0)
    expect(midiToPptDiatonicPos(65, "D")).toBe(3);
    expect(midiToPptDiatonicPos(66, "D")).toBe(3);
    expect(midiToPptDiatonicPos(60, "D")).toBe(0);
    expect(midiToPptDiatonicPos(61, "D")).toBe(0);

    // Bb major: Db4 (61) shares D4 (62) position = 1
    expect(midiToPptDiatonicPos(62, "Bb")).toBe(1);
    expect(midiToPptDiatonicPos(61, "Bb")).toBe(1);

    // C Locrian: tritone Gb4 (66) maps to degree 5 (G4 = 4) instead of degree 4 (F4 = 3)
    expect(midiToPptDiatonicPos(66, "C", "locrian")).toBe(4);
  });
});
