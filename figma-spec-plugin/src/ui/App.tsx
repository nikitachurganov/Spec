import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_PLUGIN_SETTINGS,
  hasAnySpecificationBlock,
  withHiddenSpecificationPreferences,
  type PluginSettings,
} from '@shared/settings';
import type { MainToUiMessage, SpecLayerOption } from '@shared/messages';
import { postToMain } from './postToMain';
import { SettingsPanel } from './components/SettingsPanel';
import { StatusMessage } from './components/StatusMessage';

const NO_BLOCKS_ERROR = 'Выберите хотя бы один блок спецификации.';
const SPEC_LAYER_EMPTY_HINT =
  'Выберите компонент или фрейм, чтобы настроить слои для Spec.';

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

  const [specLayerOptions, setSpecLayerOptions] = useState<SpecLayerOption[]>([]);
  const [specLayerOptionsLoading, setSpecLayerOptionsLoading] = useState(false);
  const [specLayerOptionsError, setSpecLayerOptionsError] = useState<string | null>(null);
  const [autoSelectedLayerPaths, setAutoSelectedLayerPaths] = useState<string[]>([]);

  const requestSpecLayerOptions = useCallback(() => {
    setSpecLayerOptionsLoading(true);
    setSpecLayerOptionsError(null);
    postToMain({ type: 'GET_SPEC_LAYER_OPTIONS' });
  }, []);

  useEffect(() => {
    postToMain({ type: 'GET_SETTINGS' });
    requestSpecLayerOptions();
  }, [requestSpecLayerOptions]);

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

      if (data.type === 'SPEC_LAYER_OPTIONS_LOADED') {
        setSpecLayerOptionsLoading(false);
        setSpecLayerOptionsError(null);
        setSpecLayerOptions(data.payload.options);
        setAutoSelectedLayerPaths(data.payload.autoSelectedLayerPaths);
        setSettings((prev) => ({
          ...prev,
          specSelectedLayerPaths: data.payload.selectedLayerPaths,
        }));
        return;
      }

      if (data.type === 'SPEC_LAYER_OPTIONS_ERROR') {
        setSpecLayerOptionsLoading(false);
        setSpecLayerOptions([]);
        setAutoSelectedLayerPaths([]);
        setSpecLayerOptionsError(data.payload.message || SPEC_LAYER_EMPTY_HINT);
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

  const handleSpecLayerSelectionChange = useCallback((selectedLayerPaths: string[]) => {
    setSettings((prev) => ({
      ...prev,
      specSelectedLayerPaths: selectedLayerPaths,
    }));
    postToMain({
      type: 'SAVE_SPEC_SELECTED_LAYERS',
      payload: { selectedLayerPaths },
    });
  }, []);

  const handleResetSpecLayersToAuto = useCallback(() => {
    const paths =
      autoSelectedLayerPaths.length > 0
        ? autoSelectedLayerPaths
        : specLayerOptions.filter((o) => o.isAutoSelected && o.isSelectable).map((o) => o.path);
    handleSpecLayerSelectionChange(paths);
  }, [autoSelectedLayerPaths, specLayerOptions, handleSpecLayerSelectionChange]);

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
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          specLayerOptions={specLayerOptions}
          specLayerOptionsLoading={specLayerOptionsLoading}
          specLayerOptionsError={specLayerOptionsError}
          specLayerEmptyHint={SPEC_LAYER_EMPTY_HINT}
          onSpecLayerSelectionChange={handleSpecLayerSelectionChange}
          onRefreshSpecLayers={requestSpecLayerOptions}
          onResetSpecLayersToAuto={handleResetSpecLayersToAuto}
        />
        {error ? <StatusMessage text={error} variant="error" /> : null}
        {!error && status ? <StatusMessage text={status} variant="success" /> : null}
      </main>
    </div>
  );
}
