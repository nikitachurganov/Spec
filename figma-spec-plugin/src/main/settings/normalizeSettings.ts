import { DEFAULT_PLUGIN_SETTINGS, type PluginSettings } from '../../shared/settings';

type LegacySettingsInput = Partial<PluginSettings> & {
  containers?: boolean;
  anatomy?: boolean;
};

export function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

export function normalizePluginSettings(input: unknown): PluginSettings {
  if (!input || typeof input !== 'object') {
    return { ...DEFAULT_PLUGIN_SETTINGS };
  }

  const o = input as LegacySettingsInput;

  const spec =
    typeof o.spec === 'boolean'
      ? o.spec
      : typeof o.containers === 'boolean'
        ? o.containers
        : DEFAULT_PLUGIN_SETTINGS.spec;

  const componentAnatomy =
    typeof o.componentAnatomy === 'boolean'
      ? o.componentAnatomy
      : typeof o.anatomy === 'boolean'
        ? o.anatomy
        : DEFAULT_PLUGIN_SETTINGS.componentAnatomy;

  return {
    header: typeof o.header === 'boolean' ? o.header : DEFAULT_PLUGIN_SETTINGS.header,
    componentAnatomy,
    spec,
    specSelectedLayerPaths: normalizeStringArray(o.specSelectedLayerPaths),
    variants: typeof o.variants === 'boolean' ? o.variants : DEFAULT_PLUGIN_SETTINGS.variants,
    behavior: typeof o.behavior === 'boolean' ? o.behavior : DEFAULT_PLUGIN_SETTINGS.behavior,
    usageScenarios:
      typeof o.usageScenarios === 'boolean'
        ? o.usageScenarios
        : DEFAULT_PLUGIN_SETTINGS.usageScenarios,
    accessibility:
      typeof o.accessibility === 'boolean' ? o.accessibility : DEFAULT_PLUGIN_SETTINGS.accessibility,
    themes: typeof o.themes === 'boolean' ? o.themes : DEFAULT_PLUGIN_SETTINGS.themes,
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
