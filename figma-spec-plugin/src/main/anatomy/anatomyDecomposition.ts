/// <reference types="@figma/plugin-typings" />

import {
  getBaseDisplayName,
  isMeaningfulContainerName,
  normalizeName,
  type NamingContext,
} from './anatomyNaming';
import { getNodeByPath } from '../figma/nodePath';
import { getNodeVisualBounds } from '../figma/visualBounds';
import type {
  AnatomyBounds,
  AnatomyCandidate,
  AnatomyGeneratorOptions,
  AnatomyItem,
  AnatomyRect,
  ComponentPropertyMetadata,
} from './anatomyTypes';
import { mergeAnatomyOptions } from './anatomyStyles';
import { runAnatomyPipeline, runAnatomyPipelineFromCandidates } from './anatomyPipeline';

const anatomyWarnedMessages = new Set<string>();

function warnOnce(key: string, message: string): void {
  if (anatomyWarnedMessages.has(key)) return;
  anatomyWarnedMessages.add(key);
  console.warn(message);
}

function includesAny(value: string, patterns: string[]): boolean {
  return patterns.some((p) => value.includes(p));
}

function isServiceNode(node: SceneNode): boolean {
  const name = String(node.name || '');
  if (name.charAt(0) === '_') return true;

  const prefixes = [
    'Padding overlay',
    'Gap overlay',
    'Child overlay',
    'Preview /',
    'Anatomy marker',
    'Anatomy connector',
    'Anatomy list',
    'Padding measure',
    'Gap measure',
    'Padding value',
    'Gap value',
    'Value square',
    'Container preview card',
    'Padding overlay container',
  ];

  if (prefixes.some((p) => name.indexOf(p) === 0)) return true;

  const n = normalizeName(name);
  return n.includes('value square') || n.includes('measure fill');
}

export function shouldConsiderNode(node: SceneNode, options: AnatomyGeneratorOptions): boolean {
  if (!options.includeHidden && 'visible' in node && node.visible === false) {
    return false;
  }
  if (isServiceNode(node)) return false;
  if (typeof node.width !== 'number' || typeof node.height !== 'number') return false;
  if (node.width <= 0 || node.height <= 0) return false;
  return true;
}

function isComponentLikeNode(node: SceneNode): boolean {
  return (
    node.type === 'INSTANCE' || node.type === 'COMPONENT' || node.type === 'COMPONENT_SET'
  );
}

function isTextNode(node: SceneNode): boolean {
  return node.type === 'TEXT';
}

function isKeyTextNode(node: SceneNode): boolean {
  if (!isTextNode(node)) return false;
  const name = normalizeName(node.name || '');
  return includesAny(name, [
    'title',
    'label',
    'body',
    'description',
    'shortcut',
    'caption',
    'subtitle',
    'heading',
  ]);
}

function isLineLikeNode(node: SceneNode): boolean {
  const name = normalizeName(node.name || '');
  if (node.type === 'LINE') return true;
  if (
    (node.type === 'VECTOR' || node.type === 'RECTANGLE') &&
    includesAny(name, ['divider', 'separator', 'line', 'border', 'разделитель', 'линия'])
  ) {
    return true;
  }
  return includesAny(name, ['divider', 'separator', 'line', 'border', 'разделитель', 'линия']);
}

function isAtomicByName(node: SceneNode): boolean {
  const name = normalizeName(node.name || '');
  return includesAny(name, [
    'icon',
    'икон',
    'label',
    'лейбл',
    'body',
    'wobbler',
    'tag',
    'badge',
    'avatar',
    'image',
    'media',
    'checkbox',
    'radio',
    'switch',
    'control',
    'button',
    'link',
    'input',
    'title',
    'subtitle',
    'description',
    'caption',
    'menu item',
    'chevron',
    'shortcut',
    'counter',
    'selected indicator',
  ]);
}

function isMeaningfulShapeNode(node: SceneNode): boolean {
  const shapeTypes = new Set([
    'VECTOR',
    'RECTANGLE',
    'ELLIPSE',
    'POLYGON',
    'STAR',
    'BOOLEAN_OPERATION',
  ]);
  if (!shapeTypes.has(node.type)) return false;

  const name = normalizeName(node.name || '');
  if (!name || name === 'vector' || name === 'rectangle' || name === 'ellipse') {
    return false;
  }

  return includesAny(name, [
    'indicator',
    'icon',
    'badge',
    'avatar',
    'thumb',
    'dot',
    'marker',
    'selection',
    'divider',
    'line',
    'chevron',
  ]);
}

