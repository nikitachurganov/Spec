/// <reference types="@figma/plugin-typings" />

import type { SpecLayerOption } from '../../shared/messages';
import { buildDecompositionTree } from '../decomposition/buildDecompositionTree';
import {
  isDecompositionNodeSelectable,
  logSelectableParentNodes,
} from '../decomposition/selectableNodes';
import type { DecompositionTree } from '../decomposition/decompositionTypes';
import { parseContainers } from './parseContainers';

export type CollectSpecLayerOptionsResult = {
  rootName: string;
  options: SpecLayerOption[];
  autoSelectedLayerPaths: string[];
  decomposition: DecompositionTree;
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

export async function collectSpecLayerOptions(
  root: SceneNode
): Promise<CollectSpecLayerOptionsResult> {
  const decomposition = await buildDecompositionTree(root);
  const autoContainers = await parseContainers(root, { decomposition });
  const autoSelectedLayerPaths = autoContainers
    .map((c) => c.nodePathKey)
    .filter((key) => key !== '');

  const autoSelectedSet = new Set(autoSelectedLayerPaths);
  const options: SpecLayerOption[] = [];

  for (const [path, decompositionNode] of decomposition.decompositionByPath.entries()) {
    const sceneNode = decomposition.nodeByPath.get(path);
    if (!sceneNode) continue;
    if (path !== '' && (isHiddenNode(sceneNode) || isServiceNode(sceneNode))) continue;
    const isRoot = path === '';

    options.push({
      path,
      name: decompositionNode.displayName || sceneNode.name || 'Layer',
      type: sceneNode.type,
      depth: decompositionNode.depth,
      parentPath: decompositionNode.parentPath ?? undefined,
      isAutoSelected: autoSelectedSet.has(path),
      isSelectable: isDecompositionNodeSelectable(sceneNode, decompositionNode),
      isComponentBoundary: decompositionNode.isComponentLike,
      isRoot,
      isText: decompositionNode.isText,
      kind: decompositionNode.kind,
    });
  }

  logSelectableParentNodes(options, decomposition.decompositionByPath);

  return {
    rootName: root.name || 'Component',
    options,
    autoSelectedLayerPaths,
    decomposition,
  };
}
