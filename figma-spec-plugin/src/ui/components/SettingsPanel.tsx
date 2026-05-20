import type { PluginSettings } from '@shared/settings';
import type { SpecLayerOption } from '@shared/messages';
import { ACTIVE_FIRST_TOGGLE_ITEMS, type ToggleSettingKey } from './toggleItems';
import { SpecLayerMultiSelect } from './SpecLayerMultiSelect';
import { ToggleRow } from './ToggleRow';

type Props = {
  settings: PluginSettings;
  onChange: (next: PluginSettings) => void;
  specLayerOptions: SpecLayerOption[];
  specLayerOptionsLoading: boolean;
  specLayerOptionsError: string | null;
  specLayerEmptyHint: string;
  onSpecLayerSelectionChange: (selectedLayerPaths: string[]) => void;
  onRefreshSpecLayers: () => void;
  onResetSpecLayersToAuto: () => void;
};

export function SettingsPanel({
  settings,
  onChange,
  specLayerOptions,
  specLayerOptionsLoading,
  specLayerOptionsError,
  specLayerEmptyHint,
  onSpecLayerSelectionChange,
  onRefreshSpecLayers,
  onResetSpecLayersToAuto,
}: Props) {
  return (
    <section className="settings-section">
      <h2 className="settings-title">Блоки спецификации</h2>

      <div className="toggle-list">
        {ACTIVE_FIRST_TOGGLE_ITEMS.map((item) => {
          const key = item.key as ToggleSettingKey;
          const checked = Boolean(settings[key]);

          return (
            <ToggleRow
              key={item.key}
              label={item.label}
              checked={checked}
              disabled={!item.enabled}
              onChange={(nextChecked) => {
                if (!item.enabled) return;

                onChange({
                  ...settings,
                  [key]: nextChecked,
                });
              }}
            />
          );
        })}
      </div>

      <SpecLayerMultiSelect
        options={specLayerOptions}
        selectedPaths={settings.specSelectedLayerPaths}
        isLoading={specLayerOptionsLoading}
        error={specLayerOptionsError}
        emptyHint={specLayerEmptyHint}
        onChange={onSpecLayerSelectionChange}
        onRefresh={onRefreshSpecLayers}
        onResetToAuto={onResetSpecLayersToAuto}
      />
    </section>
  );
}
