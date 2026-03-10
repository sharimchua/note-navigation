import { useCallback, useRef, useMemo } from "react";
import { useHarmonic } from "@/contexts/HarmonicContext";
import { getNoteColor, getNoteChroma, getScaleLabel } from "@/lib/music-engine";
import { Note, Key } from "tonal";

const STEP = 6;
const MIDDLE_C_Y = 96;
const TREBLE_LINES = [84, 72, 60, 48, 36];
const TREBLE_BOTTOM = 84;
const TREBLE_TOP = 36;
const BASS_LINES = [108, 120, 132, 144, 156];
const BASS_TOP = 108;
const BASS_BOTTOM = 156;

const DIATONIC_MAP_SHARP = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
const DIATONIC_MAP_FLAT =  [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6];
const SHARP_PC_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_PC_NAMES =  ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

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

function midiToY(midi: number, useFlats: boolean): number {
  const octave = Math.floor(midi / 12);
  const pc = midi % 12;
  const map = useFlats ? DIATONIC_MAP_FLAT : DIATONIC_MAP_SHARP;
  const diatonicPos = map[pc] + (octave - 5) * 7;
  return MIDDLE_C_Y - diatonicPos * STEP;
}

function needsAccidental(midi: number): boolean {
  const pc = midi % 12;
  return [1, 3, 6, 8, 10].includes(pc);
}

const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"];
const FLAT_ORDER = ["B", "E", "A", "D", "G", "C", "F"];
const DIATONIC_POS: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
const TREBLE_SHARP_POSITIONS = [10, 7, 11, 8, 5, 9, 6];
const TREBLE_FLAT_POSITIONS = [6, 9, 5, 8, 4, 7, 3];
const BASS_SHARP_POSITIONS = TREBLE_SHARP_POSITIONS.map(p => p - 14);
const BASS_FLAT_POSITIONS = TREBLE_FLAT_POSITIONS.map(p => p - 14);

const KEY_SIG_START_X = 60;
const KEY_SIG_SPACING = 5;
const CHORD_X = 120;
const SECOND_OFFSET = 16;

// Map scale types to semitone offset from parent major key
const SCALE_TO_PARENT_OFFSET: Record<string, number> = {
  "major": 0, "ionian": 0,
  "dorian": 2,
  "phrygian": 4,
  "lydian": 5,
  "mixolydian": 7,
  "minor": 9, "aeolian": 9,
  "locrian": 11,
  "harmonic minor": 9,  // same key sig as natural minor
  "melodic minor": 9,
  "major pentatonic": 0,
  "minor pentatonic": 9,
  "blues": 9,
};

const CHROMA_TO_MAJOR_KEY_SHARP = ["C", "G", "D", "A", "E", "B", "F#", "C#"];
const CHROMA_TO_MAJOR_KEY_FLAT = ["C", "F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb"];

function getKeySignature(selectedKey: string, selectedScale: string) {
  const offset = SCALE_TO_PARENT_OFFSET[selectedScale] ?? 0;
  const rootChroma = Note.chroma(selectedKey) ?? 0;
  const parentChroma = (rootChroma - offset + 12) % 12;

  // Find the parent major key name and get its key signature
  // Try all 12 possible major key names to find one matching this chroma
  const possibleRoots = ["C", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "Ab", "A", "Bb", "B"];
  let parentRoot = possibleRoots.find(r => (Note.chroma(r) ?? -1) === parentChroma) || "C";

  const keyInfo = Key.majorKey(parentRoot);
  if (!keyInfo) return { sharps: 0, flats: 0, type: "sharp" as const };
  const alteration = (keyInfo as any).alteration ?? 0;
  if (alteration > 0) return { sharps: alteration, flats: 0, type: "sharp" as const };
  if (alteration < 0) return { sharps: 0, flats: Math.abs(alteration), type: "flat" as const };
  return { sharps: 0, flats: 0, type: "sharp" as const };
}

