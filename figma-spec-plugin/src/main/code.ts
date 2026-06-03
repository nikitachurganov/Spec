/// <reference types="@figma/plugin-typings" />

import { buildSpecification } from './builders/buildSpecification';
import { normalizePluginSettings } from './settings/normalizeSettings';
import type { UiToMainMessage } from '../shared/messages';
import { postToUi } from './postToUi';
import { PLUGIN_UI_SIZE, STORAGE_KEY_SETTINGS } from '../shared/constants';
import { DEFAULT_PLUGIN_SETTINGS, type PluginSettings } from '../shared/settings';
import { ENABLE_HEADER_BLOCK } from '../shared/featureFlags';
import {
  clearSpecLayerOptionsCaches,
  handleGetSpecLayerOptions,
  type LoadedSpecLayerOptionsPayload,
} from './spec/handleSpecLayerOptions';
import { handleGetHeaderOptions } from './header/handleHeaderOptions';
import { saveHeaderTemplateFromSelection } from './header/resolveHeaderComponent';

declare const __html__: string;
const MIN_UI_WIDTH = 360;
const MIN_UI_HEIGHT = 520;
const MAX_UI_WIDTH = 900;
const MAX_UI_HEIGHT = 1000;
const SOURCE_SELECTION_DEBOUNCE_MS = 500;
const DEBUG_LAYER_LOAD_PERFORMANCE = false;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function loadStoredSettings(): Promise<PluginSettings> {
  try {
    const raw = await figma.clientStorage.getAsync(STORAGE_KEY_SETTINGS);
    return normalizePluginSettings(raw);
  } catch {
    return Object.assign({}, DEFAULT_PLUGIN_SETTINGS);
  }
}

async function saveStoredSettings(settings: PluginSettings): Promise<void> {
  await figma.clientStorage.setAsync(STORAGE_KEY_SETTINGS, settings);
}

function areStringArraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

const GENERATED_DOC_NAME_PREFIXES = ['DS specification'] as const;

let activeSourceNodeId: string | null = null;
let pendingSourceNodeId: string | null = null;
let isSourceContextLoading = false;
let selectionDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let selectionRequestId = 0;
let currentLoadingSourceId: string | null = null;
let readySourceNodeId: string | null = null;
const sourcePayloadCache = new Map<string, LoadedSpecLayerOptionsPayload>();

function isSceneNode(node: BaseNode | null): node is SceneNode {
  if (!node) return false;
  return node.type !== 'PAGE' && node.type !== 'DOCUMENT' && node.type !== 'SLICE';
}

function isGeneratedDocumentationNode(node: BaseNode | null): boolean {
  let current: BaseNode | null = node;
  while (current) {
    const withPluginData = current as BaseNode & {
      getPluginData?: (key: string) => string;
      name?: string;
      parent?: BaseNode | null;
    };
    if (
      typeof withPluginData.getPluginData === 'function' &&
      withPluginData.getPluginData('isGeneratedDocumentation') === 'true'
    ) {
      return true;
    }
    const name = String(withPluginData.name || '');
    if (GENERATED_DOC_NAME_PREFIXES.some((prefix) => name.startsWith(prefix))) {
      return true;
    }
    current = withPluginData.parent ?? null;
  }
  return false;
}

function isValidDocumentationSource(node: SceneNode): boolean {
  if (isGeneratedDocumentationNode(node)) return false;
  return (
    node.type === 'FRAME' ||
    node.type === 'COMPONENT' ||
    node.type === 'INSTANCE' ||
    node.type === 'COMPONENT_SET'
  );
}

function findValidSourceCandidate(selection: readonly SceneNode[]): SceneNode | null {
  for (const selectedNode of selection) {
    let current: BaseNode | null = selectedNode;
    while (current) {
      if (isSceneNode(current) && isValidDocumentationSource(current)) {
        return current;
      }
      if (isGeneratedDocumentationNode(current)) {
        break;
      }
      current = current.parent;
    }
  }
  return null;
}

function selectionIsOnlyGeneratedDocumentation(selection: readonly SceneNode[]): boolean {
  if (selection.length === 0) return false;
  return selection.every((node) => isGeneratedDocumentationNode(node));
}

