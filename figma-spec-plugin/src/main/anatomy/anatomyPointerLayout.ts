/// <reference types="@figma/plugin-typings" />

import type { AnatomyRect } from './anatomyTypes';
import {
  ANATOMY_POINTER_BEND_LANE_STEP,
  ANATOMY_POINTER_LABEL_GAP,
  ANATOMY_POINTER_MAX_FALLBACK_ATTEMPTS,
  ANATOMY_POINTER_MIN_CONNECTOR_GAP,
  ANATOMY_POINTER_RIGHT_OFFSET,
  ANATOMY_POINTER_ROUTING_LEVEL_GAP,
  ANATOMY_POINTER_TOP_ENTRY_BEND_STEP,
} from './anatomyStyles';

export type Point = {
  x: number;
  y: number;
};

export type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Segment = {
  from: Point;
  to: Point;
};

export type AnatomyPointerLayoutInput = {
  id: string;
  targetBounds: Bounds;
  labelSize: {
    width: number;
    height: number;
  };
};

export type AnatomyPointerAnchorType = 'right' | 'top' | 'bottom';

export type AnatomyRouteEntryMode = 'target-to-label' | 'top-entry' | 'bottom-entry';

export type AnatomyPointerRoute = {
  anchorType: AnatomyPointerAnchorType;
  startPoint: Point;
  bendPoint: Point | null;
  endPoint: Point;
  segments: Segment[];
  score: number;
  hasIntersection: boolean;
  laneIndex?: number;
  routingLevel?: number;
  entryMode?: AnatomyRouteEntryMode;
  /** @deprecated use entryMode === 'top-entry' */
  isTopEntry?: boolean;
};

export type RouteValidationContext = {
  existingRoutes: AnatomyPointerRoute[];
  labelBoundsList: Bounds[];
  ownLabelBounds: Bounds;
  allTargetBounds: Bounds[];
  targets: { id: string; bounds: Bounds }[];
  ownTargetBounds: Bounds;
  ownTargetId: string;
  frameBounds: Bounds;
};

export type AnatomyPointerRow = {
  rowIndex: number;
  centerY: number;
  items: AnatomyPointerLayoutInput[];
};

export type AnatomyPointerLayoutResult = {
  id: string;
  labelPosition: Point;
  selectedRoute: AnatomyPointerRoute;
  startPoint: Point;
  bendPoint: Point | null;
  endPoint: Point;
};

export type LayoutAnatomyPointersRightSideParams = {
  frameBounds: AnatomyRect;
  pointers: AnatomyPointerLayoutInput[];
  horizontalOffset?: number;
  labelGap?: number;
  minTopY?: number;
  maxBottomY?: number;
};

type LayoutItem = {
  id: string;
  targetBounds: Bounds;
  labelWidth: number;
  labelHeight: number;
  desiredCenterY: number;
  labelY: number;
  sortIndex: number;
  rowIndex: number;
  isFirstInRow: boolean;
};

const DEFAULT_ROW_MIN_HEIGHT = 24;

type LayoutAttemptResult = {
  results: AnatomyPointerLayoutResult[];
  allValid: boolean;
  intersectionCount: number;
};

const ALIGN_EPSILON = 1;
const ANCHOR_PREFERENCE: Record<AnatomyPointerAnchorType, number> = {
  right: 20,
  top: 40,
  bottom: 40,
};

const PREFERRED_ROUTE_SCORE_BONUS = -1000;

const LANE_FRACTIONS = [0.25, 0.5, 0.75] as const;

/** Occupied horizontal routing lanes (Y of horizontal connector segments). */
class RoutingLevelAllocator {
  private readonly levels: number[] = [];

  getCandidateYs(preferredY: number, maxAttempts = 10): { y: number; levelIndex: number }[] {
    const gap = ANATOMY_POINTER_ROUTING_LEVEL_GAP;
    const seen = new Set<string>();
    const candidates: { y: number; levelIndex: number }[] = [];

    const push = (y: number, levelIndex: number) => {
      const key = y.toFixed(2);
      if (seen.has(key)) return;
      seen.add(key);
      candidates.push({ y, levelIndex });
    };

    push(preferredY, 0);
    for (let step = 1; step <= maxAttempts; step += 1) {
      push(preferredY + step * gap, step);
      push(preferredY - step * gap, step);
    }

    return candidates;
  }

  commit(y: number): number {
    const gap = ANATOMY_POINTER_ROUTING_LEVEL_GAP;
    const levelIndex = this.levels.length;
    if (!this.levels.some((levelY) => Math.abs(levelY - y) < gap * 0.85)) {
      this.levels.push(y);
    }
    return levelIndex;
  }
}

function computeDefaultRowThreshold(items: AnatomyPointerLayoutInput[]): number {
  if (items.length === 0) {
    return 16;
  }
  const avgHeight =
    items.reduce((sum, item) => sum + item.targetBounds.height, 0) / items.length;
  return Math.max(16, avgHeight * 0.6);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function boundsCenterY(bounds: Bounds): number {
  return bounds.y + bounds.height / 2;
}

function boundsEqual(a: Bounds, b: Bounds): boolean {
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height
  );
}

function pointsEqual(a: Point, b: Point, epsilon = ALIGN_EPSILON): boolean {
  return Math.abs(a.x - b.x) < epsilon && Math.abs(a.y - b.y) < epsilon;
}

function toLineSegment(seg: Segment): { a: Point; b: Point } {
  return { a: seg.from, b: seg.to };
}

export function getTargetAnchors(targetBounds: Bounds): Record<AnatomyPointerAnchorType, Point> {
  return {
    right: {
      x: targetBounds.x + targetBounds.width,
      y: boundsCenterY(targetBounds),
    },
    top: {
      x: targetBounds.x + targetBounds.width / 2,
      y: targetBounds.y,
    },
    bottom: {
      x: targetBounds.x + targetBounds.width / 2,
      y: targetBounds.y + targetBounds.height,
    },
  };
}

