export type StaffLayoutMode = "joined" | "split";
export type ClefChoice = "treble" | "bass";

export interface SplitStaffNoteInput {
  note: string;
  midi: number;
  seq: number;
}

export interface MelodyContext {
  midi: number;
  clef: ClefChoice;
}

function scoreAssignment(
  sorted: SplitStaffNoteInput[],
  clefs: ClefChoice[],
  prevClefByNote: ReadonlyMap<string, ClefChoice>
): number {
  const bassNotes: SplitStaffNoteInput[] = [];
  const trebleNotes: SplitStaffNoteInput[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (clefs[i] === "bass") bassNotes.push(sorted[i]);
    else trebleNotes.push(sorted[i]);
  }

  let score = 0;

  // Penalise unplayable single-hand spans (> 1 octave)
  if (bassNotes.length > 1) {
    const bassSpan = bassNotes[bassNotes.length - 1].midi - bassNotes[0].midi;
    if (bassSpan > 12) score -= 8 * (bassSpan - 12);
  }
  if (trebleNotes.length > 1) {
    const trebleSpan = trebleNotes[trebleNotes.length - 1].midi - trebleNotes[0].midi;
    if (trebleSpan > 12) score -= 8 * (trebleSpan - 12);
  }

  // Reward clean interval gap between left and right hands across the split boundary
  if (bassNotes.length > 0 && trebleNotes.length > 0) {
    const gap = trebleNotes[0].midi - bassNotes[bassNotes.length - 1].midi;
    score += 1.5 * gap;
  }

  // Penalise excessive ledger lines and apply mild register preference around Middle C (60)
  for (const b of bassNotes) {
    if (b.midi > 64) score -= 6 * (b.midi - 64);
    if (b.midi > 60) score -= 1.2 * (b.midi - 60);
  }
  for (const t of trebleNotes) {
    if (t.midi < 55) score -= 6 * (55 - t.midi);
    if (t.midi < 60) score -= 1.2 * (60 - t.midi);
  }

  // Continuity bonus for notes already placed on a clef
  for (let i = 0; i < sorted.length; i++) {
    if (prevClefByNote.get(sorted[i].note) === clefs[i]) {
      score += 2;
    }
  }

  return score;
}

/**
 * Assigns each active/fading note to either `"treble"` or `"bass"` in Split Grand Staff mode.
 * Prioritises two-hand playability when notes are spread, while keeping compact clusters
 * and close sequential melodic lines on adjacent ledger lines instead of jumping clefs.
 */
export function assignClefsForSplitStaff(
  notes: SplitStaffNoteInput[],
  prevClefByNote: ReadonlyMap<string, ClefChoice>,
  lastMelodyContext?: MelodyContext | null
): Map<string, ClefChoice> {
  const result = new Map<string, ClefChoice>();
  if (notes.length === 0) return result;

  if (notes.length === 1) {
    const n = notes[0];
    let clef: ClefChoice;
    if (n.midi <= 52) {
      clef = "bass";
    } else if (n.midi >= 67) {
      clef = "treble";
    } else {
      const prev = prevClefByNote.get(n.note);
      if (prev) {
        clef = prev;
      } else if (lastMelodyContext && Math.abs(n.midi - lastMelodyContext.midi) <= 7) {
        clef = lastMelodyContext.clef;
      } else {
        clef = n.midi >= 60 ? "treble" : "bass";
      }
    }
    result.set(n.note, clef);
    return result;
  }

  const sorted = [...notes].sort((a, b) => a.midi - b.midi || a.seq - b.seq);
  const k = sorted.length;
  const minMidi = sorted[0].midi;
  const maxMidi = sorted[k - 1].midi;
  const totalSpan = maxMidi - minMidi;

  // Compact cluster (<= 1 octave) that fits comfortably on 1–2 ledger lines of a single clef
  if (totalSpan <= 12) {
    const canAllTreble = minMidi >= 55; // G3 = 2 ledger lines below Treble E4
    const canAllBass = maxMidi <= 64;   // E4 = 2 ledger lines above Bass A3

    if (canAllTreble && canAllBass) {
      let chosen: ClefChoice | null = null;
      let prevTreble = 0;
      let prevBass = 0;
      for (const n of sorted) {
        const prev = prevClefByNote.get(n.note);
        if (prev === "treble") prevTreble++;
        else if (prev === "bass") prevBass++;
      }
      if (prevTreble > prevBass) chosen = "treble";
      else if (prevBass > prevTreble) chosen = "bass";
      else if (
        lastMelodyContext &&
        Math.abs((minMidi + maxMidi) / 2 - lastMelodyContext.midi) <= 7
      ) {
        chosen = lastMelodyContext.clef;
      } else {
        chosen = (minMidi + maxMidi) / 2 >= 60 ? "treble" : "bass";
      }
      for (const n of sorted) result.set(n.note, chosen);
      return result;
    }

    if (canAllTreble) {
      for (const n of sorted) result.set(n.note, "treble");
      return result;
    }

    if (canAllBass) {
      for (const n of sorted) result.set(n.note, "bass");
      return result;
    }
  }

  // Spread or cross-register voicing: evaluate every split index plus viable single-clef candidates
  const candidates: ClefChoice[][] = [];
  for (let splitIdx = 1; splitIdx < k; splitIdx++) {
    candidates.push(sorted.map((_, idx) => (idx < splitIdx ? "bass" : "treble")));
  }
  if (totalSpan <= 14) {
    if (minMidi >= 55) candidates.push(sorted.map(() => "treble"));
    if (maxMidi <= 64) candidates.push(sorted.map(() => "bass"));
  }

  let bestAssignment = candidates[0] ?? sorted.map((n) => (n.midi >= 60 ? "treble" : "bass"));
  let bestScore = -Infinity;

  for (const cand of candidates) {
    const s = scoreAssignment(sorted, cand, prevClefByNote);
    if (s > bestScore) {
      bestScore = s;
      bestAssignment = cand;
    }
  }

  for (let i = 0; i < k; i++) {
    result.set(sorted[i].note, bestAssignment[i]);
  }
  return result;
}
