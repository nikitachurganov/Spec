/// <reference types="@figma/plugin-typings" />

import { normalizeTokenName } from './styleResolver';
import {
  getLibraryVariableCollectionsSafe,
  getLocalVariableCollectionsSafe,
  getLocalVariablesSafe,
  getVariablesInLibraryCollectionSafe,
  importVariableByKeySafe,
} from '../figma/variables';

export type ThemeModeInfo = {
  collectionId: string;
  collectionName: string;
  lightModeId: string;
  lightModeName: string;
  darkModeId: string;
  darkModeName: string;
  backgroundPrimaryVariableId: string;
  backgroundPrimaryVariable: Variable;
  modeSourcePath: string;
};

const TYPOGRAPHY_COLORS_COLLECTION = 'typography & colors';
const THEME_MODE_COLLECTION_NAME = 'Typography & Colors/Semantic/color';
const TARGET_LIBRARY_NAME = 'Typography & Colors';
const TARGET_COLLECTION_NAME = 'Semantic/color';
const LIGHT_MODE_NAME = 'Light';
const DARK_MODE_NAME = 'Dark';
const SEMANTIC_COLOR_MODE_PATH = 'Semantic / color';
const BLOCKED_COLLECTION_NAMES = new Set(['radius', 'spacing', 'shadow', 'border', 'opacity']);

const BACKGROUND_PRIMARY_NAMES = [
  'background/primary',
  'semantic/color/background/primary',
  'typography & colors/semantic/color/background/primary',
];

const LIGHT_MODE_CANDIDATES = ['Light', 'Auto (Light)', 'Светлая', 'Светлая тема'];
const DARK_MODE_CANDIDATES = ['Dark', 'Тёмная', 'Темная', 'Тёмная тема'];

const warnedThemeKeys = new Set<string>();

let cachedThemeVariables: ThemeVariablesResult | null = null;
let cachedThemeVariablesPromise: Promise<ThemeVariablesResult> | null = null;
let cachedThemeModeCollection: VariableCollection | null = null;
let cachedThemeModeCollectionPromise: Promise<VariableCollection | null> | null = null;
let cachedThemeCollection: VariableCollection | null | undefined;
let cachedThemeCollectionPromise: Promise<VariableCollection | null> | null = null;

export type ThemeVariablesResult = {
  themeInfo: ThemeModeInfo | null;
  collection: VariableCollection | null;
  backgroundPrimaryVariable: Variable | null;
  lightMode: VariableCollection['modes'][number] | null;
  darkMode: VariableCollection['modes'][number] | null;
};

export function warnOnce(key: string, message: string, ...args: unknown[]): void {
  if (warnedThemeKeys.has(key)) return;
  warnedThemeKeys.add(key);
  console.warn(message, ...args);
}

export function resetThemeVariablesCache(): void {
  cachedThemeVariables = null;
  cachedThemeVariablesPromise = null;
  cachedThemeModeCollection = null;
  cachedThemeModeCollectionPromise = null;
  cachedThemeCollection = undefined;
  cachedThemeCollectionPromise = null;
  warnedThemeKeys.clear();
}

async function getThemeVariableCollection(): Promise<VariableCollection | null> {
  if (cachedThemeCollection !== undefined) return cachedThemeCollection;
  if (cachedThemeCollectionPromise) return cachedThemeCollectionPromise;

  cachedThemeCollectionPromise = (async () => {
    const localCollection = await findLocalThemeCollection();
    if (localCollection) return localCollection;

    const importedCollection = await importThemeCollectionFromLibrary();
    if (!importedCollection) return null;

    const modeNames = importedCollection.modes.map((mode) => normalizeName(mode.name));
    if (!modeNames.includes(normalizeName(LIGHT_MODE_NAME)) || !modeNames.includes(normalizeName(DARK_MODE_NAME))) {
      console.warn(
        `[Theme preview] Imported collection does not contain Light/Dark modes: ${importedCollection.name}`,
        importedCollection.modes.map((mode) => mode.name)
      );
      return null;
    }
    return importedCollection;
  })();

  try {
    cachedThemeCollection = await cachedThemeCollectionPromise;
    return cachedThemeCollection;
  } finally {
    cachedThemeCollectionPromise = null;
  }
}

