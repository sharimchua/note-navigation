import { useState } from "react";
import { useHarmonic } from "@/contexts/HarmonicContext";
import { getNoteColor, getNoteChroma } from "@/lib/music-engine";
import { Note, Key } from "tonal";

// Grand staff with unified coordinate system
// Diatonic position: C4 = 0, D4 = 1, E4 = 2, F4 = 3, G4 = 4, A4 = 5, B4 = 6, C5 = 7...
// Negative: B3 = -1, A3 = -2, G3 = -3, ... G2 = -12

const STEP = 6; // pixels per diatonic step

// Treble staff: lines are E4(2), G4(4), B4(6), D5(8), F5(10)
// Bass staff: lines are A3(-2), F3(-4), D3(-6), B2(-8), G2(-10)
// Middle C = diatonic 0, sits on its own ledger line between the staves

// Reference: Middle C (diatonic 0) at y = 96
// Each diatonic step up = -STEP in y
const MIDDLE_C_Y = 96;

// Treble lines: E4=2 → y=96-2*6=84, G4=4→72, B4=6→60, D5=8→48, F5=10→36
const TREBLE_LINES = [84, 72, 60, 48, 36]; // E4, G4, B4, D5, F5 (bottom to top)
const TREBLE_BOTTOM = 84;
const TREBLE_TOP = 36;

// Bass lines: A3=-2 → y=96+2*6=108, F3=-4→120, D3=-6→132, B2=-8→144, G2=-10→156
const BASS_LINES = [108, 120, 132, 144, 156]; // A3, F3, D3, B2, G2 (top to bottom)
const BASS_TOP = 108;
const BASS_BOTTOM = 156;

const DIATONIC_MAP_SHARP = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]; // C,C#,D,D#,E,F,F#,G,G#,A,A#,B
const DIATONIC_MAP_FLAT =  [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6]; // C,Db,D,Eb,E,F,Gb,G,Ab,A,Bb,B
const SHARP_PC_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_PC_NAMES =  ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

function midiToY(midi: number, useFlats: boolean): number {
  const octave = Math.floor(midi / 12);
  const pc = midi % 12;
  const map = useFlats ? DIATONIC_MAP_FLAT : DIATONIC_MAP_SHARP;
  const diatonicPos = map[pc] + (octave - 5) * 7;
  return MIDDLE_C_Y - diatonicPos * STEP;
}

function needsAccidental(midi: number): boolean {
  const pc = midi % 12;
  return [1, 3, 6, 8, 10].includes(pc); // C#, D#, F#, G#, A#
}

// Key signature positions on staff
// Sharps order: F C G D A E B — treble y positions for each
// Flats order: B E A D G C F — treble y positions for each
const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"];
const FLAT_ORDER = ["B", "E", "A", "D", "G", "C", "F"];

// Diatonic position within an octave: C=0,D=1,E=2,F=3,G=4,A=5,B=6
const DIATONIC_POS: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

// Treble key sig positions (octave context): F5=10, C5=7, G5=11, D5=8, A4=5, E5=9, B4=6
const TREBLE_SHARP_POSITIONS = [10, 7, 11, 8, 5, 9, 6]; // diatonic pos from C4=0
const TREBLE_FLAT_POSITIONS = [6, 9, 5, 8, 4, 7, 3]; // B4, E5, A4, D5, G4, C5, F4

// Bass key sig: same pattern but shifted down 2 diatonic steps (one octave lower effective)
const BASS_SHARP_POSITIONS = TREBLE_SHARP_POSITIONS.map(p => p - 14);
const BASS_FLAT_POSITIONS = TREBLE_FLAT_POSITIONS.map(p => p - 14);

