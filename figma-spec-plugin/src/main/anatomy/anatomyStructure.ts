/// <reference types="@figma/plugin-typings" />

import {
  getAnatomyWalkRole,
  getRelativeBounds,
  shouldConsiderNode,
} from './anatomyDecomposition';
import type { AnatomyGeneratorOptions } from './anatomyTypes';
import { mergeAnatomyOptions } from './anatomyStyles';
import type {
  AnatomyGroupDirection,
  AnatomyLayoutItem,
  Bounds,
} from './anatomyLayoutTypes';

const DEFAULT_OPTIONS = mergeAnatomyOptions();

function hasChildren(node: SceneNode): node is SceneNode & ChildrenMixin {
  return 'children' in node && Array.isArray(node.children);
}

function normalizeName(name: string): string {
  return String(name || '').toLowerCase().trim();
}

function isTextNode(node: SceneNode): node is TextNode {
  return node.type === 'TEXT';
}

function hasMeaningfulText(node: SceneNode): boolean {
  if (isTextNode(node)) {
    return node.characters.trim().length > 0;
  }
  if (!hasChildren(node)) {
    return false;
  }
  return node.children.some((child) => isTextNode(child as SceneNode));
}

function isControlLikeNode(node: SceneNode): boolean {
  const typeMatch =
    node.type === 'INSTANCE' ||
    node.type === 'COMPONENT' ||
    node.type === 'COMPONENT_SET';
  if (typeMatch) {
    return true;
  }
  const name = normalizeName(node.name);
  if (
    /button|chip|tab|switch|checkbox|radio|input|field|segmented|control|pagination|page|next|prev|icon|avatar|badge|tag/.test(
      name
    )
  ) {
    return true;
  }
  return 'reactions' in node && Array.isArray(node.reactions) && node.reactions.length > 0;
}

function isDecorativeShape(node: SceneNode): boolean {
  const name = normalizeName(node.name);
  if (node.type === 'LINE') {
    return true;
  }
  const isShape =
    node.type === 'RECTANGLE' ||
    node.type === 'VECTOR' ||
    node.type === 'ELLIPSE' ||
    node.type === 'POLYGON' ||
    node.type === 'STAR';
  if (!isShape) {
    return false;
  }
  if (/divider|underline|border|shadow|background|bg|stroke|line|spacer/.test(name)) {
    return true;
  }
  if ('fills' in node && Array.isArray(node.fills) && node.fills.length === 0) {
    return true;
  }
  return false;
}

function isSingleChildWrapper(node: SceneNode): boolean {
  if (!hasChildren(node)) {
    return false;
  }
  return node.children.length === 1 && !hasMeaningfulText(node) && !isControlLikeNode(node);
}

function isComponentTerminalNode(node: SceneNode): boolean {
  return (
    node.type === 'INSTANCE' ||
    node.type === 'COMPONENT' ||
    node.type === 'COMPONENT_SET'
  );
}

export function areBoundsAlmostEqual(a: Bounds, b: Bounds, tolerance = 2): boolean {
  return (
    Math.abs(a.x - b.x) <= tolerance &&
    Math.abs(a.y - b.y) <= tolerance &&
    Math.abs(a.width - b.width) <= tolerance &&
    Math.abs(a.height - b.height) <= tolerance
  );
}

export function isRedundantNestedTarget(params: {
  nodeBounds: Bounds;
  parentBounds: Bounds;
  node: SceneNode;
  parent: SceneNode;
}): boolean {
  const { nodeBounds, parentBounds, node } = params;
  if (areBoundsAlmostEqual(nodeBounds, parentBounds)) {
    return true;
  }
  if ((nodeBounds.height <= 4 || nodeBounds.width <= 4) && !isControlLikeNode(node)) {
    return true;
  }
  if (isDecorativeShape(node)) {
    return true;
  }
  if (isSingleChildWrapper(node)) {
    return true;
  }
  return false;
}

export function getNodeBounds(node: SceneNode, rootNode: SceneNode): Bounds | null {
  if (typeof node.width !== 'number' || typeof node.height !== 'number') {
    return null;
  }
  const bounds = getRelativeBounds(node, rootNode);
  if (!Number.isFinite(bounds.width) || !Number.isFinite(bounds.height)) {
    return null;
  }
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  };
}

/**
 * Geometry + naming rules for anatomy targets (no hardcoded component names).
 * Excludes padding/gap overlays, anatomy layers, and invisible nodes via shouldConsiderNode.
 */
export function isMeaningfulAnatomyTarget(
  node: SceneNode,
  rootNode: SceneNode,
  options: AnatomyGeneratorOptions = DEFAULT_OPTIONS
): boolean {
  if (!shouldConsiderNode(node, options)) {
    return false;
  }
  if (node === rootNode) {
    return false;
  }

  const role = getAnatomyWalkRole(node, rootNode);
  if (role === 'atomic' || role === 'meaningful-container') {
    return true;
  }

  if (role === 'container' && hasChildren(node)) {
    return node.children.some((child) =>
      isMeaningfulAnatomyTarget(child as SceneNode, rootNode, options)
    );
  }

  return false;
}