function segmentLength(seg: Segment): number {
  return Math.hypot(seg.to.x - seg.from.x, seg.to.y - seg.from.y);
}

export function buildRouteSegments(
  startPoint: Point,
  bendPoint: Point | null,
  endPoint: Point
): Segment[] {
  if (!bendPoint) {
    return [{ from: startPoint, to: endPoint }];
  }
  return [
    { from: startPoint, to: bendPoint },
    { from: bendPoint, to: endPoint },
  ];
}

export function getPolylineSegments(route: AnatomyPointerRoute): Segment[] {
  return route.segments;
}

function crossProduct(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

function pointOnSegment(point: Point, seg: Segment, epsilon = 0.5): boolean {
  const minX = Math.min(seg.from.x, seg.to.x) - epsilon;
  const maxX = Math.max(seg.from.x, seg.to.x) + epsilon;
  const minY = Math.min(seg.from.y, seg.to.y) - epsilon;
  const maxY = Math.max(seg.from.y, seg.to.y) + epsilon;
  if (point.x < minX || point.x > maxX || point.y < minY || point.y > maxY) {
    return false;
  }
  const line = toLineSegment(seg);
  const dist =
    Math.abs(
      (line.b.x - line.a.x) * (line.a.y - point.y) -
        (line.a.x - point.x) * (line.b.y - line.a.y)
    ) / Math.max(segmentLength(seg), 1);
  return dist <= epsilon;
}

export function doSegmentsIntersect(segA: Segment, segB: Segment): boolean {
  const p = segA.from;
  const q = segA.to;
  const r = segB.from;
  const s = segB.to;

  const rxs = crossProduct(s.x - r.x, s.y - r.y, q.x - p.x, q.y - p.y);
  const qpxr = crossProduct(q.x - p.x, q.y - p.y, r.x - p.x, r.y - p.y);

  if (Math.abs(rxs) < 1e-9) {
    if (Math.abs(qpxr) < 1e-9) {
      return (
        pointOnSegment(r, segA) ||
        pointOnSegment(s, segA) ||
        pointOnSegment(p, segB) ||
        pointOnSegment(q, segB)
      );
    }
    return false;
  }

  const t = crossProduct(r.x - p.x, r.y - p.y, s.x - r.x, s.y - r.y) / rxs;
  const u = crossProduct(r.x - p.x, r.y - p.y, q.x - p.x, q.y - p.y) / rxs;

  return t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6;
}

export function doSegmentsOverlap(segA: Segment, segB: Segment): boolean {
  const aHoriz = Math.abs(segA.from.y - segA.to.y) < ALIGN_EPSILON;
  const bHoriz = Math.abs(segB.from.y - segB.to.y) < ALIGN_EPSILON;
  const aVert = Math.abs(segA.from.x - segA.to.x) < ALIGN_EPSILON;
  const bVert = Math.abs(segB.from.x - segB.to.x) < ALIGN_EPSILON;

  if (aHoriz && bHoriz && Math.abs(segA.from.y - segB.from.y) < ALIGN_EPSILON) {
    const minA = Math.min(segA.from.x, segA.to.x);
    const maxA = Math.max(segA.from.x, segA.to.x);
    const minB = Math.min(segB.from.x, segB.to.x);
    const maxB = Math.max(segB.from.x, segB.to.x);
    const overlap = Math.min(maxA, maxB) - Math.max(minA, minB);
    return overlap > ALIGN_EPSILON;
  }

  if (aVert && bVert && Math.abs(segA.from.x - segB.from.x) < ALIGN_EPSILON) {
    const minA = Math.min(segA.from.y, segA.to.y);
    const maxA = Math.max(segA.from.y, segA.to.y);
    const minB = Math.min(segB.from.y, segB.to.y);
    const maxB = Math.max(segB.from.y, segB.to.y);
    const overlap = Math.min(maxA, maxB) - Math.max(minA, minB);
    return overlap > ALIGN_EPSILON;
  }

  return false;
}

/** @deprecated alias */
export const segmentsIntersect = doSegmentsIntersect;
/** @deprecated alias */
export const segmentsOverlap = doSegmentsOverlap;

export function doesSegmentIntersectRect(seg: Segment, rect: Bounds): boolean {
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;

  const rectEdges: Segment[] = [
    { from: { x: left, y: top }, to: { x: right, y: top } },
    { from: { x: right, y: top }, to: { x: right, y: bottom } },
    { from: { x: right, y: bottom }, to: { x: left, y: bottom } },
    { from: { x: left, y: bottom }, to: { x: left, y: top } },
  ];

  for (const edge of rectEdges) {
    if (doSegmentsIntersect(seg, edge) || doSegmentsOverlap(seg, edge)) {
      return true;
    }
  }

  const mid = {
    x: (seg.from.x + seg.to.x) / 2,
    y: (seg.from.y + seg.to.y) / 2,
  };
  return (
    mid.x > left + ALIGN_EPSILON &&
    mid.x < right - ALIGN_EPSILON &&
    mid.y > top + ALIGN_EPSILON &&
    mid.y < bottom - ALIGN_EPSILON
  );
}

function segmentIntersectsRectInterior(seg: Segment, rect: Bounds): boolean {
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;

  const mid = {
    x: (seg.from.x + seg.to.x) / 2,
    y: (seg.from.y + seg.to.y) / 2,
  };

  if (
    mid.x > left + ALIGN_EPSILON &&
    mid.x < right - ALIGN_EPSILON &&
    mid.y > top + ALIGN_EPSILON &&
    mid.y < bottom - ALIGN_EPSILON
  ) {
    return true;
  }

  return doesSegmentIntersectRect(seg, rect);
}

export function doesRouteIntersectRoute(
  routeA: AnatomyPointerRoute,
  routeB: AnatomyPointerRoute
): boolean {
  for (const segA of routeA.segments) {
    for (const segB of routeB.segments) {
      if (doSegmentsOverlap(segA, segB)) {
        return true;
      }
      if (doSegmentsIntersect(segA, segB)) {
        return true;
      }
    }
  }
  return false;
}

export function doesRouteIntersectAnyRoute(
  route: AnatomyPointerRoute,
  existingRoutes: AnatomyPointerRoute[]
): boolean {
  for (const existing of existingRoutes) {
    if (doesRouteIntersectRoute(route, existing)) {
      return true;
    }
  }
  return false;
}

export function doesRouteIntersectAnyLabel(
  route: AnatomyPointerRoute,
  labelBoundsList: Bounds[],
  ownLabelBounds: Bounds
): boolean {
  for (const label of labelBoundsList) {
    if (boundsEqual(label, ownLabelBounds)) {
      continue;
    }
    for (const seg of route.segments) {
      if (doesSegmentIntersectRect(seg, label)) {
        return true;
      }
    }
  }
  return false;
}

function doesRouteCrossOtherTargets(
  route: AnatomyPointerRoute,
  allTargetBounds: Bounds[],
  ownTargetBounds: Bounds
): boolean {
  for (const bounds of allTargetBounds) {
    if (boundsEqual(bounds, ownTargetBounds)) {
      continue;
    }
    for (const seg of route.segments) {
      if (segmentIntersectsRectInterior(seg, bounds)) {
        return true;
      }
    }
  }
  return false;
}

export function doesRouteIntersectAnyTargetExceptOwnTarget(
  route: AnatomyPointerRoute,
  targets: { id: string; bounds: Bounds }[],
  ownTargetId: string
): boolean {
  for (const target of targets) {
    if (target.id === ownTargetId) {
      continue;
    }
    for (const seg of route.segments) {
      if (segmentIntersectsRectInterior(seg, target.bounds)) {
        return true;
      }
    }
  }
  return false;
}

function routeTotalLength(route: AnatomyPointerRoute): number {
  return route.segments.reduce((sum, seg) => sum + segmentLength(seg), 0);
}

function finalizeRoute(
  anchorType: AnatomyPointerAnchorType,
  startPoint: Point,
  bendPoint: Point | null,
  endPoint: Point,
  options?: {
    laneIndex?: number;
    routingLevel?: number;
    entryMode?: AnatomyRouteEntryMode;
  }
): AnatomyPointerRoute {
  const segments = buildRouteSegments(startPoint, bendPoint, endPoint);
  const entryMode = options?.entryMode ?? 'target-to-label';
  return {
    anchorType,
    startPoint,
    bendPoint,
    endPoint,
    segments,
    score: 0,
    hasIntersection: false,
    laneIndex: options?.laneIndex,
    routingLevel: options?.routingLevel,
    entryMode,
    isTopEntry: entryMode === 'top-entry',
  };
}

/** Top-to-bottom, then right-to-left within the same visual row. */
export function sortTargetsForAnatomyRouting(
  items: AnatomyPointerLayoutInput[]
): AnatomyPointerLayoutInput[] {
  return [...items].sort((a, b) => {
    const aCenterY = boundsCenterY(a.targetBounds);
    const bCenterY = boundsCenterY(b.targetBounds);

    const sameRowThreshold = computeDefaultRowThreshold([a, b]);

    const isSameRow = Math.abs(aCenterY - bCenterY) <= sameRowThreshold;

    if (!isSameRow) {
      return aCenterY - bCenterY;
    }

    const aRight = a.targetBounds.x + a.targetBounds.width;
    const bRight = b.targetBounds.x + b.targetBounds.width;

    return bRight - aRight;
  });
}

export function sortRowItemsRightToLeft(
  items: AnatomyPointerLayoutInput[]
): AnatomyPointerLayoutInput[] {
  return [...items].sort((a, b) => {
    const aRight = a.targetBounds.x + a.targetBounds.width;
    const bRight = b.targetBounds.x + b.targetBounds.width;
    return bRight - aRight;
  });
}

export function groupTargetsIntoRows(
  items: AnatomyPointerLayoutInput[],
  rowThreshold?: number
): AnatomyPointerRow[] {
  if (items.length === 0) {
    return [];
  }

  const defaultThreshold = rowThreshold ?? computeDefaultRowThreshold(items);

  const sortedByY = [...items].sort(
    (a, b) => boundsCenterY(a.targetBounds) - boundsCenterY(b.targetBounds)
  );

  const rows: AnatomyPointerRow[] = [];

  for (const item of sortedByY) {
    const centerY = boundsCenterY(item.targetBounds);
    let placed = false;

    for (const row of rows) {
      if (Math.abs(centerY - row.centerY) <= defaultThreshold) {
        row.items.push(item);
        placed = true;
        break;
      }
    }

    if (!placed) {
      rows.push({
        rowIndex: rows.length,
        centerY,
        items: [item],
      });
    }
  }

  for (const row of rows) {
    row.items = sortRowItemsRightToLeft(row.items);
    row.centerY =
      row.items.reduce((sum, entry) => sum + boundsCenterY(entry.targetBounds), 0) /
      row.items.length;
  }

  return rows.sort((a, b) => a.centerY - b.centerY);
}

export function isFirstItemInVisualRow(
  item: AnatomyPointerLayoutInput,
  row: AnatomyPointerRow
): boolean {
  return row.items[0]?.id === item.id;
}

/** True when the label sits above the target — use top-entry routing from the label. */
export function shouldUseTopEntryRoute(labelBounds: Bounds, targetBounds: Bounds): boolean {
  const labelCenterY = labelBounds.y + labelBounds.height / 2;
  return labelCenterY < targetBounds.y;
}

export function createTopEntryRoute(
  labelBounds: Bounds,
  targetBounds: Bounds,
  bendXOffset = 0,
  routingBendY?: number
): AnatomyPointerRoute {
  const labelExitPoint: Point = {
    x: labelBounds.x,
    y: labelBounds.y + labelBounds.height / 2,
  };

  const topAnchor: Point = {
    x: targetBounds.x + targetBounds.width / 2,
    y: targetBounds.y,
  };

  const bendX = topAnchor.x + bendXOffset;
  const horizontalY = routingBendY ?? labelExitPoint.y;

  if (
    Math.abs(labelExitPoint.x - bendX) < ALIGN_EPSILON &&
    Math.abs(labelExitPoint.y - topAnchor.y) < ALIGN_EPSILON
  ) {
    return finalizeRoute('top', labelExitPoint, null, topAnchor, { entryMode: 'top-entry' });
  }

  if (Math.abs(labelExitPoint.y - topAnchor.y) < ALIGN_EPSILON) {
    return finalizeRoute('top', labelExitPoint, null, topAnchor, { entryMode: 'top-entry' });
  }

  if (Math.abs(bendX - labelExitPoint.x) < ALIGN_EPSILON) {
    return finalizeRoute('top', labelExitPoint, null, topAnchor, { entryMode: 'top-entry' });
  }

  const bendPoint: Point = {
    x: bendX,
    y: horizontalY,
  };

  return finalizeRoute('top', labelExitPoint, bendPoint, topAnchor, { entryMode: 'top-entry' });
}

export function shouldUseStraightRightRoute(
  labelBounds: Bounds,
  targetBounds: Bounds
): boolean {
  const labelCenterY = labelBounds.y + labelBounds.height / 2;
  const targetCenterY = boundsCenterY(targetBounds);
  const threshold = Math.max(
    targetBounds.height,
    labelBounds.height,
    DEFAULT_ROW_MIN_HEIGHT
  ) * 0.5;

  return Math.abs(labelCenterY - targetCenterY) <= threshold;
}

export function createStraightRightRoute(
  labelBounds: Bounds,
  targetBounds: Bounds
): AnatomyPointerRoute {
  const startPoint: Point = {
    x: targetBounds.x + targetBounds.width,
    y: boundsCenterY(targetBounds),
  };

  const endPoint: Point = {
    x: labelBounds.x,
    y: labelBounds.y + labelBounds.height / 2,
  };

  return finalizeRoute('right', startPoint, null, endPoint, { entryMode: 'target-to-label' });
}

export function createBottomEntryRoute(
  labelBounds: Bounds,
  targetBounds: Bounds,
  bendXOffset = 0,
  routingBendY?: number
): AnatomyPointerRoute {
  const labelLeftCenter: Point = {
    x: labelBounds.x,
    y: labelBounds.y + labelBounds.height / 2,
  };

  const bottomAnchor: Point = {
    x: targetBounds.x + targetBounds.width / 2,
    y: targetBounds.y + targetBounds.height,
  };

  const bendX = bottomAnchor.x + bendXOffset;
  const horizontalY = routingBendY ?? labelLeftCenter.y;

  if (Math.abs(labelLeftCenter.y - bottomAnchor.y) < ALIGN_EPSILON) {
    return finalizeRoute('bottom', labelLeftCenter, null, bottomAnchor, {
      entryMode: 'bottom-entry',
    });
  }

  if (Math.abs(bendX - labelLeftCenter.x) < ALIGN_EPSILON) {
    return finalizeRoute('bottom', labelLeftCenter, null, bottomAnchor, {
      entryMode: 'bottom-entry',
    });
  }

  const bendPoint: Point = {
    x: bendX,
    y: horizontalY,
  };

  return finalizeRoute('bottom', labelLeftCenter, bendPoint, bottomAnchor, {
    entryMode: 'bottom-entry',
  });
}

function createBottomEntryRouteVariants(
  labelBounds: Bounds,
  targetBounds: Bounds,
  routingLevels?: RoutingLevelAllocator
): AnatomyPointerRoute[] {
  const step = ANATOMY_POINTER_BEND_LANE_STEP;
  const offsets = [0, -step, step, -step * 2, step * 2];
  const routes: AnatomyPointerRoute[] = [];
  const labelCenterY = labelBounds.y + labelBounds.height / 2;
  const levelYs = routingLevels
    ? routingLevels.getCandidateYs(labelCenterY)
    : [{ y: labelCenterY, levelIndex: 0 }];

  for (const { y: routingY, levelIndex } of levelYs) {
  for (const offset of offsets) {
    const route = createBottomEntryRoute(labelBounds, targetBounds, offset, routingY);
    route.routingLevel = levelIndex;
    const duplicate = routes.some(
      (existing) =>
        existing.entryMode === route.entryMode &&
        pointsEqual(existing.startPoint, route.startPoint) &&
        pointsEqual(existing.endPoint, route.endPoint) &&
        ((!existing.bendPoint && !route.bendPoint) ||
          (existing.bendPoint &&
            route.bendPoint &&
            pointsEqual(existing.bendPoint, route.bendPoint)))
    );
    if (!duplicate) {
      routes.push(route);
    }
  }
  }

  return routes;
}

function createTopEntryRouteVariants(
  labelBounds: Bounds,
  targetBounds: Bounds,
  routingLevels?: RoutingLevelAllocator
): AnatomyPointerRoute[] {
  const step = ANATOMY_POINTER_TOP_ENTRY_BEND_STEP;
  const offsets = [0, -step, step, -step * 2, step * 2];
  const routes: AnatomyPointerRoute[] = [];
  const labelCenterY = labelBounds.y + labelBounds.height / 2;
  const levelYs = routingLevels
    ? routingLevels.getCandidateYs(labelCenterY)
    : [{ y: labelCenterY, levelIndex: 0 }];

  for (const { y: routingY, levelIndex } of levelYs) {
  for (const offset of offsets) {
    const route = createTopEntryRoute(labelBounds, targetBounds, offset, routingY);
    route.routingLevel = levelIndex;
    const duplicate = routes.some(
      (existing) =>
        pointsEqual(existing.startPoint, route.startPoint) &&
        pointsEqual(existing.endPoint, route.endPoint) &&
        ((!existing.bendPoint && !route.bendPoint) ||
          (existing.bendPoint &&
            route.bendPoint &&
            pointsEqual(existing.bendPoint, route.bendPoint)))
    );
    if (!duplicate) {
      routes.push(route);
    }
  }
  }

  return routes;
}

function buildValidationContext(
  item: LayoutItem,
  existingRoutes: AnatomyPointerRoute[],
  labelBoundsList: Bounds[],
  ownLabelBounds: Bounds,
  targets: { id: string; bounds: Bounds }[],
  frameBounds: Bounds
): RouteValidationContext {
  return {
    existingRoutes,
    labelBoundsList,
    ownLabelBounds,
    allTargetBounds: targets.map((t) => t.bounds),
    targets,
    ownTargetBounds: item.targetBounds,
    ownTargetId: item.id,
    frameBounds,
  };
}

export function validateRoute(
  route: AnatomyPointerRoute,
  context: RouteValidationContext
): boolean {
  if (doesRouteIntersectAnyRoute(route, context.existingRoutes)) {
    return false;
  }
  if (doesRouteIntersectAnyLabel(route, context.labelBoundsList, context.ownLabelBounds)) {
    return false;
  }
  if (
    doesRouteIntersectAnyTargetExceptOwnTarget(
      route,
      context.targets,
      context.ownTargetId
    )
  ) {
    return false;
  }
  return true;
}

function trySelectTopEntryRoute(
  labelBounds: Bounds,
  targetBounds: Bounds,
  context: RouteValidationContext,
  topRoutingLevels: RoutingLevelAllocator
): AnatomyPointerRoute | null {
  if (!shouldUseTopEntryRoute(labelBounds, targetBounds)) {
    return null;
  }

  const variants = createTopEntryRouteVariants(labelBounds, targetBounds, topRoutingLevels);

  for (const route of variants) {
    if (validateRoute(route, context)) {
      if (route.bendPoint) {
        topRoutingLevels.commit(route.bendPoint.y);
      }
      return {
        ...route,
        score: PREFERRED_ROUTE_SCORE_BONUS,
        hasIntersection: false,
      };
    }
  }

  return null;
}

function trySelectStraightRightRoute(
  labelBounds: Bounds,
  targetBounds: Bounds,
  context: RouteValidationContext
): AnatomyPointerRoute | null {
  if (!shouldUseStraightRightRoute(labelBounds, targetBounds)) {
    return null;
  }

  const route = createStraightRightRoute(labelBounds, targetBounds);
  if (validateRoute(route, context)) {
    return { ...route, score: PREFERRED_ROUTE_SCORE_BONUS, hasIntersection: false };
  }

  return null;
}

function trySelectBottomEntryRoute(
  labelBounds: Bounds,
  targetBounds: Bounds,
  context: RouteValidationContext,
  bottomRoutingLevels: RoutingLevelAllocator
): AnatomyPointerRoute | null {
  const variants = createBottomEntryRouteVariants(
    labelBounds,
    targetBounds,
    bottomRoutingLevels
  );

  for (const route of variants) {
    if (validateRoute(route, context)) {
      if (route.bendPoint) {
        bottomRoutingLevels.commit(route.bendPoint.y);
      }
      return { ...route, score: PREFERRED_ROUTE_SCORE_BONUS, hasIntersection: false };
    }
  }

  return null;
}

function trySelectPreferredRoute(
  item: LayoutItem,
  labelBounds: Bounds,
  context: RouteValidationContext,
  topRoutingLevels: RoutingLevelAllocator,
  bottomRoutingLevels: RoutingLevelAllocator
): AnatomyPointerRoute | null {
  const topEntry = trySelectTopEntryRoute(
    labelBounds,
    item.targetBounds,
    context,
    topRoutingLevels
  );
  if (topEntry) {
    return topEntry;
  }

  if (item.isFirstInRow) {
    const straight = trySelectStraightRightRoute(labelBounds, item.targetBounds, context);
    if (straight) {
      return straight;
    }
  } else {
    const bottomEntry = trySelectBottomEntryRoute(
      labelBounds,
      item.targetBounds,
      context,
      bottomRoutingLevels
    );
    if (bottomEntry) {
      return bottomEntry;
    }
  }

  return null;
}

/** Target anchor on the documented element (label-entry routes end at target). */
export function getRouteTargetPoint(route: AnatomyPointerRoute): Point {
  if (
    route.entryMode === 'top-entry' ||
    route.entryMode === 'bottom-entry' ||
    route.isTopEntry
  ) {
    return route.endPoint;
  }
  return route.startPoint;
}

function getBendLaneXs(
  frameBounds: Bounds,
  horizontalOffset: number,
  rightColumnX: number
): number[] {
  const frameRight = frameBounds.x + frameBounds.width;
  const minX = frameRight + ANATOMY_POINTER_MIN_CONNECTOR_GAP;
  const maxX = rightColumnX - ANATOMY_POINTER_MIN_CONNECTOR_GAP;

  if (maxX <= minX) {
    return [clamp(frameRight + horizontalOffset * 0.5, minX, maxX)];
  }

  const lanes = LANE_FRACTIONS.map((fraction) =>
    clamp(frameRight + horizontalOffset * fraction, minX, maxX)
  );

  const unique: number[] = [];
  for (const lane of lanes) {
    if (!unique.some((x) => Math.abs(x - lane) < 0.5)) {
      unique.push(lane);
    }
  }
  return unique;
}

function lanePenalty(laneIndex: number | undefined, laneCount: number): number {
  if (laneIndex == null || laneCount <= 1) return 0;
  const center = (laneCount - 1) / 2;
  return Math.abs(laneIndex - center) * 12;
}

function routingLevelPenalty(routingLevel: number | undefined): number {
  if (routingLevel == null || routingLevel <= 0) {
    return 0;
  }
  return routingLevel * 10;
}

export function generateCandidateRoutes(
  item: LayoutItem,
  endPoint: Point,
  frameBounds: Bounds,
  horizontalOffset: number,
  rightColumnX: number
): AnatomyPointerRoute[] {
  const anchors = getTargetAnchors(item.targetBounds);
  const candidates: AnatomyPointerRoute[] = [];
  const laneXs = getBendLaneXs(frameBounds, horizontalOffset, rightColumnX);

  const rightStart = anchors.right;
  if (Math.abs(rightStart.y - endPoint.y) < ALIGN_EPSILON && endPoint.x >= rightStart.x) {
    candidates.push(finalizeRoute('right', rightStart, null, endPoint, { laneIndex: 0 }));
  }

  if (endPoint.x >= rightStart.x + ALIGN_EPSILON) {
    candidates.push(
      finalizeRoute(
        'right',
        rightStart,
        { x: endPoint.x, y: rightStart.y },
        endPoint,
        undefined
      )
    );
  }

  laneXs.forEach((laneX, laneIndex) => {
    if (Math.abs(rightStart.y - endPoint.y) < ALIGN_EPSILON) {
      return;
    }
    candidates.push(
      finalizeRoute(
        'right',
        rightStart,
        { x: laneX, y: rightStart.y },
        endPoint,
        { laneIndex }
      )
    );
  });

  const topStart = anchors.top;
  if (
    Math.abs(topStart.x - endPoint.x) < ALIGN_EPSILON &&
    Math.abs(topStart.y - endPoint.y) < ALIGN_EPSILON
  ) {
    candidates.push(finalizeRoute('top', topStart, null, endPoint));
  } else if (Math.abs(topStart.x - endPoint.x) < ALIGN_EPSILON) {
    candidates.push(finalizeRoute('top', topStart, null, endPoint));
  } else {
    candidates.push(
      finalizeRoute('top', topStart, { x: topStart.x, y: endPoint.y }, endPoint)
    );
  }

  const bottomStart = anchors.bottom;
  if (
    Math.abs(bottomStart.x - endPoint.x) < ALIGN_EPSILON &&
    Math.abs(bottomStart.y - endPoint.y) < ALIGN_EPSILON
  ) {
    candidates.push(finalizeRoute('bottom', bottomStart, null, endPoint));
  } else if (Math.abs(bottomStart.x - endPoint.x) < ALIGN_EPSILON) {
    candidates.push(finalizeRoute('bottom', bottomStart, null, endPoint));
  } else {
    candidates.push(
      finalizeRoute('bottom', bottomStart, { x: bottomStart.x, y: endPoint.y }, endPoint)
    );
  }

  const uniqueCandidates: AnatomyPointerRoute[] = [];
  for (const route of candidates) {
    const duplicate = uniqueCandidates.some(
      (existing) =>
        existing.anchorType === route.anchorType &&
        pointsEqual(existing.startPoint, route.startPoint) &&
        ((!existing.bendPoint && !route.bendPoint) ||
          (existing.bendPoint &&
            route.bendPoint &&
            pointsEqual(existing.bendPoint, route.bendPoint))) &&
        pointsEqual(existing.endPoint, route.endPoint)
    );
    if (!duplicate) {
      uniqueCandidates.push(route);
    }
  }

  return uniqueCandidates;
}

function scoreValidRoute(
  route: AnatomyPointerRoute,
  frameBounds: Bounds,
  laneCount: number
): number {
  let frameContentCrossingPenalty = 0;
  for (const seg of route.segments) {
    if (segmentIntersectsRectInterior(seg, frameBounds)) {
      frameContentCrossingPenalty += 80;
    }
  }

  const verticalDelta = Math.abs(route.startPoint.y - route.endPoint.y);

  return (
    routeTotalLength(route) * 1 +
    verticalDelta * 0.5 +
    ANCHOR_PREFERENCE[route.anchorType] +
    frameContentCrossingPenalty +
    lanePenalty(route.laneIndex, laneCount) +
    routingLevelPenalty(route.routingLevel)
  );
}

export function isRouteValid(
  route: AnatomyPointerRoute,
  existingRoutes: AnatomyPointerRoute[],
  labelBoundsList: Bounds[],
  ownLabelBounds: Bounds,
  allTargetBounds: Bounds[],
  ownTargetBounds: Bounds
): boolean {
  return validateRoute(route, {
    existingRoutes,
    labelBoundsList,
    ownLabelBounds,
    allTargetBounds,
    targets: allTargetBounds.map((bounds, index) => ({
      id: `target-${index}`,
      bounds,
    })),
    ownTargetBounds,
    ownTargetId: 'own',
    frameBounds: { x: 0, y: 0, width: 0, height: 0 },
  });
}

function selectBestValidRoute(
  candidates: AnatomyPointerRoute[],
  context: RouteValidationContext,
  laneCount: number
): AnatomyPointerRoute | null {
  const anchorOrder: AnatomyPointerAnchorType[] = ['right', 'top', 'bottom'];

  const valid = candidates.filter((route) => validateRoute(route, context));

  if (valid.length === 0) {
    return null;
  }

  const scored = valid.map((route) => ({
    ...route,
    score: scoreValidRoute(route, context.frameBounds, laneCount),
    hasIntersection: false,
  }));

  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return anchorOrder.indexOf(a.anchorType) - anchorOrder.indexOf(b.anchorType);
  });

  return scored[0] ?? null;
}

