/// <reference types="@figma/plugin-typings" />

import { createPluginFrame, createPluginRectangle } from '../figma/pluginSceneNodes';

import type {
  AnatomyBounds,
  AnatomyConnectorSegment,
  AnatomyItem,
  AnatomyPointerPlacement,
  AnatomyPointerSide,
  AnatomyPointerTarget,
  AnatomyRect,
  Point,
  PointerSide,
  Rect,
  StraightConnectorLine,
  ConnectorObstacle,
} from './anatomyTypes';
import { ANATOMY_COLORS } from './anatomyStyles';

const MARKER_OUTSIDE_GAP = 24;
const MARKER_AXIS_OFFSETS = [0, -28, 28, -56, 56, -84, 84] as const;

const MARKER_OVERLAP_PENALTY = 10000;
const LINE_THROUGH_MARKER_PENALTY = 8000;
const CONNECTOR_OVERLAP_PENALTY = 1000;
const CONNECTOR_CROSSING_PENALTY = 400;
const LINE_LENGTH_WEIGHT = 0.1;
const SEGMENT_COUNT_WEIGHT = 20;
const TARGET_OBSTACLE_PENALTY = 8000;
const ACCENT_OBSTACLE_PENALTY = 10000;
const CLOSE_TO_OBSTACLE_PENALTY = 200;

const SIDE_ORDER: PointerSide[] = ['left', 'right', 'top', 'bottom'];
const anatomyGeometryWarnings = new Set<string>();

function warnOnce(key: string, message: string): void {
  if (anatomyGeometryWarnings.has(key)) return;
  anatomyGeometryWarnings.add(key);
  console.warn(message);
}

function roundPoint(point: Point): Point {
  return { x: Math.round(point.x), y: Math.round(point.y) };
}

function clampMin(value: number, min: number): number {
  return value < min ? min : value;
}

