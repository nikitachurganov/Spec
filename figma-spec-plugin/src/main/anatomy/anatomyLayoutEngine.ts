/// <reference types="@figma/plugin-typings" />

/**
 * Modular anatomy layout pipeline:
 * 1. collectAnatomyStructure / buildAnatomySequence
 * 2. prepareAnatomyRoutingOrder
 * 3. placeAnatomyLabels
 * 4. optimizeAnatomyLabelYPositions
 * 5. routeAnatomyConnectors
 * 6. validateAnatomyRoutes
 * 7. renderAnatomyPointers
 */

export {
  collectAnatomyStructure,
  collectAnatomyTargets,
  buildAnatomySequence,
  isMeaningfulAnatomyTarget,
  getNodeBounds,
  getChildrenOrderDirection,
  sortNodesForNumbering,
  getNestedMeaningfulChildren,
} from './anatomyStructure';

export {
  prepareAnatomyRoutingOrder,
  groupItemsIntoVisualRows,
  classifyAnatomyRouteZone,
  assignAnatomyRouteZones,
  assignAnatomySides,
} from './anatomyRoutingOrder';

export {
  placeAnatomyLabels,
  placeAnatomyLabelsByZones,
  placeStraightAnatomyLabels,
  resolveVerticalLabelCollisions,
} from './anatomyLabelPlacement';

export {
  optimizeAnatomyLabelYPositions,
  getLabelYOffsets,
} from './anatomyLabelOptimization';

export {
  routeAnatomyConnectors,
  validateRoute,
  validateAnatomyRoutes,
  scoreRoute,
  pickRouteForItem,
  createTopEntryRoute,
  createStraightRightRoute,
  createBottomEntryRoute,
  createGenericRightRoute,
  createShiftedRouteVariants,
  createStraightAnatomyRoutes,
  getTargetAnchors,
  getLabelLeftCenter,
  getPolylineSegments,
  doesRouteIntersectAnyLabel,
  doesRouteOverlapRoute,
  doesRouteIntersectAnyTargetExceptOwnTarget,
  doSegmentsIntersect,
  doSegmentsOverlap,
  doesSegmentIntersectRect,
  doesRouteIntersectRoute,
} from './anatomyConnectorRouting';

import { routeAnatomyConnectors } from './anatomyConnectorRouting';
import { optimizeAnatomyLabelYPositions } from './anatomyLabelOptimization';
import { placeStraightAnatomyLabels } from './anatomyLabelPlacement';
import { assignAnatomyRouteZones, prepareAnatomyRoutingOrder } from './anatomyRoutingOrder';
import { collectAnatomyTargets } from './anatomyStructure';
import type { AnatomyLayoutResult, AnatomyLayoutItem, Bounds } from './anatomyLayoutTypes';
import type { AnatomyItem, AnatomyPointerPlacement, AnatomyConnectorSegment } from './anatomyTypes';
import {
  ANATOMY_POINTER_LABEL_GAP,
  ANATOMY_POINTER_MAX_FALLBACK_ATTEMPTS,
  ANATOMY_POINTER_MAX_LABEL_Y_OFFSET,
  ANATOMY_POINTER_RIGHT_OFFSET,
} from './anatomyStyles';
import { getDefaultAnatomyLabelBounds } from './anatomyPointerLayout';
import type { AnatomyRect } from './anatomyTypes';

export type ComputeAnatomyLayoutParams = {
  selectedNode: SceneNode;
  frameBounds: Bounds;
  labelSizes: Map<string, { width: number; height: number }>;
  layoutItems?: AnatomyLayoutItem[];
  horizontalOffset?: number;
  labelGap?: number;
  markerSize?: number;
};

/** Converts legacy pipeline items (relative bounds) to layout-engine items (preview space). */
export function anatomyItemsToLayoutItems(
  items: AnatomyItem[],
  rootBoundsInPreview: Bounds
): AnatomyLayoutItem[] {
  return items.map((item, order) => {
    const index = item.anatomyIndex ?? String(item.markerIndex);
    const dotIndex = index.indexOf('.');
    const isNested = dotIndex > 0;
    const parentIndex = isNested ? index.slice(0, dotIndex) : null;

    return {
      id: item.nodeId,
      nodeId: item.nodeId,
      index,
      level: isNested ? 'child' : 'root',
      parentIndex,
      targetBounds: {
        x: rootBoundsInPreview.x + item.bounds.x,
        y: rootBoundsInPreview.y + item.bounds.y,
        width: item.bounds.width,
        height: item.bounds.height,
      },
      targetName: item.displayName || item.finalLabel,
      groupId: parentIndex ? `${parentIndex}-group` : undefined,
      order,
      isNestedItem: isNested,
    };
  });
}

/**
 * Stages 1–6: structure → sequence → labels → Y optimization → routes.
 */
