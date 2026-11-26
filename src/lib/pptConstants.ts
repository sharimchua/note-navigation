// ─── Canonical Prime Period Theory (PPT) Constants & Helpers ─────────────
// Shared definitions ported from ppt-visualiser, ppt-spectrum, and harmony-geometry.
import { Note } from "tonal";

// Canonical Uniform Solfège SVG Path data (from ppt-engraver / PPT specification)
export const PATH_BASE =
  'M 26.2,80.6 L 38.9,67.4 L 55.9,49.8 L 75,30.2 L 84.8,0 L 75,-30.2 L 71.4,-41.2 L 68.6,-49.8 L 40.5,-70.2 L 26.2,-80.6 L 0,-84.8 L -26.2,-80.6 L -40.5,-70.2 L -68.6,-49.8 L -71.4,-41.2 L -75,-30.2 L -84.8,0 L -75,30.2 L -55.9,49.8 L -38.9,67.4 L -26.2,80.6 L -25,43.2 L -33,38.1 L -40.7,29.2 L -44,25.4 L -47.3,21.6 L -48.3,14.2 L -50.4,0 L -48.3,-14.2 L -44.5,-22.6 L -39.3,-34 L -33,-38.1 L -25,-43.2 L -20.9,-45.8 L -14.7,-49.8 L 0,-50.4 L 14.7,-49.8 L 20.9,-45.8 L 25,-43.2 L 33,-38.1 L 39.3,-34 L 44.5,-22.6 L 48.3,-14.2 L 50.4,0 L 48.3,14.2 L 47.3,21.6 L 44,25.4 L 40.7,29.2 L 33,38.1 L 25,43.2 Z';

export const PATH_SHARP =
  'M 0,100 L 0,80.7 L 0.1,80.6 L 26.2,80.6 L 38.9,67.4 L 44.7,61.5 L 46.2,59.9 L 55.9,49.8 L 28.8,49.8 L 14.8,74 L 11,80.6 L 0,80.6 L 0,52 L 7.2,49.9 L 14.6,49.9 L 14.7,49.8 L 7.3,49.8 L 20.9,45.8 L 25,43.2 L 33,38.1 L 40.7,29.2 L 42.4,27.2 L 44,25.4 L 47.3,21.6 L 48,16.5 L 48.3,14.2 L 50.4,0 L 51.4,-7.4 L 48.3,-14.2 L 44.5,-22.6 L 43.4,-25 L 42.4,-27.2 L 39.3,-34 L 37.1,-35.4 L 33,-38.1 L 25,-43.2 L 20.9,-45.8 L 14.7,-49.8 L 14.6,-49.9 L -14.6,-49.9 L -14.7,-49.8 L -20.9,-45.8 L -25,-43.2 L -33,-38.1 L -37.1,-35.4 L -39.3,-34 L -42.4,-27.2 L -43.4,-25 L -44.5,-22.6 L -48.3,-14.2 L -51.4,-7.4 L -50.4,0 L -48.3,14.2 L -48,16.5 L -47.3,21.6 L -44,25.4 L -42.4,27.2 L -40.7,29.2 L -33,38.1 L -25,43.2 L -25.7,44.4 L -28.8,49.8 L -56,49.8 L -66.8,38.6 L -69.7,35.6 L -75,30.2 L -84.8,0 L -75,-30.2 L -71.4,-41.2 L -68.6,-49.8 L -40.5,-70.2 L -26.2,-80.6 L 26.2,-80.6 L 11,-80.6 L 26.2,-80.6 L 40.5,-70.2 L 68.6,-49.8 L 71.4,-41.2 L 75,-30.2 L 84.8,0 L 75,30.2 L 81.1,40.8 L 86.3,49.8 L 86.6,50 A 100,100 0 0 1 58.8,80.9 A 100,100 0 0 1 50,86.6 A 100,100 0 0 1 0,100 Z';