async function getLocalVariableCollectionsForTheme(): Promise<VariableCollection[]> {
  const api = figma.variables as typeof figma.variables & {
    getLocalVariableCollections?: () => VariableCollection[];
  };
  if ('getLocalVariableCollectionsAsync' in api && typeof api.getLocalVariableCollectionsAsync === 'function') {
    try {
      return await api.getLocalVariableCollectionsAsync();
    } catch (error) {
      console.warn('[Theme preview] getLocalVariableCollectionsAsync failed:', error);
    }
  }

  if ('getLocalVariableCollections' in api && typeof api.getLocalVariableCollections === 'function') {
    try {
      return api.getLocalVariableCollections();
    } catch (error) {
      console.warn('[Theme preview] getLocalVariableCollections failed:', error);
    }
  }

  console.warn('[Theme preview] getLocalVariableCollections is not available');
  return [];
}

export async function debugLocalVariableCollections(): Promise<VariableCollection[]> {
  try {
    const collections = await getLocalVariableCollectionsForTheme();
    console.log(
      '[Theme preview] Local variable collections:',
      collections.map((collection) => ({
        id: collection.id,
        key: (collection as { key?: string }).key ?? '',
        name: collection.name,
        modes: collection.modes.map((mode) => ({
          name: mode.name,
          modeId: mode.modeId,
        })),
      }))
    );
    return collections;
  } catch (error) {
    console.warn('[Theme preview] Failed to read local variable collections:', error);
    return [];
  }
}

function collectionHasLightDarkModes(collection: VariableCollection): boolean {
  const modeNames = collection.modes.map((mode) => normalizeName(mode.name));
  return modeNames.includes(normalizeName(LIGHT_MODE_NAME)) && modeNames.includes(normalizeName(DARK_MODE_NAME));
}

async function findLocalThemeCollection(): Promise<VariableCollection | null> {
  const collections = await debugLocalVariableCollections();
  return collections.find((collection) => collectionHasLightDarkModes(collection)) ?? null;
}

