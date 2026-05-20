/// <reference types="@figma/plugin-typings" />

import type { AnatomyGeneratorOptions } from './anatomyTypes';

export const ANATOMY_LAYOUT = {
  markerSize: 24,
  markerOffset: 20,
  connectorThickness: 1,
  framePadding: 40,
  listGap: 120,
  listWidth: 260,
  minMarkerGap: 8,
  maxPointersPerSide: 6,
} as const;

export function hexToRgb(hex: string): RGB {
  let s = String(hex || '').replace(/^#/, '');
  if (s.length === 3) {
    s = s
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const n = parseInt(s, 16);
  return {
    r: ((n >> 16) & 255) / 255,
    g: ((n >> 8) & 255) / 255,
    b: (n & 255) / 255,
  };
}

export const ANATOMY_COLORS = {
  accent: hexToRgb('#FC8507'),
  markerText: { r: 1, g: 1, b: 1 } as RGB,
  listText: hexToRgb('#4E4E4E'),
  background: hexToRgb('#F7F7F7'),
};

export const DEFAULT_ANATOMY_OPTIONS: Required<
  Pick<
    AnatomyGeneratorOptions,
    | 'maxItems'
    | 'maxDepth'
    | 'sortMode'
    | 'includeHidden'
    | 'includeContainer'
    | 'framePadding'
    | 'listGap'
    | 'listWidth'
    | 'markerSize'
    | 'markerOffset'
    | 'connectorThickness'
    | 'markerRadius'
    | 'markerColor'
    | 'markerTextColor'
    | 'connectorColor'
    | 'listTextColor'
    | 'fontRegular'
    | 'fontBold'
    | 'scale'
    | 'backgroundColor'
    | 'frameFillColor'
    | 'useComponentPropertyNames'
  >
> = {
  maxItems: 8,
  maxDepth: 8,
  sortMode: 'tree',
  includeHidden: false,
  includeContainer: false,
  framePadding: ANATOMY_LAYOUT.framePadding,
  listGap: ANATOMY_LAYOUT.listGap,
  listWidth: ANATOMY_LAYOUT.listWidth,
  markerSize: ANATOMY_LAYOUT.markerSize,
  markerOffset: ANATOMY_LAYOUT.markerOffset,
  connectorThickness: ANATOMY_LAYOUT.connectorThickness,
  markerRadius: 12,
  markerColor: ANATOMY_COLORS.accent,
  markerTextColor: ANATOMY_COLORS.markerText,
  connectorColor: ANATOMY_COLORS.accent,
  listTextColor: ANATOMY_COLORS.listText,
  fontRegular: { family: 'PT Sans', style: 'Regular' },
  fontBold: { family: 'PT Sans', style: 'Bold' },
  scale: 1,
  backgroundColor: ANATOMY_COLORS.background,
  frameFillColor: ANATOMY_COLORS.background,
  useComponentPropertyNames: true,
};

export function mergeAnatomyOptions(
  options?: AnatomyGeneratorOptions
): AnatomyGeneratorOptions & typeof DEFAULT_ANATOMY_OPTIONS {
  return { ...DEFAULT_ANATOMY_OPTIONS, ...(options || {}) };
}