async function getNodeByIdSafe(id: string): Promise<SceneNode | null> {
  try {
    const node = await figma.getNodeByIdAsync(id);
    if (!isSceneNode(node) || node.removed) return null;
    return node;
  } catch {
    return null;
  }
}

async function resolveActiveSourceNode(): Promise<SceneNode | null> {
  if (!activeSourceNodeId) return null;
  const node = await getNodeByIdSafe(activeSourceNodeId);
  if (!node) return null;
  if (!isValidDocumentationSource(node)) return null;
  return node;
}

function clearSelectionDebounceTimer(): void {
  if (selectionDebounceTimer !== null) {
    clearTimeout(selectionDebounceTimer);
    selectionDebounceTimer = null;
  }
}

function estimatePayloadSizeBytes(payload: unknown): number {
  try {
    return JSON.stringify(payload).length;
  } catch {
    return 0;
  }
}

function postLoadedSourcePayload(
  payload: LoadedSpecLayerOptionsPayload,
  settings: PluginSettings
): void {
  postToUi({
    type: 'SPEC_LAYER_OPTIONS_LOADED',
    payload: {
      rootId: payload.rootId,
      rootName: payload.rootName,
      options: payload.options,
      specSelectedLayerPaths: settings.specSelectedLayerPaths,
      anatomySelectedLayerPaths: settings.anatomySelectedLayerPaths,
      autoSelectedLayerPaths: payload.autoSelectedLayerPaths,
      specPreviewPayload: payload.specPreviewPayload,
      anatomyPreviewPayload: payload.anatomyPreviewPayload,
    },
  });
}

async function normalizeAndPersistSelectionSettings(params: {
  settings: PluginSettings;
  payload: LoadedSpecLayerOptionsPayload;
}): Promise<PluginSettings> {
  const normalized = normalizePluginSettings({
    ...params.settings,
    specSelectedLayerPaths: params.payload.specSelectedLayerPaths,
    anatomySelectedLayerPaths: params.payload.anatomySelectedLayerPaths,
  });
  const specChanged = !areStringArraysEqual(
    params.settings.specSelectedLayerPaths,
    normalized.specSelectedLayerPaths
  );
  const anatomyChanged = !areStringArraysEqual(
    params.settings.anatomySelectedLayerPaths,
    normalized.anatomySelectedLayerPaths
  );
  if (specChanged || anatomyChanged) {
    await saveStoredSettings(normalized);
  }
  return normalized;
}

function cancelPendingSourceLoad(): void {
  clearSelectionDebounceTimer();
  pendingSourceNodeId = null;
  isSourceContextLoading = false;
  currentLoadingSourceId = null;
  selectionRequestId += 1;
}

async function postNoSourceState(reason: string): Promise<void> {
  postToUi({
    type: 'ACTIVE_SOURCE_CLEARED',
    payload: { reason },
  });
}

