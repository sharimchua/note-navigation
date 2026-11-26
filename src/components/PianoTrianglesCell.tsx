import { useMemo } from "react";
import { Note } from "tonal";
import { useHarmonic } from "@/contexts/HarmonicContext";
import { getDisplayNoteLabel, getNoteChroma } from "@/lib/music-engine";
import {
  getScaleTetrachordChainTriangles,
  PIANO_TRIANGLE_META,
  PIANO_TRIANGLE_POINT_TO_PITCH_CLASS,
  TRIANGLE_VERTEX_COORDINATES,
  getSolfegeColor,
  getSolfegeContrastText,
  type PianoTrianglePoint,
} from "@/lib/pptConstants";

/**
 * Full interactive Piano Triangles Scale Signature cell (ported from PPT Visualiser / PPT Engraver).
 * Chains the active scale around Do ([5,6,7] -> [Do] -> [2,3,4]) across the 4 physical keyboard triangles.
 */
export function PianoTrianglesCell() {
  const {
    selectedKey,
    scaleIntervals,
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

  const segments = useMemo(
    () => getScaleTetrachordChainTriangles(tonicChroma, scaleIntervals),
    [tonicChroma, scaleIntervals]
  );

  const activePcSet = useMemo(() => {
    const set = new Set<number>();
    activeNotes.forEach(note => {
      if (!isNoteVisible(note)) return;
      const m = Note.midi(note);
      if (m !== null) set.add(((m % 12) + 12) % 12);
    });
    return set;
  }, [activeNotes, isNoteVisible]);

  const nextPcSet = useMemo(() => {
    const set = new Set<number>();
    if (!phraseMode || !showNextPreview) return set;
    nextOnsetNotes.forEach(note => {
      const m = Note.midi(note);
      if (m !== null) set.add(((m % 12) + 12) % 12);
    });
    return set;
  }, [phraseMode, showNextPreview, nextOnsetNotes]);

  const triSize = 96;
  const gap = 18;
  const padX = 16;
  const padY = 18;
  const totalW = padX * 2 + segments.length * triSize + Math.max(0, segments.length - 1) * gap;
  const totalH = triSize + padY * 2;

  const doSegIdx = segments.findIndex(s => s.hasDo);
  const doSeg = doSegIdx !== -1 ? segments[doSegIdx] : segments[0];
  const doX = doSeg
    ? padX +
      Math.max(0, doSegIdx) * (triSize + gap) +
      ((TRIANGLE_VERTEX_COORDINATES[doSeg.triangle].points[doSeg.doPoint ?? 2]?.x ?? 50) / 100) * triSize
    : totalW / 2;

  return (
    <div className="glass-panel p-2.5 h-full flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
        <h3 className="engineering-label">Piano Triangles Scale</h3>
        <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
          {segments.map((seg, i) => (
            <span key={`leg-${i}`} style={{ color: PIANO_TRIANGLE_META[seg.triangle].color }}>
              {seg.triangle}
            </span>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden">
        <svg
          viewBox={`0 0 ${totalW} ${totalH}`}
          className="w-full h-full block"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Tetrachord-chained Piano Triangles Scale Signature"
        >
          {/* Baseline link */}
          {segments.length > 1 && (
            <line
              x1={padX + triSize / 2}
              y1={totalH / 2}
              x2={totalW - padX - triSize / 2}
              y2={totalH / 2}
              stroke="rgba(148, 163, 184, 0.16)"
              strokeWidth={1.5}
            />
          )}

          {/* Do Centre Anchor Guide */}
          <line
            x1={doX}
            y1={7}
            x2={doX}
            y2={totalH - 6}
            stroke="rgba(225, 54, 16, 0.32)"
            strokeWidth={1.2}
            strokeDasharray="3 4"
          />
          <circle cx={doX} cy={7} r={2.5} fill="#E13610" />

          {segments.map((seg, segIdx) => {
            const tx = padX + segIdx * (triSize + gap);
            const ty = padY;
            const geom = TRIANGLE_VERTEX_COORDINATES[seg.triangle];
            const meta = PIANO_TRIANGLE_META[seg.triangle];
            const scale = triSize / 100;

            return (
              <g key={`seg-${segIdx}`} transform={`translate(${tx}, ${ty})`}>
                <g transform={`scale(${scale})`}>
                  <path
                    d={geom.path}
                    fill={`${meta.color}1e`}
                    stroke={meta.color}
                    strokeWidth={2.5 / scale}
                    strokeLinejoin="round"
                  />
                </g>

                {([1, 2, 3] as PianoTrianglePoint[]).map(pt => {
                  const coords = geom.points[pt];
                  const cx = coords.x * scale;
                  const cy = coords.y * scale;
                  const pc = PIANO_TRIANGLE_POINT_TO_PITCH_CLASS[seg.triangle][pt];
                  const scaleInfo = seg.scaleVertices.get(pt);
                  const isInScale = Boolean(scaleInfo);
                  const isActive = activePcSet.has(pc);
                  const isNext = nextPcSet.has(pc);
                  const semitone = ((pc - tonicChroma) % 12 + 12) % 12;
                  const color = getSolfegeColor(pc, tonicChroma, { neonFi: true });
                  const textFill = getSolfegeContrastText(semitone, { neonFi: true });
                  const noteName = Note.fromMidi(60 + pc);
                  const label = getDisplayNoteLabel(noteName, selectedKey, labelMode, useFlats);
                  const r = isActive ? 12.5 : isInScale ? 10 : 6.5;

                  return (
                    <g
                      key={pt}
                      className="cursor-pointer"
                      onClick={() => {
                        toggleNote(noteName);
                        playNote(noteName);
                      }}
                    >
                      <title>{`${noteName} (${label})`}</title>
                      {isNext && !isActive && (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={r + 4}
                          fill="none"
                          stroke="rgba(52, 211, 153, 0.85)"
                          strokeWidth={1.5}
                          strokeDasharray="2.5 2.5"
                        />
                      )}
                      {isActive && (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={r + 3.5}
                          fill="none"
                          stroke={color}
                          strokeWidth={1.6}
                          opacity={0.7}
                        />
                      )}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={r}
                        fill={isActive || isInScale ? color : "rgba(15, 23, 42, 0.85)"}
                        stroke={scaleInfo?.isDo ? "#ffffff" : isActive ? "#ffffff" : meta.color}
                        strokeWidth={scaleInfo?.isDo || isActive ? 1.8 : 1.1}
                        opacity={isActive || isInScale ? 1 : 0.4}
                      />
                      {(isActive || isInScale) && (
                        <text
                          x={cx}
                          y={cy + 2.8}
                          textAnchor="middle"
                          fontSize={label.length > 2 ? "6.2" : "7.5"}
                          fontFamily="JetBrains Mono"
                          fontWeight="bold"
                          fill={textFill}
                        >
                          {label}
                        </text>
                      )}
                    </g>
                  );
                })}

                <text
                  x={triSize / 2}
                  y={triSize + 15}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontFamily="JetBrains Mono"
                  fontWeight="bold"
                  fill={meta.color}
                >
                  {seg.triangle}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