function countRouteIntersections(
  route: AnatomyPointerRoute,
  context: RouteValidationContext
): number {
  let count = 0;
  if (doesRouteIntersectAnyRoute(route, context.existingRoutes)) count += 1;
  if (doesRouteIntersectAnyLabel(route, context.labelBoundsList, context.ownLabelBounds)) {
    count += 1;
  }
  if (
    doesRouteIntersectAnyTargetExceptOwnTarget(
      route,
      context.targets,
      context.ownTargetId
    )
  ) {
    count += 1;
  }
  return count;
}

function selectLeastBadRoute(
  candidates: AnatomyPointerRoute[],
  context: RouteValidationContext,
  laneCount: number
): AnatomyPointerRoute {
  const anchorOrder: AnatomyPointerAnchorType[] = ['right', 'top', 'bottom'];

  const scored = candidates.map((route) => ({
    route,
    intersections: countRouteIntersections(route, context),
    score: scoreValidRoute(route, context.frameBounds, laneCount),
  }));

  scored.sort((a, b) => {
    if (a.intersections !== b.intersections) return a.intersections - b.intersections;
    if (a.score !== b.score) return a.score - b.score;
    return (
      anchorOrder.indexOf(a.route.anchorType) - anchorOrder.indexOf(b.route.anchorType)
    );
  });

  const picked = scored[0]?.route ?? candidates[0];
  return {
    ...picked,
    score: scored[0]?.score ?? 0,
    hasIntersection: (scored[0]?.intersections ?? 0) > 0,
  };
}

