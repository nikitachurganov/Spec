/// <reference types="@figma/plugin-typings" />

import type { AnatomyCandidate, AnatomyEntityKind, AnatomyItem } from './anatomyTypes';
import { cleanDisplayName, normalizeName } from './anatomyNaming';

export const MAX_ANATOMY_ITEMS = 8;

const STATE_ORDER = [
  'Default',
  'Selected',
  'Active',
  'Expanded',
  'Collapsed',
  'Disabled',
  'Error',
  'Hover',
  'Pressed',
  'Focused',
];

const ENTITY_KIND_ORDER: Record<AnatomyEntityKind, number> = {
  'container-variant': 0,
  slot: 1,
  'state-indicator': 2,
  structure: 3,
};

const IMPORTANT_STATES = new Set(STATE_ORDER.filter((s) => s !== 'Default'));

function featuresKey(features: AnatomyCandidate['features']): string {
  return features.length > 0 ? features.slice().sort().join(',') : 'none';
}

export function getAnatomyUniquenessKey(candidate: AnatomyCandidate): string {
  const base = normalizeName(candidate.baseName);
  const state = candidate.stateName ? normalizeName(candidate.stateName) : 'none';
  const variant = candidate.variantName ? normalizeName(candidate.variantName) : 'none';
  const role = candidate.role;
  const features = featuresKey(candidate.features);
  const level = candidate.level;
  const ctx =
    candidate.parentContextName && level === 'nested'
      ? normalizeName(candidate.parentContextName)
      : 'none';
  const position = candidate.slotPosition && candidate.slotPosition !== 'none'
    ? candidate.slotPosition
    : 'none';

  switch (candidate.entityKind) {
    case 'slot':
      return `slot|${role}|${base}|position:${position}|ctx:${ctx}|variant:${variant}`;
    case 'structure':
      return `structure|${role}|${base}`;
    case 'state-indicator':
      return `state-indicator|${role}|${base}`;
    case 'container-variant':
    default:
      return `container-variant|${role}|${base}|state:${state}|level:${level}|ctx:${ctx}|features:${features}|variant:${variant}`;
  }
}

export function getContainerVariantSignature(item: AnatomyCandidate | AnatomyItem): string {
  const state = item.stateName ? normalizeName(item.stateName) : 'none';
  return `${normalizeName(item.baseName)}|${state}|${item.role}|${featuresKey(item.features)}|${item.variantName || ''}`;
}

export function normalizeDefaultStates(candidates: AnatomyCandidate[]): void {
  const groups = new Map<string, AnatomyCandidate[]>();

  for (const c of candidates) {
    if (c.entityKind !== 'container-variant') continue;
    const key = `${normalizeName(c.baseName)}|${c.role}|${c.level}|${c.parentContextName || ''}`;
    const bucket = groups.get(key) || [];
    bucket.push(c);
    groups.set(key, bucket);
  }

  for (const group of groups.values()) {
    const hasExplicitState = group.some((c) => c.stateName);
    if (!hasExplicitState) continue;

    for (const c of group) {
      if (!c.stateName) {
        c.stateName = 'Default';
      }
    }
  }
}

function pickRepresentative(group: AnatomyCandidate[]): AnatomyCandidate {
  const visible = group.filter(
    (c) => c.bounds.width > 0 && c.bounds.height > 0 && c.node.visible !== false
  );
  const pool = visible.length > 0 ? visible : group;

  if (pool[0]?.entityKind === 'container-variant') {
    const selected = pool.find((c) => c.stateName === 'Selected');
    if (selected) return selected;
    const active = pool.find((c) => c.stateName === 'Active');
    if (active) return active;
    const def = pool.find((c) => c.stateName === 'Default');
    if (def) return def;
  }

  if (pool[0]?.role === 'icon') {
    const leading = pool.find((c) => c.slotPosition === 'leading');
    if (leading) return leading;
  }

  return pool.slice().sort((a, b) => {
    const y = a.bounds.y - b.bounds.y;
    if (Math.abs(y) > 2) return y;
    return a.bounds.x - b.bounds.x;
  })[0];
}

