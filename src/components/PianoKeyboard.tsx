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

// Realistic hand overlay with proper fingertip placement, knuckle bumps, and forearm
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
  
  const skinBase = isLeft ? "rgba(59, 130, 246, 0.16)" : "rgba(239, 68, 68, 0.16)";
  const skinDarker = isLeft ? "rgba(59, 130, 246, 0.22)" : "rgba(239, 68, 68, 0.22)";
  const skinStroke = isLeft ? "rgba(59, 130, 246, 0.35)" : "rgba(239, 68, 68, 0.35)";
  const nailColor = isLeft ? "rgba(59, 130, 246, 0.06)" : "rgba(239, 68, 68, 0.06)";
  const knuckleColor = isLeft ? "rgba(59, 130, 246, 0.3)" : "rgba(239, 68, 68, 0.3)";
  const badgeColor = isLeft ? "rgba(59, 130, 246, 0.8)" : "rgba(239, 68, 68, 0.8)";

  const anatomy: Record<number, { widthRatio: number; lengthPct: number }> = {
    1: { widthRatio: 0.82, lengthPct: 0.28 },
    2: { widthRatio: 0.52, lengthPct: 0.48 },
    3: { widthRatio: 0.50, lengthPct: 0.54 },
    4: { widthRatio: 0.48, lengthPct: 0.46 },
    5: { widthRatio: 0.42, lengthPct: 0.36 },
  };

  // Best-practice fingertip placement: white keys at ~75% down, black keys at center (~30%)
  const whiteTipY = containerHeight * 0.75;
  const blackTipY = containerHeight * 0.30;

  // Palm + wrist + forearm
  const palmLeft = points[0].xPx - keyW * 1.0;
  const palmRight = points[points.length - 1].xPx + keyW * 1.0;
  const palmTop = containerHeight * 0.88;
  const palmBottom = containerHeight + 20;
  const palmCX = (palmLeft + palmRight) / 2;
  const palmW = palmRight - palmLeft;
  const wristW = palmW * 0.55;
  const wristTop = palmBottom;
  const wristBottom = containerHeight + 65;
  const forearmW = palmW * 0.50;
  const forearmBottom = containerHeight + 120;

  const handPath = `
    M ${palmLeft + 4} ${palmTop}
    Q ${palmLeft - 2} ${palmTop + 12} ${palmLeft} ${(palmTop + palmBottom) / 2}
    Q ${palmLeft + 2} ${palmBottom - 3} ${palmCX - wristW / 2} ${wristTop}
    Q ${palmCX - wristW / 2 - 2} ${(wristTop + wristBottom) / 2} ${palmCX - forearmW / 2} ${wristBottom}
    L ${palmCX - forearmW / 2} ${forearmBottom}
    Q ${palmCX} ${forearmBottom + 8} ${palmCX + forearmW / 2} ${forearmBottom}
    L ${palmCX + forearmW / 2} ${wristBottom}
    Q ${palmCX + wristW / 2 + 2} ${(wristTop + wristBottom) / 2} ${palmCX + wristW / 2} ${wristTop}
    Q ${palmRight - 2} ${palmBottom - 3} ${palmRight} ${(palmTop + palmBottom) / 2}
    Q ${palmRight + 2} ${palmTop + 12} ${palmRight - 4} ${palmTop}
    Z
  `;

  const wristCreaseY1 = wristTop + 4;
  const wristCreaseY2 = wristTop + 10;

  return (
    <svg 
      className="absolute inset-0 pointer-events-none" 
      style={{ zIndex: 10, overflow: "visible" }}
      width={containerWidth} 
      height={containerHeight}
    >
      <defs>
        <filter id={`hand-shadow-${isLeft ? 'l' : 'r'}`}>
          <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor={isLeft ? "rgba(59,130,246,0.12)" : "rgba(239,68,68,0.12)"} />
        </filter>
      </defs>

      <g filter={`url(#hand-shadow-${isLeft ? 'l' : 'r'})`}>
        <path d={handPath} fill={skinBase} stroke={skinStroke} strokeWidth={1} />
        
        {/* Wrist creases */}
        <line x1={palmCX - wristW * 0.3} y1={wristCreaseY1} x2={palmCX + wristW * 0.3} y2={wristCreaseY1}
          stroke={knuckleColor} strokeWidth={0.7} strokeLinecap="round" />
        <line x1={palmCX - wristW * 0.25} y1={wristCreaseY2} x2={palmCX + wristW * 0.25} y2={wristCreaseY2}
          stroke={knuckleColor} strokeWidth={0.5} strokeLinecap="round" />

        {/* Knuckle bumps + tendon lines on back of hand */}
        {points.map((pt, idx) => (
          <g key={`meta-${idx}`}>
            <ellipse cx={pt.xPx} cy={palmTop - 1} rx={keyW * 0.22} ry={3}
              fill={skinDarker} stroke={knuckleColor} strokeWidth={0.5} />
            <line x1={pt.xPx} y1={palmTop + 5} x2={pt.xPx} y2={palmTop + (palmBottom - palmTop) * 0.5}
              stroke={knuckleColor} strokeWidth={0.4} strokeLinecap="round" />
          </g>
        ))}
        
        {/* Fingers */}
        {points.map((pt, i) => {
          const fingerNum = sorted[i].finger;
          const isThumb = fingerNum === 1;
          const { widthRatio } = anatomy[fingerNum] || anatomy[3];
          
          const fw = keyW * widthRatio;
          const baseY = palmTop;
          const targetTipY = pt.isBlack ? blackTipY : whiteTipY;
          
          const splay = (i - (points.length - 1) / 2) * 1.8;
          const tipX = pt.xPx + splay;
          
          const baseW = fw * (isThumb ? 1.15 : 1.0);
          const midW = fw * (isThumb ? 1.0 : 0.88);
          const tipW = fw * (isThumb ? 0.85 : 0.72);
          
          const totalLen = baseY - targetTipY;
          const seg1Y = baseY - totalLen * (isThumb ? 0.45 : 0.35);
          const seg2Y = baseY - totalLen * (isThumb ? 0.75 : 0.62);
          const seg3Y = isThumb ? undefined : baseY - totalLen * 0.82;
          
          let fingerPath: string;
          
          if (isThumb) {
            const thumbOff = isLeft ? -2 : 2;
            const tx = tipX + thumbOff;
            fingerPath = `
              M ${pt.xPx - baseW / 2} ${baseY}
              C ${pt.xPx - baseW / 2 - 1} ${seg1Y + 5}, ${tx - midW / 2 - 2} ${seg1Y}, ${tx - midW / 2} ${seg2Y}
              Q ${tx - tipW / 2} ${targetTipY + 3} ${tx} ${targetTipY}
              Q ${tx + tipW / 2} ${targetTipY + 3} ${tx + midW / 2} ${seg2Y}
              C ${tx + midW / 2 + 2} ${seg1Y}, ${pt.xPx + baseW / 2 + 1} ${seg1Y + 5}, ${pt.xPx + baseW / 2} ${baseY}
              Z
            `;
          } else {
            fingerPath = `
              M ${pt.xPx - baseW / 2} ${baseY}
              C ${pt.xPx - baseW / 2 - 0.5} ${seg1Y + 4}, ${tipX - midW / 2 - 0.5} ${seg1Y}, ${tipX - midW / 2} ${seg2Y}
              C ${tipX - midW / 2 + 0.3} ${seg3Y! + 2}, ${tipX - tipW / 2 - 0.3} ${seg3Y!}, ${tipX - tipW / 2} ${targetTipY + tipW * 0.3}
              Q ${tipX - tipW / 3} ${targetTipY - 1} ${tipX} ${targetTipY}
              Q ${tipX + tipW / 3} ${targetTipY - 1} ${tipX + tipW / 2} ${targetTipY + tipW * 0.3}
              C ${tipX + tipW / 2 + 0.3} ${seg3Y!}, ${tipX + midW / 2 - 0.3} ${seg3Y! + 2}, ${tipX + midW / 2} ${seg2Y}
              C ${tipX + midW / 2 + 0.5} ${seg1Y}, ${pt.xPx + baseW / 2 + 0.5} ${seg1Y + 4}, ${pt.xPx + baseW / 2} ${baseY}
              Z
            `;
          }

          const nailW = tipW * 0.6;
          const nailH = tipW * (isThumb ? 0.32 : 0.24);

          return (
            <g key={i}>
              <path d={fingerPath} fill={skinBase} stroke={skinStroke} strokeWidth={0.8} />
              
              {/* Fingernail */}
              <ellipse
                cx={tipX + (isThumb ? (isLeft ? -1 : 1) : 0)}
                cy={targetTipY + tipW * 0.15}
                rx={nailW / 2} ry={nailH}
                fill={nailColor} stroke={skinStroke} strokeWidth={0.4}
              />
              
              {/* Fingertip contact pad */}
              <ellipse cx={tipX} cy={targetTipY + tipW * 0.35}
                rx={tipW * 0.3} ry={tipW * 0.15}
                fill={skinDarker} opacity={0.5}
              />
              
              {/* MCP knuckle bump */}
              <ellipse
                cx={tipX + (isThumb ? (isLeft ? -0.5 : 0.5) : 0)}
                cy={seg1Y} rx={midW * 0.28} ry={2.5}
                fill={skinDarker}
              />
              
              {/* PIP/IP joint */}
              <line x1={tipX - midW * 0.25} y1={seg2Y} x2={tipX + midW * 0.25} y2={seg2Y}
                stroke={knuckleColor} strokeWidth={0.7} strokeLinecap="round" />
              
              {/* DIP joint (non-thumb) */}
              {!isThumb && seg3Y !== undefined && (
                <line x1={tipX - tipW * 0.28} y1={seg3Y} x2={tipX + tipW * 0.28} y2={seg3Y}
                  stroke={knuckleColor} strokeWidth={0.5} strokeLinecap="round" />
              )}
              
              {/* Finger number badge */}
              <circle cx={tipX} cy={(seg1Y + seg2Y) / 2}
                r={Math.max(5.5, fw * 0.36)} fill={badgeColor} />
              <text x={tipX} y={(seg1Y + seg2Y) / 2 + 0.5}
                textAnchor="middle" dominantBaseline="middle"
                fill="white" fontSize={Math.max(7, fw * 0.42)}
                fontFamily="monospace" fontWeight="bold">
                {fingerNum}
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