/**
 * Stage 2: stable vertical label placement in the right column (preserves traversal order).
 */
export function resolveVerticalLabelPositions(
  items: LayoutItem[],
  rightColumnX: number,
  labelGap: number,
  minTopY?: number,
  maxBottomY?: number,
  containerBounds?: Bounds
): Map<string, Bounds> {
  const boundsById = new Map<string, Bounds>();
  if (items.length === 0) {
    return boundsById;
  }

  for (let i = 1; i < items.length; i += 1) {
    const prev = items[i - 1];
    const current = items[i];
    const minY = prev.labelY + prev.labelHeight + labelGap;
    if (current.labelY < minY) {
      current.labelY = minY;
    }
  }

  const groupHeight =
    items[items.length - 1].labelY +
    items[items.length - 1].labelHeight -
    items[0].labelY;
  const containerCenterY = containerBounds
    ? containerBounds.y + containerBounds.height / 2
    : items.reduce((sum, item) => sum + item.desiredCenterY, 0) / items.length;
  let desiredTop = containerCenterY - groupHeight / 2;

  if (minTopY != null) {
    desiredTop = Math.max(desiredTop, minTopY);
  }
  if (maxBottomY != null) {
    desiredTop = Math.min(desiredTop, maxBottomY - groupHeight);
  }

  const centerDelta = desiredTop - items[0].labelY;
  if (Math.abs(centerDelta) > ALIGN_EPSILON) {
    for (const item of items) {
      item.labelY += centerDelta;
    }
    for (let i = 1; i < items.length; i += 1) {
      const prev = items[i - 1];
      const current = items[i];
      const minY = prev.labelY + prev.labelHeight + labelGap;
      if (current.labelY < minY) {
        current.labelY = minY;
      }
    }
  }

  if (minTopY != null && items[0].labelY < minTopY) {
    const delta = minTopY - items[0].labelY;
    for (const item of items) {
      item.labelY += delta;
    }
  }

  const last = items[items.length - 1];
  const bottomAfter = last.labelY + last.labelHeight;
  if (maxBottomY != null && bottomAfter > maxBottomY) {
    const delta = bottomAfter - maxBottomY;
    for (const item of items) {
      item.labelY -= delta;
    }
  }

  for (let i = 1; i < items.length; i += 1) {
    const prev = items[i - 1];
    const current = items[i];
    const minY = prev.labelY + prev.labelHeight + labelGap;
    if (current.labelY < minY) {
      current.labelY = minY;
    }
  }

  for (const item of items) {
    boundsById.set(item.id, {
      x: rightColumnX,
      y: item.labelY,
      width: item.labelWidth,
      height: item.labelHeight,
    });
  }

  return boundsById;
}

