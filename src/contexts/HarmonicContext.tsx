import React, { createContext, useContext, useState, useCallback, useRef, useMemo, useEffect } from "react";
import * as Tone from "tone";
import {
  getScaleNotes,
  isNoteInScale,
  NOTE_NAMES,
  GUITAR_TUNINGS,
  GuitarTuning,
  NOTE_NAMES_FLAT,
  type NoteLabelMode,
  type AccidentalPreference,
} from "@/lib/music-engine";
import type { StaffLayoutMode } from "@/lib/staff-clef-assignment";
import {
  createEmptyOnset,
  createOnsetFromNotes,
  type PhraseOnset,
  type GuitarFingerOverride,
  type GuitarPickOverride,
  type PianoFingerOverride,
  type GuitarRightHandMode,
  type PhraseMidiMode,
  type PianoComfortSpan,
} from "@/lib/phrase-model";
import {
  LAYOUT_PRESETS,
  LAYOUT_STORAGE_KEY,
  PRESET_CLASSIC,
  type LayoutNode,
} from "@/lib/layout-models";
import {
  decodeShareSlug,
  type NoteNavShareSnapshot,
} from "@/lib/share-slug";
import {
  loadMidiSettings,
  saveMidiSettings,
  DEFAULT_MIDI_SETTINGS,
  evaluateCcRisingEdge,
  matchMidiBindingAction,
  shouldOverwritePhraseStepOnMidiNoteOn,
  type MidiBindingsConfig,
  type MidiBindingActionId,
  type MidiTrigger,
} from "@/lib/midi-bindings";
import { useMIDI, MIDIState } from "@/hooks/use-midi";
import { useStageBridge, type SyncableNoteNavState } from "@/hooks/useStageBridge";
import { Note } from "tonal";

export type ScaleLabelMode = "solfege" | "degree";

export interface NoteState {
  note: string;
  pressed: boolean;
  fading: boolean;
  seq: number;
}

interface HarmonicState {
  activeNotes: Set<string>;
  noteStates: NoteState[];
  isNoteVisible: (note: string) => boolean;
  isNotePressed: (note: string) => boolean;
  isNoteFading: (note: string) => boolean;

  selectedKey: string;
  selectedScale: string;
  scaleRootOffset: number;
  scaleNotes: string[];
  scaleIntervals: number[];
  isKeyLocked: boolean;
  scaleLabelMode: ScaleLabelMode;
  labelMode: NoteLabelMode;
  accidentalPreference: AccidentalPreference;
  useFlats: boolean;
  pptNoteheads: boolean;
  staffLayoutMode: StaffLayoutMode;
  showPianoTriangles: boolean;
  ecoMode: boolean;
  isStageEmbedded: boolean;
  isMuted: boolean;
  isHoldEnabled: boolean;
  trailMode: boolean;
  midiState: MIDIState;
  selectedTuning: GuitarTuning;

  // Phrase / sequence state
  phraseMode: boolean;
  phraseOnsets: PhraseOnset[];
  activeStepIndex: number;
  nextStepIndex: number | null;
  loopPhrase: boolean;
  isRecordingPhrase: boolean;
  isPlayingPhrase: boolean;
  nextOnsetNotes: Set<string>;
  overlayNotes: Set<string>;
  showFingering: boolean;
  showNextPreview: boolean;
  guitarRightHandMode: GuitarRightHandMode;
  pianoComfortSpan: PianoComfortSpan;

  // Modular layout state
  layoutPresetId: string;
  layoutRoot: LayoutNode;
  setLayoutPreset: (presetId: string) => void;
  setCustomLayout: (root: LayoutNode) => void;

  toggleNote: (note: string) => void;
  setActiveNotes: (notes: Set<string>) => void;
  clearNotes: () => void;
  setKey: (key: string) => void;
  setScale: (scale: string, rootOffset?: number) => void;
  setKeyLocked: (locked: boolean) => void;
  setScaleLabelMode: (mode: ScaleLabelMode) => void;
  setLabelMode: (mode: NoteLabelMode) => void;
  setAccidentalPreference: (pref: AccidentalPreference) => void;
  setUseFlats: (useFlats: boolean) => void;
  setPptNoteheads: (on: boolean) => void;
  setStaffLayoutMode: (mode: StaffLayoutMode) => void;
  setShowPianoTriangles: (on: boolean) => void;
  setMuted: (muted: boolean) => void;
  setHoldEnabled: (on: boolean) => void;
  toggleHold: () => void;
  setTrailMode: (trailMode: boolean) => void;
  setTuning: (tuning: GuitarTuning) => void;
  playNote: (note: string) => void;
  isNoteInCurrentScale: (note: string) => boolean;

  // Phrase & fingering actions
  setPhraseMode: (on: boolean) => void;
  setActiveStepIndex: (index: number, audition?: boolean) => void;
  setLoopPhrase: (on: boolean) => void;
  stepPrev: () => void;
  stepNext: () => void;
  stepForwardOrAdd: () => void;
  addPhraseStep: () => void;
  duplicatePhraseStep: () => void;
  removePhraseStep: (index?: number) => void;
  clearPhrase: () => void;
  setRecordingPhrase: (on: boolean) => void;
  playPhrase: () => void;
  stopPhrasePlayback: () => void;
  setShowFingering: (on: boolean) => void;
  setShowNextPreview: (on: boolean) => void;
  setGuitarRightHandMode: (mode: GuitarRightHandMode) => void;
  setPianoComfortSpan: (span: PianoComfortSpan) => void;
  setGuitarFingerOverride: (onsetIdx: number, posKey: string, override: GuitarFingerOverride) => void;
  clearGuitarFingerOverride: (onsetIdx: number, posKey: string) => void;
  setGuitarPickOverride: (onsetIdx: number, stringIdx: number, override: GuitarPickOverride) => void;
  clearGuitarPickOverride: (onsetIdx: number, stringIdx: number) => void;
  setPianoFingerOverride: (onsetIdx: number, note: string, override: PianoFingerOverride) => void;
  clearPianoFingerOverride: (onsetIdx: number, note: string) => void;
  setPhraseMidiMode: (mode: PhraseMidiMode) => void;
  setPhraseAutoAdvance: (on: boolean) => void;
  setPhraseMatchPitchClassOnly: (on: boolean) => void;

  // MIDI Settings & Bindings
  midiSettings: MidiBindingsConfig;
  midiLearnAction: MidiBindingActionId | null;
  lastMidiActivity: string | null;
  updateMidiSettings: (partial: Partial<MidiBindingsConfig>) => void;
  setMidiBinding: (action: MidiBindingActionId, trigger: MidiTrigger | null) => void;
  resetMidiSettings: () => void;
  startMidiLearn: (action: MidiBindingActionId) => void;
  cancelMidiLearn: () => void;

