/// <reference types="@figma/plugin-typings" />

import type { AnatomyItem, ComponentPropertyMetadata } from './anatomyTypes';

const STATE_VARIANT_KEYS = ['State', 'state', 'Состояние', 'status', 'Status'];
const STATE_NAME_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bselected\b/i, label: 'Selected' },
  { pattern: /\bactive\b/i, label: 'Active' },
  { pattern: /\bcurrent\b/i, label: 'Current' },
  { pattern: /\bdisabled\b/i, label: 'Disabled' },
  { pattern: /\bhover\b/i, label: 'Hover' },
  { pattern: /\bpressed\b/i, label: 'Pressed' },
  { pattern: /\bexpanded\b/i, label: 'Expanded' },
  { pattern: /\bcollapsed\b/i, label: 'Collapsed' },
  { pattern: /\berror\b/i, label: 'Error' },
  { pattern: /\bdefault\b/i, label: 'Default' },
  { pattern: /\bfocused\b/i, label: 'Focused' },
];

const STATE_SUFFIX_WORDS =
  'default|selected|active|disabled|hover|pressed|focused|error|expanded|collapsed|current';

const GENERIC_CONTAINER_NAMES = new Set(
  [
    'auto layout',
    'frame',
    'wrapper',
    'container',
    'group',
    'layer',
    'item container',
    'content wrapper',
    'layout',
    'main',
    'center',
  ].map((n) => n.toLowerCase())
);

const MEANINGFUL_CONTAINER_HINTS = [
  'nested menu',
  'menu item',
  'menu group',
  'menu list',
  'header',
  'footer',
  'list',
  'actions',
  'section',
  'content',
  'description',
  'divider',
  'badge',
  'tag',
  'icon',
  'chevron',
  'sidebar',
  'toolbar',
  'navigation',
  'nested',
];

export function normalizeName(name: string): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