function buildRoutingOrderedItems(pointers: AnatomyPointerLayoutInput[]): LayoutItem[] {
  const sorted = sortTargetsForAnatomyRouting(pointers);
  const rows = groupTargetsIntoRows(sorted);
  const items: LayoutItem[] = [];
  let sortIndex = 0;

  for (const row of rows) {
    for (let i = 0; i < row.items.length; i += 1) {
      const pointer = row.items[i];
      const centerY = boundsCenterY(pointer.targetBounds);
      items.push({
        id: pointer.id,
        targetBounds: pointer.targetBounds,
        labelWidth: Math.max(1, pointer.labelSize.width),
        labelHeight: Math.max(1, pointer.labelSize.height),
        desiredCenterY: centerY,
        labelY: centerY - pointer.labelSize.height / 2,
        sortIndex,
        rowIndex: row.rowIndex,
        isFirstInRow: i === 0,
      });
      sortIndex += 1;
    }
  }

  return items;
}

function tryLayoutAttempt(params: {
  frameBounds: AnatomyRect;
  items: LayoutItem[];
  horizontalOffset: number;
  labelGap: number;
  minTopY?: number;
  maxBottomY?: number;
}): LayoutAttemptResult {
  const { frameBounds, items, horizontalOffset, labelGap, minTopY, maxBottomY } = params;

  const workingItems = items.map((item) => ({ ...item }));
  const rightColumnX = frameBounds.x + frameBounds.width + horizontalOffset;
  resolveVerticalLabelPositions(
    workingItems,
    rightColumnX,
    labelGap,
    minTopY,
    maxBottomY,
    frameBounds
  );

  const targets = workingItems.map((item) => ({
    id: item.id,
    bounds: item.targetBounds,
  }));
  const laneCount = getBendLaneXs(frameBounds, horizontalOffset, rightColumnX).length;
  const topRoutingLevels = new RoutingLevelAllocator();
  const bottomRoutingLevels = new RoutingLevelAllocator();

  const existingRoutes: AnatomyPointerRoute[] = [];
  const results: AnatomyPointerLayoutResult[] = [];
  let intersectionCount = 0;
  let allValid = true;

  for (const item of workingItems) {
    const labelPosition = { x: rightColumnX, y: item.labelY };
    const ownLabelBounds: Bounds = {
      x: labelPosition.x,
      y: labelPosition.y,
      width: item.labelWidth,
      height: item.labelHeight,
    };
    const endPoint = {
      x: labelPosition.x,
      y: labelPosition.y + item.labelHeight / 2,
    };

    const labelBoundsList = workingItems.map((w) => ({
      x: rightColumnX,
      y: w.labelY,
      width: w.labelWidth,
      height: w.labelHeight,
    }));

    const validationContext = buildValidationContext(
      item,
      existingRoutes,
      labelBoundsList,
      ownLabelBounds,
      targets,
      frameBounds
    );

    const preferredRoute = trySelectPreferredRoute(
      item,
      ownLabelBounds,
      validationContext,
      topRoutingLevels,
      bottomRoutingLevels
    );

    if (preferredRoute) {
      existingRoutes.push(preferredRoute);
      results.push({
        id: item.id,
        labelPosition,
        selectedRoute: preferredRoute,
        startPoint: preferredRoute.startPoint,
        bendPoint: preferredRoute.bendPoint,
        endPoint: preferredRoute.endPoint,
      });
      continue;
    }

    const candidates = generateCandidateRoutes(
      item,
      endPoint,
      frameBounds,
      horizontalOffset,
      rightColumnX
    );

    let selected =
      selectBestValidRoute(
        candidates,
        validationContext,
        laneCount
      ) ?? null;

    if (!selected) {
      allValid = false;
      selected = selectLeastBadRoute(candidates, validationContext, laneCount);
      intersectionCount += countRouteIntersections(selected, validationContext);
    }

    existingRoutes.push(selected);

    results.push({
      id: item.id,
      labelPosition,
      selectedRoute: selected,
      startPoint: selected.startPoint,
      bendPoint: selected.bendPoint,
      endPoint: selected.endPoint,
    });
  }

  return { results, allValid, intersectionCount };
}