async function importThemeCollectionFromLibrary(): Promise<VariableCollection | null> {
  const teamLibrary = (figma as PluginAPI & {
    teamLibrary?: {
      getAvailableLibraryVariableCollectionsAsync?: () => Promise<LibraryVariableCollection[]>;
      getVariablesInLibraryCollectionAsync?: (collectionKey: string) => Promise<LibraryVariable[]>;
    };
  }).teamLibrary;

  if (
    !teamLibrary ||
    typeof teamLibrary.getAvailableLibraryVariableCollectionsAsync !== 'function' ||
    typeof teamLibrary.getVariablesInLibraryCollectionAsync !== 'function'
  ) {
    console.warn(
      '[Theme preview] figma.teamLibrary is not available. Add teamlibrary permission to manifest.json.'
    );
    return null;
  }

  const libraryCollections = await teamLibrary.getAvailableLibraryVariableCollectionsAsync();
  console.log(
    '[Theme preview] Available library variable collections:',
    libraryCollections.map((collection) => ({
      key: collection.key,
      name: collection.name,
      libraryName: collection.libraryName,
    }))
  );

  const targetLibraryCollection = libraryCollections.find(isTargetThemeLibraryCollection);

  if (!targetLibraryCollection) {
    console.warn(
      `[Theme preview] Target library variable collection not found: ${TARGET_LIBRARY_NAME} / ${TARGET_COLLECTION_NAME}`,
      libraryCollections.map((collection) => ({
        name: collection.name,
        libraryName: collection.libraryName,
      }))
    );
    return null;
  }

  if (BLOCKED_COLLECTION_NAMES.has(normalizeName(targetLibraryCollection.name))) {
    console.warn(
      `[Theme preview] Wrong library collection selected: ${targetLibraryCollection.name}. Theme preview requires Typography & Colors.`
    );
    return null;
  }

  console.log('[Theme preview] Selected target library collection:', {
    key: targetLibraryCollection.key,
    name: targetLibraryCollection.name,
    libraryName: targetLibraryCollection.libraryName,
  });

  const libraryVariables = await teamLibrary.getVariablesInLibraryCollectionAsync(
    targetLibraryCollection.key
  );
  console.log(
    `[Theme preview] Variables in target library collection "${targetLibraryCollection.libraryName} / ${targetLibraryCollection.name}":`,
    libraryVariables.slice(0, 30).map((variable) => ({
      key: variable.key,
      name: variable.name,
      resolvedType: variable.resolvedType,
    }))
  );

  const variableToImport =
    libraryVariables.find((variable) => {
      const normalized = normalizeCollectionName(variable.name);
      return (
        normalized.includes('background/primary') ||
        normalized.includes('background/secondary') ||
        normalized.includes('text/primary') ||
        normalized.includes('border/primary')
      );
    }) ?? libraryVariables[0];

  if (!variableToImport) {
    console.warn(
      `[Theme preview] No variables found in target library collection: ${TARGET_LIBRARY_NAME} / ${TARGET_COLLECTION_NAME}`
    );
    return null;
  }

  const importedVariable = await importVariableByKeySafe(variableToImport.key);
  if (!importedVariable) return null;
  if (!importedVariable.variableCollectionId) {
    console.warn('[Theme preview] Imported variable has no variableCollectionId', importedVariable);
    return null;
  }

  let collection: VariableCollection | null = null;
  try {
    collection = figma.variables.getVariableCollectionById(importedVariable.variableCollectionId);
  } catch {
    collection = null;
  }
  if (!collection && typeof figma.variables.getVariableCollectionByIdAsync === 'function') {
    try {
      collection = await figma.variables.getVariableCollectionByIdAsync(
        importedVariable.variableCollectionId
      );
    } catch {
      collection = null;
    }
  }

  if (!collection) {
    console.warn('[Theme preview] Failed to resolve imported variable collection', {
      variableName: importedVariable.name,
      variableCollectionId: importedVariable.variableCollectionId,
    });
    return null;
  }

  if (BLOCKED_COLLECTION_NAMES.has(normalizeName(collection.name))) {
    console.warn(
      `[Theme preview] Wrong library collection selected: ${collection.name}. Theme preview requires Typography & Colors.`
    );
    return null;
  }

  const modeNames = collection.modes.map((mode) => normalizeName(mode.name));
  if (
    !modeNames.includes(normalizeName(LIGHT_MODE_NAME)) ||
    !modeNames.includes(normalizeName(DARK_MODE_NAME))
  ) {
    console.warn(
      `[Theme preview] Imported target collection does not contain Light/Dark modes: ${collection.name}`,
      collection.modes.map((mode) => mode.name)
    );
    return null;
  }

  console.log('[Theme preview] Imported valid theme collection from library:', {
    id: collection.id,
    name: collection.name,
    modes: collection.modes.map((mode) => ({
      name: mode.name,
      modeId: mode.modeId,
    })),
  });

  return collection;
}

type CollectionObjectVariableModeCapable = SceneNode & {
  setExplicitVariableModeForCollection?: (collection: VariableCollection, modeId: string) => void;
  explicitVariableModes?: Record<string, string>;
};

export async function applyThemeVariableMode(
  node: SceneNode,
  modeName: 'Light' | 'Dark'
): Promise<void> {
  const collection = await getThemeVariableCollection();
  if (!collection) {
    console.warn(
      `[Theme preview] Cannot apply mode "${modeName}" because theme collection is not available.`
    );
    return;
  }

  const modes = (Array.isArray((collection as { modes?: unknown }).modes)
    ? ((collection as { modes: Array<{ name?: unknown; modeId?: unknown }> }).modes ?? [])
    : []
  ).filter(
    (item): item is { name: string; modeId: string } =>
      typeof item.name === 'string' && typeof item.modeId === 'string'
  );
  const mode = modes.find(
    (item) => item.name.toLowerCase().trim() === modeName.toLowerCase()
  );
  if (!mode) {
    console.warn(
      `[Theme preview] Mode "${modeName}" not found in collection "${collection.name}".`,
      {
        availableModes: modes.map((item) => item.name),
      }
    );
    return;
  }

  const hasExplicitModeApi = 'setExplicitVariableModeForCollection' in (node as object);
  if (!hasExplicitModeApi) {
    console.warn(
      `[Theme preview] Node does not support explicit variable modes: ${node.type}`
    );
    return;
  }

  const capable = node as CollectionObjectVariableModeCapable;
  if (typeof capable.setExplicitVariableModeForCollection !== 'function') {
    console.warn(
      `[Theme preview] Node does not support explicit variable modes: ${node.type}`
    );
    return;
  }

  try {
    capable.setExplicitVariableModeForCollection(collection, mode.modeId);
    const modeMap = capable.explicitVariableModes;
    if (modeMap && modeMap[collection.id] !== mode.modeId) {
      warnOnce(
        `theme-preview-mode-verify-failed:${modeName}`,
        `[Theme preview] Explicit mode verification failed for ${node.name}: expected ${mode.modeId}`
      );
    }
    console.log(`[Theme preview] Applied variable mode "${modeName}" to ${node.type}: ${node.name}`, {
      collectionName: collection.name,
      collectionId: collection.id,
      modeId: mode.modeId,
      explicitVariableModes: capable.explicitVariableModes,
    });
  } catch (error) {
    console.warn(
      `[Theme preview] Failed to apply mode ${modeName} on ${node.name}:`,
      error
    );
  }
}

