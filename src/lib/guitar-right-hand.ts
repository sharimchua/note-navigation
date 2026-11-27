import type {
  GuitarRightHandMode,
  GuitarRightHandSymbol,
  PhraseOnset,
} from "@/lib/phrase-model";
import type { GuitarNoteFingering } from "@/lib/guitar-fingering";

export interface GuitarRightHandNote {
  stringIdx: number; // 0 = lowest string in tuningNotes
  fret: number;
  note: string;
  symbol: GuitarRightHandSymbol;
  displaySymbol: string;
  isAnchor?: boolean;
}

export function formatRightHandSymbol(symbol: GuitarRightHandSymbol): string {
  if (symbol === "D") return "↓";
  if (symbol === "U") return "↑";
  return symbol;
}

/**
 * Solves right-hand guitar technique across a phrase of solved left-hand grips:
 * - `fingerstyle`: assigns `p` to bass string(s) and `i, m, a` bottom-to-top for chords,
 *   or alternates `i / m` (with `p` on low strings) for single-note melodies.
 * - `flatpick-alt`: strict alternating `↓ / ↑` across single-note onsets, `↓` on chords.
 * - `flatpick-econ`: economy picking (sweeps `↓` toward treble strings, `↑` toward bass strings;
 *   alternates on the same string).
 * Respects any manual `onset.fingering?.guitarPick?.[stringIdx]` overrides.
 */
export function solveGuitarRightHand(
  leftHandResults: GuitarNoteFingering[][],
  onsets: PhraseOnset[],
  mode: GuitarRightHandMode,
  loop = false
): GuitarRightHandNote[][] {
  if (mode === "off" || leftHandResults.length === 0) {
    return leftHandResults.map(() => []);
  }

  let prevSinglePick: "D" | "U" = "U";
  let prevSingleFinger: "i" | "m" = "m";
  let prevSingleStringIdx: number | null = null;

  const solved = leftHandResults.map((grip, onsetIdx) => {
    if (grip.length === 0) return [];
    const sorted = [...grip].sort((a, b) => a.stringIdx - b.stringIdx);
    const overrides = onsets[onsetIdx]?.fingering?.guitarPick ?? {};

    if (mode === "fingerstyle") {
      if (sorted.length === 1) {
        const item = sorted[0];
        const ov = overrides[String(item.stringIdx)];
        let sym: GuitarRightHandSymbol;
        if (ov) {
          sym = ov.symbol;
        } else if (item.stringIdx <= 2) {
          sym = "p";
        } else {
          sym = prevSingleFinger === "i" ? "m" : "i";
        }
        if (sym === "i" || sym === "m") prevSingleFinger = sym;
        return [
          {
            stringIdx: item.stringIdx,
            fret: item.fret,
            note: item.note,
            symbol: sym,
            displaySymbol: formatRightHandSymbol(sym),
          },
        ];
      }

      // Multi-note chord/pluck: lowest string (or 2 bass strings when 5+ voices) gets `p`, upper get i, m, a
      const upperPool: GuitarRightHandSymbol[] = ["i", "m", "a"];
      let upperCursor = 0;
      return sorted.map((item, idx) => {
        const ov = overrides[String(item.stringIdx)];
        let sym: GuitarRightHandSymbol;
        if (ov) {
          sym = ov.symbol;
        } else if (idx === 0 || (sorted.length >= 5 && idx === 1 && item.stringIdx <= 2)) {
          sym = "p";
        } else {
          sym = upperPool[Math.min(upperPool.length - 1, upperCursor)];
          upperCursor += 1;
        }
        return {
          stringIdx: item.stringIdx,
          fret: item.fret,
          note: item.note,
          symbol: sym,
          displaySymbol: formatRightHandSymbol(sym),
        };
      });
    }

    // Flatpick modes (`flatpick-alt` | `flatpick-econ`)
    if (sorted.length > 1) {
      // Chord strum
      prevSingleStringIdx = null;
      return sorted.map((item, idx) => {
        const ov = overrides[String(item.stringIdx)];
        const sym: GuitarRightHandSymbol = ov ? ov.symbol : "D";
        if (idx === 0 && (sym === "D" || sym === "U")) prevSinglePick = sym;
        return {
          stringIdx: item.stringIdx,
          fret: item.fret,
          note: item.note,
          symbol: sym,
          displaySymbol: formatRightHandSymbol(sym),
        };
      });
    }

    const single = sorted[0];
    const ov = overrides[String(single.stringIdx)];
    let sym: "D" | "U";
    if (ov && (ov.symbol === "D" || ov.symbol === "U")) {
      sym = ov.symbol;
    } else if (mode === "flatpick-econ" && prevSingleStringIdx !== null && prevSingleStringIdx !== single.stringIdx) {
      // Economy sweep: moving toward higher-pitched string -> D, toward lower-pitched string -> U
      sym = single.stringIdx > prevSingleStringIdx ? "D" : "U";
    } else {
      sym = prevSinglePick === "D" ? "U" : "D";
    }

    prevSinglePick = sym;
    prevSingleStringIdx = single.stringIdx;

    return [
      {
        stringIdx: single.stringIdx,
        fret: single.fret,
        note: single.note,
        symbol: sym,
        displaySymbol: formatRightHandSymbol(sym),
      },
    ];
  });

  // Mark anchor cues when same string keeps same picking symbol on next onset
  return solved.map((list, idx) => {
    const nextIdx = idx + 1 < solved.length ? idx + 1 : loop && solved.length > 1 ? 0 : -1;
    if (nextIdx === -1) return list;
    const nextMap = new Map(solved[nextIdx].map(n => [n.stringIdx, n.symbol]));
    return list.map(n => ({
      ...n,
      isAnchor: nextMap.get(n.stringIdx) === n.symbol,
    }));
  });
}
