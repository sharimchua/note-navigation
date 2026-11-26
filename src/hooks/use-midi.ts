import { useEffect, useState, useCallback, useRef } from "react";
import { Note } from "tonal";

export interface MIDIDeviceInfo {
  id: string;
  name: string;
  manufacturer: string;
}

export interface MIDIState {
  isSupported: boolean;
  isConnected: boolean;
  deviceName: string | null;
  devices: MIDIDeviceInfo[];
  error: string | null;
}

interface UseMIDIOptions {
  onNoteOn?: (note: string, velocity: number, midiNumber: number) => void;
  onNoteOff?: (note: string, midiNumber: number) => void;
  onControlChange?: (cc: number, value: number, channel: number) => void;
  selectedDeviceId?: string;
  suppressed?: boolean;
}

export function useMIDI({
  onNoteOn,
  onNoteOff,
  onControlChange,
  selectedDeviceId = "all",
  suppressed = false,
}: UseMIDIOptions = {}) {
  const [state, setState] = useState<MIDIState>({
    isSupported: typeof navigator !== "undefined" && "requestMIDIAccess" in navigator,
    isConnected: false,
    deviceName: null,
    devices: [],
    error: null,
  });

  const midiAccessRef = useRef<MIDIAccess | null>(null);
  const inputsRef = useRef<MIDIInput[]>([]);

  // Keep refs to the latest callbacks so event handlers always call the current version,
  // avoiding stale closures when callbacks or filters change
  // without triggering a device reconnection that would reassign input.onmidimessage.
  const onNoteOnRef = useRef(onNoteOn);
  const onNoteOffRef = useRef(onNoteOff);
  const onControlChangeRef = useRef(onControlChange);
  const selectedDeviceIdRef = useRef(selectedDeviceId);
  const suppressedRef = useRef(suppressed);

  useEffect(() => {
    onNoteOnRef.current = onNoteOn;
    onNoteOffRef.current = onNoteOff;
    onControlChangeRef.current = onControlChange;
    selectedDeviceIdRef.current = selectedDeviceId;
    suppressedRef.current = suppressed;
  }, [onNoteOn, onNoteOff, onControlChange, selectedDeviceId, suppressed]);

  const handleMIDIMessage = useCallback((event: MIDIMessageEvent) => {
    if (suppressedRef.current) return;
    const targetFilter = selectedDeviceIdRef.current;
    if (targetFilter && targetFilter !== "all") {
      const port = event.target as MIDIInput | null;
      if (port && port.id !== targetFilter && port.name !== targetFilter) {
        return;
      }
    }

    const data = event.data;
    if (!data || data.length < 3) return;

    const status = data[0];
    const command = status >> 4;
    const channel = (status & 0x0f) + 1;
    const data1 = data[1];
    const data2 = data[2];

    // Control Change (0xB0..0xBF)
    if (command === 11) {
      onControlChangeRef.current?.(data1, data2, channel);
      return;
    }

    const noteName = Note.fromMidi(data1);
    if (!noteName) return;

    // Note On (command 9) with velocity > 0
    if (command === 9 && data2 > 0) {
      onNoteOnRef.current?.(noteName, data2, data1);
    }
    // Note Off (command 8) or Note On with velocity 0
    else if (command === 8 || (command === 9 && data2 === 0)) {
      onNoteOffRef.current?.(noteName, data1);
    }
  }, []);

  const resolveActiveDeviceName = useCallback(
    (devices: MIDIDeviceInfo[], targetId: string): string | null => {
      if (devices.length === 0) return null;
      if (!targetId || targetId === "all") return devices[0].name;
      const match = devices.find((d) => d.id === targetId || d.name === targetId);
      return match ? match.name : devices[0].name;
    },
    []
  );

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
    const devices: MIDIDeviceInfo[] = inputs.map((input, idx) => ({
      id: input.id || `midi-${idx}`,
      name: input.name || `MIDI Device ${idx + 1}`,
      manufacturer: input.manufacturer || "",
    }));

    inputs.forEach((input) => {
      input.onmidimessage = handleMIDIMessage;
      inputsRef.current.push(input);
    });

    setState(prev => ({
      ...prev,
      isConnected: inputs.length > 0,
      deviceName: resolveActiveDeviceName(devices, selectedDeviceIdRef.current),
      devices,
    }));
  }, [handleMIDIMessage, resolveActiveDeviceName]);

  useEffect(() => {
    setState(prev => {
      if (!prev.isConnected) return prev;
      const nextName = resolveActiveDeviceName(prev.devices, selectedDeviceId);
      if (nextName === prev.deviceName) return prev;
      return { ...prev, deviceName: nextName };
    });
  }, [selectedDeviceId, resolveActiveDeviceName]);

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
