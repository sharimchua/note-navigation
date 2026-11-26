import { Note } from "tonal";

export type MidiBindingActionId =
  | "phraseStepForwardOrAdd"
  | "phraseStepPrev"
  | "phraseAddStep"
  | "phraseDuplicateStep"
  | "phraseClearStep"
  | "toggleHold"
  | "playPausePhrase";

export type MidiTrigger =
  | { type: "cc"; cc: number }
  | { type: "note"; midi: number };

export interface MidiBindingsConfig {
  enabled: boolean;
  selectedDeviceId: string; // "all" or MIDIInput.id / name
  phraseStickyMidi: boolean; // keep MIDI notes in current step; overwrite after pause
  phraseOverwritePauseMs: number; // default 350 (clamped 100..1500)
  bindings: Record<MidiBindingActionId, MidiTrigger | null>;
}

export interface MidiBindingActionMeta {
  id: MidiBindingActionId;
  label: string;
  description: string;
  keyboardHint?: string;
}

export const MIDI_BINDING_ACTIONS: MidiBindingActionMeta[] = [
  {
    id: "phraseStepForwardOrAdd",
    label: "Step Forward (or Add Step)",
    description: "Advance to the next phrase step, or append a new blank step at the end.",
    keyboardHint: "Enter",
  },
  {
    id: "phraseStepPrev",
    label: "Previous Step",
    description: "Move back to the previous phrase step.",
    keyboardHint: "←",
  },
  {
    id: "phraseAddStep",
    label: "Insert New Step",
    description: "Insert a blank step immediately after the active step.",
    keyboardHint: "N",
  },
  {
    id: "phraseDuplicateStep",
    label: "Duplicate Step",
    description: "Clone the current step and jump to the copy.",
    keyboardHint: "D",
  },
  {
    id: "phraseClearStep",
    label: "Clear Notes",
    description: "Clear held and active notes on the current step.",
    keyboardHint: "Esc",
  },
  {
    id: "toggleHold",
    label: "Toggle Hold",
    description: "Latch incoming MIDI notes without sustaining on keys.",
    keyboardHint: "H",
  },
  {
    id: "playPausePhrase",
    label: "Play / Stop Phrase",
    description: "Audition phrase steps in sequence or stop playback.",
    keyboardHint: "Space",
  },
];

export const MIDI_SETTINGS_STORAGE_KEY = "note_navigation_midi_settings_v1";

export const MIDI_CC_PRESETS: { cc: number; label: string }[] = [
  { cc: 67, label: "Left Pedal (Una Corda · CC 67)" },
  { cc: 66, label: "Middle Pedal (Sostenuto · CC 66)" },
  { cc: 64, label: "Right Pedal (Sustain · CC 64)" },
  { cc: 1, label: "Mod Wheel (CC 1)" },
];

export const DEFAULT_MIDI_SETTINGS: MidiBindingsConfig = {
  enabled: true,
  selectedDeviceId: "all",
  phraseStickyMidi: true,
  phraseOverwritePauseMs: 350,
  bindings: {
    phraseStepForwardOrAdd: { type: "cc", cc: 67 },
    phraseStepPrev: null,
    phraseAddStep: null,
    phraseDuplicateStep: null,
    phraseClearStep: null,
    toggleHold: null,
    playPausePhrase: null,
  },
};

function clampPauseMs(val: unknown): number {
  const num = typeof val === "number" && Number.isFinite(val) ? val : DEFAULT_MIDI_SETTINGS.phraseOverwritePauseMs;
  return Math.max(100, Math.min(1500, Math.round(num)));
}

function sanitizeTrigger(raw: unknown): MidiTrigger | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (obj.type === "cc" && typeof obj.cc === "number" && obj.cc >= 0 && obj.cc <= 127) {
    return { type: "cc", cc: Math.round(obj.cc) };
  }
  if (obj.type === "note" && typeof obj.midi === "number" && obj.midi >= 0 && obj.midi <= 127) {
    return { type: "note", midi: Math.round(obj.midi) };
  }
  return null;
}

export function formatMidiTrigger(trigger: MidiTrigger | null): string {
  if (!trigger) return "Unbound";
  if (trigger.type === "cc") {
    if (trigger.cc === 67) return "Left Pedal (CC 67)";
    if (trigger.cc === 66) return "Middle Pedal (CC 66)";
    if (trigger.cc === 64) return "Sustain Pedal (CC 64)";
    return `CC ${trigger.cc}`;
  }
  const name = Note.fromMidi(trigger.midi);
  return `Note ${name ?? trigger.midi} (${trigger.midi})`;
}

