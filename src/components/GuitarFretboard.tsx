import { useHarmonic } from "@/contexts/HarmonicContext";
import {
  getFretNote,
  getDisplayNoteLabel,
  getNotePitchClass,
  GUITAR_TUNINGS,
  getNoteChroma,
  DEFAULT_STRING_STEP_OPTIONS,
  getIntervalMeta,
} from "@/lib/music-engine";
import {
  MAX_FRET,
  MIN_VISIBLE_FRETS,
  MIN_WINDOW_SIZE,
  findDistinctFretWindows,
  stepFretWindow,
  ensureWindowVisible,
  computeStringVibrationSegments,
} from "@/lib/fretboard-window";
import { createOnsetFromNotes, type GuitarRightHandSymbol } from "@/lib/phrase-model";
import {
  solveGuitarPhraseFingering,
  solveGuitarPhraseWithDiagnostics,
  type GuitarNoteFingering,
} from "@/lib/guitar-fingering";
import { solveGuitarRightHand, type GuitarRightHandNote } from "@/lib/guitar-right-hand";
import { getSolfegeColor, getSolfegeContrastText } from "@/lib/pptConstants";
import { useContainerSize } from "@/hooks/use-container-size";
import { computeFretboardGeometry } from "@/lib/cell-geometry";
import { Note } from "tonal";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { useCallback, useRef, useEffect, useState, useMemo, type MouseEvent as ReactMouseEvent } from "react";

const FADE_DURATION = 400;
const VISIBLE_SPAN_OPTIONS = [4, 5, 6, 8, 10, 12, 15, 18];

