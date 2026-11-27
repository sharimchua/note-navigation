import { describe, expect, it } from "vitest";
import { getScaleTetrachordChainTriangles } from "./pptConstants";
import {
  solveGuitarPhraseFingering,
  solveGuitarPhraseWithDiagnostics,
} from "./guitar-fingering";
import { solveGuitarRightHand } from "./guitar-right-hand";
import { solvePianoPhraseFingering } from "./piano-fingering";
import { encodeShareSlug, decodeShareSlug, type NoteNavShareSnapshot } from "./share-slug";
import { createOnsetFromNotes, type PhraseOnset } from "./phrase-model";
import { PRESET_PIANO_STUDIO, splitCellNode } from "./layout-models";

describe("Piano Triangle Scale Signature (tetrachord chaining)", () => {
  it("chains C major [5,6,7 -> Do -> 2,3,4] across L, U, R, D triangles", () => {
    const segments = getScaleTetrachordChainTriangles(0, [0, 2, 4, 5, 7, 9, 11]);
    expect(segments.length).toBeGreaterThanOrEqual(4);
    expect(segments.length).toBeLessThanOrEqual(5);

    const doSegments = segments.filter(s => s.hasDo);
    expect(doSegments).toHaveLength(1);
    expect(doSegments[0].triangle).toBe("R");
    expect(doSegments[0].doPoint).toBe(3);

    const validTriangles = new Set(["D", "L", "U", "R"]);
    for (const seg of segments) {
      expect(validTriangles.has(seg.triangle)).toBe(true);
      expect(seg.points.length).toBeGreaterThan(0);
      expect(seg.scaleVertices.size).toBe(seg.points.length);
    }
  });
});

describe("Guitar phrase fingering solver with lookahead & overrides", () => {
  const standardTuning = ["E2", "A2", "D3", "G3", "B3", "E4"];

  it("assigns finger 0 to open strings and 1–4 inside the active block", () => {
    const onsets: PhraseOnset[] = [
      createOnsetFromNotes(["E2", "B3", "E4"]),
      createOnsetFromNotes(["G2", "B2", "D3"]),
    ];

    const solved = solveGuitarPhraseFingering(standardTuning, onsets, 1, 5);
    expect(solved).toHaveLength(2);

    const openE2 = solved[0].find(n => n.note === "E2");
    expect(openE2?.fret).toBe(0);
    expect(openE2?.finger).toBe(0);

    const g2 = solved[1].find(n => n.note === "G2");
    const b2 = solved[1].find(n => n.note === "B2");
    expect(g2?.fret).toBe(3);
    expect(b2?.fret).toBe(2);
    expect(g2?.finger).toBeGreaterThanOrEqual(1);
    expect(g2?.finger).toBeLessThanOrEqual(4);
    expect(b2?.finger).toBeLessThan(g2!.finger);
  });

  it("marks shared positions across adjacent onsets as anchors and respects manual overrides", () => {
    const onset1 = createOnsetFromNotes(["C3", "E3", "G3"]);
    onset1.fingering = {
      guitar: {
        "1:3": { stringIdx: 1, fret: 3, finger: 4 },
      },
    };
    const onset2 = createOnsetFromNotes(["C3", "F3", "A3"]);

    const solved = solveGuitarPhraseFingering(standardTuning, [onset1, onset2], 1, 5);
    const c3Step1 = solved[0].find(n => n.note === "C3");
    expect(c3Step1).toBeDefined();
    expect(c3Step1?.stringIdx).toBe(1);
    expect(c3Step1?.fret).toBe(3);
    expect(c3Step1?.finger).toBe(4);
    expect(c3Step1?.isAnchor).toBe(true);
  });

  it("voices simultaneous chord notes on distinct strings strictly within the active block", () => {
    const chord = createOnsetFromNotes(["G2", "C3", "E3", "G3", "C4", "E4"]);
    const solved = solveGuitarPhraseFingering(standardTuning, [chord], 1, 3);
    const strings = solved[0].map(n => n.stringIdx);
    expect(solved[0]).toHaveLength(6);
    expect(new Set(strings).size).toBe(6);
    for (const n of solved[0]) {
      expect(n.fret === 0 || (n.fret >= 1 && n.fret <= 3)).toBe(true);
    }

    // Close piano-voiced triad ["C4", "E4", "G4"] in F1–F4 falls back to pitch-class grip inside F1–F4, never > 4
    const pianoTriad = createOnsetFromNotes(["C4", "E4", "G4"]);
    const triadSolved = solveGuitarPhraseFingering(standardTuning, [pianoTriad], 1, 4);
    expect(triadSolved[0]).toHaveLength(3);
    expect(new Set(triadSolved[0].map(n => n.stringIdx)).size).toBe(3);
    for (const n of triadSolved[0]) {
      expect(n.fret === 0 || (n.fret >= 1 && n.fret <= 4)).toBe(true);
    }
  });

  it("diagnoses physically impossible grips, returns closest partial grip, and names missing tone", () => {
    // 7 distinct pitch classes cannot be voiced simultaneously on 6 strings: returns closest 6-note partial grip
    const sevenNote = createOnsetFromNotes(["C3", "D3", "E3", "F3", "G3", "A3", "B3"]);
    const res7 = solveGuitarPhraseWithDiagnostics(standardTuning, [sevenNote], 1, 4);
    expect(res7.diagnostics[0].playable).toBe(false);
    expect(res7.diagnostics[0].unreachableNotes.length).toBeGreaterThanOrEqual(1);
    expect(res7.grips[0].length).toBeLessThanOrEqual(6);

    // In F10..F12 on standard tuning, both F and F# only exist on the G string, so ["F4", "F#4"] cannot be voiced simultaneously
    const unplayableInBlock = createOnsetFromNotes(["F4", "F#4"]);
    const res = solveGuitarPhraseWithDiagnostics(standardTuning, [unplayableInBlock], 10, 3);
    expect(res.diagnostics[0].playable).toBe(false);
    expect(res.diagnostics[0].unreachableNotes).toHaveLength(1);
    expect(res.grips[0]).toHaveLength(1);

    // Cmin7 3rd inversion closed voicing (Bb in bass) is impossible as 4 notes in standard tuning,
    // so it returns the closest 3-note partial grip and calls out the 1 dropped tone
    const cmin7Inv3 = createOnsetFromNotes(["Bb3", "C4", "Eb4", "G4"]);
    for (const start of [1, 3, 5, 8]) {
      const r = solveGuitarPhraseWithDiagnostics(standardTuning, [cmin7Inv3], start, 5);
      expect(r.diagnostics[0].playable).toBe(false);
      expect(r.diagnostics[0].unreachableNotes).toHaveLength(1);
      expect(r.grips[0].length).toBe(3);
      expect(new Set(r.grips[0].map(g => g.stringIdx)).size).toBe(3);
    }
  });
});