export function loadMidiSettings(): MidiBindingsConfig {
  if (typeof window === "undefined") {
    return {
      ...DEFAULT_MIDI_SETTINGS,
      bindings: { ...DEFAULT_MIDI_SETTINGS.bindings },
    };
  }
  try {
    const raw = window.localStorage.getItem(MIDI_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return {
        ...DEFAULT_MIDI_SETTINGS,
        bindings: { ...DEFAULT_MIDI_SETTINGS.bindings },
      };
    }
    const parsed = JSON.parse(raw) as Partial<MidiBindingsConfig>;
    const rawBindings = (parsed.bindings ?? {}) as Partial<Record<MidiBindingActionId, unknown>>;
    const mergedBindings: Record<MidiBindingActionId, MidiTrigger | null> = {
      ...DEFAULT_MIDI_SETTINGS.bindings,
    };
    for (const meta of MIDI_BINDING_ACTIONS) {
      if (Object.prototype.hasOwnProperty.call(rawBindings, meta.id)) {
        mergedBindings[meta.id] = sanitizeTrigger(rawBindings[meta.id]);
      }
    }
    return {
      enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : DEFAULT_MIDI_SETTINGS.enabled,
      selectedDeviceId: typeof parsed.selectedDeviceId === "string" && parsed.selectedDeviceId
        ? parsed.selectedDeviceId
        : DEFAULT_MIDI_SETTINGS.selectedDeviceId,
      phraseStickyMidi: typeof parsed.phraseStickyMidi === "boolean"
        ? parsed.phraseStickyMidi
        : DEFAULT_MIDI_SETTINGS.phraseStickyMidi,
      phraseOverwritePauseMs: clampPauseMs(parsed.phraseOverwritePauseMs),
      bindings: mergedBindings,
    };
  } catch {
    return {
      ...DEFAULT_MIDI_SETTINGS,
      bindings: { ...DEFAULT_MIDI_SETTINGS.bindings },
    };
  }
}

export function saveMidiSettings(cfg: MidiBindingsConfig): void {
  if (typeof window === "undefined") return;
  try {
    const normalized: MidiBindingsConfig = {
      ...cfg,
      phraseOverwritePauseMs: clampPauseMs(cfg.phraseOverwritePauseMs),
    };
    window.localStorage.setItem(MIDI_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // ignore storage quota errors
  }
}

/**
 * Schmitt-trigger hysteresis for pedal / CC inputs so half-pedal flutter
 * does not double-trigger step advances.
 */
export function evaluateCcRisingEdge(
  pressedState: Map<number, boolean>,
  cc: number,
  value: number,
  pressThreshold = 64,
  releaseThreshold = 32
): boolean {
  const isPressed = Boolean(pressedState.get(cc));
  if (!isPressed && value >= pressThreshold) {
    pressedState.set(cc, true);
    return true;
  }
  if (isPressed && value <= releaseThreshold) {
    pressedState.set(cc, false);
    return false;
  }
  return false;
}

export function matchMidiBindingAction(
  config: MidiBindingsConfig,
  trigger: MidiTrigger
): MidiBindingActionId | null {
  if (!config.enabled) return null;
  for (const meta of MIDI_BINDING_ACTIONS) {
    const bound = config.bindings[meta.id];
    if (!bound) continue;
    if (trigger.type === "cc" && bound.type === "cc" && bound.cc === trigger.cc) {
      return meta.id;
    }
    if (trigger.type === "note" && bound.type === "note" && bound.midi === trigger.midi) {
      return meta.id;
    }
  }
  return null;
}

export function shouldOverwritePhraseStepOnMidiNoteOn(params: {
  hadHeldPhysicalNotes: boolean;
  stepHasNotes: boolean;
  lastNoteOnAtMs: number;
  nowMs: number;
  pauseThresholdMs: number;
  sameStepAsLastCapture: boolean;
}): boolean {
  if (!params.stepHasNotes) return false;
  if (params.hadHeldPhysicalNotes) return false;
  if (!params.sameStepAsLastCapture) return true;
  if (params.lastNoteOnAtMs <= 0) return true;
  return params.nowMs - params.lastNoteOnAtMs >= params.pauseThresholdMs;
}
