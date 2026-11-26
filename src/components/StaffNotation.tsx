import { useCallback, useRef, useMemo, useEffect } from "react";
import { useHarmonic } from "@/contexts/HarmonicContext";
import {
  getNoteColor,
  getNoteChroma,
  getDisplayNoteLabel,
  type AccidentalPreference,
} from "@/lib/music-engine";
import {
  getPptNoteheadSpec,
  getSolfegeContrastText,
  isBlackPianoKey,
  midiToPptDiatonicPos,
  getScaleTetrachordChainTriangles,
  PIANO_TRIANGLE_META,
  TRIANGLE_VERTEX_COORDINATES,
  type PptNoteheadShape,
  type PianoTrianglePoint,
} from "@/lib/pptConstants";
import { SMUFL_GLYPH_PATHS } from "@/lib/smufl-glyphs";
import {
  assignClefsForSplitStaff,
  type ClefChoice,
  type MelodyContext,
} from "@/lib/staff-clef-assignment";
import { Note, Key } from "tonal";

// Staff geometry in SVG viewBox (0 0 260 260)
const SVG_W = 260;
const SVG_H = 260;
const LINE_SP = 12;            // 1 staff space
const HALF_STEP = LINE_SP / 2; // 6 units per diatonic step
const CENTER_Y = 130;

const STAFF_X_START = 12;
const STAFF_X_END = 248;
const CLEF_X = 22;
const KEY_SIG_START_X = 70;
const KEY_SIG_SPACING = 7.2;
const CHORD_X = 176;
const SECOND_OFFSET = 14;

const DIATONIC_MAP_SHARP = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
const DIATONIC_MAP_FLAT  = [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6];
const SHARP_PC_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_PC_NAMES  = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"];
const FLAT_ORDER  = ["B", "E", "A", "D", "G", "C", "F"];
const TREBLE_SHARP_POSITIONS = [10, 7, 11, 8, 5, 9, 6];
const TREBLE_FLAT_POSITIONS  = [6, 9, 5, 8, 4, 7, 3];
const BASS_SHARP_POSITIONS   = TREBLE_SHARP_POSITIONS.map(p => p - 14);
const BASS_FLAT_POSITIONS    = TREBLE_FLAT_POSITIONS.map(p => p - 14);

const FADE_DURATION = 400;

function smartSpellNotes(midis: number[], defaultUseFlats: boolean): Map<number, { pc: string; useFlat: boolean }> {
  const result = new Map<number, { pc: string; useFlat: boolean }>();
  const defaultNames = defaultUseFlats ? FLAT_PC_NAMES : SHARP_PC_NAMES;
  for (const midi of midis) {
    const pc = midi % 12;
    result.set(midi, { pc: defaultNames[pc], useFlat: defaultUseFlats });
  }
  const chromas = [...new Set(midis.map(m => m % 12))].sort((a, b) => a - b);
  for (const chroma of chromas) {
    const isAccidental = [1, 3, 6, 8, 10].includes(chroma);
    if (!isAccidental) continue;
    const sharpName = SHARP_PC_NAMES[chroma];
    const flatName = FLAT_PC_NAMES[chroma];
    const sharpLetter = sharpName[0];
    const flatLetter = flatName[0];
    const otherChromas = chromas.filter(c => c !== chroma);
    const sharpLetterConflict = otherChromas.some(c => SHARP_PC_NAMES[c][0] === sharpLetter || FLAT_PC_NAMES[c][0] === sharpLetter);
    const flatLetterConflict = otherChromas.some(c => SHARP_PC_NAMES[c][0] === flatLetter || FLAT_PC_NAMES[c][0] === flatLetter);
    let chosenPc: string;
    let chosenFlat: boolean;
    if (defaultUseFlats) {
      if (flatLetterConflict && !sharpLetterConflict) { chosenPc = sharpName; chosenFlat = false; }
      else { chosenPc = flatName; chosenFlat = true; }
    } else {
      if (sharpLetterConflict && !flatLetterConflict) { chosenPc = flatName; chosenFlat = true; }
      else { chosenPc = sharpName; chosenFlat = false; }
    }
    for (const midi of midis) {
      if (midi % 12 === chroma) result.set(midi, { pc: chosenPc, useFlat: chosenFlat });
    }
  }
  return result;
}

function midiToDiatonicPos(midi: number, useFlats: boolean): number {
  const octave = Math.floor(midi / 12);
  const pc = midi % 12;
  const map = useFlats ? DIATONIC_MAP_FLAT : DIATONIC_MAP_SHARP;
  return map[pc] + (octave - 5) * 7;
}

const SCALE_TO_PARENT_OFFSET: Record<string, number> = {
  "major": 0, "ionian": 0,
  "dorian": 2,
  "phrygian": 4,
  "lydian": 5,
  "mixolydian": 7,
  "minor": 9, "aeolian": 9,
  "locrian": 11,
  "harmonic minor": 9,
  "melodic minor": 9,
  "major pentatonic": 0,
  "minor pentatonic": 9,
  "blues": 9,
};