export const PATH_FLAT =
  'M 0,100 A 100,100 0 0 1 -50,86.6 A 100,100 0 0 1 -58.8,80.9 A 100,100 0 0 1 -86.6,50 L -86.3,49.8 L -81.1,40.8 L -75,30.2 L -84.8,0 L -75,-30.2 L -71.4,-41.2 L -68.6,-49.8 L -40.5,-70.2 L -26.2,-80.6 L 26.2,-80.6 L 11,-80.6 L 26.2,-80.6 L 40.5,-70.2 L 68.6,-49.8 L 71.4,-41.2 L 75,-30.2 L 84.8,0 L 75,30.2 L 69.7,35.6 L 66.8,38.6 L 55.9,49.8 L 28.8,49.8 L 25.7,44.4 L 25,43.2 L 33,38.1 L 40.7,29.2 L 42.4,27.2 L 44,25.4 L 47.3,21.6 L 48,16.5 L 48.3,14.2 L 50.4,0 L 51.4,-7.4 L 48.3,-14.2 L 44.5,-22.6 L 43.4,-25 L 42.4,-27.2 L 39.3,-34 L 37.1,-35.4 L 33,-38.1 L 25,-43.2 L 20.9,-45.8 L 14.7,-49.8 L 14.6,-49.9 L -14.6,-49.9 L -14.7,-49.8 L -20.9,-45.8 L -25,-43.2 L -33,-38.1 L -37.1,-35.4 L -39.3,-34 L -42.4,-27.2 L -43.4,-25 L -44.5,-22.6 L -48.3,-14.2 L -51.4,-7.4 L -50.4,0 L -48.3,14.2 L -48,16.5 L -47.3,21.6 L -44,25.4 L -42.4,27.2 L -40.7,29.2 L -33,38.1 L -25,43.2 L -20.9,45.8 L -7.3,49.8 L -14.7,49.8 L -14.6,49.9 L -7.2,49.9 L 0,52 L 0,80.6 L -11,80.6 L -14.8,74 L -28.8,49.8 L -56,49.8 L -46.3,59.9 L -44.7,61.5 L -38.9,67.5 L -26.2,80.6 L -0.1,80.6 L 0,80.7 L 0,99.7 Z';

/**
 * 12 Chromatic Solfège Syllables in ascending semitone order relative to Do.
 * Canonical PPT naming: Fi (6) is the antipodal tritone axis, So (7) is the dominant.
 */
export const SOLFEGE_SYLLABLES = [
  'Do', 'Ra', 'Re', 'Me', 'Mi', 'Fa', 'Fi', 'So', 'Le', 'La', 'Te', 'Ti'
] as const;

export type SolfegeSyllable = typeof SOLFEGE_SYLLABLES[number];
export type GlyphType = 'base' | 'sharp' | 'flat';
export type GlyphRotation = 0 | 90 | 180 | 270;

export interface SolfegeSpec {
  canonicalSyllable: SolfegeSyllable;
  glyphType: GlyphType;
  rotation: GlyphRotation;
  colorHex: string;
  neonColorHex: string;
  semitone: number;
  nearestAddress: number; // -5..+6
}

export const SOLFEGE_SPECS: Record<string, SolfegeSpec> = {
  Do: { canonicalSyllable: 'Do', glyphType: 'base', rotation: 0, colorHex: '#E13610', neonColorHex: '#FF4D4D', semitone: 0, nearestAddress: 0 },
  Ra: { canonicalSyllable: 'Ra', glyphType: 'sharp', rotation: 0, colorHex: '#F98016', neonColorHex: '#FB923C', semitone: 1, nearestAddress: 1 },
  Di: { canonicalSyllable: 'Ra', glyphType: 'sharp', rotation: 0, colorHex: '#F98016', neonColorHex: '#FB923C', semitone: 1, nearestAddress: 1 },
  Re: { canonicalSyllable: 'Re', glyphType: 'flat', rotation: 90, colorHex: '#F98016', neonColorHex: '#FB923C', semitone: 2, nearestAddress: 2 },
  Me: { canonicalSyllable: 'Me', glyphType: 'base', rotation: 90, colorHex: '#F5D432', neonColorHex: '#FDE047', semitone: 3, nearestAddress: 3 },
  Ri: { canonicalSyllable: 'Me', glyphType: 'base', rotation: 90, colorHex: '#F5D432', neonColorHex: '#FDE047', semitone: 3, nearestAddress: 3 },
  Mi: { canonicalSyllable: 'Mi', glyphType: 'sharp', rotation: 90, colorHex: '#F5D432', neonColorHex: '#FDE047', semitone: 4, nearestAddress: 4 },
  Fa: { canonicalSyllable: 'Fa', glyphType: 'flat', rotation: 180, colorHex: '#43A440', neonColorHex: '#4ADE80', semitone: 5, nearestAddress: 5 },
  Fi: { canonicalSyllable: 'Fi', glyphType: 'base', rotation: 180, colorHex: '#141414', neonColorHex: '#38BDF8', semitone: 6, nearestAddress: 6 },
  Se: { canonicalSyllable: 'Fi', glyphType: 'base', rotation: 180, colorHex: '#141414', neonColorHex: '#38BDF8', semitone: 6, nearestAddress: 6 },
  So: { canonicalSyllable: 'So', glyphType: 'sharp', rotation: 180, colorHex: '#0032A4', neonColorHex: '#60A5FA', semitone: 7, nearestAddress: -5 },
  Sol: { canonicalSyllable: 'So', glyphType: 'sharp', rotation: 180, colorHex: '#0032A4', neonColorHex: '#60A5FA', semitone: 7, nearestAddress: -5 },
  Le: { canonicalSyllable: 'Le', glyphType: 'flat', rotation: 270, colorHex: '#5300A4', neonColorHex: '#C084FC', semitone: 8, nearestAddress: -4 },
  La: { canonicalSyllable: 'La', glyphType: 'base', rotation: 270, colorHex: '#5300A4', neonColorHex: '#C084FC', semitone: 9, nearestAddress: -3 },
  Te: { canonicalSyllable: 'Te', glyphType: 'sharp', rotation: 270, colorHex: '#F158A4', neonColorHex: '#F472B6', semitone: 10, nearestAddress: -2 },
  Ti: { canonicalSyllable: 'Ti', glyphType: 'flat', rotation: 0, colorHex: '#F158A4', neonColorHex: '#F472B6', semitone: 11, nearestAddress: -1 },
};

