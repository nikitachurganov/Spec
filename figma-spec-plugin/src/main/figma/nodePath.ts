/// <reference types="@figma/plugin-typings" />

export function getNodePathFromRoot(
  rootNode: SceneNode,
  targetNode: SceneNode
): number[] | null {
  if (targetNode.id === rootNode.id) return [];

  const path: number[] = [];
  let current: BaseNode | null = targetNode;

  while (current && current.id !== rootNode.id) {
    const parent: (ChildrenMixin & BaseNode) | null = current.parent as
      | (ChildrenMixin & BaseNode)
      | null;
    if (!parent || !('children' in parent)) return null;

    const children = parent.children as readonly SceneNode[];
    const idx = children.findIndex((c) => c.id === current!.id);
    if (idx < 0) return null;

    path.unshift(idx);
    current = parent;
  }

  if (!current || current.id !== rootNode.id) return null;
  return path;
}

export function getNodeByPath(rootNode: SceneNode, path: number[]): SceneNode | null {
  if (!path.length) return rootNode;

  let current: SceneNode = rootNode;
  for (const index of path) {
    if (!('children' in current)) return null;
    const next = current.children[index];
    if (!next) return null;
    current = next;
  }
  return current;
}
