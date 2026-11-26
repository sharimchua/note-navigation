import { describe, expect, it } from "vitest";
import {
  DEFAULT_MIDI_SETTINGS,
  evaluateCcRisingEdge,
  formatMidiTrigger,
  matchMidiBindingAction,
  shouldOverwritePhraseStepOnMidiNoteOn,
  type MidiBindingsConfig,
} from "./midi-bindings";

describe("MIDI settings & pedal bindings", () => {
  it("defaults Left Pedal (CC 67) to step forward or add phrase step with sticky capture enabled", () => {
    expect(DEFAULT_MIDI_SETTINGS.enabled).toBe(true);
    expect(DEFAULT_MIDI_SETTINGS.phraseStickyMidi).toBe(true);
    expect(DEFAULT_MIDI_SETTINGS.phraseOverwritePauseMs).toBe(350);
    expect(DEFAULT_MIDI_SETTINGS.bindings.phraseStepForwardOrAdd).toEqual({
      type: "cc",
      cc: 67,
    });
  });

  it("debounces half-pedal chatter with Schmitt-trigger hysteresis", () => {
    const state = new Map<number, boolean>();

    expect(evaluateCcRisingEdge(state, 67, 10)).toBe(false);
    expect(evaluateCcRisingEdge(state, 67, 45)).toBe(false);
    // Cross press threshold (64) triggers once
    expect(evaluateCcRisingEdge(state, 67, 64)).toBe(true);
    expect(evaluateCcRisingEdge(state, 67, 90)).toBe(false);
    expect(evaluateCcRisingEdge(state, 67, 127)).toBe(false);

    // Bounce near threshold does not retrigger until dropping <= releaseThreshold (32)
    expect(evaluateCcRisingEdge(state, 67, 60)).toBe(false);
    expect(evaluateCcRisingEdge(state, 67, 70)).toBe(false);
    expect(evaluateCcRisingEdge(state, 67, 20)).toBe(false);
    expect(evaluateCcRisingEdge(state, 67, 0)).toBe(false);

    // Next press after full release triggers again
    expect(evaluateCcRisingEdge(state, 67, 80)).toBe(true);
  });

  it("matches CC and MIDI note triggers only when bindings are enabled", () => {
    expect(
      matchMidiBindingAction(DEFAULT_MIDI_SETTINGS, { type: "cc", cc: 67 })
    ).toBe("phraseStepForwardOrAdd");

    const disabled: MidiBindingsConfig = {
      ...DEFAULT_MIDI_SETTINGS,
      enabled: false,
    };
    expect(matchMidiBindingAction(disabled, { type: "cc", cc: 67 })).toBeNull();

    const withNoteBinding: MidiBindingsConfig = {
      ...DEFAULT_MIDI_SETTINGS,
      bindings: {
        ...DEFAULT_MIDI_SETTINGS.bindings,
        phraseAddStep: { type: "note", midi: 21 },
      },
    };
    expect(
      matchMidiBindingAction(withNoteBinding, { type: "note", midi: 21 })
    ).toBe("phraseAddStep");
  });

  it("formats triggers concisely", () => {
    expect(formatMidiTrigger({ type: "cc", cc: 67 })).toBe("Left Pedal (CC 67)");
    expect(formatMidiTrigger({ type: "cc", cc: 64 })).toBe("Sustain Pedal (CC 64)");
    expect(formatMidiTrigger({ type: "cc", cc: 1 })).toBe("CC 1");
    expect(formatMidiTrigger({ type: "note", midi: 60 })).toBe("Note C4 (60)");
    expect(formatMidiTrigger(null)).toBe("Unbound");
  });
});

describe("Sticky Phrase MIDI capture pause-to-overwrite logic", () => {
  it("builds chords while keys are held or within the pause window, and overwrites after a pause", () => {
    // Empty step never overwrites
    expect(
      shouldOverwritePhraseStepOnMidiNoteOn({
        hadHeldPhysicalNotes: false,
        stepHasNotes: false,
        lastNoteOnAtMs: 0,
        nowMs: 1000,
        pauseThresholdMs: 350,
        sameStepAsLastCapture: false,
      })
    ).toBe(false);

    // Physical key still held -> chord building, never overwrites regardless of elapsed time
    expect(
      shouldOverwritePhraseStepOnMidiNoteOn({
        hadHeldPhysicalNotes: true,
        stepHasNotes: true,
        lastNoteOnAtMs: 1000,
        nowMs: 5000,
        pauseThresholdMs: 350,
        sameStepAsLastCapture: true,
      })
    ).toBe(false);

    // Released quickly and played again within pauseThresholdMs -> arpeggiated chord accumulation
    expect(
      shouldOverwritePhraseStepOnMidiNoteOn({
        hadHeldPhysicalNotes: false,
        stepHasNotes: true,
        lastNoteOnAtMs: 1000,
        nowMs: 1200,
        pauseThresholdMs: 350,
        sameStepAsLastCapture: true,
      })
    ).toBe(false);

    // Released and paused >= pauseThresholdMs -> overwrite step with new note/chord
    expect(
      shouldOverwritePhraseStepOnMidiNoteOn({
        hadHeldPhysicalNotes: false,
        stepHasNotes: true,
        lastNoteOnAtMs: 1000,
        nowMs: 1400,
        pauseThresholdMs: 350,
        sameStepAsLastCapture: true,
      })
    ).toBe(true);

    // Navigated to an already-populated step from elsewhere -> first MIDI play overwrites it
    expect(
      shouldOverwritePhraseStepOnMidiNoteOn({
        hadHeldPhysicalNotes: false,
        stepHasNotes: true,
        lastNoteOnAtMs: 1000,
        nowMs: 1050,
        pauseThresholdMs: 350,
        sameStepAsLastCapture: false,
      })
    ).toBe(true);
  });
});