export function StaffNotation() {
  const { activeNotes, selectedKey, selectedScale, useFlats, toggleNote, playNote, isKeyLocked, scaleLabelMode, scaleNotes, trailMode, isNoteVisible, isNotePressed, isNoteFading, noteStates } = useHarmonic();
  const svgRef = useRef<SVGSVGElement>(null);
  
  const rootChroma = useMemo(() => scaleNotes.length > 0 ? getNoteChroma(scaleNotes[0]) : 0, [scaleNotes]);
  const baseMidi = useMemo(() => {
    if (activeNotes.size === 0) return undefined;
    let lowestActive = Infinity;
    activeNotes.forEach(n => { const m = Note.midi(n); if (m !== null && m < lowestActive) lowestActive = m; });
    if (!isFinite(lowestActive)) return undefined;
    let root = lowestActive;
    while (root % 12 !== rootChroma && root >= 0) root--;
    return root >= 0 ? root : undefined;
  }, [activeNotes, rootChroma]);

  const DIATONIC_TO_MIDI_SHARP = [0, 2, 4, 5, 7, 9, 11];
  
  const yToNote = useCallback((y: number): string => {
    const diatonicPos = Math.round((MIDDLE_C_Y - y) / STEP);
    const octaveOffset = Math.floor(diatonicPos / 7);
    let stepInOctave = diatonicPos % 7;
    if (stepInOctave < 0) stepInOctave += 7;
    const octave = 4 + octaveOffset + (stepInOctave < 0 ? -1 : 0);
    const pcNames = useFlats ? FLAT_PC_NAMES : SHARP_PC_NAMES;
    const midi = DIATONIC_TO_MIDI_SHARP[stepInOctave];
    const noteName = pcNames[midi];
    return `${noteName}${octave}`;
  }, [useFlats]);

  const handleSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    const note = yToNote(svgPt.y);
    if (note) { playNote(note); toggleNote(note); }
  }, [yToNote, playNote, toggleNote]);

  // Build note array from noteStates (includes fading notes)
  const allVisibleNotes = useMemo(() => {
    return noteStates.map(s => {
      const midi = Note.midi(s.note) || 60;
      return { ...s, midi };
    });
  }, [noteStates]);

  const allMidis = allVisibleNotes.map(n => n.midi);
  const spellingMap = smartSpellNotes(allMidis, useFlats);

  const activeArray = allVisibleNotes.map(n => {
    const spelling = spellingMap.get(n.midi) || { pc: (useFlats ? FLAT_PC_NAMES : SHARP_PC_NAMES)[n.midi % 12], useFlat: useFlats };
    return {
      note: n.note,
      midi: n.midi,
      pc: spelling.pc,
      color: getNoteColor(n.note),
      isSharp: needsAccidental(n.midi),
      useFlat: spelling.useFlat,
      pressed: n.pressed,
      fading: n.fading,
    };
  });

  activeArray.sort((a, b) => a.midi - b.midi);

  const trebleNotes = activeArray.filter(n => n.midi >= 60);
  const bassNotes = activeArray.filter(n => n.midi < 60);

  function getChordPositions(notes: typeof activeArray) {
    const positioned = notes.map(n => ({
      ...n,
      y: midiToY(n.midi, n.useFlat),
      x: CHORD_X,
      offsetRight: false,
    }));
    for (let i = 1; i < positioned.length; i++) {
      const prevY = positioned[i - 1].y;
      const currY = positioned[i].y;
      if (Math.abs(prevY - currY) <= STEP) {
        if (!positioned[i - 1].offsetRight) {
          positioned[i].offsetRight = true;
          positioned[i].x = CHORD_X + SECOND_OFFSET;
        }
      }
    }
    return positioned;
  }

  function getLedgerLines(y: number, x: number, clef: "treble" | "bass") {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    if (clef === "treble") {
      if (y > TREBLE_BOTTOM) { for (let ly = TREBLE_BOTTOM + 12; ly <= y; ly += 12) lines.push({ x1: x - 12, y1: ly, x2: x + 12, y2: ly }); }
      if (y < TREBLE_TOP) { for (let ly = TREBLE_TOP - 12; ly >= y; ly -= 12) lines.push({ x1: x - 12, y1: ly, x2: x + 12, y2: ly }); }
    } else {
      if (y < BASS_TOP) { for (let ly = BASS_TOP - 12; ly >= y; ly -= 12) lines.push({ x1: x - 12, y1: ly, x2: x + 12, y2: ly }); }
      if (y > BASS_BOTTOM) { for (let ly = BASS_BOTTOM + 12; ly <= y; ly += 12) lines.push({ x1: x - 12, y1: ly, x2: x + 12, y2: ly }); }
    }
    return lines;
  }

  const trebleClefY = 72;
  const bassClefY = 120;
  const treblePositioned = getChordPositions(trebleNotes);
  const bassPositioned = getChordPositions(bassNotes);
  const keySig = getKeySignature(selectedKey, selectedScale);

  function renderNote(n: typeof activeArray[0] & { y: number; x: number; offsetRight: boolean }, clef: "treble" | "bass") {
    const { x, y } = n;
    const ledgers = getLedgerLines(y, x, clef);
    const scaleLabel = isKeyLocked ? getScaleLabel(n.note, scaleNotes, scaleLabelMode, baseMidi) : null;
    const label = scaleLabel !== null ? scaleLabel : n.pc;
    const isFading = n.fading && trailMode;

    return (
      <g key={n.note} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); playNote(n.note); toggleNote(n.note); }}>
        {ledgers.map((l, li) => (
          <line key={`ledger-${li}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
            stroke="hsl(var(--border))" strokeWidth="0.8" 
            style={isFading ? { animation: `note-fade-out ${FADE_DURATION}ms ease-out forwards` } : undefined}
          />
        ))}
        
        {/* Horizontal dissipation effect for animated mode */}
        {isFading && (
          <>
            <ellipse cx={x} cy={y} rx="8" ry="5.5" fill={n.color} opacity={0.6}
              transform={`rotate(-15 ${x} ${y})`}
              style={{ animation: `staff-dissipate-left ${FADE_DURATION}ms ease-out forwards` }}
            />
            <ellipse cx={x} cy={y} rx="8" ry="5.5" fill={n.color} opacity={0.6}
              transform={`rotate(-15 ${x} ${y})`}
              style={{ animation: `staff-dissipate-right ${FADE_DURATION}ms ease-out forwards` }}
            />
          </>
        )}
        
        <ellipse cx={x} cy={y} rx="8" ry="5.5" fill={n.color}
          transform={`rotate(-15 ${x} ${y})`}
          style={isFading ? { animation: `note-fade-out ${FADE_DURATION}ms ease-out forwards` } : undefined}
        />
        <text x={x} y={y + 2.5} fontSize={label.length > 1 ? "4.5" : "6"} fill="hsl(var(--background))"
          textAnchor="middle" fontFamily="JetBrains Mono" fontWeight="bold" style={{ 
            pointerEvents: "none",
            ...(isFading ? { animation: `note-fade-out ${FADE_DURATION}ms ease-out forwards` } : {})
          }}>
          {label}
        </text>
      </g>
    );
  }

  return (
    <div className="glass-panel p-4 h-full flex flex-col" style={{ minHeight: "460px" }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="engineering-label">Grand Staff</h3>
        <span className="px-2 py-0.5 text-[10px] font-mono rounded border border-border bg-secondary/50 text-muted-foreground">
          {useFlats ? "♭ Flats" : "♯ Sharps"}
        </span>
      </div>
      <div className="relative flex-1 min-h-0">
        <svg ref={svgRef} viewBox="0 0 200 200" className="w-full h-full cursor-pointer relative" style={{ zIndex: 1 }} preserveAspectRatio="xMidYMid meet" onClick={handleSvgClick}>
        <rect x="28" y={TREBLE_TOP - 4} width="164" height={TREBLE_BOTTOM - TREBLE_TOP + 8} rx="2"
          fill="hsl(var(--card))" opacity="0.6" />
        <rect x="28" y={BASS_TOP - 4} width="164" height={BASS_BOTTOM - BASS_TOP + 8} rx="2"
          fill="hsl(var(--card))" opacity="0.6" />

        {TREBLE_LINES.map((ly, i) => (
          <line key={`t-${i}`} x1="30" y1={ly} x2="190" y2={ly}
            stroke="hsl(var(--border))" strokeWidth="0.8" />
        ))}

        {BASS_LINES.map((ly, i) => (
          <line key={`b-${i}`} x1="30" y1={ly} x2="190" y2={ly}
            stroke="hsl(var(--border))" strokeWidth="0.8" />
        ))}

        <text x="22" y={trebleClefY + 6} fontSize="54" fill="hsl(var(--foreground))" opacity="0.6"
          fontFamily="'Noto Music', 'Bravura', serif">𝄞</text>
        <text x="22" y={bassClefY + 20} fontSize="48" fill="hsl(var(--foreground))" opacity="0.6"
          fontFamily="'Noto Music', 'Bravura', serif">𝄢</text>

        {keySig.type === "sharp" && keySig.sharps > 0 && (
          <>
            {Array.from({ length: keySig.sharps }).map((_, i) => {
              const trebleY = MIDDLE_C_Y - TREBLE_SHARP_POSITIONS[i] * STEP;
              const bassY = MIDDLE_C_Y - BASS_SHARP_POSITIONS[i] * STEP;
              const x = KEY_SIG_START_X + i * KEY_SIG_SPACING;
              return (
                <g key={`ks-${i}`}>
                  <text x={x} y={trebleY + 3} fontSize="9" fill="hsl(var(--foreground))" opacity="0.8" fontFamily="serif" fontWeight="bold">♯</text>
                  <text x={x} y={bassY + 3} fontSize="9" fill="hsl(var(--foreground))" opacity="0.8" fontFamily="serif" fontWeight="bold">♯</text>
                </g>
              );
            })}
          </>
        )}
        {keySig.type === "flat" && keySig.flats > 0 && (
          <>
            {Array.from({ length: keySig.flats }).map((_, i) => {
              const trebleY = MIDDLE_C_Y - TREBLE_FLAT_POSITIONS[i] * STEP;
              const bassY = MIDDLE_C_Y - BASS_FLAT_POSITIONS[i] * STEP;
              const x = KEY_SIG_START_X + i * KEY_SIG_SPACING;
              return (
                <g key={`kf-${i}`}>
                  <text x={x} y={trebleY + 3} fontSize="10" fill="hsl(var(--foreground))" opacity="0.8" fontFamily="serif">♭</text>
                  <text x={x} y={bassY + 3} fontSize="10" fill="hsl(var(--foreground))" opacity="0.8" fontFamily="serif">♭</text>
                </g>
              );
            })}
          </>
        )}
        {activeArray.length === 0 && (
          <line x1="108" y1={MIDDLE_C_Y} x2="132" y2={MIDDLE_C_Y}
            stroke="hsl(var(--border))" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.3" />
        )}

        {treblePositioned.map(n => renderNote(n, "treble"))}
        {bassPositioned.map(n => renderNote(n, "bass"))}

      </svg>
      </div>
    </div>
  );
}
