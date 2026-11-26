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

function getInitialRole(): 'teacher' | 'student' {
  if (typeof window === 'undefined') return 'student';
  return new URLSearchParams(window.location.search).get('role') === 'teacher'
    ? 'teacher'
    : 'student';
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

function mountAudioPromptPill(onTap: () => void) {
  let el: HTMLButtonElement | null = null;
  const hide = () => {
    if (el) {
      el.remove();
      el = null;
    }
  };
  const show = () => {
    if (el || typeof document === 'undefined' || !document.body) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Tap to Enable Sound';
    btn.style.cssText =
      'position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:2147483647;' +
      'padding:10px 18px;border-radius:9999px;border:1px solid rgba(52,211,153,0.55);' +
      'background:rgba(15,23,42,0.95);color:#6ee7b7;font:600 13px/1.2 system-ui,sans-serif;' +
      'box-shadow:0 10px 28px rgba(0,0,0,0.45);cursor:pointer;backdrop-filter:blur(8px);';
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      onTap();
    });
    document.body.appendChild(btn);
    el = btn;
  };
  return { show, hide, destroy: hide };
}

interface UseStageBridgeOptions {
  state: SyncableNoteNavState;
  onSetSuppressLocalMidi: (suppressed: boolean) => void;
  onSetEcoMode?: (eco: boolean) => void;
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
  onSetEcoMode,
  onRemoteNoteOn,
  onRemoteNoteOff,
  onRemoteClearNotes,
  onRemotePlayNote,
  onAudioUnlocked,
  applyRemoteState,
}: UseStageBridgeOptions) {
  const embedded = isStageEmbedded();
  const isApplyingRemoteRef = useRef(false);
  const roleRef = useRef<'teacher' | 'student'>(getInitialRole());
  const lastSentRef = useRef(JSON.stringify(state));
  const throttleRef = useRef<number | null>(null);

  const latestRef = useRef({
    state,
    onSetSuppressLocalMidi,
    onSetEcoMode,
    onRemoteNoteOn,
    onRemoteNoteOff,
    onRemoteClearNotes,
    onRemotePlayNote,
    onAudioUnlocked,
    applyRemoteState,
  });
  latestRef.current = {
    state,
    onSetSuppressLocalMidi,
    onSetEcoMode,
    onRemoteNoteOn,
    onRemoteNoteOff,
    onRemoteClearNotes,
    onRemotePlayNote,
    onAudioUnlocked,
    applyRemoteState,
  };

  useEffect(() => {
    if (!embedded) return;

    const pushCurrentState = () => {
      const cur = latestRef.current;
      lastSentRef.current = JSON.stringify(cur.state);
      postToParent({ type: 'APP_STATE_UPDATE', state: cur.state });
    };

    const handleGestureUnlock = () => {
      void Tone.start()
        .then(() => {
          latestRef.current.onAudioUnlocked();
          const st = getToneAudioState();
          postToParent({ type: 'STAGE_AUDIO_STATE', audioState: st });
          if (st === 'running') {
            prompt.hide();
          }
        })
        .catch(() => {
          postToParent({ type: 'STAGE_AUDIO_STATE', audioState: getToneAudioState() });
        });
    };

    const prompt = mountAudioPromptPill(handleGestureUnlock);
    const onPointerUnlock = () => {
      if (getToneAudioState() !== 'running') {
        handleGestureUnlock();
      }
    };
    window.addEventListener('pointerdown', onPointerUnlock, true);

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
          roleRef.current = data.role === 'teacher' ? 'teacher' : 'student';
          cur.onSetSuppressLocalMidi(Boolean(data.suppressLocalMidi));
          if (typeof data.ecoMode === 'boolean') {
            cur.onSetEcoMode?.(data.ecoMode);
          }
          if (roleRef.current === 'teacher') {
            pushCurrentState();
          }
          break;
        }
        case 'STAGE_ECO_MODE': {
          if (typeof data.ecoMode === 'boolean') {
            cur.onSetEcoMode?.(data.ecoMode);
          }
          break;
        }
        case 'STAGE_REQUEST_STATE': {
          if (roleRef.current === 'teacher') {
            pushCurrentState();
          }
          break;
        }
        case 'STAGE_UNLOCK_AUDIO': {
          void Tone.start()
            .then(() => {
              cur.onAudioUnlocked();
              const audioState = getToneAudioState();
              postToParent({ type: 'STAGE_AUDIO_STATE', audioState });
              if (audioState !== 'running') {
                prompt.show();
              } else {
                prompt.hide();
              }
            })
            .catch(() => {
              const audioState = getToneAudioState();
              postToParent({ type: 'STAGE_AUDIO_STATE', audioState });
              if (audioState !== 'running') prompt.show();
            });
          break;
        }
        case 'STAGE_MIDI': {
          const ev = data.event;
          isApplyingRemoteRef.current = true;
          if (ev === 'noteOn' && typeof data.midi === 'number') {
            const noteName = Note.fromMidi(data.midi);
            if (noteName) cur.onRemoteNoteOn(noteName);
            if (getToneAudioState() !== 'running') {
              prompt.show();
            }
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
          lastSentRef.current = JSON.stringify({ ...cur.state, ...st });
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
            if (getToneAudioState() !== 'running') {
              prompt.show();
            }
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
    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('pointerdown', onPointerUnlock, true);
      prompt.destroy();
    };
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
