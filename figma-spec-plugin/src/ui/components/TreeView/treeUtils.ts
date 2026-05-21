import type { TreeNodeData } from './treeTypes';

export type CheckedState = {
  checkedKeys: string[];
  halfCheckedKeys: string[];
};

/** Depth-first flatten of the tree into a single array. */
export function flattenTree(data: TreeNodeData[]): TreeNodeData[] {
  const out: TreeNodeData[] = [];
  for (const node of data) {
    out.push(node);
    if (node.children?.length) {
      out.push(...flattenTree(node.children));
    }
  }
  return out;
}

/** All descendant keys of a node (does not include the node itself). */
export function getDescendantKeys(node: TreeNodeData): string[] {
  const out: string[] = [];
  for (const child of node.children ?? []) {
    out.push(child.key);
    out.push(...getDescendantKeys(child));
  }
  return out;
}

/** Map from child key → parent key. Roots are absent. */
export function buildParentMap(data: TreeNodeData[]): Map<string, string> {
  const out = new Map<string, string>();
  function walk(node: TreeNodeData): void {
    for (const child of node.children ?? []) {
      out.set(child.key, node.key);
      walk(child);
    }
  }
  for (const root of data) walk(root);
  return out;
}

/** Ancestor keys (closest first) for the given node key. */
export function getAncestorKeys(key: string, data: TreeNodeData[]): string[] {
  const parents = buildParentMap(data);
  const out: string[] = [];
  let current = parents.get(key);
  while (current) {
    out.push(current);
    current = parents.get(current);
  }
  return out;
}

/** Lookup map by node key. */
export function buildKeyMap(data: TreeNodeData[]): Map<string, TreeNodeData> {
  const map = new Map<string, TreeNodeData>();
  for (const node of flattenTree(data)) map.set(node.key, node);
  return map;
}

export function findNode(key: string, data: TreeNodeData[]): TreeNodeData | undefined {
  return buildKeyMap(data).get(key);
}

/**
 * Toggle a node's checked state with full cascade:
 * - self + all enabled descendants are added / removed
 * - ancestors are updated: fully checked when all enabled children are checked,
 *   otherwise removed from the checked set.
 */
export function toggleCheck(
  data: TreeNodeData[],
  key: string,
  checked: boolean,
  currentCheckedKeys: string[]
): string[] {
  const keyMap = buildKeyMap(data);
  const parentMap = buildParentMap(data);
  const node = keyMap.get(key);
  if (!node) return currentCheckedKeys;

  const next = new Set(currentCheckedKeys);

  const cascade = [key, ...getDescendantKeys(node)];
  for (const k of cascade) {
    const target = keyMap.get(k);
    if (target?.disabled) continue;
    if (checked) next.add(k);
    else next.delete(k);
  }

  let parentKey = parentMap.get(key);
  while (parentKey) {
    const parent = keyMap.get(parentKey);
    if (!parent) break;
    const children = parent.children ?? [];
    const enabledChildren = children.filter((c) => !c.disabled);
    const allChecked =
      enabledChildren.length > 0 && enabledChildren.every((c) => next.has(c.key));

    if (!parent.disabled) {
      if (allChecked) next.add(parentKey);
      else next.delete(parentKey);
    }

    parentKey = parentMap.get(parentKey);
  }

  return Array.from(next);
}

/**
 * Derive `halfCheckedKeys` for the supplied checkedKeys.
 * A node is half-checked when some (but not all) of its descendant leaves are checked.
 */
export function calculateCheckedState(
  data: TreeNodeData[],
  checkedKeys: string[]
): CheckedState {
  const inputSet = new Set(checkedKeys);
  const half = new Set<string>();

  function visit(node: TreeNodeData): { allChecked: boolean; anyChecked: boolean } {
    const children = node.children ?? [];
    const selfChecked = inputSet.has(node.key);
    if (children.length === 0) {
      return { allChecked: selfChecked, anyChecked: selfChecked };
    }
    let all = true;
    let any = false;
    for (const c of children) {
      const r = visit(c);
      if (!r.allChecked) all = false;
      if (r.anyChecked) any = true;
    }
    if (!all && (any || selfChecked)) {
      half.add(node.key);
    }
    return { allChecked: all, anyChecked: any || selfChecked };
  }

  for (const root of data) visit(root);

  return {
    checkedKeys: Array.from(inputSet),
    halfCheckedKeys: Array.from(half),
  };
}
