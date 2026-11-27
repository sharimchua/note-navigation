import { Note } from "tonal";
import type { PhraseOnset } from "@/lib/phrase-model";
import { assignClefsForSplitStaff, type ClefChoice, type MelodyContext } from "@/lib/staff-clef-assignment";

export interface PianoNoteFingering {
  note: string;
  midi: number;
  hand: "L" | "R";
  finger: 1 | 2 | 3 | 4 | 5;
  isAnchor?: boolean;
}

export interface PianoFingeringOptions {
  loop?: boolean;
  maxComfortSpan?: number; // semitones, default 12
}

function clampFinger(f: number): 1 | 2 | 3 | 4 | 5 {
  return Math.max(1, Math.min(5, Math.round(f))) as 1 | 2 | 3 | 4 | 5;
}

function scoreSingleFinger(
  midi: number,
  hand: "L" | "R",
  finger: 1 | 2 | 3 | 4 | 5,
  prevHandNote: { midi: number; finger: 1 | 2 | 3 | 4 | 5 } | null,
  nextMidis: number[],
  maxComfortSpan: number
): number {
  let score = 0;

  // Transition from previous onset in same hand
  if (prevHandNote) {
    const pitchDelta = midi - prevHandNote.midi;
    const fingerDelta = finger - prevHandNote.finger;

    if (pitchDelta === 0) {
      // Repeated note: keeping same finger is natural, or gentle alternation
      score += finger === prevHandNote.finger ? 5 : 1;
    } else if (hand === "R") {
      // Ascending pitch naturally moves toward higher finger numbers (1->5)
      if (pitchDelta > 0 && fingerDelta > 0) score += 4;
      else if (pitchDelta < 0 && fingerDelta < 0) score += 4;
      else if (pitchDelta > 0 && fingerDelta < 0) score -= 2.5; // thumb-under / cross
      else if (pitchDelta < 0 && fingerDelta > 0) score -= 2.5;

      // Penalize stretch if finger distance doesn't match pitch distance
      if (Math.abs(pitchDelta) > maxComfortSpan * 0.7 && fingerDelta !== 0) {
        score -= 2;
      }
    } else {
      // Left hand mirrors Right hand (ascending pitch moves 5->1)
      if (pitchDelta > 0 && fingerDelta < 0) score += 4;
      else if (pitchDelta < 0 && fingerDelta > 0) score += 4;
      else if (pitchDelta > 0 && fingerDelta > 0) score -= 2.5;
      else if (pitchDelta < 0 && fingerDelta < 0) score -= 2.5;
    }

    // Small stepwise motion prefers adjacent fingers
    if (Math.abs(pitchDelta) <= 2 && Math.abs(fingerDelta) === 1) {
      score += 4;
    }
  }

  // Lookahead preparation toward next onset (only on leaps >= 3 semitones)
  if (nextMidis.length > 0) {
    const nextAvg = nextMidis.reduce((s, m) => s + m, 0) / nextMidis.length;
    const diff = nextAvg - midi;
    if (hand === "R") {
      if (diff >= 5) {
        if (finger === 1) score += 5;
      } else if (diff >= 3) {
        if (finger === 2) score += 3.5;
      } else if (diff <= -5) {
        if (finger === 5) score += 5;
      } else if (diff <= -3) {
        if (finger === 4) score += 3.5;
      } else if (finger === 3 && !prevHandNote) {
        score += 2;
      }
    } else {
      if (diff <= -5) {
        if (finger === 1) score += 5;
      } else if (diff <= -3) {
        if (finger === 2) score += 3.5;
      } else if (diff >= 5) {
        if (finger === 5) score += 5;
      } else if (diff >= 3) {
        if (finger === 4) score += 3.5;
      } else if (finger === 3 && !prevHandNote) {
        score += 2;
      }
    }
  } else if (finger === 3 && !prevHandNote) {
    score += 1;
  }

  return score;
}

