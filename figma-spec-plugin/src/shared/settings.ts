export type PluginSettings = {
  containers: boolean;
  anatomy: boolean;
  childOverlays: boolean;
  gapOverlays: boolean;
  useComponentPropertyNames: boolean;
  /** When true, resolve colors/numbers/text from local file + enabled library variables. */
  useLibraryTokens: boolean;
};

export const DEFAULT_PLUGIN_SETTINGS: PluginSettings = {
  containers: true,
  anatomy: true,
  childOverlays: true,
  gapOverlays: true,
  useComponentPropertyNames: true,
  useLibraryTokens: true,
};

/** Fields without UI toggles: always on when building / syncing from main. */
export function withHiddenSpecificationPreferences(settings: PluginSettings): PluginSettings {
  return {
    ...settings,
    childOverlays: true,
    gapOverlays: true,
    useComponentPropertyNames: true,
  };
}
