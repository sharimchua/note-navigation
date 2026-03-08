import { useHarmonic } from "@/contexts/HarmonicContext";
import { getNoteColor, getNotePitchClass } from "@/lib/music-engine";
import { Note } from "tonal";

const CENTER_MIDI = 60;
const LOW_MIDI = 48;
const HIGH_MIDI = 72;

export function LinearNoteMap() {
  const { activeNotes, scaleNotes, isKeyLocked, useFlats, toggleNote, playNote } = useHarmonic();

  const scaleChromas = new Set(scaleNotes.map(n => Note.chroma(n)).filter((c): c is number => c !== undefined));

  const notes = [];
  for (let midi = LOW_MIDI; midi <= HIGH_MIDI; midi++) {
    const noteName = Note.fromMidi(midi);
    const pc = getNotePitchClass(noteName, useFlats);
    const isBlack = pc.includes("#") || pc.includes("b");
    const inScale = scaleChromas.has(midi % 12);
    const isActive = activeNotes.has(noteName);
    const isCenter = midi === CENTER_MIDI;

    notes.push({ midi, noteName, pc, isBlack, inScale, isActive, isCenter });
  }

  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] font-semibold text-foreground uppercase tracking-wider">
          Linear Note Map
        </h3>
        <span className="text-[9px] text-muted-foreground">C3 ← C4 → C5</span>
      </div>

      <div className="flex items-center justify-between">
        {notes.map(n => {
          const dimmed = isKeyLocked && !n.inScale;
          const color = getNoteColor(n.pc);

          return (
            <button
              key={n.midi}
              onClick={() => { toggleNote(n.noteName); playNote(n.noteName); }}
              className="flex flex-col items-center gap-1 group"
              title={`${n.pc}${Note.octave(n.noteName)}`}
            >
              <div
                className="rounded-full transition-all duration-150"
                style={{
                  width: 18,
                  height: 18,
                  backgroundColor: n.isActive ? color : 'transparent',
                  border: `2px solid ${dimmed ? 'hsl(var(--muted))' : color}`,
                  opacity: n.isActive ? 1 : dimmed ? 0.15 : n.inScale ? 0.7 : 0.3,
                  boxShadow: n.isActive ? `0 0 10px ${color}` : 'none',
                }}
              />
              {(n.isCenter || n.midi === LOW_MIDI || n.midi === HIGH_MIDI || (!n.isBlack && n.inScale)) && (
                <span
                  className="text-[7px] leading-none"
                  style={{
                    color: n.isCenter ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                    fontWeight: n.isCenter ? 700 : 400,
                  }}
                >
                  {n.pc}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