function isFinitePoint(point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function getMarkerBounds(center: Point, markerDiameter: number): Rect {
  const r = markerDiameter / 2;
  return {
    x: Math.round(center.x - r),
    y: Math.round(center.y - r),
    width: markerDiameter,
    height: markerDiameter,
  };
}

function getTargetCenter(targetBounds: Rect): Point {
  return {
    x: targetBounds.x + targetBounds.width / 2,
    y: targetBounds.y + targetBounds.height / 2,
  };
}

function getTargetEdgePoint(side: PointerSide, targetBounds: Rect): Point {
  const c = getTargetCenter(targetBounds);
  if (side === 'left') return roundPoint({ x: targetBounds.x, y: c.y });
  if (side === 'right') return roundPoint({ x: targetBounds.x + targetBounds.width, y: c.y });
  if (side === 'top') return roundPoint({ x: c.x, y: targetBounds.y });
  return roundPoint({ x: c.x, y: targetBounds.y + targetBounds.height });
}

function getMarkerEdgePoint(
  side: PointerSide,
  markerCenter: Point,
  markerRadius: number
): Point {
  if (side === 'left') {
    return roundPoint({ x: markerCenter.x + markerRadius, y: markerCenter.y });
  }
  if (side === 'right') {
    return roundPoint({ x: markerCenter.x - markerRadius, y: markerCenter.y });
  }
  if (side === 'top') {
    return roundPoint({ x: markerCenter.x, y: markerCenter.y + markerRadius });
  }
  return roundPoint({ x: markerCenter.x, y: markerCenter.y - markerRadius });
}

function lineLength(line: StraightConnectorLine): number {
  return Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
}

function isHorizontal(line: StraightConnectorLine): boolean {
  return line.y1 === line.y2 && line.x1 !== line.x2;
}

function isVertical(line: StraightConnectorLine): boolean {
  return line.x1 === line.x2 && line.y1 !== line.y2;
}

function isOrthogonalLine(line: StraightConnectorLine): boolean {
  return isHorizontal(line) || isVertical(line);
}

function isMarkerOutsideArtwork(markerBounds: Rect, artworkBounds: Rect): boolean {
  return !rectsIntersect(markerBounds, artworkBounds);
}

function inflateRect(rect: Rect, padding: number): Rect {
  return {
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };
}

function pushOrthogonalSegment(
  segments: StraightConnectorLine[],
  x1: number,
  y1: number,
  x2: number,
  y2: number
): void {
  const line: StraightConnectorLine = {
    x1: Math.round(x1),
    y1: Math.round(y1),
    x2: Math.round(x2),
    y2: Math.round(y2),
  };
  if (!isOrthogonalLine(line)) return;
  if (lineLength(line) <= 0) return;
  segments.push(line);
}

function buildConnectorLines(params: {
  side: PointerSide;
  markerCenter: Point;
  markerRadius: number;
  targetPoint: Point;
  artworkBounds: Rect;
  routeMode: 'primary' | 'secondary' | 'gutter';
}): StraightConnectorLine[] {
  const { side, markerCenter, markerRadius, targetPoint, artworkBounds, routeMode } = params;
  const start = getMarkerEdgePoint(side, markerCenter, markerRadius);
  const lines: StraightConnectorLine[] = [];

  if (routeMode === 'gutter') {
    if (side === 'top' || side === 'bottom') {
      const gutterY =
        side === 'top'
          ? artworkBounds.y - MARKER_OUTSIDE_GAP - markerRadius - 24
          : artworkBounds.y + artworkBounds.height + MARKER_OUTSIDE_GAP + markerRadius + 24;
      pushOrthogonalSegment(lines, start.x, start.y, start.x, gutterY);
      pushOrthogonalSegment(lines, start.x, gutterY, targetPoint.x, gutterY);
      pushOrthogonalSegment(lines, targetPoint.x, gutterY, targetPoint.x, targetPoint.y);
      return lines;
    }
    const gutterX =
      side === 'left'
        ? artworkBounds.x - MARKER_OUTSIDE_GAP - markerRadius - 24
        : artworkBounds.x + artworkBounds.width + MARKER_OUTSIDE_GAP + markerRadius + 24;
    pushOrthogonalSegment(lines, start.x, start.y, gutterX, start.y);
    pushOrthogonalSegment(lines, gutterX, start.y, gutterX, targetPoint.y);
    pushOrthogonalSegment(lines, gutterX, targetPoint.y, targetPoint.x, targetPoint.y);
    return lines;
  }

  if (routeMode === 'secondary') {
    if (start.y === targetPoint.y || start.x === targetPoint.x) {
      pushOrthogonalSegment(lines, start.x, start.y, targetPoint.x, targetPoint.y);
      return lines;
    }
    pushOrthogonalSegment(lines, start.x, start.y, targetPoint.x, start.y);
    pushOrthogonalSegment(lines, targetPoint.x, start.y, targetPoint.x, targetPoint.y);
    return lines;
  }

  if (start.y === targetPoint.y || start.x === targetPoint.x) {
    pushOrthogonalSegment(lines, start.x, start.y, targetPoint.x, targetPoint.y);
    return lines;
  }
  pushOrthogonalSegment(lines, start.x, start.y, start.x, targetPoint.y);
  pushOrthogonalSegment(lines, start.x, targetPoint.y, targetPoint.x, targetPoint.y);
  return lines;
}

function validatePointerPlacement(params: {
  side: PointerSide;
  markerCenter: Point;
  markerBounds: Rect;
  markerRadius: number;
  targetPoint: Point;
  lines: StraightConnectorLine[];
  artworkBounds: Rect;
}): boolean {
  const { side, markerCenter, markerBounds, markerRadius, targetPoint, lines, artworkBounds } = params;
  if (!isFinitePoint(markerCenter) || !isFinitePoint(targetPoint)) return false;
  if (!lines.length) return false;

  const markerEdge = getMarkerEdgePoint(side, markerCenter, markerRadius);
  const first = lines[0];
  const last = lines[lines.length - 1];
  if (!first || !last) return false;
  if (first.x1 !== markerEdge.x || first.y1 !== markerEdge.y) return false;
  if (last.x2 !== targetPoint.x || last.y2 !== targetPoint.y) return false;

  for (const line of lines) {
    if (!Number.isFinite(line.x1) || !Number.isFinite(line.y1) || !Number.isFinite(line.x2) || !Number.isFinite(line.y2)) {
      return false;
    }
    if (!isOrthogonalLine(line)) return false;
    if (lineLength(line) <= 0) return false;
  }

  for (let i = 1; i < lines.length; i++) {
    const prev = lines[i - 1];
    const curr = lines[i];
    if (prev.x2 !== curr.x1 || prev.y2 !== curr.y1) return false;
  }

  const touchesMarker =
    (side === 'left' && first.x1 === markerBounds.x + markerBounds.width) ||
    (side === 'right' && first.x1 === markerBounds.x) ||
    (side === 'top' && first.y1 === markerBounds.y + markerBounds.height) ||
    (side === 'bottom' && first.y1 === markerBounds.y);
  if (!touchesMarker) return false;
  return isMarkerOutsideArtwork(markerBounds, artworkBounds);
}

function lineRect(line: StraightConnectorLine): Rect {
  if (isHorizontal(line)) {
    return {
      x: Math.min(line.x1, line.x2),
      y: line.y1,
      width: clampMin(Math.abs(line.x2 - line.x1), 1),
      height: 1,
    };
  }
  return {
    x: line.x1,
    y: Math.min(line.y1, line.y2),
    width: 1,
    height: clampMin(Math.abs(line.y2 - line.y1), 1),
  };
}

function rectsIntersect(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

function rangesOverlap(a1: number, a2: number, b1: number, b2: number): boolean {
  const minA = Math.min(a1, a2);
  const maxA = Math.max(a1, a2);
  const minB = Math.min(b1, b2);
  const maxB = Math.max(b1, b2);
  return Math.max(minA, minB) <= Math.min(maxA, maxB);
}

function linesOverlap(a: StraightConnectorLine, b: StraightConnectorLine): boolean {
  if (isHorizontal(a) && isHorizontal(b) && a.y1 === b.y1) {
    return rangesOverlap(a.x1, a.x2, b.x1, b.x2);
  }
  if (isVertical(a) && isVertical(b) && a.x1 === b.x1) {
    return rangesOverlap(a.y1, a.y2, b.y1, b.y2);
  }
  return false;
}

function linesCross(a: StraightConnectorLine, b: StraightConnectorLine): boolean {
  if (isHorizontal(a) && isVertical(b)) {
    return rangesOverlap(a.x1, a.x2, b.x1, b.x2) && rangesOverlap(b.y1, b.y2, a.y1, a.y2);
  }
  if (isVertical(a) && isHorizontal(b)) {
    return rangesOverlap(b.x1, b.x2, a.x1, a.x2) && rangesOverlap(a.y1, a.y2, b.y1, b.y2);
  }
  return false;
}

function sidePreferenceOrder(target: AnatomyPointerTarget, artworkBounds: Rect): PointerSide[] {
  const c = target.targetCenter;
  const distances: Array<{ side: PointerSide; d: number }> = [
    { side: 'left', d: Math.abs(c.x - artworkBounds.x) },
    { side: 'right', d: Math.abs(artworkBounds.x + artworkBounds.width - c.x) },
    { side: 'top', d: Math.abs(c.y - artworkBounds.y) },
    { side: 'bottom', d: Math.abs(artworkBounds.y + artworkBounds.height - c.y) },
  ];
  distances.sort((a, b) => a.d - b.d || SIDE_ORDER.indexOf(a.side) - SIDE_ORDER.indexOf(b.side));
  return distances.map((entry) => entry.side);
}

function getMarkerCenterOutsideArtwork(params: {
  side: PointerSide;
  targetCenter: Point;
  artworkBounds: Rect;
  markerRadius: number;
  outsideGap: number;
  axisOffset: number;
}): Point {
  const { side, targetCenter, artworkBounds, markerRadius, outsideGap, axisOffset } = params;
  if (side === 'top') {
    return roundPoint({
      x: targetCenter.x + axisOffset,
      y: artworkBounds.y - outsideGap - markerRadius,
    });
  }
  if (side === 'bottom') {
    return roundPoint({
      x: targetCenter.x + axisOffset,
      y: artworkBounds.y + artworkBounds.height + outsideGap + markerRadius,
    });
  }
  if (side === 'left') {
    return roundPoint({
      x: artworkBounds.x - outsideGap - markerRadius,
      y: targetCenter.y + axisOffset,
    });
  }
  return roundPoint({
    x: artworkBounds.x + artworkBounds.width + outsideGap + markerRadius,
    y: targetCenter.y + axisOffset,
  });
}

function buildCandidate(params: {
  itemId: string;
  target: AnatomyPointerTarget;
  side: PointerSide;
  markerDiameter: number;
  outsideGap: number;
  axisOffset: number;
  artworkBounds: Rect;
  routeMode: 'primary' | 'secondary' | 'gutter';
}): {
  itemId: string;
  side: PointerSide;
  markerCenter: Point;
  markerBounds: Rect;
  targetPoint: Point;
  lines: StraightConnectorLine[];
  totalLineLength: number;
  axisDistance: number;
} | null {
  const { itemId, target, side, markerDiameter, outsideGap, axisOffset, artworkBounds, routeMode } = params;
  const markerRadius = markerDiameter / 2;
  const targetPoint = getTargetEdgePoint(side, target.targetBounds);
  const markerCenter = getMarkerCenterOutsideArtwork({
    side,
    targetCenter: target.targetCenter,
    artworkBounds,
    markerRadius,
    outsideGap,
    axisOffset,
  });
  const markerBounds = getMarkerBounds(markerCenter, markerDiameter);
  const lines = buildConnectorLines({
    side,
    markerCenter,
    markerRadius,
    targetPoint,
    artworkBounds,
    routeMode,
  });

  if (
    !validatePointerPlacement({
      side,
      markerCenter,
      markerBounds,
      markerRadius,
      targetPoint,
      lines,
      artworkBounds,
    })
  ) {
    return null;
  }

  return {
    itemId,
    side,
    markerCenter,
    markerBounds,
    targetPoint,
    lines,
    totalLineLength: lines.reduce((sum, line) => sum + lineLength(line), 0),
    axisDistance:
      side === 'top' || side === 'bottom'
        ? Math.abs(markerCenter.x - target.targetCenter.x)
        : Math.abs(markerCenter.y - target.targetCenter.y),
  };
}

function segmentIntersectsRect(segment: StraightConnectorLine, rect: Rect): boolean {
  return rectsIntersect(lineRect(segment), rect);
}

function scoreCandidate(params: {
  candidate: ReturnType<typeof buildCandidate> extends infer T ? T : never;
  placed: AnatomyPointerPlacement[];
  targets: AnatomyPointerTarget[];
  artworkBounds: Rect;
  preferredOrder: PointerSide[];
  obstacles: ConnectorObstacle[];
}): number {
  const { candidate, placed, targets, artworkBounds, preferredOrder, obstacles } = params;
  if (!candidate) return Number.POSITIVE_INFINITY;

  let score = 0;
  const candidateLineRects = candidate.lines.map((line) => lineRect(line));

  for (const existing of placed) {
    const existingMarkerBounds: Rect = {
      x: existing.markerX,
      y: existing.markerY,
      width: existing.markerSize,
      height: existing.markerSize,
    };
    if (rectsIntersect(candidate.markerBounds, existingMarkerBounds)) {
      score += MARKER_OVERLAP_PENALTY;
    }

    const existingLines: StraightConnectorLine[] = existing.segments
      .map((segment) => {
        if (segment.orientation === 'horizontal') {
          return {
            x1: segment.x,
            y1: segment.y,
            x2: segment.x + segment.length,
            y2: segment.y,
          };
        }
        if (segment.orientation === 'vertical') {
          return {
            x1: segment.x,
            y1: segment.y,
            x2: segment.x,
            y2: segment.y + segment.length,
          };
        }
        return null;
      })
      .filter((line): line is StraightConnectorLine => Boolean(line));

    for (const candidateLineRect of candidateLineRects) {
      if (rectsIntersect(candidateLineRect, existingMarkerBounds)) {
        score += LINE_THROUGH_MARKER_PENALTY;
      }
    }
    for (const existingLine of existingLines) {
      if (rectsIntersect(lineRect(existingLine), candidate.markerBounds)) {
        score += LINE_THROUGH_MARKER_PENALTY;
      }
      for (const candidateLine of candidate.lines) {
        if (linesOverlap(candidateLine, existingLine)) {
          score += CONNECTOR_OVERLAP_PENALTY;
        } else if (linesCross(candidateLine, existingLine)) {
          score += CONNECTOR_CROSSING_PENALTY;
        }
      }
    }
  }

  for (const target of targets) {
    if (target.itemId === candidate.itemId) continue;
    const targetRect = inflateRect(target.targetBounds, 3);
    for (const line of candidate.lines) {
      if (segmentIntersectsRect(line, targetRect)) {
        score += TARGET_OBSTACLE_PENALTY;
      }
    }
  }

  for (const obstacle of obstacles) {
    const inflated = inflateRect(obstacle.bounds, 2);
    for (const line of candidate.lines) {
      if (!segmentIntersectsRect(line, inflated)) continue;
      if (obstacle.kind === 'accent') {
        score += ACCENT_OBSTACLE_PENALTY;
      } else if (obstacle.kind === 'target' && obstacle.relatedItemId !== candidate.itemId) {
        score += TARGET_OBSTACLE_PENALTY;
      } else if (obstacle.kind === 'marker' && obstacle.relatedItemId !== candidate.itemId) {
        score += LINE_THROUGH_MARKER_PENALTY;
      }
    }
    const closeInflated = inflateRect(obstacle.bounds, 6);
    for (const line of candidate.lines) {
      if (segmentIntersectsRect(line, closeInflated)) {
        score += CLOSE_TO_OBSTACLE_PENALTY;
      }
    }
  }

  if (rectsIntersect(candidate.markerBounds, artworkBounds)) {
    return Number.POSITIVE_INFINITY;
  }

  const sideRank = preferredOrder.indexOf(candidate.side);
  score += (sideRank < 0 ? SIDE_ORDER.length : sideRank) * 25;
  score += candidate.axisDistance * 0.2;
  score += candidate.totalLineLength * LINE_LENGTH_WEIGHT;
  score += candidate.lines.length * SEGMENT_COUNT_WEIGHT;
  return score;
}

function toSegment(line: StraightConnectorLine, nameSuffix: string): AnatomyConnectorSegment {
  if (isHorizontal(line)) {
    const x = Math.min(line.x1, line.x2);
    return {
      orientation: 'horizontal',
      x,
      y: line.y1,
      length: clampMin(Math.abs(line.x2 - line.x1), 1),
      nameSuffix,
    };
  }
  const y = Math.min(line.y1, line.y2);
  return {
    orientation: 'vertical',
    x: line.x1,
    y,
    length: clampMin(Math.abs(line.y2 - line.y1), 1),
    nameSuffix,
  };
}

function toPlacement(
  item: AnatomyItem,
  side: PointerSide,
  markerCenter: Point,
  markerBounds: Rect,
  targetPoint: Point,
  lines: StraightConnectorLine[],
  itemBounds: AnatomyBounds,
  markerSize: number
): AnatomyPointerPlacement {
  void markerCenter;
  return {
    item,
    side: side as AnatomyPointerSide,
    targetX: targetPoint.x,
    targetY: targetPoint.y,
    markerX: markerBounds.x,
    markerY: markerBounds.y,
    markerSize,
    itemBounds,
    segments: lines.map((line, index) => toSegment(line, String(index + 1))),
  };
}

function getItemPlacementId(item: AnatomyItem): string {
  return String(item.id || item.nodeId);
}

function isFiniteRect(rect: Rect): boolean {
  return (
    Number.isFinite(rect.x) &&
    Number.isFinite(rect.y) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height)
  );
}

function buildTargets(items: AnatomyItem[], rootBoundsInPreview: AnatomyRect): AnatomyPointerTarget[] {
  return items
    .map((item) => {
      const itemId = getItemPlacementId(item);
      if (
        !Number.isFinite(item.bounds.x) ||
        !Number.isFinite(item.bounds.y) ||
        !Number.isFinite(item.bounds.width) ||
        !Number.isFinite(item.bounds.height)
      ) {
        warnOnce(
          `anatomy-invalid-item-bounds:${itemId}`,
          `[Anatomy] Skipping marker target for "${item.finalLabel || item.name || item.rawName}" (${itemId}): invalid item bounds.`
        );
        return null;
      }

      const width = Math.max(1, Math.round(item.bounds.width));
      const height = Math.max(1, Math.round(item.bounds.height));
      const targetBounds: Rect = {
        x: Math.round(rootBoundsInPreview.x + item.bounds.x),
        y: Math.round(rootBoundsInPreview.y + item.bounds.y),
        width,
        height,
      };
      if (!isFiniteRect(targetBounds)) {
        warnOnce(
          `anatomy-invalid-target-bounds:${itemId}`,
          `[Anatomy] Skipping marker target for "${item.finalLabel || item.name || item.rawName}" (${itemId}): invalid target bounds.`
        );
        return null;
      }
      return {
        itemId,
        markerIndex: item.markerIndex,
        label: item.finalLabel || item.name || '',
        targetBounds,
        targetCenter: roundPoint(getTargetCenter(targetBounds)),
      };
    })
    .filter((target): target is AnatomyPointerTarget => Boolean(target))
    .sort((a, b) => a.markerIndex - b.markerIndex);
}

function resolveMarkerCollisions(
  placements: AnatomyPointerPlacement[],
  itemsById: Map<string, AnatomyItem>,
  targetsById: Map<string, AnatomyPointerTarget>,
  allTargets: AnatomyPointerTarget[],
  artworkBounds: Rect,
  markerSize: number
): AnatomyPointerPlacement[] {
  void itemsById;
  void targetsById;
  void allTargets;
  void artworkBounds;
  void markerSize;
  return placements.slice();
}

function createFallbackPlacementForTarget(params: {
  item: AnatomyItem;
  target: AnatomyPointerTarget;
  artworkBounds: Rect;
  markerSize: number;
  preferred: PointerSide[];
  fallbackIndex: number;
}): AnatomyPointerPlacement | null {
  const { item, target, artworkBounds, markerSize, preferred, fallbackIndex } = params;
  const fallbackOffsets = [
    0,
    (fallbackIndex + 1) * (markerSize + 8),
    -(fallbackIndex + 1) * (markerSize + 8),
  ];
  const gapSteps = [24, 36, 48, 64, 80, 120];

  for (const outsideGap of gapSteps) {
    for (const side of preferred) {
      for (const axisOffset of fallbackOffsets) {
        const candidate = buildCandidate({
          itemId: target.itemId,
          target,
          side,
          markerDiameter: markerSize,
          outsideGap,
          axisOffset,
          artworkBounds,
          routeMode: 'gutter',
        });
        if (!candidate) continue;
        const itemBounds: AnatomyBounds = {
          x: target.targetBounds.x,
          y: target.targetBounds.y,
          width: target.targetBounds.width,
          height: target.targetBounds.height,
          centerX: target.targetCenter.x,
          centerY: target.targetCenter.y,
        };
        return toPlacement(
          item,
          side,
          candidate.markerCenter,
          candidate.markerBounds,
          candidate.targetPoint,
          candidate.lines,
          itemBounds,
          markerSize
        );
      }
    }
  }

  return null;
}

export function calculatePointerPlacements(
  items: AnatomyItem[],
  _rootBoundsRelative: AnatomyRect,
  rootBoundsInPreview: AnatomyRect,
  markerSize: number,
  options?: { obstacles?: ConnectorObstacle[] }
): AnatomyPointerPlacement[] {
  if (!items.length) return [];
  if (
    !Number.isFinite(rootBoundsInPreview.x) ||
    !Number.isFinite(rootBoundsInPreview.y) ||
    !Number.isFinite(rootBoundsInPreview.width) ||
    !Number.isFinite(rootBoundsInPreview.height)
  ) {
    warnOnce('anatomy-invalid-artwork-bounds', '[Anatomy] Cannot place markers: invalid artwork bounds.');
    return [];
  }

  const targets = buildTargets(items, rootBoundsInPreview);
  const targetsById = new Map(targets.map((target) => [target.itemId, target]));
  const itemsById = new Map(items.map((item) => [getItemPlacementId(item), item]));
  const artworkBounds: Rect = {
    x: Math.round(rootBoundsInPreview.x),
    y: Math.round(rootBoundsInPreview.y),
    width: Math.round(rootBoundsInPreview.width),
    height: Math.round(rootBoundsInPreview.height),
  };
  const externalObstacles = options?.obstacles ?? [];

  const placed: AnatomyPointerPlacement[] = [];

  for (const target of targets) {
    const item = itemsById.get(target.itemId);
    if (!item) continue;

    const preferred = sidePreferenceOrder(target, artworkBounds);
    let bestPlacement: AnatomyPointerPlacement | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    const gapSteps = [MARKER_OUTSIDE_GAP, 36, 48, 64];

    for (const outsideGap of gapSteps) {
      for (const side of preferred) {
        for (const axisOffset of MARKER_AXIS_OFFSETS) {
          const candidate = buildCandidate({
            itemId: target.itemId,
            target,
            side,
            markerDiameter: markerSize,
            outsideGap,
            axisOffset,
            artworkBounds,
            routeMode: 'primary',
          });
          if (!candidate) continue;

          const routeModes: Array<'primary' | 'secondary' | 'gutter'> = ['primary', 'secondary', 'gutter'];
          for (const routeMode of routeModes) {
            const routeCandidate =
              routeMode === 'primary'
                ? candidate
                : buildCandidate({
                    itemId: target.itemId,
                    target,
                    side,
                    markerDiameter: markerSize,
                    outsideGap,
                    axisOffset,
                    artworkBounds,
                    routeMode,
                  });
            if (!routeCandidate) continue;

            const dynamicObstacles: ConnectorObstacle[] = [
              ...externalObstacles,
              ...targets.map((entry) => ({
                id: `target:${entry.itemId}`,
                kind: 'target' as const,
                relatedItemId: entry.itemId,
                bounds: inflateRect(entry.targetBounds, 3),
              })),
              ...placed.map((entry) => ({
                id: `marker:${getItemPlacementId(entry.item)}`,
                kind: 'marker' as const,
                relatedItemId: getItemPlacementId(entry.item),
                bounds: {
                  x: entry.markerX,
                  y: entry.markerY,
                  width: entry.markerSize,
                  height: entry.markerSize,
                },
              })),
            ];

            const score = scoreCandidate({
              candidate: routeCandidate,
              placed,
              targets,
              artworkBounds,
              preferredOrder: preferred,
              obstacles: dynamicObstacles,
            });
            if (score < bestScore) {
              const itemBounds: AnatomyBounds = {
                x: target.targetBounds.x,
                y: target.targetBounds.y,
                width: target.targetBounds.width,
                height: target.targetBounds.height,
                centerX: target.targetCenter.x,
                centerY: target.targetCenter.y,
              };
              bestPlacement = toPlacement(
                item,
                side,
                routeCandidate.markerCenter,
                routeCandidate.markerBounds,
                routeCandidate.targetPoint,
                routeCandidate.lines,
                itemBounds,
                markerSize
              );
              bestScore = score;
            }
          }
        }
      }
    }

    if (!bestPlacement) {
      // Fallback: least bad external candidate with expanded gap.
      for (const outsideGap of [64, 80, 96]) {
        for (const side of preferred) {
          for (const axisOffset of MARKER_AXIS_OFFSETS) {
          const candidate = buildCandidate({
            itemId: target.itemId,
            target,
            side,
            markerDiameter: markerSize,
            outsideGap,
            axisOffset,
            artworkBounds,
            routeMode: 'gutter',
          });
          if (!candidate) continue;
          const score = scoreCandidate({
            candidate,
            placed,
            targets,
            artworkBounds,
            preferredOrder: preferred,
            obstacles: externalObstacles,
          });
          if (score < bestScore) {
            const itemBounds: AnatomyBounds = {
              x: target.targetBounds.x,
              y: target.targetBounds.y,
              width: target.targetBounds.width,
              height: target.targetBounds.height,
              centerX: target.targetCenter.x,
              centerY: target.targetCenter.y,
            };
            bestPlacement = toPlacement(
              item,
              side,
              candidate.markerCenter,
              candidate.markerBounds,
              candidate.targetPoint,
              candidate.lines,
              itemBounds,
              markerSize
            );
            bestScore = score;
          }
          }
        }
      }
    }

    if (!bestPlacement) {
      const fallbackSide = preferred[0] || 'right';
      const fallbackCandidate = buildCandidate({
        itemId: target.itemId,
        target,
        side: fallbackSide,
        markerDiameter: markerSize,
        outsideGap: 96,
        axisOffset: 0,
        artworkBounds,
        routeMode: 'gutter',
      });
      if (fallbackCandidate) {
        const itemBounds: AnatomyBounds = {
          x: target.targetBounds.x,
          y: target.targetBounds.y,
          width: target.targetBounds.width,
          height: target.targetBounds.height,
          centerX: target.targetCenter.x,
          centerY: target.targetCenter.y,
        };
        bestPlacement = toPlacement(
          item,
          fallbackSide,
          fallbackCandidate.markerCenter,
          fallbackCandidate.markerBounds,
          fallbackCandidate.targetPoint,
          fallbackCandidate.lines,
          itemBounds,
          markerSize
        );
      }
    }

    if (bestPlacement) {
      placed.push(bestPlacement);
    }
  }

  const resolved = resolveMarkerCollisions(
    placed,
    itemsById,
    targetsById,
    targets,
    artworkBounds,
    markerSize
  );
  const byId = new Map<string, AnatomyPointerPlacement>();
  for (const placement of resolved) {
    const id = getItemPlacementId(placement.item);
    if (byId.has(id)) {
      warnOnce(
        `anatomy-duplicate-placement:${id}`,
        `[Anatomy] Duplicate marker placement detected for "${placement.item.finalLabel || placement.item.name || placement.item.rawName}" (${id}). Keeping first placement.`
      );
      continue;
    }
    byId.set(id, placement);
  }

  let fallbackCounter = 0;
  for (const target of targets) {
    if (byId.has(target.itemId)) continue;
    const item = itemsById.get(target.itemId);
    if (!item) continue;
    const preferred = sidePreferenceOrder(target, artworkBounds);
    const fallback = createFallbackPlacementForTarget({
      item,
      target,
      artworkBounds,
      markerSize,
      preferred,
      fallbackIndex: fallbackCounter,
    });
    if (fallback) {
      byId.set(target.itemId, fallback);
      fallbackCounter += 1;
      warnOnce(
        `anatomy-fallback-placement:${target.itemId}`,
        `[Anatomy] Created fallback marker placement for "${item.finalLabel || item.name || item.rawName}" (${target.itemId}).`
      );
    } else {
      warnOnce(
        `anatomy-missing-placement:${target.itemId}`,
        `[Anatomy] Missing marker placement for "${item.finalLabel || item.name || item.rawName}" (${target.itemId}): no valid fallback placement.`
      );
    }
  }

  for (const item of items) {
    const itemId = getItemPlacementId(item);
    if (byId.has(itemId)) continue;
    warnOnce(
      `anatomy-item-without-target:${itemId}`,
      `[Anatomy] Item "${item.finalLabel || item.name || item.rawName}" (${itemId}) has no valid target bounds and cannot be rendered.`
    );
  }

  return Array.from(byId.values()).sort((a, b) => a.item.markerIndex - b.item.markerIndex);
}

export function createAnatomyConnectorFrame(
  index: number,
  segments: AnatomyConnectorSegment[],
  color: RGB
): FrameNode {
  const frame = createPluginFrame();
  frame.name = `Anatomy connector / ${index}`;
  frame.layoutMode = 'NONE';
  frame.fills = [];
  frame.strokes = [];
  frame.clipsContent = false;
  frame.itemSpacing = 0;
  frame.paddingTop = 0;
  frame.paddingRight = 0;
  frame.paddingBottom = 0;
  frame.paddingLeft = 0;

  if (!segments.length) {
    frame.resize(1, 1);
    return frame;
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const segment of segments) {
    if (segment.orientation !== 'horizontal' && segment.orientation !== 'vertical') {
      continue;
    }
    const rect = createPluginRectangle();
    rect.name = `Anatomy connector segment / ${index} / ${segment.nameSuffix}`;
    rect.fills = [{ type: 'SOLID', color }];
    rect.strokes = [];

    if (segment.orientation === 'horizontal') {
      const width = clampMin(Math.round(segment.length), 1);
      rect.resize(width, 1);
      rect.x = Math.round(segment.x);
      rect.y = Math.round(segment.y);
    } else {
      const height = clampMin(Math.round(segment.length), 1);
      rect.resize(1, height);
      rect.x = Math.round(segment.x);
      rect.y = Math.round(segment.y);
    }
    frame.appendChild(rect);

    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  }

  if (!frame.children.length) {
    frame.resize(1, 1);
    return frame;
  }

  for (const child of frame.children) {
    child.x -= minX;
    child.y -= minY;
  }

  frame.resize(clampMin(Math.round(maxX - minX), 1), clampMin(Math.round(maxY - minY), 1));
  return frame;
}

export function getPointerFrameBounds(
  placement: AnatomyPointerPlacement,
  markerSize: number
): AnatomyRect {
  let minX = placement.markerX;
  let minY = placement.markerY;
  let maxX = placement.markerX + markerSize;
  let maxY = placement.markerY + markerSize;

  for (const segment of placement.segments) {
    if (segment.orientation === 'horizontal') {
      minX = Math.min(minX, segment.x);
      maxX = Math.max(maxX, segment.x + segment.length);
      minY = Math.min(minY, segment.y);
      maxY = Math.max(maxY, segment.y + 1);
    } else if (segment.orientation === 'vertical') {
      minX = Math.min(minX, segment.x);
      maxX = Math.max(maxX, segment.x + 1);
      minY = Math.min(minY, segment.y);
      maxY = Math.max(maxY, segment.y + segment.length);
    }
  }

  return {
    x: Math.round(minX),
    y: Math.round(minY),
    width: clampMin(Math.round(maxX - minX), markerSize),
    height: clampMin(Math.round(maxY - minY), markerSize),
  };
}

export function getDefaultConnectorColor(): RGB {
  return ANATOMY_COLORS.accent;
}
