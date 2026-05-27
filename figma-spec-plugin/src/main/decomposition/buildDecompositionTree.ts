/// <reference types="@figma/plugin-typings" />

import type { DecompositionNode, DecompositionNodeKind, DecompositionTree } from './decompositionTypes';

function normalizeName(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateTextPreview(value: string, max = 48): string {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}...`;
}

function isGenericTextLayerName(name: string): boolean {
  const normalized = normalizeName(name);
  return (
    normalized === '' ||
    normalized === 'text' ||
    normalized === 'label' ||
    normalized === 'title' ||
    normalized === 'description' ||
    normalized === 'caption' ||
    normalized === 'paragraph'
  );
}

function getTextPreview(node: SceneNode): string | undefined {
  if (node.type !== 'TEXT') return undefined;
  return truncateTextPreview(node.characters || '');
}

function getDisplayName(node: SceneNode): string {
  const baseName = String(node.name || node.type || 'Layer');
  if (node.type !== 'TEXT') return baseName;

  const preview = getTextPreview(node);
  if (!preview) return baseName;
  if (isGenericTextLayerName(baseName)) {
    return `Text - "${preview}"`;
  }
  return `${baseName} - "${preview}"`;
}

function isComponentLike(node: SceneNode): boolean {
  return node.type === 'INSTANCE' || node.type === 'COMPONENT' || node.type === 'COMPONENT_SET';
}

function isStandardLayoutContainer(node: SceneNode): boolean {
  return node.type === 'FRAME' || node.type === 'GROUP' || node.type === 'SECTION';
}

function isAutoLayoutNode(node: SceneNode): boolean {
  if (!('layoutMode' in node)) return false;
  return node.layoutMode !== 'NONE';
}

function isVisibleNode(node: SceneNode): boolean {
  return !('visible' in node) || node.visible !== false;
}

function isServiceNode(node: SceneNode): boolean {
  const name = String(node.name || '');
  if (name.startsWith('_')) return true;
  return (
    name.startsWith('Padding overlay') ||
    name.startsWith('Gap overlay') ||
    name.startsWith('Child overlay') ||
    name.startsWith('Preview /') ||
    name.startsWith('Target container outline') ||
    name.startsWith('Anatomy ')
  );
}

function guessKind(node: SceneNode, isRoot: boolean): DecompositionNodeKind {
  if (isRoot) return 'root';
  if (node.type === 'INSTANCE') return 'instance';
  if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') return 'component';
  if (node.type === 'TEXT') return 'text';

  const n = normalizeName(node.name || '');
  if (n.includes('icon')) return 'icon';
  if (n.includes('badge') || n.includes('tag')) return 'badge';
  if (n.includes('divider') || n.includes('separator') || n.includes('line')) return 'divider';
  if (
    n.includes('action') ||
    n.includes('delete') ||
    n.includes('edit') ||
    n.includes('close') ||
    n.includes('search') ||
    n.includes('button')
  ) {
    return 'action';
  }
  if (n.includes('slot') || n.includes('content') || n.includes('label')) return 'slot';
  if (isStandardLayoutContainer(node) || isAutoLayoutNode(node)) return 'container';
  return 'unknown';
}

function parseStateFromName(name: string): string | undefined {
  const n = normalizeName(name);
  if (!n) return undefined;
  if (n.includes('selected')) return 'selected';
  if (n.includes('active')) return 'active';
  if (n.includes('default')) return 'default';
  if (n.includes('disabled')) return 'disabled';
  if (n.includes('hover')) return 'hover';
  if (n.includes('focus')) return 'focus';
  return undefined;
}

function parseActionFromName(name: string): string | undefined {
  const n = normalizeName(name);
  if (n.includes('delete') || n.includes('remove')) return 'delete';
  if (n.includes('edit')) return 'edit';
  if (n.includes('add') || n.includes('create')) return 'add';
  if (n.includes('close')) return 'close';
  if (n.includes('search')) return 'search';
  if (n.includes('more')) return 'more';
  return undefined;
}

function parseSlotFromName(name: string): string | undefined {
  const n = normalizeName(name);
  if (n.includes('leading')) return 'leading';
  if (n.includes('trailing')) return 'trailing';
  if (n.includes('content')) return 'content';
  if (n.includes('label')) return 'label';
  return undefined;
}

async function getMainComponentName(
  node: SceneNode,
  cache: Map<string, string | undefined>
): Promise<string | undefined> {
  if (node.type !== 'INSTANCE') return undefined;
  if (cache.has(node.id)) return cache.get(node.id);
  try {
    const main = await node.getMainComponentAsync();
    const name = main?.name ? String(main.name) : undefined;
    cache.set(node.id, name);
    return name;
  } catch {
    cache.set(node.id, undefined);
    return undefined;
  }
}

function toVariantProperties(node: SceneNode): Record<string, string> | undefined {
  if (node.type !== 'INSTANCE' || !node.variantProperties) return undefined;
  const out: Record<string, string> = {};
  for (const key of Object.keys(node.variantProperties)) {
    const value = node.variantProperties[key];
    if (typeof value === 'string') out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function toComponentProperties(node: SceneNode): Record<string, unknown> | undefined {
  if (node.type !== 'INSTANCE' || !node.componentProperties) return undefined;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(node.componentProperties)) {
    out[key] = node.componentProperties[key];
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export async function buildDecompositionTree(root: SceneNode): Promise<DecompositionTree> {
  const nodeByPath = new Map<string, SceneNode>();
  const decompositionByPath = new Map<string, DecompositionNode>();
  const mainComponentNameCache = new Map<string, string | undefined>();

  async function walk(
    node: SceneNode,
    path: string,
    parentPath: string | null,
    depth: number
  ): Promise<DecompositionNode | null> {
    if (node !== root) {
      if (!isVisibleNode(node)) return null;
      if (isServiceNode(node)) return null;
    }

    const isRoot = path === '';
    const mainComponentName = await getMainComponentName(node, mainComponentNameCache);
    const item: DecompositionNode = {
      path,
      key: node.id,
      name: node.name || node.type,
      displayName: getDisplayName(node),
      kind: guessKind(node, isRoot),
      nodeId: node.id,
      parentPath,
      depth,
      isRoot,
      isComponentLike: isComponentLike(node),
      isStandardLayoutContainer: isStandardLayoutContainer(node),
      isAutoLayout: isAutoLayoutNode(node),
      isVisible: isVisibleNode(node),
      isText: node.type === 'TEXT',
      hasChildren: false,
      children: [],
      metadata: {
        componentName:
          node.type === 'COMPONENT' || node.type === 'COMPONENT_SET' ? String(node.name || '') : undefined,
        mainComponentName,
        variantProperties: toVariantProperties(node),
        componentProperties: toComponentProperties(node),
        state: parseStateFromName(node.name || ''),
        action: parseActionFromName(node.name || ''),
        slot: parseSlotFromName(node.name || ''),
        textPreview: getTextPreview(node),
      },
    };

    nodeByPath.set(path, node);
    decompositionByPath.set(path, item);

    if ('children' in node && node.children.length > 0) {
      const children: DecompositionNode[] = [];
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i] as SceneNode;
        const childPath = path ? `${path}/${i}` : String(i);
        const childNode = await walk(child, childPath, path, depth + 1);
        if (childNode) children.push(childNode);
      }
      item.children = children;
      item.hasChildren = children.length > 0;
    }

    return item;
  }

  const decompositionRoot = await walk(root, '', null, 0);
  if (!decompositionRoot) {
    throw new Error('[Decomposition] Failed to build root decomposition node.');
  }

  return {
    root: decompositionRoot,
    nodeByPath,
    decompositionByPath,
  };
}