  // Snapshot / Share slug
  getShareSnapshot: () => NoteNavShareSnapshot;
  hydrateFromSnapshot: (snap: NoteNavShareSnapshot) => void;
}

const HarmonicContext = (() => {
  const g = globalThis as unknown as Record<string, unknown>;
  const KEY = "__note_navigation_harmonic_context__";
  const isHMR = !!(import.meta as { hot?: unknown }).hot;

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

const FLAT_KEYS = new Set(["F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb"]);

function loadInitialLayout(): { presetId: string; root: LayoutNode } {
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { presetId?: string; root?: LayoutNode };
        if (parsed?.root && typeof parsed.root === "object") {
          return {
            presetId: typeof parsed.presetId === "string" ? parsed.presetId : "custom",
            root: parsed.root,
          };
        }
      }
    } catch {
      // fallback to classic preset
    }
  }
  return { presetId: PRESET_CLASSIC.id, root: PRESET_CLASSIC.root };
}

export function HarmonicProvider({ children }: { children: React.ReactNode }) {
  const RELEASE_FADE_MS = 850;

  const initialLayout = useMemo(() => loadInitialLayout(), []);

  const [activeNotes, setActiveNotesState] = useState<Set<string>>(new Set());
  const [selectedKey, setSelectedKey] = useState("C");
  const [selectedScale, setSelectedScale] = useState("major");
  const [scaleRootOffset, setScaleRootOffset] = useState(0);
  const [isKeyLocked, setKeyLocked] = useState(false);
  const [scaleLabelMode, setScaleLabelModeState] = useState<ScaleLabelMode>("solfege");
  const [labelMode, setLabelModeState] = useState<NoteLabelMode>("notes");
  const [accidentalPreference, setAccidentalPreference] = useState<AccidentalPreference>("auto");
  const [pptNoteheads, setPptNoteheads] = useState<boolean>(true);
  const [staffLayoutMode, setStaffLayoutMode] = useState<StaffLayoutMode>("joined");
  const [showPianoTriangles, setShowPianoTriangles] = useState<boolean>(false);
  const [ecoMode, setEcoMode] = useState<boolean>(false);

  // Layout state
  const [layoutPresetId, setLayoutPresetId] = useState<string>(initialLayout.presetId);
  const [layoutRoot, setLayoutRoot] = useState<LayoutNode>(initialLayout.root);

  // Phrase & fingering state
  const [phraseMode, setPhraseModeState] = useState<boolean>(false);
  const [phraseOnsets, setPhraseOnsets] = useState<PhraseOnset[]>(() => [createEmptyOnset()]);
  const [activeStepIndex, setActiveStepIndexState] = useState<number>(0);
  const [loopPhrase, setLoopPhrase] = useState<boolean>(false);
  const [isRecordingPhrase, setRecordingPhraseState] = useState<boolean>(false);
  const [isPlayingPhrase, setIsPlayingPhrase] = useState<boolean>(false);
  const [overlayNotes, setOverlayNotesState] = useState<Set<string>>(new Set());
  const [showFingering, setShowFingering] = useState<boolean>(false);
  const [showNextPreview, setShowNextPreview] = useState<boolean>(true);
  const [guitarRightHandMode, setGuitarRightHandMode] = useState<GuitarRightHandMode>("off");
  const [pianoComfortSpan, setPianoComfortSpan] = useState<PianoComfortSpan>(12);

  // MIDI Settings & Learn state
  const [midiSettings, setMidiSettings] = useState<MidiBindingsConfig>(() => loadMidiSettings());
  const [midiLearnAction, setMidiLearnAction] = useState<MidiBindingActionId | null>(null);
  const [lastMidiActivity, setLastMidiActivity] = useState<string | null>(null);

  const seqCounterRef = useRef(0);
  const noteSeqMapRef = useRef<Map<string, number>>(new Map());
  const isApplyingStepRef = useRef(false);
  const hadMidiReleaseSinceStepRef = useRef(false);
  const phrasePlayTimersRef = useRef<number[]>([]);
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const hasFreshMidiOnStepRef = useRef(false);
  const overlayNotesRef = useRef<Set<string>>(new Set());
  const loopPhraseRef = useRef(loopPhrase);
  loopPhraseRef.current = loopPhrase;
  const midiSettingsRef = useRef(midiSettings);
  midiSettingsRef.current = midiSettings;
  const midiLearnActionRef = useRef(midiLearnAction);
  midiLearnActionRef.current = midiLearnAction;
  const ccPressedRef = useRef<Map<number, boolean>>(new Map());
  const lastMidiNoteOnAtRef = useRef<number>(0);
  const lastMidiCaptureStepRef = useRef<number>(-1);
  const activeNotesRef = useRef(activeNotes);
  activeNotesRef.current = activeNotes;
  const isPlayingPhraseRef = useRef(isPlayingPhrase);
  isPlayingPhraseRef.current = isPlayingPhrase;

  const useFlats = useMemo(() => {
    if (accidentalPreference === "flats") return true;
    if (accidentalPreference === "sharps") return false;
    return FLAT_KEYS.has(selectedKey);
  }, [accidentalPreference, selectedKey]);

  const setUseFlats = useCallback((flats: boolean) => {
    setAccidentalPreference(flats ? "flats" : "sharps");
  }, []);

  const [selectedTuning, setSelectedTuning] = useState<GuitarTuning>(GUITAR_TUNINGS[0]);
  const [isMuted, setMuted] = useState(false);
  const [isHoldEnabled, setHoldEnabledState] = useState(false);
  const [trailMode, setTrailMode] = useState(false);
  const [suppressLocalMidi, setSuppressLocalMidi] = useState(false);

  const isHoldEnabledRef = useRef(false);
  const physicalMidiNotesRef = useRef<Set<string>>(new Set());
  const latchedMidiNotesRef = useRef<Set<string>>(new Set());

  const [fadingNotes, setFadingNotes] = useState<Set<string>>(new Set());
  const fadeTimersRef = useRef<Map<string, number>>(new Map());

  const synthRef = useRef<Tone.PolySynth | null>(null);
  const audioStartedRef = useRef(false);

  // Persist layout changes to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        LAYOUT_STORAGE_KEY,
        JSON.stringify({ presetId: layoutPresetId, root: layoutRoot })
      );
    } catch {
      // ignore quota errors
    }
  }, [layoutPresetId, layoutRoot]);

  const setLayoutPreset = useCallback((presetId: string) => {
    const found = LAYOUT_PRESETS.find(p => p.id === presetId);
    if (!found) return;
    setLayoutPresetId(found.id);
    setLayoutRoot(found.root);
  }, []);

  const setCustomLayout = useCallback((root: LayoutNode) => {
    setLayoutPresetId("custom");
    setLayoutRoot(root);
  }, []);

  useEffect(() => {
    saveMidiSettings(midiSettings);
  }, [midiSettings]);

  const updateMidiSettings = useCallback((partial: Partial<MidiBindingsConfig>) => {
    setMidiSettings(prev => ({
      ...prev,
      ...partial,
      bindings: partial.bindings ? { ...prev.bindings, ...partial.bindings } : prev.bindings,
    }));
  }, []);

  const setPhraseMidiMode = useCallback((mode: PhraseMidiMode) => {
    updateMidiSettings({ phraseMidiMode: mode });
    if (mode !== "play-over") {
      overlayNotesRef.current = new Set();
      setOverlayNotesState(new Set());
    }
  }, [updateMidiSettings]);

  const setPhraseAutoAdvance = useCallback((on: boolean) => {
    updateMidiSettings({ phraseAutoAdvance: on });
  }, [updateMidiSettings]);

  const setPhraseMatchPitchClassOnly = useCallback((on: boolean) => {
    updateMidiSettings({ phraseMatchPitchClassOnly: on });
  }, [updateMidiSettings]);

  const setMidiBinding = useCallback((action: MidiBindingActionId, trigger: MidiTrigger | null) => {
    setMidiSettings(prev => ({
      ...prev,
      bindings: {
        ...prev.bindings,
        [action]: trigger,
      },
    }));
  }, []);

  const resetMidiSettings = useCallback(() => {
    setMidiSettings({
      ...DEFAULT_MIDI_SETTINGS,
      bindings: { ...DEFAULT_MIDI_SETTINGS.bindings },
    });
    setMidiLearnAction(null);
  }, []);

  const startMidiLearn = useCallback((action: MidiBindingActionId) => {
    setMidiLearnAction(action);
  }, []);

  const cancelMidiLearn = useCallback(() => {
    setMidiLearnAction(null);
  }, []);

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
    const useFlatsForRoot = FLAT_KEYS.has(selectedKey);
    const offsetRoot = useFlatsForRoot ? NOTE_NAMES_FLAT[offsetChroma] : NOTE_NAMES[offsetChroma];
    return getScaleNotes(offsetRoot, selectedScale);
  }, [selectedKey, selectedScale, scaleRootOffset]);

  const scaleIntervals = useMemo(() => {
    if (!isKeyLocked || scaleNotes.length < 5) {
      return [0, 2, 4, 5, 7, 9, 11];
    }
    const rootChroma = Note.chroma(scaleNotes[0]) ?? (Note.chroma(selectedKey) ?? 0);
    return scaleNotes.map(n => ((Note.chroma(n) ?? 0) - rootChroma + 12) % 12);
  }, [isKeyLocked, scaleNotes, selectedKey]);

  const noteStates = useMemo((): NoteState[] => {
    const states: NoteState[] = [];
    const seen = new Set<string>();

    activeNotes.forEach(note => {
      states.push({
        note,
        pressed: true,
        fading: false,
        seq: noteSeqMapRef.current.get(note) ?? 0,
      });
      seen.add(note);
    });

    overlayNotes.forEach(note => {
      if (!seen.has(note)) {
        states.push({
          note,
          pressed: true,
          fading: false,
          seq: noteSeqMapRef.current.get(note) ?? 0,
        });
        seen.add(note);
      }
    });

    if (trailMode) {
      fadingNotes.forEach(note => {
        if (!seen.has(note)) {
          states.push({
            note,
            pressed: false,
            fading: true,
            seq: noteSeqMapRef.current.get(note) ?? 0,
          });
        }
      });
    }

    return states;
  }, [activeNotes, overlayNotes, fadingNotes, trailMode]);

  const isNoteVisible = useCallback((note: string) => {
    return activeNotes.has(note) || overlayNotes.has(note) || (trailMode && fadingNotes.has(note));
  }, [activeNotes, overlayNotes, fadingNotes, trailMode]);

  const isNotePressed = useCallback((note: string) => {
    return activeNotes.has(note) || overlayNotes.has(note);
  }, [activeNotes, overlayNotes]);

  const isNoteFading = useCallback((note: string) => {
    return trailMode && !activeNotes.has(note) && !overlayNotes.has(note) && fadingNotes.has(note);
  }, [activeNotes, overlayNotes, fadingNotes, trailMode]);

  const recordNoteSeq = useCallback((note: string) => {
    if (!noteSeqMapRef.current.has(note)) {
      seqCounterRef.current += 1;
      noteSeqMapRef.current.set(note, seqCounterRef.current);
    }
  }, []);

  const startFade = useCallback((note: string) => {
    if (!trailMode) return;
    const existingTimer = fadeTimersRef.current.get(note);
    if (existingTimer) clearTimeout(existingTimer);

    setFadingNotes(prev => new Set(prev).add(note));
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
    recordNoteSeq(note);
    setActiveNotesState(prev => {
      const next = new Set(prev);
      next.add(note);
      return next;
    });
  }, [stopFade, recordNoteSeq]);

  const removeNote = useCallback((note: string) => {
    setActiveNotesState(prev => {
      const next = new Set(prev);
      next.delete(note);
      return next;
    });
    startFade(note);
  }, [startFade]);

  const toggleNote = useCallback((note: string) => {
    isApplyingStepRef.current = false;
    setActiveNotesState(prev => {
      const next = new Set(prev);
      if (next.has(note)) {
        next.delete(note);
        startFade(note);
      } else {
        recordNoteSeq(note);
        next.add(note);
        stopFade(note);
      }
      return next;
    });
  }, [startFade, stopFade, recordNoteSeq]);

  const setActiveNotes = useCallback((notes: Set<string>) => {
    setActiveNotesState(prev => {
      prev.forEach(n => {
        if (!notes.has(n)) startFade(n);
      });
      notes.forEach(n => {
        if (!prev.has(n)) {
          stopFade(n);
          recordNoteSeq(n);
        }
      });
      return notes;
    });
  }, [startFade, stopFade, recordNoteSeq]);

  // Keep active onset synced with activeNotes when in phraseMode
  useEffect(() => {
    if (!phraseMode || isApplyingStepRef.current) return;
    const arr = Array.from(activeNotes);
    setPhraseOnsets(prev => {
      const idx = Math.min(activeStepIndex, prev.length - 1);
      if (idx < 0) return prev;
      const cur = prev[idx];
      if (cur.notes.length === arr.length && cur.notes.every((n, i) => n === arr[i])) {
        return prev;
      }
      const next = [...prev];
      next[idx] = { ...cur, notes: arr };
      return next;
    });
  }, [phraseMode, activeNotes, activeStepIndex]);

  const nextStepIndex = useMemo(() => {
    if (!phraseMode || phraseOnsets.length <= 1) return null;
    if (activeStepIndex + 1 < phraseOnsets.length) return activeStepIndex + 1;
    return loopPhrase ? 0 : null;
  }, [phraseMode, phraseOnsets.length, activeStepIndex, loopPhrase]);

  const nextOnsetNotes = useMemo(() => {
    if (nextStepIndex === null) {
      return new Set<string>();
    }
    return new Set(phraseOnsets[nextStepIndex]?.notes ?? []);
  }, [nextStepIndex, phraseOnsets]);

  const stopPhrasePlayback = useCallback(() => {
    phrasePlayTimersRef.current.forEach(id => clearTimeout(id));
    phrasePlayTimersRef.current = [];
    setIsPlayingPhrase(false);
  }, []);

  const clearNotes = useCallback(() => {
    stopPhrasePlayback();
    if (autoAdvanceTimerRef.current !== null) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    physicalMidiNotesRef.current.clear();
    latchedMidiNotesRef.current.clear();
    isHoldEnabledRef.current = false;
    setHoldEnabledState(false);

    const hadOverlay = overlayNotesRef.current.size > 0;
    overlayNotesRef.current = new Set();
    setOverlayNotesState(new Set());

    // In Play Over mode, Esc clears live demo notes first without erasing the saved chord
    if (phraseRecRef.current.phraseMode && midiSettingsRef.current.phraseMidiMode === "play-over" && hadOverlay) {
      return;
    }

    setActiveNotesState(prev => {
      prev.forEach(n => startFade(n));
      return new Set();
    });
  }, [startFade, stopPhrasePlayback]);

  const setHoldEnabled = useCallback((on: boolean) => {
    isHoldEnabledRef.current = on;
    setHoldEnabledState(on);
    if (!on) {
      latchedMidiNotesRef.current.forEach(n => {
        if (!physicalMidiNotesRef.current.has(n)) {
          removeNote(n);
        }
      });
      latchedMidiNotesRef.current.clear();
    }
  }, [removeNote]);

  const toggleHold = useCallback(() => {
    setHoldEnabled(!isHoldEnabledRef.current);
  }, [setHoldEnabled]);

  const playNote = useCallback(async (note: string) => {
    if (isMuted) return;
    if (!audioStartedRef.current) {
      await Tone.start();
      audioStartedRef.current = true;
    }
    const synth = getSynth();
    synth.triggerAttackRelease(note, "8n");
  }, [getSynth, isMuted]);

  const playNotesSimultaneous = useCallback(async (notes: string[]) => {
    if (isMuted || notes.length === 0) return;
    if (!audioStartedRef.current) {
      await Tone.start();
      audioStartedRef.current = true;
    }
    const synth = getSynth();
    synth.triggerAttackRelease(notes, "4n");
  }, [getSynth, isMuted]);

  const resetPhraseCaptureClock = useCallback(() => {
    lastMidiNoteOnAtRef.current = 0;
    lastMidiCaptureStepRef.current = -1;
    hasFreshMidiOnStepRef.current = false;
    if (autoAdvanceTimerRef.current !== null) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  }, []);

  const loadStepNotes = useCallback((onset: PhraseOnset | undefined, audition = false) => {
    resetPhraseCaptureClock();
    isApplyingStepRef.current = true;
    const notes = onset?.notes ?? [];
    notes.forEach(n => recordNoteSeq(n));
    setActiveNotes(new Set(notes));
    if (audition && notes.length > 0) {
      void playNotesSimultaneous(notes);
    }
    window.setTimeout(() => {
      isApplyingStepRef.current = false;
    }, 10);
  }, [resetPhraseCaptureClock, recordNoteSeq, setActiveNotes, playNotesSimultaneous]);

  const setPhraseMode = useCallback((on: boolean) => {
    setPhraseModeState(on);
    if (on) {
      const currentNotes = Array.from(activeNotes);
      setPhraseOnsets(prev => {
        if (prev.length === 1 && prev[0].notes.length === 0 && currentNotes.length > 0) {
          return [{ ...prev[0], notes: currentNotes }];
        }
        return prev;
      });
    } else {
      setRecordingPhraseState(false);
      stopPhrasePlayback();
      overlayNotesRef.current = new Set();
      setOverlayNotesState(new Set());
    }
  }, [activeNotes, stopPhrasePlayback]);

  const setActiveStepIndex = useCallback((index: number, audition = true) => {
    const clamped = Math.max(0, Math.min(phraseOnsets.length - 1, index));
    setActiveStepIndexState(clamped);
    loadStepNotes(phraseOnsets[clamped], audition);
  }, [phraseOnsets, loadStepNotes]);

  const stepPrev = useCallback(() => {
    if (activeStepIndex > 0) {
      setActiveStepIndex(activeStepIndex - 1, true);
    } else if (loopPhrase && phraseOnsets.length > 1) {
      setActiveStepIndex(phraseOnsets.length - 1, true);
    }
  }, [activeStepIndex, loopPhrase, phraseOnsets.length, setActiveStepIndex]);

  const stepNext = useCallback(() => {
    if (activeStepIndex + 1 < phraseOnsets.length) {
      setActiveStepIndex(activeStepIndex + 1, true);
    } else if (loopPhrase && phraseOnsets.length > 1) {
      setActiveStepIndex(0, true);
    }
  }, [activeStepIndex, loopPhrase, phraseOnsets.length, setActiveStepIndex]);

  const stepForwardOrAdd = useCallback(() => {
    const rec = phraseRecRef.current;
    if (!rec.phraseMode) {
      setPhraseModeState(true);
      const currentNotes = Array.from(activeNotesRef.current);
      const base =
        rec.phraseOnsets.length === 1 && rec.phraseOnsets[0].notes.length === 0 && currentNotes.length > 0
          ? [{ ...rec.phraseOnsets[0], notes: currentNotes }]
          : rec.phraseOnsets;
      const newOnset = createEmptyOnset();
      const nextIdx = base.length;
      setPhraseOnsets([...base, newOnset]);
      setActiveStepIndexState(nextIdx);
      loadStepNotes(newOnset, false);
      return;
    }

    if (rec.activeStepIndex + 1 < rec.phraseOnsets.length) {
      const nextIdx = rec.activeStepIndex + 1;
      setActiveStepIndexState(nextIdx);
      loadStepNotes(rec.phraseOnsets[nextIdx], true);
      return;
    }

    const newOnset = createEmptyOnset();
    const nextIdx = rec.phraseOnsets.length;
    setPhraseOnsets(prev => [...prev, newOnset]);
    setActiveStepIndexState(nextIdx);
    loadStepNotes(newOnset, false);
  }, [loadStepNotes]);

  const addPhraseStep = useCallback(() => {
    const nextOnset = createEmptyOnset();
    const insertAt = activeStepIndex + 1;
    setPhraseOnsets(prev => {
      const next = [...prev];
      next.splice(insertAt, 0, nextOnset);
      return next;
    });
    setActiveStepIndexState(insertAt);
    loadStepNotes(nextOnset, false);
  }, [activeStepIndex, loadStepNotes]);

  const duplicatePhraseStep = useCallback(() => {
    const src = phraseOnsets[activeStepIndex];
    const copy = createOnsetFromNotes(src?.notes ?? [], src?.label);
    const insertAt = activeStepIndex + 1;
    setPhraseOnsets(prev => {
      const next = [...prev];
      next.splice(insertAt, 0, copy);
      return next;
    });
    setActiveStepIndexState(insertAt);
    loadStepNotes(copy, true);
  }, [phraseOnsets, activeStepIndex, loadStepNotes]);

  const removePhraseStep = useCallback((index?: number) => {
    const target = index ?? activeStepIndex;
    if (phraseOnsets.length <= 1) {
      const blank = createEmptyOnset();
      setPhraseOnsets([blank]);
      setActiveStepIndexState(0);
      loadStepNotes(blank, false);
      return;
    }
    const nextList = phraseOnsets.filter((_, i) => i !== target);
    const nextIdx = Math.min(target, nextList.length - 1);
    setPhraseOnsets(nextList);
    setActiveStepIndexState(nextIdx);
    loadStepNotes(nextList[nextIdx], false);
  }, [phraseOnsets, activeStepIndex, loadStepNotes]);

  const clearPhrase = useCallback(() => {
    stopPhrasePlayback();
    const blank = createEmptyOnset();
    setPhraseOnsets([blank]);
    setActiveStepIndexState(0);
    loadStepNotes(blank, false);
  }, [stopPhrasePlayback, loadStepNotes]);

  const setRecordingPhrase = useCallback((on: boolean) => {
    setRecordingPhraseState(on);
    hadMidiReleaseSinceStepRef.current = false;
    if (on) setPhraseModeState(true);
  }, []);

  const playPhrase = useCallback(() => {
    if (phraseOnsets.length === 0) return;
    stopPhrasePlayback();
    setIsPlayingPhrase(true);
    const STEP_MS = 650;

    const scheduleStep = (idx: number) => {
      setActiveStepIndexState(idx);
      loadStepNotes(phraseOnsets[idx], true);

      const nextIdx = idx + 1;
      if (nextIdx < phraseOnsets.length) {
        const id = window.setTimeout(() => scheduleStep(nextIdx), STEP_MS);
        phrasePlayTimersRef.current.push(id);
      } else if (loopPhraseRef.current && phraseOnsets.length > 1) {
        const id = window.setTimeout(() => scheduleStep(0), STEP_MS);
        phrasePlayTimersRef.current.push(id);
      } else {
        const endId = window.setTimeout(() => setIsPlayingPhrase(false), STEP_MS);
        phrasePlayTimersRef.current.push(endId);
      }
    };

    scheduleStep(0);
  }, [phraseOnsets, stopPhrasePlayback, loadStepNotes]);

  const setGuitarFingerOverride = useCallback((
    onsetIdx: number,
    posKey: string,
    override: GuitarFingerOverride
  ) => {
    setPhraseOnsets(prev => prev.map((onset, idx) => {
      if (idx !== onsetIdx) return onset;
      return {
        ...onset,
        fingering: {
          ...onset.fingering,
          guitar: {
            ...(onset.fingering?.guitar ?? {}),
            [posKey]: override,
          },
        },
      };
    }));
  }, []);

  const clearGuitarFingerOverride = useCallback((onsetIdx: number, posKey: string) => {
    setPhraseOnsets(prev => prev.map((onset, idx) => {
      if (idx !== onsetIdx || !onset.fingering?.guitar) return onset;
      const nextGuitar = { ...onset.fingering.guitar };
      delete nextGuitar[posKey];
      return {
        ...onset,
        fingering: {
          ...onset.fingering,
          guitar: nextGuitar,
        },
      };
    }));
  }, []);

  const setGuitarPickOverride = useCallback((
    onsetIdx: number,
    stringIdx: number,
    override: GuitarPickOverride
  ) => {
    setPhraseOnsets(prev => prev.map((onset, idx) => {
      if (idx !== onsetIdx) return onset;
      return {
        ...onset,
        fingering: {
          ...onset.fingering,
          guitarPick: {
            ...(onset.fingering?.guitarPick ?? {}),
            [String(stringIdx)]: override,
          },
        },
      };
    }));
  }, []);

  const clearGuitarPickOverride = useCallback((onsetIdx: number, stringIdx: number) => {
    setPhraseOnsets(prev => prev.map((onset, idx) => {
      if (idx !== onsetIdx || !onset.fingering?.guitarPick) return onset;
      const nextPick = { ...onset.fingering.guitarPick };
      delete nextPick[String(stringIdx)];
      return {
        ...onset,
        fingering: {
          ...onset.fingering,
          guitarPick: nextPick,
        },
      };
    }));
  }, []);

  const setPianoFingerOverride = useCallback((
    onsetIdx: number,
    note: string,
    override: PianoFingerOverride
  ) => {
    setPhraseOnsets(prev => prev.map((onset, idx) => {
      if (idx !== onsetIdx) return onset;
      return {
        ...onset,
        fingering: {
          ...onset.fingering,
          piano: {
            ...(onset.fingering?.piano ?? {}),
            [note]: override,
          },
        },
      };
    }));
  }, []);

  const clearPianoFingerOverride = useCallback((onsetIdx: number, note: string) => {
    setPhraseOnsets(prev => prev.map((onset, idx) => {
      if (idx !== onsetIdx || !onset.fingering?.piano) return onset;
      const nextPiano = { ...onset.fingering.piano };
      delete nextPiano[note];
      return {
        ...onset,
        fingering: {
          ...onset.fingering,
          piano: nextPiano,
        },
      };
    }));
  }, []);

  // Refs for latest phrase recording state inside MIDI callbacks
  const phraseRecRef = useRef({ isRecordingPhrase, phraseMode, phraseOnsets, activeStepIndex });
  phraseRecRef.current = { isRecordingPhrase, phraseMode, phraseOnsets, activeStepIndex };

  const executeMidiActionRef = useRef<(action: MidiBindingActionId) => void>(() => {});
  executeMidiActionRef.current = (action: MidiBindingActionId) => {
    switch (action) {
      case "phraseStepForwardOrAdd":
        stepForwardOrAdd();
        break;
      case "phraseStepPrev":
        stepPrev();
        break;
      case "phraseAddStep":
        addPhraseStep();
        break;
      case "phraseDuplicateStep":
        duplicatePhraseStep();
        break;
      case "phraseClearStep":
        clearNotes();
        break;
      case "toggleHold":
        toggleHold();
        break;
      case "playPausePhrase":
        if (isPlayingPhraseRef.current) {
          stopPhrasePlayback();
        } else {
          playPhrase();
        }
        break;
    }
  };

  const handleMIDIControlChange = useCallback((cc: number, value: number, _channel: number) => {
    setLastMidiActivity(`CC ${cc} = ${value}`);
    const isRising = evaluateCcRisingEdge(ccPressedRef.current, cc, value);
    if (!isRising) return;

    const learningAction = midiLearnActionRef.current;
    if (learningAction) {
      setMidiBinding(learningAction, { type: "cc", cc });
      setMidiLearnAction(null);
      return;
    }

    const matched = matchMidiBindingAction(midiSettingsRef.current, { type: "cc", cc });
    if (matched) {
      executeMidiActionRef.current(matched);
    }
  }, [setMidiBinding]);

  const handleMIDINoteOn = useCallback((note: string, velocity: number, midiNumber?: number) => {
    const midi = midiNumber ?? (Note.midi(note) ?? -1);
    setLastMidiActivity(`${note} (vel ${velocity})`);

    const learningAction = midiLearnActionRef.current;
    if (learningAction && midi >= 0) {
      setMidiBinding(learningAction, { type: "note", midi });
      setMidiLearnAction(null);
      return;
    }

    if (midi >= 0) {
      const boundAction = matchMidiBindingAction(midiSettingsRef.current, { type: "note", midi });
      if (boundAction) {
        executeMidiActionRef.current(boundAction);
        return;
      }
    }

    isApplyingStepRef.current = false;
    const hadHeldPhysicalNotes = physicalMidiNotesRef.current.size > 0;
    physicalMidiNotesRef.current.add(note);
    latchedMidiNotesRef.current.delete(note);

    const rec = phraseRecRef.current;
    const now = Date.now();
    const currentPhraseMidiMode = midiSettingsRef.current.phraseMidiMode;

    if (rec.phraseMode && currentPhraseMidiMode === "off") {
      physicalMidiNotesRef.current.delete(note);
      return;
    }

    // Play Over (Demo / Practice) mode: live MIDI overlays without mutating saved phraseOnsets
    if (rec.phraseMode && currentPhraseMidiMode === "play-over" && !rec.isRecordingPhrase) {
      hasFreshMidiOnStepRef.current = true;
      recordNoteSeq(note);
      stopFade(note);
      const nextOverlay = new Set(overlayNotesRef.current);
      nextOverlay.add(note);
      overlayNotesRef.current = nextOverlay;
      setOverlayNotesState(nextOverlay);
      playNote(note);

      if (midiSettingsRef.current.phraseAutoAdvance && autoAdvanceTimerRef.current === null) {
        const targetNotes = rec.phraseOnsets[rec.activeStepIndex]?.notes ?? [];
        if (targetNotes.length > 0 && hasFreshMidiOnStepRef.current) {
          const matchPcOnly = midiSettingsRef.current.phraseMatchPitchClassOnly;
          const allMatched = matchPcOnly
            ? targetNotes.every(tn => {
                const tm = Note.midi(tn);
                if (tm === null) return false;
                const tpc = ((tm % 12) + 12) % 12;
                for (const on of nextOverlay) {
                  const om = Note.midi(on);
                  if (om !== null && ((om % 12) + 12) % 12 === tpc) return true;
                }
                return false;
              })
            : targetNotes.every(tn => {
                const tm = Note.midi(tn);
                if (nextOverlay.has(tn)) return true;
                if (tm === null) return false;
                for (const on of nextOverlay) {
                  if (Note.midi(on) === tm) return true;
                }
                return false;
              });

          if (allMatched) {
            const hasNext =
              rec.activeStepIndex + 1 < rec.phraseOnsets.length ||
              (loopPhraseRef.current && rec.phraseOnsets.length > 1);
            if (hasNext) {
              hasFreshMidiOnStepRef.current = false;
              const targetIdx =
                rec.activeStepIndex + 1 < rec.phraseOnsets.length ? rec.activeStepIndex + 1 : 0;
              autoAdvanceTimerRef.current = window.setTimeout(() => {
                autoAdvanceTimerRef.current = null;
                setActiveStepIndexState(targetIdx);
                loadStepNotes(phraseRecRef.current.phraseOnsets[targetIdx], false);
              }, 200);
            }
          }
        }
      }
      return;
    }

    // Case 1: Explicit Rec MIDI auto-advance mode
    if (rec.isRecordingPhrase && rec.phraseMode) {
      if (
        hadMidiReleaseSinceStepRef.current &&
        (rec.phraseOnsets[rec.activeStepIndex]?.notes.length ?? 0) > 0
      ) {
        hadMidiReleaseSinceStepRef.current = false;
        const newOnset = createOnsetFromNotes([note]);
        const nextIdx = rec.phraseOnsets.length;
        isApplyingStepRef.current = true;
        setPhraseOnsets(prev => [...prev, newOnset]);
        setActiveStepIndexState(nextIdx);
        setActiveNotes(new Set([note]));
        lastMidiNoteOnAtRef.current = now;
        lastMidiCaptureStepRef.current = nextIdx;
        window.setTimeout(() => { isApplyingStepRef.current = false; }, 10);
        playNote(note);
        return;
      }

      lastMidiNoteOnAtRef.current = now;
      lastMidiCaptureStepRef.current = rec.activeStepIndex;
      addNote(note);
      playNote(note);
      return;
    }

    // Case 2: Standard MIDI play in Phrase mode with sticky capture
    if (rec.phraseMode && midiSettingsRef.current.phraseStickyMidi) {
      const stepNotesCount = rec.phraseOnsets[rec.activeStepIndex]?.notes.length ?? activeNotesRef.current.size;
      const shouldOverwrite = shouldOverwritePhraseStepOnMidiNoteOn({
        hadHeldPhysicalNotes,
        stepHasNotes: stepNotesCount > 0,
        lastNoteOnAtMs: lastMidiNoteOnAtRef.current,
        nowMs: now,
        pauseThresholdMs: midiSettingsRef.current.phraseOverwritePauseMs,
        sameStepAsLastCapture: lastMidiCaptureStepRef.current === rec.activeStepIndex,
      });

      lastMidiNoteOnAtRef.current = now;
      lastMidiCaptureStepRef.current = rec.activeStepIndex;

      if (shouldOverwrite) {
        setActiveNotes(new Set([note]));
      } else {
        addNote(note);
      }
      playNote(note);
      return;
    }

    // Case 3: Standard free play
    addNote(note);
    playNote(note);
  }, [addNote, playNote, setActiveNotes, setMidiBinding, recordNoteSeq, stopFade, loadStepNotes]);

  const handleMIDINoteOff = useCallback((note: string, midiNumber?: number) => {
    const midi = midiNumber ?? (Note.midi(note) ?? -1);
    if (midi >= 0 && matchMidiBindingAction(midiSettingsRef.current, { type: "note", midi })) {
      return;
    }

    physicalMidiNotesRef.current.delete(note);
    if (physicalMidiNotesRef.current.size === 0) {
      hadMidiReleaseSinceStepRef.current = true;
    }

    const rec = phraseRecRef.current;
    if (rec.phraseMode && midiSettingsRef.current.phraseMidiMode === "off") {
      return;
    }

    if (rec.phraseMode && midiSettingsRef.current.phraseMidiMode === "play-over" && !rec.isRecordingPhrase) {
      if (isHoldEnabledRef.current) {
        latchedMidiNotesRef.current.add(note);
        return;
      }
      if (overlayNotesRef.current.has(note)) {
        const nextOverlay = new Set(overlayNotesRef.current);
        nextOverlay.delete(note);
        overlayNotesRef.current = nextOverlay;
        setOverlayNotesState(nextOverlay);
        startFade(note);
      }
      return;
    }

    if (isHoldEnabledRef.current) {
      latchedMidiNotesRef.current.add(note);
      return;
    }

    if (rec.phraseMode && (midiSettingsRef.current.phraseStickyMidi || rec.isRecordingPhrase)) {
      return;
    }

    removeNote(note);
  }, [removeNote, startFade]);

  const midiState = useMIDI({
    onNoteOn: handleMIDINoteOn,
    onNoteOff: handleMIDINoteOff,
    onControlChange: handleMIDIControlChange,
    selectedDeviceId: midiSettings.selectedDeviceId,
    suppressed: suppressLocalMidi,
  });

  const syncableState: SyncableNoteNavState = useMemo(
    () => ({
      selectedKey,
      selectedScale,
      scaleRootOffset,
      isKeyLocked,
      scaleLabelMode,
      selectedTuningName: selectedTuning.name,
      trailMode,
      activeNotes: Array.from(activeNotes),
    }),
    [
      selectedKey,
      selectedScale,
      scaleRootOffset,
      isKeyLocked,
      scaleLabelMode,
      selectedTuning.name,
      trailMode,
      activeNotes,
    ]
  );

  const stageBridge = useStageBridge({
    state: syncableState,
    onSetSuppressLocalMidi: setSuppressLocalMidi,
    onSetEcoMode: setEcoMode,
    onRemoteNoteOn: (note) => {
      handleMIDINoteOn(note, 100, Note.midi(note) ?? -1);
    },
    onRemoteNoteOff: (note) => {
      handleMIDINoteOff(note, Note.midi(note) ?? -1);
    },
    onRemoteClearNotes: () => {
      clearNotes();
    },
    onRemotePlayNote: (note) => {
      void playNote(note);
    },
    onAudioUnlocked: () => {
      audioStartedRef.current = true;
    },
    applyRemoteState: (st, tuning) => {
      if (st.selectedKey !== undefined) setSelectedKey(st.selectedKey);
      if (st.selectedScale !== undefined) setSelectedScale(st.selectedScale);
      if (st.scaleRootOffset !== undefined) setScaleRootOffset(st.scaleRootOffset);
      if (st.isKeyLocked !== undefined) setKeyLocked(st.isKeyLocked);
      if (st.scaleLabelMode !== undefined) {
        setScaleLabelModeState(st.scaleLabelMode);
        setLabelModeState(prev =>
          prev === "solfege" || prev === "degree" ? st.scaleLabelMode! : prev
        );
      }
      if (tuning) setSelectedTuning(tuning);
      if (st.trailMode !== undefined) setTrailMode(st.trailMode);
      if (Array.isArray(st.activeNotes)) setActiveNotes(new Set(st.activeNotes));
    },
  });

  const playNoteWithBroadcast = useCallback(
    async (note: string) => {
      await playNote(note);
      stageBridge.broadcastAction("PLAY_NOTE", { note });
    },
    [playNote, stageBridge]
  );

  const clearNotesWithBroadcast = useCallback(() => {
    clearNotes();
    stageBridge.broadcastAction("CLEAR_NOTES");
  }, [clearNotes, stageBridge]);

  useEffect(() => {
    if (!midiState.isConnected && !stageBridge.isEmbedded && trailMode) {
      setTrailMode(false);
    }
  }, [midiState.isConnected, stageBridge.isEmbedded, trailMode]);

  const isNoteInCurrentScale = useCallback((note: string) => {
    if (!isKeyLocked) return true;
    return isNoteInScale(note, scaleNotes);
  }, [isKeyLocked, scaleNotes]);

  const setKey = useCallback((key: string) => setSelectedKey(key), []);
  const setScale = useCallback((scale: string, rootOffset?: number) => {
    setSelectedScale(scale);
    setScaleRootOffset(rootOffset ?? 0);
  }, []);
  const setScaleLabelMode = useCallback((mode: ScaleLabelMode) => {
    setScaleLabelModeState(mode);
    setLabelModeState(mode);
  }, []);
  const setLabelMode = useCallback((mode: NoteLabelMode) => {
    setLabelModeState(mode);
    if (mode === "solfege" || mode === "degree") {
      setScaleLabelModeState(mode);
    }
  }, []);
  const setTuning = useCallback((tuning: GuitarTuning) => setSelectedTuning(tuning), []);

  const getShareSnapshot = useCallback((): NoteNavShareSnapshot => {
    const effectiveOnsets = phraseMode
      ? phraseOnsets
      : [createOnsetFromNotes(Array.from(activeNotes))];
    return {
      v: 1,
      selectedKey,
      selectedScale,
      scaleRootOffset,
      isKeyLocked,
      labelMode,
      accidentalPreference,
      pptNoteheads,
      staffLayoutMode,
      showPianoTriangles,
      showFingering,
      phraseMode,
      loopPhrase,
      guitarRightHandMode,
      pianoComfortSpan,
      activeStepIndex,
      phraseOnsets: effectiveOnsets,
      tuningName: selectedTuning.name,
      tuningNotes: selectedTuning.name === "Custom" ? selectedTuning.notes : undefined,
      layoutPresetId,
      customLayout: layoutPresetId === "custom" ? layoutRoot : undefined,
    };
  }, [
    phraseMode,
    loopPhrase,
    guitarRightHandMode,
    pianoComfortSpan,
    phraseOnsets,
    activeNotes,
    selectedKey,
    selectedScale,
    scaleRootOffset,
    isKeyLocked,
    labelMode,
    accidentalPreference,
    pptNoteheads,
    staffLayoutMode,
    showPianoTriangles,
    showFingering,
    activeStepIndex,
    selectedTuning.name,
    selectedTuning.notes,
    layoutPresetId,
    layoutRoot,
  ]);

  const hydrateFromSnapshot = useCallback((snap: NoteNavShareSnapshot) => {
    setSelectedKey(snap.selectedKey);
    setSelectedScale(snap.selectedScale);
    setScaleRootOffset(snap.scaleRootOffset);
    setKeyLocked(snap.isKeyLocked);
    setLabelModeState(snap.labelMode);
    if (snap.labelMode === "solfege" || snap.labelMode === "degree") {
      setScaleLabelModeState(snap.labelMode);
    }
    setAccidentalPreference(snap.accidentalPreference);
    setPptNoteheads(snap.pptNoteheads);
    setStaffLayoutMode(snap.staffLayoutMode);
    setShowPianoTriangles(snap.showPianoTriangles);
    setShowFingering(snap.showFingering);
    if (typeof snap.loopPhrase === "boolean") setLoopPhrase(snap.loopPhrase);
    if (snap.guitarRightHandMode) setGuitarRightHandMode(snap.guitarRightHandMode);
    if (snap.pianoComfortSpan) setPianoComfortSpan(snap.pianoComfortSpan);

    const foundTuning = GUITAR_TUNINGS.find(t => t.name === snap.tuningName);
    if (foundTuning) {
      setSelectedTuning(foundTuning);
    } else if (snap.tuningNotes && snap.tuningNotes.length >= 4) {
      setSelectedTuning({
        name: snap.tuningName || "Custom",
        notes: snap.tuningNotes,
        category: "alternate",
      });
    }

    if (snap.customLayout) {
      setLayoutPresetId("custom");
      setLayoutRoot(snap.customLayout);
    } else {
      const preset = LAYOUT_PRESETS.find(p => p.id === snap.layoutPresetId) ?? PRESET_CLASSIC;
      setLayoutPresetId(preset.id);
      setLayoutRoot(preset.root);
    }

    const onsets = snap.phraseOnsets.length > 0 ? snap.phraseOnsets : [createEmptyOnset()];
    const clampedIdx = Math.max(0, Math.min(onsets.length - 1, snap.activeStepIndex));
    setPhraseModeState(snap.phraseMode);
    setPhraseOnsets(onsets);
    setActiveStepIndexState(clampedIdx);
    loadStepNotes(onsets[clampedIdx], false);
  }, [loadStepNotes]);

  // Hydrate from URL ?p=<slug> on first mount if present
  const didHydrateRef = useRef(false);
  useEffect(() => {
    if (didHydrateRef.current || typeof window === "undefined") return;
    didHydrateRef.current = true;
    const slug = new URLSearchParams(window.location.search).get("p");
    if (!slug) return;
    const snap = decodeShareSlug(slug);
    if (snap) {
      hydrateFromSnapshot(snap);
    }
  }, [hydrateFromSnapshot]);

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
      scaleIntervals,
      isKeyLocked,
      scaleLabelMode,
      labelMode,
      accidentalPreference,
      useFlats,
      pptNoteheads,
      staffLayoutMode,
      showPianoTriangles,
      ecoMode,
      isStageEmbedded: stageBridge.isEmbedded,
      isMuted,
      isHoldEnabled,
      trailMode,
      midiState,
      selectedTuning,
      phraseMode,
      phraseOnsets,
      activeStepIndex,
      nextStepIndex,
      loopPhrase,
      isRecordingPhrase,
      isPlayingPhrase,
      nextOnsetNotes,
      overlayNotes,
      showFingering,
      showNextPreview,
      guitarRightHandMode,
      pianoComfortSpan,
      layoutPresetId,
      layoutRoot,
      setLayoutPreset,
      setCustomLayout,
      toggleNote,
      setActiveNotes,
      clearNotes: clearNotesWithBroadcast,
      setKey,
      setScale,
      setKeyLocked,
      setScaleLabelMode,
      setLabelMode,
      setAccidentalPreference,
      setUseFlats,
      setPptNoteheads,
      setStaffLayoutMode,
      setShowPianoTriangles,
      setMuted,
      setHoldEnabled,
      toggleHold,
      setTrailMode,
      setTuning,
      playNote: playNoteWithBroadcast,
      isNoteInCurrentScale,
      setPhraseMode,
      setActiveStepIndex,
      setLoopPhrase,
      stepPrev,
      stepNext,
      stepForwardOrAdd,
      addPhraseStep,
      duplicatePhraseStep,
      removePhraseStep,
      clearPhrase,
      setRecordingPhrase,
      playPhrase,
      stopPhrasePlayback,
      setShowFingering,
      setShowNextPreview,
      setGuitarRightHandMode,
      setPianoComfortSpan,
      setGuitarFingerOverride,
      clearGuitarFingerOverride,
      setGuitarPickOverride,
      clearGuitarPickOverride,
      setPianoFingerOverride,
      clearPianoFingerOverride,
      setPhraseMidiMode,
      setPhraseAutoAdvance,
      setPhraseMatchPitchClassOnly,
      midiSettings,
      midiLearnAction,
      lastMidiActivity,
      updateMidiSettings,
      setMidiBinding,
      resetMidiSettings,
      startMidiLearn,
      cancelMidiLearn,
      getShareSnapshot,
      hydrateFromSnapshot,
    }
  }, children);
}
