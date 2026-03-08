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

// Pianist hand overlay: curved arch position, fingers curl from behind onto keys
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

  const keyW = containerWidth / 52;
  
  const skinBase = isLeft ? "rgba(59, 130, 246, 0.15)" : "rgba(239, 68, 68, 0.15)";
  const skinDarker = isLeft ? "rgba(59, 130, 246, 0.22)" : "rgba(239, 68, 68, 0.22)";
  const skinStroke = isLeft ? "rgba(59, 130, 246, 0.32)" : "rgba(239, 68, 68, 0.32)";
  const knuckleColor = isLeft ? "rgba(59, 130, 246, 0.25)" : "rgba(239, 68, 68, 0.25)";
  const badgeColor = isLeft ? "rgba(59, 130, 246, 0.75)" : "rgba(239, 68, 68, 0.75)";

  // Finger widths by finger number
  const widths: Record<number, number> = {
    1: keyW * 0.80, 2: keyW * 0.50, 3: keyW * 0.48, 4: keyW * 0.46, 5: keyW * 0.40,
  };

  // Pianist technique: fingertips contact the key surface
  // White keys: pads land about 2/3 down the visible key
  // Black keys: pads land roughly at the midpoint of the black key
  const whiteTipY = containerHeight * 0.72;
  const blackTipY = containerHeight * 0.28;

  // The knuckle ridge (MCP joints) hovers ABOVE the back edge of the keyboard
  // forming the arch of the hand. This is the key insight — knuckles are at the
  // TOP of the keyboard, not behind it, creating the characteristic curved shape.
  const knuckleY = containerHeight * 0.05; // knuckle arch above keys
  
  // Palm is behind/below the keyboard edge
  const palmCX = (points[0].xPx + points[points.length - 1].xPx) / 2;
  const palmSpan = points[points.length - 1].xPx - points[0].xPx;
  const palmW = palmSpan + keyW * 2.5;
  const palmTop = containerHeight * 0.25;    // visible palm starts here
  const palmBottom = containerHeight + 25;    // extends past keyboard
  
  // Wrist + forearm
  const wristW = palmW * 0.50;
  const wristY = containerHeight + 50;
  const forearmW = palmW * 0.45;
  const forearmEnd = containerHeight + 130;

  // Palm shape — wide oval that sits behind the keyboard
  const palmPath = `
    M ${palmCX - palmW / 2 + 5} ${palmTop + 10}
    Q ${palmCX - palmW / 2 - 3} ${palmTop + 25} ${palmCX - palmW / 2} ${(palmTop + palmBottom) / 2}
    Q ${palmCX - palmW / 2 + 5} ${palmBottom - 5} ${palmCX - wristW / 2} ${wristY}
    Q ${palmCX - wristW / 2 - 1} ${(wristY + forearmEnd) / 2} ${palmCX - forearmW / 2} ${forearmEnd}
    Q ${palmCX} ${forearmEnd + 6} ${palmCX + forearmW / 2} ${forearmEnd}
    Q ${palmCX + wristW / 2 + 1} ${(wristY + forearmEnd) / 2} ${palmCX + wristW / 2} ${wristY}
    Q ${palmCX + palmW / 2 - 5} ${palmBottom - 5} ${palmCX + palmW / 2} ${(palmTop + palmBottom) / 2}
    Q ${palmCX + palmW / 2 + 3} ${palmTop + 25} ${palmCX + palmW / 2 - 5} ${palmTop + 10}
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
          <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor={isLeft ? "rgba(59,130,246,0.1)" : "rgba(239,68,68,0.1)"} />
        </filter>
      </defs>

      <g filter={`url(#hand-shadow-${isLeft ? 'l' : 'r'})`}>
        {/* Palm + wrist + forearm (rendered first, behind fingers) */}
        <path d={palmPath} fill={skinBase} stroke={skinStroke} strokeWidth={1} />
        
        {/* Wrist creases */}
        <line x1={palmCX - wristW * 0.28} y1={wristY + 3} x2={palmCX + wristW * 0.28} y2={wristY + 3}
          stroke={knuckleColor} strokeWidth={0.6} strokeLinecap="round" />
        <line x1={palmCX - wristW * 0.22} y1={wristY + 8} x2={palmCX + wristW * 0.22} y2={wristY + 8}
          stroke={knuckleColor} strokeWidth={0.5} strokeLinecap="round" />

        {/* Fingers — each curls from knuckle arch down to the key surface */}
        {points.map((pt, i) => {
          const fingerNum = sorted[i].finger;
          const isThumb = fingerNum === 1;
          const fw = widths[fingerNum] || widths[3];
          
          // Fingertip position on the key
          const tipY = pt.isBlack ? blackTipY : whiteTipY;
          const tipX = pt.xPx;
          
          // Knuckle (MCP) position — the top of the arch
          // Each finger's knuckle is at a slightly different height for realism
          // Middle finger knuckle is highest, thumb lowest
          const knuckleOffsets: Record<number, number> = {
            1: 0.30, 2: 0.08, 3: 0.0, 4: 0.06, 5: 0.15,
          };
          const mcpY = knuckleY + containerHeight * (knuckleOffsets[fingerNum] || 0);
          // Knuckle X is between palm center and fingertip — slight pull toward center
          const mcpX = tipX + (palmCX - tipX) * (isThumb ? 0.15 : 0.25);
          
          // PIP joint — mid-finger, on the downward curve
          const pipY = tipY - (tipY - mcpY) * (isThumb ? 0.45 : 0.38);
          const pipX = tipX + (mcpX - tipX) * (isThumb ? 0.3 : 0.25);
          
          // DIP joint (not on thumb)
          const dipY = isThumb ? undefined : tipY - (tipY - pipY) * 0.45;
          const dipX = isThumb ? undefined : tipX + (pipX - tipX) * 0.15;
          
          // Finger widths taper
          const baseW = fw * (isThumb ? 1.1 : 0.95);
          const midW = fw * (isThumb ? 0.95 : 0.82);
          const tipW = fw * (isThumb ? 0.80 : 0.68);
          
          // Build curved finger path — the finger arcs up to the knuckle then curls down
          let fingerPath: string;
          
          if (isThumb) {
            // Thumb: shorter, wider, approaches more from the side
            const sideOff = isLeft ? -keyW * 0.3 : keyW * 0.3;
            fingerPath = `
              M ${mcpX - baseW / 2 + sideOff} ${mcpY + 5}
              C ${mcpX - baseW / 2 + sideOff * 0.5} ${mcpY}, 
                ${pipX - midW / 2} ${pipY + 3}, 
                ${pipX - midW / 2} ${pipY}
              Q ${tipX - tipW / 2} ${(pipY + tipY) / 2} ${tipX - tipW / 2} ${tipY + 2}
              Q ${tipX} ${tipY - 2} ${tipX + tipW / 2} ${tipY + 2}
              Q ${tipX + tipW / 2} ${(pipY + tipY) / 2} ${pipX + midW / 2} ${pipY}
              C ${pipX + midW / 2} ${pipY + 3}, 
                ${mcpX + baseW / 2 + sideOff * 0.5} ${mcpY}, 
                ${mcpX + baseW / 2 + sideOff} ${mcpY + 5}
              Z
            `;
          } else {
            // Regular finger: smooth S-curve from knuckle over and down to key
            fingerPath = `
              M ${mcpX - baseW / 2} ${mcpY + 3}
              C ${mcpX - baseW / 2} ${mcpY - 2}, 
                ${pipX - midW / 2 - 1} ${pipY + 5}, 
                ${pipX - midW / 2} ${pipY}
              C ${(pipX + (dipX || tipX)) / 2 - midW / 2 + 1} ${(pipY + (dipY || tipY)) / 2}, 
                ${tipX - tipW / 2 - 0.5} ${tipY - tipW * 0.2}, 
                ${tipX - tipW / 2} ${tipY + 2}
              Q ${tipX} ${tipY - 2} ${tipX + tipW / 2} ${tipY + 2}
              C ${tipX + tipW / 2 + 0.5} ${tipY - tipW * 0.2}, 
                ${(pipX + (dipX || tipX)) / 2 + midW / 2 - 1} ${(pipY + (dipY || tipY)) / 2}, 
                ${pipX + midW / 2} ${pipY}
              C ${pipX + midW / 2 + 1} ${pipY + 5}, 
                ${mcpX + baseW / 2} ${mcpY - 2}, 
                ${mcpX + baseW / 2} ${mcpY + 3}
              Z
            `;
          }

          return (
            <g key={i}>
              {/* Finger body */}
              <path d={fingerPath} fill={skinBase} stroke={skinStroke} strokeWidth={0.8} />
              
              {/* Knuckle bump at MCP */}
              <ellipse cx={mcpX} cy={mcpY} rx={baseW * 0.32} ry={3}
                fill={skinDarker} stroke={knuckleColor} strokeWidth={0.4} />
              
              {/* PIP joint crease */}
              <line x1={pipX - midW * 0.25} y1={pipY} x2={pipX + midW * 0.25} y2={pipY}
                stroke={knuckleColor} strokeWidth={0.6} strokeLinecap="round" />
              
              {/* DIP joint crease (non-thumb) */}
              {!isThumb && dipX !== undefined && dipY !== undefined && (
                <line x1={dipX - tipW * 0.25} y1={dipY} x2={dipX + tipW * 0.25} y2={dipY}
                  stroke={knuckleColor} strokeWidth={0.5} strokeLinecap="round" />
              )}
              
              {/* Fingertip contact highlight */}
              <ellipse cx={tipX} cy={tipY + 2}
                rx={tipW * 0.3} ry={tipW * 0.12}
                fill={skinDarker} opacity={0.4}
              />
              
              {/* Finger number badge — on the visible top of the finger curve */}
              {(() => {
                const badgeX = (mcpX + pipX) / 2;
                const badgeY = (mcpY + pipY) / 2 - 2;
                return (
                  <>
                    <circle cx={badgeX} cy={badgeY}
                      r={Math.max(5, fw * 0.34)} fill={badgeColor} />
                    <text x={badgeX} y={badgeY + 0.5}
                      textAnchor="middle" dominantBaseline="middle"
                      fill="white" fontSize={Math.max(7, fw * 0.40)}
                      fontFamily="monospace" fontWeight="bold">
                      {fingerNum}
                    </text>
                  </>
                );
              })()}
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
