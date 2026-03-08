import { useHarmonic } from "@/contexts/HarmonicContext";
import { getNoteColor, getNoteChroma } from "@/lib/music-engine";
import { Note } from "tonal";

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

const DIATONIC_MAP = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]; // C,C#,D,D#,E,F,F#,G,G#,A,A#,B

function midiToY(midi: number): number {
  const octave = Math.floor(midi / 12);
  const pc = midi % 12;
  const diatonicPos = DIATONIC_MAP[pc] + (octave - 5) * 7; // C4 (midi 60, octave 5) = 0
  return MIDDLE_C_Y - diatonicPos * STEP;
}

function needsAccidental(midi: number): boolean {
  const pc = midi % 12;
  return [1, 3, 6, 8, 10].includes(pc); // C#, D#, F#, G#, A#
}

export function StaffNotation() {
  const { activeNotes, audiationMode } = useHarmonic();

  const activeArray = [...activeNotes].map(n => ({
    note: n,
    midi: Note.midi(n) || 60,
    pc: Note.pitchClass(n),
    color: getNoteColor(n),
    isSharp: needsAccidental(Note.midi(n) || 60),
  }));

  // Sort by MIDI for consistent display
  activeArray.sort((a, b) => a.midi - b.midi);

  // Separate into treble (C4+) and bass (below C4)
  const trebleNotes = activeArray.filter(n => n.midi >= 60);
  const bassNotes = activeArray.filter(n => n.midi < 60);

  // Generate ledger lines for a note
  function getLedgerLines(y: number, x: number, clef: "treble" | "bass") {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];

    if (clef === "treble") {
      // Ledger lines below treble staff (including middle C)
      if (y > TREBLE_BOTTOM) {
        for (let ly = TREBLE_BOTTOM + 12; ly <= y; ly += 12) {
          lines.push({ x1: x - 12, y1: ly, x2: x + 12, y2: ly });
        }
      }
      // Ledger lines above treble staff
      if (y < TREBLE_TOP) {
        for (let ly = TREBLE_TOP - 12; ly >= y; ly -= 12) {
          lines.push({ x1: x - 12, y1: ly, x2: x + 12, y2: ly });
        }
      }
    } else {
      // Ledger lines above bass staff (including middle C area)
      if (y < BASS_TOP) {
        for (let ly = BASS_TOP - 12; ly >= y; ly -= 12) {
          lines.push({ x1: x - 12, y1: ly, x2: x + 12, y2: ly });
        }
      }
      // Ledger lines below bass staff
      if (y > BASS_BOTTOM) {
        for (let ly = BASS_BOTTOM + 12; ly <= y; ly += 12) {
          lines.push({ x1: x - 12, y1: ly, x2: x + 12, y2: ly });
        }
      }
    }
    return lines;
  }

  // Treble clef: the curl centers on G4 line (2nd from bottom = y=72)
  // Bass clef: the two dots surround F3 line (2nd from top = y=120)
  const trebleClefY = 72; // G4 line
  const bassClefY = 120; // F3 line

  return (
    <div className="glass-panel p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="engineering-label">Grand Staff</h3>
        {audiationMode && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/20 text-primary">
            AUDIATION
          </span>
        )}
      </div>
      <svg viewBox="0 0 400 200" className="w-full flex-1" preserveAspectRatio="xMidYMid meet">
        {/* Grand staff brace - left bracket */}
        <path
          d={`M 32 ${TREBLE_TOP} Q 22 ${MIDDLE_C_Y} 32 ${BASS_BOTTOM}`}
          fill="none"
          stroke="hsl(var(--foreground))"
          strokeWidth="1.5"
          opacity="0.4"
        />

        {/* Treble Clef - G clef centered on G4 line (y=72) */}
        <text
          x="36"
          y={trebleClefY + 24}
          fontSize="52"
          fill="hsl(var(--foreground))"
          opacity="0.6"
          fontFamily="serif"
        >
          𝄞
        </text>

        {/* Treble staff lines */}
        {TREBLE_LINES.map((ly, i) => (
          <line key={`t-${i}`} x1="55" y1={ly} x2="390" y2={ly}
            stroke="hsl(var(--border))" strokeWidth="0.8" />
        ))}

        {/* Bass Clef - dots surround F3 line (2nd from top, y=120) */}
        <text
          x="36"
          y={bassClefY + 8}
          fontSize="32"
          fill="hsl(var(--foreground))"
          opacity="0.6"
          fontFamily="serif"
        >
          𝄢
        </text>

        {/* Bass staff lines */}
        {BASS_LINES.map((ly, i) => (
          <line key={`b-${i}`} x1="55" y1={ly} x2="390" y2={ly}
            stroke="hsl(var(--border))" strokeWidth="0.8" />
        ))}

        {/* Middle C ledger line indicator (subtle dashed) */}
        {activeArray.length === 0 && (
          <line x1="100" y1={MIDDLE_C_Y} x2="130" y2={MIDDLE_C_Y}
            stroke="hsl(var(--border))" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.3" />
        )}

        {/* Treble notes */}
        {!audiationMode && trebleNotes.map((n, i) => {
          const y = midiToY(n.midi);
          const x = 120 + i * 35;
          const ledgers = getLedgerLines(y, x, "treble");

          return (
            <g key={n.note}>
              {ledgers.map((l, li) => (
                <line key={`ledger-${li}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                  stroke="hsl(var(--border))" strokeWidth="0.8" />
              ))}
              <ellipse cx={x} cy={y} rx="7" ry="5" fill={n.color}
                transform={`rotate(-15 ${x} ${y})`} />
              {n.isSharp && (
                <text x={x - 14} y={y + 4} fontSize="10" fill={n.color} fontWeight="bold">#</text>
              )}
              <text x={x} y={y + 18} fontSize="8" fill="hsl(var(--muted-foreground))"
                textAnchor="middle" fontFamily="JetBrains Mono">
                {n.pc}
              </text>
            </g>
          );
        })}

        {/* Bass notes */}
        {!audiationMode && bassNotes.map((n, i) => {
          const y = midiToY(n.midi);
          const x = 120 + i * 35;
          const ledgers = getLedgerLines(y, x, "bass");

          return (
            <g key={n.note}>
              {ledgers.map((l, li) => (
                <line key={`ledger-${li}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                  stroke="hsl(var(--border))" strokeWidth="0.8" />
              ))}
              <ellipse cx={x} cy={y} rx="7" ry="5" fill={n.color}
                transform={`rotate(-15 ${x} ${y})`} />
              {n.isSharp && (
                <text x={x - 14} y={y + 4} fontSize="10" fill={n.color} fontWeight="bold">#</text>
              )}
              <text x={x} y={y + 18} fontSize="8" fill="hsl(var(--muted-foreground))"
                textAnchor="middle" fontFamily="JetBrains Mono">
                {n.pc}
              </text>
            </g>
          );
        })}

        {/* Empty state */}
        {activeArray.length === 0 && (
          <text x="222" y={MIDDLE_C_Y + 4} fontSize="11" fill="hsl(var(--muted-foreground))"
            textAnchor="middle" fontFamily="JetBrains Mono" opacity="0.5">
            Select notes on any instrument
          </text>
        )}
      </svg>
    </div>
  );
}
