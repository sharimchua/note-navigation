import { Note } from "tonal";
import { getSolfegeColor } from "@/lib/pptConstants";

export const MAX_FRET = 21;
export const MIN_VISIBLE_FRETS = 4;
export const MAX_VISIBLE_FRETS = 18;
export const MIN_WINDOW_SIZE = 3;

export interface FretWindowMatch {
  startFret: number;
  endFret: number;
  matchKind: "exact" | "pitch-class";
  signature: string;
}

export interface StringVibrationSegment {
  fromFret: number;
  toFret: number | null;
  midi: number;
  color: string;
}

interface FretPos {
  s: number;
  f: number;
}

/**
 * Checks whether a list of notes (each represented by candidate string indices)
 * can be voiced simultaneously on distinct strings.
 */
export function canVoiceOnDistinctStrings(perNoteStringSets: number[][]): boolean {
  if (perNoteStringSets.length === 0) return true;
  const ordered = [...perNoteStringSets].sort((a, b) => a.length - b.length);
  const used = new Set<number>();

  const dfs = (idx: number): boolean => {
    if (idx === ordered.length) return true;
    for (const s of ordered[idx]) {
      if (used.has(s)) continue;
      used.add(s);
      if (dfs(idx + 1)) return true;
      used.delete(s);
    }
    return false;
  };

  return dfs(0);
}

/**
 * Collects distinct-string voicing signatures for a set of required notes inside a fretting-hand window,
 * plus the fretted span metadata (`minFrettedFret`, `maxFrettedFret`, `usesOpenString`).
 * Open strings (`f === 0`) do not consume fretting-hand reach.
 */
function collectDistinctVoicingSignature(
  perNotePositions: FretPos[][]
): { signature: string; minFrettedFret: number; maxFrettedFret: number; usesOpenString: boolean } | null {
  if (perNotePositions.length === 0) return null;
  const ordered = [...perNotePositions].sort((a, b) => a.length - b.length);
  const usedStrings = new Set<number>();
  const current: FretPos[] = [];
  const voicingSigs = new Set<string>();
  let minFretted = Infinity;
  let maxFretted = 0;
  let usesOpen = false;

  const dfs = (idx: number) => {
    if (voicingSigs.size >= 16) return;
    if (idx === ordered.length) {
      const fretted = current.filter(p => p.f > 0);
      if (fretted.length > 0) {
        const minF = Math.min(...fretted.map(p => p.f));
        const maxF = Math.max(...fretted.map(p => p.f));
        if (maxF - minF > 4) return;
      }
      const sorted = [...current].sort((a, b) => a.s - b.s || a.f - b.f);
      voicingSigs.add(sorted.map(p => `${p.s}:${p.f}`).join(","));
      for (const p of sorted) {
        if (p.f === 0) {
          usesOpen = true;
        } else {
          if (p.f < minFretted) minFretted = p.f;
          if (p.f > maxFretted) maxFretted = p.f;
        }
      }
      return;
    }
    for (const pos of ordered[idx]) {
      if (usedStrings.has(pos.s)) continue;
      usedStrings.add(pos.s);
      current.push(pos);
      dfs(idx + 1);
      current.pop();
      usedStrings.delete(pos.s);
    }
  };

  dfs(0);
  if (voicingSigs.size === 0) return null;
  return {
    signature: [...voicingSigs].sort().join("|"),
    minFrettedFret: minFretted === Infinity ? 1 : minFretted,
    maxFrettedFret: maxFretted === 0 ? 1 : maxFretted,
    usesOpenString: usesOpen,
  };
}

interface CandidateWindow {
  wStart: number;
  wEnd: number;
  matchKind: "exact" | "pitch-class";
  distinctPlayable: boolean;
  signature: string;
  anchorStart: number;
}

/**
 * Finds distinct, deduplicated vertical fretting-hand blocks (`windowSize` frets wide, starting at fret >= 1)
 * where all `requiredNotes` can be voiced. Open strings (fret `0`) are always available alongside any
 * fretting-hand block and never consume a fret of the window.
 *
 * Overlapping windows that represent the exact same playable `(string, fret)` positions
 * are collapsed to a single canonical anchor window.
 */