export function filterRedundantNestedItems(items: AnatomyItem[]): AnatomyItem[] {
  const rootContainers = items.filter(
    (i) => i.entityKind === 'container-variant' && i.level === 'root' && i.role !== 'nested-menu'
  );

  const rootSignatures = new Set(rootContainers.map((i) => getContainerVariantSignature(i)));

  return items.filter((item) => {
    if (item.role === 'nested-menu') return true;
    if (item.entityKind !== 'container-variant' || item.level !== 'nested') return true;

    const sig = getContainerVariantSignature(item);
    return !rootSignatures.has(sig);
  });
}

export function reduceToUniqueAnatomyItems(candidates: AnatomyCandidate[]): AnatomyItem[] {
  const groups = new Map<string, AnatomyCandidate[]>();
  for (const c of candidates) {
    const bucket = groups.get(c.uniquenessKey) || [];
    bucket.push(c);
    groups.set(c.uniquenessKey, bucket);
  }

  const items: AnatomyItem[] = [];

  for (const group of groups.values()) {
    const representative = pickRepresentative(group);
    items.push({
      ...representative,
      markerIndex: 0,
      finalLabel: representative.baseName,
      representedCount: group.length,
      representedNodeIds: group.map((g) => g.nodeId),
    });
  }

  return items;
}

/** @deprecated use capAnatomyItems */
export const limitAnatomyItems = capAnatomyItems;

export function buildFinalAnatomyLabel(item: AnatomyItem, allItems?: AnatomyItem[]): string {
  const label = cleanDisplayName(buildFinalAnatomyLabelRaw(item));
  if (!allItems || allItems.length <= 1) return label;

  const duplicates = allItems.filter(
    (o) => o.nodeId !== item.nodeId && buildFinalAnatomyLabelRaw(o) === label
  );
  if (duplicates.length === 0) return label;

  if (item.entityKind === 'slot' && item.parentContextName) {
    const ctxLabel = cleanDisplayName(`${item.parentContextName} ${label}`);
    if (!allItems.some((o) => o.nodeId !== item.nodeId && buildFinalAnatomyLabelRaw(o) === ctxLabel)) {
      return ctxLabel;
    }
  }

  const ordinal =
    allItems.filter((o) => buildFinalAnatomyLabelRaw(o) === label || buildFinalAnatomyLabelRaw(o).startsWith(`${label} `))
      .length + 1;
  return ordinal > 1 ? `${label} ${ordinal}` : label;
}

export function buildFinalAnatomyLabelRaw(item: AnatomyItem): string {
  if (item.entityKind === 'container-variant') {
    if (item.parentContextName && item.level === 'nested') {
      let l = `${cleanDisplayName(item.parentContextName)} / ${cleanDisplayName(item.baseName)}`;
      if (item.stateName) l += ` — ${item.stateName}`;
      return l;
    }
    let l = cleanDisplayName(item.baseName);
    if (item.stateName) l += ` — ${item.stateName}`;
    return l;
  }
  return cleanDisplayName(item.baseName);
}

export function assignFinalLabels(items: AnatomyItem[]): void {
  const labelCounts = new Map<string, number>();

  for (const item of items) {
    let label = cleanDisplayName(buildFinalAnatomyLabelRaw(item));

    if (item.entityKind === 'slot' && item.parentContextName) {
      const duplicates = items.filter(
        (o) => o.nodeId !== item.nodeId && buildFinalAnatomyLabelRaw(o) === label
      );
      if (duplicates.length > 0) {
        const ctxLabel = cleanDisplayName(`${item.parentContextName} ${label}`);
        const ctxTaken = items.some(
          (o) => o.nodeId !== item.nodeId && buildFinalAnatomyLabelRaw(o) === ctxLabel
        );
        if (!ctxTaken) {
          label = ctxLabel;
        }
      }
    }

    const seen = labelCounts.get(label) || 0;
    labelCounts.set(label, seen + 1);
    if (seen > 0) {
      label = `${label} ${seen + 1}`;
    }

    item.finalLabel = cleanDisplayName(label);
    item.name = item.finalLabel;
  }
}

