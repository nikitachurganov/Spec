/// <reference types="@figma/plugin-typings" />

/** Set true to log generation block timings to the Figma console. */
export const DEBUG_GENERATION_PERFORMANCE = false;

export const COMPONENTS_PROPERTIES_TARGET_MS = 15_000;

export function perfTimeStart(label: string): void {
  if (DEBUG_GENERATION_PERFORMANCE) {
    console.time(label);
  }
}

export function perfTimeEnd(label: string): void {
  if (DEBUG_GENERATION_PERFORMANCE) {
    console.timeEnd(label);
  }
}

export function warnIfSlow(label: string, elapsedMs: number, targetMs: number): void {
  if (elapsedMs > targetMs) {
    console.warn(`[${label}] generation took ${elapsedMs}ms, target is <= ${targetMs}ms`);
  }
}

export async function measureAsync<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  perfTimeStart(label);
  try {
    return await fn();
  } finally {
    perfTimeEnd(label);
    warnIfSlow(label, Date.now() - start, COMPONENTS_PROPERTIES_TARGET_MS);
  }
}