export function findDistinctFretWindows(
  tuningNotes: string[],
  requiredNotes: string[],
  windowSize: number,
  maxFret: number = MAX_FRET
): FretWindowMatch[] {
  const maxStart = Math.max(1, maxFret - windowSize + 1);
  if (requiredNotes.length === 0) {
    return Array.from({ length: maxStart }, (_, i) => {
      const startFret = i + 1;
      return {
        startFret,
        endFret: startFret + windowSize - 1,
        matchKind: "exact" as const,
        signature: `empty:${startFret}`,
      };
    });
  }

  const openMidis = tuningNotes
    .map(n => Note.midi(n))
    .filter((m): m is number => m !== null);

  const requiredMidis = [...new Set(
    requiredNotes
      .map(n => Note.midi(n))
      .filter((m): m is number => m !== null)
  )];

  if (openMidis.length === 0 || requiredMidis.length === 0) {
    return [];
  }

  const requiredPcs = [...new Set(requiredMidis.map(m => ((m % 12) + 12) % 12))];

  const exactDistinct: CandidateWindow[] = [];
  const exactAny: CandidateWindow[] = [];
  const pcDistinct: CandidateWindow[] = [];
  const pcAny: CandidateWindow[] = [];

  for (let wStart = 1; wStart <= maxStart; wStart++) {
    const wEnd = wStart + windowSize - 1;
    const positionsByMidi = new Map<number, FretPos[]>();
    const positionsByPc = new Map<number, FretPos[]>();

    const recordPos = (s: number, f: number, openMidi: number) => {
      const m = openMidi + f;
      const pc = ((m % 12) + 12) % 12;
      const pos = { s, f };

      const mList = positionsByMidi.get(m);
      if (mList) mList.push(pos);
      else positionsByMidi.set(m, [pos]);

      const pList = positionsByPc.get(pc);
      if (pList) pList.push(pos);
      else positionsByPc.set(pc, [pos]);
    };

    for (let s = 0; s < openMidis.length; s++) {
      const openMidi = openMidis[s];
      // Open string (fret 0) is always playable without consuming a fretting finger
      recordPos(s, 0, openMidi);
      for (let f = wStart; f <= wEnd; f++) {
        recordPos(s, f, openMidi);
      }
    }

    const computeAnchor = (minFretted: number, maxFretted: number, usesOpen: boolean) => {
      if (usesOpen && maxFretted <= windowSize) return 1;
      return Math.max(1, Math.min(maxStart, minFretted));
    };

    const hasAllExact = requiredMidis.every(m => positionsByMidi.has(m));
    if (hasAllExact) {
      const perNotePos = requiredMidis.map(m => positionsByMidi.get(m) ?? []);
      const distinctInfo =
        requiredMidis.length <= openMidis.length
          ? collectDistinctVoicingSignature(perNotePos)
          : null;

      if (distinctInfo) {
        exactDistinct.push({
          wStart,
          wEnd,
          matchKind: "exact",
          distinctPlayable: true,
          signature: `exact:${distinctInfo.signature}`,
          anchorStart: computeAnchor(
            distinctInfo.minFrettedFret,
            distinctInfo.maxFrettedFret,
            distinctInfo.usesOpenString
          ),
        });
      } else {
        const allPositions = perNotePos.flat();
        const sortedPos = [...allPositions].sort((a, b) => a.s - b.s || a.f - b.f);
        const fretted = sortedPos.filter(p => p.f > 0).map(p => p.f);
        const minFretted = fretted.length > 0 ? Math.min(...fretted) : 1;
        const maxFretted = fretted.length > 0 ? Math.max(...fretted) : 1;
        const usesOpen = sortedPos.some(p => p.f === 0);
        exactAny.push({
          wStart,
          wEnd,
          matchKind: "exact",
          distinctPlayable: false,
          signature: `exact-any:${sortedPos.map(p => `${p.s}:${p.f}`).join(",")}`,
          anchorStart: computeAnchor(minFretted, maxFretted, usesOpen),
        });
      }
      continue;
    }

    const hasAllPcs = requiredPcs.every(pc => positionsByPc.has(pc));
    if (hasAllPcs) {
      const perPcPos = requiredPcs.map(pc => positionsByPc.get(pc) ?? []);
      const distinctInfo =
        requiredPcs.length <= openMidis.length
          ? collectDistinctVoicingSignature(perPcPos)
          : null;

      if (distinctInfo) {
        pcDistinct.push({
          wStart,
          wEnd,
          matchKind: "pitch-class",
          distinctPlayable: true,
          signature: `pc:${distinctInfo.signature}`,
          anchorStart: computeAnchor(
            distinctInfo.minFrettedFret,
            distinctInfo.maxFrettedFret,
            distinctInfo.usesOpenString
          ),
        });
      } else {
        const allPositions = perPcPos.flat();
        const sortedPos = [...allPositions].sort((a, b) => a.s - b.s || a.f - b.f);
        const fretted = sortedPos.filter(p => p.f > 0).map(p => p.f);
        const minFretted = fretted.length > 0 ? Math.min(...fretted) : 1;
        const maxFretted = fretted.length > 0 ? Math.max(...fretted) : 1;
        const usesOpen = sortedPos.some(p => p.f === 0);
        pcAny.push({
          wStart,
          wEnd,
          matchKind: "pitch-class",
          distinctPlayable: false,
          signature: `pc-any:${sortedPos.map(p => `${p.s}:${p.f}`).join(",")}`,
          anchorStart: computeAnchor(minFretted, maxFretted, usesOpen),
        });
      }
    }
  }

  const chosenTier =
    exactDistinct.length > 0
      ? exactDistinct
      : exactAny.length > 0
        ? exactAny
        : pcDistinct.length > 0
          ? pcDistinct
          : pcAny;

  const bySignature = new Map<string, CandidateWindow[]>();
  for (const c of chosenTier) {
    const arr = bySignature.get(c.signature);
    if (arr) arr.push(c);
    else bySignature.set(c.signature, [c]);
  }

  const deduped: FretWindowMatch[] = [];
  for (const group of bySignature.values()) {
    const targetAnchor = group[0].anchorStart;
    const canonical =
      group.find(g => g.wStart === targetAnchor) ??
      group[0];
    deduped.push({
      startFret: canonical.wStart,
      endFret: canonical.wEnd,
      matchKind: canonical.matchKind,
      signature: canonical.signature,
    });
  }

  return deduped.sort((a, b) => a.startFret - b.startFret);
}

