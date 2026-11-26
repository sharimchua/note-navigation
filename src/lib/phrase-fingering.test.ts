import { describe, expect, it } from "vitest";
import { getScaleTetrachordChainTriangles } from "./pptConstants";
import { solveGuitarPhraseFingering } from "./guitar-fingering";
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
});