describe("Piano phrase fingering solver with split-staff hands & lookahead", () => {
  it("splits two-handed voicings into L/R 1–5 fingers and applies lookahead on single notes", () => {
    const step1 = createOnsetFromNotes(["C3", "G3", "E4", "G4"]);
    const step2 = createOnsetFromNotes(["C5"]);
    const step3 = createOnsetFromNotes(["G5"]);

    const solved = solvePianoPhraseFingering([step1, step2, step3]);
    expect(solved).toHaveLength(3);

    const c3 = solved[0].find(n => n.note === "C3");
    const e4 = solved[0].find(n => n.note === "E4");
    expect(c3?.hand).toBe("L");
    expect(e4?.hand).toBe("R");
    expect(e4?.finger).toBeGreaterThanOrEqual(1);
    expect(e4?.finger).toBeLessThanOrEqual(5);

    // Ascending jump from C5 to G5 (+7) prepares RH thumb (finger 1) on C5
    const c5 = solved[1].find(n => n.note === "C5");
    expect(c5?.hand).toBe("R");
    expect(c5?.finger).toBe(1);
  });

  it("applies manual piano fingering overrides", () => {
    const step = createOnsetFromNotes(["E4"]);
    step.fingering = {
      piano: {
        E4: { hand: "L", finger: 2 },
      },
    };
    const solved = solvePianoPhraseFingering([step]);
    expect(solved[0][0]).toMatchObject({ note: "E4", hand: "L", finger: 2 });
  });
});