async function postSpecLayerOptionsForSource(
  sourceNode: SceneNode,
  requestTicket: number,
  options: { forceRefresh?: boolean } = {}
): Promise<boolean> {
  if (!options.forceRefresh) {
    const cachedPayload = sourcePayloadCache.get(sourceNode.id);
    if (cachedPayload) {
      const settings = await loadStoredSettings();
      const normalized = await normalizeAndPersistSelectionSettings({
        settings,
        payload: cachedPayload,
      });
      if (requestTicket !== selectionRequestId) return false;
      if (DEBUG_LAYER_LOAD_PERFORMANCE) {
        console.log('[layers] cache hit', {
          sourceId: sourceNode.id,
          payloadBytes: estimatePayloadSizeBytes(cachedPayload),
        });
      }
      postLoadedSourcePayload(cachedPayload, normalized);
      readySourceNodeId = sourceNode.id;
      return true;
    }
  } else {
    sourcePayloadCache.delete(sourceNode.id);
    clearSpecLayerOptionsCaches(sourceNode.id);
  }

  if (currentLoadingSourceId === sourceNode.id && !options.forceRefresh) {
    return false;
  }

  isSourceContextLoading = true;
  currentLoadingSourceId = sourceNode.id;
  try {
    if (DEBUG_LAYER_LOAD_PERFORMANCE) console.time('[layers] total');
    const settings = await loadStoredSettings();
    if (DEBUG_LAYER_LOAD_PERFORMANCE) console.time('[layers] handleGetSpecLayerOptions');
    const result = await handleGetSpecLayerOptions(settings, sourceNode, {
      forceRefresh: options.forceRefresh,
    });
    if (DEBUG_LAYER_LOAD_PERFORMANCE) console.timeEnd('[layers] handleGetSpecLayerOptions');
    if (requestTicket !== selectionRequestId) {
      return false;
    }
    if (!result.ok) {
      postToUi({
        type: 'SPEC_LAYER_OPTIONS_ERROR',
        payload: { message: result.message },
      });
      return false;
    }

    const normalizedSelected = await normalizeAndPersistSelectionSettings({
      settings,
      payload: result,
    });
    sourcePayloadCache.set(sourceNode.id, result);
    readySourceNodeId = sourceNode.id;
    postLoadedSourcePayload(result, normalizedSelected);
    if (DEBUG_LAYER_LOAD_PERFORMANCE) {
      console.log('[layers] payload bytes', estimatePayloadSizeBytes(result));
      console.timeEnd('[layers] total');
    }
    return true;
  } finally {
    isSourceContextLoading = false;
    if (currentLoadingSourceId === sourceNode.id) {
      currentLoadingSourceId = null;
    }
  }
}

async function reloadActiveSourceWithoutDebounce(): Promise<void> {
  if (!activeSourceNodeId) return;
  const node = await getNodeByIdSafe(activeSourceNodeId);
  if (!node || !isValidDocumentationSource(node)) return;
  const requestId = ++selectionRequestId;
  postToUi({
    type: 'ACTIVE_SOURCE_LOADING',
    payload: {
      sourceNodeId: node.id,
      sourceName: node.name,
    },
  });
  await postSpecLayerOptionsForSource(node, requestId);
}

async function clearActiveSource(reason: string): Promise<void> {
  cancelPendingSourceLoad();

  const previousSourceId = activeSourceNodeId;
  activeSourceNodeId = null;
  readySourceNodeId = null;
  if (
    previousSourceId &&
    (reason === 'pending-source-invalid' || reason === 'no-valid-source')
  ) {
    sourcePayloadCache.delete(previousSourceId);
    clearSpecLayerOptionsCaches(previousSourceId);
  }

  const settings = await loadStoredSettings();
  const cleared = normalizePluginSettings({
    ...settings,
    specSelectedLayerPaths: [],
    anatomySelectedLayerPaths: [],
  });
  await saveStoredSettings(cleared);

  postToUi({ type: 'SETTINGS_LOADED', payload: { settings: cleared } });
  await postNoSourceState(reason);
}

function scheduleSourceChange(candidate: SceneNode): void {
  if (
    candidate.id === activeSourceNodeId &&
    readySourceNodeId === candidate.id &&
    sourcePayloadCache.has(candidate.id) &&
    pendingSourceNodeId === null &&
    !isSourceContextLoading
  ) {
    clearSelectionDebounceTimer();
    return;
  }
  if (candidate.id === currentLoadingSourceId) {
    return;
  }

  clearSelectionDebounceTimer();
  selectionRequestId += 1;
  const requestId = selectionRequestId;

  pendingSourceNodeId = candidate.id;

  postToUi({
    type: 'ACTIVE_SOURCE_PENDING',
    payload: {
      sourceNodeId: candidate.id,
      sourceName: candidate.name,
    },
  });

  selectionDebounceTimer = setTimeout(() => {
    selectionDebounceTimer = null;
    void acceptPendingSource(candidate.id, requestId);
  }, SOURCE_SELECTION_DEBOUNCE_MS);
}

