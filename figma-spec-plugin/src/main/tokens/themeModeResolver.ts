/// <reference types="@figma/plugin-typings" />

import { getLocalVariableCollectionsSafe } from '../figma/variables';

export type ThemeModeInfo = {
  collectionId: string;
  collectionName: string;
  lightModeId?: string;
  darkModeId?: string;
};

const PREFERRED_COLLECTION_HINTS = [
  'typography & colors',
  'typography and colors',
  'colors',
  'colour',
  'color',
];

const LIGHT_MODE_PATTERNS = [
  /^light$/i,
  /^default$/i,
  /^day$/i,
  /^светлая$/i,
  /^светлая тема$/i,
];

const DARK_MODE_PATTERNS = [
  /^dark$/i,
  /^night$/i,
  /^тёмная$/i,
  /^темная$/i,
  /^тёмная тема$/i,
  /^темная тема$/i,
];

function normalizeName(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function matchesModeName(modeName: string, patterns: RegExp[]): boolean {
  const n = normalizeName(modeName);
  return patterns.some((p) => p.test(n));
}

function collectionPriority(name: string): number {
  const n = normalizeName(name);
  for (let i = 0; i < PREFERRED_COLLECTION_HINTS.length; i += 1) {
    if (n.includes(PREFERRED_COLLECTION_HINTS[i])) {
      return i;
    }
  }
  return PREFERRED_COLLECTION_HINTS.length;
}

function resolveModesFromCollection(
  collection: VariableCollection
): { lightModeId?: string; darkModeId?: string } {
  let lightModeId: string | undefined;
  let darkModeId: string | undefined;
  let defaultModeId: string | undefined;

  for (const mode of collection.modes) {
    const modeName = mode.name;
    if (matchesModeName(modeName, LIGHT_MODE_PATTERNS) && !lightModeId) {
      lightModeId = mode.modeId;
    }
    if (matchesModeName(modeName, DARK_MODE_PATTERNS) && !darkModeId) {
      darkModeId = mode.modeId;
    }
    if (normalizeName(modeName) === 'default') {
      defaultModeId = mode.modeId;
    }
  }

  if (!lightModeId && defaultModeId && darkModeId) {
    lightModeId = defaultModeId;
  }

  return { lightModeId, darkModeId };
}

/**
 * Finds a local variable collection that exposes both light and dark modes.
 * Prefers collections named like "Typography & Colors".
 */
export async function findThemeModes(): Promise<ThemeModeInfo | null> {
  const collections = await getLocalVariableCollectionsSafe();
  const candidates: ThemeModeInfo[] = [];

  for (const collection of collections) {
    const { lightModeId, darkModeId } = resolveModesFromCollection(collection);
    if (!lightModeId && !darkModeId) continue;

    candidates.push({
      collectionId: collection.id,
      collectionName: collection.name,
      lightModeId,
      darkModeId,
    });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const prioA = collectionPriority(a.collectionName);
    const prioB = collectionPriority(b.collectionName);
    if (prioA !== prioB) return prioA - prioB;
    const aScore = (a.lightModeId ? 1 : 0) + (a.darkModeId ? 1 : 0);
    const bScore = (b.lightModeId ? 1 : 0) + (b.darkModeId ? 1 : 0);
    return bScore - aScore;
  });

  return candidates[0];
}

type VariableModeCapable = SceneNode & {
  setExplicitVariableModeForCollection?: (collectionId: string, modeId: string) => void;
};

/**
 * Applies an explicit variable mode to a node and its descendants when supported.
 */
export function applyVariableModeToNode(
  node: SceneNode,
  collectionId: string,
  modeId: string
): void {
  const capable = node as VariableModeCapable;
  if (typeof capable.setExplicitVariableModeForCollection === 'function') {
    try {
      capable.setExplicitVariableModeForCollection(collectionId, modeId);
    } catch (error) {
      console.warn('[Themes] setExplicitVariableModeForCollection failed on', node.name, error);
    }
  }

  if ('children' in node && Array.isArray(node.children)) {
    for (const child of node.children) {
      applyVariableModeToNode(child as SceneNode, collectionId, modeId);
    }
  }
}
