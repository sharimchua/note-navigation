import { useHarmonic } from "@/contexts/HarmonicContext";
import musoIcon from "@/assets/midlife_muso_icon.webp";
import { NOTE_NAMES, SCALE_PRESETS, DEXTERITY_PRESETS, getNoteColor, getScaleNotes, getFretNote, STANDARD_TUNING } from "@/lib/music-engine";
import { Note } from "tonal";

export function ControlSidebar() {
  const { 
    selectedKey, selectedScale, isKeyLocked, audiationMode,
    setKey, setScale, setKeyLocked, setAudiationMode, 
    setActiveNotes, clearNotes, playNote
  } = useHarmonic();

  const handleScalePreset = (scaleType: string) => {
    setScale(scaleType);
    setKeyLocked(true);
    // Activate scale notes in octave 4
    const notes = getScaleNotes(selectedKey, scaleType);
    const fullNotes = new Set(notes.map(n => `${n}4`));
    setActiveNotes(fullNotes);
    fullNotes.forEach(n => playNote(n));
  };

  const handleDexterityPreset = (pattern: number[]) => {
    // Start from the selected key on the guitar, 5th fret area
    const startFret = 5;
    const notes = new Set<string>();
    pattern.forEach((finger, i) => {
      const fret = startFret + finger - 1;
      const note = getFretNote(STANDARD_TUNING[4], fret); // B string
      if (note) {
        notes.add(note);
      }
    });
    setActiveNotes(notes);
    notes.forEach(n => playNote(n));
  };

  return (
    <div className="w-64 min-w-[256px] h-full overflow-y-auto p-4 space-y-6 bg-sidebar border-r border-sidebar-border">
      {/* Logo / Brand */}
      <div className="space-y-1">
        <a href="https://midlifemuso.com" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <img src={musoIcon} alt="Note Navigation" className="w-7 h-7 rounded" />
          <span className="text-lg font-bold text-primary font-mono">Note</span>
          <span className="text-lg font-bold text-foreground font-mono">Navigation</span>
        </a>
        <a href="https://midlifemuso.com" target="_blank" rel="noopener noreferrer"
          className="text-[10px] text-muted-foreground font-mono hover:text-primary transition-colors">
          A Midlife Muso Tool
        </a>
      </div>

      {/* Key Center */}
      <div className="space-y-2">
        <h4 className="engineering-label">Key Center (Tonic)</h4>
        <div className="grid grid-cols-6 gap-1">
          {NOTE_NAMES.map(note => (
            <button
              key={note}
              onClick={() => setKey(note)}
              className={`px-1.5 py-1.5 text-xs font-mono rounded-sm border transition-all
                ${selectedKey === note 
                  ? 'border-primary bg-primary/20 text-primary' 
                  : 'border-border bg-secondary/50 text-secondary-foreground hover:border-primary/50'
                }`}
            >
              {note}
            </button>
          ))}
        </div>
      </div>

      {/* Scale Presets */}
      <div className="space-y-2">
        <h4 className="engineering-label">Scale Blueprint</h4>
        <div className="space-y-1">
          {SCALE_PRESETS.map(preset => (
            <button
              key={preset.type}
              onClick={() => handleScalePreset(preset.type)}
              className={`w-full text-left px-2 py-1.5 text-xs font-mono rounded-sm border transition-all
                ${selectedScale === preset.type && isKeyLocked
                  ? 'border-primary bg-primary/20 text-primary'
                  : 'border-border bg-secondary/50 text-secondary-foreground hover:border-primary/50'
                }`}
            >
              <span>{preset.name}</span>
              <span className="text-[9px] text-muted-foreground ml-1">({preset.category})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Dexterity Presets */}
      <div className="space-y-2">
        <h4 className="engineering-label">Spider-Walk Patterns</h4>
        <div className="space-y-1">
          {DEXTERITY_PRESETS.map(preset => (
            <button
              key={preset.name}
              onClick={() => handleDexterityPreset(preset.pattern)}
              className="w-full text-left px-2 py-1.5 text-xs font-mono rounded-sm border border-border 
                bg-secondary/50 text-secondary-foreground hover:border-primary/50 transition-all"
            >
              <div>{preset.name}</div>
              <div className="text-[9px] text-muted-foreground">{preset.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-3">
        <h4 className="engineering-label">Harmonic Calibration</h4>
        
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isKeyLocked}
            onChange={e => setKeyLocked(e.target.checked)}
            className="accent-primary"
          />
          <span className="text-xs font-mono text-secondary-foreground">One-Key Focus</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={audiationMode}
            onChange={e => setAudiationMode(e.target.checked)}
            className="accent-primary"
          />
          <span className="text-xs font-mono text-secondary-foreground">Audiation Mode</span>
        </label>

        <button
          onClick={clearNotes}
          className="w-full px-2 py-1.5 text-xs font-mono rounded-sm border border-border 
            bg-secondary/50 text-secondary-foreground hover:border-destructive/50 hover:text-destructive transition-all"
        >
          Clear All Notes
        </button>
      </div>

      {/* Active Notes Display */}
      <div className="space-y-2">
        <h4 className="engineering-label">Active Signal</h4>
        <div className="text-xs font-mono text-muted-foreground">
          Key: {selectedKey} {selectedScale}
        </div>
      </div>

      {/* Links */}
      <div className="space-y-2 pt-4 border-t border-sidebar-border">
        <a href="https://midlifemuso.com" target="_blank" rel="noopener noreferrer"
          className="block text-xs font-mono text-muted-foreground hover:text-primary transition-colors">
          → midlifemuso.com
        </a>
        <a href="https://midlifemuso.com/learning" target="_blank" rel="noopener noreferrer"
          className="block text-xs font-mono text-muted-foreground hover:text-primary transition-colors">
          → Learning Resources
        </a>
        <a href="https://harmonic-geometry.lovable.app" target="_blank" rel="noopener noreferrer"
          className="block text-xs font-mono text-muted-foreground hover:text-primary transition-colors">
          → Harmonic Geometry
        </a>
      </div>
    </div>
  );
}
