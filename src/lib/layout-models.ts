export type NoteNavModuleType =
  | "staff"
  | "linear"
  | "piano"
  | "fretboard"
  | "spectrum"
  | "pitch-clock"
  | "piano-triangles";

export type LayoutFlexDirection = "row" | "column";

export interface LayoutCellNode {
  id: string;
  type: "cell";
  module: NoteNavModuleType;
  flex?: number;
  minSize?: number;
  title?: string;
}

export interface LayoutContainerNode {
  id: string;
  type: "container";
  direction: LayoutFlexDirection;
  flex?: number;
  gap?: number;
  children: LayoutNode[];
}

export type LayoutNode = LayoutContainerNode | LayoutCellNode;

export interface LayoutPreset {
  id: string;
  name: string;
  description: string;
  root: LayoutNode;
}

export const MODULE_META: Record<NoteNavModuleType, { label: string; shortLabel: string }> = {
  staff: { label: "Grand Staff", shortLabel: "Staff" },
  linear: { label: "Linear Note Map", shortLabel: "Linear" },
  piano: { label: "Piano Keyboard", shortLabel: "Piano" },
  fretboard: { label: "Guitar Fretboard", shortLabel: "Fretboard" },
  spectrum: { label: "Fundamentals & Overtones", shortLabel: "Overtones" },
  "pitch-clock": { label: "Pitch Clock Rings", shortLabel: "Pitch Clock" },
  "piano-triangles": { label: "Piano Triangles Scale", shortLabel: "Triangles" },
};

export const PRESET_CLASSIC: LayoutPreset = {
  id: "classic",
  name: "Classic Tri-View",
  description: "Grand Staff paired with Linear Map, Piano, Fretboard, and Overtones",
  root: {
    id: "root-classic",
    type: "container",
    direction: "row",
    gap: 12,
    children: [
      {
        id: "cell-staff",
        type: "cell",
        module: "staff",
        flex: 4,
        minSize: 320,
        title: "Grand Staff",
      },
      {
        id: "col-instruments",
        type: "container",
        direction: "column",
        flex: 6,
        gap: 10,
        children: [
          { id: "cell-linear", type: "cell", module: "linear", flex: 1, minSize: 96, title: "Linear Note Map" },
          { id: "cell-piano", type: "cell", module: "piano", flex: 2.1, minSize: 185, title: "Piano" },
          { id: "cell-fretboard", type: "cell", module: "fretboard", flex: 2.1, minSize: 180, title: "Fretboard" },
          { id: "cell-spectrum", type: "cell", module: "spectrum", flex: 2, minSize: 165, title: "Overtones" },
        ],
      },
    ],
  },
};

export const PRESET_PIANO_STUDIO: LayoutPreset = {
  id: "piano-studio",
  name: "Piano & Triangles Studio",
  description: "Grand Staff + Pitch Clock alongside Piano Triangles & Keyboard",
  root: {
    id: "root-piano-studio",
    type: "container",
    direction: "column",
    gap: 12,
    children: [
      {
        id: "row-piano-top",
        type: "container",
        direction: "row",
        flex: 3,
        gap: 12,
        children: [
          { id: "cell-ps-staff", type: "cell", module: "staff", flex: 1.2, minSize: 300, title: "Grand Staff" },
          { id: "cell-ps-clock", type: "cell", module: "pitch-clock", flex: 1, minSize: 260, title: "Pitch Clock Rings" },
          { id: "cell-ps-triangles", type: "cell", module: "piano-triangles", flex: 1.2, minSize: 260, title: "Piano Triangles" },
        ],
      },
      {
        id: "row-piano-bottom",
        type: "container",
        direction: "row",
        flex: 2,
        gap: 12,
        children: [
          { id: "cell-ps-piano", type: "cell", module: "piano", flex: 2, minSize: 185, title: "Piano" },
          { id: "cell-ps-spectrum", type: "cell", module: "spectrum", flex: 1.2, minSize: 165, title: "Overtones" },
        ],
      },
    ],
  },
};