/** Stage 1: group and order targets for deterministic traversal. */
function analyzeAnatomyPointerTargets(
  pointers: AnatomyPointerLayoutInput[]
): LayoutItem[] {
  return buildRoutingOrderedItems(pointers);
}

/**
 * Places labels in a right column and routes connectors without intersections when possible.
 *
 * Stages: (1) target analysis, (2) label placement, (3) route selection, (4) validation/fallback.
 */
export function layoutAnatomyPointersRightSide(
  params: LayoutAnatomyPointersRightSideParams
): AnatomyPointerLayoutResult[] {
  const {
    frameBounds,
    pointers,
    horizontalOffset = ANATOMY_POINTER_RIGHT_OFFSET,
    labelGap = ANATOMY_POINTER_LABEL_GAP,
    minTopY,
    maxBottomY,
  } = params;

  if (pointers.length === 0) {
    return [];
  }

  const sortedItems = analyzeAnatomyPointerTargets(pointers);

  const strategies: { offsetMul: number; gapMul: number }[] = [
    { offsetMul: 1, gapMul: 1 },
    { offsetMul: 1.35, gapMul: 1 },
    { offsetMul: 1.35, gapMul: 1.5 },
  ];

  let bestAttempt: LayoutAttemptResult | null = null;

  for (let attempt = 0; attempt < ANATOMY_POINTER_MAX_FALLBACK_ATTEMPTS; attempt += 1) {
    const strategy = strategies[Math.min(attempt, strategies.length - 1)];
    const attemptResult = tryLayoutAttempt({
      frameBounds,
      items: sortedItems,
      horizontalOffset: horizontalOffset * strategy.offsetMul,
      labelGap: labelGap * strategy.gapMul,
      minTopY,
      maxBottomY,
    });

    if (attemptResult.allValid) {
      return attemptResult.results;
    }

    if (
      !bestAttempt ||
      attemptResult.intersectionCount < bestAttempt.intersectionCount ||
      (attemptResult.intersectionCount === bestAttempt.intersectionCount && attemptResult.allValid)
    ) {
      bestAttempt = attemptResult;
    }
  }

  return bestAttempt?.results ?? [];
}

