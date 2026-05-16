import type { PluginSettings } from '@shared/settings';
import { ACTIVE_FIRST_TOGGLE_ITEMS, type ToggleSettingKey } from './toggleItems';
import { ToggleRow } from './ToggleRow';

type Props = {
  settings: PluginSettings;
  onChange: (next: PluginSettings) => void;
};

export function SettingsPanel({ settings, onChange }: Props) {
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
    </section>
  );
}
