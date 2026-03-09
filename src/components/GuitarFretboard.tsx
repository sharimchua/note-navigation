import { useHarmonic } from "@/contexts/HarmonicContext";
import { TOTAL_FRETS, getFretNote, getNoteColor, getNotePitchClass, GUITAR_TUNINGS, getScaleLabel, getNoteChroma } from "@/lib/music-engine";
import { Note } from "tonal";
import { useCallback, useRef, useEffect, useState, useMemo } from "react";

export function GuitarFretboard() {
  const { activeNotes, toggleNote, playNote, isNoteInCurrentScale, isKeyLocked, scaleLabelMode, selectedTuning, setTuning, useFlats, scaleNotes } = useHarmonic();
  const [tuningOpen, setTuningOpen] = useState(false);
  const tuningRef = useRef<HTMLDivElement>(null);

  const tuningNotes = selectedTuning.notes;
  
  const rootChroma = useMemo(() => scaleNotes.length > 0 ? getNoteChroma(scaleNotes[0]) : 0, [scaleNotes]);
  const baseMidi = useMemo(() => {
    let minStringMidi = 1000;
    tuningNotes.forEach(s => {
      const m = Note.midi(s);
      if (m && m < minStringMidi) minStringMidi = m;
    });
    let lowestMidi = minStringMidi;
    while (lowestMidi % 12 !== rootChroma) {
      lowestMidi++;
    }
    return lowestMidi;
  }, [tuningNotes, rootChroma]);

  const handleFretClick = useCallback((note: string) => {
    playNote(note);
    toggleNote(note);
  }, [playNote, toggleNote]);
  const strings = [...tuningNotes].reverse();
  const fretWidth = 100 / (TOTAL_FRETS + 1);
  const stringSpacing = 100 / (strings.length + 1);

  const markerFrets = [3, 5, 7, 9, 12, 15, 17, 19, 21];
  const doubleMarkerFrets = [12];

  const fretScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tuningOpen) return;
    const handler = (e: MouseEvent) => {
      if (tuningRef.current && !tuningRef.current.contains(e.target as Node)) {
        setTuningOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [tuningOpen]);

  useEffect(() => {
    const el = fretScrollRef.current;
    if (!el) return;
    el.scrollLeft = 0;
  }, []);

  const tuningCategories = [
    { label: "Standard", category: "standard" },
    { label: "Drop", category: "drop" },
    { label: "Open", category: "open" },
    { label: "Alternate", category: "alternate" },
  ];

  return (
    <div className="glass-panel p-4">
      <div className="flex items-center gap-2 mb-3 relative">
        <h3 className="engineering-label">Fretboard ·</h3>
        <div ref={tuningRef} className="relative">
          <button
            onClick={() => setTuningOpen(!tuningOpen)}
            className="text-[10px] font-semibold uppercase tracking-wider font-mono text-primary hover:text-primary/80 transition-colors cursor-pointer border-b border-dashed border-primary/40"
          >
            {selectedTuning.name}
          </button>
          {tuningOpen && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-md shadow-lg py-1 min-w-[180px] max-h-[280px] overflow-y-auto">
              {tuningCategories.map(cat => {
                const tunings = GUITAR_TUNINGS.filter(t => t.category === cat.category);
                if (tunings.length === 0) return null;
                return (
                  <div key={cat.category}>
                    <div className="px-3 py-1 text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
                      {cat.label}
                    </div>
                    {tunings.map(t => (
                      <button
                        key={t.name}
                        onClick={() => { setTuning(t); setTuningOpen(false); }}
                        className={`w-full text-left px-3 py-1.5 text-xs font-mono transition-colors
                          ${selectedTuning.name === t.name
                            ? 'bg-primary/20 text-primary'
                            : 'text-foreground hover:bg-accent'
                          }`}
                      >
                        {t.name}
                        <span className="text-[9px] text-muted-foreground ml-2">{t.notes.join(" ")}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <span className="engineering-label">· {TOTAL_FRETS} Frets</span>
      </div>
      <div ref={fretScrollRef} className="overflow-x-auto pb-3">
        <div style={{ minWidth: "1600px" }}>
          <svg viewBox="0 0 1100 160" className="w-full" style={{ minHeight: "140px" }}>
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

              const pc = getNotePitchClass(note, useFlats);
              const isActive = activeNotes.has(note);
              const inScale = isNoteInCurrentScale(note);
              const dimmed = isKeyLocked && !inScale;
              const color = getNoteColor(note);
              const scaleLabel = isKeyLocked ? getScaleLabel(note, scaleNotes, scaleLabelMode, baseMidi) : null;

              const x = fret === 0 
                ? 46 
                : 48 + (fret - 0.5) * (1050 / (TOTAL_FRETS + 1));

              if (!isActive && dimmed) {
                return (
                  <circle key={`${stringIdx}-${fret}`} cx={x} cy={y} r="8" 
                    fill="transparent" className="cursor-pointer"
                    onClick={() => handleFretClick(note)} />
                );
              }

              if (!isActive && isKeyLocked && inScale) {
                return (
                  <g key={`${stringIdx}-${fret}`} className="cursor-pointer" onClick={() => handleFretClick(note)}>
                    <circle cx={x} cy={y} r="8" fill={color} opacity={0.3} />
                    <text x={x} y={y + 3} fill="hsl(var(--foreground))" fontSize={scaleLabel && scaleLabel.length > 1 ? "5.5" : "7"}
                      fontFamily="JetBrains Mono" textAnchor="middle" opacity={0.7}>
                      {scaleLabel || pc}
                    </text>
                  </g>
                );
              }

              if (!isActive) {
                return (
                  <circle key={`${stringIdx}-${fret}`} cx={x} cy={y} r="8" 
                    fill="transparent" className="cursor-pointer"
                    onClick={() => handleFretClick(note)} />
                );
              }

              // Active notes
              return (
                <g key={`${stringIdx}-${fret}`} className="cursor-pointer" onClick={() => handleFretClick(note)}>
                  <circle cx={x} cy={y} r="9" fill={color} className="note-active" />
                  <text x={x} y={y + 3} fill="hsl(var(--background))" fontSize={scaleLabel && scaleLabel.length > 1 ? "5.5" : "7"}
                    fontFamily="JetBrains Mono" textAnchor="middle" fontWeight="bold">
                    {scaleLabel || pc}
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
    </div>
  );
}