import { useHarmonic } from "@/contexts/HarmonicContext";
import { getNotePitchClass, getDisplayNoteLabel, getNoteChroma } from "@/lib/music-engine";
import { getSolfegeColor, getSolfegeContrastText } from "@/lib/pptConstants";
import { Note } from "tonal";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMemo } from "react";

const LOW_MIDI = 48;
const HIGH_MIDI = 72;
const FADE_DURATION = 400;

export function LinearNoteMap() {
  const {
    activeNotes, selectedKey, scaleNotes, isKeyLocked, labelMode, useFlats,
    toggleNote, playNote, trailMode, isNoteVisible, isNotePressed, isNoteFading,
  } = useHarmonic();
  const isMobile = useIsMobile();

  const CIRCLE_SIZE = isMobile ? 20 : 28;
  const SMALL_CIRCLE = isMobile ? 12 : 16;

  const tonicChroma = useMemo(() => getNoteChroma(selectedKey), [selectedKey]);

  const baseMidi = useMemo(() => {
    if (activeNotes.size === 0) return undefined;
    let lowestActive = Infinity;
    activeNotes.forEach(n => { const m = Note.midi(n); if (m !== null && m < lowestActive) lowestActive = m; });
    if (!isFinite(lowestActive)) return undefined;
    let root = lowestActive;
    while (root % 12 !== tonicChroma && root >= 0) root--;
    return root >= 0 ? root : undefined;
  }, [activeNotes, tonicChroma]);

  const scaleChromas = useMemo(
    () => new Set(scaleNotes.map(n => Note.chroma(n)).filter((c): c is number => c !== undefined)),
    [scaleNotes]
  );

  const notes = useMemo(() => {
    const result = [];
    for (let midi = LOW_MIDI; midi <= HIGH_MIDI; midi++) {
      const noteName = Note.fromMidi(midi);
      const pc = getNotePitchClass(noteName, useFlats);
      const inScale = scaleChromas.has(midi % 12);
      const displayLabel = getDisplayNoteLabel(noteName, selectedKey, labelMode, useFlats, baseMidi);
      const semitoneFromTonic = ((midi % 12) - tonicChroma + 12) % 12;

      result.push({ midi, noteName, pc, inScale, displayLabel, semitoneFromTonic });
    }
    return result;
  }, [useFlats, scaleChromas, selectedKey, labelMode, baseMidi, tonicChroma]);

  return (
    <div className="glass-panel p-3 h-full flex flex-col" style={{ overflow: "visible" }}>
      <div className="flex items-center justify-between mb-1 shrink-0">
        <h3 className="engineering-label">
          Linear Note Map
        </h3>
        <span className="text-[9px] text-muted-foreground font-mono">C3 ← C4 → C5</span>
      </div>

      <div className="relative flex-1 min-h-0 flex items-center overflow-x-auto" style={{ overflow: "visible" }}>
        <div
          className="relative flex items-center justify-between px-4 py-2 w-full"
          style={{ minWidth: isMobile ? 540 : undefined, overflow: "visible" }}
        >
          <div
            className="absolute top-1/2 left-0 right-0 -translate-y-1/2"
            style={{ height: 2, background: "hsl(var(--border))" }}
          />

          {notes.map(n => {
            const color = getSolfegeColor(n.midi % 12, tonicChroma, { neonFi: true });
            const textColor = getSolfegeContrastText(n.semitoneFromTonic, { neonFi: true });
            const isTonic = n.semitoneFromTonic === 0;
            const pressed = isNotePressed(n.noteName);
            const fading = isNoteFading(n.noteName);
            const visible = isNoteVisible(n.noteName);
            const deEmphasize = isKeyLocked && !n.inScale && !visible;
            const size = deEmphasize ? SMALL_CIRCLE : CIRCLE_SIZE;

            const boxShadow = visible
              ? `0 0 16px 4px ${color}${isTonic ? ", 0 0 0 2px #ffffff" : ""}`
              : isTonic && (!isKeyLocked || n.inScale)
                ? "0 0 0 2px #ffffff"
                : isKeyLocked && n.inScale
                  ? "0 0 0 2px hsl(var(--foreground) / 0.55)"
                  : "none";

            return (
              <button
                key={n.midi}
                onClick={() => { toggleNote(n.noteName); playNote(n.noteName); }}
                className={`relative flex items-center justify-center shrink-0 ${pressed ? "note-active" : ""}`}
                style={{
                  width: size,
                  height: size,
                  borderRadius: "50%",
                  backgroundColor: color,
                  opacity: deEmphasize ? 0.22 : visible ? 1 : 0.72,
                  boxShadow,
                  color,
                  transition: "width 150ms, height 150ms",
                  zIndex: visible ? 20 : 10,
                  overflow: "visible",
                  animation: fading && trailMode
                    ? `note-fade-out ${FADE_DURATION}ms ease-out forwards`
                    : undefined,
                }}
                title={`${n.pc}${Note.octave(n.noteName)} (${n.displayLabel})`}
              >
                {visible && trailMode && !fading && (
                  <span
                    className="absolute rounded-full pointer-events-none"
                    style={{
                      inset: -10,
                      border: `2px solid ${color}`,
                      borderRadius: "50%",
                      animation: "trail-ripple 1.2s ease-out infinite",
                    }}
                  />
                )}
                {!deEmphasize && (
                  <span
                    className={`font-mono font-bold leading-none select-none ${
                      isMobile
                        ? "text-[6px]"
                        : n.displayLabel.length > 2
                          ? "text-[6px]"
                          : n.displayLabel.length > 1
                            ? "text-[7px]"
                            : "text-[8.5px]"
                    }`}
                    style={{ color: textColor }}
                  >
                    {n.displayLabel}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
