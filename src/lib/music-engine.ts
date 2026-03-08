// Music theory utilities and shared state types
import { Note, Scale, Interval } from "tonal";

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
export type NoteName = typeof NOTE_NAMES[number];

export const NOTE_COLOR_KEYS: Record<string, string> = {
  "C": "var(--note-c)",
  "C#": "var(--note-cs)", "Db": "var(--note-cs)",
  "D": "var(--note-d)",
  "D#": "var(--note-ds)", "Eb": "var(--note-ds)",
  "E": "var(--note-e)",
  "F": "var(--note-f)",
  "F#": "var(--note-fs)", "Gb": "var(--note-fs)",
  "G": "var(--note-g)",
  "G#": "var(--note-gs)", "Ab": "var(--note-gs)",
  "A": "var(--note-a)",
  "A#": "var(--note-as)", "Bb": "var(--note-as)",
  "B": "var(--note-b)",
};

export function getNoteColor(noteName: string): string {
  const pc = Note.pitchClass(noteName) || noteName;
  const enharmonic = Note.enharmonic(pc) || pc;
  return `hsl(${NOTE_COLOR_KEYS[pc] || NOTE_COLOR_KEYS[enharmonic] || "var(--note-c)"})`;
}

export function getNoteChroma(noteName: string): number {
  return Note.chroma(noteName) ?? 0;
}

export function getScaleNotes(root: string, scaleType: string): string[] {
  const scale = Scale.get(`${root} ${scaleType}`);
  return scale.notes;
}

export function isNoteInScale(noteName: string, scaleNotes: string[]): boolean {
  const chroma = getNoteChroma(noteName);
  return scaleNotes.some(sn => getNoteChroma(sn) === chroma);
}

// Standard guitar tuning (low to high): E2, A2, D3, G3, B3, E4
export const STANDARD_TUNING = ["E2", "A2", "D3", "G3", "B3", "E4"];
export const TOTAL_FRETS = 22;

export function getFretNote(openString: string, fret: number): string {
  const midi = Note.midi(openString);
  if (midi === null) return "";
  return Note.fromMidi(midi + fret);
}

export function getAllFretboardPositions(noteName: string, tuning: string[] = STANDARD_TUNING): { string: number; fret: number }[] {
  const targetChroma = getNoteChroma(noteName);
  const positions: { string: number; fret: number }[] = [];
  
  tuning.forEach((openNote, stringIdx) => {
    for (let fret = 0; fret <= TOTAL_FRETS; fret++) {
      const fretNote = getFretNote(openNote, fret);
      if (getNoteChroma(fretNote) === targetChroma) {
        positions.push({ string: stringIdx, fret });
      }
    }
  });
  
  return positions;
}

// Piano range: A0 to C8 (88 keys)
export const PIANO_START_MIDI = 21; // A0
export const PIANO_END_MIDI = 108; // C8
export const PIANO_KEYS: { note: string; midi: number; isBlack: boolean }[] = [];

for (let midi = PIANO_START_MIDI; midi <= PIANO_END_MIDI; midi++) {
  const note = Note.fromMidi(midi);
  const pc = Note.pitchClass(note);
  const isBlack = pc.includes("#") || pc.includes("b");
  PIANO_KEYS.push({ note, midi, isBlack });
}

export interface ScalePreset {
  name: string;
  type: string;
  category: "diatonic" | "pentatonic" | "blues";
}

export const SCALE_PRESETS: ScalePreset[] = [
  { name: "Major (Ionian)", type: "major", category: "diatonic" },
  { name: "Natural Minor (Aeolian)", type: "minor", category: "diatonic" },
  { name: "Major Pentatonic", type: "major pentatonic", category: "pentatonic" },
  { name: "Minor Pentatonic", type: "minor pentatonic", category: "pentatonic" },
  { name: "Blues", type: "blues", category: "blues" },
];

export interface DexterityPreset {
  name: string;
  pattern: number[];
  description: string;
}

export const DEXTERITY_PRESETS: DexterityPreset[] = [
  { name: "Standard 1-2-3-4", pattern: [1, 2, 3, 4], description: "Linear chromatic movement" },
  { name: "Alternate 1-3-2-4", pattern: [1, 3, 2, 4], description: "Independent finger control" },
  { name: "Stretch 1-4-2-3", pattern: [1, 4, 2, 3], description: "Reach and flexibility" },
];
