/// <reference types="@figma/plugin-typings" />

import { debugLog } from '../debug';
import {
  getLibraryVariableCollectionsSafe,
  importVariableByKeySafe,
  getVariableNumericValue,
  getVariablesInLibraryCollectionSafe,
} from '../figma/variables';

const SEMANTIC_MARKER = 'spaces/semantic/';
const COLLECTION_NAME = 'Typography & Colors';

export type SpacingTokenSource = 'library';

export type SpacingTokenMatch = {
  name: string;
  path: string;
  value: number;
  variableId?: string;
  variableKey?: string;
  collectionName?: string;
  source: SpacingTokenSource;
};

export type SpacingTokenResolver = {
  init(): Promise<void>;
  resolveSpacingToken(valuePx: number): SpacingTokenMatch | null;
  formatSpacingValue(valuePx: number): string;
};

type IndexedSpacing = SpacingTokenMatch & { sortLen: number };

let spacingTokenCache: IndexedSpacing[] | null = null;
let libraryLoadWarned = false;
const missingValueWarnings = new Set<number>();

function normalizeName(name: string): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ');
}

export function normalizeSpacingPath(name: string): string {
  const trimmed = String(name || '').trim();
  const lower = trimmed.toLowerCase();
  const idx = lower.indexOf(SEMANTIC_MARKER);
  if (idx >= 0) {
    const segment = trimmed.slice(idx).replace(/\s*\/\s*/g, '/');
    const parts = segment.split('/');
    if (parts.length >= 3 && parts[0].toLowerCase() === 'spaces') {
      return `Spaces/semantic/${parts.slice(2).join('/')}`;
    }
    return segment.replace(/\s*\/\s*/g, '/');
  }
  return trimmed.replace(/\s*\/\s*/g, '/');
}

function spacingNameMatchesSemantic(name: string): boolean {
  return normalizeName(name).includes(SEMANTIC_MARKER);
}

function areNumbersEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.01;
}

export function formatPx(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) {
    return `${rounded}px`;
  }
  return `${Number(rounded.toFixed(2))}px`;
}

/** Spec label path trace from library variable name, e.g. `Spaces/semantic/large`. */
export function formatSpacingPathTrace(match: SpacingTokenMatch): string {
  return match.path;
}

function indexToken(entry: {
  name: string;
  path: string;
  value: number;
  variableId?: string;
  variableKey?: string;
  collectionName?: string;
}): IndexedSpacing {
  const path = normalizeSpacingPath(entry.path);
  return {
    name: entry.name,
    path,
    value: entry.value,
    variableId: entry.variableId,
    variableKey: entry.variableKey,
    collectionName: entry.collectionName,
    source: 'library',
    sortLen: path.length,
  };
}

function pickTypographyCollections(
  collections: LibraryVariableCollection[]
): LibraryVariableCollection[] {
  const exact = collections.filter(
    (c) => normalizeName(c.name) === normalizeName(COLLECTION_NAME)
  );
  if (exact.length > 0) return exact;

  return collections.filter((c) => normalizeName(c.name).includes('typography'));
}

async function loadSpacingTokensFromLibrary(index: IndexedSpacing[]): Promise<boolean> {
  const collections = await getLibraryVariableCollectionsSafe();
  const targets = pickTypographyCollections(collections);

  if (targets.length === 0) {
    if (!libraryLoadWarned) {
      libraryLoadWarned = true;
      console.warn(
        '[SpacingTokens] Typography & Colors library not connected — spacing values will show as px only.'
      );
    }
    return false;
  }

  let loaded = 0;

  for (const collection of targets) {
    const libVars = await getVariablesInLibraryCollectionSafe(collection.key);
    for (const lv of libVars) {
      if (lv.resolvedType !== 'FLOAT') continue;
      if (!spacingNameMatchesSemantic(lv.name)) continue;

      const v = await importVariableByKeySafe(lv.key);
      if (!v) continue;
      try {
        if (v.resolvedType !== 'FLOAT') continue;

        const importedCollection = v.variableCollectionId
          ? figma.variables.getVariableCollectionById(v.variableCollectionId)
          : null;
        const num = getVariableNumericValue(v, importedCollection);
        if (num == null || Number.isNaN(num)) continue;

        const path = normalizeSpacingPath(v.name);

        index.push(
          indexToken({
            name: v.name,
            path,
            value: Math.round(num),
            variableId: v.id,
            variableKey: lv.key,
            collectionName: collection.name,
          })
        );
        loaded++;
      } catch (e) {
        debugLog('[SpacingTokens] importVariableByKeySafe failed', lv.name, e);
      }
    }
  }

  return loaded > 0;
}

async function loadSpacingTokens(): Promise<IndexedSpacing[]> {
  if (spacingTokenCache) return spacingTokenCache;

  const index: IndexedSpacing[] = [];
  await loadSpacingTokensFromLibrary(index);

  spacingTokenCache = index;
  debugLog(
    '[SpacingTokens] loaded from library',
    index.map((t) => ({ path: t.path, value: t.value }))
  );
  return index;
}

function pickBestMatch(index: IndexedSpacing[], value: number): IndexedSpacing | null {
  const rounded = Math.round(value);
  const matches = index.filter((t) => areNumbersEqual(t.value, rounded));
  if (matches.length === 0) return null;

  matches.sort((a, b) => {
    if (a.sortLen !== b.sortLen) return a.sortLen - b.sortLen;
    return a.path.localeCompare(b.path);
  });
  return matches[0] ?? null;
}

const spacingTokenByValueCache = new Map<number, SpacingTokenMatch | null>();

export async function createSpacingTokenResolver(): Promise<SpacingTokenResolver> {
  let index: IndexedSpacing[] = [];
  let initialized = false;

  const resolver: SpacingTokenResolver = {
    async init(): Promise<void> {
      if (initialized) return;
      index = await loadSpacingTokens();
      spacingTokenByValueCache.clear();
      initialized = true;
    },

    resolveSpacingToken(valuePx: number): SpacingTokenMatch | null {
      const rounded = Math.round(valuePx);
      if (spacingTokenByValueCache.has(rounded)) {
        return spacingTokenByValueCache.get(rounded) ?? null;
      }
      const hit = pickBestMatch(index, rounded);
      const result = hit
        ? {
            name: hit.name,
            path: hit.path,
            value: hit.value,
            variableId: hit.variableId,
            variableKey: hit.variableKey,
            collectionName: hit.collectionName,
            source: hit.source,
          }
        : null;
      spacingTokenByValueCache.set(rounded, result);
      return result;
    },

    formatSpacingValue(valuePx: number): string {
      if (valuePx === 0) {
        return '0px';
      }

      const rounded = Math.round(valuePx);
      const hit = resolver.resolveSpacingToken(rounded);
      if (hit) {
        return `${formatSpacingPathTrace(hit)} (${formatPx(rounded)})`;
      }

      if (!missingValueWarnings.has(rounded)) {
        missingValueWarnings.add(rounded);
        debugLog('[SpacingTokens] No library token for value', rounded);
      }

      return formatPx(rounded);
    },
  };

  return resolver;
}

/** @deprecated use `path` on SpacingTokenMatch */
export function getSpacingDisplayName(variableName: string): string {
  return normalizeSpacingPath(variableName);
}
