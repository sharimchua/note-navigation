import { Note } from "tonal";
import type { PhraseOnset } from "@/lib/phrase-model";
import { assignClefsForSplitStaff, type ClefChoice, type MelodyContext } from "@/lib/staff-clef-assignment";

export interface PianoNoteFingering {
  note: string;
  midi: number;
  hand: "L" | "R";
  finger: 1 | 2 | 3 | 4 | 5;
}

function clampFinger(f: number): 1 | 2 | 3 | 4 | 5 {
  return Math.max(1, Math.min(5, Math.round(f))) as 1 | 2 | 3 | 4 | 5;
}

function fingerChordForHand(
  sortedAsc: { note: string; midi: number }[],
  hand: "L" | "R",
  nextMidis: number[]
): PianoNoteFingering[] {
  const k = sortedAsc.length;
  if (k === 0) return [];

  if (k === 1) {
    const cur = sortedAsc[0];
    let finger: 1 | 2 | 3 | 4 | 5 = 3;
    if (nextMidis.length > 0) {
      const nextAvg = nextMidis.reduce((s, m) => s + m, 0) / nextMidis.length;
      const diff = nextAvg - cur.midi;
      if (hand === "R") {
        // Prepare thumb low when ascending sharply, pinky high when descending sharply
        if (diff >= 5) finger = 1;
        else if (diff >= 2) finger = 2;
        else if (diff <= -5) finger = 5;
        else if (diff <= -2) finger = 4;
        else finger = 3;
      } else {
        // Left hand mirrors Right hand
        if (diff <= -5) finger = 1;
        else if (diff <= -2) finger = 2;
        else if (diff >= 5) finger = 5;
        else if (diff >= 2) finger = 4;
        else finger = 3;
      }
    }
    return [{ ...cur, hand, finger }];
  }

  // Multi-note hand voicing: map low-to-high for RH (1..5), high-to-low for LH (1..5)
  const ordered = hand === "R" ? sortedAsc : [...sortedAsc].reverse();
  const minM = ordered[0].midi;
  const maxM = ordered[ordered.length - 1].midi;
  const span = Math.abs(maxM - minM);

  const fingers: (1 | 2 | 3 | 4 | 5)[] = [];
  if (ordered.length === 2) {
    fingers.push(1, span >= 6 ? 5 : span >= 4 ? 4 : span >= 2 ? 3 : 2);
  } else if (ordered.length === 3) {
    if (span <= 4) fingers.push(1, 2, 3);
    else if (span <= 7) fingers.push(1, 3, 5);
    else fingers.push(1, 2, 5);
  } else if (ordered.length === 4) {
    if (span <= 6) fingers.push(1, 2, 3, 4);
    else fingers.push(1, 2, 3, 5);
  } else {
    for (let i = 0; i < ordered.length; i++) {
      fingers.push(clampFinger(1 + (i * 4) / Math.max(1, ordered.length - 1)));
    }
  }

  return ordered.map((item, idx) => ({
    ...item,
    hand,
    finger: fingers[idx] ?? 5,
  }));
}

/**
 * Solves ergonomic piano fingerings (`L`/`R` hand + `1–5` fingers) across a phrase of onsets,
 * using `assignClefsForSplitStaff` for two-hand balance and lookahead preparation toward
 * the next onset's register. Applies any manual overrides stored on each onset.
 */
export function solvePianoPhraseFingering(onsets: PhraseOnset[]): PianoNoteFingering[][] {
  if (onsets.length === 0) return [];

  let prevClefMap = new Map<string, ClefChoice>();
  let lastMelody: MelodyContext | null = null;

  const clefPerOnset = onsets.map((onset, idx) => {
    const inputs = [...new Set(onset.notes)]
      .map((note, nIdx) => ({ note, midi: Note.midi(note) ?? 60, seq: idx * 16 + nIdx }))
      .sort((a, b) => a.midi - b.midi);

    const clefMap = assignClefsForSplitStaff(inputs, prevClefMap, lastMelody);
    prevClefMap = clefMap;
    if (inputs.length > 0) {
      const top = inputs[inputs.length - 1];
      lastMelody = { midi: top.midi, clef: clefMap.get(top.note) ?? "treble" };
    }
    return { inputs, clefMap };
  });

  return onsets.map((onset, i) => {
    const { inputs, clefMap } = clefPerOnset[i];
    if (inputs.length === 0) return [];

    const nextInputs = i + 1 < clefPerOnset.length ? clefPerOnset[i + 1] : null;
    const nextRhMidis = nextInputs
      ? nextInputs.inputs.filter(n => nextInputs.clefMap.get(n.note) === "treble").map(n => n.midi)
      : [];
    const nextLhMidis = nextInputs
      ? nextInputs.inputs.filter(n => nextInputs.clefMap.get(n.note) === "bass").map(n => n.midi)
      : [];

    const rhNotes = inputs.filter(n => clefMap.get(n.note) !== "bass");
    const lhNotes = inputs.filter(n => clefMap.get(n.note) === "bass");

    const rhFingers = fingerChordForHand(rhNotes, "R", nextRhMidis);
    const lhFingers = fingerChordForHand(lhNotes, "L", nextLhMidis);
    const overrides = onset.fingering?.piano ?? {};

    return [...lhFingers, ...rhFingers].map(item => {
      const ov = overrides[item.note];
      return ov ? { ...item, hand: ov.hand, finger: ov.finger } : item;
    });
  });
}
