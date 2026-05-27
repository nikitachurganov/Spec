/// <reference types="@figma/plugin-typings" />

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type VisualBoundsOptions = {
  includeInvisible?: boolean;
  includeAbsoluteChildren?: boolean;
  includeStrokes?: boolean;
};

export type RelativeVisualBounds = {
  visualBounds: Rect;
  rootOffset: {
    x: number;
    y: number;
  };
};

function isValidDimension(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function getNodeOwnBounds(node: SceneNode): Rect | null {
  const box = node.absoluteBoundingBox;
  if (
    box &&
    isValidDimension(box.x) &&
    isValidDimension(box.y) &&
    isValidDimension(box.width) &&
    isValidDimension(box.height)
  ) {
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  }

  if (
    'x' in node &&
    'y' in node &&
    'width' in node &&
    'height' in node &&
    isValidDimension(node.x) &&
    isValidDimension(node.y) &&
    isValidDimension(node.width) &&
    isValidDimension(node.height)
  ) {
    return { x: node.x, y: node.y, width: node.width, height: node.height };
  }

  return null;
}

function unionRects(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const rect of rects) {
    if (rect.width <= 0 || rect.height <= 0) continue;
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;

  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}

function shouldIncludeChild(
  child: SceneNode,
  includeAbsoluteChildren: boolean
): boolean {
  if (includeAbsoluteChildren) return true;
  if ('layoutPositioning' in child && child.layoutPositioning === 'ABSOLUTE') {
    return false;
  }
  return true;
}

function collectVisualBounds(
  node: SceneNode,
  options: Required<VisualBoundsOptions>,
  rects: Rect[]
): void {
  if (!options.includeInvisible && 'visible' in node && node.visible === false) {
    return;
  }

  const ownBounds = getNodeOwnBounds(node);
  if (ownBounds && ownBounds.width > 0 && ownBounds.height > 0) {
    rects.push(ownBounds);
  }

  if (!('children' in node) || !Array.isArray(node.children)) {
    return;
  }

  for (const child of node.children) {
    if (!shouldIncludeChild(child as SceneNode, options.includeAbsoluteChildren)) {
      continue;
    }
    collectVisualBounds(child as SceneNode, options, rects);
  }
}

/**
 * Union bounds of a node and all visible descendants in absolute/page coordinates.
 */
export function getNodeVisualBounds(
  node: SceneNode,
  options?: VisualBoundsOptions
): Rect {
  const resolvedOptions: Required<VisualBoundsOptions> = {
    includeInvisible: options?.includeInvisible ?? false,
    includeAbsoluteChildren: options?.includeAbsoluteChildren ?? true,
    includeStrokes: options?.includeStrokes ?? false,
  };

  const rects: Rect[] = [];
  collectVisualBounds(node, resolvedOptions, rects);

  const union = unionRects(rects);
  if (union && union.width > 0 && union.height > 0) {
    return union;
  }

  const ownBounds = getNodeOwnBounds(node);
  if (ownBounds && ownBounds.width > 0 && ownBounds.height > 0) {
    return ownBounds;
  }

  return {
    x: 0,
    y: 0,
    width: Math.max(1, 'width' in node && isValidDimension(node.width) ? node.width : 1),
    height: Math.max(1, 'height' in node && isValidDimension(node.height) ? node.height : 1),
  };
}

export function getVisualBoundsOffsetFromRoot(params: {
  root: SceneNode;
  visualBounds: Rect;
}): {
  offsetX: number;
  offsetY: number;
} {
  const rootBox = getNodeOwnBounds(params.root);
  if (!rootBox) {
    return { offsetX: 0, offsetY: 0 };
  }

  return {
    offsetX: rootBox.x - params.visualBounds.x,
    offsetY: rootBox.y - params.visualBounds.y,
  };
}

export function getVisualBoundsRelativeToRoot(
  root: SceneNode,
  visualBounds: Rect
): RelativeVisualBounds {
  const rootOffset = getVisualBoundsOffsetFromRoot({ root, visualBounds });
  return {
    visualBounds,
    rootOffset: {
      x: rootOffset.offsetX,
      y: rootOffset.offsetY,
    },
  };
}

export function getRelativeVisualBounds(
  root: SceneNode,
  options?: VisualBoundsOptions
): RelativeVisualBounds {
  const visualBounds = getNodeVisualBounds(root, options);
  return getVisualBoundsRelativeToRoot(root, visualBounds);
}