export function cleanDisplayName(name: string): string {
  return String(name || '')
    .replace(/#\d+:\d+/g, '')
    .replace(/[#!]$/g, '')
    .replace(/<-\s*/g, '')
    .replace(/\s*->/g, '')
    .replace(/^\s*(←|‹|«|→|›|»)\s*/g, '')
    .replace(/\s*(←|‹|«|→|›|»)\s*$/g, '')
    .replace(/^\s*[-–—]+\s*/g, '')
    .replace(/\s*[-–—]+\s*$/g, '')
    .replace(/^[.\-_/|\\|\s]+/g, '')
    .replace(/[.\-_/|\\|\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatStateLabel(raw: string): string {
  const cleaned = cleanDisplayName(raw);
  if (!cleaned) return 'Default';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function extractStateName(node: SceneNode): string | null {
  if (node.type === 'INSTANCE' && node.variantProperties) {
    for (const key of STATE_VARIANT_KEYS) {
      if (key in node.variantProperties) {
        const value = node.variantProperties[key];
        if (typeof value === 'string' && value.trim()) {
          return formatStateLabel(value);
        }
      }
    }
  }

  if (node.type === 'INSTANCE' && node.componentProperties) {
    const props = node.componentProperties;
    for (const key of Object.keys(props)) {
      const lower = key.toLowerCase();
      const entry = props[key];
      if (!entry || entry.type !== 'BOOLEAN') continue;
      if (
        lower.includes('selected') ||
        lower.includes('active') ||
        lower.includes('checked') ||
        lower.includes('current') ||
        lower.includes('expanded') ||
        lower.includes('disabled')
      ) {
        if (entry.value === true) {
          if (lower.includes('selected')) return 'Selected';
          if (lower.includes('disabled')) return 'Disabled';
          if (lower.includes('expanded')) return 'Expanded';
          if (lower.includes('active')) return 'Active';
          if (lower.includes('checked')) return 'Selected';
          return 'Active';
        }
      }
    }
  }

  const rawName = String(node.name || '');
  for (const { pattern, label } of STATE_NAME_PATTERNS) {
    if (pattern.test(rawName)) {
      return label;
    }
  }

  return null;
}

function stripStateFromName(name: string, stateName: string | null): string {
  let result = cleanDisplayName(name);
  if (!result) return result;

  const suffixPattern = new RegExp(
    `(\\s*[/\\-–—]\\s*(${STATE_SUFFIX_WORDS})|\\s+(${STATE_SUFFIX_WORDS}))\\s*$`,
    'i'
  );
  result = result.replace(suffixPattern, '').trim();

  if (stateName) {
    const statePattern = new RegExp(`\\b${stateName}\\b`, 'i');
    result = result.replace(statePattern, '').replace(/\s+/g, ' ').trim();
  }

  return result;
}

export function isGenericContainerName(name: string): boolean {
  const n = normalizeName(name);
  if (!n) return true;
  if (GENERIC_CONTAINER_NAMES.has(n)) return true;
  if (n === 'text' || n === 'body container') return true;
  return false;
}

export function isMeaningfulContainerName(name: string): boolean {
  const n = normalizeName(name);
  if (!n || isGenericContainerName(name)) return false;
  return MEANINGFUL_CONTAINER_HINTS.some((hint) => n.includes(hint));
}

export type NamingContext = {
  componentPropertyMetadata?: ComponentPropertyMetadata;
  anatomyRootNodeForNames?: SceneNode;
  useComponentPropertyNames?: boolean;
};

export function getDisplayAnatomyName(
  node: SceneNode,
  context: NamingContext
): string {
  if (context.useComponentPropertyNames !== false && context.componentPropertyMetadata) {
    const propertyName = findBestComponentPropertyName(
      node,
      context.componentPropertyMetadata,
      context.anatomyRootNodeForNames
    );
    if (propertyName) return propertyName;
  }

  const cleaned = cleanDisplayName(node.name || '');
  if (cleaned) return cleaned;
  if (node.type === 'TEXT') return 'Text';
  if (node.type === 'INSTANCE') return 'Component';
  if (node.type === 'LINE') return 'Divider';
  return 'Element';
}

export function getBaseDisplayName(node: SceneNode, context: NamingContext): string {
  const display = getDisplayAnatomyName(node, context);
  const state = extractStateName(node);
  const base = stripStateFromName(display, state);
  return base || display || 'Element';
}

function normalizePropertyName(name: string): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[#!]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function getNodeNamePath(node: SceneNode, rootLimit?: SceneNode): string[] {
  const names: string[] = [];
  let current: BaseNode | null = node;
  while (current && current !== rootLimit) {
    if ('name' in current && current.name) {
      names.unshift(current.name);
    }
    current = current.parent;
  }
  return names;
}

function getBooleanPropertyNames(metadata: ComponentPropertyMetadata): string[] {
  const definitions = metadata.mainComponentPropertyDefinitions || {};
  return Object.keys(definitions).filter((key) => definitions[key]?.type === 'BOOLEAN');
}

function getDirectComponentPropertyName(node: SceneNode): string | null {
  try {
    if ('componentPropertyReferences' in node && node.componentPropertyReferences) {
      const refs = node.componentPropertyReferences;
      for (const key of Object.keys(refs)) {
        const value = refs[key as keyof typeof refs];
        if (value) return cleanDisplayName(String(value));
      }
    }
  } catch (error) {
    console.warn('Cannot read direct component property reference for node', error);
  }
  return null;
}

function findBestComponentPropertyName(
  node: SceneNode,
  metadata: ComponentPropertyMetadata,
  rootLimit?: SceneNode
): string | null {
  const direct = getDirectComponentPropertyName(node);
  if (direct) return direct;

  const booleanNames = getBooleanPropertyNames(metadata);
  if (!booleanNames.length) return null;

  if (rootLimit) {
    const pathSegments = getNodeNamePath(node, rootLimit).map(normalizePropertyName);
    for (const propName of booleanNames) {
      if (pathSegments.includes(normalizePropertyName(propName))) {
        return cleanDisplayName(propName);
      }
    }
  }

  const nodeName = normalizePropertyName(node.name || '');
  const genericLayerNames = ['label', 'text', 'icon', 'description', 'body', 'content'];
  const isGeneric = genericLayerNames.includes(nodeName);

  let byName: string | null = null;
  for (const propName of booleanNames) {
    const normalizedProperty = normalizePropertyName(propName);
    if (normalizedProperty.includes(nodeName) && nodeName.length > 2) {
      byName = propName;
      break;
    }
  }

  if (byName && isGeneric) return cleanDisplayName(byName);

  if (isGeneric) {
    const semanticCandidates = booleanNames.filter((propName) => {
      const np = normalizePropertyName(propName);
      return (
        np.includes('top') ||
        np.includes('bottom') ||
        np.includes('left') ||
        np.includes('right') ||
        np.includes('description') ||
        np.includes('icon') ||
        np.includes('label')
      );
    });
    if (semanticCandidates.length === 1) {
      return cleanDisplayName(semanticCandidates[0]);
    }
  }

  return null;
}

export function buildFinalLabel(
  baseName: string,
  stateName?: string,
  parentContextName?: string
): string {
  const statePart = stateName ? ` — ${stateName}` : '';
  if (parentContextName) {
    return `${parentContextName} / ${baseName}${statePart}`;
  }
  return `${baseName}${statePart}`;
}

export function disambiguateAnatomyItems(items: AnatomyItem[]): AnatomyItem[] {
  const byBase = new Map<string, AnatomyItem[]>();

  for (const item of items) {
    const group = byBase.get(item.baseName) || [];
    group.push(item);
    byBase.set(item.baseName, group);
  }

  for (const group of byBase.values()) {
    if (group.length === 1) {
      group[0].finalLabel = group[0].baseName;
      group[0].name = group[0].finalLabel;
      continue;
    }

    const states = new Set(group.map((item) => item.stateName || ''));
    const hasDistinctStates = states.size > 1;

    for (const item of group) {
      if (hasDistinctStates) {
        item.finalLabel = buildFinalLabel(item.baseName, item.stateName || 'Default');
      } else if (item.parentContextName) {
        item.finalLabel = buildFinalLabel(
          item.baseName,
          item.stateName || 'Default',
          item.parentContextName
        );
      } else if (item.stateName) {
        item.finalLabel = buildFinalLabel(item.baseName, item.stateName);
      } else {
        item.finalLabel = item.baseName;
      }
      item.name = item.finalLabel;
    }

    const labelBuckets = new Map<string, AnatomyItem[]>();
    for (const item of group) {
      const bucket = labelBuckets.get(item.finalLabel) || [];
      bucket.push(item);
      labelBuckets.set(item.finalLabel, bucket);
    }

    for (const bucket of labelBuckets.values()) {
      if (bucket.length <= 1) continue;
      bucket.forEach((item, index) => {
        item.finalLabel = `${item.finalLabel} ${index + 1}`;
        item.name = item.finalLabel;
      });
    }
  }

  return items.slice().sort((a, b) => (a.markerIndex ?? 0) - (b.markerIndex ?? 0));
}

export function findParentContextName(
  node: SceneNode,
  rootNode: SceneNode,
  context: NamingContext
): string | undefined {
  let current: BaseNode | null = node.parent;

  while (current && current.id !== rootNode.id) {
    if (current.type === 'PAGE' || current.type === 'DOCUMENT') break;

    const parent = current as SceneNode;
    const parentBase = getBaseDisplayName(parent, context);
    const itemBase = getBaseDisplayName(node, context);

    if (parentBase && parentBase !== itemBase) {
      if (isMeaningfulContainerName(parent.name || '')) {
        return parentBase;
      }

      if (
        parent.type === 'INSTANCE' ||
        parent.type === 'COMPONENT' ||
        parent.type === 'COMPONENT_SET'
      ) {
        if (!isGenericContainerName(parent.name || '')) {
          return parentBase;
        }
        return undefined;
      }

      if (!isGenericContainerName(parent.name || '') && parent.type === 'FRAME') {
        return parentBase;
      }
    }

    current = parent.parent;
  }

  return undefined;
}
