/// <reference types="@figma/plugin-typings" />

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

export type AnatomyNodeLevel = 'root' | 'child';

export type AnatomyGroupDirection = 'horizontal' | 'vertical' | 'unknown';

export type AnatomyAnchorType = 'top' | 'right' | 'bottom';
export type AnatomyRouteZone = 'top' | 'right' | 'bottom';
export type AnatomySide = 'top' | 'right' | 'bottom';

export type AnatomyRouteType =
  | 'top-entry'
  | 'straight-right'
  | 'bottom-entry'
  | 'generic-top'
  | 'generic-right'
  | 'generic-bottom';

/** Hierarchical anatomy target used by the layout engine (not the legacy pipeline item). */
export type AnatomyItem = {
  id: string;
  nodeId: string;
  index: string;
  level: AnatomyNodeLevel;
  parentIndex: string | null;
  targetBounds: Bounds;
  targetName?: string;
  groupId?: string;
  groupDirection?: AnatomyGroupDirection;
  order: number;
  rowIndex?: number;
  isFirstInRow?: boolean;
  isNestedItem?: boolean;
  routeZone?: AnatomyRouteZone;
};

/** Backward-compatible alias used by existing anatomy modules. */
export type AnatomyLayoutItem = AnatomyItem;

export type AnatomyLabelLayout = {
  itemId: string;
  labelText: string;
  side: AnatomySide;
  preferredCenterY: number;
  resolvedCenterY: number;
  labelBounds: Bounds;
  anchorPoint: Point;
  targetPoint: Point;
};

export type AnatomyRoute = {
  itemId: string;
  anchorType: AnatomyAnchorType;
  routeType: AnatomyRouteType;
  startPoint: Point;
  bendPoint: Point | null;
  endPoint: Point;
  segments: Segment[];
  score: number;
  hasIntersection: boolean;
};

export type AnatomyLayoutResult = {
  items: AnatomyLayoutItem[];
  labels: AnatomyLabelLayout[];
  routes: AnatomyRoute[];
};
