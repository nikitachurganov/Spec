/// <reference types="@figma/plugin-typings" />

/**
 * Multi-side L-shaped anatomy pointer layout.
 *
 * Pipeline (per call):
 *   1. For every AnatomyItem compute target center + sorted preferred sides
 *      based on distance to each artwork edge.
 *   2. Seed each item on its most-preferred side (initial candidate).
 *   3. Distribute markers per side along the side's axis so they no longer
 *      overlap (sort → forward-pass → backward-pass → clamp).
 *   4. Score the global layout (collisions, crossings, length, overcrowding).
 *   5. Up to 3 improvement iterations: for the worst-scoring items, try the
 *      remaining preferred sides and keep the variant with the lowest score.
 *   6. Re-build L-shaped 1px segment routes after every marker move.
 *
 * Output is the legacy `AnatomyPointerPlacement[]` so existing rendering
 * (`createAnatomyPointer` in `anatomyGenerator.ts`) keeps working unchanged.
 */

import type {
  AnatomyBounds,
  AnatomyConnectorSegment,
  AnatomyItem,
  AnatomyPointerPlacement,
  AnatomyPointerSide,
  AnatomyRect,
} from './anatomyTypes';

// ─────────────────────────────────────────────────────────────────────────
// Geometry primitives
// ─────────────────────────────────────────────────────────────────────────

type Point = { x: number; y: number };
type Rect = { x: number; y: number; width: number; height: number };

const SIDES: readonly AnatomyPointerSide[] = ['left', 'right', 'top', 'bottom'];
const SCORE_MARKER_COLLISION = 1000;
const SCORE_SEGMENT_THROUGH_MARKER = 600;
const SCORE_OUT_OF_BOUNDS = 1000;
const SCORE_SEGMENT_CROSSING = 500;
const SCORE_OVERCROWDED_SIDE_PER_EXCESS = 100;
const SCORE_LENGTH_FACTOR = 0.1;
const SCORE_SIDE_PREFERENCE_FACTOR = 5;
const SOFT_MAX_PER_SIDE = 6;
const IMPROVEMENT_ITERATIONS = 3;

function rectRight(r: Rect): number {
  return r.x + r.width;
}

function rectBottom(r: Rect): number {
  return r.y + r.height;
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return !(
    rectRight(a) <= b.x ||
    a.x >= rectRight(b) ||
    rectBottom(a) <= b.y ||
    a.y >= rectBottom(b)
  );
}

function rectFromAnatomy(b: AnatomyBounds | AnatomyRect): Rect {
  return { x: b.x, y: b.y, width: b.width, height: b.height };
}

// ─────────────────────────────────────────────────────────────────────────
// Per-item target helpers
// ─────────────────────────────────────────────────────────────────────────

function getTargetBoundsInCanvas(item: AnatomyItem, artwork: Rect): Rect {
  return {
    x: artwork.x + item.bounds.x,
    y: artwork.y + item.bounds.y,
    width: item.bounds.width,
    height: item.bounds.height,
  };
}

function getTargetCenter(item: AnatomyItem, artwork: Rect): Point {
  return {
    x: artwork.x + item.bounds.centerX,
    y: artwork.y + item.bounds.centerY,
  };
}

/**
 * Sides sorted by distance from target center to artwork edge.
 * Closest edge comes first.
 */
export function getPreferredPointerSides(params: {
  targetBounds: Rect;
  artworkBounds: Rect;
}): AnatomyPointerSide[] {
  const cx = params.targetBounds.x + params.targetBounds.width / 2;
  const cy = params.targetBounds.y + params.targetBounds.height / 2;
  const a = params.artworkBounds;
  const distances: Record<AnatomyPointerSide, number> = {
    left: cx - a.x,
    right: rectRight(a) - cx,
    top: cy - a.y,
    bottom: rectBottom(a) - cy,
  };
  return SIDES.slice().sort((x, y) => distances[x] - distances[y]);
}

// ─────────────────────────────────────────────────────────────────────────
// Marker anchor helpers
// ─────────────────────────────────────────────────────────────────────────

