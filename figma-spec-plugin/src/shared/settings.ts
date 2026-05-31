import type { HeaderSettings } from './headerSettings';
import { DEFAULT_HEADER_SETTINGS } from './headerSettings';
import { ENABLE_HEADER_BLOCK } from './featureFlags';

export type { HeaderSettings };
export { DEFAULT_HEADER_SETTINGS };

export type PluginSettings = {
  header: boolean;
  headerSettings: HeaderSettings;
  componentAnatomy: boolean;
  spec: boolean;

  /** Paths from root as index segments joined by `/`, e.g. `1`, `1/0`, `1/2/0` */
  specSelectedLayerPaths: string[];
  anatomySelectedLayerPaths: string[];

  variants: boolean;
  behavior: boolean;
  usageScenarios: boolean;
  accessibility: boolean;
  themes: boolean;

  /** Технические настройки (не показываются в UI). */
  childOverlays: boolean;
  gapOverlays: boolean;
  useComponentPropertyNames: boolean;
  useLibraryTokens: boolean;
};

export const DEFAULT_PLUGIN_SETTINGS: PluginSettings = {
  header: false,
  headerSettings: { ...DEFAULT_HEADER_SETTINGS },
  componentAnatomy: true,
  spec: true,

  specSelectedLayerPaths: [],
  anatomySelectedLayerPaths: [],

  variants: false,
  behavior: false,
  usageScenarios: false,
  accessibility: true,
  themes: false,

  childOverlays: true,
  gapOverlays: true,
  useComponentPropertyNames: true,
  useLibraryTokens: true,
};

/** Forces disabled documentation blocks off while feature flags are inactive. */
export function applyDocumentationFeatureFlags(settings: PluginSettings): PluginSettings {
  if (ENABLE_HEADER_BLOCK) return settings;
  return {
    ...settings,
    header: false,
  };
}

/** Хотя бы один блок спецификации включён (активные toggles в UI). */
export function hasAnySpecificationBlock(settings: PluginSettings): boolean {
  return (
    (ENABLE_HEADER_BLOCK && settings.header) ||
    settings.componentAnatomy ||
    settings.spec ||
    settings.accessibility ||
    settings.themes
  );
}

/** Поля без UI-переключателей: всегда включены при сборке. */
export function withHiddenSpecificationPreferences(settings: PluginSettings): PluginSettings {
  return applyDocumentationFeatureFlags({
    ...settings,
    childOverlays: true,
    gapOverlays: true,
    useComponentPropertyNames: true,
  });
}