export function getChildrenOrderDirection(node: SceneNode): AnatomyGroupDirection {
  if ('layoutMode' in node) {
    if (node.layoutMode === 'HORIZONTAL') {
      return 'horizontal';
    }
    if (node.layoutMode === 'VERTICAL') {
      return 'vertical';
    }
  }
  return 'unknown';
}

export function sortNodesForNumbering(
  nodes: SceneNode[],
  parentDirection: AnatomyGroupDirection,
  rootNode: SceneNode
): SceneNode[] {
  return [...nodes].sort((a, b) => {
    const aBounds = getNodeBounds(a, rootNode) ?? { x: 0, y: 0, width: 0, height: 0 };
    const bBounds = getNodeBounds(b, rootNode) ?? { x: 0, y: 0, width: 0, height: 0 };

    if (parentDirection === 'horizontal') {
      const xCmp = aBounds.x - bBounds.x;
      if (Math.abs(xCmp) > 1) return xCmp;
      return aBounds.y - bBounds.y;
    }

    const yCmp = aBounds.y - bBounds.y;
    if (Math.abs(yCmp) > 1) return yCmp;
    return aBounds.x - bBounds.x;
  });
}

export function getNestedMeaningfulChildren(
  parent: SceneNode,
  rootNode: SceneNode,
  options: AnatomyGeneratorOptions = DEFAULT_OPTIONS
): SceneNode[] {
  if (!hasChildren(parent)) {
    return [];
  }

  const parentBounds = getNodeBounds(parent, rootNode);
  if (!parentBounds) {
    return [];
  }

  const nested = parent.children.filter((child) => {
    const sceneChild = child as SceneNode;
    if (!isMeaningfulAnatomyTarget(sceneChild, rootNode, options)) {
      return false;
    }
    const childBounds = getNodeBounds(sceneChild, rootNode);
    if (!childBounds) {
      return false;
    }
    if (
      !(
        isControlLikeNode(sceneChild) ||
        hasMeaningfulText(sceneChild) ||
        getChildrenOrderDirection(parent) === 'horizontal'
      )
    ) {
      return false;
    }
    return !isRedundantNestedTarget({
      nodeBounds: childBounds,
      parentBounds,
      node: sceneChild,
      parent,
    });
  }) as SceneNode[];

  return sortNodesForNumbering(
    nested,
    getChildrenOrderDirection(parent),
    rootNode
  );
}

function boundsKey(bounds: Bounds): string {
  return [
    Math.round(bounds.x / 2),
    Math.round(bounds.y / 2),
    Math.round(bounds.width / 2),
    Math.round(bounds.height / 2),
  ].join(':');
}

function normalizeIndexes(items: AnatomyLayoutItem[]): AnatomyLayoutItem[] {
  const normalized: AnatomyLayoutItem[] = [];
  const roots = items.filter((item) => item.level === 'root');

  roots.forEach((rootItem, rootIdx) => {
    const nextRootIndex = String(rootIdx + 1);
    normalized.push({ ...rootItem, index: nextRootIndex, parentIndex: null });
    const nested = items.filter(
      (item) => item.level === 'child' && item.parentIndex === rootItem.index
    );
    nested.forEach((childItem, childIdx) => {
      normalized.push({
        ...childItem,
        index: `${nextRootIndex}.${childIdx + 1}`,
        parentIndex: nextRootIndex,
      });
    });
  });

  return normalized.map((item, idx) => ({ ...item, order: idx }));
}

export function dedupeAnatomyItems(items: AnatomyLayoutItem[]): AnatomyLayoutItem[] {
  if (items.length <= 1) {
    return items;
  }

  const byBounds = new Map<string, AnatomyLayoutItem[]>();
  for (const item of items) {
    const key = boundsKey(item.targetBounds);
    const list = byBounds.get(key) ?? [];
    list.push(item);
    byBounds.set(key, list);
  }

  const keepIds = new Set<string>();
  for (const item of items) {
    const siblings = byBounds.get(boundsKey(item.targetBounds)) ?? [item];
    const best = siblings.sort((a, b) => {
      if (a.level !== b.level) {
        return a.level === 'root' ? -1 : 1;
      }
      return a.order - b.order;
    })[0];
    keepIds.add(best.id);
  }

  const filtered = items.filter((item) => keepIds.has(item.id));
  const deduped = filtered.filter((item) => {
    if (item.level !== 'child' || !item.parentIndex) {
      return true;
    }
    const parent = filtered.find((candidate) => candidate.index === item.parentIndex);
    if (!parent) {
      return true;
    }
    return !areBoundsAlmostEqual(item.targetBounds, parent.targetBounds);
  });

  return normalizeIndexes(deduped);
}