function isStructuralContainer(node: SceneNode): boolean {
  if (isTextNode(node) || isComponentLikeNode(node)) return false;

  const name = normalizeName(node.name || '');
  if (
    includesAny(name, [
      'frame',
      'group',
      'auto layout',
      'wrapper',
      'container',
      'content wrapper',
      'item container',
      'layer',
      'content',
      'layout',
      'main',
      'center',
      'text',
      'body container',
    ])
  ) {
    return true;
  }

  return node.type === 'FRAME' || node.type === 'GROUP' || node.type === 'SECTION';
}

export type AnatomyWalkRole = 'skip' | 'atomic' | 'container' | 'meaningful-container';

/** Classifies a node for anatomy collection (reused by structure + legacy pipeline). */
export function getAnatomyWalkRole(node: SceneNode, rootNode: SceneNode): AnatomyWalkRole {
  if (isServiceNode(node)) return 'skip';
  if (node === rootNode) return 'container';

  if (isComponentLikeNode(node)) return 'atomic';
  if (isLineLikeNode(node)) return 'atomic';
  if (isKeyTextNode(node)) return 'atomic';
  if (isAtomicByName(node)) return 'atomic';
  if (isMeaningfulShapeNode(node)) return 'atomic';

  if (isStructuralContainer(node)) {
    if (isMeaningfulContainerName(node.name || '')) {
      return 'meaningful-container';
    }
    return 'container';
  }

  if ('children' in node && node.children.length > 0) {
    return 'container';
  }

  return 'skip';
}

export function toAnatomyBounds(rect: AnatomyRect): AnatomyBounds {
  return {
    ...rect,
    centerX: rect.x + rect.width / 2,
    centerY: rect.y + rect.height / 2,
  };
}

export function getRelativeBounds(node: SceneNode, rootNode: SceneNode): AnatomyBounds {
  try {
    const nodeVisual = getNodeVisualBounds(node, { includeInvisible: false, includeAbsoluteChildren: true });
    const rootVisual = getNodeVisualBounds(rootNode, { includeInvisible: false, includeAbsoluteChildren: true });
    if (
      Number.isFinite(nodeVisual.x) &&
      Number.isFinite(nodeVisual.y) &&
      Number.isFinite(nodeVisual.width) &&
      Number.isFinite(nodeVisual.height) &&
      Number.isFinite(rootVisual.x) &&
      Number.isFinite(rootVisual.y)
    ) {
      return toAnatomyBounds({
        x: nodeVisual.x - rootVisual.x,
        y: nodeVisual.y - rootVisual.y,
        width: Math.max(1, nodeVisual.width),
        height: Math.max(1, nodeVisual.height),
      });
    }
  } catch {
    // Fallback to node/root absolute bounds below.
  }

  const nodeBox = node.absoluteBoundingBox;
  const rootBox = rootNode.absoluteBoundingBox;

  if (nodeBox && rootBox) {
    return toAnatomyBounds({
      x: nodeBox.x - rootBox.x,
      y: nodeBox.y - rootBox.y,
      width: Math.max(1, nodeBox.width),
      height: Math.max(1, nodeBox.height),
    });
  }

  return toAnatomyBounds({
    x: 'x' in node ? node.x : 0,
    y: 'y' in node ? node.y : 0,
    width: Math.max(1, node.width),
    height: Math.max(1, node.height),
  });
}

function getNodePathFromRoot(rootNode: SceneNode, targetNode: SceneNode): number[] {
  if (targetNode.id === rootNode.id) return [];

  const path: number[] = [];
  let current: BaseNode | null = targetNode;

  while (current && current.id !== rootNode.id) {
    const parent: (ChildrenMixin & BaseNode) | null = current.parent as
      | (ChildrenMixin & BaseNode)
      | null;
    if (!parent || !('children' in parent)) return path;

    const index = parent.children.indexOf(current as SceneNode);
    if (index < 0) return path;
    path.unshift(index);
    current = parent;
  }

  return path;
}

function createStubCandidate(
  node: SceneNode,
  rootNode: SceneNode,
  depth: number,
  parentContextName?: string,
  metadata?: {
    selectedPath?: string;
    isManualSelection?: boolean;
  }
): AnatomyCandidate {
  const bounds = getRelativeBounds(node, rootNode);
  return {
    node,
    nodeId: node.id,
    sourceNodeId: node.id,
    sourceNodeName: node.name || '',
    selectedPath: metadata?.selectedPath,
    isManualSelection: metadata?.isManualSelection,
    nodePath: getNodePathFromRoot(rootNode, node),
    depth,
    rawName: node.name || '',
    baseName: '',
    displayName: '',
    entityKind: 'container-variant',
    role: 'element',
    features: [],
    parentContextName,
    level: 'root',
    bounds,
    uniquenessKey: '',
  };
}

