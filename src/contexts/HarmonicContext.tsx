import React, { createContext, useContext, useState, useCallback, useRef, useMemo, useEffect } from "react";
import * as Tone from "tone";
import { getScaleNotes, isNoteInScale, NOTE_NAMES, GUITAR_TUNINGS, GuitarTuning, NOTE_NAMES_FLAT } from "@/lib/music-engine";
import { useMIDI, MIDIState } from "@/hooks/use-midi";
import { Note } from "tonal";

export type ScaleLabelMode = "solfege" | "degree";

interface NoteState {
  note: string;
  pressed: boolean;  // currently held down
  fading: boolean;   // released but still visible (trail mode only)
}

interface HarmonicState {
  activeNotes: Set<string>;
  /** Notes that should be shown in visualizations with their state */
  noteStates: NoteState[];
  /** Check if a note is currently pressed or fading */
  isNoteVisible: (note: string) => boolean;
  isNotePressed: (note: string) => boolean;
  isNoteFading: (note: string) => boolean;

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

  // Notes currently fading (released but still visible)
  const [fadingNotes, setFadingNotes] = useState<Set<string>>(new Set());
  const fadeTimersRef = useRef<Map<string, number>>(new Map());

  const synthRef = useRef<Tone.PolySynth | null>(null);
  const audioStartedRef = useRef(false);

  // Cleanup fading notes when trail mode is disabled
  useEffect(() => {
    if (!trailMode) {
      fadeTimersRef.current.forEach(timer => clearTimeout(timer));
      fadeTimersRef.current.clear();
      setFadingNotes(new Set());
    }
  }, [trailMode]);

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
    const keyChroma = Note.chroma(selectedKey) ?? 0;
    const offsetChroma = (keyChroma + scaleRootOffset) % 12;
    const FLAT_KEYS_SET = new Set(["F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb"]);
    const useFlatsForRoot = FLAT_KEYS_SET.has(selectedKey);
    const offsetRoot = useFlatsForRoot ? NOTE_NAMES_FLAT[offsetChroma] : NOTE_NAMES[offsetChroma];
    return getScaleNotes(offsetRoot, selectedScale);
  }, [selectedKey, selectedScale, scaleRootOffset]);

  // Build noteStates array for all visible notes
  const noteStates = useMemo((): NoteState[] => {
    const states: NoteState[] = [];
    const seen = new Set<string>();
    
    activeNotes.forEach(note => {
      states.push({ note, pressed: true, fading: false });
      seen.add(note);
    });
    
    if (trailMode) {
      fadingNotes.forEach(note => {
        if (!seen.has(note)) {
          states.push({ note, pressed: false, fading: true });
        }
      });
    }
    
    return states;
  }, [activeNotes, fadingNotes, trailMode]);

  const isNoteVisible = useCallback((note: string) => {
    return activeNotes.has(note) || (trailMode && fadingNotes.has(note));
  }, [activeNotes, fadingNotes, trailMode]);

  const isNotePressed = useCallback((note: string) => {
    return activeNotes.has(note);
  }, [activeNotes]);

  const isNoteFading = useCallback((note: string) => {
    return trailMode && !activeNotes.has(note) && fadingNotes.has(note);
  }, [activeNotes, fadingNotes, trailMode]);

  const startFade = useCallback((note: string) => {
    if (!trailMode) return;
    
    // Clear any existing timer for this note
    const existingTimer = fadeTimersRef.current.get(note);
    if (existingTimer) clearTimeout(existingTimer);
    
    // Add to fading set
    setFadingNotes(prev => new Set(prev).add(note));
    
    // Set timer to remove after fade duration
    const timer = window.setTimeout(() => {
      setFadingNotes(prev => {
        const next = new Set(prev);
        next.delete(note);
        return next;
      });
      fadeTimersRef.current.delete(note);
    }, RELEASE_FADE_MS);
    
    fadeTimersRef.current.set(note, timer);
  }, [trailMode]);

  const stopFade = useCallback((note: string) => {
    const timer = fadeTimersRef.current.get(note);
    if (timer) {
      clearTimeout(timer);
      fadeTimersRef.current.delete(note);
    }
    setFadingNotes(prev => {
      const next = new Set(prev);
      next.delete(note);
      return next;
    });
  }, []);

  const addNote = useCallback((note: string) => {
    stopFade(note);
    setActiveNotesState(prev => {
      const next = new Set(prev);
      next.add(note);
      return next;
    });
  }, [stopFade]);

  const removeNote = useCallback((note: string) => {
    setActiveNotesState(prev => {
      const next = new Set(prev);
      next.delete(note);
      return next;
    });
    startFade(note);
  }, [startFade]);

  const toggleNote = useCallback((note: string) => {
    setActiveNotesState(prev => {
      const next = new Set(prev);
      if (next.has(note)) {
        next.delete(note);
        startFade(note);
      } else {
        next.add(note);
        stopFade(note);
      }
      return next;
    });
  }, [startFade, stopFade]);

  const setActiveNotes = useCallback((notes: Set<string>) => {
    setActiveNotesState(prev => {
      // Start fading for notes that were active but aren't anymore
      prev.forEach(n => {
        if (!notes.has(n)) startFade(n);
      });
      // Stop fading for notes that are now active
      notes.forEach(n => {
        if (!prev.has(n)) stopFade(n);
      });
      return notes;
    });
  }, [startFade, stopFade]);

  const clearNotes = useCallback(() => {
    setActiveNotesState(prev => {
      prev.forEach(n => startFade(n));
      return new Set();
    });
  }, [startFade]);

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

  useEffect(() => {
    // Trail mode is only meaningful for (and only controllable with) a connected MIDI device.
    if (!midiState.isConnected && trailMode) setTrailMode(false);
  }, [midiState.isConnected, trailMode]);

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
      noteStates,
      isNoteVisible,
      isNotePressed,
      isNoteFading,
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