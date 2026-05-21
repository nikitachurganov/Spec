export type PluginSettings = {
  header: boolean;
  componentAnatomy: boolean;
  spec: boolean;

  /** Paths from root as index segments joined by `/`, e.g. `1`, `1/0`, `1/2/0` */
  specSelectedLayerPaths: string[];

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
  header: true,
  componentAnatomy: true,
  spec: true,

  specSelectedLayerPaths: [],

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

/** Хотя бы один блок спецификации включён (активные toggles в UI). */
export function hasAnySpecificationBlock(settings: PluginSettings): boolean {
  return (
    settings.header ||
    settings.componentAnatomy ||
    settings.spec ||
    settings.accessibility ||
    settings.themes
  );
}

/** Поля без UI-переключателей: всегда включены при сборке. */
export function withHiddenSpecificationPreferences(settings: PluginSettings): PluginSettings {
  return {
    ...settings,
    childOverlays: true,
    gapOverlays: true,
    useComponentPropertyNames: true,
  };
}
