/// <reference types="@figma/plugin-typings" />

import { ANATOMY_POINTER_BEND_LANE_STEP } from './anatomyStyles';
import type {
  AnatomyAnchorType,
  AnatomyLabelLayout,
  AnatomyLayoutItem,
  AnatomyRoute,
  AnatomyRouteType,
  AnatomyRouteZone,
  Bounds,
  Point,
  Segment,
} from './anatomyLayoutTypes';
import {
  buildRouteSegments,
  doSegmentsIntersect,
  doSegmentsOverlap,
  doesRouteIntersectRoute,
  doesSegmentIntersectRect,
} from './anatomyPointerLayout';

const ALIGN_EPSILON = 1;

export function getTargetAnchors(bounds: Bounds): {
  top: Point;
  right: Point;
  bottom: Point;
} {
  return {
    top: { x: bounds.x + bounds.width / 2, y: bounds.y },
    right: { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 },
    bottom: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height },
  };
}

export function getLabelLeftCenter(bounds: Bounds): Point {
  return {
    x: bounds.x,
    y: bounds.y + bounds.height / 2,
  };
}

export function getPolylineSegments(route: AnatomyRoute): Segment[] {
  return route.segments;
}

export { doSegmentsIntersect, doSegmentsOverlap, doesSegmentIntersectRect, doesRouteIntersectRoute };

function hasAtMostOneBend(route: AnatomyRoute): boolean {
  return route.segments.length <= 2;
}

function rectContainsPoint(rect: Bounds, point: Point): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

function routeTotalLength(route: AnatomyRoute): number {
  return route.segments.reduce(
    (sum, seg) => sum + Math.hypot(seg.to.x - seg.from.x, seg.to.y - seg.from.y),
    0
  );
}

function finalizeAnatomyRoute(
  itemId: string,
  anchorType: AnatomyAnchorType,
  routeType: AnatomyRouteType,
  startPoint: Point,
  bendPoint: Point | null,
  endPoint: Point
): AnatomyRoute {
  return {
    itemId,
    anchorType,
    routeType,
    startPoint,
    bendPoint,
    endPoint,
    segments: buildRouteSegments(startPoint, bendPoint, endPoint),
    score: 0,
    hasIntersection: false,
  };
}

export function doesRouteOverlapRoute(routeA: AnatomyRoute, routeB: AnatomyRoute): boolean {
  for (const segA of routeA.segments) {
    for (const segB of routeB.segments) {
      if (doSegmentsOverlap(segA, segB)) {
        return true;
      }
    }
  }
  return doesRouteIntersectRoute(
    {
      anchorType: routeA.anchorType,
      startPoint: routeA.startPoint,
      bendPoint: routeA.bendPoint,
      endPoint: routeA.endPoint,
      segments: routeA.segments,
      score: 0,
      hasIntersection: false,
    },
    {
      anchorType: routeB.anchorType,
      startPoint: routeB.startPoint,
      bendPoint: routeB.bendPoint,
      endPoint: routeB.endPoint,
      segments: routeB.segments,
      score: 0,
      hasIntersection: false,
    }
  );
}

export function doesRouteIntersectAnyLabel(
  route: AnatomyRoute,
  labelBoundsList: Bounds[]
): boolean {
  for (const seg of route.segments) {
    for (const bounds of labelBoundsList) {
      if (doesSegmentIntersectRect(seg, bounds)) {
        return true;
      }
    }
  }
  return false;
}