function normalizeName(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normalizeCollectionName(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/\\/g, '/')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeNameForLibrary(name: string): string {
  return normalizeCollectionName(name)
    .replace(/&/g, 'and')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isTargetThemeLibraryCollection(collection: LibraryVariableCollection): boolean {
  return (
    normalizeNameForLibrary(collection.name) === normalizeNameForLibrary(TARGET_COLLECTION_NAME) &&
    normalizeNameForLibrary(collection.libraryName ?? '') ===
      normalizeNameForLibrary(TARGET_LIBRARY_NAME)
  );
}

function normalizeModeName(value: string): string {
  return normalizeName(value);
}

function normalizeVariablePath(value: string): string {
  return normalizeTokenName(value);
}

function matchesBackgroundPrimaryName(variableName: string): boolean {
  const normalized = normalizeVariablePath(variableName);
  const wanted = new Set(BACKGROUND_PRIMARY_NAMES.map(normalizeVariablePath));

  if (wanted.has(normalized)) return true;
  if (normalized.endsWith('/background/primary')) return true;

  return BACKGROUND_PRIMARY_NAMES.some((name) =>
    normalized.endsWith(`/${normalizeVariablePath(name)}`)
  );
}

function scoreBackgroundPrimaryVariable(variable: Variable, preferredCollectionId?: string): number {
  let score = 0;
  const normalized = normalizeVariablePath(variable.name);
  if (preferredCollectionId && variable.variableCollectionId === preferredCollectionId) {
    score -= 40;
  }
  if (normalized.includes(TYPOGRAPHY_COLORS_COLLECTION)) {
    score -= 20;
  }
  if (normalized.includes('semantic/color')) score -= 4;
  if (normalized.endsWith('background/primary')) score -= 2;

  return score;
}

/**
 * Resolves the `Background/Primary` color variable.
 */
export async function findBackgroundPrimaryVariable(params?: {
  preferredCollectionId?: string;
  useLibrary?: boolean;
}): Promise<Variable | null> {
  const preferredCollectionId = params?.preferredCollectionId;
  const useLibrary = params?.useLibrary !== false;

  const variables = await getLocalVariablesSafe();
  const colorVariables = variables.filter(
    (variable) => variable.resolvedType === 'COLOR' && matchesBackgroundPrimaryName(variable.name)
  );

  if (colorVariables.length > 0) {
    colorVariables.sort(
      (a, b) =>
        scoreBackgroundPrimaryVariable(a, preferredCollectionId) -
        scoreBackgroundPrimaryVariable(b, preferredCollectionId)
    );
    return colorVariables[0] ?? null;
  }

  if (!useLibrary) return null;

  const libraryCollections = await getLibraryVariableCollectionsSafe();
  const preferredLibraryCollection = findTypographyColorsCollection(libraryCollections);
  const candidateCollections = preferredLibraryCollection
    ? [
        preferredLibraryCollection,
        ...libraryCollections.filter((collection) => collection.key !== preferredLibraryCollection.key),
      ]
    : libraryCollections;

  for (const collection of candidateCollections) {
    const collectionVars = await getVariablesInLibraryCollectionSafe(collection.key);
    const match = collectionVars.find(
      (variable) =>
        variable.resolvedType === 'COLOR' && matchesBackgroundPrimaryName(variable.name)
    );
    if (!match?.key) continue;
    const imported = await importVariableByKeySafe(match.key);
    if (imported?.resolvedType === 'COLOR') return imported;
  }

  return null;
}

async function getVariableCollectionByIdSafe(
  collectionId: string
): Promise<VariableCollection | null> {
  const api = figma.variables;
  if (!api) return null;

  if (typeof api.getVariableCollectionByIdAsync === 'function') {
    try {
      const collection = await api.getVariableCollectionByIdAsync(collectionId);
      if (collection) return collection;
    } catch (error) {
      warnOnce(
        'themes-get-collection-async-failed',
        '[Themes] getVariableCollectionByIdAsync failed:',
        error
      );
    }
  }

  const collections = await getLocalVariableCollectionsSafe();
  const fromList = collections.find((collection) => collection.id === collectionId);
  if (fromList) return fromList;

  try {
    return api.getVariableCollectionById(collectionId) ?? null;
  } catch {
    return null;
  }
}

function findModeInCollection(
  collection: VariableCollection,
  candidates: string[]
): VariableCollection['modes'][number] | null {
  const normalizedCandidates = candidates.map(normalizeModeName);

  for (const candidate of normalizedCandidates) {
    const match = collection.modes.find(
      (mode) => normalizeModeName(mode.name) === candidate
    );
    if (match) return match;
  }

  return null;
}

export function findLightDarkModes(collection: VariableCollection): {
  lightMode: VariableCollection['modes'][number] | null;
  darkMode: VariableCollection['modes'][number] | null;
} {
  const exactLight = findModeInCollection(collection, ['Light']);
  const lightMode =
    exactLight ?? findModeInCollection(collection, ['Auto (Light)', 'Светлая', 'Светлая тема']);

  const exactDark = findModeInCollection(collection, ['Dark']);
  const darkMode =
    exactDark ?? findModeInCollection(collection, ['Тёмная', 'Темная', 'Тёмная тема']);

  return { lightMode, darkMode };
}

export function findTypographyColorsCollection<
  T extends { name: string }
>(collections: readonly T[]): T | null {
  const exact = collections.find(
    (collection) => normalizeName(collection.name) === TYPOGRAPHY_COLORS_COLLECTION
  );
  if (exact) return exact;
  return (
    collections.find(
      (collection) =>
        normalizeName(collection.name).includes('typography') &&
        normalizeName(collection.name).includes('color')
    ) ?? null
  );
}

export function createBoundBackgroundPrimaryPaint(params: {
  variable: Variable;
  fallbackColor: RGB;
}): { paint: SolidPaint; bound: boolean } {
  const fallbackPaint: SolidPaint = {
    type: 'SOLID',
    color: params.fallbackColor,
  };
  const setBound = figma.variables?.setBoundVariableForPaint;
  if (typeof setBound !== 'function') {
    return { paint: fallbackPaint, bound: false };
  }
  try {
    const bound = setBound.call(figma.variables, fallbackPaint, 'color', params.variable);
    return { paint: bound, bound: true };
  } catch (error) {
    warnOnce(
      'themes-background-fill-bind-failed',
      '[Themes] Background/Primary fill binding failed:',
      error
    );
    return { paint: fallbackPaint, bound: false };
  }
}

export async function resolveThemeVariables(options?: {
  useLibrary?: boolean;
}): Promise<ThemeVariablesResult> {
  if (cachedThemeVariables) return cachedThemeVariables;
  if (cachedThemeVariablesPromise) return cachedThemeVariablesPromise;

  cachedThemeVariablesPromise = (async () => {
    const localCollections = await getLocalVariableCollectionsSafe();
    const preferredCollection = findTypographyColorsCollection(localCollections);

    const backgroundPrimary = await findBackgroundPrimaryVariable({
      preferredCollectionId: preferredCollection?.id,
      useLibrary: options?.useLibrary !== false,
    });

    if (!backgroundPrimary) {
      warnOnce(
        'themes-background-primary-missing',
        '[Themes] Background/Primary variable was not found.'
      );
      return {
        themeInfo: null,
        collection: null,
        backgroundPrimaryVariable: null,
        lightMode: null,
        darkMode: null,
      };
    }

    const collection = await getVariableCollectionByIdSafe(backgroundPrimary.variableCollectionId);
    if (!collection) {
      warnOnce(
        'themes-collection-missing',
        '[Themes] Variable collection for Background/Primary was not found:',
        backgroundPrimary.variableCollectionId
      );
      return {
        themeInfo: null,
        collection: null,
        backgroundPrimaryVariable: backgroundPrimary,
        lightMode: null,
        darkMode: null,
      };
    }

    const { lightMode, darkMode } = findLightDarkModes(collection);

    if (!lightMode) {
      warnOnce(
        'themes-light-mode-missing',
        '[Themes] Light mode was not found in collection:',
        collection.name
      );
    }
    if (!darkMode) {
      warnOnce(
        'themes-dark-mode-missing',
        '[Themes] Dark mode was not found in collection:',
        collection.name
      );
    }

    const themeInfo =
      lightMode && darkMode
        ? {
            collectionId: collection.id,
            collectionName: collection.name,
            lightModeId: lightMode.modeId,
            lightModeName: lightMode.name,
            darkModeId: darkMode.modeId,
            darkModeName: darkMode.name,
            backgroundPrimaryVariableId: backgroundPrimary.id,
            backgroundPrimaryVariable: backgroundPrimary,
            modeSourcePath: SEMANTIC_COLOR_MODE_PATH,
          }
        : null;

    return {
      themeInfo,
      collection,
      backgroundPrimaryVariable: backgroundPrimary,
      lightMode: lightMode ?? null,
      darkMode: darkMode ?? null,
    };
  })();

  try {
    cachedThemeVariables = await cachedThemeVariablesPromise;
    return cachedThemeVariables;
  } finally {
    cachedThemeVariablesPromise = null;
  }
}

/**
 * Resolves Light/Dark modes from the collection that owns `Background/Primary`.
 */
export async function resolveThemeModeInfoFromBackgroundPrimary(): Promise<ThemeModeInfo | null> {
  const resolved = await resolveThemeVariables();
  return resolved.themeInfo;
}

/** Backward-compatible alias. */
export async function findTypographyColorsSemanticColorModes(): Promise<ThemeModeInfo | null> {
  return resolveThemeModeInfoFromBackgroundPrimary();
}

/** Backward-compatible alias. */
export async function findTypographyColorsThemeModes(): Promise<ThemeModeInfo | null> {
  return resolveThemeModeInfoFromBackgroundPrimary();
}

/** Backward-compatible alias. */
export async function findThemeModes(): Promise<ThemeModeInfo | null> {
  return resolveThemeModeInfoFromBackgroundPrimary();
}

type VariableModeCapable = SceneNode & {
  setExplicitVariableModeForCollection?: (collectionId: string, modeId: string) => void;
};

export function setExplicitModeOnNode(params: {
  node: SceneNode;
  collectionId: string;
  modeId: string;
}): void {
  const capable = params.node as VariableModeCapable;
  if (typeof capable.setExplicitVariableModeForCollection !== 'function') {
    warnOnce(
      'themes-explicit-mode-api-missing',
      '[Themes] setExplicitVariableModeForCollection is unavailable on',
      params.node.name
    );
    return;
  }

  try {
    capable.setExplicitVariableModeForCollection(params.collectionId, params.modeId);
  } catch (error) {
    warnOnce(
      `themes-explicit-mode-failed:${params.node.type}`,
      '[Themes] setExplicitVariableModeForCollection failed on',
      params.node.name,
      error
    );
  }
}

export function applyExplicitVariableModeToSubtree(params: {
  node: SceneNode;
  collectionId: string;
  modeId: string;
}): void {
  setExplicitModeOnNode(params);

  if ('children' in params.node && Array.isArray(params.node.children)) {
    for (const child of params.node.children) {
      applyExplicitVariableModeToSubtree({
        node: child as SceneNode,
        collectionId: params.collectionId,
        modeId: params.modeId,
      });
    }
  }
}

/** Backward-compatible alias. */
export function applyVariableModeToNode(
  node: SceneNode,
  collectionId: string,
  modeId: string
): void {
  applyExplicitVariableModeToSubtree({ node, collectionId, modeId });
}

export function bindBackgroundPrimaryFill(params: {
  node: GeometryMixin;
  variable: Variable;
  fallbackColor: RGB;
}): boolean {
  const bound = createBoundBackgroundPrimaryPaint({
    variable: params.variable,
    fallbackColor: params.fallbackColor,
  });
  params.node.fills = [bound.paint];
  return bound.bound;
}
