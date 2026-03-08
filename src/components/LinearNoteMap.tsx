import { useHarmonic } from "@/contexts/HarmonicContext";
import { getNoteColor, getNotePitchClass } from "@/lib/music-engine";
import { Note } from "tonal";

const CENTER_MIDI = 60;
const LOW_MIDI = 48;
const HIGH_MIDI = 72;
const CIRCLE_SIZE = 28;

export function LinearNoteMap() {
  const { activeNotes, scaleNotes, isKeyLocked, useFlats, toggleNote, playNote } = useHarmonic();

  const scaleChromas = new Set(scaleNotes.map(n => Note.chroma(n)).filter((c): c is number => c !== undefined));

  const notes = [];
  for (let midi = LOW_MIDI; midi <= HIGH_MIDI; midi++) {
    const noteName = Note.fromMidi(midi);
    const pc = getNotePitchClass(noteName, useFlats);
    const inScale = scaleChromas.has(midi % 12);
    const isActive = activeNotes.has(noteName);
    const isCenter = midi === CENTER_MIDI;

    notes.push({ midi, noteName, pc, inScale, isActive, isCenter });
  }

  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] font-semibold text-foreground uppercase tracking-wider">
          Linear Note Map
        </h3>
        <span className="text-[9px] text-muted-foreground">C3 ← C4 → C5</span>
      </div>

      <div className="relative flex items-center justify-between">
        <div
          className="absolute top-1/2 left-0 right-0 -translate-y-1/2"
          style={{ height: 2, background: 'hsl(var(--border))' }}
        />

        {notes.map(n => {
          const color = getNoteColor(n.pc);

          return (
            <button
              key={n.midi}
              onClick={() => { toggleNote(n.noteName); playNote(n.noteName); }}
              className="relative z-10 flex items-center justify-center shrink-0 transition-all duration-150"
              style={{
                width: CIRCLE_SIZE,
                height: CIRCLE_SIZE,
                borderRadius: '50%',
                backgroundColor: color,
                opacity: n.isActive ? 1 : 0.6,
                boxShadow: n.isActive
                  ? `0 0 12px ${color}`
                  : (isKeyLocked && n.inScale)
                    ? '0 0 0 3px hsl(var(--foreground))'
                    : 'none',
              }}
              title={`${n.pc}${Note.octave(n.noteName)}`}
            >
              <span
                className="text-[8px] font-bold leading-none select-none"
                style={{ color: 'hsl(var(--primary-foreground))' }}
              >
                {n.pc}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
