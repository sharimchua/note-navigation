import { useHarmonic } from "@/contexts/HarmonicContext";
import musoIcon from "@/assets/midlife_muso_icon.webp";
import { NOTE_NAMES, SCALE_PRESETS, GUITAR_TUNINGS, getNoteColor, getScaleNotes } from "@/lib/music-engine";
import { Note } from "tonal";

export function ControlSidebar() {
  const { 
    selectedKey, selectedScale, isKeyLocked, midiState, selectedTuning,
    setKey, setScale, setKeyLocked, setTuning,
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
      const note = getFretNote(selectedTuning.notes[4], fret); // 2nd string from top
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
              onClick={() => {
                setKey(note);
                // Re-apply current scale with new key if locked
                if (isKeyLocked && selectedScale) {
                  const notes = getScaleNotes(note, selectedScale);
                  const fullNotes = new Set(notes.map(n => `${n}4`));
                  setActiveNotes(fullNotes);
                }
              }}
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

      {/* Guitar Tuning */}
      <div className="space-y-2">
        <h4 className="engineering-label">Guitar Tuning</h4>
        <select
          value={selectedTuning.name}
          onChange={e => {
            const tuning = GUITAR_TUNINGS.find(t => t.name === e.target.value);
            if (tuning) setTuning(tuning);
          }}
          className="w-full px-2 py-1.5 text-xs font-mono rounded-sm border border-border 
            bg-secondary/50 text-secondary-foreground focus:border-primary focus:outline-none"
        >
          <optgroup label="Standard">
            {GUITAR_TUNINGS.filter(t => t.category === "standard").map(t => (
              <option key={t.name} value={t.name}>{t.name}</option>
            ))}
          </optgroup>
          <optgroup label="Drop">
            {GUITAR_TUNINGS.filter(t => t.category === "drop").map(t => (
              <option key={t.name} value={t.name}>{t.name}</option>
            ))}
          </optgroup>
          <optgroup label="Open">
            {GUITAR_TUNINGS.filter(t => t.category === "open").map(t => (
              <option key={t.name} value={t.name}>{t.name}</option>
            ))}
          </optgroup>
          <optgroup label="Alternate">
            {GUITAR_TUNINGS.filter(t => t.category === "alternate").map(t => (
              <option key={t.name} value={t.name}>{t.name}</option>
            ))}
          </optgroup>
        </select>
        <div className="text-[9px] font-mono text-muted-foreground">
          {selectedTuning.notes.join(" · ")}
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


        <button
          onClick={clearNotes}
          className="w-full px-2 py-1.5 text-xs font-mono rounded-sm border border-border 
            bg-secondary/50 text-secondary-foreground hover:border-destructive/50 hover:text-destructive transition-all"
        >
          Clear All Notes
        </button>
      </div>

      {/* MIDI Status */}
      <div className="space-y-2">
        <h4 className="engineering-label">MIDI Input</h4>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            midiState.isConnected 
              ? 'bg-green-500 animate-pulse' 
              : midiState.isSupported 
                ? 'bg-yellow-500' 
                : 'bg-red-500'
          }`} />
          <span className="text-xs font-mono text-muted-foreground">
            {midiState.isConnected 
              ? midiState.deviceName 
              : midiState.isSupported 
                ? 'Waiting for device...' 
                : 'Not supported'}
          </span>
        </div>
        {midiState.error && (
          <div className="text-[10px] text-destructive font-mono">{midiState.error}</div>
        )}
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
