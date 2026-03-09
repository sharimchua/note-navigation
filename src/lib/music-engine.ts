// Music theory utilities and shared state types
import { Note, Scale } from "tonal";

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
export const NOTE_NAMES_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const;
// Circle-of-fifths idiomatic key names (enharmonic choices matching standard usage)
export const KEY_NAMES_COF = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"] as const;
export type NoteName = typeof NOTE_NAMES[number];

export function getNotePitchClass(noteName: string, useFlats: boolean): string {
  const midi = Note.midi(noteName);
  if (midi === null) return Note.pitchClass(noteName) || noteName;
  const pc = midi % 12;
  return useFlats ? NOTE_NAMES_FLAT[pc] : NOTE_NAMES[pc];
}

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

// Guitar tunings

export const TOTAL_FRETS = 22;

export interface GuitarTuning {
  name: string;
  notes: string[];
  category: "standard" | "drop" | "open" | "alternate";
}

export const GUITAR_TUNINGS: GuitarTuning[] = [
  // Standard tunings
  { name: "Standard", notes: ["E2", "A2", "D3", "G3", "B3", "E4"], category: "standard" },
  { name: "Half Step Down", notes: ["Eb2", "Ab2", "Db3", "Gb3", "Bb3", "Eb4"], category: "standard" },
  { name: "Whole Step Down", notes: ["D2", "G2", "C3", "F3", "A3", "D4"], category: "standard" },
  
  // Drop tunings
  { name: "Drop D", notes: ["D2", "A2", "D3", "G3", "B3", "E4"], category: "drop" },
  { name: "Drop C", notes: ["C2", "G2", "C3", "F3", "A3", "D4"], category: "drop" },
  { name: "Drop B", notes: ["B1", "Gb2", "B2", "E3", "Ab3", "Db4"], category: "drop" },
  { name: "Double Drop D", notes: ["D2", "A2", "D3", "G3", "B3", "D4"], category: "drop" },
  
  // Open tunings
  { name: "Open G", notes: ["D2", "G2", "D3", "G3", "B3", "D4"], category: "open" },
  { name: "Open D", notes: ["D2", "A2", "D3", "Gb3", "A3", "D4"], category: "open" },
  { name: "Open E", notes: ["E2", "B2", "E3", "Ab3", "B3", "E4"], category: "open" },
  { name: "Open A", notes: ["E2", "A2", "E3", "A3", "Db4", "E4"], category: "open" },
  { name: "Open C", notes: ["C2", "G2", "C3", "G3", "C4", "E4"], category: "open" },
  
  // Alternate tunings
  { name: "DADGAD", notes: ["D2", "A2", "D3", "G3", "A3", "D4"], category: "alternate" },
  { name: "All Fourths", notes: ["E2", "A2", "D3", "G3", "C4", "F4"], category: "alternate" },
  { name: "NST (New Standard)", notes: ["C2", "G2", "D3", "A3", "E4", "G4"], category: "alternate" },
];

export function getFretNote(openString: string, fret: number): string {
  const midi = Note.midi(openString);
  if (midi === null) return "";
  return Note.fromMidi(midi + fret);
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

// Get 5 scale-degree MIDI notes for a hand position.
// finger1Note is where finger 1 (thumb) sits.
// For right hand: finger 1 is the lowest, picks 5 ascending scale notes from finger1Note.
// For left hand: finger 1 is the highest, picks 5 descending scale notes from finger1Note.
export function getHandMidis(
  finger1Note: string,
  scaleNotes: string[],
  hand: "left" | "right"
): number[] {
  const finger1Midi = Note.midi(finger1Note);
  if (finger1Midi === null || scaleNotes.length === 0) return [];

  // Build a set of scale chromas for matching
  const scaleChromas = new Set(scaleNotes.map(n => Note.chroma(n)).filter((c): c is number => c !== undefined));

  if (hand === "right") {
    // Ascending from finger1: find 5 scale tones starting at finger1Midi
    const result: number[] = [];
    for (let midi = finger1Midi; midi <= 108 && result.length < 5; midi++) {
      if (scaleChromas.has(midi % 12)) {
        result.push(midi);
      }
    }
    return result;
  } else {
    // Left hand: descending from finger1 — finger 1 is highest, finger 5 is lowest
    const result: number[] = [];
    for (let midi = finger1Midi; midi >= 21 && result.length < 5; midi--) {
      if (scaleChromas.has(midi % 12)) {
        result.push(midi);
      }
    }
    // Reverse so result is low-to-high (finger5 to finger1)
    return result.reverse();
  }
}

// Scale degree utility: returns 1-based degree (1-7) or null if not in scale
export function getScaleDegree(noteName: string, scaleNotes: string[]): number | null {
  const chroma = getNoteChroma(noteName);
  for (let i = 0; i < scaleNotes.length; i++) {
    if (getNoteChroma(scaleNotes[i]) === chroma) {
      return i + 1;
    }
  }
  return null;
}

export type ScaleLabelMode = "solfege" | "degree";
export const SOLFEGE_LABELS = ["Do", "Re", "Mi", "Fa", "Sol", "La", "Ti"] as const;

export function getScaleLabel(noteName: string, scaleNotes: string[], mode: ScaleLabelMode): string | null {
  const degree = getScaleDegree(noteName, scaleNotes);
  if (degree === null) return null;
  return mode === "solfege" ? SOLFEGE_LABELS[(degree - 1) % 7] : String(degree);
}
