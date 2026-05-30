import type { SpecLayerOption } from './messages';

/** Decomposition path for the selected source root node. */
export const ROOT_LAYER_PATH = '';

export const DEBUG_SELECTION_PERSISTENCE = false;

export function isValidLayerPath(path: unknown): path is string {
  return typeof path === 'string' && (path === ROOT_LAYER_PATH || path.length > 0);
}

/** Preserves the empty root path; removes invalid/duplicate entries. */
export function normalizeLayerPathArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of value) {
    const path = item === ROOT_LAYER_PATH ? ROOT_LAYER_PATH : String(item ?? '').trim();
    if (!isValidLayerPath(path)) continue;
    if (seen.has(path)) continue;
    seen.add(path);
    result.push(path);
  }

  return result;
}

export function collectSelectableLayerPaths(
  options: Array<Pick<SpecLayerOption, 'path' | 'isSelectable'>>
): Set<string> {
  const result = new Set<string>();
  for (const option of options) {
    if (option.isSelectable) {
      result.add(option.path);
    }
  }
  return result;
}

export function sanitizeSelectedLayerPaths(
  selectedPaths: string[],
  options: Array<Pick<SpecLayerOption, 'path' | 'isSelectable'>>
): string[] {
  const selectablePaths = collectSelectableLayerPaths(options);
  return normalizeLayerPathArray(selectedPaths).filter((path) => selectablePaths.has(path));
}

export function filterSelectedLayerPathsForProcessing(paths: string[] | undefined): string[] {
  return normalizeLayerPathArray(paths ?? []);
}

export function logSelectionPersistence(
  label: string,
  payload: Record<string, unknown>
): void {
  if (!DEBUG_SELECTION_PERSISTENCE) return;
  console.debug(`[Selection] ${label}`, payload);
}
