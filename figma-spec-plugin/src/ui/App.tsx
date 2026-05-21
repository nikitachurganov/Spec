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
import { SpecLayerMultiSelect } from './components/SpecLayerMultiSelect';
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
  const [specLayerRootId, setSpecLayerRootId] = useState<string | null>(null);

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
        setSpecLayerRootId(data.payload.rootId);
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
        setSpecLayerRootId(null);
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
        <div className="plugin-header">
          <span className="plugin-header__title">Выберите компоненты</span>
          <div className="plugin-header__action">
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
        </div>
      </header>

      <main className="app-content">
        <section className="plugin-panel plugin-panel-left">
          <div className="plugin-block-header">
            <h2 className="plugin-block-title">Блоки документации</h2>
          </div>
          <div className="plugin-panel-body">
            <SettingsPanel
              settings={settings}
              onChange={setSettings}
            />
            {error ? <StatusMessage text={error} variant="error" /> : null}
            {!error && status ? <StatusMessage text={status} variant="success" /> : null}
          </div>
        </section>

        <section className="plugin-panel plugin-panel-right">
          <section className="decomposition-panel">
            <div className="plugin-block-header">
              <h2 className="plugin-block-title">Декомпозиция</h2>
              <button
                type="button"
                className="plugin-header-icon-button"
                aria-label="Сбросить к авто"
                title="Сбросить к авто"
                onClick={handleResetSpecLayersToAuto}
                disabled={specLayerOptionsLoading || specLayerOptions.length === 0}
              >
                ↻
              </button>
            </div>
            <div className="plugin-panel-body">
              <SpecLayerMultiSelect
                options={specLayerOptions}
                selectedPaths={settings.specSelectedLayerPaths}
                isLoading={specLayerOptionsLoading}
                error={specLayerOptionsError}
                emptyHint={SPEC_LAYER_EMPTY_HINT}
                onChange={handleSpecLayerSelectionChange}
                rootId={specLayerRootId}
                showHeader={false}
                showRefresh={false}
                showResetButton={false}
              />
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