export const SOLFEGE_COLORS: Record<number, string> = {
  0: '#E13610',  // Do (Unison - 136.10Hz Earth resonance)
  1: '#F98016',  // Ra (Minor 2nd - 16:15 / 9:8)
  2: '#F98016',  // Re (Major 2nd - 9:8)
  3: '#F5D432',  // Me (Minor 3rd - 6:5 / 5:4)
  4: '#F5D432',  // Mi (Major 3rd - 5:4)
  5: '#43A440',  // Fa (Perfect 4th - 4:3)
  6: '#141414',  // Fi (Tritone - 1.414 = sqrt(2))
  7: '#0032A4',  // So (Perfect 5th - 3:2)
  8: '#5300A4',  // Le (Minor 6th - 8:5)
  9: '#5300A4',  // La (Major 6th - 5:3)
  10: '#F158A4', // Te (Minor 7th - 16:9 / 9:5)
  11: '#F158A4', // Ti (Major 7th - 15:8)
};

export const SOLFEGE_NEON_COLORS: Record<number, string> = {
  0: '#FF4D4D',
  1: '#FB923C',
  2: '#FB923C',
  3: '#FDE047',
  4: '#FDE047',
  5: '#4ADE80',
  6: '#38BDF8',
  7: '#60A5FA',
  8: '#C084FC',
  9: '#C084FC',
  10: '#F472B6',
  11: '#F472B6',
};

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) || 0;
  const g = parseInt(clean.slice(2, 4), 16) || 0;
  const b = parseInt(clean.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Returns the canonical movable-Do Solfège colour for a pitch class relative to a tonic.
 * When `neonFi` is true, Fi (semitone 6) resolves to `#38BDF8` for legibility on dark surfaces.
 */
export function getSolfegeColor(
  pitchClass: number,
  tonicPitchClass: number,
  opts?: { neonFi?: boolean }
): string {
  const rel = ((pitchClass - tonicPitchClass) % 12 + 12) % 12;
  if (rel === 6 && opts?.neonFi) {
    return SOLFEGE_NEON_COLORS[6];
  }
  return SOLFEGE_COLORS[rel];
}

/**
 * Returns a high-contrast text colour (`#0b0d13` or `#ffffff`) for labels rendered
 * inside a Solfège-coloured badge, key, or notehead.
 */
export function getSolfegeContrastText(
  semitoneFromTonic: number,
  opts?: { neonFi?: boolean }
): string {
  const rel = ((semitoneFromTonic % 12) + 12) % 12;
  if (rel === 3 || rel === 4 || (rel === 6 && opts?.neonFi)) {
    return '#0b0d13';
  }
  return '#ffffff';
}

/**
 * Tri Pitch-Class Notation (Prime Period Theory):
 * Assigns each of the five chromatic accidentals a single, unambiguous name derived from
 * its tritone relationship (6 semitones) to a diatonic natural note.
 * B and F are excluded from having a Tri prefix as they are already both natural notes.
 */
export const TRI_PITCH_CLASSES = [
  'C',     // 0
  '△G',    // 1: C♯/D♭ -> tritone of G
  'D',     // 2
  '△A',    // 3: D♯/E♭ -> tritone of A
  'E',     // 4
  'F',     // 5: Natural note (B-F is natural tritone pair)
  '△C',    // 6: F♯/G♭ -> tritone of C
  'G',     // 7
  '△D',    // 8: G♯/A♭ -> tritone of D
  'A',     // 9
  '△E',    // 10: A♯/B♭ -> tritone of E
  'B',     // 11: Natural note
] as const;

export const TRI_PITCH_CLASSES_SPOKEN = [
  'C', 'Tri-G', 'D', 'Tri-A', 'E', 'F', 'Tri-C', 'G', 'Tri-D', 'A', 'Tri-E', 'B'
] as const;

export const TRI_PITCH_CLASSES_SHORT = [
  'C', 'tG', 'D', 'tA', 'E', 'F', 'tC', 'G', 'tD', 'A', 'tE', 'B'
] as const;

export function getTriPitchClass(pitchClass: number, format: 'symbol' | 'spoken' | 'short' = 'symbol'): string {
  const pc = ((pitchClass % 12) + 12) % 12;
  if (format === 'spoken') return TRI_PITCH_CLASSES_SPOKEN[pc];
  if (format === 'short') return TRI_PITCH_CLASSES_SHORT[pc];
  return TRI_PITCH_CLASSES[pc];
}

// ─── PPT Geometric Notehead Taxonomy ─────────────────────────────────────
export type PptNoteheadShape =
  | 'circle'
  | 'diamond'
  | 'square'
  | 'triangle-down'
  | 'triangle-up'
  | 'semicircle-left'
  | 'cross'
  | 'semicircle-right';

export interface PptNoteheadSpec {
  semitone: number; // 0..11 relative to Do
  syllable: SolfegeSyllable;
  shape: PptNoteheadShape;
  colorHex: string;
  neonColorHex: string;
}

export const PPT_NOTEHEAD_SPECS: PptNoteheadSpec[] = [
  { semitone: 0, syllable: 'Do', shape: 'circle', colorHex: '#E13610', neonColorHex: '#FF4D4D' },
  { semitone: 1, syllable: 'Ra', shape: 'diamond', colorHex: '#F98016', neonColorHex: '#FB923C' },
  { semitone: 2, syllable: 'Re', shape: 'square', colorHex: '#F98016', neonColorHex: '#FB923C' },
  { semitone: 3, syllable: 'Me', shape: 'triangle-down', colorHex: '#F5D432', neonColorHex: '#FDE047' },
  { semitone: 4, syllable: 'Mi', shape: 'triangle-up', colorHex: '#F5D432', neonColorHex: '#FDE047' },
  { semitone: 5, syllable: 'Fa', shape: 'semicircle-left', colorHex: '#43A440', neonColorHex: '#4ADE80' },
  { semitone: 6, syllable: 'Fi', shape: 'cross', colorHex: '#141414', neonColorHex: '#38BDF8' },
  { semitone: 7, syllable: 'So', shape: 'semicircle-right', colorHex: '#0032A4', neonColorHex: '#60A5FA' },
  { semitone: 8, syllable: 'Le', shape: 'triangle-down', colorHex: '#5300A4', neonColorHex: '#C084FC' },
  { semitone: 9, syllable: 'La', shape: 'triangle-up', colorHex: '#5300A4', neonColorHex: '#C084FC' },
  { semitone: 10, syllable: 'Te', shape: 'diamond', colorHex: '#F158A4', neonColorHex: '#F472B6' },
  { semitone: 11, syllable: 'Ti', shape: 'square', colorHex: '#F158A4', neonColorHex: '#F472B6' },
];

export function getPptNoteheadSpec(semitoneFromTonic: number): PptNoteheadSpec {
  const norm = ((semitoneFromTonic % 12) + 12) % 12;
  return PPT_NOTEHEAD_SPECS[norm];
}

export function isBlackPianoKey(midiOrPitchClass: number): boolean {
  const pc = ((midiOrPitchClass % 12) + 12) % 12;
  return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
}

const LETTER_TO_INDEX: Record<string, number> = {
  C: 0,
  D: 1,
  E: 2,
  F: 3,
  G: 4,
  A: 5,
  B: 6,
};

/**
 * Maps chromatic semitone offsets (0..11) from tonic Do to diatonic staff degree offsets (0..6).
 * Paired chromatic alterations share the same diatonic line/space as their diatonic partner:
 * Do=0, Ra/Re=1, Me/Mi=2, Fa/Fi=3, So=4, Le/La=5, Te/Ti=6.
 */
export const PPT_SEMITONE_TO_DIATONIC_OFFSET = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6] as const;

