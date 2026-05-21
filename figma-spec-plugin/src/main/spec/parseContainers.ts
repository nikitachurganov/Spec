/// <reference types="@figma/plugin-typings" />

import { formatRawSpacingValue } from '../tokens/spacingBindingResolver';
import {
  buildCustomSpacingWarningLines,
  parsePadding as parsePaddingAsync,
  parseSpacing as parseSpacingAsync,
} from './parseSpacing';
import { indexPathToKey } from './nodePathUtils';

export type TokenizedSpacing = {
  value: number;
  unit: string;
  /** Display label for Container card rows, e.g. `8px` or `Spaces/semantic/8 (8px)`. */
  label: string;
  token: string;
  /** True when the value is not bound to a Figma variable (raw numeric). */
  isCustom: boolean;
  isTokenBound: boolean;
  tokenPath?: string;
  variableId?: string;
  variableKey?: string;
  groupingKey: string;
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

function toSpacingTokenFallback(raw: number): TokenizedSpacing {
  const v = Math.round(raw);
  const label = formatRawSpacingValue(v);
  return {
    value: v,
    unit: 'px',
    label,
    token: 'custom',
    isCustom: true,
    isTokenBound: false,
    groupingKey: `raw:${v}`,
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

async function parsePadding(node: SceneNode): Promise<ContainerSpec['padding']> {
  try {
    return await parsePaddingAsync(node);
  } catch (e) {
    console.warn('[Spec] parsePadding failed, using raw px fallback', e);

    function padSide(prop: 'paddingTop' | 'paddingRight' | 'paddingBottom' | 'paddingLeft') {
      if (prop in node && typeof (node as FrameNode)[prop] === 'number') {
        return toSpacingTokenFallback((node as FrameNode)[prop]);
      }
      return toSpacingTokenFallback(0);
    }

    return {
      top: padSide('paddingTop'),
      right: padSide('paddingRight'),
      bottom: padSide('paddingBottom'),
      left: padSide('paddingLeft'),
    };
  }
}

async function parseSpacing(node: SceneNode): Promise<ContainerSpec['spacing']> {
  try {
    return await parseSpacingAsync(node);
  } catch (e) {
    console.warn('[Spec] parseSpacing failed, using raw px fallback', e);
  }

  if (
    !('layoutMode' in node) ||
    node.layoutMode === undefined ||
    node.layoutMode === 'NONE'
  ) {
    return { source: 'none' };
  }

  const out: ContainerSpec['spacing'] = { source: 'auto-layout' };

  if ('itemSpacing' in node && typeof node.itemSpacing === 'number') {
    out.gap = toSpacingTokenFallback(node.itemSpacing);
  }
  if ('counterAxisSpacing' in node && typeof node.counterAxisSpacing === 'number') {
    out.rowGap = toSpacingTokenFallback(node.counterAxisSpacing);
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

async function createContainerSpec(
  node: SceneNode,
  nameParts: string[],
  indexPath: number[]
): Promise<ContainerSpec> {
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

  const padding = await parsePadding(node);
  const spacing = await parseSpacing(node);

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

  warnings.push(...buildCustomSpacingWarningLines({ padding, spacing }));

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

async function createContainerSpecIfPossible(
  node: SceneNode,
  rootNode: SceneNode
): Promise<ContainerSpec | null> {
  if (!canCreateContainerSpec(node)) return null;

  if (shouldCreateContainerSpecForNode(node, rootNode)) {
    return createContainerSpec(node, [rootNode.name], []);
  }

  if (canEmitPartialContainer(node)) {
    return createContainerSpec(node, [rootNode.name], []);
  }

  return null;
}

async function emitContainerSpec(
  node: SceneNode,
  rootNode: SceneNode,
  containers: ContainerSpec[],
  nameParts: string[],
  indexPath: number[]
): Promise<void> {
  const pathKey = indexPathToKey(indexPath);
  if (containers.some((c) => c.nodePathKey === pathKey)) {
    return;
  }

  if (shouldCreateContainerSpecForNode(node, rootNode)) {
    containers.push(await createContainerSpec(node, nameParts, indexPath));
    return;
  }

  if (canEmitPartialContainer(node)) {
    console.warn(
      `[Spec] Layer "${node.name}" is not a standard layout container; building partial spec`
    );
    containers.push(await createContainerSpec(node, nameParts, indexPath));
    return;
  }

  console.warn(`[Spec] Layer "${node.name}" is not a layout container and was skipped`);
}

async function walkSpecChildren(
  node: SceneNode,
  rootNode: SceneNode,
  containers: ContainerSpec[],
  nameParts: string[],
  indexPath: number[],
  selectedSet: Set<string> | null
): Promise<void> {
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
        await emitContainerSpec(child, rootNode, containers, childNameParts, childPath);
      }
    } else if (shouldCreateContainerSpecForNode(child, rootNode)) {
      const existing = containers.some((c) => c.nodePathKey === pathKey);
      if (!existing) {
        containers.push(await createContainerSpec(child, childNameParts, childPath));
      }
    }

    await walkSpecChildren(child, rootNode, containers, childNameParts, childPath, selectedSet);
  }
}

export async function parseContainers(
  root: SceneNode,
  options: ParseContainersOptions = {}
): Promise<ContainerSpec[]> {
  const selected = (options.selectedLayerPaths || []).filter(Boolean);
  const selectedSet = selected.length > 0 ? new Set(selected) : null;

  const containers: ContainerSpec[] = [];

  const rootSpec = await createContainerSpecIfPossible(root, root);
  if (rootSpec) {
    containers.push(rootSpec);
  }

  await walkSpecChildren(root, root, containers, [root.name], [], selectedSet);

  return containers;
}
