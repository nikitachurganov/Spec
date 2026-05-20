/// <reference types="@figma/plugin-typings" />

import type { SpecLayerOption } from '../../shared/messages';
import { indexPathToKey } from './nodePathUtils';
import { parseContainers } from './parseContainers';

export type CollectSpecLayerOptionsResult = {
  rootName: string;
  options: SpecLayerOption[];
  autoSelectedLayerPaths: string[];
};

const SKIP_NAME_PREFIXES = [
  'Padding overlay',
  'Child overlay',
  'Gap overlay',
  'Preview /',
  'Target container outline',
  'Anatomy ',
];

function isServiceNode(node: SceneNode): boolean {
  const name = String(node.name || '');
  if (name.startsWith('_')) return true;
  return SKIP_NAME_PREFIXES.some((p) => name.startsWith(p));
}

function isHiddenNode(node: SceneNode): boolean {
  return 'visible' in node && node.visible === false;
}

function isComponentBoundaryNode(node: SceneNode): boolean {
  return (
    node.type === 'INSTANCE' ||
    node.type === 'COMPONENT' ||
    node.type === 'COMPONENT_SET'
  );
}

function isSelectableForSpec(node: SceneNode): boolean {
  if (node.type === 'TEXT') return false;
  if (node.type === 'LINE' || node.type === 'VECTOR' || node.type === 'BOOLEAN_OPERATION') {
    return false;
  }
  if (node.type === 'FRAME' || node.type === 'GROUP' || node.type === 'SECTION') {
    return true;
  }
  if (isComponentBoundaryNode(node)) return true;
  return false;
}

function walkCollect(
  node: SceneNode,
  root: SceneNode,
  indexPath: number[],
  depth: number,
  parentPathKey: string | undefined,
  options: SpecLayerOption[],
  autoSelectedSet: Set<string>
): void {
  if (node !== root) {
    if (!isHiddenNode(node) && !isServiceNode(node)) {
      const pathKey = indexPathToKey(indexPath);
      options.push({
        path: pathKey,
        name: node.name || 'Layer',
        type: node.type,
        depth,
        parentPath: parentPathKey,
        isAutoSelected: autoSelectedSet.has(pathKey),
        isSelectable: isSelectableForSpec(node),
        isComponentBoundary: isComponentBoundaryNode(node),
      });
    }
  }

  if (!canTraverseCollect(node, root)) {
    return;
  }

  if (!('children' in node) || !node.children?.length) {
    return;
  }

  const currentPathKey = node === root ? undefined : indexPathToKey(indexPath);

  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i] as SceneNode;
    walkCollect(
      child,
      root,
      indexPath.concat(i),
      depth + 1,
      currentPathKey,
      options,
      autoSelectedSet
    );
  }
}

function canTraverseCollect(node: SceneNode, root: SceneNode): boolean {
  if (node.id === root.id) return true;
  if (isComponentBoundaryNode(node)) return false;
  return node.type === 'FRAME' || node.type === 'GROUP' || node.type === 'SECTION';
}

export function collectSpecLayerOptions(root: SceneNode): CollectSpecLayerOptionsResult {
  const autoContainers = parseContainers(root, {});
  const autoSelectedLayerPaths = autoContainers
    .map((c) => c.nodePathKey)
    .filter((key) => key !== '');

  const autoSelectedSet = new Set(autoSelectedLayerPaths);
  const options: SpecLayerOption[] = [];

  walkCollect(root, root, [], 0, undefined, options, autoSelectedSet);

  return {
    rootName: root.name || 'Component',
    options,
    autoSelectedLayerPaths,
  };
}
