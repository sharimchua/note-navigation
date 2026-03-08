import { useHarmonic } from "@/contexts/HarmonicContext";
import { getNoteColor, getNoteChroma } from "@/lib/music-engine";
import { Note } from "tonal";

// Simple staff rendering - treble and bass clef
// Maps MIDI notes to staff positions
function midiToStaffY(midi: number, clef: "treble" | "bass"): number {
  // Convert MIDI to diatonic position (C4=0 as reference)
  const diatonicMap = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]; // C,C#,D,D#,E,F,F#,G,G#,A,A#,B
  const octave = Math.floor(midi / 12);
  const pc = midi % 12;
  // Absolute diatonic position where C4 (midi 60, octave 5) = 0
  const diatonicPos = diatonicMap[pc] + (octave - 5) * 7;

  const step = 6; // pixels per half-step on staff (one line/space)

  if (clef === "treble") {
    // Treble staff lines (bottom to top): E4, G4, B4, D5, F5
    // E4 = diatonic +2, bottom line at y=88
    // Each diatonic step up = -step in y
    // E4 (pos 2) is at y=88, so y = 88 - (pos - 2) * step
    return 88 - (diatonicPos - 2) * step;
  } else {
    // Bass staff lines (bottom to top): G2, B2, D3, F3, A3
    // G2 = diatonic -12, bottom line at y=188
    // A3 = diatonic -2, top line at y=140
    // G2 (pos -12) at y=188, so y = 188 - (pos - (-12)) * step = 188 - (pos+12)*step
    return 188 - (diatonicPos + 12) * step;
  }
}

export function StaffNotation() {
  const { activeNotes, audiationMode } = useHarmonic();

  const activeArray = [...activeNotes].map(n => ({
    note: n,
    midi: Note.midi(n) || 60,
    pc: Note.pitchClass(n),
    color: getNoteColor(n),
    isSharp: (Note.pitchClass(n) || "").includes("#"),
  }));

  // Separate into treble and bass
  const trebleNotes = activeArray.filter(n => n.midi >= 60);
  const bassNotes = activeArray.filter(n => n.midi < 60);

  const staffLines = [0, 1, 2, 3, 4];

  return (
    <div className="glass-panel p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="engineering-label">Staff Notation</h3>
        {audiationMode && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/20 text-primary">
            AUDIATION
          </span>
        )}
      </div>
      <svg viewBox="0 0 400 220" className="w-full h-auto">
        {/* Treble Clef */}
        <text x="10" y="65" fontSize="48" fill="hsl(var(--foreground))" opacity="0.6" fontFamily="serif">
          𝄞
        </text>
        {staffLines.map(i => (
          <line key={`t-${i}`} x1="40" y1={40 + i * 12} x2="390" y2={40 + i * 12}
            stroke="hsl(var(--border))" strokeWidth="0.8" />
        ))}

        {/* Bass Clef */}
        <text x="10" y="175" fontSize="36" fill="hsl(var(--foreground))" opacity="0.6" fontFamily="serif">
          𝄢
        </text>
        {staffLines.map(i => (
          <line key={`b-${i}`} x1="40" y1={140 + i * 12} x2="390" y2={140 + i * 12}
            stroke="hsl(var(--border))" strokeWidth="0.8" />
        ))}

        {/* Treble notes */}
        {!audiationMode && trebleNotes.map((n, i) => {
          const y = midiToStaffY(n.midi, "treble");
          const x = 100 + i * 40;
          
          return (
            <g key={n.note}>
              {/* Ledger lines if needed */}
              {y > 88 && Array.from({ length: Math.ceil((y - 88) / 12) }, (_, li) => (
                <line key={`ledger-${li}`} x1={x - 12} y1={88 + (li + 1) * 12} x2={x + 12} y2={88 + (li + 1) * 12}
                  stroke="hsl(var(--border))" strokeWidth="0.8" />
              ))}
              {y < 40 && Array.from({ length: Math.ceil((40 - y) / 12) }, (_, li) => (
                <line key={`ledger-up-${li}`} x1={x - 12} y1={40 - (li + 1) * 12} x2={x + 12} y2={40 - (li + 1) * 12}
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
          const y = midiToStaffY(n.midi, "bass");
          const x = 100 + i * 40;
          const clampedY = Math.max(130, Math.min(200, y));
          
          return (
            <g key={n.note}>
              {clampedY > 188 && Array.from({ length: Math.ceil((clampedY - 188) / 12) }, (_, li) => (
                <line key={`ledger-${li}`} x1={x - 12} y1={188 + (li + 1) * 12} x2={x + 12} y2={188 + (li + 1) * 12}
                  stroke="hsl(var(--border))" strokeWidth="0.8" />
              ))}
              <ellipse cx={x} cy={clampedY} rx="7" ry="5" fill={n.color}
                transform={`rotate(-15 ${x} ${clampedY})`} />
              {n.isSharp && (
                <text x={x - 14} y={clampedY + 4} fontSize="10" fill={n.color} fontWeight="bold">#</text>
              )}
              <text x={x} y={clampedY + 18} fontSize="8" fill="hsl(var(--muted-foreground))"
                textAnchor="middle" fontFamily="JetBrains Mono">
                {n.pc}
              </text>
            </g>
          );
        })}

        {/* Empty state */}
        {activeArray.length === 0 && (
          <text x="215" y="115" fontSize="11" fill="hsl(var(--muted-foreground))" 
            textAnchor="middle" fontFamily="JetBrains Mono" opacity="0.5">
            Select notes on any instrument
          </text>
        )}
      </svg>
    </div>
  );
}
