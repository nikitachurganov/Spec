/// <reference types="@figma/plugin-typings" />
import { createPluginFrame, createPluginText } from '../figma/pluginSceneNodes';

import { getNodeBoundsRelativeToRoot } from '../figma/nodeBounds';
import { loadFontOnce } from '../figma/text';
import type { OverlayGeometryContext, Rect } from './overlayGeometry';
import {
  getHorizontalGapOverlayRect,
  getInnerBounds,
  getVerticalGapOverlayRect,
  roundRect,
} from './overlayGeometry';
import type { TokenizedSpacingValue } from './paddingOverlay';
import {
  applyGapMeasureFill,
  applyGapOverlayStroke,
  applyGapValueSquareFill,
  applyValueSquareLabelInverse,
} from './overlayStyles';

export type GapOverlayBounds = Rect & {
  /** `vertical` = strip between horizontal children. `horizontal` = strip between vertical children. */
  orientation: 'vertical' | 'horizontal';
};

export type GapOverlayOrientation = GapOverlayBounds['orientation'];

export type PreviewContainerForGap = {
  layout?: { direction?: string };
  spacing?: { gap?: TokenizedSpacingValue | null };
};

export type GapOverlayPaddingValues = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type GapOverlayItemParams = {
  index: number;
  orientation: GapOverlayOrientation;
  targetBounds: Rect;
  gapRect: Rect;
  paddingValues: GapOverlayPaddingValues;
  valueLabel: string;
};

const FONT_REGULAR: FontName = { family: 'PT Sans', style: 'Regular' };
const VALUE_SQUARE_HEIGHT = 20;
const GAP_VALUE_SQUARE_OFFSET_Y = 24;
const GAP_OVERLAY_SPACER = 20;

function createZeroPointFrame(): FrameNode {
  const frame = createPluginFrame();
  frame.name = 'Zero point';
  frame.fills = [];
  frame.strokes = [];
  frame.resize(0, 0);
  return frame;
}

function getVisibleLayoutChildren(node: SceneNode): SceneNode[] {
  if (!('children' in node) || !node.children?.length) return [];

  return node.children.filter((child) => {
    const c = child as SceneNode;
    if ('visible' in c && c.visible === false) return false;
    const name = String(c.name || '');
    if (name.startsWith('_')) return false;
    if (name.startsWith('Padding overlay')) return false;
    if (name.startsWith('Gap overlay')) return false;
    if (name.startsWith('Child overlay')) return false;
    if (name.startsWith('Preview /')) return false;
    if (name.startsWith('Target container outline')) return false;
    if (typeof c.width !== 'number' || typeof c.height !== 'number') return false;
    return c.width > 0 && c.height > 0;
  }) as SceneNode[];
}

export function getGapBoundsBetweenChildrenRelativeToRoot(
  previousChild: SceneNode,
  nextChild: SceneNode,
  rootClone: SceneNode,
  innerBounds: Rect,
  containerLayoutDirection: 'vertical' | 'horizontal'
): GapOverlayBounds | null {
  const prev = getNodeBoundsRelativeToRoot(previousChild, rootClone);
  const next = getNodeBoundsRelativeToRoot(nextChild, rootClone);

  if (containerLayoutDirection === 'vertical') {
    const y = Math.round(prev.y + prev.height);
    const height = Math.round(next.y - y);
    if (height <= 0) return null;

    return {
      ...roundRect({
        x: innerBounds.x,
        y,
        width: innerBounds.width,
        height,
      }),
      orientation: 'horizontal',
    };
  }

  if (containerLayoutDirection === 'horizontal') {
    const x = Math.round(prev.x + prev.width);
    const width = Math.round(next.x - x);
    if (width <= 0) return null;

    return {
      ...roundRect({
        x,
        y: innerBounds.y,
        width,
        height: innerBounds.height,
      }),
      orientation: 'vertical',
    };
  }

  return null;
}

