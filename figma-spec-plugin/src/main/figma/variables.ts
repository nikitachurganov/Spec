/// <reference types="@figma/plugin-typings" />

export function formatPluginError(error: unknown): string {
  if (error instanceof Error) {
    return error.message || error.name || 'Error';
  }
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

const warnedVariableKeys = new Set<string>();

function warnOnce(key: string, message: string, ...args: unknown[]): void {
  if (warnedVariableKeys.has(key)) return;
  warnedVariableKeys.add(key);
  console.warn(message, ...args);
}

let localVariablesCache: Variable[] | null = null;
let localVariablesPromise: Promise<Variable[]> | null = null;

let localCollectionsCache: VariableCollection[] | null = null;
let localCollectionsPromise: Promise<VariableCollection[]> | null = null;

let libraryCollectionsCache: LibraryVariableCollection[] | null = null;
let libraryCollectionsPromise: Promise<LibraryVariableCollection[]> | null = null;

const libraryVariablesByCollectionCache = new Map<string, LibraryVariable[]>();
const libraryVariablesByCollectionPromise = new Map<string, Promise<LibraryVariable[]>>();

const importedVariableByKeyCache = new Map<string, Variable | null>();
const importedVariableByKeyPromise = new Map<string, Promise<Variable | null>>();

export function resetVariableApiCaches(): void {
  localVariablesCache = null;
  localVariablesPromise = null;
  localCollectionsCache = null;
  localCollectionsPromise = null;
  libraryCollectionsCache = null;
  libraryCollectionsPromise = null;
  libraryVariablesByCollectionCache.clear();
  libraryVariablesByCollectionPromise.clear();
  importedVariableByKeyCache.clear();
  importedVariableByKeyPromise.clear();
  warnedVariableKeys.clear();
}

/** Local variables: async first (required for dynamic-page), sync as fallback. */
export async function getLocalVariablesSafe(): Promise<Variable[]> {
  if (localVariablesCache) return localVariablesCache;
  if (localVariablesPromise) return localVariablesPromise;

  localVariablesPromise = (async () => {
  const api = figma.variables;
  if (!api) return [];

  if (typeof api.getLocalVariablesAsync === 'function') {
    try {
      return await api.getLocalVariablesAsync();
    } catch (error) {
      warnOnce(
        'variables-local-async-failed',
        '[Variables] getLocalVariablesAsync failed:',
        formatPluginError(error)
      );
    }
  }

  if (typeof api.getLocalVariables === 'function') {
    try {
      return api.getLocalVariables();
    } catch (error) {
      warnOnce(
        'variables-local-sync-failed',
        '[Variables] getLocalVariables failed:',
        formatPluginError(error)
      );
    }
  }

  return [];
  })();

  try {
    localVariablesCache = await localVariablesPromise;
    return localVariablesCache;
  } finally {
    localVariablesPromise = null;
  }
}

/** Local variable collections: async first. */
export async function getLocalVariableCollectionsSafe(): Promise<VariableCollection[]> {
  if (localCollectionsCache) return localCollectionsCache;
  if (localCollectionsPromise) return localCollectionsPromise;

  localCollectionsPromise = (async () => {
  const api = figma.variables;
  if (!api) return [];

  if (typeof api.getLocalVariableCollectionsAsync === 'function') {
    try {
      return await api.getLocalVariableCollectionsAsync();
    } catch (error) {
      warnOnce(
        'variables-local-collections-async-failed',
        '[Variables] getLocalVariableCollectionsAsync failed:',
        formatPluginError(error)
      );
    }
  }

  if (typeof api.getLocalVariableCollections === 'function') {
    try {
      return api.getLocalVariableCollections();
    } catch (error) {
      warnOnce(
        'variables-local-collections-sync-failed',
        '[Variables] getLocalVariableCollections failed:',
        formatPluginError(error)
      );
    }
  }

  return [];
  })();

  try {
    localCollectionsCache = await localCollectionsPromise;
    return localCollectionsCache;
  } finally {
    localCollectionsPromise = null;
  }
}

export function getVariableNumericValue(
  variable: Variable,
  collection: VariableCollection | null,
  depth = 0
): number | null {
  if (depth > 5) return null;
  if (variable.resolvedType !== 'FLOAT') return null;

  const modeId =
    collection?.defaultModeId ?? collection?.modes?.[0]?.modeId ?? Object.keys(variable.valuesByMode)[0];
  if (!modeId) return null;

  const value = variable.valuesByMode[modeId];
  if (typeof value === 'number') {
    return value;
  }

  if (value && typeof value === 'object' && 'type' in value && value.type === 'VARIABLE_ALIAS') {
    const alias = value as VariableAlias;
    try {
      const target = figma.variables.getVariableById(alias.id);
      if (!target) return null;
      const targetCollection = target.variableCollectionId
        ? figma.variables.getVariableCollectionById(target.variableCollectionId)
        : null;
      return getVariableNumericValue(target, targetCollection, depth + 1);
    } catch {
      return null;
    }
  }

  return null;
}

type LibraryVariablesApi = {
  getAvailableLibraryVariableCollectionsAsync?: () => Promise<LibraryVariableCollection[]>;
  getVariablesInLibraryCollectionAsync?: (collectionKey: string) => Promise<LibraryVariable[]>;
};

/** Library variable collections from `figma.variables` or `figma.teamLibrary`. */
export async function getLibraryVariableCollectionsSafe(): Promise<LibraryVariableCollection[]> {
  if (libraryCollectionsCache) return libraryCollectionsCache;
  if (libraryCollectionsPromise) return libraryCollectionsPromise;

  libraryCollectionsPromise = (async () => {
  const variablesApi = figma.variables as typeof figma.variables & LibraryVariablesApi;
  if (typeof variablesApi.getAvailableLibraryVariableCollectionsAsync === 'function') {
    try {
      return await variablesApi.getAvailableLibraryVariableCollectionsAsync();
    } catch (error) {
      warnOnce(
        'variables-api-library-collections-failed',
        '[Variables] variables.getAvailableLibraryVariableCollectionsAsync failed:',
        formatPluginError(error)
      );
    }
  }

  const team = (figma as PluginAPI & { teamLibrary?: LibraryVariablesApi }).teamLibrary;
  if (typeof team?.getAvailableLibraryVariableCollectionsAsync === 'function') {
    try {
      return await team.getAvailableLibraryVariableCollectionsAsync();
    } catch (error) {
      warnOnce(
        'variables-team-library-collections-failed',
        '[Variables] teamLibrary.getAvailableLibraryVariableCollectionsAsync failed:',
        formatPluginError(error)
      );
    }
  }

  return [];
  })();

  try {
    libraryCollectionsCache = await libraryCollectionsPromise;
    return libraryCollectionsCache;
  } finally {
    libraryCollectionsPromise = null;
  }
}

export async function getVariablesInLibraryCollectionSafe(
  collectionKey: string
): Promise<LibraryVariable[]> {
  if (!collectionKey) return [];
  const cached = libraryVariablesByCollectionCache.get(collectionKey);
  if (cached) return cached;
  const pending = libraryVariablesByCollectionPromise.get(collectionKey);
  if (pending) return pending;

  const request = (async () => {
  const variablesApi = figma.variables as typeof figma.variables & LibraryVariablesApi;
  if (typeof variablesApi.getVariablesInLibraryCollectionAsync === 'function') {
    try {
      return await variablesApi.getVariablesInLibraryCollectionAsync(collectionKey);
    } catch (error) {
      warnOnce(
        `variables-api-library-variables-failed:${collectionKey}`,
        '[Variables] variables.getVariablesInLibraryCollectionAsync failed:',
        formatPluginError(error)
      );
    }
  }

  const team = (figma as PluginAPI & { teamLibrary?: LibraryVariablesApi }).teamLibrary;
  if (typeof team?.getVariablesInLibraryCollectionAsync === 'function') {
    try {
      return await team.getVariablesInLibraryCollectionAsync(collectionKey);
    } catch (error) {
      warnOnce(
        `variables-team-library-variables-failed:${collectionKey}`,
        '[Variables] teamLibrary.getVariablesInLibraryCollectionAsync failed:',
        formatPluginError(error)
      );
    }
  }

  return [];
  })();

  libraryVariablesByCollectionPromise.set(collectionKey, request);
  try {
    const values = await request;
    libraryVariablesByCollectionCache.set(collectionKey, values);
    return values;
  } finally {
    libraryVariablesByCollectionPromise.delete(collectionKey);
  }
}

export async function importVariableByKeySafe(variableKey: string): Promise<Variable | null> {
  if (!variableKey) return null;
  if (importedVariableByKeyCache.has(variableKey)) {
    return importedVariableByKeyCache.get(variableKey) ?? null;
  }
  const pending = importedVariableByKeyPromise.get(variableKey);
  if (pending) return pending;

  const request = (async () => {
    if (typeof figma.variables?.importVariableByKeyAsync !== 'function') {
      warnOnce(
        'variables-import-by-key-unavailable',
        '[Variables] importVariableByKeyAsync is unavailable.'
      );
      return null;
    }
    try {
      return await figma.variables.importVariableByKeyAsync(variableKey);
    } catch (error) {
      warnOnce(
        `variables-import-by-key-failed:${variableKey}`,
        '[Variables] importVariableByKeyAsync failed:',
        formatPluginError(error)
      );
      return null;
    }
  })();

  importedVariableByKeyPromise.set(variableKey, request);
  try {
    const value = await request;
    importedVariableByKeyCache.set(variableKey, value);
    return value;
  } finally {
    importedVariableByKeyPromise.delete(variableKey);
  }
}

export type ResolvedVariableById = {
  variableId: string;
  name: string;
  key?: string;
};

const variableByIdRegistry = new Map<string, ResolvedVariableById>();
let variableByIdRegistryReady = false;
let variableByIdRegistryInit: Promise<void> | null = null;

function registerVariableInIdRegistry(variable: Variable, libraryKey?: string): void {
  variableByIdRegistry.set(variable.id, {
    variableId: variable.id,
    name: variable.name,
    key: libraryKey ?? variable.key,
  });
}

export function resetVariableByIdRegistry(): void {
  variableByIdRegistry.clear();
  variableByIdRegistryReady = false;
  variableByIdRegistryInit = null;
}

/**
 * Indexes local and library variables by `Variable.id` so bound spacing aliases can be resolved to names.
 */
export async function initVariableByIdRegistry(): Promise<void> {
  if (variableByIdRegistryReady) return;
  if (variableByIdRegistryInit) {
    await variableByIdRegistryInit;
    return;
  }

  variableByIdRegistryInit = (async () => {
    const locals = await getLocalVariablesSafe();
    for (const variable of locals) {
      registerVariableInIdRegistry(variable);
    }

    variableByIdRegistryReady = true;
  })();

  try {
    await variableByIdRegistryInit;
  } finally {
    variableByIdRegistryInit = null;
  }
}

/**
 * Resolves a Figma variable name from `boundVariables` alias id (`VariableID:…`).
 */
export async function resolveVariableByIdAsync(
  variableId: string
): Promise<ResolvedVariableById | null> {
  if (!variableId) return null;

  const cached = variableByIdRegistry.get(variableId);
  if (cached) return cached;

  const api = figma.variables;
  if (api && typeof api.getVariableByIdAsync === 'function') {
    try {
      const variable = await api.getVariableByIdAsync(variableId);
      if (variable) {
        registerVariableInIdRegistry(variable);
        return variableByIdRegistry.get(variableId) ?? null;
      }
    } catch (error) {
      console.warn(
        '[Variables] getVariableByIdAsync failed:',
        variableId,
        formatPluginError(error)
      );
    }
  }

  await initVariableByIdRegistry();

  const fromRegistry = variableByIdRegistry.get(variableId);
  if (fromRegistry) return fromRegistry;

  const locals = await getLocalVariablesSafe();
  for (const variable of locals) {
    if (variable.id === variableId) {
      registerVariableInIdRegistry(variable);
      return variableByIdRegistry.get(variableId) ?? null;
    }
  }

  return null;
}
