import { describe, expect, it } from "vitest";
import { computeFretboardGeometry, computeSpectrumGeometry } from "./cell-geometry";

describe("Responsive Fretboard geometry", () => {
  it("expands string spacing and note radii to use taller cell height", () => {
    const compact = computeFretboardGeometry(760, 150, 12, 6);
    const tall = computeFretboardGeometry(760, 320, 12, 6);

    expect(tall.svgHeight).toBe(320);
    expect(tall.stringGap).toBeGreaterThan(compact.stringGap);
    expect(tall.noteRadius).toBeGreaterThan(compact.noteRadius);
    expect(tall.fretLineTop).toBeGreaterThanOrEqual(12);
    expect(tall.fretNumY).toBeLessThanOrEqual(tall.svgHeight - 4);
  });

  it("scales note radius up when visible fret span shrinks in tall cells and prevents overlap on wide spans", () => {
    const tightSpan = computeFretboardGeometry(800, 300, 5, 6);
    const midSpan = computeFretboardGeometry(800, 300, 12, 6);
    const wideSpan = computeFretboardGeometry(620, 300, 18, 6);

    expect(tightSpan.fretWidth).toBeGreaterThan(midSpan.fretWidth);
    expect(tightSpan.noteRadius).toBeGreaterThanOrEqual(midSpan.noteRadius);
    expect(wideSpan.noteRadius).toBeLessThanOrEqual(wideSpan.fretWidth * 0.36 + 0.001);
  });

  it("handles 4-string bass and 7-string guitar tunings without clipped bounds", () => {
    for (const strings of [4, 6, 7]) {
      const g = computeFretboardGeometry(360, 220, 8, strings);
      expect(g.topY).toBeGreaterThan(0);
      expect(g.bottomY).toBeLessThan(g.svgHeight);
      expect(g.blockBandY).toBeGreaterThanOrEqual(10);
      expect(g.blockBandHeight).toBeGreaterThan(0);
      expect(g.neckRight).toBeGreaterThan(g.neckLeft);
    }
  });
});

describe("Responsive Spectrum geometry", () => {
  it("expands vertical plotHeight proportionally with taller cells and preserves badge/axis headroom", () => {
    const compact = computeSpectrumGeometry(640, 140);
    const tall = computeSpectrumGeometry(640, 300);

    expect(tall.plotHeight).toBeGreaterThan(compact.plotHeight);
    expect(tall.plotBottom - tall.plotTop).toBe(tall.plotHeight);
    expect(tall.plotTop).toBeGreaterThanOrEqual(tall.badgeR * 2 + 4);
    expect(tall.svgHeight - tall.plotBottom).toBeGreaterThanOrEqual(18);
  });

  it("fits narrow cells cleanly without forcing horizontal overflow", () => {
    const narrow = computeSpectrumGeometry(240, 180);
    expect(narrow.svgWidth).toBe(300);
    expect(narrow.plotHeight).toBeGreaterThan(0);
  });
});
