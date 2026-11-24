import { useEffect, useRef, useCallback } from 'react';
import * as Tone from 'tone';
import { Note } from 'tonal';
import { GUITAR_TUNINGS, type GuitarTuning } from '@/lib/music-engine';

const STAGE_PROTOCOL = 'midlifemuso-stage-v1';
const APP_ID = 'note-navigation';

export interface SyncableNoteNavState {
  selectedKey: string;
  selectedScale: string;
  scaleRootOffset: number;
  isKeyLocked: boolean;
  scaleLabelMode: 'solfege' | 'degree';
  selectedTuningName: string;
  trailMode: boolean;
  activeNotes: string[];
}

export function isStageEmbedded(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      window.parent !== window &&
      new URLSearchParams(window.location.search).get('stage') === '1'
    );
  } catch {
    return false;
  }
}

function postToParent(msg: Record<string, unknown>): void {
  if (typeof window === 'undefined' || window.parent === window) return;
  window.parent.postMessage({ protocol: STAGE_PROTOCOL, appId: APP_ID, ...msg }, '*');
}

function getToneAudioState(): 'running' | 'suspended' | 'closed' {
  try {
    const state = Tone.getContext().state;
    if (state === 'running') return 'running';
    if (state === 'closed') return 'closed';
    return 'suspended';
  } catch {
    return 'suspended';
  }
}

interface UseStageBridgeOptions {
  state: SyncableNoteNavState;
  onSetSuppressLocalMidi: (suppressed: boolean) => void;
  onRemoteNoteOn: (note: string) => void;
  onRemoteNoteOff: (note: string) => void;
  onRemoteClearNotes: () => void;
  onRemotePlayNote: (note: string) => void;
  onAudioUnlocked: () => void;
  applyRemoteState: (st: Partial<SyncableNoteNavState>, tuning?: GuitarTuning) => void;
}

export function useStageBridge({
  state,
  onSetSuppressLocalMidi,
  onRemoteNoteOn,
  onRemoteNoteOff,
  onRemoteClearNotes,
  onRemotePlayNote,
  onAudioUnlocked,
  applyRemoteState,
}: UseStageBridgeOptions) {
  const embedded = isStageEmbedded();
  const isApplyingRemoteRef = useRef(false);
  const lastSentRef = useRef('');
  const throttleRef = useRef<number | null>(null);

  const latestRef = useRef({
    onSetSuppressLocalMidi,
    onRemoteNoteOn,
    onRemoteNoteOff,
    onRemoteClearNotes,
    onRemotePlayNote,
    onAudioUnlocked,
    applyRemoteState,
  });
  latestRef.current = {
    onSetSuppressLocalMidi,
    onRemoteNoteOn,
    onRemoteNoteOff,
    onRemoteClearNotes,
    onRemotePlayNote,
    onAudioUnlocked,
    applyRemoteState,
  };

  useEffect(() => {
    if (!embedded) return;

    postToParent({
      type: 'STAGE_READY',
      audioState: getToneAudioState(),
    });

    const handleMessage = (event: MessageEvent) => {
      const data = event.data as Record<string, unknown> | null;
      if (!data || data.protocol !== STAGE_PROTOCOL || typeof data.type !== 'string') return;
      const cur = latestRef.current;

      switch (data.type) {
        case 'STAGE_INIT': {
          cur.onSetSuppressLocalMidi(Boolean(data.suppressLocalMidi));
          break;
        }
        case 'STAGE_UNLOCK_AUDIO': {
          void Tone.start()
            .then(() => {
              cur.onAudioUnlocked();
              postToParent({ type: 'STAGE_AUDIO_STATE', audioState: getToneAudioState() });
            })
            .catch(() => {
              postToParent({ type: 'STAGE_AUDIO_STATE', audioState: getToneAudioState() });
            });
          break;
        }
        case 'STAGE_MIDI': {
          const ev = data.event;
          isApplyingRemoteRef.current = true;
          if (ev === 'noteOn' && typeof data.midi === 'number') {
            const noteName = Note.fromMidi(data.midi);
            if (noteName) cur.onRemoteNoteOn(noteName);
          } else if (ev === 'noteOff' && typeof data.midi === 'number') {
            const noteName = Note.fromMidi(data.midi);
            if (noteName) cur.onRemoteNoteOff(noteName);
          } else if (ev === 'allNotesOff') {
            cur.onRemoteClearNotes();
          }
          window.setTimeout(() => {
            isApplyingRemoteRef.current = false;
          }, 20);
          break;
        }
        case 'REMOTE_STATE': {
          const st = data.state as Partial<SyncableNoteNavState> | null;
          if (!st || typeof st !== 'object') break;
          isApplyingRemoteRef.current = true;
          const tuning =
            typeof st.selectedTuningName === 'string'
              ? GUITAR_TUNINGS.find((t) => t.name === st.selectedTuningName)
              : undefined;
          cur.applyRemoteState(st, tuning);
          window.setTimeout(() => {
            isApplyingRemoteRef.current = false;
          }, 50);
          break;
        }
        case 'REMOTE_ACTION': {
          const action = data.action;
          const payload = data.payload as Record<string, unknown> | undefined;
          isApplyingRemoteRef.current = true;
          if (action === 'PLAY_NOTE' && typeof payload?.note === 'string') {
            cur.onRemotePlayNote(payload.note);
          } else if (action === 'CLEAR_NOTES') {
            cur.onRemoteClearNotes();
          }
          window.setTimeout(() => {
            isApplyingRemoteRef.current = false;
          }, 20);
          break;
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [embedded]);

  useEffect(() => {
    if (!embedded || isApplyingRemoteRef.current) return;
    const encoded = JSON.stringify(state);
    if (encoded === lastSentRef.current) return;

    if (throttleRef.current !== null) {
      window.clearTimeout(throttleRef.current);
    }
    throttleRef.current = window.setTimeout(() => {
      throttleRef.current = null;
      if (isApplyingRemoteRef.current) return;
      lastSentRef.current = encoded;
      postToParent({ type: 'APP_STATE_UPDATE', state });
    }, 80);

    return () => {
      if (throttleRef.current !== null) {
        window.clearTimeout(throttleRef.current);
        throttleRef.current = null;
      }
    };
  }, [embedded, state]);

  const broadcastAction = useCallback(
    (action: string, payload?: unknown) => {
      if (!embedded || isApplyingRemoteRef.current) return;
      postToParent({ type: 'APP_ACTION', action, payload });
    },
    [embedded]
  );

  return {
    isEmbedded: embedded,
    broadcastAction,
  };
}
