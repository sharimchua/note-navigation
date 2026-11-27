import { Note } from "tonal";
import type { PhraseOnset } from "@/lib/phrase-model";
import { canVoiceOnDistinctStrings } from "@/lib/fretboard-window";

export interface GuitarNoteFingering {
  note: string;
  midi: number;
  stringIdx: number; // 0 = lowest string in tuningNotes
  fret: number;      // 0 = open, >= 1 = fretted
  finger: number;    // 0 = open, 1..4 = fretting fingers
  isAnchor?: boolean;
}

export interface GuitarFingeringOptions {
  loop?: boolean;
}

export interface GuitarOnsetDiagnosis {
  playable: boolean;
  unreachableNotes: string[];
  reason?: string;
}

export interface GuitarPhraseSolveResult {
  grips: GuitarNoteFingering[][];
  diagnostics: GuitarOnsetDiagnosis[];
}

interface CandidatePos {
  stringIdx: number;
  fret: number;
  note: string;
  midi: number;
}

/**
 * Checks whether a simultaneous grip is physically playable within 4 fretting fingers:
 * - Fretted span (maxFret - minFret) <= 4
 * - At most 4 fingers needed (a barre at `minFret` covers >= 2 strings at `minFret` as finger 1,
 *   provided no higher string `s > barreStart` in the grip is played open `fret === 0`).
 */
function isPlayableGrip(assign: CandidatePos[]): boolean {
  const fretted = assign.filter(p => p.fret > 0);
  if (fretted.length === 0) return true;

  const minFret = Math.min(...fretted.map(p => p.fret));
  const maxFret = Math.max(...fretted.map(p => p.fret));
  if (maxFret - minFret > 4) return false;

  if (fretted.length <= 4) return true;

  // 5 or 6 fretted notes: require a valid barre on minFret
  const atMin = fretted.filter(p => p.fret === minFret).sort((a, b) => a.stringIdx - b.stringIdx);
  if (atMin.length < 2) return false;

  const barreStart = atMin[0].stringIdx;
  const hasOpenAboveBarre = assign.some(p => p.fret === 0 && p.stringIdx > barreStart);
  if (hasOpenAboveBarre) return false;

  const aboveMinCount = fretted.filter(p => p.fret > minFret).length;
  return aboveMinCount <= 3;
}

function enumerateDistinctAssignments(
  perNoteCandidates: CandidatePos[][],
  maxResults = 128
): CandidatePos[][] {
  if (perNoteCandidates.length === 0) return [[]];
  // Order notes with fewest candidates first for fast pruning, keeping original order via index
  const indexed = perNoteCandidates
    .map((list, idx) => ({ list, idx }))
    .sort((a, b) => a.list.length - b.list.length);

  const results: CandidatePos[][] = [];
  const usedStrings = new Set<number>();
  const current: CandidatePos[] = new Array(perNoteCandidates.length);

  const dfs = (depth: number) => {
    if (results.length >= maxResults) return;
    if (depth === indexed.length) {
      if (isPlayableGrip(current)) {
        results.push([...current]);
      }
      return;
    }
    const { list, idx } = indexed[depth];
    for (const pos of list) {
      if (usedStrings.has(pos.stringIdx)) continue;
      usedStrings.add(pos.stringIdx);
      current[idx] = pos;
      dfs(depth + 1);
      usedStrings.delete(pos.stringIdx);
    }
  };

  dfs(0);
  return results;
}