function getInitialMarkerCenter(
  side: AnatomyPointerSide,
  targetCenter: Point,
  artwork: Rect,
  markerSize: number,
  markerOffset: number
): Point {
  const half = markerSize / 2;
  switch (side) {
    case 'left':
      return { x: artwork.x - markerOffset - half, y: targetCenter.y };
    case 'right':
      return { x: rectRight(artwork) + markerOffset + half, y: targetCenter.y };
    case 'top':
      return { x: targetCenter.x, y: artwork.y - markerOffset - half };
    case 'bottom':
      return { x: targetCenter.x, y: rectBottom(artwork) + markerOffset + half };
  }
}

function getMarkerBounds(center: Point, markerSize: number): Rect {
  return {
    x: center.x - markerSize / 2,
    y: center.y - markerSize / 2,
    width: markerSize,
    height: markerSize,
  };
}

function getMarkerEdgePoint(
  side: AnatomyPointerSide,
  markerCenter: Point,
  markerSize: number
): Point {
  const half = markerSize / 2;
  switch (side) {
    case 'left':
      return { x: markerCenter.x + half, y: markerCenter.y };
    case 'right':
      return { x: markerCenter.x - half, y: markerCenter.y };
    case 'top':
      return { x: markerCenter.x, y: markerCenter.y + half };
    case 'bottom':
      return { x: markerCenter.x, y: markerCenter.y - half };
  }
}

