import { useHarmonic } from "@/contexts/HarmonicContext";
import { PIANO_KEYS, getNoteColor, getHandMidis } from "@/lib/music-engine";
import { Note } from "tonal";
import { useCallback, useRef, useMemo, useEffect } from "react";

// Get the horizontal center % of a key by its MIDI number
function getKeyCenter(midi: number, whiteKeys: typeof PIANO_KEYS, whiteKeyWidth: number): number | null {
  const key = PIANO_KEYS.find(k => k.midi === midi);
  if (!key) return null;
  if (!key.isBlack) {
    const idx = whiteKeys.findIndex(w => w.midi === midi);
    if (idx < 0) return null;
    return (idx + 0.5) * whiteKeyWidth;
  } else {
    const prevWhiteIdx = whiteKeys.findIndex(w => w.midi > midi) - 1;
    if (prevWhiteIdx < 0) return null;
    return (prevWhiteIdx + 0.65 + whiteKeyWidth * 0.3 / whiteKeyWidth) * whiteKeyWidth;
  }
}

// SVG hand shape: fingers extend upward from a palm base, mirrored for left hand
function HandOverlaySVG({ 
  fingerPositions, 
  isLeft, 
  containerWidth,
  containerHeight,
}: { 
  fingerPositions: { x: number; finger: number; isBlack: boolean }[];
  isLeft: boolean;
  containerWidth: number;
  containerHeight: number;
}) {
  if (fingerPositions.length === 0) return null;

  // Sort by x position
  const sorted = [...fingerPositions].sort((a, b) => a.x - b.x);
  
  // Convert % to px
  const points = sorted.map(p => ({
    xPx: (p.x / 100) * containerWidth,
    finger: p.finger,
    isBlack: p.isBlack,
  }));

  const palmCenterX = (points[0].xPx + points[points.length - 1].xPx) / 2;
  const palmY = containerHeight + 30; // palm is below the keyboard
  const fingerTipY = (f: { isBlack: boolean }) => f.isBlack ? containerHeight * 0.45 : containerHeight * 0.7;
  
  // Finger widths based on key width
  const fingerW = (containerWidth * (100 / 52) / 100) * 0.7; // ~70% of white key width
  
  const color = isLeft ? "rgba(59, 130, 246, 0.35)" : "rgba(239, 68, 68, 0.35)";
  const strokeColor = isLeft ? "rgba(59, 130, 246, 0.6)" : "rgba(239, 68, 68, 0.6)";
  const badgeColor = isLeft ? "rgba(59, 130, 246, 0.85)" : "rgba(239, 68, 68, 0.85)";

  return (
    <svg 
      className="absolute inset-0 pointer-events-none" 
      style={{ zIndex: 10, overflow: "visible" }}
      width={containerWidth} 
      height={containerHeight}
    >
      {/* Palm area */}
      <ellipse
        cx={palmCenterX}
        cy={palmY}
        rx={(points[points.length - 1].xPx - points[0].xPx) / 2 + fingerW}
        ry={40}
        fill={color}
        stroke={strokeColor}
        strokeWidth={1.5}
      />
      
      {/* Fingers as rounded rectangles connected to palm */}
      {points.map((pt, i) => {
        const tipY = fingerTipY(sorted[i]);
        const baseY = containerHeight + 5;
        const height = baseY - tipY;
        const radius = fingerW / 2;
        
        return (
          <g key={i}>
            {/* Finger body */}
            <rect
              x={pt.xPx - fingerW / 2}
              y={tipY}
              width={fingerW}
              height={height}
              rx={radius}
              ry={radius}
              fill={color}
              stroke={strokeColor}
              strokeWidth={1.5}
            />
            {/* Fingertip circle with number */}
            <circle
              cx={pt.xPx}
              cy={tipY + radius}
              r={radius - 1}
              fill={badgeColor}
            />
            <text
              x={pt.xPx}
              y={tipY + radius + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize={Math.max(9, fingerW * 0.55)}
              fontFamily="monospace"
              fontWeight="bold"
            >
              {pt.finger}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

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

  // Compute hand finger positions using scale-aware logic
  // Left hand: finger 1 is highest (thumb), finger 5 is lowest (pinky)
  // getHandMidis returns [low..high] for left, so index 0=finger5, index 4=finger1
  const leftFingerPositions = useMemo(() => {
    if (!leftHand.enabled) return [];
    const midis = getHandMidis(leftHand.rootNote, scaleNotes, "left");
    return midis.map((midi, i) => {
      const x = getKeyCenter(midi, whiteKeys, whiteKeyWidth);
      const key = PIANO_KEYS.find(k => k.midi === midi);
      // midis are low-to-high: index 0 = finger 5, index 4 = finger 1
      return x !== null ? { x, finger: 5 - i, isBlack: key?.isBlack ?? false } : null;
    }).filter(Boolean) as { x: number; finger: number; isBlack: boolean }[];
  }, [leftHand, scaleNotes, whiteKeys, whiteKeyWidth]);

  // Right hand: finger 1 is lowest (thumb), finger 5 is highest (pinky)
  const rightFingerPositions = useMemo(() => {
    if (!rightHand.enabled) return [];
    const midis = getHandMidis(rightHand.rootNote, scaleNotes, "right");
    return midis.map((midi, i) => {
      const x = getKeyCenter(midi, whiteKeys, whiteKeyWidth);
      const key = PIANO_KEYS.find(k => k.midi === midi);
      return x !== null ? { x, finger: i + 1, isBlack: key?.isBlack ?? false } : null;
    }).filter(Boolean) as { x: number; finger: number; isBlack: boolean }[];
  }, [rightHand, scaleNotes, whiteKeys, whiteKeyWidth]);

  // Scroll to C4 on mount
  useEffect(() => {
    const scrollEl = scrollRef.current;
    const innerEl = containerRef.current;
    if (!scrollEl || !innerEl) return;
    // C4 is MIDI 60. Find its white key index
    const c4Idx = whiteKeys.findIndex(k => k.midi === 60);
    if (c4Idx < 0) return;
    const innerWidth = innerEl.scrollWidth;
    const visibleWidth = scrollEl.clientWidth;
    const c4Pos = (c4Idx / whiteKeys.length) * innerWidth;
    scrollEl.scrollLeft = Math.max(0, c4Pos - visibleWidth / 2);
  }, [whiteKeys]);

  // We need actual pixel dimensions for the SVG
  const containerWidth = containerRef.current?.scrollWidth ?? 800;
  const containerHeight = containerRef.current?.clientHeight ?? 128;

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
              {showScaleIndicator && (
                <div 
                  className="absolute bottom-6 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-2 flex items-center justify-center"
                  style={{ 
                    borderColor: isActive ? 'hsl(var(--background))' : color,
                    backgroundColor: isActive ? 'hsla(var(--background) / 0.3)' : 'transparent',
                  }}
                >
                  <span className="text-[7px] font-mono font-bold" style={{ color: isActive ? 'hsl(var(--background))' : color }}>{pc}</span>
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

          const prevWhiteIdx = whiteKeys.findIndex(w => w.midi > key.midi) - 1;
          if (prevWhiteIdx < 0) return null;
          const leftPos = (prevWhiteIdx + 0.55) * whiteKeyWidth;

          return (
            <div
              key={key.midi}
              className="absolute top-0 cursor-pointer rounded-b-sm hover:opacity-90"
              style={{
                left: `${leftPos}%`,
                width: `${whiteKeyWidth * 0.8}%`,
                height: "60%",
                backgroundColor: isActive ? color : "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                zIndex: 2,
              }}
              onClick={() => handleKeyClick(key.note)}
            >
              {showScaleIndicator && (
                <div 
                  className="absolute top-3 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-2 flex items-center justify-center"
                  style={{ 
                    borderColor: isActive ? 'hsl(var(--background))' : color,
                    backgroundColor: isActive ? 'hsla(var(--background) / 0.3)' : 'transparent',
                  }}
                >
                  <span className="text-[7px] font-mono font-bold" style={{ color: isActive ? 'hsl(var(--background))' : color }}>{Note.pitchClass(key.note)}</span>
                </div>
              )}
            </div>
          );
        })}

        {/* Hand overlays rendered as SVG on top */}
        {leftHand.enabled && (
          <HandOverlaySVG
            fingerPositions={leftFingerPositions}
            isLeft={true}
            containerWidth={containerWidth}
            containerHeight={containerHeight}
          />
        )}
        {rightHand.enabled && (
          <HandOverlaySVG
            fingerPositions={rightFingerPositions}
            isLeft={false}
            containerWidth={containerWidth}
            containerHeight={containerHeight}
          />
        )}
        </div>
      </div>
    </div>
  );
}