function assignBlockFingers(
  positions: CandidatePos[],
  windowStart: number
): GuitarNoteFingering[] {
  const fretted = positions
    .filter(p => p.fret > 0)
    .sort((a, b) => a.fret - b.fret || a.stringIdx - b.stringIdx);

  if (fretted.length === 0) {
    return positions.map(p => ({ ...p, finger: 0 }));
  }

  const minFret = fretted[0].fret;
  const atMin = fretted.filter(p => p.fret === minFret);
  const barreStart = atMin[0].stringIdx;
  const needsBarre =
    fretted.length > 4 &&
    atMin.length >= 2 &&
    !positions.some(p => p.fret === 0 && p.stringIdx > barreStart);

  const fingerByPosKey = new Map<string, number>();

  if (needsBarre) {
    for (const p of atMin) {
      fingerByPosKey.set(`${p.stringIdx}:${p.fret}`, 1);
    }
    const aboveMin = fretted.filter(p => p.fret > minFret);
    let nextF = 2;
    for (const p of aboveMin) {
      const offsetF = Math.max(2, Math.min(4, p.fret - minFret + 1));
      const f = Math.max(nextF, offsetF);
      fingerByPosKey.set(`${p.stringIdx}:${p.fret}`, Math.min(4, f));
      nextF = Math.min(4, f + 1);
    }
  } else {
    // 1..4 fretted notes: map by fret offset inside the block, then resolve collisions cleanly
    const assigned = fretted.map(p => {
      const offset = Math.max(0, p.fret - windowStart);
      const rawFinger = offset <= 0 ? 1 : offset === 1 ? 2 : offset === 2 ? 3 : 4;
      return { pos: p, finger: rawFinger };
    });

    for (let i = 1; i < assigned.length; i++) {
      const prev = assigned[i - 1];
      const curr = assigned[i];
      if (curr.pos.fret > prev.pos.fret && curr.finger <= prev.finger) {
        curr.finger = Math.min(4, prev.finger + 1);
      } else if (
        curr.pos.fret === prev.pos.fret &&
        curr.finger === prev.finger &&
        assigned.length <= 4
      ) {
        // Prefer distinct fingers for notes on the same fret when <= 4 fretted notes (e.g. open A / E)
        if (curr.finger < 4) {
          curr.finger = curr.finger + 1;
        }
      }
    }
    for (let i = assigned.length - 2; i >= 0; i--) {
      const curr = assigned[i];
      const next = assigned[i + 1];
      if (curr.pos.fret < next.pos.fret && curr.finger >= next.finger && next.finger > 1) {
        curr.finger = Math.max(1, next.finger - 1);
      }
    }

    for (const item of assigned) {
      fingerByPosKey.set(`${item.pos.stringIdx}:${item.pos.fret}`, item.finger);
    }
  }

  return positions.map(p => ({
    ...p,
    finger: p.fret === 0 ? 0 : (fingerByPosKey.get(`${p.stringIdx}:${p.fret}`) ?? 1),
  }));
}

/**
 * Solves ergonomic, simultaneous chord fingerings (`0` open, `1–4` fretting fingers) across a phrase
 * strictly within `[windowStart, windowStart + windowSize - 1]` (plus open strings `fret = 0`).
 *
 * 1. First attempts exact-MIDI simultaneous distinct-string voicings inside the block.
 * 2. If exact octaves cannot fit simultaneously inside the block (e.g. piano close voicings),
 *    voices the chord's unique pitch classes simultaneously inside the block.
 * 3. Never suggests fretted notes outside `[windowStart, windowEnd]`.
 */
