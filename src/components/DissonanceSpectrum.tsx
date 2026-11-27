import React, { useMemo, useRef } from "react";
import { Note } from "tonal";
import { useHarmonic } from "@/contexts/HarmonicContext";
import { getDisplayNoteLabel, getNoteChroma, getNotePitchClass } from "@/lib/music-engine";
import {
  getPartialsFromNotes,
  calculatePartialInteractions,
  calculateChordDissonance,
  type Partial,
} from "@/lib/overtone-engine";
import {
  calculateChordCoincidence,
  getSolfegeColor,
  getSolfegeContrastText,
  hexToRgba,
  PRIME_FAMILY_COLORS,
  type PrimeLimitFamily,
} from "@/lib/pptConstants";
import { useContainerSize } from "@/hooks/use-container-size";
import { computeSpectrumGeometry } from "@/lib/cell-geometry";

function criticalBandwidth(freq: number): number {
  return 25 + 75 * Math.pow(1 + 1.4 * (freq / 1000) * (freq / 1000), 0.69);
}

const FADE_DURATION = 400;

export const DissonanceSpectrum = React.memo(function DissonanceSpectrum() {
  const { selectedKey, labelMode, useFlats, trailMode, noteStates, activeNotes } = useHarmonic();
  const plotRef = useRef<HTMLDivElement>(null);
  const containerSize = useContainerSize(plotRef, { width: 640, height: 160 });
  const geom = useMemo(
    () => computeSpectrumGeometry(containerSize.width, containerSize.height),
    [containerSize.width, containerSize.height]
  );

  const tonicChroma = useMemo(() => getNoteChroma(selectedKey), [selectedKey]);
  const noteNames = useMemo(() => noteStates.map(s => s.note), [noteStates]);

  const baseMidi = useMemo(() => {
    if (activeNotes.size === 0) return undefined;
    let lowestActive = Infinity;
    activeNotes.forEach(n => { const m = Note.midi(n); if (m !== null && m < lowestActive) lowestActive = m; });
    if (!isFinite(lowestActive)) return undefined;
    let root = lowestActive;
    while (root % 12 !== tonicChroma && root >= 0) root--;
    return root >= 0 ? root : undefined;
  }, [activeNotes, tonicChroma]);

  const pcStates = useMemo(() => {
    const states = new Map<number, { pressed: boolean; fading: boolean }>();
    for (const { note, pressed, fading } of noteStates) {
      const pc = Note.chroma(note);
      if (pc === undefined || pc === null) continue;
      const existing = states.get(pc);
      if (!existing) {
        states.set(pc, { pressed, fading });
      } else {
        if (pressed) existing.pressed = true;
        if (fading) existing.fading = true;
      }
    }
    return states;
  }, [noteStates]);

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

  const coincidence = useMemo(() => {
    const midis = noteNames
      .map(n => Note.midi(n))
      .filter((m): m is number => m !== null)
      .sort((a, b) => a - b);
    if (midis.length < 2) return null;
    const lowest = midis[0];
    const intervals = [...new Set(midis.map(m => m - lowest))];
    return calculateChordCoincidence(intervals);
  }, [noteNames]);

  const primeFamilyKey: PrimeLimitFamily | null = coincidence
    ? coincidence.primeLimit === 2
      ? "2-Du"
      : coincidence.primeLimit === 3
        ? "3-Tri"
        : coincidence.primeLimit === 5
          ? "5-Qui"
          : coincidence.primeLimit === 7
            ? "7-Sep"
            : "11-Undec"
    : null;
  const primeColor = primeFamilyKey ? PRIME_FAMILY_COLORS[primeFamilyKey] : null;

  const minFreq = 28;
  const maxFreq = 5500;
  const logMin = Math.log2(minFreq);
  const logMax = Math.log2(maxFreq);
  const freqToX = (f: number, width: number) =>
    ((Math.log2(f) - logMin) / (logMax - logMin)) * width;

  const { svgWidth, svgHeight, plotTop, plotBottom, plotHeight, subBarW, barGap, badgeR, axisFontSize } = geom;

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
      const items = sorted.map(p => {
        const cx = freqToX(p.frequency, svgWidth);
        const cbHz = criticalBandwidth(p.frequency);
        const xLo = freqToX(Math.max(minFreq, p.frequency - cbHz / 2), svgWidth);
        const xHi = freqToX(p.frequency + cbHz / 2, svgWidth);
        const totalW = Math.max(6, xHi - xLo);
        const peakHeight = p.amplitude * plotHeight * 0.85;
        const numBars = Math.max(3, Math.floor(totalW / (subBarW + barGap)));
        const mid = (numBars - 1) / 2;
        const subBars: { x: number; h: number }[] = [];
        const actualTotalW = numBars * (subBarW + barGap) - barGap;
        for (let j = 0; j < numBars; j++) {
          const dist = mid > 0 ? Math.abs(j - mid) / mid : 0;
          const h = peakHeight * Math.exp(-2.5 * dist * dist);
          const bx = cx - actualTotalW / 2 + j * (subBarW + barGap);
          if (h > 1) subBars.push({ x: bx, h });
        }
        return { cx, height: peakHeight, partial: p, subBars };
      });
      allBars.push({ pc, items });
    }
    return allBars;
  }, [partialsByNote, svgWidth, plotHeight, subBarW, barGap]);

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
  const anyFading = noteStates.some(s => s.fading);

  const findSampleNote = (pc: number) =>
    noteNames.find(n => {
      const m = Note.midi(n);
      return m !== null && m % 12 === pc;
    }) || "";

  return (
    <div className="glass-panel p-3 h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between flex-wrap gap-1.5 sm:gap-2 mb-1.5">
        <h3 className="engineering-label shrink-0">
          <span className="sm:hidden">Overtones</span>
          <span className="hidden sm:inline">Fundamentals &amp; Overtones</span>
        </h3>
        {coincidence && primeFamilyKey && primeColor && (
          <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
            <span
              className="text-[10px] font-mono px-1.5 sm:px-2 py-0.5 rounded bg-secondary/80 border border-border text-foreground"
              title="Just Intonation integer ratio approximation for this voicing"
            >
              JI: <strong className="text-primary">{coincidence.integerRatioString}</strong>
            </span>
            <span
              className="text-[10px] font-mono px-1.5 sm:px-2 py-0.5 rounded bg-secondary/80 border border-border text-muted-foreground"
              title="Prime Period Theory Coincidence Super-Cycle: root periods required for all tones to realign"
            >
              Cycle: <strong className="text-foreground">{coincidence.rootTurnsToAlign}×</strong>
            </span>
            <span
              className="text-[10px] font-mono px-1.5 sm:px-2 py-0.5 rounded font-semibold"
              style={{
                backgroundColor: `${primeColor}22`,
                color: primeColor,
                border: `1px solid ${primeColor}55`,
              }}
              title={`Prime Limit Family (${coincidence.primeLimit}-limit) • Tenney Height: ${coincidence.tenneyHeight}`}
            >
              {coincidence.primeLimit}-Limit ({primeFamilyKey})
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 mb-1.5">
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Crunch</span>
        <span className="text-xs font-mono font-bold text-foreground min-w-[3ch] text-right">
          {hasNotes ? `${Math.round(totalDissonance)}%` : "0%"}
        </span>
        <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${hasNotes ? Math.min(100, totalDissonance) : 0}%`,
              background: "linear-gradient(90deg, hsl(var(--interval-consonant)), hsl(var(--interval-mild)), hsl(var(--interval-dissonant)))",
              transition: trailMode ? `width ${FADE_DURATION}ms ease-out` : "width 300ms ease-out",
            }}
          />
        </div>
      </div>

      <div ref={plotRef} className="w-full flex-1 min-h-0 overflow-hidden">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-full block"
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
              const solid = getSolfegeColor(pc, tonicChroma, { neonFi: true });
              return (
                <linearGradient key={`grad-${pc}`} id={`nn-note-grad-${pc}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={hexToRgba(solid, 0.5)} />
                  <stop offset="100%" stopColor={hexToRgba(solid, 0.03)} />
                </linearGradient>
              );
            })}
          </defs>

          {octaveMarkers.map(m => {
            const x = freqToX(m.freq, svgWidth);
            return (
              <g key={m.label}>
                <line x1={x} y1={plotTop} x2={x} y2={plotBottom} stroke="hsl(var(--border))" strokeWidth={1} strokeDasharray="3,4" />
                <text
                  x={x} y={plotBottom + 14} textAnchor="middle" fontSize={axisFontSize}
                  fontFamily="'JetBrains Mono', monospace" fill="hsl(var(--muted-foreground))"
                >
                  {m.label}
                </text>
              </g>
            );
          })}

          {noteBars.map(({ pc, items }) => {
            const state = pcStates.get(pc);
            const isFading = state?.fading && !state?.pressed;
            const semitoneFromTonic = ((pc - tonicChroma) % 12 + 12) % 12;
            const solid = getSolfegeColor(pc, tonicChroma, { neonFi: true });
            const badgeTextFill = getSolfegeContrastText(semitoneFromTonic, { neonFi: true });
            const sample = findSampleNote(pc);
            const badgeLabel = sample
              ? getDisplayNoteLabel(sample, selectedKey, labelMode, useFlats, baseMidi)
              : "";

            return (
              <g key={`bars-${pc}`}>
                {items.map((bar, i) => {
                  const isFundamental = bar.partial.partialNumber === 1;
                  return (
                    <g key={`b-${pc}-${i}`}>
                      {bar.subBars.map((sb, si) => (
                        <rect
                          key={si}
                          x={sb.x}
                          y={plotBottom - sb.h}
                          width={subBarW}
                          height={sb.h}
                          fill={hexToRgba(solid, isFundamental ? 0.8 : 0.45)}
                          rx={0.5}
                          style={isFading && trailMode ? {
                            transformBox: "fill-box",
                            transformOrigin: "center bottom",
                            animation: `bar-shrink ${FADE_DURATION}ms ease-out forwards`,
                          } : undefined}
                        />
                      ))}
                      {isFundamental && (
                        <>
                          <circle
                            cx={bar.cx} cy={plotTop - badgeR - 2} r={badgeR}
                            fill={hexToRgba(solid, 0.95)}
                            style={isFading && trailMode ? {
                              animation: `note-fade-out ${FADE_DURATION}ms ease-out forwards`,
                            } : undefined}
                          />
                          <text
                            x={bar.cx} y={plotTop - badgeR + 1} textAnchor="middle"
                            fontSize={badgeLabel.length > 2 ? 6.5 : 8}
                            fontFamily="'JetBrains Mono', monospace" fill={badgeTextFill} fontWeight={700}
                            style={isFading && trailMode ? {
                              animation: `note-fade-out ${FADE_DURATION}ms ease-out forwards`,
                            } : undefined}
                          >
                            {badgeLabel}
                          </text>
                        </>
                      )}
                      {!isFundamental && bar.partial.amplitude > 0.35 && (
                        <text
                          x={bar.cx} y={plotBottom - bar.height - 3} textAnchor="middle"
                          fontSize={Math.max(7, Math.min(9, plotHeight * 0.06))}
                          fontFamily="'JetBrains Mono', monospace" fill={hexToRgba(solid, 0.72)}
                        >
                          {bar.partial.partialNumber}×
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}

          {dissonancePath.fill && (
            <g style={anyFading && !hasNotes ? { animation: `note-fade-out ${FADE_DURATION}ms ease-out forwards` } : undefined}>
              <path d={dissonancePath.fill} fill="url(#nn-dissonance-curve-fill)" />
              <path d={dissonancePath.line} fill="none" stroke="hsla(0, 0%, 95%, 0.7)" strokeWidth={1.2} />
            </g>
          )}

          <line x1={0} y1={plotBottom} x2={svgWidth} y2={plotBottom} stroke="hsl(var(--border))" strokeWidth={1} />
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[9px] font-mono text-muted-foreground mt-1.5 min-h-4 shrink-0">
        {activePitchClasses.map(pc => {
          const sample = findSampleNote(pc);
          const solid = getSolfegeColor(pc, tonicChroma, { neonFi: true });
          const display = sample ? getDisplayNoteLabel(sample, selectedKey, labelMode, useFlats, baseMidi) : "";
          const pitch = sample ? getNotePitchClass(sample, useFlats) : "";
          return (
            <div key={pc} className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: solid }} />
              <span>{display !== pitch ? `${display} (${pitch})` : pitch}</span>
            </div>
          );
        })}
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
