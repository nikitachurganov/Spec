/// <reference types="@figma/plugin-typings" />
import { createPluginFrame, createPluginRectangle, createPluginVector } from '../figma/pluginSceneNodes';

import type {
  AnatomyBounds,
  AnatomyConnectorSegment,
  AnatomyItem,
  AnatomyPointerPlacement,
  AnatomyPointerSide,
  AnatomyRect,
} from './anatomyTypes';
import {
  anatomyItemsToLayoutItems,
  computeAnatomyLayout,
  renderAnatomyPointerPlacements,
} from './anatomyLayoutEngine';
import type { AnatomyPointerLayoutResult } from './anatomyPointerLayout';
import {
  ANATOMY_COLORS,
  ANATOMY_LAYOUT,
  ANATOMY_POINTER_LABEL_GAP,
  ANATOMY_POINTER_RIGHT_OFFSET,
} from './anatomyStyles';
import { layoutLShapedAnatomyPointers } from './anatomyLShapedLayout';

export function isVerticalPointerSide(side: AnatomyPointerSide): boolean {
  return side === 'top' || side === 'bottom';
}

export function isHorizontalPointerSide(side: AnatomyPointerSide): boolean {
  return side === 'left' || side === 'right';
}

export function getPointerAlignmentLines(
  componentBounds: AnatomyRect,
  markerSize: number,
  markerOffset: number
): { topY: number; bottomY: number; leftX: number; rightX: number } {
  return {
    topY: componentBounds.y - markerOffset - markerSize,
    bottomY: componentBounds.y + componentBounds.height + markerOffset,
    leftX: componentBounds.x - markerOffset - markerSize,
    rightX: componentBounds.x + componentBounds.width + markerOffset,
  };
}

export function createConnectorSegment(params: {
  name: string;
  orientation: 'horizontal' | 'vertical';
  length: number;
  color: RGB;
}): RectangleNode {
  return createAnatomyConnector(params);
}

export function createAnatomyConnector(params: {
  name: string;
  orientation: 'horizontal' | 'vertical';
  length: number;
  color: RGB;
}): RectangleNode {
  const connector = createPluginRectangle();
  connector.name = params.name;
  const safeLength = Math.max(1, Math.round(params.length));

  if (params.orientation === 'vertical') {
    connector.resize(1, safeLength);
  } else {
    connector.resize(safeLength, 1);
  }

  connector.fills = [{ type: 'SOLID', color: params.color }];
  connector.strokes = [];
  connector.cornerRadius = 0;
  connector.opacity = 1;
  connector.visible = true;
  return connector;
}

function createDiagonalConnector(name: string, color: RGB, from: { x: number; y: number }, to: { x: number; y: number }): VectorNode {
  const vector = createPluginVector();
  vector.name = name;
  vector.vectorPaths = [
    {
      windingRule: 'NONZERO',
      data: `M ${from.x} ${from.y} L ${to.x} ${to.y}`,
    },
  ];
  vector.strokes = [{ type: 'SOLID', color }];
  vector.strokeWeight = 1;
  vector.strokeCap = 'ROUND';
  vector.fills = [];
  return vector;
}

function buildRightSideConnectorSegmentsFromLayout(
  layout: AnatomyPointerLayoutResult
): AnatomyConnectorSegment[] {
  const { startPoint, bendPoint, endPoint } = layout;
  const segments: AnatomyConnectorSegment[] = [];

  if (!bendPoint) {
    if (Math.abs(startPoint.y - endPoint.y) < 1) {
      segments.push({
        orientation: 'horizontal',
        x: Math.min(startPoint.x, endPoint.x),
        y: startPoint.y - 0.5,
        length: Math.max(1, Math.abs(endPoint.x - startPoint.x)),
        nameSuffix: 'horizontal',
      });
    } else {
      segments.push({
        orientation: 'vertical',
        x: startPoint.x - 0.5,
        y: Math.min(startPoint.y, endPoint.y),
        length: Math.max(1, Math.abs(endPoint.y - startPoint.y)),
        nameSuffix: 'vertical',
      });
    }
    return segments;
  }

  const firstIsVertical = Math.abs(startPoint.x - bendPoint.x) < 1;
  const secondIsHorizontal = Math.abs(bendPoint.y - endPoint.y) < 1;

  if (firstIsVertical) {
    segments.push({
      orientation: 'vertical',
      x: startPoint.x - 0.5,
      y: Math.min(startPoint.y, bendPoint.y),
      length: Math.max(1, Math.abs(bendPoint.y - startPoint.y)),
      nameSuffix: 'vertical',
    });
  } else {
    segments.push({
      orientation: 'horizontal',
      x: Math.min(startPoint.x, bendPoint.x),
      y: startPoint.y - 0.5,
      length: Math.max(1, Math.abs(bendPoint.x - startPoint.x)),
      nameSuffix: 'horizontal',
    });
  }

  if (secondIsHorizontal) {
    segments.push({
      orientation: 'horizontal',
      x: Math.min(bendPoint.x, endPoint.x),
      y: bendPoint.y - 0.5,
      length: Math.max(1, Math.abs(endPoint.x - bendPoint.x)),
      nameSuffix: 'horizontal',
    });
  } else {
    segments.push({
      orientation: 'vertical',
      x: bendPoint.x - 0.5,
      y: Math.min(bendPoint.y, endPoint.y),
      length: Math.max(1, Math.abs(endPoint.y - bendPoint.y)),
      nameSuffix: 'vertical',
    });
  }

  return segments.filter((segment) => segment.length > 0);
}

