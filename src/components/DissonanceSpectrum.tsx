import React, { useMemo, useEffect, useState } from "react";
import { Note } from "tonal";
import { useHarmonic } from "@/contexts/HarmonicContext";
import { getNotePitchClass, NOTE_COLOR_KEYS, NOTE_NAMES } from "@/lib/music-engine";
import {
  getPartialsFromNotes,
  calculatePartialInteractions,
  calculateChordDissonance,
  type Partial,
} from "@/lib/overtone-engine";

// Map chroma (0-11) to CSS custom property names
const CHROMA_CSS_PROPS: string[] = [
  "--note-c", "--note-cs", "--note-d", "--note-ds",
  "--note-e", "--note-f", "--note-fs", "--note-g",
  "--note-gs", "--note-a", "--note-as", "--note-b",
];

// Resolve CSS variable HSL values to actual color strings at runtime
function resolveNoteColors(): string[] {
  const style = getComputedStyle(document.documentElement);
  return CHROMA_CSS_PROPS.map(prop => {
    const val = style.getPropertyValue(prop).trim();
    return val || "0 0% 50%";
  });
}

function noteColor(resolved: string[], pc: number, alpha = 0.85): string {
  return `hsla(${resolved[pc % 12].replace(/ /g, ", ")}, ${alpha})`;
}

function noteColorSolid(resolved: string[], pc: number): string {
  return `hsl(${resolved[pc % 12].replace(/ /g, ", ")})`;
}

function criticalBandwidth(freq: number): number {
  return 25 + 75 * Math.pow(1 + 1.4 * (freq / 1000) * (freq / 1000), 0.69);
}

const SUB_BAR_W = 2;
const BAR_GAP = 1;