async function acceptPendingSource(sourceNodeId: string, requestId: number): Promise<void> {
  if (requestId !== selectionRequestId) return;

  pendingSourceNodeId = null;

  const node = await getNodeByIdSafe(sourceNodeId);
  if (!node || !isValidDocumentationSource(node)) {
    sourcePayloadCache.delete(sourceNodeId);
    clearSpecLayerOptionsCaches(sourceNodeId);
    if (requestId === selectionRequestId) {
      await clearActiveSource('pending-source-invalid');
    }
    return;
  }

  const selection = figma.currentPage.selection;
  const currentCandidate = findValidSourceCandidate(selection);
  if (currentCandidate?.id !== sourceNodeId) {
    if (requestId !== selectionRequestId) return;
    if (selection.length === 0) {
      await clearActiveSource('empty-selection');
      return;
    }
    if (selectionIsOnlyGeneratedDocumentation(selection)) {
      if (activeSourceNodeId) {
        await reloadActiveSourceWithoutDebounce();
      } else {
        await postNoSourceState('generated-doc-selection');
      }
      return;
    }
    if (!currentCandidate) {
      await clearActiveSource('no-valid-source');
      return;
    }
    scheduleSourceChange(currentCandidate);
    return;
  }

  if (requestId !== selectionRequestId) return;

  if (
    sourceNodeId === activeSourceNodeId &&
    readySourceNodeId === sourceNodeId &&
    sourcePayloadCache.has(sourceNodeId)
  ) {
    return;
  }

  postToUi({
    type: 'ACTIVE_SOURCE_LOADING',
    payload: {
      sourceNodeId: node.id,
      sourceName: node.name,
    },
  });

  const settings = await loadStoredSettings();
  const clearedForNewSource = normalizePluginSettings({
    ...settings,
    specSelectedLayerPaths: [],
    anatomySelectedLayerPaths: [],
  });
  await saveStoredSettings(clearedForNewSource);
  postToUi({ type: 'SETTINGS_LOADED', payload: { settings: clearedForNewSource } });

  activeSourceNodeId = node.id;
  readySourceNodeId = null;

  await postSpecLayerOptionsForSource(node, requestId);
}

async function handleSelectionChange(): Promise<void> {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    await clearActiveSource('empty-selection');
    return;
  }

  const candidate = findValidSourceCandidate(selection);

  if (!candidate) {
    if (selectionIsOnlyGeneratedDocumentation(selection)) {
      if (pendingSourceNodeId !== null) {
        cancelPendingSourceLoad();
        if (activeSourceNodeId) {
          await reloadActiveSourceWithoutDebounce();
        } else {
          await postNoSourceState('generated-doc-selection');
        }
        return;
      }
      clearSelectionDebounceTimer();
      pendingSourceNodeId = null;
      return;
    }
    await clearActiveSource('no-valid-source');
    return;
  }

  scheduleSourceChange(candidate);
}

figma.showUI(__html__, {
  width: PLUGIN_UI_SIZE.width,
  height: PLUGIN_UI_SIZE.height,
});

void (async () => {
  const settings = await loadStoredSettings();
  postToUi({ type: 'SETTINGS_LOADED', payload: { settings } });
  const source = findValidSourceCandidate(figma.currentPage.selection);
  if (source) {
    scheduleSourceChange(source);
  } else {
    await postNoSourceState('startup-no-source');
  }
  postToUi({ type: 'READY' });
})();

figma.on('selectionchange', () => {
  void handleSelectionChange();
});

