export type GuitarRightHandSymbol = "p" | "i" | "m" | "a" | "D" | "U";

export type GuitarRightHandMode =
  | "off"
  | "fingerstyle"
  | "flatpick-alt"
  | "flatpick-econ";

export type PhraseMidiMode = "capture" | "play-over" | "off";

export type PianoComfortSpan = 9 | 12 | 14;

export interface GuitarFingerOverride {
  stringIdx: number;
  fret: number;
  finger: number; // 0 = open, 1..4 = fretting fingers
}

export interface GuitarPickOverride {
  stringIdx: number;
  symbol: GuitarRightHandSymbol;
}

export interface PianoFingerOverride {
  hand: "L" | "R";
  finger: 1 | 2 | 3 | 4 | 5;
}

export interface OnsetFingering {
  /** Keyed by `${stringIdx}:${fret}` or note name */
  guitar?: Record<string, GuitarFingerOverride>;
  /** Keyed by `${stringIdx}` */
  guitarPick?: Record<string, GuitarPickOverride>;
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
