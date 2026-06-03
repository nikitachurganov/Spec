import type { PluginSettings } from '@shared/settings';

export type ToggleSettingKey =
  | keyof Pick<
      PluginSettings,
      | 'header'
      | 'componentAnatomy'
      | 'spec'
      | 'componentsProperties'
      | 'behavior'
      | 'usageScenarios'
      | 'accessibility'
      | 'themes'
    >;

export type ToggleItemConfig = {
  key: ToggleSettingKey;
  label: string;
  enabled: boolean;
};

/**
 * Toggle list order (UI only). Generated documentation order is fixed in
 * `DOCUMENTATION_BLOCK_ORDER` (shared/documentationBlockOrder.ts).
 */
export const ACTIVE_FIRST_TOGGLE_ITEMS: ToggleItemConfig[] = [
  { key: 'header', label: 'Шапка', enabled: true },
  { key: 'componentsProperties', label: 'Components & properties', enabled: true },
  { key: 'componentAnatomy', label: 'Anatomy', enabled: true },
  { key: 'behavior', label: 'Behavior', enabled: false },
  { key: 'usageScenarios', label: 'Use case', enabled: false },
  { key: 'spec', label: 'Spec', enabled: true },
  { key: 'accessibility', label: 'Accessibility', enabled: true },
  { key: 'themes', label: 'Themes', enabled: true },
];
