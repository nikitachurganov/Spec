import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_PLUGIN_SETTINGS,
  hasAnySpecificationBlock,
  withHiddenSpecificationPreferences,
  type PluginSettings,
} from '@shared/settings';
import type { MainToUiMessage } from '@shared/messages';
import { postToMain } from './postToMain';
import { SettingsPanel } from './components/SettingsPanel';
import { StatusMessage } from './components/StatusMessage';

const NO_BLOCKS_ERROR = 'Выберите хотя бы один блок спецификации.';

function isMainMessage(data: unknown): data is MainToUiMessage {
  if (!data || typeof data !== 'object') return false;
  const t = (data as { type?: unknown }).type;
  return typeof t === 'string';
}

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

  const handleGenerate = useCallback(() => {
    if (busy) return;

    if (!hasAnySpecificationBlock(settings)) {
      setError(NO_BLOCKS_ERROR);
      setStatus('');
      return;
    }

    setBusy(true);
    setError(null);
    setStatus('');
    postToMain({
      type: 'BUILD_SPECIFICATION',
      payload: { settings: withHiddenSpecificationPreferences(settings) },
    });
  }, [settings, busy]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="start-banner">
          <span className="start-banner__text">Выберите компонент или фрейм</span>
          <button
            type="button"
            className="start-banner__button"
            disabled={busy}
            onClick={handleGenerate}
            data-hierarchy="primary"
            data-size="small 36 px"
            data-state={busy ? 'loading' : 'default'}
            data-istoggled="false"
            data-icon-left="false"
            data-icon-right="false"
          >
            <span className="start-banner__button-text">
              {busy ? 'Собираю...' : 'Начать'}
            </span>
          </button>
        </div>
      </header>

      <main className="app-content">
        <SettingsPanel settings={settings} onChange={setSettings} />
        {error ? <StatusMessage text={error} variant="error" /> : null}
        {!error && status ? <StatusMessage text={status} variant="success" /> : null}
      </main>
    </div>
  );
}
