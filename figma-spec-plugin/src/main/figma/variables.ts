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

/** Local variables: async first (required for dynamic-page), sync as fallback. */
export async function getLocalVariablesSafe(): Promise<Variable[]> {
  const api = figma.variables;
  if (!api) return [];

  if (typeof api.getLocalVariablesAsync === 'function') {
    try {
      return await api.getLocalVariablesAsync();
    } catch (error) {
      console.warn('[Variables] getLocalVariablesAsync failed:', formatPluginError(error));
    }
  }

  if (typeof api.getLocalVariables === 'function') {
    try {
      return api.getLocalVariables();
    } catch (error) {
      console.warn('[Variables] getLocalVariables failed:', formatPluginError(error));
    }
  }

  return [];
}

/** Local variable collections: async first. */
export async function getLocalVariableCollectionsSafe(): Promise<VariableCollection[]> {
  const api = figma.variables;
  if (!api) return [];

  if (typeof api.getLocalVariableCollectionsAsync === 'function') {
    try {
      return await api.getLocalVariableCollectionsAsync();
    } catch (error) {
      console.warn(
        '[Variables] getLocalVariableCollectionsAsync failed:',
        formatPluginError(error)
      );
    }
  }

  if (typeof api.getLocalVariableCollections === 'function') {
    try {
      return api.getLocalVariableCollections();
    } catch (error) {
      console.warn('[Variables] getLocalVariableCollections failed:', formatPluginError(error));
    }
  }

  return [];
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
  const variablesApi = figma.variables as typeof figma.variables & LibraryVariablesApi;
  if (typeof variablesApi.getAvailableLibraryVariableCollectionsAsync === 'function') {
    try {
      return await variablesApi.getAvailableLibraryVariableCollectionsAsync();
    } catch (error) {
      console.warn(
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
      console.warn(
        '[Variables] teamLibrary.getAvailableLibraryVariableCollectionsAsync failed:',
        formatPluginError(error)
      );
    }
  }

  return [];
}

export async function getVariablesInLibraryCollectionSafe(
  collectionKey: string
): Promise<LibraryVariable[]> {
  const variablesApi = figma.variables as typeof figma.variables & LibraryVariablesApi;
  if (typeof variablesApi.getVariablesInLibraryCollectionAsync === 'function') {
    try {
      return await variablesApi.getVariablesInLibraryCollectionAsync(collectionKey);
    } catch (error) {
      console.warn(
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
      console.warn(
        '[Variables] teamLibrary.getVariablesInLibraryCollectionAsync failed:',
        formatPluginError(error)
      );
    }
  }

  return [];
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

    const collections = await getLibraryVariableCollectionsSafe();
    for (const collection of collections) {
      const libVars = await getVariablesInLibraryCollectionSafe(collection.key);
      for (const libVar of libVars) {
        try {
          const imported = await figma.variables.importVariableByKeyAsync(libVar.key);
          registerVariableInIdRegistry(imported, libVar.key);
        } catch {
          /* library variable may be unavailable */
        }
      }
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
