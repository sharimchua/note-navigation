import { useHarmonic } from "@/contexts/HarmonicContext";
import { getNoteColor, getNoteChroma } from "@/lib/music-engine";
import { Note } from "tonal";

// Simple staff rendering - treble and bass clef
// Maps MIDI notes to staff positions
function midiToStaffY(midi: number, clef: "treble" | "bass"): number {
  // Treble clef: middle C (60) is at ledger line below staff
  // Bass clef: middle C (60) is at ledger line above staff
  const notePositions: Record<number, number> = {};
  
  if (clef === "treble") {
    // Staff lines from bottom: E4(64), G4(67), B4(71), D5(74), F5(77)
    // Each semitone doesn't map linearly, use chromatic-to-diatonic
    const baseY = 100; // Bottom of treble staff
    const step = 6; // pixels per staff position
    
    // Map diatonic positions relative to C4 (midi 60)
    const c4Pos = 10; // positions below bottom line
    const diatonicMap = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]; // C,C#,D,D#,E,F,F#,G,G#,A,A#,B
    
    const octave = Math.floor(midi / 12) - 5; // relative to C4's octave
    const pc = midi % 12;
    const diatonicPos = diatonicMap[pc] + octave * 7;
    
    return baseY - (diatonicPos - c4Pos + 6) * step;
  } else {
    const baseY = 100;
    const step = 6;
    const c3Pos = 10;
    const diatonicMap = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
    
    const octave = Math.floor(midi / 12) - 4;
    const pc = midi % 12;
    const diatonicPos = diatonicMap[pc] + octave * 7;
    
    return baseY - (diatonicPos - c3Pos + 6) * step;
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
