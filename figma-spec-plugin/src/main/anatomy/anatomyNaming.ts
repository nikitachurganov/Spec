/// <reference types="@figma/plugin-typings" />

import type { AnatomyItem, ComponentPropertyMetadata } from './anatomyTypes';

const STATE_VARIANT_KEYS = [
  'State',
  'state',
  'Состояние',
  'status',
  'Status',
  'Variant',
  'variant',
];
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
  { pattern: /\b(destructive|danger)\b/i, label: 'Destructive' },
  { pattern: /\bdefault\b/i, label: 'Default' },
  { pattern: /\bfocused\b/i, label: 'Focused' },
];

const STATE_SUFFIX_WORDS =
  'default|selected|active|disabled|hover|pressed|focused|error|expanded|collapsed|current|destructive|danger';

/** Action keywords: maps regex to canonical action label. */
const ACTION_NAME_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  {
    pattern: /\b(delete|remove|trash|bin|удалить|удаление|корзина)\b/i,
    label: 'Delete',
  },
  { pattern: /\b(edit|pencil|редактировать)\b/i, label: 'Edit' },
  { pattern: /\b(add|plus|create|добавить)\b/i, label: 'Add' },
  { pattern: /\b(close|cross|dismiss|закрыть)\b/i, label: 'Close' },
  { pattern: /\b(search|поиск)\b/i, label: 'Search' },
  { pattern: /\b(more|kebab|dots)\b/i, label: 'More' },
];

const DESTRUCTIVE_NAME_PATTERN =
  /\b(delete|remove|trash|bin|danger|destructive|удалить|удаление|корзина)\b/i;

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

function normalizeStateValueLabel(raw: string): string {
  const v = String(raw || '').trim().toLowerCase();
  if (!v) return 'Default';
  if (/(destructive|danger|delete|remove)/.test(v)) return 'Destructive';
  if (/selected/.test(v)) return 'Selected';
  if (/current/.test(v)) return 'Current';
  if (/active/.test(v)) return 'Active';
  if (/disabled/.test(v)) return 'Disabled';
  if (/hover/.test(v)) return 'Hover';
  if (/pressed/.test(v)) return 'Pressed';
  if (/focused/.test(v)) return 'Focused';
  if (/expanded/.test(v)) return 'Expanded';
  if (/collapsed/.test(v)) return 'Collapsed';
  if (/error/.test(v)) return 'Error';
  return formatStateLabel(raw);
}

export function extractStateName(node: SceneNode): string | null {
  if (node.type === 'INSTANCE' && node.variantProperties) {
    for (const key of STATE_VARIANT_KEYS) {
      if (key in node.variantProperties) {
        const value = node.variantProperties[key];
        if (typeof value === 'string' && value.trim()) {
          return normalizeStateValueLabel(value);
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
        lower.includes('disabled') ||
        lower.includes('destructive') ||
        lower.includes('danger')
      ) {
        if (entry.value === true) {
          if (lower.includes('destructive') || lower.includes('danger')) return 'Destructive';
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

/**
 * Detects a semantic action role for the node from layer name, main component name,
 * variant properties, and component property values.
 * Returns 'Delete' | 'Edit' | 'Add' | 'Close' | 'Search' | 'More' or null.
 */
export function detectAnatomyAction(node: SceneNode): string | null {
  const names: string[] = [];
  names.push(String(node.name || ''));

  if (node.type === 'INSTANCE') {
    const inst = node as InstanceNode;
    try {
      const main = inst.mainComponent;
      if (main && main.name) names.push(String(main.name));
      if (main && main.parent && 'name' in main.parent && main.parent.name) {
        names.push(String(main.parent.name));
      }
    } catch (_err) {
      // mainComponent may be unavailable in async dynamic-page mode; safely ignore.
    }

    if (inst.variantProperties) {
      for (const key of Object.keys(inst.variantProperties)) {
        const val = inst.variantProperties[key];
        if (typeof val === 'string') names.push(`${key}=${val}`);
      }
    }

    if (inst.componentProperties) {
      const props = inst.componentProperties;
      for (const key of Object.keys(props)) {
        const lower = key.toLowerCase();
        const entry = props[key];
        if (!entry) continue;
        if (entry.type === 'BOOLEAN' && entry.value === true) {
          if (lower.includes('delete') || lower.includes('remove') || lower.includes('trash')) {
            return 'Delete';
          }
          if (lower.includes('destructive') || lower.includes('danger')) {
            return 'Delete';
          }
          if (lower.includes('edit')) return 'Edit';
          if (lower.includes('add')) return 'Add';
          if (lower.includes('close') || lower.includes('dismiss')) return 'Close';
          if (lower.includes('search')) return 'Search';
        }
        if (entry.type === 'TEXT' && typeof entry.value === 'string') {
          names.push(`${key}=${entry.value}`);
        }
        if (entry.type === 'VARIANT' && typeof entry.value === 'string') {
          names.push(`${key}=${entry.value}`);
        }
      }
    }
  }

  const haystack = names.join(' ').toLowerCase();
  for (const { pattern, label } of ACTION_NAME_PATTERNS) {
    if (pattern.test(haystack)) {
      return label;
    }
  }
  return null;
}

/**
 * True if the node represents a destructive/danger/delete case.
 * Covers layer name, main component name, variant/component properties.
 */
export function isDestructiveNode(node: SceneNode): boolean {
  const name = String(node.name || '');
  if (DESTRUCTIVE_NAME_PATTERN.test(name)) return true;

  if (node.type === 'INSTANCE') {
    const inst = node as InstanceNode;
    try {
      const main = inst.mainComponent;
      const mainName = main?.name || '';
      if (mainName && DESTRUCTIVE_NAME_PATTERN.test(mainName)) return true;
      const setName = main?.parent && 'name' in main.parent ? String(main.parent.name) : '';
      if (setName && DESTRUCTIVE_NAME_PATTERN.test(setName)) return true;
    } catch (_err) {
      // ignore main component access errors
    }

    if (inst.variantProperties) {
      for (const key of Object.keys(inst.variantProperties)) {
        const val = inst.variantProperties[key];
        if (typeof val === 'string' && /(destructive|danger|delete|remove)/i.test(val)) {
          return true;
        }
      }
    }

    if (inst.componentProperties) {
      const props = inst.componentProperties;
      for (const key of Object.keys(props)) {
        const lower = key.toLowerCase();
        const entry = props[key];
        if (!entry) continue;
        if (
          entry.type === 'BOOLEAN' &&
          entry.value === true &&
          (lower.includes('destructive') ||
            lower.includes('danger') ||
            lower.includes('delete') ||
            lower.includes('remove'))
        ) {
          return true;
        }
        if (
          (entry.type === 'TEXT' || entry.type === 'VARIANT') &&
          typeof entry.value === 'string' &&
          /(destructive|danger|delete|remove)/i.test(entry.value)
        ) {
          return true;
        }
      }
    }
  }

  return false;
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
