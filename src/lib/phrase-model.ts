export interface GuitarFingerOverride {
  stringIdx: number;
  fret: number;
  finger: number; // 0 = open, 1..4 = fretting fingers
}

export interface PianoFingerOverride {
  hand: "L" | "R";
  finger: 1 | 2 | 3 | 4 | 5;
}

export interface OnsetFingering {
  /** Keyed by `${stringIdx}:${fret}` or note name */
  guitar?: Record<string, GuitarFingerOverride>;
  /** Keyed by note name (e.g. "C4") */
  piano?: Record<string, PianoFingerOverride>;
}

export interface PhraseOnset {
  id: string;
  notes: string[];
  label?: string;
  fingering?: OnsetFingering;
  /** Reserved for future ppt-engraver rhythm grid & note-value support */
  durationBeats?: number;
}

let onsetSeq = 0;

export function createOnsetId(): string {
  onsetSeq += 1;
  return `onset-${Date.now().toString(36)}-${onsetSeq}`;
}

export function createEmptyOnset(label?: string): PhraseOnset {
  return {
    id: createOnsetId(),
    notes: [],
    label,
  };
}

export function createOnsetFromNotes(notes: string[], label?: string): PhraseOnset {
  return {
    id: createOnsetId(),
    notes: [...notes],
    label,
  };
}
