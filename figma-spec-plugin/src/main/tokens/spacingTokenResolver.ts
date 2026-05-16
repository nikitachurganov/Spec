/// <reference types="@figma/plugin-typings" />

const SEMANTIC_MARKER = 'Spaces/semantic/';
const COLLECTION_NAME = 'Typography & Colors';

export type SpacingTokenMatch = {
  name: string;
  displayName: string;
  value: number;
  source: 'library-variable' | 'local-variable' | 'fallback';
};

export type SpacingTokenResolver = {
  init(): Promise<void>;
  resolveByValue(value: number): SpacingTokenMatch | null;
  formatSpacingValue(value: number | null | undefined): string;
};

type IndexedSpacing = SpacingTokenMatch & { sortLen: number };

function normalizeCollectionName(name: string): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function areNumbersEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.01;
}

export function formatPx(value: number): string {
  if (Number.isInteger(value)) {
    return `${value}px`;
  }
  return `${Number(value.toFixed(2))}px`;
}

export function getSpacingDisplayName(variableName: string): string {
  const normalized = String(variableName || '').trim();
  const lower = normalized.toLowerCase();
  const idx = lower.indexOf(SEMANTIC_MARKER.toLowerCase());
  if (idx >= 0) {
    return normalized.slice(idx);
  }
  return normalized;
}

function spacingNameMatchesSemantic(name: string): boolean {
  return name.toLowerCase().includes(SEMANTIC_MARKER.toLowerCase());
}

function getFirstNumericVariableValue(variable: Variable): number | null {
  const raw = variable.valuesByMode as Record<string, unknown> | undefined;
  if (!raw) return null;
  const values = Object.values(raw);
  for (const value of values) {
    if (typeof value === 'number') {
      return value;
    }
  }
  return null;
}

/** Резерв, если библиотека недоступна или нет совпадения в variables API. */
const FALLBACK_SPACING_DISPLAY: Record<number, string> = {
  2: 'Spaces/semantic/3xs',
  4: 'Spaces/semantic/2xs',
  6: 'Spaces/semantic/xs',
  8: 'Spaces/semantic/small',
  10: 'Spaces/semantic/small-plus',
  12: 'Spaces/semantic/medium',
  16: 'Spaces/semantic/large',
  20: 'Spaces/semantic/xl',
  24: 'Spaces/semantic/2xl',
  28: 'Spaces/semantic/3xl',
  32: 'Spaces/semantic/4xl',
  40: 'Spaces/semantic/5xl',
  48: 'Spaces/semantic/6xl',
  56: 'Spaces/semantic/7xl',
  64: 'Spaces/semantic/8xl',
};

type TeamLib = {
  getAvailableLibraryVariableCollectionsAsync?: () => Promise<LibraryVariableCollection[]>;
  getVariablesInLibraryCollectionAsync?: (collectionKey: string) => Promise<LibraryVariable[]>;
};

function rankSource(s: SpacingTokenMatch['source']): number {
  if (s === 'library-variable') return 0;
  if (s === 'local-variable') return 1;
  return 2;
}

export async function createSpacingTokenResolver(): Promise<SpacingTokenResolver> {
  let index: IndexedSpacing[] = [];

  async function loadFromLibrary(): Promise<void> {
    const team = (
      figma as PluginAPI & {
        teamLibrary?: TeamLib;
      }
    ).teamLibrary;
    if (!team?.getAvailableLibraryVariableCollectionsAsync || !team.getVariablesInLibraryCollectionAsync) {
      console.warn('[SpacingTokenResolver] teamLibrary API unavailable');
      return;
    }

    let collections: LibraryVariableCollection[];
    try {
      collections = await team.getAvailableLibraryVariableCollectionsAsync();
    } catch (e) {
      console.warn('[SpacingTokenResolver] getAvailableLibraryVariableCollectionsAsync failed', e);
      return;
    }

    const targetNorm = normalizeCollectionName(COLLECTION_NAME);
    const collection = collections.find((c) => normalizeCollectionName(c.name) === targetNorm);

    if (!collection) {
      console.warn('[SpacingTokenResolver] Library collection not found: Typography & Colors');
      return;
    }

    let libVars: LibraryVariable[];
    try {
      libVars = await team.getVariablesInLibraryCollectionAsync(collection.key);
    } catch (e) {
      console.warn('[SpacingTokenResolver] getVariablesInLibraryCollectionAsync failed', e);
      return;
    }

    for (const lv of libVars) {
      if (lv.resolvedType !== 'FLOAT') continue;
      if (!spacingNameMatchesSemantic(lv.name)) continue;

      try {
        const v = await figma.variables.importVariableByKeyAsync(lv.key);
        if (v.resolvedType !== 'FLOAT') continue;
        const num = getFirstNumericVariableValue(v);
        if (num == null || Number.isNaN(num)) continue;

        const displayName = getSpacingDisplayName(v.name);
        index.push({
          name: v.name,
          displayName,
          value: num,
          source: 'library-variable',
          sortLen: displayName.length,
        });
      } catch (e) {
        console.warn('[SpacingTokenResolver] importVariableByKeyAsync failed', lv.name, e);
      }
    }
  }

  function loadFromLocal(): void {
    try {
      const locals = figma.variables.getLocalVariables();
      for (const v of locals) {
        if (v.resolvedType !== 'FLOAT') continue;
        if (!spacingNameMatchesSemantic(v.name)) continue;
        const num = getFirstNumericVariableValue(v);
        if (num == null || Number.isNaN(num)) continue;
        const displayName = getSpacingDisplayName(v.name);
        index.push({
          name: v.name,
          displayName,
          value: num,
          source: 'local-variable',
          sortLen: displayName.length,
        });
      }
    } catch (e) {
      console.warn('[SpacingTokenResolver] getLocalVariables failed', e);
    }
  }

  function loadFallbackMap(): void {
    for (const [k, displayName] of Object.entries(FALLBACK_SPACING_DISPLAY)) {
      const value = Number(k);
      index.push({
        name: displayName,
        displayName,
        value,
        source: 'fallback',
        sortLen: displayName.length,
      });
    }
  }

  function pickBestMatch(value: number): IndexedSpacing | null {
    const matches = index.filter((t) => areNumbersEqual(t.value, value));
    if (matches.length === 0) return null;

    matches.sort((a, b) => {
      const rs = rankSource(a.source) - rankSource(b.source);
      if (rs !== 0) return rs;
      if (a.sortLen !== b.sortLen) return a.sortLen - b.sortLen;
      return a.displayName.localeCompare(b.displayName);
    });
    return matches[0] ?? null;
  }

  const resolver: SpacingTokenResolver = {
    async init(): Promise<void> {
      index = [];
      await loadFromLibrary();
      loadFromLocal();
      loadFallbackMap();

      const debugTokens = index.map((t) => ({
        displayName: t.displayName,
        value: t.value,
        source: t.source,
      }));
      console.log('[SpacingTokenResolver] loaded tokens', debugTokens);
    },

    resolveByValue(value: number): SpacingTokenMatch | null {
      const hit = pickBestMatch(value);
      if (!hit) return null;
      return {
        name: hit.name,
        displayName: hit.displayName,
        value: hit.value,
        source: hit.source,
      };
    },

    formatSpacingValue(value: number | null | undefined): string {
      if (value == null || value === 0) {
        return 'None';
      }
      const hit = pickBestMatch(value);
      if (hit) {
        return `${hit.displayName} (${formatPx(value)})`;
      }
      console.warn('[SpacingTokenResolver] No token for spacing value', value);
      return formatPx(value);
    },
  };

  return resolver;
}