/**
 * Resolves a MIDI pitch to its diatonic staff position (`0 = C4`) under PPT Notehead convention:
 * non-diatonic shapes sit on the same staff line/space as their paired diatonic scale degree
 * relative to `tonicKey` (with `Fi` placed on degree 5 / offset 4 in Locrian).
 */
export function midiToPptDiatonicPos(
  midi: number,
  tonicKey: string,
  scaleType?: string
): number {
  const tonicLetter = tonicKey.charAt(0).toUpperCase();
  const tonicLetterIdx = LETTER_TO_INDEX[tonicLetter] ?? 0;
  const tonicChroma = Note.chroma(tonicKey) ?? 0;
  const tonicMidi4 = 60 + tonicChroma;
  const diff = midi - tonicMidi4;
  const octaveFromTonic4 = Math.floor(diff / 12);
  const semitone = ((diff % 12) + 12) % 12;
  const degreeOffset =
    semitone === 6 && scaleType === "locrian"
      ? 4
      : PPT_SEMITONE_TO_DIATONIC_OFFSET[semitone];

  return tonicLetterIdx + octaveFromTonic4 * 7 + degreeOffset;
}

// ─── Piano Keyboard Range Presets (matching PPT Visualiser) ──────────────
export interface PianoRangePreset {
  id: string;
  name: string;
  shortName: string;
  keys: number;
  startMidi: number;
  endMidi: number;
  rangeLabel: string;
}