function fingerChordForHand(
  sortedAsc: { note: string; midi: number }[],
  hand: "L" | "R",
  prevHandNotes: PianoNoteFingering[],
  nextMidis: number[],
  overrides: Record<string, { hand: "L" | "R"; finger: 1 | 2 | 3 | 4 | 5 }>,
  maxComfortSpan: number
): PianoNoteFingering[] {
  const k = sortedAsc.length;
  if (k === 0) return [];

  if (k === 1) {
    const cur = sortedAsc[0];
    const ov = overrides[cur.note];
    if (ov && ov.hand === hand) {
      return [{ ...cur, hand, finger: ov.finger }];
    }

    const prevAnchor = prevHandNotes.length > 0 ? prevHandNotes[0] : null;
    let bestFinger: 1 | 2 | 3 | 4 | 5 = 3;
    let bestScore = -Infinity;
    for (const f of [1, 2, 3, 4, 5] as const) {
      const s = scoreSingleFinger(cur.midi, hand, f, prevAnchor, nextMidis, maxComfortSpan);
      if (s > bestScore) {
        bestScore = s;
        bestFinger = f;
      }
    }
    return [{ ...cur, hand, finger: bestFinger }];
  }

  // Multi-note hand voicing: map low-to-high for RH (1..5), high-to-low for LH (1..5)
  const ordered = hand === "R" ? sortedAsc : [...sortedAsc].reverse();
  const minM = ordered[0].midi;
  const maxM = ordered[ordered.length - 1].midi;
  const span = Math.abs(maxM - minM);
  const tightHand = maxComfortSpan <= 9;

  const fingers: (1 | 2 | 3 | 4 | 5)[] = [];
  if (ordered.length === 2) {
    const topF = span >= 6 ? 5 : span >= 4 ? (tightHand ? 5 : 4) : span >= 2 ? 3 : 2;
    fingers.push(1, topF);
  } else if (ordered.length === 3) {
    if (span <= 4) fingers.push(1, 2, 3);
    else if (span <= 7) fingers.push(1, tightHand ? 2 : 3, 5);
    else fingers.push(1, 2, 5);
  } else if (ordered.length === 4) {
    if (span <= 6 && !tightHand) fingers.push(1, 2, 3, 4);
    else fingers.push(1, 2, 3, 5);
  } else {
    for (let i = 0; i < ordered.length; i++) {
      fingers.push(clampFinger(1 + (i * 4) / Math.max(1, ordered.length - 1)));
    }
  }

  const result = ordered.map((item, idx) => {
    const ov = overrides[item.note];
    return {
      ...item,
      hand,
      finger: ov && ov.hand === hand ? ov.finger : (fingers[idx] ?? 5),
    };
  });

  // Preserve shared-note anchor finger from previous onset if unassigned by override
  if (prevHandNotes.length > 0) {
    const prevByMidi = new Map(prevHandNotes.map(p => [p.midi, p.finger]));
    for (const item of result) {
      if (overrides[item.note]) continue;
      const prevF = prevByMidi.get(item.midi);
      if (prevF && !result.some(other => other !== item && other.finger === prevF)) {
        item.finger = prevF;
      }
    }
  }

  return result;
}

/**
 * Solves ergonomic piano fingerings (`L`/`R` hand + `1–5` fingers) across a phrase of onsets,
 * using `assignClefsForSplitStaff` (respecting manual hand overrides as constraints) and
 * transition-aware scoring across adjacent onsets (including wrap-around when `loop` is true).
 */
export function solvePianoPhraseFingering(
  onsets: PhraseOnset[],
  options: PianoFingeringOptions = {}
): PianoNoteFingering[][] {
  if (onsets.length === 0) return [];
  const loop = Boolean(options.loop);
  const maxComfortSpan = options.maxComfortSpan ?? 12;

  let prevClefMap = new Map<string, ClefChoice>();
  let lastMelody: MelodyContext | null = null;

  const clefPerOnset = onsets.map((onset, idx) => {
    const inputs = [...new Set(onset.notes)]
      .map((note, nIdx) => ({ note, midi: Note.midi(note) ?? 60, seq: idx * 16 + nIdx }))
      .sort((a, b) => a.midi - b.midi);

    const clefMap = assignClefsForSplitStaff(inputs, prevClefMap, lastMelody);
    const overrides = onset.fingering?.piano ?? {};
    for (const inp of inputs) {
      const ov = overrides[inp.note];
      if (ov) {
        clefMap.set(inp.note, ov.hand === "L" ? "bass" : "treble");
      }
    }

    prevClefMap = clefMap;
    if (inputs.length > 0) {
      const top = inputs[inputs.length - 1];
      lastMelody = { midi: top.midi, clef: clefMap.get(top.note) ?? "treble" };
    }
    return { inputs, clefMap };
  });

  let prevRh: PianoNoteFingering[] = [];
  let prevLh: PianoNoteFingering[] = [];

  const solved = onsets.map((onset, i) => {
    const { inputs, clefMap } = clefPerOnset[i];
    if (inputs.length === 0) {
      prevRh = [];
      prevLh = [];
      return [];
    }

    const nextIdx =
      i + 1 < clefPerOnset.length
        ? i + 1
        : loop && clefPerOnset.length > 1
          ? 0
          : -1;
    const nextInputs = nextIdx !== -1 ? clefPerOnset[nextIdx] : null;
    const nextRhMidis = nextInputs
      ? nextInputs.inputs.filter(n => nextInputs.clefMap.get(n.note) !== "bass").map(n => n.midi)
      : [];
    const nextLhMidis = nextInputs
      ? nextInputs.inputs.filter(n => nextInputs.clefMap.get(n.note) === "bass").map(n => n.midi)
      : [];

    const rhNotes = inputs.filter(n => clefMap.get(n.note) !== "bass");
    const lhNotes = inputs.filter(n => clefMap.get(n.note) === "bass");
    const overrides = onset.fingering?.piano ?? {};

    const rhFingers = fingerChordForHand(rhNotes, "R", prevRh, nextRhMidis, overrides, maxComfortSpan);
    const lhFingers = fingerChordForHand(lhNotes, "L", prevLh, nextLhMidis, overrides, maxComfortSpan);

    prevRh = rhFingers;
    prevLh = lhFingers;

    return [...lhFingers, ...rhFingers];
  });

  // Mark anchor fingers when next onset keeps the same note with the same hand & finger
  return solved.map((list, idx) => {
    const nextIdx = idx + 1 < solved.length ? idx + 1 : loop && solved.length > 1 ? 0 : -1;
    if (nextIdx === -1) return list;
    const nextList = solved[nextIdx];
    const nextMap = new Map(nextList.map(n => [n.note, `${n.hand}${n.finger}`]));
    return list.map(item => ({
      ...item,
      isAnchor: nextMap.get(item.note) === `${item.hand}${item.finger}`,
    }));
  });
}
