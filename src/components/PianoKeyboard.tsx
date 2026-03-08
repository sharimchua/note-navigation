import { useHarmonic } from "@/contexts/HarmonicContext";
import { PIANO_KEYS, getNoteColor } from "@/lib/music-engine";
import { Note } from "tonal";
import { useCallback, useRef } from "react";

export function PianoKeyboard() {
  const { activeNotes, toggleNote, playNote, isNoteInCurrentScale, isKeyLocked } = useHarmonic();
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyClick = useCallback((note: string) => {
    playNote(note);
    toggleNote(note);
  }, [playNote, toggleNote]);

  // Group keys into octaves for rendering
  const whiteKeys = PIANO_KEYS.filter(k => !k.isBlack);
  const whiteKeyWidth = 100 / whiteKeys.length;

  return (
    <div className="glass-panel p-4">
      <h3 className="engineering-label mb-3">Piano · 88 Keys</h3>
      <div 
        ref={containerRef}
        className="relative h-32 select-none overflow-x-auto"
        style={{ minWidth: "800px" }}
      >
        {/* White keys */}
        {whiteKeys.map((key, i) => {
          const isActive = activeNotes.has(key.note);
          const inScale = isNoteInCurrentScale(key.note);
          const pc = Note.pitchClass(key.note);
          const color = getNoteColor(key.note);
          const showScaleIndicator = isKeyLocked && inScale && !isActive;

          return (
            <div
              key={key.midi}
              className="absolute top-0 bottom-0 border border-border/50 cursor-pointer rounded-b-sm hover:opacity-90"
              style={{
                left: `${i * whiteKeyWidth}%`,
                width: `${whiteKeyWidth}%`,
                backgroundColor: isActive ? color : "#ffffff",
                zIndex: 1,
              }}
              onClick={() => handleKeyClick(key.note)}
            >
              {/* Scale indicator circle */}
              {showScaleIndicator && (
                <div 
                  className="absolute bottom-6 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-2 flex items-center justify-center"
                  style={{ borderColor: color }}
                >
                  <span className="text-[7px] font-mono font-bold" style={{ color }}>{pc}</span>
                </div>
              )}
              <span 
                className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-mono"
                style={{ color: isActive ? "hsl(var(--background))" : "hsl(var(--muted-foreground))" }}
              >
                {pc}{Note.octave(key.note)}
              </span>
            </div>
          );
        })}

        {/* Black keys */}
        {PIANO_KEYS.filter(k => k.isBlack).map((key) => {
          const isActive = activeNotes.has(key.note);
          const inScale = isNoteInCurrentScale(key.note);
          const color = getNoteColor(key.note);
          const showScaleIndicator = isKeyLocked && inScale && !isActive;

          // Find position relative to white keys
          const prevWhiteIdx = whiteKeys.findIndex(w => w.midi > key.midi) - 1;
          if (prevWhiteIdx < 0) return null;
          const leftPos = (prevWhiteIdx + 0.65) * whiteKeyWidth;

          return (
            <div
              key={key.midi}
              className="absolute top-0 cursor-pointer rounded-b-sm hover:opacity-90"
              style={{
                left: `${leftPos}%`,
                width: `${whiteKeyWidth * 0.6}%`,
                height: "60%",
                backgroundColor: isActive ? color : "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                zIndex: 2,
              }}
              onClick={() => handleKeyClick(key.note)}
            >
              {/* Scale indicator dot */}
              {showScaleIndicator && (
                <div 
                  className="absolute top-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
