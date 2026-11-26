import type { NoteLabelMode, AccidentalPreference } from "@/lib/music-engine";
import type { StaffLayoutMode } from "@/lib/staff-clef-assignment";
import type { PhraseOnset } from "@/lib/phrase-model";
import type { LayoutNode } from "@/lib/layout-models";

export interface NoteNavShareSnapshot {
  v: 1;
  selectedKey: string;
  selectedScale: string;
  scaleRootOffset: number;
  isKeyLocked: boolean;
  labelMode: NoteLabelMode;
  accidentalPreference: AccidentalPreference;
  pptNoteheads: boolean;
  staffLayoutMode: StaffLayoutMode;
  showPianoTriangles: boolean;
  showFingering: boolean;
  phraseMode: boolean;
  activeStepIndex: number;
  phraseOnsets: PhraseOnset[];
  tuningName: string;
  layoutPresetId: string;
  customLayout?: LayoutNode;
}

export interface SavedLessonEntry {
  id: string;
  name: string;
  slug: string;
  updatedAt: number;
}

const SAVED_LESSONS_KEY = "note_navigation_saved_lessons_v1";

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(slug: string): string {
  const normalized = slug.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const binary = atob(normalized + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function encodeShareSlug(snapshot: NoteNavShareSnapshot): string {
  return toBase64Url(JSON.stringify(snapshot));
}

export function decodeShareSlug(slug: string): NoteNavShareSnapshot | null {
  try {
    if (!slug || typeof slug !== "string") return null;
    const raw = fromBase64Url(slug.trim());
    const parsed = JSON.parse(raw) as Partial<NoteNavShareSnapshot>;
    if (!parsed || parsed.v !== 1 || typeof parsed.selectedKey !== "string") {
      return null;
    }
    return {
      v: 1,
      selectedKey: parsed.selectedKey,
      selectedScale: typeof parsed.selectedScale === "string" ? parsed.selectedScale : "major",
      scaleRootOffset: typeof parsed.scaleRootOffset === "number" ? parsed.scaleRootOffset : 0,
      isKeyLocked: Boolean(parsed.isKeyLocked),
      labelMode: parsed.labelMode ?? "notes",
      accidentalPreference: parsed.accidentalPreference ?? "auto",
      pptNoteheads: parsed.pptNoteheads ?? true,
      staffLayoutMode: parsed.staffLayoutMode ?? "joined",
      showPianoTriangles: Boolean(parsed.showPianoTriangles),
      showFingering: Boolean(parsed.showFingering),
      phraseMode: Boolean(parsed.phraseMode),
      activeStepIndex: typeof parsed.activeStepIndex === "number" ? parsed.activeStepIndex : 0,
      phraseOnsets: Array.isArray(parsed.phraseOnsets) ? parsed.phraseOnsets : [],
      tuningName: typeof parsed.tuningName === "string" ? parsed.tuningName : "Standard",
      layoutPresetId: typeof parsed.layoutPresetId === "string" ? parsed.layoutPresetId : "classic",
      customLayout: parsed.customLayout,
    };
  } catch {
    return null;
  }
}

export function buildShareUrl(snapshot: NoteNavShareSnapshot, currentHref?: string): string {
  const base = currentHref || (typeof window !== "undefined" ? window.location.href : "https://note-navigation.midlifemuso.com/");
  const url = new URL(base);
  url.searchParams.set("p", encodeShareSlug(snapshot));
  return url.toString();
}

export function loadSavedLessons(): SavedLessonEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAVED_LESSONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLessonEntry(name: string, slug: string): SavedLessonEntry[] {
  const existing = loadSavedLessons();
  const entry: SavedLessonEntry = {
    id: `lesson-${Date.now().toString(36)}`,
    name: name.trim() || "Untitled Lesson",
    slug,
    updatedAt: Date.now(),
  };
  const next = [entry, ...existing].slice(0, 30);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(SAVED_LESSONS_KEY, JSON.stringify(next));
    } catch {
      // Ignore quota errors
    }
  }
  return next;
}

export function deleteSavedLessonEntry(id: string): SavedLessonEntry[] {
  const next = loadSavedLessons().filter(l => l.id !== id);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(SAVED_LESSONS_KEY, JSON.stringify(next));
    } catch {
      // Ignore quota errors
    }
  }
  return next;
}
