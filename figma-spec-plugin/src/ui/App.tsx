import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_PLUGIN_SETTINGS,
  withHiddenSpecificationPreferences,
  type PluginSettings,
} from '@shared/settings';
import type { MainToUiMessage } from '@shared/messages';
import { postToMain } from './postToMain';
import { SettingsPanel } from './components/SettingsPanel';
import { GenerateButton } from './components/GenerateButton';
import { StatusMessage } from './components/StatusMessage';

function isMainMessage(data: unknown): data is MainToUiMessage {
  if (!data || typeof data !== 'object') return false;
  const t = (data as { type?: unknown }).type;
  return typeof t === 'string';
}

/** Figma delivers main→UI payloads on `event.data.pluginMessage` (see plugin docs). */
function unwrapMainPayload(raw: unknown): unknown {
  if (raw && typeof raw === 'object' && 'pluginMessage' in raw) {
    return (raw as { pluginMessage: unknown }).pluginMessage;
  }
  return raw;
}

export function App() {
  const [settings, setSettings] = useState<PluginSettings>(DEFAULT_PLUGIN_SETTINGS);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    postToMain({ type: 'GET_SETTINGS' });
  }, []);

  useEffect(() => {
    function onWindowMessage(event: MessageEvent) {
      const data = unwrapMainPayload(event.data);
      if (!isMainMessage(data)) return;

      if (data.type === 'SETTINGS_LOADED') {
        setSettings(withHiddenSpecificationPreferences(data.payload.settings));
        return;
      }

      if (data.type === 'READY') {
        return;
      }

      if (data.type === 'SPECIFICATION_BUILT') {
        setBusy(false);
        setError(null);
        setStatus(
          data.payload.name
            ? `Спецификация собрана: ${data.payload.name}`
            : 'Спецификация собрана'
        );
        return;
      }

      if (data.type === 'ERROR') {
        setBusy(false);
        setError(data.payload.message || 'Неизвестная ошибка.');
        setStatus('');
      }
    }

    window.addEventListener('message', onWindowMessage);
    return () => window.removeEventListener('message', onWindowMessage);
  }, []);

  const onGenerate = useCallback(() => {
    setBusy(true);
    setError(null);
    setStatus('');
    postToMain({
      type: 'BUILD_SPECIFICATION',
      payload: { settings: withHiddenSpecificationPreferences(settings) },
    });
  }, [settings]);

  return (
    <>
      <h1>Spec Generator</h1>
      <SettingsPanel settings={settings} onChange={setSettings} />
      <GenerateButton busy={busy} onClick={onGenerate} />
      {error ? <StatusMessage text={error} variant="error" /> : null}
      {!error && status ? <StatusMessage text={status} variant="success" /> : null}
    </>
  );
}
