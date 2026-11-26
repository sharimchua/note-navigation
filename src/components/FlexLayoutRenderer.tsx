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
    const minH = isInColumn ? Math.max(node.minSize ?? 90, 90) : 120;
    const minW = !isInColumn && node.minSize ? `${node.minSize}px` : undefined;
    return (
      <div
        className="layout-flex-node relative min-w-0 min-h-0 flex flex-col"
        style={{
          ["--node-flex" as string]: node.flex ?? 1,
          minWidth: minW,
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
      className={`layout-flex-node relative w-full h-full flex min-w-0 min-h-0 ${
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
