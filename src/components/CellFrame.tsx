import React from "react";
import { StaffNotation } from "@/components/StaffNotation";
import { LinearNoteMap } from "@/components/LinearNoteMap";
import { PianoKeyboard } from "@/components/PianoKeyboard";
import { GuitarFretboard } from "@/components/GuitarFretboard";
import { DissonanceSpectrum } from "@/components/DissonanceSpectrum";
import { PitchClockCell } from "@/components/PitchClockCell";
import { PianoTrianglesCell } from "@/components/PianoTrianglesCell";
import {
  MODULE_META,
  type LayoutCellNode,
  type LayoutFlexDirection,
  type NoteNavModuleType,
} from "@/lib/layout-models";
import { Columns, Rows, Trash2 } from "lucide-react";

const MODULE_COMPONENTS: Record<NoteNavModuleType, React.ComponentType> = {
  staff: StaffNotation,
  linear: LinearNoteMap,
  piano: PianoKeyboard,
  fretboard: GuitarFretboard,
  spectrum: DissonanceSpectrum,
  "pitch-clock": PitchClockCell,
  "piano-triangles": PianoTrianglesCell,
};

interface CellFrameProps {
  cell: LayoutCellNode;
  isEditMode: boolean;
  canDelete: boolean;
  onSwitchModule: (cellId: string, nextModule: NoteNavModuleType) => void;
  onSplitCell: (cellId: string, direction: LayoutFlexDirection, newModule: NoteNavModuleType) => void;
  onRemoveCell: (cellId: string) => void;
}

export function CellFrame({
  cell,
  isEditMode,
  canDelete,
  onSwitchModule,
  onSplitCell,
  onRemoveCell,
}: CellFrameProps) {
  const ModuleComp = MODULE_COMPONENTS[cell.module];

  return (
    <div className={`relative w-full h-full min-h-0 flex flex-col ${isEditMode ? "ring-1 ring-primary/40 rounded-lg" : ""}`}>
      {isEditMode && (
        <div className="flex items-center justify-between gap-1 px-2 py-1 bg-secondary/90 border-b border-border rounded-t-lg text-[10px] font-mono z-20 shrink-0">
          <select
            value={cell.module}
            onChange={(e) => onSwitchModule(cell.id, e.target.value as NoteNavModuleType)}
            className="bg-card border border-border rounded px-1.5 py-0.5 text-[10px] font-mono text-foreground cursor-pointer"
            title="Switch cell module"
          >
            {(Object.keys(MODULE_META) as NoteNavModuleType[]).map(mod => (
              <option key={mod} value={mod}>
                {MODULE_META[mod].label}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onSplitCell(cell.id, "row", "pitch-clock")}
              className="p-1 rounded bg-card border border-border text-muted-foreground hover:text-primary hover:border-primary/50"
              title="Split side-by-side"
              aria-label="Split horizontally"
            >
              <Columns size={11} />
            </button>
            <button
              type="button"
              onClick={() => onSplitCell(cell.id, "column", "piano-triangles")}
              className="p-1 rounded bg-card border border-border text-muted-foreground hover:text-primary hover:border-primary/50"
              title="Split top-and-bottom"
              aria-label="Split vertically"
            >
              <Rows size={11} />
            </button>
            {canDelete && (
              <button
                type="button"
                onClick={() => onRemoveCell(cell.id)}
                className="p-1 rounded bg-card border border-border text-muted-foreground hover:text-destructive hover:border-destructive/50"
                title="Remove cell"
                aria-label="Remove cell"
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col">
        <ModuleComp />
      </div>
    </div>
  );
}