export const PIANO_RANGE_PRESETS: PianoRangePreset[] = [
  { id: '25-key', name: '25 Keys (C3–C5)', shortName: '25k', keys: 25, startMidi: 48, endMidi: 72, rangeLabel: 'C3–C5' },
  { id: '37-key', name: '37 Keys (C3–C6)', shortName: '37k', keys: 37, startMidi: 48, endMidi: 84, rangeLabel: 'C3–C6' },
  { id: '49-key', name: '49 Keys (C2–C6)', shortName: '49k', keys: 49, startMidi: 36, endMidi: 84, rangeLabel: 'C2–C6' },
  { id: '61-key', name: '61 Keys (C2–C7)', shortName: '61k', keys: 61, startMidi: 36, endMidi: 96, rangeLabel: 'C2–C7' },
  { id: '76-key', name: '76 Keys (E1–G7)', shortName: '76k', keys: 76, startMidi: 28, endMidi: 103, rangeLabel: 'E1–G7' },
  { id: '88-key', name: '88 Keys (A0–C8)', shortName: '88k', keys: 88, startMidi: 21, endMidi: 108, rangeLabel: 'A0–C8' },
];

// ─── Piano Triangle Notation (D / L / U / R) ─────────────────────────────
export type PianoTriangleType = 'D' | 'L' | 'U' | 'R';
export type PianoTrianglePoint = 1 | 2 | 3;

export interface PianoTriangleInfo {
  triangle: PianoTriangleType;
  point: PianoTrianglePoint;
}

export const PITCH_CLASS_TO_PIANO_TRIANGLE: Record<number, PianoTriangleInfo> = {
  0: { triangle: 'R', point: 3 },  // C
  1: { triangle: 'D', point: 1 },  // C#
  2: { triangle: 'D', point: 2 },  // D
  3: { triangle: 'D', point: 3 },  // D#
  4: { triangle: 'L', point: 1 },  // E
  5: { triangle: 'L', point: 2 },  // F
  6: { triangle: 'L', point: 3 },  // F#
  7: { triangle: 'U', point: 1 },  // G
  8: { triangle: 'U', point: 2 },  // G#
  9: { triangle: 'U', point: 3 },  // A
  10: { triangle: 'R', point: 1 }, // A# / Bb
  11: { triangle: 'R', point: 2 }, // B
};

export const PIANO_TRIANGLE_POINT_TO_PITCH_CLASS: Record<PianoTriangleType, Record<PianoTrianglePoint, number>> = {
  D: { 1: 1, 2: 2, 3: 3 },
  L: { 1: 4, 2: 5, 3: 6 },
  U: { 1: 7, 2: 8, 3: 9 },
  R: { 1: 10, 2: 11, 3: 0 },
};