/** @deprecated Legacy multi-side connector builder; right-side layout uses {@link buildRightSideConnectorSegmentsFromLayout}. */
function buildConnectorSegments(
  side: AnatomyPointerSide,
  markerCenterX: number,
  markerCenterY: number,
  markerSize: number,
  itemBounds: AnatomyBounds
): AnatomyConnectorSegment[] {
  const targetCenterX = itemBounds.centerX;
  const targetCenterY = itemBounds.centerY;
  const half = markerSize / 2;
  const segments: AnatomyConnectorSegment[] = [];

  if (side === 'top') {
    const markerBottom = markerCenterY + half;
    const targetY = itemBounds.y;
    if (Math.abs(markerCenterX - targetCenterX) < 1) {
      const length = Math.max(1, targetY - markerBottom);
      if (length > 0) {
        segments.push({
          orientation: 'vertical',
          x: markerCenterX - 0.5,
          y: markerBottom,
          length,
          nameSuffix: 'vertical',
        });
      }
    } else {
      const elbowY = targetY;
      segments.push({
        orientation: 'vertical',
        x: markerCenterX - 0.5,
        y: markerBottom,
        length: Math.max(1, elbowY - markerBottom),
        nameSuffix: 'vertical',
      });
      segments.push({
        orientation: 'horizontal',
        x: Math.min(markerCenterX, targetCenterX),
        y: elbowY - 0.5,
        length: Math.max(1, Math.abs(targetCenterX - markerCenterX)),
        nameSuffix: 'horizontal',
      });
    }
  } else if (side === 'bottom') {
    const markerTop = markerCenterY - half;
    const targetY = itemBounds.y + itemBounds.height;
    if (Math.abs(markerCenterX - targetCenterX) < 1) {
      const length = Math.max(1, markerTop - targetY);
      if (length > 0) {
        segments.push({
          orientation: 'vertical',
          x: markerCenterX - 0.5,
          y: targetY,
          length,
          nameSuffix: 'vertical',
        });
      }
    } else {
      const elbowY = targetY;
      segments.push({
        orientation: 'vertical',
        x: markerCenterX - 0.5,
        y: targetY,
        length: Math.max(1, markerTop - elbowY),
        nameSuffix: 'vertical',
      });
      segments.push({
        orientation: 'horizontal',
        x: Math.min(markerCenterX, targetCenterX),
        y: elbowY - 0.5,
        length: Math.max(1, Math.abs(targetCenterX - markerCenterX)),
        nameSuffix: 'horizontal',
      });
    }
  } else if (side === 'left') {
    const markerRight = markerCenterX + half;
    const targetX = itemBounds.x;
    if (Math.abs(markerCenterY - targetCenterY) < 1) {
      const length = Math.max(1, targetX - markerRight);
      if (length > 0) {
        segments.push({
          orientation: 'horizontal',
          x: markerRight,
          y: markerCenterY - 0.5,
          length,
          nameSuffix: 'horizontal',
        });
      }
    } else {
      const elbowX = targetX;
      segments.push({
        orientation: 'horizontal',
        x: markerRight,
        y: markerCenterY - 0.5,
        length: Math.max(1, elbowX - markerRight),
        nameSuffix: 'horizontal',
      });
      segments.push({
        orientation: 'vertical',
        x: elbowX - 0.5,
        y: Math.min(markerCenterY, targetCenterY),
        length: Math.max(1, Math.abs(targetCenterY - markerCenterY)),
        nameSuffix: 'vertical',
      });
    }
  } else if (side === 'right') {
    const markerLeft = markerCenterX - half;
    const targetX = itemBounds.x + itemBounds.width;
    if (Math.abs(markerCenterY - targetCenterY) < 1) {
      const length = Math.max(1, markerLeft - targetX);
      if (length > 0) {
        segments.push({
          orientation: 'horizontal',
          x: targetX,
          y: markerCenterY - 0.5,
          length,
          nameSuffix: 'horizontal',
        });
      }
    } else {
      const elbowX = targetX;
      segments.push({
        orientation: 'horizontal',
        x: targetX,
        y: markerCenterY - 0.5,
        length: Math.max(1, markerLeft - elbowX),
        nameSuffix: 'horizontal',
      });
      segments.push({
        orientation: 'vertical',
        x: elbowX - 0.5,
        y: Math.min(markerCenterY, targetCenterY),
        length: Math.max(1, Math.abs(targetCenterY - markerCenterY)),
        nameSuffix: 'vertical',
      });
    }
  }

  return segments.filter((segment) => segment.length > 0);
}

