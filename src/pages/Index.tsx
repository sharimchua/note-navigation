import { useEffect, useState } from "react";
import { HarmonicProvider, useHarmonic } from "@/contexts/HarmonicContext";
import { FlexLayoutRenderer } from "@/components/FlexLayoutRenderer";
import { MobileWorkspaceDeck } from "@/components/MobileWorkspaceDeck";
import { MobileControlsDrawer } from "@/components/MobileControlsDrawer";
import { PhraseBar } from "@/components/PhraseBar";
import { SettingsDrawer } from "@/components/SettingsDrawer";
import {
  Trash2,
  Volume2,
  VolumeX,
  Sparkles,
  Tags,
  Pin,
  ListMusic,
  LayoutGrid,
  Pencil,
  Share2,
  Check,
  Bookmark,
  Settings,
  SlidersHorizontal,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { KEY_NAMES_COF, SCALE_PRESETS, type NoteLabelMode } from "@/lib/music-engine";
import {
  LAYOUT_PRESETS,
  countCells,
  updateCellModule,
  splitCellNode,
  removeCellNode,
} from "@/lib/layout-models";
import {
  buildShareUrl,
  encodeShareSlug,
  decodeShareSlug,
  loadSavedLessons,
  saveLessonEntry,
  deleteSavedLessonEntry,
  type SavedLessonEntry,
} from "@/lib/share-slug";
import musoIcon from "@/assets/midlife_muso_icon.webp";

function MainContent() {
  const {
    selectedKey, selectedScale, scaleRootOffset, isKeyLocked, midiState,
    activeNotes, isMuted, isHoldEnabled, labelMode, trailMode, ecoMode, isStageEmbedded,
    phraseMode, isPlayingPhrase, layoutPresetId, layoutRoot, midiLearnAction,
    setKey, setScale, setKeyLocked, setMuted, toggleHold, setLabelMode, clearNotes,
    setTrailMode, setPhraseMode, stepPrev, stepNext, stepForwardOrAdd,
    addPhraseStep, duplicatePhraseStep, removePhraseStep, playPhrase, stopPhrasePlayback,
    cancelMidiLearn,
    setLayoutPreset, setCustomLayout, getShareSnapshot, hydrateFromSnapshot,
  } = useHarmonic();

  const [isLayoutEdit, setIsLayoutEdit] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [lessonsOpen, setLessonsOpen] = useState(false);
  const [lessonName, setLessonName] = useState("");
  const [savedLessons, setSavedLessons] = useState<SavedLessonEntry[]>(() => loadSavedLessons());

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (midiLearnAction && e.key === "Escape") {
        e.preventDefault();
        cancelMidiLearn();
        return;
      }

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      const isInteractiveControl =
        target && (target.tagName === "BUTTON" || target.tagName === "A");

      if (e.code === "KeyH" || e.key.toLowerCase() === "h") {
        e.preventDefault();
        toggleHold();
      } else if (e.key === "Escape") {
        e.preventDefault();
        clearNotes();
      } else if (phraseMode && e.key === "ArrowLeft") {
        e.preventDefault();
        stepPrev();
      } else if (phraseMode && e.key === "ArrowRight") {
        e.preventDefault();
        stepNext();
      } else if (phraseMode && e.key === "Enter" && !isInteractiveControl) {
        e.preventDefault();
        stepForwardOrAdd();
      } else if (phraseMode && (e.code === "KeyN" || e.key === "+" || e.key === "=")) {
        e.preventDefault();
        addPhraseStep();
      } else if (phraseMode && e.code === "KeyD") {
        e.preventDefault();
        duplicatePhraseStep();
      } else if (phraseMode && e.code === "Space" && !isInteractiveControl) {
        e.preventDefault();
        if (isPlayingPhrase) {
          stopPhrasePlayback();
        } else {
          playPhrase();
        }
      } else if (phraseMode && e.key === "Delete") {
        e.preventDefault();
        removePhraseStep();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    toggleHold,
    clearNotes,
    phraseMode,
    stepPrev,
    stepNext,
    stepForwardOrAdd,
    addPhraseStep,
    duplicatePhraseStep,
    removePhraseStep,
    isPlayingPhrase,
    playPhrase,
    stopPhrasePlayback,
    midiLearnAction,
    cancelMidiLearn,
  ]);

  const handleCopyShareUrl = async () => {
    const url = buildShareUrl(getShareSnapshot());
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 1800);
    } catch {
      // Fallback: update address bar without reload so the user can copy directly
      window.history.replaceState(null, "", url);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 1800);
    }
  };

  const saveLessonByName = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const slug = encodeShareSlug(getShareSnapshot());
    const next = saveLessonEntry(trimmed, slug);
    setSavedLessons(next);
  };

  const handleSaveLesson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonName.trim()) return;
    saveLessonByName(lessonName);
    setLessonName("");
  };

  const handleLoadLesson = (entry: SavedLessonEntry) => {
    const snapshot = decodeShareSlug(entry.slug);
    if (snapshot) {
      hydrateFromSnapshot(snapshot);
      setLessonsOpen(false);
    }
  };

  const handleDeleteLesson = (id: string) => {
    setSavedLessons(deleteSavedLessonEntry(id));
  };

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
  const showTrailToggle = midiState.isConnected || isStageEmbedded;

  return (
    <div className={`flex flex-col h-screen supports-[height:100dvh]:h-[100dvh] overflow-hidden bg-background text-foreground ${ecoMode ? "eco-mode" : ""}`}>
      {/* Mobile compact 1-row header */}
      <header className="md:hidden flex items-center gap-1.5 px-2.5 py-2 border-b border-border bg-card/95 shrink-0">
        {!isStageEmbedded && (
          <a
            href="https://midlifemuso.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center shrink-0 hover:opacity-85 transition-opacity"
            title="Midlife Muso — Note Navigation"
          >
            <img src={musoIcon} alt="Note Navigation" className="w-7 h-7 rounded" />
          </a>
        )}

        <Select value={selectedKey} onValueChange={setKey}>
          <SelectTrigger
            className="w-[62px] h-8 px-2 text-xs font-mono bg-secondary/70 border-border shrink-0"
            aria-label="Key Centre"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KEY_NAMES_COF.map(note => (
              <SelectItem key={note} value={note} className="text-xs font-mono">{note}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={currentScaleValue} onValueChange={handleScaleChange}>
          <SelectTrigger
            className="flex-1 min-w-0 max-w-[180px] h-8 px-2 text-xs font-mono bg-secondary/70 border-border"
            aria-label="Scale Blueprint"
          >
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

        <div className="flex-1 min-w-0" />

        <button
          type="button"
          onClick={() => setMuted(!isMuted)}
          className={`flex items-center justify-center w-8 h-8 rounded-md border transition-all shrink-0 touch-manipulation ${
            isMuted
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-border bg-secondary/70 text-muted-foreground hover:text-primary"
          }`}
          aria-label={isMuted ? "Unmute" : "Mute"}
          title={isMuted ? "Unmute audio" : "Mute audio"}
        >
          {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>

        {(activeNotes.size > 0 || isHoldEnabled) && (
          <button
            type="button"
            onClick={clearNotes}
            className="flex items-center justify-center w-8 h-8 rounded-md border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all shrink-0 touch-manipulation"
            aria-label="Clear notes"
            title="Clear all notes"
          >
            <Trash2 size={14} />
          </button>
        )}

        <button
          type="button"
          onClick={() => setMobileControlsOpen(true)}
          className={`relative flex items-center gap-1 px-2.5 h-8 rounded-md border text-xs font-mono transition-all shrink-0 touch-manipulation ${
            mobileControlsOpen
              ? "border-primary/60 bg-primary/15 text-primary"
              : "border-border bg-secondary/70 text-foreground hover:border-primary/50"
          }`}
          aria-label="Open controls and settings"
          title="Labels, Phrase, Presets, Share & MIDI"
        >
          <SlidersHorizontal size={14} />
          {(isHoldEnabled || phraseMode || midiState.isConnected) && (
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                midiState.isConnected ? "bg-emerald-400" : "bg-primary"
              }`}
            />
          )}
        </button>
      </header>

      {/* Tablet & Desktop top bar: branding + full controls */}
      <header className="hidden md:flex flex-wrap items-end gap-x-3 gap-y-1.5 px-3 py-2 border-b border-border bg-card/95 shrink-0">
        {/* Branding (hidden when embedded inside Muso Stage) */}
        {!isStageEmbedded && (
          <a
            href="https://midlifemuso.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 hover:opacity-85 transition-opacity mr-2 shrink-0"
          >
            <img src={musoIcon} alt="Note Navigation" className="w-6 h-6 rounded" />
            <div className="flex flex-col">
              <div className="flex items-center gap-1 leading-tight">
                <span className="text-sm font-bold text-primary font-sans tracking-tight">Note</span>
                <span className="text-sm font-bold text-foreground font-sans tracking-tight">Navigation</span>
              </div>
              <span className="text-[9px] text-muted-foreground font-sans leading-none">A Midlife Muso Tool</span>
            </div>
          </a>
        )}

        {/* Key Centre dropdown */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] font-sans font-medium text-muted-foreground uppercase tracking-wider">Key Centre</span>
          <Select value={selectedKey} onValueChange={setKey}>
            <SelectTrigger className="w-[82px] h-8 text-xs font-mono bg-secondary/70 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KEY_NAMES_COF.map(note => (
                <SelectItem key={note} value={note} className="text-xs font-mono">{note}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Scale Blueprint dropdown */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] font-sans font-medium text-muted-foreground uppercase tracking-wider">Scale Blueprint</span>
          <Select value={currentScaleValue} onValueChange={handleScaleChange}>
            <SelectTrigger className="w-[180px] h-8 text-xs font-mono bg-secondary/70 border-border">
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
        </div>

        {/* Label Mode dropdown (always available) */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] font-sans font-medium text-muted-foreground uppercase tracking-wider">Labels</span>
          <Select value={labelMode} onValueChange={(v) => setLabelMode(v as NoteLabelMode)}>
            <SelectTrigger className="w-[155px] h-8 text-xs font-mono bg-secondary/70 border-border">
              <div className="flex items-center gap-1.5 truncate">
                <Tags size={12} className="text-muted-foreground shrink-0" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="notes" className="text-xs font-mono">Notes (A–G)</SelectItem>
              <SelectItem value="tri" className="text-xs font-mono">Tri (△)</SelectItem>
              <SelectItem value="solfege" className="text-xs font-mono">Solfège (Do–Ti)</SelectItem>
              <SelectItem value="degree" className="text-xs font-mono">Degrees (1–7)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Mute */}
        <button
          onClick={() => setMuted(!isMuted)}
          className={`flex items-center justify-center w-8 h-8 rounded-md border transition-all ${
            isMuted
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-border bg-secondary/70 text-muted-foreground hover:text-primary hover:border-primary/50"
          }`}
          aria-label={isMuted ? "Unmute" : "Mute"}
          title={isMuted ? "Unmute audio" : "Mute audio"}
        >
          {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>

        {/* Hold MIDI toggle (H) */}
        <button
          type="button"
          onClick={toggleHold}
          className={`flex items-center gap-1 px-2 h-8 rounded-md border text-xs font-mono transition-all ${
            isHoldEnabled
              ? "border-primary/60 bg-primary/15 text-primary font-semibold"
              : "border-border bg-secondary/70 text-muted-foreground hover:text-primary hover:border-primary/50"
          }`}
          aria-pressed={isHoldEnabled}
          title="Hold MIDI notes (H) · Press Esc to clear"
        >
          <Pin size={12} />
          <span className="hidden sm:inline">Hold</span>
          <kbd className="text-[9px] opacity-70">H</kbd>
        </button>

        {/* Trail toggle */}
        {showTrailToggle && (
          <button
            onClick={() => setTrailMode(!trailMode)}
            className={`flex items-center justify-center w-8 h-8 rounded-md border transition-all ${
              trailMode
                ? "border-primary/60 bg-primary/15 text-primary"
                : "border-border bg-secondary/70 text-muted-foreground hover:text-primary hover:border-primary/50"
            }`}
            aria-label={trailMode ? "Disable animated trail" : "Enable animated trail"}
            title={trailMode ? "Animated trail on" : "Animated trail off"}
          >
            <Sparkles size={14} />
          </button>
        )}

        {/* Phrase mode toggle */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] font-sans font-medium text-muted-foreground uppercase tracking-wider">Mode</span>
          <button
            type="button"
            onClick={() => setPhraseMode(!phraseMode)}
            className={`flex items-center gap-1.5 px-2.5 h-8 rounded-md border text-xs font-mono transition-all ${
              phraseMode
                ? "border-primary/60 bg-primary/15 text-primary font-semibold"
                : "border-border bg-secondary/70 text-muted-foreground hover:text-primary hover:border-primary/50"
            }`}
            aria-pressed={phraseMode}
            title="Toggle multi-step Phrase / Sequence stepper"
          >
            <ListMusic size={13} />
            <span>Phrase</span>
          </button>
        </div>

        {/* Layout preset + edit toggle */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] font-sans font-medium text-muted-foreground uppercase tracking-wider">Layout</span>
          <div className="flex items-center gap-1">
            <Select
              value={layoutPresetId}
              onValueChange={(v) => {
                if (v !== "custom") {
                  setLayoutPreset(v);
                }
              }}
            >
              <SelectTrigger className="w-[140px] h-8 text-xs font-mono bg-secondary/70 border-border">
                <div className="flex items-center gap-1.5 truncate">
                  <LayoutGrid size={12} className="text-muted-foreground shrink-0" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                {LAYOUT_PRESETS.map(p => (
                  <SelectItem key={p.id} value={p.id} className="text-xs font-mono">
                    {p.name}
                  </SelectItem>
                ))}
                {layoutPresetId === "custom" && (
                  <SelectItem value="custom" className="text-xs font-mono text-primary">
                    Custom Layout
                  </SelectItem>
                )}
              </SelectContent>
            </Select>

            <button
              type="button"
              onClick={() => setIsLayoutEdit(e => !e)}
              className={`flex items-center justify-center w-8 h-8 rounded-md border transition-all ${
                isLayoutEdit
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-border bg-secondary/70 text-muted-foreground hover:text-primary hover:border-primary/50"
              }`}
              aria-pressed={isLayoutEdit}
              title={isLayoutEdit ? "Finish editing layout cells" : "Customise layout cells"}
            >
              <Pencil size={13} />
            </button>
          </div>
        </div>

        {/* Share URL & Saved Lessons */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] font-sans font-medium text-muted-foreground uppercase tracking-wider">Save</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCopyShareUrl}
              className={`flex items-center gap-1 px-2 h-8 rounded-md border text-xs font-mono transition-all ${
                shareCopied
                  ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-400"
                  : "border-border bg-secondary/70 text-muted-foreground hover:text-primary hover:border-primary/50"
              }`}
              title="Copy shareable link with key, layout, phrase & fingerings"
            >
              {shareCopied ? <Check size={12} /> : <Share2 size={12} />}
              <span className="hidden md:inline">{shareCopied ? "Copied" : "Share"}</span>
            </button>

            <Popover open={lessonsOpen} onOpenChange={setLessonsOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={`flex items-center gap-1 px-2 h-8 rounded-md border text-xs font-mono transition-all ${
                    lessonsOpen
                      ? "border-primary/60 bg-primary/15 text-primary"
                      : "border-border bg-secondary/70 text-muted-foreground hover:text-primary hover:border-primary/50"
                  }`}
                  title="Save or load local lessons"
                >
                  <Bookmark size={12} />
                  <span className="hidden md:inline">Lessons</span>
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-3 bg-card border-border">
                <div className="flex flex-col gap-2.5">
                  <div className="text-xs font-sans font-semibold text-foreground">
                    Saved Lessons &amp; Presets
                  </div>
                  <form onSubmit={handleSaveLesson} className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={lessonName}
                      onChange={e => setLessonName(e.target.value)}
                      placeholder="Lesson title..."
                      className="flex-1 h-7 px-2 rounded border border-border bg-secondary/60 text-xs font-sans text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                    />
                    <button
                      type="submit"
                      disabled={!lessonName.trim()}
                      className="h-7 px-2.5 rounded border border-primary/50 bg-primary/15 text-primary text-xs font-mono hover:bg-primary/25 disabled:opacity-40"
                    >
                      Save
                    </button>
                  </form>

                  <div className="max-h-48 overflow-y-auto flex flex-col gap-1">
                    {savedLessons.length === 0 ? (
                      <div className="text-[11px] font-sans text-muted-foreground py-2 text-center">
                        No saved lessons yet.
                      </div>
                    ) : (
                      savedLessons.map(entry => (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-secondary/40 hover:bg-secondary/70 transition-colors"
                        >
                          <button
                            type="button"
                            onClick={() => handleLoadLesson(entry)}
                            className="flex-1 text-left text-xs font-sans text-foreground truncate hover:text-primary"
                            title={`Load "${entry.name}"`}
                          >
                            {entry.name}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLesson(entry.id)}
                            className="text-muted-foreground hover:text-destructive p-0.5 shrink-0"
                            title="Delete saved lesson"
                            aria-label={`Delete ${entry.name}`}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Clear notes */}
        {(activeNotes.size > 0 || isHoldEnabled) && (
          <button
            onClick={clearNotes}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded-md border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all"
            title="Cancel hold and clear all notes (Esc)"
          >
            <Trash2 size={12} />
            <span>Clear</span>
            <kbd className="text-[9px] opacity-75">Esc</kbd>
          </button>
        )}

        {/* MIDI & Phrase Settings */}
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className={`flex items-center gap-1 px-2 h-8 rounded-md border text-xs font-mono transition-all shrink-0 ${
            settingsOpen
              ? "border-primary/60 bg-primary/15 text-primary"
              : "border-border bg-secondary/70 text-muted-foreground hover:text-primary hover:border-primary/50"
          }`}
          title="MIDI settings, pedal bindings & shortcuts"
          aria-label="Open MIDI & Phrase Settings"
        >
          <Settings size={13} />
          <span className="hidden lg:inline">Settings</span>
        </button>

        {/* Local MIDI indicator (hidden when embedded in Stage, which owns central MIDI) */}
        {!isStageEmbedded && (
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-secondary/60 transition-colors shrink-0"
            title="Configure MIDI device & bindings"
          >
            <div className={`w-2 h-2 rounded-full ${
              midiState.isConnected
                ? "bg-emerald-400 animate-pulse"
                : midiState.isSupported
                  ? "bg-amber-400"
                  : "bg-rose-500"
            }`} />
            <span className="text-[10px] font-mono text-muted-foreground hidden sm:inline">
              {midiState.isConnected ? midiState.deviceName : "No MIDI"}
            </span>
          </button>
        )}
      </header>

      {/* Phrase / Sequence Stepper Bar */}
      <PhraseBar onOpenMidiSettings={() => setSettingsOpen(true)} />

      {/* Mobile workspace deck (< 768px) */}
      <div className="flex-1 min-h-0 flex flex-col md:hidden">
        <MobileWorkspaceDeck isEditMode={isLayoutEdit} />
      </div>

      {/* Tablet & Desktop main content */}
      <main className="hidden md:flex flex-1 overflow-y-auto p-3 md:p-4 flex-col gap-3 md:gap-4 min-h-0">
        <div className="xl:flex-1 xl:min-h-0 flex flex-col">
          <FlexLayoutRenderer
            node={layoutRoot}
            isEditMode={isLayoutEdit}
            canDelete={countCells(layoutRoot) > 1}
            onSwitchModule={(cellId, mod) => setCustomLayout(updateCellModule(layoutRoot, cellId, mod))}
            onSplitCell={(cellId, dir, newModule) =>
              setCustomLayout(splitCellNode(layoutRoot, cellId, dir, newModule))
            }
            onRemoveCell={(cellId) => {
              const next = removeCellNode(layoutRoot, cellId);
              if (next) setCustomLayout(next);
            }}
          />
        </div>

        {/* Footer (hidden when embedded inside Muso Stage) */}
        {!isStageEmbedded && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-sans text-muted-foreground pt-2 border-t border-border shrink-0">
            <span>© Midlife Muso · Ear-First Guitar &amp; Piano Coaching</span>
            <div className="flex flex-wrap items-center gap-3 font-mono">
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
      </main>

      <MobileControlsDrawer
        open={mobileControlsOpen}
        onOpenChange={setMobileControlsOpen}
        onOpenMidiSettings={() => setSettingsOpen(true)}
        savedLessons={savedLessons}
        onSaveLesson={saveLessonByName}
        onLoadLesson={handleLoadLesson}
        onDeleteLesson={handleDeleteLesson}
        onCopyShareUrl={handleCopyShareUrl}
        shareCopied={shareCopied}
      />

      <SettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}

const Index = () => (
  <HarmonicProvider>
    <MainContent />
  </HarmonicProvider>
);

export default Index;
