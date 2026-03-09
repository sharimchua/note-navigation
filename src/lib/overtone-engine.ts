// Psychoacoustical dissonance engine (Plomp-Levelt / Sethares model)
// Ported from Harmonic Geometry, adapted for Note Navigation's active-note model

import { Note } from "tonal";

const NUM_PARTIALS = 7;
const AMPLITUDE_DECAY = 0.88;

export interface Partial {
  frequency: number;
  amplitude: number;
  partialNumber: number; // 1-based
  fundamentalPc: number; // 0-11
  fundamentalFreq: number;
}

export interface PartialInteraction {
  partial1: Partial;
  partial2: Partial;
  dissonance: number;
  freqDiff: number;
}

function generatePartials(fundamentalFreq: number, fundamentalPc: number): Partial[] {
  const partials: Partial[] = [];
  for (let i = 1; i <= NUM_PARTIALS; i++) {
    partials.push({
      frequency: fundamentalFreq * i,
      amplitude: Math.pow(AMPLITUDE_DECAY, i - 1),
      partialNumber: i,
      fundamentalPc,
      fundamentalFreq,
    });
  }
  return partials;
}

/** Plomp-Levelt dissonance between two pure tones */
function plompLeveltDissonance(f1: number, a1: number, f2: number, a2: number): number {
  const fmin = Math.min(f1, f2);
  const fmax = Math.max(f1, f2);
  const b = fmax - fmin;
  const s = 0.24 / (0.021 * fmin + 19);
  const sb = s * b;
  return a1 * a2 * (Math.exp(-3.5 * sb) - Math.exp(-5.75 * sb));
}

/** Build partials from a set of active note names (e.g. "C4", "E4", "G4") */
export function getPartialsFromNotes(
  noteNames: string[]
): { partials: Partial[]; noteFrequencies: { freq: number; pc: number }[] } {
  const noteFrequencies: { freq: number; pc: number }[] = [];

  for (const name of noteNames) {
    const midi = Note.midi(name);
    if (midi === null) continue;
    const freq = Note.freq(name);
    if (freq === null || freq === undefined) continue;
    const pc = midi % 12;
    noteFrequencies.push({ freq, pc });
  }

  const partials = noteFrequencies.flatMap(n => generatePartials(n.freq, n.pc));
  return { partials, noteFrequencies };
}

/** Calculate total psychoacoustical dissonance, normalised 0-100 */
export function calculateChordDissonance(frequencies: number[]): number {
  if (frequencies.length === 0) return 0;

  const rawDissonance = (freqs: number[]) => {
    let total = 0;
    const allPartials: { freq: number; amp: number }[] = [];
    for (const f of freqs) {
      for (let i = 1; i <= NUM_PARTIALS; i++) {
        allPartials.push({ freq: f * i, amp: Math.pow(AMPLITUDE_DECAY, i - 1) });
      }
    }
    for (let i = 0; i < allPartials.length; i++) {
      for (let j = i + 1; j < allPartials.length; j++) {
        total += plompLeveltDissonance(
          allPartials[i].freq, allPartials[i].amp,
          allPartials[j].freq, allPartials[j].amp
        );
      }
    }
    return total;
  };

  const actual = rawDissonance(frequencies);

  // Reference max: chromatic cluster from C3
  const fixedRefFreq = 130.81;
  const noteCount = Math.max(2, frequencies.length);
  const referenceFreqs: number[] = [];
  for (let i = 0; i < noteCount; i++) {
    referenceFreqs.push(fixedRefFreq * Math.pow(2, i / 12));
  }
  const referenceMax = rawDissonance(referenceFreqs);

  const normalised = referenceMax > 0 ? (actual / referenceMax) * 100 : 0;
  return Math.min(100, Math.max(0, normalised));
}

/** Find pairwise dissonance between partials from different notes */
export function calculatePartialInteractions(
  noteFrequencies: { freq: number; pc: number }[]
): PartialInteraction[] {
  const interactions: PartialInteraction[] = [];
  const notePartials = noteFrequencies.map(n => generatePartials(n.freq, n.pc));

  // Inter-note interactions
  for (let i = 0; i < notePartials.length; i++) {
    for (let j = i + 1; j < notePartials.length; j++) {
      for (const p1 of notePartials[i]) {
        for (const p2 of notePartials[j]) {
          const d = plompLeveltDissonance(p1.frequency, p1.amplitude, p2.frequency, p2.amplitude);
          if (d > 0.0001) {
            interactions.push({ partial1: p1, partial2: p2, dissonance: d * 100, freqDiff: Math.abs(p1.frequency - p2.frequency) });
          }
        }
      }
    }
  }

  // Intra-note interactions
  for (let i = 0; i < notePartials.length; i++) {
    const ps = notePartials[i];
    for (let a = 0; a < ps.length; a++) {
      for (let b = a + 1; b < ps.length; b++) {
        const d = plompLeveltDissonance(ps[a].frequency, ps[a].amplitude, ps[b].frequency, ps[b].amplitude);
        if (d > 0.0001) {
          interactions.push({ partial1: ps[a], partial2: ps[b], dissonance: d * 100, freqDiff: Math.abs(ps[a].frequency - ps[b].frequency) });
        }
      }
    }
  }

  return interactions;
}