/** Overlay strip aligned to target content box (padding inset). */
function computeGapOverlayRect(params: GapOverlayItemParams): Rect {
  const { orientation, targetBounds, gapRect, paddingValues } = params;
  const gap = roundRect(gapRect);
  const innerBounds = getInnerBounds(targetBounds, paddingValues);

  if (orientation === 'vertical') {
    return getVerticalGapOverlayRect(gap, innerBounds);
  }

  return getHorizontalGapOverlayRect(gap, innerBounds);
}

async function createGapMeasureFill(bounds: Rect): Promise<FrameNode> {
  const frame = createPluginFrame();
  frame.name = 'Gap measure fill';
  frame.fills = [];
  frame.strokes = [];
  frame.clipsContent = false;
  frame.resize(
    Math.max(1, Math.round(bounds.width)),
    Math.max(1, Math.round(bounds.height))
  );
  await applyGapMeasureFill(frame);
  return frame;
}

function applyGapMeasureFillLayout(frame: FrameNode, isVerticalStrip: boolean): void {
  try {
    frame.layoutGrow = isVerticalStrip ? 1 : 0;
  } catch {
    /* ignore */
  }
  try {
    frame.layoutAlign = 'STRETCH';
  } catch {
    /* ignore */
  }
}

async function createGapValueSquare(valueLabel: string): Promise<FrameNode> {
  const square = createPluginFrame();
  square.name = 'Gap value square';
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
  square.cornerRadius = 4;
  square.clipsContent = false;
  square.fills = [];
  square.strokes = [];

  await applyGapValueSquareFill(square);

  await loadFontOnce(FONT_REGULAR);
  const text = createPluginText();
  text.name = 'Gap value text';
  text.fontName = FONT_REGULAR;
  text.fontSize = 12;
  text.lineHeight = { unit: 'PERCENT', value: 130 };
  text.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  text.characters = valueLabel || '—';
  text.textAlignHorizontal = 'CENTER';
  text.textAlignVertical = 'CENTER';
  square.appendChild(text);
  await applyValueSquareLabelInverse(text);

  square.resize(Math.max(20, Math.round(square.width)), VALUE_SQUARE_HEIGHT);

  return square;
}

function positionGapValueSquare(
  square: FrameNode,
  overlayWidth: number,
  overlayHeight: number,
  isVerticalStrip: boolean
): void {
  try {
    square.layoutPositioning = 'ABSOLUTE';
  } catch {
    /* ignore */
  }

  if (isVerticalStrip) {
    square.x = Math.round(overlayWidth / 2 - square.width / 2);
    square.y = -GAP_VALUE_SQUARE_OFFSET_Y;
    return;
  }

  square.x = -GAP_VALUE_SQUARE_OFFSET_Y;
  square.y = Math.round(overlayHeight / 2 - square.height / 2);
}

/**
 * Reference layout: narrow strip, semi-transparent fill, side outline stroke, label above center (y = -24).
 */
