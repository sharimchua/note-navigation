import { Note } from "tonal";
import type { PhraseOnset } from "@/lib/phrase-model";
import { canVoiceOnDistinctStrings } from "@/lib/fretboard-window";

export interface GuitarNoteFingering {
  note: string;
  midi: number;
  stringIdx: number; // 0 = lowest string in tuningNotes
  fret: number;      // 0 = open, >= 1 = fretted
  finger: number;    // 0 = open, 1..4 = index..pinky
  isAnchor?: boolean;
}

interface CandidatePos {
  stringIdx: number;
  fret: number;
}

function enumerateDistinctAssignments(
  perNoteCandidates: CandidatePos[][],
  maxResults = 24
): CandidatePos[][] {
  if (perNoteCandidates.length === 0) return [[]];
  const results: CandidatePos[][] = [];
  const usedStrings = new Set<number>();
  const current: CandidatePos[] = [];

  const dfs = (idx: number) => {
    if (results.length >= maxResults) return;
    if (idx === perNoteCandidates.length) {
      results.push([...current]);
      return;
    }
    for (const pos of perNoteCandidates[idx]) {
      if (usedStrings.has(pos.stringIdx)) continue;
      usedStrings.add(pos.stringIdx);
      current.push(pos);
      dfs(idx + 1);
      current.pop();
      usedStrings.delete(pos.stringIdx);
    }
  };

  dfs(0);
  return results;
}

function assignBlockFingers(
  positions: { note: string; midi: number; stringIdx: number; fret: number }[],
  windowStart: number
): GuitarNoteFingering[] {
  // Base ergonomic finger from fret offset inside the vertical block
  const items: GuitarNoteFingering[] = positions.map(p => {
    if (p.fret === 0) {
      return { ...p, finger: 0 };
    }
    const offset = Math.max(0, p.fret - windowStart);
    const rawFinger = offset <= 0 ? 1 : offset === 1 ? 2 : offset === 2 ? 3 : 4;
    return { ...p, finger: rawFinger };
  });

  // Resolve finger collisions on distinct frets (prefer assigning consecutive fingers across different frets)
  const fretted = items.filter(it => it.fret > 0).sort((a, b) => a.fret - b.fret || a.stringIdx - b.stringIdx);
  for (let i = 1; i < fretted.length; i++) {
    const prev = fretted[i - 1];
    const curr = fretted[i];
    if (curr.fret > prev.fret && curr.finger <= prev.finger) {
      curr.finger = Math.min(4, prev.finger + 1);
    }
  }
  for (let i = fretted.length - 2; i >= 0; i--) {
    const curr = fretted[i];
    const next = fretted[i + 1];
    if (curr.fret < next.fret && curr.finger >= next.finger && next.finger > 1) {
      curr.finger = Math.max(1, next.finger - 1);
    }
  }

  return items;
}

/**
 * Solves ergonomic guitar fingerings (`0` open, `1–4` fretting fingers) across a phrase of onsets
 * within `[windowStart, windowStart + windowSize - 1]` (plus open strings `fret = 0`).
 *
 * Uses lookahead scoring across adjacent onsets to reward shared guide/anchor positions and
 * smooth transitions without forcing unnecessary hand leaps, then applies any manual overrides.
 */
