import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  DEFAULT_PLUGIN_SETTINGS,
  hasAnySpecificationBlock,
  withHiddenSpecificationPreferences,
  type PluginSettings,
} from '@shared/settings';
import type { MainToUiMessage, SpecLayerOption } from '@shared/messages';
import type { AnatomyPreviewPayload } from '@shared/anatomyPreview';
import { postToMain } from './postToMain';
import { AnatomyCombinedSelector } from './components/AnatomyCombinedSelector/AnatomyCombinedSelector';
import { SpecCombinedSelector } from './components/SpecCombinedSelector/SpecCombinedSelector';
import { SettingsPanel } from './components/SettingsPanel';
import { StatusMessage } from './components/StatusMessage';

const NO_BLOCKS_ERROR = 'Выберите хотя бы один блок спецификации.';
const SPEC_LAYER_EMPTY_HINT =
  'Выберите компонент или фрейм, чтобы настроить слои для Spec.';
const ANATOMY_LAYER_EMPTY_HINT =
  'Выберите компонент или фрейм, чтобы настроить слои для анатомии.';

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

type DecompositionPurpose = 'spec' | 'anatomy';

function filterDecompositionOptionsForPurpose(
  options: SpecLayerOption[],
  purpose: DecompositionPurpose
): SpecLayerOption[] {
  const byPath = new Map(options.map((option) => [option.path, option]));
  const includeSet = new Set<string>();

  const isRelevant = (option: SpecLayerOption): boolean => {
    if (option.isRoot) return true;
    if (purpose === 'anatomy') return true;
    return option.isSelectable && !option.isText;
  };

  for (const option of options) {
    if (!isRelevant(option)) continue;
    includeSet.add(option.path);
    let parentPath = option.parentPath;
    while (parentPath !== undefined) {
      includeSet.add(parentPath);
      const parent = byPath.get(parentPath);
      if (!parent) break;
      parentPath = parent.parentPath;
    }
  }

  return options
    .filter((option) => includeSet.has(option.path))
    .map((option) => ({
      ...option,
      isSelectable:
        purpose === 'anatomy'
          ? option.isRoot ||
            option.isText ||
            option.isSelectable ||
            option.kind === 'slot' ||
            option.kind === 'icon' ||
            option.kind === 'badge' ||
            option.kind === 'divider' ||
            option.kind === 'action'
          : option.isSelectable && !option.isText,
    }));
}

