/// <reference types="@figma/plugin-typings" />

import { formatPluginError } from './variables';

let localTextStylesCache: TextStyle[] | null = null;
let localPaintStylesCache: PaintStyle[] | null = null;
let localEffectStylesCache: EffectStyle[] | null = null;
let localGridStylesCache: GridStyle[] | null = null;

/** Сброс кэша (например, в начале новой сборки спецификации). */
export function clearLocalStylesCache(): void {
  localTextStylesCache = null;
  localPaintStylesCache = null;
  localEffectStylesCache = null;
  localGridStylesCache = null;
}

async function loadStylesAsync<T>(
  label: string,
  asyncGetter: (() => Promise<T[]>) | undefined
): Promise<T[]> {
  if (!asyncGetter) return [];
  try {
    return await asyncGetter();
  } catch (error) {
    console.warn(`[LocalStyles] ${label} failed:`, formatPluginError(error));
    return [];
  }
}

export async function getLocalTextStylesSafe(): Promise<TextStyle[]> {
  if (localTextStylesCache) return localTextStylesCache;
  localTextStylesCache = await loadStylesAsync(
    'getLocalTextStylesAsync',
    typeof figma.getLocalTextStylesAsync === 'function'
      ? () => figma.getLocalTextStylesAsync()
      : undefined
  );
  return localTextStylesCache;
}

export async function getLocalPaintStylesSafe(): Promise<PaintStyle[]> {
  if (localPaintStylesCache) return localPaintStylesCache;
  localPaintStylesCache = await loadStylesAsync(
    'getLocalPaintStylesAsync',
    typeof figma.getLocalPaintStylesAsync === 'function'
      ? () => figma.getLocalPaintStylesAsync()
      : undefined
  );
  return localPaintStylesCache;
}

export async function getLocalEffectStylesSafe(): Promise<EffectStyle[]> {
  if (localEffectStylesCache) return localEffectStylesCache;
  localEffectStylesCache = await loadStylesAsync(
    'getLocalEffectStylesAsync',
    typeof figma.getLocalEffectStylesAsync === 'function'
      ? () => figma.getLocalEffectStylesAsync()
      : undefined
  );
  return localEffectStylesCache;
}

export async function getLocalGridStylesSafe(): Promise<GridStyle[]> {
  if (localGridStylesCache) return localGridStylesCache;
  localGridStylesCache = await loadStylesAsync(
    'getLocalGridStylesAsync',
    typeof figma.getLocalGridStylesAsync === 'function'
      ? () => figma.getLocalGridStylesAsync()
      : undefined
  );
  return localGridStylesCache;
}

/** Предзагрузка local styles одним проходом (для StyleResolver.init). */
export async function preloadLocalStylesCache(): Promise<void> {
  await Promise.all([
    getLocalTextStylesSafe(),
    getLocalPaintStylesSafe(),
    getLocalEffectStylesSafe(),
    getLocalGridStylesSafe(),
  ]);
}
