import { DEFAULT_PLUGIN_SETTINGS, applyDocumentationFeatureFlags, type PluginSettings } from '../../shared/settings';
import { normalizeHeaderSettings } from '../../shared/headerSettings';
import { normalizeLayerPathArray } from '../../shared/layerPaths';

type LegacySettingsInput = Partial<PluginSettings> & {
  containers?: boolean;
  anatomy?: boolean;
};

export function normalizeStringArray(value: unknown): string[] {
  return normalizeLayerPathArray(value);
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

  return applyDocumentationFeatureFlags({
    header: typeof o.header === 'boolean' ? o.header : DEFAULT_PLUGIN_SETTINGS.header,
    headerSettings: normalizeHeaderSettings(o.headerSettings),
    componentAnatomy,
    spec,
    specSelectedLayerPaths: normalizeStringArray(o.specSelectedLayerPaths),
    anatomySelectedLayerPaths: normalizeStringArray(o.anatomySelectedLayerPaths),
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
  });
}
