/// <reference types="@figma/plugin-typings" />

import type {
  GapOrientation,
  PaddingValueAnchors,
  Rect,
  ValueSquareAnchor,
} from './overlayGeometry';
import { getGapValueSquarePosition } from './overlayGeometry';
import {
  applyGapMeasureFill,
  applyGapOverlayStroke,
  applyGapValueSquareFill,
  applyPaddingMeasureFill,
  applyPaddingOverlayStroke,
  applyPaddingValueSquareFill,
  applyValueSquareLabelInverse,
} from './overlayStyles';
import { loadFontOnce } from '../figma/text';
import type { TokenizedSpacingValue } from './paddingOverlay';

export type SpacingSideName = 'Top' | 'Right' | 'Bottom' | 'Left';

export type SpacingOverlayKind = 'padding' | 'gap';

export type SpacingSideOverlayBounds = Rect & {
  topOverlayHeight?: number;
  bottomOverlayHeight?: number;
};

export const SPACING_OVERLAY_LAYOUT = {
  extraSize: 20,
  valueSquareGap: 4,
};

const SPACING_OVERLAY_INSET = 1;
const VALUE_SQUARE_HEIGHT = 20;

const FONT_REGULAR: FontName = { family: 'PT Sans', style: 'Regular' };

/** Matches spec: line-height 15.60px at 12px PT Sans Regular. */
const GAP_VALUE_TEXT_LINE_HEIGHT_PX = 15.6;

const GAP_VALUE_SQUARE_PADDING_X = 4;
const GAP_VALUE_SQUARE_RADIUS = 4;
export const GAP_VALUE_SQUARE_SIZE = 20;

/** CSS spec: top: -24px for vertical gap overlay label. */
export const GAP_VALUE_SQUARE_OFFSET_TOP = -24;
/** CSS spec: left: -6px for vertical gap (centered on narrow overlay). */
export const GAP_VALUE_SQUARE_OFFSET_LEFT_VERTICAL = -6;
/** CSS spec: left: -24px for horizontal gap overlay label. */
export const GAP_VALUE_SQUARE_OFFSET_LEFT_HORIZONTAL = -24;

function createZeroPointFrame(): FrameNode {
  const frame = figma.createFrame();
  frame.name = 'Zero point';
  frame.fills = [];
  frame.strokes = [];
  frame.resize(0, 0);
  return frame;
}

function applyOverlayPaddingForSide(
  overlay: FrameNode,
  side: SpacingSideName,
  bounds: SpacingSideOverlayBounds
): void {
  const inset = SPACING_OVERLAY_INSET;

  overlay.paddingTop = 0;
  overlay.paddingRight = 0;
  overlay.paddingBottom = 0;
  overlay.paddingLeft = 0;

  if (side === 'Left' || side === 'Right') {
    const bottom = Math.max(0, Number(bounds.bottomOverlayHeight) || 0);
    overlay.paddingLeft = inset;
    overlay.paddingRight = inset;
    overlay.paddingBottom = bottom;
    return;
  }

  if (side === 'Top' || side === 'Bottom') {
    overlay.paddingTop = inset;
    overlay.paddingBottom = inset;
  }
}

function getOverlayItemSpacing(side: SpacingSideName, bounds: SpacingSideOverlayBounds): number {
  const baseSpacing = SPACING_OVERLAY_LAYOUT.extraSize;

  if (side === 'Left' || side === 'Right') {
    const topOverlayHeight = Math.max(0, Number(bounds.topOverlayHeight) || 0);
    return baseSpacing + topOverlayHeight;
  }

  return baseSpacing;
}

async function createMeasureFillFrame(
  kind: SpacingOverlayKind,
  bounds: SpacingSideOverlayBounds
): Promise<FrameNode> {
  const frame = figma.createFrame();
  frame.name = kind === 'padding' ? 'Padding measure fill' : 'Gap measure fill';
  frame.fills = [];
  frame.strokes = [];
  frame.clipsContent = false;

  const bw = Math.round(Math.max(1, bounds.width || 1));
  const bh = Math.round(Math.max(1, bounds.height || 1));
  frame.resize(bw, bh);

  try {
    frame.layoutGrow = 1;
  } catch {
    /* ignore */
  }

  try {
    frame.layoutAlign = 'STRETCH';
  } catch {
    /* ignore */
  }

  if (kind === 'padding') {
    await applyPaddingMeasureFill(frame);
  } else {
    await applyGapMeasureFill(frame);
  }

  return frame;
}

