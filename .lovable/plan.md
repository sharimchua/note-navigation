## Review: Unused Features and Improvement Opportunities

### Unused / Removable Code

1. `**NavLink` component** (`src/components/NavLink.tsx`) — Never imported anywhere. The app has a single route. Should be removed.
2. `**DexterityPreset` type and `DEXTERITY_PRESETS**` (`src/lib/music-engine.ts`, lines 170–180) — Defined but never used anywhere in the application. Should be removed.
3. `**getAllFretboardPositions` function** (`src/lib/music-engine.ts`, lines 91–105) — Exported but never called. Should be removed.
4. **Duplicate Guitar Tuning selector in sidebar** — The `ControlSidebar` has a full `<select>` dropdown for guitar tuning, but the `GuitarFretboard` component also has its own inline tuning picker (the clickable label with dropdown). This is redundant. Remove the sidebar tuning selector and keep the inline one on the fretboard, which is more contextual.
5. `**useFlats` toggle** — Exists in context and is toggled only from the Grand Staff's sharps/flats button. The `ControlSidebar` does not expose it, yet the fretboard consumes it. Not unused, but worth noting it's buried.

---

### Design Improvements for Cross-Instrument Note Relationships

6. **Highlight synchronization feedback** — When a note is clicked on any instrument, it activates across all views. However, there is no visual pulse or transition to draw the student's eye to the *other* representations. Add a brief glow/scale animation on newly activated notes across all components so students can visually track the same note appearing on the staff, piano, fretboard, and linear map simultaneously.
7. **Linear Note Map improvements** — Currently all 25 notes (C3–C5) render as uniform colored circles regardless of scale lock. When `isKeyLocked` is true, non-scale notes should be visually de-emphasized (smaller, lower opacity, no label) so students can see the scale pattern linearly. Additionally, showing the scale degree number (1–7) inside scale notes would reinforce the relationship between note names and their function.
8. **Hover cross-highlighting** — Add a hover state (not just click) that temporarily highlights the same pitch class across all views without committing it. This lets students explore relationships without cluttering the active notes set.
9. **Scale degree display on fretboard and piano** — When a scale is locked, show the scale degree (1, 2, 3…7) alongside or instead of the note name on scale-tone indicators. This helps students see patterns across instruments in functional terms, not just pitch names.

---

### Implementation Plan

**Phase 1 — Cleanup (remove dead code)**

- Delete `src/components/NavLink.tsx`
- Remove `DexterityPreset`, `DEXTERITY_PRESETS`, and `getAllFretboardPositions` from `music-engine.ts`
- Remove the Guitar Tuning section from `ControlSidebar.tsx` (keep the fretboard's inline picker)

**Phase 2 — Visual improvements for cross-instrument learning**

- Add a CSS keyframe animation (e.g., `note-flash`) that briefly scales up and glows when a note becomes active, applied to note indicators on all four components
- Update `LinearNoteMap` to de-emphasize non-scale notes when key-locked and show scale degree numbers inside scale tones
- Add optional interval labels between consecutive active notes on the Linear Note Map

**Phase 3 — Scale degree integration**

- Add a `getScaleDegree(noteName, scaleNotes)` utility to `music-engine.ts`
- Display scale degrees on piano scale indicators and fretboard scale dots (e.g., "1" for root, "5" for fifth) when key is locked
- Use the existing note color system to reinforce that the same color = same pitch class everywhere

### Technical Notes

- All state changes flow through `HarmonicContext`, so cross-component sync is already handled. Animations just need CSS additions.
- The `note-active` CSS class exists but is never actually applied to any element — it can be repurposed for the flash animation.
- No new dependencies are needed for any of these changes.