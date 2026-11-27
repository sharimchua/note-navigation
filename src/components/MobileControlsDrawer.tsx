import React, { useState } from "react";
import { useHarmonic } from "@/contexts/HarmonicContext";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { LAYOUT_PRESETS } from "@/lib/layout-models";
import type { NoteLabelMode } from "@/lib/music-engine";
import type { GuitarRightHandMode, PianoComfortSpan } from "@/lib/phrase-model";
import type { SavedLessonEntry } from "@/lib/share-slug";
import {
  Bookmark,
  Check,
  LayoutGrid,
  ListMusic,
  Pin,
  Radio,
  Settings,
  Share2,
  Sparkles,
  Tags,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";
import musoIcon from "@/assets/midlife_muso_icon.webp";

interface MobileControlsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenMidiSettings: () => void;
  savedLessons: SavedLessonEntry[];
  onSaveLesson: (name: string) => void;
  onLoadLesson: (entry: SavedLessonEntry) => void;
  onDeleteLesson: (id: string) => void;
  onCopyShareUrl: () => void;
  shareCopied: boolean;
}

const LABEL_MODES: { id: NoteLabelMode; label: string; sub: string }[] = [
  { id: "notes", label: "Notes", sub: "A - G" },
  { id: "solfege", label: "Solfège", sub: "Do - Ti" },
  { id: "degree", label: "Degrees", sub: "1 - 7" },
  { id: "tri", label: "Tri", sub: "△ Shape" },
];