function removeDuplicateCandidatesByNodeId(candidates: AnatomyCandidate[]): AnatomyCandidate[] {
  const seenNodeIds = new Set<string>();
  const result: AnatomyCandidate[] = [];

  for (const candidate of candidates) {
    if (seenNodeIds.has(candidate.nodeId)) continue;
    seenNodeIds.add(candidate.nodeId);
    result.push(candidate);
  }

  return result;
}

export function collectAnatomyCandidates(
  rootNode: SceneNode,
  options: AnatomyGeneratorOptions,
  namingContext: NamingContext
): AnatomyCandidate[] {
  const maxDepth = options.maxDepth ?? 8;
  const raw: AnatomyCandidate[] = [];

  function walk(node: SceneNode, depth: number, contextStack: string[]): void {
    if (depth > maxDepth) return;

    if (node !== rootNode && !shouldConsiderNode(node, options)) {
      return;
    }

    const walkRole = getAnatomyWalkRole(node, rootNode);

    if (walkRole === 'skip') {
      return;
    }

    let childContextStack = contextStack;

    if (walkRole === 'atomic' || walkRole === 'meaningful-container') {
      const parentContextName =
        contextStack.length > 0 ? contextStack[contextStack.length - 1] : undefined;

      const stub = createStubCandidate(node, rootNode, depth, parentContextName);
      raw.push(stub);

      if (walkRole === 'meaningful-container') {
        childContextStack = [...contextStack, getBaseDisplayName(node, namingContext)];
      }
    }

    if (walkRole === 'atomic') {
      return;
    }

    if ('children' in node && node.children) {
      for (const child of node.children) {
        walk(child as SceneNode, depth + 1, childContextStack);
      }
    }
  }

  walk(rootNode, 0, []);
  return removeDuplicateCandidatesByNodeId(raw);
}

export function collectSemanticAnatomyItems(
  rootNode: SceneNode,
  options?: AnatomyGeneratorOptions
): AnatomyItem[] {
  const merged = mergeAnatomyOptions(options);
  merged.anatomyRootNodeForNames = rootNode;

  const namingContext: NamingContext = {
    componentPropertyMetadata: merged.componentPropertyMetadata,
    anatomyRootNodeForNames: rootNode,
    useComponentPropertyNames: merged.useComponentPropertyNames,
  };

  const selectedLayerPaths = Array.isArray(merged.selectedLayerPaths)
    ? merged.selectedLayerPaths.filter(Boolean)
    : [];

  const selectedCandidates =
    selectedLayerPaths.length > 0
      ? collectAnatomyCandidatesFromSelectedPaths(rootNode, selectedLayerPaths, merged)
      : [];

  const items =
    selectedCandidates.length > 0
      ? runAnatomyPipelineFromCandidates(selectedCandidates, rootNode, merged, namingContext)
      : runAnatomyPipeline(rootNode, merged, namingContext);

  if (!merged.includeContainer) {
    return items;
  }

  const containerBounds = toAnatomyBounds({
    x: 0,
    y: 0,
    width: rootNode.width,
    height: rootNode.height,
  });

  const containerRow: AnatomyItem = {
    node: rootNode,
    nodeId: rootNode.id,
    sourceNodeId: rootNode.id,
    sourceNodeName: rootNode.name || '',
    nodePath: [],
    depth: 0,
    rawName: rootNode.name || '',
    displayName: 'Container',
    baseName: 'Container',
    finalLabel: 'Container',
    entityKind: 'container-variant',
    role: 'container',
    features: [],
    level: 'root',
    bounds: containerBounds,
    uniquenessKey: 'container',
    markerIndex: 1,
    representedCount: 1,
    representedNodeIds: [rootNode.id],
    index: 1,
    id: rootNode.id,
    name: 'Container',
  };

  const renumbered = items.map((item, i) => {
    const markerIndex = i + 2;
    return {
      ...item,
      markerIndex,
      index: markerIndex,
      id: item.nodeId,
      name: item.finalLabel,
    };
  });

  return [containerRow, ...renumbered];
}

function parsePathKey(path: string): number[] {
  if (!path) return [];
  return path
    .split('/')
    .map((part) => Number(part))
    .filter((part) => Number.isInteger(part) && part >= 0);
}

