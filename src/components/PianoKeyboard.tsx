import { useHarmonic } from "@/contexts/HarmonicContext";
import { PIANO_KEYS, getNoteColor, getScaleLabel, getNoteChroma, PIANO_START_MIDI } from "@/lib/music-engine";
import { Note } from "tonal";
import { useCallback, useRef, useMemo, useEffect } from "react";

const BRIGHT_FILTER = "saturate(1.6) brightness(1.5)";
const WHITE_KEYS = PIANO_KEYS.filter(k => !k.isBlack);
const FADE_DURATION = 850;

export function PianoKeyboard() {
  const { activeNotes, toggleNote, playNote, isNoteInCurrentScale, isKeyLocked, scaleLabelMode, scaleNotes, trailMode, isNoteVisible, isNotePressed, isNoteFading } = useHarmonic();
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handleKeyClick = useCallback((note: string) => {
    playNote(note);
    toggleNote(note);
  }, [playNote, toggleNote]);
  const whiteKeyWidth = 100 / WHITE_KEYS.length;

  useEffect(() => {
    const scrollEl = scrollRef.current;
    const innerEl = containerRef.current;
    if (!scrollEl || !innerEl) return;
    const c4Idx = WHITE_KEYS.findIndex(k => k.midi === 60);
    if (c4Idx < 0) return;
    const innerWidth = innerEl.scrollWidth;
    const visibleWidth = scrollEl.clientWidth;
    const c4Pos = (c4Idx / WHITE_KEYS.length) * innerWidth;
    scrollEl.scrollLeft = Math.max(0, c4Pos - visibleWidth / 2);
  }, []);

  return (
    <div className="glass-panel p-4 h-full flex flex-col">
      <h3 className="engineering-label mb-3">Piano · 88 Keys</h3>
      <div ref={scrollRef} className="overflow-x-auto pb-3 flex-1 min-h-0">
        <div 
          ref={containerRef}
          className="relative select-none h-full"
          style={{ minWidth: "1600px", minHeight: "120px" }}
        >
        {/* White keys */}
        {WHITE_KEYS.map((key, i) => {
          const pressed = isNotePressed(key.note);
          const fading = isNoteFading(key.note);
          const visible = isNoteVisible(key.note);
          const inScale = isNoteInCurrentScale(key.note);
          const pc = Note.pitchClass(key.note);
          const color = getNoteColor(key.note);
          const showScaleIndicator = isKeyLocked && inScale;
          const scaleLabel = isKeyLocked ? getScaleLabel(key.note, scaleNotes, scaleLabelMode, baseMidi) : null;

          return (
            <div
              key={key.midi}
              className={`absolute top-0 bottom-0 border border-border/50 cursor-pointer rounded-b-sm hover:opacity-90 ${pressed ? 'note-active' : ''}`}
              style={{
                left: `${i * whiteKeyWidth}%`,
                width: `${whiteKeyWidth}%`,
                backgroundColor: visible ? color : "#f5f0e8",
                zIndex: 1,
                transition: 'background-color 0ms',
                animation: fading && trailMode 
                  ? `piano-key-fade ${FADE_DURATION}ms ease-out forwards`
                  : undefined,
              }}
              onClick={() => handleKeyClick(key.note)}
            >
              {/* Trail shimmer bar at bottom of active key */}
              {visible && trailMode && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-2 rounded-b-sm"
                  style={{ 
                    background: `linear-gradient(to top, ${color}, transparent)`,
                    animation: fading 
                      ? `halo-fade-out ${FADE_DURATION}ms ease-out forwards`
                      : 'trail-shimmer 1.5s ease-in-out infinite',
                  }}
                />
              )}
              {showScaleIndicator && (
                <div 
                  className="absolute bottom-6 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-2 flex items-center justify-center"
                  style={{ 
                    borderColor: visible ? 'hsl(var(--background))' : color,
                    backgroundColor: visible ? 'hsla(var(--background) / 0.3)' : 'transparent',
                  }}
                >
                  <span className="font-mono font-bold" style={{ color: visible ? 'hsl(var(--background))' : color, fontSize: scaleLabel && scaleLabel.length > 1 ? "6px" : "7px" }}>
                    {scaleLabel || pc}
                  </span>
                </div>
              )}
              {pc === "C" && (
                <span 
                  className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-mono"
                  style={{ color: visible ? "hsl(var(--background))" : "hsl(var(--muted-foreground))" }}
                >
                  C{Note.octave(key.note)}
                </span>
              )}
            </div>
          );
        })}

        {/* Black keys */}
        {PIANO_KEYS.filter(k => k.isBlack).map((key) => {
          const pressed = isNotePressed(key.note);
          const fading = isNoteFading(key.note);
          const visible = isNoteVisible(key.note);
          const inScale = isNoteInCurrentScale(key.note);
          const color = getNoteColor(key.note);
          const showScaleIndicator = isKeyLocked && inScale;
          const scaleLabel = isKeyLocked ? getScaleLabel(key.note, scaleNotes, scaleLabelMode, baseMidi) : null;

          const prevWhiteIdx = WHITE_KEYS.findIndex(w => w.midi > key.midi) - 1;
          if (prevWhiteIdx < 0) return null;
          const leftPos = (prevWhiteIdx + 0.55) * whiteKeyWidth;

          return (
            <div
              key={key.midi}
              className={`absolute top-0 cursor-pointer rounded-b-sm hover:opacity-90 ${pressed ? 'note-active' : ''}`}
              style={{
                left: `${leftPos}%`,
                width: `${whiteKeyWidth * 0.8}%`,
                height: "60%",
                backgroundColor: visible ? color : "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                zIndex: 2,
                transition: 'background-color 0ms',
                animation: fading && trailMode 
                  ? `piano-key-fade-black ${FADE_DURATION}ms ease-out forwards`
                  : undefined,
              }}
              onClick={() => handleKeyClick(key.note)}
            >
              {showScaleIndicator && (
                <div 
                  className="absolute top-3 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-2 flex items-center justify-center"
                  style={{ 
                    borderColor: visible ? 'hsl(var(--background))' : color,
                    backgroundColor: visible ? 'hsla(var(--background) / 0.3)' : 'transparent',
                    filter: visible ? undefined : BRIGHT_FILTER,
                  }}
                >
                  <span className="font-mono font-bold" style={{ color: visible ? 'hsl(var(--background))' : color, filter: visible ? undefined : BRIGHT_FILTER, fontSize: scaleLabel && scaleLabel.length > 1 ? "6px" : "7px" }}>
                    {scaleLabel || Note.pitchClass(key.note)}
                  </span>
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
