/// <reference types="@figma/plugin-typings" />

import type { DecompositionNode } from './decompositionTypes';

const SKIP_NAME_PREFIXES = [
  'Padding overlay',
  'Child overlay',
  'Gap overlay',
  'Preview /',
  'Target container outline',
  'Anatomy ',
] as const;

export const DEBUG_SELECTABLE_PARENTS = false;

function isServiceNode(node: SceneNode): boolean {
  const name = String(node.name || '');
  if (name.startsWith('_')) return true;
  return SKIP_NAME_PREFIXES.some((prefix) => name.startsWith(prefix));
}

function isHiddenNode(node: SceneNode): boolean {
  return 'visible' in node && node.visible === false;
}

function isSelectableForSpec(node: SceneNode): boolean {
  if (
    node.type === 'INSTANCE' ||
    node.type === 'COMPONENT' ||
    node.type === 'COMPONENT_SET'
  ) {
    return true;
  }
  if (node.type === 'FRAME' || node.type === 'GROUP' || node.type === 'SECTION') {
    return true;
  }
  if (node.type === 'TEXT') return false;
  if (node.type === 'LINE' || node.type === 'VECTOR' || node.type === 'BOOLEAN_OPERATION') {
    return false;
  }
  return false;
}

function isAnatomyKindSelectable(kind: DecompositionNode['kind']): boolean {
  return (
    kind === 'slot' ||
    kind === 'icon' ||
    kind === 'badge' ||
    kind === 'divider' ||
    kind === 'action' ||
    kind === 'container'
  );
}

/**
 * Whether a decomposition node can be checked in the tree and selected in preview.
 * Parent/master nodes remain selectable even when they have children.
 */
export function isDecompositionNodeSelectable(
  node: SceneNode,
  decompositionNode: DecompositionNode
): boolean {
  if (decompositionNode.isRoot) return true;
  if (isHiddenNode(node) || isServiceNode(node)) return false;
  if (decompositionNode.isText) return true;
  if (isSelectableForSpec(node)) return true;
  if (isAnatomyKindSelectable(decompositionNode.kind)) return true;
  if (
    decompositionNode.hasChildren &&
    (decompositionNode.isComponentLike ||
      decompositionNode.isStandardLayoutContainer ||
      decompositionNode.isAutoLayout)
  ) {
    return true;
  }
  return false;
}

export function logSelectableParentNodes(
  options: Array<{ path: string; name: string; isSelectable: boolean }>,
  decompositionByPath: Map<string, DecompositionNode>
): void {
  if (!DEBUG_SELECTABLE_PARENTS) return;

  const selectableParents = options.filter((option) => {
    const decompositionNode = decompositionByPath.get(option.path);
    return Boolean(decompositionNode?.hasChildren && option.isSelectable);
  });

  console.debug(
    '[Decomposition] selectable parent nodes',
    selectableParents.map((node) => {
      const decompositionNode = decompositionByPath.get(node.path);
      return {
        path: node.path,
        name: node.name,
        depth: decompositionNode?.depth,
        hasChildren: decompositionNode?.hasChildren,
      };
    })
  );
}
