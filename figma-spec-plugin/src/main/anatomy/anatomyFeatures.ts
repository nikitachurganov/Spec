/// <reference types="@figma/plugin-typings" />

import type {
  AnatomyEntityKind,
  AnatomyFeature,
  AnatomyRole,
  SlotPosition,
} from './anatomyTypes';
import { cleanDisplayName, normalizeName } from './anatomyNaming';

function includesAny(value: string, patterns: string[]): boolean {
  return patterns.some((p) => value.includes(p));
}

function hasMenuItemChildren(node: SceneNode): boolean {
  if (!('children' in node) || !node.children.length) return false;
  for (const child of node.children) {
    const name = normalizeName(child.name || '');
    if (name.includes('menu item')) return true;
  }
  return false;
}

export function detectAnatomyFeatures(node: SceneNode): AnatomyFeature[] {
  const features = new Set<AnatomyFeature>();
  const name = normalizeName(node.name || '');

  if (
    includesAny(name, ['icon', 'икон', 'glyph', 'leading icon', 'trailing icon', 'ic_']) ||
    ((node.type === 'INSTANCE' || node.type === 'COMPONENT') && name.includes('icon'))
  ) {
    features.add('icon');
  }

  if (includesAny(name, ['tag', 'wobbler', 'pill'])) {
    features.add('tag');
  }

  if (includesAny(name, ['badge', 'status'])) {
    features.add('badge');
  }

  if (includesAny(name, ['counter'])) {
    features.add('counter');
  }

  if (
    node.type === 'LINE' ||
    includesAny(name, ['divider', 'separator', 'line', 'разделитель', 'линия'])
  ) {
    features.add('divider');
  }

  if (
    (node.type === 'RECTANGLE' || node.type === 'FRAME') &&
    includesAny(name, ['divider', 'separator']) &&
    (node.height <= 2 || node.width <= 2)
  ) {
    features.add('divider');
  }

  if (
    includesAny(name, ['nested menu', 'submenu', 'sub menu', 'вложенное меню']) ||
    (name.includes('nested') && name.includes('menu')) ||
    (hasMenuItemChildren(node) && name.includes('menu'))
  ) {
    features.add('nested-menu');
  }

  if (includesAny(name, ['chevron', 'arrow', 'caret', 'disclosure'])) {
    features.add('chevron');
  }

  if (
    includesAny(name, ['description', 'supporting text', 'caption', 'subtitle', 'helper'])
  ) {
    features.add('description');
  }

  if (includesAny(name, ['shortcut', 'hotkey', 'keybinding', 'kbd'])) {
    features.add('shortcut');
  }

  if (
    includesAny(name, ['selected indicator', 'active indicator', 'selection indicator', 'selection'])
  ) {
    features.add('selected-indicator');
  }

  if (includesAny(name, ['group label', 'group title'])) {
    features.add('group-label');
  }

  if (includesAny(name, ['section label', 'section title'])) {
    features.add('section-label');
  }

  return Array.from(features).sort();
}

/** @deprecated alias */
export const detectLocalAnatomyFeatures = detectAnatomyFeatures;

export function detectSlotPosition(node: SceneNode): SlotPosition {
  const name = normalizeName(node.name || '');
  if (name.includes('nested menu') || (name.includes('nested') && name.includes('chevron'))) {
    return 'nested';
  }
  if (name.includes('leading') || name.includes('left icon') || name.startsWith('icon left')) {
    return 'leading';
  }
  if (
    name.includes('trailing') ||
    name.includes('right icon') ||
    name.includes('chevron') ||
    name.includes('arrow')
  ) {
    return 'trailing';
  }
  return 'none';
}

export function detectAnatomyRole(
  node: SceneNode,
  baseName: string,
  features: AnatomyFeature[]
): AnatomyRole {
  if (features.includes('nested-menu')) return 'nested-menu';
  if (features.includes('divider')) return 'divider';
  if (features.includes('selected-indicator')) return 'selected-indicator';
  if (features.includes('group-label')) return 'group-label';
  if (features.includes('section-label')) return 'section-label';
  if (features.includes('icon')) return 'icon';
  if (features.includes('tag')) return 'tag';
  if (features.includes('badge')) return 'badge';
  if (features.includes('counter')) return 'counter';
  if (features.includes('chevron')) return 'chevron';
  if (features.includes('description')) return 'description';
  if (features.includes('shortcut')) return 'shortcut';

  const base = normalizeName(baseName);
  if (base.includes('menu item')) return 'menu-item';
  if (base.includes('nested menu')) return 'nested-menu';

  if (node.type === 'TEXT') return 'text';

  if (
    node.type === 'VECTOR' ||
    node.type === 'RECTANGLE' ||
    node.type === 'ELLIPSE' ||
    node.type === 'POLYGON' ||
    node.type === 'STAR'
  ) {
    return 'shape';
  }

  if (
    node.type === 'INSTANCE' ||
    node.type === 'COMPONENT' ||
    node.type === 'COMPONENT_SET'
  ) {
    return 'component-instance';
  }

  if ('children' in node && node.children.length > 0) return 'container';
  return 'element';
}

export function detectAnatomyEntityKind(role: AnatomyRole): AnatomyEntityKind {
  if (
    role === 'icon' ||
    role === 'badge' ||
    role === 'tag' ||
    role === 'counter' ||
    role === 'chevron' ||
    role === 'description' ||
    role === 'shortcut'
  ) {
    return 'slot';
  }

  if (role === 'divider' || role === 'group-label' || role === 'section-label') {
    return 'structure';
  }

  if (role === 'selected-indicator') {
    return 'state-indicator';
  }

  return 'container-variant';
}

const SLOT_CANONICAL: Partial<Record<AnatomyRole, string>> = {
  icon: 'Icon',
  badge: 'Badge',
  tag: 'Tag',
  counter: 'Counter',
  chevron: 'Chevron',
  description: 'Description',
  shortcut: 'Shortcut',
};

const STRUCTURE_CANONICAL: Partial<Record<AnatomyRole, string>> = {
  divider: 'Divider',
  'group-label': 'Group label',
  'section-label': 'Section label',
  'selected-indicator': 'Selected indicator',
};

export function getCanonicalAnatomyBaseName(params: {
  entityKind: AnatomyEntityKind;
  role: AnatomyRole;
  rawBaseName: string;
  slotPosition?: SlotPosition;
  parentContextName?: string;
}): string {
  const { entityKind, role, rawBaseName, slotPosition, parentContextName } = params;

  if (entityKind === 'slot') {
    const canonical = SLOT_CANONICAL[role];
    if (!canonical) return cleanDisplayName(rawBaseName) || 'Element';

    if (role === 'icon') {
      if (slotPosition === 'leading') return 'Leading icon';
      if (slotPosition === 'trailing') return 'Trailing icon';
    }

    if (role === 'chevron' && parentContextName) {
      const ctx = normalizeName(parentContextName);
      if (ctx.includes('nested menu')) return 'Nested menu chevron';
    }

    if (role === 'badge') {
      const n = normalizeName(rawBaseName);
      if (n.includes('status')) return 'Status badge';
    }

    return canonical;
  }

  if (entityKind === 'structure' || entityKind === 'state-indicator') {
    return STRUCTURE_CANONICAL[role] || cleanDisplayName(rawBaseName) || 'Element';
  }

  return cleanDisplayName(rawBaseName) || 'Element';
}