function collectAnatomyCandidatesFromSelectedPaths(
  rootNode: SceneNode,
  selectedLayerPaths: string[],
  options: AnatomyGeneratorOptions
): AnatomyCandidate[] {
  const maxDepth = options.maxDepth ?? 8;
  const selectedCandidates: AnatomyCandidate[] = [];
  const seenPaths = new Set<string>();
  const seenNodeIds = new Set<string>();

  for (const pathKey of selectedLayerPaths) {
    if (seenPaths.has(pathKey)) continue;
    seenPaths.add(pathKey);

    const indexPath = parsePathKey(pathKey);
    if (indexPath.length === 0 && pathKey !== '') {
      warnOnce(
        `anatomy-selected-path-invalid:${pathKey}`,
        `[Anatomy] Selected path "${pathKey}" is invalid and was skipped.`
      );
      continue;
    }

    const node = getNodeByPath(rootNode, indexPath);
    if (!node) {
      warnOnce(
        `anatomy-selected-path-missing:${pathKey}`,
        `[Anatomy] Selected path "${pathKey}" was not found in current root.`
      );
      continue;
    }

    const nodeRef = `${node.name || node.type} (${node.id})`;

    if (!options.includeHidden && 'visible' in node && node.visible === false) {
      warnOnce(
        `anatomy-selected-node-hidden:${pathKey}:${node.id}`,
        `[Anatomy] Selected path "${pathKey}" -> ${nodeRef} skipped: node is invisible.`
      );
      continue;
    }
    if (isServiceNode(node)) {
      warnOnce(
        `anatomy-selected-node-service:${pathKey}:${node.id}`,
        `[Anatomy] Selected path "${pathKey}" -> ${nodeRef} skipped: service/helper node.`
      );
      continue;
    }

    const walkRole = getAnatomyWalkRole(node, rootNode);
    if (walkRole === 'skip' && node.type !== 'TEXT') {
      warnOnce(
        `anatomy-selected-node-skip:${pathKey}:${node.id}`,
        `[Anatomy] Selected path "${pathKey}" -> ${nodeRef} skipped: walk role is "skip".`
      );
      continue;
    }

    const depth = Math.min(indexPath.length, maxDepth);
    if (seenNodeIds.has(node.id)) {
      warnOnce(
        `anatomy-selected-node-duplicate:${pathKey}:${node.id}`,
        `[Anatomy] Selected path "${pathKey}" -> ${nodeRef} duplicates an already selected node and was merged by node id.`
      );
      continue;
    }

    const candidate = createStubCandidate(node, rootNode, depth, undefined, {
      selectedPath: pathKey,
      isManualSelection: true,
    });
    if (!Number.isFinite(candidate.bounds.x) || !Number.isFinite(candidate.bounds.y)) {
      warnOnce(
        `anatomy-selected-node-bounds:${pathKey}:${node.id}`,
        `[Anatomy] Selected path "${pathKey}" -> ${nodeRef} skipped: invalid bounds.`
      );
      continue;
    }

    selectedCandidates.push(candidate);
    seenNodeIds.add(node.id);
  }

  return selectedCandidates;
}

/** @deprecated use buildAnatomySequence */
export { collectAnatomyStructure, buildAnatomySequence } from './anatomyStructure';

export function readComponentPropertyDefinitionsSafe(
  node: ComponentNode | ComponentSetNode
): ComponentPropertyDefinitions {
  try {
    if (node.type === 'COMPONENT_SET' && node.componentPropertyDefinitions) {
      return node.componentPropertyDefinitions;
    }

    if (node.type === 'COMPONENT') {
      if (
        node.parent?.type === 'COMPONENT_SET' &&
        node.parent.componentPropertyDefinitions
      ) {
        return node.parent.componentPropertyDefinitions;
      }
      if (node.componentPropertyDefinitions) {
        return node.componentPropertyDefinitions;
      }
    }
  } catch (error) {
    console.warn('Cannot read component property definitions', error);
  }

  return {};
}

export async function getComponentPropertyMetadata(
  sourceNode: SceneNode
): Promise<ComponentPropertyMetadata> {
  const metadata: ComponentPropertyMetadata = {
    instanceProperties: {},
    mainComponentPropertyDefinitions: {},
    propertyNames: [],
  };

  try {
    if (sourceNode.type === 'INSTANCE' && sourceNode.componentProperties) {
      metadata.instanceProperties = sourceNode.componentProperties;
    }

    if (sourceNode.type === 'INSTANCE') {
      const mainComponent = await sourceNode.getMainComponentAsync();
      if (mainComponent) {
        metadata.mainComponentPropertyDefinitions =
          readComponentPropertyDefinitionsSafe(mainComponent);
      }
    }

    if (sourceNode.type === 'COMPONENT' || sourceNode.type === 'COMPONENT_SET') {
      metadata.mainComponentPropertyDefinitions = readComponentPropertyDefinitionsSafe(
        sourceNode
      );
    }

    metadata.propertyNames = Object.keys(metadata.mainComponentPropertyDefinitions);
  } catch (error) {
    console.warn('Cannot read component property metadata', error);
  }

  return metadata;
}