export function GuitarFretboard() {
  const {
    activeNotes, overlayNotes, toggleNote, playNote, isNoteInCurrentScale, isKeyLocked,
    selectedKey, labelMode, selectedTuning, setTuning, useFlats,
    trailMode, isNoteVisible, isNotePressed, isNoteFading,
    phraseMode, phraseOnsets, activeStepIndex, nextStepIndex, loopPhrase, nextOnsetNotes,
    showFingering, showNextPreview, guitarRightHandMode,
    setGuitarFingerOverride, clearGuitarFingerOverride,
    setGuitarPickOverride, clearGuitarPickOverride,
  } = useHarmonic();
  const [tuningOpen, setTuningOpen] = useState(false);
  const [editingPosKey, setEditingPosKey] = useState<string | null>(null);
  const [defaultStringStep, setDefaultStringStep] = useState<number>(5);
  const [visibleFrets, setVisibleFrets] = useState<number>(() =>
    typeof window !== "undefined" && window.innerWidth < 768 ? 6 : 12
  );
  const [visibleStart, setVisibleStart] = useState<number>(0);
  const [fretWindowSize, setFretWindowSize] = useState<number>(5);
  const [windowStart, setWindowStart] = useState<number>(1);
  const tuningRef = useRef<HTMLDivElement>(null);
  const svgWrapRef = useRef<HTMLDivElement>(null);
  const containerSize = useContainerSize(svgWrapRef, { width: 760, height: 180 });

  const tuningNotes = selectedTuning.notes;
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

  const strings = [...tuningNotes].reverse();
  const markerFrets = [3, 5, 7, 9, 12, 15, 17, 19, 21];
  const doubleMarkerFrets = [12];

  const handleVisibleSpanChange = useCallback((nextSpan: number) => {
    const clampedSpan = Math.max(MIN_VISIBLE_FRETS, nextSpan);
    const nextWinSize = Math.min(fretWindowSize, clampedSpan);
    const maxWinStart = Math.max(1, MAX_FRET - nextWinSize + 1);
    const clampedWinStart = Math.max(1, Math.min(windowStart, maxWinStart));
    setVisibleFrets(clampedSpan);
    setFretWindowSize(nextWinSize);
    setWindowStart(clampedWinStart);
    setVisibleStart(prev =>
      ensureWindowVisible(clampedWinStart, nextWinSize, prev, clampedSpan, MAX_FRET)
    );
  }, [fretWindowSize, windowStart]);

  const handleWindowSizeChange = useCallback((nextSize: number) => {
    const clampedSize = Math.max(MIN_WINDOW_SIZE, Math.min(visibleFrets, nextSize));
    const maxWinStart = Math.max(1, MAX_FRET - clampedSize + 1);
    const clampedWinStart = Math.max(1, Math.min(windowStart, maxWinStart));
    setFretWindowSize(clampedSize);
    setWindowStart(clampedWinStart);
    setVisibleStart(prev =>
      ensureWindowVisible(clampedWinStart, clampedSize, prev, visibleFrets, MAX_FRET)
    );
  }, [visibleFrets, windowStart]);

  const activeNoteList = useMemo(() => Array.from(activeNotes), [activeNotes]);

  const distinctWindows = useMemo(
    () => findDistinctFretWindows(tuningNotes, activeNoteList, fretWindowSize, MAX_FRET),
    [tuningNotes, activeNoteList, fretWindowSize]
  );

  const validWindowStarts = useMemo(
    () => distinctWindows.map(w => w.startFret),
    [distinctWindows]
  );

  // Auto-locate to the valid playable block closest to the nut whenever active notes / tuning / block size change
  const windowStartRef = useRef(windowStart);
  windowStartRef.current = windowStart;
  const visibleFretsRef = useRef(visibleFrets);
  visibleFretsRef.current = visibleFrets;

  useEffect(() => {
    if (activeNoteList.length === 0 || validWindowStarts.length === 0) return;
    const curWin = windowStartRef.current;
    if (validWindowStarts.includes(curWin)) return;

    const lowest = validWindowStarts[0];
    setWindowStart(lowest);
    setVisibleStart(prev =>
      ensureWindowVisible(lowest, fretWindowSize, prev, visibleFretsRef.current, MAX_FRET)
    );
  }, [activeNoteList, validWindowStarts, fretWindowSize]);

  const currentValidIdx = validWindowStarts.indexOf(windowStart);
  const isCurrentWindowValid = activeNoteList.length === 0 || currentValidIdx !== -1;

  const handleStepWindow = useCallback((dir: -1 | 1) => {
    const maxStart = Math.max(1, MAX_FRET - fretWindowSize + 1);
    const nextStart = stepFretWindow(windowStart, dir, validWindowStarts, 1, maxStart);
    setWindowStart(nextStart);
    setVisibleStart(prev =>
      ensureWindowVisible(nextStart, fretWindowSize, prev, visibleFrets, MAX_FRET)
    );
  }, [fretWindowSize, windowStart, validWindowStarts, visibleFrets]);

  const handleSnapToNearestValid = useCallback(() => {
    if (validWindowStarts.length === 0) return;
    const lowest = validWindowStarts[0];
    setWindowStart(lowest);
    setVisibleStart(prev =>
      ensureWindowVisible(lowest, fretWindowSize, prev, visibleFrets, MAX_FRET)
    );
  }, [validWindowStarts, fretWindowSize, visibleFrets]);

  const effectiveOnsets = useMemo(
    () => (phraseMode ? phraseOnsets : [createOnsetFromNotes(activeNoteList)]),
    [phraseMode, phraseOnsets, activeNoteList]
  );

  const { grips: solvedFingerings, diagnostics: fingerDiagnostics } = useMemo(
    () =>
      showFingering || (phraseMode && showNextPreview) || activeNoteList.length > 0
        ? solveGuitarPhraseWithDiagnostics(tuningNotes, effectiveOnsets, windowStart, fretWindowSize, {
            loop: loopPhrase,
          })
        : { grips: [], diagnostics: [] },
    [
      showFingering,
      phraseMode,
      showNextPreview,
      activeNoteList.length,
      tuningNotes,
      effectiveOnsets,
      windowStart,
      fretWindowSize,
      loopPhrase,
    ]
  );

  const activeDiagnosis = fingerDiagnostics[phraseMode ? activeStepIndex : 0];
  const nextDiagnosis =
    phraseMode && showNextPreview && nextStepIndex !== null
      ? fingerDiagnostics[nextStepIndex]
      : undefined;

  const rightHandSolved = useMemo(
    () =>
      showFingering && guitarRightHandMode !== "off"
        ? solveGuitarRightHand(solvedFingerings, effectiveOnsets, guitarRightHandMode, loopPhrase)
        : [],
    [showFingering, guitarRightHandMode, solvedFingerings, effectiveOnsets, loopPhrase]
  );

  const nextWindowStart = useMemo(() => {
    if (!phraseMode || !showNextPreview || nextStepIndex === null) return null;
    const nextNotes = phraseOnsets[nextStepIndex]?.notes ?? [];
    if (nextNotes.length === 0) return null;
    const wins = findDistinctFretWindows(tuningNotes, nextNotes, fretWindowSize, MAX_FRET);
    if (wins.length === 0) return null;
    if (wins.some(w => w.startFret === windowStart)) return windowStart;
    // Pick valid block with smallest shift from current windowStart
    let best = wins[0].startFret;
    let bestDist = Math.abs(best - windowStart);
    for (const w of wins) {
      const d = Math.abs(w.startFret - windowStart);
      if (d < bestDist) {
        bestDist = d;
        best = w.startFret;
      }
    }
    return best;
  }, [phraseMode, showNextPreview, nextStepIndex, phraseOnsets, tuningNotes, fretWindowSize, windowStart]);

  const activeFingerByPos = useMemo(() => {
    const map = new Map<string, GuitarNoteFingering>();
    const list = solvedFingerings[phraseMode ? activeStepIndex : 0] ?? [];
    for (const f of list) map.set(`${f.stringIdx}:${f.fret}`, f);
    return map;
  }, [solvedFingerings, phraseMode, activeStepIndex]);

  const nextFingerByPos = useMemo(() => {
    const map = new Map<string, GuitarNoteFingering>();
    if (!phraseMode || !showNextPreview || nextStepIndex === null) return map;
    if (nextWindowStart !== null && nextWindowStart !== windowStart) {
      const nextOnset = phraseOnsets[nextStepIndex];
      const res = nextOnset
        ? solveGuitarPhraseWithDiagnostics(tuningNotes, [nextOnset], nextWindowStart, fretWindowSize)
        : null;
      if (!res || !res.diagnostics[0]?.playable) return map;
      for (const f of res.grips[0] ?? []) map.set(`${f.stringIdx}:${f.fret}`, f);
      return map;
    }
    if (nextDiagnosis && !nextDiagnosis.playable) return map;
    const list = solvedFingerings[nextStepIndex] ?? [];
    for (const f of list) map.set(`${f.stringIdx}:${f.fret}`, f);
    return map;
  }, [solvedFingerings, phraseMode, showNextPreview, nextStepIndex, nextWindowStart, windowStart, phraseOnsets, tuningNotes, fretWindowSize, nextDiagnosis]);

  const activePickByString = useMemo(() => {
    const map = new Map<number, GuitarRightHandNote>();
    const list = rightHandSolved[phraseMode ? activeStepIndex : 0] ?? [];
    for (const p of list) map.set(p.stringIdx, p);
    return map;
  }, [rightHandSolved, phraseMode, activeStepIndex]);

  const nextPickByString = useMemo(() => {
    const map = new Map<number, GuitarRightHandNote>();
    if (!phraseMode || !showNextPreview || nextStepIndex === null) return map;
    const list = rightHandSolved[nextStepIndex] ?? [];
    for (const p of list) map.set(p.stringIdx, p);
    return map;
  }, [rightHandSolved, phraseMode, showNextPreview, nextStepIndex]);

  const handleCycleRightHand = useCallback(
    (stringIdx: number, e: ReactMouseEvent) => {
      e.stopPropagation();
      if (!phraseMode) return;
      if (e.altKey) {
        clearGuitarPickOverride(activeStepIndex, stringIdx);
        return;
      }
      const cur = activePickByString.get(stringIdx)?.symbol;
      if (guitarRightHandMode === "fingerstyle") {
        const order: GuitarRightHandSymbol[] = ["p", "i", "m", "a"];
        const idx = cur ? order.indexOf(cur) : -1;
        if (idx === order.length - 1) {
          clearGuitarPickOverride(activeStepIndex, stringIdx);
          return;
        }
        const nextSym = order[idx + 1];
        setGuitarPickOverride(activeStepIndex, stringIdx, { stringIdx, symbol: nextSym });
      } else {
        if (cur === "U") {
          clearGuitarPickOverride(activeStepIndex, stringIdx);
          return;
        }
        const nextSym: GuitarRightHandSymbol = cur === "D" ? "U" : "D";
        setGuitarPickOverride(activeStepIndex, stringIdx, { stringIdx, symbol: nextSym });
      }
    },
    [phraseMode, activeStepIndex, activePickByString, guitarRightHandMode, setGuitarPickOverride, clearGuitarPickOverride]
  );

  const handleStepStringTuning = useCallback(
    (originalStringIdx: number, deltaSemitones: -1 | 1) => {
      const curNote = tuningNotes[originalStringIdx];
      const curMidi = Note.midi(curNote);
      if (curMidi === null) return;
      const nextMidi = Math.max(24, Math.min(84, curMidi + deltaSemitones));
      if (nextMidi === curMidi) return;

      const nextNote = Note.fromMidi(nextMidi);
      const nextNotes = [...tuningNotes];
      nextNotes[originalStringIdx] = nextNote;

      const matchedPreset = GUITAR_TUNINGS.find(
        t =>
          t.notes.length === nextNotes.length &&
          t.notes.every((n, i) => Note.midi(n) === Note.midi(nextNotes[i]))
      );
      setTuning(
        matchedPreset ?? {
          name: "Custom",
          notes: nextNotes,
          category: "alternate",
        }
      );
    },
    [tuningNotes, setTuning]
  );

  const handleFretClick = useCallback((note: string, stringIdx: number, fret: number, e: ReactMouseEvent) => {
    if (e.altKey && showFingering && phraseMode && isNoteVisible(note)) {
      e.stopPropagation();
      const posKey = `${stringIdx}:${fret}`;
      const cur = activeFingerByPos.get(posKey);
      const nextFinger = fret === 0 ? 0 : cur ? (cur.finger % 4) + 1 : 1;
      setGuitarFingerOverride(activeStepIndex, posKey, { stringIdx, fret, finger: nextFinger });
      return;
    }
    playNote(note);
    toggleNote(note);
  }, [playNote, toggleNote, showFingering, phraseMode, isNoteVisible, activeFingerByPos, setGuitarFingerOverride, activeStepIndex]);

  const geom = useMemo(
    () => computeFretboardGeometry(containerSize.width, containerSize.height, visibleFrets, strings.length),
    [containerSize.width, containerSize.height, visibleFrets, strings.length]
  );

  const getStringY = useCallback(
    (rowIdx: number) => geom.topY + rowIdx * geom.stringGap,
    [geom.topY, geom.stringGap]
  );

  const visibleFretNumbers = useMemo(() => {
    if (visibleStart === 0) {
      return Array.from({ length: visibleFrets + 1 }, (_, i) => i);
    }
    return Array.from({ length: visibleFrets }, (_, i) => visibleStart + i);
  }, [visibleStart, visibleFrets]);

  const visibleStartFret = visibleStart === 0 ? 0 : visibleStart;
  const visibleEndFret = visibleStart === 0 ? visibleFrets : visibleStart + visibleFrets - 1;

  const getFretCenterX = useCallback((fret: number) => {
    if (visibleStart === 0) {
      return fret === 0 ? geom.openX : geom.neckLeft + (fret - 0.5) * geom.fretWidth;
    }
    return geom.neckLeft + (fret - visibleStart + 0.5) * geom.fretWidth;
  }, [visibleStart, geom.openX, geom.neckLeft, geom.fretWidth]);

  const getFretWireX = useCallback((fret: number) => {
    if (fret === 0) return geom.neckLeft;
    if (visibleStart === 0) {
      return geom.neckLeft + fret * geom.fretWidth;
    }
    return geom.neckLeft + (fret - visibleStart + 1) * geom.fretWidth;
  }, [visibleStart, geom.neckLeft, geom.fretWidth]);

  const windowEnd = windowStart + fretWindowSize - 1;
  const computeBlockBounds = useCallback(
    (start: number, end: number) => {
      const clampedLo = Math.max(visibleStartFret, start);
      const clampedHi = Math.min(visibleEndFret, end);
      if (clampedLo > clampedHi) return null;

      let x1: number;
      let x2: number;
      if (visibleStart === 0) {
        x1 = clampedLo === 0 ? geom.openX - geom.noteRadius - 2 : geom.neckLeft + (clampedLo - 1) * geom.fretWidth;
        x2 = clampedHi === 0 ? geom.openX + geom.noteRadius + 2 : geom.neckLeft + clampedHi * geom.fretWidth;
      } else {
        x1 = geom.neckLeft + (clampedLo - visibleStart) * geom.fretWidth;
        x2 = geom.neckLeft + (clampedHi - visibleStart + 1) * geom.fretWidth;
      }
      return { x1, width: Math.max(12, x2 - x1) };
    },
    [visibleStart, visibleStartFret, visibleEndFret, geom.openX, geom.noteRadius, geom.neckLeft, geom.fretWidth]
  );

  const windowBandBounds = useMemo(
    () => computeBlockBounds(windowStart, windowEnd),
    [computeBlockBounds, windowStart, windowEnd]
  );

  const nextWindowEnd = nextWindowStart !== null ? nextWindowStart + fretWindowSize - 1 : null;
  const nextWindowBandBounds = useMemo(() => {
    if (nextWindowStart === null || nextWindowEnd === null || nextWindowStart === windowStart) {
      return null;
    }
    return computeBlockBounds(nextWindowStart, nextWindowEnd);
  }, [computeBlockBounds, nextWindowStart, nextWindowEnd, windowStart]);

  const nextShiftText = useMemo(() => {
    if (nextWindowStart === null || nextWindowEnd === null || nextWindowStart === windowStart) {
      return null;
    }
    const delta = nextWindowStart - windowStart;
    const arrow = delta > 0 ? "↑" : "↓";
    const sign = delta > 0 ? `+${delta}` : `${delta}`;
    return `Next: Shift ${arrow} F${nextWindowStart}–F${nextWindowEnd} (${sign}f)`;
  }, [nextWindowStart, nextWindowEnd, windowStart]);

  const visibleMidisSet = useMemo(() => {
    const set = new Set<number>();
    strings.forEach((_openNote, stringIdx) => {
      const originalStringIdx = strings.length - 1 - stringIdx;
      const openNote = getFretNote(tuningNotes[originalStringIdx], 0);
      if (openNote && isNoteVisible(openNote)) {
        const m0 = Note.midi(openNote);
        if (m0 !== null) set.add(m0);
      }
      for (let f = windowStart; f <= windowEnd; f++) {
        const noteName = getFretNote(tuningNotes[originalStringIdx], f);
        if (noteName && isNoteVisible(noteName)) {
          const m = Note.midi(noteName);
          if (m !== null) set.add(m);
        }
      }
    });
    return set;
  }, [strings, tuningNotes, windowStart, windowEnd, isNoteVisible]);

  const tuningSeams = useMemo(() => {
    const defaultMeta = getIntervalMeta(defaultStringStep);
    const seams: { y: number; interval: number; label: string; tooltip: string }[] = [];
    for (let s = 0; s < tuningNotes.length - 1; s++) {
      const mA = Note.midi(tuningNotes[s]);
      const mB = Note.midi(tuningNotes[s + 1]);
      if (mA === null || mB === null) continue;
      const diff = mB - mA;
      if (diff !== defaultStringStep) {
        const rowA = tuningNotes.length - 1 - s;
        const rowB = tuningNotes.length - 1 - (s + 1);
        const midY = geom.topY + ((rowA + rowB) / 2) * geom.stringGap;
        const meta = getIntervalMeta(diff);
        const shift = defaultStringStep - diff;
        const shiftStr = shift > 0 ? `+${shift}` : `${shift}`;
        const fretWord = Math.abs(shift) === 1 ? "fret" : "frets";
        seams.push({
          y: midY,
          interval: diff,
          label: `${meta.shortName} · ${diff}st (${shiftStr} ${fretWord})`,
          tooltip: `${meta.name} (${diff} semitones) vs default ${defaultMeta.name} (${defaultStringStep}st)`,
        });
      }
    }
    return seams;
  }, [tuningNotes, defaultStringStep, geom.topY, geom.stringGap]);

  useEffect(() => {
    if (!tuningOpen) return;
    const handler = (e: MouseEvent) => {
      if (tuningRef.current && !tuningRef.current.contains(e.target as Node)) {
        setTuningOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [tuningOpen]);

  const tuningCategories = [
    { label: "Standard", category: "standard" },
    { label: "Drop", category: "drop" },
    { label: "Open", category: "open" },
    { label: "Alternate", category: "alternate" },
  ];

  const windowSizeOptions = useMemo(() => {
    const opts: number[] = [];
    for (let w = MIN_WINDOW_SIZE; w <= visibleFrets; w++) {
      opts.push(w);
    }
    return opts;
  }, [visibleFrets]);

  const maxWinStart = Math.max(1, MAX_FRET - fretWindowSize + 1);
  const canStepBack = validWindowStarts.length > 0
    ? validWindowStarts.some(s => s < windowStart)
    : windowStart > 1;
  const canStepForward = validWindowStarts.length > 0
    ? validWindowStarts.some(s => s > windowStart)
    : windowStart < maxWinStart;

  const labelFontForLen = (len: number) =>
    geom.noteRadius * (len > 2 ? 0.58 : len > 1 ? 0.7 : 0.82);

  return (
    <div className="glass-panel p-3 h-full flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5 relative">
        <div className="flex items-center gap-2 flex-wrap relative">
          <h3 className="engineering-label">Fretboard ·</h3>
          <div ref={tuningRef} className="relative">
            <button
              onClick={() => setTuningOpen(!tuningOpen)}
              className="text-[10px] font-semibold uppercase tracking-wider font-mono text-primary hover:text-primary/80 transition-colors cursor-pointer border-b border-dashed border-primary/40"
            >
              <span className="sm:hidden">{selectedTuning.name.split(" (")[0]}</span>
              <span className="hidden sm:inline">{selectedTuning.name}</span>
            </button>
            {tuningOpen && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-md shadow-lg py-1 min-w-[210px] max-h-[280px] overflow-y-auto">
                {tuningCategories.map(cat => {
                  const tunings = GUITAR_TUNINGS.filter(t => t.category === cat.category);
                  if (tunings.length === 0) return null;
                  return (
                    <div key={cat.category}>
                      <div className="px-3 py-1 text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
                        {cat.label}
                      </div>
                      {tunings.map(t => (
                        <button
                          key={t.name}
                          onClick={() => { setTuning(t); setTuningOpen(false); }}
                          className={`w-full text-left px-3 py-1.5 text-xs font-mono transition-colors ${
                            selectedTuning.name === t.name
                              ? "bg-primary/20 text-primary"
                              : "text-foreground hover:bg-secondary"
                          }`}
                        >
                          {t.name}
                          <span className="text-[9px] text-muted-foreground ml-2">{t.notes.join(" ")}</span>
                        </button>
                      ))}
                    </div>
                  );
                })}
                <div className="sm:hidden border-t border-border mt-1 pt-1.5 px-3 pb-1.5 space-y-1">
                  <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
                    Default String Step
                  </div>
                  <select
                    value={defaultStringStep}
                    onChange={(e) => setDefaultStringStep(Number(e.target.value))}
                    className="w-full bg-secondary/70 border border-border text-foreground rounded px-1.5 py-1 text-[11px] font-mono"
                  >
                    {DEFAULT_STRING_STEP_OPTIONS.map(st => {
                      const meta = getIntervalMeta(st);
                      return (
                        <option key={st} value={st}>
                          {meta.name} ({st}st)
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            )}
          </div>

          <label className="hidden sm:flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
            <span className="uppercase tracking-wider">Step</span>
            <select
              value={defaultStringStep}
              onChange={(e) => setDefaultStringStep(Number(e.target.value))}
              className="bg-secondary/70 border border-border text-foreground rounded px-1.5 py-0.5 text-[10px] font-mono cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/50"
              title="Default adjacent string interval used to detect tuning seam shifts"
            >
              {DEFAULT_STRING_STEP_OPTIONS.map(st => {
                const meta = getIntervalMeta(st);
                return (
                  <option key={st} value={st}>
                    {meta.name} ({st}st)
                  </option>
                );
              })}
            </select>
          </label>
        </div>

        {/* Right: Unplayable Warning, Next Shift Banner, Finger Editor, Visible Span, Window Size, Stepper */}
        <div className="flex items-center gap-2 flex-wrap">
          {activeDiagnosis && !activeDiagnosis.playable && activeDiagnosis.reason && (
            <span
              className="px-2 py-0.5 rounded border border-rose-500/60 bg-rose-500/15 text-rose-300 text-[10px] font-mono font-semibold"
              title="Showing closest partial grip — revoice the unreachable chord tone(s) or change tuning"
            >
              {activeDiagnosis.reason}
            </span>
          )}
          {nextDiagnosis && !nextDiagnosis.playable && nextDiagnosis.reason && (
            <span
              className="px-2 py-0.5 rounded border border-amber-500/50 bg-amber-500/10 text-amber-300 text-[10px] font-mono"
              title="Next step cannot be voiced simultaneously in this tuning/span"
            >
              Next unplayable
            </span>
          )}
          {nextShiftText && (!nextDiagnosis || nextDiagnosis.playable) && (
            <span
              className="px-2 py-0.5 rounded border border-amber-400/60 bg-amber-500/15 text-amber-300 text-[10px] font-mono font-semibold"
              title="Next phrase step requires shifting the fret block"
            >
              {nextShiftText}
            </span>
          )}

          {showFingering && phraseMode && editingPosKey && (() => {
            const cur = activeFingerByPos.get(editingPosKey);
            if (!cur) return null;
            return (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-primary/50 bg-secondary text-[10px] font-mono">
                <span className="text-primary font-bold">{cur.note}:</span>
                {[0, 1, 2, 3, 4].map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() =>
                      setGuitarFingerOverride(activeStepIndex, editingPosKey, {
                        stringIdx: cur.stringIdx,
                        fret: cur.fret,
                        finger: f,
                      })
                    }
                    className={`px-1 rounded ${
                      cur.finger === f ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    clearGuitarFingerOverride(activeStepIndex, editingPosKey);
                    setEditingPosKey(null);
                  }}
                  className="px-1 text-muted-foreground hover:text-foreground"
                  title="Reset to auto fingering"
                >
                  Auto
                </button>
                <button
                  type="button"
                  onClick={() => setEditingPosKey(null)}
                  className="px-1 text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              </div>
            );
          })()}
          <label className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
            <span className="uppercase tracking-wider">Span</span>
            <select
              value={visibleFrets}
              onChange={(e) => handleVisibleSpanChange(Number(e.target.value))}
              className="bg-secondary/70 border border-border text-foreground rounded px-1.5 py-0.5 text-[10px] font-mono cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/50"
              title="Number of frets displayed (min 4, zero horizontal scroll)"
            >
              {VISIBLE_SPAN_OPTIONS.map(span => (
                <option key={span} value={span}>{span}f</option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
            <span className="uppercase tracking-wider">Block</span>
            <select
              value={fretWindowSize}
              onChange={(e) => handleWindowSizeChange(Number(e.target.value))}
              className="bg-secondary/70 border border-border text-foreground rounded px-1.5 py-0.5 text-[10px] font-mono cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/50"
              title="Vertical fret block width (3 up to visible span)"
            >
              {windowSizeOptions.map(w => (
                <option key={w} value={w}>{w}f</option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-0.5 bg-secondary/70 border border-border rounded px-1 py-0.5">
            <button
              type="button"
              onClick={() => handleStepWindow(-1)}
              disabled={!canStepBack}
              className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Previous neck position that voices active notes"
              aria-label="Previous fret window"
            >
              <ChevronLeft size={12} />
            </button>
            <button
              type="button"
              onClick={handleSnapToNearestValid}
              className={`px-1.5 text-[10px] font-mono font-semibold flex items-center gap-1 transition-colors ${
                isCurrentWindowValid
                  ? "text-primary"
                  : "text-amber-400 hover:text-amber-300"
              }`}
              title={
                activeNoteList.length > 0 && currentValidIdx !== -1
                  ? `Position ${currentValidIdx + 1} of ${validWindowStarts.length} (F${windowStart}–F${windowEnd})`
                  : isCurrentWindowValid
                    ? `Vertical block F${windowStart}–F${windowEnd}`
                    : `F${windowStart}–F${windowEnd} does not cover all active notes — click to jump to lowest valid block`
              }
            >
              {activeNoteList.length > 0 && currentValidIdx !== -1 && (
                <span className="text-[9px] opacity-75">
                  {currentValidIdx + 1}/{validWindowStarts.length} ·
                </span>
              )}
              <span>F{windowStart}–F{windowEnd}</span>
              {activeNoteList.length > 0 && isCurrentWindowValid && <Check size={10} />}
            </button>
            <button
              type="button"
              onClick={() => handleStepWindow(1)}
              disabled={!canStepForward}
              className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Next neck position that voices active notes"
              aria-label="Next fret window"
            >
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
      </div>

      <div ref={svgWrapRef} className="w-full flex-1 min-h-0 overflow-hidden">
        <svg
          viewBox={`0 0 ${geom.svgWidth} ${geom.svgHeight}`}
          className="w-full h-full block"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Next-Step Shifted Ghost Block */}
          {nextWindowBandBounds && nextWindowStart !== null && nextWindowEnd !== null && (
            <g>
              <rect
                x={nextWindowBandBounds.x1}
                y={geom.blockBandY + 2}
                width={nextWindowBandBounds.width}
                height={Math.max(20, geom.blockBandHeight - 4)}
                rx={4}
                fill="rgba(251, 191, 36, 0.06)"
                stroke="rgba(251, 191, 36, 0.72)"
                strokeWidth={1.2}
                strokeDasharray="4 3"
              />
              <text
                x={nextWindowBandBounds.x1 + nextWindowBandBounds.width / 2}
                y={geom.blockLabelY}
                textAnchor="middle"
                fontSize={Math.max(8, Math.min(10.5, geom.stringGap * 0.26))}
                fontFamily="JetBrains Mono"
                fontWeight="600"
                fill="rgba(251, 191, 36, 0.9)"
              >
                Next ({nextWindowStart}–{nextWindowEnd})
              </text>
            </g>
          )}

          {/* Vertical Fret Block Highlight Band */}
          {windowBandBounds && (
            <g>
              <rect
                x={windowBandBounds.x1}
                y={geom.blockBandY}
                width={windowBandBounds.width}
                height={geom.blockBandHeight}
                rx={4}
                fill="rgba(52, 211, 153, 0.08)"
                stroke="rgba(52, 211, 153, 0.45)"
                strokeWidth={1.1}
              />
              <text
                x={windowBandBounds.x1 + windowBandBounds.width / 2}
                y={geom.blockLabelY}
                textAnchor="middle"
                fontSize={Math.max(8.5, Math.min(11, geom.stringGap * 0.28))}
                fontFamily="JetBrains Mono"
                fontWeight="600"
                fill="rgba(52, 211, 153, 0.85)"
              >
                {fretWindowSize}-Fret Block ({windowStart}–{windowEnd})
              </text>
            </g>
          )}

          {/* Left boundary */}
          {visibleStart === 0 ? (
            <rect
              x={geom.nutX}
              y={geom.fretLineTop}
              width={geom.nutW}
              height={geom.fretLineBottom - geom.fretLineTop}
              fill="hsl(var(--foreground))"
              opacity="0.65"
              rx="1"
            />
          ) : (
            <line
              x1={geom.neckLeft}
              y1={geom.fretLineTop}
              x2={geom.neckLeft}
              y2={geom.fretLineBottom}
              stroke="hsl(var(--border))"
              strokeWidth="1.5"
            />
          )}

          {/* Fret lines */}
          {Array.from({ length: visibleFrets }, (_, i) => {
            const x = geom.neckLeft + (i + 1) * geom.fretWidth;
            return (
              <line
                key={`fret-${i}`}
                x1={x}
                y1={geom.fretLineTop}
                x2={x}
                y2={geom.fretLineBottom}
                stroke="hsl(var(--border))"
                strokeWidth="1.5"
              />
            );
          })}

          {/* Bridge saddle line */}
          <line
            x1={geom.bridgeX}
            y1={geom.fretLineTop}
            x2={geom.bridgeX}
            y2={geom.fretLineBottom}
            stroke="hsl(var(--muted-foreground))"
            strokeWidth="2"
            opacity="0.45"
          />

          {/* Fret markers */}
          {markerFrets
            .filter(fret => fret >= (visibleStart === 0 ? 1 : visibleStart) && fret <= visibleEndFret)
            .map(fret => {
              const x = getFretCenterX(fret);
              if (doubleMarkerFrets.includes(fret)) {
                return (
                  <g key={`marker-${fret}`}>
                    <circle
                      cx={x}
                      cy={geom.topY + geom.neckHeight * 0.3}
                      r={geom.markerRadius}
                      fill="hsl(var(--muted-foreground))"
                      opacity="0.35"
                    />
                    <circle
                      cx={x}
                      cy={geom.topY + geom.neckHeight * 0.7}
                      r={geom.markerRadius}
                      fill="hsl(var(--muted-foreground))"
                      opacity="0.35"
                    />
                  </g>
                );
              }
              return (
                <circle
                  key={`marker-${fret}`}
                  cx={x}
                  cy={geom.topY + geom.neckHeight * 0.5}
                  r={geom.markerRadius}
                  fill="hsl(var(--muted-foreground))"
                  opacity="0.28"
                />
              );
            })}

          {/* Base Strings extending to bridge */}
          {strings.map((_, i) => {
            const y = getStringY(i);
            return (
              <line
                key={`string-${i}`}
                x1={geom.neckLeft}
                y1={y}
                x2={geom.bridgeX}
                y2={y}
                stroke="hsl(var(--foreground))"
                strokeWidth={0.7 + (strings.length - 1 - i) * 0.35}
                opacity="0.25"
              />
            );
          })}

          {/* Vibrating String Solfège Colourisation */}
          {strings.map((_openNote, stringIdx) => {
            const y = getStringY(stringIdx);
            const originalStringIdx = strings.length - 1 - stringIdx;
            const openMidi = Note.midi(tuningNotes[originalStringIdx]);
            if (openMidi === null) return null;

            const baseWidth = 0.7 + (strings.length - 1 - stringIdx) * 0.35;
            const segments = computeStringVibrationSegments(
              openMidi,
              m => visibleMidisSet.has(m),
              windowStart,
              windowEnd,
              tonicChroma
            );

            return segments.map((seg, segIdx) => {
              const rawX1 = getFretWireX(seg.fromFret);
              const rawX2 = seg.toFret !== null ? getFretWireX(seg.toFret) : geom.bridgeX;
              const x1 = Math.max(geom.neckLeft, Math.min(geom.bridgeX, rawX1));
              const x2 = Math.max(geom.neckLeft, Math.min(geom.bridgeX, rawX2));
              if (x2 <= x1) return null;
              return (
                <line
                  key={`vib-${stringIdx}-${segIdx}`}
                  x1={x1}
                  y1={y}
                  x2={x2}
                  y2={y}
                  stroke={seg.color}
                  strokeWidth={baseWidth + 2}
                  strokeLinecap="butt"
                  opacity={0.92}
                />
              );
            });
          })}

          {/* Non-default string-step tuning seam indicators */}
          {tuningSeams.map((seam, idx) => {
            const pillW = Math.max(88, seam.label.length * 5.2 + 12);
            const pillX = geom.neckRight - 2 - pillW;
            const pillY = seam.y - 7.5;
            return (
              <g key={`seam-${idx}`}>
                <title>{seam.tooltip}</title>
                <line
                  x1={geom.neckLeft}
                  y1={seam.y}
                  x2={pillX - 4}
                  y2={seam.y}
                  stroke="hsl(340, 65%, 55%)"
                  strokeWidth={1.1}
                  strokeDasharray="3 4"
                  opacity={0.55}
                />
                <rect
                  x={pillX}
                  y={pillY}
                  width={pillW}
                  height={15}
                  rx={3}
                  fill="#0b0d13"
                  fillOpacity={0.9}
                  stroke="hsl(340, 65%, 55%)"
                  strokeOpacity={0.6}
                  strokeWidth={0.75}
                />
                <text
                  x={pillX + pillW / 2}
                  y={seam.y + 3}
                  textAnchor="middle"
                  fontSize="8.5"
                  fontFamily="JetBrains Mono"
                  fontWeight="600"
                  fill="hsl(340, 80%, 72%)"
                >
                  {seam.label}
                </text>
              </g>
            );
          })}

          {/* String tuning labels & per-string semitone steppers (◀ / ▶) */}
          {strings.map((openNote, i) => {
            const y = getStringY(i);
            const originalStringIdx = strings.length - 1 - i;
            const pc = getNotePitchClass(openNote, useFlats);
            const labelFont = Math.max(9.5, Math.min(12.5, geom.stringGap * 0.34));
            return (
              <g key={`label-${i}`}>
                <g
                  className="cursor-pointer opacity-55 hover:opacity-100 transition-opacity"
                  onClick={() => handleStepStringTuning(originalStringIdx, -1)}
                >
                  <title>{`Tune string ${originalStringIdx + 1} (${openNote}) down 1 semitone`}</title>
                  <rect x={2} y={y - 9} width={13} height={18} fill="transparent" />
                  <text
                    x={8.5}
                    y={y + 3}
                    fill="hsl(var(--muted-foreground))"
                    fontSize="8.5"
                    fontFamily="JetBrains Mono"
                    textAnchor="middle"
                  >
                    −
                  </text>
                </g>

                <text
                  x={geom.labelX}
                  y={y + 3.5}
                  fill="hsl(var(--foreground))"
                  fontSize={labelFont}
                  fontFamily="JetBrains Mono"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {pc}
                </text>

                <g
                  className="cursor-pointer opacity-55 hover:opacity-100 transition-opacity"
                  onClick={() => handleStepStringTuning(originalStringIdx, 1)}
                >
                  <title>{`Tune string ${originalStringIdx + 1} (${openNote}) up 1 semitone`}</title>
                  <rect x={33} y={y - 9} width={13} height={18} fill="transparent" />
                  <text
                    x={39.5}
                    y={y + 3}
                    fill="hsl(var(--muted-foreground))"
                    fontSize="8.5"
                    fontFamily="JetBrains Mono"
                    textAnchor="middle"
                  >
                    +
                  </text>
                </g>
              </g>
            );
          })}

          {/* Notes on fretboard */}
          {strings.map((_openNote, stringIdx) => {
            const y = getStringY(stringIdx);
            const originalStringIdx = strings.length - 1 - stringIdx;

            return visibleFretNumbers.map(fret => {
              const note = getFretNote(tuningNotes[originalStringIdx], fret);
              if (!note) return null;

              const midi = Note.midi(note) ?? 0;
              const pc = getNotePitchClass(note, useFlats);
              const pressed = isNotePressed(note);
              const fading = isNoteFading(note);
              const visible = isNoteVisible(note);

              const isOverlayHit = overlayNotes.has(note) && activeNotes.has(note);
              const isOverlayExtra = overlayNotes.has(note) && !activeNotes.has(note);

              const posKey = `${originalStringIdx}:${fret}`;
              const activeFinger = visible ? activeFingerByPos.get(posKey) : undefined;
              const nextFinger = nextFingerByPos.get(posKey);
              const isNextPrep =
                showNextPreview &&
                phraseMode &&
                !visible &&
                Boolean(nextFinger);

              const hasSolvedGrip = activeFingerByPos.size > 0;
              const isNonGripOccurrence =
                visible &&
                hasSolvedGrip &&
                !activeFinger &&
                !overlayNotes.has(note);

              const inScale = isNoteInCurrentScale(note);
              const dimmed = isKeyLocked && !inScale;
              const inWindow = fret === 0 || (fret >= windowStart && fret <= windowEnd);
              const deEmphasiseOutsideWindow = fretWindowSize < visibleFrets && !inWindow;

              const noteChroma = midi % 12;
              const semitoneFromTonic = ((noteChroma - tonicChroma) % 12 + 12) % 12;
              const isFi = semitoneFromTonic === 6;
              const isTonic = semitoneFromTonic === 0;
              const color = getSolfegeColor(noteChroma, tonicChroma, { neonFi: true });
              const displayLabel = getDisplayNoteLabel(note, selectedKey, labelMode, useFlats, baseMidi);
              const textFill = isFi ? "#38BDF8" : getSolfegeContrastText(semitoneFromTonic, { neonFi: true });

              const x = getFretCenterX(fret);
              const fontSize = labelFontForLen(displayLabel.length);
              const textYOffset = fontSize * 0.36;
              const badgeR = Math.max(7, geom.noteRadius * 0.56);

              if (!visible && isNextPrep) {
                return (
                  <g
                    key={`${stringIdx}-${fret}`}
                    className="cursor-pointer"
                    onClick={(e) => handleFretClick(note, originalStringIdx, fret, e)}
                  >
                    <title>{`Next step prep: ${note}${nextFinger ? ` (finger ${nextFinger.finger})` : ""}`}</title>
                    <circle
                      cx={x}
                      cy={y}
                      r={geom.noteRadius * 1.05}
                      fill="rgba(15, 23, 42, 0.85)"
                      stroke="#34d399"
                      strokeWidth="1.6"
                      strokeDasharray="2.5 2"
                    />
                    <text
                      x={x}
                      y={y + fontSize * 0.36}
                      fill="#6ee7b7"
                      fontSize={Math.max(8, geom.noteRadius * 0.78)}
                      fontFamily="JetBrains Mono"
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      {showFingering && nextFinger ? `→${nextFinger.finger}` : "→"}
                    </text>
                  </g>
                );
              }

              if (!visible && dimmed) {
                return (
                  <circle
                    key={`${stringIdx}-${fret}`}
                    cx={x}
                    cy={y}
                    r={Math.max(9, geom.noteRadius * 0.9)}
                    fill="transparent"
                    className="cursor-pointer"
                    onClick={(e) => handleFretClick(note, originalStringIdx, fret, e)}
                  />
                );
              }

              if (!visible && isKeyLocked && inScale) {
                return (
                  <g
                    key={`${stringIdx}-${fret}`}
                    className="cursor-pointer"
                    onClick={(e) => handleFretClick(note, originalStringIdx, fret, e)}
                    opacity={deEmphasiseOutsideWindow ? 0.45 : 1}
                  >
                    <circle
                      cx={x}
                      cy={y}
                      r={geom.noteRadius * 0.88}
                      fill={isFi ? "#141414" : color}
                      stroke={isTonic ? "#ffffff" : (isFi ? "#38BDF8" : "none")}
                      strokeWidth={isTonic ? 1.2 : 0.9}
                      opacity={0.34}
                    />
                    <text
                      x={x}
                      y={y + textYOffset}
                      fill="hsl(var(--foreground))"
                      fontSize={fontSize}
                      fontFamily="JetBrains Mono"
                      textAnchor="middle"
                      opacity={0.78}
                    >
                      {displayLabel}
                    </text>
                  </g>
                );
              }

              if (!visible) {
                return (
                  <circle
                    key={`${stringIdx}-${fret}`}
                    cx={x}
                    cy={y}
                    r={Math.max(9, geom.noteRadius * 0.9)}
                    fill="transparent"
                    className="cursor-pointer"
                    onClick={(e) => handleFretClick(note, originalStringIdx, fret, e)}
                  />
                );
              }

              const dotFill = isFi ? "#141414" : color;
              const dotStroke = isOverlayExtra
                ? "#22d3ee"
                : isOverlayHit || activeFinger?.isAnchor
                  ? "#34d399"
                  : isTonic
                    ? "#ffffff"
                    : isFi
                      ? "#38BDF8"
                      : "rgba(255,255,255,0.65)";

              return (
                <g
                  key={`${stringIdx}-${fret}`}
                  className="cursor-pointer"
                  onClick={(e) => handleFretClick(note, originalStringIdx, fret, e)}
                  opacity={isNonGripOccurrence ? 0.22 : deEmphasiseOutsideWindow ? 0.45 : 1}
                  style={fading && trailMode ? {
                    opacity: isNonGripOccurrence ? 0.22 : deEmphasiseOutsideWindow ? 0.45 : 1,
                    animation: `note-fade-out ${FADE_DURATION}ms ease-out forwards`,
                  } : undefined}
                >
                  <title>{`${displayLabel} (${pc}${Note.octave(note) ?? ""})${activeFinger ? ` · Finger ${activeFinger.finger}` : ""}`}</title>
                  {trailMode && (
                    <>
                      <circle
                        cx={x}
                        cy={y}
                        r={fading ? geom.noteRadius * 1.7 : geom.noteRadius * 1.32}
                        fill="none"
                        stroke={color}
                        strokeWidth="1.5"
                        opacity={fading ? 0 : 0.55}
                        style={{
                          transition: `r ${FADE_DURATION}ms ease-out, opacity ${FADE_DURATION}ms ease-out`,
                        }}
                      />
                      {pressed && (
                        <circle
                          cx={x}
                          cy={y}
                          r={geom.noteRadius * 1.32}
                          fill="none"
                          stroke={color}
                          strokeWidth="1"
                          className="fret-ripple"
                        />
                      )}
                    </>
                  )}
                  <circle
                    cx={x}
                    cy={y}
                    r={geom.noteRadius}
                    fill={dotFill}
                    stroke={dotStroke}
                    strokeWidth={isOverlayExtra || isOverlayHit || activeFinger?.isAnchor ? 2.2 : isTonic ? 1.6 : 1}
                    className={pressed ? "note-active" : undefined}
                  />
                  <text
                    x={x}
                    y={y + textYOffset}
                    fill={textFill}
                    fontSize={fontSize}
                    fontFamily="JetBrains Mono"
                    textAnchor="middle"
                    fontWeight="bold"
                  >
                    {displayLabel}
                  </text>
                  {showFingering && activeFinger && (
                    <g
                      transform={`translate(${x + geom.noteRadius * 0.8}, ${y - geom.noteRadius * 0.75})`}
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingPosKey(prev => (prev === posKey ? null : posKey));
                      }}
                    >
                      <title>Click to edit finger (0–4 / Auto)</title>
                      <circle r={Math.max(12, badgeR * 1.6)} fill="transparent" />
                      <circle
                        r={badgeR}
                        fill="#090d16"
                        stroke={activeFinger.isAnchor ? "#34d399" : "#f8fafc"}
                        strokeWidth="0.9"
                      />
                      <text
                        y={badgeR * 0.38}
                        textAnchor="middle"
                        fontSize={badgeR * 1.25}
                        fontFamily="JetBrains Mono"
                        fontWeight="bold"
                        fill={activeFinger.isAnchor ? "#6ee7b7" : "#f8fafc"}
                      >
                        {activeFinger.finger}
                      </text>
                    </g>
                  )}
                </g>
              );
            });
          })}

          {/* Right-hand picking / fingerstyle badges at bridge end of strings */}
          {showFingering && guitarRightHandMode !== "off" && strings.map((_openNote, stringIdx) => {
            const y = getStringY(stringIdx);
            const originalStringIdx = strings.length - 1 - stringIdx;
            const pick = activePickByString.get(originalStringIdx);
            const nextPick = nextPickByString.get(originalStringIdx);
            if (!pick && !nextPick) return null;

            const badgeX = geom.bridgeX - 11;
            if (pick) {
              return (
                <g
                  key={`rh-${stringIdx}`}
                  transform={`translate(${badgeX}, ${y})`}
                  className="cursor-pointer"
                  onClick={(e) => handleCycleRightHand(originalStringIdx, e)}
                >
                  <title>{`Right-hand: ${pick.displaySymbol} (Click to cycle · Alt+Click for Auto)`}</title>
                  <rect
                    x={-10}
                    y={-8}
                    width={20}
                    height={16}
                    rx={3}
                    fill="#090d16"
                    stroke={pick.isAnchor ? "#34d399" : "#fbbf24"}
                    strokeWidth={1.1}
                  />
                  <text
                    y={3.6}
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily="JetBrains Mono"
                    fontWeight="bold"
                    fill={pick.isAnchor ? "#6ee7b7" : "#fde68a"}
                  >
                    {pick.displaySymbol}
                  </text>
                </g>
              );
            }

            if (nextPick) {
              return (
                <g key={`rh-next-${stringIdx}`} transform={`translate(${badgeX}, ${y})`}>
                  <title>{`Next right-hand prep: ${nextPick.displaySymbol}`}</title>
                  <rect
                    x={-9}
                    y={-6.5}
                    width={18}
                    height={13}
                    rx={3}
                    fill="rgba(15, 23, 42, 0.85)"
                    stroke="#34d399"
                    strokeWidth={0.9}
                    strokeDasharray="2 1.5"
                  />
                  <text
                    y={3}
                    textAnchor="middle"
                    fontSize="7.5"
                    fontFamily="JetBrains Mono"
                    fontWeight="bold"
                    fill="#6ee7b7"
                  >
                    {`→${nextPick.displaySymbol}`}
                  </text>
                </g>
              );
            }
            return null;
          })}

          {/* Fret numbers */}
          {visibleFretNumbers.map(fret => {
            const x = getFretCenterX(fret);
            const inWin = fret >= windowStart && fret <= windowEnd;
            return (
              <text
                key={`fnum-${fret}`}
                x={x}
                y={geom.fretNumY}
                fill={inWin ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
                fontSize={Math.max(9, Math.min(12, geom.stringGap * 0.32))}
                fontFamily="JetBrains Mono"
                fontWeight={inWin ? "bold" : "normal"}
                textAnchor="middle"
                opacity={inWin ? 0.95 : 0.55}
              >
                {fret}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
