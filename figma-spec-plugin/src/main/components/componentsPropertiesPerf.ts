/// <reference types="@figma/plugin-typings" />

/** Set true to log detailed Components & properties stage timings. */
export const DEBUG_COMPONENTS_PROPERTIES_PERF = false;

export const COMPONENTS_PROPERTIES_TARGET_MS = 15_000;

export function cpTimeStart(label: string): void {
  if (DEBUG_COMPONENTS_PROPERTIES_PERF) {
    console.time(label);
  }
}

export function cpTimeEnd(label: string): void {
  if (DEBUG_COMPONENTS_PROPERTIES_PERF) {
    console.timeEnd(label);
  }
}

export function warnComponentsPropertiesSlow(elapsedMs: number): void {
  if (elapsedMs > COMPONENTS_PROPERTIES_TARGET_MS) {
    console.warn(
      `[Components & properties] generation took ${elapsedMs}ms, target is <= ${COMPONENTS_PROPERTIES_TARGET_MS}ms`
    );
  }
}