function refreshPlacementSegments(placement: AnatomyPointerPlacement): void {
  const markerCenterX = placement.markerX + placement.markerSize / 2;
  const markerCenterY = placement.markerY + placement.markerSize / 2;
  placement.segments = buildConnectorSegments(
    placement.side,
    markerCenterX,
    markerCenterY,
    placement.markerSize,
    placement.itemBounds
  );
}

export function createInitialPlacement(
  item: AnatomyItem,
  side: AnatomyPointerSide,
  itemBoundsInPreview: AnatomyBounds,
  alignmentLines: ReturnType<typeof getPointerAlignmentLines>,
  markerSize: number
): AnatomyPointerPlacement {
  const targetX = itemBoundsInPreview.centerX;
  const targetY = itemBoundsInPreview.centerY;

  let markerX = targetX - markerSize / 2;
  let markerY = alignmentLines.topY;

  if (side === 'bottom') {
    markerY = alignmentLines.bottomY;
  } else if (side === 'left') {
    markerX = alignmentLines.leftX;
    markerY = targetY - markerSize / 2;
  } else if (side === 'right') {
    markerX = alignmentLines.rightX;
    markerY = targetY - markerSize / 2;
  }

  const markerCenterX = markerX + markerSize / 2;
  const markerCenterY = markerY + markerSize / 2;

  const placement: AnatomyPointerPlacement = {
    item,
    side,
    targetX,
    targetY,
    markerX,
    markerY,
    markerSize,
    itemBounds: itemBoundsInPreview,
    segments: buildConnectorSegments(
      side,
      markerCenterX,
      markerCenterY,
      markerSize,
      itemBoundsInPreview
    ),
  };

  return placement;
}

export function distributeMarkersOnAxis(params: {
  placements: AnatomyPointerPlacement[];
  axis: 'x' | 'y';
  minDistance: number;
  minValue: number;
  maxValue: number;
}): AnatomyPointerPlacement[] {
  const { placements, axis, minDistance, minValue, maxValue } = params;
  if (placements.length <= 1) return placements;

  const minStep = placements[0].markerSize + minDistance;
  const sorted = placements.slice().sort((a, b) => {
    if (axis === 'x') {
      const tx = a.targetX - b.targetX;
      if (Math.abs(tx) > 1) return tx;
      return a.markerX - b.markerX;
    }
    const ty = a.targetY - b.targetY;
    if (Math.abs(ty) > 1) return ty;
    return a.markerY - b.markerY;
  });

  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const current = sorted[i];
    if (axis === 'x') {
      const minX = prev.markerX + minStep;
      if (current.markerX < minX) current.markerX = minX;
    } else {
      const minY = prev.markerY + minStep;
      if (current.markerY < minY) current.markerY = minY;
    }
    refreshPlacementSegments(current);
  }

  const last = sorted[sorted.length - 1];
  const lastEnd = axis === 'x' ? last.markerX + last.markerSize : last.markerY + last.markerSize;
  if (lastEnd > maxValue) {
    const overflow = lastEnd - maxValue;
    for (const p of sorted) {
      if (axis === 'x') p.markerX -= overflow;
      else p.markerY -= overflow;
      refreshPlacementSegments(p);
    }
  }

  for (let i = sorted.length - 2; i >= 0; i -= 1) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (axis === 'x') {
      const maxX = next.markerX - minStep;
      if (current.markerX > maxX) {
        current.markerX = maxX;
        refreshPlacementSegments(current);
      }
    } else {
      const maxY = next.markerY - minStep;
      if (current.markerY > maxY) {
        current.markerY = maxY;
        refreshPlacementSegments(current);
      }
    }
  }

  const first = sorted[0];
  const firstStart = axis === 'x' ? first.markerX : first.markerY;
  if (firstStart < minValue) {
    const underflow = minValue - firstStart;
    for (const p of sorted) {
      if (axis === 'x') p.markerX += underflow;
      else p.markerY += underflow;
      refreshPlacementSegments(p);
    }
  }

  for (const p of sorted) {
    if (axis === 'x') {
      p.markerX = Math.max(minValue, Math.min(maxValue - p.markerSize, p.markerX));
    } else {
      p.markerY = Math.max(minValue, Math.min(maxValue - p.markerSize, p.markerY));
    }
    refreshPlacementSegments(p);
  }

  return sorted;
}

