import { useHarmonic } from "@/contexts/HarmonicContext";
import { TOTAL_FRETS, getFretNote, getNoteColor, getNotePitchClass } from "@/lib/music-engine";
import { Note } from "tonal";
import { useCallback } from "react";

export function GuitarFretboard() {
  const { activeNotes, toggleNote, playNote, isNoteInCurrentScale, isKeyLocked, selectedTuning, useFlats } = useHarmonic();

  const handleFretClick = useCallback((note: string) => {
    playNote(note);
    toggleNote(note);
  }, [playNote, toggleNote]);

  const tuningNotes = selectedTuning.notes;
  const strings = [...tuningNotes].reverse(); // Display high string on top
  const fretWidth = 100 / (TOTAL_FRETS + 1);
  const stringSpacing = 100 / (strings.length + 1);

  // Fret markers
  const markerFrets = [3, 5, 7, 9, 12, 15, 17, 19, 21];
  const doubleMarkerFrets = [12];

  return (
    <div className="glass-panel p-4">
      <h3 className="engineering-label mb-3">Fretboard · {selectedTuning.name} · {TOTAL_FRETS} Frets</h3>
      <div className="relative overflow-x-auto" style={{ minWidth: "900px" }}>
        <svg viewBox="0 0 1100 160" className="w-full h-auto">
          {/* Nut */}
          <rect x="44" y="10" width="4" height="140" fill="hsl(var(--foreground))" opacity="0.6" rx="1" />

          {/* Fret lines */}
          {Array.from({ length: TOTAL_FRETS }, (_, i) => {
            const x = 48 + (i + 1) * (1050 / (TOTAL_FRETS + 1));
            return (
              <line key={`fret-${i}`} x1={x} y1="10" x2={x} y2="150" 
                stroke="hsl(var(--border))" strokeWidth="1.5" />
            );
          })}

          {/* Fret markers */}
          {markerFrets.map(fret => {
            const x = 48 + (fret - 0.5) * (1050 / (TOTAL_FRETS + 1));
            if (doubleMarkerFrets.includes(fret)) {
              return (
                <g key={`marker-${fret}`}>
                  <circle cx={x} cy="60" r="4" fill="hsl(var(--muted-foreground))" opacity="0.4" />
                  <circle cx={x} cy="100" r="4" fill="hsl(var(--muted-foreground))" opacity="0.4" />
                </g>
              );
            }
            return (
              <circle key={`marker-${fret}`} cx={x} cy="80" r="4" 
                fill="hsl(var(--muted-foreground))" opacity="0.3" />
            );
          })}

          {/* Strings */}
          {strings.map((_, i) => {
            const y = 20 + i * 24;
            return (
              <line key={`string-${i}`} x1="48" y1={y} x2="1098" y2={y}
                stroke="hsl(var(--foreground))" strokeWidth={0.5 + (strings.length - 1 - i) * 0.3} opacity="0.3" />
            );
          })}

          {/* String labels */}
          {strings.map((openNote, i) => {
            const y = 20 + i * 24;
            const pc = Note.pitchClass(openNote);
            return (
              <text key={`label-${i}`} x="20" y={y + 4} 
                fill="hsl(var(--muted-foreground))" fontSize="10" fontFamily="JetBrains Mono" textAnchor="middle">
                {pc}
              </text>
            );
          })}

          {/* Notes on fretboard */}
          {strings.map((openNote, stringIdx) => {
            const y = 20 + stringIdx * 24;
            const originalStringIdx = strings.length - 1 - stringIdx;

            return Array.from({ length: TOTAL_FRETS + 1 }, (_, fret) => {
              const note = getFretNote(tuningNotes[originalStringIdx], fret);
              if (!note) return null;

              const pc = Note.pitchClass(note);
              const isActive = activeNotes.has(note);
              const inScale = isNoteInCurrentScale(note);
              const dimmed = isKeyLocked && !inScale;
              const color = getNoteColor(note);

              // Open string (fret 0) markers appear on the nut, not over string labels
              const x = fret === 0 
                ? 46 
                : 48 + (fret - 0.5) * (1050 / (TOTAL_FRETS + 1));

              if (!isActive && dimmed) {
                // Non-scale notes when key-locked: invisible click target only
                return (
                  <circle key={`${stringIdx}-${fret}`} cx={x} cy={y} r="8" 
                    fill="transparent" className="cursor-pointer"
                    onClick={() => handleFretClick(note)} />
                );
              }

              if (!isActive && isKeyLocked && inScale) {
                // Scale notes (not active): show subtle colored dots
                return (
                  <g key={`${stringIdx}-${fret}`} className="cursor-pointer" onClick={() => handleFretClick(note)}>
                    <circle cx={x} cy={y} r="8" fill={color} opacity="0.3" />
                    <text x={x} y={y + 3} fill="hsl(var(--foreground))" fontSize="7"
                      fontFamily="JetBrains Mono" textAnchor="middle" opacity="0.7">
                      {pc}
                    </text>
                  </g>
                );
              }

              if (!isActive) {
                // No key lock: invisible click target
                return (
                  <circle key={`${stringIdx}-${fret}`} cx={x} cy={y} r="8" 
                    fill="transparent" className="cursor-pointer"
                    onClick={() => handleFretClick(note)} />
                );
              }

              // Active notes: full display
              return (
                <g key={`${stringIdx}-${fret}`} className="cursor-pointer" onClick={() => handleFretClick(note)}>
                  <circle cx={x} cy={y} r="9" fill={color} />
                  <text x={x} y={y + 3} fill="hsl(var(--background))" fontSize="7"
                    fontFamily="JetBrains Mono" textAnchor="middle" fontWeight="bold">
                    {pc}
                  </text>
                </g>
              );
            });
          })}

          {/* Fret numbers */}
          {Array.from({ length: TOTAL_FRETS + 1 }, (_, fret) => {
            const x = fret === 0 
              ? 46 
              : 48 + (fret - 0.5) * (1050 / (TOTAL_FRETS + 1));
            return (
              <text key={`fnum-${fret}`} x={x} y="158" fill="hsl(var(--muted-foreground))" 
                fontSize="8" fontFamily="JetBrains Mono" textAnchor="middle" opacity="0.5">
                {fret}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
