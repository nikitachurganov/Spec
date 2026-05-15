import { DEFAULT_PLUGIN_SETTINGS, type PluginSettings } from '../../shared/settings';

export function normalizePluginSettings(input: unknown): PluginSettings {
  if (!input || typeof input !== 'object') {
    return Object.assign({}, DEFAULT_PLUGIN_SETTINGS);
  }
  const o = input as Partial<PluginSettings>;
  return {
    containers:
      typeof o.containers === 'boolean' ? o.containers : DEFAULT_PLUGIN_SETTINGS.containers,
    anatomy: typeof o.anatomy === 'boolean' ? o.anatomy : DEFAULT_PLUGIN_SETTINGS.anatomy,
    childOverlays:
      typeof o.childOverlays === 'boolean'
        ? o.childOverlays
        : DEFAULT_PLUGIN_SETTINGS.childOverlays,
    gapOverlays:
      typeof o.gapOverlays === 'boolean' ? o.gapOverlays : DEFAULT_PLUGIN_SETTINGS.gapOverlays,
    useComponentPropertyNames:
      typeof o.useComponentPropertyNames === 'boolean'
        ? o.useComponentPropertyNames
        : DEFAULT_PLUGIN_SETTINGS.useComponentPropertyNames,
    useLibraryTokens:
      typeof o.useLibraryTokens === 'boolean'
        ? o.useLibraryTokens
        : DEFAULT_PLUGIN_SETTINGS.useLibraryTokens,
  };
}