describe("Shareable URL slug codec round-trip", () => {
  it("preserves key, scale, modular layout, phrase onsets, and manual overrides", () => {
    const customLayout = splitCellNode(PRESET_PIANO_STUDIO.root, "piano", "horizontal", "pitch-clock");
    const snapshot: NoteNavShareSnapshot = {
      v: 1,
      selectedKey: "Eb",
      selectedScale: "dorian",
      scaleRootOffset: 2,
      isKeyLocked: true,
      labelMode: "solfege",
      accidentalPreference: "flats",
      pptNoteheads: true,
      staffLayoutMode: "split",
      showPianoTriangles: true,
      showFingering: true,
      phraseMode: true,
      activeStepIndex: 1,
      phraseOnsets: [
        {
          id: "step-1",
          notes: ["Eb4", "G4", "Bb4"],
          label: "i triad",
          fingering: {
            piano: { Eb4: { hand: "R", finger: 2 } },
            guitar: { "2:1": { stringIdx: 2, fret: 1, finger: 1 } },
          },
          durationBeats: 1,
        },
        {
          id: "step-2",
          notes: ["F4", "Ab4", "C5"],
        },
      ],
      tuningName: "Drop D",
      layoutPresetId: "custom",
      customLayout,
    };

    const slug = encodeShareSlug(snapshot);
    expect(slug).not.toContain("+");
    expect(slug).not.toContain("/");
    expect(slug).not.toContain("=");

    const decoded = decodeShareSlug(slug);
    expect(decoded).toEqual(snapshot);
    expect(decodeShareSlug("not-valid-base64!!!")).toBeNull();
  });

  it("preserves loopPhrase, guitarRightHandMode, pianoComfortSpan, and guitarPick overrides", () => {
    const snapshot: NoteNavShareSnapshot = {
      v: 1,
      selectedKey: "G",
      selectedScale: "major",
      scaleRootOffset: 0,
      isKeyLocked: true,
      labelMode: "notes",
      accidentalPreference: "auto",
      pptNoteheads: true,
      staffLayoutMode: "joined",
      showPianoTriangles: false,
      showFingering: true,
      phraseMode: true,
      loopPhrase: true,
      guitarRightHandMode: "fingerstyle",
      pianoComfortSpan: 9,
      activeStepIndex: 0,
      phraseOnsets: [
        {
          id: "g-1",
          notes: ["G2", "B2", "D3", "G3"],
          fingering: {
            guitarPick: {
              "0": { stringIdx: 0, symbol: "p" },
              "2": { stringIdx: 2, symbol: "m" },
            },
          },
        },
      ],
      tuningName: "Custom",
      tuningNotes: ["D2", "A2", "D3", "G3", "B3", "D4"],
      layoutPresetId: "classic",
    };

    const decoded = decodeShareSlug(encodeShareSlug(snapshot));
    expect(decoded).toEqual(snapshot);
  });
});

describe("Guitar right-hand technique solver (PIMA & Flatpick)", () => {
  const standardTuning = ["E2", "A2", "D3", "G3", "B3", "E4"];

  it("assigns p-i-m-a bottom-to-top for fingerstyle chords and respects overrides", () => {
    const onsets: PhraseOnset[] = [
      createOnsetFromNotes(["E2", "G3", "B3", "E4"]),
      {
        ...createOnsetFromNotes(["A2", "G3", "B3", "E4"]),
        fingering: {
          guitarPick: {
            "5": { stringIdx: 5, symbol: "m" },
          },
        },
      },
    ];
    const lh = solveGuitarPhraseFingering(standardTuning, onsets, 1, 5, { loop: true });
    const rh = solveGuitarRightHand(lh, onsets, "fingerstyle", true);

    expect(rh[0].map(n => n.symbol)).toEqual(["p", "i", "m", "a"]);
    expect(rh[1].find(n => n.stringIdx === 5)?.symbol).toBe("m");
    // Shared B3 (string 4) keeps m -> m across loop
    expect(rh[0].find(n => n.stringIdx === 4)?.isAnchor).toBe(true);
  });

  it("alternates D/U in flatpick-alt and sweeps toward target string in flatpick-econ", () => {
    const onsets: PhraseOnset[] = [
      createOnsetFromNotes(["E2"]),
      createOnsetFromNotes(["A2"]),
      createOnsetFromNotes(["D3"]),
      createOnsetFromNotes(["A2"]),
    ];
    const lh = solveGuitarPhraseFingering(standardTuning, onsets, 1, 5);
    const alt = solveGuitarRightHand(lh, onsets, "flatpick-alt");
    const econ = solveGuitarRightHand(lh, onsets, "flatpick-econ");

    expect(alt.map(step => step[0].symbol)).toEqual(["D", "U", "D", "U"]);
    // Economy: E2 (D) -> A2 (treble-ward sweep D) -> D3 (treble-ward sweep D) -> A2 (bass-ward sweep U)
    expect(econ.map(step => step[0].symbol)).toEqual(["D", "D", "D", "U"]);
  });
});

describe("Transition-aware Piano solver with loop & hand span", () => {
  it("adapts next onset fingering after a manual override and marks loop anchors", () => {
    const step1 = createOnsetFromNotes(["C4"]);
    step1.fingering = { piano: { C4: { hand: "R", finger: 1 } } };
    const step2 = createOnsetFromNotes(["D4"]);
    const step3 = createOnsetFromNotes(["C4"]);

    const solved = solvePianoPhraseFingering([step1, step2, step3], {
      loop: true,
      maxComfortSpan: 9,
    });

    expect(solved[0][0]).toMatchObject({ note: "C4", hand: "R", finger: 1 });
    // After C4 with R1, stepping up to D4 naturally picks R2
    expect(solved[1][0]).toMatchObject({ note: "D4", hand: "R", finger: 2 });
    // Loop anchor: step 3 C4 R1 matches step 1 C4 R1
    expect(solved[2][0].isAnchor).toBe(true);
  });
});