function stateSortIndex(stateName?: string): number {
  if (!stateName) return 99;
  const idx = STATE_ORDER.indexOf(stateName);
  return idx >= 0 ? idx : 100;
}

function roleSortIndex(role: AnatomyItem['role']): number {
  if (role === 'menu-item') return 0;
  if (role === 'nested-menu') return 1;
  if (role === 'icon') return 2;
  if (role === 'description') return 3;
  if (role === 'badge' || role === 'tag' || role === 'counter') return 4;
  if (role === 'chevron') return 5;
  if (role === 'shortcut') return 6;
  if (role === 'selected-indicator') return 7;
  if (role === 'divider') return 8;
  return 9;
}

export function sortAnatomyItems(items: AnatomyItem[]): AnatomyItem[] {
  return items.slice().sort((a, b) => {
    const kindCmp = ENTITY_KIND_ORDER[a.entityKind] - ENTITY_KIND_ORDER[b.entityKind];
    if (kindCmp !== 0) return kindCmp;

    if (a.entityKind === 'container-variant' && b.entityKind === 'container-variant') {
      const levelCmp = (a.level === 'root' ? 0 : 1) - (b.level === 'root' ? 0 : 1);
      if (levelCmp !== 0) return levelCmp;

      const baseCmp = normalizeName(a.baseName).localeCompare(normalizeName(b.baseName));
      if (baseCmp !== 0) return baseCmp;

      const stateCmp = stateSortIndex(a.stateName) - stateSortIndex(b.stateName);
      if (stateCmp !== 0) return stateCmp;

      if (a.role === 'nested-menu') return -1;
      if (b.role === 'nested-menu') return 1;
    }

    const roleCmp = roleSortIndex(a.role) - roleSortIndex(b.role);
    if (roleCmp !== 0) return roleCmp;

    return a.bounds.y - b.bounds.y || a.bounds.x - b.bounds.x;
  });
}

function itemPriority(item: AnatomyItem): number {
  let score = 0;
  if (item.entityKind === 'container-variant') {
    score += 200;
    if (item.stateName && IMPORTANT_STATES.has(item.stateName)) score += 80;
    if (item.role === 'nested-menu') score += 70;
    if (item.stateName === 'Default') score += 40;
  }
  if (item.entityKind === 'slot') {
    score += 50;
    if (item.role === 'icon') score += 30;
    if (item.role === 'chevron') score += 25;
    if (item.role === 'badge' || item.role === 'tag') score += 20;
  }
  if (item.entityKind === 'state-indicator') score += 35;
  if (item.entityKind === 'structure') score += 25;
  return score;
}

export function capAnatomyItems(items: AnatomyItem[], max = MAX_ANATOMY_ITEMS): AnatomyItem[] {
  if (items.length <= max) return items;

  const mustKeep = new Set<string>();
  for (const item of items) {
    if (item.entityKind === 'container-variant' && item.role === 'menu-item' && item.stateName) {
      mustKeep.add(item.uniquenessKey);
    }
    if (item.role === 'nested-menu') {
      mustKeep.add(item.uniquenessKey);
    }
  }

  const sorted = items.slice().sort((a, b) => itemPriority(b) - itemPriority(a));
  const kept: AnatomyItem[] = [];

  for (const item of sorted) {
    if (mustKeep.has(item.uniquenessKey)) {
      kept.push(item);
    }
  }

  for (const item of sorted) {
    if (kept.length >= max) break;
    if (kept.some((k) => k.nodeId === item.nodeId)) continue;
    kept.push(item);
  }

  console.warn(`[Spec] Anatomy items capped from ${items.length} to ${kept.length}.`);
  return sortAnatomyItems(kept);
}

export function reindexAnatomyItems(items: AnatomyItem[]): AnatomyItem[] {
  return items.map((item, index) => {
    const markerIndex = index + 1;
    return {
      ...item,
      markerIndex,
      index: markerIndex,
      id: item.nodeId,
      name: item.finalLabel,
    };
  });
}
