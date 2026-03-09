import { useState } from "react";
import { HarmonicProvider, useHarmonic } from "@/contexts/HarmonicContext";
import { PianoKeyboard } from "@/components/PianoKeyboard";
import { GuitarFretboard } from "@/components/GuitarFretboard";
import { StaffNotation } from "@/components/StaffNotation";
import { LinearNoteMap } from "@/components/LinearNoteMap";
import { DissonanceSpectrum } from "@/components/DissonanceSpectrum";
import { Trash2, Volume2, VolumeX } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KEY_NAMES_COF, SCALE_PRESETS } from "@/lib/music-engine";
import musoIcon from "@/assets/midlife_muso_icon.webp";

function MainContent() {
  const {
    selectedKey, selectedScale, scaleRootOffset, isKeyLocked, midiState,
    activeNotes, isMuted, scaleLabelMode,
    setKey, setScale, setKeyLocked, setMuted, setScaleLabelMode, clearNotes,
    playNote,
  } = useHarmonic();

  const handleScaleChange = (value: string) => {
    if (value === "__none__") {
      setKeyLocked(false);
      return;
    }
    const preset = SCALE_PRESETS.find(p => `${p.type}:${p.rootOffset ?? 0}` === value);
    if (preset) {
      setScale(preset.type, preset.rootOffset);
      setKeyLocked(true);
    }
  };

  const currentScaleValue = isKeyLocked ? `${selectedScale}:${scaleRootOffset}` : "__none__";

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top bar: branding + controls */}
      <header className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border bg-card">
        {/* Branding */}
        <a href="https://midlifemuso.com" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 hover:opacity-80 transition-opacity mr-2 shrink-0">
          <img src={musoIcon} alt="Note Navigation" className="w-6 h-6 rounded" />
          <span className="text-sm font-bold text-primary font-mono">Note</span>
          <span className="text-sm font-bold text-foreground font-mono">Navigation</span>
        </a>

        {/* Key Centre dropdown */}
        <Select value={selectedKey} onValueChange={setKey}>
          <SelectTrigger className="w-[80px] h-8 text-xs font-mono bg-secondary/50 border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KEY_NAMES_COF.map(note => (
              <SelectItem key={note} value={note} className="text-xs font-mono">{note}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Scale Blueprint dropdown */}
        <Select value={currentScaleValue} onValueChange={handleScaleChange}>
          <SelectTrigger className="w-[180px] h-8 text-xs font-mono bg-secondary/50 border-border">
            <SelectValue placeholder="No scale" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__" className="text-xs font-mono text-muted-foreground">No scale</SelectItem>
            {SCALE_PRESETS.map(preset => {
              const val = `${preset.type}:${preset.rootOffset ?? 0}`;
              return (
                <SelectItem key={val} value={val} className="text-xs font-mono">
                  {preset.name}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {/* Mute */}
        <button
          onClick={() => setMuted(!isMuted)}
          className={`flex items-center justify-center w-8 h-8 rounded-md border transition-all ${
            isMuted
              ? 'border-destructive/40 bg-destructive/10 text-destructive'
              : 'border-border bg-secondary/50 text-muted-foreground hover:text-primary hover:border-primary/50'
          }`}
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>

        {/* Solfege / Degree toggle */}
        {isKeyLocked && (
          <ToggleGroup type="single" value={scaleLabelMode} onValueChange={(v) => v && setScaleLabelMode(v as any)} className="justify-start">
            <ToggleGroupItem value="solfege" size="sm" className="h-7 text-xs font-mono px-3">Solfege</ToggleGroupItem>
            <ToggleGroupItem value="degree" size="sm" className="h-7 text-xs font-mono px-3">Degrees</ToggleGroupItem>
          </ToggleGroup>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Clear notes */}
        {activeNotes.size > 0 && (
          <button
            onClick={clearNotes}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded-md border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all"
          >
            <Trash2 size={12} />
            Clear
          </button>
        )}

        {/* MIDI indicator */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className={`w-2 h-2 rounded-full ${
            midiState.isConnected
              ? 'bg-green-500 animate-pulse'
              : midiState.isSupported
                ? 'bg-yellow-500'
                : 'bg-red-500'
          }`} />
          <span className="text-[10px] font-mono text-muted-foreground hidden sm:inline">
            {midiState.isConnected
              ? midiState.deviceName
              : midiState.isSupported
                ? 'No MIDI'
                : 'No MIDI'}
          </span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-3 md:p-4 flex flex-col gap-3 md:gap-4">
        {/* Tri-View: Staff left, instruments right */}
        <div className="flex flex-col xl:flex-row gap-3 md:gap-4 flex-1 min-h-0">
          <div className="xl:flex-1 xl:min-w-[340px] min-h-[480px] md:min-h-[520px] xl:min-h-0 xl:self-stretch">
            <StaffNotation />
          </div>
          <div className="xl:w-[55%] 2xl:w-[60%] flex flex-col gap-2 md:gap-3 shrink-0 xl:self-stretch">
            <LinearNoteMap />
            <PianoKeyboard />
            <GuitarFretboard />
            <DissonanceSpectrum />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground pt-2 border-t border-border">
          <span>© Midlife Muso · Ear-First Guitar & Piano Coaching</span>
          <div className="flex items-center gap-3">
            <a href="https://midlifemuso.com" target="_blank" rel="noopener noreferrer"
              className="hover:text-primary transition-colors">
              midlifemuso.com
            </a>
            <a href="https://midlifemuso.com/learning" target="_blank" rel="noopener noreferrer"
              className="hover:text-primary transition-colors">
              Learning Resources
            </a>
            <a href="https://harmonic-geometry.lovable.app" target="_blank" rel="noopener noreferrer"
              className="hover:text-primary transition-colors">
              Harmonic Geometry
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}

const Index = () => (
  <HarmonicProvider>
    <MainContent />
  </HarmonicProvider>
);

export default Index;