function getKeySignature(selectedKey: string, selectedScale: string) {
  // Get key signature info using tonal
  const keyName = selectedScale === "minor" 
    ? `${selectedKey} minor` 
    : `${selectedKey} major`;
  
  const keyInfo = selectedScale === "minor" 
    ? Key.minorKey(selectedKey) 
    : Key.majorKey(selectedKey);
  
  if (!keyInfo) return { sharps: 0, flats: 0, type: "sharp" as const };
  
  const alteration = "alteration" in keyInfo ? (keyInfo as any).alteration : 0;
  
  if (alteration > 0) {
    return { sharps: alteration, flats: 0, type: "sharp" as const };
  } else if (alteration < 0) {
    return { sharps: 0, flats: Math.abs(alteration), type: "flat" as const };
  }
  return { sharps: 0, flats: 0, type: "sharp" as const };
}

// Chord x position - all notes stacked vertically at same x
const KEY_SIG_START_X = 60;
const KEY_SIG_SPACING = 5;
const CHORD_X = 120;
// Offset for seconds (adjacent notes) to avoid overlap
const SECOND_OFFSET = 16;

export function StaffNotation() {
  const { activeNotes, selectedKey, selectedScale } = useHarmonic();

  const activeArray = [...activeNotes].map(n => {
    const midi = Note.midi(n) || 60;
    const pc = midi % 12;
    return {
      note: n,
      midi,
      pc: SHARP_PC_NAMES[pc], // Always use sharp-based names to match staff positioning
      color: getNoteColor(n),
      isSharp: needsAccidental(midi),
    };
  });

  // Sort by MIDI for consistent display
  activeArray.sort((a, b) => a.midi - b.midi);

  // Separate into treble (C4+) and bass (below C4)
  const trebleNotes = activeArray.filter(n => n.midi >= 60);
  const bassNotes = activeArray.filter(n => n.midi < 60);

  // Detect seconds (adjacent diatonic positions) and offset them
  function getChordPositions(notes: typeof activeArray) {
    const positioned = notes.map(n => ({
      ...n,
      y: midiToY(n.midi),
      x: CHORD_X,
      offsetRight: false,
    }));

    // Check for seconds - notes that are only 1 diatonic step apart
    for (let i = 1; i < positioned.length; i++) {
      const prevY = positioned[i - 1].y;
      const currY = positioned[i].y;
      // If within one STEP, offset to the right
      if (Math.abs(prevY - currY) <= STEP) {
        if (!positioned[i - 1].offsetRight) {
          positioned[i].offsetRight = true;
          positioned[i].x = CHORD_X + SECOND_OFFSET;
        }
      }
    }
    return positioned;
  }

  // Generate ledger lines for a note
  function getLedgerLines(y: number, x: number, clef: "treble" | "bass") {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];

    if (clef === "treble") {
      if (y > TREBLE_BOTTOM) {
        for (let ly = TREBLE_BOTTOM + 12; ly <= y; ly += 12) {
          lines.push({ x1: x - 12, y1: ly, x2: x + 12, y2: ly });
        }
      }
      if (y < TREBLE_TOP) {
        for (let ly = TREBLE_TOP - 12; ly >= y; ly -= 12) {
          lines.push({ x1: x - 12, y1: ly, x2: x + 12, y2: ly });
        }
      }
    } else {
      if (y < BASS_TOP) {
        for (let ly = BASS_TOP - 12; ly >= y; ly -= 12) {
          lines.push({ x1: x - 12, y1: ly, x2: x + 12, y2: ly });
        }
      }
      if (y > BASS_BOTTOM) {
        for (let ly = BASS_BOTTOM + 12; ly <= y; ly += 12) {
          lines.push({ x1: x - 12, y1: ly, x2: x + 12, y2: ly });
        }
      }
    }
    return lines;
  }

  const trebleClefY = 72; // G4 line
  const bassClefY = 120; // F3 line

  const treblePositioned = getChordPositions(trebleNotes);
  const bassPositioned = getChordPositions(bassNotes);
  const keySig = getKeySignature(selectedKey, selectedScale);

  // Render a note head with the note name inside
  function renderNote(n: typeof activeArray[0] & { y: number; x: number; offsetRight: boolean }, clef: "treble" | "bass") {
    const { x, y } = n;
    const ledgers = getLedgerLines(y, x, clef);

    return (
      <g key={n.note}>
        {ledgers.map((l, li) => (
          <line key={`ledger-${li}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
            stroke="hsl(var(--border))" strokeWidth="0.8" />
        ))}
        <ellipse cx={x} cy={y} rx="8" ry="5.5" fill={n.color}
          transform={`rotate(-15 ${x} ${y})`} />
        <text x={x} y={y + 3} fontSize="6" fill="hsl(var(--background))"
          textAnchor="middle" fontFamily="JetBrains Mono" fontWeight="bold">
          {n.pc}
        </text>
      </g>
    );
  }

  return (
    <div className="glass-panel p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="engineering-label">Grand Staff</h3>
      </div>
      <svg viewBox="0 0 200 200" className="w-full flex-1" preserveAspectRatio="xMidYMid meet">
        {/* Staff background */}
        <rect x="28" y={TREBLE_TOP - 4} width="164" height={TREBLE_BOTTOM - TREBLE_TOP + 8} rx="2"
          fill="hsl(var(--card))" opacity="0.6" />
        <rect x="28" y={BASS_TOP - 4} width="164" height={BASS_BOTTOM - BASS_TOP + 8} rx="2"
          fill="hsl(var(--card))" opacity="0.6" />

        {/* Treble staff lines */}
        {TREBLE_LINES.map((ly, i) => (
          <line key={`t-${i}`} x1="30" y1={ly} x2="190" y2={ly}
            stroke="hsl(var(--border))" strokeWidth="0.8" />
        ))}

        {/* Bass staff lines */}
        {BASS_LINES.map((ly, i) => (
          <line key={`b-${i}`} x1="30" y1={ly} x2="190" y2={ly}
            stroke="hsl(var(--border))" strokeWidth="0.8" />
        ))}

        {/* Treble Clef - rendered on top of staff lines */}
        <text
          x="22"
          y={trebleClefY + 6}
          fontSize="54"
          fill="hsl(var(--foreground))"
          opacity="0.6"
          fontFamily="'Noto Music', 'Bravura', serif"
        >
          𝄞
        </text>

        {/* Bass Clef - rendered on top of staff lines */}
        <text
          x="22"
          y={bassClefY + 20}
          fontSize="48"
          fill="hsl(var(--foreground))"
          opacity="0.6"
          fontFamily="'Noto Music', 'Bravura', serif"
        >
          𝄢
        </text>

        {/* Key Signature */}
        {keySig.type === "sharp" && keySig.sharps > 0 && (
          <>
            {Array.from({ length: keySig.sharps }).map((_, i) => {
              const trebleY = MIDDLE_C_Y - TREBLE_SHARP_POSITIONS[i] * STEP;
              const bassY = MIDDLE_C_Y - BASS_SHARP_POSITIONS[i] * STEP;
              const x = KEY_SIG_START_X + i * KEY_SIG_SPACING;
              return (
                <g key={`ks-${i}`}>
                  <text x={x} y={trebleY + 3} fontSize="9" fill="hsl(var(--foreground))" opacity="0.8"
                    fontFamily="serif" fontWeight="bold">♯</text>
                  <text x={x} y={bassY + 3} fontSize="9" fill="hsl(var(--foreground))" opacity="0.8"
                    fontFamily="serif" fontWeight="bold">♯</text>
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
                  <text x={x} y={trebleY + 3} fontSize="10" fill="hsl(var(--foreground))" opacity="0.8"
                    fontFamily="serif">♭</text>
                  <text x={x} y={bassY + 3} fontSize="10" fill="hsl(var(--foreground))" opacity="0.8"
                    fontFamily="serif">♭</text>
                </g>
              );
            })}
          </>
        )}
        {activeArray.length === 0 && (
          <line x1="108" y1={MIDDLE_C_Y} x2="132" y2={MIDDLE_C_Y}
            stroke="hsl(var(--border))" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.3" />
        )}

        {/* Treble notes - chord form (stacked at same x) */}
        {treblePositioned.map(n => renderNote(n, "treble"))}

        {/* Bass notes - chord form (stacked at same x) */}
        {bassPositioned.map(n => renderNote(n, "bass"))}

      </svg>
    </div>
  );
}
