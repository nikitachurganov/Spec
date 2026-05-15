import type { PluginSettings } from '@shared/settings';
import { SectionToggle } from './SectionToggle';

type Props = {
  settings: PluginSettings;
  onChange: (next: PluginSettings) => void;
};

export function SettingsPanel({ settings, onChange }: Props) {
  return (
    <div className="card">
      <h2>Блоки спецификации</h2>
      <SectionToggle
        label="Контейнеры"
        checked={settings.containers}
        onChange={(v) => onChange({ ...settings, containers: v })}
      />
      <SectionToggle
        label="Анатомия"
        checked={settings.anatomy}
        onChange={(v) => onChange({ ...settings, anatomy: v })}
      />
      <SectionToggle
        label="Использовать стили и токены из библиотеки"
        checked={settings.useLibraryTokens}
        onChange={(v) => onChange({ ...settings, useLibraryTokens: v })}
      />
    </div>
  );
}
