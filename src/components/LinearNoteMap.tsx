import { useHarmonic } from "@/contexts/HarmonicContext";
import { getNoteColor, NOTE_COLOR_KEYS, getNotePitchClass } from "@/lib/music-engine";
import { Note } from "tonal";

// C3 (midi 48) to C5 (midi 72) = 25 semitones, centered on C4 (midi 60)
const CENTER_MIDI = 60; // C4
const LOW_MIDI = 48;    // C3
const HIGH_MIDI = 72;   // C5

export function LinearNoteMap() {
  const { activeNotes, scaleNotes, isKeyLocked, useFlats, toggleNote, playNote } = useHarmonic();

  const scaleChromas = new Set(scaleNotes.map(n => Note.chroma(n)).filter((c): c is number => c !== undefined));
  const totalNotes = HIGH_MIDI - LOW_MIDI; // 24 semitones

  // Build notes array: center is C4, going outward
  const notes = [];
  for (let midi = LOW_MIDI; midi <= HIGH_MIDI; midi++) {
    const noteName = Note.fromMidi(midi);
    const pc = getNotePitchClass(noteName, useFlats);
    const isBlack = pc.includes("#") || pc.includes("b");
    const inScale = scaleChromas.has(midi % 12);
    const isActive = activeNotes.has(noteName);
    const isCenter = midi === CENTER_MIDI;
    const distFromCenter = Math.abs(midi - CENTER_MIDI);

    notes.push({ midi, noteName, pc, isBlack, inScale, isActive, isCenter, distFromCenter });
  }

  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] font-semibold text-foreground uppercase tracking-wider">
          Linear Note Map
        </h3>
        <span className="text-[9px] text-muted-foreground">C3 ← C4 → C5</span>
      </div>

      <div className="flex items-center gap-[2px] justify-center">
        {notes.map(n => {
          const dimmed = isKeyLocked && !n.inScale;
          const color = getNoteColor(n.pc);

          return (
            <button
              key={n.midi}
              onClick={() => { toggleNote(n.noteName); playNote(n.noteName); }}
              className="relative flex flex-col items-center transition-all duration-150 group"
              style={{ flex: n.isCenter ? '0 0 auto' : '1 1 0' }}
              title={`${n.pc}${Note.octave(n.noteName)}`}
            >
              {/* Bar */}
              <div
                className="rounded-sm transition-all duration-150"
                style={{
                  width: n.isCenter ? 6 : 4,
                  height: n.isCenter ? 36 : Math.max(12, 36 - n.distFromCenter * 1.5),
                  backgroundColor: n.isActive ? color : dimmed ? 'hsl(var(--muted))' : color,
                  opacity: n.isActive ? 1 : dimmed ? 0.2 : 0.4,
                  boxShadow: n.isActive ? `0 0 8px ${color}` : 'none',
                }}
              />

              {/* Label for key notes */}
              {(n.isCenter || n.midi === LOW_MIDI || n.midi === HIGH_MIDI || (!n.isBlack && n.inScale)) && (
                <span
                  className="text-[7px] mt-1 leading-none"
                  style={{
                    color: n.isCenter ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                    fontWeight: n.isCenter ? 700 : 400,
                  }}
                >
                  {n.pc}
                </span>
              )}

              {/* Center marker */}
              {n.isCenter && (
                <div className="w-1 h-1 rounded-full bg-primary mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
