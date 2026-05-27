/// <reference types="@figma/plugin-typings" />
import { createPluginFrame, createPluginRectangle } from '../figma/pluginSceneNodes';

import type { GapOrientation, PaddingValueAnchors, Rect } from './overlayGeometry';
import { roundRect } from './overlayGeometry';
import { applyGapGuideLineFill, applyGapMeasureFill } from './overlayStyles';
import {
  createGapValueSquare,
  GAP_VALUE_SQUARE_OFFSET_LEFT_HORIZONTAL,
  GAP_VALUE_SQUARE_OFFSET_TOP,
  GAP_VALUE_SQUARE_SIZE,
  SPACING_OVERLAY_LAYOUT,
} from './spacingSideOverlay';
import type { TokenizedSpacingValue } from './paddingOverlay';

export type GapOverlayOrientation = GapOrientation;

export type GapOverlayPaddingValues = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type GapOverlayItemParams = {
  index: number;
  orientation: GapOverlayOrientation;
  overlayRect: Rect;
  measureRect: Rect;
  tokenizedValue: TokenizedSpacingValue;
  paddingValues: GapOverlayPaddingValues;
  paddingValueAnchors: PaddingValueAnchors;
};

export type GapOverlayItemResult = {
  node: FrameNode;
  valueSquare: FrameNode;
};

function createZeroPointFrame(): FrameNode {
  const frame = createPluginFrame();
  frame.name = 'Zero point';
  frame.fills = [];
  frame.strokes = [];
  frame.resize(0, 0);
  return frame;
}

async function createAbsoluteGapBorder(
  name: string,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<RectangleNode> {
  const line = createPluginRectangle();
  line.name = name;
  line.resize(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
  line.x = Math.round(x);
  line.y = Math.round(y);
  line.strokes = [];
  try {
    line.layoutPositioning = 'ABSOLUTE';
  } catch {
    /* ignore */
  }
  await applyGapGuideLineFill(line);
  return line;
}

async function createGapMeasureFillFrame(): Promise<FrameNode> {
  const frame = createPluginFrame();
  frame.name = 'Gap measure fill';
  frame.fills = [];
  frame.strokes = [];
  frame.clipsContent = false;
  frame.resize(1, 1);

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

  await applyGapMeasureFill(frame);
  return frame;
}

function positionGapValueSquare(params: {
  square: FrameNode;
  overlay: FrameNode;
  overlayRect: Rect;
  orientation: GapOverlayOrientation;
  paddingValueAnchors: PaddingValueAnchors;
}): void {
  const { square, overlay, overlayRect, orientation, paddingValueAnchors } = params;

  try {
    square.layoutPositioning = 'ABSOLUTE';
  } catch {
    /* ignore */
  }

  if (orientation === 'vertical') {
    const anchorY = paddingValueAnchors.left?.y ?? paddingValueAnchors.right?.y;
    square.x = Math.round(overlay.width / 2 - GAP_VALUE_SQUARE_SIZE / 2);
    square.y =
      anchorY != null
        ? Math.round(anchorY - overlayRect.y)
        : GAP_VALUE_SQUARE_OFFSET_TOP;
    return;
  }

  const anchorX = paddingValueAnchors.top?.x ?? paddingValueAnchors.bottom?.x;
  square.x =
    anchorX != null
      ? Math.round(anchorX - overlayRect.x)
      : GAP_VALUE_SQUARE_OFFSET_LEFT_HORIZONTAL;
  square.y = Math.round(overlay.height / 2 - GAP_VALUE_SQUARE_SIZE / 2);
}

/**
 * Gap overlay — HTML/CSS spec:
 * column/row flex, gap = paddingTop/Left + 20, paddingBottom/Right,
 * border #FF5C52, Zero point + measure fill (flex 1), absolute value square.
 */
export async function createGapOverlayAutoLayout(
  params: GapOverlayItemParams
): Promise<GapOverlayItemResult | null> {
  const {
    index,
    orientation,
    overlayRect,
    tokenizedValue,
    paddingValues,
    paddingValueAnchors,
  } = params;

  if (!tokenizedValue || Number(tokenizedValue.value) === 0) return null;

  const roundedOverlay = roundRect(overlayRect);
  if (roundedOverlay.width <= 0 || roundedOverlay.height <= 0) return null;

  const isVertical = orientation === 'vertical';
  const labelSpacing = isVertical
    ? paddingValues.top + SPACING_OVERLAY_LAYOUT.extraSize
    : paddingValues.left + SPACING_OVERLAY_LAYOUT.extraSize;

  const overlay = createPluginFrame();
  overlay.name = `Gap overlay / ${index + 1}`;
  overlay.fills = [];
  overlay.strokes = [];
  overlay.clipsContent = false;
  overlay.x = roundedOverlay.x;
  overlay.y = roundedOverlay.y;
  overlay.resize(Math.max(1, roundedOverlay.width), Math.max(1, roundedOverlay.height));

  overlay.layoutMode = isVertical ? 'VERTICAL' : 'HORIZONTAL';
  overlay.primaryAxisSizingMode = 'FIXED';
  overlay.counterAxisSizingMode = 'FIXED';
  overlay.primaryAxisAlignItems = 'MIN';
  overlay.counterAxisAlignItems = 'CENTER';
  overlay.itemSpacing = Math.round(labelSpacing);
  overlay.paddingTop = 0;
  overlay.paddingLeft = 0;

  if (isVertical) {
    overlay.paddingBottom = Math.round(paddingValues.bottom);
    overlay.paddingRight = 0;
  } else {
    overlay.paddingRight = Math.round(paddingValues.right);
    overlay.paddingBottom = 0;
  }

  if (isVertical) {
    const leftBorder = await createAbsoluteGapBorder(
      'Gap border / left',
      0,
      0,
      1,
      roundedOverlay.height
    );
    const rightBorder = await createAbsoluteGapBorder(
      'Gap border / right',
      roundedOverlay.width - 1,
      0,
      1,
      roundedOverlay.height
    );
    overlay.appendChild(leftBorder);
    overlay.appendChild(rightBorder);
  } else {
    const topBorder = await createAbsoluteGapBorder(
      'Gap border / top',
      0,
      0,
      roundedOverlay.width,
      1
    );
    const bottomBorder = await createAbsoluteGapBorder(
      'Gap border / bottom',
      0,
      roundedOverlay.height - 1,
      roundedOverlay.width,
      1
    );
    overlay.appendChild(topBorder);
    overlay.appendChild(bottomBorder);
  }

  const zeroPoint = createZeroPointFrame();
  const measureFill = await createGapMeasureFillFrame();

  overlay.appendChild(zeroPoint);
  overlay.appendChild(measureFill);

  const valueSquare = await createGapValueSquare(tokenizedValue);
  positionGapValueSquare({
    square: valueSquare,
    overlay,
    overlayRect: roundedOverlay,
    orientation,
    paddingValueAnchors,
  });
  overlay.appendChild(valueSquare);

  return { node: overlay, valueSquare };
}