export async function createGapOverlayItem(params: GapOverlayItemParams): Promise<FrameNode | null> {
  const gapRect = roundRect(params.gapRect);
  if (gapRect.width <= 0 || gapRect.height <= 0) return null;

  const overlayRect = computeGapOverlayRect(params);
  const innerBounds = getInnerBounds(params.targetBounds, params.paddingValues);
  const isVerticalStrip = params.orientation === 'vertical';
  const paddingTopOverlayHeight = Math.max(0, Math.round(params.paddingValues.top));

  const contentHeight = Math.max(1, innerBounds.height);
  const measuredAreaWidth = Math.max(1, innerBounds.width);
  const paddingBottomOverlayWidth = Math.max(
    1,
    Math.round(params.targetBounds.width + GAP_OVERLAY_SPACER)
  );

  let overlayWidth = Math.max(1, overlayRect.width);
  let overlayHeight = Math.max(1, overlayRect.height);
  let overlayX = overlayRect.x;
  let overlayY = overlayRect.y;
  let overlayPaddingTop = 0;
  let overlayPaddingLeft = 0;
  let overlayPaddingRight = 0;

  if (isVerticalStrip) {
    overlayHeight = Math.max(1, Math.round(params.targetBounds.height + GAP_OVERLAY_SPACER));
    overlayY = Math.round(params.targetBounds.y - GAP_OVERLAY_SPACER);
    overlayPaddingTop = paddingTopOverlayHeight;
  } else {
    overlayWidth = paddingBottomOverlayWidth;
    overlayX = Math.round(params.targetBounds.x - GAP_OVERLAY_SPACER);
    overlayPaddingLeft = Math.max(0, Math.round(params.paddingValues.left));
    overlayPaddingRight = Math.max(0, Math.round(params.paddingValues.right));
  }

  const overlay = createPluginFrame();
  overlay.name = `Gap overlay / ${params.index + 1}`;
  overlay.layoutMode = isVerticalStrip ? 'VERTICAL' : 'HORIZONTAL';
  overlay.primaryAxisSizingMode = 'FIXED';
  overlay.counterAxisSizingMode = 'FIXED';
  overlay.primaryAxisAlignItems = 'MIN';
  overlay.counterAxisAlignItems = 'CENTER';
  overlay.itemSpacing = GAP_OVERLAY_SPACER;
  overlay.paddingTop = overlayPaddingTop;
  overlay.paddingRight = overlayPaddingRight;
  overlay.paddingBottom = isVerticalStrip
    ? Math.max(0, Math.round(params.paddingValues.bottom))
    : 0;
  overlay.paddingLeft = overlayPaddingLeft;
  overlay.fills = [];
  overlay.strokes = [];
  overlay.clipsContent = false;
  overlay.x = overlayX;
  overlay.y = overlayY;
  overlay.resize(overlayWidth, overlayHeight);

  await applyGapOverlayStroke(overlay, isVerticalStrip ? 'vertical' : 'horizontal');

  const zeroPoint = createZeroPointFrame();
  const measureFill = await createGapMeasureFill({
    x: 0,
    y: 0,
    width: isVerticalStrip ? overlayWidth : measuredAreaWidth,
    height: isVerticalStrip ? contentHeight : Math.max(1, overlayRect.height),
  });
  const valueSquare = await createGapValueSquare(params.valueLabel);

  overlay.appendChild(zeroPoint);
  overlay.appendChild(measureFill);
  applyGapMeasureFillLayout(measureFill, isVerticalStrip);
  overlay.appendChild(valueSquare);
  positionGapValueSquare(valueSquare, overlayWidth, overlayHeight, isVerticalStrip);

  return overlay;
}

export async function createGapOverlaysForTarget(
  geometry: OverlayGeometryContext,
  container: PreviewContainerForGap
): Promise<FrameNode[]> {
  const overlays: FrameNode[] = [];

  const tokenizedGap = container.spacing?.gap;
  if (!tokenizedGap) return overlays;

  const gapNum = Number(tokenizedGap.value);
  if (Number.isNaN(gapNum) || gapNum <= 0) return overlays;

  const layoutDirection = container.layout?.direction;
  if (layoutDirection !== 'horizontal' && layoutDirection !== 'vertical') {
    return overlays;
  }

  const { targetClone, rootClone, targetBounds, padding } = geometry;
  const innerBounds = getInnerBounds(targetBounds, padding);
  const paddingValues: GapOverlayPaddingValues = {
    top: padding.top,
    right: padding.right,
    bottom: padding.bottom,
    left: padding.left,
  };

  const children = getVisibleLayoutChildren(targetClone);
  if (children.length < 2) return overlays;

  const valueLabel = String(Math.round(gapNum));

  for (let i = 0; i < children.length - 1; i++) {
    const bounds = getGapBoundsBetweenChildrenRelativeToRoot(
      children[i],
      children[i + 1],
      rootClone,
      innerBounds,
      layoutDirection
    );

    if (!bounds) continue;

    const item = await createGapOverlayItem({
      index: i,
      orientation: bounds.orientation,
      targetBounds,
      gapRect: bounds,
      paddingValues,
      valueLabel,
    });

    if (item) overlays.push(item);
  }

  return overlays;
}
