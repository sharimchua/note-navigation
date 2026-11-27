import React, { useEffect, useMemo, useState } from "react";
import { useHarmonic } from "@/contexts/HarmonicContext";
import { MODULE_COMPONENTS } from "@/components/CellFrame";
import { FlexLayoutRenderer } from "@/components/FlexLayoutRenderer";
import {
  countCells,
  removeCellNode,
  splitCellNode,
  updateCellModule,
  type LayoutNode,
  type NoteNavModuleType,
} from "@/lib/layout-models";
import { Rows, Square, Layers } from "lucide-react";

export type MobileDeckMode = "split" | "single" | "stack";

const ALL_MODULES: NoteNavModuleType[] = [
  "staff",
  "piano",
  "fretboard",
  "pitch-clock",
  "piano-triangles",
  "linear",
  "spectrum",
];

const MOBILE_MODULE_LABEL: Record<NoteNavModuleType, string> = {
  staff: "Staff",
  piano: "Piano",
  fretboard: "Fretboard",
  "pitch-clock": "Clock",
  "piano-triangles": "Triangles",
  linear: "Linear",
  spectrum: "Overtones",
};

const STORAGE_KEY = "note_navigation_mobile_deck_v1";

function collectModulesFromLayout(node: LayoutNode): NoteNavModuleType[] {
  if (node.type === "cell") return [node.module];
  const seen = new Set<NoteNavModuleType>();
  const list: NoteNavModuleType[] = [];
  const walk = (n: LayoutNode) => {
    if (n.type === "cell") {
      if (!seen.has(n.module)) {
        seen.add(n.module);
        list.push(n.module);
      }
      return;
    }
    n.children.forEach(walk);
  };
  walk(node);
  return list;
}

function defaultPairForPreset(presetId: string, root: LayoutNode): {
  top: NoteNavModuleType;
  bottom: NoteNavModuleType;
} {
  if (presetId === "guitar-studio") {
    return { top: "staff", bottom: "fretboard" };
  }
  if (presetId === "piano-studio") {
    return { top: "staff", bottom: "piano" };
  }
  if (presetId === "full-ppt") {
    return { top: "pitch-clock", bottom: "piano" };
  }
  if (presetId === "classic") {
    return { top: "staff", bottom: "piano" };
  }
  const mods = collectModulesFromLayout(root);
  return {
    top: mods[0] ?? "staff",
    bottom: mods[1] ?? (mods[0] === "piano" ? "fretboard" : "piano"),
  };
}

interface PersistedDeckState {
  mode: MobileDeckMode;
  top: NoteNavModuleType;
  bottom: NoteNavModuleType;
}

function loadDeckState(presetId: string, root: LayoutNode): PersistedDeckState {
  const fallback = defaultPairForPreset(presetId, root);
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedDeckState>;
        const mode: MobileDeckMode =
          parsed.mode === "split" || parsed.mode === "single" || parsed.mode === "stack"
            ? parsed.mode
            : "split";
        const top =
          parsed.top && ALL_MODULES.includes(parsed.top) ? parsed.top : fallback.top;
        const bottom =
          parsed.bottom && ALL_MODULES.includes(parsed.bottom) ? parsed.bottom : fallback.bottom;
        return { mode, top, bottom };
      }
    } catch {
      // ignore storage errors
    }
  }
  return { mode: "split", top: fallback.top, bottom: fallback.bottom };
}

interface ModuleTabStripProps {
  orderedModules: NoteNavModuleType[];
  activeModule: NoteNavModuleType;
  presetModules: Set<NoteNavModuleType>;
  onSelect: (mod: NoteNavModuleType) => void;
  rightSlot?: React.ReactNode;
  ariaLabel: string;
}

