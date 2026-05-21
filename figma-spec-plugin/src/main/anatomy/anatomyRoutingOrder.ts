/// <reference types="@figma/plugin-typings" />

import { ANATOMY_POINTER_ROW_THRESHOLD_MIN } from './anatomyStyles';
import type { AnatomyLayoutItem, Bounds, AnatomyRouteZone } from './anatomyLayoutTypes';
import {
  ANATOMY_POINTER_TOP_SIDE_MAX_ITEMS_RATIO,
  ANATOMY_POINTER_BOTTOM_SIDE_MAX_ITEMS_RATIO,
} from './anatomyStyles';

function boundsCenterY(bounds: AnatomyLayoutItem['targetBounds']): number {
  return bounds.y + bounds.height / 2;
}

function rightEdge(bounds: AnatomyLayoutItem['targetBounds']): number {
  return bounds.x + bounds.width;
}

export function computeRowThreshold(items: AnatomyLayoutItem[]): number {
  if (items.length === 0) {
    return ANATOMY_POINTER_ROW_THRESHOLD_MIN;
  }
  const avgHeight =
    items.reduce((sum, item) => sum + item.targetBounds.height, 0) / items.length;
  return Math.max(ANATOMY_POINTER_ROW_THRESHOLD_MIN, avgHeight * 0.6);
}

export function groupItemsIntoVisualRows(items: AnatomyLayoutItem[]): AnatomyLayoutItem[][] {
  if (items.length === 0) {
    return [];
  }

  const rowThreshold = computeRowThreshold(items);
  const sortedByY = [...items].sort(
    (a, b) => boundsCenterY(a.targetBounds) - boundsCenterY(b.targetBounds)
  );

  const rows: AnatomyLayoutItem[][] = [];

  for (const item of sortedByY) {
    const centerY = boundsCenterY(item.targetBounds);
    let placed = false;

    for (const row of rows) {
      const rowCenterY =
        row.reduce((sum, entry) => sum + boundsCenterY(entry.targetBounds), 0) / row.length;
      if (Math.abs(centerY - rowCenterY) <= rowThreshold) {
        row.push(item);
        placed = true;
        break;
      }
    }

    if (!placed) {
      rows.push([item]);
    }
  }

  return rows
    .map((row) =>
      [...row].sort((a, b) => rightEdge(b.targetBounds) - rightEdge(a.targetBounds))
    )
    .sort((a, b) => {
      const aY = boundsCenterY(a[0].targetBounds);
      const bY = boundsCenterY(b[0].targetBounds);
      return aY - bY;
    });
}

export function classifyAnatomyRouteZone(params: {
  item: AnatomyLayoutItem;
  frameBounds: Bounds;
  rowItems: AnatomyLayoutItem[];
}): AnatomyRouteZone {
  const { item, frameBounds, rowItems } = params;
  const targetCenterY = item.targetBounds.y + item.targetBounds.height / 2;
  const frameTop = frameBounds.y;
  const frameHeight = frameBounds.height;
  const upperThreshold = frameTop + frameHeight * 0.35;
  const lowerThreshold = frameTop + frameHeight * 0.65;
  const targetRight = item.targetBounds.x + item.targetBounds.width;
  const frameRight = frameBounds.x + frameBounds.width;

  if (targetCenterY <= upperThreshold) {
    return 'top';
  }

  if (item.isFirstInRow || targetRight >= frameRight - Math.max(24, frameBounds.width * 0.2)) {
    return 'right';
  }

  if (rowItems.length > 1 && !item.isFirstInRow) {
    return 'bottom';
  }

  if (targetCenterY >= lowerThreshold) {
    return 'bottom';
  }

  return 'right';
}

function orderSegmentForRouting(segment: AnatomyLayoutItem[]): AnatomyLayoutItem[] {
  if (segment.length <= 1) {
    return segment.map((item, rowIndex) => ({
      ...item,
      rowIndex: 0,
      isFirstInRow: true,
    }));
  }

  const parent = segment[0];
  const nested = segment.slice(1);
  const rows = groupItemsIntoVisualRows(nested);
  const orderedNested: AnatomyLayoutItem[] = [];

  rows.forEach((row, rowIndex) => {
    row.forEach((item, itemIndex) => {
      orderedNested.push({
        ...item,
        rowIndex,
        isFirstInRow: itemIndex === 0,
      });
    });
  });

  return [
    { ...parent, rowIndex: 0, isFirstInRow: true },
    ...orderedNested,
  ];
}

/**
 * Routing order: top-level sequence preserved; nested items grouped into visual rows (RTL).
 */
export function prepareAnatomyRoutingOrder(items: AnatomyLayoutItem[]): AnatomyLayoutItem[] {
  const result: AnatomyLayoutItem[] = [];
  let index = 0;

  while (index < items.length) {
    const item = items[index];
    if (item.level !== 'root') {
      result.push({ ...item, rowIndex: 0, isFirstInRow: true });
      index += 1;
      continue;
    }

    const segment: AnatomyLayoutItem[] = [item];
    index += 1;

    while (
      index < items.length &&
      items[index].level === 'child' &&
      items[index].parentIndex === item.index
    ) {
      segment.push(items[index]);
      index += 1;
    }

    result.push(...orderSegmentForRouting(segment));
  }

  return result;
}

export function assignAnatomyRouteZones(
  items: AnatomyLayoutItem[],
  frameBounds: Bounds
): AnatomyLayoutItem[] {
  return assignAnatomySides({ frameBounds, items });
}

export function assignAnatomySides(params: {
  frameBounds: Bounds;
  items: AnatomyLayoutItem[];
}): AnatomyLayoutItem[] {
  const { frameBounds, items } = params;
  if (items.length === 0) {
    return [];
  }

  const sorted = [...items].sort((a, b) => {
    const ay = a.targetBounds.y + a.targetBounds.height / 2;
    const by = b.targetBounds.y + b.targetBounds.height / 2;
    if (Math.abs(ay - by) > 1) return ay - by;
    return a.targetBounds.x - b.targetBounds.x;
  });

  const maxTop = Math.floor(items.length * ANATOMY_POINTER_TOP_SIDE_MAX_ITEMS_RATIO);
  const maxBottom = Math.floor(items.length * ANATOMY_POINTER_BOTTOM_SIDE_MAX_ITEMS_RATIO);
  const topCutoff = Math.max(0, maxTop);
  const bottomCutoff = Math.max(0, maxBottom);

  return sorted.map((item, index) => {
    const centerY = item.targetBounds.y + item.targetBounds.height / 2;
    const frameTop = frameBounds.y;
    const frameBottom = frameBounds.y + frameBounds.height;
    const upperThird = frameTop + frameBounds.height / 3;
    const lowerThird = frameBottom - frameBounds.height / 3;
    const rightEdgeDistance =
      frameBounds.x + frameBounds.width - (item.targetBounds.x + item.targetBounds.width);

    let side: AnatomyRouteZone = 'right';
    if (index < topCutoff || centerY <= upperThird) {
      side = 'top';
    } else if (index >= sorted.length - bottomCutoff || centerY >= lowerThird) {
      side = 'bottom';
    }
    if (rightEdgeDistance <= Math.max(24, frameBounds.width * 0.18)) {
      side = 'right';
    }

    return {
      ...item,
      routeZone: side,
    };
  });
}