export function createTopLevelAnatomyItem(
  node: SceneNode,
  index: number,
  order: number,
  rootNode: SceneNode
): AnatomyLayoutItem {
  const targetBounds = getNodeBounds(node, rootNode);
  if (!targetBounds) {
    throw new Error(`Unable to compute bounds for anatomy target "${node.name}".`);
  }
  return {
    id: node.id,
    nodeId: node.id,
    index: String(index),
    level: 'root',
    parentIndex: null,
    targetBounds,
    targetName: node.name || undefined,
    order,
    isNestedItem: false,
  };
}

export function createNestedAnatomyItem(
  node: SceneNode,
  parentIndex: string,
  childIndex: number,
  order: number,
  rootNode: SceneNode,
  groupId: string,
  groupDirection: AnatomyGroupDirection
): AnatomyLayoutItem {
  const targetBounds = getNodeBounds(node, rootNode);
  if (!targetBounds) {
    throw new Error(`Unable to compute bounds for anatomy target "${node.name}".`);
  }
  return {
    id: node.id,
    nodeId: node.id,
    index: `${parentIndex}.${childIndex}`,
    level: 'child',
    parentIndex,
    targetBounds,
    targetName: node.name || undefined,
    groupId,
    groupDirection,
    order,
    isNestedItem: true,
  };
}

export function collectAnatomyStructure(
  selectedNode: SceneNode,
  options: AnatomyGeneratorOptions = DEFAULT_OPTIONS
): AnatomyLayoutItem[] {
  return buildAnatomySequence(selectedNode, options);
}

export function collectAnatomyTargets(
  selectedNode: SceneNode,
  options: AnatomyGeneratorOptions = DEFAULT_OPTIONS
): AnatomyLayoutItem[] {
  return buildAnatomySequence(selectedNode, options);
}

function shouldKeepNodeAsTraceTarget(
  node: SceneNode,
  parent: SceneNode,
  rootNode: SceneNode,
  options: AnatomyGeneratorOptions
): boolean {
  if (!isMeaningfulAnatomyTarget(node, rootNode, options)) {
    return false;
  }
  const nodeBounds = getNodeBounds(node, rootNode);
  const parentBounds = getNodeBounds(parent, rootNode);
  if (!nodeBounds || !parentBounds) {
    return false;
  }
  return !isRedundantNestedTarget({
    nodeBounds,
    parentBounds,
    node,
    parent,
  });
}

function collectTraceTargetsFromContainer(
  container: SceneNode,
  rootNode: SceneNode,
  options: AnatomyGeneratorOptions
): SceneNode[] {
  if (!hasChildren(container)) {
    return [];
  }

  const orderedChildren = sortNodesForNumbering(
    container.children as SceneNode[],
    getChildrenOrderDirection(container),
    rootNode
  );
  const targets: SceneNode[] = [];

  for (const child of orderedChildren) {
    if (!shouldConsiderNode(child, options)) {
      continue;
    }

    if (isComponentTerminalNode(child)) {
      if (shouldKeepNodeAsTraceTarget(child, container, rootNode, options)) {
        targets.push(child);
      }
      continue;
    }

    const nested = collectTraceTargetsFromContainer(child, rootNode, options);
    if (nested.length > 0) {
      targets.push(...nested);
      continue;
    }

    if (shouldKeepNodeAsTraceTarget(child, container, rootNode, options)) {
      targets.push(child);
    }
  }

  return targets;
}

function collectFirstLevelTraceTargets(
  selectedNode: SceneNode,
  options: AnatomyGeneratorOptions
): SceneNode[] {
  if (!hasChildren(selectedNode)) {
    return [];
  }
  const firstLevel = sortNodesForNumbering(
    selectedNode.children as SceneNode[],
    getChildrenOrderDirection(selectedNode),
    selectedNode
  );
  const targets: SceneNode[] = [];

  for (const topNode of firstLevel) {
    if (!shouldConsiderNode(topNode, options)) {
      continue;
    }

    // First-level component-like nodes are terminal by rule (component-only).
    if (isComponentTerminalNode(topNode)) {
      if (isMeaningfulAnatomyTarget(topNode, selectedNode, options)) {
        targets.push(topNode);
      }
      continue;
    }

    // Non-component first-level nodes are decomposed by trace.
    const traced = collectTraceTargetsFromContainer(topNode, selectedNode, options);
    if (traced.length > 0) {
      targets.push(...traced);
      continue;
    }

    if (isMeaningfulAnatomyTarget(topNode, selectedNode, options)) {
      targets.push(topNode);
    }
  }

  return targets;
}

export function buildAnatomySequence(
  selectedNode: SceneNode,
  options: AnatomyGeneratorOptions = DEFAULT_OPTIONS
): AnatomyLayoutItem[] {
  if (!hasChildren(selectedNode)) {
    return [];
  }

  const collected = collectFirstLevelTraceTargets(selectedNode, options);

  const items: AnatomyLayoutItem[] = [];
  let order = 0;

  for (let i = 0; i < collected.length; i += 1) {
    const topNode = collected[i];
    const topIndex = i + 1;
    items.push(createTopLevelAnatomyItem(topNode, topIndex, order, selectedNode));
    order += 1;
  }

  return dedupeAnatomyItems(items);
}
