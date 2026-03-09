import { useHarmonic } from "@/contexts/HarmonicContext";
import { getNoteColor, getNotePitchClass, getScaleLabel, getNoteChroma } from "@/lib/music-engine";
import { Note } from "tonal";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMemo } from "react";

const LOW_MIDI = 48;
const HIGH_MIDI = 72;

export function LinearNoteMap() {
  const { activeNotes, scaleNotes, isKeyLocked, scaleLabelMode, useFlats, toggleNote, playNote, trailMode } = useHarmonic();
  const isMobile = useIsMobile();

  const CIRCLE_SIZE = isMobile ? 20 : 28;
  const SMALL_CIRCLE = isMobile ? 12 : 16;

  const rootChroma = useMemo(() => scaleNotes.length > 0 ? getNoteChroma(scaleNotes[0]) : 0, [scaleNotes]);
  const baseMidi = useMemo(() => {
    if (activeNotes.size === 0) return undefined;
    let lowestActive = Infinity;
    activeNotes.forEach(n => { const m = Note.midi(n); if (m !== null && m < lowestActive) lowestActive = m; });
    if (!isFinite(lowestActive)) return undefined;
    let root = lowestActive;
    while (root % 12 !== rootChroma && root >= 0) root--;
    return root >= 0 ? root : undefined;
  }, [activeNotes, rootChroma]);

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
      const scaleLabel = getScaleLabel(noteName, scaleNotes, scaleLabelMode, baseMidi);

      result.push({ midi, noteName, pc, inScale, scaleLabel });
    }
    return result;
  }, [useFlats, scaleChromas, scaleNotes, scaleLabelMode]);

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
                className={`relative z-10 flex items-center justify-center shrink-0 ${isActive ? 'note-active' : ''} ${isActive && trailMode ? 'trail-glow' : ''}`}
                style={{
                  width: size,
                  height: size,
                  borderRadius: '50%',
                  backgroundColor: color,
                  opacity: deEmphasize ? 0.25 : isActive ? 1 : 0.6,
                  boxShadow: isActive
                    ? `0 0 12px ${color}`
                    : (isKeyLocked && n.inScale)
                      ? '0 0 0 3px hsl(var(--foreground))'
                      : 'none',
                  color, // for currentColor in trail-glow
                  transition: trailMode && !isActive 
                    ? 'background-color 850ms ease-out, opacity 850ms ease-out, box-shadow 850ms ease-out, width 150ms, height 150ms'
                    : 'width 150ms, height 150ms',
                }}
                title={`${n.pc}${Note.octave(n.noteName)}`}
              >
                {isActive && trailMode && (
                  <span
                    className="absolute inset-0 rounded-full trail-ripple pointer-events-none"
                    style={{ border: `2px solid ${color}` }}
                  />
                )}
                {!deEmphasize && (
                  <span
                    className={`font-bold leading-none select-none ${isMobile ? 'text-[6px]' : (n.scaleLabel && n.scaleLabel.length > 1 ? 'text-[6.5px]' : 'text-[8px]')}`}
                    style={{ color: 'hsl(var(--primary-foreground))' }}
                  >
                    {isKeyLocked && n.scaleLabel ? n.scaleLabel : n.pc}
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