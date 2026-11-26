import { describe, expect, it } from "vitest";
import {
  findDistinctFretWindows,
  findValidFretWindows,
  canVoiceOnDistinctStrings,
  computeStringVibrationSegments,
  stepFretWindow,
  ensureWindowVisible,
  MAX_FRET,
} from "./fretboard-window";
import { SOLFEGE_COLORS, SOLFEGE_NEON_COLORS } from "./pptConstants";

const STANDARD_TUNING = ["E2", "A2", "D3", "G3", "B3", "E4"];

describe("Guitar fretboard vertical window navigation", () => {
  it("models open strings as always playable without consuming fretting-hand reach", () => {
    // Open C triad [C3, E3, G3]:
    // Position 1: F1-F5 with open G-0 (A-3=C3, D-2=E3, G-0=G3)
    // Position 2: F5-F9 closed (E-8=C3, A-7=E3, D-5=G3)
    // Position 3: F7-F11 hybrid with open G-0 (E-8=C3, A-7=E3, G-0=G3)
    const openCWindows = findDistinctFretWindows(STANDARD_TUNING, ["C3", "E3", "G3"], 5, MAX_FRET);
    expect(openCWindows.map(w => w.startFret)).toEqual([1, 5, 7]);

    // High-position voicing combining open E2 (0) with F#3 (A-9) and B3 (D-9)
    // is playable in F9-F13 because open strings remain available alongside any fretting-hand block
    const highWithOpen = findDistinctFretWindows(STANDARD_TUNING, ["E2", "F#3", "B3"], 5, MAX_FRET);
    expect(highWithOpen.some(w => w.startFret === 9 && w.matchKind === "exact")).toBe(true);

    // [F#3, A#3, C#4] collapses overlapping fret shifts into 3 distinct neck positions: F2-F6, F6-F10, F11-F15
    const fSharpWindows = findDistinctFretWindows(STANDARD_TUNING, ["F#3", "A#3", "C#4"], 5, MAX_FRET);
    expect(fSharpWindows.map(w => w.startFret)).toEqual([2, 6, 11]);
  });

  it("verifies distinct-string voicing and pitch-class fallback", () => {
    expect(canVoiceOnDistinctStrings([[2], [2]])).toBe(false);
    expect(canVoiceOnDistinctStrings([[2], [1, 2]])).toBe(true);

    // Wide voicing exceeding neck stretch in one position falls back to pitch-class coverage
    const wideChord = findValidFretWindows(STANDARD_TUNING, ["E2", "G#4", "B4"], 5, MAX_FRET);
    expect(wideChord.length).toBeGreaterThan(0);
  });

  it("steps forward and backward through valid windows starting at fret 1 and keeps them visible", () => {
    const valid = [1, 5, 10];
    expect(stepFretWindow(1, 1, valid, 1, 17)).toBe(5);
    expect(stepFretWindow(5, 1, valid, 1, 17)).toBe(10);
    expect(stepFretWindow(10, 1, valid, 1, 17)).toBe(10);
    expect(stepFretWindow(10, -1, valid, 1, 17)).toBe(5);
    expect(stepFretWindow(1, -1, valid, 1, 17)).toBe(1);

    expect(ensureWindowVisible(1, 5, 4, 12, MAX_FRET)).toBe(0);
    expect(ensureWindowVisible(10, 5, 0, 12, MAX_FRET)).toBe(3);
    expect(ensureWindowVisible(2, 5, 5, 12, MAX_FRET)).toBe(2);
  });

  it("computes vibrating string Solfège segments including open strings when windowStart >= 1", () => {
    const E2 = 40;
    const tonicC = 0;

    // Open E2 (fret 0 -> Mi) and G2 (fret 3 -> So) active on the same string with window F1..F5
    const activeMidis = new Set([40, 43]);
    const multiSegs = computeStringVibrationSegments(
      E2,
      m => activeMidis.has(m),
      1,
      5,
      tonicC
    );
    expect(multiSegs).toEqual([
      { fromFret: 0, toFret: 3, midi: 40, color: SOLFEGE_COLORS[4] }, // E -> Mi from nut to fret 3
      { fromFret: 3, toFret: null, midi: 43, color: SOLFEGE_COLORS[7] }, // G -> So from fret 3 to bridge
    ]);

    // Open E2 also vibrates from left edge when window is shifted high (e.g. F9..F13)
    const openOnly = new Set([40]);
    const openHighSegs = computeStringVibrationSegments(
      E2,
      m => openOnly.has(m),
      9,
      13,
      tonicC
    );
    expect(openHighSegs).toEqual([
      { fromFret: 0, toFret: null, midi: 40, color: SOLFEGE_COLORS[4] },
    ]);

    // Single F#2 (fret 2 -> Fi) inside F1..F5 uses neon Fi and runs to bridge
    const fiMidis = new Set([42]);
    const singleSegs = computeStringVibrationSegments(
      E2,
      m => fiMidis.has(m),
      1,
      5,
      tonicC
    );
    expect(singleSegs).toEqual([
      { fromFret: 2, toFret: null, midi: 42, color: SOLFEGE_NEON_COLORS[6] },
    ]);
  });
});
