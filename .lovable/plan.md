

## Review: Optimisations and Bug Fixes

### Bugs / Dead Code

1. **`hoveredPitchClass` and `setHoveredPitchClass` are unused** — State, setter, and callback remain in `HarmonicContext.tsx` (lines 22, 33, 55, 137, 151, 162) but no component reads or writes them after hover was removed. Remove from the interface, state, provider value, and callbacks.

2. **`STANDARD_TUNING` export is unused** — Defined in `music-engine.ts` line 51 but never imported anywhere. The `GUITAR_TUNINGS` array duplicates it. Remove.

3. **`Interval` import is unused** — Imported from `tonal` in `music-engine.ts` line 2 but never used. Remove.

4. **`Tone.start()` called on every note play** — `playNote` in `HarmonicContext.tsx` line 107 calls `await Tone.start()` every time. This is harmless but wasteful after the first interaction. Track whether audio context is started with a ref and skip subsequent calls.

5. **`scaleNotes` recomputed every render** — `getScaleNotes(selectedKey, selectedScale)` on line 69 of `HarmonicContext.tsx` runs on every render since it's not memoised. Wrap in `useMemo` with `[selectedKey, selectedScale]` dependencies.

6. **`whiteKeys` not memoised in PianoKeyboard** — `PIANO_KEYS.filter(k => !k.isBlack)` on line 18 creates a new array every render. Since `PIANO_KEYS` is a constant, this can be computed once outside the component.

7. **Empty `<div>` gap in ControlSidebar** — Lines 90-91 have blank lines between sections producing an empty space. Minor, but worth cleaning.

### Implementation Plan

**File: `src/contexts/HarmonicContext.tsx`**
- Remove `hoveredPitchClass` from interface, state, setter, callback, and provider value (6 locations)
- Wrap `scaleNotes` in `useMemo(() => getScaleNotes(selectedKey, selectedScale), [selectedKey, selectedScale])`
- Add `audioStartedRef = useRef(false)` and gate `Tone.start()` behind it in `playNote`

**File: `src/lib/music-engine.ts`**
- Remove `Interval` from the tonal import
- Remove `STANDARD_TUNING` export

**File: `src/components/PianoKeyboard.tsx`**
- Move `whiteKeys` filter outside the component as a module-level constant

**File: `src/components/ControlSidebar.tsx`**
- Remove empty lines between sections (lines 90-91)