function getTargetEdgePoint(side: AnatomyPointerSide, target: Rect): Point {
  switch (side) {
    case 'left':
      return { x: target.x, y: target.y + target.height / 2 };
    case 'right':
      return { x: rectRight(target), y: target.y + target.height / 2 };
    case 'top':
      return { x: target.x + target.width / 2, y: target.y };
    case 'bottom':
      return { x: target.x + target.width / 2, y: rectBottom(target) };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// L-shaped connector route
// ─────────────────────────────────────────────────────────────────────────

/**
 * Builds an L-shaped (max one bend) connector route from a marker to a target.
 * For left/right sides the first segment is horizontal; for top/bottom it is
 * vertical. If the marker is already aligned with the target on the main axis,
 * a single straight segment is emitted instead.
 *
 * All segments are 1px-thick rect descriptors (rendered as RectangleNodes by
 * `createAnatomyConnectorFrame`).
 */
export function buildLShapedConnectorRoute(params: {
  side: AnatomyPointerSide;
  markerCenter: Point;
  markerSize: number;
  targetBounds: Rect;
}): { segments: AnatomyConnectorSegment[]; targetPoint: Point } {
  const { side, markerCenter, markerSize, targetBounds } = params;
  const markerEdge = getMarkerEdgePoint(side, markerCenter, markerSize);
  const targetPoint = getTargetEdgePoint(side, targetBounds);
  const segments: AnatomyConnectorSegment[] = [];

  const pushH = (xFrom: number, xTo: number, y: number): void => {
    const len = Math.abs(xTo - xFrom);
    if (len < 0.5) return;
    segments.push({
      orientation: 'horizontal',
      x: Math.round(Math.min(xFrom, xTo)),
      y: Math.round(y - 0.5),
      length: Math.max(1, Math.round(len)),
      nameSuffix: 'horizontal',
    });
  };

  const pushV = (yFrom: number, yTo: number, x: number): void => {
    const len = Math.abs(yTo - yFrom);
    if (len < 0.5) return;
    segments.push({
      orientation: 'vertical',
      x: Math.round(x - 0.5),
      y: Math.round(Math.min(yFrom, yTo)),
      length: Math.max(1, Math.round(len)),
      nameSuffix: 'vertical',
    });
  };

  if (side === 'left' || side === 'right') {
    const sameAxis = Math.abs(markerEdge.y - targetPoint.y) < 0.5;
    if (sameAxis) {
      pushH(markerEdge.x, targetPoint.x, markerEdge.y);
    } else {
      // L: horizontal from marker → elbow at target.x, then vertical to target edge.
      const elbowX = targetPoint.x;
      pushH(markerEdge.x, elbowX, markerEdge.y);
      pushV(markerEdge.y, targetPoint.y, elbowX);
    }
  } else {
    const sameAxis = Math.abs(markerEdge.x - targetPoint.x) < 0.5;
    if (sameAxis) {
      pushV(markerEdge.y, targetPoint.y, markerEdge.x);
    } else {
      const elbowY = targetPoint.y;
      pushV(markerEdge.y, elbowY, markerEdge.x);
      pushH(markerEdge.x, targetPoint.x, elbowY);
    }
  }

  return { segments, targetPoint };
}

// ─────────────────────────────────────────────────────────────────────────
// Marker distribution per side
// ─────────────────────────────────────────────────────────────────────────

type Working = {
  item: AnatomyItem;
  side: AnatomyPointerSide;
  preferredSides: AnatomyPointerSide[];
  preferenceRank: number;
  targetCenter: Point;
  targetBounds: Rect;
  markerCenter: Point;
  markerBounds: Rect;
  targetPoint: Point;
  segments: AnatomyConnectorSegment[];
};

function distributeMarkersOnSide(
  placements: Working[],
  side: AnatomyPointerSide,
  minDistance: number,
  range: { min: number; max: number }
): void {
  if (placements.length <= 1) return;
  const isVertical = side === 'left' || side === 'right';

  placements.sort((a, b) =>
    isVertical ? a.markerCenter.y - b.markerCenter.y : a.markerCenter.x - b.markerCenter.x
  );

  // Forward pass: push later markers down/right if too close to the previous one.
  for (let i = 1; i < placements.length; i += 1) {
    const prev = placements[i - 1];
    const curr = placements[i];
    if (isVertical) {
      const minY = prev.markerCenter.y + minDistance;
      if (curr.markerCenter.y < minY) curr.markerCenter.y = minY;
    } else {
      const minX = prev.markerCenter.x + minDistance;
      if (curr.markerCenter.x < minX) curr.markerCenter.x = minX;
    }
  }

  // If the last marker overshoots, shift the whole stack back.
  const last = placements[placements.length - 1];
  const lastV = isVertical ? last.markerCenter.y : last.markerCenter.x;
  if (lastV > range.max) {
    const shift = lastV - range.max;
    for (const p of placements) {
      if (isVertical) p.markerCenter.y -= shift;
      else p.markerCenter.x -= shift;
    }
  }

  // Backward pass: push earlier markers up/left if too close to the next one.
  for (let i = placements.length - 2; i >= 0; i -= 1) {
    const curr = placements[i];
    const next = placements[i + 1];
    if (isVertical) {
      const maxY = next.markerCenter.y - minDistance;
      if (curr.markerCenter.y > maxY) curr.markerCenter.y = maxY;
    } else {
      const maxX = next.markerCenter.x - minDistance;
      if (curr.markerCenter.x > maxX) curr.markerCenter.x = maxX;
    }
  }

  // If the first marker undershoots, shift the whole stack forward.
  const first = placements[0];
  const firstV = isVertical ? first.markerCenter.y : first.markerCenter.x;
  if (firstV < range.min) {
    const shift = range.min - firstV;
    for (const p of placements) {
      if (isVertical) p.markerCenter.y += shift;
      else p.markerCenter.x += shift;
    }
  }

  // Final clamp.
  for (const p of placements) {
    if (isVertical) {
      p.markerCenter.y = Math.max(range.min, Math.min(range.max, p.markerCenter.y));
    } else {
      p.markerCenter.x = Math.max(range.min, Math.min(range.max, p.markerCenter.x));
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Segment intersection / collision detection
// ─────────────────────────────────────────────────────────────────────────

/**
 * True when a horizontal and a vertical segment cross strictly inside both.
 * Same-orientation segments are not flagged here (handled by overlap penalty).
 */
export function doSegmentsIntersect(
  a: AnatomyConnectorSegment,
  b: AnatomyConnectorSegment
): boolean {
  if (a.orientation === b.orientation) return false;
  if (a.orientation === 'diagonal' || b.orientation === 'diagonal') return false;

  const hor = a.orientation === 'horizontal' ? a : b;
  const ver = a.orientation === 'horizontal' ? b : a;

  const horY = hor.y + 0.5;
  const horX1 = hor.x;
  const horX2 = hor.x + hor.length;
  const verX = ver.x + 0.5;
  const verY1 = ver.y;
  const verY2 = ver.y + ver.length;

  return verX > horX1 && verX < horX2 && horY > verY1 && horY < verY2;
}

export function segmentIntersectsRect(
  seg: AnatomyConnectorSegment,
  rect: Rect,
  margin = 0
): boolean {
  if (seg.orientation === 'diagonal') return false;
  const segRect: Rect =
    seg.orientation === 'horizontal'
      ? { x: seg.x, y: seg.y, width: seg.length, height: 1 }
      : { x: seg.x, y: seg.y, width: 1, height: seg.length };
  const expanded: Rect = {
    x: rect.x - margin,
    y: rect.y - margin,
    width: rect.width + 2 * margin,
    height: rect.height + 2 * margin,
  };
  return rectsOverlap(segRect, expanded);
}

// ─────────────────────────────────────────────────────────────────────────
// Layout helpers
// ─────────────────────────────────────────────────────────────────────────

function rebuildPlacement(p: Working, markerSize: number): void {
  p.markerBounds = getMarkerBounds(p.markerCenter, markerSize);
  const { segments, targetPoint } = buildLShapedConnectorRoute({
    side: p.side,
    markerCenter: p.markerCenter,
    markerSize,
    targetBounds: p.targetBounds,
  });
  p.segments = segments;
  p.targetPoint = targetPoint;
}

function applyDistribution(
  placements: Working[],
  canvas: Rect,
  markerSize: number,
  minMarkerGap: number
): void {
  const minDistance = markerSize + minMarkerGap;
  const halfMarker = markerSize / 2;

  for (const side of SIDES) {
    const subset = placements.filter((p) => p.side === side);
    if (subset.length === 0) continue;

    const isVertical = side === 'left' || side === 'right';
    const range = isVertical
      ? {
          min: canvas.y + halfMarker,
          max: rectBottom(canvas) - halfMarker,
        }
      : {
          min: canvas.x + halfMarker,
          max: rectRight(canvas) - halfMarker,
        };

    distributeMarkersOnSide(subset, side, minDistance, range);
  }

  for (const p of placements) {
    rebuildPlacement(p, markerSize);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Scoring
// ─────────────────────────────────────────────────────────────────────────

function connectorLength(p: Working): number {
  let len = 0;
  for (const s of p.segments) len += s.length;
  return len;
}

function scoreLayout(placements: Working[], canvas: Rect): number {
  let score = 0;

  // Per-placement penalties.
  for (const p of placements) {
    score += connectorLength(p) * SCORE_LENGTH_FACTOR;
    score += p.preferenceRank * SCORE_SIDE_PREFERENCE_FACTOR;

    if (
      p.markerBounds.x < canvas.x ||
      p.markerBounds.y < canvas.y ||
      rectRight(p.markerBounds) > rectRight(canvas) ||
      rectBottom(p.markerBounds) > rectBottom(canvas)
    ) {
      score += SCORE_OUT_OF_BOUNDS;
    }
  }

  // Pairwise penalties.
  for (let i = 0; i < placements.length; i += 1) {
    for (let j = i + 1; j < placements.length; j += 1) {
      const a = placements[i];
      const b = placements[j];

      if (rectsOverlap(a.markerBounds, b.markerBounds)) {
        score += SCORE_MARKER_COLLISION;
      }

      for (const sa of a.segments) {
        for (const sb of b.segments) {
          if (doSegmentsIntersect(sa, sb)) score += SCORE_SEGMENT_CROSSING;
        }
        if (segmentIntersectsRect(sa, b.markerBounds, 2)) {
          score += SCORE_SEGMENT_THROUGH_MARKER;
        }
      }
      for (const sb of b.segments) {
        if (segmentIntersectsRect(sb, a.markerBounds, 2)) {
          score += SCORE_SEGMENT_THROUGH_MARKER;
        }
      }
    }
  }

  // Per-side overcrowding penalty.
  const sideCounts = new Map<AnatomyPointerSide, number>();
  for (const p of placements) sideCounts.set(p.side, (sideCounts.get(p.side) ?? 0) + 1);
  for (const count of sideCounts.values()) {
    if (count > SOFT_MAX_PER_SIDE) {
      score += (count - SOFT_MAX_PER_SIDE) * SCORE_OVERCROWDED_SIDE_PER_EXCESS;
    }
  }

  return score;
}

/**
 * Per-item local score, used to identify the worst offending placements
 * during iterative improvement.
 */
function scoreItemLocally(placements: Working[], idx: number): number {
  const p = placements[idx];
  let score = connectorLength(p) * 0.5 + p.preferenceRank * 2;

  for (let j = 0; j < placements.length; j += 1) {
    if (j === idx) continue;
    const other = placements[j];

    if (rectsOverlap(p.markerBounds, other.markerBounds)) score += 1000;

    for (const sa of p.segments) {
      for (const sb of other.segments) {
        if (doSegmentsIntersect(sa, sb)) score += 200;
      }
      if (segmentIntersectsRect(sa, other.markerBounds, 2)) score += 300;
    }
    for (const sb of other.segments) {
      if (segmentIntersectsRect(sb, p.markerBounds, 2)) score += 300;
    }
  }

  return score;
}

// ─────────────────────────────────────────────────────────────────────────
// Snapshot helpers (used to revert candidate side swaps)
// ─────────────────────────────────────────────────────────────────────────

type Snapshot = {
  sides: AnatomyPointerSide[];
  ranks: number[];
  centers: Point[];
};

function takeSnapshot(placements: Working[]): Snapshot {
  return {
    sides: placements.map((p) => p.side),
    ranks: placements.map((p) => p.preferenceRank),
    centers: placements.map((p) => ({ x: p.markerCenter.x, y: p.markerCenter.y })),
  };
}

function restoreSnapshot(placements: Working[], snap: Snapshot, markerSize: number): void {
  for (let i = 0; i < placements.length; i += 1) {
    placements[i].side = snap.sides[i];
    placements[i].preferenceRank = snap.ranks[i];
    placements[i].markerCenter = { x: snap.centers[i].x, y: snap.centers[i].y };
    rebuildPlacement(placements[i], markerSize);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────

export type LShapedLayoutParams = {
  items: AnatomyItem[];
  /** Artwork (root clone) bounds in canvas coordinates. */
  artworkBounds: AnatomyRect;
  /** Outer preview canvas in the same coordinate space. */
  canvasBounds: AnatomyRect;
  markerSize: number;
  markerOffset: number;
  /** Minimum free pixel gap between two adjacent marker bounding boxes. */
  minMarkerGap?: number;
};

/**
 * Distribute markers across all four sides and route L-shaped 1px connectors
 * from marker to target. Output preserves marker/list mapping (no reorder).
 */
export function layoutLShapedAnatomyPointers(
  params: LShapedLayoutParams
): AnatomyPointerPlacement[] {
  const {
    items,
    artworkBounds,
    canvasBounds,
    markerSize,
    markerOffset,
    minMarkerGap = 8,
  } = params;

  if (items.length === 0) return [];

  const artwork = rectFromAnatomy(artworkBounds);
  const canvas = rectFromAnatomy(canvasBounds);

  // 1. Seed placements on each item's most preferred side.
  const placements: Working[] = items.map((item) => {
    const targetBounds = getTargetBoundsInCanvas(item, artwork);
    const targetCenter = getTargetCenter(item, artwork);
    const preferred = getPreferredPointerSides({
      targetBounds,
      artworkBounds: artwork,
    });
    const side = preferred[0];
    const markerCenter = getInitialMarkerCenter(
      side,
      targetCenter,
      artwork,
      markerSize,
      markerOffset
    );
    const markerBounds = getMarkerBounds(markerCenter, markerSize);
    const { segments, targetPoint } = buildLShapedConnectorRoute({
      side,
      markerCenter,
      markerSize,
      targetBounds,
    });
    return {
      item,
      side,
      preferredSides: preferred,
      preferenceRank: 0,
      targetCenter,
      targetBounds,
      markerCenter,
      markerBounds,
      targetPoint,
      segments,
    };
  });

  // 2. Apply distribution to seeded layout and capture as the initial best.
  applyDistribution(placements, canvas, markerSize, minMarkerGap);
  let bestScore = scoreLayout(placements, canvas);
  let bestSnap = takeSnapshot(placements);

  // 3. Iterative improvement: reassign worst-scoring items to alternative sides.
  for (let iter = 0; iter < IMPROVEMENT_ITERATIONS; iter += 1) {
    const itemScores = placements
      .map((_, idx) => ({ idx, score: scoreItemLocally(placements, idx) }))
      .sort((a, b) => b.score - a.score);

    const worstCount = Math.max(1, Math.ceil(placements.length / 3));
    let improved = false;

    for (let k = 0; k < worstCount && k < itemScores.length; k += 1) {
      const target = itemScores[k];
      const p = placements[target.idx];

      let chosenSide = p.side;
      let chosenRank = p.preferenceRank;
      let chosenScore = bestScore;

      for (let altRank = 0; altRank < p.preferredSides.length; altRank += 1) {
        const altSide = p.preferredSides[altRank];
        if (altSide === p.side) continue;

        const beforeSnap = takeSnapshot(placements);

        p.side = altSide;
        p.preferenceRank = altRank;
        p.markerCenter = getInitialMarkerCenter(
          altSide,
          p.targetCenter,
          artwork,
          markerSize,
          markerOffset
        );
        rebuildPlacement(p, markerSize);
        applyDistribution(placements, canvas, markerSize, minMarkerGap);

        const candidateScore = scoreLayout(placements, canvas);
        if (candidateScore < chosenScore) {
          chosenScore = candidateScore;
          chosenSide = altSide;
          chosenRank = altRank;
        }

        restoreSnapshot(placements, beforeSnap, markerSize);
      }

      if (chosenSide !== p.side) {
        p.side = chosenSide;
        p.preferenceRank = chosenRank;
        p.markerCenter = getInitialMarkerCenter(
          chosenSide,
          p.targetCenter,
          artwork,
          markerSize,
          markerOffset
        );
        rebuildPlacement(p, markerSize);
        applyDistribution(placements, canvas, markerSize, minMarkerGap);
        bestScore = scoreLayout(placements, canvas);
        bestSnap = takeSnapshot(placements);
        improved = true;
      }
    }

    if (!improved) break;
  }

  // 4. Restore the best layout we've seen.
  restoreSnapshot(placements, bestSnap, markerSize);
  applyDistribution(placements, canvas, markerSize, minMarkerGap);

  // 5. Convert working placements to the legacy AnatomyPointerPlacement type
  //    (no marker/list reordering — input item order is preserved).
  return placements.map((p): AnatomyPointerPlacement => {
    const itemBoundsCanvas: AnatomyBounds = {
      x: p.targetBounds.x,
      y: p.targetBounds.y,
      width: p.targetBounds.width,
      height: p.targetBounds.height,
      centerX: p.targetBounds.x + p.targetBounds.width / 2,
      centerY: p.targetBounds.y + p.targetBounds.height / 2,
    };
    return {
      item: p.item,
      side: p.side,
      targetX: p.targetPoint.x,
      targetY: p.targetPoint.y,
      markerX: Math.round(p.markerBounds.x),
      markerY: Math.round(p.markerBounds.y),
      markerSize,
      itemBounds: itemBoundsCanvas,
      segments: p.segments,
    };
  });
}
