/// <reference types="@figma/plugin-typings" />

import type {
  AnatomyLabelLayout,
  AnatomyLayoutItem,
  AnatomySide,
  Bounds,
  Point,
} from './anatomyLayoutTypes';
import {
  ANATOMY_POINTER_LABEL_GAP,
  ANATOMY_POINTER_OFFSET,
} from './anatomyStyles';

const ALIGN_EPSILON = 1;

export function resolveVerticalLabelCollisions(
  labels: AnatomyLabelLayout[],
  labelGap: number
): AnatomyLabelLayout[] {
  if (labels.length <= 1) {
    return labels;
  }

  const sorted = [...labels];
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const current = sorted[i];
    const minY = prev.labelBounds.y + prev.labelBounds.height + labelGap;
    if (current.labelBounds.y < minY) {
      const delta = minY - current.labelBounds.y;
      const nextY = current.labelBounds.y + delta;
      current.labelBounds = {
        ...current.labelBounds,
        y: nextY,
      };
      current.resolvedCenterY = nextY + current.labelBounds.height / 2;
    }
  }

  return sorted;
}

export function placeAnatomyLabels(params: {
  frameBounds: Bounds;
  items: AnatomyLayoutItem[];
  labelSizes: Map<string, { width: number; height: number }>;
  horizontalOffset: number;
  labelGap: number;
  minTopY?: number;
  maxBottomY?: number;
}): AnatomyLabelLayout[] {
  return placeStraightAnatomyLabels({
    frameBounds: params.frameBounds,
    items: params.items,
    labelSizes: params.labelSizes,
    offset: params.horizontalOffset,
    labelGap: params.labelGap,
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getTargetPointForSide(bounds: Bounds, side: AnatomySide): Point {
  if (side === 'top') {
    return { x: bounds.x + bounds.width / 2, y: bounds.y };
  }
  if (side === 'right') {
    return { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 };
  }
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height };
}

function getLabelAnchorPointForSide(labelBounds: Bounds, side: AnatomySide): Point {
  if (side === 'top') {
    return { x: labelBounds.x + labelBounds.width / 2, y: labelBounds.y + labelBounds.height };
  }
  if (side === 'right') {
    return { x: labelBounds.x, y: labelBounds.y + labelBounds.height / 2 };
  }
  return { x: labelBounds.x + labelBounds.width / 2, y: labelBounds.y };
}

function resolveCollisionsOnAxis(
  labels: AnatomyLabelLayout[],
  axis: 'x' | 'y',
  gap: number
): AnatomyLabelLayout[] {
  if (labels.length <= 1) {
    return labels;
  }
  const sorted = [...labels];
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const current = sorted[i];
    if (axis === 'x') {
      const minX = prev.labelBounds.x + prev.labelBounds.width + gap;
      if (current.labelBounds.x < minX) {
        const nextX = minX;
        current.labelBounds = { ...current.labelBounds, x: nextX };
      }
    } else {
      const minY = prev.labelBounds.y + prev.labelBounds.height + gap;
      if (current.labelBounds.y < minY) {
        const nextY = minY;
        current.labelBounds = { ...current.labelBounds, y: nextY };
      }
    }
  }
  return sorted;
}

export function placeAnatomyLabelsByZones(params: {
  frameBounds: Bounds;
  items: AnatomyLayoutItem[];
  labelSizes: Map<string, { width: number; height: number }>;
  horizontalOffset: number;
  labelGap: number;
  minTopY?: number;
  maxBottomY?: number;
}): AnatomyLabelLayout[] {
  return placeStraightAnatomyLabels({
    frameBounds: params.frameBounds,
    items: params.items,
    labelSizes: params.labelSizes,
    offset: params.horizontalOffset,
    labelGap: params.labelGap,
  });
}

export function placeStraightAnatomyLabels(params: {
  frameBounds: Bounds;
  items: AnatomyLayoutItem[];
  labelSizes: Map<string, { width: number; height: number }>;
  offset: number;
  labelGap: number;
}): AnatomyLabelLayout[] {
  const {
    frameBounds,
    items,
    labelSizes,
    offset = ANATOMY_POINTER_OFFSET,
    labelGap = ANATOMY_POINTER_LABEL_GAP,
  } = params;
  const topY = frameBounds.y - offset;
  const rightX = frameBounds.x + frameBounds.width + offset;
  const bottomY = frameBounds.y + frameBounds.height + offset;

  const topItems = items
    .filter((item) => (item.routeZone ?? 'right') === 'top')
    .sort((a, b) => a.targetBounds.x - b.targetBounds.x);
  const rightItems = items
    .filter((item) => (item.routeZone ?? 'right') === 'right')
    .sort((a, b) => a.targetBounds.y - b.targetBounds.y);
  const bottomItems = items
    .filter((item) => (item.routeZone ?? 'right') === 'bottom')
    .sort((a, b) => a.targetBounds.x - b.targetBounds.x);

  const build = (item: AnatomyLayoutItem, side: AnatomySide): AnatomyLabelLayout => {
    const size = labelSizes.get(item.id) ?? { width: 24, height: 24 };
    const targetCenterX = item.targetBounds.x + item.targetBounds.width / 2;
    const targetCenterY = item.targetBounds.y + item.targetBounds.height / 2;
    let x = targetCenterX - size.width / 2;
    let y = targetCenterY - size.height / 2;
    if (side === 'top') {
      y = topY;
    } else if (side === 'right') {
      x = rightX;
    } else {
      y = bottomY;
    }
    const labelBounds: Bounds = { x, y, width: size.width, height: size.height };
    const targetPoint = getTargetPointForSide(item.targetBounds, side);
    const anchorPoint = getLabelAnchorPointForSide(labelBounds, side);
    return {
      itemId: item.id,
      labelText: item.index,
      side,
      preferredCenterY: targetCenterY,
      resolvedCenterY: y + size.height / 2,
      labelBounds,
      anchorPoint,
      targetPoint,
    };
  };

  const placedTop = resolveCollisionsOnAxis(topItems.map((item) => build(item, 'top')), 'x', labelGap);
  const placedRight = resolveCollisionsOnAxis(
    rightItems.map((item) => build(item, 'right')),
    'y',
    labelGap
  );
  const placedBottom = resolveCollisionsOnAxis(
    bottomItems.map((item) => build(item, 'bottom')),
    'x',
    labelGap
  );

  return [...placedTop, ...placedRight, ...placedBottom].map((label) => ({
    ...label,
    anchorPoint: getLabelAnchorPointForSide(label.labelBounds, label.side),
  }));
}