export function solveGuitarPhraseWithDiagnostics(
  tuningNotes: string[],
  onsets: PhraseOnset[],
  windowStart: number,
  windowSize: number,
  options: GuitarFingeringOptions = {}
): GuitarPhraseSolveResult {
  if (onsets.length === 0) return { grips: [], diagnostics: [] };
  const loop = Boolean(options.loop);

  const openMidis = tuningNotes
    .map(n => Note.midi(n))
    .filter((m): m is number => m !== null);
  if (openMidis.length === 0) {
    return {
      grips: onsets.map(() => []),
      diagnostics: onsets.map(() => ({ playable: true, unreachableNotes: [] })),
    };
  }

  const windowEnd = windowStart + windowSize - 1;

  const onsetCandidates = onsets.map(onset => {
    const uniqueNotes = [...new Set(onset.notes)]
      .map(note => ({ note, midi: Note.midi(note) }))
      .filter((x): x is { note: string; midi: number } => x.midi !== null)
      .sort((a, b) => a.midi - b.midi);

    if (uniqueNotes.length === 0) {
      return {
        assignments: [[]] as CandidatePos[][],
        diagnosis: { playable: true, unreachableNotes: [] } as GuitarOnsetDiagnosis,
      };
    }

    // 1. Exact MIDI candidates strictly inside [windowStart, windowEnd] (+ open fret 0)
    const buildExactCandidates = (shiftSemitones: number): CandidatePos[][] =>
      uniqueNotes.map(({ midi }) => {
        const shiftedMidi = midi + shiftSemitones;
        const list: CandidatePos[] = [];
        for (let s = 0; s < openMidis.length; s++) {
          const fret = shiftedMidi - openMidis[s];
          if (fret === 0 || (fret >= windowStart && fret <= windowEnd)) {
            const note = Note.fromMidi(shiftedMidi);
            list.push({ stringIdx: s, fret, note, midi: shiftedMidi });
          }
        }
        return list;
      });

    const exactInWindow = buildExactCandidates(0);
    let assignments: CandidatePos[][] = [];
    if (
      uniqueNotes.length <= openMidis.length &&
      exactInWindow.every(list => list.length > 0) &&
      canVoiceOnDistinctStrings(exactInWindow.map(list => list.map(p => p.stringIdx)))
    ) {
      assignments = enumerateDistinctAssignments(exactInWindow, 128);
    }

    // 2. If exact octave doesn't fit in the block, try shifting the ENTIRE voicing uniformly by ±12
    //    (preserves closed/open voicing & bass inversion without scrambling intervals)
    if (assignments.length === 0) {
      for (const shift of [-12, 12]) {
        const shifted = buildExactCandidates(shift);
        if (
          uniqueNotes.length <= openMidis.length &&
          shifted.every(list => list.length > 0) &&
          canVoiceOnDistinctStrings(shifted.map(list => list.map(p => p.stringIdx)))
        ) {
          assignments = enumerateDistinctAssignments(shifted, 128);
          if (assignments.length > 0) break;
        }
      }
    }

    let diagnosis: GuitarOnsetDiagnosis = { playable: true, unreachableNotes: [] };
    if (assignments.length === 0) {
      // Find the largest playable subset inside [windowStart, windowEnd] (+ open 0)
      // so the teacher sees the closest partial grip and which chord tone(s) could not be reached.
      let bestSubsetAssigns: CandidatePos[][] = [];
      let bestDroppedNotes: string[] = uniqueNotes.map(n => n.note);

      const searchSubsets = (shiftSemitones: number) => {
        const shiftedCands = buildExactCandidates(shiftSemitones);
        for (let targetSize = uniqueNotes.length - 1; targetSize >= 1; targetSize--) {
          if (bestSubsetAssigns.length > 0 && bestDroppedNotes.length <= uniqueNotes.length - targetSize) {
            break;
          }
          const chosenIndices: number[] = [];
          const combine = (startIdx: number) => {
            if (chosenIndices.length === targetSize) {
              const subCands = chosenIndices.map(idx => shiftedCands[idx]);
              if (
                subCands.every(list => list.length > 0) &&
                canVoiceOnDistinctStrings(subCands.map(list => list.map(p => p.stringIdx)))
              ) {
                const found = enumerateDistinctAssignments(subCands, 32);
                if (found.length > 0) {
                  const chosenSet = new Set(chosenIndices);
                  const dropped = uniqueNotes
                    .filter((_, idx) => !chosenSet.has(idx))
                    .map(n => n.note);
                  // Prefer keeping the bass note (index 0) when tie-breaking subsets of equal size
                  const keepsBass = chosenSet.has(0);
                  const prevKeepsBass =
                    bestSubsetAssigns.length > 0 &&
                    !bestDroppedNotes.includes(uniqueNotes[0].note);
                  if (bestSubsetAssigns.length === 0 || (keepsBass && !prevKeepsBass)) {
                    bestSubsetAssigns = found;
                    bestDroppedNotes = dropped;
                  }
                }
              }
              return;
            }
            for (let i = startIdx; i < uniqueNotes.length; i++) {
              chosenIndices.push(i);
              combine(i + 1);
              chosenIndices.pop();
            }
          };
          combine(0);
          if (bestSubsetAssigns.length > 0) break;
        }
      };

      searchSubsets(0);
      if (bestSubsetAssigns.length === 0) {
        searchSubsets(-12);
      }
      if (bestSubsetAssigns.length === 0) {
        searchSubsets(12);
      }

      if (bestSubsetAssigns.length > 0) {
        assignments = bestSubsetAssigns;
      }

      const unreachableNotes = bestDroppedNotes;
      const reason =
        unreachableNotes.length > 0
          ? `Unreachable in F${windowStart}–F${windowEnd}: ${unreachableNotes.join(", ")}`
          : uniqueNotes.length > openMidis.length
            ? `Too many tones (${uniqueNotes.length}) for ${openMidis.length} strings`
            : `Voicing not playable in F${windowStart}–F${windowEnd} (revoice or widen span)`;
      diagnosis = {
        playable: false,
        unreachableNotes,
        reason,
      };
    }

    return { assignments, diagnosis };
  });

  // Choose the highest-scoring playable grip per onset considering lookahead & overrides
  const chosenPositions: CandidatePos[][] = [];

  for (let i = 0; i < onsetCandidates.length; i++) {
    const cur = onsetCandidates[i];
    if (cur.assignments.length === 0) {
      chosenPositions.push([]);
      continue;
    }

    const nextIdx =
      i + 1 < onsetCandidates.length
        ? i + 1
        : loop && onsetCandidates.length > 1
          ? 0
          : -1;
    const nextCandidateSet = new Set<string>();
    if (nextIdx !== -1) {
      for (const cand of onsetCandidates[nextIdx].assignments) {
        for (const p of cand) nextCandidateSet.add(`${p.stringIdx}:${p.fret}`);
      }
    }

    const overrides = onsets[i].fingering?.guitar ?? {};
    const overridePosKeys = new Set(
      Object.values(overrides).map(ov => `${ov.stringIdx}:${ov.fret}`)
    );

    const prevAssignment = i > 0 ? chosenPositions[i - 1] : [];
    const prevKeys = new Set(prevAssignment.map(p => `${p.stringIdx}:${p.fret}`));

    let bestAssign = cur.assignments[0];
    let bestScore = -Infinity;

    for (const assign of cur.assignments) {
      let score = 0;
      const fretted = assign.filter(p => p.fret > 0).map(p => p.fret);
      const span = fretted.length > 1 ? Math.max(...fretted) - Math.min(...fretted) : 0;
      score -= span * 4;

      // Slight preference for compact adjacent-string voicings over wide string skips
      const stringsSorted = assign.map(p => p.stringIdx).sort((a, b) => a - b);
      for (let k = 1; k < stringsSorted.length; k++) {
        score -= (stringsSorted[k] - stringsSorted[k - 1] - 1) * 0.8;
      }

      for (const p of assign) {
        if (p.fret === 0) score += 4.5;
        else score += 4;

        const key = `${p.stringIdx}:${p.fret}`;
        if (overridePosKeys.has(key)) score += 25;
        if (prevKeys.has(key)) score += 3;
        if (nextCandidateSet.has(key)) score += 2.5;
      }

      if (score > bestScore) {
        bestScore = score;
        bestAssign = assign;
      }
    }

    chosenPositions.push(bestAssign);
  }

  // Assign fingers with anchor flags & apply manual overrides
  const grips = chosenPositions.map((posList, i) => {
    const baseFingers = assignBlockFingers(posList, windowStart);
    const nextIdx =
      i + 1 < chosenPositions.length
        ? i + 1
        : loop && chosenPositions.length > 1
          ? 0
          : -1;
    const nextPositions = nextIdx !== -1 ? chosenPositions[nextIdx] : [];
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

  return {
    grips,
    diagnostics: onsetCandidates.map(c => c.diagnosis),
  };
}

export function solveGuitarPhraseFingering(
  tuningNotes: string[],
  onsets: PhraseOnset[],
  windowStart: number,
  windowSize: number,
  options: GuitarFingeringOptions = {}
): GuitarNoteFingering[][] {
  return solveGuitarPhraseWithDiagnostics(tuningNotes, onsets, windowStart, windowSize, options).grips;
}
