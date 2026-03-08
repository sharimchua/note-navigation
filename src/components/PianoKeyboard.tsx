import { useHarmonic } from "@/contexts/HarmonicContext";
import { PIANO_KEYS, getNoteColor, getHandMidis, getScaleDegree } from "@/lib/music-engine";
import { Note } from "tonal";
import { useCallback, useRef, useMemo, useEffect } from "react";

const BRIGHT_FILTER = "saturate(1.6) brightness(1.5)";

export function PianoKeyboard() {
  const { activeNotes, toggleNote, playNote, isNoteInCurrentScale, isKeyLocked, leftHand, rightHand, scaleNotes } = useHarmonic();
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyClick = useCallback((note: string) => {
    playNote(note);
    toggleNote(note);
  }, [playNote, toggleNote]);

  const whiteKeys = PIANO_KEYS.filter(k => !k.isBlack);
  const whiteKeyWidth = 100 / whiteKeys.length;

  const fingeringMap = useMemo(() => {
    const map = new Map<number, { finger: number; hand: 'left' | 'right' }>();
    if (leftHand.enabled) {
      const midis = getHandMidis(leftHand.rootNote, scaleNotes, "left");
      midis.forEach((midi, i) => {
        map.set(midi, { finger: 5 - i, hand: 'left' });
      });
    }
    if (rightHand.enabled) {
      const midis = getHandMidis(rightHand.rootNote, scaleNotes, "right");
      midis.forEach((midi, i) => {
        map.set(midi, { finger: i + 1, hand: 'right' });
      });
    }
    return map;
  }, [leftHand, rightHand, scaleNotes]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    const innerEl = containerRef.current;
    if (!scrollEl || !innerEl) return;
    const c4Idx = whiteKeys.findIndex(k => k.midi === 60);
    if (c4Idx < 0) return;
    const innerWidth = innerEl.scrollWidth;
    const visibleWidth = scrollEl.clientWidth;
    const c4Pos = (c4Idx / whiteKeys.length) * innerWidth;
    scrollEl.scrollLeft = Math.max(0, c4Pos - visibleWidth / 2);
  }, [whiteKeys]);

  return (
    <div className="glass-panel p-4">
      <h3 className="engineering-label mb-3">Piano · 88 Keys</h3>
      <div ref={scrollRef} className="overflow-x-auto pb-3">
        <div 
          ref={containerRef}
          className="relative select-none"
          style={{ minWidth: "1600px", height: "200px" }}
        >
        {/* White keys */}
        {whiteKeys.map((key, i) => {
          const isActive = activeNotes.has(key.note);
          const inScale = isNoteInCurrentScale(key.note);
          const pc = Note.pitchClass(key.note);
          const color = getNoteColor(key.note);
          const showScaleIndicator = isKeyLocked && inScale;
          const fingering = fingeringMap.get(key.midi);
          const degree = isKeyLocked ? getScaleDegree(key.note, scaleNotes) : null;

          return (
            <div
              key={key.midi}
              className={`absolute top-0 bottom-0 border border-border/50 cursor-pointer rounded-b-sm hover:opacity-90 ${isActive ? 'note-active' : ''}`}
              style={{
                left: `${i * whiteKeyWidth}%`,
                width: `${whiteKeyWidth}%`,
                backgroundColor: isActive ? color : "#f5f0e8",
                zIndex: 1,
              }}
              onClick={() => handleKeyClick(key.note)}
            >
              {showScaleIndicator && (
                <div 
                  className="absolute bottom-6 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-2 flex items-center justify-center"
                  style={{ 
                    borderColor: isActive ? 'hsl(var(--background))' : color,
                    backgroundColor: isActive ? 'hsla(var(--background) / 0.3)' : 'transparent',
                  }}
                >
                  <span className="text-[7px] font-mono font-bold" style={{ color: isActive ? 'hsl(var(--background))' : color }}>
                    {degree || pc}
                  </span>
                </div>
              )}
              {fingering && (
                <div 
                  className="absolute top-2 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ 
                    backgroundColor: fingering.hand === 'left' ? 'hsla(217, 91%, 60%, 0.85)' : 'hsla(0, 84%, 60%, 0.85)',
                    zIndex: 5,
                  }}
                >
                  <span className="text-[9px] font-mono font-bold" style={{ color: 'hsl(var(--primary-foreground))' }}>{fingering.finger}</span>
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
          const showScaleIndicator = isKeyLocked && inScale;
          const fingering = fingeringMap.get(key.midi);
          const isHovered = hoveredPitchClass === (key.midi % 12);
          const degree = isKeyLocked ? getScaleDegree(key.note, scaleNotes) : null;

          const prevWhiteIdx = whiteKeys.findIndex(w => w.midi > key.midi) - 1;
          if (prevWhiteIdx < 0) return null;
          const leftPos = (prevWhiteIdx + 0.55) * whiteKeyWidth;

          return (
            <div
              key={key.midi}
              className={`absolute top-0 cursor-pointer rounded-b-sm hover:opacity-90 ${isActive ? 'note-active' : ''}`}
              style={{
                left: `${leftPos}%`,
                width: `${whiteKeyWidth * 0.8}%`,
                height: "60%",
                backgroundColor: isActive ? color : isHovered ? `${color}60` : "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                zIndex: 2,
                boxShadow: isHovered && !isActive ? `inset 0 0 15px ${color}40` : undefined,
              }}
              onClick={() => handleKeyClick(key.note)}
              onMouseEnter={() => setHoveredPitchClass(key.midi % 12)}
              onMouseLeave={() => setHoveredPitchClass(null)}
            >
              {showScaleIndicator && (
                <div 
                  className="absolute top-3 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-2 flex items-center justify-center"
                  style={{ 
                    borderColor: isActive ? 'hsl(var(--background))' : color,
                    backgroundColor: isActive ? 'hsla(var(--background) / 0.3)' : 'transparent',
                    filter: isActive ? undefined : BRIGHT_FILTER,
                  }}
                >
                  <span className="text-[7px] font-mono font-bold" style={{ color: isActive ? 'hsl(var(--background))' : color, filter: isActive ? undefined : BRIGHT_FILTER }}>
                    {degree || Note.pitchClass(key.note)}
                  </span>
                </div>
              )}
              {fingering && (
                <div 
                  className="absolute bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ 
                    backgroundColor: fingering.hand === 'left' ? 'hsla(217, 91%, 60%, 0.85)' : 'hsla(0, 84%, 60%, 0.85)',
                    zIndex: 5,
                  }}
                >
                  <span className="text-[9px] font-mono font-bold" style={{ color: 'hsl(var(--primary-foreground))' }}>{fingering.finger}</span>
                </div>
              )}
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}