function getKeySignature(selectedKey: string, selectedScale: string) {
  const offset = SCALE_TO_PARENT_OFFSET[selectedScale] ?? 0;
  const rootChroma = Note.chroma(selectedKey) ?? 0;
  const parentChroma = (rootChroma - offset + 12) % 12;

  const possibleRoots = ["C", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "Ab", "A", "Bb", "B"];
  const parentRoot = possibleRoots.find(r => (Note.chroma(r) ?? -1) === parentChroma) || "C";

  const keyInfo = Key.majorKey(parentRoot);
  if (!keyInfo) return { sharps: 0, flats: 0, type: "sharp" as const };
  const alteration = (keyInfo as { alteration?: number }).alteration ?? 0;
  if (alteration > 0) return { sharps: alteration, flats: 0, type: "sharp" as const };
  if (alteration < 0) return { sharps: 0, flats: Math.abs(alteration), type: "flat" as const };
  return { sharps: 0, flats: 0, type: "sharp" as const };
}

/**
 * Compact PPT Piano Triangle Scale Key Signature (ported from ppt-engraver).
 * Shows the 4–5 tetrachord-chained triangles for the active scale with Solfège vertices & Do anchor.
 */
function PptTriangleKeySignature({
  tonicPc,
  intervals,
}: {
  tonicPc: number;
  intervals: number[];
}) {
  const segments = useMemo(
    () => getScaleTetrachordChainTriangles(tonicPc, intervals),
    [tonicPc, intervals]
  );

  const triSize = 20;
  const gap = 4;
  const padX = 4;
  const padY = 4;
  const totalW = padX * 2 + segments.length * triSize + Math.max(0, segments.length - 1) * gap;
  const totalH = triSize + padY * 2;

  return (
    <svg
      width={totalW}
      height={totalH}
      viewBox={`0 0 ${totalW} ${totalH}`}
      className="shrink-0"
      aria-label="PPT Piano Triangle Scale Key Signature"
    >
      {segments.map((seg, idx) => {
        const tx = padX + idx * (triSize + gap);
        const ty = padY;
        const geom = TRIANGLE_VERTEX_COORDINATES[seg.triangle];
        const meta = PIANO_TRIANGLE_META[seg.triangle];
        const scale = triSize / 100;

        return (
          <g key={`ks-tri-${idx}`} transform={`translate(${tx}, ${ty})`}>
            <g transform={`scale(${scale})`}>
              <path
                d={geom.path}
                fill={`${meta.color}26`}
                stroke={meta.color}
                strokeWidth={1.3 / scale}
                strokeLinejoin="round"
              />
            </g>
            {([1, 2, 3] as PianoTrianglePoint[]).map(pt => {
              const info = seg.scaleVertices.get(pt);
              if (!info) return null;
              const coords = geom.points[pt];
              return (
                <circle
                  key={pt}
                  cx={coords.x * scale}
                  cy={coords.y * scale}
                  r={info.isDo ? 3.2 : 2.3}
                  fill={info.semitonesFromDo === 6 ? info.neonColor : info.color}
                  stroke={info.isDo ? "#ffffff" : "#0b0d13"}
                  strokeWidth={info.isDo ? 1 : 0.6}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Renders a Prime Period Theory geometric notehead at (cx, cy).
 */
function PptSvgNotehead({
  shape,
  colorHex,
  neonColorHex,
  cx,
  cy,
  isBlackKey,
  radius = 5.4,
}: {
  shape: PptNoteheadShape;
  colorHex: string;
  neonColorHex: string;
  cx: number;
  cy: number;
  isBlackKey: boolean;
  radius?: number;
}) {
  const isFi = colorHex.toLowerCase() === "#141414";
  const fillColor = isBlackKey ? "#090d16" : (isFi ? "#141414" : colorHex);
  const strokeColor = isBlackKey ? neonColorHex : "#ffffff";
  const strokeWidth = isBlackKey ? 1.35 : 1.05;
  const r = radius;

  const renderShape = () => {
    switch (shape) {
      case "circle":
        return <circle cx={0} cy={0} r={r} fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} />;
      case "diamond":
        return <polygon points={`-${r * 1.2},0 0,-${r} ${r * 1.2},0 0,${r}`} fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} />;
      case "square":
        return <rect x={-r * 0.9} y={-r * 0.8} width={r * 1.8} height={r * 1.6} rx={1} fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} />;
      case "triangle-down":
        return <polygon points={`-${r * 1.15},-${r * 0.85} ${r * 1.15},-${r * 0.85} 0,${r * 1.1}`} fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} />;
      case "triangle-up":
        return <polygon points={`-${r * 1.15},${r * 0.85} ${r * 1.15},${r * 0.85} 0,-${r * 1.1}`} fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} />;
      case "semicircle-left":
        return (
          <path
            d={`M ${r * 0.85} -${r} L ${r * 0.85} ${r} C -${r * 0.1} ${r} -${r * 0.95} ${r * 0.55} -${r * 0.95} 0 C -${r * 0.95} -${r * 0.55} -${r * 0.1} -${r} ${r * 0.85} -${r} Z`}
            fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth}
          />
        );
      case "semicircle-right":
        return (
          <path
            d={`M -${r * 0.85} ${r} L -${r * 0.85} -${r} C ${r * 0.1} -${r} ${r * 0.95} -${r * 0.55} ${r * 0.95} 0 C ${r * 0.95} ${r * 0.55} ${r * 0.1} ${r} -${r * 0.85} ${r} Z`}
            fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth}
          />
        );
      case "cross":
        return (
          <g>
            <circle cx={0} cy={0} r={r} fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} />
            <line x1={-r * 0.52} y1={-r * 0.52} x2={r * 0.52} y2={r * 0.52} stroke="#f8fafc" strokeWidth={1.35} strokeLinecap="round" />
            <line x1={r * 0.52} y1={-r * 0.52} x2={-r * 0.52} y2={r * 0.52} stroke="#f8fafc" strokeWidth={1.35} strokeLinecap="round" />
          </g>
        );
    }
  };

  return (
    <g transform={`translate(${cx}, ${cy})`}>
      {renderShape()}
      {isBlackKey && <circle cx={0} cy={0} r={1.6} fill={neonColorHex} />}
    </g>
  );
}

const NEXT_ACCIDENTAL: Record<AccidentalPreference, AccidentalPreference> = {
  auto: "sharps",
  sharps: "flats",
  flats: "auto",
};

interface PositionedStaffNote {
  note: string;
  midi: number;
  pc: string;
  color: string;
  useFlat: boolean;
  pressed: boolean;
  fading: boolean;
  clef: ClefChoice;
  y: number;
  x: number;
  offsetRight: boolean;
  stepIdx: number;
}

export function StaffNotation() {
  const {
    activeNotes, selectedKey, selectedScale, scaleIntervals, isKeyLocked, useFlats,
    accidentalPreference, setAccidentalPreference,
    pptNoteheads, setPptNoteheads,
    staffLayoutMode, setStaffLayoutMode,
    phraseMode, phraseOnsets, activeStepIndex, setActiveStepIndex,
    toggleNote, playNote, labelMode, trailMode, noteStates,
  } = useHarmonic();
  const svgRef = useRef<SVGSVGElement>(null);

  const prevClefMapRef = useRef<Map<string, ClefChoice>>(new Map());
  const lastMelodyContextRef = useRef<MelodyContext | null>(null);

  const isJoined = staffLayoutMode === "joined";
  const topStaffBottomY = isJoined ? CENTER_Y - LINE_SP : CENTER_Y - 3 * LINE_SP;
  const bottomStaffTopY = isJoined ? CENTER_Y + LINE_SP : CENTER_Y + 3 * LINE_SP;
  const trebleTopY = topStaffBottomY - 4 * LINE_SP;
  const bassBottomY = bottomStaffTopY + 4 * LINE_SP;
  const trebleC4Y = topStaffBottomY + LINE_SP;
  const bassC4Y = bottomStaffTopY - LINE_SP;

  const trebleLines = useMemo(
    () => Array.from({ length: 5 }, (_, i) => topStaffBottomY - i * LINE_SP),
    [topStaffBottomY]
  );
  const bassLines = useMemo(
    () => Array.from({ length: 5 }, (_, i) => bottomStaffTopY + i * LINE_SP),
    [bottomStaffTopY]
  );

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

  const DIATONIC_TO_MIDI_SHARP = [0, 2, 4, 5, 7, 9, 11];

  const yToNote = useCallback((y: number): string => {
    const refC4Y = isJoined
      ? CENTER_Y
      : (y <= CENTER_Y ? trebleC4Y : bassC4Y);
    const diatonicPos = Math.round((refC4Y - y) / HALF_STEP);
    const octaveOffset = Math.floor(diatonicPos / 7);
    const stepInOctave = ((diatonicPos % 7) + 7) % 7;
    const octave = 4 + octaveOffset;
    const pcNames = useFlats ? FLAT_PC_NAMES : SHARP_PC_NAMES;
    const midi = DIATONIC_TO_MIDI_SHARP[stepInOctave];
    return `${pcNames[midi]}${octave}`;
  }, [isJoined, trebleC4Y, bassC4Y, useFlats]);

  const isMultiStepPhrase = phraseMode && phraseOnsets.length > 1;

  const handleSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (isMultiStepPhrase) return;
    const svg = svgRef.current;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    const note = yToNote(svgPt.y);
    if (note) { playNote(note); toggleNote(note); }
  }, [isMultiStepPhrase, yToNote, playNote, toggleNote]);

  const allVisibleNotes = useMemo(() => {
    return noteStates.map(s => {
      const midi = Note.midi(s.note) ?? 60;
      return { ...s, midi };
    });
  }, [noteStates]);

  const splitClefMap = useMemo(() => {
    if (isJoined) return new Map<string, ClefChoice>();
    return assignClefsForSplitStaff(
      allVisibleNotes.map(n => ({ note: n.note, midi: n.midi, seq: n.seq })),
      prevClefMapRef.current,
      lastMelodyContextRef.current
    );
  }, [isJoined, allVisibleNotes]);

  useEffect(() => {
    if (isJoined) {
      prevClefMapRef.current.clear();
      return;
    }
    const nextMap = new Map<string, ClefChoice>();
    let latestSeq = -1;
    let latestContext: MelodyContext | null = null;
    for (const n of allVisibleNotes) {
      const c = splitClefMap.get(n.note) ?? (n.midi >= 60 ? "treble" : "bass");
      nextMap.set(n.note, c);
      if (n.seq > latestSeq) {
        latestSeq = n.seq;
        latestContext = { midi: n.midi, clef: c };
      }
    }
    prevClefMapRef.current = nextMap;
    if (latestContext) {
      lastMelodyContextRef.current = latestContext;
    }
  }, [isJoined, allVisibleNotes, splitClefMap]);

  const keySig = getKeySignature(selectedKey, selectedScale);
  const keySigIsSharps = keySig.type === "sharp";
  const keySigCount = !pptNoteheads ? (keySigIsSharps ? keySig.sharps : keySig.flats) : 0;

  // Compute positioned notes per onset column (single center column OR multi-step phrase columns)
  const { stepColumns, positionedNotes } = useMemo(() => {
    const activeScaleType = isKeyLocked ? selectedScale : undefined;
    const secondOffset = isMultiStepPhrase ? 11 : SECOND_OFFSET;

    if (!isMultiStepPhrase) {
      const allMidis = allVisibleNotes.map(n => n.midi);
      const spellingMap = smartSpellNotes(allMidis, useFlats);
      const activeArr = allVisibleNotes.map(n => {
        const spelling = spellingMap.get(n.midi) || {
          pc: (useFlats ? FLAT_PC_NAMES : SHARP_PC_NAMES)[n.midi % 12],
          useFlat: useFlats,
        };
        const clef: ClefChoice = isJoined
          ? (n.midi >= 60 ? "treble" : "bass")
          : (splitClefMap.get(n.note) ?? (n.midi >= 60 ? "treble" : "bass"));
        return {
          note: n.note,
          midi: n.midi,
          pc: spelling.pc,
          color: getNoteColor(n.note, selectedKey, { neonFi: true }),
          useFlat: spelling.useFlat,
          pressed: n.pressed,
          fading: n.fading,
          clef,
        };
      }).sort((a, b) => a.midi - b.midi);

      const positionClef = (notes: typeof activeArr, clef: ClefChoice): PositionedStaffNote[] => {
        const refC4Y = isJoined ? CENTER_Y : (clef === "treble" ? trebleC4Y : bassC4Y);
        const posList: PositionedStaffNote[] = notes.map(n => {
          const pos = pptNoteheads
            ? midiToPptDiatonicPos(n.midi, selectedKey, activeScaleType)
            : midiToDiatonicPos(n.midi, n.useFlat);
          return { ...n, y: refC4Y - pos * HALF_STEP, x: CHORD_X, offsetRight: false, stepIdx: 0 };
        });
        posList.sort((a, b) => b.y - a.y || a.midi - b.midi);
        for (let i = 1; i < posList.length; i++) {
          if (Math.abs(posList[i - 1].y - posList[i].y) <= HALF_STEP && !posList[i - 1].offsetRight) {
            posList[i].offsetRight = true;
            posList[i].x = CHORD_X + secondOffset;
          }
        }
        return posList;
      };

      const positioned = [
        ...positionClef(activeArr.filter(n => n.clef === "treble"), "treble"),
        ...positionClef(activeArr.filter(n => n.clef === "bass"), "bass"),
      ];

      return { stepColumns: [], positionedNotes: positioned };
    }

    // Multi-step phrase layout across staff width
    const keySigWidth = keySigCount > 0 ? keySigCount * KEY_SIG_SPACING + 8 : 0;
    const phraseXStart = (pptNoteheads ? 66 : KEY_SIG_START_X + keySigWidth + 10);
    const availW = Math.max(80, STAFF_X_END - 10 - phraseXStart);
    const slotW = availW / phraseOnsets.length;
    const cols: { stepIdx: number; x: number; w: number; centerX: number }[] = [];
    const allPos: PositionedStaffNote[] = [];

    let prevMap = new Map<string, ClefChoice>();
    let lastMel: MelodyContext | null = null;

    phraseOnsets.forEach((onset, stepIdx) => {
      const colX = phraseXStart + stepIdx * slotW;
      const centerX = colX + slotW / 2;
      cols.push({ stepIdx, x: colX, w: slotW, centerX });

      const stepNotes = onset.notes
        .map((note, idx) => ({ note, midi: Note.midi(note) ?? 60, seq: stepIdx * 16 + idx }));
      const midis = stepNotes.map(n => n.midi);
      const spellingMap = smartSpellNotes(midis, useFlats);
      const clefMap = isJoined
        ? new Map<string, ClefChoice>()
        : assignClefsForSplitStaff(stepNotes, prevMap, lastMel);
      if (!isJoined) {
        prevMap = clefMap;
        if (stepNotes.length > 0) {
          const top = [...stepNotes].sort((a, b) => a.midi - b.midi)[stepNotes.length - 1];
          lastMel = { midi: top.midi, clef: clefMap.get(top.note) ?? "treble" };
        }
      }

      const items = stepNotes.map(n => {
        const spelling = spellingMap.get(n.midi) || {
          pc: (useFlats ? FLAT_PC_NAMES : SHARP_PC_NAMES)[n.midi % 12],
          useFlat: useFlats,
        };
        const clef: ClefChoice = isJoined
          ? (n.midi >= 60 ? "treble" : "bass")
          : (clefMap.get(n.note) ?? (n.midi >= 60 ? "treble" : "bass"));
        return {
          note: n.note,
          midi: n.midi,
          pc: spelling.pc,
          color: getNoteColor(n.note, selectedKey, { neonFi: true }),
          useFlat: spelling.useFlat,
          pressed: stepIdx === activeStepIndex,
          fading: false,
          clef,
        };
      }).sort((a, b) => a.midi - b.midi);

      const positionClef = (notes: typeof items, clef: ClefChoice): PositionedStaffNote[] => {
        const refC4Y = isJoined ? CENTER_Y : (clef === "treble" ? trebleC4Y : bassC4Y);
        const posList: PositionedStaffNote[] = notes.map(n => {
          const pos = pptNoteheads
            ? midiToPptDiatonicPos(n.midi, selectedKey, activeScaleType)
            : midiToDiatonicPos(n.midi, n.useFlat);
          return { ...n, y: refC4Y - pos * HALF_STEP, x: centerX, offsetRight: false, stepIdx };
        });
        posList.sort((a, b) => b.y - a.y || a.midi - b.midi);
        for (let i = 1; i < posList.length; i++) {
          if (Math.abs(posList[i - 1].y - posList[i].y) <= HALF_STEP && !posList[i - 1].offsetRight) {
            posList[i].offsetRight = true;
            posList[i].x = centerX + secondOffset;
          }
        }
        return posList;
      };

      allPos.push(
        ...positionClef(items.filter(n => n.clef === "treble"), "treble"),
        ...positionClef(items.filter(n => n.clef === "bass"), "bass")
      );
    });

    return { stepColumns: cols, positionedNotes: allPos };
  }, [
    isMultiStepPhrase,
    allVisibleNotes,
    useFlats,
    isJoined,
    splitClefMap,
    selectedKey,
    selectedScale,
    isKeyLocked,
    pptNoteheads,
    trebleC4Y,
    bassC4Y,
    keySigCount,
    phraseOnsets,
    activeStepIndex,
  ]);

  // Unified deduplicated chord ledger lines grouped per onset step
  const unifiedLedgerLines = useMemo(() => {
    const byStepAndY = new Map<string, { y: number; minX: number; maxX: number }>();

    const record = (stepIdx: number, ly: number, x: number) => {
      const yKey = Math.round(ly * 10) / 10;
      const key = `${stepIdx}:${yKey}`;
      const existing = byStepAndY.get(key);
      if (!existing) {
        byStepAndY.set(key, { y: yKey, minX: x, maxX: x });
      } else {
        if (x < existing.minX) existing.minX = x;
        if (x > existing.maxX) existing.maxX = x;
      }
    };

    for (const n of positionedNotes) {
      if (n.clef === "treble") {
        if (n.y > topStaffBottomY + 0.5) {
          for (let ly = topStaffBottomY + LINE_SP; ly <= n.y + 0.5; ly += LINE_SP) {
            record(n.stepIdx, ly, n.x);
          }
        }
        if (n.y < trebleTopY - 0.5) {
          for (let ly = trebleTopY - LINE_SP; ly >= n.y - 0.5; ly -= LINE_SP) {
            record(n.stepIdx, ly, n.x);
          }
        }
      } else {
        if (n.y < bottomStaffTopY - 0.5) {
          for (let ly = bottomStaffTopY - LINE_SP; ly >= n.y - 0.5; ly -= LINE_SP) {
            record(n.stepIdx, ly, n.x);
          }
        }
        if (n.y > bassBottomY + 0.5) {
          for (let ly = bassBottomY + LINE_SP; ly <= n.y + 0.5; ly += LINE_SP) {
            record(n.stepIdx, ly, n.x);
          }
        }
      }
    }

    const halfPad = isMultiStepPhrase ? 8.5 : 11;
    return Array.from(byStepAndY.values()).map(entry => ({
      y: entry.y,
      x1: entry.minX - halfPad,
      x2: entry.maxX + halfPad,
    }));
  }, [positionedNotes, topStaffBottomY, trebleTopY, bottomStaffTopY, bassBottomY, isMultiStepPhrase]);

  const keySigAccidentalByLetter = useMemo(() => {
    const map: Record<string, -1 | 0 | 1> = { C: 0, D: 0, E: 0, F: 0, G: 0, A: 0, B: 0 };
    if (keySig.type === "sharp") {
      for (let i = 0; i < Math.min(keySig.sharps, 7); i++) map[SHARP_ORDER[i]] = 1;
    } else {
      for (let i = 0; i < Math.min(keySig.flats, 7); i++) map[FLAT_ORDER[i]] = -1;
    }
    return map;
  }, [keySig]);

  // SMuFL Clef anchor transforms: G4 = Treble line 2, F3 = Bass line 4
  const trebleAnchorY = topStaffBottomY - LINE_SP;
  const bassAnchorY = bottomStaffTopY + LINE_SP;
  const smuflScale = LINE_SP / 250;
  const trebleTransform = `translate(${CLEF_X}, ${trebleAnchorY}) scale(${smuflScale}, ${-smuflScale})`;
  const bassTransform = `translate(${CLEF_X}, ${bassAnchorY}) scale(${smuflScale}, ${-smuflScale})`;

  // Balanced key-signature & accidental proportions relative to noteheads
  const accSpace = LINE_SP * 0.66;
  const accScale = accSpace / 250;
  const keySigGlyph = keySigIsSharps ? SMUFL_GLYPH_PATHS.accidentalSharp : SMUFL_GLYPH_PATHS.accidentalFlat;
  const keySigCenterOffsetX = (keySigIsSharps ? 180 : 162) * accScale;
  const keySigCenterOffsetY = (keySigIsSharps ? 0 : 25) * accScale;

  // Inline accidentals for Traditional mode (grouped per step & clef)
  const inlineAccidentals = useMemo(() => {
    if (pptNoteheads) return [];
    const items: {
      key: string;
      x: number;
      y: number;
      acc: -1 | 0 | 1;
      clef: ClefChoice;
    }[] = [];

    const byStepAndClef = new Map<string, PositionedStaffNote[]>();
    for (const n of positionedNotes) {
      const key = `${n.stepIdx}:${n.clef}`;
      const arr = byStepAndClef.get(key);
      if (arr) arr.push(n);
      else byStepAndClef.set(key, [n]);
    }

    for (const [key, notes] of byStepAndClef.entries()) {
      const clef = notes[0].clef;
      const baseX = Math.min(...notes.map(n => n.x));
      const placedYs: number[][] = [[], [], []];
      for (const n of notes) {
        const letter = n.pc.charAt(0).toUpperCase();
        const noteAcc: -1 | 0 | 1 = n.pc.includes("#") ? 1 : n.pc.includes("b") ? -1 : 0;
        if (noteAcc === (keySigAccidentalByLetter[letter] ?? 0)) continue;

        let col = 0;
        while (col < placedYs.length && placedYs[col].some(py => Math.abs(py - n.y) <= LINE_SP * 1.7)) {
          col++;
        }
        const usedCol = Math.min(col, placedYs.length - 1);
        placedYs[usedCol].push(n.y);

        items.push({
          key: `acc-${key}-${n.note}`,
          x: baseX - 13 - usedCol * 6.5,
          y: n.y,
          acc: noteAcc,
          clef,
        });
      }
    }

    return items;
  }, [pptNoteheads, positionedNotes, keySigAccidentalByLetter]);

  const noteRadius = isMultiStepPhrase ? 4.4 : 5.4;

  function renderNote(n: PositionedStaffNote) {
    const { x, y } = n;
    const semitoneFromTonic = ((n.midi % 12) - tonicChroma + 12) % 12;
    const label = getDisplayNoteLabel(n.note, selectedKey, labelMode, n.useFlat, baseMidi);
    const isFading = n.fading && trailMode;
    const spec = getPptNoteheadSpec(semitoneFromTonic);
    const textFill = getSolfegeContrastText(semitoneFromTonic, { neonFi: true });
    const dimmedInPhrase = isMultiStepPhrase && n.stepIdx !== activeStepIndex;

    return (
      <g
        key={`${n.stepIdx}-${n.clef}-${n.note}`}
        className="cursor-pointer"
        opacity={dimmedInPhrase ? 0.45 : 1}
        onClick={(e) => {
          e.stopPropagation();
          if (isMultiStepPhrase) {
            setActiveStepIndex(n.stepIdx, true);
          } else {
            playNote(n.note);
            toggleNote(n.note);
          }
        }}
        style={isFading ? { animation: `note-fade-out ${FADE_DURATION}ms ease-out forwards` } : undefined}
      >
        <title>{`${label} (${n.note})`}</title>

        {isFading && (
          <>
            <rect
              x={x - 8} y={y - 3} width="16" height="6" rx="3" fill={n.color} opacity={0.5}
              style={{ transformOrigin: `${x}px ${y}px`, animation: `staff-dissipate-left ${FADE_DURATION}ms ease-out forwards` }}
            />
            <rect
              x={x - 8} y={y - 3} width="16" height="6" rx="3" fill={n.color} opacity={0.5}
              style={{ transformOrigin: `${x}px ${y}px`, animation: `staff-dissipate-right ${FADE_DURATION}ms ease-out forwards` }}
            />
          </>
        )}

        {pptNoteheads ? (
          <PptSvgNotehead
            shape={spec.shape}
            colorHex={spec.colorHex}
            neonColorHex={spec.neonColorHex}
            cx={x}
            cy={y}
            isBlackKey={isBlackPianoKey(n.midi)}
            radius={noteRadius}
          />
        ) : (
          <>
            <ellipse
              cx={x} cy={y} rx={isMultiStepPhrase ? 6.2 : 7.6} ry={isMultiStepPhrase ? 4.4 : 5.3}
              fill={n.color}
              transform={`rotate(-15 ${x} ${y})`}
            />
            <text
              x={x} y={y + 2}
              fontSize={isMultiStepPhrase ? "4.2" : label.length > 2 ? "4" : label.length > 1 ? "4.6" : "5.8"}
              fill={textFill}
              textAnchor="middle"
              fontFamily="JetBrains Mono"
              fontWeight="bold"
              style={{ pointerEvents: "none" }}
            >
              {label}
            </text>
          </>
        )}
      </g>
    );
  }

  const accidentalPillLabel =
    accidentalPreference === "auto"
      ? `Auto (${useFlats ? "♭" : "♯"})`
      : accidentalPreference === "flats"
        ? "♭ Flats"
        : "♯ Sharps";

  return (
    <div className="glass-panel p-3 h-full flex flex-col" style={{ minHeight: "200px" }}>
      <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h3 className="engineering-label">Grand Staff</h3>
          {pptNoteheads && (
            <PptTriangleKeySignature tonicPc={tonicChroma} intervals={scaleIntervals} />
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStaffLayoutMode(isJoined ? "split" : "joined")}
            className={`px-2 py-0.5 text-[10px] font-mono rounded border transition-colors ${
              isJoined
                ? "border-primary/50 bg-primary/15 text-primary font-semibold"
                : "border-border bg-secondary/60 text-muted-foreground hover:text-foreground"
            }`}
            title={
              isJoined
                ? "Joined Grand Staff (continuous Middle C bridge) — click for Traditional Split Staff"
                : "Split Grand Staff (hand-playability clef assignment) — click for Joined Grand Staff"
            }
            aria-label="Toggle Joined vs Split Grand Staff"
          >
            {isJoined ? "Joined" : "Split"}
          </button>
          <button
            type="button"
            onClick={() => setPptNoteheads(!pptNoteheads)}
            className={`px-2 py-0.5 text-[10px] font-mono rounded border transition-colors ${
              pptNoteheads
                ? "border-primary/50 bg-primary/15 text-primary font-semibold"
                : "border-border bg-secondary/60 text-muted-foreground hover:text-foreground"
            }`}
            title={
              pptNoteheads
                ? "PPT Mode (Geometric noteheads & Piano Triangle key signature) — click for Traditional"
                : "Traditional Mode (Oval noteheads & sharp/flat key signature) — click for PPT"
            }
            aria-label="Toggle PPT vs Traditional Staff Notation"
          >
            {pptNoteheads ? "PPT" : "Traditional"}
          </button>
          <button
            type="button"
            onClick={() => setAccidentalPreference(NEXT_ACCIDENTAL[accidentalPreference])}
            className="px-2 py-0.5 text-[10px] font-mono rounded border border-border bg-secondary/60 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            title="Cycle enharmonic spelling: Auto (Key) → Sharps → Flats"
          >
            {accidentalPillLabel}
          </button>
        </div>
      </div>

      <div className="relative flex-1 min-h-0">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="w-full h-full cursor-pointer relative"
          style={{ zIndex: 1 }}
          preserveAspectRatio="xMidYMid meet"
          onClick={handleSvgClick}
        >
          <defs>
            <clipPath id="nn-bass-clef-clip">
              <path d={SMUFL_GLYPH_PATHS.fClef} transform={bassTransform} />
            </clipPath>
          </defs>

          {/* Staff panel backing */}
          <rect
            x={STAFF_X_START}
            y={trebleTopY - 4}
            width={STAFF_X_END - STAFF_X_START}
            height={4 * LINE_SP + 8}
            rx="2"
            fill="rgba(15, 23, 42, 0.38)"
          />
          <rect
            x={STAFF_X_START}
            y={bottomStaffTopY - 4}
            width={STAFF_X_END - STAFF_X_START}
            height={4 * LINE_SP + 8}
            rx="2"
            fill="rgba(15, 23, 42, 0.38)"
          />

          {/* Phrase step focus columns */}
          {stepColumns.map(col => {
            const active = col.stepIdx === activeStepIndex;
            return (
              <g
                key={`step-col-${col.stepIdx}`}
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveStepIndex(col.stepIdx, true);
                }}
              >
                <rect
                  x={col.x + 1}
                  y={trebleTopY - 8}
                  width={Math.max(4, col.w - 2)}
                  height={bassBottomY - trebleTopY + 16}
                  rx={3}
                  fill={active ? "rgba(52, 211, 153, 0.08)" : "transparent"}
                  stroke={active ? "rgba(52, 211, 153, 0.35)" : "transparent"}
                  strokeWidth={0.8}
                />
                <text
                  x={col.centerX}
                  y={trebleTopY - 11}
                  textAnchor="middle"
                  fontSize="6.5"
                  fontFamily="JetBrains Mono"
                  fontWeight={active ? "bold" : "normal"}
                  fill={active ? "#34d399" : "rgba(148, 163, 184, 0.5)"}
                >
                  {col.stepIdx + 1}
                </text>
              </g>
            );
          })}

          {/* Treble 5 lines */}
          {trebleLines.map((ly, i) => (
            <line
              key={`t-${i}`}
              x1={STAFF_X_START}
              y1={ly}
              x2={STAFF_X_END}
              y2={ly}
              stroke="rgba(226, 232, 240, 0.72)"
              strokeWidth="1.05"
            />
          ))}

          {/* Bass 5 lines */}
          {bassLines.map((ly, i) => (
            <line
              key={`b-${i}`}
              x1={STAFF_X_START}
              y1={ly}
              x2={STAFF_X_END}
              y2={ly}
              stroke="rgba(226, 232, 240, 0.72)"
              strokeWidth="1.05"
            />
          ))}

          {/* Left Grand Staff accolade bar */}
          <line
            x1={STAFF_X_START}
            y1={trebleTopY}
            x2={STAFF_X_START}
            y2={bassBottomY}
            stroke="rgba(248, 250, 252, 0.9)"
            strokeWidth="2.4"
            strokeLinecap="round"
          />

          {/* SMuFL Clefs */}
          {isJoined ? (
            <g>
              <path
                d={SMUFL_GLYPH_PATHS.fClef}
                transform={bassTransform}
                fill="#090d16"
                stroke="#f8fafc"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={SMUFL_GLYPH_PATHS.gClef}
                transform={trebleTransform}
                fill="#f8fafc"
                stroke="#090d16"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
              <g clipPath="url(#nn-bass-clef-clip)">
                <path
                  d={SMUFL_GLYPH_PATHS.gClef}
                  transform={trebleTransform}
                  fill="#94a3b8"
                />
              </g>
            </g>
          ) : (
            <g>
              <path
                d={SMUFL_GLYPH_PATHS.gClef}
                transform={trebleTransform}
                fill="#f8fafc"
                stroke="#090d16"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={SMUFL_GLYPH_PATHS.fClef}
                transform={bassTransform}
                fill="#090d16"
                stroke="#f8fafc"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          )}

          {/* Traditional Sharp/Flat Key Signature (only in Traditional mode; PPT uses Piano Triangles) */}
          {!pptNoteheads && keySigCount > 0 && (() => {
            const treblePos = keySigIsSharps ? TREBLE_SHARP_POSITIONS : TREBLE_FLAT_POSITIONS;
            const bassPos = keySigIsSharps ? BASS_SHARP_POSITIONS : BASS_FLAT_POSITIONS;
            return Array.from({ length: Math.min(keySigCount, 7) }).map((_, i) => {
              const px = KEY_SIG_START_X + i * KEY_SIG_SPACING;
              const trebleY = trebleC4Y - treblePos[i] * HALF_STEP;
              const bassY = bassC4Y - bassPos[i] * HALF_STEP;
              return (
                <g key={`ks-${i}`}>
                  <path
                    d={keySigGlyph}
                    transform={`translate(${px - keySigCenterOffsetX}, ${trebleY + keySigCenterOffsetY}) scale(${accScale}, ${-accScale})`}
                    fill="#f8fafc"
                    stroke="#090d16"
                    strokeWidth="0.95"
                    vectorEffect="non-scaling-stroke"
                  />
                  <path
                    d={keySigGlyph}
                    transform={`translate(${px - keySigCenterOffsetX}, ${bassY + keySigCenterOffsetY}) scale(${accScale}, ${-accScale})`}
                    fill="#090d16"
                    stroke="#f8fafc"
                    strokeWidth="1.05"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              );
            });
          })()}

          {/* Middle C idle reference marker */}
          {positionedNotes.length === 0 && isJoined && (
            <line
              x1={CHORD_X - 11}
              y1={CENTER_Y}
              x2={CHORD_X + 11}
              y2={CENTER_Y}
              stroke="rgba(226, 232, 240, 0.3)"
              strokeWidth="0.9"
              strokeDasharray="2,2"
            />
          )}

          {/* Unified deduplicated chord ledger lines */}
          {unifiedLedgerLines.map((l, idx) => (
            <line
              key={`ul-${idx}`}
              x1={l.x1}
              y1={l.y}
              x2={l.x2}
              y2={l.y}
              stroke="rgba(226, 232, 240, 0.78)"
              strokeWidth="1.05"
            />
          ))}

          {/* Stylised SMuFL inline accidentals in Traditional mode */}
          {inlineAccidentals.map(item => {
            const glyph =
              item.acc === 1
                ? SMUFL_GLYPH_PATHS.accidentalSharp
                : item.acc === -1
                  ? SMUFL_GLYPH_PATHS.accidentalFlat
                  : SMUFL_GLYPH_PATHS.accidentalNatural;
            const offsetX = (item.acc === 1 ? 180 : item.acc === -1 ? 162 : 121) * accScale;
            const offsetY = (item.acc === -1 ? 25 : 0) * accScale;
            const isTreble = item.clef === "treble";
            return (
              <path
                key={item.key}
                d={glyph}
                transform={`translate(${item.x - offsetX}, ${item.y + offsetY}) scale(${accScale}, ${-accScale})`}
                fill={isTreble ? "#f8fafc" : "#090d16"}
                stroke={isTreble ? "#090d16" : "#f8fafc"}
                strokeWidth={isTreble ? "0.95" : "1.05"}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          {positionedNotes.map(renderNote)}
        </svg>
      </div>
    </div>
  );
}