export function MobileControlsDrawer({
  open,
  onOpenChange,
  onOpenMidiSettings,
  savedLessons,
  onSaveLesson,
  onLoadLesson,
  onDeleteLesson,
  onCopyShareUrl,
  shareCopied,
}: MobileControlsDrawerProps) {
  const {
    labelMode,
    setLabelMode,
    isMuted,
    setMuted,
    isHoldEnabled,
    toggleHold,
    trailMode,
    setTrailMode,
    phraseMode,
    setPhraseMode,
    showFingering,
    setShowFingering,
    showNextPreview,
    setShowNextPreview,
    guitarRightHandMode,
    setGuitarRightHandMode,
    pianoComfortSpan,
    setPianoComfortSpan,
    layoutPresetId,
    setLayoutPreset,
    midiState,
    isStageEmbedded,
  } = useHarmonic();

  const [lessonName, setLessonName] = useState("");
  const showTrailToggle = midiState.isConnected || isStageEmbedded;

  const handleSubmitLesson = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = lessonName.trim();
    if (!trimmed) return;
    onSaveLesson(trimmed);
    setLessonName("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[88vw] max-w-sm bg-card border-l border-border p-0 flex flex-col overflow-hidden"
      >
        <SheetHeader className="px-4 py-3.5 border-b border-border shrink-0 text-left">
          <div className="flex items-center gap-2.5">
            <img src={musoIcon} alt="Midlife Muso" className="w-7 h-7 rounded shrink-0" />
            <div className="min-w-0">
              <SheetTitle className="text-sm font-sans font-bold text-foreground leading-tight">
                Note <span className="text-primary">Navigation</span>
              </SheetTitle>
              <SheetDescription className="text-[11px] font-sans text-muted-foreground leading-tight">
                Display, phrase, workspace &amp; lesson controls
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-5 text-xs">
          {/* 1. Note Labels & Quick Toggles */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-1.5 font-sans font-semibold text-[11px] uppercase tracking-wider text-foreground">
              <Tags size={13} className="text-primary" />
              <span>Note Labels &amp; Audio</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {LABEL_MODES.map(mode => {
                const active = labelMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setLabelMode(mode.id)}
                    className={`flex items-center justify-between px-2.5 py-2 rounded-lg border text-left transition-colors touch-manipulation ${
                      active
                        ? "border-primary/60 bg-primary/15 text-primary font-semibold"
                        : "border-border bg-secondary/40 text-foreground hover:bg-secondary/70"
                    }`}
                  >
                    <span className="text-xs font-sans">{mode.label}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{mode.sub}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={toggleHold}
                aria-pressed={isHoldEnabled}
                className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border font-mono text-xs transition-colors touch-manipulation ${
                  isHoldEnabled
                    ? "border-primary/60 bg-primary/15 text-primary font-semibold"
                    : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                <Pin size={13} />
                <span>{isHoldEnabled ? "Hold: ON" : "Hold Notes"}</span>
              </button>

              <button
                type="button"
                onClick={() => setMuted(!isMuted)}
                aria-pressed={isMuted}
                className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border font-mono text-xs transition-colors touch-manipulation ${
                  isMuted
                    ? "border-destructive/50 bg-destructive/15 text-destructive font-semibold"
                    : "border-border bg-secondary/40 text-foreground hover:border-primary/40"
                }`}
              >
                {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                <span>{isMuted ? "Muted" : "Audio ON"}</span>
              </button>

              {showTrailToggle && (
                <button
                  type="button"
                  onClick={() => setTrailMode(!trailMode)}
                  aria-pressed={trailMode}
                  className={`col-span-2 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border font-mono text-xs transition-colors touch-manipulation ${
                    trailMode
                      ? "border-primary/60 bg-primary/15 text-primary font-semibold"
                      : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Sparkles size={13} />
                  <span>{trailMode ? "Animated Trail: ON" : "Animated Trail: OFF"}</span>
                </button>
              )}
            </div>
          </section>

          {/* 2. Phrase & Ergonomics */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-1.5 font-sans font-semibold text-[11px] uppercase tracking-wider text-foreground">
              <ListMusic size={13} className="text-primary" />
              <span>Phrase &amp; Fingering</span>
            </div>

            <div className="bg-secondary/35 border border-border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-sans font-medium text-foreground">Phrase Sequencer</div>
                  <div className="text-[10px] font-sans text-muted-foreground">
                    Step through chord progressions &amp; melodies
                  </div>
                </div>
                <Switch checked={phraseMode} onCheckedChange={setPhraseMode} aria-label="Toggle Phrase Mode" />
              </div>

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/60">
                <div>
                  <div className="text-xs font-sans font-medium text-foreground">Show Fingerings</div>
                  <div className="text-[10px] font-sans text-muted-foreground">
                    Piano (L/R 1-5) &amp; Guitar (0-4) solver
                  </div>
                </div>
                <Switch checked={showFingering} onCheckedChange={setShowFingering} aria-label="Toggle Fingerings" />
              </div>

              {phraseMode && (
                <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/60">
                  <div>
                    <div className="text-xs font-sans font-medium text-foreground">Next Step Prep</div>
                    <div className="text-[10px] font-sans text-muted-foreground">
                      Preview upcoming step notes &amp; shifts
                    </div>
                  </div>
                  <Switch
                    checked={showNextPreview}
                    onCheckedChange={setShowNextPreview}
                    aria-label="Toggle Next Step Prep"
                  />
                </div>
              )}

              {showFingering && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60">
                  <label className="space-y-1">
                    <span className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      Guitar RH
                    </span>
                    <select
                      value={guitarRightHandMode}
                      onChange={e => setGuitarRightHandMode(e.target.value as GuitarRightHandMode)}
                      className="w-full h-8 px-2 rounded border border-border bg-card text-xs font-mono text-foreground"
                    >
                      <option value="off">Off</option>
                      <option value="fingerstyle">PIMA</option>
                      <option value="flatpick-alt">Alt ↓↑</option>
                      <option value="flatpick-econ">Econ ↓↑</option>
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      Piano Span
                    </span>
                    <select
                      value={pianoComfortSpan}
                      onChange={e => setPianoComfortSpan(Number(e.target.value) as PianoComfortSpan)}
                      className="w-full h-8 px-2 rounded border border-border bg-card text-xs font-mono text-foreground"
                    >
                      <option value={9}>Small (M6)</option>
                      <option value={12}>Std (Oct)</option>
                      <option value={14}>Wide (M9)</option>
                    </select>
                  </label>
                </div>
              )}
            </div>
          </section>

          {/* 3. Workspace Presets */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-1.5 font-sans font-semibold text-[11px] uppercase tracking-wider text-foreground">
              <LayoutGrid size={13} className="text-primary" />
              <span>Workspace Preset</span>
            </div>

            <div className="space-y-1.5">
              {LAYOUT_PRESETS.map(preset => {
                const selected = layoutPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setLayoutPreset(preset.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg border transition-colors touch-manipulation ${
                      selected
                        ? "border-primary/60 bg-primary/15 text-foreground"
                        : "border-border bg-secondary/35 text-foreground/90 hover:bg-secondary/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-xs font-sans font-semibold ${selected ? "text-primary" : ""}`}>
                        {preset.name}
                      </span>
                      {selected && <Check size={13} className="text-primary shrink-0" />}
                    </div>
                    <p className="text-[10px] font-sans text-muted-foreground leading-snug mt-0.5">
                      {preset.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 4. Share & Saved Lessons */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-1.5 font-sans font-semibold text-[11px] uppercase tracking-wider text-foreground">
              <Bookmark size={13} className="text-primary" />
              <span>Share &amp; Saved Lessons</span>
            </div>

            <button
              type="button"
              onClick={onCopyShareUrl}
              className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border font-mono text-xs transition-colors touch-manipulation ${
                shareCopied
                  ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-400 font-semibold"
                  : "border-border bg-secondary/50 text-foreground hover:border-primary/50 hover:text-primary"
              }`}
            >
              {shareCopied ? <Check size={13} /> : <Share2 size={13} />}
              <span>{shareCopied ? "Share Link Copied" : "Copy Shareable Link"}</span>
            </button>

            <div className="bg-secondary/35 border border-border rounded-lg p-2.5 space-y-2">
              <form onSubmit={handleSubmitLesson} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={lessonName}
                  onChange={e => setLessonName(e.target.value)}
                  placeholder="Save current lesson as..."
                  className="flex-1 h-8 px-2.5 rounded border border-border bg-card text-xs font-sans text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
                <button
                  type="submit"
                  disabled={!lessonName.trim()}
                  className="h-8 px-3 rounded border border-primary/50 bg-primary/15 text-primary text-xs font-mono font-semibold hover:bg-primary/25 disabled:opacity-40"
                >
                  Save
                </button>
              </form>

              <div className="max-h-40 overflow-y-auto space-y-1">
                {savedLessons.length === 0 ? (
                  <div className="text-[11px] font-sans text-muted-foreground py-1.5 text-center">
                    No saved lessons yet.
                  </div>
                ) : (
                  savedLessons.map(entry => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-card/80 border border-border/60"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onLoadLesson(entry);
                          onOpenChange(false);
                        }}
                        className="flex-1 text-left text-xs font-sans text-foreground truncate hover:text-primary"
                      >
                        {entry.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteLesson(entry.id)}
                        className="p-1 text-muted-foreground hover:text-destructive shrink-0"
                        aria-label={`Delete ${entry.name}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* 5. Hardware MIDI & Pedal Settings */}
          <section className="space-y-2">
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                onOpenMidiSettings();
              }}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-secondary/45 hover:bg-secondary/75 transition-colors touch-manipulation"
            >
              <div className="flex items-center gap-2">
                <Settings size={14} className="text-primary" />
                <span className="text-xs font-sans font-semibold text-foreground">
                  MIDI &amp; Pedal Settings
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
                <Radio
                  size={12}
                  className={
                    midiState.isConnected
                      ? "text-emerald-400 animate-pulse"
                      : midiState.isSupported
                        ? "text-amber-400"
                        : "text-rose-400"
                  }
                />
                <span>
                  {midiState.isConnected
                    ? midiState.deviceName || "Connected"
                    : midiState.isSupported
                      ? "No MIDI"
                      : "Unsupported"}
                </span>
              </div>
            </button>
          </section>

          {!isStageEmbedded && (
            <div className="pt-3 border-t border-border space-y-1.5 text-[11px] font-sans text-muted-foreground pb-2">
              <div className="font-semibold text-foreground/80">Midlife Muso</div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px]">
                <a
                  href="https://midlifemuso.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors"
                >
                  midlifemuso.com
                </a>
                <a
                  href="https://midlifemuso.com/learning"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors"
                >
                  Learning Resources
                </a>
                <a
                  href="https://harmonic-geometry.midlifemuso.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors"
                >
                  Harmonic Geometry
                </a>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
