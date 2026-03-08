import { useHarmonic } from "@/contexts/HarmonicContext";
import { PIANO_KEYS, getNoteColor, getHandMidis, NOTE_COLOR_KEYS } from "@/lib/music-engine";
import { Note } from "tonal";
import { useCallback, useRef, useMemo, useEffect } from "react";

/** Return a brightened version of a note's color for legibility on dark keys */
function getBrightNoteColor(noteName: string): string {
  const pc = Note.pitchClass(noteName) || noteName;
  const enharmonic = Note.enharmonic(pc) || pc;
  const cssVar = NOTE_COLOR_KEYS[pc] || NOTE_COLOR_KEYS[enharmonic] || "var(--note-c)";
  // Use the same CSS var but override saturation/lightness via calc — 
  // we can't easily parse CSS vars, so use a filter trick:
  // Just return a brighter fixed version by wrapping with adjusted lightness
  return `hsl(${cssVar})`;
}

/** Inline style for a bright indicator on black keys: boost brightness via filter */
const BRIGHT_FILTER = "saturate(1.6) brightness(1.5)";

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

// Realistic hand overlay with organic finger shapes, knuckle joints, and a natural palm
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

  const sorted = [...fingerPositions].sort((a, b) => a.x - b.x);
  const points = sorted.map(p => ({
    xPx: (p.x / 100) * containerWidth,
    finger: p.finger,
    isBlack: p.isBlack,
  }));

  const keyW = (containerWidth / 52); // approximate white key width in px
  
  // Skin-tone colors with hand tint
  const skinBase = isLeft ? "rgba(59, 130, 246, 0.18)" : "rgba(239, 68, 68, 0.18)";
  const skinFill = isLeft ? "rgba(59, 130, 246, 0.12)" : "rgba(239, 68, 68, 0.12)";
  const skinStroke = isLeft ? "rgba(59, 130, 246, 0.4)" : "rgba(239, 68, 68, 0.4)";
  const nailColor = isLeft ? "rgba(59, 130, 246, 0.08)" : "rgba(239, 68, 68, 0.08)";
  const knuckleColor = isLeft ? "rgba(59, 130, 246, 0.25)" : "rgba(239, 68, 68, 0.25)";
  const badgeColor = isLeft ? "rgba(59, 130, 246, 0.8)" : "rgba(239, 68, 68, 0.8)";
  const badgeText = "white";

  // Finger proportions: [thumb, index, middle, ring, pinky] widths relative to key
  const fingerWidthRatios = [0.75, 0.58, 0.56, 0.54, 0.48];
  // Finger lengths vary naturally
  const fingerLengthRatios = [0.38, 0.52, 0.58, 0.52, 0.42];

  // Palm geometry
  const palmLeft = points[0].xPx - keyW * 0.6;
  const palmRight = points[points.length - 1].xPx + keyW * 0.6;
  const palmTop = containerHeight * 0.82;
  const palmBottom = containerHeight + 35;
  const palmCX = (palmLeft + palmRight) / 2;

  // Build a smooth palm outline path
  const palmPath = `
    M ${palmLeft + 8} ${palmTop}
    Q ${palmLeft - 4} ${palmTop + 15} ${palmLeft} ${(palmTop + palmBottom) / 2}
    Q ${palmLeft - 2} ${palmBottom - 8} ${palmCX - (palmRight - palmLeft) * 0.15} ${palmBottom}
    Q ${palmCX} ${palmBottom + 6} ${palmCX + (palmRight - palmLeft) * 0.15} ${palmBottom}
    Q ${palmRight + 2} ${palmBottom - 8} ${palmRight} ${(palmTop + palmBottom) / 2}
    Q ${palmRight + 4} ${palmTop + 15} ${palmRight - 8} ${palmTop}
    Z
  `;

  return (
    <svg 
      className="absolute inset-0 pointer-events-none" 
      style={{ zIndex: 10, overflow: "visible" }}
      width={containerWidth} 
      height={containerHeight}
    >
      <defs>
        <filter id={`hand-shadow-${isLeft ? 'l' : 'r'}`}>
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor={isLeft ? "rgba(59,130,246,0.2)" : "rgba(239,68,68,0.2)"} />
        </filter>
      </defs>

      <g filter={`url(#hand-shadow-${isLeft ? 'l' : 'r'})`}>
        {/* Palm */}
        <path d={palmPath} fill={skinBase} stroke={skinStroke} strokeWidth={1.2} />
        
        {/* Fingers */}
        {points.map((pt, i) => {
          // Map sorted index to finger type (for left hand reversed)
          const fingerIdx = isLeft ? (4 - sorted[i].finger + 1) : (sorted[i].finger - 1);
          const clampedIdx = Math.max(0, Math.min(4, fingerIdx));
          
          const fw = keyW * fingerWidthRatios[clampedIdx];
          const fingerLen = containerHeight * fingerLengthRatios[clampedIdx];
          const tipY = pt.isBlack ? containerHeight * 0.38 : containerHeight * 0.62;
          const baseY = palmTop + 2;
          
          // Knuckle position
          const knuckleY = baseY - fingerLen * 0.15;
          
          // Slight natural splay: outer fingers angle outward
          const centerIdx = 2;
          const splayAmount = (i - (points.length - 1) / 2) * 1.2;
          const tipX = pt.xPx + splayAmount;
          
          // Tapered finger: wider at base, narrower at tip
          const baseW = fw * 1.05;
          const tipW = fw * 0.8;
          const nailW = tipW * 0.7;
          
          // Organic finger path with slight curvature
          const fingerPath = `
            M ${pt.xPx - baseW / 2} ${baseY}
            Q ${tipX - baseW / 2 - 1} ${knuckleY + (baseY - knuckleY) * 0.5} ${tipX - tipW / 2} ${tipY + tipW * 0.6}
            Q ${tipX - tipW / 2} ${tipY} ${tipX} ${tipY - 1}
            Q ${tipX + tipW / 2} ${tipY} ${tipX + tipW / 2} ${tipY + tipW * 0.6}
            Q ${tipX + baseW / 2 + 1} ${knuckleY + (baseY - knuckleY) * 0.5} ${pt.xPx + baseW / 2} ${baseY}
            Z
          `;

          return (
            <g key={i}>
              {/* Finger body */}
              <path d={fingerPath} fill={skinBase} stroke={skinStroke} strokeWidth={1} />
              
              {/* Fingernail */}
              <ellipse
                cx={tipX}
                cy={tipY + tipW * 0.15}
                rx={nailW / 2}
                ry={tipW * 0.28}
                fill={nailColor}
                stroke={skinStroke}
                strokeWidth={0.5}
              />
              
              {/* Knuckle crease */}
              <line
                x1={tipX - fw * 0.3}
                y1={knuckleY + (baseY - knuckleY) * 0.45}
                x2={tipX + fw * 0.3}
                y2={knuckleY + (baseY - knuckleY) * 0.45}
                stroke={knuckleColor}
                strokeWidth={0.8}
                strokeLinecap="round"
              />
              
              {/* Second joint crease */}
              <line
                x1={tipX - fw * 0.25}
                y1={tipY + fingerLen * 0.35}
                x2={tipX + fw * 0.25}
                y2={tipY + fingerLen * 0.35}
                stroke={knuckleColor}
                strokeWidth={0.6}
                strokeLinecap="round"
              />
              
              {/* Finger number badge */}
              <circle
                cx={tipX}
                cy={tipY + tipW * 0.6 + 8}
                r={Math.max(6, fw * 0.38)}
                fill={badgeColor}
              />
              <text
                x={tipX}
                y={tipY + tipW * 0.6 + 9}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={badgeText}
                fontSize={Math.max(8, fw * 0.45)}
                fontFamily="monospace"
                fontWeight="bold"
              >
                {sorted[i].finger}
              </text>
            </g>
          );
        })}
      </g>
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
                    filter: isActive ? undefined : BRIGHT_FILTER,
                  }}
                >
                  <span className="text-[7px] font-mono font-bold" style={{ color: isActive ? 'hsl(var(--background))' : color, filter: isActive ? undefined : BRIGHT_FILTER }}>{Note.pitchClass(key.note)}</span>
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
