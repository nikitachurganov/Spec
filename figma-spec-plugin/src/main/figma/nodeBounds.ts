/// <reference types="@figma/plugin-typings" />

import type { Rect } from '../overlays/overlayGeometry';

export type NodeBoundsRelative = Rect & {
  source: 'absoluteBoundingBox' | 'local';
};

export function getNodeBoundsRelativeToRoot(
  node: SceneNode,
  rootNode: SceneNode
): NodeBoundsRelative {
  const nodeBox = node.absoluteBoundingBox;
  const rootBox = rootNode.absoluteBoundingBox;

  if (
    nodeBox &&
    rootBox &&
    typeof nodeBox.x === 'number' &&
    typeof nodeBox.y === 'number' &&
    typeof nodeBox.width === 'number' &&
    typeof nodeBox.height === 'number' &&
    typeof rootBox.x === 'number' &&
    typeof rootBox.y === 'number'
  ) {
    return {
      x: nodeBox.x - rootBox.x,
      y: nodeBox.y - rootBox.y,
      width: nodeBox.width,
      height: nodeBox.height,
      source: 'absoluteBoundingBox',
    };
  }

  return {
    x: typeof node.x === 'number' ? node.x : 0,
    y: typeof node.y === 'number' ? node.y : 0,
    width: typeof node.width === 'number' ? node.width : 0,
    height: typeof node.height === 'number' ? node.height : 0,
    source: 'local',
  };
}