export async function createSpacingValueSquare(
  kind: SpacingOverlayKind,
  tokenizedValue: TokenizedSpacingValue
): Promise<FrameNode> {
  const rawVal =
    tokenizedValue?.value != null ? Number(tokenizedValue.value) : Number.NaN;
  const valueStr = !Number.isNaN(rawVal) ? String(Math.round(rawVal)) : '—';

  const square = figma.createFrame();
  square.name = kind === 'padding' ? 'Padding value square' : 'Gap value square';
  square.layoutMode = 'HORIZONTAL';
  square.primaryAxisAlignItems = 'CENTER';
  square.counterAxisAlignItems = 'CENTER';
  square.primaryAxisSizingMode = 'AUTO';
  square.counterAxisSizingMode = 'FIXED';
  square.paddingLeft = 4;
  square.paddingRight = 4;
  square.paddingTop = 0;
  square.paddingBottom = 0;
  square.itemSpacing = 0;
  square.resize(20, VALUE_SQUARE_HEIGHT);
  square.cornerRadius = 4;
  square.clipsContent = false;

  if (kind === 'padding') {
    await applyPaddingValueSquareFill(square);
  } else {
    await applyGapValueSquareFill(square);
  }

  await loadFontOnce(FONT_REGULAR);
  const text = figma.createText();
  text.name = kind === 'padding' ? 'Padding value' : 'Gap value';
  text.fontName = FONT_REGULAR;
  text.fontSize = 12;
  text.lineHeight = { unit: 'PERCENT', value: 130 };
  text.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  text.characters = valueStr;
  square.appendChild(text);
  await applyValueSquareLabelInverse(text);

  try {
    square.counterAxisSizingMode = 'FIXED';
    square.resize(Math.max(20, square.width), VALUE_SQUARE_HEIGHT);
  } catch {
    /* ignore */
  }

  return square;
}

/**
 * Gap value square — HTML/CSS spec:
 * inline-flex container, padding 4px L/R, radius 4px, Error-main fill,
 * absolute child text 12px / line-height 15.60px / PT Sans / inverse color.
 */
export async function createGapValueSquare(
  tokenizedValue: TokenizedSpacingValue
): Promise<FrameNode> {
  const rawVal =
    tokenizedValue?.value != null ? Number(tokenizedValue.value) : Number.NaN;
  const valueStr = !Number.isNaN(rawVal) ? String(Math.round(rawVal)) : '—';

  const square = figma.createFrame();
  square.name = 'Gap value square';
  square.layoutMode = 'HORIZONTAL';
  square.primaryAxisAlignItems = 'CENTER';
  square.counterAxisAlignItems = 'CENTER';
  square.primaryAxisSizingMode = 'AUTO';
  square.counterAxisSizingMode = 'FIXED';
  square.paddingLeft = GAP_VALUE_SQUARE_PADDING_X;
  square.paddingRight = GAP_VALUE_SQUARE_PADDING_X;
  square.paddingTop = 0;
  square.paddingBottom = 0;
  square.itemSpacing = 0;
  square.cornerRadius = GAP_VALUE_SQUARE_RADIUS;
  square.clipsContent = false;
  square.fills = [];
  square.strokes = [];

  await applyGapValueSquareFill(square);

  await loadFontOnce(FONT_REGULAR);
  const text = figma.createText();
  text.name = 'Gap value text';
  text.fontName = FONT_REGULAR;
  text.fontSize = 12;
  text.lineHeight = { unit: 'PIXELS', value: GAP_VALUE_TEXT_LINE_HEIGHT_PX };
  text.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  text.characters = valueStr;
  text.textAlignHorizontal = 'CENTER';
  text.textAlignVertical = 'CENTER';
  square.appendChild(text);
  await applyValueSquareLabelInverse(text);

  try {
    square.resize(
      Math.max(GAP_VALUE_SQUARE_SIZE, Math.round(square.width)),
      GAP_VALUE_SQUARE_SIZE
    );
    square.primaryAxisSizingMode = 'FIXED';
    square.counterAxisSizingMode = 'FIXED';
    square.resize(GAP_VALUE_SQUARE_SIZE, GAP_VALUE_SQUARE_SIZE);
  } catch {
    square.resize(GAP_VALUE_SQUARE_SIZE, GAP_VALUE_SQUARE_SIZE);
  }

  return square;
}

