/// <reference types="@figma/plugin-typings" />

import { normalizeContainerPropertyKey } from '../spec/containerCardPropertyIcons';
import type { SpecIconName } from './iconRegistry';

export type PropertyIconContext = {
  /** Отображаемое значение Direction, например `Vertical` / `Horizontal`. */
  direction?: string;
};

export function normalizePropertyName(name: string): string {
  return String(name || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function normalizeAlignmentDisplay(display: string): string {
  return String(display || '')
    .trim()
    .toLowerCase()
    .replace(/[—–]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseLayoutDirection(dir?: string): 'vertical' | 'horizontal' | null {
  const s = normalizeAlignmentDisplay(dir || '');
  if (s.includes('vertical')) return 'vertical';
  if (s.includes('horizontal')) return 'horizontal';
  return null;
}

function directionIconsFromDisplay(valueDisplay: string): SpecIconName[] {
  const s = String(valueDisplay || '').toLowerCase();
  if (s.includes('vertical')) return ['Vertical'];
  if (s.includes('horizontal')) return ['Horizontal'];
  return [];
}

/**
 * Ровно одна иконка Alignment с учётом направления контейнера.
 */
function getAlignmentIconNames(
  valueDisplay: string,
  layoutDirection: 'vertical' | 'horizontal' | null
): SpecIconName[] {
  const key = normalizeAlignmentDisplay(valueDisplay);
  if (!key || key === 'none' || key === '—') return [];

  if (key.includes('space between')) return [];

  const hasLeft = /\bleft\b/.test(key);
  const hasRight = /\bright\b/.test(key);
  const hasTop = /\btop\b/.test(key);
  const hasBottom = /\bbottom\b/.test(key);
  const hasCenter = /\bcenter\b/.test(key);
  const hasMiddle = /\bmiddle\b/.test(key);

  if (layoutDirection === 'vertical') {
    if (hasLeft) return ['Alignment-Vertical-Left'];
    if (hasRight) return ['Alignment-Vertical-Right'];
    return ['Alignment-Vertical-Middle'];
  }

  if (layoutDirection === 'horizontal') {
    if (hasTop) return ['Alignment-Horizontal-Top'];
    if (hasBottom) return ['Alignment-Horizontal-Bottom'];
    return ['Alignment-Horizontal-Center'];
  }

  if (hasTop || hasBottom) {
    if (hasTop) return ['Alignment-Horizontal-Top'];
    if (hasBottom) return ['Alignment-Horizontal-Bottom'];
    return ['Alignment-Horizontal-Center'];
  }
  if (hasLeft || hasRight) {
    if (hasLeft) return ['Alignment-Vertical-Left'];
    if (hasRight) return ['Alignment-Vertical-Right'];
    return ['Alignment-Vertical-Middle'];
  }
  if (hasCenter || hasMiddle) {
    return ['Alignment-Horizontal-Center'];
  }

  return [];
}

/** Пробел-разделённые ключи (из `normalizePropertyName`) для устойчивости к подписи. */
const PADDING_ICON_BY_SPACED_NAME: Record<string, SpecIconName> = {
  padding: 'Padding',
  'padding left bottom': 'Padding-Left-Bottom',
  'padding left top': 'Padding-Left-Top',
  'padding right top': 'Padding-Right-Top',
  'padding right bottom': 'Padding-Right-Bottom',
  'padding left right': 'Padding-Left-Right',
  'padding top bottom': 'Padding-Top-Bottom',
  'padding left bottom right': 'Padding-Left-Bottom-Right',
  'padding left bottom top': 'Padding-Left-Bottom-Top',
  'padding right bottom top': 'Padding-Right-Bottom-Top',
  'padding right left top': 'Padding-Right-Left-Top',
  'padding left': 'Padding-Left',
  'padding right': 'Padding-Right',
  'padding top': 'Padding-Top',
  'padding bottom': 'Padding-Bottom',
};

/** Нормализованный ключ подписи (`normalizeContainerPropertyKey`) → имя иконки. */
function getPaddingIconNameByNormalizedKey(nk: string): SpecIconName | null {
  const map: Record<string, SpecIconName> = {
    padding: 'Padding',

    'padding-left-bottom': 'Padding-Left-Bottom',
    'padding-left-top': 'Padding-Left-Top',
    'padding-right-top': 'Padding-Right-Top',
    'padding-right-bottom': 'Padding-Right-Bottom',
    'padding-left-right': 'Padding-Left-Right',
    'padding-top-bottom': 'Padding-Top-Bottom',

    'padding-left-bottom-right': 'Padding-Left-Bottom-Right',
    'padding-left-bottom-top': 'Padding-Left-Bottom-Top',
    'padding-right-bottom-top': 'Padding-Right-Bottom-Top',
    'padding-right-left-top': 'Padding-Right-Left-Top',

    'padding-left': 'Padding-Left',
    'padding-right': 'Padding-Right',
    'padding-top': 'Padding-Top',
    'padding-bottom': 'Padding-Bottom',
  };

  return map[nk] ?? null;
}

/** Иконка padding по подписи строки (label), например `Padding-left-right`. */
export function getPaddingIconNameByProperty(property: string): SpecIconName | null {
  const nk = normalizeContainerPropertyKey(property);
  return (
    getPaddingIconNameByNormalizedKey(nk) ??
    PADDING_ICON_BY_SPACED_NAME[normalizePropertyName(property)] ??
    null
  );
}

/**
 * Имена иконок для подписи строки и отображаемого значения.
 */
export function getPropertyIconNames(
  propertyName: string,
  propertyValue: string,
  context?: PropertyIconContext
): SpecIconName[] {
  const nk = normalizeContainerPropertyKey(propertyName);
  const layoutDirection = parseLayoutDirection(context?.direction);

  if (nk === 'direction') return directionIconsFromDisplay(propertyValue);
  if (nk === 'alignment') return getAlignmentIconNames(propertyValue, layoutDirection);
  if (nk === 'width') return ['Width'];
  if (nk === 'height') return ['Height'];

  if (nk.startsWith('padding')) {
    const iconName =
      getPaddingIconNameByNormalizedKey(nk) ??
      PADDING_ICON_BY_SPACED_NAME[normalizePropertyName(propertyName)] ??
      null;
    return iconName ? [iconName] : [];
  }

  if (nk === 'gap') return ['Gap'];

  return [];
}
