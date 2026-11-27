import { useHarmonic } from "@/contexts/HarmonicContext";
import { formatMidiTrigger } from "@/lib/midi-bindings";
import type { GuitarRightHandMode, PhraseMidiMode, PianoComfortSpan } from "@/lib/phrase-model";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Copy,
  Trash2,
  Circle,
  Play,
  Square,
  Hand,
  ArrowRight,
  RotateCcw,
  Footprints,
  Repeat,
  Sparkles,
  MoreHorizontal,
} from "lucide-react";

interface PhraseBarProps {
  onOpenMidiSettings?: () => void;
}

const MIDI_MODE_LABELS: { id: PhraseMidiMode; label: string; title: string }[] = [
  { id: "capture", label: "Write", title: "MIDI writes/overwrites notes in the active step" },
  { id: "play-over", label: "Demo", title: "Play MIDI over the saved chord without modifying it" },
  { id: "off", label: "Off", title: "Ignore MIDI note input (pedal bindings still work)" },
];

export function PhraseBar({ onOpenMidiSettings }: PhraseBarProps = {}) {
  const {
    phraseMode,
    phraseOnsets,
    activeStepIndex,
    loopPhrase,
    isRecordingPhrase,
    isPlayingPhrase,
    showFingering,
    showNextPreview,
    guitarRightHandMode,
    pianoComfortSpan,
    midiSettings,
    setActiveStepIndex,
    setLoopPhrase,
    stepPrev,
    stepForwardOrAdd,
    addPhraseStep,
    duplicatePhraseStep,
    removePhraseStep,
    clearPhrase,
    setRecordingPhrase,
    playPhrase,
    stopPhrasePlayback,
    setShowFingering,
    setShowNextPreview,
    setGuitarRightHandMode,
    setPianoComfortSpan,
    setPhraseMidiMode,
    setPhraseAutoAdvance,
  } = useHarmonic();

  if (!phraseMode) return null;

  const stepForwardTrigger = midiSettings.bindings.phraseStepForwardOrAdd;
  const hasActiveStepBinding = midiSettings.enabled && Boolean(stepForwardTrigger);
  const stepForwardBadge = hasActiveStepBinding
    ? stepForwardTrigger?.type === "cc" && stepForwardTrigger.cc === 67
      ? "MIDI: Left Pedal"
      : `MIDI: ${formatMidiTrigger(stepForwardTrigger)}`
    : "MIDI Bindings";

  return (
    <>
      {/* Mobile compact 1-row Phrase transport */}
      <div className="md:hidden flex items-center gap-1.5 px-2.5 py-1.5 border-b border-border bg-secondary/40 shrink-0">
        {/* Stepper transport */}
        <div className="flex items-center gap-0.5 bg-card border border-border rounded px-0.5 py-0.5 min-w-0">
          <button
            type="button"
            onClick={stepPrev}
            disabled={activeStepIndex <= 0 && !(loopPhrase && phraseOnsets.length > 1)}
            className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed touch-manipulation"
            aria-label="Previous phrase step"
          >
            <ChevronLeft size={14} />
          </button>

          <div className="flex items-center gap-1 px-0.5 max-w-[124px] overflow-x-auto no-scrollbar">
            {phraseOnsets.map((onset, idx) => {
              const active = idx === activeStepIndex;
              const count = onset.notes.length;
              return (
                <button
                  key={onset.id}
                  type="button"
                  onClick={() => setActiveStepIndex(idx, true)}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-mono transition-colors shrink-0 touch-manipulation ${
                    active
                      ? "bg-primary text-primary-foreground font-bold"
                      : count > 0
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground"
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={stepForwardOrAdd}
            className="p-1 rounded text-muted-foreground hover:text-foreground touch-manipulation"
            aria-label="Next phrase step or add step"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => (isPlayingPhrase ? stopPhrasePlayback() : playPhrase())}
          className={`flex items-center gap-1 px-2 h-7 rounded border text-[11px] font-mono transition-colors shrink-0 touch-manipulation ${
            isPlayingPhrase
              ? "border-primary/60 bg-primary/15 text-primary font-semibold"
              : "border-border bg-card text-foreground"
          }`}
          aria-label={isPlayingPhrase ? "Stop phrase" : "Play phrase"}
        >
          {isPlayingPhrase ? <Square size={11} /> : <Play size={11} />}
          <span>{isPlayingPhrase ? "Stop" : "Play"}</span>
        </button>

        <button
          type="button"
          onClick={addPhraseStep}
          className="flex items-center gap-0.5 px-2 h-7 rounded border border-border bg-card text-[11px] font-mono text-foreground shrink-0 touch-manipulation"
          aria-label="Add blank step"
          title="Insert blank step"
        >
          <Plus size={12} />
          <span>Step</span>
        </button>

        <div className="flex-1 min-w-0" />

        <button
          type="button"
          onClick={() => setShowFingering(!showFingering)}
          className={`flex items-center justify-center w-7 h-7 rounded border transition-colors shrink-0 touch-manipulation ${
            showFingering
              ? "border-primary/60 bg-primary/15 text-primary"
              : "border-border bg-card text-muted-foreground"
          }`}
          aria-label="Toggle fingering"
          title="Toggle fingerings"
        >
          <Hand size={13} />
        </button>

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex items-center justify-center w-7 h-7 rounded border border-border bg-card text-muted-foreground hover:text-foreground shrink-0 touch-manipulation"
              aria-label="More phrase options"
              title="Phrase tools, loop, MIDI capture & fingering options"
            >
              <MoreHorizontal size={14} />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-3 bg-card border-border space-y-3 text-xs">
            <div className="font-sans font-semibold text-foreground">Phrase Tools</div>

            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={duplicatePhraseStep}
                className="flex items-center justify-center gap-1 py-1.5 rounded border border-border bg-secondary/40 text-[11px] font-mono text-foreground"
              >
                <Copy size={11} />
                <span>Dup</span>
              </button>
              <button
                type="button"
                onClick={() => removePhraseStep()}
                className="flex items-center justify-center gap-1 py-1.5 rounded border border-border bg-secondary/40 text-[11px] font-mono text-destructive"
              >
                <Trash2 size={11} />
                <span>Del</span>
              </button>
              <button
                type="button"
                onClick={clearPhrase}
                className="flex items-center justify-center gap-1 py-1.5 rounded border border-border bg-secondary/40 text-[11px] font-mono text-muted-foreground"
              >
                <RotateCcw size={11} />
                <span>Reset</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setLoopPhrase(!loopPhrase)}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded border text-[11px] font-mono ${
                  loopPhrase
                    ? "border-primary/60 bg-primary/15 text-primary font-semibold"
                    : "border-border bg-secondary/40 text-muted-foreground"
                }`}
              >
                <Repeat size={11} />
                <span>{loopPhrase ? "Loop: ON" : "Loop: OFF"}</span>
              </button>

              <button
                type="button"
                onClick={() => setRecordingPhrase(!isRecordingPhrase)}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded border text-[11px] font-mono ${
                  isRecordingPhrase
                    ? "border-rose-500/60 bg-rose-500/15 text-rose-300 font-semibold"
                    : "border-border bg-secondary/40 text-muted-foreground"
                }`}
              >
                <Circle size={9} className={isRecordingPhrase ? "fill-rose-400 animate-pulse" : ""} />
                <span>Rec MIDI</span>
              </button>
            </div>

            <div className="space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                MIDI Input Mode
              </div>
              <div className="grid grid-cols-3 gap-1 bg-secondary/40 border border-border rounded p-0.5">
                {MIDI_MODE_LABELS.map(m => {
                  const active = midiSettings.phraseMidiMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPhraseMidiMode(m.id)}
                      className={`py-1 rounded text-[11px] font-mono ${
                        active
                          ? m.id === "play-over"
                            ? "bg-cyan-500/20 text-cyan-300 font-semibold"
                            : m.id === "off"
                              ? "bg-rose-500/20 text-rose-300 font-semibold"
                              : "bg-primary/20 text-primary font-semibold"
                          : "text-muted-foreground"
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {midiSettings.phraseMidiMode === "play-over" && (
              <button
                type="button"
                onClick={() => setPhraseAutoAdvance(!midiSettings.phraseAutoAdvance)}
                className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded border text-[11px] font-mono ${
                  midiSettings.phraseAutoAdvance
                    ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300 font-semibold"
                    : "border-border bg-secondary/40 text-muted-foreground"
                }`}
              >
                <Sparkles size={11} />
                <span>Auto-Next: {midiSettings.phraseAutoAdvance ? "ON" : "OFF"}</span>
              </button>
            )}

            <div className="space-y-2 pt-1 border-t border-border/70">
              <button
                type="button"
                onClick={() => setShowNextPreview(!showNextPreview)}
                className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded border text-[11px] font-mono ${
                  showNextPreview
                    ? "border-primary/60 bg-primary/15 text-primary font-semibold"
                    : "border-border bg-secondary/40 text-muted-foreground"
                }`}
              >
                <ArrowRight size={11} />
                <span>Next Prep: {showNextPreview ? "ON" : "OFF"}</span>
              </button>

              {showFingering && (
                <div className="grid grid-cols-2 gap-1.5">
                  <select
                    value={guitarRightHandMode}
                    onChange={(e) => setGuitarRightHandMode(e.target.value as GuitarRightHandMode)}
                    className="h-7 px-1.5 rounded border border-border bg-secondary/50 text-[11px] font-mono text-foreground"
                  >
                    <option value="off">RH: Off</option>
                    <option value="fingerstyle">RH: PIMA</option>
                    <option value="flatpick-alt">RH: Alt ↓↑</option>
                    <option value="flatpick-econ">RH: Econ ↓↑</option>
                  </select>

                  <select
                    value={pianoComfortSpan}
                    onChange={(e) => setPianoComfortSpan(Number(e.target.value) as PianoComfortSpan)}
                    className="h-7 px-1.5 rounded border border-border bg-secondary/50 text-[11px] font-mono text-foreground"
                  >
                    <option value={9}>Small (M6)</option>
                    <option value={12}>Std (Oct)</option>
                    <option value={14}>Wide (M9)</option>
                  </select>
                </div>
              )}

              {onOpenMidiSettings && (
                <button
                  type="button"
                  onClick={onOpenMidiSettings}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded border border-border bg-secondary/40 text-[11px] font-mono text-foreground"
                >
                  <Footprints size={11} />
                  <span>{stepForwardBadge}</span>
                </button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Tablet & Desktop full inline Phrase bar */}
      <div className="hidden md:flex flex-wrap items-center gap-2 px-3 py-1.5 border-b border-border bg-secondary/40 shrink-0">
      <span className="text-[10px] font-mono uppercase tracking-wider text-primary font-semibold">
        Phrase
      </span>

      {/* Stepper transport */}
      <div className="flex items-center gap-0.5 bg-card border border-border rounded px-1 py-0.5">
        <button
          type="button"
          onClick={stepPrev}
          disabled={activeStepIndex <= 0 && !(loopPhrase && phraseOnsets.length > 1)}
          className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
          title="Previous step (←)"
          aria-label="Previous phrase step"
        >
          <ChevronLeft size={13} />
        </button>

        <div className="flex items-center gap-1 px-1 max-w-[340px] overflow-x-auto no-scrollbar">
          {phraseOnsets.map((onset, idx) => {
            const active = idx === activeStepIndex;
            const count = onset.notes.length;
            return (
              <button
                key={onset.id}
                type="button"
                onClick={() => setActiveStepIndex(idx, true)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors shrink-0 ${
                  active
                    ? "bg-primary text-primary-foreground font-bold"
                    : count > 0
                      ? "bg-secondary text-foreground hover:bg-secondary/80"
                      : "text-muted-foreground hover:text-foreground"
                }`}
                title={`Step ${idx + 1}: ${count > 0 ? onset.notes.join(" ") : "empty"}`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={stepForwardOrAdd}
          className="p-1 rounded text-muted-foreground hover:text-foreground"
          title="Next step or add step (→ / Enter)"
          aria-label="Next phrase step or add step"
        >
          <ChevronRight size={13} />
        </button>
      </div>

      {/* Step CRUD */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={addPhraseStep}
          className="flex items-center gap-1 px-2 py-1 rounded border border-border bg-card text-[10px] font-mono text-foreground hover:border-primary/50 hover:text-primary transition-colors"
          title="Insert blank step after current (N or +)"
        >
          <Plus size={11} />
          <span>Step</span>
          <kbd className="text-[9px] text-muted-foreground hidden md:inline">N</kbd>
        </button>
        <button
          type="button"
          onClick={duplicatePhraseStep}
          className="flex items-center gap-1 px-2 py-1 rounded border border-border bg-card text-[10px] font-mono text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
          title="Duplicate current step (D)"
        >
          <Copy size={11} />
          <span className="hidden sm:inline">Dup</span>
          <kbd className="text-[9px] opacity-70 hidden md:inline">D</kbd>
        </button>
        <button
          type="button"
          onClick={() => removePhraseStep()}
          className="flex items-center gap-1 px-2 py-1 rounded border border-border bg-card text-[10px] font-mono text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
          title="Delete current step (Del)"
        >
          <Trash2 size={11} />
        </button>
        <button
          type="button"
          onClick={clearPhrase}
          className="flex items-center gap-1 px-2 py-1 rounded border border-border bg-card text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
          title="Reset phrase to 1 empty step"
        >
          <RotateCcw size={11} />
        </button>
      </div>

      {/* Record MIDI & Play */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setRecordingPhrase(!isRecordingPhrase)}
          className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-mono transition-colors ${
            isRecordingPhrase
              ? "border-rose-500/60 bg-rose-500/15 text-rose-300 font-semibold"
              : "border-border bg-card text-muted-foreground hover:text-foreground"
          }`}
          title="Auto-advance to a new step on each MIDI onset"
        >
          <Circle size={9} className={isRecordingPhrase ? "fill-rose-400 animate-pulse" : ""} />
          <span>Rec MIDI</span>
        </button>

        <button
          type="button"
          onClick={() => (isPlayingPhrase ? stopPhrasePlayback() : playPhrase())}
          className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-mono transition-colors ${
            isPlayingPhrase
              ? "border-primary/60 bg-primary/15 text-primary font-semibold"
              : "border-border bg-card text-muted-foreground hover:text-primary"
          }`}
          title={isPlayingPhrase ? "Stop phrase playback (Space)" : "Play phrase steps in order (Space)"}
        >
          {isPlayingPhrase ? <Square size={10} /> : <Play size={10} />}
          <span>{isPlayingPhrase ? "Stop" : "Play"}</span>
          <kbd className="text-[9px] opacity-70 hidden md:inline">Space</kbd>
        </button>

        <button
          type="button"
          onClick={() => setLoopPhrase(!loopPhrase)}
          className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-mono transition-colors ${
            loopPhrase
              ? "border-primary/60 bg-primary/15 text-primary font-semibold"
              : "border-border bg-card text-muted-foreground hover:text-foreground"
          }`}
          aria-pressed={loopPhrase}
          title="Loop phrase (wrap last step → first step for playback and transition prep)"
        >
          <Repeat size={10} />
          <span className="hidden sm:inline">Loop</span>
        </button>

        {/* MIDI Phrase Input Mode: Write / Demo (Play Over) / Off */}
        <div
          className="flex items-center bg-card border border-border rounded p-0.5 gap-0.5"
          title="MIDI input behaviour during Phrase mode"
        >
          <span className="text-[9px] font-mono text-muted-foreground px-1 hidden xl:inline">MIDI:</span>
          {MIDI_MODE_LABELS.map(m => {
            const active = midiSettings.phraseMidiMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setPhraseMidiMode(m.id)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                  active
                    ? m.id === "play-over"
                      ? "bg-cyan-500/20 text-cyan-300 font-semibold"
                      : m.id === "off"
                        ? "bg-rose-500/20 text-rose-300 font-semibold"
                        : "bg-primary/20 text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title={m.title}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {midiSettings.phraseMidiMode === "play-over" && (
          <button
            type="button"
            onClick={() => setPhraseAutoAdvance(!midiSettings.phraseAutoAdvance)}
            className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-mono transition-colors ${
              midiSettings.phraseAutoAdvance
                ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300 font-semibold"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
            aria-pressed={midiSettings.phraseAutoAdvance}
            title="Auto-advance to next step once all target chord notes are matched"
          >
            <Sparkles size={10} />
            <span>Auto-Next</span>
          </button>
        )}

        {onOpenMidiSettings && (
          <button
            type="button"
            onClick={onOpenMidiSettings}
            className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-mono transition-colors ${
              hasActiveStepBinding
                ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
            title="Configure MIDI pedal & phrase bindings"
          >
            <Footprints size={11} />
            <span className="hidden lg:inline">{stepForwardBadge}</span>
          </button>
        )}
      </div>

      <div className="flex-1" />

      {/* Ergonomic overlays: Fingering + Next-Note Lookahead */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => setShowFingering(!showFingering)}
          className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-mono transition-colors ${
            showFingering
              ? "border-primary/60 bg-primary/15 text-primary font-semibold"
              : "border-border bg-card text-muted-foreground hover:text-foreground"
          }`}
          title="Show piano (L/R 1–5) & guitar (0–4) fingerings with transition solver"
        >
          <Hand size={11} />
          <span>Fingering</span>
        </button>

        {showFingering && (
          <>
            <select
              value={guitarRightHandMode}
              onChange={(e) => setGuitarRightHandMode(e.target.value as GuitarRightHandMode)}
              className="h-6 px-1.5 rounded border border-border bg-card text-[10px] font-mono text-foreground cursor-pointer focus:outline-none focus:border-primary"
              title="Guitar right-hand picking / fingerstyle strategy"
            >
              <option value="off">RH: Off</option>
              <option value="fingerstyle">RH: PIMA</option>
              <option value="flatpick-alt">RH: Alt ↓↑</option>
              <option value="flatpick-econ">RH: Econ ↓↑</option>
            </select>

            <select
              value={pianoComfortSpan}
              onChange={(e) => setPianoComfortSpan(Number(e.target.value) as PianoComfortSpan)}
              className="h-6 px-1.5 rounded border border-border bg-card text-[10px] font-mono text-foreground cursor-pointer focus:outline-none focus:border-primary"
              title="Student piano hand comfort span"
            >
              <option value={9}>Hand: Small (M6)</option>
              <option value={12}>Hand: Std (Oct)</option>
              <option value={14}>Hand: Wide (M9)</option>
            </select>
          </>
        )}

        <button
          type="button"
          onClick={() => setShowNextPreview(!showNextPreview)}
          className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-mono transition-colors ${
            showNextPreview
              ? "border-primary/60 bg-primary/15 text-primary font-semibold"
              : "border-border bg-card text-muted-foreground hover:text-foreground"
          }`}
          title="Ghost next step notes & preparation fingers across Piano, Fretboard, Clock & Triangles"
        >
          <ArrowRight size={11} />
          <span>Next Prep</span>
        </button>
      </div>
    </div>
    </>
  );
}
