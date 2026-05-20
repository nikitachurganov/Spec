/// <reference types="@figma/plugin-typings" />

import { indexPathToKey } from './nodePathUtils';

export type TokenizedSpacing = {
  value: number;
  unit: string;
  token: string;
  isCustom: boolean;
};

export type ContainerSpec = {
  id: string;
  name: string;
  path: string;
  nodePath: number[];
  nodePathKey: string;
  type: SceneNode['type'];
  layout: {
    direction: 'vertical' | 'horizontal' | 'grid' | 'none';
    wrap?: boolean;
    primaryAxisAlignment?: string;
    counterAxisAlignment?: string;
  };
  sizing: {
    width: { mode: string; value: number };
    height: { mode: string; value: number };
  };
  padding: {
    top: TokenizedSpacing;
    right: TokenizedSpacing;
    bottom: TokenizedSpacing;
    left: TokenizedSpacing;
  };
  spacing: {
    source: string;
    gap?: TokenizedSpacing;
    rowGap?: TokenizedSpacing;
  };
  children: string[];
  warnings: string[];
};

export type ParseContainersOptions = {
  selectedLayerPaths?: string[];
};

function toSpacingToken(raw: number): TokenizedSpacing {
  const v = Math.round(raw);
  return {
    value: v,
    unit: 'px',
    token: 'custom',
    isCustom: true,
  };
}

function getDirection(node: SceneNode): ContainerSpec['layout']['direction'] {
  if (!('layoutMode' in node) || node.layoutMode === undefined) {
    return 'none';
  }

  switch (node.layoutMode) {
    case 'HORIZONTAL':
      return 'horizontal';
    case 'VERTICAL':
      return 'vertical';
    case 'GRID':
      return 'grid';
    default:
      return 'none';
  }
}

function getSizingMode(value: string): string {
  switch (value) {
    case 'FILL':
      return 'fill';
    case 'HUG':
      return 'hug';
    case 'FIXED':
      return 'fixed';
    default:
      return 'unknown';
  }
}

function parseSizing(node: SceneNode): ContainerSpec['sizing'] {
  let wMode = 'unknown';
  let hMode = 'unknown';

  if ('layoutSizingHorizontal' in node && node.layoutSizingHorizontal !== undefined) {
    wMode = getSizingMode(node.layoutSizingHorizontal);
  }
  if ('layoutSizingVertical' in node && node.layoutSizingVertical !== undefined) {
    hMode = getSizingMode(node.layoutSizingVertical);
  }

  return {
    width: { mode: wMode, value: Math.round(node.width) },
    height: { mode: hMode, value: Math.round(node.height) },
  };
}

function parsePadding(node: SceneNode): ContainerSpec['padding'] {
  function padSide(prop: 'paddingTop' | 'paddingRight' | 'paddingBottom' | 'paddingLeft') {
    if (prop in node && typeof (node as FrameNode)[prop] === 'number') {
      return toSpacingToken((node as FrameNode)[prop]);
    }
    return toSpacingToken(0);
  }

  return {
    top: padSide('paddingTop'),
    right: padSide('paddingRight'),
    bottom: padSide('paddingBottom'),
    left: padSide('paddingLeft'),
  };
}

function parseSpacing(node: SceneNode): ContainerSpec['spacing'] {
  if (
    !('layoutMode' in node) ||
    node.layoutMode === undefined ||
    node.layoutMode === 'NONE'
  ) {
    return { source: 'none' };
  }

  const out: ContainerSpec['spacing'] = { source: 'auto-layout' };

  if ('itemSpacing' in node && typeof node.itemSpacing === 'number') {
    out.gap = toSpacingToken(node.itemSpacing);
  }
  if ('counterAxisSpacing' in node && typeof node.counterAxisSpacing === 'number') {
    out.rowGap = toSpacingToken(node.counterAxisSpacing);
  }

  return out;
}

function pathJoin(parts: string[]): string {
  return parts.join(' / ');
}

function isComponentBoundaryNode(node: SceneNode): boolean {
  return (
    node.type === 'INSTANCE' ||
    node.type === 'COMPONENT' ||
    node.type === 'COMPONENT_SET'
  );
}

function canTraverseSpecNode(node: SceneNode, rootNode: SceneNode): boolean {
  if (node.id === rootNode.id) return true;
  if (isComponentBoundaryNode(node)) return false;
  return node.type === 'FRAME' || node.type === 'GROUP' || node.type === 'SECTION';
}

function shouldCreateContainerSpecForNode(node: SceneNode, rootNode: SceneNode): boolean {
  if (!node) return false;
  if (node.id === rootNode.id) return true;
  if (isComponentBoundaryNode(node)) return false;
  return node.type === 'FRAME' || node.type === 'GROUP' || node.type === 'SECTION';
}

function canCreateContainerSpec(node: SceneNode): boolean {
  return typeof node.width === 'number' && typeof node.height === 'number';
}