function ModuleTabStrip({
  orderedModules,
  activeModule,
  presetModules,
  onSelect,
  rightSlot,
  ariaLabel,
}: ModuleTabStripProps) {
  return (
    <div className="flex items-center justify-between gap-1.5 shrink-0 min-w-0">
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 min-w-0 flex-1"
      >
        {orderedModules.map(mod => {
          const active = mod === activeModule;
          const inPreset = presetModules.has(mod);
          return (
            <button
              key={mod}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(mod)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-mono leading-none whitespace-nowrap border transition-colors shrink-0 touch-manipulation ${
                active
                  ? "bg-primary/20 border-primary/60 text-primary font-bold shadow-sm"
                  : inPreset
                    ? "bg-card/85 border-border text-foreground/90 hover:text-foreground"
                    : "bg-secondary/40 border-border/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {MOBILE_MODULE_LABEL[mod]}
            </button>
          );
        })}
      </div>
      {rightSlot}
    </div>
  );
}

interface MobileWorkspaceDeckProps {
  isEditMode: boolean;
}

export function MobileWorkspaceDeck({ isEditMode }: MobileWorkspaceDeckProps) {
  const { layoutPresetId, layoutRoot, setCustomLayout, isStageEmbedded } = useHarmonic();

  const [deckState, setDeckState] = useState<PersistedDeckState>(() =>
    loadDeckState(layoutPresetId, layoutRoot)
  );
  const [lastPresetId, setLastPresetId] = useState<string>(layoutPresetId);

  useEffect(() => {
    if (layoutPresetId !== lastPresetId) {
      setLastPresetId(layoutPresetId);
      const nextPair = defaultPairForPreset(layoutPresetId, layoutRoot);
      setDeckState(prev => ({
        ...prev,
        top: nextPair.top,
        bottom: nextPair.bottom,
      }));
    }
  }, [layoutPresetId, lastPresetId, layoutRoot]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(deckState));
    } catch {
      // ignore storage errors
    }
  }, [deckState]);

  const presetModulesList = useMemo(() => collectModulesFromLayout(layoutRoot), [layoutRoot]);
  const presetModulesSet = useMemo(() => new Set(presetModulesList), [presetModulesList]);

  const orderedModules = useMemo(() => {
    const rest = ALL_MODULES.filter(m => !presetModulesSet.has(m));
    return [...presetModulesList, ...rest];
  }, [presetModulesList, presetModulesSet]);

  const modeSwitcher = (
    <div
      className="flex items-center bg-card border border-border rounded-md p-0.5 shrink-0"
      role="group"
      aria-label="Mobile view layout mode"
    >
      <button
        type="button"
        onClick={() => setDeckState(s => ({ ...s, mode: "split" }))}
        className={`flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-mono transition-colors touch-manipulation ${
          deckState.mode === "split"
            ? "bg-primary/20 text-primary font-semibold"
            : "text-muted-foreground hover:text-foreground"
        }`}
        title="Split view (2 active modules)"
        aria-pressed={deckState.mode === "split"}
      >
        <Rows size={12} />
        <span>Split</span>
      </button>
      <button
        type="button"
        onClick={() => setDeckState(s => ({ ...s, mode: "single" }))}
        className={`flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-mono transition-colors touch-manipulation ${
          deckState.mode === "single"
            ? "bg-primary/20 text-primary font-semibold"
            : "text-muted-foreground hover:text-foreground"
        }`}
        title="Single maximised module"
        aria-pressed={deckState.mode === "single"}
      >
        <Square size={11} />
        <span>1x</span>
      </button>
      <button
        type="button"
        onClick={() => setDeckState(s => ({ ...s, mode: "stack" }))}
        className={`flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-mono transition-colors touch-manipulation ${
          deckState.mode === "stack"
            ? "bg-primary/20 text-primary font-semibold"
            : "text-muted-foreground hover:text-foreground"
        }`}
        title="Stack all preset cells vertically"
        aria-pressed={deckState.mode === "stack"}
      >
        <Layers size={12} />
        <span>All</span>
      </button>
    </div>
  );

  if (deckState.mode === "stack") {
    return (
      <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2.5 min-h-0">
        <div className="flex items-center justify-between gap-2 shrink-0">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            All Preset Views ({presetModulesList.length})
          </span>
          {modeSwitcher}
        </div>

        <FlexLayoutRenderer
          node={layoutRoot}
          isEditMode={isEditMode}
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

        {!isStageEmbedded && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-sans text-muted-foreground pt-2 pb-1 border-t border-border shrink-0">
            <span>© Midlife Muso</span>
            <div className="flex items-center gap-3 font-mono">
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
                Learning
              </a>
            </div>
          </div>
        )}
      </div>
    );
  }

  const TopComp = MODULE_COMPONENTS[deckState.top];
  const BottomComp = MODULE_COMPONENTS[deckState.bottom];

  if (deckState.mode === "single") {
    return (
      <div className="flex-1 min-h-0 flex flex-col gap-1.5 p-2 overflow-hidden">
        <ModuleTabStrip
          orderedModules={orderedModules}
          activeModule={deckState.top}
          presetModules={presetModulesSet}
          onSelect={(mod) => setDeckState(s => ({ ...s, top: mod }))}
          rightSlot={modeSwitcher}
          ariaLabel="Active module view"
        />
        <div className="flex-1 min-h-0 flex flex-col">
          <TopComp />
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-split-deck flex-1 min-h-0 flex flex-col gap-2 p-2 overflow-hidden">
      <div className="flex-1 min-h-0 min-w-0 flex flex-col gap-1" style={{ flexGrow: 10 }}>
        <ModuleTabStrip
          orderedModules={orderedModules}
          activeModule={deckState.top}
          presetModules={presetModulesSet}
          onSelect={(mod) => setDeckState(s => ({ ...s, top: mod }))}
          rightSlot={modeSwitcher}
          ariaLabel="Upper pane module"
        />
        <div className="flex-1 min-h-0 flex flex-col">
          <TopComp />
        </div>
      </div>

      <div className="flex-1 min-h-0 min-w-0 flex flex-col gap-1" style={{ flexGrow: 11 }}>
        <ModuleTabStrip
          orderedModules={orderedModules}
          activeModule={deckState.bottom}
          presetModules={presetModulesSet}
          onSelect={(mod) => setDeckState(s => ({ ...s, bottom: mod }))}
          ariaLabel="Lower pane module"
        />
        <div className="flex-1 min-h-0 flex flex-col">
          <BottomComp />
        </div>
      </div>
    </div>
  );
}
