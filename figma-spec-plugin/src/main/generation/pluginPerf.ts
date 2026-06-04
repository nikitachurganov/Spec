/** Set true to log lightweight performance timings in the plugin main thread. */
export const DEBUG_PERFORMANCE = false;

export function logPluginPerf(label: string, startMs: number): void {
  if (!DEBUG_PERFORMANCE) return;
  console.info(`[Perf] ${label}: ${Math.round(performance.now() - startMs)}ms`);
}

export function perfNow(): number {
  return performance.now();
}
