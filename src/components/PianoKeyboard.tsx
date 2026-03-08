import { useHarmonic } from "@/contexts/HarmonicContext";
import { PIANO_KEYS, getNoteColor, getPentascaleMidis } from "@/lib/music-engine";
import { Note } from "tonal";
import { useCallback, useRef, useMemo } from "react";

export function PianoKeyboard() {
  const { activeNotes, toggleNote, playNote, isNoteInCurrentScale, isKeyLocked, leftHand, rightHand } = useHarmonic();
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyClick = useCallback((note: string) => {
    playNote(note);
    toggleNote(note);
  }, [playNote, toggleNote]);

  // Compute hand overlay MIDI sets with finger numbers
  const leftHandMap = useMemo(() => {
    if (!leftHand.enabled) return new Map<number, number>();
    const midis = getPentascaleMidis(leftHand.rootNote);
    // Left hand: finger 5 on lowest note, finger 1 on highest
    const map = new Map<number, number>();
    midis.forEach((midi, i) => map.set(midi, 5 - i));
    return map;
  }, [leftHand]);

  const rightHandMap = useMemo(() => {
    if (!rightHand.enabled) return new Map<number, number>();
    const midis = getPentascaleMidis(rightHand.rootNote);
    // Right hand: finger 1 on lowest (thumb), finger 5 on highest
    const map = new Map<number, number>();
    midis.forEach((midi, i) => map.set(midi, i + 1));
    return map;
  }, [rightHand]);

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
          const lhFinger = leftHandMap.get(key.midi);
          const rhFinger = rightHandMap.get(key.midi);

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
              {/* Hand overlay indicators */}
              {lhFinger && (
                <div className="absolute top-1 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 z-[3] pointer-events-none">
                  <div className="w-5 h-5 rounded-full bg-blue-500/80 flex items-center justify-center shadow-sm">
                    <span className="text-[9px] font-mono font-bold text-white">{lhFinger}</span>
                  </div>
                  <span className="text-[7px] font-mono text-blue-600 font-semibold">L</span>
                </div>
              )}
              {rhFinger && (
                <div className="absolute top-1 right-1/2 translate-x-1/2 flex flex-col items-center gap-0.5 z-[3] pointer-events-none"
                  style={{ left: lhFinger ? '70%' : '50%', transform: lhFinger ? 'translateX(-50%)' : 'translateX(-50%)' }}
                >
                  <div className="w-5 h-5 rounded-full bg-red-500/80 flex items-center justify-center shadow-sm">
                    <span className="text-[9px] font-mono font-bold text-white">{rhFinger}</span>
                  </div>
                  <span className="text-[7px] font-mono text-red-600 font-semibold">R</span>
                </div>
              )}
              {/* Scale indicator circle */}
              {showScaleIndicator && (
                <div 
                  className="absolute bottom-6 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-2 flex items-center justify-center"
                  style={{ borderColor: color }}
                >
                  <span className="text-[7px] font-mono font-bold" style={{ color }}>{pc}</span>
                </div>
              )}
              {pc === "C" && (
                <span 
                  className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-mono"
                  style={{ color: isActive ? "hsl(var(--background))" : "hsl(var(--muted-foreground))" }}
                >
                  C{Note.octave(key.note)}
                </span>
              )}
            </div>
          );
        })}

        {/* Black keys */}
        {PIANO_KEYS.filter(k => k.isBlack).map((key) => {
          const isActive = activeNotes.has(key.note);
          const inScale = isNoteInCurrentScale(key.note);
          const color = getNoteColor(key.note);
          const showScaleIndicator = isKeyLocked && inScale && !isActive;
          const lhFinger = leftHandMap.get(key.midi);
          const rhFinger = rightHandMap.get(key.midi);

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
              {/* Hand overlay for black keys */}
              {lhFinger && (
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-[3] pointer-events-none">
                  <div className="w-4 h-4 rounded-full bg-blue-500/80 flex items-center justify-center shadow-sm">
                    <span className="text-[7px] font-mono font-bold text-white">{lhFinger}</span>
                  </div>
                </div>
              )}
              {rhFinger && (
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-[3] pointer-events-none"
                  style={{ bottom: lhFinger ? '20px' : '4px' }}
                >
                  <div className="w-4 h-4 rounded-full bg-red-500/80 flex items-center justify-center shadow-sm">
                    <span className="text-[7px] font-mono font-bold text-white">{rhFinger}</span>
                  </div>
                </div>
              )}
              {/* Scale indicator circle with note name */}
              {showScaleIndicator && (
                <div 
                  className="absolute top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center"
                  style={{ borderColor: color }}
                >
                  <span className="text-[6px] font-mono font-bold" style={{ color }}>{Note.pitchClass(key.note)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
