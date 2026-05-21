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

/** Horizontal gap from frame right edge to the Anatomy label column. */
export const ANATOMY_POINTER_RIGHT_OFFSET = 64;

/** Minimum vertical gap between Anatomy labels in the right column. */
export const ANATOMY_POINTER_LABEL_GAP = 12;

/** Per-pointer bend X offset to reduce vertical connector overlap. */
export const ANATOMY_POINTER_BEND_STEP = 8;

/** Alias used by routing lane variants. */
export const ANATOMY_POINTER_BEND_LANE_STEP = ANATOMY_POINTER_BEND_STEP;

/** Minimum space between connector bend and label left edge. */
export const ANATOMY_POINTER_MIN_CONNECTOR_GAP = 8;

/** Horizontal offset for top-entry bend lane variants (label above target). */
export const ANATOMY_POINTER_TOP_ENTRY_BEND_STEP = ANATOMY_POINTER_BEND_STEP;

/** Minimum vertical gap between horizontal routing lanes. */
export const ANATOMY_POINTER_ROUTING_LEVEL_GAP = 12;

/** Minimum row-clustering threshold for visual rows. */
export const ANATOMY_POINTER_ROW_THRESHOLD_MIN = 16;

/** Vertical step when optimizing label Y positions. */
export const ANATOMY_POINTER_LABEL_SHIFT_STEP = 16;

/** Max vertical shift from preferredCenterY during label optimization. */
export const ANATOMY_POINTER_MAX_LABEL_Y_OFFSET = 96;

/** Max layout/routing fallback attempts per spec. */
export const ANATOMY_POINTER_MAX_FALLBACK_ATTEMPTS = 3;

/** Additional top vertical room used for top-zone label placement. */
export const ANATOMY_POINTER_TOP_ZONE_MARGIN = 32;

/** Additional bottom vertical room used for bottom-zone label placement. */
export const ANATOMY_POINTER_BOTTOM_ZONE_MARGIN = 48;

/** Minimum spacing between top/right/bottom label zones. */
export const ANATOMY_POINTER_ZONE_GAP = 12;

/** Simplified straight-pointer distance from component bounds. */
export const ANATOMY_POINTER_OFFSET = 48;

/** Max ratio of targets assigned to the top side. */
export const ANATOMY_POINTER_TOP_SIDE_MAX_ITEMS_RATIO = 0.3;

/** Max ratio of targets assigned to the bottom side. */
export const ANATOMY_POINTER_BOTTOM_SIDE_MAX_ITEMS_RATIO = 0.3;

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
