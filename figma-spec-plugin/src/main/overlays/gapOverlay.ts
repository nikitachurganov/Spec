/// <reference types="@figma/plugin-typings" />

import { getNodeBoundsRelativeToRoot } from '../figma/nodeBounds';
import type { OverlayGeometryContext, Rect } from './overlayGeometry';
import {
  getHorizontalGapOverlayRect,
  getVerticalGapOverlayRect,
  getInnerBounds,
  roundRect,
} from './overlayGeometry';
import type { TokenizedSpacingValue } from './paddingOverlay';
import { createGapOverlayAutoLayout } from './spacingOverlaySide';

export type GapOverlayBounds = Rect & {
  /** `horizontal` = strip between vertical children (analog Top/Bottom). `vertical` = strip between horizontal children (analog Left/Right). */
  orientation: 'horizontal' | 'vertical';
};

export type PreviewContainerForGap = {
  layout?: { direction?: string };
  spacing?: { gap?: TokenizedSpacingValue | null };
};

/** Container layout → gap strip orientation. */
export function getGapStripOrientation(
  containerLayoutDirection: 'vertical' | 'horizontal'
): 'horizontal' | 'vertical' {
  return containerLayoutDirection === 'horizontal' ? 'vertical' : 'horizontal';
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

function normalizeGapBounds(bounds: GapOverlayBounds): GapOverlayBounds {
  const normalized: GapOverlayBounds = {
    ...roundRect({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    }),
    orientation: bounds.orientation,
  };

  const minSize = 8;

  if (
    bounds.orientation === 'vertical' &&
    normalized.width > 0 &&
    normalized.width < minSize
  ) {
    const delta = minSize - normalized.width;
    normalized.x -= delta / 2;
    normalized.width = minSize;
  }

  if (
    bounds.orientation === 'horizontal' &&
    normalized.height > 0 &&
    normalized.height < minSize
  ) {
    const delta = minSize - normalized.height;
    normalized.y -= delta / 2;
    normalized.height = minSize;
  }

  return normalized;
}

/**
 * Single gap zone — Auto Layout analog of Padding overlay side.
 */
export async function createGapOverlayItem(
  index: number,
  bounds: GapOverlayBounds,
  tokenizedGap: TokenizedSpacingValue,
  geometry: OverlayGeometryContext
): Promise<FrameNode | null> {
  if (bounds.width <= 0 || bounds.height <= 0) return null;

  const gapNum = Number(tokenizedGap?.value);
  if (!tokenizedGap || Number.isNaN(gapNum) || gapNum <= 0) return null;

  const normalizedBounds = normalizeGapBounds(bounds);
  const orientation = normalizedBounds.orientation;

  const measureRect = roundRect({
    x: normalizedBounds.x,
    y: normalizedBounds.y,
    width: normalizedBounds.width,
    height: normalizedBounds.height,
  });

  const { targetBounds, padding } = geometry;
  const overlayRect =
    orientation === 'vertical'
      ? getVerticalGapOverlayRect(measureRect, targetBounds)
      : getHorizontalGapOverlayRect(measureRect, targetBounds);

  const result = await createGapOverlayAutoLayout({
    index,
    orientation,
    overlayRect,
    measureRect,
    tokenizedValue: tokenizedGap,
    paddingValues: {
      top: padding.top,
      right: padding.right,
      bottom: padding.bottom,
      left: padding.left,
    },
    paddingValueAnchors: geometry.paddingValueAnchors,
  });

  return result?.node ?? null;
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

  const children = getVisibleLayoutChildren(targetClone);
  if (children.length < 2) return overlays;

  for (let i = 0; i < children.length - 1; i++) {
    const bounds = getGapBoundsBetweenChildrenRelativeToRoot(
      children[i],
      children[i + 1],
      rootClone,
      innerBounds,
      layoutDirection
    );

    if (!bounds) continue;

    const item = await createGapOverlayItem(i, bounds, tokenizedGap, geometry);
    if (item) overlays.push(item);
  }

  return overlays;
}
