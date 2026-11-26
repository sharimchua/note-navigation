import { useEffect } from "react";
import { useHarmonic } from "@/contexts/HarmonicContext";
import {
  MIDI_BINDING_ACTIONS,
  MIDI_CC_PRESETS,
  formatMidiTrigger,
  type MidiTrigger,
} from "@/lib/midi-bindings";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sliders, Radio, X, RotateCcw, Keyboard, Footprints } from "lucide-react";

interface SettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function triggerToSelectValue(trigger: MidiTrigger | null): string {
  if (!trigger) return "__none__";
  if (trigger.type === "cc") return `cc:${trigger.cc}`;
  return `note:${trigger.midi}`;
}

export function SettingsDrawer({ open, onOpenChange }: SettingsDrawerProps) {
  const {
    midiState,
    midiSettings,
    midiLearnAction,
    lastMidiActivity,
    updateMidiSettings,
    setMidiBinding,
    resetMidiSettings,
    startMidiLearn,
    cancelMidiLearn,
  } = useHarmonic();

  useEffect(() => {
    if (!open && midiLearnAction) {
      cancelMidiLearn();
    }
  }, [open, midiLearnAction, cancelMidiLearn]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && midiLearnAction) {
      cancelMidiLearn();
    }
    onOpenChange(nextOpen);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md bg-card border-l border-border p-0 flex flex-col overflow-hidden"
      >
        <SheetHeader className="px-5 py-4 border-b border-border shrink-0 text-left">
          <div className="flex items-center gap-2">
            <Sliders size={16} className="text-primary" />
            <SheetTitle className="text-sm font-sans font-bold text-foreground">
              MIDI &amp; Phrase Settings
            </SheetTitle>
          </div>
          <SheetDescription className="text-[11px] font-sans text-muted-foreground">
            Configure hardware MIDI input, sticky phrase capture, pedal bindings, and shortcuts.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6 text-xs">
          {/* 1. MIDI Connection & Device */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-sans font-semibold text-[11px] uppercase tracking-wider text-foreground">
                <Radio size={13} className="text-primary" />
                <span>MIDI Input Device</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                  midiState.isConnected
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                    : midiState.isSupported
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                      : "border-rose-500/40 bg-rose-500/10 text-rose-400"
                }`}
              >
                {midiState.isConnected
                  ? midiState.deviceName || "Connected"
                  : midiState.isSupported
                    ? "No MIDI device"
                    : "Web MIDI unsupported"}
              </span>
            </div>

            <div className="space-y-1.5 bg-secondary/40 border border-border rounded-lg p-3">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Active Controller
              </label>
              <Select
                value={midiSettings.selectedDeviceId}
                onValueChange={(value) => updateMidiSettings({ selectedDeviceId: value })}
              >
                <SelectTrigger className="w-full h-8 text-xs font-mono bg-card border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs font-mono">
                    All Connected MIDI Devices
                  </SelectItem>
                  {midiState.devices.map((dev) => (
                    <SelectItem key={dev.id} value={dev.id} className="text-xs font-mono">
                      {dev.name}
                      {dev.manufacturer ? ` (${dev.manufacturer})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center justify-between pt-1 text-[10px] font-mono text-muted-foreground">
                <span>Live Monitor</span>
                <span className="text-foreground/90">
                  {lastMidiActivity ? `Last MIDI: ${lastMidiActivity}` : "Waiting for input..."}
                </span>
              </div>
            </div>
          </section>

          {/* 2. Phrase MIDI Capture */}
          <section className="space-y-3">
            <div className="font-sans font-semibold text-[11px] uppercase tracking-wider text-foreground">
              Phrase MIDI Capture
            </div>

            <div className="bg-secondary/40 border border-border rounded-lg p-3 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-xs font-sans font-medium text-foreground">
                    Sticky Phrase Capture
                  </div>
                  <p className="text-[11px] font-sans text-muted-foreground leading-snug">
                    Keep MIDI notes in the active step when keys are released. Playing after a pause
                    overwrites the step; holding keys or playing within the window builds chords.
                  </p>
                </div>
                <Switch
                  checked={midiSettings.phraseStickyMidi}
                  onCheckedChange={(checked) => updateMidiSettings({ phraseStickyMidi: checked })}
                  aria-label="Toggle Sticky Phrase Capture"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-border/70">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-sans text-muted-foreground">
                    Chord / Overwrite Pause Window
                  </span>
                  <span className="font-mono text-primary font-semibold">
                    {midiSettings.phraseOverwritePauseMs} ms
                  </span>
                </div>
                <Slider
                  min={100}
                  max={1500}
                  step={50}
                  disabled={!midiSettings.phraseStickyMidi}
                  value={[midiSettings.phraseOverwritePauseMs]}
                  onValueChange={([val]) => {
                    if (typeof val === "number") {
                      updateMidiSettings({ phraseOverwritePauseMs: val });
                    }
                  }}
                />
                <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                  <span>100 ms (snappy replace)</span>
                  <span>1500 ms (slow arpeggio)</span>
                </div>
              </div>
            </div>
          </section>

          {/* 3. MIDI Pedal & Key Bindings */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-sans font-semibold text-[11px] uppercase tracking-wider text-foreground">
                <Footprints size={13} className="text-primary" />
                <span>MIDI Bindings</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted-foreground">
                  {midiSettings.enabled ? "Enabled" : "Disabled"}
                </span>
                <Switch
                  checked={midiSettings.enabled}
                  onCheckedChange={(checked) => updateMidiSettings({ enabled: checked })}
                  aria-label="Enable MIDI Bindings"
                />
              </div>
            </div>

            <div className="space-y-2">
              {MIDI_BINDING_ACTIONS.map((action) => {
                const trigger = midiSettings.bindings[action.id];
                const isLearning = midiLearnAction === action.id;
                const selectVal = triggerToSelectValue(trigger);
                const isPresetOrEmpty =
                  !trigger ||
                  (trigger.type === "cc" && MIDI_CC_PRESETS.some((p) => p.cc === trigger.cc));

                return (
                  <div
                    key={action.id}
                    className={`rounded-lg border p-2.5 space-y-2 transition-colors ${
                      action.id === "phraseStepForwardOrAdd"
                        ? "border-primary/40 bg-primary/5"
                        : "border-border bg-secondary/35"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-sans font-semibold text-foreground truncate">
                            {action.label}
                          </span>
                          {action.keyboardHint && (
                            <kbd className="px-1 py-0.5 rounded bg-card border border-border text-[9px] font-mono text-muted-foreground">
                              {action.keyboardHint}
                            </kbd>
                          )}
                        </div>
                        <p className="text-[10px] font-sans text-muted-foreground leading-snug">
                          {action.description}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                          trigger
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border bg-card text-muted-foreground"
                        }`}
                      >
                        {formatMidiTrigger(trigger)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Select
                        value={selectVal}
                        onValueChange={(val) => {
                          if (val === "__none__") {
                            setMidiBinding(action.id, null);
                          } else if (val.startsWith("cc:")) {
                            const cc = parseInt(val.slice(3), 10);
                            if (Number.isFinite(cc)) {
                              setMidiBinding(action.id, { type: "cc", cc });
                            }
                          }
                        }}
                      >
                        <SelectTrigger className="flex-1 h-7 text-[11px] font-mono bg-card border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__" className="text-[11px] font-mono text-muted-foreground">
                            Unbound
                          </SelectItem>
                          {MIDI_CC_PRESETS.map((preset) => (
                            <SelectItem
                              key={preset.cc}
                              value={`cc:${preset.cc}`}
                              className="text-[11px] font-mono"
                            >
                              {preset.label}
                            </SelectItem>
                          ))}
                          {!isPresetOrEmpty && trigger && (
                            <SelectItem value={selectVal} className="text-[11px] font-mono text-primary">
                              {formatMidiTrigger(trigger)}
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>

                      <button
                        type="button"
                        onClick={() => (isLearning ? cancelMidiLearn() : startMidiLearn(action.id))}
                        className={`h-7 px-2.5 rounded border text-[11px] font-mono transition-colors shrink-0 ${
                          isLearning
                            ? "border-amber-400/70 bg-amber-500/20 text-amber-200 animate-pulse"
                            : "border-border bg-card text-foreground hover:border-primary/50 hover:text-primary"
                        }`}
                      >
                        {isLearning ? "Press pedal/key..." : "Learn"}
                      </button>

                      {trigger && (
                        <button
                          type="button"
                          onClick={() => setMidiBinding(action.id, null)}
                          className="h-7 w-7 flex items-center justify-center rounded border border-border bg-card text-muted-foreground hover:text-destructive hover:border-destructive/50 shrink-0"
                          title={`Clear ${action.label} binding`}
                          aria-label={`Clear ${action.label} binding`}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={resetMidiSettings}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-border bg-card text-[11px] font-mono text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
              >
                <RotateCcw size={11} />
                <span>Reset MIDI Defaults</span>
              </button>
            </div>
          </section>

          {/* 4. Keyboard Shortcuts Reference */}
          <section className="space-y-2.5 pb-4">
            <div className="flex items-center gap-1.5 font-sans font-semibold text-[11px] uppercase tracking-wider text-foreground">
              <Keyboard size={13} className="text-primary" />
              <span>Keyboard Shortcuts</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-secondary/35 border border-border rounded-lg p-3 text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Toggle Hold</span>
                <kbd className="px-1.5 py-0.5 rounded bg-card border border-border font-mono text-[10px]">H</kbd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Clear / Cancel Learn</span>
                <kbd className="px-1.5 py-0.5 rounded bg-card border border-border font-mono text-[10px]">Esc</kbd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Prev / Next Step</span>
                <kbd className="px-1.5 py-0.5 rounded bg-card border border-border font-mono text-[10px]">← / →</kbd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Forward / Add Step</span>
                <kbd className="px-1.5 py-0.5 rounded bg-card border border-border font-mono text-[10px]">Enter</kbd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Insert Blank Step</span>
                <kbd className="px-1.5 py-0.5 rounded bg-card border border-border font-mono text-[10px]">N / +</kbd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Duplicate Step</span>
                <kbd className="px-1.5 py-0.5 rounded bg-card border border-border font-mono text-[10px]">D</kbd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Play / Stop Phrase</span>
                <kbd className="px-1.5 py-0.5 rounded bg-card border border-border font-mono text-[10px]">Space</kbd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Remove Step</span>
                <kbd className="px-1.5 py-0.5 rounded bg-card border border-border font-mono text-[10px]">Del</kbd>
              </div>
              <div className="flex items-center justify-between gap-2 sm:col-span-2 pt-1 border-t border-border/60">
                <span className="text-muted-foreground">Cycle Finger Override (Piano / Guitar)</span>
                <kbd className="px-1.5 py-0.5 rounded bg-card border border-border font-mono text-[10px]">Alt + Click</kbd>
              </div>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