export function doesRouteIntersectAnyTargetExceptOwnTarget(
  route: AnatomyRoute,
  targetBoundsList: Array<{ id: string; bounds: Bounds }>,
  ownItemId: string
): boolean {
  for (const target of targetBoundsList) {
    if (target.id === ownItemId) {
      continue;
    }
    for (const seg of route.segments) {
      if (doesSegmentIntersectRect(seg, target.bounds)) {
        const mid = {
          x: (seg.from.x + seg.to.x) / 2,
          y: (seg.from.y + seg.to.y) / 2,
        };
        const left = target.bounds.x;
        const right = target.bounds.x + target.bounds.width;
        const top = target.bounds.y;
        const bottom = target.bounds.y + target.bounds.height;
        if (
          mid.x > left + ALIGN_EPSILON &&
          mid.x < right - ALIGN_EPSILON &&
          mid.y > top + ALIGN_EPSILON &&
          mid.y < bottom - ALIGN_EPSILON
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

export function validateRoute(params: {
  route: AnatomyRoute;
  existingRoutes: AnatomyRoute[];
  labelBoundsList: Bounds[];
  targetBoundsList: Array<{ id: string; bounds: Bounds }>;
  ownItemId: string;
}): boolean {
  if (!hasAtMostOneBend(params.route)) {
    return false;
  }

  const labels: AnatomyLabelLayout[] = params.labelBoundsList.map((bounds, index) => ({
    itemId:
      rectContainsPoint(bounds, params.route.startPoint) ||
      rectContainsPoint(bounds, params.route.endPoint)
        ? params.ownItemId
        : `label-${index}`,
    labelText: '',
    preferredCenterY: bounds.y + bounds.height / 2,
    resolvedCenterY: bounds.y + bounds.height / 2,
    labelBounds: bounds,
    side: 'right',
    anchorPoint: { x: bounds.x, y: bounds.y + bounds.height / 2 },
    targetPoint: { x: bounds.x, y: bounds.y + bounds.height / 2 },
  }));

  return validateRouteForItem(
    params.route,
    params.existingRoutes,
    labels,
    params.targetBoundsList,
    params.ownItemId
  );
}

function validateRouteForItem(
  route: AnatomyRoute,
  existingRoutes: AnatomyRoute[],
  labels: AnatomyLabelLayout[],
  targetBoundsList: Array<{ id: string; bounds: Bounds }>,
  ownItemId: string
): boolean {
  const labelBoundsList = labels
    .filter((l) => l.itemId !== ownItemId)
    .map((l) => l.labelBounds);

  for (const existing of existingRoutes) {
    if (doesRouteIntersectRoute(
      {
        anchorType: route.anchorType,
        startPoint: route.startPoint,
        bendPoint: route.bendPoint,
        endPoint: route.endPoint,
        segments: route.segments,
        score: 0,
        hasIntersection: false,
      },
      {
        anchorType: existing.anchorType,
        startPoint: existing.startPoint,
        bendPoint: existing.bendPoint,
        endPoint: existing.endPoint,
        segments: existing.segments,
        score: 0,
        hasIntersection: false,
      }
    )) {
      return false;
    }
    if (doesRouteOverlapRoute(route, existing)) {
      return false;
    }
  }

  if (doesRouteIntersectAnyLabel(route, labelBoundsList)) {
    return false;
  }

  if (doesRouteIntersectAnyTargetExceptOwnTarget(route, targetBoundsList, ownItemId)) {
    return false;
  }

  void ownItemId;
  return true;
}

export function scoreRoute(
  route: AnatomyRoute,
  preferredRouteType: AnatomyRouteType,
  labelBounds: Bounds,
  targetBounds: Bounds,
  preferredCenterY: number
): number {
  const resolvedCenterY = labelBounds.y + labelBounds.height / 2;
  const targetCenterY = targetBounds.y + targetBounds.height / 2;
  const verticalDelta = Math.abs(resolvedCenterY - targetCenterY);
  const labelYOffsetPenalty = Math.abs(resolvedCenterY - preferredCenterY);
  const preferredTypePenalty = route.routeType === preferredRouteType ? 0 : 30;
  const anchorPenalty =
    route.anchorType === 'right' ? 0 : route.anchorType === 'top' ? 10 : 10;
  const bendPenalty = route.bendPoint ? 5 : 0;

  return (
    routeTotalLength(route) * 1 +
    verticalDelta * 0.5 +
    labelYOffsetPenalty * 0.75 +
    preferredTypePenalty +
    anchorPenalty +
    bendPenalty
  );
}

function shouldUseTopEntry(labelBounds: Bounds, targetBounds: Bounds): boolean {
  const labelCenterY = labelBounds.y + labelBounds.height / 2;
  return labelCenterY < targetBounds.y;
}

function resolveRouteZone(
  item: AnatomyLayoutItem,
  labelBounds: Bounds
): AnatomyRouteZone {
  if (item.routeZone) {
    return item.routeZone;
  }
  if (shouldUseTopEntry(labelBounds, item.targetBounds)) {
    return 'top';
  }
  if (item.isFirstInRow) {
    return 'right';
  }
  return 'bottom';
}

export function createTopEntryRoute(
  item: AnatomyLayoutItem,
  labelBounds: Bounds,
  bendXOffset = 0,
  routeType: AnatomyRouteType = 'top-entry'
): AnatomyRoute {
  const labelLeft = getLabelLeftCenter(labelBounds);
  const anchors = getTargetAnchors(item.targetBounds);
  const bendPoint: Point = {
    x: anchors.top.x + bendXOffset,
    y: labelLeft.y,
  };

  if (
    Math.abs(labelLeft.x - bendPoint.x) < ALIGN_EPSILON &&
    Math.abs(labelLeft.y - anchors.top.y) < ALIGN_EPSILON
  ) {
    return finalizeAnatomyRoute(item.id, 'top', routeType, labelLeft, null, anchors.top);
  }

  return finalizeAnatomyRoute(item.id, 'top', routeType, labelLeft, bendPoint, anchors.top);
}

export function createStraightRightRoute(
  item: AnatomyLayoutItem,
  labelBounds: Bounds
): AnatomyRoute {
  const anchors = getTargetAnchors(item.targetBounds);
  const labelLeft = getLabelLeftCenter(labelBounds);
  return finalizeAnatomyRoute(
    item.id,
    'right',
    'straight-right',
    anchors.right,
    null,
    labelLeft
  );
}

export function createBottomEntryRoute(
  item: AnatomyLayoutItem,
  labelBounds: Bounds,
  bendXOffset = 0,
  routeType: AnatomyRouteType = 'bottom-entry'
): AnatomyRoute {
  const labelLeft = getLabelLeftCenter(labelBounds);
  const anchors = getTargetAnchors(item.targetBounds);
  const bendPoint: Point = {
    x: anchors.bottom.x + bendXOffset,
    y: labelLeft.y,
  };

  if (Math.abs(labelLeft.y - anchors.bottom.y) < ALIGN_EPSILON) {
    return finalizeAnatomyRoute(item.id, 'bottom', routeType, labelLeft, null, anchors.bottom);
  }

  return finalizeAnatomyRoute(item.id, 'bottom', routeType, labelLeft, bendPoint, anchors.bottom);
}

export function createGenericRightRoute(
  item: AnatomyLayoutItem,
  labelBounds: Bounds,
  bendXOffset = 0
): AnatomyRoute {
  const labelLeft = getLabelLeftCenter(labelBounds);
  const anchors = getTargetAnchors(item.targetBounds);

  if (Math.abs(labelLeft.y - anchors.right.y) < ALIGN_EPSILON) {
    return finalizeAnatomyRoute(
      item.id,
      'right',
      'generic-right',
      labelLeft,
      null,
      anchors.right
    );
  }

  const bendPoint: Point = {
    x: anchors.right.x + bendXOffset,
    y: labelLeft.y,
  };

  return finalizeAnatomyRoute(
    item.id,
    'right',
    'generic-right',
    labelLeft,
    bendPoint,
    anchors.right
  );
}

export function createShiftedRouteVariants(
  item: AnatomyLayoutItem,
  labelBounds: Bounds
): AnatomyRoute[] {
  const step = ANATOMY_POINTER_BEND_LANE_STEP;
  const topBottomOffsets = [0, -step, step, -step * 2, step * 2, -step * 3, step * 3];
  const rightOffsets = [0, step, step * 2, step * 3];
  const variants: AnatomyRoute[] = [];

  for (const offset of topBottomOffsets) {
    variants.push(createTopEntryRoute(item, labelBounds, offset, 'generic-top'));
    variants.push(createBottomEntryRoute(item, labelBounds, offset, 'generic-bottom'));
  }
  for (const offset of rightOffsets) {
    variants.push(createGenericRightRoute(item, labelBounds, offset));
  }

  return variants;
}

/** Tries geometry-preferred routes before generic fallbacks. */
function tryPreferredRoutes(
  item: AnatomyLayoutItem,
  labelBounds: Bounds,
  existingRoutes: AnatomyRoute[],
  labels: AnatomyLabelLayout[],
  targetBoundsList: Array<{ id: string; bounds: Bounds }>,
  preferredCenterY: number
): AnatomyRoute | null {
  const step = ANATOMY_POINTER_BEND_LANE_STEP;
  const bendOffsets = [0, -step, step, -step * 2, step * 2, -step * 3, step * 3];
  const zone = resolveRouteZone(item, labelBounds);

  if (zone === 'top' || shouldUseTopEntry(labelBounds, item.targetBounds)) {
    for (const offset of bendOffsets) {
      const route = createTopEntryRoute(item, labelBounds, offset, 'top-entry');
      if (validateRouteForItem(route, existingRoutes, labels, targetBoundsList, item.id)) {
        return {
          ...route,
          score: scoreRoute(route, 'top-entry', labelBounds, item.targetBounds, preferredCenterY),
          hasIntersection: false,
        };
      }
    }
  }

  if (zone === 'right' || item.isFirstInRow) {
    const straight = createStraightRightRoute(item, labelBounds);
    if (validateRouteForItem(straight, existingRoutes, labels, targetBoundsList, item.id)) {
      return {
        ...straight,
        score: scoreRoute(
          straight,
          'straight-right',
          labelBounds,
          item.targetBounds,
          preferredCenterY
        ),
        hasIntersection: false,
      };
    }
    for (const offset of bendOffsets) {
      const route = createGenericRightRoute(item, labelBounds, offset);
      if (validateRouteForItem(route, existingRoutes, labels, targetBoundsList, item.id)) {
        return {
          ...route,
          score: scoreRoute(
            route,
            'generic-right',
            labelBounds,
            item.targetBounds,
            preferredCenterY
          ),
          hasIntersection: false,
        };
      }
    }
  }

  if (zone === 'bottom' || !item.isFirstInRow) {
    for (const offset of bendOffsets) {
      const route = createBottomEntryRoute(item, labelBounds, offset, 'bottom-entry');
      if (validateRouteForItem(route, existingRoutes, labels, targetBoundsList, item.id)) {
        return {
          ...route,
          score: scoreRoute(
            route,
            'bottom-entry',
            labelBounds,
            item.targetBounds,
            preferredCenterY
          ),
          hasIntersection: false,
        };
      }
    }
  }

  return null;
}

function createRouteVariants(
  item: AnatomyLayoutItem,
  labelBounds: Bounds
): { route: AnatomyRoute; preferred: AnatomyRouteType }[] {
  const step = ANATOMY_POINTER_BEND_LANE_STEP;
  const bendOffsets = [0, -step, step, -step * 2, step * 2];
  const rightLaneOffsets = [0, step, step * 2, step * 3];
  const candidates: { route: AnatomyRoute; preferred: AnatomyRouteType }[] = [];

  const zone = resolveRouteZone(item, labelBounds);

  if (zone === 'top' || shouldUseTopEntry(labelBounds, item.targetBounds)) {
    for (const offset of bendOffsets) {
      candidates.push({
        route: createTopEntryRoute(item, labelBounds, offset, 'top-entry'),
        preferred: 'top-entry',
      });
      candidates.push({
        route: createTopEntryRoute(item, labelBounds, offset, 'generic-top'),
        preferred: 'top-entry',
      });
    }
  }

  if (zone === 'right' || item.isFirstInRow) {
    candidates.push({
      route: createStraightRightRoute(item, labelBounds),
      preferred: 'straight-right',
    });
    for (const offset of rightLaneOffsets) {
      candidates.push({
        route: createGenericRightRoute(item, labelBounds, offset),
        preferred: 'straight-right',
      });
    }
  }

  if (zone === 'bottom' || !item.isFirstInRow) {
    for (const offset of bendOffsets) {
      candidates.push({
        route: createBottomEntryRoute(item, labelBounds, offset, 'bottom-entry'),
        preferred: 'bottom-entry',
      });
      candidates.push({
        route: createBottomEntryRoute(item, labelBounds, offset, 'generic-bottom'),
        preferred: 'bottom-entry',
      });
    }
  }

  for (const variant of createShiftedRouteVariants(item, labelBounds)) {
    candidates.push({
      route: variant,
      preferred:
        variant.routeType === 'generic-top'
          ? 'top-entry'
          : variant.routeType === 'generic-bottom'
            ? 'bottom-entry'
            : 'generic-right',
    });
  }

  const unique: AnatomyRoute[] = [];
  const result: { route: AnatomyRoute; preferred: AnatomyRouteType }[] = [];

  for (const entry of candidates) {
    const key = JSON.stringify({
      s: entry.route.startPoint,
      b: entry.route.bendPoint,
      e: entry.route.endPoint,
      t: entry.route.routeType,
    });
    if (unique.some((u) => JSON.stringify({ s: u.startPoint, b: u.bendPoint, e: u.endPoint, t: u.routeType }) === key)) {
      continue;
    }
    unique.push(entry.route);
    result.push(entry);
  }

  return result;
}

function selectBestRoute(
  variants: { route: AnatomyRoute; preferred: AnatomyRouteType }[],
  existingRoutes: AnatomyRoute[],
  labels: AnatomyLabelLayout[],
  targetBoundsList: Array<{ id: string; bounds: Bounds }>,
  ownItemId: string,
  item: AnatomyLayoutItem,
  labelBounds: Bounds,
  preferredCenterY: number
): AnatomyRoute | null {
  const valid = variants.filter((v) =>
    validateRouteForItem(v.route, existingRoutes, labels, targetBoundsList, ownItemId)
  );

  if (valid.length === 0) {
    return null;
  }

  const scored = valid.map((v) => ({
    ...v.route,
    score: scoreRoute(v.route, v.preferred, labelBounds, item.targetBounds, preferredCenterY),
    hasIntersection: false,
  }));

  scored.sort((a, b) => a.score - b.score);
  return scored[0] ?? null;
}

function selectLeastBadRoute(
  variants: { route: AnatomyRoute; preferred: AnatomyRouteType }[],
  existingRoutes: AnatomyRoute[],
  labels: AnatomyLabelLayout[],
  targetBoundsList: Array<{ id: string; bounds: Bounds }>,
  ownItemId: string,
  item: AnatomyLayoutItem,
  labelBounds: Bounds,
  preferredCenterY: number
): AnatomyRoute {
  const scored = variants.map((v) => {
    const valid = validateRouteForItem(
      v.route,
      existingRoutes,
      labels,
      targetBoundsList,
      ownItemId
    );
    return {
      route: v.route,
      intersections: valid ? 0 : 1,
      score: scoreRoute(v.route, v.preferred, labelBounds, item.targetBounds, preferredCenterY),
    };
  });

  scored.sort((a, b) => {
    if (a.intersections !== b.intersections) return a.intersections - b.intersections;
    return a.score - b.score;
  });

  const picked = scored[0]?.route ?? variants[0].route;
  return {
    ...picked,
    score: scored[0]?.score ?? 0,
    hasIntersection: (scored[0]?.intersections ?? 0) > 0,
  };
}

/** Stage 6: pick the best valid route for one item and label position. */
export function pickRouteForItem(
  item: AnatomyLayoutItem,
  labelBounds: Bounds,
  existingRoutes: AnatomyRoute[],
  labels: AnatomyLabelLayout[],
  targetBoundsList: Array<{ id: string; bounds: Bounds }>,
  preferredCenterY: number
): AnatomyRoute {
  let selected = tryPreferredRoutes(
    item,
    labelBounds,
    existingRoutes,
    labels,
    targetBoundsList,
    preferredCenterY
  );

  const variants = createRouteVariants(item, labelBounds);

  if (!selected) {
    selected = selectBestRoute(
      variants,
      existingRoutes,
      labels,
      targetBoundsList,
      item.id,
      item,
      labelBounds,
      preferredCenterY
    );
  }

  if (!selected) {
    selected = selectLeastBadRoute(
      variants,
      existingRoutes,
      labels,
      targetBoundsList,
      item.id,
      item,
      labelBounds,
      preferredCenterY
    );
  }

  return selected;
}

/** Stage 7 alias */
export const validateAnatomyRoutes = validateRoute;

export type AnatomyStraightRoute = {
  itemId: string;
  startPoint: Point;
  endPoint: Point;
};

export function createStraightAnatomyRoutes(
  labels: AnatomyLabelLayout[]
): AnatomyStraightRoute[] {
  return labels.map((label) => ({
    itemId: label.itemId,
    startPoint: label.anchorPoint,
    endPoint: label.targetPoint,
  }));
}

export function routeAnatomyConnectors(params: {
  frameBounds: Bounds;
  items: AnatomyLayoutItem[];
  labels: AnatomyLabelLayout[];
  allTargetBounds: Map<string, Bounds>;
  horizontalOffset?: number;
  labelGap?: number;
  labelSizes?: Map<string, { width: number; height: number }>;
  minTopY?: number;
  maxBottomY?: number;
}): AnatomyRoute[] {
  const { labels } = params;
  const straight = createStraightAnatomyRoutes(labels);
  const sideById = new Map(labels.map((label) => [label.itemId, label.side]));
  return straight.map((route) => {
    const side = sideById.get(route.itemId) ?? 'right';
    const anchorType: AnatomyAnchorType =
      side === 'top' ? 'top' : side === 'bottom' ? 'bottom' : 'right';
    const routeType: AnatomyRouteType =
      side === 'top' ? 'top-entry' : side === 'bottom' ? 'bottom-entry' : 'straight-right';
    return {
      itemId: route.itemId,
      anchorType,
      routeType,
      startPoint: route.startPoint,
      bendPoint: null,
      endPoint: route.endPoint,
      segments: buildRouteSegments(route.startPoint, null, route.endPoint),
      score: 0,
      hasIntersection: false,
    };
  });
}
