import { useMemo } from "react";
import { Note } from "tonal";
import { useHarmonic } from "@/contexts/HarmonicContext";
import { getDisplayNoteLabel, getNoteChroma } from "@/lib/music-engine";
import {
  getSolfegeColor,
  getSolfegeContrastText,
  SOLFEGE_SYLLABLES,
} from "@/lib/pptConstants";

const CX = 150;
const CY = 150;
const OUTER_R = 126;
const RING_RADII = [46, 67, 88, 109]; // Octaves 2, 3, 4, 5

/**
 * Static concentric-octave Pitch Clock cell matching PPT Visualiser's 12 o'clock movable-Do geometry.
 * Designed for careful inspection of pitch classes, octaves, interval polygons, and phrase lookahead.
 */
export function PitchClockCell() {
  const {
    selectedKey,
    scaleNotes,
    isKeyLocked,
    labelMode,
    useFlats,
    activeNotes,
    nextOnsetNotes,
    showNextPreview,
    phraseMode,
    toggleNote,
    playNote,
    isNoteVisible,
  } = useHarmonic();

  const tonicChroma = useMemo(() => getNoteChroma(selectedKey), [selectedKey]);

  const scaleChromaSet = useMemo(() => {
    const set = new Set<number>();
    scaleNotes.forEach(n => set.add(getNoteChroma(n)));
    return set;
  }, [scaleNotes]);

  const activeItems = useMemo(() => {
    const items: { note: string; midi: number; pc: number; oct: number; semitone: number }[] = [];
    activeNotes.forEach(note => {
      if (!isNoteVisible(note)) return;
      const midi = Note.midi(note);
      if (midi === null) return;
      const pc = ((midi % 12) + 12) % 12;
      const oct = Math.floor(midi / 12) - 1;
      const semitone = ((pc - tonicChroma) % 12 + 12) % 12;
      items.push({ note, midi, pc, oct, semitone });
    });
    return items.sort((a, b) => a.midi - b.midi);
  }, [activeNotes, isNoteVisible, tonicChroma]);

  const activePcSet = useMemo(() => new Set(activeItems.map(i => i.pc)), [activeItems]);

  const nextPcSet = useMemo(() => {
    const set = new Set<number>();
    if (!phraseMode || !showNextPreview) return set;
    nextOnsetNotes.forEach(note => {
      const m = Note.midi(note);
      if (m !== null) set.add(((m % 12) + 12) % 12);
    });
    return set;
  }, [phraseMode, showNextPreview, nextOnsetNotes]);

  // Clock coordinates: semitone 0 (Do) at 12 o'clock (-PI/2)
  const angleForSemitone = (semitone: number) => ((semitone / 12) * Math.PI * 2) - Math.PI / 2;

  const polygonPoints = useMemo(() => {
    const uniqueSemitones = [...new Set(activeItems.map(i => i.semitone))].sort((a, b) => a - b);
    if (uniqueSemitones.length < 2) return "";
    return uniqueSemitones
      .map(s => {
        const a = angleForSemitone(s);
        return `${(CX + (OUTER_R - 14) * Math.cos(a)).toFixed(1)},${(CY + (OUTER_R - 14) * Math.sin(a)).toFixed(1)}`;
      })
      .join(" ");
  }, [activeItems]);

  const hourNodes = useMemo(() => {
    return Array.from({ length: 12 }, (_, semitone) => {
      const pc = (tonicChroma + semitone) % 12;
      const midi = 60 + pc; // Octave 4 reference for clicking
      const sampleNote = Note.fromMidi(midi);
      const angle = angleForSemitone(semitone);
      const x = CX + OUTER_R * Math.cos(angle);
      const y = CY + OUTER_R * Math.sin(angle);
      const color = getSolfegeColor(pc, tonicChroma, { neonFi: true });
      const textFill = getSolfegeContrastText(semitone, { neonFi: true });
      const inScale = !isKeyLocked || scaleChromaSet.has(pc);
      const isActive = activePcSet.has(pc);
      const isNext = nextPcSet.has(pc);
      const label = getDisplayNoteLabel(sampleNote, selectedKey, labelMode, useFlats);

      return {
        semitone,
        pc,
        sampleNote,
        x,
        y,
        color,
        textFill,
        inScale,
        isActive,
        isNext,
        label,
        syllable: SOLFEGE_SYLLABLES[semitone],
      };
    });
  }, [tonicChroma, isKeyLocked, scaleChromaSet, activePcSet, nextPcSet, selectedKey, labelMode, useFlats]);

  return (
    <div className="glass-panel p-2.5 h-full flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-1">
        <h3 className="engineering-label">Pitch Clock Rings</h3>
        <span className="text-[10px] font-mono text-muted-foreground">
          Do = <strong className="text-primary">{selectedKey}</strong>
        </span>
      </div>

      <div className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden">
        <svg viewBox="0 0 300 300" className="w-full h-full block" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Movable-Do Pitch Clock Rings">
          {/* Concentric octave guide rings */}
          {RING_RADII.map((r, idx) => (
            <circle
              key={`ring-${idx}`}
              cx={CX}
              cy={CY}
              r={r}
              fill="none"
              stroke="rgba(148, 163, 184, 0.16)"
              strokeWidth={1}
              strokeDasharray={idx === 2 ? undefined : "2 4"}
            />
          ))}

          {/* Outer clock ring */}
          <circle
            cx={CX}
            cy={CY}
            r={OUTER_R}
            fill="none"
            stroke="rgba(148, 163, 184, 0.25)"
            strokeWidth={1}
          />

          {/* 12 o'clock Do zenith radial spoke */}
          <line
            x1={CX}
            y1={CY - RING_RADII[0] + 6}
            x2={CX}
            y2={Math.max(4, CY - OUTER_R - 16)}
            stroke="rgba(225, 54, 16, 0.35)"
            strokeWidth={1.2}
            strokeDasharray="3 3"
          />

          {/* Active interval polygon */}
          {polygonPoints && (
            <polygon
              points={polygonPoints}
              fill="rgba(52, 211, 153, 0.12)"
              stroke="rgba(52, 211, 153, 0.72)"
              strokeWidth={1.6}
              strokeLinejoin="round"
            />
          )}

          {/* Active octave dots on concentric octave rings */}
          {activeItems.map(item => {
            const octIdx = Math.max(0, Math.min(RING_RADII.length - 1, item.oct - 2));
            const r = RING_RADII[octIdx];
            const a = angleForSemitone(item.semitone);
            const x = CX + r * Math.cos(a);
            const y = CY + r * Math.sin(a);
            const color = getSolfegeColor(item.pc, tonicChroma, { neonFi: true });
            return (
              <g key={`oct-${item.note}`}>
                <circle
                  cx={x}
                  cy={y}
                  r={5.5}
                  fill={color}
                  stroke="#ffffff"
                  strokeWidth={1.2}
                />
                <title>{item.note}</title>
              </g>
            );
          })}

          {/* 12 Chromatic Pitch Class Nodes */}
          {hourNodes.map(node => {
            const r = node.isActive ? 15 : node.inScale ? 13 : 9;
            return (
              <g
                key={node.semitone}
                className="cursor-pointer"
                onClick={() => {
                  toggleNote(node.sampleNote);
                  playNote(node.sampleNote);
                }}
                opacity={!node.inScale && !node.isActive && !node.isNext ? 0.28 : 1}
              >
                <title>{`${node.sampleNote} · ${node.syllable}`}</title>
                <circle cx={node.x} cy={node.y} r={17} fill="transparent" />
                {node.isNext && !node.isActive && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={r + 4.5}
                    fill="none"
                    stroke="rgba(52, 211, 153, 0.85)"
                    strokeWidth={1.5}
                    strokeDasharray="2.5 2.5"
                  />
                )}
                {node.isActive && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={r + 4}
                    fill="none"
                    stroke={node.color}
                    strokeWidth={1.6}
                    opacity={0.65}
                  />
                )}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={r}
                  fill={node.isActive ? node.color : node.inScale ? "rgba(15, 23, 42, 0.92)" : "rgba(15, 23, 42, 0.55)"}
                  stroke={node.semitone === 0 ? "#ffffff" : node.color}
                  strokeWidth={node.semitone === 0 ? 2 : node.isActive ? 1.8 : 1.4}
                />
                {(node.inScale || node.isActive || node.isNext) && (
                  <text
                    x={node.x}
                    y={node.y + 3.2}
                    textAnchor="middle"
                    fontSize={node.label.length > 2 ? "7" : "8.8"}
                    fontFamily="JetBrains Mono"
                    fontWeight="bold"
                    fill={node.isActive ? node.textFill : "#e2e8f0"}
                  >
                    {node.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Center label */}
          <text
            x={CX}
            y={CY - 3}
            textAnchor="middle"
            fontSize="10"
            fontFamily="JetBrains Mono"
            fill="rgba(148, 163, 184, 0.8)"
          >
            {activeItems.length > 0 ? `${activeItems.length} notes` : "12-Pitch"}
          </text>
          <text
            x={CX}
            y={CY + 11}
            textAnchor="middle"
            fontSize="8.5"
            fontFamily="JetBrains Mono"
            fill="rgba(148, 163, 184, 0.55)"
          >
            Oct 2–5
          </text>
        </svg>
      </div>
    </div>
  );
}