function sideDistanceToTarget(
  side: AnatomyPointerSide,
  targetX: number,
  targetY: number,
  bounds: AnatomyRect
): number {
  if (side === 'left') return targetX - bounds.x;
  if (side === 'right') return bounds.x + bounds.width - targetX;
  if (side === 'top') return targetY - bounds.y;
  return bounds.y + bounds.height - targetY;
}

function choosePointerSide(
  item: AnatomyItem,
  componentBounds: AnatomyRect,
  sideCounts: Map<AnatomyPointerSide, number>,
  maxPerSide: number
): AnatomyPointerSide {
  const leftCount = sideCounts.get('left') || 0;
  if (leftCount < maxPerSide) {
    return 'left';
  }

  const candidates: AnatomyPointerSide[] = ['top', 'right', 'bottom'];
  const available = candidates.filter((s) => (sideCounts.get(s) || 0) < maxPerSide);
  const pool = available.length > 0 ? available : candidates;

  const targetX = componentBounds.x + item.bounds.centerX;
  const targetY = componentBounds.y + item.bounds.centerY;

  pool.sort((a, b) => {
    const countA = sideCounts.get(a) || 0;
    const countB = sideCounts.get(b) || 0;
    if (countA !== countB) return countA - countB;
    return (
      sideDistanceToTarget(a, targetX, targetY, componentBounds) -
      sideDistanceToTarget(b, targetX, targetY, componentBounds)
    );
  });

  return pool[0];
}

/**
 * Top-level entry point used by the anatomy generator.
 *
 * Uses the multi-side L-shaped layout (see `anatomyLShapedLayout.ts`) which
 * picks the best side per item, distributes markers along each side to avoid
 * overlap, and emits 1px-segment L-shaped connector routes.
 *
 * `rootBoundsRelative` is kept in the signature for backwards compatibility
 * but is not needed by the L-shaped layout — the artwork is identified by
 * `rootBoundsInPreview` in canvas coordinates.
 */
export function calculatePointerPlacements(
  items: AnatomyItem[],
  _rootBoundsRelative: AnatomyRect,
  rootBoundsInPreview: AnatomyRect,
  markerSize: number,
  markerOffset: number,
  _selectedNode?: SceneNode,
  contentBoundsInPreview?: AnatomyRect
): AnatomyPointerPlacement[] {
  if (items.length === 0) return [];

  const markerSafeArea = markerSize + markerOffset + 8;
  const rightColumnExtent = ANATOMY_POINTER_RIGHT_OFFSET + markerSize + 8;
  const contentBounds = contentBoundsInPreview ?? rootBoundsInPreview;

  // Preview group (= "canvas" for pointer geometry) — mirrors the size
  // calculated by anatomyGenerator.createAnatomyFrame().
  const canvasBounds: AnatomyRect = {
    x: 0,
    y: 0,
    width: contentBounds.x + contentBounds.width + rightColumnExtent,
    height: contentBounds.y + contentBounds.height + markerSafeArea,
  };

  return layoutLShapedAnatomyPointers({
    items,
    artworkBounds: rootBoundsInPreview,
    canvasBounds,
    markerSize,
    markerOffset,
  });
}

