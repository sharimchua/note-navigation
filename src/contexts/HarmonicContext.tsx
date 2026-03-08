import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import * as Tone from "tone";
import { getScaleNotes, isNoteInScale, NOTE_NAMES, GUITAR_TUNINGS, GuitarTuning } from "@/lib/music-engine";
import { useMIDI, MIDIState } from "@/hooks/use-midi";

export interface HandPosition {
  enabled: boolean;
  rootNote: string; // e.g. "C4"
}

interface HarmonicState {
  activeNotes: Set<string>; // full note names like "C4"
  selectedKey: string;
  selectedScale: string;
  scaleNotes: string[];
  isKeyLocked: boolean;
  useFlats: boolean;
  midiState: MIDIState;
  selectedTuning: GuitarTuning;
  leftHand: HandPosition;
  rightHand: HandPosition;
  toggleNote: (note: string) => void;
  setActiveNotes: (notes: Set<string>) => void;
  clearNotes: () => void;
  setKey: (key: string) => void;
  setScale: (scale: string) => void;
  setKeyLocked: (locked: boolean) => void;
  setUseFlats: (useFlats: boolean) => void;
  setTuning: (tuning: GuitarTuning) => void;
  setLeftHand: (hand: HandPosition) => void;
  setRightHand: (hand: HandPosition) => void;
  playNote: (note: string) => void;
  isNoteInCurrentScale: (note: string) => boolean;
}

const HarmonicContext = createContext<HarmonicState | null>(null);

export function useHarmonic() {
  const ctx = useContext(HarmonicContext);
  if (!ctx) throw new Error("useHarmonic must be used within HarmonicProvider");
  return ctx;
}

export function HarmonicProvider({ children }: { children: React.ReactNode }) {
  const [activeNotes, setActiveNotesState] = useState<Set<string>>(new Set());
  const [selectedKey, setSelectedKey] = useState("C");
  const [selectedScale, setSelectedScale] = useState("major");
  const [isKeyLocked, setKeyLocked] = useState(false);
  const [useFlats, setUseFlats] = useState(false);
  const [selectedTuning, setSelectedTuning] = useState<GuitarTuning>(GUITAR_TUNINGS[0]);
  const [leftHand, setLeftHand] = useState<HandPosition>({ enabled: false, rootNote: "C3" });
  const [rightHand, setRightHand] = useState<HandPosition>({ enabled: false, rootNote: "C4" });
  const synthRef = useRef<Tone.PolySynth | null>(null);

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

  const scaleNotes = getScaleNotes(selectedKey, selectedScale);

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
    await Tone.start();
    const synth = getSynth();
    synth.triggerAttackRelease(note, "8n");
  }, [getSynth]);

  // MIDI input handlers
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
  const setScale = useCallback((scale: string) => setSelectedScale(scale), []);
  const setTuning = useCallback((tuning: GuitarTuning) => setSelectedTuning(tuning), []);
  const setLeftHandCb = useCallback((hand: HandPosition) => setLeftHand(hand), []);
  const setRightHandCb = useCallback((hand: HandPosition) => setRightHand(hand), []);

  return React.createElement(HarmonicContext.Provider, {
    value: {
      activeNotes,
      selectedKey,
      selectedScale,
      scaleNotes,
      isKeyLocked,
      useFlats,
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
      setUseFlats,
      setTuning,
      setLeftHand: setLeftHandCb,
      setRightHand: setRightHandCb,
      playNote,
      isNoteInCurrentScale,
    }
  }, children);
}
