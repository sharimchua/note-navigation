import React, { createContext, useContext, useState, useCallback, useRef, useMemo, useEffect } from "react";
import * as Tone from "tone";
import { getScaleNotes, isNoteInScale, NOTE_NAMES, GUITAR_TUNINGS, GuitarTuning, NOTE_NAMES_FLAT } from "@/lib/music-engine";
import { useMIDI, MIDIState } from "@/hooks/use-midi";
import { Note } from "tonal";

export type ScaleLabelMode = "solfege" | "degree";

interface HarmonicState {
  activeNotes: Set<string>;
  /** Notes that should still be shown in visualizations (includes recently released notes when trailMode is on) */
  visualNotes: string[];
  /** 0..1 intensity for visuals; stays >0 briefly after release when trailMode is on */
  getNoteIntensity: (note: string) => number;

  selectedKey: string;
  selectedScale: string;
  scaleRootOffset: number;
  scaleNotes: string[];
  isKeyLocked: boolean;
  scaleLabelMode: ScaleLabelMode;
  useFlats: boolean;
  isMuted: boolean;
  trailMode: boolean;
  midiState: MIDIState;
  selectedTuning: GuitarTuning;
  toggleNote: (note: string) => void;
  setActiveNotes: (notes: Set<string>) => void;
  clearNotes: () => void;
  setKey: (key: string) => void;
  setScale: (scale: string, rootOffset?: number) => void;
  setKeyLocked: (locked: boolean) => void;
  setScaleLabelMode: (mode: ScaleLabelMode) => void;
  setUseFlats: (useFlats: boolean) => void;
  setMuted: (muted: boolean) => void;
  setTrailMode: (trailMode: boolean) => void;
  setTuning: (tuning: GuitarTuning) => void;
  playNote: (note: string) => void;
  isNoteInCurrentScale: (note: string) => boolean;
}

// In Vite + React Fast Refresh, contexts can be re-created on hot updates,
// causing "used within Provider" errors if consumers hold a stale instance.
// Cache the context on globalThis in dev/HMR to keep a single instance.
const HarmonicContext = (() => {
  const g = globalThis as unknown as Record<string, unknown>;
  const KEY = "__note_navigation_harmonic_context__";
  const isHMR = !!(import.meta as any).hot;

  if (isHMR) {
    if (!g[KEY]) g[KEY] = createContext<HarmonicState | null>(null);
    return g[KEY] as React.Context<HarmonicState | null>;
  }

  return createContext<HarmonicState | null>(null);
})();

export function useHarmonic() {
  const ctx = useContext(HarmonicContext);
  if (!ctx) throw new Error("useHarmonic must be used within HarmonicProvider");
  return ctx;
}

