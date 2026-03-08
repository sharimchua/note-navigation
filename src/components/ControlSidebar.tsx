import { useHarmonic } from "@/contexts/HarmonicContext";
import musoIcon from "@/assets/midlife_muso_icon.webp";
import { NOTE_NAMES, SCALE_PRESETS } from "@/lib/music-engine";

// Generate piano note options for hand root selection (C2-C6)
const HAND_ROOT_OPTIONS: string[] = [];
for (let octave = 2; octave <= 6; octave++) {
  for (const note of NOTE_NAMES) {
    HAND_ROOT_OPTIONS.push(`${note}${octave}`);
  }
}

export function ControlSidebar() {
  const { 
    selectedKey, selectedScale, isKeyLocked, midiState,
    leftHand, rightHand,
    setKey, setScale, setKeyLocked,
    setLeftHand, setRightHand,
    clearNotes, playNote
  } = useHarmonic();

  const handleScalePreset = (scaleType: string) => {
    if (selectedScale === scaleType && isKeyLocked) {
      setKeyLocked(false);
    } else {
      setScale(scaleType);
      setKeyLocked(true);
    }
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

      {/* Controls */}
      <div className="space-y-3">
        <h4 className="engineering-label">Harmonic Calibration</h4>

        <button
          onClick={clearNotes}
          className="w-full px-2 py-1.5 text-xs font-mono rounded-sm border border-border 
            bg-secondary/50 text-secondary-foreground hover:border-destructive/50 hover:text-destructive transition-all"
        >
          Clear All Notes
        </button>
      </div>

      {/* Hand Position Overlay */}
      <div className="space-y-3">
        <h4 className="engineering-label">Hand Position</h4>
        <div className="text-[9px] font-mono text-muted-foreground">
          5 notes from {selectedKey} {selectedScale}
        </div>
        
        {/* Left Hand */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={leftHand.enabled}
              onChange={e => setLeftHand({ ...leftHand, enabled: e.target.checked })}
              className="accent-primary"
            />
            <span className="text-xs font-mono text-secondary-foreground flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500/80 inline-block" />
              Left Hand
            </span>
          </label>
          {leftHand.enabled && (
            <div className="space-y-1">
              <span className="text-[9px] font-mono text-muted-foreground">Finger 1 (Thumb)</span>
              <select
                value={leftHand.rootNote}
                onChange={e => setLeftHand({ ...leftHand, rootNote: e.target.value })}
                className="w-full px-2 py-1 text-xs font-mono rounded-sm border border-border 
                  bg-secondary/50 text-secondary-foreground focus:border-primary focus:outline-none"
              >
                {HAND_ROOT_OPTIONS.map(n => (
                  <option key={`lh-${n}`} value={n}>{n}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Right Hand */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={rightHand.enabled}
              onChange={e => setRightHand({ ...rightHand, enabled: e.target.checked })}
              className="accent-primary"
            />
            <span className="text-xs font-mono text-secondary-foreground flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block" />
              Right Hand
            </span>
          </label>
          {rightHand.enabled && (
            <div className="space-y-1">
              <span className="text-[9px] font-mono text-muted-foreground">Finger 1 (Thumb)</span>
              <select
                value={rightHand.rootNote}
                onChange={e => setRightHand({ ...rightHand, rootNote: e.target.value })}
                className="w-full px-2 py-1 text-xs font-mono rounded-sm border border-border 
                  bg-secondary/50 text-secondary-foreground focus:border-primary focus:outline-none"
              >
                {HAND_ROOT_OPTIONS.map(n => (
                  <option key={`rh-${n}`} value={n}>{n}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

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
