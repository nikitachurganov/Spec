import type { PluginSettings } from '@shared/settings';

export type ToggleSettingKey =
  | keyof Pick<
      PluginSettings,
      | 'header'
      | 'componentAnatomy'
      | 'spec'
      | 'variants'
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
 * When all sections become interactive, use canonical order:
 * Header, Variants, Behavior, Usage scenarios, Accessibility, Anatomy, Spacing, Themes.
 * For now active items are placed first: Header, Anatomy, Spacing.
 */
export const ACTIVE_FIRST_TOGGLE_ITEMS: ToggleItemConfig[] = [
  { key: 'header', label: 'Шапка', enabled: true },
  { key: 'componentAnatomy', label: 'Анатомия', enabled: true },
  { key: 'spec', label: 'Отступы', enabled: true },
  { key: 'variants', label: 'Варианты компонента', enabled: false },
  { key: 'behavior', label: 'Поведение', enabled: false },
  { key: 'usageScenarios', label: 'Сценарии использования', enabled: false },
  { key: 'accessibility', label: 'Доступность', enabled: false },
  { key: 'themes', label: 'Темы', enabled: false },
];