export function HarmonicProvider({ children }: { children: React.ReactNode }) {
  const RELEASE_FADE_MS = 850;

  const [activeNotes, setActiveNotesState] = useState<Set<string>>(new Set());
  const [selectedKey, setSelectedKey] = useState("C");
  const [selectedScale, setSelectedScale] = useState("major");
  const [scaleRootOffset, setScaleRootOffset] = useState(0);
  const [isKeyLocked, setKeyLocked] = useState(false);
  const [scaleLabelMode, setScaleLabelModeState] = useState<ScaleLabelMode>("solfege");
  // Auto-derive sharps/flats from key center (idiomatic to the key)
  const FLAT_KEYS = new Set(["F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb"]);
  const useFlats = FLAT_KEYS.has(selectedKey);
  const setUseFlats = (_: boolean) => {}; // no-op, kept for interface compat
  const [selectedTuning, setSelectedTuning] = useState<GuitarTuning>(GUITAR_TUNINGS[0]);
  const [isMuted, setMuted] = useState(false);
  const [trailMode, setTrailMode] = useState(false);

  // Notes that have been released and should linger briefly (for visual fade)
  const releasedAtRef = useRef<Map<string, number>>(new Map());
  const [releaseNow, setReleaseNow] = useState(0);
  const [releaseKick, setReleaseKick] = useState(0);

  const synthRef = useRef<Tone.PolySynth | null>(null);
  const audioStartedRef = useRef(false);

  useEffect(() => {
    if (!trailMode) {
      releasedAtRef.current.clear();
      return;
    }
    if (releasedAtRef.current.size === 0) return;

    let raf = 0;
    const tick = () => {
      const now = performance.now();
      let hasAny = false;

      for (const [note, t0] of releasedAtRef.current) {
        if (now - t0 >= RELEASE_FADE_MS) releasedAtRef.current.delete(note);
        else hasAny = true;
      }

      setReleaseNow(now);
      if (hasAny) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [trailMode, releaseKick]);

  const getSynth = useCallback(() => {
    if (!synthRef.current) {
      synthRef.current = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle8" },
        envelope: { attack: 0.02, decay: 0.3, sustain: 0.2, release: 0.8 },
      }).toDestination();
      synthRef.current.volume.value = -12;
    }
    return synthRef.current;
  }, []);

  const scaleNotes = useMemo(() => {
    if (scaleRootOffset === 0) return getScaleNotes(selectedKey, selectedScale);
    // Compute offset root note name
    const keyChroma = Note.chroma(selectedKey) ?? 0;
    const offsetChroma = (keyChroma + scaleRootOffset) % 12;
    const FLAT_KEYS_SET = new Set(["F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb"]);
    const useFlatsForRoot = FLAT_KEYS_SET.has(selectedKey);
    const offsetRoot = useFlatsForRoot ? NOTE_NAMES_FLAT[offsetChroma] : NOTE_NAMES[offsetChroma];
    return getScaleNotes(offsetRoot, selectedScale);
  }, [selectedKey, selectedScale, scaleRootOffset]);

  const visualNotes = useMemo(() => {
    const s = new Set<string>(activeNotes);
    if (trailMode) {
      for (const n of releasedAtRef.current.keys()) s.add(n);
    }
    return Array.from(s);
  }, [activeNotes, trailMode, releaseNow]);

  const getNoteIntensity = useCallback((note: string) => {
    if (activeNotes.has(note)) return 1;
    if (!trailMode) return 0;

    const t0 = releasedAtRef.current.get(note);
    if (!t0) return 0;

    const now = releaseNow || performance.now();
    const t = (now - t0) / RELEASE_FADE_MS;
    if (t >= 1) return 0;

    return Math.max(0, Math.min(1, 1 - t));
  }, [activeNotes, trailMode, releaseNow]);

  const addNote = useCallback((note: string) => {
    releasedAtRef.current.delete(note);
    setActiveNotesState(prev => {
      const next = new Set(prev);
      next.add(note);
      return next;
    });
  }, []);

  const removeNote = useCallback((note: string) => {
    if (trailMode) {
      releasedAtRef.current.set(note, performance.now());
      setReleaseKick(k => k + 1);
    }

    setActiveNotesState(prev => {
      const next = new Set(prev);
      next.delete(note);
      return next;
    });
  }, [trailMode]);

  const toggleNote = useCallback((note: string) => {
    setActiveNotesState(prev => {
      const next = new Set(prev);
      if (next.has(note)) {
        next.delete(note);
        if (trailMode) {
          releasedAtRef.current.set(note, performance.now());
          setReleaseKick(k => k + 1);
        }
      } else {
        next.add(note);
        releasedAtRef.current.delete(note);
      }
      return next;
    });
  }, [trailMode]);

  const setActiveNotes = useCallback((notes: Set<string>) => {
    setActiveNotesState(prev => {
      if (trailMode) {
        const now = performance.now();
        let changed = false;

        // Anything that was active but isn't anymore becomes a released visual.
        prev.forEach(n => {
          if (!notes.has(n)) {
            releasedAtRef.current.set(n, now);
            changed = true;
          }
        });

        // Anything newly active should stop being released.
        notes.forEach(n => {
          if (releasedAtRef.current.delete(n)) changed = true;
        });

        if (changed) setReleaseKick(k => k + 1);
      }
      return notes;
    });
  }, [trailMode]);

  const clearNotes = useCallback(() => {
    setActiveNotesState(prev => {
      if (trailMode && prev.size > 0) {
        const now = performance.now();
        prev.forEach(n => releasedAtRef.current.set(n, now));
        setReleaseKick(k => k + 1);
      }
      return new Set();
    });
  }, [trailMode]);

  const playNote = useCallback(async (note: string) => {
    if (isMuted) return;
    if (!audioStartedRef.current) {
      await Tone.start();
      audioStartedRef.current = true;
    }
    const synth = getSynth();
    synth.triggerAttackRelease(note, "8n");
  }, [getSynth, isMuted]);

  const handleMIDINoteOn = useCallback((note: string, velocity: number) => {
    addNote(note);
    playNote(note);
  }, [addNote, playNote]);

  const handleMIDINoteOff = useCallback((note: string) => {
    removeNote(note);
  }, [removeNote]);

  const midiState = useMIDI({
    onNoteOn: handleMIDINoteOn,
    onNoteOff: handleMIDINoteOff,
  });

  const isNoteInCurrentScale = useCallback((note: string) => {
    if (!isKeyLocked) return true;
    return isNoteInScale(note, scaleNotes);
  }, [isKeyLocked, scaleNotes]);

  const setKey = useCallback((key: string) => setSelectedKey(key), []);
  const setScale = useCallback((scale: string, rootOffset?: number) => {
    setSelectedScale(scale);
    setScaleRootOffset(rootOffset ?? 0);
  }, []);
  const setScaleLabelMode = useCallback((mode: ScaleLabelMode) => setScaleLabelModeState(mode), []);
  const setTuning = useCallback((tuning: GuitarTuning) => setSelectedTuning(tuning), []);

  return React.createElement(HarmonicContext.Provider, {
    value: {
      activeNotes,
      selectedKey,
      selectedScale,
      scaleRootOffset,
      scaleNotes,
      isKeyLocked,
      scaleLabelMode,
      useFlats,
      isMuted,
      trailMode,
      midiState,
      selectedTuning,
      toggleNote,
      setActiveNotes,
      clearNotes,
      setKey,
      setScale,
      setKeyLocked,
      setScaleLabelMode,
      setUseFlats,
      setMuted,
      setTrailMode,
      setTuning,
      playNote,
      isNoteInCurrentScale,
    }
  }, children);
}