export function solveGuitarPhraseFingering(
  tuningNotes: string[],
  onsets: PhraseOnset[],
  windowStart: number,
  windowSize: number
): GuitarNoteFingering[][] {
  if (onsets.length === 0) return [];

  const openMidis = tuningNotes
    .map(n => Note.midi(n))
    .filter((m): m is number => m !== null);
  if (openMidis.length === 0) return onsets.map(() => []);

  const windowEnd = windowStart + windowSize - 1;

  // Build candidate assignments per onset inside the active vertical block (+ open strings)
  const onsetCandidates = onsets.map(onset => {
    const uniqueNotes = [...new Set(onset.notes)]
      .map(note => ({ note, midi: Note.midi(note) }))
      .filter((x): x is { note: string; midi: number } => x.midi !== null)
      .sort((a, b) => a.midi - b.midi);

    if (uniqueNotes.length === 0) return { notes: [], assignments: [[]] as CandidatePos[][] };

    const perNotePos: CandidatePos[][] = uniqueNotes.map(({ midi }) => {
      const candidates: CandidatePos[] = [];
      for (let s = 0; s < openMidis.length; s++) {
        const fret = midi - openMidis[s];
        if (fret === 0 || (fret >= windowStart && fret <= windowEnd)) {
          candidates.push({ stringIdx: s, fret });
        }
      }
      // Fallback: if note can't sit inside window, pick nearest playable fret on the neck
      if (candidates.length === 0) {
        let bestPos: CandidatePos | null = null;
        let bestDist = Infinity;
        for (let s = 0; s < openMidis.length; s++) {
          const fret = midi - openMidis[s];
          if (fret >= 0 && fret <= 21) {
            const dist = fret === 0 ? 0 : Math.min(Math.abs(fret - windowStart), Math.abs(fret - windowEnd));
            if (dist < bestDist) {
              bestDist = dist;
              bestPos = { stringIdx: s, fret };
            }
          }
        }
        if (bestPos) candidates.push(bestPos);
      }
      return candidates;
    });

    const canDistinct =
      uniqueNotes.length <= openMidis.length &&
      canVoiceOnDistinctStrings(perNotePos.map(list => list.map(p => p.stringIdx)));

    const assignments = canDistinct
      ? enumerateDistinctAssignments(perNotePos)
      : [perNotePos.map(list => list[0]).filter((p): p is CandidatePos => Boolean(p))];

    return { notes: uniqueNotes, assignments };
  });

  // Choose the highest-scoring assignment per onset considering lookahead overlap with onset[i+1]
  const chosenPositions: { note: string; midi: number; stringIdx: number; fret: number }[][] = [];

  for (let i = 0; i < onsetCandidates.length; i++) {
    const cur = onsetCandidates[i];
    if (cur.notes.length === 0 || cur.assignments.length === 0) {
      chosenPositions.push([]);
      continue;
    }

    const nextCandidateSet = new Set<string>();
    if (i + 1 < onsetCandidates.length) {
      for (const cand of onsetCandidates[i + 1].assignments) {
        for (const p of cand) nextCandidateSet.add(`${p.stringIdx}:${p.fret}`);
      }
    }

    const prevAssignment = i > 0 ? chosenPositions[i - 1] : [];
    const prevKeys = new Set(prevAssignment.map(p => `${p.stringIdx}:${p.fret}`));

    let bestAssign = cur.assignments[0];
    let bestScore = -Infinity;

    for (const assign of cur.assignments) {
      let score = 0;
      const fretted = assign.filter(p => p.fret > 0).map(p => p.fret);
      const span = fretted.length > 1 ? Math.max(...fretted) - Math.min(...fretted) : 0;
      score -= span * 4;

      for (const p of assign) {
        // Reward open strings and in-block positions
        if (p.fret === 0) score += 2.5;
        else if (p.fret >= windowStart && p.fret <= windowEnd) score += 4;

        const key = `${p.stringIdx}:${p.fret}`;
        // Reward guide/anchor continuity from previous onset and lookahead to next onset
        if (prevKeys.has(key)) score += 3;
        if (nextCandidateSet.has(key)) score += 2.5;
      }

      if (score > bestScore) {
        bestScore = score;
        bestAssign = assign;
      }
    }

    chosenPositions.push(
      cur.notes
        .map((n, idx) => bestAssign[idx] ? { ...n, ...bestAssign[idx] } : null)
        .filter((x): x is { note: string; midi: number; stringIdx: number; fret: number } => Boolean(x))
    );
  }

  // Assign fingers with anchor flags & apply manual overrides
  return chosenPositions.map((posList, i) => {
    const baseFingers = assignBlockFingers(posList, windowStart);
    const nextPositions = i + 1 < chosenPositions.length ? chosenPositions[i + 1] : [];
    const nextPosSet = new Set(nextPositions.map(p => `${p.stringIdx}:${p.fret}`));
    const overrides = onsets[i].fingering?.guitar ?? {};

    return baseFingers.map(item => {
      const posKey = `${item.stringIdx}:${item.fret}`;
      const override = overrides[posKey] ?? overrides[item.note];
      const finger = override ? override.finger : item.finger;
      const isAnchor = nextPosSet.has(posKey);
      return {
        ...item,
        finger,
        isAnchor,
      };
    });
  });
}
