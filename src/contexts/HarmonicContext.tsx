import React, { createContext, useContext, useState, useCallback, useRef, useMemo } from "react";
import * as Tone from "tone";
import { getScaleNotes, isNoteInScale, NOTE_NAMES, GUITAR_TUNINGS, GuitarTuning, NOTE_NAMES_FLAT } from "@/lib/music-engine";
import { useMIDI, MIDIState } from "@/hooks/use-midi";
import { Note } from "tonal";

export type ScaleLabelMode = "solfege" | "degree";

interface HarmonicState {
  activeNotes: Set<string>;
  selectedKey: string;
  selectedScale: string;
  scaleRootOffset: number;
  scaleNotes: string[];
  isKeyLocked: boolean;
  scaleLabelMode: ScaleLabelMode;
  useFlats: boolean;
  isMuted: boolean;
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
  const synthRef = useRef<Tone.PolySynth | null>(null);
  const audioStartedRef = useRef(false);

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

  const addNote = useCallback((note: string) => {
    setActiveNotesState(prev => {
      const next = new Set(prev);
      next.add(note);
      return next;
    });
  }, []);

  const removeNote = useCallback((note: string) => {
    setActiveNotesState(prev => {
      const next = new Set(prev);
      next.delete(note);
      return next;
    });
  }, []);

  const toggleNote = useCallback((note: string) => {
    setActiveNotesState(prev => {
      const next = new Set(prev);
      if (next.has(note)) {
        next.delete(note);
      } else {
        next.add(note);
      }
      return next;
    });
  }, []);

  const setActiveNotes = useCallback((notes: Set<string>) => {
    setActiveNotesState(notes);
  }, []);

  const clearNotes = useCallback(() => {
    setActiveNotesState(new Set());
  }, []);

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
      midiState,
      selectedTuning,
      leftHand,
      rightHand,
      toggleNote,
      setActiveNotes,
      clearNotes,
      setKey,
      setScale,
      setKeyLocked,
      setScaleLabelMode,
      setUseFlats,
      setMuted,
      setTuning,
      setLeftHand: setLeftHandCb,
      setRightHand: setRightHandCb,
      playNote,
      isNoteInCurrentScale,
    }
  }, children);
}