export const PRESET_GUITAR_STUDIO: LayoutPreset = {
  id: "guitar-studio",
  name: "Guitar Ergonomics Studio",
  description: "Grand Staff + Pitch Clock paired with Guitar Fretboard & Overtones",
  root: {
    id: "root-guitar-studio",
    type: "container",
    direction: "row",
    gap: 12,
    children: [
      { id: "cell-gs-staff", type: "cell", module: "staff", flex: 4, minSize: 300, title: "Grand Staff" },
      {
        id: "col-gs-right",
        type: "container",
        direction: "column",
        flex: 6,
        gap: 10,
        children: [
          {
            id: "row-gs-top",
            type: "container",
            direction: "row",
            flex: 2.2,
            gap: 10,
            children: [
              { id: "cell-gs-clock", type: "cell", module: "pitch-clock", flex: 1, minSize: 220, title: "Pitch Clock Rings" },
              { id: "cell-gs-spectrum", type: "cell", module: "spectrum", flex: 1.3, minSize: 180, title: "Overtones" },
            ],
          },
          { id: "cell-gs-fretboard", type: "cell", module: "fretboard", flex: 2.2, minSize: 185, title: "Fretboard" },
          { id: "cell-gs-linear", type: "cell", module: "linear", flex: 1, minSize: 96, title: "Linear Note Map" },
        ],
      },
    ],
  },
};

export const PRESET_FULL_PPT: LayoutPreset = {
  id: "full-ppt",
  name: "Full PPT Workbench",
  description: "All PPT visual cells: Staff, Pitch Clock, Piano Triangles, Piano, Fretboard & Overtones",
  root: {
    id: "root-full-ppt",
    type: "container",
    direction: "row",
    gap: 12,
    children: [
      {
        id: "col-fp-left",
        type: "container",
        direction: "column",
        flex: 4.2,
        gap: 10,
        children: [
          { id: "cell-fp-staff", type: "cell", module: "staff", flex: 2.5, minSize: 300, title: "Grand Staff" },
          { id: "cell-fp-clock", type: "cell", module: "pitch-clock", flex: 1.5, minSize: 210, title: "Pitch Clock Rings" },
        ],
      },
      {
        id: "col-fp-right",
        type: "container",
        direction: "column",
        flex: 5.8,
        gap: 10,
        children: [
          { id: "cell-fp-triangles", type: "cell", module: "piano-triangles", flex: 1.2, minSize: 135, title: "Piano Triangles" },
          { id: "cell-fp-piano", type: "cell", module: "piano", flex: 1.7, minSize: 180, title: "Piano" },
          { id: "cell-fp-fretboard", type: "cell", module: "fretboard", flex: 1.7, minSize: 180, title: "Fretboard" },
          { id: "cell-fp-spectrum", type: "cell", module: "spectrum", flex: 1.4, minSize: 155, title: "Overtones" },
        ],
      },
    ],
  },
};

export const LAYOUT_PRESETS: LayoutPreset[] = [
  PRESET_CLASSIC,
  PRESET_PIANO_STUDIO,
  PRESET_GUITAR_STUDIO,
  PRESET_FULL_PPT,
];

export const LAYOUT_STORAGE_KEY = "note_navigation_layout_v1";

export function countCells(node: LayoutNode): number {
  if (node.type === "cell") return 1;
  return node.children.reduce((sum, child) => sum + countCells(child), 0);
}

export function updateCellModule(
  node: LayoutNode,
  cellId: string,
  nextModule: NoteNavModuleType
): LayoutNode {
  if (node.type === "cell") {
    if (node.id !== cellId) return node;
    return {
      ...node,
      module: nextModule,
      title: MODULE_META[nextModule].label,
    };
  }
  return {
    ...node,
    children: node.children.map(child => updateCellModule(child, cellId, nextModule)),
  };
}

let cellSeq = 0;
function makeId(prefix: string): string {
  cellSeq += 1;
  return `${prefix}-${Date.now().toString(36)}-${cellSeq}`;
}

export function splitCellNode(
  node: LayoutNode,
  targetCellId: string,
  direction: LayoutFlexDirection,
  newModule: NoteNavModuleType
): LayoutNode {
  if (node.type === "cell") {
    if (node.id !== targetCellId) return node;
    const newCell: LayoutCellNode = {
      id: makeId("cell"),
      type: "cell",
      module: newModule,
      flex: 1,
      minSize: 120,
      title: MODULE_META[newModule].label,
    };
    return {
      id: makeId("split"),
      type: "container",
      direction,
      flex: node.flex ?? 1,
      gap: 10,
      children: [{ ...node, flex: 1 }, newCell],
    };
  }

  return {
    ...node,
    children: node.children.map(child => splitCellNode(child, targetCellId, direction, newModule)),
  };
}

export function removeCellNode(node: LayoutNode, targetCellId: string): LayoutNode | null {
  if (node.type === "cell") {
    return node.id === targetCellId ? null : node;
  }
  const remaining = node.children
    .map(child => removeCellNode(child, targetCellId))
    .filter((c): c is LayoutNode => c !== null);

  if (remaining.length === 0) return null;
  if (remaining.length === 1) {
    return { ...remaining[0], flex: node.flex ?? remaining[0].flex };
  }
  return { ...node, children: remaining };
}