export const TRIANGLE_VERTEX_COORDINATES: Record<PianoTriangleType, {
  path: string;
  points: Record<PianoTrianglePoint, { x: number; y: number }>;
}> = {
  D: {
    path: 'M 15 20 L 85 20 L 50 85 Z',
    points: {
      1: { x: 15, y: 20 },
      2: { x: 50, y: 85 },
      3: { x: 85, y: 20 },
    },
  },
  L: {
    path: 'M 15 80 L 85 80 L 85 20 Z',
    points: {
      1: { x: 15, y: 80 },
      2: { x: 85, y: 80 },
      3: { x: 85, y: 20 },
    },
  },
  U: {
    path: 'M 15 80 L 50 15 L 85 80 Z',
    points: {
      1: { x: 15, y: 80 },
      2: { x: 50, y: 15 },
      3: { x: 85, y: 80 },
    },
  },
  R: {
    path: 'M 15 20 L 15 80 L 85 80 Z',
    points: {
      1: { x: 15, y: 20 },
      2: { x: 15, y: 80 },
      3: { x: 85, y: 80 },
    },
  },
};

export interface ScaleVertexInfo {
  degree: number;
  semitonesFromDo: number;
  pc: number;
  syllable: SolfegeSyllable;
  color: string;
  neonColor: string;
  isDo: boolean;
}

export interface PianoTriangleScaleSegment {
  triangle: PianoTriangleType;
  points: PianoTrianglePoint[];
  scaleVertices: Map<PianoTrianglePoint, ScaleVertexInfo>;
  hasDo: boolean;
  doPoint?: PianoTrianglePoint;
}

/**
 * Port of PPT Engraver's Tetrachord Chaining Algorithm:
 * Chains scale degrees around the tonic ([5, 6, 7] -> [1 (Do)] -> [2, 3, 4] for 7-note scales),
 * merging adjacent degrees that share the same piano triangle into 4–5 chained segments.
 */
export function getScaleTetrachordChainTriangles(
  tonicPc: number,
  intervals: number[] = [0, 2, 4, 5, 7, 9, 11]
): PianoTriangleScaleSegment[] {
  const safeIntervals = intervals.length > 0 ? intervals : [0, 2, 4, 5, 7, 9, 11];
  const normTonic = ((tonicPc % 12) + 12) % 12;
  const len = safeIntervals.length;
  const splitIdx = Math.ceil(len / 2);

  const chainDegreeIndices: number[] = [];
  for (let i = splitIdx; i < len; i++) chainDegreeIndices.push(i);
  chainDegreeIndices.push(0);
  for (let i = 1; i < splitIdx; i++) chainDegreeIndices.push(i);

  const chainNotes = chainDegreeIndices.map((idx) => {
    const semitonesFromDo = ((safeIntervals[idx] % 12) + 12) % 12;
    const pc = (normTonic + semitonesFromDo) % 12;
    const syllable = SOLFEGE_SYLLABLES[semitonesFromDo];
    const spec = SOLFEGE_SPECS[syllable];
    const pt = PITCH_CLASS_TO_PIANO_TRIANGLE[pc];
    const isDo = idx === 0;

    return {
      degree: idx + 1,
      semitonesFromDo,
      pc,
      syllable,
      color: spec ? spec.colorHex : '#E13610',
      neonColor: spec ? spec.neonColorHex : '#FF4D4D',
      triangle: pt.triangle,
      point: pt.point,
      isDo,
    };
  });

  const segments: PianoTriangleScaleSegment[] = [];
  let currentSegment: PianoTriangleScaleSegment | null = null;

  for (const note of chainNotes) {
    if (!currentSegment || currentSegment.triangle !== note.triangle) {
      currentSegment = {
        triangle: note.triangle,
        points: [note.point],
        scaleVertices: new Map([[note.point, note]]),
        hasDo: note.isDo,
        doPoint: note.isDo ? note.point : undefined,
      };
      segments.push(currentSegment);
    } else {
      if (!currentSegment.points.includes(note.point)) {
        currentSegment.points.push(note.point);
      }
      currentSegment.scaleVertices.set(note.point, note);
      if (note.isDo) {
        currentSegment.hasDo = true;
        currentSegment.doPoint = note.point;
      }
    }
  }

  return segments;
}

