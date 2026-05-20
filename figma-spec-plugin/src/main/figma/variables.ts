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
