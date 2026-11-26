export interface FretboardGeometry {
  svgWidth: number;
  svgHeight: number;
  labelX: number;
  nutX: number;
  nutW: number;
  neckLeft: number;
  openX: number;
  bridgeX: number;
  neckRight: number;
  neckW: number;
  fretWidth: number;
  stringGap: number;
  neckHeight: number;
  topY: number;
  bottomY: number;
  noteRadius: number;
  fretLineTop: number;
  fretLineBottom: number;
  markerRadius: number;
  fretNumY: number;
  blockBandY: number;
  blockBandHeight: number;
  blockLabelY: number;
}

export function computeFretboardGeometry(
  containerWidth: number,
  containerHeight: number,
  visibleFrets: number,
  stringCount: number
): FretboardGeometry {
  const svgWidth = Math.max(320, Math.round(containerWidth));
  const svgHeight = Math.max(130, Math.round(containerHeight));

  const labelX = 16;
  const nutX = 44;
  const nutW = 4;
  const neckLeft = 48;
  const openX = 46;
  const bridgeX = svgWidth - 8;
  const neckRight = Math.max(neckLeft + 120, bridgeX - 20);
  const neckW = neckRight - neckLeft;
  const fretWidth = neckW / Math.max(1, visibleFrets);

  const topPad = 24;
  const bottomPad = 24;
  const gaps = Math.max(1, stringCount - 1);
  const usableH = Math.max(70, svgHeight - topPad - bottomPad);
  const stringGap = Math.min(54, Math.max(16, usableH / gaps));
  const neckHeight = stringGap * gaps;

  const topY = Math.max(topPad, Math.round((svgHeight - neckHeight - 4) / 2));
  const bottomY = topY + neckHeight;

  const noteRadius = Math.max(8, Math.min(17, Math.min(stringGap * 0.42, fretWidth * 0.36)));
  const fretLineTop = Math.max(12, topY - Math.min(10, stringGap * 0.36));
  const fretLineBottom = Math.min(svgHeight - 16, bottomY + Math.min(10, stringGap * 0.36));
  const markerRadius = Math.max(3.5, Math.min(6, stringGap * 0.16));
  const fretNumY = Math.min(svgHeight - 4, fretLineBottom + 13);

  const blockBandY = Math.max(10, topY - noteRadius - 3);
  const blockBandHeight = Math.min(
    svgHeight - blockBandY - 14,
    neckHeight + noteRadius * 2 + 6
  );
  const blockLabelY = Math.max(9, blockBandY - 3);

  return {
    svgWidth,
    svgHeight,
    labelX,
    nutX,
    nutW,
    neckLeft,
    openX,
    bridgeX,
    neckRight,
    neckW,
    fretWidth,
    stringGap,
    neckHeight,
    topY,
    bottomY,
    noteRadius,
    fretLineTop,
    fretLineBottom,
    markerRadius,
    fretNumY,
    blockBandY,
    blockBandHeight,
    blockLabelY,
  };
}

export interface SpectrumGeometry {
  svgWidth: number;
  svgHeight: number;
  badgeR: number;
  plotTop: number;
  plotBottom: number;
  plotHeight: number;
  subBarW: number;
  barGap: number;
  axisFontSize: number;
}

export function computeSpectrumGeometry(
  containerWidth: number,
  containerHeight: number
): SpectrumGeometry {
  const svgWidth = Math.max(300, Math.round(containerWidth));
  const svgHeight = Math.max(100, Math.round(containerHeight));

  const badgeR = svgHeight >= 190 ? 9.5 : 8;
  const plotTop = Math.round(badgeR * 2 + 6);
  const plotBottom = Math.max(plotTop + 44, svgHeight - 20);
  const plotHeight = plotBottom - plotTop;
  const subBarW = svgWidth >= 680 ? 2.5 : 2;
  const barGap = 1;
  const axisFontSize = svgWidth >= 560 ? 10 : 8.5;

  return {
    svgWidth,
    svgHeight,
    badgeR,
    plotTop,
    plotBottom,
    plotHeight,
    subBarW,
    barGap,
    axisFontSize,
  };
}
