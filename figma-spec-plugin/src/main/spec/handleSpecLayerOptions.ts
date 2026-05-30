/// <reference types="@figma/plugin-typings" />

import type { PluginSettings } from '../../shared/settings';
import type { AnatomyPreviewPayload } from '../../shared/anatomyPreview';
import {
  logSelectionPersistence,
  sanitizeSelectedLayerPaths,
} from '../../shared/layerPaths';
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
  options: CollectSpecLayerOptionsResult['options']
): string[] {
  return sanitizeSelectedLayerPaths(storedPaths, options);
}

function resolveManualSelectedPaths(
  storedPaths: string[],
  options: CollectSpecLayerOptionsResult['options']
): string[] {
  if (!storedPaths.length) return [];
  return sanitizeSelectedLayerPaths(storedPaths, options);
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
      specPreviewPayload: AnatomyPreviewPayload | null;
      anatomyPreviewPayload: AnatomyPreviewPayload | null;
    }
  | { ok: false; message: string };

const anatomyPreviewCacheByRootId = new Map<string, AnatomyPreviewPayload>();
const specPreviewCacheByRootId = new Map<string, AnatomyPreviewPayload>();

function shouldIncludeSpecHotspot(kind: string, isRoot: boolean): boolean {
  if (isRoot) return true;
  return kind === 'component' || kind === 'instance' || kind === 'container';
}

function buildSpecPreviewPayloadFromAnatomy(params: {
  base: AnatomyPreviewPayload;
  options: CollectSpecLayerOptionsResult['options'];
}): AnatomyPreviewPayload {
  const optionByPath = new Map(params.options.map((option) => [option.path, option]));
  const specHotspots = params.base.hotspots
    .filter((spot) => shouldIncludeSpecHotspot(spot.kind, spot.isRoot))
    .map((spot) => {
      const option = optionByPath.get(spot.path);
      return {
        ...spot,
        selectable: Boolean(option?.isSelectable && !option?.isText),
      };
    });
  return {
    imageDataUrl: params.base.imageDataUrl,
    imageWidth: params.base.imageWidth,
    imageHeight: params.base.imageHeight,
    coordinateSpace: params.base.coordinateSpace,
    hotspots: specHotspots,
  };
}

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

  const selectedLayerPaths = resolveSelectedPaths(
    settings.specSelectedLayerPaths || [],
    collected.options
  );
  const anatomySelectedLayerPaths = resolveManualSelectedPaths(
    settings.anatomySelectedLayerPaths || [],
    collected.options
  );

  logSelectionPersistence('resolved', {
    specBefore: settings.specSelectedLayerPaths,
    specAfter: selectedLayerPaths,
    anatomyBefore: settings.anatomySelectedLayerPaths,
    anatomyAfter: anatomySelectedLayerPaths,
    selectableCount: collected.options.filter((option) => option.isSelectable).length,
  });

  let anatomyPreviewPayload: AnatomyPreviewPayload | null = null;
  let specPreviewPayload: AnatomyPreviewPayload | null = null;
  try {
    const cached = anatomyPreviewCacheByRootId.get(root.id);
    const cachedSpec = specPreviewCacheByRootId.get(root.id);
    if (cached && cachedSpec) {
      anatomyPreviewPayload = cached;
      specPreviewPayload = cachedSpec;
    } else {
      const built = await buildAnatomyPreviewPayload({
        rootNode: root,
        decomposition: collected.decomposition,
      });
      const builtSpec = buildSpecPreviewPayloadFromAnatomy({
        base: built,
        options: collected.options,
      });
      anatomyPreviewCacheByRootId.set(root.id, built);
      specPreviewCacheByRootId.set(root.id, builtSpec);
      anatomyPreviewPayload = built;
      specPreviewPayload = builtSpec;
    }
  } catch (error) {
    console.warn('[Anatomy Preview] Failed to build preview payload', error);
    anatomyPreviewPayload = null;
    specPreviewPayload = null;
  }

  return {
    ok: true,
    rootId: root.id,
    rootName: collected.rootName,
    options: collected.options,
    specSelectedLayerPaths: selectedLayerPaths,
    anatomySelectedLayerPaths,
    autoSelectedLayerPaths: collected.autoSelectedLayerPaths,
    specPreviewPayload,
    anatomyPreviewPayload,
  };
}
