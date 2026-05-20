/// <reference types="@figma/plugin-typings" />

import { buildSpecification } from './builders/buildSpecification';
import { normalizePluginSettings } from './settings/normalizeSettings';
import type { UiToMainMessage } from '../shared/messages';
import { postToUi } from './postToUi';
import { PLUGIN_UI_SIZE, STORAGE_KEY_SETTINGS } from '../shared/constants';
import { DEFAULT_PLUGIN_SETTINGS, type PluginSettings } from '../shared/settings';
import { handleGetSpecLayerOptions } from './spec/handleSpecLayerOptions';

declare const __html__: string;

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

figma.showUI(__html__, {
  width: PLUGIN_UI_SIZE.width,
  height: PLUGIN_UI_SIZE.height,
});

void (async () => {
  const settings = await loadStoredSettings();
  postToUi({ type: 'SETTINGS_LOADED', payload: { settings } });
  postToUi({ type: 'READY' });
})();

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
        await buildSpecification(settings);
        break;
      }
      case 'GET_SPEC_LAYER_OPTIONS': {
        const settings = await loadStoredSettings();
        const result = await handleGetSpecLayerOptions(settings);
        if (!result.ok) {
          postToUi({
            type: 'SPEC_LAYER_OPTIONS_ERROR',
            payload: { message: result.message },
          });
          break;
        }
        postToUi({
          type: 'SPEC_LAYER_OPTIONS_LOADED',
          payload: {
            rootName: result.rootName,
            options: result.options,
            selectedLayerPaths: result.selectedLayerPaths,
            autoSelectedLayerPaths: result.autoSelectedLayerPaths,
          },
        });
        break;
      }
      case 'SAVE_SPEC_SELECTED_LAYERS': {
        const current = await loadStoredSettings();
        const next = normalizePluginSettings({
          ...current,
          specSelectedLayerPaths: message.payload.selectedLayerPaths,
        });
        await saveStoredSettings(next);
        postToUi({ type: 'SETTINGS_LOADED', payload: { settings: next } });
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
