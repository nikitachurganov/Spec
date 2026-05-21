/// <reference types="@figma/plugin-typings" />

import type { PluginSettings } from '../../shared/settings';
import { ensureDocumentReadyForTraversal } from '../figma/documentAccess';
import {
  collectSpecLayerOptions,
  type CollectSpecLayerOptionsResult,
} from './collectSpecLayerOptions';

function isSupportedRoot(node: BaseNode): node is SceneNode {
  return (
    node.type === 'FRAME' ||
    node.type === 'COMPONENT' ||
    node.type === 'COMPONENT_SET' ||
    node.type === 'INSTANCE' ||
    node.type === 'GROUP' ||
    node.type === 'SECTION'
  );
}

function resolveSelectedPaths(
  storedPaths: string[],
  autoSelectedLayerPaths: string[],
  validPaths: Set<string>
): string[] {
  const filteredStored = storedPaths.filter((p) => validPaths.has(p));

  if (storedPaths.length === 0) {
    return autoSelectedLayerPaths.filter((p) => validPaths.has(p));
  }

  return filteredStored;
}

export type HandleSpecLayerOptionsResult =
  | {
      ok: true;
      rootName: string;
      options: CollectSpecLayerOptionsResult['options'];
      selectedLayerPaths: string[];
      autoSelectedLayerPaths: string[];
    }
  | { ok: false; message: string };

export async function handleGetSpecLayerOptions(
  settings: PluginSettings
): Promise<HandleSpecLayerOptionsResult> {
  await ensureDocumentReadyForTraversal();

  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    return {
      ok: false,
      message: 'Выберите компонент или фрейм, чтобы настроить слои для Spec.',
    };
  }

  if (selection.length > 1) {
    return {
      ok: false,
      message: 'Выберите один компонент или фрейм.',
    };
  }

  const root = selection[0];

  if (!isSupportedRoot(root)) {
    return {
      ok: false,
      message: 'Выберите компонент или фрейм, чтобы настроить слои для Spec.',
    };
  }

  const collected = await collectSpecLayerOptions(root);
  const validPaths = new Set(collected.options.map((o) => o.path));

  const selectedLayerPaths = resolveSelectedPaths(
    settings.specSelectedLayerPaths || [],
    collected.autoSelectedLayerPaths,
    validPaths
  );

  return {
    ok: true,
    rootName: collected.rootName,
    options: collected.options,
    selectedLayerPaths,
    autoSelectedLayerPaths: collected.autoSelectedLayerPaths,
  };
}
