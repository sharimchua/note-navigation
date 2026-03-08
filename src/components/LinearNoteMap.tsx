import { useHarmonic } from "@/contexts/HarmonicContext";
import { getNoteColor, getNotePitchClass, getScaleDegree } from "@/lib/music-engine";
import { Note } from "tonal";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMemo } from "react";

const LOW_MIDI = 48;
const HIGH_MIDI = 72;

export function LinearNoteMap() {
  const { activeNotes, scaleNotes, isKeyLocked, useFlats, toggleNote, playNote } = useHarmonic();
  const isMobile = useIsMobile();

  const CIRCLE_SIZE = isMobile ? 20 : 28;
  const SMALL_CIRCLE = isMobile ? 12 : 16;

  const scaleChromas = useMemo(
    () => new Set(scaleNotes.map(n => Note.chroma(n)).filter((c): c is number => c !== undefined)),
    [scaleNotes]
  );

  const notes = useMemo(() => {
    const result = [];
    for (let midi = LOW_MIDI; midi <= HIGH_MIDI; midi++) {
      const noteName = Note.fromMidi(midi);
      const pc = getNotePitchClass(noteName, useFlats);
      const inScale = scaleChromas.has(midi % 12);
      const degree = getScaleDegree(noteName, scaleNotes);

      result.push({ midi, noteName, pc, inScale, degree });
    }
    return result;
  }, [useFlats, scaleChromas, scaleNotes]);

  return (
    <div className="glass-panel p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="engineering-label">
          Linear Note Map
        </h3>
        <span className="text-[9px] text-muted-foreground font-mono">C3 ← C4 → C5</span>
      </div>

      <div className="relative overflow-x-auto pb-3">
        <div className="relative flex items-center justify-between mb-2 px-4 py-3" style={{ minWidth: isMobile ? 540 : undefined }}>
          <div
            className="absolute top-1/2 left-0 right-0 -translate-y-1/2"
            style={{ height: 2, background: 'hsl(var(--border))' }}
          />

          {notes.map(n => {
            const color = getNoteColor(n.pc);
            const isActive = activeNotes.has(n.noteName);
            const deEmphasize = isKeyLocked && !n.inScale && !isActive;
            const size = deEmphasize ? SMALL_CIRCLE : CIRCLE_SIZE;

            return (
              <button
                key={n.midi}
                onClick={() => { toggleNote(n.noteName); playNote(n.noteName); }}
                className={`relative z-10 flex items-center justify-center shrink-0 transition-all duration-150 ${isActive ? 'note-active' : ''}`}
                style={{
                  width: size,
                  height: size,
                  borderRadius: '50%',
                  backgroundColor: color,
                  opacity: deEmphasize ? 0.25 : isActive ? 1 : 0.6,
                  boxShadow: isActive
                    ? `0 0 12px ${color}`
                    : isHovered
                      ? `0 0 10px ${color}`
                      : (isKeyLocked && n.inScale)
                        ? '0 0 0 3px hsl(var(--foreground))'
                        : 'none',
                  transform: isHovered && !isActive ? 'scale(1.15)' : undefined,
                  filter: isHovered && !isActive ? 'brightness(1.4)' : undefined,
                }}
                title={`${n.pc}${Note.octave(n.noteName)}`}
              >
                {!deEmphasize && (
                  <span
                    className={`font-bold leading-none select-none ${isMobile ? 'text-[6px]' : 'text-[8px]'}`}
                    style={{ color: 'hsl(var(--primary-foreground))' }}
                  >
                    {isKeyLocked && n.degree ? n.degree : n.pc}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}