export const PIANO_TRIANGLE_META: Record<PianoTriangleType, { name: string; color: string; pitches: string }> = {
  D: { name: 'Down (D)', color: '#EF4444', pitches: 'C♯ · D · D♯' },
  L: { name: 'Left (L)', color: '#F59E0B', pitches: 'E · F · F♯' },
  U: { name: 'Up (U)', color: '#10B981', pitches: 'G · G♯ · A' },
  R: { name: 'Right (R)', color: '#8B5CF6', pitches: 'A♯ · B · C' },
};

/**
 * Encodes an ascending list of MIDI notes or pitch classes into a Piano Triangle string
 * following the OKF specification (e.g. Dmaj7 [D, F#, A, C#] -> "D2L3U3D1", Cmaj [C, E, G] -> "R3L1U1").
 * Adjacent notes falling within the same triangle in the same 3-semitone cluster merge their digits (e.g. C#+D -> "D12").
 */
export function encodePianoTriangles(midiOrOrderedPcs: number[]): string {
  if (midiOrOrderedPcs.length === 0) return '';
  const segments: { triangle: PianoTriangleType; points: PianoTrianglePoint[]; clusterBase: number }[] = [];

  for (const val of midiOrOrderedPcs) {
    const pc = ((val % 12) + 12) % 12;
    const info = PITCH_CLASS_TO_PIANO_TRIANGLE[pc];
    const clusterBase = Math.floor((val - 1) / 3);
    const prev = segments[segments.length - 1];
    if (prev && prev.triangle === info.triangle && prev.clusterBase === clusterBase) {
      if (!prev.points.includes(info.point)) {
        prev.points.push(info.point);
        prev.points.sort((a, b) => a - b);
      }
    } else {
      segments.push({ triangle: info.triangle, points: [info.point], clusterBase });
    }
  }

  return segments.map(s => `${s.triangle}${s.points.join('')}`).join('');
}

// ─── Prime Family & Just Intonation Ratio Metadata ────────────────────────
export type PrimeLimitFamily = '2-Du' | '3-Tri' | '5-Qui' | '7-Sep' | '11-Undec';

export interface JustIntervalSpec {
  semitones: number;
  num: number;
  den: number;
  ratioLabel: string;
  primeLimit: 2 | 3 | 5 | 7 | 11;
  primeFamily: PrimeLimitFamily;
  primeColor: string;
  justCents: number;
  edoErrorCents: number; // 12-TET cents minus JI cents
}

export const PRIME_FAMILY_COLORS: Record<PrimeLimitFamily, string> = {
  '2-Du': '#6b7280',    // 2-Prime (Octave / Unison)
  '3-Tri': '#3b82f6',   // 3-Prime (Fifths / Fourths)
  '5-Qui': '#22c55e',   // 5-Prime (Major/Minor Thirds & Sixths)
  '7-Sep': '#f59e0b',   // 7-Prime (Septimal tritone / minor 7th)
  '11-Undec': '#a855f7' // 11-Prime
};

