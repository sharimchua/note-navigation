

# Particle Trail Visualisation — Design Plan

## Concept

A "piano roll" style trail system where active notes emit particles that scroll leftward over time, creating a temporal history of what was played. When a note is held, it continuously generates trail segments; when released, the trail stops growing but continues scrolling left until it fades out. This transforms the static chord snapshot into a live performance visualiser.

## How It Works

### Grand Staff (Primary)
- The current SVG viewBox (`200` wide) gets a scrolling particle layer behind the note heads.
- Each active note spawns small coloured dots (using the existing `getNoteColor`) at its Y position on the right side (~x=CHORD_X).
- Every animation frame (~60fps via `requestAnimationFrame`), all particles shift left by a fixed pixel amount and reduce opacity.
- Particles older than ~3-4 seconds are removed from the array.
- The static note heads, staff lines, clefs, and key signature remain fixed and rendered on top — particles live in a background layer so they never obscure note details.
- Trail dots are small (radius ~1.5-2px) and semi-transparent (~0.3-0.5 opacity), fading to 0 as they age. This keeps them visually striking (coloured streaks) but subtle enough not to compete with note labels.

### Other Controls (When Trail Mode Active)
- **Linear Note Map**: Active note circles emit a subtle glow pulse or fading ring animation — lightweight CSS `@keyframes` on active items rather than a full particle system.
- **Piano Keyboard**: Active keys get a soft trailing glow/shimmer at the bottom edge of the key, using a CSS gradient animation. No canvas needed.
- **Guitar Fretboard**: Active fret dots pulse with a radiating ring effect (CSS `box-shadow` animation), similar to a ripple.
- **Fundamentals & Overtones**: Partial bars already visualise frequency data; in trail mode, bars could have a brief "afterimage" fade when notes are released (CSS `transition` on opacity/height with a longer duration).

These secondary effects are intentionally lighter than the staff trail — the grand staff is the hero visualisation; the others just echo the "alive" feeling.

## Architecture

### New State in HarmonicContext
- `trailMode: boolean` — toggle on/off.
- `setTrailMode: (enabled: boolean) => void`

### New Component: `ParticleTrailLayer`
- Renders inside `StaffNotation` as an SVG `<g>` layer beneath the note heads.
- Uses `useRef` to store a mutable particle array (avoids React re-renders per frame).
- Runs a `requestAnimationFrame` loop that:
  1. For each currently active note, pushes a new particle `{ x: CHORD_X, y: noteY, color, opacity: 0.5, age: 0 }`.
  2. Shifts all particles left (`x -= speed`), increments age, reduces opacity.
  3. Prunes dead particles (opacity ≤ 0 or x < 0).
  4. Renders via direct SVG DOM manipulation (not React state) for performance — updating a single `<g>` element's innerHTML or using a `<canvas>` overlay.
- Performance target: <500 particles at any time. At ~60fps with 4-5 notes, generating 1 particle per note per frame = ~300 particles/sec, with 3s lifetime ≈ 900 max. Throttling to every 3rd frame keeps it under 300.

### Canvas vs SVG
A small `<canvas>` element overlaid on the SVG would be more performant for particles. It would be absolutely positioned behind the SVG note layer, sized to match, and cleared/redrawn each frame. This avoids SVG DOM overhead entirely.

### Toggle UI
- A small toggle button in the header (next to Mute), with a sparkle/trail icon.
- Label: "Trail" with the same layout pattern as the existing mute button.

## Files to Change

| File | Change |
|---|---|
| `src/contexts/HarmonicContext.tsx` | Add `trailMode` state and setter |
| `src/components/ParticleTrailLayer.tsx` | **New** — canvas-based particle renderer |
| `src/components/StaffNotation.tsx` | Wrap SVG in a relative container; overlay `ParticleTrailLayer` when enabled |
| `src/pages/Index.tsx` | Add trail toggle button in header |
| `src/components/PianoKeyboard.tsx` | Add CSS glow class on active keys when trail mode on |
| `src/components/LinearNoteMap.tsx` | Add pulse animation class on active notes when trail mode on |
| `src/components/GuitarFretboard.tsx` | Add ripple animation on active frets when trail mode on |
| `src/components/DissonanceSpectrum.tsx` | Add longer fade transitions when trail mode on |
| `src/index.css` | Add keyframe animations for glow/pulse/ripple effects |

## Performance Safeguards
- Particle array is mutable ref, not React state — no re-renders.
- Canvas redraws are cheap for <500 circles.
- `requestAnimationFrame` loop auto-pauses when tab is hidden.
- Trail mode off = no loop running, zero overhead.

## UX Considerations
- Default: **off**. Users opt in via toggle.
- Particles use the same note colour system, so they're visually coherent.
- Trail opacity starts low (0.4) and fades — never competes with the crisp note heads on top.
- On mobile, particle count could be halved (spawn every 6th frame) to preserve battery.

