import type { PluginSettings } from '@shared/settings';
import { ENABLE_HEADER_BLOCK } from '@shared/featureFlags';
import { ACTIVE_FIRST_TOGGLE_ITEMS, type ToggleSettingKey } from './toggleItems';
import { ToggleRow } from './ToggleRow';

type Props = {
  settings: PluginSettings;
  onChange: (next: PluginSettings) => void;
};

export function SettingsPanel({
  settings,
  onChange,
}: Props) {
  const toggleItems = ACTIVE_FIRST_TOGGLE_ITEMS.filter(
    (item) => ENABLE_HEADER_BLOCK || item.key !== 'header'
  );

  return (
    <section className="settings-section">
      <div className="toggle-list">
        {toggleItems.map((item) => {
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