export function layoutAnatomyPlacements(
  items: AnatomyItem[],
  _rootBoundsRelative: AnatomyRect,
  rootBoundsInPreview: AnatomyRect,
  markerSize: number,
  markerOffset: number,
  selectedNode?: SceneNode
): AnatomyPointerPlacement[] {
  void markerOffset;

  const rootForStructure =
    selectedNode ??
    (items[0]?.node.parent && items[0].node.parent.type !== 'PAGE'
      ? (items[0].node.parent as SceneNode)
      : items[0]?.node);

  if (!rootForStructure || items.length === 0) {
    return [];
  }

  const labelSizes = new Map<string, { width: number; height: number }>();
  for (const item of items) {
    labelSizes.set(item.nodeId, { width: markerSize, height: markerSize });
  }

  const frameBounds = {
    x: rootBoundsInPreview.x,
    y: rootBoundsInPreview.y,
    width: rootBoundsInPreview.width,
    height: rootBoundsInPreview.height,
  };

  const layout = computeAnatomyLayout({
    selectedNode: rootForStructure,
    frameBounds,
    labelSizes,
    layoutItems: anatomyItemsToLayoutItems(items, frameBounds),
    horizontalOffset: ANATOMY_POINTER_RIGHT_OFFSET,
    labelGap: ANATOMY_POINTER_LABEL_GAP,
    markerSize,
  });

  const placements = renderAnatomyPointerPlacements(layout, items, markerSize);

  for (const placement of placements) {
    placement.itemBounds = {
      x: rootBoundsInPreview.x + placement.item.bounds.x,
      y: rootBoundsInPreview.y + placement.item.bounds.y,
      width: placement.item.bounds.width,
      height: placement.item.bounds.height,
      centerX: rootBoundsInPreview.x + placement.item.bounds.centerX,
      centerY: rootBoundsInPreview.y + placement.item.bounds.centerY,
    };
  }

  return placements;
}

export function createAnatomyConnectorFrame(
  index: number,
  segments: AnatomyConnectorSegment[],
  color: RGB
): FrameNode {
  const connectorFrame = createPluginFrame();
  connectorFrame.name = `Anatomy connector / ${index}`;
  connectorFrame.layoutMode = 'NONE';
  connectorFrame.fills = [];
  connectorFrame.strokes = [];
  connectorFrame.clipsContent = false;
  connectorFrame.itemSpacing = 0;
  connectorFrame.paddingTop = 0;
  connectorFrame.paddingRight = 0;
  connectorFrame.paddingBottom = 0;
  connectorFrame.paddingLeft = 0;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const segment of segments) {
    if (segment.orientation === 'diagonal' && segment.toX != null && segment.toY != null) {
      const diagonal = createDiagonalConnector(
        `Anatomy connector segment / ${index} / ${segment.nameSuffix}`,
        color,
        { x: segment.x, y: segment.y },
        { x: segment.toX, y: segment.toY }
      );
      connectorFrame.appendChild(diagonal);
      minX = Math.min(minX, segment.x, segment.toX);
      minY = Math.min(minY, segment.y, segment.toY);
      maxX = Math.max(maxX, segment.x, segment.toX);
      maxY = Math.max(maxY, segment.y, segment.toY);
      continue;
    }

    const rect = createAnatomyConnector({
      name: `Anatomy connector segment / ${index} / ${segment.nameSuffix}`,
      orientation: segment.orientation === 'vertical' ? 'vertical' : 'horizontal',
      length: segment.length,
      color,
    });
    rect.x = segment.x;
    rect.y = segment.y;
    connectorFrame.appendChild(rect);

    minX = Math.min(minX, segment.x);
    minY = Math.min(minY, segment.y);
    maxX = Math.max(maxX, segment.x + rect.width);
    maxY = Math.max(maxY, segment.y + rect.height);
  }

  if (segments.length === 0) {
    connectorFrame.resize(1, 1);
    return connectorFrame;
  }

  for (const child of connectorFrame.children) {
    child.x -= minX;
    child.y -= minY;
  }

  connectorFrame.resize(Math.max(1, maxX - minX), Math.max(1, maxY - minY));
  return connectorFrame;
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
    if (segment.orientation === 'diagonal' && segment.toX != null && segment.toY != null) {
      minX = Math.min(minX, segment.x, segment.toX);
      maxX = Math.max(maxX, segment.x, segment.toX);
      minY = Math.min(minY, segment.y, segment.toY);
      maxY = Math.max(maxY, segment.y, segment.toY);
    } else if (segment.orientation === 'vertical') {
      minX = Math.min(minX, segment.x);
      maxX = Math.max(maxX, segment.x + 1);
      minY = Math.min(minY, segment.y);
      maxY = Math.max(maxY, segment.y + segment.length);
    } else {
      minX = Math.min(minX, segment.x);
      maxX = Math.max(maxX, segment.x + segment.length);
      minY = Math.min(minY, segment.y);
      maxY = Math.max(maxY, segment.y + 1);
    }
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(markerSize, maxX - minX),
    height: Math.max(markerSize, maxY - minY),
  };
}

export function getDefaultConnectorColor(): RGB {
  return ANATOMY_COLORS.accent;
}