function canEmitPartialContainer(node: SceneNode): boolean {
  return (
    node.type === 'FRAME' ||
    node.type === 'GROUP' ||
    node.type === 'SECTION' ||
    isComponentBoundaryNode(node)
  );
}

function createContainerSpec(
  node: SceneNode,
  nameParts: string[],
  indexPath: number[]
): ContainerSpec {
  const dir = getDirection(node);
  const layout: ContainerSpec['layout'] = {
    direction: dir,
    wrap:
      'layoutWrap' in node && node.layoutWrap !== undefined
        ? node.layoutWrap === 'WRAP'
        : false,
  };

  if ('primaryAxisAlignItems' in node && node.primaryAxisAlignItems !== undefined) {
    layout.primaryAxisAlignment = String(node.primaryAxisAlignItems);
  }
  if ('counterAxisAlignItems' in node && node.counterAxisAlignItems !== undefined) {
    layout.counterAxisAlignment = String(node.counterAxisAlignItems);
  }

  const padding = parsePadding(node);
  const spacing = parseSpacing(node);

  const childNames: string[] = [];
  if ('children' in node && node.children?.length) {
    for (const child of node.children) {
      childNames.push(child.name);
    }
  }

  const warnings: string[] = [];
  if (dir === 'none') {
    warnings.push(
      'Контейнер не использует Auto Layout. Padding и spacing могут быть неполными.'
    );
  }

  const hasCustomSpacing =
    padding.top.isCustom ||
    padding.right.isCustom ||
    padding.bottom.isCustom ||
    padding.left.isCustom ||
    !!(spacing.gap && spacing.gap.isCustom) ||
    !!(spacing.rowGap && spacing.rowGap.isCustom);

  if (hasCustomSpacing) {
    warnings.push('Некоторые spacing-значения не совпадают с токенами.');
  }

  return {
    id: node.id,
    name: node.name,
    path: pathJoin(nameParts),
    nodePath: indexPath.slice(),
    nodePathKey: indexPathToKey(indexPath),
    type: node.type,
    layout,
    sizing: parseSizing(node),
    padding,
    spacing,
    children: childNames,
    warnings,
  };
}

function createContainerSpecIfPossible(
  node: SceneNode,
  rootNode: SceneNode
): ContainerSpec | null {
  if (!canCreateContainerSpec(node)) return null;

  if (shouldCreateContainerSpecForNode(node, rootNode)) {
    return createContainerSpec(node, [rootNode.name], []);
  }

  if (canEmitPartialContainer(node)) {
    return createContainerSpec(node, [rootNode.name], []);
  }

  return null;
}

function emitContainerSpec(
  node: SceneNode,
  rootNode: SceneNode,
  containers: ContainerSpec[],
  nameParts: string[],
  indexPath: number[]
): void {
  const pathKey = indexPathToKey(indexPath);
  if (containers.some((c) => c.nodePathKey === pathKey)) {
    return;
  }

  if (shouldCreateContainerSpecForNode(node, rootNode)) {
    containers.push(createContainerSpec(node, nameParts, indexPath));
    return;
  }

  if (canEmitPartialContainer(node)) {
    console.warn(
      `[Spec] Layer "${node.name}" is not a standard layout container; building partial spec`
    );
    containers.push(createContainerSpec(node, nameParts, indexPath));
    return;
  }

  console.warn(`[Spec] Layer "${node.name}" is not a layout container and was skipped`);
}

function walkSpecChildren(
  node: SceneNode,
  rootNode: SceneNode,
  containers: ContainerSpec[],
  nameParts: string[],
  indexPath: number[],
  selectedSet: Set<string> | null
): void {
  if (!canTraverseSpecNode(node, rootNode)) {
    return;
  }

  if (!('children' in node) || !node.children?.length) {
    return;
  }

  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i] as SceneNode;
    const childPath = indexPath.concat(i);
    const pathKey = indexPathToKey(childPath);
    const childNameParts = nameParts.concat(child.name);

    if (selectedSet) {
      if (selectedSet.has(pathKey)) {
        emitContainerSpec(child, rootNode, containers, childNameParts, childPath);
      }
    } else if (shouldCreateContainerSpecForNode(child, rootNode)) {
      const existing = containers.some((c) => c.nodePathKey === pathKey);
      if (!existing) {
        containers.push(createContainerSpec(child, childNameParts, childPath));
      }
    }

    walkSpecChildren(child, rootNode, containers, childNameParts, childPath, selectedSet);
  }
}

export function parseContainers(
  root: SceneNode,
  options: ParseContainersOptions = {}
): ContainerSpec[] {
  const selected = (options.selectedLayerPaths || []).filter(Boolean);
  const selectedSet = selected.length > 0 ? new Set(selected) : null;

  const containers: ContainerSpec[] = [];

  const rootSpec = createContainerSpecIfPossible(root, root);
  if (rootSpec) {
    containers.push(rootSpec);
  }

  walkSpecChildren(root, root, containers, [root.name], [], selectedSet);

  return containers;
}