export const JUST_INTERVAL_SPECS: Record<number, JustIntervalSpec> = {
  0:  { semitones: 0,  num: 1,  den: 1,  ratioLabel: '1:1',   primeLimit: 2, primeFamily: '2-Du',  primeColor: PRIME_FAMILY_COLORS['2-Du'],  justCents: 0,      edoErrorCents: 0 },
  1:  { semitones: 1,  num: 16, den: 15, ratioLabel: '16:15', primeLimit: 5, primeFamily: '5-Qui', primeColor: PRIME_FAMILY_COLORS['5-Qui'], justCents: 111.73, edoErrorCents: -11.73 },
  2:  { semitones: 2,  num: 9,  den: 8,  ratioLabel: '9:8',   primeLimit: 3, primeFamily: '3-Tri', primeColor: PRIME_FAMILY_COLORS['3-Tri'], justCents: 203.91, edoErrorCents: -3.91 },
  3:  { semitones: 3,  num: 6,  den: 5,  ratioLabel: '6:5',   primeLimit: 5, primeFamily: '5-Qui', primeColor: PRIME_FAMILY_COLORS['5-Qui'], justCents: 315.64, edoErrorCents: -15.64 },
  4:  { semitones: 4,  num: 5,  den: 4,  ratioLabel: '5:4',   primeLimit: 5, primeFamily: '5-Qui', primeColor: PRIME_FAMILY_COLORS['5-Qui'], justCents: 386.31, edoErrorCents: +13.69 },
  5:  { semitones: 5,  num: 4,  den: 3,  ratioLabel: '4:3',   primeLimit: 3, primeFamily: '3-Tri', primeColor: PRIME_FAMILY_COLORS['3-Tri'], justCents: 498.04, edoErrorCents: +1.96 },
  6:  { semitones: 6,  num: 7,  den: 5,  ratioLabel: '7:5',   primeLimit: 7, primeFamily: '7-Sep', primeColor: PRIME_FAMILY_COLORS['7-Sep'], justCents: 582.51, edoErrorCents: +17.49 },
  7:  { semitones: 7,  num: 3,  den: 2,  ratioLabel: '3:2',   primeLimit: 3, primeFamily: '3-Tri', primeColor: PRIME_FAMILY_COLORS['3-Tri'], justCents: 701.96, edoErrorCents: -1.96 },
  8:  { semitones: 8,  num: 8,  den: 5,  ratioLabel: '8:5',   primeLimit: 5, primeFamily: '5-Qui', primeColor: PRIME_FAMILY_COLORS['5-Qui'], justCents: 813.69, edoErrorCents: -13.69 },
  9:  { semitones: 9,  num: 5,  den: 3,  ratioLabel: '5:3',   primeLimit: 5, primeFamily: '5-Qui', primeColor: PRIME_FAMILY_COLORS['5-Qui'], justCents: 884.36, edoErrorCents: +15.64 },
  10: { semitones: 10, num: 9,  den: 5,  ratioLabel: '9:5',   primeLimit: 5, primeFamily: '5-Qui', primeColor: PRIME_FAMILY_COLORS['5-Qui'], justCents: 1017.60, edoErrorCents: -17.60 },
  11: { semitones: 11, num: 15, den: 8,  ratioLabel: '15:8',  primeLimit: 5, primeFamily: '5-Qui', primeColor: PRIME_FAMILY_COLORS['5-Qui'], justCents: 1088.27, edoErrorCents: +11.73 },
};

export function getJustIntervalSpec(semitones: number): JustIntervalSpec {
  const s = ((semitones % 12) + 12) % 12;
  return JUST_INTERVAL_SPECS[s];
}

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return Math.abs(Math.round(a * b)) / gcd(a, b);
}

/**
 * Calculates the Coincidence Super-Cycle (number of Root turns required for all chord tones
 * to simultaneously realign at 12 o'clock Do) and the reduced integer harmonic ratio string (e.g. "4:5:6").
 */
export function calculateChordCoincidence(intervals: number[]): {
  rootTurnsToAlign: number;
  integerRatioString: string;
  primeLimit: 2 | 3 | 5 | 7 | 11;
  tenneyHeight: number;
} {
  if (intervals.length === 0) {
    return { rootTurnsToAlign: 1, integerRatioString: '1', primeLimit: 2, tenneyHeight: 0 };
  }

  const rationalNotes = intervals.map(semitones => {
    const octaves = Math.floor(semitones / 12);
    const rem = ((semitones % 12) + 12) % 12;
    const spec = JUST_INTERVAL_SPECS[rem];
    let num = spec.num;
    let den = spec.den;
    if (octaves > 0) num *= Math.pow(2, octaves);
    else if (octaves < 0) den *= Math.pow(2, -octaves);
    const g = gcd(num, den);
    return { num: num / g, den: den / g, primeLimit: spec.primeLimit };
  });

  let commonDen = 1;
  let maxLimit: 2 | 3 | 5 | 7 | 11 = 2;
  for (const r of rationalNotes) {
    commonDen = lcm(commonDen, r.den);
    if (r.primeLimit > maxLimit) maxLimit = r.primeLimit;
  }

  const scaledInts = rationalNotes.map(r => Math.round((r.num * commonDen) / r.den));
  let commonGcd = scaledInts[0] || 1;
  for (let i = 1; i < scaledInts.length; i++) {
    commonGcd = gcd(commonGcd, scaledInts[i]);
  }
  const reducedInts = scaledInts.map(v => v / commonGcd);

  const tenneySum = rationalNotes.reduce((sum, r) => sum + Math.log2(r.num * r.den), 0);
  const tenneyHeight = Math.round((tenneySum / rationalNotes.length) * 100) / 100;

  return {
    rootTurnsToAlign: commonDen,
    integerRatioString: reducedInts.join(':'),
    primeLimit: maxLimit,
    tenneyHeight,
  };
}