/**
 * Returns the deduplicated starting frets of valid vertical windows.
 */
export function findValidFretWindows(
  tuningNotes: string[],
  requiredNotes: string[],
  windowSize: number,
  maxFret: number = MAX_FRET
): number[] {
  return findDistinctFretWindows(tuningNotes, requiredNotes, windowSize, maxFret).map(
    m => m.startFret
  );
}

/**
 * Steps the active vertical fret window forward or backward through `validStarts`.
 * Falls back to stepping by 1 fret within `[minStart, maxStart]` when no valid window exists.
 */
export function stepFretWindow(
  currentStart: number,
  direction: -1 | 1,
  validStarts: number[],
  minStart: number = 1,
  maxStart: number = MAX_FRET
): number {
  const clamp = (v: number) => Math.max(minStart, Math.min(maxStart, v));

  if (validStarts.length === 0) {
    return clamp(currentStart + direction);
  }

  const sorted = [...validStarts].sort((a, b) => a - b);
  if (direction === 1) {
    const next = sorted.find(s => s > currentStart);
    return clamp(next ?? sorted[sorted.length - 1]);
  } else {
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i] < currentStart) {
        return clamp(sorted[i]);
      }
    }
    return clamp(sorted[0]);
  }
}

/**
 * Computes a `visibleStart` fret offset so the entire `[windowStart, windowStart + windowSize - 1]`
 * vertical block stays inside the visible fretboard range without horizontal scrolling.
 */
export function ensureWindowVisible(
  windowStart: number,
  windowSize: number,
  visibleStart: number,
  visibleFrets: number,
  maxFret: number = MAX_FRET
): number {
  const windowEnd = windowStart + windowSize - 1;
  const maxVisibleStart = Math.max(0, maxFret - visibleFrets + 1);
  const clampedVisible = Math.max(0, Math.min(maxVisibleStart, visibleStart));

  if (windowStart <= 1) {
    return 0;
  }

  const visibleEnd = clampedVisible === 0
    ? visibleFrets
    : clampedVisible + visibleFrets - 1;

  if (windowStart >= clampedVisible && windowEnd <= visibleEnd) {
    return clampedVisible;
  }

  if (windowStart < clampedVisible) {
    return Math.max(0, Math.min(maxVisibleStart, windowStart));
  }

  const shifted = windowEnd - visibleFrets + 1;
  return Math.max(0, Math.min(maxVisibleStart, shifted));
}

/**
 * Computes vibrating string colour segments on a single guitar string.
 * Always checks open string (`fret = 0`) plus fretted positions in `[windowStart, windowEnd]`.
 * Each active note colours the string from its fret line toward the bridge, stopping at the
 * fret line of the next higher fretted note on that same string.
 */
export function computeStringVibrationSegments(
  openMidi: number,
  isMidiVisible: (midi: number) => boolean,
  windowStart: number,
  windowEnd: number,
  tonicChroma: number
): StringVibrationSegment[] {
  const hits: { fret: number; midi: number }[] = [];
  if (isMidiVisible(openMidi)) {
    hits.push({ fret: 0, midi: openMidi });
  }
  for (let fret = Math.max(1, windowStart); fret <= windowEnd; fret++) {
    const midi = openMidi + fret;
    if (isMidiVisible(midi)) {
      hits.push({ fret, midi });
    }
  }

  return hits.map((hit, idx) => ({
    fromFret: hit.fret,
    toFret: idx + 1 < hits.length ? hits[idx + 1].fret : null,
    midi: hit.midi,
    color: getSolfegeColor(hit.midi % 12, tonicChroma, { neonFi: true }),
  }));
}
