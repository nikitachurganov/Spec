/// <reference types="@figma/plugin-typings" />

import { buildSpecification } from './builders/buildSpecification';
import { normalizePluginSettings } from './settings/normalizeSettings';
import type { UiToMainMessage } from '../shared/messages';
import { postToUi } from './postToUi';
import { PLUGIN_UI_SIZE, STORAGE_KEY_SETTINGS } from '../shared/constants';
import { DEFAULT_PLUGIN_SETTINGS, type PluginSettings } from '../shared/settings';
import { handleGetSpecLayerOptions, isSupportedRoot } from './spec/handleSpecLayerOptions';

declare const __html__: string;
const MIN_UI_WIDTH = 360;
const MIN_UI_HEIGHT = 520;
const MAX_UI_WIDTH = 900;
const MAX_UI_HEIGHT = 1000;

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

const GENERATED_DOC_NAME_PREFIXES = [
  'DS specification',
  'Specification /',
  '.DS-Template-header',
] as const;

let activeSourceNodeId: string | null = null;
let selectionChangeTicket = 0;

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
  return isSupportedRoot(node) && !isGeneratedDocumentationNode(node);
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

async function postNoSourceState(): Promise<void> {
  postToUi({
    type: 'SPEC_LAYER_OPTIONS_ERROR',
    payload: { message: 'Выберите компонент или фрейм, чтобы настроить слои для Spec.' },
  });
}

async function postSpecLayerOptionsForSource(sourceNode: SceneNode): Promise<boolean> {
  const settings = await loadStoredSettings();
  const result = await handleGetSpecLayerOptions(settings, sourceNode);
  if (!result.ok) {
    postToUi({
      type: 'SPEC_LAYER_OPTIONS_ERROR',
      payload: { message: result.message },
    });
    return false;
  }

  const normalizedSelected = normalizePluginSettings({
    ...settings,
    specSelectedLayerPaths: result.specSelectedLayerPaths,
    anatomySelectedLayerPaths: result.anatomySelectedLayerPaths,
  });
  const specChanged = !areStringArraysEqual(
    settings.specSelectedLayerPaths,
    normalizedSelected.specSelectedLayerPaths
  );
  const anatomyChanged = !areStringArraysEqual(
    settings.anatomySelectedLayerPaths,
    normalizedSelected.anatomySelectedLayerPaths
  );
  if (specChanged || anatomyChanged) {
    await saveStoredSettings(normalizedSelected);
  }

  postToUi({
    type: 'SPEC_LAYER_OPTIONS_LOADED',
    payload: {
      rootId: result.rootId,
      rootName: result.rootName,
      options: result.options,
      specSelectedLayerPaths: normalizedSelected.specSelectedLayerPaths,
      anatomySelectedLayerPaths: normalizedSelected.anatomySelectedLayerPaths,
      autoSelectedLayerPaths: result.autoSelectedLayerPaths,
      anatomyPreviewPayload: result.anatomyPreviewPayload,
    },
  });
  return true;
}

async function resolveSourceFromSelectionOrActive(): Promise<SceneNode | null> {
  const candidate = findValidSourceCandidate(figma.currentPage.selection);
  if (candidate) {
    activeSourceNodeId = candidate.id;
    return candidate;
  }
  return resolveActiveSourceNode();
}

async function handleSelectionChange(): Promise<void> {
  const ticket = ++selectionChangeTicket;
  const candidate = findValidSourceCandidate(figma.currentPage.selection);

  if (candidate) {
    if (candidate.id !== activeSourceNodeId) {
      activeSourceNodeId = candidate.id;
      await postSpecLayerOptionsForSource(candidate);
    }
    return;
  }

  const activeSource = await resolveActiveSourceNode();
  if (ticket !== selectionChangeTicket) return;
  if (activeSource) {
    // Keep current UI state when selection is empty or points to generated docs.
    return;
  }

  if (activeSourceNodeId) {
    console.warn('[Selection] Active source node is no longer available. Clearing plugin state.');
  }
  activeSourceNodeId = null;
  await postNoSourceState();
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
    activeSourceNodeId = source.id;
    await postSpecLayerOptionsForSource(source);
  } else {
    await postNoSourceState();
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
        const source = await resolveSourceFromSelectionOrActive();
        if (!source) {
          postToUi({
            type: 'ERROR',
            payload: { message: 'Выберите компонент, фрейм или инстанс.' },
          });
          break;
        }
        activeSourceNodeId = source.id;
        await buildSpecification(settings, source);
        break;
      }
      case 'GET_SPEC_LAYER_OPTIONS': {
        const source = await resolveSourceFromSelectionOrActive();
        if (!source) {
          await postNoSourceState();
          break;
        }
        activeSourceNodeId = source.id;
        await postSpecLayerOptionsForSource(source);
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
          componentAnatomy: true,
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