figma.ui.onmessage = async (raw: unknown) => {
  const message = raw as UiToMainMessage;
  try {
    switch (message.type) {
      case 'GET_SETTINGS': {
        const settings = await loadStoredSettings();
        postToUi({ type: 'SETTINGS_LOADED', payload: { settings } });
        break;
      }
      case 'SAVE_SETTINGS': {
        const settings = normalizePluginSettings(message.payload.settings);
        await saveStoredSettings(settings);
        postToUi({ type: 'SETTINGS_LOADED', payload: { settings } });
        break;
      }
      case 'BUILD_SPECIFICATION': {
        const settings = normalizePluginSettings(message.payload.settings);
        await saveStoredSettings(settings);
        const source = await resolveActiveSourceNode();
        if (!source) {
          postToUi({
            type: 'ERROR',
            payload: { message: 'Выберите компонент, фрейм или инстанс.' },
          });
          break;
        }
        await buildSpecification(settings, source);
        break;
      }
      case 'GET_HEADER_OPTIONS': {
        if (!ENABLE_HEADER_BLOCK) break;
        const settings = await loadStoredSettings();
        const result = await handleGetHeaderOptions(settings);
        const normalized = normalizePluginSettings({
          ...settings,
          headerSettings: result.headerSettings,
        });
        const headerSettingsChanged =
          JSON.stringify(settings.headerSettings) !== JSON.stringify(normalized.headerSettings);
        if (headerSettingsChanged) {
          await saveStoredSettings(normalized);
        }
        postToUi({
          type: 'HEADER_OPTIONS_LOADED',
          payload: {
            headerFound: result.headerFound,
            statusOptions: result.statusOptions,
            statusSizeOptions: result.statusSizeOptions,
            headerSettings: normalized.headerSettings,
          },
        });
        break;
      }
      case 'SET_HEADER_TEMPLATE_FROM_SELECTION': {
        if (!ENABLE_HEADER_BLOCK) break;
        const result = await saveHeaderTemplateFromSelection();
        if (!result.ok) {
          figma.notify(result.message, { error: true });
          postToUi({ type: 'ERROR', payload: { message: result.message } });
          break;
        }

        figma.notify(`Компонент ${result.componentName} сохранен как Header template.`);

        const settings = await loadStoredSettings();
        const headerResult = await handleGetHeaderOptions(settings);
        const normalized = normalizePluginSettings({
          ...settings,
          headerSettings: headerResult.headerSettings,
        });
        await saveStoredSettings(normalized);

        postToUi({
          type: 'HEADER_TEMPLATE_SAVED',
          payload: {
            componentId: result.componentId,
            componentName: result.componentName,
          },
        });
        postToUi({
          type: 'HEADER_OPTIONS_LOADED',
          payload: {
            headerFound: headerResult.headerFound,
            statusOptions: headerResult.statusOptions,
            statusSizeOptions: headerResult.statusSizeOptions,
            headerSettings: normalized.headerSettings,
          },
        });
        break;
      }
      case 'GET_SPEC_LAYER_OPTIONS': {
        const requestTicket = ++selectionRequestId;
        clearSelectionDebounceTimer();
        const source = await resolveActiveSourceNode();
        if (!source) {
          if (requestTicket !== selectionRequestId) break;
          await postNoSourceState('manual-refresh-no-source');
          break;
        }
        postToUi({
          type: 'ACTIVE_SOURCE_LOADING',
          payload: {
            sourceNodeId: source.id,
            sourceName: source.name,
          },
        });
        await postSpecLayerOptionsForSource(source, requestTicket, { forceRefresh: true });
        break;
      }
      case 'SAVE_SPEC_SELECTED_LAYERS': {
        const current = await loadStoredSettings();
        const next = normalizePluginSettings({
          ...current,
          spec: true,
          specSelectedLayerPaths: message.payload.selectedLayerPaths,
        });
        await saveStoredSettings(next);
        postToUi({ type: 'SETTINGS_LOADED', payload: { settings: next } });
        break;
      }
      case 'SAVE_ANATOMY_SELECTED_LAYERS': {
        const current = await loadStoredSettings();
        const next = normalizePluginSettings({
          ...current,
          componentAnatomy:
            message.payload.selectedLayerPaths.length > 0 ? true : current.componentAnatomy,
          anatomySelectedLayerPaths: message.payload.selectedLayerPaths,
        });
        await saveStoredSettings(next);
        postToUi({ type: 'SETTINGS_LOADED', payload: { settings: next } });
        break;
      }
      case 'RESIZE_PLUGIN': {
        const width = clamp(Math.round(message.payload.width), MIN_UI_WIDTH, MAX_UI_WIDTH);
        const height = clamp(Math.round(message.payload.height), MIN_UI_HEIGHT, MAX_UI_HEIGHT);
        figma.ui.resize(width, height);
        break;
      }
      default:
        break;
    }
  } catch (error) {
    postToUi({
      type: 'ERROR',
      payload: { message: getErrorMessage(error) },
    });
  }
};