export function computeAnatomyLayout(params: ComputeAnatomyLayoutParams): AnatomyLayoutResult {
  const {
    selectedNode,
    frameBounds,
    labelSizes,
    horizontalOffset = ANATOMY_POINTER_RIGHT_OFFSET,
    labelGap = ANATOMY_POINTER_LABEL_GAP,
    markerSize = 24,
  } = params;

  const sequence = params.layoutItems ?? collectAnatomyTargets(selectedNode);
  const routingOrder = assignAnatomyRouteZones(
    prepareAnatomyRoutingOrder(sequence),
    frameBounds
  );

  const labelBounds = getDefaultAnatomyLabelBounds(
    frameBounds as AnatomyRect,
    markerSize,
    horizontalOffset
  );

  const targetBoundsList = routingOrder.map((item) => ({
    id: item.id,
    bounds: item.targetBounds,
  }));

  const allTargetBounds = new Map<string, Bounds>();
  for (const item of routingOrder) {
    allTargetBounds.set(item.id, item.targetBounds);
  }

  void labelBounds;
  void targetBoundsList;
  void allTargetBounds;
  void optimizeAnatomyLabelYPositions;
  void ANATOMY_POINTER_MAX_FALLBACK_ATTEMPTS;
  void ANATOMY_POINTER_MAX_LABEL_Y_OFFSET;
  const labels = placeStraightAnatomyLabels({
    frameBounds,
    items: routingOrder,
    labelSizes,
    offset: horizontalOffset,
    labelGap,
  });
  const routes = routeAnatomyConnectors({
    frameBounds,
    items: routingOrder,
    labels,
    allTargetBounds: new Map(routingOrder.map((item) => [item.id, item.targetBounds])),
  });

  return {
    items: routingOrder,
    labels,
    routes,
  };
}

function routeToConnectorSegments(
  route: AnatomyLayoutResult['routes'][0]
): AnatomyConnectorSegment[] {
  const { startPoint, bendPoint, endPoint } = route;
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
      if (Math.abs(startPoint.x - endPoint.x) < 1) {
        segments.push({
          orientation: 'vertical',
          x: startPoint.x - 0.5,
          y: Math.min(startPoint.y, endPoint.y),
          length: Math.max(1, Math.abs(endPoint.y - startPoint.y)),
          nameSuffix: 'vertical',
        });
      } else {
        segments.push({
          orientation: 'diagonal',
          x: startPoint.x,
          y: startPoint.y,
          toX: endPoint.x,
          toY: endPoint.y,
          length: Math.max(1, Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y)),
          nameSuffix: 'diagonal',
        });
      }
    }
    return segments;
  }

  const firstIsVertical = Math.abs(startPoint.x - bendPoint.x) < 1;
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

  const secondIsHorizontal = Math.abs(bendPoint.y - endPoint.y) < 1;
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

  return segments.filter((s) => s.length > 0);
}

function getRouteTargetPoint(route: AnatomyLayoutResult['routes'][0]): { x: number; y: number } {
  if (
    route.routeType === 'top-entry' ||
    route.routeType === 'bottom-entry' ||
    route.routeType === 'generic-top' ||
    route.routeType === 'generic-bottom'
  ) {
    return route.endPoint;
  }
  return route.startPoint;
}

/**
 * Stage 5: map layout result to legacy placements for Figma rendering.
 */
export function renderAnatomyPointerPlacements(
  layout: AnatomyLayoutResult,
  legacyItems: AnatomyItem[],
  markerSize: number
): AnatomyPointerPlacement[] {
  const itemByNodeId = new Map(legacyItems.map((item) => [item.nodeId, item]));
  const labelById = new Map(layout.labels.map((l) => [l.itemId, l]));
  const routeById = new Map(layout.routes.map((r) => [r.itemId, r]));

  const placements: AnatomyPointerPlacement[] = [];

  for (const layoutItem of layout.items) {
    const legacy = itemByNodeId.get(layoutItem.nodeId);
    const label = labelById.get(layoutItem.id);
    const route = routeById.get(layoutItem.id);
    if (!legacy || !label || !route) {
      continue;
    }

    const targetPoint = getRouteTargetPoint(route);

    placements.push({
      item: legacy,
      side: 'right',
      targetX: targetPoint.x,
      targetY: targetPoint.y,
      markerX: label.labelBounds.x,
      markerY: label.labelBounds.y,
      markerSize,
      itemBounds: {
        x: layoutItem.targetBounds.x,
        y: layoutItem.targetBounds.y,
        width: layoutItem.targetBounds.width,
        height: layoutItem.targetBounds.height,
        centerX: layoutItem.targetBounds.x + layoutItem.targetBounds.width / 2,
        centerY: layoutItem.targetBounds.y + layoutItem.targetBounds.height / 2,
      },
      segments: routeToConnectorSegments(route),
    });
  }

  placements.sort((a, b) => {
    const dy = a.targetY - b.targetY;
    if (Math.abs(dy) > 0.01) return dy;
    return a.item.markerIndex - b.item.markerIndex;
  });

  return placements;
}

/** Stage 5: render anatomy pointers (alias for spec API). */
export const renderAnatomyPointers = renderAnatomyPointerPlacements;

export function layoutItemToLegacyAnatomyItem(
  layoutItem: AnatomyLayoutItem,
  legacy: Partial<AnatomyItem> & { node: SceneNode; nodeId: string; bounds: AnatomyItem['bounds'] }
): AnatomyItem {
  const order = layoutItem.order;
  return {
    ...legacy,
    nodeId: layoutItem.nodeId,
    node: legacy.node,
    bounds: legacy.bounds,
    markerIndex: order + 1,
    index: order + 1,
    anatomyIndex: layoutItem.index,
    finalLabel: layoutItem.targetName || layoutItem.index,
    name: layoutItem.targetName || layoutItem.index,
    level: layoutItem.level === 'child' ? 'nested' : 'root',
  } as AnatomyItem;
}
