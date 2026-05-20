/// <reference types="@figma/plugin-typings" />

import { getNodePathFromRoot } from '../figma/nodePath';

export function indexPathToKey(indexPath: number[]): string {
  return indexPath.join('/');
}

export function getIndexPathKey(node: SceneNode, root: SceneNode): string | null {
  const path = getNodePathFromRoot(root, node);
  if (path === null) return null;
  return indexPathToKey(path);
}
