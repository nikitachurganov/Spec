/// <reference types="@figma/plugin-typings" />

import type { PluginSettings } from '../../shared/settings';
import type { AnatomyPreviewPayload } from '../../shared/anatomyPreview';
import { ensureDocumentReadyForTraversal } from '../figma/documentAccess';
import { buildAnatomyPreviewPayload } from '../anatomy/buildAnatomyPreviewPayload';
import {
  collectSpecLayerOptions,
  type CollectSpecLayerOptionsResult,
} from './collectSpecLayerOptions';

export function isSupportedRoot(node: BaseNode): node is SceneNode {
  return (
    node.type === 'FRAME' ||
    node.type === 'COMPONENT' ||
    node.type === 'COMPONENT_SET' ||
    node.type === 'INSTANCE'
  );
}

function resolveSelectedPaths(
  storedPaths: string[],
  _autoSelectedLayerPaths: string[],
  validPaths: Set<string>
): string[] {
  return storedPaths.filter((p) => validPaths.has(p));
}

function resolveManualSelectedPaths(storedPaths: string[], validPaths: Set<string>): string[] {
  if (!storedPaths.length) return [];
  return storedPaths.filter((p) => validPaths.has(p));
}

export type HandleSpecLayerOptionsResult =
  | {
      ok: true;
      rootId: string;
      rootName: string;
      options: CollectSpecLayerOptionsResult['options'];
      specSelectedLayerPaths: string[];
      anatomySelectedLayerPaths: string[];
      autoSelectedLayerPaths: string[];
      anatomyPreviewPayload: AnatomyPreviewPayload | null;
    }
  | { ok: false; message: string };

const anatomyPreviewCacheByRootId = new Map<string, AnatomyPreviewPayload>();

export async function handleGetSpecLayerOptions(
  settings: PluginSettings,
  sourceRoot?: SceneNode
): Promise<HandleSpecLayerOptionsResult> {
  await ensureDocumentReadyForTraversal();

  let root: SceneNode | null = sourceRoot ?? null;
  if (!root) {
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

    root = selection[0];
  }

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
  const anatomySelectedLayerPaths = resolveManualSelectedPaths(
    settings.anatomySelectedLayerPaths || [],
    validPaths
  );

  let anatomyPreviewPayload: AnatomyPreviewPayload | null = null;
  try {
    const cached = anatomyPreviewCacheByRootId.get(root.id);
    if (cached) {
      anatomyPreviewPayload = cached;
    } else {
      const built = await buildAnatomyPreviewPayload({
        rootNode: root,
        decomposition: collected.decomposition,
      });
      anatomyPreviewCacheByRootId.set(root.id, built);
      anatomyPreviewPayload = built;
    }
  } catch (error) {
    console.warn('[Anatomy Preview] Failed to build preview payload', error);
    anatomyPreviewPayload = null;
  }

  return {
    ok: true,
    rootId: root.id,
    rootName: collected.rootName,
    options: collected.options,
    specSelectedLayerPaths: selectedLayerPaths,
    anatomySelectedLayerPaths,
    autoSelectedLayerPaths: collected.autoSelectedLayerPaths,
    anatomyPreviewPayload,
  };
}
