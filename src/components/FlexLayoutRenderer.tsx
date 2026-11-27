import React from "react";
import type {
  LayoutFlexDirection,
  LayoutNode,
  NoteNavModuleType,
} from "@/lib/layout-models";
import { CellFrame } from "@/components/CellFrame";

interface FlexLayoutRendererProps {
  node: LayoutNode;
  parentDirection?: LayoutFlexDirection;
  isEditMode: boolean;
  canDelete: boolean;
  onSwitchModule: (cellId: string, nextModule: NoteNavModuleType) => void;
  onSplitCell: (cellId: string, direction: LayoutFlexDirection, newModule: NoteNavModuleType) => void;
  onRemoveCell: (cellId: string) => void;
}

const MODULE_MIN_HEIGHT: Record<NoteNavModuleType, number> = {
  staff: 220,
  "pitch-clock": 220,
  fretboard: 190,
  piano: 170,
  spectrum: 165,
  "piano-triangles": 155,
  linear: 96,
};

export const FlexLayoutRenderer: React.FC<FlexLayoutRendererProps> = ({
  node,
  parentDirection,
  isEditMode,
  canDelete,
  onSwitchModule,
  onSplitCell,
  onRemoveCell,
}) => {
  if (node.type === "cell") {
    const isInColumn = parentDirection === "column";
    const baseMinH = MODULE_MIN_HEIGHT[node.module] ?? 120;
    const minH = isInColumn ? Math.max(node.minSize ?? baseMinH, baseMinH) : baseMinH;
    const minW = !isInColumn && node.minSize ? `${node.minSize}px` : "0px";
    return (
      <div
        className="layout-flex-node xl-cell-min-w relative min-w-0 min-h-0 flex flex-col"
        style={{
          ["--node-flex" as string]: node.flex ?? 1,
          ["--cell-min-w" as string]: minW,
          minHeight: `${minH}px`,
        }}
      >
        <CellFrame
          cell={node}
          isEditMode={isEditMode}
          canDelete={canDelete}
          onSwitchModule={onSwitchModule}
          onSplitCell={onSplitCell}
          onRemoveCell={onRemoveCell}
        />
      </div>
    );
  }

  const isRow = node.direction === "row";
  return (
    <div
      className={`layout-flex-node relative w-full h-auto xl:h-full flex min-w-0 min-h-0 ${
        isRow ? "flex-col xl:flex-row" : "flex-col"
      }`}
      style={{
        ["--node-flex" as string]: node.flex ?? 1,
        gap: `${node.gap ?? 10}px`,
      }}
    >
      {node.children.map(child => (
        <FlexLayoutRenderer
          key={child.id}
          node={child}
          parentDirection={node.direction}
          isEditMode={isEditMode}
          canDelete={canDelete}
          onSwitchModule={onSwitchModule}
          onSplitCell={onSplitCell}
          onRemoveCell={onRemoveCell}
        />
      ))}
    </div>
  );
};