export const DissonanceSpectrum = React.memo(function DissonanceSpectrum() {
  const { useFlats, trailMode, visualNotes, getNoteIntensity } = useHarmonic();
  const [resolvedColors, setResolvedColors] = useState<string[]>(() => resolveNoteColors());
  useEffect(() => { setResolvedColors(resolveNoteColors()); }, []);

  const noteNames = useMemo(() => visualNotes, [visualNotes]);

  const pcIntensity = useMemo(() => {
    const arr = new Array(12).fill(0) as number[];
    for (const n of noteNames) {
      const pc = Note.chroma(n);
      if (pc === undefined || pc === null) continue;
      const intensity = getNoteIntensity(n);
      if (intensity > arr[pc]) arr[pc] = intensity;
    }
    return arr;
  }, [noteNames, getNoteIntensity]);

  const overallIntensity = useMemo(
    () => pcIntensity.reduce((m, v) => Math.max(m, v), 0),
    [pcIntensity]
  );

  const { partials, noteFrequencies } = useMemo(
    () => getPartialsFromNotes(noteNames),
    [noteNames]
  );

  const activePitchClasses = useMemo(
    () => [...new Set(noteFrequencies.map(n => n.pc))],
    [noteFrequencies]
  );

  const interactions = useMemo(
    () => calculatePartialInteractions(noteFrequencies),
    [noteFrequencies]
  );

  const totalDissonance = useMemo(
    () => calculateChordDissonance(noteFrequencies.map(n => n.freq)),
    [noteFrequencies]
  );

  const minFreq = 28;
  const maxFreq = 5500;
  const logMin = Math.log2(minFreq);
  const logMax = Math.log2(maxFreq);
  const freqToX = (f: number, width: number) =>
    ((Math.log2(f) - logMin) / (logMax - logMin)) * width;

  const svgWidth = 900;
  const svgHeight = 150;
  const plotTop = 18;
  const plotBottom = 125;
  const plotHeight = plotBottom - plotTop;

  const octaveMarkers = useMemo(() => {
    const markers: { freq: number; label: string }[] = [];
    for (let oct = 1; oct <= 8; oct++) {
      const freq = 440 * Math.pow(2, (oct - 4) + (0 - 9) / 12);
      if (freq >= minFreq && freq <= maxFreq) {
        markers.push({ freq, label: `C${oct}` });
      }
    }
    return markers;
  }, []);

  const partialsByNote = useMemo(() => {
    const map = new Map<number, Partial[]>();
    for (const p of partials) {
      const arr = map.get(p.fundamentalPc) || [];
      arr.push(p);
      map.set(p.fundamentalPc, arr);
    }
    return map;
  }, [partials]);

  const noteBars = useMemo(() => {
    const allBars: { pc: number; items: { cx: number; height: number; partial: Partial; subBars: { x: number; h: number }[] }[] }[] = [];
    for (const [pc, notePartials] of partialsByNote.entries()) {
      const sorted = [...notePartials].sort((a, b) => a.frequency - b.frequency);
      const intensity = pcIntensity[pc] ?? 1;
      const items = sorted.map(p => {
        const cx = freqToX(p.frequency, svgWidth);
        const cbHz = criticalBandwidth(p.frequency);
        const xLo = freqToX(Math.max(minFreq, p.frequency - cbHz / 2), svgWidth);
        const xHi = freqToX(p.frequency + cbHz / 2, svgWidth);
        const totalW = Math.max(6, xHi - xLo);
        const peakHeight = p.amplitude * intensity * plotHeight * 0.85;
        const numBars = Math.max(3, Math.floor(totalW / (SUB_BAR_W + BAR_GAP)));
        const mid = (numBars - 1) / 2;
        const subBars: { x: number; h: number }[] = [];
        const actualTotalW = numBars * (SUB_BAR_W + BAR_GAP) - BAR_GAP;
        for (let j = 0; j < numBars; j++) {
          const dist = mid > 0 ? Math.abs(j - mid) / mid : 0;
          const h = peakHeight * Math.exp(-2.5 * dist * dist);
          const bx = cx - actualTotalW / 2 + j * (SUB_BAR_W + BAR_GAP);
          if (h > 1) subBars.push({ x: bx, h });
        }
        return { cx, height: peakHeight, partial: p, subBars };
      });
      allBars.push({ pc, items });
    }
    return allBars;
  }, [partialsByNote, pcIntensity, svgWidth, plotHeight]);

  const dissonancePath = useMemo(() => {
    if (interactions.length === 0) return { line: "", fill: "", peak: 0 };
    const numBins = svgWidth;
    const bins = new Float32Array(numBins);
    for (const pair of interactions) {
      if (pair.dissonance < 0.05) continue;
      const f1 = Math.min(pair.partial1.frequency, pair.partial2.frequency);
      const f2 = Math.max(pair.partial1.frequency, pair.partial2.frequency);
      const fMid = (f1 + f2) / 2;
      const xMid = freqToX(fMid, svgWidth);
      const xSpread = Math.max(4, Math.abs(freqToX(f2, svgWidth) - freqToX(f1, svgWidth)) * 0.6);
      const sigma = Math.max(3, xSpread);
      for (let bx = Math.max(0, Math.floor(xMid - sigma * 3)); bx < Math.min(numBins, Math.ceil(xMid + sigma * 3)); bx++) {
        const dx = bx - xMid;
        bins[bx] += pair.dissonance * Math.exp(-(dx * dx) / (2 * sigma * sigma));
      }
    }
    let peak = 0;
    for (let i = 0; i < numBins; i++) { if (bins[i] > peak) peak = bins[i]; }
    if (peak === 0) return { line: "", fill: "", peak: 0 };
    const maxH = plotHeight * 0.7;
    const points: string[] = [];
    for (let x = 0; x < numBins; x++) {
      const h = (bins[x] / peak) * maxH;
      const y = plotBottom - h;
      points.push(`${x},${y.toFixed(1)}`);
    }
    const line = `M${points.join(" L")}`;
    const fill = `${line} L${numBins - 1},${plotBottom} L0,${plotBottom} Z`;
    return { line, fill, peak };
  }, [interactions, svgWidth, plotHeight, plotBottom]);

  const hasNotes = noteNames.length > 0;

  return (
    <div className="glass-panel p-4 h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 mb-3">
        <h3 className="engineering-label shrink-0">Fundamentals &amp; Overtones ·</h3>
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Crunch</span>
        <span className="text-xs font-mono font-bold text-foreground min-w-[3ch] text-right">{hasNotes ? `${Math.round(totalDissonance)}%` : "0%"}</span>
        <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
          <div
          className="h-full rounded-full"
            style={{
              width: `${hasNotes ? Math.min(100, totalDissonance) : 0}%`,
              background: `linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)), hsl(var(--destructive)))`,
              transition: trailMode ? 'width 800ms ease-out' : 'width 300ms ease-out',
            }}
          />
        </div>
      </div>

      <div className="overflow-x-auto w-full flex-1 min-h-0">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full"
          style={{ minWidth: 500 }}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Dissonance spectrum showing fundamentals, overtones, and roughness curve"
        >
          <defs>
            <linearGradient id="nn-dissonance-curve-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(0, 0%, 100%)" stopOpacity="0.15" />
              <stop offset="100%" stopColor="hsl(0, 0%, 100%)" stopOpacity="0.02" />
            </linearGradient>
            {activePitchClasses.map(pc => {
              const solid = noteColorSolid(resolvedColors, pc);
              return (
                <linearGradient key={`grad-${pc}`} id={`nn-note-grad-${pc}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={solid} stopOpacity="0.5" />
                  <stop offset="100%" stopColor={solid} stopOpacity="0.03" />
                </linearGradient>
              );
            })}
          </defs>

          {octaveMarkers.map(m => {
            const x = freqToX(m.freq, svgWidth);
            return (
              <g key={m.label}>
                <line x1={x} y1={plotTop} x2={x} y2={plotBottom} stroke="hsl(var(--border))" strokeWidth={1} strokeDasharray="3,4" />
                <text x={x} y={plotBottom + 14} textAnchor="middle" fontSize={9}
                  fontFamily="'JetBrains Mono', monospace" fill="hsl(var(--muted-foreground))"
                >{m.label}</text>
              </g>
            );
          })}

          {noteBars.map(({ pc, items }) => (
            <g key={`bars-${pc}`}>
              {items.map((bar, i) => {
                const isFundamental = bar.partial.partialNumber === 1;
                return (
                   <g key={`b-${pc}-${i}`}>
                     {bar.subBars.map((sb, si) => (
                       <rect key={si} x={sb.x} y={plotBottom - sb.h} width={SUB_BAR_W} height={sb.h}
                         fill={noteColor(resolvedColors, pc, isFundamental ? 0.7 : 0.4)} rx={0.5}
                         style={trailMode ? { transition: 'height 600ms ease-out, opacity 600ms ease-out' } : undefined}
                       />
                    ))}
                    {isFundamental && (
                      <>
                        <circle cx={bar.cx} cy={plotTop - 6} r={7} fill={noteColorSolid(resolvedColors, pc)} opacity={0.9} />
                        <text x={bar.cx} y={plotTop - 3} textAnchor="middle" fontSize={7.5}
                          fontFamily="'JetBrains Mono', monospace" fill="hsl(var(--background))" fontWeight={700}
                        >{getNotePitchClass(bar.partial.fundamentalFreq > 0 ? noteNames.find(n => {
                          const m = Note.midi(n);
                          return m !== null && m % 12 === pc;
                        }) || "" : "", useFlats)}</text>
                      </>
                    )}
                    {!isFundamental && bar.partial.amplitude > 0.35 && (
                      <text x={bar.cx} y={plotBottom - bar.height - 3} textAnchor="middle" fontSize={6}
                        fontFamily="'JetBrains Mono', monospace" fill={noteColor(resolvedColors, pc, 0.6)}
                      >{bar.partial.partialNumber}×</text>
                    )}
                  </g>
                );
              })}
            </g>
          ))}

          {dissonancePath.fill && (
            <>
              <path d={dissonancePath.fill} fill="url(#nn-dissonance-curve-fill)" />
              <path d={dissonancePath.line} fill="none" stroke="hsla(0, 0%, 95%, 0.7)" strokeWidth={1.2} />
            </>
          )}

          <line x1={0} y1={plotBottom} x2={svgWidth} y2={plotBottom} stroke="hsl(var(--border))" strokeWidth={1} />
        </svg>
      </div>

      
      <div className="flex flex-wrap items-center gap-3 text-[9px] font-mono text-muted-foreground mt-2 h-4">
        {activePitchClasses.map(pc => (
          <div key={pc} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: noteColorSolid(resolvedColors, pc) }} />
            <span>{getNotePitchClass(noteNames.find(n => {
              const m = Note.midi(n);
              return m !== null && m % 12 === pc;
            }) || "", useFlats)}</span>
          </div>
        ))}
        <div className="flex items-center gap-1 ml-auto">
          <span className="w-4 h-px" style={{ background: "hsla(0, 0%, 95%, 0.7)" }} />
          <span>Crunch</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-px border-t border-dashed border-muted-foreground" />
          <span>Octave</span>
        </div>
      </div>
    </div>
  );
});