export function getAnatomyRightColumnBounds(
  frameBounds: AnatomyRect,
  labelWidths: number[],
  labelHeights: number[],
  horizontalOffset = ANATOMY_POINTER_RIGHT_OFFSET
): AnatomyRect {
  const rightColumnX = frameBounds.x + frameBounds.width + horizontalOffset;
  const maxLabelW = labelWidths.length ? Math.max(...labelWidths) : 0;
  const totalLabelH = labelHeights.reduce((sum, h) => sum + h, 0);
  const maxLabelH = labelHeights.length ? Math.max(...labelHeights) : 0;

  return {
    x: rightColumnX,
    y: frameBounds.y,
    width: maxLabelW,
    height: Math.max(totalLabelH, maxLabelH, frameBounds.height),
  };
}

export function getDefaultAnatomyLabelBounds(
  frameBounds: AnatomyRect,
  markerSize: number,
  horizontalOffset = ANATOMY_POINTER_RIGHT_OFFSET
): { minTopY: number; maxBottomY: number } {
  return {
    minTopY: frameBounds.y - markerSize,
    maxBottomY: frameBounds.y + frameBounds.height + markerSize,
  };
}

/** Alias for generic anchor/lane candidate generation. */
export const createGenericCandidateRoutes = generateCandidateRoutes;