export function App() {
  const MIN_UI_WIDTH = 360;
  const MIN_UI_HEIGHT = 520;
  const MAX_UI_WIDTH = 900;
  const MAX_UI_HEIGHT = 1000;

  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

  const [settings, setSettings] = useState<PluginSettings>(DEFAULT_PLUGIN_SETTINGS);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [specLayerOptions, setSpecLayerOptions] = useState<SpecLayerOption[]>([]);
  const [specLayerOptionsLoading, setSpecLayerOptionsLoading] = useState(false);
  const [specLayerOptionsError, setSpecLayerOptionsError] = useState<string | null>(null);
  const [specLayerRootId, setSpecLayerRootId] = useState<string | null>(null);
  const [specPreviewPayload, setSpecPreviewPayload] =
    useState<AnatomyPreviewPayload | null>(null);
  const [anatomyPreviewPayload, setAnatomyPreviewPayload] =
    useState<AnatomyPreviewPayload | null>(null);
  const [activeDecompositionTab, setActiveDecompositionTab] = useState<DecompositionPurpose | null>(
    'spec'
  );
  const [uiSize, setUiSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const resizeRafRef = useRef<number | null>(null);
  const resizePendingRef = useRef<{ width: number; height: number } | null>(null);

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
        setSpecPreviewPayload(data.payload.specPreviewPayload);
        setAnatomyPreviewPayload(data.payload.anatomyPreviewPayload);
        setSettings((prev) => ({
          ...prev,
          specSelectedLayerPaths: data.payload.specSelectedLayerPaths,
          anatomySelectedLayerPaths: data.payload.anatomySelectedLayerPaths,
        }));
        return;
      }

      if (data.type === 'SPEC_LAYER_OPTIONS_ERROR') {
        setSpecLayerOptionsLoading(false);
        // Keep previous decomposition context visible on transient selection errors.
        const nextMessage = data.payload.message || SPEC_LAYER_EMPTY_HINT;
        setSpecLayerOptionsError(nextMessage);
        const isNoSourceSelection =
          nextMessage.includes('Выберите компонент или фрейм') ||
          nextMessage.includes('Выберите компонент, фрейм или инстанс');
        if (isNoSourceSelection) {
          setSpecLayerRootId(null);
          setSpecPreviewPayload(null);
          setAnatomyPreviewPayload(null);
        }
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

  useEffect(() => {
    function syncSizeFromWindow() {
      setUiSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }
    window.addEventListener('resize', syncSizeFromWindow);
    return () => window.removeEventListener('resize', syncSizeFromWindow);
  }, []);

  const queueResizePlugin = useCallback((width: number, height: number) => {
    resizePendingRef.current = { width, height };
    if (resizeRafRef.current != null) return;
    resizeRafRef.current = window.requestAnimationFrame(() => {
      const next = resizePendingRef.current;
      resizePendingRef.current = null;
      resizeRafRef.current = null;
      if (!next) return;
      postToMain({
        type: 'RESIZE_PLUGIN',
        payload: {
          width: next.width,
          height: next.height,
        },
      });
    });
  }, []);

  const handleSettingsChange = useCallback((next: PluginSettings) => {
    const normalized = withHiddenSpecificationPreferences(next);
    setSettings(normalized);
    postToMain({
      type: 'SAVE_SETTINGS',
      payload: { settings: normalized },
    });
  }, []);

  const handleResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      const start = {
        x: event.clientX,
        y: event.clientY,
        width: uiSize.width,
        height: uiSize.height,
      };

      function onMove(moveEvent: PointerEvent) {
        const width = clamp(
          Math.round(start.width + (moveEvent.clientX - start.x)),
          MIN_UI_WIDTH,
          MAX_UI_WIDTH
        );
        const height = clamp(
          Math.round(start.height + (moveEvent.clientY - start.y)),
          MIN_UI_HEIGHT,
          MAX_UI_HEIGHT
        );
        setUiSize({ width, height });
        queueResizePlugin(width, height);
      }

      function onUp() {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      }

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [uiSize.width, uiSize.height, queueResizePlugin]
  );

  const handleSpecLayerSelectionChange = useCallback((selectedLayerPaths: string[]) => {
    setSettings((prev) => ({
      ...prev,
      spec: true,
      specSelectedLayerPaths: selectedLayerPaths,
    }));
    postToMain({
      type: 'SAVE_SPEC_SELECTED_LAYERS',
      payload: { selectedLayerPaths },
    });
  }, []);

  const handleResetSpecLayersToAuto = useCallback(() => {
    handleSpecLayerSelectionChange([]);
  }, [handleSpecLayerSelectionChange]);

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

  const handleAnatomyLayerSelectionChange = useCallback((selectedLayerPaths: string[]) => {
    setSettings((prev) => ({
      ...prev,
      componentAnatomy: selectedLayerPaths.length > 0 ? true : prev.componentAnatomy,
      anatomySelectedLayerPaths: selectedLayerPaths,
    }));
    postToMain({
      type: 'SAVE_ANATOMY_SELECTED_LAYERS',
      payload: { selectedLayerPaths },
    });
  }, []);

  const handleResetAnatomyLayersToAuto = useCallback(() => {
    handleAnatomyLayerSelectionChange([]);
  }, [handleAnatomyLayerSelectionChange]);

  const specOptions = useMemo(
    () => filterDecompositionOptionsForPurpose(specLayerOptions, 'spec'),
    [specLayerOptions]
  );
  const anatomyOptions = useMemo(
    () => filterDecompositionOptionsForPurpose(specLayerOptions, 'anatomy'),
    [specLayerOptions]
  );
  const isSpecEnabled = Boolean(settings.spec);
  const isAnatomyEnabled = Boolean(settings.componentAnatomy);

  useEffect(() => {
    if (activeDecompositionTab === 'spec' && !isSpecEnabled) {
      setActiveDecompositionTab(isAnatomyEnabled ? 'anatomy' : null);
      return;
    }
    if (activeDecompositionTab === 'anatomy' && !isAnatomyEnabled) {
      setActiveDecompositionTab(isSpecEnabled ? 'spec' : null);
      return;
    }
    if (activeDecompositionTab === null) {
      if (isSpecEnabled) {
        setActiveDecompositionTab('spec');
      } else if (isAnatomyEnabled) {
        setActiveDecompositionTab('anatomy');
      }
    }
  }, [activeDecompositionTab, isAnatomyEnabled, isSpecEnabled]);

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
              onChange={handleSettingsChange}
            />
            {error ? <StatusMessage text={error} variant="error" /> : null}
            {!error && status ? <StatusMessage text={status} variant="success" /> : null}
          </div>
        </section>

        <section className="plugin-panel plugin-panel-right">
          <section className="decomposition-panel">
            <div className="plugin-block-header">
              <h2 className="plugin-block-title">Декомпозиция</h2>
            </div>
            <div className="plugin-panel-body">
              <div className="decomposition-tabs" role="tablist" aria-label="Decomposition tabs">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeDecompositionTab === 'spec'}
                  aria-disabled={!isSpecEnabled}
                  disabled={!isSpecEnabled}
                  className={`decomposition-tab ${activeDecompositionTab === 'spec' ? 'is-active' : ''}`}
                  onClick={() => {
                    if (!isSpecEnabled) return;
                    setActiveDecompositionTab('spec');
                  }}
                >
                  Spec
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeDecompositionTab === 'anatomy'}
                  aria-disabled={!isAnatomyEnabled}
                  disabled={!isAnatomyEnabled}
                  className={`decomposition-tab ${activeDecompositionTab === 'anatomy' ? 'is-active' : ''}`}
                  onClick={() => {
                    if (!isAnatomyEnabled) return;
                    setActiveDecompositionTab('anatomy');
                  }}
                >
                  Анатомия
                </button>
              </div>
              <div className="decomposition-content">
                {activeDecompositionTab === null ? (
                  <div className="decomposition-empty-state">
                    Включите Spec или Анатомию, чтобы настроить декомпозицию.
                  </div>
                ) : null}
                {activeDecompositionTab === 'spec' && isSpecEnabled ? (
                  <SpecCombinedSelector
                    options={specOptions}
                    preview={specPreviewPayload}
                    selectedPaths={settings.specSelectedLayerPaths}
                    isLoading={specLayerOptionsLoading}
                    error={specLayerOptionsError}
                    emptyHint={SPEC_LAYER_EMPTY_HINT}
                    rootId={specLayerRootId}
                    onSelectedPathsChange={handleSpecLayerSelectionChange}
                    onResetToAuto={handleResetSpecLayersToAuto}
                  />
                ) : null}
                {activeDecompositionTab === 'anatomy' && isAnatomyEnabled ? (
                  <AnatomyCombinedSelector
                    options={anatomyOptions}
                    preview={anatomyPreviewPayload}
                    selectedPaths={settings.anatomySelectedLayerPaths}
                    isLoading={specLayerOptionsLoading}
                    error={specLayerOptionsError}
                    emptyHint={ANATOMY_LAYER_EMPTY_HINT}
                    rootId={specLayerRootId}
                    onSelectedPathsChange={handleAnatomyLayerSelectionChange}
                    onResetToAuto={handleResetAnatomyLayersToAuto}
                  />
                ) : null}
              </div>
            </div>
          </section>
        </section>
      </main>
      <button
        type="button"
        className="app-resize-handle"
        aria-label="Resize plugin window"
        onPointerDown={handleResizePointerDown}
      />
    </div>
  );
}
