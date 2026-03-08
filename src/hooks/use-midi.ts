import { useEffect, useState, useCallback, useRef } from "react";
import { Note } from "tonal";

export interface MIDIState {
  isSupported: boolean;
  isConnected: boolean;
  deviceName: string | null;
  error: string | null;
}

interface UseMIDIOptions {
  onNoteOn?: (note: string, velocity: number) => void;
  onNoteOff?: (note: string) => void;
}

export function useMIDI({ onNoteOn, onNoteOff }: UseMIDIOptions = {}) {
  const [state, setState] = useState<MIDIState>({
    isSupported: typeof navigator !== "undefined" && "requestMIDIAccess" in navigator,
    isConnected: false,
    deviceName: null,
    error: null,
  });

  const midiAccessRef = useRef<MIDIAccess | null>(null);
  const inputsRef = useRef<MIDIInput[]>([]);

  const handleMIDIMessage = useCallback((event: MIDIMessageEvent) => {
    const data = event.data;
    if (!data || data.length < 3) return;

    const command = data[0] >> 4;
    const midiNote = data[1];
    const velocity = data[2];

    const noteName = Note.fromMidi(midiNote);
    if (!noteName) return;

    // Note On (command 9) with velocity > 0
    if (command === 9 && velocity > 0) {
      onNoteOn?.(noteName, velocity);
    }
    // Note Off (command 8) or Note On with velocity 0
    else if (command === 8 || (command === 9 && velocity === 0)) {
      onNoteOff?.(noteName);
    }
  }, [onNoteOn, onNoteOff]);

  const connectInput = useCallback((input: MIDIInput) => {
    input.onmidimessage = handleMIDIMessage;
    inputsRef.current.push(input);
    
    setState(prev => ({
      ...prev,
      isConnected: true,
      deviceName: input.name || "MIDI Device",
    }));
  }, [handleMIDIMessage]);

  const handleStateChange = useCallback(() => {
    const access = midiAccessRef.current;
    if (!access) return;

    // Clear existing inputs
    inputsRef.current.forEach(input => {
      input.onmidimessage = null;
    });
    inputsRef.current = [];

    // Connect all available inputs
    const inputs = Array.from(access.inputs.values());
    if (inputs.length > 0) {
      inputs.forEach(connectInput);
    } else {
      setState(prev => ({
        ...prev,
        isConnected: false,
        deviceName: null,
      }));
    }
  }, [connectInput]);

  useEffect(() => {
    if (!state.isSupported) return;

    let mounted = true;

    async function initMIDI() {
      try {
        const access = await navigator.requestMIDIAccess({ sysex: false });
        if (!mounted) return;

        midiAccessRef.current = access;
        access.onstatechange = handleStateChange;
        handleStateChange();
      } catch (err) {
        if (!mounted) return;
        setState(prev => ({
          ...prev,
          error: err instanceof Error ? err.message : "MIDI access denied",
        }));
      }
    }

    initMIDI();

    return () => {
      mounted = false;
      inputsRef.current.forEach(input => {
        input.onmidimessage = null;
      });
      inputsRef.current = [];
    };
  }, [state.isSupported, handleStateChange]);

  return state;
}
