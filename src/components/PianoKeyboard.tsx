import { useHarmonic } from "@/contexts/HarmonicContext";
import {
  PIANO_KEYS,
  getDisplayNoteLabel,
  getNoteChroma,
} from "@/lib/music-engine";
import {
  encodePianoTriangles,
  getSolfegeColor,
  getSolfegeContrastText,
  PIANO_RANGE_PRESETS,
  PIANO_TRIANGLE_META,
  type PianoTriangleType,
} from "@/lib/pptConstants";
import { createOnsetFromNotes } from "@/lib/phrase-model";
import { solvePianoPhraseFingering } from "@/lib/piano-fingering";
import { Note } from "tonal";
import { useCallback, useRef, useMemo, useState, useEffect, type MouseEvent } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useContainerSize } from "@/hooks/use-container-size";

const FADE_DURATION = 850;

export function PianoKeyboard() {
  const {
    activeNotes, overlayNotes, toggleNote, playNote, isNoteInCurrentScale, isKeyLocked,
    selectedKey, labelMode, useFlats, trailMode, isNoteVisible, isNotePressed, isNoteFading,
    showPianoTriangles, setShowPianoTriangles,
    phraseMode, phraseOnsets, activeStepIndex, nextStepIndex, loopPhrase, nextOnsetNotes,
    showFingering, showNextPreview, pianoComfortSpan,
    setPianoFingerOverride, clearPianoFingerOverride,
  } = useHarmonic();
  const isMobile = useIsMobile();
  const [rangeId, setRangeId] = useState<string>(() =>
    typeof window !== "undefined" && window.innerWidth < 768 ? "25-key" : "49-key"
  );
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerSize = useContainerSize(scrollRef, { width: 340, height: 150 });

  const rangePreset = useMemo(
    () => PIANO_RANGE_PRESETS.find(p => p.id === rangeId) ?? PIANO_RANGE_PRESETS[2],
    [rangeId]
  );

  const visibleKeys = useMemo(
    () => PIANO_KEYS.filter(k => k.midi >= rangePreset.startMidi && k.midi <= rangePreset.endMidi),
    [rangePreset]
  );
  const visibleWhiteKeys = useMemo(() => visibleKeys.filter(k => !k.isBlack), [visibleKeys]);
  const visibleBlackKeys = useMemo(() => visibleKeys.filter(k => k.isBlack), [visibleKeys]);
  const numWhite = visibleWhiteKeys.length;
  const whiteKeyPct = 100 / Math.max(1, numWhite);
  const minWhiteKeyPx = isMobile ? 22 : 16;
  const requiredTrackWidth = numWhite * minWhiteKeyPx;
  const shouldScroll = requiredTrackWidth > containerSize.width;
  const effectiveWhiteKeyPx = Math.max(containerSize.width, requiredTrackWidth) / Math.max(1, numWhite);
  const isCompact = effectiveWhiteKeyPx < 26;

  // Auto-centre around C4 when switching to a scrollable keyboard range
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !shouldScroll) return;
    const c4Idx = visibleWhiteKeys.findIndex(k => k.midi === 60);
    if (c4Idx === -1) return;
    const frame = window.requestAnimationFrame(() => {
      const targetCenter = ((c4Idx + 0.5) / numWhite) * el.scrollWidth;
      el.scrollLeft = Math.max(0, Math.round(targetCenter - el.clientWidth / 2));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [rangeId, shouldScroll, visibleWhiteKeys, numWhite]);

  const tonicChroma = useMemo(() => getNoteChroma(selectedKey), [selectedKey]);

  const baseMidi = useMemo(() => {
    if (activeNotes.size === 0) return undefined;
    let lowestActive = Infinity;
    activeNotes.forEach(n => { const m = Note.midi(n); if (m !== null && m < lowestActive) lowestActive = m; });
    if (!isFinite(lowestActive)) return undefined;
    let root = lowestActive;
    while (root % 12 !== tonicChroma && root >= 0) root--;
    return root >= 0 ? root : undefined;
  }, [activeNotes, tonicChroma]);

  const activeMidisSorted = useMemo(() => {
    const midis: number[] = [];
    activeNotes.forEach(n => {
      const m = Note.midi(n);
      if (m !== null) midis.push(m);
    });
    return midis.sort((a, b) => a - b);
  }, [activeNotes]);

  const activeMidiSet = useMemo(() => new Set(activeMidisSorted), [activeMidisSorted]);
  const triangleEncoding = useMemo(() => encodePianoTriangles(activeMidisSorted), [activeMidisSorted]);

  const effectiveOnsets = useMemo(
    () => (phraseMode ? phraseOnsets : [createOnsetFromNotes(Array.from(activeNotes))]),
    [phraseMode, phraseOnsets, activeNotes]
  );

  const solvedFingerings = useMemo(
    () =>
      showFingering
        ? solvePianoPhraseFingering(effectiveOnsets, {
            loop: loopPhrase,
            maxComfortSpan: pianoComfortSpan,
          })
        : [],
    [showFingering, effectiveOnsets, loopPhrase, pianoComfortSpan]
  );

  const activeFingerMap = useMemo(() => {
    const map = new Map<string, { hand: "L" | "R"; finger: 1 | 2 | 3 | 4 | 5; isAnchor?: boolean }>();
    const list = solvedFingerings[phraseMode ? activeStepIndex : 0] ?? [];
    for (const f of list) map.set(f.note, { hand: f.hand, finger: f.finger, isAnchor: f.isAnchor });
    return map;
  }, [solvedFingerings, phraseMode, activeStepIndex]);

  const nextFingerMap = useMemo(() => {
    const map = new Map<string, { hand: "L" | "R"; finger: 1 | 2 | 3 | 4 | 5 }>();
    if (!phraseMode || !showFingering || nextStepIndex === null) return map;
    const list = solvedFingerings[nextStepIndex] ?? [];
    for (const f of list) map.set(f.note, { hand: f.hand, finger: f.finger });
    return map;
  }, [solvedFingerings, phraseMode, showFingering, nextStepIndex]);

  const handleKeyClick = useCallback((note: string, e: MouseEvent) => {
    if (e.altKey && showFingering && phraseMode && activeNotes.has(note)) {
      e.stopPropagation();
      const cur = activeFingerMap.get(note);
      const nextFinger = cur ? (((cur.finger % 5) + 1) as 1 | 2 | 3 | 4 | 5) : 1;
      setPianoFingerOverride(activeStepIndex, note, {
        hand: cur?.hand ?? ((Note.midi(note) ?? 60) >= 60 ? "R" : "L"),
        finger: nextFinger,
      });
      return;
    }
    playNote(note);
    toggleNote(note);
  }, [playNote, toggleNote, showFingering, phraseMode, activeNotes, activeFingerMap, setPianoFingerOverride, activeStepIndex]);

  const whiteIndexByMidi = useMemo(() => {
    const map = new Map<number, number>();
    visibleWhiteKeys.forEach((wk, idx) => {
      map.set(wk.midi, idx);
    });
    return map;
  }, [visibleWhiteKeys]);

  const keyCenterPctByMidi = useMemo(() => {
    const map = new Map<number, number>();
    visibleWhiteKeys.forEach((wk, idx) => {
      map.set(wk.midi, (idx + 0.5) * whiteKeyPct);
    });
    visibleBlackKeys.forEach((bk) => {
      const prevWhiteIdx = visibleWhiteKeys.findIndex(w => w.midi > bk.midi) - 1;
      if (prevWhiteIdx >= 0) {
        map.set(bk.midi, (prevWhiteIdx + 0.95) * whiteKeyPct);
      }
    });
    return map;
  }, [visibleWhiteKeys, visibleBlackKeys, whiteKeyPct]);

  const showTopGutter = showFingering && phraseMode;
  const showBottomGutter = phraseMode && showNextPreview;

  const triangleOverlays = useMemo(() => {
    if (!showPianoTriangles) return [];
    const instances: {
      id: string;
      type: PianoTriangleType;
      color: string;
      pts: { midi: number; xPct: number; yPct: number; active: boolean; ptNum: number }[];
    }[] = [];

    const Y_BLACK = 32;
    const Y_WHITE = 76;

    const specs: {
      offset: number;
      type: PianoTriangleType;
      computeCoords: (m1: number, m2: number, m3: number) => [{ xPct: number; yPct: number }, { xPct: number; yPct: number }, { xPct: number; yPct: number }] | null;
    }[] = [
      {
        offset: 1,
        type: "D",
        computeCoords: (_m1, m2) => {
          const dIdx = whiteIndexByMidi.get(m2);
          if (dIdx === undefined) return null;
          return [
            { xPct: dIdx * whiteKeyPct, yPct: Y_BLACK },
            { xPct: (dIdx + 0.5) * whiteKeyPct, yPct: Y_WHITE },
            { xPct: (dIdx + 1.0) * whiteKeyPct, yPct: Y_BLACK },
          ];
        },
      },
      {
        offset: 4,
        type: "L",
        computeCoords: (m1, m2) => {
          const eIdx = whiteIndexByMidi.get(m1);
          const fIdx = whiteIndexByMidi.get(m2);
          if (eIdx === undefined || fIdx === undefined) return null;
          return [
            { xPct: (eIdx + 0.5) * whiteKeyPct, yPct: Y_WHITE },
            { xPct: (fIdx + 0.85) * whiteKeyPct, yPct: Y_WHITE },
            { xPct: (fIdx + 0.85) * whiteKeyPct, yPct: Y_BLACK },
          ];
        },
      },
      {
        offset: 7,
        type: "U",
        computeCoords: (m1, _m2, m3) => {
          const gIdx = whiteIndexByMidi.get(m1);
          const aIdx = whiteIndexByMidi.get(m3);
          if (gIdx === undefined || aIdx === undefined) return null;
          return [
            { xPct: (gIdx + 0.5) * whiteKeyPct, yPct: Y_WHITE },
            { xPct: (gIdx + 1.0) * whiteKeyPct, yPct: Y_BLACK },
            { xPct: (aIdx + 0.5) * whiteKeyPct, yPct: Y_WHITE },
          ];
        },
      },
      {
        offset: 10,
        type: "R",
        computeCoords: (_m1, m2, m3) => {
          const bIdx = whiteIndexByMidi.get(m2);
          const cIdx = whiteIndexByMidi.get(m3);
          if (bIdx === undefined || cIdx === undefined) return null;
          return [
            { xPct: (bIdx + 0.15) * whiteKeyPct, yPct: Y_BLACK },
            { xPct: (bIdx + 0.15) * whiteKeyPct, yPct: Y_WHITE },
            { xPct: (cIdx + 0.5) * whiteKeyPct, yPct: Y_WHITE },
          ];
        },
      },
    ];

    for (let base = 0; base <= rangePreset.endMidi; base += 12) {
      for (const sp of specs) {
        const m1 = base + sp.offset;
        const m2 = m1 + 1;
        const m3 = m1 + 2;
        if (m1 < rangePreset.startMidi || m3 > rangePreset.endMidi) continue;
        const coords = sp.computeCoords(m1, m2, m3);
        if (!coords) continue;

        instances.push({
          id: `${sp.type}-${m1}`,
          type: sp.type,
          color: PIANO_TRIANGLE_META[sp.type].color,
          pts: [
            { midi: m1, xPct: coords[0].xPct, yPct: coords[0].yPct, active: activeMidiSet.has(m1), ptNum: 1 },
            { midi: m2, xPct: coords[1].xPct, yPct: coords[1].yPct, active: activeMidiSet.has(m2), ptNum: 2 },
            { midi: m3, xPct: coords[2].xPct, yPct: coords[2].yPct, active: activeMidiSet.has(m3), ptNum: 3 },
          ],
        });
      }
    }
    return instances;
  }, [showPianoTriangles, whiteIndexByMidi, whiteKeyPct, rangePreset, activeMidiSet]);

  return (
    <div className="glass-panel p-3 h-full flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="engineering-label">
            Piano<span className="hidden sm:inline"> · {rangePreset.rangeLabel}</span>
          </h3>
          <div className="flex items-center gap-0.5 bg-secondary/70 p-0.5 rounded-md border border-border">
            {PIANO_RANGE_PRESETS.map(preset => {
              const selected = preset.id === rangePreset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setRangeId(preset.id)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                    selected
                      ? "bg-primary/20 text-primary font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title={preset.name}
                >
                  {preset.shortName}
                </button>
              );
            })}
          </div>
          {triangleEncoding && (
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded bg-secondary border border-border text-primary font-semibold"
              title="PPT Piano Triangle Voicing Encoding (D=Down, L=Left, U=Up, R=Right)"
            >
              △ {triangleEncoding}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {showFingering && phraseMode && editingNote && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-primary/50 bg-secondary text-[10px] font-mono">
              <span className="text-primary font-bold">{editingNote}:</span>
              {(["L", "R"] as const).map(h => {
                const cur = activeFingerMap.get(editingNote);
                const isCur = cur?.hand === h;
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() =>
                      setPianoFingerOverride(activeStepIndex, editingNote, {
                        hand: h,
                        finger: cur?.finger ?? 1,
                      })
                    }
                    className={`px-1 rounded ${isCur ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {h}
                  </button>
                );
              })}
              {([1, 2, 3, 4, 5] as const).map(f => {
                const cur = activeFingerMap.get(editingNote);
                const isCur = cur?.finger === f;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() =>
                      setPianoFingerOverride(activeStepIndex, editingNote, {
                        hand: cur?.hand ?? ((Note.midi(editingNote) ?? 60) >= 60 ? "R" : "L"),
                        finger: f,
                      })
                    }
                    className={`px-1 rounded ${isCur ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {f}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  clearPianoFingerOverride(activeStepIndex, editingNote);
                  setEditingNote(null);
                }}
                className="px-1 rounded text-muted-foreground hover:text-foreground"
                title="Reset to auto fingering"
              >
                Auto
              </button>
              <button
                type="button"
                onClick={() => setEditingNote(null)}
                className="px-1 text-muted-foreground hover:text-foreground"
                title="Close"
              >
                ×
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowPianoTriangles(!showPianoTriangles)}
          className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
            showPianoTriangles
              ? "bg-primary/15 border-primary/50 text-primary font-semibold"
              : "bg-secondary/60 border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
          }`}
          title="Overlay Prime Period Theory Piano Triangles (D / L / U / R)"
        >
          {showPianoTriangles ? "△ ON" : (
            <>
              <span className="sm:hidden">△ Tri</span>
              <span className="hidden sm:inline">△ Piano Triangles</span>
            </>
          )}
        </button>
        </div>
      </div>

      <div ref={scrollRef} className="overflow-x-auto flex-1 min-h-0">
        <div
          className="flex flex-col select-none w-full h-full"
          style={{
            minWidth: shouldScroll ? `${requiredTrackWidth}px` : undefined,
            minHeight: "110px",
          }}
        >
          {/* Top Gutter: Current Fingering (L/R 1–5) */}
          {showTopGutter && (
            <div className="relative h-6 shrink-0 border-b border-border/50 bg-secondary/20">
              {visibleKeys.map(key => {
                if (!isNoteVisible(key.note)) return null;
                const fingerInfo = activeFingerMap.get(key.note);
                if (!fingerInfo) return null;
                const centerPct = keyCenterPctByMidi.get(key.midi);
                if (centerPct === undefined) return null;
                const isSharedAnchor = showNextPreview && nextOnsetNotes.has(key.note);

                return (
                  <button
                    key={`top-f-${key.midi}`}
                    type="button"
                    onClick={() => setEditingNote(prev => (prev === key.note ? null : key.note))}
                    style={{
                      left: `${centerPct}%`,
                      fontSize: isCompact ? "9px" : "10.5px",
                    }}
                    className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded font-mono font-bold leading-none whitespace-nowrap border shadow-sm transition-colors ${
                      fingerInfo.isAnchor || isSharedAnchor
                        ? "bg-emerald-950 border-emerald-400 text-emerald-300"
                        : "bg-slate-950 border-white/50 text-white hover:border-primary"
                    }`}
                    title={`${key.note}: ${fingerInfo.hand}${fingerInfo.finger} (Click to edit)`}
                  >
                    {fingerInfo.hand}{fingerInfo.finger}{fingerInfo.isAnchor ? "⚓" : ""}
                  </button>
                );
              })}
            </div>
          )}

          {/* Keybed */}
          <div className="relative flex-1 min-h-0">
          {/* White keys */}
          {visibleWhiteKeys.map((key, i) => {
            const pressed = isNotePressed(key.note);
            const fading = isNoteFading(key.note);
            const visible = isNoteVisible(key.note);
            const isNext = showNextPreview && phraseMode && !visible && nextOnsetNotes.has(key.note);
            const isOverlayHit = overlayNotes.has(key.note) && activeNotes.has(key.note);
            const isOverlayExtra = overlayNotes.has(key.note) && !activeNotes.has(key.note);
            const inScale = isNoteInCurrentScale(key.note);
            const pc = Note.pitchClass(key.note);
            const semitoneFromTonic = ((key.midi % 12) - tonicChroma + 12) % 12;
            const color = getSolfegeColor(key.midi % 12, tonicChroma, { neonFi: true });
            const contrastText = getSolfegeContrastText(semitoneFromTonic, { neonFi: true });
            const showScaleIndicator = isKeyLocked && inScale;
            const displayLabel = getDisplayNoteLabel(key.note, selectedKey, labelMode, useFlats, baseMidi);

            return (
              <div
                key={key.midi}
                className={`absolute top-0 bottom-0 border cursor-pointer rounded-b-sm hover:opacity-90 ${
                  isOverlayHit
                    ? "border-emerald-400 ring-2 ring-inset ring-emerald-400"
                    : isOverlayExtra
                      ? "border-cyan-400 ring-2 ring-inset ring-cyan-400"
                      : "border-slate-700/60"
                } ${pressed ? "note-active" : ""}`}
                style={{
                  left: `${i * whiteKeyPct}%`,
                  width: `${whiteKeyPct}%`,
                  backgroundColor: visible ? color : "#eef2f6",
                  zIndex: 1,
                  transition: "background-color 0ms",
                  animation: fading && trailMode
                    ? `piano-key-fade ${FADE_DURATION}ms ease-out forwards`
                    : undefined,
                }}
                onClick={(e) => handleKeyClick(key.note, e)}
                title={showFingering && phraseMode && visible ? `${key.note} (Alt+Click or click top gutter badge to edit)` : key.note}
              >
                {isNext && (
                  <div className="absolute bottom-0 left-0 right-0 h-2 bg-emerald-400/75 border-t border-emerald-500/80 rounded-b-sm pointer-events-none" />
                )}
                {visible && trailMode && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-2 rounded-b-sm"
                    style={{
                      background: `linear-gradient(to top, ${color}, transparent)`,
                      animation: fading
                        ? `halo-fade-out ${FADE_DURATION}ms ease-out forwards`
                        : "trail-shimmer 1.5s ease-in-out infinite",
                    }}
                  />
                )}
                {showScaleIndicator && (
                  <div
                    className={`absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full border-2 flex items-center justify-center ${
                      isCompact ? "w-3.5 h-3.5" : "w-5 h-5"
                    }`}
                    style={{
                      borderColor: visible ? contrastText : color,
                      backgroundColor: visible
                        ? (contrastText === "#0b0d13" ? "rgba(11,13,19,0.12)" : "rgba(255,255,255,0.18)")
                        : "rgba(15,23,42,0.06)",
                    }}
                  >
                    <span
                      className="font-mono font-bold leading-none"
                      style={{
                        color: visible ? contrastText : (semitoneFromTonic === 3 || semitoneFromTonic === 4 ? "#a16207" : color),
                        fontSize: isCompact ? "5px" : displayLabel.length > 2 ? "5.5px" : displayLabel.length > 1 ? "6px" : "7px",
                      }}
                    >
                      {displayLabel}
                    </span>
                  </div>
                )}
                {visible && !showScaleIndicator && (
                  <span
                    className="absolute bottom-5 left-1/2 -translate-x-1/2 font-mono font-bold leading-none"
                    style={{
                      color: contrastText,
                      fontSize: isCompact ? "6px" : "7.5px",
                    }}
                  >
                    {displayLabel}
                  </span>
                )}
                {pc === "C" && (
                  <span
                    className="absolute bottom-1 left-1/2 -translate-x-1/2 font-mono font-semibold leading-none"
                    style={{
                      color: visible ? contrastText : "#475569",
                      fontSize: isCompact ? "7px" : "9px",
                    }}
                  >
                    C{Note.octave(key.note)}
                  </span>
                )}
              </div>
            );
          })}

          {/* Black keys */}
          {visibleBlackKeys.map((key) => {
            const pressed = isNotePressed(key.note);
            const fading = isNoteFading(key.note);
            const visible = isNoteVisible(key.note);
            const isNext = showNextPreview && phraseMode && !visible && nextOnsetNotes.has(key.note);
            const isOverlayHit = overlayNotes.has(key.note) && activeNotes.has(key.note);
            const isOverlayExtra = overlayNotes.has(key.note) && !activeNotes.has(key.note);
            const inScale = isNoteInCurrentScale(key.note);
            const semitoneFromTonic = ((key.midi % 12) - tonicChroma + 12) % 12;
            const color = getSolfegeColor(key.midi % 12, tonicChroma, { neonFi: true });
            const contrastText = getSolfegeContrastText(semitoneFromTonic, { neonFi: true });
            const showScaleIndicator = isKeyLocked && inScale;
            const displayLabel = getDisplayNoteLabel(key.note, selectedKey, labelMode, useFlats, baseMidi);

            const prevWhiteIdx = visibleWhiteKeys.findIndex(w => w.midi > key.midi) - 1;
            if (prevWhiteIdx < 0) return null;
            const leftPos = (prevWhiteIdx + 0.55) * whiteKeyPct;

            return (
              <div
                key={key.midi}
                className={`absolute top-0 cursor-pointer rounded-b-sm hover:opacity-90 ${
                  isOverlayHit
                    ? "ring-2 ring-emerald-400"
                    : isOverlayExtra
                      ? "ring-2 ring-cyan-400"
                      : ""
                } ${pressed ? "note-active" : ""}`}
                style={{
                  left: `${leftPos}%`,
                  width: `${whiteKeyPct * 0.8}%`,
                  height: "60%",
                  backgroundColor: visible ? color : "#0f141e",
                  border: "1px solid hsl(var(--border))",
                  zIndex: 2,
                  transition: "background-color 0ms",
                  animation: fading && trailMode
                    ? `piano-key-fade-black ${FADE_DURATION}ms ease-out forwards`
                    : undefined,
                }}
                onClick={(e) => handleKeyClick(key.note, e)}
                title={showFingering && phraseMode && visible ? `${key.note} (Alt+Click or click top gutter badge to edit)` : key.note}
              >
                {isNext && (
                  <div className="absolute bottom-0 left-0 right-0 h-2 bg-emerald-400/80 border-t border-emerald-300/80 rounded-b-sm pointer-events-none" />
                )}
                {showScaleIndicator && (
                  <div
                    className={`absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border-2 flex items-center justify-center ${
                      isCompact ? "w-3.5 h-3.5" : "w-5 h-5"
                    }`}
                    style={{
                      borderColor: visible ? contrastText : color,
                      backgroundColor: visible
                        ? (contrastText === "#0b0d13" ? "rgba(11,13,19,0.12)" : "rgba(255,255,255,0.18)")
                        : "rgba(11,13,19,0.65)",
                    }}
                  >
                    <span
                      className="font-mono font-bold leading-none"
                      style={{
                        color: visible ? contrastText : color,
                        fontSize: isCompact ? "5px" : displayLabel.length > 2 ? "5.5px" : displayLabel.length > 1 ? "6px" : "7px",
                      }}
                    >
                      {displayLabel}
                    </span>
                  </div>
                )}
                {visible && !showScaleIndicator && (
                  <span
                    className="absolute bottom-2 left-1/2 -translate-x-1/2 font-mono font-bold leading-none"
                    style={{
                      color: contrastText,
                      fontSize: isCompact ? "5.5px" : "7px",
                    }}
                  >
                    {displayLabel}
                  </span>
                )}
              </div>
            );
          })}

          {/* PPT Piano Triangles Overlay */}
          {showPianoTriangles && (
            <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 4 }}>
              <svg
                viewBox={`0 0 ${numWhite * 100} 100`}
                preserveAspectRatio="none"
                className="absolute inset-0 w-full h-full"
              >
                {triangleOverlays.map(tri => {
                  const hasActive = tri.pts.some(p => p.active);
                  const d = `M ${tri.pts[0].xPct * numWhite},${tri.pts[0].yPct} L ${tri.pts[1].xPct * numWhite},${tri.pts[1].yPct} L ${tri.pts[2].xPct * numWhite},${tri.pts[2].yPct} Z`;
                  return (
                    <path
                      key={tri.id}
                      d={d}
                      fill={hasActive ? `${tri.color}28` : "transparent"}
                      stroke={tri.color}
                      strokeWidth={hasActive ? 2.2 : 1.1}
                      strokeOpacity={hasActive ? 0.92 : 0.35}
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}
              </svg>
              {triangleOverlays.flatMap(tri =>
                tri.pts.map(p => (
                  <div
                    key={`${tri.id}-${p.midi}`}
                    className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center font-mono font-bold select-none"
                    style={{
                      left: `${p.xPct}%`,
                      top: `${p.yPct}%`,
                      width: p.active ? (isCompact ? 11 : 14) : (isCompact ? 6 : 8),
                      height: p.active ? (isCompact ? 11 : 14) : (isCompact ? 6 : 8),
                      backgroundColor: p.active ? tri.color : "rgba(15, 23, 42, 0.78)",
                      border: `${p.active ? 1.5 : 1}px solid #ffffff`,
                      opacity: p.active ? 1 : 0.55,
                      color: "#ffffff",
                      fontSize: isCompact ? "6.5px" : "8px",
                    }}
                  >
                    {p.active ? p.ptNum : null}
                  </div>
                ))
              )}
            </div>
          )}
          </div>

          {/* Bottom Gutter: Next Step Prep Indicators */}
          {showBottomGutter && (
            <div className="relative h-6 shrink-0 border-t border-border/50 bg-secondary/20">
              {visibleKeys.map(key => {
                if (isNoteVisible(key.note) || !nextOnsetNotes.has(key.note)) return null;
                const centerPct = keyCenterPctByMidi.get(key.midi);
                if (centerPct === undefined) return null;
                const nextFingerInfo = nextFingerMap.get(key.note);

                return (
                  <span
                    key={`bot-n-${key.midi}`}
                    style={{
                      left: `${centerPct}%`,
                      fontSize: isCompact ? "8.5px" : "10px",
                    }}
                    className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-slate-950 border border-emerald-400/80 text-emerald-300 font-mono font-bold leading-none whitespace-nowrap shadow-sm"
                    title={`Next step: ${key.note}${nextFingerInfo ? ` (${nextFingerInfo.hand}${nextFingerInfo.finger})` : ""}`}
                  >
                    {nextFingerInfo ? `→${nextFingerInfo.hand}${nextFingerInfo.finger}` : "→"}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