/** Same positioning rules as Padding overlay value square for the given side. */
export function positionValueSquareForSpacingSide(
  square: FrameNode,
  overlay: FrameNode,
  side: SpacingSideName
): void {
  try {
    square.layoutPositioning = 'ABSOLUTE';
  } catch {
    /* ignore */
  }

  const gap = SPACING_OVERLAY_LAYOUT.valueSquareGap;

  if (side === 'Top' || side === 'Bottom') {
    square.x = -square.width - gap;
    square.y = overlay.height / 2 - square.height / 2;
    return;
  }

  if (side === 'Left' || side === 'Right') {
    square.x = overlay.width / 2 - square.width / 2;
    square.y = -square.height - gap;
  }
}

export type SpacingSideOverlayResult = {
  node: FrameNode;
  valueAnchor: ValueSquareAnchor;
};

/**
 * Shared Auto Layout side overlay — used by Padding and Gap overlays.
 */
export async function createSpacingSideOverlay(params: {
  kind: SpacingOverlayKind;
  side: SpacingSideName;
  frameName: string;
  bounds: SpacingSideOverlayBounds;
  tokenizedValue: TokenizedSpacingValue;
  /** Align gap label with padding labels (uses actual value square size after layout). */
  gapValueSquareAlign?: {
    gapOrientation: GapOrientation;
    gapRect: Rect;
    paddingValueAnchors: PaddingValueAnchors;
  };
}): Promise<SpacingSideOverlayResult | null> {
  const { kind, side, frameName, bounds, tokenizedValue, gapValueSquareAlign } = params;

  if (!tokenizedValue || Number(tokenizedValue.value) === 0) return null;

  const bw = Math.round(Math.max(0, bounds.width));
  const bh = Math.round(Math.max(0, bounds.height));
  if (bw <= 0 || bh <= 0) return null;

  const isHoriz = side === 'Top' || side === 'Bottom';

  const overlay = figma.createFrame();
  overlay.name = frameName;
  overlay.layoutMode = isHoriz ? 'HORIZONTAL' : 'VERTICAL';
  overlay.itemSpacing = getOverlayItemSpacing(side, bounds);
  overlay.primaryAxisAlignItems = 'MIN';
  overlay.counterAxisAlignItems = 'MIN';
  overlay.clipsContent = false;
  overlay.x = Math.round(bounds.x);
  overlay.y = Math.round(bounds.y);
  overlay.resize(bw, bh);
  overlay.fills = [];

  applyOverlayPaddingForSide(overlay, side, bounds);

  if (kind === 'padding') {
    await applyPaddingOverlayStroke(overlay, side);
  } else {
    await applyGapOverlayStrokeForSide(overlay, side);
  }

  try {
    overlay.primaryAxisSizingMode = 'FIXED';
    overlay.counterAxisSizingMode = 'FIXED';
  } catch {
    /* ignore */
  }

  const zeroPoint = createZeroPointFrame();
  const measureFill = await createMeasureFillFrame(kind, bounds);
  const valueSquare = await createSpacingValueSquare(kind, tokenizedValue);

  overlay.appendChild(zeroPoint);
  overlay.appendChild(measureFill);
  overlay.appendChild(valueSquare);

  if (gapValueSquareAlign) {
    const globalPos = getGapValueSquarePosition({
      gapOrientation: gapValueSquareAlign.gapOrientation,
      gapRect: gapValueSquareAlign.gapRect,
      valueSquareSize: {
        width: valueSquare.width,
        height: valueSquare.height,
      },
      paddingValueAnchors: gapValueSquareAlign.paddingValueAnchors,
    });
    try {
      valueSquare.layoutPositioning = 'ABSOLUTE';
    } catch {
      /* ignore */
    }
    valueSquare.x = Math.round(globalPos.x - overlay.x);
    valueSquare.y = Math.round(globalPos.y - overlay.y);
  } else {
    positionValueSquareForSpacingSide(valueSquare, overlay, side);
  }

  return {
    node: overlay,
    valueAnchor: {
      x: Math.round(overlay.x + valueSquare.x),
      y: Math.round(overlay.y + valueSquare.y),
    },
  };
}

/** Gap border follows the same sides as padding for Top/Bottom vs Left/Right. */
async function applyGapOverlayStrokeForSide(
  overlay: FrameNode,
  side: SpacingSideName
): Promise<void> {
  if (side === 'Top' || side === 'Bottom') {
    await applyGapOverlayStroke(overlay, 'horizontal');
    return;
  }
  await applyGapOverlayStroke(overlay, 'vertical');
}
